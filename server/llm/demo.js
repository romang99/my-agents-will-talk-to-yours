// demo.js — deterministic offline provider. Generates plausible, profile-specific
// content for every pipeline stage with zero credentials and zero network, so the
// app can always be demonstrated (and the pipeline unit-tested). Real runs use
// claude-cli or the Anthropic API; this driver marks its outputs as demo content.
//
// It relies on the `meta` hint the pipeline attaches to each call
// ({ kind, speaker, other, turnIndex, turns }) rather than parsing the prompt.

import { THRESHOLDS } from '../baseline.js';

/** Lexical-affinity score above which the demo treats a pairing as viable.
 * Demo-only: real runs decide viability in the synthesizer prompt. */
const DEMO_VIABLE_AT = 0.08;

export class DemoProvider {
  name = 'demo';
  model = 'demo-replay (no LLM)';
  judgeModels = ['demo-judge-a', 'demo-judge-b', 'demo-judge-c'];

  async complete({ meta }) {
    if (!meta) throw new Error('DemoProvider requires call meta');
    await pause(meta.kind === 'judge' ? 120 : 400); // small delay so the UI's live feel survives demo mode
    switch (meta.kind) {
      case 'judge':
        return JSON.stringify(judgeVote(meta));
      case 'turn':
        return conversationTurn(meta);
      case 'synthesis':
        return JSON.stringify(synthesis(meta), null, 2);
      case 'assessment':
        return JSON.stringify(assessment(meta), null, 2);
      default:
        throw new Error(`DemoProvider: unknown call kind ${meta.kind}`);
    }
  }
}

/** Crude lexical affinity between two researchers, used to decide whether the
 * demo conversation converges on a joint project or honestly fails to. */
export function affinity(a, b) {
  const tokens = (r) =>
    new Set(
      [r.field, ...r.interests, ...r.methods, ...(r.reflections ?? [])]
        .join(' ')
        .toLowerCase()
        .replace(/[^a-z ]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 4 && !STOP.has(w)),
    );
  const ta = tokens(a);
  const tb = tokens(b);
  const shared = [...ta].filter((w) => tb.has(w));
  return { score: shared.length / Math.min(ta.size, tb.size), shared };
}

const STOP = new Set([
  'research', 'researchers', 'studies', 'study', 'analysis', 'methods', 'their',
  'through', 'about', 'field', 'work', 'working', 'organizations', 'organisational',
]);

function firstName(r) {
  return r.name.split(' ')[0];
}

function conversationTurn({ speaker, other, turnIndex, turns, trigger }) {
  const viable = affinity(speaker, other).score >= DEMO_VIABLE_AT;
  const interest = speaker.interests[turnIndex % speaker.interests.length];
  const otherInterest = other.interests[(turnIndex + 1) % other.interests.length];
  const method = speaker.methods[0];
  const re = trigger ? ` for "${trigger.title}"` : '';
  const phase = Math.floor((turnIndex / turns) * 3); // 0 relevance, 1 assess, 2 judge

  if (phase === 0) {
    return trigger
      ? `Good to meet you, ${firstName(other)}. I represent ${speaker.name} — ${speaker.title.toLowerCase()}, ${speaker.field}. Looking at this opportunity honestly: what we could bring is ${interest}, grounded in ${method}. Before I assume anything — what would ${other.name} actually contribute here that isn't already covered by their usual collaborators?`
      : `Good to meet you, ${firstName(other)}. I represent ${speaker.name} — ${speaker.title.toLowerCase()} working on ${speaker.field}. Right now the question occupying us most is ${interest}. I noticed your work on ${otherInterest}; before assuming overlap, I'd like to understand what problem is actually keeping your researcher up at night.`;
  }
  if (phase === 1) {
    if (!viable) {
      return `I've been probing for a genuine connection${re}, and I want to be honest rather than agreeable: ${speaker.name}'s programme sits in ${speaker.field}, and I don't see what a pairing with ${other.field} would contribute here. It feels forced. Do you see something I'm missing?`;
    }
    return `Testing the complementarity${re}: you bring ${otherInterest}, we bring ${interest} — and our strength in ${method} covers something your side genuinely lacks, and vice versa. Neither of us could respond alone. That's recognition, not invention — I'm not going to draft the topic for our humans.`;
  }
  if (!viable) {
    return `My recommendation for ${speaker.name}: do not connect over this${re ? ' opportunity' : ''}. There is no genuine basis, and forcing a tie would waste both researchers' time. If a future opportunity needs ${speaker.methods[0]}, the door is open.`;
  }
  return `My recommendation: our humans should connect${re}. What each side brings is concrete — ${method} from us, ${other.methods[0]} from your side — and the complementarity is real. First step: a short introduction meeting about ${trigger ? 'whether to respond jointly' : 'where the agendas actually touch'}. ${speaker.name} would realistically make time for that.`;
}

function synthesis({ a, b, transcript, trigger }) {
  const { score, shared } = affinity(a, b);
  const viable = score >= DEMO_VIABLE_AT;
  const re = trigger ? ` for "${trigger.title}"` : '';
  if (!viable) {
    return {
      viable: false,
      title: `No basis to connect${re}: ${firstName(a)} × ${firstName(b)}`,
      fit_summary: `The agents found no genuine basis for a connection${re}: ${a.field} and ${b.field} offered no complementary contributions that survive scrutiny.`,
      contributions: { [a.id]: 'n/a', [b.id]: 'n/a' },
      joint_angle: null,
      first_step: null,
      relevance: 1,
      complementarity: 1,
      feasibility: 1,
      verdict: 'The agents recommend against connecting — a negative result the system is designed to be capable of producing.',
    };
  }
  const theme = shared.slice(0, 3).join(', ') || 'AI in organisational life';
  return {
    viable: true,
    title: `Connect ${firstName(a)} × ${firstName(b)}${re}`,
    fit_summary: `The pairing works${re} because the contributions are complementary, not overlapping: ${a.name} brings ${a.interests[0]} (${a.methods[0]}), ${b.name} brings ${b.interests[0]} (${b.methods[0]}). Around ${theme}, neither side could respond alone.`,
    contributions: {
      [a.id]: `${a.methods[0]}; framing from ${a.field}`,
      [b.id]: `${b.methods[0]}; framing from ${b.field}`,
    },
    joint_angle: `Where ${theme} meets both agendas — a pointer for the humans, not a research question.`,
    first_step: trigger
      ? `A 30-minute introduction: does a joint response to "${trigger.title}" make sense, and who else would be needed?`
      : 'A 30-minute introduction meeting on where the two agendas actually touch.',
    relevance: 4,
    complementarity: 4,
    feasibility: 3,
    verdict: 'The agents recommend the humans connect: the complementarity is concrete and the commitment realistic.',
  };
}

/**
 * Demo judge: a vote from the same lexical affinity the demo conversation uses,
 * with a small deterministic jitter per (model, repeat) so pairs near the
 * threshold show a split tally — the averaging is what the mode demonstrates —
 * while clear misfits (Lena Fischer) stay unanimous at 0.
 */
function judgeVote({ a, b, model, index }) {
  const { score, shared } = affinity(a, b);
  const jitter = (hash(`${a.id}|${b.id}|${model}|${index}`) % 100) / 100 - 0.5; // -0.5..0.5
  const vote = score + jitter * 0.06 >= DEMO_VIABLE_AT ? 1 : 0;
  const reason = vote
    ? `Both work on ${shared.slice(0, 2).join(' and ') || 'related questions'} from different methods, so each has something the other lacks.`
    : `${a.field} and ${b.field} share too little for a joint response to be stronger than either alone.`;
  return { vote, reason };
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
  return h;
}

function assessment({ a, b, baseline }) {
  const s = baseline.scores;
  const explain = (mechanism, value, text) => ({
    mechanism,
    score: value,
    explanation: text,
  });
  return {
    mechanisms: [
      explain('organisationalFoci', s.organisationalFoci,
        s.organisationalFoci > 0.5
          ? `${a.name} and ${b.name} share an organisational setting (${a.institution}), so shared foci could explain a tie.`
          : `No shared institutional setting (${a.institution} vs ${b.institution}); foci would not bring them together.`),
      explain('homophily', s.homophily,
        s.homophily > 0.5
          ? 'Similar standing and methodological orientation make homophily a plausible driver.'
          : 'Different standing or methodological worlds; homophily is a weak explanation here.'),
      explain('cumulativeAdvantage', s.cumulativeAdvantage,
        s.cumulativeAdvantage > 0.5
          ? 'Both are highly connected; preferential attachment could produce this tie.'
          : 'At least one side is weakly connected, so cumulative advantage predicts little.'),
      explain('triadicClosure', s.triadicClosure,
        baseline.sharedNeighbours.length > 0
          ? `Shared contacts (${baseline.sharedNeighbours.join(', ')}) could broker an introduction.`
          : 'No shared contacts exist to broker this tie.'),
    ],
    summary:
      baseline.composite < THRESHOLDS.latentMaxPredictability
        ? 'None of the four classical mechanisms plausibly produces this tie — if the constructed opportunity is real, it is latent in the paper\'s sense.'
        : baseline.composite >= THRESHOLDS.predictedMinPredictability
          ? 'Classical mechanisms already predict this pair; the opportunity is structurally expected rather than latent.'
          : 'Mechanisms give partial coverage; this pair sits at the boundary of what structure predicts.',
  };
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function pause(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
