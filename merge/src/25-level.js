// ===== LEVEL ART (Ash): obstacles, boosters, the key item, new icons and the idle "breathing" helper. =====
//   ART.obstacle(kind, px, state) -> cached px×px canvas drawn OVER a board cell (same footprint as ART.cell).
//       kind 'ice' | 'box' | 'cobweb' | 'lockedCrate' | 'sand' | 'bubble'; state 0..2 = damage (ice cracks, box splits,
//       web tears, sand thins, goo grows). ice and cobweb are see-through (draw the item first), the others cover the cell.
//   ART.booster(kind, px, badge) -> cached canvas: 'wand' | 'scissors' | 'shuffle' | 'moves5' (badge = on a glossy round button)
//   ART.item('key', 1, px) the golden key for locked crates. New icons: piggy, calendar, heart, wheel, map, crown, moves, trophy, rest, key, streak.
//   ART.itemIdle(seed, t) -> { sx, sy, rot, dy }  breathing / wobble transform (shared object; pivot = item bottom centre, dy × size).
//   ART.drawItemIdle(ctx, img, cx, cy, s, seed, t)  draws an item image centred at cx,cy (size s) with that transform.
(function (A) {
  const { E, R, PL, SM, paint, flat, vpaint, stroke, HL, dot, pstar, heart, srnd, lt, dk, rgba, mk } = A.H;
  const TAU = Math.PI * 2, FONT = A.theme.font;

  // ---------------- obstacles ----------------
  const body = g => R(g, 5, 4, 90, 89, 21);
  function crack(g, pts, w) {
    PL(g, pts, true); g.lineWidth = w + 2.4; g.strokeStyle = 'rgba(40,90,190,.55)'; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke();
    g.lineWidth = w; g.strokeStyle = 'rgba(255,255,255,.95)'; g.stroke();
  }
  const OB = {};
  OB.ice = (g, st) => {
    body(g); const gr = g.createLinearGradient(10, 4, 90, 93); gr.addColorStop(0, 'rgba(235,250,255,.72)'); gr.addColorStop(.5, 'rgba(160,220,255,.42)'); gr.addColorStop(1, 'rgba(110,175,255,.62)');
    g.fillStyle = gr; g.fill();
    g.save(); body(g); g.clip();
    // glossy diagonal streaks
    g.fillStyle = 'rgba(255,255,255,.38)'; PL(g, [-10, 46, 46, -10, 62, -10, -10, 62]); g.fill();
    g.fillStyle = 'rgba(255,255,255,.22)'; PL(g, [-10, 76, 76, -10, 84, -10, -10, 84]); g.fill();
    g.fillStyle = 'rgba(255,255,255,.18)'; PL(g, [40, 110, 110, 40, 110, 56, 56, 110]); g.fill();
    // frosty corners
    for (const [x, y] of [[8, 8], [92, 8], [8, 90], [92, 90]]) { const fg = g.createRadialGradient(x, y, 0, x, y, 22); fg.addColorStop(0, 'rgba(255,255,255,.9)'); fg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = fg; g.fillRect(x - 22, y - 22, 44, 44); }
    // inner bevel
    R(g, 12, 10, 76, 76, 15); g.lineWidth = 2.5; g.strokeStyle = 'rgba(255,255,255,.55)'; g.stroke();
    if (st >= 1) { crack(g, [30, 4, 38, 26, 30, 38, 44, 52], 2.2); crack(g, [38, 26, 54, 30], 1.6); crack(g, [96, 60, 74, 66, 66, 84, 70, 96], 2.2); }
    if (st >= 2) {
      crack(g, [44, 52, 58, 58, 66, 84], 2); crack(g, [4, 66, 22, 62, 30, 74], 2); crack(g, [58, 58, 76, 44, 96, 40], 2); crack(g, [54, 30, 66, 14, 70, 4], 1.6);
      // a chipped-off corner
      g.globalCompositeOperation = 'destination-out'; PL(g, [70, 4, 96, 4, 96, 28, 84, 22, 80, 12]); g.fill(); g.globalCompositeOperation = 'source-over';
      PL(g, [70, 4, 80, 12, 84, 22, 96, 28], true); g.lineWidth = 2.5; g.strokeStyle = 'rgba(255,255,255,.9)'; g.stroke();
    }
    g.restore();
    body(g); g.lineWidth = 3.4; g.strokeStyle = 'rgba(60,140,235,.85)'; g.stroke();
    g.beginPath(); g.arc(26, 24, 16, Math.PI * 1.05, Math.PI * 1.5); stroke(g, '#ffffff', 4, .9);
    A.sparkAt(g, 78, 76, 7, 'rgba(255,255,255,.95)'); if (st < 2) A.sparkAt(g, 82, 18, 5, 'rgba(255,255,255,.9)');
  };
  function crate(g, col, st) {
    R(g, 7, 11, 86, 85, 12); g.fillStyle = 'rgba(60,30,90,.25)'; g.fill();
    R(g, 7, 7, 86, 85, 12); vpaint(g, col, 7, 92, 3.5);
    g.save(); R(g, 7, 7, 86, 85, 12); g.clip();
    for (const y of [35, 63]) { g.fillStyle = rgba(dk(col, .35), .55); g.fillRect(7, y, 86, 3); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(7, y + 3, 86, 2); }
    const rr = srnd(7); for (let i = 0; i < 14; i++) { const x = 12 + rr() * 72, y = 12 + rr() * 76; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6 + rr() * 8, y + rr() * 1.5 - .7); stroke(g, dk(col, .3), 1.3, .5); }
    if (st >= 1) { PL(g, [18, 12, 24, 22, 20, 30], true); stroke(g, dk(col, .55), 2.2); PL(g, [70, 66, 78, 76, 74, 90], true); stroke(g, dk(col, .55), 2.2); }
    if (st >= 2) { PL(g, [84, 40, 74, 48, 80, 58], true); stroke(g, dk(col, .55), 2.2); PL(g, [10, 70, 24, 72, 28, 84], true); stroke(g, dk(col, .55), 2.2); g.globalCompositeOperation = 'destination-out'; PL(g, [7, 7, 26, 7, 18, 16, 7, 22]); g.fill(); g.globalCompositeOperation = 'source-over'; }
    g.restore();
    E(g, 22, 14, 8, 3, -.2); g.fillStyle = 'rgba(255,255,255,.5)'; g.fill();
  }
  OB.box = (g, st) => {
    crate(g, '#f2b46e', st);
    // pink ribbon both ways with a bow
    const rib = (x, y, w, h) => { R(g, x, y, w, h, 2); const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, '#ff8cc4'); gr.addColorStop(.5, '#ff4f9a'); gr.addColorStop(1, '#e0307e'); g.fillStyle = gr; g.fill(); g.lineWidth = 2; g.strokeStyle = '#a8145a'; g.stroke(); };
    if (st < 2) { rib(43, 7, 14, 85); rib(7, 43, 86, 14); }
    else { rib(43, 7, 14, 36); rib(7, 43, 30, 14); rib(63, 43, 30, 14); }
    R(g, 46, 9, 4, 80, 2); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill();
    // bow
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(50, 46); g.bezierCurveTo(50 + s * 10, 26, 50 + s * 34, 28, 50 + s * 26, 44); g.bezierCurveTo(50 + s * 22, 54, 50 + s * 8, 52, 50, 50); g.closePath(); paint(g, '#ff5aa8', 50 + s * 18, 40, 16, 2.6); }
    for (const s of [-1, 1]) { PL(g, [50, 52, 50 + s * 16, 72, 50 + s * 8, 70, 50 + s * 6, 78]); paint(g, '#ff4f9a', 50 + s * 9, 66, 10, 2.4); }
    E(g, 50, 50, 7, 6); paint(g, '#ff7ab8', 50, 49, 7, 2.4); HL(g, 40, 38, 4, 2.4, -.6, .7);
  };
  OB.lockedCrate = (g, st) => {
    crate(g, '#c98a5a', st);
    // metal corner bands
    for (const [x, y, sx, sy] of [[7, 7, 1, 1], [93, 7, -1, 1], [7, 92, 1, -1], [93, 92, -1, -1]]) {
      PL(g, [x, y + sy * 26, x, y + sy * 10, x + sx * 10, y, x + sx * 26, y, x + sx * 26, y + sy * 9, x + sx * 9, y + sy * 9, x + sx * 9, y + sy * 26]);
      const gr = g.createLinearGradient(0, 0, 0, 100); gr.addColorStop(0, '#eef3ff'); gr.addColorStop(1, '#9aa8c8'); g.fillStyle = gr; g.fill(); g.lineWidth = 2; g.strokeStyle = '#5a6488'; g.stroke();
      dot(g, x + sx * 6, y + sy * 6, 2.2, '#5a6488');
    }
    // padlock
    g.beginPath(); g.arc(50, 44, 13, Math.PI, 0); g.lineTo(63, 52); g.moveTo(37, 52); g.lineTo(37, 44); g.lineWidth = 9; g.strokeStyle = '#5a6488'; g.lineCap = 'round'; g.stroke();
    g.beginPath(); g.arc(50, 44, 13, Math.PI, 0); g.lineWidth = 4.5; g.strokeStyle = '#e4ebff'; g.stroke();
    R(g, 30, 48, 40, 32, 10); paint(g, '#ffc83d', 50, 60, 24, 3);
    E(g, 50, 60, 5, 5); g.fillStyle = '#7a4a0a'; g.fill(); PL(g, [47, 62, 53, 62, 55, 72, 45, 72]); g.fill();
    HL(g, 38, 54, 4, 6, 0, .6); A.sparkAt(g, 68, 50, 5, '#ffffff');
  };
  OB.cobweb = (g, st) => {
    const cx = 50, cy = 46, ends = [[6, 4], [50, 3], [94, 4], [96, 46], [94, 92], [50, 94], [6, 92], [4, 46]];
    const draw = (col, w) => {
      g.lineWidth = w; g.strokeStyle = col; g.lineCap = 'round';
      ends.forEach((e, i) => { if (st >= 2 && i === 4) return; g.beginPath(); g.moveTo(cx, cy); g.lineTo(e[0], e[1]); g.stroke(); });
      for (let k = 1; k <= 4; k++) {
        const f = k / 4.4;
        g.beginPath();
        for (let i = 0; i < ends.length; i++) {
          const a = ends[i], b = ends[(i + 1) % ends.length];
          if ((st >= 1 && k === 3 && i === 1) || (st >= 2 && (i === 3 || i === 4) && k > 1) || (st >= 2 && k === 4 && i === 6)) { continue; }
          const ax = cx + (a[0] - cx) * f, ay = cy + (a[1] - cy) * f, bx = cx + (b[0] - cx) * f, by = cy + (b[1] - cy) * f;
          g.moveTo(ax, ay); g.quadraticCurveTo((ax + bx) / 2 + (cx - (ax + bx) / 2) * .18, (ay + by) / 2 + (cy - (ay + by) / 2) * .18, bx, by);
        }
        g.stroke();
      }
    };
    body(g); g.fillStyle = 'rgba(255,255,255,.16)'; g.fill();
    draw('rgba(70,50,140,.35)', 3.8); draw('rgba(255,255,255,.95)', 2);
    if (st >= 1) { g.beginPath(); g.moveTo(74, 66); g.quadraticCurveTo(80, 78, 76, 88); stroke(g, '#ffffff', 1.8, .9); }
    // tiny friendly spider on a thread
    g.beginPath(); g.moveTo(80, 4); g.lineTo(80, 22); stroke(g, '#ffffff', 1.4, .9);
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(80, 28); g.quadraticCurveTo(80 + s * 8, 22 + k * 5, 80 + s * 10, 30 + k * 4); stroke(g, '#5a4f9a', 1.6); }
    E(g, 80, 28, 7, 6.5); paint(g, '#8a7ae0', 80, 27, 7, 1.8);
    dot(g, 77.5, 27, 1.6, '#ffffff'); dot(g, 82.5, 27, 1.6, '#ffffff'); dot(g, 77.8, 27.3, .8, '#33285c'); dot(g, 82.8, 27.3, .8, '#33285c');
  };
  OB.sand = (g, st) => {
    const top = [16, 34, 52][st | 0] || 16;
    const p = []; for (let i = 0; i <= 10; i++) { const x = 5 + i * 9; p.push(x, top + Math.sin(i * 1.25) * 4 + Math.sin(i * 2.9) * 1.5 + (i === 0 || i === 10 ? 6 : 0)); }
    g.save(); body(g); g.clip();
    g.beginPath(); g.moveTo(5, 96); SM(g, p, true, true); g.lineTo(95, 96); g.closePath();
    vpaint(g, '#ffd59a', top - 6, 96, 0);
    const rr = srnd(31); for (let i = 0; i < 40; i++) { const x = 8 + rr() * 84, y = top + 6 + rr() * (88 - top); dot(g, x, y, .9 + rr() * 1.4, rr() < .5 ? 'rgba(190,120,50,.45)' : 'rgba(255,255,255,.65)'); }
    SM(g, p.map((v, i) => i % 2 ? v + 4 : v), true); stroke(g, '#ffffff', 3, .55);
    g.restore();
    SM(g, p, true); stroke(g, '#c8803a', 3);
    if (st < 2) { g.save(); g.translate(30, top + 30); g.rotate(-.3); pstar(g, 0, 0, 9); paint(g, '#ff8a6b', 0, 0, 9, 2); g.restore(); }
    g.save(); g.translate(70, Math.min(84, top + 44)); g.beginPath(); g.moveTo(0, 6); g.lineTo(-9, -2); g.quadraticCurveTo(0, -14, 9, -2); g.closePath(); paint(g, '#ffc2d6', 0, -2, 9, 2); g.restore();
  };
  OB.bubble = (g, st) => {
    const k = [0, 4, 8][st | 0] || 0;
    g.beginPath(); g.moveTo(10, 40 - k);
    g.bezierCurveTo(10, 12 - k, 34, 6 - k, 50, 8 - k); g.bezierCurveTo(70, 4 - k, 92, 14 - k, 92, 42 - k);
    g.bezierCurveTo(94, 64, 90, 82, 84, 88); g.quadraticCurveTo(80, 98, 75, 88); g.quadraticCurveTo(64, 92, 54, 90); g.quadraticCurveTo(50, 100, 45, 90);
    g.quadraticCurveTo(30, 92, 20, 88); g.quadraticCurveTo(15, 96, 12, 86); g.bezierCurveTo(6, 72, 8, 56, 10, 40 - k); g.closePath();
    const gr = g.createRadialGradient(36, 30, 4, 50, 52, 56); gr.addColorStop(0, '#ffe0f0'); gr.addColorStop(.45, '#ff9ccc'); gr.addColorStop(1, '#f0509a');
    g.fillStyle = gr; g.globalAlpha = .96; g.fill(); g.globalAlpha = 1; g.lineWidth = 3.4; g.strokeStyle = '#b8236e'; g.lineJoin = 'round'; g.stroke();
    E(g, 34, 26 - k, 14, 7, -.5); g.fillStyle = 'rgba(255,255,255,.75)'; g.fill(); dot(g, 54, 20 - k, 3, 'rgba(255,255,255,.85)');
    for (const [x, y, r] of [[66, 50, 7], [30, 62, 5], [52, 72, 4], [74, 30, 3.5], [22, 44, 3]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = 'rgba(255,255,255,.22)'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = 'rgba(255,255,255,.75)'; g.stroke(); dot(g, x - r * .35, y - r * .35, r * .3, '#ffffff'); }
  };
  const _ob = new Map();
  A.obstacleKinds = Object.keys(OB);
  A.obstacle = function (kind, px, state) {
    px = Math.max(8, Math.round(px || 64)); state = Math.max(0, Math.min(2, state | 0));
    const key = kind + '|' + state + '|' + px; let c = _ob.get(key); if (c) return c;
    if (_ob.size > 120) _ob.clear();
    c = mk(px, px); const g = c.getContext('2d'); g.scale(px / 100, px / 100);
    try { (OB[kind] || OB.box)(g, state); } catch (e) { console.error('ART.obstacle', kind, e); }
    _ob.set(key, c); return c;
  };

  // ---------------- boosters ----------------
  const BO = A.boosterDefs = {};
  BO.wand = g => {
    g.save(); g.translate(46, 58); g.rotate(.72);
    R(g, -6, -6, 12, 52, 6); vpaint(g, '#5a3ac8', -6, 46, 3.5);
    R(g, -6, 34, 12, 12, 6); flat(g, '#ffffff', 3, '#3a1f6e');
    for (const y of [4, 20]) { R(g, -7, y, 14, 5, 2); flat(g, '#ffc83d', 2, '#b8600c'); }
    g.restore();
    pstar(g, 62, 36, 30, -Math.PI / 2 + .2); g.fillStyle = '#d07a00'; g.save(); g.translate(0, 3); g.fill(); g.restore();
    pstar(g, 62, 36, 30, -Math.PI / 2 + .2); paint(g, '#ffd23f', 58, 30, 30, 3.5);
    pstar(g, 62, 37, 13, -Math.PI / 2 + .2); g.fillStyle = 'rgba(255,255,255,.4)'; g.fill(); HL(g, 52, 24, 6, 3.5, -.6, .85);
    A.sparkAt(g, 22, 22, 9, '#ff9ccc'); A.sparkAt(g, 90, 70, 8, '#8fdcff'); A.sparkAt(g, 88, 10, 6, '#ffffff'); dot(g, 30, 44, 3, '#ffd23f'); dot(g, 82, 86, 2.5, '#ff9ccc');
  };
  BO.scissors = g => {
    g.save(); g.translate(52, 50); g.rotate(-.75);
    // blades
    for (const s of [-1, 1]) { g.save(); g.rotate(s * .2); g.beginPath(); g.moveTo(-4 * s, 4); g.quadraticCurveTo(s * 12, -26, s * 3, -48); g.quadraticCurveTo(-s * 4, -30, -s * 6, 2); g.closePath(); const gr = g.createLinearGradient(-8, 0, 8, 0); gr.addColorStop(0, '#f4f8ff'); gr.addColorStop(.5, '#c4d0ea'); gr.addColorStop(1, '#8e9cc0'); g.fillStyle = gr; g.fill(); g.lineWidth = 3; g.strokeStyle = '#4a5478'; g.lineJoin = 'round'; g.stroke(); g.restore(); }
    // handles
    for (const s of [-1, 1]) {
      g.save(); g.rotate(s * .38);
      R(g, -4, 2, 8, 16, 3); flat(g, '#ff4f9a', 2.5, '#a8145a');
      E(g, 0, 32, 13, 15); paint(g, '#ff5aa8', 0, 30, 15, 3); E(g, 0, 32, 6.5, 8); g.globalCompositeOperation = 'destination-out'; g.fill(); g.globalCompositeOperation = 'source-over'; g.lineWidth = 2.5; g.strokeStyle = '#a8145a'; g.stroke();
      HL(g, -6, 24, 3, 5, .4, .7); g.restore();
    }
    dot(g, 0, 3, 5.5, '#ffc83d'); g.beginPath(); g.arc(0, 3, 5.5, 0, TAU); stroke(g, '#b8600c', 2); dot(g, -1.5, 1.5, 1.6, '#ffffff');
    g.restore();
    A.sparkAt(g, 84, 18, 8, '#ffffff'); A.sparkAt(g, 18, 84, 6, '#ff9ccc');
  };
  BO.shuffle = g => {
    const arc = (a0, a1, col) => {
      g.beginPath(); g.arc(50, 50, 30, a0, a1); g.lineWidth = 19; g.strokeStyle = dk(col, .5); g.lineCap = 'butt'; g.stroke();
      g.lineWidth = 13; const gr = g.createLinearGradient(20, 20, 80, 80); gr.addColorStop(0, lt(col, .4)); gr.addColorStop(1, col); g.strokeStyle = gr; g.stroke();
      const ex = 50 + Math.cos(a1) * 30, ey = 50 + Math.sin(a1) * 30, tx = -Math.sin(a1), ty = Math.cos(a1), nx = Math.cos(a1), ny = Math.sin(a1);
      PL(g, [ex + nx * 16, ey + ny * 16, ex + tx * 18, ey + ty * 18, ex - nx * 16, ey - ny * 16]); paint(g, col, ex, ey, 14, 3);
      g.beginPath(); g.arc(50, 50, 33, a0 + .15, (a0 + a1) / 2); stroke(g, '#ffffff', 3, .6);
    };
    arc(Math.PI * .95, Math.PI * 1.75, '#2fd59a'); arc(-.05, Math.PI * .75, '#3db8ff');
    E(g, 50, 50, 9, 9); paint(g, '#ffd23f', 50, 50, 9, 2.5); A.sparkAt(g, 86, 14, 7, '#ffffff');
  };
  BO.moves5 = g => {
    const p = []; for (let i = 0; i < 24; i++) { const a = i * TAU / 24, r = i % 2 ? 40 : 46; p.push(50 + Math.cos(a) * r, 52 + Math.sin(a) * r); }
    PL(g, p); g.fillStyle = '#2a8a5a'; g.save(); g.translate(0, 3); g.fill(); g.restore(); PL(g, p); paint(g, '#4fe39a', 50, 50, 46, 3.5);
    E(g, 50, 52, 33, 33); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.7)'; g.stroke();
    E(g, 50, 32, 26, 12); g.fillStyle = 'rgba(255,255,255,.28)'; g.fill();
    g.font = '900 38px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = 9; g.strokeStyle = '#17734a'; g.strokeText('+5', 50, 55); g.fillStyle = '#ffffff'; g.fillText('+5', 50, 54);
    A.sparkAt(g, 84, 16, 7, '#ffffff');
  };
  const _bo = new Map();
  A.booster = function (kind, px, badge) {
    px = Math.max(8, Math.round(px || 64)); const key = kind + '|' + px + (badge ? 'b' : ''); let c = _bo.get(key); if (c) return c;
    c = mk(px, px); const o = c.getContext('2d');
    try {
      if (badge) {
        const s = px / 100; o.save(); o.scale(s, s);
        E(o, 50, 54, 47, 47); o.fillStyle = 'rgba(60,30,130,.28)'; o.fill();
        E(o, 50, 50, 47, 47); const gr = o.createLinearGradient(0, 3, 0, 97); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#e6e0ff'); o.fillStyle = gr; o.fill();
        o.lineWidth = 4; o.strokeStyle = '#ffc83d'; o.stroke(); E(o, 50, 50, 40, 40); o.lineWidth = 2; o.strokeStyle = 'rgba(124,92,255,.25)'; o.stroke();
        o.restore();
      }
      const S = A.fx.scratch('boost', px, px), g = S.getContext('2d'); const f = badge ? .72 : 1;
      g.translate(px * (1 - f) / 2, px * (1 - f) / 2); g.scale(px / 100 * f, px / 100 * f); (BO[kind] || BO.wand)(g);
      if (px >= 20) A.fx.outline(o, S, 'rgba(42,23,72,.7)', Math.max(1, px * .02 * f), 0, 0);
      o.drawImage(S, 0, 0);
    } catch (e) { console.error('ART.booster', kind, e); }
    _bo.set(key, c); return c;
  };

  // ---------------- key item ----------------
  function drawKey(g) {
    g.save(); g.translate(50, 50); g.rotate(-.62);
    R(g, -6, -8, 52, 14, 5); paint(g, '#ffc83d', 20, -2, 30, 4);
    PL(g, [30, 4, 30, 18, 37, 18, 37, 10, 41, 10, 41, 22, 47, 22, 47, 4]); paint(g, '#ffb21e', 38, 12, 12, 3.5);
    g.beginPath(); g.arc(-22, -1, 24, 0, TAU); g.arc(-22, -1, 10, 0, TAU, true); paint(g, '#ffd23f', -28, -8, 26, 4);
    dot(g, -34, -14, 4, 'rgba(255,255,255,.75)'); R(g, 0, -6, 40, 3.5, 1.7); g.fillStyle = 'rgba(255,255,255,.55)'; g.fill();
    g.restore();
    A.sparkAt(g, 82, 18, 8, '#ffffff');
  }
  A.def('key', [['võti', g => { A.H.shadow(g, 50, 88, 30, 6); drawKey(g); }]]);
  A.drawKey = drawKey;

  // ---------------- icons ----------------
  const I = A.iconDefs;
  I.piggy = g => {
    E(g, 50, 60, 40, 31); paint(g, '#ff9cc8', 50, 56, 42, 0);
    PL(g, [26, 38, 22, 18, 40, 32]); paint(g, '#ff7ab6', 30, 30, 12, 0); PL(g, [56, 32, 66, 16, 72, 36]); paint(g, '#ff7ab6', 66, 28, 12, 0);
    for (const x of [28, 42, 60, 72]) { R(g, x - 5, 80, 10, 14, 4); g.fillStyle = '#f06aa6'; g.fill(); }
    E(g, 88, 62, 9, 11); paint(g, '#ff7ab6', 88, 60, 10, 0); dot(g, 86, 58, 2.2, '#b8236e'); dot(g, 90, 65, 2.2, '#b8236e');
    dot(g, 70, 50, 3.8, '#33285c'); dot(g, 71.2, 48.8, 1.3, '#ffffff'); E(g, 74, 62, 6, 3.5); g.fillStyle = 'rgba(255,90,140,.45)'; g.fill();
    g.beginPath(); g.moveTo(10, 56); g.bezierCurveTo(2, 50, 6, 42, 12, 46); g.bezierCurveTo(16, 50, 8, 54, 6, 48); stroke(g, '#f06aa6', 3.5);
    R(g, 38, 31, 22, 5, 2.5); g.fillStyle = '#b8236e'; g.fill();
    E(g, 49, 20, 12, 12); paint(g, '#ffcb2e', 49, 18, 12, 0); E(g, 49, 20, 7, 7); stroke(g, '#e8960c', 2.5);
    HL(g, 32, 48, 10, 6, -.5, .55);
  };
  I.calendar = g => {
    R(g, 12, 18, 76, 74, 14); paint(g, '#ffffff', 50, 56, 44, 0); R(g, 12, 18, 76, 26, 12); paint(g, '#ff5a8a', 50, 28, 40, 0); g.fillStyle = '#ff5a8a'; g.fillRect(12, 34, 76, 10);
    for (const x of [32, 68]) { R(g, x - 5, 8, 10, 20, 5); paint(g, '#7c5cff', x, 16, 8, 0); }
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { const x = 20 + c * 16, y = 50 + r * 13; R(g, x, y, 12, 9, 3); g.fillStyle = r === 2 && c === 3 ? '#ffd23f' : r * 4 + c < 6 ? '#ffd3e6' : '#ece8fa'; g.fill(); }
    for (let i = 0; i < 6; i++) { const x = 26 + (i % 4) * 16, y = 54.5 + Math.floor(i / 4) * 13; PL(g, [x - 3, y, x - 1, y + 2.5, x + 3, y - 2.5], true); stroke(g, '#ff4f9a', 2); }
    pstar(g, 74, 80, 14); paint(g, '#ffd23f', 74, 79, 14, 0); g.lineWidth = 2.5; g.strokeStyle = '#ffffff'; g.stroke();
  };
  I.heart = g => {
    heart(g, 50, 60, 44); g.fillStyle = '#c4135a'; g.fill(); heart(g, 50, 55, 44);
    const gr = g.createRadialGradient(34, 30, 4, 50, 50, 56); gr.addColorStop(0, '#ffb3d6'); gr.addColorStop(.45, '#ff4f8a'); gr.addColorStop(1, '#d81f62'); g.fillStyle = gr; g.fill();
    heart(g, 50, 55, 44); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.55)'; g.stroke();
    E(g, 32, 34, 10, 6, -.6); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill(); dot(g, 44, 28, 2.6, 'rgba(255,255,255,.9)');
  };
  I.wheel = g => {
    E(g, 50, 52, 44, 44); g.fillStyle = '#c87a0a'; g.fill(); E(g, 50, 48, 44, 44); paint(g, '#ffc83d', 50, 48, 44, 0);
    const cols = ['#ff6fae', '#ffd23f', '#5fd8ff', '#7ce8a8', '#b79cff', '#ff9a6b'];
    for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(50, 48); g.arc(50, 48, 35, i * TAU / 6 - Math.PI / 2, (i + 1) * TAU / 6 - Math.PI / 2); g.closePath(); g.fillStyle = cols[i]; g.fill(); g.lineWidth = 2; g.strokeStyle = '#ffffff'; g.stroke(); }
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8; dot(g, 50 + Math.cos(a) * 40, 48 + Math.sin(a) * 40, 2.6, '#fffbe0'); }
    E(g, 50, 48, 8, 8); paint(g, '#ffd23f', 50, 48, 8, 0); E(g, 42, 30, 16, 7, -.4); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill();
    PL(g, [42, 0, 58, 0, 50, 16]); paint(g, '#ff3d8b', 50, 4, 10, 0);
  };
  I.map = g => {
    PL(g, [8, 22, 34, 12, 66, 22, 92, 12, 92, 80, 66, 90, 34, 80, 8, 90]); paint(g, '#fff3d6', 50, 50, 46, 0);
    PL(g, [34, 12, 66, 22, 66, 90, 34, 80]); g.fillStyle = 'rgba(230,200,150,.5)'; g.fill();
    E(g, 22, 70, 9, 6); g.fillStyle = '#7fd0ff'; g.fill(); E(g, 76, 40, 10, 7); g.fillStyle = '#9ff0c8'; g.fill();
    g.setLineDash([5, 6]); SM(g, [18, 76, 36, 58, 52, 66, 64, 44, 74, 30], true); stroke(g, '#ff4f9a', 4); g.setLineDash([]);
    g.beginPath(); g.moveTo(74, 40); g.bezierCurveTo(64, 26, 66, 12, 74, 12); g.bezierCurveTo(82, 12, 84, 26, 74, 40); g.closePath(); paint(g, '#ff4f6a', 74, 22, 12, 0); dot(g, 74, 22, 4, '#ffffff');
    pstar(g, 18, 78, 7); g.fillStyle = '#ffc83d'; g.fill();
  };
  I.crown = g => {
    PL(g, [10, 76, 6, 26, 30, 48, 50, 14, 70, 48, 94, 26, 90, 76]); vpaint(g, '#ffd23f', 14, 76, 0);
    R(g, 10, 72, 80, 16, 6); paint(g, '#ffb21e', 50, 80, 40, 0);
    for (const [x, c] of [[30, '#3db8ff'], [50, '#ff4f9a'], [70, '#2fd59a']]) { E(g, x, 80, 5, 5); g.fillStyle = c; g.fill(); }
    for (const [x, y] of [[6, 26], [50, 14], [94, 26]]) dot(g, x, y, 6, '#ffffff');
    E(g, 34, 44, 6, 12, .5); g.fillStyle = 'rgba(255,255,255,.4)'; g.fill();
  };
  I.moves = g => {
    E(g, 50, 52, 44, 44); g.fillStyle = '#1a6fd0'; g.fill(); E(g, 50, 48, 44, 44); paint(g, '#3db8ff', 50, 48, 44, 0);
    E(g, 50, 30, 30, 12); g.fillStyle = 'rgba(255,255,255,.25)'; g.fill();
    // a bold forward-curving arrow: "another move"
    g.beginPath(); g.moveTo(24, 66); g.bezierCurveTo(24, 40, 44, 30, 62, 32); g.lineWidth = 13; g.strokeStyle = '#ffffff'; g.lineCap = 'round'; g.stroke();
    PL(g, [56, 16, 80, 33, 56, 50]); g.fillStyle = '#ffffff'; g.lineJoin = 'round'; g.lineWidth = 4; g.strokeStyle = '#ffffff'; g.fill(); g.stroke();
    dot(g, 68, 70, 6, '#fff6c0'); dot(g, 50, 74, 4.5, '#fff6c0');
  };
  I.trophy = g => {
    g.beginPath(); g.arc(22, 32, 12, Math.PI * .5, Math.PI * 1.5, false); stroke(g, '#e8a11a', 7); g.beginPath(); g.arc(78, 32, 12, -Math.PI * .5, Math.PI * .5); stroke(g, '#e8a11a', 7);
    g.beginPath(); g.moveTo(20, 14); g.lineTo(80, 14); g.quadraticCurveTo(80, 58, 50, 62); g.quadraticCurveTo(20, 58, 20, 14); g.closePath(); paint(g, '#ffd23f', 44, 30, 36, 0);
    R(g, 44, 60, 12, 14, 3); g.fillStyle = '#e8a11a'; g.fill(); R(g, 28, 74, 44, 16, 5); paint(g, '#7c5cff', 50, 82, 24, 0);
    pstar(g, 50, 34, 12); g.fillStyle = '#ffffff'; g.fill(); E(g, 32, 26, 4, 10, .2); g.fillStyle = 'rgba(255,255,255,.5)'; g.fill();
  };
  I.rest = g => {
    E(g, 46, 54, 36, 36); paint(g, '#ffd86a', 40, 50, 40, 0);
    g.globalCompositeOperation = 'destination-out'; E(g, 66, 40, 28, 28); g.fill(); g.globalCompositeOperation = 'source-over';
    g.font = '900 22px ' + FONT; g.textAlign = 'center'; g.fillStyle = '#7c5cff'; g.fillText('z', 72, 34); g.font = '900 16px ' + FONT; g.fillText('z', 86, 18);
    dot(g, 30, 56, 2.6, '#33285c'); g.beginPath(); g.arc(26, 66, 5, .2, Math.PI - .2); stroke(g, '#c87a0a', 2.5);
  };
  I.key = g => { g.translate(8, 8); g.scale(.84, .84); drawKey(g); };
  I.streak = g => {
    PL(g, [30, 6, 46, 6, 54, 40, 40, 44]); g.fillStyle = '#3db8ff'; g.fill(); PL(g, [70, 6, 54, 6, 46, 40, 60, 44]); g.fillStyle = '#ff4f9a'; g.fill();
    E(g, 50, 62, 32, 32); g.fillStyle = '#d07a00'; g.fill(); E(g, 50, 58, 32, 32); paint(g, '#ffd23f', 50, 58, 32, 0);
    E(g, 50, 58, 24, 24); stroke(g, '#ffb21e', 3); pstar(g, 50, 60, 14); g.fillStyle = '#ffffff'; g.fill();
    HL(g, 38, 46, 7, 4, -.6, .7);
  };

  // ---------------- idle juice ----------------
  const IDLE = { sx: 1, sy: 1, rot: 0, dy: 0 };
  A.itemIdle = function (seed, t) {
    const ph = ((seed * 2654435761) >>> 0) / 4294967296 * TAU, per = 6 + (seed % 5) * .9;
    const br = Math.sin(t * 2.1 + ph);
    let rot = .02 * Math.sin(t * 1.3 + ph * 1.7), sq = .018 * br;
    const u = (t + ph * 2) % per; // an occasional happy wiggle
    if (u < .7) { const e = 1 - u / .7; rot += .11 * Math.sin(u * 22) * e; sq += .05 * Math.sin(u * 14) * e; }
    IDLE.sx = 1 + sq; IDLE.sy = 1 - sq * .9; IDLE.rot = rot; IDLE.dy = -.012 * (1 + br);
    return IDLE;
  };
  A.drawItemIdle = function (ctx, img, cx, cy, s, seed, t) {
    const f = A.itemIdle(seed, t), by = cy + s / 2;
    ctx.save(); ctx.translate(cx, by + f.dy * s); ctx.rotate(f.rot); ctx.scale(f.sx, f.sy); ctx.drawImage(img, -s / 2, -s, s, s); ctx.restore();
  };
})(ART);
