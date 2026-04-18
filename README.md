# Dugout · MLB Tracker

Live MLB scoreboard, standings, and playoff picture. Node/Express backend proxying the free MLB Stats API and ESPN win-probability data, React frontend (Babel in-browser, no build step) with Design's ticket-stub PIN gate and game-card layout.

Live: https://baseball.beaubouef.com (Proxmox CT 130)
Repo: https://github.com/qbeaubouef/baseball

## Architecture

```
browser                           express server                      external APIs
-------                           --------------                      -------------
index.html                        /api/auth, /api/auth/check          MLB Stats API
  ├─ styles-v2.css                /api/colors                            └─ schedule?hydrate=linescore(runners),broadcasts,...
  ├─ components/PinGate.jsx       /api/scores[/:date]   (30s TTL)        └─ /game/{pk}/feed/live
  ├─ components/Scoreboard.jsx    /api/game/:id         (15s TTL)
  ├─ components/Standings.jsx     /api/espn/game/:id    (15s TTL)     ESPN
  └─ app.jsx                      /api/standings        (10m TTL)        └─ /mlb/scoreboard?dates=YYYYMMDD
                                  static: /*                              └─ /mlb/summary?event={eventId}
```

All live-data transformation (MLB schema → Design's game-card shape, ESPN WP merge, leverage approximation) happens server-side. The client does fetch + render.

## PINs

- **User PIN `4406`**: required to view anything
- **Admin PIN `5502`**: click the "Dugout" wordmark in the masthead to enter admin mode. Unlocks the Tweaks panel (layout, color intensity, density, theme picker).

Both overridable via `USER_PIN` / `ADMIN_PIN` env vars.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth` | `{pin}` → `{ok, token, admin}`. Same endpoint for user and admin PINs. Rate limited 20/min/IP. |
| POST | `/api/auth/check` | Validates bearer token. |
| GET  | `/api/colors` | All 30 teams with full metadata (built-in) overlaid with hex overrides from CSV if present. |
| POST | `/api/colors/reload` | Admin only. Re-parses `team_colors_corrected_v3.csv` at runtime. |
| GET  | `/api/scores` | Today's games (ET). Lightweight card data only. |
| GET  | `/api/scores/:YYYY-MM-DD` | Specific date. Historical dates cached 5m, today cached 30s. |
| GET  | `/api/game/:gamePk` | Full game detail, merged with ESPN WP. |
| GET  | `/api/espn/game/:gamePk` | Raw WP series (for debugging). |
| GET  | `/api/standings` | `{AL:{East,Central,West}, NL:{...}}` via `/api/v1/standings?leagueId=103,104`. |
| GET  | `/healthz` | Uptime. |

## Auto-refresh

- Today's scoreboard: 30s
- Expanded live game detail: 15s (paused for pre/final games)

## ESPN mapping

MLB game → ESPN event ID by matching team nicknames (e.g. "Astros", "Red Sox") on the ESPN scoreboard for the game's ET date, with ±1 day fallback for late-night games. Mapping cached 5m per date.

Leverage is approximated from recent WP swings: `max(|Δ|) × 18 + avg(|Δ|) × 8`, clamped `[0.1, 6.0]`, × 1.2 in late-inning close games. Adjust in `server.js → mergeEspn()` after watching live games.

## Install / update (Proxmox LXC)

First install:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/qbeaubouef/baseball/main/mlb-install.sh)
```

Update after pushing to GitHub:

```bash
systemctl stop baseball && bash /opt/baseball/mlb-install.sh
```

The installer:
1. Ensures Node 20+ is installed
2. Creates system user `baseball` and `/opt/baseball`
3. Curls each file listed in `FILES[]` from GitHub raw
4. `npm install --omit=dev` as the app user
5. Writes systemd unit with env vars `PORT`, `USER_PIN`, `ADMIN_PIN` and hardening flags
6. Restarts and hits `/healthz`

Logs: `journalctl -u baseball -f`

## Tweaks (admin only)

- **Scoreboard layout**: grid / list / hybrid
- **Team color intensity**: subtle / medium / bold
- **Standings density**: roomy / dense
- **Theme**: light / auto / dark

Defaults: grid, medium, dense, auto. Stored in `sessionStorage` per browser session.

## Notes

- Game times rendered in the user's local timezone (browser's `Intl.DateTimeFormat`)
- "Today" for the scoreboard is determined server-side in US Eastern to match MLB's game-day convention
- `team_colors_corrected_v3.csv` is optional; if absent the server uses built-in MLB-official hex values
- Client uses React 18 UMD + Babel standalone from unpkg. No build step, no bundler.
