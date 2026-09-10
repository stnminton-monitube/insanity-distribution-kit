// Platform-first delivery workflow. Contract/platform profiles decide what is
// required; broadcast-era tools remain available as explicitly optional extras.
const svg = body => `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
const ICON = {
  target: svg('<circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M10 1v4M10 15v4M1 10h4M15 10h4" stroke="currentColor" stroke-width="1.5"/>'),
  data: svg('<path d="M4 4h12v12H4zM4 8h12M8 4v12" stroke="currentColor" stroke-width="1.5"/>'),
  video: svg('<rect x="3" y="4" width="14" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M8 7l5 3-5 3V7z" fill="currentColor"/>'),
  captions: svg('<path d="M3 5a2 2 0 012-2h10a2 2 0 012 2v7a2 2 0 01-2 2H8l-4 3v-3a2 2 0 01-1-2V5z" stroke="currentColor" stroke-width="1.5"/><path d="M6 8h3M11 8h3M6 11h3M11 11h3" stroke="currentColor"/>'),
  art: svg('<rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><circle cx="7" cy="7" r="1.5" stroke="currentColor"/><path d="M4 15l4-4 3 3 2-2 3 3" stroke="currentColor" stroke-width="1.5"/>'),
  compliance: svg('<path d="M10 2l6 2v5c0 4-2.5 7-6 9-3.5-2-6-5-6-9V4l6-2z" stroke="currentColor" stroke-width="1.5"/><path d="M7 10l2 2 4-5" stroke="currentColor" stroke-width="1.5"/>'),
  deliver: svg('<path d="M10 3l7 3.5v7L10 17l-7-3.5v-7L10 3zM3.5 6.5L10 10l6.5-3.5M10 10v7" stroke="currentColor" stroke-width="1.5"/>'),
  optional: svg('<circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M10 6v8M6 10h8" stroke="currentColor" stroke-width="1.5"/>'),
};

const STAGES = [
  { id: 'targets', icon: ICON.target, name: 'Target & Requirements', summary: 'Choose the platform preset first; every later check follows it.', details: `
<h2>Start with the destination</h2>
<p>Select this episode's requirements on the episode page. <b>General Streaming</b> follows the supplied internal checklist. <b>Filmhub Delivery</b> is for Filmhub, a distributor that can place titles with streaming services; choose it only when this episode is actually going through Filmhub. <b>Custom / Contract</b> is for any other buyer's signed specification.</p>
<p>Requirements are intentionally not blended together: bitrate, native frame rate, artwork, captions, and CTA rules stay attached to their own platform profile.</p>` },
  { id: 'metadata', icon: ICON.data, name: 'Metadata Sheet', summary: 'Fill, validate, copy, and export all 18 spreadsheet columns.', details: `
<h2>One reusable episode record</h2>
<p>The internal sheet below mirrors the supplied spreadsheet columns in the same order. It auto-saves locally, validates the rules visible in the sheet, and exports one CSV row for direct import or copy/paste.</p>
<p><b>Manual verification remains important:</b> confirm the IMDb listing and distributor credit, names, rights, dates, links, and exact destination dropdown vocabulary.</p>` },
  { id: 'texted', icon: ICON.video, name: 'Clean Program Master', summary: 'QC the final clean video/audio against the selected platform preset.', notionProp: 'Texted Video', intake: { accept: ['mov', 'mp4', 'mxf', 'mkv', 'ts', 'mpg', 'mpeg', 'ogg'], sub: '01 Clean Master', check: 'video' }, details: `
<h2>Program-only delivery master</h2>
<p>Export the final program with <b>no broadcast bars, slate, tone, leader, cards, or textless tail</b>. Use minimal black at the head/tail. The exact codec, bitrate, frame-rate, timecode, and audio checks come from the selected platform profile shown below.</p>
<p>The app checks machine-readable properties. You must still watch and listen to the final file end to end.</p>` },
  { id: 'captions', icon: ICON.captions, name: 'Captions & Accessibility', summary: 'SRT/VTT/SCC structure checks plus clearly marked human quality review.', notionProp: 'Closed Captions', intake: { accept: ['srt', 'vtt', 'scc'], sub: '02 Captions', check: 'captions', multi: true }, details: `
<h2>Timed to the final program</h2>
<p>Caption time starts with the clean program - do not add the old +1 hour broadcast offset. The selected platform decides accepted formats. Automated review checks event structure, line length, duration, spacing, and reading speed where the format exposes them.</p>
<p><b>MANUAL:</b> review accuracy, SDH completeness, spelling, punctuation, placement, and sync against the exact final delivered video.</p>` },
  { id: 'artwork', icon: ICON.art, name: 'Artwork & Key Art', summary: 'Required platform slots, file assignment, dimension checks, and layered sources.', details: `
<h2>Platform-specific artwork package</h2>
<p>The artwork board below changes with the selected platform. Assign each file to its intended slot; the app checks image dimensions and keeps required versus recommended assets distinct.</p>
<p>Layered sources are retained internally for reformatting and localization. Filmhub upload assets themselves must be flat JPEG/PNG; its layered working file is an optional internal archive.</p>` },
  { id: 'compliance', icon: ICON.compliance, name: 'Content Restrictions & Ad Breaks', summary: 'Confirm none are present, or review sponsors, CTAs, URLs, promos, and break points.', details: `
<h2>Usually a quick “none” check</h2>
<p>Most episodes will have no integrated sponsor message, call to action, URL, or promotion. If so, use the one-click <b>Nothing present</b> option below. If anything is present, record what it is and confirm that the selected destination allows it.</p>
<p>Enter frame-accurate ad-break or chapter timecodes only when needed; otherwise mark them N/A. This review comes after the clean master because it must describe the exact video being delivered.</p>` },
  { id: 'deliver', icon: ICON.deliver, name: 'QC Gates & Delivery', summary: 'One completion board for video, captions, art, metadata, compliance, and handoff.', details: `
<h2>Completion is a package, not one green video check</h2>
<p>Every required gate is shown below. Machine-readable checks and human judgment are deliberately labeled separately. Resolve or explicitly review every item before marking the episode Distribution Ready.</p>
<p>Confirm the actual portal/FTP/API destination and naming rules when the deal closes; never assume one platform's package matches another's.</p>` },
  { id: 'broadcast', optional: true, icon: ICON.optional, name: 'Broadcast Master Builder', summary: 'Build the retained full technical master whenever this episode needs one.', intake: { accept: ['mov'], sub: '90 Optional/Broadcast Master', check: 'broadcast-source' }, details: '<h2>Full broadcast package remains available</h2><p>Load a program-only ProRes 422 HQ master with the 16-track audio layout. The builder can add bars, tone, slate, black, timecode, and an optional textless tail. This tool is available on every episode; using it is your choice based on the delivery or archive need.</p>' },
  { id: 'paperwork', optional: true, icon: ICON.optional, name: 'Paperwork & Documents', summary: 'Create or collect cue sheets, credits, scripts, rights, and supporting documents.', intake: { accept: ['pdf', 'docx', 'doc', 'xlsx', 'xls'], sub: '90 Optional/Paperwork', check: 'ext', multi: true }, details: '<h2>Supporting documents</h2><p>Create or collect paperwork whenever a buyer, insurer, or internal archive needs it. Paperwork stays available on every episode without blocking a basic streaming package.</p>' },
  { id: 'timings', optional: true, icon: ICON.optional, name: 'Timing Data', summary: 'Generate segment, content, or advertising timing CSV files when needed.', intake: { accept: ['csv', 'txt'], sub: '90 Optional/Timing Data', check: 'timings' }, details: '<h2>Timing data</h2><p>Detailed timing exports remain available for any delivery that needs them. They do not block destinations that only need a clean program runtime.</p>' },
  { id: 'renderfarm', optional: true, icon: ICON.optional, name: 'Render Farm', summary: 'Run the existing After Effects batch tools for alternate graphics.', details: '<h2>Graphics automation</h2><p>Use this whenever the episode needs alternate graphics, text-off renders, or batch output. It is available independently of the selected streaming profile.</p>' },
  { id: 'textless', optional: true, icon: ICON.optional, name: 'Textless Version', summary: 'Create, verify, and file a textless version whenever needed.', notionProp: 'Textless Video', intake: { accept: ['mov'], sub: '90 Optional/Textless', check: 'video' }, details: '<h2>Textless version</h2><p>The XML, render-farm, OCR, QC, and broadcast-wrap tools remain available here. Add a broadcast leader only when the relevant delivery specification requires one.</p>' },
  { id: 'textless_nogfx', optional: true, icon: ICON.optional, name: 'Clean Plate / No Graphics', summary: 'Create a version with graphics completely removed.', notionProp: 'Textless No Graphics', intake: { accept: ['mov'], sub: '90 Optional/Clean Plate', check: 'video' }, details: '<h2>Clean plate</h2><p>Use this for a no-graphics version whenever a buyer, localization workflow, or archive needs one.</p>' },
  { id: 'stems', optional: true, icon: ICON.optional, name: 'ProRes & Audio Stems', summary: 'Build the retained 16-track master and 60 separate audio files.', notionProp: 'Audio Stems', intake: { accept: ['wav'], sub: '90 Optional/Audio Stems', check: 'wav', multi: true }, details: '<h2>Broadcast and archive audio</h2><p>The complete 16-track and 60-sidecar workflow remains intact and available on every episode. It is separate from the simpler stereo streaming-master requirement.</p>' },
];

module.exports = { STAGES };
