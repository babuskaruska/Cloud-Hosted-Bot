// Saarepagar adventure screens (Mira): the winding level map "Seiklus", the level board with drag and drop,
// boosters, the start / tip / pause / win / fail screens, lives, the lucky wheel "Õnneratas" and the piggy bank
// "Hoiupõrsas". Rules live in LV (35-levels.js); drawing helpers come from UI.H (50-ui.js).
// Art, effects and sounds from Ash and Echo are used when they exist, with simple placeholders until then:
//   ART.obstacle(kind, px, state) -> canvas   kind 'ice' | 'box' | 'web' | 'crate' | 'sand' | 'bubble'
//   ART.booster(kind, px) -> canvas           kind 'wand' | 'scissors' | 'shuffle' | 'moves'
//   ART.wheel(ctx, x, y, r, slices, angle)    slices = WHEEL (color, label, r = reward); angle in radians
//   ART.mapBg(ctx, chapter, x, y, w, h, t)    background of one chapter band (clipped to the rect)
//   ART.mapPath(ctx, pts, doneN, t)           pts = [{x, y, n}] along the path; n <= doneN is the walked part
//   ART.mapNode(ctx, x, y, r, state, stars, n) state 'done' | 'current' | 'locked'; boss when n % 10 === 0
//   FX.levelWin()  FX.levelFail()  FX.iceCrack(x, y)  FX.boxBreak(x, y)  FX.boosterUse(kind, x, y)
//   sfx: iceCrack boxBreak cobweb booster wheelTick wheelWin levelWin levelFail star piggy calendar
//   MUSIC.scene('map')  MUSIC.scene('level', { chapter })
const ADV = (() => {
  const H = UI.H, C = H.C, g = H.g;
  const { INK, INK2, CARD, GOOD, GOLD, PINK, GRAPE, MINT, SHADOW, DARK, SOFT } = C;
  const { rr, text, textO, wrap, bar, panel, button, drawItem, drawIcon, dot, snd, snd2, fx, artOn, tn, toast, banner, floater, inR } = H;
  const LC = LV.LC, LR = LV.LR, LN = LV.LN;
  const nm = (k, l) => CHAINS[k].names[l - 1];
  let W = 0, Hh = 0;

  function music(name, opts) {
    try {
      if (typeof MUSIC === 'undefined' || !MUSIC || typeof MUSIC.scene !== 'function') return;
      const k = MUSIC.scene(name, opts);
      if (!k) MUSIC.scene('board', { area: ((opts && opts.chapter) || 0) % AREAS.length }); // until Echo adds the map and level music
    } catch (e) {}
  }

  // ---------- placeholder art (cached canvases) ----------
  const cache = new Map();
  // Ash's names and damage states (0 = whole): my states are layers / hit points left, or the key level for chests.
  const OB_ART = { web: 'cobweb', crate: 'lockedCrate' };
  const ARTST = { ice: s => s === 'cracked' ? 1 : 0, box: s => s === 'cracked' ? 1 : 0 };
  function mk(px) { const c = document.createElement('canvas'); c.width = c.height = px; return c; }
  function obstacleImg(kind, px, state) {
    px = Math.max(8, Math.round(px));
    if (artOn('obstacle')) { try { const c = ART.obstacle(OB_ART[kind] || kind, px, ARTST[kind] ? ARTST[kind](state) : 0); if (c && c.width) return c; } catch (e) {} }
    const key = 'o:' + kind + ':' + px + ':' + state; let c = cache.get(key); if (c) return c;
    c = mk(px); const x = c.getContext('2d'), s = px, m = s * 0.06;
    const rrx = (x0, y0, w, h, r) => { x.beginPath(); x.moveTo(x0 + r, y0); x.arcTo(x0 + w, y0, x0 + w, y0 + h, r); x.arcTo(x0 + w, y0 + h, x0, y0 + h, r); x.arcTo(x0, y0 + h, x0, y0, r); x.arcTo(x0, y0, x0 + w, y0, r); x.closePath(); };
    if (kind === 'ice') {
      const a = state >= 2 ? 0.72 : 0.5;
      const gr = x.createLinearGradient(0, 0, s, s); gr.addColorStop(0, 'rgba(225,248,255,' + a + ')'); gr.addColorStop(1, 'rgba(140,205,245,' + a + ')');
      rrx(m, m, s - 2 * m, s - 2 * m, s * 0.16); x.fillStyle = gr; x.fill(); x.lineWidth = s * 0.04; x.strokeStyle = 'rgba(255,255,255,0.95)'; x.stroke();
      x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineWidth = s * 0.035; x.lineCap = 'round';
      x.beginPath(); x.moveTo(s * 0.2, s * 0.32); x.lineTo(s * 0.34, s * 0.18); x.moveTo(s * 0.2, s * 0.5); x.lineTo(s * 0.5, s * 0.2); x.stroke();
      if (state >= 2) { x.strokeStyle = 'rgba(70,140,200,0.7)'; x.lineWidth = s * 0.03; x.beginPath(); x.moveTo(s * 0.62, s * 0.85); x.lineTo(s * 0.7, s * 0.66); x.lineTo(s * 0.84, s * 0.6); x.moveTo(s * 0.7, s * 0.66); x.lineTo(s * 0.62, s * 0.55); x.stroke(); }
    } else if (kind === 'sand') {
      rrx(m, m, s - 2 * m, s - 2 * m, s * 0.16); x.fillStyle = '#f2d9a0'; x.fill();
      const R = mulberry(7); x.fillStyle = 'rgba(180,130,60,0.45)'; for (let j = 0; j < 26; j++) { x.beginPath(); x.arc(m + R() * (s - 2 * m), m + R() * (s - 2 * m), s * (0.012 + R() * 0.02), 0, 7); x.fill(); }
      x.strokeStyle = 'rgba(200,150,80,0.5)'; x.lineWidth = s * 0.03; x.beginPath(); x.moveTo(s * 0.15, s * 0.7); x.quadraticCurveTo(s * 0.5, s * 0.6, s * 0.85, s * 0.72); x.stroke();
    } else if (kind === 'box') {
      const w = s * 0.82, h = s * 0.74, x0 = (s - w) / 2, y0 = s * 0.16;
      x.fillStyle = 'rgba(60,30,10,0.2)'; x.beginPath(); x.ellipse(s / 2, s * 0.92, w * 0.45, s * 0.04, 0, 0, 7); x.fill();
      rrx(x0, y0, w, h, s * 0.06); x.fillStyle = state >= 2 ? '#b07a44' : '#d9a566'; x.fill(); x.lineWidth = s * 0.04; x.strokeStyle = '#7a4a1e'; x.stroke();
      x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(x0 + s * 0.05, y0 + s * 0.04, w - s * 0.1, h * 0.18);
      x.fillStyle = state >= 2 ? '#7a4a1e' : '#f4e0b0'; x.fillRect(s / 2 - s * 0.07, y0, s * 0.14, h);
      if (state >= 2) { x.fillRect(x0, y0 + h * 0.45, w, s * 0.1); }
    } else if (kind === 'crate') {
      const w = s * 0.84, h = s * 0.7, x0 = (s - w) / 2, y0 = s * 0.18;
      rrx(x0, y0, w, h, s * 0.08); x.fillStyle = '#8a5a2b'; x.fill(); x.lineWidth = s * 0.045; x.strokeStyle = '#4a2a10'; x.stroke();
      x.fillStyle = '#6a4018'; x.fillRect(x0, y0 + h * 0.36, w, s * 0.07);
      x.fillStyle = '#ffd23f'; rrx(s / 2 - s * 0.13, y0 + h * 0.28, s * 0.26, s * 0.26, s * 0.05); x.fill(); x.strokeStyle = '#a8701a'; x.lineWidth = s * 0.03; x.stroke();
      x.beginPath(); x.arc(s / 2, y0 + h * 0.28, s * 0.08, Math.PI, 0); x.stroke();
      x.fillStyle = '#4a2a10'; x.beginPath(); x.arc(s / 2, y0 + h * 0.28 + s * 0.11, s * 0.035, 0, 7); x.fill();
      for (let j = 0; j < (state || 1); j++) { x.fillStyle = '#fff'; x.beginPath(); x.arc(s / 2 + (j - ((state || 1) - 1) / 2) * s * 0.14, y0 + h * 0.84, s * 0.045, 0, 7); x.fill(); }
    } else if (kind === 'web') {
      x.strokeStyle = 'rgba(255,255,255,0.92)'; x.lineWidth = Math.max(1, s * 0.022); const cx = s / 2, cy = s / 2;
      for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4 + 0.2; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * s * 0.5, cy + Math.sin(a) * s * 0.5); x.stroke(); }
      for (const rad of [0.14, 0.27, 0.4]) { x.beginPath(); for (let j = 0; j <= 8; j++) { const a = j * Math.PI / 4 + 0.2, q = s * rad * (j % 2 ? 0.92 : 1); x.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); } x.stroke(); }
      x.strokeStyle = 'rgba(90,80,120,0.35)'; x.lineWidth = Math.max(1, s * 0.012); x.beginPath(); x.arc(cx, cy, s * 0.27, 0, 7); x.stroke();
    } else if (kind === 'bubble') {
      const blob = (bx, by, br, col) => { const gr = x.createRadialGradient(bx - br * 0.3, by - br * 0.35, br * 0.1, bx, by, br); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, col); gr.addColorStop(1, 'rgba(160,120,240,0.55)'); x.fillStyle = gr; x.beginPath(); x.arc(bx, by, br, 0, 7); x.fill(); x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = s * 0.025; x.stroke(); };
      blob(s * 0.36, s * 0.6, s * 0.27, 'rgba(255,170,220,0.55)'); blob(s * 0.66, s * 0.62, s * 0.24, 'rgba(150,220,255,0.55)'); blob(s * 0.52, s * 0.34, s * 0.25, 'rgba(200,170,255,0.55)');
    }
    if (cache.size > 400) cache.clear();
    cache.set(key, c); return c;
  }
  function boostImg(kind, px) {
    px = Math.max(8, Math.round(px));
    if (artOn('booster')) { try { const c = ART.booster(kind === 'moves' ? 'moves5' : kind, px); if (c && c.width) return c; } catch (e) {} }
    const key = 'b:' + kind + ':' + px; let c = cache.get(key); if (c) return c;
    c = mk(px); const x = c.getContext('2d'), s = px, cx = s / 2, cy = s / 2;
    x.lineJoin = 'round'; x.lineCap = 'round';
    const star = (sx, sy, r, col) => { x.beginPath(); for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + j * Math.PI / 5, q = j % 2 ? r * 0.45 : r; x.lineTo(sx + Math.cos(a) * q, sy + Math.sin(a) * q); } x.closePath(); x.fillStyle = col; x.fill(); x.lineWidth = s * 0.04; x.strokeStyle = '#a8701a'; x.stroke(); };
    if (kind === 'wand') {
      x.strokeStyle = '#4a2a7a'; x.lineWidth = s * 0.13; x.beginPath(); x.moveTo(s * 0.2, s * 0.84); x.lineTo(s * 0.6, s * 0.42); x.stroke();
      x.strokeStyle = '#b07cff'; x.lineWidth = s * 0.08; x.beginPath(); x.moveTo(s * 0.2, s * 0.84); x.lineTo(s * 0.6, s * 0.42); x.stroke();
      star(s * 0.66, s * 0.34, s * 0.26, '#ffd23f');
      x.fillStyle = '#fff'; for (const [a, b, r] of [[0.25, 0.25, 0.04], [0.88, 0.62, 0.035], [0.4, 0.12, 0.03]]) { x.beginPath(); x.arc(s * a, s * b, s * r, 0, 7); x.fill(); }
    } else if (kind === 'scissors') {
      x.strokeStyle = '#8a9ab8'; x.lineWidth = s * 0.1; x.beginPath(); x.moveTo(s * 0.36, s * 0.6); x.lineTo(s * 0.82, s * 0.16); x.moveTo(s * 0.64, s * 0.6); x.lineTo(s * 0.18, s * 0.16); x.stroke();
      x.strokeStyle = '#e8eef8'; x.lineWidth = s * 0.05; x.stroke();
      for (const bx of [0.3, 0.7]) { x.beginPath(); x.arc(s * bx, s * 0.74, s * 0.14, 0, 7); x.lineWidth = s * 0.09; x.strokeStyle = '#ff4f9a'; x.stroke(); }
      x.fillStyle = '#4a4a6a'; x.beginPath(); x.arc(cx, s * 0.5, s * 0.05, 0, 7); x.fill();
    } else if (kind === 'shuffle') {
      x.beginPath(); x.arc(cx, cy, s * 0.42, 0, 7); x.fillStyle = '#6fe0a0'; x.fill(); x.lineWidth = s * 0.05; x.strokeStyle = '#1a9a5a'; x.stroke();
      x.strokeStyle = '#fff'; x.lineWidth = s * 0.08;
      x.beginPath(); x.arc(cx, cy, s * 0.24, Math.PI * 0.15, Math.PI * 0.95); x.stroke(); x.beginPath(); x.arc(cx, cy, s * 0.24, Math.PI * 1.15, Math.PI * 1.95); x.stroke();
      const head = (a) => { const hx = cx + Math.cos(a) * s * 0.24, hy = cy + Math.sin(a) * s * 0.24; x.fillStyle = '#fff'; x.beginPath(); x.moveTo(hx + Math.cos(a + 1.6) * s * 0.11, hy + Math.sin(a + 1.6) * s * 0.11); x.lineTo(hx + Math.cos(a) * s * 0.1, hy + Math.sin(a) * s * 0.1); x.lineTo(hx - Math.cos(a) * s * 0.1, hy - Math.sin(a) * s * 0.1); x.fill(); };
      head(Math.PI * 0.95); head(Math.PI * 1.95);
    } else {
      x.beginPath(); x.arc(cx, cy, s * 0.42, 0, 7); x.fillStyle = '#5ac0ff'; x.fill(); x.lineWidth = s * 0.05; x.strokeStyle = '#1a6fd0'; x.stroke();
      x.font = '900 ' + Math.round(s * 0.4) + 'px ' + (ART && ART.theme && ART.theme.font || 'sans-serif'); x.textAlign = 'center'; x.textBaseline = 'middle';
      x.lineWidth = s * 0.07; x.strokeStyle = '#1a4f9a'; x.strokeText('+5', cx, cy + s * 0.02); x.fillStyle = '#fff'; x.fillText('+5', cx, cy + s * 0.02);
    }
    cache.set(key, c); return c;
  }
  function drawObstacle(kind, x, y, s, state) { g.drawImage(obstacleImg(kind, s * H.DPR, state), x, y, s, s); }
  function drawBoost(kind, x, y, s) { g.drawImage(boostImg(kind, s * H.DPR), x, y, s, s); }

  // ================= MAP =================
  const M = { scroll: null, vel: 0, drag: null, nodes: [], last: 0, walk: null };
  const SP = 104;
  function mapGeo() {
    W = H.W; Hh = H.H; const si = H.insets();
    const top = si.t + 6, bot = Hh - si.b - 6, cx = W / 2, amp = Math.min(W * 0.27, 150);
    return { top, bot, cx, amp, base: bot - 200 };
  }
  const nodeX = (G, n) => G.cx + Math.sin(n * 0.9) * G.amp;
  const nodeY = (G, n) => G.base - (n * SP - M.scroll);
  const scrollFor = (G, n) => n * SP - (G.base - (G.top + G.bot) * 0.5);
  function clampScroll(G) { const lo = SP - 10, hi = Math.max(lo, scrollFor(G, S.adv.top + 6)); M.scroll = clamp(M.scroll, lo, hi); }
  const CH_COL = [['#bfe9ff', '#fff2d8'], ['#d6f5c8', '#fff6d6'], ['#a9dcf5', '#e4f6f2'], ['#ffe2bf', '#fff1e0'], ['#c6d4f5', '#efe4fa'], ['#cdeec2', '#e9f7d6'], ['#e2f0ff', '#ffffff'], ['#ffd6ec', '#fff3c8']];

  function drawMap(t) {
    W = H.W; Hh = H.H; const G = mapGeo(), A = S.adv;
    LV.tickHearts();
    if (M.scroll === null) { M.scroll = scrollFor(G, A.top); }
    clampScroll(G);
    // visible level range
    const wLo = G.base + M.scroll - G.bot - 80, wHi = G.base + M.scroll - G.top + 80;
    const nLo = Math.max(1, Math.floor(wLo / SP)), nHi = Math.max(nLo, Math.ceil(wHi / SP));
    // chapter bands
    const c0 = LV.chapterOf(nLo), c1 = LV.chapterOf(nHi);
    for (let c = c0; c <= c1; c++) {
      const yTop = c === c1 ? 0 : Math.max(0, nodeY(G, c * 50 + 50.5)), yBot = c === c0 ? Hh : Math.min(Hh, nodeY(G, c * 50 + 0.5));
      if (yBot <= yTop) continue;
      g.save(); g.beginPath(); g.rect(0, yTop, W, yBot - yTop); g.clip();
      let drawn = false;
      if (artOn('mapBg')) { try { ART.mapBg(g, c, 0, yTop, W, yBot - yTop, t, yTop - M.scroll); drawn = true; } catch (e) {} }
      if (!drawn) {
        const col = CH_COL[c % CH_COL.length], gr = g.createLinearGradient(0, yTop, 0, yBot); gr.addColorStop(0, col[0]); gr.addColorStop(1, col[1]); g.fillStyle = gr; g.fillRect(0, yTop, W, yBot - yTop);
        // soft decor: blobs that scroll with the map
        for (let n = Math.max(c * 50 + 1, nLo - 1); n <= Math.min(c * 50 + 50, nHi + 1); n++) {
          const R = mulberry(n * 7 + 3), y = nodeY(G, n) + (R() - 0.5) * SP;
          const side = R() < 0.5 ? -1 : 1, x = G.cx - side * (G.amp + 40 + R() * 60) * (Math.sin(n * 0.9) * side > 0 ? 1 : 0.6);
          g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(x, y, 26 + R() * 30, 14 + R() * 10, 0, 0, 7); g.fill();
          g.fillStyle = c % 2 ? 'rgba(90,170,90,0.18)' : 'rgba(90,150,210,0.16)'; g.beginPath(); g.arc(W - x, y + 30, 10 + R() * 14, 0, 7); g.fill();
        }
      }
      g.restore();
    }
    // path
    const pts = [];
    for (let f = nLo - 1; f <= nHi + 1; f += 0.25) if (f >= 0.6) pts.push({ x: nodeX(G, f), y: nodeY(G, f), n: f });
    let pathDrawn = false;
    if (artOn('mapPath')) { try { let done = -1; pts.forEach((p, j) => { if (p.n <= A.top) done = j; }); ART.mapPath(g, pts, t, { done }); pathDrawn = true; } catch (e) {} }
    if (!pathDrawn && pts.length > 1) {
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = 'rgba(80,60,160,0.16)'; g.lineWidth = 26; g.beginPath(); pts.forEach((p, j) => j ? g.lineTo(p.x, p.y + 4) : g.moveTo(p.x, p.y + 4)); g.stroke();
      g.strokeStyle = '#fff8ea'; g.lineWidth = 22; g.beginPath(); pts.forEach((p, j) => j ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke();
      const walked = pts.filter(p => p.n <= A.top);
      if (walked.length > 1) { g.strokeStyle = '#ffb3d1'; g.lineWidth = 10; g.setLineDash([2, 16]); g.beginPath(); walked.forEach((p, j) => j ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke(); g.setLineDash([]); }
    }
    // chapter ribbons
    for (let c = c0; c <= c1 + 1; c++) {
      const y = nodeY(G, c * 50 + 0.5); if (y < G.top - 80 || y > Hh + 80) continue;
      if (artOn('mapDivider')) { try { ART.mapDivider(g, c, 0, y, W, t); continue; } catch (e) {} }
      g.font = H.font(18, 900); const tw = Math.min(W - 40, g.measureText(chapterName(c)).width + 48);
      panel(W / 2 - tw / 2, y - 20, tw, 40, 'ribbon'); text(chapterName(c), W / 2, y, 18, '#fff', 'center', 900, tw - 24);
    }
    // nodes
    M.nodes = [];
    const pulse = 1 + Math.sin(t * 4) * 0.07;
    for (let n = nHi; n >= nLo; n--) {
      const x = nodeX(G, n), y = nodeY(G, n), boss = n % 10 === 0, st = n < A.top ? 'done' : n === A.top ? 'current' : 'locked';
      const r = (boss ? 34 : 27) * (st === 'current' ? pulse : 1), stars = A.stars[n] || 0;
      M.nodes.push({ n, x, y, r: Math.max(30, r + 6) });
      let drawn = false;
      if (artOn('mapNode')) { try { ART.mapNode(g, x, y, r, st, stars, n, t); drawn = true; } catch (e) {} }
      if (!drawn) phNode(x, y, r, st, stars, n, boss, t);
    }
    // the heroine stands on the current level
    const cy = nodeY(G, A.top), cxx = nodeX(G, A.top);
    if (cy > G.top - 40 && cy < Hh + 40) {
      const bob = Math.abs(Math.sin(t * 3)) * 8, ps = 50;
      g.fillStyle = 'rgba(40,20,80,0.18)'; g.beginPath(); g.ellipse(cxx, cy - 30, 18, 5, 0, 0, 7); g.fill();
      g.save(); g.beginPath(); g.arc(cxx, cy - 58 - bob, ps / 2, 0, 7); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 3; g.strokeStyle = PINK; g.stroke(); g.clip();
      H.drawPortrait('mina', cxx - ps / 2, cy - 58 - bob - ps / 2, ps); g.restore();
    }
    drawMapHud(t, G);
  }
  function phNode(x, y, r, st, stars, n, boss, t) {
    g.fillStyle = 'rgba(40,20,90,0.22)'; g.beginPath(); g.ellipse(x, y + r * 0.72, r * 0.95, r * 0.32, 0, 0, 7); g.fill();
    const col = st === 'done' ? ['#ff8ac0', '#d0357a'] : st === 'current' ? ['#fff07a', '#ffb02e'] : ['#e8e6f4', '#b8b4d4'];
    if (boss && st !== 'locked') { col[0] = st === 'done' ? '#c79bff' : '#fff07a'; col[1] = st === 'done' ? '#7c3ad8' : '#ff8a2e'; }
    const gr = g.createLinearGradient(0, y - r, 0, y + r); gr.addColorStop(0, col[0]); gr.addColorStop(1, col[1]);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.lineWidth = 4; g.strokeStyle = '#fff'; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.ellipse(x - r * 0.3, y - r * 0.45, r * 0.4, r * 0.2, -0.4, 0, 7); g.fill();
    if (st === 'locked') { g.globalAlpha = 0.5; drawIcon('lock', x - 11, y - 25, 22); g.globalAlpha = 1; text(String(n), x, y + 8, 16, INK2, 'center', 900); }
    else textO(String(n), x, y + 1, boss ? 22 : 19, '#fff', st === 'current' ? '#c06a00' : '#7a1f4a', 4);
    if (boss) { // crown
      g.fillStyle = '#ffd23f'; g.strokeStyle = '#a8701a'; g.lineWidth = 2; g.beginPath();
      const cy = y - r - 4; g.moveTo(x - 14, cy + 8); g.lineTo(x - 14, cy - 6); g.lineTo(x - 7, cy + 1); g.lineTo(x, cy - 10); g.lineTo(x + 7, cy + 1); g.lineTo(x + 14, cy - 6); g.lineTo(x + 14, cy + 8); g.closePath(); g.fill(); g.stroke();
    }
    if (st === 'done') for (let j = 0; j < 3; j++) { const sx = x + (j - 1) * 18, sy = y + r + 8 - (j === 1 ? 4 : 0); g.globalAlpha = j < stars ? 1 : 0.35; drawIcon('star', sx - 10, sy - 10, 20); g.globalAlpha = 1; }
  }
  let mapHudR = {};
  function drawMapHud(t, G) {
    const A = S.adv, top = G.top;
    // back to the café
    button(8, top, 104, 48, '‹ Kohvik', () => UI.goScreen('board'), { style: 'buttonBlue', size: 18 });
    // lives
    const hx = 120, hw = Math.min(150, W - 120 - 120 - 16);
    g.fillStyle = DARK; rr(hx, top + 4, hw, 40, 20); g.fill();
    drawIcon('heart', hx + 4, top + 6, 36);
    const full = A.hearts >= HEART_MAX;
    text(String(A.hearts), hx + 50, top + 25, 20, '#fff', 'center', 900);
    if (hw > 90) text(full ? 'Täis' : fmtTime(LV.heartNext()), hx + 64 + (hw - 70) / 2, top + 25, 16, full ? MINT : '#fff', 'center', 800, hw - 72);
    H.addHit({ x: hx, y: top, w: hw, h: 48, fn: () => { snd('tap'); H.openModal({ kind: 'advHearts' }); } });
    mapHudR.hearts = { x: hx + 22, y: top + 24 };
    // coins
    const cw = Math.min(118, W - hx - hw - 14), cx0 = W - cw - 8;
    g.fillStyle = DARK; rr(cx0, top + 4, cw, 40, 20); g.fill(); drawIcon('coin', cx0 + 4, top + 7, 34);
    text(fmtNum(H.disp.coins === null ? S.coins : H.disp.coins), cx0 + 40 + (cw - 46) / 2, top + 25, 18, '#fff', 'center', 900, cw - 46);
    mapHudR.coins = { x: cx0 + 20, y: top + 24 };
    // right column: wheel, piggy, calendar
    const col = [
      ['wheel', 'Ratas', () => openWheel(), Game.wheelSpins() > 0],
      ['piggy', 'Põrsas', () => H.openModal({ kind: 'advPiggy' }), Game.piggyReady()],
      ['calendar', 'Kalender', () => H.openModal({ kind: 'daily' }), !S.daily.gift],
    ];
    col.forEach(([ic, lab, fn, hot], j) => {
      const bx = W - 74, by = top + 62 + j * 84, wig = hot ? Math.sin(t * 8) * 0.12 * (Math.sin(t * 1.6) > 0.5 ? 1 : 0) : 0, ps = H.pressScale(bx, by);
      g.fillStyle = 'rgba(255,255,255,0.92)'; g.beginPath(); g.arc(bx + 33, by + 28, 29 * ps, 0, 7); g.fill(); g.lineWidth = 2.5; g.strokeStyle = 'rgba(124,92,255,0.25)'; g.stroke();
      g.save(); g.translate(bx + 33, by + 28); g.rotate(wig); drawIcon(ic, -22 * ps, -22 * ps, 44 * ps); g.restore();
      g.fillStyle = DARK; g.font = H.font(15, 900); const lw = g.measureText(lab).width + 14; rr(bx + 33 - lw / 2, by + 52, lw, 22, 11); g.fill();
      text(lab, bx + 33, by + 63, 15, '#fff', 'center', 900);
      if (hot) dot(bx + 56, by + 6);
      H.addHit({ x: bx, y: by, w: 66, h: 76, bx, by, fn: () => { snd('tap'); fn(); } });
    });
    // win streak badge and the big play button (always in view)
    const bw = Math.min(330, W - 40), bx = (W - bw) / 2, by = G.bot - 68;
    if (A.streak > 0) {
      const s = 'Võiduseeria ×' + A.streak + ' · +' + Math.min(3, A.streak) + ' käiku';
      g.font = H.font(16, 900); const sw = Math.min(W - 30, g.measureText(s).width + 30);
      g.fillStyle = 'rgba(255,79,154,0.92)'; rr(W / 2 - sw / 2, by - 40, sw, 32, 16); g.fill(); text(s, W / 2, by - 24, 16, '#fff', 'center', 900, sw - 16);
    }
    const n = A.top, pu = 1 + Math.sin(t * 4) * 0.03;
    g.save(); g.translate(W / 2, by + 32); g.scale(pu, pu); g.translate(-W / 2, -by - 32);
    button(bx, by, bw, 64, (n % 10 === 0 ? 'Suur tellimus · ' : 'Mängi: tase ') + n, () => openStart(n), { hot: true, size: 23 });
    g.restore();
  }

  // ================= LEVEL =================
  let V = null;
  function levelGeo() {
    W = H.W; Hh = H.H; const si = H.insets();
    const top = si.t + 6, bot = Hh - si.b - 6, cw = Math.min(W - 12, 540), x0 = (W - cw) / 2;
    const orders = V && V.r.def.orders.length ? 74 : 0, topH = 100, boostH = 96;
    const avail = bot - top - topH - orders - boostH - 18;
    const cs = Math.max(34, Math.floor(Math.min((cw - 8) / LC, avail / LR, 92)));
    const bw = cs * LC, bh = cs * LR, bx = Math.round((W - bw) / 2);
    const by = Math.round(top + topH + orders + 8 + Math.max(0, (avail - bh) / 2));
    return { top, bot, cw, x0, topH, orders, boostH, cs, bx, by, bw, bh, ordY: top + topH + 4, boostY: bot - boostH };
  }
  const cellC = i => { const G = V.G; return { x: G.bx + (i % LC + 0.5) * G.cs, y: G.by + (((i / LC) | 0) + 0.5) * G.cs }; };
  const cellAt = (x, y) => { const G = V.G, c = Math.floor((x - G.bx) / G.cs), r = Math.floor((y - G.by) / G.cs); return c < 0 || r < 0 || c >= LC || r >= LR ? -1 : r * LC + c; };
  function setAnim(i, a) { if (i < 0) return; a.t0 = tn() + (a.delay || 0); V.anim.set(i, a); H.keep((a.delay || 0) + (a.dur || 0.4)); }
  function ghost(o) { o.t0 = tn() + (o.delay || 0); V.ghosts.push(o); H.keep((o.delay || 0) + o.dur); }

  function enterLevel(r) {
    V = { r, G: null, anim: new Map(), ghosts: [], sel: -1, drag: null, ptr: null, mode: null, endAt: 0, endShown: false, bump: {}, t0: tn() };
    V.G = levelGeo();
    r.on = runEv;
    UI.goScreen('level');
    const tips = levelTips(r.def);
    if (r.streakBonus) setTimeout(() => { if (V && V.r === r) { toast('Võiduseeria: +' + r.streakBonus + ' käiku!'); snd2('claim', 'coins'); } }, 500);
    for (const k of tips) H.openModal({ kind: 'advTip', tip: k }, true);
  }
  function levelTips(def) {
    const out = [], seen = S.adv.tips;
    const ks = def.goals.map(g2 => g2.type).concat(def.obs);
    if (def.kind === 'boss') ks.unshift('boss');
    for (const k of ks) if (ADV_TIPS[k] && !seen[k]) { seen[k] = 1; out.push(k); }
    if (out.length) saveSoon();
    return out;
  }
  function goalPos(gi) { const r = V.goalR && V.goalR[gi]; return r ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : { x: W / 2, y: V.G.top + 40 }; }

  function runEv(kind, cell, d) {
    H.keep(0.5);
    if (!V) return;
    const P = cell >= 0 ? cellC(cell) : null, cs = V.G.cs;
    switch (kind) {
      case 'merge': moodCheck(); setAnim(cell, { pop: 1, dur: 0.38 }); if (!fx('merge', P.x, P.y, d.k, d.l)) floater(P.x, P.y, '✦', GOLD); snd('merge', { level: d.l }); V.sel = cell; break;
      case 'move': case 'swap': { const F = V.dropPt || cellC(d.from); setAnim(cell, { fx: F.x, fy: F.y, dur: 0.16 }); if (kind === 'swap') { setAnim(d.from, { fx: P.x, fy: P.y, dur: 0.22 }); snd('swap'); } else snd('drop'); V.sel = cell; break; }
      case 'spawn': setAnim(cell, { fx: P.x, fy: V.G.by - cs, arc: 0, pop: 1, dur: 0.42, delay: 0.12 }); snd('spawn', { level: 1 }); break;
      case 'ice': if (!fx('iceCrack', P.x, P.y, cs)) { fx('sparkle', P.x, P.y, 8, cs * 0.5); fx('ring', P.x, P.y, cs * 0.6, '#bfeaff'); } snd2('iceCrack', 'tap'); break;
      case 'box': if (d.left) { setAnim(cell, { shake: 1, dur: 0.3 }); snd2('boxBreak', 'drop'); } else { if (!fx('boxBreak', P.x, P.y, cs)) fx('merge', P.x, P.y, 'chest', 1); snd2('boxBreak', 'chest'); } break;
      case 'reveal': setAnim(cell, { pop: 1, dur: 0.5, delay: 0.1 }); break;
      case 'web': if (!fx('obstacleClear', 'cobweb', P.x, P.y, cs)) fx('sparkle', P.x, P.y, 8, cs * 0.5); snd2('cobweb', 'tap'); setAnim(cell, { squash: 1, dur: 0.3 }); break;
      case 'bubble': if (!fx('obstacleClear', 'bubble', P.x, P.y, cs)) fx('ring', P.x, P.y, cs * 0.6, '#d8b8ff'); snd('bubblePop'); break;
      case 'spread': setAnim(cell, { pop: 1, dur: 0.5, delay: 0.3 }); snd('bubble'); break;
      case 'crate': if (!fx('obstacleClear', 'lockedCrate', P.x, P.y, cs)) fx('merge', P.x, P.y, 'chest', 2); fx('confetti', 0.25, P.x, P.y); snd2('boxBreak', 'chest'); banner({ text: '+' + d.moves + ' käiku!', x: P.x, y: P.y, color: '#7fd0ff', size: 30 }); break;
      case 'goal': {
        const T = goalPos(d.gi), from = P || T;
        if (d.type === 'make') ghost({ k: d.k, l: d.l, x0: from.x, y0: from.y, x1: T.x, y1: T.y, dur: 0.55, s0: 1, s1: 0.5 });
        else if (P) ghost({ star: 1, x0: from.x, y0: from.y, x1: T.x, y1: T.y, dur: 0.5, s0: 0.5, s1: 0.4 });
        setTimeout(() => { if (V) { V.bump[d.gi] = tn(); H.keep(0.4); } }, d.type === 'order' ? 100 : 520);
        break;
      }
      case 'order': {
        const T = V.ordR && V.ordR[d.oi] ? { x: V.ordR[d.oi].x + V.ordR[d.oi].w / 2, y: V.ordR[d.oi].y + 30 } : goalPos(0);
        d.cells.forEach((c, j) => { const Q = cellC(c), it = d.taken[j]; ghost({ k: it.k, l: it.l, x0: Q.x, y0: Q.y, x1: T.x, y1: T.y, dur: 0.45, delay: 0.25 + j * 0.06, s0: 1, s1: 0.5 }); setAnim(c, { hide: 1, dur: 0.25 }); });
        setTimeout(() => snd('orderDone'), 250);
        const V2 = VILLAGERS[d.o.who]; if (V2) setTimeout(() => toast(WHO[d.o.who].name + ': ' + pick(V2.thanks), 2.6), 300);
        break;
      }
      case 'twin': setAnim(cell, { pop: 1, dur: 0.5, delay: 0.2 }); break;
      case 'boost': {
        const Q = P || { x: W / 2, y: V.G.by + V.G.bh / 2 };
        if (!fx('boosterUse', d.kind === 'moves' ? 'moves5' : d.kind, Q.x, Q.y)) { fx('sparkle', Q.x, Q.y, 14, cs * 0.8); fx('ring', Q.x, Q.y, cs, '#ffe07a'); }
        snd2('booster', 'lucky', { kind: d.kind === 'moves' ? 'moves5' : d.kind });
        if (d.kind === 'wand') setAnim(cell, { pop: 1, dur: 0.5 });
        if (d.kind === 'scissors') { setAnim(cell, { pop: 1, dur: 0.4 }); setAnim(d.to, { fx: Q.x, fy: Q.y, arc: 1, pop: 1, dur: 0.4 }); }
        if (d.kind === 'shuffle') d.cells.forEach((c, j) => setAnim(c, { pop: 1, dur: 0.45, delay: j * 0.04 }));
        if (d.kind === 'moves') { banner({ text: '+5 käiku!', x: movesPos().x, y: movesPos().y + 60, color: '#7fd0ff', size: 32 }); V.bump.moves = tn(); }
        break;
      }
      case 'win': V.endAt = tn() + 1.0; V.sel = -1; break;
      case 'out': V.endAt = tn() + 0.7; break;
    }
  }
  // Few moves left: tense music and a warning sound once.
  function moodCheck() {
    const r = V && V.r; if (!r) return;
    const tense = r.moves <= 3 && !r.won;
    if (tense !== V.tense) { V.tense = tense; try { if (typeof MUSIC !== 'undefined' && MUSIC && MUSIC.mood) MUSIC.mood(tense ? 'tense' : 'normal'); } catch (e) {} if (tense && r.moves > 0) snd2('movesLow', 'deny'); }
  }
  function movesPos() { const G = V.G; return { x: G.x0 + G.cw - 52, y: G.top + 46 }; }

  function drawLevel(t) {
    if (!V) return;
    W = H.W; Hh = H.H; V.G = levelGeo();
    const G = V.G, r = V.r, def = r.def;
    // background: the chapter's colours, softly
    const col = CH_COL[def.chapter % CH_COL.length];
    if (artOn('levelBg')) { try { ART.levelBg(g, def.chapter, 0, 0, W, Hh, t, col, 0.55); } catch (e) {} } // one cached blit (Ash, phase C)
    else { const gr = g.createLinearGradient(0, 0, 0, Hh); gr.addColorStop(0, col[0]); gr.addColorStop(1, col[1]); g.fillStyle = gr; g.fillRect(0, 0, W, Hh); }
    if (!artOn('levelBg') && artOn('mapBg')) { try { g.save(); g.globalAlpha = 0.55; ART.mapBg(g, def.chapter, 0, 0, W, Hh, t); g.restore(); } catch (e) { g.restore(); } }
    drawGoalBar(t, G, r);
    if (G.orders) drawLevelOrders(t, G, r);
    drawLevelBoard(t, G, r);
    drawBoostBar(t, G, r);
    if (V.drag) {
      const x = V.drag.x, y = V.drag.y - V.drag.lift, s = G.cs * 1.1;
      g.fillStyle = 'rgba(60,35,15,0.22)'; g.beginPath(); g.ellipse(x, y + s * 0.45 + V.drag.lift * 0.3, s * 0.34, s * 0.12, 0, 0, 7); g.fill();
      g.save(); g.translate(x, y); g.rotate(Math.sin(t * 14) * 0.05); drawItem(V.drag.it.k, V.drag.it.l, 0, 0, s); g.restore();
      const tc = dragCell(), kind = tc >= 0 ? LV.canDrop(r, V.drag.from, tc) : null;
      if (kind === 'merge' || kind === 'crate') {
        const lab = kind === 'crate' ? 'Ava kirst!' : '→ ' + nm(V.drag.it.k, V.drag.it.l + 1);
        g.font = H.font(16, 900); const lw = Math.min(W - 20, g.measureText(lab).width + 24), lx = clamp(x, lw / 2 + 6, W - lw / 2 - 6);
        g.fillStyle = DARK; rr(lx - lw / 2, y - s * 0.62 - 30, lw, 30, 15); g.fill(); text(lab, lx, y - s * 0.62 - 14, 16, '#fff', 'center', 900, lw - 12);
      }
    }
    if (V.mode) {
      const s = BOOSTERS[V.mode].prompt; g.font = H.font(17, 900); const sw = Math.min(W - 20, g.measureText(s).width + 36);
      g.fillStyle = 'rgba(124,92,255,0.94)'; rr(W / 2 - sw / 2, G.by - 46, sw, 38, 19); g.fill(); text(s, W / 2, G.by - 27, 17, '#fff', 'center', 900, sw - 20);
    }
  }
  function drawGoalBar(t, G, r) {
    const x0 = G.x0, y0 = G.top, w = G.cw, h = G.topH - 8;
    panel(x0, y0, w, h, 'paper');
    // pause
    const ps = H.pressScale(x0 + 8, y0 + 8);
    g.fillStyle = SOFT; g.beginPath(); g.arc(x0 + 32, y0 + h / 2, 22 * ps, 0, 7); g.fill();
    g.fillStyle = INK2; rr(x0 + 24, y0 + h / 2 - 10, 6, 20, 2); g.fill(); rr(x0 + 35, y0 + h / 2 - 10, 6, 20, 2); g.fill();
    H.addHit({ x: x0 + 4, y: y0 + h / 2 - 26, w: 56, h: 52, bx: x0 + 8, by: y0 + 8, fn: () => { snd('tap'); H.openModal({ kind: 'advPause', sticky: true }); } });
    // level number
    text((r.def.kind === 'boss' ? 'Suur tellimus' : 'Tase ' + r.n), x0 + 64, y0 + 18, 15, INK2, 'left', 900, w - 180);
    // goals
    V.goalR = [];
    const gw = Math.min(110, (w - 64 - 110) / r.goals.length), gy = y0 + 32;
    r.goals.forEach((g2, gi) => {
      const gx = x0 + 64 + gi * (gw + 6), done = g2.got >= g2.n, b = V.bump[gi] ? clamp(1 - (tn() - V.bump[gi]) / 0.35, 0, 1) : 0, s = 1 + 0.25 * Math.sin(b * Math.PI);
      g.fillStyle = done ? 'rgba(47,213,154,0.2)' : SOFT; rr(gx, gy, gw, h - 40, 14); g.fill();
      const is = Math.min(44, h - 46) * s, icx = gx + 8 + is / 2, icy = gy + (h - 40) / 2;
      goalIcon(g2, icx - is / 2, icy - is / 2, is);
      if (done) drawIcon('check', gx + gw - 34, icy - 15, 30);
      else text(String(g2.n - g2.got), gx + 12 + Math.min(44, h - 46) + (gw - 18 - Math.min(44, h - 46)) / 2, icy + 1, 22, INK, 'center', 900, gw - 54);
      V.goalR[gi] = { x: gx, y: gy, w: gw, h: h - 40 };
      H.addHit({ x: gx, y: gy, w: gw, h: h - 40, fn: () => { snd('tap'); toast(goalText(g2) + ' (' + g2.got + '/' + g2.n + ')'); } });
    });
    // moves bubble with the star meter
    const mp = movesPos(), b = V.bump.moves ? clamp(1 - (tn() - V.bump.moves) / 0.35, 0, 1) : 0, low = r.moves <= 5 && !r.won;
    const mr = 38 * (1 + 0.2 * Math.sin(b * Math.PI)) * (low ? 1 + Math.sin(t * 7) * 0.04 : 1);
    const mg = g.createLinearGradient(0, mp.y - mr, 0, mp.y + mr); mg.addColorStop(0, low ? '#ff8a9a' : '#9b84ff'); mg.addColorStop(1, low ? '#e0304a' : '#5a3ad8');
    g.fillStyle = mg; g.beginPath(); g.arc(mp.x, mp.y - 4, mr, 0, 7); g.fill(); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke();
    textO(String(r.moves), mp.x, mp.y - 12, 28, '#fff', 'rgba(30,10,80,0.6)', 4);
    text('käiku', mp.x, mp.y + 13, 15, '#fff', 'center', 800);
    const st = LV.starsFor(r);
    for (let j = 0; j < 3; j++) { g.globalAlpha = j < st ? 1 : 0.3; drawIcon('star', mp.x - 30 + j * 20, mp.y + mr - 12, 20); g.globalAlpha = 1; }
  }
  function goalIcon(g2, x, y, s) {
    if (g2.type === 'make') drawItem(g2.k, g2.l, x + s / 2, y + s / 2, s);
    else if (g2.type === 'ice') drawObstacle('ice', x, y, s, 2);
    else if (g2.type === 'box') drawObstacle('box', x, y, s, 1);
    else if (g2.type === 'order') H.drawPortrait('liisa', x, y, s);
  }
  function goalText(g2, n) {
    n = n === undefined ? g2.n : n;
    if (g2.type === 'make') return 'Tee ' + n + ' × ' + nm(g2.k, g2.l);
    if (g2.type === 'ice') return 'Lõhu jää ' + n + (n === 1 ? ' ruudult' : ' ruudult');
    if (g2.type === 'box') return 'Ava ' + n + (n === 1 ? ' kast' : ' kasti');
    return 'Täida ' + n + (n === 1 ? ' tellimus' : ' tellimust');
  }
  function drawLevelOrders(t, G, r) {
    V.ordR = [];
    const cw = Math.min(240, (G.cw - 12) / 2), y = G.ordY, h = G.orders - 8, tot = r.orders.length * (cw + 8) - 8, x0 = W / 2 - tot / 2;
    r.orders.forEach((o, oi) => {
      const x = x0 + oi * (cw + 8);
      g.fillStyle = SHADOW; rr(x, y + 3, cw, h, 16); g.fill(); g.fillStyle = CARD; rr(x, y, cw, h, 16); g.fill();
      g.save(); rr(x, y, cw, h, 16); g.clip(); H.drawPortrait(o.who, x + 6, y + (h - 46) / 2, 46); g.restore();
      const sl = Math.min(46, h - 12);
      o.items.forEach(([k, l], j) => {
        const ix = x + 58 + j * (sl + 4), iy = y + (h - sl) / 2; if (ix + sl > x + cw - 4) return;
        g.fillStyle = SOFT; rr(ix, iy, sl, sl, 10); g.fill(); drawItem(k, l, ix + sl / 2, iy + sl / 2, sl * 0.88);
      });
      V.ordR[oi] = { x, y, w: cw, h };
      H.addHit({ x, y, w: cw, h, fn: () => { snd('tap'); toast(WHO[o.who].name + ' tahab: ' + o.items.map(([k, l]) => nm(k, l)).join(', ') + '.'); } });
    });
    const g2 = r.goals.find(x => x.type === 'order');
    if (g2 && r.orders.length === 0 && g2.got < g2.n) text('Ootame järgmist tellimust…', W / 2, y + h / 2, 15, INK2, 'center', 800);
  }
  function animState(i, t) {
    const a = V.anim.get(i), P = cellC(i); let x = P.x, y = P.y, s = 1, hide = false, sq = 0;
    if (a) {
      const k = clamp((t - a.t0) / a.dur, 0, 1);
      if (t < a.t0) { if (a.fx !== undefined || a.pop) hide = true; return { x, y, s, hide, sq }; }
      if (a.hide) hide = k < 1;
      if (a.fx !== undefined) { const e = ease.outCubic(k); x = lerp(a.fx, P.x, e); y = lerp(a.fy, P.y, e); if (a.arc) y -= Math.sin(k * Math.PI) * V.G.cs * 0.6; }
      if (a.pop) s = k < 1 ? 0.5 + 0.5 * ease.outElastic(k) : 1;
      if (a.squash) sq = Math.sin(k * Math.PI) * 0.14;
      if (a.shake) x += Math.sin(k * Math.PI * 6) * 4 * (1 - k);
      if (k >= 1) V.anim.delete(i);
    }
    return { x, y, s, hide, sq };
  }
  function drawLevelBoard(t, G, r) {
    const cs = G.cs;
    panel(G.bx - 6, G.by - 6, G.bw + 12, G.bh + 12, 'glass');
    const tc = V.drag ? dragCell() : -1, dk = V.drag ? V.drag.it : null;
    for (let i = 0; i < LN; i++) {
      if (r.vd[i]) continue;
      const x = G.bx + (i % LC) * cs, y = G.by + ((i / LC) | 0) * cs;
      let state = 'empty';
      if (dk && i !== V.drag.from) { const k = LV.canDrop(r, V.drag.from, i); if (k === 'merge' || k === 'crate') state = i === tc ? 'target' : 'hint'; else if (i === tc && k) state = 'hint'; }
      if (V.mode && r.it[i] && !LV.boostCheck(r, V.mode, i)) state = 'hint';
      let drawn = false;
      if (artOn('cell')) { try { ART.cell(g, x, y, cs, state); drawn = true; } catch (e) {} }
      if (!drawn) { g.fillStyle = state === 'target' ? 'rgba(255,214,110,0.9)' : state === 'hint' ? 'rgba(190,240,160,0.85)' : 'rgba(255,248,232,0.88)'; rr(x + 2, y + 2, cs - 4, cs - 4, 10); g.fill(); }
      if (r.sand[i]) drawObstacle('sand', x, y, cs, 1);
    }
    // selection
    if (V.sel >= 0 && r.it[V.sel] && !(V.drag && V.drag.from === V.sel)) {
      const P = cellC(V.sel), q = 1 + Math.sin(t * 5) * 0.03, h = cs * 0.5 * q;
      g.lineWidth = 3; g.strokeStyle = '#ffb03a'; rr(P.x - h + 2, P.y - h + 2, h * 2 - 4, h * 2 - 4, 12); g.stroke();
    }
    const isz = cs * 0.9;
    for (let i = 0; i < LN; i++) {
      if (r.vd[i]) continue;
      const d = animState(i, t);
      if (r.box[i]) { g.save(); g.translate(d.x, d.y); g.scale(d.s, d.s); drawObstacle('box', -cs / 2, -cs / 2, cs, r.def.box[i] > r.box[i] ? 'cracked' : r.box[i]); g.restore(); continue; }
      if (r.crate[i]) {
        const pu = 1 + Math.sin(t * 3 + i) * 0.02; drawObstacle('crate', d.x - cs * pu / 2, d.y - cs * pu / 2, cs * pu, r.crate[i]);
        if (artOn('obstacle') && r.crate[i] >= 2) { g.fillStyle = DARK; rr(d.x - 18, d.y + cs * 0.22, 36, 20, 10); g.fill(); text('×2', d.x, d.y + cs * 0.22 + 10, 15, '#ffd23f', 'center', 900); }
        continue;
      }
      if (r.bub[i]) { const wob = 1 + Math.sin(t * 2.5 + i) * 0.04; g.save(); g.translate(d.x, d.y); g.scale(d.s * wob, d.s / wob); drawObstacle('bubble', -cs / 2, -cs / 2, cs, 1); g.restore(); continue; }
      const it = r.it[i], ice = r.ice[i] ? () => drawObstacle('ice', G.bx + (i % LC) * cs, G.by + ((i / LC) | 0) * cs, cs, r.def.ice[i] > r.ice[i] ? 'cracked' : r.ice[i]) : null;
      if (!it || (V.drag && V.drag.from === i) || d.hide) { if (ice) ice(); continue; }
      g.save(); g.translate(d.x, d.y); g.scale(d.s * (1 + d.sq), d.s * (1 - d.sq));
      drawItem(it.k, it.l, 0, 0, isz);
      g.restore();
      if (ice) ice();
      if (r.web[i]) drawObstacle('web', d.x - cs / 2, d.y - cs / 2, cs, 1);
      for (const g2 of r.goals) if (g2.type === 'make' && g2.got < g2.n && it.k === g2.k && it.l === g2.l - 1) { const s = Math.max(20, cs * 0.3); drawIcon('star', d.x + cs * 0.5 - s * 0.95, d.y - cs * 0.5 - s * 0.05, s); break; }
    }
    // flying ghosts
    for (let j = V.ghosts.length - 1; j >= 0; j--) {
      const o = V.ghosts[j], k = (t - o.t0) / o.dur; if (k < 0) continue;
      if (k >= 1) { V.ghosts.splice(j, 1); continue; }
      const e = ease.outCubic(k), x = lerp(o.x0, o.x1, e), y = lerp(o.y0, o.y1, e) - Math.sin(k * Math.PI) * 40, s = cs * lerp(o.s0, o.s1, e);
      if (o.star) drawIcon('star', x - s / 2, y - s / 2, s); else drawItem(o.k, o.l, x, y, s);
    }
  }
  function drawBoostBar(t, G, r) {
    const y = G.boostY, n = BOOST_KEYS.length, bw = Math.min(120, (G.cw - 12) / n), x0 = W / 2 - (bw * n) / 2;
    panel(x0 - 4, y, bw * n + 8, G.boostH, 'glass');
    BOOST_KEYS.forEach((k, j) => {
      const x = x0 + j * bw, cnt = S.adv.boost[k] || 0, on = V.mode === k, ps = H.pressScale(x, y);
      if (on) { g.fillStyle = 'rgba(124,92,255,0.25)'; rr(x + 4, y + 4, bw - 8, G.boostH - 8, 16); g.fill(); g.lineWidth = 3; g.strokeStyle = GRAPE; g.stroke(); }
      const is = 50 * ps * (on ? 1 + Math.sin(t * 6) * 0.06 : 1);
      g.globalAlpha = cnt > 0 || on ? 1 : 0.55; drawBoost(k, x + bw / 2 - is / 2, y + 8 + (50 - is) / 2, is); g.globalAlpha = 1;
      text(BOOSTERS[k].name, x + bw / 2, y + G.boostH - 18, 15, INK, 'center', 900, bw - 6);
      if (cnt > 0) { g.fillStyle = GRAPE; g.beginPath(); g.arc(x + bw / 2 + 24, y + 14, 13, 0, 7); g.fill(); g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke(); text(String(cnt), x + bw / 2 + 24, y + 15, 15, '#fff', 'center', 900); }
      else { g.fillStyle = MINT; g.beginPath(); g.arc(x + bw / 2 + 24, y + 14, 13, 0, 7); g.fill(); g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke(); text('+', x + bw / 2 + 24, y + 14, 18, '#fff', 'center', 900); }
      H.addHit({ x, y, w: bw, h: G.boostH, bx: x, by: y, fn: () => tapBoost(k) });
    });
  }
  function tapBoost(k) {
    const r = V.r; snd('tap');
    if (r.over && k !== 'moves') return;
    if (V.mode === k) { V.mode = null; return; }
    if (!(S.adv.boost[k] > 0)) { H.openModal({ kind: 'advBuy', boost: k }); return; }
    if (BOOSTERS[k].target) { V.mode = k; V.sel = -1; return; }
    const why = LV.boostCheck(r, k);
    if (why) { toast(why === 'none' ? 'Kõigil asjadel on juba paariline.' : 'Praegu ei saa seda kasutada.'); snd('deny'); return; }
    LV.boost(k);
  }
  const dragCell = () => V.drag ? cellAt(V.drag.x, V.drag.y - V.drag.lift * 0.75) : -1;

  // ---------- input (from UI's pointer handlers) ----------
  function down(p, ptr) {
    if (UI.scr === 'map') { M.drag = { y0: p.y, s0: M.scroll, ly: p.y, lt: performance.now() }; M.vel = 0; return; }
    if (!V) return;
    const c = cellAt(p.x, p.y);
    V.ptr = { cell: c, touch: ptr.touch };
  }
  function move(p, ptr) {
    if (UI.scr === 'map') {
      if (!M.drag) return;
      const now2 = performance.now(), dt = Math.max(1, now2 - M.drag.lt);
      M.vel = lerp(M.vel, (p.y - M.drag.ly) / dt * 1000, 0.5); M.drag.ly = p.y; M.drag.lt = now2;
      M.scroll = M.drag.s0 + (p.y - M.drag.y0); clampScroll(mapGeo()); return;
    }
    if (!V || !V.ptr) return;
    if (!V.drag && ptr.moved && !V.mode && V.ptr.cell >= 0 && LV.pickable(V.r, V.ptr.cell) && !V.r.over) {
      V.drag = { from: V.ptr.cell, it: V.r.it[V.ptr.cell], x: p.x, y: p.y, lift: V.ptr.touch ? V.G.cs * 0.42 : 0 }; V.sel = V.ptr.cell; snd('pick');
    }
    if (V.drag) { V.drag.x = p.x; V.drag.y = p.y; }
  }
  function up(q, ptr, cancel) {
    if (UI.scr === 'map') {
      const d = M.drag; M.drag = null;
      if (!d) return false;
      if (ptr.moved) { if (performance.now() - d.lt > 120) M.vel = 0; return true; }
      M.vel = 0;
      for (const nd of M.nodes) if (Math.hypot(q.x - nd.x, q.y - nd.y) < nd.r) { tapNode(nd.n); return true; }
      return false;
    }
    if (!V) return false;
    const pp = V.ptr; V.ptr = null;
    if (V.drag) {
      const d = V.drag, tc = cancel ? -1 : dragCell(); V.drag = null;
      V.dropPt = { x: d.x, y: d.y - d.lift };
      let ok = null;
      if (tc >= 0 && tc !== d.from) ok = LV.drop(V.r, d.from, tc);
      if (!ok && V.r.it[d.from] === d.it) {
        setAnim(d.from, { fx: V.dropPt.x, fy: V.dropPt.y, dur: 0.2 });
        if (tc >= 0 && tc !== d.from) denyWhy(d.from, tc); else snd('drop');
      }
      V.dropPt = null; return true;
    }
    if (cancel || ptr.moved || !pp) return false;
    const c = cellAt(q.x, q.y);
    if (c < 0 || c !== pp.cell) { if (V.mode && c < 0) return false; return false; }
    tapLevelCell(c);
    return true;
  }
  function denyWhy(a, b) {
    const r = V.r; snd('deny');
    if (r.crate[b]) toast(r.it[a].k === 'key' ? 'Selle kirsti jaoks on vaja paremat võtit.' : 'Kirst avaneb ainult võtmega.');
    else if (r.box[b]) toast('Kast avaneb, kui ühendad selle kõrval.');
    else if (r.bub[b]) toast('Mull lõhkeb, kui ühendad selle kõrval.');
    else if (r.web[b]) toast('See asi on ämblikuvõrgus. Ühenda selle kõrval!');
  }
  function tapLevelCell(c) {
    const r = V.r;
    if (V.mode) {
      const k = V.mode, why = LV.boostCheck(r, k, c);
      if (why) { snd('deny'); toast(why === 'max' ? 'See on juba tipptasemel.' : why === 'small' ? 'Väikseimat asja ei saa pooleks lõigata.' : why === 'web' ? 'Võrgus olevat asja ei saa lõigata.' : why === 'full' ? 'Laual pole vaba ruutu.' : 'Toksa mõnda asja.'); return; }
      V.mode = null; LV.boost(k, c); return;
    }
    if (r.box[c]) { snd('tap'); toast('Kast: ühenda selle kõrval, et see avada.'); return; }
    if (r.crate[c]) { snd('tap'); toast('Lukus kirst: lohista sinna ' + (r.crate[c] >= 2 ? '„Võti“ või parem.' : 'mõni võti.') + ' Annab +' + LV.CRATE_MOVES + ' käiku!'); return; }
    if (r.bub[c]) { snd('tap'); toast('Mullid levivad. Ühenda nende kõrval!'); return; }
    const it = r.it[c];
    if (!it) { if (r.sand[c]) { snd('tap'); toast('Liivale uusi asju ei tule.'); } V.sel = -1; return; }
    snd('tap'); setAnim(c, { squash: 1, dur: 0.22 });
    if (V.sel === c || r.web[c]) toast(nm(it.k, it.l) + (r.web[c] ? ' on võrgus. Ühenda selle kõrval!' : it.l < CHAINS[it.k].names.length ? ' → ' + nm(it.k, it.l + 1) : ' (tipptase)'));
    V.sel = c;
  }
  function tapNode(n) {
    if (n > S.adv.top) { snd('deny'); toast('Läbi enne tase ' + S.adv.top + '.'); return; }
    snd('tap'); openStart(n);
  }

  // ---------- flow ----------
  function openStart(n) { H.openModal({ kind: 'advStart', n, def: LV.gen(n) }); }
  function play(n) {
    LV.tickHearts();
    if (S.adv.hearts <= 0) { H.closeModal(true); H.openModal({ kind: 'advHearts' }); return; }
    const r = LV.start(n); if (!r) return;
    H.closeModal(true);
    enterLevel(r);
  }
  function backToMap(focusNext) {
    V = null; UI.goScreen('map');
    if (focusNext) { const G = mapGeo(); M.walk = { from: M.scroll, to: scrollFor(G, S.adv.top), t0: tn() }; }
  }
  function update(dt) {
    if (UI.scr === 'map') {
      if (M.walk) { const k = clamp((tn() - M.walk.t0) / 0.9, 0, 1); M.scroll = lerp(M.walk.from, M.walk.to, ease.inOutSine(k)); if (k >= 1) M.walk = null; }
      else if (!M.drag && Math.abs(M.vel) > 5) { M.scroll += M.vel * dt; M.vel *= Math.pow(0.05, dt); clampScroll(mapGeo()); }
      return;
    }
    // The win celebration (Ash's FX.levelWin: fireworks, stars, "Tubli!") plays over the board first, then the panel.
    if (V && V.winRes && tn() > V.winAt && !H.modal) { const res = V.winRes; V.winRes = null; H.openModal({ kind: 'advWin', res, sticky: true, onDone: () => backToMap(true) }); }
    if (V && V.r.over && !V.endShown && V.endAt && tn() > V.endAt && !H.modal) {
      V.endShown = true;
      if (V.r.won) {
        const res = LV.win(), big = fx('levelWin', { stars: res ? res.stars : 1 });
        if (!big) fx('confetti', 1);
        snd2('levelWin', 'taskDone', { stars: res ? res.stars : 1 });
        V.winRes = res; V.winAt = tn() + (big ? 2.3 : 0.3);
      } else {
        fx('levelFail'); snd2('levelFail', 'deny');
        H.openModal({ kind: 'advFail', sticky: true, onDone: () => { const r = LV.cur; if (V && r && r === V.r && r.over && !r.won) { V.endShown = false; V.endAt = tn() + 0.2; } } });
      }
    }
  }
  function entered(s, was) {
    try { if (typeof MUSIC !== 'undefined' && MUSIC && MUSIC.mood) MUSIC.mood('normal'); } catch (e) {}
    if (s === 'map') { M.scroll = null; M.vel = 0; music('map'); }
    else if (s === 'level' && V) music('level', { chapter: V.r.def.chapter + 1, level: V.r.n });
    if (s !== 'level' && was === 'level' && LV.cur && !LV.cur.won && !LV.cur.paid) LV.quit();
  }

  // ---------- modals ----------
  function starRow(cx, y, s, n, t0, big) {
    for (let j = 0; j < 3; j++) {
      const age = t0 === undefined ? 9 : tn() - t0 - 0.35 - j * 0.32, k = clamp(age / 0.35, 0, 1), on = j < n && k > 0;
      const sc = on ? 0.4 + 0.6 * ease.outBack(k) : 1, x = cx + (j - 1) * s * 1.05, yy = y - (j === 1 ? s * 0.18 : 0);
      g.save(); g.translate(x, yy); g.scale(sc, sc); g.globalAlpha = on ? 1 : 0.28; drawIcon('star', -s / 2, -s / 2, s); g.restore();
      if (big && on && k < 1 && !big['s' + j]) { big['s' + j] = 1; snd2('star', 'stars', { n: j + 1 }); fx('sparkle', x, yy, 10, s * 0.6); }
    }
  }
  function drawModal(m, t, B) {
    W = H.W; Hh = H.H;
    if (m.kind === 'advStart') {
      const d = m.def, n = m.n, boss = d.kind === 'boss', A = S.adv;
      const P = H.modalPanel(m, 420, 430 + (d.goals.length - 1) * 56, boss ? 'Suur tellimus!' : 'Tase ' + n);
      if (boss) text('Tase ' + n, P.x + P.w / 2, P.y + 40, 16, INK2, 'center', 900);
      starRow(P.x + P.w / 2, P.y + 80, 40, A.stars[n] || 0);
      text('Eesmärk', P.x + P.w / 2, P.y + 124, 18, INK, 'center', 900);
      d.goals.forEach((g2, j) => {
        const y = P.y + 140 + j * 56; g.fillStyle = SOFT; rr(P.x + 16, y, P.w - 32, 50, 14); g.fill();
        goalIcon(g2, P.x + 24, y + 4, 42); text(goalText(g2), P.x + 76, y + 26, 18, INK, 'left', 900, P.w - 100);
      });
      let y = P.y + 140 + d.goals.length * 56 + 6;
      drawIcon('moves', P.x + 24, y, 34); text(d.moves + ' käiku' + (A.streak ? ' + ' + Math.min(3, A.streak) + ' võiduseeria eest' : ''), P.x + 66, y + 18, 17, INK, 'left', 900, P.w - 86);
      y += 44;
      if (d.obs.length) {
        text('Takistused:', P.x + 24, y + 18, 16, INK2, 'left', 800);
        d.obs.forEach((o, j) => { drawObstacle(o, P.x + 130 + j * 44, y, 36, o === 'crate' ? 1 : 1); });
        H.addHit({ x: P.x + 120, y, w: P.w - 140, h: 40, fn: () => { snd('tap'); toast(d.obs.map(o => OBST_NAME[o]).join(', ') + '.'); } }, true);
      } else text('Takistusi pole. Puhka natuke!', P.x + 24, y + 18, 16, INK2, 'left', 800, P.w - 48);
      y += 50;
      // lives
      LV.tickHearts();
      for (let j = 0; j < HEART_MAX; j++) { g.globalAlpha = j < A.hearts ? 1 : 0.25; drawIcon('heart', P.x + P.w / 2 - HEART_MAX * 17 + j * 34, y, 30); } g.globalAlpha = 1;
      const by = P.y + P.h - 70;
      if (A.hearts > 0) button(P.x + 30, by, P.w - 60, 58, 'Mängi!', () => play(n), Object.assign({ hot: true, pulse: 1, size: 24 }, B));
      else button(P.x + 30, by, P.w - 60, 58, 'Elud: ' + fmtTime(LV.heartNext()), () => { H.closeModal(true); H.openModal({ kind: 'advHearts' }); }, Object.assign({ style: 'buttonGrey', size: 20 }, B));
    } else if (m.kind === 'advTip') {
      const k = m.tip, P = H.modalPanel(m, 400, 330, k === 'boss' ? 'Suur tellimus' : 'Uus asi!');
      const s = 84, x = P.x + P.w / 2 - s / 2, y = P.y + 40;
      if (OBST_NAME[k]) drawObstacle(k, x, y, s, k === 'ice' ? 2 : 1);
      else if (k === 'make') drawItem('bread', 3, x + s / 2, y + s / 2, s);
      else if (k === 'order' || k === 'boss') H.drawPortrait('liisa', x, y, s);
      wrap(ADV_TIPS[k], P.w - 48, 18, 800).forEach((s2, j) => text(s2, P.x + P.w / 2, P.y + 150 + j * 25, 18, INK, 'center', 800));
      button(P.x + 50, P.y + P.h - 70, P.w - 100, 54, 'Selge!', () => H.closeModal(), Object.assign({ hot: true, size: 21 }, B));
    } else if (m.kind === 'advPause') {
      const r = LV.cur, P = H.modalPanel(m, 380, 300, 'Paus');
      if (r) r.goals.forEach((g2, j) => text(goalText(g2) + ': ' + g2.got + '/' + g2.n, P.x + P.w / 2, P.y + 50 + j * 26, 17, INK, 'center', 800, P.w - 30));
      button(P.x + 30, P.y + 110, P.w - 60, 54, 'Jätka', () => H.closeModal(), Object.assign({ hot: true, size: 21 }, B));
      const costs = r && (r.used > 0 || r.over) && !r.won;
      button(P.x + 30, P.y + 176, P.w - 60, 50, 'Loobu', () => { H.closeModal(true); if (costs) { LV.lose(); toast('Kaotasid ühe elu. Proovi uuesti!'); } else LV.quit(); backToMap(false); }, Object.assign({ style: 'buttonGrey', size: 19 }, B));
      if (costs) text('Kui loobud, kaotad ühe elu.', P.x + P.w / 2, P.y + P.h - 24, 15, INK2, 'center', 700, P.w - 20);
    } else if (m.kind === 'advWin') drawWin(m, t, B);
    else if (m.kind === 'advFail') drawFail(m, t, B);
    else if (m.kind === 'advBuy') {
      const k = m.boost, Bo = BOOSTERS[k], P = H.modalPanel(m, 380, 330, Bo.name);
      drawBoost(k, P.x + P.w / 2 - 44, P.y + 36, 88);
      wrap(Bo.desc, P.w - 40, 17, 800).forEach((s, j) => text(s, P.x + P.w / 2, P.y + 150 + j * 24, 17, INK, 'center', 800));
      text('Võlukeppe, kääre ja muud saab ka õnnerattast ja tasemetelt.', P.x + P.w / 2, P.y + 196, 15, INK2, 'center', 700, P.w - 24);
      button(P.x + 40, P.y + P.h - 76, P.w - 80, 56, 'Osta · ' + Bo.price, () => { if (LV.buyBoost(k)) { H.closeModal(true); snd('coins'); toast(Bo.name + ' on sinu!'); } else { snd('deny'); toast('Münte jääb puudu.'); } }, Object.assign({ icon: 'coin', hot: S.coins >= Bo.price, off: S.coins < Bo.price, offFn: () => { snd('deny'); toast('Münte jääb puudu.'); }, size: 20 }, B));
    } else if (m.kind === 'advHearts') {
      LV.tickHearts();
      const A = S.adv, P = H.modalPanel(m, 380, 340, 'Elud'), full = A.hearts >= HEART_MAX;
      for (let j = 0; j < HEART_MAX; j++) { const pu = j === A.hearts && !full ? 1 + Math.sin(t * 5) * 0.08 : 1; g.globalAlpha = j < A.hearts ? 1 : 0.25; drawIcon('heart', P.x + P.w / 2 - HEART_MAX * 30 + j * 60 + 6 - 24 * (pu - 1), P.y + 44 - 24 * (pu - 1), 48 * pu); } g.globalAlpha = 1;
      text(full ? 'Elud on täis!' : 'Järgmine elu ' + fmtTime(LV.heartNext()) + ' pärast', P.x + P.w / 2, P.y + 124, 19, INK, 'center', 900, P.w - 24);
      wrap('Elu kulub ainult siis, kui tase jääb pooleli. Iga 15 minutiga tuleb üks tagasi.', P.w - 40, 15, 700).forEach((s, j) => text(s, P.x + P.w / 2, P.y + 158 + j * 21, 15, INK2, 'center', 700));
      if (!full) button(P.x + 40, P.y + P.h - 76, P.w - 80, 56, 'Täida elud · ' + HEART_REFILL_PRICE, () => { if (LV.refillHearts()) { snd2('heart', 'coins'); fx('hearts', P.x + P.w / 2, P.y + 60, 8); H.closeModal(true); } else { snd('deny'); toast('Münte jääb puudu.'); } }, Object.assign({ icon: 'coin', hot: S.coins >= HEART_REFILL_PRICE, off: S.coins < HEART_REFILL_PRICE, offFn: () => { snd('deny'); toast('Münte jääb puudu.'); }, size: 19 }, B));
      else button(P.x + 40, P.y + P.h - 76, P.w - 80, 56, 'Super!', () => H.closeModal(), Object.assign({ hot: true, size: 20 }, B));
    } else if (m.kind === 'advWheel') drawWheel(m, t, B);
    else if (m.kind === 'advPiggy') drawPiggy(m, t, B);
  }
  function drawWin(m, t, B) {
    const res = m.res || { n: 0, stars: 1, rew: {} }, age = tn() - m.t0;
    const P = H.modalPanel(m, 420, 420, 'Tase ' + res.n + ' läbitud!');
    starRow(P.x + P.w / 2, P.y + 92, 62, res.stars, m.t0, m);
    if (res.stars > res.prev && res.prev > 0 && age > 1.4) text('Uus rekord!', P.x + P.w / 2, P.y + 146, 18, PINK, 'center', 900);
    else text(['', 'Hästi tehtud!', 'Väga tubli!', 'Täiuslik!'][res.stars], P.x + P.w / 2, P.y + 146, 20, INK, 'center', 900);
    const items = H.describe(res.rew);
    const tw = 86, x0 = P.x + P.w / 2 - (items.length * (tw + 8) - 8) / 2, ty = P.y + 170;
    items.forEach((d, j) => {
      const kk = clamp((age - 1.2 - j * 0.15) / 0.3, 0, 1); if (kk <= 0) return;
      const s = ease.outBack(kk), x = x0 + j * (tw + 8);
      g.save(); g.translate(x + tw / 2, ty + 48); g.scale(s, s); g.translate(-x - tw / 2, -ty - 48);
      g.fillStyle = CARD; rr(x, ty, tw, 96, 16); g.fill(); g.lineWidth = 3; g.strokeStyle = GOLD; g.stroke();
      if (d.boost) drawBoost(d.boost, x + tw / 2 - 24, ty + 8, 48); else if (d.icon) drawIcon(d.icon, x + tw / 2 - 24, ty + 8, 48); else drawItem(d.item[0], d.item[1], x + tw / 2, ty + 32, 48);
      text(d.t, x + tw / 2, ty + 76, 15, INK, 'center', 900, tw - 8);
      g.restore();
    });
    if (age > 1.2 && !m.paid) { m.paid = 1; H.rewardFx({ coins: res.rew.coins, energy: res.rew.energy }, P.x + P.w / 2, ty + 48); }
    if (res.streak > 1) text('Võiduseeria: ' + res.streak + ' järjest!', P.x + P.w / 2, ty + 120, 17, PINK, 'center', 900, P.w - 20);
    if (age > 0.9) {
      const bw = (P.w - 50) / 2, by = P.y + P.h - 72;
      button(P.x + 20, by, bw, 56, 'Kaart', () => H.closeModal(true), Object.assign({ style: 'buttonBlue', size: 20 }, B));
      button(P.x + 30 + bw, by, bw, 56, 'Edasi', () => { H.closeModal(true); openStart(S.adv.top); }, Object.assign({ hot: true, pulse: 1, size: 21 }, B));
    }
    H.keep(0.1);
  }
  function drawFail(m, t, B) {
    const r = LV.cur;
    if (!r) { H.closeModal(true); return; }
    const rem = LV.remaining(r), est = rem.est;
    const head = est <= 1 ? 'Ainult 1 käik puudu!' : est <= 4 ? 'Ainult ' + est + ' käiku puudu!' : 'Käigud said otsa!';
    const P = H.modalPanel(m, 420, 270 + rem.list.length * 50, est <= 4 ? 'Nii lähedal!' : 'Oi-oi!');
    textO(head, P.x + P.w / 2, P.y + 52, 24, '#fff', PINK, 6, P.w - 30);
    text('Puudu jäi:', P.x + P.w / 2, P.y + 94, 16, INK2, 'center', 800);
    rem.list.forEach((x, j) => {
      const y = P.y + 108 + j * 50, g2 = r.goals.find(q => q.type === x.type);
      g.fillStyle = SOFT; rr(P.x + 30, y, P.w - 60, 44, 14); g.fill(); goalIcon(g2, P.x + 38, y + 4, 36);
      text(goalText(g2, x.left), P.x + 84, y + 23, 17, INK, 'left', 900, P.w - 124);
    });
    const have = S.adv.boost.moves > 0, price = LV.movesPrice(), by = P.y + P.h - 136;
    if (have) button(P.x + 30, by, P.w - 60, 60, '+5 käiku (sul on ' + S.adv.boost.moves + ')', () => { if (LV.boost('moves')) { H.closeModal(true); V.endShown = false; V.endAt = 0; moodCheck(); } }, Object.assign({ hot: true, pulse: 1, size: 20 }, B));
    else button(P.x + 30, by, P.w - 60, 60, '+5 käiku · ' + price, () => { if (LV.buyMoves()) { snd('coins'); H.closeModal(true); V.endShown = false; V.endAt = 0; moodCheck(); } else { snd('deny'); toast('Münte jääb puudu.'); } }, Object.assign({ icon: 'coin', hot: S.coins >= price, pulse: S.coins >= price, off: S.coins < price, offFn: () => { snd('deny'); toast('Münte jääb puudu.'); }, size: 21 }, B));
    button(P.x + 60, by + 70, P.w - 120, 48, 'Loobu', () => { H.closeModal(true); LV.lose(); toast(S.adv.hearts > 0 ? 'Kaotasid ühe elu. Järgmine kord läheb paremini!' : 'Elud said otsa. Puhka natuke!', 3); backToMap(false); }, Object.assign({ style: 'buttonGrey', size: 18 }, B));
  }
  // Lucky wheel
  const WH = { angle: 0, spin: null };
  function openWheel() { H.openModal({ kind: 'advWheel' }); }
  function wheelSpin(m) {
    if (WH.spin) return;
    const i = Game.spinWheel(); if (i < 0) { snd('deny'); toast('Uus tasuta keerutus tuleb homme.'); return; }
    const seg = Math.PI * 2 / WHEEL.length, cur = WH.angle % (Math.PI * 2);
    const jitter = (Math.random() - 0.5) * seg * 0.6;
    const target = WH.angle - cur + Math.PI * 2 * 6 + (Math.PI * 2 - (i + 0.5) * seg) + jitter;
    WH.spin = { from: WH.angle, to: target, t0: tn(), dur: 4.2, i, last: -1 };
    m.sticky = true; m.result = null; snd('tap');
  }
  // Slices for Ash's wheel: an icon name, item key or canvas, a short label and the colour.
  let slicesC = null;
  function wheelSlices() {
    if (slicesC) return slicesC;
    slicesC = WHEEL.map(w => {
      const r = w.r, b = typeof r.boost === 'string' ? r.boost : null;
      const icon = w.big ? 'trophy' : r.item ? r.item[0] : b ? boostImg(b, 96) : r.energy ? 'energy' : 'coin';
      return { icon, label: w.big ? 'Suur!' : r.coins && !r.item ? String(r.coins) : r.energy ? '+' + r.energy : w.label, color: w.color };
    });
    return slicesC;
  }
  function drawWheel(m, t, B) {
    const P = H.modalPanel(m, 420, 580, 'Õnneratas'), R = Math.min(P.w * 0.4, 160), cx = P.x + P.w / 2, cy = P.y + 70 + R;
    const seg = Math.PI * 2 / WHEEL.length;
    if (WH.spin) {
      const k = clamp((tn() - WH.spin.t0) / WH.spin.dur, 0, 1);
      WH.angle = lerp(WH.spin.from, WH.spin.to, ease.outCubic(k) * 0.35 + (1 - Math.pow(1 - k, 4)) * 0.65);
      const idx = Math.floor(((-WH.angle % (Math.PI * 2)) + Math.PI * 4) % (Math.PI * 2) / seg);
      if (idx !== WH.spin.last) { WH.spin.last = idx; snd2('wheelTick', 'tap', { speed: clamp(1 - k, 0, 1) }); }
      if (k >= 1) {
        const w = WHEEL[WH.spin.i]; m.result = { w, t0: tn() }; WH.spin = null; m.sticky = false;
        snd2('wheelWin', 'lucky', { big: !!w.big }); fx('confetti', w.big ? 1 : 0.5, cx, cy - R); H.rewardFx(w.r, cx, cy);
        banner({ text: w.big ? 'Suur auhind!' : 'Võitsid!', sub: H.describe(w.r).map(d => d.t).join(', '), x: cx, y: cy - 20, color: GOLD, size: w.big ? 40 : 34, rays: w.big ? 1 : 0, dur: 2.2 });
      }
      H.keep(0.1);
    }
    let drawn = false;
    if (artOn('wheel')) { try { ART.wheel(g, cx, cy, R, wheelSlices(), WH.angle + seg / 2, t); drawn = true; } catch (e) {} }
    if (!drawn) {
      g.fillStyle = 'rgba(60,20,120,0.2)'; g.beginPath(); g.arc(cx, cy + 6, R + 10, 0, 7); g.fill();
      g.fillStyle = '#7a3ac8'; g.beginPath(); g.arc(cx, cy, R + 10, 0, 7); g.fill();
      for (let j = 0; j < WHEEL.length; j++) {
        const a0 = WH.angle + j * seg - Math.PI / 2, w = WHEEL[j];
        g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, a0, a0 + seg); g.closePath(); g.fillStyle = w.color; g.fill(); g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke();
        g.save(); g.translate(cx, cy); g.rotate(a0 + seg / 2);
        const d = H.describe(w.r)[0], is = R * 0.26;
        g.save(); g.translate(R * 0.66, 0); g.rotate(Math.PI / 2);
        if (w.big) drawIcon('star', -is / 2, -is / 2, is); else if (d.boost) drawBoost(d.boost, -is / 2, -is / 2, is); else if (d.icon) drawIcon(d.icon, -is / 2, -is / 2, is); else drawItem(d.item[0], d.item[1], 0, 0, is);
        g.restore();
        g.translate(R * 0.36, 0); g.rotate(Math.PI / 2); text(w.big ? 'SUUR' : w.r.coins && !w.r.item ? String(w.r.coins) : w.r.energy ? '+' + w.r.energy : '', 0, 0, 15, '#33285c', 'center', 900, R * 0.4);
        g.restore();
      }
      for (let j = 0; j < 16; j++) { const a = j / 16 * Math.PI * 2 + t * 2; g.fillStyle = Math.floor(t * 4 + j) % 2 ? '#fff6b0' : '#ffd23f'; g.beginPath(); g.arc(cx + Math.cos(a) * (R + 5), cy + Math.sin(a) * (R + 5), 3.5, 0, 7); g.fill(); }
      g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, R * 0.16, 0, 7); g.fill(); g.lineWidth = 4; g.strokeStyle = '#7a3ac8'; g.stroke();
    }
    // pointer
    g.fillStyle = PINK; g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy - R + 18); g.lineTo(cx - 16, cy - R - 16); g.lineTo(cx + 16, cy - R - 16); g.closePath(); g.fill(); g.stroke();
    const spins = Game.wheelSpins(), free = Game.wheelFree(), by = cy + R + 30;
    if (m.result) text('Võitsid: ' + H.describe(m.result.w.r).map(d => d.t).join(', '), cx, by + 4, 17, INK, 'center', 900, P.w - 30);
    else text(free ? 'Üks tasuta keerutus iga päev!' : spins ? 'Keerutusi alles: ' + spins : 'Uus tasuta keerutus tuleb homme.', cx, by + 4, 17, INK, 'center', 900, P.w - 30);
    button(P.x + 40, by + 26, P.w - 80, 60, WH.spin ? 'Keerleb…' : free ? 'Keeruta tasuta!' : spins ? 'Keeruta! (' + spins + ')' : 'Homme jälle!', () => wheelSpin(m), Object.assign({ hot: !!spins && !WH.spin, pulse: !!spins && !WH.spin, off: !spins || !!WH.spin, offFn: () => { if (!WH.spin) { snd('deny'); toast('Keerutusi saab tasemetelt ja kalendrist.'); } }, size: 22 }, B));
    text('Lisakeerutusi saab tasemetelt ja kalendrist.', cx, P.y + P.h - 22, 15, INK2, 'center', 700, P.w - 24);
  }
  function drawPiggy(m, t, B) {
    const P = H.modalPanel(m, 400, 470, 'Hoiupõrsas'), pg = S.piggy, ready = Game.piggyReady(), k = pg.coins / PIGGY_MAX;
    const s = 150, bob = Math.sin(t * 2.4) * 4 * (ready ? 1.6 : 1), cx = P.x + P.w / 2;
    g.save(); g.translate(cx, P.y + 40 + s / 2 + bob); if (ready) g.rotate(Math.sin(t * 7) * 0.05 * (Math.sin(t * 1.3) > 0.4 ? 1 : 0)); drawIcon('piggy', -s / 2, -s / 2, s); g.restore();
    drawIcon('coin', cx - 52, P.y + 206, 32); text(fmtNum(pg.coins) + ' / ' + PIGGY_MAX, cx + 18, P.y + 223, 22, INK, 'center', 900);
    bar(P.x + 40, P.y + 252, P.w - 80, 16, k, '#ff8ac0');
    const msg = ready ? (pg.coins >= PIGGY_MAX ? 'Põrsas on täis! Ava ta täna tasuta.' : 'Täna saab põrsa tasuta avada!') : pg.day === dayKey() ? 'Täna on põrsas juba avatud. Homme saab jälle!' : 'Põrsas on veel kerge. Mängi edasi!';
    text(msg, cx, P.y + 292, 17, ready ? GOOD : INK, 'center', 900, P.w - 30);
    wrap('Iga ühendamine, tellimus ja läbitud tase poetab põrssasse münte.', P.w - 50, 15, 700).forEach((s2, j) => text(s2, cx, P.y + 322 + j * 21, 15, INK2, 'center', 700));
    button(P.x + 40, P.y + P.h - 76, P.w - 80, 58, ready ? 'Ava põrsas!' : 'Homme jälle', () => { m.tap = { x: cx, y: P.y + 110 }; Game.openPiggy(); }, Object.assign({ hot: ready, pulse: ready, off: !ready, offFn: () => { snd('deny'); toast(msg); }, size: 22 }, B));
  }
  function gameEv(kind, d) {
    const m = H.modal, p = m && m.tap || { x: W / 2, y: Hh * 0.4 };
    if (kind === 'piggy') { snd2('piggy', 'coins'); fx('confetti', 0.6, p.x, p.y); H.rewardFx({ coins: d.n }, p.x, p.y); banner({ text: '+' + d.n, sub: 'münti põrsast', x: p.x, y: p.y, color: GOLD, size: 40, dur: 1.8 }); }
  }

  // ---------- small things UI asks for ----------
  function attention() { try { return Game.wheelSpins() > 0 || Game.piggyReady(); } catch (e) { return false; } }
  function hudPos(name) {
    if (UI.scr === 'map') { if (name === 'coins' && mapHudR.coins) return mapHudR.coins; return mapHudR.coins || null; }
    if (V && V.G) return { x: W / 2, y: V.G.top + 30 };
    return null;
  }
  function toastRect() {
    if (UI.scr === 'level' && V && V.G) return { x: V.G.bx, y: V.G.by, w: V.G.bw, h: V.G.bh };
    return { x: 10, y: Hh * 0.2, w: W - 20, h: Hh * 0.52 };
  }
  const busy = () => !!(WH.spin || (V && (V.drag || V.anim.size || V.ghosts.length)) || M.drag || M.walk || Math.abs(M.vel) > 5);

  return {
    drawMap, drawLevel, drawModal, down, move, up, update, entered, gameEv, attention, hudPos, toastRect, busy, drawBoost, drawObstacle,
    openStart, play, backToMap, openWheel,
    get view() { return V; }, cellCenter: i => V ? cellC(i) : null, get map() { return M; }, get wheel() { return WH; },
  };
})();
