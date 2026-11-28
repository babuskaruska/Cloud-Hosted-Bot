// ===== ART tour (Ash): the endless island tour ("Saareringreis"). Eight island themes, each restored task by task. =====
//   ART.tourScene(ctx, island, progress, x, y, w, h, t, opts)
//     island: { i, theme, name, tasks: [{ id }] } (TOUR.island(i)); theme is one of ART.tourThemes. Task ids are t<i>_<n>.
//     progress: like ART.scene (Set / array of done task ids, {id: true}, or a plain count of done tasks in order).
//     opts: { tod, weather, style: { taskId: 'boho' | 'minimal' | 'romantic' }, noWeather } (see ART.scene).
//   Each theme has 8 features in restoration order (ART.tourFeatures[theme]). Task k of n turns on features
//   floor(k*8/n) .. floor((k+1)*8/n)-1, so every task visibly adds or repairs something and the last task completes the
//   picture. With more than 8 tasks, the extra tasks add small decor (pots, balloons, lanterns) instead.
//   A task's style choice restyles the feature(s) it controls (awnings, seats, planters, arches, garlands ...).
//   Repeat cycles look different: island i picks a palette by its cycle (i / 8), mirrors the side props on odd cycles
//   and reshuffles the small decor by i.
//   ART.tourDemo(i, n) -> a demo island for galleries.  ART.tourState(island, progress) -> { on: [...], frac }.
(function () {
  const A = ART, SH = A.SH, { F, VG, ln, hill, grass, weeds, flowers, bush, tree, fence, lantern, bench, barrel, crate, junk, bird, cat, glow, smoke, lights, seaSparkle, seaBand } = SH;
  const { E, R, PL, SM, HL, dot, star, pstar, heart, srnd, lt, dk, mix, rgba } = A.H;
  const PI = Math.PI, TAU = PI * 2;
  const THEMES = A.tourThemes = ['flower', 'spa', 'icecream', 'fashion', 'wedding', 'beach', 'xmas', 'orchard'];
  A.tourNames = { flower: 'Lillepood', spa: 'Spaa', icecream: 'Jäätisekiosk', fashion: 'Moebutiik', wedding: 'Pulmaaed', beach: 'Rannaklubi', xmas: 'Jõuluturg', orchard: 'Sügisene õunaaed' };
  const FEAT = A.tourFeatures = {
    flower: ['koristus', 'maja', 'aken', 'markiis', 'silt', 'ammid', 'kaar', 'tuled'],
    spa: ['koristus', 'saun', 'kumm', 'sild', 'lamamistoolid', 'taimed', 'laternad', 'vesiroosid'],
    icecream: ['koristus', 'kiosk', 'koonus', 'markiis', 'lauad', 'menyy', 'lilled', 'ohupallid'],
    fashion: ['koristus', 'fassaad', 'vitriin', 'markiis', 'silt', 'trepp', 'riiul', 'tuled'],
    wedding: ['koristus', 'kaar', 'toolid', 'vaip', 'telk', 'tort', 'lilled', 'tuled'],
    beach: ['koristus', 'baar', 'toolid', 'laudtee', 'vorkpall', 'torn', 'paadid', 'tuled'],
    xmas: ['koristus', 'kuusk', 'putka', 'putka2', 'karussell', 'tuled', 'lumememm', 'saan'],
    orchard: ['koristus', 'puud', 'ait', 'redel', 'korvitsad', 'mahlalett', 'kiik', 'vanikud']
  };
  // style palettes (a main, b second, c accent, d light, w wood, k ink)
  const STY = A.stylePal = {
    boho: { a: '#d9825b', b: '#ecc27a', c: '#8fae86', d: '#f6ead6', w: '#b7865c', k: '#6a4030' },
    minimal: { a: '#fbfbf9', b: '#e2e5ec', c: '#3a4150', d: '#ffffff', w: '#dcc6a6', k: '#3a4150' },
    romantic: { a: '#ffb0c6', b: '#fff0f4', c: '#ec5f86', d: '#fff8f0', w: '#f3d6c2', k: '#a8466a' }
  };
  // theme palettes, three per theme (one per cycle); same keys as STY plus walls, roof, sky and ground
  const PALS = {
    flower: [{ a: '#ff7fa8', b: '#ffffff', c: '#4fc98a', d: '#fff4f8', w: '#c98a5a', wall: '#ffe0ea', roof: '#5fc8a8' }, { a: '#9a7cff', b: '#fff6d8', c: '#ffb84a', d: '#f6f0ff', w: '#c98a5a', wall: '#e8e0ff', roof: '#ff8a7a' }, { a: '#ffb43c', b: '#ffffff', c: '#3db8ff', d: '#fffbe8', w: '#c98a5a', wall: '#fff1c8', roof: '#4f8dff' }],
    spa: [{ a: '#5fd0c0', b: '#ffffff', c: '#ffb0c0', d: '#effdfa', w: '#c4895a', wall: '#d9a46e', roof: '#5a6a7a' }, { a: '#8fb0ff', b: '#ffffff', c: '#ffd07a', d: '#f0f4ff', w: '#b9784a', wall: '#c98f62', roof: '#6a5a8a' }, { a: '#b0e07a', b: '#ffffff', c: '#ff9ac0', d: '#f6ffe8', w: '#c4895a', wall: '#dcae7a', roof: '#4f7a6a' }],
    icecream: [{ a: '#ff8fb8', b: '#ffffff', c: '#7fe0d0', d: '#fff2f8', w: '#c98a5a', wall: '#fff0d8', roof: '#ff8fb8' }, { a: '#7fd0ff', b: '#ffffff', c: '#ffd84a', d: '#eef9ff', w: '#c98a5a', wall: '#ffffff', roof: '#7fd0ff' }, { a: '#b79cff', b: '#ffffff', c: '#9ff0c8', d: '#f6f2ff', w: '#c98a5a', wall: '#fff6ec', roof: '#b79cff' }],
    fashion: [{ a: '#2e2a4a', b: '#ffffff', c: '#ffb0c8', d: '#fff6f8', w: '#c9a06a', wall: '#f7d8e2', roof: '#2e2a4a' }, { a: '#1f6f6a', b: '#ffffff', c: '#ffd48a', d: '#f2fffd', w: '#c9a06a', wall: '#d8f2ec', roof: '#1f6f6a' }, { a: '#6a2a5a', b: '#ffffff', c: '#9fd8ff', d: '#fff4fb', w: '#c9a06a', wall: '#f3e6ff', roof: '#6a2a5a' }],
    wedding: [{ a: '#ffffff', b: '#ffd6e2', c: '#7fbf7a', d: '#fffaf4', w: '#d8b48a', wall: '#ffffff', roof: '#ffd6e2' }, { a: '#ffffff', b: '#d8e8ff', c: '#8fbf9a', d: '#f8fbff', w: '#d8b48a', wall: '#ffffff', roof: '#d8e8ff' }, { a: '#ffffff', b: '#fff0b8', c: '#9fc87a', d: '#fffdf2', w: '#d8b48a', wall: '#ffffff', roof: '#ffe6a8' }],
    beach: [{ a: '#ff7a6b', b: '#ffffff', c: '#2ec4e6', d: '#fff6ea', w: '#c99a5a', wall: '#f6d28a', roof: '#d9a24a' }, { a: '#ffcf3a', b: '#ffffff', c: '#ff6b9a', d: '#fffbe8', w: '#c99a5a', wall: '#ffe2b0', roof: '#c98a3a' }, { a: '#3dc8a8', b: '#ffffff', c: '#ff9a4a', d: '#effffb', w: '#c99a5a', wall: '#f4dca0', roof: '#d4a050' }],
    xmas: [{ a: '#e2484c', b: '#ffffff', c: '#2f9a5a', d: '#fff8f0', w: '#a8683e', wall: '#c98a5a', roof: '#e2484c' }, { a: '#3a6ad8', b: '#ffffff', c: '#ffc83d', d: '#f2f6ff', w: '#a8683e', wall: '#b9784a', roof: '#3a6ad8' }, { a: '#b04ab8', b: '#ffffff', c: '#2fb88a', d: '#fbf2ff', w: '#a8683e', wall: '#c98a5a', roof: '#b04ab8' }],
    orchard: [{ a: '#e2574c', b: '#fff4e0', c: '#f2a23a', d: '#fff8ec', w: '#a8683e', wall: '#c9463c', roof: '#6a4a3a' }, { a: '#d9822b', b: '#fff4e0', c: '#c9463c', d: '#fff8ec', w: '#a8683e', wall: '#e0a040', roof: '#5a5a6a' }, { a: '#b8463c', b: '#fff4e0', c: '#e8b830', d: '#fff8ec', w: '#a8683e', wall: '#7a9a5a', roof: '#6a4a3a' }]
  };

  // ---------- variant and progress ----------
  function hash(n) { n = (n | 0) * 2654435761 >>> 0; n ^= n >>> 15; n = Math.imul(n, 2246822519) >>> 0; return (n ^ (n >>> 13)) >>> 0; }
  function variant(island) {
    const i = Math.max(0, island.i | 0), cyc = Math.floor(i / THEMES.length), th = THEMES.indexOf(island.theme) >= 0 ? island.theme : THEMES[i % THEMES.length];
    const pals = PALS[th], pal = pals[(cyc + (hash(i) % 2)) % pals.length];
    return { i, cyc, th, pal, flip: cyc % 2 === 1, seed: hash(i + 101) % 100000, X: null };
  }
  function tasksOf(island) {
    if (island.tasks && island.tasks.length) return island.tasks.map(t => String(t && t.id != null ? t.id : t));
    const out = []; for (let n = 1; n <= 8; n++) out.push('t' + (island.i | 0) + '_' + n); return out;
  }
  function doneSet(progress) {
    if (progress == null) return new Set();
    if (progress instanceof Set) return progress;
    if (Array.isArray(progress)) return new Set(progress.map(String));
    if (typeof progress === 'object') return new Set(Object.keys(progress).filter(k => progress[k]));
    return null; // a count
  }
  // feature index range of task k out of n
  function slots(k, n, nf) { if (n <= nf) { const a = Math.floor(k * nf / n), b = Math.floor((k + 1) * nf / n); const r = []; for (let j = a; j < b; j++) r.push(j); return r; } return [Math.min(nf - 1, Math.floor(k * nf / n))]; }
  function state(island, progress, style) {
    const V = variant(island), list = FEAT[V.th], ids = tasksOf(island), n = ids.length, ds = doneSet(progress), on = new Set(), sty = {};
    let extra = 0, nd = 0;
    ids.forEach((id, k) => {
      const done = ds ? ds.has(id) : k < (progress | 0);
      const fs = slots(k, n, list.length);
      if (style && style[id]) for (const j of fs) sty[list[j]] = style[id];
      if (!done) return; nd++;
      let added = false; for (const j of fs) { if (!on.has(list[j])) { on.add(list[j]); added = true; } }
      if (!added) extra++;
    });
    on.extra = extra;
    return { V, on, sty: Object.keys(sty).length ? sty : null, frac: n ? nd / n : 1 };
  }
  A.tourState = function (island, progress) { const s = state(island, progress); return { theme: s.V.th, on: Array.from(s.on), extra: s.on.extra, frac: s.frac }; };
  A.tourDemo = function (i, n) { i = i | 0; const tasks = []; for (let k = 1; k <= (n || 8); k++) tasks.push({ id: 't' + i + '_' + k }); return { i, theme: THEMES[i % THEMES.length], name: A.tourNames[THEMES[i % THEMES.length]], tasks }; };

  // ---------- shared props (design space 400 x 220; ground about y 186) ----------
  const st = f => SH.styleOf(f);
  const P_ = (V, s) => (s && STY[s]) || V.pal;
  function txt(g, s, x, y, size, col, ol) {
    g.font = '900 ' + size + 'px ui-rounded,"SF Pro Rounded","Nunito",system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (ol) { g.lineWidth = size * .28; g.strokeStyle = ol; g.lineJoin = 'round'; g.strokeText(s, x, y); }
    g.fillStyle = col; g.fillText(s, x, y);
  }
  function pill(g, x, y, w, h, bg, edge, s, fs, fg) { R(g, x - w / 2, y - h / 2, w, h, h / 2); F(g, bg, 1.4, edge); R(g, x - w / 2 + 3, y - h / 2 + 2, w - 6, h * .35, h * .2); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill(); if (s) txt(g, s, x, y + .5, fs || h * .58, fg || '#ffffff'); }
  // walls: grey weathered boards (broken) or a painted wall with white corner trim
  function walls(g, x0, x1, yb, h, col, ok) {
    R(g, x0, yb - h, x1 - x0, h, 2); VG(g, ok ? col : '#b6b0aa', yb - h, yb, 1.6);
    g.save(); R(g, x0, yb - h, x1 - x0, h, 2); g.clip();
    if (!ok) { for (let xx = x0 + 6; xx < x1; xx += 7) ln(g, [xx, yb - h, xx, yb], '#8f8a86', .9, .5); const r = srnd(x0 | 0); for (let i = 0; i < 6; i++) { E(g, x0 + r() * (x1 - x0), yb - r() * h, 4 + r() * 5, 2 + r() * 2); g.fillStyle = 'rgba(80,70,60,.22)'; g.fill(); } }
    else { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x0, yb - h, x1 - x0, h * .3); }
    g.restore();
    if (ok) { for (const xx of [x0, x1 - 4]) { R(g, xx, yb - h, 4, h, 1); F(g, '#ffffff', 1); } }
    R(g, x0 - 2, yb - 5, x1 - x0 + 4, 6, 2); F(g, ok ? '#ffffff' : '#a8a096', 1.2);
  }
  function gable(g, x0, x1, y, h, col, ok) {
    g.beginPath(); g.moveTo(x0 - 10, y + 2); g.lineTo(x0 + 18, y - h); g.lineTo(x1 - 18, y - h); g.lineTo(x1 + 10, y + 2); g.closePath(); VG(g, ok ? col : '#9a948e', y - h, y, 1.6);
    g.save(); g.clip();
    if (ok) { for (let row = 0; row < 4; row++) for (let xx = x0 - 14 + (row % 2) * 6; xx < x1 + 14; xx += 12) { g.beginPath(); g.arc(xx, y - h + 6 + row * (h / 4), 6, 0, PI); g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,.4)'; g.stroke(); } }
    else for (const [dx, dy, rx] of [[.3, .45, 8], [.62, .3, 6], [.8, .65, 5]]) { E(g, x0 + (x1 - x0) * dx, y - h + h * dy, rx, rx * .6, .2); F(g, '#4a3a48', 1); }
    g.restore();
  }
  function boarded(g, x, y, w, h) {
    R(g, x, y, w, h, 2); F(g, '#5a5058', 1.2);
    g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(.4); R(g, -w * .65, -2.5, w * 1.3, 5, 1); F(g, '#b8a48a', 1); g.rotate(-.8); R(g, -w * .65, -2.5, w * 1.3, 5, 1); F(g, '#c8b49a', 1); g.restore();
  }
  function door(g, cx, yb, w, h, col, ok) {
    g.beginPath(); g.moveTo(cx - w / 2, yb); g.lineTo(cx - w / 2, yb - h + w / 2); g.arc(cx, yb - h + w / 2, w / 2, PI, 0); g.lineTo(cx + w / 2, yb); g.closePath(); F(g, ok ? col : '#6a6068', 1.3);
    if (ok) { R(g, cx - w * .3, yb - h + w * .35, w * .6, h * .4, w * .25); F(g, '#d8f4ff', 1); dot(g, cx + w * .32, yb - h * .42, 1.4, '#ffd23f'); }
  }
  // awning in a style: boho fringe stripes, minimal flat, romantic scallops with bows, default candy stripes
  function awn(g, x, w, y, h, s, P) {
    if (s === 'minimal') {
      PL(g, [x - 3, y, x + w + 3, y, x + w + 6, y + h, x - 6, y + h]); F(g, '#fbfbf9', 1.2, '#3a4150'); ln(g, [x - 6, y + h, x + w + 6, y + h], '#3a4150', 1.6);
      return;
    }
    const n = Math.max(4, Math.round(w / 10)), sw = w / n;
    const c1 = s === 'boho' ? '#d9825b' : s === 'romantic' ? '#ffb0c6' : P.a, c2 = s === 'boho' ? '#f6ead6' : s === 'romantic' ? '#fff4f6' : (P.b || '#ffffff');
    for (let i = 0; i < n; i++) {
      g.beginPath(); g.moveTo(x + i * sw, y); g.lineTo(x + (i + 1) * sw, y); g.lineTo(x + (i + 1) * sw + 1, y + h);
      if (s === 'boho') g.lineTo(x + i * sw - 1, y + h); else g.arc(x + i * sw + sw / 2, y + h, sw / 2, 0, PI);
      g.closePath(); F(g, i % 2 ? c2 : c1, 1.1, dk(c1, .45));
    }
    R(g, x - 2, y - 3, w + 4, 4, 2); F(g, dk(c1, .12), 1.1);
    if (s === 'boho') for (let xx = x + 2; xx < x + w; xx += 4) ln(g, [xx, y + h, xx, y + h + 4], '#ecc27a', 1.2);
    if (s === 'romantic') for (const xx of [x, x + w]) { E(g, xx - 3, y + 1, 3, 2, .4); F(g, '#ec5f86', .8); E(g, xx + 3, y + 1, 3, 2, -.4); F(g, '#ec5f86', .8); dot(g, xx, y + 1, 1.6, '#ff8fb0'); }
  }
  // seat in a style (x = centre, y = ground)
  function chair(g, x, y, s, P, flip) {
    const d = flip ? -1 : 1;
    if (s === 'boho') { E(g, x - d * 2, y - 16, 9, 11); F(g, '#d8a868', 1.1, '#8a5a30'); for (let i = -2; i <= 2; i++) ln(g, [x - d * 2, y - 8, x - d * 2 + i * 4, y - 25], '#b9864a', .7, .8); R(g, x - 7, y - 9, 14, 3.5, 1.5); F(g, '#ecc27a', 1); ln(g, [x - 5, y - 6, x - 6, y], '#8a5a30', 1.4); ln(g, [x + 5, y - 6, x + 6, y], '#8a5a30', 1.4); return; }
    if (s === 'minimal') { ln(g, [x - d * 6, y - 22, x - d * 6, y], '#3a4150', 1.3); ln(g, [x - d * 6, y - 9, x + d * 6, y - 9, x + d * 6, y], '#3a4150', 1.3); R(g, x - 7, y - 10.5, 14, 2.4, 1); F(g, '#ffffff', .9, '#3a4150'); return; }
    if (s === 'romantic') { R(g, x - d * 8, y - 24, 3, 24, 1.5); F(g, '#ffffff', 1, '#c89aa8'); heart(g, x - d * 6.5, y - 22, 5); F(g, '#ffb0c6', 1, '#c05a7a'); R(g, x - 7, y - 11, 15, 4, 2); F(g, '#ffd6e2', 1, '#c05a7a'); ln(g, [x - 5, y - 7, x - 5, y], '#c89aa8', 1.3); ln(g, [x + 6, y - 7, x + 6, y], '#c89aa8', 1.3); return; }
    R(g, x - d * 7, y - 22, 3.4, 22, 1.5); F(g, P.a, 1); R(g, x - 7, y - 10, 15, 3.5, 1.5); F(g, P.a, 1); ln(g, [x + 6, y - 7, x + 6, y], dk(P.a, .4), 1.3);
  }
  function table(g, x, y, P, s) {
    const top = s === 'minimal' ? '#ffffff' : s === 'boho' ? '#c4895a' : s === 'romantic' ? '#fff4f6' : '#ffffff', ed = s === 'minimal' ? '#3a4150' : dk(top, .5);
    E(g, x, y - 13, 10, 3); F(g, top, 1.1, ed); ln(g, [x, y - 12, x, y], s === 'minimal' ? '#3a4150' : '#8a6a8a', 1.6); ln(g, [x - 5, y, x + 5, y], s === 'minimal' ? '#3a4150' : '#8a6a8a', 1.4);
    if (s === 'romantic') { E(g, x, y - 13, 10, 3); g.save(); g.clip(); g.restore(); for (let i = -2; i <= 2; i++) dot(g, x + i * 4, y - 10.5, 1.4, '#ffd6e2'); }
    dot(g, x - 3, y - 15, 1.6, s === 'minimal' ? '#3a4150' : '#ff8fb8');
  }
  function umbrella(g, x, y, s, P) {
    ln(g, [x, y, x, y - 34], s === 'minimal' ? '#3a4150' : '#8a6a5a', 1.6);
    if (s === 'boho') { g.beginPath(); g.moveTo(x - 22, y - 28); g.quadraticCurveTo(x, y - 46, x + 22, y - 28); g.closePath(); F(g, '#e0b878', 1.2, '#8a5a30'); for (let xx = x - 21; xx <= x + 21; xx += 3) ln(g, [xx, y - 28, xx, y - 24], '#c99a5a', 1); for (let i = -2; i <= 2; i++) ln(g, [x, y - 42, x + i * 9, y - 29], '#b9864a', .7, .7); return; }
    if (s === 'minimal') { PL(g, [x - 22, y - 28, x, y - 40, x + 22, y - 28]); F(g, '#fbfbf9', 1.2, '#3a4150'); return; }
    const c1 = s === 'romantic' ? '#ffb0c6' : P.a, c2 = s === 'romantic' ? '#ffffff' : (P.b || '#fff');
    g.beginPath(); g.moveTo(x - 22, y - 28); g.quadraticCurveTo(x, y - 46, x + 22, y - 28); g.closePath(); F(g, c1, 1.2, dk(c1, .5));
    g.save(); g.clip(); for (let i = -2; i <= 2; i += 2) { PL(g, [x, y - 44, x + i * 6 - 3, y - 26, x + i * 6 + 3, y - 26]); g.fillStyle = c2; g.fill(); } g.restore();
    for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(x - 17.6 + i * 8.8, y - 28, 4.4, 0, PI); F(g, i % 2 ? c2 : c1, .9, dk(c1, .5)); }
    if (s === 'romantic') { heart(g, x, y - 43, 3); F(g, '#ec5f86', .8); }
  }
  // planter in a style (x = centre, y = ground, sc = scale)
  function planter(g, x, y, sc, s, P) {
    g.save(); g.translate(x, y); g.scale(sc, sc);
    if (s === 'boho') { // woven basket with pampas plumes
      for (const [a, l] of [[-.35, 26], [-.12, 30], [.12, 28], [.38, 24]]) { ln(g, [0, -10, Math.sin(a) * l, -10 - Math.cos(a) * l], '#b8a070', 1); E(g, Math.sin(a) * l, -10 - Math.cos(a) * l, 3.2, 7, a); F(g, '#f2e2c4', .9, '#c8a878'); }
      R(g, -8, -12, 16, 12, 3); F(g, '#d8a868', 1.1, '#8a5a30'); for (let i = 0; i < 3; i++) ln(g, [-8, -9 + i * 3.4, 8, -9 + i * 3.4], '#b9864a', .7);
    } else if (s === 'minimal') { // white cylinder with a snake plant
      for (const [dx, h] of [[-4, 22], [0, 28], [4, 20], [-1.5, 16]]) { PL(g, [dx - 2, -10, dx, -10 - h, dx + 2, -10]); F(g, '#3f8a5a', .8, '#245a3a'); }
      R(g, -7, -11, 14, 11, 2); F(g, '#ffffff', 1.1, '#3a4150');
    } else if (s === 'romantic') { // stone urn with a mound of roses
      E(g, 0, -16, 11, 8); F(g, '#5fae6a', 1, '#2f7a4a'); const r = srnd(5); for (let i = 0; i < 7; i++) { const px = (r() - .5) * 16, py = -18 + (r() - .5) * 8; dot(g, px, py, 2.6, i % 2 ? '#ff8fb0' : '#ffd0dc'); dot(g, px, py, 1, '#ec5f86'); }
      PL(g, [-9, -12, 9, -12, 5, -4, 3, 0, -3, 0, -5, -4]); F(g, '#f7f2ec', 1.1, '#b8a898');
    } else { // terracotta pot with flowers
      E(g, 0, -15, 9, 7); F(g, '#5fc06a', 1, '#2f8a4a'); for (let i = 0; i < 5; i++) dot(g, -6 + i * 3, -17 + (i % 2) * 3, 2.2, [P.a, '#ffd23f', '#ffffff', P.c || '#ff8fb8', P.a][i]);
      PL(g, [-7, -10, 7, -10, 5, 0, -5, 0]); F(g, '#e08a5a', 1.1);
    }
    g.restore();
  }
  // string of decorations between points (flat array): boho pennants, minimal bulbs, romantic hearts, default bulbs
  function garland(g, pts, s, P) {
    ln(g, pts, s === 'minimal' ? '#3a4150' : '#6a5a7a', .8);
    for (let i = 0; i < pts.length - 2; i += 2) {
      for (let k = 1; k <= 2; k++) {
        const u = k / 3, x = pts[i] + (pts[i + 2] - pts[i]) * u, y = pts[i + 1] + (pts[i + 3] - pts[i + 1]) * u + 2;
        if (s === 'boho') { PL(g, [x - 3.5, y - 1, x + 3.5, y - 1, x, y + 7]); F(g, ['#d9825b', '#ecc27a', '#8fae86', '#f6ead6'][(i / 2 + k) % 4], .6); }
        else if (s === 'romantic') { heart(g, x, y + 2.5, 3.6); F(g, k % 2 ? '#ff8fb0' : '#ffffff', .6, '#c05a7a'); }
        else if (s === 'minimal') { E(g, x, y + 2, 1.8, 2.4); F(g, '#fff6d8', .6, '#3a4150'); }
        else { E(g, x, y + 2, 1.8, 2.4); F(g, [P.a, '#ffd86a', P.c || '#a8e0ff', '#b8f0a0'][(i / 2 + k) % 4], .6); }
      }
    }
  }
  function garlandGlow(pts) { const o = []; for (let i = 0; i < pts.length - 2; i += 2) for (let k = 1; k <= 2; k++) { const u = k / 3; o.push([pts[i] + (pts[i + 2] - pts[i]) * u, pts[i + 1] + (pts[i + 3] - pts[i + 1]) * u + 4, 6]); } return o; }
  // arch in a style (x = centre, yb = ground)
  function arch(g, x, yb, w, h, s) {
    if (s === 'minimal') {
      g.beginPath(); g.moveTo(x - w / 2, yb); g.lineTo(x - w / 2, yb - h + w / 2); g.arc(x, yb - h + w / 2, w / 2, PI, 0); g.lineTo(x + w / 2, yb); g.lineWidth = 2.2; g.strokeStyle = '#3a4150'; g.stroke();
      for (let i = 0; i < 6; i++) { const a = PI * 1.05 + i * .13; E(g, x + Math.cos(a) * w / 2, yb - h + w / 2 + Math.sin(a) * w / 2, 3.2, 1.8, a + .8); F(g, '#5fa06a', .7, '#2f6a3a'); }
      return;
    }
    if (s === 'boho') {
      PL(g, [x - w / 2, yb, x - w / 2, yb - h * .62, x, yb - h, x + w / 2, yb - h * .62, x + w / 2, yb], true); g.lineWidth = 3.4; g.strokeStyle = '#b7865c'; g.lineJoin = 'round'; g.stroke();
      g.beginPath(); g.moveTo(x - w / 2, yb - h * .62); g.quadraticCurveTo(x - w * .1, yb - h * .45, x + w * .15, yb - h * .82); g.quadraticCurveTo(x + w * .2, yb - h * .5, x + w / 2, yb - h * .5); g.lineTo(x + w / 2, yb - h * .62); g.lineTo(x, yb - h); g.closePath(); F(g, '#f6ead6', 1, '#c8a878');
      for (const [a, l] of [[-.6, 16], [-.3, 20], [0, 16]]) { const bx = x - w / 2 + 2, by = yb - h * .62; E(g, bx + Math.sin(a) * l, by - Math.cos(a) * l, 3, 7, a); F(g, '#f2e2c4', .8, '#c8a878'); }
      for (let i = 0; i < 4; i++) ln(g, [x + w / 2 - 4 - i * 3, yb - h * .5, x + w / 2 - 4 - i * 3, yb - h * .5 + 8 + i], '#ecc27a', 1);
      return;
    }
    const rose = s === 'romantic';
    g.beginPath(); g.moveTo(x - w / 2, yb); g.lineTo(x - w / 2, yb - h + w / 2); g.arc(x, yb - h + w / 2, w / 2, PI, 0); g.lineTo(x + w / 2, yb); g.lineWidth = 5; g.strokeStyle = '#ffffff'; g.stroke(); g.lineWidth = 1; g.strokeStyle = '#c8b8c8'; g.stroke();
    const r = srnd(17);
    for (let i = 0; i < 22; i++) {
      const u = i / 21, a = PI + u * PI, onArc = u > .1 && u < .9;
      const px = onArc ? x + Math.cos(a) * w / 2 : (u < .5 ? x - w / 2 : x + w / 2), py = onArc ? yb - h + w / 2 + Math.sin(a) * w / 2 : yb - h + w / 2 + (u < .5 ? (0.1 - u) : (u - .9)) * -h;
      E(g, px + (r() - .5) * 4, py + (r() - .5) * 4, 3.2, 2, r() * 3); F(g, '#6ab86a', .6, '#2f7a4a');
      if (i % 2 === 0) { dot(g, px + (r() - .5) * 4, py + (r() - .5) * 3, 2.8, rose ? (i % 4 ? '#ff8fb0' : '#ffd0dc') : ['#ffffff', '#ffd0dc', '#fff2a8'][i % 3]); }
    }
    if (rose) { heart(g, x, yb - h + w * .15, 5); F(g, '#ec5f86', 1, '#a8466a'); }
  }
  function balloon(g, x, y, col, sway) { ln(g, [x, y + 9, x + sway, y + 26], '#8a7a9a', .7); E(g, x, y, 6, 7.5); F(g, col, 1, dk(col, .45)); HL(g, x - 2, y - 3, 1.6, 2.6, -.3, .6); PL(g, [x - 1.5, y + 7.5, x + 1.5, y + 7.5, x, y + 9.5]); F(g, col, 0); }
  function pennants(g, pts, cols) { ln(g, pts, '#6a5a7a', .7); for (let i = 0; i < pts.length - 2; i += 2) { const x = (pts[i] + pts[i + 2]) / 2, y = (pts[i + 1] + pts[i + 3]) / 2; PL(g, [x - 5, y - 1, x + 5, y - 1, x, y + 8]); F(g, cols[(i / 2) % cols.length], .6); } }
  function bigPot(g, x, y, col) { planter(g, x, y, .9, null, { a: col || '#ff8fb8', c: '#ffd23f' }); }
  // small extra decor for tasks beyond the 8th feature
  function extras(g, n, V, y) {
    const r = srnd(V.seed + 5), xs = [64, 336, 30, 370, 98, 302, 124, 276];
    for (let i = 0; i < Math.min(n, 8); i++) { const x = V.X(xs[i] + (r() - .5) * 8); if (i % 3 === 2) balloon(g, x, y - 34, [V.pal.a, '#ffd23f', '#7fd0ff'][i % 3], 2); else planter(g, x, y + (i % 2) * 4, .7, null, V.pal); }
  }
  function ground(g, L, Rr, y0, col, col2) { R(g, L - 2, y0, Rr - L + 4, 230 - y0, 0); const gr = g.createLinearGradient(0, y0, 0, 220); gr.addColorStop(0, col); gr.addColorStop(1, col2 || dk(col, .1)); g.fillStyle = gr; g.fill(); }
  function cobbles(g, L, Rr, y0, seed, col) { const r = srnd(seed); for (let i = 0; i < 70; i++) { const x = L + r() * (Rr - L), y = y0 + 4 + r() * (220 - y0); E(g, x, y, 4 + r() * 2, 1.8 + r()); g.fillStyle = rgba(col || '#a89a8a', .22); g.fill(); } }

  // ---------- themes ----------
  // each: still(g, f, V, L, R), anim(g, f, t, V, L, R), glows(f, V) -> [[x, y, r]]
  const T = {};
  T.flower = {
    still(g, f, V, L, Rr) {
      const P = V.pal, X = V.X, clean = f.has('koristus');
      SH.sky(g, L, Rr, '#62caff', '#ffeef4', 140); SH.sun(g, X(330), 36, 12); SH.cloud(g, X(80), 40, 1, .85);
      hill(g, L, Rr, [L, 124, 100, 112, 220, 120, 320, 108, Rr, 116], mix('#9fe08a', P.c, .15), 220);
      const r = srnd(V.seed); for (let i = 0; i < 6; i++) tree(g, X(20 + i * 70 + r() * 20), 128 + r() * 6, .45 + r() * .2, r() < .5 ? 'birch' : 'round', { col: '#7fd07a' });
      ground(g, L, Rr, 150, '#9fe07a', '#7fcf6a');
      g.beginPath(); g.moveTo(186, 188); g.quadraticCurveTo(176, 206, 166, 222); g.lineTo(234, 222); g.quadraticCurveTo(224, 206, 214, 188); g.closePath(); F(g, clean ? '#f4e6d0' : '#d0c4a8', 0);
      if (clean) cobbles(g, 170, 230, 190, 3, '#b8a080');
      const x0 = 128, x1 = 272, yb = 188, h = 60, ok = f.has('maja');
      walls(g, x0, x1, yb, h, P.wall, ok); gable(g, x0, x1, yb - h, 34, P.roof, ok);
      if (f.has('aken')) {
        R(g, 140, yb - 46, 76, 36, 4); F(g, '#ffffff', 1.4); R(g, 144, yb - 42, 68, 28, 2); const gr = g.createLinearGradient(0, yb - 42, 0, yb - 14); gr.addColorStop(0, '#d8f4ff'); gr.addColorStop(1, '#a8dcf4'); g.fillStyle = gr; g.fill();
        ln(g, [178, yb - 42, 178, yb - 14], '#ffffff', 1.6);
        for (let i = 0; i < 6; i++) { const vx = 150 + i * 11; R(g, vx - 3, yb - 22, 6, 8, 1.5); F(g, ['#ffffff', P.a, '#7fd0ff', '#ffd23f'][i % 4], .8); for (let k = 0; k < 4; k++) dot(g, vx - 3 + (k % 2) * 6, yb - 26 - (k >> 1) * 3, 2.4, [P.a, '#ffd23f', '#ff8fb8', '#ffffff', '#c79aff'][(i + k) % 5]); }
        ln(g, [148, yb - 38, 156, yb - 30], '#ffffff', 1.4, .7);
      } else boarded(g, 142, yb - 44, 72, 32);
      door(g, 246, yb, 22, 40, P.a, ok);
      if (f.has('markiis')) awn(g, 136, 84, yb - 54, 9, st('markiis'), P);
      if (f.has('silt')) { pill(g, 200, yb - h - 14, 70, 16, P.a, dk(P.a, .4), 'LILLED', 10); for (const s of [-1, 1]) { const fx = 200 + s * 42, fy = yb - h - 14; for (let k = 0; k < 5; k++) dot(g, fx + Math.cos(k * 1.26) * 3, fy + Math.sin(k * 1.26) * 3, 2.4, '#ffffff'); dot(g, fx, fy, 2, '#ffd23f'); } }
      if (f.has('ammid')) { // flower bucket stand
        const s = st('ammid'), bx = X(92), Pp = P_(V, s);
        R(g, bx - 26, yb - 6, 52, 4, 1.5); F(g, s === 'minimal' ? '#ffffff' : s === 'boho' ? '#c4895a' : Pp.w, 1.1); R(g, bx - 20, yb - 22, 40, 4, 1.5); F(g, s === 'minimal' ? '#ffffff' : s === 'boho' ? '#c4895a' : Pp.w, 1.1);
        ln(g, [bx - 24, yb - 2, bx - 24, yb + 10], '#8a6a4a', 1.6); ln(g, [bx + 24, yb - 2, bx + 24, yb + 10], '#8a6a4a', 1.6);
        const cols = s === 'romantic' ? ['#ff8fb0', '#ffd0dc', '#ffffff'] : s === 'boho' ? ['#ff9a5a', '#ffd06a', '#f6ead6'] : s === 'minimal' ? ['#ffffff', '#f4f0e8', '#ffe6ee'] : [P.a, '#ffd23f', '#c79aff', '#ff8fb8'];
        for (let row = 0; row < 2; row++) for (let i = 0; i < 4 - row; i++) {
          const cx = bx - 18 + row * 6 + i * 12, cy = yb - 6 - row * 16;
          for (let k = 0; k < 4; k++) { ln(g, [cx, cy - 8, cx - 3 + k * 2, cy - 14], '#4f9a4a', .8); dot(g, cx - 3 + k * 2, cy - 15, 2.4, cols[(i + k + row) % cols.length]); }
          R(g, cx - 4, cy - 9, 8, 9, 1.5); F(g, s === 'boho' ? '#d8a868' : s === 'minimal' ? '#dfe3ea' : s === 'romantic' ? '#ffd6e2' : '#cfd8e6', .9);
        }
        if (s === 'romantic') { E(g, bx - 4, yb - 7, 3, 2, .4); F(g, '#ec5f86', .7); E(g, bx + 4, yb - 7, 3, 2, -.4); F(g, '#ec5f86', .7); }
      }
      if (f.has('kaar')) { const s = st('kaar'); arch(g, X(318), yb + 8, 34, 52, s); planter(g, X(298), yb + 10, .8, s, P); planter(g, X(338), yb + 10, .8, s, P); }
      if (f.has('tuled')) {
        garland(g, [118, yb - 62, 160, yb - 52, 200, yb - 56, 240, yb - 52, 282, yb - 62], null, P);
        // bicycle with a flower basket
        const bx = X(364), by = 206; for (const dx of [-11, 11]) { g.beginPath(); g.arc(bx + dx, by - 7, 7, 0, TAU); g.lineWidth = 1.6; g.strokeStyle = '#3a4150'; g.stroke(); }
        ln(g, [bx - 11, by - 7, bx - 2, by - 18, bx + 8, by - 18, bx + 11, by - 7, bx - 2, by - 7, bx - 2, by - 18], P.a, 2); ln(g, [bx + 8, by - 18, bx + 10, by - 23], '#3a4150', 1.4);
        R(g, bx + 8, by - 27, 11, 7, 2); F(g, '#d8a868', 1); for (let k = 0; k < 4; k++) dot(g, bx + 10 + k * 2.4, by - 28 - (k % 2) * 2, 2.2, [P.a, '#ffd23f', '#ffffff', '#ff8fb8'][k]);
      }
      if (!clean) { junk(g, X(70), 200, 3); junk(g, X(330), 204, 8); weeds(g, x0 - 6, yb + 2, 40, 5); weeds(g, x1 - 34, yb + 2, 40, 6); }
      else { flowers(g, L + 6, 206, 60, 11, true); flowers(g, Rr - 70, 208, 64, 12, true); bush(g, X(116), 192, .7, '#5fd07a', P.a); }
      extras(g, f.extra, V, 214);
      grass(g, L, Rr, 198, 220, 9, '#46b85a');
    },
    anim(g, f, t, V) {
      for (let i = 0; i < 2; i++) bird(g, ((t * 12 + i * 170) % 520) - 60, 52 + i * 12 + Math.sin(t * 2 + i) * 3, 1, Math.sin(t * 9 + i * 2));
      if (f.has('kaar') || f.has('ammid')) for (let i = 0; i < 2; i++) { const bx = V.X(92 + i * 220) + Math.sin(t * 1.3 + i * 2) * 18, by = 160 + Math.cos(t * 1.7 + i) * 10, fl = Math.sin(t * 20 + i); E(g, bx - 2, by, 2.6, 1.6 * Math.abs(fl) + .4, -.4); F(g, i ? '#ffd23f' : '#ff8fb8', .5); E(g, bx + 2, by, 2.6, 1.6 * Math.abs(fl) + .4, .4); F(g, i ? '#ffd23f' : '#ff8fb8', .5); }
      if (f.has('tuled')) lights(g, [139, 132, 160, 138, 181, 134, 220, 134, 240, 138, 261, 132], t);
    },
    glows: (f, V) => [].concat(f.has('aken') ? [[178, 160, 26]] : [], f.has('tuled') ? garlandGlow([118, 126, 160, 136, 200, 132, 240, 136, 282, 126]) : [])
  };
  T.spa = {
    still(g, f, V, L, Rr) {
      const P = V.pal, X = V.X, clean = f.has('koristus');
      SH.sky(g, L, Rr, '#6fd0ff', '#fff0f4', 130); SH.sun(g, X(70), 38, 12); SH.cloud(g, X(300), 34, 1, .8);
      hill(g, L, Rr, [L, 112, 90, 100, 200, 108, 310, 96, Rr, 106], '#7fc88a', 220);
      const r = srnd(V.seed); for (let i = 0; i < 12; i++) tree(g, L + 10 + i * ((Rr - L) / 11) + r() * 8, 116 + r() * 6, .5 + r() * .25, 'pine');
      // lake
      g.beginPath(); g.moveTo(L, 150); g.quadraticCurveTo(X(120), 128, X(260), 136); g.quadraticCurveTo(Rr - 20, 140, Rr, 134); g.lineTo(Rr, 175); g.quadraticCurveTo(200, 168, L, 186); g.closePath();
      const lg = g.createLinearGradient(0, 128, 0, 186); lg.addColorStop(0, clean ? '#8fe4ff' : '#8ab8a8'); lg.addColorStop(1, clean ? '#3ab8e0' : '#5a8a78'); g.fillStyle = lg; g.fill();
      if (!clean) { const r2 = srnd(4); for (let i = 0; i < 8; i++) { const x = X(60 + r2() * 280), y = 142 + r2() * 24; ln(g, [x, y, x + (r2() - .5) * 4, y - 12 - r2() * 8], '#6a7a3a', 1.6); } }
      ground(g, L, Rr, 176, '#a8e08a', '#8fd07a');
      g.beginPath(); g.moveTo(L, 186); g.quadraticCurveTo(200, 168, Rr, 175); g.lineTo(Rr, 182); g.quadraticCurveTo(200, 176, L, 194); g.closePath(); F(g, '#f2e6c8', 0);
      // sauna log cabin
      const cx = X(150), yb = 186, ok = f.has('saun'); g.save(); g.translate(cx, yb); g.scale(1.25, 1.25); g.translate(-cx, -yb);
      R(g, cx - 40, yb - 40, 80, 40, 2); VG(g, ok ? P.wall : '#a69888', yb - 40, yb, 1.6);
      for (let i = 1; i < 6; i++) ln(g, [cx - 40, yb - 40 + i * 6.6, cx + 40, yb - 40 + i * 6.6], dk(ok ? P.wall : '#a69888', .3), .9, .7);
      for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { E(g, cx + s * 40, yb - 37 + i * 6.6, 3, 3); F(g, ok ? lt(P.wall, .2) : '#b8aa98', 1); }
      g.beginPath(); g.moveTo(cx - 50, yb - 38); g.lineTo(cx, yb - 66); g.lineTo(cx + 50, yb - 38); g.closePath(); VG(g, ok ? P.roof : '#8a8480', yb - 66, yb - 38, 1.6);
      if (!ok) { E(g, cx - 14, yb - 50, 6, 3.6, .3); F(g, '#3a2a28', 1); E(g, cx + 20, yb - 44, 5, 3, -.3); F(g, '#3a2a28', 1); }
      R(g, cx + 22, yb - 70, 8, 16, 1); F(g, ok ? '#8a8a96' : '#7a7470', 1.2);
      door(g, cx + 14, yb, 16, 30, ok ? '#8a5a3a' : '#5a5058', ok);
      if (ok) { R(g, cx - 30, yb - 30, 18, 14, 2); F(g, '#ffffff', 1.2); R(g, cx - 28, yb - 28, 14, 10, 1); F(g, '#ffe8a8', 0); pill(g, cx - 14, yb - 48, 34, 11, '#ffffff', dk(P.a, .3), 'SPAA', 7.5, dk(P.a, .3)); }
      else boarded(g, cx - 30, yb - 30, 18, 14); g.restore();
      if (f.has('sild')) { // deck and pier into the lake
        const px = X(236); R(g, Math.min(px, X(330)) - 6, 160, Math.abs(X(330) - px) + 12, 6, 1.5); F(g, P.w, 1.2);
        for (let k = 0; k < 6; k++) { const xx = Math.min(px, X(330)) + k * 18; ln(g, [xx, 166, xx, 178], dk(P.w, .35), 2); ln(g, [xx + 6, 160, xx + 6, 166], dk(P.w, .25), .8); }
        R(g, X(200) - 34, yb - 8, 68, 8, 2); F(g, P.w, 1.2);
      }
      if (f.has('kumm')) { // round wooden hot tub
        const tx = X(214), ty = yb - 2; E(g, tx, ty - 14, 20, 6); F(g, '#7fe0f0', 1.2, '#2a8aa8'); R(g, tx - 20, ty - 14, 40, 14, 3); VG(g, '#b9784a', ty - 14, ty, 1.3); ln(g, [tx - 20, ty - 8, tx + 20, ty - 8], '#5a5a66', 1.4); E(g, tx, ty - 14, 20, 6); g.lineWidth = 1.4; g.strokeStyle = '#8a5a30'; g.stroke();
        E(g, tx - 6, ty - 15, 5, 1.6); g.fillStyle = 'rgba(255,255,255,.6)'; g.fill();
      }
      if (f.has('lamamistoolid')) { const s = st('lamamistoolid'); for (const lx of [X(276), X(312)]) lounger(g, lx, 208, s, P, V.flip); }
      if (f.has('taimed')) { const s = st('taimed'); planter(g, X(96), yb + 4, 1, s, P); planter(g, X(196) + (V.flip ? 24 : -24), yb + 2, .85, s, P); planter(g, X(356), 212, 1, s, P); }
      if (f.has('laternad')) { const s = st('laternad'); garland(g, [X(100), yb - 52, X(150), yb - 44, X(200), yb - 48, X(250), yb - 44], s, P); lantern(g, X(250), 192, true); }
      if (!clean) { junk(g, X(300), 206, 4); weeds(g, X(80), 200, 40, 7); }
      else flowers(g, X(40), 208, 50, 14, true);
      extras(g, f.extra, V, 214);
      grass(g, L, Rr, 200, 220, 21, '#56b86a');
    },
    anim(g, f, t, V, L, Rr) {
      if (f.has('koristus')) seaSparkle(g, V.X(80), V.X(300) > V.X(80) ? V.X(300) : V.X(80) + 220, 140, 170, t);
      if (f.has('kumm')) { smoke(g, V.X(206), 172, t, '#ffffff'); smoke(g, V.X(222), 172, t + 1.3, '#ffffff'); }
      if (f.has('saun')) smoke(g, V.X(150) + 32, 98, t, '#e8e8f4');
      if (f.has('vesiroosid')) {
        for (let i = 0; i < 5; i++) { const x = V.X(70 + i * 46), y = 152 + (i % 2) * 8 + Math.sin(t + i) * .8; E(g, x, y, 7, 2.6); F(g, '#5fc06a', .8, '#2f8a4a'); dot(g, x + 1, y - 2, 2.4, i % 2 ? '#ffffff' : '#ffb0c8'); dot(g, x + 1, y - 2, 1, '#ffd23f'); }
        const dx = V.X(260) + Math.sin(t * .5) * 30, dy = 160 + Math.sin(t * 2) * .6; E(g, dx, dy, 6, 4); F(g, '#ffd23f', 1, '#c08a10'); E(g, dx + 4, dy - 5, 3.6, 3.4); F(g, '#ffd23f', 1, '#c08a10'); PL(g, [dx + 7, dy - 5, dx + 11, dy - 4, dx + 7, dy - 3]); F(g, '#ff8a3a', .6); dot(g, dx + 5, dy - 6, .8, '#2a1a10');
      }
      if (f.has('laternad')) lights(g, [V.X(125), 148, V.X(175), 144, V.X(225), 144], t);
    },
    glows: (f, V) => [].concat(f.has('saun') ? [[V.X(150) - 26, 157, 16]] : [], f.has('laternad') ? [[V.X(250), 158, 12], [V.X(125), 146, 8], [V.X(175), 144, 8], [V.X(225), 144, 8]] : [])
  };
  function lounger(g, x, y, s, P, flip) {
    const d = flip ? -1 : 1, base = s === 'boho' ? '#d8a868' : s === 'minimal' ? '#ffffff' : s === 'romantic' ? '#ffffff' : P.w, cush = s === 'boho' ? '#ecc27a' : s === 'minimal' ? '#e2e5ec' : s === 'romantic' ? '#ffb0c6' : P.a, ed = s === 'minimal' ? '#3a4150' : dk(base, .5);
    PL(g, [x - d * 18, y - 8, x + d * 6, y - 8, x + d * 16, y - 20, x + d * 18, y - 18, x + d * 9, y - 5, x - d * 18, y - 5]); F(g, base, 1.1, ed);
    PL(g, [x - d * 16, y - 10, x + d * 6, y - 10, x + d * 14, y - 20, x + d * 11, y - 21, x + d * 4, y - 12, x - d * 16, y - 12]); F(g, cush, .9, dk(cush, .4));
    ln(g, [x - d * 16, y - 5, x - d * 16, y], ed, 1.4); ln(g, [x + d * 6, y - 5, x + d * 6, y], ed, 1.4);
    if (s === 'romantic') { heart(g, x + d * 12, y - 20, 3.4); F(g, '#ec5f86', .7); }
    if (s === 'boho') for (let i = 0; i < 4; i++) ln(g, [x - d * (12 - i * 3), y - 5, x - d * (12 - i * 3), y - 2], '#d9825b', 1);
    if (!s) { R(g, x - d * 8 - 4, y - 13, 8, 3, 1); F(g, '#ffffff', .6); }
  }
  T.icecream = {
    still(g, f, V, L, Rr) {
      const P = V.pal, X = V.X, clean = f.has('koristus');
      SH.sky(g, L, Rr, '#55c2ff', '#ffeef4', 124); SH.sun(g, X(320), 34, 12); SH.cloud(g, X(110), 36, 1.1, .8);
      seaBand(g, L, Rr, 112, 146, '#7fe0ff', '#22b0e0');
      hill(g, L, Rr, [L, 146, 120, 142, 240, 146, Rr, 140], '#ffe6b0', 220);
      ground(g, L, Rr, 160, '#ffeccc', '#f6dcb0');
      for (let x = L; x < Rr; x += 18) { R(g, x, 158, 16, 3, 1); F(g, '#fff6e6', .8, '#d8c0a0'); } // promenade rail
      for (let x = L + 8; x < Rr; x += 36) ln(g, [x, 160, x, 172], '#d8c0a0', 1.4);
      if (clean) cobbles(g, L, Rr, 172, 5, '#d0b088');
      const cx = 200, yb = 192, ok = f.has('kiosk');
      // kiosk: a round-cornered booth with a big service window
      R(g, cx - 50, yb - 50, 100, 50, 8); VG(g, ok ? P.wall : '#b8b2ac', yb - 50, yb, 1.6);
      if (ok) { g.save(); R(g, cx - 50, yb - 50, 100, 50, 8); g.clip(); for (let xx = cx - 50; xx < cx + 50; xx += 10) { g.fillStyle = rgba(P.a, .22); g.fillRect(xx, yb - 16, 5, 16); } g.restore(); R(g, cx - 52, yb - 18, 104, 4, 2); F(g, '#ffffff', 1.1); }
      R(g, cx - 38, yb - 44, 76, 24, 3);
      if (ok) { F(g, '#ffffff', 1.3); R(g, cx - 35, yb - 41, 70, 18, 2); F(g, '#cdeeff', 0); for (let i = 0; i < 5; i++) { const tx = cx - 28 + i * 14; R(g, tx - 5, yb - 30, 10, 7, 2); F(g, ['#ffd0dc', '#fff4c8', '#c8f4e4', '#e0d0ff', '#ffe0c0'][i], .8); dot(g, tx - 2, yb - 31, 2.4, ['#ff8fb8', '#ffe08a', '#7fe0c0', '#b79cff', '#c98a5a'][i]); dot(g, tx + 2, yb - 31.5, 2.4, ['#fff', '#ff8fb8', '#ffffff', '#ffd23f', '#ff8fb8'][i]); } R(g, cx - 38, yb - 22, 76, 4, 1.5); F(g, P.a, 1); }
      else boarded(g, cx - 36, yb - 42, 72, 20);
      R(g, cx - 54, yb - 56, 108, 8, 4); F(g, ok ? P.roof : '#9a948e', 1.4);
      if (f.has('markiis')) awn(g, cx - 46, 92, yb - 50, 10, st('markiis'), P);
      if (f.has('koonus')) { // giant cone on the roof
        PL(g, [cx - 13, yb - 62, cx + 13, yb - 62, cx, yb - 24 - 72]); g.closePath(); VG(g, '#f2b45a', yb - 96, yb - 62, 1.4);
        g.save(); PL(g, [cx - 13, yb - 62, cx + 13, yb - 62, cx, yb - 96]); g.clip(); for (let k = -3; k <= 3; k++) { ln(g, [cx + k * 7 - 14, yb - 62, cx + k * 7 + 6, yb - 96], '#c9843a', .9); ln(g, [cx + k * 7 + 14, yb - 62, cx + k * 7 - 6, yb - 96], '#c9843a', .9); } g.restore();
        E(g, cx, yb - 66, 16, 10); F(g, P.a, 1.4); E(g, cx - 3, yb - 78, 12, 9); F(g, '#fff6e0', 1.4); E(g, cx + 2, yb - 88, 9, 7); F(g, '#8a4f32', 1.2, '#5a2a1a'); dot(g, cx + 3, yb - 96, 3.6, '#ff3d5a'); ln(g, [cx + 3, yb - 99, cx + 6, yb - 104], '#3a8a3a', 1.2);
        for (let i = 0; i < 6; i++) dot(g, cx - 8 + i * 3, yb - 70 + (i % 2) * 3, 1, ['#ff4f9a', '#ffd23f', '#4fc8ff'][i % 3]);
      }
      if (f.has('menyy')) { // menu board
        const mx = X(124); PL(g, [mx - 10, yb, mx - 4, yb - 26, mx + 4, yb - 26, mx + 10, yb]); F(g, '#8a6a8a', 1); R(g, mx - 11, yb - 28, 22, 18, 2); F(g, '#3a3a4a', 1.2, '#8a6a8a');
        ln(g, [mx - 7, yb - 23, mx + 6, yb - 23], '#ffffff', 1, .8); ln(g, [mx - 7, yb - 19, mx + 3, yb - 19], '#ff9ab8', 1, .8); ln(g, [mx - 7, yb - 15, mx + 5, yb - 15], '#9fe8ff', 1, .8);
      }
      if (f.has('lauad')) { const s = st('lauad'); for (const tx of [X(286), X(344)]) { umbrella(g, tx, 206, s, P); table(g, tx, 206, P, s); chair(g, tx - 14, 208, s, P, false); chair(g, tx + 14, 208, s, P, true); } }
      if (f.has('lilled')) { const s = st('lilled'); for (const px of [cx - 60, cx + 60]) planter(g, px, yb + 4, .9, s, P); for (const px of [X(70), X(240)]) planter(g, px, 212, .8, s, P); }
      if (f.has('ohupallid')) {
        pennants(g, [L + 6, 150, 110, 158, 200, 150, 290, 158, Rr - 6, 150], [P.a, '#ffd23f', '#7fd0ff', '#ffffff', P.c]);
      }
      if (!clean) { junk(g, X(80), 206, 6); junk(g, X(330), 208, 9); weeds(g, cx - 56, yb + 2, 30, 3); }
      extras(g, f.extra, V, 214);
    },
    anim(g, f, t, V, L, Rr) {
      seaSparkle(g, L, Rr, 116, 144, t);
      const sx = ((t * 7 + 40) % (Rr - L + 60)) + L - 30; g.save(); g.translate(sx, 128 + Math.sin(t * 2) * .8); PL(g, [0, 0, 0, -11, 7, 0]); F(g, '#ffffff', .8, '#6a8aa8'); R(g, -7, 0, 14, 3, 1.5); F(g, '#ff8fb8', .8); g.restore();
      if (f.has('ohupallid')) for (let i = 0; i < 4; i++) { const bx = V.X([150, 250, 166, 236][i]), by = 120 - (i > 1 ? 10 : 0) + Math.sin(t * 1.4 + i) * 3; balloon(g, bx + Math.sin(t + i) * 2, by, [V.pal.a, '#ffd23f', '#7fd0ff', '#b79cff'][i], -Math.sin(t + i) * 2); ln(g, [bx, by + 26, V.X(i % 2 ? 248 : 152), 160], '#8a7a9a', .5); }
      for (let i = 0; i < 2; i++) bird(g, ((t * 14 + i * 200) % 520) - 60, 56 + i * 14, 1, Math.sin(t * 9 + i));
    },
    glows: (f) => f.has('kiosk') ? [[200, 160, 30]] : []
  };
  function mannequin(g, x, yb, col, s, sk) {
    ln(g, [x, yb, x, yb - 8], '#8a7a6a', 1.4); ln(g, [x - 5, yb, x + 5, yb], '#8a7a6a', 1.4);
    E(g, x, yb - 38, 3.4, 3.8); F(g, '#f2e6dc', 1, '#a89888');
    PL(g, [x - 4, yb - 33, x + 4, yb - 33, x + 3, yb - 26, x + 9, yb - 8, x - 9, yb - 8, x - 3, yb - 26]); F(g, col, 1, dk(col, .45));
    if (sk === 'boho') for (let i = -2; i <= 2; i++) ln(g, [x + i * 3.6, yb - 8, x + i * 3.6, yb - 5], col, 1);
    if (sk === 'romantic') { heart(g, x, yb - 27, 2.6); F(g, '#ffffff', .6); }
    if (sk === 'minimal') ln(g, [x - 3, yb - 26, x + 3, yb - 26], '#3a4150', 1);
  }
  T.fashion = {
    still(g, f, V, L, Rr) {
      const P = V.pal, X = V.X, clean = f.has('koristus');
      SH.sky(g, L, Rr, '#7fc8ff', '#fff0f6', 120); SH.sun(g, X(80), 34, 11); SH.cloud(g, X(300), 30, 1, .8);
      // neighbouring town houses
      const r = srnd(V.seed), hc = ['#ffd6c8', '#d6ecff', '#fff0b8', '#e0f6d8', '#f0dcff'];
      for (let i = 0; i < 8; i++) { const hx = L + i * ((Rr - L) / 7) - 20, hw = 44 + r() * 10, hh = 54 + r() * 26; if (hx + hw > 116 && hx < 284) continue; R(g, hx, 176 - hh, hw, hh, 2); F(g, hc[(i + V.seed) % hc.length], 1.3); PL(g, [hx - 3, 176 - hh, hx + hw / 2, 176 - hh - 16, hx + hw + 3, 176 - hh]); F(g, ['#ff8a7a', '#7a8aa8', '#5fc8a8'][i % 3], 1.3); for (let k = 0; k < 2; k++) { R(g, hx + 8 + k * (hw - 24), 176 - hh + 12, 9, 11, 1.5); F(g, '#bfe6ff', 1); } }
      ground(g, L, Rr, 176, '#e6e0ea', '#d4ccd8'); cobbles(g, L, Rr, 182, 7, '#a098b0');
      R(g, L - 2, 176, Rr - L + 4, 6, 0); F(g, '#f4f0f6', 1, '#b0a8c0');
      const x0 = 120, x1 = 280, yb = 178, h = 96, ok = f.has('fassaad');
      R(g, x0, yb - h, x1 - x0, h, 2); VG(g, ok ? P.wall : '#b6b0aa', yb - h, yb, 1.6);
      if (ok) { R(g, x0 - 4, yb - h - 8, x1 - x0 + 8, 10, 2); F(g, P.a, 1.4); for (let xx = x0; xx < x1; xx += 10) { g.beginPath(); g.arc(xx + 5, yb - h + 2, 5, 0, PI); F(g, P.a, 1); } for (const xx of [x0, x1 - 6]) { R(g, xx, yb - h, 6, h, 1); F(g, '#ffffff', 1); } }
      else { R(g, x0 - 4, yb - h - 6, x1 - x0 + 8, 8, 2); F(g, '#8a8480', 1.4); const r2 = srnd(3); for (let i = 0; i < 7; i++) { E(g, x0 + r2() * (x1 - x0), yb - r2() * h, 5, 3); g.fillStyle = 'rgba(80,70,60,.22)'; g.fill(); } }
      // upstairs windows with little balconies
      for (const wx of [146, 236]) { if (ok) { R(g, wx - 2, yb - h + 12, 22, 24, 10); F(g, '#ffffff', 1.2); R(g, wx + 1, yb - h + 15, 16, 19, 8); F(g, '#cdeeff', 0); R(g, wx - 4, yb - h + 34, 26, 3, 1); F(g, P.a, 1); for (let k = 0; k < 6; k++) ln(g, [wx - 2 + k * 4.4, yb - h + 37, wx - 2 + k * 4.4, yb - h + 42], P.a, 1); } else boarded(g, wx, yb - h + 14, 18, 20); }
      if (f.has('vitriin')) {
        for (const [vx, vw] of [[x0 + 10, 46], [x1 - 56, 46]]) { R(g, vx, yb - 50, vw, 46, 3); F(g, '#ffffff', 1.4); R(g, vx + 3, yb - 47, vw - 6, 40, 2); const gr = g.createLinearGradient(0, yb - 47, 0, yb - 7); gr.addColorStop(0, '#fff6fa'); gr.addColorStop(1, '#f0e0f0'); g.fillStyle = gr; g.fill(); }
        mannequin(g, x0 + 22, yb - 8, P.c, null); mannequin(g, x0 + 44, yb - 8, '#ffd23f', null); mannequin(g, x1 - 44, yb - 8, '#7fd0ff', null); mannequin(g, x1 - 22, yb - 8, P.a === '#2e2a4a' ? '#ff6b8a' : P.a, null);
        for (const vx of [x0 + 13, x1 - 53]) ln(g, [vx + 2, yb - 44, vx + 10, yb - 36], '#ffffff', 1.4, .8);
      } else { boarded(g, x0 + 10, yb - 48, 46, 42); boarded(g, x1 - 56, yb - 48, 46, 42); }
      door(g, 200, yb, 26, 48, ok ? P.a : '#6a6068', ok);
      if (f.has('markiis')) { const s = st('markiis'); awn(g, x0 + 6, 54, yb - 60, 10, s, P); awn(g, x1 - 60, 54, yb - 60, 10, s, P); }
      if (f.has('silt')) { R(g, 156, yb - 82, 88, 18, 3); F(g, ok ? '#ffffff' : '#e8e4e0', 1.4, P.a); txt(g, 'BUTIIK', 200, yb - 72.5, 11, P.a); g.beginPath(); g.moveTo(166, yb - 73); g.lineTo(170, yb - 76); g.lineTo(174, yb - 73); F(g, '#ffd23f', 0); }
      if (f.has('trepp')) {
        const s = st('trepp'), rc = s === 'boho' ? '#d9825b' : s === 'minimal' ? '#3a4150' : s === 'romantic' ? '#ffb0c6' : '#e2484c';
        PL(g, [190, yb, 210, yb, 222, 220, 178, 220]); F(g, rc, 1, dk(rc, .4));
        if (s === 'boho') for (let y = yb + 6; y < 220; y += 8) ln(g, [184, y, 216, y], '#ecc27a', 1.2); if (s === 'romantic') for (let i = 0; i < 6; i++) { heart(g, 188 + (i % 3) * 12, yb + 10 + (i >> 1) * 7, 2.4); F(g, '#ffffff', 0); }
        for (const px of [174, 226]) planter(g, px, yb + 14, 1, s, P);
        ln(g, [180, yb + 2, 180, yb + 12], '#d8b85a', 1.6); ln(g, [220, yb + 2, 220, yb + 12], '#d8b85a', 1.6); g.beginPath(); g.moveTo(180, yb + 4); g.quadraticCurveTo(200, yb + 10, 220, yb + 4); g.lineWidth = 1.4; g.strokeStyle = '#c03a5a'; g.stroke();
      }
      if (f.has('riiul')) {
        const s = st('riiul'), rx = X(330), cols = s === 'boho' ? ['#d9825b', '#ecc27a', '#8fae86', '#f6ead6'] : s === 'minimal' ? ['#ffffff', '#3a4150', '#e2e5ec', '#c8b89a'] : s === 'romantic' ? ['#ffb0c6', '#ffffff', '#ec5f86', '#ffd6e2'] : [P.c, '#ffd23f', '#7fd0ff', '#ff8fb8'];
        ln(g, [rx - 26, 210, rx - 26, 176, rx + 26, 176, rx + 26, 210], s === 'boho' ? '#b7865c' : '#5a5a6a', 1.8);
        for (let i = 0; i < 6; i++) { const hx = rx - 21 + i * 8.4; ln(g, [hx, 176, hx, 179], '#5a5a6a', .8); PL(g, [hx - 3, 179, hx + 3, 179, hx + 4.5, 198, hx - 4.5, 198]); F(g, cols[i % cols.length], .9, dk(cols[i % cols.length], .45)); }
        R(g, X(70) - 14, 194, 28, 16, 3); F(g, '#ffd6e2', 1.1); ln(g, [X(70) - 6, 194, X(70) - 4, 188, X(70) + 4, 188, X(70) + 6, 194], '#c05a7a', 1.2); // shopping bag
      }
      if (f.has('tuled')) { for (let i = 0; i < 12; i++) dot(g, x0 + 6 + i * ((x1 - x0 - 12) / 11), yb - h - 3, 1.8, '#fff2b0'); for (const sx of [x0 - 10, x1 + 10]) { ln(g, [sx, 220, sx, 150], '#3a3a4a', 2); R(g, sx - 6, 146, 12, 7, 2); F(g, '#3a3a4a', 1); dot(g, sx, 153, 2.4, '#fff2b0'); } }
      if (!clean) { junk(g, X(70), 204, 2); junk(g, X(320), 208, 4); weeds(g, x0 - 2, yb + 2, 30, 8); }
      extras(g, f.extra, V, 216);
    },
    anim(g, f, t, V) {
      for (let i = 0; i < 2; i++) bird(g, ((t * 11 + i * 220) % 520) - 60, 40 + i * 14, 1, Math.sin(t * 9 + i));
      if (f.has('tuled')) for (let i = 0; i < 12; i++) { const a = .5 + .5 * Math.sin(t * 4 - i * .8); if (a > .7) A.H.spark(g, 126 + i * 13.5, 79, 2.6 * a, '#fff6c0'); }
      if (f.has('vitriin')) { const p = (t * .25) % 1; A.H.spark(g, 136 + p * 30, 136, 3 * Math.sin(p * PI), '#ffffff'); }
    },
    glows: (f) => [].concat(f.has('vitriin') ? [[153, 150, 26], [247, 150, 26]] : [], f.has('tuled') ? [[110, 150, 14], [290, 150, 14], [160, 80, 8], [200, 80, 8], [240, 80, 8]] : [])
  };
  T.wedding = {
    still(g, f, V, L, Rr) {
      const P = V.pal, X = V.X, clean = f.has('koristus');
      SH.sky(g, L, Rr, '#7fd0ff', '#fff4f6', 136); SH.sun(g, X(330), 38, 12); SH.cloud(g, X(90), 34, 1, .85);
      hill(g, L, Rr, [L, 120, 120, 108, 240, 116, Rr, 104], '#a8e08a', 220);
      const r = srnd(V.seed); for (let i = 0; i < 9; i++) { const tx = L + 14 + i * ((Rr - L) / 8) + r() * 10; tree(g, tx, 130 + r() * 4, .55 + r() * .2, r() < .4 ? 'birch' : 'round', { col: '#7ccf6a', blossom: r() < .4 }); }
      ground(g, L, Rr, 140, clean ? '#a8e88a' : '#a8b878', clean ? '#8fdc7a' : '#98a868');
      if (clean) { g.save(); g.beginPath(); g.rect(L, 140, Rr - L, 80); g.clip(); for (let x = L - 40; x < Rr; x += 24) { g.beginPath(); g.moveTo(x, 220); g.lineTo(x + 40, 140); g.lineTo(x + 52, 140); g.lineTo(x + 12, 220); g.closePath(); g.fillStyle = 'rgba(255,255,255,.08)'; g.fill(); } g.restore(); }
      else { const r2 = srnd(8); for (let i = 0; i < 20; i++) weeds(g, L + r2() * (Rr - L), 150 + r2() * 60, 14, i); }
      if (f.has('telk')) { // a white pavilion tent on the side
        const s = st('telk'), tx = X(70), Pp = P_(V, s), tc = s === 'boho' ? '#f6ead6' : s === 'minimal' ? '#ffffff' : s === 'romantic' ? '#fff4f6' : '#ffffff', tr = s === 'boho' ? '#d9825b' : s === 'minimal' ? '#3a4150' : s === 'romantic' ? '#ffb0c6' : P.b;
        PL(g, [tx - 38, 150, tx, 112, tx + 38, 150]); F(g, tc, 1.4, dk(tr, .3)); R(g, tx - 36, 150, 72, 32, 1); F(g, tc, 1.2, dk(tr, .3));
        for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(tx - 30 + i * 12, 150, 6, 0, PI); F(g, tr, .9, dk(tr, .3)); }
        g.beginPath(); g.moveTo(tx - 10, 182); g.quadraticCurveTo(tx - 6, 164, tx, 158); g.quadraticCurveTo(tx + 6, 164, tx + 10, 182); g.closePath(); F(g, '#fff6e8', 1, dk(tr, .3));
        ln(g, [tx, 112, tx, 104], '#8a7a6a', 1.4); PL(g, [tx, 104, tx + 9, 107, tx, 110]); F(g, Pp.c || '#ec5f86', .7);
        if (s === 'boho') for (let i = 0; i < 4; i++) { E(g, tx - 30 + i * 20, 164, 2.4, 5, 0); F(g, '#f2e2c4', .7, '#c8a878'); }
      }
      if (f.has('vaip')) { // aisle runner with petals
        g.beginPath(); g.moveTo(194, 150); g.lineTo(206, 150); g.lineTo(230, 222); g.lineTo(170, 222); g.closePath(); F(g, '#ffffff', 1, '#e0d0d8');
        const r3 = srnd(31); for (let i = 0; i < 26; i++) { const u = r3(), px = 200 + (r3() - .5) * (12 + u * 56), py = 152 + u * 68; E(g, px, py, 1.8, 1, r3() * 3); g.fillStyle = r3() < .5 ? '#ff8fb0' : '#ffd0dc'; g.fill(); }
      }
      if (f.has('kaar')) arch(g, 200, 152, 52, 70, st('kaar'));
      if (f.has('lilled')) { const s = st('lilled'); for (const [px, py] of [[166, 154], [234, 154]]) planter(g, px, py, 1.1, s, P); bush(g, X(336), 160, .9, '#5fbf6a', '#ffffff'); bush(g, X(360), 166, .8, '#5fbf6a', '#ffd0dc'); }
      if (f.has('toolid')) {
        const s = st('toolid'); for (let row = 0; row < 3; row++) for (let k = 0; k < 3; k++) { const yy = 170 + row * 18, sp = 14 + row * 2; chair(g, 200 - 22 - row * 6 - k * sp, yy, s, P, false); chair(g, 200 + 22 + row * 6 + k * sp, yy, s, P, true);
          if (!s) { E(g, 200 - 22 - row * 6 - k * sp - 7, yy - 18, 2.6, 1.6); F(g, P.b, .6); E(g, 200 + 22 + row * 6 + k * sp + 7, yy - 18, 2.6, 1.6); F(g, P.b, .6); } }
      }
      if (f.has('tort')) { // cake table
        const tx = X(330), ty = 196; R(g, tx - 22, ty - 16, 44, 16, 3); F(g, '#ffffff', 1.2, '#d0c0c8'); for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(tx - 18 + i * 7.2, ty - 16, 3.6, 0, PI); F(g, P.b, .7); }
        R(g, tx - 12, ty - 30, 24, 14, 3); F(g, '#fffaf4', 1.1, '#c8b8b0'); R(g, tx - 8, ty - 42, 16, 12, 3); F(g, '#fffaf4', 1.1, '#c8b8b0'); R(g, tx - 5, ty - 51, 10, 9, 2.5); F(g, '#fffaf4', 1.1, '#c8b8b0');
        for (const [yy, w] of [[-30, 12], [-42, 8], [-51, 5]]) for (let i = -1; i <= 1; i++) dot(g, tx + i * w * .6, ty + yy + 2, 1.6, '#ff8fb0');
        heart(g, tx, ty - 55, 3); F(g, '#ec5f86', .7);
      }
      if (f.has('tuled')) { garland(g, [L + 10, 108, 90, 120, 160, 112, 240, 112, 310, 120, Rr - 10, 108], null, P); for (const lx of [X(126), X(276)]) lantern(g, lx, 214, true); }
      if (!clean) { junk(g, X(300), 204, 7); junk(g, X(120), 210, 11); }
      extras(g, f.extra, V, 216);
      grass(g, L, Rr, 204, 220, 41, '#5ac06a');
    },
    anim(g, f, t, V, L, Rr) {
      if (f.has('kaar') || f.has('vaip')) for (let i = 0; i < 6; i++) { const p = (t * .12 + i / 6) % 1, x = 140 + i * 22 + Math.sin(t + i * 2) * 12, y = 90 + p * 120; E(g, x, y, 2.2, 1.2, t * 2 + i); g.fillStyle = rgba(i % 2 ? '#ff8fb0' : '#ffffff', Math.sin(p * PI)); g.fill(); }
      for (let i = 0; i < 2; i++) { const bx = ((t * 10 + i * 230) % 520) - 60, by = 60 + i * 16 + Math.sin(t * 2 + i) * 3; heart(g, bx, by, 2.4); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill(); }
      if (f.has('tuled')) lights(g, [L + 50, 116, 125, 118, 200, 114, 275, 118, Rr - 50, 116], t);
    },
    glows: (f, V) => f.has('tuled') ? garlandGlow([16, 108, 90, 120, 160, 112, 240, 112, 310, 120, 384, 108]).concat([[V.X(126), 180, 12], [V.X(276), 180, 12]]) : []
  };
  T.beach = {
    still(g, f, V, L, Rr) {
      const P = V.pal, X = V.X, clean = f.has('koristus');
      SH.sky(g, L, Rr, '#46c0ff', '#fff2e6', 120); SH.sun(g, X(300), 32, 13); SH.cloud(g, X(80), 30, 1, .8);
      seaBand(g, L, Rr, 104, 150, '#6fe4ff', '#12a8dc');
      g.beginPath(); g.moveTo(L, 150); for (let x = L; x <= Rr; x += 20) g.quadraticCurveTo(x + 5, 146, x + 10, 150); g.lineTo(Rr, 156); g.lineTo(L, 156); g.closePath(); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill();
      ground(g, L, Rr, 152, '#ffe8b8', '#f6d698');
      const r = srnd(V.seed); for (let i = 0; i < 30; i++) { E(g, L + r() * (Rr - L), 160 + r() * 58, 1.4, .8); g.fillStyle = 'rgba(200,160,90,.4)'; g.fill(); }
      if (!clean) { const r2 = srnd(12); for (let i = 0; i < 6; i++) { const x = X(40 + r2() * 320), y = 172 + r2() * 40; E(g, x, y, 9, 3, r2()); F(g, '#7a8a3a', 1, '#4a5a2a'); } }
      if (f.has('laudtee')) { const bx = X(136); g.beginPath(); g.moveTo(bx - 10, 222); g.lineTo(bx + 8, 222); g.lineTo(bx + 52, 168); g.lineTo(bx + 40, 168); g.closePath(); F(g, P.w, 1.1); for (let i = 0; i < 9; i++) { const u = i / 9; ln(g, [bx - 10 + u * 50, 222 - u * 54, bx + 8 + u * 44, 222 - u * 54], dk(P.w, .3), .8); } }
      // beach bar hut
      const hx = X(232), yb = 172, ok = f.has('baar');
      for (const s of [-1, 1]) ln(g, [hx + s * 34, yb, hx + s * 34, yb - 40], ok ? '#a8683e' : '#8a7a6a', 3);
      R(g, hx - 36, yb - 20, 72, 20, 2); VG(g, ok ? P.wall : '#b8ae9e', yb - 20, yb, 1.4);
      if (ok) { for (let i = 0; i < 6; i++) ln(g, [hx - 34 + i * 13, yb - 18, hx - 34 + i * 13, yb - 2], dk(P.wall, .2), .8); R(g, hx - 40, yb - 23, 80, 5, 2); F(g, '#ffffff', 1.1); for (let i = 0; i < 4; i++) { R(g, hx - 24 + i * 15, yb - 31, 5, 8, 1); F(g, ['#ff8fb8', '#ffd23f', '#7fe0d0', '#ff7a6b'][i], .8); dot(g, hx - 21.5 + i * 15, yb - 32, 2.4, '#fff6c0'); } pill(g, hx, yb - 10, 44, 11, P.a, dk(P.a, .4), 'BAAR', 7.5); }
      g.beginPath(); g.moveTo(hx - 50, yb - 36); g.lineTo(hx, yb - 64); g.lineTo(hx + 50, yb - 36); g.quadraticCurveTo(hx, yb - 32, hx - 50, yb - 36); g.closePath(); VG(g, ok ? P.roof : '#9a907e', yb - 64, yb - 36, 1.4);
      g.save(); g.clip(); for (let i = 0; i < 40; i++) { const xx = hx - 50 + i * 2.6; ln(g, [xx, yb - 36, xx + (xx - hx) * .1, yb - 44], dk(ok ? P.roof : '#9a907e', .25), .8, .6); } g.restore();
      for (let xx = hx - 48; xx < hx + 48; xx += 4) ln(g, [xx, yb - 36, xx, yb - 32], ok ? dk(P.roof, .2) : '#8a806e', 1);
      if (!ok) { E(g, hx - 14, yb - 48, 7, 4); F(g, '#4a3a30', 1); }
      if (f.has('torn')) { // lifeguard tower
        const tx = X(352); for (const s of [-1, 1]) ln(g, [tx + s * 12, 196, tx + s * 7, 150], '#ffffff', 2.4); ln(g, [tx - 11, 186, tx + 11, 170], '#ffffff', 1.4); ln(g, [tx + 11, 186, tx - 11, 170], '#ffffff', 1.4);
        R(g, tx - 13, 136, 26, 16, 2); F(g, '#ff5a5f', 1.3); txt(g, '+', tx, 144, 12, '#ffffff'); PL(g, [tx - 16, 136, tx, 124, tx + 16, 136]); F(g, '#ffffff', 1.3, '#c03a3a'); ln(g, [tx + 14, 136, tx + 14, 112], '#8a7a6a', 1.2); PL(g, [tx + 14, 112, tx + 26, 116, tx + 14, 120]); F(g, '#ffd23f', .8);
      }
      if (f.has('vorkpall')) { const vx = X(70); ln(g, [vx - 30, 200, vx - 30, 166], '#8a6a4a', 2); ln(g, [vx + 30, 200, vx + 30, 166], '#8a6a4a', 2); R(g, vx - 30, 166, 60, 10, 0); g.save(); g.clip(); for (let x = vx - 30; x < vx + 30; x += 4) ln(g, [x, 166, x, 176], '#ffffff', .6, .7); for (let y = 168; y < 176; y += 3) ln(g, [vx - 30, y, vx + 30, y], '#ffffff', .6, .7); g.restore(); ln(g, [vx - 30, 166, vx + 30, 166], '#ffffff', 1.6); }
      if (f.has('toolid')) { const s = st('toolid'); for (const [ux, sx] of [[X(170), X(196)], [X(290), X(312)]]) { umbrella(g, ux, 210, s, P); lounger(g, sx, 214, s, P, V.flip); } }
      if (f.has('tuled')) { for (const tx of [X(186), X(278)]) { ln(g, [tx, 176, tx, 140], '#8a5a30', 2.4); R(g, tx - 3, 136, 6, 6, 1.5); F(g, '#8a5a30', 1); } pennants(g, [hx - 50, yb - 36, hx - 25, yb - 40, hx, yb - 42, hx + 25, yb - 40, hx + 50, yb - 36].map((v, i) => i % 2 ? v + 10 : v), [P.a, '#ffffff', P.c, '#ffd23f']); }
      if (!clean) { junk(g, X(110), 200, 5); crate(g, X(300), 206, .9, '#a89a88'); }
      else { for (let i = 0; i < 5; i++) { const sx = X(40 + i * 75 + (i % 2) * 10), sy = 206 + (i % 3) * 5; star(g, sx, sy, 3.4, 1.4, 5); F(g, ['#ff9a7a', '#ffd06a', '#ffffff'][i % 3], .7); } }
      extras(g, f.extra, V, 214);
    },
    anim(g, f, t, V, L, Rr) {
      seaSparkle(g, L, Rr, 108, 146, t);
      if (f.has('paadid')) for (let i = 0; i < 3; i++) { const bx = ((t * (5 + i * 2) + i * 140) % (Rr - L + 80)) + L - 40, by = 126 + i * 7 + Math.sin(t * 2 + i) * .8; R(g, bx - 12, by, 24, 3.4, 1.7); F(g, [V.pal.a, V.pal.c, '#ffd23f'][i], .8); dot(g, bx, by - 4, 2.4, '#ffd8b8'); ln(g, [bx, by - 2, bx + 3, by + 1], '#ff6b8a', 1.6); ln(g, [bx + 4, by - 8, bx - 4, by + 4], '#5a4a3a', .8); }
      if (f.has('vorkpall')) { const p = (t * .7) % 1, x = V.X(70) + (p - .5) * 40, y = 150 - Math.sin(p * PI) * 26; dot(g, x, y, 3.2, '#ffffff'); g.beginPath(); g.arc(x, y, 3.2, 0, PI); g.fillStyle = '#ffd23f'; g.fill(); }
      if (f.has('tuled')) for (const tx of [V.X(186), V.X(278)]) { const fl = Math.sin(t * 12 + tx) * .6; g.beginPath(); g.moveTo(tx - 3, 136); g.quadraticCurveTo(tx - 3 + fl, 128, tx + fl, 124); g.quadraticCurveTo(tx + 3 + fl, 128, tx + 3, 136); g.closePath(); g.fillStyle = '#ffb21e'; g.fill(); dot(g, tx, 133, 1.6, '#fff6c0'); }
      for (let i = 0; i < 2; i++) bird(g, ((t * 13 + i * 190) % 520) - 60, 50 + i * 14, 1, Math.sin(t * 9 + i));
    },
    glows: (f, V) => [].concat(f.has('tuled') ? [[V.X(186), 132, 14], [V.X(278), 132, 14]] : [], f.has('baar') ? [[V.X(232), 160, 22]] : [])
  };
  function stall(g, x, yb, w, s, P, sign, goods) {
    const roof = s === 'boho' ? '#b7865c' : s === 'minimal' ? '#3a4150' : s === 'romantic' ? '#ffb0c6' : P.a, wall = s === 'minimal' ? '#ffffff' : s === 'romantic' ? '#fff4f6' : '#c98a5a';
    R(g, x - w / 2, yb - 34, w, 34, 2); VG(g, wall, yb - 34, yb, 1.4); if (s !== 'minimal' && s !== 'romantic') for (let i = 1; i < 5; i++) ln(g, [x - w / 2, yb - 34 + i * 7, x + w / 2, yb - 34 + i * 7], dk(wall, .3), .7, .7);
    R(g, x - w / 2 + 5, yb - 30, w - 10, 14, 2); F(g, '#5a3a2a', 1); for (let i = 0; i < goods.length; i++) { const gx = x - w / 2 + 10 + i * ((w - 20) / (goods.length - 1 || 1)); goods[i](g, gx, yb - 20); }
    R(g, x - w / 2 - 3, yb - 17, w + 6, 4, 1.5); F(g, s === 'minimal' ? '#dfe3ea' : '#e8c89a', 1);
    PL(g, [x - w / 2 - 8, yb - 34, x, yb - 56, x + w / 2 + 8, yb - 34]); F(g, roof, 1.4, dk(roof, .45));
    g.beginPath(); g.moveTo(x - w / 2 - 9, yb - 33); g.lineTo(x, yb - 56); g.lineTo(x + w / 2 + 9, yb - 33); g.lineWidth = 4; g.strokeStyle = '#ffffff'; g.lineCap = 'round'; g.stroke(); // snow edge
    for (let i = 0; i < 5; i++) { const u = (i + .5) / 5, px = x - w / 2 - 8 + u * (w + 16), py = yb - 34 - (1 - Math.abs(u - .5) * 2) * 22; E(g, px, py + 1, 3, 2); F(g, '#ffffff', 0); }
    if (s === 'boho') { for (let i = 0; i < 5; i++) { dot(g, x - w / 2 + 4 + i * (w - 8) / 4, yb - 33, 2.6, '#3f7a52'); dot(g, x - w / 2 + 4 + i * (w - 8) / 4, yb - 33, 1.3, '#f2a23a'); } }
    if (s === 'romantic') { heart(g, x, yb - 44, 4); F(g, '#ec5f86', .8); }
    if (s === 'minimal') { dot(g, x, yb - 44, 2.6, '#f2c46d'); }
    if (!s) { star(g, x, yb - 44, 4, 1.8, 5); F(g, '#ffd23f', .8); }
    pill(g, x, yb - 4, w - 6, 10, s === 'minimal' ? '#3a4150' : s === 'romantic' ? '#ec5f86' : '#ffffff', '#5a3a2a', sign, 6.5, s === 'minimal' || s === 'romantic' ? '#ffffff' : '#a8463c');
  }
  const goodsGinger = [(g, x, y) => { E(g, x, y, 4, 4); F(g, '#c98a4a', .8); ln(g, [x - 2, y, x + 2, y], '#ffffff', .8); }, (g, x, y) => { heart(g, x, y + 2, 4.4); F(g, '#c98a4a', .8); }, (g, x, y) => { star(g, x, y, 4.4, 2, 5); F(g, '#c98a4a', .8); }];
  const goodsCocoa = [(g, x, y) => { R(g, x - 3, y - 3, 6, 7, 1.5); F(g, '#ffffff', .8); dot(g, x, y - 3.4, 2, '#8a4f32'); }, (g, x, y) => { R(g, x - 3, y - 3, 6, 7, 1.5); F(g, '#e2484c', .8); }, (g, x, y) => { R(g, x - 3, y - 3, 6, 7, 1.5); F(g, '#ffffff', .8); dot(g, x, y - 3.4, 2, '#fff6e0'); }];
  T.xmas = {
    still(g, f, V, L, Rr) {
      const P = V.pal, X = V.X, clean = f.has('koristus');
      SH.sky(g, L, Rr, '#8ab8f0', '#f4f0ff', 130); SH.sun(g, X(320), 40, 10, '#ffe6a0');
      hill(g, L, Rr, [L, 118, 120, 108, 240, 116, Rr, 104], '#f4f8ff', 220);
      const r = srnd(V.seed); for (let i = 0; i < 12; i++) { const tx = L + 10 + i * ((Rr - L) / 11) + r() * 8; tree(g, tx, 124 + r() * 5, .5 + r() * .25, 'pine'); E(g, tx, 124 + r() * 5 - 26, 5, 2.4); g.fillStyle = '#ffffff'; g.fill(); }
      ground(g, L, Rr, 140, '#ffffff', '#e4ecfa');
      if (clean) { g.beginPath(); g.moveTo(170, 222); g.quadraticCurveTo(190, 176, 196, 150); g.lineTo(206, 150); g.quadraticCurveTo(212, 176, 232, 222); g.closePath(); F(g, '#d8d0c8', 0); cobbles(g, 176, 226, 160, 9, '#8a8078'); }
      else { const r2 = srnd(14); for (let i = 0; i < 9; i++) { E(g, X(40 + r2() * 320), 170 + r2() * 40, 14 + r2() * 10, 6); F(g, '#f0f4ff', 1, '#b8c4e0'); } }
      if (f.has('kuusk')) { // the big tree
        const tx = 200, ty = 156; R(g, tx - 4, ty - 6, 8, 8, 1); F(g, '#7a5232', 1);
        for (let k = 0; k < 4; k++) { const w = 34 - k * 7, y = ty - 6 - k * 18; PL(g, [tx - w, y, tx, y - 30, tx + w, y]); VG(g, '#3f9a5a', y - 30, y, 1.4); g.beginPath(); g.moveTo(tx - w, y); g.quadraticCurveTo(tx, y - 4, tx + w, y); g.lineWidth = 2.4; g.strokeStyle = '#ffffff'; g.stroke(); }
        const r3 = srnd(21); for (let i = 0; i < 16; i++) { const u = r3(), yy = ty - 12 - u * 70, ww = (1 - u) * 28; dot(g, tx + (r3() - .5) * ww * 1.6, yy, 2.4, [P.a, '#ffd23f', '#7fd0ff', '#ffffff', P.c][i % 5]); }
        R(g, tx - 14, ty - 2, 10, 8, 1.5); F(g, P.a, 1); R(g, tx + 4, ty, 12, 7, 1.5); F(g, '#7fd0ff', 1); ln(g, [tx - 9, ty - 2, tx - 9, ty + 6], '#ffd23f', 1.2);
      }
      if (f.has('saan')) { pstar(g, 200, 72, 9); F(g, '#ffd23f', 1.2, '#c08a10'); HL(g, 197, 69, 2, 1.2, -.5, .7); }
      if (f.has('karussell')) { // a little carousel in the back
        const cx = X(268), cy = 146; R(g, cx - 24, cy - 4, 48, 6, 2); F(g, '#ffffff', 1.2); for (let i = 0; i < 5; i++) ln(g, [cx - 20 + i * 10, cy - 4, cx - 20 + i * 10, cy - 30], '#d8b85a', 1.4);
        PL(g, [cx - 30, cy - 30, cx, cy - 50, cx + 30, cy - 30]); F(g, P.a, 1.3); for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(cx - 25 + i * 10, cy - 30, 5, 0, PI); F(g, i % 2 ? '#ffffff' : P.a, .8); } dot(g, cx, cy - 52, 2.6, '#ffd23f');
        for (let i = 0; i < 3; i++) { E(g, cx - 14 + i * 14, cy - 14, 5, 3.4); F(g, ['#ffffff', '#ffd6e2', '#d6ecff'][i], 1); }
      }
      for (const [k, sx, sign, goods] of [['putka', X(86), 'PIPARKOOK', goodsGinger], ['putka2', X(330), 'KAKAO', goodsCocoa]]) {
        if (f.has(k)) { stall(g, sx, 198, 62, st(k), P, sign, goods); continue; }
        // an empty stall frame, half buried in snow
        for (const s of [-1, 1]) ln(g, [sx + s * 28, 198, sx + s * 28, 160], '#9a8a7a', 2.6); PL(g, [sx - 36, 162, sx, 144, sx + 30, 158], true); g.lineWidth = 2.4; g.strokeStyle = '#9a8a7a'; g.stroke();
        R(g, sx - 30, 180, 60, 4, 1); F(g, '#a89a88', 1); E(g, sx, 198, 40, 8); F(g, '#ffffff', 1, '#c4cce0');
      }
      if (!f.has('kuusk')) { ln(g, [200, 156, 202, 120], '#7a5a3a', 2); for (let k = 0; k < 4; k++) { ln(g, [201, 150 - k * 8, 190 + k * 2, 156 - k * 8], '#5a7a5a', 1.6); ln(g, [201, 150 - k * 8, 212 - k * 2, 154 - k * 8], '#5a7a5a', 1.6); } E(g, 201, 158, 14, 4); F(g, '#ffffff', 1, '#c4cce0'); }
      if (f.has('lumememm')) { const sx = X(146), sy = 216; E(g, sx, sy - 9, 12, 10); F(g, '#ffffff', 1.3, '#a8b4d0'); E(g, sx, sy - 25, 9, 8); F(g, '#ffffff', 1.3, '#a8b4d0'); E(g, sx, sy - 38, 7, 6.5); F(g, '#ffffff', 1.3, '#a8b4d0'); dot(g, sx - 2.4, sy - 40, 1, '#2a2a3a'); dot(g, sx + 2.4, sy - 40, 1, '#2a2a3a'); PL(g, [sx, sy - 38, sx + 7, sy - 37, sx, sy - 36]); F(g, '#ff8a3a', .6); R(g, sx - 9, sy - 32, 18, 3.6, 1.6); F(g, P.a, 1); R(g, sx - 6, sy - 50, 12, 6, 1); F(g, '#3a3a4a', 1); R(g, sx - 8, sy - 45, 16, 2.4, 1); F(g, '#3a3a4a', 1); }
      if (f.has('saan')) { const sx = X(250) + (V.flip ? -10 : 10), sy = 212; g.beginPath(); g.moveTo(sx - 22, sy); g.lineTo(sx + 16, sy); g.quadraticCurveTo(sx + 24, sy, sx + 22, sy - 6); ln(g, [sx - 22, sy, sx + 16, sy], '#d8b85a', 1.8); R(g, sx - 18, sy - 16, 34, 13, 4); F(g, P.a, 1.3); for (let i = 0; i < 3; i++) { R(g, sx - 14 + i * 10, sy - 26, 9, 10, 1.5); F(g, ['#7fd0ff', '#ffd23f', '#ffffff'][i], 1); ln(g, [sx - 9.5 + i * 10, sy - 26, sx - 9.5 + i * 10, sy - 16], P.c, 1); } }
      if (f.has('tuled')) { garland(g, [L + 6, 112, 70, 124, 140, 116, 200, 120, 260, 116, 330, 124, Rr - 6, 112], null, { a: '#ff5a5a', c: '#7fd0ff' }); }
      if (!clean) { crate(g, X(150), 210, .9, '#a89a88'); crate(g, X(260), 214, .8, '#a89a88'); }
      extras(g, f.extra, V, 216);
    },
    anim(g, f, t, V, L, Rr) {
      if (f.has('kuusk')) for (let i = 0; i < 6; i++) { const a = .5 + .5 * Math.sin(t * 3 + i * 1.7); if (a > .6) A.H.spark(g, 200 + Math.sin(i * 2.3) * 18, 140 - i * 11, 2.8 * a, '#fff6c0'); }
      if (f.has('karussell')) { const cx = V.X(268); for (let i = 0; i < 3; i++) { const a = t * 1.2 + i * TAU / 3, x = cx + Math.sin(a) * 18, y = 128 + Math.sin(t * 3 + i) * 2; if (Math.cos(a) < 0) continue; E(g, x, y, 4, 3); F(g, ['#ffd6e2', '#ffffff', '#d6ecff'][i], .8); } }
      if (f.has('tuled')) lights(g, [L + 40, 120, 105, 122, 170, 120, 230, 120, 295, 122, Rr - 40, 120], t);
      if (f.has('putka2')) smoke(g, V.X(330), 150, t, '#ffffff');
    },
    glows: (f, V) => [].concat(f.has('putka') ? [[V.X(86), 174, 18]] : [], f.has('putka2') ? [[V.X(330), 174, 18]] : [], f.has('kuusk') ? [[200, 110, 34]] : [], f.has('tuled') ? garlandGlow([16, 112, 70, 124, 140, 116, 200, 120, 260, 116, 330, 124, 384, 112]) : [])
  };
  T.orchard = {
    still(g, f, V, L, Rr) {
      const P = V.pal, X = V.X, clean = f.has('koristus');
      SH.sky(g, L, Rr, '#78c4f0', '#ffeede', 132); SH.sun(g, X(300), 40, 12, '#ffc85a'); SH.cloud(g, X(110), 34, 1, .8);
      hill(g, L, Rr, [L, 118, 120, 104, 240, 112, Rr, 100], '#d8c060', 220);
      const r = srnd(V.seed); for (let i = 0; i < 8; i++) { const tx = L + 10 + i * ((Rr - L) / 7) + r() * 10; tree(g, tx, 124 + r() * 4, .5 + r() * .15, 'round', { col: ['#f2a23a', '#e2574c', '#d8c040'][i % 3] }); }
      ground(g, L, Rr, 140, '#b8d870', '#9cc860');
      // barn
      const bx = X(300), yb = 178, ok = f.has('ait');
      R(g, bx - 34, yb - 44, 68, 44, 2); VG(g, ok ? P.wall : '#a8988a', yb - 44, yb, 1.6);
      for (let xx = bx - 30; xx < bx + 34; xx += 7) ln(g, [xx, yb - 44, xx, yb], dk(ok ? P.wall : '#a8988a', .25), .8, .6);
      PL(g, [bx - 40, yb - 42, bx - 24, yb - 64, bx + 24, yb - 64, bx + 40, yb - 42]); VG(g, ok ? P.roof : '#8a827a', yb - 64, yb - 42, 1.6);
      R(g, bx - 14, yb - 30, 28, 30, 1); F(g, ok ? '#ffffff' : '#7a6a5a', 1.3); if (ok) { ln(g, [bx - 14, yb - 30, bx + 14, yb], P.wall, 2); ln(g, [bx + 14, yb - 30, bx - 14, yb], P.wall, 2); R(g, bx - 8, yb - 54, 16, 10, 2); F(g, '#ffffff', 1.2); R(g, bx - 6, yb - 52, 12, 6, 1); F(g, '#ffe8a8', 0); }
      else { E(g, bx - 18, yb - 56, 6, 3.4); F(g, '#3a2a20', 1); boarded(g, bx - 8, yb - 54, 16, 10); }
      // apple trees
      const healthy = f.has('puud');
      for (const [tx, sc] of [[X(70), 1.15], [X(150), 1], [X(226), .9]]) tree(g, tx, 190, sc, 'round', { col: healthy ? '#5fbf4a' : '#9aa86a', apples: healthy, bare: !healthy });
      if (f.has('redel')) { const lx = X(160); ln(g, [lx - 6, 192, lx + 4, 150], '#a8683e', 1.8); ln(g, [lx + 4, 192, lx + 14, 150], '#a8683e', 1.8); for (let i = 1; i < 6; i++) ln(g, [lx - 6 + i * 2, 192 - i * 7, lx + 4 + i * 2, 192 - i * 7], '#a8683e', 1.4); for (const [ax, ay] of [[X(118), 200], [X(186), 202]]) { R(g, ax - 9, ay - 9, 18, 9, 3); F(g, '#d8a868', 1.1); for (let k = 0; k < 4; k++) dot(g, ax - 5 + k * 3.4, ay - 10, 2.6, k % 2 ? '#e2463c' : '#ffd040'); } }
      if (f.has('korvitsad')) { const r2 = srnd(V.seed + 2); for (let i = 0; i < 6; i++) { const px = X(40 + r2() * 300), py = 200 + r2() * 14, s = .8 + r2() * .5; for (const dx of [-4, 0, 4]) { E(g, px + dx * s, py, 5 * s, 4.4 * s); F(g, '#ff9a2a', 1, '#c05a10'); } R(g, px - 1, py - 6 * s, 2, 3, 1); F(g, '#5a7a3a', 0); } }
      if (f.has('mahlalett')) { // cider stand
        const s = st('mahlalett'), sx = X(240), sy = 204, Pp = P_(V, s);
        R(g, sx - 22, sy - 18, 44, 18, 2); VG(g, s === 'minimal' ? '#ffffff' : s === 'romantic' ? '#fff4f6' : '#c98a5a', sy - 18, sy, 1.3);
        for (let i = 0; i < 4; i++) { R(g, sx - 17 + i * 10, sy - 27, 6, 9, 1.5); F(g, '#ffe8a0', .9, '#c8a030'); }
        umbrella(g, sx, sy, s, { a: P.a, b: '#ffffff' }); pill(g, sx, sy - 9, 34, 9, s === 'minimal' ? '#3a4150' : Pp.a === '#fbfbf9' ? '#3a4150' : (s ? Pp.c : P.a), '#5a3a2a', 'MAHL', 6.5);
      }
      if (f.has('kiik')) { // swing on the first tree
        const s = st('kiik'), tx = X(70) + (V.flip ? -16 : 16); ln(g, [tx - 6, 150, tx - 6, 182], '#8a6a4a', .9); ln(g, [tx + 6, 150, tx + 6, 182], '#8a6a4a', .9);
        R(g, tx - 9, 182, 18, 3.4, 1.5); F(g, s === 'boho' ? '#d8a868' : s === 'minimal' ? '#ffffff' : s === 'romantic' ? '#ffb0c6' : P.c, 1, s === 'minimal' ? '#3a4150' : null);
        if (s === 'romantic') for (let i = 0; i < 4; i++) { dot(g, tx - 6, 156 + i * 7, 1.8, '#ff8fb0'); dot(g, tx + 6, 158 + i * 7, 1.8, '#ffd0dc'); }
        if (s === 'boho') for (let i = 0; i < 5; i++) ln(g, [tx - 8 + i * 4, 185, tx - 8 + i * 4, 190], '#d9825b', 1);
      }
      if (f.has('vanikud')) { garland(g, [L + 6, 120, 80, 132, 160, 124, 240, 132, 320, 124, Rr - 6, 132], 'boho', P); for (const lx of [X(120), X(270)]) lantern(g, lx, 214, true); }
      if (!clean) { const r3 = srnd(17); for (let i = 0; i < 40; i++) { E(g, L + r3() * (Rr - L), 186 + r3() * 32, 2.4, 1.4, r3() * 3); g.fillStyle = ['#e2874c', '#d8a030', '#b8463c'][i % 3]; g.fill(); } weeds(g, X(100), 206, 50, 4); }
      else for (const [px, py] of [[X(30), 208], [X(372), 212]]) { for (let i = 0; i < 14; i++) { E(g, px + Math.cos(i) * 8 * (i / 14), py - Math.sin(i * 1.3) * 3 - i * .3, 2.6, 1.5, i); g.fillStyle = ['#e2874c', '#d8a030', '#b8463c'][i % 3]; g.fill(); } }
      extras(g, f.extra, V, 216);
      grass(g, L, Rr, 200, 220, 51, '#7ab84a');
    },
    anim(g, f, t, V) {
      for (let i = 0; i < 4; i++) { const p = (t * .1 + i / 4) % 1, x = V.X(60 + i * 90) + Math.sin(t * 1.4 + i) * 16, y = 110 + p * 100; E(g, x, y, 2.6, 1.4, t * 2 + i); g.fillStyle = rgba(['#e2874c', '#d8a030', '#b8463c', '#f2a23a'][i], Math.sin(p * PI)); g.fill(); }
      if (f.has('ait')) smoke(g, V.X(300) + 20, 112, t, '#f4eee8');
      if (f.has('vanikud')) lights(g, [V.X(120), 180, V.X(270), 180], t);
    },
    glows: (f, V) => [].concat(f.has('ait') ? [[V.X(300), 126, 12]] : [], f.has('vanikud') ? [[V.X(120), 180, 12], [V.X(270), 180, 12]] : [])
  };

  // ---------- public ----------
  A.tourScene = function (ctx, island, progress, x, y, w, h, t, opts) {
    if (!island || w < 4 || h < 4) return;
    if (typeof island === 'number') island = A.tourDemo(island);
    const S0 = state(island, progress, opts && opts.style), V = S0.V, th = T[V.th] || T.flower, list = FEAT[V.th];
    V.X = V.flip ? (v => 400 - v) : (v => v);
    const on = S0.on;
    const def = { still: (g, f, L, Rr) => th.still(g, f, V, L, Rr), anim: (g, f, tt, L, Rr) => th.anim(g, f, tt, V, L, Rr), glows: f => th.glows(f, V) };
    const id = 'tour|' + V.th + '|' + V.i + '|' + list.map(k => on.has(k) ? 1 : 0).join('') + '+' + on.extra;
    A._renderScene(ctx, id, def, on, Math.max(.35, S0.frac), x, y, w, h, t, opts, S0.sty);
  };
})();
