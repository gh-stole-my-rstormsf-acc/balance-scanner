# AGENTS.md

## Skill Policy

- Use [$seniordev](/Users/petka/.codex/skills/seniordev/SKILL.md) for all non-trivial coding, refactors, and bug fixes.
- Use [$frontend-craft](/Users/petka/.codex/skills/frontend/SKILL.md) for all UI/UX and visual work.
- Use [$playwright](/Users/petka/.codex/skills/playwright/SKILL.md) when browser automation or UI flow testing is required.

## Product Constraints

- Runtime deliverable is a browser-only app with no backend.
- Use normal modular architecture:
  - Source: `/Users/petka/balance-scanner/src`
  - Build output: `/Users/petka/balance-scanner/dist`
- Follow PRD phase scope:
  - Phase 1: `ankr`, `moralis`
  - Phase 2: `covalent`, `alchemy`
  - Phase 3: `debank`
- Do not persist API keys. Keys remain in session memory only.

## Engineering Workflow

- Prefer TDD for core logic:
  - Write/adjust tests in `/Users/petka/balance-scanner/tests` first.
  - Implement to green.
- Keep canonical money/token values precision-safe (strings).
- Use provider-aware rate-limiting and retry/backoff defaults from PRD.

## Validation Checklist

- `npm run test`
- `npm run build`
- Manual UI smoke check in browser:
  - address parsing
  - provider switching
  - progress/error rendering
  - CSV export flow
