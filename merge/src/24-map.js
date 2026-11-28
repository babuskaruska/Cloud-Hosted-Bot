// ===== MAP ART (Ash): the endless "Seiklus" level map: chapter backgrounds, the candy path, level nodes, the wheel. =====
//   ART.mapChapterOf(level) -> chapter (0 = levels 1–50, 1 = 51–100, ...)
//   ART.mapTheme(chapter)   -> { key, name, path, accent, ink } (chapter themes cycle forever; each cycle reshuffles the decor)
//   ART.mapBg(ctx, chapter, x, y, w, h, t, scroll)  fills the rect with the chapter's scenery. scroll = world y (CSS px) of the rect's
//       top edge: the picture moves up as scroll grows and repeats seamlessly. Cached tile + a light animated layer (QUALITY-scaled).
//   ART.mapDivider(ctx, chapter, x, y, w, t)  a soft mist band with a ribbon "Peatükk n · Name", centred on y (hides the seam between chapters)
//   ART.mapPath(ctx, points, t, opts)  winding candy path through points ([{x,y}] or [[x,y]] or flat); opts { done: float index of the
//       last finished point (dots before it are candy coloured, after it pale), width }
//   ART.mapNode(ctx, x, y, r, state, stars, n, t)  state 'locked' | 'open' | 'current' | 'done'; stars 0..3; n = level number
//       (every 10th is a boss: 1.28× larger, purple, crown). Static parts are cached sprites; the number is live text.
//   ART.wheel(ctx, x, y, r, slices, angle, t)  lucky wheel; slices [{icon, label, color}] (icon = icon name, item key or canvas);
//       slice i is centred under the top pointer when angle = -i * 2π / n.  ART.wheelIndex(angle, n) -> slice under the pointer.
(function (A) {
  const { E, R, PL, SM, paint, flat, vpaint, stroke, HL, dot, pstar, heart, srnd, lt, dk, mix, rgba, mk } = A.H;
  const TAU = Math.PI * 2, FONT = A.theme.font;
  const Q = () => (A.quality == null ? 2 : A.quality);
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

  // ---------------- decor (drawn at ground point x,y; s = size in CSS px, ~ height) ----------------
  function at(g, x, y, s, fn) { g.save(); g.translate(x, y); g.scale(s / 100, s / 100); fn(g); g.restore(); }
  // a union of circles with one clean outline: stroke every circle first (outline), then fill them all with one gradient
  function blob(g, cs, col, cx, cy, r) {
    g.lineWidth = 7; g.strokeStyle = dk(col, .58);
    for (const c of cs) { g.beginPath(); g.arc(c[0], c[1], c[2], 0, TAU); g.stroke(); }
    const gr = g.createRadialGradient(cx - r * .4, cy - r * .48, r * .04, cx, cy, r * 1.22); gr.addColorStop(0, lt(col, .6)); gr.addColorStop(.42, col); gr.addColorStop(1, dk(col, .3));
    g.fillStyle = gr; g.beginPath(); for (const c of cs) { g.moveTo(c[0] + c[2], c[1]); g.arc(c[0], c[1], c[2], 0, TAU); } g.fill();
  }
  const gshadow = (g, rx, ry) => { E(g, 0, 0, rx, ry || rx * .26); g.fillStyle = 'rgba(60,40,120,.16)'; g.fill(); };
  const D = {
    palm(g, rr) {
      gshadow(g, 34);
      SM(g, [-6, 0, -2, -40, 8, -76, 14, -78, 8, -40, 6, 0]); paint(g, '#c9874f', 2, -40, 40, 3.5);
      for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-6 + i * 1.5, -12 - i * 14); g.lineTo(5 + i * 1.8, -14 - i * 14); stroke(g, '#9a5a2e', 2.5); }
      const lv = [[-60, -60], [-46, -96], [10, -110], [58, -92], [64, -60]];
      for (const [lx, ly] of lv) {
        g.beginPath(); g.moveTo(10, -80); g.quadraticCurveTo((10 + lx) / 2, ly - 22, lx, ly); g.quadraticCurveTo((10 + lx) / 2 + 4, ly + 2, 10, -74); g.closePath();
        paint(g, '#3fcf6e', (10 + lx) / 2, ly - 6, 36, 3.5);
        g.beginPath(); g.moveTo(10, -78); g.quadraticCurveTo((10 + lx) / 2, ly - 14, lx * .92 + 1, ly); stroke(g, '#ffffff', 2, .45);
      }
      dot(g, 4, -74, 7, '#8a5532'); dot(g, 16, -72, 7, '#7a4526'); dot(g, 6, -73, 2.5, 'rgba(255,255,255,.5)');
    },
    umbrella(g, rr) {
      const c = ['#ff5a8a', '#3db8ff', '#ffb21e', '#7c5cff'][(rr() * 4) | 0];
      gshadow(g, 46, 12);
      R(g, -36, -10, 50, 14, 6); flat(g, lt(c, .55), 2.5);
      g.beginPath(); g.moveTo(2, 0); g.lineTo(-4, -78); stroke(g, '#8a7aa8', 4);
      g.beginPath(); g.moveTo(-50, -66); g.quadraticCurveTo(-4, -118, 42, -66);
      for (let i = 0; i < 6; i++) { const x0 = 42 - i * 15.3; g.quadraticCurveTo(x0 - 7.6, -58, x0 - 15.3, -66); }
      g.closePath(); paint(g, c, -4, -82, 46, 3.5);
      g.save(); g.clip();
      for (let i = 0; i < 6; i += 2) { g.beginPath(); g.moveTo(-4, -96); g.lineTo(42 - i * 15.3, -62); g.lineTo(42 - (i + 1) * 15.3, -62); g.closePath(); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill(); }
      g.restore(); dot(g, -4, -96, 4, '#fff6c0');
    },
    starfish(g, rr) {
      g.rotate(rr() * 1.2 - .6); pstar(g, 0, -10, 16); paint(g, rr() < .5 ? '#ff8a6b' : '#ff6fae', 0, -12, 16, 2.5);
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5; dot(g, Math.cos(a) * 8, -10 + Math.sin(a) * 8, 1.6, 'rgba(255,255,255,.8)'); }
    },
    shell(g, rr) {
      g.beginPath(); g.moveTo(0, 0); g.lineTo(-14, -12); g.quadraticCurveTo(0, -30, 14, -12); g.closePath(); paint(g, rr() < .5 ? '#ffc2d6' : '#ffe0b8', 0, -12, 16, 2.5);
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(0, -1); g.lineTo(i * 5.5, -19 + Math.abs(i) * 2); stroke(g, '#e88aa8', 1.6, .8); }
    },
    lollipop(g, rr) {
      gshadow(g, 18);
      R(g, -3, -60, 6, 60, 3); flat(g, '#ffffff', 2.5, '#b9b2dc');
      E(g, 0, -78, 26, 26); paint(g, '#ffffff', 0, -78, 26, 3.5);
      const cs = [['#ff5a8a', '#ffd23f'], ['#3db8ff', '#ff8fb1'], ['#2fd59a', '#ff5a8a'], ['#7c5cff', '#ffd23f']][(rr() * 4) | 0];
      g.save(); E(g, 0, -78, 24, 24); g.clip();
      for (let i = 0; i < 4; i++) { g.beginPath(); for (let a = 0; a < 14; a += .3) { const rad = a * 1.8; g.lineTo(Math.cos(a + i * Math.PI / 2) * rad, -78 + Math.sin(a + i * Math.PI / 2) * rad); } stroke(g, cs[i % 2], 7); }
      g.restore(); E(g, 0, -78, 26, 26); stroke(g, '#5a3a8e', 3); HL(g, -9, -88, 7, 4, -.6, .8);
      g.beginPath(); g.moveTo(-10, -56); g.quadraticCurveTo(0, -48, 10, -56); g.lineTo(14, -46); g.lineTo(0, -52); g.lineTo(-14, -46); g.closePath(); flat(g, cs[0], 2);
    },
    castle(g, rr) {
      gshadow(g, 44);
      R(g, -36, -36, 72, 36, 6); paint(g, '#ffd79a', 0, -20, 40, 3);
      for (const x of [-38, 18]) { R(g, x, -62, 20, 62, 4); paint(g, '#ffcf8a', x + 10, -34, 24, 3); for (let i = 0; i < 3; i++) { R(g, x + i * 7, -68, 6, 8, 2); flat(g, '#ffcf8a', 2); } }
      R(g, -8, -22, 16, 22, 8); flat(g, '#c98a4a', 0);
      for (const [x, c] of [[-28, '#ff5a8a'], [28, '#3db8ff']]) { g.beginPath(); g.moveTo(x, -68); g.lineTo(x, -88); stroke(g, '#8a7aa8', 2.5); PL(g, [x, -88, x + 14, -83, x, -78]); flat(g, c, 2); }
      for (let i = 0; i < 8; i++) dot(g, -30 + rr() * 60, -6 - rr() * 26, 1.4, 'rgba(160,100,40,.4)');
    },
    hut(g, rr) {
      const c = ['#ff8fb1', '#8fdcff', '#9ff0c8', '#ffe066'][(rr() * 4) | 0];
      gshadow(g, 40);
      R(g, -30, -52, 60, 52, 6); paint(g, '#ffffff', 0, -26, 40, 3);
      g.save(); R(g, -30, -52, 60, 52, 6); g.clip(); for (let i = 0; i < 4; i++) { g.fillStyle = c; g.fillRect(-30 + i * 16, -52, 8, 52); } g.restore();
      R(g, -30, -52, 60, 52, 6); stroke(g, dk(c, .55), 3);
      PL(g, [-40, -48, 0, -82, 40, -48]); paint(g, dk(c, .1), 0, -60, 40, 3);
      R(g, -9, -30, 18, 30, 5); flat(g, dk(c, .35), 2.5); dot(g, 0, -64, 5, '#fff6c0');
    },
    flowers(g, rr) {
      const cols = ['#ff5a8a', '#ffffff', '#ffd23f', '#b79cff', '#ff8a6b', '#8fdcff'];
      const n = 3 + (rr() * 4 | 0);
      E(g, 0, -4, 30, 12); g.fillStyle = 'rgba(30,140,70,.25)'; g.fill();
      for (let i = 0; i < n; i++) {
        const x = (rr() - .5) * 46, y = -6 - rr() * 20, c = cols[(rr() * cols.length) | 0], r = 6 + rr() * 3;
        g.beginPath(); g.moveTo(x, y + 8); g.lineTo(x, y); stroke(g, '#2a9a52', 2.5);
        for (let k = 0; k < 5; k++) { const a = k * TAU / 5; E(g, x + Math.cos(a) * r * .7, y + Math.sin(a) * r * .7, r * .55, r * .55); g.fillStyle = c; g.fill(); }
        g.beginPath(); for (let k = 0; k < 5; k++) { const a = k * TAU / 5; g.moveTo(x + Math.cos(a) * r * 1.25, y + Math.sin(a) * r * 1.25); g.arc(x + Math.cos(a) * r * .7, y + Math.sin(a) * r * .7, r * .55, a, a + TAU); }
        stroke(g, dk(c, .5), 1.4, .55); dot(g, x, y, r * .38, c === '#ffd23f' ? '#ff8a3d' : '#ffd23f');
      }
    },
    tulips(g, rr) {
      const c = ['#ff5a8a', '#ff8a3d', '#ffd23f', '#c66bff'][(rr() * 4) | 0];
      for (let i = -1; i <= 1; i++) {
        const x = i * 13, h = 34 + (i === 0 ? 10 : 0);
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x, -h); stroke(g, '#2a9a52', 3);
        E(g, x - 6, -h * .45, 4, 10, -.6); flat(g, '#4fd07a', 1.5);
        g.beginPath(); g.moveTo(x - 9, -h - 4); g.lineTo(x - 9, -h - 18); g.lineTo(x - 4, -h - 12); g.lineTo(x, -h - 20); g.lineTo(x + 4, -h - 12); g.lineTo(x + 9, -h - 18); g.lineTo(x + 9, -h - 4); g.quadraticCurveTo(x, -h + 6, x - 9, -h - 4); g.closePath();
        paint(g, c, x, -h - 10, 12, 2.5);
      }
    },
    bush(g, rr) {
      gshadow(g, 40);
      const c = rr() < .5 ? '#3fcf6e' : '#5fd68a';
      blob(g, [[-20, -18, 18], [20, -18, 18], [0, -32, 22]], c, 0, -24, 38);
      E(g, -8, -42, 10, 5, -.4); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill();
      const bc = ['#ff5a8a', '#ffffff', '#ffd23f', '#ff3d6b'][(rr() * 4) | 0];
      for (let i = 0; i < 6; i++) { dot(g, -28 + rr() * 56, -10 - rr() * 36, 3.4, bc); dot(g, -28 + rr() * 56, -10 - rr() * 36, 1.2, 'rgba(255,255,255,.8)'); }
    },
    pond(g, rr) {
      E(g, 0, -20, 58, 26); flat(g, '#c9a874', 3, '#8a6a4a');
      E(g, 0, -22, 52, 22); const gr = g.createLinearGradient(0, -44, 0, 0); gr.addColorStop(0, '#5fd8ff'); gr.addColorStop(1, '#2f9cff'); g.fillStyle = gr; g.fill();
      E(g, -18, -30, 16, 4, 0); g.fillStyle = 'rgba(255,255,255,.5)'; g.fill();
      for (const [x, y] of [[-26, -18], [18, -28], [26, -12]]) { g.beginPath(); g.ellipse(x, y, 9, 5, 0, .4, TAU - .2); g.lineTo(x, y); g.closePath(); flat(g, '#4fd07a', 1.8, '#1f8a46'); }
      for (let k = 0; k < 6; k++) { const a = k * TAU / 6; E(g, 18 + Math.cos(a) * 3.5, -30 + Math.sin(a) * 2.2, 3, 2.2, a); g.fillStyle = '#ffc2d6'; g.fill(); } dot(g, 18, -30, 1.8, '#ffd23f');
    },
    fence(g, rr) {
      gshadow(g, 40, 6);
      R(g, -42, -26, 84, 6, 3); flat(g, '#ffffff', 2, '#b9b2dc'); R(g, -42, -14, 84, 6, 3); flat(g, '#ffffff', 2, '#b9b2dc');
      for (let i = 0; i < 5; i++) { const x = -38 + i * 19; PL(g, [x - 5, 0, x - 5, -32, x, -38, x + 5, -32, x + 5, 0]); flat(g, '#ffffff', 2, '#b9b2dc'); }
    },
    tree(g, rr) {
      gshadow(g, 40);
      R(g, -7, -40, 14, 40, 5); paint(g, '#c9874f', 0, -20, 14, 3);
      const c = ['#3fcf6e', '#2fc06a', '#5fd68a'][(rr() * 3) | 0];
      blob(g, [[-22, -54, 22], [22, -54, 22], [0, -78, 28], [0, -50, 22]], c, 0, -64, 46);
      E(g, -10, -90, 12, 6, -.4); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill();
      const fc = ['#ff3d6b', '#ff8a3d', '#ffffff', '#ff5a8a'][(rr() * 4) | 0];
      for (let i = 0; i < 7; i++) { const x = -32 + rr() * 64, y = -40 - rr() * 54; dot(g, x, y, 4.2, fc); g.beginPath(); g.arc(x, y, 4.2, 0, TAU); stroke(g, dk(fc, .5), 1.3, .6); dot(g, x - 1.3, y - 1.3, 1.4, 'rgba(255,255,255,.85)'); }
    },
    pine(g, rr, snow) {
      gshadow(g, 30);
      R(g, -5, -18, 10, 18, 3); flat(g, '#a86a3e', 2.5);
      for (let i = 0; i < 3; i++) {
        const y = -18 - i * 24, w = 34 - i * 8;
        g.beginPath(); g.moveTo(-w, y); g.quadraticCurveTo(0, y + 6, w, y); g.lineTo(0, y - 38); g.closePath(); paint(g, snow ? '#2fae7a' : '#2fbf6a', 0, y - 14, w, 3);
        if (snow) { g.beginPath(); g.moveTo(-w * .55, y - 16); g.lineTo(0, y - 38); g.lineTo(w * .55, y - 16); g.quadraticCurveTo(w * .25, y - 10, 0, y - 16); g.quadraticCurveTo(-w * .25, y - 10, -w * .55, y - 16); g.closePath(); flat(g, '#ffffff', 2, '#b9c6ee'); }
      }
      if (!snow) { for (let i = 0; i < 3; i++) dot(g, -14 + rr() * 28, -24 - rr() * 50, 2.6, '#ffd23f'); }
    },
    mushroom(g, rr) {
      gshadow(g, 22);
      R(g, -8, -26, 16, 26, 7); paint(g, '#fff6e8', 0, -12, 14, 2.5);
      g.beginPath(); g.moveTo(-26, -22); g.quadraticCurveTo(-24, -54, 0, -54); g.quadraticCurveTo(24, -54, 26, -22); g.quadraticCurveTo(0, -16, -26, -22); g.closePath();
      paint(g, rr() < .7 ? '#ff4a5a' : '#ff8a3d', 0, -38, 28, 3);
      for (const [x, y, r] of [[-12, -38, 5], [8, -44, 4], [14, -30, 3.5], [-2, -28, 3]]) dot(g, x, y, r, '#ffffff');
    },
    berries(g, rr) {
      gshadow(g, 34);
      blob(g, [[-16, -16, 16], [16, -16, 16], [0, -28, 18]], '#2fae5e', 0, -22, 32);
      const blue = rr() < .5;
      for (let i = 0; i < 9; i++) { const x = -24 + rr() * 48, y = -8 - rr() * 32; dot(g, x, y, blue ? 4 : 4.4, blue ? '#5a6bff' : '#ff3d6b'); dot(g, x - 1.2, y - 1.4, 1.3, 'rgba(255,255,255,.85)'); }
    },
    log(g, rr) {
      gshadow(g, 40, 8);
      R(g, -38, -22, 70, 22, 11); paint(g, '#c9874f', 0, -12, 36, 3);
      E(g, 32, -11, 8, 11); flat(g, '#ffd8a0', 2.5, '#9a5a2e'); E(g, 32, -11, 4, 6); stroke(g, '#c9874f', 1.5);
      dot(g, -18, -24, 5, '#ff4a5a'); dot(g, -20, -26, 1.6, '#fff');
    },
    rock(g, rr) {
      gshadow(g, 30);
      g.beginPath(); g.moveTo(-28, 0); g.quadraticCurveTo(-30, -24, -8, -30); g.quadraticCurveTo(12, -38, 26, -18); g.quadraticCurveTo(32, -4, 26, 0); g.closePath(); paint(g, '#c4c0de', 0, -16, 30, 3);
      E(g, -8, -22, 8, 4, -.4); g.fillStyle = 'rgba(255,255,255,.45)'; g.fill();
    },
    lighthouse(g, rr) {
      gshadow(g, 44);
      g.save(); g.beginPath(); g.rect(-60, -40, 120, 40); g.clip(); blob(g, [[-22, -6, 16], [14, -8, 20]], '#b9b4d8', 0, -10, 34); g.restore();
      PL(g, [-16, -10, -10, -120, 10, -120, 16, -10]); paint(g, '#ffffff', 0, -64, 30, 3.5);
      g.save(); PL(g, [-16, -10, -10, -120, 10, -120, 16, -10]); g.clip();
      for (let i = 0; i < 3; i++) { g.fillStyle = '#ff4a6a'; g.fillRect(-20, -34 - i * 34, 40, 16); } g.restore();
      PL(g, [-16, -10, -10, -120, 10, -120, 16, -10]); stroke(g, '#5a3a8e', 3);
      R(g, -14, -126, 28, 6, 3); flat(g, '#5a4f9a', 2.5);
      R(g, -9, -146, 18, 20, 4); const lg = g.createRadialGradient(0, -136, 0, 0, -136, 14); lg.addColorStop(0, '#ffffff'); lg.addColorStop(.5, '#fff27a'); lg.addColorStop(1, '#ffb21e'); g.fillStyle = lg; g.fill(); stroke(g, '#5a3a8e', 2.5);
      PL(g, [-13, -146, 0, -160, 13, -146]); flat(g, '#ff4a6a', 2.5); dot(g, 0, -162, 3, '#ffd23f');
      R(g, -5, -30, 10, 14, 5); flat(g, '#5a4f9a', 0);
    },
    boat(g, rr) {
      const c = ['#ff4a6a', '#3db8ff', '#ffb21e'][(rr() * 3) | 0];
      E(g, 0, -2, 40, 7); g.fillStyle = 'rgba(255,255,255,.45)'; g.fill();
      g.beginPath(); g.moveTo(-34, -16); g.lineTo(34, -16); g.quadraticCurveTo(26, 0, 0, 0); g.quadraticCurveTo(-26, 0, -34, -16); g.closePath(); paint(g, c, 0, -8, 34, 3);
      R(g, -30, -18, 60, 4, 2); flat(g, '#ffffff', 0);
      g.beginPath(); g.moveTo(2, -16); g.lineTo(2, -74); stroke(g, '#8a6a4a', 3);
      PL(g, [6, -72, 6, -22, 36, -22]); paint(g, '#ffffff', 16, -36, 26, 2.5); PL(g, [-2, -64, -2, -22, -26, -22]); paint(g, lt(c, .7), -10, -32, 20, 2.5);
      PL(g, [2, -74, 16, -70, 2, -66]); flat(g, c, 1.5);
    },
    house(g, rr) {
      const c = ['#ff9ab8', '#9fd8ff', '#ffe08a', '#c8b4ff', '#a8f0c8'][(rr() * 5) | 0];
      gshadow(g, 50);
      R(g, -36, -54, 72, 54, 6); paint(g, c, 0, -28, 44, 3.5);
      R(g, 16, -92, 12, 26, 3); flat(g, '#c97a6a', 2.5); R(g, 14, -96, 16, 7, 4); flat(g, '#ffffff', 2, '#b9c6ee');
      PL(g, [-46, -50, 0, -90, 46, -50]); paint(g, '#e86a7a', 0, -66, 44, 3.5);
      g.beginPath(); g.moveTo(-48, -50); g.lineTo(0, -92); g.lineTo(48, -50); g.quadraticCurveTo(40, -42, 30, -50); g.quadraticCurveTo(20, -42, 10, -50); g.quadraticCurveTo(0, -42, -10, -50); g.quadraticCurveTo(-20, -42, -30, -50); g.quadraticCurveTo(-40, -42, -48, -50); g.closePath();
      g.save(); g.clip(); g.fillStyle = '#ffffff'; g.fillRect(-60, -100, 120, 50); g.restore();
      g.beginPath(); g.moveTo(-48, -50); g.lineTo(0, -92); g.lineTo(48, -50); stroke(g, '#b9c6ee', 2.5);
      for (const x of [-22, 22]) { R(g, x - 9, -42, 18, 16, 4); const wg = g.createRadialGradient(x, -34, 0, x, -34, 14); wg.addColorStop(0, '#fff8c0'); wg.addColorStop(1, '#ffb83a'); g.fillStyle = wg; g.fill(); stroke(g, '#ffffff', 2.5); g.beginPath(); g.moveTo(x, -42); g.lineTo(x, -26); g.moveTo(x - 9, -34); g.lineTo(x + 9, -34); stroke(g, '#ffffff', 1.6); }
      R(g, -8, -26, 16, 26, 7); flat(g, dk(c, .35), 2.5); dot(g, 4, -12, 1.8, '#ffd23f');
      R(g, -40, -2, 80, 6, 3); flat(g, '#ffffff', 0);
    },
    snowman(g, rr) {
      gshadow(g, 26);
      E(g, 0, -18, 22, 20); paint(g, '#ffffff', 0, -18, 22, 3);
      E(g, 0, -50, 15, 15); paint(g, '#ffffff', 0, -50, 15, 3);
      R(g, -12, -68, 24, 5, 2); flat(g, '#5a4f9a', 2); R(g, -8, -84, 16, 17, 3); flat(g, '#5a4f9a', 2);
      R(g, -15, -40, 30, 6, 3); flat(g, '#ff4a6a', 2); R(g, 6, -40, 6, 16, 3); flat(g, '#ff4a6a', 2);
      dot(g, -5, -53, 2, '#33285c'); dot(g, 5, -53, 2, '#33285c'); PL(g, [0, -49, 12, -47, 0, -45]); flat(g, '#ff8a3d', 1.2);
      dot(g, 0, -22, 2.2, '#33285c'); dot(g, 0, -12, 2.2, '#33285c');
    },
    lamp(g, rr) {
      gshadow(g, 12);
      R(g, -3, -70, 6, 70, 3); flat(g, '#5a4f9a', 2);
      const gg = g.createRadialGradient(0, -78, 0, 0, -78, 30); gg.addColorStop(0, 'rgba(255,230,140,.75)'); gg.addColorStop(1, 'rgba(255,230,140,0)'); g.fillStyle = gg; g.beginPath(); g.arc(0, -78, 30, 0, TAU); g.fill();
      R(g, -9, -88, 18, 18, 4); flat(g, '#fff2a0', 2.5, '#5a4f9a'); PL(g, [-12, -88, 0, -98, 12, -88]); flat(g, '#5a4f9a', 2);
      R(g, -12, -100, 24, 5, 2.5); flat(g, '#ffffff', 0);
    },
    lavender(g, rr) {
      const n = 5 + (rr() * 3 | 0);
      E(g, 0, -2, 26, 8); g.fillStyle = 'rgba(60,40,120,.15)'; g.fill();
      for (let i = 0; i < n; i++) {
        const a = (i / (n - 1) - .5) * 1.1, x = Math.sin(a) * 30, y = -Math.cos(a) * 44;
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(x * .3, y * .5, x, y); stroke(g, '#4fae6a', 2.4);
        for (let k = 0; k < 4; k++) { const f = 1 - k * .12; E(g, x * f, y * f + 2, 4.2, 6, a); g.fillStyle = k % 2 ? '#9a6bff' : '#b88cff'; g.fill(); }
        dot(g, x - 1, y, 1.4, 'rgba(255,255,255,.7)');
      }
    },
    windmill(g, rr) {
      gshadow(g, 40);
      PL(g, [-26, 0, -18, -84, 18, -84, 26, 0]); paint(g, '#fff4e4', 0, -42, 30, 3.5);
      R(g, -8, -26, 16, 26, 7); flat(g, '#a86a3e', 2.5); E(g, 0, -60, 7, 7); flat(g, '#9fd8ff', 2.5, '#5a4f9a');
      g.beginPath(); g.moveTo(-24, -84); g.quadraticCurveTo(0, -116, 24, -84); g.closePath(); paint(g, '#c86a8a', 0, -94, 26, 3);
      for (let i = 0; i < 4; i++) {
        g.save(); g.translate(0, -94); g.rotate(i * Math.PI / 2 + .4);
        R(g, -2, -64, 4, 64, 2); flat(g, '#8a6a4a', 0);
        R(g, 2, -62, 14, 46, 2); flat(g, 'rgba(255,255,255,.92)', 2.2, '#8a6a4a');
        for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(2, -62 + k * 11.5); g.lineTo(16, -62 + k * 11.5); stroke(g, '#c8b4a0', 1.4); }
        g.restore();
      }
      dot(g, 0, -94, 5, '#5a4f9a');
    },
    cypress(g, rr) {
      gshadow(g, 18);
      g.beginPath(); g.moveTo(0, -96); g.quadraticCurveTo(20, -50, 14, -6); g.quadraticCurveTo(0, 2, -14, -6); g.quadraticCurveTo(-20, -50, 0, -96); g.closePath(); paint(g, '#2f9e6a', 0, -52, 30, 3);
      g.beginPath(); g.moveTo(-4, -84); g.quadraticCurveTo(-10, -50, -6, -20); stroke(g, '#ffffff', 2.5, .3);
    },
    hearts(g, rr) { heart(g, 0, -10, 9); paint(g, '#ff6fae', 0, -14, 10, 2); },
    beehive(g, rr) {
      gshadow(g, 22);
      for (let i = 0; i < 4; i++) { E(g, 0, -10 - i * 13, 22 - i * 3.5, 9); paint(g, '#ffc83d', 0, -12 - i * 13, 22, 2.5); }
      R(g, -5, -16, 10, 9, 4.5); flat(g, '#7a4526', 0);
    }
  };

  // ---------------- chapter themes ----------------
  // each: name, ground colours, path tint, an optional side water edge, decor lists (side, centre), animated bits
  const THEMES = [
    { key: 'rand', name: 'Kommirand', g: ['#ffe9c8', '#ffd9b0'], blob: '#fff4dc', water: 'left', wcol: ['#2fd0e8', '#7fe8ff'], side: ['palm', 'umbrella', 'lollipop', 'castle', 'hut', 'palm'], small: ['starfish', 'shell', 'shell', 'starfish'], anim: 'twinkle', accent: '#ff5a8a', path: '#ff8fb1' },
    { key: 'aas', name: 'Lilleaas', g: ['#a8ec8a', '#7fdc7a'], blob: '#c4f4a0', side: ['tree', 'bush', 'pond', 'fence', 'tulips', 'bush', 'beehive'], small: ['flowers', 'flowers', 'tulips', 'flowers'], anim: 'butterfly', accent: '#ff5a8a', path: '#ffd23f' },
    { key: 'mets', name: 'Marjamets', g: ['#7fd28a', '#4fbf78'], blob: '#9fe0a0', side: ['tree', 'pine', 'tree', 'berries', 'log', 'pine'], small: ['mushroom', 'berries', 'mushroom', 'flowers'], anim: 'firefly', accent: '#ff3d6b', path: '#ff6b8a' },
    { key: 'kalju', name: 'Tuletorni kaljud', g: ['#9fe08a', '#7fd07a'], blob: '#bff0a0', water: 'both', wcol: ['#2f9cff', '#7fd0ff'], side: ['lighthouse', 'rock', 'boat', 'rock', 'boat'], small: ['flowers', 'rock', 'flowers'], anim: 'gull', accent: '#3db8ff', path: '#8fdcff' },
    { key: 'talv', name: 'Talveküla', g: ['#f4f8ff', '#dfe8ff'], blob: '#ffffff', side: ['house', 'pine', 'house', 'snowman', 'lamp', 'pine'], small: ['pine', 'lamp'], snow: true, anim: 'snow', accent: '#7c5cff', path: '#b79cff' },
    { key: 'lavendel', name: 'Lavendliväljad', g: ['#e4d4ff', '#cdb8ff'], blob: '#f0e6ff', rows: true, side: ['windmill', 'cypress', 'lavender', 'cypress', 'beehive'], small: ['lavender', 'lavender', 'flowers'], anim: 'bee', accent: '#9a5cff', path: '#ff9ccc' }
  ];
  A.mapThemes = THEMES;
  A.mapChapterOf = level => Math.max(0, Math.floor(((level | 0) - 1) / 50));
  A.mapTheme = function (ch) {
    const T = THEMES[((ch | 0) % THEMES.length + THEMES.length) % THEMES.length];
    return { key: T.key, name: T.name, path: T.path, accent: T.accent, ink: '#33285c' };
  };

  // water edge as a function of tile y (periodic in H): x position of the shoreline from the side
  function edge(y, H, w, k) { return w * (.13 + .035 * Math.sin(TAU * y / H * 2 + k) + .02 * Math.sin(TAU * y / H * 5 + k * 2)); }

  const tiles = new Map();
  function tileFor(ch, w, sc) {
    const T = THEMES[((ch | 0) % THEMES.length + THEMES.length) % THEMES.length], cyc = Math.floor((ch | 0) / THEMES.length);
    const rs = Math.min(sc, Q() >= 2 ? 2.5 : 2), Ht = Math.round(w * 2.2), key = ch % 60 + '|' + w + '|' + rs;
    let t = tiles.get(key); if (t) return t;
    if (tiles.size >= 2) tiles.delete(tiles.keys().next().value);
    const c = mk(w * rs, Ht * rs), g = c.getContext('2d'); g.scale(rs, rs);
    const rr = srnd(1000 + (ch | 0) * 7919), H = Ht;
    const wrap = (y, m, fn) => { fn(y); if (y < m) fn(y + H); if (y > H - m) fn(y - H); };
    // ground
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, T.g[1]); gr.addColorStop(.5, T.g[0]); gr.addColorStop(1, T.g[1]);
    g.fillStyle = gr; g.fillRect(0, 0, w, H);
    // soft blobs (texture): periodic placement
    for (let i = 0; i < 46; i++) { const x = rr() * w, y = rr() * H, r = 18 + rr() * 50, al = .35 + rr() * .2; wrap(y, r * .7, yy => { E(g, x, yy, r * 1.4, r * .6); g.fillStyle = rgba(T.blob, al); g.fill(); }); }
    if (T.rows) { // lavender rows across the sides (periodic: rows spacing divides H)
      const n = Math.round(H / 34), sp = H / n;
      for (let i = 0; i < n; i++) {
        const y = i * sp + 10;
        for (const side of [0, 1]) {
          const x0 = side ? w * .74 : 0, x1 = side ? w : w * .26;
          g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); stroke(g, '#8a5ce0', 13, .55);
          for (let x = x0 + 6; x < x1; x += 9) { E(g, x, y - 3, 4.5, 6); g.fillStyle = (x / 9 | 0) % 2 ? '#a77cff' : '#9466f0'; g.fill(); }
        }
      }
    }
    if (T.snow) { for (let i = 0; i < 60; i++) { const x = rr() * w, y = rr() * H, rd = 1.2 + rr() * 1.6; wrap(y, 6, yy => { dot(g, x, yy, rd, 'rgba(160,180,240,.35)'); }); } }
    // water at the sides
    if (T.water) {
      const sides = T.water === 'both' ? [0, 1] : [0];
      for (const side of sides) {
        const k = side * 2.1 + cyc, X = y => side ? w - edge(y, H, w, k) : edge(y, H, w, k);
        const shape = (off) => { g.beginPath(); g.moveTo(side ? w : 0, 0); for (let y = 0; y <= H; y += 8) g.lineTo(X(y) + (side ? -off : off), y); g.lineTo(side ? w : 0, H); g.closePath(); };
        shape(14); g.fillStyle = T.key === 'kalju' ? '#8a7cb8' : '#fff6e0'; g.fill(); // wet sand / cliff edge
        if (T.key === 'kalju') { shape(9); g.fillStyle = '#b3a8d8'; g.fill(); shape(4); g.fillStyle = '#d8d0f0'; g.fill(); }
        shape(0); const wg = g.createLinearGradient(side ? w : 0, 0, side ? w * .78 : w * .22, 0); wg.addColorStop(0, dk(T.wcol[0], .12)); wg.addColorStop(.7, T.wcol[0]); wg.addColorStop(1, T.wcol[1]); g.fillStyle = wg; g.fill();
        g.beginPath(); for (let y = 0; y <= H; y += 8) g[y ? 'lineTo' : 'moveTo'](X(y) + (side ? 4 : -4), y); stroke(g, '#ffffff', 4, .85);
        g.beginPath(); for (let y = 0; y <= H; y += 8) g[y ? 'lineTo' : 'moveTo'](X(y) + (side ? 16 : -16), y); stroke(g, '#ffffff', 2, .4);
        // wave ticks
        for (let i = 0; i < 18; i++) { const y = rr() * H, x = side ? w - rr() * edge(y, H, w, k) * .7 : rr() * edge(y, H, w, k) * .7; wrap(y, 10, yy => { g.beginPath(); g.arc(x, yy, 6, Math.PI * 1.15, Math.PI * 1.85); stroke(g, '#ffffff', 2, .55); }); }
      }
    }
    // decor: side bands, sorted by y so lower things overlap upper ones
    const items = [], band = T.water ? .3 : .27, nSide = Math.round(H / 70), nSmall = Math.round(H / 46);
    for (let i = 0; i < nSide; i++) {
      const left = i % 2 === 0, y = (i + .2 + rr() * .6) * H / nSide;
      let x = left ? w * (.03 + rr() * (band - .06)) : w * (1 - .03 - rr() * (band - .06));
      const kind = T.side[(rr() * T.side.length) | 0];
      if (T.water && (kind === 'boat')) x = left ? edge(y, H, w, cyc) * .45 : w - edge(y, H, w, 2.1 + cyc) * .45;
      else if (T.water) { const e = left ? edge(y, H, w, cyc) + 26 : w - edge(y, H, w, 2.1 + cyc) - 26; if (T.water === 'both' || left) x = left ? Math.max(x, e) : Math.min(x, e); }
      items.push({ kind, x, y, s: (kind === 'lighthouse' ? 64 : kind === 'pond' ? 46 : 50) * (w / 440) * (.85 + rr() * .3), seed: rr() * 1e6 | 0 });
    }
    for (let i = 0; i < nSmall; i++) {
      const y = rr() * H, side = rr();
      let x = side < .4 ? w * (.04 + rr() * .24) : side < .8 ? w * (.72 + rr() * .24) : w * (.3 + rr() * .4);
      if (T.water) { const e = edge(y, H, w, cyc) + 18; if (x < e) x = e + rr() * 30; if (T.water === 'both') { const e2 = w - edge(y, H, w, 2.1 + cyc) - 18; if (x > e2) x = e2 - rr() * 30; } }
      const kind = T.small[(rr() * T.small.length) | 0];
      items.push({ kind, x, y, s: 30 * (w / 440) * (.8 + rr() * .4) * (kind === 'pine' || kind === 'lamp' ? 1.3 : 1), seed: rr() * 1e6 | 0, small: 1 });
    }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) {
      const f = D[it.kind]; if (!f) continue;
      wrap(it.y, it.s * 1.8, yy => { const r2 = srnd(it.seed); at(g, it.x, yy, it.s, gg => f(gg, r2, T.snow)); });
    }
    // gentle vignette toward the sides so the centre (the path) reads clearly
    const vg = g.createLinearGradient(0, 0, w, 0); vg.addColorStop(0, 'rgba(255,255,255,0)'); vg.addColorStop(.38, 'rgba(255,255,255,.10)'); vg.addColorStop(.62, 'rgba(255,255,255,.10)'); vg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = vg; g.fillRect(0, 0, w, H);
    // animated bits (tile space positions)
    const bits = [], nb = 26;
    for (let i = 0; i < nb; i++) {
      let x = rr() * w; const y = rr() * H;
      if (T.anim === 'twinkle' || T.anim === 'gull') { const e = edge(y, H, w, cyc); x = (T.water === 'both' && rr() < .5) ? w - rr() * edge(y, H, w, 2.1 + cyc) * .9 : rr() * e * .9; }
      bits.push({ x, y, p: rr() * TAU, s: .6 + rr() * .7 });
    }
    t = { c, H, rs, T, bits };
    tiles.set(key, t); return t;
  }

  A.mapBg = function (ctx, ch, x, y, w, h, t, scroll) {
    t = t == null ? now() : t; scroll = scroll || 0;
    const sc = A.scaleOf(ctx), tl = tileFor(ch | 0, Math.round(w), sc), H = tl.H;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const off = ((scroll % H) + H) % H;
    for (let yy = y - off; yy < y + h; yy += H) ctx.drawImage(tl.c, x, yy, w, H);
    // animated layer
    const T = tl.T, q = Q(), n = [8, 16, 26][q];
    for (let i = 0; i < n && i < tl.bits.length; i++) {
      const b = tl.bits[i];
      if (T.anim === 'snow') { // falls in screen space
        const sy = y + ((b.y + t * 24 * b.s) % (h + 20)) - 10, sx = x + (b.x + Math.sin(t * .8 + b.p) * 14) % w;
        dot(ctx, sx, sy, 1.6 + b.s * 1.8, 'rgba(255,255,255,.95)'); ctx.beginPath(); ctx.arc(sx, sy, 1.6 + b.s * 1.8, 0, TAU); ctx.lineWidth = .8; ctx.strokeStyle = 'rgba(150,170,230,.5)'; ctx.stroke();
        continue;
      }
      let by = b.y - off; if (by < -20) by += H; if (by > H) by -= H; const sy = y + by; if (sy < y - 20 || sy > y + h + 20) continue;
      if (T.anim === 'twinkle' || (T.anim === 'gull' && i % 3)) {
        const a = Math.max(0, Math.sin(t * 2.2 + b.p)); if (a < .2) continue;
        A.sparkAt(ctx, x + b.x, sy, 2 + a * 4 * b.s, 'rgba(255,255,255,' + (.5 + a * .5).toFixed(2) + ')');
      } else if (T.anim === 'gull') {
        const gx = x + ((b.x + t * 18 * b.s) % (w + 40)) - 20, gy = sy + Math.sin(t + b.p) * 6, f = Math.sin(t * 6 + b.p) * 4;
        ctx.beginPath(); ctx.moveTo(gx - 8, gy - f); ctx.quadraticCurveTo(gx - 4, gy - 4, gx, gy); ctx.quadraticCurveTo(gx + 4, gy - 4, gx + 8, gy - f); stroke(ctx, '#ffffff', 2.4);
      } else if (T.anim === 'butterfly' || T.anim === 'bee') {
        const bx = x + b.x + Math.sin(t * .7 + b.p) * 26, byy = sy + Math.sin(t * 1.1 + b.p * 2) * 14, fl = Math.abs(Math.sin(t * 12 + b.p));
        if (T.anim === 'bee') {
          E(ctx, bx - 2, byy - 4, 3, 4 * fl + 1); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill(); E(ctx, bx + 2, byy - 4, 3, 4 * fl + 1); ctx.fill();
          E(ctx, bx, byy, 4.5, 3.2); ctx.fillStyle = '#ffc83d'; ctx.fill(); ctx.fillStyle = '#33285c'; ctx.fillRect(bx - .8, byy - 3, 1.6, 6);
        } else {
          const c = ['#ff6fae', '#ffd23f', '#8fdcff', '#b79cff'][i % 4];
          E(ctx, bx - 4 * fl, byy - 2, 4.5 * fl + .8, 5); ctx.fillStyle = c; ctx.fill(); E(ctx, bx + 4 * fl, byy - 2, 4.5 * fl + .8, 5); ctx.fill();
          E(ctx, bx - 3 * fl, byy + 3, 3 * fl + .6, 3); ctx.fill(); E(ctx, bx + 3 * fl, byy + 3, 3 * fl + .6, 3); ctx.fill();
          ctx.fillStyle = '#33285c'; ctx.fillRect(bx - .8, byy - 4, 1.6, 9);
        }
      } else if (T.anim === 'firefly') {
        const a = .5 + .5 * Math.sin(t * 2.6 + b.p), fx = x + b.x + Math.sin(t * .5 + b.p) * 18, fy = sy + Math.cos(t * .6 + b.p) * 12;
        const gg = ctx.createRadialGradient(fx, fy, 0, fx, fy, 9); gg.addColorStop(0, 'rgba(255,250,170,' + (.9 * a).toFixed(2) + ')'); gg.addColorStop(1, 'rgba(255,240,120,0)');
        ctx.fillStyle = gg; ctx.fillRect(fx - 9, fy - 9, 18, 18); dot(ctx, fx, fy, 1.6, 'rgba(255,255,230,' + a.toFixed(2) + ')');
      }
    }
    ctx.restore();
  };

  A.mapDivider = function (ctx, ch, x, y, w, t) {
    const T = A.mapTheme(ch), hh = 120;
    ctx.save();
    const gr = ctx.createLinearGradient(0, y - hh / 2, 0, y + hh / 2); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.4, 'rgba(255,255,255,.9)'); gr.addColorStop(.6, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr; ctx.fillRect(x, y - hh / 2, w, hh);
    // puffy clouds along the band
    for (let i = 0; i < 7; i++) { const cx = x + (i + .5) * w / 7, cy = y + Math.sin(i * 2.3) * 10; ctx.beginPath(); ctx.arc(cx - 16, cy, 16, 0, TAU); ctx.arc(cx + 12, cy - 4, 20, 0, TAU); ctx.arc(cx + 30, cy + 4, 12, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill(); }
    ctx.font = '900 17px ' + FONT; const label = 'Peatükk ' + ((ch | 0) + 1) + ' · ' + T.name, tw = ctx.measureText(label).width, bw = Math.min(w - 20, tw + 56), bh = 38;
    A.panel(ctx, x + w / 2 - bw / 2, y - bh / 2, bw, bh, 'ribbon');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff'; ctx.fillText(label, x + w / 2, y + 1);
    const tt = t == null ? now() : t;
    A.sparkAt(ctx, x + w / 2 + bw / 2 - 6, y - bh / 2 + 2, 7 + 2 * Math.sin(tt * 3), '#fff6c0');
    ctx.restore();
  };

  // ---------------- the candy path ----------------
  function normPts(points) {
    if (!points || !points.length) return [];
    if (typeof points[0] === 'number') { const o = []; for (let i = 0; i + 1 < points.length; i += 2) o.push([points[i], points[i + 1]]); return o; }
    return points.map(p => Array.isArray(p) ? p : [p.x, p.y]);
  }
  // Catmull-Rom sampled polyline with cumulative length and the source index of every sample
  function sample(P) {
    const out = [], n = P.length; if (n < 2) return out;
    for (let i = 0; i < n - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n - 1, i + 2)];
      const seg = Math.max(4, Math.min(24, Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 6 | 0));
      for (let k = 0; k < seg; k++) {
        const u = k / seg, u2 = u * u, u3 = u2 * u;
        const f = (a, b, c, d) => .5 * ((2 * b) + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), i + u]);
      }
    }
    const L = P[n - 1]; out.push([L[0], L[1], n - 1]);
    let d = 0; out[0][3] = 0; for (let i = 1; i < out.length; i++) { d += Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]); out[i][3] = d; }
    return out;
  }
  const CANDY = ['#ff5a8a', '#ffb21e', '#2fd59a', '#3db8ff', '#9a6bff'];
  A.mapPath = function (ctx, points, t, opts) {
    opts = opts || {}; t = t == null ? now() : t;
    const S = sample(normPts(points)); if (S.length < 2) return;
    const W = opts.width || 22, done = opts.done == null ? -1 : opts.done;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const trace = (dy) => { ctx.beginPath(); ctx.moveTo(S[0][0], S[0][1] + dy); for (let i = 1; i < S.length; i++) ctx.lineTo(S[i][0], S[i][1] + dy); };
    trace(4); ctx.lineWidth = W + 6; ctx.strokeStyle = 'rgba(60,40,130,.18)'; ctx.stroke();
    trace(0); ctx.lineWidth = W + 5; ctx.strokeStyle = 'rgba(120,90,200,.35)'; ctx.stroke();
    ctx.lineWidth = W; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    trace(-W * .14); ctx.lineWidth = W * .42; ctx.strokeStyle = 'rgba(255,246,232,.9)'; ctx.stroke();
    // candy dots every ~step px; the done part is coloured, the rest pale
    const step = W * .95, total = S[S.length - 1][3], shine = (t * 90) % Math.max(1, total);
    let j = 0;
    for (let d = step * .5, k = 0; d < total; d += step, k++) {
      while (j < S.length - 2 && S[j + 1][3] < d) j++;
      const a = S[j], b = S[j + 1], u = (d - a[3]) / Math.max(1e-3, b[3] - a[3]), px = a[0] + (b[0] - a[0]) * u, py = a[1] + (b[1] - a[1]) * u, idx = a[2] + (b[2] - a[2]) * u;
      const on = idx <= done, r = W * .2;
      if (on) {
        const c = CANDY[k % CANDY.length], near = Math.abs(d - shine) < step * 1.5 && idx <= done ? 1 + .35 * (1 - Math.abs(d - shine) / (step * 1.5)) : 1;
        dot(ctx, px, py + 1.2, r * near + 1, dk(c, .35)); dot(ctx, px, py, r * near, c); dot(ctx, px - r * .35, py - r * .35, r * .35 * near, 'rgba(255,255,255,.9)');
      } else dot(ctx, px, py, r * .8, '#ddd6f4');
    }
    ctx.restore();
  };

  // ---------------- level nodes ----------------
  const NODE = {
    locked: ['#e6e3f6', '#b4afd6', '#8a85b8'], open: ['#9fe2ff', '#2f9cff', '#1a6fd0'], current: ['#fff27a', '#ffb21e', '#d07a00'],
    done: ['#ffa8d2', '#ff4f9a', '#c01f6a'], boss: ['#d6bcff', '#7c5cff', '#4a2ab8']
  };
  const _node = new Map();
  function nodeSprite(state, boss, px) {
    const key = state + boss + '|' + px; let c = _node.get(key); if (c) return c;
    if (_node.size > 80) _node.clear();
    c = mk(px, px); const g = c.getContext('2d'), r = px / 2.9, cx = px / 2, cy = px / 2 - r * .08;
    const P = boss && state !== 'locked' ? NODE.boss : NODE[state] || NODE.open;
    E(g, cx, cy + r * 1.02, r * .95, r * .3); g.fillStyle = 'rgba(50,30,110,.22)'; g.fill();
    g.beginPath(); g.arc(cx, cy + r * .16, r, 0, TAU); g.fillStyle = P[2]; g.fill();
    // outer ring: white (gold for bosses)
    g.beginPath(); g.arc(cx, cy, r, 0, TAU);
    const rg = g.createLinearGradient(0, cy - r, 0, cy + r);
    if (boss && state !== 'locked') { rg.addColorStop(0, '#fff6b0'); rg.addColorStop(.5, '#ffc83d'); rg.addColorStop(1, '#e08a00'); } else { rg.addColorStop(0, '#ffffff'); rg.addColorStop(1, '#e4e0f8'); }
    g.fillStyle = rg; g.fill(); g.lineWidth = Math.max(1, r * .06); g.strokeStyle = rgba(P[2], .8); g.stroke();
    // inner candy disk
    const ir = r * .78; g.beginPath(); g.arc(cx, cy, ir, 0, TAU);
    const ig = g.createRadialGradient(cx - ir * .35, cy - ir * .45, ir * .05, cx, cy, ir * 1.1); ig.addColorStop(0, P[0]); ig.addColorStop(.55, P[1]); ig.addColorStop(1, dk(P[1], .18));
    g.fillStyle = ig; g.fill();
    g.beginPath(); g.arc(cx, cy, ir, 0, TAU); g.lineWidth = Math.max(1, r * .05); g.strokeStyle = rgba(dk(P[1], .4), .55); g.stroke();
    // gloss
    g.save(); g.beginPath(); g.arc(cx, cy, ir, 0, TAU); g.clip();
    E(g, cx, cy - ir * .55, ir * .78, ir * .42); g.fillStyle = 'rgba(255,255,255,.42)'; g.fill(); g.restore();
    E(g, cx - ir * .5, cy - ir * .5, ir * .14, ir * .08, -.7); g.fillStyle = 'rgba(255,255,255,.9)'; g.fill();
    if (false) { // (padlock badge removed: grey already reads as locked)
      const lx = cx + r * .66, ly = cy + r * .58, s = r * .3;
      g.beginPath(); g.arc(lx, ly - s * .2, s * .55, Math.PI, 0); g.lineWidth = s * .28; g.strokeStyle = '#8a85b8'; g.stroke();
      R(g, lx - s * .8, ly - s * .2, s * 1.6, s * 1.2, s * .35); g.fillStyle = '#a49ee0'; g.fill(); g.lineWidth = Math.max(1, s * .14); g.strokeStyle = '#ffffff'; g.stroke();
    }
    if (boss) { // crown above
      const s = r * .9, x0 = cx - s / 2, y0 = cy - r * 1.42;
      PL(g, [x0, y0 + s * .62, x0 - s * .04, y0 + s * .12, x0 + s * .27, y0 + s * .36, x0 + s * .5, y0, x0 + s * .73, y0 + s * .36, x0 + s * 1.04, y0 + s * .12, x0 + s, y0 + s * .62]);
      const cg = g.createLinearGradient(0, y0, 0, y0 + s * .62);
      if (state === 'locked') { cg.addColorStop(0, '#f0eefa'); cg.addColorStop(1, '#bcb6de'); } else { cg.addColorStop(0, '#fff6a8'); cg.addColorStop(1, '#ffb21e'); }
      g.fillStyle = cg; g.fill(); g.lineWidth = Math.max(1, s * .07); g.lineJoin = 'round'; g.strokeStyle = state === 'locked' ? '#8a85b8' : '#b8600c'; g.stroke();
      for (const [dx, col] of [[.27, '#3db8ff'], [.5, '#ff4f9a'], [.73, '#2fd59a']]) dot(g, x0 + s * dx, y0 + s * .48, s * .07, state === 'locked' ? '#d4d0ec' : col);
      dot(g, x0 + s * .5, y0 - s * .02, s * .07, state === 'locked' ? '#d4d0ec' : '#ffffff');
    }
    _node.set(key, c); return c;
  }
  const _st = {};
  function starSprite(on, px) {
    const key = (on ? 1 : 0) + '|' + px; if (_st[key]) return _st[key];
    if (on) return (_st[key] = A.icon('star', px));
    const c = mk(px, px), g = c.getContext('2d'); g.scale(px / 100, px / 100);
    pstar(g, 50, 54, 44); g.fillStyle = 'rgba(80,60,150,.25)'; g.fill(); pstar(g, 50, 50, 44); g.fillStyle = '#ece8fa'; g.fill(); g.lineWidth = 6; g.strokeStyle = '#ffffff'; g.stroke();
    return (_st[key] = c);
  }
  A.mapNode = function (ctx, x, y, r, state, stars, n, t) {
    t = t == null ? now() : t; state = state || 'open';
    const boss = n > 0 && n % 10 === 0, R0 = r * (boss ? 1.28 : 1), sc = A.scaleOf(ctx);
    const px = Math.ceil(R0 * 2.9 * sc), cur = state === 'current';
    const bob = cur ? 1 + .05 * Math.sin(t * 4.2) : 1, Rr = R0 * bob;
    ctx.save();
    if (cur) { // pulsing halo + orbiting sparkles
      for (let k = 0; k < 2; k++) {
        const v = (t * .9 + k * .5) % 1; ctx.globalAlpha = (1 - v) * .75;
        ctx.beginPath(); ctx.arc(x, y, R0 * (1.05 + v * .7), 0, TAU); ctx.lineWidth = 5 * (1 - v) + 1.5; ctx.strokeStyle = boss ? '#c9a8ff' : '#fff27a'; ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const gg = ctx.createRadialGradient(x, y, R0 * .6, x, y, R0 * 1.6); gg.addColorStop(0, 'rgba(255,240,150,.55)'); gg.addColorStop(1, 'rgba(255,240,150,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, R0 * 1.6, 0, TAU); ctx.fill();
    }
    const S = R0 * 2.9 * bob; ctx.drawImage(nodeSprite(state, boss, px), x - S / 2, y - S / 2 + Rr * .08, S, S);
    if (cur) for (let k = 0; k < 3; k++) { const a = t * 1.6 + k * TAU / 3; A.sparkAt(ctx, x + Math.cos(a) * R0 * 1.25, y + Math.sin(a) * R0 * 1.25, R0 * (.16 + .06 * Math.sin(t * 5 + k)), '#ffffff'); }
    // number
    const s = String(n | 0), fs = Rr * (s.length <= 2 ? .82 : s.length === 3 ? .66 : .52);
    ctx.font = '900 ' + fs + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    const ty = y + fs * .04;
    if (state === 'locked') { ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = fs * .16; ctx.strokeStyle = 'rgba(110,100,170,.7)'; ctx.strokeText(s, x, ty); ctx.fillText(s, x, ty); }
    else { ctx.lineWidth = fs * .22; ctx.strokeStyle = 'rgba(50,25,100,.75)'; ctx.strokeText(s, x, ty + fs * .05); ctx.fillStyle = '#ffffff'; ctx.fillText(s, x, ty); }
    // stars: a smiling arc under the node
    if (state === 'done' || stars > 0) {
      const ss = R0 * .62, spx = Math.ceil(ss * sc);
      for (let i = 0; i < 3; i++) {
        const a = Math.PI / 2 + (1 - i) * .62, d = R0 * 1.12, big = i === 1 ? 1.18 : 1, sz = ss * big;
        ctx.drawImage(starSprite(i < (stars | 0), Math.ceil(spx * big)), x + Math.cos(a) * d - sz / 2, y + Math.sin(a) * d - sz / 2 + (i === 1 ? R0 * .08 : 0), sz, sz);
      }
    }
    ctx.restore();
  };

  // ---------------- lucky wheel ----------------
  const WHEEL_COLS = ['#ff6fae', '#ffd23f', '#5fd8ff', '#7ce8a8', '#b79cff', '#ff9a6b', '#ff8fd0', '#8fdcff'];
  const _wf = new Map();
  function sliceIcon(ic, px) {
    if (!ic) return null; if (ic.width) return ic;
    try {
      if (A.iconDefs[ic]) return A.icon(ic, px);
      if (A.defs[ic] || A.alias[ic] || A.names[ic]) return A.item(ic, 1, px);
      if (A.boosterDefs && A.boosterDefs[ic]) return A.booster(ic, px);
    } catch (e) { }
    return A.icon(ic, px);
  }
  function wheelFace(slices, r, sc) {
    const n = slices.length, key = r + '|' + sc + '|' + slices.map(s => (s.icon && s.icon.width ? 'c' : s.icon) + ':' + s.label + ':' + s.color).join(',');
    let c = _wf.get(key); if (c) return c;
    if (_wf.size > 4) _wf.clear();
    const px = Math.ceil(r * 2 * sc); c = mk(px, px); const g = c.getContext('2d'); g.scale(sc, sc); g.translate(r, r);
    const step = TAU / n;
    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI / 2 + (i - .5) * step, a1 = a0 + step, col = slices[i].color || WHEEL_COLS[i % WHEEL_COLS.length];
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, a0, a1); g.closePath();
      const gr = g.createRadialGradient(0, 0, r * .1, 0, 0, r); gr.addColorStop(0, lt(col, .75)); gr.addColorStop(.6, lt(col, .15)); gr.addColorStop(1, col);
      g.fillStyle = gr; g.fill();
      // inner sheen on the slice
      g.save(); g.clip(); g.beginPath(); g.arc(0, 0, r * .96, a0 + .04, a0 + step * .45); g.lineWidth = r * .06; g.strokeStyle = 'rgba(255,255,255,.3)'; g.stroke(); g.restore();
    }
    for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i - .5) * step; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); g.lineWidth = Math.max(1.5, r * .022); g.strokeStyle = '#ffffff'; g.stroke(); }
    // icons and labels
    for (let i = 0; i < n; i++) {
      const s = slices[i], a = -Math.PI / 2 + i * step;
      g.save(); g.rotate(a + Math.PI / 2);
      const isz = r * Math.min(.32, 1.6 / n + .1), img = sliceIcon(s.icon, Math.ceil(isz * sc));
      if (img) g.drawImage(img, -isz / 2, -r * .6 - isz / 2, isz, isz);
      if (s.label != null) {
        const fs = r * (n > 8 ? .1 : .12) * Math.min(1, 6 / Math.max(1, String(s.label).length)); g.font = '900 ' + fs + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
        g.lineWidth = fs * .32; g.strokeStyle = 'rgba(50,25,100,.8)'; g.strokeText(String(s.label), 0, -r * .82); g.fillStyle = '#ffffff'; g.fillText(String(s.label), 0, -r * .82);
      }
      g.restore();
    }
    // subtle inner shade near the rim
    const sg = g.createRadialGradient(0, 0, r * .7, 0, 0, r); sg.addColorStop(0, 'rgba(60,30,120,0)'); sg.addColorStop(1, 'rgba(60,30,120,.18)');
    g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fillStyle = sg; g.fill();
    _wf.set(key, c); return c;
  }
  A.wheelIndex = function (angle, n) { const st = TAU / n; return ((Math.round(-angle / st) % n) + n) % n; };
  A.wheel = function (ctx, x, y, r, slices, angle, t) {
    t = t == null ? now() : t; slices = slices && slices.length ? slices : [{ icon: 'coin', label: '?' }];
    const sc = A.scaleOf(ctx), rim = r * .13, fr = r - rim;
    ctx.save();
    // drop shadow and the gold rim
    E(ctx, x, y + r * .08, r * 1.02, r * 1.02); ctx.fillStyle = 'rgba(60,30,120,.22)'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    const rg = ctx.createLinearGradient(x, y - r, x, y + r); rg.addColorStop(0, '#fff3a0'); rg.addColorStop(.35, '#ffc83d'); rg.addColorStop(.7, '#f0a01a'); rg.addColorStop(1, '#ffd96a');
    ctx.fillStyle = rg; ctx.fill(); ctx.lineWidth = Math.max(1.5, r * .02); ctx.strokeStyle = '#b8600c'; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r - rim * .18, Math.PI * 1.1, Math.PI * 1.7); ctx.lineWidth = rim * .22; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineCap = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, fr + 1, 0, TAU); ctx.fillStyle = '#b8600c'; ctx.fill();
    // face
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle || 0); ctx.drawImage(wheelFace(slices, fr, sc), -fr, -fr, fr * 2, fr * 2); ctx.restore();
    // bulbs (blinking in two groups)
    const nb = Math.max(12, Math.min(24, Math.round(r / 7) * 2)), ph = Math.floor(t * 3) % 2;
    for (let i = 0; i < nb; i++) {
      const a = i / nb * TAU, bx = x + Math.cos(a) * (r - rim / 2), by = y + Math.sin(a) * (r - rim / 2), on = (i % 2) === ph, br = rim * .3;
      if (on) { const gg = ctx.createRadialGradient(bx, by, 0, bx, by, br * 2.6); gg.addColorStop(0, 'rgba(255,255,220,.9)'); gg.addColorStop(1, 'rgba(255,240,160,0)'); ctx.fillStyle = gg; ctx.fillRect(bx - br * 2.6, by - br * 2.6, br * 5.2, br * 5.2); }
      dot(ctx, bx, by + br * .2, br * 1.1, 'rgba(150,80,10,.5)'); dot(ctx, bx, by, br, on ? '#fffbe0' : '#ffe08a'); dot(ctx, bx - br * .3, by - br * .3, br * .35, 'rgba(255,255,255,.95)');
    }
    // hub
    const hr = r * .17;
    dot(ctx, x, y + hr * .12, hr * 1.05, 'rgba(120,60,10,.45)');
    ctx.beginPath(); ctx.arc(x, y, hr, 0, TAU); const hg = ctx.createRadialGradient(x - hr * .4, y - hr * .4, hr * .1, x, y, hr); hg.addColorStop(0, '#fffbe0'); hg.addColorStop(.5, '#ffd23f'); hg.addColorStop(1, '#e08a00'); ctx.fillStyle = hg; ctx.fill();
    ctx.lineWidth = Math.max(1.5, hr * .12); ctx.strokeStyle = '#ffffff'; ctx.stroke();
    pstar(ctx, x, y + hr * .04, hr * .58); ctx.fillStyle = '#ff4f9a'; ctx.fill(); ctx.lineWidth = Math.max(1, hr * .08); ctx.strokeStyle = '#ffffff'; ctx.stroke();
    // pointer at the top (does not rotate): a glossy berry drop pointing down into the wheel
    const py = y - r - r * .02, pw = r * .16, ph2 = r * .26;
    ctx.beginPath(); ctx.moveTo(x, py + ph2 + r * .02); ctx.bezierCurveTo(x - pw * .3, py + ph2 * .6, x - pw, py + ph2 * .3, x - pw, py); ctx.arc(x, py, pw, Math.PI, 0); ctx.bezierCurveTo(x + pw, py + ph2 * .3, x + pw * .3, py + ph2 * .6, x, py + ph2 + r * .02); ctx.closePath();
    ctx.save(); ctx.translate(0, r * .025); ctx.fillStyle = 'rgba(80,20,60,.35)'; ctx.fill(); ctx.restore();
    const pg = ctx.createLinearGradient(x - pw, py - pw, x + pw, py + ph2); pg.addColorStop(0, '#ff9ccc'); pg.addColorStop(.5, '#ff3d8b'); pg.addColorStop(1, '#c01f6a'); ctx.fillStyle = pg; ctx.fill();
    ctx.lineWidth = Math.max(1.5, r * .022); ctx.strokeStyle = '#ffffff'; ctx.stroke();
    dot(ctx, x, py, pw * .38, '#ffffff'); E(ctx, x - pw * .45, py - pw * .45, pw * .22, pw * .13, -.7); ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fill();
    ctx.restore();
  };
})(ART);
