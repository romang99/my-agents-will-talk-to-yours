// store.js — run persistence. Every pipeline run is a single JSON file under
// data/runs/, holding the complete provenance chain: prompts, every message,
// model/provider identity, scores, and human validation decisions.

import fs from 'node:fs';
import path from 'node:path';

export class RunStore {
  constructor(dir) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
  }

  createRun(pair, baseline, provider) {
    const id = `run-${new Date().toISOString().replace(/[:.]/g, '-')}-${pair.join('+')}`;
    const run = {
      id,
      pair,
      createdAt: new Date().toISOString(),
      provider,
      status: 'running',
      stage: 'baseline',
      baseline,
      trigger: null, // set by the pipeline: the opportunity the run was anchored to
      personas: {},
      transcript: [],
      opportunity: null,
      assessment: null,
      ecp: null, // expected collaboration potential, computed in code from the brief
      classification: null,
      decision: null,
      error: null,
      log: [],
    };
    this.save(run);
    return run;
  }

  save(run) {
    run.updatedAt = new Date().toISOString();
    fs.writeFileSync(this.pathFor(run.id), JSON.stringify(run, null, 2));
  }

  get(id) {
    const p = this.pathFor(id);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  }

  list() {
    return fs
      .readdirSync(this.dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(fs.readFileSync(path.join(this.dir, f), 'utf8')))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  recordDecision(id, decision, note) {
    const run = this.get(id);
    if (!run) return null;
    run.decision = { decision, note: note ?? null, decidedAt: new Date().toISOString() };
    this.save(run);
    return run;
  }

  pathFor(id) {
    if (!/^[\w+-]+$/.test(id)) throw new Error(`Invalid run id: ${id}`);
    return path.join(this.dir, `${id}.json`);
  }
}
