
const UI = (() => {
  const U = {
    ctx: null, s: 3, insetTop: 0, goldShown: 0, hurt: 0, coins: [], msg: null, hover: null, menu: null, armed: null, idle: 99, mx: -1, my: -1, inside: false,
    btns: [], hotBtn: null, press: null, gp: { sel: -1, t: 0, prev: [] , active: false }, goldBump: 0, deny: 0, hintT: 0, titleT: 0, rangeMesh: null, padMesh: null, soundRect: null, cmdRect: null, manual: false, moved: 99, focus: 0, slainBump: 0, lastSlain: 0,
    touch: false, ptrs: new Map(), gest: null, lastTap: { t: -9, x: 0, y: 0 }, waveRect: null, followRect: null, menuRect: null, wake: null, panning: false,
    hud: [], tips: [], tip: null, keys: new Set(), sndArmed: false, vvT: 0, vvN: 0,
    spell: null, gpt: null, spellFlash: {}, spellSeen: {},
    sets: null, panelRect: null, everManual: false, helpSeen: {}, sumT: 0, offer: null,
  };
  // Settings, remembered between visits: volumes (0..1) and the graphics mode.
  const SET = { music: 1, sfx: 1, amb: 1, q: 'auto' }, Q0 = { noscale: HASH.noscale, quality: -1 };
  function saveSettings() { try { localStorage.setItem('cinderwatch.settings', JSON.stringify(SET)); } catch (e) {} }
  function applyVolumes() { AU.setVolume('music', SET.music); AU.setVolume('sfx', SET.sfx); AU.setVolume('crowd', SET.sfx); AU.setVolume('ambience', SET.amb); }
  // Graphics: Auto lets the frame-rate watcher pick the resolution; Sharp holds full resolution; Fast holds a low one.
  function applyQuality() {
    if (Q0.quality < 0) Q0.quality = R.quality;
    if (SET.q === 'auto') { HASH.noscale = Q0.noscale; R.quality = Q0.quality; } else { HASH.noscale = '1'; R.quality = SET.q === 'sharp' ? 1 : .6; }
    if (R.renderer) resizeRenderer();
  }
  function loadSettings() {
    try {
      const o = JSON.parse(localStorage.getItem('cinderwatch.settings') || '{}') || {};
      for (const k of ['music', 'sfx', 'amb']) if (o[k] !== undefined && isFinite(+o[k])) SET[k] = clamp(+o[k], 0, 1);
      if (o.q === 'auto' || o.q === 'sharp' || o.q === 'fast') SET.q = o.q;
      const h = JSON.parse(localStorage.getItem('cinderwatch.help') || '[]'); if (Array.isArray(h)) for (const k of h) U.helpSeen[k] = 1;
    } catch (e) {}
    applyVolumes(); if (SET.q !== 'auto') applyQuality();
  }
  // One-time help lines for the player's first steps (remembered, so they show once per browser).
  function helpTip(key) {
    if (U.helpSeen[key]) return; U.helpSeen[key] = 1; U.tips.unshift('help:' + key);
    try { localStorage.setItem('cinderwatch.help', JSON.stringify(Object.keys(U.helpSeen))); } catch (e) {}
  }
  function openSettings(on) {
    if (on === undefined) on = !U.sets; if (!!on === !!U.sets) return;
    if (on) { U.sets = { tab: 'set', t: 0, wasPaused: G.paused }; G.paused = true; U.closeMenu(); U.keys.clear(); }
    else { G.paused = U.sets.wasPaused; U.sets = null; }
    sfx('uiClick', CAM.x, CAM.z, .6);
  }
  // Continue a saved run (offered on load over the commander's demo, see continueOffer in 62-game.js).
  // While the offer is up the demo plays on behind it but does not save, so the saved run is safe until the player picks.
  U.offerContinue = S => { U.offer = { S, t: 0 }; SAVE.hold = true; U.closeMenu(); };
  function takeOffer(yes) {
    const o = U.offer; if (!o) return; U.offer = null; SAVE.hold = false; sfx('uiClick', CAM.x, CAM.z, .8); buzz(12);
    if (!yes) { clearSave(); U.titleT = 0; return; }
    U.titleT = 7;
    try { if (!restoreRun(o.S)) { clearSave(); U.titleT = 0; } }
    catch (e) { clearSave(); setTimeout(() => location.reload(), 30); throw e; }
  }
  const COLR = { bg: 'rgba(9,11,17,0.86)', bg2: 'rgba(24,27,38,0.94)', bd: '#5d4c35', bdHi: '#e8b04a', tx: '#efe4cd', dim: '#a79e8a', amber: '#e8b04a', ember: '#ff8a3c', cold: '#8fc7ff', red: '#e5553c', dark: '#0b0d14', ok: '#9fd08a' };
  const _pv = new THREE.Vector3(), _o = new THREE.Vector3(), _d = new THREE.Vector3();
  function proj(x, y, z) { _pv.set(x, y, z).project(R.cam); return { x: (_pv.x * .5 + .5) * R.dw, y: (1 - (_pv.y * .5 + .5)) * R.dh }; }
  U.proj = proj;
  U.playerActive = () => U.manual;
  U.setManual = on => { U.manual = !!on; if (on) takeCommand(); else { U.menu = null; U.armed = null; U.spell = null; } };
  function takeCommand() { if (!U.everManual) { U.everManual = true; helpTip('cmd'); } }
  U.banner = (text, dur, big) => { U.msg = { text, t: 0, dur, big }; };
  U.ping = (x, y, z, byPlayer) => { fxTimed(4, x, y + .12, z, 5, 5, byPlayer ? 1.0 : 1.5, byPlayer ? 1.4 : 1.1, byPlayer ? 1.8 : .5, .7, .55, { ground: true }); };
  U.closeMenu = () => { U.menu = null; U.armed = null; U.spell = null; };
  U.coinFrom = (x, y, z, value) => {
    if (U.coins.length > 70) { U.goldShown += value; return; }
    const p = proj(x, y, z); U.coins.push({ sx: p.x, sy: p.y, t: 0, T: rr(.55, .8), value, cx: p.x + rr(-60, 60) * U.s, cy: p.y - rr(30, 70) * U.s });
  };

  function plate(x, y, w, h, o = {}) {
    const c = U.ctx, s = U.s; x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    c.fillStyle = o.bd || COLR.bd; c.fillRect(x + s, y, w - 2 * s, h); c.fillRect(x, y + s, w, h - 2 * s);
    c.fillStyle = o.bg || COLR.bg; c.fillRect(x + 2 * s, y + s, w - 4 * s, h - 2 * s); c.fillRect(x + s, y + 2 * s, w - 2 * s, h - 4 * s);
    if (o.hi) { c.fillStyle = o.hi; c.fillRect(x + 2 * s, y + s, w - 4 * s, s); }
  }
  function text(str, x, y, col, o) { return PX.text(U.ctx, str, x, y, U.s, col || COLR.tx, o); }
  const tw = str => PX.measure(str) * U.s;

  function initUI() {
    const cv = document.getElementById('hud'); U.ctx = cv.getContext('2d'); U.ctx.imageSmoothingEnabled = false;
    const mk = (seg, col) => {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((seg + 1) * 6), 3)); const idx = [];
      for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); } g.setIndex(idx);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6, side: THREE.DoubleSide }));
      m.frustumCulled = false; m.visible = false; m.renderOrder = 6; m.seg = seg; R.scene.add(m); return m;
    };
    U.rangeMesh = mk(96, new THREE.Color(1.5, 1.15, .6)); U.padMesh = mk(40, new THREE.Color(2.2, 1.7, .9));
    U.touch = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
    const D = () => R.dpr || 1, pos = e => [e.clientX * D(), e.clientY * D()];
    window.addEventListener('pointerdown', e => {
      const [x, y] = pos(e); U.touch = e.pointerType !== 'mouse'; U.mx = x; U.my = y; U.inside = true; U.gp.active = false; U.moved = 0;
      U.ptrs.set(e.pointerId, { x, y, x0: x, y0: y });
      audioGesture();
      CAM.za = null;
      if (U.ptrs.size === 1) { const b = btnAt(x, y); U.gest = { mode: 'tap', hud: !!b || hudAt(x, y), btn: b }; U.press = b ? b.id : null; }
      else if (U.ptrs.size === 2) { const [a, b] = [...U.ptrs.values()]; U.gest = { mode: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; U.press = null; }
      e.preventDefault();
    }, { passive: false });
    window.addEventListener('pointermove', e => {
      const [x, y] = pos(e), p = U.ptrs.get(e.pointerId);
      if (e.pointerType === 'mouse' || p) { U.mx = x; U.my = y; U.inside = true; U.moved = 0; U.gp.active = false; }
      if (!p) return;
      const g = U.gest;
      if (g && g.mode === 'pinch' && U.ptrs.size >= 2) {
        p.x = x; p.y = y; const [a, b] = [...U.ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y) || 1, cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        camPan(cx - g.cx, cy - g.cy); camZoomAt(d / g.d, cx, cy); g.d = d; g.cx = cx; g.cy = cy; return;
      }
      if (g && g.mode === 'tap' && g.btn && g.btn.drag) { g.btn.drag(x); p.x = x; p.y = y; return; }
      if (g && g.mode === 'tap' && !g.hud && Math.hypot(x - p.x0, y - p.y0) > (U.touch ? 10 : 6) * D()) { g.mode = 'pan'; U.press = null; }
      if (g && g.mode === 'pan') camPan(x - p.x, y - p.y);
      p.x = x; p.y = y;
    });
    const up = e => {
      const p = U.ptrs.get(e.pointerId); if (!p) return; U.ptrs.delete(e.pointerId); audioGesture(); U.keepAwake();
      const g = U.gest;
      if (U.ptrs.size === 0) { if (g && g.mode === 'tap' && e.type === 'pointerup') onTap(p.x, p.y, g.btn); U.gest = null; U.press = null; if (U.touch) U.inside = false; }
      else if (g && g.mode === 'pinch') U.gest = { mode: 'pan' };
    };
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    window.addEventListener('pointerleave', () => { if (!U.ptrs.size) U.inside = false; });
    document.addEventListener('mouseleave', () => { if (!U.ptrs.size) U.inside = false; });
    window.addEventListener('wheel', e => { if (U.sets) { e.preventDefault(); return; } const [x, y] = pos(e), d = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY; camZoomTo(camZoomNow() * Math.exp(-clamp(d, -160, 160) * (e.ctrlKey ? .012 : .0024)), x, y, 16); e.preventDefault(); }, { passive: false });
    const stop = e => { if (e.cancelable) e.preventDefault(); };
    for (const ev of ['touchmove', 'touchcancel', 'dblclick', 'gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, stop, { passive: false });
    document.addEventListener('touchstart', e => {
      stop(e); const n = e.touches.length;
      if (n < U.ptrs.size) { const keys = [...U.ptrs.keys()]; for (let i = 0; i < keys.length - n; i++) U.ptrs.delete(keys[i]); if (U.ptrs.size <= 1) { const p = [...U.ptrs.values()][0]; U.gest = p ? { mode: 'tap', hud: !!btnAt(p.x, p.y) || hudAt(p.x, p.y) } : null; } }
    }, { passive: false });
    document.addEventListener('touchend', e => { audioGesture(); stop(e); if (!e.touches.length && U.ptrs.size) setTimeout(() => { if (U.ptrs.size) U.dropTouches(); }, 80); }, { passive: false });
    if (window.visualViewport) for (const ev of ['resize', 'scroll']) window.visualViewport.addEventListener(ev, fixPageZoom);
    try { if (localStorage.getItem('cinderwatch.muted') === '1') AU.muted = true; G.best = +localStorage.getItem('cinderwatch.best') || 0; } catch (e) {}
    loadSettings();
    window.addEventListener('keyup', e => { U.keys.delete(e.code); });
    window.addEventListener('blur', () => U.keys.clear());
    window.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', e => {
      if (PAN[e.code] && !e.ctrlKey && !e.metaKey && !e.altKey) { if (!U.sets && !U.offer) U.keys.add(e.code); e.preventDefault(); }
      if (e.repeat) return; audioGesture(); U.keepAwake(); U.touch = false;
      const k = e.key;
      if (U.offer) { if (k === ' ' || k === 'Enter') takeOffer(true); else if (k === 'n' || k === 'N') takeOffer(false); else if (k === 'm' || k === 'M') setMute(!AU.muted); e.preventDefault(); return; }
      if (k === 'o' || k === 'O' || (k === 'Escape' && U.sets)) { openSettings(); e.preventDefault(); return; }
      if (U.sets) { if (k === 'm' || k === 'M') setMute(!AU.muted); return; }
      if (G.phase === 'defeat' && (k === ' ' || k === 'Enter')) { if (restartRun(true)) sfx('uiClick', CAM.x, CAM.z, .8); e.preventDefault(); return; }
      const bt = U.menu && U.menu.tower;
      if ((k === '1' || k === '2') && bt && canBranch(bt)) { touchInput(); doBranch(bt, BRANCH_KEYS[bt.kind][+k - 1]); e.preventDefault(); }
      else if (k >= '1' && k <= '4') { pickKind(TOWER_KINDS[+k - 1]); e.preventDefault(); }
      else if (k >= '5' && k <= '7') { pickSpell(SPELL_KINDS[+k - 5]); e.preventDefault(); }
      else if (k === 'q' || k === 'Q') { pickSpell('meteor'); }
      else if (k === 'e' || k === 'E') { pickSpell('frost'); }
      else if (k === 't' || k === 'T') { pickSpell('rally'); }
      else if (k === ' ' || k === 'Enter') { callWave(); e.preventDefault(); }
      else if (k === 'Escape') { U.closeMenu(); }
      else if (k === 'u' || k === 'U') { const t = (U.menu && U.menu.tower) || (U.hover && U.hover.tower); if (t) { touchInput(); doUpgrade(t); } }
      else if (k === 'x' || k === 'X' || k === 'Delete' || k === 'Backspace') { const t = U.menu && U.menu.tower; if (t) { touchInput(); if (U.menu.sellArm) doSell(t); else { U.menu.sellArm = true; sfx('uiHover', t.x, t.z, .8); } } }
      else if (k === 'p' || k === 'P') { togglePause(); }
      else if (k === 'r' || k === 'R') { if (mendCount() > 0) doMend(); }
      else if (k === 'Tab') { cycleSpeed(); e.preventDefault(); }
      else if (k === '0') { camReset(); }
      else if (k === 'm' || k === 'M') { setMute(!AU.muted); }
      else if (k === '+' || k === '=') { camZoomBy(1.4); }
      else if (k === '-' || k === '_') { camZoomBy(1 / 1.4); }
      else if (k === 'c' || k === 'C') { toggleCommand(); }
      else if (k === 'f' || k === 'F' || k === 'Home') { camReset(); }
    });
  }
  const PAN = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1], KeyA: [1, 0], KeyD: [-1, 0], KeyW: [0, 1], KeyS: [0, -1] };
  function togglePause() { G.paused = !G.paused; sfx('uiClick', CAM.x, CAM.z, .6); }
  function cycleSpeed() { G.speed = G.speed % 3 + 1; if (G.paused) G.paused = false; sfx('uiClick', CAM.x, CAM.z, .6); }
  function soundTap() { if (AU.ready && U.sndArmed) setMute(!AU.muted); }
  U.sawMonster = type => { if (G.seen[type]) return; G.seen[type] = 1; if (MON[type].tip && U.tips.length < 4) U.tips.push(type); };
  U.sawElite = kind => { const key = 'elite:' + kind; if (G.seen[key]) return; G.seen[key] = 1; if (U.tips.length < 5) U.tips.push(key); };
  const HELP = {
    cmd: () => ['You command', U.touch ? 'Tap a pad to build. Spells: tap one, then the road. The gear button has help and sound.' : 'Click a pad to build. Q E T cast spells on the road. O opens settings and help.'],
    mend: () => ['The beacon is hurt', U.touch ? 'Tap Mend, under your gold, to buy back lives.' : 'Mend (R, or the button under your gold) buys back lives.'],
    branch: () => ['Choose a branch', 'A tower at its top level can take one of two branches. Open its menu to pick one.'],
    idle: () => ['Need a hand?', (U.touch ? 'Tap' : 'Click') + ' the commander plate, top right, and the AI plays again.'],
    oc: () => ['Overcharge', 'A tower with a branch can be overcharged three times, for more damage each time.'],
  };
  const tipInfo = key => { if (key.startsWith('help:')) { const h = HELP[key.slice(5)](); return { head: h[0], tip: h[1], bd: COLR.bdHi, dur: 7.5 }; } if (key.startsWith('event:')) { const E = EVENTS[key.slice(6)]; return { head: E.name, tip: E.tip, bd: '#5a7a9a' }; } if (key.startsWith('elite:')) { const E = ELITE[key.slice(6)]; return { head: 'Elite: ' + E.name, tip: E.tip + ' Worth more gold.', bd: E.col }; } const d = MON[key]; return { head: (d.boss ? 'Boss: ' : 'New: ') + d.name, tip: d.tip, bd: d.boss ? COLR.ember : '#8a6a3a' }; };
  // One line of numbers for a branch, in the words the menu uses.
  function branchStat(kind, key) {
    const b = TOWER[kind].branches[key], f = v => (Math.round(v * 10) / 10).toString();
    if (key === 'longbow') return 'Range ' + f(b.range) + ' · Damage ' + b.dmg;
    if (key === 'volley') return 'Range ' + f(b.range) + ' · Damage ' + b.dmg + 'x' + b.multi;
    if (key === 'mortar') return 'Range ' + f(b.range) + ' · Damage ' + b.dmg;
    if (key === 'firebomb') return 'Damage ' + b.dmg + ' · Fire ' + b.fire[2] + '/s';
    if (key === 'tempest') return 'Damage ' + b.dmg + ' · ' + b.jumps + ' jumps';
    if (key === 'frost') return 'Slow ' + Math.round(b.slow * 100) + '% · Freeze ' + f(b.freeze) + 's';
    if (key === 'knights') return b.n + ' knights · ' + b.hp + ' health';
    return b.n + ' pikemen · ' + b.hp + ' health';
  }
  U.branchStat = branchStat;
  // For tests and tools (window.__cw.UI.game): the game actions the UI itself uses.
  U.game = { buildTower, upgradeTower, branchTower, overchargeTower, overchargeCost, canBranch, castSpell, spellReady, branchCost, mendBeacon, mendCount, mendCost, sellTower, callWaveEarly, padCoverage, TOWER, SPELL, BRANCH_KEYS };
  U.keepAwake = () => { try { if (navigator.wakeLock && !document.hidden && (!U.wake || U.wake.released)) navigator.wakeLock.request('screen').then(w => { U.wake = w; }, () => {}); } catch (e) {} };
  U.dropTouches = () => { U.ptrs.clear(); U.gest = null; U.press = null; if (U.touch) U.inside = false; };
  function fixPageZoom() {
    const vv = window.visualViewport, m = document.getElementById('vp'); if (!vv || !m || Math.abs(vv.scale - 1) < .02) { U.vvN = 0; return; }
    const now = performance.now(); if (now - U.vvT < 250 || U.vvN > 12) return; U.vvT = now; U.vvN++;
    const c = 'width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
    m.setAttribute('content', c + ',shrink-to-fit=no'); setTimeout(() => { m.setAttribute('content', c); try { window.scrollTo(0, 0); } catch (e) {} resizeRenderer(); }, 40);
  }
  function setMute(b) { AU.setMuted(b); try { localStorage.setItem('cinderwatch.muted', b ? '1' : '0'); } catch (e) {} }
  function fullscreenOK() { const d = document; return !!(d.fullscreenEnabled || d.webkitFullscreenEnabled) && !(window.navigator.standalone); }
  function isFull() { const d = document; return !!(d.fullscreenElement || d.webkitFullscreenElement); }
  function toggleFull() {
    const d = document, el = d.documentElement;
    try { if (isFull()) (d.exitFullscreen || d.webkitExitFullscreen).call(d); else { const r = (el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: 'hide' }); if (r && r.catch) r.catch(() => {}); } } catch (e) {}
  }
  function buzz(p) { if (U.touch && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} } }
  function inRect(r, x, y, min = 0) {
    if (!r) return false; const m = min * (R.dpr || 1), mw = Math.max(0, m - r.w) / 2, mh = Math.max(0, m - r.h) / 2;
    return x >= r.x - mw && x <= r.x + r.w + mw && y >= r.y - mh && y <= r.y + r.h + mh;
  }
  function btnAt(x, y) {
    const m = U.touch ? 44 : 0; for (const b of U.btns) if (inRect(b, x, y, m)) return b;
    if (inRect(U.panelRect, x, y, 0) || inRect(U.menuRect, x, y, 0)) return null; // a modal plate or a tower menu covers the HUD buttons under it
    for (const b of U.hud) if (inRect(b, x, y, m)) return b; return null;
  }
  function hudAt(x, y) { return inRect(U.menuRect, x, y, 0) || inRect(U.panelRect, x, y, 0); }
  function callWave() { touchInput(); if (callWaveEarly()) { sfx('uiClick', CAM.x, CAM.z, .8); buzz(10); } else sfx('uiDeny', CAM.x, CAM.z, .5); }
  function audioGesture() { if (!AU.ready) AU.unlock(); }
  function touchInput() { U.idle = 0; if (!U.manual) { U.manual = true; takeCommand(); } }
  function toggleCommand() { U.setManual(!U.manual); U.idle = 0; sfx('uiClick', CAM.x, CAM.z, .8); }
  function deny() { U.deny = 1; sfx('uiDeny', CAM.x, CAM.z, .6); buzz([18, 40, 18]); }
  function doBuild(pad, kind) { touchInput(); if (buildTower(pad, kind, true)) { sfx('uiClick', pad.x, pad.z, .8); buzz(12); U.menu = null; U.armed = null; return true; } deny(); return false; }
  function doUpgrade(t) {
    // A max-level tower needs a branch choice first: open its menu instead of guessing.
    if (t.lvl === 2 && !t.branch) { if (!U.menu || U.menu.tower !== t) { U.menu = { pad: t.pad, tower: t, t: 0, focus: 0, sel: null, sellArm: false }; sfx('uiHover', t.x, t.z, .8); } else deny(); return false; }
    if (t.lvl >= 3 ? overchargeTower(t, true) : upgradeTower(t, true)) { sfx('uiClick', t.x, t.z, .8); buzz(12); U.menu = null; return true; } deny(); return false;
  }
  function doBranch(t, key) { if (branchTower(t, key, true)) { sfx('uiClick', t.x, t.z, .8); buzz([12, 30, 20]); U.menu = null; return true; } deny(); return false; }
  // Spells: pick one (key, button), then click or tap the ground. Picking it again, Esc or Cancel puts it away.
  function pickSpell(kind) {
    if (G.phase !== 'play') return; touchInput();
    if (U.spell === kind) { U.spell = null; sfx('uiHover', CAM.x, CAM.z, .6); return; }
    if (!spellReady(kind)) { deny(); return; }
    U.spell = kind; U.menu = null; U.armed = null; sfx('uiHover', CAM.x, CAM.z, .9); buzz(8);
  }
  function groundPick(mx, my) {
    if (!G.B) return null; const cam = R.cam; _o.set(mx / R.dw * 2 - 1, 1 - my / R.dh * 2, -1).unproject(cam); cam.getWorldDirection(_d);
    if (Math.abs(_d.y) < 1e-4) return null; let t = -_o.y / _d.y;
    for (let i = 0; i < 6; i++) t = (G.B.heightAt(_o.x + _d.x * t, _o.z + _d.z * t) - _o.y) / _d.y;
    const x = _o.x + _d.x * t, z = _o.z + _d.z * t; return isFinite(x) && isFinite(z) && Math.abs(x) < 40 && Math.abs(z) < 40 ? { x, z } : null;
  }
  function castAt(x, y) {
    const k = U.spell, g = groundPick(x, y); touchInput();
    if (g && castSpell(k, g.x, g.z, true)) { U.spell = null; buzz(20); return true; }
    deny(); return false;
  }
  function doMend() { touchInput(); if (mendBeacon(true)) { sfx('uiClick', CAM.x, CAM.z, .8); buzz(12); return true; } deny(); return false; }
  function doSell(t) { if (sellTower(t)) { U.menu = null; return true; } return false; }
  function pickKind(kind) {
    touchInput();
    if (U.menu && U.menu.pad && !U.menu.pad.tower) { doBuild(U.menu.pad, kind); return; }
    if (U.hover && !U.hover.tower) { doBuild(U.hover.pad, kind); return; }
    if (U.gp.active && U.gp.sel >= 0 && !G.B.pads[U.gp.sel].tower) { doBuild(G.B.pads[U.gp.sel], kind); return; }
    U.armed = U.armed === kind ? null : kind; U.menu = null; sfx('uiHover', CAM.x, CAM.z, .7);
  }
  function pickPad(mx, my) {
    if (!G.B || G.phase !== 'play') return null;
    const cam = R.cam; _o.set(mx / R.dw * 2 - 1, 1 - my / R.dh * 2, -1).unproject(cam); cam.getWorldDirection(_d);
    let best = null, bd = 1e9; const slop = U.touch ? clamp(24 * (R.viewW || 40) / (R.cssW || 800), 1.55, 2.3) : 1.55;
    for (const pad of G.B.pads) {
      const top = pad.tower ? Math.min(3.4, pad.tower.mounts ? pad.tower.mounts.top : 2) : .1;
      for (let h = 0; h <= top; h += .6) {
        const t = (pad.y + h - _o.y) / _d.y, x = _o.x + _d.x * t, z = _o.z + _d.z * t, d = Math.hypot(x - pad.x, z - pad.z), r = h === 0 ? slop : slop - .55;
        if (d < r && d + h * .01 < bd) { bd = d; best = pad; }
      }
    }
    return best ? { pad: best, tower: best.tower } : null;
  }
  function onTap(x, y, held) {
    const now = performance.now();
    const b = held && inRect(held, x, y, U.touch ? 44 : 8) ? held : btnAt(x, y);
    if (U.offer) { if (b && (b.id === 'cont' || b.id === 'newg')) b.fn(x, y); return; }
    // Settings and the run summary are modal: a tap outside the settings closes them; nothing reaches the board or the HUD underneath.
    if (U.sets && !(b && U.btns.some(o => o.id === b.id))) { if (!inRect(U.panelRect, x, y, 0) || (b && b.id === 'gear')) openSettings(false); return; }
    if (b) { if (!b.hud) touchInput(); b.fn(x, y); return; }
    if (U.panelRect && inRect(U.panelRect, x, y, 0)) return;
    if (U.spell) { castAt(x, y); return; }
    if (inRect(U.menuRect, x, y, 0)) return;
    const h = pickPad(x, y);
    if (h) {
      touchInput(); U.lastTap.t = -9;
      if (!h.tower && U.armed) { doBuild(h.pad, U.armed); return; }
      if (U.menu && U.menu.pad === h.pad) { U.menu = null; return; }
      U.menu = { pad: h.pad, tower: h.tower, t: 0, focus: 0, sel: null, sellArm: false }; U.armed = null; sfx('uiHover', h.pad.x, h.pad.z, .9); buzz(6); return;
    }
    if (U.menu || U.armed) { U.menu = null; U.armed = null; U.lastTap.t = -9; return; }
    if (now - U.lastTap.t < 330 && Math.hypot(x - U.lastTap.x, y - U.lastTap.y) < 40 * (R.dpr || 1)) { U.lastTap.t = -9; if (CAM.man && CAM.mzoom > 1.3) camReset(); else camZoomTo(Math.max(1.9, (CAM.man ? CAM.mzoom : CAM.zoom) * 1.6), x, y); }
    else { U.lastTap.t = now; U.lastTap.x = x; U.lastTap.y = y; }
  }
  function setRing(mesh, cx, cz, radius, width) {
    const P = mesh.geometry.attributes.position, a = P.array, H = G.B.heightAt, n = mesh.seg;
    for (let i = 0; i <= n; i++) { const t = i / n * TAU, c = Math.cos(t), s = Math.sin(t); for (let k = 0; k < 2; k++) { const r = radius + (k ? width : 0), x = cx + c * r, z = cz + s * r, o = (i * 2 + k) * 3; a[o] = x; a[o + 1] = H(x, z) + .1; a[o + 2] = z; } }
    P.needsUpdate = true; mesh.visible = true;
  }
  function pollGamepad(dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : []; let gp = null; for (const p of pads) if (p && p.connected) { gp = p; break; }
    if (!gp || !G.B || G.phase !== 'play') return;
    const st = U.gp, b = i => !!(gp.buttons[i] && gp.buttons[i].pressed), was = i => !!st.prev[i], hit = i => b(i) && !was(i);
    let ax = (Math.abs(gp.axes[0]) > .5 ? Math.sign(gp.axes[0]) : 0) + (b(15) ? 1 : 0) - (b(14) ? 1 : 0), ay = (Math.abs(gp.axes[1]) > .5 ? Math.sign(gp.axes[1]) : 0) + (b(13) ? 1 : 0) - (b(12) ? 1 : 0);
    st.t -= dt;
    if (U.offer) { if (hit(0)) takeOffer(true); else if (hit(1)) takeOffer(false); for (let i = 0; i < 16; i++) st.prev[i] = b(i); return; }
    if ((ax || ay) && st.t <= 0) {
      st.t = .22; st.active = true; touchInput(); audioGesture();
      if (U.menu) { const n = U.btns.length || 1; U.menu.focus = ((U.menu.focus + (ax || ay)) % n + n) % n; sfx('uiHover', CAM.x, CAM.z, .6); }
      else {
        const P = G.B.pads; if (st.sel < 0) st.sel = 0; const cur = proj(P[st.sel].x, P[st.sel].y, P[st.sel].z); let best = -1, bs = 1e9;
        P.forEach((p, i) => { if (i === st.sel) return; const q = proj(p.x, p.y, p.z), dx = q.x - cur.x, dy = q.y - cur.y, along = dx * ax + dy * ay; if (along <= 4) return; const off = Math.abs(-dx * ay + dy * ax), sc = along + off * 2.2; if (sc < bs) { bs = sc; best = i; } });
        if (best >= 0) { st.sel = best; sfx('uiHover', CAM.x, CAM.z, .6); }
      }
    }
    if (!ax && !ay) st.t = 0;
    if (hit(0)) { touchInput(); audioGesture(); st.active = true; if (st.sel < 0) st.sel = 0; if (U.menu) { const bt = U.btns[U.menu.focus]; if (bt) bt.fn(); } else { const pad = G.B.pads[st.sel]; U.menu = { pad, tower: pad.tower, t: 0, focus: 0, sel: null, sellArm: false }; sfx('uiHover', pad.x, pad.z, .9); } }
    if (hit(1)) { U.closeMenu(); touchInput(); }
    if (hit(2)) { const pad = st.sel >= 0 ? G.B.pads[st.sel] : null; if (pad && pad.tower) { touchInput(); doUpgrade(pad.tower); } }
    if (hit(3) || hit(9)) callWave();
    for (let i = 0; i < 16; i++) st.prev[i] = b(i);
  }

  function update(dt) {
    U.idle += dt; U.moved += dt; U.hurt = Math.max(0, U.hurt - dt * 1.6); U.goldBump = Math.max(0, U.goldBump - dt * 5); U.deny = Math.max(0, U.deny - dt * 3); if (U.offer) U.offer.t += dt; else U.titleT += dt; U.slainBump = Math.max(0, U.slainBump - dt * 4);
    if (G.slain !== U.lastSlain) { U.lastSlain = G.slain; U.slainBump = 1; }
    { const dpr = R.dpr || 1, iw = n => PX.iconSize(n)[0], m3 = PX.measure('000'); let sc = Math.max(2, Math.round(clamp(Math.min(R.cssH / 430, R.cssW / 225), 1.6, 4) * dpr));
      let st = 4; for (const [ic, v] of [['flame', G.lives], ['coin', Math.floor(U.goldShown)], ['skull', G.slain]]) st += iw(ic) + 8 + Math.max(PX.measure('' + v), m3);
      const cm = Math.max(iw('helm') + 3 + PX.measure('AI commander'), PX.measure(U.touch ? 'Tap a pad to play' : 'Click a pad to take over')) + 12, minS = Math.max(2, Math.ceil(1.3 * dpr));
      while (sc > minS && (st + cm + 13) * sc + R.safe[0] + R.safe[2] > R.dw) sc--;
      U.s = sc; }
    U.panning = !!(U.gest && U.gest.mode === 'pan');
    if (AU.ready && !U.ptrs.size) U.sndArmed = true;
    if (U.keys.size) { let kx = 0, ky = 0; for (const k of U.keys) { kx += PAN[k][0]; ky += PAN[k][1]; } if (kx || ky) { CAM.za = null; camPan(kx * R.dh * .9 * dt, ky * R.dh * .9 * dt); } }
    if (G.phase === 'defeat') U.tip = null;
    else if (U.tip) { if (!U.menu) U.tip.t += dt; if (U.tip.t > U.tip.dur) U.tip = null; } else if (U.tips.length && U.titleT > 7.5) { const type = U.tips.shift(); U.tip = { type, t: 0, dur: tipInfo(type).dur || 5.2 }; }
    if (window.visualViewport && Math.abs(window.visualViewport.scale - 1) > .02) fixPageZoom();
    pollGamepad(dt);
    if (U.sets) U.sets.t += dt;
    // First steps for a player in command: one help line each, the first time it matters.
    if (U.manual && G.phase === 'play') {
      if (G.lives <= G.maxLives - 4) helpTip('mend');
      if (G.lives <= 8 && U.idle > 20) helpTip('idle');
      for (const t of G.towers) if (t.alive && t.state === 'active') { if (t.lvl === 2 && !t.branch) helpTip('branch'); else if (t.branch && !t.oc) helpTip('oc'); }
    }
    if (U.menu) { U.menu.t += dt; if ((U.menu.tower && !U.menu.tower.alive) || G.phase !== 'play') U.menu = null; else if (U.menu.pad.tower !== U.menu.tower) U.menu.tower = U.menu.pad.tower; }
    if (G.phase !== 'play') { U.armed = null; U.hover = null; U.spell = null; }
    else U.hover = (U.inside && !U.touch && !U.hotBtn && !U.panning && !U.spell && !U.sets && !U.offer) ? pickPad(U.mx, U.my) : null;
    for (const k of SPELL_KINDS) { const n = G.stats[k] || 0; if (n !== (U.spellSeen[k] || 0)) { U.spellSeen[k] = n; U.spellFlash[k] = 1; } U.spellFlash[k] = Math.max(0, (U.spellFlash[k] || 0) - dt * 1.5); }
    U.gpt = U.spell && U.inside && !U.touch && !U.hotBtn && !U.hudHot ? groundPick(U.mx, U.my) : null;
    if (U.goldShown > G.gold) U.goldShown = G.gold;
    if (!U.coins.length && U.goldShown < G.gold) U.goldShown = Math.min(G.gold, U.goldShown + Math.max(1, (G.gold - U.goldShown) * 6 * dt));
    const tgt = U.menu ? U.menu : (U.gp.active && U.gp.sel >= 0 && G.phase === 'play' ? { pad: G.B.pads[U.gp.sel], tower: G.B.pads[U.gp.sel].tower } : U.hover);
    if (U.gpt) {
      const r = SPELL[U.spell].r, pulse = .5 + .5 * Math.sin(G.t * 6), col = U.spell === 'frost' ? [.9, 1.4, 2.2] : U.spell === 'rally' ? [2.2, 1.8, .9] : [2.4, 1.1, .4];
      setRing(U.rangeMesh, U.gpt.x, U.gpt.z, r, .12); U.rangeMesh.material.opacity = .45 + .25 * pulse; U.rangeMesh.material.color.setRGB(col[0], col[1], col[2]);
      setRing(U.padMesh, U.gpt.x, U.gpt.z, .35, .1); U.padMesh.material.opacity = .6;
    } else if (tgt && G.B && G.phase === 'play') {
      const pad = tgt.pad, pulse = .5 + .5 * Math.sin(G.t * 5);
      U.rangeMesh.material.color.setRGB(1.5, 1.15, .6);
      setRing(U.padMesh, pad.x, pad.z, 1.5, .1); U.padMesh.material.opacity = .45 + .25 * pulse;
      let range = 0; const bk = tgt.tower && U.menu && U.menu.tower === tgt.tower && canBranch(tgt.tower) ? (U.menu.sel || (U.hotBtn && U.hotBtn.branch)) : null;
      if (bk) range = tgt.tower.def.branches[bk].range || tgt.tower.range; else if (tgt.tower) range = tgt.tower.range; else { const kind = (U.menu && (U.menu.sel || (U.hotBtn && U.hotBtn.kind))) || U.armed || (U.menu && U.btns[U.menu.focus] && U.gp.active && U.btns[U.menu.focus].kind) || 'archer'; range = TOWER[kind].range[0]; }
      setRing(U.rangeMesh, pad.x, pad.z, range, .07); U.rangeMesh.material.opacity = .34;
    } else { U.padMesh.visible = false; U.rangeMesh.visible = false; }
    R.canvas.style.cursor = U.panning ? 'grabbing' : U.spell && !U.hotBtn && !U.hudHot ? 'crosshair' : (U.hotBtn || U.hover || U.hudHot) ? 'pointer' : 'default';
  }

  function draw() {
    const c = U.ctx, s = U.s, W = R.dw, H = R.dh, pad = 5 * s, LH = PX.LINE * s;
    c.clearRect(0, 0, W, H); U.btns.length = 0; let hot = null;
    const pix = Math.max(1, Math.round(R.dh / R.ih)), es = Math.max(1, s - 1), tags = [];
    // Crowds: ordinary bars shrink and fade a little as the count of bars grows, so a big fight stays readable.
    let nOrd = 0; for (const b of G.hbars) if (!b.boss && !b.elite && !b.man) nOrd++;
    const crowd = sat((nOrd - 30) / 90), ordW = Math.round(9 - 3 * crowd), ordA = .95 - .3 * crowd;
    for (const b of G.hbars) {
      const ord = !b.boss && !b.elite && !b.man, p = proj(b.x, b.y, b.z), w = (b.boss ? 34 : b.man ? 8 : b.elite ? 12 : ordW) * pix, h = (b.boss ? 2 : 1) * pix, x = Math.round(p.x - w / 2);
      // A boss's bar and name never tuck under the top plates (wave, stats, commander): they stop just below them.
      const y = b.boss ? Math.max(Math.round(p.y), Math.round((R.hudTop || 0) + LH + 4 * pix)) : Math.round(p.y);
      if (x < -w || x > W || y < 0 || y > H) continue;
      c.globalAlpha = b.f >= .999 && !b.elite ? .4 : ord ? ordA : .95;
      c.fillStyle = b.elite ? ELITE[b.elite].col : COLR.dark; c.fillRect(x - pix, y - pix, w + 2 * pix, h + 2 * pix);
      if (b.elite) { c.fillStyle = COLR.dark; c.fillRect(x, y, w, h); }
      c.fillStyle = b.man ? '#7fb6ea' : (b.f > .5 ? '#d9a13c' : b.f > .25 ? '#e0762c' : '#e04a32'); c.fillRect(x, y, Math.max(pix, Math.round(w * b.f)), h);
      if (b.sh > 0) { c.fillStyle = '#bfe4ff'; c.fillRect(x, y - 2 * pix, Math.max(pix, Math.round(w * Math.min(1, b.sh / .6))), pix); }
      c.globalAlpha = 1;
      if (b.boss) text(b.name, p.x, y - LH - 2 * pix, COLR.tx, { align: 'c', outline: COLR.dark });
      else if (b.elite && tags.length < (crowd > .25 ? 4 : 12)) {
        // Name tags for elites, skipped where they would pile onto one already drawn.
        // Smaller in a crowd (and on a phone's big UI scale), so the tags do not bury the fight.
        const ts = Math.max(1, Math.min(es, Math.max(2, Math.floor(s * (crowd > .25 ? .45 : .55))))), tw2 = PX.measure(b.name) * ts, ty = y - PX.LINE * ts - 2 * pix, tx = p.x - tw2 / 2, th = PX.LINE * ts;
        if (!tags.some(r => tx < r[0] + r[2] && tx + tw2 > r[0] && ty < r[1] + r[3] && ty + th > r[1])) { tags.push([tx, ty, tw2, th, b.name, p.x, ts, ELITE[b.elite].col]); }
      }
    }
    for (const g of tags) PX.text(c, g[4], g[5], g[1], g[6], g[7], { align: 'c', outline: COLR.dark });
    const [iL, iT, iR, iB] = R.safe, Wr = W - iR, Hb = H - iB, tch = U.touch, mouse = U.inside && !tch && !U.panning;
    const over = (x, y, w, h) => mouse && U.mx >= x && U.mx <= x + w && U.my >= y && U.my <= y + h;
    const stats = [['flame', '' + G.lives, U.hurt > 0 ? COLR.red : COLR.tx], ['coin', '' + Math.floor(U.goldShown), U.deny > 0 ? COLR.red : (U.goldBump > 0 ? '#ffe2a0' : COLR.tx)], ['skull', '' + G.slain, U.slainBump > .5 ? '#ffffff' : COLR.tx]];
    let wS = pad; for (const st of stats) wS += PX.iconSize(st[0])[0] * s + 2 * s + Math.max(tw(st[1]), tw('000')) + 6 * s; wS += pad - 6 * s;
    const hS = 10 * s + pad * 2 - 2 * s, x0 = 5 * s + iL, y0 = 5 * s + iT + U.insetTop;
    // Coins fly to the gold icon and are drawn before the plate, so they slip under the counters instead of covering them.
    const goldPos = { x: x0 + pad + (PX.iconSize('flame')[0] + 2) * s + Math.max(tw(stats[0][1]), tw('000')) + 6 * s + PX.iconSize('coin')[0] * s / 2, y: y0 + hS / 2 };
    for (let i = U.coins.length - 1; i >= 0; i--) {
      const q = U.coins[i]; q.t += R.frameDt; const u = sat(q.t / q.T), e = u * u * (3 - 2 * u), a = 1 - e;
      const px = a * a * q.sx + 2 * a * e * q.cx + e * e * goldPos.x, py = a * a * q.sy + 2 * a * e * q.cy + e * e * goldPos.y;
      PX.icon(c, 'coin', Math.round(px - 4 * s * .75), Math.round(py - 4 * s * .75), Math.max(2, s - 1), 1);
      if (u >= 1) { U.goldShown = Math.min(G.gold, U.goldShown + q.value); U.goldBump = 1; sfx('coin', CAM.x, CAM.z, .35, rnd()); U.coins.splice(i, 1); }
    }
    plate(x0, y0, wS, hS, U.hurt > 0 ? { bd: COLR.red } : {});
    let x = x0 + pad;
    for (const st of stats) {
      const [iw, ih] = PX.iconSize(st[0]); const iy = y0 + Math.round((hS - ih * s) / 2);
      PX.icon(c, st[0], x, iy, s, st[0] === 'flame' ? .55 + .45 * (G.lives / G.maxLives) : 1);
      x += iw * s + 2 * s; text(st[1], x, y0 + Math.round((hS - LH) / 2) + s, st[2]); x += Math.max(tw(st[1]), tw('000')) + 6 * s;
    }
    const NW = G.wavesPerLand, wn = 'Wave ' + Math.max(1, landWave()) + '/' + NW, callable = G.phase === 'play' && !G.spawning && !G.bossWave && G.nextIn > .4;
    let sub, frac = -1, subCol = null;
    if (G.phase === 'play') {
      if (!G.spawning && !G.bossWave && G.nextIn > 0) {
        const nk = G.k % NW + 1, nextHorde = isHordeK(nk, G.level), nextBoss = isBossK(nk);
        const warn = nextHorde || nextBoss, showCall = callable && (tch ? !(warn && G.t % 3 < 1.5) : over(U.waveRect ? U.waveRect.x : -1, U.waveRect ? U.waveRect.y : -1, U.waveRect ? U.waveRect.w : 0, U.waveRect ? U.waveRect.h : 0));
        sub = showCall ? (G.restored ? (tch ? 'Tap to call now' : 'Call now') : (tch ? 'Tap to call · +' : 'Call now · +') + Math.round(G.nextIn * 3)) : (nextHorde ? 'Horde in ' : nextBoss ? 'Boss in ' : 'Next wave in ') + Math.ceil(G.nextIn);
        if (warn && !showCall) subCol = COLR.ember; frac = 1 - G.nextIn / 6.5;
      } else { const n = G.mons.length + G.queue.length; sub = (G.horde ? 'Horde · ' : '') + n + ' on the road'; if (G.horde) subCol = COLR.ember; }
    }
    else sub = G.phase === 'defeat' ? 'The fire has died' : G.phase === 'clear' ? 'Boss defeated' : 'A new pass awaits';
    const bw = PX.iconSize('banner')[0] * s, wW = Math.max(bw + 3 * s + tw(wn), tw(sub), tw('Next wave in 0'), tw('Tap to call · +00')) + pad * 2 + 4 * s, hW = LH * 2 + pad * 2 + s;
    const you = U.playerActive(), ct = you ? 'You command' : 'AI commander', cs = tch ? (you ? 'Tap for the AI' : 'Tap a pad to play') : (you ? 'Click here for the AI' : 'Click a pad to take over');
    const ic = you ? 'hand' : 'helm', icw = PX.iconSize(ic)[0] * s, cW = Math.max(icw + 3 * s + tw(ct), tw(cs)) + pad * 2 + 2 * s, xc = Wr - cW - 5 * s, g3 = 3 * s;
    const xw = Math.round(W / 2 - wW / 2);
    let yc = y0, yw = y0;
    if (xc < x0 + wS + g3) yc = y0 + hS + g3;
    if (xw < x0 + wS + g3 || (yc === y0 && xw + wW > xc - g3) || yc !== y0) yw = Math.max(y0 + hS, yc + (yc === y0 || xw + wW > xc - g3 ? hW : 0)) + g3;
    const topH = Math.max(y0 + hS, yc + hW, yw + hW) - y0; R.hudTop = y0 + topH;
    U.hud.length = 0; U.hudHot = false;
    const hotW = callable && over(xw, yw, wW, hW); U.waveRect = callable ? { id: 'wave', x: xw, y: yw, w: wW, h: hW, hot: hotW, fn: callWave, hud: true } : null; if (callable) U.hud.push(U.waveRect); if (hotW) U.hudHot = true;
    plate(xw, yw, wW, hW, hotW ? { bd: COLR.bdHi, bg: COLR.bg2 } : callable && tch ? { bd: '#8a6a3a' } : {});
    const tx0 = Math.round(W / 2 - (bw + 3 * s + tw(wn)) / 2);
    PX.icon(c, 'banner', tx0, yw + pad - s, s); text(wn, tx0 + bw + 3 * s, yw + pad, COLR.amber);
    text(sub, W / 2, yw + pad + LH + s, subCol || (callable && (tch || hotW) ? COLR.tx : COLR.dim), { align: 'c' });
    if (frac >= 0) { c.fillStyle = '#2a2620'; c.fillRect(xw + 3 * s, yw + hW - 3 * s, wW - 6 * s, s); c.fillStyle = COLR.amber; c.fillRect(xw + 3 * s, yw + hW - 3 * s, Math.round((wW - 6 * s) * sat(frac)), s); }
    const hotC = over(xc, yc, cW, hW); U.cmdRect = { id: 'cmd', x: xc, y: yc, w: cW, h: hW, hot: hotC, fn: toggleCommand, hud: true }; U.hud.push(U.cmdRect); if (hotC) U.hudHot = true;
    plate(xc, yc, cW, hW, hotC ? { bd: COLR.bdHi, bg: COLR.bg2 } : you ? { bd: COLR.bdHi } : {});
    PX.icon(c, ic, xc + pad, yc + pad - s, s); text(ct, xc + pad + icw + 3 * s, yc + pad, you ? COLR.amber : COLR.tx); text(cs, xc + pad, yc + pad + LH + s, COLR.dim);
    U.mendRect = null;
    if (G.phase === 'play' && mendCount() > 0) {
      // Mend the beacon: a small button under the stats plate, shown while the beacon has lost lives.
      const n = mendCount(), mc = mendCost(), can = G.gold >= mc, l1 = 'Mend +' + n, fw = PX.iconSize('flame')[0] * s, cw = PX.iconSize('coin')[0] * s;
      const mw = pad * 2 + fw + 2 * s + tw(l1) + 5 * s + cw + 2 * s + tw('' + mc), mh = LH + pad * 2 - s;
      let mx = x0, my = y0 + hS + g3;
      const hit = (x, y, w, h) => mx < x + w && mx + mw > x && my < y + h && my + mh > y;
      for (let i = 0; i < 2; i++) { if (hit(xw, yw, wW, hW)) my = yw + hW + g3; if (hit(xc, yc, cW, hW)) my = yc + hW + g3; }
      const hotM = over(mx, my, mw, mh), down = U.press === 'mend', dy = down ? s : 0;
      U.mendRect = { id: 'mend', x: mx, y: my, w: mw, h: mh, hot: hotM, fn: doMend, hud: true }; U.hud.push(U.mendRect); if (hotM) U.hudHot = true;
      const pulse = G.lives <= 8 && can ? .5 + .5 * Math.sin(G.t * 6) : 0;
      plate(mx, my + dy, mw, mh, hotM || down ? { bd: COLR.bdHi, bg: COLR.bg2 } : pulse > .5 ? { bd: COLR.ember } : {});
      let xx = mx + pad; const ty = my + dy + Math.round((mh - LH) / 2) + s;
      PX.icon(c, 'flame', xx, my + dy + Math.round((mh - PX.iconSize('flame')[1] * s) / 2), s, can ? 1 : .45); xx += fw + 2 * s;
      text(l1, xx, ty, can ? COLR.tx : COLR.dim); xx += tw(l1) + 5 * s;
      PX.icon(c, 'coin', xx, my + dy + Math.round((mh - PX.iconSize('coin')[1] * s) / 2), s, can ? 1 : .5); xx += cw + 2 * s;
      text('' + mc, xx, ty, can ? COLR.amber : COLR.red);
      if (hotM && !tch) { const tip = 'Mend the beacon (R)', w2 = tw(tip) + pad * 2; plate(mx, my + mh + g3, w2, mh, { bd: COLR.bdHi }); text(tip, mx + pad, my + mh + g3 + pad - s, COLR.tx); }
    }
    const dpr = R.dpr || 1, hB = LH + pad * 2 - s, zb = tch ? Math.max(22 * s, Math.round(40 * dpr)) : hB, yB = Hb - zb - 5 * s; let tipB = null;
    const sq = (id, x, w, fn, tip, icon, on) => {
      const r = { id, x, y: yB, w, h: zb, fn, hud: true }, hot = over(x, yB, w, zb), down = U.press === id, dy = down ? s : 0; U.hud.push(r); if (hot) { U.hudHot = true; tipB = { x: x + w / 2, tip }; }
      plate(x, yB + dy, w, zb, hot || down ? { bd: COLR.bdHi, bg: COLR.bg2 } : on ? { bd: '#8a6a3a' } : {}); icon(x, yB + dy, hot || down); return r;
    };
    const glyph = (g, col) => (x, y) => { const k = Math.max(s, Math.floor(zb / 10)); PX.text(c, g, x + zb / 2, y + Math.round(zb / 2 - 3.5 * k), k, col, { align: 'c' }); };
    const label = (t, col) => (x, y) => { const k = Math.max(s, Math.floor(zb / 15)); PX.text(c, t, x + zb / 2, y + Math.round((zb - PX.LINE * k) / 2) + k, k, col, { align: 'c' }); };
    const bars = (x, y) => { const u = zb / 18; c.fillStyle = COLR.tx; if (G.paused) { for (let i = 0; i < 4; i++) c.fillRect(Math.round(x + (6.5 + i * 1.5) * u), Math.round(y + (5 + i) * u), Math.ceil(1.5 * u), Math.round((8 - 2 * i) * u)); } else { c.fillRect(Math.round(x + 6 * u), Math.round(y + 5 * u), Math.round(2.2 * u), Math.round(8 * u)); c.fillRect(Math.round(x + 9.8 * u), Math.round(y + 5 * u), Math.round(2.2 * u), Math.round(8 * u)); } };
    const corners = (x, y) => { const u = Math.round(zb / 9), q = Math.round(zb / 5), f = isFull(); c.fillStyle = COLR.tx; for (const [ax, ay] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const cx = x + (ax ? zb - q - u : q), cy = y + (ay ? zb - q - u : q), ix = f ? (ax ? -1 : 1) : (ax ? 1 : -1), iy = f ? (ay ? -1 : 1) : (ay ? 1 : -1); c.fillRect(cx, cy, u, u); c.fillRect(cx - ix * u, cy, u, u); c.fillRect(cx, cy - iy * u, u, u); } };
    const play = G.phase === 'play' || G.phase === 'defeat', nR = (fullscreenOK() && tch ? 3 : 2), rightW = nR * zb + (nR - 1) * g3;
    let xl = 5 * s + iL;
    sq('pause', xl, zb, togglePause, G.paused ? 'Resume (P)' : 'Pause (P)', bars, G.paused); xl += zb + g3;
    sq('speed', xl, zb, cycleSpeed, 'Speed (Tab)', label(G.speed + 'x', G.speed > 1 ? COLR.amber : COLR.tx), G.speed > 1); xl += zb + g3;
    { const on = AU.ready && !AU.muted, icn = on ? 'sound' : 'mute', k = Math.max(s, Math.floor(zb / 14)), [iw2, ih2] = PX.iconSize(icn), lbl = tch ? 'Tap for sound' : 'Click for sound', wl = iw2 * s + 3 * s + tw(lbl) + pad * 2;
      const wide = !AU.ready && xl + wl + g3 + zb + g3 + rightW + 5 * s + iR <= W;
      U.soundRect = sq('sound', xl, wide ? wl : zb, soundTap, AU.ready ? (AU.muted ? 'Sound is off (M)' : 'Sound is on (M)') : 'Sound', (x, y) => { if (wide) { PX.icon(c, icn, x + pad, y + Math.round((zb - ih2 * s) / 2), s, .85); text(lbl, x + pad + iw2 * s + 3 * s, y + Math.round((zb - LH) / 2) + s, COLR.tx); } else PX.icon(c, icn, x + Math.round((zb - iw2 * k) / 2), y + Math.round((zb - ih2 * k) / 2), k, AU.ready ? 1 : .8); }, !AU.ready);
      xl += (wide ? wl : zb) + g3; }
    sq('gear', xl, zb, () => openSettings(), 'Settings and help (O)', (x, y) => { const [gw, gh] = PX.iconSize('gear'), k = Math.max(s, Math.floor(zb * .5 / gw)); PX.icon(c, 'gear', x + Math.round((zb - gw * k) / 2), y + Math.round((zb - gh * k) / 2), k, 1); }, !!U.sets); xl += zb + g3;
    let xr = Wr - 5 * s - zb; const cur = camZoomNow();
    if (nR === 3) { sq('full', xr, zb, toggleFull, 'Full screen', corners, false); xr -= zb + g3; }
    sq('zin', xr, zb, () => camZoomBy(1.5), 'Zoom in (+)', glyph('+', cur < 2.99 ? COLR.tx : '#5a5448'), false); xr -= zb + g3;
    sq('zout', xr, zb, () => camZoomBy(1 / 1.5), 'Zoom out (-)', glyph('-', cur > camZoomMin() + .01 ? COLR.tx : '#5a5448'), false);
    let yUp = yB - g3, rightTop = yB, hudBot = yB; // hudBot: the top of the bottom HUD row (buttons, mana bar)
    if (G.phase === 'play') {
      // Spells: three buttons under a mana bar. Bottom centre when there is room, else left of the zoom buttons, else stacked above them.
      const n = SPELL_KINDS.length, gw = n * zb + (n - 1) * g3, mh = 4 * s;
      let xs = Math.round((iL + Wr) / 2 - gw / 2), ys = yB, stacked = false;
      if (xs < xl || xs + gw > xr - g3) { xs = xr - g3 - gw; if (xs < xl) { xs = Wr - 5 * s - gw; ys = yB - g3 - zb - mh - s; stacked = true; rightTop = ys - mh - s; } }
      if (!stacked) { yUp = Math.min(yUp, yB - mh - s - g3); xr = xs; } else yUp = Math.min(yUp, rightTop - g3);
      const my = ys - mh - s; hudBot = Math.min(hudBot, my); c.fillStyle = COLR.dark; c.fillRect(xs, my, gw, mh); c.fillStyle = '#2a3446'; c.fillRect(xs + s, my + s, gw - 2 * s, mh - 2 * s);
      c.fillStyle = G.mana >= G.manaMax - .01 ? '#bfe4ff' : '#5fa2e6'; c.fillRect(xs + s, my + s, Math.round((gw - 2 * s) * sat(G.mana / G.manaMax)), mh - 2 * s);
      c.fillStyle = 'rgba(239,228,205,0.55)'; for (const k of SPELL_KINDS) c.fillRect(xs + s + Math.round((gw - 2 * s) * SPELL[k].mana / G.manaMax), my, s, mh);
      SPELL_KINDS.forEach((k, i) => {
        const S = SPELL[k], x = xs + i * (zb + g3), id = 'sp' + k, ready = spellReady(k), armed = U.spell === k, hot = over(x, ys, zb, zb), down = U.press === id, dy = down ? s : 0, fl = U.spellFlash[k] || 0;
        U.hud.push({ id, x, y: ys, w: zb, h: zb, fn: () => pickSpell(k), hud: true }); if (hot) { U.hudHot = true; tipB = { x: x + zb / 2, y: my - g3 - hB, tip: S.name + ' (' + S.key + ') · ' + S.mana + ' mana' }; }
        plate(x, ys + dy, zb, zb, armed || hot || down ? { bd: COLR.bdHi, bg: COLR.bg2 } : fl > .5 && fl % .5 > .25 ? { bd: COLR.ember } : ready ? { bd: '#5f86b0' } : {});
        const [iw, ih] = PX.iconSize(S.icon), kk = Math.max(s, Math.floor(zb * .6 / Math.max(iw, ih)));
        PX.icon(c, S.icon, x + Math.round((zb - iw * kk) / 2), ys + dy + Math.round((zb - ih * kk) / 2), kk, ready || armed ? 1 : .35);
        const cdF = G.spellCd[k] / S.cd; if (cdF > 0) { c.globalAlpha = .6; c.fillStyle = COLR.dark; const hh = Math.round((zb - 4 * s) * cdF); c.fillRect(x + 2 * s, ys + dy + zb - 2 * s - hh, zb - 4 * s, hh); c.globalAlpha = 1; }
        if (!tch) PX.text(c, S.key, x + 3 * s, ys + dy + 2 * s, es, ready ? COLR.tx : COLR.dim);
        if (G.mana < S.mana && cdF <= 0) PX.text(c, '' + S.mana, x + zb - 3 * s, ys + dy + zb - PX.LINE * es - s, es, COLR.cold, { align: 'r' });
      });
    }
    if (CAM.man && play) {
      const lbl = 'Follow the fight', w = tw(lbl) + pad * 2, fits = xr - g3 - w >= xl, xf2 = fits ? xr - g3 - w : Wr - w - 5 * s, yf = fits ? yB + Math.round((zb - hB) / 2) : rightTop - g3 - hB, hotF = over(xf2, yf, w, hB);
      plate(xf2, yf, w, hB, hotF ? { bd: COLR.bdHi, bg: COLR.bg2 } : { bd: '#8a6a3a' }); text(lbl, xf2 + pad, yf + pad - s, COLR.tx);
      U.followRect = { id: 'follow', x: xf2, y: yf, w, h: hB, hot: hotF, fn: () => { camReset(); sfx('uiClick', CAM.x, CAM.z, .6); }, hud: true }; U.hud.push(U.followRect); if (hotF) U.hudHot = true; if (!fits) yUp = yf - g3; hudBot = Math.min(hudBot, yf);
    } else U.followRect = null;
    if (tipB && !tch) { const w = tw(tipB.tip) + pad * 2, x = clamp(Math.round(tipB.x - w / 2), 4 * s + iL, Wr - w - 4 * s), ty = tipB.y || yB - g3 - hB; plate(x, ty, w, hB, { bd: COLR.bdHi }); text(tipB.tip, x + pad, ty + pad - s, COLR.tx); yUp = Math.min(yUp, ty - g3); }
    const wrap = (str, maxW) => { const out = []; let cur2 = ''; for (const wd of str.split(' ')) { const t = cur2 ? cur2 + ' ' + wd : wd; if (cur2 && tw(t) > maxW) { out.push(cur2); cur2 = wd; } else cur2 = t; } if (cur2) out.push(cur2); return out; };
    const boxW = Wr - iL - 10 * s;
    if (U.spell && G.phase === 'play') {
      // The armed spell: what to do next, and a Cancel button.
      const S = SPELL[U.spell], l1 = S.name + ': ' + (tch ? 'tap the ground' : 'click the ground'), cl = 'Cancel', cbw = tw(cl) + pad * 2, cbh = LH + pad * 2 - s;
      let l2 = tch ? S.desc : S.desc + ' Esc cancels.'; if (Math.max(tw(l1), tw(l2)) + pad * 3 + cbw > boxW) l2 = tw(S.desc) + pad * 3 + cbw <= boxW ? S.desc : '';
      const w = Math.max(tw(l1), tw(l2)) + pad * 3 + cbw, nl = l2 ? 2 : 1, h = Math.max(cbh + 2 * s, LH * nl + pad * 2 - s), x = Math.round((iL + Wr - w) / 2), y = yUp - h, ty0 = y + Math.round((h - LH * nl) / 2) + s;
      plate(x, y, w, h, { bd: COLR.bdHi }); text(l1, x + pad, ty0, COLR.amber); if (l2) text(l2, x + pad, ty0 + LH, COLR.dim);
      const cx = x + w - pad - cbw, cy = y + Math.round((h - cbh) / 2), hotX = over(cx, cy, cbw, cbh), downX = U.press === 'spcancel';
      U.hud.push({ id: 'spcancel', x: cx, y: cy, w: cbw, h: cbh, fn: () => { U.spell = null; sfx('uiHover', CAM.x, CAM.z, .6); }, hud: true }); if (hotX) U.hudHot = true;
      plate(cx, cy + (downX ? s : 0), cbw, cbh, hotX || downX ? { bd: COLR.bdHi, bg: COLR.bg2 } : { bd: COLR.ember }); text(cl, cx + pad, cy + pad - s + (downX ? s : 0), COLR.tx);
      yUp = y - g3;
    }
    if (G.paused && !U.sets) { const k = s + 1, t1 = 'Paused', w = PX.measure(t1) * k + pad * 4, h = PX.LINE * k + pad * 2; plate(Math.round(W / 2 - w / 2), yUp - h, w, h, { bd: COLR.bdHi }); PX.text(c, t1, W / 2, yUp - h + pad, k, COLR.amber, { align: 'c' }); yUp -= h + g3; }
    if (U.tip && !U.menu) {
      const d = tipInfo(U.tip.type), a = sat(Math.min(U.tip.t * 4, (U.tip.dur - U.tip.t) * 2)), head = d.head, lines = wrap(d.tip, Math.min(boxW - pad * 2, 46 * 6 * s));
      let w = tw(head); for (const l of lines) w = Math.max(w, tw(l)); w += pad * 2; const h = LH * (lines.length + 1) + pad * 2 - s, x = Math.round((iL + Wr - w) / 2), y = yUp - h;
      c.globalAlpha = a; plate(x, y, w, h, { bd: d.bd }); text(head, x + w / 2, y + pad - s, COLR.amber, { align: 'c' }); lines.forEach((l, k) => text(l, x + w / 2, y + pad - s + (k + 1) * LH, COLR.tx, { align: 'c' })); c.globalAlpha = 1; yUp = y - g3;
    } else {
      const first = U.titleT < 16, a = tch ? sat(Math.min(U.titleT - 7.2, first ? 1 : 3 - U.moved, U.manual && !first ? 0 : 1, 62 - U.titleT)) : Math.max(sat(Math.min(U.titleT - 7.2, 3 - Math.min(U.moved, U.idle > 20 ? U.moved : 0) + (U.titleT < 18 ? 8 : 0))), sat(Math.min(U.titleT - 7.2, 15 - U.titleT)));
      if (a > .02 && !U.menu && !G.paused && !U.spell && G.phase === 'play') {
        const parts = tch ? ['Tap a pad to build', 'Tap a spell, then the road', 'Drag to look, pinch to zoom', 'The gear has help'] : ['Click a pad to build', '1-4 pick a tower', 'Q E T cast spells', 'R mends the beacon', 'Space calls the next wave', 'O settings and help'];
        // As few lines as fit: two halves, else pairs, else one part per line.
        const pack = n => { const out = []; for (let i = 0; i < parts.length; i += n) out.push(parts.slice(i, i + n).join(' · ')); return out; }, fits = ls => ls.every(l => tw(l) + pad * 2 <= boxW);
        let lines = [parts.join(' · ')]; for (const n of [Math.ceil(parts.length / 2), 2, 1]) { if (fits(lines)) break; lines = pack(n); }
        let w = 0; for (const l of lines) w = Math.max(w, tw(l)); w += pad * 2; const h = LH * lines.length + pad * 2 - s, hx = Math.round((iL + Wr - w) / 2), hy = yUp - h;
        if (w <= boxW) { c.globalAlpha = a; plate(hx, hy, w, h); lines.forEach((l, k) => text(l, hx + w / 2, hy + pad - s + k * LH, COLR.dim, { align: 'c' })); c.globalAlpha = 1; }
      }
    }
    if (U.msg) {
      const m = U.msg; m.t += R.frameDt; const a = sat(Math.min(m.t * 3, (m.dur - m.t) * 2));
      if (m.t >= m.dur || (G.phase === 'defeat' && G.phaseT > SUMMARY_AT)) U.msg = null; else { let sc = s + (m.big ? 2 : 1); while (sc > 2 && PX.measure(m.text) * sc + pad * 4 > Wr - iL - 6 * s) sc--; const w = PX.measure(m.text) * sc + pad * 4, h = PX.LINE * sc + pad * 2; c.globalAlpha = a; const yb = Math.max(Math.round(H * .2), y0 + topH + 4 * s); plate(Math.round(W / 2 - w / 2), yb, w, h, { bd: m.big ? COLR.ember : COLR.bdHi }); PX.text(c, m.text, W / 2, yb + pad, sc, m.big ? '#ffd9a8' : COLR.tx, { align: 'c' }); c.globalAlpha = 1; }
    }
    U.menuRect = null;
    if (U.menu && G.phase === 'play') {
      const m = U.menu, p = proj(m.pad.x, m.pad.y + (m.tower ? Math.min(3.6, m.tower.mounts.top) : 1.2), m.pad.z), a = sat(m.t * 8), mp = 6 * s;
      const button = (bx, by, bw2, bh2, id, enabled, fn, kind, on) => {
        const ov = over(bx, by, bw2, bh2) && !U.gp.active, focused = U.gp.active && U.btns.length === m.focus;
        const b = { id, fn, kind, x: bx, y: by, w: bw2, h: bh2 }; U.btns.push(b); if (ov) hot = b; const down = U.press === id, lit = ov || focused || on || down;
        plate(bx, by + (down ? s : 0), bw2, bh2, { bg: lit ? COLR.bg2 : 'rgba(16,18,27,0.96)', bd: lit ? COLR.bdHi : (enabled ? COLR.bd : '#3a342c'), hi: lit ? 'rgba(232,176,74,0.18)' : null });
        return { lit, dy: down ? s : 0 };
      };
      // The menu stays clear of the bottom HUD row (spells, pause, speed) where it fits between the top plates and that row.
      const place = (wP, hP) => { const bot = hudBot - g3 - hP >= y0 + topH + 2 * s ? hudBot - g3 : Hb - 4 * s, below = p.y - hP - 7 * s < y0 + topH + 2 * s && p.y + 26 * s + hP < bot; return [clamp(Math.round(p.x - wP / 2), 4 * s + iL, Wr - wP - 4 * s), below ? Math.round(p.y + 26 * s) : clamp(Math.round(p.y - hP - 7 * s), Math.min(y0 + topH + 4 * s, bot - hP), bot - hP)]; };
      c.globalAlpha = a;
      if (!m.tower) {
        const bwid = 31 * s, bh = 35 * s, gapb = 3 * s, rowW = 4 * bwid + 3 * gapb;
        let lit = null; const fk = U.gp.active ? TOWER_KINDS[m.focus % 4] : null;
        const cheap = Math.min(...TOWER_KINDS.map(k => TOWER[k].cost[0])), broke = G.gold < cheap;
        const lines = k => k ? [TOWER[k].name].concat(TOWER[k].desc) : broke ? ['Not enough gold yet', 'Kills and each wave pay gold;', 'selling a tower gives some back.'] : tch ? ['Choose a tower', 'Tap one to see what it does,', 'then tap it again to build.'] : ['Choose a tower', 'Hover or press 1 to 4', 'to see what each does.'];
        let textW = tw('Tap again to build'); for (const k of [null].concat(TOWER_KINDS)) for (const l of lines(k)) textW = Math.max(textW, tw(l));
        const wP = Math.max(rowW, textW) + mp * 2, hP = mp * 2 + LH + 3 * s + bh + 4 * s + LH * 3 + 2 * s + (tch ? LH + s : 0), [px, py] = place(wP, hP);
        U.menuRect = { x: px, y: py, w: wP, h: hP };
        plate(px, py, wP, hP); text('Build here', px + mp, py + mp - s, COLR.amber);
        const bx0 = px + Math.round((wP - rowW) / 2), by = py + mp + LH + 3 * s;
        TOWER_KINDS.forEach((kind, i) => {
          const d = TOWER[kind], can = G.gold >= d.cost[0], bx = bx0 + i * (bwid + gapb);
          const r = button(bx, by, bwid, bh, 'b' + kind, can, () => { if (U.touch && m.sel !== kind) { m.sel = kind; sfx('uiHover', m.pad.x, m.pad.z, .8); } else doBuild(m.pad, kind); }, kind, m.sel === kind);
          const [iw, ih] = PX.iconSize(d.icon); PX.icon(c, d.icon, bx + Math.round((bwid - iw * s) / 2), by + 6 * s + r.dy, s, can ? 1 : .45);
          if (!tch) text('' + (i + 1), bx + 3 * s, by + 2 * s + r.dy, COLR.dim);
          const cw2 = 8 * s + 2 * s + tw('' + d.cost[0]), cx0 = bx + Math.round((bwid - cw2) / 2);
          PX.icon(c, 'coin', cx0, by + bh - LH - 3 * s + r.dy, s, can ? 1 : .5); text('' + d.cost[0], cx0 + 10 * s, by + bh - LH - 3 * s + r.dy, can ? COLR.amber : COLR.red);
          if (r.lit) lit = kind;
        });
        const ls = lines(lit || fk), ty = by + bh + 4 * s;
        text(ls[0], px + mp, ty, lit || fk ? COLR.tx : broke ? COLR.ember : COLR.dim); text(ls[1], px + mp, ty + LH + s, COLR.dim); if (ls[2]) text(ls[2], px + mp, ty + LH * 2 + s, COLR.dim);
        if (tch && m.sel) { const can = G.gold >= TOWER[m.sel].cost[0]; text(can ? 'Tap again to build' : 'Not enough gold yet', px + mp, ty + LH * 3 + 2 * s, can ? COLR.amber : COLR.red); }
      } else if (m.tower.lvl === 2 && !m.tower.branch) {
        // Branch choice: two cards with what each does and costs. Touch: tap to see, tap again to buy. Keys 1 and 2.
        const t = m.tower, d = t.def, keys = BRANCH_KEYS[t.kind], active = t.state === 'active', refund = Math.round(t.spent * .6), cp = 4 * s;
        const card = k => { const b = d.branches[k]; return { k, b, cost: branchCost(t, k), lines: b.desc, stat: branchStat(t.kind, k) }; }, cards = keys.map(card);
        let cw = 0; for (const q of cards) cw = Math.max(cw, tw((tch ? '' : '1 ') + q.b.name) + 14 * s + tw('' + q.cost), tw(q.stat), ...q.lines.map(tw));
        cw += cp * 2 + 2 * s; const ch = LH * 4 + cp * 2 - s, gapC = 4 * s, sideBySide = cw * 2 + gapC + mp * 2 <= Wr - iL - 8 * s;
        const head = active ? 'Choose a branch' : 'Building...', hint = tch ? (m.sel ? (G.gold >= branchCost(t, m.sel) ? 'Tap it again to buy' : 'Not enough gold yet') : 'Tap a branch to see it') : 'Click to buy · keys 1 and 2';
        const sl = m.sellArm ? 'Confirm +' + refund : 'Sell +' + refund, bh = (tch ? 22 : 14) * s;
        const rowW = sideBySide ? cw * 2 + gapC : cw, wP = Math.max(rowW, tw(d.name) + 26 * s, tw(head), tw(hint), tw('Confirm +' + refund) + 20 * s) + mp * 2;
        const hP = mp * 2 + LH * 2 + 3 * s + (sideBySide ? ch : ch * 2 + gapC) + 4 * s + bh + 3 * s + LH, [px, py] = place(wP, hP);
        U.menuRect = { x: px, y: py, w: wP, h: hP };
        plate(px, py, wP, hP, { bd: COLR.bdHi }); text(d.name, px + mp, py + mp - s, COLR.amber);
        for (let i = 0; i < 3; i++) PX.icon(c, 'star', px + wP - mp - (3 - i) * 6 * s, py + mp, s);
        text(head, px + mp, py + mp + LH, active ? COLR.tx : COLR.dim);
        const y0c = py + mp + LH * 2 + 3 * s, x0c = px + Math.round((wP - rowW) / 2);
        cards.forEach((q, i) => {
          const cx = sideBySide ? x0c + i * (cw + gapC) : x0c, cy = sideBySide ? y0c : y0c + i * (ch + gapC), can = active && G.gold >= q.cost;
          const r = button(cx, cy, cw, ch, 'br' + q.k, can, () => { if (U.touch && m.sel !== q.k) { m.sel = q.k; sfx('uiHover', t.x, t.z, .8); } else doBranch(t, q.k); }, null, m.sel === q.k);
          U.btns[U.btns.length - 1].branch = q.k;
          const tx = cx + cp, ty = cy + cp - s + r.dy;
          text((tch ? '' : (i + 1) + ' ') + q.b.name, tx, ty, r.lit ? '#ffd9a8' : COLR.amber);
          const cwid = tw('' + q.cost); text('' + q.cost, cx + cw - cp - cwid, ty, can ? COLR.amber : COLR.red); PX.icon(c, 'coin', cx + cw - cp - cwid - 10 * s, ty, s, can ? 1 : .5);
          text(q.lines[0], tx, ty + LH, COLR.tx); text(q.lines[1], tx, ty + LH * 2, COLR.tx); text(q.stat, tx, ty + LH * 3, COLR.ok);
        });
        const by = y0c + (sideBySide ? ch : ch * 2 + gapC) + 4 * s, bws = Math.min(wP - mp * 2, tw('Confirm +' + refund) + 20 * s), bxs = px + mp;
        text(hint, px + mp, by + bh + 3 * s, tch && m.sel ? (G.gold >= branchCost(t, m.sel) ? COLR.amber : COLR.red) : COLR.dim);
        const r = button(bxs, by, bws, bh, 'sell', true, () => { if (!m.sellArm) { m.sellArm = true; sfx('uiHover', t.x, t.z, .8); } else { buzz(16); doSell(t); } }, null, m.sellArm);
        PX.icon(c, 'sell', bxs + 4 * s, by + Math.round((bh - LH) / 2) + r.dy, s); text(sl, bxs + 4 * s + 12 * s, by + Math.round((bh - LH) / 2) + r.dy, m.sellArm ? COLR.ember : COLR.tx);
      } else {
        const t = m.tower, d = t.def, oc = t.oc || 0, maxed = t.lvl >= 3, occ = overchargeCost(t), full = maxed && !occ, upc = maxed ? occ : t.lvl < 2 ? d.cost[t.lvl + 1] : 0, can = !full && upc > 0 && G.gold >= upc && t.state === 'active', refund = Math.round(t.spent * .6), L1 = t.lvl + 1;
        const building = t.state !== 'active', ul = building ? 'Building...' : full ? 'Fully charged' : maxed ? 'Overcharge ' + upc : 'Upgrade ' + upc, sl = m.sellArm ? 'Confirm +' + refund : 'Sell +' + refund, iw9 = 9 * s, bw3 = Math.max(tw(ul), tw(sl), tw('Confirm +' + refund)) + iw9 + 11 * s, bh = (tch ? 24 : 15) * s, by0 = Math.round((bh - LH) / 2);
        const name = t.branch ? d.bdef.title : d.name;
        const st = (t.branch ? branchStat(t.kind, t.branch) : t.kind === 'guard' ? d.n[t.lvl] + ' footmen · ' + d.hp[t.lvl] + ' health' : 'Range ' + d.range[t.lvl].toFixed(1) + ' · Damage ' + Math.round(d.dmg[t.lvl] * (1 + OC_DMG * oc))) + (oc ? ' · +' + Math.round(OC_DMG * oc * 100) + '%' : '');
        const nx = full ? t.kills + ' kills · fully charged' : maxed ? 'Overcharge: damage +' + Math.round(OC_DMG * (oc + 1) * 100) + '%' : t.lvl === 1 ? (t.kind === 'guard' ? 'Next: ' + d.n[L1] + ' footmen · ' + d.hp[L1] + ' health' : 'Next: range ' + d.range[L1].toFixed(1) + ' · damage ' + d.dmg[L1]) + ', then a branch' : (t.kind === 'guard' ? 'Next: ' + d.n[L1] + ' footmen · ' + d.hp[L1] + ' health' : 'Next: range ' + d.range[L1].toFixed(1) + ' · damage ' + d.dmg[L1]);
        const fiw = PX.iconSize('flame')[0] * s, wP = Math.max(bw3 * 2 + 3 * s, tw(name) + 26 * s + oc * (fiw + s), tw(st), tw(nx)) + mp * 2, hP = mp * 2 + LH * 3 + 6 * s + bh, [px, py] = place(wP, hP);
        U.menuRect = { x: px, y: py, w: wP, h: hP };
        plate(px, py, wP, hP, oc ? { bd: COLR.ember } : t.branch ? { bd: COLR.bdHi } : {}); text(name, px + mp, py + mp - s, COLR.amber);
        for (let i = 0; i < 3; i++) PX.icon(c, i <= t.lvl ? 'star' : 'starEmpty', px + wP - mp - (3 - i) * 6 * s, py + mp, s);
        for (let i = 0; i < oc; i++) PX.icon(c, 'flame', px + wP - mp - 19 * s - (oc - i) * (fiw + s), py + mp - s, s);
        text(st, px + mp, py + mp + LH + s, COLR.tx); text(nx, px + mp, py + mp + LH * 2 + 2 * s, full ? COLR.dim : maxed ? COLR.ember : COLR.ok);
        const by = py + mp + LH * 3 + 6 * s, bwf = Math.floor((wP - mp * 2 - 3 * s) / 2);
        let r = button(px + mp, by, bwf, bh, 'up', can, () => doUpgrade(t), null, false);
        PX.icon(c, 'upgrade', px + mp + 4 * s, by + by0 + r.dy, s, can ? 1 : .4); text(ul, px + mp + 4 * s + iw9 + 3 * s, by + by0 + r.dy, can ? COLR.tx : (full || building ? COLR.dim : COLR.red));
        r = button(px + mp + bwf + 3 * s, by, bwf, bh, 'sell', true, () => { if (!m.sellArm) { m.sellArm = true; sfx('uiHover', t.x, t.z, .8); } else { buzz(16); doSell(t); } }, null, m.sellArm);
        PX.icon(c, 'sell', px + mp + bwf + 7 * s, by + by0 + r.dy, s); text(sl, px + mp + bwf + 7 * s + iw9 + 3 * s, by + by0 + r.dy, m.sellArm ? COLR.ember : COLR.tx);
      }
      c.globalAlpha = 1;
    }
    if (hot !== U.hotBtn && hot) sfx('uiHover', CAM.x, CAM.z, .5);
    U.hotBtn = hot;
    if (U.armed && mouse && G.phase === 'play') { const l = TOWER[U.armed].name + ': click a pad', w = tw(l) + pad * 2; const xx = clamp(U.mx + 10 * s, 2 * s, W - w - 2 * s), yy = clamp(U.my + 10 * s, 2 * s, H - LH - pad * 2); plate(xx, yy, w, LH + pad * 2 - s, { bd: COLR.bdHi }); text(l, xx + pad, yy + pad - s, COLR.tx); }
    if (U.titleT < 7 && !U.menu && !U.sets && !U.offer) {
      const a = sat(Math.min((U.titleT - .4) * 1.5, (6.6 - U.titleT) * 1.2));
      if (a > 0) {
        const sc = s * 2, t1 = 'Cinderwatch', full = G.B.bio.name + ' · The commander plays until you take over.', t2 = tw(full) + pad * 4 > Wr - iL - 6 * s ? [G.B.bio.name, 'The commander plays', 'until you take over.'] : [full]; if (G.best > G.wavesPerLand) t2.push('Best run: wave ' + G.best);
        let w = PX.measure(t1) * sc; for (const l of t2) w = Math.max(w, tw(l)); w += pad * 4; const h = PX.LINE * sc + LH * t2.length + pad * 2 + 2 * s, yy = Math.min(Hb - h - 12 * s - zb, yUp - h);
        c.globalAlpha = a; plate(Math.round(W / 2 - w / 2), yy, w, h); PX.text(c, t1, W / 2, yy + pad, sc, '#ffd9a8', { align: 'c' }); t2.forEach((l, k) => text(l, W / 2, yy + pad + PX.LINE * sc + s + k * LH, k === 0 && t2.length > 1 ? COLR.tx : COLR.dim, { align: 'c' })); c.globalAlpha = 1;
      }
    }
    drawPanels(c, s, W, H, iL, iT, Wr, Hb, tch, over, pad, g3, y0 + topH);
    if (HASH.fps) { text(R.fpsText || '', 6 * s + iL, Hb - 30 * s, COLR.ok, { outline: COLR.dark }); }
  }
  // Settings (gear, O) and the run summary after a defeat. Both are modal plates drawn over everything,
  // at the HUD's scale or smaller where the screen is short. Their controls go into U.btns so they win over the HUD below.
  const HELP_KEYS = [
    'Click a pad to build: keys 1 to 4 pick a tower.',
    'Click a tower to upgrade it (U) or sell it (X).',
    'At its top level a tower picks one of two branches (keys 1 and 2), then it can be overcharged.',
    'Spells: Q meteor, E frost, T rally, then click the road. Kills fill the mana bar.',
    'R mends the beacon: lives back for gold.',
    'Space calls the next wave early, for a little gold.',
    'P pause · Tab speed · C hands command to the AI · drag, arrows or the wheel move the view.',
  ];
  const HELP_TOUCH = [
    'Tap a pad, then a tower twice to build.',
    'Tap a tower to upgrade or sell it.',
    'At its top level a tower picks one of two branches, then it can be overcharged.',
    'Spells: tap one, then the road. Kills fill the mana bar.',
    'Mend, under your gold, buys back lives.',
    'Tap the wave plate to call a wave early.',
    'Tap the commander plate to let the AI play.',
    'Drag to look around. Pinch to zoom.',
  ];
  function wrapAt(str, maxW, ps) { const out = []; let cur = ''; for (const wd of str.split(' ')) { const t = cur ? cur + ' ' + wd : wd; if (cur && PX.measure(t) * ps > maxW) { out.push(cur); cur = wd; } else cur = t; } if (cur) out.push(cur); return out; }
  function drawPanels(c, s, W, H, iL, iT, Wr, Hb, tch, over, pad, g3, topY) {
    U.panelRect = null;
    const dpr = R.dpr || 1, avW = Wr - iL - 8 * s, avH = Hb - iT - 8 * s;
    const btn = (id, x, y, w, h, label, ps, on, fn, col) => {
      const hot = over(x, y, w, h), down = U.press === id, dy = down ? s : 0, b = { id, x, y, w, h, fn, hud: true }; U.btns.push(b); if (hot) U.hudHot = true;
      plate(x, y + dy, w, h, hot || down ? { bd: COLR.bdHi, bg: COLR.bg2 } : on ? { bd: COLR.bdHi, bg: 'rgba(60,44,22,0.95)' } : { bg: 'rgba(16,18,27,0.96)' });
      if (label) PX.text(c, label, x + w / 2, y + dy + Math.round((h - PX.LINE * ps) / 2) + ps, ps, col || (on ? COLR.amber : COLR.tx), { align: 'c' });
      return b;
    };
    const sm = G.phase === 'defeat' && G.phaseT > SUMMARY_AT && G.runStats && G.runStats.sum;
    if (sm && !U.sets) {
      const you = U.playerActive(), a = sat((G.phaseT - SUMMARY_AT) * 3), title = 'The beacon is out';
      const rows = [['Waves survived', '' + sm.waves], ['Lands cleared', '' + sm.lands], ['Monsters slain', '' + sm.slain], ['Gold earned', '' + sm.earned],
        ['Best branch', sm.branch ? sm.branch.name + ' · ' + sm.branch.kills + ' kills' : 'none this run'], ['Best tower', sm.tower ? sm.tower.name + ' · ' + sm.tower.kills + ' kills' : 'none this run']];
      const best = sm.newBest ? 'New best: wave ' + sm.best + '!' : sm.best > G.wavesPerLand ? 'Best run: wave ' + sm.best : '';
      const left = you ? '' : 'The commander tries again in ' + Math.max(1, Math.ceil(SUMMARY_AT + AUTO_RESTART - G.phaseT));
      const bl = tch ? 'Play again' : 'Play again (Space)';
      const lay = ps => {
        const p = 5 * ps, L = PX.LINE * ps, m = t => PX.measure(t) * ps, gap = 3 * ps, bh = Math.max(L + 2 * p - ps, tch ? Math.round(40 * dpr) : 0);
        let lw = 0, vw = 0; for (const r of rows) { lw = Math.max(lw, m(r[0])); vw = Math.max(vw, m(r[1])); }
        const wP = Math.max(lw + 8 * ps + vw, PX.measure(title) * (ps + 1), m(best), m(left), m(bl) + 4 * p) + 2 * p;
        const hP = p + PX.LINE * (ps + 1) + gap * 2 + rows.length * L + gap * 2 + (best ? L + gap : 0) + bh + (left ? gap + L : 0) + p;
        return { ps, p, L, gap, bh, lw, wP, hP };
      };
      let Ly = lay(s); while (Ly.ps > 2 && (Ly.wP > avW || Ly.hP > avH)) Ly = lay(Ly.ps - 1);
      const { ps, p, L, gap, bh, wP, hP } = Ly, px = Math.round(W / 2 - wP / 2), py = Math.round(clamp((H - hP) / 2, Math.min(topY + g3, Hb - hP), Hb - hP));
      c.globalAlpha = a; U.panelRect = { x: px, y: py, w: wP, h: hP };
      plate(px, py, wP, hP, { bd: COLR.ember });
      let y = py + p; PX.text(c, title, px + wP / 2, y, ps + 1, '#ffd9a8', { align: 'c' }); y += PX.LINE * (ps + 1) + gap * 2;
      for (const r of rows) { PX.text(c, r[0], px + p, y, ps, COLR.dim); PX.text(c, r[1], px + wP - p, y, ps, COLR.tx, { align: 'r' }); y += L; }
      y += gap * 2;
      if (best) { PX.text(c, best, px + wP / 2, y, ps, sm.newBest ? COLR.amber : COLR.dim, { align: 'c' }); y += L + gap; }
      const bw = Math.min(wP - 2 * p, PX.measure(bl) * ps + 4 * p);
      btn('again', Math.round(px + wP / 2 - bw / 2), y, bw, bh, bl, ps, true, () => { if (restartRun(true)) { sfx('uiClick', CAM.x, CAM.z, .8); buzz(12); } }, COLR.amber); y += bh + gap;
      if (left) PX.text(c, left, px + wP / 2, y, ps, COLR.dim, { align: 'c' });
      c.globalAlpha = 1;
    }
    if (U.offer) {
      // Continue or start anew: two big buttons, Space or Enter continues, N starts a new game.
      const O = U.offer.S, a = sat(U.offer.t * 4 + .2), n = BIOMES.length, bio = BIOMES[((O.start + O.index) % n + n) % n];
      const mins = Math.max(0, (Date.now() - O.t) / 6e4), ago = mins < 1 ? 'just now' : mins < 60 ? Math.round(mins) + ' min ago' : mins < 48 * 60 ? Math.round(mins / 60) + ' h ago' : Math.round(mins / 1440) + ' days ago';
      const title = 'Welcome back', l1 = bio.name + ' · ' + (O.manual ? 'you command' : 'the AI commands'), l2 = 'Saved ' + ago;
      const bc = 'Continue: Land ' + (O.level + 1) + ' · Wave ' + O.k, bn = 'New game', hint = tch ? '' : 'Space or Enter continues · N starts anew';
      const lay = ps => {
        const p = 5 * ps, L = PX.LINE * ps, m = t => PX.measure(t) * ps, gap = 3 * ps, bh = Math.max(L + 2 * p - ps, tch ? Math.round(44 * dpr) : 0);
        const wP = Math.max(PX.measure(title) * (ps + 1), m(l1), m(l2), m(bc) + 4 * p, m(hint) + 2 * p) + 2 * p;
        const hP = p + PX.LINE * (ps + 1) + gap * 2 + L * 2 + ps + gap * 3 + bh * 2 + gap * 2 + (hint ? gap * 3 + L : 0) + p;
        return { ps, p, L, gap, bh, wP, hP };
      };
      let Ly = lay(s); while (Ly.ps > 2 && (Ly.wP > avW || Ly.hP > avH)) Ly = lay(Ly.ps - 1);
      const { ps, p, L, gap, bh, wP, hP } = Ly, px = Math.round(W / 2 - wP / 2), py = Math.round(clamp((H - hP) / 2, Math.min(topY + g3, Hb - hP), Hb - hP));
      c.globalAlpha = a; U.panelRect = { x: px, y: py, w: wP, h: hP };
      plate(px, py, wP, hP, { bd: COLR.bdHi });
      let y = py + p; PX.text(c, title, px + wP / 2, y, ps + 1, '#ffd9a8', { align: 'c' }); y += PX.LINE * (ps + 1) + gap * 2;
      PX.text(c, l1, px + wP / 2, y, ps, COLR.tx, { align: 'c' }); y += L + ps; PX.text(c, l2, px + wP / 2, y, ps, COLR.dim, { align: 'c' }); y += L + gap * 3;
      btn('cont', px + p, y, wP - 2 * p, bh, bc, ps, true, () => takeOffer(true), COLR.amber); y += bh + gap * 2;
      btn('newg', px + p, y, wP - 2 * p, bh, bn, ps, false, () => takeOffer(false)); y += bh + gap;
      if (hint) PX.text(c, hint, px + wP / 2, y + gap, ps, COLR.dim, { align: 'c' });
      c.globalAlpha = 1;
      return;
    }
    if (!U.sets) return;
    const S0 = U.sets, help = S0.tab === 'help', paras = tch ? HELP_TOUCH : HELP_KEYS;
    const lay = (ps, tight) => {
      const p = 5 * ps, L = PX.LINE * ps, m = t => PX.measure(t) * ps, gap = 3 * ps, rh = Math.max(L + 2 * p - ps, tch ? Math.round((tight ? 28 : 36) * dpr) : 0);
      const labW = Math.max(m('Ambience'), m('Graphics'), m(tch ? 'Sound' : 'Sound (M)')), optW = Math.max(m('Sharp'), m('Auto'), m('Fast')) + 2 * p;
      const tabW = m('How to play') + 2 * p, minW = Math.max(labW + gap * 2 + optW * 3 + gap * 2, m('Settings') + 2 * p + gap + tabW + gap + rh, m('Auto adapts to the device.')) + 2 * p;
      const wP = Math.min(avW, Math.max(minW, 236 * ps)), inner = wP - 2 * p;
      const lines = help ? paras.map(t => wrapAt(t, inner - 2 * ps, ps)) : null;
      const body = help ? lines.reduce((a, l) => a + l.length * L + gap, 0) : 6 * (rh + gap) + L;
      return { ps, p, L, m, gap, rh, labW, optW, tabW, wP, minW, inner, lines, hP: p + rh + gap * 3 + body + p };
    };
    let Ly = lay(s); if (Ly.hP > avH) Ly = lay(s, true); while (Ly.ps > 2 && (Ly.hP > avH || Ly.wP < Ly.minW)) Ly = lay(Ly.ps - 1, true);
    const { ps, p, L, m, gap, rh, labW, optW, tabW, wP, inner, lines, hP } = Ly, px = Math.round(W / 2 - wP / 2), py = Math.round(clamp((H - hP) / 2, iT + 4 * s, Math.max(iT + 4 * s, Hb - hP)));
    U.panelRect = { x: px, y: py, w: wP, h: hP };
    c.globalAlpha = sat(S0.t * 8 + .3);
    plate(px, py, wP, hP, { bd: COLR.bdHi });
    let y = py + p;
    btn('tabset', px + p, y, m('Settings') + 2 * p, rh, 'Settings', ps, !help, () => { S0.tab = 'set'; sfx('uiHover', CAM.x, CAM.z, .6); });
    btn('tabhelp', px + p + m('Settings') + 2 * p + gap, y, tabW, rh, 'How to play', ps, help, () => { S0.tab = 'help'; sfx('uiHover', CAM.x, CAM.z, .6); });
    btn('setclose', px + wP - p - rh, y, rh, rh, 'X', ps, false, () => openSettings(false));
    y += rh + gap * 3;
    const rowLabel = (t, yy) => PX.text(c, t, px + p, yy + Math.round((rh - L) / 2) + ps, ps, COLR.tx);
    if (help) {
      for (const ls of lines) { for (const l of ls) { PX.text(c, l, px + p, y, ps, COLR.tx); y += L; } y += gap; }
    } else {
      const xT = px + p + labW + gap * 2, valW = m('100'), xE = px + wP - p - valW - gap * 2;
      for (const [key, name] of [['music', 'Music'], ['sfx', 'Effects'], ['amb', 'Ambience']]) {
        const v = SET[key], set = x => { SET[key] = Math.round(sat((x - xT) / (xE - xT)) * 20) / 20; applyVolumes(); saveSettings(); if (AU.muted && SET[key] > 0) setMute(false); };
        const b = { id: 'vol' + key, x: px + p, y, w: wP - 2 * p, h: rh, fn: x => set(x), drag: set, hud: true }; U.btns.push(b);
        const hot = over(b.x, b.y, b.w, b.h) || U.press === b.id; if (hot) U.hudHot = true;
        rowLabel(name, y);
        const th = Math.max(3, Math.round(rh * .12)), ty = y + Math.round(rh / 2 - th / 2), kx = Math.round(xT + (xE - xT) * v), kw = Math.max(3 * ps, Math.round(rh * .22)), kh = Math.round(rh * .6);
        c.fillStyle = COLR.dark; c.fillRect(xT - ps, ty - ps, xE - xT + 2 * ps, th + 2 * ps); c.fillStyle = '#3a342c'; c.fillRect(xT, ty, xE - xT, th);
        c.fillStyle = AU.muted ? COLR.dim : COLR.amber; c.fillRect(xT, ty, kx - xT, th);
        plate(kx - kw / 2, y + (rh - kh) / 2, kw, kh, { bd: hot ? COLR.bdHi : COLR.bd, bg: hot ? '#ffe2a0' : COLR.tx });
        PX.text(c, '' + Math.round(v * 100), px + wP - p, y + Math.round((rh - L) / 2) + ps, ps, AU.muted ? COLR.dim : COLR.tx, { align: 'r' });
        y += rh + gap;
      }
      rowLabel(tch ? 'Sound' : 'Sound (M)', y);
      const on = !AU.muted, sw = optW * 1.5;
      btn('setmute', px + p + labW + gap * 2, y, sw, rh, on ? 'On' : 'Off', ps, on, () => setMute(!AU.muted), on ? COLR.amber : COLR.red);
      y += rh + gap;
      rowLabel('Graphics', y);
      ['auto', 'sharp', 'fast'].forEach((q, i) => btn('q' + q, px + p + labW + gap * 2 + i * (optW + gap), y, optW, rh, q[0].toUpperCase() + q.slice(1), ps, SET.q === q, () => { if (SET.q !== q) { SET.q = q; applyQuality(); saveSettings(); sfx('uiClick', CAM.x, CAM.z, .6); } }));
      y += rh + gap;
      const note = SET.q === 'auto' ? 'Auto adapts to the device.' : SET.q === 'sharp' ? 'Sharp: full detail.' : 'Fast: smoother, softer.';
      PX.text(c, note, px + p, y + gap, ps, COLR.dim); y += rh + gap;
      PX.text(c, tch ? 'Tap outside to close.' : 'O or Esc closes.', px + p, y, ps, COLR.dim);
    }
    c.globalAlpha = 1;
  }
  U.init = initUI; U.update = update; U.draw = draw;
  return U;
})();
