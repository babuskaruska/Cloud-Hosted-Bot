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
  _tm.compose(_tv.set(x + rr(-.4, .4), y + 7, z + rr(-.4, .4)), _tq.set(rr(-1, 1), rr(-1, 1), rr(-1, 1), 1).normalize(), _ts.setScalar(rr(1.6, 2.8)));
  addDebris(KIT.rubble, _tm, [.55, .5, .45], rr(-.5, .5), -13, rr(-.5, .5), rr(3, 8), 1.1);
  ev.rocks.push({ x, z, y, t: .5 });
}
function rockLands(r) {
  const B = G.B, dmg = 70 * (1 + .3 * G.level);
  fxDust(r.x, r.y + .1, r.z, 8, 1.1, { speed: 3 }); shake(.22); sfx('hammer', r.x, r.z, .8, rnd());
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
let _evLookOn = false;
function eventLook() {
  const ev = G.event, B = G.B; if (!B || !WX.u) return;
  if (!ev || ev.amt <= 0) { if (_evLookOn) { _evLookOn = false; const w = B.bio.wx; WX.u.uN.value.fromArray(w.n); WX.u.uVelA.value.fromArray(w.velA); WX.u.uVelB.value.fromArray(w.velB); } return; }
  _evLookOn = true;
  const E = ev.def, a = ev.amt, u = R.mats.atmo.uniforms, mi = u.uMist.value, ma = u.uMistAmb.value;
  mi.z *= 1 + E.mist * a; mi.y *= 1 + .6 * E.mist * a; mi.w = lerp(mi.w, Math.max(mi.w, .28), a * Math.min(1, E.mist));
  ma.set(lerp(ma.x, E.tint[0], a * .8), lerp(ma.y, E.tint[1], a * .8), lerp(ma.z, E.tint[2], a * .8));
  const w = B.bio.wx, k = 1 + (E.wx - 1) * a, n = WX.u.uN.value;
  n.set(Math.min(1, w.n[0] * k), Math.min(1 - Math.min(1, w.n[0] * k), w.n[1] * Math.max(1, k * .7)));
  WX.u.uVelA.value.set(w.velA[0] * k + 2.2 * (k - 1), w.velA[1] * Math.max(1, k * .6), w.velA[2] * k + 1.2 * (k - 1));
  WX.u.uVelB.value.set(w.velB[0] * k + 1.5 * (k - 1), w.velB[1], w.velB[2] * k);
}
window.__cwEvents = { startEvent, endEvent, EVENTS };
