# Insanity Distribution Kit

A desktop app for preparing episodic or standalone titles for streaming
distribution. It combines platform-specific QC, an internal 18-column metadata
sheet, caption review, artwork slots, compliance tracking, filing, and optional
Notion sync.

`DELIVERABLES.md` is the maintained specification. Requirements are selected
per platform so Filmhub, the internal AVOD/TVOD/SVOD checklist, and future
contract specs never collapse into one conflicting preset.

## Primary workflow

1. **Target & Requirements** - select General AVOD/TVOD/SVOD, Filmhub, or a
   Custom/Contract profile.
2. **Metadata Sheet** - fill and validate all 18 destination-sheet columns;
   copy one tab-separated row or export CSV.
3. **Clean Program Master** - platform-aware video/audio QC with no broadcast
   bars, slate, tone, leader, or textless tail.
4. **Captions & Accessibility** - SRT/VTT/SCC acceptance by target plus
   structural quality checks and explicit human sync/accuracy review.
5. **Artwork & Key Art** - required/recommended slots, dimensions, aspect
   ratios, and layered-source retention.
6. **Ads, Sponsors & CTA** - sponsor/CTA decisions and frame-accurate ad-break
   or chapter logging.
7. **QC Gates & Delivery** - one completion board spanning video, captions,
   art, metadata, compliance, rights, naming, and delivery.

The old broadcast tools remain under **Advanced & optional tools** on every episode: paperwork, timing
data, render farm, textless/clean plates, ProRes wrapping, 16-track masters,
60 sidecar stems, and SCC utilities. You can open and use them at any time;
they simply do not block an ordinary streaming delivery when they are unnecessary.

Files are never overwritten. Repeated output names are versioned as ` v2`,
` v3`, and so on.

## Episode metadata

The internal sheet maps the destination spreadsheet exactly:

`SERIES NAME // FILM NAME`, `SEASON #`, `EPISODE #`, `EPISODE TITLE`,
`CAST`, `CREW`, `SERIES/ VIDEO DESCRIPTION`, `ORIGINAL PREMIERE DATE`,
`SUBGENRE`, `RUNTIME`, `KEYWORDS`, `COUNTRY OF ORIGIN`, `VIDEO QUALITY`,
`CLOSED CAPTIONING`, `IMDB`, `AD INTEGRATION`, `CALL TO ACTION`,
`YOUTUBE LINK`.

Drafts, selected platform, artwork assignments, compliance notes, and gate
states save locally. Notion is optional; without it, the dashboard stores local
episodes.

## Music cue review

Open **Paperwork & Documents → Music Cue Builder**. This dedicated four-step
workspace loads the Premiere XML, reviews enabled tracks, shows the visual music
timeline and cue rows, then creates an editable draft. Only WAV and MP3 assets
are considered music; MP4 embedded audio and every other format are skipped.
Likely music is selected by default, while uncertain candidates stay visible
and clearly marked for review.

The supplied shared Sound Effects directory is indexed as a hard exclusion.
Episode folders named `Sound Effects`, `SFX`, or `Sound Design` are detected as
additional cautious exclusions; an explicitly music-labelled or conventionally
named track is retained for review in case it was filed there accidentally.
Hovering a cue highlights its timeline pieces, and hovering a timeline piece
highlights the cue. Hovering a track row spotlights that lane. Exclusion folders
and the edit-merge gap are editable in Settings.

This creates a reviewable draft, not a licensing assertion. Confirm composition
title, writers, publisher, performer, PRO, usage, and timecodes before signing
or sending the generated cue sheet.

## Install for testing

Installers from GitHub Releases do not require Node.js or developer tools.

**Windows:** Download the latest EXE, double-click it, and follow the installer.
If SmartScreen appears because this internal trial is not code-signed, choose
**More info → Run anyway** only when the file came from this repository.

**macOS:** Download the latest DMG, open it, and drag the app to Applications.
If macOS blocks the unsigned internal trial, Control-click the app, choose
**Open**, then confirm.

The core streaming, metadata, caption, artwork, paperwork, XML, cue-sheet, and
QC tools work on Windows and macOS. Local After Effects text-layer automation
uses AppleScript and is macOS-only. Notion and the render-farm relay are
optional connections configured in Settings.

## Developer setup

1. Install Node.js LTS.
2. Run `npm ci`.
3. Run `npm start`.

Run `npm test` after changing anything in `lib/` or the renderer script.

## Building

Run `npm run dist:mac` or `npm run dist:win` on the target platform.
Installers are written to `dist/`. GitHub Actions builds both installers on
their native operating systems when a version tag such as `v2.1.0` is pushed.

## Honest limits

- A machine cannot replace the required end-to-end picture/audio watch,
  caption sync/accuracy review, artwork quality review, sponsor/CTA judgment,
  metadata fact-check, rights confirmation, or portal acceptance.
- Contract and platform requirements change. Reconfirm the live specification
  before delivery.
- Disabled individual Premiere clips carrying `<enabled>FALSE</enabled>` are
  ignored. Whole-track mute XML remains best-effort because it is not part of
  the production workflow described for this tool.
