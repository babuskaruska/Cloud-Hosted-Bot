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
  if (j < n) { const b = BIOMES[(j % n + n) % n]; return nightOn() ? nightBiome(b) : b; } // Act II: the land by night (36-night.js)
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
  ashen: { pre: ['Tuha', 'Halli', 'Hämara', 'Kääpa', 'Ronga'], place: ['Kuru', 'Lohk', 'Kalme', 'Kalju', 'Küngas'], adj: ['Tuhkne', 'Õõnes', 'Hall'] },
  frost: { pre: ['Külma', 'Härma', 'Talve', 'Jää', 'Lume'], place: ['Mägi', 'Tipp', 'Kindlus', 'Kosk', 'Kõrgustik'], adj: ['Jäine', 'Vaikne', 'Härmas'] },
  fen: { pre: ['Soo', 'Raba', 'Sambla', 'Roo', 'Mäda'], place: ['Soo', 'Raba', 'Laugas', 'Mülgas', 'Õõtsik'], adj: ['Nutev', 'Uppunud', 'Mädanev'] },
  ember: { pre: ['Söe', 'Tule', 'Räbu', 'Suitsu', 'Kuuma'], place: ['Arm', 'Kraater', 'Lõhe', 'Sepikoda', 'Kõnnumaa'], adj: ['Põlev', 'Kõrbenud', 'Hõõguv'] },
  dunes: { pre: ['Õhtu', 'Liiva', 'Päikse', 'Tolmu', 'Luu'], place: ['Plato', 'Stepp', 'Tasandik', 'Luide', 'Kõrb'], adj: ['Pleekinud', 'Unustatud', 'Maetud'] },
  storm: { pre: ['Tormi', 'Tuule', 'Soola', 'Vraki', 'Mõõna'], place: ['Neem', 'Rand', 'Pank', 'Nukk', 'Kallas'], adj: ['Uppunud', 'Ulguv', 'Tuuline'] },
};
const MOOD_W = { night: ['Tähetu', 'Valgusetu', 'Must'], dusk: ['Hämar', 'Tuhmuv', 'Kuldne'], blood: ['Verine', 'Veritsev', 'Punane'], aurora: ['Kumav', 'Looritatud', 'Helkiv'], dawn: ['Kahvatu', 'Kahanev', 'Vaikiv'], plain: ['Kadunud', 'Viimane', 'Nimetu'] };
const MOOD_N = { night: 'Pika Pimeduse', dusk: 'Viimase Valguse', blood: 'Punase Kuu', aurora: 'Rohelise Loori', dawn: 'Kahvatu Koidu', plain: 'Õõnsuse' };
const WX_W = { rain: ['Nutev', 'Uppunud'], snow: ['Jäätunud', 'Valge'], ash: ['Tuhkne', 'Lämbunud'], embers: ['Põlev', 'Hõõguv'], spores: ['Närtsinud', 'Sosistav'], sand: ['Kulunud', 'Rändav'], none: ['Vaikne', 'Tasane'] };
const PLACE_ANY = ['Lohk', 'Org', 'Neem', 'Sügavik', 'Kalme', 'Nõmm', 'Kindlus', 'Värav', 'Mägi', 'Ase', 'Vahitorn', 'Piirimaa'];
const SYL = [['Ka', 'Vaa', 'Mõr', 'I', 'Se', 'Tra', 'A', 'Tuu', 'Ü', 'Ko', 'Mää', 'Bra', 'E', 'Ru', 'Ve', 'O', 'Ha', 'Ga', 'Ne', 'Ti', 'Lo', 'Ul'],
  ['', '', 'r', 'l', 'ht', 'n', 'v', 'dr', 'sk', 'rv', 'lm', 'nd'], ['el', 'arn', 'oo', 'un', 'eti', 'ae', 'vun', 'is', 'ohk', 'a', 'elm', 'ar', 'en', 'ist', 'ra', 'os']];
function procProper(rng) { let s = rng.pick(SYL[0]) + rng.pick(SYL[1]) + rng.pick(SYL[2]); if (s.length < 4) s += rng.pick(['n', 't', 'r', 'l']); return s; }
// A made-up name in the genitive ('Mõrvela', 'Kaskeli'), for 'Kaskeli Hall Kuru'.
const procGen = s => /[aeiouõäöü]$/.test(s) ? s : s + 'i';
function procName(rng, base, donor, mood, weather) {
  const A = NAMEW[base], D = NAMEW[donor], adjs = [...MOOD_W[mood], ...(WX_W[weather] || []), ...A.adj];
  const kind = rng();
  if (kind < .3) { const ad = rng.pick(adjs), pl = rng.pick(A.place); return procGen(procProper(rng)) + ' ' + ad + ' ' + pl; }
  if (kind < .55) {
    let p1 = rng.pick(A.pre), p2 = rng.pick(D.pre); if (p1 === p2) p2 = rng.pick(D.place);
    return p1 + p2.toLowerCase() + ' ' + rng.pick(PLACE_ANY);
  }
  if (kind < .72) return procGen(procProper(rng)) + ' ' + rng.pick([...A.place, ...PLACE_ANY]);
  if (kind < .87) return MOOD_N[mood] + ' ' + rng.pick(A.place);
  return rng.pick(adjs) + ' ' + rng.pick([...A.place, ...D.place]);
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
  // The Hollow Herald (Long Night only): on about one generated land in three from land 8 on, it takes the boss slot
  // bossType() will pick. Its own random stream, so the rest of the land is the same with or without it.
  if (typeof MON !== 'undefined' && MON.herald && i >= 7) { const hr = makeRng(Math.imul(seed + 4241, 0x2C1B3C6D) ^ Math.imul(i + 59, 0x297A2D39)); hr(); if (hr() < .34) boss[Math.floor(i / NB) % boss.length] = 'herald'; }
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
  { const ps = procSets(seed, i); bio.sets = ps.sets; bio.skip = ps.skip; } // set pieces (own random stream)
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

// ---- Set pieces for generated lands (round 9): each generated land gets two of these on top of its dress, and
// leaves out two of the common props (bio.skip), so consecutive lands of The Long Night look clearly different.
// The sets go round a shuffled cycle of all of them (procSets), two per land, so neighbours never share one.
const PROC_SET_KEYS = ['standing', 'battlefield', 'lanterns', 'fallenKing', 'titanBones', 'camp', 'obelisks',
  'gallows', 'shrine', 'bell', 'crystals', 'cairns', 'catapult', 'arch', 'greatTree', 'crypt']; // 16 sets, 2 a land: a cycle of 8 lands
const PROC_SKIP_KEYS = ['well', 'statue', 'ribcage', 'walls', 'graveyard', 'carts'];
// Each cycle of 8 lands is its own shuffle (seeded by the cycle), and the sets that closed the cycle before (its
// last three lands) go to the end of the next, so a long run keeps finding the sets in new pairings.
function procSetCycle(seed, c) {
  const r = makeRng(Math.imul(seed + 31, 0x5BD1E995) ^ 0x7F4A7C15 ^ Math.imul(c, 0x2545F491)), n = PROC_SET_KEYS.length, p = PROC_SET_KEYS.slice();
  for (let j = n - 1; j > 0; j--) { const q = Math.floor(r() * (j + 1)), t = p[j]; p[j] = p[q]; p[q] = t; }
  if (c > 0) { const prev = procSetCycle(seed, c - 1).slice(-6); return p.filter(k => !prev.includes(k)).concat(p.filter(k => prev.includes(k))); }
  return p;
}
function procSets(seed, i) {
  const n = PROC_SET_KEYS.length, k = Math.max(0, i - BIOMES.length) * 2, p = procSetCycle(seed, Math.floor(k / n));
  const r2 = makeRng(Math.imul(seed + 13, 0x27D4EB2F) ^ Math.imul(i + 7, 0x165667B1)), sk = PROC_SKIP_KEYS.slice();
  const skip = {}; for (let j = 0; j < 2; j++) skip[sk.splice(Math.floor(r2() * sk.length), 1)[0]] = 1;
  return { sets: [p[k % n], p[(k + 1) % n]], skip };
}
// A big set piece that must not be skipped on a crowded land: try as asked, then nearer the road and on steeper
// ground, then a little smaller (the common props it would crowd out are placed after it).
function dropBig(X, build, r, o = {}) {
  return X.drop(build, r, o) || X.drop(build, r, Object.assign({}, o, { far: (o.far || 0) * .5, maxSlope: .5 })) ||
    X.drop(build, r * .8, Object.assign({}, o, { far: 0, maxSlope: .6, s: (o.s || 1) * .82 }));
}
const PROC_SETS = {
  // A ring of standing stones (a few fallen) round a low altar with a dull red seam.
  standing(X) {
    const { rng } = X;
    for (let n = 0, nn = rng.int(1, 2); n < nn; n++) (n ? X.drop : (b, r, o) => dropBig(X, b, r, o))(T => {
      const k = rng.int(6, 9), R = rng.range(1.6, 2.1);
      for (let i = 0; i < k; i++) {
        if (rng() < .12) continue;
        const a = i / k * TAU + rng.range(-.1, .1), h = rng.range(1.1, 2.1), c = mixC(COL.stoneD, COL.stone, rng() * .6), x = Math.cos(a) * R, z = Math.sin(a) * R;
        if (rng() < .2) T.box(.42, .3, h * .9, x * 1.15, .14, z * 1.15, c, { l: L_ROCK, r: [0, -a + rng.range(-.4, .4), 0] });
        else T.box(.45, h, .3, x, h / 2 - .12, z, c, { l: L_ROCK, r: [rng.range(-.08, .08), -a + HPI, rng.range(-.08, .08)], grad: [-h / 2, h * .2, .7] });
      }
      T.box(1.1, .35, .7, 0, .17, 0, mulC(COL.stoneD, .9), { l: L_MASON }); T.box(.06, .02, .5, 0, .355, 0, [.7, .1, .05], { emis: .25, jit: 0 });
    }, 2.6, { far: 2.2 });
  },
  // An old battlefield: spears and swords standing in the ground, dropped shields, skulls.
  battlefield(X) {
    const { rng, drop } = X;
    for (let n = 0; n < 5; n++) drop(T => {
      for (let i = 0, m = rng.int(3, 6); i < m; i++) {
        const x = rng.range(-.7, .7), z = rng.range(-.7, .7), r = [rng.range(-.35, .35), rng() * TAU, rng.range(-.35, .35)];
        if (rng() < .55) { const h = rng.range(1.3, 2); T.cyl(.025, h, x, h / 2 - .25, z, COL.woodD, { n: 4, l: L_WOOD, r }); }
        else { const h = rng.range(.7, 1.1); T.box(.08, h, .016, x, h / 2 - .15, z, COL.steel, { l: L_METAL, rough: .4, r }); T.box(.26, .04, .04, x, h - .2, z, COL.iron, { l: L_METAL, r }); }
      }
      if (rng() < .75) T.cyl(.3, .045, rng.range(-.4, .4), .03, rng.range(-.4, .4), mulC(rng() < .5 ? COL.clothR : COL.clothB, .8), { n: 8, l: L_WOOD, r: [rng.range(-.2, .2), 0, rng.range(-.2, .2)] });
      if (rng() < .6) PROP.skull(T, rng.range(-.5, .5), .08, rng.range(-.5, .5), .12, rng() * TAU);
    }, .9, { far: 1.0 });
  },
  // The keepers' old lanterns along the road, cold now; one in three still holds an ember. Some have fallen.
  lanterns(X) {
    const { rng, drop, beside, B } = X;
    for (let k = 0; k < 7; k++) {
      const p = beside(6, B.L - 6, .95, .35); if (!p) continue;
      const fallen = rng() < .28, lit = rng() < .35;
      drop(T => {
        T.box(.16, .22, .16, 0, .11, 0, COL.stoneD, { l: L_MASON }); T.cyl(.04, 2.1, 0, 1.15, 0, COL.iron, { n: 5, l: L_METAL });
        T.box(.5, .04, .04, .2, 2.15, 0, COL.iron, { l: L_METAL }); T.box(.04, .12, .04, .42, 2.08, 0, COL.iron, { l: L_METAL });
        T.box(.22, .3, .22, .42, 1.87, 0, mulC(COL.iron, .8), { l: L_METAL }); T.cone(.17, .14, .42, 2.08, 0, COL.iron, { n: 4, l: L_METAL, r: [0, PI / 4, 0] });
        T.box(.15, .2, .15, .42, 1.87, 0, lit ? [1, .45, .12] : [.06, .05, .05], lit ? { emis: .5, jit: 0 } : { jit: 0 });
      }, .45, fallen ? { at: p, r: [0, -p[2] + rng.range(-.6, .6), 1.45], dy: .12 } : { at: p, ry: -p[2] + (p[3] > 0 ? PI : 0) });
    }
  },
  // A fallen king of stone: a great crowned head lying on its side, half sunk, and a broken hand.
  fallenKing(X) {
    const { rng } = X, drop = (b, r, o, big) => big ? dropBig(X, b, r, o) : X.drop(b, r, o), c = mixC(COL.stone, COL.stoneL, .25), cd = mulC(c, .7);
    drop(T => {
      T.sph(.95, 0, 1, 0, c, { l: L_ROCK, sc: [.92, 1.15, .95], smooth: false, w: 9, h: 7 });
      T.box(.95, .16, .3, 0, 1.35, .72, c, { l: L_ROCK }); T.box(.16, .45, .22, 0, 1.0, .9, c, { l: L_ROCK });
      for (const s of [-1, 1]) T.box(.22, .1, .1, s * .3, 1.2, .86, COL.black, { jit: 0 });
      T.box(.5, .07, .1, 0, .62, .82, cd, { l: L_ROCK });
      T.cyl(.82, .3, 0, 1.95, 0, mulC(COL.brass, .6), { n: 9, l: L_METAL, rough: .6 });
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; T.cone(.13, .45, Math.cos(a) * .72, 2.3, Math.sin(a) * .72, mulC(COL.brass, .6), { n: 4, l: L_METAL, rough: .6 }); }
      for (let i = 0; i < 5; i++) { const a = rng() * TAU; T.rock(rng.range(.2, .4), Math.cos(a) * 1.1, .1, Math.sin(a) * 1.1, mixC(COL.stoneD, c, rng())); }
    }, 1.9, { far: 2.4, r: [0, rng() * TAU, 1.25], dy: -.35 }, X);
    drop(T => {
      T.box(.9, .32, .7, 0, .16, 0, c, { l: L_ROCK });
      for (let i = 0; i < 4; i++) { const h = rng.range(.5, .95); T.cyl(.11, h, -.33 + i * .22, .3 + h / 2, .2, c, { n: 6, l: L_ROCK, r: [rng.range(-.5, .1), 0, rng.range(-.15, .15)] }); }
      T.cyl(.12, .55, .5, .3, -.1, c, { n: 6, l: L_ROCK, r: [0, 0, -1] });
    }, 1.0, { far: 2.0 });
  },
  // The bones of something huge: a horned skull with its jaw in the dirt and a long curl of spine and ribs.
  titanBones(X) {
    const { rng } = X, drop = (b, r, o) => dropBig(X, b, r, o), b = COL.bone, bd = COL.boneD;
    drop(T => {
      T.sph(.85, 0, .62, 0, b, { l: L_BONE, sc: [1.05, .8, 1.25], smooth: false, w: 8, h: 6 });
      for (const s of [-1, 1]) { T.sph(.2, s * .36, .78, .82, COL.black, { jit: 0 }); T.cone(.18, 1.3, s * .85, 1.2, -.15, bd, { n: 5, l: L_BONE, r: [0, 0, -s * .85] }); }
      T.box(1.1, .18, .75, 0, .1, .85, mulC(b, .85), { l: L_BONE, r: [.15, 0, 0] });
      for (let i = 0; i < 6; i++) T.cone(.06, .2, -.45 + i * .18, .25, 1.15, b, { n: 4, r: [PI, 0, 0] });
      let x = -1.1, z = 0, a = PI;
      for (let i = 0; i < 9; i++) {
        a += rng.range(-.25, .35); x += Math.cos(a) * .42; z += Math.sin(a) * .42;
        T.cyl(.17 - i * .008, .22, x, .14, z, mulC(b, .9), { n: 6, l: L_BONE, r: [0, -a, HPI] });
        if (i % 2 === 0 && i < 8) for (const s of [-1, 1]) { const nx = -Math.sin(a) * s, nz = Math.cos(a) * s; T.seg([x, .2, z], [x + nx * .7, .75 - i * .03, z + nz * .7], .06, .7, b, { l: L_BONE }); T.seg([x + nx * .7, .75 - i * .03, z + nz * .7], [x + nx * 1.05, .02, z + nz * 1.05], .045, .6, bd, { l: L_BONE }); }
      }
    }, 3.0, { far: 2.6 });
  },
  // An abandoned camp: tents, a cold fire ring, crates and a barrel.
  camp(X) {
    const { rng } = X, drop = (b, r, o) => dropBig(X, b, r, o);
    drop(T => {
      for (let i = 0, n = rng.int(2, 3); i < n; i++) {
        const a = i * 2.2 + rng() * .5, x = Math.cos(a) * 1.35, z = Math.sin(a) * 1.35, cc = mulC(rng() < .3 ? COL.clothR : COL.clothT, .6 + .3 * rng()), tall = rng.range(1.0, 1.35);
        T.cone(.8, tall, x, tall / 2, z, cc, { n: 4, l: L_CLOTH, r: [0, -a + PI / 4, rng() < .3 ? .12 : 0] }); T.cyl(.03, tall + .25, x, (tall + .25) / 2, z, COL.woodD, { n: 4, l: L_WOOD });
      }
      for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; T.rock(.13, Math.cos(a) * .42, .05, Math.sin(a) * .42, mixC(COL.stoneD, COL.stone, rng())); }
      T.cyl(.3, .03, 0, .02, 0, [.05, .04, .04], { n: 8, jit: 0 }); for (const r of [.5, -.7]) T.box(.6, .08, .08, 0, .07, 0, mulC(COL.bark, .5), { l: L_WOOD, r: [0, r, 0] });
      PROP.crate(T, .2, 0, -1.05, .45, rng, rng()); PROP.barrel(T, -.35, 0, -1.0, .9, rng);
    }, 2.4, { far: 2.0 });
  },
  // Black obelisks with runes that still glow faintly in the land's own colour.
  obelisks(X) {
    const { rng, drop, B } = X, rc = C(B.bio.wispHex || 0x70ffb0);
    for (let k = 0, n = rng.int(3, 5); k < n; k++) drop(T => {
      const h = rng.range(2.3, 3.6), c = mulC(COL.basaltL, .9 + .2 * rng());
      T.box(.8, .3, .8, 0, .15, 0, COL.stoneD, { l: L_MASON });
      T.cyl(.32, h, 0, .3 + h / 2, 0, c, { n: 4, rt: .6, l: L_ROCK, r: [0, PI / 4, 0] }); T.cone(.193, .42, 0, .3 + h + .21, 0, c, { n: 4, l: L_ROCK, r: [0, PI / 4, 0] });
      for (let j = 0; j < 4; j++) { const y = .75 + j * (h - .7) / 4, u = (y - .3) / h, f = lerp(.226, .136, u) + .008; T.box(.09, .15, .015, 0, y, f, rc, { emis: .35, jit: 0 }); if (rng() < .5) T.box(.015, .15, .09, f, y + .1, 0, rc, { emis: .35, jit: 0 }); }
    }, .65, { far: 1.4 });
  },
  // ---- Round 10: nine more, so the cycle runs 8 lands before a set comes back. ----
  // A gibbet: a gallows beam with an empty iron cage, a noose, a ladder against the post.
  gallows(X) {
    const { rng } = X;
    dropBig(X, T => {
      const w = COL.woodD, h = 2.6;
      T.box(1.6, .2, 1.0, 0, .1, 0, mulC(COL.woodD, .85), { l: L_WOOD });
      for (const sx of [-.6, .6]) T.box(.16, h, .16, sx, .2 + h / 2, 0, w, { l: L_WOOD });
      T.box(1.6, .16, .18, 0, h + .25, 0, w, { l: L_WOOD }); T.seg([-.6, 1.7, 0], [-.2, h + .2, 0], .05, .05, w, { l: L_WOOD, n: 4 });
      T.cyl(.012, .6, .35, h - .05, 0, COL.rope, { n: 3 });
      T.cyl(.2, .55, .35, h - .62, 0, COL.iron, { n: 6, open: true, l: L_METAL, r: [.12, 0, .08] }); T.cone(.21, .16, .35, h - .27, 0, COL.iron, { n: 6, l: L_METAL });
      PROP.skull(T, .35, h - .82, 0, .09, rng() * TAU);
      T.cyl(.012, .8, -.25, h - .2, 0, COL.rope, { n: 3 }); T.cyl(.08, .04, -.25, h - .62, 0, COL.rope, { n: 6, r: [HPI, 0, 0] });
      T.seg([.95, .2, .3], [.62, 2.0, .1], .03, .03, COL.wood, { l: L_WOOD, n: 4 }); T.seg([1.15, .2, .3], [.82, 2.0, .1], .03, .03, COL.wood, { l: L_WOOD, n: 4 });
      for (let i = 0; i < 4; i++) T.box(.24, .03, .03, .89, .5 + i * .4, .2, COL.wood, { l: L_WOOD });
    }, 1.5, { far: 2.2 });
  },
  // Wayside shrines: little slate-roofed niches with a hooded figure and candles still burning before it.
  shrine(X) {
    const { rng } = X;
    for (let n = 0; n < 2; n++) (n ? X.drop : (b, r, o) => dropBig(X, b, r, o))(T => {
      T.box(1.0, .2, .8, 0, .1, 0, COL.stoneD, { l: L_MASON });
      for (const sx of [-.38, .38]) T.box(.14, 1.1, .5, sx, .75, -.05, COL.stone, { l: L_MASON });
      T.box(.9, .12, .6, 0, 1.36, -.05, COL.stoneD, { l: L_MASON });
      for (const s2 of [-1, 1]) T.box(.62, .07, .78, s2 * .24, 1.55, -.05, COL.slate, { l: L_SLATE, r: [0, 0, -s2 * .62] });
      T.cone(.22, .62, 0, .51, -.12, mulC(COL.stoneL, .9), { n: 6, l: L_ROCK }); T.sph(.11, 0, .9, -.12, COL.stoneL, { l: L_ROCK });
      for (let i = 0; i < 5; i++) { const x = rng.range(-.35, .35), z = rng.range(.22, .36), h = rng.range(.08, .2); T.cyl(.025, h, x, .2 + h / 2, z, COL.bone, { n: 4 }); T.box(.03, .05, .03, x, .2 + h + .03, z, [1, .55, .18], { emis: .6, jit: 0 }); }
    }, 1.0, { near: 4, far: 1.0 });
  },
  // A great bronze bell fallen from a tower long gone: tipped on its side and half sunk, its beam and rubble near.
  bell(X) {
    const { rng } = X, c = mixC(COL.bronze, [.18, .3, .25], .35);
    dropBig(X, T => {
      T.cyl(1.0, 1.7, 0, .85, 0, c, { n: 10, rt: .62, l: L_METAL, rough: .5 }); T.cyl(1.1, .2, 0, .1, 0, mulC(c, .85), { n: 10, l: L_METAL, rough: .5 });
      T.sph(.62, 0, 1.7, 0, c, { l: L_METAL, sc: [1, .45, 1], w: 10, h: 5 }); T.cyl(.13, .35, 0, 2.0, 0, mulC(c, .8), { n: 6, rz: .3, l: L_METAL, r: [HPI, 0, 0] });
      for (let i = 0; i < 3; i++) T.cyl(1.02 - i * .07, .05, 0, .4 + i * .42, 0, mulC(c, 1.25), { n: 10, l: L_METAL, rough: .4 });
      T.box(.12, 1.0, .12, 0, .5, 0, mulC(c, .5), { l: L_METAL });
    }, 2.0, { far: 2.2, r: [0, rng() * TAU, 1.95], dy: -.45 });
    X.drop(T => { T.box(3.2, .28, .3, 0, .14, 0, COL.woodD, { l: L_WOOD, r: [0, 0, .05] }); for (let i = 0; i < 4; i++) T.rock(rng.range(.2, .35), rng.range(-1.4, 1.4), .1, rng.range(-.5, .5), mixC(COL.stoneD, COL.stone, rng())); }, 1.6, { far: 1.4 });
  },
  // Crystals pushing up through the ground, lit from inside in the land's own colour.
  crystals(X) {
    const { rng, B } = X, rc = C(B.bio.wispHex || 0x70ffb0), cc = mixC(rc, COL.crystal, .45);
    for (let k = 0, n = rng.int(3, 4); k < n; k++) (k ? X.drop : (b, r, o) => dropBig(X, b, r, o))(T => {
      for (let i = 0, m = rng.int(4, 7); i < m; i++) {
        const a = rng() * TAU, d = i ? rng.range(.15, .5) : 0, h = i ? rng.range(.5, 1.1) : rng.range(1.3, 1.9);
        T.cyl(h * .2, h, Math.cos(a) * d, h / 2 - .1, Math.sin(a) * d, cc, { n: 5, rt: .15, l: L_PLAIN, emis: .16, r: [rng.range(-.4, .4) * (i ? 1 : .3), rng() * TAU, rng.range(-.4, .4) * (i ? 1 : .3)] });
      }
      T.rock(.35, .3, .05, .25, COL.stoneD); T.rock(.3, -.32, .05, -.18, COL.basaltL);
    }, .9, { far: 1.2 });
  },
  // Cairns of stacked stones on the high ground; some carry a rag on a stick.
  cairns(X) {
    const { rng } = X;
    for (let k = 0, n = rng.int(5, 7); k < n; k++) (k ? X.drop : (b, r, o) => dropBig(X, b, r, o))(T => {
      let y = 0; for (let i = 0, m = rng.int(3, 6); i < m; i++) { const r = .36 - i * .05; T.rock(r, rng.range(-.04, .04), y + r * .55, rng.range(-.04, .04), mixC(COL.stoneD, COL.stoneL, rng() * .7)); y += r * 1.0; }
      if (rng() < .45) { T.cyl(.02, .8, .05, y + .3, 0, COL.woodD, { n: 4, l: L_WOOD }); T.box(.02, .22, .16, .05, y + .56, .09, mulC(rng() < .5 ? COL.clothR : COL.clothT, .7), { l: L_CLOTH, sway: .6 }); }
    }, .55, { far: 1.6 });
  },
  // A wrecked siege engine: a catapult tipped on its side, its arm snapped, stone shot spilt around it.
  catapult(X) {
    const { rng } = X, w = COL.wood, wd = COL.woodD;
    dropBig(X, T => {
      for (const sz of [-.55, .55]) { T.box(2.2, .18, .18, 0, .35, sz, w, { l: L_WOOD }); T.seg([-.6, .35, sz], [0, 1.35, sz * .6], .08, .08, wd, { l: L_WOOD, n: 4 }); T.seg([.6, .35, sz], [0, 1.35, sz * .6], .08, .08, wd, { l: L_WOOD, n: 4 }); }
      for (const sx of [-.85, .85]) { T.box(.16, .16, 1.3, sx, .35, 0, w, { l: L_WOOD }); for (const sz of [-.68, .68]) T.cyl(.34, .1, sx, .34, sz, wd, { n: 8, l: L_WOOD, r: [HPI, 0, 0] }); }
      T.cyl(.12, 1.3, 0, 1.35, 0, wd, { n: 6, l: L_WOOD, r: [HPI, 0, 0] });
      T.box(.16, .16, 1.5, 0, 1.6, -.6, w, { l: L_WOOD, r: [-.9, 0, 0] }); T.box(.13, .13, 1.0, .3, .1, 1.5, w, { l: L_WOOD, r: [0, .5, 0] });
      for (let i = 0; i < 5; i++) T.sph(rng.range(.15, .22), rng.range(-1.3, 1.3), .14, rng.range(1.0, 1.8) * (i & 1 ? 1 : -1), COL.stoneD, { l: L_ROCK, w: 6, h: 4 });
    }, 2.0, { far: 2.0, r: [0, rng() * TAU, .22] });
  },
  // A ruined gate arch standing alone; one leg has fallen into a heap of blocks.
  arch(X) {
    const { rng } = X, c = mixC(COL.stone, COL.stoneD, .4);
    dropBig(X, T => {
      for (const sx of [-1.1, 1.1]) for (let j = 0; j < 5; j++) { if (sx > 0 && j > 2) break; T.box(.62, .5, .62, sx + rng.range(-.03, .03), .25 + j * .5, 0, mixC(c, COL.stoneL, rng() * .3), { l: L_MASON }); }
      for (let i = 0; i < 4; i++) { const a = PI - (i + .5) / 8 * PI, x = Math.cos(a) * 1.1, y = 2.5 + Math.sin(a) * .9; T.box(.55, .42, .6, x, y, 0, mixC(c, COL.stoneL, rng() * .3), { l: L_MASON, r: [0, 0, a - HPI] }); }
      for (let i = 0; i < 6; i++) T.box(rng.range(.4, .6), .4, rng.range(.4, .6), 1.5 + rng.range(-.3, .8), .2, rng.range(-.7, .7), mixC(c, COL.stoneD, rng()), { l: L_MASON, r: [rng.range(-.3, .3), rng() * TAU, rng.range(-.3, .3)] });
    }, 2.0, { far: 1.8 });
  },
  // A great dead tree with roots like claws, hollow at the foot; an old lantern still hangs from a branch.
  greatTree(X) {
    const { rng } = X;
    dropBig(X, T => {
      PROP.tree(T, rng, 5.2);
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + rng.range(-.2, .2); T.seg([Math.cos(a) * .25, .5, Math.sin(a) * .25], [Math.cos(a) * 1.3, -.05, Math.sin(a) * 1.3], .2, .05, COL.bark, { l: L_WOOD, n: 5 }); }
      T.box(.3, .45, .1, 0, .3, .33, COL.black, { jit: 0 });
      T.cyl(.01, .5, 1.1, 2.55, 0, COL.iron, { n: 3 }); T.box(.16, .22, .16, 1.1, 2.2, 0, COL.iron, { l: L_METAL }); T.box(.1, .14, .1, 1.1, 2.2, 0, [1, .5, .15], { emis: .55, jit: 0 });
    }, 2.2, { far: 2.6 });
  },
  // A keepers' crypt: a low mausoleum with its iron door torn open, and stone coffins with their lids pushed aside.
  crypt(X) {
    const { rng } = X, c = mixC(COL.stoneD, COL.stone, .5);
    dropBig(X, T => {
      T.box(2.0, 1.4, 1.6, 0, .7, 0, c, { l: L_MASON }); T.box(2.3, .2, 1.9, 0, 1.5, 0, COL.stoneD, { l: L_MASON });
      T.cone(1.3, .7, 0, 1.95, 0, COL.slate, { n: 4, l: L_SLATE, r: [0, PI / 4, 0] });
      T.box(.6, .9, .06, 0, .45, .81, COL.black, { jit: 0 }); T.box(.32, .85, .07, .45, .42, 1.0, COL.iron, { l: L_METAL, r: [0, .9, 0] });
      for (const sx of [-.8, .8]) T.box(.25, 1.6, .25, sx, .8, .82, COL.stone, { l: L_MASON });
      PROP.skull(T, -.4, .1, 1.05, .1, rng() * TAU);
    }, 1.8, { far: 2.4 });
    for (let k = 0; k < 2; k++) X.drop(T => {
      T.box(.7, .5, 1.5, 0, .25, 0, c, { l: L_MASON });
      T.box(.76, .12, 1.56, .25, .58, .1, mixC(c, COL.stoneL, .3), { l: L_MASON, r: [0, .35, .12] });
    }, .95, { far: 1.6 });
  },
};
