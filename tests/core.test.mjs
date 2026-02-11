import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../src/core.js';

test('normalizeAddresses validates and deduplicates', () => {
  const input = [
    '0x1111111111111111111111111111111111111111',
    '0x1111111111111111111111111111111111111111',
    'not-an-address',
    '0x2222222222222222222222222222222222222222',
    '  0x2222222222222222222222222222222222222222  ',
  ];

  const result = core.normalizeAddresses(input);
  assert.equal(result.valid.length, 2);
  assert.equal(result.invalid.length, 1);
});

test('parseManualAddressInput supports mixed delimiters', () => {
  const parsed = core.parseManualAddressInput(
    '0x1111111111111111111111111111111111111111,\n0x2222222222222222222222222222222222222222 0x3333333333333333333333333333333333333333'
  );
  assert.equal(parsed.length, 3);
});

test('extractCsvEntries parses address + optional label columns', () => {
  const parsed = core.extractCsvEntries([
    ['address', 'label'],
    ['0x1111111111111111111111111111111111111111', 'Treasury'],
    ['0x2222222222222222222222222222222222222222', 'Hot Wallet'],
  ]);

  assert.equal(parsed.addresses.length, 2);
  assert.equal(parsed.labelsByAddress['0x1111111111111111111111111111111111111111'], 'Treasury');
  assert.equal(parsed.labelsByAddress['0x2222222222222222222222222222222222222222'], 'Hot Wallet');
});

test('estimateBudget marks likely_exceeds when above limit', () => {
  const estimate = core.estimateBudget(
    {
      freeTier: {
        callsPerAddressEstimate: 4,
        limitKind: 'daily',
        limitValue: 100,
      },
      defaultConcurrency: 5,
    },
    30
  );

  assert.equal(estimate.totalCalls, 120);
  assert.equal(estimate.status, 'likely_exceeds');
});

test('toCsv escapes commas and quotes', () => {
  const csv = core.toCsv([
    {
      scan_timestamp_utc: '2026-02-11T00:00:00.000Z',
      provider_id: 'ankr',
      address: '0x1111111111111111111111111111111111111111',
      chain_id: 'eth',
      chain_name: 'Ethereum, Mainnet',
      token_address: 'native',
      token_symbol: 'ETH',
      token_name: 'Ether "Wrapped"',
      token_decimals: '18',
      token_amount_raw: '1000000000000000000',
      token_amount_decimal: '1',
      token_usd_value: '3500.12',
    },
  ]);

  assert.match(csv, /"Ethereum, Mainnet"/);
  assert.match(csv, /"Ether ""Wrapped"""/);
});

test('filterTokensByDust hides values under threshold', () => {
  const tokens = [
    { tokenSymbol: 'A', usdValueNumber: 0.2 },
    { tokenSymbol: 'B', usdValueNumber: 1.3 },
    { tokenSymbol: 'C', usdValueNumber: 5.0 },
  ];

  const filtered = core.filterTokensByDust(tokens, 1);
  assert.equal(filtered.length, 2);
  assert.equal(filtered[0].tokenSymbol, 'B');
  assert.equal(filtered[1].tokenSymbol, 'C');
});

test('computeDashboard summarizes totals and rankings', () => {
  const rows = [
    {
      status: 'success',
      summary: {
        totalUsdValueNumber: 120,
        chains: [
          { chainName: 'Ethereum', usdValueNumber: 80 },
          { chainName: 'Base', usdValueNumber: 40 },
        ],
      },
      tokens: [
        { tokenSymbol: 'ETH', tokenName: 'Ether', usdValueNumber: 90 },
        { tokenSymbol: 'USDC', tokenName: 'USD Coin', usdValueNumber: 30 },
      ],
      tokensLoaded: true,
    },
    {
      status: 'success',
      summary: {
        totalUsdValueNumber: 80,
        chains: [
          { chainName: 'Arbitrum', usdValueNumber: 80 },
        ],
      },
      tokens: [
        { tokenSymbol: 'ARB', tokenName: 'Arbitrum', usdValueNumber: 80 },
      ],
      tokensLoaded: true,
    },
  ];

  const dashboard = core.computeDashboard(rows, 1);
  assert.equal(dashboard.totalUsd, 200);
  assert.equal(dashboard.topChains[0].name, 'Ethereum');
  assert.equal(dashboard.topTokens[0].symbol, 'ETH');
});

test('sortRows sorts descending numeric by default', () => {
  const rows = [
    { address: 'a', summary: { totalUsdValueNumber: 10 } },
    { address: 'b', summary: { totalUsdValueNumber: 100 } },
    { address: 'c', summary: { totalUsdValueNumber: 1 } },
  ];

  const sorted = core.sortRows(rows, { key: 'totalUsdValue', direction: 'desc' });
  assert.equal(sorted.map((r) => r.address).join(','), 'b,a,c');
});

test('runSequentialWithDelay spaces jobs between items', async () => {
  const seen = [];
  const sleepCalls = [];

  await core.runSequentialWithDelay(['a', 'b', 'c'], async (item) => {
    seen.push(item);
  }, {
    delayMs: 1_000,
    sleepStepMs: 1_000,
    sleep: async (ms) => {
      sleepCalls.push(ms);
    },
  });

  assert.deepEqual(seen, ['a', 'b', 'c']);
  assert.deepEqual(sleepCalls, [1_000, 1_000]);
});

test('runSequentialWithDelay stops quickly when requested', async () => {
  const seen = [];
  const sleepCalls = [];
  let stop = false;

  await core.runSequentialWithDelay(['a', 'b', 'c'], async (item) => {
    seen.push(item);
  }, {
    delayMs: 1_000,
    sleepStepMs: 200,
    shouldStop: () => stop,
    sleep: async (ms) => {
      sleepCalls.push(ms);
      stop = true;
    },
  });

  assert.deepEqual(seen, ['a']);
  assert.deepEqual(sleepCalls, [200]);
});

test('formatDurationMs renders short durations', () => {
  assert.equal(core.formatDurationMs(0), '0s');
  assert.equal(core.formatDurationMs(999), '1s');
  assert.equal(core.formatDurationMs(9_100), '10s');
});

test('formatDurationMs renders minute and hour durations', () => {
  assert.equal(core.formatDurationMs(65_000), '1m 05s');
  assert.equal(core.formatDurationMs(3_726_000), '1h 02m');
});
