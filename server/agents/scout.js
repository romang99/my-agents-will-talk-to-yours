// scout.js — AI-drafted researcher profiles from the public web.
// Uses the local Claude CLI with WebSearch/WebFetch enabled to research a named
// researcher and return a draft profile in the app's schema. The draft is NEVER
// saved directly: it pre-fills the Add-researcher form for human review, and the
// sources it cites are stored as provenance on the profile so the verification
// step (Step 2 of the research design) has something to check against.

import { claudeCliCall } from '../llm/claude-cli.js';
import { extractJson } from '../util.js';
import { METHOD_FAMILIES } from '../dataset.js';

const SCOUT_TIMEOUT_MS = 360_000; // web research legitimately takes a few minutes

export function scoutPrompt(name, hints) {
  return [
    `Research the academic researcher "${name}" on the public web.${hints ? ` Disambiguation hints: ${hints}.` : ''}`,
    '',
    'Use web search (and fetch pages where needed) to establish, with evidence:',
    '- current title and affiliation (institution, school/centre, country)',
    '- field and methods',
    '- current research interests (favour the last ~2 years: recent papers, talks, posts, grants)',
    "- what currently occupies them — 2-4 'recent reflections' in their own spirit, each grounded in something you actually found (a recent paper's question, a talk, a public post)",
    '- collaboration style, only if genuinely evidenced (e.g. from how they publish or describe their work)',
    '',
    'Then answer with JSON ONLY (no prose outside the JSON):',
    '{',
    '  "name": string,                 // canonical form of the name',
    '  "title": string, "institution": string,',
    '  "unit": string,                 // school / centre / institute; separate multiple affiliations with "; "',
    '  "country": string,',
    '  "seniority": 1|2|3|4,           // 1 lecturer/early-career, 2 senior lecturer/fellow, 3 associate professor, 4 professor/chair',
    '  "field": string,',
    '  "methods": [string],',
    `  "methodFamilies": [string],     // subset of: ${METHOD_FAMILIES.join(', ')}`,
    '  "interests": [string],          // 4-6, current, specific',
    '  "reflections": [string],        // 2-4, each traceable to a source',
    '  "collaborationStyle": string,   // empty string if not evidenced',
    '  "orcid": string,                // empty string if not found',
    '  "sources": [string],            // the URLs you actually used',
    '  "notes": string                 // uncertainties, ambiguities, possible name collisions',
    '}',
    '',
    'Rules: only state what you found evidence for — leave fields empty rather than guessing;',
    'prefer primary sources (their own pages, ORCID, institutional profile, recent publications);',
    'if several academics share the name, pick the one matching the hints and record the ambiguity in notes.',
  ].join('\n');
}

export function parseScout(raw) {
  const d = extractJson(raw);
  const str = (v) => String(v ?? '').trim();
  const lines = (v) => (Array.isArray(v) ? v.map((s) => String(s).trim()).filter(Boolean) : []);
  if (!str(d.name)) throw new Error('Scout returned no name');
  return {
    name: str(d.name),
    title: str(d.title),
    institution: str(d.institution),
    unit: str(d.unit),
    country: str(d.country),
    seniority: Math.min(4, Math.max(1, Number(d.seniority) || 2)),
    field: str(d.field),
    methods: lines(d.methods),
    methodFamilies: lines(d.methodFamilies).filter((f) => METHOD_FAMILIES.includes(f)),
    interests: lines(d.interests),
    reflections: lines(d.reflections),
    collaborationStyle: str(d.collaborationStyle),
    orcid: str(d.orcid),
    sources: lines(d.sources),
    notes: str(d.notes),
  };
}

export async function scoutResearcher({ name, hints = '' }) {
  const raw = await claudeCliCall({
    system:
      'You are a careful research librarian drafting a researcher profile from public web sources. Accuracy over completeness: an empty field is better than a plausible guess. This draft will be reviewed by a human and, ideally, by the researcher themself.',
    prompt: scoutPrompt(name, hints),
    allowedTools: ['WebSearch', 'WebFetch'],
    maxTurns: 15,
    timeoutMs: SCOUT_TIMEOUT_MS,
  });
  return parseScout(raw);
}
