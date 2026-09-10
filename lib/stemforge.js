// Stem Assembler v3 — builds the FULL sidecar stem grid from five Premiere
// exports (FULL, NARR, DX, MX, FX), then embeds the required 16 tracks into
// the program video.
//
// Spec grid (60 mono WAVs):
//   Full Mix ............ 5.1 · 2.0 (Lt/Rt) · 1.0
//   Music & Effects ..... 5.1 · 2.0
//   Dialogue ............ 5.1 · 2.0 · 1.0
//   Music ............... 5.1 · 2.0
//   Effects ............. 5.1 · 2.0 · 1.0
//   Mix Minus Narration . 5.1 · 2.0
//   Narration ........... 5.1 · 2.0 · 1.0
//
// 5.1 layup from stereo sources (standard stem-based approach):
//   • Full Mix: C = dialogue+narration, L/R = music+effects bed,
//     LFE = low-passed bed (80Hz), Ls/Rs = bed at -6dB
//   • Centered stems (Dialogue, Narration): C = mono sum, others silent
//   • Bed stems (M&E, Music, Effects, MMN): L/R = source, C silent,
//     LFE = low-passed sum, Ls/Rs = source at -6dB
const { execFile, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { ffmpegPath, ffprobePath } = require('./ffbin');
const { versionedPath } = require('./filepaths');

// The 16 tracks embedded in the master, in spec order, mapped to grid files.
const TRACKS = [
  { n: 1,  file: 'Full Mix 5.1 L',   cfg: '5.1', asgn: 'Full Mix (Printmaster)', ch: 'Left' },
  { n: 2,  file: 'Full Mix 5.1 R',   cfg: '5.1', asgn: 'Full Mix (Printmaster)', ch: 'Right' },
  { n: 3,  file: 'Full Mix 5.1 C',   cfg: '5.1', asgn: 'Full Mix (Printmaster)', ch: 'Center' },
  { n: 4,  file: 'Full Mix 5.1 LFE', cfg: '5.1', asgn: 'Full Mix (Printmaster)', ch: 'Low Frequency Effects' },
  { n: 5,  file: 'Full Mix 5.1 Ls',  cfg: '5.1', asgn: 'Full Mix (Printmaster)', ch: 'Left Surround' },
  { n: 6,  file: 'Full Mix 5.1 Rs',  cfg: '5.1', asgn: 'Full Mix (Printmaster)', ch: 'Right Surround' },
  { n: 7,  file: 'Full Mix 2.0 Lt',  cfg: '2.0', asgn: 'Full Mix (Printmaster)', ch: 'Left Total' },
  { n: 8,  file: 'Full Mix 2.0 Rt',  cfg: '2.0', asgn: 'Full Mix (Printmaster)', ch: 'Right Total' },
  { n: 9,  file: 'Effects 2.0 L',    cfg: '2.0', asgn: 'Effects', ch: 'Left' },
  { n: 10, file: 'Effects 2.0 R',    cfg: '2.0', asgn: 'Effects', ch: 'Right' },
  { n: 11, file: 'Music 2.0 L',      cfg: '2.0', asgn: 'Music', ch: 'Left' },
  { n: 12, file: 'Music 2.0 R',      cfg: '2.0', asgn: 'Music', ch: 'Right' },
  { n: 13, file: 'M and E 2.0 L',    cfg: '2.0', asgn: 'Music & Effects', ch: 'Left' },
  { n: 14, file: 'M and E 2.0 R',    cfg: '2.0', asgn: 'Music & Effects', ch: 'Right' },
  { n: 15, file: 'Narration 1.0 M',  cfg: '1.0', asgn: 'Narration', ch: 'Mono' },
  { n: 16, file: 'Full Mix 1.0 M',   cfg: '1.0', asgn: 'Full Mix (Printmaster)', ch: 'Mono' },
];

// Stem grid definition. `kind`: 'full' (special layup) | 'centered' | 'bed'
const STEM_GRID = [
  { name: 'Full Mix',            kind: 'full',     has51: true, has20: true, has10: true,  n20: ['Lt', 'Rt'] },
  { name: 'M and E',             kind: 'bed',      has51: true, has20: true, has10: false, n20: ['L', 'R'], src: 'me' },
  { name: 'Dialogue',            kind: 'centered', has51: true, has20: true, has10: true,  n20: ['L', 'R'], src: 'dx' },
  { name: 'Music',               kind: 'bed',      has51: true, has20: true, has10: false, n20: ['L', 'R'], src: 'mx' },
  { name: 'Effects',             kind: 'bed',      has51: true, has20: true, has10: true,  n20: ['L', 'R'], src: 'fx' },
  { name: 'Mix Minus Narration', kind: 'bed',      has51: true, has20: true, has10: false, n20: ['L', 'R'], src: 'mmn', narrOnly: true },
  { name: 'Narration',           kind: 'centered', has51: true, has20: true, has10: true,  n20: ['L', 'R'], src: 'narr', narrOnly: true },
];

const A = 'aformat=sample_rates=48000:channel_layouts=stereo';
const PCM = ['-c:a', 'pcm_s24le', '-ar', '48000'];

function probeDur(file) {
  return new Promise((resolve, reject) => {
    execFile(ffprobePath, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
      (err, stdout) => (err ? reject(err) : resolve(parseFloat(stdout) || 0)));
  });
}

function probeStreams(file) {
  return new Promise((resolve, reject) => {
    execFile(ffprobePath, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file],
      { maxBuffer: 32 * 1024 * 1024 },
      (err, stdout) => (err ? reject(err) : resolve(JSON.parse(stdout))));
  });
}

function ffProgress(args, totalSec, onPct) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, ['-y', '-v', 'error', '-progress', 'pipe:1', '-nostats', ...args]);
    let errBuf = '';
    p.stderr.on('data', d => { errBuf = (errBuf + d).slice(-4000); });
    let buf = '', lastPct = 0;
    p.stdout.on('data', d => {
      buf += d;
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        const m = line.match(/^out_time_us=(\d+)/) || line.match(/^out_time_ms=(\d+)/);
        if (m && totalSec > 0 && onPct) {
          const pct = Math.min(99, Math.round((parseInt(m[1], 10) / 1e6) / totalSec * 100));
          lastPct = pct;
          onPct(pct);
        }
      }
    });
    p.on('error', reject);
    p.on('close', (code, signal) => {
      if (code === 0) return resolve();
      const msg = code === null
        ? `ffmpeg was killed by the system (signal ${signal || 'unknown'}) at ~${lastPct}%. Usual causes: destination drive full · source is a cloud-only placeholder (Make Available Offline) · machine slept.`
        : (errBuf.trim().slice(-600) || 'ffmpeg exited with code ' + code);
      reject(new Error(msg));
    });
  });
}

function preflight(srcVideo, outDir) {
  const notes = [];
  try {
    const st = fs.statSync(srcVideo);
    if (st.size > 50e6 && st.blocks * 512 < st.size * 0.5) {
      notes.push(`⚠ The source video looks like an online-only cloud placeholder (${(st.size / 1e9).toFixed(1)}GB reported, ~${(st.blocks * 512 / 1e9).toFixed(1)}GB on disk). Right-click it in Finder → "Make Available Offline", then retry.`);
    }
    if (typeof fs.statfsSync === 'function') {
      const sf = fs.statfsSync(outDir);
      const freeGB = sf.bavail * sf.bsize / 1e9, needGB = st.size * 1.15 / 1e9;
      if (freeGB < needGB) notes.push(`⚠ Not enough disk space: ~${needGB.toFixed(1)}GB needed, ${freeGB.toFixed(1)}GB free.`);
    }
  } catch (e) { /* best effort */ }
  return notes;
}

// Build the filter chains + output maps for one stem's variants.
// `S` = label of the prepared stereo source; `C51` = optional centre source label.
function variantChains(S, stem, C51) {
  const chains = [], outs = [];
  const pre = stem.name.replace(/[^\w& ]/g, '');
  // a centre channel supplied from outside (full-mix layup) means we don't
  // generate — or split for — a silent centre
  const needCsil = stem.kind !== 'centered' && !C51;
  const n51 = stem.has51 ? (stem.kind === 'centered' ? 4 : (needCsil ? 4 : 3)) : 0;
  const need = n51 + (stem.has20 ? 1 : 0) + (stem.has10 ? 1 : 0);
  const lbl = i => `${pre.replace(/\s/g, '')}_s${i}`;
  chains.push(`[${S}]asplit=${need}${Array.from({ length: need }, (_, i) => `[${lbl(i)}]`).join('')}`);
  let i = 0;
  if (stem.has51) {
    const a = lbl(i++);
    const b = (stem.kind === 'centered' || needCsil) ? lbl(i++) : null;
    const c = lbl(i++), d = lbl(i++);
    if (stem.kind === 'centered') {
      // dialogue / narration live in the centre channel
      chains.push(`[${a}]pan=mono|c0=0*c0[${pre}_L]`);
      chains.push(`[${b}]pan=mono|c0=0*c0[${pre}_R]`);
      chains.push(`[${c}]pan=mono|c0=0.5*c0+0.5*c1[${pre}_C]`);
      chains.push(`[${d}]asplit=3[${pre}_z1][${pre}_z2][${pre}_z3]`);
      chains.push(`[${pre}_z1]pan=mono|c0=0*c0[${pre}_LFE]`);
      chains.push(`[${pre}_z2]pan=mono|c0=0*c0[${pre}_Ls]`);
      chains.push(`[${pre}_z3]pan=mono|c0=0*c0[${pre}_Rs]`);
    } else {
      chains.push(`[${a}]channelsplit=channel_layout=stereo[${pre}_L][${pre}_R]`);
      if (needCsil) chains.push(`[${b}]pan=mono|c0=0*c0[${pre}_Csil]`);
      chains.push(`[${c}]pan=mono|c0=0.5*c0+0.5*c1,lowpass=f=80[${pre}_LFE]`);
      chains.push(`[${d}]channelsplit=channel_layout=stereo[${pre}_ls0][${pre}_rs0]`);
      chains.push(`[${pre}_ls0]volume=0.5[${pre}_Ls]`);
      chains.push(`[${pre}_rs0]volume=0.5[${pre}_Rs]`);
    }
    const cLabel = stem.kind === 'centered' ? `${pre}_C` : (C51 || `${pre}_Csil`);
    outs.push({ tag: `${pre}_L`, file: `${stem.name} 5.1 L` });
    outs.push({ tag: `${pre}_R`, file: `${stem.name} 5.1 R` });
    outs.push({ tag: cLabel, file: `${stem.name} 5.1 C` });
    outs.push({ tag: `${pre}_LFE`, file: `${stem.name} 5.1 LFE` });
    outs.push({ tag: `${pre}_Ls`, file: `${stem.name} 5.1 Ls` });
    outs.push({ tag: `${pre}_Rs`, file: `${stem.name} 5.1 Rs` });
  }
  if (stem.has20) {
    const a = lbl(i++);
    chains.push(`[${a}]channelsplit=channel_layout=stereo[${pre}_2L][${pre}_2R]`);
    outs.push({ tag: `${pre}_2L`, file: `${stem.name} 2.0 ${stem.n20[0]}` });
    outs.push({ tag: `${pre}_2R`, file: `${stem.name} 2.0 ${stem.n20[1]}` });
  }
  if (stem.has10) {
    const a = lbl(i++);
    chains.push(`[${a}]pan=mono|c0=0.5*c0+0.5*c1[${pre}_M]`);
    outs.push({ tag: `${pre}_M`, file: `${stem.name} 1.0 M` });
  }
  return { chains, outs };
}

/**
 * buildStems({ full, dx, mx, fx, narr, outDir, onProgress })
 * Writes the full 60-file spec grid (fewer if there's no narration).
 */
async function buildStems(opts) {
  const { full, dx, mx, fx, narr, onProgress = () => {} } = opts;
  const outDir = versionedPath(opts.outDir);
  for (const [label, f] of [['FULL', full], ['DX', dx], ['MX', mx], ['FX', fx]]) {
    if (!f || !fs.existsSync(f)) throw new Error(`Missing ${label} stem file.`);
  }
  const hasNarr = !!(narr && fs.existsSync(narr));
  const warnings = [];

  onProgress('Checking stems…');
  const toCheck = { full, dx, mx, fx, ...(hasNarr ? { narr } : {}) };
  const durs = {};
  for (const [k, f] of Object.entries(toCheck)) {
    const si = await probeStreams(f);
    const a = (si.streams || []).find(s => s.codec_type === 'audio') || {};
    durs[k] = parseFloat(si.format?.duration) || 0;
    if (a.channels === 1 && ['full', 'mx', 'fx'].includes(k)) {
      warnings.push(`${k.toUpperCase()} is MONO — the delivered master will have no stereo width. Re-export from Premiere with Channels: Stereo. (NARR/DX mono is fine.)`);
    }
  }
  const ref = durs.full;
  for (const [k, d] of Object.entries(durs)) {
    if (Math.abs(d - ref) > 0.2) warnings.push(`${k.toUpperCase()} is ${d.toFixed(2)}s vs FULL ${ref.toFixed(2)}s — stems must be identical length. Check your solo/export.`);
  }
  if (!hasNarr) warnings.push('No NARR file — Narration and Mix-Minus-Narration stems were skipped (allowed when content has no narration).');

  fs.mkdirSync(outDir, { recursive: true });
  const files = [];
  const stems = STEM_GRID.filter(s => hasNarr || !s.narrOnly);

  for (let si = 0; si < stems.length; si++) {
    const stem = stems[si];
    const tag = `${si + 1}/${stems.length} ${stem.name}`;
    onProgress(`Building ${tag}…`);

    let inputs, prep, C51 = null;
    if (stem.kind === 'full') {
      inputs = ['-i', full, '-i', dx, '-i', mx, '-i', fx, ...(hasNarr ? ['-i', narr] : [])];
      prep = [
        `[0:a]${A}[FULLSRC]`,
        `[1:a]${A}[dxin]`,
        `[2:a]${A}[mxin]`,
        `[3:a]${A}[fxin]`,
        `[mxin][fxin]amix=inputs=2:normalize=0[BED]`,
        hasNarr ? `[4:a]${A}[nain]` : null,
        hasNarr
          ? `[dxin][nain]amix=inputs=2:normalize=0,pan=mono|c0=0.5*c0+0.5*c1[FullMix_C]`
          : `[dxin]pan=mono|c0=0.5*c0+0.5*c1[FullMix_C]`,
      ].filter(Boolean);
      // 5.1 L/R/LFE/Ls/Rs come from the bed; 2.0 and 1.0 come from the real FULL mix
      const v = variantChains('BED', { ...stem, has20: false, has10: false }, 'FullMix_C');
      const v2 = variantChains('FULLSRC', { ...stem, has51: false }, null);
      prep.push(...v.chains, ...v2.chains);
      var outs = [...v.outs, ...v2.outs];
    } else {
      if (stem.src === 'me') {
        inputs = ['-i', mx, '-i', fx];
        prep = [`[0:a]${A}[m0]`, `[1:a]${A}[f0]`, `[m0][f0]amix=inputs=2:normalize=0[S]`];
      } else if (stem.src === 'mmn') {
        inputs = ['-i', dx, '-i', mx, '-i', fx];
        prep = [`[0:a]${A}[d0]`, `[1:a]${A}[m0]`, `[2:a]${A}[f0]`, `[d0][m0][f0]amix=inputs=3:normalize=0[S]`];
      } else {
        const srcFile = { dx, mx, fx, narr }[stem.src];
        inputs = ['-i', srcFile];
        prep = [`[0:a]${A}[S]`];
      }
      const v = variantChains('S', stem, null);
      prep.push(...v.chains);
      var outs = v.outs;
    }

    const args = [...inputs, '-filter_complex', prep.join(';')];
    for (const o of outs) {
      const dest = path.join(outDir, `${o.file}.wav`);
      files.push(dest);
      args.push('-map', `[${o.tag}]`, ...PCM, dest);
    }
    await ffProgress(args, ref, pct => onProgress(`Building ${tag}… ${pct}%`));
  }

  onProgress(`Done — ${files.length} stem files.`);
  return { files, warnings, outDir };
}

/**
 * embedMaster — muxes the spec's 16 tracks onto the program video with
 * per-track metadata labels (configuration · assignment · channel).
 */
async function embedMaster(opts) {
  const { video, stemsDir, onProgress = () => {} } = opts;
  let { output } = opts;
  if (fs.existsSync(output)) {
    const ext = path.extname(output), base = output.slice(0, -ext.length);
    let n = 2;
    while (fs.existsSync(`${base} v${n}${ext}`)) n++;
    output = `${base} v${n}${ext}`;
  }
  if (/_16TRK( v\d+)?\.mov$/i.test(video)) {
    throw new Error('That video is a previous embed output — pick your ORIGINAL ProRes export instead.');
  }
  const stems = TRACKS.map(t => path.join(stemsDir, `${t.file}.wav`));
  const missing = stems.filter(s => !fs.existsSync(s)).map(s => path.basename(s));
  if (missing.length) throw new Error('Missing built track(s): ' + missing.join(', ') + ' — run "Build stems" first.');

  const pre = preflight(video, path.dirname(output));
  if (pre.length) throw new Error(pre.join(' '));

  const info = await probeStreams(video);
  const vStream = (info.streams || []).find(s => s.codec_type === 'video');
  const frameRate = vStream && vStream.r_frame_rate;
  if (frameRate !== '30000/1001') throw new Error(`Program frame rate is ${frameRate || 'unknown'}; the house delivery spec requires 29.97.`);
  const vDur = parseFloat(info.format?.duration) || await probeDur(video);
  const aDur = await probeDur(stems[0]);
  const warn = Math.abs(vDur - aDur) > 0.2
    ? `⚠ Video is ${vDur.toFixed(2)}s but stems are ${aDur.toFixed(2)}s — confirm both came from the same cut.` : '';

  const tmcd = (info.streams || []).find(s => s.codec_tag_string === 'tmcd');
  const srcTC = (tmcd && tmcd.tags && tmcd.tags.timecode) ||
    (info.format && info.format.tags && info.format.tags.timecode) || '00:00:00:00';

  const args = ['-ignore_chapters', '1', '-i', video];
  stems.forEach(s => args.push('-i', s));
  args.push('-map', '0:v:0');
  for (let i = 1; i <= 16; i++) args.push('-map', `${i}:a:0`);
  args.push('-timecode', srcTC, '-map_chapters', '-1', '-c:v', 'copy',
    '-bsf:v', 'prores_metadata=color_primaries=bt709:color_trc=bt709:colorspace=bt709',
    '-c:a', 'pcm_s24le');
  TRACKS.forEach((t, i) => {
    const label = `${t.cfg} ${t.asgn} — ${t.ch}`;
    args.push(`-metadata:s:a:${i}`, `handler_name=${label}`, `-metadata:s:a:${i}`, `title=${label}`);
  });
  args.push('-shortest', output);
  await ffProgress(args, vDur, pct => onProgress(`Embedding 16 tracks… ${pct}%`));
  onProgress('Embed complete.');
  return { output, warning: warn, frameRate };
}

// Sample offset of the head's start (master TC 00:58:00:00) from a 00:00:00:00
// reference, at 48kHz — the BWF 'bext' TimeReference every padded sidecar carries.
const HEAD_TC_SAMPLES = 58 * 60 * 48000; // 167,040,000

// "N seconds" of broadcast timecode at the 29.97 house rate is N * 1001/1000
// real seconds — lib/build.js's
// video head/tail is frame-counted at this rate, so a 30s-labeled segment is actually
// 30.03s of real time. Sidecars must pad by the SAME real-seconds amount or they drift
// out of sync with the video master (measured: ~120ms over the head alone if padded
// with naive 30.000s blocks instead).
const NTSC_RATES = new Set(['30000/1001']);
const tcToRealSeconds = (tcSeconds, frameRate) => NTSC_RATES.has(frameRate) ? tcSeconds * 1001 / 1000 : tcSeconds;

/**
 * padStems — master-aligned sidecars for every WAV in stemsDir:
 * 2-min head (tone -20dBFS RMS during the bars window) + 2s tail, frame-rate-accurate
 * so they land at the exact same real-time duration as lib/build.js's video head/tail,
 * each file carrying a real BWF 'bext' chunk (description, originator, time reference)
 * so the master-timecode alignment is machine-verifiable, not just inferred from
 * silence padding.
 */
async function padStems(opts) {
  const { stemsDir, originator = 'Production Company', frameRate = '30000/1001', onProgress = () => {} } = opts;
  const outDir = versionedPath(opts.outDir);
  if (frameRate !== '30000/1001') throw new Error(`Sidecar frame rate is ${frameRate}; the house delivery spec requires 29.97.`);
  fs.mkdirSync(outDir, { recursive: true });
  const wavs = fs.readdirSync(stemsDir).filter(n => n.toLowerCase().endsWith('.wav')).sort();
  if (!wavs.length) throw new Error('No built stems found — run "Build stems" first.');
  const d30 = tcToRealSeconds(30, frameRate);
  const d60 = tcToRealSeconds(60, frameRate);
  const d2 = tcToRealSeconds(2, frameRate);
  const now = new Date();
  const originationDate = now.toISOString().slice(0, 10);
  const originationTime = now.toTimeString().slice(0, 8);
  const files = [];
  for (let i = 0; i < wavs.length; i++) {
    const src = path.join(stemsDir, wavs[i]);
    const stem = wavs[i].replace(/\.wav$/i, '');
    const out = path.join(outDir, `${stem} MASTER-ALIGNED.wav`);
    onProgress(`Padding sidecars… ${i + 1}/${wavs.length}`);
    const graph =
      `anullsrc=sample_rate=48000:channel_layout=mono,atrim=duration=${d30}[s1];` +
      // ffmpeg's lavfi `sine` source has a fixed, undocumented ~-18dBFS peak — not full
      // scale — so `volume=-20dB` on it lands around -38dBFS, not -20dBFS. aevalsrc gives
      // an exact 0dBFS-peak sine; -16.99dB on top lands RMS at exactly -20dBFS (verified
      // against astats), the spec's reference tone level.
      `aevalsrc=sin(2*PI*1000*t):s=48000,volume=-16.99dB,atrim=duration=${d30},aformat=channel_layouts=mono[tone];` +
      `anullsrc=sample_rate=48000:channel_layout=mono,atrim=duration=${d60}[s2];` +
      `anullsrc=sample_rate=48000:channel_layout=mono,atrim=duration=${d2}[s3];` +
      `[0:a]aformat=sample_rates=48000:channel_layouts=mono[prog];` +
      `[s1][tone][s2][prog][s3]concat=n=5:v=0:a=1[out]`;
    const args = [
      '-y', '-v', 'error', '-i', src, '-filter_complex', graph, '-map', '[out]', ...PCM,
      '-write_bext', '1',
      '-metadata', `description=${stem}`,
      '-metadata', `originator=${originator}`,
      '-metadata', `originator_reference=${stem}`,
      '-metadata', `origination_date=${originationDate}`,
      '-metadata', `origination_time=${originationTime}`,
      '-metadata', `time_reference=${HEAD_TC_SAMPLES}`,
      out,
    ];
    await new Promise((resolve, reject) => {
      execFile(ffmpegPath, args,
        { maxBuffer: 16 * 1024 * 1024 }, (err, _o, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve()));
    });
    files.push(out);
  }
  onProgress(`Sidecars complete — ${files.length} files.`);
  return { files, outDir };
}

module.exports = { buildStems, embedMaster, padStems, TRACKS, STEM_GRID };
