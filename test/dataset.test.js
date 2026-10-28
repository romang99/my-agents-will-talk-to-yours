import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  slugify,
  createResearcher,
  composeDataset,
  readCustom,
  writeCustom,
} from '../server/dataset.js';
import { organisationalFoci } from '../server/baseline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'server', 'data', 'researchers.json'), 'utf8'),
);

const minimal = { name: 'Petra Novak', field: 'Urban planning', interests: ['smart cities'] };

test('slugify produces stable kebab ids', () => {
  assert.equal(slugify('Petra Novák'), 'petra-novak');
  assert.equal(slugify('  José  Ángel P. '), 'jose-angel-p');
});

test('createResearcher: defaults, validation, unique ids', () => {
  const r = createResearcher(minimal, new Set());
  assert.equal(r.id, 'petra-novak');
  assert.equal(r.synthetic, true, 'synthetic by default');
  assert.equal(r.verified, true, 'synthetic personas are verified by construction');
  assert.equal(r.seniority, 2);
  const r2 = createResearcher(minimal, new Set(['petra-novak']));
  assert.equal(r2.id, 'petra-novak-2');
  assert.throws(() => createResearcher({ field: 'x', interests: ['y'] }, new Set()), /Name/);
  assert.throws(() => createResearcher({ name: 'x', interests: ['y'] }, new Set()), /Field/);
  assert.throws(() => createResearcher({ name: 'x', field: 'y' }, new Set()), /interest/);
  const real = createResearcher({ ...minimal, synthetic: false, methodFamilies: ['qualitative', 'bogus'] }, new Set());
  assert.equal(real.synthetic, false);
  assert.equal(real.verified, false, 'a real person is unverified until they review their representation');
  assert.deepEqual(real.methodFamilies, ['qualitative'], 'unknown families filtered');
});

test('composeDataset: additions appear, tombstones remove seed researchers and their ties', () => {
  const added = createResearcher(minimal, new Set(seed.researchers.map((r) => r.id)));
  const custom = { added: [added], removed: ['synthetic-callum-reid'] };
  const { researchers, collaborations } = composeDataset(seed, custom);
  const ids = researchers.map((r) => r.id);
  assert.ok(ids.includes('petra-novak'));
  assert.ok(!ids.includes('synthetic-callum-reid'));
  assert.equal(researchers.length, seed.researchers.length); // -1 removed, +1 added
  assert.ok(
    !collaborations.some((c) => c.source === 'synthetic-callum-reid' || c.target === 'synthetic-callum-reid'),
    'edges of a removed researcher are dropped',
  );
});

test('composeDataset applies overrides over seed and added researchers', () => {
  const added = createResearcher(minimal, new Set());
  const { researchers } = composeDataset(seed, { added: [added], removed: [] }, {
    'petra-novak': { interests: ['edited'] },
    'synthetic-mira-chen': { verified: false },
  });
  assert.deepEqual(researchers.find((r) => r.id === 'petra-novak').interests, ['edited']);
  assert.equal(researchers.find((r) => r.id === 'synthetic-mira-chen').verified, false);
});

test('readCustom/writeCustom roundtrip; missing file is empty', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-custom-'));
  const file = path.join(dir, 'custom-researchers.json');
  assert.deepEqual(readCustom(file), { added: [], removed: [] });
  writeCustom(file, { added: [createResearcher(minimal, new Set())], removed: ['x'] });
  const back = readCustom(file);
  assert.equal(back.added[0].id, 'petra-novak');
  assert.deepEqual(back.removed, ['x']);
});

test('organisationalFoci: empty institution/unit never counts as shared', () => {
  const a = createResearcher(minimal, new Set());
  const b = createResearcher({ ...minimal, name: 'Other Person' }, new Set());
  assert.equal(organisationalFoci(a, b), 0, 'two blank institutions are not a shared focus');
  const c = { ...a, institution: 'QUT', unit: '' };
  const d = { ...b, institution: 'QUT', unit: '' };
  assert.equal(organisationalFoci(c, d), 0.6, 'blank units do not upgrade to same-unit');
});
