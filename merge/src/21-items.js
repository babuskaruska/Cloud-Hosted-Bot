// ===== ART items (Ash): every chain, generator and special item, drawn in a 100x100 box. =====
(function () {
  const { E, R, PL, SM, paint, flat, vpaint, stroke, line, HL, dot, spark, star, pstar, heart, shadow, srnd, C, lt, dk, mix, rgba } = ART.H;
  const PI = Math.PI, TAU = PI * 2;
  const sh = (g, rx, y) => shadow(g, 50, y || 89, rx || 30, 5.5);

  // ---------- shared little drawers ----------
  function leaf(g, x, y, len, w, rot, col, vein) {
    g.save(); g.translate(x, y); g.rotate(rot);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * .5, -w, len, 0); g.quadraticCurveTo(len * .5, w, 0, 0); g.closePath();
    paint(g, col || C.leaf, len * .45, -w * .2, len * .6, 3);
    if (vein !== false) { g.beginPath(); g.moveTo(len * .1, 0); g.lineTo(len * .8, 0); stroke(g, dk(col || C.leaf, .35), 1.6, .7); }
    g.restore();
  }
  function daisy(g, x, y, r, pet, cen, n) {
    n = n || 9; pet = pet || '#ffffff';
    for (let i = 0; i < n; i++) { const a = i * TAU / n; E(g, x + Math.cos(a) * r * .6, y + Math.sin(a) * r * .6, r * .5, r * .24, a); flat(g, pet, 2.2, dk(pet, .45)); }
    E(g, x, y, r * .36, r * .36); paint(g, cen || '#f6c33b', x, y, r * .4, 2.2);
  }
  function cornflower(g, x, y, r) {
    const p = []; for (let i = 0; i < 16; i++) { const a = i * TAU / 16, q = i % 2 ? r * .62 : r; p.push(x + Math.cos(a) * q, y + Math.sin(a) * q); }
    PL(g, p); paint(g, '#5b86e0', x, y, r, 2.4); E(g, x, y, r * .38, r * .38); flat(g, '#33449c', 0);
    for (let i = 0; i < 5; i++) dot(g, x + Math.cos(i * 1.26) * r * .2, y + Math.sin(i * 1.26) * r * .2, r * .08, '#a9c3ff');
  }
  function tulip(g, x, y, s, col) {
    g.beginPath(); g.moveTo(x - s, y - s * .6); g.lineTo(x - s * .5, y - s * .1); g.lineTo(x, y - s * .9); g.lineTo(x + s * .5, y - s * .1); g.lineTo(x + s, y - s * .6);
    g.quadraticCurveTo(x + s * 1.05, y + s * .9, x, y + s * .9); g.quadraticCurveTo(x - s * 1.05, y + s * .9, x - s, y - s * .6); g.closePath();
    paint(g, col, x, y, s * 1.2, 2.6); HL(g, x - s * .45, y + s * .1, s * .15, s * .35, 0, .45);
  }
  function rose(g, x, y, r, col) {
    E(g, x, y, r, r * .92); paint(g, col, x, y, r, 2.4);
    g.beginPath(); g.arc(x, y + r * .05, r * .55, PI * .9, PI * 2.4); stroke(g, dk(col, .35), 1.8);
    g.beginPath(); g.arc(x + r * .05, y, r * .25, 0, PI * 1.6); stroke(g, dk(col, .35), 1.6);
  }
  function wheat(g, x, y, s, col) {
    col = col || '#c99a4a';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - s); stroke(g, col, s * .07);
    for (let i = 0; i < 3; i++) {
      const yy = y - s * .35 - i * s * .2;
      E(g, x - s * .1, yy, s * .09, s * .16, -.5); g.fillStyle = col; g.fill(); E(g, x + s * .1, yy, s * .09, s * .16, .5); g.fill();
    }
    E(g, x, y - s * 1.02, s * .08, s * .15); g.fill();
  }
  function steam(g, x, y, s, a) {
    for (let i = -1; i <= 1; i += 2) {
      g.beginPath(); g.moveTo(x + i * s * .3, y); g.bezierCurveTo(x + i * s * .3 - s * .3, y - s * .4, x + i * s * .3 + s * .3, y - s * .6, x + i * s * .3, y - s);
      stroke(g, '#ffffff', s * .16, a == null ? .8 : a);
    }
  }
  function jarBody(g, x, y, w, h, fill, lidCol, cloth) {
    // glass jar with contents
    R(g, x - w / 2, y - h / 2, w, h, w * .28); paint(g, fill, x, y, Math.max(w, h) * .6);
    R(g, x - w / 2 + 4, y - h / 2 + 8, w * .18, h * .55, 3); g.fillStyle = 'rgba(255,255,255,.4)'; g.fill();
    if (cloth) {
      g.beginPath(); g.moveTo(x - w * .62, y - h / 2 + 4); g.quadraticCurveTo(x, y - h / 2 - 16, x + w * .62, y - h / 2 + 4);
      g.lineTo(x + w * .5, y - h / 2 + 10); g.lineTo(x + w * .3, y - h / 2 + 6); g.lineTo(x, y - h / 2 + 11); g.lineTo(x - w * .3, y - h / 2 + 6); g.lineTo(x - w * .5, y - h / 2 + 10); g.closePath();
      paint(g, cloth, x, y - h / 2, w * .6, 3);
      g.save(); g.clip(); g.fillStyle = 'rgba(255,255,255,.55)';
      for (let i = -3; i <= 3; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2 === 0) g.fillRect(x + i * 5 - 2.5, y - h / 2 - 12 + j * 5, 5, 5);
      g.restore();
      R(g, x - w * .42, y - h / 2 + 2, w * .84, 4, 2); flat(g, '#c94a4a', 0);
    } else if (lidCol) { R(g, x - w * .44, y - h / 2 - 6, w * .88, 10, 3); paint(g, lidCol, x, y - h / 2, w * .4, 3); }
  }
  function fish(g, x, y, len, h, col, rot, belly, spots) {
    g.save(); g.translate(x, y); g.rotate(rot || 0);
    const L = len / 2;
    // tail
    g.beginPath(); g.moveTo(L * .7, 0); g.lineTo(L * 1.2, -h * .55); g.quadraticCurveTo(L * 1.05, 0, L * 1.2, h * .55); g.closePath(); paint(g, dk(col, .1), L, 0, h * .6, 3);
    // body
    g.beginPath(); g.moveTo(-L, 0); g.bezierCurveTo(-L * .7, -h * .62, L * .4, -h * .7, L * .85, 0); g.bezierCurveTo(L * .4, h * .66, -L * .7, h * .6, -L, 0); g.closePath();
    const gr = g.createLinearGradient(0, -h / 2, 0, h / 2); gr.addColorStop(0, dk(col, .1)); gr.addColorStop(.45, col); gr.addColorStop(1, belly || lt(col, .7));
    g.fillStyle = gr; g.fill(); g.lineWidth = 3.4; g.strokeStyle = dk(col, .62); g.lineJoin = 'round'; g.stroke();
    // fin + gill
    g.beginPath(); g.moveTo(-L * .1, -h * .42); g.quadraticCurveTo(L * .15, -h * .8, L * .35, -h * .38); stroke(g, dk(col, .55), 2.4);
    g.beginPath(); g.arc(-L * .45, 0, h * .32, -1, 1); stroke(g, dk(col, .45), 2);
    if (spots) for (let i = 0; i < 5; i++) dot(g, -L * .1 + i * L * .17, (i % 2 ? -1 : 1) * h * .12, 1.5, dk(col, .4));
    dot(g, -L * .7, -h * .08, h * .11 + 1, '#2b1a12'); dot(g, -L * .7 + .8, -h * .08 - .8, h * .04 + .4, '#fff');
    HL(g, -L * .1, -h * .25, L * .35, h * .1, 0, .45);
    g.restore();
  }
  function plate(g, y, rx, col) { E(g, 50, y + 2, rx, rx * .26); flat(g, dk(col || '#e9f1f6', .12), 0); E(g, 50, y, rx, rx * .26); paint(g, col || '#f4f8fb', 50, y, rx, 3.4); E(g, 50, y - 1, rx * .7, rx * .17); stroke(g, dk(col || '#e9f1f6', .15), 1.5); }
  function berryDot(g, x, y, r, col) { E(g, x, y, r, r); paint(g, col, x, y, r, 2.4); HL(g, x - r * .35, y - r * .35, r * .3, r * .2, -.6, .7); }
  function blueberry(g, x, y, r) { berryDot(g, x, y, r, '#4b5fb0'); star(g, x + r * .1, y - r * .1, r * .32, r * .14, 5); g.fillStyle = '#2b2f6a'; g.fill(); }
  function strawberry(g, x, y, s, rot) {
    g.save(); g.translate(x, y); g.rotate(rot || 0);
    g.beginPath(); g.moveTo(0, s); g.bezierCurveTo(-s * 1.1, s * .3, -s * .95, -s * .75, 0, -s * .6); g.bezierCurveTo(s * .95, -s * .75, s * 1.1, s * .3, 0, s); g.closePath(); paint(g, '#ea4a4a', 0, 0, s * 1.1, 3);
    const r = srnd(3); for (let i = 0; i < 9; i++) { E(g, (r() - .5) * s * 1.1, -s * .25 + r() * s * .9, s * .06, s * .1); g.fillStyle = '#ffe28a'; g.fill(); }
    for (let i = 0; i < 5; i++) leaf(g, 0, -s * .62, s * .55, s * .2, -PI / 2 + (i - 2) * .55 + PI, C.leaf, false);
    HL(g, -s * .4, -s * .1, s * .14, s * .28, .3, .5); g.restore();
  }
  function coinAt(g, x, y, r) { E(g, x, y + r * .18, r, r * .5); flat(g, C.goldD, 3, '#8a5a12'); E(g, x, y, r, r * .5); paint(g, '#ffcf55', x, y, r, 3); E(g, x, y, r * .62, r * .3); stroke(g, '#d9962a', 1.8); }
  function halo(g, col) { // generator marker: a soft round glow plate
    const gr = g.createRadialGradient(50, 56, 8, 50, 56, 50); gr.addColorStop(0, rgba(col || '#fff3c4', .95)); gr.addColorStop(.7, rgba(col || '#fff3c4', .55)); gr.addColorStop(1, rgba(col || '#fff3c4', 0));
    E(g, 50, 56, 50, 46); g.fillStyle = gr; g.fill();
  }
  // generator embellishments per level: 2 = gold ribbon sparkle, 3 = star badge, 4+ = crown
  function adorn(g, lv) {
    if (lv >= 2) { spark(g, 88, 22, 6, '#fff7c2'); spark(g, 12, 46, 4, '#fff7c2'); }
    if (lv >= 3) { pstar(g, 82, 80, 12); paint(g, '#ffcf3d', 82, 80, 12, 3); }
    if (lv >= 5) { E(g, 50, 52, 46, 44); g.setLineDash([2, 6]); stroke(g, '#ffcf3d', 3); g.setLineDash([]); spark(g, 80, 50, 5, '#fff7c2'); spark(g, 20, 76, 5, '#fff7c2'); }
    if (lv >= 4) { PL(g, [8, 22, 8, 8, 15, 15, 22, 6, 29, 15, 36, 8, 36, 22]); paint(g, '#ffcf3d', 22, 15, 16, 3); dot(g, 22, 18, 2.4, C.red); }
  }
  function gen(base, haloCol, n) { // n levels of one generator
    const out = []; for (let i = 1; i <= (n || 4); i++) out.push([null, (g) => { halo(g, haloCol); base(g, i); adorn(g, i); }]); return out;
  }

  // ================= PAGAR (bakery) =================
  ART.def('pagar', [
    ['jahukott', g => {
      sh(g);
      SM(g, [30, 32, 70, 32, 82, 62, 77, 86, 50, 91, 23, 86, 18, 62]); paint(g, '#ecdcb8', 46, 56, 44);
      SM(g, [33, 34, 37, 17, 46, 23, 52, 12, 60, 22, 67, 34]); paint(g, '#e4cfa4', 50, 25, 18);
      R(g, 30, 29, 40, 8, 4); flat(g, '#c27f52', 3);
      wheat(g, 50, 80, 30, '#c79a55');
      dot(g, 44, 14, 3.4, '#fffaf0'); dot(g, 56, 9, 2.6, '#fffaf0'); dot(g, 62, 15, 2, '#fffaf0');
      HL(g, 30, 56, 4.5, 13, .2, .45);
    }],
    ['tainas', g => {
      sh(g, 34);
      SM(g, [20, 60, 26, 36, 44, 26, 62, 28, 78, 40, 80, 60]); paint(g, '#f8e6c3', 44, 40, 34);
      HL(g, 38, 38, 10, 5, -.4, .7); dot(g, 58, 40, 1.8, '#fffaf0'); dot(g, 64, 34, 1.5, '#fffaf0'); dot(g, 50, 32, 1.6, '#fffaf0');
      g.beginPath(); g.moveTo(12, 58); g.lineTo(88, 58); g.quadraticCurveTo(86, 92, 50, 92); g.quadraticCurveTo(14, 92, 12, 58); g.closePath(); paint(g, '#7fb6dc', 40, 64, 40);
      E(g, 50, 58, 38, 6); flat(g, '#a9d2ee', 3.2, '#3d6a8c');
      for (let i = 0; i < 4; i++) { daisySmall(g, 26 + i * 16, 74 + (i % 2) * 4); }
    }],
    ['kukkel', g => {
      sh(g, 32);
      E(g, 50, 60, 33, 26); paint(g, '#e7a356', 42, 50, 36);
      g.beginPath(); for (let a = 0; a < 11; a += .25) { const r = 2 + a * 2.2; g.lineTo(50 + Math.cos(a) * r, 58 + Math.sin(a) * r * .72); } stroke(g, '#a65f2a', 3.4);
      g.beginPath(); g.moveTo(28, 50); g.quadraticCurveTo(36, 58, 40, 46); g.quadraticCurveTo(48, 62, 54, 46); g.quadraticCurveTo(62, 60, 70, 48); stroke(g, '#fff8ea', 3.2, .95);
      HL(g, 36, 46, 7, 4, -.5, .5); dot(g, 60, 66, 1.6, '#fff'); dot(g, 40, 68, 1.6, '#fff');
    }],
    ['sai', g => {
      sh(g, 36);
      SM(g, [14, 70, 18, 48, 34, 36, 60, 32, 80, 40, 88, 60, 84, 76, 50, 80, 20, 78]); paint(g, '#e9a75a', 44, 50, 42);
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(32 + i * 17, 44 - i * 2); g.quadraticCurveTo(38 + i * 17, 54, 36 + i * 17, 64); stroke(g, '#fbe2b5', 5); stroke(g, '#f7d39a', 2); }
      HL(g, 34, 44, 9, 4, -.4, .45);
    }],
    ['palmik', g => {
      sh(g, 40);
      g.save(); g.translate(50, 56); g.rotate(-.32);
      E(g, 0, 2, 42, 19); paint(g, '#d9873e', -6, -4, 40);
      for (let i = 0; i < 5; i++) {
        const x = -30 + i * 14.5, k = 1 - Math.abs(i - 2) * .12;
        E(g, x + 3, 7 * k, 11 * k, 8 * k, -.65); paint(g, '#e59a4b', x, 4, 11, 3.2);
        E(g, x - 3, -6 * k, 11 * k, 8 * k, .65); paint(g, '#eeaa5a', x - 5, -9, 11, 3.2); HL(g, x - 6, -9 * k, 3.4, 1.8, .6, .55);
      }
      const r = srnd(5); for (let i = 0; i < 16; i++) dot(g, -34 + r() * 66, -10 + r() * 18, 1.6, '#fffaf0');
      g.restore();
    }],
    ['kringel', g => { sh(g, 38); kringel(g, 1); }],
    ['tort', g => {
      sh(g, 40, 90); plate(g, 84, 42);
      g.beginPath(); g.moveTo(18, 50); g.lineTo(18, 78); g.ellipse(50, 78, 32, 9, 0, PI, 0, true); g.lineTo(82, 50); g.closePath(); paint(g, '#f6d7b0', 40, 60, 40);
      R(g, 18, 60, 64, 6, 1); flat(g, '#e46a7a', 0); g.beginPath(); g.ellipse(50, 66, 32, 8, 0, 0, PI); stroke(g, '#f29aa5', 3);
      E(g, 50, 50, 32, 10); paint(g, '#fff4f6', 44, 46, 32, 3.6);
      for (let i = 0; i < 7; i++) { const x = 21 + i * 9.6; g.beginPath(); g.moveTo(x - 3, 52 + Math.sin(i) * 2); g.quadraticCurveTo(x, 62 + (i % 3) * 2, x + 3, 52 + Math.sin(i) * 2); g.fillStyle = '#fff4f6'; g.fill(); }
      g.beginPath(); g.moveTo(18, 50); g.lineTo(18, 78); g.ellipse(50, 78, 32, 9, 0, PI, 0, true); g.lineTo(82, 50); stroke(g, dk('#f6d7b0', .6), 3.6);
      strawberry(g, 38, 42, 7, -.3); strawberry(g, 62, 42, 7, .3); strawberry(g, 50, 38, 8, 0);
      for (let i = 0; i < 6; i++) dot(g, 28 + i * 9, 50 + (i % 2) * 2, 2, '#ffffff');
    }],
    ['pulmatort', g => {
      sh(g, 40, 92); plate(g, 86, 42);
      const tiers = [[50, 80, 32, 18], [50, 60, 24, 16], [50, 42, 16, 14]];
      for (const [x, yb, rx, h] of tiers) {
        g.beginPath(); g.moveTo(x - rx, yb - h); g.lineTo(x - rx, yb); g.ellipse(x, yb, rx, rx * .26, 0, PI, 0, true); g.lineTo(x + rx, yb - h); g.closePath(); paint(g, '#fffaf4', x - rx * .4, yb - h, rx * 1.4, 3.4);
        E(g, x, yb - h, rx, rx * .26); paint(g, '#ffffff', x, yb - h, rx, 3.4);
        for (let i = 0; i < 9; i++) { const a = PI * (i / 8); dot(g, x - Math.cos(a) * rx * .96, yb - h * .35 + Math.sin(a) * rx * .2, 1.6, '#f2b0bd'); }
      }
      rose(g, 34, 70, 4.5, '#f58aa0'); rose(g, 64, 74, 4.5, '#f9c35c'); rose(g, 40, 52, 4, '#f9c35c'); rose(g, 60, 50, 4, '#f58aa0'); leaf(g, 66, 76, 7, 3, .2, C.leaf, false);
      heart(g, 50, 24, 9); paint(g, '#f2667c', 50, 20, 10, 3); HL(g, 46, 20, 2.2, 1.6, -.5, .7);
      g.beginPath(); g.moveTo(50, 27); g.lineTo(50, 28); stroke(g, '#c9a27a', 2);
    }]
  ]);
  function daisySmall(g, x, y) { for (let i = 0; i < 5; i++) { const a = i * 1.2566; E(g, x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 2, 2); g.fillStyle = '#fff'; g.fill(); } dot(g, x, y, 1.5, '#f6c33b'); }
  // kringel: the Estonian braided pretzel loaf; the second half goes over the first so the twist reads
  const KR = [30, 76, 50, 54, 64, 34, 78, 28, 89, 42, 84, 63, 68, 77, 50, 80, 32, 77, 16, 63, 11, 42, 22, 28, 36, 34, 50, 54, 70, 76];
  function kringelPart(g, pts, col) {
    SM(g, pts, true); stroke(g, dk(col, .62), 20);
    SM(g, pts, true); stroke(g, col, 14.5);
    SM(g, pts, true); g.setLineDash([3.5, 5.5]); stroke(g, dk(col, .18), 13); g.setLineDash([]);
    SM(g, pts, true); g.save(); g.translate(-1.6, -2.2); stroke(g, lt(col, .4), 5, .75); g.restore();
  }
  function kringel(g) {
    const col = '#e59a4b';
    kringelPart(g, KR.slice(0, 16), col); kringelPart(g, KR.slice(14), col);
    // icing drizzle and almond flakes
    SM(g, KR.slice(14), true); g.setLineDash([9, 7]); g.save(); g.translate(0, -1); stroke(g, '#fffaf0', 2.4, .95); g.restore(); g.setLineDash([]);
    SM(g, KR.slice(0, 16), true); g.setLineDash([7, 9]); stroke(g, '#fffaf0', 2.2, .9); g.setLineDash([]);
    const r = srnd(11); for (let i = 0; i < 9; i++) { const k = (r() * 14 | 0) * 2; E(g, KR[k] + (r() - .5) * 4, KR[k + 1] + (r() - .5) * 4, 2.6, 1.4, r() * 3); g.fillStyle = '#fff1d2'; g.fill(); }
  }
  ART.drawKringel = kringel;

  // ================= LILL (flowers) =================
  ART.def('lill', [
    ['seemned', g => {
      sh(g, 26);
      R(g, 26, 20, 48, 66, 6); paint(g, '#f4e6c9', 44, 44, 40);
      R(g, 32, 30, 36, 34, 5); flat(g, '#bfe3c4', 2.4, '#6a9a6e');
      g.beginPath(); g.moveTo(50, 60); g.lineTo(50, 44); stroke(g, C.leafD, 2.4); leaf(g, 50, 54, 10, 4, -.6, C.leaf, false);
      daisy(g, 50, 42, 8, '#ffffff', '#f6c33b', 8);
      PL(g, [26, 20, 74, 20, 70, 13, 30, 13]); flat(g, '#e8d5ae', 3);
      for (let i = 0; i < 3; i++) { E(g, 38 + i * 12, 75, 3.2, 4.6, .3); flat(g, '#7a5236', 1.8); }
    }],
    ['idu', g => {
      sh(g, 30);
      SM(g, [18, 82, 30, 66, 50, 62, 70, 66, 82, 82]); paint(g, '#8a5a3a', 50, 72, 30);
      g.beginPath(); g.moveTo(50, 70); g.quadraticCurveTo(48, 52, 52, 40); stroke(g, dk(C.leaf, .5), 6); stroke(g, '#7bc760', 3.5);
      leaf(g, 51, 44, 22, 10, -.5, '#7bc760'); leaf(g, 50, 46, 20, 9, PI + .5, '#6dbb5a');
      dot(g, 30, 76, 1.8, '#a87a58'); dot(g, 66, 74, 1.6, '#a87a58'); HL(g, 60, 34, 3, 2, -.5, .6);
    }],
    ['karikakar', g => {
      sh(g, 22);
      g.beginPath(); g.moveTo(50, 88); g.quadraticCurveTo(46, 66, 50, 44); stroke(g, dk(C.leaf, .5), 6); stroke(g, '#6dbb5a', 3.6);
      leaf(g, 49, 72, 22, 8, -.6); leaf(g, 49, 64, 20, 7, PI + .6);
      daisy(g, 50, 36, 24, '#ffffff', '#f6c33b', 11); HL(g, 45, 31, 3, 2, -.5, .6);
    }],
    ['lillepott', g => {
      sh(g, 30);
      for (const [x, y, s] of [[34, 38, 10], [52, 28, 11], [68, 40, 9]]) { g.beginPath(); g.moveTo(50, 64); g.quadraticCurveTo((x + 50) / 2, (y + 64) / 2, x, y); stroke(g, dk(C.leaf, .5), 5); stroke(g, '#6dbb5a', 3); }
      leaf(g, 50, 62, 18, 6, -1.0); leaf(g, 50, 62, 18, 6, PI + 1.0);
      cornflower(g, 34, 38, 10); cornflower(g, 52, 28, 11); cornflower(g, 68, 40, 9);
      g.beginPath(); g.moveTo(26, 60); g.lineTo(74, 60); g.lineTo(68, 90); g.lineTo(32, 90); g.closePath(); paint(g, '#d9784a', 42, 70, 30);
      R(g, 22, 56, 56, 10, 3); paint(g, '#e58a5a', 50, 60, 30, 3.4); HL(g, 36, 74, 3, 9, .1, .35);
    }],
    ['kimp', g => {
      sh(g, 26);
      daisy(g, 34, 34, 11, '#fff', '#f6c33b', 9); cornflower(g, 52, 26, 11); tulip(g, 68, 36, 9, '#f58aa0'); rose(g, 44, 46, 7, '#f7b84c'); cornflower(g, 62, 50, 8); daisy(g, 30, 52, 8, '#fff', '#f6c33b', 8);
      leaf(g, 24, 44, 14, 5, PI + .4); leaf(g, 76, 46, 14, 5, -.4);
      g.beginPath(); g.moveTo(22, 52); g.lineTo(78, 52); g.lineTo(54, 92); g.lineTo(46, 92); g.closePath(); paint(g, '#f6e7cf', 44, 62, 34);
      g.beginPath(); g.moveTo(22, 52); g.lineTo(50, 66); g.lineTo(78, 52); stroke(g, '#d8bf98', 2.2);
      E(g, 42, 72, 7, 5, -.4); flat(g, '#e2574c', 2.6); E(g, 58, 72, 7, 5, .4); flat(g, '#e2574c', 2.6); dot(g, 50, 72, 4, '#c43f36');
      g.beginPath(); g.moveTo(48, 74); g.lineTo(42, 86); g.moveTo(52, 74); g.lineTo(58, 86); stroke(g, '#c43f36', 3.2);
    }],
    ['lillekorv', g => {
      sh(g, 38);
      g.beginPath(); g.ellipse(50, 50, 32, 30, 0, PI, 0); stroke(g, dk(C.woodL, .55), 8); stroke(g, C.woodL, 4.5);
      daisy(g, 26, 52, 10, '#fff', '#f6c33b', 9); cornflower(g, 42, 44, 10); tulip(g, 58, 46, 8, '#f58aa0'); rose(g, 72, 52, 8, '#f7b84c'); daisy(g, 54, 56, 8, '#ffd8e0', '#f6c33b', 8); cornflower(g, 36, 58, 7);
      leaf(g, 14, 60, 12, 5, PI + .3); leaf(g, 86, 60, 12, 5, -.3);
      g.beginPath(); g.moveTo(14, 60); g.lineTo(86, 60); g.lineTo(78, 88); g.quadraticCurveTo(50, 94, 22, 88); g.closePath(); paint(g, '#d59a5c', 44, 68, 40);
      g.save(); g.clip(); for (let y = 64; y < 92; y += 7) { g.beginPath(); g.moveTo(10, y); g.lineTo(90, y); stroke(g, '#a8703c', 2); }
      for (let x = 18; x < 90; x += 9) { g.beginPath(); g.moveTo(x, 60); g.lineTo(x - 2, 92); stroke(g, '#e6b47a', 1.6, .6); } g.restore();
      R(g, 12, 57, 76, 8, 4); paint(g, '#c78a50', 50, 60, 36, 3.2);
    }],
    ['parg', g => {
      sh(g, 38);
      E(g, 50, 52, 32, 24); stroke(g, dk(C.leaf, .5), 11); E(g, 50, 52, 32, 24); stroke(g, '#7cc265', 7);
      const r = srnd(9);
      for (let i = 0; i < 14; i++) { const a = i * TAU / 14; leaf(g, 50 + Math.cos(a) * 32, 52 + Math.sin(a) * 24, 10, 4, a + 1.9, i % 2 ? C.leaf : '#8ccf6e', false); }
      for (let i = 0; i < 10; i++) {
        const a = i * TAU / 10 + .3, x = 50 + Math.cos(a) * 32, y = 52 + Math.sin(a) * 24;
        if (i % 3 === 0) cornflower(g, x, y, 7); else if (i % 3 === 1) daisy(g, x, y, 7, '#fff', '#f6c33b', 8); else rose(g, x, y, 5, ['#f58aa0', '#f7b84c'][i % 2]);
      }
      g.beginPath(); g.moveTo(40, 74); g.quadraticCurveTo(34, 84, 28, 92); stroke(g, '#5b86e0', 4); g.beginPath(); g.moveTo(46, 76); g.quadraticCurveTo(46, 86, 42, 94); stroke(g, '#f58aa0', 4);
      g.beginPath(); g.moveTo(54, 76); g.quadraticCurveTo(56, 86, 60, 94); stroke(g, '#f7d24c', 4);
    }]
  ]);

  // ================= TÖÖRIIST (tools) =================
  function nail(g, x, y, len, rot) {
    g.save(); g.translate(x, y); g.rotate(rot);
    PL(g, [-3, 0, 3, 0, 3, len - 6, 0, len, -3, len - 6]); paint(g, '#b9c3cf', 0, len / 2, len * .5, 3);
    R(g, -9, -5, 18, 7, 3); paint(g, '#a3adba', 0, -2, 9, 3); HL(g, -1, len * .4, 1, len * .25, 0, .6);
    g.restore();
  }
  function hammer(g, x, y, s, rot) {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
    R(g, -4, -10, 8, 50, 4); paint(g, C.woodL, 0, 14, 22, 3.4); R(g, -4.5, 24, 9, 16, 3); paint(g, '#c94a3c', 0, 32, 8, 3);
    PL(g, [-20, -20, 14, -20, 22, -16, 22, -6, 14, -2, -20, -2]); paint(g, '#8e98a6', 0, -12, 20, 3.6); HL(g, -10, -15, 8, 2, 0, .55);
    g.restore();
  }
  function plank(g, x, y, w, h, col) {
    R(g, x, y, w, h, 3); paint(g, col || C.woodL, x + w * .4, y, w * .6, 3.4);
    g.beginPath(); g.moveTo(x + 6, y + h * .4); g.bezierCurveTo(x + w * .3, y + h * .2, x + w * .6, y + h * .7, x + w - 6, y + h * .45); stroke(g, dk(col || C.woodL, .3), 1.5, .7);
    dot(g, x + w * .7, y + h * .55, 1.5, dk(col || C.woodL, .4));
  }
  function saw(g, x, y, s, rot) {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
    g.beginPath(); g.moveTo(-6, -12); g.lineTo(40, -6); for (let i = 0; i < 9; i++) { g.lineTo(40 - i * 5 - 2.5, 8 + (i % 2 ? 0 : 0)); g.lineTo(40 - i * 5 - 5, 4); } g.lineTo(-6, 12); g.closePath(); paint(g, '#c9d3dd', 16, -4, 26, 3);
    HL(g, 16, -4, 16, 2.2, .1, .6);
    g.beginPath(); g.moveTo(-26, -14); g.quadraticCurveTo(-30, 0, -24, 16); g.lineTo(-2, 14); g.lineTo(-2, -14); g.closePath(); paint(g, '#c2683c', -14, -2, 16, 3.4);
    E(g, -14, 0, 5, 6); flat(g, '#5a2e1a', 0);
    g.restore();
  }
  ART.def('tooriist', [
    ['nael', g => { sh(g, 24); nail(g, 40, 22, 56, -.35); nail(g, 60, 26, 52, .3); }],
    ['haamer', g => { sh(g, 28); hammer(g, 54, 46, 1, .6); }],
    ['lauad', g => { sh(g, 38); plank(g, 14, 64, 72, 15, '#c98a55'); plank(g, 18, 49, 66, 15, '#d9a06b'); plank(g, 12, 34, 70, 15, '#e3b07a'); nail(g, 72, 26, 14, .2); }],
    ['saag', g => { sh(g, 36); saw(g, 52, 50, 1.05, -.3); }],
    ['tooriistakast', g => {
      sh(g, 38);
      hammer(g, 38, 30, .55, -.4); saw(g, 64, 28, .45, -1.3);
      g.beginPath(); g.moveTo(34, 44); g.lineTo(34, 30); g.quadraticCurveTo(50, 22, 66, 30); g.lineTo(66, 44); stroke(g, '#6b2a22', 7); stroke(g, '#d24a3c', 3);
      R(g, 12, 44, 76, 42, 7); paint(g, '#df5446', 44, 56, 44);
      R(g, 12, 44, 76, 12, 6); paint(g, '#ea6a5a', 50, 48, 40, 3.4);
      R(g, 44, 52, 12, 9, 2); paint(g, '#f2c14b', 50, 56, 7, 2.6); HL(g, 22, 64, 3, 12, 0, .35);
    }],
    ['toolaud', g => {
      sh(g, 42, 91);
      R(g, 18, 56, 8, 34, 2); paint(g, C.woodD, 22, 70, 10, 3); R(g, 74, 56, 8, 34, 2); paint(g, C.woodD, 78, 70, 10, 3);
      R(g, 20, 76, 60, 6, 2); paint(g, C.wood, 50, 78, 30, 3);
      R(g, 10, 46, 80, 14, 4); paint(g, '#d9a06b', 46, 50, 42);
      R(g, 36, 62, 28, 10, 2); paint(g, C.woodL, 50, 66, 14, 3); dot(g, 50, 67, 2, C.woodD);
      hammer(g, 30, 36, .5, 1.2); saw(g, 62, 36, .5, .05); nail(g, 82, 34, 12, .3);
      R(g, 4, 40, 12, 10, 2); paint(g, '#8e98a6', 10, 45, 8, 3);
    }]
  ]);

  // ================= KALA (fish) =================
  ART.def('kala', [
    ['kilu', g => { sh(g, 24); fish(g, 52, 54, 52, 18, '#9fb4c4', -.25, '#eef4f8'); }],
    ['raim', g => { sh(g, 32); fish(g, 50, 52, 70, 26, '#5d8bb0', -.2, '#e8f1f7', true); }],
    ['lest', g => {
      sh(g, 34);
      g.save(); g.translate(50, 52); g.rotate(-.15);
      PL(g, [28, 0, 44, -16, 40, 0, 44, 16]); paint(g, '#b88d5e', 36, 0, 12, 3);
      E(g, 0, 0, 32, 24); paint(g, '#c9a173', -6, -6, 32);
      g.beginPath(); g.ellipse(0, 0, 36, 28, 0, 0, TAU); g.setLineDash([2, 4]); stroke(g, dk('#c9a173', .4), 4); g.setLineDash([]);
      for (const [x, y] of [[-4, -8], [8, 6], [14, -10], [-10, 10], [2, 0]]) { dot(g, x, y, 3, '#e98a3a'); }
      dot(g, -20, -8, 3.4, '#2b1a12'); dot(g, -14, -12, 3.4, '#2b1a12'); dot(g, -19.3, -8.8, 1.1, '#fff'); dot(g, -13.3, -12.8, 1.1, '#fff');
      HL(g, -8, -12, 10, 3, -.2, .4); g.restore();
    }],
    ['suitsukala', g => {
      sh(g, 30);
      g.beginPath(); g.moveTo(14, 18); g.lineTo(86, 18); stroke(g, C.woodD, 6); stroke(g, C.woodL, 2.6);
      for (let i = 0; i < 2; i++) { const x = 36 + i * 28; g.beginPath(); g.moveTo(x, 18); g.lineTo(x, 26); stroke(g, '#8a6a4a', 2); fish(g, x, 54, 58, 22, '#c78530', PI / 2 + (i ? .05 : -.05), '#f2c26a'); }
      steam(g, 50, 16, 14, .5);
    }],
    ['kalapirukas', g => {
      sh(g, 40);
      g.beginPath(); g.moveTo(10, 62); g.lineTo(90, 62); g.lineTo(82, 82); g.quadraticCurveTo(50, 90, 18, 82); g.closePath(); paint(g, '#9aa7b6', 50, 70, 40);
      E(g, 50, 60, 38, 18); paint(g, '#e8a45a', 44, 54, 40);
      g.save(); E(g, 50, 60, 38, 18); g.clip(); for (let i = 0; i < 16; i++) { const a = i * TAU / 16; g.beginPath(); g.moveTo(50 + Math.cos(a) * 34, 60 + Math.sin(a) * 15); g.lineTo(50 + Math.cos(a) * 40, 60 + Math.sin(a) * 19); stroke(g, '#b8682d', 2); } g.restore();
      g.save(); g.translate(50, 58); g.scale(1, .6); fish(g, 0, 0, 40, 18, '#f6c37a', -.05, '#f9dca8'); g.restore();
      steam(g, 50, 40, 14, .7);
    }],
    ['kalavaagen', g => {
      sh(g, 44, 90);
      E(g, 50, 70, 44, 18); paint(g, '#f4f8fb', 46, 64, 44); E(g, 50, 69, 36, 13); stroke(g, '#c7d6e2', 2);
      for (let i = 0; i < 5; i++) leaf(g, 20 + i * 6, 64 + (i % 2) * 6, 10, 3, -1 - i * .3, '#6dbb5a', false);
      fish(g, 50, 62, 64, 24, '#d08a3a', -.08, '#f6cf8a');
      E(g, 78, 72, 8, 6); paint(g, '#ffe14d', 78, 72, 8, 3); E(g, 78, 72, 5, 3.5); stroke(g, '#f7f0b0', 1.4);
      E(g, 26, 74, 8, 6); paint(g, '#ffe14d', 26, 74, 8, 3);
      for (let i = 0; i < 3; i++) dot(g, 40 + i * 9, 76, 2.2, '#e2574c');
      steam(g, 50, 44, 14, .6);
    }]
  ]);

  // ================= TEE (tea) =================
  function cup(g, x, y, s, col) {
    E(g, x, y + 16 * s, 24 * s, 7 * s); paint(g, '#fffaf4', x, y + 16 * s, 24 * s, 3);
    g.beginPath(); g.arc(x + 16 * s, y + 2 * s, 7 * s, -PI / 2, PI / 2); stroke(g, dk(col, .6), 7 * s); stroke(g, col, 3.6 * s);
    g.beginPath(); g.moveTo(x - 18 * s, y - 8 * s); g.lineTo(x + 18 * s, y - 8 * s); g.quadraticCurveTo(x + 17 * s, y + 15 * s, x, y + 15 * s); g.quadraticCurveTo(x - 17 * s, y + 15 * s, x - 18 * s, y - 8 * s); g.closePath();
    paint(g, col, x - 4 * s, y, 20 * s, 3.2);
    E(g, x, y - 8 * s, 18 * s, 5 * s); flat(g, '#b8682d', 2.6, dk(col, .6)); E(g, x - 3 * s, y - 9 * s, 8 * s, 1.6 * s); g.fillStyle = 'rgba(255,230,180,.6)'; g.fill();
    daisySmall(g, x - 2 * s, y + 3 * s);
  }
  function teapot(g, x, y, s, col) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.beginPath(); g.moveTo(20, 2); g.quadraticCurveTo(36, 0, 40, -18); g.quadraticCurveTo(34, -8, 18, -8); stroke(g, dk(col, .6), 9); stroke(g, col, 5);
    g.beginPath(); g.arc(-22, -2, 11, PI * .6, PI * 1.6); stroke(g, dk(col, .6), 8); stroke(g, col, 4.5);
    E(g, 0, 0, 26, 21); paint(g, col, -6, -6, 28);
    E(g, 0, -18, 14, 5); paint(g, lt(col, .2), 0, -18, 14, 3); dot(g, 0, -25, 4.5, lt(col, .1)); g.beginPath(); g.arc(0, -25, 4.5, 0, TAU); stroke(g, dk(col, .6), 3);
    daisySmall(g, -6, 2); daisySmall(g, 8, -2); daisySmall(g, 2, 10);
    HL(g, -12, -8, 6, 4, -.6, .55); g.restore();
  }
  ART.def('tee', [
    ['teeleht', g => { sh(g, 24); leaf(g, 24, 70, 58, 22, -.75, '#5fb35a'); E(g, 58, 42, 4.5, 5.5); g.fillStyle = 'rgba(220,245,255,.85)'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#7fb6d0'; g.stroke(); dot(g, 56.6, 40.6, 1.3, '#fff'); }],
    ['teeoksad', g => {
      sh(g, 26);
      g.beginPath(); g.moveTo(40, 88); g.quadraticCurveTo(46, 60, 56, 30); stroke(g, '#5c7a3a', 4);
      leaf(g, 44, 72, 28, 11, -2.4, '#5fb35a'); leaf(g, 47, 62, 28, 11, -.6, '#6dbb5a'); leaf(g, 51, 48, 24, 10, -2.6, '#5fb35a');
      daisy(g, 58, 28, 13, '#fff', '#f6c33b', 10); daisy(g, 30, 46, 8, '#fff', '#f6c33b', 9);
    }],
    ['teetass', g => { sh(g, 30); steam(g, 46, 36, 20, .85); cup(g, 46, 54, 1.25, '#8fc3e8'); }],
    ['teekann', g => { sh(g, 36); teapot(g, 48, 58, 1.2, '#7fb3e0'); }],
    ['teekomplekt', g => {
      sh(g, 44, 92);
      R(g, 6, 76, 88, 12, 6); paint(g, C.woodL, 50, 80, 44);
      teapot(g, 50, 52, .95, '#f29aa8'); cup(g, 18, 64, .55, '#8fc3e8'); cup(g, 82, 64, .55, '#8fc3e8');
      for (let i = 0; i < 3; i++) dot(g, 30 + i * 20, 82, 1.8, '#f6e2c0');
    }],
    ['samovar', g => {
      sh(g, 34, 92);
      R(g, 30, 80, 40, 8, 3); paint(g, '#c98a1f', 50, 84, 20, 3); R(g, 40, 72, 20, 10, 2); paint(g, '#d9962a', 50, 76, 10, 3);
      g.beginPath(); g.moveTo(26, 40); g.quadraticCurveTo(20, 72, 40, 74); g.lineTo(60, 74); g.quadraticCurveTo(80, 72, 74, 40); g.closePath(); paint(g, '#f2b84b', 40, 50, 34);
      E(g, 50, 40, 25, 7); paint(g, '#f7cd6b', 50, 40, 25, 3);
      g.beginPath(); g.arc(22, 52, 7, PI * .5, PI * 1.5); stroke(g, '#8a5a12', 6); g.beginPath(); g.arc(78, 52, 7, -PI * .5, PI * .5); stroke(g, '#8a5a12', 6);
      R(g, 64, 60, 18, 5, 2); paint(g, '#c98a1f', 72, 62, 9, 2.6); R(g, 79, 62, 4, 8, 1.5); flat(g, '#8a5a12', 0);
      for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(32 + i * 7.2, 46); g.lineTo(32 + i * 7.2, 68); stroke(g, '#d9962a', 1.6, .6); }
      teapot(g, 50, 26, .5, '#f29aa8');
      HL(g, 34, 52, 3.5, 12, .15, .55);
    }]
  ]);

  // ================= MARI (berries) =================
  ART.def('mari', [
    ['mustikad', g => { sh(g, 26); leaf(g, 50, 40, 30, 12, -.5, C.leaf); leaf(g, 50, 40, 26, 10, PI + .3, '#7bc760'); blueberry(g, 36, 60, 14); blueberry(g, 62, 62, 13); blueberry(g, 50, 44, 13); }],
    ['maasikas', g => { sh(g, 26); strawberry(g, 50, 52, 30, .1); }],
    ['marjakauss', g => {
      sh(g, 38);
      blueberry(g, 30, 52, 9); strawberry(g, 44, 46, 12, -.3); blueberry(g, 58, 48, 9); strawberry(g, 66, 50, 11, .4); berryDot(g, 40, 56, 6, '#d6304d'); berryDot(g, 52, 56, 6, '#d6304d'); blueberry(g, 72, 58, 7);
      g.beginPath(); g.moveTo(12, 58); g.lineTo(88, 58); g.quadraticCurveTo(86, 90, 50, 90); g.quadraticCurveTo(14, 90, 12, 58); g.closePath(); paint(g, '#fff6ec', 42, 66, 40);
      g.save(); g.clip(); for (let i = 0; i < 6; i++) { heart(g, 22 + i * 12, 74 + (i % 2) * 4, 3.4); g.fillStyle = '#f29aa8'; g.fill(); } g.restore();
      E(g, 50, 58, 38, 5); stroke(g, dk('#fff6ec', .55), 3.2);
    }],
    ['moosipurk', g => {
      sh(g, 28); jarBody(g, 50, 60, 46, 50, '#d43a52', null, '#f06a6a');
      R(g, 34, 56, 32, 18, 4); flat(g, '#fff6e6', 2.4, '#b8873a'); heart(g, 50, 66, 5); g.fillStyle = '#e2574c'; g.fill();
    }],
    ['pirukas', g => {
      sh(g, 42);
      g.beginPath(); g.moveTo(8, 56); g.lineTo(92, 56); g.lineTo(84, 80); g.quadraticCurveTo(50, 88, 16, 80); g.closePath(); paint(g, '#c8d2dc', 50, 66, 40);
      E(g, 50, 54, 40, 19); paint(g, '#b52c48', 44, 50, 40);
      g.save(); E(g, 50, 54, 37, 17); g.clip();
      for (let i = -3; i <= 3; i++) dot(g, 50 + i * 12 + 6, 50 + (i % 2) * 6, 2, '#e0607a');
      for (let i = -3; i <= 3; i++) { R(g, 50 + i * 12 - 2.8, 30, 5.6, 50, 3); paint(g, '#ebaa5e', 50 + i * 12, 50, 12, 2); }
      for (let i = -2; i <= 2; i++) { g.save(); g.translate(50, 54 + i * 7.5); R(g, -40, -2.3, 80, 4.6, 2.3); paint(g, '#f0b56a', 0, 0, 30, 2); g.restore(); }
      for (let i = -3; i <= 3; i++) for (let j = -2; j <= 2; j++) if ((i + j) % 2 === 0) { R(g, 50 + i * 12 - 2.8, 54 + j * 7.5 - 2.3, 5.6, 4.6, 2); flat(g, '#efb064', 1.6, '#b8682d'); }
      g.restore();
      E(g, 50, 54, 40, 19); stroke(g, '#c47a36', 7); E(g, 50, 54, 40, 19); g.setLineDash([3, 3]); stroke(g, '#f0c07a', 4); g.setLineDash([]);
    }],
    ['moosiriiul', g => {
      sh(g, 42, 92);
      R(g, 8, 80, 84, 8, 3); paint(g, C.wood, 50, 84, 40); PL(g, [16, 88, 22, 88, 20, 94, 18, 94]); flat(g, C.woodD, 2); PL(g, [78, 88, 84, 88, 82, 94, 80, 94]); flat(g, C.woodD, 2);
      jarBody(g, 26, 62, 28, 32, '#d43a52', null, '#f06a6a'); jarBody(g, 50, 56, 30, 42, '#6b3f9a', null, '#7fb3e0'); jarBody(g, 74, 62, 28, 32, '#f39a2a', null, '#8fd17a');
      strawberry(g, 26, 66, 5); blueberry(g, 50, 62, 5); dot(g, 74, 66, 4, '#ffcf55');
    }]
  ]);

  // ================= PIIM (dairy) =================
  ART.def('piim', [
    ['piimapudel', g => {
      sh(g, 22);
      g.beginPath(); g.moveTo(40, 22); g.lineTo(60, 22); g.lineTo(60, 34); g.quadraticCurveTo(72, 42, 72, 56); g.lineTo(72, 82); g.quadraticCurveTo(72, 88, 66, 88); g.lineTo(34, 88); g.quadraticCurveTo(28, 88, 28, 82); g.lineTo(28, 56); g.quadraticCurveTo(28, 42, 40, 34); g.closePath();
      paint(g, '#ffffff', 42, 50, 36);
      R(g, 28, 56, 44, 16, 1); flat(g, '#7fb3e0', 0); daisySmall(g, 50, 64);
      g.beginPath(); g.moveTo(40, 22); g.lineTo(60, 22); g.lineTo(60, 34); g.quadraticCurveTo(72, 42, 72, 56); g.lineTo(72, 82); g.quadraticCurveTo(72, 88, 66, 88); g.lineTo(34, 88); g.quadraticCurveTo(28, 88, 28, 82); g.lineTo(28, 56); g.quadraticCurveTo(28, 42, 40, 34); g.closePath(); stroke(g, '#6f8aa3', 3.6);
      R(g, 38, 14, 24, 10, 4); paint(g, '#4f86c6', 50, 18, 12, 3); HL(g, 35, 46, 3, 10, .2, .7);
    }],
    ['piimakann', g => {
      sh(g, 30);
      g.beginPath(); g.arc(70, 54, 12, -PI * .5, PI * .5); stroke(g, '#3d5f86', 9); stroke(g, '#ffffff', 4.6);
      g.beginPath(); g.moveTo(30, 26); g.lineTo(26, 22); g.lineTo(62, 24); g.lineTo(66, 34); g.quadraticCurveTo(76, 80, 64, 88); g.lineTo(32, 88); g.quadraticCurveTo(20, 80, 32, 36); g.closePath(); paint(g, '#ffffff', 40, 50, 38);
      g.beginPath(); g.moveTo(26, 22); g.lineTo(62, 24); stroke(g, '#4f86c6', 5);
      R(g, 22, 80, 52, 7, 3); flat(g, '#4f86c6', 0);
      for (let i = 0; i < 3; i++) daisySmall(g, 36 + i * 11, 58 + (i % 2) * 6);
      g.beginPath(); g.moveTo(28, 25); g.quadraticCurveTo(22, 30, 26, 36); stroke(g, '#ffffff', 4); HL(g, 34, 50, 3, 12, .1, .5);
    }],
    ['void', g => {
      sh(g, 38);
      E(g, 50, 72, 40, 14); paint(g, '#e3eef6', 46, 68, 40); E(g, 50, 70, 32, 9); stroke(g, '#b7cad8', 2);
      g.beginPath(); g.moveTo(22, 64); g.lineTo(30, 44); g.lineTo(76, 44); g.lineTo(78, 64); g.quadraticCurveTo(50, 72, 22, 64); g.closePath(); paint(g, '#ffe27a', 46, 52, 34);
      PL(g, [30, 44, 40, 36, 84, 36, 76, 44]); paint(g, '#fff0a6', 56, 40, 30, 3.4); PL(g, [76, 44, 84, 36, 84, 56, 78, 64]); paint(g, '#f2c94a', 80, 50, 10, 3.4);
      g.beginPath(); g.moveTo(48, 36); g.bezierCurveTo(40, 22, 60, 22, 54, 34); stroke(g, '#fff4b8', 6); stroke(g, '#e8c94a', 1.6);
      HL(g, 38, 50, 6, 2.5, 0, .6);
    }],
    ['kohuke', g => {
      sh(g, 36);
      g.save(); g.translate(50, 56); g.rotate(-.2);
      R(g, -32, -12, 64, 26, 12); paint(g, '#7a4a2e', -6, -6, 34);
      g.beginPath(); g.moveTo(-26, -6); g.quadraticCurveTo(-18, 2, -10, -6); g.quadraticCurveTo(-2, 2, 6, -6); g.quadraticCurveTo(14, 2, 22, -6); stroke(g, '#c99070', 2.6);
      // wrapper on the right
      g.beginPath(); g.moveTo(8, -16); g.lineTo(34, -16); g.lineTo(40, -22); g.lineTo(40, 20); g.lineTo(34, 18); g.lineTo(8, 18); g.closePath(); paint(g, '#f6e05a', 22, -2, 24, 3.4);
      R(g, 14, -10, 18, 20, 4); flat(g, '#e2574c', 2, '#9a2f26'); heart(g, 23, 2, 4.5); g.fillStyle = '#fff'; g.fill();
      HL(g, -18, -6, 8, 2.4, 0, .45); g.restore();
    }],
    ['juust', g => {
      sh(g, 36);
      PL(g, [14, 64, 76, 38, 86, 50, 86, 76, 14, 84]); paint(g, '#f7cf45', 46, 60, 40);
      PL(g, [14, 64, 76, 38, 86, 50, 26, 72]); paint(g, '#ffe27a', 50, 56, 36, 3.4); PL(g, [14, 64, 26, 72, 26, 84, 14, 84]); flat(g, '#e9b734', 3.4, '#7a5a12');
      for (const [x, y, r] of [[44, 74, 4.5], [64, 66, 3.4], [74, 74, 2.6], [34, 78, 2.4]]) { E(g, x, y, r, r * .8); flat(g, '#e0a92a', 0); }
      E(g, 58, 54, 4, 2); flat(g, '#e9b734', 0);
    }],
    ['juustuketas', g => {
      sh(g, 42, 90);
      g.beginPath(); g.moveTo(10, 46); g.lineTo(10, 66); g.ellipse(50, 66, 40, 16, 0, PI, PI * 1.9, true); g.lineTo(82, 56); g.lineTo(50, 50); g.closePath(); paint(g, '#d9473c', 40, 56, 44);
      g.beginPath(); g.ellipse(50, 46, 40, 16, 0, PI * .1, PI * 2); g.lineTo(50, 46); g.closePath(); paint(g, '#ffde6a', 44, 40, 40);
      PL(g, [50, 46, 82, 56, 82, 76, 50, 66]); paint(g, '#f2c54a', 64, 60, 20, 3.4); PL(g, [50, 46, 89, 39, 89, 59, 82, 56]); flat(g, '#e9b734', 3, '#7a5a12');
      for (const [x, y] of [[62, 62], [72, 70], [66, 52]]) { E(g, x, y, 3, 2.4); flat(g, '#d9a22a', 0); }
      HL(g, 30, 40, 10, 3, -.1, .45);
    }]
  ]);

  // ================= MESI (honey) =================
  function hexp(g, x, y, r) { g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * PI / 3 + PI / 6; g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); }
  function bee(g, x, y, s) {
    E(g, x - s * .2, y - s * .7, s * .55, s * .4, -.4); g.fillStyle = 'rgba(230,245,255,.9)'; g.fill(); g.lineWidth = 1.4; g.strokeStyle = '#7fa6c0'; g.stroke();
    E(g, x + s * .3, y - s * .7, s * .5, s * .36, .4); g.fill(); g.stroke();
    E(g, x, y, s, s * .72); paint(g, '#ffd23f', x, y, s, 2.4);
    g.save(); E(g, x, y, s, s * .72); g.clip(); for (let i = -1; i <= 1; i++) { g.fillStyle = '#3a2a1c'; g.fillRect(x + i * s * .6 - s * .14, y - s, s * .28, s * 2); } g.restore();
    dot(g, x - s * .78, y - s * .12, s * .14, '#2b1a12');
  }
  function honeyComb(g, cx, cy, r, n) {
    const cells = [[0, 0], [1, 0], [-1, 0], [.5, -1], [-.5, -1], [.5, 1], [-.5, 1]].slice(0, n || 7);
    for (const [i, j] of cells) { hexp(g, cx + i * r * 1.74, cy + j * r * 1.5, r); paint(g, '#f5a623', cx + i * r * 1.74 - 2, cy + j * r * 1.5 - 3, r, 3); hexp(g, cx + i * r * 1.74, cy + j * r * 1.5, r * .62); flat(g, '#ffc94a', 0); HL(g, cx + i * r * 1.74 - r * .25, cy + j * r * 1.5 - r * .25, r * .2, r * .12, -.5, .7); }
  }
  ART.def('mesi', [
    ['meetilk', g => {
      sh(g, 20);
      g.beginPath(); g.moveTo(50, 14); g.bezierCurveTo(56, 34, 74, 50, 74, 64); g.arc(50, 64, 24, 0, PI); g.bezierCurveTo(26, 50, 44, 34, 50, 14); g.closePath(); paint(g, '#f5a623', 44, 56, 30);
      HL(g, 40, 58, 4, 9, .2, .7); dot(g, 58, 72, 2.4, 'rgba(255,255,255,.6)');
    }],
    ['karg', g => { sh(g, 34); honeyComb(g, 50, 52, 13); g.beginPath(); g.moveTo(62, 64); g.quadraticCurveTo(64, 76, 62, 84); stroke(g, '#c27a10', 5); stroke(g, '#ffb52e', 3); }],
    ['meepurk', g => {
      sh(g, 30); jarBody(g, 46, 62, 46, 48, '#f5a623', null, '#f6d36a');
      R(g, 32, 58, 28, 16, 4); flat(g, '#fff6e6', 2.4, '#b8873a'); hexp(g, 46, 66, 5); flat(g, '#f5a623', 1.5);
      g.beginPath(); g.moveTo(60, 42); g.lineTo(80, 14); stroke(g, '#8a5232', 4.5); for (let i = 0; i < 3; i++) { E(g, 59 - i * 2, 44 + i * 4, 7, 2.6, -.5); flat(g, '#d9962a', 2.2); }
    }],
    ['meekook', g => {
      sh(g, 40, 90); plate(g, 84, 40);
      g.beginPath(); g.moveTo(16, 56); g.lineTo(50, 40); g.lineTo(84, 54); g.lineTo(84, 78); g.lineTo(50, 86); g.lineTo(16, 76); g.closePath(); paint(g, '#e9a75a', 46, 60, 40);
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(16, 62 + i * 4.5); g.lineTo(50, 68 + i * 5); g.lineTo(84, 60 + i * 4.5); stroke(g, '#fff4dc', 2.4); }
      g.beginPath(); g.moveTo(16, 56); g.lineTo(50, 40); g.lineTo(84, 54); g.lineTo(50, 62); g.closePath(); paint(g, '#f2bf6a', 50, 50, 30, 3);
      g.beginPath(); g.moveTo(24, 58); g.quadraticCurveTo(26, 66, 28, 60); g.moveTo(70, 58); g.quadraticCurveTo(72, 70, 74, 60); stroke(g, '#f5a623', 3.4);
      bee(g, 52, 30, 7);
    }],
    ['tarukorv', g => {
      sh(g, 38, 92);
      R(g, 14, 82, 72, 8, 3); paint(g, C.wood, 50, 86, 36);
      g.beginPath(); g.moveTo(18, 84); g.bezierCurveTo(12, 30, 88, 30, 82, 84); g.closePath(); paint(g, '#e6b15a', 40, 50, 40);
      g.save(); g.clip(); for (let y = 36; y < 86; y += 8) { g.beginPath(); g.ellipse(50, y + 46, 46, 46, 0, PI * 1.15, PI * 1.85); stroke(g, '#b8782d', 2.6); } g.restore();
      E(g, 50, 74, 8, 6); flat(g, '#3a2414', 2.4);
      bee(g, 24, 32, 6); bee(g, 76, 26, 6); bee(g, 66, 48, 5);
    }]
  ]);

  // ================= KUDUM (knitting) =================
  function knitPattern(g, x, y, w, col, kind) {
    g.fillStyle = col;
    if (kind === 'star') { for (let i = 0; i < 3; i++) { const cx = x + w * (i + .5) / 3; PL(g, [cx, y - 4, cx + 1.5, y - 1.5, cx + 4, y, cx + 1.5, y + 1.5, cx, y + 4, cx - 1.5, y + 1.5, cx - 4, y, cx - 1.5, y - 1.5]); g.fill(); } }
    else { for (let i = 0; i < w / 5; i++) { PL(g, [x + i * 5, y + 2, x + i * 5 + 2.5, y - 2, x + i * 5 + 5, y + 2]); g.fill(); } }
  }
  function mitten(g, x, y, s, rot, col) {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
    g.beginPath(); g.moveTo(-14, 26); g.lineTo(-15, -6); g.bezierCurveTo(-15, -30, 15, -30, 15, -8); g.lineTo(15, 26); g.closePath(); paint(g, col, -4, -6, 22);
    E(g, -17, 2, 6, 10, -.5); paint(g, col, -18, 0, 8, 3);
    g.save(); g.beginPath(); g.moveTo(-14, 26); g.lineTo(-15, -6); g.bezierCurveTo(-15, -30, 15, -30, 15, -8); g.lineTo(15, 26); g.closePath(); g.clip();
    knitPattern(g, -15, -6, 30, '#fff6e6', 'star'); knitPattern(g, -15, 6, 30, '#fff6e6'); g.restore();
    R(g, -16, 22, 32, 10, 3); paint(g, '#fff6e6', 0, 26, 14, 3); for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-12 + i * 5, 23); g.lineTo(-12 + i * 5, 31); stroke(g, '#e0cdb0', 1.4); }
    g.restore();
  }
  ART.def('kudum', [
    ['longakera', g => {
      sh(g, 30);
      g.beginPath(); g.moveTo(72, 70); g.bezierCurveTo(84, 80, 70, 90, 88, 90); stroke(g, '#a83a3a', 4);
      E(g, 48, 56, 30, 30); paint(g, '#e2574c', 40, 46, 32);
      g.save(); E(g, 48, 56, 30, 30); g.clip();
      for (let i = -3; i <= 3; i++) { g.beginPath(); g.ellipse(48 + i * 7, 56, 9, 34, .5, 0, TAU); stroke(g, '#b23a32', 1.8, .7); }
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(48, 56 + i * 8, 34, 8, -.3, 0, TAU); stroke(g, '#f27a6a', 1.6, .6); } g.restore();
      g.beginPath(); g.moveTo(20, 20); g.lineTo(70, 74); stroke(g, '#8a5232', 4); g.beginPath(); g.moveTo(80, 20); g.lineTo(30, 76); stroke(g, '#8a5232', 4); dot(g, 20, 20, 4, '#f2c14b'); dot(g, 80, 20, 4, '#f2c14b');
      HL(g, 36, 42, 7, 4, -.6, .4);
    }],
    ['kindad', g => { sh(g, 36); mitten(g, 36, 52, 1.05, -.25, '#d94a42'); mitten(g, 64, 54, 1.05, .25, '#4f7fc8'); }],
    ['sokid', g => {
      sh(g, 38);
      for (let k = 0; k < 2; k++) {
        g.save(); g.translate(k ? 62 : 38, k ? 48 : 46); g.rotate(k ? .15 : -.15);
        const col = k ? '#7cbf6a' : '#f2b84b';
        g.beginPath(); g.moveTo(-10, -30); g.lineTo(10, -30); g.lineTo(10, 10); g.quadraticCurveTo(12, 30, -6, 34); g.lineTo(-18, 34); g.quadraticCurveTo(-30, 32, -26, 22); g.quadraticCurveTo(-14, 16, -10, 8); g.closePath(); paint(g, col, -6, -4, 26);
        g.save(); g.clip(); knitPattern(g, -12, -18, 24, '#fff6e6'); knitPattern(g, -12, -6, 24, '#c94a3c', 'star'); E(g, -24, 30, 8, 7); flat(g, dk(col, .2), 0); g.restore();
        R(g, -12, -34, 24, 8, 3); paint(g, '#fff6e6', 0, -30, 12, 3);
        g.restore();
      }
    }],
    ['myts', g => {
      sh(g, 34);
      g.beginPath(); g.moveTo(18, 70); g.bezierCurveTo(16, 24, 84, 24, 82, 70); g.closePath(); paint(g, '#4f7fc8', 42, 44, 36);
      g.save(); g.clip(); knitPattern(g, 18, 46, 64, '#fff6e6', 'star'); knitPattern(g, 18, 56, 64, '#f2b84b'); g.restore();
      R(g, 14, 64, 72, 16, 7); paint(g, '#e2574c', 50, 70, 36); for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(18 + i * 6, 66); g.lineTo(18 + i * 6, 78); stroke(g, '#b83a32', 1.4, .7); }
      SM(g, [50, 10, 58, 13, 62, 20, 60, 29, 52, 33, 43, 31, 38, 24, 41, 14]); paint(g, '#fff6e6', 46, 18, 14, 3.6);
      for (let i = 0; i < 6; i++) { const a = i * 1.05; g.beginPath(); g.moveTo(50 + Math.cos(a) * 3, 22 + Math.sin(a) * 3); g.lineTo(50 + Math.cos(a) * 8, 22 + Math.sin(a) * 8); stroke(g, '#e0cdb0', 1.6); }
    }],
    ['sall', g => {
      sh(g, 38);
      g.beginPath(); g.moveTo(22, 30); g.bezierCurveTo(30, 16, 70, 16, 78, 30); g.bezierCurveTo(74, 46, 26, 46, 22, 30); g.closePath(); paint(g, '#e2574c', 44, 28, 34);
      for (const [x, rot] of [[34, .12], [58, -.1]]) {
        g.save(); g.translate(x, 40); g.rotate(rot); R(g, -9, 0, 18, 42, 4); paint(g, '#e2574c', -2, 16, 20, 3.6);
        g.save(); R(g, -9, 0, 18, 42, 4); g.clip(); for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#fff6e6' : '#f2b84b'; g.fillRect(-9, 6 + i * 9, 18, 3.5); } g.restore();
        for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-7 + i * 3.5, 42); g.lineTo(-7 + i * 3.5, 50); stroke(g, '#c94a3c', 2.2); }
        g.restore();
      }
      g.save(); g.beginPath(); g.moveTo(22, 30); g.bezierCurveTo(30, 16, 70, 16, 78, 30); g.bezierCurveTo(74, 46, 26, 46, 22, 30); g.clip(); for (let i = 0; i < 2; i++) { g.fillStyle = i ? '#fff6e6' : '#f2b84b'; g.fillRect(0, 26 + i * 6, 100, 3); } g.restore();
    }],
    ['kampsun', g => {
      sh(g, 42, 92);
      g.beginPath(); g.moveTo(34, 18); g.quadraticCurveTo(50, 26, 66, 18); g.lineTo(86, 28); g.lineTo(94, 70); g.lineTo(80, 72); g.lineTo(76, 46); g.lineTo(76, 86); g.lineTo(24, 86); g.lineTo(24, 46); g.lineTo(20, 72); g.lineTo(6, 70); g.lineTo(14, 28); g.closePath();
      paint(g, '#5a86cf', 42, 46, 46);
      g.save(); g.clip();
      g.beginPath(); g.ellipse(50, 18, 30, 22, 0, 0, PI); g.fillStyle = '#fff6e6'; g.fill();
      knitPattern(g, 22, 30, 56, '#c94a3c', 'star'); knitPattern(g, 24, 38, 52, '#5a86cf');
      g.fillStyle = '#3f67ac'; g.fillRect(0, 80, 100, 8); g.fillRect(0, 64, 100, 3); g.restore();
      g.beginPath(); g.moveTo(36, 19); g.quadraticCurveTo(50, 27, 64, 19); stroke(g, '#3f67ac', 4);
      for (let i = 0; i < 3; i++) dot(g, 50, 52 + i * 9, 2.4, '#fff6e6');
      HL(g, 32, 56, 3, 10, 0, .3);
    }]
  ]);

  // ================= MERI (sea treasures) =================
  function shell(g, x, y, s, col) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.beginPath(); g.moveTo(0, 22); g.lineTo(-28, -2); g.bezierCurveTo(-26, -30, 26, -30, 28, -2); g.closePath(); paint(g, col, -6, -10, 30);
    for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(0, 20); g.lineTo(i * 8, -22 + Math.abs(i) * 2.4); stroke(g, dk(col, .3), 2); }
    PL(g, [-8, 18, 8, 18, 12, 28, -12, 28]); paint(g, col, 0, 22, 10, 3);
    HL(g, -10, -12, 6, 3, -.4, .5); g.restore();
  }
  ART.def('meri', [
    ['karp', g => { sh(g, 30); shell(g, 50, 52, 1.1, '#f7a8a0'); }],
    ['merevaik', g => {
      sh(g, 26);
      const gr = g.createRadialGradient(50, 52, 4, 50, 52, 40); gr.addColorStop(0, 'rgba(255,220,120,.6)'); gr.addColorStop(1, 'rgba(255,200,90,0)'); E(g, 50, 52, 42, 40); g.fillStyle = gr; g.fill();
      SM(g, [34, 30, 58, 22, 74, 40, 70, 70, 46, 80, 26, 62]); paint(g, '#f0a030', 42, 42, 36);
      SM(g, [40, 36, 56, 30, 66, 44, 60, 62, 44, 68, 34, 56]); g.fillStyle = 'rgba(255,214,120,.55)'; g.fill();
      leaf(g, 44, 56, 12, 4, -.6, '#c07a30', false); HL(g, 42, 36, 7, 3.5, -.5, .75); spark(g, 72, 30, 6, '#fff7c2');
    }],
    ['parl', g => {
      sh(g, 38);
      g.beginPath(); g.moveTo(12, 58); g.bezierCurveTo(14, 22, 86, 22, 88, 58); g.closePath(); paint(g, '#b7a6d6', 46, 40, 40);
      for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(50, 58); g.lineTo(50 + i * 11, 30 + Math.abs(i) * 3); stroke(g, '#9483bd', 1.8, .7); }
      g.beginPath(); g.moveTo(12, 58); g.bezierCurveTo(14, 90, 86, 90, 88, 58); g.closePath(); paint(g, '#c7b8e2', 46, 66, 40);
      E(g, 50, 62, 30, 12); flat(g, '#f6d6e4', 2.4, '#9483bd');
      E(g, 50, 56, 12, 12); paint(g, '#ffffff', 46, 52, 14, 3); HL(g, 46, 52, 3.6, 2.4, -.6, .9); spark(g, 66, 44, 5, '#fff');
    }],
    ['pudelipost', g => {
      sh(g, 34);
      g.save(); g.translate(50, 54); g.rotate(-.5);
      R(g, -8, -38, 16, 14, 3); paint(g, '#c98a55', 0, -32, 8, 3);
      g.beginPath(); g.moveTo(-6, -26); g.lineTo(6, -26); g.lineTo(6, -18); g.quadraticCurveTo(20, -12, 20, 4); g.lineTo(20, 30); g.quadraticCurveTo(20, 36, 14, 36); g.lineTo(-14, 36); g.quadraticCurveTo(-20, 36, -20, 30); g.lineTo(-20, 4); g.quadraticCurveTo(-20, -12, -6, -18); g.closePath();
      g.fillStyle = 'rgba(150,215,200,.55)'; g.fill();
      R(g, -11, -6, 22, 32, 4); paint(g, '#f6e6c4', 0, 10, 16, 2.4); g.beginPath(); g.moveTo(-6, 2); g.lineTo(6, 2); g.moveTo(-6, 8); g.lineTo(4, 8); g.moveTo(-6, 14); g.lineTo(6, 14); stroke(g, '#b89870', 1.6);
      R(g, -11, 18, 22, 4, 2); flat(g, '#e2574c', 0);
      g.beginPath(); g.moveTo(-6, -26); g.lineTo(6, -26); g.lineTo(6, -18); g.quadraticCurveTo(20, -12, 20, 4); g.lineTo(20, 30); g.quadraticCurveTo(20, 36, 14, 36); g.lineTo(-14, 36); g.quadraticCurveTo(-20, 36, -20, 30); g.lineTo(-20, 4); g.quadraticCurveTo(-20, -12, -6, -18); g.closePath(); stroke(g, '#3f8a7a', 3.6);
      HL(g, -14, 8, 2.4, 14, 0, .7); g.restore();
    }],
    ['kompass', g => {
      sh(g, 34);
      E(g, 50, 54, 36, 36); paint(g, '#d9962a', 44, 46, 38); E(g, 50, 54, 28, 28); paint(g, '#fff6e6', 46, 50, 28, 3);
      dot(g, 50, 16, 5, '#d9962a'); g.beginPath(); g.arc(50, 14, 6, PI, 0); stroke(g, '#8a5a12', 3);
      for (let i = 0; i < 8; i++) { const a = i * PI / 4; g.beginPath(); g.moveTo(50 + Math.cos(a) * 22, 54 + Math.sin(a) * 22); g.lineTo(50 + Math.cos(a) * 26, 54 + Math.sin(a) * 26); stroke(g, '#b8873a', 2); }
      PL(g, [50, 32, 56, 54, 44, 54]); flat(g, '#e2574c', 2, '#8a2f26'); PL(g, [50, 76, 56, 54, 44, 54]); flat(g, '#8e98a6', 2, '#4d5560'); dot(g, 50, 54, 3, '#d9962a');
      HL(g, 40, 42, 8, 4, -.6, .6);
    }],
    ['aardekirst', g => { sh(g, 42, 92); ART.drawChest(g, 3, true); }]
  ]);

  // ================= chests, energy, coins =================
  ART.drawChest = function (g, lv, open) {
    const body = ['#b9784a', '#5f8fbf', '#e2574c'][Math.min(2, lv - 1)], band = lv >= 3 ? '#ffcf55' : lv === 2 ? '#c9d3dd' : '#8e6a4a';
    if (open) {
      g.beginPath(); g.moveTo(16, 46); g.lineTo(22, 16); g.lineTo(78, 16); g.lineTo(84, 46); g.closePath(); paint(g, dk(body, .25), 50, 30, 40);
      E(g, 50, 46, 32, 9); paint(g, '#ffcf55', 50, 42, 30, 3);
      coinAt(g, 36, 42, 7); coinAt(g, 58, 40, 7); coinAt(g, 48, 36, 7); dot(g, 66, 44, 5, '#fff'); spark(g, 40, 26, 7, '#fff7c2'); spark(g, 68, 22, 5, '#fff7c2');
      E(g, 68, 40, 5, 4); paint(g, '#6fd0e0', 68, 40, 5, 2);
    } else {
      g.beginPath(); g.moveTo(12, 50); g.lineTo(12, 40); g.bezierCurveTo(12, 18, 88, 18, 88, 40); g.lineTo(88, 50); g.closePath(); paint(g, lt(body, .1), 44, 32, 42);
      for (const x of [28, 72]) { g.beginPath(); g.moveTo(x, 50); g.lineTo(x, 26); stroke(g, dk(band, .5), 8); stroke(g, band, 4.5); }
    }
    R(g, 12, 48, 76, 38, 5); paint(g, body, 44, 60, 42);
    for (const x of [28, 72]) { R(g, x - 4.5, 48, 9, 38, 2); paint(g, band, x, 64, 8, 2.6); }
    R(g, 8, 46, 84, 8, 3); paint(g, band, 50, 48, 40, 3);
    R(g, 42, 52, 16, 16, 4); paint(g, '#ffcf55', 50, 58, 10, 3); dot(g, 50, 59, 2.4, '#6b3a12');
    if (!open) HL(g, 30, 32, 10, 3, -.1, .45);
    if (lv >= 3) { spark(g, 86, 26, 6, '#fff7c2'); spark(g, 14, 30, 4, '#fff7c2'); }
  };
  ART.def('kirst', [1, 2, 3].map(l => ['kirst' + l, g => { sh(g, 40, 90); ART.drawChest(g, l, false); }]));
  function bolt(g, x, y, s, rot) {
    g.save(); g.translate(x, y); g.rotate(rot || 0); g.scale(s, s);
    PL(g, [6, -30, -16, 2, -2, 2, -8, 30, 16, -6, 2, -6, 10, -30]); vpaint(g, '#ffd23f', -30, 30, 4.2 / s);
    HL(g, -1, -14, 3, 7, .6, .6); g.restore();
  }
  ART.def('energia', [
    ['energia1', g => { sh(g, 18); bolt(g, 50, 52, .8, .1); }],
    ['energia2', g => { sh(g, 24); bolt(g, 50, 52, 1.15, .1); spark(g, 76, 28, 6, '#fff7c2'); }],
    ['energia3', g => { sh(g, 28); bolt(g, 38, 54, .8, -.2); bolt(g, 62, 50, .95, .2); spark(g, 80, 26, 6, '#fff7c2'); }],
    ['energia4', g => {
      sh(g, 30); jarBody(g, 50, 58, 50, 56, '#bfe6ff', '#f2b84b'); bolt(g, 50, 60, .75, .1);
      E(g, 50, 60, 22, 22); g.fillStyle = 'rgba(255,240,150,.25)'; g.fill(); spark(g, 36, 44, 4, '#fff');
    }],
    ['energia5', g => {
      sh(g, 34);
      const gr = g.createRadialGradient(50, 54, 6, 50, 54, 46); gr.addColorStop(0, 'rgba(255,240,140,.9)'); gr.addColorStop(1, 'rgba(255,220,90,0)'); E(g, 50, 54, 46, 44); g.fillStyle = gr; g.fill();
      jarBody(g, 50, 58, 56, 60, '#c8ecff', '#ffcf55'); bolt(g, 42, 60, .6, -.25); bolt(g, 58, 58, .7, .2);
      spark(g, 22, 26, 7, '#fff7c2'); spark(g, 80, 30, 5, '#fff7c2');
    }]
  ]);
  ART.def('raha', [
    ['raha1', g => { sh(g, 20); coinAt(g, 50, 54, 22); pstar(g, 50, 54, 8); g.fillStyle = '#e8a432'; g.fill(); }],
    ['raha2', g => { sh(g, 28); coinAt(g, 50, 70, 22); coinAt(g, 50, 60, 22); coinAt(g, 50, 50, 22); coinAt(g, 30, 74, 12); }],
    ['raha3', g => {
      sh(g, 30);
      g.beginPath(); g.moveTo(34, 36); g.quadraticCurveTo(10, 88, 30, 90); g.lineTo(70, 90); g.quadraticCurveTo(90, 88, 66, 36); g.closePath(); paint(g, '#c98b55', 46, 62, 40);
      g.beginPath(); g.moveTo(34, 36); g.lineTo(28, 24); g.lineTo(40, 28); g.lineTo(50, 20); g.lineTo(60, 28); g.lineTo(72, 24); g.lineTo(66, 36); g.closePath(); paint(g, '#b5763f', 50, 28, 20, 3.4);
      R(g, 32, 34, 36, 6, 3); flat(g, '#e2574c', 3); coinAt(g, 50, 64, 13); coinAt(g, 72, 82, 9);
    }],
    ['raha4', g => {
      sh(g, 42, 90);
      const r = srnd(4); const pts = []; for (let i = 0; i < 18; i++) { const row = i < 7 ? 0 : i < 12 ? 1 : i < 16 ? 2 : 3; pts.push([24 + (i - [0, 7, 12, 16][row]) * 10.5 + row * 5 + (r() - .5) * 3, 80 - row * 12]); }
      for (const [x, y] of pts) coinAt(g, x, y, 11);
      E(g, 32, 66, 6, 5); paint(g, '#6fd0e0', 32, 66, 6, 2.4); E(g, 66, 58, 6, 5); paint(g, '#e86a9a', 66, 58, 6, 2.4);
      spark(g, 74, 30, 7, '#fff7c2'); spark(g, 30, 36, 5, '#fff7c2');
    }]
  ]);

  // ================= generators =================
  const gens = {
    ahi: [(g, lv) => { // whitewashed island bread oven with a warm glow
      R(g, 18, 82, 64, 8, 3); paint(g, '#a7a097', 50, 86, 34);
      R(g, 66, 12, 12, 30, 2); paint(g, '#d9785a', 72, 26, 10, 3);
      if (lv >= 2) { E(g, 72, 10, 8, 4); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill(); }
      g.beginPath(); g.moveTo(16, 84); g.lineTo(16, 50); g.bezierCurveTo(16, 16, 84, 16, 84, 50); g.lineTo(84, 84); g.closePath(); paint(g, '#f4ece0', 40, 40, 42);
      g.save(); g.clip(); g.strokeStyle = 'rgba(160,130,100,.35)'; g.lineWidth = 1.4; for (let y = 30; y < 84; y += 9) { g.beginPath(); g.moveTo(10, y); g.lineTo(90, y); g.stroke(); } g.restore();
      g.beginPath(); g.moveTo(32, 84); g.lineTo(32, 62); g.arc(50, 62, 18, PI, 0); g.lineTo(68, 84); g.closePath(); flat(g, '#4a2416', 3.4, '#3a1c10');
      const gr = g.createRadialGradient(50, 78, 2, 50, 74, 18); gr.addColorStop(0, '#fff2a0'); gr.addColorStop(.5, '#ff9a3c'); gr.addColorStop(1, 'rgba(200,60,20,0)');
      g.beginPath(); g.moveTo(34, 84); g.lineTo(34, 64); g.arc(50, 64, 16, PI, 0); g.lineTo(66, 84); g.closePath(); g.fillStyle = gr; g.fill();
      if (lv >= 2) { E(g, 50, 78, 10, 5); paint(g, '#e9a75a', 50, 76, 10, 2.4); }
      g.beginPath(); g.moveTo(30, 62); g.arc(50, 62, 20, PI, 0); stroke(g, '#d9785a', 4);
      if (lv >= 3) { for (let i = 0; i < 5; i++) { daisySmall(g, 26 + i * 12, 40 - Math.sin(i / 4 * PI) * 8); } }
      HL(g, 30, 36, 6, 9, .5, .5);
    }, '#ffe2b0'],
    korv: [(g, lv) => {
      blueberry(g, 30, 46, 9); strawberry(g, 46, 40, 12, -.2); blueberry(g, 62, 44, 9); berryDot(g, 72, 48, 7, '#d6304d'); if (lv >= 2) { strawberry(g, 60, 34, 10, .4); blueberry(g, 40, 34, 7); }
      g.beginPath(); g.ellipse(50, 48, 32, 30, 0, PI, 0); stroke(g, dk(C.woodL, .55), 8); stroke(g, C.woodL, 4.5);
      leaf(g, 20, 52, 12, 5, PI + .3);
      g.beginPath(); g.moveTo(14, 52); g.lineTo(86, 52); g.lineTo(78, 86); g.quadraticCurveTo(50, 92, 22, 86); g.closePath(); paint(g, '#d59a5c', 44, 66, 40);
      g.save(); g.clip(); for (let y = 56; y < 92; y += 7) for (let x = 12 + (y % 14); x < 90; x += 14) { E(g, x, y, 6, 3); stroke(g, '#a8703c', 1.6); } g.restore();
      R(g, 12, 49, 76, 8, 4); paint(g, '#c78a50', 50, 52, 36, 3.2);
      if (lv >= 3) { R(g, 40, 62, 20, 12, 3); flat(g, '#fff6e6', 2.4, '#b8873a'); heart(g, 50, 69, 4); g.fillStyle = C.red; g.fill(); }
    }, '#ffd9e0'],
    tooriistakast: [(g, lv) => {
      hammer(g, 34, 34, .55, -.5); if (lv >= 2) saw(g, 66, 32, .42, -1.4); nail(g, 52, 24, 16, .1);
      R(g, 14, 46, 72, 40, 5); paint(g, C.woodL, 44, 58, 42);
      g.beginPath(); g.moveTo(14, 60); g.lineTo(86, 60); stroke(g, C.woodD, 2); plank(g, 14, 46, 72, 12, '#e3b07a');
      g.beginPath(); g.moveTo(26, 46); g.lineTo(26, 22); g.lineTo(74, 22); g.lineTo(74, 46); stroke(g, C.woodD, 7); stroke(g, C.woodL, 3.4);
      if (lv >= 3) { R(g, 40, 66, 20, 12, 3); paint(g, '#8e98a6', 50, 72, 10, 2.6); }
    }, '#e3ecf5'],
    aiapeenar: [(g, lv) => {
      R(g, 8, 52, 84, 34, 6); paint(g, C.wood, 44, 62, 44);
      R(g, 14, 50, 72, 12, 5); paint(g, '#7a4a30', 50, 54, 36, 3);
      for (let i = 0; i < 3; i++) { const x = 28 + i * 22; g.beginPath(); g.moveTo(x, 54); g.quadraticCurveTo(x - 2, 42, x + 1, 34); stroke(g, dk(C.leaf, .5), 5); stroke(g, '#7bc760', 3); leaf(g, x, 40, 13, 6, -.6); leaf(g, x, 42, 12, 5, PI + .6); }
      if (lv >= 2) { daisy(g, 28, 30, 8, '#fff', '#f6c33b', 8); cornflower(g, 72, 30, 8); }
      if (lv >= 3) tulip(g, 50, 28, 7, '#f58aa0');
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(8, 64 + i * 6); g.lineTo(92, 64 + i * 6); stroke(g, C.woodD, 1.4, .5); }
      // little watering can
      R(g, 66, 66, 22, 18, 4); paint(g, '#7fb3e0', 76, 72, 12, 3); g.beginPath(); g.moveTo(66, 72); g.lineTo(56, 62); stroke(g, '#3d6a8c', 5); stroke(g, '#7fb3e0', 2.4);
    }, '#dff4cf'],
    kalavork: [(g, lv) => {
      g.beginPath(); g.moveTo(16, 30); g.quadraticCurveTo(50, 20, 84, 30); g.lineTo(76, 82); g.quadraticCurveTo(50, 92, 24, 82); g.closePath(); g.fillStyle = 'rgba(214,190,150,.45)'; g.fill();
      g.save(); g.clip(); for (let i = -6; i < 12; i++) { g.beginPath(); g.moveTo(i * 9, 10); g.lineTo(i * 9 + 60, 100); stroke(g, '#a07a50', 2); g.beginPath(); g.moveTo(i * 9 + 60, 10); g.lineTo(i * 9, 100); stroke(g, '#a07a50', 2); } g.restore();
      fish(g, 46, 64, 34, 14, '#5d8bb0', .3, '#e8f1f7'); if (lv >= 2) fish(g, 60, 52, 30, 12, '#9fb4c4', -.4, '#eef4f8');
      g.beginPath(); g.moveTo(16, 30); g.quadraticCurveTo(50, 20, 84, 30); stroke(g, '#8a5232', 5);
      for (const x of [26, 50, 74]) { E(g, x, 28, 7, 6); paint(g, x === 50 ? '#e2574c' : '#ffcf55', x, 28, 7, 3); }
    }, '#d6eef8'],
    teekann: [(g, lv) => {
      steam(g, 66, 26, 16, .8);
      g.beginPath(); g.moveTo(24, 44); g.bezierCurveTo(30, 18, 70, 18, 76, 44); stroke(g, '#6b3a22', 8); stroke(g, '#c98a55', 4);
      g.beginPath(); g.moveTo(74, 60); g.quadraticCurveTo(90, 58, 92, 40); stroke(g, '#7a3a1a', 9); stroke(g, '#e08a4a', 5);
      g.beginPath(); g.moveTo(22, 84); g.bezierCurveTo(10, 50, 30, 40, 50, 40); g.bezierCurveTo(70, 40, 90, 50, 78, 84); g.closePath(); paint(g, '#e08a4a', 40, 54, 40);
      E(g, 50, 42, 18, 5); paint(g, '#f2a86a', 50, 42, 18, 3); dot(g, 50, 36, 4.4, '#f2a86a');
      if (lv >= 2) { daisy(g, 42, 64, 7, '#fff', '#f6c33b', 8); daisy(g, 60, 70, 5, '#fff', '#f6c33b', 7); }
      if (lv >= 3) { R(g, 20, 76, 60, 6, 3); flat(g, '#ffcf55', 2.4, '#8a5a12'); }
      HL(g, 30, 58, 4, 10, .3, .55);
    }, '#f8e3cf'],
    piimanou: [(g, lv) => {
      R(g, 34, 14, 32, 10, 4); paint(g, '#c9d3dd', 50, 18, 16, 3);
      g.beginPath(); g.moveTo(38, 24); g.lineTo(62, 24); g.lineTo(62, 34); g.quadraticCurveTo(76, 38, 76, 50); g.lineTo(76, 84); g.lineTo(24, 84); g.lineTo(24, 50); g.quadraticCurveTo(24, 38, 38, 34); g.closePath(); paint(g, '#dfe7ee', 40, 50, 40);
      R(g, 24, 50, 52, 6, 2); flat(g, '#a7b2c0', 0); R(g, 24, 76, 52, 6, 2); flat(g, '#a7b2c0', 0);
      SM(g, [30, 60, 40, 58, 42, 66, 34, 70]); flat(g, '#3a2a1c', 0); SM(g, [58, 66, 70, 62, 72, 72, 62, 74]); flat(g, '#3a2a1c', 0); E(g, 50, 46, 3, 2.4, .5); flat(g, '#3a2a1c', 0);
      g.beginPath(); g.arc(22, 54, 6, PI * .5, PI * 1.5); stroke(g, '#8e98a6', 4); g.beginPath(); g.arc(78, 54, 6, -PI * .5, PI * .5); stroke(g, '#8e98a6', 4);
      if (lv >= 2) { daisySmall(g, 50, 70); }
      if (lv >= 3) { E(g, 74, 22, 10, 7); paint(g, '#ffffff', 74, 22, 10, 2.4); }
      HL(g, 32, 44, 3, 12, .1, .55);
    }, '#e8f0f8'],
    taru: [(g, lv) => {
      R(g, 22, 82, 56, 8, 2); paint(g, C.woodD, 50, 86, 28);
      R(g, 20, 40, 60, 44, 3); paint(g, lv >= 2 ? '#7fb3e0' : '#f2c14b', 44, 56, 40);
      for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(20, 54 + i * 14); g.lineTo(80, 54 + i * 14); stroke(g, '#5a3a20', 2.4); }
      PL(g, [14, 42, 50, 18, 86, 42]); paint(g, '#d9785a', 50, 32, 36);
      R(g, 42, 74, 16, 5, 2); flat(g, '#3a2414', 0);
      bee(g, 22, 26, 6); if (lv >= 2) bee(g, 80, 60, 5); if (lv >= 3) { daisy(g, 30, 60, 6, '#fff', '#f6c33b', 8); daisy(g, 70, 46, 5, '#fff', '#f6c33b', 8); }
    }, '#fff0bf'],
    kudumiskorv: [(g, lv) => {
      E(g, 34, 44, 14, 14); paint(g, '#e2574c', 30, 40, 14); E(g, 58, 40, 14, 14); paint(g, '#5a86cf', 54, 36, 14); if (lv >= 2) { E(g, 46, 30, 12, 12); paint(g, '#f2b84b', 42, 26, 12); }
      g.beginPath(); g.moveTo(66, 12); g.lineTo(46, 56); stroke(g, '#8a5232', 4); g.beginPath(); g.moveTo(80, 18); g.lineTo(52, 58); stroke(g, '#8a5232', 4); dot(g, 66, 12, 4, '#f2c14b'); dot(g, 80, 18, 4, '#f2c14b');
      g.beginPath(); g.moveTo(14, 52); g.lineTo(86, 52); g.lineTo(80, 86); g.quadraticCurveTo(50, 92, 20, 86); g.closePath(); paint(g, '#d59a5c', 44, 66, 40);
      g.save(); g.clip(); for (let x = 14; x < 90; x += 8) { g.beginPath(); g.moveTo(x, 52); g.lineTo(x - 3, 92); stroke(g, '#a8703c', 2); } g.restore();
      R(g, 10, 48, 80, 9, 4); paint(g, '#c78a50', 50, 52, 36, 3.2);
      if (lv >= 3) { mitten(g, 74, 70, .4, .3, '#e2574c'); }
    }, '#f6dce8'],
    kaart: [(g, lv) => {
      g.beginPath(); g.moveTo(14, 26); g.lineTo(82, 22); g.lineTo(86, 78); g.lineTo(18, 82); g.closePath(); paint(g, '#f2deb0', 44, 46, 44);
      E(g, 14, 54, 6, 30); paint(g, '#e2c88f', 14, 54, 6, 3); E(g, 86, 50, 6, 30); paint(g, '#e2c88f', 86, 50, 6, 3);
      SM(g, [32, 40, 50, 34, 64, 44, 60, 62, 42, 66, 30, 56]); flat(g, '#a9d48a', 2.4, '#5c8a4a');
      g.beginPath(); g.moveTo(24, 74); g.quadraticCurveTo(40, 60, 54, 52); g.setLineDash([3, 4]); stroke(g, '#b8473c', 2.4); g.setLineDash([]);
      PL(g, [50, 46, 60, 56], true); stroke(g, '#d9473c', 4); PL(g, [60, 46, 50, 56], true); stroke(g, '#d9473c', 4);
      if (lv >= 2) { star(g, 72, 34, 6, 2.4, 4); g.fillStyle = '#8a5a3a'; g.fill(); }
      if (lv >= 3) { shell(g, 72, 70, .25, '#f7a8a0'); }
    }, '#f8ead0']
  };
  for (const k in gens) ART.def(k, gen(gens[k][0], gens[k][1], 5).map((e, i) => [k + (i ? i + 1 : ''), e[1]]));
  ART.generators = Object.keys(gens);
  // which chain each generator makes (for galleries and for anyone who wants a default)
  ART.genChain = { ahi: 'pagar', korv: 'mari', tooriistakast: 'tooriist', aiapeenar: 'lill', kalavork: 'kala', teekann: 'tee', piimanou: 'piim', taru: 'mesi', kudumiskorv: 'kudum', kaart: 'meri' };
  ART.chains = ['pagar', 'lill', 'tooriist', 'kala', 'tee', 'mari', 'piim', 'mesi', 'kudum', 'meri'];
  // English and alternative keys other code might use
  Object.assign(ART.alias, {
    bakery: 'pagar', bread: 'pagar', leib: 'pagar', flowers: 'lill', lilled: 'lill', aed: 'lill', tools: 'tooriist', too: 'tooriist', tööriist: 'tooriist', fish: 'kala',
    tea: 'tee', berries: 'mari', marjad: 'mari', milk: 'piim', dairy: 'piim', honey: 'mesi', knit: 'kudum', knitting: 'kudum', sea: 'meri', treasure: 'meri',
    energy: 'energia', chest: 'kirst', coins: 'raha', oven: 'ahi', basket: 'korv', toolbox: 'tooriistakast', gardenbed: 'aiapeenar', net: 'kalavork', kalavõrk: 'kalavork',
    teapot: 'teekann', churn: 'piimanou', piimanõu: 'piimanou', hive: 'taru', map: 'kaart', 'tööriistakast': 'tooriistakast'
  });
})();
