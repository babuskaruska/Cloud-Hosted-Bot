// Saarepagar UI (Mira): layout (portrait first, landscape side by side), drawing, input (drag, tap, long press),
// screens (board, orders, tasks, story, shop, bag, daily, settings, chain, album, festival, level-up), hints,
// combo meter, lucky / merge-5 / discovery moments, tutorial pointer and all text.
// Art, effects and audio come from ART / FX / sfx / MUSIC / AU when they exist; otherwise simple placeholders are drawn.
// Phone rules: every text is at least 15 CSS px, every button at least 48 px, items fill about 92 % of their cell.
const UI = (() => {
  const cv = document.getElementById('cv'), g = cv.getContext('2d');
  // Colours come from Ash's ART.theme so the UI matches the art; the defaults are the same candy palette.
  const TH = (() => { try { if (typeof ART !== 'undefined' && ART && ART.theme) return ART.theme; } catch (e) {} return {}; })();
  const FONT = TH.font || 'ui-rounded,"SF Pro Rounded",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
  const INK = TH.ink || '#33285c', INK2 = TH.ink2 || '#7a72a6', CARD = TH.card || '#ffffff', EDGE = TH.cardEdge || 'rgba(110,100,200,.16)';
  const GOOD = TH.good || '#21c07a', GOLD = TH.sun || '#ffd23f', PINK = TH.berry || '#ff4f9a', GRAPE = TH.grape || '#7c5cff', MINT = TH.mint || '#2fd59a';
  const SHADOW = 'rgba(50,30,130,0.16)', DARK = 'rgba(40,28,96,0.78)', SOFT = 'rgba(110,100,200,0.09)', OUTL = '#3a1f7a';
  const MINF = 15;      // smallest text size, CSS px
  const FILL = 0.92;    // share of a cell an item's visible art fills
  let W = 0, H = 0, DPR = 1;
  const L = {};
  let dirty = true, animUntil = 0, fxUntil = 0, lastDraw = 0;
  let sel = -1, drag = null, ptr = null, dropPt = null, ordScroll = 0, ordMax = 0;
  let hits = [], mhits = [], cardRects = [], pressed = null, spring = null;
  const anim = new Map(), ghosts = [], floaters = [], toasts = [], banners = [], newq = [];
  let modal = null; const mq = [];
  // scr: which screen is under the modals once the title is gone: 'board' (the café), 'map' or 'level' (Seiklus, 55-map.js).
  let scr = 'board';
  const onBoard = () => !onTitle && scr === 'board';
  let onTitle = true, audioUnlocked = false, progressSet = new Set(), progressN = -1, flash = null;
  let combo = null, lastMerge = null, idleT = 0, hint = null, hintAt = 0, needSet = new Set();
  const disp = { en: null, coins: null, stars: null }, bump = {};

  // ---- defensive access to the other team members' APIs ----
  const artOn = f => { try { return typeof ART !== 'undefined' && ART && typeof ART[f] === 'function'; } catch (e) { return false; } };
  const fxOn = f => { try { return typeof FX !== 'undefined' && FX && typeof FX[f] === 'function'; } catch (e) { return false; } };
  function snd(name, opts) { try { if (typeof sfx === 'function') sfx(name, opts || {}); } catch (e) {} }
  // New sounds fall back to an existing one until Echo adds them.
  function snd2(name, fallback, opts) {
    let have = false; try { have = typeof AU !== 'undefined' && AU && Array.isArray(AU.sounds) && AU.sounds.includes(name); } catch (e) {}
    snd(have ? name : fallback, opts);
  }
  function music(name, opts) { try { if (typeof MUSIC !== 'undefined' && MUSIC && typeof MUSIC.scene === 'function') MUSIC.scene(name, opts); } catch (e) {} }
  function fx(name, ...a) { if (!fxOn(name)) return false; try { FX[name](...a); fxUntil = performance.now() + 1800; return true; } catch (e) { return false; } }
  function au() { try { return typeof AU !== 'undefined' && AU ? AU : null; } catch (e) { return null; } }
  const tn = () => performance.now() / 1000;
  const keep = s => { animUntil = Math.max(animUntil, performance.now() + s * 1000 + 60); };

  // ---- small drawing helpers ----
  function rr(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function shade(hex, a) {
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = n >> 8 & 255, b = n & 255;
    if (a >= 0) { r += (255 - r) * a; gg += (255 - gg) * a; b += (255 - b) * a; } else { r *= 1 + a; gg *= 1 + a; b *= 1 + a; }
    return 'rgb(' + (r | 0) + ',' + (gg | 0) + ',' + (b | 0) + ')';
  }
  function font(size, weight) { return (weight || 700) + ' ' + size + 'px ' + FONT; }
  // Text never shrinks below MINF; if it still does not fit, it is cut with an ellipsis.
  function fit(s, size, weight, maxW) {
    g.font = font(size, weight); if (!maxW || g.measureText(s).width <= maxW) return [s, size];
    let sz = size; while (sz > MINF && g.measureText(s).width > maxW) { sz--; g.font = font(sz, weight); }
    if (g.measureText(s).width <= maxW) return [s, sz];
    let t = s; while (t.length > 1 && g.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return [t.trimEnd() + '…', sz];
  }
  function text(s, x, y, size, color, align, weight, maxW) {
    size = Math.max(MINF, size); const [t, sz] = fit(String(s), size, weight || 700, maxW);
    g.font = font(sz, weight || 700); g.fillStyle = color || INK; g.textAlign = align || 'center'; g.textBaseline = 'middle';
    g.fillText(t, x, y);
  }
  // Punchy outlined text for big moments.
  function textO(s, x, y, size, fill, stroke, lw, maxW) {
    size = Math.max(MINF, size); const [t, sz] = fit(String(s), size, 900, maxW);
    g.font = font(sz, 900); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = lw || Math.max(3, sz * 0.16); g.strokeStyle = stroke || OUTL; g.strokeText(t, x, y);
    g.fillStyle = fill || '#fff'; g.fillText(t, x, y);
  }
  function wrap(s, maxW, size, weight) {
    g.font = font(Math.max(MINF, size), weight); const words = String(s).split(' '), lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur); return lines;
  }
  function bar(x, y, w, h, k, col, back) {
    g.fillStyle = back || 'rgba(110,100,200,0.16)'; rr(x, y, w, h, h / 2); g.fill();
    if (k > 0) { g.fillStyle = col || '#5fc24a'; rr(x, y, Math.max(h, w * clamp(k, 0, 1)), h, h / 2); g.fill(); g.fillStyle = 'rgba(255,255,255,0.35)'; rr(x + 2, y + 1.5, Math.max(0, w * clamp(k, 0, 1) - 4), h * 0.35, h / 4); g.fill(); }
  }
  const PANEL_PH = { paper: [CARD, '#d8d4f4'], glass: ['rgba(255,255,255,0.8)', '#ffffff'], wood: ['#8d7cff', '#3c2aa8'], button: ['#ffd84a', '#d98a00'], buttonHot: ['#3fe0a0', '#0b8a58'], ribbon: ['#ff5a8a', '#c01f6a'], buttonGrey: ['#eceaf8', '#9a9cc0'], buttonBlue: ['#5ac0ff', '#1a6fd0'], buttonPink: ['#ff7ab8', '#c01f6a'] };
  function panel(x, y, w, h, style) {
    if (artOn('panel')) { try { ART.panel(g, x, y, w, h, style); return; } catch (e) {} }
    const [f, b] = PANEL_PH[style] || PANEL_PH.paper, r = Math.min(16, h / 2.6);
    g.fillStyle = SHADOW; rr(x, y + 3, w, h, r); g.fill();
    g.fillStyle = f; rr(x, y, w, h, r); g.fill();
    g.lineWidth = 2; g.strokeStyle = b; rr(x + 1, y + 1, w - 2, h - 2, r); g.stroke();
    if (style !== 'paper' && style !== 'wood') { g.fillStyle = 'rgba(255,255,255,0.28)'; rr(x + 4, y + 3, w - 8, h * 0.38, r * 0.7); g.fill(); }
  }
  // Springy button: squashes while pressed, overshoots and settles when released.
  function pressScale(x, y) {
    if (pressed && pressed.x === x && pressed.y === y) return 0.9;
    if (spring && spring.x === x && spring.y === y) { const u = (tn() - spring.t0) / 0.45; if (u < 1) return 1 + 0.12 * Math.sin(u * Math.PI * 1.5) * (1 - u); }
    return 1;
  }
  function button(x, y, w, h, label, fn, opts) {
    opts = opts || {};
    const style = opts.off ? 'buttonGrey' : opts.hot ? 'buttonHot' : opts.style || 'button';
    const s = pressScale(x, y) * (opts.pulse ? 1 + Math.sin(tn() * 5) * 0.035 : 1);
    g.save(); if (s !== 1) { g.translate(x + w / 2, y + h / 2); g.scale(s, s); g.translate(-x - w / 2, -y - h / 2); }
    panel(x, y, w, h, style);
    const size = Math.max(MINF, opts.size || 17), light = style === 'button' || style === 'buttonGrey', col = style === 'buttonGrey' ? INK2 : light ? INK : '#fff';
    const olc = light ? 'rgba(0,0,0,0)' : 'rgba(30,20,90,0.28)';
    let tx = x + w / 2;
    if (opts.icon || opts.item) {
      const is = Math.min(opts.isz || 28, h - 12); const [t] = fit(label, size, 900, w - is - 22); g.font = font(size, 900); const tw = label ? g.measureText(t).width : 0;
      const x0 = x + (w - (is + (label ? 6 : 0) + tw)) / 2;
      if (opts.icon) drawIcon(opts.icon, x0, y + (h - is) / 2 - 1, is); else drawItem(opts.item[0], opts.item[1], x0 + is / 2, y + h / 2 - 1, is);
      tx = x0 + is + 6 + tw / 2;
      if (label) { g.lineJoin = 'round'; g.lineWidth = 3.5; g.strokeStyle = olc; g.textAlign = 'center'; g.textBaseline = 'middle'; g.strokeText(t, tx, y + h / 2); g.fillStyle = col; g.fillText(t, tx, y + h / 2); }
    } else {
      const [t, sz] = fit(label, size, 900, w - 14); g.font = font(sz, 900); g.textAlign = 'center'; g.textBaseline = 'middle';
      if (!light) { g.lineJoin = 'round'; g.lineWidth = 3.5; g.strokeStyle = olc; g.strokeText(t, tx, y + h / 2); }
      g.fillStyle = col; g.fillText(t, tx, y + h / 2);
    }
    g.restore();
    const hh = Math.max(48, h), hw = Math.max(48, w);
    (opts.modal ? mhits : hits).push({ x: x - (hw - w) / 2, y: y - (hh - h) / 2, w: hw, h: hh, bx: x, by: y, fn: opts.off && !opts.offFn ? null : (opts.offFn && opts.off ? opts.offFn : fn) });
  }

  // ---- item images (Ash's ART.item or a placeholder), scaled so the visible art fills the box ----
  const artHasItem = k => { try { return artOn('item') && ART.defs && !!(ART.defs[k] || (ART.alias && ART.defs[ART.alias[k]])); } catch (e) { return false; } };
  const phCache = new Map();
  function itemImg(k, l, px) {
    px = Math.max(8, Math.round(px));
    if (artHasItem(k)) { try { const c = ART.item(k, l, px); if (c && c.width) return c; } catch (e) {} }
    if (k === 'mbox' && artOn('icon') && ART.iconDefs && ART.iconDefs.mystery) { try { const c = ART.icon('mystery', px); if (c && c.width) return c; } catch (e) {} }
    const key = k + ':' + l + ':' + px; let c = phCache.get(key);
    if (!c) { c = phItem(k, l, px); if (phCache.size > 300) phCache.clear(); phCache.set(key, c); }
    return c;
  }
  // Bounding box of the visible art (alpha > 60, so soft shadows don't count), measured once per item at 96 px.
  const boxCache = new Map();
  function itemBox(k, l) {
    const key = k + ':' + l; let b = boxCache.get(key); if (b) return b;
    b = { cx: 0.5, cy: 0.5, s: 0.8 };
    try {
      const n = 96, src = itemImg(k, l, n), c = document.createElement('canvas'); c.width = c.height = n;
      const x = c.getContext('2d'); x.drawImage(src, 0, 0, n, n);
      const d = x.getImageData(0, 0, n, n).data; let x0 = n, y0 = n, x1 = -1, y1 = -1;
      for (let y = 0; y < n; y++) for (let xx = 0; xx < n; xx++) if (d[(y * n + xx) * 4 + 3] > 60) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 >= 0) b = { cx: (x0 + x1 + 1) / 2 / n, cy: (y0 + y1 + 1) / 2 / n, s: Math.max(x1 - x0 + 1, y1 - y0 + 1) / n };
    } catch (e) {}
    boxCache.set(key, b); return b;
  }
  // Draw item k:l with its visible art 'size' px across, centred on (cx, cy).
  function drawItem(k, l, cx, cy, size, alpha) {
    const b = itemBox(k, l), f = clamp(1 / b.s, 1, 1.7), full = size * f;
    const px = Math.ceil(full * DPR / 8) * 8, img = itemImg(k, l, px);
    if (alpha !== undefined && alpha < 1) g.globalAlpha = Math.max(0, alpha);
    g.drawImage(img, cx - full * b.cx, cy - full * b.cy, full, full);
    g.globalAlpha = 1;
  }
  const silCache = new Map();
  function drawSilhouette(k, l, cx, cy, size) {
    const px = Math.ceil(size * DPR / 8) * 8, key = k + ':' + l + ':' + px; let c = silCache.get(key);
    if (!c) {
      const b = itemBox(k, l), f = clamp(1 / b.s, 1, 1.7), full = px * f;
      c = document.createElement('canvas'); c.width = c.height = px; const x = c.getContext('2d');
      x.drawImage(itemImg(k, l, Math.ceil(full / 8) * 8), px / 2 - full * b.cx, px / 2 - full * b.cy, full, full);
      x.globalCompositeOperation = 'source-in'; x.fillStyle = 'rgba(110,80,60,0.28)'; x.fillRect(0, 0, px, px);
      silCache.set(key, c);
    }
    g.drawImage(c, cx - size / 2, cy - size / 2, size, size);
  }
  function phItem(k, l, px) {
    const c = document.createElement('canvas'); c.width = c.height = px;
    const x = c.getContext('2d'), C = CHAINS[k], col = C.color, s = px, kind = C.kind;
    if (kind === 'mystery') { // purple gift box with a question mark
      const w = s * 0.74, h = s * 0.6, x0 = (s - w) / 2, y0 = s * 0.3;
      const gr = x.createLinearGradient(0, y0, 0, y0 + h); gr.addColorStop(0, '#c08af0'); gr.addColorStop(1, '#7a3ac8');
      x.fillStyle = 'rgba(60,20,90,0.25)'; x.beginPath(); x.ellipse(s / 2, s * 0.93, w * 0.45, s * 0.04, 0, 0, 7); x.fill();
      x.fillStyle = gr; x.beginPath(); x.roundRect ? x.roundRect(x0, y0, w, h, s * 0.08) : x.rect(x0, y0, w, h); x.fill();
      x.lineWidth = s * 0.04; x.strokeStyle = '#4a1a80'; x.stroke();
      x.fillStyle = '#ffd34a'; x.fillRect(s / 2 - s * 0.06, y0, s * 0.12, h); x.fillRect(x0 - s * 0.03, y0 - s * 0.02, w + s * 0.06, s * 0.13);
      x.strokeRect(x0 - s * 0.03, y0 - s * 0.02, w + s * 0.06, s * 0.13);
      x.beginPath(); x.ellipse(s / 2 - s * 0.12, y0 - s * 0.08, s * 0.12, s * 0.08, -0.5, 0, 7); x.ellipse(s / 2 + s * 0.12, y0 - s * 0.08, s * 0.12, s * 0.08, 0.5, 0, 7); x.fill(); x.stroke();
      x.font = '900 ' + Math.round(s * 0.36) + 'px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.lineWidth = s * 0.05; x.strokeStyle = '#4a1a80'; x.strokeText('?', s / 2, y0 + h * 0.58); x.fillStyle = '#fff'; x.fillText('?', s / 2, y0 + h * 0.58);
      return c;
    }
    const grow = 0.7 + 0.28 * (l - 1) / Math.max(1, C.names.length - 1);
    const r = s * 0.5 * grow, cx = s / 2, cy = s / 2;
    x.lineWidth = Math.max(1.5, s * 0.045); x.strokeStyle = shade(col, -0.45);
    const gr = x.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.1); gr.addColorStop(0, shade(col, 0.45)); gr.addColorStop(1, shade(col, -0.08)); x.fillStyle = gr;
    x.beginPath();
    if (kind === 'gen') { const w = r * 1.8, h = r * 1.5, y0 = cy - h * 0.35; x.moveTo(cx - w / 2, y0); x.lineTo(cx, y0 - h * 0.45); x.lineTo(cx + w / 2, y0); x.lineTo(cx + w / 2, y0 + h * 0.85); x.lineTo(cx - w / 2, y0 + h * 0.85); x.closePath(); }
    else if (kind === 'chest') { const w = r * 1.9, h = r * 1.4; x.rect(cx - w / 2, cy - h / 2, w, h); }
    else { const n = 6 + (l % 3); for (let j = 0; j <= 40; j++) { const a = j / 40 * Math.PI * 2, q = r * (1 + 0.06 * Math.sin(a * n)); x.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); } x.closePath(); }
    x.fill(); x.stroke();
    x.fillStyle = 'rgba(255,255,255,0.45)'; x.beginPath(); x.ellipse(cx - r * 0.35, cy - r * 0.45, r * 0.28, r * 0.16, -0.5, 0, Math.PI * 2); x.fill();
    x.fillStyle = shade(col, -0.6); x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '800 ' + Math.round(s * 0.27) + 'px ' + FONT;
    x.fillText(C.names[l - 1].slice(0, 2), cx, cy);
    return c;
  }

  // ---- icons and portraits ----
  const ICON_ALIAS = { album: 'book', event: 'star', order: 'check', freeEnergy: 'energy', pass: 'crown', week: 'event' };
  const icCache = new Map();
  function iconImg(name, px) {
    px = Math.max(8, Math.round(px));
    const defs = artOn('icon') && ART.iconDefs;
    if (defs && defs[name]) { try { const c = ART.icon(name, px); if (c && c.width) return c; } catch (e) {} }
    const key = name + ':' + px; let c = icCache.get(key);
    if (!c) {
      if (defs && !PH_OWN[name] && ICON_ALIAS[name] && defs[ICON_ALIAS[name]]) { try { c = ART.icon(ICON_ALIAS[name], px); } catch (e) {} }
      if (!c) c = phIcon(name, px);
      icCache.set(key, c);
    }
    return c;
  }
  // Placeholders that are better than an alias until Ash draws them.
  const PH_OWN = { event: 1, order: 1, wardrobe: 1, camera: 1, brush: 1, cur_garden: 1, cur_fashion: 1, cur_wedding: 1, cur_beach: 1 };
  function phIcon(name, s) {
    const c = document.createElement('canvas'); c.width = c.height = s; const x = c.getContext('2d');
    const cx = s / 2, cy = s / 2, r = s * 0.42; x.lineWidth = Math.max(1.5, s * 0.07); x.lineJoin = 'round'; x.lineCap = 'round';
    const star = (rad, col, sc) => { x.beginPath(); for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + j * Math.PI / 5, q = j % 2 ? rad * 0.45 : rad; x.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q * 1.02 + s * 0.03); } x.closePath(); x.fillStyle = col; x.fill(); x.strokeStyle = sc || '#a8701a'; x.stroke(); };
    const circ = (rad, f, st) => { x.beginPath(); x.arc(cx, cy, rad, 0, 7); x.fillStyle = f; x.fill(); if (st) { x.strokeStyle = st; x.stroke(); } };
    switch (name) {
      case 'energy': case 'freeEnergy': x.beginPath(); x.moveTo(cx + r * 0.25, cy - r); x.lineTo(cx - r * 0.6, cy + r * 0.12); x.lineTo(cx - r * 0.02, cy + r * 0.12); x.lineTo(cx - r * 0.25, cy + r); x.lineTo(cx + r * 0.62, cy - r * 0.18); x.lineTo(cx + r * 0.05, cy - r * 0.18); x.closePath(); x.fillStyle = '#ffd23a'; x.fill(); x.strokeStyle = '#b07a10'; x.stroke(); break;
      case 'coin': circ(r, '#f4c542', '#d98a00'); x.beginPath(); x.arc(cx, cy, r * 0.58, 0, 7); x.stroke(); break;
      case 'star': star(r * 1.12, '#ffd34a'); break;
      case 'event': circ(r, '#ff6f9a', '#b8325e'); x.lineWidth = s * 0.05; star(r * 0.62, '#fff6c8', '#b8325e'); break;
      case 'order': circ(r, '#3fb84a', '#fff'); x.strokeStyle = '#fff'; x.lineWidth = s * 0.12; x.beginPath(); x.moveTo(cx - r * 0.45, cy); x.lineTo(cx - r * 0.1, cy + r * 0.38); x.lineTo(cx + r * 0.5, cy - r * 0.35); x.stroke(); break;
      case 'xp': circ(r, '#7ab8e8', '#3a6a9a'); break;
      case 'gift': x.fillStyle = '#e8605a'; x.strokeStyle = '#9a3430'; x.fillRect(cx - r * 0.85, cy - r * 0.35, r * 1.7, r * 1.25); x.strokeRect(cx - r * 0.85, cy - r * 0.35, r * 1.7, r * 1.25); x.fillStyle = '#ffd34a'; x.fillRect(cx - r * 0.15, cy - r * 0.35, r * 0.3, r * 1.25); x.fillRect(cx - r, cy - r * 0.6, r * 2, r * 0.32); x.strokeRect(cx - r, cy - r * 0.6, r * 2, r * 0.32); break;
      case 'bag': x.beginPath(); x.ellipse(cx, cy + r * 0.25, r * 0.85, r * 0.72, 0, 0, 7); x.fillStyle = '#c99a5a'; x.fill(); x.strokeStyle = '#7a5226'; x.stroke(); break;
      case 'shop': x.fillStyle = '#fff6e6'; x.strokeStyle = '#7a4a26'; x.fillRect(cx - r * 0.8, cy - r * 0.2, r * 1.6, r * 1.1); x.strokeRect(cx - r * 0.8, cy - r * 0.2, r * 1.6, r * 1.1); for (let j = 0; j < 4; j++) { x.fillStyle = j % 2 ? '#fff' : '#e8605a'; x.fillRect(cx - r + j * r * 0.5, cy - r * 0.75, r * 0.5, r * 0.55); } break;
      case 'settings': x.fillStyle = '#a89480'; x.strokeStyle = '#5a4634'; x.beginPath(); for (let j = 0; j < 16; j++) { const a = j / 16 * Math.PI * 2, q = j % 2 ? r * 0.72 : r; x.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); } x.closePath(); x.fill(); x.stroke(); circ(r * 0.32, '#fff6e6', '#5a4634'); break;
      case 'check': circ(r, '#6cbf4a'); x.strokeStyle = '#fff'; x.lineWidth = s * 0.1; x.beginPath(); x.moveTo(cx - r * 0.45, cy); x.lineTo(cx - r * 0.1, cy + r * 0.38); x.lineTo(cx + r * 0.5, cy - r * 0.35); x.stroke(); break;
      case 'lock': x.strokeStyle = '#7a6a5a'; x.lineWidth = s * 0.1; x.beginPath(); x.arc(cx, cy - r * 0.15, r * 0.42, Math.PI, 0); x.stroke(); x.fillStyle = '#b8a48c'; x.fillRect(cx - r * 0.65, cy - r * 0.15, r * 1.3, r * 1.0); break;
      case 'album': case 'book': x.fillStyle = '#5aa0d8'; x.strokeStyle = '#2b5a8a'; x.fillRect(cx - r * 0.8, cy - r * 0.9, r * 1.6, r * 1.8); x.strokeRect(cx - r * 0.8, cy - r * 0.9, r * 1.6, r * 1.8); star(r * 0.45, '#ffd34a'); break;
      case 'tasks': x.fillStyle = '#fff6e6'; x.strokeStyle = '#7a4a26'; x.fillRect(cx - r * 0.7, cy - r * 0.9, r * 1.4, r * 1.8); x.strokeRect(cx - r * 0.7, cy - r * 0.9, r * 1.4, r * 1.8); x.lineWidth = s * 0.06; for (let j = 0; j < 3; j++) { x.beginPath(); x.moveTo(cx - r * 0.4, cy - r * 0.45 + j * r * 0.45); x.lineTo(cx + r * 0.4, cy - r * 0.45 + j * r * 0.45); x.stroke(); } break;
      case 'heart': x.beginPath(); x.moveTo(cx, cy + r * 0.85); x.bezierCurveTo(cx - r * 1.5, cy - r * 0.1, cx - r * 0.7, cy - r * 1.2, cx, cy - r * 0.45); x.bezierCurveTo(cx + r * 0.7, cy - r * 1.2, cx + r * 1.5, cy - r * 0.1, cx, cy + r * 0.85); x.closePath(); x.fillStyle = '#ff4f7a'; x.fill(); x.strokeStyle = '#b8204a'; x.stroke(); x.fillStyle = 'rgba(255,255,255,0.6)'; x.beginPath(); x.ellipse(cx - r * 0.42, cy - r * 0.35, r * 0.18, r * 0.11, -0.6, 0, 7); x.fill(); break;
      case 'wheel': { const cols = ['#ffd23f', '#b07cff', '#5ad1ff', '#ff8ab8', '#ffb02e', '#6fe0a0', '#ff9a6b', '#ff4f9a']; for (let j = 0; j < 8; j++) { x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, r, j * Math.PI / 4, (j + 1) * Math.PI / 4); x.closePath(); x.fillStyle = cols[j]; x.fill(); } x.beginPath(); x.arc(cx, cy, r, 0, 7); x.strokeStyle = '#7a3ac8'; x.stroke(); circ(r * 0.22, '#fff', '#7a3ac8'); break; }
      case 'piggy': x.fillStyle = '#ff9cc0'; x.strokeStyle = '#c0457a'; x.beginPath(); x.ellipse(cx, cy + r * 0.1, r * 0.95, r * 0.72, 0, 0, 7); x.fill(); x.stroke(); x.beginPath(); x.ellipse(cx + r * 0.85, cy + r * 0.05, r * 0.2, r * 0.26, 0, 0, 7); x.fill(); x.stroke(); x.beginPath(); x.moveTo(cx - r * 0.45, cy - r * 0.5); x.lineTo(cx - r * 0.25, cy - r * 0.95); x.lineTo(cx - r * 0.05, cy - r * 0.55); x.fill(); x.stroke(); x.fillStyle = '#33285c'; x.beginPath(); x.arc(cx + r * 0.42, cy - r * 0.15, r * 0.08, 0, 7); x.fill(); x.fillStyle = '#c0457a'; x.fillRect(cx - r * 0.3, cy - r * 0.62, r * 0.4, r * 0.08); break;
      case 'calendar': x.fillStyle = '#fff'; x.strokeStyle = '#7a4a26'; x.fillRect(cx - r * 0.85, cy - r * 0.7, r * 1.7, r * 1.6); x.strokeRect(cx - r * 0.85, cy - r * 0.7, r * 1.7, r * 1.6); x.fillStyle = '#ff4f7a'; x.fillRect(cx - r * 0.85, cy - r * 0.7, r * 1.7, r * 0.45); x.fillStyle = '#33285c'; x.font = '900 ' + Math.round(r * 0.9) + 'px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('7', cx, cy + r * 0.38); break;
      case 'map': x.fillStyle = '#ffe9b8'; x.strokeStyle = '#a06a2a'; x.beginPath(); x.moveTo(cx - r, cy - r * 0.7); x.lineTo(cx - r * 0.33, cy - r * 0.9); x.lineTo(cx + r * 0.33, cy - r * 0.7); x.lineTo(cx + r, cy - r * 0.9); x.lineTo(cx + r, cy + r * 0.7); x.lineTo(cx + r * 0.33, cy + r * 0.9); x.lineTo(cx - r * 0.33, cy + r * 0.7); x.lineTo(cx - r, cy + r * 0.9); x.closePath(); x.fill(); x.stroke(); x.setLineDash([s * 0.06, s * 0.05]); x.strokeStyle = '#e0457a'; x.beginPath(); x.moveTo(cx - r * 0.7, cy + r * 0.5); x.quadraticCurveTo(cx - r * 0.1, cy - r * 0.4, cx + r * 0.5, cy - r * 0.3); x.stroke(); x.setLineDash([]); x.fillStyle = '#e0457a'; x.beginPath(); x.arc(cx + r * 0.55, cy - r * 0.35, r * 0.17, 0, 7); x.fill(); break;
      case 'moves': circ(r, '#5ac0ff', '#1a6fd0'); x.strokeStyle = '#fff'; x.lineWidth = s * 0.09; x.beginPath(); x.arc(cx, cy, r * 0.5, -0.4, Math.PI * 1.4); x.stroke(); break;
      case 'wardrobe': { // a dress on a hanger
        x.strokeStyle = '#7a4a26'; x.lineWidth = s * 0.06; x.beginPath(); x.arc(cx, cy - r * 0.78, r * 0.16, Math.PI, Math.PI * 2.4); x.moveTo(cx, cy - r * 0.62); x.lineTo(cx - r * 0.85, cy - r * 0.2); x.lineTo(cx + r * 0.85, cy - r * 0.2); x.closePath(); x.stroke();
        x.fillStyle = '#ff7ab8'; x.strokeStyle = '#c01f6a'; x.lineWidth = s * 0.05; x.beginPath(); x.moveTo(cx - r * 0.35, cy - r * 0.2); x.lineTo(cx + r * 0.35, cy - r * 0.2); x.lineTo(cx + r * 0.25, cy + r * 0.15); x.lineTo(cx + r * 0.75, cy + r * 0.95); x.lineTo(cx - r * 0.75, cy + r * 0.95); x.lineTo(cx - r * 0.25, cy + r * 0.15); x.closePath(); x.fill(); x.stroke();
        x.fillStyle = '#fff'; x.beginPath(); x.arc(cx, cy + r * 0.05, r * 0.09, 0, 7); x.fill(); break; }
      case 'camera': x.fillStyle = '#5a6a8a'; x.strokeStyle = '#2a3450'; x.beginPath(); x.roundRect ? x.roundRect(cx - r * 0.95, cy - r * 0.5, r * 1.9, r * 1.3, r * 0.25) : x.rect(cx - r * 0.95, cy - r * 0.5, r * 1.9, r * 1.3); x.fill(); x.stroke(); x.fillRect(cx - r * 0.35, cy - r * 0.75, r * 0.7, r * 0.3); circ(r * 0.42, '#bfe3ff', '#2a3450'); x.fillStyle = '#fff'; x.beginPath(); x.arc(cx - r * 0.12, cy - r * 0.12, r * 0.12, 0, 7); x.fill(); x.fillStyle = '#ffd23f'; x.fillRect(cx + r * 0.55, cy - r * 0.38, r * 0.22, r * 0.14); break;
      case 'brush': x.save(); x.translate(cx, cy); x.rotate(0.7); x.fillStyle = '#c99a5a'; x.strokeStyle = '#7a5226'; x.fillRect(-r * 0.12, -r * 0.1, r * 0.24, r * 1.0); x.strokeRect(-r * 0.12, -r * 0.1, r * 0.24, r * 1.0); x.fillStyle = '#c0c4d0'; x.fillRect(-r * 0.2, -r * 0.35, r * 0.4, r * 0.28); x.fillStyle = '#ff4f9a'; x.beginPath(); x.moveTo(-r * 0.22, -r * 0.35); x.quadraticCurveTo(0, -r * 1.25, r * 0.22, -r * 0.35); x.fill(); x.restore(); break;
      case 'cur_garden': for (let j = 0; j < 5; j++) { const a = j / 5 * Math.PI * 2 - Math.PI / 2; x.beginPath(); x.ellipse(cx + Math.cos(a) * r * 0.48, cy + Math.sin(a) * r * 0.48, r * 0.42, r * 0.3, a, 0, 7); x.fillStyle = '#ff9ac8'; x.fill(); x.strokeStyle = '#c0457a'; x.stroke(); } circ(r * 0.3, '#ffd23f', '#c08a10'); break;
      case 'cur_fashion': circ(r * 0.9, '#b07cff', '#5a2aa8'); x.fillStyle = '#5a2aa8'; for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { x.beginPath(); x.arc(cx + dx * r * 0.25, cy + dy * r * 0.25, r * 0.12, 0, 7); x.fill(); } break;
      case 'cur_wedding': x.fillStyle = '#ffd86a'; x.strokeStyle = '#b07a10'; x.beginPath(); x.moveTo(cx - r * 0.8, cy + r * 0.55); x.quadraticCurveTo(cx - r * 0.7, cy - r * 0.9, cx, cy - r * 0.9); x.quadraticCurveTo(cx + r * 0.7, cy - r * 0.9, cx + r * 0.8, cy + r * 0.55); x.closePath(); x.fill(); x.stroke(); x.beginPath(); x.arc(cx, cy + r * 0.7, r * 0.2, 0, 7); x.fill(); x.stroke(); x.fillStyle = '#ff8ab8'; x.beginPath(); x.arc(cx, cy - r * 0.95, r * 0.14, 0, 7); x.fill(); break;
      case 'cur_beach': x.fillStyle = '#ffd0b0'; x.strokeStyle = '#c0704a'; x.beginPath(); x.moveTo(cx, cy + r * 0.85); for (let j = 0; j <= 8; j++) { const a = Math.PI + j / 8 * Math.PI; x.lineTo(cx + Math.cos(a) * r * 0.95, cy + r * 0.15 + Math.sin(a) * r * 0.95); } x.closePath(); x.fill(); x.stroke(); for (let j = 1; j < 8; j += 2) { const a = Math.PI + j / 8 * Math.PI; x.beginPath(); x.moveTo(cx, cy + r * 0.85); x.lineTo(cx + Math.cos(a) * r * 0.9, cy + r * 0.15 + Math.sin(a) * r * 0.9); x.stroke(); } break;
      default: circ(r, '#ccc');
    }
    return c;
  }
  function drawIcon(name, x, y, s) { g.drawImage(iconImg(name, s * DPR), x, y, s, s); }
  const prCache = new Map();
  function portraitImg(who, px) {
    px = Math.max(8, Math.round(px));
    if (artOn('portrait')) { try { const c = ART.portrait(who, px); if (c && c.width) return c; } catch (e) {} }
    const key = who + ':' + px; let c = prCache.get(key);
    if (!c) {
      c = document.createElement('canvas'); c.width = c.height = px; const x = c.getContext('2d'), w = WHO[who] || WHO.mina;
      x.beginPath(); x.arc(px / 2, px / 2, px * 0.46, 0, 7); x.fillStyle = shade(w.color, 0.35); x.fill(); x.lineWidth = px * 0.05; x.strokeStyle = shade(w.color, -0.4); x.stroke();
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '800 ' + Math.round(px * 0.45) + 'px ' + FONT; x.fillText(w.name.replace('Vanaema ', '')[0], px / 2, px / 2 + px * 0.02);
      prCache.set(key, c);
    }
    return c;
  }
  function drawPortrait(who, x, y, s) { g.drawImage(portraitImg(who, s * DPR), x, y, s, s); }

  // ---- layout ----
  function insets() {
    const el = document.getElementById('safe'); if (!el) return { t: 0, r: 0, b: 0, l: 0 };
    const cs = getComputedStyle(el); return { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
  }
  const slotFor = cs => Math.round(clamp(cs * 0.95, 46, 62));
  const ordHFor = cs => slotFor(cs) + 52;
  function layout() {
    DPR = Math.min(window.devicePixelRatio || 1, (typeof ART !== 'undefined' && ART.perf) ? ART.perf.maxDpr() : 3); // ART.perf caps it on weak phones
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    const si = insets(), gap = 6, top = si.t + 6, bot = H - si.b - 4, left = si.l, right = W - si.r;
    const barH = 78, infoH = 62, OVER = 22, SCENE_MIN = 100;
    L.landscape = (right - left) >= 700 && (right - left) > (bot - top) * 1.15;
    if (L.landscape) {
      const availB = bot - top - infoH - barH - gap * 2;
      const cs = Math.max(40, Math.min(80, Math.floor(availB / ROWS), Math.floor((right - left) * 0.5 / COLS)));
      const rw = cs * COLS + 12, lw = Math.min(right - left - rw - gap * 3, 600), x0 = left + (right - left - (lw + rw + gap)) / 2, rx = x0 + lw + gap;
      L.col = { x: rx, w: rw }; L.cs = cs; L.slot = slotFor(cs);
      L.bx = rx + 6; L.by = top + Math.max(0, (availB - cs * ROWS) / 2);
      L.info = { x: rx, y: L.by + cs * ROWS + gap, w: rw, h: infoH };
      L.bar = { x: rx, y: L.info.y + infoH + gap, w: rw, h: barH };
      const oh = ordHFor(cs), sh = Math.max(160, bot - top - oh + OVER);
      L.scene = { x: x0, y: top, w: lw, h: sh };
      L.orders = { x: x0, y: top + sh - OVER, w: lw, h: oh };
    } else {
      const cw = Math.min(right - left, 560), x0 = left + (right - left - cw) / 2;
      L.col = { x: x0, w: cw };
      const avail = bot - top - barH - infoH - gap * 3;
      let cs = Math.floor((cw - 8) / COLS);
      while (cs > 34 && cs * ROWS + ordHFor(cs) - OVER + SCENE_MIN > avail) cs--;
      const oh = ordHFor(cs);
      let topH = avail - cs * ROWS, y = top;
      const maxTop = oh - OVER + 340;
      if (topH > maxTop) { y += (topH - maxTop) / 2; topH = maxTop; }
      L.cs = cs; L.slot = slotFor(cs);
      L.scene = { x: x0 + 4, y, w: cw - 8, h: topH - oh + OVER };
      L.orders = { x: x0, y: y + topH - oh, w: cw, h: oh };
      y += topH + gap;
      L.bx = x0 + (cw - cs * COLS) / 2; L.by = y; y += cs * ROWS + gap;
      L.info = { x: x0 + 4, y, w: cw - 8, h: infoH }; y += infoH + gap;
      L.bar = { x: x0, y, w: cw, h: barH };
    }
    L.board = { x: L.bx, y: L.by, w: L.cs * COLS, h: L.cs * ROWS };
    // HUD pills over the top of the scene: level, energy, coins, stars; second row: area pill, gift, settings
    const sx = L.scene.x + 6, sw = L.scene.w - 12, hy = L.scene.y + 6, pw = Math.min(124, (sw - 50 - 3 * 6) / 3);
    L.hud = { lvl: { x: sx, y: hy, w: 44, h: 44 } };
    ['energy', 'coins', 'stars'].forEach((n, j) => { L.hud[n] = { x: sx + 50 + j * (pw + 6), y: hy + 4, w: pw, h: 36 }; });
    L.hud.look = { x: sx + sw - 140, y: hy + 50, w: 44, h: 44 };
    L.hud.gift = { x: sx + sw - 92, y: hy + 50, w: 44, h: 44 };
    L.hud.settings = { x: sx + sw - 44, y: hy + 50, w: 44, h: 44 };
    const room = sw - 148, advW = room >= 250 ? Math.min(140, Math.max(110, Math.round(room * 0.45))) : 52;
    L.hud.area = { x: sx, y: hy + 52, w: Math.min(220, room - advW - 8), h: 40 };
    L.hud.adv = { x: sx + L.hud.area.w + 8, y: hy + 50, w: advW, h: 44 };
    // bottom tabs
    const names = ['tasks', 'album', 'week', 'pass', 'shop', 'bag'], bw = L.bar.w / names.length;
    L.btn = {}; names.forEach((n, j) => { L.btn[n] = { x: L.bar.x + j * bw, y: L.bar.y, w: bw, h: L.bar.h }; });
    dirty = true;
  }
  const inR = (p, r) => r && p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
  function cellAt(x, y) {
    const c = Math.floor((x - L.bx) / L.cs), r = Math.floor((y - L.by) / L.cs);
    return c < 0 || r < 0 || c >= COLS || r >= ROWS ? -1 : r * COLS + c;
  }
  function cellCenter(i) { return { x: L.bx + (i % COLS + 0.5) * L.cs, y: L.by + (Math.floor(i / COLS) + 0.5) * L.cs }; }
  function hudPos(name) {
    if (!onTitle && scr !== 'board') { const p = ADV.hudPos(name); if (p) return p; }
    const h = L.hud && L.hud[name];
    if (h) return { x: h.x + 18, y: h.y + h.h / 2 };
    if (name === 'xp' && L.hud) return { x: L.hud.lvl.x + 22, y: L.hud.lvl.y + 22 };
    const b = L.btn && L.btn[name]; if (b) return { x: b.x + b.w / 2, y: b.y + 24 };
    return { x: W / 2, y: H / 2 };
  }
  function hudPulse(name) { bump[name] = tn(); keep(0.4); }

  // ---- events from the game ----
  function setAnim(i, a) { if (i < 0) return; a.t0 = tn(); anim.set(i, a); keep(a.dur || 0.4); }
  function ghost(o) { o.t0 = tn() + (o.delay || 0); ghosts.push(o); keep((o.delay || 0) + o.dur); }
  function floater(x, y, s, color, icon) { floaters.push({ x, y, s, color: color || INK, icon, t0: tn() }); keep(1.1); }
  function toast(s, dur) { if (toasts.length && toasts[toasts.length - 1].s === s) { toasts[toasts.length - 1].t0 = tn(); return; } toasts.length = 0; toasts.push({ s, t0: tn(), dur: dur || 2.6 }); dirty = true; }
  function banner(o) { o.t0 = tn(); o.dur = o.dur || 1.4; if (banners.length > 2) banners.shift(); banners.push(o); keep(o.dur); }
  const nm = (k, l) => CHAINS[k].names[l - 1];

  function rewardFx(r, x, y) {
    if (r.coins) { if (!fx('coins', x, y, Math.min(10, 2 + (r.coins / 15 | 0)))) floater(x, y - 10, '+' + r.coins, '#d98a00'); snd('coins'); }
    if (r.stars) { if (!fx('stars', x, y, r.stars)) floater(x, y - 30, '+' + r.stars + ' ★', '#c08a10'); snd('stars'); }
    if (r.energy) { if (!fx('energy', x, y, Math.min(10, 2 + (r.energy / 8 | 0)))) floater(x, y + 10, '+' + r.energy, '#b07a10'); }
  }
  function describe(r) { // short reward texts for tiles and lists: [{icon|item, text}]
    const out = [];
    if (r.coins) out.push({ icon: 'coin', t: '+' + r.coins });
    if (r.energy) out.push({ icon: 'energy', t: '+' + r.energy });
    if (r.stars) out.push({ icon: 'star', t: '+' + r.stars });
    if (r.chest) out.push({ item: ['chest', Math.min(3, r.chest)], t: 'Kirst' });
    if (r.item) out.push({ item: r.item, t: CHAINS[r.item[0]].kind === 'mystery' ? 'Üllatus' : CHAINS[r.item[0]].kind === 'chest' ? 'Kirst' : nm(r.item[0], r.item[1]) });
    if (r.gen) out.push({ item: [r.gen, 1], t: 'Generaator' });
    if (r.genUp) out.push({ item: ['oven', 2], t: 'Generaator' });
    if (r.boost) { const b = typeof r.boost === 'string' ? { [r.boost]: 1 } : r.boost; for (const k in b) out.push({ boost: k, t: BOOSTERS[k].name }); }
    if (r.spins) out.push({ icon: 'wheel', t: r.spins > 1 ? r.spins + ' keerutust' : 'Keerutus' });
    if (r.hearts) out.push({ icon: 'heart', t: '+' + r.hearts });
    return out;
  }

  function ev(kind, cell, d) {
    dirty = true;
    if (kind !== 'eventPts' && kind !== 'newOrder' && kind !== 'bubbleGone' && kind !== 'genReady') idleT = tn();
    hint = null;
    const C = cell >= 0 ? cellCenter(cell) : null;
    switch (kind) {
      case 'merge': {
        setAnim(cell, { pop: 1, dur: 0.38 });
        if (!fx('merge', C.x, C.y, d.k, d.l)) { for (let j = 0; j < 6; j++) floater(C.x + Math.cos(j) * L.cs * 0.4, C.y + Math.sin(j) * L.cs * 0.4, '✦', '#ffcf4a'); }
        snd(d.max ? 'mergeMax' : 'merge', { level: d.l });
        lastMerge = { x: C.x, y: C.y, t: tn() };
        if (d.max) banner({ text: 'Tipptase!', sub: nm(d.k, d.l), x: C.x, y: C.y, color: GOLD, size: 34 });
        sel = cell; break;
      }
      case 'merge5': {
        d.cells.forEach((c, j) => { if (c === cell) return; const P = cellCenter(c); ghost({ k: d.k, l: d.l - 1, x0: P.x, y0: P.y, x1: C.x, y1: C.y, dur: 0.28, s0: 1, s1: 0.6, fade: 0 }); });
        d.outs.forEach(c => setAnim(c, { pop: 1, dur: 0.5 }));
        const O = cellCenter(d.outs[1]); fx('merge', O.x, O.y, d.k, d.l); fx('ring', C.x, C.y, L.cs * 1.6, '#8fe06a');
        banner({ text: '5 → 2!', sub: 'Topeltboonus!', x: (C.x + O.x) / 2, y: Math.min(C.y, O.y), color: '#8fe06a', size: 38 });
        snd2('merge5', 'mergeMax', { level: d.l }); break;
      }
      case 'lucky': {
        const sub = d.type === 'jump' ? 'Hüppasid taseme üle!' : d.type === 'twin' ? 'Tasuta koopia!' : 'Üllatuskast!';
        const own = !fx('lucky', C.x, C.y);
        banner({ text: own ? 'Õnn!' : '', sub, x: C.x, y: C.y + (own ? 0 : 40), color: GOLD, size: 46, rays: own ? 1 : 0, dur: 1.7 });
        if (own) { fx('confetti', 0.45, C.x, C.y); fx('sparkle', C.x, C.y, 10, L.cs * 0.6); }
        snd2('lucky', 'mergeMax', { level: d.l }); break;
      }
      case 'combo': {
        combo = { n: d.n, t0: tn() }; keep(COMBO_MS / 1000 + 0.3); if (d.n >= 3) fx('combo', C.x, C.y - L.cs * 0.3, d.n);
        snd2('combo', 'tap', { n: d.n });
        if (d.r && d.r.energy) { banner({ text: 'Kombo ×' + d.n + '!', sub: '+' + d.r.coins + ' münti, +' + d.r.energy + ' energiat', x: C.x, y: C.y - L.cs * 0.6, color: '#7fd0ff', size: 32 }); rewardFx(d.r, C.x, C.y); }
        break;
      }
      case 'discover': newq.push({ k: d.k, l: d.l }); keep(2); if (lastMerge && tn() - lastMerge.t < 0.05) fx('discover', lastMerge.x, lastMerge.y - L.cs * 0.4); break;
      case 'spawn': {
        const F = cellCenter(d.from), dur = (typeof FX !== 'undefined' && FX && FX.spawnDur) || 0.42;
        const b = itemBox(d.k, d.l), full = L.cs * FILL * clamp(1 / b.s, 1, 1.7);
        if (fx('spawn', F.x, F.y, C.x, C.y, itemImg(d.k, d.l, Math.ceil(full * DPR / 8) * 8), full)) setAnim(cell, { hide: dur, dur });
        else setAnim(cell, { fx: F.x, fy: F.y, arc: 1, pop: 1, dur: 0.38 });
        setAnim(d.from, { squash: 1, dur: 0.25 });
        if (!d.quiet) snd('spawn', { level: d.l }); break;
      }
      case 'move': case 'swap': {
        const F = dropPt || cellCenter(d.from);
        setAnim(cell, { fx: F.x, fy: F.y, dur: 0.16 });
        if (kind === 'swap') { setAnim(d.from, { fx: C.x, fy: C.y, dur: 0.22 }); snd('swap'); } else snd('drop');
        sel = cell; break;
      }
      case 'genWait': toast(nm(S.board[cell].k, S.board[cell].l) + ' puhkab veel ' + fmtTime(d.ms) + '.'); snd('deny'); sel = cell; break;
      case 'noEnergy': snd('noEnergy'); openModal({ kind: 'energy' }); break;
      case 'full': toast(d.need ? 'Kirstu jaoks on vaja ' + d.need + ' vaba ruutu.' : 'Laud on täis! Ühenda või müü midagi.'); snd('deny'); break;
      case 'collect': {
        snd('coins', { n: d.n });
        const tgt = hudPos(d.kind === 'energy' ? 'energy' : 'coins');
        ghost({ k: d.k, l: d.l, x0: C.x, y0: C.y, x1: tgt.x, y1: tgt.y, dur: 0.5, s0: 1, s1: 0.4 });
        if (!fx(d.kind === 'energy' ? 'energy' : 'coins', C.x, C.y, Math.min(10, 2 + d.n / 8 | 0))) floater(C.x, C.y, '+' + d.n, '#d98a00');
        if (sel === cell) sel = -1; break;
      }
      case 'chest': d.cells.forEach((c, j) => setAnim(c, { fx: C.x, fy: C.y, arc: 1, pop: 1, dur: 0.3 + j * 0.06 })); snd('chest'); fx('merge', C.x, C.y, 'chest', 1); sel = -1; break;
      case 'mystery': {
        setAnim(cell, { pop: 1, dur: 0.5 }); fx('merge', C.x, C.y, 'mbox', 3); fx('sparkle', C.x, C.y, 12, L.cs * 0.7);
        const o = d.out, sub = o.energy ? '+' + o.energy + ' energiat' : o.coins ? '+' + o.coins + ' münti' : CHAINS[o.item[0]].kind === 'gen' ? 'Uus generaator!' : CHAINS[o.item[0]].kind === 'chest' ? 'Kirst!' : nm(o.item[0], o.item[1]) + '!';
        banner({ text: 'Üllatus!', sub, x: C.x, y: C.y, color: '#d8a0ff', size: 36 });
        rewardFx({ energy: o.energy, coins: o.coins }, C.x, C.y);
        snd2('mystery', 'chest'); sel = o.item ? cell : -1; break;
      }
      case 'bubble': setAnim(cell, { pop: 1, dur: 0.5 }); snd('bubble'); break;
      case 'bubblePop': setAnim(cell, { pop: 1, dur: 0.34 }); snd('bubblePop'); fx('merge', C.x, C.y, d.k, d.l); break;
      case 'bubbleGone': ghost({ k: d.k, l: d.l, x0: C.x, y0: C.y, x1: C.x, y1: C.y - 20, dur: 0.5, s0: 1, s1: 1.3, fade: 1 }); if (sel === cell) sel = -1; break;
      case 'sell': ghost({ k: d.k, l: d.l, x0: C.x, y0: C.y, x1: C.x, y1: C.y, dur: 0.3, s0: 1, s1: 0.1 }); if (!fx('coins', C.x, C.y, 3)) floater(C.x, C.y, '+' + d.n, '#d98a00'); snd('sell'); sel = -1; break;
      case 'store': { const b = L.btn.bag; ghost({ k: d.k, l: d.l, x0: (dropPt || C).x, y0: (dropPt || C).y, x1: b.x + b.w / 2, y1: b.y + 24, dur: 0.3, s0: 1, s1: 0.3 }); snd('drop'); toast(nm(d.k, d.l) + ' läks kotti.'); sel = -1; break; }
      case 'take': setAnim(cell, { pop: 1, dur: 0.3 }); snd('drop'); sel = cell; break;
      case 'order': {
        const r = cardRects[d.oi], tgt = r ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : { x: W / 2, y: L.orders.y + 40 };
        d.cells.forEach((c, j) => { const P = cellCenter(c), it = d.taken[j]; ghost({ k: it.k, l: it.l, x0: P.x, y0: P.y, x1: tgt.x, y1: tgt.y, dur: 0.45, delay: j * 0.06, s0: 1, s1: 0.5 }); if (sel === c) sel = -1; });
        snd('orderDone');
        setTimeout(() => { rewardFx({ coins: d.o.coins, stars: d.o.stars }, tgt.x, tgt.y); dirty = true; }, 420);
        const V = VILLAGERS[d.o.who]; toast(WHO[d.o.who].name + ': ' + pick(V.thanks), 3.4);
        break;
      }
      case 'newOrder': d.o._t = tn(); keep(0.5); if (onBoard()) snd('order'); break;
      case 'levelUp':
        snd('levelUp'); fx('confetti', 1);
        d.cells.forEach(c => setAnim(c, { unlock: 1, dur: 0.8 }));
        openModal({ kind: 'levelup', lvl: d.lvl, cells: d.cells.length, got: d.got }, true);
        if (d.lvl === WEEK_MIN_LVL) setTimeout(() => toast('Uus: nädala sündmus! Vajuta „Nädal“.', 3.6), 1500);
        break;
      case 'task': {
        closeModal(true);
        snd('taskDone'); fx('confetti', 1); flash = { t0: tn() }; keep(0.9);
        if (d.t.choices) openModal({ kind: 'xStyle', id: d.t.id, first: true, sticky: true }, true);
        openModal({ kind: 'dialog', lines: d.t.story, title: d.t.name }, true);
        if (d.newArea) openModal({ kind: 'dialog', lines: d.newArea.intro, title: 'Uus koht: ' + d.newArea.name, onDone: () => boardMusic() }, true);
        if (d.ended) openModal({ kind: 'dialog', lines: [['mina', STORY.ending]], title: 'Lõpp ja uus algus' }, true);
        if (d.island) islandIntro(d.ended);
        break;
      }
      case 'style': snd2('styleSwap', 'tap', { style: d.key }); flash = { t0: tn() - 0.45 }; keep(0.5); break;
      case 'passStep': toast('Hooaja rada: ' + d.s + '. samm on käes!'); snd2('passStep', 'claim', { n: d.s }); bump.pass = tn(); keep(0.4); break;
      case 'passClaim': { const p = modal && modal.tap || { x: W / 2, y: H / 2 }; rewardFx(d.r, p.x, p.y); fx('sparkle', p.x, p.y, 10, 40); snd2('passStep', 'claim', { n: d.s }); break; }
      case 'passLate': toast('Eelmise kuu raja auhinnad on nüüd sinu!', 3.4); rewardFx(d.r, W / 2, H * 0.45); break;
      case 'passNew': if (S.tut >= 5) toast('Uus hooaja rada algas! Mängi ja kogu auhindu.', 3.4); break;
      case 'weekCur': {
        if (cell >= 0 && onBoard()) floater(C.x + L.cs * 0.25, C.y - L.cs * 0.35, '+' + d.n, PINK, 'cur_' + WEEK.info().key);
        if (cell >= 0) snd2('eventCur', 'coins', { n: d.n, week: WEEK.info().key });
        if (d.ready && onBoard()) { toast(WEEK.info().E.name + ': auhind ootab! Vajuta „Nädal“.'); bump.week = tn(); }
        break;
      }
      case 'weekClaim': { const p = modal && modal.tap || { x: W / 2, y: H / 2 }; fx('confetti', 0.4, p.x, p.y); rewardFx(d.r, p.x, p.y); snd2('claim', 'daily'); break; }
      case 'weekStart': if (onBoard() && WEEK.open()) toast(d.e.E.name + ' algas! Kogu ' + d.e.E.cur[0] + ' ja võida auhindu.' + (d.coins ? ' Eelmise nädala asjad andsid ' + d.coins + ' münti.' : ''), 3.6); break;
      case 'cashEvent': { const b = L.btn.week; ghost({ k: d.k, l: d.l, x0: C.x, y0: C.y, x1: b.x + b.w / 2, y1: b.y + 24, dur: 0.5, s0: 1, s1: 0.3 }); fx('sparkle', C.x, C.y, 12, L.cs * 0.6); snd2('claim', 'coins'); if (sel === cell) sel = -1; break; }
      case 'lookNew': {
        const pets = d.list.filter(x => x[0] === 'pet'), rest = d.list.filter(x => x[0] !== 'pet');
        if (pets.length) { toast('Uus sõber: ' + pets.map(x => LOOK.name(x[0], x[1])).join(', ') + '! Vaata garderoobi.', 3.6); snd2('pet', 'discover', { kind: pets[0][1] }); }
        else if (rest.length) { toast('Garderoobis on uus asi: ' + rest.map(x => LOOK.name(x[0], x[1])).join(', ') + '!', 3.4); snd2('wardrobe', 'discover'); }
        bump.look = tn(); keep(0.4); break;
      }
      case 'wear': snd2('wardrobe', 'tap'); break;
      case 'pet': snd2('pet', 'tap', { kind: d.k }); break;
      case 'reward': if (!d.silent) rewardFx(d, W / 2, H * 0.45); break;
      case 'gift': if (cell >= 0 && onBoard()) { setAnim(cell, { pop: 1, dur: 0.5 }); if (!d.silent) snd('drop'); } if (d.daily) { snd2('calendar', 'daily'); const p = modal && modal.tap || { x: W / 2, y: H * 0.4 }; rewardFx(Object.assign({}, d.g.r, d.g.m30 ? { coins: (d.g.r.coins || 0) + (d.g.m30.coins || 0) } : {}), p.x, p.y); fx('confetti', 0.5, p.x, p.y); } break;
      case 'toBag': toast('Laud oli täis, kingitus läks kotti.'); break;
      case 'deny':
        snd('deny');
        if (d.need === 'coins') toast('Münte jääb puudu.');
        else if (d.need === 'stars') toast('Tähti on vaja rohkem. Täida tellimusi!');
        else if (d.order !== undefined) toast('Kõik asjad pole veel laual.');
        else toast('Seda ei saa müüa.');
        break;
      case 'bagFull': toast('Kott on täis. Poest saab kotti suuremaks osta.'); snd('deny'); break;
      case 'rush': snd('coins'); setAnim(cell, { pop: 1, dur: 0.3 }); break;
      case 'dailyReady': toast('Päevaülesanne tehtud! Auhind ootab kingituse all.'); snd('daily'); break;
      case 'dailyClaim': snd('coins'); break;
      case 'buy': snd('coins'); toast('Ostetud: ' + d.x.name + '!'); break;
      case 'tut': if (d.to === 5) toast(STORY.tutDone, 3.5); break;
      case 'albumClaim': { const p = modal && modal.tap || { x: W / 2, y: H / 2 }; rewardFx(d.r, p.x, p.y); snd2('claim', 'coins'); break; }
      case 'albumChain': { fx('confetti', 0.8); banner({ text: 'Kogu ahel!', sub: CHAINS[d.k].name, x: W / 2, y: H * 0.4, color: GOLD, size: 40, rays: 1, dur: 1.8 }); rewardFx(d.r, W / 2, H * 0.45); snd2('claim', 'taskDone'); break; }
      case 'freeEnergy': rewardFx({ energy: d.n }, W / 2, H * 0.45); snd('daily'); break;
      case 'piggy': case 'wheel': ADV.gameEv(kind, d); break;
    }
  }

  // ---- modals ----
  function openModal(m, queue) {
    m.t0 = tn(); m.i = 0;
    if (modal) { if (queue) mq.push(m); return; }
    modal = m; if (m.kind === 'dialog') storyMusic(); else if (m.kind !== 'xPhoto') snd('open'); if (m.onShow) m.onShow(); dirty = true;
  }
  // Board music: the story area, or on the island tour the stand-in area plus the island theme.
  function boardMusic() {
    if (S.ended) { const isl = TOUR.cur(); music('board', { area: Math.max(0, AREAS.findIndex(a => a.key === isl.area)), tour: isl.theme }); }
    else music('board', { area: Math.min(S.area, AREAS.length - 1) });
  }
  function storyMusic() { if (modal && modal.kind === 'dialog' && modal.title) music('story'); }
  function closeModal(silent) {
    const m = modal; modal = null; mhits = [];
    if (m && m.onDone) m.onDone();
    if (!silent && m && m.kind !== 'dialog') snd('close');
    if (mq.length && !modal) { modal = mq.shift(); modal.t0 = tn(); modal.i = 0; if (modal.kind === 'dialog') storyMusic(); if (modal.onShow) modal.onShow(); }
    if (m && m.kind === 'dialog' && m.title && !(modal && modal.kind === 'dialog') && onBoard()) boardMusic();
    idleT = tn(); dirty = true;
  }
  const modalActive = () => !!modal || onTitle;
  // The intro of a tour island, shown once (old saves that already finished the story see it on their next visit).
  function islandIntro(first) {
    const isl = TOUR.cur(), key = 't' + isl.i; if (S.areaSeen[key]) return; S.areaSeen[key] = 1; saveSoon();
    openModal({ kind: 'dialog', lines: isl.intro, title: (first || isl.i === 0 ? 'Saareringreis: ' : 'Uus saar: ') + isl.name, onShow: () => snd2('islandNew', 'taskDone'), onDone: () => boardMusic() }, true);
  }
  // Close the open modal (quietly) and open another in its place.
  function closeThen(m) { closeModal(true); openModal(m); }

  // ---- input ----
  function pos(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function unlockAudio() {
    if (audioUnlocked) return; audioUnlocked = true;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    const a = au(); try { if (a && a.unlock) a.unlock(); if (a && a.setVolume) { a.setVolume('music', S.set.music); a.setVolume('sfx', S.set.sfx); } if (a && a.setMuted) a.setMuted(!!S.set.muted); } catch (e) {}
  }
  function hitAt(list, p) { for (let j = list.length - 1; j >= 0; j--) { const h = list[j]; if (inR(p, h)) return h; } return null; }
  const pressKey = h => h ? { x: h.bx !== undefined ? h.bx : h.x, y: h.by !== undefined ? h.by : h.y } : null;

  cv.addEventListener('pointerdown', e => {
    e.preventDefault(); unlockAudio(); idleT = tn(); hint = null;
    if (ptr) return;
    const p = pos(e);
    ptr = { id: e.pointerId, x0: p.x, y0: p.y, x: p.x, y: p.y, t0: performance.now(), moved: false, touch: e.pointerType !== 'mouse' };
    try { cv.setPointerCapture(e.pointerId); } catch (er) {}
    if (modalActive()) { ptr.zone = 'modal'; const h = hitAt(mhits, p); if (h && h.fn) { pressed = pressKey(h); dirty = true; } if (modal) modal.tap = p; return; }
    if (scr !== 'board') { ptr.zone = 'adv'; const h = hitAt(hits, p); if (h && h.fn) { pressed = pressKey(h); dirty = true; } else ADV.down(p, ptr); return; }
    if (newq.length && newq[0].rect && inR(p, newq[0].rect)) { ptr.zone = 'popup'; return; }
    const c = cellAt(p.x, p.y);
    if (c >= 0 && S.board[c] && Game.isOpen(c)) {
      ptr.zone = 'cell'; ptr.cell = c;
      ptr.lp = setTimeout(() => { if (ptr && !ptr.moved && ptr.zone === 'cell' && !drag) { ptr.zone = 'done'; const it = S.board[c]; if (it) { sel = c; openChain(it.k, it.l); } } }, 450);
    } else if (inR(p, L.orders) && !hitAt(hits.filter(h => h.hud), p)) { ptr.zone = 'orders'; ptr.s0 = ordScroll; const h = hitAt(hits, p); if (h && h.fn) { pressed = pressKey(h); dirty = true; } }
    else { ptr.zone = 'ui'; const h = hitAt(hits, p); if (h && h.fn) { pressed = pressKey(h); dirty = true; } }
  });
  cv.addEventListener('pointermove', e => {
    if (!ptr || e.pointerId !== ptr.id) return;
    const p = pos(e); ptr.x = p.x; ptr.y = p.y;
    if (!ptr.moved && Math.hypot(p.x - ptr.x0, p.y - ptr.y0) > (ptr.touch ? 9 : 5)) { ptr.moved = true; clearTimeout(ptr.lp); if (pressed && ptr.zone !== 'ui' && ptr.zone !== 'modal') pressed = null; }
    if (ptr.zone === 'cell' && ptr.moved && !drag) {
      const it = S.board[ptr.cell];
      if (it && !it.b) { drag = { from: ptr.cell, it, x: p.x, y: p.y, lift: ptr.touch ? L.cs * 0.42 : 0, t0: tn(), tc: -2, grp: null }; sel = ptr.cell; snd('pick'); }
      else ptr.zone = 'done';
    }
    if (drag) { drag.x = p.x; drag.y = p.y; dirty = true; }
    if (ptr.zone === 'adv' && !pressed) { ADV.move(p, ptr); dirty = true; }
    if (ptr.zone === 'orders' && ptr.moved) { ordScroll = clamp(ptr.s0 - (p.x - ptr.x0), 0, ordMax); dirty = true; }
  });
  function dragTarget() {
    if (!drag) return { cell: -1 };
    const x = drag.x, y = drag.y - drag.lift * 0.75;
    if (inR({ x: drag.x, y: drag.y }, L.btn.bag)) return { cell: -1, bag: true };
    const c = cellAt(x, y), cell = c >= 0 && Game.isOpen(c) ? c : -1;
    if (cell !== drag.tc) { // the merge-5 group under the finger
      drag.tc = cell; drag.grp = null;
      if (cell >= 0 && cell !== drag.from && Game.canMerge(drag.it, S.board[cell])) { const gr = Game.group(cell, drag.from); if (gr.length >= 4) drag.grp = gr.slice(0, 4); }
    }
    return { cell, grp: drag.grp };
  }
  function endDrag(cancel) {
    const d = drag; if (!d) return;
    const tg = cancel ? { cell: -1 } : dragTarget();
    drag = null; dirty = true;
    dropPt = { x: d.x, y: d.y - d.lift };
    let ok = false;
    if (tg.bag) ok = Game.store(d.from);
    else if (tg.cell >= 0 && tg.cell !== d.from) ok = Game.drop(d.from, tg.cell);
    if (!ok && S.board[d.from] === d.it) { setAnim(d.from, { fx: dropPt.x, fy: dropPt.y, dur: 0.2 }); if (tg.cell !== d.from && !tg.bag) snd('drop'); }
    dropPt = null;
  }
  function endPtr(e, cancel) {
    if (!ptr || e.pointerId !== ptr.id) return;
    clearTimeout(ptr.lp);
    const p = ptr, wasPressed = pressed; ptr = null; pressed = null; dirty = true;
    if (wasPressed) { spring = { x: wasPressed.x, y: wasPressed.y, t0: tn() }; keep(0.5); }
    if (drag) { endDrag(cancel); return; }
    if (p.zone === 'adv') { if (!wasPressed && ADV.up({ x: p.x, y: p.y }, p, cancel)) return; if (cancel || p.moved) return; const h = hitAt(hits, { x: p.x, y: p.y }); if (h && h.fn) h.fn(); return; }
    if (cancel || p.moved && p.zone !== 'modal' || p.zone === 'done') return;
    const q = { x: p.x, y: p.y };
    if (p.zone === 'modal') { if (p.moved && Math.hypot(p.x - p.x0, p.y - p.y0) > 30) return; return modalTap(q); }
    if (p.zone === 'popup') { const it = newq[0]; if (it) { newq.shift(); openAlbum(it.k); } return; }
    if (p.zone === 'cell') return tapCell(p.cell);
    const h = hitAt(hits, q); if (h && h.fn) { h.fn(); return; }
    if (wasPressed) return;
    const c = cellAt(q.x, q.y); if (c >= 0 && !S.board[c]) { if (!Game.isOpen(c)) { toast('See ruut avaneb tasemel ' + Game.unlockLevel(c) + '.'); snd('deny'); } sel = -1; }
  }
  cv.addEventListener('pointerup', e => endPtr(e, false));
  cv.addEventListener('pointercancel', e => endPtr(e, true));
  cv.addEventListener('contextmenu', e => e.preventDefault());

  function tapCell(c) {
    const it = S.board[c]; if (!it) return;
    const kind = CHAINS[it.k].kind;
    if (it.b) { sel = c; snd('tap'); return; }
    if (kind === 'item' && CHAINS[it.k].ev && it.l >= Game.maxL(it.k)) { sel = c; Game.tapItem(c); return; }
    if (kind === 'item') { if (sel === c) openChain(it.k, it.l); else { sel = c; snd('tap'); setAnim(c, { squash: 1, dur: 0.22 }); } return; }
    sel = c;
    Game.tapItem(c);
  }
  function modalTap(q) {
    if (onTitle) { const h = hitAt(mhits, q); if (h && h.fn) h.fn(); else start(); return; }
    const m = modal; if (!m) return;
    const h = hitAt(mhits, q);
    if (h) { if (h.fn) h.fn(); return; }
    if (m.kind === 'dialog') return dialogNext();
    if (m.panel && !inR(q, m.panel) && m.kind !== 'levelup' && !m.sticky) closeModal();
  }
  function dialogNext() {
    const m = modal, line = m.lines[m.i], shown = (tn() - m.t0) * 48;
    if (shown < line[1].length) { m.t0 = -1e9; dirty = true; return; }
    m.i++; m.t0 = tn(); m.said = 0;
    if (m.i >= m.lines.length) closeModal(true);
    dirty = true;
  }
  function openChain(k, l) { openModal({ kind: 'chain', k, l }); }
  function openAlbum(k) {
    let page = ALBUM_CHAINS.indexOf(k);
    if (page < 0) { page = ALBUM_CHAINS.findIndex(c => Game.albumPending(c) > 0 || (Game.chainFull(c) && !S.albumDone[c])); if (page < 0) page = Math.max(0, ALBUM_CHAINS.findIndex(c => S.disc[c])); }
    openModal({ kind: 'album', page });
  }

  // ---- screens: start ----
  function start() {
    if (!onTitle) return;
    onTitle = false; S.title = false; dirty = true; snd('tap'); idleT = tn(); scr = 'board';
    boardMusic();
    if (S.tut === 0) {
      openModal({ kind: 'dialog', lines: AREAS[0].intro, title: 'Kiri vanaemalt', onDone: () => { S.tut = 1; S.nextOrderAt = 0; saveSoon(); } });
    } else if (S.tut >= 5) {
      Game.ensureDaily(); if (!S.daily.gift) openModal({ kind: 'daily' });
      if (S.ended) islandIntro(false);
    }
  }

  // Seiklus (the level map) from the title or the café; back to the café from the map.
  function startAdv() {
    onTitle = false; S.title = false; dirty = true; snd('tap'); idleT = tn();
    goScreen('map');
  }
  function goScreen(s) {
    const was = scr; scr = s; sel = -1; drag = null; hint = null; dirty = true; idleT = tn();
    if (s === 'board') { boardMusic(); if (S.ended && S.tut >= 5) islandIntro(false); if (was !== 'board' && S.tut === 0) openModal({ kind: 'dialog', lines: AREAS[0].intro, title: 'Kiri vanaemalt', onDone: () => { S.tut = 1; S.nextOrderAt = 0; saveSoon(); } }); }
    ADV.entered(s, was);
  }

  // ---- drawing: HUD (over the top of the scene) ----
  function pill(r, icon, value, plus, name, fn) {
    const b = bump[name] ? clamp(1 - (tn() - bump[name]) / 0.35, 0, 1) : 0, s = 1 + 0.25 * Math.sin(b * Math.PI);
    g.fillStyle = DARK; rr(r.x + 8, r.y, r.w - 8, r.h, r.h / 2); g.fill();
    g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.25)'; g.stroke();
    if (r.w < 104) plus = false; // narrow phones: the whole pill is the button
    const is = 34 * s; drawIcon(icon, r.x + 4 + (34 - is) / 2, r.y + r.h / 2 - is / 2, is);
    const tw = r.w - 44 - (plus ? 26 : 4);
    text(value, r.x + 40 + tw / 2, r.y + r.h / 2 + 1, 19, '#fff', 'center', 900, tw);
    if (plus) { const px = r.x + r.w - 15, py = r.y + r.h / 2; g.fillStyle = MINT; g.beginPath(); g.arc(px, py, 12, 0, 7); g.fill(); g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(px - 5, py); g.lineTo(px + 5, py); g.moveTo(px, py - 5); g.lineTo(px, py + 5); g.stroke(); }
    hits.push({ x: r.x, y: r.y - 6, w: r.w, h: r.h + 12, hud: 1, fn: () => { snd('tap'); fn(); } });
  }
  function tickDisp(dt) {
    const step = (k, v) => { if (disp[k] === null || Math.abs(v - disp[k]) > 5000) { disp[k] = v; return; } const d = v - disp[k]; if (d === 0) return; disp[k] += Math.sign(d) * Math.max(1, Math.ceil(Math.abs(d) * Math.min(1, dt * 7))); if (Math.sign(v - disp[k]) !== Math.sign(d)) disp[k] = v; dirty = true; };
    step('en', S.en); step('coins', S.coins); step('stars', S.stars);
  }
  function drawHud(t) {
    const H2 = L.hud;
    // level badge with XP ring
    const lv = H2.lvl, bx = lv.x + 22, by = lv.y + 22, need = xpNeed(S.lvl), k = clamp(S.xp / need, 0, 1);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(bx, by, 22, 0, 7); g.fill();
    g.lineWidth = 5; g.strokeStyle = '#e6e4f6'; g.beginPath(); g.arc(bx, by, 18.5, 0, 7); g.stroke();
    g.strokeStyle = GRAPE; g.beginPath(); g.arc(bx, by, 18.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); g.stroke();
    text(String(S.lvl), bx, by + 1, 19, INK, 'center', 900);
    hits.push({ x: lv.x - 2, y: lv.y - 2, w: 48, h: 48, hud: 1, fn: () => { snd('tap'); toast('Tase ' + S.lvl + ': ' + S.xp + '/' + need + ' XP. Järgmisel tasemel: energia täis, mündid ja kirst!'); } });
    pill(H2.energy, 'energy', fmtNum(disp.en), true, 'energy', () => openModal({ kind: 'energy' }));
    pill(H2.coins, 'coin', fmtNum(disp.coins), true, 'coins', () => openModal({ kind: 'shop' }));
    pill(H2.stars, 'star', fmtNum(disp.stars), false, 'stars', () => openModal({ kind: 'tasks' }));
    // area pill with completion bar
    const area = Game.curArea(), ts = area.tasks, done = ts.filter(x => S.done[x.id]).length, a = H2.area;
    g.fillStyle = 'rgba(255,255,255,0.92)'; rr(a.x, a.y, a.w, a.h, 14); g.fill(); g.lineWidth = 2; g.strokeStyle = EDGE; g.stroke();
    text(area.name, a.x + 10, a.y + 14, 15, INK, 'left', 900, a.w - 60);
    text(done + '/' + ts.length, a.x + a.w - 10, a.y + 14, 15, INK2, 'right', 800);
    bar(a.x + 10, a.y + 27, a.w - 20, 7, done / ts.length, PINK);
    hits.push({ x: a.x, y: a.y, w: a.w, h: Math.max(48, a.h), hud: 1, fn: () => { snd('tap'); openModal({ kind: 'tasks' }); } });
    // gift and settings
    const giftOn = !S.daily.gift || S.daily.tasks.some(x => x.n >= x.goal && !x.claimed) || (!S.daily.bonus && S.daily.tasks.length && S.daily.tasks.every(x => x.claimed));
    const gr = H2.gift, st = H2.settings, wig = giftOn && S.tut >= 5 ? Math.sin(t * 9) * 0.15 * (Math.sin(t * 1.7) > 0.6 ? 1 : 0) : 0;
    for (const r of [gr, st]) { g.fillStyle = 'rgba(255,255,255,0.92)'; g.beginPath(); g.arc(r.x + 22, r.y + 22, 21, 0, 7); g.fill(); }
    g.save(); g.translate(gr.x + 22, gr.y + 22); g.rotate(wig); drawIcon('gift', -16, -16, 32); g.restore();
    drawIcon('settings', st.x + 7, st.y + 7, 30);
    if (giftOn && S.tut >= 5) dot(gr.x + 38, gr.y + 6);
    hits.push({ x: gr.x - 2, y: gr.y - 2, w: 48, h: 48, hud: 1, fn: () => openModal({ kind: 'daily' }) });
    const lk = H2.look, lb = bump.look ? clamp(1 - (tn() - bump.look) / 0.35, 0, 1) : 0, ls = 1 + 0.25 * Math.sin(lb * Math.PI);
    g.fillStyle = 'rgba(255,255,255,0.92)'; g.beginPath(); g.arc(lk.x + 22, lk.y + 22, 21, 0, 7); g.fill();
    drawIcon('wardrobe', lk.x + 22 - 16 * ls, lk.y + 22 - 16 * ls, 32 * ls);
    if (LOOK.unseen() > 0) dot(lk.x + 38, lk.y + 6);
    hits.push({ x: lk.x - 2, y: lk.y - 2, w: 48, h: 48, hud: 1, fn: () => { snd('tap'); openModal({ kind: 'xLook' }); } });
    const av = H2.adv; button(av.x, av.y, av.w, av.h, av.w >= 100 ? 'Seiklus' : '', () => goScreen('map'), { style: 'buttonPink', icon: 'map', isz: 28, size: 17 });
    hits[hits.length - 1].hud = 1;
    if (ADV.attention()) dot(av.x + av.w - 4, av.y + 4);
    hits.push({ x: st.x - 2, y: st.y - 2, w: 48, h: 48, hud: 1, fn: () => openModal({ kind: 'settings' }) });
  }
  function dot(x, y, n) {
    const r = n ? 12 : 7; g.fillStyle = '#ff3b4a'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#fff'; g.stroke();
    if (n) text(n > 9 ? '9+' : String(n), x, y + 1, 15, '#fff', 'center', 900);
  }

  // ---- drawing: scene strip ----
  // The current area's illustration in any rect (the scene strip and the photo postcard). Tour islands use
  // Ash's ART.tourScene, or a story area's scene until it exists. opts.style carries the design choices.
  function paintScene(c, x, y, w, h, t) {
    const area = Game.curArea(), sty = { style: S.style };
    const n = Object.keys(S.done).length; if (n !== progressN) { progressN = n; progressSet = new Set(Object.keys(S.done)); }
    const gg = g; let drawn = false;
    try {
      if (S.ended && artOn('tourScene')) { ART.tourScene(c, area, progressSet, x, y, w, h, t, sty); drawn = true; }
      else if (S.ended && artOn('scene')) { const fb = TOUR.fallbackProgress(area, S.done); ART.scene(c, fb.area, fb.set, x, y, w, h, t, sty); drawn = true; }
      else if (artOn('scene')) { ART.scene(c, area.key, progressSet, x, y, w, h, t, sty); drawn = true; }
    } catch (e) {}
    if (!drawn && c === gg) phScene(area, { x, y, w, h }, t);
    return drawn;
  }
  function drawScene(t) {
    const r = L.scene;
    g.save(); rr(r.x, r.y, r.w, r.h, 20); g.clip();
    paintScene(g, r.x, r.y, r.w, r.h, t);
    if (flash) { const k = (tn() - flash.t0) / 0.9; if (k < 1) { g.fillStyle = 'rgba(255,240,200,' + (0.6 * (1 - k)) + ')'; g.fillRect(r.x, r.y, r.w, r.h); } else flash = null; }
    // soft fade at the bottom where the order cards sit
    const fg = g.createLinearGradient(0, r.y + r.h - 40, 0, r.y + r.h); fg.addColorStop(0, 'rgba(255,255,255,0)'); fg.addColorStop(1, 'rgba(255,255,255,0.55)'); g.fillStyle = fg; g.fillRect(r.x, r.y + r.h - 40, r.w, 40);
    g.restore();
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.9)'; rr(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3, 20); g.stroke();
    hits.push({ x: r.x, y: r.y + 96, w: r.w, h: Math.max(0, r.h - 96 - 22), fn: () => openModal({ kind: 'tasks' }) });
    drawHud(t);
  }
  const SKY = { bakery: ['#bfe3f2', '#fbe9d0'], garden: ['#cdeccf', '#f5f0d0'], harbour: ['#a9d6ef', '#e6f2f2'], windmill: ['#f7d9b8', '#fbeede'], lighthouse: ['#9db8e0', '#e8dff0'], secret: ['#d9c2e8', '#fbe9d0'] };
  function phScene(area, r, t) {
    const sky = SKY[area.key] || SKY.bakery, gr = g.createLinearGradient(0, r.y, 0, r.y + r.h);
    gr.addColorStop(0, sky[0]); gr.addColorStop(1, sky[1]); g.fillStyle = gr; g.fillRect(r.x, r.y, r.w, r.h);
    const sea = r.y + r.h * 0.62;
    g.fillStyle = '#7fb8d8'; g.fillRect(r.x, sea, r.w, r.h);
    const ts = area.tasks, done = ts.filter(x => S.done[x.id]).length, k = done / ts.length;
    const hx = r.x + r.w * 0.5, hw = Math.min(r.w * 0.28, 120), hh = Math.min(r.h * 0.38, 70), hy = sea - hh + 4;
    g.fillStyle = k > 0.3 ? '#e8c79a' : '#b9a58a'; g.fillRect(hx - hw / 2, hy, hw, hh);
    g.fillStyle = k > 0.6 ? '#c0503c' : '#7a6a5a'; g.beginPath(); g.moveTo(hx - hw / 2 - 8, hy); g.lineTo(hx, hy - hh * 0.6); g.lineTo(hx + hw / 2 + 8, hy); g.fill();
  }

  // ---- drawing: orders ----
  function cardW(o) { const sl = L.slot; return Math.max(16 + o.items.length * sl + (o.items.length - 1) * 6, 140); }
  function drawOrders(t) {
    const r = L.orders, sl = L.slot; cardRects = [];
    let total = 0; for (const o of S.orders) total += cardW(o) + 8;
    ordMax = Math.max(0, total - 8 - (r.w - 12)); ordScroll = clamp(ordScroll, 0, ordMax);
    g.save(); g.beginPath(); g.rect(r.x, r.y - 6, r.w, r.h + 12); g.clip();
    let x = r.x + 6 - ordScroll + (total - 8 < r.w - 12 ? (r.w - 12 - (total - 8)) / 2 : 0);
    if (!S.orders.length && S.tut > 0) { g.fillStyle = 'rgba(255,255,255,0.88)'; rr(r.x + 40, r.y + r.h / 2 - 22, r.w - 80, 44, 22); g.fill(); text('Külarahvas mõtleb, mida tellida…', r.x + r.w / 2, r.y + r.h / 2, 15, INK2, 'center', 700, r.w - 100); }
    S.orders.forEach((o, oi) => {
      const w = cardW(o), h = r.h - 6, st = Game.orderStatus(o);
      const ap = o._t ? clamp((tn() - o._t) / 0.45, 0, 1) : 1, yy = r.y + 3 + (1 - ease.outBack(ap)) * 40;
      g.globalAlpha = ap;
      const ps = pressScale(x, yy), pulse = (st.ready ? 1 + Math.sin(t * 6) * 0.025 : 1) * ps;
      g.save(); g.translate(x + w / 2, yy + h / 2); g.scale(pulse, pulse); g.translate(-x - w / 2, -yy - h / 2);
      // modern card: white with a soft shadow; green glow when ready
      g.fillStyle = SHADOW; rr(x, yy + 4, w, h, 18); g.fill();
      if (st.ready) { const gg = g.createLinearGradient(0, yy, 0, yy + h); gg.addColorStop(0, '#6ff0b8'); gg.addColorStop(1, '#19c37f'); g.fillStyle = gg; }
      else g.fillStyle = CARD;
      rr(x, yy, w, h, 18); g.fill(); g.lineWidth = 2.5; g.strokeStyle = st.ready ? '#ffffff' : EDGE; g.stroke();
      g.save(); rr(x, yy, w, h, 18); g.clip(); drawPortrait(o.who, x + 6, yy + 5, 38); g.restore();
      if (st.ready) {
        const bw = w - 54, bx = x + 48, byy = yy + 7;
        g.fillStyle = '#fff'; rr(bx, byy, bw, 32, 16); g.fill();
        text('Anna!', bx + bw / 2, byy + 17, 18, '#0b8a58', 'center', 900, bw - 8);
      } else {
        let rx = x + w - 8; g.font = font(16, 900);
        const rs = String(o.coins); text(rs, rx, yy + 23, 16, INK, 'right', 900); rx -= g.measureText(rs).width + 22; drawIcon('coin', rx, yy + 12, 21);
        if (o.stars) { rx -= 4; const ss = String(o.stars); g.font = font(16, 900); text(ss, rx, yy + 23, 16, INK, 'right', 900); rx -= g.measureText(ss).width + 22; drawIcon('star', rx, yy + 11, 22); }
      }
      o.items.forEach(([k, l], j) => {
        const ix = x + 8 + j * (sl + 6), iy = yy + h - sl - 6;
        g.fillStyle = st.ready ? 'rgba(255,255,255,0.55)' : st.have[j] ? 'rgba(47,213,154,0.22)' : SOFT; rr(ix, iy, sl, sl, 12); g.fill();
        drawItem(k, l, ix + sl / 2, iy + sl / 2, sl * 0.9);
        if (st.have[j]) drawIcon('check', ix + sl - 20, iy - 4, 24);
      });
      g.restore(); g.globalAlpha = 1;
      cardRects[oi] = { x, y: yy, w, h };
      hits.push({ x, y: yy, w, h, bx: x, by: yy, fn: () => {
        if (st.ready) Game.fulfill(oi);
        else { snd('tap'); toast(WHO[o.who].name + ' tahab: ' + o.items.map(([k, l]) => nm(k, l)).join(', ') + '.'); }
      } });
      x += w + 8;
    });
    g.restore();
    if (ordMax > 0) { g.fillStyle = 'rgba(110,100,200,0.3)'; const bw = r.w * (r.w / (r.w + ordMax)); rr(r.x + 6 + (r.w - 12 - bw) * (ordScroll / ordMax), r.y + r.h + 1, bw, 4, 2); g.fill(); }
  }

  // ---- hints: after 4 s idle, wiggle a pair that can merge (or a generator to tap) ----
  function findHint() {
    const need = Game.orderNeeds(), seen = {}; let best = null, bestScore = -1;
    for (let i = 0; i < NCELL; i++) {
      const it = S.board[i]; if (!it || it.b || !Game.isOpen(i)) continue;
      const key = it.k + ':' + it.l;
      if (seen[key] !== undefined && Game.canMerge(S.board[seen[key]], it)) {
        const sc = (need.has(it.k + ':' + (it.l + 1)) ? 100 : 0) + it.l + (CHAINS[it.k].kind === 'gen' ? 5 : 0);
        if (sc > bestScore) { bestScore = sc; best = [seen[key], i]; }
      } else if (seen[key] === undefined) seen[key] = i;
    }
    if (best) return best;
    if (S.en > 0) for (let i = 0; i < NCELL; i++) { const it = S.board[i]; if (it && !it.b && CHAINS[it.k].kind === 'gen' && it.ch > 0) return [i]; }
    return null;
  }
  function hintActive() { return !modal && onBoard() && !drag && !ptr && S.tut >= 5 && tn() - idleT > 4; }

  // ---- drawing: board ----
  function itemDrawState(i, t) {
    const a = anim.get(i), C = cellCenter(i); let x = C.x, y = C.y, s = 1, hide = false, sq = 0;
    if (a) {
      const k = clamp((t - a.t0) / a.dur, 0, 1);
      if (a.hide) hide = k < 1;
      if (a.fx !== undefined) { const e = ease.outCubic(k); x = lerp(a.fx, C.x, e); y = lerp(a.fy, C.y, e); if (a.arc) y -= Math.sin(k * Math.PI) * L.cs * 0.6; }
      if (a.pop) s = k < 1 ? 0.5 + 0.5 * ease.outElastic(k) : 1;
      if (a.squash) sq = Math.sin(k * Math.PI) * 0.14;
      if (k >= 1 && !a.unlock) anim.delete(i);
    }
    return { x, y, s, hide, sq };
  }
  function drawCell(x, y, s, state) {
    if (artOn('cell')) { try { ART.cell(g, x, y, s, state); return; } catch (e) {} }
    const p = 2;
    if (state === 'locked') { g.fillStyle = 'rgba(110,80,50,0.28)'; rr(x + p, y + p, s - p * 2, s - p * 2, 10); g.fill(); return; }
    g.fillStyle = state === 'target' ? 'rgba(255,214,110,0.9)' : state === 'hint' ? 'rgba(190,240,160,0.85)' : 'rgba(255,248,232,0.88)';
    rr(x + p, y + p, s - p * 2, s - p * 2, 10); g.fill();
  }
  function drawBoard(t) {
    const cs = L.cs, b = L.board;
    if (!artOn('cell')) panel(b.x - 4, b.y - 4, b.w + 8, b.h + 8, 'wood');
    const tg = drag ? dragTarget() : null, dk = drag ? drag.it : null, grp = tg && tg.grp ? new Set(tg.grp) : null;
    for (let i = 0; i < NCELL; i++) {
      const c = i % COLS, r = (i / COLS) | 0, x = L.bx + c * cs, y = L.by + r * cs, it = S.board[i];
      let state = Game.isOpen(i) ? 'empty' : 'locked';
      if (grp && grp.has(i)) state = 'target';
      else if (dk && i !== drag.from && it && Game.canMerge(dk, it)) state = tg && tg.cell === i ? 'target' : 'hint';
      else if (tg && tg.cell === i && i !== drag.from) state = 'hint';
      drawCell(x, y, cs, state);
      if (state === 'locked' && !anim.get(i)) {
        if (!artOn('cell')) { g.globalAlpha = 0.55; drawIcon('lock', x + cs * 0.3, y + cs * 0.16, cs * 0.4); g.globalAlpha = 1; }
        text(String(Game.unlockLevel(i)), x + cs / 2, y + cs * 0.76, Math.max(MINF, Math.round(cs * 0.27)), INK2, 'center', 900);
      }
    }
    // unlock shimmer
    for (const [i, a] of anim) if (a.unlock) { const k = clamp((t - a.t0) / a.dur, 0, 1), C = cellCenter(i); g.fillStyle = 'rgba(255,240,170,' + (1 - k) * 0.8 + ')'; g.beginPath(); g.arc(C.x, C.y, cs * 0.5 * (0.5 + k), 0, 7); g.fill(); if (k >= 1) anim.delete(i); }
    // selection: soft glowing frame
    if (sel >= 0 && S.board[sel] && !(drag && drag.from === sel)) {
      const C = cellCenter(sel), q = 1 + Math.sin(t * 5) * 0.03, h = cs * 0.5 * q;
      g.lineWidth = 6; g.strokeStyle = 'rgba(255,180,60,0.35)'; rr(C.x - h, C.y - h, h * 2, h * 2, 14); g.stroke();
      g.lineWidth = 3; g.strokeStyle = '#ffb03a'; rr(C.x - h + 2, C.y - h + 2, h * 2 - 4, h * 2 - 4, 12); g.stroke();
    }
    // hint wiggle
    let hset = null, hw = 0;
    if (hintActive()) {
      if (!hint || tn() - hintAt > 3) { hint = findHint(); hintAt = tn(); if (hint) for (const i of hint) { const C = cellCenter(i); fx('hint', C.x, C.y); } }
      if (hint) { hset = new Set(hint); const u = ((tn() - idleT) % 2.4) / 2.4; hw = u < 0.35 ? Math.sin(u / 0.35 * Math.PI * 4) * 0.16 * Math.sin(u / 0.35 * Math.PI) : 0; }
    }
    needSet = Game.orderNeeds();
    const isz = cs * FILL;
    for (let i = 0; i < NCELL; i++) {
      const it = S.board[i]; if (!it || (drag && drag.from === i)) continue;
      const d = itemDrawState(i, t); if (d.hide) continue;
      const kind = CHAINS[it.k].kind;
      if (it.b) {
        const left = (it.b - now()) / 60000, wob = 1 + Math.sin(t * 3 + i) * 0.03;
        drawItem(it.k, it.l, d.x, d.y, isz * 0.74 * d.s, 0.8);
        g.fillStyle = 'rgba(170,225,255,0.28)'; g.beginPath(); g.arc(d.x, d.y, cs * 0.45 * wob * d.s, 0, 7); g.fill();
        g.lineWidth = 2; g.strokeStyle = 'rgba(110,170,220,0.9)'; g.stroke();
        g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.beginPath(); g.arc(d.x, d.y, cs * 0.45 * wob, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(left, 0, 1)); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(d.x - cs * 0.17, d.y - cs * 0.2, cs * 0.09, cs * 0.05, -0.6, 0, 7); g.fill();
        continue;
      }
      g.save(); g.translate(d.x, d.y);
      if (hset && hset.has(i)) { g.translate(0, cs * 0.3); g.rotate(hw); g.translate(0, -cs * 0.3); }
      if (kind === 'mystery') { const q = Math.sin(t * 2.2 + i) * 0.05; g.rotate(q); }
      g.scale(d.s * (1 + d.sq), d.s * (1 - d.sq));
      drawItem(it.k, it.l, 0, 0, isz);
      g.restore();
      if (kind === 'gen') genBadge(it, i, d.x, d.y, t);
      else if (needSet.has(it.k + ':' + it.l) && !(drag && drag.from === i)) {
        // "Tellimus!" badge: a green check bubble on items an order wants
        const s = Math.max(20, cs * 0.34), bb = 1 + Math.sin(t * 4 + i) * 0.06;
        drawIcon('order', d.x + cs * 0.5 - s * 0.92, d.y - cs * 0.5 - s * 0.08, s * bb);
      }
    }
    // ghosts (items flying away)
    for (let j = ghosts.length - 1; j >= 0; j--) {
      const o = ghosts[j], k = (t - o.t0) / o.dur; if (k < 0) continue;
      if (k >= 1) { ghosts.splice(j, 1); continue; }
      const e = ease.outCubic(k), x = lerp(o.x0, o.x1, e), y = lerp(o.y0, o.y1, e) - Math.sin(k * Math.PI) * 30 * (o.fade ? 0 : 1);
      drawItem(o.k, o.l, x, y, isz * lerp(o.s0, o.s1, e), o.fade ? 1 - k : 1);
    }
  }
  function genBadge(it, i, x, y, t) {
    const cs = L.cs, mx = GEN_LV[it.l - 1][0];
    if (it.ch > 0) {
      const bw = cs * 0.66, bh = Math.max(7, cs * 0.12), bx = x - bw / 2, by = y + cs * 0.5 - bh - 3;
      g.fillStyle = 'rgba(60,35,20,0.55)'; rr(bx, by, bw, bh, bh / 2); g.fill();
      g.fillStyle = '#ffd23a'; rr(bx + 1, by + 1, Math.max(bh - 2, (bw - 2) * (it.ch / mx)), bh - 2, (bh - 2) / 2); g.fill();
    } else {
      const left = Math.max(0, it.cd - now()), tot = GEN_LV[it.l - 1][1] * 1000;
      g.fillStyle = 'rgba(40,25,15,0.5)'; g.beginPath(); g.arc(x, y, cs * 0.46, 0, 7); g.fill();
      g.strokeStyle = '#ffd23a'; g.lineWidth = 4; g.beginPath(); g.arc(x, y, cs * 0.42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - left / tot)); g.stroke();
      textO(fmtTime(left), x, y, 15, '#fff', 'rgba(40,20,10,0.7)', 3, cs - 4);
    }
    if (S.en < 1 && it.ch > 0) { g.globalAlpha = 0.9; drawIcon('energy', x + cs * 0.14, y - cs * 0.5, cs * 0.34); g.globalAlpha = 1; }
  }

  // ---- drawing: info bar (selected item, or the next goal) ----
  function drawInfo(t) {
    const r = L.info, it = sel >= 0 ? S.board[sel] : null;
    panel(r.x, r.y, r.w, r.h, 'paper');
    const tutTxt = S.tut >= 1 && S.tut <= 4 ? STORY['tut' + S.tut] : null;
    if (!it) {
      if (tutTxt) { const ls = wrap(tutTxt, r.w - 24, 16, 800); ls.slice(0, 2).forEach((s, j) => text(s, r.x + r.w / 2, r.y + r.h / 2 + (j - (Math.min(2, ls.length) - 1) / 2) * 20, 16, GRAPE, 'center', 800, r.w - 20)); return; }
      // next goal with a progress bar
      const nt = Game.nextTask();
      if (!nt) { text('Lohista ühesugused asjad kokku.', r.x + r.w / 2, r.y + r.h / 2, 16, INK, 'center', 800, r.w - 20); return; }
      const can = S.stars >= nt.cost, bw = can ? 112 : 0;
      drawIcon('star', r.x + 10, r.y + 13, 36);
      text(nt.name, r.x + 54, r.y + 20, 16, INK, 'left', 900, r.w - 66 - bw);
      bar(r.x + 54, r.y + 36, r.w - 66 - bw - 50, 12, S.stars / nt.cost, can ? MINT : GOLD);
      text(Math.min(S.stars, nt.cost) + '/' + nt.cost, r.x + r.w - 12 - bw - 4, r.y + 42, 15, INK2, 'right', 900);
      hits.push({ x: r.x, y: r.y, w: r.w - bw, h: r.h, fn: () => { snd('tap'); openModal({ kind: 'tasks' }); } });
      if (can) button(r.x + r.w - bw - 6, r.y + 7, bw, r.h - 14, 'Tee ära!', () => Game.doTask(nt.id), { hot: true, pulse: 1, size: 17 });
      return;
    }
    const C = CHAINS[it.k], kind = C.kind, mx = C.names.length;
    drawItem(it.k, it.l, r.x + 32, r.y + r.h / 2, 46);
    let l1 = nm(it.k, it.l), l2 = '';
    const nb = [];
    if (it.b) {
      l1 = 'Mull: ' + l1; l2 = 'Kaob ' + Math.max(0, Math.ceil((it.b - now()) / 1000)) + ' s pärast';
      const p = Game.bubblePrice(it); nb.push({ label: String(p), icon: 'coin', w: 86, fn: () => Game.popBubble(sel), hot: S.coins >= p });
    } else if (kind === 'gen') {
      l1 += ' · ' + it.l + '/' + mx;
      if (it.ch > 0) l2 = (S.tut === 1 ? 'Toksa, et küpsetada! ' : 'Toksa! ') + it.ch + '/' + GEN_LV[it.l - 1][0];
      else { l2 = 'Puhkab ' + fmtTime(it.cd - now()); const p = Game.rushPrice(it); nb.push({ label: String(p), icon: 'coin', w: 86, fn: () => Game.rushGen(sel), hot: S.coins >= p }); }
      nb.push({ icon: 'album', w: 52, fn: () => openChain(it.k, it.l) });
    } else if (kind === 'energy' || kind === 'coin') {
      l2 = 'Toksa: +' + C.value[it.l - 1] + (kind === 'energy' ? ' energiat' : ' münti');
      nb.push({ icon: 'album', w: 52, fn: () => openChain(it.k, it.l) });
    } else if (kind === 'chest') {
      l2 = 'Toksa: ' + C.value[it.l - 1] + ' üllatust';
      nb.push({ label: '+' + Game.sellPrice(it), icon: 'coin', w: 86, fn: () => Game.sell(sel) });
    } else if (kind === 'mystery') {
      l2 = 'Toksa ja vaata, mis sees on!';
    } else if (C.ev) {
      const E = WEEK_EVENTS[C.ev]; l1 += ' · ' + it.l + '/' + mx;
      l2 = it.l >= mx ? 'Toksa: +' + WEEK_CUR.top + ' ' + E.cur[1] + '!' : 'Ühenda: +' + WEEK_CUR.merge(it.l + 1) + ' ' + E.cur[1];
      nb.push({ icon: 'album', w: 52, fn: () => openChain(it.k, it.l) });
    } else {
      l1 += ' · ' + it.l + '/' + mx;
      l2 = needSet.has(it.k + ':' + it.l) ? 'Tellimus! Keegi ootab seda.' : it.l < mx ? 'Järgmine: ' + nm(it.k, it.l + 1) : 'Tipptase!';
      nb.push({ icon: 'album', w: 52, fn: () => openChain(it.k, it.l) });
      nb.push({ label: 'Müü', icon: 'coin', w: 86, fn: () => Game.sell(sel) });
    }
    const tw = nb.reduce((a, b) => a + b.w + 6, 0), tx = r.x + 62, maxT = r.w - 68 - tw;
    text(l1, tx, r.y + 20, 17, INK, 'left', 900, maxT);
    text(l2, tx, r.y + 43, 15, l2.startsWith('Tellimus') ? GOOD : INK2, 'left', 700, maxT);
    let bx = r.x + r.w - 6;
    for (let j = nb.length - 1; j >= 0; j--) { const b = nb[j]; bx -= b.w; button(bx, r.y + 7, b.w, r.h - 14, b.label || '', b.fn, { icon: b.icon, hot: b.hot, size: 17, isz: 26, style: b.label ? 'button' : 'buttonBlue' }); bx -= 6; }
  }

  // ---- drawing: bottom tab bar ----
  function drawBar(t) {
    const r = L.bar;
    panel(r.x + 4, r.y, r.w - 8, r.h, 'glass');
    const nt = Game.nextTask(), canTask = nt && S.stars >= nt.cost, aN = Game.albumCount();
    const wOpen = WEEK.open(), wReady = wOpen && WEEK.readyIdx() >= 0, pReady = PASS.ready() > 0;
    const wName = WEEK.info().E.name; g.font = font(15, 900);
    const items = [
      ['tasks', 'tasks', 'Remont', canTask ? -1 : 0, () => openModal({ kind: 'tasks' }), canTask && (S.tut >= 4 || S.tut === 0)],
      ['album', 'album', 'Album', aN, () => openAlbum(), false],
      ['week', 'week', wOpen && g.measureText(wName).width <= L.btn.week.w - 6 ? wName : 'Nädal', wReady ? -1 : 0, () => openModal({ kind: 'xWeek' }), wReady],
      ['pass', 'pass', 'Rada', pReady ? -1 : 0, () => openModal({ kind: 'xPass' }), pReady && S.tut >= 5],
      ['shop', 'shop', 'Pood', 0, () => openModal({ kind: 'shop' }), false],
      ['bag', 'bag', 'Kott', 0, () => openModal({ kind: 'bag' }), false],
    ];
    const dragBag = drag && dragTarget().bag;
    for (const [id, ic, label, badge, fn, hot] of items) {
      const b = L.btn[id], cx = b.x + b.w / 2, ps = pressScale(b.x, b.y);
      if (id === 'bag' && dragBag) { g.fillStyle = 'rgba(255,200,90,0.55)'; rr(b.x + 6, b.y + 4, b.w - 12, b.h - 8, 16); g.fill(); }
      const bounce = hot ? Math.abs(Math.sin(t * 4)) * 4 : 0, pu = bump[id] ? Math.sin(clamp(1 - (tn() - bump[id]) / 0.35, 0, 1) * Math.PI) * 0.25 : 0;
      const isz = Math.min(40, b.w - 18) * ps * (1 + pu);
      g.save(); if (id === 'week' && !wOpen) g.globalAlpha = 0.55;
      drawIcon(ic, cx - isz / 2, b.y + 4 - bounce + (40 - isz) / 2, isz);
      if (id === 'week' && wOpen) drawIcon('cur_' + WEEK.info().key, cx + 4, b.y + 22 - bounce, 20);
      g.restore();
      text(label, cx, b.y + 60, 15, INK, 'center', 900, b.w + 2);
      if (badge > 0) dot(cx + 18, b.y + 10, badge); else if (badge < 0) dot(cx + 16, b.y + 8);
      if (id === 'bag' && S.bag.length) { g.fillStyle = GRAPE; rr(cx + 6, b.y + 30, 30, 20, 10); g.fill(); text(String(S.bag.length), cx + 21, b.y + 40, 15, '#fff', 'center', 900); }
      hits.push({ x: b.x, y: b.y, w: b.w, h: b.h, bx: b.x, by: b.y, fn: () => { snd('tap'); fn(); } });
    }
  }

  // ---- drawing: combo meter, banners, discovery popups ----
  function drawCombo(t) {
    if (!combo) return;
    const age = tn() - combo.t0, left = 1 - age / (COMBO_MS / 1000);
    if (left <= 0 || !S._combo || S._combo < 2) { combo = null; return; }
    const b = L.board, cx = b.x + b.w - 58, cy = b.y - 6, pop = age < 0.25 ? 1 + 0.35 * Math.sin(age / 0.25 * Math.PI) : 1;
    const hot = Math.min(1, (combo.n - 2) / 8), col = hot > 0.6 ? PINK : hot > 0.3 ? GRAPE : (TH.sky || '#3db8ff');
    g.save(); g.translate(cx, cy); g.scale(pop, pop);
    g.fillStyle = DARK; rr(-54, -22, 108, 44, 22); g.fill();
    g.lineWidth = 4; g.strokeStyle = col; g.beginPath(); rr(-54, -22, 108, 44, 22); g.stroke();
    g.fillStyle = col; rr(-50, 14, 100 * left, 5, 2.5); g.fill();
    textO('Kombo ×' + combo.n, 0, -2, 20, '#fff', col, 4, 100);
    g.restore();
  }
  function drawBanners(t) {
    for (let j = banners.length - 1; j >= 0; j--) {
      const o = banners[j], k = (tn() - o.t0) / o.dur; if (k >= 1) { banners.splice(j, 1); continue; }
      const inK = clamp(k / 0.18, 0, 1), s = ease.outBack(inK) * (k > 0.8 ? 1 - (k - 0.8) / 0.2 * 0.3 : 1), a = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
      const y = clamp(o.y - 20 - k * 30, L.scene.y + 60, H - 140), x = clamp(o.x, 120, W - 120);
      g.save(); g.globalAlpha = a; g.translate(x, y); g.scale(s, s);
      if (o.rays) { g.save(); g.rotate(tn() * 1.2); g.fillStyle = 'rgba(255,230,120,0.35)'; for (let q = 0; q < 12; q++) { g.rotate(Math.PI / 6); g.beginPath(); g.moveTo(0, 0); g.lineTo(-14, -120); g.lineTo(14, -120); g.fill(); } g.restore(); }
      if (o.text) textO(o.text, 0, 0, o.size || 36, o.color || '#fff', OUTL, 7, W - 40);
      if (o.sub) { g.fillStyle = DARK; g.font = font(17, 900); const sw = Math.min(W - 40, g.measureText(o.sub).width + 28); rr(-sw / 2, (o.size || 36) * 0.62, sw, 32, 16); g.fill(); text(o.sub, 0, (o.size || 36) * 0.62 + 16, 17, '#fff', 'center', 900, sw - 12); }
      g.restore();
    }
  }
  function drawPopup(t) {
    if (!newq.length || modal || !onBoard()) return;
    const it = newq[0]; if (!it.t0) it.t0 = tn();
    const k = (tn() - it.t0) / 2.0; if (k >= 1) { newq.shift(); dirty = true; return; }
    const w = Math.min(260, L.board.w - 20), h = 74, x = L.board.x + (L.board.w - w) / 2;
    const inK = ease.outBack(clamp(k / 0.15, 0, 1)), out = k > 0.85 ? (k - 0.85) / 0.15 : 0, y = L.board.y + 8 - (1 - inK) * 40 - out * 30;
    it.rect = { x, y, w, h };
    g.save(); g.globalAlpha = 1 - out;
    g.fillStyle = SHADOW; rr(x, y + 4, w, h, 20); g.fill();
    g.fillStyle = CARD; rr(x, y, w, h, 20); g.fill(); g.lineWidth = 3; g.strokeStyle = '#ffb02e'; g.stroke();
    const bs = 1 + Math.sin(tn() * 8) * 0.06; g.save(); g.translate(x + 40, y + h / 2); g.scale(bs, bs); drawItem(it.k, it.l, 0, 0, 54); g.restore();
    g.fillStyle = PINK; rr(x + 76, y + 9, 58, 24, 12); g.fill(); text('UUS!', x + 105, y + 22, 15, '#fff', 'center', 900);
    text('Album +' + albumReward(it.l).coins, x + w - 10, y + 22, 15, '#d98a00', 'right', 800, w - 150);
    text(nm(it.k, it.l), x + 76, y + 52, 17, INK, 'left', 900, w - 86);
    g.restore();
    if (k < 0.02 && !it.snd) { it.snd = 1; snd2('discover', 'stars'); }
  }

  // ---- drawing: tutorial pointer ----
  function drawHand(x, y, t, press) {
    const k = press ? 0.85 + 0.15 * Math.abs(Math.sin(t * 4)) : 1;
    g.save(); g.translate(x, y);
    g.strokeStyle = 'rgba(255,255,255,' + (0.4 + 0.4 * Math.sin(t * 4)) + ')'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 24 + 6 * Math.sin(t * 4), 0, 7); g.stroke();
    g.scale(k * 1.15, k * 1.15); g.rotate(-0.35);
    g.fillStyle = '#fff'; g.strokeStyle = INK; g.lineWidth = 2.5;
    rr(-6, 0, 12, 26, 6); g.fill(); g.stroke();
    rr(-11, 16, 24, 24, 9); g.fill(); g.stroke();
    g.restore();
  }
  function drawTutorial(t) {
    if (modal || !onBoard() || drag) return;
    const find = (k, l) => { const out = []; S.board.forEach((it, i) => { if (it && !it.b && it.k === k && it.l === l) out.push(i); }); return out; };
    if (S.tut === 1) { const o = find('oven', 1).concat(find('oven', 2)); if (o.length) { const C = cellCenter(o[0]); drawHand(C.x + 6, C.y + 8, t, true); } }
    else if (S.tut === 2) {
      const b = find('bread', 1); if (b.length >= 2) {
        const A = cellCenter(b[0]), B = cellCenter(b[1]), k = (t * 0.6) % 1, e = ease.inOutSine(clamp(k * 1.4, 0, 1));
        drawItem('bread', 1, lerp(A.x, B.x, e), lerp(A.y, B.y, e) - 6, L.cs * 0.8, 0.5);
        drawHand(lerp(A.x, B.x, e) + 6, lerp(A.y, B.y, e) + 8, t, false);
      }
    } else if (S.tut === 3) { const r = cardRects[S.orders.findIndex(o => Game.orderStatus(o).ready)]; if (r) drawHand(r.x + r.w / 2, r.y + 30, t, true); }
    else if (S.tut === 4 && !S.done.b1) { const b = L.btn.tasks; drawHand(b.x + b.w / 2 + 4, b.y + 22, t, true); }
  }

  // ---- drawing: modals ----
  function dim(a) { g.fillStyle = 'rgba(30,20,80,' + (a || 0.45) + ')'; g.fillRect(0, 0, W, H); }
  function modalPanel(m, w, h, title) {
    w = Math.min(w, W - 16); h = Math.min(h, H - 24);
    const x = Math.round((W - w) / 2), y = Math.round(Math.max(18, (H - h) / 2));
    const k = clamp((tn() - m.t0) / 0.3, 0, 1), s = 0.82 + 0.18 * ease.outBack(k);
    g.globalAlpha = Math.min(1, k * 3);
    g.translate(W / 2, y + h / 2); g.scale(s, s); g.translate(-W / 2, -y - h / 2);
    panel(x, y, w, h, 'paper');
    if (title) {
      g.font = font(20, 900); const tw = Math.min(w - 110, g.measureText(title).width + 44);
      panel(x + (w - tw) / 2, y - 16, tw, 40, 'ribbon');
      text(title, x + w / 2, y + 4, 20, '#fff', 'center', 900, tw - 20);
    }
    m.panel = { x, y, w, h };
    // close button (48 px)
    const cx = x + w - 52, cy = y + 4;
    mhits.push({ x: cx, y: cy, w: 48, h: 48, fn: () => closeModal() });
    g.fillStyle = SOFT; g.beginPath(); g.arc(cx + 24, cy + 24, 18, 0, 7); g.fill();
    g.strokeStyle = INK2; g.lineWidth = 3.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx + 17, cy + 17); g.lineTo(cx + 31, cy + 31); g.moveTo(cx + 31, cy + 17); g.lineTo(cx + 17, cy + 31); g.stroke(); g.lineCap = 'butt';
    return { x, y, w, h };
  }
  function rewardRow(r, x, y, maxW, size) { // icons + numbers in a row; returns width
    let xx = x; size = size || 26;
    for (const d of describe(r)) {
      if (xx - x > maxW - size) break;
      if (d.boost) ADV.drawBoost(d.boost, xx, y - size / 2, size); else if (d.icon) drawIcon(d.icon, xx, y - size / 2, size); else drawItem(d.item[0], d.item[1], xx + size / 2, y, size);
      xx += size + 2;
      g.font = font(16, 900); const [tt] = fit(d.t, 16, 900, Math.max(40, maxW - (xx - x))); text(tt, xx, y + 1, 16, INK, 'left', 900); xx += g.measureText(tt).width + 12;
    }
    return xx - x;
  }
  function drawModal(t) {
    mhits = [];
    const m = modal; if (!m) return;
    g.save();
    if (m.kind === 'dialog') { drawDialog(m, t); g.restore(); return; }
    if (m.kind === 'levelup') { drawLevelUp(m, t); g.restore(); return; }
    dim(); const B = { modal: true };
    if (m.kind === 'tasks') {
      // The story area or tour island: tasks in order, the next one with its star button, design choices on done
      // tasks ("Stiil"), and at the bottom the photo mode and the wardrobe.
      const area = Game.curArea(), ts = area.tasks, tour = !!S.ended, head = tour ? 150 : 128, foot = 96;
      const rowH = clamp(Math.floor((H - 24 - head - foot) / ts.length), 52, 62);
      const P = modalPanel(m, 440, head + ts.length * rowH + foot, area.name);
      const done = ts.filter(x => S.done[x.id]).length;
      let y0 = P.y + 36;
      if (tour) { text('Saareringreis · ' + area.themeName + ' · ' + (area.i + 1) + '. saar', P.x + P.w / 2, P.y + 40, 15, GRAPE, 'center', 900, P.w - 124); y0 += 20; }
      drawIcon('star', P.x + 18, y0, 30); text(String(S.stars), P.x + 54, y0 + 16, 20, INK, 'left', 900);
      text(done + '/' + ts.length + ' tehtud', P.x + P.w - 18, y0 + 16, 15, INK2, 'right', 800);
      bar(P.x + 18, y0 + 40, P.w - 36, 10, done / ts.length, PINK);
      const nt = Game.nextTask(), top = y0 + 60;
      ts.forEach((tk, j) => {
        const y = top + j * rowH, isDone = S.done[tk.id], isNext = nt === tk, bh = rowH - 6;
        g.fillStyle = isNext ? 'rgba(255,210,63,0.28)' : SOFT; rr(P.x + 10, y, P.w - 20, bh, 14); g.fill();
        const ic = Math.min(30, bh - 16), iy = y + (bh - ic) / 2;
        if (isDone) drawIcon('check', P.x + 18, iy, ic); else if (!isNext) { g.globalAlpha = 0.6; drawIcon('lock', P.x + 18, iy, ic); g.globalAlpha = 1; } else drawIcon('star', P.x + 18, iy - 1, ic + 2);
        const styled = isDone && tk.choices;
        text(tk.name, P.x + 58, y + bh / 2, 17, isDone ? INK2 : INK, 'left', isDone ? 700 : 900, P.w - (isNext ? 190 : styled ? 170 : 134));
        if (isNext) { m.nextBtn = { x: P.x + P.w - 120, y: y + 4, w: 104, h: 48 }; button(P.x + P.w - 120, y + (bh - 48) / 2, 104, 48, String(tk.cost), () => Game.doTask(tk.id), Object.assign({ icon: 'star', hot: S.stars >= tk.cost, pulse: S.stars >= tk.cost, offFn: () => Game.doTask(tk.id), size: 19 }, B)); }
        else if (styled) { const st = STYLES[S.style[tk.id]]; button(P.x + P.w - 112, y + (bh - 44) / 2, 96, 44, st ? 'Muuda' : 'Vali', () => closeThen({ kind: 'xStyle', id: tk.id, back: 'tasks' }), Object.assign({ icon: 'brush', isz: 24, size: 16, style: 'buttonPink' }, B)); }
        else if (!isDone) { drawIcon('star', P.x + P.w - 64, y + bh / 2 - 12, 24); text(String(tk.cost), P.x + P.w - 30, y + bh / 2 + 1, 17, INK2, 'center', 900); }
      });
      const na = !tour && AREAS[S.area + 1], fy = P.y + P.h - foot;
      text(tour ? 'Pärast seda saart ootab järgmine!' : na ? 'Järgmine koht: ' + na.name : 'Viimane koht! Siis algab Saareringreis.', P.x + P.w / 2, fy + 16, 15, INK2, 'center', 700, P.w - 24);
      const bw = (P.w - 50) / 2;
      button(P.x + 20, fy + 34, bw, 50, 'Foto', () => closeThen({ kind: 'xPhoto' }), Object.assign({ icon: 'camera', isz: 30, size: 18, style: 'buttonBlue' }, B));
      button(P.x + 30 + bw, fy + 34, bw, 50, 'Garderoob', () => closeThen({ kind: 'xLook' }), Object.assign({ icon: 'wardrobe', isz: 30, size: 18, style: 'buttonPink' }, B));
    } else if (m.kind === 'shop') {
      const list = Game.shopList(), cols = 2, rows = Math.ceil(list.length / cols), ch = 118;
      const P = modalPanel(m, 440, 84 + rows * (ch + 10), 'Pood');
      drawIcon('coin', P.x + 18, P.y + 32, 28); text(fmtNum(S.coins), P.x + 52, P.y + 47, 20, INK, 'left', 900);
      const cW = (P.w - 30) / cols, avail = P.h - 76, rowH = Math.min(ch + 10, avail / rows);
      list.forEach((x, j) => {
        const c = j % cols, r = (j / cols) | 0, bx = P.x + 10 + c * (cW + 10), by = P.y + 70 + r * rowH, hh = rowH - 10;
        g.fillStyle = SOFT; rr(bx, by, cW, hh, 16); g.fill();
        if (x.icon) drawItem(x.icon[0], x.icon[1], bx + 32, by + 28, 46); else drawIcon('bag', bx + 10, by + 6, 44);
        text(x.name, bx + 62, by + 18, 16, INK, 'left', 900, cW - 66);
        text(x.desc, bx + 62, by + 39, 15, INK2, 'left', 700, cW - 66);
        if (x.soldOut) text('Välja müüdud', bx + cW / 2, by + hh - 26, 15, INK2, 'center', 700);
        else button(bx + 8, by + hh - 54, cW - 16, 48, String(x.price), () => Game.buy(x.id), Object.assign({ icon: 'coin', hot: S.coins >= x.price, off: S.coins < x.price, offFn: () => Game.buy(x.id), size: 18 }, B));
      });
    } else if (m.kind === 'bag') {
      const cols = 4, rows = Math.ceil(S.bagSlots / cols), P = modalPanel(m, 400, 150 + rows * 88, 'Kott');
      const cs = Math.min(82, (P.w - 30) / cols - 6), x0 = P.x + (P.w - cols * (cs + 6) + 6) / 2;
      for (let j = 0; j < Math.max(S.bagSlots, S.bag.length); j++) {
        const x = x0 + (j % cols) * (cs + 6), y = P.y + 44 + ((j / cols) | 0) * (cs + 6), it = S.bag[j];
        g.fillStyle = SOFT; rr(x, y, cs, cs, 14); g.fill();
        if (it) { drawItem(it.k, it.l, x + cs / 2, y + cs / 2, cs * 0.86); mhits.push({ x, y, w: cs, h: cs, fn: () => { Game.take(j); } }); }
      }
      text('Lohista asi „Kott“ nupule, et see ära panna.', P.x + P.w / 2, P.y + P.h - 50, 15, INK2, 'center', 700, P.w - 20);
      text('Toksa asja, et see lauale tagasi tuua.', P.x + P.w / 2, P.y + P.h - 26, 15, INK2, 'center', 700, P.w - 20);
    } else if (m.kind === 'daily') {
      Game.ensureDaily();
      const D = S.daily, P = modalPanel(m, 440, 680, 'Päevakalender'), gr = Game.giftReward();
      // 7-day row: past days ticked, today glowing, the big 7th day with a crown of rays
      const n7 = 7, gap = 5, tw = Math.floor((P.w - 20 - gap * (n7 - 1)) / n7), th = 92, ty = P.y + 40;
      const today = gr.day7, startX = P.x + (P.w - (tw * n7 + gap * (n7 - 1))) / 2;
      for (let j = 0; j < n7; j++) {
        const x = startX + j * (tw + gap), past = j < today || (j === today && D.gift), now7 = j === today && !D.gift, big = j === 6;
        const pu = now7 ? 1 + Math.sin(t * 5) * 0.04 : 1;
        g.save(); g.translate(x + tw / 2, ty + th / 2); g.scale(pu, pu); g.translate(-x - tw / 2, -ty - th / 2);
        if (now7) { const gg = g.createLinearGradient(0, ty, 0, ty + th); gg.addColorStop(0, '#fff6b0'); gg.addColorStop(1, '#ffc93f'); g.fillStyle = gg; }
        else g.fillStyle = past ? 'rgba(47,213,154,0.2)' : big ? 'rgba(255,79,154,0.14)' : SOFT;
        rr(x, ty, tw, th, 14); g.fill();
        if (now7 || big) { g.lineWidth = 2.5; g.strokeStyle = now7 ? '#fff' : 'rgba(255,79,154,0.5)'; g.stroke(); }
        text((j + 1) + '.', x + tw / 2, ty + 14, 15, past ? GOOD : INK2, 'center', 900);
        calIcon(CAL7[j], x + tw / 2, ty + 46, Math.min(tw - 8, big ? 40 : 34));
        const lab = CAL7[j].coins ? '+' + CAL7[j].coins : '';
        text(lab, x + tw / 2, ty + th - 14, 15, INK, 'center', 900, tw - 2);
        if (past) drawIcon('check', x + tw - 20, ty - 4, 24);
        g.restore();
      }
      const cy = ty + th + 12;
      text(D.gift ? 'Tänane auhind on käes. Homme ootab uus!' : gr.streak > 1 ? gr.streak + '. päev järjest!' : 'Tere tulemast tagasi!', P.x + 20, cy + 16, 17, INK, 'left', 900, P.w - (D.gift ? 40 : 160));
      text(D.gift ? '7. päeval ootab suur auhind.' : 'Tule iga päev, auhinnad kasvavad.', P.x + 20, cy + 40, 15, INK2, 'left', 700, P.w - (D.gift ? 40 : 160));
      if (!D.gift) button(P.x + P.w - 128, cy + 4, 112, 52, 'Võta!', () => { m.tap = { x: startX + today * (tw + gap) + tw / 2, y: ty + th / 2 }; Game.claimGift(); }, Object.assign({ hot: true, pulse: 1, size: 20 }, B));
      // 30-day track
      const ry = cy + 70, bx = P.x + 22, bw = P.w - 44, d30 = D.gift ? D.d30 : Math.max(0, gr.d30 - 1);
      g.fillStyle = 'rgba(124,92,255,0.08)'; rr(P.x + 10, ry, P.w - 20, 112, 16); g.fill();
      text('30 päeva rada: ' + d30 + '/30', P.x + 22, ry + 18, 16, INK, 'left', 900, P.w - 140);
      const nx = CAL30.find(x => x.day > d30) || CAL30[0];
      text('Vahele jäänud päev seda ei nulli.', P.x + 22, ry + 40, 15, INK2, 'left', 700, P.w - 44);
      bar(bx, ry + 62, bw - 14, 12, d30 / 30, GRAPE);
      for (const c of CAL30) {
        const x = bx + 12 + (bw - 28) * c.day / 30, got = d30 >= c.day, nextOne = c === nx && !got;
        g.fillStyle = got ? GOOD : nextOne ? GOLD : '#fff'; g.beginPath(); g.arc(x - 2, ry + 68, 13, 0, 7); g.fill(); g.lineWidth = 2.5; g.strokeStyle = got ? '#fff' : 'rgba(124,92,255,0.5)'; g.stroke();
        text(String(c.day), x - 2, ry + 69, 15, got ? '#fff' : INK, 'center', 900);
      }
      text(nx.day > d30 ? 'Järgmine: ' + nx.day + '. päeval' : 'Uus ring algab!', P.x + 22, ry + 96, 15, INK2, 'left', 800, 150);
      rewardRow(nx.r, P.x + 170, ry + 96, P.w - 190, 22);
      // daily tasks
      const ty2 = ry + 124;
      text('Päevaülesanded', P.x + P.w / 2, ty2 + 10, 18, INK, 'center', 900);
      D.tasks.forEach((tk, j) => {
        const y = ty2 + 26 + j * 64, def = DAILY_POOL.find(x => x.id === tk.id);
        g.fillStyle = SOFT; rr(P.x + 10, y, P.w - 20, 58, 14); g.fill();
        text(def.text.replace('{n}', tk.goal), P.x + 22, y + 17, 16, INK, 'left', 900, P.w - 150);
        const bw2 = P.w - 190; bar(P.x + 22, y + 34, bw2, 13, tk.n / tk.goal, '#5fc24a');
        text(tk.n + '/' + tk.goal, P.x + 22 + bw2 + 6, y + 41, 15, INK2, 'left', 800, 52);
        if (tk.claimed) drawIcon('check', P.x + P.w - 58, y + 12, 34);
        else button(P.x + P.w - 104, y + 5, 88, 48, '+' + DAILY_REWARD.coins, () => Game.claimDaily(j), Object.assign({ icon: 'coin', hot: tk.n >= tk.goal, pulse: tk.n >= tk.goal, off: tk.n < tk.goal, offFn: () => { snd('deny'); toast('Veel ' + (tk.goal - tk.n) + ' puudu.'); }, size: 17 }, B));
      });
      const allC = D.tasks.length && D.tasks.every(x => x.claimed), by = P.y + P.h - 60;
      if (D.bonus) text('Kõik tänased tehtud. Tubli!', P.x + P.w / 2, by + 24, 16, GOOD, 'center', 900, P.w - 20);
      else button(P.x + 24, by, P.w - 48, 50, 'Kõik 3: +' + DAILY_BONUS.stars + ' tähte ja kirst', () => Game.claimBonus(), Object.assign({ hot: allC, off: !allC, offFn: () => { snd('deny'); toast('Tee enne kõik kolm ülesannet.'); }, size: 17 }, B));
    } else if (m.kind === 'settings') {
      const P = modalPanel(m, 380, 442, 'Seaded');
      const row = (y, label, key) => {
        text(label, P.x + 24, y + 24, 18, INK, 'left', 900);
        text(Math.round(S.set[key] * 100) + '%', P.x + P.w - 124, y + 24, 18, INK, 'center', 900);
        const ch = dv => { S.set[key] = clamp(Math.round((S.set[key] + dv) * 10) / 10, 0, 1); const a = au(); try { if (a && a.setVolume) a.setVolume(key === 'music' ? 'music' : 'sfx', S.set[key]); } catch (e) {} snd('tap'); saveSoon(); };
        button(P.x + P.w - 190, y, 48, 48, '−', () => ch(-0.1), Object.assign({ size: 24 }, B)); button(P.x + P.w - 66, y, 48, 48, '+', () => ch(0.1), Object.assign({ size: 24 }, B));
      };
      row(P.y + 44, 'Muusika', 'music'); row(P.y + 104, 'Helid', 'sfx');
      button(P.x + 36, P.y + 168, P.w - 72, 50, S.set.muted ? 'Heli: vaigistatud' : 'Heli: sees', () => { S.set.muted = !S.set.muted; const a = au(); try { if (a && a.setMuted) a.setMuted(S.set.muted); } catch (e) {} snd('tap'); saveSoon(); }, Object.assign({ hot: !S.set.muted }, B));
      button(P.x + 36, P.y + 230, P.w - 72, 50, S.set.rest ? 'Puhkuse meeldetuletus: sees' : 'Puhkuse meeldetuletus: väljas', () => { S.set.rest = !S.set.rest; snd('tap'); saveSoon(); }, Object.assign({ hot: !!S.set.rest, size: 16 }, B));
      button(P.x + 36, P.y + 292, P.w - 72, 50, 'Alusta otsast', () => { closeModal(true); openModal({ kind: 'confirm', text: 'Kas kustutada kogu edenemine ja alustada otsast?', yes: () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} Game.newGame(); resetView(); onTitle = true; save(); } }); }, Object.assign({ style: 'buttonGrey' }, B));
      text('Saarepagar · tehtud armastusega', P.x + P.w / 2, P.y + P.h - 46, 15, INK2, 'center', 700, P.w - 20);
      text('Töötab ka ilma internetita.', P.x + P.w / 2, P.y + P.h - 24, 15, INK2, 'center', 700, P.w - 20);
    } else if (m.kind === 'confirm') {
      const P = modalPanel(m, 360, 220, 'Kindel?');
      wrap(m.text, P.w - 40, 17, 800).forEach((s, j) => text(s, P.x + P.w / 2, P.y + 60 + j * 24, 17, INK, 'center', 800));
      button(P.x + 20, P.y + P.h - 66, (P.w - 50) / 2, 50, 'Ei', () => closeModal(), B);
      button(P.x + 30 + (P.w - 50) / 2, P.y + P.h - 66, (P.w - 50) / 2, 50, 'Jah', () => { const y = m.yes; closeModal(true); y(); }, Object.assign({ hot: true }, B));
    } else if (m.kind === 'chain') {
      const C = CHAINS[m.k], n = C.names.length, cols = 3, rows = Math.ceil(n / cols), rowH = Math.min(112, (H - 160) / rows);
      const P = modalPanel(m, 420, 64 + rows * rowH + (C.kind === 'gen' ? 40 : 10), C.kind === 'gen' ? 'Generaator' : C.name);
      const cw = (P.w - 20) / cols, disc = S.disc[m.k] || 0;
      for (let j = 0; j < n; j++) {
        const x = P.x + 10 + (j % cols) * cw, y = P.y + 40 + ((j / cols) | 0) * rowH, l = j + 1, known = l <= disc || C.kind !== 'item';
        g.fillStyle = l === m.l ? 'rgba(255,190,80,0.35)' : SOFT; rr(x + 3, y, cw - 6, rowH - 8, 14); g.fill();
        const is = Math.min(64, rowH - 40);
        if (known) drawItem(m.k, l, x + cw / 2, y + 6 + is / 2, is); else { drawSilhouette(m.k, l, x + cw / 2, y + 6 + is / 2, is); text('?', x + cw / 2, y + 6 + is / 2, 24, INK2, 'center', 900); }
        text(known ? C.names[j] : 'Tase ' + l, x + cw / 2, y + rowH - 24, 15, INK, 'center', 800, cw - 10);
      }
      if (C.kind === 'gen') {
        const G = GENERATORS[m.k], lv = Math.max(1, Math.min(m.l, 4)), sp = G.spawn.filter(s => s[2] <= lv).map(s => CHAINS[s[0]].name.toLowerCase());
        text('Annab: ' + sp.join(', '), P.x + P.w / 2, P.y + P.h - 22, 15, INK2, 'center', 700, P.w - 20);
      }
    } else if (m.kind === 'energy') {
      const P = modalPanel(m, 380, 372, 'Energia'), free = Game.freeEnIn();
      drawIcon('energy', P.x + P.w / 2 - 30, P.y + 34, 60);
      text(S.en < 1 ? 'Energia sai otsa!' : 'Energiat on ' + S.en + '.', P.x + P.w / 2, P.y + 112, 20, INK, 'center', 900);
      text(S.en < MAXEN ? '+1 iga minut · järgmine ' + fmtTime(Game.enNext()) : 'Täis! Uuel tasemel saad jälle täis paagi.', P.x + P.w / 2, P.y + 140, 15, INK2, 'center', 700, P.w - 24);
      button(P.x + 24, P.y + 166, P.w - 48, 56, free > 0 ? 'Tasuta: ' + fmtTime(free) : 'Tasuta +' + FREE_EN + '!', () => { if (Game.claimFreeEnergy()) closeModal(true); }, Object.assign({ icon: 'freeEnergy', hot: free <= 0, pulse: free <= 0, off: free > 0, offFn: () => { snd('deny'); toast('Tasuta energia tuleb ' + fmtTime(free) + ' pärast.'); }, size: 19, isz: 30 }, B));
      const x = SHOP[0];
      button(P.x + 24, P.y + 234, P.w - 48, 52, x.name + ' +25 · ' + x.price, () => { if (Game.buy(x.id)) closeModal(); }, Object.assign({ icon: 'coin', off: S.coins < x.price, offFn: () => Game.buy(x.id), size: 17 }, B));
      text('Vihje: ühenda kohvioad ja toksa neid.', P.x + P.w / 2, P.y + P.h - 26, 15, INK2, 'center', 700, P.w - 24);
    } else if (m.kind === 'album') drawAlbum(m, t, B);
    else if (m.kind.startsWith('adv')) ADV.drawModal(m, t, B);
    else if (m.kind[0] === 'x') XUI.drawModal(m, t, B);
    g.restore();
  }

  // The main prize of a calendar day as one picture: a booster, a wheel spin, a chest, or coins.
  function calIcon(r, cx, cy, s) {
    if (r.boost) ADV.drawBoost(typeof r.boost === 'string' ? r.boost : Object.keys(r.boost)[0], cx - s / 2, cy - s / 2, s);
    else if (r.chest) drawItem('chest', Math.min(3, r.chest), cx, cy, s);
    else if (r.spins) drawIcon('wheel', cx - s / 2, cy - s / 2, s);
    else if (r.energy) { drawIcon('coin', cx - s / 2 - 2, cy - s / 2 + 2, s * 0.8); drawIcon('energy', cx - s / 2 + s * 0.35, cy - s / 2 - 2, s * 0.7); }
    else drawIcon('coin', cx - s / 2, cy - s / 2, s);
  }

  // Level-up: rays, a big bouncing number and reward tiles that pop in one by one.
  function drawLevelUp(m, t) {
    const age = tn() - m.t0; dim(0.62);
    const cx = W / 2, cy = Math.min(H * 0.36, 300);
    g.save(); g.translate(cx, cy); g.rotate(age * 0.5);
    for (let q = 0; q < 16; q++) { g.rotate(Math.PI / 8); g.fillStyle = q % 2 ? 'rgba(255,220,110,0.22)' : 'rgba(255,255,255,0.12)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-40, -Math.max(W, H)); g.lineTo(40, -Math.max(W, H)); g.fill(); }
    g.restore();
    const k1 = clamp(age / 0.5, 0, 1), s1 = 0.3 + 0.7 * ease.outElastic(k1);
    textO('Uus tase!', cx, cy - 92, 30, '#fff', PINK, 7, W - 40);
    g.save(); g.translate(cx, cy); g.scale(s1, s1);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 62, 0, 7); g.fill(); g.lineWidth = 8; g.strokeStyle = GOLD; g.stroke();
    textO(String(age < 0.35 ? m.lvl - 1 : m.lvl), 0, 4, 64, GRAPE, '#ffffff', 6);
    g.restore();
    // reward tiles
    const got = m.got || {}, tiles = [];
    if (got.coins) tiles.push({ icon: 'coin', t: '+' + Math.round(got.coins * clamp((age - 0.5) / 0.8, 0, 1)) });
    tiles.push({ icon: 'energy', t: 'Täis!' });
    if (got.chest) tiles.push({ item: ['chest', Math.min(3, got.chest)], t: 'Kirst' });
    if (got.mbox) tiles.push({ item: ['mbox', 1], t: 'Üllatus' });
    if (got.gen) tiles.push({ item: [got.gen, 1], t: 'Generaator' });
    const tw = Math.min(96, (W - 32) / tiles.length - 8), x0 = cx - (tiles.length * (tw + 8) - 8) / 2, ty = cy + 96;
    tiles.forEach((d, j) => {
      const kk = clamp((age - 0.45 - j * 0.14) / 0.35, 0, 1); if (kk <= 0) return;
      const s = ease.outBack(kk), x = x0 + j * (tw + 8);
      if (kk < 0.2 && !d.sn) { d.sn = 1; }
      g.save(); g.translate(x + tw / 2, ty + 56); g.scale(s, s); g.translate(-x - tw / 2, -ty - 56);
      g.fillStyle = SHADOW; rr(x, ty + 4, tw, 112, 18); g.fill();
      g.fillStyle = CARD; rr(x, ty, tw, 112, 18); g.fill(); g.lineWidth = 3; g.strokeStyle = GOLD; g.stroke();
      if (d.icon) drawIcon(d.icon, x + tw / 2 - 26, ty + 12, 52); else drawItem(d.item[0], d.item[1], x + tw / 2, ty + 38, 54);
      text(d.t, x + tw / 2, ty + 88, 16, INK, 'center', 900, tw - 8);
      g.restore();
    });
    if (m.cells) text('+' + m.cells + ' uut ruutu laual!', cx, ty + 140, 17, '#fff', 'center', 900, W - 30);
    const bw = Math.min(260, W - 60), by = Math.min(H - 90, ty + 168);
    if (age > 0.6) button(cx - bw / 2, by, bw, 60, 'Super!', () => closeModal(), { hot: true, pulse: 1, modal: true, size: 24 });
    keep(0.1);
  }

  // Collection album: one page per chain; tap a glowing card to collect its reward.
  function drawAlbum(m, t, B) {
    const P = modalPanel(m, 440, Math.min(H - 24, 700), 'Album');
    const N = ALBUM_CHAINS.length; m.page = (m.page + N) % N;
    const k = ALBUM_CHAINS[m.page], C = CHAINS[k], n = C.names.length, disc = S.disc[k] || 0;
    let have = 0; for (let l = 1; l <= n; l++) if (Game.albumHas(k, l)) have++;
    button(P.x + 12, P.y + 56, 48, 48, '‹', () => { m.page--; m.t0 = tn() - 1; snd('tap'); }, Object.assign({ size: 28, style: 'buttonBlue' }, B));
    button(P.x + P.w - 60, P.y + 56, 48, 48, '›', () => { m.page++; m.t0 = tn() - 1; snd('tap'); }, Object.assign({ size: 28, style: 'buttonBlue' }, B));
    text(C.name, P.x + P.w / 2, P.y + 62, 20, INK, 'center', 900, P.w - 140);
    text(have + '/' + n + ' kogutud', P.x + P.w / 2, P.y + 86, 15, INK2, 'center', 800, P.w - 140);
    bar(P.x + 70, P.y + 102, P.w - 140, 10, have / n, PINK);
    // page dots (red when that chain has rewards waiting)
    const dw = Math.min(26, (P.w - 40) / N), dx0 = P.x + (P.w - dw * N) / 2;
    ALBUM_CHAINS.forEach((c, j) => {
      const pend = Game.albumPending(c) > 0 || (Game.chainFull(c) && !S.albumDone[c]);
      g.fillStyle = j === m.page ? GRAPE : pend ? '#ff3b4a' : 'rgba(110,100,200,0.25)'; g.beginPath(); g.arc(dx0 + dw * (j + 0.5), P.y + 126, j === m.page ? 6 : 5, 0, 7); g.fill();
      mhits.push({ x: dx0 + dw * j, y: P.y + 114, w: dw, h: 26, fn: () => { m.page = j; snd('tap'); } });
    });
    m.pend = []; const cols = 3, rows = Math.ceil(n / cols), top = P.y + 144, foot = 72, cw = (P.w - 20) / cols, rowH = Math.min(124, (P.h - (top - P.y) - foot) / rows);
    for (let j = 0; j < n; j++) {
      const l = j + 1, x = P.x + 10 + (j % cols) * cw, y = top + ((j / cols) | 0) * rowH, got = Game.albumHas(k, l), known = l <= disc, pend = known && !got;
      const pulse = pend ? 1 + Math.sin(t * 6 + j) * 0.03 : 1;
      g.save(); g.translate(x + cw / 2, y + rowH / 2); g.scale(pulse, pulse); g.translate(-x - cw / 2, -y - rowH / 2);
      if (pend) { const gg = g.createLinearGradient(0, y, 0, y + rowH); gg.addColorStop(0, '#fff6b0'); gg.addColorStop(1, '#ffd23f'); g.fillStyle = gg; }
      else g.fillStyle = got ? 'rgba(255,255,255,0.9)' : SOFT;
      rr(x + 4, y + 2, cw - 8, rowH - 8, 16); g.fill();
      if (pend) { g.lineWidth = 3; g.strokeStyle = '#ffffff'; g.stroke(); }
      const is = Math.min(68, rowH - 46);
      if (known) drawItem(k, l, x + cw / 2, y + 8 + is / 2, is); else { drawSilhouette(k, l, x + cw / 2, y + 8 + is / 2, is); text('?', x + cw / 2, y + 8 + is / 2, 26, INK2, 'center', 900); }
      if (pend) { g.fillStyle = GOOD; rr(x + 12, y + rowH - 38, cw - 24, 28, 14); g.fill(); drawIcon('coin', x + cw / 2 - 30, y + rowH - 36, 24); text('+' + albumReward(l).coins, x + cw / 2 + 8, y + rowH - 23, 16, '#fff', 'center', 900); }
      else text(known ? C.names[j] : 'Tase ' + l, x + cw / 2, y + rowH - 24, 15, known ? INK : INK2, 'center', 800, cw - 14);
      g.restore();
      if (pend) m.pend.push({ x: x + cw / 2, y: y + rowH / 2 });
      if (pend) mhits.push({ x: x + 4, y, w: cw - 8, h: rowH - 6, fn: () => { m.tap = { x: x + cw / 2, y: y + rowH / 2 }; Game.claimAlbum(k, l); } });
      else if (known) mhits.push({ x: x + 4, y, w: cw - 8, h: rowH - 6, fn: () => { snd('tap'); toast(C.names[j] + ' (tase ' + l + ')'); } });
    }
    const full = Game.chainFull(k), bx = P.x + 20, by = P.y + P.h - 62, bw = P.w - 40;
    if (S.albumDone[k]) text('Ahel kogutud! ✓', P.x + P.w / 2, by + 26, 17, GOOD, 'center', 900);
    else button(bx, by, bw, 52, full ? 'Ahel täis: võta auhind!' : 'Kogu kõik: +' + ALBUM_CHAIN.stars + ' tähte, 2 kirstu', () => { m.tap = { x: P.x + P.w / 2, y: by }; Game.claimChain(k); }, Object.assign({ hot: full, pulse: full, off: !full, offFn: () => { snd('deny'); toast('Avasta ja kogu enne kõik ' + n + ' asja.'); }, size: 17 }, B));
  }

  function fmtLong(ms) { const h = Math.floor(ms / 3600000), d = Math.floor(h / 24); return d > 0 ? d + ' p ' + (h % 24) + ' h' : h > 0 ? h + ' h ' + Math.floor(ms / 60000) % 60 + ' min' : fmtTime(ms); }
  function drawDialog(m, t) {
    dim(0.32);
    const line = m.lines[m.i] || m.lines[m.lines.length - 1], who = line[0], letter = who === 'maali';
    const w = Math.min(L.col.w - 12, 500, W - 12), x = Math.round((W - w) / 2), ps = 84;
    const tw = w - ps - 42, size = 17, ls = wrap(line[1], tw, size, letter ? 600 : 700), h = Math.max(160, 66 + ls.length * 24);
    const y = Math.round(Math.min(H - h - 16, L.bar.y + L.bar.h - h));
    const k = clamp((t - m.t0) / 0.25, 0, 1);
    if (m.title && m.i === 0) {
      g.font = font(18, 900); const tw2 = Math.min(w - 40, g.measureText(m.title).width + 44);
      panel(x + (w - tw2) / 2, y - 56, tw2, 40, 'ribbon');
      text(m.title, x + w / 2, y - 36, 18, '#fff', 'center', 900, tw2 - 20);
    }
    g.save(); const sy = 0.94 + 0.06 * ease.outBack(k); g.translate(x + w / 2, y + h); g.scale(1, sy); g.translate(-x - w / 2, -y - h);
    g.fillStyle = SHADOW; rr(x, y + 5, w, h, 24); g.fill();
    g.fillStyle = letter ? '#fffaf0' : CARD; rr(x, y, w, h, 24); g.fill(); g.lineWidth = 2.5; g.strokeStyle = letter ? '#e0b080' : EDGE; g.stroke();
    g.restore();
    if (letter) { g.strokeStyle = 'rgba(160,110,70,0.22)'; g.lineWidth = 1; for (let yy = y + 54; yy < y + h - 12; yy += 24) { g.beginPath(); g.moveTo(x + ps + 26, yy + 9); g.lineTo(x + w - 14, yy + 9); g.stroke(); } }
    g.save(); g.translate(x + 14 + ps / 2, y + 16 + ps / 2); const s = 0.8 + 0.2 * ease.outBack(k); g.scale(s, s); drawPortrait(who, -ps / 2, -ps / 2, ps); g.restore();
    text(WHO[who] ? (letter ? 'Vanaema Maali kiri' : WHO[who].name) : who, x + ps + 28, y + 26, 18, letter ? '#a04a6a' : GRAPE, 'left', 900);
    const shown = Math.floor((t - m.t0) * 48); let left = shown;
    if (shown > (m.said || 0) && shown <= line[1].length) { const ch = line[1][shown - 1]; if (ch && ch !== ' ' && shown % 2 === 0) snd('talk', { who, ch }); m.said = shown; }
    ls.forEach((s2, j) => { if (left <= 0) return; const part = s2.slice(0, left); left -= s2.length + 1; text(part, x + ps + 28, y + 56 + j * 24, size, INK, 'left', letter ? 600 : 700); });
    if (shown >= line[1].length) { const a = 0.5 + 0.5 * Math.sin(t * 6); g.globalAlpha = a; text('▶', x + w - 22, y + h - 20, 16, INK2, 'center', 900); g.globalAlpha = 1; }
    text((m.i + 1) + '/' + m.lines.length, x + 14 + ps / 2, y + h - 20, 15, INK2, 'center', 800);
  }
  function drawTitle(t) {
    mhits = [];
    const cx = W / 2;
    if (!artOn('bg')) { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, TH.bgTop || '#7fd3ff'); gr.addColorStop(1, TH.bgBottom || '#fff1dc'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
    const lw = Math.min(W - 40, 440), ly = H * 0.28;
    let logo = false;
    if (artOn('logo')) { try { ART.logo(g, cx - lw / 2, ly - lw * 0.2, lw, t); logo = true; } catch (e) {} }
    if (!logo) textO('Saarepagar', cx, ly + Math.sin(t * 1.5) * 3, Math.round(lw / 6.2), GOLD, GRAPE, 8);
    text('Vanaema vana maja. Sinu uus kohvik.', cx, ly + lw * 0.32, 18, INK, 'center', 800, W - 40);
    const bw = Math.min(280, W - 80), by = Math.min(H * 0.56, H - 260);
    const s = 1 + Math.sin(t * 3) * 0.04;
    g.save(); g.translate(cx, by + 32); g.scale(s, s); g.translate(-cx, -by - 32);
    button(cx - bw / 2, by, bw, 64, S.tut === 0 ? 'Alusta!' : 'Mängi!', () => start(), { hot: true, modal: true, size: 26 });
    g.restore();
    button(cx - bw / 2, by + 78, bw, 60, 'Seiklus · tase ' + S.adv.top, () => startAdv(), { style: 'buttonPink', modal: true, size: 21, icon: 'map', isz: 34 });
    if (ADV.attention()) dot(cx + bw / 2 - 6, by + 82);
    if (S.tut > 0) text('Tase ' + S.lvl + ' · ' + (S.ended ? 'Saareringreis, ' + (S.tour + 1) + '. saar' : Game.curArea().name), cx, by + 166, 17, INK, 'center', 800, W - 30);
    if (WEEK.open()) { const wn = WEEK.info().E.name + ' käib!'; g.fillStyle = PINK; g.font = font(16, 900); const tw = Math.min(W - 30, g.measureText(wn).width + 30); rr(cx - tw / 2, by + 190, tw, 34, 17); g.fill(); text(wn, cx, by + 208, 16, '#fff', 'center', 900, tw - 12); }
  }

  function drawToasts(t) {
    for (let j = toasts.length - 1; j >= 0; j--) if (t - toasts[j].t0 > toasts[j].dur) toasts.splice(j, 1);
    toasts.forEach(o => {
      const k = t - o.t0, a = Math.min(1, k / 0.15, (o.dur - k) / 0.3);
      const TB = scr === 'board' || onTitle ? L.board : ADV.toastRect();
      const w = Math.min(TB.w - 8, 460), ls = wrap(o.s, w - 28, 16, 800), h = 20 + ls.length * 21;
      const x = TB.x + (TB.w - w) / 2, y = TB.y + TB.h - h - 10 + (1 - Math.min(1, k / 0.15)) * 14;
      g.globalAlpha = clamp(a, 0, 1);
      g.fillStyle = DARK; rr(x, y, w, h, 18); g.fill();
      ls.forEach((s, q) => text(s, x + w / 2, y + 20 + q * 21, 16, '#ffffff', 'center', 800));
      g.globalAlpha = 1;
    });
    for (let j = floaters.length - 1; j >= 0; j--) {
      const o = floaters[j], k = (t - o.t0) / 1.0; if (k >= 1) { floaters.splice(j, 1); continue; }
      g.globalAlpha = 1 - k * k; const y = o.y - k * 40;
      if (o.icon) { drawIcon(o.icon, o.x - 26, y - 11, 22); textO(o.s, o.x + 8, y, 16, '#fff', o.color, 4); }
      else textO(o.s, o.x, y, 17, '#fff', o.color, 4);
      g.globalAlpha = 1;
    }
  }

  // ---- frame ----
  function fxActive() {
    if (typeof FX === 'undefined' || !FX) return false;
    try { if (typeof FX.active === 'function') return !!FX.active(); if (typeof FX.active === 'number' || typeof FX.active === 'boolean') return !!FX.active; } catch (e) {}
    return performance.now() < fxUntil;
  }
  let warm = null;
  function prewarm() {
    if (!warm) {
      warm = []; const ks = new Set(Object.keys(S.disc).concat(Game.availChains(), ['coffee', 'coin', 'chest', 'mbox']));
      for (const k of ks) { if (!CHAINS[k]) continue; const top = CHAINS[k].kind === 'item' ? Math.min(CHAINS[k].names.length, (S.disc[k] || 0) + 2) : CHAINS[k].names.length; for (let l = 1; l <= top; l++) warm.push([k, l]); }
    }
    const t0 = performance.now();
    while (warm.length && performance.now() - t0 < 6) { const [k, l] = warm.shift(); const b = itemBox(k, l), full = L.cs * FILL * clamp(1 / b.s, 1, 1.7); itemImg(k, l, Math.ceil(full * DPR / 8) * 8); }
  }
  // Rest reminder: active play time (input in the last two minutes) counts up; after REST_MIN minutes a gentle note
  // appears once (then again after 30 more minutes). Off in the settings. URL flag rest=<seconds> for tests.
  let playT = 0, restAt = QS.rest ? +QS.rest || 5 : REST_MIN * 60;
  function restTick(dt) {
    if (onTitle || document.hidden || tn() - idleT > 120) return;
    playT += dt;
    if (playT >= restAt && S.set.rest && !modal && !drag && scr !== 'level') { playT = 0; restAt = 30 * 60; openModal({ kind: 'xRest' }); }
  }
  function update(dt) { if (fxOn('update')) { try { FX.update(dt); } catch (e) {} } if (S) { tickDisp(dt); restTick(dt); if (onTitle && (!warm || warm.length)) prewarm(); if (!onTitle && scr !== 'board') ADV.update(dt); } }
  function needsDraw(ms) {
    if (dirty || drag || ms < animUntil || fxActive()) return true;
    if (modal && (modal.kind === 'dialog' || modal.kind === 'levelup')) return ms - lastDraw > 33;
    if (!onTitle && scr !== 'board') return ms - lastDraw > (ADV.busy() ? 15 : 33);
    if (combo || banners.length || newq.length || (hintActive() && hint)) return ms - lastDraw > 33;
    const pulsing = onTitle || sel >= 0 || (S.tut >= 1 && S.tut <= 4) || S.orders.some(o => Game.orderStatus(o).ready) || S.board.some(it => it && it.b) || artOn('scene') || !!modal || hintActive();
    return ms - lastDraw > (pulsing ? 50 : 1000);
  }
  function draw(ms) {
    lastDraw = ms; dirty = false; const t = tn();
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    hits = [];
    if (artOn('bg')) { try { ART.bg(g, W, H, t); } catch (e) { g.fillStyle = TH.bgBottom || '#fff1dc'; g.fillRect(0, 0, W, H); } }
    else { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, TH.bgTop || '#7fd3ff'); gr.addColorStop(1, TH.bgBottom || '#fff1dc'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
    if (disp.en === null) tickDisp(1);
    if (onTitle) { drawTitle(t); if (fxOn('draw')) { try { FX.draw(g); } catch (e) {} } return; }
    if (scr !== 'board') {
      if (scr === 'map') ADV.drawMap(t); else ADV.drawLevel(t);
      if (fxOn('draw') && !(modal && modal.fxTop)) { try { FX.draw(g); } catch (e) {} }
      drawBanners(t); drawToasts(t); drawModal(t);
      if (modal && modal.fxTop && fxOn('draw')) { try { FX.draw(g); } catch (e) {} }
      return;
    }
    if (sel >= 0 && !S.board[sel]) sel = -1;
    drawScene(t); drawBoard(t); drawOrders(t); drawInfo(t); drawBar(t);
    if (drag) {
      const tg = dragTarget(), x = drag.x, y = drag.y - drag.lift, s = L.cs * 1.1;
      g.fillStyle = 'rgba(60,35,15,0.22)'; g.beginPath(); g.ellipse(x, y + s * 0.45 + drag.lift * 0.3, s * 0.34, s * 0.12, 0, 0, 7); g.fill();
      const wob = Math.sin(t * 14) * 0.05;
      g.save(); g.translate(x, y); g.rotate(wob); drawItem(drag.it.k, drag.it.l, 0, 0, s); g.restore();
      if (tg.cell >= 0 && tg.cell !== drag.from && Game.canMerge(drag.it, S.board[tg.cell])) {
        const lab = tg.grp ? '5 → 2 × ' + nm(drag.it.k, drag.it.l + 1) : '→ ' + nm(drag.it.k, drag.it.l + 1);
        g.font = font(16, 900); const lw = Math.min(W - 20, g.measureText(lab).width + 24), lx = clamp(x, lw / 2 + 6, W - lw / 2 - 6);
        g.fillStyle = tg.grp ? GOOD : DARK; rr(lx - lw / 2, y - s * 0.62 - 30, lw, 30, 15); g.fill();
        text(lab, lx, y - s * 0.62 - 14, 16, '#fff', 'center', 900, lw - 12);
      }
    }
    drawCombo(t);
    const fxTop = modal && modal.kind === 'levelup';
    if (!fxTop && fxOn('draw')) { try { FX.draw(g); } catch (e) {} }
    drawBanners(t); drawPopup(t);
    drawToasts(t);
    drawTutorial(t);
    drawModal(t);
    if (fxTop && fxOn('draw')) { try { FX.draw(g); } catch (e) {} }
    if (modal && modal.kind === 'tasks' && S.tut === 4 && modal.nextBtn && S.stars >= 1) { const b = modal.nextBtn; drawHand(b.x + b.w / 2 + 8, b.y + b.h / 2 + 10, t, true); }
  }

  function markDirty() { dirty = true; }
  function resetView() { scr = 'board'; sel = -1; anim.clear(); ghosts.length = 0; banners.length = 0; newq.length = 0; combo = null; modal = null; mq.length = 0; drag = null; disp.en = null; dirty = true; }

  return {
    layout, draw, update, needsDraw, ev, hudPos, hudPulse, cellCenter, cellAt, start, openModal, closeModal, toast, markDirty, resetView, itemImg, openAlbum,
    startAdv, goScreen, get scr() { return scr; },
    // Drawing and sound helpers for the adventure screens (55-map.js).
    H: {
      get g() { return g; }, get W() { return W; }, get H() { return H; }, get DPR() { return DPR; }, get L() { return L; }, get modal() { return modal; },
      C: { INK, INK2, CARD, EDGE, GOOD, GOLD, PINK, GRAPE, MINT, SHADOW, DARK, SOFT, OUTL, MINF },
      rr, shade, font, fit, text, textO, wrap, bar, panel, pressScale, button, drawItem, itemImg, itemBox, drawSilhouette, drawIcon, iconImg, drawPortrait, dot, dim, modalPanel, rewardRow, describe,
      snd, snd2, music, fx, artOn, fxOn, keep, tn, toast, banner, floater, rewardFx, inR, insets, disp, bump, boardMusic,
      openModal, closeModal, closeThen, addHit: (h, modal) => (modal ? mhits : hits).push(h), fmtLong, paintScene, portraitImg, goScreen,
    },
    get L() { return L; }, get modal() { return modal; }, get sel() { return sel; }, set sel(v) { sel = v; dirty = true; },
    get onTitle() { return onTitle; }, get cards() { return cardRects; }, get hits() { return hits; }, get mhits() { return mhits; },
    dialogNext: () => { if (modal && modal.kind === 'dialog') { modal.t0 = -1e9; dialogNext(); } },
  };
})();
