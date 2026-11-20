# HANDOVER - 2026-11-20 matchup card clarity and provenance pass

Branch `fix/matchup-card-clarity`. Scoped to the hero matchup card and its shared win-probability bar, requested by Martin on WhatsApp (20 Nov 2026) after a duplication/data-journalism review of the pre-game card, with his follow-up instruction to "verify everything".

## What changed

**Duplication removed (pre-game card)**
- Deleted the "Tale of the Tape" / "Vegas Consensus" / "Broadcast & Venue" three-column panel. Every fact it held was already shown elsewhere: ranks and records (team rows), win probability (main bar), spread and total (bar strip), Scorigami forecast (Scorigami block), broadcast crew and venue (footer strip and header).
- Removed the second matchup-tier badge, the kickoff countdown badge and the second venue mention from that panel.
- Removed the empty pre-game score dashes; scores render only for live and final games.
- Record-derived decimal win percentages (.333 / .778) went away with the panel.
- One broadcast block remains: the full-width "US Announcing Crew" footer, which carries the verification badge and sources.

**Truthful labels and definitions**
- The probability bar now states its actual method instead of a bare "Vegas Moneyline" tag: "DraftKings moneyline, margin removed", "DraftKings spread estimate", or "No odds yet, home-field baseline", with a tooltip explaining the derivation and that the ESPN feed publishes no odds timestamp. Live states still say ESPN FPI / live analytic model.
- Rank pills now disclose their source on hover: publisher, edition week and verification date, and the movement arrow names the previous rank and edition.
- Scorigami wording is dataset-truthful, not history-absolute: "chance the final score is absent from the recorded dataset of 1,097 unique historical final scores" (scorigamicenter.com / Pro Football Reference, scores verified through 24 Sep 2026; games after that date are not yet in the dataset). The details panel states the model limits: independent team scoring, regulation only, indicative rather than exact. The collapsed value carries a visible "est." suffix. The projection line names the most likely unseen score as one possible route, since the percentage covers every unseen score. Final/live score-state labels say "Unseen in Dataset" / "x in Recorded Dataset", not "NFL history".
- Kickoff now shows the actual date with the time ("Sun 22 Nov, 18:00 GMT" in en-GB), not just a weekday.
- Weather only appears for open-air venues; indoor venues show "Indoors" (uses the ESPN venue `indoor` flag, now typed on `NFLCompetition.venue`).
- Team order is consistent: matchup rows, probability bar and odds all read away-then-home (the bar used to mirror them).
- Dropped the 25/50/75 axis clutter under the probability bar; the 50% centre tick stays.
- "Auto Red Zone" moved out of the card to a page-level control above the spotlight, since it steers the whole dashboard's spotlighting. The multi-threat banner keeps its own toggle.

## Verified against live sources (20 Nov 2026)
- ESPN scoreboard feed for TB at DET (Sun 22 Nov 2026, 18:00 GMT): records 3-6 and 7-2, spread DET -6, total 45.5, moneyline -257/+212. The displayed 69.2/30.8 is exactly the de-vigged DraftKings moneyline. Single book, so "Vegas consensus" was wrong and is gone.
- Ford Field: `indoor: true` in the ESPN feed, so the old "Cloudy" note was irrelevant; now suppressed.
- Announcer registry: Kugler/Johnston/Williams (FOX) verified 2026-11-19 for this game.
- Power ranks TB #16 / DET #3 come from the Yahoo Sports / FanSided Week 9 edition (verified 3 Nov), the latest in the registry. The edition is now named visibly beside each rank pill ("Yahoo Sports Wk 9") and on the tooltips, so touch users see the staleness without hovering. Note: the registry has no Week 10/11 edition, so ranks are ~2.5 weeks old at kickoff; the update:power-rankings script exists if a new edition should be ingested.
- Scorigami dataset: 1,097 unique score keys (matches TOTAL_UNIQUE_SCORIGAMIS), 18,267 summed occurrences, latest recorded game 2026-09-24. Method limits: fixed empirical per-drive outcome distribution, independent team scoring (no endgame correlation), fractional drives interpolated, regulation only (no overtime), drive counts derived from odds-implied totals pre-game. Treat the 0.1% display precision as indicative, not exact.

## Checks
- `npm run lint` clean, `npm run build` (tsc + vite) passes, `npm test` 250/250.

- Header chip row now wraps at all widths; at desktop the half-width column clipped the "View Field Layout" button under the intelligence panel.

## Watchouts
- The smaller game cards still have their own compact "Tale of the Tape" and a countdown badge; out of scope for this pass, same treatment would apply.
- The ESPN odds feed carries no timestamp, so no "as of" can be shown for the line; a small visible caption under the probability bar now says so (no hover needed), and the tooltip repeats it.
