import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { judgePrompt, parseVote, judgePair, JUDGE_PROMPTS } from '../server/agents/judge.js';
import { ecpFromVotes, THRESHOLDS } from '../server/baseline.js';
import { runPipeline, resumePipeline } from '../server/pipeline.js';
import { RunStore } from '../server/store.js';
import { DemoProvider } from '../server/llm/demo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataset = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'server', 'data', 'researchers.json'), 'utf8'));
const byId = Object.fromEntries(dataset.researchers.map((r) => [r.id, r]));
const tempStore = () => new RunStore(fs.mkdtempSync(path.join(os.tmpdir(), 'rc-judge-')));
const trigger = { id: 't', title: 'Test call', text: 'A call about agentic AI in organisations.' };

test('ecpFromVotes is the share of votes in favour, and refuses to judge from nothing', () => {
  assert.equal(ecpFromVotes([1, 1, 0, 0]), 0.5);
  assert.equal(ecpFromVotes([{ vote: 1 }, { vote: 1 }, { vote: 0 }]), 0.667);
  assert.equal(ecpFromVotes([0, 0, 0]), 0);
  assert.throws(() => ecpFromVotes([]), /no votes/);
});

test('parseVote: strict on the vote, lenient on the wrapper', () => {
  assert.deepEqual(parseVote('{"vote": 1, "reason": "They need each other."}'), { vote: 1, reason: 'They need each other.' });
  assert.deepEqual(parseVote('```json\n{"vote": 0, "reason": "No."}\n```'), { vote: 0, reason: 'No.' });
  assert.equal(parseVote('1 — clearly complementary').vote, 1);
  assert.throws(() => parseVote('{"vote": 0.7}'), /must be 0 or 1/);
  assert.throws(() => parseVote('Maybe.'), /did not return/);
});

test('the judge prompt carries both profiles and the trigger, and the variants differ only by guidance', () => {
  const a = byId['synthetic-mira-chen'];
  const b = byId['synthetic-priya-raman'];
  const unguided = judgePrompt({ a, b, trigger, variant: 'unguided' });
  const guided = judgePrompt({ a, b, trigger, variant: 'guided' });
  for (const p of [unguided, guided]) {
    assert.ok(p.includes(a.name) && p.includes(b.name));
    assert.ok(p.includes(trigger.text));
    assert.ok(p.includes(a.reflections[0]), 'reflections reach the judge');
    assert.ok(p.includes('"vote": 0 or 1'));
  }
  assert.ok(guided.includes(JUDGE_PROMPTS.guided.guidance));
  assert.ok(!unguided.includes(JUDGE_PROMPTS.guided.guidance), 'unguided must not steer');
  assert.throws(() => judgePrompt({ a, b, trigger, variant: 'nope' }), /Unknown judge prompt variant/);
});

test('judgePair collects repeats × models votes and reports progress', async () => {
  const a = byId['synthetic-mira-chen'];
  const b = byId['synthetic-priya-raman'];
  const progress = [];
  const { judgments, prompt, system } = await judgePair({
    a, b, trigger, provider: new DemoProvider(), models: ['demo-judge-a', 'demo-judge-b'], repeats: 3,
    onVote: (v) => progress.push(v.done),
  });
  assert.equal(judgments.length, 2);
  assert.ok(judgments.every((j) => j.votes.length === 3));
  assert.ok(judgments.flatMap((j) => j.votes).every((v) => (v.vote === 0 || v.vote === 1) && v.reason && v.at));
  assert.deepEqual([...progress].sort((x, y) => x - y), [1, 2, 3, 4, 5, 6]);
  assert.ok(prompt.includes(a.name) && system.length > 0, 'prompt text returned for provenance');
});

test('judge-mode pipeline: votes → ECP → classification, with the conversation artefacts absent', async () => {
  const store = tempStore();
  const events = [];
  const run = await runPipeline({
    dataset, pair: ['synthetic-mira-chen', 'synthetic-priya-raman'], provider: new DemoProvider(), store,
    emit: (type, payload) => events.push({ type, payload }), turns: 6, trigger,
    mode: 'judge', judge: { repeats: 4, variant: 'guided' },
  });
  assert.equal(run.mode, 'judge');
  assert.equal(run.status, 'awaiting-validation');
  assert.deepEqual(run.judge.models, ['demo-judge-a', 'demo-judge-b', 'demo-judge-c'], 'defaults to the provider\'s judge models');
  assert.equal(run.judge.repeats, 4);
  assert.equal(run.judge.variant, 'guided');
  assert.ok(run.judge.prompt.user.includes(trigger.title), 'prompt snapshotted into provenance');
  assert.equal(run.judgments.length, 3);
  assert.equal(run.judgments.flatMap((j) => j.votes).length, 12);
  assert.equal(run.ecp, ecpFromVotes(run.judgments.flatMap((j) => j.votes)), 'ECP is the vote share, computed once');
  assert.ok(run.ecp >= THRESHOLDS.latentMinEcp, `Mira—Priya should be judged favourably, got ${run.ecp}`);
  assert.equal(run.classification, 'latent', 'same classify() as conversation mode');
  assert.equal(run.transcript.length, 0);
  assert.equal(run.opportunity, null);
  assert.equal(run.assessment.mechanisms.length, 4, 'Step 5 still runs');

  const types = events.map((e) => e.type);
  assert.equal(types.filter((t) => t === 'run.vote').length, 12);
  assert.ok(types.includes('run.judged') && types.includes('run.completed'));
  assert.ok(!types.includes('run.turn') && !types.includes('run.opportunity'));
  assert.equal(events.find((e) => e.type === 'run.started').payload.mode, 'judge');
});

test('judge mode keeps the honest-failure path: Lena Fischer gets no votes and classifies as none', async () => {
  const run = await runPipeline({
    dataset, pair: ['synthetic-lena-fischer', 'synthetic-jonas-adler'], provider: new DemoProvider(), store: tempStore(),
    emit: () => {}, turns: 6, trigger, mode: 'judge', judge: { repeats: 3 },
  });
  assert.equal(run.ecp, 0);
  assert.equal(run.classification, 'none');
});

test('a judge run that fails mid-vote keeps its votes and resumes without recasting them', async () => {
  const store = tempStore();
  const flaky = new DemoProvider();
  const real = flaky.complete.bind(flaky);
  let calls = 0;
  flaky.complete = async (args) => {
    if (args.meta.kind === 'judge' && ++calls === 5) throw new Error('simulated judge crash');
    return real(args);
  };
  await assert.rejects(
    runPipeline({ dataset, pair: ['synthetic-mira-chen', 'synthetic-priya-raman'], provider: flaky, store, emit: () => {}, turns: 6, mode: 'judge', judge: { repeats: 3, models: ['demo-judge-a', 'demo-judge-b'] } }),
    /simulated judge crash/,
  );
  const failed = store.list()[0];
  assert.equal(failed.status, 'failed');
  assert.equal(failed.stage, 'judgment');
  const kept = failed.judgments.flatMap((j) => j.votes).length;
  assert.ok(kept >= 1 && kept < 6, `some but not all votes preserved (${kept})`);

  const events = [];
  const resumed = await resumePipeline({ dataset, run: failed, provider: new DemoProvider(), store, emit: (t) => events.push(t), turns: 6 });
  assert.equal(resumed.status, 'awaiting-validation');
  assert.equal(resumed.judgments.flatMap((j) => j.votes).length, 6);
  assert.equal(events.filter((t) => t === 'run.vote').length, 6 - kept, 'only the missing votes were cast');
});

test('an unknown mode or prompt variant is refused before anything runs', async () => {
  await assert.rejects(
    runPipeline({ dataset, pair: ['synthetic-mira-chen', 'synthetic-priya-raman'], provider: new DemoProvider(), store: tempStore(), emit: () => {}, turns: 6, mode: 'oracle' }),
    /Unknown run mode/,
  );
  await assert.rejects(
    runPipeline({ dataset, pair: ['synthetic-mira-chen', 'synthetic-priya-raman'], provider: new DemoProvider(), store: tempStore(), emit: () => {}, turns: 6, mode: 'judge', judge: { variant: 'leading' } }),
    /Unknown judge prompt variant/,
  );
});
