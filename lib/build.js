// Master builder — assembles a FEG-spec head/tail around a program file.
// Head: 30s black / 30s bars+tone / 30s slate / 30s black, program at TC 01:00:00:00, 2s tail black.
// Segment lengths are computed in FRAMES so the program lands exactly on the hour timecode.
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ffmpegPath } = require('./ffbin');
const { probe } = require('./qc');

const FPS_TABLE = {
  '24000/1001': { tcBase: 24, label: '23.976' },
  '30000/1001': { tcBase: 30, label: '29.97' },
  '60000/1001': { tcBase: 60, label: '59.94' },
};

function ff(args) {
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, ['-y', '-v', 'error', ...args], { maxBuffer: 32 * 1024 * 1024 },
      (err, _o, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve()));
  });
}

function escText(t) {
  // drawtext escaping: backslash, colon, single quote
  return String(t || '').replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\\\'");
}

function fontFile() {
  if (process.platform === 'darwin') {
    for (const f of ['/System/Library/Fonts/Helvetica.ttc', '/System/Library/Fonts/Supplemental/Arial.ttf'])
      if (fs.existsSync(f)) return f;
  } else if (process.platform === 'win32') {
    for (const f of ['C:\\Windows\\Fonts\\arial.ttf', 'C:\\Windows\\Fonts\\calibri.ttf'])
      if (fs.existsSync(f)) return f;
  } else {
    for (const f of ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'])
      if (fs.existsSync(f)) return f;
  }
  return null;
}

/**
 * opts: {
 *   input, output,
 *   slate: { programTitle, episodeTitle, seasonEpisode, showCode, productionCompany,
 *            textlessAtTail (bool), audioConfig (string) }
 *   onProgress(stageText)
 * }
 */
async function buildMaster(opts) {
  const { input, output, slate = {}, onProgress = () => {} } = opts;
  fs.mkdirSync(path.dirname(output), { recursive: true });

  onProgress('Analyzing program file…');
  const info = await probe(input);
  const v = (info.streams || []).find(s => s.codec_type === 'video');
  if (!v) throw new Error('No video stream in input file.');
  const audioStreams = (info.streams || []).filter(s => s.codec_type === 'audio');
  const nAudio = audioStreams.length || 16;

  const fpsInfo = FPS_TABLE[v.r_frame_rate];
  if (!fpsInfo) throw new Error(`Frame rate ${v.r_frame_rate} is not one of the allowed rates (23.976 / 29.97 / 59.94). Fix the export first.`);
  const rate = v.r_frame_rate;
  const size = `${v.width}x${v.height}`;

  // ProRes profile to match program (prores_ks: 3 = 422 HQ, 5 = 4444 XQ)
  const prof = (v.profile || '').toUpperCase();
  const isXQ = prof.includes('XQ');
  const profArgs = isXQ
    ? ['-profile:v', '5', '-pix_fmt', 'yuv444p12le']
    : ['-profile:v', '3', '-pix_fmt', 'yuv422p10le'];

  // Frame-exact segment lengths so program starts at TC 01:00:00:00
  const f30 = 30 * fpsInfo.tcBase;         // 30s of timecode, in frames
  const f2 = 2 * fpsInfo.tcBase;           // 2s tail
  const secs = f => (f * 1001 / (fpsInfo.tcBase * 1000)).toFixed(6); // exact wall-clock seconds

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fegbuild-'));
  const seg = n => path.join(tmp, n);
  const vcodec = ['-c:v', 'prores_ks', ...profArgs, '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709'];
  const acodec = ['-c:a', 'pcm_s24le', '-ar', '48000', '-ac', '1'];

  // audio input maps: N mono tracks
  const silentIn = ['-f', 'lavfi', '-i', 'anullsrc=sample_rate=48000:channel_layout=mono'];
  // ffmpeg's lavfi `sine` source has a fixed, undocumented ~-18dBFS peak — not full scale —
  // so `volume=-20dB` on it lands around -38dBFS, not -20dBFS. aevalsrc gives an exact
  // 0dBFS-peak sine; -16.99dB on top of that lands RMS at exactly -20dBFS (verified against
  // astats), the spec's reference tone level (crest factor of a sine is 3.01dB peak-to-RMS).
  const toneIn = ['-f', 'lavfi', '-i', 'aevalsrc=sin(2*PI*1000*t):s=48000'];
  const audioMaps = [];
  for (let i = 0; i < nAudio; i++) audioMaps.push('-map', '1:a');

  try {
    // ---- black segments ----
    onProgress('Generating black segments…');
    await ff(['-f', 'lavfi', '-i', `color=black:size=${size}:rate=${rate}`, ...silentIn,
      '-map', '0:v', ...audioMaps, '-frames:v', String(f30), '-t', secs(f30), ...vcodec, ...acodec, seg('black30.mov')]);
    await ff(['-f', 'lavfi', '-i', `color=black:size=${size}:rate=${rate}`, ...silentIn,
      '-map', '0:v', ...audioMaps, '-frames:v', String(f2), '-t', secs(f2), ...vcodec, ...acodec, seg('black2.mov')]);

    // ---- bars & tone (1 kHz @ -20 dB on every track) ----
    onProgress('Generating color bars & tone…');
    await ff(['-f', 'lavfi', '-i', `smptehdbars=size=${size}:rate=${rate}`, ...toneIn,
      '-map', '0:v', ...audioMaps, '-af', 'volume=-16.99dB',
      '-frames:v', String(f30), '-t', secs(f30), ...vcodec, ...acodec, seg('bars.mov')]);

    // ---- slate ----
    onProgress('Generating slate…');
    const now = new Date().toISOString().slice(0, 10);
    const isTextless = slate.version === 'textless';
    const lines = [
      slate.programTitle || 'PROGRAM TITLE',
      slate.episodeTitle || '',
      slate.seasonEpisode || '',
      slate.showCode ? `Show Code: ${slate.showCode}` : '',
      slate.productionCompany || '',
      // Per spec: standalone textless slate reads "Textless Version";
      // texted slate carries "Textless at Tail" only when applicable.
      isTextless ? 'TEXTLESS VERSION' : (slate.textlessAtTail ? 'TEXTLESS AT TAIL' : ''),
      `${isXQ ? 'ProRes 4444 XQ' : 'ProRes 422 HQ'}  ${size}  ${fpsInfo.label}p  Rec. 709`,
      // Program runtime including program blacks (head/tail excluded per spec)
      `Total Runtime (incl. program blacks): ${fmtDur(Number(info.format.duration))}`,
      `Master created: ${now}`,
      slate.audioConfig || '16 mono tracks (5.1 PM / LtRt / FX / Mus / M&E / Narr / Mono PM)',
    ].filter(Boolean);
    const font = fontFile();
    const fontArg = font ? `fontfile='${escText(font)}':` : '';
    const draw = lines.map((l, i) =>
      `drawtext=${fontArg}text='${escText(l)}':fontcolor=white:fontsize=${i === 0 ? 56 : 34}:x=(w-text_w)/2:y=${140 + i * 80}`
    ).join(',');
    await ff(['-f', 'lavfi', '-i', `color=black:size=${size}:rate=${rate}`, ...silentIn,
      '-map', '0:v', ...audioMaps, '-vf', draw,
      '-frames:v', String(f30), '-t', secs(f30), ...vcodec, ...acodec, seg('slate.mov')]);

    // ---- concat ----
    onProgress('Assembling master (stream copy — program is not re-encoded)…');
    const list = seg('list.txt');
    const q = p => `file '${p.replace(/'/g, "'\\''")}'`;
    fs.writeFileSync(list, [
      q(seg('black30.mov')), q(seg('bars.mov')), q(seg('slate.mov')), q(seg('black30.mov')),
      q(path.resolve(input)), q(seg('black2.mov')),
    ].join('\n'));
    // prores_metadata BSF stamps Rec.709 color tags into every frame header
    // during stream copy — no re-encode, and QC/color pipelines read it properly.
    await ff(['-f', 'concat', '-safe', '0', '-i', list, '-map', '0', '-c', 'copy',
      '-bsf:v', 'prores_metadata=color_primaries=bt709:color_trc=bt709:colorspace=bt709',
      '-timecode', '00:58:00:00', output]);

    onProgress('Done.');
    return { output, audioTracks: nAudio, note: nAudio !== 16 ? `Program has ${nAudio} audio tracks — spec requires 16. Head/tail were matched to the program; fix track count before delivery.` : '' };
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  }
}

function fmtDur(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.round(s % 60);
  return [h, m, sec].map(n => String(n).padStart(2, '0')).join(':');
}

module.exports = { buildMaster };
