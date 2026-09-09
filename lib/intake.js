// File intake: light checks + filing into the episode's Distribution folder.
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { ffprobePath } = require('./ffbin');

function probe(file) {
  return new Promise((resolve, reject) => {
    execFile(ffprobePath, ['-v', 'error', '-show_streams', '-of', 'json', file],
      { maxBuffer: 32 * 1024 * 1024 },
      (err, stdout) => (err ? reject(err) : resolve(JSON.parse(stdout))));
  });
}

// WAV stem check: mono, PCM 24-bit, 48 kHz
async function checkWav(file) {
  const results = [];
  try {
    const info = await probe(file);
    const a = (info.streams || []).find(s => s.codec_type === 'audio');
    if (!a) return [{ level: 'fail', check: 'Audio stream', detail: 'No audio stream found.' }];
    results.push(a.channels === 1
      ? { level: 'pass', check: 'Channels', detail: 'Mono' }
      : { level: 'fail', check: 'Channels', detail: `${a.channels} channels — stems must be individual mono files.`, fix: 'Export each channel as its own mono WAV.' });
    results.push((a.codec_name || '').startsWith('pcm_s24')
      ? { level: 'pass', check: 'Format', detail: 'PCM 24-bit' }
      : { level: 'fail', check: 'Format', detail: `${a.codec_name} — must be 24-bit PCM.`, fix: 'Export as WAV, 24-bit.' });
    results.push(a.sample_rate === '48000'
      ? { level: 'pass', check: 'Sample rate', detail: '48 kHz' }
      : { level: 'fail', check: 'Sample rate', detail: `${a.sample_rate} Hz — must be 48000 Hz.`, fix: 'Set sample rate to 48 kHz.' });
  } catch (e) {
    results.push({ level: 'fail', check: 'File readable', detail: e.message });
  }
  return results;
}

// Segment timings check: parse timecode rows
function checkTimings(file) {
  const results = [];
  try {
    const txt = fs.readFileSync(file, 'utf8');
    const tc = /\d{2}:\d{2}:\d{2}[:;]\d{2}/g;
    const rows = txt.split(/\r?\n/).filter(l => (l.match(tc) || []).length >= 2);
    if (rows.length === 0) {
      results.push({ level: 'fail', check: 'Timecode rows', detail: 'No rows with in/out timecodes (HH:MM:SS:FF) found.', fix: 'Use the template: Marker Name, Description, In, Out, Duration, Marker Type.' });
    } else {
      results.push({ level: 'pass', check: 'Timecode rows', detail: `${rows.length} segment row(s) with in/out timecodes found.` });
      results.push({ level: 'info', check: 'Manual check', detail: 'Confirm the rows are frame-accurate against the master and cover every segment.' });
    }
  } catch (e) {
    results.push({ level: 'fail', check: 'File readable', detail: e.message });
  }
  return results;
}

// Extension-only check
function checkExt(file, accepted) {
  const ext = path.extname(file).slice(1).toLowerCase();
  return accepted.includes(ext)
    ? [{ level: 'pass', check: 'File type', detail: '.' + ext }]
    : [{ level: 'fail', check: 'File type', detail: `.${ext} — expected: ${accepted.map(e => '.' + e).join(', ')}` }];
}

// Copy a file into <episodeFolder>/<distFolderName>/<sub>/
function fileIt(src, episodeFolder, distFolderName, sub) {
  if (!fs.existsSync(episodeFolder)) throw new Error('Episode folder not found: ' + episodeFolder);
  const destDir = path.join(episodeFolder, distFolderName, sub);
  fs.mkdirSync(destDir, { recursive: true });
  let dest = path.join(destDir, path.basename(src));
  if (fs.existsSync(dest)) {
    // don't overwrite — version it
    const ext = path.extname(dest), base = dest.slice(0, -ext.length);
    let n = 2;
    while (fs.existsSync(`${base} v${n}${ext}`)) n++;
    dest = `${base} v${n}${ext}`;
  }
  fs.copyFileSync(src, dest);
  return dest;
}

module.exports = { checkWav, checkTimings, checkExt, fileIt };
