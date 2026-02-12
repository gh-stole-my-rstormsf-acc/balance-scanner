import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../src/core.js';

test('normalizeTrueBlocksChains parses chain config payload and deduplicates', () => {
  const chains = core.normalizeTrueBlocksChains({
    data: [
      {
        chains: [
          { chain: 'mainnet', chainId: 1, symbol: 'ETH' },
          { chain: 'base', chainId: 8453, symbol: 'ETH' },
        ],
      },
      { chain: 'base', chainId: 8453, symbol: 'ETH' },
      { chain: 'polygon', chainId: 137, symbol: 'POL' },
    ],
  });

  assert.equal(chains.length, 3);
  assert.deepEqual(chains.map((chain) => chain.chainId), ['mainnet', 'base', 'polygon']);
  assert.equal(chains[0].chainName, 'Ethereum');
  assert.equal(chains[2].nativeSymbol, 'POL');
});

test('normalizeTrueBlocksChains falls back to ethereum mainnet on malformed payload', () => {
  const chains = core.normalizeTrueBlocksChains({ data: [{ foo: 'bar' }] });

  assert.equal(chains.length, 1);
  assert.equal(chains[0].chainId, 'mainnet');
  assert.equal(chains[0].chainName, 'Ethereum');
});

test('normalizeTrueBlocksStateBalance prefers ether field when available', () => {
  const balance = core.normalizeTrueBlocksStateBalance({
    data: [
      {
        address: '0x1111111111111111111111111111111111111111',
        balance: '1000000000000000000',
        ether: '1.0',
      },
    ],
  });

  assert.equal(balance.amountRaw, '1000000000000000000');
  assert.equal(balance.amountDecimal, '1.0');
  assert.equal(balance.amountNumber, 1);
});

test('normalizeTrueBlocksStateBalance derives decimal amount from raw balance when ether is missing', () => {
  const balance = core.normalizeTrueBlocksStateBalance({
    data: [
      {
        address: '0x1111111111111111111111111111111111111111',
        balance: '250000000000000000',
      },
    ],
  });

  assert.equal(balance.amountRaw, '250000000000000000');
  assert.equal(balance.amountDecimal, '0.25');
  assert.equal(balance.amountNumber, 0.25);
});

test('coinGeckoIdForNativeAsset maps native symbols/chains', () => {
  assert.equal(core.coinGeckoIdForNativeAsset('mainnet', 'ETH'), 'ethereum');
  assert.equal(core.coinGeckoIdForNativeAsset('base', 'ETH'), 'ethereum');
  assert.equal(core.coinGeckoIdForNativeAsset('bsc', 'BNB'), 'binancecoin');
  assert.equal(core.coinGeckoIdForNativeAsset('polygon', 'POL'), 'matic-network');
  assert.equal(core.coinGeckoIdForNativeAsset('unknown', 'UNKNOWN'), null);
});

test('fetchCoinGeckoSimplePrices fetches deduped ids and returns partial data', async () => {
  const calls = [];
  const result = await core.fetchCoinGeckoSimplePrices(['ethereum', 'binancecoin', 'ethereum'], {
    fetchImpl: async (url) => {
      calls.push(url);
      return {
        ok: true,
        async json() {
          return {
            ethereum: { usd: 3200.5 },
          };
        },
      };
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(result.pricesById.get('ethereum'), 3200.5);
  assert.equal(result.pricesById.has('binancecoin'), false);
  assert.equal(result.errors.length, 0);
});

test('fetchCoinGeckoSimplePrices tolerates fetch failures', async () => {
  const result = await core.fetchCoinGeckoSimplePrices(['ethereum'], {
    fetchImpl: async () => {
      throw new Error('network down');
    },
  });

  assert.equal(result.pricesById.size, 0);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /network down/i);
});

test('summarizeTrueBlocksAttempts keeps partial success with warnings', () => {
  const summary = core.summarizeTrueBlocksAttempts([
    {
      chainId: 'mainnet',
      chainName: 'Ethereum',
      nativeSymbol: 'ETH',
      amountRaw: '1000000000000000000',
      amountDecimal: '1',
      amountNumber: 1,
      usdValueNumber: 3300,
      usdValue: '3300.00000000',
      priceUnavailable: false,
      tokenCount: 1,
      success: true,
    },
    {
      chainId: 'base',
      success: false,
      error: 'timeout',
    },
  ]);

  assert.equal(summary.chains.length, 1);
  assert.equal(summary.allFailed, false);
  assert.equal(summary.warnings.length, 1);
  assert.match(summary.warnings[0], /base/i);
});

test('summarizeTrueBlocksAttempts marks allFailed when no chain succeeds', () => {
  const summary = core.summarizeTrueBlocksAttempts([
    { chainId: 'mainnet', success: false, error: 'bad response' },
    { chainId: 'base', success: false, error: 'timeout' },
  ]);

  assert.equal(summary.chains.length, 0);
  assert.equal(summary.allFailed, true);
  assert.equal(summary.warnings.length, 2);
});

test('buildExportRecords emits native token rows and preserves CSV schema fields', () => {
  const rows = core.buildExportRecords([
    {
      status: 'success',
      tokenError: null,
      address: '0x1111111111111111111111111111111111111111',
      tokens: [
        {
          chainId: 'mainnet',
          chainName: 'Ethereum',
          tokenAddress: 'native',
          tokenSymbol: 'ETH',
          tokenName: 'Ether',
          tokenDecimals: 18,
          amountRaw: '1000000000000000000',
          amountDecimal: '1',
          usdValue: '3000.00000000',
        },
      ],
    },
    {
      status: 'success',
      tokenError: 'failed',
      address: '0x2222222222222222222222222222222222222222',
      tokens: [
        {
          chainId: 'mainnet',
          chainName: 'Ethereum',
          tokenAddress: 'native',
          tokenSymbol: 'ETH',
          tokenName: 'Ether',
          tokenDecimals: 18,
          amountRaw: '2000000000000000000',
          amountDecimal: '2',
          usdValue: '6000.00000000',
        },
      ],
    },
  ], {
    timestamp: '2026-02-12T00:00:00.000Z',
    providerId: 'trueblocks',
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].provider_id, 'trueblocks');
  assert.equal(rows[0].token_address, 'native');
  assert.equal(rows[0].token_symbol, 'ETH');
});
