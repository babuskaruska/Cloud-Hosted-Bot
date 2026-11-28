// Saarepagar UI (Mira): layout (portrait first, landscape side by side), drawing, input (drag, tap, long press),
// screens (board, orders, tasks, story, shop, bag, daily, settings, chain), tutorial pointer and all text.
// Art, effects and audio come from ART / FX / sfx / MUSIC / AU when they exist; otherwise simple placeholders are drawn.
const UI = (() => {
  const cv = document.getElementById('cv'), g = cv.getContext('2d');
  const FONT = 'ui-rounded,"SF Pro Rounded",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
  const INK = '#5a3a22', INK2 = '#8a6446', PAPER = '#fff6e6';
  let W = 0, H = 0, DPR = 1;
  const L = {};
  let dirty = true, animUntil = 0, fxUntil = 0, lastDraw = 0, T = 0;
  let sel = -1, drag = null, ptr = null, dropPt = null, ordScroll = 0, ordMax = 0;
  let hits = [], mhits = [], cardRects = [], pressed = null;
  const anim = new Map(), ghosts = [], floaters = [], toasts = [];
  let modal = null; const mq = [];
  let onTitle = true, audioUnlocked = false, progressSet = new Set(), progressN = -1, flash = null;

  // ---- defensive access to the other team members' APIs ----
  const has = (o, f) => { try { return typeof o !== 'undefined' && o && typeof o[f] === 'function'; } catch (e) { return false; } };
  const artOn = f => { try { return typeof ART !== 'undefined' && ART && typeof ART[f] === 'function'; } catch (e) { return false; } };
  const fxOn = f => { try { return typeof FX !== 'undefined' && FX && typeof FX[f] === 'function'; } catch (e) { return false; } };
  function snd(name, opts) { try { if (typeof sfx === 'function') sfx(name, opts || {}); } catch (e) {} }
  function music(name, opts) { try { if (typeof MUSIC !== 'undefined' && MUSIC && typeof MUSIC.scene === 'function') MUSIC.scene(name, opts); } catch (e) {} }
  function fx(name, ...a) { if (!fxOn(name)) return false; try { FX[name](...a); fxUntil = performance.now() + 1800; return true; } catch (e) { return false; } }
  function au() { try { return typeof AU !== 'undefined' && AU ? AU : null; } catch (e) { return null; } }

  // ---- small drawing helpers ----
  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function shade(hex, a) {
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = n >> 8 & 255, b = n & 255;
    if (a >= 0) { r += (255 - r) * a; gg += (255 - gg) * a; b += (255 - b) * a; } else { r *= 1 + a; gg *= 1 + a; b *= 1 + a; }
    return 'rgb(' + (r | 0) + ',' + (gg | 0) + ',' + (b | 0) + ')';
  }
  function font(size, weight) { return (weight || 700) + ' ' + size + 'px ' + FONT; }
  function text(s, x, y, size, color, align, weight, maxW) {
    g.font = font(size, weight); g.fillStyle = color || INK; g.textAlign = align || 'center'; g.textBaseline = 'middle';
    if (maxW) { let sz = size; while (sz > 9 && g.measureText(s).width > maxW) { sz--; g.font = font(sz, weight); } }
    g.fillText(s, x, y);
  }
  function wrap(s, maxW, size, weight) {
    g.font = font(size, weight); const words = s.split(' '), lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur); return lines;
  }
  const PANEL_PH = { paper: [PAPER, '#d9b48a'], wood: ['#b07444', '#7a4a26'], button: ['#f5c96a', '#b9802e'], buttonHot: ['#86c95e', '#4f8d34'], ribbon: ['#d95a4e', '#9a3a30'], off: ['#e8dccb', '#c4b39c'] };
  function panel(x, y, w, h, style) {
    if (style !== 'off' && artOn('panel')) { try { ART.panel(g, x, y, w, h, style); return; } catch (e) {} }
    const [f, b] = PANEL_PH[style] || PANEL_PH.paper, r = Math.min(14, h / 2.6);
    g.fillStyle = 'rgba(80,45,20,0.18)'; rr(x, y + 2.5, w, h, r); g.fill();
    g.fillStyle = f; rr(x, y, w, h, r); g.fill();
    g.lineWidth = 2; g.strokeStyle = b; rr(x + 1, y + 1, w - 2, h - 2, r); g.stroke();
    if (style === 'button' || style === 'buttonHot') { g.fillStyle = 'rgba(255,255,255,0.28)'; rr(x + 4, y + 3, w - 8, h * 0.38, r * 0.7); g.fill(); }
  }
  function button(x, y, w, h, label, fn, opts) {
    opts = opts || {};
    const press = pressed && pressed.x === x && pressed.y === y ? 1 : 0;
    const style = opts.off ? 'off' : opts.hot ? 'buttonHot' : 'button';
    g.save(); if (press) { g.translate(x + w / 2, y + h / 2); g.scale(0.95, 0.95); g.translate(-x - w / 2, -y - h / 2); }
    panel(x, y, w, h, style);
    let tx = x + w / 2;
    if (opts.icon) {
      const s = Math.min(22, h - 14); g.font = font(opts.size || 15); const tw = g.measureText(label).width;
      const x0 = x + (w - (s + 4 + tw)) / 2; drawIcon(opts.icon, x0, y + (h - s) / 2, s); tx = x0 + s + 4 + tw / 2;
    }
    text(label, tx, y + h / 2 + 1, opts.size || 15, opts.off ? '#a08a72' : opts.hot ? '#fff' : INK, 'center', 800, w - 10);
    g.restore();
    (opts.modal ? mhits : hits).push({ x, y, w, h, fn: opts.off && !opts.offFn ? null : (opts.offFn && opts.off ? opts.offFn : fn) });
  }

  // ---- item images (Ash's ART.item or a placeholder) ----
  const phCache = new Map();
  function itemImg(k, l, px) {
    px = Math.max(8, Math.round(px));
    if (artOn('item')) { try { const c = ART.item(k, l, px); if (c && c.width) return c; } catch (e) {} }
    const key = k + ':' + l + ':' + px; let c = phCache.get(key);
    if (!c) { c = phItem(k, l, px); phCache.set(key, c); }
    return c;
  }
  function phItem(k, l, px) {
    const c = document.createElement('canvas'); c.width = c.height = px;
    const x = c.getContext('2d'), C = CHAINS[k], col = C.color, s = px, kind = C.kind;
    const grow = 0.62 + 0.3 * (l - 1) / Math.max(1, C.names.length - 1);
    const r = s * 0.5 * grow, cx = s / 2, cy = s / 2 + s * 0.03;
    x.lineWidth = Math.max(1.5, s * 0.045); x.strokeStyle = shade(col, -0.45);
    const fillGrad = () => { const gr = x.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.1); gr.addColorStop(0, shade(col, 0.45)); gr.addColorStop(1, shade(col, -0.08)); return gr; };
    x.fillStyle = fillGrad();
    const path = () => {
      x.beginPath();
      if (kind === 'gen') { const w = r * 1.8, h = r * 1.5, y0 = cy - h * 0.35; x.moveTo(cx - w / 2, y0); x.lineTo(cx, y0 - h * 0.45); x.lineTo(cx + w / 2, y0); x.lineTo(cx + w / 2, y0 + h * 0.85); x.lineTo(cx - w / 2, y0 + h * 0.85); x.closePath(); }
      else if (kind === 'chest') { const w = r * 1.9, h = r * 1.4; x.rect(cx - w / 2, cy - h / 2, w, h); }
      else if (kind === 'energy') { const q = r; x.moveTo(cx + q * 0.2, cy - q); x.lineTo(cx - q * 0.6, cy + q * 0.15); x.lineTo(cx - q * 0.05, cy + q * 0.15); x.lineTo(cx - q * 0.25, cy + q); x.lineTo(cx + q * 0.65, cy - q * 0.2); x.lineTo(cx + q * 0.08, cy - q * 0.2); x.closePath(); }
      else { const n = 6 + (l % 3); for (let j = 0; j <= 40; j++) { const a = j / 40 * Math.PI * 2, rr2 = r * (1 + 0.06 * Math.sin(a * n)); x.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2); } x.closePath(); }
    };
    path(); x.fill(); x.stroke();
    if (kind === 'coin') { x.beginPath(); x.arc(cx, cy, r * 0.62, 0, Math.PI * 2); x.stroke(); }
    // shine
    x.fillStyle = 'rgba(255,255,255,0.45)'; x.beginPath(); x.ellipse(cx - r * 0.35, cy - r * 0.45, r * 0.28, r * 0.16, -0.5, 0, Math.PI * 2); x.fill();
    // label: first letters of the name
    const nm = C.names[l - 1];
    x.fillStyle = shade(col, -0.6); x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '800 ' + Math.round(s * (kind === 'gen' ? 0.24 : 0.27)) + 'px ' + FONT;
    x.fillText(nm.slice(0, 2), cx, cy + (kind === 'gen' ? s * 0.06 : 0));
    // level pip
    const pr = s * 0.15; x.fillStyle = '#fff'; x.beginPath(); x.arc(s - pr - 1.5, s - pr - 1.5, pr, 0, Math.PI * 2); x.fill(); x.lineWidth = Math.max(1, s * 0.03); x.stroke();
    x.fillStyle = INK; x.font = '800 ' + Math.round(pr * 1.3) + 'px ' + FONT; x.fillText(String(l), s - pr - 1.5, s - pr - 1);
    return c;
  }
  function drawItem(k, l, cx, cy, size, alpha) {
    const px = size * DPR, img = itemImg(k, l, px);
    if (alpha !== undefined && alpha < 1) g.globalAlpha = Math.max(0, alpha);
    g.drawImage(img, cx - size / 2, cy - size / 2, size, size);
    g.globalAlpha = 1;
  }

  // ---- icons and portraits ----
  const icCache = new Map();
  function iconImg(name, px) {
    px = Math.max(8, Math.round(px));
    if (artOn('icon')) { try { const c = ART.icon(name, px); if (c && c.width) return c; } catch (e) {} }
    const key = name + ':' + px; let c = icCache.get(key);
    if (!c) { c = phIcon(name, px); icCache.set(key, c); }
    return c;
  }
  function phIcon(name, s) {
    const c = document.createElement('canvas'); c.width = c.height = s; const x = c.getContext('2d');
    const cx = s / 2, cy = s / 2, r = s * 0.42; x.lineWidth = Math.max(1.5, s * 0.07); x.lineJoin = 'round'; x.lineCap = 'round';
    const star = (rad, col) => { x.beginPath(); for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + j * Math.PI / 5, q = j % 2 ? rad * 0.45 : rad; x.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q * 1.02 + s * 0.03); } x.closePath(); x.fillStyle = col; x.fill(); x.strokeStyle = '#a8701a'; x.stroke(); };
    switch (name) {
      case 'energy': x.beginPath(); x.moveTo(cx + r * 0.25, cy - r); x.lineTo(cx - r * 0.6, cy + r * 0.12); x.lineTo(cx - r * 0.02, cy + r * 0.12); x.lineTo(cx - r * 0.25, cy + r); x.lineTo(cx + r * 0.62, cy - r * 0.18); x.lineTo(cx + r * 0.05, cy - r * 0.18); x.closePath(); x.fillStyle = '#ffd23a'; x.fill(); x.strokeStyle = '#b07a10'; x.stroke(); break;
      case 'coin': x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fillStyle = '#f4c542'; x.fill(); x.strokeStyle = '#a8761a'; x.stroke(); x.beginPath(); x.arc(cx, cy, r * 0.58, 0, 7); x.stroke(); break;
      case 'star': star(r * 1.12, '#ffd34a'); break;
      case 'xp': x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fillStyle = '#7ab8e8'; x.fill(); x.strokeStyle = '#3a6a9a'; x.stroke(); break;
      case 'gift': x.fillStyle = '#e8605a'; x.strokeStyle = '#9a3430'; x.fillRect(cx - r * 0.85, cy - r * 0.35, r * 1.7, r * 1.25); x.strokeRect(cx - r * 0.85, cy - r * 0.35, r * 1.7, r * 1.25); x.fillStyle = '#ffd34a'; x.fillRect(cx - r * 0.15, cy - r * 0.35, r * 0.3, r * 1.25); x.fillRect(cx - r, cy - r * 0.6, r * 2, r * 0.32); x.strokeRect(cx - r, cy - r * 0.6, r * 2, r * 0.32); break;
      case 'bag': x.beginPath(); x.ellipse(cx, cy + r * 0.25, r * 0.85, r * 0.72, 0, 0, 7); x.fillStyle = '#c99a5a'; x.fill(); x.strokeStyle = '#7a5226'; x.stroke(); x.beginPath(); x.moveTo(cx - r * 0.35, cy - r * 0.45); x.lineTo(cx - r * 0.5, cy - r * 0.9); x.lineTo(cx + r * 0.5, cy - r * 0.9); x.lineTo(cx + r * 0.35, cy - r * 0.45); x.fill(); x.stroke(); break;
      case 'shop': x.fillStyle = '#fff6e6'; x.strokeStyle = '#7a4a26'; x.fillRect(cx - r * 0.8, cy - r * 0.2, r * 1.6, r * 1.1); x.strokeRect(cx - r * 0.8, cy - r * 0.2, r * 1.6, r * 1.1); for (let j = 0; j < 4; j++) { x.fillStyle = j % 2 ? '#fff' : '#e8605a'; x.fillRect(cx - r + j * r * 0.5, cy - r * 0.75, r * 0.5, r * 0.55); } x.strokeRect(cx - r, cy - r * 0.75, r * 2, r * 0.55); break;
      case 'settings': x.fillStyle = '#a89480'; x.strokeStyle = '#5a4634'; x.beginPath(); for (let j = 0; j < 16; j++) { const a = j / 16 * Math.PI * 2, q = j % 2 ? r * 0.72 : r; x.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); } x.closePath(); x.fill(); x.stroke(); x.beginPath(); x.arc(cx, cy, r * 0.32, 0, 7); x.fillStyle = '#fff6e6'; x.fill(); x.stroke(); break;
      case 'check': x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fillStyle = '#6cbf4a'; x.fill(); x.strokeStyle = '#fff'; x.lineWidth = s * 0.1; x.beginPath(); x.moveTo(cx - r * 0.45, cy); x.lineTo(cx - r * 0.1, cy + r * 0.38); x.lineTo(cx + r * 0.5, cy - r * 0.35); x.stroke(); break;
      case 'lock': x.strokeStyle = '#7a6a5a'; x.lineWidth = s * 0.1; x.beginPath(); x.arc(cx, cy - r * 0.15, r * 0.42, Math.PI, 0); x.stroke(); x.fillStyle = '#b8a48c'; x.fillRect(cx - r * 0.65, cy - r * 0.15, r * 1.3, r * 1.0); break;
      case 'chest': x.fillStyle = '#a8703a'; x.strokeStyle = '#5a3a1a'; x.fillRect(cx - r * 0.9, cy - r * 0.4, r * 1.8, r * 1.2); x.strokeRect(cx - r * 0.9, cy - r * 0.4, r * 1.8, r * 1.2); x.fillStyle = '#ffd34a'; x.fillRect(cx - r * 0.15, cy - r * 0.1, r * 0.3, r * 0.35); break;
      case 'bubble': x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fillStyle = 'rgba(160,220,255,0.5)'; x.fill(); x.strokeStyle = '#6aa8d8'; x.stroke(); break;
      case 'tasks': x.fillStyle = '#fff6e6'; x.strokeStyle = '#7a4a26'; x.fillRect(cx - r * 0.7, cy - r * 0.9, r * 1.4, r * 1.8); x.strokeRect(cx - r * 0.7, cy - r * 0.9, r * 1.4, r * 1.8); x.lineWidth = s * 0.06; for (let j = 0; j < 3; j++) { x.beginPath(); x.moveTo(cx - r * 0.4, cy - r * 0.45 + j * r * 0.45); x.lineTo(cx + r * 0.4, cy - r * 0.45 + j * r * 0.45); x.stroke(); } break;
      default: x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fillStyle = '#ccc'; x.fill();
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
  function layout() {
    DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    const si = insets(), pad = 8, top = si.t + 4, bot = H - si.b - 2, left = si.l, right = W - si.r;
    const ordersH = 92, infoH = 52, barH = 66;
    L.landscape = (right - left) >= 700 && (right - left) > (bot - top) * 1.15;
    if (L.landscape) {
      const availB = bot - top - infoH - barH - pad * 3;
      const cs = Math.max(40, Math.min(76, Math.floor(availB / ROWS), Math.floor((right - left) * 0.5 / COLS)));
      const rw = cs * COLS + pad * 2, lw = Math.min(right - left - rw - pad * 3, 600), x0 = left + (right - left - (lw + rw + pad)) / 2;
      const rx = x0 + lw + pad;
      L.col = { x: rx, w: rw };
      L.cs = cs; L.bx = rx + pad; L.by = top + Math.max(0, (availB - cs * ROWS) / 2);
      L.info = { x: rx, y: L.by + cs * ROWS + pad, w: rw, h: infoH };
      L.bar = { x: rx, y: L.info.y + infoH + pad, w: rw, h: barH };
      const sh = Math.max(120, bot - top - ordersH - pad);
      L.scene = { x: x0, y: top, w: lw, h: sh };
      L.orders = { x: x0, y: top + sh + pad, w: lw, h: ordersH };
    } else {
      const cw = Math.min(right - left, 520), x0 = left + (right - left - cw) / 2;
      L.col = { x: x0, w: cw };
      const avail = bot - top - ordersH - infoH - barH - pad * 3;
      let cs = Math.floor((cw - pad * 2) / COLS), sh;
      if (avail - 112 < cs * ROWS) { cs = Math.max(34, Math.floor((avail - 112) / ROWS)); sh = Math.max(70, avail - cs * ROWS); }
      else sh = Math.min(230, avail - cs * ROWS);
      const extra = Math.max(0, avail - sh - cs * ROWS);
      let y = top + extra / 2;
      L.scene = { x: x0 + 6, y, w: cw - 12, h: sh }; y += sh + 2;
      L.orders = { x: x0, y, w: cw, h: ordersH }; y += ordersH + pad;
      L.cs = cs; L.bx = x0 + (cw - cs * COLS) / 2; L.by = y; y += cs * ROWS + pad;
      L.info = { x: x0 + 6, y, w: cw - 12, h: infoH }; y += infoH + pad;
      L.bar = { x: x0, y, w: cw, h: barH };
    }
    L.board = { x: L.bx, y: L.by, w: L.cs * COLS, h: L.cs * ROWS };
    // bar buttons
    const names = ['energy', 'coins', 'stars', 'tasks', 'shop', 'bag'], bw = L.bar.w / names.length;
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
    const b = L.btn && (L.btn[name] || (name === 'xp' ? null : null));
    if (b) return { x: b.x + b.w / 2, y: b.y + 20 };
    if (name === 'xp' && L.scene) return { x: L.scene.x + 28, y: L.scene.y + 28 };
    return { x: W / 2, y: H / 2 };
  }

  // ---- events from the game ----
  const tn = () => performance.now() / 1000;
  function setAnim(i, a) { a.t0 = tn(); anim.set(i, a); animUntil = Math.max(animUntil, performance.now() + (a.dur || 0.4) * 1000 + 60); }
  function ghost(o) { o.t0 = tn() + (o.delay || 0); ghosts.push(o); animUntil = Math.max(animUntil, performance.now() + ((o.delay || 0) + o.dur) * 1000 + 60); }
  function floater(x, y, s, color) { floaters.push({ x, y, s, color: color || INK, t0: tn() }); animUntil = Math.max(animUntil, performance.now() + 1100); }
  function toast(s, dur) { if (toasts.length && toasts[toasts.length - 1].s === s) { toasts[toasts.length - 1].t0 = tn(); return; } toasts.length = 0; toasts.push({ s, t0: tn(), dur: dur || 2.6 }); dirty = true; }
  const nm = (k, l) => CHAINS[k].names[l - 1];

  function rewardFx(r, x, y) {
    if (r.coins) { if (!fx('coins', x, y, Math.min(10, 2 + (r.coins / 15 | 0)))) floater(x, y - 10, '+' + r.coins, '#a8761a'); snd('coins'); }
    if (r.stars) { if (!fx('stars', x, y, r.stars)) floater(x, y - 30, '+' + r.stars + ' ★', '#c08a10'); snd('stars'); }
    if (r.energy) { if (!fx('energy', x, y, Math.min(10, 2 + (r.energy / 8 | 0)))) floater(x, y + 10, '+' + r.energy + ' energiat', '#b07a10'); }
  }

  function ev(kind, cell, d) {
    dirty = true;
    const C = cell >= 0 ? cellCenter(cell) : null;
    switch (kind) {
      case 'merge': {
        setAnim(cell, { pop: 1, dur: 0.34 });
        if (!fx('merge', C.x, C.y, d.k, d.l)) { for (let j = 0; j < 6; j++) floater(C.x + Math.cos(j) * L.cs * 0.4, C.y + Math.sin(j) * L.cs * 0.4, '✦', '#ffcf4a'); }
        snd(d.max ? 'mergeMax' : 'merge', { level: d.l });
        if (d.max) toast(nm(d.k, d.l) + '! Kõrgeim tase!');
        else if (d.isNew) toast('Uus avastus: ' + nm(d.k, d.l) + '!');
        sel = cell; break;
      }
      case 'spawn': {
        const F = cellCenter(d.from), dur = (typeof FX !== 'undefined' && FX && FX.spawnDur) || 0.42;
        if (fx('spawn', F.x, F.y, C.x, C.y, itemImg(d.k, d.l, L.cs * DPR))) setAnim(cell, { hide: dur, dur });
        else setAnim(cell, { fx: F.x, fy: F.y, arc: 1, pop: 1, dur: 0.38 });
        setAnim(d.from, { squash: 1, dur: 0.25 });
        snd('spawn', { level: d.l }); break;
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
        if (!fx(d.kind === 'energy' ? 'energy' : 'coins', C.x, C.y, Math.min(10, 2 + d.n / 8 | 0))) floater(C.x, C.y, '+' + d.n + (d.kind === 'energy' ? ' energiat' : ''), '#a8761a');
        if (sel === cell) sel = -1; break;
      }
      case 'chest': d.cells.forEach((c, j) => setAnim(c, { fx: C.x, fy: C.y, arc: 1, pop: 1, dur: 0.3 + j * 0.06 })); snd('chest'); fx('merge', C.x, C.y, 'chest', 1); sel = -1; break;
      case 'bubble': setAnim(cell, { pop: 1, dur: 0.5 }); snd('bubble'); break;
      case 'bubblePop': setAnim(cell, { pop: 1, dur: 0.34 }); snd('bubblePop'); fx('merge', C.x, C.y, d.k, d.l); break;
      case 'bubbleGone': ghost({ k: d.k, l: d.l, x0: C.x, y0: C.y, x1: C.x, y1: C.y - 20, dur: 0.5, s0: 1, s1: 1.3, fade: 1 }); if (sel === cell) sel = -1; break;
      case 'sell': ghost({ k: d.k, l: d.l, x0: C.x, y0: C.y, x1: C.x, y1: C.y, dur: 0.3, s0: 1, s1: 0.1 }); if (!fx('coins', C.x, C.y, 3)) floater(C.x, C.y, '+' + d.n, '#a8761a'); snd('sell'); sel = -1; break;
      case 'store': { const b = L.btn.bag; ghost({ k: d.k, l: d.l, x0: (dropPt || C).x, y0: (dropPt || C).y, x1: b.x + b.w / 2, y1: b.y + 20, dur: 0.3, s0: 1, s1: 0.3 }); snd('drop'); toast(nm(d.k, d.l) + ' läks kotti.'); sel = -1; break; }
      case 'take': setAnim(cell, { pop: 1, dur: 0.3 }); snd('drop'); sel = cell; break;
      case 'order': {
        const r = cardRects[d.oi], tgt = r ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : { x: W / 2, y: L.orders.y + 40 };
        d.cells.forEach((c, j) => { const P = cellCenter(c), it = d.taken[j]; ghost({ k: it.k, l: it.l, x0: P.x, y0: P.y, x1: tgt.x, y1: tgt.y, dur: 0.45, delay: j * 0.06, s0: 1, s1: 0.5 }); if (sel === c) sel = -1; });
        snd('orderDone');
        setTimeout(() => { rewardFx({ coins: d.o.coins, stars: d.o.stars }, tgt.x, tgt.y); dirty = true; }, 420);
        const V = VILLAGERS[d.o.who]; toast(WHO[d.o.who].name + ': ' + pick(V.thanks), 3.4);
        break;
      }
      case 'newOrder': d.o._t = tn(); animUntil = Math.max(animUntil, performance.now() + 500); if (!onTitle) snd('order'); break;
      case 'levelUp':
        snd('levelUp'); fx('confetti');
        d.cells.forEach(c => setAnim(c, { unlock: 1, dur: 0.8 }));
        openModal({ kind: 'levelup', lvl: d.lvl, cells: d.cells.length }, true); break;
      case 'task': {
        closeModal(true);
        snd('taskDone'); fx('confetti'); flash = { t0: tn() }; animUntil = Math.max(animUntil, performance.now() + 900);
        openModal({ kind: 'dialog', lines: d.t.story, title: d.t.name }, true);
        if (d.newArea) {
          openModal({ kind: 'dialog', lines: d.newArea.intro, title: 'Uus paik: ' + d.newArea.name, onDone: () => boardMusic() }, true);
        }
        if (d.ended) openModal({ kind: 'dialog', lines: [['mina', STORY.ending]], title: 'Lõpp ja uus algus' }, true);
        break;
      }
      case 'reward': if (!d.silent) rewardFx(d, W / 2, H * 0.45); break;
      case 'gift': if (cell >= 0) { setAnim(cell, { pop: 1, dur: 0.5 }); snd('drop'); } if (d.daily) snd('daily'); break;
      case 'toBag': toast('Laud oli täis, kingitus läks kotti.'); break;
      case 'deny':
        snd('deny');
        if (d.need === 'coins') toast('Münte ei ole piisavalt.');
        else if (d.need === 'stars') toast('Tähti on vaja rohkem. Täida tellimusi!');
        else if (d.order !== undefined) toast('Kõik asjad ei ole veel laual.');
        else toast('Seda ei saa müüa.');
        break;
      case 'bagFull': toast('Kott on täis. Poest saab koti juurde osta.'); snd('deny'); break;
      case 'rush': snd('coins'); setAnim(cell, { pop: 1, dur: 0.3 }); break;
      case 'dailyReady': toast('Päevaülesanne tehtud! Auhind ootab kingituse all.'); snd('daily'); break;
      case 'dailyClaim': snd('coins'); break;
      case 'buy': snd('coins'); toast('Ostetud: ' + d.x.name + '!'); break;
      case 'tut': if (d.to === 5) toast(STORY.tutDone, 3.5); break;
    }
  }

  // ---- modals ----
  function openModal(m, queue) {
    m.t0 = tn(); m.i = 0;
    if (modal) { if (queue) mq.push(m); return; }
    modal = m; if (m.kind === 'dialog') storyMusic(); else snd('open'); dirty = true;
  }
  const boardMusic = () => music('board', { area: Math.min(S.area, AREAS.length - 1) });
  function storyMusic() { if (modal && modal.kind === 'dialog' && modal.title) music('story'); }
  function closeModal(silent) {
    const m = modal; modal = null; mhits = [];
    if (m && m.onDone) m.onDone();
    if (!silent && m && m.kind !== 'dialog') snd('close');
    if (mq.length && !modal) { modal = mq.shift(); modal.t0 = tn(); modal.i = 0; if (modal.kind === 'dialog') storyMusic(); }
    if (m && m.kind === 'dialog' && m.title && !(modal && modal.kind === 'dialog') && !onTitle) boardMusic();
    dirty = true;
  }
  const modalActive = () => !!modal || onTitle;

  // ---- input ----
  function pos(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function unlockAudio() {
    if (audioUnlocked) return; audioUnlocked = true;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    const a = au(); try { if (a && a.unlock) a.unlock(); if (a && a.setVolume) { a.setVolume('music', S.set.music); a.setVolume('sfx', S.set.sfx); } if (a && a.setMuted) a.setMuted(!!S.set.muted); } catch (e) {}
  }
  function hitAt(list, p) { for (let j = list.length - 1; j >= 0; j--) { const h = list[j]; if (inR(p, h)) return h; } return null; }

  cv.addEventListener('pointerdown', e => {
    e.preventDefault(); unlockAudio();
    if (ptr) return;
    const p = pos(e);
    ptr = { id: e.pointerId, x0: p.x, y0: p.y, x: p.x, y: p.y, t0: performance.now(), moved: false, touch: e.pointerType !== 'mouse' };
    try { cv.setPointerCapture(e.pointerId); } catch (er) {}
    if (modalActive()) { ptr.zone = 'modal'; const h = hitAt(mhits, p); if (h && h.fn) { pressed = h; dirty = true; } return; }
    const c = cellAt(p.x, p.y);
    if (c >= 0 && S.board[c] && Game.isOpen(c)) {
      ptr.zone = 'cell'; ptr.cell = c;
      ptr.lp = setTimeout(() => { if (ptr && !ptr.moved && ptr.zone === 'cell' && !drag) { ptr.zone = 'done'; const it = S.board[c]; if (it) { sel = c; openChain(it.k, it.l); } } }, 450);
    } else if (inR(p, L.orders)) { ptr.zone = 'orders'; ptr.s0 = ordScroll; }
    else { ptr.zone = 'ui'; const h = hitAt(hits, p); if (h && h.fn) { pressed = h; dirty = true; } }
  });
  cv.addEventListener('pointermove', e => {
    if (!ptr || e.pointerId !== ptr.id) return;
    const p = pos(e); ptr.x = p.x; ptr.y = p.y;
    if (!ptr.moved && Math.hypot(p.x - ptr.x0, p.y - ptr.y0) > (ptr.touch ? 9 : 5)) { ptr.moved = true; clearTimeout(ptr.lp); if (pressed && ptr.zone !== 'ui') pressed = null; }
    if (ptr.zone === 'cell' && ptr.moved && !drag) {
      const it = S.board[ptr.cell];
      if (it && !it.b) { drag = { from: ptr.cell, it, x: p.x, y: p.y, lift: ptr.touch ? L.cs * 0.42 : 0, t0: tn() }; sel = ptr.cell; snd('pick'); }
      else ptr.zone = 'done';
    }
    if (drag) { drag.x = p.x; drag.y = p.y; dirty = true; }
    if (ptr.zone === 'orders' && ptr.moved) { ordScroll = clamp(ptr.s0 - (p.x - ptr.x0), 0, ordMax); dirty = true; }
  });
  function dragTarget() {
    if (!drag) return { cell: -1 };
    const x = drag.x, y = drag.y - drag.lift * 0.75;
    if (inR({ x: drag.x, y: drag.y }, L.btn.bag)) return { cell: -1, bag: true };
    const c = cellAt(x, y);
    return { cell: c >= 0 && Game.isOpen(c) ? c : -1 };
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
    if (drag) { endDrag(cancel); return; }
    if (cancel || p.moved || p.zone === 'done') return;
    const q = { x: p.x, y: p.y };
    if (p.zone === 'modal') return modalTap(q);
    if (p.zone === 'cell') return tapCell(p.cell);
    if (p.zone === 'orders') { const h = hitAt(hits, q); if (h && h.fn) h.fn(); return; }
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
    if (kind === 'item') { if (sel === c) openChain(it.k, it.l); else { sel = c; snd('tap'); } return; }
    sel = c;
    Game.tapItem(c);
  }
  function modalTap(q) {
    if (onTitle) { const h = hitAt(mhits, q); if (h && h.fn) h.fn(); else start(); return; }
    const m = modal; if (!m) return;
    const h = hitAt(mhits, q);
    if (h) { if (h.fn) h.fn(); return; }
    if (m.kind === 'dialog') return dialogNext();
    if (m.panel && !inR(q, m.panel) && m.kind !== 'levelup') closeModal();
  }
  function dialogNext() {
    const m = modal, line = m.lines[m.i], shown = (tn() - m.t0) * 48;
    if (shown < line[1].length) { m.t0 = -1e9; dirty = true; return; }
    m.i++; m.t0 = tn();
    m.said = 0;
    if (m.i >= m.lines.length) closeModal(true);
    dirty = true;
  }
  function openChain(k, l) { openModal({ kind: 'chain', k, l }); }

  // ---- screens: start ----
  function start() {
    if (!onTitle) return;
    onTitle = false; S.title = false; dirty = true; snd('tap');
    boardMusic();
    if (S.tut === 0) {
      openModal({ kind: 'dialog', lines: AREAS[0].intro, title: 'Kiri vanaemalt', onDone: () => { S.tut = 1; S.nextOrderAt = 0; saveSoon(); } });
    } else if (S.tut >= 5) {
      Game.ensureDaily(); if (!S.daily.gift) openModal({ kind: 'daily' });
    }
  }

  // ---- drawing: scene strip ----
  function drawScene(t) {
    const r = L.scene, area = Game.curArea();
    const n = Object.keys(S.done).length; if (n !== progressN) { progressN = n; progressSet = new Set(Object.keys(S.done)); }
    g.save(); rr(r.x, r.y, r.w, r.h, 16); g.clip();
    let drawn = false;
    if (artOn('scene')) { try { ART.scene(g, area.key, progressSet, r.x, r.y, r.w, r.h, t); drawn = true; } catch (e) {} }
    if (!drawn) phScene(area, r, t);
    if (flash) { const k = (tn() - flash.t0) / 0.9; if (k < 1) { g.fillStyle = 'rgba(255,240,200,' + (0.6 * (1 - k)) + ')'; g.fillRect(r.x, r.y, r.w, r.h); } else flash = null; }
    g.restore();
    g.lineWidth = 2; g.strokeStyle = 'rgba(122,74,38,0.5)'; rr(r.x + 1, r.y + 1, r.w - 2, r.h - 2, 16); g.stroke();
    // area ribbon
    const done = area.tasks.filter(x => S.done[x.id]).length, label = area.name + '  ' + done + '/' + area.tasks.length;
    g.font = font(14, 800); const lw = Math.min(r.w - 120, g.measureText(label).width + 30);
    panel(r.x + (r.w - lw) / 2, r.y + 6, lw, 28, 'ribbon'); text(label, r.x + r.w / 2, r.y + 21, 14, '#fff', 'center', 800, lw - 14);
    hits.push({ x: r.x + 50, y: r.y + 40, w: r.w - 100, h: r.h - 40, fn: () => openModal({ kind: 'tasks' }) });
    // level badge with XP ring
    const bx = r.x + 28, by = r.y + 28, need = Game.xpNeed(S.lvl);
    g.fillStyle = PAPER; g.beginPath(); g.arc(bx, by, 20, 0, 7); g.fill();
    g.lineWidth = 4; g.strokeStyle = '#e4d3bb'; g.beginPath(); g.arc(bx, by, 18, 0, 7); g.stroke();
    g.strokeStyle = '#5aa0d8'; g.beginPath(); g.arc(bx, by, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(S.xp / need, 0, 1)); g.stroke();
    text(String(S.lvl), bx, by + 1, 16, INK, 'center', 800);
    hits.push({ x: r.x, y: r.y, w: 52, h: 52, fn: () => { toast('Tase ' + S.lvl + ': kogemust ' + S.xp + '/' + need + '. Täida tellimusi!'); snd('tap'); } });
    // gift and settings
    const giftOn = !S.daily.gift || S.daily.tasks.some(x => x.n >= x.goal && !x.claimed) || (!S.daily.bonus && S.daily.tasks.length && S.daily.tasks.every(x => x.claimed));
    const gx = r.x + r.w - 92, sx = r.x + r.w - 46, s = 30 + (giftOn && S.tut >= 5 ? Math.sin(t * 5) * 2.5 : 0);
    g.fillStyle = 'rgba(255,246,230,0.85)'; g.beginPath(); g.arc(gx + 22, r.y + 26, 20, 0, 7); g.fill(); g.beginPath(); g.arc(sx + 22, r.y + 26, 20, 0, 7); g.fill();
    drawIcon('gift', gx + 22 - s / 2, r.y + 26 - s / 2, s); drawIcon('settings', sx + 7, r.y + 11, 30);
    if (giftOn && S.tut >= 5) dot(gx + 38, r.y + 10);
    hits.push({ x: gx, y: r.y, w: 44, h: 50, fn: () => openModal({ kind: 'daily' }) });
    hits.push({ x: sx, y: r.y, w: 46, h: 50, fn: () => openModal({ kind: 'settings' }) });
  }
  function dot(x, y) { g.fillStyle = '#e84a3a'; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke(); }
  const SKY = { bakery: ['#bfe3f2', '#fbe9d0'], garden: ['#cdeccf', '#f5f0d0'], harbour: ['#a9d6ef', '#e6f2f2'], windmill: ['#f7d9b8', '#fbeede'], lighthouse: ['#9db8e0', '#e8dff0'], secret: ['#d9c2e8', '#fbe9d0'] };
  function phScene(area, r, t) {
    const sky = SKY[area.key] || SKY.bakery, gr = g.createLinearGradient(0, r.y, 0, r.y + r.h);
    gr.addColorStop(0, sky[0]); gr.addColorStop(1, sky[1]); g.fillStyle = gr; g.fillRect(r.x, r.y, r.w, r.h);
    const sea = r.y + r.h * 0.62;
    g.fillStyle = '#7fb8d8'; g.fillRect(r.x, sea, r.w, r.h);
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2;
    for (let j = 0; j < 4; j++) { g.beginPath(); const yy = sea + 8 + j * 9; for (let x = r.x; x < r.x + r.w; x += 6) g.lineTo(x, yy + Math.sin(x * 0.05 + t * 1.5 + j) * 2); g.stroke(); }
    g.fillStyle = '#9cc46a'; g.beginPath(); g.ellipse(r.x + r.w * 0.5, sea + 10, r.w * 0.42, r.h * 0.22, 0, Math.PI, 0); g.fill();
    const ts = area.tasks, done = ts.filter(x => S.done[x.id]).length, k = done / ts.length;
    const hx = r.x + r.w * 0.5, hw = Math.min(r.w * 0.28, 120), hh = Math.min(r.h * 0.38, 70), hy = sea - hh + 4;
    const body = area.key === 'lighthouse' ? '#f2f2f2' : area.key === 'windmill' ? '#d9c4a0' : '#e8c79a';
    g.fillStyle = k > 0.3 ? body : '#b9a58a'; g.fillRect(hx - hw / 2, hy, hw, hh);
    g.fillStyle = k > 0.6 ? '#c0503c' : '#7a6a5a'; g.beginPath(); g.moveTo(hx - hw / 2 - 8, hy); g.lineTo(hx, hy - hh * 0.6); g.lineTo(hx + hw / 2 + 8, hy); g.fill();
    g.fillStyle = '#7a4a26'; g.fillRect(hx - 8, hy + hh - 24, 16, 24);
    for (let j = 0; j < 2; j++) { g.fillStyle = k > 0.15 * (j + 1) ? '#ffe9a0' : '#5a5048'; g.fillRect(hx - hw / 2 + 10 + j * (hw - 34), hy + 12, 14, 12); }
    if (area.key === 'windmill') { g.save(); g.translate(hx, hy - hh * 0.35); g.rotate(k > 0.3 ? t * 0.8 : 0.3); g.fillStyle = '#fff6e6'; for (let j = 0; j < 4; j++) { g.rotate(Math.PI / 2); g.fillRect(-4, 0, 8, hh * 0.8); } g.restore(); }
    if (area.key === 'lighthouse' && k > 0.8) { g.fillStyle = 'rgba(255,240,150,0.35)'; g.beginPath(); g.moveTo(hx, hy - hh * 0.5); g.lineTo(hx + r.w * 0.5 * Math.cos(t * 0.6), hy - hh * 0.5 - 30); g.lineTo(hx + r.w * 0.5 * Math.cos(t * 0.6), hy - hh * 0.5 + 30); g.fill(); }
    for (let j = 0; j < done; j++) { const fx2 = r.x + r.w * (0.12 + 0.76 * (j + 0.5) / ts.length); g.fillStyle = ['#e8605a', '#ffd34a', '#b07ec8', '#fff'][j % 4]; g.beginPath(); g.arc(fx2, sea + 2 + Math.sin(j * 2.1) * 4, 4, 0, 7); g.fill(); }
    if (!ts.every(x => S.done[x.id])) for (let j = done; j < ts.length; j++) { const fx2 = r.x + r.w * (0.12 + 0.76 * (j + 0.5) / ts.length); g.fillStyle = 'rgba(90,70,50,0.35)'; g.fillRect(fx2 - 3, sea - 4, 6, 6); }
  }

  // ---- drawing: orders ----
  function cardW(o) { return Math.max(112, 16 + o.items.length * 42); }
  function drawOrders(t) {
    const r = L.orders; cardRects = [];
    let total = 0; for (const o of S.orders) total += cardW(o) + 8;
    ordMax = Math.max(0, total - 8 - (r.w - 12)); ordScroll = clamp(ordScroll, 0, ordMax);
    g.save(); g.beginPath(); g.rect(r.x, r.y - 4, r.w, r.h + 8); g.clip();
    let x = r.x + 6 - ordScroll + (total - 8 < r.w - 12 ? (r.w - 12 - (total - 8)) / 2 : 0);
    if (!S.orders.length) text(S.tut === 0 ? '' : 'Külaelanikud mõtlevad, mida tellida…', r.x + r.w / 2, r.y + r.h / 2, 14, INK2, 'center', 600);
    S.orders.forEach((o, oi) => {
      const w = cardW(o), h = r.h - 6, st = Game.orderStatus(o);
      const ap = o._t ? clamp((tn() - o._t) / 0.4, 0, 1) : 1, yy = r.y + 2 + (1 - ease.outBack(ap)) * 30;
      g.globalAlpha = ap;
      const pulse = st.ready ? 1 + Math.sin(t * 6) * 0.02 : 1;
      g.save(); g.translate(x + w / 2, yy + h / 2); g.scale(pulse, pulse); g.translate(-x - w / 2, -yy - h / 2);
      panel(x, yy, w, h, st.ready ? 'buttonHot' : 'paper');
      drawPortrait(o.who, x + 6, yy + 5, 32);
      if (st.ready) text('Anna!', x + w - 8, yy + 21, 15, '#fff', 'right', 800);
      else {
        g.font = font(12, 800); let rx = x + w - 8; const rs = String(o.coins);
        text(rs, rx, yy + 21, 12, INK, 'right', 800); rx -= g.measureText(rs).width + 16; drawIcon('coin', rx, yy + 14, 14);
        if (o.stars) { rx -= 4; const ss = String(o.stars); text(ss, rx, yy + 21, 12, INK, 'right', 800); rx -= g.measureText(ss).width + 16; drawIcon('star', rx, yy + 13, 15); }
      }
      o.items.forEach(([k, l], j) => {
        const ix = x + 8 + j * 42, iy = yy + 42;
        g.fillStyle = st.have[j] ? 'rgba(255,255,255,0.65)' : 'rgba(120,80,40,0.10)'; rr(ix, iy, 38, 38, 9); g.fill();
        drawItem(k, l, ix + 19, iy + 19, 34);
        if (st.have[j]) drawIcon('check', ix + 24, iy - 2, 17);
      });
      g.restore(); g.globalAlpha = 1;
      cardRects[oi] = { x, y: yy, w, h };
      hits.push({ x, y: yy, w, h, fn: () => {
        if (st.ready) Game.fulfill(oi);
        else { snd('tap'); toast(WHO[o.who].name + ' soovib: ' + o.items.map(([k, l]) => nm(k, l)).join(', ') + '.'); }
      } });
      x += w + 8;
    });
    g.restore();
    if (ordMax > 0) { g.fillStyle = 'rgba(90,58,34,0.25)'; const bw = r.w * (r.w / (r.w + ordMax)); rr(r.x + 6 + (r.w - 12 - bw) * (ordScroll / ordMax), r.y + r.h - 1, bw, 3, 2); g.fill(); }
  }

  // ---- drawing: board ----
  function itemDrawState(i, t) {
    const a = anim.get(i), C = cellCenter(i); let x = C.x, y = C.y, s = 1, hide = false;
    if (a) {
      const k = clamp((t - a.t0) / a.dur, 0, 1);
      if (a.hide) hide = k < 1;
      if (a.fx !== undefined) { const e = ease.outCubic(k); x = lerp(a.fx, C.x, e); y = lerp(a.fy, C.y, e); if (a.arc) y -= Math.sin(k * Math.PI) * L.cs * 0.6; }
      if (a.pop) s = k < 1 ? 0.55 + 0.45 * ease.outBack(k) : 1;
      if (a.squash) { const q = Math.sin(k * Math.PI); s = 1 + q * 0.12; }
      if (k >= 1) anim.delete(i);
    }
    return { x, y, s, hide };
  }
  function drawCell(x, y, s, state) {
    if (artOn('cell')) { try { ART.cell(g, x, y, s, state); return; } catch (e) {} }
    const p = 2;
    if (state === 'locked') { g.fillStyle = 'rgba(110,80,50,0.28)'; rr(x + p, y + p, s - p * 2, s - p * 2, 8); g.fill(); return; }
    g.fillStyle = state === 'target' ? 'rgba(130,210,100,0.75)' : state === 'hint' ? 'rgba(255,230,140,0.75)' : ((Math.floor(x / s) + Math.floor(y / s)) % 2 ? 'rgba(255,248,232,0.82)' : 'rgba(255,241,216,0.82)');
    rr(x + p, y + p, s - p * 2, s - p * 2, 8); g.fill();
  }
  function drawBoard(t) {
    const cs = L.cs, b = L.board;
    if (!artOn('cell')) { panel(b.x - 6, b.y - 6, b.w + 12, b.h + 12, 'wood'); }
    const tg = drag ? dragTarget() : null, dk = drag ? drag.it : null;
    for (let i = 0; i < NCELL; i++) {
      const c = i % COLS, r = (i / COLS) | 0, x = L.bx + c * cs, y = L.by + r * cs, it = S.board[i];
      let state = Game.isOpen(i) ? 'empty' : 'locked';
      if (dk && i !== drag.from && it && Game.canMerge(dk, it)) state = tg && tg.cell === i ? 'target' : 'hint';
      else if (tg && tg.cell === i && i !== drag.from) state = 'hint';
      drawCell(x, y, cs, state);
      if (state === 'locked') {
        const a = anim.get(i);
        if (!a) { g.globalAlpha = 0.55; drawIcon('lock', x + cs * 0.3, y + cs * 0.22, cs * 0.4); g.globalAlpha = 1; text(String(Game.unlockLevel(i)), x + cs / 2, y + cs * 0.8, Math.round(cs * 0.24), '#7a6a5a', 'center', 800); }
      }
    }
    // unlock shimmer
    for (const [i, a] of anim) if (a.unlock) { const k = clamp((t - a.t0) / a.dur, 0, 1), C = cellCenter(i); g.fillStyle = 'rgba(255,240,170,' + (1 - k) * 0.8 + ')'; g.beginPath(); g.arc(C.x, C.y, cs * 0.5 * (0.5 + k), 0, 7); g.fill(); if (k >= 1) anim.delete(i); }
    // selection ring
    if (sel >= 0 && S.board[sel] && !(drag && drag.from === sel)) {
      const C = cellCenter(sel), q = 1 + Math.sin(t * 5) * 0.04;
      g.lineWidth = 3; g.strokeStyle = '#ffb03a'; rr(C.x - cs * 0.47 * q, C.y - cs * 0.47 * q, cs * 0.94 * q, cs * 0.94 * q, 10); g.stroke();
    }
    const isz = cs * 0.9;
    for (let i = 0; i < NCELL; i++) {
      const it = S.board[i]; if (!it || (drag && drag.from === i)) continue;
      const d = itemDrawState(i, t); if (d.hide) continue;
      const kind = CHAINS[it.k].kind;
      if (it.b) {
        const left = (it.b - now()) / 60000, wob = 1 + Math.sin(t * 3 + i) * 0.03;
        drawItem(it.k, it.l, d.x, d.y, isz * 0.78 * d.s, 0.75);
        g.fillStyle = 'rgba(170,225,255,0.28)'; g.beginPath(); g.arc(d.x, d.y, cs * 0.44 * wob * d.s, 0, 7); g.fill();
        g.lineWidth = 2; g.strokeStyle = 'rgba(110,170,220,0.9)'; g.stroke();
        g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.beginPath(); g.arc(d.x, d.y, cs * 0.44 * wob, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(left, 0, 1)); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(d.x - cs * 0.17, d.y - cs * 0.2, cs * 0.09, cs * 0.05, -0.6, 0, 7); g.fill();
        continue;
      }
      let sx = d.s, sy = d.s;
      const a = anim.get(i); if (a && a.squash) { sy = 2 - d.s; }
      g.save(); g.translate(d.x, d.y); g.scale(sx, sy);
      drawItem(it.k, it.l, 0, 0, isz);
      g.restore();
      if (kind === 'gen') genBadge(it, i, d.x, d.y, t);
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
      const bw = cs * 0.62, bh = Math.max(5, cs * 0.1), bx = x - bw / 2, by = y + cs * 0.34;
      g.fillStyle = 'rgba(70,40,20,0.45)'; rr(bx, by, bw, bh, bh / 2); g.fill();
      g.fillStyle = '#ffd23a'; rr(bx, by, bw * (it.ch / mx), bh, bh / 2); g.fill();
    } else {
      const left = Math.max(0, it.cd - now()), tot = GEN_LV[it.l - 1][1] * 1000;
      g.fillStyle = 'rgba(60,40,30,0.45)'; g.beginPath(); g.arc(x, y, cs * 0.44, 0, 7); g.fill();
      g.strokeStyle = '#ffd23a'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, cs * 0.4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - left / tot)); g.stroke();
      text(fmtTime(left), x, y, Math.round(cs * 0.24), '#fff', 'center', 800);
    }
    if (S.en < 1 && it.ch > 0) { g.globalAlpha = 0.85; drawIcon('energy', x + cs * 0.16, y - cs * 0.46, cs * 0.3); g.globalAlpha = 1; }
  }

  // ---- drawing: info bar ----
  function drawInfo(t) {
    const r = L.info, it = sel >= 0 ? S.board[sel] : null;
    panel(r.x, r.y, r.w, r.h, 'paper');
    const tutTxt = S.tut >= 1 && S.tut <= 4 ? STORY['tut' + S.tut] : null;
    if (!it) {
      if (tutTxt) { const ls = wrap(tutTxt, r.w - 24, 15, 800); ls.slice(0, 2).forEach((s, j) => text(s, r.x + r.w / 2, r.y + r.h / 2 + (j - (Math.min(2, ls.length) - 1) / 2) * 18, 15, '#a0502a', 'center', 800, r.w - 20)); return; }
      const nt = Game.nextTask();
      const s1 = nt ? 'Järgmine ülesanne: ' + nt.name : S.ended ? 'Kõik on taastatud! Küpseta edasi.' : '';
      const s2 = nt ? (S.stars >= nt.cost ? 'Tähti on piisavalt! Ava „Ülesanded“.' : 'Vaja ' + nt.cost + ' tähte, sul on ' + S.stars + '.') : 'Lohista ühesugused asjad kokku.';
      text(s1, r.x + r.w / 2, r.y + 18, 14, INK, 'center', 800, r.w - 20);
      text(s2, r.x + r.w / 2, r.y + 37, 13, nt && S.stars >= nt.cost ? '#4f8d34' : INK2, 'center', 700, r.w - 20);
      return;
    }
    const C = CHAINS[it.k], kind = C.kind, mx = C.names.length;
    drawItem(it.k, it.l, r.x + 28, r.y + r.h / 2, 40);
    let l1 = nm(it.k, it.l) + (kind === 'gen' ? '' : '') , l2 = '';
    const nb = [];
    if (it.b) {
      l1 = 'Mull: ' + l1; l2 = 'Ava mündiga, muidu kaob ' + Math.max(0, Math.ceil((it.b - now()) / 1000)) + ' s pärast';
      const p = Game.bubblePrice(it); nb.push({ label: String(p), icon: 'coin', fn: () => Game.popBubble(sel), hot: S.coins >= p });
    } else if (kind === 'gen') {
      l1 += ' · tase ' + it.l + '/' + mx;
      if (it.ch > 0) l2 = (S.tut === 1 ? 'Puuduta, et küpsetada · ' : 'Puuduta! · ') + 'laengud ' + it.ch + '/' + GEN_LV[it.l - 1][0];
      else { l2 = 'Puhkab ' + fmtTime(it.cd - now()) + ' · kiirusta mündiga'; const p = Game.rushPrice(it); nb.push({ label: String(p), icon: 'coin', fn: () => Game.rushGen(sel), hot: S.coins >= p }); }
      nb.push({ label: 'Ahel', fn: () => openChain(it.k, it.l) });
    } else if (kind === 'energy' || kind === 'coin') {
      l2 = 'Puuduta, et korjata: +' + C.value[it.l - 1] + (kind === 'energy' ? ' energiat' : ' münti');
      nb.push({ label: 'Ahel', fn: () => openChain(it.k, it.l) });
    } else if (kind === 'chest') {
      l2 = 'Puuduta, et avada: ' + C.value[it.l - 1] + ' asja';
      nb.push({ label: '+' + Game.sellPrice(it), icon: 'coin', fn: () => Game.sell(sel) });
    } else {
      l1 += ' · ' + it.l + '/' + mx;
      l2 = it.l < mx ? 'Järgmine: ' + nm(it.k, it.l + 1) : 'Kõrgeim tase!';
      nb.push({ label: 'Ahel', fn: () => openChain(it.k, it.l) });
      nb.push({ label: 'Müü +' + Game.sellPrice(it), fn: () => Game.sell(sel) });
    }
    const bws = nb.map(b => b.label.startsWith('Müü') ? 92 : b.icon ? 74 : 64), tw = bws.reduce((a, b) => a + b + 6, 0);
    const tx = r.x + 54, maxT = r.w - 58 - tw;
    text(l1, tx, r.y + 18, 15, INK, 'left', 800, maxT);
    text(l2, tx, r.y + 37, 13, INK2, 'left', 700, maxT);
    let bx = r.x + r.w - 5;
    nb.slice().reverse().forEach((b, j) => { const w = bws[nb.length - 1 - j]; bx -= w; button(bx, r.y + 5, w, r.h - 10, b.label, b.fn, { icon: b.icon, hot: b.hot, size: 14 }); bx -= 6; });
  }

  // ---- drawing: bottom bar ----
  function drawBar(t) {
    const r = L.bar; panel(r.x + 4, r.y, r.w - 8, r.h, 'wood');
    const nt = Game.nextTask(), canTask = nt && S.stars >= nt.cost;
    const items = [
      ['energy', 'energy', fmtNum(S.en), S.en < MAXEN ? '+1 ' + fmtTime(Game.enNext()) : 'täis', () => openModal({ kind: 'energy' })],
      ['coins', 'coin', fmtNum(S.coins), 'mündid', () => openModal({ kind: 'shop' })],
      ['stars', 'star', fmtNum(S.stars), 'tähed', () => openModal({ kind: 'tasks' })],
      ['tasks', 'tasks', 'Ülesanded', null, () => openModal({ kind: 'tasks' })],
      ['shop', 'shop', 'Pood', null, () => openModal({ kind: 'shop' })],
      ['bag', 'bag', 'Kott', S.bag.length + '/' + S.bagSlots, () => openModal({ kind: 'bag' })],
    ];
    const dragBag = drag && dragTarget().bag;
    for (const [id, ic, main, sub, fn] of items) {
      const b = L.btn[id], cx = b.x + b.w / 2, press = pressed && pressed.x === b.x && pressed.y === b.y;
      if ((id === 'bag' && dragBag)) { g.fillStyle = 'rgba(255,230,140,0.55)'; rr(b.x + 6, b.y + 4, b.w - 12, b.h - 8, 10); g.fill(); }
      const hot = id === 'tasks' && canTask && (S.tut >= 4 || S.tut === 0);
      const bounce = hot ? Math.abs(Math.sin(t * 4)) * 3 : 0, isz = press ? 24 : 28;
      drawIcon(ic, cx - isz / 2, b.y + 6 - bounce + (28 - isz) / 2, isz);
      if (hot) dot(cx + 14, b.y + 8);
      const big = sub !== null && id !== 'bag';
      text(main, cx, b.y + (big ? 43 : 46), big ? 15 : 12, '#fff6e6', 'center', 800, b.w - 6);
      if (sub) text(sub, cx, b.y + (big ? 57 : 59), 10, '#f3dcb8', 'center', 700, b.w - 4);
      hits.push({ x: b.x, y: b.y, w: b.w, h: b.h, fn: () => { snd('tap'); fn(); } });
    }
  }

  // ---- drawing: tutorial pointer ----
  function drawHand(x, y, t, press) {
    const k = press ? 0.85 + 0.15 * Math.abs(Math.sin(t * 4)) : 1;
    g.save(); g.translate(x, y);
    g.strokeStyle = 'rgba(255,255,255,' + (0.4 + 0.4 * Math.sin(t * 4)) + ')'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 22 + 6 * Math.sin(t * 4), 0, 7); g.stroke();
    g.scale(k, k); g.rotate(-0.35);
    g.fillStyle = '#fff'; g.strokeStyle = INK; g.lineWidth = 2.5;
    rr(-6, 0, 12, 26, 6); g.fill(); g.stroke();
    rr(-11, 16, 24, 24, 9); g.fill(); g.stroke();
    g.restore();
  }
  function drawTutorial(t) {
    if (modal || onTitle || drag) return;
    const find = (k, l) => { const out = []; S.board.forEach((it, i) => { if (it && !it.b && it.k === k && it.l === l) out.push(i); }); return out; };
    if (S.tut === 1) { const o = find('oven', 1).concat(find('oven', 2)); if (o.length) { const C = cellCenter(o[0]); drawHand(C.x + 6, C.y + 8, t, true); } }
    else if (S.tut === 2) {
      const b = find('bread', 1); if (b.length >= 2) {
        const A = cellCenter(b[0]), B = cellCenter(b[1]), k = (t * 0.6) % 1, e = ease.inOutSine(clamp(k * 1.4, 0, 1));
        drawItem('bread', 1, lerp(A.x, B.x, e), lerp(A.y, B.y, e) - 6, L.cs * 0.8, 0.5);
        drawHand(lerp(A.x, B.x, e) + 6, lerp(A.y, B.y, e) + 8, t, false);
      }
    } else if (S.tut === 3) { const r = cardRects[S.orders.findIndex(o => Game.orderStatus(o).ready)]; if (r) drawHand(r.x + r.w - 26, r.y + r.h - 20, t, true); }
    else if (S.tut === 4 && !S.done.b1) { const b = L.btn.tasks; drawHand(b.x + b.w / 2 + 4, b.y + 18, t, true); }
  }

  // ---- drawing: modals ----
  function dim(a) { g.fillStyle = 'rgba(50,30,15,' + (a || 0.45) + ')'; g.fillRect(0, 0, W, H); }
  function modalPanel(m, w, h, title) {
    w = Math.min(w, W - 16); h = Math.min(h, H - 16);
    const x = Math.round((W - w) / 2), y = Math.round(Math.max(8, (H - h) / 2));
    const k = clamp((tn() - m.t0) / 0.22, 0, 1), s = 0.9 + 0.1 * ease.outBack(k);
    g.translate(W / 2, y + h / 2); g.scale(s, s); g.translate(-W / 2, -y - h / 2);
    panel(x, y, w, h, 'paper');
    if (title) { g.font = font(17, 800); const tw = Math.min(w - 90, g.measureText(title).width + 40); panel(x + (w - tw) / 2, y - 12, tw, 34, 'ribbon'); text(title, x + w / 2, y + 5, 17, '#fff', 'center', 800, tw - 16); }
    m.panel = { x, y, w, h };
    // close button
    const cx = x + w - 46, cy = y + 2;
    mhits.push({ x: cx, y: cy, w: 44, h: 44, fn: () => closeModal() });
    g.strokeStyle = INK2; g.lineWidth = 3; g.beginPath(); g.moveTo(cx + 16, cy + 16); g.lineTo(cx + 28, cy + 28); g.moveTo(cx + 28, cy + 16); g.lineTo(cx + 16, cy + 28); g.stroke();
    return { x, y, w, h };
  }
  function drawModal(t) {
    mhits = [];
    const m = modal; if (!m) return;
    g.save();
    if (m.kind === 'dialog') { drawDialog(m, t); g.restore(); return; }
    dim(); const B = { modal: true };
    if (m.kind === 'tasks') {
      const area = Game.curArea(), ts = area.tasks, P = modalPanel(m, 400, 120 + ts.length * 54 + 40, area.name);
      const done = ts.filter(x => S.done[x.id]).length;
      drawIcon('star', P.x + 18, P.y + 32, 22); text(String(S.stars), P.x + 46, P.y + 44, 17, INK, 'left', 800);
      text(done + '/' + ts.length + ' tehtud', P.x + P.w - 56, P.y + 44, 13, INK2, 'right', 700);
      const nt = Game.nextTask();
      ts.forEach((tk, j) => {
        const y = P.y + 66 + j * 54, isDone = S.done[tk.id], isNext = nt === tk;
        g.fillStyle = isNext ? 'rgba(255,214,120,0.35)' : 'rgba(120,80,40,0.06)'; rr(P.x + 10, y, P.w - 20, 48, 10); g.fill();
        if (isDone) drawIcon('check', P.x + 18, y + 12, 24); else if (!isNext) { g.globalAlpha = 0.6; drawIcon('lock', P.x + 18, y + 12, 24); g.globalAlpha = 1; } else drawIcon('star', P.x + 18, y + 12, 24);
        text(tk.name, P.x + 50, y + 24, 14, isDone ? INK2 : INK, 'left', isDone ? 600 : 800, P.w - (isNext ? 170 : 70));
        if (isNext) m.nextBtn = { x: P.x + P.w - 104, y: y + 4, w: 92, h: 40 };
        if (isNext) button(P.x + P.w - 104, y + 4, 92, 40, String(tk.cost), () => Game.doTask(tk.id), Object.assign({ icon: 'star', hot: S.stars >= tk.cost, offFn: () => Game.doTask(tk.id) }, B));
        else if (!isDone) { drawIcon('star', P.x + P.w - 48, y + 15, 18); text(String(tk.cost), P.x + P.w - 22, y + 24, 14, INK2, 'center', 800); }
      });
      const na = AREAS[S.area + 1] || (S.ended ? null : null);
      const foot = S.ended ? STORY.ending : na ? 'Järgmine paik: ' + na.name : 'Viimane paik!';
      text(foot, P.x + P.w / 2, P.y + P.h - 22, 13, INK2, 'center', 700, P.w - 24);
    } else if (m.kind === 'shop') {
      const list = Game.shopList(), cols = 2, rows = Math.ceil(list.length / cols), cw = 0;
      void cw;
      const P = modalPanel(m, 400, 90 + rows * 92, 'Pood');
      drawIcon('coin', P.x + 18, P.y + 32, 22); text(fmtNum(S.coins), P.x + 46, P.y + 44, 17, INK, 'left', 800);
      const cW = (P.w - 30) / cols;
      list.forEach((x, j) => {
        const c = j % cols, r = (j / cols) | 0, bx = P.x + 10 + c * (cW + 10), by = P.y + 66 + r * 92;
        g.fillStyle = 'rgba(120,80,40,0.07)'; rr(bx, by, cW, 84, 12); g.fill();
        if (x.icon) drawItem(x.icon[0], x.icon[1], bx + 28, by + 26, 40); else drawIcon('bag', bx + 10, by + 8, 36);
        text(x.name, bx + 52, by + 18, 13, INK, 'left', 800, cW - 56);
        text(x.desc, bx + 52, by + 35, 11, INK2, 'left', 600, cW - 56);
        if (x.soldOut) text('Välja müüdud', bx + cW / 2, by + 66, 12, INK2, 'center', 700);
        else button(bx + 8, by + 48, cW - 16, 32, String(x.price), () => Game.buy(x.id), Object.assign({ icon: 'coin', hot: S.coins >= x.price, off: S.coins < x.price, offFn: () => Game.buy(x.id), size: 14 }, B));
      });
    } else if (m.kind === 'bag') {
      const cols = 4, rows = Math.ceil(S.bagSlots / cols), P = modalPanel(m, 360, 130 + rows * 74, 'Kott');
      const cs = Math.min(70, (P.w - 30) / cols - 6), x0 = P.x + (P.w - cols * (cs + 6) + 6) / 2;
      for (let j = 0; j < Math.max(S.bagSlots, S.bag.length); j++) {
        const x = x0 + (j % cols) * (cs + 6), y = P.y + 40 + ((j / cols) | 0) * (cs + 6), it = S.bag[j];
        g.fillStyle = 'rgba(120,80,40,0.10)'; rr(x, y, cs, cs, 10); g.fill();
        if (it) { drawItem(it.k, it.l, x + cs / 2, y + cs / 2, cs * 0.86); mhits.push({ x, y, w: cs, h: cs, fn: () => { Game.take(j); } }); }
      }
      text('Lohista asi koti nupule, et see kotti panna.', P.x + P.w / 2, P.y + P.h - 44, 12, INK2, 'center', 600, P.w - 20);
      text('Puuduta asja, et see lauale tagasi tuua.', P.x + P.w / 2, P.y + P.h - 24, 12, INK2, 'center', 600, P.w - 20);
    } else if (m.kind === 'daily') {
      Game.ensureDaily();
      const D = S.daily, P = modalPanel(m, 400, 400, 'Päev');
      const gr = Game.giftReward();
      g.fillStyle = 'rgba(255,214,120,0.3)'; rr(P.x + 10, P.y + 32, P.w - 20, 84, 12); g.fill();
      drawIcon('gift', P.x + 20, P.y + 46, 48);
      text('Päeva kingitus', P.x + 80, P.y + 54, 16, INK, 'left', 800);
      const gl = D.gift ? ['Homme ootab uus kingitus!'] : [gr.streak + '. päev järjest:', gr.coins + ' münti, ' + gr.energy + ' energiat' + (gr.chest ? ', kirst' : '')];
      gl.forEach((s, j) => text(s, P.x + 80, P.y + 76 + j * 16, 12, INK2, 'left', 600, P.w - (D.gift ? 100 : 196)));
      if (!D.gift) button(P.x + P.w - 104, P.y + 52, 88, 42, 'Võta!', () => Game.claimGift(), Object.assign({ hot: true }, B));
      text('Päevaülesanded', P.x + P.w / 2, P.y + 138, 15, INK, 'center', 800);
      D.tasks.forEach((tk, j) => {
        const y = P.y + 156 + j * 58, def = DAILY_POOL.find(x => x.id === tk.id);
        g.fillStyle = 'rgba(120,80,40,0.07)'; rr(P.x + 10, y, P.w - 20, 52, 10); g.fill();
        text(def.text.replace('{n}', tk.goal), P.x + 20, y + 17, 13, INK, 'left', 800, P.w - 130);
        const bw = P.w - 160; g.fillStyle = 'rgba(90,58,34,0.15)'; rr(P.x + 20, y + 32, bw, 10, 5); g.fill();
        g.fillStyle = '#86c95e'; rr(P.x + 20, y + 32, bw * tk.n / tk.goal, 10, 5); g.fill();
        text(tk.n + '/' + tk.goal, P.x + 20 + bw + 4, y + 37, 10, INK2, 'left', 700, 34);
        if (tk.claimed) drawIcon('check', P.x + P.w - 50, y + 13, 26);
        else button(P.x + P.w - 92, y + 8, 76, 36, '+' + DAILY_REWARD.coins, () => Game.claimDaily(j), Object.assign({ icon: 'coin', hot: tk.n >= tk.goal, off: tk.n < tk.goal, offFn: () => { snd('deny'); toast('Veel ' + (tk.goal - tk.n) + ' jäänud.'); }, size: 13 }, B));
      });
      const allC = D.tasks.length && D.tasks.every(x => x.claimed);
      const by = P.y + P.h - 54;
      if (D.bonus) text('Kõik tänased ülesanded on tehtud. Tubli!', P.x + P.w / 2, by + 20, 13, '#4f8d34', 'center', 800, P.w - 20);
      else button(P.x + 30, by, P.w - 60, 42, 'Kõik tehtud: +' + DAILY_BONUS.stars + ' tähte ja kirst', () => Game.claimBonus(), Object.assign({ hot: allC, off: !allC, offFn: () => { snd('deny'); toast('Tee enne kõik kolm ülesannet.'); }, size: 13 }, B));
    } else if (m.kind === 'settings') {
      const P = modalPanel(m, 360, 350, 'Seaded');
      const row = (y, label, key) => {
        text(label, P.x + 24, y + 22, 15, INK, 'left', 800);
        text(Math.round(S.set[key] * 100) + '%', P.x + P.w - 120, y + 22, 15, INK, 'center', 800);
        const ch = dv => { S.set[key] = clamp(Math.round((S.set[key] + dv) * 10) / 10, 0, 1); const a = au(); try { if (a && a.setVolume) a.setVolume(key === 'music' ? 'music' : 'sfx', S.set[key]); } catch (e) {} snd('tap'); saveSoon(); };
        button(P.x + P.w - 180, y, 44, 44, '−', () => ch(-0.1), B); button(P.x + P.w - 64, y, 44, 44, '+', () => ch(0.1), B);
      };
      row(P.y + 40, 'Muusika', 'music'); row(P.y + 96, 'Helid', 'sfx');
      button(P.x + 40, P.y + 152, P.w - 80, 44, S.set.muted ? 'Heli: vaigistatud' : 'Heli: sees', () => { S.set.muted = !S.set.muted; const a = au(); try { if (a && a.setMuted) a.setMuted(S.set.muted); } catch (e) {} snd('tap'); saveSoon(); }, Object.assign({ size: 14, hot: !S.set.muted }, B));
      button(P.x + 40, P.y + 206, P.w - 80, 44, 'Alusta otsast', () => { closeModal(true); openModal({ kind: 'confirm', text: 'Kas kustutada kogu edenemine ja alustada otsast?', yes: () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} Game.newGame(); resetView(); onTitle = true; save(); } }); }, Object.assign({ size: 14 }, B));
      text('Saarepagar · tehtud armastusega', P.x + P.w / 2, P.y + P.h - 40, 12, INK2, 'center', 600);
      text('Kõik toimib ka ilma internetita.', P.x + P.w / 2, P.y + P.h - 22, 11, INK2, 'center', 600);
    } else if (m.kind === 'confirm') {
      const P = modalPanel(m, 340, 200, 'Kindel?');
      wrap(m.text, P.w - 40, 15, 700).forEach((s, j) => text(s, P.x + P.w / 2, P.y + 52 + j * 20, 15, INK, 'center', 700));
      button(P.x + 20, P.y + P.h - 62, (P.w - 50) / 2, 44, 'Ei', () => closeModal(), B);
      button(P.x + 30 + (P.w - 50) / 2, P.y + P.h - 62, (P.w - 50) / 2, 44, 'Jah', () => { const y = m.yes; closeModal(true); y(); }, Object.assign({ hot: true }, B));
    } else if (m.kind === 'chain') {
      const C = CHAINS[m.k], n = C.names.length, cols = 4, rows = Math.ceil(n / cols), P = modalPanel(m, 380, 70 + rows * 96 + 20, C.kind === 'gen' ? 'Generaator' : C.name);
      const cw = (P.w - 20) / cols, disc = S.disc[m.k] || 0;
      for (let j = 0; j < n; j++) {
        const x = P.x + 10 + (j % cols) * cw, y = P.y + 36 + ((j / cols) | 0) * 96, l = j + 1, known = l <= disc;
        g.fillStyle = l === m.l ? 'rgba(255,190,80,0.35)' : 'rgba(120,80,40,0.07)'; rr(x + 3, y, cw - 6, 90, 10); g.fill();
        if (known) drawItem(m.k, l, x + cw / 2, y + 30, 50);
        else { g.globalAlpha = 0.18; g.filter = 'brightness(0)'; drawItem(m.k, l, x + cw / 2, y + 30, 50); g.filter = 'none'; g.globalAlpha = 1; text('?', x + cw / 2, y + 31, 22, INK2, 'center', 800); }
        const ls = known ? wrap(C.names[j], cw - 10, 11, 700) : ['tase ' + l];
        ls.slice(0, 2).forEach((s, q) => text(s, x + cw / 2, y + 66 + q * 13, 11, INK, 'center', 700, cw - 8));
        if (j < n - 1 && (j % cols) < cols - 1) text('›', x + cw, y + 30, 16, INK2, 'center', 800);
      }
      if (C.kind === 'gen') {
        const G = GENERATORS[m.k], lv = Math.max(1, Math.min(m.l, 4)), sp = G.spawn.filter(s => s[2] <= lv).map(s => CHAINS[s[0]].name.toLowerCase());
        text('Annab: ' + sp.join(', '), P.x + P.w / 2, P.y + P.h - 18, 12, INK2, 'center', 700, P.w - 20);
      }
    } else if (m.kind === 'energy') {
      const P = modalPanel(m, 340, 250, 'Energia');
      drawIcon('energy', P.x + P.w / 2 - 24, P.y + 34, 48);
      text(S.en < 1 ? 'Energia sai otsa!' : 'Energiat on ' + S.en + '.', P.x + P.w / 2, P.y + 100, 17, INK, 'center', 800);
      text(S.en < MAXEN ? '+1 energiat ' + fmtTime(Game.enNext()) + ' pärast (iga 2 minuti tagant).' : 'Energia on täis. Kohvi saab ka laualt.', P.x + P.w / 2, P.y + 126, 12, INK2, 'center', 600, P.w - 24);
      const x = SHOP[0];
      button(P.x + 30, P.y + 152, P.w - 60, 46, x.name + ': +25 · ' + x.price, () => { if (Game.buy(x.id)) closeModal(); }, Object.assign({ icon: 'coin', hot: S.coins >= x.price, off: S.coins < x.price, offFn: () => Game.buy(x.id), size: 14 }, B));
      text('Vihje: ühenda kohvioad ja puuduta neid.', P.x + P.w / 2, P.y + P.h - 22, 12, INK2, 'center', 600, P.w - 24);
    } else if (m.kind === 'levelup') {
      const P = modalPanel(m, 320, 250, 'Uus tase!');
      text(String(m.lvl), P.x + P.w / 2, P.y + 72, 46, '#c07a20', 'center', 800);
      text('+10 energiat', P.x + P.w / 2, P.y + 118, 15, INK, 'center', 800);
      text(m.cells ? '+' + m.cells + ' uut ruutu laual' : 'Tellimused muutuvad põnevamaks', P.x + P.w / 2, P.y + 142, 14, INK2, 'center', 700);
      button(P.x + 60, P.y + P.h - 62, P.w - 120, 46, 'Tore!', () => closeModal(), Object.assign({ hot: true }, B));
    }
    g.restore();
  }
  function drawDialog(m, t) {
    dim(0.3);
    const line = m.lines[m.i] || m.lines[m.lines.length - 1], who = line[0], letter = who === 'maali';
    const w = Math.min(L.col.w - 12, 480, W - 12), x = Math.round((W - w) / 2), ps = 76;
    const tw = w - ps - 40, size = 16, ls = wrap(line[1], tw, size, letter ? 600 : 700), h = Math.max(150, 60 + ls.length * 22);
    const y = Math.round(Math.min(H - h - 12, L.bar.y + L.bar.h - h));
    const k = clamp((t - m.t0) / 0.2, 0, 1);
    if (m.title && m.i === 0) { g.font = font(16, 800); const tw2 = Math.min(w - 40, g.measureText(m.title).width + 40); panel(x + (w - tw2) / 2, y - 50, tw2, 34, 'ribbon'); text(m.title, x + w / 2, y - 33, 16, '#fff', 'center', 800, tw2 - 16); }
    panel(x, y, w, h, letter ? 'paper' : 'paper');
    if (letter) { g.strokeStyle = 'rgba(160,110,70,0.25)'; g.lineWidth = 1; for (let yy = y + 50; yy < y + h - 10; yy += 22) { g.beginPath(); g.moveTo(x + ps + 26, yy + 8); g.lineTo(x + w - 14, yy + 8); g.stroke(); } }
    g.save(); g.translate(x + 14 + ps / 2, y + 16 + ps / 2); const s = 0.85 + 0.15 * ease.outBack(k); g.scale(s, s); drawPortrait(who, -ps / 2, -ps / 2, ps); g.restore();
    text(WHO[who] ? (letter ? 'Vanaema Maali kiri' : WHO[who].name) : who, x + ps + 26, y + 24, 16, letter ? '#a04a6a' : '#a0502a', 'left', 800);
    const shown = Math.floor((t - m.t0) * 48); let left = shown;
    if (shown > (m.said || 0) && shown <= line[1].length) { const ch = line[1][shown - 1]; if (ch && ch !== ' ' && shown % 2 === 0) snd('talk', { who, ch }); m.said = shown; }
    ls.forEach((s2, j) => { if (left <= 0) return; const part = s2.slice(0, left); left -= s2.length + 1; text(part, x + ps + 26, y + 52 + j * 22, size, INK, 'left', letter ? 600 : 700); });
    if (shown >= line[1].length) { const a = 0.5 + 0.5 * Math.sin(t * 6); g.globalAlpha = a; text('▶', x + w - 20, y + h - 18, 14, INK2, 'center', 800); g.globalAlpha = 1; }
    text((m.i + 1) + '/' + m.lines.length, x + 14 + ps / 2, y + h - 18, 11, INK2, 'center', 700);
    // tap anywhere advances (no hit regions; handled in modalTap)
  }
  function drawTitle(t) {
    mhits = [];
    const cx = W / 2;
    if (!artOn('bg')) { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#bfe3f2'); gr.addColorStop(0.55, '#fbe9d0'); gr.addColorStop(1, '#f1cfa0'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
    const lw = Math.min(W - 40, 420), ly = H * 0.3;
    let logo = false;
    if (artOn('logo')) { try { ART.logo(g, cx - lw / 2, ly - lw * 0.2, lw, t); logo = true; } catch (e) {} }
    if (!logo) {
      text('Saarepagar', cx, ly + Math.sin(t * 1.5) * 3, Math.round(lw / 6.2), '#a0613a', 'center', 800);
      text('väike pagarikoda saare peal', cx, ly + lw / 8, 15, INK2, 'center', 700);
    }
    const bw = Math.min(240, W - 80), by = H * 0.62;
    const s = 1 + Math.sin(t * 3) * 0.03;
    g.save(); g.translate(cx, by + 30); g.scale(s, s); g.translate(-cx, -by - 30);
    button(cx - bw / 2, by, bw, 60, S.tut === 0 ? 'Alusta' : 'Mängi', () => start(), { hot: true, modal: true, size: 22 });
    g.restore();
    if (S.tut > 0) text('Tase ' + S.lvl + ' · ' + Game.curArea().name, cx, by + 86, 14, INK2, 'center', 700);
  }

  function drawToasts(t) {
    for (let j = toasts.length - 1; j >= 0; j--) if (t - toasts[j].t0 > toasts[j].dur) toasts.splice(j, 1);
    toasts.forEach((o, j) => {
      const k = t - o.t0, a = Math.min(1, k / 0.15, (o.dur - k) / 0.3);
      const w = Math.min(L.scene.w - 16, 440), ls = wrap(o.s, w - 28, 14, 700), h = 16 + ls.length * 18;
      const x = L.scene.x + (L.scene.w - w) / 2, y = L.scene.y + Math.max(40, L.scene.h * 0.32) + j * (h + 6) - (1 - Math.min(1, k / 0.15)) * 10;
      g.globalAlpha = clamp(a, 0, 1);
      g.fillStyle = 'rgba(70,42,22,0.88)'; rr(x, y, w, h, 12); g.fill();
      ls.forEach((s, q) => text(s, x + w / 2, y + 17 + q * 18, 14, '#fff6e6', 'center', 700));
      g.globalAlpha = 1;
    });
    for (let j = floaters.length - 1; j >= 0; j--) {
      const o = floaters[j], k = (t - o.t0) / 1.0; if (k >= 1) { floaters.splice(j, 1); continue; }
      g.globalAlpha = 1 - k * k; text(o.s, o.x, o.y - k * 40, 16, o.color, 'center', 800); g.globalAlpha = 1;
    }
  }

  // ---- frame ----
  function fxActive() {
    if (typeof FX === 'undefined' || !FX) return false;
    try { if (typeof FX.active === 'function') return !!FX.active(); if (typeof FX.active === 'number' || typeof FX.active === 'boolean') return !!FX.active; } catch (e) {}
    return performance.now() < fxUntil;
  }
  function update(dt) { if (fxOn('update')) { try { FX.update(dt); } catch (e) {} } }
  function needsDraw(ms) {
    if (dirty || drag || ms < animUntil || fxActive()) return true;
    if (modal && modal.kind === 'dialog') return ms - lastDraw > 33;
    const pulsing = onTitle || sel >= 0 || (S.tut >= 1 && S.tut <= 4) || S.orders.some(o => Game.orderStatus(o).ready) || S.board.some(it => it && it.b) || artOn('scene') || !!modal;
    return ms - lastDraw > (pulsing ? 66 : 1000);
  }
  function draw(ms) {
    lastDraw = ms; dirty = false; T = ms / 1000; const t = tn();
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    hits = [];
    if (artOn('bg')) { try { ART.bg(g, W, H, t); } catch (e) { g.fillStyle = '#fbe9d0'; g.fillRect(0, 0, W, H); } }
    else { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#fbe9d0'); gr.addColorStop(1, '#f3d6ae'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
    if (onTitle) { drawTitle(t); if (fxOn('draw')) { try { FX.draw(g); } catch (e) {} } return; }
    if (sel >= 0 && !S.board[sel]) sel = -1;
    drawScene(t); drawOrders(t); drawBoard(t); drawInfo(t); drawBar(t);
    if (drag) {
      const tg = dragTarget(), x = drag.x, y = drag.y - drag.lift, s = L.cs * 1.08;
      g.fillStyle = 'rgba(60,35,15,0.22)'; g.beginPath(); g.ellipse(x, y + s * 0.42 + drag.lift * 0.3, s * 0.34, s * 0.12, 0, 0, 7); g.fill();
      const wob = Math.sin(t * 14) * 0.04;
      g.save(); g.translate(x, y); g.rotate(wob); drawItem(drag.it.k, drag.it.l, 0, 0, s); g.restore();
      if (tg.cell >= 0 && Game.canMerge(drag.it, S.board[tg.cell]) && tg.cell !== drag.from) { const nx = drag.it.l + 1; text('→ ' + nm(drag.it.k, nx), x, y - s * 0.62, 13, '#4f8d34', 'center', 800); }
    }
    if (fxOn('draw')) { try { FX.draw(g); } catch (e) {} }
    drawToasts(t);
    drawTutorial(t);
    drawModal(t);
    if (modal && modal.kind === 'tasks' && S.tut === 4 && modal.nextBtn && S.stars >= 1) { const b = modal.nextBtn; drawHand(b.x + b.w / 2 + 8, b.y + b.h / 2 + 10, t, true); }
  }

  function markDirty() { dirty = true; }
  function resetView() { sel = -1; anim.clear(); ghosts.length = 0; modal = null; mq.length = 0; drag = null; dirty = true; }

  return {
    layout, draw, update, needsDraw, ev, hudPos, cellCenter, cellAt, start, openModal, closeModal, toast, markDirty, resetView, itemImg,
    get L() { return L; }, get modal() { return modal; }, get sel() { return sel; }, set sel(v) { sel = v; dirty = true; },
    get onTitle() { return onTitle; }, get cards() { return cardRects; }, get hits() { return hits; }, get mhits() { return mhits; },
    dialogNext: () => { if (modal && modal.kind === 'dialog') { modal.t0 = -1e9; dialogNext(); } },
  };
})();
