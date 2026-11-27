// Round 13 effects (Ash): gold bursts, world pop-ups (combo, crit), the gold mine's glints, the treasure carrier's
// sparkle trail, bigger impacts on High and Ultra, the chunky countdown digits and the pixel stars.
// Everything here draws from the effects random stream (frnd/frr), never the gameplay one, and scales with the
// graphics tier (GFX.tier): Low keeps a cheap version of each effect.
//
// API
//   FX.goldBurst(x, z, n, o)        coins fountain out and fly to the HUD gold counter, with sparkles and a flash.
//                                   Visual only: the gold itself is the caller's. o.y: height (default ground + .4).
//                                   Two calls at the same spot within 0.15 s merge (safe if both death and game call it).
//   FX.pop(x, y, z, text, color, o) a short pop-up in the world, drawn on the HUD canvas with the pixel font.
//                                   o.size (1 = HUD text size), o.life (s), o.rise (CSS px), o.crit (shake + burst).
//   FX.combo(x, y, z, n)            "x5!" in a colour and size that grow with the streak.
//   FX.crit(x, y, z, dmg)           a red-gold damage number with a spark burst.
//   FX.impact(x, y, z, sc, col)     shockwave, sparks and dust for a heavy hit (rich on High/Ultra, a ring on Low).
//   drawStars(ctx, x, y, n, size, o) 1-3 pixel stars (also UI.drawStars). See below.
//   drawCountBig(ctx, n, f, cx, cy, k, a) the countdown number (6..1) or "Alusta!" (n = 0); see drawCount (73-menu).
const JUICE = { pops: [], bursts: [], p2d: [], lastN: null, cache: new Map(), stars: {}, t: 0 };
const gfxRank = () => { const t = typeof GFX !== 'undefined' && GFX.tier; return t === 'low' ? 0 : t === 'mid' ? 1 : t === 'ultra' ? 3 : 2; };

// ---- gold burst ---------------------------------------------------------------------------------------------
const _jm = new THREE.Matrix4(), _jv = new THREE.Vector3(), _jq = new THREE.Quaternion(), _js = new THREE.Vector3(1, 1, 1);
FX.goldBurst = (x, z, n = 12, o = {}) => {
  if (!isFinite(x) || !isFinite(z)) return;
  const now = performance.now(), B = JUICE.bursts;
  for (let i = B.length - 1; i >= 0; i--) { const b = B[i]; if (now - b.t > 150) { B.splice(i, 1); continue; } if (dist2(b.x, b.z, x, z) < 2.25) return; }
  B.push({ x, z, t: now });
  const rk = gfxRank(), y = (o.y !== undefined ? o.y : FX.groundAt(x, z)) + .4;
  // Flash: a gold star burst, a ring on the ground, and a gold light on Mid and up.
  fxTimed(5, x, y + .2, z, 2.6, 2.6, 3.2, 2.4, .7, 1, .16);
  fxTimed(4, x, FX.groundAt(x, z) + .1, z, 3.4, 3.4, 2.2, 1.6, .45, .7, .5, { ground: true });
  if (rk >= 1) lightFlash(x, y + .8, z, 0xffcc55, 90 + rk * 40, .3, 10);
  if (rk >= 2) fxTimed(4, x, y + .3, z, 3, 3, 2.4, 1.8, .6, .45, .3);
  // Coins: real coin pieces in a fountain; each flies to the gold counter after its hang time (onCoin, 90-main).
  const nc = Math.min(Math.round(n), [5, 9, 14, 20][rk]);
  for (let i = 0; i < nc; i++) {
    const a = frnd() * TAU, s = frr(.6, 2.3);
    _jm.compose(_jv.set(x + frr(-.15, .15), y, z + frr(-.15, .15)), _jq.set(frr(-1, 1), frr(-1, 1), frr(-1, 1), 1).normalize(), _js);
    const d = addDebris(KIT.coin, _jm, null, Math.cos(a) * s, frr(5.5, 8.5), Math.sin(a) * s, frr(10, 18), 3, { coin: frr(.85, 1.3), bounce: .55 });
    if (d) d.value = 0;
  }
  // Sparkles: gold streaks out, then twinkling motes that drift up.
  fxSparks(x, y, z, [6, 10, 16, 22][rk], 6.5, 3.4, 2.5, .7, { size: .06, grav: 7, lo: .5, hi: 1.4 });
  for (let i = 0, m = [4, 8, 14, 20][rk]; i < m; i++) fxPart(x + frr(-.5, .5), y + frr(0, .8), z + frr(-.5, .5), frr(-.4, .4), frr(.5, 1.6), frr(-.4, .4), frr(.7, 1.5), frr(.05, .09), 3.4, 2.7, 1.1, { drag: .6, wob: 1, rise: .2 });
  if (rk >= 3) fxDust(x, y - .3, z, 4, .7, { c: [.42, .34, .2], a: .3 });
};

// ---- world pop-ups --------------------------------------------------------------------------------------------
FX.pop = (x, y, z, text, color = '#ffe2a0', o = {}) => {
  const P = JUICE.pops, cap = [8, 14, 22, 28][gfxRank()];
  if (P.length >= cap) P.shift();
  P.push({ x, y, z, text: String(text), color, size: o.size || 1, t: 0, T: o.life || .95, rise: o.rise === undefined ? 34 : o.rise, dx: frr(-6, 6), crit: !!o.crit, out: o.outline || '#1a0a04' });
};
const COMBO_COL = ['#ffe2a0', '#ffd060', '#ffa83c', '#ff7a2c', '#ff4a3a', '#ff5ad0'];
FX.combo = (x, y, z, n) => {
  n = n | 0; if (n < 2) return; const i = Math.min(COMBO_COL.length - 1, Math.floor((n - 2) / 3));
  FX.pop(x, y, z, 'x' + n + '!', COMBO_COL[i], { size: Math.min(2, 1 + n * .06), life: 1.05, crit: n >= 10 });
  if (gfxRank() >= 1) fxTimed(5, x, y, z, 1.4 + i * .3, 1.4 + i * .3, 3, 2, .6, .8, .12);
};
FX.crit = (x, y, z, dmg) => {
  FX.pop(x, y, z, '' + Math.round(dmg) + '!', '#ff6a3a', { size: 1.35, life: .8, crit: true });
  fxSparks(x, y, z, [4, 7, 10, 14][gfxRank()], 5, 3.4, 1.6, .5, { size: .06 });
};
// Draws the pop-ups on the HUD canvas (90-main calls it after UI.draw). Cheap: the pixel font caches each text.
function drawJuiceHud(ctx) {
  const P = JUICE.pops, dt = R.frameDt || .016;
  if (JUICE.p2d.length) drawP2d(ctx, dt);
  if (!P.length) return;
  const hide = UI.scr || (typeof STORY !== 'undefined' && STORY.on && STORY.on());
  const s = UI.s || 3, cam = R.cam;
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i]; p.t += G.paused ? 0 : dt; const u = p.t / p.T;
    if (u >= 1) { P.splice(i, 1); continue; }
    if (hide) continue;
    _jv.set(p.x, p.y, p.z).project(cam); if (_jv.z > 1 || _jv.z < -1) continue;
    const sx = (_jv.x * .5 + .5) * R.dw + p.dx * s * .3, sy = (1 - (_jv.y * .5 + .5)) * R.dh - easeOut(u * 1.4) * p.rise * s * .5;
    const pop = u < .12 ? 1 + .7 * Math.sin(u / .12 * Math.PI * .5) : 1 + .7 * Math.max(0, 1 - (u - .12) / .14);
    const ps = Math.max(2, Math.round(s * .8 * p.size * pop)), a = u > .7 ? 1 - (u - .7) / .3 : 1;
    PX.text(ctx, p.text, sx, sy - PX.LINE * ps * .5, ps, p.color, { align: 'c', outline: p.out, shadow: p.crit ? 'rgba(0,0,0,0.55)' : '', alpha: a });
  }
}

// ---- impacts ----------------------------------------------------------------------------------------------
// Added to fxExplosion (40-fx.js) and usable alone: rich on High/Ultra, a single ring on Low.
FX.impact = (x, y, z, sc = 1, col = [1.6, 1.0, .45]) => {
  const rk = gfxRank(), gy = FX.groundAt(x, z) + .08;
  if (rk === 0) { fxTimed(4, x, gy, z, 4 * sc, 4 * sc, col[0], col[1], col[2], .4, .3, { ground: true }); return; }
  // Shockwave: a fast ring on the ground and a thin one in the air.
  fxTimed(4, x, gy, z, 7.5 * sc, 7.5 * sc, col[0] * 1.3, col[1] * 1.3, col[2] * 1.3, .5, .32, { ground: true });
  if (rk >= 2) fxTimed(4, x, y + .5 * sc, z, 5.5 * sc, 5.5 * sc, col[0], col[1], col[2], .35, .2);
  // Hot debris: long-lived sparks that arc and bounce.
  for (let i = 0, n = Math.round([0, 5, 10, 16][rk] * sc); i < n; i++) {
    const a = frnd() * TAU, s = frr(2.5, 6.5) * sc;
    fxPart(x, y + .2, z, Math.cos(a) * s, frr(3.5, 7.5), Math.sin(a) * s, frr(.7, 1.4), frr(.05, .08), 3.3, 1.7, .5, { grav: 11, drag: .4, streak: 1, bounce: .45 });
  }
  // A skirt of dust rolling out along the ground.
  if (rk >= 2) for (let i = 0, n = Math.round(6 * sc); i < n; i++) { const a = i / n * TAU + frr(0, .5), s = frr(2.2, 3.4) * sc; fxSmoke(x + Math.cos(a) * .4, gy + .1, z + Math.sin(a) * .4, Math.cos(a) * s, frr(.1, .4), Math.sin(a) * s, frr(.8, 1.3), .55 * sc, 1.1 * sc, .3, .27, .24, .42, { drag: 2.6 }); }
  if (rk >= 3) { // ultra: rock chips and a lingering heat glow
    for (let i = 0; i < 3 * sc; i++) { _jm.compose(_jv.set(x + frr(-.3, .3), y + .25, z + frr(-.3, .3)), _jq.set(frr(-1, 1), frr(-1, 1), frr(-1, 1), 1).normalize(), _js.set(.45, .45, .45)); addDebris(KIT.rubble, _jm, [.42, .37, .33], frr(-3.5, 3.5), frr(3, 6.5), frr(-3.5, 3.5), frr(4, 10), frr(1.2, 2), { extra: 1 }); }
    _js.set(1, 1, 1);
    fxTimed(2, x, gy + .15, z, 2.6 * sc, 2.6 * sc, 1.2, .45, .12, .5, .9, { ground: true });
  }
};

// ---- gold mine glints (Tower.drawGlow calls this for a tower with mounts.ore) ------------------------------
function mineGlint(t, on, dt) {
  const ore = t.mounts.ore; if (!ore || !ore.length) return;
  const rk = gfxRank(); t._gl = (t._gl || 0) + dt * [1.2, 2, 3, 4][rk] * on * (1 + .5 * t.lvl);
  while (t._gl >= 1) {
    t._gl -= 1; const o = ore[Math.floor(frnd() * ore.length)], p = t.w(o, _jp);
    fxTimed(5, p.x, p.y, p.z, frr(.35, .6), frr(.35, .6), 3.2, 2.6, 1.1, 1, frr(.25, .45));
    if (rk >= 2 && frnd() < .4) fxPart(p.x, p.y, p.z, frr(-.2, .2), frr(.3, .8), frr(-.2, .2), frr(.6, 1.1), .045, 3, 2.4, .9, { drag: .8, wob: 1, rise: .1 });
  }
  // A warm gleam over the cart's heap.
  if (t.mounts.cart) { const p = t.w(t.mounts.cart, _jp); FX.add.push(p.x, p.y, p.z, 1.3, 1.3, 0, 0, 1.2, .85, .3, .16 * on * (.85 + .15 * Math.sin(G.t * 3 + t.idx)), 2, 0, 0, 0); }
}
const _jp = { x: 0, y: 0, z: 0 };
// The mine pays out: a little burst of coins from the cart (Mira may call this when TOWER.mine makes its gold).
FX.mineTick = (t, n = 6) => { if (!t || !t.mounts || !t.mounts.cart) return; const p = t.w(t.mounts.cart, _jp); FX.goldBurst(p.x, p.z, n, { y: p.y - .4 }); };

// ---- treasure carrier sparkle (called from its rig while drawn) -----------------------------------------------
function sackTrail(m, top) {
  const dt = FX.dt || 0, rk = gfxRank(); if (!dt) return;
  m._cfx = (m._cfx || 0) + dt * [4, 7, 11, 15][rk] * FX.keep;
  while (m._cfx >= 1) {
    m._cfx -= 1; const r = frnd();
    if (r < .45) fxTimed(5, top.x + frr(-.3, .3), top.y + frr(-.3, .2), top.z + frr(-.3, .3), frr(.25, .5), frr(.25, .5), 3.2, 2.5, .9, 1, frr(.15, .3));
    else if (r < .8) fxPart(top.x + frr(-.2, .2), top.y, top.z + frr(-.2, .2), frr(-.6, .6), frr(.8, 2), frr(-.6, .6), frr(.6, 1), .06, 3.4, 2.6, .8, { grav: 8, bounce: .5, drag: .3 });
    else fxPart(top.x, top.y - .3, top.z, frr(-.2, .2), frr(.1, .5), frr(-.2, .2), frr(.8, 1.4), frr(.04, .07), 3, 2.3, 1, { drag: .8, wob: 1, rise: .15 });
  }
  FX.add.push(top.x, top.y, top.z, 1.5, 1.5, 0, 0, .9, .65, .2, .2 * (.8 + .2 * Math.sin(G.t * 7 + m.lseed)), 2, 0, 0, 0);
}

// ---- pixel stars --------------------------------------------------------------------------------------------
// drawStars(ctx, x, y, n, size, o): `of` stars (default 3) left to right from (x, y), the first n filled.
// size = device pixels per star pixel (a star is 13 star pixels wide). o.of, o.gap (star pixels), o.t (seconds, for
// the shine sweep; default the game clock), o.pop (array of scales per star, e.g. for a results-screen pop),
// o.align ('c' centres the row on x). Returns the row's width in device pixels.
const STAR_N = 13;
function starCanvas(kind) {
  if (JUICE.stars[kind]) return JUICE.stars[kind];
  const N = STAR_N, c0 = (N - 1) / 2, inside = (px, py) => {
    // point-in-star: 5 points, outer radius 6.4, inner 2.7, one point up.
    let x = px - c0, y = py - c0 - .45, ang = Math.atan2(x, -y), r = Math.hypot(x, y), seg = TAU / 10, k = ((ang % (2 * seg)) + 2 * seg) % (2 * seg);
    const t = Math.abs(k - seg) / seg, rr = lerp(2.75, 6.6, t); return r <= rr;
  };
  const M = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) M.push(inside(x, y) ? 1 : 0);
  const at = (x, y) => x >= 0 && y >= 0 && x < N && y < N && M[y * N + x];
  const cv = document.createElement('canvas'); cv.width = N + 2; cv.height = N + 3; const c = cv.getContext('2d');
  const full = kind !== 'empty', shine = kind === 'shine';
  for (let y = -1; y <= N; y++) for (let x = -1; x <= N; x++) {
    if (at(x, y)) continue; let edge = false; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (at(x + dx, y + dy)) edge = true;
    if (edge) { c.fillStyle = full ? '#2a1406' : '#0b0d14'; c.fillRect(x + 1, y + 1, 1, 1); }
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (!at(x, y)) continue;
    const top = !at(x, y - 1), bot = !at(x, y + 1), d = (x - y) / N;
    let col;
    if (shine) col = (x + y) % 3 === 0 ? '#ffffff' : '#fff6d8';
    else if (full) col = top ? '#fff2b0' : bot ? '#b8681a' : y < N * .45 ? (d > .1 ? '#ffd45a' : '#ffe27a') : y < N * .7 ? '#f0b034' : '#d68a24';
    else col = top ? '#4a4e60' : bot ? '#1c1e28' : '#2c2f3c';
    c.fillStyle = col; c.fillRect(x + 1, y + 1, 1, 1);
  }
  if (full && !shine) { c.fillStyle = '#ffffff'; c.fillRect(c0 + 1 - 2, c0 + 1 - 2, 1, 1); c.fillRect(c0, c0 - 2, 1, 2); } // a glint
  // a drop shadow under the row
  c.globalCompositeOperation = 'destination-over'; c.fillStyle = 'rgba(0,0,0,0.45)';
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (at(x, y)) c.fillRect(x + 1, y + 3, 1, 1);
  return (JUICE.stars[kind] = cv);
}
function drawStars(ctx, x, y, n, size = 3, o = {}) {
  const of = o.of || 3, gap = o.gap === undefined ? 2 : o.gap, s = Math.max(1, Math.round(size)), w = (STAR_N + 2) * s, step = w + gap * s, tot = of * step - gap * s;
  if (o.align === 'c') x -= tot / 2;
  const t = o.t !== undefined ? o.t : (typeof G !== 'undefined' ? G.t : 0) || performance.now() / 1000, ga = ctx.globalAlpha;
  if (ctx.imageSmoothingEnabled) ctx.imageSmoothingEnabled = false;
  for (let i = 0; i < of; i++) {
    const full = i < n, k = o.pop && o.pop[i] !== undefined ? o.pop[i] : 1; if (k <= 0) continue;
    const cv = starCanvas(full ? 'full' : 'empty'), ww = cv.width * s * k, hh = cv.height * s * k, cx = x + i * step + w / 2, cy = y + w / 2;
    const dx = Math.round(cx - ww / 2), dy = Math.round(cy - (w / 2) * k);
    ctx.drawImage(cv, dx, dy, ww, hh);
    // The shine: a white star flashes over each filled star in turn, every few seconds.
    if (full) { const ph = ((t * .5 - i * .18) % 2.2 + 2.2) % 2.2, a = ph < .25 ? Math.sin(ph / .25 * Math.PI) : 0; if (a > .02) { ctx.globalAlpha = ga * a * .7; ctx.drawImage(starCanvas('shine'), dx, dy, ww, hh); ctx.globalAlpha = ga; } }
  }
  return tot;
}

// ---- the countdown ------------------------------------------------------------------------------------------
// drawCountBig(ctx, n, f, cx, cy, k, a): n = the number (0 = "Alusta!"), f = 0..1 into this second, (cx, cy) the
// top centre, k = Mira's pixel scale, a = alpha. Thick two-pixel strokes, a gold gradient with a bevel, a dark
// outline and drop shadow, a glow behind, a scale-pop and a ring of sparks each second, and a burst on "Alusta!".
function textMask(txt) {
  const key = 'm\u0001' + txt, hit = JUICE.cache.get(key); if (hit) return hit;
  const W = PX.measure(txt) + 8, H = PX.LINE + 10, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d'); PX.text(c, txt, 4, 6, 1, '#ffffff');
  const d = c.getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 127) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const w = Math.max(1, x1 - x0 + 2), h = Math.max(1, y1 - y0 + 1), M = new Uint8Array(w * h);
  // Bold digits: each lit pixel also lights the one to its right (two-pixel strokes). Words stay one pixel wide,
  // or their lower-case letters run together.
  const bold = /^[0-9]+$/.test(txt);
  for (let y = 0; y < h; y++) for (let x = 0; x < w - 1; x++) if (d[((y + y0) * W + x + x0) * 4 + 3] > 127) { M[y * w + x] = 1; if (bold) M[y * w + x + 1] = 1; }
  const m = { w, h, M }; JUICE.cache.set(key, m); return m;
}
const COUNT_RAMP = ['#fff7d4', '#ffe58a', '#ffd04a', '#ffb02e', '#ff8a22', '#f0661a', '#d24c12'];
function chunkyText(txt, cell, go) {
  const key = 'c\u0001' + txt + '\u0001' + cell + (go ? 'g' : ''), hit = JUICE.cache.get(key);
  if (hit) return hit;
  const { w, h, M } = textMask(txt), at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && M[y * w + x];
  const pad = 2, W = (w + pad * 2) * cell, H = (h + pad * 2 + 2) * cell, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d'), q = Math.max(1, Math.round(cell / 4));
  // Drop shadow (two cells down), then the outline (one cell around), then the face.
  c.fillStyle = 'rgba(20,6,0,0.6)';
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) { let o = at(x, y); for (let dy = -1; dy <= 1 && !o; dy++) for (let dx = -1; dx <= 1 && !o; dx++) o = at(x + dx, y + dy); if (o) c.fillRect((x + pad) * cell, (y + pad + 2) * cell, cell, cell); }
  c.fillStyle = go ? '#3a1200' : '#2a0c04';
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) { let o = 0; for (let dy = -1; dy <= 1 && !o; dy++) for (let dx = -1; dx <= 1 && !o; dx++) o = at(x + dx, y + dy); if (o) c.fillRect((x + pad) * cell, (y + pad) * cell, cell, cell); }
  for (let y = 0; y < h; y++) {
    const ramp = go ? COUNT_RAMP[Math.min(COUNT_RAMP.length - 1, Math.floor(y / h * 5))] : COUNT_RAMP[Math.min(COUNT_RAMP.length - 1, Math.floor(y / h * COUNT_RAMP.length))];
    for (let x = 0; x < w; x++) {
      if (!at(x, y)) continue; const X = (x + pad) * cell, Y = (y + pad) * cell;
      c.fillStyle = ramp; c.fillRect(X, Y, cell, cell);
      if (!at(x, y - 1)) { c.fillStyle = 'rgba(255,255,240,0.85)'; c.fillRect(X, Y, cell, q); }
      if (!at(x, y + 1)) { c.fillStyle = 'rgba(110,30,0,0.55)'; c.fillRect(X, Y + cell - q, cell, q); }
      if (!at(x - 1, y)) { c.fillStyle = 'rgba(255,240,200,0.35)'; c.fillRect(X, Y, q, cell); }
      if (!at(x + 1, y)) { c.fillStyle = 'rgba(90,20,0,0.35)'; c.fillRect(X + cell - q, Y, q, cell); }
    }
  }
  const e = { cv, w: W, h: H, pad: pad * cell };
  JUICE.cache.set(key, e); if (JUICE.cache.size > 40) JUICE.cache.delete(JUICE.cache.keys().next().value);
  return e;
}
function countSparks(cx, cy, r, n, go) {
  const P = JUICE.p2d, rk = gfxRank(); n = Math.round(n * [.5, .75, 1, 1.25][rk]);
  for (let i = 0; i < n; i++) { const a = frnd() * TAU, s = frr(.5, 1.2) * r * (go ? 3.2 : 2.2); P.push({ x: cx + Math.cos(a) * r * .3, y: cy + Math.sin(a) * r * .3, vx: Math.cos(a) * s, vy: Math.sin(a) * s - r * .6, t: 0, T: frr(.45, .9), sz: frr(.06, .12) * r * .25, c: go ? (frnd() < .5 ? '#fff2b0' : '#ffb84a') : '#ffd060' }); }
}
function drawCountBig(ctx, n, f, cx, cy, k, a) {
  const go = n === 0, txt = go ? 'Alusta!' : '' + n, dt = R.frameDt || .016, maxW = ctx.canvas.width * .94;
  if (JUICE.lastN !== n) { JUICE.lastN = n; JUICE.popT = 0; JUICE.ring = 0; JUICE.spark = true; }
  JUICE.popT = (JUICE.popT || 0) + dt; JUICE.ring = (JUICE.ring || 0) + dt;
  const base = Math.max(3, Math.round(k / (1 + .3 * Math.max(0, 1 - f * 5)))); // undo Mira's pop: ours is below
  let cell = base; const m = textMask(txt); while (cell > 2 && (m.w + 4) * cell > maxW) cell--;
  const e = chunkyText(txt, cell, go), u = JUICE.popT;
  // Scale-pop: in big, overshoot, settle; "Alusta!" punches in harder.
  const pop = go ? (u < .18 ? lerp(2.1, .9, easeOut(u / .18)) : 1 + .1 * Math.exp(-(u - .18) * 6) * Math.sin((u - .18) * 30)) : (u < .12 ? lerp(1.7, .92, easeOut(u / .12)) : 1 + .08 * Math.exp(-(u - .12) * 8) * Math.sin((u - .12) * 26));
  const W = e.w * pop, H = e.h * pop, mid = cy + (m.h * cell) / 2;
  if (JUICE.spark) JUICE.spark = false, countSparks(cx, mid, m.h * cell * .9, go ? 34 : 14, go);
  ctx.save(); ctx.globalAlpha = a;
  // Glow behind: an additive radial gradient (no shadowBlur, which is slow on phones).
  const gr = Math.max(W, H) * (go ? .75 : .9) * (1 + .15 * Math.sin(JUICE.ring * 9)), g = ctx.createRadialGradient(cx, mid, 0, cx, mid, gr);
  g.addColorStop(0, go ? 'rgba(255,220,140,0.6)' : 'rgba(255,170,70,0.6)'); g.addColorStop(.45, go ? 'rgba(255,150,40,0.24)' : 'rgba(255,120,30,0.24)'); g.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(cx - gr, mid - gr, gr * 2, gr * 2);
  // Rays on "Alusta!", and a ring that runs out from each new number.
  if (go) {
    const rot = JUICE.ring * .9, ra = sat(1 - JUICE.ring / 1.1) * .32, R0 = gr * (.8 + .4 * easeOut(JUICE.ring * 2));
    if (ra > .01) { ctx.fillStyle = 'rgba(255,214,120,' + ra.toFixed(3) + ')'; ctx.beginPath(); for (let i = 0; i < 12; i++) { const a0 = rot + i / 12 * TAU, a1 = a0 + .07; ctx.moveTo(cx, mid); ctx.lineTo(cx + Math.cos(a0) * R0, mid + Math.sin(a0) * R0); ctx.lineTo(cx + Math.cos(a1) * R0, mid + Math.sin(a1) * R0); } ctx.fill(); }
  }
  const rr = JUICE.ring / (go ? .7 : .5);
  if (rr < 1) { ctx.strokeStyle = go ? 'rgba(255,236,170,' + (1 - rr).toFixed(3) + ')' : 'rgba(255,190,90,' + (.8 * (1 - rr)).toFixed(3) + ')'; ctx.lineWidth = Math.max(2, cell * (1 - rr) * 1.5); ctx.beginPath(); ctx.arc(cx, mid, (m.h * cell * .6) * (1 + rr * (go ? 3.5 : 1.6)), 0, TAU); ctx.stroke(); }
  ctx.globalCompositeOperation = 'source-over';
  if (ctx.imageSmoothingEnabled) ctx.imageSmoothingEnabled = false;
  ctx.drawImage(e.cv, Math.round(cx - W / 2), Math.round(mid - (e.h / 2 - cell) * pop), Math.round(W), Math.round(H));
  // A white flash on the face as each number lands.
  if (u < .1) { ctx.globalAlpha = a * (1 - u / .1) * .6; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(e.cv, Math.round(cx - W / 2), Math.round(mid - (e.h / 2 - cell) * pop), Math.round(W), Math.round(H)); ctx.globalCompositeOperation = 'source-over'; }
  ctx.restore();
}
function drawP2d(ctx, dt) {
  const P = JUICE.p2d; if (!P.length) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i]; p.t += dt; if (p.t >= p.T) { P.splice(i, 1); continue; }
    p.vx *= Math.exp(-2.5 * dt); p.vy = p.vy * Math.exp(-2.5 * dt) + 900 * dt * (p.sz / 12); p.x += p.vx * dt; p.y += p.vy * dt;
    const s = Math.max(2, Math.round(p.sz * (1 - p.t / p.T * .5))); ctx.globalAlpha = 1 - p.t / p.T; ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
  }
  ctx.restore();
}
