// ---- Act II night lands (round 14) ---------------------------------------------------------------------------------
// In Act II (act2Land(): campaign levels 6-11, BIOME.start = -6) every hand-made land comes back as its own night
// version: nightBiome(b) is a copy of the BIOMES entry (same key, name, monsters and boss) with a colder, deeper grade,
// stronger moonlight, blue fog, more lantern glow and its own sky and weather. Looks only: nothing here reads or moves
// the gameplay random stream (the extra props use the board's own scenery stream, after everything else is placed).
//
// Fields a night land adds (read by 29-biome lookOf, 20-post and 32-props):
// - night: true, act: 2 (Echo's music reads these too), nightOf: the day land's key.
// - moonDisc: [r, g, b, size, strength]: a moon in the sky (linear colour; size in sky-disc units, 1 = the eclipse's).
// - lantern: tower and land light multiplier; halo: the lantern haze gain (High and Mid; none on Ultra or Low).
// - nightProps: { ghost: [r, g, b] flame tint of the ghost lanterns, n: how many, banners: tattered banners, wisps }.
// URL flag for tests: night=1 shows the night version of any hand-made land outside a campaign.
const NIGHT = { cache: new Map() };
const nightOn = () => (typeof act2Land === 'function' && act2Land()) || HASH.night === '1';

// Each land's night: light colours as BIOMES (sRGB hex), the rest linear. cold: how far the ground palette goes blue.
const NIGHT_LAND = {
  // Tuhakuru: a clear moonlit pass. A big pale moon, every star out, ghost lanterns and the old army's banners.
  ashen: { cold: .55, hemi: [0x5a74c8, 0x0e1220, 1.12], moon: [0xb8d0ff, 1.8], fill: [0x3a4c9a, .3], clear: [.0018, .0028, .009], mistAmb: [.03, .055, .13], mist: [-.25, .5, .95, .12],
    sky: [.008, .016, .045], lift: [.006, .011, .03], sat: .86, expo: 1.02, sprAmb: [.04, .055, .11], grade: [.9, .97, 1.18, 1.08, 1, .9, .15], stars: 1.25, aurora: 0,
    moonDisc: [.3, .34, .44, .8, 1], lantern: 1.35, halo: 1.5, beacon: 1.2, moonPos: [-14, 46, -30],
    wxB: { n: .06, col: [.55, .8, 1.6, 0], al: [.9, 1.1, 0], size: [.04, .07], vel: [.06, .05, .04], sway: [1.1, .4], y: [.4, 3.6] },
    props: { ghost: [.45, .8, 1.7], n: 5, banners: 5, wisps: 2 } },
  // Külmakosk: the aurora night. A wide green and violet curtain, hard frost light, sparse snow that glitters.
  frost: { cold: .4, hemi: [0x6a9ae0, 0x1a2436, 1.08], moon: [0xc8e4ff, 1.6], fill: [0x4a6ac0, .3], clear: [.002, .006, .012], mistAmb: [.05, .1, .17], mist: [-.3, .55, .8, .13],
    sky: [.01, .035, .05], lift: [.008, .016, .032], sat: .88, expo: .9, sprAmb: [.08, .11, .17], grade: [.9, 1, 1.16, 1.04, 1.02, .96, .13], stars: 1.1, aurora: .8,
    moonDisc: [.34, .38, .46, .55, .8], lantern: 1.3, halo: 1.35, beacon: 1,
    wxA: { n: .3, size: [.04, .08], al: [.85, 2.5, .1] },
    props: { ghost: [.5, 1.1, 1.6], n: 3, banners: 3, wisps: 1 } },
  // Udusoo: the drowned lights. Thick blue-green fog, will-o'-wisps over the water, ghost lanterns on poles.
  fen: { cold: .65, hemi: [0x3a7a98, 0x0a1416, 1.02], moon: [0x9adcd8, 1.4], fill: [0x2a5a80, .32], clear: [.0015, .005, .006], mistAmb: [.03, .1, .15], mist: [.05, .8, 1.4, .2],
    sky: [.008, .03, .034], lift: [.004, .016, .02], sat: .9, expo: 1.04, sprAmb: [.03, .07, .08], grade: [.9, 1.02, 1.1, 1.04, 1.04, .92, .14], stars: .5, aurora: 0,
    moonDisc: [.32, .46, .44, .7, .7], lantern: 1.4, halo: 1.7, beacon: 1.15,
    wxA: { n: .09, col: [.6, 1.9, 1.3, 0], al: [1, 1.5, 0] },
    props: { ghost: [.4, 1.5, 1.1], n: 5, banners: 2, wisps: 3 } },
  // Tulearm: a red moon over the ash. Cold blue shadows against the lava, ash falling thick.
  ember: { cold: .45, hemi: [0x4c5a90, 0x2a0c08, 1.15], moon: [0xff8a6a, 1.5], fill: [0xd03a18, .26], clear: [.007, .002, .005], mistAmb: [.06, .035, .07], mist: [-.3, .5, 1, .11],
    sky: [.03, .006, .01], lift: [.012, .008, .02], sat: .95, expo: 1.03, sprAmb: [.07, .045, .07], grade: [.92, .96, 1.14, 1.12, .98, .84, .17], stars: .35, aurora: 0,
    moonDisc: [.75, .14, .06, .95, 1], lantern: 1.25, halo: 1.4, beacon: 1.1, moonPos: [20, 34, -30],
    wxA: { n: .42, al: [.95, 0, 0] },
    props: { ghost: [1.1, .5, 1.6], n: 3, banners: 4, wisps: 0 } },
  // Hämarkõrb: the blood moon (Verikuu). A cold indigo desert under a crimson moon, a sky full of stars.
  dunes: { cold: .6, hemi: [0x5a62c8, 0x24182e, 1.1], moon: [0xffa0a0, 1.5], fill: [0x2a7a9a, .32], clear: [.004, .003, .012], mistAmb: [.05, .04, .12], mist: [-.3, .42, .55, .11],
    sky: [.024, .012, .05], lift: [.012, .008, .03], sat: .9, expo: .95, sprAmb: [.07, .06, .12], grade: [.94, .94, 1.16, 1.12, .96, .9, .15], stars: 1.4, aurora: 0,
    moonDisc: [.8, .1, .07, 1.15, 1], lantern: 1.3, halo: 1.45, beacon: 1,
    wxB: { n: .12, al: [.3, 0, .9] },
    props: { ghost: [.6, .9, 1.7], n: 4, banners: 5, wisps: 1 } },
  // Tormineem: the black gale. Harder rain, lightning far more often, drowned lights in teal along the cliffs.
  storm: { cold: .25, hemi: [0x5a80b8, 0x0c141c, 1.22], moon: [0xa8c4f0, 1.45], fill: [0x2a6a8a, .36], clear: [.002, .004, .008], mistAmb: [.03, .06, .085], mist: [-.2, .6, 1, .13],
    sky: [.008, .018, .03], lift: [.007, .014, .028], sat: .78, expo: 1, sprAmb: [.045, .065, .09], grade: [.88, 1, 1.12, 1, 1.02, 1.04, .16], stars: 0, aurora: 0,
    moonDisc: [0, 0, 0, 0, 0], lantern: 1.35, halo: 1.6, beacon: 1.1, lightning: 6.5,
    wxA: { n: .74, al: [.5, 0, 1.8] },
    props: { ghost: [.35, 1.35, 1.35], n: 4, banners: 2, wisps: 1 } },
};

const NIGHT_COLD_KEYS = ['stone', 'stoneD', 'stoneL', 'basalt', 'basaltL', 'earth', 'earthD', 'grass', 'grassD', 'moss', 'road', 'roadD', 'mud', 'bark', 'tuftA', 'tuftB', 'leaf', 'leafL', 'sand', 'ash', 'snow', 'slate', 'thatch'];
// The night version of hand-made land b (cached: the same object every call, like procBiome's).
function nightBiome(b) {
  const N = NIGHT_LAND[b.key]; if (!N) return b;
  const hit = NIGHT.cache.get(b.key); if (hit) return hit;
  const cold = [.8, .9, 1.16], ck = Math.min(1, N.cold * 1.4), g = h => hexGrade(h, .015 * ck, 1 - .25 * ck, 1 - .18 * ck, _la([1, 1, 1], cold, ck));
  // Only the ground and scenery colours go cold (towers, cloth, gold and the monsters keep theirs).
  const col = Object.assign({}, b.col); for (const k of NIGHT_COLD_KEYS) {
    const hex = b.col[k] !== undefined ? b.col[k] : COL0[k] ? _xh(COL0[k].map(v => v <= .0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - .055)) : null;
    if (hex !== null) col[k] = g(hex);
  }
  const wx = JSON.parse(JSON.stringify(b.wx));
  for (const L of ['A', 'B']) { const o = N['wx' + L]; if (!o) continue; const s = L === 'A' ? 0 : 1; if (o.n !== undefined) wx.n[s] = o.n; for (const f of ['col', 'al', 'size', 'vel', 'sway', 'y']) if (o[f]) wx[f + L] = o[f].slice(); }
  wx.n[0] = Math.min(.8, wx.n[0]); wx.n[1] = Math.min(.18, wx.n[1]);
  wx.amb = wx.amb.map((v, i) => v * [.7, .8, 1.1][i]);
  const nb = Object.assign({}, b, {
    night: true, act: 2, nightOf: b.key, col, strata: b.strata.map(g),
    hemi: [N.hemi[0], N.hemi[1], N.hemi[2] * .8], moon: N.moon, fill: N.fill, moonPos: N.moonPos || b.moonPos, clear: N.clear, mistAmb: N.mistAmb, mist: N.mist, sky: N.sky, lift: N.lift,
    sat: N.sat, expo: N.expo, sprAmb: N.sprAmb.map(v => v * .85), grade: N.grade.map((v, i) => i === 0 ? v * .95 : i === 2 ? v * 1.05 : v), stars: N.stars, aurora: N.aurora, moonDisc: N.moonDisc, lantern: N.lantern, halo: N.halo,
    beacon: (b.beacon || 1) * N.beacon, wx, nightProps: N.props,
    watA: b.watA.map((v, i) => v * [.7, .85, 1.25][i]), watB: b.wat[0] === 2 ? b.watB : b.watB.map((v, i) => v * [.75, .88, 1.15][i]),
    coverCol: b.coverCol.map((v, i) => v * [.86, .92, 1.1][i]),
  });
  if (N.lightning) nb.lightning = N.lightning;
  if (b.wet) nb.wet = [Math.min(.8, b.wet[0] * 1.15), b.wet[1]];
  NIGHT.cache.set(b.key, nb);
  return nb;
}

// ---- Night props: ghost lanterns (a cold flame and, for a few, a land light), tattered banners and floating wisps.
// Placed last in scatterProps, so a night land's other scenery stays where the day land has it. Fewer on Low.
const NIGHT_PROPS = {
  // An iron lantern on a post: an open cage (corner bars, cap, floor) round a pale core that glows (gc: its colour).
  ghostLantern(T, rng, fallen, gc) {
    T.box(.18, .2, .18, 0, .1, 0, COL.stoneD, { l: L_MASON }); T.cyl(.04, 1.9, 0, 1.05, 0, COL.iron, { n: 5, l: L_METAL });
    T.box(.46, .04, .04, .19, 1.95, 0, COL.iron, { l: L_METAL }); T.box(.03, .08, .03, .38, 1.9, 0, COL.iron, { l: L_METAL });
    T.box(.24, .03, .24, .38, 1.52, 0, mulC(COL.iron, .8), { l: L_METAL }); T.cone(.18, .12, .38, 1.86, 0, COL.iron, { n: 4, l: L_METAL, r: [0, PI / 4, 0] });
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) T.box(.025, .3, .025, .38 + dx * .105, 1.67, dz * .105, COL.iron, { l: L_METAL, jit: 0 });
    const m = Math.max(gc[0], gc[1], gc[2]);
    T.box(.09, .15, .09, .38, 1.66, 0, fallen ? [.05, .05, .06] : gc.map(v => v / m), fallen ? { jit: 0 } : { emis: .7, jit: 0 });
  },
  rag(T, rng, col, h) {
    const lean = rng.range(-.16, .16);
    T.seg([0, 0, 0], [lean, h, 0], .05, .035, mulC(COL.woodD, .8), { l: L_WOOD }); T.seg([lean - .06, h - .18, 0], [lean + .7, h - .25 - rng.range(0, .2), 0], .028, .028, COL.woodD, { l: L_WOOD, n: 4 });
    if (rng() < .6) T.cone(.06, .16, lean, h + .08, 0, COL.iron, { n: 4, l: L_METAL });
    clothPanel(T, { x0: lean + .03, x1: lean + .66, yTop: h - .22, len: rng.range(.8, 1.3), z: 0, col, col2: rng() < .5 ? mulC(COL.gold, .4) : null, rng, rag: .75, sway: 1 });
  },
};
function nightDress(X) {
  const { B, rng, drop, beside } = X, P = B.bio.nightProps; if (!P) return;
  const tier = GFX.tier, few = tier === 'low' ? .5 : tier === 'mid' ? .75 : 1, gc = P.ghost;
  // Ghost lanterns beside the road: each holds a small cold flame; the first ones also light the ground around them.
  let lit = 0;
  for (let k = 0, n = Math.max(1, Math.round(P.n * few)); k < n; k++) {
    const p = beside(5, B.L - 5, 1.0, .35); if (!p) continue;
    const fallen = rng() < .15, ry = -p[2] + (p[3] > 0 ? PI : 0);
    if (!drop(T => NIGHT_PROPS.ghostLantern(T, rng, fallen, gc), .45, fallen ? { at: p, r: [0, -p[2] + rng.range(-.6, .6), 1.45], dy: .12 } : { at: p, ry })) continue;
    if (fallen) continue;
    // The lamp hangs .38 out along the arm (local +x), turned by ry.
    const lx = p[0] + Math.cos(ry) * .38, lz = p[1] - Math.sin(ry) * .38, ly = X.H(p[0], p[1]) + 1.68;
    B.fires.push({ x: lx, y: ly, z: lz, size: .2, fx: { r: gc[0] * .55, g: gc[1] * .55, b: gc[2] * .55, embers: few * .35, glow: .9, layers: 1 } });
    if (lit < P.wisps + 1 && B.env.length < 4) { lit++; B.env.push({ x: lx, y: ly + .2, z: lz, c: _xh(gc.map(v => clamp(v / 1.8, 0, 1))), I: 7, d: 6.5, flick: 1 }); }
  }
  // Tattered banners of the fallen keepers, in faded colours.
  const cols = [mulC(COL.clothB, .65), mulC(COL.clothR, .6), mixC(COL.clothB, [.08, .09, .12], .5)];
  for (let k = 0, n = Math.round(P.banners * (tier === 'low' ? .6 : 1)); k < n; k++) {
    const h = rng.range(2.1, 3), p = k & 1 ? beside(8, B.L - 6, 1.4, .3) : null;
    drop(T => NIGHT_PROPS.rag(T, rng, cols[k % cols.length], h), .35, p ? { at: p, ry: -p[2] + HPI * p[3] } : { far: 1.4 });
  }
}
