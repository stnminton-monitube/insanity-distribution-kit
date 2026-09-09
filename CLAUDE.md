# Media Distribution Toolkit — context for Claude Code

Guided delivery pipeline for episodic TV: QC, mastering, textless generation,
paperwork drafting, Dropbox filing, Notion tracking. Built for a true-crime
bodycam documentary series delivering to a traditional broadcast distributor.

## ⚠️ READ FIRST: `DELIVERABLES.md` is the spec of record

`DELIVERABLES.md` is Insanity Media's internal Export Distribution List — the
authoritative definition of what ships. It is derived from the original Fox
Acquisition PDF but scoped to what actually applies to these shows.
**Where DELIVERABLES.md and the Fox PDF (or §2 below) disagree, DELIVERABLES.md
wins.** `lib/checklist.js` mirrors it exactly; keep them in sync.

Current focus: **improving the standalone app** through a live delivery trial.
A later goal is a Premiere-panel tab — see `INTEGRATION.md` — but that is NOT
the current task and must not destabilise the working app.

---

## 1. Architecture

```
lib/            ← THE ENGINE. 14 modules, pure Node (fs/path/os/child_process).
                  ZERO Electron imports. This is what ports to any host.
main.js         ← Electron shell: IPC handlers, dialogs, PDF export, keepAwake.
                  Thin wrapper — replace when porting.
preload.js      ← contextBridge exposing IPC as window.feg.*
renderer/       ← Single-file UI (index.html, inline CSS+JS). Calls window.feg.*
```

**Porting principle:** `lib/` moves unchanged. `main.js`/`preload.js` are the
only Electron-specific code. The renderer's `window.feg.*` calls must be
re-pointed at whatever the host provides (in CEP with Node enabled, they can
`require()` the lib modules directly and skip IPC entirely).

### Module map

| Module | Does |
|---|---|
| `qc.js` | ffprobe-based spec validation → pass/warn/fail rows |
| `build.js` | Broadcast master: bars/tone/slate/black head, TC 00:58:00:00 |
| `stemforge.js` | 5 stems → 60-file spec grid; embeds 16 tracks; pads sidecars |
| `premxml.js` | Premiere FCP XML parse, textless/clean XML rewrite, nested harvest |
| `sccparse.js` | SCC (CEA-608) + SRT parse; ±1hr retime |
| `aepinspect.js` | Local AE: find AEPs, disable text layers + save a `_TEXTLESS` copy |
| `renderfarm.js` | Queues renders on the user's own Notion/Dropbox render farm |
| `ocrverify.js` | tesseract.js frame sampling to catch leftover on-screen text |
| `intake.js` | WAV/timings/extension checks + versioned filing into Dropbox |
| `notion.js` | Notion API: list/update episodes, push QC results |
| `templates.js` | 14 document templates (cue sheet, logs, declarations…) |
| `stages.js` | 10 workflow stages + their explanatory content |
| `guide.js` | 24-step Guided Mode runbook, each with an inline SVG diagram |
| `checklist.js` | Deliverables checklist definitions |
| `ffbin.js` | Resolves bundled ffmpeg/ffprobe paths (asar-aware) |

---

## 2. Delivery spec (background — `DELIVERABLES.md` overrides this)

**Video master:** QuickTime MOV · ProRes 422 HQ @1920x1080 · 16:9 · square
pixels · progressive · **29.97 house standard** · 10-bit 4:2:2 · Legal Rec.709.
(The wider spec also permits 23.976/59.94 and UHD ProRes 4444 XQ; the app warns
rather than fails on those. Three video versions ship per episode: texted,
textless, and textless-with-no-graphics.)

**Runtime:** half-hour 23–26 min · hour 46–52 min. Export at the LONG end so
trims are easy. Varies by distributor — confirm before locking.

**Head/tail (EVERY master, not just long ones):**
```
00:58:00:00  black 30s
00:58:30:00  bars + 1kHz tone @ -20dB  30s
00:59:00:00  slate 30s
00:59:30:00  black 30s
01:00:00:00  PROGRAM STARTS          ← the "1 hour" is a timecode label
             tail: 2s black (or textless block)
```
File is program + 2m02s. Nothing is an hour long. Timecode is metadata; frames
don't move. Two-hour episodics are delivered as two one-hour files, each wrapped.

**Segments:** 2 seconds of true black between broadcast segments (ad breaks).
Blacks count toward runtime. Duration markers span segment CONTENT; the 2s
blacks sit in the gaps between markers.

**Audio — 16 embedded tracks:**
1–6 5.1 Full Mix (L R C LFE Ls Rs) · 7–8 2.0 Full Mix (Lt Rt) · 9–10 Effects
· 11–12 Music · 13–14 M&E · 15 Narration · 16 Mono Full Mix.
All PCM 48kHz/24-bit, one channel per track, labeled in metadata
(QuickTime stores these as `handler_name`, not `title`).

**Audio — 60 sidecar mono WAVs** (the grid):

| Stem | 5.1 | 2.0 | 1.0 |
|---|---|---|---|
| Full Mix | ✓ | ✓ (Lt/Rt) | ✓ |
| Music & Effects | ✓ | ✓ | — |
| Dialogue | ✓ | ✓ | ✓ |
| Music | ✓ | ✓ | — |
| Effects | ✓ | ✓ | ✓ |
| Mix Minus Narration | ✓ | ✓ | — |
| Narration | ✓ | ✓ | ✓ |

= 18 stem deliverables = **60 mono files** (42 + 14 + 4). Sidecars must be
padded to match the master's head/tail.

5.1 layup from stereo sources: dialogue/narration → Centre; music/effects →
L/R with surrounds at −6dB and LFE low-passed at 80Hz.

**Textless:** same specs as texted, delivered SAME DAY, slate reads
"TEXTLESS VERSION" (texted slate says "Textless at Tail" only if applicable).
Where text sits on a graphic, BOTH a textless-graphic version AND a fully clean
(no graphic) version are required.

**Captions:** SCC (CEA-608) required, pop-on, UTF-8, timed to master TC.
**Rejections:** ZIP delivery · wrong naming · missing textless · ads · burned-in
captions · QuickTime edit lists.

**Unscripted allowance:** M&E may be "Optional" (not fully filled) when that's
the best available — relevant because bodycam dialogue and ambience are
inseparable on single-mic source.

---

## 3. Hard-won bugs — DO NOT REGRESS

Each of these cost real debugging time. Regression tests live in `test/`.

### Premiere XML parsing (`premxml.js`)
1. **Nested sequences truncate naive parsing.** 280+ nested sequences in a real
   project. Parser is depth-aware (`topBlocks` tracks nesting); never use lazy
   regex across `<sequence>` boundaries.
2. **The master's audio section is written LAST**, after every nested sequence's
   own audio. Find the master's section by requiring `<track>` children AND
   starting after the video section ends.
3. **Crossfaded clips have `start`/`end` = −1.** Recover from `<in>/<out>`
   length, neighbouring `<transitionitem>` bounds, or `pproTicksIn`
   (254016000000 ticks/sec). If BOTH ends are unresolvable, DROP the clip —
   guessing creates phantom cues at 00:00:00:00.
4. **Stereo tracks appear as two XML tracks.** Merge adjacent pairs when ≥70% of
   clips overlap, taking the union. XML track order ≠ Premiere timeline
   numbering — never present XML indices as "A9"; label them neutrally.
5. **File descriptors contain `<video>`/`<audio>` metadata blocks** that aren't
   track sections. Filter by presence of `<track>`.

### ffmpeg (`stemforge.js`, `build.js`)
6. **Copying a sparse `tmcd` timecode track across an 80GB mux makes ffmpeg
   buffer unboundedly → SIGKILL ~60%.** Read the timecode VALUE and stamp a
   fresh track with `-timecode` instead of `-map`ing the data stream.
7. **Premiere markers become QuickTime chapter tracks** that break selective
   stream mapping ("Referenced QT chapter track not found"). Use
   `-ignore_chapters 1` and `-map_chapters -1`.
8. **Stream-copy drops Rec.709 color tags.** Re-stamp with
   `-bsf:v prores_metadata=color_primaries=bt709:color_trc=bt709:colorspace=bt709`
   (note: the option is `colorspace`, NOT `matrix_coefficients`).
9. **Dropbox/iCloud online-only placeholders** report full size but ~0 blocks;
   reading them mid-render gets the process killed. Preflight checks
   `st.blocks * 512 < st.size * 0.5`.
10. **Never overwrite an existing output** — a crashed partial may be mid-sync
    in Dropbox and fighting the sync daemon kills ffmpeg. Version instead.
11. Long jobs need `powerSaveBlocker` (Electron) or equivalent — sleep kills renders.

### After Effects / render farm (`aepinspect.js`, `renderfarm.js`)
Textless Factory Step 1 tried a hosted Nexrender Cloud path for a while
(zip packaging, footage trimming, per-layer relink by composition ID) —
that's gone now that the user has their own working render farm (a
separate Notion-triggered, Dropbox-sourced Windows GPU box; see its own
repo). That farm resolves footage itself, so this app's job shrank back
down to: find AEPs, and for the "text off" pass, disable text layers
locally and save a copy — closer to this app's very first local-render
automation than to the Nexrender era. `lib/aepinspect.js` drives AE via
`osascript`; `lib/renderfarm.js` talks to the farm's own Notion databases
(a `MGX:`-titled inline database per project, `Render` select property set
to `Queue` triggers a render there) and Dropbox API (to confirm a just-saved
file has actually synced before queuing it).
12. **`application id "com.adobe.AfterEffects"` fails on newer versions.**
    Scan `/Applications` for the real app name and address it by name.
13. AE must have *Preferences → Scripting & Expressions → Allow Scripts to
    Write Files* enabled, or the sentinel file below never gets written and
    the app just times out with no useful signal.
14. Skip auto-save folders, `_TEXTLESS` copies, and projects with zero text
    (`scanAeps` in `lib/aepinspect.js`) — and skip the save entirely, not
    just the disable, when a project has no text layers at all (nothing to
    queue as "textless").
15. The generated JSX writes a JSON sentinel file that the host polls for
    completion — AE gives no other progress signal, and this is still true
    even though rendering itself now happens on the farm, not here.
16. **This engine's ExtendScript does not reliably support
    `Array.prototype.map`** inside a `DoScriptFile`-driven script — not just
    in "real" logic, even in the sentinel-writing tail of a script. Using it
    anywhere throws `ReferenceError: Function X.map is undefined` and takes
    down the whole script with it (hit this for real, on a real batch, before
    it was fixed). Build result arrays with a plain `for` loop, everywhere,
    no exceptions.
17. **The render farm's Notion API can't add options to a `status`
    property** — that's why its trigger is a separate `select` property
    (`Render`), not the artist's own `Status` column. Don't try to reuse
    `Status` for queuing.
18. **A Dropbox API path is not a local Mac path.** `AEP Path` on a farm row
    must be the path as Dropbox's API sees it (e.g. `/Insanity/Video/...`),
    not the local Finder path (`/Volumes/.../Insanity Media Dropbox/...`) —
    `localPathToDropboxPath` strips everything up through the configured
    Dropbox team-folder anchor to convert between the two.
19. **A just-saved local file needs a moment to actually reach Dropbox's
    servers** before the farm (which downloads via the Dropbox API, not
    local sync) can see it. `waitForDropboxFile` polls `get_metadata` with a
    timeout and fails loudly, naming the path, rather than silently queuing
    a row the farm will fail to download.

### Music cue sheet
20. **Cue detection must be song-level, not track-level.** Users cannot reliably
    map XML track indices to their timeline. Detect songs across ALL audio
    tracks, present a checklist of `TC · Title — Composer`.
21. Epidemic naming: `ES_[id_]Title - Composer[_stem].ext`. Their **SFX**
    catalog files are comma-lists ("Pen, Ballpoint Pen, Write On Paper") or end
    in `- Epidemic Sound` — those are NOT cue-sheet music.
22. Merge stem layers (`_melody`, `_drums`, `_bass`) and split clips of the same
    song within a 2s gap into one cue.

### Timecode
23. **All delivered paperwork uses MASTER timecode** (program at 01:00:00:00),
    while the Premiere sequence starts at 00:00:00:00. Every generated document
    and CSV shifts +1 hour. The XML itself stays in sequence time.

---

## 4. Conventions

- **No new dependencies** without good reason. Current deps: `ffmpeg-static`,
  `ffprobe-static`, `tesseract.js`. Everything else is Node stdlib. The XML
  parser is hand-rolled deliberately (28MB files, no DOM overhead).
- **Never re-encode the program.** Head/tail assembly and audio embedding are
  stream-copy only.
- **Fail loudly with actionable messages.** Every error should name the cause
  and the fix (see `ffProgress`'s SIGKILL message as the model).
- **The user is not a developer.** UI copy must be plain-language; errors must
  say what to click. No jargon in user-facing strings.
- **Machine-checkable vs human:** the app validates containers/specs; picture
  quality, audio track ORDER by ear, caption sync, and document truth are
  explicitly human steps (surfaced in the Deliver stage).

## 5. Testing

`node --check` every JS file plus the renderer's inline script (extract with
the regex in `test/`). Functional smoke tests generate synthetic media with
ffmpeg lavfi sources — no fixtures in the repo. Verified paths: QC on a
16-track ProRes, stem grid → 60 files, embed → 16 labeled tracks, intake
checks, caption retime, XML parse/rewrite on a real 28MB project export.

## 6. This user's specific setup

- **Show:** true-crime, bodycam + FOIA footage, added narration. Unscripted.
- **Runtime target:** 46–52 min, aiming ~51:30, 5–6 segments.
- **Music:** Epidemic Sound subscription (verify the tier covers broadcast).
- **Storage:** per-episode Dropbox folders; app files into a `Distribution`
  subfolder (`01 Master`, `02 Textless`, `03 Audio Stems`, `04 Captions`,
  `05 Segment Timings`, `06 Docs`).
- **Notion:** "Distribution Catalog" database (`lib/notion.js`) for episode
  tracking, and a separate integration/token for the render farm's own
  per-project `MGX:` databases (`lib/renderfarm.js`) — two different
  workspaces/tokens, both stored in userData settings, neither in the repo.
- **Graphics:** After Effects, mix of rendered files and live Dynamic Link.
  Baked text needs a `TXT_` prefix or label colour 9 to be auto-detected.
- **Render farm:** a separate Windows GPU box, Notion-triggered
  (`Render: Queue` on a row) and Dropbox-API-sourced — resolves footage
  itself, so this app only needs to queue the right file at the right path.
