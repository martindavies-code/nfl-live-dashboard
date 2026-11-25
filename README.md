# 🏈 NFL Live Command Center

A real-time American football live scoreboard, interactive tactical field visualizer, and win probability tracking dashboard built with **React 19**, **Vite**, **TypeScript**, and **Tailwind CSS v4**.

Data is streamed directly via the [ESPN NFL Scoreboard API](https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard) with zero-dependency polling, automatic reconnection, and military-grade crash resilience.

---

## ⚡ Live Demo

🔗 **[https://martindavies-code.github.io/nfl-live-dashboard/](https://martindavies-code.github.io/nfl-live-dashboard/)**

---

## 🚀 Key Features

### 1. 📡 Real-Time Data Pipeline & Resilient Polling

- **10-Second Auto-Poll**: Uninterrupted synchronization with real-time countdown indicator and manual refresh override.
- **Page Visibility Optimization**: Polling pauses when the tab is backgrounded to preserve device battery and CPU, instantly refreshing upon return.
- **Offline Safeguard**: Automatic online/offline network detection with cached view fallback and instant auto-reconnect.
- **Aborting Stale Requests**: Clean `AbortController` and 8-second request timeouts prevent pending connection accumulation.

### 2. 🟢 Dynamic 100-Yard Field Radar (`FieldDiagram.tsx`)

- High-fidelity **120-yard SVG pitch** (100 yards of turf + dual 10-yard endzones with official team branding and contrast-calibrated typography).
- **Line of Scrimmage (LOS)**: Laser cyan marker line positioned dynamically at `situation.yardLine`.
- **First Down Line**: Broadcast-yellow marker with in-place `1ST DOWN` and `GOAL LINE` tags.
- **Ball Indicator & Drive Vectors**: Realistic American football icon with leather laces and drop shadow, accompanied by a dynamic arrow indicating offensive drive direction.
- **Red Zone Alert**: Glowing crimson zone highlighting the opponent's 20-yard line to goal line.

### 3. 📊 Visual Win Probability Split Chart (`WinProbabilityBar.tsx`)

- Parses ESPN's live `lastPlay.probability.homeWinPercentage`.
- **Dynamic Color Mapping**: Bars automatically adopt the official primary colors of each participating franchise.
- **Direct In-Place Labelling**: Team logos, names, and exact percentages are embedded directly within the visualization, avoiding disconnected legends.
- **Guaranteed Finite Numbers**: Mathematical sanitation guards prevent `NaN%` states during pregame or delayed matchups.

### 4. 🎙️ Fact-Checked Broadcast & Announcer Intelligence (`broadcastInfo.ts`)

- **Zero-Guessing Sunday Afternoon Slates**: Sunday afternoon regional games across CBS and FOX rotate weekly (7 CBS crews and 5 FOX crews in 2026). They are **never guessed or inferred**. Until networks officially announce pairings (typically Tuesday/Wednesday of game week), unannounced matchups strictly display **"Crew not yet published"** (with a link to the week's broadcast source when available).
- **Permanent Primetime Franchise Crews**:
  - **Thursday Night Football (Prime Video)**: **Al Michaels & Kirk Herbstreit**, sideline: **Kaylee Hartung**
  - **Sunday Night Football (NBC)**: **Mike Tirico & Cris Collinsworth**, sideline: **Melissa Stark**
  - **Monday Night Football (ESPN / ABC)**: **Joe Buck & Troy Aikman**, sideline: **Lisa Salters**
- **Automated Fetching & Audit Tooling**:
  - `npm run update:announcers -- --weeks 2`: Discovers weekly pairings from manual URLs, Bing News RSS, and secondary search feeds (Awful Announcing search RSS2 / Yahoo Sports RSS / DuckDuckGo). Writes a game only when **two independent sources agree** (or one source with `--confirm-single-source`). Conflicting sources are never written.
  - `npm run audit:announcers -- --within-hours 72 --weeks 2`: Live integrity audit comparing `src/data/announcerRegistry.ts` against ESPN's 10-day calendar schedule, failing if any game kicking off within 72 hours lacks verified crew data.
  - `npm test`: Enforces strict data invariants (valid full names, no concurrent double-bookings for overlapping kickoffs, verified HTTPS sources, and strict week/season matching) plus parser and holiday-week calendar fixture tests.
- **Manual Announcer Fallback & Alerting**:
  - **Run the workflow by hand**: Open **Actions → Weekly NFL Announcer Audit → Run workflow** (or run `gh workflow run weekly-announcer-audit.yml -f weeks=2 -f url="<url1>,<url2>"`). Set `confirm_single_source` to `true` only if you have manually verified a single article and want it written without waiting for a second source.
  - **Add a source URL**: Either pass URL(s) in the workflow's `url` input (or locally with `npm run update:announcers -- --url <url1> --url <url2>`), or edit `scripts/announcer-sources.json` (adding URLs under `byWeek["<week>"]` as plain strings or `{ "url": "...", "confirmed": true }`) and push to `main` — pushing `scripts/announcer-sources.json` automatically triggers the audit workflow.
  - **Read the GitHub issue**: Whenever any game kicking off within 72 hours has no verified crew (or ESPN is unreachable), the workflow fails (triggering a GitHub failure email) and opens or updates a single issue titled **`Announcer crews missing`**. Each listed game includes its kickoff time, network, and the exact reason (`no pairing found`, `single source only`, `TBA crew`, `team name not parsed`, `ambiguous`, or `kickoff outside the week window`). Once verified crews are added and the audit passes, the issue closes automatically.
- **Dual UK & US Coverage**: Derives UK television channels (Sky Sports NFL, Channel 5, 5Action), UK radio (talkSPORT 2, BBC Radio 5 Live), and studio pundits alongside US telecast crews.

### 5. 🎯 Anti-Pattern Free Editorial Design

Refactored to eliminate all 10 common AI dashboard flaws identified in Adam Kucharski's analysis:

- **Hero Spotlight Anchor**: Establishes a natural user journey by spotlighting the premier live game with one-click spotlight switching.
- **Calibrated Visual Hierarchy**: High-contrast active action vs calm, subdued finished/scheduled cards.
- **Bespoke Typographic Pairing**: **Oswald** (athletic scoreboard numerals), **Plus Jakarta Sans** (editorial narrative), and **JetBrains Mono** (`tabular-nums` for rock-solid stability).
- **Zero Redundant Stat Clutter**: Clean, single-point information architecture.

---

## 🧪 Automated Testing & Verification

Includes a full automated unit and fuzz test suite:

```bash
npm test
```

- **Fuzz Stress Testing**: 1,000 randomized chaotic payloads verifying 100% crash immunity.
- **Coordinate Clamping**: Validates yardLine, scrimmage, and first-down geometry bounds.
- **Score Parsing**: Ensures safe conversion of strings, dashes, and nulls.

---

## 🛠️ Local Development

```bash
# Clone the repository
git clone https://github.com/martindavies-code/nfl-live-dashboard.git
cd nfl-live-dashboard

# Install dependencies
npm install

# Start development server
npm run dev

# Run unit & fuzz tests
npm test

# Build production bundle
npm run build
```

---

## 📜 License

MIT License. Designed & engineered for sports analytics enthusiasts.
