// dataset.js — composition of the researcher pool.
// The seed file (server/data/researchers.json) is the paper's fixed seed pool
// and is never mutated. User changes live in data/custom-researchers.json:
//   { added: [researcher...], removed: [id...] }
// Deleting a seed researcher tombstones it in `removed`; deleting an added one
// removes it from `added`. Field edits (data/profile-overrides.json) are applied
// last, over both seed and added researchers.

import fs from 'node:fs';

export const METHOD_FAMILIES = [
  'qualitative',
  'quantitative',
  'computational',
  'design',
  'experimental',
  'conceptual',
  'mixed',
  'field-science',
];

export function slugify(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function createResearcher(input, existingIds) {
  const str = (v) => String(v ?? '').trim();
  const lines = (v) =>
    Array.isArray(v) ? v.map((s) => String(s).trim()).filter(Boolean) : [];

  const name = str(input.name);
  const field = str(input.field);
  if (!name) throw httpError(400, 'Name is required');
  if (!field) throw httpError(400, 'Field is required');
  if (lines(input.interests).length === 0) throw httpError(400, 'At least one interest is required');

  const base = slugify(name) || 'researcher';
  let id = base;
  for (let i = 2; existingIds.has(id); i++) id = `${base}-${i}`;

  return {
    id,
    name,
    synthetic: input.synthetic !== false, // default: synthetic, unless explicitly a real person
    // a synthetic persona is "verified" by construction; a real person's
    // representation stays unverified until they review it themselves (Step 2)
    verified: input.synthetic !== false,
    addedAt: new Date().toISOString(),
    title: str(input.title),
    institution: str(input.institution),
    unit: str(input.unit),
    country: str(input.country),
    seniority: Math.min(4, Math.max(1, Number(input.seniority) || 2)),
    field,
    methods: lines(input.methods),
    // sorted so that re-saving an unchanged profile never looks like an edit
    methodFamilies: lines(input.methodFamilies).filter((f) => METHOD_FAMILIES.includes(f)).sort(),
    interests: lines(input.interests),
    collaborationStyle: str(input.collaborationStyle),
    reflections: lines(input.reflections),
    orcid: str(input.orcid),
    // when the profile was AI-drafted from the web, keep the evidence trail
    provenance:
      input.provenance && typeof input.provenance === 'object'
        ? {
            draftedBy: str(input.provenance.draftedBy),
            sources: lines(input.provenance.sources),
            notes: str(input.provenance.notes),
            at: str(input.provenance.at) || new Date().toISOString(),
          }
        : null,
  };
}

export function readCustom(file) {
  if (!fs.existsSync(file)) return { added: [], removed: [] };
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { added: raw.added ?? [], removed: raw.removed ?? [] };
}

export function writeCustom(file, custom) {
  fs.writeFileSync(file, JSON.stringify(custom, null, 2));
}

export function composeDataset(seed, custom, overrides = {}) {
  const removed = new Set(custom.removed ?? []);
  const researchers = [
    ...seed.researchers.filter((r) => !removed.has(r.id)),
    ...(custom.added ?? []).filter((r) => !removed.has(r.id)),
  ].map((r) => (overrides[r.id] ? { ...r, ...overrides[r.id] } : { ...r }));

  const ids = new Set(researchers.map((r) => r.id));
  const collaborations = seed.collaborations.filter(
    (c) => ids.has(c.source) && ids.has(c.target),
  );
  return { researchers, collaborations };
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}
