// Graphics tiers (round 12). GFX.tier is the tier in use, GFX.mode what the player picked ('auto' or a tier).
// 'auto' picks from the GPU name, device memory, cores and whether it is a touch screen, then steps down a tier
// when the measured frame time stays slow at the lowest resolution of a tier (autoScale in 90-main.js).
// Each preset (GFX.P):
//   css      the scene's internal resolution in pixels per CSS pixel at most (0 = no such cap)
//   texel    smallest device pixels per internal pixel; maxPix / maxIH cap the internal size
//   dpr      cap on the device pixel ratio of the canvases (the final upscale and the HUD are drawn at it)
//   q0, qMin starting and lowest resolution factor (R.quality; the frame-time watcher moves it between them and 1)
//   moon     moon shadow map size (x .75 on a touch screen); shadowType 'basic' (one tap) or 'pcf'
//   spotSh, beaconSh  spotlight and beacon shadow map sizes (0: those lights cast no shadow)
//   lights   point lights of each kind in use: [towers, torches, flashes, land lights]
//   ao       ambient-occlusion taps (0 off); mist 0 none, 1 plain colour, 2 lit by the lanterns; edge haze;
//            halo (lantern glow in the air); dof (tilt-shift); bloom 0 none, 1 one level, 2 two levels;
//            vig (vignette); levels (colour steps of the dithered output); grain (film grain)
//   keep     share of the optional particles; wx share of the weather particles; glint (the moon on water)
//   msaa     multisampled scene (WebGL 2); fps the default frame cap (0: none)
const GFX = {
  tiers: ['low', 'mid', 'high', 'ultra'],
  label: { auto: 'Automaatne', low: 'Madal', mid: 'Keskmine', high: 'Kõrge', ultra: 'Ultra' },
  fpsLabel: { 0: 'Piiramatu', 30: '30', 60: '60' },
  PRESET: {
    low: { css: .9, texel: 2, maxPix: 520000, maxIH: 620, dpr: 2, q0: 1, qMin: .8, moon: 1024, shadowType: 'basic', spotSh: 0, beaconSh: 0, lights: [4, 2, 2, 1],
      ao: 0, mist: 1, edge: 1, halo: 0, dof: 0, bloom: 1, vig: 1, levels: 28, grain: .035, keep: .55, wx: .45, glint: 0, msaa: 0, fps: 30 },
    mid: { css: .95, texel: 2, maxPix: 690000, maxIH: 620, dpr: 2.5, q0: 1, qMin: .6, moon: 1536, shadowType: 'pcf', spotSh: 512, beaconSh: 512, lights: [8, 3, 3, 2],
      ao: 6, mist: 2, edge: 1, halo: 1, dof: 1, bloom: 2, vig: 1, levels: 28, grain: .035, keep: .8, wx: .75, glint: 1, msaa: 0, fps: 60 },
    high: { css: 0, texel: 2, maxPix: 690000, maxIH: 620, dpr: 3, q0: 1, qMin: .55, moon: 2048, shadowType: 'pcf', spotSh: 1024, beaconSh: 1024, lights: [12, 5, 4, 3],
      ao: 10, mist: 2, edge: 1, halo: 1, dof: 1, bloom: 2, vig: 1, levels: 28, grain: .035, keep: 1, wx: 1, glint: 1, msaa: 0, fps: 60 },
    // Ultra: everything clear. No mist, edge haze, vignette, tilt-shift, lantern haze or grain; full resolution;
    // finer colour steps; bigger moon shadows; multisampled edges.
    ultra: { css: 0, texel: 1, maxPix: 2400000, maxIH: 1e9, dpr: 3, q0: 1, qMin: .7, moon: 3072, shadowType: 'pcf', spotSh: 1024, beaconSh: 1024, lights: [12, 5, 4, 3],
      ao: 10, mist: 0, edge: 0, halo: 0, dof: 0, bloom: 2, vig: 0, levels: 160, grain: 0, keep: 1, wx: 1, glint: 1, msaa: 4, fps: 0 },
  },
  mode: 'auto', tier: 'high', P: null, fpsUser: null, gpu: null, auto: null, applied: null,
  // The frame cap in use: the player's (setFps) or the tier's default.
  get fpsCap() { return this.fpsUser !== null ? this.fpsUser : this.P ? this.P.fps : 60; },
  coarse() { return !!(window.matchMedia && matchMedia('(pointer: coarse)').matches); },
  // The GPU's name (WEBGL_debug_renderer_info where the browser still gives it, else the plain renderer string).
  gpuName() {
    if (this.gpu !== null) return this.gpu;
    try { const gl = R.renderer.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info'); this.gpu = String((e && gl.getParameter(e.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || ''); } catch (e) { this.gpu = ''; }
    return this.gpu;
  },
  // The tier a device starts on in 'auto'.
  detect() {
    const g = this.gpuName(), mem = navigator.deviceMemory || 0, cores = navigator.hardwareConcurrency || 0, touch = this.coarse();
    let t = touch ? 'mid' : 'high', m;
    if (/swiftshader|llvmpipe|softpipe/i.test(g)) t = 'high'; // software GL on the test machines: their pictures stay as before
    else if (touch) {
      if (/mali-?\s*t\d/i.test(g)) t = 'low';
      else if ((m = /mali-?\s*g(\d+)/i.exec(g))) { const n = +m[1]; t = n < 100 ? (n >= 76 ? 'mid' : 'low') : n >= 700 ? 'high' : 'low'; }
      else if (/immortalis|xclipse|apple/i.test(g)) t = 'high';
      else if (/mali|powervr|imagination|img |bxm|bxe|vivante|videocore|tegra/i.test(g)) t = 'low';
      else if ((m = /adreno\D*(\d+)/i.exec(g))) { const n = +m[1]; t = n < 616 ? 'low' : n < 660 ? 'mid' : n < 700 ? 'high' : n < 800 ? (n % 100 >= 30 ? 'high' : 'mid') : 'high'; }
      if ((mem && mem <= 3) || (cores && cores <= 4)) t = 'low';
      else if (mem && mem <= 4 && t !== 'low') t = 'mid';
    } else if (/microsoft basic render/i.test(g) || (mem && mem <= 2) || (cores && cores <= 2)) t = 'mid';
    // A device that already had to step down starts on that tier (remembered per GPU name).
    const a = this.auto, ai = a && a.gpu === g ? this.tiers.indexOf(a.tier) : -1;
    if (ai >= 0 && ai < this.tiers.indexOf(t)) t = a.tier;
    return t;
  },
  load() {
    try {
      const o = JSON.parse(localStorage.getItem('lanternhold.gfx') || 'null');
      if (o) { if (o.mode === 'auto' || this.PRESET[o.mode]) this.mode = o.mode; if (o.fps === 0 || o.fps === 30 || o.fps === 60) this.fpsUser = o.fps; if (o.auto && typeof o.auto === 'object') this.auto = o.auto; }
      else { // older saves: the graphics setting was Auto, Sharp or Fast in the settings
        const s = JSON.parse(localStorage.getItem('lanternhold.settings') || '{}') || {};
        if (s.q === 'sharp') this.mode = 'high'; else if (s.q === 'fast') this.mode = 'low';
      }
    } catch (e) {}
  },
  save() { if (TEST_SESSION) return; try { localStorage.setItem('lanternhold.gfx', JSON.stringify({ mode: this.mode, fps: this.fpsUser, auto: this.auto })); } catch (e) {} },
  // At boot, after initLights. URL flags for tests: gfx=auto|low|mid|high|ultra, cap=0|30|60. Test sessions
  // (any test flag in the URL) start on High unless gfx= says otherwise, so the QA pictures and timings stay put.
  init() {
    if (!TEST_SESSION) this.load(); else this.mode = 'high';
    const h = HASH.gfx; if (h === 'auto' || this.PRESET[h]) this.mode = h;
    if (HASH.cap !== undefined && [0, 30, 60].includes(+HASH.cap)) this.fpsUser = +HASH.cap;
    this.apply(this.mode === 'auto' ? this.detect() : this.mode);
  },
  // Picks 'auto' or a tier and saves it for the next visit ('sharp' and 'fast', the old names, still work).
  set(key) {
    if (key === 'sharp') key = 'high'; else if (key === 'fast') key = 'low';
    if (key !== 'auto' && !this.PRESET[key]) return;
    this.mode = key; this.save();
    this.apply(key === 'auto' ? this.detect() : key);
  },
  // Frame cap: 30, 60 or 0 (none); anything else ('auto', null) goes back to the tier's default.
  setFps(n) { n = n === null ? n : +n; this.fpsUser = n === 0 || n === 30 || n === 60 ? n : null; this.save(); },
  // 'auto' only: one tier down once the frame-time watcher ran out of resolution to give (remembered per GPU).
  stepDown() {
    const i = this.tiers.indexOf(this.tier); if (this.mode !== 'auto' || i <= 0) return false;
    const t = this.tiers[i - 1]; this.auto = { gpu: this.gpuName(), tier: t }; this.save(); this.apply(t); return true;
  },
  apply(tier) {
    const P = this.P = this.PRESET[tier] || this.PRESET.high; this.tier = this.PRESET[tier] ? tier : 'high';
    if (!R.renderer || !LT.moon) return;
    const touch = this.coarse(), sm = touch ? .75 : 1;
    R.quality = P.q0 * (this.tier === 'high' && touch && !HASH.noscale ? .85 : 1); R.lite = 0;
    // Shadows. Changing these recompiles the lit materials once (a short pause, on a settings change only).
    const r = R.renderer, st = P.shadowType === 'basic' ? THREE.BasicShadowMap : THREE.PCFShadowMap;
    if (r.shadowMap.type !== st) { r.shadowMap.type = st; r.shadowMap.needsUpdate = true; }
    const setMap = (l, s) => { if (l.shadow.mapSize.x !== s) { l.shadow.mapSize.set(s, s); if (l.shadow.map) { l.shadow.map.dispose(); l.shadow.map = null; } } };
    LT.moonMap = Math.round(P.moon * sm); setMap(LT.moon, LT.moonMap);
    LT.beacon.castShadow = P.beaconSh > 0; if (P.beaconSh) setMap(LT.beacon, Math.round(P.beaconSh * sm));
    for (const s of LT.spots) { s.l.castShadow = P.spotSh > 0; if (P.spotSh) setMap(s.l, Math.round(P.spotSh * sm)); }
    LT.shadowsAt = -1;
    // Point lights: the ones past the tier's count are hidden, so they leave the shaders' light loops.
    const L = P.lights;
    LT.towers.forEach((l, i) => { l.visible = i < L[0]; if (!l.visible) l.intensity = 0; });
    LT.torches.forEach((s, i) => { s.l.visible = i < L[1]; if (!s.l.visible) { s.l.intensity = 0; s.owner = null; } });
    LT.flashes.forEach((f, i) => { f.l.visible = i < L[2]; if (!f.l.visible) { f.l.intensity = 0; f.t = 1; } });
    LT.env.forEach((l, i) => { l.visible = i < L[3]; });
    LT.nTower = L[0]; LT.nTorch = L[1]; LT.nFlash = L[2]; LT.tPick.length = 0; LT.spotTimer = 0;
    // Post: the shader variants of this tier.
    const M = R.mats, def = (m, d) => { let ch = false; for (const k in d) if (m.defines[k] !== d[k]) { m.defines[k] = d[k]; ch = true; } if (ch) m.needsUpdate = true; };
    if (M.atmo) {
      def(M.atmo, { AO_N: P.ao, MIST: P.mist, EDGE: P.edge, HALO: P.halo });
      def(M.comp, { BLOOM: P.bloom, VIG: P.vig });
      M.comp.uniforms.uBloom.value.z = P.levels; M.up.uniforms.uGrain.value = P.grain;
    }
    if (typeof WX !== 'undefined' && WX.apply) WX.apply();
    if (this.applied && typeof autoScaleReset === 'function') autoScaleReset();
    this.applied = this.tier;
    resizeRenderer();
  },
};
