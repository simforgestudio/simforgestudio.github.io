/* SimForge Studio: small live simulations for the homepage.
   Each canvas runs only while it is on screen; reduced-motion users get a still frame. */
(() => {
  "use strict";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const BG = "#10121a";
  const rand = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => Math.max(0, Math.min(255, Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k))));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }
  function ball(ctx, x, y, r, color) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r);
    g.addColorStop(0, shade(color, 0.65));
    g.addColorStop(0.4, color);
    g.addColorStop(1, shade(color, -0.55));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  /* Generic runner: sizing, DPR, visibility, frame loop. */
  function run(canvas, sim) {
    const ctx = canvas.getContext("2d");
    const st = { w: 0, h: 0, t: 0, ready: false };
    let raf = 0, last = 0, visible = false;

    function resize() {
      const r = canvas.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      st.w = r.width; st.h = r.height;
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sim.init(st, !st.ready);
      st.ready = true;
      if (reduce) { sim.step && sim.step(st, 0); sim.draw(ctx, st, 0); }
      else if (!raf) sim.draw(ctx, st, 0);
    }
    function frame(now) {
      raf = 0;
      const dt = Math.min((now - last) / 1000 || 0, 1 / 30);
      last = now;
      st.t += dt;
      sim.step && sim.step(st, dt);
      sim.draw(ctx, st, dt);
      if (visible) raf = requestAnimationFrame(frame);
    }
    function start() {
      if (reduce || raf || !st.ready) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    new ResizeObserver(resize).observe(canvas);
    new IntersectionObserver((es) => {
      visible = es[0].isIntersecting;
      if (visible) start(); else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }, { rootMargin: "80px" }).observe(canvas);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && raf) { cancelAnimationFrame(raf); raf = 0; }
      else if (!document.hidden && visible) start();
    });
    if (reduce && sim.still) st.t = sim.still;
    return st;
  }

  /* ---------- Hero: orbs under gravity, with collisions ---------- */
  const HERO_COLORS = ["#ff6b2c", "#ff6b2c", "#ff8a3d", "#ffb347", "#ffb347", "#f72585", "#4cc9f0", "#b8f24a", "#eef0f6"];
  const hero = {
    init(st, first) {
      const { w, h } = st;
      if (first) {
        const n = Math.round(Math.max(18, Math.min(55, (w * h) / 22000)));
        const rMax = w < 600 ? 19 : 30;
        st.orbs = Array.from({ length: n }, () => {
          const r = rand(8, rMax);
          return {
            x: rand(r, w - r), y: reduce ? rand(h * 0.15, h - r) : rand(-h * 0.6, h * 0.6),
            vx: rand(-120, 120), vy: rand(-60, 60), r, m: r * r,
            c: HERO_COLORS[(Math.random() * HERO_COLORS.length) | 0],
          };
        });
        st.idle = 0;
        st.pointer = null;
        bindPointer(st);
      } else {
        for (const o of st.orbs) { o.x = Math.min(Math.max(o.x, o.r), w - o.r); o.y = Math.min(o.y, h - o.r); }
      }
    },
    step(st, dt) {
      if (!dt) return;
      const { w, h, orbs } = st;
      st.idle += dt;
      if (st.idle > 5.5) { st.idle = 0; burst(st, rand(w * 0.15, w * 0.85), h, 1); }
      const sub = 3, s = dt / sub, g = 1100;
      for (let k = 0; k < sub; k++) {
        for (const o of orbs) {
          o.vy += g * s;
          if (st.pointer) {
            const dx = o.x - st.pointer.x, dy = o.y - st.pointer.y, d2 = dx * dx + dy * dy, R = 110;
            if (d2 < R * R && d2 > 1) { const d = Math.sqrt(d2), f = (1 - d / R) * 5200 * s; o.vx += (dx / d) * f; o.vy += (dy / d) * f; }
          }
          o.x += o.vx * s; o.y += o.vy * s;
          if (o.x < o.r) { o.x = o.r; o.vx = Math.abs(o.vx) * 0.8; }
          if (o.x > w - o.r) { o.x = w - o.r; o.vx = -Math.abs(o.vx) * 0.8; }
          if (o.y > h - o.r) { o.y = h - o.r; o.vy = -Math.abs(o.vy) * 0.72; o.vx *= 0.985; }
        }
        for (let i = 0; i < orbs.length; i++) {
          const a = orbs[i];
          for (let j = i + 1; j < orbs.length; j++) {
            const b = orbs[j];
            const dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r, d2 = dx * dx + dy * dy;
            if (d2 >= min * min || d2 === 0) continue;
            const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, over = min - d, tm = a.m + b.m;
            a.x -= nx * over * (b.m / tm); a.y -= ny * over * (b.m / tm);
            b.x += nx * over * (a.m / tm); b.y += ny * over * (a.m / tm);
            const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (vn < 0) {
              const J = (-(1 + 0.86) * vn) / (1 / a.m + 1 / b.m);
              a.vx -= (J * nx) / a.m; a.vy -= (J * ny) / a.m;
              b.vx += (J * nx) / b.m; b.vy += (J * ny) / b.m;
            }
          }
        }
      }
    },
    draw(ctx, st) {
      const { w, h, orbs } = st;
      ctx.fillStyle = "#0a0b10";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(238,240,246,0.035)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 56) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); }
      for (let y = 0; y <= h; y += 56) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
      ctx.stroke();
      for (const o of orbs) {
        const g = ctx.createRadialGradient(o.x, o.y, o.r * 0.6, o.x, o.y, o.r * 2.4);
        g.addColorStop(0, hexA(o.c, 0.22)); g.addColorStop(1, hexA(o.c, 0));
        ctx.fillStyle = g;
        ctx.fillRect(o.x - o.r * 2.4, o.y - o.r * 2.4, o.r * 4.8, o.r * 4.8);
      }
      for (const o of orbs) ball(ctx, o.x, o.y, o.r, o.c);
    },
  };
  function burst(st, x, y, k) {
    for (const o of st.orbs) {
      const dx = o.x - x, dy = o.y - y, d = Math.hypot(dx, dy) || 1, R = Math.max(st.w, st.h) * 0.55;
      if (d > R) continue;
      const f = (1 - d / R) * 1900 * k;
      o.vx += (dx / d) * f + rand(-60, 60);
      o.vy += (dy / d) * f - 500 * k * (1 - d / R);
    }
  }
  function bindPointer(st) {
    const el = document.getElementById("hero-sim");
    const pos = (e) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    el.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") st.pointer = pos(e); });
    el.addEventListener("pointerleave", () => { st.pointer = null; });
    el.addEventListener("pointerdown", (e) => { const p = pos(e); st.idle = 0; burst(st, p.x, p.y + 40, 1.25); });
  }

  /* ---------- PhysicsTrials: pendulum wave ---------- */
  const pendulum = {
    still: 7.3,
    init(st) { st.n = 15; },
    draw(ctx, st) {
      const { w, h, t, n } = st, cx = w / 2, A = w * 0.36;
      const top = h * 0.12, bot = h * 0.88, gap = (bot - top) / (n - 1);
      const r = Math.max(4, Math.min(gap * 0.36, 11));
      ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(238,240,246,0.07)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx + 0.5, top - r * 2); ctx.lineTo(cx + 0.5, bot + r * 2);
      for (let i = 0; i < n; i++) { const y = top + i * gap; ctx.moveTo(cx - A, y); ctx.lineTo(cx + A, y); }
      ctx.stroke();
      const pts = [];
      for (let i = 0; i < n; i++) {
        const k = 18 + i, x = cx + A * Math.sin((TAU * k * t) / 30);
        pts.push([x, top + i * gap]);
      }
      ctx.strokeStyle = "rgba(255,107,44,0.45)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      pts.forEach(([x, y], i) => {
        const c = i / (n - 1) < 0.5 ? "#ff6b2c" : "#ffb347";
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
        g.addColorStop(0, hexA(c, 0.25)); g.addColorStop(1, hexA(c, 0));
        ctx.fillStyle = g; ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
        ball(ctx, x, y, r, c);
      });
    },
  };

  /* ---------- ArenaOfOrbs: orbs in a ring that grow on every wall hit ---------- */
  const ARENA_COLORS = ["#f72585", "#4cc9f0", "#b8f24a", "#ffb347", "#ff6b2c"];
  const arena = {
    still: 3,
    init(st, first) {
      const { w, h } = st;
      st.R = Math.min(w, h) * 0.42; st.cx = w / 2; st.cy = h / 2;
      st.clear = true;
      if (first || !st.orbs) this.reset(st);
    },
    reset(st) {
      const R = st.R;
      st.orbs = ARENA_COLORS.map((c, i) => {
        const a = (i / ARENA_COLORS.length) * TAU, sp = R * 1.15, dir = rand(0, TAU);
        return { x: st.cx + Math.cos(a) * R * 0.45, y: st.cy + Math.sin(a) * R * 0.45, vx: Math.cos(dir) * sp, vy: Math.sin(dir) * sp, r: R * 0.06, c };
      });
      st.trail = true;
      st.clear = true;
    },
    step(st, dt) {
      const { R, cx, cy, orbs } = st;
      if (!dt) { for (let i = 0; i < 90; i++) this.step(st, 1 / 60); return; }
      for (const o of orbs) {
        o.x += o.vx * dt; o.y += o.vy * dt;
        const dx = o.x - cx, dy = o.y - cy, d = Math.hypot(dx, dy);
        if (d + o.r > R) {
          const nx = dx / d, ny = dy / d, vn = o.vx * nx + o.vy * ny;
          o.x = cx + nx * (R - o.r); o.y = cy + ny * (R - o.r);
          if (vn > 0) { o.vx -= 2 * vn * nx; o.vy -= 2 * vn * ny; o.r += R * 0.0045; }
        }
      }
      for (let i = 0; i < orbs.length; i++) for (let j = i + 1; j < orbs.length; j++) {
        const a = orbs[i], b = orbs[j], dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r, d = Math.hypot(dx, dy);
        if (d >= min || d === 0) continue;
        const nx = dx / d, ny = dy / d, over = (min - d) / 2;
        a.x -= nx * over; a.y -= ny * over; b.x += nx * over; b.y += ny * over;
        const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vn < 0) { a.vx += vn * nx; a.vy += vn * ny; b.vx -= vn * nx; b.vy -= vn * ny; }
      }
      if (orbs.some((o) => o.r > R * 0.2)) this.reset(st);
    },
    draw(ctx, st) {
      const { w, h, R, cx, cy, orbs } = st;
      ctx.fillStyle = st.clear ? BG : "rgba(16,18,26,0.2)";
      st.clear = false;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(247,37,133,0.75)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      ctx.strokeStyle = "rgba(247,37,133,0.12)"; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(cx, cy, R + 5, 0, TAU); ctx.stroke();
      for (const o of orbs) ball(ctx, o.x, o.y, o.r, o.c);
    },
  };

  /* ---------- SineAndShape: Lissajous curve with a drifting phase ---------- */
  const lissajous = {
    still: 5,
    init() {},
    draw(ctx, st) {
      const { w, h, t } = st, cx = w / 2, cy = h / 2, ax = Math.min(w * 0.4, h * 0.72), ay = h * 0.38;
      const a = 3, b = 2, ph = t * 0.22;
      const P = (s) => [cx + ax * Math.sin(a * s + ph), cy + ay * Math.sin(b * s)];
      ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(238,240,246,0.06)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - ax, cy + 0.5); ctx.lineTo(cx + ax, cy + 0.5); ctx.moveTo(cx + 0.5, cy - ay); ctx.lineTo(cx + 0.5, cy + ay); ctx.stroke();
      ctx.strokeStyle = "rgba(76,201,240,0.22)"; ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i <= 400; i++) { const [x, y] = P((i / 400) * TAU); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
      const head = t * 1.1, seg = 60, len = 2.2;
      ctx.lineCap = "round";
      for (let i = 0; i < seg; i++) {
        const s0 = head - len + (len * i) / seg, s1 = head - len + (len * (i + 1)) / seg;
        const [x0, y0] = P(s0), [x1, y1] = P(s1);
        ctx.strokeStyle = hexA("#4cc9f0", (i / seg) ** 1.6);
        ctx.lineWidth = 1 + 2.5 * (i / seg);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
      const [hx, hy] = P(head);
      ctx.strokeStyle = "rgba(76,201,240,0.18)"; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(hx, cy - ay); ctx.lineTo(hx, cy + ay); ctx.moveTo(cx - ax, hy); ctx.lineTo(cx + ax, hy); ctx.stroke();
      ctx.setLineDash([]);
      const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 18);
      g.addColorStop(0, "rgba(76,201,240,0.5)"); g.addColorStop(1, "rgba(76,201,240,0)");
      ctx.fillStyle = g; ctx.fillRect(hx - 18, hy - 18, 36, 36);
      ball(ctx, hx, hy, 5, "#bdf0ff");
      ctx.fillStyle = "rgba(154,160,180,0.8)";
      ctx.font = `${Math.max(10, h * 0.042)}px "JetBrains Mono", monospace`;
      ctx.fillText(`x = sin(3t + ${(ph % TAU).toFixed(2)})   y = sin(2t)`, 14, h - 14);
    },
  };

  /* ---------- VerySeriousCharts: a bar chart race of very important topics ---------- */
  const TOPICS = [
    ["Socks lost in the wash", 62, 1.1, 0.0],
    ["Meetings that could be emails", 70, 0.8, 2.1],
    ["Browser tabs left open", 55, 1.4, 4.2],
    ["Daily cat naps", 48, 0.6, 1.3],
    ["“Quick questions” (not quick)", 58, 1.0, 3.3],
  ];
  const charts = {
    still: 4,
    init(st, first) { if (first) st.rows = TOPICS.map((tp, i) => ({ label: tp[0], base: tp[1], sp: tp[2], ph: tp[3], v: tp[1], y: i })); },
    step(st, dt) {
      const t = st.t;
      for (const r of st.rows) r.v = r.base + 26 * Math.sin(t * r.sp * 0.7 + r.ph) + 9 * Math.sin(t * r.sp * 1.9 + r.ph * 2);
      const order = [...st.rows].sort((a, b) => b.v - a.v);
      order.forEach((r, i) => { r.y += (i - r.y) * Math.min(1, (dt || 1) * 9); });
    },
    draw(ctx, st) {
      const { w, h, rows } = st;
      const fs = Math.max(9.5, Math.min(13, h * 0.042));
      const left = 14, right = w - 14, top = h * 0.2, rowH = (h * 0.92 - top) / rows.length;
      const max = Math.max(...rows.map((r) => r.v)) * 1.12;
      ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h);
      ctx.font = `600 ${fs * 1.08}px "Space Grotesk", sans-serif`;
      ctx.fillStyle = "#eef0f6";
      ctx.fillText("Things that multiply when ignored", left, h * 0.1);
      ctx.font = `${fs * 0.85}px "JetBrains Mono", monospace`;
      ctx.fillStyle = "rgba(154,160,180,0.75)";
      ctx.fillText("index, per capita · source: very serious", left, h * 0.1 + fs * 1.35);
      ctx.strokeStyle = "rgba(238,240,246,0.06)"; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i <= 4; i++) { const x = left + ((right - left) * i) / 4; ctx.moveTo(x + 0.5, top - 4); ctx.lineTo(x + 0.5, h * 0.92); }
      ctx.stroke();
      for (const r of rows) {
        const y = top + r.y * rowH, bw = ((right - left) * r.v) / max, lead = r.y < 0.5;
        ctx.font = `${fs * 0.9}px "JetBrains Mono", monospace`;
        ctx.fillStyle = lead ? "#eef0f6" : "rgba(195,200,214,0.85)";
        ctx.fillText(r.label, left, y + fs * 0.9);
        const by = y + fs * 1.35, bh = Math.max(6, rowH - fs * 2.05);
        const g = ctx.createLinearGradient(left, 0, left + bw, 0);
        g.addColorStop(0, lead ? "rgba(184,242,74,0.55)" : "rgba(184,242,74,0.22)");
        g.addColorStop(1, lead ? "#b8f24a" : "rgba(184,242,74,0.55)");
        ctx.fillStyle = g;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(left, by, bw, bh, 3); else ctx.rect(left, by, bw, bh);
        ctx.fill();
        ctx.font = `600 ${fs * 0.85}px "JetBrains Mono", monospace`;
        const txt = r.v.toFixed(1), tw = ctx.measureText(txt).width;
        ctx.fillStyle = bw > tw + 16 ? "#0a0b10" : "#b8f24a";
        ctx.fillText(txt, bw > tw + 16 ? left + bw - tw - 6 : left + bw + 6, by + bh / 2 + fs * 0.3);
      }
    },
  };

  const SIMS = { pendulum, arena, lissajous, charts };
  const heroCanvas = document.getElementById("hero-sim");
  if (heroCanvas) run(heroCanvas, hero);
  document.querySelectorAll("canvas[data-sim]").forEach((c) => { const s = SIMS[c.dataset.sim]; if (s) run(c, Object.create(s)); });
})();
