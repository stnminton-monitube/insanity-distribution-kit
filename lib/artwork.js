const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { ffprobePath } = require('./ffbin');
const { getProfile } = require('./distribution');

function probeImage(file) {
  return new Promise((resolve, reject) => execFile(ffprobePath,
    ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', file],
    { maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => err ? reject(err) : resolve(JSON.parse(stdout))));
}

async function checkArtwork(file, profileId, slotId) {
  if (!fs.existsSync(file)) throw new Error('Artwork file not found.');
  const profile = getProfile(profileId);
  const slot = profile.art.find(x => x.id === slotId);
  if (!slot) throw new Error('Unknown artwork slot for this platform.');
  const ext = path.extname(file).slice(1).toLowerCase();
  if (slot.layered) {
    const ok = ['psd', 'psb', 'tif', 'tiff'].includes(ext);
    return [{ level: ok ? 'pass' : 'fail', check: 'Layered source', detail: ok ? `.${ext} working file retained` : `.${ext} is not a layered-source format.`, fix: ok ? '' : 'Use PSD, PSB, or layered TIFF.' }];
  }
  if (!['jpg', 'jpeg', 'png'].includes(ext)) return [{ level: 'fail', check: 'Artwork format', detail: `.${ext} - use JPG or PNG.` }];
  const data = await probeImage(file);
  const stream = (data.streams || [])[0];
  if (!stream) return [{ level: 'fail', check: 'Artwork readable', detail: 'No readable image stream found.' }];
  const results = [{ level: 'pass', check: 'Artwork format', detail: `.${ext}` }];
  if (slot.width && slot.height) {
    const enough = slot.exact
      ? stream.width === slot.width && stream.height === slot.height
      : stream.width >= slot.width && stream.height >= slot.height;
    const targetRatio = slot.width / slot.height;
    const ratioOk = Math.abs(stream.width / stream.height - targetRatio) < 0.01;
    const rule = slot.exact ? `exactly ${slot.width}x${slot.height}` : `at least ${slot.width}x${slot.height} at the same aspect ratio`;
    results.push({ level: enough && ratioOk ? 'pass' : 'fail', check: 'Dimensions', detail: `${stream.width}x${stream.height}; ${slot.name} requires ${rule}.`, fix: enough && ratioOk ? '' : (slot.exact ? 'Export the exact required dimensions.' : 'Export the exact aspect ratio at or above the minimum dimensions.') });
  } else results.push({ level: 'info', check: 'Dimensions', detail: 'Confirm the dimensions against the signed contract.' });
  results.push({ level: 'info', check: 'MANUAL - visual review', detail: 'Check sharpness, title/text rules, safe margins, and that the image is the correct creative for this slot.' });
  return results;
}

module.exports = { checkArtwork };
