
const COL0 = Object.assign({}, COL);
const BIOMES = [
  {
    key: 'ashen', name: 'Tuhakuru', stars: 0.7, col: {},
    strata: [0x8f8474, 0x3c3f4c, 0x66564a, 0x767a86, 0x70503f, 0x4c4f5c, 0x9a8e7c, 0x55483e],
    hemi: [0x6d83bd, 0x1c1f2a, 1.15], moon: [0xa9c0f6, 1.55], fill: [0x4a5f96, .3], moonPos: [14, 44, -34],
    clear: [.0035, .005, .011], mistAmb: [.05, .08, .14], mist: [-.3, .42, .75, .1], sky: [.012, .022, .045], lift: [.010, .016, .030], sat: .92, expo: 1, sprAmb: [.05, .065, .1],
    cover: [0, .55, .3, .5], coverCol: [1, 1, 1], coverP: [.7, .6, 0, 0],
    wat: [0, 1, 1, 0], watA: [.012, .02, .03], watB: [.3, .4, .5], fall: [0, 1, 1, 0], fallA: [.022, .034, .054], fallB: [.2, .27, .38], spray: 'water',
    relief: [1.7, .5, 1, 0], puddles: 11, ponds: 1, sway: 1, wind: 1,
    wx: { n: [.05, 0], velA: [.35, -.12, .18], swayA: [.5, .5], sizeA: [.03, .055], colA: [.75, .8, .95, 1], alA: [.5, 0, 0], yA: [-1, 9], velB: [0, 0, 0], swayB: [0, 0], sizeB: [.05, .05], colB: [1, 1, 1, 1], alB: [0, 0, 0], yB: [0, 1], amb: [.1, .14, .22] },
    mobs: { ghoul: 1.6, wraith: 1.6, necro: 1.5, ram: 2, hound: 1.8, harpy: .6 }, early: { wraith: 3, necro: 5 }, boss: ['giant', 'ogre'], tints: { wisp: [.75, .6, 1.3] }, wispHex: 0xb090ff,
    trees: [['tree', 13, 2.6, 4.6]], stumps: 6, rocks: 70, tufts: 320, webs: 4,
  },
  {
    key: 'frost', name: 'Külmakosk', stars: 0.85, aurora: 0.3, icicles: 1, brightPads: 1,
    col: { stone: 0x6f7b90, stoneD: 0x454e60, stoneL: 0x9aa7b8, earth: 0x4b4a50, earthD: 0x2f3038, grass: 0x5a6068, grassD: 0x40454e, moss: 0x55606a, road: 0x7a808c, roadD: 0x555a66, mud: 0x3a3e48, bark: 0x2e2a2a, tuftA: 0x6f7a80, tuftB: 0xa9b4bc, leaf: 0x1d382f, leafL: 0x2c4f42 },
    strata: [0x7d8aa0, 0x3a4254, 0x5d6678, 0x9fb4c8, 0x4b5468, 0x6a7890, 0xb8cadb, 0x475062],
    hemi: [0x86a8e0, 0x323c50, 1.1], moon: [0xc6dcff, 1.38], fill: [0x5f7fb4, .28], moonPos: [16, 42, -34],
    clear: [.0045, .0075, .015], mistAmb: [.1, .14, .21], mist: [-.3, .5, .7, .12], sky: [.03, .05, .085], lift: [.012, .02, .036], sat: .9, expo: .86, sprAmb: [.1, .125, .17],
    cover: [1, .5, .34, .8], coverCol: [.5, .56, .66], coverP: [.74, .85, .32, 0],
    wat: [1, 0, .3, .35], watA: [.03, .075, .12], watB: [.4, .48, .58], fall: [1, 0, .96, 0], fallA: [.1, .17, .27], fallB: [.46, .58, .72], spray: 'none',
    relief: [1.5, .4, 1.15, 0], puddles: 8, ponds: 2, sway: .8, wind: 1.25, beacon: .8,
    wx: { n: [.68, .16], velA: [.55, -1.5, .3], swayA: [.28, 1.1], sizeA: [.055, .1], colA: [1, 1.05, 1.15, 1], alA: [.95, 0, .12], yA: [-3, 15], velB: [2.6, -1.1, 1.3], swayB: [.5, 1.6], sizeB: [.035, .06], colB: [.95, 1, 1.1, 1], alB: [.6, 0, .5], yB: [-2, 9], amb: [.4, .48, .62] },
    mobs: { wolf: 2.4, golem: 1.8, wraith: 1.3, toad: 0, wisp: .5, slime: .6, harpy: 2.2, hound: .5, ram: .6 }, early: { wolf: 2, golem: 6, harpy: 3 }, boss: ['jotun'], tints: { wolf: [1.9, 2.0, 2.2], golem: [.8, 1.05, 1.5], wisp: [.5, .9, 1.5], gargoyle: [.9, 1.1, 1.4], toad: [.8, 1.1, 1.4], brute: [1.3, 1.25, 3.0] }, wispHex: 0x80c0ff,
    trees: [['pine', 17, 2.8, 5.4], ['tree', 4, 2.6, 4.2]], stumps: 4, rocks: 52, tufts: 110, webs: 0,
  },
  {
    key: 'fen', name: 'Udusoo', stars: 0.35,
    col: { stone: 0x5c6858, stoneD: 0x384234, stoneL: 0x84907a, earth: 0x3b3a28, earthD: 0x24261a, grass: 0x40582c, grassD: 0x2c3e22, moss: 0x4c682e, road: 0x6c6a56, roadD: 0x48483a, mud: 0x2a281c, bark: 0x2c2820, tuftA: 0x486a30, tuftB: 0x7a8a40, leaf: 0x2a4626, leafL: 0x4c6c34 },
    strata: [0x5a5a40, 0x2c3226, 0x4a4030, 0x66705a, 0x3a3020, 0x44503a, 0x777a5c, 0x33382a],
    hemi: [0x4f9482, 0x1a2218, 1.05], moon: [0xa6e6c4, 1.3], fill: [0x2f6f66, .3], moonPos: [10, 46, -32],
    clear: [.003, .007, .006], mistAmb: [.035, .1, .075], mist: [-.1, .62, 1.1, .12], sky: [.018, .05, .036], lift: [.008, .02, .016], sat: .94, expo: 1.02, sprAmb: [.04, .08, .065],
    cover: [.85, .8, 1.1, .55], coverCol: [.075, .125, .05], coverP: [.92, .3, .4, 0],
    wat: [3, .3, .55, 0], watA: [.012, .026, .012], watB: [.1, .2, .045], fall: [0, .8, .9, 0], fallA: [.016, .034, .018], fallB: [.17, .27, .18], spray: 'water',
    relief: [1.0, .3, .7, 0], puddles: 15, ponds: 4, sway: .6, wind: .7,
    wx: { n: [.045, .09], velA: [.12, .02, .08], swayA: [1.3, .45], sizeA: [.05, .085], colA: [1.3, 1.9, .4, 0], alA: [1, 1.3, 0], yA: [.3, 3.4], velB: [.2, -.07, .12], swayB: [.6, .4], sizeB: [.03, .05], colB: [.7, .95, .7, 1], alB: [.5, 0, 0], yB: [-1, 7], amb: [.09, .2, .15] },
    mobs: { toad: 3.5, wisp: 2.4, spider: 2, brood: 2, slime: 1.6, mummy: 0, bomber: .5, shaman: 2.2, ram: .4, hound: .6 }, early: { toad: 2, wisp: 3, brood: 6, shaman: 3 }, boss: ['queen'], tints: { golem: [.75, 1.0, .6], wisp: [.5, 1.4, .7], wolf: [.7, .75, .6], gargoyle: [.8, 1, .8] }, wispHex: 0x70ffa0,
    trees: [['willow', 9, 3.0, 4.6], ['tree', 5, 2.6, 4.4]], stumps: 8, rocks: 42, tufts: 420, webs: 3,
  },
  {
    key: 'ember', name: 'Tulearm', stars: 0.2, cracks: 1,
    col: { stone: 0x403c42, stoneD: 0x242228, stoneL: 0x5e5a62, earth: 0x2e2728, earthD: 0x1c1819, grass: 0x3a2f2c, grassD: 0x261e1c, moss: 0x3a3230, road: 0x5e5652, roadD: 0x3c3634, mud: 0x1e1716, bark: 0x15110f, tuftA: 0x3a2c24, tuftB: 0x6a4a30 },
    strata: [0x3a363c, 0x1c1a20, 0x5a2a22, 0x2a262c, 0x6e3a24, 0x242026, 0x4a4650, 0x301a18],
    hemi: [0x5c5470, 0x2c140e, 1.18], moon: [0xc0b0d0, 1.32], fill: [0xd04a20, .2], moonPos: [18, 40, -32],
    clear: [.008, .004, .006], mistAmb: [.09, .05, .05], mist: [-.3, .5, .9, .1], sky: [.02, .006, .002], lift: [.02, .011, .012], sat: .96, expo: 1, sprAmb: [.09, .05, .04],
    cover: [.8, .74, 1.0, .6], coverCol: [.1, .092, .1], coverP: [.97, .4, .4, 0],
    wat: [2, 1, 1.5, .5], watA: [.22, .02, 0], watB: [.03, .026, .03], fall: [2, .45, 1.2, 0], fallA: [2.1, .56, .07], fallB: [.2, .02, .008], spray: 'lava',
    relief: [1.9, .7, 1.1, 0], puddles: 0, ponds: 2, sway: .7, wind: .9, bankGlow: 1, vein: 1,
    wx: { n: [.26, .12], velA: [.3, -.42, .16], swayA: [.5, .7], sizeA: [.035, .07], colA: [.3, .28, .3, 1], alA: [.85, 0, 0], yA: [-3, 14], velB: [.2, .85, .12], swayB: [.7, .9], sizeB: [.03, .05], colB: [2.6, .9, .14, 0], alB: [1, 2.2, .3], yB: [-2, 10], amb: [.5, .3, .26] },
    mobs: { bomber: 2.4, gargoyle: 2, golem: 1.8, toad: 0, slime: .5, wisp: 1.4, hound: 2.4, shaman: 1.8, harpy: .6 }, early: { bomber: 2, gargoyle: 4, golem: 6, hound: 3, shaman: 4 }, boss: ['colossus'], tints: { golem: [1.5, .5, .26], wolf: [.75, .45, .4], wisp: [1.5, .6, .2], gargoyle: [1.2, .7, .6], toad: [1.2, .7, .5] }, wispHex: 0xff8030,
    trees: [['charred', 11, 2.6, 4.4]], stumps: 4, rocks: 80, tufts: 40, webs: 0,
  },
  {
    key: 'dunes', name: 'Hämarkõrb', stars: 1, brightPads: 1,
    col: { stone: 0xb08e6c, stoneD: 0x7a5c48, stoneL: 0xd4b48c, earth: 0xa88c66, earthD: 0x7c6448, grass: 0xbca27a, grassD: 0x927856, moss: 0x7a7444, road: 0xa89478, roadD: 0x786652, mud: 0x64503a, bark: 0x4c3a28, tuftA: 0x8a8048, tuftB: 0xc0a860, leaf: 0x38582e, leafL: 0x66863e },
    strata: [0xb8845c, 0x8e5a40, 0xd6b080, 0x744a38, 0xc89866, 0x9c6a4c, 0xe4cca0, 0x805640],
    hemi: [0x6a6fc0, 0x3c3040, 1.1], moon: [0xd6c8ff, 1.5], fill: [0x2f8f9a, .34], moonPos: [26, 24, -36],
    clear: [.006, .005, .014], mistAmb: [.07, .07, .13], mist: [-.3, .4, .5, .1], sky: [.03, .03, .06], lift: [.014, .012, .03], sat: .95, expo: .9, sprAmb: [.08, .075, .11],
    cover: [.9, .76, .9, .6], coverCol: [.42, .33, .22], coverP: [.95, .5, .25, .05],
    wat: [0, 1, 1, 0], watA: [.008, .04, .045], watB: [.3, .4, .4], fall: [0, 1, 1, 0], fallA: [.02, .06, .07], fallB: [.24, .36, .38], spray: 'water',
    relief: [1.4, .25, .8, .55], puddles: 0, ponds: 2, sway: 1.3, wind: 1.2, beacon: .62,
    wx: { n: [.1, .22], velA: [.5, -.05, .25], swayA: [.6, .5], sizeA: [.03, .05], colA: [.95, .78, .6, 1], alA: [.5, 0, 0], yA: [-1, 8], velB: [4.2, -.1, 1.9], swayB: [.25, 1.2], sizeB: [.025, .045], colB: [.9, .72, .55, 1], alB: [.42, 0, .9], yB: [-.5, 4.5], amb: [.3, .22, .3] },
    mobs: { mummy: 3, scarab: 2.4, spider: .6, bomber: 1.3, ghoul: 1.3, toad: 0, slime: .4, ram: 2.2, harpy: 2, shaman: .6 }, early: { mummy: 4, scarab: 2, ram: 5, harpy: 3 }, boss: ['king'], tints: { golem: [1.5, 1.1, .72], wolf: [1.5, 1.2, .8], wisp: [1.4, 1.0, .4], gargoyle: [1.5, 1.2, .9], toad: [1.3, 1.1, .7] }, wispHex: 0xffc060,
    trees: [['palm', 9, 3.0, 4.6], ['tree', 2, 2.4, 3.4]], stumps: 2, rocks: 44, tufts: 150, webs: 0,
  },
  {
    // Stormreach: a storm-lashed sea cliff at night. The slab stands in a churning sea (STORM.sea, 42-storm.js:
    // sea = [level, foam]), rain slants on the wind, lightning lights the whole board every 6-14 s (lightning: the
    // mean gap), the stream is a tidal channel with foam (water mode 4), everything is wet (wet = [shine, darken]),
    // and the beacon is a lighthouse whose lamp sweeps two beams over the sea (lighthouse).
    key: 'storm', name: 'Tormineem', stars: 0,
    col: { stone: 0x40464f, stoneD: 0x22262d, stoneL: 0x626b76, earth: 0x30342f, earthD: 0x20231f, grass: 0x46553f, grassD: 0x323e2f, moss: 0x3c4e36, road: 0x6a6f76, roadD: 0x43474e, mud: 0x25272a, bark: 0x3a3631, tuftA: 0x58663f, tuftB: 0x9a9262, leaf: 0x283a2a, leafL: 0x3c5434 },
    strata: [0x343a44, 0x1c2027, 0x4c525c, 0x272b32, 0x3c3a38, 0x20252c, 0x5c626a, 0x2c2f33],
    hemi: [0x6a8cb6, 0x141c24, 1.25], moon: [0xb4ccf0, 1.5], fill: [0x3a6e86, .36], moonPos: [-10, 40, -36],
    clear: [.003, .0055, .009], mistAmb: [.045, .07, .09], mist: [-.2, .55, .85, .12], sky: [.014, .026, .04], lift: [.01, .018, .03], sat: .8, expo: .96, sprAmb: [.055, .075, .095],
    cover: [0, .55, .3, .5], coverCol: [1, 1, 1], coverP: [.7, .6, 0, 0], wet: [.62, .16],
    wat: [4, .9, 1.15, .45], watA: [.008, .02, .024], watB: [.5, .58, .62], fall: [0, 1.3, 1, 0], fallA: [.02, .04, .05], fallB: [.42, .52, .58], spray: 'water',
    relief: [1.6, .55, 1.25, 0], puddles: 16, ponds: 3, sway: 1.5, wind: 1.6, beacon: .4, lighthouse: 1, sea: [-4.3, 1], lightning: 10,
    wx: { n: [.62, .08], velA: [3.4, -15, 1.7], swayA: [.04, .6], sizeA: [.016, .026], colA: [.72, .8, .95, 1], alA: [.42, 0, 1.6], yA: [-2, 14], velB: [5.5, -1.4, 2.6], swayB: [.3, 1.4], sizeB: [.025, .045], colB: [.8, .88, .95, 1], alB: [.35, 0, .7], yB: [-1.5, 5], amb: [.3, .38, .48] },
    mobs: { drowned: 3, harpy: 2.4, wraith: 2, knight: 1.8, ram: 1.6, gargoyle: 1.2, rat: .15, scarab: 0, mummy: 0, toad: .6, spider: .5, slime: .6, hound: .4, wolf: .5, golem: .6, shaman: .5, necro: 1.2 },
    early: { drowned: 1, harpy: 3, wraith: 4, knight: 3, ram: 5 }, boss: ['leviathan'], tints: { skel: [.62, .95, .88], wisp: [.5, 1.1, 1.3], gargoyle: [.75, .95, 1.05], golem: [.7, .95, .95], wolf: [.75, .85, .9], toad: [.65, .95, .9], ghoul: [.8, 1.15, 1.2] }, wispHex: 0x70e0d8,
    trees: [['windbent', 8, 2.2, 3.6]], stumps: 2, rocks: 86, tufts: 380, tuft: 'seagrass', webs: 0, noRuin: 1,
  },
];
// BIOME.start: the land index of board index 0. BIOME.seed: the procedural lands' seed when the game sets no G.runSeed.
const BIOME = { start: 0, seed: 1 };
// Land index BIOME.start + index: a hand-made land below BIOMES.length, a generated one (procBiome, 35-longnight.js) above.
function biomeFor(index) { return biomeAt(BIOME.start + index); }
function applyBiomePalette(b) { Object.assign(COL, COL0); for (const k in b.col) COL[k] = C(b.col[k]); }

const LOOK = { cur: null, to: null, bio: null };
// A land's colour grade: shadow tint (rgb), highlight tint (rgb), contrast (an S-curve, 0..0.3). bio.grade, else neutral.
const GRADE0 = [1, 1, 1, 1, 1, 1, 0];
// The moon in the sky (Act II nights, 36-night.js): linear colour, size, strength; none by day.
const MOON0 = [0, 0, 0, 1, 0];
function lookOf(b) {
  return { hs: C(b.hemi[0]), hg: C(b.hemi[1]), hi: [b.hemi[2]], mc: C(b.moon[0]), mi: [b.moon[1]], fc: C(b.fill[0]), fi: [b.fill[1]], clear: b.clear.slice(), mAmb: b.mistAmb.slice(), mist: b.mist.slice(), sky: b.sky.slice(), lift: b.lift.slice(), grade: [b.sat, b.expo], amb: b.sprAmb.slice(), wamb: b.wx.amb.slice(), tone: (b.grade || GRADE0).slice(), back: b.sky.map((v, i) => v * .45 + b.mistAmb[i] * .12).concat([b.stars === undefined ? .6 : b.stars, b.aurora || 0]), edge: b.mistAmb.map((v, i) => v * .55 + b.clear[i] * 1.5).concat([b.sea ? .15 : .62]), moonD: (b.moonDisc || MOON0).slice(), lan: [b.lantern || 1, b.halo || 1] };
}
const _lc = new THREE.Color();
function applyLook(L) {
  LT.hemi.color.setRGB(L.hs[0], L.hs[1], L.hs[2]); LT.hemi.groundColor.setRGB(L.hg[0], L.hg[1], L.hg[2]); LT.hemi.intensity = L.hi[0];
  LT.moon.color.setRGB(L.mc[0], L.mc[1], L.mc[2]); LT.moon.intensity = L.mi[0]; LT.fill.color.setRGB(L.fc[0], L.fc[1], L.fc[2]); LT.fill.intensity = L.fi[0];
  R.renderer.setClearColor(_lc.setRGB(L.clear[0], L.clear[1], L.clear[2]), 1);
  const a = R.mats.atmo.uniforms, c = R.mats.comp.uniforms;
  a.uMistAmb.value.set(L.mAmb[0], L.mAmb[1], L.mAmb[2]); a.uMist.value.set(L.mist[0], L.mist[1], L.mist[2], L.mist[3]);
  SH.uSky.value.setRGB(L.sky[0], L.sky[1], L.sky[2]); c.uLift.value.set(L.lift[0], L.lift[1], L.lift[2]); c.uGrade.value.y = L.grade[0]; R.exposure = L.grade[1];
  FX.alpha.mesh.material.uniforms.uAmb.value.set(L.amb[0], L.amb[1], L.amb[2]); WX.u.uAmb.value.set(L.wamb[0], L.wamb[1], L.wamb[2]);
  const g = L.tone; c.uShT.value.set(g[0], g[1], g[2]); c.uHiT.value.set(g[3], g[4], g[5]); c.uCon.value = g[6];
  a.uEdge.value.set(L.edge[0], L.edge[1], L.edge[2], L.edge[3]); a.uBackTop.value.set(L.back[0], L.back[1], L.back[2]); a.uBack.value.z = L.back[3]; a.uBack.value.w = L.back[4];
  a.uMoonC.value.set(L.moonD[0], L.moonD[1], L.moonD[2], L.moonD[4]); R.moonSize = L.moonD[3]; LT.lanternK = L.lan[0]; R.haloK = L.lan[1];
}
function setBiomeLook(B, instant) {
  const b = B.bio; LOOK.bio = b; LOOK.to = lookOf(b);
  if (instant || !LOOK.cur) LOOK.cur = lookOf(b);
  SH.uCover.value.fromArray(b.cover); SH.uCoverCol.value.fromArray(b.coverCol); SH.uCoverP.value.fromArray(b.coverP);
  SH.uWat.value.fromArray(b.wat); SH.uWatA.value.fromArray(b.watA); SH.uWatB.value.fromArray(b.watB); SH.uWind.value = b.sway;
  SH.uWet.value.fromArray(b.wet || [0, 0]);
  const f = MAT.fall.uniforms; f.uFP.value.fromArray(b.fall); f.uFA.value.fromArray(b.fallA); f.uFB.value.fromArray(b.fallB);
  setWeather(b.wx, instant);
  const m = B.mirrored, p = b.moonPos; LT.moon.position.set(m ? p[2] : p[0], p[1], m ? p[0] : p[2]); LT.moon.target.position.set(0, 0, 0);
  applyLook(LOOK.cur); setStormLand(B, instant);
}
function updateBiomeLook(dt) {
  if (!LOOK.cur) return;
  const k = 1 - Math.exp(-dt * 1.6), a = LOOK.cur, b = LOOK.to;
  for (const key in a) { const x = a[key], y = b[key]; for (let i = 0; i < x.length; i++) x[i] += (y[i] - x[i]) * k; }
  applyLook(a); if (typeof eventLook === 'function') eventLook(); updateStorm(dt); WX.fade = Math.min(1, WX.fade + dt * .5); WX.u.uFade.value = WX.fade;
}
