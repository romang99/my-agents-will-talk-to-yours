// tally.js — the live view for a JUDGE-mode run: one row per model, a dot per
// vote filling in as it lands, and the running share in favour. The counterpart
// of theater.js for conversation mode.

export function createTally(container, { judge, providerName, trigger, judgments = [] }) {
  const intro =
    providerName === 'demo'
      ? 'Demo mode: these votes are <strong>simulated</strong> by the offline provider — no LLM involved. Switch the provider in the dock for real judges.'
      : `Each judge is shown both profiles and the opportunity and asked once: should they collaborate — 0 or 1? The question is put ${judge.repeats} times to each of ${judge.models.length} model${judge.models.length === 1 ? '' : 's'}; ECP is the share of votes in favour.`;
  const triggerLine = trigger
    ? `<p class="trigger-line">Opportunity on the table: <strong>${escapeHtml(trigger.title)}</strong></p>`
    : '';
  container.innerHTML = `
    <p class="theater-intro">${intro}</p>
    ${triggerLine}
    <p class="quiet tally-variant">Prompt: <em>${escapeHtml(judge.variant)}</em></p>
    <div class="tally" data-role="rows">
      ${judge.models.map((m) => `
        <div class="tally-row" data-model="${escapeHtml(m)}">
          <span class="tally-model">${escapeHtml(m)}</span>
          <span class="tally-dots">${Array.from({ length: judge.repeats }, () => '<i class="pending"></i>').join('')}</span>
          <span class="tally-count">0 / 0</span>
        </div>`).join('')}
    </div>
    <p class="tally-total" data-role="total">Waiting for the first vote…</p>
    <div class="tally-reasons" data-role="reasons"></div>
  `;
  const rows = Object.fromEntries(judge.models.map((m) => [m, container.querySelector(`[data-model="${cssEscape(m)}"]`)]));
  const totalEl = container.querySelector('[data-role=total]');
  const reasonsEl = container.querySelector('[data-role=reasons]');
  const counts = Object.fromEntries(judge.models.map((m) => [m, { yes: 0, n: 0 }]));
  const total = judge.models.length * judge.repeats;

  function addVote({ model, vote }) {
    const row = rows[model];
    const c = counts[model];
    if (!row || !c) return;
    const dot = row.querySelectorAll('.tally-dots i')[c.n];
    c.n += 1;
    if (vote.vote === 1) c.yes += 1;
    if (dot) dot.className = vote.vote === 1 ? 'yes' : 'no';
    row.querySelector('.tally-count').textContent = `${c.yes} / ${c.n}`;
    const yes = Object.values(counts).reduce((s, x) => s + x.yes, 0);
    const n = Object.values(counts).reduce((s, x) => s + x.n, 0);
    totalEl.textContent = `${yes} of ${n} votes in favour so far (${n} of ${total} cast) — ECP ${(yes / n).toFixed(2)}`;
    if (vote.reason) {
      const li = document.createElement('div');
      li.className = `reason ${vote.vote === 1 ? 'reason-yes' : 'reason-no'}`;
      li.textContent = `${vote.vote === 1 ? 'Yes' : 'No'} · ${model}: ${vote.reason}`;
      reasonsEl.prepend(li);
    }
  }

  for (const j of judgments) for (const v of j.votes) addVote({ model: j.model, vote: v });

  return {
    addVote,
    finish() {
      totalEl.classList.add('is-done');
    },
  };
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function cssEscape(s) {
  return String(s).replace(/["\\]/g, '\\$&');
}
