// Parser for Premiere Pro "Final Cut Pro XML" (xmeml) sequence exports.
// Depth-aware: handles real-world projects with NESTED SEQUENCES (a nested
// sequence appears as a full <sequence> inside a <clipitem>). Only the master
// timeline's own tracks, clips, and sequence markers are returned.
const fs = require('fs');

// Find top-level <tag> blocks within [from, to) — nested same-tag blocks are skipped.
// Returns array of { start, end, inner } offsets (inner = content between tags).
function topBlocks(xml, tag, from, to) {
  const re = new RegExp(`<${tag}(?=[\\s/>])[^>]*>|</${tag}>`, 'g');
  re.lastIndex = from;
  const blocks = [];
  let depth = 0, openIdx = -1, innerStart = -1;
  let m;
  while ((m = re.exec(xml)) && m.index < to) {
    const isClose = m[0][1] === '/';
    const selfClose = m[0].endsWith('/>');
    if (!isClose) {
      if (selfClose) continue;
      if (depth === 0) { openIdx = m.index; innerStart = m.index + m[0].length; }
      depth++;
    } else {
      depth--;
      if (depth === 0 && openIdx >= 0) {
        blocks.push({ start: openIdx, end: m.index + m[0].length, inner: [innerStart, m.index] });
        openIdx = -1;
      }
      if (depth < 0) depth = 0;
    }
  }
  return blocks;
}

// First direct value of <tag> within a range (first occurrence — clipitem's own
// fields come before any nested content in Premiere's output order).
function firstValue(xml, tag, from, to) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`, 'g');
  re.lastIndex = from;
  const m = re.exec(xml);
  return (m && m.index < to) ? m[1].trim() : null;
}

function unesc(s) {
  return String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'");
}

// Premiere writes start/end = -1 for clips flanked by transitions (crossfades);
// the true timeline position lives in pproTicksIn/Out (254016000000 ticks/sec).
const PPRO_TPS = 254016000000;
function clipRange(xml, lo, hi, timebase, ntsc) {
  let start = parseInt(firstValue(xml, 'start', lo, hi) || '-1', 10);
  let end = parseInt(firstValue(xml, 'end', lo, hi) || '-1', 10);
  if (start >= 0 && end > start) return { start, end };
  // xmeml invariant: timeline length always equals source out - in
  const sIn = parseInt(firstValue(xml, 'in', lo, hi) || '-1', 10);
  const sOut = parseInt(firstValue(xml, 'out', lo, hi) || '-1', 10);
  const len = (sIn >= 0 && sOut > sIn) ? sOut - sIn : -1;
  if (start >= 0 && end < 0 && len > 0) end = start + len;
  else if (end >= 0 && start < 0 && len > 0) start = end - len;
  // both negative (double-crossfade): leave unresolved — the caller fills from
  // neighboring transitionitems, or the clip is dropped (its stereo twin
  // usually carries valid coordinates; guessing here creates phantom cues).
  return { start, end, len };
}

function framesToTC(frames, timebase) {
  if (frames == null || frames < 0) return '';
  const f = Math.round(frames);
  const ff = f % timebase;
  const totalSec = Math.floor(f / timebase);
  const h = Math.floor(totalSec / 3600), m = Math.floor((totalSec % 3600) / 60), s = totalSec % 60;
  return [h, m, s, ff].map(n => String(n).padStart(2, '0')).join(':');
}

// ---- nested-sequence audio expansion ----
// Indexes every FULL <sequence> definition (any depth, has its own <media>)
// by id, so a nested-sequence clipitem can be resolved to its real content
// instead of staying an opaque "Nested Sequence N" placeholder.
function indexSequenceDefs(xml) {
  const defsById = {};
  const walk = (lo, hi) => {
    for (const b of topBlocks(xml, 'sequence', lo, hi)) {
      const tag = xml.slice(b.start, xml.indexOf('>', b.start) + 1);
      const id = (tag.match(/id="([^"]+)"/) || [])[1];
      const isFull = xml.slice(b.inner[0], b.inner[1]).includes('<media>');
      if (id && isFull && !defsById[id]) defsById[id] = b;
      walk(b.inner[0], b.inner[1]);
    }
  };
  walk(0, xml.length);
  return defsById;
}

// A sequence definition's own direct audio clips, plus any nested-sequence
// instances IT embeds (one level — expandNestedAudio recurses further).
function ownAudioContent(xml, block, timebase, ntsc, cache, cacheKey) {
  if (cacheKey && cache[cacheKey]) return cache[cacheKey];
  const res = { audioClips: [], instances: [] };
  const mediaBlocks = topBlocks(xml, 'media', block.inner[0], block.inner[1]);
  if (mediaBlocks.length) {
    const [mm0, mm1] = mediaBlocks[0].inner;
    let videoEnd = 0;
    for (const kindTag of ['video', 'audio']) {
      const kb = topBlocks(xml, kindTag, mm0, mm1)
        .filter(b => b.start >= (kindTag === 'audio' ? videoEnd : 0) && xml.slice(b.inner[0], b.inner[1]).includes('<track'));
      if (!kb.length) continue;
      if (kindTag === 'video') videoEnd = kb[0].end;
      for (const trk of topBlocks(xml, 'track', kb[0].inner[0], kb[0].inner[1])) {
        const transBlocks = topBlocks(xml, 'transitionitem', trk.inner[0], trk.inner[1]).map(tb2 => ({
          pos: tb2.start,
          s: parseInt(firstValue(xml, 'start', tb2.inner[0], tb2.inner[1]) || '-1', 10),
          e: parseInt(firstValue(xml, 'end', tb2.inner[0], tb2.inner[1]) || '-1', 10),
        }));
        for (const ci of topBlocks(xml, 'clipitem', trk.inner[0], trk.inner[1])) {
          let { start, end, len } = clipRange(xml, ci.inner[0], ci.inner[1], timebase, ntsc);
          if (start < 0 || end < 0) {
            const prevT = transBlocks.filter(t => t.pos < ci.start).pop();
            const nextT = transBlocks.find(t => t.pos > ci.start);
            if (start < 0 && prevT && prevT.s >= 0) start = prevT.s;
            if (end < 0 && nextT && nextT.e >= 0) end = nextT.e;
            if (start >= 0 && end < 0 && len > 0) end = start + len;
            if (end >= 0 && start < 0 && len > 0) start = end - len;
          }
          if (start < 0 || end <= start) continue;
          const cin = parseInt(firstValue(xml, 'in', ci.inner[0], ci.inner[1]) || '0', 10);
          const innerSeq = topBlocks(xml, 'sequence', ci.inner[0], ci.inner[1]);
          if (innerSeq.length) {
            const tag = xml.slice(innerSeq[0].start, xml.indexOf('>', innerSeq[0].start) + 1);
            const refId = (tag.match(/id="([^"]+)"/) || [])[1];
            if (refId) res.instances.push({ refId, start, end, in: cin });
          } else if (kindTag === 'audio') {
            const name = unesc(firstValue(xml, 'name', ci.inner[0], ci.inner[1]) || '');
            if (name) res.audioClips.push({ name, start, end });
          }
        }
      }
    }
  }
  if (cacheKey) cache[cacheKey] = res;
  return res;
}

// Recursively expands a nested-sequence reference into its real leaf audio
// clips, mapped into the CALLER's frame space (win.base-relative — the same
// coordinate space parseKind's own top-level clips use, before startFrames
// is added for display). Returns [] if the nest has no audio to find.
function expandNestedAudio(xml, refId, win, defsById, timebase, ntsc, depth, chain, cache) {
  const out = [];
  if (depth > 6 || chain.includes(refId)) return out;
  const def = defsById[refId];
  if (!def) return out;
  const c = ownAudioContent(xml, def, timebase, ntsc, cache, refId);
  for (const clip of c.audioClips) {
    const vs = Math.max(clip.start, win.lo), ve = Math.min(clip.end, win.hi);
    if (ve <= vs) continue;
    out.push({ name: clip.name, start: win.base + (vs - win.lo), end: win.base + (ve - win.lo) });
  }
  for (const inst of c.instances) {
    const vs = Math.max(inst.start, win.lo), ve = Math.min(inst.end, win.hi);
    if (ve <= vs) continue;
    out.push(...expandNestedAudio(xml, inst.refId, {
      lo: inst.in + (vs - inst.start),
      hi: inst.in + (ve - inst.start),
      base: win.base + (vs - win.lo),
    }, defsById, timebase, ntsc, depth + 1, [...chain, refId], cache));
  }
  return out;
}

function parseSequenceXML(filePath) {
  const xml = fs.readFileSync(filePath, 'utf8');
  if (!xml.includes('<xmeml')) throw new Error('Not a Final Cut Pro XML (xmeml) file. In Premiere: File → Export → Final Cut Pro XML.');

  // master sequence = first top-level <sequence> in the document
  const seqs = topBlocks(xml, 'sequence', 0, xml.length);
  if (!seqs.length) throw new Error('No <sequence> found in this XML.');
  const seq = seqs[0];
  const [s0, s1] = seq.inner;

  const name = unesc(firstValue(xml, 'name', s0, s1) || 'Sequence');

  // sequence frame rate: first <rate> block inside the master
  const rateBlocks = topBlocks(xml, 'rate', s0, s1);
  let timebase = 30, ntsc = false;
  if (rateBlocks.length) {
    timebase = parseInt(firstValue(xml, 'timebase', rateBlocks[0].inner[0], rateBlocks[0].inner[1]) || '30', 10);
    ntsc = /TRUE/i.test(firstValue(xml, 'ntsc', rateBlocks[0].inner[0], rateBlocks[0].inner[1]) || '');
  }

  // sequence start timecode
  let startFrames = 0;
  const tcBlocks = topBlocks(xml, 'timecode', s0, s1);
  if (tcBlocks.length) {
    const f = firstValue(xml, 'frame', tcBlocks[0].inner[0], tcBlocks[0].inner[1]);
    if (f != null && !isNaN(parseInt(f, 10))) startFrames = parseInt(f, 10);
  }

  // master's own <media> block (nested sequences' media are deeper → skipped)
  const mediaBlocks = topBlocks(xml, 'media', s0, s1);
  if (!mediaBlocks.length) throw new Error('No <media> found in the sequence.');
  const [m0, m1] = mediaBlocks[0].inner;

  const defsById = indexSequenceDefs(xml);
  const nestCache = {};

  const parseKind = (kindTag, kindLabel, afterOffset) => {
    // File descriptors contain <video>/<audio> metadata blocks, and nested
    // sequences carry their own audio sections. The MASTER's section is the
    // first with-<track> block starting after `afterOffset` (0 for video;
    // end-of-video-section for audio, since audio always follows video).
    const kindBlocks = topBlocks(xml, kindTag, m0, m1)
      .filter(b => b.start >= (afterOffset || 0) && xml.slice(b.inner[0], b.inner[1]).includes('<track'));
    if (!kindBlocks.length) return { tracks: [], sectionEnd: afterOffset || 0 };
    const [k0, k1] = kindBlocks[0].inner;
    const sectionEnd = kindBlocks[0].end;
    const raw = topBlocks(xml, 'track', k0, k1).map(trk => {
      // Track's own <enabled> (its "eyeball"/mute toggle in the timeline) —
      // firstValue searches forward from trk.inner[0], so this correctly
      // grabs the TRACK's tag rather than a child clipitem's own <enabled>
      // (used elsewhere for the textless swap), since xmeml lists track-level
      // fields before any <clipitem> children. Missing tag = enabled.
      const enabledStr = firstValue(xml, 'enabled', trk.inner[0], trk.inner[1]);
      const trackEnabled = enabledStr === null || enabledStr.toUpperCase() !== 'FALSE';
      const clipBlocks = topBlocks(xml, 'clipitem', trk.inner[0], trk.inner[1]);
      // transitions carry the true timeline bounds for crossfaded (-1) clips
      const transBlocks = topBlocks(xml, 'transitionitem', trk.inner[0], trk.inner[1]).map(tb2 => ({
        pos: tb2.start,
        s: parseInt(firstValue(xml, 'start', tb2.inner[0], tb2.inner[1]) || '-1', 10),
        e: parseInt(firstValue(xml, 'end', tb2.inner[0], tb2.inner[1]) || '-1', 10),
      }));
      const mkClip = (name, start, end, nested) => ({
        name, start, end, nested: !!nested,
        tcIn: framesToTC(startFrames + start, timebase),
        tcOut: framesToTC(startFrames + end, timebase),
        durFrames: end - start,
        dur: framesToTC(end - start, timebase),
      });
      const clips = clipBlocks.flatMap(cb => {
        const cName = unesc(firstValue(xml, 'name', cb.inner[0], cb.inner[1]) || 'clip');
        let { start, end, len } = clipRange(xml, cb.inner[0], cb.inner[1], timebase, ntsc);
        if (start < 0 || end < 0) {
          const prevT = transBlocks.filter(t => t.pos < cb.start).pop();
          const nextT = transBlocks.find(t => t.pos > cb.start);
          if (start < 0 && prevT && prevT.s >= 0) start = prevT.s;
          if (end < 0 && nextT && nextT.e >= 0) end = nextT.e;
          // one side recovered? derive the other from source length
          if (start >= 0 && end < 0 && len > 0) end = start + len;
          if (end >= 0 && start < 0 && len > 0) start = end - len;
        }
        if (start < 0 || end <= start) return [];
        // Audio only: a clip that wraps a NESTED SEQUENCE stays an opaque
        // "Nested Sequence N" placeholder for naive parsing. Dig in and
        // surface the real clip(s) actually playing at this point instead —
        // video nests stay opaque on purpose (bug #1 above: don't expand
        // nested content into the master's own video track).
        if (kindLabel === 'A') {
          const innerSeq = topBlocks(xml, 'sequence', cb.inner[0], cb.inner[1]);
          if (innerSeq.length) {
            const tag = xml.slice(innerSeq[0].start, xml.indexOf('>', innerSeq[0].start) + 1);
            const refId = (tag.match(/id="([^"]+)"/) || [])[1];
            const cin = parseInt(firstValue(xml, 'in', cb.inner[0], cb.inner[1]) || '0', 10);
            const expanded = refId && defsById[refId]
              ? expandNestedAudio(xml, refId, { lo: cin, hi: cin + (end - start), base: start }, defsById, timebase, ntsc, 1, [], nestCache)
              : [];
            if (expanded.length) return expanded.map(c => mkClip(c.name, c.start, c.end, true));
            return [mkClip(cName, start, end, true)]; // nest found, no real audio inside — stay visible, don't drop it
          }
        }
        return [mkClip(cName, start, end, false)];
      });
      const seen = new Set();
      const unique = clips.filter(c => {
        const k = c.name + '@' + c.start;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      return { clips: unique, sig: unique.map(c => c.name + '@' + c.start).join('|'), enabled: trackEnabled };
    });
    // Premiere splits each STEREO timeline track into two XML channel-tracks.
    // The two lists heavily overlap but aren't identical (mono-panned clips sit
    // on one channel only) — merge adjacent pairs when ≥70% of the smaller
    // list appears in the other, taking the UNION of clips.
    const logical = [];
    for (const t of raw) {
      const prev = logical[logical.length - 1];
      if (prev && !prev.merged && t.clips.length && prev.clips.length) {
        const prevKeys = new Set(prev.clips.map(c => c.name + '@' + c.start));
        const hits = t.clips.filter(c => prevKeys.has(c.name + '@' + c.start)).length;
        const overlap = hits / Math.min(t.clips.length, prev.clips.length);
        if (overlap >= 0.7) {
          // union: add clips the first channel didn't have
          for (const c of t.clips) if (!prevKeys.has(c.name + '@' + c.start)) prev.clips.push(c);
          prev.clips.sort((a, b) => a.start - b.start);
          prev.merged = true;
          prev.stereo = true;
          continue;
        }
      }
      logical.push({ ...t, clips: [...t.clips], stereo: false, merged: false });
    }
    const tracks = logical.map((t, i) => ({
      index: i + 1, kind: kindLabel,
      // deliberately NOT "A9"-style: XML track order ≠ Premiere timeline numbers
      label: `${kindLabel === 'A' ? 'Audio' : 'Video'} track #${i + 1}${t.stereo ? ' ·st' : ''}${t.enabled === false ? ' (disabled)' : ''}`,
      clipCount: t.clips.length, clips: t.clips, enabled: t.enabled !== false,
    })).filter(t => t.clipCount > 0);
    return { tracks, sectionEnd };
  };

  const videoRes = parseKind('video', 'V', 0);
  const audioRes = parseKind('audio', 'A', videoRes.sectionEnd);
  const videoTracks = videoRes.tracks;
  const audioTracks = audioRes.tracks;

  // sequence-level markers: top-level <marker> blocks in the master that sit
  // AFTER the media block (Premiere writes sequence markers at the tail).
  const markers = topBlocks(xml, 'marker', mediaBlocks[0].end, s1).map(mk => {
    const inF = parseInt(firstValue(xml, 'in', mk.inner[0], mk.inner[1]) || '-1', 10);
    const outF = parseInt(firstValue(xml, 'out', mk.inner[0], mk.inner[1]) || '-1', 10);
    return {
      name: unesc(firstValue(xml, 'name', mk.inner[0], mk.inner[1]) || ''),
      comment: unesc(firstValue(xml, 'comment', mk.inner[0], mk.inner[1]) || ''),
      inFrame: inF,
      outFrame: outF,
      tcIn: framesToTC(startFrames + inF, timebase),
      tcOut: outF >= 0 ? framesToTC(startFrames + outF, timebase) : '',
    };
  }).filter(m => m.inFrame >= 0);

  return {
    name, timebase, ntsc,
    startTC: framesToTC(startFrames, timebase),
    videoTracks, audioTracks, markers,
    nestedSequences: Math.max(0, (xml.match(/<sequence[\s>]/g) || []).length - 1),
  };
}

// Rewrite a sequence XML so texted graphic clips point at their _TEXTLESS renders.
// A clip qualifies if its filename matches `pattern` OR a _TEXTLESS sibling exists on disk.
// Returns { outPath, replaced: [names], missing: [names] }.
function makeTextlessXML(xmlPath, patternStr) {
  const path = require('path');
  let xml = fs.readFileSync(xmlPath, 'utf8');
  let patternRe = null;
  if (patternStr) { try { patternRe = new RegExp(patternStr, 'i'); } catch (e) { patternRe = null; } }

  // version-agnostic stem: strip extension + leading/trailing v2/V3-style tags
  const normStem = name => name
    .replace(/\.[^.]+$/, '')
    .replace(/[\s_-]*v\d+$/i, '')
    .replace(/^v\d+[\s_-]*/i, '')
    .replace(/\s+/g, ' ')
    .trim().toLowerCase();

  // per-directory index of textless files keyed by normalized stem
  const dirCache = {};
  const textlessIn = dir => {
    if (dirCache[dir]) return dirCache[dir];
    const map = {};
    try {
      for (const n of fs.readdirSync(dir)) {
        if (!/_TEXTLESS( v\d+)?\./i.test(n)) continue;
        const key = normStem(n.replace(/_TEXTLESS( v\d+)?\./i, '.'));
        if (!map[key]) map[key] = n;
      }
    } catch (e) { /* unreadable */ }
    dirCache[dir] = map;
    return map;
  };

  const replaced = [], missing = [], seenMissing = new Set(), seenReplaced = new Set();
  xml = xml.replace(/<pathurl>([\s\S]*?)<\/pathurl>/g, (whole, url) => {
    let fsPath;
    try {
      fsPath = decodeURIComponent(url.trim().replace(/^file:\/\/(localhost)?/, ''));
    } catch (e) { return whole; }
    const base = path.basename(fsPath);
    if (/_TEXTLESS\./i.test(base)) return whole;
    const dir = path.dirname(fsPath);
    // search same dir, parent dir, and one level of subdirs — renders often
    // drift into "v2 revisions"-style subfolders away from the textless output
    const searchDirs = [dir, path.dirname(dir)];
    try {
      for (const n of fs.readdirSync(dir, { withFileTypes: true })) {
        if (n.isDirectory && n.isDirectory()) searchDirs.push(path.join(dir, n.name));
      }
    } catch (e) { /* ignore */ }
    const exactKey = normStem(base);
    let sibling = null;
    for (const d of searchDirs) {
      const candidates = textlessIn(d);
      if (candidates[exactKey]) { sibling = path.join(d, candidates[exactKey]); break; }
    }
    const wantsSwap = (patternRe && patternRe.test(base)) || sibling;
    if (!wantsSwap) return whole;
    if (!sibling) {
      if (!seenMissing.has(base)) { seenMissing.add(base); missing.push(base); }
      return whole;
    }
    if (!seenReplaced.has(base)) { seenReplaced.add(base); replaced.push(base + ' → ' + path.basename(sibling)); }
    const newUrl = 'file://localhost' + encodeURI(sibling).replace(/#/g, '%23');
    return '<pathurl>' + newUrl + '</pathurl>';
  });

  xml = xml.replace(/(<sequence[^>]*>[\s\S]*?<name>)([\s\S]*?)(<\/name>)/, (m, a, n, c) => a + n.trim() + ' TEXTLESS' + c);

  const outPath = xmlPath.replace(/\.xml$/i, '') + ' TEXTLESS.xml';
  fs.writeFileSync(outPath, xml);
  return { outPath, replaced, missing };
}

// ---------------------------------------------------------------------------
// Nested-sequence audio harvester v2: Premiere writes each nested sequence's
// FULL definition once (possibly inside another nest) and empty id-reference
// shells everywhere else. So: index every definition by id, then recursively
// expand the instance tree from the master timeline, composing coordinate
// transforms (instance position + in-point + visibility clamps) at each level,
// down to every audio clip — mapped to true MASTER timecode.
function harvestNestedAudioV2(filePath) {
  const xml = fs.readFileSync(filePath, 'utf8');
  const seqs = topBlocks(xml, 'sequence', 0, xml.length);
  if (!seqs.length) throw new Error('No <sequence> found.');
  const master = seqs[0];

  // master rate (needed early — clipRange uses it for pproTicks fallback)
  const mRate = topBlocks(xml, 'rate', master.inner[0], master.inner[1]);
  const tb = mRate.length
    ? parseInt(firstValue(xml, 'timebase', mRate[0].inner[0], mRate[0].inner[1]) || '30', 10) : 30;
  const isNtsc = mRate.length
    ? /TRUE/i.test(firstValue(xml, 'ntsc', mRate[0].inner[0], mRate[0].inner[1]) || '') : true;

  // ---- index ALL sequence blocks (any depth) by id ----
  const defsById = {};
  const indexSeqs = (lo, hi) => {
    for (const b of topBlocks(xml, 'sequence', lo, hi)) {
      const tag = xml.slice(b.start, xml.indexOf('>', b.start) + 1);
      const id = (tag.match(/id="([^"]+)"/) || [])[1];
      const isFull = xml.slice(b.inner[0], b.inner[1]).includes('<media>');
      if (id && isFull && !defsById[id]) defsById[id] = b;
      indexSeqs(b.inner[0], b.inner[1]);
    }
  };
  indexSeqs(0, xml.length);

  // ---- parse a sequence block's content: its own audio clips + child instances ----
  const contentCache = {};
  const parseContent = (block, cacheKey) => {
    if (cacheKey && contentCache[cacheKey]) return contentCache[cacheKey];
    const res = { audioClips: [], instances: [] };
    const mediaBlocks = topBlocks(xml, 'media', block.inner[0], block.inner[1]);
    if (!mediaBlocks.length) return res;
    const [m0, m1] = mediaBlocks[0].inner;
    // Same requirement as parseSequenceXML's parseKind: this level's own audio
    // section is written LAST, after any nested sequence's own audio (which sits
    // textually inside the preceding video section). Without requiring the audio
    // block to start after the video section ends, a naive "first <audio> found"
    // scan grabs a nested sequence's audio instead of this level's own.
    let videoSectionEnd = 0;
    for (const kindTag of ['video', 'audio']) {
      const kb = topBlocks(xml, kindTag, m0, m1)
        .filter(b => b.start >= (kindTag === 'audio' ? videoSectionEnd : 0) && xml.slice(b.inner[0], b.inner[1]).includes('<track'));
      if (!kb.length) continue;
      if (kindTag === 'video') videoSectionEnd = kb[0].end;
      for (const trk of topBlocks(xml, 'track', kb[0].inner[0], kb[0].inner[1])) {
        // transitions carry the true timeline bounds for crossfaded (-1) clips —
        // same recovery parseSequenceXML's parseKind uses, needed here too or a
        // crossfaded music cue (very common) is silently dropped instead of found.
        const transBlocks = topBlocks(xml, 'transitionitem', trk.inner[0], trk.inner[1]).map(tb2 => ({
          pos: tb2.start,
          s: parseInt(firstValue(xml, 'start', tb2.inner[0], tb2.inner[1]) || '-1', 10),
          e: parseInt(firstValue(xml, 'end', tb2.inner[0], tb2.inner[1]) || '-1', 10),
        }));
        for (const ci of topBlocks(xml, 'clipitem', trk.inner[0], trk.inner[1])) {
          let { start, end, len } = clipRange(xml, ci.inner[0], ci.inner[1], tb, isNtsc);
          if (start < 0 || end < 0) {
            const prevT = transBlocks.filter(t => t.pos < ci.start).pop();
            const nextT = transBlocks.find(t => t.pos > ci.start);
            if (start < 0 && prevT && prevT.s >= 0) start = prevT.s;
            if (end < 0 && nextT && nextT.e >= 0) end = nextT.e;
            if (start >= 0 && end < 0 && len > 0) end = start + len;
            if (end >= 0 && start < 0 && len > 0) start = end - len;
          }
          const cin = parseInt(firstValue(xml, 'in', ci.inner[0], ci.inner[1]) || '0', 10);
          if (start < 0 || end <= start) continue;
          const innerSeq = topBlocks(xml, 'sequence', ci.inner[0], ci.inner[1]);
          if (innerSeq.length) {
            const tag = xml.slice(innerSeq[0].start, xml.indexOf('>', innerSeq[0].start) + 1);
            const refId = (tag.match(/id="([^"]+)"/) || [])[1];
            if (refId) res.instances.push({ refId, start, end, in: cin });
          } else if (kindTag === 'audio') {
            const name = unesc(firstValue(xml, 'name', ci.inner[0], ci.inner[1]) || '');
            if (name) res.audioClips.push({ name, start, end });
          }
        }
      }
    }
    if (cacheKey) contentCache[cacheKey] = res;
    return res;
  };

  // master start TC
  const [s0, s1] = master.inner;
  const timebase = tb;
  let startFrames = 0;
  const tcBlocks = topBlocks(xml, 'timecode', s0, s1);
  if (tcBlocks.length) {
    const f = firstValue(xml, 'frame', tcBlocks[0].inner[0], tcBlocks[0].inner[1]);
    if (f != null && !isNaN(parseInt(f, 10))) startFrames = parseInt(f, 10);
  }

  const out = [];
  const seen = new Set();
  // expand(defId, win): child-local frames in [win.lo, win.hi) are visible,
  // mapping to master frame = win.base + (local - win.lo)
  const expand = (defId, win, depth, chain) => {
    if (depth > 6 || out.length > 20000 || chain.includes(defId)) return;
    const def = defsById[defId];
    if (!def) return;
    const c = parseContent(def, defId);
    for (const clip of c.audioClips) {
      const vs = Math.max(clip.start, win.lo), ve = Math.min(clip.end, win.hi);
      if (ve <= vs) continue;
      const mIn = win.base + (vs - win.lo), mOut = win.base + (ve - win.lo);
      const key = clip.name + '@' + mIn;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        name: clip.name, nest: defId,
        tcIn: framesToTC(startFrames + mIn, timebase),
        tcOut: framesToTC(startFrames + mOut, timebase),
        dur: framesToTC(mOut - mIn, timebase),
        startFrame: mIn,
      });
    }
    for (const inst of c.instances) {
      const vs = Math.max(inst.start, win.lo), ve = Math.min(inst.end, win.hi);
      if (ve <= vs) continue;
      expand(inst.refId, {
        lo: inst.in + (vs - inst.start),
        hi: inst.in + (ve - inst.start),
        base: win.base + (vs - win.lo),
      }, depth + 1, [...chain, defId]);
    }
  };

  // master-level content: its own direct clips PLUS nested-sequence instances.
  // (Previously only instances were expanded — any clip sitting directly on the
  // master timeline, outside a nested sequence, was silently dropped entirely.)
  const mc = parseContent(master, '__master__');
  for (const clip of mc.audioClips) {
    const key = clip.name + '@' + clip.start;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name: clip.name, nest: null,
      tcIn: framesToTC(startFrames + clip.start, timebase),
      tcOut: framesToTC(startFrames + clip.end, timebase),
      dur: framesToTC(clip.end - clip.start, timebase),
      startFrame: clip.start,
    });
  }
  for (const inst of mc.instances) {
    expand(inst.refId, { lo: inst.in, hi: inst.in + (inst.end - inst.start), base: inst.start }, 1, []);
  }
  out.sort((a, b) => a.startFrame - b.startFrame);
  return out;
}

// (v1 kept for reference/compat)
function harvestNestedAudio(filePath) {
  const xml = fs.readFileSync(filePath, 'utf8');
  const seqs = topBlocks(xml, 'sequence', 0, xml.length);
  if (!seqs.length) throw new Error('No <sequence> found.');
  const master = seqs[0];
  const [s0, s1] = master.inner;

  // master rate + start TC
  const rateBlocks = topBlocks(xml, 'rate', s0, s1);
  const timebase = rateBlocks.length
    ? parseInt(firstValue(xml, 'timebase', rateBlocks[0].inner[0], rateBlocks[0].inner[1]) || '30', 10) : 30;
  let startFrames = 0;
  const tcBlocks = topBlocks(xml, 'timecode', s0, s1);
  if (tcBlocks.length) {
    const f = firstValue(xml, 'frame', tcBlocks[0].inner[0], tcBlocks[0].inner[1]);
    if (f != null && !isNaN(parseInt(f, 10))) startFrames = parseInt(f, 10);
  }

  const mediaBlocks = topBlocks(xml, 'media', s0, s1);
  if (!mediaBlocks.length) return [];
  const [m0, m1] = mediaBlocks[0].inner;

  // master-level clipitems from BOTH video and audio sections
  const sectionRanges = [];
  for (const kindTag of ['video', 'audio']) {
    const kb = topBlocks(xml, kindTag, m0, m1).filter(b => xml.slice(b.inner[0], b.inner[1]).includes('<track'));
    if (kb.length) sectionRanges.push(kb[0].inner);
  }

  const out = [];
  const seen = new Set();
  for (const [k0, k1] of sectionRanges) {
    for (const trk of topBlocks(xml, 'track', k0, k1)) {
      for (const ci of topBlocks(xml, 'clipitem', trk.inner[0], trk.inner[1])) {
        // does this master clipitem embed a nested sequence definition?
        const innerSeqs = topBlocks(xml, 'sequence', ci.inner[0], ci.inner[1]);
        if (!innerSeqs.length) continue;
        const nestName = unesc(firstValue(xml, 'name', ci.inner[0], ci.inner[1]) || 'Nested');
        const mStart = parseInt(firstValue(xml, 'start', ci.inner[0], ci.inner[1]) || '-1', 10);
        const mEnd = parseInt(firstValue(xml, 'end', ci.inner[0], ci.inner[1]) || '-1', 10);
        const srcIn = parseInt(firstValue(xml, 'in', ci.inner[0], ci.inner[1]) || '0', 10);
        if (mStart < 0 || mEnd <= mStart) continue;
        const visibleLen = mEnd - mStart;

        // inner audio clips of the embedded sequence definition
        const ns = innerSeqs[0];
        const nMedia = topBlocks(xml, 'media', ns.inner[0], ns.inner[1]);
        if (!nMedia.length) continue;
        const nAudio = topBlocks(xml, 'audio', nMedia[0].inner[0], nMedia[0].inner[1])
          .filter(b => xml.slice(b.inner[0], b.inner[1]).includes('<track'));
        if (!nAudio.length) continue;
        for (const nTrk of topBlocks(xml, 'track', nAudio[0].inner[0], nAudio[0].inner[1])) {
          for (const nc of topBlocks(xml, 'clipitem', nTrk.inner[0], nTrk.inner[1])) {
            const name = unesc(firstValue(xml, 'name', nc.inner[0], nc.inner[1]) || '');
            const cStart = parseInt(firstValue(xml, 'start', nc.inner[0], nc.inner[1]) || '-1', 10);
            const cEnd = parseInt(firstValue(xml, 'end', nc.inner[0], nc.inner[1]) || '-1', 10);
            if (!name || cStart < 0 || cEnd <= cStart) continue;
            // clip window visible through this nest instance
            const visStart = Math.max(cStart, srcIn);
            const visEnd = Math.min(cEnd, srcIn + visibleLen);
            if (visEnd <= visStart) continue;
            const masterIn = mStart + (visStart - srcIn);
            const masterOut = mStart + (visEnd - srcIn);
            const key = name + '@' + masterIn;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({
              name, nest: nestName,
              tcIn: framesToTC(startFrames + masterIn, timebase),
              tcOut: framesToTC(startFrames + masterOut, timebase),
              dur: framesToTC(masterOut - masterIn, timebase),
              startFrame: masterIn,
            });
          }
        }
      }
    }
  }
  out.sort((a, b) => a.startFrame - b.startFrame);
  return out;
}

// Build a CLEAN sequence XML: every matched graphic/overlay clip is DISABLED
// (enabled=FALSE) rather than swapped — giving "clean textless material without
// any graphic" for on-screen overlays, with no extra rendering required.
// Returns { outPath, disabled: [names] }.
function makeCleanXML(xmlPath, patternStr) {
  const path = require('path');
  const xml = fs.readFileSync(xmlPath, 'utf8');
  let patternRe = null;
  if (patternStr) { try { patternRe = new RegExp(patternStr, 'i'); } catch (e) { patternRe = null; } }

  const disabled = [], seen = new Set();
  const edits = []; // {from, to, text} applied back-to-front

  const scan = (lo, hi) => {
    for (const ci of topBlocks(xml, 'clipitem', lo, hi)) {
      const [c0, c1] = ci.inner;
      // this clip's own file reference (first pathurl inside the block)
      const purl = firstValue(xml, 'pathurl', c0, c1);
      let base = '';
      if (purl) {
        try { base = path.basename(decodeURIComponent(purl.trim().replace(/^file:\/\/(localhost)?/, ''))); } catch (e) { base = ''; }
      }
      const nm = unesc(firstValue(xml, 'name', c0, c1) || '');
      const isGraphic = (patternRe && (patternRe.test(base) || patternRe.test(nm)));
      if (isGraphic) {
        // disable this clip: flip its own <enabled>TRUE</enabled>
        const m = /<enabled>\s*TRUE\s*<\/enabled>/i.exec(xml.slice(c0, c1));
        if (m) {
          edits.push({ from: c0 + m.index, to: c0 + m.index + m[0].length, text: '<enabled>FALSE</enabled>' });
          const key = base || nm;
          if (!seen.has(key)) { seen.add(key); disabled.push(key); }
        }
        continue; // don't descend into a disabled graphic
      }
      scan(c0, c1); // nested sequences may hold graphics too
    }
  };
  const seqs = topBlocks(xml, 'sequence', 0, xml.length);
  if (seqs.length) scan(seqs[0].inner[0], seqs[0].inner[1]);

  let out = xml;
  edits.sort((a, b) => b.from - a.from);
  for (const e of edits) out = out.slice(0, e.from) + e.text + out.slice(e.to);
  out = out.replace(/(<sequence[^>]*>[\s\S]*?<name>)([\s\S]*?)(<\/name>)/, (m, a, n, c) => a + n.trim() + ' CLEAN' + c);

  const outPath = xmlPath.replace(/\.xml$/i, '') + ' CLEAN.xml';
  fs.writeFileSync(outPath, out);
  return { outPath, disabled };
}

module.exports = { parseSequenceXML, framesToTC, makeTextlessXML, makeCleanXML, harvestNestedAudio: harvestNestedAudioV2 };
