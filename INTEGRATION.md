# Integrating the Distribution toolkit into the Insanity extension

Based on inspection of `insanity-extension-main` (June 2026 snapshot).
**This supersedes PORTING-TO-CEP.md, which was written before seeing the repo
and assumed CEP. The target is UXP.**

---

## What the Insanity repo actually is

| Part | Tech | Status |
|---|---|---|
| `insanity-premiere` | **UXP** (TS + webpack), 5 tabs | the live Premiere panel |
| `insanity-premiere-cep` | CEP, one 400KB bundled `index.js` | legacy; *does* locate ffmpeg (`findFoiaFfmpegPath`) |
| `insanity-aftereffects` | CEP | AE automation: `render-manager.jsx`, `bridge-reader.jsx` |
| `insanity-dashboard` | Node/Express, Docker/Railway | web service + installer downloads |

**Tab registration is trivial** — `src/ui/panel.ts` holds:
```ts
const TABS = [
  { id: "dynamic-link", label: "Dynamic Link", create: createDynamicLinkTab },
  …
];
```
Adding ours = one array entry + one `createDistributionTab(panel: HTMLElement)`
file. That part is a 20-minute job.

---

## The hard constraint

**UXP is sandboxed. It cannot run ffmpeg, `child_process`, or arbitrary
binaries.** Nothing in `insanity-premiere` does — the only ffmpeg reference in
the whole repo is in the *legacy CEP* bundle.

So `lib/qc.js`, `stemforge.js`, `build.js`, `ocrverify.js` **cannot run inside
the panel**. Any plan that says "just move lib/ in" is wrong for this target.

## The good news: they already solved every adjacent problem

1. **`http://localhost:3000` is already whitelisted** in `manifest.json`
   `requiredPermissions.network.domains`. A local service is anticipated.
2. **Bridge pattern for cross-app jobs**: `.insanity/bridge.json` in the project
   root. Premiere UXP writes messages; the AE CEP extension's
   `bridge-reader.jsx` polls and executes them, writing status/response back.
3. **AE render automation already exists**: `render-manager.jsx` →
   `renderActiveComp()`, `findMainComp()`, `findRendersFolder()`,
   `getNextVersionNumber()`. It renders `COMPNAME_V#.mov` with auto-versioning.
   **This is the origin of the `V2`/`V3` suffixes our textless matcher had to
   handle** — mystery solved, and it means we should generate textless renders
   *through their manager* rather than fighting its naming.
4. **Notion client exists**: `services/notion.ts` — `NotionClient`,
   `syncCompToNotion`, `syncRenderToNotion`. Plus `services/settings.ts` for
   credential storage.
5. **The UXP API reads the timeline directly**: `require("premierepro").app
   .project.activeSequence`, tracks, clips, `projectItem.getMediaPath()`.

Point 5 is the big one: **cue sheets, text logs and segment timings can be read
live from the sequence — no XML export at all.** That deletes the most
error-prone step in the workflow (users forgetting to click the timeline first)
and sidesteps every XML parsing bug in `premxml.js`.

---

## Recommended architecture

```
┌─ Premiere ──────────────────────────────┐
│  Insanity panel (UXP)                   │
│   └─ NEW "Distribution" tab             │
│       · reads sequence via premierepro  │  ← replaces XML export
│       · shows episode status / buttons  │
│       · writes AE jobs to bridge.json   │  ← replaces our osascript hack
│       └─ fetch() ──────────────┐        │
└────────────────────────────────┼────────┘
                                 ▼
                    ┌─ localhost:3000 ─────────────┐
                    │  Distribution service (Node) │
                    │  = our existing lib/ engine  │
                    │  · QC · stem grid · master   │
                    │  · OCR · PDF · Notion        │
                    └──────────────────────────────┘
                                 ▲
┌─ After Effects ─────────────────┼───────┐
│  Insanity AE extension (CEP)    │       │
│   · bridge-reader polls jobs ───┘       │
│   · render-manager does textless renders│
└─────────────────────────────────────────┘
```

**Three components, each doing what it's good at.** Our `lib/` engine survives
intact — it just gets an HTTP wrapper instead of Electron IPC.

### Why not "everything in the panel"
Impossible — UXP can't run ffmpeg.

### Why not "leave it as a separate Electron app"
Also viable, and lower effort. The tab-based version wins because the panel can
read the sequence live (killing the XML step) and reuse their AE bridge. If
effort is the constraint, ship the separate app and add the tab later — the
service layer is the same either way.

---

## Work plan

**Phase 1 — service layer (no repo changes yet)**
Wrap `lib/` in a small HTTP server (`service/server.js`), one route per
operation: `/qc`, `/stems/build`, `/stems/embed`, `/master/build`,
`/textless/clean-xml`, `/docs/export`, `/notion/*`. Keep the Electron app
working against the same routes so nothing breaks while porting.
*Deliverable: `curl localhost:3000/qc -d '{"file":"…"}'` returns QC rows.*

**Phase 2 — the tab (additive, low risk)**
Branch: `distribution-tab`. Add `src/ui/distribution-tab.ts` + one TABS entry.
Port the UI section by section, matching their existing tab conventions and
`styles.css`. Each button calls the service via `fetch`.

**Phase 3 — replace XML with live sequence reads**
Implement cue detection, graphics logs, and marker→timings against
`activeSequence` instead of `premxml.js`. Keep `premxml.js` as the offline
fallback. Port the detection *rules* (Epidemic naming, SFX exclusion, stem
merging) — they're proven and independent of the data source.

**Phase 4 — textless via their AE bridge, or via Nexrender**
Standalone app now submits Textless Factory renders to Nexrender (`lib/nexrender.js`)
rather than driving local AE via osascript — that path can likely be reused as-is
inside a panel host too, sidestepping the need for a bridge message entirely. If a
host-side bridge is still wanted, extend their `render-manager.jsx` with a "render
textless" variant: disable TextLayers + `TXT_`-prefixed + label-9 layers (same rule
as `buildDisableScriptJsx` in `lib/nexrender.js`), then reuse their existing
queue/versioning.

**Phase 5 — consolidate Notion**
Decide: keep our `notion.js` (episode catalog, QC push) or fold into their
`NotionClient`. Likely keep ours and share credentials via their
`services/settings.ts`.

## Safety rails (shared team repo)

- Branch first: `git checkout -b distribution-tab`. Additive changes only.
- Don't touch `insanity-premiere-cep` (legacy) or restructure their code.
- Talk to the repo owner before Phase 4 — it modifies shared AE host scripts.
- Never commit tokens: `git grep -nE "(ntn_|secret_)[A-Za-z0-9]{20,}"` must be
  empty before every push.
- Run `npm test` (our `test/verify.js`, 32 checks) after touching `lib/`.
