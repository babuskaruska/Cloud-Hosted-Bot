
const R = {
  renderer: null, scene: null, cam: null, canvas: null,
  dw: 2, dh: 2, iw: 2, ih: 2, maxIH: 620, maxPix: 690000, quality: 1, cssW: 2, cssH: 2, safe: [0, 0, 0, 0], lite: 0, opt: !HASH.noopt,
  viewH: 27, fitW: 45, fitTall: 33, shiftY: 0, px: 0.04,
  sub: new THREE.Vector2(), ditherOfs: new THREE.Vector2(),
  focusZ: 60, fade: 0, exposure: 1.0,
  rt: {}, mats: {}, fsScene: null, fsCam: null, fsMesh: null,
  NL: 12, lightPos: [], lightCol: [], tDraw: 0, skipDraw: false, hw: 0, hh: 0, cu0: 0, cv0: 0,
};

const FS_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const GLSL_BAYER = `
float bayer2(vec2 a){ a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a){ return bayer4(0.5 * a) * 0.25 + bayer2(a); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
`;

function fsMat(frag, uniforms, defines) {
  return new THREE.ShaderMaterial({ vertexShader: FS_VERT, fragmentShader: frag, uniforms, defines: Object.assign({}, defines), depthTest: false, depthWrite: false, toneMapped: false });
}

function initRenderer() {
  const canvas = R.canvas = document.getElementById('gl');
  const r = R.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' });
  r.setPixelRatio(1);
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
  r.toneMapping = THREE.NoToneMapping;
  r.setClearColor(new THREE.Color(0.0035, 0.005, 0.011), 1);
  r.info.autoReset = false;
  // Shadow maps are drawn one light at a time, so each tower spotlight draws only the monster batches with parts
  // standing in its light (PartBatch.mask, set by planDraw) and leaves out the rest; the moon and the beacon draw
  // every batch with shadow-casting parts. The shadow pass itself only draws a batch's leading tiers (PartBatch.hook).
  { const sm = r.shadowMap, draw = sm.render, one = [null];
    sm.render = function (lights, scene, cam) {
      if (!lights.length) return;
      if (!R.opt) { draw.call(this, lights, scene, cam); return; }
      for (const l of lights) {
        if (!l.shadow.autoUpdate && !l.shadow.needsUpdate) continue;
        const j = l.isSpotLight ? l.userData.spot : -1;
        for (const b of PartBatch.all) b.mesh.castShadow = b.cast && (j < 0 ? b.n + b.nb > 0 : b.n > 0 && (b.mask >> j & 1) === 1);
        one[0] = l; draw.call(this, one, scene, cam);
      }
    };
  }
  R.scene = new THREE.Scene();
  R.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 220);
  R.scene.add(R.cam);
  for (let i = 0; i < R.NL; i++) { R.lightPos.push(new THREE.Vector3()); R.lightCol.push(new THREE.Vector3()); }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  R.fsScene = new THREE.Scene(); R.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  R.fsMesh = new THREE.Mesh(g, null); R.fsMesh.frustumCulled = false; R.fsScene.add(R.fsMesh);

  const M = R.mats;
  M.atmo = fsMat(`
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor; uniform sampler2D tDepth;
uniform mat4 uInvVP; uniform vec3 uCamDir; uniform vec2 uPx; uniform float uTime;
uniform vec3 uLightPos[${R.NL}]; uniform vec3 uLightCol[${R.NL}];
uniform vec3 uMistAmb; uniform vec4 uMist;
uniform vec3 uAO; uniform float uAOFloor;
uniform vec2 uDither; uniform vec2 uWind;
uniform vec4 uHalo; uniform vec4 uEdge; uniform vec3 uBackTop; uniform vec4 uBack; uniform vec2 uRes; uniform vec4 uEcl; uniform vec4 uMoonC; uniform vec3 uMoonP;
${GLSL_BAYER}
vec3 wpos(vec2 uv, float d){ vec4 p = uInvVP * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return p.xyz / p.w; }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y); }
void main(){
  vec3 col = texture2D(tColor, vUv).rgb;
  float d = texture2D(tDepth, vUv).x;
  if (d < 0.9999) {
    vec3 P = wpos(vUv, d);
    float dr = texture2D(tDepth, vUv + vec2(uPx.x, 0.0)).x, dl = texture2D(tDepth, vUv - vec2(uPx.x, 0.0)).x;
    float du = texture2D(tDepth, vUv + vec2(0.0, uPx.y)).x, dd = texture2D(tDepth, vUv - vec2(0.0, uPx.y)).x;
    vec3 ddx = abs(dr - d) < abs(d - dl) ? wpos(vUv + vec2(uPx.x, 0.0), dr) - P : P - wpos(vUv - vec2(uPx.x, 0.0), dl);
    vec3 ddy = abs(du - d) < abs(d - dd) ? wpos(vUv + vec2(0.0, uPx.y), du) - P : P - wpos(vUv - vec2(0.0, uPx.y), dd);
    vec3 N = normalize(cross(ddx, ddy)); if (dot(N, uCamDir) > 0.0) N = -N;
    // Ambient occlusion, AO_N taps (graphics tier; 0 on Low). None below uAOFloor (the open sea around Stormreach:
    // flat, and a lot of pixels).
#if AO_N > 0
    float occ = 0.0, ang = bayer4(gl_FragCoord.xy + uDither) * 6.2831853;
    if (P.y > uAOFloor) for (int i = 0; i < AO_N; i++) {
      float fi = (float(i) + 0.5) / float(AO_N), a = ang + float(i) * 2.39996;
      vec2 suv = vUv + vec2(cos(a), sin(a)) * uAO.y * sqrt(fi) * uPx;
      vec3 V = wpos(suv, texture2D(tDepth, suv).x) - P;
      float vv = dot(V, V);
      occ += max(0.0, dot(V, N) - 0.035) / (vv + 0.03) * step(vv, uAO.z);
    }
    float ao = clamp(1.0 - occ * uAO.x * (1.0 / float(AO_N)), 0.0, 1.0);
    col *= ao;
#endif
#if MIST > 0 || EDGE > 0
    float n = vn(P.xz * 0.16 + uWind) * 0.65 + vn(P.xz * 0.47 - uWind * 1.7) * 0.35;
#endif
    // Ground mist (none on Ultra; on Low it takes the plain mist colour, not the lanterns' light).
#if MIST > 0
    float tau = min(uMist.z * exp(-(max(P.y, -1.0) - uMist.x) / uMist.y), 1.25) * smoothstep(0.34, 0.86, n) * smoothstep(-2.4, -1.1, P.y);
    float f = 1.0 - exp(-tau);
    if (f > 0.002) {
      vec3 L = uMistAmb;
#if MIST > 1
      vec3 Pm = P + vec3(0.0, 0.35, 0.0);
      for (int i = 0; i < ${R.NL}; i++) { vec3 dv = uLightPos[i] - Pm; L += uLightCol[i] / (dot(dv, dv) + 2.0); }
#else
      L *= 1.6;
#endif
      col = mix(col, L * uMist.w, f);
    }
#endif
    // The slab floats in the dark: its cliffs fade into a low haze below the board's edge (uEdge: haze colour, amount).
#if EDGE > 0
    float ek = smoothstep(16.6, 19.6, max(abs(P.x), abs(P.z))) * smoothstep(-0.6, -8.5, P.y) * uEdge.w;
    col = mix(col, uEdge.rgb * (0.75 + 0.5 * n), ek);
#endif
  } else {
    // The void around the slab, read as a night sky: a glow toward the top, faint drifting haze, pixel stars that
    // twinkle (uBack.z) and, on some lands, an aurora's curtain (uBack.w). uBack.x: the camera's turn (menu arc).
    float sx = vUv.x * uRes.x / uRes.y + uBack.x, hz = vn(vec2(sx * 2.2 + uWind.x * 0.6, vUv.y * 3.0 - uWind.y));
    col += uBackTop * smoothstep(0.2, 1.0, vUv.y) * (0.75 + 0.5 * hz);
    if (uBack.z > 0.0) {
      vec2 sp = floor(vec2(sx * uRes.y, vUv.y * uRes.y) * 0.5); float h = hash12(sp);
      float st = step(0.9955, h) * (0.55 + 0.45 * sin(uTime * (0.8 + h * 30.0) + h * 91.0)) * smoothstep(0.3, 0.85, vUv.y) * (1.0 - 0.7 * hz);
      col += vec3(0.75, 0.82, 1.0) * st * uBack.z * (step(0.9992, h) * 1.6 + 0.35) * (1.0 - 0.7 * uEcl.w);
    }
    if (uBack.w > 0.0) {
      float x = sx * 1.6, t = uTime * 0.05, y0 = 0.6 + 0.16 * vn(vec2(x * 1.4, t)), dy = vUv.y - y0;
      float sheet = smoothstep(-0.025, 0.0, dy) * exp(-max(dy, 0.0) * 6.0) * smoothstep(0.0, 0.25, vn(vec2(x * 2.5 - t * 1.4, 7.0)));
      float rays = 0.45 + 0.55 * vn(vec2(x * 22.0 + t * 6.0, t * 4.0));
      col += mix(vec3(0.05, 0.42, 0.24), vec3(0.24, 0.07, 0.36), smoothstep(0.0, 0.2, dy)) * sheet * rays * uBack.w * (1.0 - 0.6 * uEcl.w);
    }
    // The moon of an Act II night (36-night.js; uMoonC: linear colour, strength; uMoonP: centre in screen heights,
    // radius): a disc with soft maria and a darker limb, a thin glow round it. It hides behind the eclipse's disc.
    if (uMoonC.w > 0.001) {
      vec2 e = (vec2(vUv.x * uRes.x / uRes.y, vUv.y) - uMoonP.xy) / uMoonP.z; float er = length(e);
      if (er < 4.0) {
        float disc = 1.0 - smoothstep(0.94, 1.0, er), limb = sqrt(max(0.0, 1.0 - er * er));
        float mar = vn(e * 2.6 + 3.7) * 0.6 + vn(e * 6.0 + 9.1) * 0.4;
        vec3 mc = uMoonC.rgb * (0.45 + 0.55 * limb) * (1.15 - 0.6 * smoothstep(0.4, 0.7, mar));
        float k = uMoonC.w * (1.0 - uEcl.w);
        col = mix(col, mc, disc * k);
        col += uMoonC.rgb * (0.05 * exp(-max(er - 1.0, 0.0) * 2.2) + 0.03 * exp(-max(er - 1.0, 0.0) * 0.6)) * (1.0 - disc) * k * (1.0 - 0.6 * hz);
      }
    }
    // Eclipse (G.eclA): a black disc (uEcl.xy centre in screen heights, z radius) with a thin bright ring and a
    // streaked pale corona that slowly turns. Sky pixels only, so the slab hides it where it stands in front.
    if (uEcl.w > 0.0) {
      vec2 e = vec2(vUv.x * uRes.x / uRes.y, vUv.y) - uEcl.xy; float er = length(e) / uEcl.z, ea = atan(e.y, e.x);
      float streak = 0.55 + 0.45 * vn(vec2(ea * 2.6 + uTime * 0.03, er * 1.5 - uTime * 0.08)) * vn(vec2(ea * 7.0 - uTime * 0.05, 3.0));
      float out1 = step(1.0, er), cor = exp(-(er - 1.0) * 2.2) * out1 * streak * streak, ring = exp(-abs(er - 1.0) * 42.0) * (0.6 + 1.6 * exp(-abs(ea - 2.2) * 5.0));
      float disc = 1.0 - smoothstep(0.96, 1.0, er);
      col = mix(col, vec3(0.002, 0.002, 0.004) + vec3(0.01, 0.012, 0.02) * (1.0 - er), disc * uEcl.w);
      col += (vec3(0.55, 0.64, 0.85) * cor * 0.6 + vec3(1.3, 1.1, 0.9) * ring * 0.7 + vec3(0.06, 0.08, 0.16) * exp(-er * 0.45)) * uEcl.w;
    }
  }
  // Lantern halos: light scattered in the air between the eye and the surface, around each light that stands in front
  // of what is seen there (a cheap bloom that respects depth). uHalo: x gain, y core size.
#if HALO > 0
  if (uHalo.x > 0.0) {
    vec3 Ph = wpos(vUv, min(d, 0.9999)), H = vec3(0.0);
    for (int i = 0; i < ${R.NL}; i++) {
      vec3 v = uLightPos[i] - Ph; float a = -dot(v, uCamDir), pp = max(dot(v, v) - a * a, 0.0);
      H += uLightCol[i] * (smoothstep(-0.4, 0.8, a) / (pp * pp * 0.15 + pp + uHalo.y));
    }
    col += H * uHalo.x;
  }
#endif
  gl_FragColor = vec4(col, 1.0);
}`, {
    tColor: { value: null }, tDepth: { value: null }, uInvVP: { value: new THREE.Matrix4() }, uCamDir: { value: new THREE.Vector3() }, uPx: { value: new THREE.Vector2() }, uTime: SH.uTime,
    uLightPos: { value: R.lightPos }, uLightCol: { value: R.lightCol }, uMistAmb: { value: new THREE.Vector3(0.05, 0.08, 0.14) }, uMist: { value: new THREE.Vector4(-0.3, 0.42, 0.75, 0.1) },
    uAO: { value: new THREE.Vector3(1.0, 18, 0.7) }, uAOFloor: { value: -1e9 }, uDither: { value: R.ditherOfs }, uWind: { value: new THREE.Vector2() },
    uHalo: { value: new THREE.Vector4(0.016, 0.9, 0.0, 0) }, uEdge: { value: new THREE.Vector4(0.03, 0.04, 0.07, 0.6) },
    uBackTop: { value: new THREE.Vector3() }, uBack: { value: new THREE.Vector4() }, uRes: { value: new THREE.Vector2(1, 1) }, uEcl: { value: new THREE.Vector4() }, uMoonC: { value: new THREE.Vector4() }, uMoonP: { value: new THREE.Vector3(0, 0, 1) },
  }, { AO_N: 10, MIST: 2, EDGE: 1, HALO: 1 });

  M.dof = fsMat(`
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 uPx;
uniform vec4 uDof; uniform vec4 uNear;
uniform vec2 uDither;
${GLSL_BAYER}
float cocAt(float d){ float z = d - uDof.x; return z > 0.0 ? clamp((z - uDof.y) / uDof.z, 0.0, 1.0) * uDof.w : clamp((-z - uNear.x) / uNear.y, 0.0, 1.0) * uDof.w * uNear.z; }
void main(){
  float dc = texture2D(tDepth, vUv).x, cc = cocAt(dc);
  vec3 col = texture2D(tColor, vUv).rgb; float tot = 1.0;
  if (cc < uNear.w) {
    float near = 0.0;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.7853982; vec2 o = vec2(cos(a), sin(a)) * uPx * uDof.w * (mod(float(i), 2.0) < 0.5 ? 0.95 : 0.5);
      float sd = texture2D(tDepth, vUv + o).x; if (sd < dc) near = max(near, cocAt(sd));
    }
    if (near < 0.5) { gl_FragColor = vec4(col, 1.0); return; }
  }
  float rad = 0.75, ang = bayer4(gl_FragCoord.xy + uDither) * 6.2831853;
  for (int i = 0; i < 40; i++) {
    ang += 2.39996323;
    vec2 tc = vUv + vec2(cos(ang), sin(ang)) * uPx * rad;
    float sd = texture2D(tDepth, tc).x, sc = cocAt(sd);
    if (sd > dc) sc = clamp(sc, 0.0, cc * 2.0);
    float m = smoothstep(rad - 0.5, rad + 0.5, sc);
    col += mix(col / tot, texture2D(tColor, tc).rgb, m); tot += 1.0;
    rad += 1.35 / rad; if (rad > uDof.w) break;
  }
  gl_FragColor = vec4(col / tot, 1.0);
}`, { tColor: { value: null }, tDepth: { value: null }, uPx: { value: new THREE.Vector2() }, uDof: { value: new THREE.Vector4(0.3, 0.02, 0.06, 9) }, uNear: { value: new THREE.Vector4(0.05, 0.04, 0.5, 0.25) }, uDither: { value: R.ditherOfs } });

  M.bright = fsMat(`
precision highp float; varying vec2 vUv; uniform sampler2D tColor; uniform vec2 uPx; uniform vec2 uThr;
void main(){
  vec3 c = texture2D(tColor, vUv + uPx * vec2(-0.5, -0.5)).rgb + texture2D(tColor, vUv + uPx * vec2(0.5, -0.5)).rgb + texture2D(tColor, vUv + uPx * vec2(-0.5, 0.5)).rgb + texture2D(tColor, vUv + uPx * vec2(0.5, 0.5)).rgb;
  c *= 0.25; float l = max(c.r, max(c.g, c.b));
  c *= smoothstep(uThr.x, uThr.x + uThr.y, l);
  gl_FragColor = vec4(min(c, vec3(24.0)), 1.0);
}`, { tColor: { value: null }, uPx: { value: new THREE.Vector2() }, uThr: { value: new THREE.Vector2(1.1, 1.6) } });
  M.blur = fsMat(`
precision highp float; varying vec2 vUv; uniform sampler2D tColor; uniform vec2 uDir;
void main(){
  vec3 c = texture2D(tColor, vUv).rgb * 0.227027;
  c += (texture2D(tColor, vUv + uDir * 1.3846).rgb + texture2D(tColor, vUv - uDir * 1.3846).rgb) * 0.316216;
  c += (texture2D(tColor, vUv + uDir * 3.2308).rgb + texture2D(tColor, vUv - uDir * 3.2308).rgb) * 0.070270;
  gl_FragColor = vec4(c, 1.0);
}`, { tColor: { value: null }, uDir: { value: new THREE.Vector2() } });

  M.comp = fsMat(`
precision highp float; varying vec2 vUv;
uniform sampler2D tColor; uniform sampler2D tBloomA; uniform sampler2D tBloomB;
uniform vec4 uGrade;
uniform vec3 uBloom;
uniform vec3 uLift; uniform vec2 uDither; uniform vec2 uRes;
uniform vec3 uShT; uniform vec3 uHiT; uniform float uCon;
uniform vec4 uCine; uniform vec4 uCineK; uniform vec3 uCineC;
${GLSL_BAYER}
vec3 filmic(vec3 x){ x = max(x, 0.0); return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main(){
  vec3 c = texture2D(tColor, vUv).rgb;
#if BLOOM > 1
  c += texture2D(tBloomA, vUv).rgb * uBloom.x + texture2D(tBloomB, vUv).rgb * uBloom.y;
#elif BLOOM > 0
  c += texture2D(tBloomB, vUv).rgb * (uBloom.x * 0.25 + uBloom.y * 0.85);
#endif
  c *= uGrade.x;
#if VIG > 0
  vec2 q = (vUv - 0.5) * vec2(1.0, 0.92);
  float vig = smoothstep(0.9, 0.3, length(q) * 1.25);
  c *= mix(1.0 - uGrade.z, 1.0, vig);
#else
  const float vig = 1.0;
#endif
  // Cinematics (43-cine.js): a ring around the beacon (uCine.xy, radius uCine.z in screen heights). Outside it the
  // land dims to black (uCineK.x); its edge glows (y); inside, warm light floods (z).
  if (uCineK.w > 0.5) {
    vec2 cd = (vUv - uCine.xy) * vec2(uRes.x / uRes.y, 1.0);
    float cr = length(cd), cR = uCine.z, inside = 1.0 - smoothstep(cR * 0.75, cR + 0.04, cr), cl = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(c, vec3(cl) * 0.7, (1.0 - inside) * uCineK.x * 0.6);
    c *= 1.0 - (1.0 - inside) * uCineK.x;
    c += uCineC * exp(-abs(cr - cR) * 26.0) * step(0.001, cR) * uCineK.y * 0.2;
    c *= 1.0 + uCineK.z * inside * uCineC * 0.5;
  }
  c = filmic(c);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  // Split toning per land: the shadows lean one way, the lit parts another (LOOK grade).
  c *= mix(uShT, uHiT, smoothstep(0.02, 0.45, l));
  c = mix(vec3(l), c, uGrade.y);
  c += uLift * (1.0 - smoothstep(0.0, 0.3, l)) * mix(0.55, 1.0, vig);
  c = clamp(pow(c, vec3(1.0 / 2.2)), 0.0, 1.0);
  c = mix(c, c * c * (3.0 - 2.0 * c), uCon) * uGrade.w;
  float b = bayer8(gl_FragCoord.xy + uDither);
  c = floor(c * uBloom.z + b) / uBloom.z;
  gl_FragColor = vec4(c, 1.0);
}`, {
    tColor: { value: null }, tBloomA: { value: null }, tBloomB: { value: null },
    uGrade: { value: new THREE.Vector4(1.0, 0.92, 0.55, 1.0) }, uBloom: { value: new THREE.Vector3(0.35, 0.5, 28) },
    uLift: { value: new THREE.Vector3(0.010, 0.016, 0.030) }, uDither: { value: R.ditherOfs }, uRes: { value: new THREE.Vector2() },
    uShT: { value: new THREE.Vector3(1, 1, 1) }, uHiT: { value: new THREE.Vector3(1, 1, 1) }, uCon: { value: 0 },
    uCine: { value: new THREE.Vector4() }, uCineK: { value: new THREE.Vector4() }, uCineC: { value: new THREE.Vector3(1, 1, 1) },
  }, { BLOOM: 2, VIG: 1 });

  M.up = fsMat(`
precision highp float; varying vec2 vUv;
uniform sampler2D tColor; uniform vec2 uTex; uniform vec2 uOut; uniform vec2 uSub; uniform float uGrain; uniform float uSeed;
${GLSL_BAYER}
void main(){
  vec2 texel = vUv * uTex + uSub, scale = max(uOut / uTex, vec2(1.0));
  vec2 tf = floor(texel), f = texel - tf, region = 0.5 - 0.5 / scale, cen = f - 0.5;
  vec2 off = (cen - clamp(cen, -region, region)) * scale + 0.5;
  vec3 c = texture2D(tColor, (tf + off) / uTex).rgb;
  float g = hash12(gl_FragCoord.xy + uSeed) - 0.5;
  c += g * uGrain * (0.35 + 0.65 * (1.0 - dot(c, vec3(0.333))));
  gl_FragColor = vec4(c, 1.0);
}`, { tColor: { value: null }, uTex: { value: new THREE.Vector2() }, uOut: { value: new THREE.Vector2() }, uSub: { value: R.sub }, uGrain: { value: 0.035 }, uSeed: { value: 0 } });
}

function resizeRenderer() {
  const P = GFX.P || GFX.PRESET.high;
  // The canvases' device pixel ratio is capped per graphics tier (Low draws the final upscale and the HUD at 2x).
  const dpr = Math.min(window.devicePixelRatio || 1, 3, P.dpr);
  const dw = Math.max(8, Math.floor(window.innerWidth * dpr)), dh = Math.max(8, Math.floor(window.innerHeight * dpr));
  R.dw = dw; R.dh = dh; R.dpr = dpr; R.cssW = dw / dpr; R.cssH = dh / dpr;
  { const el = document.getElementById('safe'), cs = el ? getComputedStyle(el) : null, v = k => cs ? Math.round((parseFloat(cs[k]) || 0) * dpr) : 0; R.safe = [v('paddingLeft'), v('paddingTop'), v('paddingRight'), v('paddingBottom')]; }
  R.renderer.setSize(dw, dh, false);
  // Internal size: at least P.texel device pixels per scene pixel, at most P.maxPix pixels, and on Low/Mid at most
  // P.css scene pixels per CSS pixel (whatever the screen's density).
  const texel = Math.max(P.texel, Math.sqrt(dw * dh / P.maxPix), Math.min(dw, dh) / P.maxIH, P.css ? dpr / P.css : 0);
  let ih = Math.round(dh / texel * R.quality);
  ih = Math.max(ih, Math.min(dh, P.css ? 180 : 240));
  let iw = Math.max(8, Math.round(dw * ih / dh));
  if (iw > 1500) { ih = Math.round(ih * 1500 / iw); iw = 1500; }
  R.iw = iw; R.ih = ih;
  for (const k in R.rt) { R.rt[k].dispose(); if (R.rt[k].depthTexture) R.rt[k].depthTexture.dispose(); }
  const mk = (w, h, type, filter, depth, samples) => {
    const t = new THREE.WebGLRenderTarget(w, h, { type, format: THREE.RGBAFormat, minFilter: filter, magFilter: filter, depthBuffer: !!depth, stencilBuffer: false, generateMipmaps: false, samples: samples || 0 });
    if (depth) { t.depthTexture = new THREE.DepthTexture(w, h); t.depthTexture.type = THREE.UnsignedIntType; }
    return t;
  };
  const HF = THREE.HalfFloatType, NE = THREE.NearestFilter, LI = THREE.LinearFilter;
  R.rt = {};
  R.rt.scene = mk(iw, ih, HF, NE, true, R.renderer.capabilities.isWebGL2 ? P.msaa : 0);
  // Without tilt-shift the atmosphere pass writes a linear-filtered target, which the bloom reads directly.
  R.rt.atmo = mk(iw, ih, HF, P.dof ? NE : LI, false);
  if (P.dof) R.rt.dof = mk(iw, ih, HF, LI, false);
  const bw = Math.max(4, iw >> 1), bh = Math.max(4, ih >> 1), cw = Math.max(2, iw >> 2), ch = Math.max(2, ih >> 2);
  if (P.bloom > 1) { R.rt.bA = mk(bw, bh, HF, LI, false); R.rt.bA2 = mk(bw, bh, HF, LI, false); }
  if (P.bloom > 0) { R.rt.bB = mk(cw, ch, HF, LI, false); R.rt.bB2 = mk(cw, ch, HF, LI, false); }
  R.rt.final = mk(iw, ih, THREE.UnsignedByteType, LI, false);
  const hud = document.getElementById('hud'); hud.width = dw; hud.height = dh;
}

function fsPass(mat, target) {
  R.fsMesh.material = mat; R.renderer.setRenderTarget(target); R.renderer.render(R.fsScene, R.fsCam);
}

const _ivp = new THREE.Matrix4();
function renderFrame() {
  syncEchoDither();
  const r = R.renderer, M = R.mats, T = R.rt, cam = R.cam, P = GFX.P || GFX.PRESET.high;
  r.info.reset();
  scheduleShadows(G.phase === 'crumble' || G.phase === 'rise');
  { const m = LT.moon, mv = SH.uMoonV.value; mv.copy(m.position).sub(m.target.position).normalize().transformDirection(cam.matrixWorldInverse); SH.uMoonC.value.set(m.color.r, m.color.g, m.color.b).multiplyScalar(m.intensity); SH.uGlint.value = !P.glint || R.quality < .75 || R.lite ? 0 : P.glint; }
  r.setRenderTarget(T.scene); r.render(R.scene, cam);
  const px = M.atmo.uniforms.uPx.value.set(1 / R.iw, 1 / R.ih);
  let u = M.atmo.uniforms;
  u.tColor.value = T.scene.texture; u.tDepth.value = T.scene.depthTexture;
  _ivp.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).invert(); u.uInvVP.value.copy(_ivp);
  cam.getWorldDirection(u.uCamDir.value);
  u.uAO.value.y = 0.85 / R.px;
  u.uWind.value.set(SH.uTime.value * 0.05, SH.uTime.value * 0.021); u.uRes.value.set(R.iw, R.ih); u.uBack.value.x = (CAM.yaw - PI / 4) * 1.2;
  { const ea = G.eclA > .01 ? G.eclA : 0, asp = R.iw / R.ih, ph = asp < 1; u.uEcl.value.set(asp * (ph ? .3 : .15), ph ? .74 : .8, ph ? .036 : .055, ea);
    u.uMoonP.value.set(asp * (ph ? .3 : .15) - u.uBack.value.x * .25, ph ? .76 : .8, (ph ? .036 : .055) * (R.moonSize || 1)); }
  u.uHalo.value.x = !P.halo || R.lite || R.quality < .7 ? 0 : .016 * (R.haloK || 1); // lite mode and a lowered resolution skip the halos
  fsPass(M.atmo, T.atmo);
  const mk = CAM.menuK || 0;
  let img = T.atmo;
  if (P.dof) { // tilt-shift (not on Low or Ultra)
    u = M.dof.uniforms; u.tColor.value = T.atmo.texture; u.tDepth.value = T.scene.depthTexture; u.uPx.value.copy(px);
    const zr = cam.far - cam.near, dsc = (R.dofScale || 1) * (1 - .22 * mk);
    u.uDof.value.set((R.focusZ - cam.near) / zr, 3.2 * dsc / zr, 11.5 * dsc / zr, HASH.nodof || R.lite ? 0.6 : Math.max(2, Math.min(R.ih, R.iw * 1.6) * 0.0145));
    const nd = R.dofD || 20;
    u.uNear.value.set(Math.max(4 * dsc, 0.55 * nd) / zr, Math.max(6, nd) / zr, 0.6, R.opt ? 0.25 : -1);
    fsPass(M.dof, T.dof); img = T.dof;
  }
  // Bloom: two levels (half and quarter size), or on Low one quarter-size level straight from the picture.
  if (P.bloom > 1) {
    u = M.bright.uniforms; u.tColor.value = img.texture; u.uPx.value.copy(px); fsPass(M.bright, T.bA);
    u = M.blur.uniforms;
    u.tColor.value = T.bA.texture; u.uDir.value.set(1 / T.bA.width, 0); fsPass(M.blur, T.bA2);
    u.tColor.value = T.bA2.texture; u.uDir.value.set(0, 1 / T.bA.height); fsPass(M.blur, T.bA);
    u.tColor.value = T.bA.texture; u.uDir.value.set(1 / T.bB.width, 0); fsPass(M.blur, T.bB2);
    u.tColor.value = T.bB2.texture; u.uDir.value.set(0, 1 / T.bB.height); fsPass(M.blur, T.bB);
  } else if (P.bloom > 0) {
    u = M.bright.uniforms; u.tColor.value = img.texture; u.uPx.value.set(2 / R.iw, 2 / R.ih); fsPass(M.bright, T.bB);
    u = M.blur.uniforms;
  }
  if (P.bloom > 0) {
    // Low has no half-size level, so its quarter-size glow gets a second, wider blur: one narrow 9-tap blur of a
    // very bright beacon left the corners of the kernel visible as a square (round 13). Quarter size: cheap.
    const steps = P.bloom > 1 ? [1.6] : [1, 2.6];
    for (const k of steps) {
      u.tColor.value = T.bB.texture; u.uDir.value.set(k / T.bB.width, 0); fsPass(M.blur, T.bB2);
      u.tColor.value = T.bB2.texture; u.uDir.value.set(0, k / T.bB.height); fsPass(M.blur, T.bB);
    }
  }
  u = M.comp.uniforms; u.tColor.value = img.texture; u.tBloomA.value = P.bloom > 1 ? T.bA.texture : null; u.tBloomB.value = P.bloom > 0 ? T.bB.texture : null;
  u.uGrade.value.x = R.exposure * (1 + FX.flash * .5); u.uGrade.value.w = R.fade; u.uGrade.value.z = .55 + .2 * mk; u.uRes.value.set(R.iw, R.ih); CINE.post(u);
  fsPass(M.comp, T.final);
  u = M.up.uniforms; u.tColor.value = T.final.texture; u.uTex.value.set(R.iw, R.ih); u.uOut.value.set(R.dw, R.dh); u.uSeed.value = (SH.uTime.value * 60 % 1000) * 7.13;
  fsPass(M.up, null);
}
