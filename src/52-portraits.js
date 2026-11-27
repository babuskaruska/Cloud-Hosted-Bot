// ---- Boss portraits and the boss intro card -----------------------------------------------------------------------
// bossPortrait(kind, size): a canvas (size x size) with a pixel-art bust of the boss MON[kind], painted in code on a
// 32 x 32 grid and scaled up with hard pixels. Shaded shapes (lit from the upper left, 2x2 ordered dither between
// the tones of a ramp), a dark outline, glowing eyes and a dim backdrop in the boss's colour. A kind without its
// own painting gets a silhouette with its eyes (MON[kind].eye). Cached per kind and size.
//
// BOSSCARD (UI.bossCard(kind, name, title) in 72-ui.js shows it; bossEntrance in 40-fx.js calls that): a card that
// slides in under the top plates for about 2.6 s: the portrait in a frame, "Boss", the name and a title. It sits at
// the left edge (the boss is framed in the middle by the entrance camera) and gets out of the way quickly.
const PORT_N = 32;
const PORT_RAMP = {
  bone: ['#3e3a30', '#7e7766', '#bdb49c', '#efe8d6'],
  boneD: ['#24211c', '#4e4a40', '#7e7766', '#a8a08a'],
  ogre: ['#26301c', '#4c5c36', '#76894e', '#a3b673'],
  tusk: ['#6a604a', '#b4a888', '#e6dcc0', '#fffbe8'],
  leather: ['#21160f', '#402c1e', '#634632', '#86664a'],
  iron: ['#16181e', '#363a44', '#5e6572', '#959eac'],
  ice: ['#16304e', '#356496', '#6fa8d8', '#c4e8ff'],
  frost: ['#4e6c8a', '#98bcd8', '#d8ecfa', '#ffffff'],
  chitin: ['#0e0a14', '#251a34', '#44315a', '#715890'],
  chitinR: ['#1a0a10', '#3e1422', '#6a2236', '#9a3a50'],
  rock: ['#120e0e', '#2a2220', '#463a34', '#67564d'],
  lava: ['#6a1606', '#c8400c', '#ff9426', '#ffe28a'],
  wrap: ['#40362a', '#7e7052', '#b6a57c', '#e2d4aa'],
  gold: ['#4e340e', '#9a6a24', '#e0aa44', '#ffe2a0'],
  sea: ['#0a2428', '#1a4c48', '#2c8076', '#6cd2c0'],
  seaD: ['#061618', '#0e3234', '#1a4c48', '#2c6e66'],
  coral: ['#4a1a22', '#8a3040', '#d0606a', '#ffa8a0'],
  shade: ['#07080c', '#0f1118', '#191c26', '#252a38'],
  robe: ['#0a0b12', '#161a28', '#262c42', '#3c4564'],
};
const PORT_GLOW = { giant: '#ff5a2a', ogre: '#ffb040', jotun: '#8fd8ff', queen: '#ff3a5a', colossus: '#ff8a2a', king: '#5ff0d8', leviathan: '#5ff0e0', herald: '#8aa4ff' };
// Titles under the name on the card (a fallback for any other boss).
const BOSS_TITLE = {
  giant: 'Kalmeküngaste isand', ogre: 'Hoidjate õgija', jotun: 'Kõndiv talv', queen: 'Pimeda pesakonna ema',
  colossus: 'Mäe raev', king: 'Liivade valitseja', leviathan: 'Sügavuste türann', herald: 'Laternate varas',
};
const BAYER2 = [0, .5, .75, .25];

function portPainter() {
  const N = PORT_N, col = new Array(N * N).fill(null), glow = new Array(N * N).fill(0);
  const put = (x, y, c) => { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < N && y < N) col[y * N + x] = c; };
  const tone = (ramp, sh, x, y) => { const v = clamp(sh, 0, .999) * ramp.length + BAYER2[(y & 1) * 2 + (x & 1)] - .5; return ramp[clamp(Math.floor(v), 0, ramp.length - 1)]; };
  const P = {
    col, glow, put,
    // A shaded ellipse (a dome lit from the upper left). o.cut(x, y) -> true skips a pixel; o.k scales the light.
    ell(cx, cy, rx, ry, ramp, o = {}) {
      const k = o.k === undefined ? 1 : o.k, b = o.b || 0;
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + .5 - cx) / rx, ny = (y + .5 - cy) / ry, r2 = nx * nx + ny * ny; if (r2 > 1 || (o.cut && o.cut(x, y))) continue;
        const nz = Math.sqrt(1 - r2), d = -.45 * nx - .55 * ny + .7 * nz; put(x, y, tone(ramp, (.12 + .88 * Math.max(0, d)) * k + b, x, y));
      }
    },
    // A filled polygon, lit top to bottom and a little from the left.
    poly(pts, ramp, o = {}) {
      let y0 = 99, y1 = -99, x0 = 99, x1 = -99; for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); }
      const k = o.k === undefined ? 1 : o.k, b = o.b || 0;
      for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        const px = x + .5, py = y + .5; let ins = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], c = pts[j]; if ((a[1] > py) !== (c[1] > py) && px < (c[0] - a[0]) * (py - a[1]) / (c[1] - a[1]) + a[0]) ins = !ins; }
        if (!ins || (o.cut && o.cut(x, y))) continue;
        const v = (py - y0) / Math.max(1, y1 - y0), u = (px - x0) / Math.max(1, x1 - x0); put(x, y, tone(ramp, (.85 - .55 * v - .25 * u) * k + b, x, y));
      }
    },
    line(x0, y0, x1, y1, c) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let i = 0; i <= n; i++) put(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), c); },
    // A glowing pixel (gets a soft halo in the finished portrait).
    eye(x, y, c, g = 1) { put(x, y, c); glow[(y | 0) * N + (x | 0)] = g; },
    clear(x, y) { if (x >= 0 && y >= 0 && x < N && y < N) col[y * N + x] = null; },
  };
  return P;
}

// The paintings. Each gets the painter P and the ramps R.
const PORT_ART = {
  giant(P, R) {
    // Shoulders of bare bone, a collar of ribs, a huge cracked skull with burning sockets.
    P.poly([[2, 32], [5, 25], [12, 23], [20, 23], [27, 25], [30, 32]], R.boneD);
    for (let i = 0; i < 4; i++) { P.line(7 + i * 5, 25, 6 + i * 5, 31, R.boneD[0]); }
    P.ell(6, 26, 4, 3, R.bone); P.ell(26, 26, 4, 3, R.bone);
    P.ell(16, 13, 10, 10.5, R.bone);
    P.poly([[9, 18], [23, 18], [21, 25], [11, 25]], R.bone, { k: .9 });
    // Sockets, nose and the crack.
    P.ell(12, 13, 2.6, 2.4, R.shade); P.ell(20, 13, 2.6, 2.4, R.shade);
    P.eye(12, 13, '#ffd27a'); P.eye(11, 13, '#ff5a2a', .7); P.eye(20, 13, '#ffd27a'); P.eye(21, 13, '#ff5a2a', .7);
    P.put(16, 17, R.shade[0]); P.put(15, 18, R.shade[0]); P.put(17, 18, R.shade[0]);
    P.line(17, 3, 18, 6, R.bone[0]); P.line(18, 6, 16, 9, R.bone[0]); P.line(16, 9, 17, 10, R.bone[0]);
    // Teeth.
    for (let x = 11; x <= 21; x++) { P.put(x, 21, x & 1 ? R.shade[1] : R.bone[3]); P.put(x, 22, x & 1 ? R.bone[2] : R.shade[1]); }
    P.line(10, 20, 22, 20, R.shade[1]);
  },
  ogre(P, R) {
    P.poly([[0, 32], [3, 24], [10, 21], [22, 21], [29, 24], [32, 32]], R.ogre, { k: .85 });
    P.poly([[1, 32], [6, 26], [26, 26], [31, 32]], R.leather); P.line(6, 27, 26, 27, R.iron[2]);
    P.ell(16, 15, 10, 10, R.ogre);
    P.ell(5.5, 13, 2.2, 3.2, R.ogre, { k: .8 }); P.ell(26.5, 13, 2.2, 3.2, R.ogre, { k: .8 });
    // A heavy brow, small mean eyes, a flat nose and a wide jaw with tusks.
    P.poly([[7, 10], [25, 10], [24, 13], [8, 13]], R.ogre, { k: .75, b: .1 });
    P.line(8, 13, 24, 13, R.ogre[0]);
    P.put(11, 14, R.shade[0]); P.put(12, 14, R.shade[0]); P.put(20, 14, R.shade[0]); P.put(21, 14, R.shade[0]);
    P.eye(12, 14, '#ffd040', .8); P.eye(20, 14, '#ffd040', .8);
    P.ell(16, 17, 2.4, 1.8, R.ogre, { b: .1 }); P.put(15, 18, R.ogre[0]); P.put(17, 18, R.ogre[0]);
    P.line(10, 21, 22, 21, R.ogre[0]);
    P.poly([[10, 21], [11, 17], [12, 21]], R.tusk); P.poly([[20, 21], [21, 17], [22, 21]], R.tusk);
    P.put(16, 22, R.iron[3]); P.put(15, 23, R.iron[2]); P.put(17, 23, R.iron[2]); P.put(16, 24, R.iron[2]);
    P.line(11, 6, 13, 8, R.ogre[0]); P.line(22, 7, 20, 9, R.ogre[0]);
  },
  jotun(P, R) {
    P.poly([[0, 32], [4, 24], [11, 21], [21, 21], [28, 24], [32, 32]], R.ice, { k: .85 });
    // A crown of ice spikes.
    for (const [x, h] of [[8, 7], [12, 10], [16, 12], [20, 10], [24, 7]]) P.poly([[x - 2, 9], [x, 9 - h * .7], [x + 2, 9]], R.frost);
    P.ell(16, 13, 8.5, 8.5, R.ice);
    P.poly([[7, 9], [25, 9], [24, 11], [8, 11]], R.frost, { k: .9 });
    P.put(12, 13, R.shade[0]); P.put(13, 13, R.shade[0]); P.put(19, 13, R.shade[0]); P.put(20, 13, R.shade[0]);
    P.eye(12, 13, '#e8f8ff'); P.eye(13, 13, '#8fd8ff', .8); P.eye(19, 13, '#8fd8ff', .8); P.eye(20, 13, '#e8f8ff');
    P.line(15, 14, 15, 16, R.ice[0]);
    // A long frost beard falling in points over the chest.
    P.poly([[8, 16], [24, 16], [25, 22], [21, 30], [18, 26], [16, 31], [14, 26], [11, 30], [7, 22]], R.frost);
    P.line(13, 18, 19, 18, R.ice[1]);
    for (const x of [10, 13, 16, 19, 22]) P.line(x, 21, x, 25, R.frost[1]);
  },
  queen(P, R) {
    // Legs reaching in from the sides, a glossy head with a cluster of eyes and dripping fangs.
    for (const s of [-1, 1]) {
      P.line(16 + s * 9, 16, 16 + s * 15, 6, R.chitin[2]); P.line(16 + s * 15, 6, 16 + s * 15, 1, R.chitin[1]);
      P.line(16 + s * 10, 19, 16 + s * 16, 14, R.chitin[2]); P.line(16 + s * 9, 22, 16 + s * 15, 28, R.chitin[1]);
    }
    P.ell(16, 28, 13, 7, R.chitin, { k: .9 });
    P.ell(16, 16, 9.5, 8.5, R.chitin);
    for (const x of [10, 13, 16, 19, 22]) P.put(x, 26 + (x & 1), R.chitinR[2]);
    // Eyes: two big, six small.
    for (const [x, y, g] of [[13, 14, 1], [19, 14, 1], [11, 12, .6], [21, 12, .6], [14, 11, .6], [18, 11, .6], [10, 15, .5], [22, 15, .5]]) { P.eye(x, y, g > .9 ? '#ffd0d8' : '#ff3a5a', g); if (g > .9) { P.eye(x + 1, y, '#ff3a5a', .8); P.eye(x, y + 1, '#c01a3a', .6); P.eye(x + 1, y + 1, '#c01a3a', .6); } }
    P.poly([[12, 20], [15, 20], [14, 26]], R.chitinR); P.poly([[17, 20], [20, 20], [18, 26]], R.chitinR);
    P.put(14, 27, '#c8ff9a'); P.put(18, 27, '#c8ff9a');
    P.line(10, 9, 22, 9, R.chitin[3]);
  },
  colossus(P, R) {
    P.poly([[0, 32], [2, 22], [9, 19], [23, 19], [30, 22], [32, 32]], R.rock);
    P.ell(16, 13, 10, 10, R.rock, { k: .95 });
    P.poly([[6, 6], [11, 3], [16, 5], [21, 2], [26, 6], [24, 9], [8, 9]], R.rock, { b: .1 });
    // Lava in the seams.
    const seam = (pts) => { for (let i = 0; i < pts.length - 1; i++) P.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], R.lava[2]); for (const p of pts) P.eye(p[0], p[1], R.lava[3], .5); };
    seam([[16, 4], [15, 7], [17, 9]]); seam([[7, 16], [9, 19], [8, 22]]); seam([[25, 15], [24, 18], [26, 21]]);
    seam([[4, 25], [8, 27], [12, 26]]); seam([[28, 24], [24, 27], [21, 30]]); seam([[14, 23], [16, 27], [15, 31]]);
    // Molten eyes and a glowing maw.
    P.ell(12, 13, 2.2, 1.8, R.lava, { k: 1.2 }); P.ell(20, 13, 2.2, 1.8, R.lava, { k: 1.2 });
    P.eye(12, 13, '#fff4c0'); P.eye(20, 13, '#fff4c0'); P.eye(11, 13, '#ffb040', .7); P.eye(21, 13, '#ffb040', .7);
    P.poly([[10, 11], [15, 12], [10, 12]], R.rock, { k: .5 }); P.poly([[22, 11], [17, 12], [22, 12]], R.rock, { k: .5 });
    P.poly([[11, 18], [21, 18], [19, 21], [13, 21]], R.lava, { k: 1.1 });
    for (let x = 12; x <= 20; x += 2) { P.put(x, 18, R.rock[1]); P.eye(x + 1, 19, R.lava[3], .7); }
  },
  king(P, R) {
    // A wrapped head under a tall crown, a broad gold collar, teal eyes in the dark between the bands.
    P.poly([[1, 32], [4, 24], [11, 21], [21, 21], [28, 24], [31, 32]], R.wrap, { k: .8 });
    P.poly([[4, 26], [28, 26], [26, 32], [6, 32]], R.gold);
    for (let x = 6; x <= 26; x += 3) P.eye(x, 28, x % 2 ? '#5ff0d8' : '#e04a32', .3);
    P.line(5, 25, 27, 25, R.gold[3]);
    P.ell(16, 15, 8, 9, R.wrap);
    for (let y = 8; y <= 23; y += 3) for (let x = 8; x <= 24; x++) { const k = (x + y * 3) % 7; if (k < 2) P.put(x, y + (k ? 0 : 1), R.wrap[1]); }
    P.clear(7, 9); P.clear(25, 9);
    P.poly([[9, 13], [23, 13], [22, 16], [10, 16]], R.shade);
    P.eye(12, 14, '#c8fff4'); P.eye(13, 14, '#5ff0d8', .8); P.eye(19, 14, '#5ff0d8', .8); P.eye(20, 14, '#c8fff4');
    // Crown.
    P.poly([[7, 9], [25, 9], [24, 4], [21, 7], [19, 1], [16, 6], [13, 1], [11, 7], [8, 4]], R.gold);
    P.line(7, 9, 25, 9, R.gold[1]); P.eye(16, 7, '#5ff0d8', .8); P.eye(11, 8, '#e04a32', .5); P.eye(21, 8, '#e04a32', .5);
    P.line(14, 20, 18, 20, R.wrap[0]);
  },
  leviathan(P, R) {
    // A sea-green giant: fins for ears, a coral crown, a beard of tentacles.
    P.poly([[0, 32], [3, 23], [10, 20], [22, 20], [29, 23], [32, 32]], R.seaD);
    for (let i = 0; i < 6; i++) P.put(6 + i * 4, 24 + (i & 1), R.sea[3]);
    P.poly([[3, 9], [8, 12], [8, 17], [2, 15]], R.sea, { k: .8 }); P.poly([[29, 9], [24, 12], [24, 17], [30, 15]], R.sea, { k: .8 });
    P.ell(16, 13, 8.5, 9, R.sea);
    P.poly([[7, 8], [25, 8], [24, 4], [22, 6], [20, 1], [18, 5], [16, 0], [14, 5], [12, 1], [10, 6], [8, 4]], R.coral);
    P.line(7, 8, 25, 8, R.gold[2]); P.eye(16, 6, '#ffe2a0', .6);
    P.put(11, 12, R.shade[0]); P.put(12, 12, R.shade[0]); P.put(20, 12, R.shade[0]); P.put(21, 12, R.shade[0]);
    P.eye(11, 12, '#b0fff4'); P.eye(12, 12, '#5ff0e0', .9); P.eye(20, 12, '#5ff0e0', .9); P.eye(21, 12, '#b0fff4');
    P.line(10, 10, 13, 11, R.seaD[1]); P.line(22, 10, 19, 11, R.seaD[1]);
    P.put(15, 15, R.seaD[0]); P.put(17, 15, R.seaD[0]);
    for (let i = 0; i < 6; i++) { const x = 10 + i * 2.4, len = 6 + (i % 3) * 3; for (let k = 0; k < len; k++) P.put(Math.round(x + Math.sin(k * .7 + i) * 1.2), 18 + k, k < 2 ? R.sea[1] : R.seaD[2 - (k & 1)]); }
  },
  herald(P, R) {
    // A tall pointed hood over a ragged mantle; no face, just the dark and two cold pinpoints. Its cage lantern,
    // full of stolen warm light, hangs on a chain at the lower left.
    P.poly([[0, 32], [2, 25], [8, 21], [24, 21], [30, 25], [32, 32]], R.robe, { k: .9 });
    for (let x = 3; x <= 29; x += 3) P.line(x, 23 + (x % 2), x + 1, 26 + (x % 3), R.robe[0]);
    P.poly([[16, 0], [21, 6], [25, 15], [26, 23], [6, 23], [7, 15], [11, 6]], R.robe);
    P.line(16, 0, 11, 6, R.robe[3]); P.line(11, 6, 7, 15, R.robe[2]);
    P.ell(16, 15.5, 6.2, 7.5, R.shade, { k: .25 });
    P.ell(16, 16, 4.6, 6, [R.shade[0]], {});
    for (let a = 0; a < 20; a++) { const t = a / 20 * TAU; P.put(Math.round(16 + Math.cos(t) * 6.6), Math.round(15.5 + Math.sin(t) * 7.9), t > PI * .9 && t < PI * 1.6 ? '#56607e' : R.robe[1]); }
    P.eye(13, 14, '#e8f0ff'); P.eye(19, 14, '#e8f0ff'); P.eye(13, 15, '#7f9cff', .5); P.eye(19, 15, '#7f9cff', .5);
    // The lantern: a chain from the top edge, the cage, the warm core.
    for (let y = 16; y < 24; y++) P.put(4, y, y & 1 ? R.iron[2] : R.iron[1]);
    P.poly([[2, 24], [7, 24], [6, 26], [3, 26]], R.iron); P.poly([[2, 30], [7, 30], [6, 31], [3, 31]], R.iron);
    for (let y = 26; y < 30; y++) { P.put(2, y, R.iron[1]); P.put(7, y, R.iron[1]); P.put(3, y, '#ff9a3c'); P.put(5, y, '#ffcf70'); P.put(6, y, '#ff9a3c'); P.put(4, y, R.iron[0]); }
    P.eye(5, 27, '#fff0b8', .9); P.eye(5, 28, '#ffcf70', .7);
  },
};
// A shape for any boss without a painting: horns and a shadowed head, with its own eye colour.
function portSilhouette(P, R, kind) {
  const d = MON[kind] || {}, e = d.eye || [2, 1, .4], m = Math.max(e[0], e[1], e[2], 1e-3);
  const ec = '#' + [0, 1, 2].map(k => Math.round(clamp(e[k] / m, 0, 1) * 255).toString(16).padStart(2, '0')).join('');
  P.poly([[0, 32], [4, 23], [11, 20], [21, 20], [28, 23], [32, 32]], R.shade, { b: .2 });
  P.poly([[6, 10], [3, 2], [10, 8]], R.shade, { b: .3 }); P.poly([[26, 10], [29, 2], [22, 8]], R.shade, { b: .3 });
  P.ell(16, 13, 8.5, 9, R.shade, { b: .25 });
  P.eye(12, 13, '#ffffff', .6); P.eye(13, 13, ec); P.eye(19, 13, ec); P.eye(20, 13, '#ffffff', .6);
}

const _bossPort = new Map();
function bossPortrait(kind, size) {
  size = Math.max(PORT_N, Math.round(size || 64));
  const key = kind + ':' + size, hit = _bossPort.get(key); if (hit) return hit;
  const N = PORT_N, P = portPainter();
  if (PORT_ART[kind]) PORT_ART[kind](P, PORT_RAMP); else portSilhouette(P, PORT_RAMP, kind);
  // The base: backdrop, outline, figure, eye halos.
  const base = document.createElement('canvas'); base.width = base.height = N;
  const c = base.getContext('2d'), gc = PORT_GLOW[kind] || '#e8b04a', g = _hx(parseInt(gc.slice(1), 16));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x + .5 - N / 2, y + .5 - N * .42) / (N * .62), k = clamp(1 - d, 0, 1), v = k * k * .55 + BAYER2[(y & 1) * 2 + (x & 1)] * .12;
    const q = Math.floor(v * 4.6) / 4;
    c.fillStyle = 'rgb(' + Math.round(10 + g[0] * 90 * q) + ',' + Math.round(11 + g[1] * 70 * q) + ',' + Math.round(18 + g[2] * 80 * q) + ')'; c.fillRect(x, y, 1, 1);
  }
  const at = (x, y) => x >= 0 && y >= 0 && x < N && y < N ? P.col[y * N + x] : null;
  c.fillStyle = '#05060a';
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!at(x, y) && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1))) c.fillRect(x, y, 1, 1);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const v = at(x, y); if (v) { c.fillStyle = v; c.fillRect(x, y, 1, 1); } }
  // Rim light on the right edge of the figure, in the backdrop's colour.
  c.fillStyle = gc; c.globalAlpha = .45;
  for (let y = 0; y < N; y++) for (let x = 1; x < N; x++) if (at(x, y) && !at(x + 1, y) && x > N * .45) c.fillRect(x, y, 1, 1);
  c.globalAlpha = 1;
  const out = document.createElement('canvas'); out.width = out.height = size;
  const o = out.getContext('2d'), k = size / N; o.imageSmoothingEnabled = false; o.drawImage(base, 0, 0, size, size);
  // Eye halos at the output size (soft, additive), so the eyes burn.
  o.globalCompositeOperation = 'lighter';
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const gl = P.glow[y * N + x]; if (!gl) continue;
    const cx = (x + .5) * k, cy = (y + .5) * k, r = k * 2.6 * gl, gr = o.createRadialGradient(cx, cy, 0, cx, cy, r), cc = P.col[y * N + x] || '#ffffff';
    gr.addColorStop(0, cc); gr.addColorStop(1, 'rgba(0,0,0,0)'); o.globalAlpha = .55 * gl; o.fillStyle = gr; o.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  o.globalAlpha = 1; o.globalCompositeOperation = 'source-over';
  _bossPort.set(key, out);
  if (_bossPort.size > 40) _bossPort.delete(_bossPort.keys().next().value);
  return out;
}

const BOSSCARD = {
  cur: null, DUR: 2.6,
  show(kind, name, title) {
    if (!MON[kind]) return;
    this.cur = { kind, name: name || MON[kind].name, title: title || BOSS_TITLE[kind] || 'Õõnsuse käskjalg', t: 0 };
  },
  on() { return !!this.cur; },
  // Drawn by UI.draw on the HUD canvas: s = the HUD scale, (x0, y0) the top-left corner below the top plates, Wr the
  // right edge of the safe area.
  draw(c, s, x0, y0, Wr, Hb) {
    const C = this.cur; if (!C) return;
    C.t += R.frameDt || .016; if (C.t >= this.DUR || G.phase !== 'play') { this.cur = null; return; }
    const t = C.t, avail = Wr - x0 - 4 * s;
    // Layout at the largest scale that fits: portrait, then the text column.
    let ps = s, L, pw, tw, w, h, nameS;
    for (; ps >= 2; ps--) {
      nameS = ps + 1; pw = 34 * ps; L = PX.LINE * ps;
      tw = Math.max(PX.measure('PEALIK') * ps + 10 * ps, PX.measure(C.name) * nameS, PX.measure(C.title) * ps);
      w = pw + tw + 14 * ps; h = pw + 6 * ps;
      if (w <= avail) break;
    }
    if (ps < 2) { ps = 2; nameS = 2; }
    const ein = sat(t / .28), eout = sat((this.DUR - t) / .4), slide = (1 - ein * ein * (3 - 2 * ein)) * (w + 8 * s) + (1 - eout) * 14 * s;
    // Under an Eclipse the black sun hangs in the sky at the top left (20-post.js), so the card comes in from the
    // right instead and leaves the disc clear.
    const right = (G.eclA || 0) > .05;
    const x = right ? Math.round(Wr - 2 * s - w + slide) : Math.round(x0 + 2 * s - slide), y = Math.round(y0 + 4 * s), a = Math.min(1, ein * 1.4) * eout;
    c.save(); c.globalAlpha = a;
    // A dark strip with an ember edge, the portrait in a gold frame on its left.
    UI.plate(x, y, w, h, { bd: UI.COLR.ember, bg: 'rgba(12,8,10,0.9)', hi: 'rgba(255,138,60,0.22)' });
    const px = x + 3 * ps, py = y + 3 * ps;
    c.fillStyle = '#e8b04a'; c.fillRect(px - ps, py - ps, pw + 2 * ps, pw + 2 * ps); c.fillStyle = '#5a3c14'; c.fillRect(px, py, pw, pw);
    c.imageSmoothingEnabled = false;
    // The portrait pushes in a touch while the card is up.
    const zp = 1 + .06 * sat(t / this.DUR), img = bossPortrait(C.kind, 64), sw = 64 / zp, so = (64 - sw) / 2;
    c.drawImage(img, so, so * .6, sw, sw, px, py, pw, pw);
    // Under an Eclipse the portrait goes cold and dark, with the black sun and its corona in the corner.
    const ea = G.eclA || 0;
    if (ea > .05) {
      c.globalAlpha = a * .45 * ea; c.fillStyle = '#0a1430'; c.fillRect(px, py, pw, pw); c.globalAlpha = a;
      const er = 4 * ps, ex = px + pw - er - 2 * ps, ey = py + er + 2 * ps;
      c.fillStyle = 'rgba(190,210,255,' + (.35 * ea).toFixed(3) + ')'; c.beginPath(); c.arc(ex, ey, er + 1.6 * ps, 0, TAU); c.fill();
      c.fillStyle = '#f4e6c8'; c.beginPath(); c.arc(ex, ey, er + .6 * ps, 0, TAU); c.fill();
      c.fillStyle = '#050508'; c.beginPath(); c.arc(ex, ey, er, 0, TAU); c.fill();
    }
    // A flash across the portrait as it lands.
    if (t < .5) { c.globalAlpha = a * (1 - t / .5) * .6 * (FX.flashK || 1); c.fillStyle = '#ffd9a8'; c.fillRect(px, py, pw, pw); c.globalAlpha = a; }
    const tx = px + pw + 6 * ps;
    let ty = y + Math.round((h - (L + 2 * ps + PX.LINE * nameS + ps + L)) / 2);
    PX.icon(c, 'skull', tx, ty, ps, 1); PX.text(c, 'PEALIK', tx + 12 * ps, ty, ps, UI.COLR.ember);
    ty += L + 2 * ps; PX.text(c, C.name, tx, ty, nameS, '#ffd9a8');
    ty += PX.LINE * nameS + ps; PX.text(c, C.title, tx, ty, ps, UI.COLR.dim);
    c.restore();
  },
};
