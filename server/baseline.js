// baseline.js — Step 1 of the research design.
// Deterministic (no LLM) computation of the four tie-formation predictors from
// Dahlander & McFarland (2013), plus a composite structural predictability score.
// These scores are the baseline that discovered opportunities are compared against
// in Step 5: an opportunity is only "latent" if the baseline would NOT predict it.

/** Build an adjacency map { id -> Set of neighbour ids } from the edge list. */
export function buildAdjacency(researchers, collaborations) {
  const adj = new Map(researchers.map((r) => [r.id, new Set()]));
  for (const { source, target } of collaborations) {
    if (adj.has(source) && adj.has(target)) {
      adj.get(source).add(target);
      adj.get(target).add(source);
    }
  }
  return adj;
}

export function degree(adj, id) {
  return adj.get(id)?.size ?? 0;
}

export function hasTie(adj, a, b) {
  return adj.get(a)?.has(b) ?? false;
}

export function sharedNeighbours(adj, a, b) {
  const na = adj.get(a) ?? new Set();
  const nb = adj.get(b) ?? new Set();
  return [...na].filter((n) => nb.has(n) && n !== a && n !== b);
}

/**
 * Researchers commonly hold multiple affiliations (a school AND a centre, or
 * two institutions). Affiliation fields are therefore treated as lists —
 * separated by ";" or "/" — and compared normalised (case-insensitive,
 * parentheticals like "(QUT)" stripped), so "Queensland University of
 * Technology (QUT)" matches "Queensland University of Technology".
 */
const normSetting = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const settingList = (s) => String(s ?? '').split(/[;/]/).map(normSetting).filter(Boolean);

/** Shared organisational settings between two researchers, for scoring and explainability. */
export function fociDetail(a, b) {
  const sharedInstitutions = settingList(a.institution).filter((x) => settingList(b.institution).includes(x));
  const sharedUnits = settingList(a.unit).filter((x) => settingList(b.unit).includes(x));
  return { sharedInstitutions, sharedUnits };
}

/**
 * Organisational foci: ties form when people are brought together by shared
 * settings. Any shared institution scores 0.6; any shared unit/centre → 1.
 */
export function organisationalFoci(a, b) {
  const { sharedInstitutions, sharedUnits } = fociDetail(a, b);
  if (sharedInstitutions.length === 0) return 0;
  return sharedUnits.length > 0 ? 1 : 0.6;
}

/**
 * Status & value homophily: similarity of standing (seniority) and professional
 * orientation (method families). Equal-weight blend of the two.
 * `homophilyDetail` returns the parts as well as the score, so the UI explanation
 * and the score can never disagree — both read the same computation.
 */
export function homophilyDetail(a, b) {
  const seniorityGap = Math.abs(a.seniority - b.seniority);
  const statusSim = Math.max(0, 1 - seniorityGap / 3);
  const sharedFamilies = a.methodFamilies.filter((f) => b.methodFamilies.includes(f));
  const familyUnion = new Set([...a.methodFamilies, ...b.methodFamilies]).size;
  const valueSim = familyUnion === 0 ? 0 : sharedFamilies.length / familyUnion;
  return {
    score: 0.5 * statusSim + 0.5 * valueSim,
    statusSim,
    valueSim,
    sharedFamilies,
    familyUnion,
  };
}

export function homophily(a, b) {
  return homophilyDetail(a, b).score;
}

/**
 * Cumulative advantage: well-connected researchers attract further ties.
 * Geometric mean of the pair's degrees as a fraction of the maximum possible
 * degree (n-1) — i.e. how "central" the pair is relative to the whole network,
 * not merely relative to the current busiest node.
 */
export function cumulativeAdvantage(adj, aId, bId) {
  const maxPossible = adj.size - 1;
  if (maxPossible <= 0) return 0;
  return Math.sqrt(degree(adj, aId) * degree(adj, bId)) / maxPossible;
}

/**
 * Triadic closure: people connect when they share existing contacts.
 * Shared neighbours normalised by the smaller neighbourhood (0 if either is isolated).
 */
export function triadicClosure(adj, aId, bId) {
  const minDeg = Math.min(degree(adj, aId), degree(adj, bId));
  if (minDeg === 0) return 0;
  return Math.min(1, sharedNeighbours(adj, aId, bId).length / minDeg);
}

export const WEIGHTS = {
  organisationalFoci: 0.3,
  homophily: 0.2,
  cumulativeAdvantage: 0.2,
  triadicClosure: 0.3,
};

/**
 * Classification thresholds — the study's preregistered parameters. They live
 * here, named, because a paper must be able to state them and a reviewer must be
 * able to find them. Change them in one place; `classify` reads them.
 */
export const THRESHOLDS = {
  predictedMinPredictability: 0.5, // at or above this, structure already explains the pair
  latentMaxPredictability: 0.25, // below this, classical theory predicts nothing
  latentMinEcp: 0.5, // and the system must see at least this much potential
};

/**
 * Full baseline assessment for a pair, including a human-readable breakdown of
 * exactly how each mechanism score and the composite were computed (the
 * explainability surface shown in the UI and preserved in run provenance).
 * The weights favour foci and closure, the strongest predictors in the literature.
 */
export function pairBaseline(researchers, collaborations, aId, bId) {
  const byId = new Map(researchers.map((r) => [r.id, r]));
  const a = byId.get(aId);
  const b = byId.get(bId);
  if (!a || !b) throw new Error(`Unknown researcher in pair: ${aId}, ${bId}`);
  const adj = buildAdjacency(researchers, collaborations);

  // Each mechanism is computed ONCE, via the same *Detail helpers the
  // explanations read — so a score and its explanation cannot drift apart.
  const foci = fociDetail(a, b);
  const homo = homophilyDetail(a, b);
  const degA = degree(adj, aId);
  const degB = degree(adj, bId);
  const shared = sharedNeighbours(adj, aId, bId);
  const name = (id) => byId.get(id)?.name ?? id;

  const scores = {
    organisationalFoci: organisationalFoci(a, b),
    homophily: homo.score,
    cumulativeAdvantage: cumulativeAdvantage(adj, aId, bId),
    triadicClosure: triadicClosure(adj, aId, bId),
  };
  const composite = Object.keys(WEIGHTS).reduce((s, k) => s + WEIGHTS[k] * scores[k], 0);
  const { sharedInstitutions, sharedUnits } = foci;

  const breakdown = [
    {
      mechanism: 'organisationalFoci',
      score: scores.organisationalFoci,
      weight: WEIGHTS.organisationalFoci,
      inputs:
        sharedInstitutions.length > 0
          ? sharedUnits.length > 0
            ? `shared unit/centre: ${sharedUnits.join(', ')} → 1.0`
            : `shared institution (${sharedInstitutions.join(', ')}) but no shared unit/centre → 0.6`
          : `no shared institution (${a.institution || 'none recorded'} vs ${b.institution || 'none recorded'}) → 0`,
    },
    {
      mechanism: 'homophily',
      score: scores.homophily,
      weight: WEIGHTS.homophily,
      inputs: `seniority ${a.seniority} vs ${b.seniority} → status similarity ${homo.statusSim.toFixed(2)}; shared method families: ${homo.sharedFamilies.join(', ') || 'none'} (${homo.sharedFamilies.length}/${homo.familyUnion} → ${homo.valueSim.toFixed(2)}); blend 50/50`,
    },
    {
      mechanism: 'cumulativeAdvantage',
      score: scores.cumulativeAdvantage,
      weight: WEIGHTS.cumulativeAdvantage,
      inputs: `existing ties ${degA} × ${degB} → √${degA * degB} of ${adj.size - 1} possible`,
    },
    {
      mechanism: 'triadicClosure',
      score: scores.triadicClosure,
      weight: WEIGHTS.triadicClosure,
      inputs: shared.length
        ? `shared collaborators: ${shared.map(name).join(', ')} — ${shared.length} of min degree ${Math.min(degA, degB)}`
        : 'no shared collaborators to broker an introduction',
    },
  ].map((m) => ({ ...m, contribution: round3(m.weight * m.score) }));

  return {
    pair: [aId, bId],
    existingTie: hasTie(adj, aId, bId),
    scores,
    composite: round3(composite),
    sharedNeighbours: shared,
    breakdown,
    formula: `composite = ${breakdown.map((m) => `${m.weight.toFixed(2)}×${m.score.toFixed(2)}`).join(' + ')} = ${round3(composite).toFixed(2)}`,
  };
}

/**
 * Expected Collaboration Potential (ECP) ∈ [0,1] — the system's own judgment of
 * a pairing, computed IN CODE from the synthesizer's 1-5 sub-scores (relevance,
 * complementarity, feasibility). A non-viable outcome is 0 by definition.
 * `novelty` is accepted as a legacy alias for relevance (pre-trigger runs).
 */
export function ecpFromBrief(brief) {
  if (!brief?.viable) return 0;
  const unit = (x) => Math.min(5, Math.max(1, Number(x) || 1)) - 1; // → 0..4
  const relevance = unit(brief.relevance ?? brief.novelty);
  return round3((relevance + unit(brief.complementarity) + unit(brief.feasibility)) / 12);
}

/**
 * Classify a run against the baseline (Step 5). The interesting object is the
 * DIVERGENCE between structural predictability and the system's ECP. Thresholds
 * are named in THRESHOLDS above.
 */
/**
 * ECP in JUDGE mode: the share of 0/1 votes in favour, across every repeat of
 * every model. Same scale, same downstream classification — only the producer
 * differs. No votes is not a judgment: it throws rather than returning 0.
 */
export function ecpFromVotes(votes) {
  const v = votes.map((x) => (typeof x === 'number' ? x : x.vote)).filter((x) => x === 0 || x === 1);
  if (v.length === 0) throw new Error('ecpFromVotes: no votes');
  return round3(v.reduce((s, x) => s + x, 0) / v.length);
}

export function classify(composite, ecp) {
  const t = THRESHOLDS;
  if (ecp <= 0) return 'none'; // agents found no basis — an honest negative
  if (composite >= t.predictedMinPredictability) return 'predicted'; // structure explains it
  if (composite < t.latentMaxPredictability && ecp >= t.latentMinEcp) return 'latent';
  return 'borderline';
}

/** All unconnected pairs ranked by ascending structural predictability —
 * the front of the list is where classical models predict nothing, i.e. where
 * probing for latent opportunities is most informative. */
export function candidatePairs(researchers, collaborations) {
  const pairs = [];
  for (let i = 0; i < researchers.length; i++) {
    for (let j = i + 1; j < researchers.length; j++) {
      const base = pairBaseline(researchers, collaborations, researchers[i].id, researchers[j].id);
      if (!base.existingTie) pairs.push(base);
    }
  }
  return pairs.sort((x, y) => x.composite - y.composite);
}

function round3(x) {
  return Math.round(x * 1000) / 1000;
}
