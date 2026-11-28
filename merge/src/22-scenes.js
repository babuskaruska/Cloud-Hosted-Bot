// ===== ART scenes (Ash): six village illustrations that visibly improve with each completed task. =====
// ART.scene(ctx, area, progress, x, y, w, h, t)
//   area: 'pagariari' | 'aed' | 'sadam' | 'tuuleveski' | 'majakas' | 'saladus' (or 0..5, or an English alias)
//   progress: Set / array of completed task ids (or a plain count, or {id: true}). Each area has an ordered list of
//   visual features (ART.sceneFeatures[area]). A task id turns a feature on when ART.sceneMap[id] = [area, feature],
//   when the id is the feature name (or ends with _feature / -feature), or when it matches the feature's keywords.
//   Any other task of this area turns on the next feature still off, so every task visibly improves the scene.
//   A task's area comes from TASKS (if defined, field area/ala/piirkond) or from an id prefix like 'aed_…'.
// The still layer is cached per (area, features, size); smoke, waves, sails, birds and lights animate on top.
(function () {
  const A = ART, { E, R, rrp, PL, SM, HL, dot, spark, star, heart, srnd, lt, dk, mix, rgba, mk } = A.H;
  const PI = Math.PI, TAU = PI * 2, DW = 400, DH = 220;
  A.areas = ['pagariari', 'aed', 'sadam', 'tuuleveski', 'majakas', 'saladus'];
  A.areaNames = { pagariari: 'Pagariäri', aed: 'Aed', sadam: 'Sadam', tuuleveski: 'Tuuleveski', majakas: 'Majakas', saladus: 'Vanaema saladus' };
  A.sceneFeatures = {
    pagariari: ['koristus', 'katus', 'seinad', 'aknad', 'uks', 'korsten', 'silt', 'lillekastid', 'pink', 'laternad', 'muri'],
    aed: ['umbrohi', 'aed', 'peenrad', 'ounapuu', 'kaev', 'lilled', 'kasvuhoone', 'mesitaru', 'kiik', 'hirmutis'],
    sadam: ['koristus', 'sild', 'paat', 'kuur', 'vorgud', 'tynnid', 'laternad', 'lipud', 'kiosk'],
    tuuleveski: ['rada', 'kivimyyr', 'veskimaja', 'katus', 'tiivad', 'trepp', 'jahukotid', 'lilled', 'laternad', 'veskikivi', 'lambad'],
    majakas: ['trepp', 'varv', 'aknad', 'tuli', 'maja', 'aed', 'pink', 'lipp', 'lilled'],
    saladus: ['rada', 'kadakad', 'varav', 'onn', 'aknad', 'laternad', 'raamat', 'lilled', 'tulikarbid', 'taevas', 'pidu']
  };
  // keyword hints (Estonian and English) so differently named task ids still find their feature
  const KW = {
    katus: /katus|roof|kõrkjas|olki/, seinad: /sein|värv|wall|paint/, aknad: /aken|akna|window/, uks: /uks|door/, korsten: /korsten|chimney|ahi|smoke/,
    silt: /silt|sign/, lillekastid: /lillekast|flowerbox/, pink: /pink|bench|laud|table/, laternad: /latern|tuled|lamp|light/, muri: /muri|kass|cat/,
    koristus: /korist|prügi|clean|junk|praht/, umbrohi: /umbroh|weed|rohi/, aed: /^aed$|tara|fence|aia/, peenrad: /peenar|peenra|bed|köögivil|porgand/,
    ounapuu: /õun|oun|apple|puu/, kaev: /kaev|well/, lilled: /lill|flower/, kasvuhoone: /kasvuhoone|greenhouse/, mesitaru: /taru|mesi|bee|hive/,
    kiik: /kiik|swing/, hirmutis: /hirmut|scarecrow/, sild: /sild|pier|kai|dock/, paat: /paat|boat/, kuur: /kuur|shed/, vorgud: /võrk|vork|net/,
    tynnid: /tünn|tynn|barrel|kast|crate/, lipud: /lipp|lipu|flag|bunting/, kiosk: /kiosk|kohvik|cafe|putka/,
    rada: /rada|tee$|path|kivitee/, kivimyyr: /müür|myyr|kiviaed|wall/, veskimaja: /veski|mill|maja/, tiivad: /tiib|tiiva|sail|wing/,
    trepp: /trepp|treppi|stair|redel/, jahukotid: /jahu|kott|sack|flour/, lambad: /lammas|lamba|sheep/, varv: /värv|varv|paint|triip/,
    tuli: /tuli|tule|lamp|light|lääts/, maja: /maja|house|cottage/, lipp: /lipp|flag/, kadakad: /kadak|juniper|põõsas/, varav: /värav|varav|gate/,
    onn: /onn|maja|cottage|köök/, raamat: /raamat|book|retsept|recipe/, tulikarbid: /tulikar|firefl|jaaniuss/, taevas: /taevas|täht|sky|star|virmalis/
  };
  // taskId -> [area, feature, feature...]: the game's 36 tasks (10-data.js) each light up one or more features
  A.sceneMap = {
    b1: ['pagariari', 'koristus'], b2: ['pagariari', 'uks', 'seinad'], b3: ['pagariari', 'aknad'], b4: ['pagariari', 'korsten', 'katus'],
    b5: ['pagariari', 'silt', 'lillekastid'], b6: ['pagariari', 'pink'], b7: ['pagariari', 'laternad', 'muri'],
    g1: ['aed', 'umbrohi'], g2: ['aed', 'aed', 'peenrad'], g3: ['aed', 'ounapuu', 'lilled'], g4: ['aed', 'mesitaru', 'kasvuhoone'], g5: ['aed', 'kiik'], g6: ['aed', 'kaev', 'hirmutis'],
    h1: ['sadam', 'koristus', 'sild'], h2: ['sadam', 'paat'], h3: ['sadam', 'vorgud'], h4: ['sadam', 'tynnid', 'kiosk'], h5: ['sadam', 'kuur'], h6: ['sadam', 'laternad', 'lipud'],
    w1: ['tuuleveski', 'rada', 'veskimaja'], w2: ['tuuleveski', 'tiivad'], w3: ['tuuleveski', 'kivimyyr', 'trepp', 'katus'], w4: ['tuuleveski', 'jahukotid', 'lilled'],
    w5: ['tuuleveski', 'laternad'], w6: ['tuuleveski', 'veskikivi', 'lambad'],
    l1: ['majakas', 'trepp', 'aed'], l2: ['majakas', 'aknad', 'pink'], l3: ['majakas', 'maja', 'lilled'], l4: ['majakas', 'varv', 'lipp'], l5: ['majakas', 'tuli'],
    s1: ['saladus', 'rada', 'kadakad', 'varav'], s2: ['saladus', 'onn', 'raamat'], s3: ['saladus', 'aknad', 'lilled', 'laternad'], s4: ['saladus', 'tulikarbid', 'taevas', 'pidu']
  };
  const AREA_ALIAS = {
    bakery: 'pagariari', pagar: 'pagariari', pagariäri: 'pagariari', garden: 'aed', harbour: 'sadam', harbor: 'sadam', windmill: 'tuuleveski', veski: 'tuuleveski',
    lighthouse: 'majakas', secret: 'saladus', vanaema: 'saladus', 'vanaema saladus': 'saladus', grandma: 'saladus'
  };
  function areaKey(a) {
    if (typeof a === 'number') return A.areas[Math.max(0, Math.min(5, a | 0))];
    if (a && typeof a === 'object') a = a.id || a.key || a.name;
    a = String(a || '').toLowerCase(); if (A.sceneFeatures[a]) return a; if (AREA_ALIAS[a]) return AREA_ALIAS[a];
    for (const k of A.areas) if (a.indexOf(k) === 0) return k;
    for (const k in AREA_ALIAS) if (a.indexOf(k) === 0) return AREA_ALIAS[k];
    return 'pagariari';
  }
  A.areaKey = areaKey;
  function taskArea(id) {
    try {
      // eslint-disable-next-line no-undef
      const T = typeof TASKS !== 'undefined' ? TASKS : null;
      if (T) {
        const t = Array.isArray(T) ? T.find(x => x && x.id === id) : T[id];
        if (t) { const a = t.area != null ? t.area : t.ala != null ? t.ala : t.piirkond; if (a != null) return areaKey(a); }
      }
    } catch (e) { }
    const s = id.toLowerCase();
    for (const k of A.areas) if (s.indexOf(k) === 0) return k;
    for (const k in AREA_ALIAS) if (s.indexOf(k) === 0) return AREA_ALIAS[k];
    return null;
  }
  function featureSet(area, progress) {
    const list = A.sceneFeatures[area], on = new Set();
    let ids = [];
    if (progress == null) ids = [];
    else if (typeof progress === 'number') { for (let i = 0; i < Math.min(progress, list.length); i++) on.add(list[i]); return on; }
    else if (progress instanceof Set || Array.isArray(progress)) ids = Array.from(progress);
    else if (typeof progress === 'object') ids = Object.keys(progress).filter(k => progress[k]);
    let generic = 0;
    for (const raw of ids) {
      const id = String(raw), m = A.sceneMap[id];
      if (m) { if (areaKey(m[0]) === area) for (let i = 1; i < m.length; i++) on.add(m[i]); continue; }
      const ar = taskArea(id); if (ar && ar !== area) continue;
      const low = id.toLowerCase();
      let f = list.find(f => low === f || low.endsWith('_' + f) || low.endsWith('-' + f) || low.endsWith('.' + f) || low.endsWith(':' + f));
      if (!f) f = list.find(f => !on.has(f) && KW[f] && KW[f].test(low.replace(/^[a-z]+[_\-.:]/, '')));
      if (f && !on.has(f)) on.add(f); else generic++;
    }
    for (const f of list) { if (generic <= 0) break; if (!on.has(f)) { on.add(f); generic--; } }
    return on;
  }
  A.sceneState = function (area, progress) { const k = areaKey(area); const on = featureSet(k, progress); return { area: k, on: Array.from(on), frac: on.size / A.sceneFeatures[k].length }; };

  // ---------- scene drawing helpers (design space 400 x 220) ----------
  function F(g, col, lw, olc) { g.fillStyle = col; g.fill(); if (lw !== 0) { g.lineWidth = lw || 1.6; g.strokeStyle = olc || dk(col, .6); g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); } }
  function VG(g, col, y0, y1, lw) { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, lt(col, .25)); gr.addColorStop(1, dk(col, .12)); g.fillStyle = gr; g.fill(); if (lw !== 0) { g.lineWidth = lw || 1.6; g.strokeStyle = dk(col, .6); g.lineJoin = 'round'; g.stroke(); } }
  function ln(g, pts, col, w, a) { PL(g, pts, true); g.lineWidth = w; g.strokeStyle = a != null ? rgba(col, a) : col; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); }
  // SKYOFF: while a still is drawn for a non-default hour or weather, the sky, sun and still clouds are left out (ART.sky draws
  // them live behind the scene). STY: feature -> style key of the still being drawn (design choices).
  let SKYOFF = false, STY = null;
  const sty = f => (STY && STY[f]) || null;
  function sky(g, L, Rr, top, bot, y1) { if (SKYOFF) return; const gr = g.createLinearGradient(0, 0, 0, y1); gr.addColorStop(0, top); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(L, -2, Rr - L, y1 + 2); }
  function sun(g, x, y, r, col) {
    if (SKYOFF) return;
    const gr = g.createRadialGradient(x, y, r * .3, x, y, r * 3.4); gr.addColorStop(0, rgba(col || '#fff3a8', .95)); gr.addColorStop(1, rgba(col || '#fff3a8', 0));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 3.4, 0, TAU); g.fill();
    g.save(); g.translate(x, y); g.fillStyle = 'rgba(255,240,160,.35)';
    for (let i = 0; i < 12; i++) { g.rotate(PI / 6); g.beginPath(); g.moveTo(-r * .22, -r * 1.25); g.lineTo(0, -r * 2.2); g.lineTo(r * .22, -r * 1.25); g.closePath(); g.fill(); }
    g.restore();
    g.beginPath(); g.arc(x, y, r, 0, TAU); const sg = g.createLinearGradient(0, y - r, 0, y + r); sg.addColorStop(0, '#fffbe0'); sg.addColorStop(1, col || '#ffd84a'); g.fillStyle = sg; g.fill();
  }
  function cloud(g, x, y, s, a) {
    if (SKYOFF) return;
    a = a == null ? .9 : a;
    g.fillStyle = 'rgba(190,215,255,' + a * .6 + ')';
    E(g, x, y + 2 * s, 19 * s, 7 * s); g.fill();
    g.fillStyle = 'rgba(255,255,255,' + a + ')';
    E(g, x, y, 18 * s, 7 * s); g.fill(); E(g, x - 9 * s, y - 3 * s, 9 * s, 7 * s); g.fill(); E(g, x + 5 * s, y - 6 * s, 11 * s, 9 * s); g.fill(); E(g, x + 13 * s, y - 1 * s, 7 * s, 6 * s); g.fill();
  }
  function seaBand(g, L, Rr, y0, y1, c0, c1) {
    const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, c0 || '#8fd0e6'); gr.addColorStop(1, c1 || '#4aa3c7'); g.fillStyle = gr; g.fillRect(L, y0, Rr - L, y1 - y0);
    const r = srnd(17); g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 1.2; g.lineCap = 'round';
    for (let i = 0; i < 26; i++) { const x = L + r() * (Rr - L), y = y0 + 3 + r() * (y1 - y0 - 4), w = 4 + r() * 10; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.stroke(); }
  }
  function hill(g, L, Rr, pts, col, y1, lw) { g.beginPath(); g.moveTo(L, y1); g.lineTo(L, pts[1]); SM(g, pts, true, true); g.lineTo(Rr, pts[pts.length - 1]); g.lineTo(Rr, y1); g.closePath(); VG(g, col, Math.min(...pts.filter((v, i) => i % 2)), y1, lw == null ? 0 : lw); }
  function tuft(g, x, y, s, col) { g.beginPath(); g.moveTo(x - 3 * s, y); g.quadraticCurveTo(x - 3 * s, y - 5 * s, x - 5 * s, y - 8 * s); g.moveTo(x, y); g.quadraticCurveTo(x, y - 6 * s, x + 1 * s, y - 10 * s); g.moveTo(x + 3 * s, y); g.quadraticCurveTo(x + 3 * s, y - 5 * s, x + 6 * s, y - 7 * s); g.lineWidth = 1.5 * s; g.strokeStyle = col || '#5f9a45'; g.lineCap = 'round'; g.stroke(); }
  function grass(g, L, Rr, y0, y1, seed, col) { const r = srnd(seed); for (let x = L; x < Rr; x += 9) { if (r() < .5) tuft(g, x + r() * 6, y0 + r() * (y1 - y0), .7 + r() * .5, col); } }
  function weeds(g, x, y, w, seed) {
    const r = srnd(seed);
    for (let i = 0; i < w / 5; i++) { const xx = x + r() * w, h = 8 + r() * 14; g.beginPath(); g.moveTo(xx, y); g.quadraticCurveTo(xx + (r() - .5) * 8, y - h * .6, xx + (r() - .5) * 10, y - h); g.lineWidth = 1.8; g.strokeStyle = r() < .5 ? '#6f8a3a' : '#8a9a48'; g.stroke(); if (r() < .3) dot(g, xx + (r() - .5) * 8, y - h, 1.8, '#c9b860'); }
    for (let i = 0; i < w / 14; i++) { E(g, x + r() * w, y - 2, 6 + r() * 4, 4 + r() * 3); F(g, '#7f9a4a', 1.2); }
  }
  const FLCOL = { boho: ['#ff9a5a', '#ffd06a', '#f6ead6', '#e2874c'], minimal: ['#ffffff', '#f4f0e8', '#ffffff', '#e8eef0'], romantic: ['#ff8fb0', '#ffd0dc', '#ffffff', '#ec5f86'] };
  function flowers(g, x, y, w, seed, dense, st) {
    const r = srnd(seed), cols = FLCOL[st] || ['#f58aa0', '#ffffff', '#5b86e0', '#f7d24c', '#f7a8c8', '#ff8a5c'];
    for (let i = 0; i < w / (dense ? 3 : 5); i++) {
      const xx = x + r() * w, yy = y - r() * 6, h = 5 + r() * 7;
      g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx, yy - h); g.lineWidth = 1.1; g.strokeStyle = '#4f8f3f'; g.stroke();
      const c = cols[(r() * cols.length) | 0]; for (let k = 0; k < 5; k++) { const a = k * 1.2566; dot(g, xx + Math.cos(a) * 1.6, yy - h + Math.sin(a) * 1.6, 1.4, c); } dot(g, xx, yy - h, 1, '#f6c33b');
    }
  }
  function bush(g, x, y, s, col, fl) {
    const p = []; for (let i = 0; i <= 8; i++) { const a = PI + i * PI / 8; p.push(x + Math.cos(a) * 14 * s * (1 + (i % 2) * .1), y + Math.sin(a) * 11 * s * (1 + (i % 2) * .15)); }
    g.beginPath(); g.moveTo(x - 14 * s, y); SM(g, p, true, true); g.closePath(); VG(g, col || '#6aa84f', y - 11 * s, y, 1.4);
    HL(g, x - 5 * s, y - 7 * s, 4 * s, 2 * s, -.3, .25);
    if (fl) { const r = srnd(x | 0); for (let i = 0; i < 5; i++) dot(g, x + (r() - .5) * 20 * s, y - 3 * s - r() * 7 * s, 1.6 * s, fl); }
  }
  function tree(g, x, y, s, kind, opt) {
    opt = opt || {};
    if (kind === 'birch') {
      R(g, x - 2.5 * s, y - 50 * s, 5 * s, 50 * s, 2); F(g, '#f4efe6', 1.3, '#7a6a5a');
      for (let i = 0; i < 6; i++) { R(g, x - 2.5 * s + (i % 2) * 2 * s, y - 8 * s - i * 7 * s, 2.5 * s, 1.4 * s, .5); F(g, '#3a2a20', 0); }
      for (const [dx, dy, r] of [[-10, -50, 12], [8, -56, 13], [0, -66, 12], [-6, -40, 9], [10, -42, 9]]) { E(g, x + dx * s, y + dy * s, r * s, r * .8 * s); F(g, '#8cc45a', 1.2, '#4f7a30'); }
      return;
    }
    if (kind === 'pine' || kind === 'juniper') {
      const c = kind === 'juniper' ? (opt.col || '#4f7f5a') : '#3f7a52', hh = kind === 'juniper' ? 34 : 56;
      R(g, x - 2 * s, y - 6 * s, 4 * s, 6 * s, 1); F(g, '#6b4a30', 1);
      g.beginPath(); g.moveTo(x, y - hh * s); g.quadraticCurveTo(x + 13 * s, y - hh * .4 * s, x + (kind === 'juniper' ? 9 : 15) * s, y - 4 * s); g.lineTo(x - (kind === 'juniper' ? 9 : 15) * s, y - 4 * s); g.quadraticCurveTo(x - 13 * s, y - hh * .4 * s, x, y - hh * s); g.closePath();
      VG(g, c, y - hh * s, y, 1.3); HL(g, x - 3 * s, y - hh * .6 * s, 2 * s, 7 * s, .2, .18); return;
    }
    // round leafy tree (apple when opt.apples)
    R(g, x - 3.5 * s, y - 30 * s, 7 * s, 30 * s, 2); F(g, '#8a5a3a', 1.4);
    ln(g, [x, y - 22 * s, x - 8 * s, y - 32 * s], '#8a5a3a', 3 * s);
    if (opt.bare) { ln(g, [x, y - 28 * s, x + 10 * s, y - 42 * s], '#7a5a40', 2.4 * s); ln(g, [x, y - 28 * s, x - 6 * s, y - 46 * s], '#7a5a40', 2.4 * s); ln(g, [x - 8 * s, y - 32 * s, x - 16 * s, y - 38 * s], '#7a5a40', 2 * s); for (const [dx, dy] of [[10, -42], [-6, -46], [-16, -38]]) { E(g, x + dx * s, y + dy * s, 4 * s, 3 * s); F(g, '#9a9a5a', 1); } return; }
    for (const [dx, dy, r] of [[-12, -38, 14], [12, -40, 15], [0, -52, 16], [-3, -36, 12]]) { E(g, x + dx * s, y + dy * s, r * s, r * .85 * s); VG(g, opt.col || '#6fb552', y - 60 * s, y - 25 * s, 1.4); }
    HL(g, x - 6 * s, y - 56 * s, 6 * s, 3 * s, -.3, .3);
    if (opt.apples) { const r = srnd(5); for (let i = 0; i < 9; i++) { const ax = x + (r() - .5) * 34 * s, ay = y - 30 * s - r() * 26 * s; dot(g, ax, ay, 2.6 * s, '#e2463c'); dot(g, ax - .8 * s, ay - .8 * s, .8 * s, '#ffc0b0'); } }
    if (opt.blossom) { const r = srnd(9); for (let i = 0; i < 14; i++) dot(g, x + (r() - .5) * 36 * s, y - 28 * s - r() * 30 * s, 1.8 * s, '#ffd6e0'); }
  }
  function fence(g, x0, x1, y, h, broken, col, seed, st) {
    col = ({ boho: '#d8b48a', minimal: '#ffffff', romantic: '#ffd6e2' })[st] || col || '#f4efe6'; const r = srnd(seed || 3);
    R(g, x0, y - h * .7, x1 - x0, 3, 1); F(g, col, 1.2); R(g, x0, y - h * .3, x1 - x0, 3, 1); F(g, col, 1.2);
    for (let x = x0 + 2; x < x1 - 2; x += 8) {
      if (broken && r() < .35) { if (r() < .5) { g.save(); g.translate(x, y); g.rotate(.5 + r()); R(g, -2, -h + 2, 4, h - 2, 1); F(g, '#a89a88', 1.1); g.restore(); } continue; }
      g.beginPath(); g.moveTo(x - 2.2, y); g.lineTo(x - 2.2, y - h + 2); g.lineTo(x, y - h); g.lineTo(x + 2.2, y - h + 2); g.lineTo(x + 2.2, y); g.closePath(); F(g, broken ? '#b0a493' : col, 1.1);
    }
  }
  function stoneWall(g, x0, x1, y, h, seed, broken) {
    const r = srnd(seed || 4);
    for (let row = 0; row < 3; row++) for (let x = x0 + (row % 2) * 5; x < x1; x += 9 + r() * 3) {
      if (broken && r() < .3) continue;
      E(g, x, y - 3 - row * (h / 3), 5 + r() * 1.5, h / 6 + .5); F(g, mix('#b9b2a6', '#d8d2c6', r()), 1.1, '#6f675e');
    }
  }
  function lantern(g, x, y, lit, st) {
    const post = st === 'minimal' ? '#3a4150' : st === 'boho' ? '#8a5a30' : st === 'romantic' ? '#c89aa8' : '#5a4030', cap = st === 'minimal' ? '#3a4150' : st === 'boho' ? '#b7865c' : st === 'romantic' ? '#ec5f86' : '#3a3a3a';
    ln(g, [x, y, x, y - 26], post, 2);
    if (st === 'boho') { E(g, x, y - 30, 5, 6); F(g, lit ? '#ffd88a' : '#8a8a80', 1.2, '#8a5a30'); for (let i = -1; i <= 1; i++) ln(g, [x + i * 2.6, y - 35.5, x + i * 2.6, y - 24.5], '#b7865c', .7, .8); }
    else { R(g, x - 4, y - 34, 8, 9, st === 'minimal' ? 0 : 2); F(g, lit ? (st === 'romantic' ? '#ffe6ee' : '#ffe08a') : '#8a8a80', 1.2, st === 'minimal' ? '#3a4150' : '#3a2a20'); }
    if (st === 'romantic') { heart(g, x, y - 28.5, 2.2); F(g, '#ec5f86', 0); }
    PL(g, [x - 5, y - 34, x, y - 39, x + 5, y - 34]); F(g, cap, 1);
  }
  function bench(g, x, y, col, st) {
    col = ({ boho: '#c4895a', minimal: '#fbfbf9', romantic: '#ffc2d4' })[st] || col || '#b9784a'; const leg = st === 'minimal' ? '#3a4150' : dk(col, .3);
    R(g, x - 16, y - 10, 32, 3.5, 1.5); F(g, col, 1.2, st === 'minimal' ? '#3a4150' : null); R(g, x - 16, y - 18, 32, 3.5, 1.5); F(g, col, 1.2, st === 'minimal' ? '#3a4150' : null);
    ln(g, [x - 13, y - 10, x - 13, y], leg, 2.2); ln(g, [x + 13, y - 10, x + 13, y], leg, 2.2); ln(g, [x - 13, y - 18, x - 13, y - 10], leg, 2); ln(g, [x + 13, y - 18, x + 13, y - 10], leg, 2);
    if (st === 'boho') { R(g, x - 12, y - 13, 10, 4, 2); F(g, '#ecc27a', .8); R(g, x + 2, y - 13, 10, 4, 2); F(g, '#8fae86', .8); for (let i = 0; i < 6; i++) ln(g, [x - 10 + i * 4, y - 10, x - 10 + i * 4, y - 7], '#ecc27a', .8); }
    if (st === 'romantic') { heart(g, x, y - 19, 3.4); F(g, '#ec5f86', .8, '#a8466a'); }
  }
  function barrel(g, x, y, s) { R(g, x - 7 * s, y - 16 * s, 14 * s, 16 * s, 4 * s); VG(g, '#b9784a', y - 16 * s, y, 1.3); ln(g, [x - 7 * s, y - 12 * s, x + 7 * s, y - 12 * s], '#5a5a5a', 1.4); ln(g, [x - 7 * s, y - 4 * s, x + 7 * s, y - 4 * s], '#5a5a5a', 1.4); }
  function crate(g, x, y, s, col) { R(g, x - 9 * s, y - 14 * s, 18 * s, 14 * s, 1.5); F(g, col || '#d39a5e', 1.3); ln(g, [x - 9 * s, y - 14 * s, x + 9 * s, y], dk(col || '#d39a5e', .35), 1.2); ln(g, [x - 9 * s, y - 7 * s, x + 9 * s, y - 7 * s], dk(col || '#d39a5e', .35), 1); }
  function junk(g, x, y, seed) {
    const r = srnd(seed);
    for (let i = 0; i < 4; i++) { g.save(); g.translate(x + (r() - .5) * 26, y - 3 - r() * 4); g.rotate((r() - .5) * 1.4); R(g, -12, -2, 24, 4, 1); F(g, '#9c8a76', 1.1); g.restore(); }
    crate(g, x + 10, y, .8, '#9a8a78'); E(g, x - 12, y - 4, 6, 4); F(g, '#7f7a70', 1.1); weeds(g, x - 18, y, 36, seed + 1);
  }
  function sheep(g, x, y, s, flip) {
    g.save(); g.translate(x, y); g.scale(flip ? -s : s, s);
    ln(g, [-5, -4, -5, 2], '#3a2a20', 2); ln(g, [5, -4, 5, 2], '#3a2a20', 2);
    const p = []; for (let i = 0; i < 12; i++) { const a = i * TAU / 12, q = i % 2 ? 9 : 10.5; p.push(Math.cos(a) * q * 1.2, -9 + Math.sin(a) * q * .75); } SM(g, p); F(g, '#fbf7ee', 1.2, '#8a7a6a');
    E(g, -12, -10, 4.5, 3.6, -.3); F(g, '#3a2e2a', 1); E(g, -13.5, -13, 2.4, 1.2, -.6); F(g, '#3a2e2a', 0); dot(g, -13, -10.6, .7, '#fff');
    g.restore();
  }
  function cat(g, x, y, s, tail) { // Muri: a round ginger cat, sitting
    g.save(); g.translate(x, y); g.scale(s, s);
    g.beginPath(); g.moveTo(6, -2); g.quadraticCurveTo(16 + tail * 2, -4, 13 + tail * 3, -14); g.lineWidth = 3; g.strokeStyle = '#d9822f'; g.lineCap = 'round'; g.stroke();
    E(g, 0, -7, 8, 8); F(g, '#f0a24a', 1.2, '#7a4318'); E(g, 0, -17, 7, 6); F(g, '#f0a24a', 1.2, '#7a4318');
    PL(g, [-6, -20, -5, -26, -1, -22]); F(g, '#f0a24a', 1.1, '#7a4318'); PL(g, [6, -20, 5, -26, 1, -22]); F(g, '#f0a24a', 1.1, '#7a4318');
    E(g, 0, -5, 4.5, 4); F(g, '#fff2df', 0); dot(g, -2.5, -17.5, .9, '#2b1a12'); dot(g, 2.5, -17.5, .9, '#2b1a12'); dot(g, 0, -15.6, .7, '#e27a7a');
    ln(g, [-2, -11, -2, -14], '#c9782a', 1); ln(g, [2, -11, 2, -14], '#c9782a', 1);
    g.restore();
  }
  function bird(g, x, y, s, flap) { g.beginPath(); g.moveTo(x - 5 * s, y - flap * 2 * s); g.quadraticCurveTo(x - 2 * s, y - 1 * s, x, y); g.quadraticCurveTo(x + 2 * s, y - 1 * s, x + 5 * s, y - flap * 2 * s); g.lineWidth = 1.3; g.strokeStyle = '#4a4a5a'; g.lineCap = 'round'; g.stroke(); }
  function window_(g, x, y, w, h, st) { // st: 0 boarded, 1 fixed, 2 lit
    R(g, x - 2, y - 2, w + 4, h + 4, 2); F(g, st ? '#fff8ec' : '#9a8f82', 1.3);
    R(g, x, y, w, h, 1.5);
    if (st === 2) { const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#fff2b0'); gr.addColorStop(1, '#ffbf5a'); g.fillStyle = gr; g.fill(); }
    else F(g, st ? '#a8d4ea' : '#4a4038', 0);
    if (st) { ln(g, [x + w / 2, y, x + w / 2, y + h], '#fff8ec', 1.6); ln(g, [x, y + h / 2, x + w, y + h / 2], '#fff8ec', 1.6); if (st === 2) { PL(g, [x, y, x + w * .3, y, x, y + h * .7]); F(g, '#f7a8b8', 0); PL(g, [x + w, y, x + w * .7, y, x + w, y + h * .7]); F(g, '#f7a8b8', 0); } else { ln(g, [x + 2, y + h - 3, x + w * .4, y + 3], '#ffffff', 1.2, .6); } }
    else { g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(.5); R(g, -w * .75, -2, w * 1.5, 4, 1); F(g, '#a8906e', 1); g.rotate(-1); R(g, -w * .75, -2, w * 1.5, 4, 1); F(g, '#b89e7a', 1); g.restore(); }
  }
  function flowerBox(g, x, y, w) { R(g, x - 2, y, w + 4, 5, 1.5); F(g, '#c8693c', 1.2); flowers(g, x, y, w, x | 0, true); }
  function chimney(g, x, y, ok) {
    if (ok) { R(g, x - 6, y - 22, 12, 24, 1); F(g, '#d9785a', 1.3); R(g, x - 8, y - 25, 16, 4, 1); F(g, '#b8573c', 1.3); for (let i = 0; i < 3; i++) ln(g, [x - 6, y - 16 + i * 6, x + 6, y - 16 + i * 6], '#b8573c', .8); }
    else { PL(g, [x - 6, y + 2, x - 6, y - 10, x - 2, y - 13, x + 1, y - 8, x + 6, y - 12, x + 6, y + 2]); F(g, '#a89a8c', 1.3); dot(g, x + 10, y - 2, 2, '#a89a8c'); }
  }
  function thatch(g, x0, x1, y, h, broken, col) { // thatched roof (long side), Saaremaa style
    col = col || '#c99a55';
    g.beginPath(); g.moveTo(x0 - 12, y + 3); g.lineTo(x0 + 14, y - h); g.quadraticCurveTo((x0 + x1) / 2, y - h - 4, x1 - 14, y - h); g.lineTo(x1 + 12, y + 3); g.quadraticCurveTo((x0 + x1) / 2, y + 7, x0 - 12, y + 3); g.closePath();
    VG(g, broken ? '#9a8a6a' : col, y - h, y, 1.6);
    g.save(); g.clip(); const r = srnd(x0 | 0);
    for (let i = 0; i < (x1 - x0 + 24) * .9; i++) { const xx = x0 - 12 + r() * (x1 - x0 + 24), yy = y - h + r() * (h + 4); ln(g, [xx, yy, xx + 1, yy + 4 + r() * 4], dk(broken ? '#9a8a6a' : col, .25), .8, .6); }
    if (broken) { for (const [dx, dy, rx] of [[.25, .45, 9], [.62, .3, 7], [.8, .62, 6]]) { E(g, x0 + (x1 - x0) * dx, y - h + h * dy, rx, rx * .6, .2); F(g, '#4a3428', 1, '#3a2418'); } }
    g.restore();
    R(g, x0 + 10, y - h - 4, x1 - x0 - 20, 6, 3); F(g, broken ? '#7a6a52' : dk(col, .25), 1.3);
  }
  function wallBoards(g, x, y, w, h, col, painted) {
    R(g, x, y, w, h, 1); VG(g, painted ? col : '#a99f92', y, y + h, 1.6);
    g.save(); R(g, x, y, w, h, 1); g.clip();
    for (let xx = x + 6; xx < x + w; xx += 7) ln(g, [xx, y, xx, y + h], dk(painted ? col : '#a99f92', .25), .9, .6);
    if (!painted) { const r = srnd(w | 0); for (let i = 0; i < 6; i++) { E(g, x + r() * w, y + r() * h, 3 + r() * 5, 2 + r() * 2); g.fillStyle = 'rgba(80,70,60,.25)'; g.fill(); } }
    g.restore();
    R(g, x - 2, y + h - 5, w + 4, 6, 1); F(g, '#bdb4a6', 1.2);
  }

  // ---------- areas ----------
  // each area: still(g, f, L, R) draws the cached layer; anim(g, f, t, L, R) draws per frame
  const S = {};
  // the young heroine's seaside café-bakery: pastel walls, mint scalloped roof, big arched windows, parasols
  function awning(g, x, w, y, h, c1, c2, st) {
    if (st && A.STYLED) { A.STYLED.awn(g, x, w, y, h, st, { a: c1, b: c2 }); return; }
    const n = Math.max(3, Math.round(w / 10)), sw = w / n;
    for (let i = 0; i < n; i++) { g.beginPath(); g.moveTo(x + i * sw, y); g.lineTo(x + (i + 1) * sw, y); g.lineTo(x + (i + 1) * sw, y + h); g.arc(x + i * sw + sw / 2, y + h, sw / 2, 0, PI); g.closePath(); F(g, i % 2 ? c2 : c1, 1.1, dk(c1, .5)); }
    R(g, x - 2, y - 3, w + 4, 4, 2); F(g, dk(c1, .15), 1.1);
  }
  function parasol(g, x, y, col, st) {
    if (st && A.STYLED) { const P = { a: col, b: '#ffffff' }, S2 = A.STYLED; S2.umbrella(g, x, y, st, P); S2.table(g, x, y, P, st); S2.chair(g, x - 17, y, st, P, false); S2.chair(g, x + 17, y, st, P, true); return; }
    ln(g, [x, y, x, y - 30], '#8a6a8a', 1.6);
    g.beginPath(); g.moveTo(x - 20, y - 26); g.quadraticCurveTo(x, y - 44, x + 20, y - 26); g.closePath(); F(g, col, 1.3, dk(col, .5));
    g.save(); g.clip(); for (let i = -2; i <= 2; i += 2) { g.beginPath(); g.moveTo(x, y - 42); g.lineTo(x + i * 6 - 3, y - 24); g.lineTo(x + i * 6 + 3, y - 24); g.closePath(); g.fillStyle = '#ffffff'; g.fill(); } g.restore();
    for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(x - 16 + i * 8, y - 26, 4, 0, PI); F(g, i % 2 ? '#ffffff' : col, .9, dk(col, .5)); }
    R(g, x - 11, y - 12, 22, 3, 1.5); F(g, '#ffffff', 1.1, '#8a6a8a'); ln(g, [x - 8, y - 9, x - 8, y], '#8a6a8a', 1.4); ln(g, [x + 8, y - 9, x + 8, y], '#8a6a8a', 1.4);
    for (const s of [-1, 1]) { R(g, x + s * 17 - 4, y - 10, 8, 2.5, 1); F(g, '#5fd0b0', .9); ln(g, [x + s * 17 - 3, y - 8, x + s * 17 - 3, y], '#5a5a7a', 1.1); ln(g, [x + s * 17 + 3, y - 8, x + s * 17 + 3, y], '#5a5a7a', 1.1); }
    dot(g, x - 4, y - 14, 2, '#ffffff'); dot(g, x + 4, y - 14, 2.2, '#ffb0c8');
  }
  function plant(g, x, y, s) {
    R(g, x - 5 * s, y - 9 * s, 10 * s, 9 * s, 2 * s); F(g, '#ffffff', 1.1, '#8a6a8a');
    for (const [dx, dy, r] of [[-4, -16, 5], [3, -19, 6], [0, -24, 5], [5, -13, 4]]) { E(g, x + dx * s, y + dy * s, r * s, r * .85 * s); F(g, '#46c86a', 1, '#2a8a4a'); }
    dot(g, x - 2 * s, y - 22 * s, 1.4 * s, '#ffd23f'); dot(g, x + 4 * s, y - 17 * s, 1.4 * s, '#ff8fb8');
  }
  S.pagariari = {
    glows: f => [].concat(f.has('aknad') ? [[146, 158, 22], [254, 158, 22], [200, 162, 14]] : [], f.has('laternad') ? [[108, 170, 12], [160, 130, 7], [240, 130, 7]] : []),
    still(g, f, L, Rr) {
      sky(g, L, Rr, '#5ec8ff', '#ffe9f0', 128); sun(g, 330, 38, 13);
      cloud(g, 70, 36, 1.1, .9);
      seaBand(g, L, Rr, 116, 150, '#7fe0ff', '#1fb0e0');
      PL(g, [L, 118, 20, 110, 60, 106, 100, 112, 120, 118]); g.closePath(); F(g, '#7fd0b0', 0);
      hill(g, L, Rr, [L, 148, 100, 143, 200, 147, 300, 141, Rr, 146], '#ffe2a8', 220);
      hill(g, L, Rr, [L, 160, 100, 154, 200, 158, 300, 152, Rr, 158], '#8fe07a', 220);
      g.fillStyle = 'rgba(255,255,220,.25)'; g.fillRect(L, 192, Rr - L, 30);
      const clean = f.has('koristus');
      g.beginPath(); g.moveTo(192, 188); g.quadraticCurveTo(170, 206, 150, 222); g.lineTo(198, 222); g.quadraticCurveTo(208, 205, 216, 188); g.closePath(); F(g, clean ? '#ffe9c8' : '#d8c8a8', 0);
      if (clean) { const r = srnd(2); for (let i = 0; i < 9; i++) { E(g, 176 + r() * 30 - i * 2.5, 193 + i * 3.4, 4.2, 2.1); F(g, i % 2 ? '#ffd0dc' : '#d6f2ff', .8, '#b8a8c8'); } }
      tree(g, 46, 182, 1.1, 'round', { col: '#5fd07a', blossom: f.has('lillekastid') });
      tree(g, 358, 184, 1, 'round', { col: '#6fd88a', apples: f.has('lillekastid') });
      const x0 = 118, x1 = 282, yb = 188, wh = 62, painted = f.has('seinad');
      R(g, x0, yb - wh, x1 - x0, wh, 3); VG(g, painted ? '#ffd0e0' : '#b9b4b0', yb - wh, yb, 1.6);
      if (!painted) { g.save(); R(g, x0, yb - wh, x1 - x0, wh, 3); g.clip(); for (let xx = x0 + 6; xx < x1; xx += 7) ln(g, [xx, yb - wh, xx, yb], '#8f8a86', .9, .5); const r = srnd(9); for (let i = 0; i < 6; i++) { E(g, x0 + r() * (x1 - x0), yb - r() * wh, 4 + r() * 5, 2 + r() * 2); g.fillStyle = 'rgba(80,70,60,.22)'; g.fill(); } g.restore(); }
      else { for (const xx of [x0, x1 - 5]) { R(g, xx, yb - wh, 5, wh, 1); F(g, '#ffffff', 1); } R(g, x0, yb - 12, x1 - x0, 12, 2); F(g, '#ffffff', 1.2); for (let xx = x0 + 4; xx < x1 - 4; xx += 8) { R(g, xx, yb - 10, 6, 8, 1); F(g, '#bfefff', .7); } }
      chimney(g, 252, yb - wh - 26, f.has('korsten'));
      if (f.has('katus')) {
        g.beginPath(); g.moveTo(x0 - 12, yb - wh + 2); g.lineTo(x0 + 22, yb - wh - 38); g.quadraticCurveTo(200, yb - wh - 44, x1 - 22, yb - wh - 38); g.lineTo(x1 + 12, yb - wh + 2); g.closePath(); VG(g, '#3fd0b0', yb - wh - 44, yb - wh, 1.6);
        g.save(); g.clip(); for (let row = 0; row < 4; row++) for (let xx = x0 - 16 + (row % 2) * 7; xx < x1 + 16; xx += 14) { g.beginPath(); g.arc(xx, yb - wh - 30 + row * 9, 7, 0, PI); g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,.45)'; g.stroke(); } g.restore();
        for (let xx = x0 - 10; xx < x1 + 10; xx += 8) { g.beginPath(); g.arc(xx + 4, yb - wh + 2, 4, 0, PI); F(g, '#ffffff', .8, '#8ab8c8'); }
      } else {
        g.beginPath(); g.moveTo(x0 - 10, yb - wh + 4); g.lineTo(x0 + 22, yb - wh - 34); g.quadraticCurveTo(200, yb - wh - 28, x1 - 22, yb - wh - 36); g.lineTo(x1 + 10, yb - wh + 4); g.closePath(); VG(g, '#9a948e', yb - wh - 36, yb - wh, 1.6);
        for (const [dx, dy, rx] of [[.3, -18, 9], [.62, -24, 7], [.8, -10, 6]]) { E(g, x0 + (x1 - x0) * dx, yb - wh + dy, rx, rx * .6, .2); F(g, '#4a3a48', 1); }
      }
      const ws = f.has('aknad') ? (f.has('laternad') ? 2 : 1) : 0;
      for (const wx of [130, 238]) {
        if (ws) {
          g.beginPath(); g.moveTo(wx, yb - 16); g.lineTo(wx, yb - 40); g.arc(wx + 16, yb - 40, 16, PI, 0); g.lineTo(wx + 32, yb - 16); g.closePath(); F(g, '#ffffff', 1.4);
          g.beginPath(); g.moveTo(wx + 3, yb - 17); g.lineTo(wx + 3, yb - 40); g.arc(wx + 16, yb - 40, 13, PI, 0); g.lineTo(wx + 29, yb - 17); g.closePath();
          const gr = g.createLinearGradient(0, yb - 54, 0, yb - 17); gr.addColorStop(0, ws === 2 ? '#fff4b8' : '#c8f0ff'); gr.addColorStop(1, ws === 2 ? '#ffc070' : '#8fd8f8'); g.fillStyle = gr; g.fill();
          R(g, wx + 5, yb - 26, 22, 3, 1); F(g, '#ffffff', .8); dot(g, wx + 10, yb - 29, 3, '#ff9ab8'); dot(g, wx + 17, yb - 29.5, 3.4, '#ffcf6a'); dot(g, wx + 23, yb - 29, 2.6, '#c79aff');
          ln(g, [wx + 8, yb - 48, wx + 12, yb - 52], '#ffffff', 1.6, .8);
          if (painted) awning(g, wx - 4, 40, yb - 60, 6, '#ff7a9a', '#ffffff', sty('seinad'));
        } else { R(g, wx, yb - 50, 32, 34, 2); F(g, '#5a5058', 1.2); g.save(); g.translate(wx + 16, yb - 33); g.rotate(.45); R(g, -22, -2.5, 44, 5, 1); F(g, '#b8a48a', 1); g.rotate(-.9); R(g, -22, -2.5, 44, 5, 1); F(g, '#c8b49a', 1); g.restore(); }
      }
      if (f.has('lillekastid')) { const sk = sty('lillekastid'); for (const wx of [128, 236]) { R(g, wx, yb - 16, 36, 6, 2); F(g, ({ boho: '#d8a868', minimal: '#fbfbf9', romantic: '#ffd6e2' })[sk] || '#ffffff', 1.1, sk === 'minimal' ? '#3a4150' : '#8a6a8a'); flowers(g, wx + 2, yb - 16, 32, wx | 0, true, sk); } plant(g, 180, yb, 1); plant(g, 222, yb, 1); }
      g.beginPath(); g.moveTo(186, yb); g.lineTo(186, yb - 38); g.arc(200, yb - 38, 14, PI, 0); g.lineTo(214, yb); g.closePath(); F(g, '#ffffff', 1.3);
      g.beginPath(); g.moveTo(189, yb); g.lineTo(189, yb - 37); g.arc(200, yb - 37, 11, PI, 0); g.lineTo(211, yb); g.closePath();
      if (f.has('uks')) { F(g, '#3fd0b0', 1.2); R(g, 193, yb - 44, 14, 22, 6); F(g, '#d8f6ff', 1); ln(g, [195, yb - 30, 199, yb - 40], '#ffffff', 1.4, .8); dot(g, 208, yb - 18, 1.6, '#ffd23f'); }
      else { F(g, '#6a6068', 1.2); g.save(); g.translate(200, yb - 20); g.rotate(-.35); R(g, -12, -2, 24, 4, 1); F(g, '#a8988a', 1); g.restore(); }
      R(g, 182, yb, 36, 4, 1.5); F(g, '#e8e4f0', 1.1);
      if (f.has('silt')) {
        R(g, 160, yb - wh - 4, 80, 17, 8.5); F(g, '#ffffff', 1.6, '#c03a7a'); R(g, 163, yb - wh - 1.5, 74, 12, 6); F(g, '#ff5a9a', 0);
        g.fillStyle = '#ffffff'; g.font = '900 10px ui-rounded,system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('KOHVIK', 206, yb - wh + 4.5);
        g.drawImage(A.item('bread', 7, 48), 165, yb - wh - 4, 15, 15);
        PL(g, [166, yb, 172, yb - 22, 178, yb]); F(g, '#8a6a8a', 1); R(g, 163, yb - 22, 18, 15, 2); F(g, '#3a3a4a', 1.2, '#8a6a8a'); ln(g, [166, yb - 18, 177, yb - 18], '#ffffff', 1, .8); ln(g, [166, yb - 14, 174, yb - 14], '#ff9ab8', 1, .8); ln(g, [166, yb - 10.5, 176, yb - 10.5], '#9fe8ff', 1, .8);
      }
      if (f.has('pink')) { parasol(g, 318, 200, '#ff6b8a', sty('pink')); parasol(g, 92, 202, '#3db8ff', sty('pink')); }
      if (f.has('laternad')) { ln(g, [x0 - 6, yb - 68, 160, yb - 58, 200, yb - 62, 240, yb - 58, x1 + 6, yb - 68], '#6a5a7a', .8); lantern(g, 108, 204, true, sty('laternad')); }
      if (!clean) { junk(g, 96, 198, 3); junk(g, 300, 202, 8); weeds(g, x0 - 4, yb + 2, 40, 5); weeds(g, x1 - 30, yb + 2, 36, 6); }
      else { flowers(g, 70, 206, 30, 11); flowers(g, 330, 208, 40, 12); bush(g, 130, 194, .7, '#5fd07a', f.has('lillekastid') ? '#ff8fb8' : null); }
      grass(g, L, Rr, 196, 220, 9, '#46b85a');
    },
    anim(g, f, t, L, Rr) {
      cloud(g, ((t * 4 + 150) % (Rr - L + 80)) + L - 40, 24, .9, .9); cloud(g, ((t * 2.5 + 20) % (Rr - L + 80)) + L - 40, 52, .7, .7);
      const sx = ((t * 6 + 60) % (Rr - L + 60)) + L - 30; g.save(); g.translate(sx, 128 + Math.sin(t * 2) * .8);
      PL(g, [0, 0, 0, -12, 7, 0]); F(g, '#ffffff', .8, '#6a8aa8'); PL(g, [-1, -1, -1, -9, -6, -1]); F(g, '#ff8fb8', .8, '#6a8aa8'); R(g, -8, 0, 16, 3, 1.5); F(g, '#ff6b6b', .8); g.restore();
      for (let i = 0; i < 2; i++) { const bx = ((t * 12 + i * 160) % (Rr - L + 60)) + L - 30; bird(g, bx, 60 + i * 12 + Math.sin(t * 2 + i) * 3, 1, Math.sin(t * 9 + i * 2)); }
      seaSparkle(g, L, Rr, 120, 146, t);
      if (f.has('korsten')) smoke(g, 252, 74, t);
      if (f.has('laternad')) lights(g, [116, 120, 140, 126, 160, 130, 180, 128, 200, 126, 220, 128, 240, 130, 262, 126, 284, 120], t);
      if (f.has('muri')) cat(g, 234, 194, 1, Math.sin(t * 2));
    }
  };
  S.aed = {
    still(g, f, L, Rr) {
      sky(g, L, Rr, '#6fd0ff', '#fff2e0', 140); sun(g, 70, 36, 12);
      hill(g, L, Rr, [L, 118, 120, 104, 240, 112, 340, 100, Rr, 110], '#8fdc8a', 220);
      for (let i = 0; i < 5; i++) tree(g, 220 + i * 26, 118 + (i % 2) * 3, .55, 'pine');
      hill(g, L, Rr, [L, 140, 140, 134, 260, 138, Rr, 132], '#98e27a', 220);
      // back of the bakery
      wallBoards(g, 312, 96, 80, 42, '#ffc0d6', true); thatch(g, 312, 392, 96, 26, false, '#4fd4b4');
      const wd = f.has('umbrohi');
      tree(g, 64, 170, 1.25, 'round', f.has('ounapuu') ? { apples: true } : { bare: true });
      fence(g, L, Rr, 152, 16, !f.has('aed'), '#f4efe6', 6, sty('aed'));
      // beds
      for (let i = 0; i < 3; i++) {
        const bx = 130 + i * 54; R(g, bx, 168, 44, 14, 3); F(g, f.has('peenrad') ? '#7a4a30' : '#8a7a62', 1.4);
        if (f.has('peenrad')) { for (let k = 0; k < 4; k++) { const cx = bx + 6 + k * 10.5; if (i === 1) { PL(g, [cx - 2, 170, cx, 160, cx + 2, 170]); F(g, '#f08a3a', 0); ln(g, [cx, 160, cx - 2, 154], '#5fb35a', 1.4); ln(g, [cx, 160, cx + 2, 154], '#5fb35a', 1.4); } else { E(g, cx, 167, 5, 4); F(g, i ? '#8fd17a' : '#a8dca0', 1, '#3f7a3a'); ln(g, [cx - 3, 167, cx + 3, 167], '#5c9a50', .8); } } }
        else weeds(g, bx, 170, 44, 20 + i);
      }
      if (f.has('kaev')) { // well
        R(g, 286, 160, 34, 20, 3); F(g, '#bdb4a6', 1.4); stoneWall(g, 288, 320, 180, 18, 2);
        ln(g, [290, 160, 290, 128], '#8a5a3a', 2.4); ln(g, [316, 160, 316, 128], '#8a5a3a', 2.4); PL(g, [282, 132, 303, 116, 324, 132]); F(g, '#c95a3c', 1.4);
        ln(g, [303, 132, 303, 146], '#5a4030', 1); R(g, 299, 146, 8, 7, 1); F(g, '#7fb3e0', 1.1);
      } else { E(g, 303, 176, 16, 5); F(g, '#9a9284', 1.2); weeds(g, 288, 178, 30, 31); }
      if (f.has('kasvuhoone')) {
        PL(g, [338, 182, 338, 150, 360, 136, 382, 150, 382, 182]); g.fillStyle = 'rgba(210,240,250,.7)'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = '#f4efe6'; g.stroke();
        ln(g, [360, 136, 360, 182], '#f4efe6', 1.4); ln(g, [338, 166, 382, 166], '#f4efe6', 1.2); bush(g, 350, 180, .4, '#5fb35a', '#e2463c'); bush(g, 371, 180, .4, '#5fb35a', '#f6c33b');
      }
      if (f.has('mesitaru')) { R(g, 106, 170, 16, 14, 1); F(g, '#7fb3e0', 1.2); PL(g, [104, 171, 114, 163, 124, 171]); F(g, '#d9785a', 1.2); R(g, 112, 179, 4, 2, .5); F(g, '#3a2414', 0); }
      if (f.has('hirmutis')) { // scarecrow
        ln(g, [262, 184, 262, 146], '#8a5a3a', 2); ln(g, [250, 158, 274, 158], '#8a5a3a', 2); R(g, 254, 156, 16, 16, 3); F(g, '#5f86c8', 1.2);
        E(g, 262, 148, 6, 6); F(g, '#f2deb0', 1.2); PL(g, [253, 145, 262, 138, 271, 145]); F(g, '#c9a24a', 1.2); dot(g, 260, 148, .8, '#3a2a20'); dot(g, 264, 148, .8, '#3a2a20');
      }
      if (f.has('lilled')) { flowers(g, 18, 196, 90, 41, true, sty('lilled')); flowers(g, 230, 200, 160, 42, true, sty('lilled')); bush(g, 120, 200, .7, '#6aa84f', '#f7a8c8'); }
      if (!wd) { weeds(g, 10, 196, 120, 51); weeds(g, 200, 200, 190, 52); junk(g, 236, 204, 9); }
      grass(g, L, Rr, 188, 220, 13);
    },
    anim(g, f, t, L, Rr) {
      cloud(g, ((t * 3 + 200) % (Rr - L + 80)) + L - 40, 30, 1, .8); cloud(g, ((t * 2 + 40) % (Rr - L + 80)) + L - 40, 58, .7, .6);
      bird(g, ((t * 10) % (Rr - L + 60)) + L - 30, 48 + Math.sin(t * 2) * 3, 1, Math.sin(t * 9));
      if (f.has('kiik')) { g.save(); g.translate(68, 128); g.rotate(Math.sin(t * 1.6) * .25); ln(g, [-8, 0, -8, 40], '#8a7a6a', 1); ln(g, [8, 0, 8, 40], '#8a7a6a', 1); R(g, -11, 39, 22, 4, 1.5); F(g, '#c95a3c', 1); g.restore(); }
      if (f.has('mesitaru')) for (let i = 0; i < 3; i++) { const a = t * 2 + i * 2.1; dot(g, 114 + Math.cos(a) * 16, 160 + Math.sin(a * 1.7) * 7, 1.6, '#f6c33b'); dot(g, 114 + Math.cos(a) * 16 - .5, 160 + Math.sin(a * 1.7) * 7 - 1.5, 1, 'rgba(255,255,255,.8)'); }
      if (f.has('lilled')) for (let i = 0; i < 4; i++) { const x = 40 + i * 90, sw = Math.sin(t * 2 + i) * 2; ln(g, [x, 206, x + sw, 194], '#4f8f3f', 1.2); for (let k = 0; k < 5; k++) { const a = k * 1.2566; dot(g, x + sw + Math.cos(a) * 2.2, 194 + Math.sin(a) * 2.2, 1.8, ['#f58aa0', '#fff', '#f7d24c', '#5b86e0'][i]); } dot(g, x + sw, 194, 1.2, '#f6c33b'); }
      if (f.has('kaev')) { /* tiny bucket sway */ }
    }
  };
  S.sadam = {
    glows: f => f.has('laternad') ? [[144, 132, 12], [246, 132, 12], [340, 132, 12]] : [],
    still(g, f, L, Rr) {
      sky(g, L, Rr, '#55c2ff', '#ffeef4', 120); sun(g, 300, 34, 12); cloud(g, 120, 38, 1.1, .7);
      PL(g, [Rr, 104, 340, 98, 300, 102, 270, 110, Rr, 110]); g.closePath(); F(g, '#8fb8a0', 0);
      seaBand(g, L, Rr, 106, 220, '#7fe0ff', '#1a9fd8');
      // shore on the left
      hill(g, L, 150, [L, 140, 40, 138, 90, 150, 130, 178, 150, 220], '#e9d3a0', 220, 1.4);
      g.beginPath(); g.moveTo(L, 138); g.lineTo(L, 220); g.lineTo(60, 220); g.quadraticCurveTo(50, 170, 30, 150); g.quadraticCurveTo(10, 140, L, 138); g.closePath(); F(g, '#8fe07a', 0);
      // pier
      const ok = f.has('sild');
      for (let i = 0; i < 7; i++) { const x = 110 + i * 34; R(g, x - 2.5, 170, 5, 40, 1); F(g, '#7a5232', 1.2); }
      for (let x = 100; x < 340; x += 9) { if (!ok && (x * 7) % 5 === 0) continue; R(g, x, 164, 8, 7, 1); F(g, ok ? '#c98a55' : '#9c8a76', 1); }
      if (!ok) { g.save(); g.translate(250, 196); g.rotate(.3); R(g, -12, -2, 24, 4, 1); F(g, '#9c8a76', 1); g.restore(); }
      // shed
      const sh = f.has('kuur');
      wallBoards(g, 24, 104, 60, 40, '#c94a3c', sh);
      g.beginPath(); g.moveTo(18, 106); g.lineTo(54, 82); g.lineTo(90, 106); g.closePath(); F(g, sh ? '#5a5a66' : '#7a7068', 1.4);
      if (!sh) { E(g, 46, 96, 7, 4); F(g, '#3a3030', 1); }
      R(g, 44, 120, 14, 24, 1); F(g, sh ? '#fff8ec' : '#6a5a4a', 1.2);
      if (f.has('vorgud')) { ln(g, [96, 156, 96, 124], '#7a5232', 2); ln(g, [136, 158, 136, 126], '#7a5232', 2); g.beginPath(); g.moveTo(96, 126); g.quadraticCurveTo(116, 150, 136, 128); g.lineTo(136, 146); g.quadraticCurveTo(116, 160, 96, 146); g.closePath(); g.fillStyle = 'rgba(214,190,150,.6)'; g.fill(); g.save(); g.clip(); for (let x = 90; x < 140; x += 5) { ln(g, [x, 120, x + 14, 160], '#a07a50', .8); ln(g, [x + 14, 120, x, 160], '#a07a50', .8); } g.restore(); for (const x of [104, 116, 128]) dot(g, x, 141 + Math.sin(x) * 2, 2.6, x === 116 ? '#e2574c' : '#ffcf55'); }
      if (f.has('tynnid')) { barrel(g, 300, 165, 1); barrel(g, 316, 165, 1); crate(g, 334, 165, 1); crate(g, 66, 156, .9, '#c98a55'); }
      if (f.has('kiosk')) {
        R(g, 56, 132, 34, 22, 2); F(g, '#fff6e6', 1.3); R(g, 54, 130, 38, 4, 1); F(g, '#c94a3c', 1.2);
        for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(54 + i * 9.5, 120); g.lineTo(63.5 + i * 9.5, 120); g.lineTo(63.5 + i * 9.5, 128); g.arc(58.75 + i * 9.5, 128, 4.75, 0, PI); g.closePath(); F(g, i % 2 ? '#fff6e6' : '#e2574c', 1); }
        g.drawImage(A.item('kala', 4, 40), 60, 136, 12, 12); g.drawImage(A.item('tee', 3, 40), 74, 136, 12, 12);
      }
      if (!f.has('koristus')) { junk(g, 30, 160, 21); junk(g, 120, 162, 22); E(g, 210, 205, 14, 4); F(g, '#6a6a5a', 1); }
      else { flowers(g, 6, 168, 40, 23); E(g, 40, 175, 6, 3); F(g, '#c9c2b6', 1); }
      if (f.has('laternad')) { for (const x of [144, 246, 340]) lantern(g, x, 166, true, sty('laternad')); }
    },
    anim(g, f, t, L, Rr) {
      cloud(g, ((t * 3 + 260) % (Rr - L + 80)) + L - 40, 28, .9, .8);
      for (let i = 0; i < 3; i++) { const bx = ((t * 11 + i * 130) % (Rr - L + 60)) + L - 30; bird(g, bx, 54 + i * 9 + Math.sin(t * 2 + i) * 3, 1.1, Math.sin(t * 8 + i * 2)); }
      // waves
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.4; g.lineCap = 'round';
      for (let row = 0; row < 5; row++) { const y = 124 + row * 20, off = (t * (8 + row * 3) + row * 37) % 40; for (let x = L - 40 + off; x < Rr; x += 40) { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 5, y - 3, x + 10, y); g.stroke(); } }
      seaSparkle(g, 150, Rr, 110, 150, t);
      // boat
      const bob = Math.sin(t * 1.8) * 1.6, rk = Math.sin(t * 1.3) * .04;
      if (f.has('paat')) {
        g.save(); g.translate(210, 186 + bob); g.rotate(rk);
        ln(g, [0, -10, 0, -52], '#7a5232', 2); PL(g, [2, -50, 2, -14, 30, -14]); F(g, '#fff8ec', 1.2); PL(g, [-2, -46, -2, -16, -20, -16]); F(g, '#f2b0bd', 1.2);
        g.beginPath(); g.moveTo(-36, -12); g.lineTo(36, -12); g.quadraticCurveTo(30, 6, 18, 6); g.lineTo(-22, 6); g.quadraticCurveTo(-34, 4, -36, -12); g.closePath(); F(g, '#e2574c', 1.5);
        R(g, -35, -13, 70, 4, 1); F(g, '#fff8ec', 1.1); g.fillStyle = '#fff8ec'; g.font = '700 6px system-ui'; g.textAlign = 'center'; g.fillText('MAALI', 0, 0);
        g.restore();
      } else {
        g.save(); g.translate(76, 176); g.rotate(.25);
        g.beginPath(); g.moveTo(-26, -8); g.lineTo(26, -8); g.quadraticCurveTo(22, 6, 12, 6); g.lineTo(-16, 6); g.quadraticCurveTo(-24, 4, -26, -8); g.closePath(); F(g, '#8a7a6a', 1.4); E(g, 4, -2, 5, 3); F(g, '#3a3030', 1); g.restore();
      }
      if (f.has('lipud')) { const pts = []; for (let i = 0; i <= 10; i++) { const x = 96 + i * 24, y = 112 + Math.sin(i / 10 * PI) * 10; pts.push([x, y]); } ln(g, [].concat(...pts), '#5a4030', .8); for (let i = 0; i < 10; i++) { const [x, y] = pts[i], sw = Math.sin(t * 3 + i) * 2; PL(g, [x + 4, y + 1, x + 16, y + 2, x + 10 + sw, y + 12]); F(g, ['#e2574c', '#f7d24c', '#5b86e0', '#fff6e6', '#6dbb5a'][i % 5], .8); } }
      if (f.has('laternad')) for (const x of [144, 246, 340]) glow(g, x, 136, 12, .35 + Math.sin(t * 3 + x) * .08);
    }
  };
  S.tuuleveski = {
    glows: f => f.has('veskimaja') ? [[205, 91, 12]] : [],
    still(g, f, L, Rr) {
      sky(g, L, Rr, '#62caff', '#fff0e6', 150); sun(g, 60, 40, 12); cloud(g, 300, 30, 1, .7);
      hill(g, L, Rr, [L, 130, 100, 120, 220, 126, 320, 118, Rr, 126], '#a8e88a', 220);
      for (let i = 0; i < 6; i++) tree(g, L + 14 + i * 22, 132 - (i % 2) * 3, .5, 'juniper');
      hill(g, L, Rr, [L, 176, 80, 160, 170, 122, 240, 124, 330, 162, Rr, 172], '#8fe07a', 220, 1.2);
      // path
      if (f.has('rada')) { g.beginPath(); g.moveTo(130, 220); g.quadraticCurveTo(170, 180, 196, 146); g.lineTo(212, 146); g.quadraticCurveTo(196, 184, 172, 220); g.closePath(); F(g, '#e9d3a8', 0); }
      else weeds(g, 150, 190, 60, 61);
      // stone wall (Saaremaa kiviaed)
      stoneWall(g, L, 140, 196, 15, 7, !f.has('kivimyyr')); stoneWall(g, 260, Rr, 198, 15, 8, !f.has('kivimyyr'));
      // post mill
      const mx = 205, my = 126, ok = f.has('veskimaja');
      PL(g, [mx - 18, my + 22, mx, my - 2, mx + 18, my + 22]); g.lineWidth = 3; g.strokeStyle = '#6b4a30'; g.stroke(); R(g, mx - 3, my - 4, 6, 28, 1); F(g, '#7a5232', 1.2);
      wallBoards(g, mx - 22, my - 50, 44, 46, '#c98a55', ok);
      if (!ok) { E(g, mx + 8, my - 30, 5, 7); F(g, '#3a2a20', 1); }
      g.beginPath(); g.moveTo(mx - 26, my - 48); g.quadraticCurveTo(mx, my - 76, mx + 26, my - 48); g.closePath(); F(g, f.has('katus') ? '#7a6a62' : '#9a9088', 1.4);
      if (!f.has('katus')) { E(g, mx - 8, my - 58, 5, 3); F(g, '#3a2a20', 1); }
      window_(g, mx - 6, my - 40, 12, 10, ok ? 1 : 0);
      if (f.has('trepp')) { for (let i = 0; i < 6; i++) ln(g, [mx + 10 + i * 4, my - 4 + i * 5, mx + 22 + i * 4, my - 4 + i * 5], '#8a5a3a', 1.6); ln(g, [mx + 10, my - 4, mx + 32, my + 26], '#7a5232', 2); ln(g, [mx + 22, my - 4, mx + 44, my + 26], '#7a5232', 2); }
      if (!f.has('tiivad')) { // broken sails hanging
        dot(g, mx, my - 30, 4, '#6b4a30');
        g.save(); g.translate(mx, my - 30); for (const a of [.9, 2.6]) { g.save(); g.rotate(a); R(g, 3, -4, 46, 8, 1); F(g, '#9c8a76', 1.2); for (let k = 0; k < 4; k++) ln(g, [10 + k * 10, -4, 10 + k * 10, 4], '#7a6a5a', .8); g.restore(); } g.restore();
      }
      if (f.has('jahukotid')) { for (let i = 0; i < 3; i++) { const x = 160 + i * 11; SM(g, [x - 5, 150, x + 5, 150, x + 6, 140, x, 136, x - 6, 140]); F(g, '#ecdcb8', 1.2); } R(g, 236, 142, 28, 10, 2); F(g, '#b9784a', 1.2); dot(g, 242, 154, 4, '#5a4030'); dot(g, 258, 154, 4, '#5a4030'); }
      if (f.has('lilled')) { flowers(g, 20, 186, 110, 71, true); flowers(g, 280, 190, 110, 72, true); const r = srnd(73); for (let i = 0; i < 14; i++) { const x = L + 10 + r() * (Rr - L - 20), y = 200 + r() * 16; dot(g, x, y, 2.4, '#e2463c'); dot(g, x, y, .9, '#3a2020'); } }
      if (f.has('veskikivi')) { E(g, 258, 168, 13, 13); F(g, '#c9c2b6', 1.4, '#6f675e'); E(g, 258, 168, 3, 3); F(g, '#8a857b', 1); ln(g, [250, 162, 266, 174], '#a8a094', 1); }
      if (f.has('lambad')) { sheep(g, 92, 182, .9); sheep(g, 300, 186, 1, true); sheep(g, 332, 178, .8); }
      grass(g, L, Rr, 190, 220, 17);
    },
    anim(g, f, t, L, Rr) {
      cloud(g, ((t * 4 + 30) % (Rr - L + 80)) + L - 40, 52, .8, .7); cloud(g, ((t * 2 + 200) % (Rr - L + 80)) + L - 40, 22, 1, .8);
      bird(g, ((t * 9 + 100) % (Rr - L + 60)) + L - 30, 40 + Math.sin(t * 2) * 3, 1, Math.sin(t * 9));
      if (f.has('tiivad')) {
        const mx = 205, my = 96, a0 = t * .9;
        g.save(); g.translate(mx, my);
        for (let i = 0; i < 4; i++) { g.save(); g.rotate(a0 + i * PI / 2); ln(g, [0, 0, 62, 0], '#6b4a30', 2.6); R(g, 12, -1, 50, 10, 1); g.fillStyle = 'rgba(255,248,236,.92)'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = '#8a5a3a'; g.stroke(); for (let k = 0; k < 4; k++) ln(g, [20 + k * 11, -1, 20 + k * 11, 9], '#b8906a', .8); g.restore(); }
        dot(g, 0, 0, 4.5, '#6b4a30'); dot(g, 0, 0, 2, '#c98a55');
        if (f.has('laternad')) for (let i = 0; i < 4; i++) { const a = a0 + i * PI / 2; for (let k = 1; k <= 3; k++) { const x = Math.cos(a) * k * 19, y = Math.sin(a) * k * 19; glow(g, x, y, 7, .5); dot(g, x, y, 2, ['#ffd86a', '#ff9a8a', '#a8e0ff'][k - 1]); } }
        g.restore();
      }
    }
  };
  S.majakas = {
    glows: f => [].concat(f.has('tuli') ? [[296, 50, 34]] : [], f.has('maja') ? [[345, 116, 10]] : []),
    still(g, f, L, Rr) {
      sky(g, L, Rr, '#58c4ff', '#ffe6f0', 130); sun(g, 110, 46, 12); cloud(g, 40, 30, .9, .7);
      seaBand(g, L, Rr, 120, 220, '#7fe0ff', '#1a9fd8');
      // cliff
      g.beginPath(); g.moveTo(Rr, 220); g.lineTo(150, 220); g.quadraticCurveTo(170, 180, 190, 160); g.quadraticCurveTo(230, 136, 300, 134); g.lineTo(Rr, 132); g.closePath(); F(g, '#c9c0b0', 1.4);
      g.beginPath(); g.moveTo(Rr, 160); g.lineTo(190, 160); g.quadraticCurveTo(230, 132, 300, 130); g.lineTo(Rr, 128); g.closePath(); F(g, '#8fe07a', 1.2);
      const r = srnd(5); for (let i = 0; i < 10; i++) { const x = 170 + r() * 200, y = 170 + r() * 44; if (x - 170 < (y - 160) * .6) continue; E(g, x, y, 8, 4); g.fillStyle = 'rgba(120,110,100,.25)'; g.fill(); }
      if (f.has('trepp')) { for (let i = 0; i < 8; i++) { R(g, 196 + i * 7, 196 - i * 6, 12, 3, 1); F(g, '#d8d0c4', 1); } }
      // lighthouse
      const lx = 296, top = 40, base = 134, wb = 18, wt = 12;
      g.beginPath(); g.moveTo(lx - wb, base); g.lineTo(lx - wt, top + 22); g.lineTo(lx + wt, top + 22); g.lineTo(lx + wb, base); g.closePath(); F(g, f.has('varv') ? '#fff8ec' : '#b8b0a6', 1.6);
      if (f.has('varv')) { g.save(); g.clip(); for (let i = 0; i < 3; i++) { g.fillStyle = '#e2574c'; g.fillRect(lx - 30, top + 34 + i * 30, 60, 14); } g.restore(); }
      else { g.save(); g.clip(); for (let i = 0; i < 6; i++) { E(g, lx - 10 + i * 4, top + 40 + i * 14, 4, 6); g.fillStyle = 'rgba(90,80,70,.25)'; g.fill(); } g.restore(); }
      R(g, lx - 16, top + 18, 32, 5, 1); F(g, '#5a5a66', 1.3);
      R(g, lx - 9, top + 2, 18, 16, 2); F(g, f.has('tuli') ? '#fff2a0' : '#7a8a96', 1.3);
      ln(g, [lx, top + 2, lx, top + 18], '#5a5a66', 1); PL(g, [lx - 12, top + 3, lx, top - 8, lx + 12, top + 3]); F(g, '#c94a3c', 1.4); dot(g, lx, top - 9, 2, '#5a5a66');
      for (const y of [74, 104]) window_(g, lx - 3.5, y, 7, 9, f.has('aknad') ? 1 : 0);
      R(g, lx - 6, base - 16, 12, 16, 1); F(g, '#5f86c8', 1.2);
      if (f.has('maja')) { wallBoards(g, 330, 104, 50, 28, '#e8d06a', true); PL(g, [324, 106, 355, 86, 386, 106]); F(g, '#c94a3c', 1.4); window_(g, 340, 112, 10, 9, f.has('tuli') ? 2 : 1); R(g, 360, 114, 9, 18, 1); F(g, '#5f9e78', 1.1); chimney(g, 372, 96, true); }
      else { E(g, 356, 126, 24, 8); F(g, '#9a9088', 1.2); weeds(g, 334, 132, 44, 81); }
      if (f.has('aed')) fence(g, 222, 272, 146, 9, false, '#f4efe6', 9, sty('aed'));
      if (f.has('pink')) bench(g, 250, 150, '#5f86c8', sty('pink'));
      if (f.has('lilled')) { flowers(g, 214, 158, 70, 83, true, sty('lilled')); flowers(g, 330, 140, 60, 84, true, sty('lilled')); }
      else weeds(g, 220, 156, 50, 85);
      if (f.has('lipp')) ln(g, [196, 160, 196, 120], '#8a8a8a', 1.6);
      // rocks in the sea
      E(g, 60, 190, 18, 7); F(g, '#8a857b', 1.3); E(g, 100, 206, 10, 4); F(g, '#9a958b', 1.2);
    },
    anim(g, f, t, L, Rr) {
      cloud(g, ((t * 3 + 120) % (Rr - L + 80)) + L - 40, 60, .8, .7);
      for (let i = 0; i < 2; i++) { const bx = ((t * 10 + i * 170) % (Rr - L + 60)) + L - 30; bird(g, bx, 70 + i * 14 + Math.sin(t * 2 + i) * 3, 1, Math.sin(t * 8 + i)); }
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.3; g.lineCap = 'round';
      for (let row = 0; row < 4; row++) { const y = 138 + row * 20, off = (t * (7 + row * 3) + row * 23) % 44; for (let x = L - 44 + off; x < 200 - row * 12; x += 44) { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 5, y - 3, x + 10, y); g.stroke(); } }
      const fx = ((t * 10) % 18); g.strokeStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(60, 190, 20 + fx * .4, PI * 1.05, PI * 1.95); g.stroke();
      if (f.has('tuli')) {
        const a = Math.sin(t * .9) * 1.1, lx = 296, ly = 50; g.save(); g.translate(lx, ly); g.rotate(a > 0 ? PI : 0);
        const gr = g.createLinearGradient(0, 0, 160, 0); gr.addColorStop(0, 'rgba(255,240,170,.55)'); gr.addColorStop(1, 'rgba(255,240,170,0)');
        const sp = Math.abs(Math.cos(t * .9)) * .6 + .1; g.beginPath(); g.moveTo(0, 0); g.lineTo(170, -24 * sp - 4); g.lineTo(170, 24 * sp + 4); g.closePath(); g.fillStyle = gr; g.fill(); g.restore();
        glow(g, lx, ly, 16, .6);
      }
      if (f.has('lipp')) { const w = Math.sin(t * 4) * 2; PL(g, [196, 121, 214, 123 + w, 212, 129 + w * .5, 214, 135 + w, 196, 133]); F(g, '#4f86c6', .8); R(g, 196, 125, 17, 3, 0); g.fillStyle = '#2b2b2b'; g.fill(); R(g, 196, 129, 17, 4, 0); g.fillStyle = '#fff'; g.fill(); }
    }
  };
  S.saladus = {
    ownSky: true,
    still(g, f, L, Rr) {
      const sk = f.has('taevas');
      sky(g, L, Rr, sk ? '#2a2f8a' : '#3a3f72', sk ? '#ff8ac0' : '#9a7aa8', 150);
      dot(g, 320, 36, 13, '#fff6d6'); dot(g, 326, 32, 11, sk ? '#2f3a72' : '#3c4068');
      if (sk) { const r = srnd(91); for (let i = 0; i < 30; i++) dot(g, L + r() * (Rr - L), r() * 100, r() * 1 + .5, 'rgba(255,255,240,.8)'); }
      hill(g, L, Rr, [L, 120, 120, 112, 260, 118, Rr, 108], '#3f5a5a', 220);
      for (let i = 0; i < 16; i++) tree(g, L + 6 + i * ((Rr - L) / 15), 124 + (i % 3) * 3, .6 + (i % 2) * .15, 'pine');
      hill(g, L, Rr, [L, 160, 120, 150, 260, 152, Rr, 146], '#4f7a5a', 220);
      // path
      if (f.has('rada')) { g.beginPath(); g.moveTo(170, 220); g.quadraticCurveTo(186, 186, 200, 176); g.lineTo(214, 176); g.quadraticCurveTo(212, 196, 230, 220); g.closePath(); F(g, '#9a8a7a', 0); const r = srnd(3); for (let i = 0; i < 7; i++) { E(g, 194 + r() * 18 + i * 1.4, 182 + i * 5.4, 5, 2.4); F(g, '#c9c2b6', .8); } }
      // junipers (kadakad): wild & overgrown or neatly trimmed
      const tidy = f.has('kadakad');
      for (const [x, s] of [[40, 1.1], [80, .9], [340, 1.2], [380, .9]]) tree(g, x, 172, s, 'juniper', { col: tidy ? '#4f8a62' : '#466a52' });
      if (!tidy) { bush(g, 120, 176, 1.2, '#4a6a50'); bush(g, 300, 178, 1.1, '#4a6a50'); weeds(g, 140, 178, 40, 92); weeds(g, 250, 180, 40, 93); }
      // the summer kitchen cottage
      const ok = f.has('onn'), cx = 206, yb = 176;
      wallBoards(g, cx - 40, yb - 40, 80, 40, '#8a6a9a', ok);
      if (ok) { stoneWall(g, cx - 40, cx + 40, yb + 1, 9, 44); }
      thatch(g, cx - 40, cx + 40, yb - 40, 30, !ok, '#b89a5a');
      chimney(g, cx + 22, yb - 64, ok);
      window_(g, cx - 30, yb - 30, 14, 13, f.has('aknad') ? 2 : 0); window_(g, cx + 16, yb - 30, 14, 13, f.has('aknad') ? 2 : 0);
      g.beginPath(); g.moveTo(cx - 8, yb); g.lineTo(cx - 8, yb - 22); g.arc(cx, yb - 22, 8, PI, 0); g.lineTo(cx + 8, yb); g.closePath(); F(g, ok ? '#c94a3c' : '#5a4a40', 1.3);
      if (ok) { star(g, cx, yb - 18, 3.4, 1.4, 8); g.fillStyle = '#f2c14b'; g.fill(); }
      // gate
      if (f.has('varav')) {
        fence(g, 104, 184, 212, 12, false, '#d8ccb8', 4, sty('varav')); fence(g, 230, 310, 213, 12, false, '#d8ccb8', 5, sty('varav'));
        ln(g, [186, 214, 186, 186], '#8a6a4a', 3); ln(g, [228, 214, 228, 186], '#8a6a4a', 3);
        g.beginPath(); g.moveTo(186, 186); g.quadraticCurveTo(207, 170, 228, 186); g.lineWidth = 3; g.strokeStyle = '#8a6a4a'; g.stroke();
        const r = srnd(97); for (let i = 0; i < 16; i++) { const u = i / 15, xx = 186 + u * 42, yy = 186 - Math.sin(u * PI) * 8 + (r() - .5) * 3; if (i % 3) { for (let k = 0; k < 5; k++) dot(g, xx + Math.cos(k * 1.26) * 1.6, yy + Math.sin(k * 1.26) * 1.6, 1.3, i % 2 ? '#f7a8c8' : '#fff6e6'); dot(g, xx, yy, .8, '#f6d36a'); } else { E(g, xx, yy, 2.6, 1.4, u * 2); F(g, '#6aa84f', .6); } }
      }
      else { fence(g, 104, 310, 212, 12, true, '#a89a88', 6); }
      if (f.has('raamat')) { ln(g, [262, 206, 262, 186], '#6b4a30', 2.4); PL(g, [250, 186, 274, 186, 270, 180, 254, 180]); F(g, '#8a5a3a', 1.2); g.drawImage(A.icon('book', 48), 254, 168, 16, 14); }
      if (f.has('laternad')) { lantern(g, 140, 206, true, sty('laternad')); lantern(g, 276, 208, true, sty('laternad')); }
      if (f.has('lilled')) { const r = srnd(96); for (let i = 0; i < 26; i++) { const x = L + 10 + r() * (Rr - L - 20), y = 196 + r() * 20; for (let k = 0; k < 5; k++) dot(g, x + Math.cos(k * 1.26) * 1.7, y + Math.sin(k * 1.26) * 1.7, 1.4, '#f4f0ff'); dot(g, x, y, .9, '#f6d36a'); } }
      if (f.has('pidu')) {
        R(g, 286, 196, 70, 5, 2); F(g, '#fff6e6', 1.2); ln(g, [292, 201, 292, 214], '#6b4a30', 2); ln(g, [350, 201, 350, 214], '#6b4a30', 2);
        g.drawImage(A.item('bread', 7, 48), 298, 182, 18, 18); g.drawImage(A.item('berry', 8, 48), 320, 180, 18, 18); g.drawImage(A.item('tea', 7, 48), 338, 182, 16, 16);
        const pts = []; for (let i = 0; i <= 8; i++) pts.push(60 + i * 36, 150 + Math.sin(i / 8 * PI) * 12);
        ln(g, pts, '#5a4030', .7); for (let i = 0; i < 8; i++) { const x = pts[i * 2] + 18, y = pts[i * 2 + 1] + 5; PL(g, [x - 5, y - 2, x + 5, y - 2, x, y + 7]); F(g, ['#e2574c', '#f7d24c', '#5b86e0', '#fff6e6'][i % 4], .6); }
      }
      grass(g, L, Rr, 196, 220, 19, '#3f6a4a');
    },
    anim(g, f, t, L, Rr) {
      if (f.has('taevas')) {
        for (let k = 0; k < 2; k++) { g.beginPath(); for (let x = L; x <= Rr; x += 10) { const y = 30 + k * 14 + Math.sin(x * .02 + t * .5 + k) * 8; x === L ? g.moveTo(x, y) : g.lineTo(x, y); } g.lineWidth = 9 - k * 3; g.strokeStyle = k ? 'rgba(180,140,255,.18)' : 'rgba(120,240,190,.2)'; g.stroke(); }
        const r = srnd(91); for (let i = 0; i < 8; i++) { const x = L + r() * (Rr - L), y = r() * 90, a = .5 + .5 * Math.sin(t * 3 + i * 1.7); A.H.spark(g, x, y, 2.4 * a + .4, '#fffbe0'); }
      }
      if (f.has('aknad')) { glow(g, 183, 152, 14, .28 + Math.sin(t * 2) * .04); glow(g, 229, 152, 14, .28 + Math.sin(t * 2 + 1) * .04); }
      if (f.has('onn')) smoke(g, 228, 112, t, '#d8d0e8');
      if (f.has('laternad')) { glow(g, 140, 174, 12, .45 + Math.sin(t * 3) * .1); glow(g, 276, 176, 12, .45 + Math.sin(t * 3 + 2) * .1); }
      if (f.has('raamat')) { glow(g, 262, 175, 16, .4 + Math.sin(t * 2.4) * .12); for (let i = 0; i < 3; i++) { const p = (t * .5 + i / 3) % 1; A.H.spark(g, 262 + Math.sin(i * 2 + t) * 8, 172 - p * 26, 2.6 * Math.sin(p * PI), '#fff3b0'); } }
      if (f.has('pidu')) for (let i = 0; i < 8; i++) glow(g, 78 + i * 36, 158 + Math.sin((i + .5) / 8 * PI) * 12, 8, .35 + Math.sin(t * 3 + i) * .12);
      if (f.has('tulikarbid')) for (let i = 0; i < 9; i++) { const x = L + ((i * 53 + Math.sin(t * .6 + i) * 20) % (Rr - L)), y = 150 + ((i * 29) % 60) + Math.cos(t * .8 + i * 2) * 8, a = .5 + .5 * Math.sin(t * 3 + i * 1.3); glow(g, x, y, 6, .5 * a); dot(g, x, y, 1.3, 'rgba(240,255,150,' + (.5 + .5 * a) + ')'); }
    }
  };
  // ---------- animated bits ----------
  function glow(g, x, y, r, a) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,230,150,' + a + ')'); gr.addColorStop(1, 'rgba(255,230,150,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  function smoke(g, x, y, t, col) {
    for (let i = 0; i < 5; i++) { const p = ((t * .35 + i / 5) % 1), r = 3 + p * 9; g.beginPath(); g.arc(x + Math.sin(p * 5 + i) * 4 + p * 14, y - p * 46, r, 0, TAU); g.fillStyle = rgba(col || '#ffffff', .55 * (1 - p)); g.fill(); }
  }
  function lights(g, pts, t) {
    for (let i = 0; i < pts.length; i += 2) { const a = .6 + .4 * Math.sin(t * 3 + i); glow(g, pts[i], pts[i + 1] + 2, 6, .45 * a); dot(g, pts[i], pts[i + 1] + 2, 1.8, ['#ffd86a', '#ff9a8a', '#a8e0ff', '#b8f0a0'][(i / 2) % 4]); }
  }
  function seaSparkle(g, x0, x1, y0, y1, t) {
    for (let i = 0; i < 6; i++) { const a = Math.sin(t * 2.2 + i * 2.3); if (a < .3) continue; A.H.spark(g, x0 + ((i * 97) % (x1 - x0)), y0 + ((i * 41) % (y1 - y0)), 2.6 * a, '#ffffff'); }
  }

  // ---------- public ----------
  // Shared renderer for ART.scene and ART.tourScene: a cached still layer (tinted for the hour and the weather, with the sky
  // drawn live behind it by ART.sky), the animated layer on top, warm window glows after dark and the weather in front.
  //   def: { still(g, on, L, R), anim(g, on, t, L, R), glows?(on) -> [[x, y, r], ...] (design space), ownSky?: true }
  //   opts (last argument of ART.scene / ART.tourScene): { tod, weather, style: {taskId: 'boho'|'minimal'|'romantic'},
  //   noWeather, noEnv }. Without tod / weather the local clock and today's weather are used (ART.env).
  const cache = A._sceneCache = new Map();
  const OVER = { night: 'rgba(28,34,104,.42)', dusk: 'rgba(84,60,150,.26)', sunset: 'rgba(255,130,90,.14)', golden: 'rgba(255,170,90,.08)', dawn: 'rgba(255,150,190,.12)', day: null };
  let _glowSpr = null;
  function glowSprite() {
    if (_glowSpr) return _glowSpr;
    const c = _glowSpr = mk(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,236,170,.95)'); gr.addColorStop(.35, 'rgba(255,200,120,.45)'); gr.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return c;
  }
  // ---- tinted drawing for the animated layer (phase C) ----
  // tinted(ctx, over) returns a stand-in for ctx whose colours (fillStyle, strokeStyle, gradient stops, shadowColor) are
  // mixed toward `over` (an rgba string) and whose drawImage uses a cached pre-tinted copy of the canvas: the same result
  // as painting the layer offscreen and filling it 'source-atop', without the offscreen canvas and its full-rect
  // composite every frame (that cost 4-7 ms per frame at DPR 3 on a throttled phone). Colour results are cached.
  const _norm = (() => { let c = null; return v => { if (!c) c = mk(1, 1).getContext('2d'); c.fillStyle = '#000'; c.fillStyle = v; return c.fillStyle; }; })();
  function parseCol(v) {
    let m;
    if (v[0] === '#') {
      const h = v.length === 4 || v.length === 5 ? v.slice(1).split('').map(x => x + x).join('') : v.slice(1);
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
    }
    if ((m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i.exec(v))) return [+m[1], +m[2], +m[3], m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4]];
    return null;
  }
  const _tintCache = new Map();
  function tintCol(v, over) {
    if (typeof v !== 'string') return v;
    let tc = _tintCache.get(over); if (!tc) { tc = { o: parseCol(over), m: new Map() }; _tintCache.set(over, tc); }
    let r = tc.m.get(v); if (r !== undefined) return r;
    let c = parseCol(v); if (!c) { const n = _norm(v); c = parseCol(n); }
    const o = tc.o;
    if (!c || !o) r = v;
    else { const a = o[3], f = x => Math.round(x); r = 'rgba(' + f(c[0] * (1 - a) + o[0] * a) + ',' + f(c[1] * (1 - a) + o[1] * a) + ',' + f(c[2] * (1 - a) + o[2] * a) + ',' + +c[3].toFixed(3) + ')'; }
    if (tc.m.size > 800) tc.m.clear();
    tc.m.set(v, r); return r;
  }
  const _imgTint = new WeakMap();
  function tintImg(img, over) {
    if (!(img instanceof HTMLCanvasElement)) return img;
    let e = _imgTint.get(img); if (e && e.over === over && e.w === img.width) return e.c;
    const c = mk(img.width, img.height), g = c.getContext('2d');
    g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = over; g.fillRect(0, 0, c.width, c.height);
    _imgTint.set(img, { over, w: img.width, c }); return c;
  }
  const TintProto = (() => {
    const P = {}, CP = CanvasRenderingContext2D.prototype, special = { fillStyle: 1, strokeStyle: 1, shadowColor: 1 };
    for (const k of Object.getOwnPropertyNames(CP)) {
      if (k === 'constructor') continue;
      const d = Object.getOwnPropertyDescriptor(CP, k);
      if (typeof d.value === 'function') P[k] = function () { return this._c[k].apply(this._c, arguments); };
      else if (d.get) Object.defineProperty(P, k, special[k]
        ? { get() { return this._c[k]; }, set(v) { this._c[k] = v && v._g ? v._g : tintCol(v, this._o); } }
        : { get() { return this._c[k]; }, set(v) { this._c[k] = v; } });
    }
    const grad = (self, gr) => ({ _g: gr, addColorStop(o, c) { gr.addColorStop(o, tintCol(c, self._o)); } });
    P.createLinearGradient = function () { return grad(this, this._c.createLinearGradient.apply(this._c, arguments)); };
    P.createRadialGradient = function () { return grad(this, this._c.createRadialGradient.apply(this._c, arguments)); };
    if (CP.createConicGradient) P.createConicGradient = function () { return grad(this, this._c.createConicGradient.apply(this._c, arguments)); };
    P.drawImage = function (img) { const a = Array.prototype.slice.call(arguments); a[0] = tintImg(img, this._o); return this._c.drawImage.apply(this._c, a); };
    return P;
  })();
  const _tinted = new WeakMap();
  function tinted(ctx, over) { let t = _tinted.get(ctx); if (!t) { t = Object.create(TintProto); t._c = ctx; _tinted.set(ctx, t); } t._o = over; return t; }
  A.tinted = tinted;
  A._renderScene = function (ctx, id, def, on, frac, x, y, w, h, t, opts, sty) {
    if (w < 4 || h < 4) return;
    opts = opts || {}; t = t || 0;
    const env = opts.env || A.env(opts), look = A.skyLook(env), plain = !!(look.plain || opts.noEnv);
    // fit the height, but on a short wide strip zoom in (crop some sky and ground) so details stay readable
    const s = Math.max(h / DH, Math.min(w / 520, h / 150)), ox = (w - DW * s) / 2, oy = Math.max(h - DH * s, Math.min(0, h - 204 * s)), L = -ox / s, Rr = DW + ox / s, sc = A.scaleOf(ctx);
    const own = !!def.ownSky, styKey = sty ? Object.keys(sty).sort().map(k => k + '=' + sty[k][0]).join(',') : '';
    const q = (typeof FX !== 'undefined' && FX) ? FX.quality | 0 : 2, hz = Math.max(.3, Math.min(.95, (oy + 132 * s) / h));
    const bake = !plain && !own && q < 2; // lower quality: the sky (still clouds) is baked into the cached layer, one blit a frame
    const ck = id + '|' + styKey + '|' + (plain ? 'plain' : env.key) + (bake ? '|b' + Math.round(env.tod * 96) : '') + '|' + Math.round(w) + 'x' + Math.round(h) + '@' + sc.toFixed(2);
    let c = cache.get(ck);
    if (!c) {
      c = mk(w * sc, h * sc); const g = c.getContext('2d');
      g.scale(sc, sc); g.translate(ox, oy); g.scale(s, s);
      SKYOFF = !plain && !own; STY = sty || null;
      try { def.still(g, on, L, Rr); } catch (e) { console.error('ART.scene', id, e); }
      SKYOFF = false; STY = null;
      g.setTransform(1, 0, 0, 1, 0, 0);
      const hole = !plain && !own; let cp = null;
      if (hole) { cp = A.fx.scratch('sceneCopy', c.width, c.height); cp.getContext('2d').drawImage(c, 0, 0); }
      if (A.vibrance && c.width * c.height < 4.5e6) A.vibrance(g, c.width, c.height, .38);
      // a dusty, faded look that clears as the area is restored
      const fade = (1 - frac) * .3;
      if (fade > .01) {
        g.globalCompositeOperation = 'saturation'; g.fillStyle = 'rgba(128,128,128,' + fade + ')'; g.fillRect(0, 0, c.width, c.height);
        g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(120,100,80,' + fade * .18 + ')'; g.fillRect(0, 0, c.width, c.height);
      }
      if (!plain && look.tint) { g.globalCompositeOperation = 'multiply'; g.fillStyle = look.tint; g.fillRect(0, 0, c.width, c.height); }
      if (!plain && look.haze) { // snow: a cold white haze over the ground
        g.globalCompositeOperation = 'source-over'; const hg = g.createLinearGradient(0, c.height * .55, 0, c.height); hg.addColorStop(0, 'rgba(255,255,255,0)'); hg.addColorStop(1, 'rgba(255,255,255,' + look.haze + ')'); g.fillStyle = hg; g.fillRect(0, 0, c.width, c.height);
      }
      if (hole) { g.globalCompositeOperation = 'destination-in'; g.drawImage(cp, 0, 0); } // keep the transparent sky hole
      g.globalCompositeOperation = 'source-over';
      if (bake) {
        const c2 = mk(w * sc, h * sc), g2 = c2.getContext('2d'); g2.scale(sc, sc);
        A.sky(g2, 0, 0, w, h, 0, Object.assign({}, env, { horizon: hz })); g2.setTransform(1, 0, 0, 1, 0, 0); g2.drawImage(c, 0, 0); c = c2;
      }
      if (cache.size > 8) cache.delete(cache.keys().next().value);
      cache.set(ck, c);
    }
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    if (!plain && !own && !bake) A.sky(ctx, x, y, w, h, t, Object.assign({}, env, { horizon: hz }));
    ctx.drawImage(c, x, y, w, h);
    const over = plain ? null : (env.weather === 'rain' && !OVER[env.phase] ? 'rgba(80,90,130,.18)' : OVER[env.phase]);
    SKYOFF = !plain && !own;
    { // the animated layer, tinted for the hour like the still (colour-mixed drawing, no offscreen pass; every quality)
      const ac = over ? tinted(ctx, over) : ctx;
      ctx.save(); ctx.translate(x + ox, y + oy); ctx.scale(s, s);
      try { def.anim(ac, on, t, L, Rr); } catch (e) { console.error('ART.scene anim', id, e); }
      ctx.restore();
    }
    SKYOFF = false;
    if (!plain && look.dark && def.glows) { // warm windows and lamps after dark
      let pts = null; try { pts = def.glows(on); } catch (e) { }
      if (pts && pts.length) {
        const spr = glowSprite(); ctx.save(); ctx.translate(x + ox, y + oy); ctx.scale(s, s);
        for (const p of pts) { const r = p[2] * (1 + .06 * Math.sin(t * 2.3 + p[0])); ctx.globalAlpha = look.dark * (.75 + .25 * Math.sin(t * 1.7 + p[1])); ctx.drawImage(spr, p[0] - r, p[1] - r, r * 2, r * 2); }
        ctx.restore();
      }
    }
    if (!opts.noWeather) A.weatherFx(ctx, x, y, w, h, t, env.weather);
    ctx.restore();
  };
  const STYLE_KEYS = { boho: 1, minimal: 1, romantic: 1 };
  A.styleKeys = ['boho', 'minimal', 'romantic'];
  // which features of an area the player's style choices control: { feature: styleKey }
  function styleMap(key, style) {
    if (!style) return null; const out = {}; let n = 0;
    for (const id in style) {
      const m = A.sceneMap[id], sk = style[id]; if (!STYLE_KEYS[sk]) continue;
      if (m) { if (areaKey(m[0]) === key) for (let i = 1; i < m.length; i++) { out[m[i]] = sk; n++; } continue; }
      const low = String(id).toLowerCase(), f = A.sceneFeatures[key].find(f => low === f || low.endsWith('_' + f));
      if (f) { out[f] = sk; n++; }
    }
    return n ? out : null;
  }
  A.scene = function (ctx, area, progress, x, y, w, h, t, opts) {
    if (w < 4 || h < 4) return;
    const key = areaKey(area), on = featureSet(key, progress), def = S[key];
    const id = key + '|' + A.sceneFeatures[key].map(f => on.has(f) ? 1 : 0).join('');
    A._renderScene(ctx, id, def, on, on.size / A.sceneFeatures[key].length, x, y, w, h, t, opts, styleMap(key, opts && opts.style));
  };
  // drawing helpers for the other scene modules (26-tour.js)
  A.SH = { F, VG, ln, sky, sun, cloud, seaBand, hill, tuft, grass, weeds, flowers, bush, tree, fence, stoneWall, lantern, bench, barrel, crate, junk, sheep, cat, bird, window_, flowerBox, awning, parasol, plant, glow, smoke, lights, seaSparkle, wallBoards, thatch, chimney, DW, DH, setStyle: m => { STY = m; }, styleOf: f => (STY && STY[f]) || null };
})();
