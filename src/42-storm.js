// ---- Stormreach: the sea around the slab, the lighthouse beams and the lightning ---------------------------------
// Everything here is looks only and uses the fx random stream (frnd), so the simulation never depends on it.
// Lands opt in through their BIOMES entry: bio.sea = [level, foam], bio.lighthouse, bio.lightning (mean seconds
// between ambient flashes; the gap is drawn from 0.6x to 1.4x of it).
//
// Hooks for the other parts of the game:
// - FX.lightningAt(x, z, power = 1): a bolt strikes that ground point: flash, light, scorch, sparks, smoke, shake.
//   Visual only; the caller applies any damage. Works on every land (Mira's thunderstorm event calls it).
// - G.flashT: seconds since the latest flash (counts up each step, resets to 0 when a flash begins, ambient flashes
//   and FX.lightningAt strikes alike; 1e9 before the first). G.flashX / G.flashZ: where it was. G.flashD: 0 a strike
//   on the board .. 1 far out at sea. G.flashN: flashes so far. G.flashK: the flash brightness now (0 to about 1.2).
// - FX.onFlash: functions called as fn(x, z, dist, power) when a flash begins (ambient or FX.lightningAt).
const STORM = {
  sea: null, u: null, beams: null, bu: null, vis: 0, want: 0, bio: null, B: null, level: -4.3,
  next: 3, flashes: [], k: 0, bolts: [], spray: 0, beamA: 0, fall: null,
};
FX.onFlash = [];
const _stc = new THREE.Color();

function initStormMeshes() {
  if (STORM.sea) return;
  const v3 = (x, y, z) => ({ value: new THREE.Vector3(x, y, z) }), v4 = () => ({ value: new THREE.Vector4() });
  const u = STORM.u = {
    uTime: SH.uTime, uFade: { value: 0 }, uDeep: v3(.008, .02, .026), uFoam: v3(.4, .46, .5), uMoonDir: v3(0, 1, 0), uMoonCol: v3(1, 1, 1), uAmb: v3(.05, .07, .09),
    uClear: v3(0, 0, 0), uView: v3(0, 1, 0), uBeacon: v4(), uBeaconCol: v3(1, .6, .3), uBeam: v4(), uFall: v4(), uStrike: v4(), uFlash: { value: 0 }, uSkyCol: v3(.02, .04, .06),
  };
  const m = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `precision highp float; varying vec3 vW;
uniform float uTime; uniform float uFade; uniform vec3 uDeep; uniform vec3 uFoam; uniform vec3 uMoonDir; uniform vec3 uMoonCol; uniform vec3 uAmb;
uniform vec3 uClear; uniform vec3 uView; uniform vec4 uBeacon; uniform vec3 uBeaconCol; uniform vec4 uBeam; uniform vec4 uFall; uniform vec4 uStrike; uniform float uFlash; uniform vec3 uSkyCol;
float hh(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float nn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hh(i), hh(i + vec2(1.0, 0.0)), f.x), mix(hh(i + vec2(0.0, 1.0)), hh(i + vec2(1.0, 1.0)), f.x), f.y); }
void main(){
  float t = uTime; vec2 p = vW.xz;
  float n0 = nn(p * 0.19 + vec2(t * 0.035, -t * 0.03)), n1 = nn(p * 0.52 + vec2(t * 0.12, t * 0.07)), n2 = nn(p * 1.5 - vec2(t * 0.25, t * 0.18)), n3 = nn(p * 4.0 + vec2(t * 0.55, -t * 0.4));
  // Distance from the foot of the cliffs (the slab is 36 wide; its lower strata step out about a unit).
  vec2 q = max(abs(p) - 18.0, 0.0); float d = length(q) - 1.0 + (n0 - 0.5) * 1.8;
  // Swells roll in toward the cliffs and break: crests near the shore, white water churning at the foot, lace
  // left behind, and whitecaps out at sea.
  float swell = sin(d * 1.8 - t * 1.6 + n1 * 3.2), near = smoothstep(12.0, 1.0, d);
  // Long wind swells out at sea (running with the wind, toward +x/+z), which catch the moon in streaks.
  float roll = sin(dot(p, vec2(0.62, 0.34)) * 1.1 - t * 1.3 + n0 * 5.0);
  float crest = smoothstep(0.78, 0.97, swell) * near * (0.3 + 0.7 * n2);
  float churn = smoothstep(1.3, -0.5, d + (n2 - 0.5) * 1.4) * (0.55 + 0.45 * n3);
  float lace = smoothstep(0.64, 0.8, n2 * 0.65 + n3 * 0.35) * smoothstep(5.0, 0.3, d) * 0.45;
  float cw = nn(vec2(dot(p, vec2(0.62, 0.34)) * 1.6 - t * 0.9, dot(p, vec2(-0.34, 0.62)) * 0.45 + t * 0.1));
  float caps = smoothstep(0.84, 0.97, cw * 0.55 + n1 * 0.25 + (roll * 0.5 + 0.5) * 0.2) * 0.22;
  float foam = clamp(max(max(churn, crest), max(lace, caps)), 0.0, 1.0);
  if (uFall.w > 0.0) foam = max(foam, smoothstep(2.4, 0.2, length(p - uFall.xy) + (n3 - 0.5) * 1.2) * uFall.w);
  // A bumped normal from the swells and the noise (screen-space slopes, as in the terrain shader).
  float h = swell * 0.25 * near + roll * 0.3 + n1 * 0.35 + n2 * 0.1;
  vec3 dPx = dFdx(vW), dPy = dFdy(vW), N0 = vec3(0.0, 1.0, 0.0), R1 = cross(dPy, N0), R2 = cross(N0, dPx);
  float det = dot(dPx, R1); vec3 N = normalize(abs(det) * N0 - 1.2 * sign(det) * (dFdx(h) * R1 + dFdy(h) * R2));
  float ndl = max(dot(N, uMoonDir), 0.0); vec3 Rv = reflect(-uView, N), Hm = normalize(uMoonDir + uView);
  vec3 col = uDeep * (0.6 + 0.6 * n0) * (uAmb * 3.0 + uMoonCol * ndl * 0.45);
  col = mix(col, uFoam * (uAmb * 1.3 + uMoonCol * (0.07 + 0.16 * ndl)), foam);
  col += uMoonCol * pow(max(dot(N, Hm), 0.0), 120.0) * 0.35 * (1.0 - foam);
  col += uSkyCol * (0.25 + 1.4 * pow(1.0 - max(dot(N, uView), 0.0), 4.0)) * (1.0 - foam);
  // The lighthouse: its lamp pools warm light on the nearer water, and two beams sweep across the sea.
  vec3 bd = uBeacon.xyz - vW; float bl = dot(bd, bd), bk = uBeacon.w / (bl + 1.6);
  col += uBeaconCol * bk * (0.003 + 0.02 * foam + 0.1 * pow(max(dot(Rv, normalize(bd)), 0.0), 40.0) * (1.0 - foam));
  vec2 bv = p - uBeam.xy; float bdist = length(bv); vec2 bdir = vec2(cos(uBeam.z), sin(uBeam.z));
  float ba = abs(dot(bv / max(bdist, 0.001), bdir)), beam = smoothstep(0.965, 0.998, ba) * smoothstep(70.0, 8.0, bdist) * smoothstep(3.0, 9.0, bdist) * uBeam.w;
  col += uBeaconCol * beam * (0.03 + 0.3 * foam);
  // Lightning: the whole sea flashes, most on the foam; a strike lights the water around it.
  col += vec3(0.5, 0.6, 0.8) * uFlash * (0.03 + 0.12 * foam * (0.4 + near) + 0.25 * pow(1.0 - max(dot(N, uView), 0.0), 2.0));
  vec2 sd = p - uStrike.xy; col += vec3(0.55, 0.7, 1.0) * uStrike.w * (0.3 + foam) * 9.0 / (dot(sd, sd) + 6.0);
  float r = length(p); col = mix(col, uClear, smoothstep(24.0, 64.0, r));
  gl_FragColor = vec4(mix(uClear, col, uFade), 1.0);
}`,
  });
  const g = new THREE.PlaneGeometry(240, 240, 1, 1); g.rotateX(-HPI);
  STORM.sea = new THREE.Mesh(g, m); STORM.sea.frustumCulled = false; STORM.sea.visible = false; STORM.sea.renderOrder = -1; R.scene.add(STORM.sea);
  // Two beams from the lamp: open cones along +x and -x, apex at the lamp, fading along their length; additive,
  // brightest where you look through the middle of the cone.
  const bg = new THREE.CylinderGeometry(3.4, .22, 36, 14, 1, true); bg.translate(0, 18, 0); bg.rotateZ(-HPI);
  const b2 = bg.clone(); b2.rotateY(PI);
  const pos = [], along = [];
  for (const gg of [bg, b2]) { const ix = gg.index.array, P = gg.attributes.position.array; for (const i of ix) { pos.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); along.push(Math.abs(P[i * 3]) / 36); } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1)); geo.computeVertexNormals();
  STORM.bu = { uCol: { value: new THREE.Vector3(1, .72, .4) }, uK: { value: 0 } };
  const bm = new THREE.ShaderMaterial({
    uniforms: STORM.bu, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    vertexShader: 'attribute float aAlong; varying float vA; varying vec3 vN; void main(){ vA = aAlong; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'precision highp float; varying float vA; varying vec3 vN; uniform vec3 uCol; uniform float uK; void main(){ float f = abs(vN.z); float a = f * f * pow(1.0 - vA, 1.6) * smoothstep(0.0, 0.05, vA) * uK; gl_FragColor = vec4(uCol * a, 1.0); }',
  });
  STORM.beams = new THREE.Mesh(geo, bm); STORM.beams.frustumCulled = false; STORM.beams.visible = false; STORM.beams.renderOrder = 4; R.scene.add(STORM.beams);
}

// Called by setBiomeLook when a board becomes the current one.
function setStormLand(B, instant) {
  const b = B.bio; STORM.bio = b; STORM.B = B; STORM.want = b.sea ? 1 : 0;
  if (b.sea && !STORM.sea) initStormMeshes();
  if (b.sea) {
    STORM.level = b.sea[0]; STORM.sea.position.y = STORM.level;
    const f = B.fallAt; STORM.fall = null;
    if (f) { const tau = Math.sqrt(Math.max(0, f.y - STORM.level) / 4.5), o = f.ext + f.v0 * tau; STORM.fall = [f.x + f.ox * o, f.z + f.oz * o]; }
    if (instant) STORM.vis = 1;
    R.mats.atmo.uniforms.uAOFloor.value = STORM.level + .5;
  } else R.mats.atmo.uniforms.uAOFloor.value = -1e9;
  if (!b.lightning) { STORM.flashes.length = 0; STORM.bolts.length = 0; }
  STORM.next = b.lightning ? b.lightning * frr(.25, .6) : 3;
}

// Flash envelope: quick rise, exponential fall.
function flashEnv(u, d) { return u < 0 ? 0 : Math.min(1, u / .018) * Math.exp(-u / d); }
// Starts a flash: a double (sometimes triple) flicker. dist 0 (on the board) .. 1 (far out at sea).
function stormFlash(x, z, dist, power) {
  const a = power * lerp(1, .5, dist), p2 = frr(.12, .22), ps = [[0, .055, a], [p2, frr(.07, .12), a * frr(.6, 1.05)]];
  if (frnd() < .45) ps.push([p2 + frr(.16, .3), frr(.1, .2), a * frr(.25, .5)]);
  const fl = { t: 0, ps, x, z, dist, power, bolt: null };
  STORM.flashes.push(fl);
  G.flashN = (G.flashN || 0) + 1; G.flashT = 0; G.flashD = dist; G.flashX = x; G.flashZ = z;
  for (const fn of FX.onFlash) { try { fn(x, z, dist, power); } catch (e) { } }
  return fl;
}
function flashLevel(fl) { let k = 0; for (const p of fl.ps) k += p[2] * flashEnv(fl.t - p[0], p[1]); return k; }

// A jagged bolt from a to b: midpoint displacement, plus forks that run down and out.
function makeBolt(a, b, rough, forks) {
  const pts = [a, b];
  for (let pass = 0; pass < 5; pass++) {
    for (let i = pts.length - 2; i >= 0; i--) {
      const p = pts[i], q = pts[i + 1], l = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) * rough;
      pts.splice(i + 1, 0, [(p[0] + q[0]) / 2 + frr(-l, l), (p[1] + q[1]) / 2 + frr(-l, l) * .3, (p[2] + q[2]) / 2 + frr(-l, l)]);
    }
  }
  const segs = [pts];
  for (let f = 0; f < forks; f++) {
    const i = Math.floor(frr(.12, .7) * (pts.length - 1)), p = pts[i], len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * frr(.12, .3), ang = frnd() * TAU;
    const e = [p[0] + Math.cos(ang) * len * .6, p[1] - len * frr(.5, .9), p[2] + Math.sin(ang) * len * .6], fp = [p, e];
    for (let pass = 0; pass < 3; pass++) for (let j = fp.length - 2; j >= 0; j--) { const u = fp[j], w = fp[j + 1], l = Math.hypot(w[0] - u[0], w[1] - u[1], w[2] - u[2]) * rough; fp.splice(j + 1, 0, [(u[0] + w[0]) / 2 + frr(-l, l), (u[1] + w[1]) / 2 + frr(-l, l) * .3, (u[2] + w[2]) / 2 + frr(-l, l)]); }
    segs.push(fp);
  }
  return segs;
}
function drawBolt(segs, k, w0, w1) {
  const SG = FX.segs, c = Math.min(1.4, k);
  for (let s = 0; s < segs.length; s++) {
    const P = segs[s], ws = s ? .55 : 1;
    for (let i = 0; i < P.length - 1; i++) {
      const p = P[i], q = P[i + 1], tw = s ? (1 - i / P.length) : 1;
      SG.push(p[0], p[1], p[2], w0 * ws * tw, q[0], q[1], q[2], w0 * ws * tw, 2.6, 2.9, 3.6, c * tw);
      SG.push(p[0], p[1], p[2], w1 * ws * tw, q[0], q[1], q[2], w1 * ws * tw, .3, .42, .8, c * .5 * tw);
    }
  }
}

// FX.lightningAt(x, z, power): a bolt from the sky onto that ground point. Looks only.
FX.lightningAt = function (x, z, power = 1) {
  if (!G.B || !isFinite(x) || !isFinite(z) || G.phase === 'crumble' || G.phase === 'rise') return;
  const y = G.B.heightAt(x, z), fl = stormFlash(x, z, 0, 1.1 * power);
  fl.bolt = makeBolt([x + frr(-4, 4), y + 26, z + frr(-4, 4)], [x, y + .05, z], .22, 3); fl.w = [.075, .5];
  fl.strike = [x, z];
  lightFlash(x, y + 2.2, z, 0xc4dcff, 1500 * power, .32, 26);
  fxTimed(5, x, y + .5, z, 4.6, 4.6, 2.2, 2.6, 3.6, 1, .16);
  fxTimed(4, x, y + .08, z, 4.4, 4.4, 1.0, 1.3, 2.0, .7, .4, { ground: true });
  fxTimed(2, x, y + .3, z, 6, 6, .5, .65, 1.1, .8, .5);
  fxSparks(x, y + .15, z, 26, 8, 2.2, 2.6, 3.6, { size: .07 });
  fxSparks(x, y + .15, z, 8, 4, 2.6, 1.6, .6, { size: .06 });
  for (let i = 0; i < 7; i++) { const a = frnd() * TAU, s = frr(.4, 1.3); fxSmoke(x + Math.cos(a) * .3, y + frr(.1, .5), z + Math.sin(a) * .3, Math.cos(a) * s, frr(.6, 1.4), Math.sin(a) * s, frr(1.4, 2.6), frr(.4, .7), 1.2, .16, .17, .2, .5, { drag: 1.4, rise: .25 }); }
  fxDust(x, y, z, 4, .7, { speed: 2.2 });
  FX.decals.add(G.B.heightAt, x, z, 1.15, .015, .016, .02, .85, 40);
  FX.decals.add(G.B.heightAt, x, z, .5, .002, .002, .003, .9, 40);
  shake(.55 * power);
};

const _stv = new THREE.Vector3();
function updateStorm(dt) {
  if (G.flashT === undefined) G.flashT = 1e9; else G.flashT += dt;
  const b = STORM.bio; if (!b) return;
  const fk = FX.flashK === undefined ? 1 : FX.flashK;
  STORM.vis = damp(STORM.vis, STORM.want, STORM.want ? 1.1 : 1.6, dt);
  const live = G.phase === 'play' || G.phase === 'defeat' || G.phase === 'clear';
  // Ambient lightning: far out at sea, behind the board as the camera sees it.
  if (b.lightning && STORM.vis > .5) {
    STORM.next -= dt;
    if (STORM.next <= 0) {
      STORM.next = b.lightning * frr(.6, 1.4);
      const dist = frr(.35, 1), back = Math.atan2(-Math.sin(CAM.yaw), -Math.cos(CAM.yaw)) + frr(-1.15, 1.15), r = lerp(21, 31, dist);
      const x = CAM.x + Math.cos(back) * r, z = CAM.z + Math.sin(back) * r, fl = stormFlash(x, z, dist, frr(.75, 1.05));
      if (frnd() < .8) { fl.bolt = makeBolt([x + frr(-6, 6), 46, z + frr(-6, 6)], [x, STORM.level, z], .2, 2 + Math.floor(frr(0, 3))); fl.w = [.11, .75]; fl.strike = [x, z]; }
    }
  }
  let k = 0, sx = 0, sz = 0, sk = 0;
  for (let i = STORM.flashes.length - 1; i >= 0; i--) {
    const fl = STORM.flashes[i]; fl.t += dt;
    if (fl.t > 1.6) { swapRemove(STORM.flashes, i); continue; }
    const lv = flashLevel(fl); k += lv;
    if (fl.bolt && lv > .03 && !R.skipDraw) drawBolt(fl.bolt, lv * 1.4, fl.w[0], fl.w[1]);
    if (fl.strike && lv > sk) { sk = lv; sx = fl.strike[0]; sz = fl.strike[1]; }
  }
  k *= fk; STORM.k = k; G.flashK = k;
  if (k > .002) stormLook(k);
  const sea = STORM.sea; if (!sea) return;
  sea.visible = STORM.vis > .004; STORM.beams.visible = sea.visible && !!b.lighthouse;
  if (!sea.visible) return;
  const u = STORM.u, mp = LT.moon.position, ml = mp.length() || 1, cl = R.renderer.getClearColor(_stc);
  u.uFade.value = STORM.vis; u.uMoonDir.value.set(mp.x / ml, mp.y / ml, mp.z / ml);
  u.uMoonCol.value.set(LT.moon.color.r, LT.moon.color.g, LT.moon.color.b).multiplyScalar(LT.moon.intensity);
  u.uAmb.value.set(LT.hemi.color.r, LT.hemi.color.g, LT.hemi.color.b).multiplyScalar(LT.hemi.intensity * .09);
  u.uClear.value.set(cl.r, cl.g, cl.b); { const sk = SH.uSky.value; u.uSkyCol.value.set(sk.r, sk.g, sk.b); }
  u.uView.value.set(Math.cos(CAM.elev) * Math.sin(CAM.yaw), Math.sin(CAM.elev), Math.cos(CAM.elev) * Math.cos(CAM.yaw));
  u.uFlash.value = k; u.uStrike.value.set(sx, sz, 0, sk * fk);
  const bp = LT.beaconPos || { x: 0, y: 0, z: 0 }, bi = LT.beacon.intensity;
  u.uBeacon.value.set(bp.x, bp.y + .5, bp.z, bi); u.uBeaconCol.value.set(LT.beacon.color.r, LT.beacon.color.g, LT.beacon.color.b);
  if (STORM.fall) u.uFall.value.set(STORM.fall[0], STORM.fall[1], 0, 1); else u.uFall.value.set(0, 0, 0, 0);
  // Lighthouse beams: two opposite beams turning once every nine seconds, as bright as the beacon burns.
  STORM.beamA = (STORM.beamA + dt * TAU / 9) % TAU;
  const on = b.lighthouse ? LT.beaconOn * (.35 + .65 * LT.beaconLevel) : 0;
  u.uBeam.value.set(bp.x, bp.z, STORM.beamA, on * STORM.vis);
  const bm = STORM.beams; bm.position.set(bp.x, bp.y + 1.2, bp.z); bm.rotation.set(0, -STORM.beamA, 0);
  STORM.bu.uK.value = .085 * on * STORM.vis * (1 - .5 * sat(k));
  // The lamp flares when a beam swings toward the camera.
  if (on > .05 && !R.skipDraw) {
    const face = Math.abs(Math.cos(STORM.beamA) * Math.sin(CAM.yaw) + Math.sin(STORM.beamA) * Math.cos(CAM.yaw)), fl = Math.pow(face, 10) * on;
    if (fl > .02) { FX.add.push(bp.x, bp.y + 1.2, bp.z, 3.2 + 5 * fl, 3.2 + 5 * fl, 0, 0, 1.6, 1.15, .62, .55 * fl, 2, 0, 0, 0); FX.add.push(bp.x, bp.y + 1.2, bp.z, 9 * fl + 1, .55, 0, 0, 1.8, 1.3, .7, .35 * fl, 6, 0, 0, 0); }
  }
  // Waves breaking on the cliffs throw up spray along the slab's edges.
  if (live && b.sea && STORM.vis > .5) {
    STORM.spray += dt * 7 * FX.keep;
    while (STORM.spray >= 1) {
      STORM.spray -= 1;
      const side = frnd() < .7 ? (frnd() < .5 ? 0 : 1) : (frnd() < .5 ? 2 : 3), along = frr(-18.5, 18.5), out = frr(1.0, 1.7), ox = side === 0 ? 1 : side === 2 ? -1 : 0, oz = side === 1 ? 1 : side === 3 ? -1 : 0;
      const x = ox ? ox * (18 + out) : along, z = oz ? oz * (18 + out) : along, y = STORM.level + .1, big = frnd() < .3 ? 1.6 : 1;
      fxSmoke(x, y + .2, z, ox * frr(.2, .6), frr(1.4, 2.8) * big, oz * frr(.2, .6), frr(1, 1.7), frr(.5, .9) * big, 1.6 * big, .5, .56, .6, .3, { drag: 1.3, rise: -.4 });
      for (let i = 0, n = Math.round(4 * big); i < n; i++) fxPart(x + frr(-.4, .4), y + .1, z + frr(-.4, .4), ox * frr(.3, 1.2) + frr(-.4, .4), frr(2.5, 5.5) * big, oz * frr(.3, 1.2) + frr(-.4, .4), frr(.6, 1.1), frr(.04, .07), .42, .5, .6, { grav: 8, drag: .3 });
    }
  }
}

// The flash on top of the land's look (called after applyLook and eventLook each step).
function stormLook(k) {
  const m = LT.moon, h = LT.hemi, c = Math.min(1, k);
  m.intensity += 3.8 * k; m.color.setRGB(lerp(m.color.r, .8, c), lerp(m.color.g, .88, c), lerp(m.color.b, 1, c));
  h.intensity += 1.2 * k; h.color.setRGB(lerp(h.color.r, .7, c * .6), lerp(h.color.g, .8, c * .6), lerp(h.color.b, 1, c * .6));
  const a = R.mats.atmo.uniforms.uMistAmb.value; a.set(a.x + .16 * k, a.y + .2 * k, a.z + .28 * k);
  const s = SH.uSky.value; s.setRGB(s.r + .16 * k, s.g + .2 * k, s.b + .28 * k);
  const cl = R.renderer.getClearColor(_stc); R.renderer.setClearColor(_stc.setRGB(cl.r + .02 * k, cl.g + .028 * k, cl.b + .045 * k), 1);
  const w = WX.u.uAmb.value; w.set(w.x + .9 * k, w.y + 1.02 * k, w.z + 1.3 * k);
  const fa = FX.alpha.mesh.material.uniforms.uAmb.value; fa.set(fa.x + .15 * k, fa.y + .18 * k, fa.z + .24 * k);
  R.exposure *= 1 + .18 * k;
}
window.__cwStorm = STORM; // test hook
