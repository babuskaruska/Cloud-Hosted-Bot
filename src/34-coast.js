// ---- Stormreach props: wreckage, driftwood, kelp, barnacled rocks, tide pools, wind-bent trees and grass -----------
// The wind blows toward +x (and a little +z), the same way as the rain, so trees and grass all lean that way.
const COAST = {
  wood: C(0x6a5c4a), woodL: C(0x8e826c), drift: C(0x9a948a), driftD: C(0x6c665e), kelp: C(0x3c3a1c), kelpL: C(0x5a5226),
  barn: C(0xb4b0a2), mussel: C(0x1a202c), weed: C(0x2e4a2a), rust: C(0x6a4a34), canvas: C(0xb0a68e), canvasD: C(0x7a7260), star: C(0xc0582c),
};
const WIND_DIR = [.89, .45];

Object.assign(PROP, {
  // Coastal grass: long blades combed over by the wind.
  seagrass(S, rng) {
    const c = mulC(mixC(COL.tuftA, COL.tuftB, rng() * .75), .8 + .45 * rng()), n = rng.int(4, 7);
    for (let k = 0; k < n; k++) {
      const a = rng() * TAU, l = rng.range(.3, .66), bx = Math.cos(a) * .07, bz = Math.sin(a) * .07, lean = rng.range(.45, .85), w = .03;
      const tx = bx + (WIND_DIR[0] * lean + rng.range(-.15, .15)) * l, tz = bz + (WIND_DIR[1] * lean + rng.range(-.15, .15)) * l, ty = l * (1 - lean * .55);
      const px = -Math.sin(a) * w, pz = Math.cos(a) * w, mx = (bx + tx) / 2 + WIND_DIR[0] * .02, mz = (bz + tz) / 2, my = ty * .62;
      const A = [bx - px, 0, bz - pz], Bp = [bx + px, 0, bz + pz], M1 = [mx - px * .6, my, mz - pz * .6], M2 = [mx + px * .6, my, mz + pz * .6], T = [tx, ty, tz];
      for (const [p, sw] of [[A, 0], [Bp, 0], [M2, .35], [A, 0], [M2, .35], [M1, .35], [M1, .35], [M2, .35], [T, .9]]) S.v(p[0], p[1], p[2], 0, 1, 0, c[0], c[1], c[2], 0, 0, L_PLAIN, .8, sw, 0);
    }
  },
  // A cypress shaped by the gales: a crooked trunk leaning downwind, every branch streaming the same way, the
  // foliage in flat, wind-shorn shelves; a few bare snags on the windward side.
  windbent(S, rng, h) {
    const bark = mulC(COL.bark, .85 + .3 * rng()), W = WIND_DIR, lean = rng.range(.35, .6);
    let p = [0, -.1, 0], r = h * .07; const tips = [];
    for (let k = 0; k < 5; k++) {
      const u = k / 4, d = [W[0] * lean * (.4 + u) + rng.range(-.15, .15), 1 - u * .35, W[1] * lean * (.4 + u) + rng.range(-.15, .15)], l = Math.hypot(d[0], d[1], d[2]), len = h * .2;
      const q = [p[0] + d[0] / l * len, p[1] + d[1] / l * len, p[2] + d[2] / l * len]; S.seg(p, q, r, r * .8, bark, { l: L_WOOD, n: 6 }); p = q; r *= .8;
      if (k >= 2) {
        const bl = h * rng.range(.25, .42), bq = [p[0] + W[0] * bl, p[1] + bl * rng.range(.05, .3), p[2] + W[1] * bl + rng.range(-.4, .4) * bl];
        S.seg(p, bq, r * .7, r * .35, bark, { l: L_WOOD, n: 5, sway: .1 }); tips.push(bq);
      }
      if (k === 2 || k === 3) { const sl = h * rng.range(.12, .2); S.seg(p, [p[0] - W[0] * sl, p[1] + sl * .5, p[2] - W[1] * sl + rng.range(-.1, .1)], r * .4, r * .12, mulC(bark, 1.2), { l: L_WOOD, n: 4 }); }
    }
    tips.push(p);
    for (const t of tips) for (let j = 0; j < 3; j++) {
      const rb = h * rng.range(.13, .2), c = mulC(mixC(COL.leaf, COL.leafL, rng() * .8), .75 + .4 * rng());
      const cx = t[0] - W[0] * rb * (j - .6) * .9, cy = t[1] + rng.range(-.05, .12) + (j === 1 ? .08 : 0), cz = t[2] - W[1] * rb * (j - .6) * .9 + rng.range(-.15, .15);
      S.ico(rb, cx, cy, cz, c, { sc: [1.7, .42, 1.15], d: 1, l: L_THATCH, sway: .14, r: [0, -Math.atan2(W[1], W[0]) + rng.range(-.3, .3), rng.range(-.08, .08)], cf: v => .62 + .38 * sat(v.y / (rb * .4) + .5) });
    }
    for (let k = 0; k < 3; k++) { const a = k * 2.1 + rng(); S.seg([Math.cos(a) * h * .04, h * .08, Math.sin(a) * h * .04], [Math.cos(a) * h * .18, -.1, Math.sin(a) * h * .18], h * .028, h * .015, bark, { l: L_WOOD, n: 5 }); }
  },
  // A bleached, sea-smoothed log with snapped branches and a root ball at one end.
  driftwood(S, rng) {
    const len = rng.range(1.3, 2.5), r = rng.range(.1, .17), c = mulC(mixC(COAST.drift, COAST.driftD, rng() * .6), .85 + .3 * rng()), bend = rng.range(-.2, .2);
    S.seg([-len / 2, r * .75, 0], [0, r * .85, bend], r, r * .9, c, { l: L_WOOD, n: 6, rough: .7 }); S.seg([0, r * .85, bend], [len / 2, r * .7, 0], r * .9, r * .6, c, { l: L_WOOD, n: 6, rough: .7 });
    for (let k = 0; k < 2; k++) { const x = rng.range(-len * .2, len * .35), a = rng.range(-1.2, 1.2); S.seg([x, r, 0], [x + rng.range(-.1, .2), r + .3 * Math.cos(a), .3 * Math.sin(a)], r * .35, r * .15, c, { l: L_WOOD, n: 4 }); }
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + rng() * .5, l = rng.range(.3, .55); S.seg([-len / 2, r * .8, 0], [-len / 2 - .12 - rng() * .15, r * .8 + Math.sin(a) * l, Math.cos(a) * l], r * .4, r * .1, mulC(c, .92), { l: L_WOOD, n: 4 }); }
  },
  // A pile of kelp thrown up by the sea: wavy ribbons lying on the ground and a few bladders.
  kelp(S, rng, n = 5) {
    for (let k = 0; k < n; k++) {
      const c = mulC(mixC(COAST.kelp, COAST.kelpL, rng()), .8 + .4 * rng()), a0 = rng() * TAU, w = rng.range(.05, .1), segs = rng.int(4, 7);
      let x = rng.range(-.3, .3), z = rng.range(-.3, .3), a = a0, y = .025 + rng() * .02;
      for (let i = 0; i < segs; i++) {
        const l = rng.range(.14, .24), a2 = a + rng.range(-.7, .7), x2 = x + Math.cos(a2) * l, z2 = z + Math.sin(a2) * l, y2 = .02 + rng() * .07;
        const px = -Math.sin(a) * w, pz = Math.cos(a) * w, qx = -Math.sin(a2) * w * 1.15, qz = Math.cos(a2) * w * 1.15;
        ribbon(S, [x - px, y, z - pz], [x + px, y, z + pz], [x2 + qx, y2, z2 + qz], [x2 - qx, y2, z2 - qz], c, [0, 0, 0, 0]);
        if (rng() < .2) S.ico(.035, x2, y2 + .02, z2, mulC(COAST.kelpL, 1.2), { d: 0, rough: .3 });
        x = x2; z = z2; a = a2; y = y2;
      }
    }
  },
  // A wet black rock crusted with barnacles and mussels, with a skirt of green weed at its foot.
  barnRock(S, rng, r) {
    S.rock(r, 0, r * .3, 0, mulC(mixC(COL.stoneD, COL.stone, rng() * .6), .85), { sq: .7 });
    S.ico(r * 1.05, 0, .02, 0, mulC(COAST.weed, .9 + .3 * rng()), { sc: [1, .12, 1], d: 1, rough: .5 });
    const nb = Math.round(10 + r * 26);
    for (let k = 0; k < nb; k++) {
      const a = rng() * TAU, y = rng.range(.05, .55) * r, rr = Math.sqrt(Math.max(0, 1 - Math.pow((y - r * .3) / (r * .7), 2))) * r * .86 + .02, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (rng() < .7) S.cone(rng.range(.025, .045) * (.7 + r), rng.range(.03, .06), x, y, z, mulC(COAST.barn, .75 + .4 * rng()), { n: 5, r: [Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1], rough: .8 });
      else S.ico(rng.range(.035, .06), x, y, z, COAST.mussel, { sc: [1, .55, 1.6], d: 0, rough: .28, r: [0, a, .6] });
    }
  },
  // Starfish and shells for the tide-pool edges.
  starfish(S, rng) {
    for (let k = 0, n = rng.int(1, 3); k < n; k++) {
      const x = rng.range(-.3, .3), z = rng.range(-.3, .3), rot = rng() * TAU, s = rng.range(.07, .12), c = mulC(COAST.star, .8 + .4 * rng());
      for (let i = 0; i < 5; i++) { const a = rot + i / 5 * TAU; S.box(s * 1.1, .02, s * .32, x + Math.cos(a) * s * .5, .012, z + Math.sin(a) * s * .5, c, { r: [0, -a, 0], jit: .05, rough: .6 }); }
    }
    for (let k = 0, n = rng.int(2, 5); k < n; k++) S.ico(rng.range(.025, .045), rng.range(-.4, .4), .015, rng.range(-.4, .4), mulC(COAST.barn, .9 + .3 * rng()), { sc: [1, .45, 1.3], d: 0, r: [0, rng() * TAU, 0] });
  },
  // A ship's anchor, rusted, its crown driven into the ground (also the Drowned King's weapon, see KIT.item.anchor).
  anchor(S, rng, s = 1) {
    const c = mulC(mixC(COL.ironL, COAST.rust, .55), .9 + .2 * rng()), o = { l: L_METAL, rough: .7 };
    S.box(.16 * s, 2.2 * s, .16 * s, 0, 1.1 * s, 0, c, o);
    S.add(gTorus(10, .2, 4), { s: .22 * s, p: [0, 2.35 * s, 0], r: [0, HPI, 0], c, l: L_METAL, rough: .7 });
    S.box(1.3 * s, .12 * s, .12 * s, 0, 1.95 * s, 0, mulC(c, .85), { l: L_WOOD });
    for (const sg of [-1, 1]) {
      S.seg([0, .12 * s, 0], [sg * .45 * s, .2 * s, 0], .08 * s, .07 * s, c, { l: L_METAL, n: 5 }); S.seg([sg * .45 * s, .2 * s, 0], [sg * .72 * s, .55 * s, 0], .07 * s, .05 * s, c, { l: L_METAL, n: 5 });
      S.add(gOct(), { s: [.2 * s, .26 * s, .05 * s], p: [sg * .7 * s, .52 * s, 0], r: [0, 0, sg * -.6], c: mulC(c, 1.1), l: L_METAL, rough: .7 });
    }
  },
  // The bones of a wrecked ship: a keel half sunk in the ground, curved frames standing up like ribs (some
  // snapped), a run of planking left on one side, the stern post, and weed and barnacles on the lower timbers.
  wreck(S, rng) {
    const L = 6.4, wd = COAST.wood, wl = COAST.woodL, o = () => ({ l: L_WOOD, rough: .6 });
    S.box(L, .3, .32, 0, .05, 0, mulC(wd, .8), o());
    const NF = 9, frames = [];
    for (let i = 0; i < NF; i++) {
      const x = -L / 2 + .45 + i * (L - .9) / (NF - 1), u = i / (NF - 1), beam = 1.35 * Math.sin(.25 + u * 2.6), ht = 1.35 + .5 * Math.sin(u * PI);
      frames.push([x, beam, ht]);
      for (const sd of [-1, 1]) {
        const broken = rng() < .3, n = broken ? rng.int(2, 3) : 5, pts = [];
        for (let k = 0; k <= 5; k++) { const t = k / 5, a = t * HPI; pts.push([x + rng.range(-.03, .03), .1 + Math.sin(a) * ht * .25 + (1 - Math.cos(a)) * ht * .75, sd * Math.sin(a) * beam]); }
        for (let k = 0; k < n; k++) S.seg(pts[k], pts[k + 1], .085, .075, mulC(mixC(wd, wl, rng() * .4), .85 + .3 * rng()), { l: L_WOOD, n: 5, rough: .6 });
      }
    }
    // planking on the +z side, low down and gappy
    for (let row = 0; row < 3; row++) {
      const t = (row + .6) / 5, a = t * HPI;
      for (let i = 0; i < NF - 1; i++) {
        if (rng() < .3 + row * .15) continue;
        const f0 = frames[i], f1 = frames[i + 1], y0 = .1 + Math.sin(a) * f0[2] * .25 + (1 - Math.cos(a)) * f0[2] * .75, z0 = Math.sin(a) * f0[1] + .06, y1 = .1 + Math.sin(a) * f1[2] * .25 + (1 - Math.cos(a)) * f1[2] * .75, z1 = Math.sin(a) * f1[1] + .06;
        S.seg([f0[0], y0, z0], [f1[0], y1, z1], .1, .1, mulC(mixC(wd, wl, .3 + rng() * .4), .8 + .3 * rng()), { l: L_WOOD, n: 4, rough: .6 });
      }
    }
    S.seg([L / 2 - .2, .05, 0], [L / 2 + .45, 2.7, 0], .14, .1, mulC(wd, .9), { l: L_WOOD, n: 6 }); S.box(.12, .12, 1.5, L / 2 + .2, 1.6, 0, mulC(wd, .85), { l: L_WOOD, r: [.15, 0, 0] });
    S.seg([-L / 2 + .2, .05, 0], [-L / 2 - .5, 1.3, 0], .13, .1, mulC(wd, .9), { l: L_WOOD, n: 6 }); S.seg([-L / 2 - .5, 1.3, 0], [-L / 2 - .75, 2.1, 0], .1, .06, mulC(wd, .9), { l: L_WOOD, n: 6 });
    for (const x of [-1.2, .9]) S.box(.14, .14, 2.5, x, 1.45, .05, mulC(wd, .8), { l: L_WOOD, r: [rng.range(-.1, .1), rng.range(-.15, .15), rng.range(-.2, .2)] });
    for (let k = 0; k < 26; k++) { const x = rng.range(-L / 2, L / 2), sd = rng.sign(); S.cone(.04, .05, x, rng.range(.15, .5), sd * rng.range(.35, 1.0), mulC(COAST.barn, .8 + .3 * rng()), { n: 5, rough: .8, r: [sd * -1.2, 0, 0] }); }
    S.ico(L * .55, 0, -.05, 0, mulC(COL.earthD, .9), { sc: [1, .07, .38], d: 1 });
  },
  // A ship's mast. Standing: driven into the ground at a tilt, its yard still up and a torn sail cracking in the wind,
  // stays running down to the ground. Fallen: lying across the ground, snapped, the sail spread out beside it.
  mast(S, rng, fallen) {
    const c = mulC(COAST.wood, 1.1), h = rng.range(4.2, 5.2), sail = mixC(COAST.canvas, COAST.canvasD, rng() * .5);
    if (!fallen) {
      const T = new Soup();
      T.seg([0, -.2, 0], [0, h, 0], .13, .09, c, { l: L_WOOD, n: 6 }); T.cyl(.3, .22, 0, h * .86, 0, mulC(c, .8), { n: 7, l: L_WOOD, open: true });
      for (let k = -2; k <= 2; k++) T.seg([0, h * .86 + .1, 0], [k * .06, h * .86 - .15, .3], .015, .015, COL.rope, { n: 3 });
      T.seg([-1.4, h * .72, .05], [1.5, h * .7, .05], .065, .05, c, { l: L_WOOD, n: 5 });
      clothPanel(T, { x0: -1.3, x1: 1.35, yTop: h * .7 - .05, len: h * .5, z: .12, col: sail, rng, sway: 1.1, nx: 6, ny: 7, rag: .65 });
      T.seg([0, h * .95, 0], [2.2, 0, -.6], .012, .012, COL.rope, { n: 3 }); T.seg([0, h * .95, 0], [-2.0, 0, .9], .012, .012, COL.rope, { n: 3 });
      T.seg([-1.4, h * .72, .05], [-1.9, 0, 1.2], .01, .01, COL.rope, { n: 3, sway: .3 });
      S.merge(T, { r: [rng.range(-.12, .12), 0, rng.range(.08, .16)] });
      for (const [x, z] of [[2.2, -.6], [-2.0, .9]]) S.box(.08, .3, .08, x, .1, z, c, { l: L_WOOD, r: [.2, 0, .2] });
    } else {
      S.seg([-h / 2, .14, 0], [h / 2, .2, 0], .13, .1, c, { l: L_WOOD, n: 6 });
      for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; S.seg([-h / 2, .14, 0], [-h / 2 - .2, .14 + Math.sin(a) * .14, Math.cos(a) * .14], .05, .01, c, { l: L_WOOD, n: 3 }); }
      S.seg([.6, .1, -1.4], [.9, .16, 1.5], .06, .05, c, { l: L_WOOD, n: 5 });
      for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { if (rng() < .3) continue; const x = .7 + i * .35 + rng.range(-.05, .05), z = -1.2 + j * .6; S.box(.36, .015, .62, x, .03 + rng() * .05, z, mulC(sail, .7 + .35 * rng()), { l: L_CLOTH, r: [rng.range(-.15, .15), rng.range(-.3, .3), rng.range(-.15, .15)] }); }
      PROP.barrel(S, -1.4, 0, .7, .9, rng);
    }
  },
});

// Lies a barrel on its side (washed up).
function coastBarrel(rng) { const T = new Soup(), S = new Soup(); PROP.barrel(T, 0, 0, 0, .95, rng); S.merge(T, { p: [0, .25, -.25], r: [HPI, 0, rng.range(-.3, .3)] }); return S; }

// The wreck and the masts go down before the common props (scatterProps), while there is room.
BIOME_DRESS.stormFirst = function (X) {
  const { rng, drop } = X;
  drop(T => PROP.wreck(T, rng), 3.5, { far: 2.6 }) || drop(T => PROP.wreck(T, rng), 3.3, { far: 1.6 });
  drop(T => PROP.mast(T, rng, true), 2.1, { far: 1.2 }) || drop(T => PROP.mast(T, rng, true), 1.8, { far: .9 });
  drop(T => PROP.mast(T, rng, false), 1.7, { far: 1.6 });
};
BIOME_DRESS.storm = function (X) {
  const { B, rng, drop } = X;
  drop(T => PROP.anchor(T, rng, 1), .8, { far: 1.4, r: [rng.range(-.35, .35), rng() * TAU, rng.range(.25, .5)], dy: -.35 });
  for (let k = 0; k < 9; k++) drop(T => PROP.driftwood(T, rng), 1.0, { far: 1.0 });
  for (let k = 0; k < 4; k++) { const S = coastBarrel(rng); drop(T => T.merge(S), .5, { far: 1.2 }); }
  for (let k = 0; k < 16; k++) drop(T => PROP.kelp(T, rng, rng.int(3, 6)), .5, { roadMin: .3, ao: null });
  for (let k = 0; k < 12; k++) { const r = rng.range(.35, .8); drop(T => PROP.barnRock(T, rng, r), r * .9, { steep: true, roadMin: .3 }); }
  for (const q of B.ponds) {
    for (let k = 0; k < 4; k++) { const a = rng() * TAU, d = q.r + rng.range(.3, .9), r = rng.range(.3, .6); X.at(q.x + Math.cos(a) * d, q.z + Math.sin(a) * d, T => PROP.barnRock(T, rng, r), r); }
    for (let k = 0; k < 4; k++) { const a = rng() * TAU, d = q.r + rng.range(.2, 1.1); X.at(q.x + Math.cos(a) * d, q.z + Math.sin(a) * d, T => PROP.kelp(T, rng, rng.int(2, 4)), 0); }
    for (let k = 0; k < 3; k++) { const a = rng() * TAU, d = q.r + rng.range(.1, .7); X.at(q.x + Math.cos(a) * d, q.z + Math.sin(a) * d, T => PROP.starfish(T, rng), 0); }
  }
  // Kelp and weed washed along the tidal channel's banks.
  for (let k = 0; k < 26; k++) {
    const u = rng.int(2, B.SP.length - 2), a = B.SP[u - 1], b = B.SP[u + 1], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, off = rng.sign() * rng.range(1.1, 1.9), x = B.SP[u][0] - dz / l * off, z = B.SP[u][1] + dx / l * off;
    if (Math.abs(x) > BH - .8 || Math.abs(z) > BH - .8 || B.dRoadAt(x, z) < ROAD_HALF + .7) continue;
    X.at(x, z, T => k % 3 ? PROP.kelp(T, rng, rng.int(2, 4)) : PROP.barnRock(T, rng, rng.range(.25, .45)), 0);
  }
  // A faint blue-green glow of sea sparks in one tide pool.
  if (B.ponds[0]) B.env.push({ x: B.ponds[0].x, y: B.ponds[0].y + .8, z: B.ponds[0].z, c: 0x3cd8c8, I: 6, d: 6.5, flick: 1 });
};
