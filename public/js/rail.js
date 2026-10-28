// rail.js — the pipeline rail in the masthead: the paper's five research-design
// steps, lit according to the active run's stage. Step 3 differs by run mode.

const STEPS = {
  conversation: [
    { id: 'baseline', label: '1 · Baseline' },
    { id: 'representation', label: '2 · Representation' },
    { id: 'conversation', label: '3 · Conversation' },
    { id: 'synthesis', label: '3b · Synthesis' },
    { id: 'comparison', label: '5 · Comparison' },
    { id: 'validation', label: '4 · Validation' },
  ],
  judge: [
    { id: 'baseline', label: '1 · Baseline' },
    { id: 'representation', label: '2 · Representation' },
    { id: 'judgment', label: '3 · Judgment' },
    { id: 'comparison', label: '5 · Comparison' },
    { id: 'validation', label: '4 · Validation' },
  ],
};

// Display order follows the pipeline's actual execution order; the numbers keep
// the paper's step numbering (validation happens after comparison in the app).
export function initRail(el) {
  let order = [];
  const render = (mode) => {
    const steps = STEPS[mode] ?? STEPS.conversation;
    order = steps.map((s) => s.id);
    el.innerHTML = steps
      .map((s) => `<span class="rail-step" data-step="${s.id}"><span class="dot"></span>${s.label}</span>`)
      .join('');
  };
  render('conversation');
  return {
    setMode(mode) {
      render(mode);
    },
    setStage(stage) {
      const activeIdx = order.indexOf(stage);
      for (const node of el.querySelectorAll('.rail-step')) {
        const idx = order.indexOf(node.dataset.step);
        node.classList.toggle('is-active', idx === activeIdx);
        node.classList.toggle('is-done', activeIdx > -1 && idx < activeIdx);
      }
    },
    clear() {
      for (const node of el.querySelectorAll('.rail-step')) {
        node.classList.remove('is-active', 'is-done');
      }
    },
  };
}
