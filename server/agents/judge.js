// judge.js — Step 3 in JUDGE mode. Instead of two agents talking, one model is
// shown both profiles and the opportunity and asked a single question: should
// these two collaborate — 0 or 1? Because that answer is not deterministic, the
// question is put k times to each of several models and the votes are averaged
// into ECP (baseline.js#ecpFromVotes). The study question this serves: is model
// judgment a better predictor of endorsed collaborations than tie-formation
// theory? (Design record: docs/specs/2026-09-10-search-centric-redesign.md, Part 2.)
//
// The prompt wording is an experimental factor, so the variants are named here,
// selectable per run, and the full text is snapshotted into the run record.

import { extractJson } from '../util.js';

export const JUDGE_PROMPTS = {
  unguided: {
    label: 'Unguided — "should they collaborate?"',
    system:
      'You are asked whether two researchers should collaborate. Read both profiles and the opportunity, decide, and answer honestly. There is no right rate of yes or no.',
    guidance: '',
  },
  guided: {
    label: 'Guided — complementarity, not similarity',
    system:
      'You are asked whether two researchers should collaborate. Read both profiles and the opportunity, decide, and answer honestly. There is no right rate of yes or no.',
    guidance:
      'Judge complementarity, not similarity: would a joint response be stronger than either alone because each brings something the other lacks? Do not reward topical overlap for its own sake, and do not penalise distance between fields if the pairing would genuinely work.',
  },
};

export const DEFAULT_JUDGE_REPEATS = Number(process.env.JUDGE_REPEATS ?? 10);
const CONCURRENCY = 4;

function profileBlock(r) {
  return [
    `${r.name} — ${r.title}, ${r.unit}, ${r.institution}`,
    `Field: ${r.field}`,
    `Methods: ${r.methods.join('; ')}`,
    `Current interests: ${r.interests.join('; ')}`,
    `Collaboration style: ${r.collaborationStyle}`,
    `Recent reflections:`,
    ...(r.reflections ?? []).map((x) => `  - ${x}`),
  ].join('\n');
}

/** The full user prompt for one vote — identical across repeats and models. */
export function judgePrompt({ a, b, trigger, variant = 'unguided' }) {
  const v = JUDGE_PROMPTS[variant];
  if (!v) throw new Error(`Unknown judge prompt variant "${variant}" (use: ${Object.keys(JUDGE_PROMPTS).join(', ')})`);
  return [
    'RESEARCHER A',
    profileBlock(a),
    '',
    'RESEARCHER B',
    profileBlock(b),
    '',
    ...(trigger
      ? ['THE OPPORTUNITY', `"${trigger.title}"`, trigger.text, '']
      : ['THE QUESTION IS OPEN — no specific opportunity; judge whether a collaboration between them would be worth pursuing at all.', '']),
    ...(v.guidance ? [v.guidance, ''] : []),
    `Should ${a.name} and ${b.name} collaborate${trigger ? ' on this opportunity' : ''}? Answer as JSON only:`,
    '{ "vote": 0 or 1, "reason": "one plain sentence a colleague would understand" }',
  ].join('\n');
}

/** Coerce a model's answer into a vote. Strict on the vote, lenient on the wrapper. */
export function parseVote(raw) {
  let vote;
  let reason = '';
  try {
    const j = extractJson(raw);
    vote = Number(j.vote);
    reason = String(j.reason ?? '').trim();
  } catch {
    // A bare "1" / "0" at the start is accepted; anything else is not a vote.
    const m = /^\s*([01])\b/.exec(String(raw));
    if (!m) throw new Error(`Judge did not return a 0/1 vote: ${String(raw).slice(0, 120)}`);
    vote = Number(m[1]);
    reason = String(raw).slice(m[0].length).trim();
  }
  if (vote !== 0 && vote !== 1) throw new Error(`Judge vote must be 0 or 1, got ${vote}`);
  return { vote, reason };
}

/**
 * Collect votes for a pair: `repeats` per model, in parallel (bounded), calling
 * `onVote` as each lands so the UI can show the tally filling in. `existing`
 * lets a resumed run skip votes it already holds.
 */
export async function judgePair({
  a, b, trigger, provider, models, repeats = DEFAULT_JUDGE_REPEATS, variant = 'unguided',
  existing = [], onVote,
}) {
  const prompt = judgePrompt({ a, b, trigger, variant });
  const system = JUDGE_PROMPTS[variant].system;

  const judgments = models.map((model) => existing.find((j) => j.model === model) ?? { provider: provider.name, model, votes: [] });
  const tasks = [];
  for (const j of judgments) {
    for (let i = j.votes.length; i < repeats; i++) tasks.push(j);
  }

  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const j = tasks[next++];
      const raw = await provider.complete({
        system, prompt, maxTokens: 300, model: j.model,
        meta: { kind: 'judge', a, b, trigger, model: j.model, index: j.votes.length, variant },
      });
      const v = { ...parseVote(raw), at: new Date().toISOString() };
      j.votes.push(v);
      if (onVote) await onVote({ model: j.model, vote: v, done: judgments.reduce((n, x) => n + x.votes.length, 0), total: models.length * repeats });
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, worker));
  return { judgments, prompt, system };
}
