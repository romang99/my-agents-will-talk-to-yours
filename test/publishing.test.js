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

test('private runtime paths, exports and seed backups are rejected even if force-added', () => {
  const files = safeFiles();
  const privateFiles = [
    'data/profile-overrides.json', 'data/runs/run.json', 'data/archive/run.json',
    'data/new-export.csv', 'data/examples/transcript.txt',
    'data/examples/local-copy/run.json', 'server/data/researchers-backup.json',
    'transcripts/session.txt', 'private/import.json',
  ];
  for (const file of privateFiles) files.set(file, '{}');
  const errors = auditSnapshot(files);
  for (const file of privateFiles) {
    assert.ok(errors.some(error => error.startsWith(`${file}: private runtime`)), file);
  }
});

test('shared data documentation, seed inputs and the empty run directory remain allowed', () => {
  const files = safeFiles();
  for (const file of [
    'data/README.md', 'data/runs/.gitkeep',
    'server/data/triggers-seed.json', 'transcripts/README.md',
  ]) files.set(file, load(file));
  assert.deepEqual(auditSnapshot(files), []);
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
