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
//   FX.update(dt)  FX.draw(ctx)  FX.clear()  FX.count()  FX.active()  FX.busy()  FX.quality = 0 | 1 | 2  FX.onArrive = fn(name)
const FX = (function () {
  const F = { quality: 2, onArrive: null, spawnDur: 0.42 };
  const CAP = [110, 260, 480];
  const P = [], pool = [], pops = [], flights = [], texts = [], hints = [], shows = [];
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

  const ease = u => 1 - Math.pow(1 - u, 3);
  const outBack = u => { const c = 2.2; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
  F.update = function (dt) {
    dt = Math.min(dt || 0, .05);
    for (let i = pops.length - 1; i >= 0; i--) { pops[i].t += dt; if (pops[i].t >= pops[i].dur) pops.splice(i, 1); }
    for (let i = hints.length - 1; i >= 0; i--) { hints[i].t += dt; if (hints[i].t >= hints[i].life) hints.splice(i, 1); }
    for (let i = shows.length - 1; i >= 0; i--) { shows[i].t += dt; if (shows[i].t >= shows[i].life) shows.splice(i, 1); }
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
    if (!P.length && !flights.length && !texts.length && !hints.length && !shows.length) return;
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
      const u = s.t / s.life, a = u < .1 ? u / .1 : u > .75 ? (1 - u) / .25 : 1, R = Math.max(W(), Hh()) * .75 * (u < .2 ? outBack(u / .2) : 1);
      ctx.save(); ctx.globalAlpha = a * .55; ctx.translate(s.x, s.y); ctx.rotate(s.t * .6);
      ctx.drawImage(sprite('rays'), -R, -R, R * 2, R * 2); ctx.restore();
      ctx.save(); ctx.globalAlpha = a * .9; const gr = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, R * .45); gr.addColorStop(0, 'rgba(255,240,160,.9)'); gr.addColorStop(1, 'rgba(255,200,240,0)');
      ctx.fillStyle = gr; ctx.fillRect(s.x - R, s.y - R, R * 2, R * 2); ctx.restore();
    }
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
      if (o.k === 0) {
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
    for (const s of shows) {
      drawText(ctx, { x: s.x, y: s.y, str: 'Uus tase!', col: '#ffd23f', size: Math.min(64, W() * .13), kind: 'rainbow', t: s.t, life: s.life });
    }
    for (const tx of texts) drawText(ctx, tx);
    ctx.restore();
  };
  F.clear = function () { while (P.length) pool.push(P.pop()); pops.length = 0; flights.length = 0; texts.length = 0; hints.length = 0; shows.length = 0; };
  F.count = () => P.length + flights.length;
  F.active = () => P.length > 0 || flights.length > 0 || pops.length > 0 || texts.length > 0 || hints.length > 0 || shows.length > 0;
  F.busy = () => P.length > 0 || flights.length > 0 || pops.length > 0;
  window.__fx = F;
  return F;
})();
