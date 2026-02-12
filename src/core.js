const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const CSV_HEADERS = [
  'scan_timestamp_utc',
  'provider_id',
  'address',
  'chain_id',
  'chain_name',
  'token_address',
  'token_symbol',
  'token_name',
  'token_decimals',
  'token_amount_raw',
  'token_amount_decimal',
  'token_usd_value',
];
const TRUEBLOCKS_FALLBACK_CHAINS = [
  {
    chainId: 'mainnet',
    chainName: 'Ethereum',
    nativeSymbol: 'ETH',
    isTestnet: false,
    enabledByDefault: true,
  },
];
const CHAIN_ID_BY_NUMERIC = {
  1: 'mainnet',
  10: 'optimism',
  56: 'bsc',
  100: 'gnosis',
  137: 'polygon',
  250: 'fantom',
  8453: 'base',
  42161: 'arbitrum',
  43114: 'avalanche',
};
const CHAIN_META_BY_ID = {
  mainnet: { chainName: 'Ethereum', nativeSymbol: 'ETH', coinGeckoId: 'ethereum' },
  eth: { chainName: 'Ethereum', nativeSymbol: 'ETH', coinGeckoId: 'ethereum' },
  ethereum: { chainName: 'Ethereum', nativeSymbol: 'ETH', coinGeckoId: 'ethereum' },
  base: { chainName: 'Base', nativeSymbol: 'ETH', coinGeckoId: 'ethereum' },
  optimism: { chainName: 'Optimism', nativeSymbol: 'ETH', coinGeckoId: 'ethereum' },
  arbitrum: { chainName: 'Arbitrum', nativeSymbol: 'ETH', coinGeckoId: 'ethereum' },
  bsc: { chainName: 'BNB Chain', nativeSymbol: 'BNB', coinGeckoId: 'binancecoin' },
  binance: { chainName: 'BNB Chain', nativeSymbol: 'BNB', coinGeckoId: 'binancecoin' },
  polygon: { chainName: 'Polygon', nativeSymbol: 'POL', coinGeckoId: 'matic-network' },
  matic: { chainName: 'Polygon', nativeSymbol: 'POL', coinGeckoId: 'matic-network' },
  avalanche: { chainName: 'Avalanche', nativeSymbol: 'AVAX', coinGeckoId: 'avalanche-2' },
  avax: { chainName: 'Avalanche', nativeSymbol: 'AVAX', coinGeckoId: 'avalanche-2' },
  fantom: { chainName: 'Fantom', nativeSymbol: 'FTM', coinGeckoId: 'fantom' },
  gnosis: { chainName: 'Gnosis', nativeSymbol: 'XDAI', coinGeckoId: 'xdai' },
  xdai: { chainName: 'Gnosis', nativeSymbol: 'XDAI', coinGeckoId: 'xdai' },
};
const COINGECKO_BY_SYMBOL = {
  ETH: 'ethereum',
  WETH: 'ethereum',
  BNB: 'binancecoin',
  MATIC: 'matic-network',
  POL: 'matic-network',
  AVAX: 'avalanche-2',
  FTM: 'fantom',
  XDAI: 'xdai',
};

function parseManualAddressInput(raw) {
  if (!raw) return [];
  return raw
    .split(/[\s,;]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractCsvEntries(matrix) {
  if (!Array.isArray(matrix) || matrix.length === 0) {
    return { addresses: [], labelsByAddress: {} };
  }
  const firstRow = Array.isArray(matrix[0]) ? matrix[0] : [];
  let addressCol = 0;
  let labelCol = 1;
  let start = 0;

  const addressHeaderIndex = firstRow.findIndex((cell) =>
    String(cell || '').trim().toLowerCase() === 'address'
  );

  if (addressHeaderIndex >= 0) {
    addressCol = addressHeaderIndex;
    start = 1;
    const normalizedHeaders = firstRow.map((cell) => String(cell || '').trim().toLowerCase());
    const explicitLabelIndex = normalizedHeaders.findIndex((header) =>
      header === 'label' || header === 'name' || header === 'alias'
    );
    if (explicitLabelIndex >= 0) {
      labelCol = explicitLabelIndex;
    } else {
      const fallbackIndex = normalizedHeaders.findIndex((_header, idx) => idx !== addressCol);
      if (fallbackIndex >= 0) labelCol = fallbackIndex;
    }
  } else if (firstRow.length < 2) {
    labelCol = -1;
  }

  const addresses = [];
  const labelsByAddress = {};
  for (let i = start; i < matrix.length; i += 1) {
    const row = matrix[i];
    if (!Array.isArray(row)) continue;
    const address = String(row[addressCol] || '').trim();
    if (!address) continue;
    addresses.push(address);
    if (labelCol >= 0) {
      const label = String(row[labelCol] || '').trim();
      if (label) {
        labelsByAddress[address.toLowerCase()] = label;
      }
    }
  }

  return { addresses, labelsByAddress };
}

function extractCsvAddresses(matrix) {
  return extractCsvEntries(matrix).addresses;
}

function normalizeAddresses(candidates) {
  const valid = [];
  const invalid = [];
  const seen = new Set();

  for (const candidate of candidates || []) {
    const raw = String(candidate || '').trim();
    if (!raw) continue;
    if (!ADDRESS_REGEX.test(raw)) {
      invalid.push(raw);
      continue;
    }
    const lowered = raw.toLowerCase();
    if (seen.has(lowered)) continue;
    seen.add(lowered);
    valid.push(raw);
  }

  return {
    valid,
    invalid,
    inputCount: (candidates || []).map((v) => String(v || '').trim()).filter(Boolean).length,
  };
}

function safeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function toRawFromDecimal(decimalValue, decimals) {
  const text = String(decimalValue ?? '0').trim();
  if (!text || Number.isNaN(Number(text))) return '0';
  const [wholeRaw, fractionRaw = ''] = text.split('.');
  const whole = wholeRaw.replace(/\D/g, '') || '0';
  const fraction = fractionRaw.replace(/\D/g, '').slice(0, decimals).padEnd(decimals, '0');
  const merged = `${whole}${fraction}`.replace(/^0+(?=\d)/, '');
  return merged || '0';
}

function toDecimalFromRaw(raw, decimals) {
  const digits = String(raw || '0').replace(/\D/g, '') || '0';
  if (decimals <= 0) return digits;
  const padded = digits.padStart(decimals + 1, '0');
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

function normalizeTrueBlocksChainId(rawChainId, rawNumericId) {
  const explicit = String(rawChainId || '').trim().toLowerCase();
  if (explicit) return explicit;
  const asNumber = Number(rawNumericId);
  if (Number.isFinite(asNumber) && CHAIN_ID_BY_NUMERIC[asNumber]) {
    return CHAIN_ID_BY_NUMERIC[asNumber];
  }
  return '';
}

function cloneTrueBlocksFallbackChains() {
  return TRUEBLOCKS_FALLBACK_CHAINS.map((chain) => ({ ...chain }));
}

function isLikelyTestnet(chainId) {
  return /(test|goerli|sepolia|holesky|mumbai|amoy|dev)/i.test(String(chainId || ''));
}

function normalizeTrueBlocksChains(payload) {
  const candidates = [];
  const collect = (item) => {
    if (!item || typeof item !== 'object') return;
    if (Array.isArray(item.chains)) {
      candidates.push(...item.chains);
    }
    if (item.chain !== undefined || item.chainId !== undefined || item.symbol !== undefined) {
      candidates.push(item);
    }
  };

  if (Array.isArray(payload?.data)) payload.data.forEach(collect);
  if (Array.isArray(payload)) payload.forEach(collect);
  collect(payload);

  const seen = new Set();
  const normalized = [];
  for (const candidate of candidates) {
    const chainId = normalizeTrueBlocksChainId(
      candidate.chain ?? candidate.chainName ?? candidate.name,
      candidate.chainId
    );
    if (!chainId || seen.has(chainId)) continue;
    seen.add(chainId);

    const chainMeta = CHAIN_META_BY_ID[chainId] || null;
    const chainName = String(candidate.chainName || candidate.name || chainMeta?.chainName || chainId);
    const nativeSymbol = String(candidate.symbol || chainMeta?.nativeSymbol || '').toUpperCase() || 'ETH';
    const testnet = isLikelyTestnet(chainId);

    normalized.push({
      chainId,
      chainName,
      nativeSymbol,
      isTestnet: testnet,
      enabledByDefault: !testnet,
    });
  }

  if (normalized.length === 0) {
    return cloneTrueBlocksFallbackChains();
  }
  return normalized;
}

function normalizeTrueBlocksStateBalance(payload) {
  const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
  const row = rows.find((item) =>
    item && typeof item === 'object' && (item.balance !== undefined || item.ether !== undefined)
  );
  if (!row) return null;

  const amountRaw = row.balance !== undefined && row.balance !== null
    ? String(row.balance)
    : '0';

  let amountDecimal = row.ether !== undefined && row.ether !== null
    ? String(row.ether)
    : '';

  if (!amountDecimal || Number.isNaN(Number(amountDecimal))) {
    amountDecimal = toDecimalFromRaw(amountRaw, 18);
  }

  return {
    amountRaw,
    amountDecimal,
    amountNumber: safeNumber(amountDecimal),
  };
}

function coinGeckoIdForNativeAsset(chainId, nativeSymbol) {
  const chainKey = String(chainId || '').trim().toLowerCase();
  if (CHAIN_META_BY_ID[chainKey]?.coinGeckoId) {
    return CHAIN_META_BY_ID[chainKey].coinGeckoId;
  }
  const symbolKey = String(nativeSymbol || '').trim().toUpperCase();
  if (COINGECKO_BY_SYMBOL[symbolKey]) {
    return COINGECKO_BY_SYMBOL[symbolKey];
  }
  return null;
}

async function fetchCoinGeckoSimplePrices(ids, options = {}) {
  const uniqueIds = [...new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean))];
  const pricesById = new Map();
  const errors = [];
  if (uniqueIds.length === 0) {
    return { pricesById, errors };
  }

  const fetchImpl = typeof options.fetchImpl === 'function'
    ? options.fetchImpl
    : fetch;
  const batchSize = Math.max(1, Math.floor(safeNumber(options.batchSize || 30)));

  for (let i = 0; i < uniqueIds.length; i += batchSize) {
    const batch = uniqueIds.slice(i, i + batchSize);
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(batch.join(','))}&vs_currencies=usd`;

    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
      });

      if (!response?.ok) {
        const status = response?.status ?? 'unknown';
        let body = '';
        try {
          body = typeof response?.text === 'function' ? await response.text() : '';
        } catch (_error) {
          body = '';
        }
        errors.push(`CoinGecko request failed (${status})${body ? `: ${body.slice(0, 120)}` : ''}`);
        continue;
      }

      const json = await response.json();
      for (const id of batch) {
        const usd = Number(json?.[id]?.usd);
        if (Number.isFinite(usd)) {
          pricesById.set(id, usd);
        }
      }
    } catch (error) {
      errors.push(`CoinGecko request failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  return { pricesById, errors };
}

function summarizeTrueBlocksAttempts(attempts) {
  const chains = [];
  const warnings = [];
  for (const attempt of attempts || []) {
    if (attempt?.success) {
      chains.push({
        chainId: String(attempt.chainId || ''),
        chainName: String(attempt.chainName || attempt.chainId || 'Unknown'),
        nativeSymbol: String(attempt.nativeSymbol || 'ETH'),
        amountRaw: String(attempt.amountRaw || '0'),
        amountDecimal: String(attempt.amountDecimal || '0'),
        amountNumber: safeNumber(attempt.amountNumber),
        usdValueNumber: attempt.priceUnavailable ? 0 : safeNumber(attempt.usdValueNumber),
        usdValue: String(attempt.usdValue || '0'),
        priceUnavailable: Boolean(attempt.priceUnavailable),
        tokenCount: safeNumber(attempt.tokenCount || 1),
      });
      continue;
    }
    if (attempt?.chainId || attempt?.error) {
      warnings.push(`${String(attempt.chainId || 'unknown')}: ${String(attempt.error || 'unknown error')}`);
    }
  }

  chains.sort((a, b) => b.usdValueNumber - a.usdValueNumber);
  return {
    chains,
    warnings,
    allFailed: chains.length === 0,
  };
}

function buildExportRecords(entries, options = {}) {
  const timestamp = String(options.timestamp || new Date().toISOString());
  const providerId = String(options.providerId || '');
  const records = [];
  for (const entry of entries || []) {
    if (entry?.status !== 'success') continue;
    if (entry?.tokenError) continue;
    const tokens = Array.isArray(entry?.tokens) ? entry.tokens : [];
    for (const token of tokens) {
      records.push({
        scan_timestamp_utc: timestamp,
        provider_id: providerId,
        address: String(entry.address || ''),
        chain_id: String(token.chainId || ''),
        chain_name: String(token.chainName || ''),
        token_address: String(token.tokenAddress || ''),
        token_symbol: String(token.tokenSymbol || ''),
        token_name: String(token.tokenName || ''),
        token_decimals: String(token.tokenDecimals ?? ''),
        token_amount_raw: String(token.amountRaw || '0'),
        token_amount_decimal: String(token.amountDecimal || '0'),
        token_usd_value: String(token.usdValue || ''),
      });
    }
  }
  return records;
}

function formatDurationMs(value) {
  const totalMs = Math.max(0, Math.round(safeNumber(value)));
  const totalSeconds = Math.ceil(totalMs / 1000);
  if (totalSeconds <= 0) return '0s';

  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes < 60) {
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${String(remainingMinutes).padStart(2, '0')}m`;
}

function defaultSleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function runSequentialWithDelay(items, worker, options = {}) {
  const list = [...(items || [])];
  const delayMs = Math.max(0, Math.floor(safeNumber(options.delayMs)));
  const sleepStepMs = Math.max(1, Math.floor(safeNumber(options.sleepStepMs || 250)));
  const sleep = typeof options.sleep === 'function' ? options.sleep : defaultSleep;
  const shouldStop = typeof options.shouldStop === 'function' ? options.shouldStop : () => false;

  for (let index = 0; index < list.length; index += 1) {
    if (shouldStop()) return;
    await worker(list[index], index);

    const hasNext = index < list.length - 1;
    if (!hasNext || delayMs <= 0 || shouldStop()) continue;

    let remaining = delayMs;
    while (remaining > 0) {
      if (shouldStop()) return;
      const chunk = Math.min(sleepStepMs, remaining);
      await sleep(chunk);
      remaining -= chunk;
    }
  }
}

function estimateBudget(provider, addressCount) {
  const callsPerAddress = safeNumber(provider?.freeTier?.callsPerAddressEstimate || 0);
  const totalCalls = Math.max(0, Math.round(addressCount * callsPerAddress));
  const concurrency = Math.max(1, safeNumber(provider?.defaultConcurrency || 1));
  const rateLimitPerSec = Math.max(1, safeNumber(provider?.freeTier?.rateLimitPerSec || concurrency));
  const estimatedSeconds = Number((totalCalls / Math.min(rateLimitPerSec, concurrency)).toFixed(1));
  const limitValue = provider?.freeTier?.limitValue;

  let usagePercent = null;
  if (typeof limitValue === 'number' && limitValue > 0) {
    usagePercent = Number(((totalCalls / limitValue) * 100).toFixed(2));
  }

  let status = 'within_estimate';
  if (usagePercent !== null && usagePercent >= 100) {
    status = 'likely_exceeds';
  } else if (usagePercent !== null && usagePercent >= 75) {
    status = 'near_limit';
  }

  let warning = null;
  if (status === 'likely_exceeds') {
    warning = 'Estimate likely exceeds available free/freemium quota.';
  } else if (status === 'near_limit') {
    warning = 'Estimate is near free/freemium quota.';
  }

  return {
    totalCalls,
    estimatedSeconds,
    usagePercent,
    status,
    assumesUnknownPriorUsage: true,
    warning,
  };
}

function formatUsd(value) {
  const number = safeNumber(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(number);
}

function sortRows(rows, sort) {
  const list = [...(rows || [])];
  const key = sort?.key || 'totalUsdValue';
  const direction = sort?.direction === 'asc' ? 1 : -1;

  const read = (row) => {
    switch (key) {
      case 'address':
        return row?.address || '';
      case 'chainCount':
        return safeNumber(row?.summary?.chainCount);
      case 'tokenCount':
        return safeNumber(row?.summary?.tokenCount);
      case 'topChain':
        return row?.summary?.topChainName || '';
      case 'totalUsdValue':
      default:
        return safeNumber(row?.summary?.totalUsdValueNumber);
    }
  };

  list.sort((a, b) => {
    const av = read(a);
    const bv = read(b);
    if (typeof av === 'string' || typeof bv === 'string') {
      return String(av).localeCompare(String(bv)) * direction;
    }
    return (av - bv) * direction;
  });

  return list;
}

function csvEscape(value) {
  const raw = String(value ?? '');
  if (!/[",\n]/.test(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
}

function toCsv(records) {
  const lines = [CSV_HEADERS.join(',')];
  for (const record of records || []) {
    const row = CSV_HEADERS.map((header) => csvEscape(record[header] ?? ''));
    lines.push(row.join(','));
  }
  return lines.join('\n');
}

function filterTokensByDust(tokens, thresholdUsd) {
  const threshold = Math.max(0, safeNumber(thresholdUsd));
  return [...(tokens || [])].filter((token) => safeNumber(token?.usdValueNumber) >= threshold);
}

function computeDashboard(rows, dustThreshold) {
  const successRows = [...(rows || [])].filter((row) => row?.status === 'success');
  const totalUsd = successRows.reduce((sum, row) => sum + safeNumber(row?.summary?.totalUsdValueNumber), 0);

  const chainMap = new Map();
  const tokenMap = new Map();
  let loadedCount = 0;

  for (const row of successRows) {
    const chains = Array.isArray(row?.summary?.chains) ? row.summary.chains : [];
    for (const chain of chains) {
      const name = String(chain?.chainName || 'Unknown');
      const prev = chainMap.get(name) || 0;
      chainMap.set(name, prev + safeNumber(chain?.usdValueNumber));
    }

    if (row?.tokensLoaded && Array.isArray(row?.tokens)) {
      loadedCount += 1;
      const dustFiltered = filterTokensByDust(row.tokens, dustThreshold);
      for (const token of dustFiltered) {
        const key = String(token?.tokenSymbol || 'UNKNOWN');
        const prev = tokenMap.get(key) || {
          symbol: key,
          name: String(token?.tokenName || key),
          usdValueNumber: 0,
        };
        prev.usdValueNumber += safeNumber(token?.usdValueNumber);
        tokenMap.set(key, prev);
      }
    }
  }

  const topChains = [...chainMap.entries()]
    .map(([name, usdValueNumber]) => ({ name, usdValueNumber }))
    .sort((a, b) => b.usdValueNumber - a.usdValueNumber)
    .slice(0, 5);

  const topTokens = [...tokenMap.values()]
    .sort((a, b) => b.usdValueNumber - a.usdValueNumber)
    .slice(0, 5);

  return {
    totalUsd,
    scannedAddressCount: successRows.length,
    tokenCoverage: {
      loaded: loadedCount,
      total: successRows.length,
    },
    topChains,
    topTokens,
  };
}

function sanitizeText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const BalanceScannerCore = {
  ADDRESS_REGEX,
  parseManualAddressInput,
  extractCsvEntries,
  extractCsvAddresses,
  normalizeAddresses,
  safeNumber,
  toRawFromDecimal,
  toDecimalFromRaw,
  formatDurationMs,
  runSequentialWithDelay,
  estimateBudget,
  formatUsd,
  sortRows,
  toCsv,
  normalizeTrueBlocksChains,
  normalizeTrueBlocksStateBalance,
  coinGeckoIdForNativeAsset,
  fetchCoinGeckoSimplePrices,
  summarizeTrueBlocksAttempts,
  buildExportRecords,
  filterTokensByDust,
  computeDashboard,
  sanitizeText,
};

export {
  ADDRESS_REGEX,
  parseManualAddressInput,
  extractCsvEntries,
  extractCsvAddresses,
  normalizeAddresses,
  safeNumber,
  toRawFromDecimal,
  toDecimalFromRaw,
  formatDurationMs,
  runSequentialWithDelay,
  estimateBudget,
  formatUsd,
  sortRows,
  toCsv,
  normalizeTrueBlocksChains,
  normalizeTrueBlocksStateBalance,
  coinGeckoIdForNativeAsset,
  fetchCoinGeckoSimplePrices,
  summarizeTrueBlocksAttempts,
  buildExportRecords,
  filterTokensByDust,
  computeDashboard,
  sanitizeText,
  BalanceScannerCore,
};
