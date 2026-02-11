import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(thisDir, '..');

test('project keeps html entry inside src', () => {
  const rootIndex = path.join(repoRoot, 'index.html');
  const srcIndex = path.join(repoRoot, 'src', 'index.html');

  assert.equal(fs.existsSync(srcIndex), true);
  assert.equal(fs.existsSync(rootIndex), false);
});

test('vite config builds from src into dist', async () => {
  const { default: config } = await import('../vite.config.js');

  assert.equal(config.root, 'src');
  assert.equal(config.build.outDir, '../dist');
});
