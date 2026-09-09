# Export Distribution List — THE SPEC OF RECORD

This is Insanity Media's internal delivery standard, derived from the Fox
Acquisition Delivery Requirements but scoped to what actually applies to our
shows. **When this document and the original Fox PDF disagree, THIS WINS.**

Context: the Fox deal is not currently being pursued. These standardized
exports exist so episodes are ready for any future distribution (TV, streaming).
The spec is therefore generic — not Fox-specific.

---

## Video — 3 versions per episode

1. **Texted Video** (16 embedded audio tracks)
2. **Textless Video** (graphics present, text removed)
3. **Textless Video With No Graphics** (fully clean plate)

### Video specs
| | |
|---|---|
| Codec | ProRes 422 HQ |
| Wrapper | QuickTime MOV |
| Resolution | 1920 x 1080 |
| Display aspect | 16:9 |
| Pixel aspect | 1:1 |
| **Frame rate** | **29.97 (house standard — not 23.976/59.94)** |
| Scan | Progressive |
| Timecode | Same as source, meets head formatting |
| Timecode track | Present, meets head formatting |
| Bit depth | 10-bit |
| Color sampling | 4:2:2 |
| Color space | Legal Rec. 709 |

### Head format — ALL THREE videos
```
00:58:00:00  Black                         30s
00:58:30:00  Color bars + 1kHz @ -20dB     30s
00:59:00:00  Slate                         30s
00:59:30:00  Black                         30s
01:00:00:00  PROGRAM START
```
Tail formatting per spec. Every video version must match.

### Runtime targets
- **Half-hour format:** 23–26 minutes
- **Hour format:** 46–52 minutes
- **The format is decided per-episode by its actual length**, not chosen in
  advance — an episode lands in whichever window it falls into. QC reports the
  classification automatically (`classifyRuntime()` in `lib/checklist.js`).
- Export at the **longer end** of the range so it's easy to cut down later.
- The 2s segment blacks count toward runtime — don't land content at the ceiling.
- Varies by distributor — confirm before locking.

### All three video versions carry the full 16 embedded tracks
Texted, textless, and textless-no-graphics each get the identical 16-track
audio layout. The audio is the same across versions; only the picture differs.

---

## Audio — 16 embedded mono tracks (one channel per track)

1. Full Mix Left · 2. Full Mix Right · 3. Full Mix Center
4. Full Mix LFE · 5. Full Mix Left Surround · 6. Full Mix Right Surround
7. Full Mix Left Total · 8. Full Mix Right Total
9. Effects Left · 10. Effects Right
11. Music Left · 12. Music Right
13. M&E Left · 14. M&E Right
15. Narration · 16. Full Mix Mono

## Audio — 60 sidecar mono WAVs

| Stem | Configurations |
|---|---|
| Full Mix | 5.1 / 2.0 / 1.0 |
| M&E | 5.1 / 2.0 |
| Dialogue | 5.1 / 2.0 / 1.0 |
| Music | 5.1 / 2.0 |
| Effects | 5.1 / 2.0 / 1.0 |
| Mix Minus Narration | 5.1 / 2.0 |
| Narration | 5.1 / 2.0 / 1.0 |

### Audio specs
| | |
|---|---|
| Encoding | PCM uncompressed |
| Wrapper | WAV |
| Sample rate | 48 kHz |
| Bit depth | 24-bit |
| Bit rate | 1152 kbps per mono track |
| Channels per track | 1 |
| 2.0 files | separate mono tracks, OR Lt/Rt when derived from the 5.1 master |
| 5.1 order | L · R · C · LFE · Ls · Rs |
| Timecode | WAVs match the master's timecode (head/tail padded) |

---

## Data

- **SCC** — matched to master timecode + frame rate
- **CSV timings sheet** — matched to master timecode

---

## Documents (19)

| # | Document | Source |
|---|---|---|
| 1 | Music Cue Sheet | app draft → review |
| 2 | Textless Materials Log (timecode + scene desc.) | app draft → review |
| 3 | Music Licenses | collect (Epidemic certificates) |
| 4 | **Third Party Licences (graphics, footage)** | app template |
| 5 | Broadcast Script | app draft from SCC → review |
| 6 | Segment Timing Sheet | app draft from markers |
| 7 | Credits | app template |
| 8 | Cast / Crew | app template |
| 9 | Synopsis | app template |
| 10 | Logline | app template |
| 11 | Lower Thirds Log | app draft → review |
| 12 | Copyright Line | app template |
| 13 | Dubbing & Subtitle Restrictions | app template |
| 14 | Talent Restrictions + Approvals Chart | app template |
| 15 | Ad/Pub Restrictions | app template |
| 16 | Placement Declaration | app template |
| 17 | Tradeout Declaration | app template |
| 18 | **Title Search Report & Legal Opinion** | ordered from a clearance company |
| 19 | **Copyright Search Report** | ordered from a clearance company |

### Items 18–19 — what they actually are

Both are **purchased from a clearance vendor** (Clearance Unlimited, Dennis
Angel, Thomson & Reuters), not authored in the app. The app tracks their status
and files the received PDFs.

- **Title Search Report & Legal Opinion** — the vendor searches whether the
  show's *title* is safe to use (conflicting trademarks, other productions with
  the same name) and a lawyer issues an opinion letter clearing it. Generally
  per-series rather than per-episode.
- **Copyright Search Report** — a search of Copyright Office records confirming
  no one else claims the underlying material and the chain of title is clean,
  also with a legal opinion.

Two rules that come with them:
1. **Must be dated within 60 days of the delivery date** — order them late, not
   early, or they go stale.
2. **Do not order until the distributor approves the title.** Titles change, and
   a re-order is a second bill. With no active distribution deal, these stay
   tracked-but-unordered.

Vendors will often combine both into a single report + opinion — ask for that.

---

## Notes on scope

- Feature-only items from the original PDF (billing block, separate main/end
  credits) **do not apply** — this is episodic.
- Composer Agreement does not apply while all music is library-licensed
  (Epidemic). If original score is ever commissioned, it returns.
- Runtime & Extension Log is an internal working document, not a deliverable.
