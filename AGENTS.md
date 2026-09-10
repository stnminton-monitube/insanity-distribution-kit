# Agent instructions for this repo

Read `CLAUDE.md` first — it is the authoritative project context (architecture,
delivery spec, hard-won bugs not to regress, conventions, testing). Everything
in it applies regardless of which coding agent is working here; it isn't
Claude-specific despite the filename.

Then read `HANDOFF-TO-CODEX.md` for what changed most recently, what's
verified vs. still open, and known-stale documentation to be aware of.

## Fast facts

- `npm test` runs `test/verify.js` — 141 checks (syntax, structure, and real
  functional smoke tests using ffmpeg-generated synthetic media; no fixtures
  in the repo). Run it after touching anything in `lib/` or the renderer's
  inline script.
- `npm start` launches the actual Electron app (`electron .`) for manual
  verification — this is a real desktop GUI, not a web app; there's no dev
  server to preview in a browser.
- No new dependencies without good reason (see CLAUDE.md §4) — this repo is
  deliberately near-zero-dependency (`ffmpeg-static`, `ffprobe-static`,
  `tesseract.js` only).
- This repo has no git history before 2026-09-09 — it was just initialized
  fresh as part of this handoff, with one baseline commit capturing the
  verified-working state. Treat that first commit as the starting point, not
  as "everything before this is lost" — nothing was deleted, this is just
  when version control began.
