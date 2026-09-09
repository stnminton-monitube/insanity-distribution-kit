// Textless verification — samples frames from a video and OCRs them to flag
// any remaining on-screen text. Uses bundled ffmpeg + tesseract.js (pure JS/WASM).
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ffmpegPath, ffprobePath } = require('./ffbin');

function ff(args) {
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, ['-y', '-v', 'error', ...args], { maxBuffer: 32 * 1024 * 1024 },
      (err, _o, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve()));
  });
}

function duration(file) {
  return new Promise((resolve, reject) => {
    execFile(ffprobePath, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
      (err, stdout) => (err ? reject(err) : resolve(parseFloat(stdout) || 0)));
  });
}

function secsToTC(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return [h, m, sec].map(n => String(n).padStart(2, '0')).join(':');
}

/**
 * verifyTextless({ file, intervalSec, ignoreTopPct, ignoreBottomPct, onProgress })
 * → { checkedFrames, hits: [{ time, tc, text, confidence }] }
 */
async function verifyTextless(opts) {
  const { file, intervalSec = 5, ignoreTopPct = 0, ignoreBottomPct = 0, onProgress = () => {} } = opts;
  let Tesseract;
  try {
    Tesseract = require('tesseract.js');
  } catch (e) {
    throw new Error('OCR engine not installed yet — run the launcher again (it installs tesseract.js automatically), or run "npm install tesseract.js" in the app folder.');
  }

  const dur = await duration(file);
  if (!dur) throw new Error('Could not read video duration.');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-'));
  const hits = [];
  let checked = 0;

  onProgress('Starting OCR engine (first run downloads the language model — needs internet once)…');
  const cachePath = path.join(os.homedir(), '.mdt-ocr-cache');
  try { fs.mkdirSync(cachePath, { recursive: true }); } catch (e) { /* ignore */ }
  let worker;
  try {
    worker = await Tesseract.createWorker('eng', 1, {
      cachePath,
      errorHandler: () => { /* keep worker errors from crashing the app */ },
    });
  } catch (e) {
    throw new Error('Could not start the OCR engine: ' + (e && e.message ? e.message : e) +
      ' — if this is the first run, check your internet connection (the language model downloads once, then works offline).');
  }
  try {
    // crop filter to ignore OSD strips
    const top = Math.max(0, Math.min(40, ignoreTopPct)) / 100;
    const bottom = Math.max(0, Math.min(40, ignoreBottomPct)) / 100;
    const cropFilter = (top || bottom)
      ? `,crop=iw:ih*${(1 - top - bottom).toFixed(3)}:0:ih*${top.toFixed(3)}`
      : '';
    const total = Math.floor(dur / intervalSec);
    for (let t = 0; t < dur; t += intervalSec) {
      const frame = path.join(tmp, 'f.png');
      await ff(['-ss', String(t), '-i', file, '-frames:v', '1',
        '-vf', 'scale=960:-2' + cropFilter, frame]);
      const { data } = await worker.recognize(frame);
      checked++;
      const text = (data.text || '').replace(/\s+/g, ' ').trim();
      // keep only confident, non-trivial detections
      if (text.length >= 3 && data.confidence >= 40) {
        hits.push({ time: t, tc: secsToTC(t), text: text.slice(0, 120), confidence: Math.round(data.confidence) });
      }
      if (checked % 5 === 0 || checked === total) onProgress(`Scanned ${checked}/${total} frames — ${hits.length} text detection(s) so far`);
    }
  } finally {
    try { await worker.terminate(); } catch (e) { /* ignore */ }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  }
  // merge consecutive hits with same-ish text
  const merged = [];
  for (const h of hits) {
    const last = merged[merged.length - 1];
    if (last && h.time - last.endTime <= intervalSec + 1 && similar(last.text, h.text)) last.endTime = h.time;
    else merged.push({ ...h, endTime: h.time });
  }
  return { checkedFrames: checked, hits: merged.map(h => ({ tc: h.tc, tcEnd: secsToTC(h.endTime), text: h.text, confidence: h.confidence })) };
}

function similar(a, b) {
  const n = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const x = n(a), y = n(b);
  if (!x || !y) return false;
  return x.includes(y.slice(0, 12)) || y.includes(x.slice(0, 12));
}

module.exports = { verifyTextless };
