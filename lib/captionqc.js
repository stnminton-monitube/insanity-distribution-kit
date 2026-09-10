const fs = require('fs');
const path = require('path');
const { getProfile } = require('./distribution');

const item = (level, check, detail, fix = '') => ({ level, check, detail, fix });
function ms(parts) { return ((+parts[1] * 3600 + +parts[2] * 60 + +parts[3]) * 1000) + +parts[4]; }
function parseTime(line) {
  const m = line.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
  return m ? { start: ms([null, m[1], m[2], m[3], m[4]]), end: ms([null, m[5], m[6], m[7], m[8]]) } : null;
}

function parseTextCaptions(txt) {
  const clean = txt.replace(/^\uFEFF/, '').replace(/^WEBVTT[^\n]*\n+/i, '');
  return clean.split(/\r?\n\s*\r?\n/).map((block, index) => {
    const lines = block.trim().split(/\r?\n/);
    const ti = lines.findIndex(l => l.includes('-->'));
    if (ti < 0) return null;
    return { index: index + 1, id: ti ? lines[ti - 1].trim() : '', time: parseTime(lines[ti]), lines: lines.slice(ti + 1).filter(l => l.trim()) };
  }).filter(Boolean);
}

function checkCaptions(file, profileId = 'general') {
  const profile = getProfile(profileId);
  const ext = path.extname(file).slice(1).toLowerCase();
  const results = [];
  if (!profile.captions.includes(ext)) return [item('fail', 'Platform format', `.${ext} is not accepted by ${profile.name}.`, `Use ${profile.captions.map(x => '.' + x).join(' or ')}.`)];
  results.push(item('pass', 'Platform format', `.${ext} accepted by ${profile.name}`));
  if (ext === 'scc') {
    const txt = fs.readFileSync(file, 'utf8');
    results.push(/Scenarist_SCC V1\.0/i.test(txt) ? item('pass', 'SCC header', 'Scenarist_SCC V1.0') : item('fail', 'SCC header', 'Missing Scenarist_SCC V1.0 header.'));
    results.push(item('info', 'MANUAL - display method', 'Confirm every SCC caption is pop-on; roll-up and paint-on are not accepted by Filmhub.'));
    results.push(item('info', 'MANUAL - caption review', 'Verify SDH completeness, sync, accuracy, spelling, and placement against the final program.'));
    return results;
  }
  const txt = fs.readFileSync(file, 'utf8');
  const events = parseTextCaptions(txt);
  if (!events.length) return [item('fail', 'Caption events', 'No valid timed caption events were found.')];
  results.push(item('pass', 'Caption events', `${events.length} timed event(s)`));
  let longLines = 0, tooManyLines = 0, badDuration = 0, tightGaps = 0, fast = 0, badIds = 0;
  events.forEach((e, i) => {
    if (!e.time || e.time.end <= e.time.start) { badDuration++; return; }
    const dur = e.time.end - e.time.start;
    if (dur < 600 || dur > 8000) badDuration++;
    if (e.lines.length > 2) tooManyLines++;
    if (e.lines.some(l => l.replace(/<[^>]+>/g, '').length > 43)) longLines++;
    const chars = e.lines.join(' ').replace(/<[^>]+>/g, '').length;
    if (chars / (dur / 1000) > 25) fast++;
    if (i && e.time.start - events[i - 1].time.end < 42) tightGaps++;
    if (ext === 'srt' && !/^\d+$/.test(e.id)) badIds++;
  });
  const metric = (count, check, ok, fail) => results.push(count ? item('fail', check, `${count} event(s): ${fail}`) : item('pass', check, ok));
  metric(longLines, 'Line length', 'All lines are 43 characters or fewer.', 'line exceeds 43 characters.');
  metric(tooManyLines, 'Lines per event', 'Every event uses at most 2 lines.', 'more than 2 lines.');
  metric(badDuration, 'Event duration', 'Every event lasts 0.6 to 8 seconds.', 'duration is outside 0.6-8 seconds or invalid.');
  metric(tightGaps, 'Event spacing', 'At least 42 ms between events.', 'gap is under 42 ms.');
  metric(fast, 'Reading speed', 'Every event is at most 25 characters/second.', 'reading speed exceeds 25 characters/second.');
  if (ext === 'srt') metric(badIds, 'SRT IDs', 'Every event has a numeric ID.', 'missing numeric event ID.');
  results.push(item('info', 'MANUAL - caption review', 'Verify SDH completeness, sync within 0.5 seconds, accuracy, spelling, punctuation, and placement against the final delivered program.'));
  return results;
}

module.exports = { checkCaptions, parseTextCaptions };
