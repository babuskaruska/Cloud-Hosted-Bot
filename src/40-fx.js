
// Cosmetic randomness has its own stream so visual changes never shift the gameplay RNG (and the balance sims).
const frnd = makeRng(0xF1A3E5), frr = (a, b) => a + (b - a) * frnd();
const LT = {
  hemi: null, moon: null, fill: null, beacon: null, spots: [], towers: [], flashes: [], torches: [], env: [], envSrc: [], envK: 0,
  beaconBase: 1500, beaconMul: 1, beaconLevel: 1, bp: new THREE.Vector3(), tick: 0, shadowsAt: -1, beaconGutter: 0, beaconOn: 1, lanternK: 1, cold: 0, emitters: [], spotTimer: 0,
  // Point lights in use per graphics tier (GFX.apply): towers, torches, flashes. With fewer tower lights than
  // towers, tPick holds the emitters that get one (the brightest near the camera, re-picked with the spotlights).
  nTower: 12, nTorch: 5, nFlash: 4, tPick: [],
};
function initLights() {
  const S = R.scene;
  LT.hemi = new THREE.HemisphereLight(0x6d83bd, 0x1c1f2a, 1.15); S.add(LT.hemi);
  const sm = window.matchMedia && matchMedia('(pointer: coarse)').matches ? .75 : 1;
  const moon = LT.moon = new THREE.DirectionalLight(0xa9c0f6, 1.55); moon.castShadow = true; moon.shadow.mapSize.set(2048 * sm, 2048 * sm); LT.moonMap = 2048 * sm;
  const sc = moon.shadow.camera; sc.left = -31; sc.right = 31; sc.top = 31; sc.bottom = -31; sc.near = 5; sc.far = 130; moon.shadow.bias = -0.0005; moon.shadow.normalBias = 0.06;
  S.add(moon); S.add(moon.target);
  LT.fill = new THREE.DirectionalLight(0x4a5f96, 0.3); LT.fill.position.set(30, 14, 34); S.add(LT.fill);
  const b = LT.beacon = new THREE.PointLight(0xff8a3a, 0, 80, 2); b.castShadow = true; b.shadow.mapSize.set(1024 * sm, 1024 * sm);
  b.shadow.camera.near = .5; b.shadow.camera.far = 80; b.shadow.bias = -0.004; b.shadow.normalBias = 0.05; S.add(b); PartBatch.wideCam = b.shadow.camera;
  for (let i = 0; i < 3; i++) {
    const s = new THREE.SpotLight(0xff9646, 0, 17, 1.12, .85, 2); s.castShadow = true; s.shadow.mapSize.set(1024 * sm, 1024 * sm);
    s.shadow.camera.near = .4; s.shadow.camera.far = 18; s.shadow.bias = -0.0025; s.shadow.normalBias = 0.04;
    s.position.set(0, 4, 0); s.userData.spot = i; S.add(s); S.add(s.target); LT.spots.push({ l: s, owner: null, fade: 0, want: null });
  }
  for (let i = 0; i < 12; i++) { const l = new THREE.PointLight(0xff9646, 0, 11, 2); S.add(l); LT.towers.push(l); }
  for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffc070, 0, 22, 2); S.add(l); LT.flashes.push({ l, t: 1, dur: 1, i0: 0 }); }
  for (let i = 0; i < 5; i++) { const l = new THREE.PointLight(0xff9a50, 0, 7, 2); S.add(l); LT.torches.push({ l, owner: null, cur: 0 }); }
  for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xff5a1e, 0, 9, 2); S.add(l); LT.env.push(l); }
}
// Each shadow map is redrawn every third frame, staggered. In a crowd the beacon's cube map (six passes, the
// costliest by far) is redrawn every sixth frame; its light moves with its shadow so the two always agree.
function scheduleShadows(busy) {
  const f = LT.tick = (LT.tick + 1) % 3, all = LT.shadowsAt < 0 || !R.opt; LT.shadowsAt = 0;
  if (f === 0) LT.cyc = (LT.cyc || 0) + 1;
  const set = (l, on) => { l.shadow.autoUpdate = false; l.shadow.needsUpdate = (on || all) && l.intensity > 0; };
  set(LT.moon, busy || f === 0);
  const bf = f === 1 && (!DRAW.crowd || (LT.cyc & 1) === 0);
  if (bf || all) LT.beacon.position.copy(LT.bp);
  set(LT.beacon, bf);
  set(LT.spots[0].l, f === 0); set(LT.spots[1].l, f === 2); set(LT.spots[2].l, f === 2);
}
function lightFlash(x, y, z, color, intensity, dur, range = 24) {
  let best = LT.flashes[0];
  for (let i = 0; i < LT.nFlash; i++) { const f = LT.flashes[i]; if (f.t >= 1) { best = f; break; } if (f.l.intensity < best.l.intensity) best = f; }
  best.l.position.set(x, y, z); best.l.color.set(color); best.l.distance = range; best.i0 = intensity; best.t = 0; best.dur = dur; best.l.intensity = intensity;
}
function updateLights(dt, t, focusX, focusZ) {
  LT.beaconGutter = Math.max(0, LT.beaconGutter - dt * 1.6);
  const flick = .86 + .1 * n1(t * 6.3, 1) + .06 * n1(t * 17, 2);
  const lvl = LT.beaconLevel * LT.beaconOn * (1 - .55 * LT.beaconGutter * (0.6 + .4 * Math.sin(t * 40)));
  LT.beacon.intensity = LT.beaconBase * LT.beaconMul * (.35 + .65 * lvl) * (lvl > 0.001 ? 1 : 0) * flick * LT.beaconOn;
  if (LT.beaconPos) LT.bp.set(LT.beaconPos.x + n1(t * 5, 3) * .1, LT.beaconPos.y + .5 + n1(t * 4, 4) * .08, LT.beaconPos.z + n1(t * 5, 5) * .1);
  for (const f of LT.flashes) { if (f.t < 1) { f.t += dt / f.dur; const k = Math.max(0, 1 - f.t); f.l.intensity = f.i0 * k * k; } else f.l.intensity = 0; }
  LT.spotTimer -= dt;
  if (LT.spotTimer <= 0) {
    LT.spotTimer = .4;
    if (LT.nTower < LT.towers.length) pickTowerLights(focusX, focusZ);
    const lit = LT.emitters.filter(e => e && e.alive && e.on > .5 && e.spot);
    const key = e => dist2(e.x, e.z, focusX, focusZ) - (e._spot > .2 ? 12 : 0);
    lit.sort((a, b) => key(a) - key(b));
    const want = lit.slice(0, 3);
    for (const s of LT.spots) s.want = (s.owner && want.includes(s.owner)) ? s.owner : null;
    for (const e of want) if (!LT.spots.some(s => s.want === e)) { const s = LT.spots.find(s => !s.want); if (s) s.want = e; }
  }
  for (const e of LT.emitters) if (e) e._spot = 0;
  for (const s of LT.spots) {
    if (s.owner && (!s.owner.alive || s.owner.on < .05)) { if (s.want === s.owner) s.want = null; }
    if (s.owner !== s.want) { s.fade = Math.max(0, s.fade - dt * 4); if (s.fade <= 0) s.owner = s.want; }
    else if (s.owner) s.fade = Math.min(1, s.fade + dt * 3);
    const e = s.owner;
    if (e) {
      e._spot = s.fade;
      s.l.position.set(e.x, e.y + .25, e.z); s.l.target.position.set(e.x + (e.dx || 0) * 1.2, e.y - 3, e.z + (e.dz || 0) * 1.2);
      s.l.color.setRGB(e.r, e.g, e.b); s.l.intensity = e.I * e.on * (e.fl || 1) * (e.snf === undefined ? 1 : e.snf) * s.fade * 1.25 * LT.lanternK;
    } else s.l.intensity = 0;
  }
  for (let i = 0; i < LT.env.length; i++) {
    const l = LT.env[i], e = LT.envSrc[i];
    if (e && LT.envK > .01) { l.position.set(e.x, e.y, e.z); l.color.setHex(e.c); l.distance = e.d; l.intensity = e.I * LT.envK * LT.lanternK * (e.flick ? .82 + .18 * n1(t * 1.7 + i * 5, i + 11) : 1); } else l.intensity = 0;
  }
  const few = LT.nTower < LT.towers.length;
  for (let i = 0; i < LT.towers.length; i++) {
    const l = LT.towers[i], e = few ? (i < LT.nTower ? LT.tPick[i] : null) : LT.emitters[i];
    if (e && e.alive) {
      e.fl = .86 + .1 * n1(t * 7 + e.seed, e.seed) + .05 * n1(t * 19 + e.seed, e.seed + 1);
      l.position.set(e.x, e.y, e.z); l.color.setRGB(e.r, e.g, e.b); l.distance = e.range * (1 - .3 * (G.eclA || 0)); // Eclipse shrinks tower light
      e.snf = FX.snuffs.length ? snuffMul(e.x, e.z) : 1; // the Hollow Herald's snuff (FX.snuff) dims it
      l.intensity = e.I * e.on * e.fl * e.snf * (1 - .68 * (e._spot || 0)) * LT.lanternK; // Act II nights: brighter lanterns
    } else l.intensity = 0;
  }
}
// Low and Mid tiers: which lit towers get one of the few tower point lights. A tower that keeps its light keeps its
// slot (no hand-over flicker); free slots go to the brightest of the rest, nearest the camera first.
const _tpScore = e => e.I * e.on / (1 + dist2(e.x, e.z, _tpF.x, _tpF.z) * .02), _tpF = { x: 0, z: 0 }, _tpCand = [];
function pickTowerLights(fx, fz) {
  _tpF.x = fx; _tpF.z = fz; _tpCand.length = 0;
  for (const e of LT.emitters) if (e && e.alive && e.on > .05) { e._tps = _tpScore(e); _tpCand.push(e); }
  _tpCand.sort((a, b) => b._tps - a._tps);
  const n = LT.nTower, P = LT.tPick; P.length = n;
  for (let i = 0; i < n; i++) if (P[i] && _tpCand.indexOf(P[i]) >= n) P[i] = null; else if (P[i] === undefined) P[i] = null;
  for (let j = 0; j < Math.min(n, _tpCand.length); j++) { const e = _tpCand[j]; if (P.indexOf(e) >= 0) continue; const k = P.indexOf(null); if (k < 0) break; P[k] = e; }
}
function updateTorchLights(dt, cands, focusX, focusZ) {
  for (const c of cands) c._ls = c.lI / (1 + dist2(c.lx, c.lz, focusX, focusZ) * .03);
  cands.sort((a, b) => b._ls - a._ls);
  const top = cands.slice(0, 9);
  const nT = LT.nTorch;
  for (let i = 0; i < nT; i++) { const s = LT.torches[i]; if (s.owner && (!s.owner.alive || !top.includes(s.owner))) s.releasing = true; }
  for (let i = 0; i < Math.min(nT, top.length); i++) {
    const c = top[i]; let has = false, free = null;
    for (let j = 0; j < nT; j++) { const s = LT.torches[j]; if (s.owner === c) has = true; else if (!s.owner && !free) free = s; }
    if (!has && free) { free.owner = c; free.releasing = false; free.cur = 0; }
  }
  for (let i = 0; i < nT; i++) {
    const s = LT.torches[i];
    const o = s.owner;
    if (!o) { s.l.intensity = 0; continue; }
    s.cur = damp(s.cur, s.releasing ? 0 : o.lI, s.releasing ? 20 : 12, dt);
    if (s.releasing && s.cur < .5) { s.owner = null; s.cur = 0; s.l.intensity = 0; continue; }
    if (o.alive) { s.l.position.set(o.lx, o.ly, o.lz); s.l.color.setHex(o.lCol || 0xff9a50); }
    s.l.intensity = s.cur * (.85 + .15 * n1(SH.uTime.value * 9, o.lseed || 0));
  }
}
const _mistTw = [], byFull = (a, b) => b._full - a._full;
function collectMistLights() {
  let k = 0; const put = (l, gain) => { if (k >= R.NL) return; R.lightPos[k].copy(l.position); R.lightCol[k].set(l.color.r, l.color.g, l.color.b).multiplyScalar(l.intensity * gain); k++; };
  put(LT.beacon, .05);
  for (const f of LT.flashes) put(f.l, .06);
  // Tower lanterns at their full strength (a tower whose spotlight is on dims its point light, not its glow in the
  // air), straight from the emitters, so towers without a point light on Low and Mid still glow in the mist.
  _mistTw.length = 0;
  for (const e of LT.emitters) if (e && e.alive) { e._full = e.I * e.on * (e.fl || 1) * (e.snf === undefined ? 1 : e.snf); if (e._full > 0 || e._spot > 0) _mistTw.push(e); }
  _mistTw.sort(byFull);
  for (const e of _mistTw) { if (k >= R.NL) break; R.lightPos[k].set(e.x, e.y, e.z); R.lightCol[k].set(e.r, e.g, e.b).multiplyScalar(e._full * .16); k++; }
  for (const l of LT.env) if (l.intensity > 0) put(l, .1);
  for (; k < R.NL; k++) R.lightCol[k].set(0, 0, 0);
}

const SPR_VERT = `
attribute vec3 iPos; attribute vec4 iSize; attribute vec4 iCol; attribute vec4 iMisc;
varying vec2 vUv; varying vec4 vCol; varying vec4 vMisc;
#ifdef LIT
uniform vec3 uLightPos[${12}]; uniform vec3 uLightCol[${12}]; uniform vec3 uAmb;
#endif
void main(){
  vUv = position.xy; vCol = iCol; vMisc = iMisc;
  vec2 q = position.xy; q.y += iSize.w;
  float c = cos(iSize.z), s = sin(iSize.z); q = vec2(q.x * c - q.y * s, q.x * s + q.y * c) * iSize.xy * 0.5;
  #ifdef LIT
  vec3 L = uAmb; for (int i = 0; i < 12; i++) { vec3 d = uLightPos[i] - iPos; L += uLightCol[i] / (dot(d, d) + 3.0); }
  vCol.rgb *= L;
  #endif
  if (iMisc.w > 0.5) { gl_Position = projectionMatrix * viewMatrix * vec4(iPos + vec3(q.x, 0.0, -q.y), 1.0); }
  else { vec4 mv = viewMatrix * vec4(iPos, 1.0); mv.xy += q; gl_Position = projectionMatrix * mv; }
}`;
const SPR_NOISE = `
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }`;
const SPR_FRAG_ADD = `
precision highp float; varying vec2 vUv; varying vec4 vCol; varying vec4 vMisc; uniform float uTime;
${SPR_NOISE}
void main(){
  int type = int(vMisc.x + 0.5); float seed = vMisc.y, age = vMisc.z; vec2 p = vUv; float r = length(p);
  vec3 col = vCol.rgb; float a = 0.0;
  if (type == 0) { a = smoothstep(1.0, 0.0, r); a *= a; }
  else if (type == 1) {
    float y = p.y * 0.5 + 0.5, t = uTime * 1.5 + seed * 17.0;
    float n1 = noise(vec2(p.x * 2.6 + seed * 7.0, y * 3.2 - t * 2.3)), n2 = noise(vec2(p.x * 5.5 - seed * 3.0, y * 6.0 - t * 3.9));
    float x = p.x + (n1 - 0.5) * 0.55 * y;
    float w = mix(0.66, 0.02, pow(y, 0.85));
    float body = 1.0 - smoothstep(w * 0.35, w, abs(x));
    float d = body * (1.08 - y) + (n1 * 0.62 + n2 * 0.38 - 0.5) * (0.28 + 0.6 * y) - smoothstep(0.0, 0.07, 0.07 - y) * 0.6;
    a = smoothstep(0.1, 0.16, d);
    col *= mix(vec3(1.0, 0.24, 0.03), vec3(1.0, 0.56, 0.1), smoothstep(0.26, 0.3, d));
    col = mix(col, vCol.rgb * vec3(1.0, 0.86, 0.42), smoothstep(0.46, 0.52, d));
    col = mix(col, vCol.rgb * vec3(1.15, 1.05, 0.8), smoothstep(0.7, 0.78, d));
  }
  else if (type == 2) { a = pow(max(0.0, 1.0 - r), 2.4); }
  else if (type == 3) {
    float n = noise(p * 2.4 + seed * 13.0 + vec2(0.0, -age * 1.6)) * 0.6 + noise(p * 5.2 - seed * 7.0) * 0.4;
    float d = (1.0 - r) + (n - 0.5) * 0.95 - age * 0.95;
    a = smoothstep(0.02, 0.1, d);
    vec3 hot = mix(vec3(0.9, 0.2, 0.03), vec3(1.0, 0.62, 0.16), smoothstep(0.16, 0.24, d));
    hot = mix(hot, vec3(1.1, 0.95, 0.7), smoothstep(0.42, 0.52, d));
    col *= hot * (1.0 - age * 0.55);
  }
  else if (type == 4) { float R0 = 0.25 + 0.75 * sqrt(age); a = smoothstep(0.14, 0.0, abs(r - R0)) * (1.0 - age) * (1.0 - age); }
  else if (type == 5) { float th = atan(p.y, p.x); a = pow(max(0.0, 1.0 - r), 1.6) * (0.25 + 0.75 * pow(abs(cos(th * 2.5 + seed)), 6.0)) * (1.0 - age); a += pow(max(0.0, 1.0 - r * 2.2), 2.0); }
  else if (type == 6) { a = smoothstep(1.0, 0.0, abs(p.y)) * smoothstep(1.0, 0.3, abs(p.x)); }
  else if (type == 7) {
    float th = atan(p.y, p.x), front = mix(-1.5, 1.5, smoothstep(0.0, 0.55, age));
    float band = smoothstep(0.5, 0.74, r) * smoothstep(1.0, 0.9, r);
    float trail = smoothstep(front - 1.5, front, th) * step(th, front) * step(-1.6, th);
    a = band * trail * (1.0 - smoothstep(0.45, 1.0, age));
  }
  else if (type == 8) {
    float th = atan(p.y, p.x), inside = 1.0 - smoothstep(0.97, 1.0, r);
    float sh = noise(vec2(th * 2.4 + uTime * 1.1 + seed, r * 3.0 - uTime * 0.8)) * 0.6 + noise(p * 6.0 + vec2(uTime * 0.6, seed)) * 0.4;
    vec2 g = p - vec2(-0.36, 0.4);
    a = (smoothstep(0.7, 0.97, r) * (0.45 + 0.55 * sh) + 0.06 + 0.9 * exp(-dot(g, g) * 26.0)) * inside;
  }
  else if (type == 9) {
    // Rune circle (overcharge): two rings with blocky glyphs between them; age = share of glyphs lit.
    float u = atan(p.y, p.x) / 6.2832 + 0.5, cell = floor(u * 20.0), f = fract(u * 20.0);
    float rings = smoothstep(0.04, 0.0, abs(r - 0.93)) + smoothstep(0.03, 0.0, abs(r - 0.7)) * 0.8;
    float band = step(0.75, r) * step(r, 0.89), row = floor((r - 0.75) * 30.0);
    float glyph = band * step(0.16, f) * step(f, 0.84) * step(hash(vec2(cell * 1.7 + row, seed)), 0.6) * step(hash(vec2(cell, seed + 3.0)), age + 0.08);
    a = (rings + glyph * 1.3) * (0.75 + 0.25 * sin(uTime * 3.0 + cell * 1.3));
  }
  gl_FragColor = vec4(col * a * vCol.a, 1.0);
}`;
const SPR_FRAG_ALPHA = `
precision highp float; varying vec2 vUv; varying vec4 vCol; varying vec4 vMisc; uniform float uTime;
${SPR_NOISE}
void main(){
  float seed = vMisc.y, age = vMisc.z; vec2 p = vUv; float r = length(p);
  float n = noise(p * 1.7 + seed * 9.0 + vec2(0.0, -age * 0.6)) * 0.65 + noise(p * 3.9 + seed * 5.0) * 0.35;
  float a = smoothstep(1.0, 0.25, r + (n - 0.5) * 0.9);
  a = floor(a * 4.0 + 0.5) / 4.0;
  gl_FragColor = vec4(vCol.rgb * (0.7 + 0.5 * n), a * vCol.a);
}`;

class SpriteBatch {
  constructor(cap, lit) {
    this.cap = cap; this.n = 0;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); this.aSize = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); this.aMisc = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    for (const a of [this.aPos, this.aSize, this.aCol, this.aMisc]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.aPos); g.setAttribute('iSize', this.aSize); g.setAttribute('iCol', this.aCol); g.setAttribute('iMisc', this.aMisc);
    const uniforms = { uTime: SH.uTime };
    if (lit) { uniforms.uLightPos = { value: R.lightPos }; uniforms.uLightCol = { value: R.lightCol }; uniforms.uAmb = { value: new THREE.Vector3(.05, .065, .1) }; }
    const m = new THREE.ShaderMaterial({
      vertexShader: SPR_VERT, fragmentShader: lit ? SPR_FRAG_ALPHA : SPR_FRAG_ADD, uniforms, defines: lit ? { LIT: 1 } : {},
      transparent: true, depthWrite: false, depthTest: true,
      blending: lit ? THREE.NormalBlending : THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
    });
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = lit ? 3 : 4; this.geo = g;
  }
  begin() { this.n = 0; }
  push(x, y, z, w, h, rot, anchor, r, g, b, a, type, seed, age, ground) {
    if (this.n >= this.cap) return; const i = this.n++;
    const P = this.aPos.array, S = this.aSize.array, C = this.aCol.array, M = this.aMisc.array;
    P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z; S[i * 4] = w; S[i * 4 + 1] = h; S[i * 4 + 2] = rot; S[i * 4 + 3] = anchor;
    C[i * 4] = r; C[i * 4 + 1] = g; C[i * 4 + 2] = b; C[i * 4 + 3] = a; M[i * 4] = type; M[i * 4 + 1] = seed; M[i * 4 + 2] = age; M[i * 4 + 3] = ground;
  }
  end() {
    this.geo.instanceCount = this.n;
    for (const a of [this.aPos, this.aSize, this.aCol, this.aMisc]) { a.clearUpdateRanges(); a.addUpdateRange(0, this.n * a.itemSize); a.needsUpdate = true; }
  }
}

class SegBatch {
  constructor(cap) {
    this.cap = cap; this.n = 0;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]), 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
    this.aA = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); this.aB = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    for (const a of [this.aA, this.aB, this.aCol]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iA', this.aA); g.setAttribute('iB', this.aB); g.setAttribute('iCol', this.aCol);
    const m = new THREE.ShaderMaterial({
      vertexShader: `attribute vec4 iA; attribute vec4 iB; attribute vec4 iCol; varying vec4 vCol; varying vec2 vUv;
void main(){ vec4 a = viewMatrix * vec4(iA.xyz, 1.0), b = viewMatrix * vec4(iB.xyz, 1.0); vec2 d = b.xy - a.xy; float l = max(length(d), 1e-4); vec2 nrm = vec2(-d.y, d.x) / l;
  vec4 p = mix(a, b, position.x); p.xy += nrm * position.y * mix(iA.w, iB.w, position.x); vCol = iCol; vUv = position.xy; gl_Position = projectionMatrix * p; }`,
      fragmentShader: `precision highp float; varying vec4 vCol; varying vec2 vUv; void main(){ float a = 1.0 - abs(vUv.y); a = a * a * (3.0 - 2.0 * a); gl_FragColor = vec4(vCol.rgb * vCol.a * (0.35 + 0.65 * a) * step(0.0, a), 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    });
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = 5; this.geo = g;
  }
  begin() { this.n = 0; }
  push(ax, ay, az, aw, bx, by, bz, bw, r, g, b, a) {
    if (this.n >= this.cap) return; const i = this.n++ * 4;
    const A = this.aA.array, Bq = this.aB.array, C = this.aCol.array;
    A[i] = ax; A[i + 1] = ay; A[i + 2] = az; A[i + 3] = aw; Bq[i] = bx; Bq[i + 1] = by; Bq[i + 2] = bz; Bq[i + 3] = bw; C[i] = r; C[i + 1] = g; C[i + 2] = b; C[i + 3] = a;
  }
  end() { this.geo.instanceCount = this.n; for (const a of [this.aA, this.aB, this.aCol]) { a.clearUpdateRanges(); a.addUpdateRange(0, this.n * 4); a.needsUpdate = true; } }
}

class DecalBatch {
  // Ground stains (scorch, blood, goo). A ring of slots in one mesh. Decals persist through a wave (at least
  // DECAL_MIN_LIFE seconds) and fadeAll() fades them out between waves. Dead slots are collapsed far below
  // the board so they cost no fill.
  constructor(cap) {
    this.cap = cap; this.G = 4; this.next = 0; this.slots = []; this.dirty = false;
    const vps = (this.G + 1) * (this.G + 1), g = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(cap * vps * 3).fill(-999), 3); this.uv = new THREE.BufferAttribute(new Float32Array(cap * vps * 2), 2); this.col = new THREE.BufferAttribute(new Float32Array(cap * vps * 4), 4);
    this.pos.setUsage(THREE.DynamicDrawUsage); this.col.setUsage(THREE.DynamicDrawUsage);
    const idx = [];
    for (let s = 0; s < cap; s++) {
      this.slots.push({ life: 0, fade: 1, a: 0, seed: 0, k: 0, dead: true, r: 0, g: 0, b: 0 });
      for (let j = 0; j <= this.G; j++) for (let i = 0; i <= this.G; i++) { const o = s * vps + j * (this.G + 1) + i; this.uv.array[o * 2] = i / this.G * 2 - 1; this.uv.array[o * 2 + 1] = j / this.G * 2 - 1; }
      for (let j = 0; j < this.G; j++) for (let i = 0; i < this.G; i++) { const a = s * vps + j * (this.G + 1) + i, b = a + 1, c = a + this.G + 2, d = a + this.G + 1; idx.push(a, d, c, a, c, b); }
    }
    g.setAttribute('position', this.pos); g.setAttribute('uv', this.uv); g.setAttribute('aCol', this.col); g.setIndex(idx);
    const m = new THREE.ShaderMaterial({
      vertexShader: 'attribute vec4 aCol; varying vec4 vCol; varying vec2 vUv; void main(){ vCol = aCol; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `precision highp float; varying vec4 vCol; varying vec2 vUv; ${SPR_NOISE}
void main(){ float r = length(vUv); float sd = floor(vCol.a + 0.015); float al = fract(vCol.a + 0.015) - 0.015; al = max(al, 0.0) * 1.02; float n = noise(vUv * 3.0 + sd * 3.7) * 0.6 + noise(vUv * 7.0 + sd) * 0.4;
  float a = smoothstep(1.0, 0.35, r + (n - 0.5) * 0.8); float th = atan(vUv.y, vUv.x); a *= 0.75 + 0.25 * noise(vec2(th * 3.0, sd));
  gl_FragColor = vec4(vCol.rgb, a * al); }`,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    });
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = 1; this.vps = vps;
  }
  add(heightAt, x, z, size, r, g, b, alpha, life, minLife = DECAL_MIN_LIFE) {
    const s = this.next; this.next = (this.next + 1) % this.cap; const sl = this.slots[s];
    sl.life = Math.max(life, minLife); sl.fade = Math.max(.6, Math.min(4, life * .25)); sl.a = alpha; sl.seed = Math.floor(frnd() * 90) + 1; sl.r = r; sl.g = g; sl.b = b; sl.k = -1; sl.dead = false;
    const P = this.pos.array, rot = frnd() * TAU, cs = Math.cos(rot), sn = Math.sin(rot);
    for (let j = 0; j <= this.G; j++) for (let i = 0; i <= this.G; i++) {
      const o = (s * this.vps + j * (this.G + 1) + i) * 3, lx = (i / this.G * 2 - 1) * size, lz = (j / this.G * 2 - 1) * size, wx = x + lx * cs - lz * sn, wz = z + lx * sn + lz * cs;
      P[o] = wx; P[o + 1] = heightAt(wx, wz) + .1; P[o + 2] = wz;
    }
    this.pos.addUpdateRange(s * this.vps * 3, this.vps * 3); this.pos.needsUpdate = true;
  }
  update(dt) {
    const C = this.col.array, P = this.pos.array;
    for (let s = 0; s < this.cap; s++) {
      const sl = this.slots[s]; if (sl.dead) continue;
      sl.life -= dt;
      // An expired decal is collapsed even when its last fade steps were too small to write (else it lingered
      // forever at a sliver of alpha, which float rounding could show as hard-edged shards).
      if (sl.life <= 0) { sl.dead = true; P.fill(-999, s * this.vps * 3, (s + 1) * this.vps * 3); this.pos.addUpdateRange(s * this.vps * 3, this.vps * 3); this.pos.needsUpdate = true; continue; }
      const k = Math.min(1, sl.life / sl.fade) * sl.a;
      if (Math.abs(k - sl.k) < .004) continue;
      sl.k = k; this.dirty = true;
      for (let v = 0; v < this.vps; v++) { const o = (s * this.vps + v) * 4; C[o] = sl.r; C[o + 1] = sl.g; C[o + 2] = sl.b; C[o + 3] = sl.seed + Math.min(.97, k); }
    }
    if (this.dirty) { this.dirty = false; this.col.needsUpdate = true; }
  }
  fadeAll(sec) { for (const sl of this.slots) if (!sl.dead && sl.life > sec) { sl.life = sec * frr(.7, 1.15); sl.fade = sl.life; } }
  clear() { for (const sl of this.slots) if (!sl.dead) sl.life = 0; }
}
const DECAL_MIN_LIFE = 150;

const FX = {
  add: null, alpha: null, segs: null, decals: null,
  parts: [], smokes: [], flames: [], timed: [], bolts: [], fires: [], scorch: [], meteors: [], novas: [], snuffs: [], lit: [], keep: 1, shake: 0, shakeK: 1, shakeX: 0, shakeY: 0, shakeT: 0, flash: 0, flashK: 1, dt: 0, calm: false, groundAt: () => 0,
};
function initFX() {
  FX.add = new SpriteBatch(4000, false); FX.alpha = new SpriteBatch(800, true); FX.segs = new SegBatch(900); FX.decals = new DecalBatch(200);
  R.scene.add(FX.add.mesh, FX.alpha.mesh, FX.segs.mesh, FX.decals.mesh);
}
// FX.keep (0.55-1, set by planDraw): in a big crowd on screen, or at a lowered resolution, only that share of new
// particles and smoke puffs is made, and the caps shrink with it. Effects keep their shape, just thinner.
function fxPart(x, y, z, vx, vy, vz, life, size, r, g, b, o) {
  if (FX.parts.length > 1700 * FX.keep || (FX.keep < 1 && frnd() > FX.keep)) return;
  FX.parts.push({ x, y, z, vx, vy, vz, life, max: life, size, r, g, b, grav: o && o.grav || 0, drag: o && o.drag || 0, streak: o && o.streak || 0, rise: o && o.rise || 0, bounce: o && o.bounce || 0, seed: frnd() * 100, wob: o && o.wob || 0 });
}
function fxSmoke(x, y, z, vx, vy, vz, life, size, grow, r, g, b, a, o) {
  if (FX.smokes.length > 640 * FX.keep || (FX.keep < 1 && frnd() > FX.keep)) return;
  FX.smokes.push({ x, y, z, vx, vy, vz, life, max: life, size, grow, r, g, b, a, drag: o && o.drag !== undefined ? o.drag : 1.2, seed: frnd() * 100, rise: o && o.rise || 0 });
}
function fxSparks(x, y, z, n, speed, r, g, b, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = frnd() * TAU, e = frr(o.lo === undefined ? .1 : o.lo, o.hi === undefined ? 1.3 : o.hi), s = speed * frr(.4, 1);
    fxPart(x, y, z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s, Math.sin(a) * Math.cos(e) * s, frr(.25, .6) * (o.life || 1), o.size || .07, r, g, b, { grav: o.grav === undefined ? 9 : o.grav, drag: .6, streak: 1, bounce: .35 });
  }
}
function fxEmbers(x, y, z, n, spread, r = 1, g = .5, b = .12) {
  for (let i = 0; i < n; i++) fxPart(x + frr(-spread, spread), y + frr(0, spread), z + frr(-spread, spread), frr(-.25, .25), frr(.7, 1.9), frr(-.25, .25), frr(.9, 2.2), frr(.05, .09), r * frr(1.6, 3), g * frr(1.2, 2.4), b * 2, { drag: .3, wob: 1, rise: .25 });
}
function fxDust(x, y, z, n, size, o = {}) {
  const c = o.c || [.34, .3, .27];
  for (let i = 0; i < n; i++) { const a = frnd() * TAU, s = frr(.3, 1) * (o.speed || 1.3); fxSmoke(x + Math.cos(a) * size * .3, y + frr(0, .15), z + Math.sin(a) * size * .3, Math.cos(a) * s, frr(.2, .7) * (o.up || 1), Math.sin(a) * s, frr(.5, 1.1) * (o.life || 1), size * frr(.5, .9), size * 1.2, c[0], c[1], c[2], o.a || .5, { drag: 2.4 }); }
}
function fxTimed(type, x, y, z, w, h, r, g, b, a, life, o = {}) {
  FX.timed.push({ type, x, y, z, w, h, r, g, b, a, life, max: life, rot: o.rot || 0, ground: o.ground ? 1 : 0, grow: o.grow || 0, seed: frnd() * 50, anchor: o.anchor || 0 });
}
function fxExplosion(x, y, z, sc = 1) {
  lightFlash(x, y + 1.1, z, 0xffb060, 520 * sc * sc, .4, 20 + sc * 6);
  fxTimed(3, x, y + .45 * sc, z, 2.6 * sc, 2.6 * sc, 5.0, 4.2, 3.2, 1, .42, { grow: 1.3 });
  fxTimed(5, x, y + .4 * sc, z, 4.2 * sc, 4.2 * sc, 3.5, 2.4, 1.2, 1, .12);
  fxTimed(4, x, y + .08, z, 5.4 * sc, 5.4 * sc, 1.6, 1.0, .5, .55, .4, { ground: true });
  fxSparks(x, y + .2, z, Math.round(22 * sc), 7.5 * sc, 3.2, 1.7, .5, { size: .08 });
  for (let i = 0; i < 9 * sc; i++) { const a = frnd() * TAU, s = frr(.4, 1.6) * sc; fxSmoke(x + Math.cos(a) * .3, y + frr(.2, .7), z + Math.sin(a) * .3, Math.cos(a) * s, frr(.6, 1.7), Math.sin(a) * s, frr(1.6, 3.4), frr(.7, 1.1) * sc, 1.5 * sc, .2, .19, .19, .62, { drag: 1.5, rise: .25 }); }
  fxDust(x, y, z, 6, .9 * sc, { speed: 2.6 });
  if (FX.impact) FX.impact(x, y, z, sc); // round 13: shockwave, hot debris and a dust skirt (by tier, 44-juice.js)
  shake(.2 * sc);
}
function fxBolt(a, b, life = .22, col = [.55, .8, 1.6], width = .09) {
  FX.bolts.push({ a: a.slice(), b: b.slice(), life, max: life, col, width, seed: Math.floor(frnd() * 1000), re: 0, pts: null });
}
function addFlame(o) {
  const f = Object.assign({ size: 1, r: 1, g: 1, b: 1, embers: 1, glow: 1, on: 1, seed: frnd() * 10, acc: frnd(), layers: 1, alive: true, smoke: 0 }, o);
  FX.flames.push(f); return f;
}
function removeFlame(f) { if (!f) return; f.alive = false; const i = FX.flames.indexOf(f); if (i >= 0) swapRemove(FX.flames, i); }

function updateFX(dt, t) {
  const A = FX.add, AL = FX.alpha, SG = FX.segs, groundAt = FX.groundAt;
  A.begin(); AL.begin(); SG.begin(); FX.dt = dt;
  const rx = Math.cos(CAM.yaw), rz = -Math.sin(CAM.yaw), se = Math.sin(CAM.elev), ce = Math.cos(CAM.elev), ux = -se * Math.sin(CAM.yaw), uy = ce, uz = -se * Math.cos(CAM.yaw);
  const sn = FX.snuffs.length > 0;
  for (const f of FX.flames) {
    const on = sn ? f.on * snuffMul(f.x, f.z) : f.on; if (on <= .01) continue;
    const s = f.size * (.9 + .1 * on), fl = .88 + .12 * n1(t * 8 + f.seed * 3, f.seed);
    for (let k = 0; k < f.layers; k++) {
      const kk = k / Math.max(1, f.layers), w = s * (1 - kk * .28) * (.92 + .08 * fl), h = s * (1.55 - kk * .2) * (.75 + .25 * on);
      A.push(f.x + (k ? Math.sin(f.seed * 9 + k * 2.1) * s * .16 : 0), f.y - s * .08, f.z + (k ? Math.cos(f.seed * 5 + k * 1.7) * s * .16 : 0), w, h, 0, 1, f.r * 3.3, f.g * 3.3, f.b * 3.3, on, 1, f.seed + k * 3.7, 0, 0);
    }
    if (f.glow > 0) A.push(f.x, f.y + s * .5, f.z, s * 4.2, s * 4.2, 0, 0, f.r * 1.0, f.g * .5, f.b * .16, .2 * f.glow * on * fl, 2, 0, 0, 0);
    f.acc += dt * (2.2 + 5 * s) * f.embers * on;
    while (f.acc >= 1) {
      f.acc -= 1;
      fxPart(f.x + frr(-.25, .25) * s, f.y + s * frr(.3, 1.1), f.z + frr(-.25, .25) * s, frr(-.3, .3), frr(.8, 2.0) * (0.7 + s * .3), frr(-.3, .3), frr(.8, 2.0) * (.7 + s * .35), frr(.045, .085), f.r * frr(1.8, 3.2), f.g * frr(.7, 1.4), f.b * .25, { drag: .25, wob: 1, rise: .3 });
    }
    if (f.smoke > 0) { f.sacc = (f.sacc || 0) + dt * f.smoke * on; while (f.sacc >= 1) { f.sacc -= 1; fxSmoke(f.x + frr(-.2, .2) * s, f.y + s * 1.3, f.z + frr(-.2, .2) * s, frr(-.15, .15), frr(.9, 1.5), frr(-.15, .15), frr(2.5, 4.5), s * .7, s * 1.6, .16, .15, .16, .22, { drag: .25, rise: .1 }); } }
  }
  const P = FX.parts;
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i]; p.life -= dt; if (p.life <= 0) { swapRemove(P, i); continue; }
    p.vy += (p.rise - p.grav) * dt; const dr = Math.exp(-p.drag * dt); p.vx *= dr; p.vy *= dr; p.vz *= dr;
    if (p.wob) { p.vx += n1(t * 1.7 + p.seed, p.seed) * dt * 1.4; p.vz += n1(t * 1.3 + p.seed * 2, p.seed + 3) * dt * 1.4; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.bounce) { const gy = groundAt(p.x, p.z) + .03; if (p.y < gy) { p.y = gy; p.vy = -p.vy * p.bounce; p.vx *= .6; p.vz *= .6; } }
    const k = p.life / p.max, fade = Math.min(1, k * 2.5) * (p.wob ? (.7 + .3 * Math.sin(t * 30 + p.seed)) : 1);
    if (p.streak) {
      const sx = p.vx * rx + p.vz * rz, sy = p.vx * ux + p.vy * uy + p.vz * uz, sp = Math.hypot(sx, sy);
      A.push(p.x, p.y, p.z, p.size * (1 + sp * .22), p.size * .8, Math.atan2(sy, sx), 0, p.r, p.g * (.4 + .6 * k), p.b * k, fade, 6, 0, 0, 0);
    } else A.push(p.x, p.y, p.z, p.size, p.size, 0, 0, p.r, p.g * (.35 + .65 * k), p.b * k, fade, 0, 0, 0, 0);
  }
  const Sm = FX.smokes;
  for (let i = Sm.length - 1; i >= 0; i--) {
    const p = Sm[i]; p.life -= dt; if (p.life <= 0) { swapRemove(Sm, i); continue; }
    const dr = Math.exp(-p.drag * dt); p.vx *= dr; p.vy = p.vy * dr + p.rise * dt; p.vz *= dr;
    p.x += (p.vx + .12) * dt; p.y += p.vy * dt; p.z += (p.vz + .05) * dt;
    const k = 1 - p.life / p.max, sz = p.size + p.grow * (1 - Math.exp(-k * 3));
    AL.push(p.x, p.y, p.z, sz, sz, p.seed, 0, p.r, p.g, p.b, p.a * Math.min(1, k * 8) * (1 - k) * (1 - k * .3), 0, p.seed, k, 0);
  }
  const Tm = FX.timed;
  for (let i = Tm.length - 1; i >= 0; i--) {
    const s = Tm[i]; s.life -= dt; if (s.life <= 0) { swapRemove(Tm, i); continue; }
    const k = 1 - s.life / s.max, g = 1 + s.grow * (1 - Math.exp(-k * 4));
    A.push(s.x, s.y, s.z, s.w * g, s.h * g, s.rot, s.anchor, s.r, s.g, s.b, s.a, s.type, s.seed, k, s.ground);
  }
  const Bo = FX.bolts;
  for (let i = Bo.length - 1; i >= 0; i--) {
    const b = Bo[i]; b.life -= dt; if (b.life <= 0) { swapRemove(Bo, i); continue; }
    b.re -= dt;
    if (!b.pts || b.re <= 0) {
      b.re = .045; const n = Math.max(3, Math.round(Math.hypot(b.b[0] - b.a[0], b.b[1] - b.a[1], b.b[2] - b.a[2]) / .45)), pts = [];
      for (let k = 0; k <= n; k++) { const u = k / n, j = Math.sin(u * PI) * .34; pts.push([lerp(b.a[0], b.b[0], u) + frr(-j, j), lerp(b.a[1], b.b[1], u) + frr(-j, j), lerp(b.a[2], b.b[2], u) + frr(-j, j)]); }
      b.pts = pts; b.fork = frnd() < .7 ? Math.floor(frr(1, n - 1)) : -1; b.fd = [frr(-1, 1), frr(-.2, .8), frr(-1, 1)];
    }
    const k = b.life / b.max, c = b.col, w = b.width * (.5 + .5 * k);
    for (let j = 0; j < b.pts.length - 1; j++) { const p = b.pts[j], q = b.pts[j + 1]; SG.push(p[0], p[1], p[2], w, q[0], q[1], q[2], w, c[0] * 4, c[1] * 4, c[2] * 4, k); SG.push(p[0], p[1], p[2], w * 3.5, q[0], q[1], q[2], w * 3.5, c[0], c[1], c[2], k * .35); }
    if (b.fork > 0) { const p = b.pts[b.fork]; SG.push(p[0], p[1], p[2], w * .7, p[0] + b.fd[0] * .7, p[1] + b.fd[1] * .7, p[2] + b.fd[2] * .7, w * .2, c[0] * 3, c[1] * 3, c[2] * 3, k); }
  }
  updateFires(dt, t); updateSpellFX(dt, t); updateSnuffs(dt); updateBossIn(dt);
  const calm = G.phase === 'play' && !G.spawning && !G.mons.length;
  if (calm && !FX.calm) FX.decals.fadeAll(4.5);
  FX.calm = calm;
  FX.decals.update(dt);
}
function endFX() { FX.add.end(); FX.alpha.end(); FX.segs.end(); }
function clearFX() { for (const o of FX.lit) o.alive = false; FX.lit.length = 0; FX.bossIn.length = 0; FX.meteors.length = 0; FX.novas.length = 0; FX.snuffs.length = 0; FX.parts.length = 0; FX.smokes.length = 0; FX.timed.length = 0; FX.bolts.length = 0; for (const f of FX.fires) f.alive = false; FX.fires.length = 0; FX.scorch.length = 0; FX.decals.clear(); }

// ---- Camera shake, hit-stop and flash ----------------------------------------------------------------
// shake(amount): adds trauma that decays smoothly. ~.2 shell, ~.5 sapper, ~1 boss stomp; the total is capped
// and repeated calls saturate rather than stack. Turned off by prefers-reduced-motion.
const SHAKE_CAP = 1.25;
function shake(a) {
  if (!(a > 0) || !FX.shakeK) return;
  FX.shake = Math.min(SHAKE_CAP, FX.shake + a * (1 - FX.shake / (SHAKE_CAP + .15)));
}
// hitStop(seconds, flash): freezes simulation time for a moment (step() scales dt down while G.hitstop > 0,
// counted in the caller's fixed step, so record.js stays deterministic) and briefly brightens the frame.
function hitStop(sec, flash = 0) {
  G.hitstop = Math.max(G.hitstop || 0, Math.min(.09, sec));
  if (flash > 0) FX.flash = Math.min(1, Math.max(FX.flash, flash * FX.flashK));
}
// Runs on real (unscaled) time so the shake keeps moving through hit-stop and slow motion.
function updateShake(rdt) {
  FX.shakeT += rdt; FX.shake = Math.max(0, FX.shake - rdt * (1.5 + FX.shake * .8)); FX.flash = Math.max(0, FX.flash - rdt * 7);
  const t = FX.shakeT, a = Math.pow(FX.shake, 1.3) * .32 * FX.shakeK;
  FX.shakeX = a ? (n1(t * 23, 7) * .8 + n1(t * 41, 3) * .2) * a : 0; FX.shakeY = a ? (n1(t * 27, 9) * .8 + n1(t * 47, 5) * .2) * a : 0;
}

// ---- Burning ground ----------------------------------------------------------------------------------
// FX.groundFire(x, z, r, seconds) -> handle. A patch of flames with embers, smoke, a ground glow, a pooled
// torch light (no new lights) and a scorch decal left behind. Cheap: a few sprites per patch, so 10-20 at
// once is fine. The handle's x/z can be moved, and setting handle.life = 0 puts it out.
// At most FIRE_MAX burn at once; beyond that the oldest is put out early.
const FIRE_MAX = 24;
FX.groundFire = function (x, z, r = 1, seconds = 4) {
  if (!isFinite(x) || !isFinite(z) || G.phase === 'crumble' || G.phase === 'rise') return null;
  r = clamp(+r || 1, .3, 4); seconds = clamp(+seconds || 4, .3, 120);
  if (FX.fires.length >= FIRE_MAX) { let o = null; for (const f of FX.fires) if (f.life > .6 && (!o || f.age > o.age)) o = f; if (o) o.life = .6; else return null; }
  const gy = FX.groundAt(x, z);
  const f = { x, z, r, life: seconds, age: 0, seed: frnd() * 100, acc: frnd(), sacc: frnd(), n: clamp(Math.round(1.6 + r * r * 1.5), 2, 7), alive: true, lI: 0, lx: x, ly: gy + .6, lz: z, lCol: 0xff7a2a, lseed: frnd() * 9 };
  let near = false; for (const q of FX.scorch) if (dist2(q[0], q[1], x, z) < (r * .7) * (r * .7) && G.t - q[2] < 30) { near = true; break; }
  if (!near) { FX.decals.add(FX.groundAt, x, z, r * 1.2, .018, .014, .012, .88, seconds + 60); FX.scorch.push([x, z, G.t]); if (FX.scorch.length > 24) FX.scorch.shift(); }
  fxTimed(4, x, gy + .14, z, r * 2.6, r * 2.6, 1.8, .8, .25, .6, .35, { ground: true });
  FX.fires.push(f); return f;
};
function updateFires(dt, t) {
  const A = FX.add, F = FX.fires, groundAt = FX.groundAt;
  for (let i = F.length - 1; i >= 0; i--) {
    const f = F[i]; f.life -= dt; f.age += dt;
    if (f.life <= 0 || !f.alive) { f.alive = false; f.lI = 0; swapRemove(F, i); continue; }
    const on = sat(f.age / .35) * sat(f.life / .6), fl = .85 + .15 * n1(t * 7 + f.seed, f.seed), gy = groundAt(f.x, f.z), r = f.r;
    A.push(f.x, gy + .13, f.z, r * 3.2, r * 3.2, 0, 0, 1.2, .42, .08, .5 * on * fl, 2, 0, 0, 1);
    A.push(f.x, gy + .14, f.z, r * 2.1, r * 2.1, f.seed, 0, .95, .55, .32, .75 * on, 3, f.seed, .3 + .05 * Math.sin(t * 1.7 + f.seed), 1);
    A.push(f.x, gy + .6, f.z, r * 2.6, r * 2.2, 0, 0, 1.0, .4, .1, .14 * on * fl, 2, 0, 0, 0);
    for (let k = 0; k < f.n; k++) {
      const u = (k + .5) / f.n, rad = r * .62 * Math.sqrt(u), ang = k * 2.39996 + f.seed, px = f.x + Math.cos(ang) * rad, pz = f.z + Math.sin(ang) * rad;
      const cyc = (t * (.8 + .21 * ((k * 7) % 5)) + k * .37 + f.seed) % 1, lick = Math.pow(Math.sin(cyc * PI), .6);
      const s = (.5 + .34 * Math.sqrt(r)) * (1.1 - .4 * Math.sqrt(u)) * (.5 + .5 * lick) * on;
      if (s < .04) continue;
      A.push(px, groundAt(px, pz) - s * .05, pz, s * 1.45, s * 1.8, 0, 1, 2.0, 1.4, .9, on, 1, f.seed + k * 3.7, 0, 0);
    }
    f.acc += dt * (1.5 + 3 * r) * on;
    while (f.acc >= 1) { f.acc -= 1; const a = frnd() * TAU, d = Math.sqrt(frnd()) * r * .8; fxPart(f.x + Math.cos(a) * d, gy + frr(.1, .5), f.z + Math.sin(a) * d, frr(-.3, .3), frr(.9, 2.2), frr(-.3, .3), frr(.7, 1.8), frr(.045, .08), frr(1.8, 3.2), frr(.7, 1.3), .22, { drag: .3, wob: 1, rise: .3 }); }
    f.sacc += dt * (.35 + .4 * r) * on;
    while (f.sacc >= 1) { f.sacc -= 1; fxSmoke(f.x + frr(-.4, .4) * r, gy + .5 + r * .3, f.z + frr(-.4, .4) * r, frr(-.15, .15), frr(.7, 1.3), frr(-.15, .15), frr(2, 3.6), .35 + r * .25, .7 + r * .5, .14, .12, .12, .26, { drag: .3, rise: .12 }); }
    f.lx = f.x; f.ly = gy + .55 + r * .2; f.lz = f.z; f.lI = (16 + 9 * r) * on * fl;
  }
}

// ---- Elite auras -------------------------------------------------------------------------------------
// m.elite = 'burning' | 'shielded' | 'hasted' | 'splitting'. The body gets a coloured rim from the instanced
// material (ELITE_CODE is packed into the flash attribute in drawMonster); drawElite adds a few sprites.
// An Echo ghost (m.echo, code 5 in the shader: see-through bands, pale cold rim) gets a cold glow and a wisp trail.
const ELITE_CODE = { burning: 1, shielded: 2, hasted: 3, splitting: 4 };
function drawElite(m, t) {
  if (!(m.vis || m.fly) || m.dead) return;
  if (m.echo) { drawEcho(m, t); return; }
  const e = m.elite, A = FX.add, sc = m.scale / (m.def.scale || 1), top = m.def.top * sc, R0 = Math.max(.32, m.rad * 1.5), cy = m.y + top * .5, sd = (m.lseed || 0) * 7, dt = FX.dt;
  if (e === 'burning') {
    const fl = .85 + .15 * n1(t * 9 + sd, sd), lx = Math.cos(m.yaw) * R0 * .32, lz = -Math.sin(m.yaw) * R0 * .32;
    A.push(m.x + lx, m.y + top * .12, m.z + lz, R0 * .95, R0 * 1.55, 0, 1, 3.3, 3.3, 3.3, .9, 1, sd, 0, 0);
    A.push(m.x - lx, m.y + top * .38, m.z - lz, R0 * .8, R0 * 1.35, 0, 1, 3.3, 3.3, 3.3, .85, 1, sd + 5.3, 0, 0);
    A.push(m.x, cy, m.z, R0 * 4, R0 * 4, 0, 0, 1.0, .42, .1, .2 * fl, 2, 0, 0, 0);
    if (frnd() < dt * 1.6) fxSmoke(m.x, m.y + top * .9, m.z, frr(-.1, .1), frr(.6, 1), frr(-.1, .1), frr(1, 1.8), .22 + R0 * .2, .5, .12, .11, .11, .3, { drag: .4, rise: .1 });
    if (frnd() < dt * 6) fxPart(m.x + frr(-.6, .6) * R0, m.y + frr(.2, 1) * top, m.z + frr(-.6, .6) * R0, frr(-.3, .3), frr(.8, 1.8), frr(-.3, .3), frr(.5, 1.1), frr(.04, .07), frr(2, 3.2), frr(.8, 1.2), .2, { drag: .4, wob: 1, rise: .3 });
  } else if (e === 'shielded') {
    const hit = m.flash || 0, d = Math.max(top * 1.02, m.rad * 2.8);
    A.push(m.x, cy, m.z, d, d, 0, 0, .35 + hit, .62 + hit, 1.45 + hit * .5, .5 + hit * .9, 8, sd, 0, 0);
    if (hit > .6 && frnd() < .5) fxSparks(m.x, cy, m.z, 3, 2.4, 1.2, 1.8, 3, { size: .05, grav: 3 });
  } else if (e === 'hasted') {
    const fx = Math.sin(m.yaw), fz = Math.cos(m.yaw), lx = fz, lz = -fx, SG = FX.segs, mv = Math.max(.35, m.mv || 0);
    for (let k = 0; k < 3; k++) {
      const h = m.y + top * (.22 + .25 * k), o = (k - 1) * m.rad * .8, len = (.55 + .5 * (.5 + .5 * Math.sin(t * 13 + k * 2.1 + sd))) * (.6 + R0) * mv;
      const ax = m.x - fx * m.rad * .6 + lx * o, az = m.z - fz * m.rad * .6 + lz * o;
      SG.push(ax, h, az, .045, ax - fx * len, h, az - fz * len, .005, 1.6, 1.25, .3, .6);
    }
    A.push(m.x, cy, m.z, R0 * 3.2, R0 * 3.2, 0, 0, .9, .75, .15, .16, 2, 0, 0, 0);
  } else if (e === 'splitting') {
    const pu = .5 + .5 * Math.sin(t * 4.2 + sd), age = (t * .8 + sd) % 1;
    A.push(m.x, m.y + .1, m.z, R0 * 3.4, R0 * 3.4, 0, 0, .5, 2.2, .45, 1, 4, 0, age, 1);
    A.push(m.x, cy, m.z, R0 * 3.6, R0 * 3.6, 0, 0, .3, 1.0, .25, .1 + .14 * pu, 2, 0, 0, 0);
    if (frnd() < dt * 3) fxPart(m.x + frr(-.5, .5) * R0, m.y + top * frr(.3, .9), m.z + frr(-.5, .5) * R0, 0, frr(-.2, .3), 0, frr(.4, .8), frr(.04, .07), .5, 2.2, .45, { grav: 3, drag: .5 });
  }
}

function drawEcho(m, t) {
  const A = FX.add, sc = m.scale / (m.def.scale || 1), top = m.def.top * sc, R0 = Math.max(.3, m.rad * 1.4), sd = (m.lseed || 0) * 7, dt = FX.dt || 0;
  const fk = .75 + .25 * Math.sin(t * 11 + sd) * Math.sin(t * 2.3 + sd);
  A.push(m.x, m.y + top * .5, m.z, R0 * 3.4, R0 * 3.8, 0, 0, .3, .55, 1.15, .17 * fk, 2, 0, 0, 0);
  A.push(m.x, m.y + .06, m.z, R0 * 2.6, R0 * 2.6, 0, 0, .25, .45, 1, .22, 2, 0, 0, 0);
  // The trail: cold motes left behind where it walked, drifting up and fading.
  if (frnd() < dt * (DRAW.crowd ? 7 : 14)) fxPart(m.x + frr(-.5, .5) * R0, m.y + top * frr(.1, .8), m.z + frr(-.5, .5) * R0, frr(-.1, .1), frr(.2, .55), frr(-.1, .1), frr(.6, 1.2), frr(.035, .06), .55, .95, 2.1, { drag: 1.2, wob: 1 });
}

// ---- Spells ------------------------------------------------------------------------------------------
// Draw only: the gameplay side (castSpell) deals the damage. Both are cheap: instanced pieces from KIT.meteor /
// KIT.ice (one draw call each while visible), sprites, decals, a pooled torch light (FX.lit) and one flash.
// FX.meteor(x, z, r, fall = .62) -> { delay }: a burning boulder falls from the sky for `fall` seconds, then a big
// impact: fireball, shock ring, flash, shake, flung rubble and a smoking crater that glows for a few seconds.
// The gameplay side applies the damage `fall` (returned as delay) seconds after the call.
const FX_METEOR_FALL = .62, RIM_TINT = [.34, .3, .28];
FX.meteor = function (x, z, r = 2.5, fall = FX_METEOR_FALL) {
  if (!isFinite(x) || !isFinite(z) || G.phase === 'crumble' || G.phase === 'rise') return null;
  r = clamp(+r || 2.5, .8, 6); fall = clamp(+fall || FX_METEOR_FALL, .3, 2);
  const gy = FX.groundAt(x, z), sy = Math.sin(CAM.yaw), cy = Math.cos(CAM.yaw), sx = x - cy * 6.5 - sy * 2, sz = z + sy * 6.5 - cy * 2;
  const m = { x, z, r, gy, sx, sy: gy + 21, sz, t: 0, T: fall, hit: false, crater: 0, seed: frnd() * 100, acc: 0, alive: true, lI: 0, lx: sx, ly: gy + 21, lz: sz, lCol: 0xff8a3a, lseed: frnd() * 9, px: sx, py: gy + 21, pz: sz };
  FX.meteors.push(m); FX.lit.push(m);
  fxTimed(4, x, gy + .1, z, r * 2.4, r * 2.4, 1.6, .5, .12, .55, fall, { ground: true });
  return { delay: fall };
};
// FX.frostNova(x, z, r, seconds = 3): an ice ring sweeps out, frost crystals grow from the ground where it passes
// and melt after `seconds`, a frost stain fades, cold mist rolls out and a cold light lingers.
FX.frostNova = function (x, z, r = 3, secs = 3) {
  if (!isFinite(x) || !isFinite(z) || G.phase === 'crumble' || G.phase === 'rise') return null;
  r = clamp(+r || 3, .8, 7); secs = clamp(+secs || 3, .6, 12);
  const gy = FX.groundAt(x, z), n = clamp(Math.round(r * r * 1.6), 8, 30), shards = [];
  for (let i = 0; i < n; i++) { const a = i * 2.39996 + frnd() * .6, d = r * (.18 + .82 * Math.sqrt((i + frnd()) / n)), px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; shards.push({ x: px, z: pz, y: FX.groundAt(px, pz), at: d / r * .32, s: frr(1.1, 2.0) * (1.15 - .35 * d / r), yaw: frnd() * TAU, tx: frr(-.35, .35), tz: frr(-.35, .35), end: secs * frr(.8, 1.05) }); }
  const o = { x, z, r, gy, t: 0, T: secs, shards, alive: true, lI: 0, lx: x, ly: gy + 1.2, lz: z, lCol: 0x8fd0ff, lseed: frnd() * 9, acc: 0 };
  FX.novas.push(o); FX.lit.push(o);
  lightFlash(x, gy + 1.6, z, 0x9fd8ff, 900, .5, r * 4 + 8);
  fxTimed(4, x, gy + .12, z, r * 2.5, r * 2.5, .8, 1.5, 2.6, 1, .5, { ground: true });
  fxTimed(4, x, gy + .14, z, r * 2.1, r * 2.1, .5, 1.0, 1.8, .8, .8, { ground: true });
  fxTimed(5, x, gy + .9, z, r * 1.8, r * 1.8, .9, 1.5, 2.4, 1, .22);
  fxTimed(2, x, gy + .5, z, r * 3.2, r * 2.2, .3, .6, 1.1, .5, .6);
  FX.decals.add(FX.groundAt, x, z, r * 1.2, .8, .9, 1.0, .5, secs + 1.2, 0);
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + frnd() * .3, s = r * frr(1.1, 1.8); fxSmoke(x + Math.cos(a) * .4, gy + frr(.1, .4), z + Math.sin(a) * .4, Math.cos(a) * s, frr(.1, .4), Math.sin(a) * s, frr(1.2, 2.2), frr(.45, .8), 1.4, .78, .88, 1.0, .42, { drag: 2.2 }); }
  for (let i = 0; i < 26; i++) { const a = frnd() * TAU, s = frr(2, 6.5); fxPart(x, gy + frr(.2, 1), z, Math.cos(a) * s, frr(1, 4), Math.sin(a) * s, frr(.4, .9), frr(.04, .07), .9, 1.5, 2.4, { grav: 4, drag: 1.2 }); }
  shake(.25);
  return o;
};
// FX.snuff(x, z, r, seconds = 4): the Hollow Herald puts out the lights. A dark ring sweeps out from (x, z) to r
// with a thin cold edge; every tower light, lantern flame and spotlight the ring passes over drops to a faint
// glow (a puff of black smoke from each tower as it goes out), the ground under it stays dim, and the lights come
// back over the last second. Looks only: the gameplay side (MON.herald) decides what being snuffed does.
// snuffMul(x, z) is the light left at a point (1 = untouched, down to .12). Returns the handle, or null.
const SNUFF_SWEEP = .6;
FX.snuff = function (x, z, r = 5, secs = 4) {
  if (!isFinite(x) || !isFinite(z) || !G.B || G.phase === 'crumble' || G.phase === 'rise') return null;
  r = clamp(+r || 5, 1, 14); secs = clamp(+secs || 4, 1.2, 20);
  const gy = FX.groundAt(x, z), puffs = [];
  for (const e of LT.emitters) if (e && e.alive) { const d = Math.hypot(e.x - x, e.z - z); if (d < r) puffs.push({ x: e.x, y: e.y, z: e.z, at: SNUFF_SWEEP * Math.pow(d / r, 1 / .6) }); }
  const o = { x, z, r, gy, t: 0, T: secs, puffs, seed: frnd() * 50 };
  if (FX.snuffs.length >= 4) FX.snuffs.shift();
  FX.snuffs.push(o);
  fxTimed(4, x, gy + .14, z, r * 2.15, r * 2.15, .2, .27, .6, .45, SNUFF_SWEEP * 1.3, { ground: true });
  fxTimed(5, x, gy + 1.2, z, 2.2, 2.2, .4, .55, 1.2, .6, .25);
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + frnd() * .4, s = r / SNUFF_SWEEP * frr(.5, .8); fxSmoke(x + Math.cos(a) * .4, gy + frr(.1, .5), z + Math.sin(a) * .4, Math.cos(a) * s, frr(.1, .5), Math.sin(a) * s, frr(.8, 1.4), frr(.5, .8), 1.2, .02, .02, .035, .6, { drag: 2.6 }); }
  return o;
};
function snuffMul(x, z) {
  let m = 1;
  for (const s of FX.snuffs) {
    const u = Math.min(1, s.t / SNUFF_SWEEP), R = s.r * Math.pow(u, .6), d = Math.hypot(x - s.x, z - s.z);
    if (d > R + .01) continue;
    const k = sat((R - d) / .8 + .25) * sat((s.T - s.t) / .9);
    m = Math.min(m, 1 - .88 * k);
  }
  return m;
}
function updateSnuffs(dt) {
  const L = FX.snuffs, AL = FX.alpha;
  for (let i = L.length - 1; i >= 0; i--) {
    const s = L[i]; s.t += dt; if (s.t >= s.T) { L.splice(i, 1); continue; }
    const u = Math.min(1, s.t / SNUFF_SWEEP), R = s.r * Math.pow(u, .6), fin = sat((s.T - s.t) / .9);
    // The sweeping ring: flat black blots along the front, fading as it reaches the edge.
    if (u < 1) {
      const n = clamp(Math.round(TAU * R / .6), 6, 44), a0 = s.seed + s.t * .7, al = .9 * (1 - u * u * u);
      for (let k = 0; k < n; k++) { const a = a0 + k / n * TAU, px = s.x + Math.cos(a) * R, pz = s.z + Math.sin(a) * R; AL.push(px, FX.groundAt(px, pz) + .16, pz, 1.7, 1.7, a, 0, 0, 0, .002, al, 0, s.seed + k * 3.1, .3, 1); }
    }
    // The dimmed ground inside, while it lasts.
    AL.push(s.x, s.gy + .12, s.z, R * 2.1, R * 2.1, s.seed, 0, 0, 0, .002, .42 * fin, 0, s.seed, .2, 1);
    for (const p of s.puffs) if (p.at >= 0 && s.t >= p.at) {
      p.at = -1;
      for (let k = 0; k < 4; k++) fxSmoke(p.x + frr(-.1, .1), p.y + frr(0, .2), p.z + frr(-.1, .1), frr(-.2, .2), frr(.5, 1.1), frr(-.2, .2), frr(1, 1.8), frr(.25, .4), .7, .006, .006, .01, .7, { drag: 1, rise: .2 });
      for (let k = 0; k < 5; k++) fxPart(p.x, p.y + .1, p.z, frr(-.6, .6), frr(.3, 1.2), frr(-.6, .6), frr(.3, .6), .04, 1.6, .7, .25, { drag: 1.5 });
    }
  }
}
const _spM = new THREE.Matrix4(), _spQ = new THREE.Quaternion(), _spV = new THREE.Vector3(), _spS = new THREE.Vector3(), _spE = new THREE.Euler();
function fxMeteorImpact(m) {
  const { x, z, r, gy } = m, sc = r / 2.2;
  m.hit = true; m.crater = 7;
  lightFlash(x, gy + 2.2, z, 0xff8a40, 600 * sc, .6, 18 + r * 4);
  fxTimed(5, x, gy + .8, z, r * 2.1, r * 2.1, 2.2, 1.1, .35, .7, .12);
  fxTimed(4, x, gy + .12, z, r * 4.2, r * 4.2, 2.0, 1.0, .35, 1, .55, { ground: true });
  fxTimed(4, x, gy + .1, z, r * 2.6, r * 2.6, 1.4, .6, .2, .8, .4, { ground: true });
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + frnd(), d = r * frr(.25, .5); fxTimed(3, x + Math.cos(a) * d, gy + frr(.3, 1) * sc, z + Math.sin(a) * d, r * frr(.55, .8), r * frr(.55, .8), 2.0, 1.05, .38, 1, frr(.4, .6), { grow: 1.3 }); }
  fxTimed(3, x, gy + 1.4 * sc, z, r * .8, r * 1.1, 2.0, 1.0, .35, 1, .5, { grow: .9 });
  m.rim = []; for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + frnd() * .5, d = r * frr(.42, .58), px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; m.rim.push([px, FX.groundAt(px, pz), pz, frr(1.4, 2.4) * Math.min(1.3, sc), frnd() * TAU]); }
  fxSparks(x, gy + .4, z, Math.round(30 * Math.min(1.6, sc)), 11 * Math.min(1.4, sc), 3.2, 1.6, .45, { size: .09, life: 1.4 });
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, s = r * frr(1.6, 2.6); fxSmoke(x + Math.cos(a) * r * .3, gy + .2, z + Math.sin(a) * r * .3, Math.cos(a) * s, frr(.2, .8), Math.sin(a) * s, frr(1.4, 2.6), frr(.6, 1) * sc, 1.6 * sc, .3, .27, .24, .55, { drag: 2.4 }); }
  for (let i = 0; i < 6; i++) fxSmoke(x + frr(-.5, .5), gy + 1 + i * .5, z + frr(-.5, .5), frr(-.2, .2), frr(1.5, 2.6), frr(-.2, .2), frr(2.6, 4), .9 * sc, 2 * sc, .13, .12, .12, .6, { drag: .8, rise: .3 });
  FX.decals.add(FX.groundAt, x, z, r * 1.25, .012, .01, .009, .95, 90);
  FX.decals.add(FX.groundAt, x, z, r * .7, .04, .02, .012, .9, 60);
  const nd = Math.round(8 + 4 * sc);
  for (let i = 0; i < nd; i++) { const a = frnd() * TAU, s = frr(.6, 1.5) * sc, k = frr(1, 1.9) * Math.min(1.4, sc); _spM.compose(_spV.set(x + Math.cos(a) * .4, gy + .3, z + Math.sin(a) * .4), _spQ.set(frr(-1, 1), frr(-1, 1), frr(-1, 1), 1).normalize(), _spS.set(k, k, k)); addDebris(KIT.rubble, _spM, i & 1 ? [.42, .36, .32] : [.3, .26, .24], Math.cos(a) * s * 3.4, frr(4, 9), Math.sin(a) * s * 3.4, frr(4, 10), frr(5, 8), { extra: 1 }); }
  for (let i = 0; i < 3; i++) { const a = frnd() * TAU, k = frr(.35, .5); _spM.compose(_spV.set(x, gy + .5, z), _spQ.set(frr(-1, 1), frr(-1, 1), frr(-1, 1), 1).normalize(), _spS.set(k, k, k)); addDebris(KIT.meteor, _spM, null, Math.cos(a) * frr(2, 4), frr(3, 6), Math.sin(a) * frr(2, 4), frr(3, 7), frr(5, 7), { extra: 1 }); }
  shake(1.0); hitStop(.05, .2);
}
function updateSpellFX(dt, t) {
  const A = FX.add, SG = FX.segs, M = FX.meteors;
  for (let i = M.length - 1; i >= 0; i--) {
    const m = M[i]; m.t += dt;
    if (!m.hit) {
      const u = Math.min(1, m.t / m.T), e = u * u * (.4 + .6 * u), x = lerp(m.sx, m.x, e), y = lerp(m.sy, m.gy + .4, e), z = lerp(m.sz, m.z, e);
      const vx = x - m.px, vy = y - m.py, vz = z - m.pz, l = Math.hypot(vx, vy, vz) || 1, k = .55 + .35 * Math.min(1, m.r / 3);
      _spE.set(m.t * 7, m.t * 5, 0); _spQ.setFromEuler(_spE); _spM.compose(_spV.set(x, y, z), _spQ, _spS.set(k, k, k)); KIT.meteor.put(_spM, .6, null);
      A.push(x, y, z, 2.2 * k, 2.2 * k, 0, 0, 2.6, 1.2, .35, 1, 2, 0, 0, 0);
      A.push(x - vx / l * .2, y - vy / l * .2, z - vz / l * .2, 1.4 * k, 1.4 * k, m.seed, 0, 1, 1, 1, 1, 3, m.seed + m.t * 3, .25, 0);
      if (l > 1e-3) { SG.push(x, y, z, .55 * k, x - vx / l * 5, y - vy / l * 5, z - vz / l * 5, .02, 2.4, .9, .25, .9); SG.push(x, y, z, 1.3 * k, x - vx / l * 3, y - vy / l * 3, z - vz / l * 3, .1, .8, .25, .06, .5); }
      m.acc += dt * 60;
      while (m.acc >= 1) { m.acc -= 1; const q = frnd(); fxPart(lerp(m.px, x, q) + frr(-.2, .2), lerp(m.py, y, q) + frr(-.2, .2), lerp(m.pz, z, q) + frr(-.2, .2), frr(-.8, .8), frr(-.4, .8), frr(-.8, .8), frr(.3, .8), frr(.06, .12), 3, 1.3, .3, { drag: 1.5, rise: .5 }); if (q < .3) fxSmoke(x, y, z, frr(-.2, .2), frr(0, .4), frr(-.2, .2), frr(1, 1.8), .35, .9, .16, .14, .13, .45, { drag: 1, rise: .2 }); }
      m.px = x; m.py = y; m.pz = z; m.lx = x; m.ly = y; m.lz = z; m.lI = 60;
      if (u >= 1) fxMeteorImpact(m);
      continue;
    }
    m.crater -= dt; const k = Math.max(0, Math.min(1, m.crater / 3)), fl = .8 + .2 * n1(t * 6 + m.seed, m.seed);
    if (m.crater <= 0) { m.alive = false; m.lI = 0; swapRemove(M, i); continue; }
    A.push(m.x, m.gy + .12, m.z, m.r * 1.8, m.r * 1.8, 0, 0, 1.5, .5, .12, .8 * k * fl, 2, 0, 0, 1);
    const sink = Math.max(0, .8 - m.crater) * .3;
    for (const q of m.rim) { _spQ.setFromAxisAngle(_upv, q[4]); _spM.compose(_spV.set(q[0], q[1] - sink, q[2]), _spQ, _spS.set(q[3], q[3] * .7, q[3])); KIT.rubble.put(_spM, 0, RIM_TINT); }
    A.push(m.x, m.gy + .13, m.z, m.r * 1.1, m.r * 1.1, m.seed, 0, .9, .45, .25, .7 * k, 3, m.seed, .45 + .1 * (1 - k), 1);
    if (frnd() < dt * 9 * k) { const a = frnd() * TAU, d = Math.sqrt(frnd()) * m.r * .5; fxPart(m.x + Math.cos(a) * d, m.gy + .15, m.z + Math.sin(a) * d, frr(-.2, .2), frr(.8, 1.8), frr(-.2, .2), frr(.6, 1.3), frr(.04, .07), 2.6, 1.1, .2, { drag: .4, wob: 1, rise: .3 }); }
    if (frnd() < dt * 2.5 * k) fxSmoke(m.x + frr(-.5, .5) * m.r * .4, m.gy + .3, m.z + frr(-.5, .5) * m.r * .4, frr(-.1, .1), frr(.5, 1), frr(-.1, .1), frr(2, 3.4), .4, 1.1, .15, .14, .14, .3, { drag: .4, rise: .1 });
    m.lx = m.x; m.ly = m.gy + .8; m.lz = m.z; m.lI = 30 * k * fl;
  }
  const N = FX.novas;
  for (let i = N.length - 1; i >= 0; i--) {
    const o = N[i]; o.t += dt;
    if (o.t >= o.T + .7) { o.alive = false; o.lI = 0; swapRemove(N, i); continue; }
    const fade = sat((o.T + .7 - o.t) / 1.2), front = Math.min(1, o.t / .32);
    A.push(o.x, o.gy + .1, o.z, o.r * 2.6, o.r * 2.6, 0, 0, .35, .65, 1.1, .3 * fade, 2, 0, 0, 1);
    if (o.t < .6) A.push(o.x, o.gy + .11, o.z, o.r * 2.2 * front + .5, o.r * 2.2 * front + .5, 0, 0, .9, 1.5, 2.4, .9 * (1 - o.t / .6), 4, 0, .62, 1);
    for (const s of o.shards) {
      const age = o.t - s.at; if (age <= 0) continue;
      const grow = age < .14 ? easeOutBack(age / .14) : 1, melt = sat((s.end - age) / .6), k = s.s * grow * (melt > 0 ? .35 + .65 * melt : 0);
      if (k < .02) continue;
      _spE.set(s.tx, s.yaw, s.tz); _spQ.setFromEuler(_spE); _spM.compose(_spV.set(s.x, s.y - (1 - melt) * .25 * s.s, s.z), _spQ, _spS.set(k, k * (.7 + .3 * melt), k)); KIT.ice.put(_spM, age < .2 ? 1 - age / .2 : 0, null);
      if (!s.burst) { s.burst = 1; fxSparks(s.x, s.y + .2, s.z, 2, 2.2, .9, 1.4, 2.2, { size: .05, grav: 5 }); }
    }
    o.acc += dt * 6 * fade;
    while (o.acc >= 1) { o.acc -= 1; const a = frnd() * TAU, d = Math.sqrt(frnd()) * o.r; fxPart(o.x + Math.cos(a) * d, o.gy + frr(.1, .9), o.z + Math.sin(a) * d, 0, frr(.1, .4), 0, frr(.5, 1), frr(.03, .055), 1.1, 1.6, 2.4, { drag: .8, wob: 1 }); }
    o.lI = (o.t < .4 ? 70 : 34) * fade;
  }
  for (let i = FX.lit.length - 1; i >= 0; i--) if (!FX.lit[i].alive) swapRemove(FX.lit, i);
}

// Ice around the feet of a frozen monster (m.frozen seconds left): two crystal clusters that grow in and sink away.
function drawFrozen(m, sc) {
  if (!(m.vis || m.fly) || m.dead || m.fly) return;
  const k = Math.min(1, m.frozen * 3) * Math.max(.5, m.rad * 2.6) * Math.min(1.6, sc || 1), sd = (m.lseed || 0) * 13;
  for (let i = 0; i < 2; i++) {
    const a = sd + i * 2.6 + m.yaw, d = m.rad * .55, kk = k * (i ? .8 : 1.05);
    _spE.set(i ? .35 : -.25, a, i ? -.2 : .3); _spQ.setFromEuler(_spE); _spM.compose(_spV.set(m.x + Math.cos(a) * d, m.y - .05, m.z + Math.sin(a) * d), _spQ, _spS.set(kk, kk, kk)); KIT.ice.put(_spM, 0, null);
  }
}

// ---- Boss entrance -------------------------------------------------------------------------------------
// bossEntrance(m): called once when a boss first steps into view (drawMonster). The ground splits in glowing
// cracks with heaved slabs, a dust ring rolls out, a light flare in the boss's colour, a short flash and shake,
// and the camera is asked to frame the boss for a moment (CAM.ent, read by updateCamera; skipped while the
// player holds the view). Visual only: effects random stream, no hit-stop, so the simulation is unchanged.
const BOSS_GLOW = { giant: [1.2, .95, .6], ogre: [1.3, .8, .45], jotun: [.55, .9, 1.5], queen: [1.1, .45, 1.4], colossus: [1.8, .6, .18], king: [.45, 1.4, 1.15], leviathan: [.4, 1.3, 1.25], herald: [.55, .7, 1.5] };
FX.bossIn = [];
function bossEntrance(m) {
  if (!G.B || G.phase !== 'play') return;
  const x = m.x, z = m.z, gy = FX.groundAt(x, z), c = BOSS_GLOW[m.type] || [1.2, .9, .6], sc = Math.max(1, m.scale || 1), cracks = [], slabs = [];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU + frr(-.35, .35), len = frr(2.2, 3.8), pts = [[x, gy + .13, z]];
    let px = x, pz = z, ang = a;
    for (let k = 1; k <= 4; k++) { ang += frr(-.45, .45); px += Math.cos(ang) * len / 4; pz += Math.sin(ang) * len / 4; pts.push([px, FX.groundAt(px, pz) + .13, pz]); }
    cracks.push(pts);
    for (let k = 1; k <= 3; k++) { const p = pts[k], q = pts[k + 1]; FX.decals.add(FX.groundAt, (p[0] + q[0]) / 2, (p[2] + q[2]) / 2, .42 - k * .07, .015, .012, .012, .8, 7, 0); }
    for (let k = 1; k <= 3; k++) { const p = pts[k]; slabs.push({ x: p[0] + frr(-.2, .2), z: p[2] + frr(-.2, .2), y: p[1], s: frr(1.4, 2.4) * (1.2 - k * .2), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(frr(-.6, .6), frnd() * TAU, frr(-.6, .6))), at: k * .06 }); }
  }
  FX.bossIn.push({ x, z, gy, t: 0, c, cracks, slabs, seed: frnd() * 50 });
  lightFlash(x, gy + 2.5, z, new THREE.Color(Math.min(1, c[0] * .7), Math.min(1, c[1] * .7), Math.min(1, c[2] * .7)).getHex(), 600, .8, 24);
  FX.flash = Math.max(FX.flash, .25 * FX.flashK); shake(.9);
  fxTimed(4, x, gy + .1, z, 9 * sc, 9 * sc, c[0], c[1], c[2], 1, .8, { ground: true });
  fxTimed(4, x, gy + .12, z, 5.5 * sc, 5.5 * sc, c[0] * .8, c[1] * .8, c[2] * .8, .8, .55, { ground: true });
  fxTimed(5, x, gy + 1.4, z, 5, 5, c[0], c[1], c[2], .8, .3);
  for (let i = 0; i < 22; i++) { const a = i / 22 * TAU + frnd() * .2, s = frr(3, 5.5); fxSmoke(x + Math.cos(a) * .8, gy + frr(.1, .4), z + Math.sin(a) * .8, Math.cos(a) * s, frr(.2, .8), Math.sin(a) * s, frr(1.4, 2.4), frr(.6, 1), 1.8, .34, .3, .27, .55, { drag: 2.2 }); }
  for (let i = 0; i < 10; i++) { _spM.compose(_spV.set(x + frr(-.8, .8), gy + .3, z + frr(-.8, .8)), _spQ.set(frr(-1, 1), frr(-1, 1), frr(-1, 1), 1).normalize(), _spS.setScalar(frr(.6, 1.2))); addDebris(KIT.rubble, _spM, [.5, .46, .42], frr(-3, 3), frr(3, 7), frr(-3, 3), frr(4, 10), frr(1.5, 2.6), { extra: 1 }); }
  FX.decals.add(FX.groundAt, x, z, 2.6, .02, .017, .015, .7, 40);
  if (!CAM.man) CAM.ent = { m, t: 0, dur: 1.6 };
  if (UI.bossCard) UI.bossCard(m.type, m.affixName || m.def.name, BOSS_TITLE[m.type]);
}
function updateBossIn(dt) {
  const L = FX.bossIn, A = FX.add, SG = FX.segs;
  for (let i = L.length - 1; i >= 0; i--) {
    const o = L[i]; o.t += dt; if (o.t > 4.5) { swapRemove(L, i); continue; }
    const glow = Math.max(0, 1 - o.t / 2.2), grow = Math.min(1, o.t / .3), c = o.c, sink = Math.max(0, o.t - 3.2) * .5;
    for (const pts of o.cracks) {
      const n = (pts.length - 1) * grow;
      for (let k = 0; k < Math.ceil(n); k++) {
        const a = pts[k], b = pts[k + 1], f = Math.min(1, n - k), bx = a[0] + (b[0] - a[0]) * f, by = a[1] + (b[1] - a[1]) * f, bz = a[2] + (b[2] - a[2]) * f, w = .13 * (1 - k * .2);
        SG.push(a[0], a[1], a[2], w, bx, by, bz, w * .7, c[0] * 1.6, c[1] * 1.6, c[2] * 1.6, glow * (1 - k * .15));
        if (glow > .05) SG.push(a[0], a[1] + .02, a[2], w * 4, bx, by + .02, bz, w * 3, c[0] * .5, c[1] * .5, c[2] * .5, glow * .45);
      }
    }
    for (const s of o.slabs) {
      const u = sat((o.t - s.at) / .18); if (u <= 0) continue;
      const k = s.s * easeOutBack(u) * (o.t > 3.6 ? Math.max(0, 1 - (o.t - 3.6) / .9) : 1);
      _spM.compose(_spV.set(s.x, s.y - .05 - sink * .3, s.z), s.q, _spS.set(k, k * .45, k)); KIT.rubble.put(_spM, 0, RIM_TINT);
    }
    if (glow > 0) A.push(o.x, o.gy + .12, o.z, 4, 4, 0, 0, c[0] * .6, c[1] * .6, c[2] * .6, .5 * glow, 2, 0, 0, 1);
  }
}
