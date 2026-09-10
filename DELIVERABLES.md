# Streaming Distribution - Spec of Record

The delivery target is the source of truth. Do not merge requirements from
different platforms into one contradictory preset. The app currently exposes:

- **General AVOD / TVOD / SVOD** - the supplied Internal Material Delivery
  Checklist and 18-column catalog sheet.
- **Filmhub** - Filmhub's official, current asset requirements, verified on
  2026-09-09. Re-check the live contract/help center before an actual delivery.
- **Custom / Contract** - manual gates for a signed specification that has not
  been encoded as a preset.

## Universal episode record - 18 columns

Export these columns in this exact order:

1. SERIES NAME // FILM NAME
2. SEASON #
3. EPISODE #
4. EPISODE TITLE
5. CAST
6. CREW
7. SERIES/ VIDEO DESCRIPTION
8. ORIGINAL PREMIERE DATE
9. SUBGENRE
10. RUNTIME
11. KEYWORDS
12. COUNTRY OF ORIGIN
13. VIDEO QUALITY
14. CLOSED CAPTIONING
15. IMDB
16. AD INTEGRATION
17. CALL TO ACTION
18. YOUTUBE LINK

The app enforces the visible sheet rules: description <=120 characters, at
least three comma-separated cast names, at least three comma-separated
keywords, MM/YYYY premiere date, whole-minute runtime, HD/SD, TRUE/FALSE, and
valid IMDb/YouTube URLs. Exact destination dropdown vocabulary and the IMDb
distributor listing remain manual checks.

## General AVOD / TVOD / SVOD

### Clean video/audio master

- Program only: no broadcast bars, tone, slate, leader, or textless tail.
- Minimal black at the head/tail.
- H.264 high-bitrate mezzanine, 1920x1080 progressive, approximately 9 Mbps or
  higher.
- AAC audio, 48 kHz, standard bitrate.
- Keep a ProRes or similar high-quality master on standby.
- Consistent, human-readable versioned filenames.

### Captions

- SRT or VTT for every episode, synchronized to the final clean program.
- Human review for accuracy, completeness, sync, spelling, punctuation, and
  placement.
- SCC only if a particular destination asks for it.
- Foreign-language captions/dubs only for an international target.

### Artwork

- Landscape key art: 1920x1080, with layered source retained.
- Per-episode thumbnail: 1920x1080.
- Vertical/poster art: 3150x4200.
- Square art with title treatment: 1080x1080.
- Square art without title treatment: 1080x1080.
- Keep layered working sources for reformatting and localization.

### Compliance and operations

- Log frame-accurate ad-break/chapter timecodes per episode.
- Review baked-in sponsor reads against the target's integrated-ad rules.
- Review/remove calls to action, hyperlinks, and promotional references that
  violate the target's rules.
- Confirm portal/FTP/API method, rights, and E&O/insurance needs before delivery.

## Filmhub profile

Based on Filmhub's official help center as verified 2026-09-09:

- Clean program only; at most two seconds before/after, starting and ending on
  at least one black frame.
- No bars, slate, tone, leader, timecode stream, padding, burned-in full-program
  captions, watermarks, URLs, promos, release dates, or platform/social links.
- Preserve native resolution and native supported frame rate. Supported rates:
  23.976, 24, 25, 29.97, 30, 50, 59.94, and 60.
- ProRes 422/HQ or DNx preferred. H.264/H.265 requires at least 15 Mbps for HD
  (50 Mbps for 4K); do not upscale/downscale just to hit a preset.
- Include a discrete, center-balanced stereo mix. PCM >=48 kHz/16-bit; AAC or
  MP3 >=128 kbps stereo; AC-3 >=192 kbps stereo.
- English SDH SRT preferred. SCC is acceptable only when it is the only source;
  VTT is not accepted.
- Caption limits checked by the app: <=43 characters/line, <=2 lines/event,
  0.6-8 seconds/event, >=42 ms gaps, <=25 characters/second.
- Required title art: 2:3 at >=1400x2100, 3:4 at >=1575x2100, and landscape
  16:9 at >=1920x1080. Shows additionally require 4:3 at >=1920x1440.
  Episode/season images and textless 16:9 assets are textless. Filmhub upload
  art is JPEG/PNG; layered source stays in the internal archive.
- Chapters/ad breaks are metadata, not content burned into the video. Follow
  the platform spacing rules and validate them against the final program.

## Completion gates

No title is ready until video/audio, captions, artwork, metadata, content
compliance, naming, rights, and delivery method are reviewed together.
Machine-readable checks never replace the clearly marked MANUAL watch,
listen, sync, art-quality, sponsor/CTA, metadata-truth, rights, and upload checks.

## Advanced and optional tools retained on every episode

The existing paperwork generators, ProRes/broadcast builder, segment timing
data, textless/clean-plate tools, render-farm automation, 16-track embedding,
60 WAV sidecars, and SCC utilities remain available. They are **not universal
requirements**, but they can be opened whenever the operator decides that a
delivery, archive, or internal workflow needs them.
