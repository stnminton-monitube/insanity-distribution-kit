// Guided Mode — the complete delivery runbook, one gated step at a time,
// written for someone who has never delivered a show. Every step has a diagram.

// ---------- tiny SVG helpers ----------
const F = 'font-family="sans-serif"';
const svg = (h, title, inner) => `<svg viewBox="0 0 720 ${h}" xmlns="http://www.w3.org/2000/svg" role="img" style="width:100%;height:auto"><title>${title}</title>${inner}</svg>`;
const box = (x, y, w, h, stroke, label, sub, fillTxt) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="var(--panel2)" stroke="${stroke}"/>` +
  `<text x="${x + w / 2}" y="${y + (sub ? h / 2 - 2 : h / 2 + 4)}" fill="${fillTxt || 'var(--text)'}" font-size="11" text-anchor="middle" ${F}>${label}</text>` +
  (sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 13}" fill="var(--dim)" font-size="9" text-anchor="middle" ${F}>${sub}</text>` : '');
const arrow = (x1, x2, y, lbl) =>
  `<path d="M${x1} ${y} L${x2 - 7} ${y}" stroke="var(--dim)" stroke-width="1.5"/><path d="M${x2 - 7} ${y - 4} L${x2} ${y} L${x2 - 7} ${y + 4}" fill="var(--dim)"/>` +
  (lbl ? `<text x="${(x1 + x2) / 2}" y="${y - 9}" fill="var(--dim)" font-size="9" text-anchor="middle" ${F}>${lbl}</text>` : '');
const cap = (y, text) => `<text x="360" y="${y}" fill="var(--dim)" font-size="11" text-anchor="middle" ${F}>${text}</text>`;
// evenly spaced flow of boxes
function flow(h, title, items, capText) {
  const n = items.length, gap = 34, w = Math.min(150, Math.floor((700 - gap * (n - 1)) / n));
  const total = w * n + gap * (n - 1), x0 = Math.floor((720 - total) / 2);
  let out = '';
  items.forEach((it, i) => {
    const x = x0 + i * (w + gap);
    out += box(x, 24, w, 44, it.c || 'var(--line)', it.t, it.s, it.tc);
    if (i < n - 1) out += arrow(x + w, x + w + gap, 46, items[i + 1].a);
  });
  if (capText) out += cap(h - 8, capText);
  return svg(h, title, out);
}

// ---------- diagrams ----------
const D = {};

D.brands = svg(96, 'Remove sponsor content',
  `<rect x="10" y="30" width="150" height="34" rx="5" fill="var(--accent)" opacity="0.8"/><text x="85" y="51" fill="#fff" font-size="11" text-anchor="middle" ${F}>story</text>` +
  `<rect x="164" y="30" width="90" height="34" rx="5" fill="var(--fail)"/><text x="209" y="51" fill="#fff" font-size="11" text-anchor="middle" ${F}>$ SPONSOR</text>` +
  `<line x1="164" y1="30" x2="254" y2="64" stroke="#fff" stroke-width="3"/><line x1="254" y1="30" x2="164" y2="64" stroke="#fff" stroke-width="3"/>` +
  `<rect x="258" y="30" width="150" height="34" rx="5" fill="var(--accent)" opacity="0.8"/><text x="333" y="51" fill="#fff" font-size="11" text-anchor="middle" ${F}>story</text>` +
  arrow(420, 470, 47, 'cut it') +
  `<rect x="474" y="30" width="236" height="34" rx="5" fill="var(--pass)" opacity="0.85"/><text x="592" y="51" fill="#04250f" font-size="11" text-anchor="middle" ${F}>clean program — declarations stay true</text>` +
  cap(88, 'Every paid promo, sponsor read, and trade-out comes out before anything else happens'));

D.segments = svg(96, 'Segments with 2-second blacks',
  `<rect x="10" y="28" width="190" height="34" rx="5" fill="var(--accent)" opacity="0.85"/>` +
  `<rect x="204" y="28" width="10" height="34" fill="#000" stroke="var(--line)"/>` +
  `<rect x="218" y="28" width="190" height="34" rx="5" fill="var(--accent)" opacity="0.85"/>` +
  `<rect x="412" y="28" width="10" height="34" fill="#000" stroke="var(--line)"/>` +
  `<rect x="426" y="28" width="190" height="34" rx="5" fill="var(--accent)" opacity="0.85"/>` +
  `<rect x="620" y="28" width="10" height="34" fill="#000" stroke="var(--line)"/>` +
  `<rect x="634" y="28" width="76" height="34" rx="5" fill="var(--accent)" opacity="0.85"/>` +
  `<text x="105" y="49" fill="#fff" font-size="13" text-anchor="middle" ${F}>SEGMENT 1</text>` +
  `<text x="313" y="49" fill="#fff" font-size="13" text-anchor="middle" ${F}>SEGMENT 2</text>` +
  `<text x="521" y="49" fill="#fff" font-size="13" text-anchor="middle" ${F}>SEGMENT 3</text>` +
  `<text x="672" y="49" fill="#fff" font-size="12" text-anchor="middle" ${F}>SEG 4</text>` +
  `<text x="209" y="18" fill="var(--warn)" font-size="11" text-anchor="middle" ${F}>2s black</text>` +
  `<text x="417" y="18" fill="var(--warn)" font-size="11" text-anchor="middle" ${F}>2s black</text>` +
  `<text x="625" y="18" fill="var(--warn)" font-size="11" text-anchor="middle" ${F}>2s black</text>` +
  cap(84, 'TV inserts ad breaks at the blacks — viewers see commercials there, never black. Your creative fades inside segments stay untouched.'));

D.creditroll = flow(94, 'End credit roll — cut into the picture', [
  { t: 'Last program segment', s: 'your final scene', c: 'var(--accent)' },
  { t: 'End credit roll', s: 'cast, crew, legal card', a: '', c: 'var(--pass)' },
  { t: '2s tail', s: 'or textless block', c: 'var(--line)' },
], 'This is PICTURE — cut into the video itself. The paperwork Credits document (names & roles) is a separate deliverable.');

D.markers = svg(92, 'Duration markers spanning each segment',
  `<rect x="10" y="10" width="190" height="12" rx="6" fill="var(--pass)" opacity="0.9"/>` +
  `<rect x="218" y="10" width="190" height="12" rx="6" fill="var(--pass)" opacity="0.9"/>` +
  `<rect x="426" y="10" width="190" height="12" rx="6" fill="var(--pass)" opacity="0.9"/>` +
  `<text x="105" y="20" fill="#08351d" font-size="10" text-anchor="middle" ${F}>MARKER 1 (duration)</text>` +
  `<text x="313" y="20" fill="#08351d" font-size="10" text-anchor="middle" ${F}>MARKER 2</text>` +
  `<text x="521" y="20" fill="#08351d" font-size="10" text-anchor="middle" ${F}>MARKER 3</text>` +
  `<rect x="10" y="34" width="190" height="30" rx="5" fill="var(--accent)" opacity="0.8"/>` +
  `<rect x="204" y="34" width="10" height="30" fill="#000" stroke="var(--line)"/>` +
  `<rect x="218" y="34" width="190" height="30" rx="5" fill="var(--accent)" opacity="0.8"/>` +
  `<rect x="412" y="34" width="10" height="30" fill="#000" stroke="var(--line)"/>` +
  `<rect x="426" y="34" width="190" height="30" rx="5" fill="var(--accent)" opacity="0.8"/>` +
  `<text x="105" y="53" fill="#fff" font-size="12" text-anchor="middle" ${F}>SEGMENT 1</text>` +
  `<text x="313" y="53" fill="#fff" font-size="12" text-anchor="middle" ${F}>SEGMENT 2</text>` +
  `<text x="521" y="53" fill="#fff" font-size="12" text-anchor="middle" ${F}>SEGMENT 3</text>` +
  cap(84, 'marker in = segment start · marker out = segment end → the app turns these into the timings file automatically'));

D.contentpass = svg(150, 'Title safe area',
  `<rect x="210" y="14" width="300" height="118" rx="4" fill="#000" stroke="var(--line)"/>` +
  `<rect x="240" y="26" width="240" height="94" rx="3" fill="none" stroke="var(--pass)" stroke-dasharray="5 4" stroke-width="1.5"/>` +
  `<text x="360" y="70" fill="var(--pass)" font-size="11" text-anchor="middle" ${F}>keep ALL text + key visuals</text>` +
  `<text x="360" y="84" fill="var(--pass)" font-size="11" text-anchor="middle" ${F}>inside this 80% box</text>` +
  `<text x="360" y="126" fill="var(--dim)" font-size="9" text-anchor="middle" ${F}>edges can get cropped by TVs</text>` +
  `<text x="30" y="50" fill="var(--text)" font-size="11" ${F}>Also check:</text>` +
  `<text x="30" y="70" fill="var(--dim)" font-size="10" ${F}>· no burned-in captions</text>` +
  `<text x="30" y="86" fill="var(--dim)" font-size="10" ${F}>· no glitchy/broken frames</text>` +
  `<text x="30" y="102" fill="var(--dim)" font-size="10" ${F}>· censored = default</text>` +
  `<text x="540" y="70" fill="var(--dim)" font-size="10" ${F}>Fix now — it's 10x</text>` +
  `<text x="540" y="86" fill="var(--dim)" font-size="10" ${F}>cheaper than after</text>` +
  `<text x="540" y="102" fill="var(--dim)" font-size="10" ${F}>QC rejection</text>`);

D.aeprep = svg(120, 'AE layer prep',
  `<text x="20" y="24" fill="var(--text)" font-size="12" ${F} font-weight="bold">Inside each After Effects project:</text>` +
  `<rect x="20" y="36" width="330" height="20" rx="4" fill="var(--panel2)" stroke="var(--pass)"/><text x="30" y="50" fill="var(--pass)" font-size="10" ${F}>T  "Officer J. Daniels"  — real text layer → auto-detected ✓</text>` +
  `<rect x="20" y="60" width="330" height="20" rx="4" fill="var(--panel2)" stroke="var(--warn)"/><text x="30" y="74" fill="var(--warn)" font-size="10" ${F}>🖼  "TXT_badge.psd" — baked text → needs TXT_ prefix or green label</text>` +
  `<rect x="20" y="84" width="330" height="20" rx="4" fill="var(--panel2)" stroke="var(--line)"/><text x="30" y="98" fill="var(--dim)" font-size="10" ${F}>🖼  "background.mp4" — no text → leave alone</text>` +
  `<rect x="380" y="36" width="320" height="68" rx="6" fill="var(--panel2)" stroke="var(--line)"/>` +
  `<text x="395" y="56" fill="var(--text)" font-size="11" ${F}>Also, once per project:</text>` +
  `<text x="395" y="74" fill="var(--dim)" font-size="10" ${F}>· render queue has your normal render queued</text>` +
  `<text x="395" y="90" fill="var(--dim)" font-size="10" ${F}>· AE Prefs → Scripting → "Allow Scripts to Write Files" ON</text>`);

D.exportvideo = flow(96, 'Video export settings', [
  { t: 'Your finished timeline', s: 'program only', c: 'var(--accent)' },
  { t: 'File → Export → Media', a: '' },
  { t: 'QuickTime · ProRes 422 HQ', s: '1920x1080 · match frame rate', c: 'var(--pass)' },
  { t: 'program.mov', s: 'audio here gets replaced later', c: 'var(--line)' },
], 'One clean video of just the show — no bars, no slate, no ads. Starts at the first frame of picture.');

D.exportstems = svg(120, 'Five stem exports from track solos',
  `<text x="10" y="20" fill="var(--text)" font-size="12" ${F} font-weight="bold">Your tracks</text>` +
  `<rect x="10" y="30" width="120" height="18" rx="4" fill="var(--warn)" opacity="0.8"/><text x="70" y="43" fill="#000" font-size="10" text-anchor="middle" ${F}>A1 narration</text>` +
  `<rect x="10" y="52" width="120" height="18" rx="4" fill="var(--fail)" opacity="0.7"/><text x="70" y="65" fill="#fff" font-size="10" text-anchor="middle" ${F}>A2–A6 dialogue</text>` +
  `<rect x="10" y="74" width="120" height="18" rx="4" fill="var(--accent)" opacity="0.8"/><text x="70" y="87" fill="#fff" font-size="10" text-anchor="middle" ${F}>music tracks</text>` +
  `<rect x="10" y="96" width="120" height="18" rx="4" fill="var(--pass)" opacity="0.8"/><text x="70" y="109" fill="#04250f" font-size="10" text-anchor="middle" ${F}>SFX tracks</text>` +
  `<text x="210" y="20" fill="var(--text)" font-size="12" ${F} font-weight="bold">Five exports (solo each group, export audio-only WAV)</text>` +
  box(210, 30, 92, 24, 'var(--line)', 'FULL = all') + box(310, 30, 92, 24, 'var(--warn)', 'NARR', '', 'var(--warn)') +
  box(410, 30, 92, 24, 'var(--fail)', 'DX', '', 'var(--fail)') + box(510, 30, 92, 24, 'var(--accent)', 'MX', '', 'var(--accent)') +
  box(610, 30, 92, 24, 'var(--pass)', 'FX', '', 'var(--pass)') +
  `<text x="210" y="80" fill="var(--dim)" font-size="11" ${F}>Each export: WAV · 48 kHz · 24-bit · stereo · program only</text>` +
  `<text x="210" y="100" fill="var(--dim)" font-size="11" ${F}>NARR + DX + MX + FX together = FULL, or something's missing/doubled</text>`);

D.exportxml = flow(96, 'Sequence XML export', [
  { t: 'Click your sequence', s: 'in the timeline' },
  { t: 'File → Export →', s: 'Final Cut Pro XML', a: '' },
  { t: 'EPISODE.xml', s: 'one small file', c: 'var(--pass)' },
  { t: 'powers 4 tools', s: 'cue sheet · logs · timings · textless', c: 'var(--accent)' },
], 'The XML is a map of your whole timeline — the app reads it so you never retype timecodes.');

D.buildstems = svg(150, '5 stems become 16 tracks',
  ['FULL', 'NARR', 'DX', 'MX', 'FX'].map((n, i) => box(14, 12 + i * 26, 80, 20, 'var(--line)', n + '.wav')).join('') +
  arrow(100, 160, 72, 'app builds') +
  `<text x="170" y="20" fill="var(--text)" font-size="11" ${F} font-weight="bold">The 16-track layout (auto-built):</text>` +
  `<text x="170" y="40" fill="var(--dim)" font-size="10" ${F}>1–6  · 5.1 surround full mix (C = dialogue+narration, LFE = lows)</text>` +
  `<text x="170" y="58" fill="var(--dim)" font-size="10" ${F}>7–8  · stereo full mix</text>` +
  `<text x="170" y="76" fill="var(--dim)" font-size="10" ${F}>9–10 · effects only     11–12 · music only</text>` +
  `<text x="170" y="94" fill="var(--dim)" font-size="10" ${F}>13–14 · music+effects (what dubbing studios use)</text>` +
  `<text x="170" y="112" fill="var(--dim)" font-size="10" ${F}>15 · narration     16 · mono full mix</text>` +
  arrow(560, 610, 72, 'embed') +
  box(614, 50, 96, 44, 'var(--pass)', '_16TRK.mov', 'video + 16 tracks', 'var(--pass)') +
  cap(142, 'Then: master-aligned sidecars = the same tracks padded to match the broadcast master timing'));

D.qctexted = flow(100, 'QC the program master', [
  { t: '_16TRK.mov', s: 'drop it on the stage', c: 'var(--accent)' },
  { t: 'App checks ~20 specs', s: 'codec · size · fps · 16 tracks…', a: '' },
  { t: 'ALL PASS?', s: 'green = continue', c: 'var(--pass)', tc: 'var(--pass)' },
  { t: 'Any FAIL', s: 'fix at source, re-export, re-QC', c: 'var(--fail)', tc: 'var(--fail)' },
], 'Never deliver around a failure — fix the cause. Notion records every result automatically.');

D.buildmaster = svg(100, 'Broadcast master head and tail structure',
  `<rect x="10" y="30" width="70" height="34" rx="4" fill="#000" stroke="var(--line)"/><text x="45" y="51" fill="var(--dim)" font-size="10" text-anchor="middle" ${F}>BLACK 30s</text>` +
  `<rect x="84" y="30" width="70" height="34" rx="4" fill="var(--warn)" opacity="0.85"/><text x="119" y="47" fill="#000" font-size="10" text-anchor="middle" ${F}>BARS+TONE</text><text x="119" y="58" fill="#000" font-size="9" text-anchor="middle" ${F}>30s</text>` +
  `<rect x="158" y="30" width="70" height="34" rx="4" fill="var(--panel2)" stroke="var(--line)"/><text x="193" y="51" fill="var(--text)" font-size="10" text-anchor="middle" ${F}>SLATE 30s</text>` +
  `<rect x="232" y="30" width="70" height="34" rx="4" fill="#000" stroke="var(--line)"/><text x="267" y="51" fill="var(--dim)" font-size="10" text-anchor="middle" ${F}>BLACK 30s</text>` +
  `<rect x="306" y="30" width="330" height="34" rx="4" fill="var(--accent)" opacity="0.85"/><text x="471" y="51" fill="#fff" font-size="12" text-anchor="middle" ${F}>YOUR PROGRAM (untouched)</text>` +
  `<rect x="640" y="30" width="18" height="34" rx="3" fill="#000" stroke="var(--line)"/><text x="686" y="51" fill="var(--dim)" font-size="9" ${F}>2s tail</text>` +
  `<text x="10" y="20" fill="var(--dim)" font-size="10" ${F}>00:58:00:00</text>` +
  `<text x="84" y="20" fill="var(--dim)" font-size="10" ${F}>00:58:30</text>` +
  `<text x="158" y="20" fill="var(--dim)" font-size="10" ${F}>00:59:00</text>` +
  `<text x="232" y="20" fill="var(--dim)" font-size="10" ${F}>00:59:30</text>` +
  `<text x="306" y="20" fill="var(--pass)" font-size="11" font-weight="bold" ${F}>01:00:00:00</text>` +
  `<text x="10" y="88" fill="var(--dim)" font-size="11" ${F}>Head = exactly 2 minutes · tone on all 16 tracks during bars · the "1 hour" is a timecode label, no frames move</text>`);

D.renderTextless = svg(92, 'Textless factory flow',
  box(10, 26, 120, 40, 'var(--line)', 'graphic.aep', 'text layers ON') +
  arrow(134, 178, 46, 'app → AE') +
  box(182, 26, 150, 40, 'var(--accent)', 'text layers OFF', 'TextLayers + TXT_ + label 9', 'var(--accent)') +
  arrow(336, 380, 46, 'same settings') +
  box(384, 26, 150, 40, 'var(--pass)', 'graphic_TEXTLESS.mp4', 'same format, alpha kept', 'var(--pass)') +
  arrow(538, 582, 46, '') +
  box(586, 26, 124, 40, 'var(--warn)', 'run ONE first', 'verify, then batch', 'var(--warn)'));

D.textlessSeq = svg(110, 'Textless sequence via XML swap',
  `<text x="10" y="20" fill="var(--text)" font-size="11" ${F} font-weight="bold">Texted timeline (your edit)</text>` +
  `<rect x="10" y="28" width="140" height="24" rx="4" fill="var(--panel2)" stroke="var(--line)"/><text x="80" y="44" fill="var(--dim)" font-size="10" text-anchor="middle" ${F}>bodycam.mp4</text>` +
  `<rect x="154" y="28" width="120" height="24" rx="4" fill="var(--accent)"/><text x="214" y="44" fill="#fff" font-size="10" text-anchor="middle" ${F}>graphic.mp4</text>` +
  `<rect x="278" y="28" width="120" height="24" rx="4" fill="var(--panel2)" stroke="var(--line)"/><text x="338" y="44" fill="var(--dim)" font-size="10" text-anchor="middle" ${F}>interview.mp4</text>` +
  arrow(420, 470, 40, 'app rewrites XML') +
  `<text x="474" y="20" fill="var(--pass)" font-size="11" ${F} font-weight="bold">TEXTLESS timeline (imported)</text>` +
  `<rect x="474" y="28" width="100" height="24" rx="4" fill="var(--panel2)" stroke="var(--line)"/><text x="524" y="44" fill="var(--dim)" font-size="10" text-anchor="middle" ${F}>bodycam.mp4</text>` +
  `<rect x="578" y="28" width="132" height="24" rx="4" fill="var(--pass)"/><text x="644" y="44" fill="#04250f" font-size="10" text-anchor="middle" ${F}>graphic_TEXTLESS</text>` +
  cap(78, 'Same cuts, same timing — only the texted graphics are swapped. Import the new XML, eyeball it, export ProRes like before.') +
  cap(98, 'File → Import → the "… TEXTLESS.xml" the app saved'));

D.textlessMaster = flow(96, 'Finish the textless master', [
  { t: 'Embed same 16 tracks', s: 'audio is identical', c: 'var(--accent)' },
  { t: 'OCR scan', s: 'app reads frames for leftover text', a: '' },
  { t: 'QC', s: 'same checks as texted' },
  { t: 'Build + file', s: 'slate reads TEXTLESS VERSION', c: 'var(--pass)' },
], 'Textless ships the SAME DAY as texted — distributors reject without it.');

D.textlessNoGfx = svg(96, 'Clean XML: graphics disabled, not swapped',
  box(10, 26, 160, 40, 'var(--accent)', 'graphic.mp4', 'enabled = TRUE', 'var(--accent)') +
  arrow(184, 260, 46, 'make CLEAN XML') +
  box(264, 26, 190, 40, 'var(--pass)', 'graphic.mp4', 'enabled = FALSE — no render needed', 'var(--pass)') +
  arrow(468, 544, 46, 'export') +
  box(548, 26, 150, 40, 'var(--pass)', 'clean plate ProRes', 'same specs as texted', 'var(--pass)') +
  cap(84, 'Only needed when text sits ON a graphic — a lower-third bar, a blur box, a text-message bubble.'));

D.captions = svg(130, 'Caption rules',
  `<rect x="240" y="14" width="240" height="96" rx="4" fill="#000" stroke="var(--line)"/>` +
  `<rect x="290" y="78" width="140" height="22" rx="3" fill="#000" stroke="var(--pass)"/>` +
  `<text x="360" y="93" fill="#fff" font-size="10" text-anchor="middle" ${F}>License and registration.</text>` +
  `<text x="360" y="40" fill="var(--dim)" font-size="9" text-anchor="middle" ${F}>pop-on = appears as a block,</text>` +
  `<text x="360" y="52" fill="var(--dim)" font-size="9" text-anchor="middle" ${F}>not typed out line by line</text>` +
  `<text x="30" y="40" fill="var(--text)" font-size="11" ${F}>Required:</text>` +
  `<text x="30" y="58" fill="var(--pass)" font-size="10" ${F}>✓ SCC format</text>` +
  `<text x="30" y="74" fill="var(--pass)" font-size="10" ${F}>✓ synced to the master</text>` +
  `<text x="30" y="90" fill="var(--pass)" font-size="10" ${F}>✓ timed to 01:00:00:00 start</text>` +
  `<text x="510" y="40" fill="var(--text)" font-size="11" ${F}>Not allowed:</text>` +
  `<text x="510" y="58" fill="var(--fail)" font-size="10" ${F}>✗ roll-up / paint-on style</text>` +
  `<text x="510" y="74" fill="var(--fail)" font-size="10" ${F}>✗ covering faces or text</text>` +
  `<text x="510" y="90" fill="var(--fail)" font-size="10" ${F}>✗ ads in captions</text>`);

D.timings = flow(100, 'Markers become the timings file', [
  { t: 'Your duration markers', s: 'from edit prep', c: 'var(--pass)' },
  { t: 'Load sequence XML', s: 'on the Timings stage', a: '' },
  { t: 'CSV written', s: 'frame-accurate, master timecode', c: 'var(--accent)' },
  { t: 'Spot-check 2–3 rows', s: 'against the real master', c: 'var(--warn)' },
], 'The CSV tells the broadcaster exactly where every segment starts and ends.');

D.autodocs = svg(120, 'One XML drafts three documents',
  box(20, 40, 130, 44, 'var(--accent)', 'EPISODE.xml', 'your timeline map', 'var(--accent)') +
  arrow(154, 200, 62, 'tick music tracks') +
  box(204, 12, 150, 30, 'var(--pass)', 'Music Cue Sheet', 'royalties get paid right') +
  box(204, 48, 150, 30, 'var(--pass)', 'Lower Thirds Log', 'for translators') +
  box(204, 84, 150, 30, 'var(--pass)', 'Textless Log', 'proves coverage') +
  box(420, 40, 120, 44, 'var(--warn)', 'captions .scc', 'load separately', 'var(--warn)') +
  arrow(544, 580, 62, '') +
  box(584, 40, 126, 44, 'var(--pass)', 'As-Broadcast Script', 'add speakers + actions') +
  cap(118, 'You review and fill blanks — the app never retypes a timecode wrong, and it remembers music info forever'));

D.papers = flow(100, 'Finish the paperwork', [
  { t: 'Open each template', s: 'in the app', c: 'var(--accent)' },
  { t: 'Fill honestly', s: 'declarations must be TRUE', a: '' },
  { t: 'Export PDF', s: 'lands in 06 Docs automatically' },
  { t: 'Tick Notion checklist', s: 'on the episode row', c: 'var(--pass)' },
], 'Credits · Cast & Crew · Synopsis · declarations · copyright line · extension log — drafts auto-save as you type.');

D.licenses = flow(100, 'Music licenses', [
  { t: 'Every cue sheet track', s: 'each row = one song', c: 'var(--accent)' },
  { t: 'Download certificate', s: 'from Epidemic per track', a: '' },
  { t: 'Save to 06 Docs', s: 'PDF per track' },
  { t: 'Verify plan tier', s: 'covers TV/broadcast — once', c: 'var(--warn)' },
], '#1 way library-music shows fail delivery: subscription tier only covers online. Check yours, screenshot the terms.');

D.humanpass = svg(110, 'The human pass',
  box(30, 20, 200, 34, 'var(--accent)', '👁 WATCH both masters', 'quality · head · censorship') +
  box(30, 62, 200, 34, 'var(--accent)', '👂 LISTEN', 'track order · M&E has zero dialogue') +
  box(260, 20, 200, 34, 'var(--accent)', '🕳 SCRUB textless', 'against the textless log') +
  box(260, 62, 200, 34, 'var(--accent)', '💬 SPOT-CHECK captions', 'sync at 3 random points') +
  box(490, 20, 200, 76, 'var(--warn)', 'No tool replaces this', 'machines checked the specs —', 'var(--warn)') +
  `<text x="590" y="82" fill="var(--dim)" font-size="9" text-anchor="middle" ${F}>you check the judgment calls</text>`);

D.upload = svg(100, 'Upload rules',
  box(20, 26, 170, 44, 'var(--pass)', 'Distribution folder', 'masters · stems · captions · docs', 'var(--pass)') +
  arrow(194, 280, 48, 'their naming applied') +
  box(284, 26, 170, 44, 'var(--accent)', "Distributor's portal", 'hot folder / upload site', 'var(--accent)') +
  `<circle cx="520" cy="48" r="20" fill="none" stroke="var(--fail)" stroke-width="2.5"/><text x="520" y="53" fill="var(--fail)" font-size="11" text-anchor="middle" ${F}>ZIP</text><line x1="506" y1="34" x2="534" y2="62" stroke="var(--fail)" stroke-width="2.5"/>` +
  box(560, 26, 150, 44, 'var(--warn)', '≥ 5 business days', 'before air date', 'var(--warn)') +
  cap(92, 'Individual files, never zipped · textless same day as texted · get their naming spec BEFORE uploading'));

D.confirm = flow(96, 'Confirmation', [
  { t: 'Distributor QC report', s: 'watch for it', c: 'var(--warn)' },
  { t: 'Fix + redeliver fast', s: 'if anything bounces', a: '' },
  { t: 'Confirmed ✓', s: 'they accept the delivery', c: 'var(--pass)' },
  { t: 'Distribution Ready', s: 'one click → Notion goes green', c: 'var(--pass)', tc: 'var(--pass)' },
], 'Done — the whole catalog updates, and the next episode starts at step 1. 🎉');

// ---------- steps ----------
const GUIDE_STEPS = [
  // PHASE A
  { id: 'brands', phase: 'A · Edit Prep', title: 'Remove brand deals & sponsor content from the timeline',
    body: 'Cut every paid promotion, sponsor read, and trade-out from the program. Later you\'ll sign declarations saying there are none — that has to be literally true, because distributors spot-check. Also remove mid-roll ad markers and promo bumpers.',
    svg: D.brands, stage: 'prep' },
  { id: 'segments', phase: 'A · Edit Prep', title: 'Cut the program into broadcast segments (with 2s blacks)',
    body: 'Two different things share the word "section": your CREATIVE sections (fades, music changes — keep them exactly as they are) and BROADCAST segments — the chunks between commercial breaks. At each future ad-break point, insert exactly 2 seconds of true black: black video, ALL audio silent (not a fade with music carrying through). Ask your distributor how many segments they want. There are two real length possibilities — cut to the LONGER end of whichever one applies, never the shorter end, so there\'s room to trim later without ever needing footage back: 23–26 minutes for a half-hour format, 46–52 minutes for an hour format (varies by distributor — confirm before locking; the app classifies which window you landed in automatically). Log every place you extended footage in the Runtime & Extension Log template so those trims stay painless.',
    svg: D.segments, stage: 'prep' },
  { id: 'creditroll', phase: 'A · Edit Prep', title: 'Cut the end credit roll into the picture',
    body: 'The episode needs an actual on-screen credit roll — this is picture, separate from the paperwork Credits document you\'ll fill out later in the Paperwork stage, which just lists names and roles for the record. Cut the roll in as the final segment of the program, right before the tail (2s black, or the textless block if the credits carry text that needs to go textless too). Keep it inside title-safe like everything else, and if the same roll gets reused episode to episode, lock its timing once so it stays consistent across the season.',
    svg: D.creditroll, stage: 'prep' },
  { id: 'markers', phase: 'A · Edit Prep', title: 'Add a duration marker over every segment',
    body: 'In Premiere, press M (nothing selected) at each segment\'s start, then double-click the marker and set its duration to span the whole segment. These markers become your frame-accurate Segment Timings file automatically later — no typing timecodes ever.',
    svg: D.markers, stage: 'timings' },
  { id: 'contentpass', phase: 'A · Edit Prep', title: 'Content pass: title safe, no burned captions, censored',
    body: 'Watch the cut once checking only these: every piece of text and crucial visual sits inside the center 80% of frame · no captions burned into the picture · no broken/glitchy frames or dirty edges · the censored version is your default master.',
    svg: D.contentpass, stage: 'prep' },
  { id: 'aeprep', phase: 'A · Edit Prep', title: 'Prep After Effects projects for the render farm',
    body: 'The render farm will switch off all text and re-render every graphic that needs a text-off version. Real AE text layers are found automatically. Text that\'s baked into an image (PSD, shape, pre-render) can\'t be auto-detected — give those layers a TXT_ name prefix or label color 9 (green). Each AEP needs its normal render sitting in the render queue (that\'s where output settings get copied from), and AE needs "Allow Scripts to Write Files" enabled once in Preferences → Scripting & Expressions.',
    svg: D.aeprep, stage: 'renderfarm' },
  { id: 'renderTextless', phase: 'A2 · Render Farm', title: 'Queue AE projects on the render farm',
    body: 'Render Farm stage: scan a folder — projects group by graphic type (Lowerthird, Photoviewer, etc., with anything unrecognized under "Custom") so you can grab a whole style at once. Queue texted, text off, or both per batch. Sending this early means renders are done in the background while you work through exports and QC below — by the time you reach the Textless phase, they should already be waiting for you.',
    svg: D.renderTextless, stage: 'renderfarm' },

  // PHASE B
  { id: 'exportvideo', phase: 'B · Exports', title: 'Export the texted program video (ProRes)',
    body: 'File → Export → Media: Format QuickTime, Codec Apple ProRes 422 HQ, 1920x1080, match your sequence frame rate, progressive. Export a direct render — not a "Use Previews"/reference file — those can carry hidden QuickTime edit lists, which is an automatic rejection. Program only — starts at the first frame of picture, no bars or slate (the app adds those later). Audio settings here don\'t matter; the proper 16-track audio gets embedded in the next phase.',
    svg: D.exportvideo, stage: 'texted' },
  { id: 'exportstems', phase: 'B · Exports', title: 'Export the five audio stems (WAV, via track solos)',
    body: 'Five audio-only exports from the same sequence, each WAV 48kHz/24-bit stereo: FULL (nothing soloed — the mix as aired), NARR (solo narration), DX (solo ALL spoken content wherever it lives), MX (solo all music), FX (solo all effects). Golden rule: every audible track belongs to exactly one of NARR/DX/MX/FX. Watch for audio riding on nested sequences sitting on video tracks.',
    svg: D.exportstems, stage: 'stems' },
  { id: 'exportxml', phase: 'B · Exports', title: 'Export the sequence XML',
    body: 'Click the sequence in the timeline → File → Export → Final Cut Pro XML → save. If Premiere shows a "translation" warning, click OK — it only affects effects, which the app doesn\'t read.',
    svg: D.exportxml, stage: 'paperwork' },

  // PHASE C
  { id: 'buildstems', phase: 'C · Assemble & QC', title: 'Build the 16-track audio and embed it',
    body: 'Audio Stems stage → Stem Assembler: pick your five WAVs → Build 16 tracks → Embed into your ProRes export (creates _16TRK.mov) → Write master-aligned sidecars. If it warns about duration mismatches, a stem didn\'t match the FULL mix — fix the solo/export before continuing.',
    svg: D.buildstems, stage: 'stems' },
  { id: 'qctexted', phase: 'C · Assemble & QC', title: 'QC the 16-track program master',
    body: 'Texted Master stage: drop the _16TRK.mov. Every check should pass green. If anything fails, fix it at the source (export settings or stems) and re-run. Never deliver around a QC failure.',
    svg: D.qctexted, stage: 'texted' },
  { id: 'buildmaster', phase: 'C · Assemble & QC', title: 'Build the broadcast master & file it',
    body: 'Same stage: Build broadcast master, then File to Dropbox & update Notion. Watch the head once: bars at 58:30, slate readable and correct, program starts at exactly 01:00:00:00.',
    svg: D.buildmaster, stage: 'texted' },

  // PHASE D
  { id: 'textlessSeq', phase: 'D · Textless', title: 'Build & export the textless sequence',
    body: 'Textless stage: check your render-farm renders finished (text gone, format identical, transparency intact), then load your sequence XML — the app writes a new "… TEXTLESS.xml" with every texted graphic swapped for its _TEXTLESS render. Import it into Premiere (File → Import), eyeball the timeline, and export ProRes exactly like the texted export.',
    svg: D.textlessSeq, stage: 'textless' },
  { id: 'textlessMaster', phase: 'D · Textless', title: 'Embed audio, OCR-verify, QC, build & file the textless master',
    body: 'Embed the SAME 16 tracks into the textless export (audio is identical between versions). Run the OCR scan to catch any leftover text. QC it, Build broadcast master (the slate automatically reads TEXTLESS VERSION), file it. Textless must go out the same day as texted.',
    svg: D.textlessMaster, stage: 'textless' },
  { id: 'textlessNoGfx', phase: 'D · Textless', title: 'Text on a graphic? Build the fully clean version too',
    body: 'If any texted moment sits ON a graphic — a lower-third bar, a blur box, a text-message bubble — rather than being plain text over picture, the spec wants BOTH the textless-graphic version above AND a fully clean plate with no graphic at all. Nothing to render: on the Textless — No Graphics stage, load your sequence XML into the Textless stage\'s "make CLEAN XML" tool — it disables every matched graphic clip in a copy of the sequence instead of swapping in a render. Import that XML, export ProRes exactly like the other masters, then finish it the same way: embed the 16 tracks, QC, build broadcast master, file it. Skip this step entirely if nothing in the episode has text baked onto a graphic.',
    svg: D.textlessNoGfx, stage: 'textless_nogfx' },

  // PHASE E
  { id: 'captions', phase: 'E · Docs & Data', title: 'Captions: SCC in, checked, filed',
    body: 'Have captions made against the BROADCAST master timing (program at 01:00:00:00), pop-on style. Drop the .scc on the Captions stage — it checks, files to Dropbox, and updates Notion. SRT/VTT are welcome extras; SCC is the required format.',
    svg: D.captions, stage: 'captions' },
  { id: 'timings', phase: 'E · Docs & Data', title: 'Segment timings: markers → CSV → verify → file',
    body: 'Timings stage: load the sequence XML — your duration markers become the frame-accurate CSV in master timecode automatically. Spot-check two or three rows against the actual broadcast master, then drop the CSV through the intake to mark it Ready.',
    svg: D.timings, stage: 'timings' },
  { id: 'autodocs', phase: 'E · Docs & Data', title: 'Auto-draft the paperwork from your edit',
    body: 'Paperwork stage → Auto-draft: load the sequence XML, tick your music tracks, Generate. Review the Music Cue Sheet (fill composer once per Epidemic track — the app remembers forever), Lower Thirds Log, Textless Log. Then load your SCC to draft the As-Broadcast Script and add speaker names and action lines.',
    svg: D.autodocs, stage: 'paperwork' },
  { id: 'papers', phase: 'E · Docs & Data', title: 'Finish the remaining documents & export PDFs',
    body: 'Work through the rest: Credits, Cast & Crew, Synopsis & Loglines, the declarations (dubbing, talent, ad/pub, placement/trade-out — sign only what\'s literally true), Copyright Line, Segment Timing Sheet, and your Runtime & Extension Log. Export each as PDF into 06 Docs, and tick the episode\'s checklist page in Notion.',
    svg: D.papers, stage: 'paperwork' },
  { id: 'licenses', phase: 'E · Docs & Data', title: 'Music licenses: download certificates, verify coverage',
    body: 'For every track on the cue sheet, download its Epidemic Sound license certificate into 06 Docs. Verify ONCE that your subscription tier covers TV/broadcast distribution and keep a copy of those terms — this is the single most common library-music delivery failure.',
    svg: D.licenses, stage: 'paperwork' },

  // PHASE F
  { id: 'humanpass', phase: 'F · Deliver', title: 'The human pass — watch, listen, verify',
    body: 'Watch every video master end to end — texted, textless, and no-graphics if it exists: picture quality, head/slate correctness, censorship. Listen: is narration really on track 15, does the M&E contain zero dialogue? Scrub the textless against the Textless Log. Spot-check caption sync at three random points. This is the judgment layer no tool replaces.',
    svg: D.humanpass, stage: 'deliver' },
  { id: 'upload', phase: 'F · Deliver', title: 'Apply naming conventions & upload everything',
    body: 'Get the distributor\'s naming spec and apply it to every file. Upload the entire Distribution folder contents to their portal — never a ZIP — at least 5 business days before air. Textless goes up the same day as texted.',
    svg: D.upload, stage: 'deliver' },
  { id: 'confirm', phase: 'F · Deliver', title: 'Confirmation → Distribution Ready',
    body: 'Watch for the distributor\'s QC report; fix and redeliver fast if anything bounces. When they confirm, hit "Mark Distribution Ready in Notion" on the Deliver stage. Done. 🎉',
    svg: D.confirm, stage: 'deliver' },
];

module.exports = { GUIDE_STEPS };
