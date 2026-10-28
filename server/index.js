// index.js — ResearcherConnect server. Plain node:http (no framework):
// serves the vanilla-JS frontend from public/, exposes a small JSON API, and
// streams pipeline events to the browser over Server-Sent Events.
//
//   npm start                # auto-detects provider (claude-cli on this machine)
//   PROVIDER=demo npm start  # forced offline demo mode
//   PORT=4870 npm start

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { availableProviders, defaultProviderName, PROVIDER_LABELS } from './llm/provider.js';
import { composeDataset, createResearcher, readCustom, writeCustom, METHOD_FAMILIES } from './dataset.js';
import { scoutResearcher } from './agents/scout.js';
import { RunStore } from './store.js';
import { runPipeline, resumePipeline, MODES } from './pipeline.js';
import { JUDGE_PROMPTS, DEFAULT_JUDGE_REPEATS } from './agents/judge.js';
import { candidatePairs, pairBaseline } from './baseline.js';
import { matchRoute } from './router.js';
import { resetState, listArchives, RESET_SCOPES } from './archive.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT ?? 4870);
const TURNS = Number(process.env.TURNS ?? 6);

// --- data -------------------------------------------------------------------
// Seed pool is immutable; user additions/removals live in custom-researchers.json,
// field edits in profile-overrides.json. `dataset` is recomposed in place so
// everything holding a reference (pipeline, candidates) sees changes.
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'researchers.json'), 'utf8'));
const overridesPath = path.join(ROOT, 'data', 'profile-overrides.json');
const customPath = path.join(ROOT, 'data', 'custom-researchers.json');
const dataset = { researchers: [], collaborations: [] };
refreshDataset();

function refreshDataset() {
  const custom = readCustom(customPath);
  const overrides = fs.existsSync(overridesPath) ? JSON.parse(fs.readFileSync(overridesPath, 'utf8')) : {};
  const composed = composeDataset(seed, custom, overrides);
  dataset.researchers.splice(0, dataset.researchers.length, ...composed.researchers);
  dataset.collaborations.splice(0, dataset.collaborations.length, ...composed.collaborations);
}

// --- opportunity triggers (calls for papers, project briefs, research ideas) ---
// The conversation stage is anchored to a trigger: agents assess collaboration
// potential *for a concrete opportunity* rather than inventing research topics.
const triggersPath = path.join(ROOT, 'data', 'triggers.json');
const triggersSeedPath = path.join(__dirname, 'data', 'triggers-seed.json');

/** Reads the triggers, restoring the seed file if it is absent — which is the
 * normal state right after a full reset archives it away. */
function readTriggers() {
  if (!fs.existsSync(triggersPath)) fs.copyFileSync(triggersSeedPath, triggersPath);
  return JSON.parse(fs.readFileSync(triggersPath, 'utf8')).triggers;
}
readTriggers();

const DATA_DIR = path.join(ROOT, 'data');
const store = new RunStore(path.join(DATA_DIR, 'runs'));
const providers = await availableProviders();
const defaultProvider = defaultProviderName(providers);
console.log(
  `ResearcherConnect: providers = [${[...providers.keys()].join(', ')}], default = ${defaultProvider}`,
);

// --- SSE event bus ------------------------------------------------------------
const sseClients = new Set();
function emit(type, payload) {
  const frame = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) res.write(frame);
}

// --- run management ------------------------------------------------------------
const activeRuns = new Set();

function startRun(pair, providerName, trigger, mode = 'conversation', judge = {}) {
  const key = [...pair].sort().join('+');
  if (activeRuns.has(key)) throw new Error('A run for this pair is already in progress');
  const provider = providers.get(providerName);
  activeRuns.add(key);
  const promise = runPipeline({ dataset, pair, provider, store, emit, turns: TURNS, trigger, mode, judge });
  promise.catch((err) => console.error(`Run failed for ${key}:`, err.message));
  promise.finally(() => activeRuns.delete(key));
  return promise;
}

// --- API handlers ---------------------------------------------------------------
const api = {
  'GET /api/state': () => ({
    providers: {
      default: defaultProvider,
      available: [...providers.entries()].map(([name, p]) => ({
        name,
        model: p.model,
        label: PROVIDER_LABELS[name] ?? name,
        judgeModels: p.judgeModels ?? [p.model],
      })),
    },
    modes: MODES,
    judge: {
      repeats: DEFAULT_JUDGE_REPEATS,
      prompts: Object.fromEntries(Object.entries(JUDGE_PROMPTS).map(([k, v]) => [k, v.label])),
    },
    researchers: dataset.researchers,
    collaborations: dataset.collaborations,
    triggers: readTriggers(),
    runs: store.list(),
    archives: listArchives(DATA_DIR),
    activeRuns: [...activeRuns],
    turnsPerConversation: TURNS,
  }),

  'POST /api/reset': (body) => {
    if (activeRuns.size) throw httpError(400, 'A run is in progress — wait for it to finish before resetting');
    const scope = body?.scope ?? 'findings';
    if (!RESET_SCOPES.includes(scope)) {
      throw httpError(400, `Unknown reset scope "${scope}" (use: ${RESET_SCOPES.join(', ')})`);
    }
    const result = resetState({ dataDir: DATA_DIR, scope, note: String(body?.note ?? '').trim() });
    refreshDataset(); // 'all' may have removed pool additions and edits
    emit('state.reset', { scope, ...result });
    return {
      ok: true,
      ...result,
      researchers: dataset.researchers,
      collaborations: dataset.collaborations,
      triggers: readTriggers(),
      runs: store.list(),
      archives: listArchives(DATA_DIR),
    };
  },

  'POST /api/triggers': (body) => {
    const title = String(body?.title ?? '').trim();
    const text = String(body?.text ?? '').trim();
    if (!title || !text) throw httpError(400, 'A trigger needs a title and the opportunity text');
    const triggers = readTriggers();
    const id = `trigger-${Date.now().toString(36)}`;
    const trigger = { id, title, text, addedAt: new Date().toISOString() };
    triggers.push(trigger);
    fs.writeFileSync(triggersPath, JSON.stringify({ triggers }, null, 2));
    emit('trigger.added', { trigger });
    return { ok: true, trigger, triggers };
  },

  'GET /api/candidates': () => ({
    candidates: candidatePairs(dataset.researchers, dataset.collaborations),
  }),

  'GET /api/baseline/:a/:b': (_body, params) => {
    return pairBaseline(dataset.researchers, dataset.collaborations, params.a, params.b);
  },

  'POST /api/runs': async (body) => {
    const pair = body?.pair;
    if (!Array.isArray(pair) || pair.length !== 2 || pair[0] === pair[1]) {
      throw httpError(400, 'Body must be { "pair": [idA, idB] } with two distinct ids');
    }
    const providerName = body.provider ?? defaultProvider;
    if (!providers.has(providerName)) {
      throw httpError(400, `Provider "${providerName}" is not available here. Available: ${[...providers.keys()].join(', ')}`);
    }
    let trigger = null;
    if (body.triggerId) {
      trigger = readTriggers().find((t) => t.id === body.triggerId) ?? null;
      if (!trigger) throw httpError(400, `Unknown trigger: ${body.triggerId}`);
    }
    const mode = body.mode ?? 'conversation';
    if (!MODES.includes(mode)) throw httpError(400, `Unknown mode "${mode}" (use: ${MODES.join(', ')})`);
    const judge = body.judge ?? {};
    if (mode === 'judge') {
      if (judge.variant && !JUDGE_PROMPTS[judge.variant]) {
        throw httpError(400, `Unknown judge prompt "${judge.variant}" (use: ${Object.keys(JUDGE_PROMPTS).join(', ')})`);
      }
      if (judge.repeats != null && !(Number.isInteger(judge.repeats) && judge.repeats >= 1 && judge.repeats <= 50)) {
        throw httpError(400, 'judge.repeats must be an integer from 1 to 50');
      }
      const allowed = providers.get(providerName).judgeModels ?? [];
      for (const m of judge.models ?? []) {
        if (!allowed.includes(m)) throw httpError(400, `Model "${m}" is not offered by provider ${providerName} (use: ${allowed.join(', ')})`);
      }
    }
    const baseline = pairBaseline(dataset.researchers, dataset.collaborations, pair[0], pair[1]);
    startRun(pair, providerName, trigger, mode, judge);
    return { started: true, pair, provider: providerName, trigger: trigger?.id ?? null, mode, baseline };
  },

  'POST /api/researchers/scout': async (body) => {
    const name = String(body?.name ?? '').trim();
    if (!name) throw httpError(400, 'A name is required to research a profile');
    if (!providers.has('claude-cli')) {
      throw httpError(
        400,
        'Profile drafting needs the Claude CLI (it uses live web search). It is not available in this environment — fill the form manually instead.',
      );
    }
    const draft = await scoutResearcher({ name, hints: String(body?.hints ?? '').trim() });
    return { ok: true, draft };
  },

  'POST /api/researchers': (body) => {
    const custom = readCustom(customPath);
    const existingIds = new Set([
      ...seed.researchers.map((r) => r.id),
      ...custom.added.map((r) => r.id),
    ]);
    const researcher = createResearcher(body ?? {}, existingIds);
    custom.added.push(researcher);
    writeCustom(customPath, custom);
    refreshDataset();
    emit('dataset.changed', { action: 'added', id: researcher.id });
    return { ok: true, researcher, researchers: dataset.researchers, collaborations: dataset.collaborations };
  },

  'DELETE /api/researchers/:id': (_body, params) => {
    const { id } = params;
    if (!dataset.researchers.some((r) => r.id === id)) throw httpError(404, 'Researcher not found');
    const custom = readCustom(customPath);
    if (custom.added.some((r) => r.id === id)) {
      custom.added = custom.added.filter((r) => r.id !== id);
    } else {
      custom.removed = [...new Set([...custom.removed, id])]; // tombstone a seed researcher
    }
    writeCustom(customPath, custom);
    refreshDataset();
    emit('dataset.changed', { action: 'removed', id });
    return { ok: true, researchers: dataset.researchers, collaborations: dataset.collaborations };
  },

  'POST /api/runs/:id/resume': (body, params) => {
    const run = store.get(params.id);
    if (!run) throw httpError(404, 'Run not found');
    if (run.status !== 'failed') throw httpError(400, 'Only failed runs can be resumed');
    const key = [...run.pair].sort().join('+');
    if (activeRuns.has(key)) throw httpError(400, 'A run for this pair is already in progress');
    const providerName =
      body?.provider ?? (providers.has(run.provider?.name) ? run.provider.name : defaultProvider);
    if (!providers.has(providerName)) {
      throw httpError(400, `Provider "${providerName}" is not available here`);
    }
    activeRuns.add(key);
    const promise = resumePipeline({
      dataset,
      run,
      provider: providers.get(providerName),
      store,
      emit,
      turns: TURNS,
    });
    promise.catch((err) => console.error(`Resume failed for ${run.id}:`, err.message));
    promise.finally(() => activeRuns.delete(key));
    return { resumed: true, runId: run.id, provider: providerName };
  },

  'POST /api/runs/:id/decision': (body, params) => {
    const { decision, note } = body ?? {};
    if (!['accept', 'decline', 'discuss'].includes(decision)) {
      throw httpError(400, 'decision must be accept | decline | discuss');
    }
    const run = store.recordDecision(params.id, decision, note);
    if (!run) throw httpError(404, 'Run not found');
    emit('run.decision', { runId: run.id, decision: run.decision });
    return { ok: true, run };
  },

  'GET /api/runs/:id': (_body, params) => {
    const run = store.get(params.id);
    if (!run) throw httpError(404, 'Run not found');
    return run;
  },

  'POST /api/researchers/:id': (body, params) => {
    const r = dataset.researchers.find((x) => x.id === params.id);
    if (!r) throw httpError(404, 'Researcher not found');
    const allowed = [
      'title', 'institution', 'unit', 'country', 'seniority', 'field',
      'methods', 'methodFamilies', 'interests', 'reflections',
      'collaborationStyle', 'verified', 'orcid', 'provenance',
    ];
    const update = Object.fromEntries(Object.entries(body ?? {}).filter(([k, v]) => allowed.includes(k) && v !== undefined));
    if ('seniority' in update) update.seniority = Math.min(4, Math.max(1, Number(update.seniority) || r.seniority));
    if ('methodFamilies' in update) {
      update.methodFamilies = (Array.isArray(update.methodFamilies) ? update.methodFamilies : [])
        .filter((f) => METHOD_FAMILIES.includes(f))
        .sort(); // canonical order: a reordering is not a change
    }
    // Record only genuine corrections: an override that matches the underlying
    // seed/added record is noise, and makes profile-overrides.json harder to
    // read as "what did a human actually change?".
    const custom = readCustom(customPath);
    const base =
      custom.added.find((x) => x.id === r.id) ?? seed.researchers.find((x) => x.id === r.id) ?? {};
    const overrides = fs.existsSync(overridesPath) ? JSON.parse(fs.readFileSync(overridesPath, 'utf8')) : {};
    // order-insensitive for lists: reordering method families is not an edit
    const canonical = (v) => JSON.stringify(Array.isArray(v) ? [...v].sort() : v);
    const merged = { ...(overrides[r.id] ?? {}), ...update };
    const deltas = Object.fromEntries(
      Object.entries(merged).filter(([k, v]) => canonical(v) !== canonical(base[k])),
    );
    if (Object.keys(deltas).length) overrides[r.id] = deltas;
    else delete overrides[r.id];
    fs.writeFileSync(overridesPath, JSON.stringify(overrides, null, 2));

    Object.assign(r, update);
    emit('researcher.updated', { researcher: r });
    return { ok: true, researcher: r };
  },
};

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// --- static files -----------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

function serveStatic(res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found');
  }
  const ext = path.extname(file);
  res.writeHead(200, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Cache-Control': 'no-cache', // stale ES-module caching is the #1 vanilla-app trap
  });
  fs.createReadStream(file).pipe(res);
}

// --- server ---------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(`event: hello\ndata: ${JSON.stringify({ providers: [...providers.keys()] })}\n\n`);
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    try {
      const route = matchRoute(api, req.method, url.pathname);
      if (!route) throw httpError(404, 'No such endpoint');
      const body = req.method === 'POST' ? await readJson(req) : null;
      const result = await route.handler(body, route.params);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(err.status ?? 500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  return serveStatic(res, url.pathname);
});

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1e6) reject(httpError(413, 'Body too large'));
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : null);
      } catch {
        reject(httpError(400, 'Invalid JSON body'));
      }
    });
  });
}

// SSE heartbeat so proxies don't drop idle connections
setInterval(() => emit('ping', { at: Date.now() }), 25_000);

server.listen(PORT, () => {
  console.log(`ResearcherConnect running at http://localhost:${PORT}`);
});
