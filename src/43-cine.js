// ---- Victory and defeat cinematics -------------------------------------------------------------------------------
// CINE.play(kind, done): kind 'victory' (the beacon re-lights and warm light floods out over the land) or 'defeat'
// (the dark closes in and swallows the keep). About 3.4 s; it drives the camera (an override blended over the follow
// camera, put back after each frame is drawn), the beacon's flame and light, particles and a ring in the post pass
// (uCine in the composite shader), and draws letterbox bars with a caption on the HUD. A tap, click or key skips it
// (after the first 0.3 s). done() is called exactly once, when it ends or is skipped, or at once if a second play
// replaces it. CINE.on() is true while one plays; the post ring and camera ease back over 0.6 s after it ends.
// Visual only: real time (not game time), the effects random stream, no gameplay state touched.
// prefers-reduced-motion (FX.flashK < 1): no flashes or shake, the light comes up without a strobe.
// Test hook: window.__cw.CINE, and the URL flag cine=victory|defeat (plays it once the page is up).
const CINE = {
  cur: null, tail: 0, tailKind: null, w: 0, ring: 0, dark: 0, glow: 0, flood: 0, bars: 0, stash: null, listening: false, DUR: 3.4,
  on() { return !!this.cur; },
  play(kind, done) {
    if (this.cur) this.finish();
    kind = kind === 'defeat' ? 'defeat' : 'victory';
    this.cur = { kind, done: typeof done === 'function' ? done : null, t: 0, lit: false, towers: new Set(), puff: 0, sound: false };
    this.tailKind = kind; this.tail = 0; this.listen();
    if (!G.B) this.finish();
  },
  skip() { if (this.cur && this.cur.t > .3) { this.finish(); try { sfx('uiClick', CAM.x, CAM.z, .5); } catch (e) {} } },
  finish() {
    const C = this.cur; if (!C) return; this.cur = null; this.tail = .6;
    if (C.done) { try { C.done(); } catch (e) { console.error(e); } }
  },
  listen() {
    if (this.listening) return; this.listening = true;
    const grab = e => { if (!CINE.cur) return; e.stopImmediatePropagation(); if (e.cancelable) e.preventDefault(); if (e.type !== 'keyup') CINE.skip(); };
    for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, grab, { capture: true, passive: false });
  },
  // Each frame, after the simulation steps and before the camera is applied (90-main frame()). rdt: real seconds.
  update(rdt) {
    const C = this.cur, B = G.B;
    if (C) { C.t += rdt; if (C.t >= this.DUR) { this.finish(); } }
    if (!this.cur && this.tail > 0) this.tail = Math.max(0, this.tail - rdt);
    const kind = this.cur ? this.cur.kind : this.tailKind, t = this.cur ? this.cur.t : this.DUR, out = this.cur ? 1 : this.tail / .6;
    if (!B || (!this.cur && this.tail <= 0)) { this.w = this.dark = this.glow = this.flood = this.bars = 0; return; }
    const b = B.beacon, calm = FX.flashK < 1, e = u => { u = sat(u); return u * u * (3 - 2 * u); };
    this.bars = e(t / .35) * out;
    if (kind === 'victory') {
      // 0-0.7 s: the camera settles on the keep, the land dims. 0.7 s: the beacon flares. Then the light rolls out.
      const ig = .7, u = (t - ig) / 1.7;
      this.w = e(t / .6) * out; this.ring = u <= 0 ? 0 : 1.9 * Math.pow(sat(u), .8);
      this.dark = (.55 * e(t / .5)) * (1 - e((t - 2.6) / .7)) * out; this.glow = (u > 0 ? (calm ? .5 : 1) * (1 - sat(u) * .6) : 0) * out; this.flood = (u > 0 ? .55 * e(u * 2) : 0) * out;
      if (this.cur && !C.lit && t >= ig) {
        C.lit = true;
        if (!calm) { lightFlash(b.x, b.y + 1.2, b.z, 0xffc070, 2400, 1.3, 60); FX.flash = Math.max(FX.flash, .35); shake(.45); }
        else lightFlash(b.x, b.y + 1.2, b.z, 0xffc070, 1400, 2.2, 60);
        fxEmbers(b.x, b.y, b.z, 90, .8, 1.1, .6, .2);
        fxTimed(4, b.x, FX.groundAt(b.x, b.z) + .12, b.z, 6, 6, 2.4, 1.6, .7, .9, 1.8, { ground: true, grow: 6 });
        fxTimed(5, b.x, b.y + .8, b.z, 7, 7, 2.6, 1.8, .9, .9, .9, { grow: 1.5 });
        try { sfx('ignite', b.x, b.z, 1.3, 1); } catch (er) {}
      }
      // Each tower catches the light as the wave of it passes.
      if (this.cur && u > 0) for (const tw of G.towers) {
        if (!tw.alive || C.towers.has(tw)) continue;
        if (Math.hypot(tw.x - b.x, tw.z - b.z) < 34 * sat(u)) { C.towers.add(tw); fxEmbers(tw.x, tw.y + 1.6, tw.z, 14, .45, 1.1, .7, .25); fxTimed(5, tw.x, tw.y + 1.8, tw.z, 3.2, 3.2, 2.4, 1.7, .8, .7, .7, {}); }
      }
      if (B.beaconFlame) { const f = B.beaconFlame, boost = 1 + 1.1 * e((t - ig) / .25) * (1 - .45 * e((t - ig - .6) / 1.2)); f.on = Math.max(f.on, e((t - ig + .1) / .2)); f.size = Math.max(f.size, 2.35 * boost * out); f.embers = Math.max(f.embers, 6 * out); }
      if (t > ig) { LT.beaconOn = Math.max(LT.beaconOn, out); LT.beacon.intensity = Math.max(LT.beacon.intensity, LT.beaconBase * (1 + 1.8 * this.glow) * out); }
    } else {
      // The dark closes in on the keep from the edges; the beacon gutters and goes out; black.
      this.w = e(t / .9) * out; this.ring = 1.7 * (1 - e((t - .2) / 2.8)); this.dark = e(t / .6) * (.6 + .4 * e((t - 2.4) / .8)) * out;
      this.glow = .5 * e(t / .8) * (1 - e((t - 2.7) / .5)) * out; this.flood = 0;
      const gut = e((t - 1.2) / 1.6);
      if (B.beaconFlame) { const f = B.beaconFlame; f.size = Math.min(f.size, 2.35 * (1 - .8 * gut) + .01); f.on = Math.min(f.on, 1 - e((t - 2.4) / .6)); }
      LT.beaconGutter = Math.max(LT.beaconGutter, .6 * gut * (1 - gut) * 4 * (calm ? .3 : 1)); LT.beacon.intensity *= 1 - gut * .9;
      // Tendrils of the dark: smoke crawling inward from a ring that shrinks onto the keep.
      if (this.cur) {
        C.puff += rdt * 34; const rw = 3 + 17 * (1 - e((t - .2) / 2.8));
        while (C.puff >= 1) {
          C.puff -= 1; const a = frnd() * TAU, x = b.x + Math.cos(a) * rw, z = b.z + Math.sin(a) * rw, sp = frr(1.5, 3.2);
          fxSmoke(x, FX.groundAt(x, z) + frr(.1, .9), z, -Math.cos(a) * sp, frr(-.1, .4), -Math.sin(a) * sp, frr(1.1, 1.8), frr(1.4, 2.4), 3, .03, .02, .05, .8, { drag: .6 });
        }
        if (!C.sound && t > 2.3) { C.sound = true; fxSmoke(b.x, b.y + .6, b.z, 0, 1.2, 0, 2.5, 1.2, 3, .05, .04, .06, .8, { drag: .5 }); }
      }
    }
    // The camera: onto the keep, a slow turn and a push in (defeat pushes in further and looks down).
    if (this.w > 0) {
      const s = this.stash = { x: CAM.x, y: CAM.y, z: CAM.z, zoom: CAM.zoom, yaw: CAM.yaw, elev: CAM.elev }, w = this.w;
      const zoom = kind === 'victory' ? 1.75 - .45 * e((t - .9) / 1.8) : 1.15 + 1.2 * e(t / 3.2);
      const yaw = s.yaw + (kind === 'victory' ? .22 : -.16) * e(t / this.DUR), elev = s.elev + (kind === 'victory' ? -.04 : .1) * e(t / this.DUR);
      CAM.x = lerp(s.x, b.x * .9, w); CAM.z = lerp(s.z, b.z * .9, w); CAM.y = lerp(s.y, b.y * .55, w);
      CAM.zoom = lerp(s.zoom, zoom, w); CAM.yaw = lerp(s.yaw, yaw, w); CAM.elev = lerp(s.elev, elev, w);
    } else this.stash = null;
  },
  // After the frame is drawn: the follow camera gets its own values back (it damps from them next step).
  restore() { const s = this.stash; if (!s) return; this.stash = null; CAM.x = s.x; CAM.y = s.y; CAM.z = s.z; CAM.zoom = s.zoom; CAM.yaw = s.yaw; CAM.elev = s.elev; },
  // The composite pass (20-post renderFrame): ring centre on the beacon, in uv.
  post(u) {
    const k = u.uCineK.value;
    if (!G.B || (this.dark <= 0 && this.glow <= 0 && this.flood <= 0)) { k.set(0, 0, 0, 0); return; }
    const b = G.B.beacon, p = new THREE.Vector3(b.x, b.y, b.z).project(R.cam), vic = (this.cur ? this.cur.kind : this.tailKind) === 'victory';
    u.uCine.value.set(p.x * .5 + .5, p.y * .5 + .5, this.ring, vic ? 1 : 0);
    k.set(this.dark, this.glow, this.flood, 1);
    if (vic) u.uCineC.value.set(1.6, 1.05, .45); else u.uCineC.value.set(.32, .14, .5);
  },
  // On the HUD canvas, after UI.draw: letterbox bars, a caption and the skip hint.
  drawHud() {
    const a = this.bars; if (a <= 0) return;
    const c = UI.ctx, W = R.dw, H = R.dh, s = UI.s, bh = Math.round(Math.min(Math.max(H * .1, (R.hudTop || 0) + 4 * s), H * .2) * a);
    c.save(); c.fillStyle = '#05060a'; c.fillRect(0, 0, W, bh); c.fillRect(0, H - bh, W, bh);
    const C = this.cur, kind = C ? C.kind : this.tailKind, t = C ? C.t : this.DUR;
    const cap = kind === 'victory' ? 'The light returns' : 'The dark takes the keep', ca = sat((t - (kind === 'victory' ? 1 : .8)) * 2) * a;
    let sc = s + 1; while (sc > 2 && PX.measure(cap) * sc > W * .9) sc--;
    if (ca > 0) { c.globalAlpha = ca; PX.text(c, cap, W / 2, H - bh + Math.round((bh - PX.LINE * sc) / 2), sc, kind === 'victory' ? '#ffd9a8' : '#b8a8d8', { align: 'c' }); }
    if (C && t > .3) { c.globalAlpha = a * .7; const hs = Math.max(2, s - 1), hint = UI.touch ? 'Tap to skip' : 'Any key skips'; PX.text(c, hint, W - (R.safe ? R.safe[2] : 0) - 6 * hs, Math.round((bh - PX.LINE * hs) / 2), hs, '#a79e8a', { align: 'r' }); }
    c.restore();
  },
};
