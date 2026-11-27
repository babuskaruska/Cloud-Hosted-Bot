
const G = {
  B: null, t: 0, gold: 0, lives: 20, maxLives: 20, wave: 0, slain: 0, level: 0, run: 1,
  towers: [], mons: [], men: [], arrows: [], shells: [], stuck: [], hbars: [], phase: 'play',
};
const TOWER = {
  archer: { name: 'Archer tower', short: 'Archers', icon: 'archer', cost: [70, 90, 140], range: [6.2, 6.8, 7.4], dmg: [9, 11, 14], rate: [.85, .78, .7], n: [1, 2, 3], air: true, ground: true, light: [80, 105, 140], desc: ['Fast flaming arrows.', 'Can hit flyers.'] },
  bombard: { name: 'Bombard', short: 'Bombard', icon: 'bombard', cost: [120, 130, 190], range: [7.4, 8.0, 8.6], minRange: 2.3, dmg: [36, 60, 98], splash: [1.55, 1.8, 2.1], rate: [2.9, 2.7, 2.5], air: false, ground: true, light: [50, 62, 80], desc: ['Slow shells that burst.', 'Ground targets only.'] },
  spire: { name: 'Storm spire', short: 'Spire', icon: 'spire', cost: [110, 120, 180], range: [5.5, 6.0, 6.5], dmg: [17, 25, 35], jumps: [3, 4, 6], rate: [2.3, 2.1, 1.9], slow: [.36, .42, .48], slowT: [1.3, 1.5, 1.7], air: true, ground: true, light: [16, 20, 26], desc: ['Chain lightning that slows.', 'Can hit flyers.'] },
  guard: { name: 'Guard post', short: 'Guards', icon: 'guard', cost: [80, 90, 150], range: [3.4, 3.7, 4.0], n: [2, 3, 3], hp: [62, 90, 135], dmg: [7, 10, 15], rate: [7, 6, 5], air: false, ground: true, light: [55, 70, 90], desc: ['Footmen who block', 'and duel on the road.'] },
};
// Branches: a max-level tower (lvl 2) can specialise into one of two branches (lvl 3, t.branch).
// Array stats in a branch become index 3 of the tower's own stat arrays (see branchDef); other keys are traits.
// cost is the base price; branchCost() scales it per land. title names the tower once it has the branch.
TOWER.archer.branches = {
  longbow: { name: 'Longbow', title: 'Longbow tower', cost: 240, desc: ['Arrows pierce three foes', 'and punch through armor.'], range: 10.2, dmg: 30, rate: 1.3, n: 2, light: 150, pierce: 3, ap: .85, heavy: true },
  volley: { name: 'Volley', title: 'Volley tower', cost: 220, desc: ['Three arrows per shot,', 'each at its own target.'], range: 7.7, dmg: 12, rate: .8, n: 3, light: 150, multi: 3, airFirst: true },
};
TOWER.bombard.branches = {
  mortar: { name: 'Mortar', title: 'Mortar', cost: 300, desc: ['Huge range. Heavy shells', 'stun the densest crowd.'], range: 13, dmg: 200, splash: 3.0, rate: 4.4, light: 95, minRange: 3.4, stun: .8, dense: true },
  firebomb: { name: 'Firebomb', title: 'Firebomb', cost: 280, desc: ['Shells leave pools of', 'fire that keep burning.'], range: 8.6, dmg: 80, splash: 2.0, rate: 2.4, light: 110, fire: [1.9, 5, 30] },
};
TOWER.spire.branches = {
  tempest: { name: 'Tempest', title: 'Tempest spire', cost: 290, desc: ['More jumps, more damage.', 'Double damage to flyers.'], range: 7.4, dmg: 50, jumps: 9, rate: 1.6, slow: .2, slowT: .8, light: 40, jumpR: 4.2, falloff: .94, airMul: 2, airFirst: true },
  frost: { name: 'Frost', title: 'Frost spire', cost: 270, desc: ['Heavy slow. The first foe', 'hit freezes solid.'], range: 6.8, dmg: 24, jumps: 5, rate: 1.7, slow: .68, slowT: 2.8, light: 30, freeze: 1.1, chill: .3 },
};
TOWER.guard.branches = {
  knights: { name: 'Knights', title: 'Knight hall', cost: 250, desc: ['Two armored knights.', 'Each holds three foes.'], n: 2, hp: 440, dmg: 32, rate: 8, range: 4.2, light: 100, armor: .45, hold: 3 },
  pikes: { name: 'Pikes', title: 'Pike hall', cost: 240, desc: ['Four pikemen strike first', 'and gore big monsters.'], n: 4, hp: 150, dmg: 18, rate: 3.5, range: 4.2, light: 100, reach: .55, bigMul: 2.5 },
};
const BRANCH_KEYS = { archer: ['longbow', 'volley'], bombard: ['mortar', 'firebomb'], spire: ['tempest', 'frost'], guard: ['knights', 'pikes'] };
// The stat table for a tower with a branch: each stat array gains index 3 (the branch value, or the lvl 2 one).
// cost keeps its three entries, so `lvl >= cost.length - 1` still means "maxed".
function branchDef(kind, key) {
  const base = TOWER[kind], b = base.branches[key], d = Object.assign({}, base, { branch: key, bdef: b });
  for (const k in base) if (Array.isArray(base[k]) && base[k].length === 3 && k !== 'cost' && k !== 'desc') d[k] = base[k].concat([b[k] !== undefined ? b[k] : base[k][2]]);
  for (const k in b) if (!Array.isArray(base[k]) && !['name', 'title', 'cost', 'desc'].includes(k)) d[k] = b[k];
  return d;
}
const TOWER_KINDS = ['archer', 'bombard', 'spire', 'guard'];
// Most monsters alive at once. Phones get a smaller crowd.
const MAX_ALIVE = (window.matchMedia && matchMedia('(pointer: coarse)').matches) ? 190 : 260;

// Tower models. Levels 0-2 are the base tower; level 3 is a branch (TOWER branches, round 2 contract):
// archer 'longbow' | 'volley', bombard 'mortar' | 'firebomb', spire 'tempest' | 'frost', guard 'knights' | 'pikes'.
// Besides pieces, a blueprint returns mounts: where the tower's flames, gun, crystal, archers and door sit, and
// for branches its light (intensity, colour), flame colour and crystal/bolt colours. Every per-level table here
// has four entries, so level 3 never reads past the end.
function blueprint(kind, lvl, branch) {
  lvl = clamp(lvl | 0, 0, 3);
  if (lvl === 3 && !(BRANCH_KEYS[kind] || []).includes(branch)) branch = (BRANCH_KEYS[kind] || [])[0];
  const pieces = [], mounts = {};
  const piece = (id, order, fn) => {
    const S = new Soup(); fn(S); if (!S.verts) return; let minY = 1e9; for (let i = 1; i < S.P.length; i += 3) minY = Math.min(minY, S.P[i]);
    for (let i = 1; i < S.P.length; i += 3) S.P[i] -= minY; pieces.push({ id, order, y: minY, soup: S });
  };
  const w = COL.wood, wd = COL.woodD, wl = COL.woodL, st = COL.stone, sdk = COL.stoneD, sl = COL.stoneL, iron = COL.iron, rng = soupRng;
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]], L2 = lvl >= 2;
  const brazier = (S, x, y, z, bs) => {
    for (let k = 0; k < 3; k++) { const a = k * TAU / 3 + .5; S.seg([x + Math.cos(a) * bs * .42, y, z + Math.sin(a) * bs * .42], [x + Math.cos(a) * bs * .2, y + bs * .5, z + Math.sin(a) * bs * .2], .028, .028, iron, { l: L_METAL, n: 4 }); }
    S.cyl(bs * .3, bs * .22, x, y + bs * .56, z, iron, { n: 8, l: L_METAL, rt: 1.5, rough: .6 });
    S.cyl(bs * .4, .04, x, y + bs * .68, z, COL.ember, { n: 8, emis: .55, jit: 0 });
  };
  const banner = (S, x, y, z, ry, wdt, len, col, col2, sway = .9) => { const T = new Soup(); clothPanel(T, { x0: -wdt / 2, x1: wdt / 2, yTop: 0, len, z: 0, col, col2, rng, nx: 3, ny: 5, rag: .15, sway }); S.merge(T, { p: [x, y, z], ry, ao: null }); };
  if (kind === 'archer') {
    const lb = lvl === 3 && branch === 'longbow', vo = lvl === 3 && !lb;
    const bH = [.25, 1.0, 1.9, lb ? 2.75 : 2.1][lvl], H = [2.0, 2.7, 3.35, lb ? 4.3 : 3.55][lvl], W = [.75, .85, .93, vo ? 1.12 : .95][lvl], bs = [.5, .62, .8, vo ? .78 : .92][lvl];
    const green = C(0x2c5634), crim = C(0x8a2420);
    piece('base', 0, S => {
      if (lvl === 0) { S.box(1.6, .25, 1.6, 0, .125, 0, sdk, { l: L_MASON }); for (const [a, b] of corners) S.box(.3, .32, .3, a * .66, .16, b * .66, sl, { l: L_MASON }); }
      else {
        S.box(1.8, .3, 1.8, 0, .15, 0, sdk, { l: L_MASON });
        S.cyl(1.02, bH - .3, 0, .3 + (bH - .3) / 2, 0, st, { n: 4, l: L_MASON, rt: .9, r: [0, PI / 4, 0] });
        S.box(1.42, .14, 1.42, 0, bH - .04, 0, sl, { l: L_MASON });
        S.box(.3, .5, .06, 0, .56, .71, COL.black, { jit: 0 });
        if (lvl === 2) { for (const [a, b] of corners) for (let q = 0; q < 3; q++) S.box(.22, .2, .22, a * (.7 - q * .025), .5 + q * .5, b * (.7 - q * .025), sl, { l: L_MASON }); for (const sg of [-1, 1]) S.box(.06, .5, .12, sg * .7, 1.1, 0, COL.black, { jit: 0 }); }
        if (lvl === 3) {
          const nq = Math.floor((bH - .45) / .45), cr = y => .72 * lerp(1, .9, (y - .3) / (bH - .3)) - .015;
          for (const [a, b] of corners) for (let q = 0; q < nq; q++) { const y = .5 + q * .45; S.box(.22, .2, .22, a * cr(y), y, b * cr(y), (q & 1) ? sl : mixC(sl, sdk, .3), { l: L_MASON }); }
          for (const y of lb ? [1.15, 2.0] : [1.2]) for (const sg of [-1, 1]) { S.box(.06, .46, .12, sg * cr(y) * .98, y, 0, COL.black, { jit: 0 }); S.box(.12, .46, .06, 0, y + .2, -cr(y) * .98, COL.black, { jit: 0 }); }
          S.box(1.56, .16, 1.56, 0, bH - .2, 0, sdk, { l: L_MASON });
          for (let k = 0; k < 4; k++) { const a = k * HPI; for (let j = -2; j <= 2; j++) S.box(.1, .14, .12, Math.sin(a) * .74 + Math.cos(a) * j * .3, bH - .33, Math.cos(a) * .74 - Math.sin(a) * j * .3, sdk, { l: L_MASON, r: [0, a, 0] }); }
          if (lb) { banner(S, 0, bH - .3, .735, 0, .5, 1.25, green, mulC(COL.gold, .7), .25); banner(S, .735, bH - .3, 0, HPI, .5, 1.25, green, mulC(COL.gold, .7), .25); }
        }
      }
    });
    piece('posts', 1, S => {
      for (const [a, b] of corners) S.seg([a * .62, bH, b * .62], [a * (W - .1), H, b * (W - .1)], .085, .075, wd, { l: L_WOOD });
      const ym = (bH + H) / 2, r = lerp(.62, W - .1, .5);
      for (let k = 0; k < 4; k++) { const [a, b] = corners[k], [c, d] = corners[(k + 1) % 4]; S.seg([a * r, ym, b * r], [c * r, ym, d * r], .05, .05, w, { l: L_WOOD, n: 4 }); }
      if (vo) for (const [a, b] of corners) S.seg([a * .7, bH + .05, b * .7], [a * (W + .02), H - .3, b * (W + .02)], .06, .05, wd, { l: L_WOOD, n: 4 });
    });
    piece('brace', 2, S => {
      for (let k = 0; k < 4; k++) { const [a, b] = corners[k], [c, d] = corners[(k + 1) % 4]; S.seg([a * .62, bH + .1, b * .62], [c * (W - .12), H - .15, d * (W - .12)], .035, .035, w, { l: L_WOOD, n: 4 }); S.seg([c * .62, bH + .1, d * .62], [a * (W - .12), H - .15, b * (W - .12)], .035, .035, wl, { l: L_WOOD, n: 4 }); }
    });
    piece('deck', 3, S => {
      S.box(W * 2 + .16, .1, W * 2 + .16, 0, H + .05, 0, w, { l: L_WOOD }); for (const sg of [-1, 1]) S.box(W * 2 + .3, .09, .1, 0, H - .04, sg * (W - .1), wd, { l: L_WOOD });
      for (const sg of [-1, 1]) S.box(.1, .09, W * 2 + .3, sg * (W - .1), H - .04, 0, wd, { l: L_WOOD });
      if (lvl >= 1) for (const [a, b] of corners) S.seg([a * (W - .1), H - .55, b * (W - .1)], [a * (W + .06), H - .02, b * (W + .06)], .04, .04, wd, { l: L_WOOD, n: 4 });
    });
    piece('rail', 4, S => {
      const y0 = H + .1;
      for (let k = 0; k < 4; k++) {
        const ang = k * HPI, cs = Math.cos(ang), sn = Math.sin(ang);
        for (let j = 0; j < 5; j++) {
          if (k === 2 && (j === 1 || j === 2)) continue;
          const u = (j - 2) * W * .42, hh = (j & 1) ? .34 : .5, x = u * cs + (W + .02) * sn, z = -u * sn + (W + .02) * cs;
          S.box(W * .4, hh, .06, x, y0 + hh / 2, z, (j & 1) ? w : wl, { l: L_WOOD, r: [0, ang, 0] });
        }
      }
      for (const [a, b] of corners) S.box(.1, .66, .1, a * (W + .02), y0 + .33, b * (W + .02), wd, { l: L_WOOD });
      const shc = lb ? green : vo ? crim : COL.clothR;
      if (lvl >= 1) for (const u of L2 ? [-.5, 0, .5] : [-.35, .35]) { S.cyl(.2, .04, u * (lvl === 3 ? W / .93 : 1), y0 + .22, W + .08, L2 ? COL.ironL : COL.clothB, { n: 8, r: [HPI, 0, 0], l: L2 ? L_METAL : L_WOOD }); S.sph(.05, u * (lvl === 3 ? W / .93 : 1), y0 + .22, W + .11, COL.ironL, { l: L_METAL, w: 5, h: 3, smooth: false }); }
      if (L2) for (const sg of [-1, 1]) S.cyl(.2, .04, sg * (W + .08), y0 + .22, .1, shc, { n: 8, r: [0, 0, HPI], l: L_WOOD });
      if (vo) for (const sg of [-1, 1]) { S.cyl(.2, .04, sg * (W + .08), y0 + .22, -.45, shc, { n: 8, r: [0, 0, HPI], l: L_WOOD }); S.cyl(.2, .04, sg * .55, y0 + .22, W + .08, crim, { n: 8, r: [HPI, 0, 0], l: L_WOOD }); }
    });
    piece('ladder', 5, S => {
      for (const sg of [-1, 1]) S.seg([sg * .17, 0, -W - .5], [sg * .17, H + .15, -W - .06], .035, .035, wd, { l: L_WOOD, n: 4 });
      for (let y = .3; y < H; y += .34) { const u = y / (H + .15); S.box(.36, .04, .05, 0, y, lerp(-W - .5, -W - .06, u), wl, { l: L_WOOD }); }
    });
    const bx = -W + .34, bz = -W + .36, by = H + .1 + (L2 ? .35 : 0);
    piece('brazier', 6, S => { if (L2) S.cyl(.2, .38, bx, H + .29, bz, sdk, { n: 6, l: L_MASON }); brazier(S, bx, by, bz, bs); if (vo) { S.cyl(.2, .38, -bx, H + .29, bz, sdk, { n: 6, l: L_MASON }); brazier(S, -bx, by, bz, bs); } });
    if (lvl >= 1 && !lb) piece('flag', 7, S => {
      const poles = vo ? [[W - .08, -W + .08, crim], [-W + .08, W - .08, crim]] : [[W - .08, -W + .08, COL.clothR]];
      for (const [px, pz, col] of poles) { const top = H + (vo ? 2.05 : 1.75); S.seg([px, H + .1, pz], [px, top, pz], .035, .025, wd, { l: L_WOOD, n: 4 }); const T = new Soup(); clothPanel(T, { x0: 0, x1: vo ? .8 : .62, yTop: 0, len: vo ? .46 : .36, z: 0, col, col2: vo ? mulC(COL.gold, .7) : undefined, rng, nx: vo ? 4 : 3, ny: vo ? 3 : 2, rag: vo ? .15 : 0, sway: 1.2 }); S.merge(T, { p: [px + .02, top - .05, pz], ao: null }); if (vo) S.sph(.05, px, top + .04, pz, COL.gold, { l: L_METAL, w: 5, h: 3, smooth: false }); }
    });
    if (lb) piece('roof', 8, S => {
      const rY = H + 1.55, ro = W * 1.62;
      for (const [a, b] of corners) S.seg([a * (W - .02), H + .1, b * (W - .02)], [a * (W - .06), rY + .05, b * (W - .06)], .055, .045, wd, { l: L_WOOD, n: 4 });
      for (let k = 0; k < 4; k++) { const [a, b] = corners[k], [c, d] = corners[(k + 1) % 4]; S.seg([a * (W - .05), rY, b * (W - .05)], [c * (W - .05), rY, d * (W - .05)], .045, .045, wd, { l: L_WOOD, n: 4 }); }
      S.cone(ro, 1.45, 0, rY + .72, 0, COL.slate, { n: 4, l: L_SLATE, r: [0, PI / 4, 0], rough: .8 });
      S.cone(ro * .62, .5, 0, rY + 1.55, 0, mulC(COL.slate, .8), { n: 4, l: L_SLATE, r: [0, PI / 4, 0] });
      for (const [a, b] of corners) S.cone(.06, .22, a * ro * .7, rY - .02, b * ro * .7, COL.ironL, { n: 4, l: L_METAL, r: [PI, 0, 0] });
      S.seg([0, rY + 1.5, 0], [0, rY + 2.45, 0], .035, .02, iron, { l: L_METAL, n: 4 }); S.sph(.07, 0, rY + 1.85, 0, COL.gold, { l: L_METAL, w: 6, h: 4, smooth: false });
      const T = new Soup(); clothPanel(T, { x0: 0, x1: 1.05, yTop: 0, len: .24, z: 0, col: green, rng, nx: 5, ny: 2, rag: .3, sway: 1.5 }); S.merge(T, { p: [.02, rY + 2.4, 0], ao: null });
    });
    if (vo) piece('quivers', 9, S => {
      for (const [x, z] of [[-W + .3, W - .32], [W - .3, W - .32], [0, -W + .3]]) {
        PROP.barrel(S, x, H + .1, z, .62, rng);
        for (let k = 0; k < 7; k++) { const a = k * 2.4, rr2 = k ? .07 : 0, tx = x + Math.cos(a) * rr2, tz = z + Math.sin(a) * rr2, lean = .12; S.seg([tx, H + .22, tz], [tx + Math.cos(a) * lean, H + .82, tz + Math.sin(a) * lean], .012, .012, wl, { l: L_WOOD, n: 3, jit: 0 }); S.box(.05, .07, .015, tx + Math.cos(a) * lean, H + .78, tz + Math.sin(a) * lean, COL.bone, { jit: 0 }); }
      }
    });
    mounts.flame = [bx, by + bs * .7, bz]; mounts.flameSize = bs; mounts.flame2 = vo ? [-bx, by + bs * .7, bz] : null;
    mounts.top = lb ? H + 2.1 : H + 1.7;
    mounts.archers = [[[.12, H + .1, .28]], [[-.3, H + .1, .42], [.42, H + .1, .1]], [[-.35, H + .1, .5], [.5, H + .1, .3], [.25, H + .1, -.4]],
      lb ? [[-.35, H + .1, .5], [.5, H + .1, .3], [.25, H + .1, -.4]] : [[-.5, H + .1, .55], [.55, H + .1, .5], [.05, H + .1, .15]]][lvl];
    // Spotter (archer crew): stands clear of the archers, the brazier and the ladder, and points out the target.
    mounts.spotter = [null, [.38, H + .1, -.36], [-.44, H + .1, -.02], lb ? [-.44, H + .1, -.02] : [.52, H + .1, -.3]][lvl];
    if (lvl === 3) { mounts.light = lb ? 150 : 175; mounts.flameCol = lb ? [1, 1.08, .8] : [1.12, .82, .6]; mounts.lightCol = lb ? [1, .74, .42] : [1, .48, .2]; mounts.tint = lb ? [.62, .95, .62] : [1.15, .62, .55]; }
  } else if (kind === 'bombard') {
    const mo = lvl === 3 && branch === 'mortar', fb = lvl === 3 && !mo;
    const Rr = [1.0, 1.08, 1.15, mo ? 1.28 : 1.18][lvl], H = [1.1, 1.5, 1.9, mo ? 2.1 : 2.35][lvl], plate = mulC(iron, 1.15);
    piece('plinth', 0, S => {
      S.cyl(Rr + .22, .26, 0, .13, 0, sdk, { n: 10, l: L_MASON }); if (L2) S.cyl(Rr + .12, .2, 0, .36, 0, st, { n: 10, l: L_MASON });
      if (mo) S.cyl(Rr + .3, .5, 0, .25, 0, mixC(sdk, st, .4), { n: 10, l: L_MASON, rt: .86 });
    });
    piece('drum', 1, S => {
      S.cyl(Rr, H, 0, H / 2, 0, st, { n: 10, l: L_MASON, rt: .93, jit: .03 });
      for (let c = 0; c < 2 + lvl; c++) S.cyl(Rr * (1 - .05 * (.5 + c) / (2 + lvl)) + .012, .16, 0, .35 + c * (H - .5) / (1.5 + lvl), 0, mixC(sdk, sl, rng()), { n: 10, l: L_MASON });
      S.box(.34, .55, .1, 0, .3, Rr * .97, COL.black, { jit: 0 });
    });
    if (lvl >= 1) piece('butt', 2, S => { for (let k = 0; k < 4; k++) { const a = k * HPI + PI / 4; S.box(.36, H * .8, .5, Math.cos(a) * (Rr + .06), H * .36, Math.sin(a) * (Rr + .06), sdk, { l: L_MASON, r: [0, -a + HPI, 0] }); S.box(.4, .12, .56, Math.cos(a) * (Rr + .06), H * .78, Math.sin(a) * (Rr + .06), sl, { l: L_MASON, r: [0, -a + HPI, 0] }); } });
    if (lvl >= 1) piece('bands', 3, S => { for (const y of L2 ? [H * .45, H * .8] : [H * .65]) S.cyl(Rr * .965 + .02, .07, 0, y, 0, iron, { n: 10, l: L_METAL, rough: .55 }); });
    if (mo) piece('plates', 3.5, S => {
      for (let k = 0; k < 10; k++) { if (k % 5 === 2) continue; const a = (k + .5) / 10 * TAU; S.box(.5, H * .28, .06, Math.cos(a) * Rr * .95, H * .62, Math.sin(a) * Rr * .95, plate, { l: L_METAL, rough: .5, r: [0, -a + HPI, 0] }); for (const sg of [-1, 1]) S.sph(.03, Math.cos(a) * Rr * .99 + Math.sin(a) * sg * .18, H * .7, Math.sin(a) * Rr * .99 - Math.cos(a) * sg * .18, COL.ironL, { l: L_METAL, w: 4, h: 3, smooth: false }); }
    });
    if (fb) piece('vents', 3.5, S => {
      for (const a of [.35, 1.95, 2.85, 4.4, 5.3]) { const cs = Math.cos(a), sn = Math.sin(a), r = Rr * .95;
        S.box(.36, .26, .06, cs * r, H * .3, sn * r, COL.black, { jit: 0, r: [0, -a + HPI, 0] }); S.box(.28, .17, .05, cs * (r + .02), H * .3, sn * (r + .02), COL.ember, { emis: .85, jit: 0, r: [0, -a + HPI, 0] });
        for (let j = -1; j <= 1; j++) S.box(.03, .22, .04, cs * (r + .04) - sn * j * .09, H * .3, sn * (r + .04) + cs * j * .09, iron, { l: L_METAL, jit: 0, r: [0, -a + HPI, 0] }); }
      S.cyl(Rr * .965 + .03, .05, 0, H * .17, 0, COL.brass, { n: 10, l: L_METAL, rough: .4 });
    });
    piece('deck', 4, S => { S.cyl(Rr * .93 + .14, .16, 0, H + .02, 0, sl, { n: 10, l: L_MASON }); S.cyl(Rr * .8, .06, 0, H + .12, 0, fb ? mulC(iron, .8) : w, { n: 10, l: fb ? L_METAL : L_WOOD }); if (fb) S.cyl(Rr * .32, .03, 0, H + .16, 0, COL.ember, { n: 10, emis: .35, jit: 0 }); });
    piece('rim', 5, S => { for (let k = 0; k < 10; k++) { if (k % 5 === 0) continue; const a = (k + .5) / 10 * TAU + HPI, ir = mo || (L2 && (k & 1)); S.box(.46, mo ? .4 : .34, .22, Math.cos(a) * Rr * .96, H + (mo ? .3 : .27), Math.sin(a) * Rr * .96, ir ? (mo ? plate : iron) : mixC(sdk, sl, rng()), { l: ir ? L_METAL : L_MASON, r: [0, -a + HPI, 0] }); } });
    piece('ammo', 6, S => {
      if (mo) { const sh = mulC(iron, .7); for (const [x, z, y] of [[-.5, -.55, 0], [-.22, -.62, 0], [-.4, -.3, 0], [-.66, -.3, 0], [-.42, -.5, .2], [-.48, -.36, .2]]) S.sph(.13, x, H + .23 + y, z, sh, { l: L_METAL, w: 6, h: 4, smooth: false }); S.box(.4, .26, .3, .5, H + .25, -.5, wd, { l: L_WOOD }); }
      else if (fb) { const clay = C(0x8a4a2c); for (const [x, z] of [[-.46, -.5], [-.2, -.6], [-.36, -.28]]) { S.sph(.12, x, H + .24, z, clay, { w: 6, h: 4, smooth: false, sc: [1, 1.15, 1] }); S.cyl(.04, .08, x, H + .4, z, COL.ember, { n: 5, emis: .8, jit: 0 }); } PROP.barrel(S, .45, H + .13, -.5, .75, rng); }
      else { for (const [x, z] of [[-.42, -.5], [-.24, -.52], [-.33, -.36]]) S.sph(.09, x, H + .22, z, mulC(iron, .8), { l: L_METAL, w: 6, h: 4, smooth: false }); S.sph(.09, -.33, H + .36, -.46, mulC(iron, .8), { l: L_METAL, w: 6, h: 4, smooth: false }); PROP.barrel(S, .45, H + .13, -.5, .75, rng); }
    });
    const lx = -Rr * .78, lz = .2, lh = H + 1.25 + Math.min(lvl, 2) * .12 + (mo ? .1 : 0);
    piece('lantern', 7, S => {
      for (const sg of (L2 && !fb) ? [-1, 1] : [1]) {
        const x = lx * sg;
        S.seg([x, H + .1, lz], [x, lh, lz], .04, .035, iron, { l: L_METAL, n: 4 }); S.seg([x, lh, lz], [x - sg * -.0, lh, lz + .32], .03, .03, iron, { l: L_METAL, n: 4 });
        S.box(.2, .05, .2, x, lh - .08, lz + .32, iron, { l: L_METAL }); S.box(.16, .2, .16, x, lh - .22, lz + .32, COL.ember, { emis: .8, jit: 0 }); S.box(.2, .04, .2, x, lh - .34, lz + .32, iron, { l: L_METAL });
        for (const [a, b] of corners) S.box(.025, .22, .025, x + a * .09, lh - .22, lz + .32 + b * .09, iron, { l: L_METAL });
      }
    });
    const chx = Rr * .62, chz = -Rr * .5, chH = H + 1.75;
    if (fb) piece('chimney', 8, S => {
      S.cyl(.24, chH - .2, chx, (chH - .2) / 2 + .1, chz, sdk, { n: 8, l: L_MASON, rt: .8 });
      for (const y of [.6, chH * .55, chH - .35]) S.cyl(.24 * lerp(1, .8, y / chH) + .03, .07, chx, y, chz, iron, { n: 8, l: L_METAL });
      S.cyl(.26, .14, chx, chH - .1, chz, iron, { n: 8, l: L_METAL, rt: 1.25 }); S.cyl(.2, .03, chx, chH - .02, chz, COL.ember, { n: 8, emis: .8, jit: 0 });
      for (let k = 0; k < 4; k++) { const a = k * HPI + .4; S.seg([chx + Math.cos(a) * .12, chH, chz + Math.sin(a) * .12], [chx + Math.cos(a) * .3, chH + .28, chz + Math.sin(a) * .3], .025, .015, iron, { l: L_METAL, n: 4 }); }
    });
    if (lvl === 3) piece('banner', 9, S => {
      const col = mo ? C(0x3a4250) : C(0x9a3a14), px = -Rr * .55, pz = -Rr * .62, top = H + (mo ? 2.0 : 1.9);
      S.seg([px, H + .1, pz], [px, top, pz], .035, .025, wd, { l: L_WOOD, n: 4 }); S.cone(.05, .14, px, top + .07, pz, COL.ironL, { n: 4, l: L_METAL });
      const T = new Soup(); clothPanel(T, { x0: 0, x1: .66, yTop: 0, len: .5, z: 0, col, col2: mo ? mulC(COL.ironL, 1.3) : mulC(COL.gold, .8), rng, nx: 3, ny: 3, rag: .2, sway: 1.1 }); S.merge(T, { p: [px + .03, top - .06, pz], ao: null });
    });
    mounts.flame = [lx, lh - .3, lz + .32]; mounts.flameSize = .26 + Math.min(lvl, 2) * .05; mounts.flame2 = (L2 && !fb) ? [-lx, lh - .3, lz + .32] : null; mounts.top = H + 1.6;
    mounts.gun = [0, H + .15, .05]; mounts.gunLen = [.95, 1.12, 1.25, mo ? .92 : 1.42][lvl]; mounts.gunR = [.15, .18, .215, mo ? .36 : .2][lvl];
    mounts.crew = lvl === 3 ? [[-.5, -.32], [.5, -.36]] : [[-.48, -.3]];
    if (fb) { mounts.flame2 = [chx, chH + .05, chz]; mounts.flame2Size = .34; mounts.flame2Smoke = 1.6; mounts.top = chH + .4; }
    if (lvl === 3) { mounts.light = mo ? 95 : 120; mounts.lightCol = mo ? [1, .62, .32] : [1, .4, .1]; mounts.flameCol = mo ? [1, 1, 1] : [1.15, .7, .45]; mounts.gunPitch = mo ? -.86 : -.36; mounts.gunFlare = mo ? 1.22 : 1.0; mounts.gunCol = mo ? C(0xa8844a) : mulC(iron, .9); mounts.gunHot = fb; mounts.tint = mo ? [.8, .82, .9] : [1.1, .7, .55]; }
  } else if (kind === 'spire') {
    const tp = lvl === 3 && branch === 'tempest', fr = lvl === 3 && !tp;
    const H = [2.7, 3.4, 4.1, tp ? 5.0 : 4.55][lvl], bas = COL.basalt, basL = COL.basaltL, cu = C(0x8a5a3a);
    const inlay = tp ? C(0xc8a8ff) : fr ? C(0xc4ecff) : COL.crystal, ice = C(0xa8dcf4), snow = COL.snow;
    piece('plinth', 0, S => {
      S.box(1.55, .22, 1.55, 0, .11, 0, basL, { l: L_ROCK }); S.box(1.18, .2, 1.18, 0, .32, 0, bas, { l: L_ROCK }); if (lvl >= 1) for (const [a, b] of corners) S.cone(.16, .5, a * .62, .5, b * .62, basL, { n: 4, l: L_ROCK });
      if (lvl === 3) S.box(1.72, .14, 1.72, 0, .07, 0, mulC(bas, .9), { l: L_ROCK });
    });
    piece('shaft', 1, S => {
      S.cyl(.62, H - .42, 0, .42 + (H - .42) / 2, 0, bas, { n: 4, l: L_ROCK, rt: .52, r: [0, PI / 4, 0], jit: .03 });
      for (let k = 0; k < 4; k++) { const a = k * HPI, n = 3 + lvl; for (let j = 0; j < n; j++) { const u = (j + .7) / (n + .6), y = .42 + u * (H - .42), rr2 = lerp(.62, .32, u) * .7072 + .012; S.box(.07, .2, .02, Math.sin(a) * rr2, y, Math.cos(a) * rr2, inlay, { emis: .5, jit: 0, r: [-.12, a, 0], ro: 'YXZ' }); } }
    });
    if (lvl >= 1) piece('bands', 2, S => {
      for (const u of L2 ? (tp ? [.22, .42, .62, .82] : [.3, .58, .82]) : [.4, .75]) { const r = lerp(.62, .32, u) + .03, y = .42 + u * (H - .42);
        S.cyl(r, .09, 0, y, 0, fr ? mulC(cu, .8) : cu, { n: 4, l: L_METAL, r: [0, PI / 4, 0], rough: .45 });
        if (fr) { S.cyl(r + .02, .05, 0, y + .07, 0, snow, { n: 4, r: [0, PI / 4, 0], rough: 1 }); for (let k = 0; k < 4; k++) { const a = k * HPI + PI / 4, d = r * .72; S.cone(.035, .2 + .1 * ((k + u * 7) % 2), Math.cos(a) * d, y - .14, Math.sin(a) * d, ice, { n: 4, r: [PI, 0, 0], emis: .12 }); } }
        if (tp) for (let k = 0; k < 4; k++) { const a = k * HPI, d = r * .72; S.box(.05, .05, .05, Math.sin(a) * d, y, Math.cos(a) * d, inlay, { emis: .8, jit: 0 }); } }
    });
    piece('claws', 3, S => {
      const tipY = tp ? H + .95 : H + .74, mid = tp ? H + .32 : H + .26, tipC = tp ? C(0xb08060) : fr ? ice : (lvl ? cu : basL);
      for (let k = 0; k < 4; k++) { const a = k * HPI + PI / 4, cs = Math.cos(a), sn = Math.sin(a);
        S.seg([cs * .22, H - .12, sn * .22], [cs * .46, mid, sn * .46], .06, .045, basL, { l: L_ROCK, n: 4 }); S.seg([cs * .46, mid, sn * .46], [cs * .26, tipY, sn * .26], .045, .012, tipC, { l: lvl && !fr ? L_METAL : L_ROCK, n: 4, emis: fr ? .15 : 0 });
        if (tp) S.sph(.04, cs * .26, tipY + .02, sn * .26, inlay, { emis: 1, jit: 0, w: 5, h: 3, smooth: false });
        if (fr) { S.cone(.03, .26, cs * .44, mid - .2, sn * .44, ice, { n: 4, r: [PI, 0, 0], emis: .15 }); S.cyl(.07, .04, cs * .46, mid + .03, sn * .46, snow, { n: 5, rough: 1 }); } }
      S.cyl(.34, .12, 0, H - .02, 0, basL, { n: 4, l: L_ROCK, r: [0, PI / 4, 0] }); if (fr) S.cyl(.36, .05, 0, H + .06, 0, snow, { n: 4, r: [0, PI / 4, 0], rough: 1 });
    });
    if (tp) piece('rods', 4, S => {
      for (const [a, b] of corners) { const x = a * .7, z = b * .7, top = 2.1 + (a * b > 0 ? .25 : 0);
        S.seg([x, .2, z], [x, top, z], .045, .03, cu, { l: L_METAL, n: 5, rough: .45 }); for (const y of [.8, 1.4]) S.cyl(.07, .05, x, y, z, mulC(cu, .7), { n: 5, l: L_METAL });
        S.sph(.09, x, top + .05, z, inlay, { emis: 1, jit: 0, w: 6, h: 4, smooth: false }); S.cyl(.12, .03, x, top - .06, z, cu, { n: 6, l: L_METAL }); }
    });
    if (fr) piece('ice', 4, S => {
      const spikes = [[.82, .25, .5, .7], [-.85, .1, .4, .55], [.5, -.86, .45, .62], [-.6, -.75, .36, .5], [.92, -.4, .3, .42], [-.2, .9, .35, .48], [.3, .88, .28, .4], [-.92, .55, .32, .44]];
      for (const [x, z, h, r0] of spikes) { const a = Math.atan2(z, x); S.cone(r0 * .36, h * 2.3, x * 1.04, h * 1.0, z * 1.04, mixC(ice, snow, .2), { n: 4, emis: .3, r: [Math.sin(a) * .4, a, -Math.cos(a) * .4], rough: .3 }); S.cone(r0 * .2, h * 1.2, x * .8, h * .5, z * .8 + .12, ice, { n: 4, emis: .3, r: [Math.sin(a) * .2, 0, -Math.cos(a) * .2], rough: .3 }); }
      for (const [a, b] of corners) S.cyl(.2, .06, a * .62, .76, b * .62, snow, { n: 5, rough: 1 });
      S.cyl(.84, .05, 0, .45, 0, snow, { n: 4, r: [0, PI / 4, 0], rough: 1 });
    });
    mounts.crystal = [0, H + .42 + (tp ? .18 : 0), 0]; mounts.crystalS = [.2, .24, .29, tp ? .33 : .31][lvl]; mounts.shards = [0, 2, 4, tp ? 6 : 5][lvl]; mounts.rings = L2;
    mounts.top = H + 1.2; mounts.flame = null; mounts.lightAt = [0, mounts.crystal[1] + .03, 0];
    if (tp) { mounts.rods = corners.map(([a, b]) => [a * .7, 2.15 + (a * b > 0 ? .25 : 0), b * .7]); }
    if (lvl === 3) {
      mounts.light = tp ? 34 : 30; mounts.lightCol = tp ? [.78, .62, 1] : [.5, .86, 1]; mounts.crystalCol = tp ? [.62, .45, 1.2] : [.42, .86, 1.15]; mounts.boltCol = tp ? [.82, .66, 1.7] : [.6, .95, 1.6];
      mounts.ringCol = fr ? mixC(ice, snow, .3) : basL; mounts.ringIce = fr; mounts.groundGlow = tp ? [.5, .35, 1.0] : [.35, .7, 1.0];
    }
  } else {
    const kn = lvl === 3 && branch === 'knights', pk = lvl === 3 && !kn;
    const W = [1.5, 1.7, 1.9, kn ? 2.0 : 1.9][lvl], D = [1.3, 1.4, 1.5, kn ? 1.55 : 1.5][lvl], wh = [1.05, 1.25, 1.5, kn ? 1.7 : 1.5][lvl], stoneWalls = L2;
    const blue = mulC(COL.clothB, 1.15), gold = mulC(COL.gold, .75), red = C(0x7a1e18), blk = C(0x1e1c1c);
    piece('floor', 0, S => { S.box(W + .5, .16, D + .7, 0, .08, .1, sdk, { l: L_MASON }); S.box(.7, .1, .4, 0, .05, D / 2 + .55, st, { l: L_MASON }); });
    piece('walls', 1, S => {
      const wc = stoneWalls ? st : C(0x8f8468), wlay = stoneWalls ? L_MASON : L_PLAIN;
      if (lvl === 1) S.box(W + .04, .5, D + .04, 0, .41, 0, st, { l: L_MASON });
      S.box(W, wh, D, 0, .16 + wh / 2, 0, wc, { l: wlay, jit: .03 });
      if (!stoneWalls) { for (const [a, b] of corners) S.box(.12, wh + .04, .12, a * W / 2, .16 + wh / 2, b * D / 2, wd, { l: L_WOOD }); for (const sg of [-1, 1]) { S.box(W, .1, .08, 0, .16 + wh * .55, sg * D / 2, wd, { l: L_WOOD }); S.seg([sg * W * .5, .2, D / 2 + .01], [sg * W * .22, .16 + wh, D / 2 + .01], .04, .04, wd, { l: L_WOOD, n: 4 }); } S.box(.08, .1, D, W / 2, .16 + wh * .55, 0, wd, { l: L_WOOD }); S.box(.08, .1, D, -W / 2, .16 + wh * .55, 0, wd, { l: L_WOOD }); }
      S.box(.5, .82, .12, 0, .57, D / 2, COL.black, { jit: 0 }); S.box(.66, .1, .16, 0, 1.02, D / 2 + .02, wd, { l: L_WOOD }); for (const sg of [-1, 1]) S.box(.09, .86, .16, sg * .29, .59, D / 2 + .02, wd, { l: L_WOOD });
      S.box(.24, .24, .08, W * .32, .16 + wh * .62, D / 2 + .01, COL.black, { jit: 0 }); S.box(.08, .3, .3, W / 2 + .01, .16 + wh * .6, 0, COL.black, { jit: 0 });
      if (lvl === 3) for (const [a, b] of corners) S.box(.2, wh + .1, .2, a * (W / 2 + .02), .16 + (wh + .1) / 2, b * (D / 2 + .02), kn ? sl : sdk, { l: L_MASON });
      if (kn) for (const sg of [-1, 1]) { const x = sg * W * .3; S.box(.36, .3, .05, x, .16 + wh * .62, D / 2 + .04, blue, { l: L_WOOD, jit: 0 }); S.box(.26, .12, .05, x, .16 + wh * .62 - .2, D / 2 + .04, blue, { l: L_WOOD, jit: 0 }); S.box(.06, .42, .06, x, .16 + wh * .6, D / 2 + .065, gold, { l: L_METAL, rough: .45, jit: 0 }); S.box(.34, .06, .06, x, .16 + wh * .66, D / 2 + .065, gold, { l: L_METAL, rough: .45, jit: 0 }); }
    });
    piece('roof', 2, S => {
      const rl = lvl === 0 ? L_THATCH : L_SLATE, rc = lvl === 0 ? COL.thatch : kn ? mixC(COL.slate, C(0x2a3a5a), .45) : COL.slate, y0 = .16 + wh, rh = [.75, .85, .9, .95][lvl], sl2 = Math.atan2(rh, D / 2 + .2), len = Math.hypot(rh, D / 2 + .2) + .12;
      for (const sg of [-1, 1]) S.box(W + .36, .09, len, 0, y0 + rh / 2 - .02, sg * (D / 4 + .1), rc, { l: rl, r: [sg * sl2, 0, 0] });
      for (const sg of [-1, 1]) { const T = [[sg * W / 2, y0, -D / 2], [sg * W / 2, y0, D / 2], [sg * W / 2, y0 + rh, 0]]; const gc = stoneWalls ? st : C(0x8f8468); if (sg > 0) S.tri(T[0], T[2], T[1], gc, stoneWalls ? L_MASON : L_PLAIN, .95); else S.tri(T[0], T[1], T[2], gc, stoneWalls ? L_MASON : L_PLAIN, .95); }
      S.box(W + .44, .1, .14, 0, y0 + rh + .02, 0, wd, { l: L_WOOD });
      S.box(.26, .5, .26, -W * .3, y0 + rh * .7 + .1, -D * .2, sdk, { l: L_MASON });
      if (kn) for (const sg of [-1, 1]) S.cone(.05, .2, sg * (W / 2 + .2), y0 + rh + .12, 0, gold, { n: 4, l: L_METAL });
    });
    piece('rack', 3, S => { const x = -W / 2 - .28; S.box(.06, .7, .06, x, .5, -.3, wd, { l: L_WOOD }); S.box(.06, .7, .06, x, .5, .3, wd, { l: L_WOOD }); S.box(.05, .05, .7, x, .78, 0, w, { l: L_WOOD }); for (const z of [-.2, 0, .2]) { S.seg([x + .06, .12, z], [x - .04, pk ? 2.0 : 1.5, z], .018, .018, wl, { l: L_WOOD, n: 4 }); S.cone(.035, pk ? .22 : .14, x - .045, pk ? 2.08 : 1.56, z, COL.steel, { n: 4, l: L_METAL }); } if (lvl >= 1) { S.cyl(.2, .04, W / 2 + .03, .75, -.25, kn ? blue : pk ? red : COL.clothB, { n: 8, r: [0, 0, HPI], l: L_WOOD }); } });
    const tx = W / 2 - .2, tz = -D / 2 + .2, th = kn ? 3.3 : 2.7;
    if (L2) piece('turret', 4, S => {
      S.box(.8, th, .8, tx, th / 2 + .16, tz, st, { l: L_MASON }); S.box(.94, .16, .94, tx, th + .2, tz, sl, { l: L_MASON }); for (const [a, b] of corners) S.box(.24, .26, .24, tx + a * .35, th + .4, tz + b * .35, mixC(sdk, sl, rng()), { l: L_MASON }); S.box(.1, .4, .06, tx, th * .7, tz + .41, COL.black, { jit: 0 });
      if (kn) { S.box(.1, .4, .06, tx, th * .42, tz + .41, COL.black, { jit: 0 }); S.cone(.66, 1.1, tx, th + .8, tz, mixC(COL.slate, C(0x2a3a5a), .45), { n: 8, l: L_SLATE }); S.box(.86, .1, .86, tx, th + .3, tz, sdk, { l: L_MASON }); for (const sg of [-1, 1]) S.box(.06, .5, .02, tx + sg * .2, th * .55, tz + .41, gold, { l: L_METAL }); }
      if (pk) { for (const [a, b] of corners) { S.seg([tx + a * .45, th + .2, tz + b * .45], [tx + a * .45, th + .95, tz + b * .45], .05, .045, wd, { l: L_WOOD, n: 4 }); } S.cone(.78, .55, tx, th + 1.18, tz, COL.thatch, { n: 4, l: L_THATCH, r: [0, PI / 4, 0] }); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; S.seg([tx + Math.cos(a) * .45, th + .45, tz + Math.sin(a) * .45], [tx + Math.cos(a) * .85, th + .62, tz + Math.sin(a) * .85], .025, .006, wl, { l: L_WOOD, n: 3 }); } }
    });
    if (pk) piece('palisade', 4.5, S => {
      const hx = W / 2 + .42, hz = D / 2 + .58, cz = .1, stake = (x, z, h) => { S.seg([x, .1, z], [x, h, z], .06, .055, (rng() < .5 ? w : wd), { l: L_WOOD, n: 5 }); S.cone(.055, .2, x, h + .1, z, wl, { n: 5, l: L_WOOD }); };
      for (let i = 0; i <= 8; i++) { const x = -hx + i / 8 * hx * 2; stake(x, cz - hz, .8 + rng() * .35); }
      for (let i = 1; i < 7; i++) { const z = cz - hz + i / 7 * hz * 2; stake(-hx, z, .75 + rng() * .3); if (z < cz + hz - .6) stake(hx, z, .75 + rng() * .3); }
      for (let i = 0; i <= 2; i++) { stake(-hx + i * .32, cz + hz, .8 + rng() * .3); if (i) stake(hx - i * .32, cz + hz, .8 + rng() * .3); }
      for (const z of [cz - hz]) for (const y of [.35, .65]) S.box(hx * 2, .05, .05, 0, y, z + .04, wd, { l: L_WOOD });
      for (const x of [-hx, hx]) for (const y of [.35, .65]) S.box(.05, .05, hz * 1.6, x + (x > 0 ? -.04 : .04), y, cz - hz * .2, wd, { l: L_WOOD });
      for (const sg of [-1, 1]) { const x = sg * 1.05, z = D / 2 + 1.0; for (const r of [.7, -.7]) S.seg([x - .32, .1, z + r * .3], [x + .32, .62, z - r * .3], .035, .02, wl, { l: L_WOOD, n: 4 }); S.seg([x - .4, .3, z], [x + .4, .3, z], .045, .045, wd, { l: L_WOOD, n: 4, r: [0, 0, 0] }); }
    });
    const fx = W / 2 + .12, fz = D / 2 + .5, bs = [.34, .46, .6, .66][lvl];
    piece('fire', 5, S => { if (lvl === 0) { S.seg([fx, 0, fz], [fx, 1.05, fz], .04, .035, wd, { l: L_WOOD, n: 4 }); S.cyl(.07, .12, fx, 1.1, fz, iron, { n: 6, l: L_METAL, rt: 1.4 }); } else brazier(S, fx, .08, fz, bs + .1); });
    piece('flag', 6, S => {
      const x = L2 ? tx : -W / 2 + .1, z = L2 ? tz : -D / 2 + .1, y0 = L2 ? th + .4 : .2, y1 = kn ? th + 2.6 : L2 ? th + 1.8 : 2.9;
      S.seg([x, y0, z], [x, y1, z], .04, .028, wd, { l: L_WOOD, n: 4 });
      const T = new Soup(); clothPanel(T, { x0: 0, x1: kn ? .95 : .7, yTop: 0, len: kn ? .56 : .46, z: 0, col: pk ? red : COL.clothB, col2: pk ? blk : mulC(COL.gold, .6), rng, nx: 4, ny: 3, rag: .2, sway: 1.1 }); S.merge(T, { p: [x + .03, y1 - .06, z], ao: null });
      if (kn) { S.sph(.07, x, y1 + .06, z, COL.gold, { l: L_METAL, w: 6, h: 4, smooth: false }); banner(S, 0, .16 + wh - .05, D / 2 + .1, 0, .38, .7, blue, gold, .2); }
      if (pk) { S.cone(.06, .18, x, y1 + .09, z, COL.steel, { n: 4, l: L_METAL }); for (const s of [-1, 1]) S.box(.04, .04, .04, x, y1 - .18 + s * .08, z, COL.bone, { jit: 0 }); }
    });
    mounts.flame = lvl === 0 ? [fx, 1.2, fz] : [fx, .08 + (bs + .1) * .72, fz]; mounts.flameSize = bs; mounts.door = [0, 0, D / 2 + .45]; mounts.top = L2 ? th + .7 : 2.2;
    if (lvl === 3) { mounts.light = kn ? 105 : 110; mounts.lightCol = kn ? [1, .7, .38] : [1, .48, .2]; mounts.flameCol = kn ? [1, 1.05, .85] : [1.1, .78, .55]; }
  }
  pieces.sort((a, b) => a.order - b.order);
  return { pieces, mounts };
}

function scaffoldGeo(w, h) {
  const S = new Soup(), c = mulC(COL.woodL, .9), c2 = COL.wood;
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) S.seg([a * w, 0, b * w], [a * w, h, b * w], .04, .035, c, { l: L_WOOD, n: 4 });
  for (let y = .9; y < h; y += 1.05) for (let k = 0; k < 4; k++) { const q = [[-1, -1], [1, -1], [1, 1], [-1, 1]], [a, b] = q[k], [cc, d] = q[(k + 1) % 4]; S.seg([a * w, y, b * w], [cc * w, y, d * w], .03, .03, c2, { l: L_WOOD, n: 4 }); if (k & 1) S.seg([a * w, y - .9, b * w], [cc * w, y, d * w], .022, .022, c, { l: L_WOOD, n: 3 }); }
  S.box(w * 1.2, .05, .34, 0, Math.min(h - .2, 1.95), w + .12, c2, { l: L_WOOD }); S.box(.34, .05, w * 1.2, -w - .12, Math.min(h - .25, .95), 0, c, { l: L_WOOD });
  return S.build();
}

let TOWER_STUN = false;
const SPIRE_STORM = [.28, .62, 1.15];
// Freeze: a near-total slow for a moment, with a frosty flash. Bosses resist (slowMonster cuts it).
function freezeMonster(m, t) {
  if (m.dead || m.hp <= 0) return;
  slowMonster(m, .96, t); m.frozen = Math.max(m.frozen || 0, m.def.boss ? t * .5 : t);
  fxTimed(5, m.x, m.y + m.hitH, m.z, 1.4 + m.rad * 2, 1.4 + m.rad * 2, .7, 1.2, 1.8, .8, .3);
}
// Longbow: the toughest monster in range (armor counts double), leaders breaking ties.
function findHeavy(x, z, range) {
  if (G.phase !== 'play' || TOWER_STUN) return null;
  let best = null, bp = -1; const r2 = range * range;
  for (const m of G.mons) {
    if (m.dead || m.hp <= 0 || !m.vis || m.dying) continue; const d = dist2(x, z, m.x, m.z); if (d > r2) continue;
    const sc = m.hp * (m.def.armor ? 2 : 1) * (m.elite ? 1.3 : 1) + m.prog * 40; if (sc > bp) { bp = sc; best = m; }
  }
  return best;
}
// Volley: up to n more targets near the first one (repeats the first when it is alone).
const _xt = [];
function extraTargets(t, x, z, range, n) {
  _xt.length = 0; const r2 = range * range;
  for (const m of G.mons) { if (m === t || m.dead || m.hp <= 0 || !m.vis || dist2(x, z, m.x, m.z) > r2) continue; m._xd = dist2(m.x, m.z, t.x, t.z); if (m._xd > 16) continue; _xt.push(m); }
  _xt.sort((a, b) => a._xd - b._xd); _xt.length = Math.min(_xt.length, n);
  while (_xt.length < n) _xt.push(t);
  return _xt;
}
// Mortar: the ground monster with the most neighbours inside the blast (sampled; leaders break ties).
function findDense(x, z, range, minRange, splash) {
  if (G.phase !== 'play' || TOWER_STUN) return null;
  const r2 = range * range, m2 = minRange * minRange, s2 = splash * splash * .8, M = G.mons; let best = null, bs = -1, seen = 0;
  for (let i = 0; i < M.length; i++) {
    const m = M[i]; if (m.dead || m.hp <= 0 || m.fly || !m.vis || m.dying) continue; const d = dist2(x, z, m.x, m.z); if (d > r2 || d < m2) continue;
    if (++seen > 70 && (i & 1)) continue;
    let sc = m.prog + (m.def.boss ? 4 : 0);
    for (let j = 0; j < M.length; j++) { const o = M[j]; if (o !== m && !o.dead && !o.fly && o.vis && dist2(m.x, m.z, o.x, o.z) < s2) sc += 1 + (o.elite ? .5 : 0); }
    if (sc > bs) { bs = sc; best = m; }
  }
  return best;
}
function findTarget(x, z, range, air, ground, minRange = 0) {
  if (G.phase !== 'play' || TOWER_STUN) return null;
  range *= G.rangeMul || 1;
  let best = null, bp = -1; const r2 = range * range, m2 = minRange * minRange;
  for (const m of G.mons) {
    if (m.dead || m.hp <= 0 || !m.vis) continue; if (m.fly ? !air : !ground) continue;
    const d = dist2(x, z, m.x, m.z); if (d > r2 || d < m2) continue;
    const sc = m.prog + (m.fly ? 2 : 0) + (m.def.prio || 0) + (m.low ? 1 : 0); if (sc > bp) { bp = sc; best = m; }
  }
  return best;
}
function aimPoint(m, dt, out) {
  if (m.fly) { out.x = m.x + m.vx * dt; out.y = m.y; out.z = m.z + m.vz * dt; return out; }
  const B = G.B, adv = m.blocked ? 0 : m.spdNow * dt, s2 = Math.min(B.L - .1, m.s + adv);
  pathAt(B, s2, out); out.x += -out.tz * m.lat; out.z += out.tx * m.lat; out.y += m.hitH; return out;
}

const _tv = new THREE.Vector3(), _tq = new THREE.Quaternion(), _tm = new THREE.Matrix4(), _tz = new THREE.Vector3(0, 0, 1), _ts = new THREE.Vector3(1, 1, 1), _ap = { x: 0, y: 0, z: 0, tx: 0, tz: 0 };

const SPIRE_BOLT = [.5, .78, 1.6];
class Tower {
  constructor(pad, kind, idx) {
    this.pad = pad; this.kind = kind; this.idx = idx; this.lvl = 0; this.def = TOWER[kind];
    this.x = pad.x; this.y = pad.y; this.z = pad.z; this.yaw = pad.face; this.cs = Math.cos(this.yaw); this.sn = Math.sin(this.yaw);
    this.spent = this.def.cost[0]; this.state = 'build'; this.bt = 0; this.cool = rr(.2, .8); this.kills = 0; this.dealt = 0; this.alive = true; this.recent = 0;
    this.group = new THREE.Group(); this.group.position.set(this.x, this.y, this.z); this.group.rotation.y = this.yaw; R.scene.add(this.group);
    this.pieces = []; this.staticMesh = null; this.scaf = null; this.flame = null; this.flame2 = null; this.archers = []; this.crew = []; this.ocA = 0; this.ocAcc = 0; this.men = []; this.respawn = 0;
    this.em = { x: this.x, y: this.y + 3, z: this.z, r: 1, g: .56, b: .26, I: 0, range: 13, on: 0, alive: true, seed: rnd() * 50, spot: kind !== 'spire', dx: this.sn, dz: this.cs, fl: 1, _spot: 0 };
    LT.emitters[idx] = this.em; pad.tower = this;
    this.gunYaw = 0; this.recoil = 0; this.charge = 0; this.spin = rnd() * 6; this.hover = 0; this.appear = 0;
    this.begin();
  }
  get range() { const r = this.def.range; return r[Math.min(this.lvl, r.length - 1)]; }
  w(l, out) { out.x = this.x + l[0] * this.cs + l[2] * this.sn; out.y = this.y + l[1]; out.z = this.z - l[0] * this.sn + l[2] * this.cs; return out; }
  begin() {
    const bp = blueprint(this.kind, this.lvl, this.branch); this.bp = bp; this.mounts = bp.mounts; this.bt = 0; this.state = this.lvl ? 'upgrade' : 'build';
    this.clearModel(true);
    const n = bp.pieces.length, gap = Math.min(.2, 1.45 / n);
    bp.pieces.forEach((p, i) => {
      const mesh = new THREE.Mesh(p.soup.build(), MAT.world); mesh.castShadow = mesh.receiveShadow = true; mesh.visible = false; mesh.position.y = p.y + 2.4;
      this.group.add(mesh); this.pieces.push({ mesh, y: p.y, t0: .32 + i * gap, landed: false, soup: p.soup });
    });
    this.tEnd = .32 + n * gap + .3;
    this.scaf = new THREE.Mesh(scaffoldGeo(this.lvl === 3 ? 1.38 : 1.25, Math.min(this.lvl === 3 ? 5.9 : 4.4, bp.mounts.top + .3)), MAT.world); this.scaf.castShadow = true; this.scaf.scale.set(1, .01, 1); this.group.add(this.scaf);
    fxDust(this.x, this.y + .1, this.z, 7, 1.0, { speed: 1.6 });
    sfx('hammer', this.x, this.z, .8, .3);
  }
  clearModel(keepLights) {
    for (const p of this.pieces) { this.group.remove(p.mesh); p.mesh.geometry.dispose(); } this.pieces.length = 0;
    for (const k of ['staticMesh', 'scaf', 'carriage', 'crystal']) if (this[k]) { this.group.remove(this[k]); this[k].traverse(o => { if (o.geometry) o.geometry.dispose(); }); this[k] = null; }
    this.barrel = null; this.shards = null; this.ringG = null;
    removeFlame(this.flame); removeFlame(this.flame2); this.flame = this.flame2 = null; this.em.on = keepLights ? this.em.on * .4 : 0;
    this.archers.length = 0; this.crew.length = 0; this.spotter = null;
  }
  finish() {
    const M = new Soup(); for (const p of this.pieces) M.merge(p.soup, { p: [0, p.y, 0], ao: [0, 1.0, .72] });
    for (const p of this.pieces) { this.group.remove(p.mesh); p.mesh.geometry.dispose(); } this.pieces.length = 0;
    this.staticMesh = new THREE.Mesh(M.build(), MAT.world); this.staticMesh.castShadow = this.staticMesh.receiveShadow = true; this.group.add(this.staticMesh);
    if (this.scaf) { this.group.remove(this.scaf); this.scaf.geometry.dispose(); this.scaf = null; }
    const mt = this.mounts, lvl = this.lvl, d = this.def;
    const fc = mt.flameCol || [1, 1, 1]; this.flameCol = fc;
    if (mt.flame) { const p = this.w(mt.flame, {}); this.flame = addFlame({ x: p.x, y: p.y, z: p.z, size: mt.flameSize, on: 0, layers: mt.flameSize > .7 ? 2 : 1, glow: 1, r: fc[0], g: fc[1], b: fc[2] }); this.em.x = p.x; this.em.y = p.y + .25; this.em.z = p.z; this.em.r = 1; this.em.g = .56; this.em.b = .26; }
    if (mt.flame2) { const p = this.w(mt.flame2, {}); this.flame2 = addFlame({ x: p.x, y: p.y, z: p.z, size: mt.flame2Size || mt.flameSize, on: 0, smoke: mt.flame2Smoke || 0, r: fc[0], g: fc[1], b: fc[2] }); }
    if (mt.lightAt) { const p = this.w(mt.lightAt, {}); this.em.x = p.x; this.em.y = p.y; this.em.z = p.z; this.em.r = .45; this.em.g = .72; this.em.b = 1; }
    if (mt.lightCol) { this.em.r = mt.lightCol[0]; this.em.g = mt.lightCol[1]; this.em.b = mt.lightCol[2]; }
    this.em0 = [this.em.r, this.em.g, this.em.b];
    // Light intensity: the stat table (a branch's def has a fourth entry), else the blueprint's, else the last entry.
    this.light0 = d.light[lvl] !== undefined ? d.light[lvl] : mt.light !== undefined ? mt.light : d.light[d.light.length - 1];
    this.em.I = this.light0; this.em.range = this.kind === 'archer' ? 12 : 10.5;
    const tint = mt.tint || [1, .9, .7];
    if (this.kind === 'archer') mt.archers.slice(0, (d.n && d.n[lvl]) || 3).forEach((a, i) => this.archers.push({ l: a, yaw: this.yaw, draw: 0, cool: .4 + i * .3, e: { scale: .82, ph: 0, mv: 0, atk: -1, bow: true, quiver: true, draw: 0, pitch: 0, tint, x: 0, y: 0, z: 0, yaw: 0, flash: 0 } }));
    this.spotter = this.kind === 'archer' && mt.spotter ? { l: mt.spotter, yaw: this.yaw, e: { scale: .8, ph: 0, mv: 0, atk: -1, point: 0, tint, x: 0, y: 0, z: 0, yaw: 0, flash: 0, flinch: 0 } } : null;
    this.crew.length = 0;
    if (this.kind === 'bombard' && mt.crew) mt.crew.forEach((c, i) => this.crew.push({ l: c, side: c[0] < 0 ? -1 : 1, e: { scale: .8, ph: 0, mv: 0, atk: -1, torch: i === 0, tint, x: 0, y: 0, z: 0, yaw: 0, flash: 0, flinch: 0 } }));
    if (this.kind === 'bombard') this.makeGun();
    if (this.kind === 'spire') this.makeCrystal();
    if (this.kind === 'guard') { this.respawn = .2; }
    this.state = 'active'; this.appear = 0;
    fxDust(this.x, this.y + .2, this.z, 10, 1.3, { speed: 2.2 });
    sfx('buildDone', this.x, this.z, 1);
    if (this.flame) fxEmbers(this.flame.x, this.flame.y, this.flame.z, 10, .2);
  }
  makeGun() {
    const mt = this.mounts, L = mt.gunLen, r = mt.gunR, S = new Soup(), br = mt.gunCol || (this.lvl >= 2 ? COL.iron : COL.bronze), fl = mt.gunFlare || 1;
    S.cyl(.42, .12, 0, .06, 0, COL.woodD, { n: 8, l: L_WOOD }); for (const sg of [-1, 1]) { S.box(.09, .34, .62, sg * (r + .07), .26, 0, COL.wood, { l: L_WOOD }); S.cyl(.17, .07, sg * (r + .16), .17, -.12, COL.woodD, { n: 8, r: [0, 0, HPI], l: L_WOOD }); }
    this.carriage = new THREE.Mesh(S.build(), MAT.world); this.carriage.castShadow = this.carriage.receiveShadow = true; this.carriage.position.set(mt.gun[0], mt.gun[1], mt.gun[2]); this.group.add(this.carriage);
    const Bq = new Soup(), o = () => ({ n: 8, l: L_METAL, r: [HPI, 0, 0], rough: .42 });
    Bq.cyl(r, L, 0, 0, L / 2 - .28, br, Object.assign(o(), { rt: fl > 1.05 ? fl : .8 })); Bq.cyl(r * 1.16 * (fl > 1.05 ? fl : 1), .12, 0, 0, L - .3, br, o()); Bq.cyl(r * .62, .03, 0, 0, L - .235, COL.black, Object.assign(o(), { jit: 0 }));
    for (const z of [-.2, L * .25, L * .55]) Bq.cyl(r * 1.1 - z * .03, .07, 0, 0, z, mulC(br, .8), o());
    if (mt.gunHot) { Bq.cyl(r * 1.0, .06, 0, 0, L - .22, COL.ember, Object.assign(o(), { emis: .9, jit: 0 })); for (const z of [L * .1, L * .4]) Bq.cyl(r * 1.06, .04, 0, 0, z, COL.ember, Object.assign(o(), { emis: .55, jit: 0 })); }
    Bq.sph(r * .9, 0, 0, -.3, br, { l: L_METAL, w: 6, h: 4, smooth: false, rough: .42 }); Bq.sph(r * .32, 0, 0, -.3 - r * .9, mulC(br, .8), { l: L_METAL, w: 5, h: 3, smooth: false });
    this.barrel = new THREE.Mesh(Bq.build(), MAT.world); this.barrel.castShadow = this.barrel.receiveShadow = true; this.barrel.position.set(0, .4, 0); this.gunPitch = mt.gunPitch || -.42; this.barrel.rotation.x = this.gunPitch; this.carriage.add(this.barrel);
    this.gunYaw = this.yaw;
  }
  makeCrystal() {
    const mt = this.mounts, mk = (sx, sy) => { const S = new Soup(); S.add(gOct(), { s: [sx, sy, sx], c: [1, 1, 1], jit: 0, cf: v => .55 + .45 * smooth(-sy, sy, v.y) + (v.x > 0 ? .12 : 0) }); return S.build(); };
    this.cmat = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(.3, .6, 1) });
    this.crystal = new THREE.Group(); this.crystal.position.set(mt.crystal[0], mt.crystal[1], mt.crystal[2]);
    const c = new THREE.Mesh(mk(mt.crystalS, mt.crystalS * 1.9), this.cmat); c.castShadow = true; this.crystal.add(c); this.core = c;
    this.shards = [];
    for (let i = 0; i < mt.shards; i++) { const s = new THREE.Mesh(mk(.07, .16), this.cmat); this.crystal.add(s); this.shards.push(s); }
    if (mt.rings) { const S = new Soup(); for (let k = 0; k < 7; k++) { if (k === 3) continue; const a = k / 7 * TAU; if (mt.ringIce) S.add(gOct(), { s: [.11, .3, .11], p: [Math.cos(a) * 1.0, 0, Math.sin(a) * 1.0], c: mt.ringCol, emis: .3, jit: .05, r: [0, -a, .5] }); else S.box(.5, .16, .2, Math.cos(a) * 1.0, 0, Math.sin(a) * 1.0, mt.ringCol || COL.basaltL, { l: L_ROCK, r: [0, -a + HPI, 0] }); } this.ringG = new THREE.Mesh(S.build(), MAT.world); this.ringG.castShadow = true; this.ringG.position.y = -1.25; this.crystal.add(this.ringG); }
    this.group.add(this.crystal);
  }
  upgrade() { if (this.lvl >= 2 || this.state !== 'active') return false; this.lvl++; this.spent += this.def.cost[this.lvl]; for (const m of this.men) m.lvlUp = true; this.begin(); return true; }
  // Buy a branch (see TOWER[kind].branches): lvl 3 with the branch's stat table. Overcharge stacks carry over.
  specialize(key, cost) {
    if (this.lvl !== 2 || this.branch || this.state !== 'active' || !this.def.branches || !this.def.branches[key]) return false;
    this.branch = key; this.def = branchDef(this.kind, key); this.lvl = 3; this.spent += cost;
    for (const m of this.men) m.lvlUp = true;
    this.begin(); return true;
  }
  sell() {
    this.alive = false; this.em.alive = false; this.em.on = 0; LT.emitters[this.idx] = null; this.pad.tower = null;
    for (let i = 0; i < 14; i++) { _tm.compose(_tv.set(this.x + rr(-.7, .7), this.y + rr(.3, 2.4), this.z + rr(-.7, .7)), _tq.set(rr(-1, 1), rr(-1, 1), rr(-1, 1), 1).normalize(), _ts.set(1, 1, 1)); addDebris(this.kind === 'archer' || this.kind === 'guard' ? KIT.plank : KIT.rubble, _tm, null, rr(-2, 2), rr(1, 4), rr(-2, 2), rr(3, 9), rr(2, 3.5)); }
    fxDust(this.x, this.y + .4, this.z, 16, 1.6, { speed: 2.6 }); sfx('sell', this.x, this.z, 1);
    for (const m of this.men) m.leave = true;
    this.clearModel(false); R.scene.remove(this.group);
  }
  update(dt) {
    // Stat tables have entries for levels 0-2; a branch (level 3) reads the last entry unless the table has more.
    const d = this.def, lvl = Math.min(this.lvl, d.rate.length - 1); this.recent = Math.max(0, this.recent - dt * .25);
    if (this.state !== 'active') {
      this.bt += dt; const bt = this.bt;
      if (this.scaf) this.scaf.scale.y = bt < this.tEnd - .25 ? easeOutBack(bt / .3) : Math.max(.01, 1 - (bt - (this.tEnd - .25)) / .25);
      for (const p of this.pieces) {
        const u = (bt - p.t0) / .24;
        if (u < 0) continue; p.mesh.visible = true;
        if (u < 1) p.mesh.position.y = p.y + (1 - u * u) * 2.2;
        else { p.mesh.position.y = p.y; const sq = clamp((u - 1) / .5, 0, 1); p.mesh.scale.y = 1 - .1 * Math.sin(sq * PI) * (1 - sq);
          if (!p.landed) { p.landed = true; fxDust(this.x + rr(-.5, .5), this.y + p.y + .1, this.z + rr(-.5, .5), 3, .55, { speed: 1.2, a: .4 }); sfx('hammer', this.x, this.z, .7, rnd()); } }
      }
      this.em.on = damp(this.em.on, 0, 4, dt);
      if (bt >= this.tEnd) this.finish();
      return;
    }
    this.appear = Math.min(1, this.appear + dt * 2.2);
    TOWER_STUN = this.stun > 0;
    if (TOWER_STUN) { this.stun -= dt; const k = Math.min(1, this.stun * 2); FX.add.push(this.x, this.y + 1.7, this.z, 4.2, 5.6, 0, 0, .2, .5, 1.2, .3 * k, 2, 0, 0, 0); if (rnd() < dt * 5) { const a = rnd() * TAU, h = rr(.6, 3); fxBolt([this.x + Math.cos(a) * .8, this.y + h, this.z + Math.sin(a) * .8], [this.x + Math.cos(a + 1.2) * .8, this.y + h + rr(-.5, .5), this.z + Math.sin(a + 1.2) * .8], .12, [.5, .85, 1.5], .03); } if (rnd() < dt * 18) fxPart(this.x + rr(-.7, .7), this.y + rr(.4, 3.2), this.z + rr(-.7, .7), 0, rr(-.5, .1), 0, rr(.4, .9), rr(.05, .08), .6, 1.1, 2.0, { drag: .5 }); }
    this.em.on = damp(this.em.on, TOWER_STUN ? .12 : 1, TOWER_STUN ? 8 : 3, dt);
    if (this.flame) this.flame.on = this.em.on; if (this.flame2) this.flame2.on = this.em.on;
    this.drawGlow(dt);
    this.cool -= dt;
    if (this.kind === 'archer') this.updArcher(dt, d, lvl);
    else if (this.kind === 'bombard') this.updBombard(dt, d, lvl);
    else if (this.kind === 'spire') this.updSpire(dt, d, lvl);
    else this.updGuard(dt, d, lvl);
    TOWER_STUN = false;
  }
  updArcher(dt, d, lvl) {
    const tgt = d.heavy ? findHeavy(this.x, this.z, d.range[lvl]) : findTarget(this.x, this.z, d.range[lvl], true, true, 0, d.airFirst);
    for (const a of this.archers) {
      const p = this.w(a.l, _ap), e = a.e; e.x = p.x; e.y = p.y - (1 - easeOut(this.appear)) * .5; e.z = p.z; e.scale = .82 * (.3 + .7 * this.appear);
      a.cool -= dt;
      if (tgt) {
        const T = clamp(Math.hypot(tgt.x - p.x, tgt.z - p.z) / 14, .22, .62), q = aimPoint(tgt, T, _ap2);
        a.yaw = angDamp(a.yaw, Math.atan2(q.x - p.x, q.z - p.z), 12, dt);
        e.pitch = clamp(Math.atan2(q.y - (p.y + 1), Math.hypot(q.x - p.x, q.z - p.z)) * .7 + .2, -.5, .6);
        a.draw = a.cool < .34 ? Math.min(1, a.draw + dt * 3.6) : Math.max(0, a.draw - dt * 6);
        if (a.cool <= 0 && a.draw > .95) {
          a.cool = d.rate[lvl] * rr(.9, 1.12); a.draw = 0;
          const ax = p.x + Math.sin(a.yaw) * .3, ay = p.y + 1.0, az = p.z + Math.cos(a.yaw) * .3;
          const ar = shootArrow(ax, ay, az, tgt, d.dmg[lvl], this); if (d.pierce) { ar.pierce = d.pierce - 1; ar.big = true; }
          // Volley: the same archer looses extra arrows at other targets nearby (or the same one if alone).
          if (d.multi) for (const o of extraTargets(tgt, this.x, this.z, d.range[lvl], d.multi - 1)) shootArrow(ax, ay, az, o, d.dmg[lvl], this);
          sfx('bow', p.x, p.z, .6, d.pierce ? .1 : rnd());
        }
      } else { a.draw = Math.max(0, a.draw - dt * 3); a.yaw = angDamp(a.yaw, this.yaw + Math.sin(G.t * .5 + a.l[0] * 3) * .5, 2, dt); e.pitch = damp(e.pitch, 0, 4, dt); if (a.cool < .3) a.cool = .3; }
      e.yaw = a.yaw; e.draw = a.draw;
      rigHuman(KIT.foot, SPEC.foot, e);
    }
    // The spotter turns to the target and points it out; idle, he scans the road. Drawing only (no random draws).
    const sp = this.spotter;
    if (sp) {
      const p = this.w(sp.l, _ap), e = sp.e; e.x = p.x; e.y = p.y - (1 - easeOut(this.appear)) * .5; e.z = p.z; e.scale = .8 * (.3 + .7 * this.appear);
      if (tgt) sp.yaw = angDamp(sp.yaw, Math.atan2(tgt.x - p.x, tgt.z - p.z), 5, dt); else sp.yaw = angDamp(sp.yaw, this.yaw + Math.sin(G.t * .4 + this.idx * 2) * 1.1, 1.5, dt);
      e.point = damp(e.point, tgt ? 1 : 0, 4, dt); e.yaw = sp.yaw; e.ph += dt * 2; e.mv = 0;
      if (TOWER_STUN) e.point = 0;
      rigHuman(KIT.foot, SPEC.foot, e);
    }
  }
  updBombard(dt, d, lvl) {
    // The mortar re-picks the densest pack a few times a second; other bombards take the leader.
    let tgt;
    if (d.dense) { this.dT = (this.dT || 0) - dt; if (this.dT <= 0 || !this.dTgt || this.dTgt.dead || this.dTgt.hp <= 0) { this.dT = .35; this.dTgt = findDense(this.x, this.z, d.range[lvl], d.minRange, d.splash[lvl]); } tgt = this.dTgt; if (tgt && dist2(tgt.x, tgt.z, this.x, this.z) > d.range[lvl] * d.range[lvl]) tgt = this.dTgt = null; }
    else tgt = findTarget(this.x, this.z, d.range[lvl], false, true, d.minRange);
    this.recoil = Math.max(0, this.recoil - dt * 1.6);
    let aligned = false;
    if (tgt) {
      const dist = Math.hypot(tgt.x - this.x, tgt.z - this.z), T = d.dense ? clamp(dist / 6, 1.1, 2.1) : clamp(dist / 7.2, .75, 1.45), q = aimPoint(tgt, T, _ap2);
      const want = Math.atan2(q.x - this.x, q.z - this.z); this.gunYaw = angDamp(this.gunYaw, want, 5, dt); aligned = Math.abs(angDiff(this.gunYaw, want)) < .12;
      if (aligned && this.cool <= 0) {
        this.cool = d.rate[lvl] * rr(.95, 1.08); this.recoil = 1;
        this.carriage.updateMatrixWorld(true); const mz = _tv.set(0, 0, this.mounts.gunLen - .2).applyMatrix4(this.barrel.matrixWorld);
        const gy = G.B.heightAt(q.x, q.z);
        G.shells.push({ x0: mz.x, y0: mz.y, z0: mz.z, tx: q.x, ty: Math.max(gy, q.y - tgt.hitH) + .05, tz: q.z, t: 0, T, dmg: d.dmg[lvl], splash: d.splash[lvl], tower: this, x: mz.x, y: mz.y, z: mz.z, sm: 0, arc: (1.5 + dist * .2) * (d.dense ? 1.9 : 1), stun: d.stun || 0, fire: d.fire || (lvl === 2 ? [d.splash[lvl] * .55, 2.6, d.dmg[lvl] * .1] : null), big: !!d.dense , look: this.lvl === 3 ? this.branch : null });
        const dx = Math.sin(this.gunYaw), dz = Math.cos(this.gunYaw);
        lightFlash(mz.x, mz.y + .2, mz.z, 0xffc880, 420, .16, 15);
        fxTimed(5, mz.x + dx * .2, mz.y + .1, mz.z + dz * .2, 1.9, 1.9, 4, 3, 1.6, 1, .1); fxTimed(3, mz.x + dx * .3, mz.y + .12, mz.z + dz * .3, .9, .9, 4, 3.2, 2.2, 1, .2, { grow: .8 });
        for (let i = 0; i < 6; i++) fxSmoke(mz.x + dx * .3, mz.y + .1, mz.z + dz * .3, dx * rr(1, 3.4) + rr(-.5, .5), rr(.3, 1.2), dz * rr(1, 3.4) + rr(-.5, .5), rr(1.2, 2.4), rr(.35, .6), .9, .3, .29, .28, .5, { drag: 2.2, rise: .2 });
        fxSparks(mz.x + dx * .2, mz.y, mz.z + dz * .2, 8, 5, 3, 1.8, .6, { lo: 0, hi: .6 });
        sfx('cannon', this.x, this.z, d.dense ? 1.2 : 1, Math.min(1, lvl / 2)); shake(d.dense ? .12 : .05);
      }
    } else this.gunYaw = angDamp(this.gunYaw, this.yaw + Math.sin(G.t * .3 + this.idx) * .7, 1.2, dt);
    this.carriage.rotation.y = this.gunYaw - this.yaw;
    const k = this.recoil; this.barrel.position.z = -.3 * k * k; this.barrel.rotation.x = this.gunPitch - .1 * k * k;
    this.updCrew();
    if (this.cool > 0 && this.cool < 1.2 && rnd() < dt * 5) { this.carriage.updateMatrixWorld(true); const mz = _tv.set(0, 0, this.mounts.gunLen - .2).applyMatrix4(this.barrel.matrixWorld); fxSmoke(mz.x, mz.y, mz.z, rr(-.1, .1), rr(.3, .6), rr(-.1, .1), 1.2, .18, .35, .3, .3, .3, .22, { drag: 1 }); }
  }
  updSpire(dt, d, lvl) {
    const tgt = findTarget(this.x, this.z, d.range[lvl], true, true);
    const was = this.charge;
    this.charge = tgt ? Math.min(1, this.charge + dt / d.rate[lvl]) : Math.max(0, this.charge - dt * .25);
    if (was < .68 && this.charge >= .68 && tgt) sfx('charge', this.x, this.z, .5);
    const c = this.charge, pulse = .85 + .15 * Math.sin(G.t * (6 + c * 20));
    this.spin += dt * (.8 + c * 5); this.core.rotation.y = this.spin; this.core.position.y = Math.sin(G.t * 1.6 + this.idx) * .05;
    this.shards.forEach((s, i) => { const a = this.spin * .7 + i * TAU / this.shards.length; s.position.set(Math.cos(a) * .58, Math.sin(a * 1.3) * .14 - .05, Math.sin(a) * .58); s.rotation.y = -a * 2; });
    if (this.ringG) this.ringG.rotation.y = -this.spin * .25;
    const k = (.9 + 4.5 * c * c) * pulse * this.appear * (1 + .22 * (this.oc || 0)), cc = this.mounts.crystalCol || SPIRE_STORM; this.cmat.color.setRGB(cc[0] * k, cc[1] * k, cc[2] * k);
    this.em.I = (this.light0 + 70 * c * c) * pulse * (1 + .3 * (this.oc || 0));
    const cp = this.w(this.mounts.crystal, _ap);
    FX.add.push(cp.x, cp.y, cp.z, 1.5 + c, 1.5 + c, 0, 0, cc[0] * .85, cc[1] * .85, cc[2] * .85, (.1 + .22 * c) * pulse, 2, 0, 0, 0);
    const bc = this.mounts.boltCol || SPIRE_BOLT, rods = this.mounts.rods;
    if (rods && c > .25 && frnd() < dt * 7 * c) { const rp = this.w(rods[Math.floor(frnd() * rods.length)], _ap3); fxBolt([rp.x, rp.y, rp.z], [cp.x, cp.y, cp.z], .09, bc, .03); FX.add.push(rp.x, rp.y, rp.z, .8, .8, 0, 0, .8, .6, 1.6, .5, 2, 0, 0, 0); }
    if (this.mounts.ringIce && frnd() < dt * 2.5) fxPart(cp.x + frr(-.9, .9), cp.y + frr(-1.3, .2), cp.z + frr(-.9, .9), 0, frr(-.35, -.1), 0, frr(.8, 1.6), frr(.035, .06), .7, 1.1, 1.6, { drag: .6, wob: 1 });
    if (c > .5 && rnd() < dt * 14 * c) { const a = rnd() * TAU; fxBolt([cp.x, cp.y, cp.z], [cp.x + Math.cos(a) * .7, cp.y + rr(-.5, .5), cp.z + Math.sin(a) * .7], .1, [bc[0] * .9, bc[1] * .9, bc[2] * .9], .035); }
    // Frost spire: a cold field slows everything in range a little, all the time.
    if (d.chill) { this.chT = (this.chT || 0) - dt; if (this.chT <= 0) { this.chT = .5; const r2 = d.range[lvl] * d.range[lvl]; for (const m of G.mons) if (!m.dead && m.vis && m.hp > 0 && dist2(m.x, m.z, this.x, this.z) < r2) { slowMonster(m, d.chill, .7); if (rnd() < .15) fxPart(m.x + rr(-.3, .3), m.y + rr(.1, 1), m.z + rr(-.3, .3), 0, rr(.2, .5), 0, rr(.5, .9), .05, .8, 1.3, 1.8, { drag: 1 }); } } }
    if (c >= 1 && tgt) {
      this.charge = 0; let from = [cp.x, cp.y, cp.z], cur = tgt, dmg = d.dmg[lvl]; const hit = [], jr = d.jumpR || 3.0;
      for (let j = 0; j < d.jumps[lvl] && cur; j++) {
        hit.push(cur); const to = [cur.x, cur.y + cur.hitH, cur.z];
        fxBolt(from, to, .26 - j * .015, bc, .1 - j * .008);
        fxSparks(to[0], to[1], to[2], 5, 3.5, bc[0] * .8, bc[1] * 1.3, bc[2] * 2.5, { grav: 3, size: .06 }); fxTimed(2, to[0], to[1], to[2], 1.6, 1.6, bc[0], bc[1] * 1.15, bc[2] * 1.25, .7, .16);
        if (this.mounts.ringIce) { fxTimed(4, cur.x, cur.y + .1, cur.z, 1.8, 1.8, .5, 1.0, 1.6, .9, .35, { ground: true }); fxSparks(cur.x, cur.y + .2, cur.z, 4, 2, .8, 1.4, 2.2, { size: .05, grav: 4 }); }
        else if (this.mounts.rods) fxBolt(to, [to[0] + frr(-1, 1), G.B.heightAt(to[0], to[2]) + .05, to[2] + frr(-1, 1)], .14, bc, .05);
        const cx = cur.x, cz = cur.z; slowMonster(cur, d.slow[lvl], d.slowT[lvl]);
        if (d.freeze && j === 0) freezeMonster(cur, d.freeze);
        hitMonster(cur, dmg * (d.airMul && cur.fly ? d.airMul : 1), 'bolt', 0, 0, this);
        dmg *= d.falloff || .86; from = to; let nb = null, nd = jr * jr;
        for (const m of G.mons) { if (m.dead || m.hp <= 0 || !m.vis || hit.includes(m)) continue; const dd = dist2(cx, cz, m.x, m.z); if (dd < nd) { nd = dd; nb = m; } }
        cur = nb;
      }
      lightFlash(tgt.x, tgt.y + 1.2, tgt.z, 0x9fd0ff, 520, .22, 16); lightFlash(cp.x, cp.y, cp.z, 0x9fd0ff, 300, .18, 12);
      sfx('zap', this.x, this.z, 1, lvl / 2); shake(.04);
    }
  }
  // Per-frame light and the overcharge look (t.oc, 0-3 stacks): flames grow and burn hotter, a rune circle turns
  // under the tower with more runes lit per stack, embers orbit the top and sparks rise. A few sprites per tower.
  drawGlow(dt) {
    const mt = this.mounts, fc = this.flameCol || [1, 1, 1], a = this.ocA = damp(this.ocA, this.oc || 0, 3, dt), hot = a / 3;
    if (this.kind !== 'spire') this.em.I = this.light0 * (1 + .15 * a);
    if (this.em0) { this.em.r = this.em0[0]; this.em.g = lerp(this.em0[1], .82, hot * .45); this.em.b = lerp(this.em0[2], .62, hot * .45); }
    for (const f of [this.flame, this.flame2]) if (f) { const base = f === this.flame2 && mt.flame2Size ? mt.flame2Size : mt.flameSize; f.size = base * (1 + .1 * a); f.r = fc[0]; f.g = fc[1] * (1 + .05 * a); f.b = fc[2] * (1 + .22 * a); f.embers = 1 + .7 * a; f.layers = base > .7 || a > 2.5 ? 2 : 1; }
    const on = this.em.on * this.appear;
    if (mt.groundGlow && on > .05) { const g = mt.groundGlow, p = .85 + .15 * Math.sin(G.t * 2.3 + this.idx); FX.add.push(this.x, this.y + .12, this.z, 4.2, 4.2, 0, 0, g[0], g[1], g[2], .16 * on * p * (1 + this.charge), 2, 0, 0, 1); }
    if (a < .03 || on < .05) return;
    const A = FX.add, t = G.t, gy = this.y + .1, i = this.idx, sk = Math.min(1, a);
    const cr = lerp(1.5, 1.9, hot), cg = lerp(.5, 1.25, hot * hot), cb = lerp(.12, .55, hot * hot);
    A.push(this.x, gy, this.z, 3.5, 3.5, t * .32 + i, 0, cr, cg, cb, .6 * on * sk, 9, i * 7.3, hot, 1);
    if (a > 1) A.push(this.x, gy + .01, this.z, 2.5, 2.5, -t * .5 - i, 0, cr, cg, cb, .45 * on * Math.min(1, a - 1), 9, i * 3.1 + 40, hot * .8, 1);
    A.push(this.x, gy, this.z, 3.2, 3.2, 0, 0, cr * .5, cg * .3, cb * .2, .22 * on * sk, 2, 0, 0, 1);
    const ex = this.em.x, ey = this.em.y, ez = this.em.z, n = Math.ceil(a * 2 - .01);
    for (let k = 0; k < n; k++) {
      const ang = t * (1.4 + .17 * k) * (k & 1 ? -1 : 1) + k * TAU / n + i, rad = .62 + .12 * (k % 3), y = ey + .1 + Math.sin(t * 2.1 + k * 1.7) * .3, fade = on * Math.min(1, a * 2 - k);
      const px = ex + Math.cos(ang) * rad, pz = ez + Math.sin(ang) * rad;
      A.push(px, y, pz, .13, .13, 0, 0, cr * 2.2, cg * 2.2, cb * 2.2, fade, 0, 0, 0, 0); A.push(px, y, pz, .55, .55, 0, 0, cr * .6, cg * .4, cb * .3, .3 * fade, 2, 0, 0, 0);
    }
    if (a > 2) A.push(ex, ey + 1, ez, 1.2, 3.2, 0, 0, cr * .4, cg * .25, cb * .15, .12 * on * (a - 2), 2, 0, 0, 0);
    this.ocAcc += dt * a * 2.6 * on;
    while (this.ocAcc >= 1) { this.ocAcc -= 1; fxPart(ex + frr(-.3, .3), ey + frr(0, .4), ez + frr(-.3, .3), frr(-.3, .3), frr(1.4, 2.8), frr(-.3, .3), frr(.6, 1.2), frr(.04, .075), cr * 1.8, cg * 1.5, cb, { drag: .4, wob: 1, rise: .4 }); }
  }
  // Bombard crew: gunners on the gun deck who turn with the gun, flinch at the shot and ram the next charge.
  updCrew() {
    const mt = this.mounts, p = this.w(mt.gun, _ap3), cs = Math.cos(this.gunYaw), sn = Math.sin(this.gunYaw), k = this.recoil, rise = (1 - easeOut(this.appear)) * .5;
    for (const c of this.crew) {
      const e = c.e, lx = c.l[0], lz = c.l[1] - .1 * k;
      e.x = p.x + lx * cs + lz * sn; e.z = p.z - lx * sn + lz * cs; e.y = p.y - .05 - rise; e.scale = .8 * (.3 + .7 * this.appear);
      e.yaw = this.gunYaw - c.side * (1.15 - .35 * k); e.flinch = k * k * .9;
      e.atk = k > .08 && k < .6 ? 1 - (k - .08) / .52 : -1;
      if (TOWER_STUN) { e.atk = -1; e.flinch = .5; }
      rigHuman(KIT.foot, SPEC.foot, e);
    }
  }
  updGuard(dt, d, lvl) {
    for (let i = this.men.length - 1; i >= 0; i--) if (this.men[i].gone) this.men.splice(i, 1);
    if (this.men.length < d.n[lvl]) { this.respawn -= dt; if (this.respawn <= 0) { this.respawn = this.men.length === 0 && G.t < 4 ? .5 : d.rate[lvl]; spawnFootman(this); } }
  }
  dispose() { this.alive = false; this.em.alive = false; LT.emitters[this.idx] = null; this.clearModel(false); R.scene.remove(this.group); this.pad.tower = null; }
}
const _ap2 = { x: 0, y: 0, z: 0, tx: 0, tz: 0 }, _ap3 = { x: 0, y: 0, z: 0 };

function shootArrow(x, y, z, m, dmg, tower) {
  const dist = Math.hypot(m.x - x, m.z - z), T = clamp(dist / 14, .22, .62), q = aimPoint(m, T, _ap2);
  return pushAndReturn(G.arrows, { x0: x, y0: y, z0: z, tx: q.x, ty: q.y, tz: q.z, t: 0, T, m, dmg, tower, x, y, z, dx: 0, dy: 0, dz: 1, arc: .25 + dist * .07, alive: true, lI: 22, lCol: 0xff9040, lx: x, ly: y, lz: z, lseed: rnd() * 9, ember: 0 });
}
function pushAndReturn(arr, o) { arr.push(o); return o; }
function pierceNext(m, dx, dz, skip) {
  let best = null, bd = 3.2 * 3.2; const l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l;
  for (const o of G.mons) { if (o.dead || o.hp <= 0 || !o.vis || skip.includes(o)) continue; const ox = o.x - m.x, oz = o.z - m.z, d = ox * ox + oz * oz; if (d < bd && ox * ux + oz * uz > -.2) { bd = d; best = o; } }
  return best;
}
function arrowMatrix(x, y, z, dx, dy, dz) { _tq.setFromUnitVectors(_tz, _tv.set(dx, dy, dz).normalize()); return _tm.compose(_tv.set(x, y, z), _tq, _ts.set(1, 1, 1)); }
function updateProjectiles(dt) {
  const A = G.arrows, B = G.B;
  for (let i = A.length - 1; i >= 0; i--) {
    const a = A[i]; a.t += dt; const u = Math.min(1, a.t / a.T), m = a.m;
    if (m && !m.dead && m.hp > 0) { const q = aimPoint(m, Math.max(0, a.T - a.t), _ap2), k = Math.min(1, dt * 9); a.tx = lerp(a.tx, q.x, k); a.ty = lerp(a.ty, q.y, k); a.tz = lerp(a.tz, q.z, k); }
    const px = a.x, py = a.y, pz = a.z;
    a.x = lerp(a.x0, a.tx, u); a.z = lerp(a.z0, a.tz, u); a.y = lerp(a.y0, a.ty, u) + a.arc * 4 * u * (1 - u);
    const dx = a.x - px, dy = a.y - py, dz = a.z - pz, l = Math.hypot(dx, dy, dz) || 1; a.dx = dx / l; a.dy = dy / l; a.dz = dz / l;
    a.lx = a.x; a.ly = a.y; a.lz = a.z;
    KIT.arrow.put(arrowMatrix(a.x, a.y, a.z, a.dx, a.dy, a.dz), 0, null);
    const hx = a.x + a.dx * .25, hy = a.y + a.dy * .25, hz = a.z + a.dz * .25;
    if (a.tower && a.tower.lvl === 3 && a.tower.branch === 'longbow') FX.segs.push(hx, hy, hz, .06, hx - a.dx * 1.7, hy - a.dy * 1.7, hz - a.dz * 1.7, .0, 2.4, 1.9, 1.1, .9);
    else FX.segs.push(hx, hy, hz, .055, hx - a.dx * .95, hy - a.dy * .95, hz - a.dz * .95, .0, 2.6, 1.05, .25, .85);
    FX.add.push(hx, hy, hz, .3, .3, 0, 0, 3.6, 1.9, .5, 1, 0, 0, 0, 0); FX.add.push(hx, hy, hz, 1.0, 1.0, 0, 0, 1, .45, .12, .22, 2, 0, 0, 0);
    a.ember += dt * 26; while (a.ember > 1) { a.ember -= 1; fxPart(hx, hy, hz, rr(-.4, .4), rr(-.1, .6), rr(-.4, .4), rr(.25, .6), .05, 2.6, 1.1, .2, { drag: 1.5, rise: .6 }); }
    if (u >= 1) {
      a.alive = false; swapRemove(A, i);
      if (m && !m.dead && m.hp > 0 && dist2(a.tx, a.tz, m.x, m.z) < 1.0) {
        fxSparks(a.x, a.y, a.z, 5, 3, 3, 1.5, .4, { size: .055, grav: 6 }); fxTimed(2, a.x, a.y, a.z, .9, .9, 1.6, .8, .25, .8, .12);
        sfx('arrowHit', a.x, a.z, .55, rnd()); hitMonster(m, a.dmg, 'arrow', a.dx, a.dz, a.tower);
        // Longbow arrows fly on into the next monster behind this one.
        if (a.pierce > 0) { const hit = a.hit || [], nx = pierceNext(m, a.dx, a.dz, hit.concat([m])); if (nx) { const b = shootArrow(a.x, a.y, a.z, nx, a.dmg * .85, a.tower); b.pierce = a.pierce - 1; b.hit = hit.concat([m]); b.big = true; } }
      } else if (!m || !m.fly) {
        const gy = B.heightAt(a.x, a.z);
        G.stuck.push({ x: a.x, y: gy + .12, z: a.z, dx: a.dx, dy: Math.min(-.5, a.dy), dz: a.dz, life: 3.2 });
        fxSparks(a.x, gy + .1, a.z, 3, 2, 3, 1.5, .4, { size: .05 });
      }
    }
  }
  const St = G.stuck;
  for (let i = St.length - 1; i >= 0; i--) {
    const s = St[i]; s.life -= dt; if (s.life <= 0) { swapRemove(St, i); continue; }
    KIT.arrow.put(arrowMatrix(s.x, s.y - Math.max(0, .5 - s.life) * .5, s.z, s.dx, s.dy, s.dz), 0, null);
    if (s.life > 1.4) { FX.add.push(s.x - s.dx * .25, s.y - s.dy * .25 + .04, s.z - s.dz * .25, .2, .2, 0, 0, 3, 1.4, .3, Math.min(1, (s.life - 1.4)), 0, 0, 0, 0); if (rnd() < dt * 5) fxPart(s.x, s.y + .1, s.z, rr(-.1, .1), rr(.4, .9), rr(-.1, .1), .6, .045, 2.4, 1, .2, { drag: .5, wob: 1 }); }
  }
  const Sh = G.shells;
  for (let i = Sh.length - 1; i >= 0; i--) {
    const s = Sh[i]; s.t += dt; const u = Math.min(1, s.t / s.T);
    s.x = lerp(s.x0, s.tx, u); s.z = lerp(s.z0, s.tz, u); s.y = lerp(s.y0, s.ty, u) + s.arc * 4 * u * (1 - u);
    const sk = s.look === 'mortar' ? 1.5 : 1;
    _tm.compose(_tv.set(s.x, s.y, s.z), _tq.setFromAxisAngle(_tz, s.t * 9), _ts.set(sk, sk, sk)); KIT.shell.put(_tm, 0, null);
    FX.add.push(s.x, s.y + .1, s.z, .3 * sk, .3 * sk, 0, 0, 3.2, 1.5, .3, 1, 0, 0, 0, 0);
    if (s.look === 'firebomb') { FX.add.push(s.x, s.y - .05, s.z, .55, .75, 0, 1, 3.3, 3.3, 3.3, 1, 1, i * 3.1 + s.t, 0, 0); FX.add.push(s.x, s.y, s.z, 1.6, 1.6, 0, 0, 1, .4, .1, .35, 2, 0, 0, 0); if (frnd() < dt * 40) fxPart(s.x, s.y, s.z, frr(-.4, .4), frr(-.1, .5), frr(-.4, .4), frr(.4, .8), frr(.05, .09), 3, 1.2, .25, { grav: 1.5, drag: 1 }); }
    s.sm += dt * 30; while (s.sm > 1) { s.sm -= 1; fxSmoke(s.x, s.y, s.z, rr(-.1, .1), rr(0, .2), rr(-.1, .1), rr(.5, .9), .16, .3, .26, .25, .25, .32, { drag: 1 }); if (rnd() < .5) fxPart(s.x, s.y, s.z, rr(-.5, .5), rr(-.2, .5), rr(-.5, .5), .4, .05, 2.5, 1.1, .2, { grav: 2 }); }
    if (u >= 1) {
      swapRemove(Sh, i); explodeAt(s.tx, s.ty, s.tz, s.dmg, s.splash, s.tower, s.stun);
      if (s.big) { shake(.3); FX.decals.add(B.heightAt, s.tx, s.tz, s.splash * .9, .02, .016, .013, .9, 50); }
      // Max-level bombards leave a small fire; the firebomb branch a big, long one.
      if (s.fire) addGroundFire(s.tx, s.tz, s.fire[0], s.fire[1], s.fire[2], s.tower);
    }
  }
}
function explodeAt(x, y, z, dmg, splash, tower, stun) {
  const sc = splash / 1.7;
  fxExplosion(x, y, z, sc);
  FX.decals.add(G.B.heightAt, x, z, splash * 1.2, .016, .013, .011, .85, 45);
  sfx('explode', x, z, 1, clamp(sc - .6, 0, 1));
  for (const m of G.mons) {
    if (m.dead || m.hp <= 0 || m.fly || !m.vis) continue;
    const d = Math.hypot(m.x - x, m.z - z); if (d > splash + m.rad) continue;
    const k = lerp(1, .45, sat(d / splash)), l = d || 1;
    if (stun && !m.def.boss) slowMonster(m, .92, stun * k);
    hitMonster(m, dmg * k, 'blast', (m.x - x) / l, (m.z - z) / l, tower);
  }
  for (let i = 0; i < 5; i++) { _tm.compose(_tv.set(x + rr(-.3, .3), y + .2, z + rr(-.3, .3)), _tq.set(rr(-1, 1), rr(-1, 1), rr(-1, 1), 1).normalize(), _ts.set(.6, .6, .6)); addDebris(KIT.rubble, _tm, [.5, .45, .4], rr(-3, 3), rr(3, 6), rr(-3, 3), rr(4, 10), rr(1.6, 2.6)); }
}

// Delayed chain explosions (sappers set off by blasts) and burning ground that hurts monsters.
// G.burns is the player's fire; G.fires (62-game.js) is elite fire that hurts footmen.
G.chain = []; G.burns = [];
function addGroundFire(x, z, r, secs, dps, tower) {
  if (G.burns.length >= 32) G.burns.shift();
  G.burns.push({ x, z, r, t: secs, dps, tower, tick: 0 });
  if (typeof FX.groundFire === 'function') FX.groundFire(x, z, r, secs);
  sfx('burn', x, z, .5);
}
function updateHazards(dt) {
  updateEvents(dt);
  if (G.phase !== 'play') { G.chain.length = 0; G.burns.length = 0; return; }
  for (let i = G.chain.length - 1; i >= 0; i--) {
    const c = G.chain[i]; c.t -= dt; if (c.t > 0) continue; swapRemove(G.chain, i);
    blastAround(c, { r: c.ex.r * 1.15, dmg: c.ex.dmg, men: c.ex.men });
    sfx('chainBoom', c.x, c.z, 1); shake(.4);
  }
  for (let i = G.burns.length - 1; i >= 0; i--) {
    const f = G.burns[i]; f.t -= dt; f.tick -= dt;
    if (f.t <= 0) { swapRemove(G.burns, i); continue; }
    if (typeof FX.groundFire !== 'function' && rnd() < dt * 10) fxEmbers(f.x + rr(-f.r, f.r) * .6, G.B.heightAt(f.x, f.z) + .1, f.z + rr(-f.r, f.r) * .6, 2, .2);
    if (f.tick > 0) continue; f.tick = .25;
    for (const m of G.mons) { if (m.dead || m.hp <= 0 || m.fly || !m.vis) continue; if (dist2(m.x, m.z, f.x, f.z) < (f.r + m.rad) * (f.r + m.rad)) hitMonster(m, f.dps * .25, 'fire', 0, 0, f.tower); }
  }
}
