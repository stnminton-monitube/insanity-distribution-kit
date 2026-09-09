// Caption parsers: SCC (CEA-608) and SRT → timecoded dialogue events.
const fs = require('fs');

// CEA-608 basic + special character map (after parity strip)
const CHAR = {};
for (let b = 0x20; b <= 0x7f; b++) CHAR[b] = String.fromCharCode(b);
Object.assign(CHAR, {
  0x2a: 'á', 0x5c: 'é', 0x5e: 'í', 0x5f: 'ó', 0x60: 'ú',
  0x7b: 'ç', 0x7c: '÷', 0x7d: 'Ñ', 0x7e: 'ñ', 0x7f: '',
});
const SPECIAL = ['®', '°', '½', '¿', '™', '¢', '£', '♪', 'à', ' ', 'è', 'â', 'ê', 'î', 'ô', 'û'];

function parseSCC(filePath) {
  const txt = fs.readFileSync(filePath, 'utf8');
  if (!/Scenarist_SCC/i.test(txt)) throw new Error('Not an SCC file (missing Scenarist_SCC header).');
  const events = [];
  const lines = txt.split(/\r?\n/);
  let buf = '', bufTC = null, lastControl = 0;

  const flush = () => {
    const text = buf.replace(/\s+/g, ' ').trim();
    if (text && bufTC) events.push({ tc: bufTC, text });
    buf = '';
  };

  for (const line of lines) {
    const m = line.match(/^(\d{2}:\d{2}:\d{2}[:;]\d{2})\t(.+)$/);
    if (!m) continue;
    const tc = m[1].replace(';', ':');
    const words = m[2].trim().split(/\s+/);
    for (const w of words) {
      if (!/^[0-9a-fA-F]{4}$/.test(w)) continue;
      let b1 = parseInt(w.slice(0, 2), 16) & 0x7f;
      let b2 = parseInt(w.slice(2), 16) & 0x7f;
      if (b1 >= 0x10 && b1 <= 0x1f) {
        // control code pair
        const code = (b1 << 8) | b2;
        if (code === lastControl) { lastControl = 0; continue; } // doubled control
        lastControl = code;
        // special chars (0x11 0x30-0x3F)
        if ((b1 === 0x11 || b1 === 0x19) && b2 >= 0x30 && b2 <= 0x3f) {
          buf += SPECIAL[b2 - 0x30] || '';
          continue;
        }
        // EOC (End of Caption — display it) / EDM / carriage returns
        if (b2 === 0x2f || b2 === 0x2d) { // EOC or CR
          if (buf.trim()) { if (!bufTC) bufTC = tc; flush(); bufTC = null; }
        }
        if (!bufTC && (b2 === 0x20 || b2 === 0x29 || b2 === 0x25 || b2 === 0x26 || b2 === 0x27)) {
          bufTC = tc; // RCL / RDC / roll-up starts — anchor timecode
        }
        if (b1 >= 0x10 && b2 >= 0x40) { buf += '\n'; } // PAC row change → new line
        continue;
      }
      lastControl = 0;
      if (b1 >= 0x20) { buf += CHAR[b1] || ''; if (!bufTC) bufTC = tc; }
      if (b2 >= 0x20) buf += CHAR[b2] || '';
    }
  }
  flush();
  // merge immediate duplicates
  return events.filter((e, i) => !(i && events[i - 1].text === e.text));
}

function parseSRT(filePath) {
  const txt = fs.readFileSync(filePath, 'utf8').replace(/^﻿/, '');
  const blocks = txt.split(/\r?\n\r?\n+/);
  const events = [];
  for (const b of blocks) {
    const lines = b.trim().split(/\r?\n/);
    if (lines.length < 2) continue;
    const timeIdx = lines.findIndex(l => /-->/.test(l));
    if (timeIdx < 0) continue;
    const tm = lines[timeIdx].match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
    if (!tm) continue;
    // ms → frame at the 29.97fps house standard (1000*1001/30000 ms/frame). SRT carries no
    // frame-rate metadata of its own, so this can't be auto-detected from the file; a fixed
    // /40 divisor here would silently assume 25fps (PAL) — a rate this app never uses.
    const frame = Math.round(parseInt(tm[4], 10) * 30 / 1001);
    const tc = `${tm[1]}:${tm[2]}:${tm[3]}:${String(frame).padStart(2, '0')}`;
    const text = lines.slice(timeIdx + 1).join(' ').replace(/<[^>]+>/g, '').trim();
    if (text) events.push({ tc, text });
  }
  return events;
}

function parseCaptions(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.scc')) return parseSCC(filePath);
  if (lower.endsWith('.srt') || lower.endsWith('.vtt')) return parseSRT(filePath);
  throw new Error('Use an .scc or .srt caption file.');
}

// Shift every timecode in an SCC/SRT/VTT file by +1 hour (program time →
// master time, where program starts at 01:00:00:00). Writes a sibling file.
function retimeCaptionFile(srcPath) {
  const txt = fs.readFileSync(srcPath, 'utf8');
  let out;
  if (/\.scc$/i.test(srcPath)) {
    out = txt.replace(/^(\d{2})(:\d{2}:\d{2}[:;]\d{2}\t)/gm,
      (_, hh, rest) => String((parseInt(hh, 10) + 1) % 24).padStart(2, '0') + rest);
  } else {
    // SRT / VTT: shift both sides of "-->" ranges
    out = txt.replace(/(\d{2})(:\d{2}:\d{2}[,.]\d{3})/g,
      (_, hh, rest) => String((parseInt(hh, 10) + 1) % 24).padStart(2, '0') + rest);
  }
  const ext = srcPath.match(/\.[^.]+$/)[0];
  const dest = srcPath.slice(0, -ext.length) + ' MASTER-TC' + ext;
  fs.writeFileSync(dest, out);
  return dest;
}

module.exports = { parseCaptions, retimeCaptionFile };
