// pipeline.js — the agentic run. Orchestrates the paper's five steps for one
// researcher pair, persisting every artifact (provenance) and emitting events
// for the UI: baseline → representation → [step 3] → comparison.
// Step 4 (human validation) happens asynchronously afterwards via the API.
//
// Step 3 has two MODES, chosen per run, that differ only in how ECP is produced:
//   conversation — two persona agents talk (6 turns), a synthesizer writes a
//                  connection brief, ECP = ecpFromBrief(brief)        (8 calls)
//   judge        — one model is asked "should they collaborate, 0 or 1?" k times
//                  across several models, ECP = share of votes in favour
// Everything downstream of ECP — classification, chart, validation — is shared.
//
// Stages are idempotent over the run record: anything already present is kept,
// so a failed run can be resumed from exactly where it stopped (resumePipeline)
// without repeating completed — and paid-for — LLM work.

import { pairBaseline, classify, ecpFromBrief, ecpFromVotes } from './baseline.js';
import { personaCard } from './agents/persona.js';
import { runConversation } from './agents/conversation.js';
import { synthesizeOpportunity } from './agents/synthesizer.js';
import { assessAgainstBaseline } from './agents/assessor.js';
import { judgePair, DEFAULT_JUDGE_REPEATS, JUDGE_PROMPTS } from './agents/judge.js';

export const MODES = ['conversation', 'judge'];

export async function runPipeline({ dataset, pair, provider, store, emit, turns, trigger = null, mode = 'conversation', judge = {} }) {
  if (!MODES.includes(mode)) throw new Error(`Unknown run mode "${mode}" (use: ${MODES.join(', ')})`);
  const [a, b] = resolvePair(dataset, pair);

  // Step 1 — Baseline (deterministic)
  const baseline = pairBaseline(dataset.researchers, dataset.collaborations, a.id, b.id);
  const run = store.createRun([a.id, b.id], baseline, {
    name: provider.name,
    model: provider.model,
  });
  // Snapshot the trigger into the run — provenance must survive trigger edits.
  run.trigger = trigger ? { id: trigger.id, title: trigger.title, text: trigger.text } : null;
  run.mode = mode;
  if (mode === 'judge') {
    // The judge configuration is provenance too: which models, how many votes,
    // which prompt wording (the wording is an experimental factor).
    const variant = judge.variant ?? 'unguided';
    if (!JUDGE_PROMPTS[variant]) throw new Error(`Unknown judge prompt variant "${variant}"`);
    run.judge = {
      models: judge.models?.length ? judge.models : provider.judgeModels ?? [provider.model],
      repeats: Number(judge.repeats ?? DEFAULT_JUDGE_REPEATS),
      variant,
      prompt: null, // filled in once the prompt is composed
    };
    run.judgments = [];
  }
  const how = mode === 'judge'
    ? `judge mode: ${run.judge.models.length} model(s) × ${run.judge.repeats} votes, prompt "${run.judge.variant}"`
    : 'conversation mode';
  run.log.push({ at: new Date().toISOString(), msg: `Run started with provider ${provider.name} (${provider.model}), ${how}${trigger ? ` — trigger: ${trigger.title}` : ' — open exploration (no trigger)'}` });
  emit('run.started', { runId: run.id, pair: run.pair, baseline, provider: run.provider, trigger: run.trigger, mode, judge: run.judge ?? null });

  return executeStages({ run, a, b, provider, store, emit, turns });
}

/** Pick a failed run back up from its last completed artifact. */
export async function resumePipeline({ dataset, run, provider, store, emit, turns }) {
  const [a, b] = resolvePair(dataset, run.pair);
  run.status = 'running';
  run.error = null;
  run.provider = { name: provider.name, model: provider.model };
  run.log.push({ at: new Date().toISOString(), msg: `Resumed with provider ${provider.name} (${provider.model}) from stage ${run.stage}` });
  store.save(run);
  emit('run.resumed', {
    runId: run.id,
    pair: run.pair,
    baseline: run.baseline,
    provider: run.provider,
    trigger: run.trigger ?? null,
    mode: run.mode ?? 'conversation',
    judge: run.judge ?? null,
    judgments: run.judgments ?? [],
    transcript: run.transcript,
  });
  return executeStages({ run, a, b, provider, store, emit, turns });
}

function resolvePair(dataset, pair) {
  const byId = new Map(dataset.researchers.map((r) => [r.id, r]));
  return pair.map((id) => {
    const r = byId.get(id);
    if (!r) throw new Error(`Unknown researcher: ${id}`);
    return r;
  });
}

async function executeStages({ run, a, b, provider, store, emit, turns }) {
  const log = (msg) => run.log.push({ at: new Date().toISOString(), msg });
  const stage = (name) => {
    run.stage = name;
    store.save(run);
    emit('run.stage', { runId: run.id, stage: name });
  };

  try {
    // Step 2 — Representation
    stage('representation');
    run.personas = { [a.id]: personaCard(a), [b.id]: personaCard(b) };
    log('Persona cards composed from layered mind files');
    store.save(run);
    emit('run.personas', { runId: run.id, personas: run.personas });

    if ((run.mode ?? 'conversation') === 'judge') {
      // Step 3 (judge mode) — votes, continuing from any already recorded
      const total = run.judge.models.length * run.judge.repeats;
      const have = () => (run.judgments ?? []).reduce((n, j) => n + j.votes.length, 0);
      if (have() < total) {
        stage('judgment');
        // one tally object per model up front, so every partial save is complete
        run.judgments = run.judge.models.map(
          (model) => (run.judgments ?? []).find((j) => j.model === model) ?? { provider: provider.name, model, votes: [] },
        );
        const res = await judgePair({
          a, b, trigger: run.trigger, provider,
          models: run.judge.models, repeats: run.judge.repeats, variant: run.judge.variant,
          existing: run.judgments ?? [],
          onVote: async (v) => {
            run.log.push({ at: v.vote.at, msg: `Vote ${v.done}/${v.total} — ${v.model}: ${v.vote.vote ? 'yes' : 'no'}` });
            store.save(run);
            emit('run.vote', { runId: run.id, ...v });
          },
        });
        run.judgments = res.judgments;
        run.judge.prompt = { system: res.system, user: res.prompt };
        store.save(run);
      }
      run.ecp = ecpFromVotes(run.judgments.flatMap((j) => j.votes));
      const yes = run.judgments.flatMap((j) => j.votes).filter((v) => v.vote === 1).length;
      log(`Judges voted ${yes} of ${total} in favour (ECP ${run.ecp})`);
      store.save(run);
      emit('run.judged', { runId: run.id, judgments: run.judgments, ecp: run.ecp });
    } else {
      // Step 3 — Conversation (continues from any turns already recorded)
      if (run.transcript.length < turns) {
        stage('conversation');
        await runConversation({
          a,
          b,
          provider,
          turns,
          trigger: run.trigger,
          transcript: run.transcript,
          onTurn: async (turn) => {
            run.log.push({ at: turn.at, msg: `Turn ${turn.index + 1}: ${turn.speakerName}` });
            store.save(run);
            emit('run.turn', { runId: run.id, turn });
          },
        });
      }

      // Step 3b — Synthesis into an opportunity brief
      if (!run.opportunity) {
        stage('synthesis');
        run.opportunity = await synthesizeOpportunity({ a, b, transcript: run.transcript, provider, trigger: run.trigger });
        run.ecp = ecpFromBrief(run.opportunity);
        log(`Connection brief synthesised: "${run.opportunity.title}" (viable: ${run.opportunity.viable}, ECP ${run.ecp})`);
        store.save(run);
        emit('run.opportunity', { runId: run.id, opportunity: run.opportunity });
      }
    }

    // Step 5 — Comparison against tie-formation baseline
    if (!run.assessment) {
      stage('comparison');
      run.assessment = await assessAgainstBaseline({
        a,
        b,
        baseline: run.baseline,
        outcome: outcomeLine(run),
        opportunity: run.opportunity,
        provider,
      });
    }
    if (run.ecp == null) run.ecp = ecpFromBrief(run.opportunity); // resumed pre-ECP conversation runs
    run.classification = classify(run.baseline.composite, run.ecp);
    log(`Classified as ${run.classification} (predictability ${run.baseline.composite}, ECP ${run.ecp}, divergence ${Math.round((run.ecp - run.baseline.composite) * 1000) / 1000})`);

    run.status = 'awaiting-validation';
    run.stage = 'validation';
    store.save(run);
    emit('run.completed', {
      runId: run.id,
      mode: run.mode ?? 'conversation',
      classification: run.classification,
      ecp: run.ecp,
      opportunity: run.opportunity,
      assessment: run.assessment,
      baseline: run.baseline,
    });
    return run;
  } catch (err) {
    run.status = 'failed';
    run.error = String(err.message ?? err);
    log(`FAILED: ${run.error}`);
    store.save(run);
    emit('run.failed', { runId: run.id, stage: run.stage, error: run.error });
    throw err;
  }
}

/** One line telling the assessor what Step 3 concluded, whichever mode ran. */
function outcomeLine(run) {
  if ((run.mode ?? 'conversation') === 'judge') {
    const votes = run.judgments.flatMap((j) => j.votes);
    const yes = votes.filter((v) => v.vote === 1).length;
    return `Independent model judges voted ${yes} of ${votes.length} in favour of a collaboration (ECP ${run.ecp}).`;
  }
  const o = run.opportunity;
  return `The agent conversation produced this connection brief: "${o.title}" — ${o.fit_summary ?? o.shared_problem ?? ''}`;
}
