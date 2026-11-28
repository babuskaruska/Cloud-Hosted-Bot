// ===== ART portraits (Ash): cute modern head-and-shoulders busts for dialogue, in a 100x100 box. =====
// ART.portrait(who, px, opts) -> cached canvas. who: 'maali' | 'ants' | 'muri' | 'liisa' | 'peeter' | 'mina'.
// opts.frame (default true): a glossy round badge in the character's colour; opts.mood: 'happy' (default) | 'wow' | 'sad'.
// Style: big heads, big sparkly eyes with coloured irises, rosy cheeks, clean plum outlines, bright trendy outfits.
(function () {
  const A = ART, { E, R, PL, SM, paint, flat, stroke, HL, dot, star, pstar, heart, lt, dk, rgba, mk } = A.H;
  const PI = Math.PI, TAU = PI * 2, INK = '#3a2358';
  const SKIN = '#ffd9c2', SKIN2 = '#f7c2a4';
  // big anime-ish eyes: white sclera hidden, dark outline, coloured iris, two highlights; 'happy2' = closed smile arcs
  function eyes(g, cx, cy, sp, r, iris, mood) {
    for (const s of [-1, 1]) {
      const x = cx + s * sp;
      if (mood === 'happy2') { g.beginPath(); g.arc(x, cy + r * .5, r * .95, PI * 1.12, PI * 1.88); stroke(g, INK, r * .5); continue; }
      const ry = r * (mood === 'wow' ? 1.38 : 1.22);
      E(g, x, cy, r * .95, ry); g.fillStyle = INK; g.fill();
      E(g, x, cy + ry * .18, r * .72, ry * .72); const gr = g.createLinearGradient(0, cy - ry, 0, cy + ry); gr.addColorStop(0, dk(iris, .2)); gr.addColorStop(1, lt(iris, .35)); g.fillStyle = gr; g.fill();
      E(g, x, cy + ry * .12, r * .38, ry * .42); g.fillStyle = INK; g.fill();
      dot(g, x + r * .32, cy - ry * .38, r * .38, '#ffffff'); dot(g, x - r * .3, cy + ry * .42, r * .16, 'rgba(255,255,255,.9)');
      // lashes
      g.beginPath(); g.moveTo(x + s * r * .85, cy - ry * .55); g.lineTo(x + s * r * 1.35, cy - ry * .85); stroke(g, INK, r * .28);
      if (mood === 'sad') { g.beginPath(); g.moveTo(x - s * r * 1.2, cy - ry * 1.7); g.lineTo(x + s * r * .8, cy - ry * 1.3); stroke(g, INK, r * .35); }
    }
  }
  function brows(g, cx, cy, sp, w, col) { for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * (sp - w), cy + .6); g.quadraticCurveTo(cx + s * sp, cy - 2.2, cx + s * (sp + w), cy); stroke(g, col, 2.6); } }
  function mouth(g, x, y, w, mood) {
    if (mood === 'wow') { E(g, x, y + 1.5, w * .3, w * .38); flat(g, '#c2365a', 1.8, INK); E(g, x, y + 3, w * .18, w * .12); g.fillStyle = '#ff8fa8'; g.fill(); return; }
    if (mood === 'sad') { g.beginPath(); g.arc(x, y + w * .5, w * .42, PI * 1.2, PI * 1.8); stroke(g, INK, 2.2); return; }
    g.beginPath(); g.moveTo(x - w * .55, y); g.quadraticCurveTo(x, y + w * .75, x + w * .55, y); g.closePath(); flat(g, '#c2365a', 1.8, INK);
    g.save(); g.clip(); E(g, x, y + w * .55, w * .3, w * .22); g.fillStyle = '#ff8fa8'; g.fill(); R(g, x - w * .4, y - 1, w * .8, w * .18, 1); g.fillStyle = '#fff'; g.fill(); g.restore();
  }
  function blush(g, cx, cy, sp) { for (const s of [-1, 1]) { E(g, cx + s * sp, cy, 6, 3.6); g.fillStyle = 'rgba(255,110,150,.42)'; g.fill(); for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(cx + s * sp - 3 + i * 2.6, cy - 1.4); g.lineTo(cx + s * sp - 4.2 + i * 2.6, cy + 1.6); stroke(g, '#ff7aa0', .9, .7); } } }
  function head(g, cx, cy, rx, ry, skin) { // soft rounded chin
    g.beginPath(); g.moveTo(cx - rx, cy - ry * .1); g.bezierCurveTo(cx - rx, cy - ry * 1.15, cx + rx, cy - ry * 1.15, cx + rx, cy - ry * .1);
    g.bezierCurveTo(cx + rx, cy + ry * .75, cx + rx * .35, cy + ry, cx, cy + ry); g.bezierCurveTo(cx - rx * .35, cy + ry, cx - rx, cy + ry * .75, cx - rx, cy - ry * .1); g.closePath();
    paint(g, skin || SKIN, cx - 5, cy - 8, Math.max(rx, ry) * 1.15, 2.6); g.strokeStyle = INK; g.lineWidth = 2.6; g.stroke();
  }
  function ear(g, x, y, skin) { E(g, x, y, 4.4, 6); paint(g, skin || SKIN2, x, y, 6, 0); g.lineWidth = 2.2; g.strokeStyle = INK; g.stroke(); }
  function nose(g, x, y) { E(g, x, y, 1.6, 1.1); g.fillStyle = '#e8957a'; g.fill(); }
  function body(g, col, neck, skin) {
    if (neck !== false) { R(g, 44, 64, 12, 12, 4); paint(g, skin || SKIN2, 50, 68, 8, 0); }
    g.beginPath(); g.moveTo(8, 104); g.bezierCurveTo(10, 80, 28, 72, 50, 72); g.bezierCurveTo(72, 72, 90, 80, 92, 104); g.closePath(); paint(g, col, 40, 78, 44, 0); g.lineWidth = 2.6; g.strokeStyle = INK; g.stroke();
  }
  function hair(g, pts, col, cx, cy) { SM(g, pts); paint(g, col, cx || 40, cy || 26, 34, 0); g.lineWidth = 2.6; g.strokeStyle = INK; g.stroke(); }
  function shine(g, x, y, w) { g.beginPath(); g.moveTo(x - w, y + 2); g.quadraticCurveTo(x, y - 3, x + w, y + 2); stroke(g, '#ffffff', 2.6, .6); }

  const P = {};
  P.mina = { bg: '#ffd0e4', draw(g, m) { // you: chestnut messy high bun with a coral scrunchie, bangs, gold hoops, mint café apron over a striped tee
    E(g, 50, 13, 13, 11); paint(g, '#8a4a30', 46, 9, 13, 0); g.lineWidth = 2.6; g.strokeStyle = INK; g.stroke(); shine(g, 46, 9, 5);
    R(g, 40, 20, 20, 6, 3); paint(g, '#ff7a6b', 50, 22, 10, 0); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
    body(g, '#ffffff');
    g.save(); g.beginPath(); g.moveTo(8, 104); g.bezierCurveTo(10, 80, 28, 72, 50, 72); g.bezierCurveTo(72, 72, 90, 80, 92, 104); g.closePath(); g.clip();
    for (let i = 0; i < 4; i++) { g.fillStyle = '#7fb8ff'; g.fillRect(0, 80 + i * 7, 100, 3); } g.restore();
    g.beginPath(); g.moveTo(34, 80); g.lineTo(66, 80); g.lineTo(70, 104); g.lineTo(30, 104); g.closePath(); paint(g, '#5fe0b0', 50, 88, 24, 0); g.lineWidth = 2.4; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.moveTo(36, 80); g.lineTo(34, 72); g.moveTo(64, 80); g.lineTo(66, 72); stroke(g, '#3fc292', 3);
    heart(g, 50, 92, 4); g.fillStyle = '#ff4f9a'; g.fill();
    ear(g, 27, 50); ear(g, 73, 50);
    for (const s of [-1, 1]) { g.beginPath(); g.arc(50 + s * 23, 58, 3.6, 0, TAU); stroke(g, '#ffc21e', 1.8); }
    head(g, 50, 48, 23, 24);
    hair(g, [26, 54, 24, 36, 32, 22, 50, 18, 68, 22, 76, 36, 74, 54, 70, 42, 64, 34, 58, 40, 52, 33, 46, 40, 40, 33, 34, 42, 30, 46], '#9a5636');
    shine(g, 40, 26, 6);
    dot(g, 37, 60, 1.6, 'rgba(255,255,255,.7)'); E(g, 64, 58, 3, 1.6, -.3); g.fillStyle = 'rgba(255,255,255,.8)'; g.fill(); // flour smudge
    eyes(g, 50, 51, 9.5, 3.4, '#4aa87a', m); brows(g, 50, 42, 9.5, 3.6, '#6a3a24');
    nose(g, 50, 57); mouth(g, 50, 62, 8, m); blush(g, 50, 59, 14);
  } };
  P.maali = { bg: '#d9c8ff', draw(g, m) { // fun modern grandma: silver bob with a pink streak, big round coral glasses, pearl earrings, sunny cardigan
    body(g, '#ffc83d');
    g.beginPath(); g.moveTo(40, 74); g.lineTo(50, 96); g.lineTo(60, 74); stroke(g, '#ff8a3d', 3); for (let i = 0; i < 3; i++) dot(g, 50, 82 + i * 7, 2.2, '#ffffff');
    for (let i = 0; i < 9; i++) { const a = PI * .15 + i * PI * .7 / 8; dot(g, 50 + Math.cos(a) * 15, 66 + Math.sin(a) * 8, 2.4, '#fff8ff'); }
    ear(g, 27, 50); ear(g, 73, 50); dot(g, 27, 57, 2.8, '#fff8ff');
    head(g, 50, 48, 23, 23);
    hair(g, [22, 60, 20, 36, 30, 20, 50, 15, 70, 20, 80, 36, 78, 60, 73, 46, 66, 34, 56, 32, 46, 38, 36, 32, 28, 44, 26, 58], '#e6e4f4');
    g.beginPath(); g.moveTo(56, 18); g.quadraticCurveTo(66, 22, 70, 32); stroke(g, '#ff7ab6', 4.5); shine(g, 38, 24, 6);
    eyes(g, 50, 50, 10, 3, '#7c5cff', m === 'happy' ? 'happy2' : m);
    for (const s of [-1, 1]) { E(g, 50 + s * 10.5, 50, 8, 7.4); g.lineWidth = 2.8; g.strokeStyle = '#ff5a7a'; g.stroke(); g.fillStyle = 'rgba(255,255,255,.18)'; g.fill(); }
    g.beginPath(); g.moveTo(47, 49); g.quadraticCurveTo(50, 47, 53, 49); stroke(g, '#ff5a7a', 2.2);
    brows(g, 50, 39, 10, 4, '#b8b0d4'); nose(g, 50, 56); mouth(g, 50, 61, 9, m); blush(g, 50, 58, 15);
    // heart sunglasses pushed up in the hair
    for (const s of [-1, 1]) { heart(g, 50 + s * 8, 25, 4.2); g.fillStyle = '#ff4f9a'; g.fill(); g.lineWidth = 1.4; g.strokeStyle = INK; g.stroke(); }
  } };
  P.liisa = { bg: '#c9f3e0', draw(g, m) { // stylish friend and shopkeeper: long wavy pink hair, freckles, sunflower clip, denim jacket over a white tee
    hair(g, [24, 44, 18, 70, 22, 90, 32, 96, 40, 80, 60, 80, 68, 96, 78, 90, 82, 70, 76, 44], '#ff9ccb', 40, 60);
    body(g, '#5f8fe8');
    g.beginPath(); g.moveTo(38, 74); g.lineTo(50, 92); g.lineTo(62, 74); g.closePath(); flat(g, '#ffffff', 2.2, INK);
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(50 + s * 12, 76); g.lineTo(50 + s * 18, 100); stroke(g, '#3f6fc8', 2); dot(g, 50 + s * 22, 88, 1.8, '#ffd23f'); }
    ear(g, 27, 50); ear(g, 73, 50);
    head(g, 50, 48, 22, 23);
    hair(g, [26, 52, 24, 30, 36, 18, 54, 17, 70, 24, 76, 40, 74, 52, 68, 38, 58, 30, 48, 36, 38, 34, 30, 42], '#ff9ccb');
    shine(g, 44, 22, 7);
    for (let k = 0; k < 8; k++) { const a = k * TAU / 8; E(g, 70 + Math.cos(a) * 4.6, 28 + Math.sin(a) * 4.6, 3, 1.8, a); g.fillStyle = '#ffd23f'; g.fill(); } dot(g, 70, 28, 2.8, '#8a4a20');
    eyes(g, 50, 51, 9.5, 3.3, '#ff6b9a', m); brows(g, 50, 42, 9.5, 3.6, '#e0609a');
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) dot(g, 50 + s * (11 + i * 2.6), 56 + (i % 2) * 1.6, .95, '#e08a6a');
    nose(g, 50, 57); mouth(g, 50, 62, 8, m); blush(g, 50, 59, 14);
  } };
  P.ants = { bg: '#bfe6ff', draw(g, m) { // fisherman: mustard beanie, trimmed ginger beard, yellow raincoat collar over a navy hoodie
    body(g, '#2f4f9a');
    g.beginPath(); g.moveTo(22, 82); g.quadraticCurveTo(34, 72, 44, 74); g.lineTo(46, 86); g.closePath(); paint(g, '#ffd23f', 34, 78, 14, 0); g.lineWidth = 2.2; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.moveTo(78, 82); g.quadraticCurveTo(66, 72, 56, 74); g.lineTo(54, 86); g.closePath(); paint(g, '#ffd23f', 66, 78, 14, 0); g.lineWidth = 2.2; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.moveTo(44, 80); g.lineTo(42, 94); g.moveTo(56, 80); g.lineTo(58, 94); stroke(g, '#ffffff', 2);
    ear(g, 26, 50); ear(g, 74, 50);
    head(g, 50, 49, 24, 23, '#ffd2b0');
    SM(g, [27, 50, 30, 64, 40, 74, 50, 77, 60, 74, 70, 64, 73, 50, 66, 58, 58, 62, 50, 60, 42, 62, 34, 58]); paint(g, '#e8834a', 44, 62, 26, 0); g.lineWidth = 2.4; g.strokeStyle = INK; g.stroke();
    E(g, 50, 64, 8, 5); g.fillStyle = '#ffd2b0'; g.fill();
    mouth(g, 50, 63, 7, m);
    g.beginPath(); g.moveTo(24, 40); g.bezierCurveTo(22, 10, 78, 10, 76, 40); g.closePath(); paint(g, '#ffb21e', 44, 22, 32, 0); g.lineWidth = 2.6; g.strokeStyle = INK; g.stroke();
    R(g, 22, 33, 56, 11, 5); paint(g, '#ff9a1e', 50, 38, 28, 0); g.lineWidth = 2.4; g.strokeStyle = INK; g.stroke();
    for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(27 + i * 5.8, 35); g.lineTo(27 + i * 5.8, 42); stroke(g, '#e07a10', 1.3, .8); }
    E(g, 50, 11, 6, 5); paint(g, '#ff5a5f', 50, 10, 6, 0);
    eyes(g, 50, 51, 9.5, 3, '#3db8ff', m); brows(g, 50, 45, 10, 4.4, '#c0602a'); nose(g, 50, 56); blush(g, 50, 56, 15);
  } };
  P.peeter = { bg: '#ffe2b8', draw(g, m) { // lighthouse keeper: captain cap with anchor, fluffy white beard, navy coat, gold buttons
    body(g, '#2c3f86');
    g.beginPath(); g.moveTo(40, 72); g.lineTo(50, 86); g.lineTo(60, 72); g.closePath(); flat(g, '#ffffff', 2, INK);
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { dot(g, 50 + s * 12, 86 + i * 9, 2.8, '#ffc21e'); dot(g, 50 + s * 12 - .8, 85.2 + i * 9, 1, '#fff6c0'); }
    ear(g, 28, 52); ear(g, 72, 52);
    head(g, 50, 51, 22, 23);
    SM(g, [29, 54, 30, 70, 40, 80, 50, 82, 60, 80, 70, 70, 71, 54, 64, 62, 56, 66, 50, 64, 44, 66, 36, 62]); paint(g, '#f4f4fa', 44, 66, 26, 0); g.lineWidth = 2.4; g.strokeStyle = INK; g.stroke();
    SM(g, [38, 62, 44, 59, 50, 61, 56, 59, 62, 62, 56, 65, 50, 63, 44, 65]); paint(g, '#ffffff', 50, 62, 14, 0); g.lineWidth = 1.8; g.strokeStyle = INK; g.stroke();
    mouth(g, 50, 66, 6, m);
    R(g, 25, 30, 50, 9, 4); paint(g, '#232a52', 50, 34, 25, 0);
    g.beginPath(); g.moveTo(23, 32); g.bezierCurveTo(19, 10, 81, 10, 77, 32); g.closePath(); paint(g, '#ffffff', 44, 18, 32, 0); g.lineWidth = 2.6; g.strokeStyle = INK; g.stroke();
    E(g, 50, 24, 6.4, 5.4); paint(g, '#ffc21e', 50, 23, 6, 0); g.lineWidth = 1.6; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.moveTo(50, 21); g.lineTo(50, 27); g.moveTo(47, 26); g.quadraticCurveTo(50, 28, 53, 26); stroke(g, '#8a5a12', 1.3);
    E(g, 50, 39.5, 24, 4.2); paint(g, '#232a52', 50, 39, 24, 0); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
    eyes(g, 50, 51, 9, 2.8, '#3d8bff', m === 'happy' ? 'happy2' : m); brows(g, 50, 45, 9.5, 5, '#d8d4e8'); nose(g, 50, 57); blush(g, 50, 57, 14);
  } };
  P.muri = { bg: '#ffe0a8', draw(g, m) { // the café cat: chubby ginger, huge sparkly eyes, mint bandana
    E(g, 50, 94, 32, 22); paint(g, '#ffa24a', 44, 88, 32, 0); g.lineWidth = 2.6; g.strokeStyle = INK; g.stroke();
    for (const s of [-1, 1]) { PL(g, [50 + s * 27, 34, 50 + s * 25, 6, 50 + s * 7, 22]); paint(g, '#ffa24a', 50 + s * 20, 22, 14, 0); g.lineWidth = 2.6; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke(); PL(g, [50 + s * 23, 28, 50 + s * 22, 13, 50 + s * 12, 23]); g.fillStyle = '#ffb3c6'; g.fill(); }
    E(g, 50, 50, 31, 27); paint(g, '#ffa24a', 42, 40, 34, 0); g.lineWidth = 2.6; g.strokeStyle = INK; g.stroke();
    for (const [x, r] of [[50, 0], [42, -.25], [58, .25]]) { g.save(); g.translate(x, 25); g.rotate(r); R(g, -1.6, 0, 3.2, 9, 1.6); g.fillStyle = '#e8781e'; g.fill(); g.restore(); }
    E(g, 43, 61, 10, 7.5); g.fillStyle = '#fff6ea'; g.fill(); E(g, 57, 61, 10, 7.5); g.fill();
    eyes(g, 50, 48, 12, 4.2, '#2fd59a', m);
    PL(g, [47, 56, 53, 56, 50, 59]); flat(g, '#ff7a9a', 1.4, INK);
    g.beginPath(); g.moveTo(50, 59); g.lineTo(50, 61); g.moveTo(50, 61); g.quadraticCurveTo(46, 65, 43, 62); g.moveTo(50, 61); g.quadraticCurveTo(54, 65, 57, 62); stroke(g, INK, 1.8);
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(50 + s * 14, 60 + i * 3); g.lineTo(50 + s * 32, 57 + i * 7); stroke(g, '#ffffff', 1.4, .95); }
    blush(g, 50, 57, 19);
    g.beginPath(); g.moveTo(26, 72); g.quadraticCurveTo(50, 82, 74, 72); g.lineTo(58, 94); g.lineTo(50, 84); g.lineTo(42, 94); g.closePath(); paint(g, '#5fe0b0', 46, 76, 22, 0); g.lineWidth = 2.2; g.strokeStyle = INK; g.stroke();
    for (let i = 0; i < 4; i++) dot(g, 38 + i * 8, 77 + (i % 2) * 2, 1.8, '#ffffff');
  } };
  A.people = Object.keys(P);

  const cache = {};
  A.portrait = function (who, px, opts) {
    px = Math.round(px || 96); opts = opts || {}; const frame = opts.frame !== false, mood = opts.mood || 'happy';
    const k = who + '|' + px + '|' + frame + '|' + mood; let c = cache[k]; if (c) return c;
    c = cache[k] = mk(px, px); const g = c.getContext('2d'); g.scale(px / 100, px / 100);
    const p = P[who] || P.mina;
    if (frame) {
      E(g, 50, 52, 48, 47); g.fillStyle = rgba(dk(p.bg, .5), .35); g.fill();
      g.save(); E(g, 50, 50, 47, 47); g.clip();
      const gr = g.createLinearGradient(0, 0, 0, 100); gr.addColorStop(0, lt(p.bg, .45)); gr.addColorStop(1, p.bg); g.fillStyle = gr; g.fillRect(0, 0, 100, 100);
      g.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 7; i++) { const a = i * .9 + .4; g.beginPath(); g.arc(50 + Math.cos(a) * 36, 46 + Math.sin(a) * 34, 2.2 + (i % 3), 0, TAU); g.fill(); }
      try { p.draw(g, mood); } catch (e) { console.error('ART.portrait', who, e); }
      g.restore();
      E(g, 50, 50, 46.5, 46.5); g.lineWidth = 4.5; g.strokeStyle = '#ffffff'; g.stroke();
      E(g, 50, 50, 48.6, 48.6); g.lineWidth = 1.6; g.strokeStyle = rgba(INK, .55); g.stroke();
      g.save(); E(g, 50, 50, 44, 44); g.clip(); E(g, 34, 18, 20, 8, -.5); g.fillStyle = 'rgba(255,255,255,.22)'; g.fill(); g.restore();
    } else { try { p.draw(g, mood); } catch (e) { console.error('ART.portrait', who, e); } }
    return c;
  };
})();
