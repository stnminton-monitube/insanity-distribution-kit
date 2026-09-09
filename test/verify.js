#!/usr/bin/env node
// Verification battery. Run: node test/verify.js
// Generates synthetic media with ffmpeg lavfi — no fixtures required.
// Set FFMPEG/FFPROBE env vars to override binary paths.
const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mdt-verify-'));
// Default to the app's own bundled ffmpeg/ffprobe (same resolution lib/ffbin.js gives the
// real app) rather than requiring a system-wide install on PATH — set FFMPEG/FFPROBE to
// override.
const { ffmpegPath, ffprobePath } = require(path.join(ROOT, 'lib', 'ffbin.js'));
const FFMPEG = process.env.FFMPEG || ffmpegPath;
const FFPROBE = process.env.FFPROBE || ffprobePath;
let pass = 0, fail = 0;

const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✔ ${name}${detail ? ' — ' + detail : ''}`); }
  else { fail++; console.log(`  ✖ ${name}${detail ? ' — ' + detail : ''}`); }
};
const ff = args => execFileSync(FFMPEG, ['-y', '-v', 'error', ...args], { stdio: 'pipe' });

(async () => {
  console.log('\n== 1. Syntax ==');
  for (const f of ['main.js', 'preload.js', ...fs.readdirSync(path.join(ROOT, 'lib')).map(n => 'lib/' + n)]) {
    if (!f.endsWith('.js')) continue;
    try { execSync(`node --check "${path.join(ROOT, f)}"`, { stdio: 'pipe' }); ok(f, true); }
    catch (e) { ok(f, false, 'syntax error'); }
  }
  // renderer inline script
  const html = fs.readFileSync(path.join(ROOT, 'renderer/index.html'), 'utf8');
  const script = (html.match(/<script>([\s\S]*?)<\/script>/) || [])[1] || '';
  const rp = path.join(TMP, 'renderer-script.js');
  fs.writeFileSync(rp, script);
  try { execSync(`node --check "${rp}"`, { stdio: 'pipe' }); ok('renderer inline script', true); }
  catch (e) { ok('renderer inline script', false); }
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  ok('no duplicate element ids', new Set(ids).size === ids.length);

  console.log('\n== 2. Structure ==');
  ok('templates', require(path.join(ROOT, 'lib/templates.js')).TEMPLATES.length >= 14);
  ok('stages = 10', require(path.join(ROOT, 'lib/stages.js')).STAGES.length === 10);
  const guide = require(path.join(ROOT, 'lib/guide.js')).GUIDE_STEPS;
  ok('guide steps all have diagrams', guide.every(s => s.svg), `${guide.length} steps`);
  const sf = require(path.join(ROOT, 'lib/stemforge.js'));
  ok('16 embedded tracks defined', sf.TRACKS.length === 16);
  const gridCount = sf.STEM_GRID.reduce((n, s) =>
    n + (s.has51 ? 6 : 0) + (s.has20 ? 2 : 0) + (s.has10 ? 1 : 0), 0);
  ok('stem grid = 60 files', gridCount === 60, `${gridCount}`);

  console.log('\n== 2b. Runtime classification ==');
  const { classifyRuntime } = require(path.join(ROOT, 'lib/checklist.js'));
  const cr = m => classifyRuntime(m * 60);
  ok('23:00 (half-hour min boundary) is in range', cr(23).inRange && cr(23).format.id === 'half');
  ok('26:00 (half-hour max boundary) is in range', cr(26).inRange && cr(26).format.id === 'half');
  ok('22:54 (just under half-hour) is UNDER, not in range', !cr(22.9).inRange && /UNDER/.test(cr(22.9).message));
  ok('46:00 (hour min boundary) is in range', cr(46).inRange && cr(46).format.id === 'hour');
  ok('52:00 (hour max boundary) is in range', cr(52).inRange && cr(52).format.id === 'hour');
  ok('60:00 is OVER the hour window', !cr(60).inRange && /OVER/.test(cr(60).message));
  ok('5:00 is UNDER, nearest to half-hour (not hour)', !cr(5).inRange && cr(5).format.id === 'half' && /UNDER/.test(cr(5).message));
  ok('35:00 (between formats) picks nearest by distance (half-hour, OVER)', !cr(35).inRange && cr(35).format.id === 'half' && /OVER/.test(cr(35).message));
  ok('25:40 (< 30s of ceiling) warns about approaching the limit', /Close to the ceiling/.test(cr(25 + 40 / 60).message));
  ok('25:00 (60s from ceiling) does NOT warn about approaching the limit', !/Close to the ceiling/.test(cr(25).message));

  console.log('\n== 3. Media pipeline ==');
  // synthetic stems + 16-track prores program
  for (const [n, ch, f] of [['FULL', 2, 300], ['MX', 2, 320], ['FX', 2, 340], ['DX', 1, 200], ['NARR', 1, 220]]) {
    ff(['-f', 'lavfi', '-i', `sine=f=${f}:r=48000`, '-t', '2', '-c:a', 'pcm_s24le', '-ac', String(ch), path.join(TMP, `${n}.wav`)]);
  }
  const amap = []; for (let i = 0; i < 16; i++) amap.push('-map', '1:a');
  ff(['-f', 'lavfi', '-i', 'testsrc2=s=1920x1080:r=30000/1001', '-f', 'lavfi', '-i', 'sine=f=440:r=48000',
    '-map', '0:v', ...amap, '-t', '2', '-c:v', 'prores_ks', '-profile:v', '3', '-pix_fmt', 'yuv422p10le',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-c:a', 'pcm_s24le', '-ar', '48000', '-ac', '1', '-timecode', '00:00:00:00', path.join(TMP, 'prog.mov')]);

  const { runQC } = require(path.join(ROOT, 'lib/qc.js'));
  const qc = await runQC(path.join(TMP, 'prog.mov'));
  ok('QC: no failures on spec-clean master', qc.filter(r => r.level === 'fail').length === 0);

  // Negative paths — confirm QC actually catches real production mistakes,
  // not just that it passes clean input. Each checks the SPECIFIC row fails,
  // not just "something failed" (a fail anywhere would trivially pass a looser test).
  const failReason = (results, check) => (results.find(r => r.check === check) || {}).level;
  ff(['-f', 'lavfi', '-i', 'testsrc2=s=1920x1080:r=30000/1001', '-f', 'lavfi', '-i', 'sine=f=440:r=48000',
    '-map', '0:v', '-map', '1:a', '-t', '1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', path.join(TMP, 'badwrap.mp4')]);
  const qcWrap = await runQC(path.join(TMP, 'badwrap.mp4'));
  ok('QC catches wrong wrapper (MP4 instead of MOV)', failReason(qcWrap, 'Wrapper') === 'fail');
  const renamedPath = path.join(TMP, 'renamed.mov');
  fs.copyFileSync(path.join(TMP, 'badwrap.mp4'), renamedPath);
  const qcRenamed = await runQC(renamedPath);
  ok('QC catches an MP4 renamed to .mov (major_brand mismatch)', failReason(qcRenamed, 'Wrapper') === 'fail');

  ff(['-f', 'lavfi', '-i', 'testsrc2=s=1920x1080:r=30000/1001', '-f', 'lavfi', '-i', 'sine=f=440:r=48000',
    '-map', '0:v', '-map', '1:a', '-t', '1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    '-c:a', 'pcm_s24le', path.join(TMP, 'badcodec.mov')]);
  const qcCodec = await runQC(path.join(TMP, 'badcodec.mov'));
  ok('QC catches wrong codec (H.264 instead of ProRes)', failReason(qcCodec, 'Codec') === 'fail');

  ff(['-f', 'lavfi', '-i', 'testsrc2=s=1280x720:r=30000/1001', '-f', 'lavfi', '-i', 'sine=f=440:r=48000',
    '-map', '0:v', '-map', '1:a', '-t', '1', '-c:v', 'prores_ks', '-profile:v', '3', '-pix_fmt', 'yuv422p10le',
    '-c:a', 'pcm_s24le', path.join(TMP, 'badres.mov')]);
  const qcRes = await runQC(path.join(TMP, 'badres.mov'));
  ok('QC catches wrong resolution (1280x720)', failReason(qcRes, 'Resolution') === 'fail');

  ff(['-f', 'lavfi', '-i', 'testsrc2=s=1920x1080:r=25', '-f', 'lavfi', '-i', 'sine=f=440:r=48000',
    '-map', '0:v', '-map', '1:a', '-t', '1', '-c:v', 'prores_ks', '-profile:v', '3', '-pix_fmt', 'yuv422p10le',
    '-c:a', 'pcm_s24le', path.join(TMP, 'badfps.mov')]);
  const qcFps = await runQC(path.join(TMP, 'badfps.mov'));
  ok('QC catches wrong frame rate (25fps PAL)', failReason(qcFps, 'Frame rate') === 'fail');

  const amap2 = []; for (let i = 0; i < 2; i++) amap2.push('-map', '1:a');
  ff(['-f', 'lavfi', '-i', 'testsrc2=s=1920x1080:r=30000/1001', '-f', 'lavfi', '-i', 'sine=f=440:r=48000',
    '-map', '0:v', ...amap2, '-t', '1', '-c:v', 'prores_ks', '-profile:v', '3', '-pix_fmt', 'yuv422p10le',
    '-c:a', 'pcm_s24le', '-ac', '2', path.join(TMP, 'badaudio.mov')]);
  const qcAudio = await runQC(path.join(TMP, 'badaudio.mov'));
  ok('QC catches wrong track count (2 instead of 16)', failReason(qcAudio, 'Audio track count') === 'fail');
  ok('QC catches non-mono tracks (stereo instead of mono)', failReason(qcAudio, 'Audio channels per track') === 'fail');

  ff(['-f', 'lavfi', '-i', 'testsrc2=s=1920x1080:r=30000/1001', '-f', 'lavfi', '-i', 'sine=f=440:r=44100',
    '-map', '0:v', '-map', '1:a', '-t', '1', '-c:v', 'prores_ks', '-profile:v', '3', '-pix_fmt', 'yuv422p10le',
    '-c:a', 'pcm_s24le', '-ar', '44100', path.join(TMP, 'badsr.mov')]);
  const qcSr = await runQC(path.join(TMP, 'badsr.mov'));
  ok('QC catches wrong sample rate (44.1kHz instead of 48kHz)', failReason(qcSr, 'Audio sample rate') === 'fail');

  const built = await sf.buildStems({
    full: path.join(TMP, 'FULL.wav'), dx: path.join(TMP, 'DX.wav'), mx: path.join(TMP, 'MX.wav'),
    fx: path.join(TMP, 'FX.wav'), narr: path.join(TMP, 'NARR.wav'),
    outDir: path.join(TMP, 'grid'), onProgress: () => {},
  });
  ok('stem grid builds 60 files', built.files.length === 60, `${built.files.length}`);

  const emb = await sf.embedMaster({
    video: path.join(TMP, 'prog.mov'), stemsDir: path.join(TMP, 'grid'),
    output: path.join(TMP, 'embed.mov'), onProgress: () => {},
  });
  const nTracks = execSync(`"${FFPROBE}" -v error -select_streams a -show_entries stream=index -of csv=p=0 "${emb.output}" | wc -l`).toString().trim();
  ok('embed produces 16 audio tracks', nTracks === '16', nTracks);
  const labels = execSync(`"${FFPROBE}" -v error -select_streams a:0 -show_entries stream_tags=handler_name -of csv=p=0 "${emb.output}"`).toString().trim();
  ok('tracks carry spec metadata labels', /Full Mix/.test(labels), labels);

  const padded = await sf.padStems({
    stemsDir: path.join(TMP, 'grid'), outDir: path.join(TMP, 'padded'),
    originator: 'Test Co', frameRate: emb.frameRate, onProgress: () => {},
  });
  ok('padStems writes all 60 sidecars', padded.files.length === 60, `${padded.files.length}`);
  const padDur = parseFloat(execSync(`"${FFPROBE}" -v error -show_entries format=duration -of csv=p=0 "${padded.files[0]}"`).toString().trim());
  ok('padded sidecar covers the full 2min head + 2s program + 2s tail', Math.abs(padDur - 124.12) < 0.05, `${padDur}s`);
  const toneRms = execSync(`${FFMPEG} -ss 45 -t 1 -i "${padded.files[0]}" -af astats=metadata=0 -f null - 2>&1 | grep "RMS level dB" | head -1`).toString();
  const rmsVal = parseFloat((toneRms.match(/RMS level dB:\s*(-?[\d.]+)/) || [])[1]);
  ok('reference tone measures -20dBFS RMS', Math.abs(rmsVal - -20) < 0.5, `${rmsVal}dB`);
  const bextRef = execSync(`"${FFPROBE}" -v error -show_entries format_tags=time_reference -of csv=p=0 "${padded.files[0]}"`).toString().trim();
  ok('sidecar carries BWF time_reference (master TC 00:58:00:00)', bextRef === '167040000', bextRef);

  const { buildMaster } = require(path.join(ROOT, 'lib/build.js'));
  const built2 = await buildMaster({
    input: emb.output, output: path.join(TMP, 'broadcast.mov'),
    slate: { programTitle: 'Verify Test', version: 'texted' }, onProgress: () => {},
  });
  ok('buildMaster preserves all 16 audio tracks', built2.audioTracks === 16, `${built2.audioTracks}`);
  const masterDur = parseFloat(execSync(`"${FFPROBE}" -v error -show_entries format=duration -of csv=p=0 "${built2.output}"`).toString().trim());
  ok('broadcast master covers the full 2min head + 2s program + 2s tail', Math.abs(masterDur - 124.12) < 0.05, `${masterDur}s`);
  const masterToneRms = execSync(`${FFMPEG} -ss 45 -t 1 -i "${built2.output}" -map 0:a:0 -af astats=metadata=0 -f null - 2>&1 | grep "RMS level dB" | head -1`).toString();
  const masterRmsVal = parseFloat((masterToneRms.match(/RMS level dB:\s*(-?[\d.]+)/) || [])[1]);
  ok('broadcast master tone measures -20dBFS RMS', Math.abs(masterRmsVal - -20) < 0.5, `${masterRmsVal}dB`);
  // The real regression guard: sidecars and the video master must land at the same
  // real-world duration, or they drift out of sync (this exact bug shipped once —
  // sidecars padded with naive 30.000s blocks while the video's frame-counted head
  // was actually 30.03s per segment at 29.97fps, ~120ms of accumulated drift).
  ok('sidecars and broadcast master agree on head/tail duration (no NTSC drift)',
    Math.abs(padDur - masterDur) < 0.01, `sidecar ${padDur}s vs master ${masterDur}s`);

  console.log('\n== 4. Intake & captions ==');
  const intake = require(path.join(ROOT, 'lib/intake.js'));
  const wavChecks = await intake.checkWav(path.join(TMP, 'NARR.wav'));
  ok('WAV check passes valid mono/48k/24-bit', wavChecks.filter(r => r.level === 'fail').length === 0);
  ff(['-f', 'lavfi', '-i', 'sine=f=440:r=44100', '-t', '1', '-c:a', 'pcm_s16le', '-ac', '2', path.join(TMP, 'badwav.wav')]);
  const badWavChecks = await intake.checkWav(path.join(TMP, 'badwav.wav'));
  ok('WAV check catches stereo/16-bit/44.1kHz all at once', badWavChecks.filter(r => r.level === 'fail').length === 3);
  fs.writeFileSync(path.join(TMP, 'seg.csv'), ',,01:00:00:00,01:06:58:23,00:06:58:23,Comment\n');
  ok('timings CSV accepted', intake.checkTimings(path.join(TMP, 'seg.csv')).filter(r => r.level === 'fail').length === 0);
  fs.writeFileSync(path.join(TMP, 'empty.csv'), 'not a timings file\n');
  ok('timings CSV rejects a file with no timecode rows', intake.checkTimings(path.join(TMP, 'empty.csv')).some(r => r.level === 'fail'));
  fs.mkdirSync(path.join(TMP, 'ep'), { recursive: true });
  fs.writeFileSync(path.join(TMP, 'versioned.txt'), 'v1');
  const vd1 = intake.fileIt(path.join(TMP, 'versioned.txt'), path.join(TMP, 'ep'), 'Distribution', '01 Master');
  fs.writeFileSync(path.join(TMP, 'versioned.txt'), 'v2');
  const vd2 = intake.fileIt(path.join(TMP, 'versioned.txt'), path.join(TMP, 'ep'), 'Distribution', '01 Master');
  ok('fileIt never overwrites — re-filing the same name versions instead',
    vd1 !== vd2 && fs.readFileSync(vd1, 'utf8') === 'v1' && fs.readFileSync(vd2, 'utf8') === 'v2');
  fs.writeFileSync(path.join(TMP, 'x.scc'), 'Scenarist_SCC V1.0\n\n00:00:05;12\t9420 9420 94ae\n');
  const sccparse = require(path.join(ROOT, 'lib/sccparse.js'));
  const retimed = sccparse.retimeCaptionFile(path.join(TMP, 'x.scc'));
  ok('captions retime +1hr', /01:00:05;12/.test(fs.readFileSync(retimed, 'utf8')));

  // parseCaptions was only exercised indirectly (via retime) — never for actual text
  // extraction. Real CEA-608 byte pairs (parity-masked, so any parity bit works):
  // "5445 5354" = T,E,S,T ; "142f" = control code b1=0x14 b2=0x2f (EOC, flushes the cue).
  fs.writeFileSync(path.join(TMP, 'multi.scc'),
    'Scenarist_SCC V1.0\n\n00:00:05:12\t5445 5354 142f\n00:00:10:00\t4849 2054 4845 5245 142f\n');
  const sccEvents = sccparse.parseCaptions(path.join(TMP, 'multi.scc'));
  ok('SCC parses multiple cues with correct text and timecode',
    sccEvents.length === 2 && sccEvents[0].text === 'TEST' && sccEvents[0].tc === '00:00:05:12' &&
    sccEvents[1].text === 'HI THERE' && sccEvents[1].tc === '00:00:10:00');

  fs.writeFileSync(path.join(TMP, 'multi.srt'),
    '1\n00:00:05,500 --> 00:00:08,000\nHello <i>world</i>\n\n2\n00:00:10,250 --> 00:00:12,000\nSecond line\n');
  const srtEvents = sccparse.parseCaptions(path.join(TMP, 'multi.srt'));
  ok('SRT strips HTML tags from cue text', srtEvents[0].text === 'Hello world');
  // ms→frame must use the 29.97fps house standard, not a hardcoded 25fps (PAL) divisor —
  // this app never delivers at 25fps. 500ms ≈ frame 15 at 29.97fps (was frame 12 at 25fps).
  ok('SRT converts ms to frame number at 29.97fps, not 25fps', srtEvents[0].tc === '00:00:05:15');

  console.log('\n== 4b. After Effects project scanning + render farm payload logic ==');
  const aepinspect = require(path.join(ROOT, 'lib/aepinspect.js'));
  fs.mkdirSync(path.join(TMP, 'proj/Auto-Save'), { recursive: true });
  fs.mkdirSync(path.join(TMP, 'proj/subdir'), { recursive: true });
  fs.mkdirSync(path.join(TMP, 'proj/Old Versions'), { recursive: true });
  fs.writeFileSync(path.join(TMP, 'proj/Episode1.aep'), '');
  fs.writeFileSync(path.join(TMP, 'proj/Episode1_TEXTLESS.aep'), '');
  fs.writeFileSync(path.join(TMP, 'proj/subdir/Episode2.aep'), '');
  fs.writeFileSync(path.join(TMP, 'proj/Auto-Save/Episode1 Auto-Save.aep'), '');
  fs.writeFileSync(path.join(TMP, 'proj/Old Versions/Episode1 old.aep'), '');
  fs.writeFileSync(path.join(TMP, 'proj/notes.txt'), '');
  const aeps = aepinspect.scanAeps(path.join(TMP, 'proj')).map(f => path.relative(path.join(TMP, 'proj'), f));
  ok('scanAeps finds real AEPs incl. subfolders', aeps.includes('Episode1.aep') && aeps.includes(path.join('subdir', 'Episode2.aep')));
  ok('scanAeps excludes _TEXTLESS copies', !aeps.some(f => /_TEXTLESS/.test(f)));
  ok('scanAeps excludes Auto-Save and Old Versions folders', !aeps.some(f => /Auto-Save|Old Versions/.test(f)));
  ok('scanAeps ignores non-.aep files', aeps.length === 2);

  const disableJsx = aepinspect.buildDisableAndSaveJsx('/a/Episode1.aep', '/a/Episode1_TEXTLESS.aep', '/tmp/report.json');
  ok('buildDisableAndSaveJsx disables real TextLayers, TXT_-prefixed, and label-9 layers',
    /instanceof TextLayer/.test(disableJsx) && /TXT_/.test(disableJsx) && /LABEL = 9/.test(disableJsx));
  ok('buildDisableAndSaveJsx skips the save when nothing was disabled',
    /disabled === 0/.test(disableJsx) && /"skipped":true/.test(disableJsx));
  ok('buildDisableAndSaveJsx never uses Array.prototype.map (this AE\'s ExtendScript engine doesn\'t support it — hit this exact bug once)',
    !/\.map\(/.test(disableJsx));

  const renderfarm = require(path.join(ROOT, 'lib/renderfarm.js'));
  const anchor = 'Insanity Media Dropbox';
  ok('localPathToDropboxPath anchors on the configured Dropbox team folder name',
    renderfarm.localPathToDropboxPath(`/Volumes/main/Users/x/${anchor}/Insanity/Video/2 Ayoub/IB50 - Steven Douglas/K_LT_1.aep`, { dropboxLocalAnchor: anchor })
      === '/Insanity/Video/2 Ayoub/IB50 - Steven Douglas/K_LT_1.aep');
  ok('localPathToDropboxPath throws an actionable error when the anchor is missing (not a silent wrong path)',
    (() => { try { renderfarm.localPathToDropboxPath('/Volumes/main/Users/x/SomeOtherFolder/thing.aep', { dropboxLocalAnchor: anchor }); return false; } catch (e) { return /doesn't contain/.test(e.message); } })());

  ok('findProjectFolderName picks the folder matching the stable project-code prefix',
    renderfarm.findProjectFolderName('/Vol/Insanity Media Dropbox/Insanity/Video/2 Ayoub/IB50 - Steven Douglas/3 After Effects PROJECTS/K_LT_1.aep') === 'IB50 - Steven Douglas');
  ok('findProjectFolderName also matches a hyphenated code like TUBI-1',
    renderfarm.findProjectFolderName('/Vol/Dropbox/Video/TUBI-1 - Some Show/AE/thing.aep') === 'TUBI-1 - Some Show');

  // This app no longer talks to Notion/Dropbox directly — that moved to the
  // centralized relay (insanity-dashboard's own renderfarm.js, a separate
  // repo). All that's left here is one HTTP call to that relay; confirm the
  // request/auth shape and error handling, mocked, no live network.
  console.log('\n== 4c-farm. Render farm relay call (mocked fetch — no live API) ==');
  const realFetchFarm = global.fetch;
  let lastFarmCall;
  global.fetch = async (url, opts) => {
    lastFarmCall = { url, method: opts.method, headers: opts.headers, body: opts.body ? JSON.parse(opts.body) : null };
    return { ok: true, json: async () => ({ queued: true, row: 'K_LT_1', mode: 'both' }) };
  };
  const relayResult = await renderfarm.queueOnRelay('https://relay.example.com/', 'reltoken123', {
    dropboxPath: '/Insanity/Video/proj/K_LT_1.aep', projectFolderName: 'IB50 - Steven Douglas', rowLabel: 'K_LT_1', format: 'Alpha', mode: 'both',
  });
  ok('queueOnRelay posts to /api/extension/renderfarm/queue with a trailing-slash-safe base URL',
    lastFarmCall.url === 'https://relay.example.com/api/extension/renderfarm/queue');
  ok('queueOnRelay sends the relay token as a Bearer header, never a Notion/Dropbox secret',
    lastFarmCall.headers.Authorization === 'Bearer reltoken123');
  ok('queueOnRelay forwards mode/format/rowLabel/dropboxPath/projectFolderName untouched',
    lastFarmCall.body.mode === 'both' && lastFarmCall.body.format === 'Alpha' && lastFarmCall.body.rowLabel === 'K_LT_1');
  ok('queueOnRelay returns the relay\'s response', relayResult.queued === true && relayResult.row === 'K_LT_1');

  global.fetch = async (url, opts) => ({ ok: false, status: 400, json: async () => ({ error: 'Missing dropboxPath.' }) });
  ok('queueOnRelay surfaces the relay\'s actual error message, not a generic one',
    await (async () => { try { await renderfarm.queueOnRelay('https://relay.example.com', 'tok', {}); return false; } catch (e) { return e.message === 'Missing dropboxPath.'; } })());
  global.fetch = realFetchFarm;

  console.log('\n== 4c. Notion payload construction (mocked fetch — no live API) ==');
  const notion = require(path.join(ROOT, 'lib/notion.js'));
  const realFetch = global.fetch;
  let lastCall;
  global.fetch = async (url, opts) => {
    lastCall = { url, body: opts.body ? JSON.parse(opts.body) : null };
    return { ok: true, json: async () => ({ id: 'p', url: 'u', title: [{ plain_text: 'T' }] }) };
  };
  const dbId = '1234567890abcdef1234567890abcdef';
  // cleanDbId (not exported — verified indirectly via the outgoing request URL).
  // A blanket dash-strip-then-match approach breaks the instant a URL slug word ends in
  // a hex-valid letter (a/b/c/d/e/f — "Database", "Archive", "Table"…): the regex greedily
  // grabs a 32-char run starting inside the slug instead of at the real ID, silently
  // returning the WRONG database. Bug shipped once; regression-tested here permanently.
  await notion.testConnection('tok', `https://notion.so/ws/My-Database-${dbId}?v=x`);
  ok('cleanDbId extracts the real ID from a URL whose slug ends in a hex-valid letter',
    lastCall.url.endsWith('/databases/' + dbId));
  await notion.testConnection('tok', '12345678-90ab-cdef-1234-567890abcdef');
  ok('cleanDbId handles a dashed-UUID-formatted ID', lastCall.url.endsWith('/databases/' + dbId));
  await notion.testConnection('tok', dbId);
  ok('cleanDbId handles a bare compact ID', lastCall.url.endsWith('/databases/' + dbId));

  await notion.createEpisode('tok', dbId, { title: 'Ep 5' });
  ok('createEpisode omits Season/Episode# properties when not provided', !('Season' in lastCall.body.properties));
  await notion.createEpisode('tok', dbId, { title: 'Ep 5', season: '2', ep: '5' });
  ok('createEpisode includes Season/Episode# as numbers when provided',
    lastCall.body.properties.Season.number === 2 && lastCall.body.properties['Episode #'].number === 5);

  await notion.pushQC('tok', 'page1', 'Texted Video', false, 'bad codec');
  ok('pushQC builds correct select/rich_text shape for a failure',
    lastCall.body.properties['Texted Video'].select.name === 'QC Failed' &&
    /FAILED: bad codec/.test(lastCall.body.properties['QC Notes'].rich_text[0].text.content));

  let pageCalls = 0;
  global.fetch = async () => {
    pageCalls++;
    return {
      ok: true, json: async () => ({
        results: [
          { id: 't', url: 'ut', properties: { Episode: { title: [{ plain_text: '📋 TEMPLATE' }] } } },
          { id: 'e1', url: 'ue1', properties: { Episode: { title: [{ plain_text: 'S01E01' }] }, 'Texted Video': { select: { name: 'QC Passed' } } } },
        ],
        has_more: pageCalls === 1, next_cursor: pageCalls === 1 ? 'c2' : null,
      }),
    };
  };
  const eps = await notion.listEpisodes('tok', dbId);
  ok('listEpisodes follows pagination (has_more/next_cursor)', pageCalls === 2);
  ok('listEpisodes filters out the 📋 TEMPLATE row', !eps.some(e => /TEMPLATE/.test(e.title)));
  ok('listEpisodes maps asset select values incl. the newer Textless No Graphics property',
    eps[0].assets['Texted Video'] === 'QC Passed' && eps[0].assets['Textless No Graphics'] === 'Not started');
  global.fetch = realFetch;

  console.log('\n== 5. Premiere XML ==');
  const px = require(path.join(ROOT, 'lib/premxml.js'));
  // graphics swap + clean variants
  fs.mkdirSync(path.join(TMP, 'r'), { recursive: true });
  fs.writeFileSync(path.join(TMP, 'r/LT_x.mp4'), 'x');
  fs.writeFileSync(path.join(TMP, 'r/LT_x_TEXTLESS.mp4'), 'x');
  fs.writeFileSync(path.join(TMP, 'r/cam.mp4'), 'x');
  const seqXml = `<xmeml version="4"><sequence><name>S</name><media><video><track>
<clipitem><name>LT_x</name><enabled>TRUE</enabled><file><pathurl>file://localhost${TMP}/r/LT_x.mp4</pathurl></file></clipitem>
<clipitem><name>cam</name><enabled>TRUE</enabled><file><pathurl>file://localhost${TMP}/r/cam.mp4</pathurl></file></clipitem>
</track></video></media></sequence></xmeml>`;
  fs.writeFileSync(path.join(TMP, 'seq.xml'), seqXml);
  const tl = px.makeTextlessXML(path.join(TMP, 'seq.xml'), 'TXT|LT_|LOWER|TITLE|CHYRON');
  ok('textless XML swaps graphics only', tl.replaced.length === 1 && /cam\.mp4/.test(fs.readFileSync(tl.outPath, 'utf8')));
  const cl = px.makeCleanXML(path.join(TMP, 'seq.xml'), 'TXT|LT_|LOWER|TITLE|CHYRON');
  const cleanOut = fs.readFileSync(cl.outPath, 'utf8');
  ok('clean XML disables graphics, keeps footage',
    cl.disabled.length === 1 && /LT_x<\/name><enabled>FALSE/.test(cleanOut) && /cam<\/name><enabled>TRUE/.test(cleanOut));

  // ---- CLAUDE.md's 5 documented parseSequenceXML bugs, each individually regression-tested ----
  const nestedXml = `<xmeml version="4"><sequence id="master"><name>M</name>
<rate><timebase>30</timebase><ntsc>TRUE</ntsc></rate>
<timecode><rate><timebase>30</timebase><ntsc>TRUE</ntsc></rate><frame>0</frame></timecode>
<media>
<video><format><samplecharacteristics><width>1920</width><height>1080</height></samplecharacteristics></format>
<track><clipitem><name>NestedClip</name><start>0</start><end>100</end><in>0</in><out>100</out>
<file id="file1"><name>Cam1.mov</name><media><video><samplecharacteristics><width>1920</width></samplecharacteristics></video></media></file>
<sequence id="nested1"><name>N</name><rate><timebase>30</timebase><ntsc>TRUE</ntsc></rate>
<media><video><track><clipitem><name>InnerVideoClip</name><start>0</start><end>50</end><in>0</in><out>50</out></clipitem></track></video>
<audio><track><clipitem><name>InnerAudioClip</name><start>0</start><end>50</end><in>0</in><out>50</out></clipitem></track></audio>
</media></sequence></clipitem></track></video>
<audio><track><clipitem><name>MasterAudioClip</name><start>0</start><end>100</end><in>0</in><out>100</out></clipitem></track></audio>
</media>
<marker><name>Seg 1</name><comment>first</comment><in>0</in><out>100</out></marker>
</sequence></xmeml>`;
  fs.writeFileSync(path.join(TMP, 'nested.xml'), nestedXml);
  const nestedParsed = px.parseSequenceXML(path.join(TMP, 'nested.xml'));
  ok('bug#1 nested sequences: master video track shows ONLY its own clip, not the nested content',
    nestedParsed.videoTracks.length === 1 && nestedParsed.videoTracks[0].clips.map(c => c.name).join() === 'NestedClip');
  ok('bug#1 nested sequence count detected', nestedParsed.nestedSequences === 1);
  ok('bug#2 master audio section found correctly despite a nested sequence\'s own audio appearing first in the doc',
    nestedParsed.audioTracks.length === 1 && nestedParsed.audioTracks[0].clips.map(c => c.name).join() === 'MasterAudioClip');
  ok('bug#5 file descriptor block (<file><media><video>, no <track>) does not create a phantom track',
    nestedParsed.videoTracks[0].clipCount === 1);
  ok('sequence markers extracted with correct timecode', nestedParsed.markers.length === 1 && nestedParsed.markers[0].tcIn === '00:00:00:00');

  const xfadeXml = `<xmeml version="4"><sequence id="master"><name>M</name>
<rate><timebase>30</timebase><ntsc>TRUE</ntsc></rate>
<timecode><rate><timebase>30</timebase><ntsc>TRUE</ntsc></rate><frame>0</frame></timecode>
<media><video><track><clipitem><name>V1</name><start>0</start><end>30</end><in>0</in><out>30</out></clipitem></track></video>
<audio>
<track><clipitem><name>Music.wav</name><start>0</start><end>50</end><in>0</in><out>50</out></clipitem>
<transitionitem><start>45</start><end>55</end></transitionitem>
<clipitem><name>Music.wav</name><start>-1</start><end>-1</end><in>0</in><out>50</out></clipitem></track>
<track><clipitem><name>MusicL.wav</name><start>100</start><end>150</end><in>0</in><out>50</out></clipitem></track>
<track><clipitem><name>MusicL.wav</name><start>100</start><end>150</end><in>0</in><out>50</out></clipitem></track>
<track><clipitem><name>Dialogue.wav</name><start>300</start><end>350</end><in>0</in><out>50</out></clipitem></track>
<track><clipitem><name>SFX.wav</name><start>400</start><end>450</end><in>0</in><out>50</out></clipitem></track>
</audio></media></sequence></xmeml>`;
  fs.writeFileSync(path.join(TMP, 'xfade.xml'), xfadeXml);
  const xfadeParsed = px.parseSequenceXML(path.join(TMP, 'xfade.xml'));
  const xfadeMusic = xfadeParsed.audioTracks[0].clips;
  ok('bug#3 crossfaded (-1/-1) clip recovers position from neighboring transitionitem',
    xfadeMusic.length === 2 && xfadeMusic[1].start === 45 && xfadeMusic[1].end === 95);
  ok('bug#4 identical-clip audio tracks merge into one stereo-flagged logical track',
    xfadeParsed.audioTracks.some(t => /·st/.test(t.label) && t.clips.map(c => c.name).join() === 'MusicL.wav'));
  ok('bug#4 unrelated audio tracks (0% overlap) do NOT merge', xfadeParsed.audioTracks.length === 4);

  // ---- harvestNestedAudio: found unused in the app (dead code, nothing calls it) but had
  // 3 real bugs — master-level clips dropped entirely, crossfade -1 never recovered, and
  // the same "grabs a nested sequence's audio instead of this level's own" bug as #2 above.
  const nested = px.harvestNestedAudio(path.join(TMP, 'nested.xml'));
  ok('harvestNestedAudio surfaces the master\'s OWN direct clip (previously silently dropped)',
    nested.some(c => c.name === 'MasterAudioClip'));
  ok('harvestNestedAudio also reaches into the nested sequence, mapped to master TC',
    nested.some(c => c.name === 'InnerAudioClip'));
  const xfadeNested = px.harvestNestedAudio(path.join(TMP, 'xfade.xml'));
  ok('harvestNestedAudio recovers a crossfaded (-1/-1) clip instead of dropping it',
    xfadeNested.filter(c => c.name === 'Music.wav').length === 2);

  // ---- parseSequenceXML: master AUDIO track clips that wrap a nested sequence
  // now get dug into (unlike video, which stays opaque per bug#1) — a real music
  // track picker needs the actual file name, not a generic "Nested Sequence N".
  const audioNestXml = `<xmeml version="4"><sequence id="master3"><name>M3</name>
<rate><timebase>30</timebase><ntsc>TRUE</ntsc></rate>
<timecode><rate><timebase>30</timebase><ntsc>TRUE</ntsc></rate><frame>0</frame></timecode>
<media>
<video><track><clipitem><name>V1</name><start>0</start><end>150</end><in>0</in><out>150</out></clipitem></track></video>
<audio><track>
<clipitem><name>Nested Sequence 1</name><start>0</start><end>50</end><in>0</in><out>50</out>
<sequence id="audionest1"><name>AN1</name><rate><timebase>30</timebase><ntsc>TRUE</ntsc></rate>
<media><audio><track><clipitem><name>ES_1234_Real Song - Composer.wav</name><start>0</start><end>50</end><in>0</in><out>50</out></clipitem></track></audio></media>
</sequence></clipitem>
<clipitem><name>Nested Sequence 2</name><start>100</start><end>150</end><in>0</in><out>50</out>
<sequence id="audionest2"><name>AN2</name><rate><timebase>30</timebase><ntsc>TRUE</ntsc></rate>
<media><video><track><clipitem><name>InnerVideoOnly</name><start>0</start><end>50</end><in>0</in><out>50</out></clipitem></track></video></media>
</sequence></clipitem>
</track></audio>
</media></sequence></xmeml>`;
  fs.writeFileSync(path.join(TMP, 'audionest.xml'), audioNestXml);
  const audioNestParsed = px.parseSequenceXML(path.join(TMP, 'audionest.xml'));
  const anClips = audioNestParsed.audioTracks[0].clips;
  ok('nested audio: master audio track digs into a nested sequence and surfaces the REAL clip name',
    anClips.some(c => c.name === 'ES_1234_Real Song - Composer.wav' && c.nested === true));
  ok('nested audio: recovered clip is mapped to the correct master timecode/duration',
    anClips.find(c => c.name === 'ES_1234_Real Song - Composer.wav').tcIn === '00:00:00:00' &&
    anClips.find(c => c.name === 'ES_1234_Real Song - Composer.wav').durFrames === 50);
  ok('nested audio: a nest with no real audio inside falls back to the opaque nest name instead of vanishing',
    anClips.some(c => c.name === 'Nested Sequence 2' && c.start === 100));
  ok('nested audio: video tracks still do NOT expand nested sequences (bug#1 stays fixed)',
    nestedParsed.videoTracks[0].clips.every(c => !c.nested));

  console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed\n`);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('\nverify.js crashed:', e.message); process.exit(1); });
