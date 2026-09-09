// Resolves bundled ffmpeg/ffprobe binary paths (works in dev and packaged app)
const path = require('path');

function fix(p) {
  // In a packaged app, binaries live in app.asar.unpacked
  return p ? p.replace('app.asar', 'app.asar.unpacked') : p;
}

let ffmpegPath, ffprobePath;
try {
  ffmpegPath = fix(require('ffmpeg-static'));
} catch (e) {
  ffmpegPath = 'ffmpeg'; // fall back to system install
}
try {
  ffprobePath = fix(require('ffprobe-static').path);
} catch (e) {
  ffprobePath = 'ffprobe';
}

module.exports = { ffmpegPath, ffprobePath };
