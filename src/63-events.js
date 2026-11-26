// Land events: once per battlefield, mid-way through, the land itself joins the fight for a few seconds.
// G.event = null | { kind, t, dur, amt, ... }. Effects: G.rangeMul (tower reach), m.evMul (monster speed),
// plus thicker mist and weather through eventLook(), called from updateBiomeLook.
const EVENTS = {
  rockslide: { land: 'ashen', name: 'Rockslide', tip: 'Boulders crush the road, and the rubble slows the column.', dur: 15, range: 1, spd: 1, mist: .35, wx: .6, tint: [.12, .1, .09] },
  blizzard: { land: 'frost', name: 'Blizzard', tip: 'Everything slows, and your towers see less far.', dur: 17, range: .84, spd: .78, mist: 1.3, wx: 2.6, tint: [.2, .25, .34] },
  bogfog: { land: 'fen', name: 'Bog fog', tip: 'Thick fog shortens tower range. Wisps drift in with it.', dur: 17, range: .74, spd: 1, mist: 2.4, wx: 1.4, tint: [.07, .16, .1] },
  lavaSurge: { land: 'ember', name: 'Lava surge', tip: 'The lava bursts out, burning monsters and stunning towers near it.', dur: 14, range: 1, spd: 1, mist: .5, wx: 2, tint: [.22, .07, .03] },
  sandstorm: { land: 'dunes', name: 'Sandstorm', tip: 'Sand cuts tower range, speeds the column and carries scarabs.', dur: 16, range: .76, spd: 1.14, mist: 1.8, wx: 3.2, tint: [.24, .16, .08] },
};
G.event = null; G.rangeMul = 1; G.evLevel = -1; G.evWave = 0; G.evDone = false;
const _evp = { x: 0, y: 0, z: 0, tx: 0, tz: 0 };

function eventKindFor(B) { for (const k in EVENTS) if (EVENTS[k].land === B.bio.key) return k; return null; }

function startEvent(kind) {
  const E = EVENTS[kind], B = G.B; if (!E || !B) return null;
  const ev = G.event = { kind, t: 0, dur: E.dur, amt: 0, def: E, rocks: [], next: 0, n: 0 };
  if (kind === 'rockslide') { ev.s0 = B.L * rr(.32, .66); ev.span = 2.2; }
  if (kind === 'lavaSurge') ev.sx = B.cross && isFinite(B.cross.s) ? B.cross.s : B.L * .5;
  G.evDone = true;
  UI.banner(E.name + '!', 2.8, false);
  if (!G.seen['event:' + kind] && UI.tips) { G.seen['event:' + kind] = 1; UI.tips.unshift('event:' + kind); }
  sfx(kind, B.cave ? B.cave.x : 0, B.cave ? B.cave.z : 0, 1);
  return ev;
}
function endEvent() {
  if (!G.event) return;
  sfx('eventEnd', CAM.x, CAM.z, .7); G.event = null; G.rangeMul = 1;
  for (const m of G.mons) m.evMul = 1;
}

function rockAt(ev) {
  const B = G.B, s = clamp(ev.s0 + rr(-ev.span, ev.span), .5, B.L - .5), lat = rr(-1, 1), p = pathAt(B, s, _evp);
  const x = p.x - p.tz * lat, z = p.z + p.tx * lat, y = p.y;
  // The same nine draws from the game's random stream as before (the falling boulder is drawn by drawEventFX).
  const ox = rr(-.4, .4), oz = rr(-.4, .4), q = [rr(-1, 1), rr(-1, 1), rr(-1, 1)], sc = rr(1.6, 2.8); rr(-.5, .5); rr(-.5, .5); const spin = rr(3, 8);
  ev.rocks.push({ x, z, y, t: .5, ox, oz, q, sc, spin });
}
function rockLands(r) {
  const B = G.B, dmg = 70 * (1 + .3 * G.level);
  fxDust(r.x, r.y + .1, r.z, 8, 1.1, { speed: 3 }); shake(.22); sfx('hammer', r.x, r.z, .8, rnd()); rockLandFX(r);
  FX.decals.add(B.heightAt, r.x, r.z, .9, .02, .018, .016, .7, 30);
  for (const m of G.mons) { if (m.dead || m.hp <= 0 || m.fly) continue; const d = Math.hypot(m.x - r.x, m.z - r.z); if (d < 1.1 + m.rad) hitMonster(m, dmg * (1 - .4 * d / 1.6), 'blast', (m.x - r.x) / (d || 1), (m.z - r.z) / (d || 1), null); }
}
function eruption(ev) {
  const B = G.B, s = clamp(ev.sx + rr(-3.2, 3.2), .5, B.L - .5), lat = rr(-1.2, 1.2), p = pathAt(B, s, _evp);
  const x = p.x - p.tz * lat, z = p.z + p.tx * lat;
  fxExplosion(x, p.y + .2, z, .9); fxEmbers(x, p.y + .3, z, 30, .8); lightFlash(x, p.y + 1, z, 0xff6a20, 260, .45, 12); shake(.3);
  addGroundFire(x, z, 1.3, 5.5, 26 * (1 + .25 * G.level), null);
  for (const tw of G.towers) if (tw.alive && tw.state === 'active' && dist2(tw.x, tw.z, x, z) < 3.4 * 3.4) tw.stun = Math.max(tw.stun || 0, 1.6);
}

function updateEvents(dt) {
  const B = G.B;
  if (G.phase !== 'play') { if (G.event) endEvent(); return; }
  // Pick this battlefield's event wave once, when the battlefield starts.
  if (G.evLevel !== G.level) {
    G.evLevel = G.level; G.evDone = false;
    const wpl = G.wavesPerLand || 8; let w = 3 + Math.floor(rnd() * Math.max(1, wpl - 4));
    for (let i = 0; i < wpl && ((typeof isHordeK === 'function' && isHordeK(w, G.level)) || w >= wpl); i++) w = 3 + ((w - 2) % Math.max(1, wpl - 4));
    G.evWave = w;
  }
  if (!G.event && !G.evDone && G.spawning && G.k === G.evWave && !G.bossWave && G.waveT > 3) { const k = eventKindFor(B); if (k) startEvent(k); else G.evDone = true; }
  const ev = G.event;
  if (!ev) { G.rangeMul = 1; return; }
  ev.t += dt; const E = ev.def;
  ev.amt = sat(Math.min(ev.t / 2, (ev.dur - ev.t) / 2.5));
  G.rangeMul = lerp(1, E.range, ev.amt);
  const spd = lerp(1, E.spd, ev.amt);
  for (const m of G.mons) {
    let k = spd;
    if (ev.kind === 'rockslide' && !m.fly && ev.t > 1 && Math.abs(m.s - ev.s0) < ev.span + .6) k *= .55;
    m.evMul = k;
  }
  ev.next -= dt;
  if (ev.kind === 'rockslide' && ev.t < 3.2 && ev.next <= 0) { ev.next = .14; rockAt(ev); }
  if (ev.kind === 'lavaSurge' && ev.n < 6 && ev.next <= 0 && ev.t > .6) { ev.next = rr(1.2, 2.2); ev.n++; eruption(ev); }
  if (ev.kind === 'bogfog' && ev.n < 6 && ev.next <= 0 && ev.t > 1.5 && G.mons.length < MAX_ALIVE) { ev.next = rr(1.5, 2.5); ev.n++; spawnMonster('wisp', { hpMul: 1 + .3 * G.level }); }
  if (ev.kind === 'sandstorm' && ev.n < 14 && ev.next <= 0 && ev.t > 1.5 && G.mons.length < MAX_ALIVE) { ev.next = rr(.5, .9); ev.n++; spawnMonster('scarab', { hpMul: 1 + .3 * G.level }); }
  for (let i = ev.rocks.length - 1; i >= 0; i--) { const r = ev.rocks[i]; r.t -= dt; if (r.t <= 0) { swapRemove(ev.rocks, i); rockLands(r); } }
  if (ev.kind === 'rockslide' && ev.t > 1 && ev.t < ev.dur - 2 && rnd() < dt * 3) { const p = pathAt(B, ev.s0 + rr(-ev.span, ev.span), _evp); fxDust(p.x, p.y + .1, p.z, 1, .6, { a: .3 }); }
  if (ev.t >= ev.dur) endEvent();
}

// Called after the land's look is applied each frame: thicker mist, tinted, and stronger weather while an event runs.
// Also darkens and tints the light per kind (LOOK_EV) and draws the event's own effects (drawEventFX). Visual only:
// everything here uses the effects' random stream (frnd/frr), never the game's.
let _evLookOn = false;
// Per kind: exposure, moon and hemisphere light multipliers, a saturation multiplier, a shadow tint added to the
// lift, light colour multipliers, and weather overrides (size, colour, alpha/streak), restored when the event ends.
const LOOK_EV = {
  rockslide: { expo: .9, moon: .8, hemi: .9, sat: .9, lift: [.012, .008, .004] },
  blizzard: { expo: 1.04, moon: .6, hemi: 1.15, sat: .72, lift: [.02, .03, .05], hemiCol: [.75, .85, 1.1], wx: { sizeB: [.03, .07], alB: [.75, 0, .9] }, wind: 5 },
  bogfog: { expo: .86, moon: .6, hemi: .95, sat: .85, lift: [.004, .016, .008], hemiCol: [.7, 1, .8] },
  lavaSurge: { expo: 1, moon: .75, hemi: .9, sat: 1.05, lift: [.05, .012, 0], hemiCol: [1.3, .7, .5], pulse: 1 },
  sandstorm: { expo: .74, moon: .4, hemi: .8, sat: .78, lift: [.05, .028, .006], hemiCol: [1.35, .95, .6], moonCol: [1.3, .85, .5], wx: { sizeA: [.04, .08], sizeB: [.035, .07], colA: [1, .78, .5, .55], colB: [.95, .72, .45, .55], alA: [.55, 0, .35], alB: [.65, 0, .7] }, wind: 8 },
};
const WX_KEYS = ['sizeA', 'sizeB', 'colA', 'colB', 'alA', 'alB'], wxU = k => WX.u['u' + k[0].toUpperCase() + k.slice(1)].value;
function eventLook() {
  const ev = G.event, B = G.B; if (!B || !WX.u) return;
  drawEventFX(ev, B);
  if (!ev || ev.amt <= 0) { if (_evLookOn) { _evLookOn = false; const w = B.bio.wx; WX.u.uN.value.fromArray(w.n); WX.u.uVelA.value.fromArray(w.velA); WX.u.uVelB.value.fromArray(w.velB); for (const k of WX_KEYS) wxU(k).fromArray(w[k]); } return; }
  _evLookOn = true;
  const E = ev.def, a = ev.amt, u = R.mats.atmo.uniforms, mi = u.uMist.value, ma = u.uMistAmb.value;
  mi.z *= 1 + E.mist * a; mi.y *= 1 + .6 * E.mist * a; mi.w = lerp(mi.w, Math.max(mi.w, .28), a * Math.min(1, E.mist));
  ma.set(lerp(ma.x, E.tint[0], a * .8), lerp(ma.y, E.tint[1], a * .8), lerp(ma.z, E.tint[2], a * .8));
  const w = B.bio.wx, k = 1 + (E.wx - 1) * a, n = WX.u.uN.value;
  n.set(Math.min(1, w.n[0] * k), Math.min(1 - Math.min(1, w.n[0] * k), w.n[1] * Math.max(1, k * .7)));
  WX.u.uVelA.value.set(w.velA[0] * k + 2.2 * (k - 1), w.velA[1] * Math.max(1, k * .6), w.velA[2] * k + 1.2 * (k - 1));
  WX.u.uVelB.value.set(w.velB[0] * k + 1.5 * (k - 1), w.velB[1], w.velB[2] * k);
  const L = LOOK_EV[ev.kind]; if (!L) return;
  if (L.wx) for (const key in L.wx) { const d = wxU(key), f = w[key], t = L.wx[key]; d.fromArray(f.map((v, i) => lerp(v, t[i], a))); }
  // A gale across the screen (along the camera's right), so the storm reads as wind rather than rain.
  if (L.wind) { const rx = Math.cos(CAM.yaw), rz = -Math.sin(CAM.yaw), va = WX.u.uVelA.value, vb = WX.u.uVelB.value, s = L.wind * a; va.set(lerp(va.x, rx * s * .7, a), va.y, lerp(va.z, rz * s * .7, a)); vb.set(lerp(vb.x, rx * s, a), lerp(vb.y, -.15, a), lerp(vb.z, rz * s, a)); }
  // Light: darker and tinted, with a slow red pulse for the lava. The lift tints the shadows (added in the comp pass).
  const pul = L.pulse ? .75 + .25 * Math.sin(G.t * 5.3) * Math.sin(G.t * 2.1 + 1) : 1, c = R.mats.comp.uniforms, lf = c.uLift.value;
  R.exposure *= lerp(1, L.expo, a); c.uGrade.value.y *= lerp(1, L.sat, a);
  lf.set(lf.x + L.lift[0] * a * pul, lf.y + L.lift[1] * a * pul, lf.z + L.lift[2] * a * pul);
  LT.moon.intensity *= lerp(1, L.moon, a); LT.hemi.intensity *= lerp(1, L.hemi, a);
  if (L.hemiCol) { const h = LT.hemi.color, hc = L.hemiCol; h.setRGB(h.r * lerp(1, hc[0], a), h.g * lerp(1, hc[1], a), h.b * lerp(1, hc[2], a)); }
  if (L.moonCol) { const m = LT.moon.color, mc = L.moonCol; m.setRGB(m.r * lerp(1, mc[0], a), m.g * lerp(1, mc[1], a), m.b * lerp(1, mc[2], a)); }
}

// ---- Event effects (drawing only) -------------------------------------------------------------------------
// Rockslide: boulders drop from high behind the road with a dust trail and a growing shadow, land with a burst of
// chips, dust and a crack, and stay on the road as rubble while the slow lasts, then sink away. Sandstorm, blizzard
// and bog fog: wide sheets of sand, snow or fog stream across the view, plus low grit streaks. Lava surge: ember rain.
const EVFX = { rubble: [], gusts: [], acc: 0, gacc: 0, level: -1 }, _evfx = { x: 0, z: 0 };
const _eq = new THREE.Quaternion(), _eq2 = new THREE.Quaternion(), _ev3 = new THREE.Vector3(), _es = new THREE.Vector3(), _em = new THREE.Matrix4(), _eax = new THREE.Vector3(0, 1, 0);
const RUBBLE_TINT = [[1.2, 1.08, .92], [1.02, .94, .84], [1.3, 1.18, 1]], ROCK_FALL = .5;
function rockLandFX(r) {
  const B = G.B, sc = (r.sc || 2) * 1.45, gy = Math.max(B.heightAt(r.x, r.z), r.y || 0);
  const piece = (x, z, s, q) => EVFX.rubble.push({ x, z, y: gy, q, sc: s, life: -1, tint: RUBBLE_TINT[Math.floor(frnd() * 3)], sink: 0, squash: frr(.65, .85) });
  piece(r.x, r.z, sc, new THREE.Quaternion(r.q ? r.q[0] : 0, r.q ? r.q[1] : 0, r.q ? r.q[2] : 0, 1).normalize());
  // Broken-off chunks scattered around the boulder, so the road reads as a rubble field.
  for (let i = 0; i < 3; i++) { const a = frnd() * TAU, d = frr(.45, .9); piece(r.x + Math.cos(a) * d, r.z + Math.sin(a) * d, sc * frr(.3, .5), new THREE.Quaternion(frr(-1, 1), frr(-1, 1), frr(-1, 1), 1).normalize()); }
  while (EVFX.rubble.length > 120) EVFX.rubble.shift();
  for (let i = 0; i < 5; i++) { const a = frnd() * TAU, s = frr(1.5, 3.5); _em.compose(_ev3.set(r.x + Math.cos(a) * .2, gy + .3, r.z + Math.sin(a) * .2), _eq.set(frr(-1, 1), frr(-1, 1), frr(-1, 1), 1).normalize(), _es.setScalar(frr(.4, .8))); addDebris(KIT.rubble, _em, [.55, .5, .45], Math.cos(a) * s, frr(2.5, 5), Math.sin(a) * s, frr(4, 10), frr(1.4, 2.4), { extra: 1 }); }
  fxTimed(4, r.x, gy + .08, r.z, 3.2, 3.2, .7, .6, .5, .6, .35, { ground: true });
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + frnd() * .5; fxSmoke(r.x + Math.cos(a) * .3, gy + .15, r.z + Math.sin(a) * .3, Math.cos(a) * frr(2, 3.6), frr(.3, .9), Math.sin(a) * frr(2, 3.6), frr(1.2, 2), frr(.5, .8), 1.6, .36, .32, .28, .55, { drag: 2.6 }); }
  FX.decals.add(B.heightAt, r.x + frr(-.2, .2), r.z + frr(-.2, .2), 1.3, .03, .026, .022, .65, 40);
}
function drawEventFX(ev, B) {
  const dt = FX.dt || 0, AL = FX.alpha;
  if (EVFX.level !== G.level || G.phase === 'crumble' || G.phase === 'rise') { EVFX.rubble.length = 0; EVFX.gusts.length = 0; EVFX.level = G.level; }
  const slide = !!ev && ev.kind === 'rockslide';
  // Falling boulders: a quadratic drop from high behind the road (away from the camera) onto the impact point.
  if (slide) for (const r of ev.rocks) {
    if (r.sc === undefined) continue;
    const u = sat(1 - r.t / ROCK_FALL), gy = B.heightAt(r.x, r.z), sc = r.sc * 1.45, rad = .14 * sc;
    const bx = -Math.sin(CAM.yaw) * 5.5 + r.ox * 6, bz = -Math.cos(CAM.yaw) * 5.5 + r.oz * 6, h = 11 * (1 - u * u);
    const x = r.x + bx * (1 - u), z = r.z + bz * (1 - u), y = gy + rad * .8 + h;
    _eq.set(r.q[0], r.q[1], r.q[2], 1).normalize().multiply(_eq2.setFromAxisAngle(_eax, r.spin * (1 - u)));
    _em.compose(_ev3.set(x, y, z), _eq, _es.setScalar(sc)); KIT.rubble.put(_em, 0, RUBBLE_TINT[0]);
    const sh = (.35 + .9 * u * u) * sc * .55; AL.push(r.x, gy + .05, r.z, sh, sh, 0, 0, .03, .025, .02, .55 * u, 0, r.spin, 0, 1);
    if (frnd() < dt * 45) fxSmoke(x + frr(-.15, .15), y + frr(0, .3), z + frr(-.15, .15), frr(-.2, .2), frr(.2, .6), frr(-.2, .2), frr(.6, 1.1), .14 * sc, .9, .42, .38, .33, .5, { drag: 1.2 });
  }
  // Rubble stays while the event runs, then sinks into the road.
  const RB = EVFX.rubble;
  for (let i = RB.length - 1; i >= 0; i--) {
    const q = RB[i];
    if (!slide && q.life < 0) q.life = frr(1.2, 1.8);
    if (q.life >= 0) { q.life -= dt; q.sink += dt * .35; if (q.life <= 0) { swapRemove(RB, i); continue; } }
    const k = q.life >= 0 ? Math.min(1, q.life / .8) : 1;
    _em.compose(_ev3.set(q.x, q.y - q.sink + .03, q.z), q.q, _es.set(q.sc * k, q.sc * q.squash * k, q.sc * k)); KIT.rubble.put(_em, 0, q.tint);
  }
  const GU = EVFX.gusts;
  for (let i = GU.length - 1; i >= 0; i--) { const g = GU[i]; g.life -= dt; if (g.life <= 0) { swapRemove(GU, i); continue; } g.x += g.vx * dt; g.z += g.vz * dt; }
  if (!ev || ev.amt <= .02) return;
  const a = ev.amt, kind = ev.kind;
  // Sheets: wide alpha sprites blown across the view from upwind (the weather's direction), low over the ground.
  const vw = (R.viewW || 30) * .55, cx = CAM.x, cz = CAM.z, ca = Math.cos(CAM.yaw), sa = Math.sin(CAM.yaw);
  const spot = (o) => { const s1 = frr(-1, 1) * vw, s2 = frr(-.6, .6) * vw; o.x = cx + ca * s1 + sa * s2; o.z = cz - sa * s1 + ca * s2; return o; }, P = _evfx;
  const S = { sandstorm: [16, [.62, .44, .26], 7, 3.4, .32, 1.4, 2.2], blizzard: [9, [.78, .86, 1], 5, 3, .26, 1.2, 2.4], rockslide: [ev.t < 4 ? 3 : 0, [.36, .33, .3], 1.2, 3, .25, 1, 3] }[kind];
  if (S && S[0]) {
    const [rate, col, spd, size, alpha, yy, life] = S, wv = WX.u.uVelB.value, wl = Math.hypot(wv.x, wv.z) || 1, dx = wv.x / wl, dz = wv.z / wl;
    EVFX.acc += dt * rate * a;
    while (EVFX.acc >= 1) {
      EVFX.acc -= 1; spot(P);
      const px = P.x - dx * spd * life * .45, pz = P.z - dz * spd * life * .45, v = spd * frr(.8, 1.2), j = frr(.85, 1.1);
      fxSmoke(px, B.heightAt(px, pz) + yy * frr(.5, 1.3), pz, dx * v, frr(-.05, .15), dz * v, life * frr(.8, 1.2), size * frr(.7, 1.3), size * .8, col[0] * j, col[1] * j, col[2] * j, alpha, { drag: 0 });
    }
  }
  if (kind === 'sandstorm' || kind === 'blizzard') {
    // Gusts: long soft additive streaks racing across the screen low over the ground (they read in the dark),
    // plus fast grit or snow sparks.
    const sand = kind === 'sandstorm', wv = WX.u.uVelB.value, c = sand ? [.5, .3, .13] : [.42, .5, .62];
    EVFX.gacc = (EVFX.gacc || 0) + dt * (sand ? 26 : 16) * a;
    while (EVFX.gacc >= 1 && EVFX.gusts.length < 90) { EVFX.gacc -= 1; spot(P); const k = frr(.7, 1.4); EVFX.gusts.push({ x: P.x - wv.x * .5, z: P.z - wv.z * .5, y: B.heightAt(P.x, P.z) + frr(.15, 1.8), vx: wv.x * frr(1.1, 1.7), vz: wv.z * frr(1.1, 1.7), life: frr(.7, 1.3), max: 1, w: frr(2.2, 4.5) * k, h: frr(.18, .4) * k, al: frr(.5, 1) }); EVFX.gusts[EVFX.gusts.length - 1].max = EVFX.gusts[EVFX.gusts.length - 1].life; }
    const n = Math.floor(dt * (sand ? 50 : 30) * a + frnd());
    for (let i = 0; i < n; i++) { spot(P); fxPart(P.x, B.heightAt(P.x, P.z) + frr(.1, 1.6), P.z, wv.x * 1.6, frr(-.2, .2), wv.z * 1.6, frr(.3, .7), frr(.03, .05), sand ? 1.1 : 1.2, sand ? .8 : 1.3, sand ? .45 : 1.7, { streak: 1 }); }
    for (const g of EVFX.gusts) { const u = 1 - g.life / g.max, f = Math.sin(u * PI); FX.add.push(g.x, g.y, g.z, g.w, g.h, 0, 0, c[0], c[1], c[2], g.al * f * a * .75, 6, 0, 0, 0); }
  }
  if (kind === 'lavaSurge' && frnd() < dt * 22 * a) { spot(P); fxPart(P.x, B.heightAt(P.x, P.z) + frr(2, 6), P.z, frr(-.4, .4), frr(-1.2, -.4), frr(-.4, .4), frr(1.5, 3), frr(.04, .07), frr(1.8, 3), frr(.5, .9), .1, { drag: .3, wob: 1 }); }
}
window.__cwEvents = { startEvent, endEvent, EVENTS, EVFX };
