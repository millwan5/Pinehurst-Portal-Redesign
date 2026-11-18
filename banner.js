// Header banner styles and the liquid glass control pill.
// Loaded before content.js, which calls window.PPUIBanner.mount(...) and .glass(...).
// Classic is the DOM scene content.js already builds; the other styles draw on a canvas over it.
(() => {
  "use strict";

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const lighten = (c, t) => mix(c, [255, 255, 255], t);
  const darken = (c, t) => mix(c, [0, 0, 0], t);
  const css = (c, a = 1) => (a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`);

  function seeded(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Value noise with fractal octaves; hash(x, y) is a stable random number per tile.
  function makeNoise(seed) {
    const rand = seeded(seed);
    const P = new Uint16Array(512), V = new Float32Array(256);
    const p = [...Array(256).keys()];
    for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 512; i++) P[i] = p[i & 255];
    for (let i = 0; i < 256; i++) V[i] = rand();
    const hash = (x, y) => V[P[P[x & 255] + (y & 255)]];
    const sm = (t) => t * t * (3 - 2 * t);
    const n2 = (x, y) => {
      const ix = Math.floor(x), iy = Math.floor(y), fx = sm(x - ix), fy = sm(y - iy);
      const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    };
    const fbm = (x, y, oct = 4) => {
      let s = 0, amp = 0.5, f = 1, norm = 0;
      for (let o = 0; o < oct; o++) { s += amp * n2(x * f, y * f); norm += amp; amp *= 0.5; f *= 2.03; }
      return s / norm;
    };
    return { fbm, hash };
  }

  // ---- Palettes: the same skies as the Classic scene in styles.css ----
  const SKIES = {
    day:     { sky: ["#2a64cf", "#1446a0", "#10388a"], stops: [0, 0.58, 1], mid: "#123a86", near: "#0b1e45", orb: "#f4f6fa", warm: "#f2c14e", night: 0 },
    dawn:    { sky: ["#17336f", "#3f70c9", "#c3cde0"], stops: [0, 0.55, 1], mid: "#1d4189", near: "#0b1e45", orb: "#fff0d8", warm: "#f6b679", night: 0.25 },
    dusk:    { sky: ["#0e2862", "#2b59b2", "#a7a9ac"], stops: [0, 0.55, 1], mid: "#163a80", near: "#0a1a3e", orb: "#ffe1c2", warm: "#f09a6b", night: 0.4 },
    night:   { sky: ["#040a1a", "#0b1e45", "#142f69"], stops: [0, 0.6, 1], mid: "#081a40", near: "#030817", orb: "#dfe3ea", warm: "#e8c36a", night: 1 },
    darkday: { sky: ["#13357c", "#0f2c69", "#0b2457"], stops: [0, 0.6, 1], mid: "#0c2557", near: "#030817", orb: "#e9edf4", warm: "#e9b949", night: 0.3 },
  };
  // Colour themes: a hue turn and saturation scale applied to the sky and ridge colours.
  const THEMES = {
    blue:     { name: "Blue", h: 0, s: 1 },
    teal:     { name: "Teal", h: -38, s: 1 },
    forest:   { name: "Forest", h: -88, s: 0.75 },
    violet:   { name: "Violet", h: 46, s: 0.95 },
    rose:     { name: "Rose", h: 112, s: 0.8 },
    sunset:   { name: "Sunset", h: 168, s: 0.95 },
    graphite: { name: "Graphite", h: 0, s: 0.1 },
  };
  function shiftColour(c, th) {
    if (!th || (th.h === 0 && th.s === 1)) return c;
    let [r, g, b] = c.map((v) => v / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    let h = 0, s = 0;
    if (mx !== mn) {
      const dd = mx - mn;
      s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
      h = mx === r ? (g - b) / dd + (g < b ? 6 : 0) : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
      h *= 60;
    }
    h = (((h + th.h) % 360) + 360) % 360; s = clamp(s * th.s, 0, 1);
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const tc = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [tc(h / 360 + 1 / 3) * 255, tc(h / 360) * 255, tc(h / 360 - 1 / 3) * 255];
  }

  const palCache = new Map();
  function palette(sky, dark, theme) {
    const key = sky + dark + theme;
    const th = THEMES[theme] || THEMES.blue;
    if (palCache.has(key)) return palCache.get(key);
    const src = dark && sky === "day" ? SKIES.darkday : SKIES[sky] || SKIES.day;
    const p = {
      name: sky, dark, night: src.night, stops: src.stops,
      sky: src.sky.map(hex), mid: hex(src.mid), near: hex(src.near), orb: hex(src.orb), warm: hex(src.warm),
    };
    if (dark && sky !== "night") { p.mid = hex("#0c2557"); p.near = hex("#030817"); }
    p.shift = (c) => shiftColour(c, th);
    p.sky = p.sky.map(p.shift); p.mid = p.shift(p.mid); p.near = p.shift(p.near);
    p.at = (y) => {
      y = clamp(y, 0, 1);
      const s = p.stops;
      for (let i = 1; i < s.length; i++) if (y <= s[i]) return mix(p.sky[i - 1], p.sky[i], (y - s[i - 1]) / (s[i] - s[i - 1]));
      return p.sky[p.sky.length - 1];
    };
    palCache.set(key, p);
    return p;
  }

  // ---- Shared drawing ----
  const lightRight = (S) => S.orb.x > S.w / 2;

  function drawStars(ctx, S) {
    if (S.pal.name !== "night") return;
    const r = seeded(99);
    for (let i = 0; i < 70; i++) {
      const x = r() * S.w, y = r() * S.h * 0.6, s = 0.6 + r() * 1.1;
      const a = 0.45 + 0.4 * Math.sin(S.t * (0.6 + r()) + i);
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
      ctx.fillRect(x + S.px * 4, y, s, s);
    }
  }

  function drawOrb(ctx, S, r) {
    const x = S.orb.x + S.px * 6, y = S.orb.y + S.py * 4;
    if (S.pal.name === "night") {
      ctx.fillStyle = css(S.pal.orb);
      ctx.beginPath(); ctx.arc(x, y, r + 2, 0, TAU); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, r + 2, 0, TAU); ctx.clip();
      ctx.fillStyle = "#b9bec7"; ctx.beginPath(); ctx.arc(x + 9, y + 3, r + 2, 0, TAU); ctx.fill();
      ctx.fillStyle = css(S.pal.orb); ctx.beginPath(); ctx.arc(x - 6, y - 2, r + 1, 0, TAU); ctx.fill();
      ctx.restore();
    } else {
      const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 5);
      g.addColorStop(0, css(S.pal.orb, 0.35)); g.addColorStop(1, css(S.pal.orb, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 5, 0, TAU); ctx.fill();
      ctx.fillStyle = css(S.pal.orb); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
  }

  // A ridge of triangles: a jagged top row and rows of offset points down to the base.
  function lowpolyLayer(rand, w, baseY, peakY, step, rows, rough) {
    const pts = [];
    const cols = Math.ceil((w + 240) / step) + 1;
    for (let r = 0; r <= rows; r++) {
      const row = [];
      for (let c = 0; c <= cols; c++) {
        const off = r % 2 ? step / 2 : 0;
        const x = -120 + c * step + off + (rand() - 0.5) * step * 0.4;
        const y = r === 0 ? peakY + (c % 2 === 0 ? 0 : (baseY - peakY) * (0.25 + rand() * 0.35)) + (rand() - 0.5) * rough : 0;
        row.push({ x, y });
      }
      pts.push(row);
    }
    for (let r = 1; r <= rows; r++) for (let c = 0; c <= cols; c++) {
      const above = pts[0][c].y;
      pts[r][c].y = above + (baseY + 40 - above) * (r / rows) + (rand() - 0.5) * 14;
    }
    return { pts, cols, rows };
  }

  // Each facet is lit by its slope toward the sun's side.
  function drawLowpoly(ctx, S, layer, color, depth) {
    const { pts, cols, rows } = layer;
    const ox = S.px * 30 * depth + Math.sin(S.t * 0.08) * 22 * depth;
    const lx = lightRight(S) ? 0.7 : -0.7;
    const tri = (p0, p1, p2) => {
      const e = (p) => S.h - p.y;
      const ax = p1.x - p0.x, ay = p1.y - p0.y, az = e(p1) - e(p0);
      const bx = p2.x - p0.x, by = p2.y - p0.y, bz = e(p2) - e(p0);
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      const len = Math.hypot(nx, ny, nz) || 1; nx /= len; ny /= len; nz /= len;
      if (nz < 0) { nx = -nx; ny = -ny; }
      const lit = clamp(0.5 + nx * lx * 2.2 + ny * 0.6, 0, 1);
      let c = mix(darken(color, 0.45), mix(color, S.pal.sky[0], 0.5), lit);
      c = mix(c, S.pal.near, S.pal.night * 0.3);
      ctx.fillStyle = ctx.strokeStyle = css(c);
      ctx.beginPath(); ctx.moveTo(p0.x + ox, p0.y); ctx.lineTo(p1.x + ox, p1.y); ctx.lineTo(p2.x + ox, p2.y); ctx.closePath();
      ctx.fill(); ctx.stroke();
    };
    ctx.lineWidth = 0.8;
    for (let r = 0; r < rows; r++) {
      const A = pts[r], B = pts[r + 1];
      for (let c = 0; c < cols; c++) {
        if (r % 2 === 0) { tri(A[c], B[c], A[c + 1]); tri(B[c], A[c + 1], B[c + 1]); }
        else { tri(A[c], B[c], A[c + 1]); tri(A[c + 1], B[c], B[c + 1]); }
      }
    }
  }

  // ---- Styles ----
  const STYLES = {
    mesh: {
      name: "Low Poly",
      init(S) {
        const r = seeded(51), cell = S.thumb ? 20 : S.compact ? 46 : 66;
        const cols = Math.ceil(S.w / cell) + 2, rows = Math.ceil(S.h / cell) + 2;
        S.mesh = [];
        for (let j = 0; j <= rows; j++) {
          const row = [];
          for (let i = 0; i <= cols; i++)
            row.push({ x: (i - 1) * cell + (r() - 0.5) * cell * 0.7, y: (j - 1) * cell + (r() - 0.5) * cell * 0.7, ph: r() * TAU, jit: r() - 0.5 });
          S.mesh.push(row);
        }
        if (S.thumb) {
          // Customise thumbnail: small, crisp facets and two clear ridges.
          S.ridgeFar = lowpolyLayer(r, S.w, S.h, S.h * 0.5, 30, 2, 6);
          S.ridge = lowpolyLayer(r, S.w, S.h, S.h * 0.7, 22, 2, 4);
        } else {
          S.ridgeFar = lowpolyLayer(r, S.w, S.h, S.h * (S.compact ? 0.5 : 0.62), S.compact ? 80 : 130, 2, 20);
          S.ridge = lowpolyLayer(r, S.w, S.h, S.h * (S.compact ? 0.66 : 0.76), S.compact ? 60 : 90, 2, 16);
        }
      },
      draw(ctx, S) {
        // Light-mode daytime gets its own brighter, more saturated sky.
        const rich = S.pal.name === "day" && !S.pal.dark;
        const RICH = ["#5cb2ff", "#3488ff", "#1b63e6", "#1450c4"].map((c) => S.pal.shift(hex(c)));
        const at = rich ? (y) => { y = clamp(y, 0, 1) * 3; const i = Math.min(2, Math.floor(y)); return mix(RICH[i], RICH[i + 1], y - i); } : S.pal.at;
        const contrast = (rich ? 0.2 : 0.12) * (S.thumb ? 1.6 : 1), warm = rich ? hex("#ffd27a") : S.pal.orb;
        const k = S.thumb ? 0.28 : 1; // glow distances shrink with the canvas
        const P = (p) => ({ x: p.x + Math.sin(S.t * 0.5 + p.ph) * 6 + S.px * 8, y: p.y + Math.cos(S.t * 0.4 + p.ph) * 6, jit: p.jit });
        ctx.lineWidth = 0.8;
        const tri = (a, b, c) => {
          const cx = (a.x + b.x + c.x) / 3, cy = (a.y + b.y + c.y) / 3;
          let col = at(cy / S.h);
          const side = ((cx - S.orb.x) / S.w) * (lightRight(S) ? -1 : 1);
          const j = a.jit * contrast + side * 0.06;
          col = j > 0 ? lighten(col, j) : darken(col, -j);
          const d = Math.hypot(cx - S.orb.x, cy - S.orb.y);
          const glow = Math.max(0, 1 - d / ((rich ? 360 : 260) * k));
          col = mix(col, warm, glow * glow * (rich ? 0.5 : 0.35));
          if (rich) col = lighten(col, Math.max(0, 1 - d / (140 * k)) * 0.35);
          if (S.mx != null) col = lighten(col, Math.max(0, 1 - Math.hypot(cx - S.mx, cy - S.my) / 160) * 0.25);
          ctx.fillStyle = ctx.strokeStyle = css(col);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath(); ctx.fill(); ctx.stroke();
          if (S.thumb) { ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 0.5; ctx.stroke(); ctx.lineWidth = 0.8; }
        };
        const M = S.mesh;
        for (let j = 0; j < M.length - 1; j++) for (let i = 0; i < M[j].length - 1; i++) {
          const a = P(M[j][i]), b = P(M[j][i + 1]), c = P(M[j + 1][i]), d = P(M[j + 1][i + 1]);
          if ((i + j) % 2) { tri(a, b, c); tri(b, d, c); } else { tri(a, b, d); tri(a, d, c); }
        }
        drawStars(ctx, S);
        drawOrb(ctx, S, S.thumb ? 6 : (rich ? 18 : 15) * (S.compact ? 0.6 : 1));
        if (rich) {
          drawLowpoly(ctx, S, S.ridgeFar, S.pal.shift(hex("#4f8fe8")), 0.5);
          drawLowpoly(ctx, S, S.ridge, S.pal.shift(hex("#1645a8")), 1);
        } else {
          drawLowpoly(ctx, S, S.ridgeFar, mix(S.pal.mid, S.pal.at(0.8), 0.5), 0.5);
          drawLowpoly(ctx, S, S.ridge, lighten(S.pal.near, 0.06), 1);
        }
      },
    },

    mosaic: {
      name: "Mosaic",
      init(S) {
        S.noise = makeNoise(121);
        S.q = S.compact ? 7 : 11;
        const r = seeded(122), cols = Math.ceil(S.w / S.q) + 1;
        S.skyline = new Float32Array(cols);
        for (let x = 0; x < cols;) {
          const H = (S.compact ? 4 : 7) + Math.floor(r() * (S.compact ? 4 : 8)), hw = Math.max(1, Math.floor(H * 0.32));
          for (let d = -hw; d <= hw; d++) if (x + d >= 0 && x + d < cols) S.skyline[x + d] = Math.max(S.skyline[x + d], H - Math.abs(d) * 2.4);
          x += 2 + Math.floor(r() * 5);
        }
      },
      draw(ctx, S) {
        const q = S.q, N = S.noise, t = S.t, cols = Math.ceil(S.w / q) + 1, rows = Math.ceil(S.h / q) + 1;
        const pal = S.pal, orb = pal.orb, warm = pal.warm, near = pal.near, mid = pal.mid;
        ctx.fillStyle = css(darken(pal.at(0.5), 0.35)); ctx.fillRect(0, 0, S.w, S.h);
        const night = pal.name === "night", golden = pal.name === "dawn" || pal.name === "dusk";
        const sunR = S.compact ? 10 : 18;
        // Clouds: two drifting bands of soft noise. The high one sits above the greeting, the near one
        // (faster, brighter) sits below it, just over the skyline, so the text stays on clear sky.
        // Worked out for the whole frame first, one row above and below the tiles (cloud edges look at
        // their neighbours). A row too far from its band to reach the cloud level needs no noise at all.
        const CLOUD = 0.36, SPREAD = 0.09, size = (rows + 2) * cols;
        if (!S.cloud || S.cloud.length !== size * 2) S.cloud = new Float64Array(size * 2);
        const cloud = S.cloud;
        for (let layer = 0; layer < 2; layer++) {
          const centre = layer ? (S.compact ? 0.42 : 0.6) : 0.12;
          const speed = layer ? 2.6 : 1.1, wide = layer ? 11 : 18, tall = layer ? 3 : 2.6;
          for (let j = -1; j <= rows; j++) {
            const at = layer * size + (j + 1) * cols;
            const band = Math.exp(-((((j * q) / S.h - centre) / SPREAD) ** 2));
            if (band * 1.05 < CLOUD) { cloud.fill(0, at, at + cols); continue; }
            for (let i = 0; i < cols; i++) cloud[at + i] = N.fbm((i + t * speed + layer * 300) / wide, j / tall + layer * 7, 4) * band * 1.05;
          }
        }
        const now = S.now;
        S.ripples = S.ripples.filter((r) => now - r.t0 < 1.8);
        const ripples = S.ripples, hover = S.mx != null, half = q / 2;
        const topLight = night ? 0.08 : 0.3, underWarm = golden ? 0.35 : 0.06;
        // Each tile's colour is kept as three plain numbers (r, g, b) all the way to the fill.
        for (let j = 0; j < rows; j++) {
          const y = j * q, sky = pal.at(y / S.h), fromBottom = rows - 1 - j;
          for (let i = 0; i < cols; i++) {
            const x = i * q;
            let r = sky[0], g = sky[1], b = sky[2], k;
            const n = N.hash(i, j);
            const breathe = Math.sin(t * 1.3 + n * TAU) * 0.05;
            if (n > 0.5) { k = Math.max(0, (n - 0.5) * 0.16 + breathe); r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
            else { k = Math.max(0, (0.5 - n) * 0.2 - breathe); r -= r * k; g -= g * k; b -= b * k; }
            const w1 = Math.sin(i * 0.16 + j * 0.22 - t * 1.7), w2 = Math.sin(i * 0.07 - j * 0.3 - t * 0.9);
            const wave = Math.max(0, w1) * 0.07 + Math.max(0, w2) * 0.04;
            r += (255 - r) * wave; g += (255 - g) * wave; b += (255 - b) * wave;
            for (let layer = 0; layer < 2; layer++) {
              const at = layer * size + (j + 1) * cols + i, v = cloud[at];
              if (v < CLOUD) continue;
              k = night ? 0.1 + layer * 0.05 : 0.32 + layer * 0.14 + (v - CLOUD) * 0.6;
              r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k;
              // Lit along the top edge; shaded and warmed along the bottom.
              if (cloud[at - cols] < CLOUD) { r += (255 - r) * topLight; g += (255 - g) * topLight; b += (255 - b) * topLight; }
              if (cloud[at + cols] < CLOUD) {
                r -= r * 0.1; g -= g * 0.1; b -= b * 0.1;
                r += (warm[0] - r) * underWarm; g += (warm[1] - g) * underWarm; b += (warm[2] - b) * underWarm;
              }
            }
            const od = Math.sqrt((x - S.orb.x) ** 2 + (y - S.orb.y) ** 2);
            if (od < sunR) { r = orb[0]; g = orb[1]; b = orb[2]; }
            else { k = Math.max(0, 1 - od / 220) * 0.28; r += (orb[0] - r) * k; g += (orb[1] - g) * k; b += (orb[2] - b) * k; }
            if (night && N.hash(i + 9, j) > 0.988) { k = 0.35 + 0.35 * Math.sin(t * 3 + i); r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
            const tiles = S.skyline[i] || 0;
            if (fromBottom < 2) { r = near[0]; g = near[1]; b = near[2]; }
            else if (fromBottom < 2 + tiles) {
              if (fromBottom >= 1 + tiles - 0.5) { r = mid[0]; g = mid[1]; b = mid[2]; }
              else { k = 0.3 * ((i + j) % 2) + wave; r = near[0] + (mid[0] - near[0]) * k; g = near[1] + (mid[1] - near[1]) * k; b = near[2] + (mid[2] - near[2]) * k; }
            }
            let lift = w1 > 0.93 && fromBottom >= 2 + tiles ? (w1 - 0.93) * 8 : 0;
            if (N.hash(i * 7 + Math.floor(t * 2.5), j * 3) > 0.996) lift = Math.max(lift, 0.8);
            if (hover) {
              k = Math.max(0, 1 - Math.sqrt((x + half - S.mx) ** 2 + (y + half - S.my) ** 2) / 130);
              if (k > 0) { lift = Math.max(lift, k * 1.2); k *= 0.08; r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
            }
            for (const ripple of ripples) {
              const age = now - ripple.t0, dd = Math.sqrt((x + half - ripple.x) ** 2 + (y + half - ripple.y) ** 2);
              const hit = Math.exp(-(((dd - age * 480) / 26) ** 2)) * (1 - age / 1.8);
              if (hit > 0.02) { lift = Math.max(lift, hit * 1.6); k = hit * 0.25; r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
            }
            if (lift > 0) {
              ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.fillRect(x + 1, y + 1 + lift * 2, q - 1, q - 1);
              k = lift * 0.18; r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k;
            }
            ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
            ctx.fillRect(x + 0.5, y + 0.5 - lift * 2.5, q - 1, q - 1);
          }
        }
      },
      clicks: true,
    },
  };

  STYLES.solid = {
    name: "Solid",
    still: true,
    init() {},
    draw(ctx, S) {
      ctx.fillStyle = css(S.pal.shift(hex("#1f55b8")));
      ctx.fillRect(0, 0, S.w, S.h);
    },
  };

  // ---- Mount: one canvas in the header scene, redrawn ~30 times a second while on screen ----
  function mount(header, scene, initial, initialTheme) {
    const canvas = document.createElement("canvas");
    canvas.className = "ppui-banner-canvas";
    canvas.setAttribute("aria-hidden", "true");
    scene.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    let style = null, S = null, visible = true, raf = 0, last = 0, ptr = null, theme = "blue";
    const t0 = performance.now();

    function sizeUp() {
      const r = scene.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
      const dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      S = { w, h, dpr, compact: header.classList.contains("is-compact"), t: 0, now: 0, px: 0, py: 0, mx: null, my: null, ripples: [] };
      if (style) STYLES[style].init(S);
    }

    function frame(now) {
      if (!style || !S) return;
      const moving = !reduce.matches;
      S.t = moving ? (now - t0) / 1000 : 0;
      S.now = now / 1000;
      const sky = scene.dataset.sky || "day";
      // The banner looks the same in light and dark mode.
      S.pal = palette(sky, false, theme);
      const cs = scene.style;
      S.orb = { x: (parseFloat(cs.getPropertyValue("--orb-x")) || 70) / 100 * S.w, y: (parseFloat(cs.getPropertyValue("--orb-y")) || 30) / 100 * S.h };
      const tx = ptr ? (ptr.x / S.w - 0.5) * 2 : 0, ty = ptr ? (ptr.y / S.h - 0.5) * 2 : 0;
      S.px += (tx - S.px) * 0.08; S.py += (ty - S.py) * 0.08;
      S.mx = ptr ? ptr.x : null; S.my = ptr ? ptr.y : null;
      ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
      ctx.clearRect(0, 0, S.w, S.h);
      STYLES[style].draw(ctx, S);
    }

    function loop(now) {
      raf = 0;
      if (!style || !visible || document.hidden) return;
      if (now - last >= 32) {
        last = now;
        // content.js sets __ppuiCost while it is counting frame times (see reportPerf there).
        const cost = window.__ppuiCost, from = cost ? performance.now() : 0;
        frame(now);
        if (cost) { cost.banner = (cost.banner || 0) + performance.now() - from; cost.bannerFrames = (cost.bannerFrames || 0) + 1; }
      }
      if (STYLES[style].still) return;
      if (!reduce.matches || ptr || (S && S.ripples.length)) raf = requestAnimationFrame(loop);
    }
    const kick = () => { if (!raf && style) raf = requestAnimationFrame(loop); };

    function setStyle(id) {
      header.setAttribute("data-ppui-banner", id);
      style = STYLES[id] ? id : null;
      canvas.hidden = !style;
      if (style) { sizeUp(); frame(performance.now()); kick(); }
    }

    new ResizeObserver(() => { if (style) { sizeUp(); frame(performance.now()); } }).observe(scene);
    new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; kick(); }).observe(header);
    document.addEventListener("visibilitychange", kick);
    // Redraw when the theme flips or the sky changes with the clock.
    new MutationObserver(() => { if (style) frame(performance.now()); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-ppui-theme"] });
    new MutationObserver(() => { if (style) frame(performance.now()); }).observe(scene, { attributes: true, attributeFilter: ["data-sky", "style"] });

    header.addEventListener("pointermove", (e) => {
      const r = scene.getBoundingClientRect();
      ptr = { x: e.clientX - r.left, y: e.clientY - r.top };
      kick();
    });
    header.addEventListener("pointerleave", () => { ptr = null; kick(); });
    // A click on the open sky (not on a link or control) sends a ripple through the Mosaic.
    header.addEventListener("pointerdown", (e) => {
      if (!style || !STYLES[style].clicks || !S || e.target.closest("a, button, input, nav, [role='button']")) return;
      const r = scene.getBoundingClientRect();
      S.ripples.push({ x: e.clientX - r.left, y: e.clientY - r.top, t0: performance.now() / 1000 });
      kick();
    });

    function setTheme(id) {
      theme = THEMES[id] ? id : "blue";
      header.setAttribute("data-ppui-palette", theme);
      // The colour theme recolours the whole page, not just the banner.
      if (theme === "blue") document.documentElement.removeAttribute("data-ppui-palette");
      else document.documentElement.setAttribute("data-ppui-palette", theme);
      if (style) frame(performance.now());
    }

    setTheme(initialTheme);
    setStyle(initial);
    return { setStyle, setTheme };
  }

  // ---- Liquid glass ----
  // Liquid glass, modelled on a thick drop of clear glass:
  //  - The body is clear. A dome-shaped lens map bends the scene behind it, gently in the middle and
  //    strongly toward the rim, so the edges magnify and curve what's behind like a drop of water.
  //  - Dispersion is real but small: red, green and blue bend by slightly different amounts, so colour
  //    only appears where the scene behind has an edge, and mostly near the rim, as in real glass.
  //  - The rim catches the light as a white specular line (top-left strong, bottom-right reflection),
  //    with a faint red fringe on its outside and blue on its inside, and light gathers softly in the
  //    bottom of the drop (a caustic).
  // Chromium only; other browsers keep the frosted blur from styles.css.
  const canRefract = typeof CSS !== "undefined" && CSS.supports("backdrop-filter", "url(#x)") && !/Firefox\//.test(navigator.userAgent);
  const lenses = new Map();
  let defs = null;

  // A lens's two pictures (its bend map and its light) depend on its size alone and take a few
  // milliseconds to draw, so they are kept between visits, a handful of sizes at most.
  // The number in the key goes up whenever lensImages changes what it draws.
  const LENS_KEY = "ppui-lens-1";
  const LENS_SIZES = 8;
  const PNG = /^data:image\/png;base64,[A-Za-z0-9+\/=]+$/;
  let lensStore = null;

  function savedLens(key, draw) {
    if (!lensStore) {
      try { lensStore = JSON.parse(localStorage.getItem(LENS_KEY)) || {}; } catch (e) { lensStore = {}; }
    }
    const had = lensStore[key];
    if (Array.isArray(had) && had.length === 2 && had.every((url) => typeof url === "string" && PNG.test(url))) return had;
    const made = draw();
    const keys = Object.keys(lensStore);
    if (keys.length >= LENS_SIZES) delete lensStore[keys[0]];
    lensStore[key] = made;
    try { localStorage.setItem(LENS_KEY, JSON.stringify(lensStore)); } catch (e) {}
    return made;
  }

  function lensImages(w, h) {
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const g = cv.getContext("2d"), img = g.createImageData(w, h), d = img.data;
    const r = h / 2, bevel = Math.min(22, h * 0.48), cx = w / 2, cy = h / 2;
    const sdf = (x, y) => {
      const px = x + 0.5 - cx, py = y + 0.5 - cy;
      const qx = Math.abs(px) - (w / 2 - r), qy = Math.abs(py) - (h / 2 - r);
      if (qx > 0 && qy > 0) { const L = Math.hypot(qx, qy) || 1; return { px, py, dist: L - r, nx: (qx / L) * Math.sign(px), ny: (qy / L) * Math.sign(py) }; }
      return qx > qy ? { px, py, dist: qx - r, nx: Math.sign(px), ny: 0 } : { px, py, dist: qy - r, nx: 0, ny: Math.sign(py) };
    };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const { dist, nx, ny } = sdf(x, y);
      const t = clamp(1 + dist / bevel, 0, 1);
      const s = t * t * (0.6 + 0.4 * t);           // dome: soft in the middle, steep at the rim
      const k = (y * w + x) * 4;
      d[k] = 128 - nx * s * 127; d[k + 1] = 128 - ny * s * 127; d[k + 2] = 128; d[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const mapURL = cv.toDataURL();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const { px, py, dist } = sdf(x, y);
      const depth = -dist;
      const k = (y * w + x) * 4;
      if (depth < 0) { d[k + 3] = 0; continue; }
      const tl = clamp(-(py / (h / 2)) * 0.75 - (px / (w / 2)) * 0.45, 0, 1);
      const br = clamp((py / (h / 2)) * 0.75 + (px / (w / 2)) * 0.45, 0, 1);
      const light = 0.12 + 0.88 * Math.max(tl, br * 0.45);
      const core = Math.exp(-(((depth - 1.5) / 0.85) ** 2)) * light * 0.85;
      const red = Math.exp(-(((depth - 0.7) / 0.55) ** 2)) * light * 0.28;
      const blue = Math.exp(-(((depth - 2.6) / 0.7) ** 2)) * light * 0.28;
      const bottom = clamp(py / (h / 2), 0, 1);
      const caustic = Math.exp(-(((depth - h * 0.17) / (h * 0.09)) ** 2)) * bottom * bottom * 0.13;
      const R = core + red + caustic, G = core + caustic, B = core + blue + caustic;
      const m = Math.min(1, Math.max(R, G, B));
      if (m < 0.01) { d[k + 3] = 0; continue; }
      d[k] = Math.min(255, (R / m) * 255); d[k + 1] = Math.min(255, (G / m) * 255); d[k + 2] = Math.min(255, (B / m) * 255); d[k + 3] = m * 255;
    }
    g.putImageData(img, 0, 0);
    return [mapURL, cv.toDataURL()];
  }

  function makeLens(w, h) {
    const key = w + "x" + h;
    if (lenses.has(key)) return lenses.get(key);
    const [mapURL, lightURL] = savedLens(key, () => lensImages(w, h));

    if (!defs) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "0"); svg.setAttribute("height", "0"); svg.setAttribute("aria-hidden", "true");
      svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
      defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      svg.appendChild(defs);
      document.body.appendChild(svg);
    }
    const id = "ppui-lens-" + key;
    const f = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    f.setAttribute("id", id);
    for (const [a, v] of [["x", "0"], ["y", "0"], ["width", "100%"], ["height", "100%"], ["color-interpolation-filters", "sRGB"]]) f.setAttribute(a, v);
    const chans = [["r", 30, "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"], ["g", 36, "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"], ["b", 42, "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"]];
    f.innerHTML =
      `<feImage href="${mapURL}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map"/>` +
      `<feImage href="${lightURL}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="light"/>` +
      `<feGaussianBlur in="SourceGraphic" stdDeviation="0.5" result="src"/>` +
      chans.map(([c, sc, m]) =>
        `<feDisplacementMap in="src" in2="map" scale="${sc}" xChannelSelector="R" yChannelSelector="G" result="d${c}"/>` +
        `<feColorMatrix in="d${c}" type="matrix" values="${m}" result="${c}"/>`).join("") +
      `<feBlend in="r" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b" mode="screen" result="bent"/>` +
      `<feBlend in="light" in2="bent" mode="screen"/>`;
    defs.appendChild(f);
    lenses.set(key, id);
    return id;
  }

  function glass(pill) {
    pill.classList.add("ppui-glass");
    // The sheen follows the pointer.
    pill.addEventListener("pointermove", (e) => {
      const r = pill.getBoundingClientRect();
      pill.style.setProperty("--hx", (((e.clientX - r.left) / r.width) * 100).toFixed(1) + "%");
      pill.style.setProperty("--hy", (((e.clientY - r.top) / r.height) * 100).toFixed(1) + "%");
    });
    pill.addEventListener("pointerleave", () => { pill.style.removeProperty("--hx"); pill.style.removeProperty("--hy"); });
    // Liquid: pressing squashes the glass toward the finger, and it springs back on release.
    pill.addEventListener("pointerdown", (e) => {
      const r = pill.getBoundingClientRect();
      pill.style.setProperty("--px", (((e.clientX - r.left) / r.width) * 100).toFixed(1) + "%");
      pill.classList.add("is-pressed");
    });
    const release = () => pill.classList.remove("is-pressed");
    pill.addEventListener("pointerup", release);
    pill.addEventListener("pointercancel", release);
    pill.addEventListener("pointerleave", release);
    if (!canRefract) return;
    new ResizeObserver(() => {
      const w = Math.round(pill.offsetWidth), h = Math.round(pill.offsetHeight);
      if (!w || !h) return;
      pill.style.backdropFilter = `url(#${makeLens(w, h)}) saturate(1.15) brightness(1.04)`;
    }).observe(pill);
  }

  // A small still of a style, for the Customise panel.
  function preview(id, canvas, theme) {
    const dpr = Math.min(2, devicePixelRatio || 1), w = canvas.clientWidth || 96, h = canvas.clientHeight || 54;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const S = { w, h, compact: true, thumb: true, t: 0, now: 0, px: 0, py: 0, mx: null, my: null, ripples: [], pal: palette("day", false, theme), orb: { x: w * 0.72, y: h * 0.3 } };
    if (STYLES[id]) { STYLES[id].init(S); STYLES[id].draw(ctx, S); }
  }

  window.PPUIBanner = {
    preview,
    styles: [["mesh", STYLES.mesh.name], ["mosaic", STYLES.mosaic.name], ["solid", STYLES.solid.name]],
    themes: Object.entries(THEMES).map(([id, t]) => {
      const c = shiftColour(hex("#2a64cf"), t);
      return [id, t.name, `rgb(${c.map((v) => Math.round(v)).join(",")})`];
    }),
    mount,
    glass,
  };
})();
