# HANDOVER — 2026-11-06 announcer deploy fix + highlights pipeline repair

Merged via PR #1 (squash, commit e9959f2): "fix: deploy Week 9 announcer crews and repair highlights pipeline".

## What was wrong

1. **Week 9 crews never reached the live site.** The weekly announcer audit bot committed verified crews with `[skip ci]`, which suppressed *all* workflows — including Deploy to GitHub Pages. Data was on `main`, the live site stayed on the 3 Nov build and showed "Crew TBA" for every Sunday game.
2. **Highlights link opened the generic NFL YouTube channel.** `scripts/update-highlights.mjs` only scanned hardcoded weeks 1–8, and it *regenerated* the whole registry from scanned weeks — running it for one week wiped the others. With no verified entry, the UI fell back to a channel-search URL that mobile YouTube opens as the plain channel page.
3. **NYG@PHI crew was merged into one name** ("Greg Olsen Pam Oliver") because the Yahoo source omits a comma between role segments.

## What changed

- `weekly-announcer-audit.yml` now dispatches the Pages deploy explicitly after committing registry updates (`[skip ci]` retained so the bot push does not re-trigger the audit itself).
- New `weekly-highlights-update.yml`: daily 13:00 UTC ingestion of verified official highlights; commits **without** `[skip ci]` so updates deploy.
- `update-highlights.mjs` scans up to the current ESPN week and merges per key; it never deletes previously verified entries.
- `update-announcers.mjs` splits role segments even when the source drops the comma.
- Registries: verified JAX@BAL Week 9 video added; NYG@PHI corrected (Olsen analyst, Oliver sideline).
- UI shows an honest **"Highlights Pending"** state when no verified video exists, instead of a link dressed up as game highlights.

## Verified before merge

- 242/242 node tests, `tsc` + `vite` production build, live `audit:announcers` (all games within 72h verified).
- All 11 files byte-verified against locally tested copies; every Week 9 crew cross-checked against the cited Yahoo/ABJ article; JAX@BAL video title-confirmed via YouTube.

## Watchouts

- Week 10+ crews legitimately stay "Crew TBA" until networks publish pairings (usually Tue/Wed). Do not fill from memory.
- GitHub's upload UI now prefixes batch-position numbers into real filenames ("2-file.ext"). Prefer the in-place editor, or rename immediately after upload.
