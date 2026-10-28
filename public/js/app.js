// app.js — bootstrap and state. Wires the API + SSE stream to the star chart,
// probe queue, conversation theater, opportunity briefs, and dashboard.

import { api, subscribe } from './api.js';
import { createGraph } from './graph.js';
import { createTheater } from './theater.js';
import { createTally } from './tally.js';
import { initRail } from './rail.js';
import {
  renderCandidates,
  researcherCard,
  researcherEditor,
  researcherForm,
  triggerForm,
  pairPanel,
  guideContent,
  runView,
  renderDashboard,
  pairKey,
  classBadge,
  toast,
  esc,
} from './ui.js';

const els = {
  rail: document.getElementById('rail'),
  provider: document.getElementById('provider-badge'),
  candidates: document.getElementById('candidate-list'),
  addResearcher: document.getElementById('add-researcher'),
  guideBtn: document.getElementById('guide-btn'),
  addTrigger: document.getElementById('add-trigger'),
  triggerSelect: document.getElementById('trigger-select'),
  focusSelect: document.getElementById('focus-select'),
  dockProvider: document.getElementById('pair-dock-provider'),
  dockMode: document.getElementById('pair-dock-mode'),
  canvas: document.getElementById('network'),
  tip: document.getElementById('node-tip'),
  dock: document.getElementById('pair-dock'),
  dockLabel: document.getElementById('pair-dock-label'),
  dockRun: document.getElementById('pair-dock-run'),
  dockClear: document.getElementById('pair-dock-clear'),
  hint: document.getElementById('stage-hint'),
  inspector: document.getElementById('inspector'),
  inspectorTitle: document.getElementById('inspector-title'),
  inspectorBody: document.getElementById('inspector-body'),
  inspectorClose: document.getElementById('inspector-close'),
  dashboard: document.getElementById('dashboard'),
  toast: document.getElementById('toast'),
};

const state = {
  researchers: [],
  byId: {},
  collaborations: [],
  candidates: [],
  runs: [],
  runsByPair: new Map(),
  selection: [],
  activeRun: null, // { id, pair }
  theater: null, // live view, conversation mode
  tally: null, // live view, judge mode
  selectedMode: 'conversation', // 'conversation' | 'judge:<variant>'
};

const rail = initRail(els.rail);
const graph = createGraph(els.canvas, {
  onNodeClick: handleNodeClick,
  onHover: handleHover,
});

// ---------- boot ----------
async function boot() {
  const s = await api.state();
  state.runs = s.runs;
  state.archives = s.archives ?? [];
  indexRuns();

  state.triggers = s.triggers ?? [];
  state.selectedTrigger = localStorage.getItem('rc-trigger') ?? state.triggers[0]?.id ?? '';
  refreshTriggerSelect(); // reconciles a stale saved id against what still exists

  state.providers = s.providers.available;
  const saved = localStorage.getItem('rc-provider');
  state.selectedProvider = state.providers.some((p) => p.name === saved) ? saved : s.providers.default;
  els.dockProvider.innerHTML = state.providers
    .map((p) => `<option value="${esc(p.name)}" ${p.name === state.selectedProvider ? 'selected' : ''}>${esc(p.label)}</option>`)
    .join('');
  updateProviderBadge();

  const savedMode = localStorage.getItem('rc-mode');
  state.selectedMode = [...els.dockMode.options].some((o) => o.value === savedMode) ? savedMode : 'conversation';
  els.dockMode.value = state.selectedMode;

  applyDataset(s.researchers, s.collaborations);
}

/** The dock's mode value split into what the API takes. */
function runRequest() {
  const [mode, variant] = state.selectedMode.split(':');
  return { mode, judge: variant ? { variant } : undefined };
}

function updateProviderBadge() {
  const p = state.providers.find((x) => x.name === state.selectedProvider);
  els.provider.textContent = p ? `${p.name} · ${p.model}` : '';
  els.provider.title = `Runs use: ${p?.label ?? ''}. Available: ${state.providers.map((x) => x.name).join(', ')}`;
}

// The one place where the dropdown and `state.selectedTrigger` are reconciled.
// A selected trigger can vanish underneath us — a full reset archives the custom
// ones — and a dock holding an archived id would post it and get "Unknown
// trigger". Every caller (boot, reset, the SSE handler) gets the check for free.
// An empty selection means "open exploration" and is legitimately not in the list.
function refreshTriggerSelect() {
  if (state.selectedTrigger && !state.triggers.some((t) => t.id === state.selectedTrigger)) {
    state.selectedTrigger = state.triggers[0]?.id ?? '';
    localStorage.setItem('rc-trigger', state.selectedTrigger);
  }
  els.triggerSelect.innerHTML = [
    ...state.triggers.map(
      (t) => `<option value="${esc(t.id)}" ${t.id === state.selectedTrigger ? 'selected' : ''}>${esc(t.title)}</option>`,
    ),
    `<option value="" ${state.selectedTrigger === '' ? 'selected' : ''}>None — open exploration</option>`,
  ].join('');
}

function refreshFocusSelect() {
  const current = state.focus ?? '';
  els.focusSelect.innerHTML = [
    '<option value="">All pairs</option>',
    ...state.researchers.map(
      (r) => `<option value="${esc(r.id)}" ${r.id === current ? 'selected' : ''}>From ${esc(r.name)}</option>`,
    ),
  ].join('');
}

async function applyDataset(researchers, collaborations) {
  state.researchers = researchers;
  state.byId = Object.fromEntries(researchers.map((r) => [r.id, r]));
  state.collaborations = collaborations;
  state.selection = state.selection.filter((id) => state.byId[id]);
  graph.setData(researchers, collaborations);
  graph.setSelection(state.selection);
  syncOverlays();
  updateDock();
  refreshFocusSelect();
  const c = await api.candidates();
  state.candidates = c.candidates;
  refreshCandidates();
}

function indexRuns() {
  state.runsByPair = new Map();
  for (const run of [...state.runs].reverse()) state.runsByPair.set(pairKey(run.pair), run);
}

/**
 * Adopt server state after a reset — used both by the client that pressed the
 * button and by every other client via the `state.reset` event, so they cannot
 * drift apart. Closes the inspector because whatever it was showing (an archived
 * run's brief, with live decision buttons) no longer exists.
 */
async function adoptResetState(s) {
  state.runs = s.runs;
  state.archives = s.archives ?? [];
  state.triggers = s.triggers ?? [];
  indexRuns();
  refreshTriggerSelect();
  els.inspector.hidden = true;
  await applyDataset(s.researchers, s.collaborations); // prunes a stale selection

  renderDashboard(els.dashboard, state.runs, state.byId, state.archives);
}

function syncOverlays() {
  graph.setOverlays(
    [...state.runsByPair.values()]
      .filter((r) => r.classification && r.classification !== 'none')
      .map((r) => ({ pair: r.pair, classification: r.classification })),
  );
}

function refreshCandidates() {
  const candidates = state.focus
    ? state.candidates.filter((c) => c.pair.includes(state.focus))
    : state.candidates;
  renderCandidates(
    els.candidates,
    candidates,
    state.byId,
    state.runsByPair,
    state.selection.length === 2 ? pairKey(state.selection) : null,
  );
}

// ---------- selection ----------
function handleNodeClick(r) {
  if (state.selection.includes(r.id)) {
    state.selection = state.selection.filter((id) => id !== r.id);
  } else {
    state.selection = [...state.selection, r.id].slice(-2);
  }
  graph.setSelection(state.selection);
  updateDock();
  if (state.selection.length === 1) openResearcher(r);
  if (state.selection.length === 2) openPairPanel(state.selection);
  refreshCandidates();
}

async function openPairPanel(pair) {
  // an existing run is more informative than the bare baseline
  const existing = state.runsByPair.get(pairKey(pair));
  if (existing) {
    openRunBrief(existing);
    return;
  }
  try {
    const baseline = await api.pairBaseline(pair[0], pair[1]);
    const [a, b] = pair.map((id) => state.byId[id]);
    openInspector('Pair baseline', pairPanel(a, b, baseline));
  } catch (err) {
    console.error(err);
  }
}

function selectPair(pair) {
  state.selection = [...pair];
  graph.setSelection(state.selection);
  updateDock();
  refreshCandidates();
}

function updateDock() {
  if (state.selection.length === 2) {
    const [a, b] = state.selection.map((id) => state.byId[id]);
    els.dockLabel.textContent = `${a.name} × ${b.name}`;
    const existing = state.runsByPair.get(pairKey(state.selection));
    const label = runRequest().mode === 'judge' ? 'Ask the judges' : 'Let the agents talk';
    els.dockRun.textContent = existing ? `Probe again — ${label.toLowerCase()}` : label;
    els.dock.hidden = false;
    els.hint.classList.add('is-hidden');
  } else {
    els.dock.hidden = true;
    els.hint.classList.toggle('is-hidden', state.runs.length > 0);
  }
}

function handleHover(hover) {
  if (!hover) {
    els.tip.hidden = true;
    return;
  }
  const r = hover.researcher;
  els.tip.innerHTML = `
    <div class="tip-name">${esc(r.name)}</div>
    <div class="tip-field">${esc(r.field)}</div>
    ${r.synthetic ? '<div class="tip-synth">synthetic persona</div>' : '<div class="tip-synth" style="color:var(--amber)">real researcher</div>'}`;
  els.tip.hidden = false;
  const rect = els.canvas.getBoundingClientRect();
  els.tip.style.left = `${Math.min(hover.x + 18, rect.width - 270)}px`;
  els.tip.style.top = `${hover.y + 18}px`;
}

// ---------- inspector ----------
function openInspector(title, html) {
  els.inspectorTitle.textContent = title;
  els.inspectorBody.innerHTML = html;
  els.inspector.hidden = false;
}

function openResearcher(r) {
  openInspector(r.name, researcherCard(r));
}

function openRunBrief(run, tab = 'brief') {
  const names = run.pair.map((id) => state.byId[id]?.name.split(' ').at(-1) ?? id).join(' × ');
  openInspector(names, runView(run, state.byId, tab));
}

els.inspectorClose.addEventListener('click', () => (els.inspector.hidden = true));

// ---------- runs ----------
els.dockRun.addEventListener('click', async () => {
  if (state.selection.length !== 2) return;
  try {
    els.dockRun.disabled = true;
    const { mode, judge } = runRequest();
    await api.startRun(state.selection, state.selectedProvider, state.selectedTrigger || null, mode, judge);
  } catch (err) {
    toast(els.toast, `<strong>Could not start:</strong> ${esc(err.message)}`);
    els.dockRun.disabled = false;
  }
});

els.dockMode.addEventListener('change', () => {
  state.selectedMode = els.dockMode.value;
  localStorage.setItem('rc-mode', state.selectedMode);
  updateDock();
});

els.dockProvider.addEventListener('change', () => {
  state.selectedProvider = els.dockProvider.value;
  localStorage.setItem('rc-provider', state.selectedProvider);
  updateProviderBadge();
});

els.addResearcher.addEventListener('click', () => {
  openInspector('Add researcher', researcherForm());
});

els.guideBtn.addEventListener('click', () => {
  openInspector('How ResearcherConnect works', guideContent());
});

els.addTrigger.addEventListener('click', () => {
  openInspector('New opportunity trigger', triggerForm());
});

els.triggerSelect.addEventListener('change', () => {
  state.selectedTrigger = els.triggerSelect.value;
  localStorage.setItem('rc-trigger', state.selectedTrigger);
});

els.focusSelect.addEventListener('change', () => {
  state.focus = els.focusSelect.value || null;
  refreshCandidates();
});

els.dockClear.addEventListener('click', () => {
  state.selection = [];
  graph.setSelection([]);
  updateDock();
  refreshCandidates();
});

els.candidates.addEventListener('click', (e) => {
  const btn = e.target.closest('.candidate');
  if (!btn) return;
  const pair = btn.dataset.pair.split('|');
  selectPair(pair);
  // probed pairs open their run; unprobed pairs show the baseline breakdown
  openPairPanel(pair);
});


// ---------- form helpers (one implementation, used by every form) ----------
/** Read a form's fields by their data-field names. `listFields` are split on newlines. */
function readForm(form, fields, listFields = []) {
  const out = {};
  for (const f of fields) {
    const el = form.querySelector(`[data-field="${f}"]`);
    if (!el) continue;
    if (el.type === 'checkbox') out[f] = el.checked;
    else if (listFields.includes(f)) out[f] = el.value.split('\n').map((s) => s.trim()).filter(Boolean);
    else out[f] = el.value.trim();
  }
  out.methodFamilies = [...form.querySelectorAll('[data-family]:checked')].map((el) => el.dataset.family);
  return out;
}

/** Fill a form from a scout draft and stash its provenance for the eventual save. */
function fillFormFromDraft(form, draft) {
  const set = (f, v) => {
    const el = form.querySelector(`[data-field="${f}"]`);
    if (el && v?.length) el.value = Array.isArray(v) ? v.join('\n') : v;
  };
  for (const f of ['name', 'title', 'institution', 'unit', 'country', 'field',
                   'methods', 'interests', 'reflections', 'collaborationStyle']) {
    set(f, draft[f]);
  }
  const seniority = form.querySelector('[data-field="seniority"]');
  if (seniority) seniority.value = String(draft.seniority);
  if (draft.methodFamilies?.length) {
    for (const el of form.querySelectorAll('[data-family]')) {
      el.checked = draft.methodFamilies.includes(el.dataset.family);
    }
  }
  // a web draft describes a real person, and is not their own word
  const synthetic = form.querySelector('[data-field="synthetic"]');
  if (synthetic) synthetic.checked = false;
  const verified = form.querySelector('[data-field="verified"]');
  if (verified) verified.checked = false;

  form.dataset.provenance = JSON.stringify({
    draftedBy: 'AI web scout (claude-cli)',
    sources: draft.sources,
    notes: draft.notes,
    at: new Date().toISOString(),
  });
  if (draft.orcid) form.dataset.orcid = draft.orcid;
}

/** Run the scout for `name` and fill `form`, reporting progress into `status`. */
async function scoutInto(form, status, button, name, hints) {
  if (!name) {
    status.textContent = 'Type the researcher\u2019s name first.';
    return;
  }
  button.disabled = true;
  status.textContent = 'Researching on the live web — this takes a few minutes…';
  try {
    const { draft } = await api.scoutResearcher(name, hints);
    fillFormFromDraft(form, draft);
    status.innerHTML = `Draft ready — <strong>review before saving</strong>. ${draft.sources.length} sources${draft.notes ? ` · note: ${esc(draft.notes)}` : ''}`;
  } catch (err) {
    status.textContent = `Could not research: ${err.message}`;
  } finally {
    button.disabled = false;
  }
}

// ---------- delegated click actions ----------
// One named function per interactive control, keyed by the data attribute that
// marks the control in the HTML (`data-save-researcher` → `saveResearcher`).
// To find what a button does: read its data attribute, then this table.
// Each handler receives (element, attributeValue).
const clickActions = {
  // --- runs -------------------------------------------------------------
  async decision(el) {
    const runId = el.closest('[data-run]').dataset.run;
    try {
      const { run } = await api.decide(runId, el.dataset.decision);
      upsertRun(run);
      openRunBrief(run);
      renderDashboard(els.dashboard, state.runs, state.byId, state.archives);
    } catch (err) {
      // A validation recorded against nothing is worse than a visible failure —
      // e.g. deciding on a run that a reset has since archived.
      toast(els.toast, `<strong>Could not record that:</strong> ${esc(err.message)}`);
    }
  },

  openRun(_el, runId) {
    const run = state.runs.find((r) => r.id === runId);
    if (!run) return;
    switchView('observatory');
    openRunBrief(run);
  },

  runTab(el, tab) {
    const runId = el.closest('[data-run-id]').dataset.runId;
    const run = state.runs.find((r) => r.id === runId);
    if (run) openRunBrief(run, tab);
  },

  async resumeRun(el, runId) {
    try {
      el.disabled = true;
      await api.resumeRun(runId); // server defaults to the run's original provider
      toast(els.toast, 'Resuming the run from its last completed step…');
    } catch (err) {
      el.disabled = false;
      toast(els.toast, `<strong>Could not resume:</strong> ${esc(err.message)}`);
    }
  },

  // --- researchers ------------------------------------------------------
  editResearcher(_el, id) {
    const r = state.byId[id];
    if (r) openInspector(`${r.name} — edit`, researcherEditor(r));
  },

  cancelEdit(_el, id) {
    const r = state.byId[id];
    if (r) openResearcher(r);
  },

  async saveResearcher(el, id) {
    const form = el.closest('[data-researcher]');
    try {
      el.disabled = true;
      const fields = readForm(
        form,
        ['title', 'institution', 'unit', 'country', 'seniority', 'field',
         'methods', 'interests', 'reflections', 'collaborationStyle', 'verified'],
        ['methods', 'interests', 'reflections'],
      );
      const { researcher } = await api.updateResearcher(id, {
        ...fields,
        ...(form.dataset.provenance ? { provenance: JSON.parse(form.dataset.provenance) } : {}),
        ...(form.dataset.orcid ? { orcid: form.dataset.orcid } : {}),
      });
      Object.assign(state.byId[id], researcher);
      // affiliation and methods move baseline predictability — re-rank the queue
      state.candidates = (await api.candidates()).candidates;
      refreshCandidates();
      openResearcher(state.byId[id]);
      toast(els.toast, `Representation saved for <strong>${esc(researcher.name)}</strong>${fields.verified ? ' and marked verified' : ' (still awaiting their own verification)'}. Future conversations use the corrected mind.`);
    } catch (err) {
      el.disabled = false;
      toast(els.toast, `<strong>Could not save:</strong> ${esc(err.message)}`);
    }
  },

  async removeResearcher(_el, id) {
    const r = state.byId[id];
    if (!r) return;
    const ok = window.confirm(
      `Remove ${r.name} from the pool?\n\nPast runs keep their records (provenance is never deleted). Seed researchers can be restored by editing data/custom-researchers.json.`,
    );
    if (!ok) return;
    try {
      const res = await api.deleteResearcher(id);
      els.inspector.hidden = true;
      await applyDataset(res.researchers, res.collaborations);
      renderDashboard(els.dashboard, state.runs, state.byId, state.archives);
      toast(els.toast, `Removed <strong>${esc(r.name)}</strong> from the pool.`);
    } catch (err) {
      toast(els.toast, `<strong>Could not remove:</strong> ${esc(err.message)}`);
    }
  },

  async createResearcher(el) {
    const form = el.closest('[data-new-researcher]');
    const payload = {
      ...readForm(
        form,
        ['name', 'synthetic', 'title', 'institution', 'unit', 'country', 'seniority', 'field',
         'methods', 'interests', 'reflections', 'collaborationStyle'],
        ['methods', 'interests', 'reflections'],
      ),
      provenance: form.dataset.provenance ? JSON.parse(form.dataset.provenance) : undefined,
    };
    if (!payload.name || !payload.field || payload.interests.length === 0) {
      toast(els.toast, '<strong>Missing details:</strong> name, field, and at least one interest are required.');
      return;
    }
    try {
      el.disabled = true;
      const res = await api.createResearcher(payload);
      await applyDataset(res.researchers, res.collaborations);
      openResearcher(state.byId[res.researcher.id]);
      toast(els.toast, `<strong>${esc(res.researcher.name)}</strong> added to the chart — unconnected, so they'll appear near the top of the probe queue.`);
    } catch (err) {
      el.disabled = false;
      toast(els.toast, `<strong>Could not add:</strong> ${esc(err.message)}`);
    }
  },

  // --- the AI profile scout (same helper for a new and an existing profile) --
  async scout(el) {
    const form = el.closest('[data-new-researcher]');
    const read = (f) => form.querySelector(`[data-field="${f}"]`).value.trim();
    const hints = [read('institution'), read('unit'), read('field')].filter(Boolean).join(', ');
    await scoutInto(form, form.querySelector('[data-scout-status]'), el, read('name'), hints);
  },

  async scoutExisting(el, id) {
    const r = state.byId[id];
    const form = el.closest('[data-researcher]');
    const hints = [r.institution, r.unit, r.field].filter(Boolean).join(', ');
    await scoutInto(form, form.querySelector('[data-scout-status]'), el, r.name, hints);
  },

  // --- triggers ---------------------------------------------------------
  async createTrigger(el) {
    const form = el.closest('[data-new-trigger]');
    const { title, text } = readForm(form, ['title', 'text']);
    if (!title || !text) {
      toast(els.toast, '<strong>Missing details:</strong> the trigger needs a title and the opportunity text.');
      return;
    }
    try {
      el.disabled = true;
      const res = await api.createTrigger({ title, text });
      state.triggers = res.triggers;
      state.selectedTrigger = res.trigger.id;
      localStorage.setItem('rc-trigger', state.selectedTrigger);
      refreshTriggerSelect();
      els.inspector.hidden = true;
      toast(els.toast, `Trigger saved and selected: <strong>${esc(res.trigger.title)}</strong>. New conversations will assess collaboration potential for it.`);
    } catch (err) {
      el.disabled = false;
      toast(els.toast, `<strong>Could not save:</strong> ${esc(err.message)}`);
    }
  },

  cancelAdd() {
    els.inspector.hidden = true;
  },

  async reset(el, scope) {
    const what = scope === 'all'
      ? 'ALL runs, researcher additions and edits, and custom triggers'
      : `all ${state.runs.length} run(s)`;
    if (!window.confirm(`Archive ${what}?\n\nNothing is deleted — it moves to data/archive/<timestamp>/ with a manifest, and stays readable.`)) return;
    try {
      el.disabled = true;
      const res = await api.reset(scope);
      await adoptResetState(res);
      toast(els.toast, res.archived
        ? `Archived to <code>${esc(res.archiveDir.split('/').pop())}</code> — ${esc(res.moved.join(', '))}. Fresh experiment ready.`
        : 'Nothing to archive — already clear.');
    } catch (err) {
      el.disabled = false;
      toast(els.toast, `<strong>Could not reset:</strong> ${esc(err.message)}`);
    }
  },
};

// Dispatch: walk up from the click target and fire the first element carrying a
// known action attribute. Innermost control wins; the order of `clickActions`
// is irrelevant.
document.addEventListener('click', async (e) => {
  for (let el = e.target; el instanceof Element; el = el.parentElement) {
    for (const [action, handler] of Object.entries(clickActions)) {
      if (action in el.dataset) {
        await handler(el, el.dataset[action]);
        return;
      }
    }
  }
});

function upsertRun(run) {
  const idx = state.runs.findIndex((r) => r.id === run.id);
  if (idx >= 0) state.runs[idx] = run;
  else state.runs.unshift(run);
  indexRuns();
}

/** Open the live view for a starting or resuming run — theater or tally by mode. */
function openLiveView(p) {
  els.inspectorBody.innerHTML = '';
  els.inspector.hidden = false;
  state.theater = null;
  state.tally = null;
  if ((p.mode ?? 'conversation') === 'judge') {
    els.inspectorTitle.textContent = 'Judges voting';
    state.tally = createTally(els.inspectorBody, {
      judge: p.judge, providerName: p.provider?.name, trigger: p.trigger, judgments: p.judgments ?? [],
    });
  } else {
    els.inspectorTitle.textContent = 'Conversation theater';
    state.theater = createTheater(els.inspectorBody, p.pair, p.provider?.name, p.trigger);
    for (const turn of p.transcript ?? []) state.theater.addTurn(turn, { instant: true });
    state.theater.setTyping(true);
  }
}

// ---------- SSE ----------
subscribe({
  'run.started': (p) => {
    state.activeRun = { id: p.runId, pair: p.pair };
    graph.setActivePair(p.pair);
    selectPair(p.pair);
    els.dock.hidden = true;
    rail.setMode(p.mode ?? 'conversation');
    rail.setStage('baseline');
    openLiveView(p);
  },
  'run.vote': (p) => {
    if (p.runId !== state.activeRun?.id) return;
    state.tally?.addVote(p);
  },
  'run.stage': (p) => {
    if (p.runId !== state.activeRun?.id) return;
    rail.setStage(p.stage);
  },
  'run.turn': async (p) => {
    if (p.runId !== state.activeRun?.id || !state.theater) return;
    state.theater.setTyping(false);
    await state.theater.addTurn(p.turn);
    state.theater.setTyping(true);
  },
  'run.completed': async (p) => {
    const run = await api.getRun(p.runId);
    upsertRun(run);
    graph.setActivePair(null);
    graph.addOverlay(run.pair, run.classification);
    rail.setStage('validation');
    state.theater?.finish();
    state.tally?.finish();
    openRunBrief(run);
    refreshCandidates();
    renderDashboard(els.dashboard, state.runs, state.byId, state.archives);
    els.dockRun.disabled = false;
    state.activeRun = null;
    const names = run.pair.map((id) => state.byId[id]?.name.split(' ').at(-1)).join(' × ');
    if (run.classification === 'latent') {
      toast(els.toast, `✦ New constellation line: <strong>${esc(names)}</strong> — ${classBadge('latent')}. Tie-formation theory would not have predicted this pair.`);
    } else if (run.classification === 'none') {
      const who = run.mode === 'judge' ? 'Every judge voted against' : 'The agents honestly found no basis for';
      toast(els.toast, `${who} <strong>${esc(names)}</strong> — a negative result, recorded.`);
    } else {
      toast(els.toast, `${run.mode === 'judge' ? 'Judges have voted on' : 'Opportunity constructed for'} <strong>${esc(names)}</strong> — ${classBadge(run.classification)}.`);
    }
    setTimeout(() => rail.clear(), 4000);
  },
  'run.failed': async (p) => {
    graph.setActivePair(null);
    rail.clear();
    state.theater?.finish();
    state.tally?.finish();
    els.dockRun.disabled = false;
    state.activeRun = null;
    const run = await api.getRun(p.runId).catch(() => null);
    if (run) {
      upsertRun(run);
      openRunBrief(run); // shows the error and the Resume button
    } else {
      els.inspectorBody.insertAdjacentHTML(
        'beforeend',
        `<div class="error-box">Run failed during ${esc(p.stage)}: ${esc(p.error)}</div>`,
      );
    }
    toast(els.toast, `<strong>Run failed</strong> during ${esc(p.stage)} — completed work is saved; use <em>Resume run</em> to continue.`);
  },
  'run.resumed': (p) => {
    state.activeRun = { id: p.runId, pair: p.pair };
    graph.setActivePair(p.pair);
    selectPair(p.pair);
    els.dock.hidden = true;
    rail.setMode(p.mode ?? 'conversation');
    openLiveView(p);
  },
  'state.reset': async () => adoptResetState(await api.state()),
  'run.decision': async (p) => {
    const run = await api.getRun(p.runId).catch(() => null);
    if (run) {
      upsertRun(run);
      renderDashboard(els.dashboard, state.runs, state.byId, state.archives);
    }
  },
});

// ---------- view switching ----------
function switchView(name) {
  for (const tab of document.querySelectorAll('.view-tab')) {
    const active = tab.dataset.view === name;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  }
  document.getElementById('view-observatory').classList.toggle('is-active', name === 'observatory');
  document.getElementById('view-dashboard').classList.toggle('is-active', name === 'dashboard');
  if (name === 'dashboard') renderDashboard(els.dashboard, state.runs, state.byId, state.archives);
}

for (const tab of document.querySelectorAll('.view-tab')) {
  tab.addEventListener('click', () => switchView(tab.dataset.view));
}

// first visit: open the guide once
if (!localStorage.getItem('rc-guide-seen')) {
  localStorage.setItem('rc-guide-seen', '1');
  setTimeout(() => openInspector('How ResearcherConnect works', guideContent()), 600);
}

boot().catch((err) => {
  toast(els.toast, `<strong>Failed to load:</strong> ${esc(err.message)}`);
  console.error(err);
});
