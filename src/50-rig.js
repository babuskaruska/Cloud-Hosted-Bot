
let RIG_CAPTURE = null;
class PartBatch {
  constructor(build, cap, o = {}) {
    const S = new Soup(); build(S); const geo = S.build();
    this.cap = cap; this.n = 0;
    const m = this.mesh = new THREE.InstancedMesh(geo, MAT.inst, cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.flash = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1); this.flash.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('aFlash', this.flash);
    m.frustumCulled = false; m.castShadow = o.shadow !== false; m.receiveShadow = true; m.count = 0;
    this.rad = o.rad || .1; this.maxCap = Math.max(64, cap * 4);
    R.scene.add(m); PartBatch.all.push(this);
  }
  // Doubles the instance capacity (up to 4x the starting cap) so big crowds are not silently clipped.
  grow() {
    if (this.cap >= this.maxCap) return false;
    const old = this.mesh, cap = Math.min(this.maxCap, this.cap * 2), geo = old.geometry;
    const m = new THREE.InstancedMesh(geo, old.material, cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.instanceMatrix.array.set(old.instanceMatrix.array);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); m.instanceColor.setUsage(THREE.DynamicDrawUsage); m.instanceColor.array.set(old.instanceColor.array);
    const fl = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1); fl.setUsage(THREE.DynamicDrawUsage); fl.array.set(this.flash.array); this.flash = fl; geo.setAttribute('aFlash', fl);
    m.frustumCulled = false; m.castShadow = old.castShadow; m.receiveShadow = old.receiveShadow; m.count = 0; m.renderOrder = old.renderOrder;
    if (old.parent) { old.parent.add(m); old.parent.remove(old); }
    old.dispose(); this.mesh = m; this.cap = cap; return true;
  }
  put(mat, flash = 0, tint = null) {
    if (RIG_CAPTURE) { RIG_CAPTURE(this, mat, tint); return; }
    if (this.n >= this.cap && !this.grow()) return; const i = this.n++;
    mat.toArray(this.mesh.instanceMatrix.array, i * 16);
    const c = this.mesh.instanceColor.array;
    if (tint) { c[i * 3] = tint[0]; c[i * 3 + 1] = tint[1]; c[i * 3 + 2] = tint[2]; } else { c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = 1; }
    this.flash.array[i] = flash;
  }
  end() {
    const m = this.mesh; m.count = this.n; m.visible = this.n > 0;
    if (this.n) {
      for (const a of [m.instanceMatrix, m.instanceColor, this.flash]) { a.clearUpdateRanges(); a.addUpdateRange(0, this.n * a.itemSize); a.needsUpdate = true; }
    }
  }
}
PartBatch.all = [];
function beginParts() { for (const b of PartBatch.all) b.n = 0; }
function endParts() { for (const b of PartBatch.all) b.end(); }

const _rq = new THREE.Quaternion(), _re = new THREE.Euler(), _rv = new THREE.Vector3(), _rs = new THREE.Vector3(), _rm = new THREE.Matrix4();
const _M = []; for (let i = 0; i < 28; i++) _M.push(new THREE.Matrix4());
function xf(out, parent, px, py, pz, rx, ry, rz, sx = 1, sy = 1, sz = 1) {
  _rq.setFromEuler(_re.set(rx, ry, rz, 'XYZ')); _rm.compose(_rv.set(px, py, pz), _rq, _rs.set(sx, sy, sz));
  if (parent) out.multiplyMatrices(parent, _rm); else out.copy(_rm); return out;
}

const KIT = {};
function humanKit(style, cap) {
  const k = {}, limb = cap * 2;
  if (style === 'skel' || style === 'giant') {
    const G = style === 'giant', bone = G ? mulC(COL.bone, .82) : COL.bone, bd = G ? mulC(COL.boneD, .8) : COL.boneD, o = () => ({ l: L_BONE, jit: .05 });
    k.pelvis = new PartBatch(S => { S.box(.27, .1, .15, 0, 0, 0, bd, o()); S.box(.08, .13, .08, 0, .09, -.01, bone, o()); if (G) { for (const s of [-1, 1]) S.box(.1, .16, .17, s * .14, -.02, 0, bone, o()); clothPanel(S, { x0: -.13, x1: .13, yTop: -.03, len: .3, z: .09, col: mulC(COL.clothD, 1.4), rng: makeRng(5), sway: 0, nx: 3, ny: 4 }); } }, cap, { rad: .1 });
    k.torso = new PartBatch(S => {
      S.box(.07, .43, .07, 0, .21, -.03, bd, o());
      const ribs = G ? [.1, .16, .22, .28, .34] : [.15, .24, .33];
      for (const y of ribs) { S.box(.31 - (.34 - y) * .25, G ? .04 : .055, .21, 0, y, .01, bone, o()); }
      S.box(.39, .07, .12, 0, .43, 0, bone, o()); S.box(.06, .25, .03, 0, .25, .11, bone, o());
      if (G) { for (const s of [-1, 1]) { S.cone(.05, .16, s * .2, .52, 0, bone, { n: 4, l: L_BONE }); S.cone(.04, .12, s * .13, .5, -.04, bd, { n: 4, l: L_BONE }); } for (let v = 0; v < 4; v++) S.box(.05, .03, .06, 0, .1 + v * .09, -.08, bone, o()); }
    }, cap, { rad: .16 });
    k.head = new PartBatch(S => {
      S.sph(.15, 0, .17, 0, bone, { sc: [1, .95, 1.08], l: L_BONE, w: 7, h: 5, smooth: false }); S.box(.17, .08, .14, 0, .04, .035, bd, o());
      for (const s of [-1, 1]) S.box(.066, .062, .05, s * .058, .185, .132, COL.black, { jit: 0 });
      S.box(.03, .04, .04, 0, .12, .152, COL.black, { jit: 0 });
      if (G) { for (const s of [-1, 1]) { S.seg([s * .12, .24, 0], [s * .27, .36, .03], .05, .035, bd, { l: L_BONE, n: 5 }); S.seg([s * .27, .36, .03], [s * .3, .52, .1], .035, .008, bone, { l: L_BONE, n: 5 }); } for (let t = -2; t <= 2; t++) S.box(.022, .04, .02, t * .032, .005, .1, bone, { jit: 0 }); }
    }, cap, { rad: .15 });
    k.uArm = new PartBatch(S => { S.box(.062, .25, .062, 0, -.125, 0, bone, o()); S.box(.085, .06, .085, 0, -.26, 0, bd, o()); }, limb, { rad: .06, shadow: false });
    k.lArm = new PartBatch(S => { S.box(.052, .25, .052, 0, -.125, 0, bone, o()); S.box(.08, .08, .08, 0, -.28, 0, bd, o()); }, limb, { rad: .06, shadow: false });
    k.uLeg = new PartBatch(S => { S.box(.076, .27, .076, 0, -.135, 0, bone, o()); S.box(.09, .06, .09, 0, -.28, 0, bd, o()); }, limb, { rad: .07, shadow: false });
    k.lLeg = new PartBatch(S => { S.box(.062, .28, .062, 0, -.14, 0, bone, o()); S.box(.09, .05, .19, 0, -.295, .05, bd, o()); }, limb, { rad: .07, shadow: false });
  } else if (style === 'foot') {
    const mail = COL.steel, cloth = mulC(COL.clothB, 1.75), lea = COL.leather;
    k.pelvis = new PartBatch(S => { S.box(.28, .14, .19, 0, 0, 0, mulC(COL.clothD, 1.6), { l: L_CLOTH }); S.box(.3, .05, .2, 0, .06, 0, lea, {}); }, cap, { rad: .12 });
    k.torso = new PartBatch(S => {
      S.box(.34, .4, .22, 0, .21, 0, cloth, { l: L_CLOTH, jit: 0 }); S.box(.12, .34, .23, 0, .2, 0, mulC(cloth, .62), { l: L_CLOTH, jit: 0 });
      S.box(.42, .1, .25, 0, .4, 0, mail, { l: L_METAL, rough: .5 }); S.box(.16, .08, .16, 0, .45, 0, COL.skin, {});
    }, cap, { rad: .17 });
    k.head = new PartBatch(S => {
      S.box(.19, .2, .19, 0, .12, .0, COL.skin, { jit: .04 }); S.box(.2, .08, .1, 0, .06, -.06, mulC(COL.leather, .7), {});
      S.add(gDome(8, 3), { s: [.155, .13, .155], p: [0, .19, 0], c: mail, l: L_METAL, rough: .42 }); S.cyl(.21, .03, 0, .19, 0, mulC(mail, .85), { n: 8, l: L_METAL, rough: .42 });
      for (const s of [-1, 1]) S.box(.03, .03, .02, s * .05, .14, .098, COL.black, { jit: 0 });
    }, cap, { rad: .14 });
    k.uArm = new PartBatch(S => { S.box(.1, .26, .1, 0, -.13, 0, mail, { l: L_METAL, rough: .5 }); S.box(.13, .09, .13, 0, -.03, 0, mulC(mail, 1.1), { l: L_METAL, rough: .45 }); }, limb, { rad: .07, shadow: false });
    k.lArm = new PartBatch(S => { S.box(.085, .24, .085, 0, -.12, 0, lea, {}); S.box(.09, .08, .09, 0, -.27, 0, COL.skin, {}); }, limb, { rad: .07, shadow: false });
    k.uLeg = new PartBatch(S => { S.box(.115, .28, .115, 0, -.14, 0, mulC(COL.clothD, 1.5), { l: L_CLOTH }); }, limb, { rad: .08, shadow: false });
    k.lLeg = new PartBatch(S => { S.box(.1, .28, .1, 0, -.14, 0, mulC(lea, .7), {}); S.box(.11, .06, .2, 0, -.29, .045, mulC(lea, .6), {}); }, limb, { rad: .08, shadow: false });
  } else if (style === 'knight') {
    // Guard-post knights: plate harness under a blue tabard with a white cross, a flat-topped great helm with a
    // blue crest. Upper arms reuse the footman's mail sleeves (shared batch, no extra draw call).
    const F = KIT.foot, pl = mulC(COL.steel, 1.08), plD = mulC(COL.steel, .72), blue = C(0x3762b4), blueD = C(0x203c78), wht = C(0xe2ddd0), trim = mulC(COL.gold, .85), m = () => ({ l: L_METAL, rough: .38, jit: .03 });
    k.pelvis = new PartBatch(S => { S.box(.3, .14, .21, 0, 0, 0, plD, m()); S.box(.32, .05, .22, 0, .06, 0, COL.leather, {}); for (const z of [.11, -.11]) S.box(.22, .22, .025, 0, -.1, z, blue, { l: L_CLOTH, jit: 0 }); S.box(.22, .025, .03, 0, -.2, .11, trim, { jit: 0 }); }, cap, { rad: .12 });
    k.torso = new PartBatch(S => {
      S.box(.36, .4, .24, 0, .21, 0, blue, { l: L_CLOTH, jit: 0 }); S.box(.37, .06, .25, 0, .02, 0, blueD, { l: L_CLOTH, jit: 0 });
      S.box(.06, .3, .02, 0, .22, .125, wht, { l: L_CLOTH, jit: 0 }); S.box(.24, .06, .02, 0, .27, .125, wht, { l: L_CLOTH, jit: 0 });
      S.box(.34, .42, .03, 0, .2, -.14, blueD, { l: L_CLOTH, jit: 0 });
      for (const s of [-1, 1]) { S.sph(.115, s * .22, .41, 0, pl, { l: L_METAL, rough: .35, w: 6, h: 4, smooth: false, sc: [1.05, .75, 1.15] }); S.box(.13, .025, .2, s * .23, .345, 0, trim, { jit: 0 }); }
      S.cyl(.1, .09, 0, .46, 0, pl, { n: 8, l: L_METAL, rough: .38 });
    }, cap, { rad: .17 });
    k.head = new PartBatch(S => {
      S.cyl(.125, .25, 0, .125, .005, pl, { n: 8, l: L_METAL, rough: .32, jit: 0 }); S.cyl(.128, .025, 0, .255, .005, plD, { n: 8, l: L_METAL, rough: .4, jit: 0 });
      S.box(.2, .028, .04, 0, .155, .11, COL.black, { jit: 0 }); S.box(.035, .14, .03, 0, .1, .122, trim, { l: L_METAL, rough: .35, jit: 0 });
      for (let i = 0; i < 3; i++) S.box(.016, .016, .02, .05, .07 - i * .03, .12, COL.black, { jit: 0 });
      S.box(.035, .09, .2, 0, .31, -.01, blue, { l: L_CLOTH, jit: 0 }); S.box(.025, .05, .16, 0, .37, -.03, blueD, { l: L_CLOTH, jit: 0 });
    }, cap, { rad: .15 });
    k.uArm = F.uArm;
    k.lArm = new PartBatch(S => { S.box(.095, .24, .095, 0, -.12, 0, pl, m()); S.box(.12, .07, .12, 0, -.02, 0, plD, m()); S.box(.1, .09, .1, 0, -.27, 0, plD, m()); }, limb, { rad: .07, shadow: false });
    k.uLeg = new PartBatch(S => { S.box(.125, .28, .125, 0, -.14, 0, pl, m()); S.box(.13, .07, .14, 0, -.28, .01, plD, m()); }, limb, { rad: .08, shadow: false });
    k.lLeg = new PartBatch(S => { S.box(.11, .28, .11, 0, -.14, 0, pl, m()); S.box(.12, .06, .21, 0, -.29, .045, plD, m()); }, limb, { rad: .08, shadow: false });
  } else if (style === 'pike') {
    // Pikemen: a quartered red and black doublet over mail, an open kettle helm with a wide brim (face showing),
    // red and black striped hose. Arms and boots reuse the footman's batches.
    const F = KIT.foot, red = C(0xb02a20), blk = C(0x231f24), mail = COL.steel;
    k.pelvis = new PartBatch(S => { for (const s of [-1, 1]) S.box(.15, .15, .2, s * .075, -.01, 0, s > 0 ? blk : red, { l: L_CLOTH, jit: 0 }); S.box(.31, .05, .21, 0, .06, 0, COL.leather, {}); S.box(.05, .05, .02, 0, .06, .108, COL.brass, { l: L_METAL, jit: 0 }); }, cap, { rad: .12 });
    k.torso = new PartBatch(S => {
      for (const s of [-1, 1]) { S.box(.17, .19, .22, s * .085, .1, 0, s > 0 ? red : blk, { l: L_CLOTH, jit: 0 }); S.box(.17, .19, .22, s * .085, .29, 0, s > 0 ? blk : red, { l: L_CLOTH, jit: 0 }); }
      for (const y of [.16, .24, .32]) S.box(.012, .05, .02, .0, y, .112, COL.brass, { l: L_METAL, jit: 0 });
      S.box(.4, .08, .24, 0, .41, 0, mail, { l: L_METAL, rough: .5 }); S.box(.16, .08, .16, 0, .45, 0, COL.skin, {});
    }, cap, { rad: .17 });
    k.head = new PartBatch(S => {
      S.box(.19, .2, .19, 0, .12, 0, COL.skin, { jit: .04 }); S.box(.18, .06, .04, 0, .04, .085, mulC(COL.leather, .55), {});
      S.add(gDome(8, 3), { s: [.15, .14, .15], p: [0, .19, 0], c: mail, l: L_METAL, rough: .36 }); S.cyl(.24, .022, 0, .19, 0, mulC(mail, .8), { n: 10, l: L_METAL, rough: .36, jit: 0 });
      S.box(.02, .1, .14, 0, .3, 0, mulC(mail, 1.1), { l: L_METAL, rough: .36, jit: 0 }); S.box(.03, .12, .03, .08, .38, -.04, red, { r: [-.5, 0, .3], jit: 0 });
      for (const s of [-1, 1]) S.box(.03, .03, .02, s * .05, .14, .098, COL.black, { jit: 0 });
    }, cap, { rad: .15 });
    k.uArm = F.uArm; k.lArm = F.lArm; k.lLeg = F.lLeg;
    k.uLeg = new PartBatch(S => { for (let i = 0; i < 4; i++) S.box(.118, .07, .118, 0, -.035 - i * .07, 0, i & 1 ? blk : red, { l: L_CLOTH, jit: 0 }); }, limb, { rad: .08, shadow: false });
  } else if (style === 'militia') {
    // Rally militia: undyed linen shirts, a brown jerkin, rolled sleeves, bare heads with hair; varied per man by tint.
    const F = KIT.foot, lin = C(0xa89a78), jerk = C(0x6a4a30), brown = C(0x5a4632), hair = C(0x3a2a1c);
    k.pelvis = new PartBatch(S => { S.box(.28, .14, .19, 0, 0, 0, brown, { l: L_CLOTH }); S.box(.3, .04, .2, 0, .06, 0, mulC(COL.rope, .8), { jit: 0 }); }, cap, { rad: .12 });
    k.torso = new PartBatch(S => {
      S.box(.32, .38, .21, 0, .2, 0, lin, { l: L_CLOTH, jit: 0 });
      for (const s of [-1, 1]) S.box(.11, .36, .225, s * .1, .19, 0, jerk, { l: L_CLOTH, jit: 0 });
      S.box(.34, .05, .225, 0, .06, 0, mulC(COL.leather, .8), {}); S.box(.16, .08, .16, 0, .44, 0, COL.skin, {});
    }, cap, { rad: .17 });
    k.head = new PartBatch(S => {
      S.box(.19, .2, .19, 0, .12, 0, COL.skin, { jit: .04 }); S.box(.2, .07, .2, 0, .22, -.005, hair, { jit: .05 }); S.box(.2, .14, .06, 0, .15, -.075, hair, { jit: .05 });
      for (const s of [-1, 1]) S.box(.03, .03, .02, s * .05, .14, .098, COL.black, { jit: 0 });
      S.box(.12, .04, .02, 0, .065, .097, mulC(hair, 1.2), { jit: 0 });
    }, cap, { rad: .14 });
    k.uArm = new PartBatch(S => { S.box(.1, .2, .1, 0, -.1, 0, lin, { l: L_CLOTH }); S.box(.085, .07, .085, 0, -.235, 0, COL.skin, {}); }, limb, { rad: .07, shadow: false });
    k.lArm = F.lArm; k.lLeg = F.lLeg;
    k.uLeg = new PartBatch(S => { S.box(.115, .28, .115, 0, -.14, 0, brown, { l: L_CLOTH }); }, limb, { rad: .08, shadow: false });
  } else {
    const sk = COL.ogre, sdk = COL.ogreD, o = () => ({ jit: .06, d: 1 });
    k.pelvis = new PartBatch(S => { S.ico(.2, 0, 0, 0, sdk, { sc: [1.15, .6, .95], d: 1 }); clothPanel(S, { x0: -.15, x1: .15, yTop: .02, len: .3, z: .17, col: COL.leather, rng: makeRng(3), sway: 0, nx: 3, ny: 4 }); clothPanel(S, { x0: -.14, x1: .14, yTop: .02, len: .24, z: -.17, col: mulC(COL.leather, .7), rng: makeRng(4), sway: 0, nx: 3, ny: 3 }); S.box(.44, .05, .36, 0, .03, 0, mulC(COL.leather, .6), {}); }, cap, { rad: .2 });
    k.torso = new PartBatch(S => {
      S.ico(.27, 0, .17, .04, sk, { sc: [1.1, .9, 1.05], d: 1 }); S.ico(.25, 0, .37, -.01, sk, { sc: [1.2, .75, .85], d: 1 });
      for (const s of [-1, 1]) S.ico(.11, s * .27, .45, 0, sdk, { d: 1 });
      S.sph(.1, -.27, .5, 0, COL.iron, { l: L_METAL, w: 6, h: 4, smooth: false }); for (let a = 0; a < 3; a++) S.cone(.03, .1, -.27 + Math.cos(a * 2.1) * .08, .6, Math.sin(a * 2.1) * .08, COL.ironL, { n: 4, l: L_METAL });
      S.box(.07, .5, .03, .08, .25, .29, mulC(COL.leather, .7), { r: [0, 0, .5] });
    }, cap, { rad: .28 });
    k.head = new PartBatch(S => {
      S.ico(.13, 0, .1, .02, sk, { sc: [1.05, .95, 1.0], d: 1 }); S.box(.19, .07, .13, 0, .03, .08, sdk, { jit: 0 }); S.box(.22, .04, .08, 0, .15, .09, sdk, { jit: 0 });
      for (const s of [-1, 1]) { S.cone(.022, .09, s * .07, .08, .15, COL.bone, { n: 4, l: L_BONE }); S.box(.045, .03, .03, s * .055, .125, .125, COL.black, { jit: 0 }); S.box(.04, .09, .03, s * .15, .12, 0, sdk, { r: [0, 0, s * -.4] }); }
    }, cap, { rad: .13 });
    k.uArm = new PartBatch(S => { S.ico(.1, 0, -.12, 0, sk, { sc: [1, 1.5, 1], d: 1 }); }, limb, { rad: .1, shadow: false });
    k.lArm = new PartBatch(S => { S.ico(.09, 0, -.12, 0, sk, { sc: [1, 1.5, 1], d: 1 }); S.ico(.085, 0, -.27, 0, sdk, { d: 1 }); S.box(.2, .06, .2, 0, -.18, 0, COL.leather, {}); }, limb, { rad: .1, shadow: false });
    k.uLeg = new PartBatch(S => { S.ico(.11, 0, -.1, 0, sk, { sc: [1, 1.35, 1.05], d: 1 }); }, limb, { rad: .1, shadow: false });
    k.lLeg = new PartBatch(S => { S.ico(.095, 0, -.1, 0, sk, { sc: [1, 1.3, 1], d: 1 }); S.box(.17, .07, .26, 0, -.21, .05, sdk, {}); }, limb, { rad: .1, shadow: false });
  }
  return k;
}

function initKits() {
  const iron = COL.iron, rust = mixC(COL.ironL, C(0x7a4a2a), .45);
  KIT.skel = humanKit('skel', 96);
  KIT.foot = humanKit('foot', 40);
  KIT.giant = humanKit('giant', 2);
  KIT.ogre = humanKit('ogre', 30);
  KIT.knight = humanKit('knight', 16); KIT.pike = humanKit('pike', 16); KIT.militia = humanKit('militia', 16);
  // Branch footmen are few and small: only the torso casts a shadow (each caster is drawn again per shadow map).
  for (const k of [KIT.knight, KIT.pike, KIT.militia]) for (const p of ['pelvis', 'head']) k[p].mesh.castShadow = false;
  for (const k of ['uArm', 'lArm', 'uLeg', 'lLeg']) KIT.giant[k].mesh.castShadow = true;
  const E = KIT.item = {};
  E.sword = new PartBatch(S => { S.box(.035, .13, .035, 0, 0, 0, COL.woodD, {}); S.box(.17, .03, .05, 0, .075, 0, iron, { l: L_METAL }); S.box(.055, .5, .018, 0, .34, 0, rust, { l: L_METAL, rough: .5 }); S.cone(.03, .08, 0, .63, 0, rust, { n: 4, l: L_METAL, rough: .5, rz: .012 }); }, 100, { rad: .05, shadow: false });
  E.blade = new PartBatch(S => { S.box(.04, .13, .04, 0, 0, 0, COL.leather, {}); S.box(.2, .035, .055, 0, .075, 0, COL.brass, { l: L_METAL, rough: .4 }); S.box(.06, .52, .02, 0, .35, 0, mulC(COL.steel, 1.15), { l: L_METAL, rough: .3 }); S.cone(.032, .09, 0, .655, 0, mulC(COL.steel, 1.15), { n: 4, l: L_METAL, rough: .3 }); }, 40, { rad: .05, shadow: false });
  E.torch = new PartBatch(S => { S.box(.04, .42, .04, 0, .1, 0, COL.woodD, { l: L_WOOD }); S.cyl(.06, .1, 0, .34, 0, mulC(COL.black, 3), { n: 6 }); S.cyl(.05, .03, 0, .4, 0, COL.ember, { n: 6, emis: .5, jit: 0 }); }, 80, { rad: .05, shadow: false });
  E.shieldR = new PartBatch(S => { S.cyl(.27, .05, 0, 0, 0, COL.woodD, { n: 8, r: [HPI, 0, 0], l: L_WOOD }); S.add(gTorus(8, .13, 4), { s: .25, p: [0, 0, .01], c: iron, l: L_METAL }); S.sph(.075, 0, 0, .04, COL.ironL, { l: L_METAL, w: 6, h: 4, smooth: false }); for (let a = 0; a < 4; a++) S.box(.03, .42, .012, 0, 0, .03, iron, { l: L_METAL, r: [0, 0, a * PI / 4] }); }, 60, { rad: .2, shadow: false });
  E.shieldH = new PartBatch(S => { const sc = mulC(COL.clothB, 1.6); S.box(.36, .3, .045, 0, .08, 0, sc, { l: L_WOOD, jit: 0 }); S.box(.26, .12, .045, 0, -.12, 0, sc, { l: L_WOOD, jit: 0 }); S.box(.14, .1, .045, 0, -.22, 0, sc, { l: L_WOOD, jit: 0 }); S.box(.07, .5, .05, 0, -.02, .004, mulC(COL.gold, .8), { l: L_METAL, rough: .45, jit: 0 }); S.box(.36, .06, .05, 0, .1, .004, mulC(COL.gold, .8), { l: L_METAL, rough: .45, jit: 0 }); }, 40, { rad: .2, shadow: false });
  E.helm = new PartBatch(S => { S.add(gDome(8, 3), { s: [.18, .175, .195], p: [0, .16, 0], c: iron, l: L_METAL, rough: .5 }); S.box(.035, .13, .03, 0, .15, .185, COL.ironL, { l: L_METAL }); for (const s of [-1, 1]) S.box(.03, .14, .13, s * .165, .1, .03, iron, { l: L_METAL }); S.cone(.03, .16, 0, .4, 0, COL.ironL, { n: 4, l: L_METAL }); }, 60, { rad: .16, shadow: false });
  E.plate = new PartBatch(S => { S.box(.35, .31, .25, 0, .27, 0, iron, { l: L_METAL, rough: .5 }); S.box(.2, .2, .26, 0, .29, .005, COL.ironL, { l: L_METAL, rough: .45 }); for (const s of [-1, 1]) S.sph(.1, s * .21, .44, 0, COL.ironL, { l: L_METAL, w: 6, h: 4, smooth: false, sc: [1, .8, 1.1] }); }, 60, { rad: .2, shadow: false });
  // Footman branch gear: the knight's heater shield (blue field, white cross, steel rim), the pike (held at y = 0,
  // a long shaft with a leaf head and a red tassel), the militia's pitchfork and cudgel, a straw hat and a quiver.
  {
    const blue = C(0x3762b4), wht = C(0xe2ddd0), rim = mulC(COL.steel, .9), o = { l: L_METAL, rough: .38, jit: 0 };
    E.kShield = new PartBatch(S => {
      S.box(.38, .3, .05, 0, .08, 0, rim, o); S.box(.28, .12, .05, 0, -.12, 0, rim, o); S.box(.15, .1, .05, 0, -.22, 0, rim, o);
      S.box(.34, .27, .055, 0, .08, .004, blue, { l: L_CLOTH, jit: 0 }); S.box(.24, .11, .055, 0, -.11, .004, blue, { l: L_CLOTH, jit: 0 }); S.box(.12, .08, .055, 0, -.2, .004, blue, { l: L_CLOTH, jit: 0 });
      S.box(.06, .44, .06, 0, -.01, .006, wht, { l: L_CLOTH, jit: 0 }); S.box(.3, .06, .06, 0, .1, .006, wht, { l: L_CLOTH, jit: 0 });
    }, 32, { rad: .2, shadow: false });
    E.pike = new PartBatch(S => {
      S.seg([0, -.78, 0], [0, 1.62, 0], .024, .02, COL.woodD, { l: L_WOOD, n: 4 }); S.box(.05, .14, .05, 0, 1.6, 0, COL.iron, { l: L_METAL });
      S.add(gOct(), { s: [.05, .2, .025], p: [0, 1.82, 0], c: mulC(COL.steel, 1.2), l: L_METAL, rough: .3, jit: 0 });
      S.box(.07, .06, .07, 0, 1.52, 0, C(0xb02a20), { l: L_CLOTH, jit: 0 });
    }, 32, { rad: .06, shadow: false });
    E.fork = new PartBatch(S => {
      S.seg([0, -.8, 0], [0, 1.05, 0], .022, .02, COL.woodL, { l: L_WOOD, n: 4 }); S.box(.2, .03, .03, 0, 1.06, 0, COL.iron, { l: L_METAL });
      for (const x of [-.09, 0, .09]) S.seg([x, 1.06, 0], [x * 1.1, 1.36, 0], .011, .006, COL.ironL, { l: L_METAL, n: 3, jit: 0 });
    }, 16, { rad: .05, shadow: false });
    E.cudgel = new PartBatch(S => { S.seg([0, -.1, 0], [0, .5, 0], .028, .055, COL.wood, { l: L_WOOD, n: 5 }); S.ico(.07, 0, .52, 0, COL.woodD, { d: 0 }); for (let a = 0; a < 3; a++) S.box(.02, .02, .02, Math.cos(a * 2.1) * .06, .45, Math.sin(a * 2.1) * .06, COL.ironL, { jit: 0 }); }, 16, { rad: .06, shadow: false });
    E.straw = new PartBatch(S => { const st = C(0xb7a05e); S.cyl(.24, .02, 0, .2, 0, st, { n: 10, l: L_THATCH, rough: .9 }); S.cyl(.12, .1, 0, .26, 0, st, { n: 8, rt: .7, l: L_THATCH, rough: .9 }); S.cyl(.125, .025, 0, .225, 0, C(0x6a3a22), { n: 8, jit: 0 }); }, 16, { rad: .15, shadow: false });
    E.quiver = new PartBatch(S => { S.cyl(.055, .3, .07, .25, -.14, COL.leather, { n: 6, r: [0, 0, -.35] }); for (let i = 0; i < 4; i++) S.box(.035, .05, .012, .14 + i * .012 - .02, .42 + (i & 1) * .02, -.14 + (i - 1.5) * .015, COL.bone, { jit: 0, r: [0, 0, -.35] }); }, 48, { rad: .08, shadow: false });
  }
  E.bow = new PartBatch(S => { let p = [0, -.36, 0]; for (let i = 1; i <= 6; i++) { const t = i / 6 * 2 - 1, q = [0, t * .36, (1 - t * t) * .12]; S.seg(p, q, .016, .016, COL.woodL, { n: 4, l: L_WOOD }); p = q; } S.seg([0, -.36, 0], [0, .36, 0], .005, .005, COL.bone, { n: 3, jit: 0 }); }, 40, { rad: .1, shadow: false });
  E.club = new PartBatch(S => { S.seg([0, -.12, 0], [0, .62, 0], .045, .11, COL.wood, { l: L_WOOD, n: 6 }); S.cyl(.12, .1, 0, .6, 0, iron, { n: 6, l: L_METAL }); for (let a = 0; a < 6; a++) S.cone(.03, .12, Math.cos(a * 1.05) * .13, .45 + (a % 2) * .14, Math.sin(a * 1.05) * .13, COL.ironL, { n: 4, l: L_METAL, r: [Math.sin(a * 1.05) * 1.57, 0, -Math.cos(a * 1.05) * 1.57] }); }, 10, { rad: .1 });
  E.greatsword = new PartBatch(S => {
    const steel = mulC(mixC(COL.steel, C(0x7a4a2a), .22), 1.15), dark = mulC(iron, .85), fl = mulC(steel, .6);
    S.box(.05, .24, .05, 0, -.02, 0, COL.leather, {}); S.ico(.055, 0, -.17, 0, COL.bone, { l: L_BONE, d: 1 });
    S.box(.36, .05, .08, 0, .12, 0, dark, { l: L_METAL }); for (const sg of [-1, 1]) S.box(.05, .1, .08, sg * .17, .08, 0, dark, { l: L_METAL });
    S.box(.12, .82, .026, 0, .555, 0, steel, { l: L_METAL, rough: .45 }); S.box(.035, .7, .034, 0, .52, 0, fl, { l: L_METAL, rough: .5 });
    for (const z of [.013, -.013]) { const a = [-.06, .965, z], b = [.06, .965, z], c = [0, 1.14, 0]; if (z > 0) S.tri(a, b, c, steel, L_METAL, .45); else S.tri(a, c, b, steel, L_METAL, .45); }
    for (const [y, sg] of [[.42, 1], [.7, -1], [.86, 1]]) S.box(.03, .05, .034, sg * .058, y, 0, COL.black, { jit: 0 });
  }, 2, { rad: .1 });
  const fur = COL.rat, furD = COL.ratD;
  KIT.rat = {
    body: new PartBatch(S => {
      S.ico(.2, 0, .02, 0, fur, { sc: [.75, .7, 1.45], d: 1 }); S.ico(.12, 0, .0, .3, furD, { sc: [.8, .75, 1.3], d: 1 }); S.cone(.045, .13, 0, -.03, .47, C(0x8a6a62), { n: 5, r: [HPI, 0, 0] });
      for (const s of [-1, 1]) { S.box(.07, .08, .02, s * .075, .11, .24, C(0x7a5a55), { r: [0, s * .4, 0] }); S.box(.025, .025, .02, s * .05, .03, .4, COL.black, { jit: 0 }); }
    }, 90, { rad: .15 }),
    leg: new PartBatch(S => { S.box(.05, .14, .05, 0, -.07, 0, furD, {}); S.box(.05, .03, .1, 0, -.14, .03, C(0x8a6a62), {}); }, 360, { rad: .05, shadow: false }),
    tail: new PartBatch(S => { S.seg([0, 0, 0], [0, 0, -.24], .028, .014, C(0x8a6a62), { n: 4 }); }, 180, { rad: .04, shadow: false }),
  };
  KIT.slime = { body: new PartBatch(S => {
    S.add(gDome(10, 5), { s: [.5, .46, .5], p: [0, 0, 0], c: COL.slime, smooth: true, rough: .32, jit: 0, emis: .006, c2: [COL.slimeD[0], COL.slimeD[1], COL.slimeD[2], v => smooth(.3, .0, v.y)] });
    S.cyl(.5, .05, 0, .0, 0, COL.slimeD, { n: 10, rough: .32, rt: .96 });
    S.ico(.17, .04, .16, -.02, mulC(COL.slimeD, .6), { d: 1, rough: .4, sc: [1, .8, 1] });
    for (const s of [-1, 1]) S.box(.07, .09, .03, s * .13, .2, .42, COL.black, { jit: 0, r: [-.35, 0, 0] });
  }, 80, { rad: .3 }) };
  KIT.bat = {
    body: new PartBatch(S => { S.ico(.11, 0, 0, 0, COL.bat, { sc: [.9, .9, 1.4], d: 1 }); for (const s of [-1, 1]) { S.cone(.03, .1, s * .05, .1, .1, COL.bat, { n: 4 }); S.box(.02, .02, .02, s * .04, .03, .15, COL.black, { jit: 0 }); } }, 50, { rad: .1 }),
    wing: new PartBatch(S => {
      const c = mulC(COL.bat, 1.25), c2 = mulC(COL.bat, .8), pts = [[0, 0, .1], [.2, .03, .14], [.46, .02, .06], [.4, 0, -.06], [.27, 0, -.02], [.2, 0, -.14], [.1, 0, -.06], [0, 0, -.12]];
      for (let i = 1; i < pts.length - 1; i++) { S.tri(pts[0], pts[i + 1], pts[i], i & 1 ? c : c2, L_PLAIN, .9); S.tri(pts[0], pts[i], pts[i + 1], i & 1 ? c : c2, L_PLAIN, .9); }
      S.seg([0, 0, .1], [.46, .02, .06], .014, .008, c2, { n: 3 });
    }, 100, { rad: .1 }),
  };
  KIT.arrow = new PartBatch(S => { S.box(.022, .022, .5, 0, 0, 0, COL.woodL, { jit: 0 }); S.cone(.035, .09, 0, 0, .29, COL.ember, { n: 4, r: [HPI, 0, 0], emis: .9, jit: 0 }); for (const r of [0, HPI]) S.box(.07, .006, .1, 0, 0, -.2, COL.bone, { r: [0, 0, r], jit: 0 }); }, 120, { shadow: false });
  KIT.shell = new PartBatch(S => { S.sph(.12, 0, 0, 0, mulC(COL.iron, .8), { l: L_METAL, w: 7, h: 5, smooth: false, rough: .5 }); S.box(.04, .04, .04, 0, .12, 0, COL.ember, { emis: 1, jit: 0 }); }, 24, {});
  KIT.coin = new PartBatch(S => { S.cyl(.075, .022, 0, 0, 0, COL.gold, { n: 8, l: L_METAL, rough: .35, emis: .16, jit: 0 }); S.cyl(.05, .026, 0, 0, 0, mulC(COL.gold, 1.3), { n: 8, l: L_METAL, rough: .3, emis: .2, jit: 0 }); }, 160, { shadow: false, rad: .05 });
  KIT.goo = new PartBatch(S => { S.ico(.08, 0, 0, 0, COL.slime, { d: 1, rough: .3, emis: .08 }); }, 200, { shadow: false, rad: .06 });
  KIT.rubble = new PartBatch(S => { S.rock(.14, 0, 0, 0, COL.stone, {}); }, 160, { rad: .1 });
  KIT.plank = new PartBatch(S => { S.box(.12, .6, .05, 0, 0, 0, COL.wood, { l: L_WOOD }); }, 100, { rad: .08 });
  // Neutral lump for death bits: tinted bone, gore, chitin or fur, squashed by the matrix scale.
  KIT.bit = new PartBatch(S => { S.ico(.06, 0, 0, 0, [.8, .8, .8], { sc: [1, .7, 1.7], d: 0, jit: .05 }); S.ico(.035, 0, .01, .09, [.72, .72, .72], { d: 0 }); }, 320, { shadow: false, rad: .05 });
  // Spell pieces (FX.meteor, FX.frostNova): a burning boulder with glowing cracks and a cluster of ice crystals.
  KIT.meteor = new PartBatch(S => { S.rock(.5, 0, 0, 0, C(0x2a2422), { d: 2, sq: .9, l: L_ROCK }); for (let k = 0; k < 9; k++) { const a = k * 2.4, e = Math.sin(k * 1.7) * .9; S.box(.16, .05, .05, Math.cos(a) * Math.cos(e) * .44, Math.sin(e) * .4, Math.sin(a) * Math.cos(e) * .44, COL.ember, { emis: 1, jit: 0, r: [k, a, e] }); } }, 6, { rad: .45 });
  KIT.ice = new PartBatch(S => { const ic = C(0x6cb8ea), wt = C(0xcfeeff); S.add(gOct(), { s: [.11, .42, .11], p: [0, .3, 0], c: ic, emis: .22, jit: .05 }); S.add(gOct(), { s: [.08, .3, .08], p: [.12, .16, .05], c: wt, emis: .35, r: [0, 0, -.55], jit: .05 }); S.add(gOct(), { s: [.07, .26, .07], p: [-.1, .13, -.06], c: ic, emis: .35, r: [.3, 0, .6], jit: .05 }); S.add(gOct(), { s: [.06, .2, .06], p: [.02, .1, -.13], c: wt, emis: .35, r: [-.65, 0, 0], jit: .05 }); }, 64, { rad: .2, shadow: false });
  initBestiary();
}

const SPEC = {
  skel: { hip: .6, pelvisH: .12, torsoH: .46, shX: .21, shY: .42, uArm: .27, lArm: .29, hipX: .085, uLeg: .29, lLeg: .3, stride: .62, lean: .12, stoop: .1, eyeX: .058, eyeY: .185, eyeZ: .15, top: 1.42 },
  foot: { hip: .59, pelvisH: .1, torsoH: .46, shX: .23, shY: .4, uArm: .27, lArm: .27, hipX: .09, uLeg: .29, lLeg: .29, stride: .55, lean: .06, stoop: 0, eyeX: 0, eyeY: 0, eyeZ: 0, top: 1.4 },
  ogre: { hip: .43, pelvisH: .08, torsoH: .5, shX: .3, shY: .43, uArm: .25, lArm: .3, hipX: .12, uLeg: .21, lLeg: .21, stride: .5, lean: .1, stoop: .14, eyeX: .055, eyeY: .125, eyeZ: .15, top: 1.2 },
};
const RIGOUT = { headM: _M[3], handR: new THREE.Vector3(), handL: new THREE.Vector3(), tip: new THREE.Vector3(), torch: new THREE.Vector3() };
function rigHuman(kit, sp, e) {
  const s = e.scale || 1, mv = e.mv, ph = e.ph, fl = e.flash || 0, tint = e.tint || null, fz = e.flinch || 0;
  const sw = Math.sin(ph) * sp.stride * mv, cw = Math.cos(ph);
  let twist = Math.sin(ph) * .12 * mv, lean = sp.lean * mv + sp.stoop, lunge = 0, dip = 0;
  let shR = .25 * sw - .15, elR = -.35, bladeA = .55, shL = -.7 * sw - .1, elL = -.3, rzR = -.1, rzL = .1;
  if (e.shamble) { shR = -1.0 + .12 * Math.sin(ph); elR = -.7; shL = -.75 + .2 * Math.sin(ph + 1); elL = -.5; bladeA = .2; }
  if (e.shield) { shL = -.55; elL = -1.25; rzL = .2; }
  if (e.torch) { shL = -1.25 + .06 * Math.sin(ph * 2); elL = -.5; }
  if (e.point > 0) { const u = e.point, b = Math.sin((e.ph || 0) * 1.3) * .08; shR = lerp(shR, -1.95 + b, u); elR = lerp(elR, -.1, u); rzR = lerp(rzR, -.18, u); shL = lerp(shL, -.25, u); elL = lerp(elL, -1.6, u); rzL = lerp(rzL, .55, u); }
  if (e.heavy) { shR = -.3 + .3 * sw; elR = -.5; bladeA = 1.9; shL = -.2 - .5 * sw; elL = -.6; }
  if (e.claw) { shR = -1.25 + .45 * sw; elR = -.55; shL = -1.25 - .45 * sw; elL = -.55; }
  if (e.push) { const p = e.push; shR = -1.62 + .1 * sw; elR = -.5; shL = -1.62 - .1 * sw; elL = -.5; rzR = -.12; rzL = .12; lean += .22 * p; twist *= .4; }
  if (e.staff) { shR = -.75; elR = -.95; bladeA = .12; }
  if (e.staffOut) { shR = -.42 + .12 * sw; elR = -.5; rzR = -.32; bladeA = .08; }
  if (e.cast > 0) { const u = easeInOut(Math.min(1, e.cast * 1.6)); shR = lerp(shR, -2.7, u); elR = lerp(elR, -.25, u); shL = lerp(shL, -2.3, u); elL = lerp(elL, -.4, u); }
  if (e.drum) { const b = Math.sin(e.beat || 0); shR = -.95 - .5 * Math.max(0, b); elR = -1.15; shL = -.95 - .5 * Math.max(0, -b); elL = -1.15; bladeA = .9; }
  let atk = e.atk;
  // Pole arms (pikes, pitchforks): carried upright on the march, lowered level in both hands to fight (e.lv 0-1),
  // and the attack is a draw-back and thrust instead of the overhead cut.
  if (e.pike) {
    const lv = e.lv || 0, two = !e.torch;
    shR = lerp(-.3 + .15 * sw, -.72, lv); elR = lerp(-1.05, -.6, lv); rzR = lerp(-.05, .32, lv); bladeA = lerp(.1, 1.36, lv);
    if (two) { shL = lerp(shL, -1.02, lv); elL = lerp(elL, -.42, lv); rzL = lerp(rzL, -.42, lv); }
    if (atk >= 0) {
      const t = atk, k = t < .4 ? -.7 * easeInOut(t / .4) : t < .54 ? lerp(-.7, 1, easeIn((t - .4) / .14)) : 1 - easeOut((t - .54) / .46);
      shR -= .32 * k; elR += .4 * k; if (two) { shL -= .3 * k; elL += .3 * k; }
      lunge = .17 * Math.max(0, k) - .05 * Math.max(0, -k); lean += .12 * k; twist = -.18 * k; dip = .03 * Math.max(0, k); atk = -1;
    }
  }
  if (e.bow) {
    const d = e.draw || 0; shL = -HPI + (e.pitch || 0); elL = -.05; rzL = .05; shR = -HPI + (e.pitch || 0) + .1; elR = -.2 - d * 1.9; twist = .2 + d * .25; atk = -1;
  }
  if (atk >= 0) {
    const t = atk;
    if (t < .38) { const u = easeInOut(t / .38); shR = lerp(shR, -3.35, u); elR = lerp(elR, -.95, u); bladeA = lerp(bladeA, -2.95, u); twist = lerp(twist, -.42, u); lean = lerp(lean, -.12, u); }
    else if (t < .52) { const u = easeIn((t - .38) / .14); shR = lerp(-3.35, -.85, u); elR = lerp(-.95, -.12, u); bladeA = lerp(-2.95, 1.75, u); twist = lerp(-.42, .42, u); lean = lerp(-.12, .26, u); lunge = .14 * u; dip = .05 * u; }
    else { const u = easeOut((t - .52) / .48); shR = lerp(-.85, shR, u); elR = lerp(-.12, elR, u); bladeA = lerp(1.75, bladeA, u); twist = lerp(.42, twist, u); lean = lerp(.26, lean, u); lunge = .14 * (1 - u); dip = .05 * (1 - u); }
  }
  const bob = -sp.uLeg * (1 - Math.cos(sw)) - dip + (e.heavy ? Math.abs(Math.sin(ph)) * .035 * mv : Math.abs(Math.sin(ph)) * .02 * mv);
  const M0 = xf(_M[0], null, e.x, e.y, e.z, 0, e.yaw, 0, s, s, s);
  const M1 = xf(_M[1], M0, 0, sp.hip + sp.uLeg * 0 + bob, lunge - fz * .06, lean * .4 - fz * .18, twist * .5, (e.shamble ? Math.sin(ph) * .05 * mv : 0));
  kit.pelvis.put(M1, fl, tint);
  const M2 = xf(_M[2], M1, 0, sp.pelvisH, 0, lean * .6 - fz * .4, twist, 0);
  kit.torso.put(M2, fl, tint);
  const M3 = xf(_M[3], M2, 0, sp.torsoH, 0, -lean * .6 - fz * .35 + (e.shamble ? Math.sin(ph * 2) * .05 : 0), -twist * .8, e.shamble ? Math.sin(ph) * .1 * mv : 0);
  kit.head.put(M3, fl, tint);
  const M4 = xf(_M[4], M2, sp.shX, sp.shY, 0, shL + fz * .5, 0, rzL + fz * .3), M5 = xf(_M[5], M4, 0, -sp.uArm, 0, elL, 0, 0);
  kit.uArm.put(M4, fl, tint); kit.lArm.put(M5, fl, tint);
  const M6 = xf(_M[6], M2, -sp.shX, sp.shY, 0, shR + fz * .4, 0, rzR - fz * .3), M7 = xf(_M[7], M6, 0, -sp.uArm, 0, elR, 0, 0);
  kit.uArm.put(M6, fl, tint); kit.lArm.put(M7, fl, tint);
  RIGOUT.handR.set(0, -sp.lArm, 0).applyMatrix4(M7); RIGOUT.handL.set(0, -sp.lArm, 0).applyMatrix4(M5);
  const I = KIT.item, psiR = shR + elR + fz * .4, psiL = shL + elL + fz * .5;
  if (e.weapon) { const M8 = xf(_M[8], M7, 0, -sp.lArm, 0, bladeA - psiR, 0, 0, e.wScale || 1, e.wScale || 1, e.wScale || 1); e.weapon.put(M8, fl, null); RIGOUT.tip.set(0, .6, 0).applyMatrix4(M8); }
  if (e.shield) { const M9 = xf(_M[9], M5, .04, -sp.lArm * .6, .06, -psiL + .05, .25, 0); e.shield.put(M9, fl, e.shieldTint || null); }
  if (e.torch) { const M9 = xf(_M[9], M5, 0, -sp.lArm, 0, .25 - psiL, 0, 0); I.torch.put(M9, 0, null); RIGOUT.torch.set(0, .46, 0).applyMatrix4(M9); }
  if (e.bow) { const M9 = xf(_M[9], M5, 0, -sp.lArm, 0, HPI + .0, 0, 0); I.bow.put(M9, fl, null); }
  if (e.helm) I.helm.put(M3, fl, null);
  if (e.hat) e.hat.put(M3, fl, e.tint || null); if (e.quiver) I.quiver.put(M2, fl, null);
  if (e.plate) I.plate.put(M2, fl, null);
  if (e.hood) I.hood.put(M3, fl, null); if (e.robe) I.robe.put(M2, fl, null); if (e.drum) I.drum.put(M2, fl, null); if (e.standard) I.standard.put(M2, 0, null);
  if (e.keg) I.keg.put(M2, fl, null); if (e.wraps) { I.wraps.put(M2, fl, null); I.wrapHead.put(M3, fl, null); } if (e.crown) I.crown.put(M3, fl, null);
  const kL = Math.max(0, cw) * 1.0 * mv, kR = Math.max(0, -cw) * 1.0 * mv;
  const M10 = xf(_M[10], M1, sp.hipX, 0, 0, -sw - kL * .25, 0, 0), M11 = xf(_M[11], M10, 0, -sp.uLeg, 0, kL, 0, 0);
  const M12 = xf(_M[12], M1, -sp.hipX, 0, 0, sw - kR * .25, 0, 0), M13 = xf(_M[13], M12, 0, -sp.uLeg, 0, kR, 0, 0);
  kit.uLeg.put(M10, fl, tint); kit.lLeg.put(M11, fl, tint); kit.uLeg.put(M12, fl, tint); kit.lLeg.put(M13, fl, tint);
  return M3;
}
function rigRat(e) {
  const K = KIT.rat, ph = e.ph, s = e.scale || 1, fl = e.flash || 0, mv = e.mv;
  const M0 = xf(_M[0], null, e.x, e.y + (.2 + Math.abs(Math.sin(ph * 2)) * .035 * mv) * s, e.z, Math.sin(ph * 2) * .07 * mv - (e.flinch || 0) * .5, e.yaw, 0, s, s, s);
  K.body.put(M0, fl, e.tint);
  for (let i = 0; i < 4; i++) {
    const fr = i < 2, sd = (i & 1) ? -1 : 1, a = Math.sin(ph * 2 + (fr === (sd > 0) ? 0 : PI)) * .9 * mv;
    K.leg.put(xf(_M[4 + i], M0, sd * .12, -.04, fr ? .16 : -.16, a, 0, sd * .15), fl, e.tint);
  }
  const T1 = xf(_M[8], M0, 0, .03, -.26, .25, Math.sin(ph + 1) * .4, 0); K.tail.put(T1, fl, e.tint);
  K.tail.put(xf(_M[9], T1, 0, 0, -.24, -.2, Math.sin(ph + 2.2) * .6, 0, .8, .8, 1), fl, e.tint);
  return M0;
}
function rigSlime(e) {
  const s = e.scale || 1, h = e.hop || 0, fl = e.flash || 0;
  let sy = 1, y = 0;
  if (h < .22) sy = 1 - .3 * easeOut(h / .22);
  else if (h < .6) { const u = (h - .22) / .38; sy = .7 + .62 * Math.sin(Math.min(1, u * 1.6) * HPI) - .12 * u; y = Math.sin(u * PI) * .34; }
  else if (h < .76) { const u = (h - .6) / .16; sy = 1.2 - .5 * Math.sin(u * PI) - .2 * u; }
  else sy = 1 + .04 * Math.sin((h - .76) / .24 * TAU);
  sy *= 1 - (e.flinch || 0) * .25; const sx = 1 / Math.sqrt(Math.max(.4, sy));
  const M0 = xf(_M[0], null, e.x, e.y + y * s, e.z, 0, e.yaw, 0, s * sx, s * sy, s * sx);
  KIT.slime.body.put(M0, fl, e.tint); return M0;
}
function rigBat(e, K = KIT.bat, wx = .06, wy = .02) {
  const s = e.scale || 1, fl = e.flash || 0, f = Math.sin(e.ph), tint = e.tint || null;
  const M0 = xf(_M[0], null, e.x, e.y + Math.sin(e.ph * .5) * .08, e.z, -.25 + (e.flinch || 0) * .8, e.yaw, Math.sin(e.ph * .25) * .15, s, s, s);
  K.body.put(M0, fl, tint);
  K.wing.put(xf(_M[1], M0, wx, wy, 0, 0, 0, f * .85 + .15), fl, tint);
  // The left wing is the right one turned half a turn about z, not mirrored: a mirror flips the winding, so the
  // face seen from above was the one lit from below and the left wing always looked dark.
  K.wing.put(xf(_M[2], M0, -wx, wy, 0, 0, 0, PI - (f * .85 + .15)), fl, tint);
  return M0;
}

const DEB = [], SHATTER = { a: 0, b: 0 };
const _dq = new THREE.Quaternion(), _dax = new THREE.Vector3(), _dp = new THREE.Vector3(), _ds = new THREE.Vector3(), _dm = new THREE.Matrix4();
// Debris cap with headroom: extra gore stops first, then body parts, so coins always fit.
const DEB_CAP = 900, DEB_BODY = 820, DEB_EXTRA = 700;
function addDebris(batch, mat, tint, vx, vy, vz, spin, life, o = {}) {
  if (DEB.length >= (o.coin ? DEB_CAP : o.extra ? DEB_EXTRA : DEB_BODY)) return null;
  const d = { batch, p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(), vx, vy, vz, w: new THREE.Vector3(frr(-1, 1), frr(-1, 1), frr(-1, 1)).normalize(), ws: spin, life, max: life, tint: tint ? tint.slice() : null, rad: o.rad || batch.rad, rest: false, coin: o.coin || 0, bounce: o.bounce === undefined ? .32 : o.bounce, flash: o.flash || 0, goo: o.goo || 0, hold: o.hold || 0, float: o.float || 0 };
  mat.decompose(d.p, d.q, d.s); d.rad *= Math.max(d.s.x, d.s.y); DEB.push(d); return d;
}
function shatter(rigFn, e, impulse, o = {}) {
  const ix = impulse[0], iy = impulse[1], iz = impulse[2], spread = o.spread === undefined ? 1.6 : o.spread;
  SHATTER.a = DEB.length;
  RIG_CAPTURE = (batch, mat, tint) => { addDebris(batch, mat, tint, ix + frr(-spread, spread), iy + frr(.4, 2.2) * (o.up || 1), iz + frr(-spread, spread), frr(3, 11), frr(3.2, 5.5) * (o.life || 1), { hold: o.hold ? frr(0, o.hold) : 0 }); };
  try { rigFn(e); } finally { RIG_CAPTURE = null; SHATTER.b = DEB.length; }
}
function updateDebris(dt, groundAt, onCoin) {
  for (let i = DEB.length - 1; i >= 0; i--) {
    const d = DEB[i]; d.life -= dt;
    if (d.life <= 0) { swapRemove(DEB, i); continue; }
    if (d.hold > 0) { d.hold -= dt; }
    else if (!d.rest) {
      if (d.float) { const k = Math.exp(-2.2 * dt); d.vx *= k; d.vz *= k; d.vy = Math.max(-.9, d.vy * k - 3 * dt); } else d.vy -= 13 * dt;
      d.p.x += d.vx * dt; d.p.y += d.vy * dt; d.p.z += d.vz * dt;
      _dq.setFromAxisAngle(d.w, d.ws * dt); d.q.premultiply(_dq);
      const gy = groundAt(d.p.x, d.p.z) + d.rad;
      if (d.p.y < gy) {
        d.p.y = gy;
        if (d.goo) {
          if (d.goo > 1 || frnd() < .35) { d.life = 0; continue; }
          d.goo = 2; d.rest = true; d.vy = 0; d.p.y = gy - d.rad + .025; d.q.setFromAxisAngle(_dax.set(0, 1, 0), frnd() * TAU); d.s.set(d.s.x * 1.8, d.s.y * .2, d.s.z * 1.8); d.life = Math.min(d.life, frr(1.6, 3.2)); d.max = d.life; continue;
        }
        if (Math.abs(d.vy) < 1.2) { d.rest = true; d.vy = 0; } else { d.vy = -d.vy * d.bounce; }
        d.vx *= .55; d.vz *= .55; d.ws *= .5;
      }
    } else if (d.rest && groundAt(d.p.x, d.p.z) < d.p.y - 3) { d.rest = false; d.vy = 0; }
    else if (d.life < .9 && !d.coin) { d.p.y -= dt * .22; }
    if (d.coin && d.max - d.life > d.coin) { onCoin(d); swapRemove(DEB, i); continue; }
    let sc = 1; if (!d.coin && d.life < .5) sc = Math.max(.01, d.life / .5);
    _dm.compose(d.p, d.q, _ds.copy(d.s).multiplyScalar(sc));
    d.batch.put(_dm, d.flash, d.tint);
  }
}
function clearDebris() { DEB.length = 0; }

// Extra death mayhem on top of the shatter in killMonster: loose bits (bone, gore, fur, chitin, rock), goo
// splats and ground stains. Scales back as the debris pool fills so bodies and coins always have room.
const _gm = new THREE.Matrix4(), _gp = new THREE.Vector3(), _gq = new THREE.Quaternion(), _gs = new THREE.Vector3();
const GORE_C = { bone: [1.08, 1.02, .88], blood: [.5, .07, .06], dark: [.3, .04, .04], fur: [.62, .5, .45], bat: [.36, .3, .36], chitin: [.32, .28, .22], rock: [.62, .6, .58], wood: [.95, .82, .7], iron: [.36, .38, .44], feather: [.62, .48, .36], ash: [.24, .22, .21], coal: [.12, .1, .1], dye: [.95, .5, .45] };
function fxGore(m, dth, kind, ix, iz, up) {
  if (!G.B || !KIT.bit) return;
  const hA = G.B.heightAt, sc = m.scale || 1, x = m.x, y = m.y, z = m.z, blast = kind === 'blast';
  const load = sat(DEB.length / DEB_BODY), more = 1 - load, ext = lerp(1.5, 1, sat((load - .3) / .4));
  const keep = k => { if (k <= 1) return; for (let i = SHATTER.a; i < SHATTER.b && i < DEB.length; i++) { const d = DEB[i]; if (!d.coin) { d.life *= k; d.max *= k; } } };
  const bits = (n, tint, spd, upv, size, l0, l1, o = {}) => {
    n = Math.round(n * more);
    for (let i = 0; i < n; i++) {
      _gm.compose(_gp.set(x + frr(-.2, .2) * sc, y + frr(.2, .7) * sc, z + frr(-.2, .2) * sc), _gq.set(frr(-1, 1), frr(-1, 1), frr(-1, 1), 1).normalize(), _gs.setScalar(size * frr(.7, 1.3) * sc));
      if (o.flat) _gs.y *= .35;
      const tn = o.var ? [tint[0] * frr(.8, 1.15), tint[1] * frr(.8, 1.15), tint[2] * frr(.8, 1.15)] : tint;
      addDebris(o.batch || KIT.bit, _gm, tn, ix * .6 + frr(-spd, spd), frr(upv * .45, upv) * up, iz * .6 + frr(-spd, spd), frr(4, 12), frr(l0, l1), { extra: 1, float: o.float || 0, bounce: o.bounce });
    }
  };
  const stain = (dx, dz, size, c, a) => FX.decals.add(hA, x + dx, z + dz, size, c[0], c[1], c[2], a, 60);
  const tintOf = base => m.tint ? [base[0] * m.tint[0], base[1] * m.tint[1], base[2] * m.tint[2]] : base;
  if (dth === 'bones') {
    keep(ext); bits(3 + (blast ? 2 : 0), GORE_C.bone, 1.7, 3.6, .9, 5, 8, { var: 1 });
    stain(0, 0, .45 * sc + .2, [.16, .15, .14], .3);
  } else if (dth === 'fur') {
    keep(ext * .9); bits(6, tintOf(GORE_C.fur), 1.3, 2.8, .85, 2.4, 3.8, { flat: 1, float: 1, var: 1 }); bits(3, GORE_C.blood, 1.8, 3, .45, 3, 5);
    stain(0, 0, .3 * sc + .22, [.055, .012, .012], .6);
  } else if (dth === 'bat') {
    bits(4, tintOf(GORE_C.bat), 1, 1.5, .7, 2, 3.2, { flat: 1, float: 1, var: 1 });
  } else if (dth === 'flesh') {
    keep(ext * .9); bits(4 + (blast ? 2 : 0), GORE_C.blood, 2, 4, 1.0, 4, 7, { var: 1 }); bits(4, GORE_C.dark, 2.5, 3.6, .4, 2.5, 4);
    stain(ix * .22, iz * .22, .4 * sc + .2, [.05, .01, .01], .55);
  } else if (dth === 'bug') {
    bits(4, tintOf(GORE_C.chitin), 1.8, 3, .7, 3, 5, { var: 1 });
    stain(ix * .18, iz * .18, .25 * sc + .12, [.03, .045, .012], .5);
  } else if (dth === 'rock') {
    keep(ext);
    const n = Math.round(3 * more);
    for (let i = 0; i < n; i++) { _gm.compose(_gp.set(x + frr(-.3, .3) * sc, y + frr(.2, 1) * sc, z + frr(-.3, .3) * sc), _gq.identity(), _gs.setScalar(frr(.4, .8))); addDebris(KIT.rubble, _gm, m.tint, frr(-2.5, 2.5) + ix, frr(2, 4.5), frr(-2.5, 2.5) + iz, frr(3, 9), frr(4, 6.5), { extra: 1 }); }
    stain(0, 0, .6 * sc + .2, [.1, .095, .09], .45);
  } else if (dth === 'wood') {
    // Siege ram: wood splinters and planks, iron bits, a dark stain (the crew's bones come from the shatter).
    keep(ext); bits(9, GORE_C.wood, 2.6, 4.4, 1.1, 4, 7, { batch: KIT.splinter, var: 1 }); bits(5, GORE_C.iron, 2, 3.6, .9, 4, 6.5, { var: 1 });
    bits(3, GORE_C.bone, 1.7, 3.2, .9, 4, 6.5, { var: 1 });
    stain(0, 0, .8 * sc + .3, [.12, .1, .08], .4);
  } else if (dth === 'feather') {
    // Harpy: a cloud of feathers that drift down slowly, a little blood.
    bits(12, tintOf(GORE_C.feather), 1.6, 2.6, 1.1, 3.5, 5.5, { batch: KIT.feather, float: 1, var: 1 }); bits(3, GORE_C.blood, 1.4, 2.5, .45, 2.5, 4);
  } else if (dth === 'ember') {
    // Hell hound: ash flakes that float down and a scorched patch.
    keep(ext * .9); bits(8, GORE_C.ash, 1.6, 3.2, .7, 3, 5, { flat: 1, float: 1, var: 1 }); bits(3, GORE_C.coal, 1.8, 3.4, .6, 3, 5);
    stain(0, 0, .45 * sc + .25, [.025, .018, .015], .7);
  } else if (dth === 'hex') {
    // Goblin shaman: blood, dyed feathers from the headdress, bone beads.
    keep(ext * .9); bits(4, GORE_C.blood, 1.8, 3.4, .8, 3, 5, { var: 1 }); bits(5, GORE_C.dye, 1.2, 2.6, .8, 3, 5, { batch: KIT.feather, float: 1, var: 1 });
    stain(ix * .2, iz * .2, .35 * sc + .15, [.04, .012, .01], .55);
  } else if (dth === 'goo') {
    for (let i = 0; i < 3; i++) { const a = frnd() * TAU, d = frr(.5, 1.1) * sc; stain(Math.cos(a) * d + ix * .2, Math.sin(a) * d + iz * .2, frr(.15, .3) * sc + .1, [.012, .034, .014], .6); }
  }
}
