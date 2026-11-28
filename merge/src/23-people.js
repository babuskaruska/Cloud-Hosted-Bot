// ===== ART portraits (Ash): head-and-shoulders busts for dialogue, in a 100x100 box. =====
// ART.portrait(who, px, opts) -> cached canvas. who: 'maali' | 'ants' | 'muri' | 'liisa' | 'peeter' | 'mina'.
// opts.frame (default true): a soft round backdrop in the character's colour; opts.mood: 'happy' (default) | 'wow' | 'sad'.
(function () {
  const A = ART, { E, R, PL, SM, paint, flat, stroke, HL, dot, spark, star, pstar, heart, lt, dk, rgba, mk } = A.H;
  const PI = Math.PI, TAU = PI * 2;
  const SKIN = '#f6d2b8', SKIN2 = '#efc2a0';
  function eyes(g, cx, cy, sp, r, mood, closed) {
    for (const s of [-1, 1]) {
      const x = cx + s * sp;
      if (closed || mood === 'happy2') { g.beginPath(); g.arc(x, cy + r * .4, r * .9, PI * 1.15, PI * 1.85); stroke(g, '#3a2418', r * .55); continue; }
      E(g, x, cy, r * .82, r * (mood === 'wow' ? 1.25 : 1.05)); g.fillStyle = '#3a2418'; g.fill();
      dot(g, x + r * .28, cy - r * .38, r * .34, '#ffffff'); dot(g, x - r * .25, cy + r * .4, r * .14, 'rgba(255,255,255,.8)');
      if (mood === 'sad') { g.beginPath(); g.moveTo(x - s * r * 1.2, cy - r * 1.9); g.lineTo(x + s * r * .8, cy - r * 1.4); stroke(g, '#5a3a2a', r * .4); }
    }
  }
  function brows(g, cx, cy, sp, w, col, lift) { for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * (sp - w), cy + (lift || 0)); g.quadraticCurveTo(cx + s * sp, cy - 2.4, cx + s * (sp + w), cy); stroke(g, col, 2.4); } }
  function mouth(g, x, y, w, mood) {
    if (mood === 'wow') { E(g, x, y + 1, w * .32, w * .4); flat(g, '#9a3a3a', 1.6, '#5a2418'); return; }
    if (mood === 'sad') { g.beginPath(); g.arc(x, y + w * .5, w * .45, PI * 1.2, PI * 1.8); stroke(g, '#5a2418', 2); return; }
    g.beginPath(); g.moveTo(x - w * .5, y); g.quadraticCurveTo(x, y + w * .6, x + w * .5, y); g.closePath(); flat(g, '#b8484a', 1.6, '#5a2418');
    E(g, x, y + w * .3, w * .22, w * .1); g.fillStyle = '#f08a8a'; g.fill();
  }
  function blush(g, cx, cy, sp, a) { for (const s of [-1, 1]) { E(g, cx + s * sp, cy, 5, 3); g.fillStyle = 'rgba(240,110,110,' + (a || .35) + ')'; g.fill(); } }
  function head(g, cx, cy, rx, ry, skin) { E(g, cx, cy, rx, ry); paint(g, skin || SKIN, cx - 4, cy - 6, Math.max(rx, ry) * 1.1, 3.4); }
  function ear(g, x, y, skin) { E(g, x, y, 4.5, 6); paint(g, skin || SKIN2, x, y, 6, 3); }
  function nose(g, x, y) { g.beginPath(); g.arc(x, y, 2.2, PI * .1, PI * .9); stroke(g, '#c98a6a', 1.8); }
  function shoulders(g, col, neck) {
    if (neck !== false) { R(g, 43, 62, 14, 14, 4); paint(g, SKIN2, 50, 68, 8, 3); }
    g.beginPath(); g.moveTo(10, 102); g.bezierCurveTo(12, 78, 30, 70, 50, 70); g.bezierCurveTo(70, 70, 88, 78, 90, 102); g.closePath(); paint(g, col, 40, 78, 40, 3.6);
  }

  const P = {};
  P.maali = { bg: '#f3d6e4', draw(g, m) { // grandma: silver bun, round glasses, lilac cardigan, warm smile
    E(g, 50, 16, 13, 10); paint(g, '#e8e4ee', 46, 12, 13, 3.4); g.beginPath(); g.arc(50, 18, 9, PI * 1.1, PI * 1.9); stroke(g, '#c9c2d4', 1.6);
    shoulders(g, '#a98bd0');
    g.beginPath(); g.moveTo(40, 72); g.lineTo(50, 92); g.lineTo(60, 72); stroke(g, '#8a6ab8', 3); for (let i = 0; i < 3; i++) dot(g, 50 + (i - 1) * .01, 80 + i * 7, 2, '#fff6e6');
    pstar(g, 32, 84, 4); flat(g, '#f2c14b', 1.6, '#8a5a12');
    ear(g, 27, 48); ear(g, 73, 48); dot(g, 27, 55, 1.8, '#f6f0ff');
    head(g, 50, 46, 23, 22);
    g.beginPath(); g.moveTo(27, 46); g.bezierCurveTo(24, 20, 76, 20, 73, 46); g.bezierCurveTo(66, 32, 58, 28, 50, 32); g.bezierCurveTo(42, 28, 34, 32, 27, 46); g.closePath(); paint(g, '#ebe7f0', 44, 30, 26, 3.2);
    g.beginPath(); g.moveTo(50, 30); g.quadraticCurveTo(44, 26, 36, 32); stroke(g, '#c9c2d4', 1.4);
    eyes(g, 50, 48, 9, 2.6, m === 'happy' ? 'happy2' : m);
    for (const s of [-1, 1]) { E(g, 50 + s * 9.5, 48, 7, 6.2); g.lineWidth = 1.8; g.strokeStyle = '#a0763a'; g.stroke(); g.fillStyle = 'rgba(255,255,255,.18)'; g.fill(); }
    g.beginPath(); g.moveTo(46.5, 47); g.quadraticCurveTo(50, 45, 53.5, 47); stroke(g, '#a0763a', 1.6);
    brows(g, 50, 39, 10, 4, '#b8b0c4'); nose(g, 50, 54); mouth(g, 50, 59, 9, m); blush(g, 50, 57, 14, .4);
  } };
  P.ants = { bg: '#cfe4f2', draw(g, m) { // fisherman: navy knit cap, big ginger-grey beard, cable sweater
    shoulders(g, '#3f5f8f', false);
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(24 + i * 17, 82); g.bezierCurveTo(20 + i * 17, 90, 28 + i * 17, 94, 24 + i * 17, 102); stroke(g, '#5a7aaa', 2.4); }
    ear(g, 26, 48); ear(g, 74, 48);
    head(g, 50, 47, 24, 23, '#f0c4a4');
    SM(g, [27, 48, 30, 64, 40, 76, 50, 80, 60, 76, 70, 64, 73, 48, 66, 56, 58, 60, 50, 58, 42, 60, 34, 56]); paint(g, '#c98a5a', 44, 62, 26, 3.2);
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(36 + i * 7, 64); g.quadraticCurveTo(37 + i * 7, 70, 35 + i * 7, 74); stroke(g, '#a86a3a', 1.2, .7); }
    SM(g, [38, 59, 44, 56, 50, 58, 56, 56, 62, 59, 56, 62, 50, 61, 44, 62]); paint(g, '#b8784a', 50, 58, 12, 2);
    mouth(g, 50, 63, 7, m);
    g.beginPath(); g.moveTo(24, 40); g.bezierCurveTo(22, 12, 78, 12, 76, 40); g.closePath(); paint(g, '#2f4a7a', 44, 22, 30, 3.4);
    R(g, 22, 34, 56, 10, 5); paint(g, '#3f5f8f', 50, 38, 28, 3.2); for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(26 + i * 6, 35); g.lineTo(26 + i * 6, 43); stroke(g, '#2a4470', 1.2, .8); }
    eyes(g, 50, 50, 9, 2.6, m); brows(g, 50, 44, 10, 5, '#a86a3a'); g.beginPath(); g.arc(50, 54, 3.2, 0, TAU); g.fillStyle = '#e8a080'; g.fill(); blush(g, 50, 55, 15, .45);
  } };
  P.muri = { bg: '#fbe2c4', draw(g, m) { // the café cat: round ginger, white muzzle, blue bandana
    E(g, 50, 92, 30, 20); paint(g, '#f0a24a', 44, 86, 30, 3.4);
    PL(g, [24, 34, 26, 8, 44, 24]); paint(g, '#f0a24a', 30, 22, 14, 3.4); PL(g, [76, 34, 74, 8, 56, 24]); paint(g, '#f0a24a', 70, 22, 14, 3.4);
    PL(g, [28, 28, 29, 15, 39, 25]); flat(g, '#f7b8b0', 0); PL(g, [72, 28, 71, 15, 61, 25]); flat(g, '#f7b8b0', 0);
    E(g, 50, 50, 30, 26); paint(g, '#f0a24a', 42, 40, 32, 3.6);
    for (const [x, r] of [[50, 0], [42, -.2], [58, .2]]) { g.save(); g.translate(x, 26); g.rotate(r); R(g, -1.5, 0, 3, 9, 1.5); flat(g, '#d9782a', 0); g.restore(); }
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(50 + s * 30, 46); g.lineTo(50 + s * 23, 48); g.moveTo(50 + s * 30, 54); g.lineTo(50 + s * 23, 53); stroke(g, '#d9782a', 2.2); }
    E(g, 44, 60, 9, 7); flat(g, '#fff6ea', 0); E(g, 56, 60, 9, 7); flat(g, '#fff6ea', 0);
    eyes(g, 50, 47, 11, 3.6, m);
    PL(g, [47, 55, 53, 55, 50, 58]); flat(g, '#e27a7a', 1.2, '#8a3a2a');
    g.beginPath(); g.moveTo(50, 58); g.lineTo(50, 60); g.moveTo(50, 60); g.quadraticCurveTo(46, 64, 43, 61); g.moveTo(50, 60); g.quadraticCurveTo(54, 64, 57, 61); stroke(g, '#8a3a2a', 1.6);
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(50 + s * 12, 59 + i * 3); g.lineTo(50 + s * 30, 56 + i * 7); stroke(g, '#ffffff', 1.2, .9); }
    blush(g, 50, 56, 17, .45);
    g.beginPath(); g.moveTo(28, 72); g.quadraticCurveTo(50, 80, 72, 72); g.lineTo(58, 92); g.lineTo(50, 82); g.lineTo(42, 92); g.closePath(); paint(g, '#5b86e0', 46, 76, 20, 3);
    for (let i = 0; i < 4; i++) dot(g, 38 + i * 8, 76 + (i % 2) * 2, 1.6, '#ffffff');
  } };
  P.liisa = { bg: '#d8efd0', draw(g, m) { // shopkeeper: blond braids, freckles, flower crown, green dress with apron
    for (const s of [-1, 1]) { for (let i = 0; i < 4; i++) { E(g, 50 + s * 24, 58 + i * 8, 5.2, 5); paint(g, '#f2cf6a', 50 + s * 24, 56 + i * 8, 6, 2.6); } dot(g, 50 + s * 24, 90, 3, '#e2574c'); }
    shoulders(g, '#5fae6a');
    g.beginPath(); g.moveTo(34, 78); g.lineTo(66, 78); g.lineTo(70, 102); g.lineTo(30, 102); g.closePath(); paint(g, '#fff6e6', 50, 86, 20, 3);
    for (let i = 0; i < 3; i++) { heart(g, 40 + i * 10, 92, 3); g.fillStyle = '#f29aa8'; g.fill(); }
    ear(g, 27, 48); ear(g, 73, 48);
    head(g, 50, 47, 22, 22);
    g.beginPath(); g.moveTo(27, 50); g.bezierCurveTo(22, 18, 78, 18, 73, 50); g.bezierCurveTo(70, 36, 62, 30, 52, 31); g.quadraticCurveTo(44, 38, 34, 38); g.quadraticCurveTo(29, 42, 27, 50); g.closePath(); paint(g, '#f2cf6a', 44, 30, 26, 3.2);
    g.beginPath(); g.moveTo(52, 31); g.quadraticCurveTo(46, 34, 40, 34); stroke(g, '#d9a83a', 1.4);
    const cols = ['#f58aa0', '#fff', '#5b86e0', '#f7d24c', '#f58aa0', '#fff'];
    for (let i = 0; i < 6; i++) { const a = PI * 1.12 + i * PI * .76 / 5, x = 50 + Math.cos(a) * 23, y = 44 + Math.sin(a) * 21; for (let k = 0; k < 5; k++) dot(g, x + Math.cos(k * 1.26) * 2.4, y + Math.sin(k * 1.26) * 2.4, 2.2, cols[i]); dot(g, x, y, 1.5, '#f6c33b'); }
    eyes(g, 50, 49, 9, 2.7, m); brows(g, 50, 42, 9.5, 3.6, '#c9963a');
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) dot(g, 50 + s * (12 + i * 2.4), 55 + (i % 2) * 1.6, .9, '#d9906a');
    nose(g, 50, 54); mouth(g, 50, 59, 8, m); blush(g, 50, 56, 13, .4);
  } };
  P.peeter = { bg: '#f6e0c4', draw(g, m) { // lighthouse keeper: white cap with anchor, grey mustache, navy coat, gold buttons
    shoulders(g, '#2f4a7a');
    g.beginPath(); g.moveTo(40, 70); g.lineTo(50, 84); g.lineTo(60, 70); g.closePath(); flat(g, '#fff6e6', 2, '#8a8a8a');
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) dot(g, 50 + s * 11, 84 + i * 9, 2.4, '#f2c14b');
    ear(g, 28, 50); ear(g, 72, 50);
    head(g, 50, 50, 21, 23);
    g.beginPath(); g.moveTo(29, 48); g.quadraticCurveTo(28, 40, 32, 36); g.lineTo(34, 46); g.closePath(); paint(g, '#c9c4bc', 30, 42, 8, 2.4);
    g.beginPath(); g.moveTo(71, 48); g.quadraticCurveTo(72, 40, 68, 36); g.lineTo(66, 46); g.closePath(); paint(g, '#c9c4bc', 70, 42, 8, 2.4);
    R(g, 26, 30, 48, 8, 3); paint(g, '#2a2a3a', 50, 34, 24, 3);
    g.beginPath(); g.moveTo(24, 31); g.bezierCurveTo(20, 10, 80, 10, 76, 31); g.closePath(); paint(g, '#fbf8f2', 44, 18, 30, 3.4);
    E(g, 50, 24, 6, 5); flat(g, '#f2c14b', 1.4, '#8a5a12'); g.beginPath(); g.moveTo(50, 21); g.lineTo(50, 27); g.moveTo(47, 26); g.quadraticCurveTo(50, 28, 53, 26); stroke(g, '#8a5a12', 1.2);
    E(g, 50, 39, 24, 4); paint(g, '#2a2a3a', 50, 39, 24, 2.6);
    eyes(g, 50, 50, 9, 2.4, m); brows(g, 50, 44, 9.5, 5, '#a8a29a', -1);
    nose(g, 50, 56);
    SM(g, [36, 61, 44, 57, 50, 59, 56, 57, 64, 61, 58, 64, 50, 62, 42, 64]); paint(g, '#c9c4bc', 50, 60, 14, 2.4);
    mouth(g, 50, 65, 6, m); blush(g, 50, 58, 14, .35);
  } };
  P.mina = { bg: '#fde3c8', draw(g, m) { // you: wavy brown hair with bangs, cream sweater with a folk-pattern collar, flower clip
    g.beginPath(); g.moveTo(24, 46); g.bezierCurveTo(20, 66, 22, 76, 30, 80); g.lineTo(70, 80); g.bezierCurveTo(78, 76, 80, 66, 76, 46); g.closePath(); paint(g, '#8a5034', 48, 60, 30, 3.2);
    shoulders(g, '#f6ead6');
    g.beginPath(); g.moveTo(30, 76); g.quadraticCurveTo(50, 84, 70, 76); g.lineTo(72, 84); g.quadraticCurveTo(50, 92, 28, 84); g.closePath(); paint(g, '#e2574c', 50, 82, 22, 2.6);
    for (let i = 0; i < 6; i++) { const x = 33 + i * 7, y = 81 + Math.sin(i / 5 * PI) * 4; star(g, x, y, 2.4, 1, 4, 0); g.fillStyle = '#fff6e6'; g.fill(); }
    ear(g, 28, 50); ear(g, 72, 50);
    head(g, 50, 48, 22, 22);
    g.beginPath(); g.moveTo(27, 52); g.bezierCurveTo(20, 16, 80, 16, 73, 52); g.quadraticCurveTo(70, 40, 64, 36); g.quadraticCurveTo(60, 42, 56, 38); g.quadraticCurveTo(52, 43, 47, 38); g.quadraticCurveTo(42, 43, 38, 37); g.quadraticCurveTo(32, 42, 27, 52); g.closePath(); paint(g, '#9a5a3a', 44, 30, 26, 3.2);
    g.beginPath(); g.moveTo(40, 26); g.quadraticCurveTo(48, 22, 58, 26); stroke(g, '#c47a52', 2, .7);
    for (let k = 0; k < 5; k++) dot(g, 68 + Math.cos(k * 1.26) * 3, 32 + Math.sin(k * 1.26) * 3, 2.6, '#fff6e6'); dot(g, 68, 32, 1.8, '#f6c33b');
    eyes(g, 50, 50, 9, 2.8, m); brows(g, 50, 43, 9.5, 3.4, '#6a3a24');
    nose(g, 50, 55); mouth(g, 50, 60, 8, m); blush(g, 50, 57, 13, .4);
  } };
  A.people = Object.keys(P);

  const cache = {};
  A.portrait = function (who, px, opts) {
    px = Math.round(px || 96); opts = opts || {}; const frame = opts.frame !== false, mood = opts.mood || 'happy';
    const k = who + '|' + px + '|' + frame + '|' + mood; let c = cache[k]; if (c) return c;
    c = cache[k] = mk(px, px); const g = c.getContext('2d'); g.scale(px / 100, px / 100);
    const p = P[who] || P.mina;
    if (frame) {
      g.save(); E(g, 50, 50, 48, 48); g.clip();
      const gr = g.createRadialGradient(42, 36, 6, 50, 50, 56); gr.addColorStop(0, lt(p.bg, .5)); gr.addColorStop(1, p.bg); g.fillStyle = gr; g.fillRect(0, 0, 100, 100);
      for (let i = 0; i < 6; i++) { const a = i * 1.05 + .3; spark(g, 50 + Math.cos(a) * 38, 50 + Math.sin(a) * 38, 2.4, '#ffffff', .6); }
      try { p.draw(g, mood); } catch (e) { console.error('ART.portrait', who, e); }
      g.restore();
      E(g, 50, 50, 47, 47); g.lineWidth = 3.6; g.strokeStyle = dk(p.bg, .55); g.stroke();
      E(g, 50, 50, 44, 44); g.lineWidth = 1.4; g.strokeStyle = 'rgba(255,255,255,.7)'; g.stroke();
    } else { try { p.draw(g, mood); } catch (e) { console.error('ART.portrait', who, e); } }
    return c;
  };
})();
