
SPEC.golem = { hip: .5, pelvisH: .1, torsoH: .56, shX: .36, shY: .44, uArm: .26, lArm: .38, hipX: .15, uLeg: .22, lLeg: .24, stride: .42, lean: .1, stoop: .16, eyeX: .04, eyeY: .1, eyeZ: .16, top: 1.35 };

function golemKit(cap) {
  const k = {}, limb = cap * 2, c = [.34, .34, .37], cd = [.22, .22, .25], gl = [1, .9, .8], rk = () => ({ l: L_ROCK, jit: .08 });
  k.pelvis = new PartBatch(S => { S.rock(.2, 0, 0, 0, cd, { sq: .7 }); }, cap, { rad: .2, shadow: false });
  k.torso = new PartBatch(S => {
    S.rock(.3, 0, .2, 0, c, { sq: .9 }); S.rock(.27, 0, .4, -.02, c, { sq: .7 }); S.rock(.13, -.1, .56, -.12, cd, { sq: .9 });
    for (const s of [-1, 1]) S.rock(.19, s * .33, .44, 0, cd, { sq: .8 });
    S.box(.035, .26, .03, .06, .26, .28, gl, { emis: .1, jit: 0, r: [0, 0, .35] }); S.box(.03, .18, .03, -.07, .3, .28, gl, { emis: .1, jit: 0, r: [0, 0, -.5] }); S.box(.03, .14, .03, 0, .14, .27, gl, { emis: .1, jit: 0, r: [0, 0, 1.2] });
  }, cap, { rad: .3 });
  k.head = new PartBatch(S => { S.rock(.14, 0, .1, .03, c, { sq: .85 }); S.box(.22, .05, .1, 0, .17, .1, cd, rk()); S.box(.15, .035, .03, 0, .1, .155, gl, { emis: .22, jit: 0 }); }, cap, { rad: .14, shadow: false });
  k.uArm = new PartBatch(S => { S.rock(.13, 0, -.12, 0, c, { sq: 1.25 }); }, limb, { rad: .12, shadow: false });
  k.lArm = new PartBatch(S => { S.rock(.17, 0, -.15, 0, c, { sq: 1.15 }); S.rock(.15, 0, -.36, .02, cd, { sq: .9 }); }, limb, { rad: .15, shadow: false });
  k.uLeg = new PartBatch(S => { S.rock(.15, 0, -.1, 0, cd, { sq: 1.1 }); }, limb, { rad: .13, shadow: false });
  k.lLeg = new PartBatch(S => { S.rock(.15, 0, -.12, 0, c, { sq: 1.1 }); S.box(.24, .1, .32, 0, -.24, .04, cd, rk()); }, limb, { rad: .13, shadow: false });
  return k;
}

function initBestiary() {
  const I = KIT.item, cloth = C(0x3b3048), clothL = C(0x6a4a78), wrap = C(0xcdbf9a), N = { rad: .2, shadow: false };
  KIT.golem = golemKit(8);
  I.hood = new PartBatch(S => {
    S.add(gDome(8, 4), { s: [.2, .17, .21], p: [0, .19, -.03], c: cloth, l: L_CLOTH });
    S.box(.34, .24, .1, 0, .1, -.15, cloth, { l: L_CLOTH }); S.box(.3, .05, .05, 0, .2, .15, clothL, { l: L_CLOTH });
    for (const s of [-1, 1]) S.box(.06, .26, .2, s * .18, .1, -.04, mulC(cloth, .8), { l: L_CLOTH });
  }, 12, N);
  I.robe = new PartBatch(S => {
    S.add(gCyl(8, .5, true), { s: [.3, 1.12, .27], p: [0, -.12, 0], c: cloth, l: L_CLOTH, dbl: true, deform: v => { if (v.y < 0) { const j = .85 + .3 * vnoise(Math.atan2(v.z, v.x) * 2 + 3, 1, 7); v.x *= j; v.z *= j; v.y += (j - 1) * .25; } }, cf: v => .7 + .3 * sat(v.y / .56 + .5) });
    S.box(.46, .1, .28, 0, .4, 0, clothL, { l: L_CLOTH }); S.cyl(.2, .05, 0, .02, 0, COL.rope, { n: 8 });
  }, 12, N);
  I.staff = new PartBatch(S => {
    S.seg([0, -.55, 0], [0, .95, 0], .028, .024, COL.woodD, { l: L_WOOD, n: 5 });
    for (let a = 0; a < 3; a++) S.seg([0, .9, 0], [Math.cos(a * 2.1) * .09, 1.08, Math.sin(a * 2.1) * .09], .02, .008, COL.bone, { l: L_BONE, n: 4 });
    S.ico(.075, 0, 1.06, 0, [.35, 1, .5], { d: 1, emis: .2, jit: 0 });
  }, 12, N);
  I.drum = new PartBatch(S => {
    const T = new Soup(); T.cyl(.2, .2, 0, 0, 0, C(0x7a2c24), { n: 10, l: L_WOOD }); T.cyl(.205, .03, 0, .1, 0, C(0xc9b28a), { n: 10 }); T.cyl(.212, .025, 0, -.09, 0, COL.brass, { n: 10, l: L_METAL }); T.cyl(.212, .025, 0, .08, 0, COL.brass, { n: 10, l: L_METAL });
    S.merge(T, { p: [0, .1, .28], r: [.5, 0, 0], ao: null }); S.box(.05, .5, .03, .05, .26, .13, COL.leather, { r: [0, 0, .55] });
  }, 8, N);
  I.standard = new PartBatch(S => {
    S.seg([0, .1, -.14], [0, 1.55, -.2], .022, .018, COL.woodD, { l: L_WOOD, n: 4 }); S.seg([-.2, 1.42, -.2], [.2, 1.42, -.2], .016, .016, COL.woodD, { l: L_WOOD, n: 4 });
    clothPanel(S, { x0: -.18, x1: .18, yTop: 1.41, len: .56, z: -.2, col: COL.clothR, col2: mulC(COL.gold, .6), rng: makeRng(21), sway: 0, nx: 3, ny: 5 });
    PROP.skull(S, 0, 1.62, -.2, .07, 0);
  }, 8, { rad: .3, shadow: false });
  I.stick = new PartBatch(S => { S.seg([0, -.05, 0], [0, .3, 0], .02, .018, COL.bone, { l: L_BONE, n: 4 }); S.ico(.04, 0, .32, 0, COL.boneD, { d: 0, l: L_BONE }); }, 8, N);
  I.keg = new PartBatch(S => {
    const T = new Soup(); PROP.barrel(T, 0, 0, 0, .8, makeRng(3)); S.merge(T, { p: [.215, .26, -.24], r: [0, 0, HPI], ao: null });
    S.seg([0, .4, -.24], [.05, .52, -.22], .012, .01, COL.rope, { n: 3 }); S.ico(.035, .05, .53, -.22, COL.ember, { d: 0, emis: .6, jit: 0 });
    S.box(.05, .5, .03, 0, .22, .12, COL.leather, { r: [0, 0, .5] });
  }, 12, N);
  I.wraps = new PartBatch(S => {
    let k = 0; for (const [y, w, rz] of [[.12, .3, .1], [.2, .33, -.12], [.29, .35, .08], [.37, .37, -.06]]) S.box(w, .05, .25, 0, y, 0, mulC(wrap, .8 + .1 * (k++ & 1) * 3), { l: L_CLOTH, r: [0, 0, rz] });
    S.box(.05, .3, .02, .1, -.08, .12, wrap, { l: L_CLOTH, r: [0, 0, .15] });
  }, 12, N);
  I.wrapHead = new PartBatch(S => { S.cyl(.16, .07, 0, .26, 0, wrap, { n: 8, l: L_CLOTH }); S.cyl(.158, .05, 0, .09, .01, mulC(wrap, .85), { n: 8, l: L_CLOTH }); S.box(.04, .22, .02, .1, .06, -.15, wrap, { l: L_CLOTH, r: [.3, 0, .2] }); }, 12, N);
  I.crown = new PartBatch(S => {
    const g = mulC(COL.gold, .9);
    S.cyl(.165, .07, 0, .3, 0, g, { n: 8, l: L_METAL, rough: .35, emis: .03 });
    for (let a = 0; a < 6; a++) S.cone(.03, .12, Math.cos(a * 1.047) * .15, .39, Math.sin(a * 1.047) * .15, g, { n: 4, l: L_METAL, rough: .35, emis: .03 });
    for (const s of [-1, 1]) S.box(.05, .3, .16, s * .17, .12, -.02, C(0x2a4a8a), { l: L_CLOTH });
    S.ico(.03, 0, .31, .16, [.2, .9, .8], { d: 0, emis: .3, jit: 0 });
  }, 2, N);
  I.khopesh = new PartBatch(S => {
    const g = mulC(COL.gold, .85); S.box(.04, .2, .04, 0, 0, 0, COL.leather, {}); S.box(.14, .03, .05, 0, .11, 0, g, { l: L_METAL });
    let p = [.24, 0]; for (const [y, z] of [[.4, .03], [.52, .1], [.62, .2], [.66, .32]]) { const dy = y - p[0], dz = z - p[1], l = Math.hypot(dy, dz); S.box(.02, l + .02, .075, 0, (y + p[0]) / 2, (z + p[1]) / 2, g, { l: L_METAL, rough: .35, r: [Math.atan2(dz, dy), 0, 0] }); p = [y, z]; }
    S.box(.02, .14, .07, 0, .18, 0, g, { l: L_METAL, rough: .35 });
  }, 2, N);
  I.iceclub = new PartBatch(S => {
    S.seg([0, -.12, 0], [0, .5, 0], .045, .06, COL.wood, { l: L_WOOD, n: 6 });
    for (let a = 0; a < 5; a++) S.add(gOct(), { s: [.09, .25, .09], p: [Math.cos(a * 1.26) * .07, .6 + (a & 1) * .06, Math.sin(a * 1.26) * .07], r: [Math.sin(a * 1.26) * .5, a, -Math.cos(a * 1.26) * .5], c: COL.ice, rough: .15, emis: .05 });
  }, 2, { rad: .1, shadow: false });

  KIT.spider = {
    body: new PartBatch(S => {
      const c = [.3, .27, .27], cd = [.19, .17, .18];
      S.ico(.2, 0, .03, -.2, c, { sc: [.95, .8, 1.25], d: 1 }); S.ico(.13, 0, 0, .08, cd, { sc: [1, .72, 1.1], d: 1 });
      S.box(.07, .02, .13, 0, .19, -.2, [1, .25, .12], { emis: .12, jit: 0 });
      for (const s of [-1, 1]) { S.cone(.025, .1, s * .045, -.06, .2, C(0x1a1414), { n: 4, r: [PI - .5, 0, 0] }); for (const [ex, ey, ez] of [[.035, .06, .19], [.075, .05, .16]]) S.box(.022, .022, .02, s * ex, ey, ez, COL.black, { jit: 0 }); }
    }, 70, { rad: .2 }),
    leg: new PartBatch(S => { const c = [.2, .18, .19]; S.seg([0, 0, 0], [.2, .15, 0], .024, .02, c, { n: 4 }); S.seg([.2, .15, 0], [.4, -.17, 0], .02, .009, c, { n: 4 }); }, 560, { rad: .05, shadow: false }),
  };
  KIT.wolf = {
    body: new PartBatch(S => {
      const f = [.3, .3, .33], fd = [.2, .2, .23];
      S.ico(.2, 0, .02, .16, f, { sc: [.78, .95, 1.15], d: 1 }); S.ico(.16, 0, 0, -.2, fd, { sc: [.78, .85, 1.35], d: 1 }); S.ico(.1, 0, 0, .3, [.42, .42, .45], { sc: [.7, .7, .6], d: 1 });
      for (let k = 0; k < 4; k++) S.cone(.045, .13, 0, .2 - k * .02, .2 - k * .13, fd, { n: 4, r: [-.5, 0, 0] });
      S.seg([0, .08, .3], [0, .2, .46], .11, .085, f, { n: 6 });
      S.ico(.105, 0, .24, .52, f, { sc: [.9, .85, 1.1], d: 1 }); S.box(.085, .07, .17, 0, .21, .66, fd, {}); S.box(.04, .03, .03, 0, .235, .75, COL.black, { jit: 0 }); S.box(.07, .025, .14, 0, .16, .64, C(0x3a1a18), {});
      for (const s of [-1, 1]) { S.cone(.035, .1, s * .065, .35, .48, fd, { n: 4 }); S.box(.025, .022, .02, s * .05, .27, .615, COL.black, { jit: 0 }); S.box(.012, .035, .012, s * .03, .165, .7, COL.bone, { jit: 0 }); }
    }, 28, { rad: .22 }),
    leg: new PartBatch(S => { const fd = [.2, .2, .23]; S.seg([0, 0, 0], [0, -.2, -.03], .055, .038, fd, { n: 5 }); S.seg([0, -.2, -.03], [0, -.39, .02], .034, .026, fd, { n: 5 }); S.box(.06, .035, .09, 0, -.4, .04, [.13, .13, .15], {}); }, 112, { rad: .05, shadow: false }),
    tail: new PartBatch(S => { S.seg([0, 0, 0], [0, -.07, -.3], .055, .02, [.2, .2, .23], { n: 5 }); }, 28, { rad: .05, shadow: false }),
  };
  KIT.wraith = {
    body: new PartBatch(S => {
      const c = [.2, .25, .32], cd = [.12, .15, .2];
      S.add(gCyl(8, .32, true), { s: [.36, .96, .36], p: [0, .5, 0], c, l: L_CLOTH, dbl: true, emis: .012, deform: v => { if (v.y < 0) { const j = .75 + .55 * vnoise(Math.atan2(v.z, v.x) * 2.3 + 1, 2, 9); v.x *= j; v.z = v.z * j - .12; v.y += (j - 1) * .3; } }, cf: v => .55 + .45 * sat(v.y / .48 + .5) });
      S.ico(.22, 0, .9, -.02, cd, { sc: [1.3, .45, .95], d: 1, l: L_CLOTH });
      S.add(gDome(8, 4), { s: [.19, .2, .2], p: [0, 1.06, -.03], c: cd, l: L_CLOTH }); S.box(.3, .22, .1, 0, .98, -.14, cd, { l: L_CLOTH });
      S.sph(.115, 0, 1.03, .05, COL.bone, { sc: [1, 1.05, 1], l: L_BONE, w: 7, h: 5, smooth: false, emis: .03 }); S.box(.11, .06, .08, 0, .93, .1, COL.boneD, { l: L_BONE });
      for (const s of [-1, 1]) S.box(.045, .045, .03, s * .045, 1.04, .15, COL.black, { jit: 0 });
    }, 30, { rad: .3 }),
    arm: new PartBatch(S => { const c = [.16, .2, .27]; S.seg([0, 0, 0], [0, -.1, .3], .075, .05, c, { l: L_CLOTH, n: 5 }); for (let k = -1; k <= 1; k++) S.seg([k * .025, -.1, .3], [k * .05, -.16, .42], .012, .006, COL.bone, { n: 3, l: L_BONE }); }, 60, { rad: .08, shadow: false }),
  };
  KIT.garg = {
    body: new PartBatch(S => {
      const st = [.3, .31, .35], sd = [.2, .21, .24];
      S.ico(.17, 0, 0, 0, st, { sc: [.9, 1.0, 1.05], d: 1, l: L_ROCK }); S.ico(.11, 0, .13, .17, st, { sc: [.95, .9, 1.05], d: 1, l: L_ROCK }); S.box(.1, .06, .1, 0, .08, .27, sd, { l: L_ROCK });
      for (const s of [-1, 1]) {
        S.seg([s * .06, .2, .14], [s * .13, .3, .04], .03, .02, sd, { n: 4 }); S.seg([s * .13, .3, .04], [s * .12, .36, -.08], .02, .006, sd, { n: 4 }); S.box(.03, .03, .02, s * .045, .15, .265, COL.black, { jit: 0 });
        S.seg([s * .12, -.02, .08], [s * .15, -.16, .2], .04, .028, sd, { n: 4 }); S.seg([s * .09, -.1, -.08], [s * .12, -.24, 0], .045, .03, sd, { n: 4 });
      }
      S.seg([0, -.05, -.15], [0, -.14, -.42], .04, .012, sd, { n: 4 }); S.cone(.04, .08, 0, -.15, -.46, sd, { n: 4, r: [-HPI, 0, 0] });
    }, 24, { rad: .2 }),
    wing: new PartBatch(S => {
      const c = [.26, .27, .31], c2 = [.17, .18, .21], pts = [[0, 0, .12], [.3, .06, .2], [.74, .04, .1], [.66, 0, -.1], [.46, 0, -.04], [.36, 0, -.24], [.18, 0, -.1], [0, 0, -.18]];
      for (let i = 1; i < pts.length - 1; i++) { S.tri(pts[0], pts[i + 1], pts[i], i & 1 ? c : c2, L_PLAIN, .9); S.tri(pts[0], pts[i], pts[i + 1], i & 1 ? c : c2, L_PLAIN, .9); }
      S.seg([0, 0, .12], [.3, .06, .2], .03, .022, c2, { n: 4 }); S.seg([.3, .06, .2], [.74, .04, .1], .022, .01, c2, { n: 4 });
    }, 48, { rad: .15, shadow: false }),
  };
  KIT.wisp = { core: new PartBatch(S => { S.ico(.07, 0, 0, 0, [.5, .5, .5], { d: 1, emis: .45, jit: 0 }); }, 60, { rad: .07, shadow: false }) };
  const tc = [.2, .29, .15], tcd = [.13, .2, .1], pale = [.46, .46, .28];
  const toadLeg = sg => new PartBatch(S => { S.seg([0, 0, 0], [sg * .17, .05, -.1], .075, .06, tc, { n: 5 }); S.seg([sg * .17, .05, -.1], [sg * .2, -.12, .08], .055, .04, tcd, { n: 5 }); S.box(.1, .03, .18, sg * .21, -.14, .14, tcd, {}); }, 40, { rad: .1, shadow: false });
  KIT.toad = {
    body: new PartBatch(S => {
      S.ico(.27, 0, .17, -.02, tc, { sc: [1.1, .72, 1.2], d: 1, c2: [pale[0], pale[1], pale[2], v => smooth(0, -.14, v.y)] }); S.ico(.19, 0, .2, .2, tc, { sc: [1.15, .68, 1.0], d: 1 });
      S.box(.34, .02, .2, 0, .15, .27, [.05, .06, .04], { jit: 0 }); S.ico(.12, 0, .08, .26, pale, { sc: [1.1, .7, .8], d: 1 });
      for (const s of [-1, 1]) { S.sph(.075, s * .12, .33, .2, tcd, { w: 6, h: 4 }); S.box(.05, .05, .03, s * .125, .345, .265, COL.black, { jit: 0 }); S.seg([s * .2, .1, .16], [s * .26, -.02, .26], .045, .035, tcd, { n: 4 }); S.box(.08, .025, .1, s * .27, -.03, .3, tcd, {}); }
      for (const [x, y, z] of [[.1, .34, -.1], [-.14, .31, -.02], [.02, .36, -.2], [-.05, .33, .05]]) S.ico(.035, x, y, z, tcd, { d: 0 });
    }, 40, { rad: .3 }),
    legR: toadLeg(1), legL: toadLeg(-1),
  };
  initBestiary4(); initLeviathan(); initHerald();
}

function rigSpider(e) {
  const K = KIT.spider, s = e.scale || 1, fl = e.flash || 0, ph = e.ph, mv = e.mv, Z = [.15, .08, 0, -.08], A = [1.0, .4, -.3, -.9];
  const M0 = xf(_M[0], null, e.x, e.y + (.19 + Math.abs(Math.sin(ph * 2)) * .015 * mv) * s, e.z, -(e.flinch || 0) * .3, e.yaw, Math.sin(ph) * .04 * mv, s, s, s);
  K.body.put(M0, fl, e.tint);
  for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) {
    const g = ((i + (sd > 0 ? 0 : 1)) & 1) ? PI : 0, a = A[i] + Math.sin(ph * 2 + g) * .32 * mv, lift = Math.max(0, Math.cos(ph * 2 + g)) * .3 * mv;
    K.leg.put(xf(_M[1 + i * 2 + (sd > 0 ? 0 : 1)], M0, sd * .09, 0, Z[i], 0, sd > 0 ? -a : PI + a, lift), fl, e.tint);
  }
  return M0;
}
function rigWolf(e, K = KIT.wolf) {
  const ph = e.ph, s = e.scale || 1, fl = e.flash || 0, mv = e.mv, g = Math.sin(ph * 2);
  const M0 = xf(_M[0], null, e.x, e.y + (.43 + Math.abs(g) * .06 * mv) * s, e.z, g * .1 * mv - (e.flinch || 0) * .4, e.yaw, 0, s, s, s);
  K.body.put(M0, fl, e.tint);
  for (let i = 0; i < 4; i++) { const fr = i < 2, sd = (i & 1) ? -1 : 1, a = Math.sin(ph * 2 + (fr ? 0 : 2.6) + (sd > 0 ? 0 : .5)) * .85 * mv; K.leg.put(xf(_M[4 + i], M0, sd * .1, -.04, fr ? .2 : -.26, a, 0, 0), fl, e.tint); }
  K.tail.put(xf(_M[8], M0, 0, .06, -.4, -.3 + g * .2 * mv, Math.sin(ph + 1) * .3, 0), fl, e.tint);
  return M0;
}
function rigWraith(e) {
  const K = KIT.wraith, s = e.scale || 1, fl = e.flash || 0, t = SH.uTime.value + (e.lseed || 0);
  const M0 = xf(_M[0], null, e.x, e.y + (.22 + Math.sin(t * 2.1) * .07) * s, e.z, .16 * e.mv - (e.flinch || 0) * .4, e.yaw, Math.sin(t * 1.3) * .06, s, s, s);
  K.body.put(M0, fl, e.tint);
  for (const sd of [-1, 1]) K.arm.put(xf(_M[sd > 0 ? 1 : 2], M0, sd * .22, .84, .04, -.25 + Math.sin(t * 1.7 + sd) * .22, sd * -.25, 0), fl, e.tint);
  return M0;
}
function rigWisp(e) {
  const s = (e.scale || 1) * (1 + .15 * Math.sin(SH.uTime.value * 9 + (e.lseed || 0) * 5));
  const M0 = xf(_M[0], null, e.x, e.y, e.z, 0, e.yaw, 0, s, s, s); KIT.wisp.core.put(M0, e.flash || 0, e.tint); return M0;
}
function rigToad(e) {
  const K = KIT.toad, s = e.scale || 1, h = e.hop || 0, fl = e.flash || 0;
  let y = 0, pitch = 0, ext = 0, sq = 1;
  if (h < .22) sq = 1 - .22 * easeOut(h / .22);
  else if (h < .62) { const u = (h - .22) / .4; y = Math.sin(u * PI) * .5; pitch = -.45 * Math.cos(u * PI); ext = Math.sin(Math.min(1, u * 1.5) * PI); sq = 1.08; }
  else if (h < .78) sq = 1 - .25 * Math.sin((h - .62) / .16 * PI);
  sq *= 1 - (e.flinch || 0) * .2;
  const M0 = xf(_M[0], null, e.x, e.y + (.1 + y) * s, e.z, pitch, e.yaw, 0, s, s * sq, s);
  K.body.put(M0, fl, e.tint);
  K.legR.put(xf(_M[1], M0, .17, .06, -.14, -ext * .9, 0, 0), fl, e.tint); K.legL.put(xf(_M[2], M0, -.17, .06, -.14, -ext * .9, 0, 0), fl, e.tint);
  return M0;
}

// ---- Round 4 bestiary: siege ram, goblin shaman, harpy, hell hound -------------------------------------
// Each is a handful of instanced parts (one draw call per part while any are alive, none otherwise); only the
// big parts cast shadows. The ram's crew reuse the skeleton kit, so they add no draw calls at all.
SPEC.goblin = { hip: .4, pelvisH: .07, torsoH: .28, shX: .15, shY: .25, uArm: .18, lArm: .19, hipX: .075, uLeg: .2, lLeg: .2, stride: .55, lean: .14, stoop: .3, eyeX: .045, eyeY: .1, eyeZ: .13, top: 1.0 };
const SHAMAN_GLOW = [.45, 1.55, .7];
// Siege ram vault profile: NA facets on an arc from angle A0 to PI - A0, eaves at x = +-.8, y = 1.2.
const RAM_A0 = .32, RAM_RX = .8 / Math.cos(RAM_A0), RAM_RY = .62, RAM_CY = 1.2 - RAM_RY * Math.sin(RAM_A0), RAM_NA = 8;
const ramArc = i => { const a = RAM_A0 + (PI - 2 * RAM_A0) * i / RAM_NA; return [Math.cos(a) * RAM_RX, RAM_CY + Math.sin(a) * RAM_RY]; };
function initBestiary4() {
  const N = { rad: .2, shadow: false };
  // Siege ram: a wheeled timber frame under a hide roof, an iron ram's-head log slung from the ridge.
  {
    const w = COL.wood, wd = COL.woodD, wl = COL.woodL, hide = C(0x9a7652), hideD = C(0x6a4c36), hideL = C(0xb89468), lace = C(0x2a1e16), iron = COL.iron, ironL = COL.ironL;
    const o = () => ({ l: L_WOOD, jit: .07 }), mo = () => ({ l: L_METAL, rough: .5, jit: .04 });
    KIT.ram = {
      frame: new PartBatch(S => {
        // Chassis: two rails on axle blocks, cross beams, corner posts up to the eave rails.
        for (const s of [-1, 1]) {
          S.box(.11, .13, 1.5, s * .4, .44, 0, wd, o());
          for (const z of [-.55, .55]) S.box(.12, .2, .12, s * .4, .33, z, wd, o());
          for (const z of [-.66, .66]) S.box(.08, .74, .08, s * .4, .84, z, w, o());
          S.seg([s * .4, .5, -.6], [s * .4, 1.16, .05], .028, .028, wd, { l: L_WOOD, n: 4 });
          for (const z of [-.66, .66]) S.seg([s * .4, 1.16, z], [s * .78, 1.2, z], .025, .025, wd, { l: L_WOOD, n: 4 });
          S.box(.07, .07, 1.56, s * .78, 1.2, 0, wd, o());
        }
        for (const z of [-.66, .66]) S.box(.84, .09, .09, 0, .5, z, w, o());
        S.box(.96, .08, .08, 0, .9, -.88, wl, o()); for (const s of [-1, 1]) S.box(.06, .06, .24, s * .4, .9, -.77, wd, o());
        // Rear end closed with a hide fan; the front stays open to show the ram's head.
        for (let i = 0; i < RAM_NA; i++) { const [x0, y0] = ramArc(i), [x1, y1] = ramArc(i + 1), hc = mulC(hideD, .85), A = [0, 1.2, -.82], B = [x0, y0, -.82], Cc = [x1, y1, -.82]; S.tri(A, B, Cc, hc, L_PLAIN, .95); S.tri(A, Cc, B, hc, L_PLAIN, .95); }
        // Front: an iron-shod hoop beam, a skull with horns on the crown.
        S.box(1.58, .1, .08, 0, 1.2, .78, iron, mo()); for (const s of [-2, -1, 0, 1, 2]) S.box(.04, .04, .03, s * .3, 1.2, .83, ironL, { l: L_METAL, jit: 0 });
        PROP.skull(S, 0, 1.76, .72, .085, 0); for (const s of [-1, 1]) S.seg([s * .06, 1.8, .7], [s * .2, 1.92, .64], .025, .006, COL.bone, { l: L_BONE, n: 4 });
        S.box(.06, .5, .06, 0, 1.43, .66, wd, o());
      }, 8, { rad: .8, shadow: false }),
      // Vault half (right side; the left is the same piece turned half a turn): a tortoise of stitched hides over
      // three bent ribs, roped down, a ragged fringe at the eave. Two halves so it breaks apart on death.
      vault: new PartBatch(S => {
        for (let i = 0; i < RAM_NA / 2; i++) {
          const [x0, y0] = ramArc(i), [x1, y1] = ramArc(i + 1), mx = (x0 + x1) / 2, my = (y0 + y1) / 2, len = Math.hypot(x1 - x0, y1 - y0) + .03, rz = Math.atan2(y1 - y0, x1 - x0), nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
          // Patches are staggered row by row (four, then three) so the skins do not read as a grid.
          const np = i & 1 ? 3 : 4, pl = 1.64 / np, lit = .78 + .22 * Math.sin(RAM_A0 + (PI - 2 * RAM_A0) * (i + .5) / RAM_NA);
          for (let k = 0; k < np; k++) {
            const z = -.82 + pl * (k + .5), c = mulC([hide, hideL, hideD, hideL, hide][(k + i * 2) % 5], lit);
            S.box(len, .03, pl + .02, mx, my, z, c, { jit: .1, r: [0, 0, rz] });
            if (((k * 5 + i * 3) % 7) === 2) for (const [u, v, sz] of [[-.06, .08, .09], [.07, -.1, .06]]) S.box(sz * 1.3, .034, sz, mx + u * Math.cos(rz) - nx * .004, my + u * Math.sin(rz), z + v, mulC(hideD, lit), { jit: .1, r: [0, 0, rz] });
            if (k) S.box(len - .02, .036, .025, mx - nx * .003, my - ny * .003, z - pl / 2, lace, { jit: 0, r: [0, 0, rz] });
          }
          for (const z of [-.8, 0, .8]) S.box(len + .02, .07, .08, mx + nx * .035, my + ny * .035, z, mulC(wd, .85), { l: L_WOOD, jit: .05, r: [0, 0, rz] });
          for (const z of [-.42, .42]) S.box(len, .04, .04, mx + nx * .018, my + ny * .018, z, COL.rope, { jit: 0, r: [0, 0, rz] });
        }
        const T = new Soup(); clothPanel(T, { x0: -.82, x1: .82, yTop: 1.22, len: .22, z: 0, col: hideD, rng: makeRng(7), sway: 0, nx: 7, ny: 2, rag: .5 }); S.merge(T, { p: [.81, 0, 0], ry: HPI, ao: null });
      }, 16, { rad: .6 }),
      wheel: new PartBatch(S => {
        for (let k = 0; k < 10; k++) { const a = k * TAU / 10; S.box(.075, .07, .17, 0, Math.cos(a) * .23, Math.sin(a) * .23, wd, { l: L_WOOD, jit: .06, r: [a, 0, 0] }); S.box(.085, .025, .175, 0, Math.cos(a) * .275, Math.sin(a) * .275, iron, { l: L_METAL, rough: .5, jit: 0, r: [a, 0, 0] }); }
        for (let k = 0; k < 3; k++) S.box(.045, .44, .045, 0, 0, 0, w, { l: L_WOOD, r: [k * PI / 3, 0, 0] });
        S.cyl(.075, .13, 0, 0, 0, iron, { n: 6, r: [0, 0, HPI], l: L_METAL });
      }, 32, { rad: .27, shadow: false }),
      // Siege mutator only (rigRam): a war banner on a pole at the back and a pair of great horns on the front ridge.
      siege: new PartBatch(S => {
        S.cyl(.025, 1.55, -.42, 1.92, -.72, wd, { n: 4, l: L_WOOD }); S.box(.52, .035, .035, -.19, 2.62, -.72, wd, o());
        // A little self-light (emis) and a brighter red so the banner still reads in shadow, away from any lantern.
        clothPanel(S, { x0: -.44, x1: .04, yTop: 2.6, len: .62, z: -.72, col: mulC(COL.clothR, 1.85), col2: mulC(COL.bone, .95), rng: makeRng(11), sway: .08, nx: 3, ny: 5, rag: .45, emis: .045 });
        PROP.skull(S, -.42, 2.74, -.72, .085, 0);
        for (const s of [-1, 1]) { S.seg([s * .06, 1.6, .8], [s * .36, 1.86, 1.0], .075, .045, COL.bone, { l: L_BONE, n: 5 }); S.seg([s * .36, 1.86, 1.0], [s * .42, 2.2, .88], .045, .008, COL.boneD, { l: L_BONE, n: 4 }); }
      }, 8, { rad: .5 }),
      // Pivot at the ridge; the log hangs .6 below on two ropes and swings about x.
      log: new PartBatch(S => {
        for (const z of [-.45, .45]) for (const s of [-1, 1]) S.seg([s * .05, 0, z], [0, -.64, z], .014, .014, COL.rope, { n: 3 });
        S.seg([0, -.7, -.92], [0, -.7, 1.02], .12, .13, mulC(w, .9), { l: L_WOOD, n: 7 });
        for (const z of [-.45, .45]) S.cyl(.135, .05, 0, -.7, z, COL.rope, { n: 7, r: [HPI, 0, 0] });
        S.cyl(.16, .2, 0, -.7, 1.1, iron, { n: 8, r: [HPI, 0, 0], l: L_METAL, rough: .45 }); S.ico(.15, 0, -.69, 1.22, ironL, { d: 1, sc: [1, .9, .7], l: L_METAL, rough: .4 });
        for (let a = 0; a < 6; a++) S.box(.03, .03, .03, Math.cos(a * 1.05) * .165, -.7 + Math.sin(a * 1.05) * .165, 1.04, ironL, { l: L_METAL, jit: 0 });
        for (const s of [-1, 1]) { let p = [s * .1, -.62, 1.14]; for (const q of [[s * .21, -.56, 1.1], [s * .28, -.64, 1.02], [s * .26, -.78, 1.04], [s * .18, -.8, 1.12]]) { S.seg(p, q, .045, .035, ironL, { l: L_METAL, n: 5 }); p = q; } }
        S.box(.08, .03, .03, 0, -.61, 1.29, COL.black, { jit: 0 });
      }, 8, { rad: .3, shadow: false }),
    };
  }
  // Goblin shaman: hunched, green, a bone mask with a fan of dyed feathers, a bone staff with a glowing tip.
  {
    const sk = C(0x6e8a3a), skD = C(0x4a5e26), lea = mulC(COL.leather, .9), red = C(0xa8362a), teal = C(0x2a8a86), wht = C(0xd8cfb8), o = () => ({ jit: .05 });
    const k = KIT.goblin = {}, cap = 16, limb = cap * 2;
    k.pelvis = new PartBatch(S => { S.box(.2, .09, .14, 0, 0, 0, skD, o()); S.box(.22, .04, .15, 0, .04, 0, lea, {}); clothPanel(S, { x0: -.08, x1: .08, yTop: .02, len: .17, z: .08, col: C(0x6a4a30), rng: makeRng(31), sway: 0, nx: 2, ny: 3 }); clothPanel(S, { x0: -.09, x1: .09, yTop: .02, len: .15, z: -.08, col: C(0x4a3424), rng: makeRng(32), sway: 0, nx: 2, ny: 3 }); }, cap, N);
    k.torso = new PartBatch(S => {
      S.ico(.12, 0, .13, .01, sk, { sc: [1.1, 1.2, .85], d: 1 }); S.ico(.09, 0, .03, .03, skD, { sc: [1.1, .8, 1], d: 1 }); S.ico(.09, 0, .2, -.07, skD, { sc: [1.3, .9, .9], d: 1 });
      for (let i = -3; i <= 3; i++) S.box(.022, .045, .02, i * .033, .21 - Math.abs(i) * .012, .1 - Math.abs(i) * .008, i ? COL.bone : red, { l: L_BONE, jit: 0, r: [0, 0, i * .15] });
      for (const s of [-1, 1]) { S.ico(.07, s * .13, .25, -.02, C(0x3a3028), { sc: [1.2, .7, 1.1], d: 0 }); for (let f = 0; f < 3; f++) S.box(.03, .13, .012, s * (.15 + f * .02), .2, -.04 - f * .03, f & 1 ? teal : C(0x2a2420), { l: L_CLOTH, jit: 0, r: [.3, 0, s * (.4 + f * .2)] }); }
    }, cap, { rad: .15 });
    k.head = new PartBatch(S => {
      S.ico(.105, 0, .09, .02, sk, { sc: [1.1, 1, 1.05], d: 1 }); S.box(.13, .05, .08, 0, .03, .07, skD, {});
      for (const s of [-1, 1]) { S.cone(.035, .17, s * .13, .11, -.01, sk, { n: 4, r: [.2, 0, -s * 1.3] }); S.box(.02, .03, .015, s * .035, .015, .11, COL.bone, { jit: 0 }); }
      S.cone(.03, .1, 0, .07, .14, skD, { n: 4, r: [1.9, 0, 0] });
      S.box(.2, .12, .03, 0, .11, .11, wht, { l: L_BONE, jit: 0 }); S.box(.12, .05, .03, 0, .19, .1, wht, { l: L_BONE, jit: 0 });
      for (const s of [-1, 1]) { S.box(.05, .035, .02, s * .045, .11, .127, COL.black, { jit: 0 }); S.box(.018, .1, .02, s * .085, .1, .125, red, { jit: 0 }); }
      S.box(.024, .07, .02, 0, .16, .125, red, { jit: 0 });
      S.cyl(.11, .03, 0, .17, .0, lea, { n: 8 });
      for (let i = -3; i <= 3; i++) { const a = i * .3, dx = -Math.sin(a), dy = Math.cos(a), c = [red, teal, wht, red, teal, wht, red][i + 3]; S.box(.04, .2, .012, dx * .13, .18 + dy * .12, -.07, c, { l: L_CLOTH, jit: .06, r: [-.35, 0, a] }); S.box(.042, .05, .014, dx * .22, .18 + dy * .21, -.1, COL.black, { jit: 0, r: [-.35, 0, a] }); }
    }, cap, { rad: .14 });
    k.uArm = new PartBatch(S => { S.box(.055, .18, .055, 0, -.09, 0, sk, o()); S.box(.065, .03, .065, 0, -.03, 0, COL.bone, { jit: 0 }); }, limb, N);
    k.lArm = new PartBatch(S => { S.box(.048, .19, .048, 0, -.095, 0, sk, o()); S.ico(.04, 0, -.2, .01, skD, { d: 0 }); }, limb, N);
    k.uLeg = new PartBatch(S => { S.box(.06, .2, .06, 0, -.1, 0, sk, o()); }, limb, N);
    k.lLeg = new PartBatch(S => { S.box(.05, .2, .05, 0, -.1, 0, sk, o()); S.box(.08, .035, .15, 0, -.205, .035, skD, {}); }, limb, N);
    KIT.item.boneStaff = new PartBatch(S => {
      S.seg([0, -.42, 0], [.02, .3, 0], .022, .02, COL.woodD, { l: L_WOOD, n: 5 }); S.seg([.02, .3, 0], [0, .7, 0], .022, .018, COL.bone, { l: L_BONE, n: 5 });
      for (const y of [.28, .5]) S.cyl(.03, .03, .01, y, 0, COL.rope, { n: 6 });
      S.ico(.06, 0, .76, .02, COL.bone, { d: 1, sc: [.9, .8, 1.25], l: L_BONE }); for (const s of [-1, 1]) { S.box(.025, .02, .02, s * .025, .77, .085, COL.black, { jit: 0 }); S.seg([s * .04, .8, 0], [s * .1, .9, -.05], .016, .006, COL.boneD, { l: L_BONE, n: 4 }); }
      S.ico(.05, 0, .88, 0, [.45, 1, .55], { d: 1, emis: .35, jit: 0 });
      for (const s of [-1, 1]) { S.seg([s * .03, .7, 0], [s * .07, .55, .02], .006, .006, COL.rope, { n: 3 }); S.box(.025, .1, .008, s * .075, .5, .02, s > 0 ? red : teal, { l: L_CLOTH, jit: 0, r: [0, 0, s * .2] }); }
    }, 16, { rad: .1, shadow: false });
  }
  // Harpy: a pale woman's torso and face, a wild black mane, broad brown wings, a feathered tail and bird legs
  // whose talons close in flight and open wide on the dive.
  {
    const skin = [.78, .6, .52], skinD = [.46, .35, .33], fe = [.5, .36, .24], feD = [.26, .17, .12], feL = [.85, .68, .46], hair = [.07, .045, .07], leg = [.58, .47, .2], claw = [.05, .04, .04];
    const tawny = [.66, .44, .24], crest = [.62, .17, .1];
    KIT.harpy = {
      body: new PartBatch(S => {
        S.ico(.12, 0, .02, 0, skin, { sc: [1, 1.25, .8], d: 1 }); S.ico(.13, 0, -.14, -.01, feD, { sc: [1.05, 1.05, .95], d: 1 }); S.ico(.08, 0, .06, .07, skinD, { sc: [1.4, .6, .7], d: 1 });
        for (const s of [-1, 1]) { S.ico(.085, s * .12, .1, -.02, fe, { sc: [1.1, .8, 1.1], d: 1 }); S.box(.03, .03, .02, s * .03, .265, .09, COL.black, { jit: 0 }); }
        for (let i = 0; i < 5; i++) { const a = (i - 2) * .22, c = i & 1 ? feL : fe; S.box(.06, .015, .34, Math.sin(a) * .1, -.26 - Math.abs(i - 2) * .015, -.2, c, { jit: .05, r: [-.55, a, 0] }); }
        S.seg([0, .1, 0], [0, .19, .03], .045, .04, skin, { n: 5 });
        S.ico(.08, 0, .25, .04, skin, { sc: [.9, 1.05, 1], d: 1 }); S.box(.08, .04, .05, 0, .2, .085, skinD, {}); S.cone(.015, .04, 0, .245, .12, skinD, { n: 4, r: [HPI, 0, 0] });
        S.ico(.09, 0, .29, .0, hair, { sc: [1.05, .8, 1], d: 1 });
        for (let i = 0; i < 5; i++) { const s = i - 2, k = Math.abs(s); S.box(.05, .035, .2, s * .03, .28 - k * .03, -.1 - k * .015, hair, { jit: .1, r: [-.5 - k * .15, s * .2, 0] }); }
        for (const s of [-1, 1]) S.cone(.02, .07, s * .085, .27, .0, skin, { n: 4, r: [-.2, 0, -s * 1.1] });
        // Seen from above (the usual view, pitched into flight) she is mostly back and hair: a long mane streaming
        // down the back, a crest of rust-red plumes and a pale feathered mantle give her a silhouette and a colour.
        for (let i = 0; i < 4; i++) { const s = i - 1.5; S.box(.045, .03, .3, s * .035, .2 - Math.abs(s) * .02, -.2, i & 1 ? hair : [.16, .07, .09], { jit: .08, r: [-.95 - Math.abs(s) * .08, s * .16, 0] }); }
        for (let i = 0; i < 3; i++) { const s = i - 1; S.box(.03, .012, .2, s * .035, .36, -.04, crest, { jit: .06, r: [-.55, s * .3, 0] }); S.box(.034, .014, .06, s * .055, .375, -.135, feL, { jit: .04, r: [-.55, s * .3, 0] }); }
        S.ico(.11, 0, .1, -.08, feL, { sc: [1.25, .5, .9], d: 1 });
      }, 24, { rad: .2 }),
      wing: new PartBatch(S => {
        // Dark at the root, tawny across the span, the trailing feathers alternating light and dark so the edge reads
        // as separate feathers, and the outer feathers drooping a little so the wing is not one flat sheet.
        const pts = [[0, 0, .06, feD], [.18, .04, .12, fe], [.36, .05, .1, tawny], [.58, .03, .04, tawny], [.86, -.02, -.04, feL], [.82, -.035, -.14, feD], [.7, -.03, -.12, feL], [.66, -.045, -.24, feD], [.54, -.035, -.2, feL], [.48, -.045, -.3, feD], [.36, -.035, -.24, feL], [.28, -.04, -.32, feD], [.16, -.025, -.25, tawny], [.06, -.02, -.28, feD], [0, 0, -.14, feD]];
        const c0 = [.06, .01, -.04, feD];
        for (let i = 0; i < 5; i++) S.box(.1, .012, .055, .08 + i * .1, .05 - i * .006, .07 - i * .016, i & 1 ? feL : [.88, .74, .52], { jit: .05, r: [0, .12, 0] });
        for (let i = 0; i < pts.length - 1; i++) { S.tri(c0, pts[i + 1], pts[i], fe, L_PLAIN, .95); S.tri(c0, pts[i], pts[i + 1], fe, L_PLAIN, .95); }
        S.seg([0, 0, .06], [.36, .05, .1], .03, .02, skinD, { n: 4 }); S.seg([.36, .05, .1], [.58, .03, .04], .02, .012, skinD, { n: 4 });
        for (let i = 0; i < 4; i++) S.box(.22, .01, .045, .7 + i * .035, .005, .0 - i * .045, i & 1 ? feD : fe, { jit: .06, r: [0, .35 + i * .22, 0] });
      }, 48, { rad: .2, shadow: false }),
      leg: new PartBatch(S => { S.ico(.06, 0, -.05, 0, fe, { sc: [1, 1.5, 1.05], d: 1 }); S.seg([0, -.1, 0], [0, -.27, .02], .024, .018, leg, { n: 5 }); }, 48, { rad: .06, shadow: false }),
      foot: new PartBatch(S => {
        for (const x of [-.03, 0, .03]) { S.seg([0, 0, 0], [x * 1.6, -.02, .07], .013, .011, leg, { n: 4 }); S.seg([x * 1.6, -.02, .07], [x * 1.8, -.07, .1], .01, .002, claw, { n: 4 }); }
        S.seg([0, 0, 0], [0, -.02, -.06], .012, .01, leg, { n: 4 }); S.seg([0, -.02, -.06], [0, -.07, -.08], .009, .002, claw, { n: 4 });
      }, 48, { rad: .05, shadow: false }),
    };
  }
  // Hell hound: the wolf's build, charcoal hide split by glowing cracks, a spiked mane, horns, ember eyes and maw.
  {
    const ch = [.15, .1, .09], chD = [.09, .065, .06], ash = [.26, .22, .2], em = COL.ember, hot = { emis: .45, jit: 0 };
    KIT.hound = {
      body: new PartBatch(S => {
        S.ico(.22, 0, .03, .15, ch, { sc: [.82, 1.0, 1.15], d: 1 }); S.ico(.17, 0, 0, -.2, ch, { sc: [.8, .88, 1.32], d: 1 }); S.ico(.15, 0, .03, -.03, chD, { sc: [.85, .95, 1.4], d: 1 }); S.ico(.1, 0, -.02, .3, ash, { sc: [.7, .7, .6], d: 1 });
        S.seg([0, .08, .3], [0, .21, .46], .12, .09, ch, { n: 6 });
        S.ico(.11, 0, .25, .52, ch, { sc: [.95, .85, 1.1], d: 1 }); S.box(.09, .07, .19, 0, .21, .67, chD, {}); S.box(.04, .03, .03, 0, .235, .77, COL.black, { jit: 0 });
        S.box(.075, .03, .15, 0, .155, .65, em, { emis: .45, jit: 0 }); S.box(.08, .025, .15, 0, .14, .65, chD, {});
        for (const s of [-1, 1]) {
          S.seg([s * .06, .33, .48], [s * .1, .4, .36], .03, .008, ash, { n: 4 }); S.box(.025, .022, .02, s * .05, .275, .62, COL.black, { jit: 0 }); S.box(.012, .04, .012, s * .03, .15, .72, COL.bone, { jit: 0 });
          // Glowing cracks: short zigzags laid flush on the flank and haunch.
          for (const [y, z, r, l] of [[.12, .28, .5, .08], [.05, .24, -.6, .07], [-.03, .27, .4, .06], [.08, .1, -.3, .09], [0, .05, .7, .07], [.07, -.18, -.4, .08], [-.01, -.22, .6, .07], [-.08, -.17, -.3, .05]]) {
            const R = z > -.05 ? .18 : .136, cz = z > -.05 ? .15 : -.2, sy = z > -.05 ? .22 : .15, ry = z > -.05 ? .25 : .23, k = Math.sqrt(Math.max(0, 1 - (y - .02) * (y - .02) / (sy * sy) - (z - cz) * (z - cz) / (ry * ry)));
            S.box(.01, l, .014, s * R * k, y, z, em, { emis: .45, jit: 0, r: [r, 0, 0] });
          }
        }
        for (let k = 0; k < 7; k++) { const z = .42 - k * .1, h = k < 4 ? .17 - k * .015 : .1; S.cone(.04, h, 0, .22 - k * .012 + (k < 3 ? .06 - k * .02 : 0), z, k & 1 ? ash : chD, { n: 4, r: [-.75, 0, 0] }); if (k < 5) S.box(.02, .02, .05, 0, .21 - k * .015, z - .01, em, { emis: .45, jit: 0 }); }
        for (const s of [-1, 1]) for (let k = 0; k < 3; k++) S.cone(.035, .13 - k * .02, s * .07, .28 - k * .03, .36 - k * .09, chD, { n: 4, r: [-.8, 0, -s * .5] });
      }, 30, { rad: .22 }),
      leg: new PartBatch(S => { S.seg([0, 0, 0], [0, -.2, -.03], .06, .04, ch, { n: 5 }); S.seg([0, -.2, -.03], [0, -.39, .02], .036, .028, chD, { n: 5 }); S.box(.012, .1, .014, 0, -.1, .035, em, hot); S.box(.065, .035, .1, 0, -.4, .04, chD, {}); for (const x of [-.02, .02]) S.cone(.01, .04, x, -.41, .1, COL.bone, { n: 3, r: [HPI, 0, 0] }); }, 120, { rad: .05, shadow: false }),
      tail: new PartBatch(S => { S.seg([0, 0, 0], [0, -.07, -.3], .06, .025, ch, { n: 5 }); S.cone(.035, .12, 0, -.09, -.36, em, { n: 4, emis: .5, jit: 0, r: [-1.8, 0, 0] }); }, 30, { rad: .05, shadow: false }),
    };
  }
  for (const p of [KIT.goblin.pelvis, KIT.goblin.head]) p.mesh.castShadow = false;
  // Death bits: a flat feather (floats down) and a wood splinter.
  KIT.feather = new PartBatch(S => { S.box(.05, .008, .17, 0, 0, .01, [.8, .8, .8], { jit: .05 }); S.box(.008, .012, .2, 0, .004, 0, [.95, .95, .9], { jit: 0 }); }, 160, { shadow: false, rad: .04 });
  KIT.splinter = new PartBatch(S => { S.box(.05, .035, .32, 0, 0, 0, COL.woodL, { l: L_WOOD, jit: .1 }); S.box(.03, .03, .1, .01, .01, .19, COL.wood, { l: L_WOOD, r: [.3, .2, 0] }); }, 120, { shadow: false, rad: .05 });
}

// Siege ram: frame, four wheels that roll with the distance travelled, a log that sways on its ropes and swings
// back then drives forward on an attack (e.atk 0-1), a shudder when hit (e.flinch), and 2-3 skeleton crew
// pushing the rear bar (skeleton kit, e.push pose). Returns the frame matrix (_M[20]); rigHuman uses _M[0-13].
const RAM_CREW = [[.3, -1.3, 0], [-.3, -1.32, 1.7], [0, -1.55, 3.1]];
function rigRam(e) {
  const K = KIT.ram, s = e.scale || 1, fl = e.flash || 0, tint = e.tint || null, mv = e.mv || 0, fz = e.flinch || 0, t = SH.uTime.value + (e.lseed || 0);
  const jx = fz * Math.sin(t * 61) * .035, roll = fz * Math.sin(t * 47) * .05 + Math.sin(e.ph * .8) * .012 * mv, bump = Math.abs(Math.sin(e.ph * 1.3)) * .012 * mv;
  const M0 = xf(_M[20], null, e.x, e.y + bump * s, e.z, -fz * .03, e.yaw, roll, s, s, s);
  if (jx) M0.multiply(_rm.makeTranslation(jx, 0, 0));
  K.frame.put(M0, fl, tint); if (G.mods && G.mods.indexOf('siege') >= 0) K.siege.put(M0, fl, tint); K.vault.put(M0, fl, tint); K.vault.put(xf(_M[26], M0, 0, 0, 0, 0, PI, 0), fl, tint);
  const wa = e.ph * .661;
  for (let i = 0; i < 4; i++) K.wheel.put(xf(_M[21 + i], M0, i & 1 ? -.5 : .5, .28, i < 2 ? .55 : -.55, wa + i, 0, 0), fl, tint);
  let sw = Math.sin(t * 1.9) * .06 * mv + Math.sin(e.ph * .9) * .035 * mv + fz * .08;
  const a = e.atk === undefined ? -1 : e.atk;
  sw -= .6 * Math.sin(sat(e.shove || 0) * PI);
  if (a >= 0) sw += a < .4 ? .55 * easeInOut(a / .4) : a < .52 ? lerp(.55, -.5, easeIn((a - .4) / .12)) : -.5 * (1 - easeOut((a - .52) / .48));
  K.log.put(xf(_M[25], M0, 0, 1.6, 0, sw, 0, 0), fl, null);
  // Crew: computed from the frame each call (also under shatter), with skeleton gait and a push pose.
  const n = (e.lseed || 0) > 6 ? 3 : 2, cy = Math.cos(e.yaw), sy = Math.sin(e.yaw);
  let cr = e.crew; if (!cr) { cr = e.crew = []; for (let i = 0; i < 3; i++) cr.push({ x: 0, y: 0, z: 0, yaw: 0, ph: 0, mv: 0, scale: 1, flash: 0, flinch: 0, atk: -1, push: 1, shamble: false, tint: null, eyes: [0, 0, 0, 0, 0, 0] }); }
  for (let i = 0; i < n; i++) {
    const c = cr[i], P = RAM_CREW[i], lx = P[0] * s + jx, lz = P[1] * s;
    c.x = e.x + lx * cy + lz * sy; c.z = e.z - lx * sy + lz * cy; c.y = e.y; c.yaw = e.yaw;
    c.ph = e.ph * 1.05 + P[2]; c.mv = Math.max(.35, mv); c.scale = .88 * s; c.flash = fl; c.flinch = fz * .5; c.tint = e.crewTint || null;
    c.push = (a > .38 && a < .7) || (e.shove || 0) > .3 ? 1.6 : 1;
    const H = rigHuman(KIT.skel, SPEC.skel, c);
    for (let k = 0; k < 2; k++) { _rv.set((k ? 1 : -1) * SKEL_EYE[0], SKEL_EYE[1], SKEL_EYE[2]).applyMatrix4(H); c.eyes[k * 3] = _rv.x; c.eyes[k * 3 + 1] = _rv.y; c.eyes[k * 3 + 2] = _rv.z; }
  }
  e.crewN = n;
  return M0;
}

// Goblin shaman: the human rig on the goblin kit, bone staff in the right hand. e.cast (0-1) raises the staff
// overhead (rigHuman's cast pose); drawMonster adds the tip glow and the ward flare.
function rigShaman(e) { e.weapon = KIT.item.boneStaff; e.staffOut = true; e.wScale = 1; return rigHuman(KIT.goblin, SPEC.goblin, e); }

// Harpy: flaps on e.ph like the bat. e.swoop (0 cruise, 1 dive, 2 carrying; eased here into e.swD / e.swC)
// pitches it into a dive with the wings swept back and the talons thrown forward and open, or, while carrying a
// footman (e.carry), hauls upright with the legs straight down, talons shut and the wings beating hard.
// The model is drawn 12 % over its size (looks only; hits use def.rad) so she reads against the ground.
function rigHarpy(e) {
  const K = KIT.harpy, s = (e.scale || 1) * 1.12, fl = e.flash || 0, tint = e.tint || null, fz = e.flinch || 0, w = e.swoop || 0;
  // Eased on game time since its last drawing, so the ease keeps its pace when steps go undrawn (off screen, 2x/3x).
  const dt = clamp(G.t - (e._rigT === undefined ? G.t - (FX.dt || 0) : e._rigT), 0, .25); e._rigT = G.t;
  e.swD = damp(e.swD || 0, w === 1 ? 1 : 0, 7, dt); e.swC = damp(e.swC || 0, w >= 2 || e.carry ? 1 : 0, 6, dt);
  const sw = e.swD, cr = e.swC, f = Math.sin(e.ph), calm = 1 - Math.max(sw, cr);
  const pitch = lerp(lerp(.5, 1.25, sw), .12, cr) - fz * .5, bob = Math.sin(e.ph - .6) * (.07 + .05 * cr) * (1 - sw);
  const M0 = xf(_M[0], null, e.x, e.y + bob, e.z, pitch, e.yaw, Math.sin(e.ph * .25) * .12 * calm, s, s, s);
  K.body.put(M0, fl, tint);
  const flap = lerp(lerp(f * .95 + .1, .55 + f * .08, sw), f * 1.15 + .2, cr), sweep = -.95 * sw, wp = -pitch * .75;
  K.wing.put(xf(_M[1], M0, .1, .12, -.02, wp, sweep, flap), fl, tint);
  K.wing.put(xf(_M[2], M0, -.1, .12, -.02, wp, -sweep, PI - flap), fl, tint);
  const lw = lerp(lerp(1.3 + .08 * f, -.6, sw), -.08, cr), open = lerp(lerp(1.1, -.35, sw), .95, cr), ts = 1 + .25 * sw;
  for (const sd of [-1, 1]) {
    const L = xf(_M[sd > 0 ? 3 : 4], M0, sd * .07, -.2, -.02, lw - pitch + sd * .04 * f * calm, 0, sd * (.08 + .1 * cr)), FT = xf(_M[sd > 0 ? 5 : 6], L, 0, -.28, .02, open, 0, 0, ts, ts, ts);
    K.leg.put(L, fl, tint); K.foot.put(FT, fl, tint);
  }
  return M0;
}

// Hell hound: the wolf rig and gait on the hound kit. If its death kind is not 'fur', its ph runs at the walker
// rate (5.6 per unit, not 7.5), so the gait is sped up to keep the feet planted.
function rigHound(e) { const p = e.ph; if (!e.def || e.def.death !== 'fur') e.ph = p * 1.34; try { return rigWolf(e, KIT.hound); } finally { e.ph = p; } }

// Per-frame extras for the round 4 monsters (called from drawMonster with the rig's returned matrix M).
// Fields read: ram e.crew/e.crewN (set by rigRam), e.mv; shaman e.cast (0-1, set by the behaviour when it
// wards; decays in updateUnits) and def.wardCast.r (ring radius, default 3); harpy e.swoop, e.vx/e.vz.
const _d4 = new THREE.Vector3();
function drawMonster4(m, t, ty, M, tw, sc) {
  if (!(m.vis || m.fly) || m.dead) return;
  const A = FX.add, dt = FX.dt || 0;
  if (ty === 'ram') {
    const c = m.def.eye, n = m.crewN || 0, r = SKEL_EYE[3] * sc * 1.4;
    for (let i = 0; i < n; i++) { const E = m.crew[i].eyes; for (let k = 0; k < 6; k += 3) A.push(E[k], E[k + 1], E[k + 2], r, r, 0, 0, c[0], c[1], c[2], tw, 0, 0, 0, 0); }
    if (m.mv > .3 && frnd() < dt * 4 * m.mv) { _d4.set(frnd() < .5 ? .5 : -.5, .05, -.62).applyMatrix4(M); fxDust(_d4.x, m.y + .05, _d4.z, 1, .45, { a: .3, speed: .6 }); }
  } else if (ty === 'shaman') {
    const g = SHAMAN_GLOW, cs = m.cast || 0; _d4.set(0, .88, 0).applyMatrix4(_M[8]);
    A.push(_d4.x, _d4.y, _d4.z, .15 + .15 * cs, .15 + .15 * cs, 0, 0, g[0] * 1.2, g[1] * 1.2, g[2] * 1.2, .8 * tw, 0, 0, 0, 0);
    A.push(_d4.x, _d4.y, _d4.z, .9 + 1.4 * cs, .9 + 1.4 * cs, 0, 0, g[0] * .4, g[1] * .4, g[2] * .4, (.3 + .3 * cs) * tw, 2, 0, 0, 0);
    if (frnd() < dt * (1.5 + 14 * cs)) fxPart(_d4.x + frr(-.06, .06), _d4.y, _d4.z + frr(-.06, .06), frr(-.2, .2), frr(.3, .9) + cs, frr(-.2, .2), frr(.4, .8), frr(.03, .05), g[0] * 1.6, g[1] * 1.6, g[2] * 1.6, { drag: .8, wob: 1, rise: .2 });
    if (cs > .85 && !m._cfx) {
      m._cfx = 1; const w = m.def.wardCast || m.def.ward, R0 = (w && w.r) || m.def.wardR || 3;
      fxTimed(4, m.x, m.y + .08, m.z, R0 * 2, R0 * 2, g[0], g[1], g[2], .8, .7, { ground: true }); fxTimed(5, _d4.x, _d4.y, _d4.z, 1.8, 1.8, g[0] * 1.5, g[1] * 1.5, g[2] * 1.5, .9, .3);
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; fxPart(m.x + Math.cos(a) * R0 * .5, m.y + .15, m.z + Math.sin(a) * R0 * .5, Math.cos(a) * 1.2, frr(.4, 1.2), Math.sin(a) * 1.2, frr(.5, .9), .05, g[0] * 1.4, g[1] * 1.4, g[2] * 1.4, { drag: 1.2, rise: .3 }); }
    } else if (cs < .3) m._cfx = 0;
    m.glowL = cs > .05; m.lI = 7 * cs; m.lCol = 0x70ff90; m.lx = _d4.x; m.ly = _d4.y; m.lz = _d4.z;
  } else if (ty === 'harpy') {
    // (nothing extra: the dive reads from the pose)
  } else if (ty === 'hound') {
    const fl = .8 + .2 * Math.sin(t * 13 + m.lseed * 5);
    _d4.set(0, .2, .1).applyMatrix4(M); A.push(_d4.x, _d4.y, _d4.z, 1.5 * sc, 1.5 * sc, 0, 0, 1.0, .32, .06, .2 * fl, 2, 0, 0, 0);
    _d4.set(0, .36, .3).applyMatrix4(M);
    if (frnd() < dt * 7) fxSmoke(_d4.x, _d4.y, _d4.z, frr(-.15, .15), frr(.5, 1), frr(-.15, .15), frr(.6, 1.1), .13 * sc, .55, .09, .08, .08, .4, { drag: .9, rise: .2 });
    if (frnd() < dt * 5) fxPart(_d4.x + frr(-.08, .08), _d4.y, _d4.z + frr(-.08, .08), frr(-.3, .3), frr(.6, 1.4), frr(-.3, .3), frr(.4, .8), frr(.035, .06), 2.6, .9, .2, { drag: .5, wob: 1, rise: .3 });
  }
}

// Deaths for the round 4 models. killMonster looks up RIG_DEATH by def.rig first (so a MON entry keeps its own
// def.death for gameplay, e.g. the gait rate), runs DEATH_FX[kind], and fxGore adds the loose bits after.
const RIG_DEATH = { ram: 'wood', shaman: 'hex', harpy: 'feather', hound: 'ember' };
const DEATH_FX = {
  // Siege ram: the frame, wheels, log and crew fly apart; dust and a heavy crack.
  wood(m, kind, ix, iz, up) {
    shatter(e => rigMonster(e), m, [ix, 1.5 * up, iz], { spread: 1.9, life: .9, up });
    // Sound: the audio plays ramDie on its own (it watches G.mons), so no sfx() here.
    fxDust(m.x, m.y + .2, m.z, 9, 1.1, { speed: 2.6 }); shake(.3);
  },
  // Harpy: falls apart in the air with a screech and a burst of pale down.
  feather(m, kind, ix, iz) {
    shatter(e => rigMonster(e), m, [ix + m.vx * .5, .6, iz + m.vz * .5], { spread: 1.2, life: .8 });
    // Sound: harpyDie, from the audio.
    for (let i = 0; i < 5; i++) fxSmoke(m.x + frr(-.2, .2), m.y + frr(-.1, .2), m.z + frr(-.2, .2), frr(-.6, .6), frr(-.2, .5), frr(-.6, .6), frr(.6, 1), .22, .5, .5, .45, .42, .5, { drag: 2 });
  },
  // Hell hound: bursts into embers and black smoke, leaving a scorch mark.
  ember(m, kind, ix, iz, up) {
    shatter(e => rigMonster(e), m, [ix, 2 * up, iz], { spread: 1.4, life: .6 });
    // Sound: houndDie, from the audio.
    const sc = m.scale || 1; fxTimed(5, m.x, m.y + .45 * sc, m.z, 2.2 * sc, 2.2 * sc, 2.2, .8, .2, .9, .25); fxEmbers(m.x, m.y + .3, m.z, 18, .35 * sc);
    for (let i = 0; i < 6; i++) fxSmoke(m.x + frr(-.2, .2), m.y + frr(.2, .6), m.z + frr(-.2, .2), frr(-.5, .5), frr(.6, 1.4), frr(-.5, .5), frr(1, 1.8), .3 * sc, .8, .08, .07, .07, .55, { drag: 1.5, rise: .3 });
    lightFlash(m.x, m.y + 1, m.z, 0xff7030, 120, .3, 10);
  },
  // Goblin shaman: its ward magic escapes in a green flash and rising motes.
  hex(m, kind, ix, iz, up) {
    shatter(e => rigMonster(e), m, [ix, 1.6 * up, iz], { spread: 1.4, life: .7, up });
    // Sound: shamanDie, from the audio.
    const g = SHAMAN_GLOW; fxTimed(5, m.x, m.y + .6, m.z, 2.4, 2.4, g[0] * 1.6, g[1] * 1.6, g[2] * 1.6, .9, .3);
    for (let i = 0; i < 12; i++) fxPart(m.x + frr(-.25, .25), m.y + frr(.2, .9), m.z + frr(-.25, .25), frr(-.4, .4), frr(.6, 1.8), frr(-.4, .4), frr(.5, 1.1), frr(.04, .07), g[0] * 1.6, g[1] * 1.6, g[2] * 1.6, { drag: .6, wob: 1, rise: .3 });
  },
};

// ---- Round 6: The Drowned King (RIGS.leviathan), boss of Stormreach ---------------------------------------------
// A hulking sea giant on the human rig (heavy gait): grey-green drowned flesh, corroded verdigris armour plates
// crusted with barnacles, kelp draped over the shoulders and hanging from the belt and beard, chains across the
// chest and dangling from broken manacles, a crown of branching coral, glowing sea-green eyes (def.eye), and a
// ship's anchor for a weapon (KIT.item.anchor). Water drips off him as he walks, he leaves wet footprints, and he
// dies in a burst of sea water (RIG_DEATH 'drown'). Registered in initLeviathan (RIGS, EYES and RIG_DEATH live in
// 61-monsters.js and here; MON.leviathan below is only a stand-in until the game's own entry exists).
SPEC.leviathan = { hip: .5, pelvisH: .1, torsoH: .55, shX: .34, shY: .45, uArm: .28, lArm: .32, hipX: .13, uLeg: .25, lLeg: .25, stride: .45, lean: .1, stoop: .2, eyeX: .055, eyeY: .125, eyeZ: .16, top: 1.45 };
const DROWN = { skin: C(0x74928a), skinD: C(0x46605a), plate: C(0x4f7d6a), plateD: C(0x24382f), iron: C(0x3c4048), barn: C(0x9e9a8c), kelp: C(0x3e3c1c), kelpL: C(0x56582a), coral: C(0xc4553a), coralP: C(0xd8806c), coralY: C(0xd8b070), glow: [.35, 1.5, 1.2] };
function initLeviathan() {
  const D = DROWN, sh = { rad: .2 };
  const skin = (S, r, x, y, z, sc, c) => S.ico(r, x, y, z, c || D.skin, { sc, d: 1, jit: .05 });
  const plate = (S, w, h, d, x, y, z, r, c) => S.box(w, h, d, x, y, z, c || D.plate, { l: L_METAL, rough: .55, r, jit: .06 });
  const barn = (S, n, cx, cy, cz, sp, rng) => { for (let k = 0; k < n; k++) S.cone(.016 + .01 * rng(), .022, cx + rng.range(-sp, sp), cy + rng.range(-sp, sp) * .6, cz + rng.range(-sp * .4, sp * .4), mulC(D.barn, .8 + .3 * rng()), { n: 5, rough: .8, jit: 0 }); };
  const link = (S, a, b, n, r, o = {}) => { for (let k = 0; k < n; k++) { const u = (k + .5) / n; S.add(gTorus(6, .32, 3), { s: [r * 1.4, r, r], p: [lerp(a[0], b[0], u), lerp(a[1], b[1], u) - (o.sag || 0) * Math.sin(u * PI), lerp(a[2], b[2], u)], r: [k & 1 ? HPI : 0, Math.atan2(b[0] - a[0], b[2] - a[2]) + HPI, 0], c: mulC(D.iron, 1.15), l: L_METAL, rough: .6, sway: o.sway ? o.sway * u : 0, jit: 0 }); } };
  const strand = (S, x, y, z, len, w, c, rng, out = [0, 0]) => { let p = [x, y, z]; for (let k = 0; k < 3; k++) { const u = (k + 1) / 3, q = [x + out[0] * u + rng.range(-.02, .02), y - len * u, z + out[1] * u + rng.range(-.02, .02)]; ribbon(S, [p[0] - w, p[1], p[2]], [p[0] + w, p[1], p[2]], [q[0] + w * .8, q[1], q[2]], [q[0] - w * .8, q[1], q[2]], mulC(c, .8 + .4 * rng()), [k * .25, k * .25, u * .9, u * .9]); p = q; } };
  const K = KIT.drowned = {};
  K.pelvis = new PartBatch(S => {
    const rng = makeRng(61);
    skin(S, .23, 0, 0, 0, [1.2, .65, 1.0], D.skinD);
    S.cyl(.26, .08, 0, .06, 0, D.iron, { n: 10, l: L_METAL, rough: .6 }); S.box(.1, .09, .04, 0, .06, .26, mulC(D.plate, 1.2), { l: L_METAL, rough: .4 });
    for (const sg of [-1, 1]) { plate(S, .15, .22, .03, sg * .1, -.1, .21, [-.15, 0, sg * .12]); plate(S, .13, .2, .03, sg * .2, -.08, .06, [0, sg * HPI * .8, sg * .2], D.plateD); }
    plate(S, .3, .2, .03, 0, -.08, -.2, [.15, 0, 0], D.plateD); barn(S, 8, .1, -.08, .23, .06, rng);
    for (let k = 0; k < 9; k++) { const a = (k + .3) / 9 * TAU; strand(S, Math.cos(a) * .25, .03, Math.sin(a) * .25, rng.range(.22, .38), .025, k & 1 ? D.kelp : D.kelpL, rng, [Math.cos(a) * .05, Math.sin(a) * .05]); }
    link(S, [-.24, .04, .12], [.2, .0, .2], 6, .03, { sag: .07, sway: .3 });
  }, 2, sh);
  K.torso = new PartBatch(S => {
    const rng = makeRng(62);
    skin(S, .3, 0, .2, .03, [1.15, .85, .95]); skin(S, .3, 0, .41, -.04, [1.32, .72, .9]); skin(S, .14, 0, .5, -.16, [1.4, .9, 1.0], D.skinD);
    // Breastplate in layers, a hump of plates on the back with a ridge of spines, pauldrons.
    for (const [y, r, c] of [[.37, .25, D.plate], [.24, .23, D.plateD], [.12, .2, D.plate]]) S.sph(r, 0, y, .12, c, { l: L_METAL, rough: .5, w: 8, h: 4, smooth: false, sc: [1.15, .34, .7] });
    for (const [x, y] of [[-.16, .42], [.16, .42], [-.14, .23], [.14, .23]]) S.sph(.018, x, y, .28, mulC(D.plate, 1.5), { l: L_METAL, rough: .35, w: 5, h: 3, jit: 0 });
    plate(S, .46, .26, .08, 0, .38, -.26, [.35, 0, 0], D.plateD);
    for (let k = 0; k < 5; k++) S.cone(.04 - k * .004, .14, 0, .52 - k * .08, -.3 + k * .025, mulC(D.plateD, .9), { n: 4, r: [-.9, 0, 0], l: L_METAL });
    for (const sg of [-1, 1]) {
      S.sph(.17, sg * .37, .47, 0, D.plate, { l: L_METAL, rough: .5, w: 7, h: 4, smooth: false, sc: [1.15, .7, 1.1] });
      S.sph(.12, sg * .42, .4, 0, D.plateD, { l: L_METAL, rough: .5, w: 7, h: 4, smooth: false, sc: [1.2, .6, 1.1] });
      barn(S, 5, sg * .37, .56, .02, .08, rng);
      for (let k = 0; k < 3; k++) S.ico(.03, sg * (.3 + k * .05), .52, .1 - k * .05, D.iron, { sc: [1, .6, 1.5], d: 0, rough: .3 });
    }
    barn(S, 6, -.1, .34, .28, .1, rng); barn(S, 4, .12, .15, .29, .06, rng);
    // A chain across the chest (left shoulder to right hip) and kelp hanging off both shoulders.
    link(S, [.34, .55, .12], [-.27, .04, .3], 11, .035, { sag: -.05 });
    for (let k = 0; k < 6; k++) { const sg = k < 3 ? 1 : -1, z = (k % 3 - 1) * .13; strand(S, sg * (.3 + rng() * .1), .55, z, rng.range(.3, .5), .03, k & 1 ? D.kelp : D.kelpL, rng, [sg * .06, z * .3]); }
    for (let k = 0; k < 4; k++) strand(S, rng.range(-.25, .25), .52, -.28, rng.range(.35, .5), .035, D.kelp, rng, [0, -.06]);
    S.cyl(.12, .12, 0, .56, .0, D.skinD, { n: 8 });
  }, 2, { rad: .32 });
  K.head = new PartBatch(S => {
    const rng = makeRng(63);
    skin(S, .165, 0, .1, .04, [1.05, 1.0, 1.0]); S.box(.27, .05, .09, 0, .16, .13, D.skinD, { jit: 0 }); S.box(.22, .09, .16, 0, .02, .11, D.skinD, {});
    for (let k = 0; k < 4; k++) S.cone(.014, .04, -.06 + k * .04, .085, .19, C(0xc8c0a4), { n: 4, jit: 0 });
    for (const sg of [-1, 1]) { S.box(.05, .035, .03, sg * .055, .125, .175, COL.black, { jit: 0 }); S.cone(.02, .07, sg * .09, .0, .17, D.barn, { n: 4, r: [.4, 0, 0] }); }
    for (let k = 0; k < 7; k++) { const x = (k - 3) * .03; strand(S, x, .0, .13 - Math.abs(x) * .4, rng.range(.16, .3), .018, k & 1 ? D.kelpL : D.kelp, rng, [x * .3, .03]); }
    for (let k = 0; k < 5; k++) { const a = PI + (k - 2) * .45; strand(S, Math.sin(a) * .13, .16, Math.cos(a) * .13 - .02, rng.range(.25, .4), .03, D.kelp, rng, [Math.sin(a) * .04, -.05]); }
    // The coral crown: a band of encrusted coral with branching red, pink and pale fingers.
    S.cyl(.135, .025, 0, .225, .03, mulC(D.coral, .45), { n: 9, rough: .9 });
    for (let k = 0; k < 7; k++) {
      const a = k / 7 * TAU + .2, c = [D.coral, D.coralP, D.coralY][k % 3], x = Math.cos(a) * .125, z = Math.sin(a) * .125 + .03, h = (k % 2 ? .14 : .22) * (.8 + .4 * rng());
      const tip = [x * 1.3, .23 + h, z * 1.3]; S.seg([x, .22, z], tip, .018, .011, c, { n: 5, emis: .02 });
      S.ico(.018, tip[0], tip[1], tip[2], mulC(c, 1.2), { d: 0, emis: .03 });
      for (let j = 0; j < 2; j++) { const u = .45 + j * .25, b = [lerp(x, tip[0], u), lerp(.2, tip[1], u), lerp(z, tip[2], u)], e = [b[0] + Math.cos(a + (j ? .8 : -.8)) * .06, b[1] + .06 + rng() * .04, b[2] + Math.sin(a + (j ? .8 : -.8)) * .06]; S.seg(b, e, .012, .008, c, { n: 4, emis: .02 }); S.ico(.012, e[0], e[1], e[2], mulC(c, 1.2), { d: 0, emis: .03 }); }
    }
  }, 2, { rad: .16 });
  K.uArm = new PartBatch(S => {
    const rng = makeRng(64); skin(S, .115, 0, -.13, 0, [1, 1.45, 1]);
    S.cyl(.12, .07, 0, -.2, 0, D.plateD, { n: 8, l: L_METAL, rough: .5 }); barn(S, 4, 0, -.2, .1, .05, rng);
  }, 4, sh);
  K.lArm = new PartBatch(S => {
    const rng = makeRng(65); skin(S, .1, 0, -.12, 0, [1, 1.5, 1]);
    S.cyl(.11, .13, 0, -.14, 0, D.plate, { n: 8, l: L_METAL, rough: .5, rt: 1.15 }); barn(S, 5, .02, -.15, .1, .05, rng);
    S.cyl(.1, .04, 0, -.24, 0, D.iron, { n: 8, l: L_METAL, rough: .6 }); link(S, [.05, -.25, .08], [.08, -.4, .12], 3, .025, { sway: .6 });
    skin(S, .1, 0, -.31, .015, [1.05, 1.1, 1.1], D.skinD);
  }, 4, sh);
  K.uLeg = new PartBatch(S => { skin(S, .135, 0, -.11, 0, [1, 1.3, 1.05]); plate(S, .16, .12, .04, 0, -.1, .13, [-.1, 0, 0], D.plateD); }, 4, sh);
  K.lLeg = new PartBatch(S => {
    const rng = makeRng(66); skin(S, .11, 0, -.11, 0, [1, 1.3, 1]);
    plate(S, .15, .17, .05, 0, -.12, .1, [0, 0, 0]); barn(S, 5, 0, -.12, .13, .05, rng);
    S.box(.2, .08, .3, 0, -.23, .05, D.skinD, {}); for (const x of [-.06, 0, .06]) S.cone(.02, .05, x, -.24, .21, D.barn, { n: 4, r: [HPI, 0, 0] });
  }, 4, sh);
  // The anchor: held at the ring end (y = 0), the crown and flukes at the far end; a length of chain from the ring.
  KIT.item.anchor = new PartBatch(S => {
    const rng = makeRng(67), c = mulC(mixC(COL.ironL, C(0x6a4a34), .5), .95), o = { l: L_METAL, rough: .7 };
    S.box(.06, 1.08, .06, 0, .43, 0, c, o); S.add(gTorus(10, .22, 4), { s: .075, p: [0, -.14, 0], r: [0, HPI, 0], c, l: L_METAL, rough: .7 });
    S.box(.46, .05, .05, 0, .06, 0, mulC(COAST.wood, .8), { l: L_WOOD, rough: .6 });
    for (const sg of [-1, 1]) {
      S.seg([0, .98, 0], [sg * .16, .95, 0], .035, .03, c, { l: L_METAL, n: 5 }); S.seg([sg * .16, .95, 0], [sg * .27, .76, 0], .03, .022, c, { l: L_METAL, n: 5 });
      S.add(gOct(), { s: [.08, .1, .02], p: [sg * .26, .79, 0], r: [0, 0, sg * .55], c: mulC(c, 1.1), l: L_METAL, rough: .7 });
    }
    S.cone(.04, .08, 0, 1.02, 0, c, { n: 4, l: L_METAL });
    barn(S, 10, 0, .82, .03, .1, rng); for (let k = 0; k < 2; k++) strand(S, rng.range(-.15, .15), .9, .03, .2, .02, D.kelpL, rng, [0, .02]);
    link(S, [0, -.18, 0], [.05, -.5, .04], 5, .03, { sway: .5 });
  }, 2, { rad: .12 });
  for (const k of ['uArm', 'lArm', 'uLeg', 'lLeg']) K[k].mesh.castShadow = true;
  RIGS.leviathan = rigLeviathan; EYES.leviathan = [.055, .125, .185, .06]; RIG_DEATH.leviathan = 'drown';
  // Stand-in stats so the model can be tried on its own. The game's own MON.leviathan (Mira's) replaces this.
  if (!MON.leviathan) MON.leviathan = { name: 'Uppunud kuningas', tip: 'Kutsub merest uppunud luukeresid.', hp: 1250, spd: .82, rad: 1.0, mass: 46, bounty: 200, lives: 5, hitH: 2.1, top: 4.0, dmg: 50, atkT: 1.8, eye: [.5, 3.2, 2.6], scale: 2.7, boss: true, summon: { type: 'skel', n: 2, every: 9, max: 99, hp: .8 }, death: 'flesh', blade: true, cat: 'armor', rig: 'leviathan' };
}
function rigLeviathan(e) {
  e.weapon = KIT.item.anchor; e.wScale = 1.25; e.heavy = true;
  const M = rigHuman(KIT.drowned, SPEC.leviathan, e);
  if (!RIG_CAPTURE) leviathanFx(e, M);
  return M;
}
// Per drawn step: water running off him (drops from the shoulders, beard, hands, belt and the anchor's crown),
// wet footprints, a faint sea-green glow about the head; heavier while he is dying, then the burst.
function leviathanFx(m, M) {
  if (!(m.vis || m.fly) || m.dead || !G.B) return;
  const dt = FX.dt || 0, sc = m.scale || 1, dying = m.dying > 0, rate = (dying ? 70 : 20) * FX.keep;
  m._drip = (m._drip || 0) + dt * rate;
  const src = [[_M[2], .34, .56, .05], [_M[2], -.34, .56, .05], [_M[3], 0, -.05, .14], [_M[5], 0, -.32, 0], [_M[7], 0, -.32, 0], [_M[8], .2, .85, 0], [_M[8], -.2, .85, 0], [_M[1], .2, -.3, .1], [_M[1], -.2, -.3, -.1]];
  while (m._drip >= 1) {
    m._drip -= 1; const s = src[Math.floor(frnd() * src.length)];
    _d4.set(s[1] + frr(-.05, .05), s[2], s[3] + frr(-.05, .05)).applyMatrix4(s[0]);
    fxPart(_d4.x, _d4.y, _d4.z, frr(-.25, .25), frr(-.6, .2), frr(-.25, .25), frr(.45, .8), frr(.03, .055), .34, .46, .56, { grav: 9.5, drag: .2 });
  }
  _d4.set(0, .12, .1).applyMatrix4(M); const g = DROWN.glow, tw = .85 + .15 * Math.sin(G.t * 5 + m.lseed);
  FX.add.push(_d4.x, _d4.y, _d4.z, .75 * sc, .75 * sc, 0, 0, g[0] * .2, g[1] * .2, g[2] * .2, .35 * tw, 2, 0, 0, 0);
  m.glowL = true; m.lI = 9; m.lCol = 0x40e0c0; m.lx = _d4.x; m.ly = _d4.y; m.lz = _d4.z;
  if (m.mv > .3) { m._wet = (m._wet || 0) - dt; if (m._wet <= 0) { m._wet = .55; FX.decals.add(G.B.heightAt, m.x + frr(-.3, .3), m.z + frr(-.3, .3), .55 + frnd() * .3, .006, .01, .014, .5, 9, 9); } }
  if (dying && m.dying < .1 && !m._burst) { m._burst = 1; leviathanSplash(m); }
}
// The Drowned King's end: he bursts into the sea that filled him. A column of spray, a ring of foam, kelp and
// shell scattered, a sea-green flash, a wide wet stain; on a storm land the sky answers with a strike.
function leviathanSplash(m) {
  const sc = m.scale || 1, x = m.x, y = m.y, z = m.z, g = DROWN.glow;
  fxTimed(5, x, y + 1.6 * sc / 2.7, z, 6, 6, g[0] * 1.6, g[1] * 1.6, g[2] * 1.6, 1, .3); fxTimed(4, x, y + .08, z, 9, 9, .6, .8, .95, .8, .6, { ground: true });
  lightFlash(x, y + 2, z, 0x50f0d0, 900, .5, 18);
  for (let i = 0; i < 46; i++) { const a = frnd() * TAU, s = frr(.6, 3); fxPart(x + Math.cos(a) * .4, y + frr(.3, 2.4), z + Math.sin(a) * .4, Math.cos(a) * s, frr(3.5, 9), Math.sin(a) * s, frr(.8, 1.6), frr(.05, .09), .45, .58, .7, { grav: 10, drag: .25 }); }
  for (let i = 0; i < 14; i++) { const a = frnd() * TAU, s = frr(.6, 2.2); fxSmoke(x + Math.cos(a) * .5, y + frr(.2, 2.5), z + Math.sin(a) * .5, Math.cos(a) * s, frr(1, 3), Math.sin(a) * s, frr(1.4, 2.6), frr(.7, 1.2), 2, .5, .56, .6, .45, { drag: 1.4, rise: -.3 }); }
  for (let i = 0; i < 12; i++) { _gm.compose(_gp.set(x + frr(-.4, .4), y + frr(.5, 2.5), z + frr(-.4, .4)), _gq.set(frr(-1, 1), frr(-1, 1), frr(-1, 1), 1).normalize(), _gs.setScalar(frr(.8, 1.5))); addDebris(KIT.bit, _gm, i & 1 ? [.3, .3, .14] : [1.1, 1.06, .96], frr(-3, 3), frr(3, 6), frr(-3, 3), frr(4, 10), frr(3, 5), { extra: 1 }); }
  FX.decals.add(G.B.heightAt, x, z, 3.2, .004, .008, .012, .7, 40, 40);
  if (G.B.bio.lightning) FX.lightningAt(x + frr(-.5, .5), z + frr(-.5, .5), .8);
}
DEATH_FX.drown = (m, kind, ix, iz, up) => { shatter(e => rigMonster(e), m, [ix, 1.6 * up, iz], { spread: 1.5, life: .8, up }); leviathanSplash(m); };

// ---- Round 11: The Hollow Herald (RIGS.herald), a Long Night boss ------------------------------------------------
// A tall, gaunt figure in a tattered night-blue robe on the human rig (a slow, stooped walk; the legs are mostly
// hidden in the robe). Under a deep pointed hood there is no face, only black and two cold pinpoints. In its right
// hand a crooked staff; from the crook hangs a cage lantern on a chain, holding the warm light it has stolen from the
// keepers' towers (a warm torch light rides with it). The ragged hem trails dark wisps. MON.herald is Mira's
// (61-monsters.js); the entry below is only a stand-in so the model and the boss pool work on their own.
// Death (RIG_DEATH 'hollow'): the robe collapses into black smoke and the lantern bursts, letting its stolen light go.
SPEC.herald = { hip: .64, pelvisH: .1, torsoH: .5, shX: .19, shY: .45, uArm: .29, lArm: .33, hipX: .08, uLeg: .31, lLeg: .31, stride: .3, lean: .05, stoop: .22, eyeX: 0, eyeY: 0, eyeZ: 0, top: 1.62 };
const HERALD = { robe: C(0x20253a), robeL: C(0x343b58), robeD: C(0x10121c), skin: C(0x7c8296), iron: C(0x2a2c34), ironL: C(0x4c505e), wood: C(0x2e261f), bone: C(0xb8b2a0), rim: C(0x56607e), warm: [1.0, .62, .26], eye: [1.3, 1.7, 2.6], light: 0xffa246, tilt: -.35, drop: .24 };
// The pinpoints in head space: (+-x, y, z) of a point in the hood's opening, turned with the hood's tilt.
HERALD.eyeP = (() => { const y = .125, z = .05, a = HERALD.tilt; return [.036, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)]; })();
function initHerald() {
  const H = HERALD, N = { rad: .12, shadow: false };
  // A ragged strip of cloth hanging from (x, y, z): three segments, narrowing, drifting by `out`.
  const rag = (S, x, y, z, len, w, c, rng, out = [0, 0]) => {
    let p = [x, y, z], w0 = w;
    for (let k = 0; k < 3; k++) { const u = (k + 1) / 3, q = [x + out[0] * u + rng.range(-.015, .015), y - len * u, z + out[1] * u + rng.range(-.015, .015)], w1 = w * (1 - u * .55); ribbon(S, [p[0] - w0, p[1], p[2]], [p[0] + w0, p[1], p[2]], [q[0] + w1, q[1], q[2]], [q[0] - w1, q[1], q[2]], mulC(c, .8 + .35 * rng()), [0, 0, 0, 0]); p = q; w0 = w1; }
  };
  const K = KIT.herald = {};
  // The robe skirt hangs from the pelvis to just above the ground, flaring and ragged at the hem; tatters below it.
  K.pelvis = new PartBatch(S => {
    const rng = makeRng(111);
    S.add(gCyl(14, .5, true), { s: [.3, .7, .27], p: [0, -.27, 0], c: H.robe, l: L_CLOTH, dbl: true, deform: v => { if (v.y < 0) { const a = Math.atan2(v.z, v.x), j = vnoise(a * 2.6 + 4, 1, 13); v.y += (j - .5) * .16 - (v.z < 0 ? .05 : 0); v.x *= .92 + .16 * j; v.z = v.z * (.92 + .16 * j) - .03; } }, cf: v => .55 + .45 * sat(v.y / .35 + .5) });
    for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + .3; S.box(.02, .6, .012, Math.cos(a) * .235, -.27, Math.sin(a) * .21, H.robeD, { l: L_CLOTH, jit: 0, r: [Math.sin(a) * .2, -a + HPI, -Math.cos(a) * .2] }); }
    S.cyl(.17, .06, 0, .06, 0, H.robeD, { n: 10, l: L_CLOTH }); S.box(.05, .26, .02, .05, -.06, .165, H.robeL, { l: L_CLOTH, r: [.08, 0, .06] });
    for (let k = 0; k < 13; k++) { const a = k / 13 * TAU + rng() * .3, back = Math.sin(a) < 0 ? 1 : .55; rag(S, Math.cos(a) * .28, -.58 + rng() * .05, Math.sin(a) * .25 - .03, rng.range(.06, .14) * back, .035, k & 1 ? H.robe : H.robeD, rng, [Math.cos(a) * .03, Math.sin(a) * .03 - .04 * back]); }
  }, 2, { rad: .3 });
  // A narrow robed chest, a ragged mantle over the shoulders, a long drape down the back, a bone clasp with charms.
  K.torso = new PartBatch(S => {
    const rng = makeRng(112);
    S.add(gCyl(10, 1.3, false), { s: [.15, .46, .13], p: [0, .22, 0], c: H.robe, l: L_CLOTH, cf: v => .7 + .3 * sat(v.y / .23 + .5) });
    S.add(gDome(10, 4), { s: [.27, .14, .2], p: [0, .4, -.01], c: H.robeL, l: L_CLOTH });
    for (let k = 0; k < 14; k++) { const a = k / 14 * TAU, c = Math.cos(a), s = Math.sin(a); rag(S, c * .26, .41, s * .19 - .01, rng.range(.08, .15) * (s < 0 ? 1.3 : 1), .045, k & 1 ? H.robeL : H.robe, rng, [c * .04, s * .03]); }
    for (let k = 0; k < 5; k++) rag(S, (k - 2) * .07, .44, -.17, rng.range(.42, .58), .045, k & 1 ? H.robe : H.robeD, rng, [0, -.05]);
    for (let k = 0; k < 4; k++) S.box(.012, .3, .012, (k - 1.5) * .05, .2, .135, H.robeD, { jit: 0, r: [-.1, 0, (k - 1.5) * .05] });
    S.ico(.035, 0, .4, .17, H.bone, { d: 0, l: L_BONE, sc: [1, 1.2, .6] }); S.box(.1, .015, .015, 0, .4, .165, H.ironL, { l: L_METAL, jit: 0 });
    for (let k = 0; k < 3; k++) { const x = (k - 1) * .035; S.seg([x, .38, .17], [x * 1.3, .3 - (k & 1) * .03, .175], .006, .006, H.ironL, { n: 3, l: L_METAL }); S.ico(.014, x * 1.3, .29 - (k & 1) * .03, .175, H.bone, { d: 0, l: L_BONE }); }
  }, 2, { rad: .3 });
  // The hood: open at the front onto a black void (the pinpoint eyes are sprites from heraldFx), tall and pointed,
  // a pale-edged rim, side panels falling onto the mantle.
  K.head = new PartBatch(S => {
    const T = new Soup();
    T.add(gDome(10, 5), { s: [.165, .2, .2], p: [0, .12, .02], r: [-HPI, 0, 0], c: H.robe, l: L_CLOTH, dbl: true });
    T.sph(.13, 0, .12, -.03, COL.black, { sc: [1, 1.2, .55], w: 8, h: 5, jit: 0, rough: 1 });
    T.add(gTorus(12, .2, 4), { s: [.155, .19, .16], p: [0, .12, .03], c: H.rim, l: L_CLOTH, emis: .05 });
    T.cone(.15, .3, 0, .33, -.1, H.robe, { n: 8, r: [-.55, 0, 0], l: L_CLOTH });
    T.cone(.06, .16, 0, .5, -.24, H.robeD, { n: 6, r: [-1.1, 0, 0], l: L_CLOTH });
    for (const sg of [-1, 1]) T.box(.04, .26, .2, sg * .15, -.0, -.03, H.robe, { l: L_CLOTH, r: [0, 0, sg * -.12] });
    // Tipped back a little so the opening (and the pinpoints, HERALD.eyeP) still shows from the high camera.
    S.merge(T, { r: [HERALD.tilt, 0, 0], ao: null });
    S.box(.3, .1, .14, 0, -.05, -.1, H.robeD, { l: L_CLOTH });
  }, 2, { rad: .2 });
  K.uArm = new PartBatch(S => { S.cyl(.062, .3, 0, -.14, 0, H.robe, { n: 7, l: L_CLOTH, rt: 1.1 }); }, 4, { rad: .07 });
  // A wide, drooping bell sleeve with ragged ends and long grey fingers.
  K.lArm = new PartBatch(S => {
    const rng = makeRng(113);
    S.add(gCyl(9, .42, true), { s: [.12, .32, .11], p: [0, -.15, .01], c: H.robeL, l: L_CLOTH, dbl: true, deform: v => { if (v.y < 0) { const j = vnoise(Math.atan2(v.z, v.x) * 2.2 + 9, 2, 5); v.y += (j - .5) * .1 - (v.z < 0 ? .05 : 0); } } });
    for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + .5; rag(S, Math.cos(a) * .1, -.31, Math.sin(a) * .09, rng.range(.06, .1), .03, H.robe, rng); }
    S.box(.05, .05, .045, 0, -.31, .01, H.skin, { l: L_BONE });
    for (let k = 0; k < 4; k++) { const x = (k - 1.5) * .017; S.seg([x, -.33, .015], [x * 1.4, -.42, .04], .009, .007, H.skin, { n: 3, l: L_BONE }); S.seg([x * 1.4, -.42, .04], [x * 1.5, -.47, .07], .007, .003, H.skin, { n: 3, l: L_BONE }); }
  }, 4, { rad: .12 });
  K.uLeg = new PartBatch(S => { S.cyl(.05, .3, 0, -.15, 0, H.robeD, { n: 6, l: L_CLOTH }); }, 4, N);
  K.lLeg = new PartBatch(S => { S.cyl(.042, .3, 0, -.15, 0, H.robeD, { n: 6, l: L_CLOTH }); S.box(.07, .04, .17, 0, -.3, .05, mulC(H.robeD, .8), { l: L_CLOTH }); S.cone(.03, .07, 0, -.3, .16, H.robeD, { n: 4, r: [HPI, 0, 0] }); }, 4, N);
  // The crook: a dark, knotted staff, its head bent outward into a hook with bone charms tied on.
  KIT.item.crook = new PartBatch(S => {
    const w = H.wood, rng = makeRng(114);
    let p = [0, -.6, 0]; for (let k = 1; k <= 5; k++) { const q = [rng.range(-.02, .02), -.6 + k * .42, rng.range(-.02, .02)]; S.seg(p, q, .03 - k * .002, .028 - k * .002, w, { n: 5, l: L_WOOD }); S.ico(.034, q[0], q[1], q[2], mulC(w, 1.1), { d: 0, l: L_WOOD }); p = q; }
    const hook = [[0, 1.5, 0], [-.06, 1.66, 0], [-.2, 1.73, 0], [-.34, 1.68, 0], [-.4, 1.57, 0], [-.38, 1.48, 0]];
    for (let k = 1; k < hook.length; k++) S.seg(hook[k - 1], hook[k], .026 - k * .002, .024 - k * .002, w, { n: 5, l: L_WOOD });
    S.cyl(.034, .05, 0, 1.4, 0, H.ironL, { n: 7, l: L_METAL, rough: .5 });
    for (let k = 0; k < 3; k++) { const a = k * 2.1; S.seg([0, 1.36, 0], [Math.cos(a) * .05, 1.2 - k * .03, Math.sin(a) * .05], .005, .005, COL.rope, { n: 3 }); S.ico(.022, Math.cos(a) * .05, 1.19 - k * .03, Math.sin(a) * .05, H.bone, { d: 0, l: L_BONE }); }
  }, 2, { rad: .12 });
  // The cage lantern, hanging from its chain (origin at the top link, hanging down -y). The core is the stolen light.
  K.lantern = new PartBatch(S => {
    const ir = H.iron, il = H.ironL, d = H.drop;
    for (let k = 0; k < 9; k++) S.add(gTorus(6, .3, 3), { s: [.028, .02, .02], p: [0, -.025 - k * .046, 0], r: [0, k & 1 ? HPI : 0, HPI], c: il, l: L_METAL, rough: .5, jit: 0 });
    S.add(gTorus(8, .25, 3), { s: .03, p: [0, -.19 - d, 0], c: il, l: L_METAL, rough: .5 });
    S.cone(.085, .07, 0, -.24 - d, 0, ir, { n: 6, l: L_METAL, rough: .5 }); S.cyl(.08, .02, 0, -.275 - d, 0, il, { n: 6, l: L_METAL });
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; S.seg([Math.cos(a) * .072, -.28 - d, Math.sin(a) * .072], [Math.cos(a) * .066, -.45 - d, Math.sin(a) * .066], .008, .008, ir, { n: 3, l: L_METAL }); }
    S.cyl(.075, .025, 0, -.455 - d, 0, il, { n: 6, l: L_METAL }); S.cone(.04, .07, 0, -.5 - d, 0, ir, { n: 6, l: L_METAL, r: [PI, 0, 0] });
    S.ico(.045, 0, -.365 - d, 0, H.warm, { d: 1, emis: 1.1, jit: 0 }); S.ico(.026, 0, -.33 - d, 0, [1, .9, .6], { d: 0, emis: 1.6, jit: 0 });
  }, 2, { rad: .1 });
  RIGS.herald = rigHerald; EYES.herald = null; RIG_DEATH.herald = 'hollow';
  // Stand-in stats so the model works on its own. The game's own MON.herald (Mira's) replaces this.
  if (!MON.herald) MON.herald = { name: 'Õõnsuse kuulutaja', tip: 'Kustutab su tornide tuled ja kutsub langenute kajasid.', hp: 1300, spd: .72, rad: .9, mass: 40, bounty: 220, lives: 5, hitH: 2.2, top: 4.3, dmg: 42, atkT: 1.9, eye: [1.3, 1.7, 2.6], scale: 2.5, boss: true, summon: { type: 'wraith', n: 2, every: 9, max: 99, hp: .6 }, death: 'flesh', cat: 'armor', rig: 'herald' };
}
const _hA = new THREE.Vector3();
function rigHerald(e) {
  e.weapon = KIT.item.crook; e.wScale = 1.05; e.staffOut = true;
  const M = rigHuman(KIT.herald, SPEC.herald, e), s = e.scale || 1, t = G.t + (e.lseed || 0) * 3;
  // The lantern hangs plumb from the crook, swinging a little and trailing back when he walks.
  _hA.set(-.4, 1.56, 0).applyMatrix4(_M[8]);
  const dying = e.dying > 0, sx = .1 * Math.sin(t * 1.9) + .28 * (e.mv || 0) + (dying ? .25 * Math.sin(t * 11) : 0), sz = .09 * Math.sin(t * 1.3 + 1.1);
  const Y = xf(_M[20], null, _hA.x, _hA.y, _hA.z, 0, e.yaw, 0, s, s, s), L = xf(_M[21], Y, 0, 0, 0, sx, 0, sz);
  KIT.herald.lantern.put(L, 0, null);
  if (!RIG_CAPTURE) heraldFx(e, M, L);
  return M;
}
// Per drawn step: the lantern's warm glow and light (it flickers, and gutters while he dies), the two cold pinpoints
// in the hood, dark wisps off the hem, a few pale motes; at the end of the death throes the release (heraldEnd).
function heraldFx(m, M, L) {
  if (!(m.vis || m.fly) || m.dead || !G.B) return;
  const A = FX.add, dt = FX.dt || 0, sc = m.scale || 1, t = G.t + (m.lseed || 0) * 3, H = HERALD, w = H.warm, e = H.eye, dying = m.dying > 0;
  const fl = (.82 + .12 * Math.sin(t * 9.3) + .08 * Math.sin(t * 23.1)) * (dying ? .55 + .45 * Math.abs(Math.sin(t * 17)) : 1);
  _d4.set(0, -.36 - H.drop, 0).applyMatrix4(L);
  A.push(_d4.x, _d4.y, _d4.z, .26 * sc, .26 * sc, 0, 0, w[0] * 2.4, w[1] * 2.2, w[2] * 2, fl, 0, 0, 0, 0);
  A.push(_d4.x, _d4.y, _d4.z, 1.5 * sc, 1.5 * sc, 0, 0, w[0] * .55, w[1] * .4, w[2] * .25, .55 * fl, 2, 0, 0, 0);
  m.glowL = true; m.lI = 6.5 * fl; m.lCol = H.light; m.lx = _d4.x; m.ly = _d4.y; m.lz = _d4.z;
  if (frnd() < dt * 3 * FX.keep) fxPart(_d4.x + frr(-.05, .05) * sc, _d4.y, _d4.z + frr(-.05, .05) * sc, frr(-.15, .15), frr(.3, .8), frr(-.15, .15), frr(.5, 1), frr(.03, .05), w[0] * 2.6, w[1] * 2.2, w[2] * 1.6, { drag: .6, wob: 1, rise: .2 });
  if (dying && m.dying < .1 && !m._burst) { m._burst = 1; heraldEnd(m, _d4); }
  // Cold pinpoints in the hood's dark (no face).
  const ek = (.85 + .15 * Math.sin(t * 6.1)) * (dying ? Math.max(0, 1 - (1.9 - m.dying) * .4) : 1);
  const P = H.eyeP; for (const sg of [-1, 1]) { _d4.set(sg * P[0], P[1], P[2]).applyMatrix4(M); A.push(_d4.x, _d4.y, _d4.z, .058 * sc, .058 * sc, 0, 0, e[0] * 1.5, e[1] * 1.5, e[2] * 1.5, ek, 0, 0, 0, 0); }
  _d4.set(0, P[1], P[2]).applyMatrix4(M); A.push(_d4.x, _d4.y, _d4.z, .42 * sc, .3 * sc, 0, 0, e[0] * .12, e[1] * .14, e[2] * .2, .5 * ek, 2, 0, 0, 0);
  // Dark wisps trailing off the ragged hem (alpha smoke), thinner in a crowd (FX.keep).
  m._wisp = (m._wisp || 0) + dt * (dying ? 30 : 13) * FX.keep;
  const k = sc / 2.5, bx = -Math.sin(m.yaw) * .25 * (m.mv || 0), bz = -Math.cos(m.yaw) * .25 * (m.mv || 0);
  while (m._wisp >= 1) {
    m._wisp -= 1; const a = frnd() * TAU; _d4.set(Math.cos(a) * .28, -.6, Math.sin(a) * .25 - .05).applyMatrix4(_M[1]);
    fxSmoke(_d4.x, _d4.y, _d4.z, frr(-.15, .15) + bx, frr(.05, .3), frr(-.15, .15) + bz, frr(1, 1.8), frr(.18, .3) * k, .5 * k, .025, .025, .04, .55, { drag: 1.2, rise: .12 });
  }
  if (frnd() < dt * 2) { _d4.set(frr(-.2, .2), frr(.2, .8), frr(-.2, .2)).applyMatrix4(_M[2]); fxPart(_d4.x, _d4.y, _d4.z, frr(-.1, .1), frr(.15, .4), frr(-.1, .1), frr(.6, 1.2), .03, e[0] * .8, e[1] * .8, e[2] * .9, { drag: .8, wob: 1 }); }
}
// The Herald's end: the robe falls in on itself as black smoke, a cold flash where the face was, and the lantern
// bursts: its stolen warm light streams up and away (motes rising, a warm flash, a soft ring on the ground).
function heraldEnd(m, lp) {
  const sc = m.scale || 1, k = sc / 2.5, x = m.x, y = m.y, z = m.z, w = HERALD.warm, e = HERALD.eye, lx = lp ? lp.x : x, ly = lp ? lp.y : y + 1.4 * sc, lz = lp ? lp.z : z;
  fxTimed(5, x, y + 1.55 * sc, z, 4 * k, 4 * k, e[0], e[1], e[2], .9, .25);
  fxTimed(5, lx, ly, lz, 5 * k, 5 * k, w[0] * 2.4, w[1] * 2, w[2] * 1.6, 1, .35); fxTimed(4, x, y + .1, z, 8 * k, 8 * k, w[0] * 1.4, w[1] * 1.1, w[2] * .8, .8, .7, { ground: true });
  lightFlash(lx, ly + .5, lz, HERALD.light, 900, .7, 20);
  for (let i = 0; i < 40; i++) { const a = frnd() * TAU, s = frr(.4, 2.2); fxPart(lx + Math.cos(a) * .2, ly + frr(-.2, .3), lz + Math.sin(a) * .2, Math.cos(a) * s, frr(1.5, 5), Math.sin(a) * s, frr(1.2, 2.6), frr(.04, .08), w[0] * frr(2, 3), w[1] * frr(1.6, 2.4), w[2] * 1.6, { drag: .7, wob: 1, rise: .6 }); }
  for (let i = 0; i < 18; i++) { const a = frnd() * TAU, s = frr(.4, 1.6); fxSmoke(x + Math.cos(a) * .5, y + frr(.2, 3.2) * k, z + Math.sin(a) * .5, Math.cos(a) * s, frr(-.2, .8), Math.sin(a) * s, frr(1.6, 3), frr(.6, 1.1) * k, 1.6 * k, .02, .02, .035, .7, { drag: 1.3, rise: .2 }); }
  for (let i = 0; i < 10; i++) { _gm.compose(_gp.set(lx + frr(-.2, .2), ly + frr(-.1, .2), lz + frr(-.2, .2)), _gq.set(frr(-1, 1), frr(-1, 1), frr(-1, 1), 1).normalize(), _gs.setScalar(frr(.5, .9))); addDebris(KIT.bit, _gm, [.18, .18, .2], frr(-3, 3), frr(2, 5), frr(-3, 3), frr(4, 10), frr(2.5, 4), { extra: 1 }); }
  FX.decals.add(G.B.heightAt, x, z, 2.6 * k, .006, .006, .01, .75, 40, 40);
}
DEATH_FX.hollow = (m, kind, ix, iz, up) => { shatter(e => rigMonster(e), m, [ix, 1.4 * up, iz], { spread: 1.3, life: .8, up }); heraldEnd(m, null); };
