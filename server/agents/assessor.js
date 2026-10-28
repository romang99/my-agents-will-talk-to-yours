// assessor.js — Step 5 (Comparison). Asks the LLM to reason about the pair
// through each of the four tie-formation mechanisms (Dahlander & McFarland 2013),
// producing per-mechanism explanations that sit alongside the deterministic
// baseline scores. Final classification (predicted/borderline/latent) is done
// in code from the deterministic composite — the LLM explains, it doesn't decide.

import { extractJson } from '../util.js';

/** `outcome` is one line describing what Step 3 concluded — a connection brief
 * in conversation mode, a vote tally in judge mode. The assessor only needs to
 * know what it is contextualising; it never decides the classification. */
export async function assessAgainstBaseline({ a, b, baseline, outcome, opportunity = null, provider }) {
  const system =
    'You are a network sociologist. Given two researchers and their structural relationship, you explain — mechanism by mechanism — whether established tie-formation theory would predict a collaboration between them. Be precise and sceptical.';

  const prompt = [
    `Researcher A: ${a.name} — ${a.title}, ${a.unit}, ${a.institution}; seniority ${a.seniority}/4; methods: ${a.methodFamilies.join(', ')}`,
    `Researcher B: ${b.name} — ${b.title}, ${b.unit}, ${b.institution}; seniority ${b.seniority}/4; methods: ${b.methodFamilies.join(', ')}`,
    `Existing tie: ${baseline.existingTie ? 'yes' : 'no'}. Shared collaborators: ${baseline.sharedNeighbours.join(', ') || 'none'}.`,
    `Deterministic baseline scores (0-1): foci ${baseline.scores.organisationalFoci}, homophily ${baseline.scores.homophily}, cumulative advantage ${baseline.scores.cumulativeAdvantage}, triadic closure ${baseline.scores.triadicClosure}.`,
    '',
    `Step 3 outcome: ${outcome}`,
    '',
    'For each of the four mechanisms (organisationalFoci, homophily, cumulativeAdvantage, triadicClosure), explain in 1-2 sentences whether that mechanism would plausibly have produced this tie. Then give a one-paragraph summary of whether classical tie-formation theory predicts this pair at all.',
    '',
    'Answer as JSON only:',
    '{ "mechanisms": [ { "mechanism": string, "score": number, "explanation": string } x4 ], "summary": string }',
  ].join('\n');

  const raw = await provider.complete({
    system,
    prompt,
    maxTokens: 1200,
    meta: { kind: 'assessment', a, b, baseline, opportunity },
  });
  const assessment = extractJson(raw);
  if (!Array.isArray(assessment.mechanisms)) {
    throw new Error('Assessor returned malformed assessment');
  }
  return assessment;
}
