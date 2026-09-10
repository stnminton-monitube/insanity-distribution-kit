// Shared output-path helpers. Generated deliverables must never overwrite an
// existing file or directory: cloud-sync clients may still be uploading it,
// and a partial rerun must remain recoverable.
const fs = require('fs');
const path = require('path');

function versionedPath(target) {
  if (typeof target !== 'string' || !target.trim()) throw new Error('An output path is required.');
  if (!fs.existsSync(target)) return target;
  const ext = path.extname(target);
  const stem = ext ? target.slice(0, -ext.length) : target;
  let n = 2;
  let candidate;
  do {
    candidate = `${stem} v${n}${ext}`;
    n++;
  } while (fs.existsSync(candidate));
  return candidate;
}

module.exports = { versionedPath };
