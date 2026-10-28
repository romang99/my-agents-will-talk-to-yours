import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resetState, listArchives } from '../server/archive.js';

/** A data dir holding two runs, a pool edit, an addition and custom triggers. */
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-archive-'));
  fs.mkdirSync(path.join(dir, 'runs'));
  fs.writeFileSync(path.join(dir, 'runs', 'run-a.json'), '{"id":"run-a"}');
  fs.writeFileSync(path.join(dir, 'runs', 'run-b.json'), '{"id":"run-b"}');
  fs.writeFileSync(path.join(dir, 'profile-overrides.json'), '{"synthetic-mira-chen":{"verified":true}}');
  fs.writeFileSync(path.join(dir, 'custom-researchers.json'), '{"added":[],"removed":["x"]}');
  fs.writeFileSync(path.join(dir, 'triggers.json'), '{"triggers":[]}');
  return dir;
}

test('reset "findings" archives the runs and leaves the pool alone', () => {
  const dir = fixture();
  const res = resetState({ dataDir: dir, scope: 'findings', note: 'condition A done' });

  assert.equal(res.archived, true);
  assert.equal(res.runsArchived, 2);
  assert.equal(fs.readdirSync(path.join(dir, 'runs')).length, 0, 'runs cleared');
  assert.ok(fs.existsSync(path.join(dir, 'profile-overrides.json')), 'pool edits untouched');
  assert.ok(fs.existsSync(path.join(dir, 'triggers.json')), 'triggers untouched');

  // nothing is destroyed — both runs are readable in the archive
  const archived = fs.readdirSync(path.join(res.archiveDir, 'runs')).sort();
  assert.deepEqual(archived, ['run-a.json', 'run-b.json']);
  const manifest = JSON.parse(fs.readFileSync(path.join(res.archiveDir, 'MANIFEST.json'), 'utf8'));
  assert.equal(manifest.scope, 'findings');
  assert.equal(manifest.note, 'condition A done');
});

test('reset "all" also archives pool edits, additions and triggers', () => {
  const dir = fixture();
  const res = resetState({ dataDir: dir, scope: 'all' });

  for (const f of ['profile-overrides.json', 'custom-researchers.json', 'triggers.json']) {
    assert.ok(!fs.existsSync(path.join(dir, f)), `${f} moved out`);
    assert.ok(fs.existsSync(path.join(res.archiveDir, f)), `${f} preserved in the archive`);
  }
  assert.equal(fs.readdirSync(path.join(dir, 'runs')).length, 0);
});

test('two resets in the same millisecond stay separate experiments', () => {
  // The directory name is a timestamp, so back-to-back resets can collide.
  // Freezing the clock makes the collision certain rather than a rare flake.
  const dir = fixture();
  const RealDate = Date;
  globalThis.Date = class extends RealDate {
    constructor() { super('2026-07-27T00:00:00.000Z'); }
  };
  try {
    const first = resetState({ dataDir: dir, scope: 'findings', note: 'A' });
    fs.writeFileSync(path.join(dir, 'runs', 'run-c.json'), '{"id":"run-c"}');
    const second = resetState({ dataDir: dir, scope: 'findings', note: 'B' });

    assert.notEqual(first.archiveDir, second.archiveDir, 'the second reset must not reuse the first folder');
    assert.equal(fs.readdirSync(path.join(first.archiveDir, 'runs')).length, 2, "A's evidence intact");
    assert.equal(fs.readdirSync(path.join(second.archiveDir, 'runs')).length, 1, "B's evidence intact");
    assert.equal(listArchives(dir).length, 2, 'both manifests survive');
  } finally {
    globalThis.Date = RealDate;
  }
});

test('resetting twice keeps both archives, newest first', () => {
  const dir = fixture();
  const first = resetState({ dataDir: dir, scope: 'findings' });
  fs.writeFileSync(path.join(dir, 'runs', 'run-c.json'), '{"id":"run-c"}');
  const second = resetState({ dataDir: dir, scope: 'findings' });

  assert.notEqual(first.archiveDir, second.archiveDir);
  const archives = listArchives(dir);
  assert.equal(archives.length, 2);
  assert.ok(archives[0].archivedAt >= archives[1].archivedAt, 'newest first');
  assert.equal(archives.reduce((n, a) => n + a.runsArchived, 0), 3, 'all three runs preserved');
});

test('resetting an already-clear state archives nothing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-archive-empty-'));
  fs.mkdirSync(path.join(dir, 'runs'));
  const res = resetState({ dataDir: dir, scope: 'findings' });
  assert.equal(res.archived, false);
  assert.equal(res.archiveDir, null);
  assert.deepEqual(listArchives(dir), []);
});

test('an unknown scope is refused rather than guessed', () => {
  const dir = fixture();
  assert.throws(() => resetState({ dataDir: dir, scope: 'everything' }), /Unknown reset scope/);
  assert.equal(fs.readdirSync(path.join(dir, 'runs')).length, 2, 'nothing moved');
});

test('inherited property names are not scopes', () => {
  // A membership test, not `SCOPES[scope]` — otherwise these reach the move loop.
  const dir = fixture();
  for (const scope of ['__proto__', 'toString', 'constructor']) {
    assert.throws(() => resetState({ dataDir: dir, scope }), /Unknown reset scope/, scope);
  }
  assert.equal(fs.readdirSync(path.join(dir, 'runs')).length, 2, 'nothing moved');
});

test('every archive is findable, because the manifest is written before the moves', () => {
  // listArchives hides manifest-less directories, so a crash part-way through
  // must not be able to leave archived runs invisible.
  const dir = fixture();
  const res = resetState({ dataDir: dir, scope: 'all' });
  const manifest = JSON.parse(fs.readFileSync(path.join(res.archiveDir, 'MANIFEST.json'), 'utf8'));
  assert.equal(manifest.complete, true, 'a finished archive is marked complete');

  // Every directory under archive/ carries a manifest, so none can go missing.
  const base = path.join(dir, 'archive');
  for (const d of fs.readdirSync(base)) {
    assert.ok(fs.existsSync(path.join(base, d, 'MANIFEST.json')), `${d} has a manifest`);
  }
  assert.equal(listArchives(dir).length, fs.readdirSync(base).length, 'nothing is hidden');
});
