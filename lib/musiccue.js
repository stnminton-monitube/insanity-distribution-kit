const fs = require('fs');
const path = require('path');

const DEFAULT_SFX_DIR = process.platform === 'darwin'
  ? '/Volumes/main/Users/aminton/Insanity Media Dropbox/Insanity/Video/0 Insanity Assets/3 Sound Effects'
  : '';
const MUSIC_EXTENSIONS = new Set(['.wav', '.mp3']);
const MEDIA_SUFFIX_RE = /\.(?:wav|wave|mp3|m4a|aif|aiff|flac|ogg|caf|pek|cfa)$/i;
const OBVIOUS_SFX_RE = /(?:^|[^a-z])(woosh|whoosh|swoosh|glitch|clicks?|ticks?|booms?|impacts?|risers?|stingers?|drones?|ambience|atmospheres?|foley|hits?)(?:[^a-z]|$)/i;

function withoutMediaSuffixes(value) {
  let out = String(value || '');
  while (MEDIA_SUFFIX_RE.test(out)) out = out.replace(MEDIA_SUFFIX_RE, '');
  return out;
}

function normalizedAssetKey(value) {
  let decoded = String(value || '');
  try { decoded = decodeURIComponent(decoded.replace(/^file:\/\/localhost/i, '')); } catch (e) { /* keep original */ }
  const base = withoutMediaSuffixes(path.basename(decoded)).replace(/\s+Audio Extracted(?:_\d+)?$/i, '');
  return withoutMediaSuffixes(base)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[_–—-]+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function parseTrackName(name) {
  const file = path.basename(String(name || ''));
  let base = withoutMediaSuffixes(file).replace(/\s+Audio Extracted(?:_\d+)?$/i, '').trim();
  const epidemic = /^ES_/i.test(base);
  if (epidemic) base = base.slice(3).replace(/^\d+_/, '');
  const parts = base.match(/^(.*?)\s+-\s+(.*)$/);
  let title = parts ? parts[1] : base;
  let composer = parts ? parts[2] : '';
  title = title.replace(/\s+STEMS.*$/i, '').trim();
  composer = composer
    .replace(/\s+Audio Extracted(?:_\d+)?$/i, '')
    .replace(/_(?:melody|drums|bass|instruments|stems.*)$/i, '')
    .trim();
  const sfxCatalogName = epidemic && (/- Epidemic Sound\./i.test(file) || file.split(',').length >= 3);
  // "Title - Artist/Composer" is the prevailing stock-library naming shape,
  // not just an Epidemic convention. Treat it as a strong signal only after
  // rejecting names that read like effects. The library index remains the
  // authoritative exclusion and is applied before this confidence score.
  const likelyMusic = /\[music\]/i.test(file) || (!!parts && !sfxCatalogName && !OBVIOUS_SFX_RE.test(file));
  return { title: title || base || file, composer, epidemic, likelyMusic };
}

// Premiere XML exposes an MP4's embedded audio as an audio clip. This workflow
// intentionally considers only discrete WAV/MP3 assets for the music cue sheet.
function musicAssetExtension(clip) {
  for (const value of [clip && clip.sourcePath, clip && clip.sourceName, clip && clip.name]) {
    if (!value) continue;
    let decoded = String(value);
    try { decoded = decodeURIComponent(decoded.replace(/^file:\/\/localhost/i, '')); } catch (e) { /* keep original */ }
    const ext = path.extname(decoded).toLowerCase();
    if (ext) return ext;
  }
  return '';
}

function walkFiles(root, visit) {
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { continue; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) visit(full);
    }
  }
}

function discoverLocalSfxDirs(root, maxDepth = 4) {
  if (!root || !fs.existsSync(root)) return [];
  const found = [];
  const stack = [{ dir: root, depth: 0 }];
  while (stack.length) {
    const { dir, depth } = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { continue; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const full = path.join(dir, entry.name);
      if (/^(?:sound[ _-]*effects?|sfx|sound[ _-]*design)$/i.test(entry.name)) {
        found.push(full);
      } else if (depth < maxDepth && entry.name !== 'Distribution' && !entry.name.startsWith('.')) {
        stack.push({ dir: full, depth: depth + 1 });
      }
    }
  }
  return found;
}

function buildExclusionIndex(directories = [DEFAULT_SFX_DIR]) {
  const keys = new Set();
  let files = 0;
  const missing = [];
  for (const dir of directories.filter(Boolean)) {
    if (!fs.existsSync(dir)) { missing.push(dir); continue; }
    walkFiles(dir, file => {
      files++;
      const key = normalizedAssetKey(file);
      if (key) keys.add(key);
    });
  }
  return { keys, files, missing };
}

const exclusionCache = new Map();
function cachedExclusionIndex(directories) {
  const cacheKey = directories.join('\u0000');
  const cached = exclusionCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.value;
  const value = buildExclusionIndex(directories);
  exclusionCache.set(cacheKey, { value, expires: Date.now() + 60000 });
  return value;
}

function mergeSongClips(clips, gapFrames) {
  clips.sort((a, b) => a.start - b.start || a.end - b.end);
  const uses = [];
  let current = null;
  for (const clip of clips) {
    if (current && clip.start <= current.end + gapFrames) {
      current.end = Math.max(current.end, clip.end);
      current.clipCount++;
      current.files.add(clip.file);
      current.tracks.add(clip.trackLabel);
      current.likelyMusic = current.likelyMusic || clip.likelyMusic;
      current.segments.push({ trackIndex: clip.trackIndex, start: clip.start, end: clip.end });
    } else {
      current = { ...clip, clipCount: 1, files: new Set([clip.file]), tracks: new Set([clip.trackLabel]), segments: [{ trackIndex: clip.trackIndex, start: clip.start, end: clip.end }] };
      uses.push(current);
    }
  }
  return uses;
}

function analyzeMusicCues(sequence, trackIndices, options = {}) {
  const tbase = Number(sequence.timebase) || 30;
  const gapSeconds = Math.max(0, Math.min(30, Number(options.gapSeconds) || 5));
  const exclusion = cachedExclusionIndex(options.exclusionDirs || [DEFAULT_SFX_DIR]);
  const localDirs = options.episodeFolder ? discoverLocalSfxDirs(options.episodeFolder) : [];
  const localExclusion = cachedExclusionIndex(localDirs);
  const selected = new Set((trackIndices || []).map(Number));
  const groups = new Map();
  let excludedLibrary = 0;
  let excludedObvious = 0;
  let excludedLocal = 0;
  let excludedFormat = 0;

  for (const track of sequence.audioTracks || []) {
    if (track.enabled === false || !selected.has(Number(track.index))) continue;
    for (const clip of track.clips || []) {
      if (!MUSIC_EXTENSIONS.has(musicAssetExtension(clip))) { excludedFormat++; continue; }
      const file = clip.sourceName || clip.name || '';
      const assetKey = normalizedAssetKey(file);
      if (assetKey && exclusion.keys.has(assetKey)) { excludedLibrary++; continue; }
      const parsed = parseTrackName(file);
      const sourceHint = `${clip.sourcePath || ''} ${track.timelineName || ''} ${track.label || ''}`;
      if (assetKey && localExclusion.keys.has(assetKey) && !parsed.likelyMusic) { excludedLocal++; continue; }
      const likelyMusic = parsed.likelyMusic || /(?:^|[\\/ _-])(?:music|mx|score)(?:[\\/ _-]|$)/i.test(sourceHint);
      if (OBVIOUS_SFX_RE.test(file) && !likelyMusic) { excludedObvious++; continue; }
      const start = Number(clip.start);
      const end = start + Number(clip.durFrames);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
      const identity = normalizedAssetKey(parsed.title) + '\u0000' + normalizedAssetKey(parsed.composer);
      if (!groups.has(identity)) groups.set(identity, []);
      groups.get(identity).push({ ...parsed, likelyMusic, file, trackIndex: track.index, trackLabel: track.label, start, end });
    }
  }

  const cues = [];
  for (const [identity, clips] of groups) {
    for (const cue of mergeSongClips(clips, Math.round(gapSeconds * tbase))) {
      const files = [...cue.files].sort();
      const tracks = [...cue.tracks].sort();
      cues.push({
        id: Buffer.from(`${identity}\u0000${cue.start}\u0000${cue.end}`).toString('base64url'),
        title: cue.title,
        composer: cue.composer,
        isEpidemicFormat: cue.epidemic,
        confidence: cue.likelyMusic ? 'likely' : 'review',
        start: cue.start,
        end: cue.end,
        dur: cue.end - cue.start,
        clipCount: cue.clipCount,
        files,
        tracks,
        segments: cue.segments,
        file: files[0] || '',
        trackLabel: tracks.join(', '),
      });
    }
  }
  cues.sort((a, b) => a.start - b.start || a.end - b.end);
  return {
    cues,
    excluded: excludedLibrary + excludedLocal + excludedObvious,
    excludedFormat,
    excludedLibrary,
    excludedLocal,
    excludedObvious,
    indexedFiles: exclusion.files,
    localIndexedFiles: localExclusion.files,
    localExclusionDirs: localDirs,
    missingDirectories: exclusion.missing,
    gapSeconds,
  };
}

module.exports = { DEFAULT_SFX_DIR, MUSIC_EXTENSIONS, musicAssetExtension, normalizedAssetKey, parseTrackName, discoverLocalSfxDirs, buildExclusionIndex, analyzeMusicCues };
