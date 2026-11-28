// ===== ART (Ash): every picture in Saarepagar is drawn here with canvas paths. =====
// Modern "candy" look (version 2): bright pastels with punchy accents, glossy items (gradient body, rim light,
// specular blob, soft contact shadow, thick clean outline), frosted white cards and bubbly pill buttons on a sunny
// sea-sky background. Items, icons and portraits are drawn once into cached canvases. Scenes cache their still
// layer and add a light animated layer on top. Item art lives in 21-items.js, scenes in 22-scenes.js, portraits in
// 23-people.js. Item levels are 1-based: ART.item('bread', 1, 64) is the flour sack.
// ART.theme holds the UI colour tokens (ink, card, accents) so the UI can match the art.
const ART = (function () {
  const A = {};
  // ---- palette: pastels + punchy accents (coral, mint, sky, sunny yellow, berry pink, grape) ----
  const C = A.C = {
    ink: '#33285c', cream: '#fffaf2', paper: '#ffffff', paper2: '#eef3ff', flour: '#f7efe0', dough: '#ffe6bf',
    crust: '#f29a4a', crustD: '#d0702a', gold: '#ffc83d', goldD: '#e8a11a', honey: '#ffb21e', red: '#ff5a5f',
    rose: '#ff8fb1', pink: '#ffc2d6', berry: '#ff3d8b', blue: '#4f8dff', blueL: '#9cc8ff', sea: '#2ec4e6', seaD: '#1a95c9',
    leaf: '#4fd07a', leafD: '#22a356', mint: '#9ff0c8', wood: '#e0955a', woodL: '#f6b67a', woodD: '#b86a36',
    stone: '#c9c6d6', stoneD: '#9a96ad', iron: '#94a3c0', silver: '#d6e0f0', white: '#ffffff', lilac: '#b79cff',
    teal: '#2fd3c4', choc: '#8a4f32', amber: '#ffa62b', sky: '#bfeaff', skyD: '#7fd0ff', night: '#2c2f6e',
    coral: '#ff7a6b', mintD: '#19c38a', sun: '#ffd84a', grape: '#7c5cff', peach: '#ffb48a'
  };
  // UI tokens for Mira: text ink, soft ink, card fill, card edge, accents and the button gradients
  A.theme = {
    ink: '#33285c', ink2: '#7a72a6', inkOnDark: '#ffffff', card: '#ffffff', cardEdge: 'rgba(110,100,200,.16)',
    coral: '#ff6b6b', mint: '#2fd59a', sky: '#3db8ff', sun: '#ffd23f', berry: '#ff4f9a', grape: '#7c5cff',
    good: '#21c07a', bad: '#ff5a6a', bgTop: '#7fd3ff', bgBottom: '#fff1dc', bar: ['#7a68ff', '#5a44e6'],
    font: 'ui-rounded,"SF Pro Rounded","Nunito","Varela Round",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif'
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
  // lighten toward white, darken toward a deep plum (cooler, candier than brown)
  const lt = (c, t) => mix(c, '#ffffff', t), dk = (c, t) => mix(c, '#2a1748', t);
  function rgba(c, a) { const v = rgb(c); return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + a + ')'; }
  A.mix = mix; A.lt = lt; A.dk = dk; A.rgba = rgba;

  // ---- canvas helpers ----
  function mk(w, h) {
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c;
  }
  A.mk = mk;
  const OL = 4; // outline width in 100-unit item space
  function E(g, x, y, rx, ry, rot) { g.beginPath(); g.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot || 0, 0, Math.PI * 2); }
  function rrp(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function R(g, x, y, w, h, r) { g.beginPath(); rrp(g, x, y, w, h, r); }
  function PL(g, p, open) { g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); if (!open) g.closePath(); }
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
  // glossy fill: a bright top-left core, the colour, a deep saturated edge; then a clean tinted outline
  function paint(g, col, cx, cy, r, ol) {
    const gr = g.createRadialGradient(cx - r * .4, cy - r * .48, r * .04, cx, cy, r * 1.22);
    gr.addColorStop(0, lt(col, .6)); gr.addColorStop(.42, col); gr.addColorStop(1, dk(col, .3));
    g.fillStyle = gr; g.fill();
    if (ol !== 0) { g.lineWidth = ol || OL; g.strokeStyle = dk(col, .58); g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
  }
  function flat(g, col, ol, olc) {
    g.fillStyle = col; g.fill();
    if (ol !== 0) { g.lineWidth = ol || OL * .8; g.strokeStyle = olc || dk(col, .58); g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
  }
  function vpaint(g, col, y0, y1, ol) {
    const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, lt(col, .5)); gr.addColorStop(.5, col); gr.addColorStop(1, dk(col, .25));
    g.fillStyle = gr; g.fill();
    if (ol !== 0) { g.lineWidth = ol || OL; g.strokeStyle = dk(col, .58); g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
  }
  function stroke(g, col, w, a) { g.lineWidth = w; g.strokeStyle = a != null ? rgba(col, a) : col; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); }
  function line(g, pts, col, w, a, smooth) { if (smooth) SM(g, pts, true); else PL(g, pts, true); stroke(g, col, w, a); }
  function HL(g, x, y, rx, ry, rot, a) { E(g, x, y, rx, ry, rot); g.fillStyle = 'rgba(255,255,255,' + (a == null ? .6 : Math.min(1, a * 1.15)) + ')'; g.fill(); }
  function dot(g, x, y, r, col) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = col; g.fill(); }
  function spark(g, x, y, r, col, a) {
    if (A._raw) return; // item raw pass: the pipeline adds its own sparkles
    g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r);
    g.fillStyle = a != null ? rgba(col || '#ffffff', a) : (col || '#ffffff'); g.fill();
  }
  function star(g, x, y, r, ri, n, rot) {
    n = n || 5; ri = ri || r * .5; rot = rot == null ? -Math.PI / 2 : rot; g.beginPath();
    for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, q = i % 2 ? ri : r; g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * q, y + Math.sin(a) * q); }
    g.closePath();
  }
  function pstar(g, x, y, r, rot) {
    rot = rot == null ? -Math.PI / 2 : rot; const p = [];
    for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5, q = i % 2 ? r * .55 : r; p.push(x + Math.cos(a) * q, y + Math.sin(a) * q); }
    SM(g, p);
  }
  function heart(g, x, y, s) {
    g.beginPath(); g.moveTo(x, y + s * .35);
    g.bezierCurveTo(x - s * 1.1, y - s * .3, x - s * .45, y - s * 1.05, x, y - s * .45);
    g.bezierCurveTo(x + s * .45, y - s * 1.05, x + s * 1.1, y - s * .3, x, y + s * .35); g.closePath();
  }
  function shadow(g, x, y, rx, ry, a) { if (A._raw) return; E(g, x, y, rx, ry); g.fillStyle = 'rgba(70,50,140,' + (a == null ? .16 : a) + ')'; g.fill(); }
  function face(g, x, y, s, blush) {
    dot(g, x - s, y, s * .36, C.ink); dot(g, x + s, y, s * .36, C.ink);
    dot(g, x - s + s * .13, y - s * .13, s * .13, '#fff'); dot(g, x + s + s * .13, y - s * .13, s * .13, '#fff');
    g.beginPath(); g.arc(x, y + s * .25, s * .38, .2, Math.PI - .2); stroke(g, C.ink, s * .2);
    if (blush !== false) { E(g, x - s * 1.7, y + s * .55, s * .45, s * .28); g.fillStyle = 'rgba(255,100,140,.4)'; g.fill(); E(g, x + s * 1.7, y + s * .55, s * .45, s * .28); g.fill(); }
  }
  function srnd(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const H = A.H = { E, R, rrp, PL, SM, paint, flat, vpaint, stroke, line, HL, dot, spark, star, pstar, heart, shadow, face, srnd, OL, C, lt, dk, mix, rgba, mk };

  function scaleOf(ctx) { try { const m = ctx.getTransform(); return Math.max(.5, Math.min(4, Math.hypot(m.a, m.b))); } catch (e) { return A.dpr || 1; } }
  A.scaleOf = scaleOf;
  // ---- device budget (version 3 phase C): ART.perf ----
  // Cheap Androids (Poco M7 Pro class) choke on a 1080x2400 canvas redrawn 20-60 times a second, so the backing
  // resolution and the effect quality follow the device and the measured frames:
  //   ART.perf.maxDpr()     cap for the canvas backing scale (UI.layout uses it): 3 normally, 2 on weak devices
  //                         (<= 4 cores or <= 4 GB), lower after slow frames. URL flag dpr=<n> forces a cap.
  //   ART.perf.level        0 = full; 1 = backing <= 2; 2 = + FX.quality 1; 3 = backing <= 1.5, FX.quality 0.
  //   ART.perf.frame(ms, drew, jsMs)  called by the frame loop on every rAF (ms = rAF time; drew = UI.draw ran in the
  //                         previous callback; jsMs = its tick + draw time). Slow drawn frames (median gap > 42 ms or JS
  //                         > 14 ms over 36 frames) step one level down, at most every 2.5 s; the level is saved for a week.
  //   ART.perf.onChange     fn(level) set by the UI (relayout when the backing cap changed). URL flag perf=0 = no auto.
  A.perf = (function () {
    const nav = navigator, cores = nav.hardwareConcurrency || 8, mem = nav.deviceMemory || 8, weak = cores <= 4 || mem <= 4;
    let qs = {}; try { new URLSearchParams(location.search + '&' + location.hash.slice(1)).forEach((v, k) => { qs[k] = v; }); } catch (e) { }
    const KEY = 'saarepagar.perf', P = { weak, level: 0, onChange: null, auto: qs.perf !== '0' && !window.__mgPerfNoAuto };
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && P.auto && Date.now() - s.at < 7 * 864e5) P.level = Math.max(0, Math.min(3, s.level | 0)); } catch (e) { }
    if (qs.perf && /^[0-3]$/.test(qs.perf) && qs.perf !== '0') P.level = +qs.perf;
    const forced = qs.dpr ? Math.max(1, Math.min(3, parseFloat(qs.dpr) || 3)) : 0;
    P.maxDpr = () => forced || Math.min(weak ? 2 : 3, P.level >= 3 ? 1.5 : P.level >= 1 ? 2 : 3);
    P.fxQuality = () => Math.min(weak ? 1 : 2, P.level >= 3 ? 0 : P.level >= 2 ? 1 : 2);
    const gaps = [], js = []; let last = 0, wasDraw = false, hold = 0;
    const med = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
    P.apply = function () { try { if (typeof FX !== 'undefined' && FX) FX.quality = P.fxQuality(); } catch (e) { } A.quality = P.level >= 3 ? 1 : 2; };
    P.set = function (lv, save) {
      lv = Math.max(0, Math.min(3, lv | 0)); if (lv === P.level) return;
      const d0 = P.maxDpr(); P.level = lv; P.apply(); gaps.length = js.length = 0; hold = performance.now() + 2500;
      if (save) try { localStorage.setItem(KEY, JSON.stringify({ level: lv, at: Date.now() })); } catch (e) { }
      if (P.onChange) try { P.onChange(lv, P.maxDpr() !== d0); } catch (e) { }
    };
    P.frame = function (ms, drew, jsMs) {
      if (wasDraw && last && !document.hidden) {
        const gap = ms - last;
        if (gap > 0 && gap < 400) { gaps.push(gap); if (jsMs != null) js.push(jsMs); if (gaps.length > 36) gaps.shift(); if (js.length > 36) js.shift(); }
      }
      wasDraw = !!drew; last = ms;
      if (!P.auto || P.level >= 3 || gaps.length < 36 || ms < hold) return;
      if (med(gaps) > 42 || (js.length >= 36 && med(js) > 14)) {
        let n = P.level + 1; if (n === 1 && P.maxDpr() <= 2 && (window.devicePixelRatio || 1) <= 2) n = 2; // no point capping a 2x screen
        P.set(n, true);
      }
    };
    P.stats = () => ({ level: P.level, weak, maxDpr: P.maxDpr(), fx: P.fxQuality(), gap: gaps.length ? +med(gaps).toFixed(1) : null, js: js.length ? +med(js).toFixed(1) : null });
    return P;
  })();
  Object.defineProperty(A, 'dpr', { get: () => Math.min(A.perf.maxDpr(), window.devicePixelRatio || 1), enumerable: true });

  // ---- pixel helpers ----
  // vibrance: push weak colours toward saturation (the candy look), leave greys a little cooler
  function vibrance(g, w, h, amt) {
    let id; try { id = g.getImageData(0, 0, w, h); } catch (e) { return; }
    const d = id.data, n = d.length;
    for (let i = 0; i < n; i += 4) {
      if (d[i + 3] < 8) continue;
      const r = d[i], gg = d[i + 1], b = d[i + 2], mx = r > gg ? (r > b ? r : b) : (gg > b ? gg : b), mn = r < gg ? (r < b ? r : b) : (gg < b ? gg : b);
      const avg = (r + gg + b) / 3, k = amt * (1 - (mx - mn) / 255) * (mx > 30 ? 1 : 0);
      let nr = r + (r - avg) * k, ng = gg + (gg - avg) * k, nb = b + (b - avg) * k;
      // slight lift of the mid-tones (brighter, cleaner)
      nr += (255 - nr) * .04; ng += (255 - ng) * .04; nb += (255 - nb) * .06;
      d[i] = nr < 0 ? 0 : nr > 255 ? 255 : nr; d[i + 1] = ng < 0 ? 0 : ng > 255 ? 255 : ng; d[i + 2] = nb < 0 ? 0 : nb > 255 ? 255 : nb;
    }
    g.putImageData(id, 0, 0);
  }
  A.vibrance = vibrance;
  const _scr = {};
  function scratch(name, w, h) {
    let c = _scr[name];
    if (!c) { c = _scr[name] = mk(w, h); if (name === 'meas' || name === 'body') c.getContext('2d', { willReadFrequently: true }); }
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, w, h);
    return c;
  }
  // a solid-colour copy of a canvas's silhouette
  function tint(src, col, name) {
    const c = scratch(name || 'tint', src.width, src.height), g = c.getContext('2d');
    g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height); g.globalCompositeOperation = 'source-over';
    return c;
  }
  // the edge band of a silhouette on the side opposite to (dx, dy)
  function band(src, dx, dy, col) {
    const c = scratch('band', src.width, src.height), g = c.getContext('2d');
    g.drawImage(src, 0, 0); g.globalCompositeOperation = 'destination-out'; g.drawImage(src, dx, dy);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height); g.globalCompositeOperation = 'source-over';
    return c;
  }
  // draw a silhouette outline: the tinted copy stamped around a circle
  function outline(g, src, col, w, x, y) {
    const t = tint(src, col, 'ol'), n = w > 3 ? 12 : 8;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; g.drawImage(t, x + Math.cos(a) * w, y + Math.sin(a) * w); }
  }
  A.fx = { vibrance, tint, band, outline, scratch };

  // ---- item registry ----
  A.defs = {}; A.names = {}; A.labels = {}; A.genInfo = {};
  A.def = function (chain, list) {
    A.defs[chain] = list.map(e => e[1]); A.labels[chain] = list.map(e => e[0]);
    list.forEach((e, i) => { if (!A.names[e[0]]) A.names[e[0]] = [chain, i + 1]; });
  };
  A.alias = {};
  A.maxLevel = function (chain) { const d = A.defs[chain] || A.defs[A.alias[chain]]; return d ? d.length : 0; };
  const cache = new Map(); let cacheN = 0;
  function resolve(chain, level) {
    let k = A.defs[chain] ? chain : (A.alias[chain] || chain);
    if (!A.defs[k] && A.names[k]) { const n = A.names[k]; return [n[0], n[1] + (level > 1 ? level - 1 : 0)]; }
    return [k, level];
  }
  function drawRaw(g, k, lv) {
    const d = A.defs[k];
    A._raw = true;
    try { if (d) { const f = d[Math.min(lv, d.length) - 1]; f(g, Math.min(lv, d.length), lv > d.length ? lv - d.length : 0); } else fallback(g, k, lv); }
    catch (e) { console.error('ART.item', k, lv, e); }
    A._raw = false;
  }
  // measured bounding box of a raw drawing in 100-unit space (cached per chain and level)
  const _bb = new Map();
  function bbox(k, lv) {
    const key = k + '|' + lv; let b = _bb.get(key); if (b) return b;
    const N = 96, M = 16, c = scratch('meas', N + M * 2, N + M * 2), g = c.getContext('2d');
    g.setTransform(N / 100, 0, 0, N / 100, M, M); drawRaw(g, k, lv);
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    try {
      const d = g.getImageData(0, 0, c.width, c.height).data, W = c.width;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    } catch (e) { }
    if (x1 < 0) b = { x: 10, y: 10, w: 80, h: 80 };
    else b = { x: (x0 - M) * 100 / N, y: (y0 - M) * 100 / N, w: (x1 - x0 + 1) * 100 / N, h: (y1 - y0 + 1) * 100 / N };
    _bb.set(key, b); return b;
  }
  // rarity tier of a level: 0 normal, 1 sky (third from top), 2 berry (second from top), 3 gold (top)
  function tierOf(k, lv) {
    const mx = A.maxLevel(k); if (A.genInfo[k] || mx < 4) return lv >= mx && mx >= 3 ? 3 : 0;
    return lv >= mx ? 3 : lv === mx - 1 ? 2 : lv === mx - 2 ? 1 : 0;
  }
  const AURA = [null, ['#8fe3ff', '#3db8ff'], ['#ffb3e1', '#ff4fa8'], ['#fff2a0', '#ffb81e']];
  function aura(g, P, tier, cx, cy) {
    const a = AURA[tier]; if (!a) return;
    const r = P * (.36 + tier * .04);
    if (tier === 3) { // soft sun rays
      g.save(); g.translate(cx, cy); g.globalAlpha = .55;
      for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.beginPath(); g.moveTo(0, 0); g.lineTo(-P * .07, -P * .5); g.lineTo(P * .07, -P * .5); g.closePath(); const gr = g.createLinearGradient(0, 0, 0, -P * .5); gr.addColorStop(0, 'rgba(255,236,150,.9)'); gr.addColorStop(1, 'rgba(255,236,150,0)'); g.fillStyle = gr; g.fill(); }
      g.restore();
    }
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r * 1.35);
    gr.addColorStop(0, rgba(a[0], .95)); gr.addColorStop(.55, rgba(a[1], .38)); gr.addColorStop(1, rgba(a[1], 0));
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r * 1.35, 0, Math.PI * 2); g.fill();
  }
  function sparkAt(g, x, y, r, col) {
    g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x + r * .12, y - r * .12, x + r, y); g.quadraticCurveTo(x + r * .12, y + r * .12, x, y + r); g.quadraticCurveTo(x - r * .12, y + r * .12, x - r, y); g.quadraticCurveTo(x - r * .12, y - r * .12, x, y - r);
    g.fillStyle = col; g.fill();
  }
  A.sparkAt = sparkAt;
  // generator pedestal: a glossy round badge in the generator's colour
  function pedestal(g, P, col, lv) {
    const cx = P / 2, cy = P / 2, r = P * .47, base = lt(col, .05);
    g.beginPath(); g.arc(cx, cy + P * .025, r, 0, Math.PI * 2); g.fillStyle = rgba(dk(base, .45), .45); g.fill();
    const gr = g.createLinearGradient(0, cy - r, 0, cy + r); gr.addColorStop(0, lt(base, .55)); gr.addColorStop(.6, base); gr.addColorStop(1, dk(base, .18));
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = gr; g.fill();
    g.lineWidth = P * .035; g.strokeStyle = lv >= 3 ? '#ffd84a' : 'rgba(255,255,255,.95)'; g.beginPath(); g.arc(cx, cy, r - P * .02, 0, Math.PI * 2); g.stroke();
    if (lv >= 3) { g.lineWidth = P * .012; g.strokeStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(cx, cy, r - P * .045, 0, Math.PI * 2); g.stroke(); }
    g.save(); g.beginPath(); g.arc(cx, cy, r - P * .04, 0, Math.PI * 2); g.clip();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(cx, cy - r * .62, r * .78, r * .42, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  function genAdorn(g, P, lv) {
    if (lv >= 2) { sparkAt(g, P * .86, P * .16, P * .06, '#ffffff'); }
    if (lv >= 4) { // little gold crown on top-left
      const s = P / 100; g.save(); g.translate(P * .08, P * .04); g.scale(s, s);
      PL(g, [4, 26, 2, 8, 12, 16, 20, 4, 28, 16, 38, 8, 36, 26]); const gr = g.createLinearGradient(0, 4, 0, 26); gr.addColorStop(0, '#fff3a0'); gr.addColorStop(1, '#ffb21e');
      g.fillStyle = gr; g.fill(); g.lineWidth = 3; g.strokeStyle = '#c2650c'; g.lineJoin = 'round'; g.stroke(); dot(g, 20, 19, 3, '#ff4f9a'); g.restore();
    }
  }
  A.item = function (chain, level, px) {
    px = Math.max(8, Math.round(px || 64)); level = Math.max(1, level | 0 || 1);
    const key = chain + '|' + level + '|' + px; let c = cache.get(key); if (c) return c;
    const [k, lv0] = resolve(chain, level), d = A.defs[k], lv = d ? Math.min(lv0, d.length) : lv0;
    c = mk(px, px);
    try { renderItem(c, k, lv, px); } catch (e) { console.error('ART.item', chain, level, e); }
    if (++cacheN > 420) { cache.clear(); cacheN = 0; }
    cache.set(key, c); return c;
  };
  function renderItem(c, k, lv, P) {
    const out = c.getContext('2d'), gi = A.genInfo[k], tier = tierOf(k, lv), mx = A.maxLevel(k) || 1;
    const bb = bbox(k, lv), q = A.quality == null ? 2 : A.quality;
    const prog = mx > 1 ? (lv - 1) / (mx - 1) : 1;
    const fill = gi ? .74 : (.8 + .1 * prog), ow = Math.max(1, P * (gi ? .022 : .026));
    const cx = P / 2, cy = gi ? P * .5 : P * .47, sc = fill * P / Math.max(bb.w, bb.h, 30);
    // body
    const B = scratch('body', P, P), b = B.getContext('2d');
    b.setTransform(sc, 0, 0, sc, cx - (bb.x + bb.w / 2) * sc, cy - (bb.y + bb.h / 2) * sc); drawRaw(b, k, lv); b.setTransform(1, 0, 0, 1, 0, 0);
    if (q > 0) vibrance(b, P, P, .42);
    // gloss: top-left specular rim, cool bottom-right rim light, a soft top wash
    const dd = Math.max(1, P * .03), bw = bb.w * sc, bh = bb.h * sc;
    b.globalCompositeOperation = 'source-atop';
    const wash = b.createLinearGradient(0, cy - bh / 2, 0, cy + bh / 2); wash.addColorStop(0, 'rgba(255,255,255,.22)'); wash.addColorStop(.45, 'rgba(255,255,255,0)'); wash.addColorStop(1, 'rgba(60,30,120,.12)');
    b.fillStyle = wash; b.fillRect(0, 0, P, P);
    if (q > 0) {
      b.drawImage(band(B, dd, dd, 'rgba(255,255,255,.55)'), 0, 0);
      b.drawImage(band(B, -dd, -dd, 'rgba(190,235,255,.5)'), 0, 0);
    }
    // specular blob
    const sx = cx - bw * .2, sy = cy - bh * .26, gr = b.createRadialGradient(sx, sy, 0, sx, sy, Math.min(bw, bh) * .22);
    gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); b.fillStyle = gr; b.fillRect(0, 0, P, P);
    b.globalCompositeOperation = 'source-over';
    // compose
    if (gi) pedestal(out, P, gi.col, lv);
    else if (tier) aura(out, P, tier, cx, cy);
    // contact shadow
    const shy = Math.min(P * .96, cy + bh / 2 + P * .005), shr = Math.min(bw * .42, P * .36);
    const sg = out.createRadialGradient(cx, shy, 0, cx, shy, shr); sg.addColorStop(0, 'rgba(50,30,110,.30)'); sg.addColorStop(1, 'rgba(50,30,110,0)');
    out.save(); out.translate(cx, shy); out.scale(1, .28); out.translate(-cx, -shy); out.fillStyle = sg; out.beginPath(); out.arc(cx, shy, shr, 0, Math.PI * 2); out.fill(); out.restore();
    outline(out, B, gi ? 'rgba(42,23,72,.8)' : 'rgba(42,23,72,.88)', ow, 0, 0);
    out.drawImage(B, 0, 0);
    if (gi) genAdorn(out, P, lv);
    // sparkles grow with rarity
    if (tier) {
      const S = [[.86, .12, .085], [.12, .3, .06], [.84, .7, .05], [.2, .86, .045]], cols = [null, '#e9fbff', '#fff0fa', '#fffbe0'];
      for (let i = 0; i < tier + 1; i++) { const s = S[i]; sparkAt(out, P * s[0], P * s[1], P * s[2] * 1.35, rgba(dk(AURA[tier][1], .2), .55)); sparkAt(out, P * s[0], P * s[1], P * s[2], cols[tier]); }
    }
  }
  A.clearCache = function () { cache.clear(); cacheN = 0; for (const k in _ic) delete _ic[k]; A._sceneCache && A._sceneCache.clear(); for (const k in _cell) delete _cell[k]; };
  // unknown keys (new goal items before their art lands): a pretty faceted gem or a wrapped gift, chosen and coloured
  // by the key's hash; higher levels grow a gold rim, more sparkle and finally a crown
  function fallback(g, k, lv) {
    let h = 0; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
    const cols = ['#ff4f9a', '#3db8ff', '#2fd59a', '#ffb21e', '#9a6bff', '#14c8b8', '#ff6b5a'], col = cols[h % cols.length], L = Math.min(lv | 0 || 1, 9);
    const gold = L >= 4, r = 30 + Math.min(L, 6) * 2.4;
    if ((h >> 3) % 2) { // gem
      const n = L >= 3 ? 8 : 6, pts = [], top = 50 - r * .55;
      for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i + .5) * Math.PI * 2 / n; pts.push(50 + Math.cos(a) * r, 52 + Math.sin(a) * r * .9); }
      PL(g, pts); paint(g, col, 50, 50, r, gold ? 5 : 4); if (gold) { PL(g, pts); stroke(g, '#ffd23f', 2.4); }
      PL(g, [50 - r * .5, top + 6, 50 + r * .5, top + 6, 50 + r * .3, 52, 50 - r * .3, 52]); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill();
      PL(g, [50 - r * .3, 52, 50 + r * .3, 52, 50, 52 + r * .78]); g.fillStyle = rgba(dk(col, .3), .35); g.fill();
      PL(g, [50 - r * .45, top + 10, 50 - r * .15, top + 10, 50 - r * .32, top + 20]); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill();
    } else { // gift box
      const w = r * 1.6, y0 = 50 - r * .45;
      R(g, 50 - w / 2, y0 + 12, w, r * 1.2, 9); paint(g, col, 50, y0 + 30, r, 4);
      R(g, 50 - w / 2 - 4, y0, w + 8, 18, 7); paint(g, lt(col, .25), 50, y0 + 8, r, 4);
      R(g, 44, y0, 12, r * 1.2 + 12, 2); g.fillStyle = gold ? '#ffd23f' : '#ffffff'; g.fill();
      for (const s of [-1, 1]) { E(g, 50 + s * 10, y0 - 6, 11, 7, s * .5); paint(g, gold ? '#ffd23f' : '#ffffff', 50 + s * 10, y0 - 7, 10, 3); }
      dot(g, 50, y0 - 3, 5, gold ? '#ffb21e' : '#ffe0f0');
      HL(g, 50 - w / 2 + 9, y0 + 30, 4, 10, 0, .45);
    }
    for (let i = 0; i < Math.min(L - 1, 4); i++) { const a = -2.2 + i * 1.3; sparkAt(g, 50 + Math.cos(a) * (r + 12), 50 + Math.sin(a) * (r + 10), 5 + i, i % 2 ? '#fff6c0' : '#ffffff'); }
    if (L >= 5) { const s = 22, x0 = 50 - s / 2, y0 = 50 - r - 16; PL(g, [x0, y0 + 14, x0, y0 + 2, x0 + 6, y0 + 8, x0 + 11, y0, x0 + 16, y0 + 8, x0 + 22, y0 + 2, x0 + 22, y0 + 14]); paint(g, '#ffd23f', 50, y0 + 8, 12, 3); }
  }

  // ---- bubble overlay for bonus items: a glossy soap bubble with a rainbow sheen ----
  A.bubble = function (px) {
    px = Math.round(px || 64); const key = 'bubble|' + px; let c = cache.get(key); if (c) return c;
    c = mk(px, px); const g = c.getContext('2d'); g.scale(px / 100, px / 100);
    const gr = g.createRadialGradient(50, 50, 28, 50, 50, 47); gr.addColorStop(0, 'rgba(200,240,255,0.04)'); gr.addColorStop(.75, 'rgba(160,215,255,0.22)'); gr.addColorStop(1, 'rgba(110,170,255,0.6)');
    E(g, 50, 50, 46, 46); g.fillStyle = gr; g.fill();
    const rb = g.createLinearGradient(10, 10, 90, 90); rb.addColorStop(0, 'rgba(255,120,200,.7)'); rb.addColorStop(.35, 'rgba(255,230,120,.6)'); rb.addColorStop(.65, 'rgba(120,240,200,.6)'); rb.addColorStop(1, 'rgba(120,150,255,.8)');
    g.lineWidth = 3; g.strokeStyle = rb; g.stroke();
    g.beginPath(); g.arc(50, 50, 38, Math.PI * 1.08, Math.PI * 1.48); stroke(g, '#ffffff', 6, .9);
    E(g, 32, 30, 7, 4, -.7); g.fillStyle = 'rgba(255,255,255,.95)'; g.fill();
    HL(g, 72, 74, 6, 3, -.7, .45);
    cache.set(key, c); return c;
  };

  // ---- board cell: frosted glass tiles with a soft checker ----
  const _cell = {};
  A.cell = function (ctx, x, y, s, state) {
    const sc = scaleOf(ctx), px = Math.round(s * sc), par = (Math.round(x / s) + Math.round(y / s)) & 1, st = state || 'empty', key = st + px + '|' + par;
    let c = _cell[key];
    if (!c) {
      c = _cell[key] = mk(px, px); const g = c.getContext('2d'); g.scale(px / 100, px / 100);
      if (st === 'locked') {
        R(g, 4, 6, 92, 91, 22); g.fillStyle = 'rgba(70,60,160,.10)'; g.fill();
        R(g, 4, 3, 92, 90, 22); const gr = g.createLinearGradient(0, 3, 0, 93); gr.addColorStop(0, '#d9dcff'); gr.addColorStop(1, '#c4c8f4'); g.fillStyle = gr; g.fill();
        g.save(); R(g, 4, 3, 92, 90, 22); g.clip(); g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 8;
        for (let i = -100; i < 200; i += 24) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 100, 100); g.stroke(); } g.restore();
        R(g, 4, 3, 92, 90, 22); g.lineWidth = 2.5; g.strokeStyle = 'rgba(255,255,255,.7)'; g.stroke();
        // padlock (small, at the top so a number fits below)
        g.beginPath(); g.arc(50, 40, 8, Math.PI, 0); stroke(g, '#8c86c8', 4.2);
        R(g, 39, 40, 22, 17, 6); g.fillStyle = '#a49ee0'; g.fill(); dot(g, 50, 48, 2.6, '#ffffff');
      } else {
        const base = st === 'hint' ? '#c9f7e2' : st === 'target' ? '#fff0a8' : (par ? '#ffffff' : '#f3f7ff');
        R(g, 4, 6, 92, 91, 22); g.fillStyle = 'rgba(70,60,160,.10)'; g.fill();
        R(g, 4, 3, 92, 90, 22);
        const gr = g.createLinearGradient(0, 3, 0, 93); gr.addColorStop(0, rgba(base, st === 'empty' ? .82 : .95)); gr.addColorStop(1, rgba(st === 'empty' ? mix(base, '#dfe6ff', .5) : base, st === 'empty' ? .72 : .92));
        g.fillStyle = gr; g.fill();
        R(g, 10, 7, 80, 26, 14); g.fillStyle = 'rgba(255,255,255,.5)'; g.fill();
        R(g, 4, 3, 92, 90, 22); g.lineWidth = st === 'empty' ? 2.5 : 5;
        g.strokeStyle = st === 'hint' ? '#2fd59a' : st === 'target' ? '#ffb81e' : 'rgba(255,255,255,.95)'; g.stroke();
        if (st === 'target') { sparkAt(g, 84, 16, 7, '#ffffff'); }
        if (st === 'hint') { sparkAt(g, 84, 16, 6, '#ffffff'); }
      }
    }
    ctx.drawImage(c, x, y, s, s);
  };

  // ---- icons: bold glossy badges ----
  const _ic = {};
  A.iconDefs = {};
  A.icon = function (name, px) {
    px = Math.round(px || 32); const key = name + '|' + px; let c = _ic[key]; if (c) return c;
    c = _ic[key] = mk(px, px);
    const f = A.iconDefs[name];
    try {
      // draw at the target size, then a clean dark outline for pop on any background
      const S = scratch('icon', px, px), g = S.getContext('2d'); g.scale(px / 100, px / 100);
      if (f) f(g); else fallback(g, name, 1);
      const o = c.getContext('2d'); if (px >= 20 && !NO_OL[name]) outline(o, S, 'rgba(42,23,72,.75)', Math.max(1, px * .025), 0, 0); o.drawImage(S, 0, 0);
    } catch (e) { console.error('ART.icon', name, e); }
    return c;
  };
  const NO_OL = { bubble: 1 };
  const I = A.iconDefs;
  function badge(g, col, r) { E(g, 50, 52, r || 44, r || 44); g.fillStyle = dk(col, .35); g.fill(); E(g, 50, 48, r || 44, r || 44); paint(g, col, 50, 48, r || 44, 0); E(g, 50, 30, (r || 44) * .7, (r || 44) * .36); g.fillStyle = 'rgba(255,255,255,.3)'; g.fill(); }
  I.energy = g => {
    PL(g, [60, 4, 18, 56, 46, 56, 36, 96, 82, 40, 54, 40, 68, 4]); vpaint(g, '#ffd23f', 4, 96, 5);
    PL(g, [58, 12, 30, 50]); stroke(g, '#ffffff', 5, .7); HL(g, 46, 24, 4, 10, .6, .5);
  };
  I.coin = g => {
    E(g, 50, 55, 42, 42); g.fillStyle = '#d88a0c'; g.fill(); E(g, 50, 49, 42, 42); paint(g, '#ffcb2e', 50, 49, 42, 0);
    E(g, 50, 49, 30, 30); stroke(g, '#f0a010', 4); pstar(g, 50, 50, 16); g.fillStyle = '#ffe680'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#e8960c'; g.stroke();
    HL(g, 32, 30, 10, 5, -.7, .75);
  };
  I.star = g => { pstar(g, 50, 56, 47); g.fillStyle = '#e88a0c'; g.fill(); pstar(g, 50, 52, 47); paint(g, '#ffd23f', 50, 50, 46, 0); pstar(g, 50, 55, 20); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill(); HL(g, 36, 34, 9, 5, -.6, .8); };
  I.xp = g => { badge(g, '#3db8ff'); pstar(g, 50, 50, 24); g.fillStyle = '#fff'; g.fill(); };
  I.gift = g => {
    R(g, 14, 44, 72, 48, 10); paint(g, '#ff4f9a', 50, 60, 40, 0); R(g, 8, 30, 84, 20, 8); paint(g, '#ff7ab6', 50, 38, 40, 0);
    R(g, 42, 30, 16, 62, 2); g.fillStyle = '#ffd84a'; g.fill(); R(g, 42, 30, 16, 20, 2); g.fillStyle = '#fff0a0'; g.fill();
    E(g, 35, 22, 14, 9, .5); paint(g, '#ffd84a', 35, 22, 12, 0); E(g, 65, 22, 14, 9, -.5); paint(g, '#ffd84a', 65, 22, 12, 0); dot(g, 50, 28, 7, '#ffc21e');
    HL(g, 24, 54, 5, 12, 0, .4);
  };
  I.bag = g => {
    g.beginPath(); g.moveTo(24, 36); g.quadraticCurveTo(8, 92, 30, 93); g.lineTo(70, 93); g.quadraticCurveTo(92, 92, 76, 36); g.closePath(); paint(g, '#ff9a5a', 50, 62, 44, 0);
    g.beginPath(); g.arc(50, 34, 16, Math.PI, 0); stroke(g, '#c75a1e', 7); R(g, 20, 30, 60, 12, 6); paint(g, '#ff7a3a', 50, 36, 30, 0);
    R(g, 40, 54, 20, 16, 5); paint(g, '#ffe066', 50, 60, 10, 0); HL(g, 30, 58, 4, 12, .1, .45);
  };
  I.shop = g => {
    R(g, 14, 44, 72, 46, 8); paint(g, '#ffffff', 50, 64, 40, 0); R(g, 40, 60, 20, 30, 5); paint(g, '#3db8ff', 50, 74, 18, 0);
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(8 + i * 16.8, 20); g.lineTo(8 + (i + 1) * 16.8, 20); g.lineTo(8 + (i + 1) * 16.8, 40); g.arc(8 + i * 16.8 + 8.4, 40, 8.4, 0, Math.PI); g.closePath(); g.fillStyle = i % 2 ? '#ffffff' : '#ff5a7a'; g.fill(); }
    R(g, 6, 14, 88, 8, 4); g.fillStyle = '#ff3d6b'; g.fill();
  };
  I.settings = g => {
    const p = []; for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8 + Math.PI / 16, r = i % 2 ? 34 : 45; p.push(50 + Math.cos(a) * r, 50 + Math.sin(a) * r); }
    PL(g, p); paint(g, '#9aa6ff', 50, 50, 45, 0); E(g, 50, 50, 15, 15); g.fillStyle = '#ffffff'; g.fill(); HL(g, 34, 30, 8, 4, -.7, .55);
  };
  I.check = g => { badge(g, '#2fd59a'); PL(g, [28, 50, 44, 66, 73, 34], true); stroke(g, '#fff', 12); };
  I.lock = g => {
    g.beginPath(); g.arc(50, 42, 20, Math.PI, 0); g.lineTo(70, 50); g.moveTo(30, 50); g.lineTo(30, 42); stroke(g, '#8c86c8', 12); g.beginPath(); g.arc(50, 42, 20, Math.PI, 0); stroke(g, '#d6d2ff', 5);
    R(g, 18, 46, 64, 46, 12); paint(g, '#7c5cff', 50, 66, 36, 0); E(g, 50, 63, 6, 6); g.fillStyle = '#fff'; g.fill(); R(g, 47, 64, 6, 13, 3); g.fill();
    HL(g, 30, 56, 4, 9, 0, .5);
  };
  I.chest = g => { A.drawChest ? A.drawChest(g, 2, false) : fallback(g, 'chest', 1); };
  I.bubble = g => { g.drawImage(A.bubble(100), 0, 0, 100, 100); sparkAt(g, 62, 56, 9, '#c6e6ff'); };
  I.heart = g => { heart(g, 50, 58, 42); g.fillStyle = '#d61f6b'; g.fill(); heart(g, 50, 54, 42); paint(g, '#ff4f9a', 50, 48, 42, 0); HL(g, 32, 36, 8, 5, -.6, .7); };
  I.close = g => { badge(g, '#ff6b6b'); PL(g, [34, 32, 66, 64], true); stroke(g, '#fff', 11); PL(g, [66, 32, 34, 64], true); stroke(g, '#fff', 11); };
  I.music = g => { badge(g, '#7c5cff'); E(g, 38, 66, 9, 7, -.3); g.fillStyle = '#fff'; g.fill(); E(g, 64, 60, 9, 7, -.3); g.fill(); PL(g, [46, 64, 46, 26, 72, 20, 72, 58], true); stroke(g, '#fff', 5); };
  I.sound = g => { badge(g, '#3db8ff'); PL(g, [22, 40, 34, 40, 50, 26, 50, 70, 34, 56, 22, 56]); g.fillStyle = '#fff'; g.fill(); g.beginPath(); g.arc(52, 48, 14, -.8, .8); stroke(g, '#fff', 5); g.beginPath(); g.arc(52, 48, 25, -.8, .8); stroke(g, '#fff', 5); };
  I.arrow = g => { PL(g, [16, 38, 52, 38, 52, 18, 88, 50, 52, 82, 52, 62, 16, 62]); paint(g, '#2fd59a', 50, 50, 40, 0); };
  I.book = g => {
    R(g, 14, 16, 72, 74, 10); paint(g, '#ff5a7a', 50, 50, 42, 0); R(g, 22, 80, 60, 10, 3); g.fillStyle = '#fffaf2'; g.fill();
    pstar(g, 54, 46, 15); g.fillStyle = '#ffe066'; g.fill(); R(g, 22, 16, 7, 66, 3); g.fillStyle = '#d4245a'; g.fill();
  };
  I.task = I.book;
  I.tasks = g => {
    R(g, 16, 12, 68, 82, 12); paint(g, '#3db8ff', 50, 50, 46, 0); R(g, 24, 22, 52, 64, 6); g.fillStyle = '#ffffff'; g.fill();
    R(g, 36, 6, 28, 14, 6); paint(g, '#7c5cff', 50, 12, 14, 0);
    for (let i = 0; i < 3; i++) { PL(g, [30, 38 + i * 15, 34, 42 + i * 15, 41, 33 + i * 15], true); stroke(g, i < 2 ? '#21c07a' : '#cfd4f0', 4); R(g, 46, 36 + i * 15, 24, 5, 2.5); g.fillStyle = '#cfd4f0'; g.fill(); }
    pstar(g, 76, 80, 14); paint(g, '#ffd23f', 76, 80, 14, 0);
  };
  I.sell = g => { I.coin(g); };
  I.home = g => { PL(g, [50, 10, 92, 46, 82, 46, 82, 90, 18, 90, 18, 46, 8, 46]); paint(g, '#ff7a6b', 50, 50, 42, 0); R(g, 42, 60, 16, 30, 5); g.fillStyle = '#fff'; g.fill(); };
  // new: album (collection book), event (calendar flag), mystery (question box), combo (flame x), hint (light bulb)
  I.album = g => {
    R(g, 12, 14, 76, 76, 12); paint(g, '#7c5cff', 50, 50, 44, 0); R(g, 20, 22, 60, 60, 8); g.fillStyle = '#ffffff'; g.fill();
    for (let i = 0; i < 4; i++) { const x = 26 + (i % 2) * 26, y = 28 + (i >> 1) * 26; R(g, x, y, 22, 22, 6); g.fillStyle = ['#ffd3e6', '#c9f7e2', '#cfeaff', '#fff0a8'][i]; g.fill(); }
    heart(g, 37, 41, 7); g.fillStyle = '#ff4f9a'; g.fill(); pstar(g, 63, 39, 8); g.fillStyle = '#ffc21e'; g.fill(); E(g, 37, 65, 6, 6); g.fillStyle = '#3db8ff'; g.fill(); sparkAt(g, 63, 65, 8, '#2fd59a');
  };
  I.event = g => {
    R(g, 12, 20, 76, 70, 12); paint(g, '#ffffff', 50, 55, 44, 0); R(g, 12, 20, 76, 22, 10); paint(g, '#ff5a7a', 50, 30, 40, 0); g.fillRect(12, 34, 76, 8);
    for (const x of [30, 70]) { R(g, x - 4, 10, 8, 18, 4); g.fillStyle = '#7c5cff'; g.fill(); }
    pstar(g, 50, 66, 18); paint(g, '#ffd23f', 50, 64, 18, 0);
  };
  I.mystery = g => {
    R(g, 12, 18, 76, 72, 14); paint(g, '#b066ff', 50, 52, 44, 0); R(g, 8, 14, 84, 20, 10); paint(g, '#d08aff', 50, 22, 42, 0);
    R(g, 44, 14, 12, 76, 3); g.fillStyle = '#ffd84a'; g.fill();
    g.font = '900 46px ui-rounded,system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = '#5a2a9a'; g.lineJoin = 'round'; g.strokeText('?', 50, 60); g.fillStyle = '#ffffff'; g.fillText('?', 50, 60);
    sparkAt(g, 84, 12, 9, '#fff6c0');
  };
  I.combo = g => {
    g.beginPath(); g.moveTo(50, 6); g.bezierCurveTo(74, 30, 90, 46, 84, 68); g.bezierCurveTo(78, 90, 60, 96, 50, 96); g.bezierCurveTo(32, 96, 14, 86, 16, 64); g.bezierCurveTo(18, 46, 32, 40, 34, 24); g.bezierCurveTo(44, 34, 46, 40, 50, 6); g.closePath();
    vpaint(g, '#ff6b3d', 6, 96, 0);
    g.beginPath(); g.moveTo(50, 40); g.bezierCurveTo(64, 54, 72, 64, 68, 76); g.bezierCurveTo(64, 90, 36, 90, 32, 76); g.bezierCurveTo(30, 64, 44, 58, 50, 40); g.closePath(); vpaint(g, '#ffd84a', 40, 90, 0);
    g.font = '900 30px ui-rounded,system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#c2331a'; g.fillText('×', 50, 72);
  };
  I.hint = g => {
    E(g, 50, 42, 32, 32); paint(g, '#ffe066', 50, 40, 34, 0); R(g, 36, 68, 28, 18, 5); paint(g, '#9aa6ff', 50, 76, 16, 0);
    PL(g, [40, 74, 60, 74], true); stroke(g, '#ffffff', 3, .8); PL(g, [44, 50, 50, 40, 56, 50], true); stroke(g, '#ff9a1e', 4);
    R(g, 42, 86, 16, 6, 3); g.fillStyle = '#7c86e0'; g.fill(); sparkAt(g, 84, 18, 8, '#ffffff'); sparkAt(g, 16, 28, 6, '#ffffff');
  };

  // ---- panels and buttons (drawn live; cheap shapes, no shadowBlur) ----
  // styles: paper (white card), wood (bold grape card for the bottom bar), button (sunny pill), buttonHot (mint pill),
  // buttonBlue, buttonGrey, buttonPink, dark, glass (frosted), ribbon (coral banner pill)
  const PAL = {
    button: ['#fff27a', '#ffc81e', '#d98a00'],
    buttonHot: ['#5ff0b0', '#19c37f', '#0b8a58'],
    buttonBlue: ['#8fdcff', '#33a8ff', '#1a6fd0'],
    buttonPink: ['#ff9ccc', '#ff4f9a', '#c01f6a'],
    buttonGrey: ['#f4f4fb', '#d7d8ea', '#9a9cc0'],
    wood: ['#8d7cff', '#5e47ea', '#3c2aa8'],
    dark: ['#5a4f9a', '#3c3278', '#241c52']
  };
  A.panel = function (ctx, x, y, w, h, style) {
    style = style || 'paper';
    ctx.save();
    if (style === 'ribbon') {
      const r = h / 2;
      R(ctx, x, y + 3, w, h, r); ctx.fillStyle = 'rgba(190,40,90,.45)'; ctx.fill();
      R(ctx, x, y, w, h, r); const gr = ctx.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, '#ff8a6b'); gr.addColorStop(.5, '#ff5a8a'); gr.addColorStop(1, '#ff4fb0');
      ctx.fillStyle = gr; ctx.fill();
      R(ctx, x + 6, y + 3, w - 12, h * .4, h * .2); ctx.fillStyle = 'rgba(255,255,255,.32)'; ctx.fill();
      R(ctx, x, y, w, h, r); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke();
      ctx.restore(); return;
    }
    if (style === 'paper' || style === 'glass') {
      const r = Math.min(22, h * .3, w * .3);
      R(ctx, x, y + 4, w, h, r); ctx.fillStyle = 'rgba(60,45,150,.13)'; ctx.fill();
      R(ctx, x, y, w, h, r);
      const gr = ctx.createLinearGradient(0, y, 0, y + h);
      if (style === 'glass') { gr.addColorStop(0, 'rgba(255,255,255,.78)'); gr.addColorStop(1, 'rgba(240,245,255,.62)'); }
      else { gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#f5f6ff'); }
      ctx.fillStyle = gr; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = style === 'glass' ? 'rgba(255,255,255,.95)' : 'rgba(124,92,255,.16)'; ctx.stroke();
      ctx.restore(); return;
    }
    const pal = PAL[style] || PAL.button, card = style === 'wood' || style === 'dark';
    const r = card ? Math.min(24, h * .3, w * .3) : Math.min(h / 2, w / 2), dep = Math.max(3, Math.min(6, h * .1));
    R(ctx, x, y + dep + 2, w, h, r); ctx.fillStyle = 'rgba(50,30,130,.18)'; ctx.fill();
    R(ctx, x, y + dep, w, h, r); ctx.fillStyle = pal[2]; ctx.fill();
    R(ctx, x, y, w, h, r); const gr = ctx.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, pal[0]); gr.addColorStop(1, pal[1]); ctx.fillStyle = gr; ctx.fill();
    // shine: a glossy top band and a small highlight dot
    R(ctx, x + Math.min(10, w * .08), y + h * .08, w - Math.min(20, w * .16), h * .36, Math.min(r, h * .18)); ctx.fillStyle = 'rgba(255,255,255,.38)'; ctx.fill();
    if (!card && w > 40) { E(ctx, x + Math.min(r, h / 2) * .75, y + h * .3, Math.max(2, h * .08), Math.max(1.5, h * .05), -.6); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill(); }
    R(ctx, x, y, w, h, r); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.stroke();
    ctx.restore();
  };

  // ---- background: sunny sea-sky gradient with soft bokeh bubbles and a light wave pattern (cached) ----
  let _bg = null, _bgKey = '';
  A.bg = function (ctx, w, h, t) {
    const sc = scaleOf(ctx), ph = A.env ? A.env().phase : 'day', key = w + 'x' + h + '@' + sc + ph;
    if (key !== _bgKey) {
      _bgKey = key; _bg = mk(w * sc, h * sc); const g = _bg.getContext('2d'); g.scale(sc, sc);
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#7fd3ff'); gr.addColorStop(.38, '#bfe9ff'); gr.addColorStop(.72, '#e8f6ff'); gr.addColorStop(1, '#fff0de');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      // warm sun glow, top right
      const sg = g.createRadialGradient(w * .9, h * .05, 0, w * .9, h * .05, Math.max(w, h) * .55); sg.addColorStop(0, 'rgba(255,240,170,.75)'); sg.addColorStop(1, 'rgba(255,240,170,0)');
      g.fillStyle = sg; g.fillRect(0, 0, w, h);
      // pink haze, bottom left
      const pg = g.createRadialGradient(0, h, 0, 0, h, Math.max(w, h) * .6); pg.addColorStop(0, 'rgba(255,170,210,.38)'); pg.addColorStop(1, 'rgba(255,170,210,0)');
      g.fillStyle = pg; g.fillRect(0, 0, w, h);
      // soft wave lines
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.lineCap = 'round';
      const s = Math.max(28, Math.min(46, w / 10));
      for (let y = s * .8, row = 0; y < h; y += s * 1.6, row++) {
        g.beginPath();
        for (let x = -s + (row % 2) * s * .5; x < w + s; x += s) { g.moveTo(x, y); g.quadraticCurveTo(x + s * .25, y - s * .16, x + s * .5, y); }
        g.stroke();
      }
      // bokeh bubbles
      const rr = srnd(11);
      for (let i = 0; i < 26; i++) {
        const x = rr() * w, y = rr() * h, r = 6 + rr() * 26, a = .12 + rr() * .2;
        const bg = g.createRadialGradient(x - r * .3, y - r * .3, 0, x, y, r); bg.addColorStop(0, 'rgba(255,255,255,' + a * 1.6 + ')'); bg.addColorStop(1, 'rgba(255,255,255,' + a * .3 + ')');
        g.fillStyle = bg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
      for (let i = 0; i < 18; i++) sparkAt(g, rr() * w, rr() * h, 2 + rr() * 4, 'rgba(255,255,255,.75)');
      // a gentle wash for the hour (ART.env): lilac after dark, peach at sunset; light enough to keep the board readable
      const wash = { night: ['rgba(60,50,150,.34)', 'rgba(120,90,190,.12)'], dusk: ['rgba(120,80,190,.24)', 'rgba(255,150,170,.1)'], sunset: ['rgba(255,140,120,.2)', 'rgba(255,190,140,.1)'], golden: ['rgba(255,190,110,.12)', 'rgba(255,220,160,.06)'], dawn: ['rgba(255,160,200,.16)', 'rgba(255,220,180,.08)'] }[ph];
      if (wash) { const wg = g.createLinearGradient(0, 0, 0, h); wg.addColorStop(0, wash[0]); wg.addColorStop(1, wash[1]); g.fillStyle = wg; g.fillRect(0, 0, w, h); }
    }
    ctx.drawImage(_bg, 0, 0, w, h);
  };

  // ---- logo: chunky bubble letters in a candy gradient, kringel on top, a glossy pill subtitle ----
  A.logo = function (ctx, x0, y0, w, t) {
    t = t || 0; const word = 'Saarepagar', fs = w / 6.2, x = x0 + w / 2, y = y0 + w * .2;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 ' + fs + 'px ' + A.theme.font;
    const ks = w * .3, kr = A.item('bread', 7, Math.round(ks * scaleOf(ctx)));
    const bob = Math.sin(t * 2) * w * .012;
    ctx.save(); ctx.translate(x, y - fs * .5 - ks * .4 + bob); ctx.rotate(Math.sin(t * 1.3) * .07); ctx.drawImage(kr, -ks / 2, -ks / 2, ks, ks); ctx.restore();
    let tw = 0; const ws = []; for (const ch of word) { const m = ctx.measureText(ch).width * .94; ws.push(m); tw += m; }
    const cols = [['#ffe66a', '#ff9a2e'], ['#ff9ccc', '#ff3d8b'], ['#8fe3ff', '#2f9cff'], ['#9ff0c8', '#19c38a'], ['#d0b8ff', '#7c5cff']];
    // three passes so no letter's outline covers its neighbour: dark rim, white rim, then the candy fill
    for (let pass = 0; pass < 3; pass++) {
      let cx = x - tw / 2;
      for (let i = 0; i < word.length; i++) {
        const ch = word[i], lx = cx + ws[i] / 2, ly = y + Math.sin(t * 2.4 - i * .55) * fs * .06, rot = Math.sin(t * 1.7 - i * .7) * .04, cc = cols[i % cols.length];
        ctx.save(); ctx.translate(lx, ly); ctx.rotate(rot); ctx.lineJoin = 'round';
        if (pass === 0) { ctx.lineWidth = fs * .3; ctx.strokeStyle = '#3a1f6e'; ctx.strokeText(ch, 0, fs * .08); ctx.strokeText(ch, 0, 0); }
        else if (pass === 1) { ctx.lineWidth = fs * .14; ctx.strokeStyle = '#ffffff'; ctx.strokeText(ch, 0, 0); }
        else {
          const gr = ctx.createLinearGradient(0, -fs * .45, 0, fs * .45); gr.addColorStop(0, cc[0]); gr.addColorStop(1, cc[1]);
          ctx.fillStyle = gr; ctx.fillText(ch, 0, 0);
          ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.save(); ctx.beginPath(); ctx.rect(-fs, -fs, fs * 2, fs * .78); ctx.clip(); ctx.fillText(ch, 0, -fs * .04); ctx.restore();
        }
        ctx.restore(); cx += ws[i];
      }
    }
    const sw = w * .74, sh = fs * .48, sy = y + fs * .7;
    A.panel(ctx, x - sw / 2, sy, sw, sh, 'ribbon');
    ctx.font = '800 ' + (sh * .52) + 'px ' + A.theme.font; ctx.fillStyle = '#ffffff'; ctx.fillText('kohvik-pagarikoda mere ääres', x, sy + sh * .53);
    for (let i = 0; i < 4; i++) { const a = (t * .8 + i / 4) % 1; sparkAt(ctx, x + (i - 1.5) * tw * .34, y - fs * .7 + (i % 2) * fs * .9, fs * .16 * Math.sin(a * Math.PI) + .1, '#ffffff'); }
    ctx.restore();
  };

  window.__art = A;
  return A;
})();
