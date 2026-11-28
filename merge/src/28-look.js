// ===== ART looks (Ash): the heroine's wardrobe, the pets and the design-style chips. All cached canvases. =====
//   ART.heroine(px, look)  -> px × px canvas: a full-body chibi heroine. look = { outfit, hair, acc } with
//       outfit 'casual' | 'summer' | 'chef' | 'gala' | 'cozy' | 'beach', hair 'bun' | 'long' | 'bob' | 'braid',
//       acc 'none' | 'glasses' | 'hat' | 'flower' | 'scarf'. Unknown keys fall back to the first one.
//   ART.heroineKeys = { outfit: [...], hair: [...], acc: [...] }
//   ART.pet(kind, px, acc) -> px × px canvas: kind 'muri' (café cat) | 'kutsu' (puppy) | 'janku' (bunny; 'jänku' works too),
//       acc 'none' | 'bow' | 'collar' | 'hat'.   ART.petKinds, ART.petAccs.
//   ART.styleSwatch(key, px) -> px × px round chip for a design style: 'boho' | 'minimal' | 'romantic'.  ART.styleNames (Estonian).
(function (A) {
  const { E, R, PL, SM, paint, flat, stroke, HL, dot, pstar, heart, star, lt, dk, rgba, mk, srnd } = A.H;
  const PI = Math.PI, TAU = PI * 2, INK = '#3a2358', SKIN = '#ffd9c2', SKIN2 = '#f7c2a4';
  A.heroineKeys = { outfit: ['casual', 'summer', 'chef', 'gala', 'cozy', 'beach'], hair: ['bun', 'long', 'bob', 'braid'], acc: ['none', 'glasses', 'hat', 'flower', 'scarf'] };
  A.petKinds = ['muri', 'kutsu', 'janku']; A.petAccs = ['none', 'bow', 'collar', 'hat'];
  A.styleNames = { boho: 'Boho', minimal: 'Minimalistlik', romantic: 'Romantiline' };
  const pick = (v, list) => list.indexOf(v) >= 0 ? v : list[0];
  function ol(g, w) { g.lineWidth = w || 2.2; g.strokeStyle = INK; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
  function fillOl(g, col, cx, cy, r, w) { paint(g, col, cx, cy, r, 0); ol(g, w); }
  // ---------- heroine (drawn in a 100 × 120 box) ----------
  const HAIR = '#9a5636', HAIR2 = '#7a3f24';
  function eyes(g, cx, cy) {
    for (const s of [-1, 1]) {
      const x = cx + s * 7.5; E(g, x, cy, 3, 3.8); g.fillStyle = INK; g.fill();
      E(g, x, cy + .8, 2.1, 2.6); const gr = g.createLinearGradient(0, cy - 3, 0, cy + 3); gr.addColorStop(0, '#2f7a5a'); gr.addColorStop(1, '#7fe0b0'); g.fillStyle = gr; g.fill();
      E(g, x, cy + .6, 1.1, 1.5); g.fillStyle = INK; g.fill(); dot(g, x + 1, cy - 1.4, 1.1, '#fff'); dot(g, x - .9, cy + 1.6, .5, '#fff');
      g.beginPath(); g.moveTo(x + s * 2.6, cy - 2.2); g.lineTo(x + s * 4, cy - 3.4); stroke(g, INK, 1);
    }
  }
  function face(g) {
    eyes(g, 50, 36);
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(50 + s * 5, 30); g.quadraticCurveTo(50 + s * 7.5, 28.6, 50 + s * 10, 30); stroke(g, '#6a3a24', 1.3); }
    g.beginPath(); g.moveTo(46.6, 42.4); g.quadraticCurveTo(50, 46, 53.4, 42.4); g.closePath(); g.fillStyle = '#c2365a'; g.fill(); ol(g, 1);
    for (const s of [-1, 1]) { E(g, 50 + s * 12, 41, 3.6, 2.2); g.fillStyle = 'rgba(255,110,150,.42)'; g.fill(); }
    E(g, 50, 39.4, 1, .7); g.fillStyle = '#e8957a'; g.fill();
  }
  function headShape(g) {
    g.beginPath(); g.moveTo(31, 33); g.bezierCurveTo(31, 12, 69, 12, 69, 33); g.bezierCurveTo(69, 46, 60, 53, 50, 53); g.bezierCurveTo(40, 53, 31, 46, 31, 33); g.closePath();
  }
  function hairBack(g, hair) {
    if (hair === 'long') { SM(g, [30, 28, 26, 50, 24, 76, 32, 84, 42, 72, 58, 72, 68, 84, 76, 76, 74, 50, 70, 28]); fillOl(g, HAIR, 44, 40, 40); }
    else if (hair === 'bob') { SM(g, [29, 30, 27, 46, 30, 58, 40, 56, 60, 56, 70, 58, 73, 46, 71, 30]); fillOl(g, HAIR, 46, 36, 30); }
    else if (hair === 'braid') { // braid over the left shoulder
      for (let i = 0; i < 6; i++) { E(g, 33 - i * .6, 50 + i * 6, 5 - i * .35, 4.2); fillOl(g, i % 2 ? HAIR2 : HAIR, 33, 50 + i * 6, 6, 1.6); }
      R(g, 28.5, 85, 8, 4, 2); fillOl(g, '#ff7a6b', 32, 87, 4, 1.4);
    } else { E(g, 50, 11, 11, 9.5); fillOl(g, HAIR, 46, 8, 12); R(g, 41, 17, 18, 5, 2.5); fillOl(g, '#ff7a6b', 50, 19, 9, 1.6); }
  }
  function hairFront(g, hair) {
    const pts = hair === 'bob' ? [29, 38, 30, 20, 42, 13, 58, 13, 70, 20, 71, 38, 66, 27, 58, 24, 52, 29, 44, 24, 36, 28, 32, 34]
      : hair === 'long' ? [30, 42, 30, 20, 42, 13, 58, 13, 70, 20, 70, 42, 66, 28, 56, 22, 48, 28, 40, 22, 34, 30]
        : [30, 36, 30, 20, 42, 13, 58, 13, 70, 20, 70, 36, 66, 26, 60, 22, 54, 28, 48, 22, 42, 28, 36, 26];
    SM(g, pts); fillOl(g, HAIR, 44, 18, 26);
    g.beginPath(); g.moveTo(40, 17); g.quadraticCurveTo(46, 14, 52, 16); stroke(g, '#ffffff', 1.8, .55);
  }
  function limbs(g, skin, legCol, sleeve) {
    // legs
    for (const s of [-1, 1]) { R(g, 50 + s * 6 - 3.6, 84, 7.2, 26, 3.4); fillOl(g, legCol || skin, 50 + s * 6, 92, 8, 1.8); }
    // arms
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(50 + s * 13, 60); g.quadraticCurveTo(50 + s * 20, 70, 50 + s * 18, 82); g.lineWidth = 7.4; g.strokeStyle = INK; g.lineCap = 'round'; g.stroke(); g.lineWidth = 5; g.strokeStyle = sleeve || skin; g.stroke();
      dot(g, 50 + s * 18, 83, 3.6, INK); dot(g, 50 + s * 18, 83, 2.6, SKIN);
    }
  }
  function shoes(g, col, kind) {
    for (const s of [-1, 1]) {
      const x = 50 + s * 6.5;
      if (kind === 'flip') { E(g, x, 113, 5, 1.8); fillOl(g, col, x, 113, 5, 1.4); ln2(g, x - 2, 110, x, 112.6, '#ffffff'); ln2(g, x + 2, 110, x, 112.6, '#ffffff'); continue; }
      if (kind === 'boot') { R(g, x - 4.6, 100, 9.2, 13, 3); fillOl(g, col, x, 106, 6, 1.6); R(g, x - 5, 99, 10, 3, 1.4); fillOl(g, '#fff6ea', x, 100, 5, 1.2); continue; }
      E(g, x + s * .8, 111.6, 5.4, 3); fillOl(g, col, x, 111, 5, 1.6);
      if (kind === 'heel') { dot(g, x + s * 1.6, 110.4, 1.2, '#fff6c0'); }
      if (kind === 'sneaker') { g.beginPath(); g.moveTo(x - 4, 113.4); g.lineTo(x + 5, 113.4); stroke(g, '#ffffff', 1.3); }
    }
  }
  function ln2(g, a, b, c, d, col) { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); stroke(g, col, 1.2); }
  function torso(g, col, neck) { // a soft rounded top from the shoulders to the waist
    g.beginPath(); g.moveTo(37, 62); g.quadraticCurveTo(38, 55, 50, 55); g.quadraticCurveTo(62, 55, 63, 62); g.lineTo(62, 84); g.quadraticCurveTo(50, 87, 38, 84); g.closePath(); fillOl(g, col, 46, 64, 18);
    if (neck) { g.beginPath(); g.moveTo(45, 55.5); g.quadraticCurveTo(50, 61, 55, 55.5); g.fillStyle = SKIN; g.fill(); }
  }
  function skirt(g, col, y0, y1, flare) { g.beginPath(); g.moveTo(38, y0); g.lineTo(62, y0); g.lineTo(62 + flare, y1); g.quadraticCurveTo(50, y1 + 3, 38 - flare, y1); g.closePath(); fillOl(g, col, 48, y0 + 8, 20); }
  const OUT = {
    casual(g) { // striped tee, light jeans, pink sneakers
      limbs(g, SKIN, '#7fb0f0'); shoes(g, '#ff7ab0', 'sneaker');
      R(g, 38, 80, 24, 12, 3); fillOl(g, '#7fb0f0', 50, 84, 12, 1.8);
      torso(g, '#ffffff', true);
      g.save(); g.beginPath(); g.moveTo(37, 62); g.quadraticCurveTo(38, 55, 50, 55); g.quadraticCurveTo(62, 55, 63, 62); g.lineTo(62, 84); g.quadraticCurveTo(50, 87, 38, 84); g.closePath(); g.clip();
      for (let i = 0; i < 5; i++) { g.fillStyle = '#6fa8ff'; g.fillRect(30, 60 + i * 5.4, 40, 2.2); } g.restore();
      heart(g, 56, 68, 2.6); g.fillStyle = '#ff4f9a'; g.fill();
    },
    summer(g) { // yellow sundress with little flowers, sandals
      limbs(g, SKIN); shoes(g, '#ffb48a');
      skirt(g, '#ffd84a', 70, 96, 8); torso(g, '#ffd84a', false);
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(50 + s * 7, 62); g.lineTo(50 + s * 9, 56); stroke(g, '#ffd84a', 2); }
      g.beginPath(); g.moveTo(40, 62); g.quadraticCurveTo(50, 66, 60, 62); g.lineTo(60, 60); g.quadraticCurveTo(50, 63, 40, 60); g.fillStyle = SKIN; g.fill();
      const r = srnd(3); for (let i = 0; i < 9; i++) { const x = 38 + r() * 24, y = 66 + r() * 28; for (let k = 0; k < 5; k++) dot(g, x + Math.cos(k * 1.26) * 1.3, y + Math.sin(k * 1.26) * 1.3, 1, '#ffffff'); dot(g, x, y, .8, '#ff8a3d'); }
      R(g, 39, 70, 22, 3, 1.5); g.fillStyle = '#ff8a3d'; g.fill();
    },
    chef(g) { // white double-breasted jacket, checked trousers, red neckerchief
      limbs(g, SKIN, '#ffffff', '#ffffff'); shoes(g, '#3a3a4a');
      for (const s of [-1, 1]) { R(g, 50 + s * 6 - 3.8, 84, 7.6, 22, 3); fillOl(g, '#3a3a4a', 50 + s * 6, 90, 8, 1.8); g.save(); R(g, 50 + s * 6 - 3.8, 84, 7.6, 22, 3); g.clip(); for (let y = 84; y < 108; y += 3) { g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(40, y, 20, 1.2); } for (let x = 40; x < 60; x += 3) { g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(x, 84, 1.2, 24); } g.restore(); }
      torso(g, '#ffffff', false); R(g, 37, 78, 26, 9, 3); fillOl(g, '#ffffff', 50, 82, 12, 1.8);
      for (let i = 0; i < 3; i++) { dot(g, 46, 64 + i * 6, 1.3, '#c8c0d8'); dot(g, 54, 64 + i * 6, 1.3, '#c8c0d8'); }
      PL(g, [42, 56, 58, 56, 50, 64]); fillOl(g, '#ff5a5f', 50, 58, 6, 1.4);
    },
    gala(g) { // long sparkly gown, gold heels peeking out
      limbs(g, SKIN); shoes(g, '#ffc83d', 'heel');
      g.beginPath(); g.moveTo(40, 66); g.lineTo(60, 66); g.quadraticCurveTo(64, 92, 70, 110); g.quadraticCurveTo(50, 114, 30, 110); g.quadraticCurveTo(36, 92, 40, 66); g.closePath(); fillOl(g, '#b44aff', 48, 80, 30);
      g.beginPath(); g.moveTo(40, 62); g.quadraticCurveTo(50, 58, 60, 62); g.lineTo(60, 70); g.quadraticCurveTo(50, 73, 40, 70); g.closePath(); fillOl(g, '#b44aff', 50, 64, 12);
      g.beginPath(); g.moveTo(44, 86); g.quadraticCurveTo(46, 98, 40, 108); stroke(g, '#d89aff', 1.4, .8);
      const r = srnd(9); for (let i = 0; i < 12; i++) A.sparkAt(g, 36 + r() * 28, 66 + r() * 42, 1 + r() * 1.4, '#ffffff');
      R(g, 40, 69, 20, 3, 1.5); g.fillStyle = '#ffd84a'; g.fill(); dot(g, 50, 70.5, 2, '#fff6c0');
      for (const s of [-1, 1]) dot(g, 50 + s * 18, 76, 2.2, '#fff8ff');
    },
    cozy(g) { // chunky knit sweater with a folk band, leggings, boots
      limbs(g, SKIN, '#5a4a7a', '#e8505a'); shoes(g, '#b8784a', 'boot');
      torso(g, '#e8505a', false); R(g, 37, 78, 26, 9, 4); fillOl(g, '#e8505a', 50, 82, 12, 1.8);
      R(g, 37.5, 64, 25, 7, 1); g.fillStyle = '#ffffff'; g.fill();
      for (let i = 0; i < 6; i++) { const x = 40 + i * 4; PL(g, [x, 67.5, x + 2, 65, x + 4, 67.5, x + 2, 70]); g.fillStyle = i % 2 ? '#2f6ac8' : '#e8505a'; g.fill(); }
      R(g, 43, 54, 14, 5, 2.5); fillOl(g, '#e8505a', 50, 56, 7, 1.6); for (let x = 39; x < 62; x += 3) { g.beginPath(); g.moveTo(x, 79); g.lineTo(x, 86); stroke(g, '#c83a48', .8); }
    },
    beach(g) { // coral tank top, turquoise shorts, flip-flops, a little shell necklace
      limbs(g, SKIN); shoes(g, '#ffd23f', 'flip');
      R(g, 38, 78, 24, 13, 3); fillOl(g, '#2fd3c4', 50, 82, 12, 1.8); g.beginPath(); g.moveTo(50, 84); g.lineTo(50, 91); stroke(g, '#1aa89a', 1);
      g.beginPath(); g.moveTo(40, 60); g.quadraticCurveTo(50, 64, 60, 60); g.lineTo(62, 82); g.quadraticCurveTo(50, 85, 38, 82); g.closePath(); fillOl(g, '#ff7a6b', 50, 68, 16);
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(50 + s * 9, 60); g.lineTo(50 + s * 9, 55); stroke(g, '#ff7a6b', 2.4); }
      for (let i = 0; i < 3; i++) { R(g, 38, 66 + i * 5, 24, 1.6, .8); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill(); }
      g.beginPath(); g.arc(50, 56, 6, .3, PI - .3); stroke(g, '#ffffff', .9); dot(g, 50, 62, 1.6, '#ffd0dc');
    }
  };
  function acc(g, a, hair) {
    if (a === 'glasses') { for (const s of [-1, 1]) { E(g, 50 + s * 7.5, 36, 5.4, 5); g.lineWidth = 1.6; g.strokeStyle = '#ff5a7a'; g.stroke(); g.fillStyle = 'rgba(255,255,255,.18)'; g.fill(); } g.beginPath(); g.moveTo(47.6, 35.4); g.quadraticCurveTo(50, 34, 52.4, 35.4); stroke(g, '#ff5a7a', 1.3); }
    else if (a === 'hat') { // straw sun hat with a ribbon
      const y = hair === 'bun' ? 15 : 19;
      E(g, 50, y + 2, 27, 6.4); fillOl(g, '#f2d08a', 50, y, 26, 1.8);
      g.beginPath(); g.moveTo(36, y + 1); g.quadraticCurveTo(37, y - 14, 50, y - 14); g.quadraticCurveTo(63, y - 14, 64, y + 1); g.closePath(); fillOl(g, '#f6dc9a', 48, y - 8, 14, 1.8);
      R(g, 36.4, y - 4, 27.2, 4.4, 1.6); g.fillStyle = '#ff7ab0'; g.fill(); E(g, 63, y - 1.6, 3.2, 2.2, .5); g.fillStyle = '#ff4f9a'; g.fill();
      for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(26 + i * 9.6, y + 3.4); g.lineTo(28 + i * 9.6, y + 4.6); stroke(g, '#d8a848', .8); }
    } else if (a === 'flower') { const x = 64, y = 22; for (let k = 0; k < 5; k++) { const an = k * TAU / 5; E(g, x + Math.cos(an) * 3.4, y + Math.sin(an) * 3.4, 2.8, 2, an); g.fillStyle = '#ff8fb8'; g.fill(); g.lineWidth = .8; g.strokeStyle = INK; g.stroke(); } dot(g, x, y, 2, '#ffd23f'); }
    else if (a === 'scarf') {
      g.beginPath(); g.moveTo(38, 55); g.quadraticCurveTo(50, 62, 62, 55); g.lineTo(62, 59); g.quadraticCurveTo(50, 66, 38, 59); g.closePath(); fillOl(g, '#2fb0a0', 50, 58, 12, 1.6);
      R(g, 54, 58, 6, 15, 2.4); fillOl(g, '#2fb0a0', 57, 64, 6, 1.4); for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(55 + i * 2, 73); g.lineTo(55 + i * 2, 76); stroke(g, '#2fb0a0', 1); }
      for (let i = 0; i < 4; i++) dot(g, 42 + i * 5.4, 58.6 + Math.sin(i) * .6, .8, '#ffffff');
    }
  }
  const _hc = {};
  A.heroine = function (px, look) {
    px = Math.max(16, Math.round(px || 96)); look = look || {};
    const o = pick(look.outfit, A.heroineKeys.outfit), h = pick(look.hair, A.heroineKeys.hair), a = pick(look.acc, A.heroineKeys.acc);
    const key = px + '|' + o + '|' + h + '|' + a; let c = _hc[key]; if (c) return c;
    if (Object.keys(_hc).length > 60) for (const k in _hc) delete _hc[k];
    c = _hc[key] = mk(px, px); const g = c.getContext('2d'), s = px / 120;
    g.translate((px - 100 * s) / 2, 0); g.scale(s, s);
    try {
      E(g, 50, 114, 22, 4); g.fillStyle = 'rgba(70,50,140,.18)'; g.fill();
      hairBack(g, h);
      OUT[o](g);
      g.beginPath(); g.moveTo(46, 50); g.lineTo(46, 57); g.lineTo(54, 57); g.lineTo(54, 50); g.fillStyle = SKIN2; g.fill();
      for (const sx of [-1, 1]) { E(g, 50 + sx * 19, 36, 3, 4); paint(g, SKIN2, 50 + sx * 19, 36, 4, 0); ol(g, 1.6); }
      headShape(g); paint(g, SKIN, 46, 28, 22, 0); ol(g, 2.2);
      face(g);
      if (h === 'braid') { R(g, 30, 30, 6, 16, 3); fillOl(g, HAIR, 33, 36, 6, 1.6); }
      hairFront(g, h);
      if (h === 'bun' && a !== 'hat') { } // the bun is drawn in the back layer
      acc(g, a, h);
    } catch (e) { console.error('ART.heroine', key, e); }
    return c;
  };
  // ---------- pets (100 × 100 box, sitting, facing the viewer) ----------
  function petEyes(g, cx, cy, sp, r, iris) {
    for (const s of [-1, 1]) { const x = cx + s * sp; E(g, x, cy, r, r * 1.2); g.fillStyle = INK; g.fill(); E(g, x, cy + r * .2, r * .7, r * .85); g.fillStyle = iris; g.fill(); E(g, x, cy + r * .15, r * .35, r * .45); g.fillStyle = INK; g.fill(); dot(g, x + r * .35, cy - r * .4, r * .36, '#fff'); }
  }
  function petBlush(g, cx, cy, sp) { for (const s of [-1, 1]) { E(g, cx + s * sp, cy, 5, 3); g.fillStyle = 'rgba(255,110,150,.4)'; g.fill(); } }
  function nose(g, x, y, col) { PL(g, [x - 3.4, y, x + 3.4, y, x, y + 3.4]); g.fillStyle = col; g.fill(); g.lineWidth = 1.2; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke(); g.beginPath(); g.moveTo(x, y + 3.4); g.quadraticCurveTo(x - 3, y + 7, x - 6, y + 5); g.moveTo(x, y + 3.4); g.quadraticCurveTo(x + 3, y + 7, x + 6, y + 5); stroke(g, INK, 1.4); }
  const PET = {
    muri(g) { // chubby ginger café cat
      g.beginPath(); g.moveTo(70, 86); g.quadraticCurveTo(92, 84, 88, 62); g.lineWidth = 9; g.strokeStyle = INK; g.lineCap = 'round'; g.stroke(); g.lineWidth = 6; g.strokeStyle = '#ffa24a'; g.stroke();
      E(g, 50, 76, 25, 20); fillOl(g, '#ffa24a', 44, 70, 26, 2.4); E(g, 50, 80, 13, 12); g.fillStyle = '#fff6ea'; g.fill();
      for (const s of [-1, 1]) { E(g, 50 + s * 10, 94, 7, 4.4); fillOl(g, '#ffb466', 50 + s * 10, 93, 6, 2); }
      for (const s of [-1, 1]) { PL(g, [50 + s * 22, 30, 50 + s * 21, 8, 50 + s * 6, 20]); fillOl(g, '#ffa24a', 50 + s * 16, 20, 12, 2.4); PL(g, [50 + s * 19, 25, 50 + s * 19, 13, 50 + s * 10, 21]); g.fillStyle = '#ffb3c6'; g.fill(); }
      E(g, 50, 42, 26, 22); fillOl(g, '#ffa24a', 42, 34, 28, 2.4);
      for (const [x, r] of [[50, 0], [43, -.25], [57, .25]]) { g.save(); g.translate(x, 21); g.rotate(r); R(g, -1.4, 0, 2.8, 7, 1.4); g.fillStyle = '#e8781e'; g.fill(); g.restore(); }
      E(g, 44, 51, 8, 6); g.fillStyle = '#fff6ea'; g.fill(); E(g, 56, 51, 8, 6); g.fill();
      petEyes(g, 50, 40, 10, 3.6, '#2fd59a'); nose(g, 50, 47, '#ff7a9a'); petBlush(g, 50, 49, 16);
      for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(50 + s * 12, 50 + i * 3); g.lineTo(50 + s * 27, 47 + i * 6); stroke(g, '#ffffff', 1.2, .95); }
    },
    kutsu(g) { // a cream puppy with floppy brown ears and a patch
      g.beginPath(); g.moveTo(70, 84); g.quadraticCurveTo(86, 78, 84, 66); g.lineWidth = 8; g.strokeStyle = INK; g.lineCap = 'round'; g.stroke(); g.lineWidth = 5; g.strokeStyle = '#ffe2b8'; g.stroke();
      E(g, 50, 76, 24, 20); fillOl(g, '#ffe2b8', 44, 70, 26, 2.4); E(g, 50, 80, 12, 12); g.fillStyle = '#fff8ee'; g.fill();
      for (const s of [-1, 1]) { E(g, 50 + s * 10, 94, 7, 4.4); fillOl(g, '#fff0d8', 50 + s * 10, 93, 6, 2); }
      E(g, 50, 42, 25, 22); fillOl(g, '#ffe2b8', 42, 34, 28, 2.4);
      E(g, 60, 36, 8, 7, .3); g.fillStyle = '#d89a5a'; g.fill();
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(50 + s * 18, 26); g.quadraticCurveTo(50 + s * 34, 30, 50 + s * 30, 54); g.quadraticCurveTo(50 + s * 24, 56, 50 + s * 20, 44); g.closePath(); fillOl(g, '#b8784a', 50 + s * 26, 36, 12, 2.2); }
      E(g, 50, 51, 11, 7.6); g.fillStyle = '#fff8ee'; g.fill();
      petEyes(g, 50, 40, 9.5, 3.8, '#8a5a3a'); E(g, 50, 47, 4.4, 3.2); g.fillStyle = INK; g.fill(); dot(g, 49, 46, 1.1, '#fff');
      g.beginPath(); g.moveTo(50, 50); g.quadraticCurveTo(46, 54, 43, 52); g.moveTo(50, 50); g.quadraticCurveTo(54, 54, 57, 52); stroke(g, INK, 1.4);
      E(g, 50, 55, 3, 3.4); g.fillStyle = '#ff7a9a'; g.fill(); petBlush(g, 50, 49, 15);
    },
    janku(g) { // a white bunny with long ears and a grey nose patch
      E(g, 74, 84, 7, 6); fillOl(g, '#ffffff', 74, 82, 6, 2);
      E(g, 50, 78, 23, 19); fillOl(g, '#f6f4fb', 44, 72, 26, 2.4);
      for (const s of [-1, 1]) { E(g, 50 + s * 10, 95, 8, 4.2); fillOl(g, '#ffffff', 50 + s * 10, 94, 6, 2); }
      for (const s of [-1, 1]) { g.save(); g.translate(50 + s * 9, 28); g.rotate(s * .18); E(g, 0, -12, 6.4, 14.5); fillOl(g, '#f6f4fb', 0, -14, 13, 2.2); E(g, 0, -11, 3.4, 10); g.fillStyle = '#ffc2d6'; g.fill(); g.restore(); }
      E(g, 50, 46, 23, 20); fillOl(g, '#f6f4fb', 42, 38, 26, 2.4);
      E(g, 50, 53, 9, 6.6); g.fillStyle = '#e4e0ee'; g.fill();
      petEyes(g, 50, 44, 10, 3.6, '#ff6b9a'); E(g, 50, 50.4, 2.6, 2); g.fillStyle = '#ff8fb0'; g.fill(); g.lineWidth = 1; g.strokeStyle = INK; g.stroke();
      g.beginPath(); g.moveTo(50, 52.4); g.lineTo(50, 54.6); g.moveTo(50, 54.6); g.quadraticCurveTo(47.4, 57, 45.4, 55.4); g.moveTo(50, 54.6); g.quadraticCurveTo(52.6, 57, 54.6, 55.4); stroke(g, INK, 1.3);
      R(g, 48, 55.6, 4, 3.4, .8); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = .8; g.strokeStyle = INK; g.stroke();
      petBlush(g, 50, 52, 15);
    }
  };
  const PET_NECK = { muri: 62, kutsu: 62, janku: 64 };
  function petAcc(g, kind, a) {
    if (a === 'bow') {
      const x = kind === 'janku' ? 62 : 66, y = kind === 'janku' ? 26 : 22;
      for (const s of [-1, 1]) { PL(g, [x, y, x + s * 10, y - 6, x + s * 10, y + 6]); g.closePath(); fillOl(g, '#ff4f9a', x + s * 5, y, 8, 1.8); }
      dot(g, x, y, 3.2, '#ff7ab6'); g.beginPath(); g.arc(x, y, 3.2, 0, TAU); ol(g, 1.4);
    } else if (a === 'collar') {
      const y = PET_NECK[kind]; g.beginPath(); g.moveTo(32, y - 2); g.quadraticCurveTo(50, y + 6, 68, y - 2); g.lineWidth = 6; g.strokeStyle = INK; g.stroke(); g.lineWidth = 4; g.strokeStyle = '#ff5a5f'; g.stroke();
      dot(g, 50, y + 6, 4.4, INK); dot(g, 50, y + 6, 3.4, '#ffd23f'); pstar(g, 50, y + 6, 2); g.fillStyle = '#fff6c0'; g.fill();
    } else if (a === 'hat') { // a tiny striped party hat with a pompom
      const y = kind === 'janku' ? 28 : 24, x = kind === 'janku' ? 50 : 44;
      g.save(); g.translate(x, y); g.rotate(-.15); if (kind !== 'janku') g.scale(.85, .85); PL(g, [-9, 0, 9, 0, 0, -22]); g.closePath(); fillOl(g, '#7fd0ff', 0, -8, 10, 1.8);
      g.save(); PL(g, [-9, 0, 9, 0, 0, -22]); g.clip(); for (let i = 0; i < 3; i++) { g.fillStyle = '#ffffff'; g.fillRect(-10, -5 - i * 7, 20, 2.6); } g.restore();
      dot(g, 0, -23, 4, INK); dot(g, 0, -23, 3, '#ff4f9a'); g.restore();
    }
  }
  const _pc = {};
  A.pet = function (kind, px, a) {
    px = Math.max(16, Math.round(px || 96)); kind = kind === 'jänku' ? 'janku' : pick(kind, A.petKinds); a = pick(a, A.petAccs);
    const key = kind + '|' + px + '|' + a; let c = _pc[key]; if (c) return c;
    c = _pc[key] = mk(px, px); const g = c.getContext('2d'); g.scale(px / 100, px / 100);
    try { E(g, 50, 98, 26, 3.4); g.fillStyle = 'rgba(70,50,140,.16)'; g.fill(); PET[kind](g); petAcc(g, kind, a); } catch (e) { console.error('ART.pet', key, e); }
    return c;
  };
  // ---------- style chips ----------
  const _sw = {};
  A.styleSwatch = function (key, px) {
    px = Math.max(12, Math.round(px || 48)); const k = key + '|' + px; let c = _sw[k]; if (c) return c;
    c = _sw[k] = mk(px, px); const g = c.getContext('2d'); g.scale(px / 100, px / 100);
    try {
      const SP = A.stylePal || {}, P = SP[key] || { a: '#cccccc', b: '#eeeeee', c: '#888888', d: '#ffffff' };
      E(g, 50, 53, 46, 46); g.fillStyle = 'rgba(60,40,120,.2)'; g.fill();
      g.save(); E(g, 50, 50, 46, 46); g.clip();
      const gr = g.createLinearGradient(0, 4, 0, 96);
      if (key === 'boho') { gr.addColorStop(0, '#f6e2c4'); gr.addColorStop(1, '#e8b88a'); }
      else if (key === 'minimal') { gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#e8ebf0'); }
      else { gr.addColorStop(0, '#fff0f4'); gr.addColorStop(1, '#ffc2d4'); }
      g.fillStyle = gr; g.fillRect(0, 0, 100, 100);
      if (key === 'boho') { // a rainbow arch, pampas plumes and a fringe
        for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(50, 74, 32 - i * 9, PI, 0); g.lineWidth = 8; g.strokeStyle = ['#d9825b', '#ecc27a', '#8fae86'][i]; g.lineCap = 'butt'; g.stroke(); }
        for (const [x, a] of [[22, -.4], [30, -.15], [78, .3]]) { g.beginPath(); g.moveTo(x, 90); g.lineTo(x + Math.sin(a) * 30, 60); stroke(g, '#b8a070', 1.6); E(g, x + Math.sin(a) * 30, 54, 5, 12, a); g.fillStyle = '#fff4e0'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = '#c8a878'; g.stroke(); }
        for (let x = 20; x < 82; x += 5) { g.beginPath(); g.moveTo(x, 80); g.lineTo(x, 90); stroke(g, '#b7865c', 2); }
        R(g, 16, 76, 68, 5, 2); g.fillStyle = '#b7865c'; g.fill();
      } else if (key === 'minimal') { // clean geometry: a circle, a line and one leaf
        g.beginPath(); g.arc(40, 46, 18, 0, TAU); g.fillStyle = '#e2e5ec'; g.fill();
        g.beginPath(); g.moveTo(22, 74); g.lineTo(78, 74); stroke(g, '#3a4150', 3);
        R(g, 56, 52, 14, 22, 2); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 2.4; g.strokeStyle = '#3a4150'; g.stroke();
        for (const [dx, h] of [[-3, 26], [2, 32], [6, 22]]) { PL(g, [63 + dx - 2.4, 52, 63 + dx, 52 - h, 63 + dx + 2.4, 52]); g.fillStyle = '#3f8a5a'; g.fill(); }
      } else { // romantic: a big heart, two roses and lace scallops
        heart(g, 50, 54, 26); g.fillStyle = '#ff8fb0'; g.fill(); g.lineWidth = 2.4; g.strokeStyle = '#c05a7a'; g.stroke(); HL(g, 40, 42, 6, 3.6, -.6, .6);
        for (const [x, y] of [[26, 72], [74, 72]]) { E(g, x, y, 8, 7); g.fillStyle = '#ffd0dc'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = '#c05a7a'; g.stroke(); g.beginPath(); g.arc(x, y, 4, .5, PI * 1.8); stroke(g, '#ec5f86', 1.4); E(g, x + (x < 50 ? 8 : -8), y + 5, 5, 2.6, x < 50 ? .5 : -.5); g.fillStyle = '#6ab86a'; g.fill(); }
        for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(8 + i * 12, 96, 6, PI, 0); g.fillStyle = '#ffffff'; g.fill(); }
      }
      g.restore();
      E(g, 50, 50, 45, 45); g.lineWidth = 5; g.strokeStyle = '#ffffff'; g.stroke();
      E(g, 50, 50, 47.6, 47.6); g.lineWidth = 1.6; g.strokeStyle = rgba(INK, .55); g.stroke();
      g.save(); E(g, 50, 50, 43, 43); g.clip(); E(g, 34, 20, 22, 9, -.5); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill(); g.restore();
    } catch (e) { console.error('ART.styleSwatch', k, e); }
    return c;
  };
})(ART);
