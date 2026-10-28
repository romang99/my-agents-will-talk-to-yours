import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditSnapshot } from '../tools/check-publishing.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = file => fs.readFileSync(path.join(root, file), 'utf8');
const seedPath = 'server/data/researchers.json';
const safeFiles = () => new Map([['LICENSE', load('LICENSE')], [seedPath, load(seedPath)]]);

test('the published seed and demo examples satisfy the privacy policy', () => {
  const files = safeFiles();
  for (const file of fs.readdirSync(path.join(root, 'data/examples'))) files.set(`data/examples/${file}`, load(`data/examples/${file}`));
  assert.deepEqual(auditSnapshot(files), []);
});

test('a real profile marker is rejected even under a synthetic-looking ID', () => {
  const files = safeFiles();
  const seed = JSON.parse(files.get(seedPath));
  seed.researchers[0].synthetic = false;
  files.set(seedPath, JSON.stringify(seed));
  assert.ok(auditSnapshot(files).some(error => error.includes('real-person marker')));
});

test('relabeling an author as synthetic does not make their profile publishable', () => {
  const files = safeFiles();
  const seed = JSON.parse(files.get(seedPath));
  seed.researchers[0].name = load('LICENSE').match(/Copyright \(c\) \d{4} (.+?) and /)[1];
  files.set(seedPath, JSON.stringify(seed));
  assert.ok(auditSnapshot(files).some(error => error.includes('author identity')));
});

test('live runs and non-synthetic persona snapshots cannot pass as demo examples', () => {
  const files = safeFiles();
  const file = fs.readdirSync(path.join(root, 'data/examples')).find(name => name.endsWith('.json'));
  const run = JSON.parse(load(`data/examples/${file}`));
  run.provider.name = 'live-provider';
  files.set('data/examples/rejected.json', JSON.stringify(run));
  assert.ok(auditSnapshot(files).some(error => error.includes('live run provider')));
  run.provider.name = 'demo';
  run.personas[run.pair[0]].synthetic = false;
  files.set('data/examples/rejected.json', JSON.stringify(run));
  assert.ok(auditSnapshot(files).some(error => error.includes('synthetic persona snapshots')));
});

test('private runtime paths and copied raw transcripts are rejected', () => {
  const files = safeFiles();
  files.set('data/profile-overrides.json', '{}');
  files.set('data/runs/run.json', '{}');
  files.set('transcripts/session.txt', 'test fixture');
  assert.equal(auditSnapshot(files).filter(error => error.includes('private runtime')).length, 3);
});

test('credential files and token-like text are rejected without printing values', () => {
  const files = safeFiles();
  files.set('.env', 'EXAMPLE=value');
  const token = 'sk-ant-' + 'x'.repeat(25);
  files.set('accidental-token.txt', token);
  const errors = auditSnapshot(files);
  assert.equal(errors.filter(error => error.includes('credential')).length, 2);
  assert.ok(errors.every(error => !error.includes(token)));
});
