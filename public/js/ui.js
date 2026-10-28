// ui.js — rendering for the probe queue, researcher cards, opportunity briefs,
// and the findings dashboard. Pure render functions; wiring lives in app.js.

const CLASS_LABEL = {
  latent: 'Latent opportunity',
  borderline: 'Borderline',
  predicted: 'Structurally predicted',
  none: 'No viable basis',
};
const CLASS_COLOR = {
  latent: 'var(--latent-glow)',
  borderline: 'var(--borderline-glow)',
  predicted: 'var(--predicted-glow)',
  none: 'var(--none)',
};
const MECH_LABEL = {
  organisationalFoci: 'Organisational foci',
  homophily: 'Status & value homophily',
  cumulativeAdvantage: 'Cumulative advantage',
  triadicClosure: 'Triadic closure',
};

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function classBadge(classification) {
  return `<span class="badge badge-${classification}">${CLASS_LABEL[classification] ?? classification}</span>`;
}

// ---------- probe queue ----------
/** How many queue rows to render. The queue is sorted ascending by
 * predictability, so these are the most informative pairs to probe — but the
 * count of what is NOT shown is always displayed, never silently dropped. */
const QUEUE_ROWS = 12;

export function renderCandidates(el, candidates, byId, runsByPair, selectedKey) {
  el.innerHTML = candidates
    .slice(0, QUEUE_ROWS)
    .map((c) => {
      const [aId, bId] = c.pair;
      const key = pairKey(c.pair);
      const done = runsByPair.get(key);
      const pct = Math.round(c.composite * 100);
      return `
        <li>
          <button class="candidate ${key === selectedKey ? 'is-selected' : ''}" data-pair="${aId}|${bId}">
            <span class="names">${esc(shortName(byId[aId]?.name))} × ${esc(shortName(byId[bId]?.name))}</span>
            <span class="meter"><i style="width:${pct}%"></i></span>
            <span class="meta">predictability ${c.composite.toFixed(2)}${done ? ` · <span class="flag-done">→ ${done.classification ?? done.status}${hasOutcome(done) ? ` · ECP ${runEcp(done).toFixed(2)}` : ''}</span>` : ''}</span>
          </button>
        </li>`;
    })
    .join('')
    + (candidates.length > QUEUE_ROWS
      ? `<li class="queue-more">Showing the ${QUEUE_ROWS} least predictable of ${candidates.length} unconnected pairs. Use “From …” to focus on one researcher, or click two stars for any pair.</li>`
      : `<li class="queue-more">All ${candidates.length} unconnected pair${candidates.length === 1 ? '' : 's'} shown.</li>`);
}

/**
 * ECP as recorded on the run. The formula lives server-side in
 * baseline.js#ecpFromBrief and nowhere else — the UI only ever displays the
 * stored value, so what you see equals what is in the provenance file.
 * (Runs predating ECP were backfilled by tools/backfill-ecp.mjs.)
 */
export function runEcp(run) {
  return typeof run.ecp === 'number' ? run.ecp : 0;
}

/** Runs predating modes are conversation runs. */
export function runMode(run) {
  return run.mode ?? 'conversation';
}

/** Did Step 3 recommend connecting? Conversation: the brief's viability.
 * Judge: a majority of votes. This is the display rule the decision buttons and
 * the Findings table key off — the study classification is classify() server-side. */
export function machineSaysConnect(run) {
  return runMode(run) === 'judge' ? runEcp(run) >= 0.5 : Boolean(run.opportunity?.viable);
}

/** One-line headline for a run wherever runs are listed. */
export function runTitle(run) {
  if (runMode(run) === 'judge') {
    const votes = (run.judgments ?? []).flatMap((j) => j.votes);
    if (!votes.length) return '(no votes yet)';
    const yes = votes.filter((v) => v.vote === 1).length;
    return `${yes} of ${votes.length} judge votes to connect`;
  }
  return run.opportunity?.title ?? '(failed)';
}

/** Has Step 3 produced a judgment this run can be plotted and counted on? */
function hasOutcome(run) {
  return runMode(run) === 'judge' ? typeof run.ecp === 'number' : Boolean(run.opportunity);
}

// ---------- pair baseline panel (explainability for the predictability number) ----------
const MECH_PLAIN = {
  organisationalFoci: 'People form ties when shared settings bring them together.',
  homophily: 'People connect with others of similar standing and orientation.',
  cumulativeAdvantage: 'Well-connected researchers attract further ties.',
  triadicClosure: 'People connect when they share existing contacts.',
};

export function pairPanel(a, b, baseline) {
  const rows = (baseline.breakdown ?? [])
    .map(
      (m) => `
      <div class="mech">
        <div class="mech-head"><span>${esc(MECH_LABEL[m.mechanism] ?? m.mechanism)}</span><span>${m.score.toFixed(2)} × w${m.weight.toFixed(2)} = ${m.contribution.toFixed(2)}</span></div>
        <div class="bar"><i style="width:${Math.round(m.score * 100)}%"></i></div>
        <span class="quiet">${esc(MECH_PLAIN[m.mechanism] ?? '')}</span><br>
        ${esc(m.inputs)}
      </div>`,
    )
    .join('');
  return `
    <div class="opp">
      <p class="opp-title">${esc(a.name)} × ${esc(b.name)}</p>
      <p class="quiet">${baseline.existingTie ? 'These two already collaborate — an established tie.' : 'No existing tie between these two.'}</p>
      <div class="scores">
        ${scoreTile(baseline.composite.toFixed(2), 'Predictability', true)}
      </div>
      <h3>How this number is computed</h3>
      <p class="quiet">Structural predictability = how strongly the four classical tie-formation mechanisms (Dahlander &amp; McFarland 2013) would predict a tie between these two. 0 = classical theory predicts nothing; 1 = fully expected. Weighted sum of:</p>
      <div class="mechanisms">${rows}</div>
      <p class="formula">${esc(baseline.formula ?? '')}</p>
      <p class="quiet">Low predictability is where probing is most informative: if the agents find high collaboration potential (ECP) where structure predicts nothing, that is a candidate <em>latent</em> opportunity.</p>
    </div>`;
}

export function pairKey(pair) {
  return [...pair].sort().join('+');
}

function shortName(name = '?') {
  const parts = name.split(' ');
  return parts.length > 1 ? `${parts[0][0]}. ${parts.at(-1)}` : name;
}

// ---------- researcher card ----------
export function researcherCard(r) {
  return `
    <div class="r-card">
      <p class="r-title">${esc(r.title)} — ${esc(r.unit)}, ${esc(r.institution)}</p>
      <div class="r-badges" style="justify-content:space-between">
        <span>
        ${r.synthetic
          ? '<span class="badge badge-synth">synthetic persona</span>'
          : `<span class="badge badge-real">real researcher</span> <span class="badge">${r.verified ? 'representation verified' : 'representation unverified'}</span>`}
        </span>
        <span style="white-space:nowrap">
          <button class="btn btn-ghost" data-edit-researcher="${esc(r.id)}">Edit representation</button>
          <button class="btn btn-ghost btn-remove" data-remove-researcher="${esc(r.id)}">Remove</button>
        </span>
      </div>
      <h3>Field</h3>
      <p class="quiet">${esc(r.field)}</p>
      <h3>Methods</h3>
      <ul>${r.methods.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
      <h3>Current interests</h3>
      <ul>${r.interests.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
      <h3>Recent reflections <span style="text-transform:none;letter-spacing:0">(the agent's private layer)</span></h3>
      <ul>${(r.reflections ?? []).map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
      <h3>Collaboration style</h3>
      <p class="quiet">${esc(r.collaborationStyle)}</p>
      ${r.provenance?.sources?.length ? `
        <h3>Profile draft provenance</h3>
        <p class="quiet">Drafted ${esc(r.provenance.draftedBy || 'by AI web research')} on ${new Date(r.provenance.at).toLocaleDateString()} from:</p>
        <ul class="source-list">${r.provenance.sources.map((s) => `<li><a href="${esc(s)}" target="_blank" rel="noopener">${esc(s)}</a></li>`).join('')}</ul>
        ${r.provenance.notes ? `<p class="quiet">Notes: ${esc(r.provenance.notes)}</p>` : ''}` : ''}
    </div>`;
}

// ---------- trigger form ----------
export function triggerForm() {
  return `
    <div class="r-card r-edit" data-new-trigger>
      <p class="quiet">Paste the opportunity the agents should assess collaboration potential for — a call for papers, a grant scheme, a project brief, or a research idea. The full text goes into every conversation and into run provenance.</p>
      <h3>Title *</h3>
      <input type="text" data-field="title" placeholder="e.g. MISQ special issue: Agentic AI in Organisations">
      <h3>Opportunity text *</h3>
      <textarea data-field="text" rows="12" placeholder="Paste the call / brief here…"></textarea>
      <div class="decide">
        <button class="btn btn-primary" data-create-trigger>Save trigger</button>
        <button class="btn btn-ghost" data-cancel-add>Cancel</button>
      </div>
    </div>`;
}

// ---------- add-researcher form ----------
const FAMILY_OPTIONS = [
  'qualitative', 'quantitative', 'computational', 'design',
  'experimental', 'conceptual', 'mixed', 'field-science',
];

export function researcherForm() {
  const input = (field, placeholder = '') =>
    `<input type="text" data-field="${field}" placeholder="${esc(placeholder)}">`;
  return `
    <div class="r-card r-edit" data-new-researcher>
      <p class="quiet">Add a researcher to the pool. Their agent speaks only from what you enter here — richer interests and reflections make deeper conversations. New researchers start with no ties, so they surface near the top of the probe queue.</p>
      <h3>Name *</h3>${input('name', 'e.g. Petra Novak')}
      <div class="scout-row">
        <button class="btn" data-scout>Draft from the web (AI)</button>
        <span class="scout-status" data-scout-status>Enter a name (affiliation below helps disambiguate), and the agent researches them with live web search — you review before saving.</span>
      </div>
      <label class="check-row"><input type="checkbox" data-field="synthetic" checked> Synthetic persona — represents no real person</label>
      <h3>Title</h3>${input('title', 'e.g. Associate Professor of Urban Planning')}
      <h3>Institution</h3>${input('institution', 'e.g. Queensland University of Technology')}
      <h3>Unit / school / centre <small>· separate multiple with ;</small></h3>${input('unit', 'e.g. School of Architecture; Urban Futures Centre')}
      <h3>Seniority</h3>
      <select data-field="seniority">
        <option value="1">Lecturer / early career</option>
        <option value="2" selected>Senior lecturer / fellow</option>
        <option value="3">Associate professor</option>
        <option value="4">Professor / chair</option>
      </select>
      <h3>Field *</h3>${input('field', 'e.g. Urban planning / smart cities')}
      <h3>Methods <small>· one per line</small></h3>
      <textarea data-field="methods" rows="3" placeholder="e.g. GIS and spatial analysis"></textarea>
      <h3>Method families</h3>
      <div class="check-grid">
        ${FAMILY_OPTIONS.map((f) => `<label><input type="checkbox" data-family="${f}"> ${f}</label>`).join('')}
      </div>
      <h3>Current interests <small>· one per line *</small></h3>
      <textarea data-field="interests" rows="4"></textarea>
      <h3>Recent reflections <small>· what occupies them right now, one per line</small></h3>
      <textarea data-field="reflections" rows="4"></textarea>
      <h3>Collaboration style</h3>
      <textarea data-field="collaborationStyle" rows="2"></textarea>
      <div class="decide">
        <button class="btn btn-primary" data-create-researcher>Add to the chart</button>
        <button class="btn btn-ghost" data-cancel-add>Cancel</button>
      </div>
    </div>`;
}

// ---------- researcher editor (Step 2: verify/correct the representation) ----------
export function researcherEditor(r) {
  return `
    <div class="r-card r-edit" data-researcher="${esc(r.id)}">
      <p class="r-title">${esc(r.title)} — ${esc(r.unit)}, ${esc(r.institution)}</p>
      <p class="quiet">This is what the agent knows about ${esc(r.name)}. Correct it, then save — the researcher's own review is Step 2 of the research design.</p>
      ${r.synthetic ? '' : `
      <div class="scout-row">
        <button class="btn" data-scout-existing="${esc(r.id)}">Refresh from the web (AI)</button>
        <span class="scout-status" data-scout-status>Re-researches their affiliation, interests, and reflections with live web search — you review before saving.</span>
      </div>`}
      <h3>Title</h3>
      <input type="text" data-field="title" value="${esc(r.title)}">
      <h3>Institution</h3>
      <input type="text" data-field="institution" value="${esc(r.institution)}">
      <h3>Unit / school / centre <small>· separate multiple affiliations with ;</small></h3>
      <input type="text" data-field="unit" value="${esc(r.unit)}">
      <h3>Country</h3>
      <input type="text" data-field="country" value="${esc(r.country ?? '')}">
      <h3>Seniority</h3>
      <select data-field="seniority">
        ${[["1","Lecturer / early career"],["2","Senior lecturer / fellow"],["3","Associate professor"],["4","Professor / chair"]]
          .map(([v,l]) => `<option value="${v}" ${Number(v) === r.seniority ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
      <h3>Field</h3>
      <input type="text" data-field="field" value="${esc(r.field)}">
      <h3>Methods <small>· one per line</small></h3>
      <textarea data-field="methods" rows="4">${esc(r.methods.join('\n'))}</textarea>
      <h3>Method families <small>· feeds the homophily baseline</small></h3>
      <div class="check-grid">
        ${FAMILY_OPTIONS.map((f) => `<label><input type="checkbox" data-family="${f}" ${r.methodFamilies?.includes(f) ? 'checked' : ''}> ${f}</label>`).join('')}
      </div>
      <h3>Current interests <small>· one per line</small></h3>
      <textarea data-field="interests" rows="5">${esc(r.interests.join('\n'))}</textarea>
      <h3>Recent reflections <small>· the agent's private layer, one per line</small></h3>
      <textarea data-field="reflections" rows="7">${esc((r.reflections ?? []).join('\n'))}</textarea>
      <h3>Collaboration style</h3>
      <textarea data-field="collaborationStyle" rows="3">${esc(r.collaborationStyle)}</textarea>
      <label class="check-row"><input type="checkbox" data-field="verified" ${r.verified ? 'checked' : ''}> This representation has been verified by the researcher themself</label>
      <div class="decide">
        <button class="btn btn-primary" data-save-researcher="${esc(r.id)}">Save representation</button>
        <button class="btn btn-ghost" data-cancel-edit="${esc(r.id)}">Cancel</button>
      </div>
    </div>`;
}

// ---------- run view: Brief | Conversation tabs ----------
export function runView(run, byId, tab = 'brief') {
  const turns = run.transcript?.length ?? 0;
  const failed =
    run.status === 'failed'
      ? `<div class="error-box">Run failed during ${esc(run.stage)}: ${esc(run.error)}
           <div style="margin-top:0.6rem">
             <button class="btn btn-primary" data-resume-run="${esc(run.id)}">Resume run</button>
             <span class="quiet" style="font-size:0.75rem"> — picks up from the last completed step; ${runMode(run) === 'judge' ? `the ${(run.judgments ?? []).flatMap((j) => j.votes).length} recorded votes are` : `the ${turns} recorded turns are`} kept.</span>
           </div>
         </div>`
      : '';
  if (runMode(run) === 'judge') {
    return `
    <div class="run-tabs" data-run-id="${esc(run.id)}">
      <button class="run-tab is-active" data-run-tab="brief">Judges' verdict</button>
    </div>
    ${failed}
    ${judgeBrief(run, byId)}`;
  }
  return `
    <div class="run-tabs" data-run-id="${esc(run.id)}">
      <button class="run-tab ${tab === 'brief' ? 'is-active' : ''}" data-run-tab="brief">Opportunity brief</button>
      <button class="run-tab ${tab === 'conversation' ? 'is-active' : ''}" data-run-tab="conversation">Conversation · ${turns} turns</button>
    </div>
    ${failed}
    ${tab === 'brief' ? opportunityBrief(run, byId) : transcriptView(run)}`;
}

function transcriptView(run) {
  if (!run.transcript?.length) return '<p class="quiet">No conversation was recorded for this run.</p>';
  const started = new Date(run.createdAt).toLocaleString();
  const demoNote = run.provider.name === 'demo'
    ? '<p class="demo-note">Simulated dialogue from the offline demo provider — not LLM output. Re-run this pair with a live provider to see what the agents actually construct.</p>'
    : '';
  return `
    <p class="transcript-meta">${started} · ${esc(run.provider.name)} · ${esc(run.provider.model)}</p>
    ${demoNote}
    <div class="theater">
      ${run.transcript
        .map(
          (t) => `
          <div class="turn ${t.speakerId === run.pair[0] ? 'side-a' : 'side-b'}">
            <div class="who">${esc(t.speakerName)} · agent · turn ${t.index + 1}</div>
            <div class="bubble">${esc(t.text)}</div>
          </div>`,
        )
        .join('')}
    </div>`;
}

// ---------- connection brief ----------
export function opportunityBrief(run, byId) {
  const o = run.opportunity;
  if (!o) return '<p class="quiet">No connection brief yet.</p>';
  const [aId, bId] = run.pair;
  // key fallbacks keep runs from the earlier "research brief" schema renderable
  const fit = o.fit_summary ?? o.shared_problem;
  const angle = o.joint_angle ?? o.research_question;
  const firstStep = o.first_step ?? o.study_sketch;
  const relevance = o.relevance ?? o.novelty;

  const triggerLine = run.trigger
    ? `<p class="trigger-line">Opportunity: <strong>${esc(run.trigger.title)}</strong></p>`
    : `<p class="trigger-line trigger-line-open">Open exploration — no opportunity trigger was set for this run.</p>`;

  const viableBox = o.viable
    ? `<div class="verdict-box">${esc(o.verdict)}</div>`
    : `<div class="verdict-box not-viable">${esc(o.verdict)}</div>`;

  return `
    <div class="opp">
      <div class="r-badges">${run.classification ? classBadge(run.classification) : ''}</div>
      <p class="opp-title">${esc(o.title)}</p>
      ${triggerLine}
      <h3>Why this pairing ${o.viable ? 'works' : 'does not work'}</h3>
      <p>${esc(fit)}</p>
      ${angle ? `<h3>Possible joint angle</h3><p>${esc(angle)}</p>` : ''}
      ${firstStep ? `<h3>Suggested first contact</h3><p>${esc(firstStep)}</p>` : ''}
      <h3>What each side brings</h3>
      <ul>
        <li><strong>${esc(byId[aId]?.name)}:</strong> ${esc(o.contributions?.[aId])}</li>
        <li><strong>${esc(byId[bId]?.name)}:</strong> ${esc(o.contributions?.[bId])}</li>
      </ul>
      <div class="scores">
        ${scoreTile(runEcp(run).toFixed(2), 'ECP', true)}
        ${scoreTile(relevance, 'Relevance')}
        ${scoreTile(o.complementarity, 'Complementarity')}
        ${scoreTile(o.feasibility, 'Feasibility')}
        ${scoreTile(run.baseline.composite.toFixed(2), 'Predictability', true)}
      </div>
      ${divergenceNote(run)}
      ${viableBox}
      ${mechanismsBlock(run)}
      ${decisionBlock(run)}
    </div>`;
}

function divergenceNote(run) {
  const d = runEcp(run) - run.baseline.composite;
  return `<p class="quiet" style="margin-top:-0.3rem">ECP (expected collaboration potential, the system's judgment) ${runEcp(run).toFixed(2)} vs structural predictability ${run.baseline.composite.toFixed(2)} — divergence ${d >= 0 ? '+' : ''}${d.toFixed(2)}. Large positive divergence is the latent signal.</p>`;
}

function mechanismsBlock(run) {
  const mechanisms = (run.assessment?.mechanisms ?? [])
    .map((m) => {
      const score = clamp01(m.score ?? run.baseline.scores[m.mechanism] ?? 0);
      return `
        <div class="mech">
          <div class="mech-head"><span>${esc(MECH_LABEL[m.mechanism] ?? m.mechanism)}</span><span>${score.toFixed(2)}</span></div>
          <div class="bar"><i style="width:${Math.round(score * 100)}%"></i></div>
          ${esc(m.explanation)}
        </div>`;
    })
    .join('');
  return `
      <h3>Would tie-formation theory have predicted this pair?</h3>
      <div class="mechanisms">${mechanisms}</div>
      ${run.assessment?.summary ? `<p class="quiet" style="margin-top:0.6rem">${esc(run.assessment.summary)}</p>` : ''}`;
}

/** JUDGE mode: the tally, every reason, the exact question asked, and Step 5. */
export function judgeBrief(run, byId) {
  const judgments = run.judgments ?? [];
  const votes = judgments.flatMap((j) => j.votes);
  if (!votes.length) return '<p class="quiet">No votes recorded yet.</p>';
  const yes = votes.filter((v) => v.vote === 1).length;
  const connect = machineSaysConnect(run);
  const triggerLine = run.trigger
    ? `<p class="trigger-line">Opportunity: <strong>${esc(run.trigger.title)}</strong></p>`
    : `<p class="trigger-line trigger-line-open">Open exploration — no opportunity trigger was set for this run.</p>`;
  const rows = judgments
    .map((j) => {
      const y = j.votes.filter((v) => v.vote === 1).length;
      return `
        <div class="tally-row">
          <span class="tally-model">${esc(j.model)}</span>
          <span class="tally-dots">${j.votes.map((v) => `<i class="${v.vote === 1 ? 'yes' : 'no'}" title="${esc(v.reason)}"></i>`).join('')}</span>
          <span class="tally-count">${y} / ${j.votes.length}</span>
        </div>`;
    })
    .join('');
  const reasons = (which) =>
    judgments
      .flatMap((j) => j.votes.filter((v) => v.vote === which && v.reason).map((v) => `<li><span class="quiet">${esc(j.model)}</span> ${esc(v.reason)}</li>`))
      .join('');
  const noVotes = votes.length - yes;
  const verdict = connect
    ? `A majority of judges — ${yes} of ${votes.length} — say these two should connect.`
    : `A majority of judges — ${noVotes} of ${votes.length} — say there is no case for connecting.`;

  return `
    <div class="opp">
      <div class="r-badges">${run.classification ? classBadge(run.classification) : ''}<span class="badge badge-mode">judge mode</span></div>
      <p class="opp-title">${esc(runTitle(run))}</p>
      ${triggerLine}
      <p class="quiet">${judgments.length} model${judgments.length === 1 ? '' : 's'} × ${run.judge?.repeats ?? '?'} votes each · prompt <em>${esc(run.judge?.variant ?? '')}</em> · provider ${esc(run.provider?.name ?? '')}</p>
      <div class="tally">${rows}</div>
      <div class="scores">
        ${scoreTile(runEcp(run).toFixed(2), 'ECP — share in favour', true)}
        ${scoreTile(run.baseline.composite.toFixed(2), 'Predictability', true)}
      </div>
      ${divergenceNote(run)}
      <div class="verdict-box ${connect ? '' : 'not-viable'}">${esc(verdict)}</div>
      ${yes ? `<h3>Why yes (${yes})</h3><ul class="reasons">${reasons(1)}</ul>` : ''}
      ${noVotes ? `<h3>Why no (${noVotes})</h3><ul class="reasons">${reasons(0)}</ul>` : ''}
      ${run.judge?.prompt ? `
      <details class="prompt-details">
        <summary>The exact question every judge was asked</summary>
        <pre>${esc(run.judge.prompt.system)}\n\n${esc(run.judge.prompt.user)}</pre>
      </details>` : ''}
      ${mechanismsBlock(run)}
      ${decisionBlock(run)}
    </div>`;
}

function scoreTile(v, k, isRaw = false) {
  return `<div class="score-tile"><div class="v">${esc(v)}${isRaw ? '' : '<span style="font-size:0.7rem;color:var(--faint)">/5</span>'}</div><div class="k">${k}</div></div>`;
}

function decisionBlock(run) {
  if (run.decision) {
    const meaning = machineSaysConnect(run)
      ? { accept: 'agreed — would pursue the connection', discuss: 'worth discussing', decline: 'disagreed — would not pursue' }
      : { accept: 'agreed — no basis to connect', discuss: 'not sure — to discuss', decline: 'disagreed — sees potential anyway' };
    return `<div class="decision-stamp">Human decision: ${esc(run.decision.decision)} (${meaning[run.decision.decision] ?? ''}) · ${new Date(run.decision.decidedAt).toLocaleString()}${run.decision.note ? `<br>“${esc(run.decision.note)}”` : ''}</div>`;
  }
  if (run.status !== 'awaiting-validation') return '';
  // The recorded decision always means agreement with the machine's
  // recommendation (accept) or disagreement (decline) — so the labels adapt to
  // whether the machine recommended connecting or not.
  const labels = machineSaysConnect(run)
    ? { accept: "Agree — I'd pursue this connection", discuss: 'Worth discussing', decline: "Disagree — I wouldn't" }
    : { accept: 'Agree — no basis to connect', discuss: 'Not sure — discuss', decline: 'Disagree — I see potential here' };
  const who = runMode(run) === 'judge' ? 'The judges' : 'The agents';
  const question = machineSaysConnect(run)
    ? `${who} recommend connecting. Do you agree?`
    : `${who} recommend <em>not</em> connecting. Do you agree?`;
  return `
    <h3>Step 4 — Your call</h3>
    <p class="quiet">${question} Your answer is the human–machine alignment measure.</p>
    <div class="decide" data-run="${esc(run.id)}">
      <button class="btn btn-accept" data-decision="accept">${labels.accept}</button>
      <button class="btn btn-discuss" data-decision="discuss">${labels.discuss}</button>
      <button class="btn btn-decline" data-decision="decline">${labels.decline}</button>
    </div>`;
}

function clamp01(x) {
  return Math.max(0, Math.min(1, Number(x) || 0));
}

// ---------- dashboard ----------
export function renderDashboard(el, runs, byId, archives = []) {
  const finished = runs.filter((r) => r.status === 'awaiting-validation' || r.decision);
  const viable = finished.filter((r) => machineSaysConnect(r));
  const judged = finished.filter((r) => runMode(r) === 'judge').length;
  const latent = finished.filter((r) => r.classification === 'latent');
  const decided = finished.filter((r) => r.decision && r.decision.decision !== 'discuss');
  const accepted = finished.filter((r) => r.decision?.decision === 'accept');
  const alignment = decided.length ? Math.round((accepted.length / decided.length) * 100) : null;

  const counts = { latent: 0, borderline: 0, predicted: 0, none: 0 };
  for (const r of finished) if (r.classification) counts[r.classification]++;
  const total = Object.values(counts).reduce((s, x) => s + x, 0) || 1;

  el.innerHTML = `
    <h2>Findings</h2>
    <p class="dash-sub">Step 5 of the research design: comparing what the system judged against what tie-formation theory predicts — and whether humans agree.</p>

    <div class="stat-row">
      ${statTile(finished.length, 'Pairs probed', judged ? `${finished.length - judged} by conversation · ${judged} by judges` : '')}
      ${statTile(viable.length, 'Recommended to connect')}
      ${statTile(latent.length, 'Latent — beyond the baseline', 'not explainable by foci, homophily, advantage, or closure')}
      ${statTile(alignment === null ? '—' : `${alignment}%`, 'Human–machine alignment', decided.length ? `agreed with the machine in ${accepted.length}/${decided.length} decided runs` : 'no decisions yet')}
    </div>

    <h3 class="panel-title">Predictability × expected collaboration potential</h3>
    <p class="dash-sub" style="margin:0.3rem 0 0.6rem">Each probed pair is a point. The upper-left region — structure predicts nothing, the system sees high potential — is where latent opportunities live.</p>
    ${scatter(finished)}

    <h3 class="panel-title">Classification of discovered opportunities</h3>
    <div class="class-bar">
      ${['latent', 'borderline', 'predicted', 'none']
        .map((k) => (counts[k] ? `<i style="flex:${counts[k]};background:${CLASS_COLOR[k]}" title="${CLASS_LABEL[k]}: ${counts[k]}"></i>` : ''))
        .join('')}
    </div>
    <div class="class-legend">
      ${['latent', 'borderline', 'predicted', 'none']
        .map((k) => `<span><span class="chip" style="background:${CLASS_COLOR[k]}"></span>${CLASS_LABEL[k]} · ${counts[k]}</span>`)
        .join('')}
    </div>

    ${resetPanel(runs, archives)}

    ${finished.length === 0
      ? '<p class="dash-empty">No runs yet. Head to the Observatory and probe a pair.</p>'
      : `<table class="opps-table">
          <thead><tr><th>Outcome</th><th>Pair</th><th>Mode</th><th>Classification</th><th>Predictability</th><th>ECP</th><th>Machine verdict</th><th>Human decision</th></tr></thead>
          <tbody>
            ${finished
              .map(
                (r) => `
                <tr>
                  <td class="t-title" data-open-run="${esc(r.id)}">${esc(runTitle(r))}</td>
                  <td>${r.pair.map((id) => esc(shortName(byId[id]?.name))).join(' × ')}</td>
                  <td class="quiet">${runMode(r) === 'judge' ? `judges · ${esc(r.judge?.variant ?? '')}` : 'conversation'}</td>
                  <td>${r.classification ? classBadge(r.classification) : '—'}</td>
                  <td style="font-family:var(--f-mono)">${r.baseline.composite.toFixed(2)}</td>
                  <td style="font-family:var(--f-mono)">${hasOutcome(r) ? runEcp(r).toFixed(2) : '—'}</td>
                  <td>${machineSaysConnect(r) ? 'connect' : 'no basis'}</td>
                  <td>${r.decision ? esc(r.decision.decision) : '<span style="color:var(--faint)">pending</span>'}</td>
                </tr>`,
              )
              .join('')}
          </tbody>
        </table>`}
  `;
}

function statTile(v, k, note = '') {
  return `<div class="stat-tile"><div class="v">${v}</div><div class="k">${k}</div>${note ? `<div class="note">${note}</div>` : ''}</div>`;
}

// ---------- in-app guide ----------
export function guideContent() {
  return `
    <div class="r-card guide">
      <p class="quiet">ResearcherConnect probes for <strong>latent collaboration opportunities</strong>: pairings that classical network theory would never predict, but where two agents — each speaking from a researcher's verified "mind file" — recognise genuine potential for a concrete opportunity.</p>

      <h3>The workflow</h3>
      <ol>
        <li><strong>Pick a trigger</strong> (left panel) — the call for papers, project, or idea that conversations assess collaboration potential <em>for</em>. Add your own with ＋ New trigger.</li>
        <li><strong>Pick a pair</strong> — from the probe queue (lowest predictability first; use "From …" to focus on one researcher) or by clicking two stars. Selecting a pair shows exactly how its predictability number is computed.</li>
        <li><strong>Choose how the system judges</strong> in the dock. <em>Agents talk</em>: two persona agents hold a 6-turn conversation and a brief is written (8 model calls). <em>Judges vote</em>: one model is shown both profiles and the opportunity and asked "should they collaborate — 0 or 1?", repeatedly, across several models; ECP is the share of votes in favour. <em>Unguided</em> gives the judges no steer; <em>guided</em> asks them to weigh complementarity over similarity. The prompt wording is an experimental factor — both are recorded in the run.</li>
        <li><strong>Choose a provider</strong>: <em>Demo</em> is instant and simulated (no LLM — for exploring the app); the Claude providers are live (minutes).</li>
        <li><strong>Run it.</strong> Agents assess what each side would bring — recognition, not invention; judges simply vote and give one reason each. A clear "don't connect" is a valid outcome in both.</li>
        <li><strong>Your call</strong> — agree or disagree with the machine's recommendation. Your answer is the human–machine alignment measure (Step 4 of the research design).</li>
        <li><strong>Findings</strong> — the running comparison, including the predictability × ECP chart where latent opportunities appear in the upper-left.</li>
      </ol>

      <h3>The two numbers</h3>
      <ul>
        <li><strong>Predictability</strong> (0–1): how strongly the four classical tie-formation mechanisms — shared settings, similar standing, connectedness, shared contacts — would predict this pair. Computed deterministically; click any pair for the full arithmetic.</li>
        <li><strong>ECP</strong> (0–1): expected collaboration potential — the system's own judgment. In conversation mode it is computed from the agents' relevance / complementarity / feasibility scores; in judge mode it is the share of votes in favour. 0 means no case was found.</li>
      </ul>
      <p class="quiet"><strong>Latent</strong> = predictability &lt; 0.25 and ECP ≥ 0.5: the system sees value where structure predicts nothing. That divergence is the paper's core claim.</p>

      <h3>Reading the star chart</h3>
      <ul>
        <li>Stars = researchers (size = existing ties; amber dashed ring = real person; grey = synthetic persona).</li>
        <li>Solid faint lines = existing collaborations. Dashed coloured lines = probed opportunities, coloured by classification (teal = latent).</li>
        <li>Click a star for the researcher card — <em>Edit representation</em> lets a researcher correct what their agent believes (Step 2: verification).</li>
      </ul>

      <h3>Good to know</h3>
      <ul>
        <li>Every run is saved to <code>data/runs/</code> with full provenance: trigger, every turn, scores, provider, your decision. The Conversation tab shows any past transcript.</li>
        <li>Failed runs keep completed work — use <em>Resume run</em>.</li>
        <li>＋ Add researcher extends the pool; new researchers start unconnected, so they top the probe queue. <em>Draft from the web (AI)</em> researches a real person with live web search and pre-fills the form — review before saving; sources are kept as provenance.</li>
      </ul>
    </div>`;
}

// ---------- reset (archive, never delete) ----------
function resetPanel(runs, archives) {
  const past = archives.length
    ? `<p class="quiet">Archived so far: ${archives
        .slice(0, 5)
        .map((a) => `<code>${esc(a.id)}</code> (${a.scope}${a.runsArchived ? `, ${a.runsArchived} runs` : ''})`)
        .join(', ')}${archives.length > 5 ? ` and ${archives.length - 5} more` : ''}.</p>`
    : '';
  return `
    <details class="reset-panel">
      <summary>Start a fresh experiment</summary>
      <p class="quiet">Resetting <strong>archives</strong>, it never deletes: the current state moves to
      <code>data/archive/&lt;timestamp&gt;/</code> with a manifest, so every run stays readable as evidence.</p>
      <div class="decide">
        <button class="btn" data-reset="findings">Clear findings (${runs.length} run${runs.length === 1 ? '' : 's'})</button>
        <button class="btn btn-remove" data-reset="all">Clear everything — runs, pool edits, triggers</button>
      </div>
      ${past}
    </details>`;
}

// ---------- predictability × ECP scatter ----------
function scatter(runs) {
  const W = 560;
  const H = 300;
  const m = { top: 18, right: 16, bottom: 40, left: 46 };
  const iw = W - m.left - m.right;
  const ih = H - m.top - m.bottom;
  const x = (v) => m.left + v * iw;
  const y = (v) => m.top + (1 - v) * ih;
  const pts = runs
    .filter(hasOutcome)
    .map((r) => ({
      cx: x(Math.min(1, r.baseline.composite)),
      cy: y(runEcp(r)),
      cls: r.classification ?? 'none',
      label: `${runTitle(r)} — predictability ${r.baseline.composite.toFixed(2)}, ECP ${runEcp(r).toFixed(2)}`,
      id: r.id,
    }));
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return `
  <div class="scatter-wrap">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Scatter plot of structural predictability against expected collaboration potential for all probed pairs">
      <rect x="${x(0)}" y="${y(1)}" width="${x(0.25) - x(0)}" height="${y(0.5) - y(1)}" fill="var(--latent)" opacity="0.07"/>
      <text x="${x(0.125)}" y="${y(1) + 14}" text-anchor="middle" class="sc-quadrant">latent region</text>
      ${ticks.map((t) => `
        <line x1="${x(t)}" y1="${y(0)}" x2="${x(t)}" y2="${y(1)}" class="sc-grid"/>
        <line x1="${x(0)}" y1="${y(t)}" x2="${x(1)}" y2="${y(t)}" class="sc-grid"/>
        <text x="${x(t)}" y="${H - m.bottom + 16}" text-anchor="middle" class="sc-tick">${t}</text>
        <text x="${m.left - 8}" y="${y(t) + 3}" text-anchor="end" class="sc-tick">${t}</text>`).join('')}
      <line x1="${x(0.25)}" y1="${y(0)}" x2="${x(0.25)}" y2="${y(1)}" class="sc-threshold"/>
      <line x1="${x(0)}" y1="${y(0.5)}" x2="${x(1)}" y2="${y(0.5)}" class="sc-threshold"/>
      ${pts.map((p) => `<circle data-open-run="${esc(p.id)}" cx="${p.cx}" cy="${p.cy}" r="7" fill="${CLASS_COLOR[p.cls]}" stroke="var(--bg)" stroke-width="2" class="sc-pt"><title>${esc(p.label)}</title></circle>`).join('')}
      <text x="${x(0.5)}" y="${H - 6}" text-anchor="middle" class="sc-axis">structural predictability (tie-formation baseline)</text>
      <text x="12" y="${y(0.5)}" text-anchor="middle" class="sc-axis" transform="rotate(-90 12 ${y(0.5)})">ECP (system judgment)</text>
    </svg>
  </div>`;
}

// ---------- toast ----------
let toastTimer;
export function toast(el, html) {
  el.innerHTML = html;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 5200);
}
