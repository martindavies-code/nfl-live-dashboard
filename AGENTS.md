# Agent Instructions & Project Rules

## Weekly NFL Broadcast Announcer Verification Routine (MANDATORY)
Ahead of every NFL weekend slate (specifically on Thursday or Friday mornings):
1. **Never guess or carry over crews from memory or previous weeks**:
   Sunday afternoon regional slates across CBS and FOX rotate weekly (typically 7 CBS crews and 5 FOX crews).
2. **Weekly Search & Ingestion**:
   Check published pairings for the current/upcoming week via `506sports.com`, network press releases (CBS Sports PR, FOX Sports PR), Yahoo Sports / Akron Beacon Journal, and official team announcements.
3. **Registry Update**:
   Add every verified game to `src/data/announcerRegistry.ts` under the respective season and week, including play-by-play, analysts, sideline reporters, and source URLs.
4. **Automated Audit**:
   Run `npm run audit:announcers` to verify that 100% of upcoming games kicking off within 72 hours have verified crews and zero placeholder or drift errors.
5. **Continuous Verification**:
   Always run `npm test` and `node scripts/sync.mjs` to keep the live GitHub Pages dashboard updated before the Thursday Night Football kickoff.
