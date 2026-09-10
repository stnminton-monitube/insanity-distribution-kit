// In-app document templates for ancillary deliverables (episodic set).
// Each template: sections of fields (label/value), tables (dynamic rows), or notes.
// Drafts are saved locally; export renders a clean PDF into the episode's 06 Docs folder.
//
// `label` is the prompt shown while EDITING (can be instructional — "state it
// plainly here", word counts, examples). `heading`, where present, is what the
// EXPORTED PDF prints instead — a clean formal section title. Never let editing
// instructions leak into a document meant for delivery. `signature: true` flags
// a field for the signature-block treatment instead of a plain paragraph.

const TEMPLATES = [
  {
    id: 'abscript', name: 'As-Broadcast Script',
    desc: 'Timecoded transcript of the final cut: dialogue, speakers, action. Auto-draft from your caption file, then polish.',
    sections: [
      { type: 'fields', fields: [{ k: 'notes', label: 'Header notes (episode, runtime, version date)', heading: 'Header Notes', multi: true }] },
      { type: 'table', label: 'Script', cols: [
        { k: 'tc', label: 'Timecode', w: '14%' }, { k: 'speaker', label: 'Speaker / element', w: '18%' }, { k: 'text', label: 'Dialogue / action description' }] },
    ],
  },
  {
    id: 'credits', name: 'Credits',
    desc: 'Final credits for the episode, in order.',
    sections: [
      { type: 'table', label: 'Opening titles', cols: [
        { k: 'pos', label: '#', w: '6%' }, { k: 'credit', label: 'Credit (e.g. "Directed by")', w: '40%' }, { k: 'name', label: 'Name(s)' }] },
      { type: 'table', label: 'End credits', cols: [
        { k: 'pos', label: '#', w: '6%' }, { k: 'credit', label: 'Credit / Role', w: '40%' }, { k: 'name', label: 'Name(s)' }] },
    ],
  },
  {
    id: 'cuesheet', name: 'Music Cue Sheet',
    desc: 'Every cue and licensed track synchronized with the picture.',
    sections: [
      { type: 'table', label: 'Cues', cols: [
        { k: 'num', label: 'Cue #', w: '7%' }, { k: 'title', label: 'Composition title' },
        { k: 'composer', label: 'Writer / composer' }, { k: 'performer', label: 'Performer / artist' }, { k: 'publisher', label: 'Publisher' },
        { k: 'society', label: 'PRO (ASCAP/BMI/SOCAN)', w: '12%' }, { k: 'usage', label: 'Usage (BG/Visual · Inst/Vocal)', w: '14%' },
        { k: 'dur', label: 'Duration', w: '9%' }, { k: 'tcin', label: 'TC In', w: '10%' }, { k: 'tcout', label: 'TC Out', w: '10%' }] },
      { type: 'note', text: 'Review every auto-detected cue. Confirm title, writers, publisher, performer (when applicable), PRO, usage type, and exact program timecodes before submission.' },
    ],
  },
  {
    id: 'castcrew', name: 'Cast & Crew List',
    desc: 'Everyone who rendered services, with contacts and representation.',
    sections: [
      { type: 'table', label: 'Cast', cols: [
        { k: 'name', label: 'Name' }, { k: 'character', label: 'Character' }, { k: 'phone', label: 'Phone', w: '12%' },
        { k: 'email', label: 'Email' }, { k: 'agent', label: 'Agent/Manager + contact' }] },
      { type: 'table', label: 'Crew', cols: [
        { k: 'name', label: 'Name' }, { k: 'role', label: 'Role' }, { k: 'phone', label: 'Phone', w: '12%' }, { k: 'email', label: 'Email' }] },
    ],
  },
  {
    id: 'synopsis', name: 'Synopsis',
    desc: 'Prose summary for catalogs, sales, and program guides.',
    sections: [
      { type: 'fields', fields: [
        { k: 'shortsyn', label: 'Short synopsis — one paragraph per episode (~100 words)', heading: 'Short Synopsis', multi: true },
        { k: 'longsyn', label: 'Long synopsis (~1 page)', heading: 'Long Synopsis', multi: true }] },
    ],
  },
  {
    id: 'logline', name: 'Logline',
    desc: 'One-to-two sentence hooks for listings and sales decks.',
    sections: [
      { type: 'fields', fields: [
        { k: 'short', label: 'Short logline (one sentence)', heading: 'Short Logline', multi: true },
        { k: 'standard', label: 'Standard logline (1–2 sentences)', heading: 'Standard Logline', multi: true }] },
    ],
  },
  {
    id: 'thirdparty', name: 'Third Party Licences (Graphics, Footage)',
    desc: 'Every third-party visual element and the licence that clears it.',
    sections: [
      { type: 'table', label: 'Licensed elements', cols: [
        { k: 'element', label: 'Element (footage, still, graphic, map, music-adjacent art)' },
        { k: 'source', label: 'Source / licensor' },
        { k: 'tc', label: 'Timecode(s) used', w: '15%' },
        { k: 'rights', label: 'Rights granted (media / territory / term)' },
        { k: 'paid', label: 'Paid?', w: '8%' },
        { k: 'file', label: 'Licence file name' }] },
      { type: 'note', text: 'FOIA / public-records footage: list the agency and request reference in Source, and note "public record — no licence required" under Rights. Anything created by production under work-for-hire needs no licence but is worth listing for completeness.' },
      { type: 'fields', fields: [
        { k: 'none', label: 'If NO third-party graphics or footage appear, state it plainly here', heading: 'Statement', multi: true },
        { k: 'signed', label: 'Prepared by (name, title, date)', heading: 'Prepared By', signature: true }] },
    ],
  },
  {
    id: 'lowerthirds', name: 'Lower Thirds / Chyrons Log',
    desc: 'Every on-screen text element, for localization teams.',
    sections: [
      { type: 'table', label: 'On-screen text', cols: [
        { k: 'tc', label: 'Timecode (HH:MM:SS:FF)', w: '18%' }, { k: 'text', label: 'Exact on-screen text' }, { k: 'desc', label: 'Context / scene description' }] },
    ],
  },
  {
    id: 'textlesslog', name: 'Textless Materials Log',
    desc: 'Timecoded log of every texted moment in the picture.',
    sections: [
      { type: 'table', label: 'Texted moments', cols: [
        { k: 'tc', label: 'Timecode (HH:MM:SS:FF)', w: '18%' }, { k: 'desc', label: 'Description of scene / text' },
        { k: 'covered', label: 'Textless provided? (Y/N)', w: '14%' }] },
      { type: 'note', text: 'Include titles, credits, forced narratives, burned-in subtitles, lower thirds, and any VFX text needing translation. Text on a graphic needs BOTH a textless-graphic version and a fully clean version.' },
    ],
  },
  {
    id: 'segsheet', name: 'Segment Timing Sheet',
    desc: 'Human-readable companion to the timings CSV. Not required for seamless content.',
    sections: [
      { type: 'table', label: 'Segments', cols: [
        { k: 'seg', label: 'Segment', w: '10%' }, { k: 'tcin', label: 'In', w: '15%' }, { k: 'tcout', label: 'Out', w: '15%' },
        { k: 'dur', label: 'Duration', w: '15%' }, { k: 'desc', label: 'Notes' }] },
    ],
  },
  {
    id: 'dubsub', name: 'Dubbing & Subtitling Obligations/Restrictions',
    desc: 'Voice-replacement restrictions — or a signed "none" statement the distributor can rely on.',
    sections: [
      { type: 'fields', fields: [
        { k: 'none', label: 'If there are NO restrictions, state it plainly (e.g. "There are no dubbing or subtitling restrictions for this episode.")', heading: 'Statement', multi: true }] },
      { type: 'table', label: 'Restrictions (if any)', cols: [
        { k: 'who', label: 'Performer / party' }, { k: 'restriction', label: 'Restriction' }, { k: 'source', label: 'Contract source' }] },
      { type: 'fields', fields: [{ k: 'signed', label: 'Prepared by (name, title, date)', heading: 'Prepared By', signature: true }] },
    ],
  },
  {
    id: 'talentchart', name: 'Talent Restrictions & Approval Chart',
    desc: 'Credit obligations, name/likeness restrictions, photo approvals — billing-block order.',
    sections: [
      { type: 'table', label: 'Talent & companies (in credit order)', cols: [
        { k: 'name', label: 'Name / entity' }, { k: 'credit', label: 'Screen/ad credit obligation' },
        { k: 'likeness', label: 'Name & likeness restrictions' }, { k: 'photo', label: 'Photo approval rights' }, { k: 'other', label: 'Other obligations' }] },
      { type: 'fields', fields: [
        { k: 'none', label: 'If none: signed statement the distributor may rely on', heading: 'Statement', multi: true },
        { k: 'signed', label: 'Prepared by (name, title, date)', heading: 'Prepared By', signature: true }] },
    ],
  },
  {
    id: 'adpub', name: 'Ad/Pub/Marketing Restrictions',
    desc: 'Any element NOT cleared for worldwide, perpetual, all-media promo use.',
    sections: [
      { type: 'table', label: 'Restricted elements', cols: [
        { k: 'element', label: 'Element (footage, photo, logo, music…)' }, { k: 'restriction', label: 'What\'s restricted' }, { k: 'scope', label: 'Territory/term/media limits' }] },
      { type: 'fields', fields: [
        { k: 'none', label: 'If none, confirm: "No advertising/publicity/marketing restrictions."', heading: 'Statement', multi: true },
        { k: 'signed', label: 'Prepared by (name, title, date)', heading: 'Prepared By', signature: true }] },
    ],
  },
  {
    id: 'prodplace', name: 'Placement Declaration',
    desc: 'Paid product placement — or a signed declaration that there is none.',
    sections: [
      { type: 'fields', fields: [{ k: 'declare', label: 'Declaration (e.g. "No paid product placement appears in this episode.")', heading: 'Declaration', multi: true }] },
      { type: 'table', label: 'Placements (if any)', cols: [
        { k: 'brand', label: 'Brand / product' }, { k: 'tc', label: 'Timecode(s)', w: '16%' },
        { k: 'terms', label: 'Deal terms / agreement reference' }] },
      { type: 'note', text: 'Brands incidentally visible in bodycam or archival footage are NOT product placement — no deal exists. Only disclose paid arrangements.' },
      { type: 'fields', fields: [{ k: 'signed', label: 'Signed (name, title, date)', heading: 'Signed', signature: true }] },
    ],
  },
  {
    id: 'tradeout', name: 'Tradeout Declaration',
    desc: 'Goods or services received free in exchange for exposure — or a signed "none".',
    sections: [
      { type: 'fields', fields: [{ k: 'declare', label: 'Declaration (e.g. "No trade-outs appear in this episode.")', heading: 'Declaration', multi: true }] },
      { type: 'table', label: 'Trade-outs (if any)', cols: [
        { k: 'item', label: 'Goods / services received' }, { k: 'from', label: 'From whom' },
        { k: 'tc', label: 'Where it appears (TC)', w: '16%' }, { k: 'terms', label: 'Terms / agreement reference' }] },
      { type: 'fields', fields: [{ k: 'signed', label: 'Signed (name, title, date)', heading: 'Signed', signature: true }] },
    ],
  },
  {
    id: 'extlog', name: 'Runtime & Extension Log (internal)',
    desc: 'Where you padded the cut to hit runtime — your shopping list when the distributor asks for trims.',
    internal: true,
    sections: [
      { type: 'fields', fields: [{ k: 'target', label: 'Runtime target & current runtime (e.g. "Target 46–52 · aiming 51:30 · current 51:48")', heading: 'Runtime Target' }] },
      { type: 'table', label: 'Extensions / trim candidates', cols: [
        { k: 'tc', label: 'Timecode', w: '14%' }, { k: 'what', label: 'What was extended / could be cut' },
        { k: 'amount', label: 'Trimmable amount', w: '14%' }, { k: 'priority', label: 'Cut priority (1 = first to go)', w: '16%' }, { k: 'notes', label: 'Notes' }] },
      { type: 'note', text: 'Internal document — not a distributor deliverable, but keep it in 06 Docs so trims are painless.' },
    ],
  },
  {
    id: 'copyrightline', name: 'Legal Copyright Line',
    desc: 'The exact copyright notice for the episode.',
    sections: [
      { type: 'fields', fields: [
        { k: 'line', label: 'Copyright line (e.g. "© 2026 Production Company, LLC. All Rights Reserved.")', heading: 'Copyright Line' },
        { k: 'notes', label: 'Placement notes (end card, packaging, artwork)', heading: 'Placement Notes', multi: true }] },
    ],
  },
];

module.exports = { TEMPLATES };
