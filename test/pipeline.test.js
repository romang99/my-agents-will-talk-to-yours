import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPipeline, resumePipeline } from '../server/pipeline.js';
import { RunStore } from '../server/store.js';
import { DemoProvider, affinity } from '../server/llm/demo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataset = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'server', 'data', 'researchers.json'), 'utf8'),
);
const byId = Object.fromEntries(dataset.researchers.map((r) => [r.id, r]));

function tempStore() {
  return new RunStore(fs.mkdtempSync(path.join(os.tmpdir(), 'rc-test-')));
}

test('full pipeline with demo provider: Mira—Priya produces a latent opportunity', async () => {
  const store = tempStore();
  const events = [];
  const run = await runPipeline({
    dataset,
    pair: ['synthetic-mira-chen', 'synthetic-priya-raman'],
    provider: new DemoProvider(),
    store,
    emit: (type, payload) => events.push({ type, payload }),
    turns: 4,
  });

  assert.equal(run.status, 'awaiting-validation');
  assert.equal(run.transcript.length, 4);
  assert.equal(run.opportunity.viable, true);
  assert.equal(run.ecp, 0.667, 'ECP computed in code from the sub-scores');
  assert.equal(run.classification, 'latent');
  assert.equal(run.assessment.mechanisms.length, 4);

  const types = events.map((e) => e.type);
  assert.ok(types.includes('run.started'));
  assert.equal(types.filter((t) => t === 'run.turn').length, 4);
  assert.ok(types.includes('run.opportunity'));
  assert.ok(types.includes('run.completed'));

  // provenance: run persisted with full artifact chain
  const persisted = store.get(run.id);
  assert.equal(persisted.transcript.length, 4);
  assert.equal(persisted.provider.name, 'demo');
  assert.ok(persisted.log.length > 0);
});

test('poor-fit pair (Lena Fischer) yields an honest non-viable outcome', async () => {
  const store = tempStore();
  const run = await runPipeline({
    dataset,
    pair: ['synthetic-lena-fischer', 'synthetic-jonas-adler'],
    provider: new DemoProvider(),
    store,
    emit: () => {},
    turns: 4,
  });
  assert.equal(run.opportunity.viable, false);
  assert.equal(run.classification, 'none');
});

test('decision recording completes the validation step', async () => {
  const store = tempStore();
  const run = await runPipeline({
    dataset,
    pair: ['synthetic-mira-chen', 'synthetic-priya-raman'],
    provider: new DemoProvider(),
    store,
    emit: () => {},
    turns: 2,
  });
  const updated = store.recordDecision(run.id, 'accept', 'Would genuinely email Priya about this.');
  assert.equal(updated.decision.decision, 'accept');
  assert.ok(updated.decision.decidedAt);
});

test('a run that fails at comparison keeps its work and resumes to completion', async () => {
  const store = tempStore();
  const flaky = new DemoProvider();
  const realComplete = flaky.complete.bind(flaky);
  flaky.complete = async (args) => {
    if (args.meta.kind === 'assessment') throw new Error('simulated provider crash');
    return realComplete(args);
  };

  await assert.rejects(
    runPipeline({
      dataset,
      pair: ['synthetic-mira-chen', 'synthetic-priya-raman'],
      provider: flaky,
      store,
      emit: () => {},
      turns: 4,
    }),
    /simulated provider crash/,
  );

  const failed = store.list()[0];
  assert.equal(failed.status, 'failed');
  assert.equal(failed.stage, 'comparison');
  assert.equal(failed.transcript.length, 4, 'conversation turns preserved through the failure');
  assert.ok(failed.opportunity, 'synthesis preserved through the failure');

  const events = [];
  const resumed = await resumePipeline({
    dataset,
    run: failed,
    provider: new DemoProvider(),
    store,
    emit: (type) => events.push(type),
    turns: 4,
  });

  assert.equal(resumed.status, 'awaiting-validation');
  assert.equal(resumed.classification, 'latent');
  assert.equal(resumed.transcript.length, 4, 'conversation was not re-run');
  assert.ok(events.includes('run.resumed'));
  assert.ok(events.includes('run.completed'));
  assert.ok(!events.includes('run.turn'), 'no new turns were generated on resume');
});

test('a trigger anchors the conversation and is snapshotted into provenance', async () => {
  const store = tempStore();
  const trigger = {
    id: 'test-call',
    title: 'Test Special Issue on Agentic AI',
    text: 'A call for papers about agentic AI in organisations.',
  };
  const run = await runPipeline({
    dataset,
    pair: ['synthetic-mira-chen', 'synthetic-priya-raman'],
    provider: new DemoProvider(),
    store,
    emit: () => {},
    turns: 4,
    trigger,
  });
  assert.deepEqual(run.trigger, trigger, 'trigger snapshot stored on the run');
  assert.ok(
    run.transcript.some((t) => t.text.includes(trigger.title)),
    'conversation references the trigger',
  );
  assert.ok(run.opportunity.title.includes(trigger.title), 'brief is anchored to the trigger');
  assert.ok('fit_summary' in run.opportunity, 'connection-brief schema in use');
  const persisted = store.get(run.id);
  assert.equal(persisted.trigger.id, 'test-call');
});

test('demo affinity heuristic separates good and poor fits', () => {
  const miraPriya = affinity(byId['synthetic-mira-chen'], byId['synthetic-priya-raman']);
  const miraLena = affinity(byId['synthetic-mira-chen'], byId['synthetic-lena-fischer']);
  assert.ok(miraPriya.score >= 0.08, `Mira—Priya should be viable, got ${miraPriya.score}`);
  assert.ok(miraLena.score < 0.08, `Mira—Lena should be non-viable, got ${miraLena.score}`);
});
