// Saarepagar version 3 phase B screens (Mira): the style picker (xStyle), the season pass "Hooaja rada" (xPass),
// the weekly event (xWeek), the wardrobe "Garderoob" (xLook), photo mode (xPhoto) and the rest note (xRest).
// Rules live in 36-tour.js; drawing helpers come from UI.H (50-ui.js). Ash's art is used when it exists:
//   ART.heroine(px, look) -> canvas        look = { outfit, hair, acc }
//   ART.pet(kind, px, acc) -> canvas       kind 'muri' | 'kutsu' | 'janku'; acc 'none' | 'bow' | 'collar' | 'hat'
//   ART.postcard(ctx, w, h, drawScene)     drawScene(ctx, x, y, w, h, t) paints the picture inside the frame
//   ART.icon('wardrobe' | 'camera' | 'brush' | 'pass' | 'week' | 'cur_<event key>')
const XUI = (() => {
  const H = UI.H, C = H.C, g = H.g;
  const { INK, INK2, CARD, GOOD, GOLD, PINK, GRAPE, SOFT, DARK } = C;
  const { rr, text, textO, wrap, bar, button, drawItem, drawIcon, dot, snd, snd2, fx, artOn, tn, toast, inR } = H;
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

  // ---------- placeholder heroine and pets (cached) until Ash's ART.heroine / ART.pet land ----------
  const cache = new Map();
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; }
  const OUTFIT_COL = { casual: ['#5a8ad8', '#ffffff'], summer: ['#ffd23f', '#ff9ac8'], chef: ['#ffffff', '#e8605a'], gala: ['#7c5cff', '#ffd23f'], cozy: ['#d8604a', '#f4e2c8'], beach: ['#3ac8c0', '#ffe08a'] };
  function heroineImg(px, look) {
    px = Math.max(16, Math.round(px));
    if (artOn('heroine')) { try { const c = ART.heroine(px, look); if (c && c.width) return c; } catch (e) {} }
    const key = 'h:' + px + ':' + look.outfit + look.hair + look.acc; let c = cache.get(key); if (c) return c;
    c = mk(px); const x = c.getContext('2d'), s = px, cx = s / 2, hr = s * 0.15, hy = s * 0.26;
    const [c1, c2] = OUTFIT_COL[look.outfit] || OUTFIT_COL.casual, hair = '#6a3a22', skin = '#f6d2b8';
    x.lineJoin = 'round'; x.lineWidth = Math.max(1.5, s * 0.018); x.strokeStyle = '#3a1f4a';
    // hair behind
    x.fillStyle = hair;
    if (look.hair === 'long') { x.beginPath(); x.roundRect ? x.roundRect(cx - hr * 1.15, hy - hr * 0.6, hr * 2.3, hr * 3.1, hr) : x.rect(cx - hr * 1.15, hy - hr * 0.6, hr * 2.3, hr * 3.1); x.fill(); x.stroke(); }
    if (look.hair === 'braid') { for (let j = 0; j < 5; j++) { x.beginPath(); x.ellipse(cx + hr * 0.9, hy + hr * 0.5 + j * hr * 0.45, hr * 0.28, hr * 0.26, 0, 0, 7); x.fill(); x.stroke(); } }
    // body (dress / outfit)
    x.fillStyle = c1; x.beginPath(); x.moveTo(cx - s * 0.1, hy + hr * 1.05); x.lineTo(cx + s * 0.1, hy + hr * 1.05); x.lineTo(cx + s * 0.25, s * 0.86); x.lineTo(cx - s * 0.25, s * 0.86); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = c2;
    if (look.outfit === 'chef') { x.fillRect(cx - s * 0.12, hy + hr * 1.8, s * 0.24, s * 0.3); x.strokeRect(cx - s * 0.12, hy + hr * 1.8, s * 0.24, s * 0.3); }
    else { x.beginPath(); x.moveTo(cx - s * 0.2, s * 0.72); x.lineTo(cx + s * 0.2, s * 0.72); x.lineTo(cx + s * 0.25, s * 0.86); x.lineTo(cx - s * 0.25, s * 0.86); x.closePath(); x.fill(); x.stroke(); }
    // legs
    x.fillStyle = skin; x.fillRect(cx - s * 0.09, s * 0.86, s * 0.05, s * 0.1); x.fillRect(cx + s * 0.04, s * 0.86, s * 0.05, s * 0.1);
    // head
    x.fillStyle = skin; x.beginPath(); x.arc(cx, hy + hr * 0.2, hr, 0, 7); x.fill(); x.stroke();
    x.fillStyle = '#3a1f4a'; for (const d of [-1, 1]) { x.beginPath(); x.arc(cx + d * hr * 0.38, hy + hr * 0.2, hr * 0.12, 0, 7); x.fill(); }
    x.strokeStyle = '#c0457a'; x.beginPath(); x.arc(cx, hy + hr * 0.45, hr * 0.3, 0.2, Math.PI - 0.2); x.stroke(); x.strokeStyle = '#3a1f4a';
    x.fillStyle = 'rgba(255,120,150,0.35)'; for (const d of [-1, 1]) { x.beginPath(); x.arc(cx + d * hr * 0.6, hy + hr * 0.5, hr * 0.18, 0, 7); x.fill(); }
    // hair on top
    x.fillStyle = hair; x.beginPath(); x.arc(cx, hy + hr * 0.05, hr * 1.05, Math.PI * 1.05, Math.PI * 1.95); x.closePath(); x.fill(); x.stroke();
    if (look.hair === 'bun') { x.beginPath(); x.arc(cx, hy - hr * 1.05, hr * 0.42, 0, 7); x.fill(); x.stroke(); }
    if (look.hair === 'bob') { for (const d of [-1, 1]) { x.beginPath(); x.ellipse(cx + d * hr * 0.95, hy + hr * 0.5, hr * 0.3, hr * 0.7, 0, 0, 7); x.fill(); x.stroke(); } }
    // accessory
    if (look.acc === 'glasses') { x.lineWidth = s * 0.014; for (const d of [-1, 1]) { x.beginPath(); x.arc(cx + d * hr * 0.4, hy + hr * 0.2, hr * 0.26, 0, 7); x.stroke(); } x.beginPath(); x.moveTo(cx - hr * 0.14, hy + hr * 0.2); x.lineTo(cx + hr * 0.14, hy + hr * 0.2); x.stroke(); }
    if (look.acc === 'hat') { x.fillStyle = '#e8c27a'; x.beginPath(); x.ellipse(cx, hy - hr * 0.55, hr * 1.6, hr * 0.32, 0, 0, 7); x.fill(); x.stroke(); x.beginPath(); x.ellipse(cx, hy - hr * 0.85, hr * 0.8, hr * 0.5, 0, Math.PI, 0); x.fill(); x.stroke(); x.fillStyle = '#ff4f9a'; x.fillRect(cx - hr * 0.8, hy - hr * 0.78, hr * 1.6, hr * 0.16); }
    if (look.acc === 'flower') { x.fillStyle = '#ff6fa8'; for (let j = 0; j < 5; j++) { const a = j / 5 * 7; x.beginPath(); x.arc(cx - hr * 0.75 + Math.cos(a) * hr * 0.2, hy - hr * 0.45 + Math.sin(a) * hr * 0.2, hr * 0.17, 0, 7); x.fill(); } x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(cx - hr * 0.75, hy - hr * 0.45, hr * 0.12, 0, 7); x.fill(); }
    if (look.acc === 'scarf') { x.fillStyle = '#ff4f7a'; x.fillRect(cx - hr * 0.9, hy + hr * 1.0, hr * 1.8, hr * 0.38); x.strokeRect(cx - hr * 0.9, hy + hr * 1.0, hr * 1.8, hr * 0.38); x.fillRect(cx + hr * 0.3, hy + hr * 1.3, hr * 0.38, hr * 1.0); }
    cache.set(key, c); return c;
  }
  const PET_COL = { muri: ['#8a8a96', '#5a5a66'], kutsu: ['#c8925a', '#7a5226'], janku: ['#f4f0ea', '#b8a894'] };
  function petImg(kind, px, acc) {
    px = Math.max(16, Math.round(px));
    if (artOn('pet')) { try { const c = ART.pet(kind, px, acc); if (c && c.width) return c; } catch (e) {} }
    const key = 'p:' + kind + ':' + px + ':' + acc; let c = cache.get(key); if (c) return c;
    c = mk(px); const x = c.getContext('2d'), s = px, cx = s / 2, [f, d] = PET_COL[kind] || PET_COL.muri;
    x.lineJoin = 'round'; x.lineWidth = Math.max(1.5, s * 0.025); x.strokeStyle = '#3a2a3a'; x.fillStyle = f;
    x.beginPath(); x.ellipse(cx, s * 0.72, s * 0.26, s * 0.2, 0, 0, 7); x.fill(); x.stroke();          // body
    const hy = s * 0.44, hr = s * 0.2;
    if (kind === 'janku') for (const q of [-1, 1]) { x.beginPath(); x.ellipse(cx + q * hr * 0.45, hy - hr * 1.3, hr * 0.26, hr * 0.8, q * 0.15, 0, 7); x.fill(); x.stroke(); }
    if (kind === 'muri') for (const q of [-1, 1]) { x.beginPath(); x.moveTo(cx + q * hr * 0.9, hy - hr * 0.2); x.lineTo(cx + q * hr * 0.65, hy - hr * 1.25); x.lineTo(cx + q * hr * 0.1, hy - hr * 0.8); x.closePath(); x.fill(); x.stroke(); }
    x.beginPath(); x.arc(cx, hy, hr, 0, 7); x.fill(); x.stroke();                                         // head
    if (kind === 'kutsu') { x.fillStyle = d; for (const q of [-1, 1]) { x.beginPath(); x.ellipse(cx + q * hr * 1.0, hy + hr * 0.15, hr * 0.3, hr * 0.65, q * -0.3, 0, 7); x.fill(); x.stroke(); } }
    x.fillStyle = '#2a1a2a'; for (const q of [-1, 1]) { x.beginPath(); x.arc(cx + q * hr * 0.38, hy - hr * 0.05, hr * 0.13, 0, 7); x.fill(); }
    x.fillStyle = kind === 'kutsu' ? '#2a1a2a' : '#ff8ab0'; x.beginPath(); x.arc(cx, hy + hr * 0.3, hr * 0.12, 0, 7); x.fill();
    if (acc === 'bow') { x.fillStyle = '#ff4f9a'; for (const q of [-1, 1]) { x.beginPath(); x.moveTo(cx, hy + hr * 1.05); x.lineTo(cx + q * hr * 0.6, hy + hr * 0.8); x.lineTo(cx + q * hr * 0.6, hy + hr * 1.3); x.closePath(); x.fill(); x.stroke(); } }
    if (acc === 'collar') { x.strokeStyle = '#e8303a'; x.lineWidth = s * 0.05; x.beginPath(); x.arc(cx, hy + hr * 0.1, hr * 0.95, 0.5, Math.PI - 0.5); x.stroke(); x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(cx, hy + hr * 1.05, hr * 0.16, 0, 7); x.fill(); }
    if (acc === 'hat') { x.fillStyle = '#7c5cff'; x.strokeStyle = '#3a2a3a'; x.lineWidth = s * 0.02; x.beginPath(); x.moveTo(cx - hr * 0.55, hy - hr * 0.8); x.lineTo(cx + hr * 0.15, hy - hr * 1.9); x.lineTo(cx + hr * 0.6, hy - hr * 0.75); x.closePath(); x.fill(); x.stroke(); x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(cx + hr * 0.15, hy - hr * 1.9, hr * 0.15, 0, 7); x.fill(); }
    cache.set(key, c); return c;
  }
  function drawHeroine(x, y, s, look) { g.drawImage(heroineImg(s * H.DPR, look || S.look), x, y, s, s); }
  function drawPet(kind, x, y, s, acc) { g.drawImage(petImg(kind, s * H.DPR, acc), x, y, s, s); }

  // ---------- style picker ----------
  function drawStyle(m, t, B) {
    const tk = TOUR.task(m.id); if (!tk) { H.closeModal(true); return; }
    const cardH = 104, P = H.modalPanel(m, 420, 120 + 3 * (cardH + 10) + 70, 'Vali stiil');
    text(tk.name, P.x + P.w / 2, P.y + 42, 17, INK, 'center', 900, P.w - 70);
    text(m.first ? 'Vali, mis meeldib. Hiljem saab muuta.' : 'Vali uus stiil. Seda saab alati muuta.', P.x + P.w / 2, P.y + 68, 15, INK2, 'center', 700, P.w - 30);
    const cur = S.style[m.id];
    STYLE_KEYS.forEach((k, j) => {
      const st = STYLES[k], x = P.x + 16, y = P.y + 92 + j * (cardH + 10), w = P.w - 32, on = cur === k;
      const ps = H.pressScale(x, y);
      g.save(); g.translate(x + w / 2, y + cardH / 2); g.scale(ps, ps); g.translate(-x - w / 2, -y - cardH / 2);
      g.fillStyle = on ? 'rgba(47,213,154,0.18)' : SOFT; rr(x, y, w, cardH, 18); g.fill();
      if (on) { g.lineWidth = 3; g.strokeStyle = GOOD; rr(x, y, w, cardH, 18); g.stroke(); }
      // swatch: three colour bands with a soft pattern for the style
      g.save(); rr(x + 10, y + 10, 84, cardH - 20, 14); g.clip();
      st.cols.forEach((c, q) => { g.fillStyle = c; g.fillRect(x + 10, y + 10 + q * (cardH - 20) / 3, 84, (cardH - 20) / 3 + 1); });
      g.fillStyle = 'rgba(255,255,255,0.35)';
      if (k === 'boho') for (let q = 0; q < 6; q++) { g.beginPath(); g.moveTo(x + 10 + q * 16, y + 10); g.lineTo(x + 18 + q * 16, y + 24); g.lineTo(x + 26 + q * 16, y + 10); g.fill(); }
      if (k === 'romantic') for (let q = 0; q < 5; q++) { g.beginPath(); g.arc(x + 20 + q * 16, y + cardH - 10, 7, Math.PI, 0); g.fill(); }
      if (k === 'minimal') { g.fillRect(x + 50, y + 10, 3, cardH - 20); }
      g.restore();
      g.lineWidth = 2; g.strokeStyle = 'rgba(60,40,120,0.18)'; rr(x + 10, y + 10, 84, cardH - 20, 14); g.stroke();
      text(st.name, x + 108, y + 36, 20, INK, 'left', 900, w - 160);
      text(st.desc, x + 108, y + 64, 15, INK2, 'left', 700, w - 160);
      if (on) drawIcon('check', x + w - 46, y + cardH / 2 - 17, 34);
      g.restore();
      H.addHit({ x, y, w, h: cardH, bx: x, by: y, fn: () => { if (S.style[m.id] !== k) Game.setStyle(m.id, k); else snd('tap'); if (m.first) setTimeout(() => { if (H.modal === m) H.closeModal(true); }, 350); } }, true);
    });
    const by = P.y + P.h - 64;
    button(P.x + 40, by, P.w - 80, 52, cur ? 'Valmis' : 'Hiljem', () => m.back ? H.closeThen({ kind: m.back }) : H.closeModal(), Object.assign({ hot: !!cur, size: 19 }, B));
  }

  // ---------- season pass ----------
  function drawPass(m, t, B) {
    PASS.ensure();
    const P = H.modalPanel(m, 440, Math.min(H.H - 24, 700), 'Hooaja rada'), pts = S.pass.pts, n = PASS.reached();
    text(cap(PASS.monthName()) + ' · lõpuni ' + H.fmtLong(PASS.left()), P.x + P.w / 2, P.y + 42, 15, INK2, 'center', 800, P.w - 70);
    // progress to the next step
    const next = Math.min(PASS_STEPS, n + 1), lo = PASS.CUM[next - 1], hi = PASS.CUM[next], done = n >= PASS_STEPS;
    drawIcon('pass', P.x + 16, P.y + 58, 40);
    text(done ? 'Rada on läbitud! Tubli!' : 'Samm ' + next + ' / ' + PASS_STEPS, P.x + 64, P.y + 70, 18, INK, 'left', 900, P.w - 90);
    if (!done) { bar(P.x + 64, P.y + 86, P.w - 150, 12, (pts - lo) / (hi - lo), PINK); text((pts - lo) + '/' + (hi - lo), P.x + P.w - 20, P.y + 93, 15, INK2, 'right', 800, 80); }
    // 30 tiles, 5 per row
    const cols = 5, rows = 6, top = P.y + 116, foot = 78, gap = 6;
    const tw = (P.w - 20 - gap * (cols - 1)) / cols, th = Math.min(86, (P.h - (top - P.y) - foot - gap * (rows - 1)) / rows);
    let firstReady = 0;
    for (let s = 1; s <= PASS_STEPS; s++) {
      const j = s - 1, x = P.x + 10 + (j % cols) * (tw + gap), y = top + Math.floor(j / cols) * (th + gap);
      const got = !!S.pass.got[s], ready = s <= n && !got, r = PASS.reward(s), look = !!r.look;
      if (ready && !firstReady) firstReady = s;
      const pu = ready ? 1 + Math.sin(t * 5 + s) * 0.03 : 1;
      g.save(); g.translate(x + tw / 2, y + th / 2); g.scale(pu, pu); g.translate(-x - tw / 2, -y - th / 2);
      if (ready) { const gg = g.createLinearGradient(0, y, 0, y + th); gg.addColorStop(0, '#fff6b0'); gg.addColorStop(1, '#ffd23f'); g.fillStyle = gg; }
      else g.fillStyle = got ? 'rgba(47,213,154,0.18)' : look ? 'rgba(255,79,154,0.14)' : SOFT;
      rr(x, y, tw, th, 14); g.fill();
      if (ready || look) { g.lineWidth = 2.5; g.strokeStyle = ready ? '#fff' : 'rgba(255,79,154,0.55)'; rr(x, y, tw, th, 14); g.stroke(); }
      text(String(s), x + 14, y + 13, 15, got ? GOOD : INK2, 'center', 900);
      const is = Math.min(tw - 22, th - 30), ix = x + tw / 2 - is / 2, iy = y + 16 + (th - 30 - is) / 2;
      g.globalAlpha = s > n && !got ? 0.6 : 1;
      if (look) drawIcon(r.look.startsWith('petAcc') ? 'heart' : 'wardrobe', ix, iy, is);
      else rewardIcon(r, x + tw / 2, iy + is / 2, is);
      g.globalAlpha = 1;
      const lab = r.coins && !look && !r.item && !r.boost && !r.chest ? '+' + r.coins : r.energy && !r.coins && !r.boost ? '+' + r.energy : '';
      if (lab) text(lab, x + tw / 2, y + th - 11, 15, INK, 'center', 900, tw - 4);
      if (got) drawIcon('check', x + tw - 22, y - 4, 24);
      g.restore();
      H.addHit({ x, y, w: tw, h: th, bx: x, by: y, fn: () => {
        if (ready) { m.tap = { x: x + tw / 2, y: y + th / 2 }; PASS.claim(s); }
        else { snd('tap'); toast(s + '. samm: ' + H.describe(r).map(d => d.t).concat(look ? ['uus asi garderoobi'] : []).join(', ') + (got ? ' (käes)' : s > n ? ' · veel ' + (PASS.CUM[s] - pts) + ' punkti' : '')); }
      } }, true);
    }
    const by = P.y + P.h - foot + 10;
    if (firstReady) button(P.x + 30, by, P.w - 60, 52, 'Võta kõik auhinnad!', () => { m.tap = { x: P.x + P.w / 2, y: by }; for (let s = 1; s <= n; s++) if (!S.pass.got[s]) PASS.claim(s); }, Object.assign({ hot: true, pulse: 1, size: 19 }, B));
    else { const ls = wrap('Punkte annavad ühendamised, tellimused, remont, päevaülesanded ja Seiklus.', P.w - 30, 15, 700).slice(0, 3); ls.forEach((s2, j) => text(s2, P.x + P.w / 2, by + 26 + (j - (ls.length - 1) / 2) * 20, 15, INK2, 'center', 700)); }
  }
  // The main prize of a reward as one picture.
  function rewardIcon(r, cx, cy, s) {
    if (r.boost) ADV.drawBoost(typeof r.boost === 'string' ? r.boost : Object.keys(r.boost)[0], cx - s / 2, cy - s / 2, s);
    else if (r.item) drawItem(r.item[0], r.item[1], cx, cy, s);
    else if (r.chest) drawItem('chest', Math.min(3, r.chest), cx, cy, s);
    else if (r.spins) drawIcon('wheel', cx - s / 2, cy - s / 2, s);
    else if (r.genUp) drawItem('oven', 2, cx, cy, s);
    else if (r.stars) drawIcon('star', cx - s / 2, cy - s / 2, s);
    else if (r.energy && !r.coins) drawIcon('energy', cx - s / 2, cy - s / 2, s);
    else drawIcon('coin', cx - s / 2, cy - s / 2, s);
  }

  // ---------- weekly event ----------
  function drawWeek(m, t, B) {
    const e = WEEK.info(), E = e.E, P = H.modalPanel(m, 440, Math.min(H.H - 24, 700), E.name);
    if (!WEEK.open()) {
      drawIcon('week', P.x + P.w / 2 - 40, P.y + 50, 80);
      text('Nädala sündmus avaneb tasemel ' + WEEK_MIN_LVL + '.', P.x + P.w / 2, P.y + 160, 19, INK, 'center', 900, P.w - 30);
      wrap('Igal nädalal on uus pidu: Aiapidu, Moenädal, Pulmad või Rannafestival. Igaühel on oma asjad, oma märgid ja oma auhinnad, ka uued riided garderoobi!', P.w - 48, 16, 700).forEach((s, j) => text(s, P.x + P.w / 2, P.y + 200 + j * 22, 16, INK2, 'center', 700));
      return;
    }
    WEEK.ensure();
    const cur = S.week.cur, icon = 'cur_' + e.key;
    drawIcon(icon, P.x + 16, P.y + 34, 44); text(String(cur), P.x + 66, P.y + 56, 24, INK, 'left', 900);
    let bw0 = 0;
    if (e.weekend) { const wl = P.w >= 420 ? 'Nädalavahetus ×2!' : 'Täna ×2!'; g.font = H.font(15, 900); bw0 = g.measureText(wl).width + 26; g.fillStyle = PINK; rr(P.x + P.w - 18 - bw0, P.y + 64, bw0, 30, 15); g.fill(); text(wl, P.x + P.w - 18 - bw0 / 2, P.y + 79, 15, '#fff', 'center', 900); }
    text('Lõpuni ' + H.fmtLong(e.left), P.x + 66, P.y + 84, 15, INK2, 'left', 800, P.w - 92 - bw0);
    // the event chain, small, so it is clear what to look for on the board
    const n = E.chain.length, cw = Math.min(58, (P.w - 30) / n), x0 = P.x + (P.w - cw * n) / 2, cy = P.y + 122;
    for (let j = 0; j < n; j++) {
      const known = j === 0 || (S.disc[e.chain] || 0) > j;
      g.fillStyle = SOFT; rr(x0 + j * cw + 2, cy - cw / 2 + 2, cw - 4, cw - 4, 12); g.fill();
      if (known) drawItem(e.chain, j + 1, x0 + j * cw + cw / 2, cy, cw * 0.78); else H.drawSilhouette(e.chain, j + 1, x0 + j * cw + cw / 2, cy, cw * 0.78);
    }
    H.addHit({ x: x0, y: cy - cw / 2, w: cw * n, h: cw, fn: () => { snd('tap'); H.closeThen({ kind: 'chain', k: e.chain, l: 1 }); } }, true);
    const info = 'Generaatoritest tuleb vahel ' + E.chain[0].toLowerCase() + '. Ühenda neid! Tipptaseme asja toksamine annab ' + WEEK_CUR.top + ' ' + E.cur[1] + '.';
    const il = wrap(info, P.w - 36, 15, 700).slice(0, 3);
    il.forEach((s, j) => text(s, P.x + P.w / 2, cy + cw / 2 + 18 + j * 20, 15, INK2, 'center', 700));
    // reward track (a window around the next prize)
    const top = cy + cw / 2 + 26 + il.length * 20, rowH = 56, N = WEEK_TRACK.length, nRows = Math.max(3, Math.floor((P.y + P.h - top - 52) / rowH));
    let nx = 0; while (nx < N && S.week.got[nx]) nx++;
    const s0 = clamp(nx - 1, 0, Math.max(0, N - nRows));
    for (let j = s0; j < Math.min(N, s0 + nRows); j++) {
      const tr = WEEK_TRACK[j], y = top + (j - s0) * rowH, got = !!S.week.got[j], ready = !got && cur >= tr.need, r = WEEK.reward(j);
      g.fillStyle = ready ? 'rgba(255,95,143,0.18)' : got ? 'rgba(95,194,74,0.12)' : SOFT; rr(P.x + 10, y, P.w - 20, rowH - 6, 14); g.fill();
      g.fillStyle = got ? '#5fc24a' : ready ? PINK : '#c9b49a'; g.beginPath(); g.arc(P.x + 38, y + (rowH - 6) / 2, 20, 0, 7); g.fill();
      text(String(tr.need), P.x + 38, y + (rowH - 6) / 2 + 1, 15, '#fff', 'center', 900);
      if (r.look) { drawIcon('wardrobe', P.x + 68, y + (rowH - 6) / 2 - 15, 30); const [kind, k] = r.look.split(':'); text(LOOK.name(kind, k), P.x + 102, y + (rowH - 6) / 2 + 1, 16, PINK, 'left', 900, P.w - 230); }
      else H.rewardRow(r, P.x + 70, y + (rowH - 6) / 2, P.w - (ready ? 196 : 136), 28);
      if (got) drawIcon('check', P.x + P.w - 56, y + 9, 32);
      else if (ready) button(P.x + P.w - 112, y + 1, 96, 48, 'Võta!', () => { m.tap = { x: P.x + P.w - 64, y: y + 24 }; WEEK.claim(j); }, Object.assign({ hot: true, pulse: 1, size: 18 }, B));
      else { g.globalAlpha = 0.5; drawIcon('lock', P.x + P.w - 54, y + 11, 28); g.globalAlpha = 1; }
    }
    wrap(cap(E.cur[0]) + ' tulevad ühendamisest, tellimustest ja Seikluse tasemetest.', P.w - 30, 15, 700).slice(0, 2).forEach((s2, j, a) => text(s2, P.x + P.w / 2, P.y + P.h - 14 - (a.length - j) * 20, 15, INK2, 'center', 700));
  }
  function weekMusic() {
    try {
      if (typeof MUSIC === 'undefined' || !MUSIC || !MUSIC.scene) return;
      const k = MUSIC.scene('event', { week: WEEK.info().key });
      if (!k) H.boardMusic();
    } catch (e) {}
  }

  // ---------- wardrobe ----------
  const TABS = [['outfit', 'Riided'], ['hair', 'Soeng'], ['acc', 'Lisad'], ['pet', 'Lemmik']];
  function drawLook(m, t, B) {
    if (!m.seen) { m.seen = 1; LOOK.seeAll(); }
    const P = H.modalPanel(m, 440, Math.min(H.H - 24, 720), 'Garderoob'), tab = m.tab || 'outfit';
    // preview: the heroine and her pet in front of the scene
    const pv = { x: P.x + 12, y: P.y + 56, w: P.w - 24, h: Math.min(190, P.h * 0.28) };
    g.save(); rr(pv.x, pv.y, pv.w, pv.h, 16); g.clip();
    if (!H.paintScene(g, pv.x, pv.y, pv.w, pv.h, t)) { const gr = g.createLinearGradient(0, pv.y, 0, pv.y + pv.h); gr.addColorStop(0, '#bfe3f2'); gr.addColorStop(1, '#fbe9d0'); g.fillStyle = gr; g.fillRect(pv.x, pv.y, pv.w, pv.h); }
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(pv.x, pv.y, pv.w, pv.h);
    const hs = pv.h * 0.95, bob = Math.sin(t * 2) * 2;
    drawHeroine(pv.x + pv.w / 2 - hs * 0.62, pv.y + pv.h - hs + bob, hs);
    const ps = pv.h * 0.5, pet = S.petOn;
    drawPet(pet, pv.x + pv.w / 2 + hs * 0.12, pv.y + pv.h - ps - 2 + Math.abs(Math.sin(t * 3)) * -3, ps, (S.pets[pet] || {}).acc || 'none');
    g.restore();
    g.lineWidth = 3; g.strokeStyle = '#fff'; rr(pv.x, pv.y, pv.w, pv.h, 16); g.stroke();
    // tabs
    const ty = pv.y + pv.h + 10, tw = (P.w - 24) / TABS.length;
    TABS.forEach(([k, lab], j) => {
      const x = P.x + 12 + j * tw, on = tab === k;
      g.fillStyle = on ? GRAPE : SOFT; rr(x + 2, ty, tw - 4, 46, 14); g.fill();
      text(lab, x + tw / 2, ty + 24, 16, on ? '#fff' : INK, 'center', 900, tw - 10);
      H.addHit({ x, y: ty, w: tw, h: 48, fn: () => { m.tab = k; snd('tap'); } }, true);
    });
    // option cards
    const top = ty + 58, foot = 70;
    const list = tab === 'pet' ? Object.keys(PETS).map(k => ['pet', k]).concat(Object.keys(LOOKS.petAcc).map(k => ['petAcc', k])) : Object.keys(LOOKS[tab]).map(k => [tab, k]);
    const cols = tab === 'pet' ? 4 : 3, rows = Math.ceil(list.length / cols), cw = (P.w - 20) / cols;
    const ch = Math.min(122, (P.y + P.h - foot - top) / rows);
    list.forEach(([kind, k], j) => {
      const x = P.x + 10 + (j % cols) * cw, y = top + Math.floor(j / cols) * ch, has = LOOK.has(kind, k);
      const on = kind === 'pet' ? S.petOn === k : kind === 'petAcc' ? ((S.pets[S.petOn] || {}).acc || 'none') === k : S.look[kind] === k;
      g.fillStyle = on ? 'rgba(47,213,154,0.2)' : has ? SOFT : 'rgba(110,100,200,0.05)'; rr(x + 3, y + 2, cw - 6, ch - 6, 14); g.fill();
      if (on) { g.lineWidth = 3; g.strokeStyle = GOOD; rr(x + 3, y + 2, cw - 6, ch - 6, 14); g.stroke(); }
      const why = has ? null : wrap(LOOK.why(kind, k), cw - 12, 15, 700).slice(0, 2), is = Math.min(cw - 16, ch - (why && why.length > 1 ? 62 : 44));
      g.globalAlpha = has ? 1 : 0.35;
      if (kind === 'pet') drawPet(k, x + cw / 2 - is / 2, y + 6, is, 'none');
      else if (kind === 'petAcc') drawPet(S.petOn, x + cw / 2 - is / 2, y + 6, is, k);
      else drawHeroine(x + cw / 2 - is / 2, y + 6, is, Object.assign({}, S.look, { [kind]: k }));
      g.globalAlpha = 1;
      if (!has) drawIcon('lock', x + cw - 34, y + 8, 24);
      if (has) text(LOOK.name(kind, k), x + cw / 2, y + ch - 22, 15, INK, 'center', 900, cw - 12);
      else why.forEach((s2, q) => text(s2, x + cw / 2, y + ch - 22 - (why.length - 1 - q) * 18, 15, INK2, 'center', 700, cw - 12));
      H.addHit({ x: x + 3, y: y + 2, w: cw - 6, h: ch - 6, fn: () => {
        if (!has) { snd('deny'); toast(LOOK.name(kind, k) + ': ' + LOOK.why(kind, k) + '.'); return; }
        if (!on) LOOK.wear(kind, k); else snd('tap');
      } }, true);
    });
    const by = P.y + P.h - 62;
    button(P.x + 30, by, P.w - 60, 50, 'Tee foto', () => H.closeThen({ kind: 'xPhoto' }), Object.assign({ icon: 'camera', isz: 30, style: 'buttonBlue', size: 19 }, B));
  }

  // ---------- photo mode ----------
  // A postcard of the current area with the heroine and her pet, full screen, ready for a screenshot.
  // The hints and the close button fade out after a few seconds so the screenshot stays clean.
  function drawPhoto(m, t) {
    const W = H.W, Hh = H.H, age = tn() - m.t0;
    if (!m.snd) { m.snd = 1; snd2('photo', 'open'); fx('confetti', 0.3, W / 2, Hh * 0.3); }
    g.fillStyle = 'rgba(20,14,48,0.92)'; g.fillRect(0, 0, W, Hh);
    const si = H.insets(), cw = Math.min(W - 28, 520), chh = Math.min(Hh - si.t - si.b - 120, cw * 1.25);
    const x = (W - cw) / 2, y = Math.max(si.t + 20, (Hh - chh) / 2 - 10);
    const area = Game.curArea(), when = new Date(), dateS = when.getDate() + '. ' + MONTHS[when.getMonth()] + ' ' + when.getFullYear();
    const k = clamp(age / 0.45, 0, 1), s = 0.85 + 0.15 * ease.outBack(k);
    const paint = (c, px, py, pw, ph, tt) => {
      c.save(); c.beginPath(); c.rect(px, py, pw, ph); c.clip();
      if (!H.paintScene(c, px, py, pw, ph, tt === undefined ? t : tt)) { const gr = c.createLinearGradient(0, py, 0, py + ph); gr.addColorStop(0, '#bfe3f2'); gr.addColorStop(1, '#fbe9d0'); c.fillStyle = gr; c.fillRect(px, py, pw, ph); }
      const hs = Math.min(ph * 0.55, pw * 0.5), pet = S.petOn;
      c.drawImage(heroineImg(hs * H.DPR, S.look), px + pw * 0.08, py + ph - hs, hs, hs);
      c.drawImage(petImg(pet, hs * 0.5 * H.DPR, (S.pets[pet] || {}).acc || 'none'), px + pw * 0.08 + hs * 0.72, py + ph - hs * 0.52, hs * 0.5, hs * 0.5);
      c.restore();
    };
    g.save(); g.globalAlpha = Math.min(1, k * 2); g.translate(W / 2, y + chh / 2); g.rotate(-0.015 * (1 - k)); g.scale(s, s); g.translate(-W / 2, -y - chh / 2);
    let framed = false;
    if (artOn('postcard')) { try { g.save(); g.translate(x, y); ART.postcard(g, cw, chh, paint, { title: area.name, date: dateS, t }); g.restore(); framed = true; } catch (e) { g.restore(); } }
    if (!framed) {
      g.fillStyle = 'rgba(0,0,0,0.3)'; rr(x + 4, y + 8, cw, chh, 10); g.fill();
      g.fillStyle = '#fffdf6'; rr(x, y, cw, chh, 10); g.fill();
      const pad = 14, ph = chh - pad - 74;
      paint(g, x + pad, y + pad, cw - pad * 2, ph);
      g.lineWidth = 1.5; g.strokeStyle = 'rgba(0,0,0,0.12)'; g.strokeRect(x + pad, y + pad, cw - pad * 2, ph);
      text('Tervitused saarelt!', x + cw / 2, y + pad + ph + 26, 22, '#a04a6a', 'center', 900, cw - 30);
      text(area.name + ' · ' + dateS, x + cw / 2, y + pad + ph + 54, 15, INK2, 'center', 700, cw - 30);
    }
    g.restore();
    // hints and the close button fade out
    const ha = clamp(1 - (age - 3) / 0.6, 0, 1);
    if (ha > 0) {
      g.globalAlpha = ha;
      text('Tee ekraanipilt ja jaga!', W / 2, Math.min(Hh - si.b - 30, y + chh + 34), 17, '#fff', 'center', 900, W - 30);
      const cx = W - 58, cy = si.t + 10;
      g.fillStyle = 'rgba(255,255,255,0.2)'; g.beginPath(); g.arc(cx + 24, cy + 24, 20, 0, 7); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 3.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx + 17, cy + 17); g.lineTo(cx + 31, cy + 31); g.moveTo(cx + 31, cy + 17); g.lineTo(cx + 17, cy + 31); g.stroke(); g.lineCap = 'butt';
      g.globalAlpha = 1;
    }
    H.addHit({ x: 0, y: 0, w: W, h: Hh, fn: () => { if (age > 0.4) H.closeModal(); } }, true);
    H.keep(0.1);
  }

  // ---------- rest note ----------
  function drawRest(m, t, B) {
    const P = H.modalPanel(m, 380, 430, 'Väike paus?');
    drawIcon('rest', P.x + P.w / 2 - 36, P.y + 36, 72);
    const ls = wrap('Oled juba tükk aega mänginud. Silmad ja kael tänavad sind väikese pausi eest. Saar ootab sind siin, energia koguneb vahepeal ise.', P.w - 40, 17, 800);
    ls.forEach((s, j) => text(s, P.x + P.w / 2, P.y + 132 + j * 24, 17, INK, 'center', 800));
    const by = P.y + P.h - 150;
    button(P.x + 30, by, P.w - 60, 52, 'Teen pausi', () => { H.closeModal(true); toast('Kohtumiseni! Muri hoiab sul kohta soojas.', 3.4); }, Object.assign({ hot: true, size: 19 }, B));
    button(P.x + 30, by + 60, P.w - 60, 48, 'Mängin veel natuke', () => H.closeModal(), Object.assign({ style: 'buttonGrey', size: 17 }, B));
    text('Meeldetuletuse saab seadetes välja lülitada.', P.x + P.w / 2, P.y + P.h - 20, 15, INK2, 'center', 700, P.w - 20);
  }

  function drawModal(m, t, B) {
    if (m.kind === 'xStyle') drawStyle(m, t, B);
    else if (m.kind === 'xPass') drawPass(m, t, B);
    else if (m.kind === 'xWeek') { if (!m.mus) { m.mus = 1; weekMusic(); m.onDone = () => H.boardMusic(); } drawWeek(m, t, B); }
    else if (m.kind === 'xLook') drawLook(m, t, B);
    else if (m.kind === 'xPhoto') drawPhoto(m, t);
    else if (m.kind === 'xRest') drawRest(m, t, B);
  }
  return { drawModal, heroineImg, petImg };
})();
