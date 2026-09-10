const path = require('path');

const METADATA_FIELDS = [
  { key: 'seriesName', label: 'SERIES NAME // FILM NAME', required: true, help: 'Primary parent name of the asset.' },
  { key: 'season', label: 'SEASON #', help: 'Use 1 for a standalone title.' },
  { key: 'episode', label: 'EPISODE #', help: 'Use 1 for a standalone title.' },
  { key: 'episodeTitle', label: 'EPISODE TITLE', required: true, help: 'For a standalone title, repeat the film name.' },
  { key: 'cast', label: 'CAST', required: true, help: 'At least 3 featured names, comma-separated.' },
  { key: 'crew', label: 'CREW', required: true, help: 'Director, producer, and other principal crew.' },
  { key: 'description', label: 'SERIES/ VIDEO DESCRIPTION', required: true, help: 'Maximum 120 characters.' },
  { key: 'premiereDate', label: 'ORIGINAL PREMIERE DATE', required: true, help: 'MM/YYYY.' },
  { key: 'subgenre', label: 'SUBGENRE', required: true, help: 'Use the destination sheet dropdown value.' },
  { key: 'runtime', label: 'RUNTIME', required: true, help: 'Whole minutes.' },
  { key: 'keywords', label: 'KEYWORDS', required: true, help: 'At least 3 comma-separated keywords.' },
  { key: 'country', label: 'COUNTRY OF ORIGIN', required: true, help: 'Country and state where applicable.' },
  { key: 'videoQuality', label: 'VIDEO QUALITY', required: true, options: ['HD', 'SD'] },
  { key: 'closedCaptioning', label: 'CLOSED CAPTIONING', required: true, options: ['TRUE', 'FALSE'] },
  { key: 'imdb', label: 'IMDB', help: 'Full IMDb link. Confirm Foundation Distribution is listed as distributor.' },
  { key: 'adIntegration', label: 'AD INTEGRATION', required: true, options: ['None', 'Present - approved', 'Present - needs review', 'Present - removal needed'] },
  { key: 'callToAction', label: 'CALL TO ACTION', required: true, options: ['None', 'Present - approved', 'Present - needs review', 'Present - removal needed'] },
  { key: 'youtubeLink', label: 'YOUTUBE LINK', help: 'Full link; include the password in delivery notes if needed.' },
];

const SUBGENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama',
  'Educational', 'Faith', 'Family', 'Food', 'History', 'Horror', 'Lifestyle',
  'Music', 'Mystery', 'Nature', 'Reality', 'Science', 'Sports', 'Thriller', 'Travel', 'Other',
];

const PLATFORM_PROFILES = {
  general: {
    id: 'general', name: 'General Streaming (AVOD / TVOD / SVOD)', badge: 'Internal checklist',
    source: 'Internal Material Delivery Checklist (2026-09-09)',
    useCase: 'Use this as the normal starting point when no distributor-specific contract has been supplied.',
    contentPolicy: 'Confirm sponsor messages, CTAs, URLs, and promotions are absent or internally approved. Enter N/A when none apply.',
    video: 'Clean H.264 mezzanine, 1920x1080 progressive, target 9 Mbps or higher; AAC 48 kHz. No bars, tone, slate, leader, or textless tail.',
    acceptedVideo: ['mp4', 'mov'], codecs: ['h264'], minWidth: 1920, minHeight: 1080, exactResolution: true,
    minMbpsHD: 9, frameRates: null, requireTimecode: false, forbidTimecode: false,
    audioCodecs: ['aac'], requireStereo: true,
    captions: ['srt', 'vtt'], captionLabel: 'SRT or VTT against final program; human sync/accuracy/placement review required.',
    art: [
      { id: 'landscape', name: 'Landscape key art', width: 1920, height: 1080, exact: true, required: true, layered: false },
      { id: 'episode', name: 'Per-episode thumbnail', width: 1920, height: 1080, exact: true, required: true, layered: false },
      { id: 'poster', name: 'Vertical poster', width: 3150, height: 4200, exact: true, required: true, layered: false },
      { id: 'squareTitle', name: 'Square art - title', width: 1080, height: 1080, exact: true, required: true, layered: false },
      { id: 'squareClean', name: 'Square art - no title', width: 1080, height: 1080, exact: true, required: true, layered: false },
      { id: 'layered', name: 'Layered source file', required: true, layered: true },
    ],
  },
  filmhub: {
    id: 'filmhub', name: 'Filmhub Delivery', badge: 'Official profile - verified 2026-09-09',
    source: 'Filmhub Asset Requirements and Help Center',
    useCase: 'Choose this only when the episode will be submitted or delivered through Filmhub.',
    contentPolicy: 'Filmhub does not allow URLs or promotional references in the program. Confirm they are absent before delivery.',
    video: 'Clean native-frame-rate master. ProRes 422/HQ preferred; H.264/H.265 HD must be at least 15 Mbps. No timecode stream, bars, slate, leader, padding, URLs, or promos.',
    acceptedVideo: ['mov', 'mp4', 'mkv', 'ts', 'mpg', 'mpeg', 'ogg'], codecs: ['prores', 'h264', 'hevc', 'mpeg2video', 'dvvideo'],
    minWidth: 640, minHeight: null, minMbpsHD: 15, exactResolution: false,
    frameRates: ['24000/1001', '24/1', '25/1', '30000/1001', '30/1', '50/1', '60000/1001', '60/1'],
    requireTimecode: false, forbidTimecode: true,
    audioCodecs: ['pcm_', 'aac', 'mp3', 'ac3'], requireStereo: true,
    captions: ['srt', 'scc'], captionLabel: 'English SDH SRT preferred; SCC only when it is the only source. VTT is not accepted.',
    art: [
      { id: 'poster23', name: 'Portrait 2:3', width: 1400, height: 2100, required: true, layered: false },
      { id: 'poster34', name: 'Portrait 3:4', width: 1575, height: 2100, required: true, layered: false },
      { id: 'landscape', name: 'Landscape 16:9', width: 1920, height: 1080, required: true, layered: false },
      { id: 'show43', name: 'Landscape 4:3 (shows)', width: 1920, height: 1440, required: true, layered: false },
      { id: 'episode', name: 'Episode image - textless', width: 1920, height: 1080, required: false, layered: false },
      { id: 'textless', name: 'Landscape 16:9 - textless', width: 1920, height: 1080, required: false, layered: false },
      { id: 'layered', name: 'Layered working source (internal archive)', required: true, layered: true },
    ],
  },
  contract: {
    id: 'contract', name: 'Custom / Contract Spec', badge: 'Manual confirmation required',
    source: 'Use the signed platform delivery specification',
    useCase: 'Choose this for a named buyer or platform whose signed requirements differ from the built-in profiles.',
    contentPolicy: 'Check the signed contract for sponsor, CTA, URL, promotional-content, and ad-break rules.',
    video: 'Clean program master. Enter the contract requirements in episode notes and confirm every technical value manually.',
    acceptedVideo: ['mov', 'mp4', 'mxf'], codecs: [], minWidth: null, minHeight: null, exactResolution: false,
    minMbpsHD: null, frameRates: null, requireTimecode: false, forbidTimecode: false,
    audioCodecs: [], requireStereo: false,
    captions: ['srt', 'vtt', 'scc', 'stl', 'cap'], captionLabel: 'Caption format and timing must match the signed contract.',
    art: [
      { id: 'contractArt', name: 'Contract-required artwork', required: true, layered: false },
      { id: 'layered', name: 'Layered working source', required: false, layered: true },
    ],
  },
};

const GATE_GROUPS = [
  { id: 'video', name: 'Video & audio', items: [
    ['videoMachine', 'Machine-readable video checks pass'],
    ['videoWatch', 'MANUAL - watch final program end to end'],
    ['audioListen', 'MANUAL - listen for dropouts, clipping, phasing, and balance'],
    ['cleanProgram', 'MANUAL - no bars, slate, tone, leader, or excessive black'],
  ] },
  { id: 'captions', name: 'Captions', items: [
    ['captionMachine', 'Caption structure checks pass'],
    ['captionSync', 'MANUAL - captions synced to final delivered program'],
    ['captionAccuracy', 'MANUAL - accuracy, completeness, spelling, and placement reviewed'],
  ] },
  { id: 'art', name: 'Artwork', items: [
    ['artDimensions', 'Required artwork slots present and dimensions pass'],
    ['artVisual', 'MANUAL - art is sharp, legible, correctly titled/textless, and inside safe zones'],
    ['artLayered', 'Layered source retained where required'],
  ] },
  { id: 'metadata', name: 'Metadata', items: [
    ['metadataValid', 'All 18 metadata columns pass validation'],
    ['metadataReview', 'MANUAL - names, rights, links, dates, and distributor listing verified'],
  ] },
  { id: 'ads', name: 'Ads & compliance', items: [
    ['sponsorReview', 'MANUAL - sponsor reads confirmed absent or reviewed against target policy'],
    ['ctaReview', 'MANUAL - CTA, URL, and promos confirmed absent or reviewed'],
    ['adBreaks', 'Ad-break/chapter timecodes logged, or marked not applicable'],
  ] },
  { id: 'delivery', name: 'Delivery', items: [
    ['naming', 'MANUAL - target naming convention applied'],
    ['deliveryMethod', 'MANUAL - portal, FTP, or API destination confirmed'],
    ['rights', 'MANUAL - rights and E&O/insurance readiness confirmed'],
  ] },
];

function getProfile(id) { return PLATFORM_PROFILES[id] || PLATFORM_PROFILES.general; }

function splitList(v) { return String(v || '').split(',').map(x => x.trim()).filter(Boolean); }
function validUrl(v, host) {
  if (!v) return true;
  try { const u = new URL(v); return /^https?:$/.test(u.protocol) && (!host || u.hostname.toLowerCase().includes(host)); } catch (e) { return false; }
}

function validateMetadata(record = {}) {
  const issues = [];
  for (const f of METADATA_FIELDS) if (f.required && !String(record[f.key] ?? '').trim()) issues.push({ key: f.key, level: 'fail', message: `${f.label} is required.` });
  if (record.season && !/^\d+$/.test(String(record.season))) issues.push({ key: 'season', level: 'fail', message: 'SEASON # must be a whole number.' });
  if (record.episode && !/^\d+$/.test(String(record.episode))) issues.push({ key: 'episode', level: 'fail', message: 'EPISODE # must be a whole number.' });
  if (record.description && String(record.description).length > 120) issues.push({ key: 'description', level: 'fail', message: 'Description must be 120 characters or fewer.' });
  if (record.cast && splitList(record.cast).length < 3) issues.push({ key: 'cast', level: 'fail', message: 'CAST needs at least 3 comma-separated names.' });
  if (record.keywords && splitList(record.keywords).length < 3) issues.push({ key: 'keywords', level: 'fail', message: 'KEYWORDS needs at least 3 comma-separated words or phrases.' });
  if (record.premiereDate && !/^(0[1-9]|1[0-2])\/\d{4}$/.test(String(record.premiereDate))) issues.push({ key: 'premiereDate', level: 'fail', message: 'ORIGINAL PREMIERE DATE must be MM/YYYY.' });
  if (record.runtime && (!/^\d+$/.test(String(record.runtime)) || Number(record.runtime) < 1)) issues.push({ key: 'runtime', level: 'fail', message: 'RUNTIME must be a positive whole number of minutes.' });
  if (record.videoQuality && !['HD', 'SD'].includes(record.videoQuality)) issues.push({ key: 'videoQuality', level: 'fail', message: 'VIDEO QUALITY must be HD or SD.' });
  if (record.closedCaptioning && !['TRUE', 'FALSE'].includes(record.closedCaptioning)) issues.push({ key: 'closedCaptioning', level: 'fail', message: 'CLOSED CAPTIONING must be TRUE or FALSE.' });
  if (record.imdb && !validUrl(record.imdb, 'imdb.')) issues.push({ key: 'imdb', level: 'fail', message: 'IMDB must be a full imdb.com link.' });
  if (record.youtubeLink && !validUrl(record.youtubeLink, 'youtu')) issues.push({ key: 'youtubeLink', level: 'fail', message: 'YOUTUBE LINK must be a full YouTube URL.' });
  return issues;
}

function csvCell(v) { return `"${String(v ?? '').replace(/"/g, '""')}"`; }
function metadataCsv(record = {}) {
  return METADATA_FIELDS.map(f => csvCell(f.label)).join(',') + '\n' + METADATA_FIELDS.map(f => csvCell(record[f.key])).join(',') + '\n';
}

function safeBaseName(record = {}) {
  return (record.episodeTitle || record.seriesName || 'episode').replace(/[^a-z0-9 _-]/gi, '').trim().replace(/\s+/g, '_') || 'episode';
}

function metadataFilename(record = {}) { return `${safeBaseName(record)}_metadata.csv`; }

module.exports = { METADATA_FIELDS, SUBGENRES, PLATFORM_PROFILES, GATE_GROUPS, getProfile, validateMetadata, metadataCsv, metadataFilename };
