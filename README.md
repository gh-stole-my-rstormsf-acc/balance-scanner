# Balance Scanner

Multi-chain wallet balance scanner (Phase 1: Ankr + Moralis) built as a modular Vite app.

## Project Layout

- Source root: `src/`
- HTML entry: `src/index.html`
- JS entry: `src/main.js`
- Production output: `dist/`

## Live Demo

- [https://gh-stole-my-rstormsf-acc.github.io/balance-scanner/](https://gh-stole-my-rstormsf-acc.github.io/balance-scanner/)

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
