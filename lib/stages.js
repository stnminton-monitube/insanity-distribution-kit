// The guided distribution workflow — stage definitions with drill-in detail pages.
// Specs are strong defaults for traditional media distribution (broadcast/international).
// Always confirm the specific distributor's requirements.

const { ANCILLARY } = require('./checklist');

// Inline SVG stage icons (no icon-font/library dependency — just static markup,
// consistent with this app's "no new deps" convention). currentColor so each
// inherits whatever color context it's placed in.
const svgIcon = (viewBox, body) => `<svg viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
const ICON = {
  prep: svgIcon('0 0 20 20',
    '<rect x="3" y="8" width="14" height="9" rx="1" stroke="currentColor" stroke-width="1.5"/>' +
    '<path d="M3 8l1.5-4h12L18 8" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' +
    '<path d="M5.5 4l1.5 4M9.5 4L11 8M13.5 4L15 8" stroke="currentColor" stroke-width="1.2"/>'),
  texted: svgIcon('0 0 20 20',
    '<rect x="3" y="3" width="14" height="14" rx="1" stroke="currentColor" stroke-width="1.5"/>' +
    '<line x1="7" y1="3" x2="7" y2="17" stroke="currentColor" stroke-width="1.2"/><line x1="13" y1="3" x2="13" y2="17" stroke="currentColor" stroke-width="1.2"/>' +
    '<line x1="3" y1="7" x2="7" y2="7" stroke="currentColor" stroke-width="1.2"/><line x1="3" y1="13" x2="7" y2="13" stroke="currentColor" stroke-width="1.2"/>' +
    '<line x1="13" y1="7" x2="17" y2="7" stroke="currentColor" stroke-width="1.2"/><line x1="13" y1="13" x2="17" y2="13" stroke="currentColor" stroke-width="1.2"/>'),
  // A frame around a struck-through "T" reads as "text removed from picture"
  // more clearly than a bare glyph — the frame gives it context.
  textless: svgIcon('0 0 20 20',
    '<rect x="3" y="3" width="14" height="14" rx="1.5" stroke="currentColor" stroke-width="1.5"/>' +
    '<path d="M7.5 7.5h5M10 7.5v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
    '<line x1="4" y1="16" x2="16" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'),
  // The standard "broken image" glyph (frame + sun + mountain) with a slash —
  // an already-universal "no image" pattern, distinct from the textless "T".
  textless_nogfx: svgIcon('0 0 20 20',
    '<rect x="3" y="3" width="14" height="14" rx="1.5" stroke="currentColor" stroke-width="1.5"/>' +
    '<circle cx="7.5" cy="7.5" r="1.3" stroke="currentColor" stroke-width="1.3"/>' +
    '<path d="M4 14l4-4 3 3 3-3.5 3 4.5" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" fill="none"/>' +
    '<line x1="4" y1="16" x2="16" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'),
  stems: svgIcon('0 0 20 20',
    '<line x1="5" y1="3" x2="5" y2="17" stroke="currentColor" stroke-width="1.5"/><line x1="10" y1="3" x2="10" y2="17" stroke="currentColor" stroke-width="1.5"/><line x1="15" y1="3" x2="15" y2="17" stroke="currentColor" stroke-width="1.5"/>' +
    '<rect x="3" y="6" width="4" height="2.5" rx="1" fill="currentColor"/><rect x="8" y="11" width="4" height="2.5" rx="1" fill="currentColor"/><rect x="13" y="4" width="4" height="2.5" rx="1" fill="currentColor"/>'),
  captions: svgIcon('0 0 20 20',
    '<path d="M3 5a2 2 0 012-2h10a2 2 0 012 2v6a2 2 0 01-2 2H8l-4 3v-3H5a2 2 0 01-2-2V5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'),
  timings: svgIcon('0 0 20 20',
    '<circle cx="10" cy="11" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M10 7v4l3 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="8" y1="2" x2="12" y2="2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'),
  paperwork: svgIcon('0 0 20 20',
    '<path d="M6 3h6l3 3v11a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 3v3h3" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><line x1="7" y1="10" x2="13" y2="10" stroke="currentColor" stroke-width="1.2"/><line x1="7" y1="13" x2="13" y2="13" stroke="currentColor" stroke-width="1.2"/>'),
  // A GPU/rack glyph — distinct from the document-ish "prep" icon, reads as
  // "send this off to a machine" rather than "work done at your desk."
  renderfarm: svgIcon('0 0 20 20',
    '<rect x="3" y="4" width="14" height="4.5" rx="1" stroke="currentColor" stroke-width="1.5"/>' +
    '<rect x="3" y="11.5" width="14" height="4.5" rx="1" stroke="currentColor" stroke-width="1.5"/>' +
    '<circle cx="6" cy="6.25" r="0.9" fill="currentColor"/><circle cx="6" cy="13.75" r="0.9" fill="currentColor"/>' +
    '<path d="M14 10.5v-1M14 10.5h-3M14 10.5h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>'),
  deliver: svgIcon('0 0 20 20',
    '<path d="M10 3l7 3.5v7L10 17l-7-3.5v-7L10 3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M3.5 6.5L10 10l6.5-3.5M10 10v7" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'),
  warning: svgIcon('0 0 20 20',
    '<path d="M10 3l8 14H2L10 3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M10 8v4M10 14.5v.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'),
};

// The paperwork stage's doc list is generated from checklist.js (the spec mirror)
// rather than hand-written, so it can't drift from DELIVERABLES.md again.
const authoredDocsList = ANCILLARY.filter(a => a.source === 'app' || a.source === 'draft')
  .map(a => `<li>${a.name}${a.note ? ` — <span class="muted">${a.note}</span>` : ''}</li>`).join('\n');
const collectDocsList = ANCILLARY.filter(a => a.source === 'collect')
  .map(a => `<li>${a.name}${a.note ? ` — <span class="muted">${a.note}</span>` : ''}</li>`).join('\n');

const STAGES = [
  {
    id: 'prep',
    icon: ICON.prep,
    name: 'Prep & Export',
    summary: 'Finish the edit, check content rules, export from Premiere.',
    notionProp: null,
    intake: null,
    details: `
<h2>Before you export</h2>
<ul>
<li><b>Title safe:</b> keep all on-screen text and crucial visuals inside the center <b>80%</b> of frame — edges get cropped on some broadcasts.</li>
<li><b>Content rules:</b> no advertisements, no burned-in captions, no QuickTime edit lists, no visible digital breakup/pixelation, no dirty edges. Sponsorship is OK only when it's a creative part of the program.</li>
<li><b>Censored by default:</b> deliver the censored version as the primary master. If you also deliver uncensored, label it clearly.</li>
</ul>
<h2>Premiere export settings (texted master)</h2>
<ul>
<li>Format: <b>QuickTime</b> (.mov) — never MP4 for masters</li>
<li>Codec: <b>Apple ProRes 422 HQ</b> at 1920x1080, or <b>Apple ProRes 4444 XQ</b> at 3840x2160</li>
<li>16:9, square pixels, <b>progressive</b></li>
<li>Frame rate: <b>23.976, 29.97, or 59.94</b> — match your source</li>
<li>Color: <b>Rec. 709</b> for SDR (HDR uses BT.2100/PQ or HLG — a different checklist)</li>
<li>Audio: <b>16 mono tracks</b>, PCM 48kHz/24-bit, in the standard order (see Audio Stems stage)</li>
<li>Include a timecode track</li>
</ul>
<h2>Segments</h2>
<p>Episodic content gets <b>2 seconds of black between program segments</b> (where ad breaks fall). A segment ends at the last frame of picture or audio fade-out — whichever is later. Audio below -60dBFS counts as silence. A two-hour episode airing seamlessly is delivered as <b>two one-hour files</b>, each fully formatted.</p>`,
  },
  {
    id: 'renderfarm',
    icon: ICON.renderfarm,
    name: 'Render Farm',
    summary: 'Batch-send AE graphics to the render farm — texted, text off, or both.',
    notionProp: null,
    intake: null,
    details: `
<h2>What this stage does</h2>
<p>Scans a folder for After Effects projects and queues them on the render farm through one shared relay — this app never holds a Notion or Dropbox credential itself. Each project is a single row in that project's <b>MGX:</b> Notion database; <b>texted</b> and <b>text off</b> are tracked as two independent statuses on that same row, so you can queue either or both together in one batch.</p>
<h2>How text off works</h2>
<p>For a text-off render, the app first opens the project locally just to disable its text layers — real text layers are auto-detected; baked-in text needs a <b>TXT_</b> prefix or label color <b>9 (green)</b> to be caught — and saves a <b>_TEXTLESS.aep</b> copy beside the original. The render farm then renders whichever file each status points at. Projects with no text layers are skipped for the text-off pass.</p>
<h2>Before you start</h2>
<p>Set up the relay URL and token once in <a href="#" onclick="go('settings')">Settings</a>. Once queued, renders happen on the farm in the background — you don't need to wait here. Come back to the <b>Texted Master</b> and <b>Textless</b> stages once your renders are done to build and verify the actual delivery masters.</p>`,
  },
  {
    id: 'texted',
    icon: ICON.texted,
    name: 'Texted Master',
    summary: 'Drop your export → QC → optionally wrap head/tail → file to Dropbox.',
    notionProp: 'Texted Video',
    intake: { accept: ['mov'], sub: '01 Master', check: 'video' },
    details: `
<h2>What this stage does</h2>
<p>Drop your Premiere export below. The app QCs it against the master spec, then files it into this episode's Distribution folder and updates Notion.</p>
<h2>The master spec</h2>
<table>
<tr><th></th><th>Ultra HD</th><th>Full HD</th></tr>
<tr><td>Codec</td><td>ProRes 4444 XQ</td><td>ProRes 422 HQ</td></tr>
<tr><td>Resolution</td><td>3840x2160</td><td>1920x1080</td></tr>
<tr><td>Bit depth / chroma</td><td>12-bit 4:4:4</td><td>10-bit 4:2:2</td></tr>
<tr><td>Frame rate</td><td colspan="2">23.976 / 29.97 / 59.94, progressive</td></tr>
<tr><td>Color</td><td colspan="2">Rec. 709 legal range (SDR)</td></tr>
<tr><td>Audio</td><td colspan="2">16 mono PCM tracks, 48kHz/24-bit</td></tr>
</table>
<h2>Broadcast head/tail — yes, every master</h2>
<p>Traditional broadcast masters are wrapped: <b>30s black → 30s bars + 1kHz -20dB tone → 30s slate → 30s black → program starts at timecode 01:00:00:00</b>, then a tail (2s black, or the full textless block). This applies to <i>every</i> master, not just long ones. The app's <b>Build broadcast master</b> button does this for you without re-encoding your program. Streaming-only deliveries often want a clean file instead — check your distributor.</p>
<p>The slate the app generates lists: title, episode, season/episode number, show code, production company, codec, resolution, frame rate, color space, total runtime, creation date, and the audio track layout.</p>`,
  },
  {
    id: 'textless',
    icon: ICON.textless,
    name: 'Textless Version',
    summary: 'Same footage, all on-screen text removed. Deliver same day as texted.',
    notionProp: 'Textless Video',
    intake: { accept: ['mov'], sub: '02 Textless', check: 'video' },
    details: `
<h2>Why textless exists</h2>
<p>International buyers replace your on-screen text (titles, credits, lower thirds, forced subtitles, translated captions) with their own language. Textless is the same picture with all of that removed. <b>Most distributors reject a master that has text on picture but no textless material — and expect it the same day as the texted file.</b></p>
<h2>Two ways to deliver</h2>
<ol>
<li><b>Scenes at the tail</b> of the texted master: 60s black → 5s "Textless Materials" slate → 60s black → textless scenes with 2s black between → 2s black.</li>
<li><b>A standalone file (recommended in this app)</b> — identical length, format, and specs to the texted master, program material textless. The app's builder handles this cleanly: its slate reads <b>"TEXTLESS VERSION"</b> per spec (a texted slate says "Textless at Tail" instead, when applicable), and the audio layout matches the texted program.</li>
</ol>
<h2>Gotchas</h2>
<ul>
<li>Text sitting on a graphic (e.g. an on-screen text-message bubble)? Provide <b>both</b>: textless with the graphic, and fully clean without it.</li>
<li>Keep a <b>log</b> of every texted moment: timecode (HH:MM:SS:FF) + scene description, as a DOCX — file it with the paperwork.</li>
</ul>`,
  },
  {
    id: 'textless_nogfx',
    icon: ICON.textless_nogfx,
    name: 'Textless — No Graphics',
    summary: 'Fully clean plate: no text, no graphics. Only when text sits on a graphic.',
    notionProp: 'Textless No Graphics',
    intake: { accept: ['mov'], sub: '02 Textless/No Graphics', check: 'video' },
    details: `
<h2>When this is required</h2>
<p>Only when a texted moment sits <b>on a graphic</b> (e.g. an on-screen text-message bubble, a graphic with a title baked in). The Textless stage's standalone file removes the text but keeps the graphic underneath; this stage goes one step further and removes the graphic too, leaving a fully clean plate. If nothing in the episode has text on a graphic, this stage doesn't apply — mark it N/A.</p>
<h2>Spec</h2>
<p>Identical specs, length, and 16-track audio layout to the texted master — only the picture differs. Same broadcast head/tail as every other master, and the same <b>"TEXTLESS VERSION"</b> slate as the plain Textless stage. Deliver same day as texted.</p>
<h2>Where it comes from</h2>
<p>The Textless stage's "make clean XML" tool (also available on this stage) strips graphics-layer clips from your sequence XML entirely, rather than swapping in a textless version of them — export that sequence to get this file.</p>`,
  },
  {
    id: 'stems',
    icon: ICON.stems,
    name: 'Audio Stems',
    summary: 'Mono WAVs: full mix, M&E, dialogue, music, effects. App checks format.',
    notionProp: 'Audio Stems',
    intake: { accept: ['wav'], sub: '03 Audio Stems', check: 'wav', multi: true },
    details: `
<h2>The 16-track embedded layout (inside the master)</h2>
<p>1–6: 5.1 full mix (L, R, C, LFE, Ls, Rs) · 7–8: stereo full mix (Lt/Rt) · 9–10: effects · 11–12: music · 13–14: music & effects · 15: narration (silent if none) · 16: mono full mix.</p>
<h2>Sidecar WAV stems (what you drop here)</h2>
<p>Separate <b>mono</b> WAV files, PCM 48kHz/24-bit. The standard grid:</p>
<table>
<tr><th>Stem</th><th>5.1</th><th>2.0</th><th>1.0</th></tr>
<tr><td>Full Mix (printmaster)</td><td>✓</td><td>✓</td><td>✓</td></tr>
<tr><td>Music & Effects</td><td>✓</td><td>✓</td><td>—</td></tr>
<tr><td>Dialogue</td><td>✓</td><td>✓</td><td>✓</td></tr>
<tr><td>Music</td><td>✓</td><td>✓</td><td>—</td></tr>
<tr><td>Effects</td><td>✓</td><td>✓</td><td>✓</td></tr>
<tr><td>Mix Minus Narration*</td><td>✓</td><td>✓</td><td>—</td></tr>
<tr><td>Narration*</td><td>✓</td><td>✓</td><td>✓</td></tr>
</table>
<p>* only if the content has narration.</p>
<h2>M&E rules — the big one</h2>
<p>The <b>Music & Effects</b> mix must contain <b>no dialogue</b> — it's what dubbing studios build foreign versions on. For scripted content it must be <b>fully filled</b>: sounds that lived on the dialogue tracks (footsteps, cloth, breaths) must be rebuilt so the dub sounds complete. Head/tail formatting of WAVs matches the master; scripted features deliver stems seamless (no segment breaks).</p>`,
  },
  {
    id: 'captions',
    icon: ICON.captions,
    name: 'Closed Captions',
    summary: 'SCC required; pop-on, synced, UTF-8. Other formats optional extras.',
    notionProp: 'Closed Captions',
    intake: { accept: ['scc', 'srt', 'stl', 'cap', 'vtt'], sub: '04 Captions', check: 'ext', multi: true },
    details: `
<h2>Requirements</h2>
<ul>
<li><b>SCC</b> (EIA-608) is the required format — SRT, CAP, STL, VTT are welcome extras</li>
<li><b>Pop-on</b> style only (no roll-up, no paint-on)</li>
<li>In sync with program audio; same frame rate & timecode as the master where possible</li>
<li>UTF-8 encoded</li>
</ul>
<h2>Must NOT</h2>
<ul>
<li>Contain ads or sponsorship tags (caption-creation credits are the one exception)</li>
<li>Cover readable on-screen text or faces</li>
<li>Bleed into black outside the program</li>
</ul>
<p>The app checks file type here; caption sync and styling still need a human pass in a caption tool.</p>`,
  },
  {
    id: 'timings',
    icon: ICON.timings,
    name: 'Segment Timings',
    summary: 'Frame-accurate CSV of every segment: in, out, duration.',
    notionProp: 'Segment Timings',
    intake: { accept: ['csv', 'txt'], sub: '05 Segment Timings', check: 'timings' },
    details: `
<h2>What it is</h2>
<p>A CSV listing the in-point, out-point, and duration of every program segment, frame-accurate, using the master's timecode. Required for segmented <i>and</i> seamless content.</p>
<h2>Template</h2>
<table>
<tr><th>Marker Name</th><th>Description</th><th>In</th><th>Out</th><th>Duration</th><th>Marker Type</th></tr>
<tr><td></td><td></td><td>01:00:00:00</td><td>01:06:58:23</td><td>00:06:58:23</td><td>Comment</td></tr>
<tr><td></td><td></td><td>01:07:00:23</td><td>01:11:56:16</td><td>00:04:55:17</td><td>Comment</td></tr>
</table>
<p>Out-points may be inclusive or exclusive. Values may be tab-separated with a .csv extension. Tip: Premiere sequence markers exported via marker export get you most of the way.</p>`,
  },
  {
    id: 'paperwork',
    icon: ICON.paperwork,
    name: 'Paperwork',
    summary: 'Scripts, credits, music docs, restrictions — tracked in the Notion row.',
    notionProp: null,
    intake: { accept: ['pdf', 'docx', 'doc', 'xlsx', 'xls'], sub: '06 Docs', check: 'ext', multi: true },
    details: `
<h2>Documents you draft or author here</h2>
<ul>
${authoredDocsList}
</ul>
<p>Drop the exported PDFs below to file them into the episode's <b>06 Docs</b> folder.</p>
<h2>Documents you collect from a vendor</h2>
<ul>
${collectDocsList}
</ul>
<p>These aren't authored in-app — track their order/received status in the Collect panel below, and file the received PDFs the same way.</p>`,
  },
  {
    id: 'deliver',
    icon: ICON.deliver,
    name: 'Package & Deliver',
    summary: 'Final review, upload, confirm — then mark Distribution Ready.',
    notionProp: null,
    intake: null,
    details: `
<h2>Final checks before upload</h2>
<ul>
<li>Everything in the episode's Distribution folder, nothing missing (masters, textless, stems, captions, timings, docs)</li>
<li><b>Never deliver a ZIP</b> — most intake systems auto-reject them</li>
<li>Apply your distributor's <b>naming conventions</b> — get their spec sheet before uploading</li>
<li>Upload at least <b>5 business days before air</b> — the standard buffer</li>
<li>Textless delivered same day as texted</li>
</ul>
<h2>After upload</h2>
<ul>
<li>Watch for the distributor's QC report — fix and redeliver fast if anything bounces</li>
<li>When confirmed, hit the button below to set this episode to <b>Distribution Ready</b> in Notion</li>
</ul>
<h2 style="display:flex;align-items:center;gap:7px"><span style="width:16px;height:16px;display:inline-flex;color:var(--warn)">${ICON.warning}</span> What this app does NOT check — your human checklist</h2>
<p>The app verifies everything machine-readable. These stay on you:</p>
<ul>
<li><b>Watch the masters down</b> — picture quality, breakup, dirty edges, censorship, title safe are visual judgments</li>
<li><b>Audio track ORDER</b> — the app counts 16 mono tracks but can't hear that track 3 is really Center or track 11 is Music-Left</li>
<li><b>Listen to the M&E</b> — confirm zero dialogue and that it's fully filled</li>
<li><b>Textless completeness</b> — scrub the textless against your Lower Thirds/Textless logs: every texted moment covered?</li>
<li><b>Caption sync & styling</b> — the app checks file type only; verify sync and pop-on styling in a caption tool</li>
<li><b>Timings accuracy</b> — spot-check the CSV timecodes against the actual master</li>
<li><b>Document truth</b> — templates format your docs beautifully; the facts, clearances, and signatures are yours</li>
<li><b>Naming conventions & upload</b> — apply the distributor's naming and do the upload yourself</li>
</ul>`,
  },
];

module.exports = { STAGES };
