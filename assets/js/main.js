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

    initStarfield();
  });

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
