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
  estimateBudget,
  formatUsd,
  sortRows,
  toCsv,
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
  estimateBudget,
  formatUsd,
  sortRows,
  toCsv,
  filterTokensByDust,
  computeDashboard,
  sanitizeText,
  BalanceScannerCore,
};
