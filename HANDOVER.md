# HANDOVER - 2026-11-20 dataset and power rankings refresh

Branch `chore/data-refresh-2026-11-20`. Requested by Martin on WhatsApp (20 Nov 2026, "okay do that refresh") after the provenance pass disclosed the stale dataset and ranks.

## What changed

**Scorigami historical dataset regenerated**
- Re-ran `scripts/buildScorigamiData.mjs` against scorigamicenter.com/data/nfl.json (generatedAt 2026-11-17T18:43Z; declared sources FiveThirtyEight nfl-elo 1920-1998, nflverse 1999-present).
- Dataset now 1,100 unique final scores, 18,384 summed occurrences, coverage through 16 Nov 2026 (end of Week 10). Previously 1,097 / 18,267 through 24 Sep 2026.
- Three new unique scores since the last refresh, each cross-checked against the ESPN scoreboard feed: 43-36 (CIN def. TEN, 1 Nov), 46-40 (SF def. DAL, 15 Nov), 38-18 (CIN def. PIT, 16 Nov).
- 20-17 has now occurred 305 times, most recently CAR 20, NO 17 on 15 Nov 2026; the post-game test expectations were updated to match.
- The coverage date is no longer a hardcoded string. `scorigami.ts` derives `SCORIGAMI_DATASET_COVERAGE_END_ISO` / `_LABEL` from the dataset, and HeroMatchup, GameCard and the rendered-check harness all consume the derived value, so the next refresh only needs the script re-run.
- Dataset credit now reads "scorigamicenter.com; FiveThirtyEight/nflverse data", matching the source file's own declared provenance (the old "Pro Football Reference" credit is not what the dataset declares).

**Power rankings: Week 11 edition ingested**
- Source: Nate Davis (USA TODAY) via Yahoo Sports, "NFL power rankings Week 11: 49ers remain No. 1, but who is AFC's best team?", published 17 Nov 2026, verified 20 Nov 2026. https://sports.yahoo.com/articles/nfl-power-rankings-week-11-105531497.html
- All 32 ranks parsed from the article HTML; the parenthetical previous ranks are the author's own prior edition, and `change = previousRank - rank` as before. ESPN confirms the current slate is Week 11, matching the source's label.
- Top: SF 1, BUF 2, CHI 3, JAX 4, CIN 5 (up from 14). TB 15, DET 10. NE fell to 24 (from 11). FNE alias kept.
- Week 9 (FanSided) and Week 8 editions retained for history; the movement tooltip's "previous published edition" refers to the author's own prior rankings, which is what the article records.
- Note: `scripts/update-power-rankings.mjs` discovery found this article but its parser extracted 0/32 teams (Yahoo markup drift); ingestion was manual and verified. The script needs a parser fix before it can automate future editions.

## Checks
- `npm run lint` clean, `npm run build` passes, `npm test` 251/251.
- `npm run test:matchup` 32/32 rendered checks at 1440/1024/393/360; screenshots inspected (pre-game mobile shows "USA TODAY Wk 11" rank pills and "verified through 16 Nov 2026"; final shows "Last recorded: Carolina Panthers 20, New Orleans Saints 17 on Nov 15, 2026").

## Limits
- Coverage still ends 16 Nov 2026; Week 11 games are not yet in the dataset (re-run the script after the weekend).
- Ranks are one editorial ballot (USA TODAY), not a consensus; labelled as such.
- No model changes, no redesign, no weekly-updater hooks.

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

## Follow-through of independent review, 20 Nov 2026

Branch: `fix/scorigami-consumers-accessibility`. This pass applies the same truthfulness rules to every shared consumer and rendered state, without changing the model or ingesting new editorial data.

- Directory drawers now disclose the dataset cutoff and model limits, carry `est.`, and use dataset-scoped labels rather than global-history claims.
- Hero live/final headings and shared live narratives no longer declare confirmed first-ever NFL novelty. Unseen final scores do not invent a numbered addition to the fixed dataset. Known-score dates are labelled `Last recorded`, not a claim that no later game exists.
- Full and compact win-probability accessibility labels name the same method as the visible full bar. Spread and moneyline tooltips both disclose the absent feed timestamp.
- Team rows wrap at intermediate desktop widths. Estimate and score pills stay intact on narrow screens, while the header row itself can wrap.
- Provider-name spacing and browser locale date order are left as supplied; neither is a factual error.

Verification: lint and production build pass, 251 unit tests pass. `npm run test:matchup` runs 32 deterministic rendered checks at 1440, 1024, 393 and 360px: moneyline, spread-only fallback, no-odds baseline, live ESPN FPI, live analytic fallback, known live score, known final and unseen final. It checks compact/full method accessibility, keyboard expansion, collapsed estimate label, stale-claim absence, cutoff disclosure and document overflow. External requests are blocked and fixture logo URLs deliberately fail, so the views also exercise missing-image handling without relying on feed availability. The harness files are removed in `finally`; screenshots are optional via `MATCHUP_SCREENSHOTS` and should point outside the repository. Requires installed Chrome, or `CHROME_PATH`.

Separate post-fix review caught and corrected the final-state tooltip and `Last Occurred` wording, plus a shared live narrative that still implied first-ever novelty. Rendered screenshots were rechecked after those changes, not just after the first patch. Local fixture evidence is synthetic, not a claim that a live NFL game currently has these scores.

Limits remain: historical coverage ends 24 Sep 2026, the regulation-only independent-team estimate is indicative, odds have no feed timestamp, and ranks remain the existing Week 9 edition. No weekly updater hooks were run. The compact directory countdown, score dashes and separate preview panel remain unchanged.
