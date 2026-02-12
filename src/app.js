import Papa from 'papaparse';
import * as Core from './core.js';
const RELEASE_PHASE = 1;
const SCAN_ADDRESS_DELAY_MS = 10_000;
const TRUEBLOCKS_DEFAULT_BASE_URL = 'http://127.0.0.1:8080';
const TRUEBLOCKS_CHAIN_CONCURRENCY = 3;
const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

const CHAIN_NAMES = {
  mainnet: 'Ethereum',
  eth: 'Ethereum',
  ethereum: 'Ethereum',
  bsc: 'BNB Chain',
  polygon: 'Polygon',
  avalanche: 'Avalanche',
  arbitrum: 'Arbitrum',
  optimism: 'Optimism',
  base: 'Base',
  fantom: 'Fantom',
  gnosis: 'Gnosis',
};

const PROVIDERS = {
  ankr: {
    id: 'ankr',
    name: 'Ankr Advanced',
    tier: 'FREE',
    recommendationRank: 0,
    phase: 1,
    supportedChainCount: 20,
    supportsMultiChainCall: true,
    caveat: 'Best Phase 1 default: single call covers balances + token-level assets.',
    keyLabel: 'Ankr API Token',
    keyPlaceholder: 'Paste your Ankr token',
    signupUrl: 'https://www.ankr.com/rpc/',
    docsUrl: 'https://www.ankr.com/docs/advanced-api/token-methods/',
    defaultConcurrency: 10,
    freeTier: {
      available: true,
      limitKind: 'daily',
      limitValue: 500,
      callsPerAddressEstimate: 1,
      rateLimitPerSec: 30,
    },
  },
  trueblocks: {
    id: 'trueblocks',
    name: 'TrueBlocks (Local)',
    tier: 'FREE',
    recommendationRank: 1,
    phase: 1,
    supportedChainCount: 8,
    supportsMultiChainCall: false,
    caveat: 'Runs against your local TrueBlocks daemon. Native balances only in this MVP provider.',
    keyLabel: 'TrueBlocks Base URL',
    keyPlaceholder: TRUEBLOCKS_DEFAULT_BASE_URL,
    defaultInputValue: TRUEBLOCKS_DEFAULT_BASE_URL,
    signupLabel: 'Setup daemon',
    signupUrl: 'https://docs.trueblocks.io/install/',
    docsUrl: 'https://docs.trueblocks.io/api/',
    defaultConcurrency: 3,
    freeTier: {
      available: true,
      limitKind: 'none',
      limitValue: null,
      callsPerAddressEstimate: 3,
      rateLimitPerSec: 3,
    },
    inputMode: 'base_url',
    isLocalDaemon: true,
  },
  moralis: {
    id: 'moralis',
    name: 'Moralis',
    tier: 'FREEMIUM',
    recommendationRank: 2,
    phase: 1,
    supportedChainCount: 15,
    supportsMultiChainCall: false,
    caveat: 'More calls per address; strongest when active-chain discovery reduces fanout.',
    keyLabel: 'Moralis API Key',
    keyPlaceholder: 'Paste your Moralis key',
    signupUrl: 'https://admin.moralis.com/',
    docsUrl: 'https://docs.moralis.com/web3-data-api/evm/reference/wallet-api/get-wallet-token-balances-price',
    defaultConcurrency: 5,
    freeTier: {
      available: true,
      limitKind: 'daily',
      limitValue: 40000,
      callsPerAddressEstimate: 4,
      rateLimitPerSec: 25,
    },
  },
  alchemy: {
    id: 'alchemy',
    name: 'Alchemy',
    tier: 'FREE',
    recommendationRank: 2,
    phase: 2,
    supportedChainCount: 30,
    supportsMultiChainCall: true,
    caveat: 'Phase 2 provider. Portfolio auth model is more complex than Ankr.',
    keyLabel: 'Alchemy API Key',
    keyPlaceholder: 'Phase 2 provider',
    signupUrl: 'https://dashboard.alchemy.com/signup',
    docsUrl: 'https://www.alchemy.com/docs/data/token-api/token-api-endpoints/alchemy-get-token-balances',
    defaultConcurrency: 8,
    freeTier: {
      available: true,
      limitKind: 'daily',
      limitValue: 300,
      callsPerAddressEstimate: 1,
      rateLimitPerSec: 30,
    },
  },
  covalent: {
    id: 'covalent',
    name: 'Covalent / GoldRush',
    tier: 'FREEMIUM',
    recommendationRank: 3,
    phase: 2,
    supportedChainCount: 100,
    supportsMultiChainCall: false,
    caveat: 'Phase 2 provider. Free quota is lifetime signup pool and strict 4 req/s.',
    keyLabel: 'Covalent API Key',
    keyPlaceholder: 'Phase 2 provider',
    signupUrl: 'https://goldrush.dev/platform/apikey/',
    docsUrl: 'https://goldrush.mintlify.app/docs/api/overview',
    defaultConcurrency: 2,
    freeTier: {
      available: true,
      limitKind: 'lifetime',
      limitValue: 25000,
      callsPerAddressEstimate: 4,
      rateLimitPerSec: 4,
    },
  },
  debank: {
    id: 'debank',
    name: 'DeBank Pro',
    tier: 'PAID',
    recommendationRank: 4,
    phase: 3,
    supportedChainCount: 200,
    supportsMultiChainCall: true,
    caveat: 'Phase 3 paid provider with broadest chain support.',
    keyLabel: 'DeBank AccessKey',
    keyPlaceholder: 'Phase 3 provider',
    signupUrl: 'https://cloud.debank.com/',
    docsUrl: 'https://docs.cloud.debank.com/en/readme/api-pro-reference/user',
    defaultConcurrency: 5,
    freeTier: {
      available: false,
      limitKind: 'none',
      limitValue: null,
      callsPerAddressEstimate: 1,
      rateLimitPerSec: null,
    },
  },
};

const state = {
  providerId: 'ankr',
  apiKey: '',
  providerInputs: {},
  manualCandidates: [],
  csvCandidates: [],
  csvLabelsByAddress: {},
  normalized: { valid: [], invalid: [], inputCount: 0 },
  csvMeta: 'No CSV loaded.',
  addressLabels: {},
  activeChainOptions: [],
  selectedChains: new Set(),
  dustThresholdUsd: 1,
  themeMode: 'auto',
  scan: {
    running: false,
    stopRequested: false,
    total: 0,
    completed: 0,
    failed: 0,
    timestamp: null,
    startedAtMs: 0,
    plannedTotalMs: 0,
    progressTimerId: null,
  },
  results: new Map(),
  sort: {
    key: 'totalUsdValue',
    direction: 'desc',
  },
};

const ui = {
  providerSelect: document.getElementById('provider-select'),
  apiKeyLabel: document.getElementById('api-key-label'),
  apiKeyInput: document.getElementById('api-key-input'),
  providerHelp: document.getElementById('provider-help'),
  providerInfo: document.getElementById('provider-info'),
  chainFilter: document.getElementById('chain-filter'),
  chainAllButton: document.getElementById('chain-all-button'),
  chainNoneButton: document.getElementById('chain-none-button'),
  dustFilterInput: document.getElementById('dust-filter-input'),
  themeToggle: document.getElementById('theme-toggle'),
  appVersion: document.getElementById('app-version'),
  manualInput: document.getElementById('manual-input'),
  csvInput: document.getElementById('csv-input'),
  dropzone: document.getElementById('dropzone'),
  csvMeta: document.getElementById('csv-meta'),
  validCount: document.getElementById('valid-count'),
  invalidCount: document.getElementById('invalid-count'),
  inputCount: document.getElementById('input-count'),
  invalidPreview: document.getElementById('invalid-preview'),
  statusBox: document.getElementById('status-box'),
  scanButton: document.getElementById('scan-button'),
  stopButton: document.getElementById('stop-button'),
  exportButton: document.getElementById('export-button'),
  progressFill: document.getElementById('progress-fill'),
  progressLabel: document.getElementById('progress-label'),
  resultsBody: document.getElementById('results-body'),
  summaryTotalUsd: document.getElementById('summary-total-usd'),
  summaryAddressCount: document.getElementById('summary-address-count'),
  summaryTokenCoverage: document.getElementById('summary-token-coverage'),
  summaryTopChains: document.getElementById('summary-top-chains'),
  summaryTopTokens: document.getElementById('summary-top-tokens'),
};

class AppError extends Error {
  constructor(message, code, statusCode, isOperational = true) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
  }
}

function getAvailableProviders() {
  return Object.values(PROVIDERS)
    .filter((provider) => provider.phase <= RELEASE_PHASE)
    .sort((a, b) => {
      const order = { FREE: 0, FREEMIUM: 1, PAID: 2 };
      if (order[a.tier] !== order[b.tier]) return order[a.tier] - order[b.tier];
      return (a.recommendationRank ?? 99) - (b.recommendationRank ?? 99);
    });
}

function setStatus(message, type = 'ok') {
  ui.statusBox.dataset.type = type;
  ui.statusBox.textContent = message;
}

function logEvent(level, event, payload = {}) {
  const envelope = {
    ts: new Date().toISOString(),
    level,
    event,
    provider: state.providerId,
    payload,
  };
  console.log(JSON.stringify(envelope));
}

function createAdapter(providerId, apiKey) {
  const provider = PROVIDERS[providerId];
  if (!provider || provider.phase > RELEASE_PHASE) {
    throw new AppError('Selected provider is not available in this phase.', 'provider_unavailable', 400);
  }
  const normalizedInput = String(apiKey || '').trim();
  if (providerId === 'trueblocks') {
    return new TrueBlocksAdapter(provider, normalizedInput || provider.defaultInputValue || TRUEBLOCKS_DEFAULT_BASE_URL);
  }

  if (!normalizedInput) {
    throw new AppError('API key is required.', 'missing_key', 400);
  }

  if (providerId === 'ankr') return new AnkrAdapter(provider, normalizedInput);
  if (providerId === 'moralis') return new MoralisAdapter(provider, normalizedInput);

  throw new AppError('Provider adapter not implemented in this phase.', 'provider_not_implemented', 501);
}

async function fetchJsonWithBackoff(url, options = {}, context = {}) {
  const retries = context.retries ?? 4;
  const initialDelayMs = context.initialDelayMs ?? 600;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetch(url, options);
    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return response.json();
      }
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch (_error) {
        throw new AppError('Invalid JSON response.', 'invalid_json', 502);
      }
    }

    const bodyText = await response.text();
    const bodyIncludesRateLimit = /rate|limit|429/i.test(bodyText);
    const rateLimited = response.status === 429 || bodyIncludesRateLimit;
    const retryable = rateLimited || response.status >= 500;

    if (!retryable || attempt === retries) {
      const message = `Request failed (${response.status}): ${bodyText.slice(0, 220)}`;
      throw new AppError(message, 'request_failed', response.status);
    }

    const delay = Math.min(initialDelayMs * (2 ** attempt), 8000);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw new AppError('Request retry budget exhausted.', 'retry_exhausted', 504);
}

function detectChainName(chainId) {
  const normalized = String(chainId || '').toLowerCase();
  return CHAIN_NAMES[normalized] || normalized || 'Unknown';
}

function buildChainFilterSet(selectedChains) {
  if (!selectedChains) return null;
  const list = Array.isArray(selectedChains) ? selectedChains : [...selectedChains];
  if (!list.length) return null;
  return new Set(list.map((chainId) => String(chainId).toLowerCase()));
}

class AnkrAdapter {
  constructor(provider, apiKey) {
    this.provider = provider;
    this.apiKey = apiKey;
    this.baseUrl = `https://rpc.ankr.com/multichain/${encodeURIComponent(apiKey)}`;
  }

  async validateKey() {
    return /^[a-zA-Z0-9._-]{8,}$/.test(this.apiKey);
  }

  async getSupportedChains() {
    return [
      { chainId: 'eth', chainName: 'Ethereum', isTestnet: false, enabledByDefault: true },
      { chainId: 'bsc', chainName: 'BNB Chain', isTestnet: false, enabledByDefault: true },
      { chainId: 'polygon', chainName: 'Polygon', isTestnet: false, enabledByDefault: true },
      { chainId: 'arbitrum', chainName: 'Arbitrum', isTestnet: false, enabledByDefault: true },
      { chainId: 'optimism', chainName: 'Optimism', isTestnet: false, enabledByDefault: true },
      { chainId: 'base', chainName: 'Base', isTestnet: false, enabledByDefault: true },
    ];
  }

  async getBalance(address, selectedChains = null) {
    const assets = await this.#fetchAssets(address, selectedChains);
    const chainTotals = new Map();

    for (const asset of assets) {
      const chainId = String(asset.blockchain || asset.chain || '').toLowerCase();
      const chainName = detectChainName(chainId);
      const usd = Core.safeNumber(asset.balanceUsd ?? asset.balance_usd ?? asset.usdValue ?? asset.value_usd);
      const previous = chainTotals.get(chainId) || { chainId, chainName, logoUrl: asset.thumbnail || '', usdValueNumber: 0 };
      previous.usdValueNumber += usd;
      previous.usdValue = previous.usdValueNumber.toFixed(8);
      chainTotals.set(chainId, previous);
    }

    const chains = [...chainTotals.values()]
      .filter((chain) => chain.usdValueNumber > 0)
      .sort((a, b) => b.usdValueNumber - a.usdValueNumber);

    const totalUsdValueNumber = chains.reduce((sum, chain) => sum + chain.usdValueNumber, 0);

    return {
      address,
      totalUsdValue: totalUsdValueNumber.toFixed(8),
      totalUsdValueNumber,
      chains,
      tokenCount: assets.length,
    };
  }

  async getTokens(address, selectedChains = null) {
    const assets = await this.#fetchAssets(address, selectedChains);
    const tokens = assets.map((asset) => {
      const chainId = String(asset.blockchain || asset.chain || '').toLowerCase();
      const decimals = Number(asset.tokenDecimals ?? asset.decimals ?? 18);
      const amountDecimal = String(asset.balance ?? asset.amount ?? '0');
      const amountRawCandidate = asset.balanceRawInteger ?? asset.balanceRaw ?? asset.balance_raw;
      const amountRaw = amountRawCandidate !== undefined && amountRawCandidate !== null
        ? String(amountRawCandidate)
        : Core.toRawFromDecimal(amountDecimal, decimals);

      const usdValueNumber = Core.safeNumber(asset.balanceUsd ?? asset.balance_usd ?? asset.usdValue ?? 0);

      return {
        address,
        chainId,
        chainName: detectChainName(chainId),
        tokenAddress: String(asset.contractAddress || asset.tokenAddress || 'native'),
        tokenSymbol: String(asset.tokenSymbol || asset.symbol || 'UNKNOWN'),
        tokenName: String(asset.tokenName || asset.name || asset.tokenSymbol || 'Unknown Token'),
        tokenDecimals: decimals,
        amountRaw,
        amountDecimal,
        usdValue: usdValueNumber.toFixed(8),
        usdValueNumber,
        logoUrl: String(asset.thumbnail || asset.logo || ''),
        isVerified: Boolean(asset.tokenType || asset.verified || false),
      };
    });

    return tokens.filter((token) => token.usdValueNumber > 0 || Core.safeNumber(token.amountDecimal) > 0);
  }

  async #fetchAssets(address, selectedChains = null) {
    const payload = {
      jsonrpc: '2.0',
      method: 'ankr_getAccountBalance',
      params: {
        walletAddress: address,
      },
      id: 1,
    };

    const data = await fetchJsonWithBackoff(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (data.error) {
      throw new AppError(data.error.message || 'Ankr API error', 'ankr_api_error', 502);
    }

    const assets = data?.result?.assets;
    if (!Array.isArray(assets)) {
      return [];
    }
    const chainFilterSet = buildChainFilterSet(selectedChains);
    if (!chainFilterSet) return assets;
    return assets.filter((asset) => {
      const chainId = String(asset.blockchain || asset.chain || '').toLowerCase();
      return chainFilterSet.has(chainId);
    });
  }
}

class MoralisAdapter {
  constructor(provider, apiKey) {
    this.provider = provider;
    this.apiKey = apiKey;
    this.baseUrl = 'https://deep-index.moralis.io/api/v2.2';
  }

  async validateKey() {
    return /^[a-zA-Z0-9._-]{8,}$/.test(this.apiKey);
  }

  async getSupportedChains() {
    return [
      { chainId: 'eth', chainName: 'Ethereum', isTestnet: false, enabledByDefault: true },
      { chainId: 'polygon', chainName: 'Polygon', isTestnet: false, enabledByDefault: true },
      { chainId: 'arbitrum', chainName: 'Arbitrum', isTestnet: false, enabledByDefault: true },
      { chainId: 'optimism', chainName: 'Optimism', isTestnet: false, enabledByDefault: true },
      { chainId: 'base', chainName: 'Base', isTestnet: false, enabledByDefault: true },
      { chainId: 'bsc', chainName: 'BNB Chain', isTestnet: false, enabledByDefault: true },
    ];
  }

  async getBalance(address, selectedChains = null) {
    const chainFilterSet = buildChainFilterSet(selectedChains);
    try {
      const data = await this.#request(`/wallets/${address}/net-worth?exclude_spam=true&exclude_unverified_contracts=true`);
      const chainList = Array.isArray(data?.chains) ? data.chains : Array.isArray(data?.chain_list) ? data.chain_list : [];
      const chains = chainList.map((chain) => {
        const chainId = String(chain.chain || chain.chain_id || chain.name || '').toLowerCase();
        const usdValueNumber = Core.safeNumber(chain.networth_usd ?? chain.usd_value ?? chain.usdValue ?? 0);
        return {
          chainId,
          chainName: detectChainName(chainId),
          logoUrl: String(chain.logo || chain.logo_url || ''),
          usdValue: usdValueNumber.toFixed(8),
          usdValueNumber,
        };
      }).filter((chain) => {
        if (chain.usdValueNumber <= 0) return false;
        if (!chainFilterSet) return true;
        return chainFilterSet.has(chain.chainId);
      });

      const totalUsdValueNumber = chains.reduce((sum, chain) => sum + Core.safeNumber(chain.usdValueNumber), 0);
      return {
        address,
        totalUsdValue: totalUsdValueNumber.toFixed(8),
        totalUsdValueNumber,
        chains,
        tokenCount: null,
      };
    } catch (_error) {
      const tokens = await this.getTokens(address, selectedChains);
      const chainTotals = new Map();
      for (const token of tokens) {
        const prev = chainTotals.get(token.chainId) || {
          chainId: token.chainId,
          chainName: token.chainName,
          logoUrl: token.logoUrl,
          usdValueNumber: 0,
        };
        prev.usdValueNumber += token.usdValueNumber;
        prev.usdValue = prev.usdValueNumber.toFixed(8);
        chainTotals.set(token.chainId, prev);
      }
      const chains = [...chainTotals.values()].sort((a, b) => b.usdValueNumber - a.usdValueNumber);
      const totalUsdValueNumber = chains.reduce((sum, chain) => sum + chain.usdValueNumber, 0);
      return {
        address,
        totalUsdValue: totalUsdValueNumber.toFixed(8),
        totalUsdValueNumber,
        chains,
        tokenCount: tokens.length,
      };
    }
  }

  async getTokens(address, selectedChains = null) {
    const chainFilterSet = buildChainFilterSet(selectedChains);
    const activeChains = await this.#getActiveChains(address);
    const targets = (activeChains.length > 0 ? activeChains : ['eth'])
      .filter((chainId) => !chainFilterSet || chainFilterSet.has(String(chainId).toLowerCase()));

    if (targets.length === 0) return [];
    const tokens = [];

    for (const chain of targets) {
      const encodedChain = encodeURIComponent(chain);
      const data = await this.#request(`/wallets/${address}/tokens?chain=${encodedChain}&exclude_spam=true&exclude_unverified_contracts=true`);
      const rows = Array.isArray(data?.result) ? data.result : Array.isArray(data) ? data : [];

      for (const row of rows) {
        const chainId = String(row.chain || chain).toLowerCase();
        const decimals = Number(row.decimals ?? row.token_decimals ?? 18);
        const raw = String(row.balance ?? row.amount_raw ?? '0');
        const amountDecimal = row.balance_formatted
          ? String(row.balance_formatted)
          : Core.toDecimalFromRaw(raw, decimals);

        const usdValueNumber = Core.safeNumber(row.usd_value ?? row.usdValue ?? row.value_usd ?? 0);

        tokens.push({
          address,
          chainId,
          chainName: detectChainName(chainId),
          tokenAddress: String(row.token_address || row.contract_address || 'native'),
          tokenSymbol: String(row.symbol || row.token_symbol || 'UNKNOWN'),
          tokenName: String(row.name || row.token_name || row.symbol || 'Unknown Token'),
          tokenDecimals: decimals,
          amountRaw: raw,
          amountDecimal,
          usdValue: usdValueNumber.toFixed(8),
          usdValueNumber,
          logoUrl: String(row.logo || row.logo_url || ''),
          isVerified: row.verified_contract !== false,
        });
      }
    }

    return tokens.filter((token) => token.usdValueNumber > 0 || Core.safeNumber(token.amountDecimal) > 0);
  }

  async #getActiveChains(address) {
    const data = await this.#request(`/wallets/${address}/chains`);
    const rows = Array.isArray(data) ? data : Array.isArray(data?.result) ? data.result : [];

    return rows
      .map((row) => String(row.chain || row.chain_id || row.name || '').toLowerCase())
      .filter(Boolean);
  }

  async #request(path) {
    const url = `${this.baseUrl}${path}`;
    return fetchJsonWithBackoff(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'X-API-Key': this.apiKey,
      },
    }, {
      retries: 4,
      initialDelayMs: 600,
    });
  }
}

class TrueBlocksAdapter {
  constructor(provider, baseUrl) {
    this.provider = provider;
    this.baseUrl = String(baseUrl || TRUEBLOCKS_DEFAULT_BASE_URL).trim();
    this.discoveredChains = null;
  }

  async validateKey() {
    const parsed = this.#parseBaseUrl();
    if (window.location.protocol === 'https:' && parsed.protocol === 'http:') {
      throw new AppError(
        'HTTPS pages cannot call an HTTP local daemon. Run this app locally over HTTP or expose TrueBlocks over HTTPS.',
        'trueblocks_mixed_content',
        400
      );
    }
    try {
      const response = await this.#request('/status?chains=true');
      this.discoveredChains = Core.normalizeTrueBlocksChains(response);
      return true;
    } catch (error) {
      throw this.#mapSetupError(error);
    }
  }

  async getSupportedChains() {
    if (Array.isArray(this.discoveredChains) && this.discoveredChains.length > 0) {
      return this.discoveredChains;
    }

    try {
      const response = await this.#request('/status?chains=true');
      const chains = Core.normalizeTrueBlocksChains(response);
      this.discoveredChains = chains;
      return chains;
    } catch (_error) {
      const fallback = Core.normalizeTrueBlocksChains(null);
      this.discoveredChains = fallback;
      return fallback;
    }
  }

  async getBalance(address, selectedChains = null) {
    const discoveredChains = await this.getSupportedChains();
    const chainFilterSet = buildChainFilterSet(selectedChains);
    const targets = discoveredChains.filter((chain) => !chainFilterSet || chainFilterSet.has(String(chain.chainId).toLowerCase()));

    if (targets.length === 0) {
      throw new AppError('No TrueBlocks chains selected. Choose at least one chain in the filter.', 'trueblocks_no_chains', 400);
    }

    const uniquePriceIds = [...new Set(
      targets
        .map((chain) => Core.coinGeckoIdForNativeAsset(chain.chainId, chain.nativeSymbol))
        .filter(Boolean)
    )];
    const pricing = await Core.fetchCoinGeckoSimplePrices(uniquePriceIds);

    const attempts = await this.#mapWithConcurrency(targets, TRUEBLOCKS_CHAIN_CONCURRENCY, async (chain) => {
      const chainId = String(chain.chainId).toLowerCase();
      const chainName = String(chain.chainName || detectChainName(chainId));
      try {
        const response = await this.#request(
          `/state?addrs=${encodeURIComponent(address)}&parts=balance&ether=true&chain=${encodeURIComponent(chainId)}`
        );
        const normalized = Core.normalizeTrueBlocksStateBalance(response);
        if (!normalized) {
          throw new AppError(`Missing balance fields for chain ${chainId}.`, 'trueblocks_balance_missing', 502);
        }

        const priceId = Core.coinGeckoIdForNativeAsset(chainId, chain.nativeSymbol);
        const usdPrice = priceId ? pricing.pricesById.get(priceId) : null;
        const hasPrice = Number.isFinite(usdPrice);
        const usdValueNumber = hasPrice ? normalized.amountNumber * usdPrice : 0;

        return {
          success: true,
          chainId,
          chainName,
          nativeSymbol: String(chain.nativeSymbol || 'ETH'),
          amountRaw: normalized.amountRaw,
          amountDecimal: normalized.amountDecimal,
          amountNumber: normalized.amountNumber,
          usdValueNumber,
          usdValue: hasPrice ? usdValueNumber.toFixed(8) : '',
          priceUnavailable: !hasPrice,
          tokenCount: 1,
        };
      } catch (error) {
        return {
          success: false,
          chainId,
          error: error instanceof Error ? error.message : 'Unknown chain request failure',
        };
      }
    });

    const summary = Core.summarizeTrueBlocksAttempts(attempts);
    if (pricing.errors.length > 0) {
      summary.warnings.push('CoinGecko price lookup failed for one or more assets. USD values are shown as N/A where missing.');
    }

    if (summary.allFailed) {
      const message = summary.warnings[0] || 'All TrueBlocks chain requests failed.';
      throw new AppError(message, 'trueblocks_all_failed', 502);
    }

    const totalUsdValueNumber = summary.chains.reduce((sum, chain) => sum + Core.safeNumber(chain.usdValueNumber), 0);
    return {
      address,
      totalUsdValue: totalUsdValueNumber.toFixed(8),
      totalUsdValueNumber,
      chains: summary.chains,
      tokenCount: summary.chains.length,
      warnings: summary.warnings,
      nativeOnly: true,
    };
  }

  async getTokens(address, selectedChains = null) {
    const balance = await this.getBalance(address, selectedChains);
    return balance.chains.map((chain) => ({
      address,
      chainId: chain.chainId,
      chainName: chain.chainName,
      tokenAddress: 'native',
      tokenSymbol: chain.nativeSymbol || 'ETH',
      tokenName: `${chain.chainName} Native`,
      tokenDecimals: 18,
      amountRaw: chain.amountRaw,
      amountDecimal: chain.amountDecimal,
      usdValue: chain.priceUnavailable ? '' : String(chain.usdValue || '0'),
      usdValueNumber: chain.priceUnavailable ? 0 : Core.safeNumber(chain.usdValueNumber),
      usdValueUnavailable: Boolean(chain.priceUnavailable),
      isVerified: true,
      isNative: true,
    }));
  }

  #mapSetupError(error) {
    if (error instanceof AppError) return error;
    if (error instanceof TypeError) {
      return new AppError(
        `Unable to reach TrueBlocks daemon at ${this.baseUrl}. Start it with "chifra daemon" and confirm browser access/CORS settings.`,
        'trueblocks_unreachable',
        502
      );
    }
    return new AppError(
      `TrueBlocks setup failed for ${this.baseUrl}: ${error instanceof Error ? error.message : 'unknown error'}`,
      'trueblocks_setup_failed',
      502
    );
  }

  #parseBaseUrl() {
    try {
      return new URL(this.baseUrl);
    } catch (_error) {
      throw new AppError(
        `Invalid TrueBlocks Base URL. Example: ${TRUEBLOCKS_DEFAULT_BASE_URL}`,
        'trueblocks_invalid_url',
        400
      );
    }
  }

  async #request(path) {
    this.#parseBaseUrl();
    const url = `${this.baseUrl.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;

    let response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
      });
    } catch (error) {
      throw new AppError(
        `Cannot reach TrueBlocks daemon at ${this.baseUrl}: ${error instanceof Error ? error.message : 'network/CORS error'}`,
        'trueblocks_unreachable',
        502
      );
    }

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    let json = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch (_error) {
        throw new AppError(
          `TrueBlocks returned non-JSON output (${contentType || 'unknown content type'}). Check the daemon URL.`,
          'trueblocks_non_json',
          502
        );
      }
    }

    if (!response.ok) {
      const hint = json?.error?.message || json?.message || text.slice(0, 220) || 'request failed';
      throw new AppError(`TrueBlocks request failed (${response.status}): ${hint}`, 'trueblocks_http_error', response.status);
    }

    if (!json || typeof json !== 'object') {
      throw new AppError('TrueBlocks returned an empty response.', 'trueblocks_empty_response', 502);
    }
    return json;
  }

  async #mapWithConcurrency(items, concurrency, worker) {
    const list = [...items];
    const results = new Array(list.length);
    let index = 0;
    const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
      while (true) {
        const current = index;
        index += 1;
        if (current >= list.length) return;
        results[current] = await worker(list[current], current);
      }
    });
    await Promise.all(workers);
    return results;
  }
}

function updateProviderUI() {
  const provider = PROVIDERS[state.providerId];
  if (!state.apiKey && provider.inputMode === 'base_url') {
    state.apiKey = provider.defaultInputValue || TRUEBLOCKS_DEFAULT_BASE_URL;
  }
  state.providerInputs[state.providerId] = state.apiKey;

  ui.apiKeyLabel.textContent = provider.keyLabel;
  ui.apiKeyInput.placeholder = provider.keyPlaceholder;
  ui.apiKeyInput.value = state.apiKey;

  const tierTag = `<span class="badge">${provider.tier}</span>`;
  const actionLabel = provider.signupLabel || (provider.inputMode === 'base_url' ? 'Setup' : 'Get key');
  const actionLink = provider.signupUrl
    ? `<a href="${provider.signupUrl}" target="_blank" rel="noopener noreferrer">${actionLabel}</a>`
    : '';
  const modeHint = provider.inputMode === 'base_url' ? 'Local daemon endpoint' : 'Hosted API key';
  ui.providerHelp.innerHTML = [tierTag, `~${provider.supportedChainCount} chains`, modeHint, actionLink, `<a href="${provider.docsUrl}" target="_blank" rel="noopener noreferrer">Docs</a>`]
    .filter(Boolean)
    .join(' · ');
  renderProviderInfo();
}

function renderProviderInfo() {
  const provider = PROVIDERS[state.providerId];
  const limitValueText = provider.freeTier.limitValue === null ? 'Unknown' : String(provider.freeTier.limitValue);
  const setupRow = provider.signupUrl
    ? `<div class="row"><span>${provider.inputMode === 'base_url' ? 'Setup' : 'Key link'}</span><strong><a href="${provider.signupUrl}" target="_blank" rel="noopener noreferrer">open</a></strong></div>`
    : '';
  const endpointRow = provider.inputMode === 'base_url'
    ? `<div class="row"><span>Default endpoint</span><strong>${Core.sanitizeText(provider.defaultInputValue || TRUEBLOCKS_DEFAULT_BASE_URL)}</strong></div>`
    : '';
  ui.providerInfo.innerHTML = `
    <div class="row"><span>Tier</span><strong>${Core.sanitizeText(provider.tier)}</strong></div>
    <div class="row"><span>Phase</span><strong>${provider.phase}</strong></div>
    <div class="row"><span>Chain coverage</span><strong>~${provider.supportedChainCount}</strong></div>
    <div class="row"><span>Call model</span><strong>${provider.supportsMultiChainCall ? 'single-call' : 'per-chain'}</strong></div>
    <div class="row"><span>Quota window</span><strong>${Core.sanitizeText(provider.freeTier.limitKind)}</strong></div>
    <div class="row"><span>Quota reference</span><strong>${Core.sanitizeText(limitValueText)}</strong></div>
    <div class="row"><span>Rate limit/s</span><strong>${provider.freeTier.rateLimitPerSec ?? 'unknown'}</strong></div>
    <div class="row"><span>Address pacing</span><strong>${SCAN_ADDRESS_DELAY_MS / 1000}s between scans</strong></div>
    ${endpointRow}
    ${setupRow}
    <div class="row"><span>Docs</span><strong><a href="${provider.docsUrl}" target="_blank" rel="noopener noreferrer">open</a></strong></div>
    <div class="footnote">${Core.sanitizeText(provider.caveat)}</div>
  `;
}

function selectedChainCount() {
  return state.selectedChains.size > 0 ? state.selectedChains.size : state.activeChainOptions.length;
}

function getScanTimingProviderView() {
  const provider = PROVIDERS[state.providerId];
  const callsPerAddress = provider.supportsMultiChainCall
    ? provider.freeTier.callsPerAddressEstimate
    : provider.id === 'trueblocks'
      ? Math.max(1, selectedChainCount() || 1)
      : Math.max(1, Math.min(provider.freeTier.callsPerAddressEstimate, selectedChainCount() || 1));

  return {
    ...provider,
    freeTier: {
      ...provider.freeTier,
      callsPerAddressEstimate: callsPerAddress,
    },
  };
}

function estimateScanDurationSeconds(addressCount) {
  const provider = getScanTimingProviderView();
  const estimate = Core.estimateBudget(provider, addressCount);
  const pacingSeconds = Math.max(0, addressCount - 1) * (SCAN_ADDRESS_DELAY_MS / 1000);
  return Number((estimate.estimatedSeconds + pacingSeconds).toFixed(1));
}

function updateAddressState() {
  const merged = [...state.manualCandidates, ...state.csvCandidates];
  state.normalized = Core.normalizeAddresses(merged);
  state.addressLabels = {};

  for (const address of state.normalized.valid) {
    const label = state.csvLabelsByAddress[address.toLowerCase()];
    if (label) {
      state.addressLabels[address.toLowerCase()] = label;
    }
  }

  ui.validCount.textContent = String(state.normalized.valid.length);
  ui.invalidCount.textContent = String(state.normalized.invalid.length);
  ui.inputCount.textContent = String(state.normalized.inputCount);

  if (state.normalized.invalid.length > 0) {
    const sample = state.normalized.invalid.slice(0, 5).join(', ');
    const suffix = state.normalized.invalid.length > 5 ? ` (+${state.normalized.invalid.length - 5} more)` : '';
    ui.invalidPreview.textContent = `Invalid sample: ${sample}${suffix}`;
  } else {
    ui.invalidPreview.textContent = 'No invalid addresses detected.';
  }
}

function createMetadataAdapter(providerId) {
  const provider = PROVIDERS[providerId];
  if (!provider) throw new AppError('Unknown provider for chain metadata.', 'provider_unknown', 400);
  if (providerId === 'ankr') return new AnkrAdapter(provider, 'metadata-key');
  if (providerId === 'trueblocks') {
    const endpoint = state.apiKey.trim() || provider.defaultInputValue || TRUEBLOCKS_DEFAULT_BASE_URL;
    return new TrueBlocksAdapter(provider, endpoint);
  }
  if (providerId === 'moralis') return new MoralisAdapter(provider, 'metadata-key');
  throw new AppError('Provider metadata adapter unavailable in this phase.', 'provider_metadata_unavailable', 400);
}

function renderChainFilter() {
  ui.chainFilter.innerHTML = state.activeChainOptions
    .map((chain) => `<option value="${chain.chainId}">${Core.sanitizeText(chain.chainName)} (${chain.chainId})</option>`)
    .join('');

  for (const option of ui.chainFilter.options) {
    option.selected = state.selectedChains.has(option.value);
  }
}

async function loadChainOptions() {
  try {
    const adapter = createMetadataAdapter(state.providerId);
    const chains = await adapter.getSupportedChains();
    state.activeChainOptions = chains.map((chain) => ({
      chainId: String(chain.chainId).toLowerCase(),
      chainName: String(chain.chainName || chain.chainId),
      enabledByDefault: chain.enabledByDefault !== false,
    }));
    const defaultChainIds = state.activeChainOptions
      .filter((chain) => chain.enabledByDefault)
      .map((chain) => chain.chainId);
    const selected = defaultChainIds.length > 0
      ? defaultChainIds
      : state.activeChainOptions.map((chain) => chain.chainId);
    state.selectedChains = new Set(selected);
    renderChainFilter();
  } catch (error) {
    setStatus(error.message || 'Failed to load provider chains.', 'error');
    state.activeChainOptions = [];
    state.selectedChains = new Set();
    renderChainFilter();
  }
}

function applyTheme(mode) {
  state.themeMode = mode;
  const mediaPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const effectiveMode = mode === 'auto' ? (mediaPrefersDark ? 'dark' : 'light') : mode;
  document.documentElement.dataset.theme = effectiveMode;
  ui.themeToggle.textContent = `Theme: ${mode[0].toUpperCase()}${mode.slice(1)}`;
}

function renderProgress() {
  const total = state.scan.total;
  const completed = state.scan.completed;
  const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  ui.progressFill.style.width = `${pct}%`;

  let label = `${completed} / ${total} complete`;
  if (state.scan.running && state.scan.startedAtMs > 0 && state.scan.plannedTotalMs > 0) {
    const elapsedMs = Math.max(0, Date.now() - state.scan.startedAtMs);
    const remainingMs = Math.max(0, state.scan.plannedTotalMs - elapsedMs);
    label = `${label} · ~${Core.formatDurationMs(remainingMs)} left`;
  }

  ui.progressLabel.textContent = label;
}

function getRowsForRendering() {
  const list = [...state.results.values()];
  return Core.sortRows(list, state.sort);
}

function renderDashboard(rows) {
  const dashboard = Core.computeDashboard(rows, state.dustThresholdUsd);
  ui.summaryTotalUsd.textContent = Core.formatUsd(dashboard.totalUsd);
  ui.summaryAddressCount.textContent = String(dashboard.scannedAddressCount);
  ui.summaryTokenCoverage.textContent = `${dashboard.tokenCoverage.loaded} / ${dashboard.tokenCoverage.total}`;

  if (dashboard.topChains.length === 0) {
    ui.summaryTopChains.innerHTML = '<li class="muted">No chain data yet.</li>';
  } else {
    ui.summaryTopChains.innerHTML = dashboard.topChains
      .map((chain) => `<li>${Core.sanitizeText(chain.name)} · ${Core.formatUsd(chain.usdValueNumber)}</li>`)
      .join('');
  }

  if (dashboard.topTokens.length === 0) {
    ui.summaryTopTokens.innerHTML = '<li class="muted">Load token details to compute rankings.</li>';
  } else {
    ui.summaryTopTokens.innerHTML = dashboard.topTokens
      .map((token) => `<li>${Core.sanitizeText(token.symbol)} (${Core.sanitizeText(token.name)}) · ${Core.formatUsd(token.usdValueNumber)}</li>`)
      .join('');
  }
}

function renderResults() {
  const rows = getRowsForRendering();
  renderDashboard(rows);
  if (rows.length === 0) {
    ui.resultsBody.innerHTML = `<tr><td colspan="7"><div class="empty">No scan results yet.</div></td></tr>`;
    ui.exportButton.disabled = true;
    return;
  }

  const html = [];

  for (const row of rows) {
    const status = row.status;
    const summary = row.summary || {};
    const topChain = summary.topChainName
      ? `${summary.topChainName} (${summary.topChainUsdUnavailable ? 'N/A' : Core.formatUsd(summary.topChainUsdValueNumber || 0)})`
      : '—';
    const tokenCountValue = row.tokensLoaded
      ? Core.filterTokensByDust(row.tokens || [], state.dustThresholdUsd).length
      : summary.tokenCount;
    const tokenCountText = tokenCountValue === null || tokenCountValue === undefined ? '—' : String(tokenCountValue);
    const actions = [];
    const addressLabel = state.addressLabels[row.address.toLowerCase()];

    if (status === 'error') {
      actions.push(`<button class="button-secondary" data-action="retry" data-address="${row.address}" type="button">Retry</button>`);
    } else if (status === 'success') {
      const buttonText = row.expanded ? 'Hide' : 'Details';
      actions.push(`<button class="button-ghost" data-action="toggle" data-address="${row.address}" type="button">${buttonText}</button>`);
    } else {
      actions.push('—');
    }

    const statusBadgeClass = status === 'success' ? 'ok' : status === 'error' ? 'error' : status === 'running' ? 'warn' : '';

    html.push(`
      <tr data-status="${Core.sanitizeText(status)}">
        <td class="mono">${Core.sanitizeText(row.address)}${addressLabel ? `<span class="address-label">${Core.sanitizeText(addressLabel)}</span>` : ''}</td>
        <td>${Core.formatUsd(summary.totalUsdValueNumber || 0)}</td>
        <td>${Core.sanitizeText(summary.chainCount ?? 0)}</td>
        <td>${Core.sanitizeText(tokenCountText)}</td>
        <td>${Core.sanitizeText(topChain)}</td>
        <td><span class="badge ${statusBadgeClass}">${Core.sanitizeText(status)}</span>${row.error ? `<div class="footnote">${Core.sanitizeText(row.error)}</div>` : ''}</td>
        <td>${actions.join(' ')}</td>
      </tr>
    `);

    if (row.expanded) {
      html.push(`<tr><td colspan="7">${renderDetails(row)}</td></tr>`);
    }
  }

  ui.resultsBody.innerHTML = html.join('');

  const successfulCount = rows.filter((row) => row.status === 'success').length;
  ui.exportButton.disabled = successfulCount === 0 || state.scan.running;
}

function renderDetails(row) {
  const chains = row.summary?.chains || [];
  const warnings = Array.isArray(row.warnings) ? row.warnings : [];
  const warningBlock = warnings.length > 0
    ? `
      <div class="footnote">
        <strong>Warnings:</strong>
        <ul>
          ${warnings.map((warning) => `<li class="mono">${Core.sanitizeText(warning)}</li>`).join('')}
        </ul>
      </div>
    `
    : '';
  const chainItems = chains.length > 0
    ? chains.map((chain) => {
      const usdLabel = chain.priceUnavailable ? 'N/A' : Core.formatUsd(chain.usdValueNumber || 0);
      const nativeBits = chain.amountDecimal !== undefined
        ? ` · ${Core.sanitizeText(chain.amountDecimal)} ${Core.sanitizeText(chain.nativeSymbol || '')}`
        : '';
      return `<li class="mono">${Core.sanitizeText(chain.chainName)}${nativeBits} · ${usdLabel}</li>`;
    }).join('')
    : '<li class="mono muted">No chain detail available.</li>';

  if (row.summary?.nativeOnly) {
    const nativeRows = chains.length > 0
      ? `
        <table class="token-table">
          <thead>
            <tr>
              <th>Chain</th>
              <th>Native</th>
              <th>USD</th>
            </tr>
          </thead>
          <tbody>
            ${chains.map((chain) => `
              <tr>
                <td class="mono">${Core.sanitizeText(chain.chainName)}</td>
                <td class="mono">${Core.sanitizeText(chain.amountDecimal || '0')} ${Core.sanitizeText(chain.nativeSymbol || 'ETH')}</td>
                <td>${chain.priceUnavailable ? 'N/A' : Core.formatUsd(chain.usdValueNumber || 0)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `
      : '<div class="muted">No chain detail available.</div>';

    return `
      <div class="details">
        ${warningBlock}
        <div class="details-grid">
          <div>
            <strong>Chains by value</strong>
            <ul>${chainItems}</ul>
          </div>
          <div>
            <strong>Native Balances (MVP)</strong>
            ${nativeRows}
            <div class="footnote">TrueBlocks mode currently includes native balances only. Token-level holdings are out of scope in this MVP.</div>
          </div>
        </div>
      </div>
    `;
  }

  if (row.tokensLoading) {
    return `<div class="details">Loading token detail...</div>`;
  }

  if (row.tokenError) {
    return `<div class="details"><div class="muted">Token detail failed: ${Core.sanitizeText(row.tokenError)}</div></div>`;
  }

  const tokens = Core.filterTokensByDust(row.tokens || [], state.dustThresholdUsd);
  const tokenTable = tokens.length > 0
    ? `
      <table class="token-table">
        <thead>
          <tr>
            <th>Chain</th>
            <th>Symbol</th>
            <th>Amount</th>
            <th>USD</th>
          </tr>
        </thead>
        <tbody>
          ${tokens.slice(0, 120).map((token) => `
            <tr>
              <td class="mono">${Core.sanitizeText(token.chainName)}</td>
              <td class="mono">${Core.sanitizeText(token.tokenSymbol)}</td>
              <td class="mono">${Core.sanitizeText(token.amountDecimal)}</td>
              <td>${token.usdValueUnavailable ? 'N/A' : Core.formatUsd(token.usdValueNumber || 0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${tokens.length > 120 ? `<div class="footnote">Showing first 120 of ${tokens.length} tokens.</div>` : ''}
    `
    : '<div class="muted">No token rows returned.</div>';

  return `
    <div class="details">
      ${warningBlock}
      <div class="details-grid">
        <div>
          <strong>Chains by value</strong>
          <ul>${chainItems}</ul>
        </div>
        <div>
          <strong>Tokens</strong>
          ${tokenTable}
        </div>
      </div>
    </div>
  `;
}

function setScanControls(running) {
  state.scan.running = running;

  if (state.scan.progressTimerId !== null) {
    clearInterval(state.scan.progressTimerId);
    state.scan.progressTimerId = null;
  }
  if (running) {
    state.scan.progressTimerId = setInterval(() => {
      renderProgress();
    }, 1000);
  }

  ui.scanButton.disabled = running;
  ui.stopButton.disabled = !running;
  ui.exportButton.disabled = running || [...state.results.values()].filter((row) => row.status === 'success').length === 0;
}

async function runWithConcurrency(items, concurrency, worker) {
  const list = [...items];
  let index = 0;

  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      if (state.scan.stopRequested) return;
      const current = index;
      index += 1;
      if (current >= list.length) return;
      await worker(list[current], current);
    }
  });

  await Promise.all(workers);
}

function computeSummary(balanceResult) {
  const chains = Array.isArray(balanceResult.chains) ? balanceResult.chains : [];
  const sortedChains = [...chains].sort((a, b) => (b.usdValueNumber || 0) - (a.usdValueNumber || 0));
  const topChain = sortedChains[0] || null;

  return {
    totalUsdValue: String(balanceResult.totalUsdValue || '0'),
    totalUsdValueNumber: Core.safeNumber(balanceResult.totalUsdValueNumber ?? balanceResult.totalUsdValue),
    chainCount: sortedChains.length,
    tokenCount: balanceResult.tokenCount ?? null,
    topChainName: topChain?.chainName || '',
    topChainUsdValueNumber: Core.safeNumber(topChain?.usdValueNumber),
    topChainUsdUnavailable: Boolean(topChain?.priceUnavailable),
    nativeOnly: Boolean(balanceResult.nativeOnly),
    chains: sortedChains,
  };
}

function buildNativeTokensFromSummary(entry) {
  const chains = Array.isArray(entry?.summary?.chains) ? entry.summary.chains : [];
  return chains.map((chain) => {
    const usdValueNumber = Core.safeNumber(chain.usdValueNumber);
    return {
      address: entry.address,
      chainId: chain.chainId,
      chainName: chain.chainName,
      tokenAddress: 'native',
      tokenSymbol: chain.nativeSymbol || 'ETH',
      tokenName: `${chain.chainName} Native`,
      tokenDecimals: 18,
      amountRaw: String(chain.amountRaw || '0'),
      amountDecimal: String(chain.amountDecimal || '0'),
      usdValue: chain.priceUnavailable ? '' : usdValueNumber.toFixed(8),
      usdValueNumber: chain.priceUnavailable ? 0 : usdValueNumber,
      usdValueUnavailable: Boolean(chain.priceUnavailable),
      isVerified: true,
      isNative: true,
    };
  });
}

async function scanAddress(adapter, address) {
  const entry = state.results.get(address) || createResultEntry(address);
  entry.status = 'running';
  entry.error = null;
  entry.warnings = [];
  state.results.set(address, entry);
  renderResults();

  try {
    const balanceResult = await adapter.getBalance(address, state.selectedChains);
    entry.summary = computeSummary(balanceResult);
    entry.warnings = Array.isArray(balanceResult.warnings) ? balanceResult.warnings : [];
    entry.status = 'success';
    entry.error = null;
    logEvent('info', 'scan.address.success', {
      address,
      totalUsd: entry.summary.totalUsdValue,
      warningCount: entry.warnings.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown scan error';
    entry.status = 'error';
    entry.error = message;
    entry.warnings = [];
    state.scan.failed += 1;
    logEvent('error', 'scan.address.error', { address, message });
  } finally {
    state.scan.completed += 1;
    state.results.set(address, entry);
    renderProgress();
    renderResults();
  }
}

function createResultEntry(address) {
  return {
    address,
    status: 'pending',
    summary: {
      totalUsdValue: '0',
      totalUsdValueNumber: 0,
      chainCount: 0,
      tokenCount: null,
      topChainName: '',
      topChainUsdValueNumber: 0,
      topChainUsdUnavailable: false,
      nativeOnly: false,
      chains: [],
    },
    warnings: [],
    tokens: null,
    tokensLoading: false,
    tokensLoaded: false,
    tokenError: null,
    error: null,
    expanded: false,
  };
}

async function startScan() {
  if (state.scan.running) return;

  if (state.normalized.valid.length === 0) {
    setStatus('Add at least one valid address before scanning.', 'warn');
    return;
  }

  if (state.selectedChains.size === 0) {
    setStatus('Select at least one chain before scanning.', 'warn');
    return;
  }

  let adapter;
  try {
    adapter = createAdapter(state.providerId, state.apiKey);
    const validKey = await adapter.validateKey();
    if (!validKey) {
      throw new AppError('Provider credential validation failed.', 'invalid_key', 400);
    }
  } catch (error) {
    setStatus(error.message || 'Provider setup failed.', 'error');
    return;
  }

  state.scan.stopRequested = false;
  state.scan.total = state.normalized.valid.length;
  state.scan.completed = 0;
  state.scan.failed = 0;
  state.scan.timestamp = new Date().toISOString();
  state.scan.startedAtMs = Date.now();
  state.scan.plannedTotalMs = estimateScanDurationSeconds(state.scan.total) * 1000;
  state.results = new Map(state.normalized.valid.map((address) => [address, createResultEntry(address)]));

  setScanControls(true);
  setStatus(
    `Scanning ${state.scan.total} address(es) with ${PROVIDERS[state.providerId].name} (${SCAN_ADDRESS_DELAY_MS / 1000}s pacing)...`,
    'ok'
  );
  renderProgress();
  renderResults();

  try {
    await Core.runSequentialWithDelay(state.normalized.valid, async (address) => {
      await scanAddress(adapter, address);
    }, {
      delayMs: SCAN_ADDRESS_DELAY_MS,
      shouldStop: () => state.scan.stopRequested,
    });
  } finally {
    setScanControls(false);
    if (state.scan.stopRequested) {
      setStatus('Scan stopped by user request.', 'warn');
    } else {
      const success = state.scan.total - state.scan.failed;
      setStatus(`Scan complete. Success: ${success}, Failed: ${state.scan.failed}.`, state.scan.failed > 0 ? 'warn' : 'ok');
      if (success > 0) {
        hydrateSummaryTokens();
      }
    }
    renderResults();
  }
}

async function retryAddress(address) {
  if (state.scan.running) return;
  let adapter;
  try {
    adapter = createAdapter(state.providerId, state.apiKey);
  } catch (error) {
    setStatus(error.message || 'Provider setup failed.', 'error');
    return;
  }

  setStatus(`Retrying ${address}...`, 'ok');
  await scanAddress(adapter, address);
  setStatus(`Retry finished for ${address}.`, 'ok');
}

async function ensureTokensLoaded(adapter, address) {
  const entry = state.results.get(address);
  if (!entry || entry.status !== 'success') return;
  if (entry.tokensLoaded) return;
  if (entry.tokensLoading) return;

  entry.tokensLoading = true;
  entry.tokenError = null;
  state.results.set(address, entry);
  renderResults();

  if (entry.summary?.nativeOnly) {
    const tokens = buildNativeTokensFromSummary(entry);
    entry.tokens = tokens;
    entry.tokensLoaded = true;
    entry.tokensLoading = false;
    entry.tokenError = null;
    entry.summary.tokenCount = tokens.length;
    state.results.set(address, entry);
    renderResults();
    return;
  }

  try {
    const tokens = await adapter.getTokens(address, state.selectedChains);
    entry.tokens = tokens;
    entry.tokensLoaded = true;
    entry.tokensLoading = false;
    entry.tokenError = null;
    entry.summary.tokenCount = tokens.length;
  } catch (error) {
    entry.tokensLoading = false;
    entry.tokenError = error instanceof Error ? error.message : 'Failed to load tokens';
    logEvent('error', 'tokens.load.error', { address, message: entry.tokenError });
  } finally {
    state.results.set(address, entry);
    renderResults();
  }
}

async function toggleDetails(address) {
  const entry = state.results.get(address);
  if (!entry) return;

  entry.expanded = !entry.expanded;
  state.results.set(address, entry);
  renderResults();

  if (entry.expanded && !entry.tokensLoaded && !entry.tokensLoading) {
    if (entry.summary?.nativeOnly) {
      await ensureTokensLoaded(null, address);
      return;
    }
    let adapter;
    try {
      adapter = createAdapter(state.providerId, state.apiKey);
    } catch (error) {
      entry.tokenError = error.message;
      state.results.set(address, entry);
      renderResults();
      return;
    }
    await ensureTokensLoaded(adapter, address);
  }
}

async function hydrateSummaryTokens() {
  const successful = [...state.results.values()].filter((entry) => entry.status === 'success' && !entry.tokensLoaded && !entry.tokensLoading);
  if (successful.length === 0) return;

  let adapter;
  try {
    adapter = createAdapter(state.providerId, state.apiKey);
  } catch (error) {
    logEvent('warn', 'summary.tokens.skip', { reason: error.message || 'adapter_create_failed' });
    return;
  }

  setStatus(`Loading token detail for dashboard (${successful.length} addresses)...`, 'ok');
  await runWithConcurrency(successful.map((entry) => entry.address), 2, async (address) => {
    await ensureTokensLoaded(adapter, address);
  });
  setStatus('Dashboard token aggregation is up to date.', 'ok');
}

async function exportCsvFull() {
  if (state.scan.running) return;
  const successful = [...state.results.values()].filter((entry) => entry.status === 'success');
  if (successful.length === 0) {
    setStatus('No successful rows to export.', 'warn');
    return;
  }

  let adapter;
  try {
    adapter = createAdapter(state.providerId, state.apiKey);
  } catch (error) {
    setStatus(error.message || 'Provider setup failed.', 'error');
    return;
  }

  setStatus('Prefetching token rows for full export...', 'ok');
  ui.exportButton.disabled = true;

  await runWithConcurrency(successful.map((entry) => entry.address), 3, async (address) => {
    await ensureTokensLoaded(adapter, address);
  });

  const timestamp = new Date().toISOString();
  const finishedEntries = [...state.results.values()].filter((row) => row.status === 'success');
  const tokenLoadFailures = finishedEntries.filter((entry) => Boolean(entry.tokenError)).length;
  const records = Core.buildExportRecords(finishedEntries, {
    timestamp,
    providerId: state.providerId,
  });

  const csv = Core.toCsv(records);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = `balance-scan-${state.providerId}-${timestamp.replace(/[:.]/g, '-')}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);

  if (tokenLoadFailures > 0) {
    setStatus(`Export complete with partial failures. ${tokenLoadFailures} address(es) skipped due to token fetch errors.`, 'warn');
  } else {
    setStatus(`Export complete. ${records.length} token row(s) written.`, 'ok');
  }

  renderResults();
}

function handleSort(sortKey) {
  if (state.sort.key === sortKey) {
    state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    state.sort.key = sortKey;
    state.sort.direction = sortKey === 'address' ? 'asc' : 'desc';
  }
  renderResults();
}

function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      skipEmptyLines: true,
      complete(results) {
        if (results.errors && results.errors.length > 0) {
          reject(new AppError(`CSV parse error: ${results.errors[0].message}`, 'csv_parse_error', 400));
          return;
        }
        resolve(results.data);
      },
      error(err) {
        reject(new AppError(`CSV parse error: ${err.message}`, 'csv_parse_error', 400));
      },
    });
  });
}

async function ingestCsvFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.csv')) {
    setStatus('File must be a .csv file.', 'error');
    return;
  }

  try {
    const matrix = await parseCsvFile(file);
    const extracted = Core.extractCsvEntries(matrix);
    state.csvCandidates = extracted.addresses;
    state.csvLabelsByAddress = extracted.labelsByAddress;
    state.csvMeta = `${file.name}: ${state.csvCandidates.length} address candidate(s)`;
    ui.csvMeta.textContent = state.csvMeta;
    updateAddressState();
    setStatus('CSV parsed successfully.', 'ok');
  } catch (error) {
    setStatus(error.message || 'CSV parsing failed.', 'error');
  }
}

function bindEvents() {
  ui.providerSelect.addEventListener('change', async () => {
    const previousProviderId = state.providerId;
    state.providerInputs[previousProviderId] = state.apiKey;
    state.providerId = ui.providerSelect.value;
    const nextProvider = PROVIDERS[state.providerId];
    state.apiKey = state.providerInputs[state.providerId] ?? nextProvider.defaultInputValue ?? '';
    updateProviderUI();
    await loadChainOptions();
    setStatus(`Provider switched to ${PROVIDERS[state.providerId].name}.`, 'ok');
  });

  ui.apiKeyInput.addEventListener('input', () => {
    state.apiKey = ui.apiKeyInput.value;
    state.providerInputs[state.providerId] = state.apiKey;
  });

  ui.manualInput.addEventListener('input', () => {
    state.manualCandidates = Core.parseManualAddressInput(ui.manualInput.value);
    updateAddressState();
  });

  ui.chainFilter.addEventListener('change', () => {
    const selected = [...ui.chainFilter.selectedOptions].map((option) => option.value);
    state.selectedChains = new Set(selected);
    setStatus(`${selected.length} chain(s) selected.`, 'ok');
  });

  ui.chainAllButton.addEventListener('click', () => {
    state.selectedChains = new Set(state.activeChainOptions.map((chain) => chain.chainId));
    renderChainFilter();
  });

  ui.chainNoneButton.addEventListener('click', () => {
    state.selectedChains = new Set();
    renderChainFilter();
  });

  ui.dustFilterInput.addEventListener('input', () => {
    const raw = ui.dustFilterInput.value.trim();
    const parsed = Number(raw);
    state.dustThresholdUsd = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    renderResults();
  });

  ui.themeToggle.addEventListener('click', () => {
    const current = state.themeMode;
    if (current === 'auto') {
      applyTheme('light');
    } else if (current === 'light') {
      applyTheme('dark');
    } else {
      applyTheme('auto');
    }
  });

  ui.dropzone.addEventListener('click', () => ui.csvInput.click());

  ui.dropzone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      ui.csvInput.click();
    }
  });

  ui.csvInput.addEventListener('change', async () => {
    const file = ui.csvInput.files?.[0];
    await ingestCsvFile(file);
  });

  ['dragenter', 'dragover'].forEach((type) => {
    ui.dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      ui.dropzone.dataset.active = 'true';
    });
  });

  ['dragleave', 'drop'].forEach((type) => {
    ui.dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      ui.dropzone.dataset.active = 'false';
    });
  });

  ui.dropzone.addEventListener('drop', async (event) => {
    const file = event.dataTransfer?.files?.[0];
    await ingestCsvFile(file);
  });

  ui.scanButton.addEventListener('click', async () => {
    await startScan();
  });

  ui.stopButton.addEventListener('click', () => {
    state.scan.stopRequested = true;
  });

  ui.exportButton.addEventListener('click', async () => {
    await exportCsvFull();
  });

  document.querySelector('thead').addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const sortKey = target.dataset.sort;
    if (!sortKey) return;
    handleSort(sortKey);
  });

  ui.resultsBody.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.dataset.action;
    const address = target.dataset.address;
    if (!action || !address) return;

    if (action === 'retry') {
      await retryAddress(address);
    }

    if (action === 'toggle') {
      await toggleDetails(address);
    }
  });
}

async function initProviders() {
  const available = getAvailableProviders();
  ui.providerSelect.innerHTML = available
    .map((provider) => `<option value="${provider.id}">${provider.name} · ${provider.tier} · ~${provider.supportedChainCount} chains</option>`)
    .join('');

  state.providerId = available[0]?.id || 'ankr';
  state.apiKey = state.providerInputs[state.providerId] ?? PROVIDERS[state.providerId]?.defaultInputValue ?? '';
  state.providerInputs[state.providerId] = state.apiKey;
  ui.providerSelect.value = state.providerId;
  updateProviderUI();
  await loadChainOptions();
}

async function boot() {
  applyTheme('auto');
  ui.appVersion.textContent = `Version v${APP_VERSION}`;
  await initProviders();
  bindEvents();
  updateAddressState();
  renderProgress();
  renderResults();
  setStatus('Ready.', 'ok');
  logEvent('info', 'app.boot', { releasePhase: RELEASE_PHASE });
}

export async function initApp() {
  await boot();
}
