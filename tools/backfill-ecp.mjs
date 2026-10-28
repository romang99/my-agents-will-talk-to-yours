// One-time migration: write `ecp` into run records saved before ECP existed.
// Run once with `node tools/backfill-ecp.mjs`; it is idempotent.
//
// Why a migration rather than computing ECP in the browser: the number shown in
// the UI must be the number stored in the provenance file. One implementation
// (server/baseline.js#ecpFromBrief), one recorded value, nothing to reconcile.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ecpFromBrief, classify } from '../server/baseline.js';

const runsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'runs');
let written = 0;
let reclassified = 0;

for (const file of fs.readdirSync(runsDir).filter((f) => f.endsWith('.json'))) {
  const p = path.join(runsDir, file);
  const run = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!run.opportunity || typeof run.ecp === 'number') continue;

  run.ecp = ecpFromBrief(run.opportunity);
  const classification = classify(run.baseline.composite, run.ecp);
  if (classification !== run.classification) {
    run.log.push({
      at: new Date().toISOString(),
      msg: `Backfill: ECP ${run.ecp}; classification ${run.classification} → ${classification} under current thresholds`,
    });
    run.classification = classification;
    reclassified++;
  } else {
    run.log.push({ at: new Date().toISOString(), msg: `Backfill: ECP ${run.ecp} (classification unchanged)` });
  }
  fs.writeFileSync(p, JSON.stringify(run, null, 2));
  written++;
}

console.log(`Backfilled ECP into ${written} run(s); ${reclassified} reclassified.`);
