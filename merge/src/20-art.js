// ===== ART (Ash): every picture in Saarepagar is drawn here with canvas paths. =====
// Items, icons and portraits are drawn once into cached canvases. Scenes cache their still layer and add a light
// animated layer on top. Item art lives in 21-items.js, scenes in 22-scenes.js, portraits in 23-people.js.
// Item levels are 1-based: ART.item('pagar', 1, 64) is the flour sack.
const ART = (function () {
  const A = {};
  // ---- palette (warm, soft, one family) ----
  const C = A.C = {
    ink: '#4a2a1c', cream: '#fff6e6', paper: '#fbefd9', paper2: '#f3dfbd', flour: '#f4ead6', dough: '#f7e2bb',
    crust: '#d98f45', crustD: '#b8682d', gold: '#f2b84b', goldD: '#c98a1f', honey: '#f5a623', red: '#e2574c',
    rose: '#f28b9b', pink: '#f7b6c2', berry: '#c23b5a', blue: '#5b8fd9', blueL: '#9cc3f0', sea: '#4aa3c7', seaD: '#2f7ea3',
    leaf: '#6dbb5a', leafD: '#3f8f43', mint: '#a8dcb0', wood: '#b9784a', woodL: '#d9a06b', woodD: '#8a5232',
    stone: '#b9b2a6', stoneD: '#8c857b', iron: '#8e98a6', silver: '#c9d3dd', white: '#ffffff', lilac: '#b79be0',
    teal: '#4fb3a6', choc: '#7a4a2e', amber: '#f0a030', sky: '#bfe3f2', skyD: '#8cc9e6', night: '#2c3566'
  };
  // ---- colour maths (cached) ----
  const _rgb = {};
  function rgb(c) {
    let v = _rgb[c]; if (v) return v;
    let h = c.replace('#', ''); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    v = _rgb[c] = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; return v;
  }
  const _mix = {};
  function mix(a, b, t) {
    const k = a + b + t; let v = _mix[k]; if (v) return v;
    const x = rgb(a), y = rgb(b), f = n => ('0' + Math.round(x[n] + (y[n] - x[n]) * t).toString(16)).slice(-2);
    return (_mix[k] = '#' + f(0) + f(1) + f(2));
  }
  const lt = (c, t) => mix(c, '#fffaf0', t), dk = (c, t) => mix(c, '#3a1c10', t);
  function rgba(c, a) { const v = rgb(c); return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + a + ')'; }
  A.mix = mix; A.lt = lt; A.dk = dk; A.rgba = rgba;

  // ---- canvas helpers ----
  function mk(w, h) {
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c;
  }
  A.mk = mk;
  const OL = 4.2; // outline width in 100-unit item space
  // paths: each starts a new path
  function E(g, x, y, rx, ry, rot) { g.beginPath(); g.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot || 0, 0, Math.PI * 2); }
  function rrp(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function R(g, x, y, w, h, r) { g.beginPath(); rrp(g, x, y, w, h, r); }
  function PL(g, p, open) { g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); if (!open) g.closePath(); }
  // smooth curve through points (catmull-rom); closed unless open
  function SM(g, p, open, nb) {
    const n = p.length / 2; if (!nb) g.beginPath();
    const P = i => { i = open ? Math.max(0, Math.min(n - 1, i)) : (i + n) % n; return [p[i * 2], p[i * 2 + 1]]; };
    const s = P(0); if (!nb) g.moveTo(s[0], s[1]); else g.lineTo(s[0], s[1]);
    const m = open ? n - 1 : n;
    for (let i = 0; i < m; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
    }
    if (!open) g.closePath();
  }
  // fill the current path with soft light-from-top-left shading, then a bold warm outline
  function paint(g, col, cx, cy, r, ol) {
    const gr = g.createRadialGradient(cx - r * .38, cy - r * .45, r * .05, cx, cy, r * 1.25);
    gr.addColorStop(0, lt(col, .45)); gr.addColorStop(.5, col); gr.addColorStop(1, dk(col, .25));
    g.fillStyle = gr; g.fill();
    if (ol !== 0) { g.lineWidth = ol || OL; g.strokeStyle = dk(col, .62); g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
  }
  // flat fill + outline (for small details)
  function flat(g, col, ol, olc) {
    g.fillStyle = col; g.fill();
    if (ol !== 0) { g.lineWidth = ol || OL * .8; g.strokeStyle = olc || dk(col, .62); g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
  }
  // vertical gradient fill + outline
  function vpaint(g, col, y0, y1, ol) {
    const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, lt(col, .35)); gr.addColorStop(.55, col); gr.addColorStop(1, dk(col, .22));
    g.fillStyle = gr; g.fill();
    if (ol !== 0) { g.lineWidth = ol || OL; g.strokeStyle = dk(col, .62); g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
  }
  function stroke(g, col, w, a) { g.lineWidth = w; g.strokeStyle = a != null ? rgba(col, a) : col; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); }
  function line(g, pts, col, w, a, smooth) { if (smooth) SM(g, pts, true); else PL(g, pts, true); stroke(g, col, w, a); }
  function HL(g, x, y, rx, ry, rot, a) { E(g, x, y, rx, ry, rot); g.fillStyle = 'rgba(255,255,255,' + (a == null ? .55 : a) + ')'; g.fill(); }
  function dot(g, x, y, r, col) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = col; g.fill(); }
  // 4-point sparkle
  function spark(g, x, y, r, col, a) {
    g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r);
    g.fillStyle = a != null ? rgba(col || '#ffffff', a) : (col || '#ffffff'); g.fill();
  }
  function star(g, x, y, r, ri, n, rot) {
    n = n || 5; ri = ri || r * .5; rot = rot == null ? -Math.PI / 2 : rot; g.beginPath();
    for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, q = i % 2 ? ri : r; g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * q, y + Math.sin(a) * q); }
    g.closePath();
  }
  // soft rounded star (puffy)
  function pstar(g, x, y, r, rot) {
    rot = rot == null ? -Math.PI / 2 : rot; const p = [];
    for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5, q = i % 2 ? r * .52 : r; p.push(x + Math.cos(a) * q, y + Math.sin(a) * q); }
    SM(g, p);
  }
  function heart(g, x, y, s) {
    g.beginPath(); g.moveTo(x, y + s * .35);
    g.bezierCurveTo(x - s * 1.1, y - s * .3, x - s * .45, y - s * 1.05, x, y - s * .45);
    g.bezierCurveTo(x + s * .45, y - s * 1.05, x + s * 1.1, y - s * .3, x, y + s * .35); g.closePath();
  }
  function shadow(g, x, y, rx, ry, a) { E(g, x, y, rx, ry); g.fillStyle = 'rgba(90,45,20,' + (a == null ? .18 : a) + ')'; g.fill(); }
  // tiny cute face
  function face(g, x, y, s, blush) {
    dot(g, x - s, y, s * .32, C.ink); dot(g, x + s, y, s * .32, C.ink);
    dot(g, x - s + s * .12, y - s * .12, s * .1, '#fff'); dot(g, x + s + s * .12, y - s * .12, s * .1, '#fff');
    g.beginPath(); g.arc(x, y + s * .25, s * .38, .2, Math.PI - .2); stroke(g, C.ink, s * .2);
    if (blush !== false) { E(g, x - s * 1.7, y + s * .55, s * .45, s * .28); g.fillStyle = 'rgba(240,110,110,.35)'; g.fill(); E(g, x + s * 1.7, y + s * .55, s * .45, s * .28); g.fill(); }
  }
  // seeded random for stable decoration
  function srnd(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const H = A.H = { E, R, rrp, PL, SM, paint, flat, vpaint, stroke, line, HL, dot, spark, star, pstar, heart, shadow, face, srnd, OL, C, lt, dk, mix, rgba, mk };

  // device pixel scale of a context (so caches render crisp at the real resolution)
  function scaleOf(ctx) { try { const m = ctx.getTransform(); return Math.max(.5, Math.min(4, Math.hypot(m.a, m.b))); } catch (e) { return A.dpr || 1; } }
  A.scaleOf = scaleOf;
  A.dpr = Math.min(3, window.devicePixelRatio || 1);

  // ---- item registry ----
  // A.defs[chain] = [draw(g) for level 1, level 2, ...] in 100x100 space; A.names[name] = [chain, level]
  A.defs = {}; A.names = {}; A.labels = {};
  A.def = function (chain, list) { // list: [[name, drawFn], ...]
    A.defs[chain] = list.map(e => e[1]); A.labels[chain] = list.map(e => e[0]);
    list.forEach((e, i) => { if (!A.names[e[0]]) A.names[e[0]] = [chain, i + 1]; });
  };
  A.alias = {}; // A.alias['bakery'] = 'pagar' lets other code use its own keys
  A.maxLevel = function (chain) { const d = A.defs[chain] || A.defs[A.alias[chain]]; return d ? d.length : 0; };
  const cache = new Map(); let cacheN = 0;
  function resolve(chain, level) {
    let k = A.defs[chain] ? chain : (A.alias[chain] || chain);
    if (!A.defs[k] && A.names[k]) { const n = A.names[k]; return [n[0], n[1] + (level > 1 ? level - 1 : 0)]; }
    return [k, level];
  }
  A.item = function (chain, level, px) {
    px = Math.max(8, Math.round(px || 64)); level = Math.max(1, level | 0 || 1);
    const key = chain + '|' + level + '|' + px; let c = cache.get(key); if (c) return c;
    const [k, lv] = resolve(chain, level), d = A.defs[k];
    c = mk(px, px); const g = c.getContext('2d'); g.scale(px / 100, px / 100);
    try {
      if (d) { const f = d[Math.min(lv, d.length) - 1]; f(g, Math.min(lv, d.length), lv > d.length ? lv - d.length : 0); if (lv >= d.length && d.length > 2) maxTwinkle(g); }
      else fallback(g, k, lv);
    } catch (e) { console.error('ART.item', chain, level, e); }
    if (++cacheN > 360) { cache.clear(); cacheN = 0; }
    cache.set(key, c); return c;
  };
  A.clearCache = function () { cache.clear(); cacheN = 0; for (const k in _ic) delete _ic[k]; for (const k in _pc) delete _pc[k]; A._sceneCache && A._sceneCache.clear(); };
  // the top item of a chain gets two tiny sparkles
  function maxTwinkle(g) { spark(g, 84, 14, 7, '#fff7c2'); spark(g, 14, 30, 4.5, '#fff7c2'); spark(g, 84, 14, 3.5, '#ffffff'); }
  // unknown key: a soft gem with level pips, so nothing ever breaks
  function fallback(g, k, lv) {
    let h = 0; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
    const cols = [C.rose, C.blue, C.leaf, C.gold, C.lilac, C.teal, C.crust], col = cols[h % cols.length];
    shadow(g, 50, 88, 30, 6); R(g, 18, 18, 64, 64, 22); paint(g, col, 50, 50, 40); HL(g, 36, 32, 12, 7, -.5, .5);
    for (let i = 0; i < Math.min(lv, 6); i++) { dot(g, 50 + (i - (Math.min(lv, 6) - 1) / 2) * 9, 66, 3.2, '#fff'); }
  }

  // ---- bubble overlay for bonus items ----
  A.bubble = function (px) {
    px = Math.round(px || 64); const key = 'bubble|' + px; let c = cache.get(key); if (c) return c;
    c = mk(px, px); const g = c.getContext('2d'); g.scale(px / 100, px / 100);
    const gr = g.createRadialGradient(50, 50, 30, 50, 50, 47); gr.addColorStop(0, 'rgba(190,230,255,0.05)'); gr.addColorStop(.8, 'rgba(170,215,255,0.22)'); gr.addColorStop(1, 'rgba(120,180,240,0.55)');
    E(g, 50, 50, 46, 46); g.fillStyle = gr; g.fill(); g.lineWidth = 2.5; g.strokeStyle = 'rgba(255,255,255,.85)'; g.stroke();
    g.beginPath(); g.arc(50, 50, 38, Math.PI * 1.1, Math.PI * 1.45); stroke(g, '#ffffff', 5, .8);
    HL(g, 70, 72, 6, 3.5, -.7, .5); spark(g, 30, 26, 5, '#ffffff', .95);
    cache.set(key, c); return c;
  };

  // ---- board cell ----
  const _cell = {};
  A.cell = function (ctx, x, y, s, state) {
    const sc = scaleOf(ctx), px = Math.round(s * sc), key = (state || 'empty') + px;
    let c = _cell[key];
    if (!c) {
      c = _cell[key] = mk(px, px); const g = c.getContext('2d'); g.scale(px / 100, px / 100);
      const st = state || 'empty';
      if (st === 'locked') {
        R(g, 4, 5, 92, 92, 18); g.fillStyle = 'rgba(110,70,45,.20)'; g.fill();
        R(g, 4, 3, 92, 90, 18); g.fillStyle = '#d9c2a0'; g.fill();
        g.save(); R(g, 4, 3, 92, 90, 18); g.clip(); g.strokeStyle = 'rgba(150,105,70,.18)'; g.lineWidth = 7;
        for (let i = -100; i < 200; i += 22) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 100, 100); g.stroke(); } g.restore();
        R(g, 4, 3, 92, 90, 18); g.lineWidth = 2.5; g.strokeStyle = 'rgba(140,95,60,.35)'; g.stroke();
        // tiny padlock
        g.beginPath(); g.arc(50, 44, 8, Math.PI, 0); stroke(g, '#a78a6b', 4);
        R(g, 39, 44, 22, 17, 5); g.fillStyle = '#b89c7a'; g.fill(); dot(g, 50, 52, 2.4, '#8a6e52');
      } else {
        R(g, 4, 6, 92, 91, 18); g.fillStyle = 'rgba(150,95,55,.16)'; g.fill();
        const base = st === 'hint' ? '#dff2c8' : st === 'target' ? '#ffe7a8' : '#fbf1de';
        R(g, 4, 3, 92, 90, 18);
        const gr = g.createLinearGradient(0, 3, 0, 93); gr.addColorStop(0, lt(base, .5)); gr.addColorStop(1, base);
        g.fillStyle = gr; g.fill();
        R(g, 8, 6, 84, 30, 14); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill();
        R(g, 4, 3, 92, 90, 18); g.lineWidth = st === 'empty' ? 2 : 4.5;
        g.strokeStyle = st === 'hint' ? '#8fcf6e' : st === 'target' ? '#f0a83a' : 'rgba(190,140,95,.35)'; g.stroke();
        if (st === 'target') { spark(g, 82, 18, 6, '#fff'); }
      }
    }
    ctx.drawImage(c, x, y, s, s);
  };

  // ---- icons ----
  const _ic = {};
  A.iconDefs = {};
  A.icon = function (name, px) {
    px = Math.round(px || 32); const key = name + '|' + px; let c = _ic[key]; if (c) return c;
    c = _ic[key] = mk(px, px); const g = c.getContext('2d'); g.scale(px / 100, px / 100);
    const f = A.iconDefs[name];
    try { if (f) f(g); else fallback(g, name, 1); } catch (e) { console.error('ART.icon', name, e); }
    return c;
  };
  const I = A.iconDefs;
  I.energy = g => {
    PL(g, [58, 6, 20, 56, 46, 56, 38, 94, 80, 40, 54, 40, 66, 6]); vpaint(g, '#ffd23f', 6, 94, 6);
    HL(g, 44, 26, 6, 13, .6, .55);
  };
  I.coin = g => {
    E(g, 50, 54, 40, 40); flat(g, C.goldD, 6, '#8a5a12'); E(g, 50, 48, 40, 40); paint(g, '#ffc94a', 50, 48, 40, 6);
    E(g, 50, 48, 28, 28); stroke(g, '#d9962a', 4); pstar(g, 50, 48, 15); g.fillStyle = '#e8a432'; g.fill();
    HL(g, 34, 30, 9, 5, -.7, .7);
  };
  I.star = g => { pstar(g, 50, 54, 46); paint(g, '#ffcf3d', 50, 50, 44, 6); HL(g, 38, 38, 8, 5, -.6, .7); spark(g, 82, 18, 7); };
  I.xp = g => {
    E(g, 50, 50, 42, 42); paint(g, '#7ec8e3', 50, 50, 42, 6); pstar(g, 50, 52, 26); g.fillStyle = '#fff'; g.fill();
    HL(g, 34, 30, 9, 5, -.7, .6);
  };
  I.gift = g => {
    R(g, 14, 42, 72, 50, 8); paint(g, C.red, 50, 60, 40, 6); R(g, 8, 30, 84, 18, 6); paint(g, '#ef6b60', 50, 36, 40, 6);
    R(g, 43, 30, 14, 62, 2); flat(g, '#ffd36b', 0); g.beginPath(); g.moveTo(43, 30); g.lineTo(43, 92); g.moveTo(57, 30); g.lineTo(57, 92); stroke(g, '#c08a2a', 3);
    E(g, 36, 22, 13, 9, .5); paint(g, '#ffd36b', 36, 22, 12, 5); E(g, 64, 22, 13, 9, -.5); paint(g, '#ffd36b', 64, 22, 12, 5); dot(g, 50, 28, 6, '#ffc33d');
    HL(g, 26, 52, 5, 10, 0, .4);
  };
  I.bag = g => {
    g.beginPath(); g.moveTo(26, 34); g.quadraticCurveTo(10, 90, 30, 92); g.lineTo(70, 92); g.quadraticCurveTo(90, 90, 74, 34); g.closePath(); paint(g, '#c98b55', 50, 62, 42, 6);
    R(g, 24, 26, 52, 14, 6); paint(g, '#a86a3c', 50, 32, 30, 5); g.beginPath(); g.arc(50, 26, 14, Math.PI, 0); stroke(g, '#7a4a2a', 6);
    R(g, 42, 52, 16, 13, 4); flat(g, '#ffd36b', 4, '#a3742a'); HL(g, 32, 56, 4, 12, .1, .35);
  };
  I.shop = g => {
    R(g, 14, 42, 72, 48, 6); paint(g, C.cream, 50, 64, 40, 6); R(g, 40, 58, 20, 32, 4); paint(g, C.wood, 50, 74, 18, 4);
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(8 + i * 16.8, 22); g.lineTo(8 + (i + 1) * 16.8, 22); g.lineTo(8 + (i + 1) * 16.8, 40); g.arc(8 + i * 16.8 + 8.4, 40, 8.4, 0, Math.PI); g.closePath(); flat(g, i % 2 ? '#fff6e6' : C.red, 4, '#8a3328'); }
  };
  I.settings = g => {
    const p = []; for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8 + Math.PI / 16, r = i % 2 ? 34 : 44; p.push(50 + Math.cos(a) * r, 50 + Math.sin(a) * r); }
    PL(g, p); g.lineJoin = 'round'; paint(g, '#a7b2c0', 50, 50, 44, 6); E(g, 50, 50, 14, 14); flat(g, '#f4ead6', 5, '#5d6673');
    HL(g, 34, 30, 8, 4, -.7, .55);
  };
  I.check = g => { E(g, 50, 50, 44, 44); paint(g, '#6ccf6a', 50, 50, 44, 6); PL(g, [28, 52, 44, 67, 73, 35], true); stroke(g, '#fff', 11); HL(g, 34, 28, 9, 5, -.7, .5); };
  I.lock = g => {
    g.beginPath(); g.arc(50, 42, 20, Math.PI, 0); g.lineTo(70, 50); g.moveTo(30, 50); g.lineTo(30, 42); stroke(g, '#7d8794', 12); g.beginPath(); g.arc(50, 42, 20, Math.PI, 0); stroke(g, '#b6c0cc', 6);
    R(g, 20, 46, 60, 46, 10); paint(g, '#f2b84b', 50, 66, 34, 6); E(g, 50, 63, 6, 6); flat(g, '#8a5a12', 0); R(g, 47, 64, 6, 14, 3); flat(g, '#8a5a12', 0);
    HL(g, 30, 56, 4, 9, 0, .5);
  };
  I.chest = g => { A.drawChest(g, 1, false); };
  I.bubble = g => { g.drawImage(A.bubble(100), 0, 0, 100, 100); spark(g, 60, 55, 8, '#c6e6ff'); };
  I.heart = g => { heart(g, 50, 56, 40); paint(g, C.rose, 50, 50, 40, 6); HL(g, 34, 36, 7, 5, -.6, .6); };
  I.close = g => { E(g, 50, 50, 42, 42); paint(g, '#e8796b', 50, 50, 42, 6); PL(g, [34, 34, 66, 66], true); stroke(g, '#fff', 10); PL(g, [66, 34, 34, 66], true); stroke(g, '#fff', 10); };
  I.music = g => { E(g, 34, 74, 14, 11, -.3); paint(g, '#8a6bd1', 34, 74, 14, 5); E(g, 70, 66, 14, 11, -.3); paint(g, '#8a6bd1', 70, 66, 14, 5); PL(g, [46, 72, 46, 18, 82, 10, 82, 64], true); stroke(g, '#5c44a0', 6); };
  I.sound = g => { PL(g, [14, 38, 32, 38, 54, 18, 54, 82, 32, 62, 14, 62]); paint(g, '#8e98a6', 34, 50, 34, 5); g.beginPath(); g.arc(56, 50, 20, -.8, .8); stroke(g, '#5d6673', 6); g.beginPath(); g.arc(56, 50, 34, -.8, .8); stroke(g, '#5d6673', 6); };
  I.arrow = g => { PL(g, [20, 40, 54, 40, 54, 22, 86, 50, 54, 78, 54, 60, 20, 60]); paint(g, '#6ccf6a', 50, 50, 40, 6); };
  I.book = g => {
    R(g, 14, 18, 72, 70, 8); paint(g, '#9b4a3c', 50, 50, 40, 6); R(g, 20, 80, 62, 10, 3); flat(g, '#fff6e6', 4, '#7a3a2e');
    pstar(g, 50, 46, 14); g.fillStyle = '#f2c14b'; g.fill(); R(g, 24, 18, 6, 64, 2); flat(g, '#7a3a2e', 0);
  };
  I.task = I.book;
  I.tasks = g => {
    R(g, 18, 14, 64, 78, 8); paint(g, '#c98a55', 50, 50, 44); R(g, 25, 22, 50, 64, 4); flat(g, '#fffaf0', 3, '#a8875a');
    R(g, 38, 8, 24, 12, 4); paint(g, '#8e98a6', 50, 12, 12, 3);
    for (let i = 0; i < 3; i++) { PL(g, [30, 38 + i * 15, 34, 42 + i * 15, 40, 34 + i * 15], true); stroke(g, i < 2 ? '#4aa84a' : '#d8c8a8', 3.4); R(g, 45, 36 + i * 15, 24, 4, 2); flat(g, '#d8c8a8', 0); }
    pstar(g, 74, 80, 12); paint(g, '#ffcf3d', 74, 80, 12, 3);
  };
  I.sell = g => { I.coin(g); };
  I.home = g => { PL(g, [50, 12, 90, 46, 80, 46, 80, 88, 20, 88, 20, 46, 10, 46]); paint(g, '#e2846a', 50, 50, 40, 6); R(g, 42, 60, 16, 28, 4); flat(g, C.woodD, 0); };

  // ---- panels and buttons (drawn live; cheap shapes, no shadowBlur) ----
  A.panel = function (ctx, x, y, w, h, style) {
    style = style || 'paper'; const r = Math.min(18, h * .42, w * .3);
    ctx.save();
    if (style === 'ribbon') {
      const tail = Math.min(18, h * .6), fold = h * .25;
      ctx.fillStyle = '#b8473c'; PL(ctx, [x - tail, y + fold, x + 8, y + fold, x + 8, y + h + fold, x - tail, y + h + fold, x - tail + 10, y + fold + h / 2]); ctx.fill();
      PL(ctx, [x + w + tail, y + fold, x + w - 8, y + fold, x + w - 8, y + h + fold, x + w + tail, y + h + fold, x + w + tail - 10, y + fold + h / 2]); ctx.fill();
      R(ctx, x, y, w, h, 6); const gr = ctx.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#f07a68'); gr.addColorStop(1, '#d65a4a'); ctx.fillStyle = gr; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#8f3128'; ctx.stroke();
      ctx.setLineDash([4, 4]); R(ctx, x + 4, y + 4, w - 8, h - 8, 4); ctx.strokeStyle = 'rgba(255,240,220,.6)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
      ctx.restore(); return;
    }
    const pal = {
      paper: ['#fffaf0', '#f6e6c8', '#c9a27a', '#e8d2ae'],
      wood: ['#d39a66', '#b5764a', '#7a4a2e', '#9a6038'],
      button: ['#8fdc7c', '#57b65a', '#2f7a3a', '#3f9346'],
      buttonHot: ['#ffc56b', '#f39a3a', '#a85a1a', '#d97a24'],
      buttonBlue: ['#9fd4f2', '#5aa7d8', '#2b6a99', '#3f88bb'],
      buttonGrey: ['#e9e1d6', '#c9bfb2', '#8a8073', '#aaa094'],
      dark: ['#6a4a3a', '#4e3428', '#2c1b14', '#3a261d']
    }[style] || ['#fffaf0', '#f6e6c8', '#c9a27a', '#e8d2ae'];
    const btn = style !== 'paper' && style !== 'wood' && style !== 'dark', dep = btn ? Math.max(3, Math.min(6, h * .09)) : 3;
    R(ctx, x, y + dep, w, h, r); ctx.fillStyle = btn ? pal[2] : 'rgba(110,60,30,.22)'; ctx.fill();
    R(ctx, x, y, w, h, r); const gr = ctx.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, pal[0]); gr.addColorStop(1, pal[1]); ctx.fillStyle = gr; ctx.fill();
    if (style === 'wood') {
      ctx.save(); R(ctx, x, y, w, h, r); ctx.clip(); ctx.strokeStyle = 'rgba(90,50,25,.25)'; ctx.lineWidth = 1.5;
      for (let yy = y + 14; yy < y + h; yy += 16) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(255,220,180,.18)'; for (let yy = y + 15.5; yy < y + h; yy += 16) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); }
      ctx.restore();
    }
    if (style === 'paper') { R(ctx, x + 5, y + 5, w - 10, h - 10, Math.max(2, r - 4)); ctx.setLineDash([5, 4]); ctx.strokeStyle = 'rgba(200,160,115,.45)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]); }
    if (btn) { R(ctx, x + 4, y + 3, w - 8, h * .42, Math.max(2, r - 3)); ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fill(); }
    R(ctx, x, y, w, h, r); ctx.lineWidth = btn ? 2.5 : 2; ctx.strokeStyle = pal[2]; ctx.stroke();
    ctx.restore();
  };

  // ---- background behind the board: warm gingham tablecloth on wood (cached) ----
  let _bg = null, _bgKey = '';
  A.bg = function (ctx, w, h, t) {
    const sc = scaleOf(ctx), key = w + 'x' + h + '@' + sc;
    if (key !== _bgKey) {
      _bgKey = key; _bg = mk(w * sc, h * sc); const g = _bg.getContext('2d'); g.scale(sc, sc);
      g.fillStyle = '#f7e4c6'; g.fillRect(0, 0, w, h);
      const s = Math.max(22, Math.min(36, w / 13));
      g.fillStyle = 'rgba(226,120,96,.16)';
      for (let x = 0; x < w; x += s * 2) g.fillRect(x, 0, s, h);
      for (let y = 0; y < h; y += s * 2) g.fillRect(0, y, w, s);
      // fine weave
      g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1;
      for (let x = 0; x < w; x += 4) { g.beginPath(); g.moveTo(x + .5, 0); g.lineTo(x + .5, h); g.stroke(); }
      // little stitched flowers at the crossings
      const rr = srnd(7);
      for (let y = s * 1.5; y < h; y += s * 2) for (let x = s * 1.5; x < w; x += s * 2) {
        if (rr() < .55) continue; g.fillStyle = 'rgba(255,250,240,.55)';
        for (let i = 0; i < 5; i++) { const a = i * 1.2566; E(g, x + Math.cos(a) * 3.2, y + Math.sin(a) * 3.2, 2.2, 2.2); g.fill(); }
        dot(g, x, y, 1.6, 'rgba(242,184,75,.7)');
      }
      // vignette
      const vg = g.createRadialGradient(w / 2, h * .55, Math.min(w, h) * .3, w / 2, h * .55, Math.max(w, h) * .8);
      vg.addColorStop(0, 'rgba(120,60,30,0)'); vg.addColorStop(1, 'rgba(120,60,30,.22)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
    }
    ctx.drawImage(_bg, 0, 0, w, h);
  };

  // ---- logo ----
  // (x, y) is the top-left of a w-wide box about 0.4·w tall: kringel on top, the name, then a small ribbon subtitle
  A.logo = function (ctx, x0, y0, w, t) {
    t = t || 0; const word = 'Saarepagar', fs = w / 6.6, x = x0 + w / 2, y = y0 + w * .2;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 ' + fs + 'px ui-rounded,"SF Pro Rounded","Nunito","Varela Round",system-ui,sans-serif';
    // kringel on top
    const ks = w * .27, kr = A.item('pagar', 6, Math.round(ks * scaleOf(ctx)));
    const bob = Math.sin(t * 2) * w * .01;
    ctx.save(); ctx.translate(x, y - fs * .5 - ks * .42 + bob); ctx.rotate(Math.sin(t * 1.3) * .06); ctx.drawImage(kr, -ks / 2, -ks / 2, ks, ks); ctx.restore();
    // letters with a gentle wave
    let tw = 0; const ws = []; for (const ch of word) { const m = ctx.measureText(ch).width * .96; ws.push(m); tw += m; }
    let cx = x - tw / 2;
    for (let i = 0; i < word.length; i++) {
      const ch = word[i], lx = cx + ws[i] / 2, ly = y + Math.sin(t * 2.2 - i * .55) * fs * .05, rot = Math.sin(t * 1.7 - i * .7) * .03;
      ctx.save(); ctx.translate(lx, ly); ctx.rotate(rot);
      ctx.lineJoin = 'round'; ctx.lineWidth = fs * .26; ctx.strokeStyle = '#6b3a22'; ctx.strokeText(ch, 0, fs * .06);
      ctx.strokeText(ch, 0, 0);
      const gr = ctx.createLinearGradient(0, -fs * .45, 0, fs * .45); gr.addColorStop(0, '#ffe08a'); gr.addColorStop(.55, '#f6a744'); gr.addColorStop(1, '#e07a32');
      ctx.fillStyle = gr; ctx.fillText(ch, 0, 0);
      ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.save(); ctx.beginPath(); ctx.rect(-fs, -fs, fs * 2, fs * .82); ctx.clip(); ctx.fillText(ch, 0, -fs * .03); ctx.restore();
      ctx.restore(); cx += ws[i];
    }
    // subtitle ribbon
    const sw = w * .7, sh = fs * .42, sy = y + fs * .62;
    A.panel(ctx, x - sw / 2, sy, sw, sh, 'ribbon');
    ctx.font = '800 ' + (sh * .56) + 'px ui-rounded,"SF Pro Rounded",system-ui,sans-serif'; ctx.fillStyle = '#fff6e6'; ctx.fillText('väike pagarikoda saare peal', x, sy + sh * .53);
    // sparkles
    for (let i = 0; i < 3; i++) { const a = (t * .8 + i / 3) % 1; spark(ctx, x + (i - 1) * tw * .45, y - fs * .6 + i * 6, fs * .12 * Math.sin(a * Math.PI), '#fff7c2'); }
    ctx.restore();
  };

  window.__art = A;
  return A;
})();
