
const CAM = { yaw: PI / 4, elev: 38 * PI / 180, dist: 90, x: 0, y: 0, z: 0, zoom: 1, fx: 0, fz: 0, sx: 0, sz: 0, man: false, mx: 0, mz: 0, mzoom: 1, base: 27, aspect: 1.6, za: null, ent: null };
const _cr = new THREE.Vector3(), _cu = new THREE.Vector3(), _cd = new THREE.Vector3(), _ct = new THREE.Vector3();
function applyCamera() {
  const cam = R.cam, e = CAM.elev, sy = Math.sin(CAM.yaw), cy = Math.cos(CAM.yaw);
  _cd.set(Math.cos(e) * sy, Math.sin(e), Math.cos(e) * cy); _cr.set(cy, 0, -sy); _cu.set(-Math.sin(e) * sy, Math.cos(e), -Math.sin(e) * cy);
  const aspect = R.dw / R.dh, base = Math.max(R.viewH, lerp(R.fitTall, R.fitW, smooth(.62, 1.15, aspect)) / aspect), vh = base / CAM.zoom;
  CAM.base = base; CAM.aspect = aspect;
  R.px = vh / R.ih; R.viewW = vh * aspect; R.dofScale = base / R.viewH / CAM.zoom;
  _ct.set(CAM.x, CAM.y, CAM.z).addScaledVector(_cr, FX.shakeX).addScaledVector(_cu, FX.shakeY - R.shiftY + (R.hudTop || 0) / R.dh * vh * .5);
  const u = _ct.dot(_cr), v = _ct.dot(_cu), us = Math.round(u / R.px) * R.px, vs = Math.round(v / R.px) * R.px;
  R.sub.set((u - us) / R.px, (v - vs) / R.px);
  R.ditherOfs.set(((Math.round(us / R.px) % 8) + 8) % 8, ((Math.round(vs / R.px) % 8) + 8) % 8);
  _ct.addScaledVector(_cr, us - u).addScaledVector(_cu, vs - v);
  R.cu0 = us; R.cv0 = vs; R.hw = vh * aspect / 2; R.hh = vh / 2;
  cam.left = -vh * aspect / 2; cam.right = vh * aspect / 2; cam.top = vh / 2; cam.bottom = -vh / 2; cam.near = 1; cam.far = 210;
  cam.position.copy(_ct).addScaledVector(_cd, CAM.dist); cam.up.set(0, 1, 0); cam.lookAt(_ct);
  cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  R.focusZ = CAM.dist;
  R.dofD = (BH - _ct.x) * _cd.x - _ct.y * _cd.y + (BH - _ct.z) * _cd.z;
}
function updateCamera(dt) {
  const B = G.B; let wx = 0, wz = 0, ws = 7, boss = false;
  if (G.phase === 'play' || G.phase === 'defeat') {
    for (const m of G.mons) {
      if (m.dead || (!m.vis && !m.fly)) continue;
      let w = 1 + 2.5 * m.prog; if (m.foe) w *= 2.4; if (m.flash > 0) w *= 1.5; if (m.def.boss) { w *= 16; boss = true; }
      wx += m.x * w; wz += m.z * w; ws += w;
    }
    for (const t of G.towers) if (t.recent > 5) { const w = Math.min(4, t.recent / 20); wx += t.x * w; wz += t.z * w; ws += w; }
  }
  let tx = wx / ws, tz = wz / ws; const l = Math.hypot(tx, tz), lim = lerp(10.5, 6.5, smooth(.62, 1.15, CAM.aspect)); if (l > lim) { tx *= lim / l; tz *= lim / l; }
  const away = G.phase === 'clear' || G.phase === 'crumble' || G.phase === 'rise';
  if (away) { tx = 0; tz = 0; }
  // Boss entrance (CAM.ent, set by bossEntrance): for about 1.6 s the follow camera pushes in on the boss, then
  // eases back. Skipped, and dropped at once, whenever the player has the view.
  const en = CAM.ent; let ek = 0;
  if (en) { en.t += dt; if (en.t >= en.dur || CAM.man || away || G.phase !== 'play') CAM.ent = null; else { ek = Math.min(1, en.t / .35, (en.dur - en.t) / .6); ek = ek * ek * (3 - 2 * ek); const bm = en.m, bl = Math.hypot(bm.x, bm.z), bk = bl > 14 ? 14 / bl : 1; tx = lerp(tx, bm.x * bk, ek); tz = lerp(tz, bm.z * bk, ek); } }
  const fr = 1 + 2.6 * ek;
  CAM.fx = damp(CAM.fx, tx, .9 * fr, dt); CAM.fz = damp(CAM.fz, tz, .9 * fr, dt);
  CAM.sx = damp(CAM.sx, CAM.fx, .8 * fr, dt); CAM.sz = damp(CAM.sz, CAM.fz, .8 * fr, dt);
  if (away) { CAM.man = false; CAM.za = null; }
  if (CAM.za) { const a = CAM.za, z0 = CAM.man ? CAM.mzoom : CAM.zoom, r = a.to / z0; camZoomAt(Math.pow(r, 1 - Math.exp(-dt * (a.rate || 9))), a.px, a.py); if (Math.abs(Math.log(a.to / CAM.mzoom)) < .012 || Math.abs(CAM.mzoom - z0) < 1e-5) CAM.za = null; }
  if (CAM.man) { CAM.x = CAM.sx = CAM.mx; CAM.z = CAM.sz = CAM.mz; CAM.zoom = CAM.mzoom; }
  else {
    CAM.x = CAM.sx; CAM.z = CAM.sz;
    const zt = lerp(away ? .62 : (G.phase === 'defeat' ? .92 : (boss ? 1.14 : 1)), 1.42, ek);
    CAM.zoom = damp(CAM.zoom, zt, (zt < CAM.zoom ? 1.1 : .7) * fr, dt);
  }
  CAM.y = damp(CAM.y, away ? -2.2 : .4, 1, dt);
  const lk = window.__cw && window.__cw.lock; if (lk) { CAM.x = lk[0]; CAM.z = lk[1]; CAM.zoom = lk[2] || 1; }
}

function camGrab() { if (!CAM.man) { CAM.man = true; CAM.mx = CAM.x; CAM.mz = CAM.z; CAM.mzoom = CAM.zoom; } }
function camZoomMin() { return Math.min(1, CAM.base * CAM.aspect / 56, CAM.base / 46); }
function camPan(dx, dy) {
  if (G.phase === 'crumble' || G.phase === 'rise' || G.phase === 'clear') return;
  camGrab(); const upp = CAM.base * CAM.aspect / CAM.mzoom / R.dw, se = Math.sin(CAM.elev), sy = Math.sin(CAM.yaw), cy = Math.cos(CAM.yaw), du = dx * upp, dv = -dy * upp;
  CAM.mx = clamp(CAM.mx - cy * du + sy * dv / se, -17, 17); CAM.mz = clamp(CAM.mz + sy * du + cy * dv / se, -17, 17);
}
function camZoomAt(f, px, py) {
  if (G.phase === 'crumble' || G.phase === 'rise' || G.phase === 'clear') return;
  camGrab(); const z0 = CAM.mzoom, z1 = clamp(z0 * f, camZoomMin(), 3), k = 1 - z0 / z1, upp = CAM.base * CAM.aspect / z0 / R.dw;
  const a = (px - R.dw / 2) * upp * k, b = -(py - R.dh / 2) * upp * k / Math.sin(CAM.elev), sy = Math.sin(CAM.yaw), cy = Math.cos(CAM.yaw);
  CAM.mx = clamp(CAM.mx + cy * a - sy * b, -17, 17); CAM.mz = clamp(CAM.mz - sy * a - cy * b, -17, 17); CAM.mzoom = z1;
}
function camReset() { CAM.man = false; CAM.za = null; }
function camZoomTo(z, px, py, rate) { CAM.za = { to: clamp(z, camZoomMin(), 3), px: px === undefined ? R.dw / 2 : px, py: py === undefined ? R.dh / 2 : py, rate }; }
function camZoomNow() { return CAM.za ? CAM.za.to : CAM.man ? CAM.mzoom : CAM.zoom; }
function camZoomBy(f) { camZoomTo(camZoomNow() * f); }

function sfx(name, x, z, gain = 1, p = 0) {
  if (!AU.ready) return;
  const dx = x - CAM.x, dz = z - CAM.z, u = dx * Math.cos(CAM.yaw) - dz * Math.sin(CAM.yaw);
  AU.play(name, clamp(u / ((R.viewW || 40) * .5), -1, 1) * .75, gain * clamp(1.12 - Math.hypot(dx, dz) / 46, .4, 1) * (.72 + .28 * CAM.zoom), p);
}

// Draw plan for the monsters, made each step before they are drawn. Visual only: it never changes the simulation.
// - Off screen (with a margin for shadows and tall models) or an earlier step of a 2x/3x frame: not drawn (_lod 2).
// - Shadow tiers (see PartBatch): a monster only draws into the shadow maps of the tower spotlights whose pool of
//   light it stands in (_smask), and one outside all of them skips the spotlight maps. In a
//   crowd, tiny monsters cast no shadow and in a packed spot only the first two per 1.25-unit cell do; the rest
//   stand in their neighbours' shadow anyway. Big monsters and bosses always cast.
const DRAW_CROWD = 48, _cellN = new Map(), _spotP = [];
function planDraw() {
  const mons = G.mons, skip = R.skipDraw, cam = R.opt && R.hw > 0, u0 = R.cu0, v0 = R.cv0, hw = R.hw + 3, hh = R.hh + 3.5;
  const crx = Math.cos(CAM.yaw), crz = -Math.sin(CAM.yaw), se = Math.sin(CAM.elev), cux = -se * Math.sin(CAM.yaw), cuy = Math.cos(CAM.elev), cuz = -se * Math.cos(CAM.yaw);
  let on = 0;
  for (const m of mons) {
    let off = skip;
    if (!off && cam) { const u = m.x * crx + m.z * crz - u0, v = m.x * cux + m.y * cuy + m.z * cuz - v0; off = u > hw || u < -hw || v > hh || v < -hh; }
    m._lod = off ? 2 : 0; m._tier = 0; m._smask = 255;
    if (!off && (m.vis || m.fly)) on++;
  }
  if (skip) return; // a hidden step keeps the last plan's crowd state
  DRAW.onScreen = on; DRAW.crowd = R.opt && on > DRAW_CROWD;
  FX.keep = R.opt ? (R.lite ? .65 : R.quality < .75 ? .85 : 1) * (1 - .35 * sat((on - 70) / 110)) : 1;
  if (!R.opt) return;
  // A spotlight lights a disc of ground under its tower: radius = height above the ground x tan(cone angle).
  _spotP.length = 0; LT.spots.forEach((s, j) => { const l = s.l, p = l.position; if (l.intensity > 0) { const r = clamp((p.y - G.B.heightAt(p.x, p.z)) * Math.tan(l.angle) + 1.2, 2, 16); _spotP.push(p, j, r * r); } });
  const crowd = DRAW.crowd; if (crowd) _cellN.clear();
  for (const m of mons) {
    if (m._lod) continue;
    if (crowd && !m.def.boss && m.rad < .55) {
      if (m.rad < .22) { m._tier = 2; continue; }
      const k = (Math.floor(m.x * .8) + 512) * 1024 + Math.floor(m.z * .8) + 512, c = _cellN.get(k) || 0; _cellN.set(k, c + 1);
      if (c >= 2) { m._tier = 2; continue; }
    }
    let mask = 0; for (let i = 0; i < _spotP.length; i += 3) { const p = _spotP[i]; if (dist2(m.x, m.z, p.x, p.z) < _spotP[i + 2]) mask |= 1 << _spotP[i + 1]; }
    m._smask = mask; m._tier = mask ? 0 : 1;
  }
}

const _mm = new THREE.Matrix4(), _mq = new THREE.Quaternion(), _mv = new THREE.Vector3(), _ms = new THREE.Vector3(1, 1, 1), _torch = [];
function step(rdt) {
  G.slowmo = Math.max(0, G.slowmo - rdt);
  let dt = rdt * (G.slowmo > 0 ? lerp(1, .32, sat(G.slowmo / .35)) : 1);
  if (G.hitstop > 0) { G.hitstop = Math.max(0, G.hitstop - rdt); dt *= .03; }
  updateShake(rdt);
  G.t += dt; SH.uTime.value = G.t;
  const B = G.B;
  beginParts(); G.hbars.length = 0;
  updateFX(dt, G.t);
  const live = G.phase === 'play' || G.phase === 'defeat' || G.phase === 'clear';
  if (live) {
    updateWaves(dt); aiThink(dt);
    for (const t of G.towers) if (t.alive) t.update(dt);
    updateUnits(dt);
    for (let i = G.mons.length - 1; i >= 0; i--) if (G.mons[i].dead) swapRemove(G.mons, i);
    updateProjectiles(dt); updateHazards(dt);
    const td = performance.now(); planDraw();
    for (const m of G.mons) drawMonster(m, G.t);
    for (const f of G.men) if (!f.dead) drawFootman(f);
    R.tDraw += performance.now() - td;
    if (G.phase === 'play') {
      const k0 = (G.gold >= 70 ? 1 : .5) * (UI.manual ? 1.25 : 1);
      for (let i = 0; i < B.pads.length; i++) {
        const p = B.pads[i]; if (p.tower) continue;
        _mm.compose(_mv.set(p.x, p.y, p.z), _mq.setFromAxisAngle(_upv, p.face + Math.sin(G.t * 1.3 + i * 2.1) * .3), _ms); KIT.marker.put(_mm, 0, null);
        const w = .5 + .5 * Math.sin(G.t * 2.1 + i * 1.7), sz = 3.7 + .25 * w, a = (.3 + .25 * w) * k0;
        FX.add.push(p.x, p.y + .07, p.z, sz, sz, 0, 0, 2.6, 1.6, .55, a, 4, 0, .52, 1);
      }
    }
  }
  const spray = B.bio.spray;
  if (live && B.fallAt && spray === 'lava') {
    const f = B.fallAt, ax = Math.abs(f.oz), az = Math.abs(f.ox);
    if (rnd() < dt * 9) { const tau = rr(.1, 1.1), o = f.ext + f.v0 * tau, sd = rr(-.8, .8) * f.w; fxPart(f.x + f.ox * o + ax * sd, f.y - 4.5 * tau * tau, f.z + f.oz * o + az * sd, f.ox * rr(.2, 1.2) + rr(-.4, .4), rr(.2, 1.6), f.oz * rr(.2, 1.2) + rr(-.4, .4), rr(.6, 1.3), rr(.045, .075), rr(1.8, 3), rr(.6, 1.1), .12, { grav: 2.5, drag: .4, wob: 1 }); }
    if (rnd() < dt * 5) { const tau = rr(.5, 1.2), o = f.ext + f.v0 * tau, sd = rr(-.7, .7) * f.w; fxSmoke(f.x + f.ox * o + ax * sd, f.y - 4.5 * tau * tau, f.z + f.oz * o + az * sd, f.ox * rr(.1, .4), rr(.5, 1.3), f.oz * rr(.1, .4), rr(1.6, 2.8), rr(.4, .7), 1.1, .16, .12, .11, .3, { drag: .5, rise: .2 }); }
  }
  if (live && B.fallAt && spray === 'water') {
    const f = B.fallAt, ax = Math.abs(f.oz), az = Math.abs(f.ox);
    if (rnd() < dt * 16) { const tau = rr(.7, 1.25), o = f.ext + f.v0 * tau, d = 4.5 * tau * tau, sd = rr(-.8, .8) * f.w; fxSmoke(f.x + f.ox * o + ax * sd, f.y - d, f.z + f.oz * o + az * sd, f.ox * rr(.1, .5), rr(-1.6, -.6), f.oz * rr(.1, .5), rr(.9, 1.7), rr(.3, .5), .8, .9, 1.15, 1.5, .14, { drag: .5 }); }
    if (rnd() < dt * 16) { const tau = rr(.05, .5), o = f.ext + f.v0 * tau, sd = rr(-.9, .9) * f.w; fxPart(f.x + f.ox * o + ax * sd, f.y - 4.5 * tau * tau, f.z + f.oz * o + az * sd, f.ox * rr(.8, 1.6) + rr(-.3, .3), rr(-1, .6) - 9 * tau, f.oz * rr(.8, 1.6) + rr(-.3, .3), rr(.5, .9), rr(.04, .065), .3, .42, .62, { grav: 9, drag: .2 }); }
  }
  updateDebris(dt, FX.groundAt, d => { UI.coinFrom(d.p.x, d.p.y, d.p.z, d.value || 0); fxTimed(5, d.p.x, d.p.y, d.p.z, .5, .5, 2.4, 1.8, .6, .8, .12); });
  updatePhase(dt);
  updateCamera(dt);
  updateLights(dt, G.t, CAM.x, CAM.z);
  _torch.length = 0;
  for (const m of G.mons) if ((m.torch || m.glowL) && !m.dead && m.vis) _torch.push(m);
  for (const f of G.men) if (f.torch && !f.dead) _torch.push(f);
  for (const a of G.arrows) _torch.push(a);
  for (const f of FX.fires) if (f.lI > 1) _torch.push(f);
  for (const o of FX.lit) if (o.lI > 1) _torch.push(o);
  updateTorchLights(dt, _torch, CAM.x, CAM.z);
  collectMistLights();
  endParts(); endFX();
  UI.update(rdt);
  if (AU.ready) { let lit = 0; for (const t of G.towers) if (t.alive && t.em.on > .5 && t.kind !== 'spire') lit++; AU.setAmbience(sat((.3 + lit * .06) * LT.beaconOn + .05), sat((G.phase === 'play' ? .5 : .85) * B.bio.wind), G.bossAlive && G.phase === 'play' ? 1 : 0); AU.update(rdt); }
}

let _last = 0, _acc = 0, _frames = 0, _slow = 0, _fast = 0, _hold = 0, _back = 12, _check = null, _noGain = 0, _noBack = 30;
// Automatic resolution scaling (graphics Auto; HASH.noscale turns it off). Every 2 s: two slow windows (> 22.5 ms a
// frame) drop the internal resolution a step (down to .55, then "lite": a smaller moon shadow map and no depth of
// field); three fast ones (< 18.6 ms) raise it again after a hold that doubles each time it drops. Each drop is
// checked over the next window: if the frame time did not improve by 8 % the drop bought nothing (the frame rate is
// capped, as in iPhone Low Power Mode, or the work is on the CPU), so it is undone and drops pause for a while.
function setLite(on) {
  if (!!R.lite === on) return; R.lite = on ? 1 : 0;
  const s = on ? 1024 : LT.moonMap; LT.moon.shadow.mapSize.set(s, s); if (LT.moon.shadow.map) { LT.moon.shadow.map.dispose(); LT.moon.shadow.map = null; }
}
function autoScale(ms) {
  if (ms > 22.5) { _slow++; _fast = 0; } else { _slow = 0; _fast = ms < 18.6 ? _fast + 1 : 0; }
  _hold -= 2; _noGain -= 2;
  if (_check) {
    const c = _check; _check = null;
    if (ms > c.ms * .92) { if (c.lite) setLite(false); else { R.quality = c.q; resizeRenderer(); } _noGain = _noBack; _noBack = Math.min(600, _noBack * 2); _slow = 0; return; }
  }
  if (_slow >= 3 && R.quality <= .55 && !R.lite && _noGain <= 0) { setLite(true); _slow = 0; _check = { ms, lite: true }; }
  else if (_slow >= 2 && R.quality > .55 && _noGain <= 0) { _check = { ms, q: R.quality }; R.quality = Math.max(.55, R.quality - .15); resizeRenderer(); _slow = 0; _hold = _back; _back = Math.min(480, _back * 2); }
  else if (_fast >= 3 && _hold <= 0) {
    if (R.lite) { setLite(false); _fast = 0; }
    else if (R.quality < 1) { R.quality = Math.min(1, R.quality + .15); resizeRenderer(); _fast = 0; }
  }
}
function frame(now) {
  requestAnimationFrame(frame);
  if (now - _last < 10.5) return;
  const raw = (now - _last) / 1000, rdt = Math.min(.05, Math.max(.001, raw)); _last = now; R.frameDt = rdt;
  if (G.paused) { FX.shake = 0; updateShake(rdt); updateCamera(rdt); UI.update(rdt); AU.update(rdt); } else { for (let i = 0; i < G.speed; i++) { R.skipDraw = i < G.speed - 1; step(rdt); } R.skipDraw = false; }
  R.fade = Math.min(1, R.fade + rdt * 1.6);
  applyCamera(); renderFrame(); UI.draw();
  if (document.hidden || raw > .25) { _acc = 0; _frames = 0; return; }
  _acc += raw; _frames++;
  if (_acc >= 2) {
    const ms = _acc / _frames * 1000;
    R.fpsText = (1000 / ms).toFixed(0) + ' fps  ' + R.iw + 'x' + R.ih + '  calls ' + R.renderer.info.render.calls + '  mons ' + G.mons.length;
    if (!HASH.noscale) autoScale(ms); else if (R.lite) setLite(false);
    _acc = 0; _frames = 0;
  }
}

function boot() {
  if (window.matchMedia && matchMedia('(pointer: coarse)').matches && !HASH.noscale) R.quality = .85;
  if (window.matchMedia) { const rm = matchMedia('(prefers-reduced-motion: reduce)'), upd = () => { FX.shakeK = rm.matches ? 0 : 1; FX.flashK = rm.matches ? .3 : 1; }; upd(); if (rm.addEventListener) rm.addEventListener('change', upd); }
  initRenderer(); initMaterials(); resizeRenderer(); initLights(); initFX(); initWeather(); initKits(); UI.init();
  KIT.marker = new PartBatch(S => {
    const gold = mulC(COL.gold, .85), amber = C(0xc9682a);
    S.box(.08, 1.15, .08, 0, .57, 0, COL.woodD, { l: L_WOOD, r: [0, 0, .05] }); S.cone(.07, .14, .03, 1.2, 0, COL.brass, { n: 4, l: L_METAL, emis: .05 });
    for (const [order, nz] of [[[0, 1, 2, 0, 2, 3], 1], [[0, 3, 2, 0, 2, 1], -1]]) { const q = [[.06, 1.1, 0], [.06, .68, 0], [.44, .78, 0], [.62, .89, 0]], cols = [gold, amber, amber, gold]; for (const k of order) S.v(q[k][0], q[k][1], q[k][2], 0, 0, nz, cols[k][0], cols[k][1], cols[k][2], q[k][0] * .5, q[k][1] * .5, L_CLOTH, .9, 0, .05); }
    S.rock(.12, -.2, .04, .15, C(0x767b88), {}); S.rock(.09, .22, .03, -.12, C(0x4c505c), {});
  }, 14, { rad: .1 });
  G.boardSeed = HASH.seed ? +HASH.seed : 1 + Math.floor(Math.random() * 9000);
  G.boardIndex = +(HASH.board || 0); G.level = +(HASH.level || 0);
  { const bi = HASH.biome === undefined ? -1 : BIOMES.findIndex(b => b.key === HASH.biome || b.name.toLowerCase() === String(HASH.biome).toLowerCase()); BIOME.start = (bi >= 0 ? bi : HASH.biome !== undefined && isFinite(+HASH.biome) ? +HASH.biome : HASH.seed ? 0 : Math.floor(Math.random() * BIOMES.length)) - G.boardIndex; }
  const B = G.B = buildBoard(G.boardSeed++, G.boardIndex++);
  R.scene.add(B.group); activateBoard(B, true);
  beginBattle(true);
  window.addEventListener('resize', resizeRenderer);
  window.addEventListener('orientationchange', () => setTimeout(resizeRenderer, 120));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resizeRenderer);
  R.canvas.addEventListener('webglcontextlost', e => e.preventDefault());
  R.canvas.addEventListener('webglcontextrestored', () => location.reload());
  document.addEventListener('visibilitychange', () => { AU.setPaused(document.hidden); UI.dropTouches(); if (!document.hidden) { _last = performance.now(); UI.keepAwake(); } });
  window.addEventListener('blur', () => UI.dropTouches());
  for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(ev, () => setTimeout(resizeRenderer, 60));
  window.__cw = { G, R, CAM, UI, LT, FX, AI, PX, MON, step, shake, hitStop, setPhase, spawnMonster, hitMonster, MAT, render() { applyCamera(); renderFrame(); }, autoScale, tick(dt, render) { R.frameDt = dt; step(dt); R.fade = 1; applyCamera(); if (render) renderFrame(); UI.draw(); }, bench(n = 40) { const gl = R.renderer.getContext(), px = new Uint8Array(4); applyCamera(); renderFrame(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); const t0 = performance.now(); for (let i = 0; i < n; i++) { applyCamera(); renderFrame(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } return +((performance.now() - t0) / n).toFixed(2); }, build(i, kind, lvl) { const pad = G.B.pads[i]; if (pad.tower) return; G.gold += 999; const t = buildTower(pad, kind, false); for (let k = 0; k < 90; k++) step(1 / 30); for (let l = 0; l < (lvl || 0); l++) { G.gold += 999; upgradeTower(t); for (let k = 0; k < 90; k++) step(1 / 30); } return t.kind + t.lvl; } };
  if (HASH.k) G.k = +HASH.k;
  if (HASH.ff) { const n = Math.round(+HASH.ff * 30); for (let i = 0; i < n; i++) step(1 / 30); CAM.sx = CAM.fx; CAM.sz = CAM.fz; R.fade = 1; }
  if (HASH.phase) setPhase(HASH.phase);
  if (HASH.cam) { const c = HASH.cam.split(',').map(Number); window.__cw.lock = c; }
  const ld = document.getElementById('load'); if (ld) ld.remove();
  if (HASH.manual) return;
  _last = performance.now();
  requestAnimationFrame(frame);
}
function start() {
  try { boot(); }
  catch (e) { const ld = document.getElementById('load'); if (ld) ld.innerHTML = 'Cinderwatch could not start.<br><small>It needs a browser with WebGL 2 turned on.</small>'; throw e; }
}
if (HASH.manual || HASH.ff) start(); else requestAnimationFrame(() => setTimeout(start, 0));
