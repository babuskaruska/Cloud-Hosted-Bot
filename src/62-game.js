Object.assign(G, {
  press: 1, bountyMul: 1, dmgMul: 1, waveKills: 0, waveLeaks: 0, leaks: 0, leakTypes: {}, slowmo: 0, bossDown: false,
  queue: [], waveT: 0, nextIn: 0, spawning: false, bossWave: false, bossAlive: false, k: 0, phaseT: 0, banner: null, started: false, timeScale: 1, trickle: 0, clearT: 0, paused: false, speed: 1, best: 0, seen: {},
  // Waves per battlefield; the last one is the boss wave. G.bossWave stays a boolean: "the current wave is the boss wave".
  wavesPerLand: 8, horde: false, fires: [],
});

// Stormreach stand-in scenery until Ash's lands (harmless once BIOME_DRESS.storm exists).
if (!BIOME_DRESS.storm) BIOME_DRESS.storm = BIOME_DRESS.ashen;

// Global wave count (all lands so far), used for the best-run record.
function waveNumber() { return G.level * G.wavesPerLand + (G.phase === 'rise' ? 1 : Math.max(1, G.k)); }
// The wave within the current land, 1..wavesPerLand.
function landWave() { return G.phase === 'rise' ? 1 : clamp(G.k, 1, G.wavesPerLand); }
function isBossK(k) { return k === G.wavesPerLand; }
// Horde waves: a flood of cheap swarm monsters. One per land early on, two from the third land.
function isHordeK(k, level) { return !isBossK(k) && (level < 2 ? k === 5 : (k === 4 || k === 7)); }
// [budget cost, min pack, max pack, gap, unlock (roster step), weight]
const ROSTER = {
  skel: [4, 3, 6, .5, 1, 5], rat: [1.7, 5, 9, .2, 2, 3], bat: [4.2, 3, 5, .35, 2, 1.3], ghoul: [5.5, 2, 4, .4, 2, 2],
  slime: [9.5, 1, 3, .9, 3, 2], spider: [3, 3, 6, .25, 3, 2], scarab: [1.9, 5, 8, .18, 2, 0], knight: [12.5, 1, 3, .5, 4, 2], wolf: [5.5, 2, 4, .35, 4, 1.6], bomber: [6, 1, 2, .8, 4, 1.2],
  wraith: [9, 1, 3, .7, 5, 1.4], toad: [8, 1, 3, .7, 5, .7], wisp: [2.6, 4, 7, .22, 5, .8], drummer: [13, 1, 1, 1, 6, .9], gargoyle: [11, 1, 3, .6, 6, .9],
  necro: [18, 1, 1, 1.2, 7, .9], mummy: [15, 1, 2, .9, 7, .9], brute: [32, 1, 1, 2, 8, .7], golem: [40, 1, 1, 2, 8, .7], brood: [30, 1, 1, 2, 9, .6],
  // Round 4: from the second land (sooner where a land favours them, see bio.early in 29-biome.js).
  shaman: [12, 1, 1, 1, 7, .7], harpy: [9, 1, 2, .7, 7, .7], hound: [6, 3, 5, .3, 8, .8], ram: [30, 1, 1, 1.8, 8, .8],
  // Round 6: weight 0, so only lands that ask for them (bio.mobs) send them.
  drowned: [5, 2, 4, .45, 1, 0],
};
// Horde swarm: [budget cost, weight]. Biome weights from bio.mobs still apply (0 removes one); weight 0 means only
// in lands that list the kind in bio.mobs (the drowned of Stormreach).
const HORDE = { rat: [1.7, 3], spider: [2.6, 2], scarab: [1.2, 2.2], slimelet: [2.8, 1.4], drowned: [3.2, 0] };
// Roster unlocks keep the old pace of five steps per land, spread over the land's waves.
function rosterStep(k, level) { return level * 5 + Math.max(1, Math.ceil(k * 5 / G.wavesPerLand)); }
function waveMenu(k, level) {
  const w = rosterStep(k, level), bio = G.B.bio, menu = [];
  for (const ty in ROSTER) {
    const r = ROSTER[ty], mul = bio.mobs[ty] === undefined ? 1 : bio.mobs[ty], un = Math.min(r[4], bio.early[ty] || 99), wt = r[5] ? r[5] * mul : (bio.mobs[ty] || 0);
    if (w >= un && wt > 0) menu.push([ty, wt * (w === un && w > 1 ? 2.2 : 1)]);
  }
  return menu;
}
// The Hollow Herald is a Long Night boss only: Ash's procBiome puts 'herald' into a generated land's boss list (about one
// land in three from land 8 on). heraldLand(): this land's boss is the Herald (the story and aiThink read it).
function heraldLand() { return !!(G.B && G.B.bio.key === 'proc' && bossType() === 'herald'); }
function bossType() { const b = G.B.bio.boss; return b[Math.floor(G.level / BIOMES.length) % b.length]; }
// The Hollow Herald (MON.herald). Its cage-lantern drinks the light of the towers near it: they go dark and stop for a
// moment (tower.snuff, seconds; Ash may read it, m.stolen counts the lights it holds for the lantern's glow). Enraged, it
// does so more often. The look is Ash's FX.snuff (dims the lights in the circle). Sounds for Echo: 'snuff' and 'heraldCall'.
function heraldSnuff(m, dt) {
  const sp = m.def.snuff; m.snT -= dt * (m.rage ? 1.45 : 1); if (m.snT > 0) return;
  m.snT = sp.every; m.cast = 1; let n = 0; const hy = m.y + m.def.top * m.scale / m.def.scale * .8;
  for (const tw of G.towers) {
    if (!tw.alive || tw.state !== 'active' || dist2(tw.x, tw.z, m.x, m.z) > sp.r * sp.r) continue;
    tw.snuff = Math.max(tw.snuff || 0, sp.t); n++;
    fxBolt([tw.x, tw.y + 2.2, tw.z], [m.x, hy, m.z], .35, [1.5, 1.15, .5], .05);
    fxTimed(5, tw.x, tw.y + 2, tw.z, 2.6, 2.6, .9, .75, .45, .7, .35);
  }
  m.stolen = Math.min(8, (m.stolen || 0) + n);
  if (typeof FX.snuff === 'function') FX.snuff(m.x, m.z, sp.r, sp.t + 1); else fxTimed(4, m.x, m.y + .08, m.z, sp.r * 2, sp.r * 2, .5, .42, .7, .55, .8, { ground: true });
  sfx('snuff', m.x, m.z, 1.1);
}
// It calls echo ghosts (pale, half bounty, as the Echoes mutator's) of the road's common dead behind it.
function heraldCall(m, dt) {
  const cl = m.def.call; m.clT -= dt; if (m.clT > 0) return;
  m.clT = cl.every; if (G.mons.length >= MAX_ALIVE * .8 || m.sumN >= cl.max) return; m.sumN++;
  const menu = waveMenu(G.wavesPerLand, G.level).filter(e => ROSTER[e[0]][0] < 13 && !MON[e[0]].fly); if (!menu.length) return;
  m.cast = 1; sfx('heraldCall', m.x, m.z, 1);
  for (let i = 0; i < cl.n; i++) {
    const ty = menu[Math.floor(rnd() * menu.length)][0], g = spawnMonster(ty, { s: Math.max(.5, m.s - 1.4 - .5 * i), lat: clamp(m.lat + rr(-.6, .6), -.9, .9), hpMul: (m.maxHp / m.def.hp) * cl.hp, pop: .5 });
    g.echo = true; g.bmul = .5; g.tint = [.62, .78, 1];
    G.mix.echo = (G.mix.echo || 0) + 1; G.mix[ty] = (G.mix[ty] || 0) + 1;
    if (G.spdMul !== 1) g.spdMul *= G.spdMul;
  }
}

// Elites: tougher, richer monsters with one twist each. m.elite is the key; Ash draws the aura from it.
const ELITE = {
  burning: { name: 'Põlev', col: '#ff9a4a', hp: 1.6, tip: 'Jätab teele tule, mis põletab su sõdureid.' },
  shielded: { name: 'Kilbiga', col: '#9fd4ff', hp: 1.25, tip: 'Kaitsekilp neelab esimese suure tüki kahjust.' },
  hasted: { name: 'Kiire', col: '#f2e27a', hp: 1.3, tip: 'Palju kiirem kui teised omasugused.' },
  splitting: { name: 'Jagunev', col: '#b4f08a', hp: 1.4, tip: 'Langedes jaguneb kaheks väiksemaks koopiaks.' },
};
const ELITE_KINDS = ['burning', 'shielded', 'hasted', 'splitting'];
const ELITE_BOUNTY = 2.5;
// Elites start late on the first land (global wave 6) and grow more common up to 30%,
// but stay rarer in the first waves of each land while the new board is still being built.
// From the third land on the cap rises (and elites get tougher, see makeElite).
function eliteChance(k, level) { const w = level * G.wavesPerLand + k + G.eliteShift; return w < 6 ? 0 : Math.min(.3 + .03 * Math.max(0, level - 1), .045 + .016 * (w - 6)) * (k <= 2 ? .35 : k <= 4 ? .7 : 1); }
function pickElite(type, k, level, mul = 1) {
  const d = MON[type]; if (d.boss || type === 'scarab' || type === 'slimelet' || rnd() >= eliteChance(k, level) * mul * modMul('elite') * G.eliteMul) return undefined;
  const opts = d.fly ? ['shielded', 'hasted'] : ELITE_KINDS;
  return opts[Math.floor(rnd() * opts.length)];
}
function makeElite(m, kind) {
  const E = ELITE[kind]; if (!E || m.def.boss) return m;
  const lv = 1 + .08 * Math.max(0, G.level - 1);
  m.elite = kind; m.hp *= E.hp * lv; m.maxHp *= E.hp * lv; m.bmul = (m.bmul || 1) * ELITE_BOUNTY; m.scale *= 1.1;
  if (kind === 'shielded') m.ward = m.wardMax = m.maxHp * Math.min(1, .6 + .08 * Math.max(0, G.level - 1));
  if (kind === 'hasted') m.spdMul *= 1.45;
  if (kind === 'burning') m.fireT = .3;
  sfx('elite', m.x, m.z);
  return m;
}
const ECHO_COL = '#a9c6ff'; // Echoes (64-endless.js): a slain elite's pale ghost gets a tag of its own colour
function eliteName(m) { return ELITE[m.elite] ? ELITE[m.elite].name + ' ' + m.def.name.charAt(0).toLowerCase() + m.def.name.slice(1) : m.def.name; }
// Called from hitMonster: the ward absorbs damage first. Returns the damage that gets through.
function wardAbsorb(m, dmg) {
  const a = Math.min(m.ward, dmg); m.ward -= a;
  if (m.ward <= 0) { m.ward = 0; fxSparks(m.x, m.y + m.hitH, m.z, 12, 4, 1.2, 2, 3, { size: .06 }); fxTimed(5, m.x, m.y + m.hitH, m.z, 2.2, 2.2, .6, 1.2, 2.4, .9, .25); sfx('clash', m.x, m.z, .9, .9); }
  else if (rnd() < .4) fxSparks(m.x, m.y + m.hitH, m.z, 3, 2.5, .8, 1.5, 2.6, { size: .05 });
  return dmg - a;
}
// cheap: a light patch for short hound trails (sparks and a glow, not one of FX.groundFire's limited flames).
function addFire(x, z, r, life, dps = 9, cheap = false) {
  G.fires.push({ x, z, r, t: life, max: life, dps, cheap });
  if (cheap) { const y = G.B.heightAt(x, z) + .08; fxTimed(2, x, y + .05, z, r * 3.2, r * 3.2, 1.3, .45, .08, .55, life, { ground: true }); for (let i = 0; i < 2; i++) fxTimed(1, x + frr(-.5, .5) * r, y, z + frr(-.5, .5) * r, r * frr(.8, 1.1), r * frr(1.0, 1.4), 2.0, 1.4, .9, .9, life * frr(.6, .9), { anchor: 1 }); }
  else if (typeof FX.groundFire === 'function') FX.groundFire(x, z, r, life);
  else fxTimed(4, x, G.B.heightAt(x, z) + .08, z, r * 2.6, r * 2.6, 1.6, .6, .15, .55, life, { ground: true });
}
// Called from killMonster for an elite, before it is removed.
function eliteDeath(m) {
  if (m.elite === 'burning' && !m.fly) { addFire(m.x, m.z, 1.1, 3.2); fxEmbers(m.x, m.y + .3, m.z, 14, .4); sfx('burn', m.x, m.z, .8); }
  if (m.elite === 'splitting' && !m.fly && G.mons.length < MAX_ALIVE) {
    for (const u of [-1, 1]) {
      const c = spawnMonster(m.type, { s: Math.max(.5, m.s - .1), lat: clamp(m.lat + u * .3, -.95, .95), hpMul: m.maxHp / m.def.hp / ELITE.splitting.hp * .42, pop: 1, radMul: .82 });
      c.scale *= .74; c.kl = u * 2.4; c.bmul = .4; c.small = true;
    }
    fxTimed(5, m.x, m.y + m.hitH, m.z, 2.4, 2.4, .8, 1.8, .6, .8, .25);
  }
}
function updateElites(dt) {
  const F = G.fires;
  for (let i = F.length - 1; i >= 0; i--) {
    const f = F[i]; f.t -= dt; if (f.t <= 0) { swapRemove(F, i); continue; }
    if (f.cheap) { if (frnd() < dt * 16 * f.r * sat(f.t / .4)) fxPart(f.x + frr(-.6, .6) * f.r, G.B.heightAt(f.x, f.z) + .08, f.z + frr(-.6, .6) * f.r, frr(-.15, .15), frr(.8, 1.8), frr(-.15, .15), frr(.25, .55), frr(.06, .1), 2.8, 1.0, .2, { drag: .5, rise: .4 }); }
    else if (rnd() < dt * 6 * f.r) { const a = rnd() * TAU, d = rnd() * f.r; fxPart(f.x + Math.cos(a) * d, G.B.heightAt(f.x, f.z) + .1, f.z + Math.sin(a) * d, rr(-.2, .2), rr(.6, 1.6), rr(-.2, .2), rr(.4, .9), rr(.05, .09), 2.6, 1.0, .2, { drag: .4, rise: .3 }); }
    const r2 = (f.r + .2) * (f.r + .2), dps = f.dps * G.dmgMul * sat(f.t / .5 + .2);
    for (const fm of G.men) { if (fm.dead || dist2(fm.x, fm.z, f.x, f.z) > r2) continue; fm.hp -= dps * dt; fm.flash = Math.max(fm.flash, .4); if (fm.hp <= 0) killFootman(fm, 0, 0); }
  }
  for (const m of G.mons) {
    if (!m.elite || m.dead) continue;
    if (m.vis && !G.seen['elite:' + m.elite]) UI.sawElite(m.elite);
    if (m.elite === 'burning' && m.vis && !m.fly && !m.dying) {
      if (rnd() < dt * 10) fxPart(m.x + rr(-.2, .2), m.y + rr(.2, m.hitH * 1.6), m.z + rr(-.2, .2), rr(-.2, .2), rr(.6, 1.4), rr(-.2, .2), rr(.3, .7), rr(.05, .08), 2.6, .9, .15, { drag: .4, rise: .4 });
      m.fireT -= dt;
      const moved = m.fx === undefined ? 1 : Math.hypot(m.x - m.fx, m.z - m.fz);
      if (m.fireT <= 0 && moved > .45) { m.fireT = .4; m.fx = m.x; m.fz = m.z; addFire(m.x, m.z, .55, 2.4); }
    }
  }
}

// The Drowned King's tidal wave (MON.leviathan.tide). The boss rears up and a wall of water runs down the road ahead
// of it, from just in front of it to `len` further on, over `dur` seconds. Footmen it reaches are shoved back towards
// the beacon, hurt and staggered (they let go of their foe); monsters it reaches ride it, faster for a few seconds.
// A Frost spell on the wave front breaks it (breakTide). G.tides holds the running waves.
G.tides = [];
const _tdp = { x: 0, y: 0, z: 0, tx: 0, tz: 0 };
function startTide(m) {
  const B = G.B, td = m.def.tide, s0 = m.s + m.rad + .3; if (s0 > B.L - 2) return null;
  const len = Math.min(td.len, B.L - .6 - s0); let men = 0;
  for (const f of G.men) if (!f.dead && f.onRoad && f.s > s0 - .4 && f.s < s0 + len) men++;
  const w = { m, s0, len, front: s0, t: 0, dur: td.dur, push: td.push, dmg: td.dmg, haste: td.haste, hasteT: td.hasteT, hit: new Set(), men, broken: false, acc: 0 };
  G.tides.push(w); m.cast = 1; G.stats.tides = (G.stats.tides || 0) + 1;
  const p = pathAt(B, s0, _tdp); shake(.7); lightFlash(p.x, p.y + 2, p.z, 0x7fe0e0, 900, .6, 22);
  fxDust(p.x, p.y + .1, p.z, 10, 1.4, { speed: 3.4, c: [.5, .62, .66] });
  sfx('roar', m.x, m.z, .9, .5); sfx('tidalWave', p.x, p.z, 1.1);
  if (typeof AI !== 'undefined') AI.think = Math.min(AI.think, .1); // the commander reacts to the roar
  return w;
}
function breakTide(w) {
  if (w.broken) return; w.broken = true; w.t = Math.max(w.t, w.dur);
  const B = G.B, p = pathAt(B, w.front, _tdp);
  for (let i = 0; i < 9; i++) { const lat = frr(-1, 1) * ROAD_HALF; fxSparks(p.x - p.tz * lat, p.y + frr(.3, 1.2), p.z + p.tx * lat, 3, 3, 1.2, 1.7, 2.2, { size: .06, grav: 6 }); }
  fxTimed(4, p.x, p.y + .08, p.z, 5, 5, .7, 1.2, 1.8, .8, .9, { ground: true });
}
function tideHitMan(f, w) {
  const p = pathAt(G.B, f.s, _tdp), side = f.lat >= 0 ? 1 : -1;
  f.kbx = p.tx * w.push - p.tz * side * .8; f.kbz = p.tz * w.push + p.tx * side * .8; f.stagger = 1.1; f.flash = 1; f.flinch = 1;
  if (f.target) { const m = f.target; m.men = Math.max(0, m.men - 1); if (m.foe === f) m.foe = null; f.target = null; }
  for (const o of G.mons) if (o.foe === f) o.foe = null;
  f.atk = -1; f.hp -= w.dmg * G.dmgMul * (f.armor || 1);
  fxSmoke(f.x, f.y + .3, f.z, p.tx * 2, frr(.8, 1.6), p.tz * 2, frr(.5, .8), .5, 1.1, .55, .72, .78, .5, { drag: 2.2 });
  if (f.hp <= 0) killFootman(f, p.tx, p.tz);
}
function updateTides(dt) {
  const B = G.B, T = G.tides;
  for (let i = T.length - 1; i >= 0; i--) {
    const w = T[i]; w.t += dt;
    const u = sat(w.t / w.dur), e = 1 - (1 - u) * (1 - u), front = w.front = w.s0 + w.len * e, back = w.s0 - .5;
    if (!w.broken && u < 1) {
      for (const f of G.men) { if (f.dead || f.gone || f.carry || f.fallV !== undefined || !f.onRoad || f.s < back || f.s > front || w.hit.has(f)) continue; w.hit.add(f); tideHitMan(f, w); }
      for (const m of G.mons) { if (m.dead || m.fly || m.def.boss || m.dying || m.hp <= 0 || m.frozen > 0 || m.s < back || m.s > front || w.hit.has(m)) continue; w.hit.add(m); m.tideT = w.hasteT; m.tideH = w.haste; m.ks += 1.4; }
    }
    if (!w.broken && u < 1) tideFX(w, B, dt);
    if (w.t >= w.dur + .3) swapRemove(T, i);
  }
}
// The wave's look (effects stream only): a dark green-blue wall of water across the road at the front, a pale
// crest that leans forward over it, a wet sheet of water behind it, and spray thrown ahead; it shrinks as it runs out.
const _tdq = { x: 0, y: 0, z: 0, tx: 0, tz: 0 };
function tideFX(w, B, dt) {
  const u = sat(w.t / w.dur), p = pathAt(B, w.front, _tdp), k = 1 - .55 * u, tx = p.tx, tz = p.tz, AL = FX.alpha, SG = FX.segs, T = SH.uTime.value;
  // Behind the front: the road under a sheet of churned water, fading back towards where the wave rose.
  for (let s = w.front - .7, n = 0; s > w.s0 - .3 && n < 9; s -= .9, n++) {
    const q = pathAt(B, s, _tdq), f = 1 - n / 9;
    AL.push(q.x, q.y + .06, q.z, ROAD_HALF * 2.6, ROAD_HALF * 2.6, n * 1.7 + T * .4, 0, .12, .32, .36, .6 * f * k, 0, n * 3.1, .35, 1);
  }
  // The wall: two rows of green-blue water, then the foam crest higher up and leaning forward, with glints.
  for (let j = -4; j <= 4; j++) {
    const lat = j / 4 * ROAD_HALF * 1.1, bob = Math.sin(T * 7 + j * 1.3) * .1, x = p.x - tz * lat, z = p.z + tx * lat, sd = j * 2.3 + w.s0;
    AL.push(x - tx * .3, p.y + .5 * k, z - tz * .3, 1.4 * k + .3, 1.4 * k + .3, sd, 0, .16, .42, .48, .92, 0, sd, .25, 0);
    AL.push(x - tx * .1, p.y + (1.2 + bob) * k, z - tz * .1, 1.2 * k + .25, 1.1 * k + .25, sd + 1, 0, .3, .62, .68, .9, 0, sd + 1, .3, 0);
    AL.push(x + tx * .25, p.y + (1.75 + bob) * k, z + tz * .25, .95 * k + .2, .7 * k + .15, sd + 2, 0, 1.5, 1.7, 1.75, .95, 0, sd + 2, .35, 0);
    FX.add.push(x + tx * .3, p.y + (1.85 + bob) * k, z + tz * .3, .9 * k + .3, .5 * k + .2, 0, 0, .35, .55, .6, .45 * k, 2, 0, 0, 0);
  }
  // A bright lip along the crest.
  for (let j = -4; j < 4; j++) {
    const l0 = j / 4 * ROAD_HALF * 1.1, l1 = (j + 1) / 4 * ROAD_HALF * 1.1, b0 = Math.sin(T * 7 + j * 1.3) * .1, b1 = Math.sin(T * 7 + (j + 1) * 1.3) * .1;
    SG.push(p.x - tz * l0 + tx * .35, p.y + (1.95 + b0) * k, p.z + tx * l0 + tz * .35, .08, p.x - tz * l1 + tx * .35, p.y + (1.95 + b1) * k, p.z + tx * l1 + tz * .35, .08, .6, .85, .95, .8 * k);
  }
  w.acc += dt * 60;
  while (w.acc >= 1) {
    w.acc -= 1; const lat = frr(-1.2, 1.2) * ROAD_HALF, x = p.x - tz * lat + tx * frr(0, .4), z = p.z + tx * lat + tz * frr(0, .4), v = frr(1.5, 3.5), h = frr(1.3, 2.1) * k;
    fxSmoke(x, p.y + h, z, tx * v, frr(.4, 1.4) * k, tz * v, frr(.35, .6), frr(.25, .45) * k + .12, 1.4, .62, .78, .84, .6, { drag: 3 });
    if (frnd() < .7) fxPart(x, p.y + .2 + h, z, tx * v * 1.6 + frr(-.7, .7), frr(2, 5) * k, tz * v * 1.6 + frr(-.7, .7), frr(.4, .8), frr(.035, .06), .8, 1.15, 1.3, { grav: 10, drag: .3, streak: 1 });
  }
  for (let j = -3; j <= 3; j++) { const lat = j / 3 * ROAD_HALF * 1.05; FX.add.push(p.x - tz * lat, p.y + .3 + .5 * k, p.z + tx * lat, 1.3, .9 * k, 0, 0, .2, .5, .6, .5 * k, 2, 0, 0, 0); }
}

const BOSS_ESCORT = 280;
function buildWave(k, level) {
  const q = [], boss = isBossK(k), horde = isHordeK(k, level), W = G.wavesPerLand;
  // Each land's step up in strength phases in over its waves: the first waves of a new land are gentler
  // (the board was just rebuilt), the last ones get the full step and a bit more.
  const lvF = .5 + .5 * (k - 1) / (W - 1), lv = 1 + .3 * level * lvF;
  // Budget ramps over the land; the boss wave carries less escort because the boss is the threat (more of it on later lands).
  let budget = (30 + 19 * (k - 1)) * lv * G.press * (boss ? .6 + .15 * Math.min(level, 6) : 1) * modMul('budget') * G.budgetMul, heavy = 0, air = budget * .42;
  const hpMul = (1 + .1 * (k - 1)) * (1 + .33 * level * lvF + .045 * level * level * lvF * lvF * lvF) * pressHp() * G.hpMul;
  // Later lands (and high pressure) also pack the monsters closer together.
  const gm = 1 / ((1 + .08 * level) * Math.pow(Math.max(1, G.press / 1.8), level ? .35 : 0));
  let t = .6;
  if (boss) q.push({ t: 2.2, type: bossType(), hpMul: (1 + .45 * level + .14 * level * level) * Math.pow(G.press, level >= 2 ? .55 : .4) * G.hpMul * G.bossHpMul });
  if (horde) {
    const bio = G.B.bio, menu = []; for (const ty in HORDE) { const mul = bio.mobs[ty] === undefined ? 1 : bio.mobs[ty], w0 = HORDE[ty][1] || (bio.mobs[ty] ? 1 : 0); if (mul > 0 && w0 > 0) menu.push([ty, w0 * Math.min(mul, 2)]); }
    // Later hordes run hotter: tougher bodies, more elites, and from the third land a few fast hunters mixed in.
    if (level >= 2) for (const ty of ['wolf', 'ghoul', 'hound']) { const mul = (bio.mobs[ty] === undefined ? 1 : bio.mobs[ty]) * (ty === 'hound' ? .5 : 1); if (mul > 0) menu.push([ty, .35 * Math.min(level - 1, 3) * mul]); }
    const tot = menu.reduce((a, b) => a + b[1], 0), hp = hpMul * (.72 + .04 * Math.min(level, 5)); let bodies = 0;
    budget *= 1.5 + .05 * level;
    while (budget > 0 && bodies < 260) {
      let r = rnd() * tot, type = 'rat'; for (const [ty, w] of menu) { r -= w; if (r <= 0) { type = ty; break; } }
      const n = Math.floor(rr(6, 13)), cost = HORDE[type] ? HORDE[type][0] : ROSTER[type][0];
      for (let i = 0; i < n && budget > 0; i++) { q.push({ t, type, hpMul: hp, horde: true, elite: pickElite(type, k, level, .4 + .08 * level) }); t += rr(.08, .2) * gm; budget -= cost; bodies++; }
      t += rr(.5, 1.1) * gm;
    }
    return q;
  }
  const menu = waveMenu(k, level), tot = menu.reduce((a, b) => a + b[1], 0), budget0 = budget;
  // From the fifth land on, a boss wave's escort would grow past BOSS_ESCORT bodies (and over five minutes long):
  // it stops there (the same crowd per second, just not for as long). The bodies left out add their bounty to those
  // that come, so the land pays the same gold.
  while (budget > 0 && !(boss && q.length >= BOSS_ESCORT)) {
    let r = rnd() * tot, type = 'skel'; for (const [ty, w] of menu) { r -= w; if (r <= 0) { type = ty; break; } }
    let R = ROSTER[type];
    if (R[0] > budget + 5 || (R[0] >= 30 && heavy >= 1 + (level >> 1)) || (MON[type].fly && air <= 0)) { type = 'skel'; R = ROSTER.skel; }
    if (R[0] >= 30) heavy++;
    const n = Math.floor(rr(R[1], R[2] + .999)), gap = R[3], el = pickElite(type, k, level);
    for (let i = 0; i < n && budget > 0; i++) { q.push({ t, type, hpMul, elite: el && (i === 0 || rnd() < .35) ? el : undefined }); t += gap * rr(.8, 1.25) * gm; budget -= R[0]; if (MON[type].fly) air -= R[0]; }
    t += rr(1.1, 2.3) * (boss ? 1.5 : 1) * gm;
  }
  if (boss && budget > 0) { const f = Math.min(2.5, budget0 / Math.max(1, budget0 - budget)); for (const e of q) if (!MON[e.type].boss) e.bm = f; }
  q.sort((a, b) => a.t - b.t);
  return q;
}
// Pressure's share of monster health. Above the old 2.2 ceiling it counts double, so strong play meets a real fight.
function pressHp() { const p = G.press; return .85 + .15 * Math.min(p, 2.2) + .3 * Math.max(0, p - 2.2); }
// The ceiling for pressure rises with each land; the first land keeps the old, friendly cap. Heat lifts it further
// (0.1 per tier), so a strong keeper at high Heat keeps meeting a real fight (G.heat is 0 outside a run).
function pressCap() { return 2.2 + .3 * G.level + .1 * G.heat; }
function startWave() {
  const W = G.wavesPerLand;
  G.k = G.k % W + 1; dailyReseed(G.level, G.k); G.queue = buildWave(G.k, G.level); if (waveNumber() > G.best && (inRun() || TEST_SESSION)) { G.best = waveNumber(); if (!TEST_SESSION) try { localStorage.setItem('lanternhold.best', '' + G.best); } catch (e) {} } G.waveT = 0; G.spawning = true; G.bossWave = isBossK(G.k); G.horde = isHordeK(G.k, G.level); G.waveKills = 0; G.waveLeaks = 0; G.bossDown = false; G.trickle = 6; G.trickleN = 0;
  const cv = G.B.cave, wl = 'Laine ' + G.k + '/' + W;
  sfx(G.bossWave ? 'hornBoss' : 'horn', cv.x, cv.z, 1.1);
  if (G.horde) { sfx('horde', cv.x, cv.z, 1.1); UI.banner(wl + ' · Hord tuleb!', 3.4, true); }
  else UI.banner(G.bossWave ? wl + ' · ' + MON[bossType()].name : wl, G.bossWave ? 3.6 : 2.2, G.bossWave);
  G.restored = false; autosave(G.k, false);
}
function endWave() {
  const l = G.waveLeaks;
  if (l === 0) G.press *= 1.12; else if (l >= 6) G.press *= .8; else if (l >= 3) G.press *= .9;
  if (G.lives <= 6) G.press *= .9;
  G.press = clamp(G.press, .6, pressCap());
  G.gold += (22 + 7 * G.k + 8 * G.level) * G.goldMul + G.waveGold;
  if (G.horde && l === 0) achUnlock('horde');
  G.horde = false;
}
function updateWaves(dt) {
  if (G.phase !== 'play') return;
  const B = G.B;
  updateElites(dt); updateTides(dt); updateSpells(dt); trackRun();
  if (G.spawning) {
    G.waveT += dt;
    while (G.queue.length && G.queue[0].t <= G.waveT) {
      if (G.mons.length >= MAX_ALIVE) break;
      const e = G.queue.shift(), m = spawnMonster(e.type, { hpMul: e.hpMul }), c = MON[e.type].cat || (MON[e.type].hp >= 200 ? 'big' : '');
      if (c) G.mix[c] = (G.mix[c] || 0) + 1;
      G.mix[e.type] = (G.mix[e.type] || 0) + 1;
      if (e.horde) m.bmul = .6;
      if (e.bm) m.bmul = (m.bmul || 1) * e.bm;
      if (e.elite) makeElite(m, e.elite);
      if (G.spdMul !== 1) m.spdMul *= G.spdMul;
    }
    if (!G.queue.length) {
      G.bossAlive = G.mons.some(m => m.def.boss && !m.dead);
      if (G.bossWave && G.bossAlive) {
        G.trickle -= dt;
        if (G.trickle <= 0 && G.trickleN < 9 + Math.min(12, 3 * G.level)) { G.trickleN++; G.trickle = rr(3.2, 4.6) / (1 + .06 * G.level); const tm = waveMenu(G.wavesPerLand, G.level).filter(e => ROSTER[e[0]][0] < 13), ty = tm[Math.floor(rnd() * tm.length)][0], n = Math.max(1, Math.min(5 + G.level, Math.round((8 + 2 * G.level) / ROSTER[ty][0]))), hpMul = (1 + .5) * (1 + .3 * G.level) * pressHp() / 1.18 * G.hpMul; for (let i = 0; i < n; i++) G.queue.push({ t: G.waveT + i * .4, type: ty, hpMul, elite: G.level >= 2 && i === 0 ? pickElite(ty, G.wavesPerLand, G.level) : undefined }); }
      } else { G.spawning = false; endWave(); G.nextIn = G.bossWave ? -1 : 6.5; G.clearT = 0; }
    }
  } else if (G.bossWave) {
    G.clearT += dt;
    if (!G.mons.some(m => !m.dead) || G.clearT > 40) { setPhase('clear'); }
  } else {
    updateCount(dt);
    if (!(G.count > 0)) G.nextIn -= dt; // the countdown holds the land's first wave
    if (G.nextIn <= 0) startWave();
  }
  if (G.lives <= 0 && G.phase === 'play') setPhase('defeat');
}
// Round 12: a countdown before each land's first wave: 6, 5, 4, 3, 2, 1, then 0 ("Alusta!", the wave comes), one a second.
// G.count is the number on screen (null when there is none); G.countT the seconds counted (-1: no countdown). It waits
// while a story beat or a card is up, and runs in real seconds whatever the game speed. A tap on it, Space or Enter skip
// it (countSkip). Not in the demo, under the tutorial (which holds the wave itself) or in test sessions (QA stays as it was).
// Sounds (Echo): sfx('countTick', 0, 0, 1) on 6 to 1, sfx('countGo') on 0. Drawn by MENU (73-menu.js, drawCount).
const COUNT_FROM = 6;
function countStart() {
  G.count = null; G.countT = -1;
  if (inRun() && !TEST_SESSION && !(typeof TUT !== 'undefined' && TUT.active())) G.countT = 0;
}
function updateCount(dt) {
  if (!(G.countT >= 0)) { G.count = null; return; }
  if (G.phaseT < .3 || STORY.on() || STORY.queue.length || UI.scr) return;
  G.countT += (R.frameDt || dt) / Math.max(1, G.speed);
  if (G.countT >= COUNT_FROM + .9) { G.countT = -1; G.count = null; return; }
  const n = Math.max(0, COUNT_FROM - Math.floor(G.countT));
  if (n !== G.count) { G.count = n; if (n > 0) sfx('countTick', 0, 0, 1); else { sfx('countGo', CAM.x, CAM.z, 1); G.nextIn = Math.min(G.nextIn, .05); } }
}
function countSkip() {
  if (!(G.count > 0) && !(G.countT >= 0 && G.count === null)) return false;
  G.countT = COUNT_FROM; G.count = 0; sfx('countGo', CAM.x, CAM.z, 1); G.nextIn = Math.min(G.nextIn, .05);
  return true;
}
// After a restore the first wave pays no early-call gold (reloading must not become a gold tap).
function callWaveEarly() { if (G.count > 0 || (G.countT >= 0 && G.count === null)) return countSkip(); if (G.phase === 'play' && !G.spawning && !G.bossWave && G.nextIn > .4) { if (!G.restored) G.gold += Math.round(G.nextIn * 3); G.nextIn = .05; return true; } return false; }

// Every purchase goes through pay() and every refund through refund(), so the run summary can count the gold earned.
function pay(c) { G.gold -= c; UI.goldShown = Math.min(UI.goldShown, G.gold); if (G.runStats) G.runStats.last -= c; }
function refund(c) { G.gold += c; if (G.runStats) G.runStats.last += c; }
function padCoverage(pad, range, air) {
  const B = G.B; let c = 0; const r2 = range * range;
  for (let i = 0; i < B.n; i += 2) if (dist2(pad.x, pad.z, B.px[i], B.pz[i]) < r2) c += PATH_STEP * 2;
  return c;
}
function buildTower(pad, kind, byPlayer) {
  // Founding Stone (66-meta.js): the first towers of a land cost nothing (and sell for nothing).
  const def = TOWER[kind], free = G.freeTowers > 0; if (pad.tower || (!free && G.gold < def.cost[0]) || G.phase !== 'play') return null;
  if (free) G.freeTowers--; else pay(def.cost[0]);
  const t = new Tower(pad, kind, G.B.pads.indexOf(pad)); if (free) t.spent = 0; G.towers.push(t); UI.ping(pad.x, pad.y, pad.z, byPlayer); return t;
}
function upgradeTower(t, byPlayer) {
  if (!t || t.lvl >= 2 || t.state !== 'active' || G.phase !== 'play') return false; const c = t.def.cost[t.lvl + 1]; if (G.gold < c) return false;
  pay(c); t.upgrade(); UI.ping(t.x, t.y, t.z, byPlayer); return true;
}
// Branches: a max-level tower (lvl 2) picks one of two specialisations (TOWER[kind].branches) and becomes lvl 3.
function branchCost(t, key) { const b = t && t.def.branches && t.def.branches[key]; return b ? Math.round(b.cost * (1 + .12 * G.level) * G.branchMul / 5) * 5 : 0; }
function canBranch(t) { return !!(t && t.alive && t.lvl === 2 && !t.branch && t.state === 'active' && t.def.branches); }
function branchTower(t, key, byPlayer) {
  const c = branchCost(t, key); if (!c || !canBranch(t) || G.phase !== 'play' || G.gold < c) return false;
  pay(c); if (!t.specialize(key, c)) { refund(c); return false; }
  G.stats.branches++; G.stats[key] = (G.stats[key] || 0) + 1;
  UI.ping(t.x, t.y, t.z, byPlayer); fxEmbers(t.x, t.y + 1.5, t.z, 24, .7); fxTimed(5, t.x, t.y + 2, t.z, 5, 5, 1.6, 1.2, .6, .9, .4); sfx('branch', t.x, t.z, 1); sfx('buyout', t.x, t.z, .8);
  return true;
}
// Overcharge: a tower with a branch can be pushed further, up to OC_MAX times. Each stack adds OC_DMG damage (applied in hitMonster).
const OC_MAX = 3, OC_DMG = .25;
function overchargeCost(t) { return t && t.lvl >= 3 && (t.oc || 0) < OC_MAX ? Math.round(t.def.cost[2] * [1, 1.4, 1.9][t.oc || 0] * (1 + .15 * G.level) * G.ocMul / 5) * 5 : 0; }
function overchargeTower(t, byPlayer) {
  const c = overchargeCost(t); if (!c || !t.alive || t.state !== 'active' || G.phase !== 'play' || G.gold < c) return false;
  pay(c); t.oc = (t.oc || 0) + 1; t.spent += c; t.em.I = t.def.light[t.lvl] * (1 + .3 * t.oc);
  UI.ping(t.x, t.y, t.z, byPlayer); fxTimed(5, t.x, t.y + 2, t.z, 4, 4, 1.4, 1.0, .5, .9, .35); fxEmbers(t.x, t.y + 1.5, t.z, 18, .6); sfx('buyout', t.x, t.z, 1);
  return true;
}
// Mending the beacon buys back lives, a few at a time, up to the beacon's maximum.
const MEND_N = 4;
function mendCount() { return Math.max(0, Math.min(MEND_N, G.maxLives - G.lives)); }
function mendCost() { return Math.round(mendCount() * (20 + 8 * G.level) * G.mendMul); }
function mendBeacon(byPlayer) {
  const n = mendCount(), c = mendCost(); if (!n || G.phase !== 'play' || G.lives <= 0 || G.gold < c) return false;
  pay(c); G.lives += n;
  const b = G.B.beacon; fxEmbers(b.x, b.y, b.z, 40, .6); lightFlash(b.x, b.y + 1, b.z, 0xffa050, 900, .4, 30); sfx('ignite', b.x, b.z, 1, .5); UI.ping(b.x, b.y - .5, b.z, byPlayer);
  return true;
}
function sellTower(t) {
  if (!t || !t.alive || G.phase !== 'play') return false; const back = Math.round(t.spent * .6);
  refund(back); t.sell(); const i = G.towers.indexOf(t); if (i >= 0) G.towers.splice(i, 1); return true;
}

// Spells. Mana (G.mana up to G.manaMax) fills from kills and slowly while a wave runs; each spell also has a cooldown.
// castSpell(kind, x, z) is the one entry point (UI, keys and the AI commander all use it).
const SPELL = {
  meteor: { name: 'Meteoor', key: 'Q', mana: 60, cd: 26, r: 3.2, icon: 'meteor', desc: 'Põlev kivi: suur pauk ja siis tuli.' },
  frost: { name: 'Jää', key: 'E', mana: 40, cd: 22, r: 3.6, icon: 'frost', desc: 'Külmutab kõik koletised ringis.' },
  rally: { name: 'Abivägi', key: 'T', mana: 35, cd: 20, r: 1.4, icon: 'rally', desc: 'Neli maakaitsjat hoiavad teed mõnda aega kinni.' },
};
const SPELL_KINDS = ['meteor', 'frost', 'rally'];
const METEOR_FALL = .8, RALLY_TIME = 20;
Object.assign(G, { mana: 30, manaMax: 100, spellCd: { meteor: 0, frost: 0, rally: 0 }, spellOk: {}, pending: [], rallies: [], mix: {}, menLost: 0, stats: { branches: 0, spells: 0 } });
function manaFromKill(m) {
  if (G.phase !== 'play') return;
  G.mana = Math.min(G.manaMax, G.mana + (.45 + m.def.bounty * .035) * (m.elite ? 2.5 : 1) * (m.small ? .5 : 1) * (m.def.boss ? 4 : 1));
}
// Mana and cooldown through the run's numbers (Heat 10 raises mana costs; Swift Rites shortens cooldowns).
function spellMana(kind) { return Math.round(SPELL[kind].mana * G.spellManaMul); }
function spellReady(kind) { const S = SPELL[kind]; return !!S && G.phase === 'play' && G.mana >= spellMana(kind) && G.spellCd[kind] <= 0; }
// Where a spell lands on the road: the nearest road sample to (x, z).
function roadNear(x, z) { const B = G.B; let bi = 0, bd = 1e9; for (let i = 0; i < B.n; i++) { const d = dist2(x, z, B.px[i], B.pz[i]); if (d < bd) { bd = d; bi = i; } } return { s: bi * PATH_STEP, d: Math.sqrt(bd) }; }
function castSpell(kind, x, z, byPlayer) {
  if (!spellReady(kind) || !isFinite(x) || !isFinite(z)) return false;
  const S = SPELL[kind], B = G.B, L = G.level, y = B.heightAt(x, z);
  if (kind === 'rally') { const q = roadNear(x, z); if (q.d > 4.5) return false; }
  G.mana -= spellMana(kind); G.spellCd[kind] = S.cd * G.cdMul; G.stats.spells++; G.stats[kind] = (G.stats[kind] || 0) + 1;
  if (kind === 'meteor') {
    if (typeof FX.meteor === 'function') FX.meteor(x, z, S.r, METEOR_FALL);
    else { fxTimed(4, x, y + .1, z, S.r * 2, S.r * 2, 1.8, .7, .2, .5, METEOR_FALL, { ground: true }); fxTimed(4, x, y + .1, z, S.r * .8, S.r * .8, 2.4, 1.1, .3, .6, METEOR_FALL, { ground: true }); }
    G.pending.push({ kind: 'meteor', t: METEOR_FALL, x, z });
    sfx('meteor', x, z, 1.2);
  } else if (kind === 'frost') {
    if (typeof FX.frostNova === 'function') FX.frostNova(x, z, S.r, 2.6);
    else { fxTimed(4, x, y + .1, z, S.r * 2.2, S.r * 2.2, .8, 1.4, 2.2, .8, .9, { ground: true }); fxTimed(5, x, y + 1, z, S.r * 2, S.r * 2, .8, 1.3, 2, .9, .3); fxSparks(x, y + .4, z, 40, 6, 1.4, 2, 2.6, { size: .07, grav: 2 }); }
    if (typeof FX.frostNova !== 'function') lightFlash(x, y + 1.5, z, 0x9fd8ff, 900, .5, 22);
    const dmg = 18 * (1 + .3 * L) * G.spellPow;
    for (const m of G.mons) {
      if (m.dead || m.hp <= 0 || !m.vis || m.dying) continue; if (dist2(m.x, m.z, x, z) > (S.r + m.rad) * (S.r + m.rad)) continue;
      freezeMonster(m, 2.6); m.tideT = 0; hitMonster(m, dmg, 'bolt', 0, 0, null);
    }
    for (const w of G.tides) if (!w.broken) { const p = pathAt(B, w.front, _tdp); if (dist2(p.x, p.z, x, z) < (S.r + 1.6) * (S.r + 1.6)) { breakTide(w); G.stats.tideBreaks = (G.stats.tideBreaks || 0) + 1; } }
    sfx('frostNova', x, z, 1.1);
  } else {
    const q = roadNear(x, z), s = clamp(q.s, B.cave.s + 2, B.L - 1.2), p = pathAt(B, s, {});
    const def = { rally: true, n: [4], hp: [180 * (1 + .3 * L) * G.spellPow], dmg: [16 * (1 + .35 * L) * G.spellPow], range: [3] };
    const t = { kind: 'rally', def, lvl: 0, alive: true, pad: { s }, men: [], mounts: { door: [0, 0, 0] }, x: p.x, y: p.y, z: p.z, yaw: Math.atan2(-p.tx, -p.tz), oc: 0, recent: 0, dealt: 0, kills: 0, t: RALLY_TIME,
      w(l, out) { out.x = this.x + rr(-.3, .3); out.y = this.y; out.z = this.z + rr(-.3, .3); return out; } };
    for (let i = 0; i < 4; i++) { const f = spawnFootman(t); f.state = 'ready'; }
    G.rallies.push(t);
    fxTimed(4, p.x, p.y + .1, p.z, 4.5, 4.5, 2, 1.5, .6, .7, .7, { ground: true }); fxTimed(5, p.x, p.y + 1, p.z, 3.4, 3.4, 2, 1.6, .7, .9, .3); fxDust(p.x, p.y + .1, p.z, 12, 1.4, { speed: 2.6 }); fxEmbers(p.x, p.y + .5, p.z, 16, .6);
    lightFlash(p.x, p.y + 1.5, p.z, 0xffc070, 700, .4, 18);
    sfx('rally', p.x, p.z, 1.1);
  }
  if (byPlayer) UI.ping(x, y, z, true);
  return true;
}
function meteorImpact(x, z) {
  const B = G.B, L = G.level, y = B.heightAt(x, z), r = SPELL.meteor.r, dmg = 280 * (1 + .35 * L + .03 * L * L) * G.spellPow;
  if (typeof FX.meteor !== 'function') { fxExplosion(x, y, z, 1.9); FX.decals.add(B.heightAt, x, z, r * 1.1, .02, .015, .012, .95, 60); for (let i = 0; i < 10; i++) { _tm.compose(_tv.set(x + rr(-.5, .5), y + .3, z + rr(-.5, .5)), _tq.set(rr(-1, 1), rr(-1, 1), rr(-1, 1), 1).normalize(), _ts.set(.9, .9, .9)); addDebris(KIT.rubble, _tm, [.45, .35, .3], rr(-5, 5), rr(4, 9), rr(-5, 5), rr(4, 10), rr(2, 3.4)); } }
  if (typeof FX.meteor !== 'function') { lightFlash(x, y + 2, z, 0xff9040, 2200, .6, 34); shake(1); hitStop(.05, .5); }
  for (const m of G.mons) {
    if (m.dead || m.hp <= 0 || !m.vis || m.dying) continue; const d = Math.hypot(m.x - x, m.z - z); if (d > r + m.rad) continue;
    const k = lerp(1, .5, sat(d / r)) * (m.fly || m.def.boss ? .5 : 1), l = d || 1;
    if (!m.def.boss && !m.fly) slowMonster(m, .9, .7);
    hitMonster(m, dmg * k, 'blast', (m.x - x) / l, (m.z - z) / l, null);
  }
  addGroundFire(x, z, r * .65, 6, 22 * (1 + .3 * L), null);
}
function updateSpells(dt) {
  if (G.spawning) G.mana = Math.min(G.manaMax, G.mana + dt * .35);
  for (const k of SPELL_KINDS) {
    G.spellCd[k] = Math.max(0, G.spellCd[k] - dt);
    const ok = spellReady(k); if (ok && !G.spellOk[k] && UI.playerActive()) sfx('spellReady', CAM.x, CAM.z, .7); G.spellOk[k] = ok;
  }
  for (let i = G.pending.length - 1; i >= 0; i--) { const p = G.pending[i]; p.t -= dt; if (p.t <= 0) { swapRemove(G.pending, i); if (p.kind === 'meteor') meteorImpact(p.x, p.z); } }
  for (let i = G.rallies.length - 1; i >= 0; i--) {
    const t = G.rallies[i]; t.t -= dt;
    if (t.t <= 0 && t.alive) { t.alive = false; for (const f of t.men) if (!f.dead) fxDust(f.x, f.y + .3, f.z, 5, .7); }
    for (let j = t.men.length - 1; j >= 0; j--) if (t.men[j].gone) t.men.splice(j, 1);
    if (!t.alive && !t.men.length) swapRemove(G.rallies, i);
  }
}
// The commander's spells: a meteor into the densest pack (or onto a boss), frost when the leaders near the beacon,
// rally when footmen are falling or something has broken through. Frost and rally keep mana back for the meteor unless urgent.
const AIS = { lost: 0, lostT: -99, lostN: 0 };
function aiSpells() {
  const B = G.B, M = G.mons;
  if (G.menLost !== AIS.lost) { AIS.lostN = (G.t - AIS.lostT < 8 ? AIS.lostN : 0) + Math.max(0, G.menLost - AIS.lost); AIS.lostT = G.t; AIS.lost = G.menLost; }
  let lead = null, front = 0, fx = 0, fz = 0, fw = 0, boss = null;
  for (const m of M) {
    if (m.dead || m.hp <= 0 || !m.vis || m.dying) continue;
    if (m.def.boss) boss = m;
    if (!lead || m.prog > lead.prog) lead = m;
    if (m.prog > .76) { front++; const w = m.prog * m.prog * (m.def.boss ? 4 : 1); fx += m.x * w; fz += m.z * w; fw += w; }
  }
  if (!lead) return false;
  // Armoured flyers on the way: keep enough mana back to freeze them before they reach the beacon.
  let gq = 0; for (const m of M) if (m.fly && m.def.armor && !m.dead && m.hp > 0) gq++;
  const airHold = gq >= 1 && G.mana < spellMana('meteor') + spellMana('frost') && G.spellCd.frost < 8;
  if (spellReady('meteor') && !airHold) {
    let best = null, bs = 0, n = 0;
    for (const m of M) {
      if (m.dead || m.fly || !m.vis || m.hp <= 0 || m.dying) continue; if (++n > 90 && (n & 1)) continue;
      // The Drowned King is worth a meteor sooner: its summons crowd round it and every wave it sweeps costs footmen.
      let sc = m.def.boss ? 6 + 8 * m.prog + (m.def.tide || m.def.snuff ? 4 : 0) : 0; // the Herald too: every second it lives, towers go dark
      for (const o of M) if (!o.dead && !o.fly && o.vis && !o.def.boss && dist2(o.x, o.z, m.x, m.z) < 8) sc += (o.elite ? 1.8 : 1) * (.6 + Math.min(1.4, o.maxHp / 250)) * (.7 + .6 * o.prog) + (o.def.wardCast ? 2.5 : 0);
      if (sc > bs) { bs = sc; best = m; }
    }
    if (best && bs >= (G.horde ? 14 : 10)) { const q = aimPoint(best, METEOR_FALL, {}); if (castSpell('meteor', q.x, q.z)) return true; }
  }
  const save = G.spellCd.meteor < 6 && G.mana < spellMana('meteor') + 25;
  // A tidal wave on its way to footmen (or carrying a pack): freeze its front to break it.
  if (spellReady('frost') && G.tides.length) {
    for (const w of G.tides) {
      if (w.broken || w.t > w.dur * .75) continue;
      let riders = 0; for (const m of M) if (m.tideT > 0 && !m.dead && !m.fly) riders++;
      if (w.men < 1 && riders < 3) continue;
      const p = pathAt(B, Math.min(B.L - .5, w.front + 1.4), {}); if (castSpell('frost', p.x, p.z)) return true;
    }
  }
  // A flyer pack closing on the beacon (gargoyles above all: arrows barely scratch them): freeze it in the air.
  if (spellReady('frost')) {
    let n = 0, w = 0, ax = 0, az = 0, hv = 0, last = null;
    for (const m of M) if (m.fly && !m.dead && m.hp > 0 && m.vis && !m.dying && m.prog > .62 && !(m.frozen > 0)) { const k = m.def.armor ? 2 : m.def.swoop ? 1.3 : .6; n++; hv += k; w += k * m.prog; ax += m.x * k * m.prog; az += m.z * k * m.prog; if (!last || m.prog > last.prog) last = m; }
    if (n >= 2 && hv >= 2.6) { const cx = ax / w, cz = az / w; let hit = 0; for (const m of M) if (m.fly && !m.dead && m.prog > .62 && dist2(m.x, m.z, cx, cz) < 9) hit += m.def.armor ? 2 : 1; if (hit >= 2 && castSpell('frost', cx, cz)) return true; }
    // A lone gargoyle or harpy about to reach the beacon: the frost's own bite may finish it, or the freeze buys a volley.
    if (last && last.prog > .86 && (last.def.armor || last.def.swoop || last.hp < 18 * (1 + .3 * G.level) * G.spellPow)) { const q = aimPoint(last, .2, {}); if (castSpell('frost', q.x, q.z)) return true; }
  }
  if (spellReady('frost') && fw > 0 && (front >= 5 || (boss && boss.prog > .72) || (front >= 2 && lead.prog > .9)) && (!save || lead.prog > .86)) {
    if (castSpell('frost', fx / fw, fz / fw)) return true;
  }
  if (spellReady('rally') && !G.rallies.length) {
    const urgent = lead.prog > .84 && !lead.fly, falling = AIS.lostN >= 2 && G.t - AIS.lostT < 6;
    if ((urgent || falling) && (!save || urgent)) {
      let tgt = lead; if (falling && !urgent) { let bp = 0; for (const m of M) if (!m.dead && !m.fly && m.vis && m.prog > bp && m.prog < .95) { bp = m.prog; tgt = m; } }
      if (!tgt.fly) { const p = pathAt(B, Math.min(B.L - 1.2, tgt.s + 2.4), {}); if (castSpell('rally', p.x, p.z)) { AIS.lostN = 0; return true; } }
    }
  }
  return false;
}

const AI = { think: .15, wait: 0, last: '' };
function aiThink(dt) {
  if (G.phase !== 'play' || UI.playerActive()) return;
  AI.think -= dt; if (AI.think > 0) return; AI.think = .5;
  aiSpells(); aiReroll();
  const B = G.B, towers = G.towers.filter(t => t.alive), empty = B.pads.filter(p => !p.tower), N = towers.length;
  const cnt = { archer: 0, bombard: 0, spire: 0, guard: 0 }; for (const t of towers) cnt[t.kind]++;
  const ideal = { archer: .36, bombard: .22, spire: .2, guard: .22 };
  const lt = G.leakTypes; let air = 0, armor = 0, swarm = 0, siege = 0; for (const ty in lt) { const c = MON[ty].cat; if (c === 'air') air += lt[ty]; else if (c === 'armor') armor += lt[ty]; else if (c === 'swarm') swarm += lt[ty]; else if (c === 'siege') siege += lt[ty]; }
  // Footmen snatched by harpies count as air leaks: more archers and spires. Rams want blasts and fire (bombards).
  air += (G.snatched || 0) * .4; siege += (G.mix.ram || 0) * .15;
  // Mutators: armoured monsters want bombards and spires, swarms want splash and guards, fast ones want the slow of spires.
  if (modOn('ironhide')) armor += 3; if (modOn('swarm') || modOn('bloodmoon')) swarm += 3; if (modOn('haste')) { armor += 1; swarm += 1.5; }
  // Siege sends rams every wave (blasts and fire); Echoes brings killed elites back, so more of everything that kills crowds.
  if (modOn('siege')) siege += 4; if (modOn('echoes')) { const e = Math.min(4, (G.mix.echo || 0) * .15); swarm += 1 + e; armor += 1 + e * .5; } // more so as the ghosts pile up
  // Anti-air: scout what flies this land (sent so far, the next wave's roster and what is in the air now) and weigh it
  // against the board's air power. Gargoyles shrug off arrows, so a shortfall against them asks for spires first.
  const AA = aiAir(towers);
  // A Herald land: its ghosts want crowd-killers, and its lantern snuffs towers in a circle, so spread the board out.
  const herald = heraldLand() && G.bossWave, snR2 = herald ? MON.herald.snuff.r * MON.herald.snuff.r : 0; if (herald) swarm += 1.5;
  const gatePress = sat(G.leaks / 8);
  const opts = [];
  for (const kind of TOWER_KINDS) {
    const def = TOWER[kind];
    let need = ideal[kind] * (N + 1.6) - cnt[kind] + .35;
    if (kind === 'archer') need += air * .2 + (N === 0 ? 1 : 0) + AA.short * (1 - AA.hard) * .25; if (kind === 'spire') need += air * .12 + armor * .1 + AA.short * AA.hard * .45; if (kind === 'bombard') need += armor * .08 + swarm * .06 + siege * .12 + (N >= 2 && cnt.bombard === 0 ? .5 : 0); if (kind === 'guard') need += swarm * .04 + (N >= 1 && cnt.guard === 0 ? .9 : 0);
    if (need <= 0) continue;
    for (const pad of empty) {
      const cov = padCoverage(pad, def.range[0]) / (def.range[0] * 2);
      let sc = need * (.55 + cov * .5);
      const rel = pad.s / B.L;
      if (N < 2) sc *= 1 - Math.abs(rel - .42) * .9;
      sc *= 1 + gatePress * (rel - .5) * .8;
      let syn = 0;
      for (const t of towers) { const d = Math.hypot(t.x - pad.x, t.z - pad.z); if (kind === 'guard' && t.kind !== 'guard' && d < t.range + 1.5) syn += .16; if (kind !== 'guard' && t.kind === 'guard' && d < def.range[0] + 1) syn += .2; if (t.kind === kind && d < 6) syn -= .12; if (d * d < snR2) syn -= .04; }
      if (kind === 'guard') { sc *= .8 + .5 * rel; for (const t of towers) if (t.kind === 'guard' && Math.abs(t.pad.s - pad.s) < 9) syn -= .5; }
      sc *= 1 + syn;
      opts.push({ sc, cost: G.freeTowers > 0 ? 0 : def.cost[0], act: 'build', kind, pad }); // Founding Stone: the first towers are free
    }
  }
  for (const t of towers) {
    if (t.state !== 'active' || t.lvl >= 2) continue;
    const c = t.def.cost[t.lvl + 1], use = sat(t.recent / 60);
    let sc = (.5 + use * .9 + (t.lvl === 0 ? .12 : 0)) * (N >= 4 ? 1.25 : .7) * (empty.length === 0 ? 1.6 : 1) * (110 / c);
    if (t.kind === 'archer') sc *= 1 + air * .06 + AA.short * (1 - AA.hard) * .2; if (t.kind === 'spire') sc *= 1 + armor * .05 + AA.short * AA.hard * .3; if (t.kind === 'bombard') sc *= 1 + siege * .05;
    opts.push({ sc, cost: c, act: 'up', t });
  }
  // Branch maxed towers (the choice follows what this land throws at us), then overcharge them; busy towers first.
  for (const t of towers) {
    if (!canBranch(t)) continue;
    const key = aiBranch(t, towers, air, armor, swarm), c = branchCost(t, key), use = sat(t.recent / 60);
    opts.push({ sc: (.45 + use * .9) * (empty.length === 0 ? 1.45 : .6) * (110 / c) * 1.6, cost: c, act: 'branch', t, key });
  }
  for (const t of towers) {
    const c = overchargeCost(t); if (!c || t.state !== 'active') continue;
    const use = sat(t.recent / 60);
    opts.push({ sc: (.35 + use * .9) * (empty.length === 0 ? 1.3 : .55) * (110 / c) / (1 + .25 * t.oc), cost: c, act: 'oc', t });
  }
  // Mend the beacon when it has taken real damage; more urgent the lower it burns.
  { const n = mendCount(), c = mendCost(); if (n >= 3 || (n > 0 && G.lives <= 8)) opts.push({ sc: (1 - G.lives / G.maxLives) * 3.2 * (110 / Math.max(40, c)) * (G.lives <= 8 ? 1.8 : 1), cost: c, act: 'mend' }); }
  if (!opts.length) return;
  opts.sort((a, b) => b.sc - a.sc);
  // The first wave after the page opens: the commander keeps some gold back, so a newcomer who takes over has money to build with.
  const purse = G.gold - (G.mode === 'demo' && G.run === 1 && G.level === 0 && G.k <= 1 && !UI.everManual ? 150 : 0);
  let pick = opts[0];
  if (pick.cost > purse) {
    AI.wait += .5;
    const aff = opts.find(o => o.cost <= purse && o.sc > pick.sc * (AI.wait > 9 ? .45 : .8));
    if (!aff) return; pick = aff;
  }
  AI.wait = 0;
  if (pick.act === 'build') buildTower(pick.pad, pick.kind, false); else if (pick.act === 'up') upgradeTower(pick.t, false); else if (pick.act === 'oc') overchargeTower(pick.t, false); else if (pick.act === 'branch') branchTower(pick.t, pick.key, false); else if (pick.act === 'mend') mendBeacon(false);
  AI.think = N < 3 ? .12 : .8;
}

// The commander's air picture. want: how much air power this land calls for (flyers in the roster for the next
// wave, flyers sent so far, flyers alive now, heavier for armoured gargoyles and deeper lands); have: the board's air
// power (archers and spires by level, volley and tempest count extra, archers count half against armour);
// short: the shortfall, in tower levels; hard: the armoured share of the threat (0..1), which wants spires.
function aiAir(towers) {
  const nk = G.spawning ? G.k : G.k % G.wavesPerLand + 1, menu = waveMenu(nk, G.level), mx = G.mix;
  let soft = 0, hard = 0;
  for (const [ty, w] of menu) if (MON[ty].fly) { if (MON[ty].armor) hard += w; else soft += w * (ty === 'harpy' ? 1.2 : .7); }
  soft += ((mx.bat || 0) + (mx.wisp || 0) * .5 + (mx.harpy || 0) * 1.5) * .06; hard += (mx.gargoyle || 0) * .14;
  for (const m of G.mons) if (m.fly && !m.dead && m.hp > 0) { if (m.def.armor) hard += .25; else soft += .08; }
  if (soft + hard <= 0) return { short: 0, hard: 0 };
  const h = hard / (soft + hard), want = Math.min(4, soft + hard) * (1.2 + .55 * G.level);
  let have = 0;
  for (const t of towers) {
    if (!t.def.air || t.state !== 'active') continue;
    let v = t.lvl + 1 + (t.branch === 'tempest' || t.branch === 'volley' ? 1.5 : 0) + (t.oc || 0) * .5;
    if (t.kind === 'archer' && t.branch !== 'longbow') v *= 1 - .5 * h;
    have += v;
  }
  return { short: Math.min(4, Math.max(0, want - have)), hard: h };
}
// In a run with Fate's Lantern rerolls left, the commander rerolls a land that came up with two or more curses
// (once per land, before the first wave is out).
function aiReroll() {
  if (!inRun() || !(G.rerolls > 0) || AI.rerollLv === G.level || G.k > 1 || G.modLevel !== G.level || typeof MUTATORS !== 'object') return;
  AI.rerollLv = G.level;
  if (G.mods.filter(k => MUTATORS[k] && MUTATORS[k].curse).length >= 2) rerollMods();
}
// Which branch suits this tower: what leaked (counts most) and what this land has sent so far, plus a nudge
// towards variety so the board does not end up all one kind.
function aiBranch(t, towers, air, armor, swarm) {
  const mx = G.mix, tot = Math.max(1, (mx.air || 0) + (mx.armor || 0) + (mx.swarm || 0) + (mx.big || 0) + (mx.siege || 0) + 20);
  // Harpies snatch footmen, so they weigh more than other flyers; rams (siege) are weak to blasts and fire and shrug off plain arrows.
  const fA = ((mx.air || 0) / tot) * 3 + ((mx.harpy || 0) / tot) * 2 + air * .5, fR = ((mx.armor || 0) / tot) * 4 + ((mx.big || 0) / tot) * 3 + armor * .5 + (G.bossWave || isBossK(G.k % G.wavesPerLand + 1) ? .4 : 0);
  const fG = ((mx.siege || 0) / tot) * 8 + (G.leakTypes.ram || 0) * .4;
  const fS = ((mx.swarm || 0) / tot) * 2.5 + swarm * .4 + (isHordeK(G.k % G.wavesPerLand + 1, G.level) ? .6 : 0), rel = t.pad.s / G.B.L;
  const [a, b] = BRANCH_KEYS[t.kind], have = k => towers.filter(o => o.branch === k).length, br = t.def.branches;
  // How much more road the branch's range would cover from this pad (long-range branches shine on central pads).
  const c0 = padCoverage(t.pad, t.def.range[2]) + 1, gain = k => br[k] && br[k].range ? (padCoverage(t.pad, br[k].range) - c0) / c0 : 0, lk = G.leaks > 3 ? .3 : 0;
  const sc = {
    longbow: .55 + fR * 1.2 + gain('longbow') * .6, volley: .5 + fA * 1.3 + fS * .5,
    mortar: .5 + fR * .6 + fS * .4 + fG * .8 + gain('mortar') * .6, firebomb: .5 + fS * 1.0 + fG * 1.0 + rel * .2,
    tempest: .5 + fA * 1.5 + fR * .2, frost: .5 + rel * .5 + fS * .3 + lk,
    knights: .5 + fS * .6 + lk, pikes: .55 + fR * 1.1 + fG * .6 + (mx.big ? .2 : 0),
  };
  return sc[a] / (1 + .6 * have(a)) >= sc[b] / (1 + .6 * have(b)) ? a : b;
}
// The run: everything since the last defeat (or the page load), for the summary on the defeat screen.
function newRun() { G.runStats = { wave0: G.level * G.wavesPerLand, lands: 0, slain0: G.slain, earned: 0, last: G.gold, best0: G.best, tower: null, branch: {}, sum: null }; }
function trackRun() { const RS = G.runStats; if (!RS) return; const d = G.gold - RS.last; if (d > 0) RS.earned += d; RS.last = G.gold; }
// At the end of each battlefield, won or lost: the run's best tower, and the kills of each branch.
function recordTowers() {
  const RS = G.runStats; if (!RS) return;
  for (const t of G.towers) {
    if (!t.def) continue; const k = t.kills || 0;
    if (t.branch) RS.branch[t.branch] = (RS.branch[t.branch] || 0) + k;
    if (k > 0 && (!RS.tower || k > RS.tower.kills)) RS.tower = { name: t.branch && t.def.bdef ? t.def.bdef.title : t.def.name, kills: k, land: G.B.bio.name };
  }
}
function runSummary() {
  const RS = G.runStats; if (!RS) return null;
  let bk = null, bn = -1, bname = ''; for (const k in RS.branch) if (RS.branch[k] > bn) { bn = RS.branch[k]; bk = k; }
  if (bk) for (const kind of TOWER_KINDS) if (TOWER[kind].branches && TOWER[kind].branches[bk]) bname = TOWER[kind].branches[bk].name;
  return { waves: Math.max(0, waveNumber() - 1 - RS.wave0), lands: RS.lands, slain: G.slain - RS.slain0, earned: Math.round(RS.earned), branch: bk ? { name: bname, kills: bn } : null, tower: RS.tower, best: G.best, newBest: G.best > RS.best0 && G.best > G.wavesPerLand };
}
// After a defeat: a new run from the first land. The commander restarts by itself after a while; a player restarts from the summary.
const SUMMARY_AT = 2.6, AUTO_RESTART = 14;
function restartRun(byPlayer) {
  if (G.phase !== 'defeat' || G.phaseT < SUMMARY_AT) return false;
  G.level = 0; G.press = byPlayer || UI.playerActive() ? 1 : Math.max(.8, G.press * .85); G.run++; G.newRun = true;
  G.evLevel = -1; // a run lost on the first land still gets that land's event the next time round
  setPhase('crumble');
  return true;
}
function setPhase(p) {
  G.phase = p; G.phaseT = 0; if (p !== 'play') G.horde = false;
  if (p === 'clear') { recordTowers(); if (G.runStats) G.runStats.lands++; G.advance = true; metaLandClear(); autosave(1, true); UI.banner('Maa on kaitstud!', 3.2, false); UI.closeMenu(); }
  if (p === 'defeat') { recordTowers(); if (G.runStats) G.runStats.sum = runSummary(); clearSave(); if (inRun()) bankRun('defeat'); UI.banner('Majakas kustus', 4.2, true); UI.closeMenu(); sfx('beaconOut', G.B.beacon.x, G.B.beacon.z, 1.2); fxEmbers(G.B.beacon.x, G.B.beacon.y, G.B.beacon.z, 60, .8); for (let i = 0; i < 14; i++) fxSmoke(G.B.beacon.x + rr(-.4, .4), G.B.beacon.y + rr(0, 1), G.B.beacon.z + rr(-.4, .4), rr(-.3, .3), rr(.8, 2), rr(-.3, .3), rr(2, 4), 1, 2, .2, .2, .22, .6, { drag: .5, rise: .2 }); }
  if (p === 'crumble') startCrumble();
  if (p === 'rise') startRise();
}
function startCrumble() {
  const B = G.B;
  for (const m of G.mons) if (!m.dead) { shatter(e => rigMonster(e), m, [0, 1, 0], { spread: 1.2, life: 1 }); removeMonster(m); }
  for (const f of G.men) if (!f.dead) { f.weapon = KIT.item.blade; shatter(e => rigHuman(KIT.foot, SPEC.foot, e), f, [0, 1, 0], { spread: 1, life: 1 }); f.dead = f.gone = true; f.alive = false; if (f.flame) removeFlame(f.flame); }
  G.mons.length = 0; G.men.length = 0; G.arrows.length = 0; G.shells.length = 0; G.stuck.length = 0; G.fires.length = 0; G.horde = false; G.pending.length = 0; G.rallies.length = 0; G.tides.length = 0;
  for (const t of G.towers) {
    t.em.alive = false; LT.emitters[t.idx] = null; removeFlame(t.flame); removeFlame(t.flame2); t.flame = t.flame2 = null; t.archers.length = 0; t.alive = false; t.state = 'gone';
    let best = null, bd = 1e9; for (const p of B.pieces) if (p.kind === 'chunk') { const d = dist2(p.cx, p.cz, t.x, t.z); if (d < bd) { bd = d; best = p; } }
    if (best) best.mesh.attach(t.group);
  }
  for (const f of B.flames) removeFlame(f); B.flames.length = 0;
  for (const p of B.pieces) { p.t = 0; p.delay = .25 + rnd() * .9 + sat((36 - (p.cx + p.cz)) / 72) * 1.3 + (p.kind !== 'chunk' ? .2 : 0); p.vy = 0; }
  FX.groundAt = () => -500; clearFX(); setBoardCasting(B, true);
  sfx('crumble', 0, 0, 1.3); shake(1.2);
}
function startRise() {
  if (G.B) { for (const t of G.towers) { t.clearModel(false); } G.towers.length = 0; clearDebris(); disposeBoard(G.B); }
  for (let i = 0; i < LT.emitters.length; i++) LT.emitters[i] = null;
  const B = G.B = buildBoard(G.boardSeed++, G.boardIndex++);
  R.scene.add(B.group); activateBoard(B, false);
  setBoardCasting(B, true);
  for (const p of B.pieces) { p.t = 0; p.delay = sat((p.cx + p.cz + 36) / 72) * 1.7 + rnd() * .25 + (p.kind === 'chunk' ? 0 : 2.0 + rnd() * .3); p.mesh.visible = false; }
  sfx('rise', 0, 0, 1.2); UI.banner(B.bio.name, 3.6, false);
}
function activateBoard(B, lit) {
  B.flames = [];
  const b = B.beacon;
  B.beaconFlame = addFlame({ x: b.x, y: b.y - .12, z: b.z, size: 2.3, layers: 3, embers: 2.6, glow: 1.1, smoke: 5, on: lit ? 1 : 0 }); B.flames.push(B.beaconFlame);
  for (const f of B.fires) B.flames.push(addFlame(Object.assign({ x: f.x, y: f.y, z: f.z, size: f.size, embers: .5, glow: .8, on: lit ? 1 : 0 }, f.fx)));
  LT.beaconPos = b; LT.beaconOn = lit ? 1 : 0; LT.beaconLevel = 1; LT.envSrc = B.env.slice(0, LT.env.length); LT.envK = lit ? 1 : 0; setBiomeLook(B, lit);
  FX.groundAt = B.heightAt;
  G.padCov = null;
}
// S: a wave snapshot being restored (restoreRun): no warm-up monsters; restoreRun sets the saved numbers afterwards.
function beginBattle(first, S) {
  const B = G.B; dailyReseed(G.level, 0);
  G.mix = {}; G.mana = Math.max(G.mana * .5, 30); for (const k in G.spellCd) G.spellCd[k] = 0; G.pending.length = 0; G.rallies.length = 0;
  G.lives = G.maxLives; G.gold = 300 + 100 * G.level + 12 * G.level * G.level; G.bountyMul = 1 + .12 * G.level; G.dmgMul = 1.55 + .2 * G.level; G.press = lerp(G.press, 1, .6); UI.goldShown = G.gold; G.k = 0; G.leaks = 0; G.leakTypes = {}; G.snatched = 0; G.spawning = false; G.bossWave = false; G.horde = false; G.fires.length = 0; G.nextIn = first ? .9 : 1.6; if (!S) countStart(); G.queue = []; AI.think = .15; AI.wait = 0;
  const n = S || TUT.active() ? 0 : 4 + Math.min(3, G.level);
  for (let i = 0; i < n; i++) spawnMonster(i === n - 1 && G.level > 0 ? 'knight' : 'skel', { s: B.cave.s + 2.2 + i * 1.15, lat: rr(-.7, .7), hpMul: 1 + .22 * G.level });
  if (first || G.newRun || !G.runStats) { G.newRun = false; newRun(); }
  metaLandStart(!!S);
  G.runStats.last = G.gold;
  G.phase = 'play'; G.phaseT = 0;
}
function updatePhase(dt) {
  G.phaseT += dt; const B = G.B, t = G.phaseT;
  updateBiomeLook(dt); LT.envK = damp(LT.envK, G.phase === 'crumble' ? 0 : (G.phase === 'rise' && t < 2.4 ? 0 : 1), 2, dt); LT.beaconMul = damp(LT.beaconMul, B.bio.beacon || 1, 2, dt);
  const want = G.phase === 'defeat' ? 0 : (G.phase === 'rise' ? (t > B.igniteAt ? 1 : 0) : 1);
  LT.beaconOn = damp(LT.beaconOn, want, want ? 3 : 1.6, dt);
  LT.beaconLevel = damp(LT.beaconLevel, G.lives / G.maxLives, 3, dt);
  if (B.beaconFlame) { const f = B.beaconFlame, lv = LT.beaconLevel; f.on = LT.beaconOn; f.size = 2.35 * (.42 + .58 * lv) * (1 - .32 * LT.beaconGutter); f.embers = 1 + 2 * lv + 6 * LT.beaconGutter; }
  for (let i = 1; i < B.flames.length; i++) B.flames[i].on = LT.beaconOn;
  // A victory cinematic (Ash's CINE) or the campaign's victory screens (G.holdClear) hold the land up until they end.
  if (G.phase === 'clear') { if (t > 2.6 && !G.holdClear && !(typeof CINE !== 'undefined' && CINE.on())) setPhase('crumble'); }
  else if (G.phase === 'defeat') {
    for (const tw of G.towers) { tw.em.on = damp(tw.em.on, 0, 1.5 + tw.idx * .15, dt); if (tw.flame) tw.flame.on = tw.em.on; if (tw.flame2) tw.flame2.on = tw.em.on; }
    // A player who has walked away gets the commander back for the next run.
    if (G.mode === 'demo' && t > SUMMARY_AT + AUTO_RESTART && (!UI.playerActive() || UI.idle > 45)) { if (UI.playerActive()) UI.setManual(false); restartRun(false); }
  } else if (G.phase === 'crumble') {
    let done = true;
    for (const p of B.pieces) {
      const u = t - p.delay;
      if (u < 0) { p.mesh.position.set(p.cx + rr(-.03, .03) * sat(t * 2), p.cy, p.cz + rr(-.03, .03) * sat(t * 2)); done = false; continue; }
      const y = p.cy - 9 * u * u - u * 1.2; p.mesh.position.set(p.cx, y, p.cz); p.mesh.rotation.set(p.spin.x * u * .5, p.spin.y * u * .25, p.spin.z * u * .5);
      if (!p.dusted) { p.dusted = true; fxDust(p.cx, 0, p.cz, 5, 2.2, { speed: 2.5, life: 1.4 }); shake(.1); }
      if (y > -60) done = false; else p.mesh.visible = false;
    }
    if (done || t > 5.2) { if (G.advance) { G.level++; G.advance = false; } setPhase('rise'); }
  } else if (G.phase === 'rise') {
    let done = true;
    for (const p of B.pieces) {
      const u = (t - p.delay) / (p.kind === 'chunk' ? 1.15 : .8);
      if (u < 0) { done = false; continue; }
      p.mesh.visible = true;
      if (u >= 1) { p.mesh.position.set(p.cx, p.cy, p.cz); p.mesh.rotation.set(0, 0, 0); if (!p.set) { p.set = true; if (p.kind !== 'chunk') { fxDust(p.cx, p.cy + .2, p.cz, 12, 2.2, { speed: 3 }); shake(.25); sfx('hammer', p.cx, p.cz, 1, .1); } } continue; }
      done = false; const e = easeOut(u), k = 1 - e;
      if (p.kind === 'chunk') { p.mesh.position.set(p.cx, p.cy - 30 * k, p.cz); p.mesh.rotation.set(p.spin.x * k * .7, p.spin.y * k * .5, p.spin.z * k * .7); }
      else { const d = 1 - u * u; p.mesh.position.set(p.cx, p.cy + 16 * d, p.cz); p.mesh.rotation.set(0, 0, 0); }
    }
    if (done && !B.igniteAt) { B.igniteAt = t + .25; }
    if (B.igniteAt && t > B.igniteAt && !B.lit) { B.lit = true; sfx('ignite', B.beacon.x, B.beacon.z, 1.3, 1); lightFlash(B.beacon.x, B.beacon.y + 1, B.beacon.z, 0xffa050, 2600, .7, 60); fxEmbers(B.beacon.x, B.beacon.y, B.beacon.z, 50, .6); shake(.5); }
    if (B.lit && t > B.igniteAt + .7) { setBoardCasting(B, false); beginBattle(false); }
  }
}

// Save and continue. One run is kept in localStorage ('lanternhold.save'), written at the start of every wave, when a land
// is cleared (as the start of the next land) and when the page is hidden. A save always resumes at the start of a wave:
// mid-wave state (monsters, gold from kills during the wave) is never written, so a reload cannot pay out twice.
// Test sessions (#seed=, #manual, #nosave) never write, so QA and record.js stay deterministic.
const SAVE_KEY = 'lanternhold.save', SAVE_V = 1, SAVE_DAYS = 7;
// on: writing allowed in this session; hold: the Continue offer is up (the demo behind it must not overwrite the save);
// last: the snapshot written most recently (a page hidden mid-wave rewrites it with the current speed and commander).
const SAVE = { on: !(HASH.seed || HASH.manual || HASH.nosave), hold: false, last: null };
function snapshot(k, fresh) {
  const idx = fresh ? G.boardIndex : G.boardIndex - 1, seed = fresh ? G.boardSeed : G.boardSeed - 1;
  return metaSnapshot({
    v: SAVE_V, t: Date.now(), fresh: fresh ? 1 : 0, start: BIOME.start, seed, index: idx, biome: biomeFor(idx).key, pseed: procSeed(),
    level: fresh ? G.level + 1 : G.level, k, gold: Math.round(G.gold), lives: G.lives, mana: Math.round(G.mana * 10) / 10, press: G.press, best: G.best, seen: G.seen,
    towers: fresh ? [] : G.towers.filter(t => t.alive && t.def).map(t => ({ p: t.idx, kind: t.kind, lvl: t.lvl, branch: t.branch || null, oc: t.oc || 0, spent: t.spent, kills: t.kills || 0 })),
    manual: !!UI.playerActive(), everManual: !!UI.everManual, speed: G.speed, ev: { wave: G.evWave, done: !!G.evDone },
    run: G.run, slain: G.slain, stats: G.stats, runStats: G.runStats, leaks: G.leaks, leakTypes: G.leakTypes, mix: G.mix, snatched: G.snatched || 0,
  });
}
function writeSave(S) { SAVE.last = S; try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); return true; } catch (e) { return false; } }
function clearSave() { SAVE.last = null; try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
// Only a player's run saves: the AI demo behind the main menu never touches the saved run.
function autosave(k, fresh) { if (SAVE.on && !SAVE.hold && G.lives > 0 && inRun()) writeSave(snapshot(k, fresh)); }
// Page hidden (tab closed, app switched, iOS dropping the page). Between waves with the road empty, the finished wave
// is banked; otherwise the wave-start snapshot stands, with the current speed and commander.
function saveOnHide() {
  if (!SAVE.on || SAVE.hold || !G.B || !inRun()) return;
  if (G.phase === 'play' && G.lives > 0 && !G.spawning && !G.bossWave && G.k < G.wavesPerLand && !G.mons.some(m => !m.dead)) { writeSave(snapshot(G.k + 1, false)); return; }
  const S = SAVE.last; if (!S || G.phase === 'defeat') return;
  S.t = Date.now(); S.speed = G.speed; S.manual = !!UI.playerActive(); S.everManual = !!UI.everManual; writeSave(S);
}
const _num = (v, lo, hi) => typeof v === 'number' && isFinite(v) && v >= lo && v <= hi;
const _int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
// A save from this version, younger than SAVE_DAYS, whose numbers all make sense; anything else is ignored.
function validSave(S) {
  if (!S || typeof S !== 'object' || S.v !== SAVE_V) return false;
  const now = Date.now(); if (!_num(S.t, now - SAVE_DAYS * 864e5, now + 6e5)) return false;
  if (!_int(S.level, 0, 999) || !_int(S.k, 1, G.wavesPerLand) || !_int(S.seed, 0, 1e9) || !_int(S.index, 0, 1e6) || !_int(S.start, -1e6, 1e6)) return false;
  const n = BIOMES.length, j = S.start + S.index;
  if (S.biome === PROC_KEY) { if (j < n || !_int(S.pseed, -1e9, 1e10)) return false; } // a generated land: its land index and seed
  else if (j < 0 || j >= n || BIOMES[j].key !== S.biome) {
    // Saved before the rotation grew (5 lands, now 6) or from a rotation that wrapped past the last hand-made land:
    // keep the saved land by re-deriving the rotation start from its key.
    const bi = BIOMES.findIndex(b => b.key === S.biome); if (bi < 0) return false;
    S.start = bi - S.index;
  }
  if (!_num(S.gold, 0, 1e7) || !_int(S.lives, 1, 99) || !_num(S.mana, 0, G.manaMax) || !_num(S.press, .1, 50) || !Array.isArray(S.towers) || S.towers.length > 40) return false;
  const pads = new Set();
  for (const t of S.towers) {
    if (!t || !TOWER_KINDS.includes(t.kind) || !_int(t.p, 0, 99) || pads.has(t.p) || !_int(t.lvl, 0, 3) || !_int(t.oc || 0, 0, OC_MAX)) return false;
    if (t.lvl === 3 ? !(BRANCH_KEYS[t.kind] || []).includes(t.branch) : (t.branch || t.oc)) return false;
    pads.add(t.p);
  }
  return true;
}
// The saved run worth offering on load: valid, and past the first wave of the first land.
function continueOffer() {
  let S = null; try { S = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; }
  return validSave(S) && (S.level > 0 || S.k > 1) ? S : null;
}
const _numMap = o => { const r = {}; if (o && typeof o === 'object') for (const k in o) if (_num(o[k], -1e9, 1e9)) r[k] = o[k]; return r; };
// Swap the demo for the saved run: the saved board (same seed, index and land), towers rebuilt instantly at their
// level, branch and overcharge, and the saved numbers. The saved wave starts after a short countdown.
function restoreRun(S) {
  if (!validSave(S)) return false;
  const B0 = G.B, ar = AU.ready; AU.ready = false; // silent while the board is swapped (no burst of build sounds)
  try {
    if (G.event && typeof endEvent === 'function') endEvent();
    for (const m of G.mons) if (!m.dead) removeMonster(m);
    for (const f of G.men) if (!f.dead) { f.dead = f.gone = true; f.alive = false; if (f.flame) removeFlame(f.flame); }
    for (const t of G.towers) t.dispose();
    G.mons.length = 0; G.men.length = 0; G.arrows.length = 0; G.shells.length = 0; G.stuck.length = 0; G.fires.length = 0; G.burns.length = 0; G.chain.length = 0; G.towers.length = 0; G.tides.length = 0;
    G.queue = []; G.bossAlive = false; G.slowmo = 0; G.hitstop = 0; CAM.ent = null; G.rangeMul = 1;
    if (B0) for (const f of B0.flames || []) removeFlame(f);
    clearDebris(); clearFX(); if (B0) disposeBoard(B0);
    for (let i = 0; i < LT.emitters.length; i++) LT.emitters[i] = null;
    metaRestore(S); G.modLevel = -1; setMods([]);
    BIOME.start = S.start; if (S.biome === PROC_KEY) BIOME.seed = S.pseed; G.boardSeed = S.seed; G.boardIndex = S.index; G.level = S.level; G.advance = false; G.newRun = false;
    const B = G.B = buildBoard(G.boardSeed++, G.boardIndex++);
    R.scene.add(B.group); activateBoard(B, true);
    G.press = S.press; G.mana = S.mana; G.best = Math.max(G.best, _num(S.best, 0, 1e6) ? S.best : 0);
    G.seen = {}; if (S.seen && typeof S.seen === 'object') for (const k in S.seen) if (S.seen[k]) G.seen[k] = 1;
    G.run = _int(S.run, 1, 1e6) ? S.run : 1; G.slain = _int(S.slain, 0, 1e9) ? S.slain : 0; G.stats = Object.assign({ branches: 0, spells: 0 }, _numMap(S.stats));
    const RS = S.runStats; G.runStats = RS && typeof RS === 'object' && _num(RS.wave0, 0, 1e6) && _num(RS.slain0, 0, 1e9) && _num(RS.earned, 0, 1e9) && _num(RS.best0, 0, 1e6)
      ? { wave0: RS.wave0, lands: _int(RS.lands, 0, 1e6) ? RS.lands : 0, slain0: RS.slain0, earned: RS.earned, last: 0, best0: RS.best0, tower: RS.tower && typeof RS.tower === 'object' && typeof RS.tower.name === 'string' ? { name: RS.tower.name, kills: +RS.tower.kills || 0, land: String(RS.tower.land || '') } : null, branch: _numMap(RS.branch), sum: null } : null;
    if (S.fresh) { G.evLevel = -1; beginBattle(false); }
    else {
      beginBattle(false, S);
      G.gold = S.gold; G.lives = S.lives; G.mana = S.mana; G.press = S.press; G.k = S.k - 1; G.nextIn = 4; UI.goldShown = G.gold;
      G.leaks = _int(S.leaks, 0, 1e6) ? S.leaks : 0; G.leakTypes = _numMap(S.leakTypes); G.mix = _numMap(S.mix); G.snatched = _int(S.snatched, 0, 1e6) ? S.snatched : 0;
      const ev = S.ev || {}; G.evLevel = G.level; G.evWave = _int(ev.wave, 1, G.wavesPerLand) ? ev.wave : 3; G.evDone = !!ev.done;
      for (const st of S.towers) { const pad = B.pads[st.p]; if (pad && !pad.tower) restoreTower(pad, st); }
      G.restored = true;
    }
    if (G.runStats) G.runStats.last = G.gold;
    G.speed = _int(S.speed, 1, 3) ? S.speed : 1; G.paused = false;
    UI.setManual(!!S.manual); if (S.everManual) UI.everManual = true; UI.closeMenu(); UI.coins.length = 0; UI.idle = 0;
    camReset(); CAM.fx = CAM.fz = CAM.sx = CAM.sz = 0; R.fade = .2;
  } finally { AU.ready = ar; }
  SAVE.last = S.fresh ? null : S;
  sfx('ignite', G.B.beacon.x, G.B.beacon.z, 1, 1);
  UI.banner(G.B.bio.name + (G.level >= BIOMES.length ? ' · Öömaa ' + (G.level - BIOMES.length + 1) : ' · Maa ' + (G.level + 1)), 3, false);
  return true;
}
// A saved tower, built at once: no scaffolding, at its level and branch, with its overcharge.
function restoreTower(pad, st) {
  const t = new Tower(pad, st.kind, G.B.pads.indexOf(pad)); G.towers.push(t);
  if (st.lvl === 3) { t.branch = st.branch; t.def = branchDef(t.kind, st.branch); t.lvl = 3; } else t.lvl = st.lvl;
  t.begin(); t.finish();
  t.oc = t.lvl >= 3 ? st.oc || 0 : 0; if (t.oc) t.em.I = t.light0 * (1 + .3 * t.oc);
  let paid = 0; for (let l = 0; l <= Math.min(2, t.lvl); l++) paid += TOWER[t.kind].cost[l];
  t.spent = _num(st.spent, 0, 1e6) ? st.spent : paid; t.kills = _int(st.kills, 0, 1e9) ? st.kills : 0;
  return t;
}
