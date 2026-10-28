// theater.js — the Conversation Theater: renders agent turns as they stream in,
// with a typewriter reveal (skipped under prefers-reduced-motion).

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createTheater(container, pairIds, providerName, trigger) {
  const base =
    providerName === 'demo'
      ? 'Demo mode: this dialogue is <strong>simulated</strong> by the offline provider — templated from the profiles, no LLM involved. Switch the provider in the dock for a live conversation.'
      : "Two research agents are assessing — on their researchers' behalf — whether a genuine collaboration opportunity exists. Recognition, not invention: a clear \"don't connect\" is a valid outcome.";
  const triggerLine = trigger
    ? `<p class="trigger-line">Opportunity on the table: <strong>${escapeHtml(trigger.title)}</strong></p>`
    : '';
  container.innerHTML = `
    <p class="theater-intro">${base}</p>
    ${triggerLine}
    <div class="theater" data-role="turns"></div>
    <div class="typing" data-role="typing"><i></i><i></i><i></i></div>
  `;
  const turnsEl = container.querySelector('[data-role=turns]');
  const typingEl = container.querySelector('[data-role=typing]');

  function sideOf(speakerId) {
    return speakerId === pairIds[0] ? 'side-a' : 'side-b';
  }

  async function addTurn(turn, { instant = false } = {}) {
    const el = document.createElement('div');
    el.className = `turn ${sideOf(turn.speakerId)}`;
    el.innerHTML = `<div class="who"></div><div class="bubble"></div>`;
    el.querySelector('.who').textContent = `${turn.speakerName} · agent · turn ${turn.index + 1}`;
    const bubble = el.querySelector('.bubble');
    turnsEl.appendChild(el);

    if (instant || REDUCED) {
      bubble.textContent = turn.text;
    } else {
      await typewrite(bubble, turn.text, container);
    }
    container.scrollTop = container.scrollHeight;
  }

  return {
    addTurn,
    setTyping(on) {
      typingEl.style.display = on ? 'inline-flex' : 'none';
      if (on) container.scrollTop = container.scrollHeight;
    },
    finish() {
      typingEl.remove();
    },
  };
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function typewrite(el, text, scrollEl) {
  return new Promise((resolve) => {
    let i = 0;
    const chunk = 3;
    const tick = () => {
      i = Math.min(text.length, i + chunk);
      el.textContent = text.slice(0, i);
      scrollEl.scrollTop = scrollEl.scrollHeight;
      if (i < text.length) setTimeout(tick, 14);
      else resolve();
    };
    tick();
  });
}
