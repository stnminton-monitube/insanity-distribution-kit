// Compact guided path for the platform-first workflow.
const diagram = (left, right) => `<svg viewBox="0 0 720 92" xmlns="http://www.w3.org/2000/svg">
  <rect x="24" y="22" width="260" height="48" rx="8" fill="var(--panel2)" stroke="var(--accent)"/>
  <text x="154" y="51" text-anchor="middle" fill="var(--text)" font-size="13" font-family="-apple-system,Segoe UI,sans-serif">${left}</text>
  <path d="M310 46h92m-12-9 12 9-12 9" fill="none" stroke="var(--dim)" stroke-width="2"/>
  <rect x="428" y="22" width="268" height="48" rx="8" fill="var(--panel2)" stroke="var(--pass)"/>
  <text x="562" y="51" text-anchor="middle" fill="var(--text)" font-size="13" font-family="-apple-system,Segoe UI,sans-serif">${right}</text>
</svg>`;

const GUIDE_STEPS = [
  { id: 'target', phase: 'A · Define', title: 'Choose the delivery requirements', body: 'Use General Streaming for the supplied internal checklist, Filmhub Delivery only when going through Filmhub, or Custom / Contract for another buyer. Read the displayed profile before creating assets; requirements do not carry across delivery routes.', svg: diagram('Deal or internal request', 'One requirements profile'), stage: 'targets' },
  { id: 'metadata', phase: 'A · Define', title: 'Complete all 18 metadata columns', body: 'Fill the internal metadata sheet. Resolve every inline validation issue, verify the IMDb/distributor information manually, then export the CSV or copy the tab-separated row into the shared sheet.', svg: diagram('Episode facts', 'Validated 18-column row'), stage: 'metadata' },
  { id: 'master', phase: 'B · Assets', title: 'Export and QC the clean program master', body: 'Export program only: no bars, tone, slate, leader, or textless tail. Drop the exact final file into Clean Program Master; the checks use the selected platform preset. Watch and listen to it end to end.', svg: diagram('Final timeline', 'Clean platform master'), stage: 'texted' },
  { id: 'captions', phase: 'B · Assets', title: 'Check captions against the final program', body: 'Use the platform-supported caption format, timed from program start. Resolve automated structural findings, then manually review SDH completeness, accuracy, sync, spelling, punctuation, and placement.', svg: diagram('SRT / VTT / SCC', 'Machine + human review'), stage: 'captions' },
  { id: 'artwork', phase: 'B · Assets', title: 'Fill every required artwork slot', body: 'Assign artwork by purpose, not filename guesswork. Pass dimension/aspect-ratio checks and retain layered source files when the selected profile calls for them. Visually inspect safe zones, title treatment, and textless rules.', svg: diagram('Layered creative', 'Platform-sized exports'), stage: 'artwork' },
  { id: 'compliance', phase: 'C · Review', title: 'Confirm content restrictions and ad breaks', body: 'For the usual case, confirm that the final video has no sponsor reads, URLs, promos, or calls to action and mark breaks N/A. If any are present, review them against the selected destination and log the applicable break timecodes.', svg: diagram('Final program review', 'None, or reviewed exceptions'), stage: 'compliance' },
  { id: 'gates', phase: 'C · Review', title: 'Complete the delivery gates', body: 'Use the final board to review video, captions, artwork, metadata, ads, naming, rights, and delivery method together. MANUAL gates always require a person; the app does not auto-approve judgment calls.', svg: diagram('All asset groups', 'One completion decision'), stage: 'deliver' },
  { id: 'deliver', phase: 'D · Deliver', title: 'Package for this platform and confirm delivery', body: 'Apply the target naming convention, upload by its portal/FTP/API method, and respond to QC. Only mark Distribution Ready after every required gate is complete. Advanced paperwork, broadcast-master, timing, textless, stems, and SCC tools remain available on every episode whenever you need them.', svg: diagram('Platform package', 'Accepted / Distribution Ready'), stage: 'deliver' },
];

module.exports = { GUIDE_STEPS };
