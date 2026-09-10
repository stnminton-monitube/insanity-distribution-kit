const path = require('path');
const { execFile } = require('child_process');
const { ffprobePath } = require('./ffbin');
const { getProfile } = require('./distribution');

const item = (level, check, detail, fix = '') => ({ level, check, detail, fix });
function probe(file) {
  return new Promise((resolve, reject) => execFile(ffprobePath,
    ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file],
    { maxBuffer: 32 * 1024 * 1024 }, (err, stdout) => err ? reject(err) : resolve(JSON.parse(stdout))));
}
function rateLabel(rate) {
  const [n, d] = String(rate || '0/1').split('/').map(Number);
  return d ? (n / d).toFixed(3).replace(/\.000$/, '') : String(rate || 'unknown');
}

async function runStreamingQC(file, profileId = 'general') {
  const profile = getProfile(profileId);
  let info;
  try { info = await probe(file); } catch (e) { return [item('fail', 'File readable', 'ffprobe could not read this file: ' + e.message)]; }
  const fmt = info.format || {}, streams = info.streams || [];
  const video = streams.find(s => s.codec_type === 'video');
  const audio = streams.filter(s => s.codec_type === 'audio');
  const data = streams.filter(s => s.codec_type === 'data');
  if (!video) return [item('fail', 'Video stream', 'No video stream found.')];
  const out = [];
  const ext = path.extname(file).slice(1).toLowerCase();
  out.push(profile.acceptedVideo.includes(ext) ? item('pass', 'Container', `.${ext} accepted by ${profile.name}`) : item('fail', 'Container', `.${ext} is not accepted by ${profile.name}.`, `Use ${profile.acceptedVideo.map(x => '.' + x).join(', ')}.`));
  out.push(!profile.codecs.length || profile.codecs.includes(video.codec_name) ? item('pass', 'Video codec', video.codec_name) : item('fail', 'Video codec', `${video.codec_name} is not in the ${profile.name} preset.`, profile.video));
  const even = video.width % 2 === 0 && video.height % 2 === 0;
  const enough = profile.exactResolution
    ? video.width === profile.minWidth && video.height === profile.minHeight
    : (!profile.minWidth || video.width >= profile.minWidth) && (!profile.minHeight || video.height >= profile.minHeight);
  const resolutionFix = profile.exactResolution
    ? `Use exactly ${profile.minWidth}x${profile.minHeight}.`
    : profile.minWidth && profile.minHeight
      ? `Use at least ${profile.minWidth}x${profile.minHeight}.`
      : 'Use the native source resolution with even pixel dimensions.';
  out.push(even && enough ? item('pass', 'Resolution', `${video.width}x${video.height}`) : item('fail', 'Resolution', `${video.width}x${video.height} does not meet the platform resolution/even-dimension rule.`, resolutionFix));
  const sar = video.sample_aspect_ratio;
  out.push(!sar || sar === '1:1' || sar === '0:1' ? item('pass', 'Pixel aspect ratio', 'Square pixels') : item('fail', 'Pixel aspect ratio', `${sar} - square pixels required.`));
  out.push(!video.field_order || ['progressive', 'unknown'].includes(video.field_order) ? item(video.field_order === 'progressive' ? 'pass' : 'warn', 'Scan type', video.field_order || 'Not tagged - confirm progressive') : item('fail', 'Scan type', `${video.field_order} - interlaced video is not accepted.`));
  if (profile.frameRates) out.push(profile.frameRates.includes(video.r_frame_rate) ? item('pass', 'Frame rate', `${rateLabel(video.r_frame_rate)} fps native supported rate`) : item('fail', 'Frame rate', `${rateLabel(video.r_frame_rate)} fps is not supported by ${profile.name}.`, 'Export at the original/native supported frame rate; do not convert it.'));
  else out.push(item('info', 'Frame rate', `${rateLabel(video.r_frame_rate)} fps - confirm this matches the native sequence and target platform.`));
  const bits = Number(video.bit_rate || fmt.bit_rate || 0);
  if (profile.minMbpsHD && ['h264', 'hevc'].includes(video.codec_name)) {
    const mbps = bits / 1000000;
    out.push(mbps >= profile.minMbpsHD ? item('pass', 'Video bitrate', `${mbps.toFixed(1)} Mbps`) : item(bits ? 'fail' : 'warn', 'Video bitrate', bits ? `${mbps.toFixed(1)} Mbps - minimum is ${profile.minMbpsHD} Mbps for HD.` : `Not reported - ${profile.name} requires at least ${profile.minMbpsHD} Mbps for HD.`));
  } else out.push(item('info', 'Video bitrate', bits ? `${(bits / 1000000).toFixed(1)} Mbps` : 'Not reported by file'));
  const hasTc = data.some(s => s.codec_tag_string === 'tmcd' || s.tags?.timecode) || !!video.tags?.timecode || !!fmt.tags?.timecode;
  if (profile.forbidTimecode) out.push(hasTc ? item('fail', 'Timecode stream', 'Present, but this profile requires it removed.') : item('pass', 'Timecode stream', 'None'));
  if (!audio.length) out.push(item('fail', 'Audio', 'No audio stream found.'));
  else {
    const ratesOk = audio.every(a => Number(a.sample_rate) >= 48000);
    out.push(ratesOk ? item('pass', 'Audio sample rate', '48 kHz or higher') : item('fail', 'Audio sample rate', 'One or more streams are below 48 kHz.'));
    const codecsOk = !profile.audioCodecs?.length || audio.every(a => profile.audioCodecs.some(c => String(a.codec_name || '').startsWith(c)));
    out.push(codecsOk ? item('pass', 'Audio codec', audio.map(a => a.codec_name).join(', ')) : item('fail', 'Audio codec', `${audio.map(a => a.codec_name).join(', ')} does not match the ${profile.name} preset.`));
    const stereo = audio.some(a => a.channels === 2);
    out.push(stereo ? item('pass', 'Stereo mix', 'Discrete stereo stream present') : item(profile.requireStereo ? 'fail' : 'warn', 'Stereo mix', 'No discrete stereo stream found.', 'Include a center-balanced stereo mix.'));
    const lowCompressed = audio.filter(a => ['aac', 'mp3', 'ac3'].includes(a.codec_name) && Number(a.bit_rate || 0) && Number(a.bit_rate) < (a.codec_name === 'ac3' ? 192000 : 128000));
    out.push(lowCompressed.length ? item('fail', 'Audio bitrate', `${lowCompressed.length} compressed stream(s) below the platform minimum.`) : item('pass', 'Audio codec / bitrate', audio.map(a => `${a.codec_name} ${a.channels || '?'}ch`).join(', ')));
  }
  const dur = Number(fmt.duration || 0);
  out.push(item('info', 'Program runtime', `${dur.toFixed(2)} seconds - metadata runtime should be whole minutes.`));
  [
    ['MANUAL - clean start/end', 'Starts and ends on black with no more than 2 seconds of black; no bars, slate, tone, leader, cards, or textless tail.'],
    ['MANUAL - picture', 'Watch end to end for corrupt/duplicate/blended frames, padding, burned-in captions, watermarks, cropping, and output errors.'],
    ['MANUAL - content', profileId === 'filmhub' ? 'No URLs, promos, release dates, social links, platform mentions, or other promotional references.' : 'Review sponsor reads, calls to action, URLs, and promos against the selected destination.'],
    ['MANUAL - audio', 'Listen end to end for clipping, phasing, distortion, dropouts, ticks, pops, and off-center dialogue.'],
  ].forEach(([check, detail]) => out.push(item('info', check, detail)));
  return out;
}

module.exports = { runStreamingQC };
