import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildAdjacency,
  degree,
  hasTie,
  sharedNeighbours,
  organisationalFoci,
  homophily,
  cumulativeAdvantage,
  triadicClosure,
  homophilyDetail,
  pairBaseline,
  classify,
  ecpFromBrief,
  candidatePairs,
  THRESHOLDS,
} from '../server/baseline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataset = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'server', 'data', 'researchers.json'), 'utf8'),
);
const { researchers, collaborations } = dataset;
const byId = Object.fromEntries(researchers.map((r) => [r.id, r]));

test('adjacency reflects the seed edge list', () => {
  const adj = buildAdjacency(researchers, collaborations);
  assert.equal(hasTie(adj, 'synthetic-mira-chen', 'synthetic-jonas-adler'), true);
  assert.equal(hasTie(adj, 'synthetic-mira-chen', 'synthetic-priya-raman'), false);
  assert.equal(degree(adj, 'synthetic-lena-fischer'), 0, 'Lena is the isolate');
});

test('organisational foci: any shared unit > shared institution > none (multi-affiliation aware)', () => {
  const mira = byId['synthetic-mira-chen'];
  const jonas = byId['synthetic-jonas-adler'];
  const callum = byId['synthetic-callum-reid'];
  const priya = byId['synthetic-priya-raman'];
  assert.equal(organisationalFoci(mira, jonas), 1, 'both belong to the fictional Open Learning Centre (Mira via her second affiliation)');
  assert.equal(organisationalFoci(mira, callum), 0.6, 'same institution, no shared unit');
  assert.equal(organisationalFoci(mira, priya), 0, 'different institutions');
});

test('foci matching survives formatting differences and multiple affiliations', () => {
  const scouted = {
    institution: 'Example University (EU)',
    unit: 'Open Learning Centre; Community Systems Lab',
  };
  const seeded = {
    institution: 'Example University',
    unit: 'Community Systems Lab / Open Learning Centre',
  };
  assert.equal(organisationalFoci(scouted, seeded), 1, 'parenthetical stripped, any shared affiliation counts');
  const other = { institution: 'Example University', unit: 'Fictional Arts Lab' };
  assert.equal(organisationalFoci(scouted, other), 0.6, 'institution only');
});

test('homophily blends seniority proximity and method-family overlap', () => {
  const mira = byId['synthetic-mira-chen'];
  const jonas = byId['synthetic-jonas-adler'];
  const lena = byId['synthetic-lena-fischer'];
  const h = homophily(mira, jonas);
  assert.ok(h > 0.5, `same seniority + overlapping methods → high, got ${h}`);
  const hLena = homophily(mira, lena);
  assert.ok(hLena <= 0.5, `no method overlap with Lena, got ${hLena}`);
});

test('triadic closure detects shared collaborators', () => {
  const adj = buildAdjacency(researchers, collaborations);
  // Mira—David share Jonas as a contact
  assert.deepEqual(sharedNeighbours(adj, 'synthetic-mira-chen', 'synthetic-david-okonkwo'), [
    'synthetic-jonas-adler',
  ]);
  assert.ok(triadicClosure(adj, 'synthetic-mira-chen', 'synthetic-david-okonkwo') > 0);
  // Mira—Priya share nobody
  assert.equal(triadicClosure(adj, 'synthetic-mira-chen', 'synthetic-priya-raman'), 0);
});

test('cumulative advantage is zero when one side is isolated', () => {
  const adj = buildAdjacency(researchers, collaborations);
  assert.equal(cumulativeAdvantage(adj, 'synthetic-mira-chen', 'synthetic-lena-fischer'), 0);
});

test('pairBaseline: Mira—Priya is a low-predictability (latent-candidate) pair', () => {
  const base = pairBaseline(researchers, collaborations, 'synthetic-mira-chen', 'synthetic-priya-raman');
  assert.equal(base.existingTie, false);
  assert.ok(base.composite < 0.25, `expected < 0.25, got ${base.composite}`);
});

test('pairBaseline: Mira—David is structurally more predictable than Mira—Priya', () => {
  const david = pairBaseline(researchers, collaborations, 'synthetic-mira-chen', 'synthetic-david-okonkwo');
  const priya = pairBaseline(researchers, collaborations, 'synthetic-mira-chen', 'synthetic-priya-raman');
  assert.ok(david.composite > priya.composite);
});

test('classification thresholds: divergence between predictability and ECP', () => {
  assert.equal(classify(0.1, 0.7), 'latent', 'low predictability + high ECP');
  assert.equal(classify(0.1, 0.3), 'borderline', 'low predictability but the system is lukewarm too');
  assert.equal(classify(0.3, 0.7), 'borderline', 'mid predictability');
  assert.equal(classify(0.6, 0.7), 'predicted', 'structure already explains the pair');
  assert.equal(classify(0.1, 0), 'none', 'agents found no basis');
});

test('ecpFromBrief: code-computed from the synthesis sub-scores', () => {
  assert.equal(ecpFromBrief({ viable: false, relevance: 5, complementarity: 5, feasibility: 5 }), 0, 'non-viable is 0 by definition');
  assert.equal(ecpFromBrief({ viable: true, relevance: 5, complementarity: 5, feasibility: 5 }), 1);
  assert.equal(ecpFromBrief({ viable: true, relevance: 1, complementarity: 1, feasibility: 1 }), 0);
  assert.equal(ecpFromBrief({ viable: true, relevance: 4, complementarity: 4, feasibility: 3 }), 0.667);
  assert.equal(ecpFromBrief({ viable: true, novelty: 4, complementarity: 4, feasibility: 3 }), 0.667, 'novelty accepted as legacy alias');
});

test('classify reads the named THRESHOLDS (study parameters live in one place)', () => {
  const t = THRESHOLDS;
  assert.equal(classify(t.predictedMinPredictability, 1), 'predicted', 'boundary is inclusive');
  assert.equal(classify(t.predictedMinPredictability - 0.001, 1), 'borderline');
  assert.equal(classify(t.latentMaxPredictability - 0.001, t.latentMinEcp), 'latent');
  assert.equal(classify(t.latentMaxPredictability, t.latentMinEcp), 'borderline', 'boundary is exclusive');
  assert.equal(classify(0, t.latentMinEcp - 0.001), 'borderline', 'ECP must clear its own bar');
});

test('explanations quote the same numbers the scores are built from', () => {
  // guards against an explanation drifting from its score when a formula changes
  const base = pairBaseline(researchers, collaborations, 'synthetic-mira-chen', 'synthetic-jonas-adler');
  const homo = homophilyDetail(byId['synthetic-mira-chen'], byId['synthetic-jonas-adler']);
  const row = base.breakdown.find((m) => m.mechanism === 'homophily');
  assert.equal(row.score, homo.score);
  assert.ok(row.inputs.includes(homo.statusSim.toFixed(2)), 'quotes the status similarity actually used');
  assert.ok(row.inputs.includes(homo.valueSim.toFixed(2)), 'quotes the method-family similarity actually used');
});

test('pairBaseline exposes an explainability breakdown that sums to the composite', () => {
  const base = pairBaseline(researchers, collaborations, 'synthetic-mira-chen', 'synthetic-david-okonkwo');
  assert.equal(base.breakdown.length, 4);
  const sum = base.breakdown.reduce((s, m) => s + m.contribution, 0);
  assert.ok(Math.abs(sum - base.composite) < 0.005, `contributions ${sum} ≈ composite ${base.composite}`);
  for (const m of base.breakdown) assert.ok(m.inputs.length > 10, `${m.mechanism} has readable inputs`);
  assert.ok(base.breakdown[3].inputs.includes('Jonas Adler'), 'triadic closure names the shared collaborator');
  assert.ok(base.formula.includes('='));
});

test('candidatePairs excludes existing ties and sorts ascending by predictability', () => {
  const candidates = candidatePairs(researchers, collaborations);
  for (const c of candidates) assert.equal(c.existingTie, false);
  for (let i = 1; i < candidates.length; i++) {
    assert.ok(candidates[i - 1].composite <= candidates[i].composite);
  }
  const n = researchers.length;
  assert.equal(candidates.length, (n * (n - 1)) / 2 - collaborations.length);
});
