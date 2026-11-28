// ===== FX (Ash): juicy merge bursts, spawn arcs, flying rewards, confetti, combo / lucky / discover / level-up. =====
// Coordinates are CSS pixels in the same space the game draws in (ctx already scaled by devicePixelRatio).
// Cheap on low-end phones: one pooled particle array, pre-rendered sprites, no shadowBlur, a hard cap per quality.
// Everything reads on light backgrounds: rings have a dark rim, flashes use normal blending (not 'lighter').
//   FX.merge(x, y, chain, level)        flash + squash-stretch pop + shockwave rings + stars/sparkles; level-scaled, special at max
//   FX.squash(x, y) -> [sx, sy] | null  scale to apply to the item drawn at (x, y) while its pop plays
//   FX.spawn(fx, fy, tx, ty, img, size) an item flies out of a generator in an arc and bounces; size = drawn px
//   FX.landing(x, y) -> true while an item is still flying to (x, y)
//   FX.coins(x, y, n) / FX.stars / FX.energy / FX.xp  icons burst out then fly to UI.hudPos(name); UI.hudPulse(name) on arrival
//   FX.combo(x, y, n)    combo counter burst ("Kombo ×n"), grows with n
//   FX.lucky(x, y)       rainbow "Õnn!" burst (lucky bonus)
//   FX.discover(x, y)    "UUS!" badge pops above a newly discovered item
//   FX.levelUp()         full-screen celebration (rays, confetti, "Uus tase!")
//   FX.hint(x, y)        a subtle pulse to point at a cell
//   FX.confetti(amount, x, y)  FX.sparkle(x, y, n)  FX.ring(x, y, r, col)  FX.text(x, y, str, col, size)  FX.hearts(x, y, n)
//   Version 3 (level map):
//   FX.levelWin(opts)    fireworks + star rain + confetti + big "Tubli!" with 0..3 stars popping in; opts { stars, text, x, y }
//   FX.levelFail(opts)   a soft lilac puff and a gentle "Peaaegu!" (never harsh); opts { text, x, y }
//   FX.iceCrack(x, y, s)  FX.boxBreak(x, y, s)  FX.obstacleClear(kind, x, y, s)  (s = cell size; kinds as ART.obstacle)
//   FX.boosterUse(kind, x, y)  'wand' (star swirl in), 'scissors' (snip + halves), 'shuffle' (board whirl; x,y = board centre), 'moves5'
//   FX.rainbowLink(x0, y0, x1, y1)  rainbow ribbon from the previous merge to the next one when merges chain
//   FX.trail(x, y)       call every frame while dragging during a chain: rainbow sparkle crumbs (rate-limited)
//   FX.idle(ctx, x, y, s, seed, t)  occasional sparkle glint on an idle item (stateless, cheap; pair with ART.itemIdle)
//   FX.update(dt)  FX.draw(ctx)  FX.clear()  FX.count()  FX.active()  FX.busy()  FX.quality = 0 | 1 | 2  FX.onArrive = fn(name)
const FX = (function () {
  const F = { quality: 2, onArrive: null, spawnDur: 0.42 };
  const CAP = [110, 260, 480];
  const P = [], pool = [], pops = [], flights = [], texts = [], hints = [], shows = [], rockets = [], stamps = [], links = [];
  function get() { return pool.pop() || {}; }
  function add(o) { if (P.length >= CAP[F.quality | 0]) { pool.push(o); return null; } P.push(o); return o; }
  const Q = () => F.quality | 0;
  const W = () => innerWidth, Hh = () => innerHeight;
  const FONT = (ART.theme && ART.theme.font) || 'ui-rounded,system-ui,sans-serif';
  // ---- sprites (rendered once, 64 px, drawn scaled) ----
  const spr = {};
  function sprite(name) {
    if (spr[name]) return spr[name];
    const s = name === 'rays' ? 256 : 64, c = ART.mk(s, s), g = c.getContext('2d'), H = ART.H;
    const col = name.split(':')[1] || '#ffd23f';
    if (name.indexOf('flash') === 0) { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.3, 'rgba(255,255,255,.9)'); gr.addColorStop(.6, ART.rgba(col, .45)); gr.addColorStop(1, ART.rgba(col, 0)); g.fillStyle = gr; g.fillRect(0, 0, s, s); }
    else if (name.indexOf('spark') === 0) { ART.sparkAt(g, 32, 32, 31, ART.dk(col, .35)); ART.sparkAt(g, 32, 32, 26, col); ART.sparkAt(g, 32, 32, 11, '#ffffff'); }
    else if (name.indexOf('star') === 0) {
      H.pstar(g, 32, 35, 27); g.fillStyle = ART.dk(col, .45); g.fill(); H.pstar(g, 32, 32, 27); const gr = g.createLinearGradient(0, 6, 0, 58); gr.addColorStop(0, ART.lt(col, .55)); gr.addColorStop(1, col); g.fillStyle = gr; g.fill();
      g.lineWidth = 2.5; g.strokeStyle = 'rgba(255,255,255,.9)'; g.stroke(); H.E(g, 25, 22, 6, 3.5, -.6); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill();
    }
    else if (name.indexOf('dot:') === 0) { g.beginPath(); g.arc(32, 32, 26, 0, 6.29); g.fillStyle = ART.dk(col, .3); g.fill(); g.beginPath(); g.arc(32, 32, 21, 0, 6.29); g.fillStyle = col; g.fill(); g.beginPath(); g.arc(25, 25, 8, 0, 6.29); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill(); }
    else if (name === 'dot') { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.5, 'rgba(255,250,230,.9)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }
    else if (name === 'heart') { H.heart(g, 32, 40, 26); g.fillStyle = '#c4135a'; g.fill(); H.heart(g, 32, 37, 26); g.fillStyle = '#ff4f9a'; g.fill(); H.E(g, 23, 24, 6, 4, -.6); g.fillStyle = 'rgba(255,255,255,.8)'; g.fill(); }
    else if (name === 'puff') { g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.arc(32, 32, 26, 0, 6.29); g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(120,110,200,.25)'; g.stroke(); }
    else if (name === 'shard') { H.PL(g, [10, 14, 56, 24, 30, 58]); const gr = g.createLinearGradient(10, 14, 50, 58); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.5, '#bfe8ff'); gr.addColorStop(1, '#6fb8ff'); g.fillStyle = gr; g.fill(); g.lineWidth = 3; g.strokeStyle = '#3d86e0'; g.lineJoin = 'round'; g.stroke(); H.PL(g, [16, 18, 40, 24], true); g.lineWidth = 3; g.strokeStyle = '#ffffff'; g.stroke(); }
    else if (name === 'plank') { H.R(g, 6, 22, 52, 20, 5); const gr = g.createLinearGradient(0, 22, 0, 42); gr.addColorStop(0, '#ffd09a'); gr.addColorStop(1, '#d98a4a'); g.fillStyle = gr; g.fill(); g.lineWidth = 3; g.strokeStyle = '#8a4a1e'; g.stroke(); g.beginPath(); g.moveTo(14, 30); g.lineTo(34, 30); g.lineWidth = 2; g.strokeStyle = 'rgba(138,74,30,.5)'; g.stroke(); }
    else if (name === 'goo') { g.beginPath(); g.moveTo(32, 6); g.bezierCurveTo(48, 26, 56, 36, 52, 46); g.bezierCurveTo(48, 60, 16, 60, 12, 46); g.bezierCurveTo(8, 36, 16, 26, 32, 6); g.closePath(); const gr = g.createRadialGradient(26, 34, 2, 32, 40, 26); gr.addColorStop(0, '#ffe0f0'); gr.addColorStop(.5, '#ff8cc4'); gr.addColorStop(1, '#e0408a'); g.fillStyle = gr; g.fill(); g.lineWidth = 3; g.strokeStyle = '#b8236e'; g.stroke(); H.E(g, 24, 36, 5, 7, .3); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill(); }
    else if (name === 'cloud') { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 31); gr.addColorStop(0, 'rgba(236,232,255,.95)'); gr.addColorStop(.6, 'rgba(206,198,245,.75)'); gr.addColorStop(1, 'rgba(190,180,240,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }
    else if (name === 'drop') { g.beginPath(); g.moveTo(32, 8); g.bezierCurveTo(44, 26, 50, 34, 48, 42); g.bezierCurveTo(46, 56, 18, 56, 16, 42); g.bezierCurveTo(14, 34, 20, 26, 32, 8); g.closePath(); g.fillStyle = '#9fc4ff'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#5a7ee0'; g.stroke(); H.E(g, 26, 38, 4, 6, .3); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill(); }
    else if (name === 'rays') {
      g.translate(128, 128);
      for (let i = 0; i < 16; i++) {
        g.rotate(Math.PI / 8); g.beginPath(); g.moveTo(0, 0); g.lineTo(-18, -128); g.lineTo(18, -128); g.closePath();
        const gr = g.createLinearGradient(0, 0, 0, -128); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fill();
      }
    }
    return (spr[name] = c);
  }
  function sparkCol(chain) {
    return ({ bread: '#ffb21e', flower: '#ff4fa8', wood: '#ff8a3d', fish: '#1fb6ff', tea: '#21c07a', berry: '#ff3d6b', dairy: '#3db8ff', apple: '#ff5a4a', wool: '#a66bff', sea: '#14c8b8', coffee: '#ffb21e', coin: '#ffb21e', chest: '#ffb21e',
      pagar: '#ffb21e', lill: '#ff4fa8', tooriist: '#3d8bff', kala: '#1fb6ff', tee: '#21c07a', mari: '#ff3d6b', piim: '#3db8ff', mesi: '#ffb21e', kudum: '#ff6a5a', meri: '#14c8b8', energia: '#ffc21e', raha: '#ffb21e' })[chain] || '#ff6bb5';
  }
  const RAINBOW = ['#ff5a5f', '#ffa62b', '#ffd23f', '#2fd59a', '#3db8ff', '#7c5cff', '#ff4fa8'];
  // particle kinds: 0 sprite, 1 ring, 2 confetti, 3 flyer (icon to HUD), 4 rays
  function part(kind, x, y, vx, vy, life, size, img, col) {
    const o = get(); o.k = kind; o.x = x; o.y = y; o.vx = vx; o.vy = vy; o.life = life; o.t = 0; o.size = size; o.img = img; o.col = col;
    o.rot = Math.random() * 6.28; o.vr = (Math.random() - .5) * 8; o.g = 0; o.drag = 0; o.grow = 0; o.alpha = 1; o.w = 0; o.delay = 0; return add(o);
  }
  function ring(x, y, r0, r1, life, col, w, delay) { const o = part(1, x, y, 0, 0, life, r0, null, col); if (o) { o.grow = r1 - r0; o.w = w || 7; o.delay = delay || 0; } return o; }
  function burst(x, y, n, sp, kinds, size, life, g) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283 + Math.random() * .5, v = sp * (.55 + Math.random() * .7);
      const o = part(0, x, y, Math.cos(a) * v, Math.sin(a) * v - sp * .25, life * (.75 + Math.random() * .5), size * (.7 + Math.random() * .6), sprite(kinds[i % kinds.length]));
      if (o) { o.g = g == null ? 300 : g; o.drag = 2.4; }
    }
  }

  F.merge = function (x, y, chain, level) {
    level = level || 1; const max = ART.maxLevel ? ART.maxLevel(chain) : 0, isMax = max && level >= max;
    const q = Q(), big = Math.min(1, (level - 1) / 7), col = sparkCol(chain);
    pops.push({ x, y, t: 0, dur: .5 + big * .12, amp: .32 + big * .18 });
    // flash (normal blend so it shows on light cells)
    let o = part(0, x, y, 0, 0, .28 + big * .1, 56 + big * 40, sprite('flash:' + col)); if (o) { o.grow = .9; o.vr = 0; o.alpha = .95; o.rot = 0; }
    // shockwave rings: a coloured ring with a dark rim, then a white one
    ring(x, y, 10, 46 + big * 46, .45, col, 8 + big * 4);
    if (q > 0) ring(x, y, 6, 34 + big * 34, .38, '#ffffff', 5, .05);
    if (level >= 5 || isMax) ring(x, y, 12, (isMax ? 120 : 80) + big * 30, .7, isMax ? '#ffd23f' : ART.lt(col, .3), 6, .08);
    // rays for higher levels
    if (q > 0 && (level >= 4 || isMax)) { o = part(4, x, y, 0, 0, .6 + big * .3, 70 + big * 70, sprite('rays'), col); if (o) { o.vr = 1.4; o.alpha = .55 + big * .3; } }
    // stars, sparkles and dots
    const n = [7, 12, 16][q] + Math.round(big * [4, 8, 14][q]) + (isMax ? [6, 12, 20][q] : 0);
    burst(x, y, n, 150 + big * 110, ['star:' + col, 'spark:#ffffff', 'dot:' + col, 'star:#ffd23f', 'spark:' + col], 13 + big * 6, .55, 340);
    if (isMax) {
      for (let i = 0; i < [4, 8, 12][q]; i++) { const a = Math.random() * 6.28; o = part(0, x, y, Math.cos(a) * 70, -90 - Math.random() * 90, 1 + Math.random() * .5, 16 + Math.random() * 8, sprite('heart')); if (o) { o.g = -20; o.drag = 1.2; } }
      F.text(x, y - 34, 'Vau!', '#ffd23f', 30);
      if (q > 0) F.confetti(.4, x, y);
    } else if (level >= 6) F.text(x, y - 30, 'Super!', col, 22);
  };
  // damped spring squash-stretch: squash wide first, stretch tall, settle
  F.squash = function (x, y) {
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i]; if (Math.abs(p.x - x) > 4 || Math.abs(p.y - y) > 4) continue;
      const u = p.t / p.dur, env = Math.exp(-u * 4.2), w = Math.sin(u * Math.PI * 3.2);
      const grow = u < .18 ? .55 + .45 * (u / .18) * (2 - u / .18) : 1; // quick scale-in
      const s = grow * (1 + p.amp * .5 * Math.sin(Math.min(1, u * 2.2) * Math.PI) * env);
      return [s * (1 + w * p.amp * env), s * (1 - w * p.amp * env * .9)];
    }
    return null;
  };
  F.spawn = function (fx, fy, tx, ty, img, size) {
    flights.push({ fx, fy, tx, ty, img, size: size || 0, t: 0, dur: F.spawnDur * .72, land: 0, lend: F.spawnDur * .28 });
    for (let i = 0; i < [3, 5, 7][Q()]; i++) { const o = part(0, fx, fy, (Math.random() - .5) * 140, -70 - Math.random() * 90, .45, 9 + Math.random() * 6, sprite(i % 2 ? 'dot' : 'spark:#ffffff')); if (o) { o.g = 320; o.drag = 2; } }
  };
  F.landing = function (x, y) { for (const f of flights) if (f.land === 0 && Math.abs(f.tx - x) < 3 && Math.abs(f.ty - y) < 3) return true; return false; };
  function hud(name) {
    try { if (typeof UI !== 'undefined' && UI && UI.hudPos) { const p = UI.hudPos(name); if (p) return Array.isArray(p) ? { x: p[0], y: p[1] } : p; } } catch (e) { }
    return { x: name === 'energy' ? 40 : W() - 40, y: 24 };
  }
  function flyers(name, icon, x, y, n) {
    n = Math.max(1, Math.min(n | 0 || 1, [5, 8, 12][Q()]));
    const img = ART.icon(icon, Math.round(34 * (ART.dpr || 1)));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, sp = 70 + Math.random() * 120;
      const o = part(3, x, y, Math.cos(a) * sp, Math.sin(a) * sp - 70, 1.1 + i * .07, 28, img);
      if (o) { o.name = name; o.delay = .28 + i * .055; o.sx = 0; o.sy = 0; o.first = i === 0; }
    }
    ring(x, y, 6, 40, .35, '#ffd23f', 5);
  }
  F.coins = (x, y, n) => flyers('coins', 'coin', x, y, n);
  F.stars = (x, y, n) => flyers('stars', 'star', x, y, n);
  F.energy = (x, y, n) => flyers('energy', 'energy', x, y, n);
  F.xp = (x, y, n) => flyers('xp', 'xp', x, y, n);
  F.confetti = function (amount, cx, cy) {
    const w = W(), h = Hh(), cols = ['#ff5a8a', '#ffd23f', '#3db8ff', '#2fd59a', '#a66bff', '#ff8a3d', '#ffffff'];
    const n = Math.round([30, 70, 130][Q()] * (amount || 1));
    for (let i = 0; i < n; i++) {
      const fromPt = cx != null, x = fromPt ? cx : Math.random() * w, y = fromPt ? cy : -10 - Math.random() * h * .3;
      const a = Math.random() * 6.28, sp = fromPt ? 140 + Math.random() * 220 : 0;
      const o = part(2, x, y, fromPt ? Math.cos(a) * sp : (Math.random() - .5) * 60, fromPt ? Math.sin(a) * sp - 140 : 60 + Math.random() * 120, 2.2 + Math.random() * 1.6, 6 + Math.random() * 6, null, cols[i % cols.length]);
      if (o) { o.g = fromPt ? 330 : 60; o.drag = fromPt ? 1.5 : .3; o.ph = Math.random() * 6.28; }
    }
  };
  F.sparkle = function (x, y, n, r) { for (let i = 0; i < (n || 6); i++) { const a = Math.random() * 6.28, d = Math.random() * (r || 20); const o = part(0, x + Math.cos(a) * d, y + Math.sin(a) * d, 0, -24, .6 + Math.random() * .4, 9 + Math.random() * 8, sprite(i % 2 ? 'spark:#ffd23f' : 'spark:#ffffff')); if (o) o.drag = 1; } };
  F.ring = function (x, y, r, col) { ring(x, y, 6, r || 60, .5, col || '#ffffff', 6); };
  F.hearts = function (x, y, n) { for (let i = 0; i < (n || 5); i++) { const o = part(0, x + (Math.random() - .5) * 30, y, (Math.random() - .5) * 40, -60 - Math.random() * 50, 1.2, 15 + Math.random() * 8, sprite('heart')); if (o) { o.drag = .8; o.vr = 0; } } };
  // pop text: bounces in, floats up, fades. kind: 'pop' (default) | 'rainbow' | 'badge'
  F.text = function (x, y, str, col, size, kind, life) { if (texts.length > 12) texts.shift(); texts.push({ x, y, str: String(str), col: col || '#ffd23f', size: size || 24, kind: kind || 'pop', t: 0, life: life || 1.1, vy: kind === 'badge' ? -14 : -34 }); };

  // ---- new effects for the game (Mira calls them behind fxOn guards) ----
  F.combo = function (x, y, n) {
    n = n | 0 || 2; const k = Math.min(1, (n - 2) / 6), col = RAINBOW[Math.min(RAINBOW.length - 1, n - 2)];
    F.text(x, y - 40, 'Kombo ×' + n, col, 24 + k * 12, n >= 5 ? 'rainbow' : 'pop', 1.2);
    ring(x, y, 12, 60 + k * 50, .5, col, 8);
    burst(x, y, [6, 10, 14][Q()] + Math.round(k * 10), 180 + k * 120, ['star:' + col, 'spark:#ffffff', 'star:#ffd23f'], 14 + k * 6, .6, 300);
    if (n >= 5 && Q() > 0) { const o = part(4, x, y, 0, 0, .7, 90 + k * 50, sprite('rays'), col); if (o) { o.vr = 1.6; o.alpha = .6; } }
  };
  F.lucky = function (x, y) {
    F.text(x, y - 42, 'Õnn!', '#ffffff', 32, 'rainbow', 1.4);
    for (let i = 0; i < (Q() ? 4 : 2); i++) ring(x, y, 8, 50 + i * 22, .6, RAINBOW[(i * 2) % RAINBOW.length], 7, i * .07);
    const n = [10, 18, 28][Q()];
    for (let i = 0; i < n; i++) { const a = i / n * 6.283, v = 160 + Math.random() * 140; const o = part(0, x, y, Math.cos(a) * v, Math.sin(a) * v - 60, .8 + Math.random() * .4, 14 + Math.random() * 8, sprite('star:' + RAINBOW[i % RAINBOW.length])); if (o) { o.g = 260; o.drag = 2.2; } }
    if (Q() > 0) { const o = part(4, x, y, 0, 0, 1, 140, sprite('rays'), '#ffffff'); if (o) { o.vr = 1.2; o.alpha = .7; } }
    F.hearts(x, y - 10, Q() ? 4 : 2);
  };
  F.discover = function (x, y) {
    F.text(x, y - 34, 'UUS!', '#ff4f9a', 18, 'badge', 1.6);
    ring(x, y, 10, 44, .45, '#ff4f9a', 6);
    F.sparkle(x, y - 10, [4, 7, 10][Q()], 26);
  };
  F.levelUp = function () {
    const w = W(), h = Hh();
    shows.push({ t: 0, life: 2.6, x: w / 2, y: h * .4 });
    F.confetti(1.1);
    burst(w / 2, h * .4, [12, 22, 34][Q()], 320, ['star:#ffd23f', 'star:#ff4f9a', 'star:#3db8ff', 'spark:#ffffff', 'star:#2fd59a'], 20, 1, 240);
    ring(w / 2, h * .4, 20, Math.max(w, h) * .55, .9, '#ffd23f', 10);
    if (Q() > 0) ring(w / 2, h * .4, 10, Math.max(w, h) * .4, .8, '#ff4f9a', 8, .1);
  };
  F.hint = function (x, y) {
    for (const hh of hints) if (Math.abs(hh.x - x) < 3 && Math.abs(hh.y - y) < 3) { hh.t = 0; return; }
    if (hints.length > 4) hints.shift();
    hints.push({ x, y, t: 0, life: 1.6 });
  };

  // ---------------- version 3: level map effects ----------------
  // kind 5 = swirl particle (orbits o.cx, o.cy with radius o.rad changing by o.vrad)
  function swirl(cx, cy, n, r0, r1, life, size, kinds, inward) {
    for (let i = 0; i < n; i++) {
      const o = part(5, cx, cy, 0, 0, life * (.8 + Math.random() * .4), size * (.7 + Math.random() * .6), sprite(kinds[i % kinds.length]));
      if (!o) break; o.cx = cx; o.cy = cy; o.ang = i / n * 6.283; o.vang = (inward ? 7 : 5) * (Math.random() < .2 ? -1 : 1); o.rad = inward ? r0 : r1 * .2; o.r1 = inward ? 4 : r1; o.r0 = o.rad; o.delay = i * .012;
    }
  }
  function stamp(img, x, y, size, life, mode) { if (stamps.length > 10) stamps.shift(); stamps.push({ img, x, y, size, life, mode, t: 0 }); }
  F.levelWin = function (opts) {
    opts = opts || {}; const w = W(), h = Hh(), q = Q(), x = opts.x != null ? opts.x : w / 2, y = opts.y != null ? opts.y : h * .36;
    shows.push({ kind: 'win', t: 0, life: 3.4, x, y, str: opts.text || 'Tubli!', stars: opts.stars == null ? 3 : opts.stars | 0 });
    F.confetti(q ? 1 : .6);
    const nr = [3, 6, 9][q];
    for (let i = 0; i < nr; i++) rockets.push({ x: w * (.15 + Math.random() * .7), y: h + 10, tx: w * (.12 + Math.random() * .76), ty: h * (.1 + Math.random() * .3), t: -i * .32 - .15, dur: .75 + Math.random() * .25, col: RAINBOW[(i * 3) % RAINBOW.length] });
    const ns = [10, 22, 36][q];
    for (let i = 0; i < ns; i++) { const o = part(0, Math.random() * w, -20 - Math.random() * 60, (Math.random() - .5) * 40, 110 + Math.random() * 120, 2.4 + Math.random(), 14 + Math.random() * 14, sprite(i % 4 ? 'star:#ffd23f' : 'star:' + RAINBOW[i % RAINBOW.length])); if (o) { o.g = 40; o.delay = .4 + Math.random() * 1.6; } }
    burst(x, y, [10, 18, 28][q], 300, ['star:#ffd23f', 'spark:#ffffff', 'star:#ff4f9a', 'star:#3db8ff'], 20, .9, 220);
    ring(x, y, 20, Math.max(w, h) * .5, .9, '#ffd23f', 10); if (q) ring(x, y, 10, Math.max(w, h) * .38, .8, '#ff4f9a', 8, .12);
  };
  F.levelFail = function (opts) {
    opts = opts || {}; const w = W(), h = Hh(), q = Q(), x = opts.x != null ? opts.x : w / 2, y = opts.y != null ? opts.y : h * .38;
    shows.push({ kind: 'fail', t: 0, life: 2.6, x, y, str: opts.text || 'Peaaegu!' });
    const n = [6, 9, 12][q];
    for (let i = 0; i < n; i++) { const a = i / n * 6.283, v = 40 + Math.random() * 40; const o = part(0, x + Math.cos(a) * 20, y + 30 + Math.sin(a) * 10, Math.cos(a) * v, Math.sin(a) * v * .5 - 10, 1.6 + Math.random() * .6, 60 + Math.random() * 40, sprite('cloud')); if (o) { o.drag = 1.4; o.grow = .6; o.vr = 0; o.alpha = .85; } }
    for (let i = 0; i < [2, 4, 5][q]; i++) { const o = part(0, x - 50 + i * 25 + Math.random() * 10, y + 50, 0, 30 + Math.random() * 20, 1.4, 12, sprite('drop')); if (o) { o.g = 30; o.vr = 0; o.rot = 0; o.delay = .3 + i * .15; } }
  };
  F.iceCrack = function (x, y, s) {
    s = s || 64; const q = Q();
    let o = part(0, x, y, 0, 0, .25, s * 1.1, sprite('flash:#bfe8ff')); if (o) { o.grow = .5; o.vr = 0; o.rot = 0; }
    ring(x, y, s * .2, s * .9, .4, '#8fd4ff', 7);
    const n = [6, 10, 14][q];
    for (let i = 0; i < n; i++) { const a = i / n * 6.283 + Math.random() * .4, v = 140 + Math.random() * 160; o = part(0, x + Math.cos(a) * s * .2, y + Math.sin(a) * s * .2, Math.cos(a) * v, Math.sin(a) * v - 90, .6 + Math.random() * .3, s * (.18 + Math.random() * .16), sprite('shard')); if (o) { o.g = 620; o.drag = 1; o.vr = (Math.random() - .5) * 18; } }
    F.sparkle(x, y, [2, 4, 6][q], s * .4);
  };
  F.boxBreak = function (x, y, s) {
    s = s || 64; const q = Q();
    ring(x, y, s * .2, s, .45, '#ff8cc4', 7);
    const n = [4, 6, 8][q];
    for (let i = 0; i < n; i++) { const a = i / n * 6.283 + Math.random() * .5, v = 130 + Math.random() * 130; const o = part(0, x, y, Math.cos(a) * v, Math.sin(a) * v - 120, .7 + Math.random() * .3, s * (.3 + Math.random() * .12), sprite('plank')); if (o) { o.g = 700; o.drag = .8; o.vr = (Math.random() - .5) * 14; } }
    F.confetti(q ? .3 : .15, x, y);
    burst(x, y, [4, 7, 10][q], 200, ['star:#ff4f9a', 'spark:#ffffff', 'star:#ffd23f'], 14, .6, 300);
  };
  F.obstacleClear = function (kind, x, y, s) {
    s = s || 64; const q = Q();
    if (kind === 'ice') return F.iceCrack(x, y, s);
    if (kind === 'box') return F.boxBreak(x, y, s);
    if (kind === 'lockedCrate') { F.boxBreak(x, y, s); ring(x, y, s * .2, s * 1.2, .6, '#ffd23f', 8, .08); F.text(x, y - s * .5, 'Lahti!', '#ffd23f', 22); return; }
    if (kind === 'cobweb') { for (let i = 0; i < [4, 6, 9][q]; i++) { const a = Math.random() * 6.28; const o = part(0, x + Math.cos(a) * s * .25, y + Math.sin(a) * s * .25, Math.cos(a) * 60, Math.sin(a) * 60 - 30, .6, s * (.25 + Math.random() * .15), sprite('puff')); if (o) { o.drag = 3; o.grow = .6; o.alpha = .8; o.vr = 0; } } F.sparkle(x, y, [2, 4, 6][q], s * .4); return; }
    if (kind === 'sand') { for (let i = 0; i < [8, 14, 22][q]; i++) { const a = -Math.PI * Math.random(), v = 80 + Math.random() * 140; const o = part(0, x + (Math.random() - .5) * s * .6, y + s * .1, Math.cos(a) * v, Math.sin(a) * v, .6 + Math.random() * .3, 5 + Math.random() * 5, sprite(i % 3 ? 'dot:#ffd59a' : 'dot:#f0b060')); if (o) { o.g = 560; o.drag = 1; } } const o = part(0, x, y + s * .2, 0, -20, .5, s * .7, sprite('puff')); if (o) { o.grow = .5; o.alpha = .6; o.vr = 0; } return; }
    if (kind === 'bubble') { ring(x, y, s * .2, s * .8, .4, '#ff6fae', 8); for (let i = 0; i < [5, 8, 12][q]; i++) { const a = i / 8 * 6.283 + Math.random(), v = 120 + Math.random() * 120; const o = part(0, x, y, Math.cos(a) * v, Math.sin(a) * v - 80, .6 + Math.random() * .3, s * (.16 + Math.random() * .12), sprite('goo')); if (o) { o.g = 520; o.drag = 1.2; o.vr = 0; o.rot = 0; } } F.sparkle(x, y, [2, 3, 5][q], s * .3); return; }
    F.sparkle(x, y, 6, s * .4);
  };
  F.boosterUse = function (kind, x, y) {
    const q = Q(), bimg = ART.booster ? ART.booster(kind, Math.round(72 * (ART.dpr || 1))) : null;
    if (kind === 'wand') {
      swirl(x, y, [8, 14, 22][q], 110, 0, .7, 16, ['star:#ffd23f', 'spark:#ffffff', 'star:#ff9ccc', 'star:#8fdcff'], true);
      if (bimg) stamp(bimg, x + 34, y - 40, 64, .9, 'wave');
      ring(x, y, 8, 70, .5, '#ffd23f', 8, .55); ring(x, y, 6, 50, .45, '#ff9ccc', 6, .62);
      const o = part(0, x, y, 0, 0, .35, 90, sprite('flash:#fff27a')); if (o) { o.delay = .55; o.grow = .8; o.vr = 0; o.rot = 0; }
      setTimeoutSafe(() => burst(x, y, [6, 10, 16][Q()], 200, ['star:#ffd23f', 'spark:#ffffff', 'star:#ff4fa8'], 15, .6, 280), 560);
    } else if (kind === 'scissors') {
      if (bimg) stamp(bimg, x, y - 6, 70, .7, 'snip');
      links.push({ x0: x - 40, y0: y + 26, x1: x + 40, y1: y - 26, t: -.2, life: .45, slash: 1 });
      for (const sd of [-1, 1]) for (let i = 0; i < [3, 5, 7][q]; i++) { const o = part(0, x, y, sd * (90 + Math.random() * 90), -60 - Math.random() * 80, .55, 10 + Math.random() * 6, sprite(i % 2 ? 'spark:#ffffff' : 'star:#ff9ccc')); if (o) { o.g = 300; o.drag = 2; o.delay = .22; } }
    } else if (kind === 'shuffle') {
      stamps.push({ x, y, size: Math.min(W(), Hh()) * .42, life: 1.1, mode: 'whirl', t: 0 });
      swirl(x, y, [10, 18, 28][q], 0, Math.min(W(), Hh()) * .45, 1, 14, ['spark:#ffffff', 'star:#2fd59a', 'star:#3db8ff', 'star:#ffd23f'], false);
      if (bimg) stamp(bimg, x, y, 80, 1, 'pop');
    } else if (kind === 'moves5') {
      if (bimg) stamp(bimg, x, y, 76, .9, 'pop');
      F.text(x, y - 48, '+5 käiku', '#2fd59a', 26, 'pop', 1.3);
      ring(x, y, 10, 70, .5, '#2fd59a', 8); F.sparkle(x, y, [4, 7, 10][q], 40);
    } else F.sparkle(x, y, 8, 30);
  };
  // timers driven by FX.update (no real setTimeout, so pausing the loop pauses them too)
  const timers = [];
  function setTimeoutSafe(fn, ms) { timers.push({ fn, t: ms / 1000 }); }
  F.rainbowLink = function (x0, y0, x1, y1) {
    if (links.length > 6) links.shift();
    links.push({ x0, y0, x1, y1, t: 0, life: .75 });
    const q = Q(), n = [3, 6, 9][q], mx = (x0 + x1) / 2, my = Math.min(y0, y1) - 30 - Math.hypot(x1 - x0, y1 - y0) * .25;
    for (let i = 1; i <= n; i++) { const u = i / (n + 1), a = 1 - u, px = a * a * x0 + 2 * a * u * mx + u * u * x1, py = a * a * y0 + 2 * a * u * my + u * u * y1; const o = part(0, px, py, (Math.random() - .5) * 30, -20 - Math.random() * 30, .5, 10 + Math.random() * 5, sprite('star:' + RAINBOW[i % RAINBOW.length])); if (o) { o.delay = u * .3; o.drag = 1.5; } }
  };
  let trailN = 0, trailT = 0;
  F.trail = function (x, y) {
    const tn = (typeof performance !== 'undefined' ? performance.now() : Date.now()); if (tn - trailT < [60, 35, 22][Q()]) return; trailT = tn;
    const o = part(0, x + (Math.random() - .5) * 10, y + (Math.random() - .5) * 10, (Math.random() - .5) * 20, 10 + Math.random() * 20, .45, 9 + Math.random() * 5, sprite(trailN % 3 ? 'dot:' + RAINBOW[trailN % 7] : 'spark:#ffffff'));
    trailN++; if (o) { o.drag = 2; o.vr = 0; }
  };
  F.idle = function (ctx, x, y, s, seed, t) {
    if (!Q()) return;
    const h = ((seed * 2246822519) >>> 0) / 4294967296, per = 3.6 + h * 4.2, u = (t + h * 17) % per;
    if (u > .7) return;
    const e = Math.sin(u / .7 * Math.PI), k = Math.floor((t + h * 17) / per), hx = (((seed + k * 7) * 2654435761) >>> 0) / 4294967296;
    const sx = x + (hx - .5) * s * .55, sy = y - s * (.12 + hx * .22), r = s * .2 * e;
    ctx.save(); ctx.globalAlpha = .95 * e; ctx.translate(sx, sy); ctx.rotate(u * 1.5); ctx.drawImage(sprite('spark:#fff6c0'), -r, -r, r * 2, r * 2); ctx.restore();
  };

  const ease = u => 1 - Math.pow(1 - u, 3);
  const outBack = u => { const c = 2.2; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
  F.update = function (dt) {
    dt = Math.min(dt || 0, .05);
    for (let i = pops.length - 1; i >= 0; i--) { pops[i].t += dt; if (pops[i].t >= pops[i].dur) pops.splice(i, 1); }
    for (let i = hints.length - 1; i >= 0; i--) { hints[i].t += dt; if (hints[i].t >= hints[i].life) hints.splice(i, 1); }
    for (let i = shows.length - 1; i >= 0; i--) { shows[i].t += dt; if (shows[i].t >= shows[i].life) shows.splice(i, 1); }
    for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { const f = timers[i].fn; timers.splice(i, 1); try { f(); } catch (e) { } } }
    for (let i = stamps.length - 1; i >= 0; i--) { stamps[i].t += dt; if (stamps[i].t >= stamps[i].life) stamps.splice(i, 1); }
    for (let i = links.length - 1; i >= 0; i--) { links[i].t += dt; if (links[i].t >= links[i].life) links.splice(i, 1); }
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i]; r.t += dt; if (r.t < 0) continue;
      const u = Math.min(1, r.t / r.dur), e = 1 - Math.pow(1 - u, 2), px = r.x + (r.tx - r.x) * e, py = r.y + (r.ty - r.y) * e;
      if (Math.random() < .7) { const o = part(0, px, py, (Math.random() - .5) * 20, 30, .35, 7 + Math.random() * 4, sprite('dot')); if (o) o.vr = 0; }
      r.px = px; r.py = py;
      if (u >= 1) {
        rockets.splice(i, 1); const q = Q(), n = [12, 22, 34][q];
        for (let k = 0; k < n; k++) { const a = k / n * 6.283, v = 150 + Math.random() * 90; const o = part(0, r.tx, r.ty, Math.cos(a) * v, Math.sin(a) * v, .9 + Math.random() * .4, 9 + Math.random() * 6, sprite(k % 3 ? 'spark:' + r.col : 'dot:' + r.col)); if (o) { o.g = 120; o.drag = 2.2; } }
        ring(r.tx, r.ty, 6, 60, .5, r.col, 5); if (q) { const o = part(0, r.tx, r.ty, 0, 0, .3, 80, sprite('flash:' + r.col)); if (o) { o.grow = .5; o.vr = 0; o.rot = 0; } }
      }
    }
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i]; f.t += dt;
      if (f.land === 0 && f.t >= f.dur) { f.land = f.t; for (let k = 0; k < [3, 4, 6][Q()]; k++) { const a = Math.PI + k / 5 * Math.PI; const o = part(0, f.tx, f.ty + f.size * .3, Math.cos(a) * 80, Math.sin(a) * 40, .35, 9, sprite('puff')); if (o) o.drag = 3; } }
      if (f.land && f.t - f.land > f.lend) flights.splice(i, 1);
    }
    for (let i = texts.length - 1; i >= 0; i--) { const tx = texts[i]; tx.t += dt; if (tx.t > .25) tx.y += tx.vy * dt; if (tx.t > tx.life) texts.splice(i, 1); }
    for (let i = P.length - 1; i >= 0; i--) {
      const o = P[i]; o.t += dt;
      if (o.k === 3) {
        if (o.t < o.delay) { o.vx *= Math.exp(-4 * dt); o.vy *= Math.exp(-4 * dt); o.x += o.vx * dt; o.y += o.vy * dt; }
        else {
          if (!o.sx) { o.sx = o.x; o.sy = o.y; o.t0 = o.t; }
          const tgt = hud(o.name), u = Math.min(1, (o.t - o.t0) / .55), e = ease(u);
          const mx = (o.sx + tgt.x) / 2 + (o.sx < tgt.x ? -60 : 60), my = Math.min(o.sy, tgt.y) - 40;
          const a = 1 - e; o.x = a * a * o.sx + 2 * a * e * mx + e * e * tgt.x; o.y = a * a * o.sy + 2 * a * e * my + e * e * tgt.y;
          if (u >= 1) {
            if (o.first || Math.random() < .5) { try { if (typeof UI !== 'undefined' && UI && UI.hudPulse) UI.hudPulse(o.name); } catch (e) { } }
            if (F.onArrive) try { F.onArrive(o.name); } catch (e) { }
            if (o.first && Q() > 0) { const r = part(1, tgt.x, tgt.y, 0, 0, .3, 6, null, '#ffffff'); if (r) { r.grow = 22; r.w = 4; } }
            P.splice(i, 1); pool.push(o); continue;
          }
        }
        continue;
      }
      if (o.t >= o.life + o.delay) { P.splice(i, 1); pool.push(o); continue; }
      if (o.k === 5) { if (o.t < o.delay) continue; const u = (o.t - o.delay) / o.life; o.ang += o.vang * dt * (1 + u); o.rad = o.r0 + (o.r1 - o.r0) * ease(u); o.x = o.cx + Math.cos(o.ang) * o.rad; o.y = o.cy + Math.sin(o.ang) * o.rad; o.rot += 6 * dt; continue; }
      if (o.drag) { const d = Math.exp(-o.drag * dt); o.vx *= d; o.vy *= d; }
      o.vy += o.g * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.rot += o.vr * dt;
      if (o.k === 2) { o.ph += dt * 6; o.x += Math.sin(o.ph) * 20 * dt; if (o.y > Hh() + 20) { P.splice(i, 1); pool.push(o); } }
    }
  };
  function drawText(ctx, tx) {
    const u = tx.t / tx.life, pin = Math.min(1, tx.t / .28), sc = outBack(pin), a = u < .75 ? 1 : 1 - (u - .75) / .25;
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(tx.x, tx.y); ctx.scale(sc, sc);
    ctx.font = '900 ' + tx.size + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    if (tx.kind === 'badge') {
      const w = ctx.measureText(tx.str).width + tx.size * 1.1, h = tx.size * 1.45;
      ART.H.R(ctx, -w / 2, -h / 2 + 3, w, h, h / 2); ctx.fillStyle = '#b0125a'; ctx.fill();
      ART.H.R(ctx, -w / 2, -h / 2, w, h, h / 2); const gr = ctx.createLinearGradient(0, -h / 2, 0, h / 2); gr.addColorStop(0, '#ff8cc4'); gr.addColorStop(1, '#ff3d8b'); ctx.fillStyle = gr; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.fillText(tx.str, 0, 1);
      ART.sparkAt(ctx, w / 2 - 2, -h / 2, tx.size * .42 * (1 + .2 * Math.sin(tx.t * 12)), '#fff6b0');
      ctx.restore(); return;
    }
    ctx.lineWidth = tx.size * .26; ctx.strokeStyle = '#3a1f6e'; ctx.strokeText(tx.str, 0, tx.size * .07); ctx.strokeText(tx.str, 0, 0);
    ctx.lineWidth = tx.size * .1; ctx.strokeStyle = '#ffffff'; ctx.strokeText(tx.str, 0, 0);
    let fill;
    if (tx.kind === 'rainbow') {
      const w = ctx.measureText(tx.str).width, off = (tx.t * 1.5) % 1; fill = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
      for (let i = 0; i <= 6; i++) fill.addColorStop(i / 6, RAINBOW[(i + Math.floor(off * 7)) % 7]);
    } else { fill = ctx.createLinearGradient(0, -tx.size * .5, 0, tx.size * .5); fill.addColorStop(0, ART.lt(tx.col, .55)); fill.addColorStop(1, tx.col); }
    ctx.fillStyle = fill; ctx.fillText(tx.str, 0, 0);
    ctx.restore();
  }
  F.draw = function (ctx) {
    if (!P.length && !flights.length && !texts.length && !hints.length && !shows.length && !rockets.length && !stamps.length && !links.length) return;
    ctx.save(); const dsc = ART.scaleOf(ctx);
    // hint pulses under everything
    for (const hh of hints) {
      const u = hh.t / hh.life;
      for (let k = 0; k < 2; k++) {
        const v = (u * 2 + k * .5) % 1; ctx.globalAlpha = (1 - v) * .7 * (u > .8 ? (1 - u) / .2 : 1);
        ctx.lineWidth = 4; ctx.strokeStyle = '#2fd59a'; ctx.beginPath(); ctx.arc(hh.x, hh.y, 14 + v * 26, 0, 6.283); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    // level-up rays behind the burst
    for (const s of shows) {
      if (s.kind === 'fail') continue;
      const u = s.t / s.life, a = u < .1 ? u / .1 : u > .75 ? (1 - u) / .25 : 1, R = Math.max(W(), Hh()) * .75 * (u < .2 ? outBack(u / .2) : 1);
      ctx.save(); ctx.globalAlpha = a * .55; ctx.translate(s.x, s.y); ctx.rotate(s.t * .6);
      ctx.drawImage(sprite('rays'), -R, -R, R * 2, R * 2); ctx.restore();
      ctx.save(); ctx.globalAlpha = a * .9; const gr = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, R * .45); gr.addColorStop(0, 'rgba(255,240,160,.9)'); gr.addColorStop(1, 'rgba(255,200,240,0)');
      ctx.fillStyle = gr; ctx.fillRect(s.x - R, s.y - R, R * 2, R * 2); ctx.restore();
    }
    // rainbow links (ribbon of 5 bands growing along a curve) and the scissors slash
    for (const L of links) {
      if (L.t < 0) continue;
      const u = L.t / L.life, grow = Math.min(1, u / .45), fade = u < .55 ? 1 : 1 - (u - .55) / .45;
      ctx.save(); ctx.globalAlpha = Math.max(0, fade); ctx.lineCap = 'round';
      if (L.slash) { const x = L.x0 + (L.x1 - L.x0) * grow, y = L.y0 + (L.y1 - L.y0) * grow; ctx.beginPath(); ctx.moveTo(L.x0, L.y0); ctx.lineTo(x, y); ctx.lineWidth = 9; ctx.strokeStyle = 'rgba(58,31,110,.3)'; ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = '#ffffff'; ctx.stroke(); ctx.restore(); continue; }
      const mx = (L.x0 + L.x1) / 2, my = Math.min(L.y0, L.y1) - 30 - Math.hypot(L.x1 - L.x0, L.y1 - L.y0) * .25;
      const dx = L.x1 - L.x0, dy = L.y1 - L.y0, dl = Math.hypot(dx, dy) || 1, nx = -dy / dl, ny = dx / dl, cols = ['#ff5a5f', '#ffb21e', '#ffe14a', '#2fd59a', '#3db8ff', '#9a6bff'];
      const steps = 18, end = Math.max(1, Math.round(steps * grow)), start = u > .55 ? Math.round(steps * (u - .55) / .45) : 0;
      for (let b = 0; b < cols.length; b++) {
        const off = (b - 2.5) * 3.2; ctx.beginPath();
        for (let k = start; k <= end; k++) { const v = k / steps, a = 1 - v, px = a * a * L.x0 + 2 * a * v * mx + v * v * L.x1 + nx * off, py = a * a * L.y0 + 2 * a * v * my + v * v * L.y1 + ny * off; if (k === start) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
        ctx.lineWidth = 3.6; ctx.strokeStyle = cols[b]; ctx.stroke();
      }
      ctx.restore();
    }
    // rockets (bright heads)
    for (const r of rockets) { if (r.t < 0 || r.px == null) continue; ctx.globalAlpha = 1; ctx.drawImage(sprite('flash:' + r.col), r.px - 12, r.py - 12, 24, 24); }
    ctx.globalAlpha = 1;
    for (const f of flights) {
      let x, y, sx = 1, sy = 1; if (!f.size) f.size = f.img ? f.img.width / dsc : 48;
      if (!f.land) { const u = f.t / f.dur; x = f.fx + (f.tx - f.fx) * u; y = f.fy + (f.ty - f.fy) * u - Math.sin(u * Math.PI) * (44 + Math.abs(f.tx - f.fx) * .25); const s = .45 + .55 * u; sx = s * (1 - .12 * Math.sin(u * Math.PI)); sy = s * (1 + .14 * Math.sin(u * Math.PI)); }
      else { const v = Math.min(1, (f.t - f.land) / f.lend); x = f.tx; y = f.ty; sx = 1 + Math.sin(v * Math.PI) * .24; sy = 1 - Math.sin(v * Math.PI) * .2; }
      if (f.img) { const w = f.size * sx, h = f.size * sy; ctx.drawImage(f.img, x - w / 2, y + f.size / 2 - h, w, h); }
    }
    for (let i = 0; i < P.length; i++) {
      const o = P[i];
      if (o.k === 3) { const s = o.size * (o.t < .15 ? outBack(o.t / .15) : 1); ctx.globalAlpha = 1; ctx.drawImage(o.img, o.x - s / 2, o.y - s / 2, s, s); continue; }
      const tt = o.t - o.delay; if (tt < 0) continue; const u = tt / o.life;
      if (o.k === 0 || o.k === 5) {
        const a = u < .12 ? u / .12 : 1 - (u - .12) / .88, s = o.size * (1 + o.grow * u);
        ctx.globalAlpha = Math.max(0, a) * (o.alpha || 1);
        if (o.vr) { ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.rot); ctx.drawImage(o.img, -s / 2, -s / 2, s, s); ctx.restore(); }
        else ctx.drawImage(o.img, o.x - s / 2, o.y - s / 2, s, s);
      } else if (o.k === 1) {
        const r = o.size + o.grow * ease(u), w = o.w * (1 - u) + 1.5;
        ctx.globalAlpha = Math.max(0, 1 - u * u);
        ctx.lineWidth = w + 3; ctx.strokeStyle = 'rgba(58,31,110,.35)'; ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, 6.283); ctx.stroke();
        ctx.lineWidth = w; ctx.strokeStyle = o.col; ctx.stroke();
      } else if (o.k === 2) {
        ctx.globalAlpha = u > .8 ? (1 - u) / .2 : 1; ctx.fillStyle = o.col;
        const c = Math.cos(o.rot), s = Math.sin(o.rot), w = o.size, h = o.size * .55 * Math.abs(Math.sin(o.ph));
        ctx.save(); ctx.translate(o.x, o.y); ctx.transform(c, s, -s, c, 0, 0); ctx.fillRect(-w / 2, -h / 2, w, h + .6); ctx.restore();
      } else if (o.k === 4) {
        const a = u < .15 ? u / .15 : 1 - (u - .15) / .85, s = o.size * (.6 + .5 * ease(u));
        ctx.globalAlpha = Math.max(0, a) * o.alpha; ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.t * o.vr); ctx.drawImage(o.img, -s, -s, s * 2, s * 2); ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    for (const st of stamps) {
      const u = st.t / st.life, a = u < .75 ? 1 : 1 - (u - .75) / .25;
      ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(st.x, st.y);
      if (st.mode === 'whirl') {
        const R = st.size * (.4 + .6 * ease(Math.min(1, u * 1.6)));
        ctx.rotate(st.t * 7); ctx.lineCap = 'round';
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(0, 0, R * (1 - k * .18), k * 2.09, k * 2.09 + 1.5); ctx.lineWidth = 7 - k; ctx.strokeStyle = ['#2fd59a', '#3db8ff', '#ffd23f'][k]; ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, R * (1 - k * .18), k * 2.09 + 3.14, k * 2.09 + 4.4); ctx.stroke(); }
      } else {
        let sc = st.mode === 'pop' ? outBack(Math.min(1, u * 3.5)) : 1, rot = 0, sy = 1;
        if (st.mode === 'wave') { sc = outBack(Math.min(1, u * 4)); rot = Math.sin(st.t * 14) * .45 * (1 - u); }
        if (st.mode === 'snip') { sc = outBack(Math.min(1, u * 5)); const k = Math.sin(st.t * 30); sy = 1 - .12 * Math.max(0, k) * (u < .6 ? 1 : 0); rot = -.2 * Math.max(0, k) * (u < .6 ? 1 : 0); }
        ctx.rotate(rot); ctx.scale(sc, sc * sy); ctx.drawImage(st.img, -st.size / 2, -st.size / 2, st.size, st.size);
      }
      ctx.restore();
    }
    for (const s of shows) {
      if (s.kind === 'win') {
        drawText(ctx, { x: s.x, y: s.y, str: s.str, col: '#ffd23f', size: Math.min(86, W() * .2), kind: 'rainbow', t: s.t, life: s.life });
        const ss = Math.min(64, W() * .14), img = ART.icon('star', Math.round(ss * (ART.dpr || 1)));
        for (let i = 0; i < 3; i++) {
          const t0 = .45 + i * .28, tt = s.t - t0; if (tt < 0) continue;
          const u = s.t / s.life, a = u < .8 ? 1 : 1 - (u - .8) / .2, sc = outBack(Math.min(1, tt / .32)), on = i < s.stars;
          const x = s.x + (i - 1) * ss * 1.15, y = s.y - Math.min(86, W() * .2) * .95 - (i === 1 ? ss * .22 : 0), z = (i === 1 ? 1.2 : 1) * ss * sc;
          ctx.save(); ctx.globalAlpha = a * (on ? 1 : .35); ctx.translate(x, y); ctx.rotate((i - 1) * .18 * (1 - Math.min(1, tt / .32))); ctx.drawImage(img, -z / 2, -z / 2, z, z); ctx.restore();
        }
      } else if (s.kind === 'fail') {
        const u = s.t / s.life, sway = Math.sin(s.t * 2.2) * .04;
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(sway - .03 * Math.min(1, s.t)); ctx.translate(-s.x, -s.y);
        drawText(ctx, { x: s.x, y: s.y + Math.min(1, s.t) * 6, str: s.str, col: '#9a8cff', size: Math.min(54, W() * .12), kind: 'pop', t: s.t, life: s.life });
        ctx.restore();
      } else drawText(ctx, { x: s.x, y: s.y, str: 'Uus tase!', col: '#ffd23f', size: Math.min(64, W() * .13), kind: 'rainbow', t: s.t, life: s.life });
    }
    for (const tx of texts) drawText(ctx, tx);
    ctx.restore();
  };
  F.clear = function () { while (P.length) pool.push(P.pop()); pops.length = 0; flights.length = 0; texts.length = 0; hints.length = 0; shows.length = 0; rockets.length = 0; stamps.length = 0; links.length = 0; timers.length = 0; };
  F.count = () => P.length + flights.length;
  F.active = () => P.length > 0 || flights.length > 0 || pops.length > 0 || texts.length > 0 || hints.length > 0 || shows.length > 0 || rockets.length > 0 || stamps.length > 0 || links.length > 0 || timers.length > 0;
  F.busy = () => P.length > 0 || flights.length > 0 || pops.length > 0;
  window.__fx = F;
  return F;
})();
try { ART.perf.apply(); } catch (e) { } // effect quality for this device (ART.perf in 20-art.js)
try { window.__mgArt = { ART, FX }; } catch (e) { } // test hook for tools/mergeperf.js and tools/artgallery.js
