// ---- The Long Night: procedural lands ---------------------------------------------------------------------------
// procBiome(seed, i) makes a full BIOMES-shaped land for land index i >= 6 (BIOMES.length): it picks a base land and a
// donor from the six hand-made ones, blends their palettes, light and tables, then mutates hue, time of day (a mood),
// mist, weather, water, trees and props mix, relief and puddles, and names the place. Deterministic for (seed, i): it
// uses its own random stream (never rnd or frnd) and the result is cached, so every caller gets the same object.
//
// Fields beyond a hand-made land's:
// - key: 'proc' (every generated land), id: 'proc:<seed>:<i>' (unique), seed, index.
// - dress: the base land's key, for BIOME_DRESS (scatterProps dresses with it); accent: the donor's key, a lighter set
//   of the donor's props on top (PROC_ACCENT).
// - eventKind: an EVENTS kind of the base or donor land that suits this land (eventKindFor reads it).
// - mood: 'night' | 'dusk' | 'blood' | 'aurora' | 'dawn' | 'plain'; weather: 'rain' | 'snow' | 'ash' | 'embers' |
//   'spores' | 'sand' | 'none'; water: 0 still, 1 ice, 2 lava, 3 bog, 4 tidal.
// - music: { seed, base, donor, mood, weather } for the sound (Echo).
// - icicles, brightPads, cracks: scenery switches the hand-made lands get from their key.
const PROC_KEY = 'proc';
const PROC = { cache: new Map() };

// The seed of the procedural lands: the run seed when the game sets one, else the boot seed (BIOME.seed).
// (A campaign or Long Night run sets G.runSeed at its start and saves it; the AI demo and test sessions use the boot seed.)
function procSeed() {
  if (typeof G !== 'undefined' && G && G.mode && G.mode !== 'demo' && Number.isFinite(G.runSeed) && G.runSeed > 0) return G.runSeed;
  return Number.isFinite(BIOME.seed) ? BIOME.seed : 1;
}
// The land at absolute land index j (BIOME.start + board index): a hand-made one below 6, a generated one from 6 on.
function biomeAt(j, seed) {
  const n = BIOMES.length; j = Math.floor(+j || 0);
  if (j < n) return BIOMES[(j % n + n) % n];
  return procBiome(seed === undefined || seed === null || !Number.isFinite(+seed) ? procSeed() : +seed, j);
}

// sRGB hex colour helpers (the BIOMES tables are sRGB hex; linear arrays are blended as numbers).
const _hx = h => [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255];
const _xh = c => (Math.round(clamp(c[0], 0, 1) * 255) << 16) | (Math.round(clamp(c[1], 0, 1) * 255) << 8) | Math.round(clamp(c[2], 0, 1) * 255);
function hexMix(a, b, t) { const x = _hx(a), y = _hx(b); return _xh([lerp(x[0], y[0], t), lerp(x[1], y[1], t), lerp(x[2], y[2], t)]); }
function _hsl(c) {
  const mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2]), l = (mx + mn) / 2, d = mx - mn;
  if (d < 1e-6) return [0, 0, l];
  const s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === c[0] ? (c[1] - c[2]) / d + (c[1] < c[2] ? 6 : 0) : mx === c[1] ? (c[2] - c[0]) / d + 2 : (c[0] - c[1]) / d + 4;
  return [h / 6, s, l];
}
function _rgb(h, s, l) {
  if (s <= 0) return [l, l, l];
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t % 1 + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}
// Shifts a hex colour's hue (in turns), scales its saturation and lightness, then multiplies by a tint.
function hexGrade(hex, dh, sMul, lMul, tint) {
  const c = _hsl(_hx(hex)), r = _rgb(c[0] + dh, clamp(c[1] * sMul, 0, 1), clamp(c[2] * lMul, 0, 1));
  return _xh(tint ? [r[0] * tint[0], r[1] * tint[1], r[2] * tint[2]] : r);
}
const _la = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));

// Times of day. Each is a full set of light settings (as in BIOMES), blended over the base and donor mix.
// pal: a tint for the ground palette; elev: the moon's height (low for dusk and dawn: long shadows); wisp: the
// colour of glowing monsters; amb: the weather's ambient light; grade: split-tone shadows / highlights and contrast.
const MOODS = {
  night: { w: 20, hemi: [0x5a6ca4, 0x12141c, 1.08], moon: [0xa0b6ec, 1.42], fill: [0x3a4c84, .28], clear: [.0024, .0034, .0085], mistAmb: [.035, .052, .1], sky: [.009, .016, .034], lift: [.008, .011, .025], sat: .88, expo: 1.03, sprAmb: [.045, .055, .09], elev: 1, pal: [.92, .95, 1.06], wisp: 0x90a8ff, amb: [.1, .13, .22], mist: 1, grade: [.93, .98, 1.12, 1, 1, 1.04, .14] },
  dusk: { w: 20, hemi: [0x9078b0, 0x2a1c22, 1.12], moon: [0xffb88a, 1.5], fill: [0x4e64b8, .34], clear: [.012, .006, .013], mistAmb: [.1, .065, .09], sky: [.04, .024, .042], lift: [.02, .011, .02], sat: .97, expo: .95, sprAmb: [.1, .07, .09], elev: .55, pal: [1.05, .98, .95], wisp: 0xffb070, amb: [.4, .28, .3], mist: 1.05, grade: [.95, .94, 1.1, 1.1, 1, .88, .14] },
  blood: { w: 16, hemi: [0x844452, 0x200c0e, 1.12], moon: [0xff6c54, 1.45], fill: [0x5a3070, .3], clear: [.011, .0025, .004], mistAmb: [.12, .03, .035], sky: [.045, .01, .012], lift: [.026, .006, .008], sat: .9, expo: .98, sprAmb: [.11, .045, .045], elev: .8, pal: [1.06, .93, .93], wisp: 0xff5040, amb: [.45, .18, .18], mist: .95, grade: [1.04, .93, .98, 1.08, .96, .9, .16] },
  aurora: { w: 16, hemi: [0x4aa890, 0x0c1a1e, 1.1], moon: [0xaaffd8, 1.32], fill: [0x7c52d8, .36], clear: [.002, .009, .009], mistAmb: [.03, .1, .085], sky: [.01, .055, .045], lift: [.006, .02, .02], sat: .96, expo: 1, sprAmb: [.04, .09, .08], elev: 1, pal: [.94, 1.04, 1.02], wisp: 0x70ffb0, amb: [.15, .38, .32], mist: 1, grade: [.96, 1.02, 1.07, .98, 1.04, 1, .12] },
  dawn: { w: 14, hemi: [0xa0aed0, 0x3c3438, 1.15], moon: [0xffe2c4, 1.5], fill: [0x7898c8, .3], clear: [.018, .018, .025], mistAmb: [.14, .14, .16], sky: [.05, .05, .06], lift: [.022, .02, .026], sat: .82, expo: .9, sprAmb: [.12, .12, .14], elev: .45, pal: [1.02, 1, .99], wisp: 0xffe0a0, amb: [.5, .48, .5], mist: 1.35, grade: [.98, .98, 1.06, 1.06, 1.02, .96, .08] },
  plain: { w: 10 },
};
// The hand-made lands' own grade (also used by the generated ones through the blend).
const LAND_GRADE = {
  ashen: [.95, .98, 1.08, 1.06, 1, .92, .12], frost: [.94, 1, 1.1, 1.02, 1.02, 1, .1], fen: [.94, 1.04, .98, 1.06, 1.02, .9, .12],
  ember: [1.04, .96, 1.02, 1.08, .98, .88, .16], dunes: [.96, .96, 1.1, 1.08, 1, .9, .12], storm: [.92, 1, 1.08, 1, 1.02, 1.04, .14],
};
for (const b of BIOMES) if (!b.grade && LAND_GRADE[b.key]) b.grade = LAND_GRADE[b.key];

// Weather layers taken from the hand-made lands' weather (A and B are its two particle layers).
const _wxL = (key, ab) => { const w = BIOMES.find(b => b.key === key).wx, s = ab === 'A' ? 0 : 1; return { n: w.n[s], vel: w['vel' + ab], sway: w['sway' + ab], size: w['size' + ab], col: w['col' + ab], al: w['al' + ab], y: w['y' + ab] }; };
const WEATHER = {
  none: () => [_wxL('ashen', 'A'), _wxL('fen', 'B'), .7],
  rain: () => [_wxL('storm', 'A'), _wxL('storm', 'B'), 1],
  snow: () => [_wxL('frost', 'A'), _wxL('frost', 'B'), 1],
  ash: () => [_wxL('ember', 'A'), _wxL('ashen', 'A'), 1.15],
  embers: () => [_wxL('ember', 'A'), _wxL('ember', 'B'), 1],
  spores: () => [_wxL('fen', 'A'), _wxL('fen', 'B'), 1.25],
  sand: () => [_wxL('dunes', 'A'), _wxL('dunes', 'B'), 1],
};
const LAND_WEATHER = { ashen: 'none', frost: 'snow', fen: 'spores', ember: 'embers', dunes: 'sand', storm: 'rain' };
const LAND_WATER = { ashen: 0, frost: 1, fen: 3, ember: 2, dunes: 0, storm: 4 };
// Which land's water settings stand for each water mode.
const WATER_SRC = ['ashen', 'frost', 'ember', 'fen', 'storm'];

// Names. Each land lends words; moods and weather lend adjectives.
const NAMEW = {
  ashen: { pre: ['Ash', 'Grey', 'Gloam', 'Barrow', 'Raven'], place: ['Pass', 'Hollow', 'Barrows', 'Crags', 'Tors'], adj: ['Ashen', 'Hollow', 'Grey'] },
  frost: { pre: ['Frost', 'Rime', 'Winter', 'Hoar', 'Snow'], place: ['Fells', 'Peaks', 'Hold', 'Fall', 'Heights'], adj: ['Frozen', 'Silent', 'Rimed'] },
  fen: { pre: ['Mire', 'Bog', 'Moss', 'Reed', 'Rot'], place: ['Marsh', 'Fen', 'Mire', 'Slough', 'Bog'], adj: ['Weeping', 'Sunken', 'Rotting'] },
  ember: { pre: ['Ember', 'Cinder', 'Brand', 'Slag', 'Smoke'], place: ['Scar', 'Caldera', 'Rift', 'Forge', 'Wastes'], adj: ['Burning', 'Scorched', 'Smouldering'] },
  dunes: { pre: ['Dusk', 'Sand', 'Sun', 'Dust', 'Bone'], place: ['Mesa', 'Steppe', 'Flats', 'Dunes', 'Wastes'], adj: ['Bleached', 'Forgotten', 'Buried'] },
  storm: { pre: ['Storm', 'Gale', 'Brine', 'Wrack', 'Tide'], place: ['Reach', 'Strand', 'Cliffs', 'Head', 'Shore'], adj: ['Drowned', 'Howling', 'Wind-torn'] },
};
const MOOD_W = { night: ['Starless', 'Lightless', 'Black'], dusk: ['Gloaming', 'Dimming', 'Amber'], blood: ['Crimson', 'Bleeding', 'Red'], aurora: ['Ghostlit', 'Veiled', 'Glimmering'], dawn: ['Pale', 'Waning', 'Hushed'], plain: ['Lost', 'Last', 'Nameless'] };
const MOOD_N = { night: 'the Long Dark', dusk: 'the Last Light', blood: 'the Red Moon', aurora: 'the Green Veil', dawn: 'the Pale Dawn', plain: 'the Hollowing' };
const WX_W = { rain: ['Weeping', 'Drowned'], snow: ['Frozen', 'White'], ash: ['Ashen', 'Smothered'], embers: ['Burning', 'Smouldering'], spores: ['Blighted', 'Whispering'], sand: ['Scoured', 'Shifting'], none: ['Still', 'Quiet'] };
const PLACE_ANY = ['Hollow', 'Vale', 'Reach', 'Deep', 'Barrow', 'Moor', 'Hold', 'Gate', 'Fells', 'Rest', 'Watch', 'March'];
const SYL = [['Ka', 'Vha', 'Mor', 'I', 'Se', 'Dra', 'A', 'Thu', 'Y', 'Co', 'Mae', 'Bra', 'E', 'Ru', 'Ve', 'O', 'Ha', 'Ga', 'Ne', 'Ti', 'Lo', 'Ul'],
  ['', '', 'r', 'l', 'th', 'n', 'v', 'dr', 'sk', 'rv', 'lm', 'nd'], ['el', 'arn', 'ow', 'un', 'eth', 'ae', 'wyn', 'is', 'och', 'a', 'elm', 'ar', 'en', 'ith', 'ra', 'os']];
function procProper(rng) { let s = rng.pick(SYL[0]) + rng.pick(SYL[1]) + rng.pick(SYL[2]); if (s.length < 4) s += rng.pick(['n', 'th', 'r', 'l']); return s; }
function procName(rng, base, donor, mood, weather) {
  const A = NAMEW[base], D = NAMEW[donor], adjs = [...MOOD_W[mood], ...(WX_W[weather] || []), ...A.adj];
  const kind = rng();
  if (kind < .3) return 'The ' + rng.pick(adjs) + ' ' + rng.pick(A.place) + ' of ' + procProper(rng);
  if (kind < .55) {
    let p1 = rng.pick(A.pre), p2 = rng.pick(D.pre); if (p1 === p2) p2 = rng.pick(D.place);
    return p1 + p2.toLowerCase() + ' ' + rng.pick(PLACE_ANY);
  }
  if (kind < .72) return procProper(rng) + "'s " + rng.pick([...A.place, ...PLACE_ANY]);
  if (kind < .87) return rng.pick(A.place) + ' of ' + MOOD_N[mood];
  return 'The ' + rng.pick(adjs) + ' ' + rng.pick([...A.place, ...D.place]);
}


// The bases of the k-th run of six generated lands: a shuffle of the six hand-made lands, never starting on the
// land the previous run ended on (for the first run, the campaign's last land). Pure in (seed, k).
function procBases(seed, k, raw) {
  const r = makeRng(Math.imul(seed + 17, 0x2C1B3C6D) ^ Math.imul(k + 3, 0x297A2D39)), n = BIOMES.length, p = [];
  for (let j = 0; j < n; j++) p.push(j);
  for (let j = n - 1; j > 0; j--) { const q = Math.floor(r() * (j + 1)), t = p[j]; p[j] = p[q]; p[q] = t; }
  if (!raw) { const last = k <= 1 ? n - 1 : procBases(seed, k - 1, true)[n - 1]; if (p[0] === last) { p[0] = p[1]; p[1] = last; } }
  return p;
}
// The time of day of land i: a weighted pick, moved on when it would repeat the previous land's own pick. Pure in (seed, i).
function procMood(seed, i) {
  const keys = Object.keys(MOODS), pick = j => { let s = 0; for (const k of keys) s += MOODS[k].w; let x = h2(seed, j, 7741) * s; for (const k of keys) { x -= MOODS[k].w; if (x <= 0) return k; } return keys[0]; };
  const m = pick(i); return i > BIOMES.length && m === pick(i - 1) ? keys[(keys.indexOf(m) + 1 + Math.floor(h2(seed, i, 7742) * (keys.length - 1))) % keys.length] : m;
}

function procBiome(seed, i) {
  seed = Math.floor(+seed) || 0; i = Math.max(BIOMES.length, Math.floor(+i) || 0);
  const id = PROC_KEY + ':' + seed + ':' + i, hit = PROC.cache.get(id); if (hit) return hit;
  const rng = makeRng(Math.imul(seed + 7919, 0x9E3779B1) ^ Math.imul(i + 101, 0x85EBCA6B));
  for (let k = 0; k < 3; k++) rng();
  const NB = BIOMES.length;
  // Base and donor. Each run of six lands uses every base once (procBases), so the Long Night keeps moving.
  const bi = procBases(seed, Math.floor(i / NB))[i % NB];
  let di = Math.floor(rng() * (NB - 1)); if (di >= bi) di++;
  const A = BIOMES[bi], D = BIOMES[di], t = rng.range(.18, .42);
  const moodKey = procMood(seed, i), M = MOODS[moodKey], mk = moodKey === 'plain' ? 0 : rng.range(.55, .85) * (moodKey === 'blood' && A.key === 'ember' ? .45 : 1); // red on red reads as mud
  // Weather: often the base land's own, sometimes the donor's, sometimes anything.
  const wr = rng();
  let weather = wr < .45 ? LAND_WEATHER[A.key] : wr < .65 ? LAND_WEATHER[D.key] : rng.pick(Object.keys(WEATHER));
  if (A.key === 'ember' && (weather === 'snow' || weather === 'rain')) weather = 'ash';
  const hue = rng.range(-.045, .045), satMul = rng.range(.85, 1.12), lightHue = rng.range(-.03, .03);

  // ---- Palette: the two lands' colours blended, then the hue shift and the mood's tint.
  const pal = M.pal ? _la([1, 1, 1], M.pal, mk) : [1, 1, 1], pk = rng.range(.6, 1);
  const g = h => hexGrade(h, hue, satMul, 1, _la([1, 1, 1], pal, pk));
  const col = {};
  const keys = new Set([...Object.keys(A.col), ...Object.keys(D.col)]);
  const c0hex = k => { const c = COL0[k]; return c ? _xh(c.map(v => v <= .0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - .055)) : 0x808080; };
  for (const k of keys) col[k] = g(hexMix(A.col[k] !== undefined ? A.col[k] : c0hex(k), D.col[k] !== undefined ? D.col[k] : c0hex(k), t));
  const strata = A.strata.map((h, k) => g(hexMix(h, D.strata[k % D.strata.length], t * .8)));

  // ---- Light: base and donor blended, then the mood over it.
  const L = (f) => {
    const a = A[f], d = D[f], m = M[f];
    if (Array.isArray(a) && a.length === 3 && a[0] > 1) { // [hex, hex, k] or [hex, k]
      let r = [hexMix(a[0], d[0], t), hexMix(a[1], d[1], t), lerp(a[2], d[2], t)];
      if (m) r = [hexMix(r[0], m[0], mk), hexMix(r[1], m[1], mk), lerp(r[2], m[2], mk)];
      return r;
    }
    if (Array.isArray(a) && a.length === 2 && a[0] > 1) { let r = [hexMix(a[0], d[0], t), lerp(a[1], d[1], t)]; if (m) r = [hexMix(r[0], m[0], mk), lerp(r[1], m[1], mk)]; return r; }
    if (Array.isArray(a)) { let r = _la(a, d, t); if (m) r = _la(r, m, mk); return r; }
    let r = lerp(a, d, t); if (m !== undefined) r = lerp(r, m, mk); return r;
  };
  const hemi = L('hemi'), moon = L('moon'), fill = L('fill');
  hemi[0] = hexGrade(hemi[0], lightHue, 1, 1); moon[0] = hexGrade(moon[0], lightHue * .5, 1, 1); fill[0] = hexGrade(fill[0], lightHue, 1, 1);
  // Keep it readable: the moon and sky together give about as much light as the two source lands did (a mood may
  // swap a white moon for a dim red one); the difference goes into the exposure.
  const lum = h => { const c = _hx(h).map(v => v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4)); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
  const lit = (hm, mn, ex) => (lum(mn[0]) * mn[1] + .7 * lum(hm[0]) * hm[2] + .3 * lum(hm[1]) * hm[2]) * ex;
  const expoK = clamp(Math.sqrt(lerp(lit(A.hemi, A.moon, A.expo), lit(D.hemi, D.moon, D.expo), t) / Math.max(1e-4, lit(hemi, moon, L('expo')))), .9, 1.3);
  const moonPos = A.moonPos.slice(); moonPos[1] = clamp(lerp(moonPos[1], moonPos[1] * (M.elev || 1), mk), 20, 48); if (rng() < .5) moonPos[0] = -moonPos[0];
  // Mist: denser or thinner, tinted by the mood.
  const mist = _la(A.mist, D.mist, t); mist[2] = clamp(mist[2] * rng.range(.7, 1.45) * lerp(1, M.mist || 1, mk), .4, 1.45); mist[1] = clamp(mist[1] * rng.range(.85, 1.2), .3, .8);
  const grade = _la(LAND_GRADE[A.key], LAND_GRADE[D.key], t), gr = M.grade ? _la(grade, M.grade, mk) : grade;

  // ---- Weather.
  const [wa, wb, wd] = WEATHER[weather](), dens = rng.range(.65, 1.1) * wd;
  const wxAmb = _la(_la(A.wx.amb, D.wx.amb, t), M.amb || A.wx.amb, mk * .7);
  const tintCol = (c, k) => { if (c[3] !== 0) return c.slice(); const w = _hx(M.wisp || 0xffffff), s = Math.max(c[0], c[1], c[2]); return [lerp(c[0], w[0] * s, k), lerp(c[1], w[1] * s, k), lerp(c[2], w[2] * s, k), 0]; };
  const wx = {
    n: [Math.min(.8, wa.n * dens), Math.min(.18, wb.n * dens)], velA: wa.vel.slice(), swayA: wa.sway.slice(), sizeA: wa.size.slice(), colA: tintCol(wa.col, mk * .8), alA: wa.al.slice(), yA: wa.y.slice(),
    velB: wb.vel.slice(), swayB: wb.sway.slice(), sizeB: wb.size.slice(), colB: tintCol(wb.col, mk * .8), alB: wb.al.slice(), yB: wb.y.slice(), amb: wxAmb,
  };
  if (weather === 'none') wx.n = [.04 + .03 * rng(), .03 + .05 * rng()];

  // ---- Water. Lava only ever under an ember base (its dress lights the lava); ice likes snow.
  let water = LAND_WATER[A.key];
  if (A.key !== 'ember') {
    if (weather === 'snow' && rng() < .55) water = 1;
    else if (rng() < .3) { const w2 = LAND_WATER[D.key]; if (w2 !== 2) water = w2; }
  }
  const WS = BIOMES.find(b => b.key === (water === LAND_WATER[A.key] ? A.key : WATER_SRC[water]));
  const wTint = water === 2 ? [1, 1, 1] : _la([1, 1, 1], _hx(M.wisp || 0xffffff).map(v => .7 + .5 * v), mk * .6);
  const sea = A.sea ? A.sea.slice() : (water === 4 || D.key === 'storm') && rng() < .3 ? [-4.3, 1] : null;

  // ---- Ground cover (snow, moss, ash, sand).
  const CS = weather === 'snow' ? BIOMES.find(b => b.key === 'frost') : rng() < .72 ? A : D;
  const cover = CS.cover.slice(), coverCol = CS.coverCol.map((v, k) => v * lerp(1, pal[k], .5)), coverP = CS.coverP.slice();
  if (weather === 'snow' && CS !== A) cover[0] = rng.range(.55, .95);

  // ---- Monsters: both lands' tables blended (missing means the default 1, or 0 for kinds only some lands send).
  const def0 = k => (typeof ROSTER !== 'undefined' && ROSTER[k] && !ROSTER[k][5]) ? 0 : 1;
  const mobs = {}; for (const k of new Set([...Object.keys(A.mobs), ...Object.keys(D.mobs)])) { const a = A.mobs[k] === undefined ? def0(k) : A.mobs[k], d = D.mobs[k] === undefined ? def0(k) : D.mobs[k]; mobs[k] = Math.round(lerp(a, d, t * 1.2) * 100) / 100; }
  const early = {}; for (const k in D.early) early[k] = D.early[k] + 1; for (const k in A.early) early[k] = A.early[k];
  const boss = rng() < .65 ? [A.boss[0], D.boss[0]] : [D.boss[0], A.boss[0]];
  if (A.boss.length > 1) boss.push(A.boss[1]);
  const tints = Object.assign({}, D.tints, A.tints);
  const wispHex = hexMix(hexMix(A.wispHex, D.wispHex, t), M.wisp || A.wispHex, mk * .8);

  // ---- Scenery mix.
  const trees = A.trees.map(([k, n, h0, h1]) => [k, Math.max(1, Math.round(n * rng.range(.7, 1.15))), h0, h1]);
  { const [k, n, h0, h1] = D.trees[0], cnt = Math.round(n * rng.range(.2, .45)); if (cnt > 0 && !trees.some(tr => tr[0] === k)) trees.push([k, cnt, h0, h1]); else if (cnt > 0) trees.find(tr => tr[0] === k)[1] += cnt; }
  const relief = _la(A.relief, D.relief, t).map((v, k) => k === 3 ? v : v * rng.range(.85, 1.18));
  if (A.key === 'dunes' || D.key === 'dunes') relief[3] = Math.max(relief[3], rng() < .5 ? .35 : 0);
  const ri = (a, b, j = .25) => Math.max(0, Math.round(lerp(a, b, t) * rng.range(1 - j, 1 + j)));

  // ---- The land event: the base's or the donor's, as long as it fits (no lava surge without lava).
  const evOf = key => (typeof EVENTS !== 'undefined' ? Object.keys(EVENTS).find(k => EVENTS[k].land === key) : null);
  const fits = k => k && (k !== 'lavaSurge' || water === 2);
  let eventKind = rng() < .65 ? evOf(A.key) : evOf(D.key); if (!fits(eventKind)) eventKind = fits(evOf(A.key)) ? evOf(A.key) : fits(evOf(D.key)) ? evOf(D.key) : 'rockslide';

  const name = procName(rng, A.key, D.key, moodKey, weather);
  const bio = {
    key: PROC_KEY, id, seed, index: i, name, dress: A.key, accent: D.key, eventKind, mood: moodKey, weather, water, base: A.key, donor: D.key, blend: t,
    music: { seed: (Math.imul(seed, 31) + i * 977) >>> 0, base: A.key, donor: D.key, mood: moodKey, weather },
    col, strata, hemi, moon, fill, moonPos,
    clear: L('clear'), mistAmb: L('mistAmb'), mist, sky: L('sky'), lift: L('lift'), sat: L('sat'), expo: L('expo') * expoK, sprAmb: L('sprAmb'), grade: gr,
    cover, coverCol, coverP,
    wat: WS.wat.slice(), watA: WS.watA.map((v, k) => v * wTint[k]), watB: WS.watB.map((v, k) => v * wTint[k]), fall: WS.fall.slice(), fallA: WS.fallA.map((v, k) => v * wTint[k]), fallB: WS.fallB.map((v, k) => v * wTint[k]), spray: WS.spray,
    relief, puddles: water === 2 ? 0 : ri(A.puddles, D.puddles, .5), ponds: clamp(ri(A.ponds, D.ponds, .4), water === 2 ? 1 : 0, 4), sway: lerp(A.sway, D.sway, t), wind: lerp(A.wind, D.wind, t) * (weather === 'rain' || weather === 'sand' ? 1.2 : 1),
    beacon: lerp(A.beacon || 1, D.beacon || 1, t), wx,
    mobs, early, boss, tints, wispHex,
    trees, stumps: ri(A.stumps, D.stumps), rocks: ri(A.rocks, D.rocks, .2), tufts: ri(A.tufts, D.tufts, .3), webs: ri(A.webs, D.webs, .5),
    icicles: A.key === 'frost' || weather === 'snow' || water === 1, brightPads: A.key === 'frost' || A.key === 'dunes',
  };
  // The night sky behind the slab: stars unless the weather hides them, an aurora under the green veil.
  bio.stars = Math.round({ rain: 0, snow: .3, sand: .45, ash: .15, embers: .25, spores: .5, none: 1 }[weather] * { night: 1, dusk: .55, blood: .8, aurora: .9, dawn: .3, plain: .75 }[moodKey] * 100) / 100;
  bio.aurora = moodKey === 'aurora' ? rng.range(.7, 1.1) : moodKey === 'night' && (A.key === 'frost' || weather === 'snow') ? .3 : 0;
  if (A.tuft) bio.tuft = A.tuft;
  if (A.noRuin) bio.noRuin = 1;
  if (water === 2) { bio.bankGlow = 1; bio.vein = 1; bio.cracks = 1; } else if (D.key === 'ember' && rng() < .5) bio.vein = 1;
  if (weather === 'rain') { bio.wet = [rng.range(.42, .62), rng.range(.1, .16)]; if (rng() < .6) bio.lightning = rng.range(11, 20); }
  if (sea) { bio.sea = sea; bio.seaCol = [.008, .02, .026, .4, .46, .5].map((v, k) => v * wTint[k % 3]); if (A.lighthouse) bio.lighthouse = 1; if (weather === 'rain') bio.lightning = rng.range(9, 16); if (water === 4) bio.wat[0] = 4; }
  PROC.cache.set(id, bio);
  if (PROC.cache.size > 48) PROC.cache.delete(PROC.cache.keys().next().value);
  return bio;
}

// ---- The donor's props on a generated land: a lighter scattering on top of the base land's dress.
const PROC_ACCENT = {
  ashen(X) { for (let k = 0; k < 2; k++) X.drop(T => PROP.log(T, X.rng), .9, { far: 1.2 }); X.drop(T => PROP.ribcage(T, X.rng), 2.2, { far: 2.6 }); },
  frost(X) { const { rng, drop } = X; for (let k = 0; k < 4; k++) drop(T => PROP.crystal(T, rng, COL.ice, .03), .5, { far: 1 }); },
  fen(X) {
    const { B, rng, drop } = X, sh = [];
    for (let k = 0; k < 9; k++) { const p = drop(T => PROP.shroom(T, rng), .35, { ao: null }); if (p) sh.push(p); }
    for (const q of B.ponds) for (let k = 0; k < 5; k++) { const a = rng() * TAU, d = q.r * rng.range(.8, 1.2); X.at(q.x + Math.cos(a) * d, q.z + Math.sin(a) * d, T => PROP.reeds(T, rng), 0); }
    if (sh[0] && B.env.length < 3) B.env.push({ x: sh[0][0], y: X.H(sh[0][0], sh[0][1]) + .7, z: sh[0][1], c: B.bio.wispHex || 0x45e0b8, I: 5, d: 6 });
  },
  ember(X) { const { B, rng, drop } = X, cols = B.bio.strata.map(h => C(h)); for (let k = 0; k < 4; k++) drop(T => PROP.basalt(T, rng), 1.0, { far: 1.4 }); for (let k = 0; k < 2; k++) { const hh = rng.range(1.8, 3.4); drop(T => PROP.spire(T, rng, hh, cols), hh * .28, { far: 1.6, steep: true }); } },
  dunes(X) {
    const { B, rng, drop } = X, cols = B.bio.strata.map(h => C(h));
    for (let k = 0; k < 3; k++) { const hh = rng.range(2, 3.8); drop(T => PROP.spire(T, rng, hh, cols), hh * .28, { far: 1.6, steep: true }); }
    for (const pad of B.pads) { if (rng() < .7) continue; const a = rng() * TAU, x = pad.x + Math.cos(a) * 2.3, z = pad.z + Math.sin(a) * 2.3; if (X.free(x, z, .5, .3)) X.at(x, z, T => PROP.jar(T, rng), .6); }
  },
  storm(X) { const { rng, drop } = X; for (let k = 0; k < 4; k++) drop(T => PROP.driftwood(T, rng), 1.0, { far: 1.0 }); for (let k = 0; k < 5; k++) { const r = rng.range(.3, .7); drop(T => PROP.barnRock(T, rng, r), r * .9, { steep: true, roadMin: .3 }); } },
};
