# Balance Scanner

Multi-chain wallet balance scanner (Phase 1: Ankr + Moralis + TrueBlocks local provider) built as a modular Vite app.

## Project Layout

- Source root: `src/`
- HTML entry: `src/index.html`
- JS entry: `src/main.js`
- Production output: `dist/`

## Live Demo

- [https://gh-stole-my-rstormsf-acc.github.io/balance-scanner/](https://gh-stole-my-rstormsf-acc.github.io/balance-scanner/)
- TrueBlocks mode is local-daemon based. If your browser blocks `https -> http` local calls, run the app locally (`npm run dev`) for TrueBlocks scans.

## Development

- Install:           `npm ci`
- Run tests:           `npm run test`
- Start dev server:           `npm run dev`
- Build production:           `npm run build`

## Deployment

GitHub Actions deploys to GitHub Pages on every push to `main` using:

- workflow: `.github/workflows/deploy.yml`
- build base path: `/balance-scanner/`
- artifact path: `dist/`

## TrueBlocks Local Daemon Setup

1. Install TrueBlocks Core:
   - [https://docs.trueblocks.io/install/](https://docs.trueblocks.io/install/)
2. Start daemon locally:
   - `chifra daemon`
3. In the app, select `TrueBlocks (Local)` provider.
4. Use `TrueBlocks Base URL` (default):
   - `http://127.0.0.1:8080`

Notes:
- Current TrueBlocks integration is MVP native-balance scope (no token-level portfolio enumeration in this mode).
- USD valuation in TrueBlocks mode uses CoinGecko Simple Price API.
- Missing/unavailable prices are shown as `N/A` and do not fail scans or export.

Troubleshooting:
- Daemon not running: start with `chifra daemon`.
- Bad URL: confirm `http://127.0.0.1:8080` (or your configured endpoint).
- Non-JSON response: ensure the URL points to the TrueBlocks API daemon, not a proxy/html page.
- Browser mixed-content block: on hosted HTTPS app, use local dev server or expose TrueBlocks over HTTPS.
