# PRD: Multi-Chain Wallet Balance Scanner

**Status:** Draft v3.2
**Author:** ralph
**Date:** 2026-02-11
**Architecture:** Provider-agnostic, user-selectable API backend
**Default Provider:** Ankr Advanced (free tier, multi-chain in 1 call)

---

## Problem Statement

Crypto portfolio managers, DAO treasurers, and security auditors need to quickly assess the aggregate holdings of 50-500 Ethereum-compatible addresses across EVM chains. Today this requires manual explorer checks or scripts tied to provider-specific APIs. There is no single, self-contained tool that takes a CSV of addresses and returns a consolidated multi-chain balance view with export capability.

No single API provider fits every user. Some users have DeBank keys, others prefer Ankr's free tier, and others are locked into Alchemy or Moralis through existing projects. The tool must be provider-agnostic.

**Impact of not solving:** Hours of manual work per audit cycle, missed assets on lesser-known chains, and no single source of truth for multi-wallet treasury reporting.

---

## Goals

1. **Provider-aware scan SLA for 100 addresses:**
   - **< 2 minutes** on single-call providers (Ankr, DeBank)
   - **< 5 minutes** on per-chain providers (Moralis, Covalent)
2. **Zero backend dependency** - runs entirely client-side as a static app build. No server runtime required.
3. **Free-first provider model** - default to a free-tier provider (Ankr). Users can switch providers at runtime. Each provider adapter normalizes to a common model.
4. **Broad EVM chain coverage** - leverage each provider's chain support (roughly 20 to 200+ chains depending on provider).
5. **Exportable results** - CSV export of scanned data for downstream analysis.
6. **Reproducible, auditable snapshots** - same input/provider/key should produce materially consistent output at near-identical block/time conditions. Export includes scan metadata.

---

## Release Scope by Phase

- **Phase 1 (v1.0):** Ankr + Moralis + TrueBlocks (local daemon, native-balance MVP) adapters.
- **Phase 2 (v1.1):** Add Covalent + Alchemy adapters.
  - Alchemy integration is **raw HTTP only**. No dependency on deprecated JS SDK.
- **Phase 3 (v1.2):** Add DeBank adapter.

Provider selector behavior is phase-aware: each release shows only providers implemented in that phase.

---

## Non-Goals

- **NFT enumeration** - Out of scope for v1. Token granularity is fungible assets only (native + ERC-20).
- **Historical balance tracking** - No time-series data. Point-in-time snapshot only.
- **DeFi protocol positions** - Lending, staking, LP positions excluded. Wallet-held tokens only.
- **Persistence / accounts** - No local storage, no login, no saved state. Stateless by design.
- **Address validation beyond format** - Validate `0x` + 40 hex chars. No EOA-vs-contract or checksum enforcement.
- **Cross-provider aggregation** - One provider per scan session.
- **ENS name resolution** - Out of scope for v1.
- **Non-EVM chains (BTC/Solana/etc.)** - Out of scope for v1.
- **TrueBlocks token-level holdings in v1** - Out of scope. TrueBlocks integration is native-balance-first in this phase.

---

## User Stories

### Portfolio Manager / DAO Treasurer

- As a treasury manager, I want to upload a CSV of multisig and contributor addresses so I can see total USD value across chains.
- As a treasury manager, I want to drill into an address to see per-chain and per-token breakdowns.
- As a treasury manager, I want to export full scan results as CSV for accounting and audit workflows.

### Security Auditor

- As a security auditor, I want to scan a batch of addresses and sort by total balance to identify high-value targets.
- As a security auditor, I want to see chain exposure for each address.

### Individual Power User

- As a power user, I want to paste addresses directly without CSV for ad-hoc checks.
- As a power user, I want real-time scan progress so I can see rate-limit behavior.
- As a power user, I want provider choice based on the key I already own.

---

## Requirements

### P0 - Must Have

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| P0-1 | **CSV Upload & Parse** | Accept `.csv` via drag-drop or picker. Parse first column or `address` column. Deduplicate. Validate format. Show valid/invalid counts before scan. |
| P0-2 | **Manual Address Input** | Textarea accepts one-per-line, comma-separated, or mixed input. Uses same validation as CSV path. |
| P0-3 | **Provider Selection (Phase-Aware)** | Selector shows only providers implemented for the current phase, ordered by tier (`FREE`, `FREEMIUM`, `PAID`) and recommendation. Default: Ankr when available. Option row shows tier badge and chain count. Selection updates key label/help/free-tier info. |
| P0-4 | **Provider Credential Input** | Provider-specific input field. Hosted providers use API key/token; TrueBlocks uses a daemon base URL (default `http://127.0.0.1:8080`). Value held in JS memory only. |
| P0-4a | **Progress ETA** | During scan, display `completed/total` plus an approximate time remaining value based on provider timing assumptions and enforced address pacing. |
| P0-5 | **Multi-Chain Balance Fetch** | Provider adapters normalize data to common `BalanceResult` schema. Results stream in as addresses complete. TrueBlocks uses auto chain discovery and falls back to Ethereum-only when discovery is unavailable. |
| P0-6 | **Token-Level Detail (Lazy in UI)** | Per-token data is fetched lazily on row expand for table rendering efficiency. |
| P0-7 | **Rate Limit Handling** | Provider-aware queue with provider default concurrency and exponential backoff on 429/rate-limit responses. Show `completed/total` progress. |
| P0-8 | **Results Table** | Sortable columns: Address, Total USD Value, Chains Active, Token Count, Top Chain. Expand row for per-chain/per-token detail. |
| P0-9 | **CSV Export (Full Mode)** | Export workflow must prefetch missing token data for unexpanded addresses before file generation. Export generation blocks until prefetch completes or fails. If some addresses fail during prefetch, export includes successful rows and surfaces a clear failure summary. CSV columns: `scan_timestamp_utc,provider_id,address,chain_id,chain_name,token_address,token_symbol,token_name,token_decimals,token_amount_raw,token_amount_decimal,token_usd_value`. In TrueBlocks mode, export emits native rows with `token_address=native`; missing USD prices remain `N/A`/blank without failing export. |
| P0-10 | **Error Handling** | Per-address error state with retry. One address failure does not halt scan. Completion summary includes failures and retry outcomes. |

### P1 - Nice to Have

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| P1-1 | **Chain Filter** | Multi-select limits scan to provider-supported chains. List populated from adapter `getSupportedChains()`. |
| P1-2 | **Summary Dashboard** | Aggregate total USD, top 5 tokens, top 5 chains. |
| P1-3 | **Address Labels** | Optional CSV second column provides label/name for each address. |
| P1-4 | **Dark Mode** | Toggle with `prefers-color-scheme` default. |
| P1-5 | **Dust Filter** | Hide tokens below configurable USD threshold (default `$1.00`). |
| P1-6 | **Provider Info Panel** | Show selected provider details: chain count, tier limits, key link, caveats. |

### P2 - Future Considerations

| ID | Requirement |
|----|-------------|
| P2-1 | **DeFi Protocol Positions** - Integrate protocol-level endpoints (DeBank `complex_protocol_list`, Moralis DeFi endpoints). |
| P2-2 | **Token Approval Audit** - Show approved spenders for security review. |
| P2-3 | **Shareable Report** - Generate self-contained HTML report with embedded data (no API key needed to view). |
| P2-4 | **Cross-Provider Verification** - Run same addresses against two providers and diff results. |

---

## Provider Comparison Matrix

Ordered by recommendation: free-tier providers first for 50-500 address use cases.

### Tier 1 - Free, Multi-Chain in 1 Call

| | Ankr Advanced | Alchemy |
|---|---|---|
| **Tier** | `FREE` | `FREE` |
| **Phase** | Phase 1 | Phase 2 |
| **Chain Coverage** | ~20 mainnets | ~30 EVM chains |
| **Multi-Chain in 1 Call** | Yes (`ankr_getAccountBalance`) | Yes (`getTokenBalancesByWallet`) |
| **USD Prices Included** | Yes | Yes |
| **Free Tier Limits** | ~30 req/s, generous daily cap | ~30 req/s, CU-limited |
| **API Calls per 100 Addrs** | 100 (1 call/addr) | 100 (1 call/addr with Portfolio API) |
| **Auth Method** | Token in URL path | API key + Portfolio auth |
| **CORS** | Yes | Yes |
| **Tradeoff** | Simpler integration, fewer chains | More chains, auth complexity |
| **Get Key** | [ankr.com/rpc](https://www.ankr.com/rpc/) | [dashboard.alchemy.com/signup](https://dashboard.alchemy.com/signup) |

### Local Provider - TrueBlocks (Phase 1, native-balance MVP)

| | TrueBlocks |
|---|---|
| **Tier** | `FREE` (local daemon) |
| **Phase** | Phase 1 |
| **Chain Coverage** | Auto-discovered from daemon (`/status?chains=true`) |
| **Multi-Chain in 1 Call** | No (per-chain state calls with bounded fanout) |
| **USD Prices Included** | Via CoinGecko Simple Price API |
| **Auth Method** | No API key; configurable daemon URL |
| **Default Endpoint** | `http://127.0.0.1:8080` |
| **Tradeoff** | No provider key/rate-limit model, but requires local daemon setup |
| **Setup** | [trueblocks.io/docs/install/install-core](https://trueblocks.io/docs/install/install-core/) |

### Tier 2 - Freemium, Per-Chain Calls

| | Moralis | Covalent / GoldRush |
|---|---|---|
| **Tier** | `FREEMIUM` | `FREEMIUM` |
| **Phase** | Phase 1 | Phase 2 |
| **Chain Coverage** | ~15 EVM chains | 100+ chains |
| **Multi-Chain in 1 Call** | No | No |
| **USD Prices Included** | Yes | Yes |
| **Free/Freemium Limits** | 40K CU/day, ~25 req/s | 25K signup credits total, 4 req/s |
| **API Calls per 100 Addrs** | ~200 (with active-chain discovery) | ~200 (with active-chain discovery) |
| **Auth Method** | `X-API-Key` header | Query key or Bearer token |
| **CORS** | Yes | Yes |
| **Tradeoff** | Good spam filtering, CU burn risk | Broad chain coverage, strict rate limit |
| **Get Key** | [admin.moralis.com](https://admin.moralis.com/) | [goldrush.dev/platform/apikey](https://goldrush.dev/platform/apikey/) |

### Tier 3 - Paid Only

| | DeBank Pro |
|---|---|
| **Tier** | `PAID` |
| **Phase** | Phase 3 |
| **Chain Coverage** | 200+ chains |
| **Multi-Chain in 1 Call** | Yes (`total_balance`, `all_token_list`) |
| **USD Prices Included** | Yes |
| **Free Tier Limits** | None |
| **API Calls per 100 Addrs** | 100 |
| **Auth Method** | `AccessKey` header |
| **CORS** | Yes |
| **Tradeoff** | Best coverage/data quality, paid-only |
| **Get Key** | [cloud.debank.com](https://cloud.debank.com/) |

### Provider Dropdown Order

**Phase 1**

```
Ankr Advanced      FREE       ~20 chains   (default)
TrueBlocks (Local) FREE       local daemon native-balance MVP
Moralis            FREEMIUM   ~15 chains
```

**Phase 2+ (example full list)**

```
Ankr Advanced      FREE       ~20 chains   (default)
TrueBlocks (Local) FREE       local daemon native-balance MVP
Alchemy            FREE       ~30 chains
Moralis            FREEMIUM   ~15 chains
Covalent/GoldRush  FREEMIUM   100+ chains
DeBank Pro         PAID       200+ chains
```

### Provider Guidance

- "Just want it to work" -> Ankr
- "Need local-first / no provider key" -> TrueBlocks (native-balance MVP)
- "Need 100+ chains" -> Covalent (freemium) or DeBank (paid)
- "Prefer aggressive spam filtering" -> Moralis
- "Already have provider X key" -> choose that provider

### Scan Duration / ETA Logic

Before scan, show:

```
Addresses:                    {N}
Provider:                     {name}
Estimated calls per address:  {provider estimate}
Estimated provider call time: {function of calls, concurrency, effective rate limit}
Address pacing overhead:      {(N - 1) * pacing_delay_seconds}
Planned duration:             {provider time + pacing overhead}
During scan:                  show ~time left (planned_duration - elapsed)
```

For per-chain providers, estimate uses chain-selection-aware call assumptions.

---

## Technical Architecture

### Modular Vite App with Provider Adapter Layer

```
src/index.html
src/main.js
  imports src/app.js and src/styles.css
src/app.js
  UI wiring and provider orchestration
src/core.js
  pure business logic utilities
tests/*.test.mjs
  TDD coverage for core behavior and project structure
dist/
  build output (generated, minified)
```

### Provider Adapter Interface

Each adapter normalizes provider-specific responses into a common schema.

```typescript
interface ProviderAdapter {
  id: string;                          // 'ankr' | 'trueblocks' | 'alchemy' | 'moralis' | 'covalent' | 'debank'
  name: string;
  tier: 'free' | 'freemium' | 'paid';
  keyLabel: string;                    // key label or base-url label by provider
  keyPlaceholder: string;
  signupUrl: string;
  docsUrl: string;
  defaultConcurrency: number;
  supportedChainCount: number;
  supportsMultiChainCall: boolean;

  freeTier: {
    available: boolean;
    limitKind: 'daily' | 'lifetime' | 'none' | 'unknown';
    limitValue: number | null;         // null when unavailable or undocumented
    callsPerAddressEstimate: number;
    rateLimitPerSec: number | null;
  };

  validateKey(input: string): Promise<boolean>; // key validation or endpoint health validation
  getBalance(address: string): Promise<BalanceResult>;
  getTokens(address: string): Promise<TokenResult[]>;
  getSupportedChains(): Promise<ChainInfo[]>;
  estimateCost(addressCount: number): BudgetEstimate;
}

interface ChainInfo {
  chainId: string;
  chainName: string;
  isTestnet: boolean;
  enabledByDefault: boolean;
}

interface BudgetEstimate {
  totalCalls: number;
  estimatedSeconds: number;
  usagePercent: number | null;         // null when limit unknown
  status: 'within_estimate' | 'near_limit' | 'likely_exceeds';
  assumesUnknownPriorUsage: true;
  warning: string | null;
}

interface BalanceResult {
  address: string;
  totalUsdValue: string;               // decimal string canonical value
  totalUsdValueNumber?: number;        // derived UI-only field
  chains: {
    chainId: string;
    chainName: string;
    logoUrl: string;
    usdValue: string;                  // decimal string canonical value
    usdValueNumber?: number;           // derived UI-only field
  }[];
}

interface TokenResult {
  address: string;
  chainId: string;
  chainName: string;
  tokenAddress: string;                // 'native' for native asset
  tokenSymbol: string;
  tokenName: string;
  tokenDecimals: number;
  amountRaw: string;                   // base units string, precision-safe
  amountDecimal: string;               // human-readable decimal string
  usdValue: string;                    // decimal string canonical value
  usdValueNumber?: number;             // derived UI-only field
  logoUrl: string;
  isVerified: boolean;
}
```

### Provider-Specific API Flows

#### Ankr Advanced (Phase 1, FREE, default)

- **Balance + tokens:** single `ankr_getAccountBalance` JSON-RPC call per address.
- **Auth:** token in URL path.
- **Notes:** lowest friction; default provider.

#### Moralis (Phase 1, FREEMIUM)

- **Discovery:** `getWalletActiveChains` per address.
- **Balances:** per-active-chain `getWalletTokenBalancesPrice` calls.
- **Auth:** `X-API-Key` header.
- **Notes:** dynamic active-chain discovery is required (no hardcoded common-chain list).

#### TrueBlocks (Phase 1, FREE local daemon)

- **Health / chain discovery:** `/status?chains=true` with Ethereum-only fallback when discovery fails.
- **Balances (MVP):** per-chain `/state?addrs={address}&parts=balance&ether=true&chain={chain}`.
- **USD pricing:** CoinGecko Simple Price API (best-effort, non-blocking).
- **Auth:** none (local daemon endpoint URL).
- **Notes:** token-level holdings are explicitly out of scope in this phase; export emits native rows with `token_address=native`.

#### Covalent / GoldRush (Phase 2, FREEMIUM)

- **Discovery:** determine active chains before balance calls.
- **Balances:** `/v1/{chainId}/address/{addr}/balances_v2/` per active chain.
- **Auth:** query key or Bearer token.
- **Notes:** free quota is lifetime signup pool; strict 4 req/s.

#### Alchemy (Phase 2, FREE)

- **Multi-chain path:** Portfolio API `getTokenBalancesByWallet` over raw HTTP.
- **Fallback path:** per-network calls when multi-chain endpoint unavailable.
- **Auth:** API key + Portfolio auth requirements.
- **Notes:** no dependency on deprecated Alchemy JS SDK.

#### DeBank Pro (Phase 3, PAID)

- **Balance:** `/v1/user/total_balance`
- **Tokens:** `/v1/user/all_token_list`
- **Auth:** `AccessKey` header.

### Concurrency Defaults per Provider

| Provider | Tier | Default Concurrency | Rationale |
|----------|------|-------------------|-----------|
| Ankr | FREE | 10 | ~30 req/s and 1 call/address |
| TrueBlocks | FREE (local) | 3 | bounded per-chain fanout against local daemon |
| Alchemy | FREE | 8 | multi-chain path with CU limits |
| Moralis | FREEMIUM | 5 | per-chain fanout and CU budgeting |
| Covalent | FREEMIUM | 2 | strict 4 req/s free limit |
| DeBank | PAID | 5 | conservative until measured limits are known |

### Key Technical Decisions

- **No framework runtime** - Vanilla JS + CSS with modular Vite build output.
- **PapaParse dependency** - used for CSV parsing in the modular build.
- **Adapter pattern** - provider logic isolated by class.
- **UI lazy loading** - token detail fetched on row expand.
- **Export prefetch** - CSV export fetches missing token data before generation.
- **Provider-aware queue** - provider-specific concurrency and backoff.
- **Active-chain discovery** - required for Moralis/Covalent to limit call volume.
- **Precision-safe model** - canonical monetary/token values stored as strings; numbers are derived UI helpers only.
- **Planned-duration ETA** - remaining time is approximate and derived from provider assumptions plus address pacing.
- **Local-provider mode** - TrueBlocks is first-class with endpoint validation and graceful partial-failure handling.

---

## Success Metrics

### Leading Indicators (at launch)

| Metric | Target |
|--------|--------|
| Time to scan 100 addresses (Ankr/DeBank) | < 2 minutes |
| Time to scan 100 addresses (Moralis/Covalent) | < 5 minutes |
| Successful scan rate | > 95% addresses return data |
| CSV export parity | 100% match between rendered full dataset and exported rows after export prefetch |

### Lagging Indicators

| Metric | Target |
|--------|--------|
| User-reported missed balances | 0 vs provider UI for same snapshot window |
| Provider distribution | At least 3 providers used by real users |
| Repeat usage | Re-run at least 2x/month |

---

## Decisions and Remaining Open Questions

### Decisions Locked in v3.1

- SLA is provider-aware (`<2 min` single-call, `<5 min` per-chain).
- Export is full mode with prefetch-before-download.
- Progress ETA is a planned-duration estimate, not a real-time quota tracker.
- Canonical value types are precision-safe strings.
- Alchemy remains in Phase 2 using raw HTTP.
- Export includes `scan_timestamp_utc` and `provider_id`.
- Moralis/Covalent chain selection uses dynamic active-chain discovery.
- TrueBlocks is a first-class optional local provider in Phase 1 (daemon URL input, auto multi-chain attempt, Ethereum fallback).
- TrueBlocks USD pricing uses CoinGecko in best-effort mode; missing prices never fail scan/export.
- ENS and non-EVM support are out of scope for v1.

### Remaining Open Questions

| Question | Owner |
|----------|-------|
| What is DeBank Pro's effective per-key rate limit under real workloads? | ralph / engineering |

---

## Timeline Considerations

- No hard deadline; internal/personal tooling.
- Modular Vite delivery with GitHub Pages deployment pipeline.
- Release strategy is additive by phase; adapter additions must not break existing adapters.
- Phase 1 prioritizes zero-cost usability (Ankr + Moralis + optional local TrueBlocks).

---

## API Provider Quick Reference

### Ankr Advanced (FREE, Phase 1, default)

- **Base URL:** `https://rpc.ankr.com/multichain/{token}`
- **Auth:** token in URL path
- **Primary Method:** `ankr_getAccountBalance`
- **Get Key:** [ankr.com/rpc](https://www.ankr.com/rpc/)
- **Docs:** [ankr advanced token methods](https://www.ankr.com/docs/advanced-api/token-methods/)

### Moralis (FREEMIUM, Phase 1)

- **Base URL:** `https://deep-index.moralis.io/api/v2.2`
- **Auth:** `X-API-Key` header
- **Endpoints:** `getWalletActiveChains`, `getWalletTokenBalancesPrice`
- **Get Key:** [admin.moralis.com](https://admin.moralis.com/)
- **Docs:** [moralis wallet token balances price](https://docs.moralis.com/web3-data-api/evm/reference/wallet-api/get-wallet-token-balances-price)

### TrueBlocks (FREE local daemon, Phase 1)

- **Base URL:** `http://127.0.0.1:8080` (configurable)
- **Auth:** none
- **Endpoints:** `/status?chains=true`, `/state?addrs=...&parts=balance&ether=true&chain=...`
- **Pricing:** CoinGecko Simple Price API (best-effort only)
- **Setup:** [trueblocks.io/docs/install/install-core](https://trueblocks.io/docs/install/install-core/)
- **Docs:** [docs.trueblocks.io/api](https://docs.trueblocks.io/api/)

### Covalent / GoldRush (FREEMIUM, Phase 2)

- **Base URL:** `https://api.covalenthq.com`
- **Auth:** query key or Bearer token
- **Endpoint:** `/v1/{chainId}/address/{addr}/balances_v2/`
- **Get Key:** [goldrush platform api key](https://goldrush.dev/platform/apikey/)
- **Docs:** [goldrush API overview](https://goldrush.mintlify.app/docs/api/overview)

### Alchemy (FREE, Phase 2)

- **Base URL:** `https://{chain}.g.alchemy.com/v2/{key}`
- **Auth:** API key + Portfolio auth
- **Methods:** Portfolio API `getTokenBalancesByWallet`, fallback per-chain `alchemy_getTokenBalances`
- **Get Key:** [dashboard.alchemy.com/signup](https://dashboard.alchemy.com/signup)
- **Docs:** [alchemy token API](https://www.alchemy.com/docs/data/token-api/token-api-endpoints/alchemy-get-token-balances)

### DeBank Pro (PAID, Phase 3)

- **Base URL:** `https://pro-openapi.debank.com`
- **Auth:** `AccessKey` header
- **Endpoints:** `/v1/user/total_balance`, `/v1/user/all_token_list`, `/v1/user/used_chain_list`
- **Get Key:** [cloud.debank.com](https://cloud.debank.com/)
- **Docs:** [debank pro API reference](https://docs.cloud.debank.com/en/readme/api-pro-reference/user)
