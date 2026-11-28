// ===== FX (Ash): merge bursts, spawn arcs, flying rewards, confetti. =====
// Coordinates are CSS pixels in the same space the game draws in (ctx already scaled by devicePixelRatio).
// Cheap on low-end phones: one pooled particle array, pre-rendered sprites, no shadowBlur, a hard cap.
//   FX.merge(x, y, chain, level)      burst at a cell centre; bigger for higher levels, special at the chain's max level
//   FX.squash(x, y) -> [sx, sy] | null  scale to apply to the item drawn at (x, y) while its pop plays
//   FX.spawn(fx, fy, tx, ty, img, size) an item flies out of a generator in an arc and bounces; size = drawn px
//   FX.landing(x, y) -> true while an item is still flying to (x, y) (hide it on the board until it lands)
//   FX.coins(x, y, n) / FX.stars / FX.energy  icons burst out then fly to UI.hudPos(name); UI.hudPulse(name) on arrival
//   FX.confetti()  FX.sparkle(x, y, n)  FX.ring(x, y, r, col)  FX.text(x, y, str, col)
//   FX.update(dt)  FX.draw(ctx)  FX.clear()  FX.count()  FX.quality = 0 | 1 | 2  FX.onArrive = fn(name)
const FX = (function () {
  const F = { quality: 2, onArrive: null };
  const CAP = [90, 220, 420];
  const P = []; // live particles (objects reused from the pool)
  const pool = [];
  const pops = [];   // {x, y, t, dur, amp}
  const flights = []; // spawn arcs
  const texts = [];
  function get() { return pool.pop() || {}; }
  function add(o) { if (P.length >= CAP[F.quality | 0]) { pool.push(o); return null; } P.push(o); return o; }
  // ---- sprites (rendered once) ----
  const spr = {};
  function sprite(name) {
    if (spr[name]) return spr[name];
    const s = 64, c = ART.mk(s, s), g = c.getContext('2d');
    if (name === 'glow') { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(.35, 'rgba(255,225,140,.6)'); gr.addColorStop(1, 'rgba(255,200,90,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }
    else if (name.indexOf('spark') === 0) { const col = name.split(':')[1] || '#ffd75a'; ART.H.spark(g, 32, 32, 31, ART.dk(col, .25)); ART.H.spark(g, 32, 32, 27, col); ART.H.spark(g, 32, 32, 12, '#ffffff'); }
    else if (name.indexOf('dot:') === 0) { const col = name.split(':')[1]; g.beginPath(); g.arc(32, 32, 26, 0, 6.29); g.fillStyle = ART.dk(col, .25); g.fill(); g.beginPath(); g.arc(32, 32, 21, 0, 6.29); g.fillStyle = col; g.fill(); g.beginPath(); g.arc(25, 25, 8, 0, 6.29); g.fillStyle = 'rgba(255,255,255,.8)'; g.fill(); }
    else if (name === 'dot') { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.5, 'rgba(255,240,200,.9)'); gr.addColorStop(1, 'rgba(255,220,150,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }
    else if (name === 'heart') { ART.H.heart(g, 32, 38, 26); g.fillStyle = '#ff8fa6'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#c94a64'; g.stroke(); }
    else if (name === 'puff') { g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(32, 32, 28, 0, 6.29); g.fill(); }
    return (spr[name] = c);
  }
  function sparkCol(chain) {
    return ({ pagar: '#ffc24a', lill: '#ff8fb4', tooriist: '#7fb6ff', kala: '#5fc4f0', tee: '#7fd06a', mari: '#ff6f8a', piim: '#8fd0ff', mesi: '#ffb21e', kudum: '#ff8a6a', meri: '#4fd0c0', energia: '#ffd21e', raha: '#ffc21e' })[ART.alias && ART.alias[chain] || chain] || '#fff2b0';
  }
  // particle kinds: 0 sprite (spark/glow/dot/heart), 1 ring, 2 confetti, 3 flyer (icon to HUD)
  function part(kind, x, y, vx, vy, life, size, img, col) {
    const o = get(); o.k = kind; o.x = x; o.y = y; o.vx = vx; o.vy = vy; o.life = life; o.t = 0; o.size = size; o.img = img; o.col = col;
    o.rot = Math.random() * 6.28; o.vr = (Math.random() - .5) * 8; o.g = 0; o.drag = 0; o.add = false; o.grow = 0; o.alpha = 1; return add(o);
  }

  F.merge = function (x, y, chain, level) {
    level = level || 1; const max = ART.maxLevel ? ART.maxLevel(chain) : 0, isMax = max && level >= max;
    const q = F.quality | 0, big = Math.min(1, (level - 1) / 7), col = sparkCol(chain);
    pops.push({ x, y, t: 0, dur: .42 + big * .1, amp: .26 + big * .14 });
    // glow flash
    let o = part(0, x, y, 0, 0, .3 + big * .12, 46 + big * 34, sprite('glow')); if (o) { o.add = q > 0; o.grow = .7; o.vr = 0; o.alpha = .75; }
    // ring(s)
    o = part(1, x, y, 0, 0, .42, 12, null, col); if (o) o.grow = 34 + big * 40;
    if (isMax || level >= 5) { o = part(1, x, y, 0, 0, .6, 8, null, '#ffffff'); if (o) o.grow = (isMax ? 90 : 60) + big * 30; }
    // sparks
    const n = [6, 10, 14][q] + Math.round(big * [4, 8, 14][q]) + (isMax ? [6, 12, 20][q] : 0);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283 + Math.random() * .4, sp = 90 + Math.random() * 120 + big * 90;
      o = part(0, x, y, Math.cos(a) * sp, Math.sin(a) * sp - 40, .45 + Math.random() * .35, 10 + Math.random() * 10 + big * 6, sprite(i % 3 ? 'spark:' + col : 'dot:' + (i % 2 ? '#ffffff' : col)));
      if (o) { o.g = 260; o.drag = 2.6; }
    }
    if (isMax) {
      for (let i = 0; i < [4, 8, 12][q]; i++) { const a = Math.random() * 6.28; o = part(0, x, y, Math.cos(a) * 60, -80 - Math.random() * 80, 1 + Math.random() * .5, 14 + Math.random() * 8, sprite('heart')); if (o) { o.g = -20; o.drag = 1.2; } }
      F.text(x, y - 30, '★', '#ffcf3d');
      if (q > 0) F.confetti(.35, x, y);
    }
  };
  F.squash = function (x, y) {
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i]; if (Math.abs(p.x - x) > 4 || Math.abs(p.y - y) > 4) continue;
      const u = p.t / p.dur; // overshoot pop, then a little wobble
      const s = 1 + p.amp * Math.sin(u * Math.PI) * (1 - u) * 2.2, w = Math.sin(u * Math.PI * 3) * (1 - u) * .12;
      return [s + w, s - w];
    }
    return null;
  };
  F.spawn = function (fx, fy, tx, ty, img, size) {
    const sc = ART.dpr || 1; size = size || (img ? img.width / sc : 48);
    flights.push({ fx, fy, tx, ty, img, size, t: 0, dur: .38 + Math.min(.2, Math.hypot(tx - fx, ty - fy) / 1500), land: 0 });
    for (let i = 0; i < [2, 4, 6][F.quality | 0]; i++) { const o = part(0, fx, fy, (Math.random() - .5) * 120, -60 - Math.random() * 80, .4, 8 + Math.random() * 6, sprite('dot')); if (o) { o.g = 300; o.drag = 2; } }
  };
  F.landing = function (x, y) { for (const f of flights) if (f.land === 0 && Math.abs(f.tx - x) < 3 && Math.abs(f.ty - y) < 3) return true; return false; };
  function hud(name) {
    try { if (typeof UI !== 'undefined' && UI && UI.hudPos) { const p = UI.hudPos(name); if (p) return Array.isArray(p) ? { x: p[0], y: p[1] } : p; } } catch (e) { }
    return { x: name === 'energy' ? 40 : innerWidth - 40, y: 24 };
  }
  function flyers(name, icon, x, y, n) {
    n = Math.max(1, Math.min(n | 0 || 1, [5, 8, 12][F.quality | 0]));
    const img = ART.icon(icon, Math.round(30 * (ART.dpr || 1)));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, sp = 60 + Math.random() * 110;
      const o = part(3, x, y, Math.cos(a) * sp, Math.sin(a) * sp - 60, 1.1 + i * .07, 24, img);
      if (o) { o.name = name; o.delay = .25 + i * .05; o.sx = 0; o.sy = 0; o.arrived = false; o.first = i === 0; }
    }
  }
  F.coins = (x, y, n) => flyers('coins', 'coin', x, y, n);
  F.stars = (x, y, n) => flyers('stars', 'star', x, y, n);
  F.energy = (x, y, n) => flyers('energy', 'energy', x, y, n);
  F.xp = (x, y, n) => flyers('xp', 'xp', x, y, n);
  F.confetti = function (amount, cx, cy) {
    const W = innerWidth, H = innerHeight, cols = ['#ff8fa6', '#ffcf3d', '#7fc8f0', '#8fdc7c', '#c9a6f0', '#ff9a5c', '#ffffff'];
    const n = Math.round([30, 70, 130][F.quality | 0] * (amount || 1));
    for (let i = 0; i < n; i++) {
      const fromPt = cx != null, x = fromPt ? cx : Math.random() * W, y = fromPt ? cy : -10 - Math.random() * H * .3;
      const a = Math.random() * 6.28, sp = fromPt ? 120 + Math.random() * 200 : 0;
      const o = part(2, x, y, fromPt ? Math.cos(a) * sp : (Math.random() - .5) * 60, fromPt ? Math.sin(a) * sp - 120 : 60 + Math.random() * 120, 2.2 + Math.random() * 1.6, 5 + Math.random() * 5, null, cols[i % cols.length]);
      if (o) { o.g = fromPt ? 320 : 60; o.drag = fromPt ? 1.5 : .3; o.ph = Math.random() * 6.28; }
    }
  };
  F.sparkle = function (x, y, n, r) { for (let i = 0; i < (n || 6); i++) { const a = Math.random() * 6.28, d = Math.random() * (r || 20); const o = part(0, x + Math.cos(a) * d, y + Math.sin(a) * d, 0, -20, .6 + Math.random() * .4, 8 + Math.random() * 8, sprite('spark')); if (o) o.drag = 1; } };
  F.ring = function (x, y, r, col) { const o = part(1, x, y, 0, 0, .5, 6, null, col || '#ffffff'); if (o) o.grow = r || 60; };
  F.hearts = function (x, y, n) { for (let i = 0; i < (n || 5); i++) { const o = part(0, x + (Math.random() - .5) * 30, y, (Math.random() - .5) * 40, -50 - Math.random() * 50, 1.2, 14 + Math.random() * 8, sprite('heart')); if (o) { o.drag = .8; o.vr = 0; } } };
  F.text = function (x, y, str, col) { texts.push({ x, y, str, col: col || '#fff7d0', t: 0 }); };

  const ease = u => 1 - Math.pow(1 - u, 3);
  F.update = function (dt) {
    dt = Math.min(dt || 0, .05);
    for (let i = pops.length - 1; i >= 0; i--) { pops[i].t += dt; if (pops[i].t >= pops[i].dur) pops.splice(i, 1); }
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i]; f.t += dt;
      if (f.land === 0 && f.t >= f.dur) { f.land = f.t; for (let k = 0; k < [2, 4, 6][F.quality | 0]; k++) { const a = Math.PI + k / 5 * Math.PI; const o = part(0, f.tx, f.ty + f.size * .3, Math.cos(a) * 70, Math.sin(a) * 40, .35, 8, sprite('puff')); if (o) o.drag = 3; } }
      if (f.land && f.t - f.land > .22) flights.splice(i, 1);
    }
    for (let i = texts.length - 1; i >= 0; i--) { texts[i].t += dt; texts[i].y -= 30 * dt; if (texts[i].t > 1) texts.splice(i, 1); }
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
            P.splice(i, 1); pool.push(o); continue;
          }
        }
        continue;
      }
      if (o.t >= o.life) { P.splice(i, 1); pool.push(o); continue; }
      if (o.drag) { const d = Math.exp(-o.drag * dt); o.vx *= d; o.vy *= d; }
      o.vy += o.g * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.rot += o.vr * dt;
      if (o.k === 2) { o.ph += dt * 6; o.x += Math.sin(o.ph) * 20 * dt; if (o.y > innerHeight + 20) { P.splice(i, 1); pool.push(o); } }
    }
  };
  F.draw = function (ctx) {
    if (!P.length && !flights.length && !texts.length) return;
    ctx.save();
    // flights first (items landing on the board), then particles above
    for (const f of flights) {
      let x, y, sx = 1, sy = 1;
      if (!f.land) { const u = f.t / f.dur, e = u; x = f.fx + (f.tx - f.fx) * e; y = f.fy + (f.ty - f.fy) * e - Math.sin(u * Math.PI) * (40 + Math.abs(f.tx - f.fx) * .25); const s = .5 + .5 * u; sx = sy = s; }
      else { const v = (f.t - f.land) / .22; x = f.tx; y = f.ty; sx = 1 + Math.sin(v * Math.PI) * .18; sy = 1 - Math.sin(v * Math.PI) * .16; }
      if (f.img) { const w = f.size * sx, h = f.size * sy; ctx.drawImage(f.img, x - w / 2, y + f.size / 2 - h, w, h); }
    }
    for (let i = 0; i < P.length; i++) {
      const o = P[i], u = o.k === 3 ? 0 : o.t / o.life;
      if (o.k === 0) {
        const a = u < .15 ? u / .15 : 1 - (u - .15) / .85, s = o.size * (1 + o.grow * u);
        ctx.globalAlpha = Math.max(0, a) * (o.alpha || 1); if (o.add) ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(o.img, o.x - s / 2, o.y - s / 2, s, s);
        if (o.add) ctx.globalCompositeOperation = 'source-over';
      } else if (o.k === 1) {
        ctx.globalAlpha = Math.max(0, 1 - u); ctx.strokeStyle = o.col; ctx.lineWidth = 5 * (1 - u) + 1;
        ctx.beginPath(); ctx.arc(o.x, o.y, o.size + o.grow * ease(u), 0, 6.283); ctx.stroke();
      } else if (o.k === 2) {
        ctx.globalAlpha = u > .8 ? (1 - u) / .2 : 1; ctx.fillStyle = o.col;
        const c = Math.cos(o.rot), s = Math.sin(o.rot), w = o.size, h = o.size * .55 * Math.abs(Math.sin(o.ph));
        ctx.save(); ctx.translate(o.x, o.y); ctx.transform(c, s, -s, c, 0, 0); ctx.fillRect(-w / 2, -h / 2, w, h + .6); ctx.restore();
      } else if (o.k === 3) {
        ctx.globalAlpha = 1; const s = o.size * (o.t < .15 ? o.t / .15 : 1);
        ctx.drawImage(o.img, o.x - s / 2, o.y - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
    for (const tx of texts) {
      const a = tx.t < .1 ? tx.t / .1 : 1 - Math.max(0, tx.t - .6) / .4;
      ctx.globalAlpha = Math.max(0, a); ctx.font = '900 26px ui-rounded,system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.strokeStyle = '#6b3a22'; ctx.strokeText(tx.str, tx.x, tx.y); ctx.fillStyle = tx.col; ctx.fillText(tx.str, tx.x, tx.y);
    }
    ctx.restore();
  };
  F.clear = function () { while (P.length) pool.push(P.pop()); pops.length = 0; flights.length = 0; texts.length = 0; };
  F.count = () => P.length + flights.length;
  F.busy = () => P.length > 0 || flights.length > 0 || pops.length > 0;
  window.__fx = F;
  return F;
})();
