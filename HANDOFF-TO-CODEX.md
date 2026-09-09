# Handoff notes — Media Distribution Toolkit

Written 2026-09-09, moving primary development from Claude Code to Codex.
This is a supplement to `CLAUDE.md` (read that first — it's the real spec),
not a replacement. This file covers: what's verified right now, what's still
open, and which existing docs in this repo are stale and why.

## Verified current state (checked today, not from memory)

- `npm test` → **105/105 passing**, right now, on this exact code.
- App launches cleanly (`npm start` → real Electron GUI on macOS).
- `lib/` has 15 modules (CLAUDE.md's own module table lists all 15 correctly;
  its prose header says "14 modules" — trivial off-by-one in the text, not
  worth fixing by itself, just don't be confused by it).
- `lib/stages.js` defines **10 stages**, in this order: `prep`, `renderfarm`,
  `texted`, `textless`, `textless_nogfx`, `stems`, `captions`, `timings`,
  `paperwork`, `deliver`. (See "stale docs" below — `README.md` still
  describes an older 8-stage list.)
- This repo had **no git history** until today. I initialized one with a
  single baseline commit of the current working state, specifically so this
  handoff has a clean starting point to diff against.

## Known-stale existing docs — read these with a critical eye

- **`README.md`**: lists "8 workflow stages · 1-8", naming an older set
  (Prep & Export / Texted Master / Textless / Audio Stems / Captions /
  Segment Timings / Paperwork / Package & Deliver). The real current list is
  the 10 above — Render Farm was added as stage 2, and Textless split into
  two variants (with/without graphics). I have not rewritten `README.md`'s
  stage list myself — flagging it here rather than silently editing
  user-facing docs without being asked.
- **`INTEGRATION.md`**: describes a plan to add a Distribution tab to the
  Insanity Premiere panel, and states plainly that `insanity-premiere` (UXP)
  is "the live Premiere panel" while `insanity-premiere-cep` (CEP) is
  "legacy." **This is now confirmed wrong**, from direct inspection of the
  actual `insanity-extension` repo and the actual CEP extensions folder on
  this Mac (`~/Library/Application Support/Adobe/CEP/extensions/`) done in a
  separate work session on that other repo:
  - `insanity-premiere-cep` is what's *actually* symlinked into the CEP
    extensions folder, what Premiere actually loads, and what real render
    farm queuing work was built and tested against, live, in that repo.
  - `insanity-premiere` (the UXP/TypeScript one) has no CEP manifest, isn't
    in the CEP extensions folder at all, and isn't demonstrably the thing
    running in Premiere on this machine.
  - So `INTEGRATION.md`'s Phase 1–5 plan is built on a premise (target UXP,
    treat CEP as legacy) that doesn't match reality. If a Premiere-panel tab
    for this toolkit is picked back up, re-verify which extension is
    actually live *at that time* before assuming this document's plan still
    applies — extensions get renamed/swapped, so re-check rather than trust
    either this note or the original doc blindly.
  - I have not rewritten `INTEGRATION.md` itself — same reasoning as above,
    flagging rather than silently rewriting a doc with real planning content
    in it.
- **`PORTING-TO-CEP.md`**: already self-marked "Superseded" at the top,
  pointing to `INTEGRATION.md`. That pointer itself is now stale per the
  above, but the file already flags itself as not-current, so lower priority.
- **The Insanity Premiere extension work itself lives in a separate repo**
  (`insanity-extension` on GitHub, not this one) — render farm queuing tab,
  self-update mechanism, a GitHub Action that auto-packages updates. None of
  that code is in this repository. If Codex needs that context too, it needs
  pointing at that repo separately — this handoff only covers
  `feg-delivery-app`.

## Recent work this session (verified against real project files)

All of this is in `renderer/index.html`'s music cue sheet builder (`buildMusicCues`,
`parseES`, and the `#auto-generate` cue-row logic) plus one addition to
`lib/premxml.js`. Found and fixed by diffing a real user-edited cue sheet PDF
against the app's auto-generated draft for a real episode (CL24) — not
hypothetical bugs.

1. **Cue sheets no longer apply the +1hr master-timecode shift.** Cue sheets
   use program-relative time by convention (matches how music licensing
   actually reads timecodes); the Lower Thirds/Textless logs still use master
   TC as before, unaffected.
2. **All audio tracks are scanned by default** (previously required manually
   checking each track first).
3. **Same-song merging is grouped by (title, composer) before merging by
   time**, not merged in raw timeline order — fixes crossfades (same song on
   two tracks at once) and straight-cut splits merging incorrectly when an
   unrelated clip's own occurrence happened to land between them in absolute
   timeline order.
4. **Obvious SFX filenames are filtered out entirely** (woosh/whoosh/swoosh,
   glitch, click(s), tick(s), boom(s), impact(s), riser(s)) — word-boundary
   matching, custom (not `\b`, which treats `_` as a word character and
   would miss `Glitch_FX_02.wav`).
5. **`"Composer Audio Extracted"` / `"Composer Audio Extracted_1"` filename
   suffix is now stripped from the composer field.** This was the real root
   cause of "one song, cut and faded across several segments, showing up as
   several separate cues" — Epidemic's own naming for an alternate derivative
   of the same track was making segments of the same song look like
   different composers, so they never merged. Confirmed against the real
   CL24 PDFs: "When They Shut Their Eyes" (3 v1 rows → should be 1) and
   "Feeding the Animals" (3 v1 rows → should be 1) both had exactly this
   pattern.
6. **Clips not matching Epidemic's own naming convention no longer default to
   "Epidemic Sound AB."** Two real clips in CL24 ("terrifying-journey-SBA-...",
   "horror-story-SBA-...") are actually **Soundly** tracks, not Epidemic — the
   old code guessed Epidemic for anything it didn't recognize, which is a
   real risk on a document with legal/licensing weight. Now: composer and
   publisher default to `"NA"` unless the filename actually matched
   Epidemic's `ES_Title - Composer` format; society/usage still default
   normally since "direct license, background instrumental" is genuinely
   true across every stock library this show uses.
7. **Tracks disabled in the Premiere timeline are meant to be excluded
   entirely** — `lib/premxml.js` now parses each track's own `<enabled>` tag
   (previously only clip-level `<enabled>` was read, for the unrelated
   textless-swap feature) and the renderer filters on it. **This part is
   verified only against a synthetic test XML I constructed myself** (a
   `<track><enabled>FALSE</enabled>...` block) — **the user has reported
   real disabled tracks are still showing up in real exports**, meaning my
   assumption about how Premiere's actual FCP XML export represents a
   disabled/muted track is probably wrong. Needs a real sequence XML export
   (from a project with a known-disabled track) to inspect and fix properly
   — I was not able to find one already sitting in the one real Dropbox
   project folder I searched.

All of the above (items 1–6) are covered by real regression tests — both the
project's own `test/verify.js` (105/105) and standalone scratch scripts that
replayed the exact real filenames from the CL24 documents. Those scratch
scripts were session-local (in Claude's scratchpad, not this repo) — if
regression coverage for the cue-sheet logic specifically is wanted going
forward, it isn't in `test/verify.js` yet (that file only syntax-checks the
renderer's inline script, per its own established convention — see
`CLAUDE.md` §5 — it doesn't unit-test individual inline functions). Worth
deciding whether to add real coverage for `buildMusicCues`/`parseES` there.

## Open, unresolved, explicitly not guessed at further

1. **Disabled-track exclusion doesn't work on real exports** (see item 7
   above). Blocked on a real sample XML.
2. **A specific real song ("Deep Tunnels.wav") wasn't detected** by the cue
   sheet builder in some real project, reported by the user. Never
   investigated — no root cause found, no fix attempted. Worth checking
   whether it's related to the SFX-keyword filter (item 4 above) matching
   something unexpected in the *full* real filename, or something else
   entirely — genuinely unknown, don't assume.
3. Whether to fix the stale `README.md`/`INTEGRATION.md` content described
   above, or leave them as historical record with this note as the
   correction layer.

## Testing convention (already in CLAUDE.md, repeated here because it's easy
to miss)

`node --check` every `lib/*.js` file plus `renderer/index.html`'s inline
`<script>` (extracted via regex in `test/verify.js` itself — see that file
for the exact extraction pattern before assuming a different test runner is
in play). Functional tests generate synthetic media with ffmpeg lavfi filters
at runtime — there are deliberately no binary fixtures checked into the repo.
