// ===== ART extras (Ash): weekly event chains, version 3 phase B icons and the photo-mode postcard. =====
//   ART.item('ev_garden' | 'ev_fashion' | 'ev_wedding' | 'ev_beach', 1..6, px)  event chains (6 levels each).
//   Icons: 'pass' (season pass ticket), 'wardrobe' (dress on a hanger), 'camera', 'palette' (design styles), 'island',
//          'party' (weekly event popper), 'paw' (pets), and event currency tokens 'cur_garden' | 'cur_fashion' |
//          'cur_wedding' | 'cur_beach'. The older 'event' calendar icon is unchanged.
//   ART.postcard(ctx, w, h, drawScene, opts) draws a full-screen postcard for photo mode: a soft backdrop, a white card,
//          the photo (drawScene(ctx, x, y, w, h) is called clipped to it), a stamp, washi tape and a caption.
//          opts: { caption (default 'Tervitused Saarepagarist!'), sub (e.g. the island or area name), date (Date|string|false),
//          t }. Returns the photo rect { x, y, w, h }.
(function (A) {
  const { E, R, PL, SM, paint, flat, vpaint, stroke, HL, dot, star, pstar, heart, shadow, srnd, lt, dk, rgba, mk } = A.H;
  const PI = Math.PI, TAU = PI * 2;
  const sh = (g, rx, y) => shadow(g, 50, y || 90, rx || 30, 5.5);
  function petal5(g, x, y, r, col, cen) { for (let k = 0; k < 5; k++) { const a = k * TAU / 5 - PI / 2; E(g, x + Math.cos(a) * r * .6, y + Math.sin(a) * r * .6, r * .55, r * .4, a); paint(g, col, x, y, r, 2.4); } E(g, x, y, r * .35, r * .35); paint(g, cen || '#ffd23f', x, y, r * .4, 2); }
  function tulip(g, x, y, s, col) {
    g.beginPath(); g.moveTo(x - s, y - s * .6); g.lineTo(x - s * .5, y - s * .1); g.lineTo(x, y - s * .9); g.lineTo(x + s * .5, y - s * .1); g.lineTo(x + s, y - s * .6);
    g.quadraticCurveTo(x + s * 1.05, y + s * .9, x, y + s * .9); g.quadraticCurveTo(x - s * 1.05, y + s * .9, x - s, y - s * .6); g.closePath(); paint(g, col, x, y, s * 1.2, 3); HL(g, x - s * .45, y + s * .1, s * .15, s * .35, 0, .45);
  }
  function rose(g, x, y, r, col) { E(g, x, y, r, r * .92); paint(g, col, x, y, r, 2.6); g.beginPath(); g.arc(x, y + r * .05, r * .55, PI * .9, PI * 2.4); stroke(g, dk(col, .35), 2); g.beginPath(); g.arc(x + r * .05, y, r * .25, 0, PI * 1.6); stroke(g, dk(col, .35), 1.6); }
  function leaf(g, x, y, len, w, rot, col) { g.save(); g.translate(x, y); g.rotate(rot); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * .5, -w, len, 0); g.quadraticCurveTo(len * .5, w, 0, 0); g.closePath(); paint(g, col || '#4fd07a', len * .45, 0, len * .6, 3); g.restore(); }
  function stem(g, x0, y0, x1, y1) { g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + 4, (y0 + y1) / 2, x1, y1); stroke(g, '#2f9a4a', 4); }
  function pot(g, y, col) { PL(g, [28, y, 72, y, 66, 90, 34, 90]); paint(g, col || '#ff8a5a', 50, y + 12, 26); R(g, 24, y - 6, 52, 10, 4); paint(g, lt(col || '#ff8a5a', .15), 50, y - 1, 26); }
  // ---------- ev_garden: Aiapidu ----------
  A.def('ev_garden', [
    ['seemnepakk', g => { sh(g, 26); R(g, 26, 14, 48, 70, 6); paint(g, '#fff4d8', 50, 40, 40); R(g, 26, 14, 48, 12, 6); paint(g, '#7fd07a', 50, 20, 26); PL(g, [26, 22, 74, 22], true); stroke(g, '#4f9a4a', 2); petal5(g, 50, 52, 12, '#ff6b9a'); stem(g, 50, 64, 50, 76); for (let i = 0; i < 3; i++) E(g, 40 + i * 10, 80, 2.4, 3.4); g.fillStyle = '#8a5a30'; g.fill(); }],
    ['idupott', g => { sh(g, 24); stem(g, 50, 62, 50, 30); leaf(g, 50, 40, 22, 9, -.6); leaf(g, 50, 36, 22, 9, -2.5); pot(g, 62); }],
    ['tulp', g => { sh(g, 26); stem(g, 50, 70, 50, 40); leaf(g, 50, 66, 24, 9, -1.1); leaf(g, 50, 62, 24, 9, -2.1); tulip(g, 50, 32, 16, '#ff4f6a'); pot(g, 68, '#7fc8ff'); }],
    ['lillekimp', g => { sh(g, 28); PL(g, [30, 40, 70, 40, 56, 92, 44, 92]); paint(g, '#fff0e0', 50, 64, 28); tulip(g, 36, 30, 10, '#ff4f9a'); tulip(g, 64, 30, 10, '#ffb21e'); petal5(g, 50, 22, 11, '#ffffff'); petal5(g, 40, 40, 8, '#b79cff'); petal5(g, 60, 40, 8, '#ff8fb8'); PL(g, [40, 70, 60, 70, 56, 78, 44, 78]); paint(g, '#ff5a8a', 50, 74, 10); }],
    ['aiakorv', g => { sh(g, 36); g.beginPath(); g.arc(50, 52, 30, PI, 0); stroke(g, '#b9784a', 6); for (let i = 0; i < 5; i++) petal5(g, 26 + i * 12, 50 - (i % 2) * 8, 9, ['#ff4f9a', '#ffffff', '#ffb21e', '#b79cff', '#ff6b6b'][i]); leaf(g, 22, 56, 14, 6, -2.6); leaf(g, 78, 56, 14, 6, -.5); R(g, 16, 54, 68, 36, 10); paint(g, '#e0a868', 50, 70, 36); for (let i = 0; i < 3; i++) { PL(g, [18, 62 + i * 9, 82, 62 + i * 9], true); stroke(g, '#b9784a', 2); } R(g, 40, 64, 20, 10, 3); paint(g, '#ff8fb8', 50, 69, 10, 2); }],
    ['lehtla', g => { sh(g, 40, 92); R(g, 14, 84, 72, 8, 3); paint(g, '#f4f0ff', 50, 88, 36); for (const x of [20, 40, 60, 80]) { R(g, x - 3, 44, 6, 42, 2); paint(g, '#ffffff', x, 64, 10); } PL(g, [8, 46, 50, 12, 92, 46]); paint(g, '#7fd0b0', 50, 32, 42); R(g, 8, 42, 84, 8, 3); paint(g, '#5fc0a0', 50, 46, 40); dot(g, 50, 10, 4, '#ffd23f'); for (let i = 0; i < 9; i++) { const x = 14 + i * 9; rose(g, x, 52 + Math.sin(i * 1.3) * 3, 4.4, i % 2 ? '#ff8fb8' : '#ffffff'); } for (const x of [14, 86]) for (let k = 0; k < 3; k++) rose(g, x, 60 + k * 9, 4, k % 2 ? '#ff4f9a' : '#ffd0dc'); }]
  ]);
  // ---------- ev_fashion: Moenädal ----------
  A.def('ev_fashion', [
    ['nööp', g => { sh(g, 26); E(g, 50, 50, 34, 34); paint(g, '#ff7ab6', 50, 50, 34); E(g, 50, 50, 24, 24); stroke(g, '#d84a8a', 3); for (const [x, y] of [[42, 42], [58, 42], [42, 58], [58, 58]]) { E(g, x, y, 4.4, 4.4); g.fillStyle = '#b8306a'; g.fill(); } PL(g, [42, 42, 58, 58], true); stroke(g, '#ffffff', 2.4); PL(g, [58, 42, 42, 58], true); stroke(g, '#ffffff', 2.4); }],
    ['niidirull', g => { sh(g, 26); R(g, 28, 18, 44, 10, 4); paint(g, '#e0a868', 50, 22, 22); R(g, 28, 74, 44, 10, 4); paint(g, '#e0a868', 50, 78, 22); R(g, 32, 28, 36, 46, 4); paint(g, '#7fd0ff', 50, 50, 22); for (let i = 0; i < 7; i++) { PL(g, [32, 32 + i * 6, 68, 30 + i * 6], true); stroke(g, '#4aa8e0', 1.6); } g.beginPath(); g.moveTo(68, 40); g.quadraticCurveTo(86, 46, 80, 70); stroke(g, '#4aa8e0', 2.4); PL(g, [78, 26, 88, 78], true); stroke(g, '#b8c4d8', 3); E(g, 79.4, 32, 1.4, 3); g.fillStyle = '#ffffff'; g.fill(); }],
    ['pael', g => { sh(g, 30); for (const s of [-1, 1]) { g.beginPath(); g.moveTo(50, 46); g.bezierCurveTo(50 + s * 20, 20, 50 + s * 44, 30, 50 + s * 34, 52); g.bezierCurveTo(50 + s * 28, 62, 50 + s * 12, 56, 50, 46); g.closePath(); paint(g, '#ff4f6a', 50 + s * 24, 40, 24); } for (const s of [-1, 1]) { PL(g, [50, 50, 50 + s * 10, 86, 50 + s * 18, 80]); paint(g, '#e03a5a', 50 + s * 10, 70, 18); } E(g, 50, 48, 9, 9); paint(g, '#ff6b84', 50, 48, 9); }],
    ['kübar', g => { sh(g, 40, 80); E(g, 50, 70, 44, 14); paint(g, '#f2d08a', 50, 68, 44); g.beginPath(); g.moveTo(26, 68); g.bezierCurveTo(26, 30, 74, 30, 74, 68); g.closePath(); paint(g, '#f6dc9a', 46, 46, 28); R(g, 26, 56, 48, 10, 3); paint(g, '#b44aff', 50, 60, 24); petal5(g, 70, 58, 8, '#ff8fb8'); }],
    ['käekott', g => { sh(g, 32); g.beginPath(); g.arc(50, 40, 18, PI, 0); stroke(g, '#c03a7a', 6); R(g, 18, 38, 64, 48, 12); paint(g, '#ff5aa0', 50, 60, 36); R(g, 18, 38, 64, 18, 10); paint(g, '#ff7ab6', 50, 46, 34); R(g, 42, 50, 16, 10, 3); paint(g, '#ffd23f', 50, 55, 8, 2); for (let i = 0; i < 6; i++) dot(g, 24 + i * 10.4, 80, 1.6, '#ffffff'); }],
    ['kleit', g => { sh(g, 32, 94); g.beginPath(); g.moveTo(50, 6); g.quadraticCurveTo(58, 6, 56, 14); stroke(g, '#8a8aa8', 3); PL(g, [24, 22, 50, 12, 76, 22], true); stroke(g, '#8a8aa8', 3.4); g.beginPath(); g.moveTo(38, 22); g.lineTo(62, 22); g.lineTo(60, 44); g.quadraticCurveTo(80, 70, 84, 92); g.quadraticCurveTo(50, 98, 16, 92); g.quadraticCurveTo(20, 70, 40, 44); g.closePath(); paint(g, '#7fd0ff', 50, 52, 40); R(g, 38, 42, 24, 6, 3); paint(g, '#ffd23f', 50, 45, 12, 2); g.beginPath(); g.moveTo(40, 60); g.quadraticCurveTo(36, 78, 28, 90); stroke(g, '#ffffff', 2, .7); const r = srnd(4); for (let i = 0; i < 9; i++) A.sparkAt(g, 28 + r() * 44, 52 + r() * 36, 2 + r() * 2, '#ffffff'); }]
  ]);
  // ---------- ev_wedding: Pulmad ----------
  A.def('ev_wedding', [
    ['roosinupp', g => { sh(g, 20); stem(g, 50, 88, 50, 46); leaf(g, 50, 70, 18, 8, -.5); leaf(g, 50, 62, 18, 8, -2.6); g.beginPath(); g.moveTo(50, 20); g.bezierCurveTo(68, 30, 64, 50, 50, 50); g.bezierCurveTo(36, 50, 32, 30, 50, 20); g.closePath(); paint(g, '#ff4f7a', 48, 34, 18); PL(g, [40, 46, 50, 54, 60, 46, 50, 60]); paint(g, '#3fb85a', 50, 52, 10); }],
    ['küünal', g => { sh(g, 26); R(g, 26, 78, 48, 10, 4); paint(g, '#ffd23f', 50, 82, 24); R(g, 36, 36, 28, 44, 6); paint(g, '#fff6ee', 50, 56, 22); g.beginPath(); g.moveTo(40, 38); g.quadraticCurveTo(42, 48, 40, 52); stroke(g, '#ffffff', 3, .9); PL(g, [50, 36, 50, 28], true); stroke(g, '#5a4a3a', 2); g.beginPath(); g.moveTo(50, 8); g.bezierCurveTo(60, 20, 58, 28, 50, 30); g.bezierCurveTo(42, 28, 40, 20, 50, 8); g.closePath(); vpaint(g, '#ffb21e', 8, 30, 2.4); E(g, 50, 24, 3, 4); g.fillStyle = '#fff6c0'; g.fill(); heart(g, 50, 62, 7); g.fillStyle = '#ff8fb0'; g.fill(); }],
    ['pruudikimp', g => { sh(g, 26); PL(g, [42, 56, 58, 56, 54, 92, 46, 92]); paint(g, '#7fc06a', 50, 76, 14); R(g, 40, 64, 20, 9, 3); paint(g, '#ffffff', 50, 68, 10, 2); leaf(g, 30, 48, 14, 6, 2.6); leaf(g, 70, 48, 14, 6, .5); for (const [x, y, c] of [[38, 40, '#ffffff'], [62, 40, '#ffd0dc'], [50, 30, '#ffffff'], [50, 48, '#ffb0c6'], [32, 30, '#ffd0dc'], [68, 30, '#ffffff']]) rose(g, x, y, 9, c); for (let i = 0; i < 5; i++) dot(g, 26 + i * 12, 22 + (i % 2) * 30, 2.4, '#ffffff'); }],
    ['sõrmused', g => { sh(g, 32); R(g, 18, 56, 64, 30, 8); paint(g, '#ff5a8a', 50, 70, 32); R(g, 22, 22, 56, 36, 8); paint(g, '#ff7aa6', 50, 38, 28); R(g, 26, 52, 48, 10, 4); g.fillStyle = '#ffffff'; g.fill(); for (const [x, c] of [[42, '#ffd23f'], [58, '#d8e4f8']]) { E(g, x, 46, 10, 10); stroke(g, dk(c, .4), 6); E(g, x, 46, 10, 10); stroke(g, c, 4); } PL(g, [56, 32, 60, 28, 64, 32, 60, 38]); paint(g, '#bfefff', 60, 33, 6, 1.6); }],
    ['pulmakook', g => { sh(g, 36, 92); R(g, 14, 84, 72, 6, 3); paint(g, '#e0d8f0', 50, 87, 36); R(g, 20, 62, 60, 24, 6); paint(g, '#fffaf4', 50, 74, 30); R(g, 28, 42, 44, 22, 6); paint(g, '#fffaf4', 50, 52, 22); R(g, 36, 24, 28, 20, 5); paint(g, '#fffaf4', 50, 34, 14); for (const [y, x0, n] of [[64, 22, 8], [44, 30, 6], [26, 38, 4]]) for (let i = 0; i < n; i++) { g.beginPath(); g.arc(x0 + 4 + i * 7.4, y, 3.6, 0, PI); g.fillStyle = '#ffd0dc'; g.fill(); } for (const x of [30, 50, 70]) rose(g, x, 80, 4, '#ff8fb0'); heart(g, 50, 18, 6); paint(g, '#ff4f7a', 50, 14, 6, 2); }],
    ['pulmakaar', g => { sh(g, 40, 92); g.beginPath(); g.moveTo(18, 90); g.lineTo(18, 46); g.arc(50, 46, 32, PI, 0); g.lineTo(82, 90); stroke(g, '#9a8aa8', 10); g.beginPath(); g.moveTo(18, 90); g.lineTo(18, 46); g.arc(50, 46, 32, PI, 0); g.lineTo(82, 90); stroke(g, '#ffffff', 7); const r = srnd(6); for (let i = 0; i < 16; i++) { const u = i / 15, a = PI + u * PI, x = 50 + Math.cos(a) * 32, y = 46 + Math.sin(a) * 32; leaf(g, x, y, 9, 4, r() * 6, '#4fbf6a'); rose(g, x + (r() - .5) * 4, y + (r() - .5) * 4, 4.6, i % 3 === 0 ? '#ff4f7a' : i % 3 === 1 ? '#ffd0dc' : '#ffffff'); } for (const x of [18, 82]) for (let k = 0; k < 3; k++) rose(g, x, 58 + k * 11, 4.4, k % 2 ? '#ffffff' : '#ff8fb0'); heart(g, 50, 56, 11); paint(g, '#ff4f9a', 50, 50, 11, 2.4); }]
  ]);
  // ---------- ev_beach: Rannafestival ----------
  A.def('ev_beach', [
    ['merekarp', g => { sh(g, 28); g.beginPath(); g.moveTo(50, 84); g.bezierCurveTo(14, 70, 14, 26, 50, 18); g.bezierCurveTo(86, 26, 86, 70, 50, 84); g.closePath(); paint(g, '#ffb48a', 50, 46, 36); for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(50, 82); g.quadraticCurveTo(50 + i * 9, 50, 50 + i * 10, 22 + Math.abs(i) * 3); stroke(g, '#e8805a', 2); } R(g, 40, 80, 20, 8, 3); paint(g, '#ff9a6a', 50, 84, 10, 2); }],
    ['liivaämber', g => { sh(g, 30); g.beginPath(); g.arc(50, 34, 20, PI, 0); stroke(g, '#2f9ad8', 3.4); PL(g, [24, 34, 76, 34, 68, 88, 32, 88]); paint(g, '#ff5a6a', 50, 58, 30); R(g, 22, 30, 56, 8, 3); paint(g, '#ff7a8a', 50, 34, 28); E(g, 50, 32, 24, 3); g.fillStyle = '#ffe0a0'; g.fill(); pstar(g, 50, 62, 9); g.fillStyle = '#ffd23f'; g.fill(); R(g, 70, 20, 6, 40, 3); paint(g, '#ffd23f', 73, 40, 6, 2); g.beginPath(); g.moveTo(66, 58); g.lineTo(80, 58); g.lineTo(78, 74); g.quadraticCurveTo(73, 80, 68, 74); g.closePath(); paint(g, '#ffd23f', 73, 66, 8, 2.4); }],
    ['rannapall', g => { sh(g, 32); const cols = ['#ff4f6a', '#ffffff', '#ffd23f', '#ffffff', '#3db8ff', '#ffffff']; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(50, 50); g.arc(50, 50, 36, -PI / 2 + i * PI / 3, -PI / 2 + (i + 1) * PI / 3); g.closePath(); paint(g, cols[i], 40, 38, 40, 0); } E(g, 50, 50, 36, 36); stroke(g, '#3a2358', 2.4); E(g, 50, 50, 7, 7); paint(g, '#ffffff', 50, 50, 7, 2); }],
    ['päikeseprillid', g => { sh(g, 34, 78); PL(g, [10, 40, 90, 40], true); stroke(g, '#3a2358', 4); for (const x of [30, 70]) { heart(g, x, 56, 22); paint(g, '#ff4f9a', x - 4, 48, 22, 3); heart(g, x, 56, 22); g.save(); g.clip(); E(g, x - 8, 44, 8, 5, -.5); g.fillStyle = 'rgba(255,255,255,.55)'; g.fill(); g.restore(); } PL(g, [44, 46, 50, 42, 56, 46], true); stroke(g, '#3a2358', 3.4); }],
    ['surfilaud', g => { sh(g, 22, 94); g.save(); g.translate(50, 50); g.rotate(.4); g.beginPath(); g.moveTo(0, -46); g.bezierCurveTo(18, -30, 18, 30, 0, 46); g.bezierCurveTo(-18, 30, -18, -30, 0, -46); g.closePath(); paint(g, '#2fd3c4', -4, -10, 30); g.save(); g.clip(); g.fillStyle = '#ffffff'; g.fillRect(-20, -6, 40, 8); g.fillStyle = '#ff7a6b'; g.fillRect(-20, 4, 40, 5); g.restore(); g.beginPath(); g.moveTo(0, -40); g.lineTo(0, 40); stroke(g, '#1aa89a', 1.6, .6); petal5(g, 0, -24, 7, '#ffd23f', '#ff7a6b'); g.restore(); }],
    ['rannaonn', g => { sh(g, 40, 92); R(g, 22, 44, 56, 46, 4); paint(g, '#ffffff', 50, 66, 30); g.save(); R(g, 22, 44, 56, 46, 4); g.clip(); for (let x = 22; x < 80; x += 12) { g.fillStyle = '#3db8ff'; g.fillRect(x, 44, 6, 46); } g.restore(); R(g, 40, 60, 20, 30, 8); paint(g, '#ffd23f', 50, 74, 12); PL(g, [12, 48, 50, 14, 88, 48]); paint(g, '#ff6b6b', 50, 34, 40); R(g, 10, 44, 80, 7, 3); paint(g, '#ff8a8a', 50, 47, 40); g.beginPath(); g.moveTo(50, 14); g.lineTo(50, 2); stroke(g, '#8a6a4a', 2.4); PL(g, [50, 2, 64, 6, 50, 10]); paint(g, '#ffd23f', 56, 6, 8, 1.6); E(g, 50, 30, 6, 6); paint(g, '#fff6c0', 50, 30, 6, 2); }]
  ]);
  A.eventChains = ['ev_garden', 'ev_fashion', 'ev_wedding', 'ev_beach'];
  // ---------- icons ----------
  const I = A.iconDefs;
  function badge(g, col, r) { r = r || 44; E(g, 50, 52, r, r); g.fillStyle = dk(col, .35); g.fill(); E(g, 50, 48, r, r); paint(g, col, 50, 48, r, 0); E(g, 50, 30, r * .7, r * .36); g.fillStyle = 'rgba(255,255,255,.3)'; g.fill(); }
  I.pass = g => { // a golden season-pass ticket with a star and a ribbon road
    g.save(); g.translate(50, 52); g.rotate(-.18);
    g.beginPath(); g.moveTo(-42, -26); g.lineTo(42, -26); g.lineTo(42, -8); g.arc(42, 0, 8, -PI / 2, PI / 2, true); g.lineTo(42, 26); g.lineTo(-42, 26); g.lineTo(-42, 8); g.arc(-42, 0, 8, PI / 2, -PI / 2, true); g.closePath(); paint(g, '#ffcf3a', -6, -8, 46, 0);
    for (let i = -18; i <= 18; i += 6) dot(g, 20, i, 1.6, '#e89a10');
    pstar(g, -8, 0, 18); paint(g, '#ff4f9a', -8, -4, 18, 0); pstar(g, -8, 2, 7); g.fillStyle = 'rgba(255,255,255,.4)'; g.fill();
    E(g, -24, -18, 10, 4, -.3); g.fillStyle = 'rgba(255,255,255,.45)'; g.fill(); g.restore();
  };
  I.wardrobe = g => { // a pink dress on a hanger
    g.beginPath(); g.moveTo(50, 8); g.quadraticCurveTo(60, 8, 58, 16); stroke(g, '#7a72a6', 4); PL(g, [20, 28, 50, 16, 80, 28], true); stroke(g, '#7a72a6', 5);
    g.beginPath(); g.moveTo(38, 26); g.lineTo(62, 26); g.lineTo(60, 46); g.quadraticCurveTo(80, 70, 86, 92); g.quadraticCurveTo(50, 98, 14, 92); g.quadraticCurveTo(20, 70, 40, 46); g.closePath(); paint(g, '#ff6bb0', 50, 56, 44, 0);
    R(g, 38, 44, 24, 7, 3); g.fillStyle = '#ffd23f'; g.fill(); for (let i = 0; i < 4; i++) dot(g, 32 + i * 12, 80, 2.4, '#ffffff'); HL(g, 34, 62, 4, 10, .3, .5);
  };
  I.camera = g => { // a mint instant camera
    R(g, 8, 26, 84, 62, 14); g.fillStyle = '#0f9a78'; g.fill(); R(g, 8, 22, 84, 62, 14); paint(g, '#5fe0b8', 50, 50, 46, 0);
    R(g, 14, 22, 72, 16, 8); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill(); R(g, 62, 12, 20, 12, 4); paint(g, '#ff6b8a', 72, 18, 10, 0);
    E(g, 50, 56, 22, 22); g.fillStyle = '#ffffff'; g.fill(); E(g, 50, 56, 16, 16); paint(g, '#3a3f72', 50, 56, 16, 0); E(g, 50, 56, 8, 8); g.fillStyle = '#7a8ae0'; g.fill(); dot(g, 45, 51, 4, 'rgba(255,255,255,.85)');
    R(g, 16, 30, 14, 9, 3); g.fillStyle = '#fff6c0'; g.fill(); A.sparkAt(g, 86, 12, 7, '#ffffff');
  };
  I.palette = g => { // a painter's palette with the three style colours
    g.beginPath(); g.moveTo(50, 10); g.bezierCurveTo(90, 10, 96, 50, 84, 66); g.bezierCurveTo(74, 80, 62, 66, 56, 76); g.bezierCurveTo(50, 90, 30, 92, 18, 80); g.bezierCurveTo(4, 64, 8, 10, 50, 10); g.closePath(); paint(g, '#ffe2b0', 44, 40, 46, 0);
    E(g, 62, 62, 7, 6); g.fillStyle = '#c99a5a'; g.fill();
    for (const [x, y, c] of [[30, 30, '#d9825b'], [52, 24, '#ecc27a'], [72, 34, '#8fae86'], [26, 52, '#ffb0c6'], [38, 70, '#3a4150']]) { E(g, x, y, 8, 7); paint(g, c, x, y, 8, 0); HL(g, x - 2.6, y - 2.4, 2.4, 1.4, -.5, .55); }
    g.save(); g.translate(76, 76); g.rotate(-.8); R(g, -3, -30, 6, 30, 3); g.fillStyle = '#7c5cff'; g.fill(); PL(g, [-4, 0, 4, 0, 0, 10]); g.fillStyle = '#ff4f9a'; g.fill(); g.restore();
  };
  I.island = g => { // a small round island with a palm, a cottage and the sea
    E(g, 50, 70, 46, 22); g.fillStyle = '#2f9ad8'; g.fill(); E(g, 50, 66, 46, 22); paint(g, '#5fd0ff', 50, 62, 46, 0);
    E(g, 50, 62, 32, 12); paint(g, '#ffe2a0', 50, 60, 32, 0); E(g, 50, 58, 26, 8); paint(g, '#7fdc6a', 48, 56, 26, 0);
    R(g, 52, 40, 20, 16, 2); paint(g, '#ffffff', 62, 48, 12, 0); PL(g, [48, 42, 62, 30, 76, 42]); paint(g, '#ff6b6b', 62, 36, 14, 0); R(g, 59, 47, 6, 9, 2); g.fillStyle = '#3db8ff'; g.fill();
    g.beginPath(); g.moveTo(36, 58); g.quadraticCurveTo(32, 36, 38, 20); stroke(g, '#a8683e', 4);
    for (const a of [-2.6, -1.9, -1.2, -.5]) { g.save(); g.translate(38, 20); g.rotate(a); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(10, -6, 20, 2); g.quadraticCurveTo(10, 2, 0, 0); g.fillStyle = '#2fc060'; g.fill(); g.restore(); }
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(14 + i * 26, 82 + (i % 2) * 4); g.quadraticCurveTo(20 + i * 26, 78 + (i % 2) * 4, 26 + i * 26, 82 + (i % 2) * 4); stroke(g, '#ffffff', 2.4, .8); }
  };
  I.party = g => { // a party popper with confetti
    g.save(); g.translate(52, 48); g.rotate(-2.36); PL(g, [-12, 0, 12, 0, 0, -50]); g.closePath(); paint(g, '#7c5cff', 0, -20, 26, 0);
    g.save(); PL(g, [-12, 0, 12, 0, 0, -50]); g.clip(); for (let i = 0; i < 4; i++) { g.fillStyle = '#ffd23f'; g.fillRect(-14, -12 - i * 12, 28, 4); } g.restore(); g.restore();
    const cs = ['#ff4f9a', '#ffd23f', '#3db8ff', '#2fd59a', '#ff7a6b']; const r = srnd(3);
    for (let i = 0; i < 10; i++) { const a = -1.5 + r() * 1.6, d = 10 + r() * 34; g.save(); g.translate(54 + Math.cos(a) * d, 46 + Math.sin(a) * d); g.rotate(r() * 3); R(g, -4, -2, 8, 4, 1.5); g.fillStyle = cs[i % 5]; g.fill(); g.restore(); }
    pstar(g, 78, 22, 11); paint(g, '#ffd23f', 78, 22, 11, 0);
  };
  I.paw = g => { badge(g, '#ffa24a'); E(g, 50, 62, 16, 13); g.fillStyle = '#ffffff'; g.fill(); for (const [x, y] of [[30, 42], [42, 30], [58, 30], [70, 42]]) { E(g, x, y, 7, 8.4); g.fill(); } };
  function token(g, col, inner) { E(g, 50, 55, 42, 42); g.fillStyle = dk(col, .35); g.fill(); E(g, 50, 49, 42, 42); paint(g, col, 50, 49, 42, 0); E(g, 50, 49, 32, 32); stroke(g, lt(col, .5), 3.4); inner(g); HL(g, 32, 28, 10, 5, -.7, .7); }
  I.cur_garden = g => token(g, '#5fd07a', g => { tulip(g, 50, 46, 14, '#ff4f6a'); g.beginPath(); g.moveTo(50, 58); g.lineTo(50, 70); stroke(g, '#2f8a3a', 4); });
  I.cur_fashion = g => token(g, '#ff6bb0', g => { for (const s of [-1, 1]) { g.beginPath(); g.moveTo(50, 50); g.bezierCurveTo(50 + s * 12, 34, 50 + s * 26, 40, 50 + s * 20, 54); g.bezierCurveTo(50 + s * 16, 60, 50 + s * 8, 56, 50, 50); g.closePath(); paint(g, '#ffffff', 50 + s * 14, 46, 14, 0); } E(g, 50, 50, 5, 5); g.fillStyle = '#ffd23f'; g.fill(); });
  I.cur_wedding = g => token(g, '#ff8fb0', g => { for (const x of [42, 58]) { E(g, x, 52, 11, 11); stroke(g, '#ffffff', 5); } PL(g, [53, 34, 58, 29, 63, 34, 58, 41]); g.fillStyle = '#d8f4ff'; g.fill(); });
  I.cur_beach = g => token(g, '#3db8ff', g => { g.beginPath(); g.moveTo(50, 70); g.bezierCurveTo(28, 62, 28, 34, 50, 30); g.bezierCurveTo(72, 34, 72, 62, 50, 70); g.closePath(); paint(g, '#ffe0c8', 50, 46, 22, 0); for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(50, 68); g.quadraticCurveTo(50 + i * 6, 50, 50 + i * 7, 33 + Math.abs(i) * 2); stroke(g, '#ff9a6a', 1.6); } });
  // ---------- postcard (photo mode) ----------
  function fmtDate(d) { const M = ['jaanuar', 'veebruar', 'märts', 'aprill', 'mai', 'juuni', 'juuli', 'august', 'september', 'oktoober', 'november', 'detsember']; return d.getDate() + '. ' + M[d.getMonth()] + ' ' + d.getFullYear(); }
  // Cached in two layers per size and caption (phase C): the backdrop and card under the photo, and the stamp, postmark,
  // tape and caption over it, both with the tilt baked in. Per frame only the photo (rendered unrotated offscreen, then
  // one rotated blit) and three sparkles are drawn.
  let _pc = null, _pcOff = null;
  A.postcard = function (ctx, w, h, drawScene, opts) {
    opts = opts || {}; const t = opts.t || 0, FONT = A.theme.font, sc = Math.min(4, Math.ceil(A.scaleOf(ctx) * 2 - .05) / 2); // half steps: the opening zoom does not rebuild every frame
    const m = Math.max(14, Math.min(w, h) * .05), cw = Math.min(w - m * 2, (h - m * 2) * 1.25), pad = Math.max(8, cw * .035);
    const pw = cw - pad * 2, ph = Math.min(pw * .68, h - m * 2 - pad * 2 - cw * .2), capH = Math.max(54, cw * .2), ch = pad * 2 + ph + capH;
    const cx = (w - cw) / 2, cy = (h - ch) / 2, tilt = opts.tilt != null ? opts.tilt : -.02, px = cx + pad, py = cy + pad;
    const cap = opts.caption || 'Tervitused Saarepagarist!';
    const sub = [opts.sub, opts.date === false ? null : (opts.date instanceof Date ? fmtDate(opts.date) : opts.date || fmtDate(new Date()))].filter(Boolean).join(' · ');
    const fs = Math.max(15, Math.min(30, cw * .062)), capY = py + ph + capH * .42;
    const key = Math.round(w) + 'x' + Math.round(h) + '@' + sc.toFixed(2) + '|' + tilt + '|' + cap + '|' + sub;
    if (!_pc || _pc.key !== key) {
      const mkL = () => { const c = mk(w * sc, h * sc), g = c.getContext('2d'); g.scale(sc, sc); g.translate(w / 2, h / 2); g.rotate(tilt); g.translate(-w / 2, -h / 2); return [c, g]; };
      const [uc, u] = mkL(), [oc, o] = mkL();
      // under: backdrop (unrotated) with bokeh, the card shadow and the card
      u.save(); u.setTransform(sc, 0, 0, sc, 0, 0);
      const bg = u.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#ffd6e8'); bg.addColorStop(.5, '#e6e0ff'); bg.addColorStop(1, '#cdeeff'); u.fillStyle = bg; u.fillRect(0, 0, w, h);
      const r0 = srnd(5); for (let i = 0; i < 16; i++) { const x = r0() * w, y = r0() * h, rr = 8 + r0() * 30; u.fillStyle = 'rgba(255,255,255,' + (.12 + r0() * .2) + ')'; u.beginPath(); u.arc(x, y, rr, 0, TAU); u.fill(); }
      u.restore();
      R(u, cx + 3, cy + 8, cw, ch, 10); u.fillStyle = 'rgba(60,40,120,.22)'; u.fill();
      R(u, cx, cy, cw, ch, 10); const cg = u.createLinearGradient(0, cy, 0, cy + ch); cg.addColorStop(0, '#ffffff'); cg.addColorStop(1, '#fbf6ff'); u.fillStyle = cg; u.fill();
      u.lineWidth = 1.5; u.strokeStyle = 'rgba(124,92,255,.18)'; u.stroke();
      R(u, px, py, pw, ph, 6); u.fillStyle = '#bfeaff'; u.fill();
      // over: vignette and frame line of the photo, stamp, postmark, washi tape, caption
      o.save(); R(o, px, py, pw, ph, 6); o.clip();
      const vg = o.createRadialGradient(px + pw / 2, py + ph / 2, Math.min(pw, ph) * .4, px + pw / 2, py + ph / 2, Math.max(pw, ph) * .75); vg.addColorStop(0, 'rgba(255,255,255,0)'); vg.addColorStop(1, 'rgba(80,40,120,.18)'); o.fillStyle = vg; o.fillRect(px, py, pw, ph);
      o.restore();
      R(o, px, py, pw, ph, 6); o.lineWidth = 1.2; o.strokeStyle = 'rgba(60,40,120,.25)'; o.stroke();
      const ss = Math.max(34, pw * .15), sx = px + pw - ss - pad * .6, sy = py + pad * .6;
      o.save(); o.translate(sx + ss / 2, sy + ss * .6); o.rotate(.08); o.translate(-ss / 2, -ss * .6);
      o.fillStyle = 'rgba(60,40,120,.2)'; R(o, 2, 3, ss, ss * 1.2, 2); o.fill();
      o.fillStyle = '#ffffff'; o.beginPath(); const sq = ss / 10;
      for (let i = 0; i <= 10; i++) { o.moveTo(i * sq + sq * .35, 0); o.arc(i * sq, 0, sq * .35, 0, TAU); o.moveTo(i * sq + sq * .35, ss * 1.2); o.arc(i * sq, ss * 1.2, sq * .35, 0, TAU); }
      o.rect(0, 0, ss, ss * 1.2); o.fill();
      R(o, sq * .6, sq * .6, ss - sq * 1.2, ss * 1.2 - sq * 1.2, 2); const sg = o.createLinearGradient(0, 0, 0, ss * 1.2); sg.addColorStop(0, '#ffe0ee'); sg.addColorStop(1, '#ffb0cc'); o.fillStyle = sg; o.fill();
      o.drawImage(A.item('bread', 7, Math.round(ss * .7 * sc)), ss * .15, ss * .2, ss * .7, ss * .7);
      o.font = '900 ' + (ss * .16) + 'px ' + FONT; o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillStyle = '#c0306a'; o.fillText('EESTI', ss / 2, ss * 1.02);
      o.restore();
      o.save(); o.globalAlpha = .45; o.strokeStyle = '#7a5aa8'; o.lineWidth = 1.4; const pmx = sx - ss * .2, pmy = sy + ss * .9;
      o.beginPath(); o.arc(pmx, pmy, ss * .42, 0, TAU); o.stroke(); o.beginPath(); o.arc(pmx, pmy, ss * .32, 0, TAU); o.stroke();
      for (let i = 0; i < 3; i++) { o.beginPath(); for (let x = 0; x <= ss * 1.2; x += 4) { const yy = pmy - ss * .2 + i * ss * .2 + Math.sin(x * .25) * 2; x ? o.lineTo(pmx + ss * .5 + x, yy) : o.moveTo(pmx + ss * .5, yy); } o.stroke(); }
      o.restore();
      for (const [tx, ty, a, col] of [[cx + cw * .12, cy, -.5, 'rgba(255,170,200,.82)'], [cx + cw * .9, cy + ch, -.5, 'rgba(160,220,255,.82)']]) {
        o.save(); o.translate(tx, ty); o.rotate(a); const tw = Math.max(46, cw * .18), th = tw * .32; o.fillStyle = col; o.fillRect(-tw / 2, -th / 2, tw, th);
        o.fillStyle = 'rgba(255,255,255,.45)'; for (let i = -tw / 2 + 4; i < tw / 2; i += 9) { o.beginPath(); o.arc(i, 0, th * .16, 0, TAU); o.fill(); } o.restore();
      }
      o.textAlign = 'center'; o.textBaseline = 'middle'; o.font = '900 ' + fs + 'px ' + FONT; o.lineJoin = 'round';
      o.lineWidth = fs * .22; o.strokeStyle = '#ffffff'; o.strokeText(cap, cx + cw / 2, capY);
      const tg = o.createLinearGradient(cx, 0, cx + cw, 0); tg.addColorStop(0, '#ff7a6b'); tg.addColorStop(.5, '#ff4f9a'); tg.addColorStop(1, '#7c5cff'); o.fillStyle = tg; o.fillText(cap, cx + cw / 2, capY);
      if (sub) { o.font = '800 ' + Math.max(11, fs * .5) + 'px ' + FONT; o.fillStyle = A.theme.ink2; o.fillText(sub, cx + cw / 2, capY + fs * .95); }
      for (const s of [-1, 1]) { const hx = cx + cw / 2 + s * (o.measureText(sub || '').width / 2 + fs * .6), hy = capY + fs * .95; if (sub) { heart(o, hx, hy + fs * .1, fs * .32); o.fillStyle = '#ff8fb0'; o.fill(); } }
      _pc = { key, uc, oc };
    }
    ctx.drawImage(_pc.uc, 0, 0, w, h);
    // the photo: drawn unrotated offscreen at the backing scale, then one rotated blit under the rounded clip
    const ow = Math.ceil(pw * sc), oh = Math.ceil(ph * sc);
    if (!_pcOff) _pcOff = mk(ow, oh); if (_pcOff.width !== ow || _pcOff.height !== oh) { _pcOff.width = ow; _pcOff.height = oh; }
    const og = _pcOff.getContext('2d'); og.setTransform(1, 0, 0, 1, 0, 0); og.clearRect(0, 0, ow, oh); og.fillStyle = '#bfeaff'; og.fillRect(0, 0, ow, oh);
    og.setTransform(sc, 0, 0, sc, -px * sc, -py * sc);
    try { drawScene && drawScene(og, px, py, pw, ph); } catch (e) { console.error('ART.postcard scene', e); }
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(tilt); ctx.translate(-w / 2, -h / 2);
    ctx.save(); R(ctx, px, py, pw, ph, 6); ctx.clip(); ctx.drawImage(_pcOff, px, py, pw, ph); ctx.restore();
    ctx.restore();
    ctx.drawImage(_pc.oc, 0, 0, w, h);
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(tilt); ctx.translate(-w / 2, -h / 2);
    for (let i = 0; i < 3; i++) { const a = (t * .6 + i / 3) % 1; A.sparkAt(ctx, cx + cw * (.15 + i * .35), cy + ch - capH * .15 - (i % 2) * 6, Math.max(.1, fs * .3 * Math.sin(a * PI)), '#ffd23f'); }
    ctx.restore();
    // the photo rect in unrotated screen space (approximately; the tilt is small)
    return { x: px, y: py, w: pw, h: ph };
  };
})(ART);
