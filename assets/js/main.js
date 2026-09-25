// ============================================================
//  Theme (night-sky default) + starfield with shooting stars
// ============================================================
(function () {
  const root = document.documentElement;
  const KEY = "theme";
  // Default to the night-sky (dark) theme unless the visitor chose light before.
  const stored = localStorage.getItem(KEY);
  root.setAttribute("data-theme", stored || "dark");

  function syncIcon() {
    const dark = root.getAttribute("data-theme") === "dark";
    document.querySelectorAll(".theme-toggle i").forEach((el) => {
      el.className = dark ? "fa-solid fa-sun" : "fa-solid fa-moon";
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    syncIcon();

    document.querySelectorAll(".theme-toggle").forEach((btn) => {
      btn.addEventListener("click", function () {
        const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", next);
        localStorage.setItem(KEY, next);
        syncIcon();
      });
    });

    // Mobile nav
    const toggle = document.querySelector(".nav-toggle");
    const links = document.querySelector(".nav-links");
    if (toggle && links) toggle.addEventListener("click", () => links.classList.toggle("open"));

    initManifold().catch(initStarfield);
  });

  // -----------------------------------------------------------
  //  JADES SED manifold background
  //  The CERIDWEN fits of the JADES galaxies (run sfms12_bursty),
  //  projected onto a moving 2-D plane of the 12-D parameter space,
  //  as in /jades-fit-explorer/manifold.html. It starts at the saved
  //  view below, drifts to a random projection, returns, and repeats.
  //  Falls back to the starfield if the data cannot be loaded.
  // -----------------------------------------------------------
  async function initManifold() {
    const BASE = "/jades-fit-explorer/data/manifold/";
    const RUN = "sfms12_bursty";
    // Saved view: frame (f=), camera offset/zoom (v=) from the explorer URL.
    const HOME_F = "XOl6vrF8hz4ZUNI-WA92PYr2qL4-Zgm_PSniPZZg2j28vJQ-dkr2vRtFwr6jej2-OzYqv3R2lL7RrIO9zmfpvryhDj4s6S8-WYEsvtm0c73eVbE9SgnBvso7qL3L0SC-";
    const CAM = { x: -49, y: 23, k: 1.22 };
    // House ramp of the explorer, coloured by redshift (2nd-98th percentile span).
    const RAMP = ["#a3acd8","#c7a8cd","#eba4c3","#f8979b","#fd8769",
                  "#f7674c","#e83843","#d11339","#a60f2d","#7a0b21"];
    const NB = RAMP.length;
    const LEG = 26000, HOLD = 6000;          // ms per drift leg, pause at the saved view

    const manifest = await (await fetch(BASE + "manifest.json")).json();
    const rc = manifest.runs.find((r) => r.name === RUN);
    if (!rc) throw new Error("run not found");
    const buf = await (await fetch(BASE + RUN + ".f32")).arrayBuffer();
    const all = new Float32Array(buf);
    const keys = rc.dims, D = keys.length;
    const N = rc.n || all.length / (rc.dims.length + rc.extra.length);
    if (!(N > 0) || all.length < N * D) throw new Error("bad data");

    // standardised coordinates, as in the explorer
    const U = keys.map((k, d) => {
      const m = manifest.dims.find((x) => x.key === k);
      const col = all.subarray(d * N, (d + 1) * N), u = new Float32Array(N);
      for (let i = 0; i < N; i++) u[i] = Number.isFinite(col[i]) ? (col[i] - m.center) / m.scale : 0;
      return u;
    });
    const zm = manifest.dims.find((x) => x.key === "zred");
    const zcol = all.subarray(keys.indexOf("zred") * N, (keys.indexOf("zred") + 1) * N);
    const zlo = zm.clo ?? zm.lo, zhi = zm.chi ?? zm.hi;
    const bin = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const t = Number.isFinite(zcol[i]) ? Math.min(1, Math.max(0, (zcol[i] - zlo) / (zhi - zlo))) : 0;
      bin[i] = Math.min(NB - 1, Math.floor(t * NB));
    }
    const byBin = Array.from({ length: NB }, () => []);
    for (let i = 0; i < N; i++) byBin[bin[i]].push(i);

    // linear algebra
    const dot = (a, b) => { let s = 0; for (let i = 0; i < D; i++) s += a[i] * b[i]; return s; };
    function orthonormalise(p, q) {
      let n = Math.sqrt(dot(p, p)) || 1; for (let i = 0; i < D; i++) p[i] /= n;
      const c = dot(q, p); for (let i = 0; i < D; i++) q[i] -= c * p[i];
      n = Math.sqrt(dot(q, q)) || 1; for (let i = 0; i < D; i++) q[i] /= n;
    }
    function slerp(out, a, b, t) {
      let c = Math.max(-1, Math.min(1, dot(a, b)));
      let bb = b;
      if (c < 0) { bb = b.map((v) => -v); c = -c; }
      const w = Math.acos(c);
      if (w < 1e-6) { for (let i = 0; i < D; i++) out[i] = a[i] + t * (bb[i] - a[i]); return; }
      const s = Math.sin(w), s1 = Math.sin((1 - t) * w) / s, s2 = Math.sin(t * w) / s;
      for (let i = 0; i < D; i++) out[i] = s1 * a[i] + s2 * bb[i];
    }
    function decFrame(str) {
      const s = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
      const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
      const a = new Float32Array(b.buffer);
      if (a.length !== 2 * D) throw new Error("frame size");
      return { p: Float64Array.from(a.subarray(0, D)), q: Float64Array.from(a.subarray(D)) };
    }
    function randomFrame() {
      const p = new Float64Array(D), q = new Float64Array(D);
      for (let i = 0; i < D; i++) { p[i] = Math.random() * 2 - 1; q[i] = Math.random() * 2 - 1; }
      orthonormalise(p, q); return { p, q };
    }
    const home = decFrame(HOME_F);
    orthonormalise(home.p, home.q);

    const canvas = document.createElement("canvas");
    canvas.id = "manifold-bg";
    canvas.setAttribute("aria-hidden", "true");
    document.body.prepend(canvas);
    const ctx = canvas.getContext("2d");
    const px = new Float32Array(N), py = new Float32Array(N);
    const P = home.p.slice(), Q = home.q.slice();

    function project(p, q) {
      px.fill(0); py.fill(0);
      for (let d = 0; d < D; d++) {
        const pw = p[d], qw = q[d], u = U[d];
        for (let i = 0; i < N; i++) { px[i] += pw * u[i]; py[i] += qw * u[i]; }
      }
    }
    // fixed world->screen map, fitted once to the saved view (2-98 percentile box)
    let w, h, scale, cx, cy, mx, my;
    function pct(arr, f) { const s = Float32Array.from(arr).sort(); return s[Math.floor(f * (s.length - 1))]; }
    function fit() {
      project(home.p, home.q);
      const x0 = pct(px, .02), x1 = pct(px, .98), y0 = pct(py, .02), y1 = pct(py, .98);
      mx = (x0 + x1) / 2; my = (y0 + y1) / 2;
      const pad = 60;
      scale = Math.min((w - 2 * pad) / ((x1 - x0) || 1), (h - 2 * pad) / ((y1 - y0) || 1)) * CAM.k;
      cx = w / 2 + CAM.x; cy = h / 2 + CAM.y;
    }
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fit(); draw();
    }
    function draw() {
      project(P, Q);
      ctx.clearRect(0, 0, w, h);
      const dark = root.getAttribute("data-theme") === "dark";
      ctx.globalAlpha = dark ? 0.45 : 0.3;
      const r = Math.max(1.6, Math.min(2.6, w / 600));
      for (let b = 0; b < NB; b++) {
        const arr = byBin[b]; if (!arr.length) continue;
        ctx.fillStyle = RAMP[b];
        ctx.beginPath();
        for (const i of arr) {
          const x = cx + (px[i] - mx) * scale, y = cy - (py[i] - my) * scale;
          if (x < -6 || x > w + 6 || y < -6 || y > h + 6) continue;
          ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 6.2832);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    resize();
    window.addEventListener("resize", resize);
    new MutationObserver(draw).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // tour: hold at the saved view, drift out to a random projection, drift back
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    let from = home, to = null, t0 = performance.now() + HOLD, goingHome = false;
    function tick(now) {
      requestAnimationFrame(tick);
      if (document.hidden || now < t0) return;
      if (!to) { to = goingHome ? home : randomFrame(); }
      const t = Math.min(1, (now - t0) / LEG), e = ease(t);
      slerp(P, from.p, to.p, e); slerp(Q, from.q, to.q, e); orthonormalise(P, Q);
      draw();
      if (t >= 1) {
        from = { p: P.slice(), q: Q.slice() };
        t0 = now + (goingHome ? HOLD : 0);
        goingHome = !goingHome; to = null;
      }
    }
    requestAnimationFrame(tick);
  }

  // -----------------------------------------------------------
  //  Starfield
  // -----------------------------------------------------------
  function initStarfield() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const canvas = document.createElement("canvas");
    canvas.id = "stars";
    document.body.prepend(canvas);
    const ctx = canvas.getContext("2d");

    let w, h, dpr, stars = [], shooting = [], nextShot = 0;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Star density scales with viewport area
      const count = Math.round((w * h) / 4200);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.3 + 0.2,
        a: Math.random() * 0.6 + 0.2,
        tw: Math.random() * 0.02 + 0.004,   // twinkle speed
        ph: Math.random() * Math.PI * 2,
      }));
    }

    function spawnShootingStar() {
      const fromTop = Math.random() < 0.6;
      const x = Math.random() * w * 0.8 + w * 0.1;
      const y = fromTop ? -20 : Math.random() * h * 0.4;
      const angle = (Math.PI / 4) + (Math.random() * 0.5 - 0.25); // ~45° down-right
      const speed = Math.random() * 6 + 8;
      shooting.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        len: Math.random() * 120 + 90,
        life: 0,
        maxLife: Math.random() * 50 + 55,
      });
    }

    function accentRGB() {
      // read the live accent colour so the streak matches the theme
      const c = getComputedStyle(root).getPropertyValue("--accent").trim() || "#8ce0b0";
      const m = c.match(/^#?([0-9a-f]{6})$/i);
      if (!m) return "200,235,215";
      const n = parseInt(m[1], 16);
      return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
    }

    function frame(t) {
      requestAnimationFrame(frame);
      if (root.getAttribute("data-theme") !== "dark") { ctx.clearRect(0, 0, w, h); return; }

      ctx.clearRect(0, 0, w, h);

      // Twinkling stars
      for (const s of stars) {
        s.ph += s.tw;
        const a = s.a + Math.sin(s.ph) * 0.25;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0.05, a)})`;
        ctx.fill();
      }

      // Shooting stars
      if (!reduce && t > nextShot) {
        spawnShootingStar();
        nextShot = t + Math.random() * 5500 + 3500; // every ~3.5–9 s
      }
      const rgb = accentRGB();
      for (let i = shooting.length - 1; i >= 0; i--) {
        const m = shooting[i];
        m.x += m.vx; m.y += m.vy; m.life++;
        const fade = 1 - m.life / m.maxLife;
        if (fade <= 0 || m.x > w + 50 || m.y > h + 50) { shooting.splice(i, 1); continue; }
        const tailX = m.x - m.vx / Math.hypot(m.vx, m.vy) * m.len;
        const tailY = m.y - m.vy / Math.hypot(m.vx, m.vy) * m.len;
        const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
        grad.addColorStop(0, `rgba(${rgb},${0.9 * fade})`);
        grad.addColorStop(1, `rgba(${rgb},0)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
        // bright head
        ctx.beginPath();
        ctx.arc(m.x, m.y, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${fade})`;
        ctx.fill();
      }
    }

    resize();
    window.addEventListener("resize", resize);
    requestAnimationFrame(frame);
  }
})();
