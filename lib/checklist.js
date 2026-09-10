// Deliverables checklist — mirrors DELIVERABLES.md (the spec of record).
// If this file and DELIVERABLES.md disagree, DELIVERABLES.md wins.

// Universal package groups. Exact required assets come from the selected profile.
const CORE = [
  { id: 'master', name: 'Clean Program Master', type: 'both' },
  { id: 'captions', name: 'Platform Caption File', type: 'both' },
  { id: 'artwork', name: 'Platform Artwork Package', type: 'both' },
  { id: 'metadata', name: '18-Column Metadata CSV', type: 'both' },
  { id: 'compliance', name: 'Sponsor / CTA Review + Ad-Break Log', type: 'both' },
  { id: 'delivery', name: 'Platform QC and Delivery Confirmation', type: 'both' },
];

// Retained optional documents, in their historical order.
// `source`: 'app'      → authored in-app from a template
//           'draft'    → auto-drafted by the app, then reviewed
//           'collect'  → obtained externally, filed by the app
const ANCILLARY = [
  { id: 'cuesheet', name: 'Music Cue Sheet', type: 'both', source: 'draft' },
  { id: 'textlesslog', name: 'Textless Materials Log', type: 'both', source: 'draft', note: 'timecode + scene description' },
  { id: 'musiclic', name: 'Music Licenses', type: 'both', source: 'collect', note: 'Epidemic certificates per track' },
  { id: 'thirdparty', name: 'Third Party Licences (graphics, footage)', type: 'both', source: 'app' },
  { id: 'abscript', name: 'Broadcast Script', type: 'both', source: 'draft' },
  { id: 'segsheet', name: 'Segment Timing Sheet', type: 'both', source: 'draft' },
  { id: 'credits', name: 'Credits', type: 'both', source: 'app' },
  { id: 'castcrew', name: 'Cast / Crew', type: 'both', source: 'app' },
  { id: 'synopsis', name: 'Synopsis', type: 'both', source: 'app' },
  { id: 'logline', name: 'Logline', type: 'both', source: 'app' },
  { id: 'lowerthirds', name: 'Lower Thirds Log', type: 'both', source: 'draft' },
  { id: 'copyrightline', name: 'Copyright Line', type: 'both', source: 'app' },
  { id: 'dubsub', name: 'Dubbing & Subtitle Restrictions', type: 'both', source: 'app' },
  { id: 'talentchart', name: 'Talent Restrictions + Approvals Chart', type: 'both', source: 'app' },
  { id: 'adpub', name: 'Ad/Pub Restrictions', type: 'both', source: 'app' },
  { id: 'prodplace', name: 'Placement Declaration', type: 'both', source: 'app' },
  { id: 'tradeout', name: 'Tradeout Declaration', type: 'both', source: 'app' },
  { id: 'titlesearch', name: 'Title Search Report & Legal Opinion', type: 'both', source: 'collect', note: 'ordered from a clearance company' },
  { id: 'copyrightsearch', name: 'Copyright Search Report', type: 'both', source: 'collect', note: 'ordered from a clearance company' },
];

const STATUSES = ['Not started', 'In progress', 'Ready', 'Delivered', 'Approved', 'N/A'];

// Legacy broadcast runtime targets. Not a streaming completion gate.
// Format is decided per-episode by its actual length, not set in advance.
const RUNTIME_FORMATS = [
  { id: 'half', label: 'Half-hour', minMin: 23, maxMin: 26, aimMin: 25.5 },
  { id: 'hour', label: 'Hour', minMin: 46, maxMin: 52, aimMin: 51.5 },
];

/**
 * Classify an episode by its program runtime (seconds, excluding head/tail).
 * Picks whichever format the runtime is in — or nearest, if it falls between.
 * → { format, inRange, minutes, message }
 */
function classifyRuntime(seconds) {
  const minutes = seconds / 60;
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  const inRange = RUNTIME_FORMATS.find(f => minutes >= f.minMin && minutes <= f.maxMin);
  if (inRange) {
    const headroom = inRange.maxMin - minutes;
    return {
      format: inRange, inRange: true, minutes,
      message: `${fmt(seconds)} — ${inRange.label} format (target ${inRange.minMin}–${inRange.maxMin} min).` +
        (headroom < 0.5 ? ' ⚠ Close to the ceiling — remember the 2s segment blacks count toward runtime.' : ''),
    };
  }
  // out of range: report the nearest format and the gap
  const nearest = RUNTIME_FORMATS.reduce((best, f) => {
    const d = minutes < f.minMin ? f.minMin - minutes : minutes - f.maxMin;
    return (!best || d < best.d) ? { f, d } : best;
  }, null);
  const over = minutes > nearest.f.maxMin;
  return {
    format: nearest.f, inRange: false, minutes,
    message: `${fmt(seconds)} — ${over ? 'OVER' : 'UNDER'} the ${nearest.f.label} window ` +
      `(${nearest.f.minMin}–${nearest.f.maxMin} min) by ${nearest.d.toFixed(1)} min. ` +
      (over ? 'Use the Runtime & Extension Log to find trims.' : 'Needs more content, or aim for the other format.'),
  };
}

module.exports = { CORE, ANCILLARY, STATUSES, RUNTIME_FORMATS, classifyRuntime };
