// graph.js — the star chart. A custom canvas force-directed layout (no
// dependencies): researchers are stars, existing collaborations are faint
// constellation lines, discovered opportunities are luminous dashed lines drawn
// in their classification colour. The signature moment is the latent edge being
// drawn between two previously unconnected stars.

// Ink-on-paper plate: stars and lines are engraved in indigo ink. The canvas
// cannot use CSS variables directly, so it READS them once at load — the
// CVD-validated palette in styles.css stays the single source of truth, and a
// colour can never be changed in one place but not the other.
const token = (name, fallback) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

const COLORS = {
  node: token('--text', '#1b2340'),
  nodeSynth: token('--dim', '#5a6485'),
  ring: token('--amber', '#a87f26'),
  edge: '#aab3cf', // chart-only: a lighter rule than any UI token
  label: token('--dim', '#5a6485'),
  active: token('--active-glow', '#3e4e9c'),
  latent: token('--latent', '#1e9b7e'),
  borderline: token('--borderline', '#a87f26'),
  predicted: token('--predicted', '#5e6fd0'),
  none: token('--none', '#9aa2be'),
};

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createGraph(canvas, { onNodeClick, onHover }) {
  const ctx = canvas.getContext('2d');
  let nodes = [];
  let edges = []; // existing collaborations
  let overlays = []; // discovered opportunities: {a, b, classification, bornAt}
  let activePair = null; // pair currently in conversation
  let selection = [];
  let hovered = null;
  let stars = [];
  let W = 0;
  let H = 0;
  let dpr = 1;
  let dragging = null;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    W = rect.width;
    H = rect.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedStars();
  }

  function seedStars() {
    // deterministic starfield (mulberry32) — quiet atmosphere, not decoration
    let s = 20260724;
    const rnd = () => ((s = Math.imul(s ^ (s >>> 15), s | 1)), ((s ^= s + Math.imul(s ^ (s >>> 7), s | 61)), ((s ^ (s >>> 14)) >>> 0) / 4294967296));
    stars = Array.from({ length: 90 }, () => ({
      x: rnd() * W,
      y: rnd() * H,
      r: rnd() * 1.1 + 0.2,
      tw: rnd() * Math.PI * 2,
    }));
  }

  function setData(researchers, collaborations) {
    const cx = W / 2;
    const cy = H / 2;
    const prev = new Map(nodes.map((n) => [n.id, n]));
    nodes = researchers.map((r, i) => {
      const old = prev.get(r.id);
      if (old) {
        // keep the star where it settled; just refresh its data
        old.r = r;
        old.degree = 0;
        return old;
      }
      const angle = (i / researchers.length) * Math.PI * 2;
      const rad = Math.min(W, H) * 0.32;
      return {
        id: r.id,
        r,
        x: cx + Math.cos(angle) * rad + (Math.random() - 0.5) * 30,
        y: cy + Math.sin(angle) * rad + (Math.random() - 0.5) * 30,
        vx: 0,
        vy: 0,
        degree: 0,
      };
    });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    edges = collaborations
      .map((c) => ({ a: byId.get(c.source), b: byId.get(c.target), context: c.context }))
      .filter((e) => e.a && e.b);
    for (const e of edges) {
      e.a.degree++;
      e.b.degree++;
    }
  }

  function setOverlays(list) {
    overlays = list
      .map((o) => ({
        a: nodes.find((n) => n.id === o.pair[0]),
        b: nodes.find((n) => n.id === o.pair[1]),
        classification: o.classification,
        bornAt: o.bornAt ?? 0,
      }))
      .filter((o) => o.a && o.b && o.classification && o.classification !== 'none');
  }

  function addOverlay(pair, classification) {
    const a = nodes.find((n) => n.id === pair[0]);
    const b = nodes.find((n) => n.id === pair[1]);
    if (a && b && classification !== 'none') {
      overlays.push({ a, b, classification, bornAt: performance.now() });
    }
  }

  // ---- physics --------------------------------------------------------------
  function step() {
    const cx = W / 2;
    const cy = H / 2;
    for (const n of nodes) {
      // gentle centering
      n.vx += (cx - n.x) * 0.0012;
      n.vy += (cy - n.y) * 0.0012;
    }
    // pairwise repulsion (n is small; O(n²) is fine)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const d2 = Math.max(dx * dx + dy * dy, 100);
        const f = 4200 / d2;
        const d = Math.sqrt(d2);
        dx /= d;
        dy /= d;
        a.vx -= dx * f;
        a.vy -= dy * f;
        b.vx += dx * f;
        b.vy += dy * f;
      }
    }
    // springs on existing ties
    for (const e of edges) {
      const dx = e.b.x - e.a.x;
      const dy = e.b.y - e.a.y;
      const d = Math.max(Math.hypot(dx, dy), 1);
      const target = Math.min(W, H) * 0.22;
      const f = (d - target) * 0.003;
      e.a.vx += (dx / d) * f;
      e.a.vy += (dy / d) * f;
      e.b.vx -= (dx / d) * f;
      e.b.vy -= (dy / d) * f;
    }
    for (const n of nodes) {
      if (n === dragging) continue;
      n.vx *= 0.86;
      n.vy *= 0.86;
      n.x += n.vx;
      n.y += n.vy;
      const pad = 46;
      n.x = Math.max(pad, Math.min(W - pad, n.x));
      n.y = Math.max(pad, Math.min(H - pad, n.y));
    }
  }

  // ---- rendering --------------------------------------------------------------
  function nodeRadius(n) {
    return 6 + n.degree * 2.4;
  }

  function drawPlanisphere() {
    // two faint concentric guides — a whisper of the chart, not an engraving
    const cx = W / 2;
    const cy = H / 2;
    ctx.save();
    ctx.strokeStyle = 'rgba(46,58,120,0.10)';
    ctx.lineWidth = 1;
    ctx.setLineDash([1, 5]);
    const maxR = Math.min(W, H) * 0.44;
    for (const f of [0.55, 1]) {
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * f, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawStamps() {
    ctx.save();
    ctx.fillStyle = 'rgba(90,100,133,0.8)';
    ctx.font = "9px 'IBM Plex Mono', monospace";
    ctx.textAlign = 'left';
    const epoch = (new Date().getFullYear() + (Date.now() - new Date(new Date().getFullYear(), 0, 1)) / 31557600000).toFixed(2);
    ctx.fillText(
      `EPOCH ${epoch} · N=${nodes.length} · ${edges.length} ESTABLISHED TIES · ${overlays.length} CONSTRUCTED`,
      18,
      H - 16,
    );
    ctx.restore();
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    drawPlanisphere();
    drawStamps();

    // faint field stars — ink specks on the plate
    for (const s of stars) {
      const alpha = (REDUCED ? 0.35 : 0.22 + 0.2 * Math.abs(Math.sin(t / 2600 + s.tw))) * 0.55;
      ctx.fillStyle = `rgba(27,35,64,${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // existing constellation lines
    ctx.lineWidth = 1;
    for (const e of edges) {
      ctx.strokeStyle = COLORS.edge;
      ctx.beginPath();
      ctx.moveTo(e.a.x, e.a.y);
      ctx.lineTo(e.b.x, e.b.y);
      ctx.stroke();
    }

    // discovered-opportunity overlays: dashed luminous lines, drawn on with a
    // grow-in animation when new
    for (const o of overlays) {
      const color = COLORS[o.classification] ?? COLORS.none;
      const age = o.bornAt ? (t - o.bornAt) / 1400 : 1;
      const progress = REDUCED ? 1 : Math.min(1, age);
      const mx = o.a.x + (o.b.x - o.a.x) * progress;
      const my = o.a.y + (o.b.y - o.a.y) * progress;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([6, 5]);
      if (!REDUCED) ctx.lineDashOffset = -t / 60;
      ctx.shadowColor = color;
      ctx.shadowBlur = o.classification === 'latent' ? 10 : 4;
      ctx.beginPath();
      ctx.moveTo(o.a.x, o.a.y);
      ctx.lineTo(mx, my);
      ctx.stroke();
      ctx.restore();
    }

    // active conversation link: breathing line between the talking pair
    if (activePair) {
      const a = nodes.find((n) => n.id === activePair[0]);
      const b = nodes.find((n) => n.id === activePair[1]);
      if (a && b) {
        const pulse = REDUCED ? 0.7 : 0.45 + 0.35 * Math.sin(t / 300);
        ctx.save();
        ctx.strokeStyle = COLORS.active;
        ctx.globalAlpha = pulse;
        ctx.lineWidth = 1.4;
        ctx.setLineDash([2, 6]);
        if (!REDUCED) ctx.lineDashOffset = -t / 30;
        ctx.shadowColor = COLORS.active;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.restore();
      }
    }

    // nodes
    for (const n of nodes) {
      const rad = nodeRadius(n);
      const isSel = selection.includes(n.id);
      const isActive = activePair?.includes(n.id);
      const isHover = hovered === n;

      if (isSel || isActive || isHover) {
        ctx.save();
        ctx.shadowColor = isActive ? COLORS.active : COLORS.latent;
        ctx.shadowBlur = 16;
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.beginPath();
        ctx.arc(n.x, n.y, rad + 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // star glyph: bright core + four diffraction spikes (a star on a photographic plate)
      const color = n.r.synthetic ? COLORS.nodeSynth : COLORS.node;
      const spike = rad * 2.1;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(n.x - spike, n.y);
      ctx.lineTo(n.x + spike, n.y);
      ctx.moveTo(n.x, n.y - spike);
      ctx.lineTo(n.x, n.y + spike);
      ctx.stroke();
      ctx.globalAlpha = 1;
      const core = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, rad * 0.9);
      core.addColorStop(0, color);
      core.addColorStop(0.6, color);
      core.addColorStop(1, 'rgba(27,35,64,0)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(n.x, n.y, rad * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // amber ring marks a real researcher
      if (!n.r.synthetic) {
        ctx.strokeStyle = COLORS.ring;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(n.x, n.y, rad + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (isSel) {
        ctx.strokeStyle = COLORS.latent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(n.x, n.y, rad + 6.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // label
      ctx.fillStyle = isHover || isSel || isActive ? COLORS.node : COLORS.label;
      ctx.font = `${isHover ? 600 : 500} 11px 'Instrument Sans', sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(shortName(n.r.name), n.x, n.y + rad + 16);
    }
  }

  function shortName(name) {
    const parts = name.split(' ');
    return parts.length > 1 ? `${parts[0][0]}. ${parts.at(-1)}` : name;
  }

  function loop(t) {
    step();
    draw(t);
    requestAnimationFrame(loop);
  }

  // ---- interaction --------------------------------------------------------------
  function nodeAt(x, y) {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (Math.hypot(n.x - x, n.y - y) <= nodeRadius(n) + 6) return n;
    }
    return null;
  }

  function localPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  canvas.addEventListener('pointermove', (e) => {
    const { x, y } = localPos(e);
    if (dragging) {
      dragging.x = x;
      dragging.y = y;
      dragging.vx = 0;
      dragging.vy = 0;
      return;
    }
    const n = nodeAt(x, y);
    if (n !== hovered) {
      hovered = n;
      canvas.style.cursor = n ? 'pointer' : 'default';
      onHover?.(n ? { researcher: n.r, x: n.x, y: n.y } : null);
    }
  });

  canvas.addEventListener('pointerdown', (e) => {
    const { x, y } = localPos(e);
    const n = nodeAt(x, y);
    if (n) {
      dragging = n;
      canvas.setPointerCapture(e.pointerId);
      dragging.moved = false;
      dragging.startX = x;
      dragging.startY = y;
    }
  });

  canvas.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    const { x, y } = localPos(e);
    const moved = Math.hypot(x - dragging.startX, y - dragging.startY) > 5;
    if (!moved) onNodeClick?.(dragging.r);
    dragging = null;
  });

  canvas.addEventListener('pointerleave', () => {
    hovered = null;
    onHover?.(null);
  });

  window.addEventListener('resize', resize);
  new ResizeObserver(resize).observe(canvas); // grid changes (inspector open/close) resize the canvas without a window resize
  resize();
  requestAnimationFrame(loop);

  return {
    setData,
    setOverlays,
    addOverlay,
    setActivePair: (pair) => (activePair = pair),
    setSelection: (ids) => (selection = ids),
  };
}
