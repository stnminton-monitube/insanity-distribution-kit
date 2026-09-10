// QC validation against FEG Acquisition AMA spec (2026 v1.0, section 1.2.3 / 1.3.6)
const { execFile } = require('child_process');
const path = require('path');
const { ffprobePath } = require('./ffbin');

// DELIVERABLES.md is the spec of record: Full HD at the 29.97 house standard.
const HOUSE_FPS = '30000/1001';

function isProRes422HQ(stream) {
  if (!stream || stream.codec_name !== 'prores') return false;
  const profile = String(stream.profile || '');
  return /(^HQ$|422 HQ)/i.test(profile) || String(stream.codec_tag_string || '').toLowerCase() === 'apch';
}

function probe(file) {
  return new Promise((resolve, reject) => {
    execFile(
      ffprobePath,
      ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file],
      { maxBuffer: 32 * 1024 * 1024 },
      (err, stdout) => (err ? reject(err) : resolve(JSON.parse(stdout)))
    );
  });
}

// result item: { level: 'pass'|'warn'|'fail'|'info', check, detail, fix }
function item(level, check, detail, fix) {
  return { level, check, detail, fix: fix || '' };
}

async function runQC(file) {
  const results = [];
  let info;
  try {
    info = await probe(file);
  } catch (e) {
    return [item('fail', 'File readable', 'ffprobe could not read this file: ' + e.message,
      'Confirm the file finished copying/exporting and is a valid QuickTime MOV.')];
  }

  const fmt = info.format || {};
  const streams = info.streams || [];
  const v = streams.find(s => s.codec_type === 'video');
  const audio = streams.filter(s => s.codec_type === 'audio');
  const dataStreams = streams.filter(s => s.codec_type === 'data');

  // ---- Container ----
  // ffprobe's format_name is "mov,mp4,m4a,3gp,3g2,mj2" for the ENTIRE QuickTime/ISO-BMFF
  // family — identical for a real .mov and an .mp4, so it can never actually distinguish
  // them. Use the file extension (what the spec/distributor portal actually checks) plus
  // the container's major_brand tag ("qt  " for real QuickTime exports, "isom"/"mp42" for
  // MP4) to also catch an MP4 that's just been renamed to .mov without re-exporting.
  const ext = path.extname(file).toLowerCase();
  const majorBrand = ((fmt.tags && fmt.tags.major_brand) || '').trim();
  if (ext !== '.mov') {
    results.push(item('fail', 'Wrapper', `File is "${ext || '(no extension)'}" — spec requires QuickTime MOV (.mov), not MP4.`,
      'Export from Premiere as QuickTime (.mov), not MP4.'));
  } else if (majorBrand && majorBrand !== 'qt') {
    results.push(item('fail', 'Wrapper', `File is named .mov but its container is tagged "${majorBrand}", not QuickTime — this looks like an MP4 renamed to .mov, not a real export.`,
      'Re-export from Premiere as QuickTime (.mov) rather than renaming another format.'));
  } else {
    results.push(item('pass', 'Wrapper', 'QuickTime MOV'));
  }

  if (!v) {
    results.push(item('fail', 'Video stream', 'No video stream found.'));
    return results;
  }

  // ---- Resolution ----
  const res = `${v.width}x${v.height}`;
  const isHD = v.width === 1920 && v.height === 1080;
  if (isHD) {
    results.push(item('pass', 'Resolution', `${res} (Full HD)`));
  } else {
    results.push(item('fail', 'Resolution', `${res} — the house delivery spec requires 1920x1080.`,
      'Set your Premiere sequence/export to 1920x1080.'));
  }

  // ---- Codec & profile ----
  if (v.codec_name === 'prores') {
    const prof = (v.profile || '').toUpperCase();
    if (isProRes422HQ(v)) results.push(item('pass', 'Codec', 'Apple ProRes 422 HQ'));
    else results.push(item('fail', 'Codec profile', `ProRes profile is "${v.profile}" — the house spec requires ProRes 422 HQ.`,
      'In Premiere export settings choose Apple ProRes 422 HQ.'));
  } else {
    results.push(item('fail', 'Codec', `Video codec is "${v.codec_name}" — spec requires Apple ProRes.`,
      'Re-export from Premiere: Format = QuickTime, Codec = Apple ProRes 422 HQ.'));
  }

  // ---- Bit depth / chroma ----
  const pix = v.pix_fmt || '';
  if (isHD) {
    if (pix === 'yuv422p10le') results.push(item('pass', 'Color sampling / bit depth', '4:2:2, 10-bit'));
    else results.push(item('warn', 'Color sampling / bit depth', `Pixel format is ${pix} — HD spec is 4:2:2 10-bit.`,
      'ProRes 422 HQ export normally produces this automatically.'));
  }

  // ---- Aspect ratios ----
  const dar = v.display_aspect_ratio;
  const sar = v.sample_aspect_ratio;
  if (!dar || dar === '16:9') results.push(item(dar ? 'pass' : 'warn', 'Display aspect ratio', dar || 'Not tagged (assumed from resolution)'));
  else results.push(item('fail', 'Display aspect ratio', `${dar} — spec requires 16:9.`));
  if (!sar || sar === '1:1' || sar === '0:1') results.push(item('pass', 'Pixel aspect ratio', '1:1 (square pixels)'));
  else results.push(item('fail', 'Pixel aspect ratio', `${sar} — spec requires 1:1 square pixels.`,
    'In Premiere, set Pixel Aspect Ratio to Square Pixels (1.0).'));

  // ---- Frame rate ----
  if (v.r_frame_rate === HOUSE_FPS) {
    results.push(item('pass', 'Frame rate', '29.97 fps (house standard)'));
  } else results.push(item('fail', 'Frame rate', `${v.r_frame_rate} — the house delivery spec requires 29.97 fps.`,
    'Set the sequence and export frame rate to 29.97.'));

  // ---- Scan type ----
  if (!v.field_order || v.field_order === 'progressive' || v.field_order === 'unknown') {
    results.push(item(v.field_order === 'progressive' ? 'pass' : 'warn', 'Scan type',
      v.field_order === 'progressive' ? 'Progressive' : 'Not explicitly tagged — ProRes exports from Premiere are progressive unless you enabled fields.',
      v.field_order === 'progressive' ? '' : 'Confirm "Progressive" in export settings.'));
  } else {
    results.push(item('fail', 'Scan type', `Interlaced (${v.field_order}) — spec requires progressive.`,
      'Set Field Order to Progressive in export settings.'));
  }

  // ---- Timecode track ----
  const hasTmcd = dataStreams.some(s => s.codec_tag_string === 'tmcd' || (s.tags && s.tags.timecode));
  const tcTag = (v.tags && v.tags.timecode) || (fmt.tags && fmt.tags.timecode) ||
    dataStreams.map(s => s.tags && s.tags.timecode).find(Boolean);
  if (hasTmcd || tcTag) {
    results.push(item('pass', 'Timecode track', `Present${tcTag ? ' — starts at ' + tcTag : ''}`));
  } else {
    results.push(item('fail', 'Timecode track', 'No timecode track found — spec requires one.',
      'Enable "Include Timecode" / export via QuickTime with a timecode track, or use the Build tab to assemble a master (it adds one).'));
  }

  // ---- Color space ----
  const cs = v.color_space || v.colorspace;
  if (cs === 'bt709') results.push(item('pass', 'Color space', 'Rec. 709'));
  else results.push(item('warn', 'Color space', `Tagged as "${cs || 'untagged'}" — SDR spec is Rec. 709 Legal Range. (HDR deliveries follow the BT.2100 spec instead.)`,
    'If this is SDR, tag/export as Rec. 709.'));

  // ---- Audio ----
  if (audio.length === 16) {
    results.push(item('pass', 'Audio track count', '16 tracks'));
  } else {
    results.push(item('fail', 'Audio track count', `${audio.length} audio track(s) — spec requires exactly 16 mono tracks in the standard order.`,
      'Export 16 mono tracks (5.1 printmaster ×6, LtRt ×2, FX ×2, Mus ×2, M&E ×2, Narration, Mono mix).'));
  }
  const badCodec = audio.filter(a => !(a.codec_name || '').startsWith('pcm_s24'));
  const badRate = audio.filter(a => a.sample_rate !== '48000');
  const badMono = audio.filter(a => a.channels !== 1);
  if (audio.length) {
    if (!badCodec.length) results.push(item('pass', 'Audio format', 'PCM 24-bit (uncompressed)'));
    else results.push(item('fail', 'Audio format', `${badCodec.length} track(s) are not 24-bit PCM (found: ${[...new Set(badCodec.map(a => a.codec_name))].join(', ')}).`,
      'Export audio as uncompressed PCM, 24-bit.'));
    if (!badRate.length) results.push(item('pass', 'Audio sample rate', '48 kHz'));
    else results.push(item('fail', 'Audio sample rate', `${badRate.length} track(s) not at 48 kHz.`, 'Set audio sample rate to 48000 Hz.'));
    if (!badMono.length) results.push(item('pass', 'Audio channels per track', 'All mono (1 channel per track)'));
    else results.push(item('fail', 'Audio channels per track', `${badMono.length} track(s) have more than 1 channel — each of the 16 tracks must be mono.`,
      'Split stereo/5.1 tracks into individual mono tracks.'));
  }

  // ---- Duration + runtime format ----
  const durSec = Number(fmt.duration || 0);
  results.push(item('info', 'Duration', `${durSec.toFixed(2)} s (${fmt.size ? (fmt.size / 1e9).toFixed(2) + ' GB' : 'size unknown'})`));
  try {
    const { classifyRuntime } = require('./checklist');
    // if this file already carries the 2m02s head/tail, measure the program only
    const hasHead = (tcTag || '').startsWith('00:58:');
    const programSec = hasHead ? Math.max(0, durSec - 122) : durSec;
    const r = classifyRuntime(programSec);
    results.push(item(r.inRange ? 'pass' : 'warn', 'Runtime format', r.message,
      r.inRange ? '' : 'Runtime windows vary by distributor — confirm before locking.'));
  } catch (e) { /* classification is advisory only */ }

  // ---- Manual checks the app can't verify ----
  [
    ['Head/tail layout', 'Black 30s → bars+tone 30s → slate 30s → black 30s → program at TC 01:00:00:00; tail per spec. The Build broadcast master button assembles this automatically.'],
    ['Title safe', 'All text & crucial visuals inside 80% title safe.'],
    ['Content rules', 'No ads, no burned-in captions, no QT edit lists, no visible breakup/dirty edges. Censored version by default.'],
    ['Textless', 'Textless scenes at tail (or standalone file), delivered same day as texted.'],
    ['Naming', 'Apply your distributor’s naming conventions before delivering.'],
  ].forEach(([check, detail]) => results.push(item('info', 'Manual check: ' + check, detail)));

  return results;
}

async function runProfileQC(file, profileId) {
  if (!profileId || profileId === 'broadcast_archive') return runQC(file);
  return require('./streamqc').runStreamingQC(file, profileId);
}

async function runBroadcastSourceQC(file) {
  const results = await runQC(file);
  return results.map(result => result.check === 'Timecode track' && result.level === 'fail'
    ? item('info', 'Timecode track', 'The source has no timecode track; the broadcast builder will add one to the finished master.')
    : result);
}

module.exports = { runQC, runProfileQC, runBroadcastSourceQC, probe };
