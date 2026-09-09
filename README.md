# Media Distribution Toolkit

A guided desktop app (Mac + Windows) for preparing episodes for traditional media distribution — QC, broadcast mastering, Dropbox filing, and Notion tracking in one workflow.

The specs it enforces are strong industry defaults for broadcast/international delivery. Always confirm your specific distributor's requirements.

## How it works

**Dashboard** — your episodes, pulled live from the Distribution Catalog in Notion, each showing pipeline status and per-asset progress dots. Click one to open it.

**Episode page** — set the episode's own Dropbox folder once (the app files everything into a `Distribution` subfolder inside it, and writes the path to Notion). Below that, the 8 workflow stages in order:

1. 🎬 Prep & Export · 2. 🎞️ Texted Master · 3. 🕳️ Textless · 4. 🎚️ Audio Stems · 5. 💬 Captions · 6. ⏱️ Segment Timings · 7. 📄 Paperwork · 8. 📦 Package & Deliver

**Stage pages** — every stage opens into a full explanation of what it is, why it matters, and the exact requirements — plus a drop zone. Drop a file and the app checks it (full QC for video, format checks for WAVs/captions/timings), files it into the right Dropbox subfolder (`01 Master`, `02 Textless`, `03 Audio Stems`, `04 Captions`, `05 Segment Timings`, `06 Docs`), and updates the episode's Notion row (asset status, QC notes, timestamps, Dropbox path). Video stages also offer **Build broadcast master** — wraps your export with bars/tone/slate/blacks (program at timecode 01:00:00:00) without re-encoding. Skip it when a distributor wants a clean program-only file.

Files are never overwritten — repeat drops get versioned (` v2`, ` v3`…).

## Setup

1. Install Node.js (LTS) from nodejs.org
2. Double-click `Start FEG Toolkit (Mac).command` (or the `.bat` on Windows). First run downloads components; the launcher self-repairs interrupted downloads.
3. In **Settings**: paste your Notion integration token + the Distribution Catalog database link. (Create the token at notion.so/profile/integrations, then add the integration to your Media Distribution Hub page via ⋯ → Connections.)

## Building installable apps

`npm run dist:mac` / `npm run dist:win` (run on the target platform) → installer in `dist/`.

## Known limitations (honest list)

- Not a substitute for your distributor's QC — picture quality, title safe, caption sync, and content rules stay human checks.
- Audio track ORDER can't be auto-verified — the app checks count/format only.
- Caption checks are file-type only; use a caption tool for sync/styling.
- Notion token is stored in a local settings file, plain text.
- Timecode on built masters is non-drop-frame.
- Get your distributor's naming conventions before delivering — the app deliberately doesn't guess them.
