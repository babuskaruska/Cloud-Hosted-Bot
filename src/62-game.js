Object.assign(G, {
  press: 1, bountyMul: 1, dmgMul: 1, waveKills: 0, waveLeaks: 0, leaks: 0, leakTypes: {}, slowmo: 0, bossDown: false,
  queue: [], waveT: 0, nextIn: 0, spawning: false, bossWave: false, bossAlive: false, k: 0, phaseT: 0, banner: null, started: false, timeScale: 1, trickle: 0, clearT: 0, paused: false, speed: 1, best: 0, seen: {},
  // Waves per battlefield; the last one is the boss wave. G.bossWave stays a boolean: "the current wave is the boss wave".
  wavesPerLand: 8, horde: false, fires: [],
});

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
};
// Horde swarm: [budget cost, weight]. Biome weights from bio.mobs still apply (0 removes one).
const HORDE = { rat: [1.7, 3], spider: [2.6, 2], scarab: [1.2, 2.2], slimelet: [2.8, 1.4] };
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
function bossType() { const b = G.B.bio.boss; return b[Math.floor(G.level / BIOMES.length) % b.length]; }

// Elites: tougher, richer monsters with one twist each. m.elite is the key; Ash draws the aura from it.
const ELITE = {
  burning: { name: 'Burning', col: '#ff9a4a', hp: 1.6, tip: 'Leaves fire on the road that burns your footmen.' },
  shielded: { name: 'Shielded', col: '#9fd4ff', hp: 1.25, tip: 'A ward soaks up the first big chunk of damage.' },
  hasted: { name: 'Hasted', col: '#f2e27a', hp: 1.3, tip: 'Much faster than the rest of its kind.' },
  splitting: { name: 'Splitting', col: '#b4f08a', hp: 1.4, tip: 'Splits into two smaller copies when it falls.' },
};
const ELITE_KINDS = ['burning', 'shielded', 'hasted', 'splitting'];
const ELITE_BOUNTY = 2.5;
// Elites start late on the first land (global wave 6) and grow more common up to 30%,
// but stay rarer in the first waves of each land while the new board is still being built.
function eliteChance(k, level) { const w = level * G.wavesPerLand + k; return w < 6 ? 0 : Math.min(.3, .045 + .016 * (w - 6)) * (k <= 2 ? .35 : k <= 4 ? .7 : 1); }
function pickElite(type, k, level, mul = 1) {
  const d = MON[type]; if (d.boss || type === 'scarab' || type === 'slimelet' || rnd() >= eliteChance(k, level) * mul) return undefined;
  const opts = d.fly ? ['shielded', 'hasted'] : ELITE_KINDS;
  return opts[Math.floor(rnd() * opts.length)];
}
function makeElite(m, kind) {
  const E = ELITE[kind]; if (!E || m.def.boss) return m;
  m.elite = kind; m.hp *= E.hp; m.maxHp *= E.hp; m.bmul = (m.bmul || 1) * ELITE_BOUNTY; m.scale *= 1.1;
  if (kind === 'shielded') m.ward = m.wardMax = m.maxHp * .6;
  if (kind === 'hasted') m.spdMul *= 1.45;
  if (kind === 'burning') m.fireT = .3;
  sfx('elite', m.x, m.z);
  return m;
}
function eliteName(m) { return ELITE[m.elite] ? ELITE[m.elite].name + ' ' + m.def.name : m.def.name; }
// Called from hitMonster: the ward absorbs damage first. Returns the damage that gets through.
function wardAbsorb(m, dmg) {
  const a = Math.min(m.ward, dmg); m.ward -= a;
  if (m.ward <= 0) { m.ward = 0; fxSparks(m.x, m.y + m.hitH, m.z, 12, 4, 1.2, 2, 3, { size: .06 }); fxTimed(5, m.x, m.y + m.hitH, m.z, 2.2, 2.2, .6, 1.2, 2.4, .9, .25); sfx('clash', m.x, m.z, .9, .9); }
  else if (rnd() < .4) fxSparks(m.x, m.y + m.hitH, m.z, 3, 2.5, .8, 1.5, 2.6, { size: .05 });
  return dmg - a;
}
function addFire(x, z, r, life) {
  G.fires.push({ x, z, r, t: life, max: life });
  if (typeof FX.groundFire === 'function') FX.groundFire(x, z, r, life);
  else fxTimed(4, x, G.B.heightAt(x, z) + .08, z, r * 2.6, r * 2.6, 1.6, .6, .15, .55, life, { ground: true });
}
// Called from killMonster for an elite, before it is removed.
function eliteDeath(m) {
  if (m.elite === 'burning' && !m.fly) { addFire(m.x, m.z, 1.1, 3.2); fxEmbers(m.x, m.y + .3, m.z, 14, .4); sfx('burn', m.x, m.z, .8); }
  if (m.elite === 'splitting' && !m.fly && G.mons.length < 200) {
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
    if (rnd() < dt * 6 * f.r) { const a = rnd() * TAU, d = rnd() * f.r; fxPart(f.x + Math.cos(a) * d, G.B.heightAt(f.x, f.z) + .1, f.z + Math.sin(a) * d, rr(-.2, .2), rr(.6, 1.6), rr(-.2, .2), rr(.4, .9), rr(.05, .09), 2.6, 1.0, .2, { drag: .4, rise: .3 }); }
    const r2 = (f.r + .2) * (f.r + .2), dps = 9 * G.dmgMul * sat(f.t / .5 + .2);
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

function buildWave(k, level) {
  const q = [], boss = isBossK(k), horde = isHordeK(k, level), W = G.wavesPerLand;
  // Each land's step up in strength phases in over its waves: the first waves of a new land are gentler
  // (the board was just rebuilt), the last ones get the full step and a bit more.
  const lvF = .55 + .45 * (k - 1) / (W - 1), lv = 1 + .3 * level * lvF;
  // Budget ramps over the land; the boss wave carries less escort because the boss is the threat.
  let budget = (30 + 19 * (k - 1)) * lv * G.press * (boss ? .6 : 1), heavy = 0, air = budget * .42;
  const hpMul = (1 + .1 * (k - 1)) * (1 + .33 * level * lvF) * (.85 + .15 * G.press);
  let t = .6;
  if (boss) q.push({ t: 2.2, type: bossType(), hpMul: (1 + .45 * level) * Math.pow(G.press, .4) });
  if (horde) {
    const bio = G.B.bio, menu = []; for (const ty in HORDE) { const mul = bio.mobs[ty] === undefined ? 1 : bio.mobs[ty]; if (mul > 0) menu.push([ty, HORDE[ty][1] * Math.min(mul, 2)]); }
    const tot = menu.reduce((a, b) => a + b[1], 0), hp = hpMul * .72; let bodies = 0;
    budget *= 1.5;
    while (budget > 0 && bodies < 260) {
      let r = rnd() * tot, type = 'rat'; for (const [ty, w] of menu) { r -= w; if (r <= 0) { type = ty; break; } }
      const n = Math.floor(rr(6, 13)), cost = HORDE[type][0];
      for (let i = 0; i < n && budget > 0; i++) { q.push({ t, type, hpMul: hp, horde: true, elite: pickElite(type, k, level, .4) }); t += rr(.08, .2); budget -= cost; bodies++; }
      t += rr(.5, 1.1);
    }
    return q;
  }
  const menu = waveMenu(k, level), tot = menu.reduce((a, b) => a + b[1], 0);
  while (budget > 0) {
    let r = rnd() * tot, type = 'skel'; for (const [ty, w] of menu) { r -= w; if (r <= 0) { type = ty; break; } }
    let R = ROSTER[type];
    if (R[0] > budget + 5 || (R[0] >= 30 && heavy >= 1 + (level >> 1)) || (MON[type].fly && air <= 0)) { type = 'skel'; R = ROSTER.skel; }
    if (R[0] >= 30) heavy++;
    const n = Math.floor(rr(R[1], R[2] + .999)), gap = R[3], el = pickElite(type, k, level);
    for (let i = 0; i < n && budget > 0; i++) { q.push({ t, type, hpMul, elite: el && (i === 0 || rnd() < .35) ? el : undefined }); t += gap * rr(.8, 1.25); budget -= R[0]; if (MON[type].fly) air -= R[0]; }
    t += rr(1.1, 2.3) * (boss ? 1.5 : 1);
  }
  q.sort((a, b) => a.t - b.t);
  return q;
}
function startWave() {
  const W = G.wavesPerLand;
  G.k = G.k % W + 1; G.queue = buildWave(G.k, G.level); if (waveNumber() > G.best) { G.best = waveNumber(); try { localStorage.setItem('cinderwatch.best', '' + G.best); } catch (e) {} } G.waveT = 0; G.spawning = true; G.bossWave = isBossK(G.k); G.horde = isHordeK(G.k, G.level); G.waveKills = 0; G.waveLeaks = 0; G.bossDown = false; G.trickle = 6; G.trickleN = 0;
  const cv = G.B.cave, wl = 'Wave ' + G.k + '/' + W;
  sfx(G.bossWave ? 'hornBoss' : 'horn', cv.x, cv.z, 1.1);
  if (G.horde) { sfx('horde', cv.x, cv.z, 1.1); UI.banner(wl + ' · The horde is coming!', 3.4, true); }
  else UI.banner(G.bossWave ? wl + ' · ' + MON[bossType()].name : wl, G.bossWave ? 3.6 : 2.2, G.bossWave);
}
function endWave() {
  const l = G.waveLeaks;
  if (l === 0) G.press *= 1.12; else if (l >= 6) G.press *= .8; else if (l >= 3) G.press *= .9;
  if (G.lives <= 6) G.press *= .9;
  G.press = clamp(G.press, .6, 2.2);
  G.gold += 22 + 7 * G.k + 8 * G.level;
  G.horde = false;
}
function updateWaves(dt) {
  if (G.phase !== 'play') return;
  const B = G.B;
  updateElites(dt);
  if (G.spawning) {
    G.waveT += dt;
    while (G.queue.length && G.queue[0].t <= G.waveT) {
      if (G.mons.length > 84) break;
      const e = G.queue.shift(), m = spawnMonster(e.type, { hpMul: e.hpMul });
      if (e.horde) m.bmul = .6;
      if (e.elite) makeElite(m, e.elite);
    }
    if (!G.queue.length) {
      G.bossAlive = G.mons.some(m => m.def.boss && !m.dead);
      if (G.bossWave && G.bossAlive) {
        G.trickle -= dt;
        if (G.trickle <= 0 && G.trickleN < 9) { G.trickleN++; G.trickle = rr(3.2, 4.6); const tm = waveMenu(G.wavesPerLand, G.level).filter(e => ROSTER[e[0]][0] < 13), ty = tm[Math.floor(rnd() * tm.length)][0], n = Math.max(1, Math.min(5, Math.round(8 / ROSTER[ty][0]))), hpMul = (1 + .5) * (1 + .25 * G.level); for (let i = 0; i < n; i++) G.queue.push({ t: G.waveT + i * .4, type: ty, hpMul }); }
      } else { G.spawning = false; endWave(); G.nextIn = G.bossWave ? -1 : 6.5; G.clearT = 0; }
    }
  } else if (G.bossWave) {
    G.clearT += dt;
    if (!G.mons.some(m => !m.dead) || G.clearT > 40) { setPhase('clear'); }
  } else {
    G.nextIn -= dt;
    if (G.nextIn <= 0) startWave();
  }
  if (G.lives <= 0 && G.phase === 'play') setPhase('defeat');
}
function callWaveEarly() { if (G.phase === 'play' && !G.spawning && !G.bossWave && G.nextIn > .4) { G.gold += Math.round(G.nextIn * 3); G.nextIn = .05; return true; } return false; }

function padCoverage(pad, range, air) {
  const B = G.B; let c = 0; const r2 = range * range;
  for (let i = 0; i < B.n; i += 2) if (dist2(pad.x, pad.z, B.px[i], B.pz[i]) < r2) c += PATH_STEP * 2;
  return c;
}
function buildTower(pad, kind, byPlayer) {
  const def = TOWER[kind]; if (pad.tower || G.gold < def.cost[0] || G.phase !== 'play') return null;
  G.gold -= def.cost[0]; UI.goldShown = Math.min(UI.goldShown, G.gold);
  const t = new Tower(pad, kind, G.B.pads.indexOf(pad)); G.towers.push(t); UI.ping(pad.x, pad.y, pad.z, byPlayer); return t;
}
function upgradeTower(t, byPlayer) {
  if (!t || t.lvl >= 2 || t.state !== 'active' || G.phase !== 'play') return false; const c = t.def.cost[t.lvl + 1]; if (G.gold < c) return false;
  G.gold -= c; UI.goldShown = Math.min(UI.goldShown, G.gold); t.upgrade(); UI.ping(t.x, t.y, t.z, byPlayer); return true;
}
// Overcharge: a maxed tower can be pushed further, up to OC_MAX times. Each stack adds OC_DMG damage (applied in hitMonster).
const OC_MAX = 3, OC_DMG = .25;
function overchargeCost(t) { return t && t.lvl >= 2 && (t.oc || 0) < OC_MAX ? Math.round(t.def.cost[2] * [1, 1.4, 1.9][t.oc || 0] * (1 + .15 * G.level) / 5) * 5 : 0; }
function overchargeTower(t, byPlayer) {
  const c = overchargeCost(t); if (!c || !t.alive || t.state !== 'active' || G.phase !== 'play' || G.gold < c) return false;
  G.gold -= c; UI.goldShown = Math.min(UI.goldShown, G.gold); t.oc = (t.oc || 0) + 1; t.spent += c; t.em.I = t.def.light[t.lvl] * (1 + .3 * t.oc);
  UI.ping(t.x, t.y, t.z, byPlayer); fxTimed(5, t.x, t.y + 2, t.z, 4, 4, 1.4, 1.0, .5, .9, .35); fxEmbers(t.x, t.y + 1.5, t.z, 18, .6); sfx('buyout', t.x, t.z, 1);
  return true;
}
// Mending the beacon buys back lives, a few at a time, up to the beacon's maximum.
const MEND_N = 4;
function mendCount() { return Math.max(0, Math.min(MEND_N, G.maxLives - G.lives)); }
function mendCost() { return mendCount() * (20 + 8 * G.level); }
function mendBeacon(byPlayer) {
  const n = mendCount(), c = mendCost(); if (!n || G.phase !== 'play' || G.lives <= 0 || G.gold < c) return false;
  G.gold -= c; UI.goldShown = Math.min(UI.goldShown, G.gold); G.lives += n;
  const b = G.B.beacon; fxEmbers(b.x, b.y, b.z, 40, .6); lightFlash(b.x, b.y + 1, b.z, 0xffa050, 900, .4, 30); sfx('ignite', b.x, b.z, 1, .5); UI.ping(b.x, b.y - .5, b.z, byPlayer);
  return true;
}
function sellTower(t) {
  if (!t || !t.alive || G.phase !== 'play') return false; const refund = Math.round(t.spent * .6);
  G.gold += refund; t.sell(); const i = G.towers.indexOf(t); if (i >= 0) G.towers.splice(i, 1); return true;
}

const AI = { think: .15, wait: 0, last: '' };
function aiThink(dt) {
  if (G.phase !== 'play' || UI.playerActive()) return;
  AI.think -= dt; if (AI.think > 0) return; AI.think = .5;
  const B = G.B, towers = G.towers.filter(t => t.alive), empty = B.pads.filter(p => !p.tower), N = towers.length;
  const cnt = { archer: 0, bombard: 0, spire: 0, guard: 0 }; for (const t of towers) cnt[t.kind]++;
  const ideal = { archer: .36, bombard: .22, spire: .2, guard: .22 };
  const lt = G.leakTypes; let air = 0, armor = 0, swarm = 0; for (const ty in lt) { const c = MON[ty].cat; if (c === 'air') air += lt[ty]; else if (c === 'armor') armor += lt[ty]; else if (c === 'swarm') swarm += lt[ty]; }
  const gatePress = sat(G.leaks / 8);
  const opts = [];
  for (const kind of TOWER_KINDS) {
    const def = TOWER[kind];
    let need = ideal[kind] * (N + 1.6) - cnt[kind] + .35;
    if (kind === 'archer') need += air * .2 + (N === 0 ? 1 : 0); if (kind === 'spire') need += air * .12 + armor * .1; if (kind === 'bombard') need += armor * .08 + swarm * .06 + (N >= 2 && cnt.bombard === 0 ? .5 : 0); if (kind === 'guard') need += swarm * .04 + (N >= 1 && cnt.guard === 0 ? .9 : 0);
    if (need <= 0) continue;
    for (const pad of empty) {
      const cov = padCoverage(pad, def.range[0]) / (def.range[0] * 2);
      let sc = need * (.55 + cov * .5);
      const rel = pad.s / B.L;
      if (N < 2) sc *= 1 - Math.abs(rel - .42) * .9;
      sc *= 1 + gatePress * (rel - .5) * .8;
      let syn = 0;
      for (const t of towers) { const d = Math.hypot(t.x - pad.x, t.z - pad.z); if (kind === 'guard' && t.kind !== 'guard' && d < t.range + 1.5) syn += .16; if (kind !== 'guard' && t.kind === 'guard' && d < def.range[0] + 1) syn += .2; if (t.kind === kind && d < 6) syn -= .12; }
      if (kind === 'guard') { sc *= .8 + .5 * rel; for (const t of towers) if (t.kind === 'guard' && Math.abs(t.pad.s - pad.s) < 9) syn -= .5; }
      sc *= 1 + syn;
      opts.push({ sc, cost: def.cost[0], act: 'build', kind, pad });
    }
  }
  for (const t of towers) {
    if (t.state !== 'active' || t.lvl >= 2) continue;
    const c = t.def.cost[t.lvl + 1], use = sat(t.recent / 60);
    let sc = (.5 + use * .9 + (t.lvl === 0 ? .12 : 0)) * (N >= 4 ? 1.25 : .7) * (empty.length === 0 ? 1.6 : 1) * (110 / c);
    if (t.kind === 'archer') sc *= 1 + air * .06; if (t.kind === 'spire') sc *= 1 + armor * .05;
    opts.push({ sc, cost: c, act: 'up', t });
  }
  // Overcharge maxed towers, mostly once the board is full; busy towers first.
  for (const t of towers) {
    const c = overchargeCost(t); if (!c || t.state !== 'active') continue;
    const use = sat(t.recent / 60);
    opts.push({ sc: (.35 + use * .9) * (empty.length === 0 ? 1.3 : .55) * (110 / c) / (1 + .25 * t.oc), cost: c, act: 'oc', t });
  }
  // Mend the beacon when it has taken real damage; more urgent the lower it burns.
  { const n = mendCount(), c = mendCost(); if (n >= 3 || (n > 0 && G.lives <= 8)) opts.push({ sc: (1 - G.lives / G.maxLives) * 3.2 * (110 / Math.max(40, c)) * (G.lives <= 8 ? 1.8 : 1), cost: c, act: 'mend' }); }
  if (!opts.length) return;
  opts.sort((a, b) => b.sc - a.sc);
  let pick = opts[0];
  if (pick.cost > G.gold) {
    AI.wait += .5;
    const aff = opts.find(o => o.cost <= G.gold && o.sc > pick.sc * (AI.wait > 9 ? .45 : .8));
    if (!aff) return; pick = aff;
  }
  AI.wait = 0;
  if (pick.act === 'build') buildTower(pick.pad, pick.kind, false); else if (pick.act === 'up') upgradeTower(pick.t, false); else if (pick.act === 'oc') overchargeTower(pick.t, false); else if (pick.act === 'mend') mendBeacon(false);
  AI.think = N < 3 ? .12 : .8;
}

function setPhase(p) {
  G.phase = p; G.phaseT = 0; if (p !== 'play') G.horde = false;
  if (p === 'clear') { G.advance = true; UI.banner('The pass holds', 3.2, false); UI.closeMenu(); }
  if (p === 'defeat') { UI.banner('The beacon is out', 4.2, true); UI.closeMenu(); sfx('beaconOut', G.B.beacon.x, G.B.beacon.z, 1.2); fxEmbers(G.B.beacon.x, G.B.beacon.y, G.B.beacon.z, 60, .8); for (let i = 0; i < 14; i++) fxSmoke(G.B.beacon.x + rr(-.4, .4), G.B.beacon.y + rr(0, 1), G.B.beacon.z + rr(-.4, .4), rr(-.3, .3), rr(.8, 2), rr(-.3, .3), rr(2, 4), 1, 2, .2, .2, .22, .6, { drag: .5, rise: .2 }); }
  if (p === 'crumble') startCrumble();
  if (p === 'rise') startRise();
}
function startCrumble() {
  const B = G.B;
  for (const m of G.mons) if (!m.dead) { shatter(e => rigMonster(e), m, [0, 1, 0], { spread: 1.2, life: 1 }); removeMonster(m); }
  for (const f of G.men) if (!f.dead) { f.weapon = KIT.item.blade; shatter(e => rigHuman(KIT.foot, SPEC.foot, e), f, [0, 1, 0], { spread: 1, life: 1 }); f.dead = f.gone = true; f.alive = false; if (f.flame) removeFlame(f.flame); }
  G.mons.length = 0; G.men.length = 0; G.arrows.length = 0; G.shells.length = 0; G.stuck.length = 0; G.fires.length = 0; G.horde = false;
  for (const t of G.towers) {
    t.em.alive = false; LT.emitters[t.idx] = null; removeFlame(t.flame); removeFlame(t.flame2); t.flame = t.flame2 = null; t.archers.length = 0; t.alive = false; t.state = 'gone';
    let best = null, bd = 1e9; for (const p of B.pieces) if (p.kind === 'chunk') { const d = dist2(p.cx, p.cz, t.x, t.z); if (d < bd) { bd = d; best = p; } }
    if (best) best.mesh.attach(t.group);
  }
  for (const f of B.flames) removeFlame(f); B.flames.length = 0;
  for (const p of B.pieces) { p.t = 0; p.delay = .25 + rnd() * .9 + sat((36 - (p.cx + p.cz)) / 72) * 1.3 + (p.kind !== 'chunk' ? .2 : 0); p.vy = 0; }
  FX.groundAt = () => -500; clearFX(); setBoardCasting(B, true);
  sfx('crumble', 0, 0, 1.3); FX.shake = 1.2;
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
function beginBattle(first) {
  const B = G.B;
  G.lives = G.maxLives; G.gold = 300 + 90 * G.level; G.bountyMul = 1 + .12 * G.level; G.dmgMul = 1.55 + .2 * G.level; G.press = lerp(G.press, 1, .55); UI.goldShown = G.gold; G.k = 0; G.leaks = 0; G.leakTypes = {}; G.spawning = false; G.bossWave = false; G.horde = false; G.fires.length = 0; G.nextIn = first ? .9 : 1.6; G.queue = []; AI.think = .15; AI.wait = 0;
  const n = 4 + Math.min(3, G.level);
  for (let i = 0; i < n; i++) spawnMonster(i === n - 1 && G.level > 0 ? 'knight' : 'skel', { s: B.cave.s + 2.2 + i * 1.15, lat: rr(-.7, .7), hpMul: 1 + .22 * G.level });
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
  if (G.phase === 'clear') { if (t > 2.6) setPhase('crumble'); }
  else if (G.phase === 'defeat') {
    for (const tw of G.towers) { tw.em.on = damp(tw.em.on, 0, 1.5 + tw.idx * .15, dt); if (tw.flame) tw.flame.on = tw.em.on; if (tw.flame2) tw.flame2.on = tw.em.on; }
    if (t > 4.4) { G.level = 0; G.press = Math.max(.8, G.press * .85); G.run++; setPhase('crumble'); }
  } else if (G.phase === 'crumble') {
    let done = true;
    for (const p of B.pieces) {
      const u = t - p.delay;
      if (u < 0) { p.mesh.position.set(p.cx + rr(-.03, .03) * sat(t * 2), p.cy, p.cz + rr(-.03, .03) * sat(t * 2)); done = false; continue; }
      const y = p.cy - 9 * u * u - u * 1.2; p.mesh.position.set(p.cx, y, p.cz); p.mesh.rotation.set(p.spin.x * u * .5, p.spin.y * u * .25, p.spin.z * u * .5);
      if (!p.dusted) { p.dusted = true; fxDust(p.cx, 0, p.cz, 5, 2.2, { speed: 2.5, life: 1.4 }); FX.shake = Math.min(1, FX.shake + .12); }
      if (y > -60) done = false; else p.mesh.visible = false;
    }
    if (done || t > 5.2) { if (G.advance) { G.level++; G.advance = false; } setPhase('rise'); }
  } else if (G.phase === 'rise') {
    let done = true;
    for (const p of B.pieces) {
      const u = (t - p.delay) / (p.kind === 'chunk' ? 1.15 : .8);
      if (u < 0) { done = false; continue; }
      p.mesh.visible = true;
      if (u >= 1) { p.mesh.position.set(p.cx, p.cy, p.cz); p.mesh.rotation.set(0, 0, 0); if (!p.set) { p.set = true; if (p.kind !== 'chunk') { fxDust(p.cx, p.cy + .2, p.cz, 12, 2.2, { speed: 3 }); FX.shake = Math.min(1, FX.shake + .3); sfx('hammer', p.cx, p.cz, 1, .1); } } continue; }
      done = false; const e = easeOut(u), k = 1 - e;
      if (p.kind === 'chunk') { p.mesh.position.set(p.cx, p.cy - 30 * k, p.cz); p.mesh.rotation.set(p.spin.x * k * .7, p.spin.y * k * .5, p.spin.z * k * .7); }
      else { const d = 1 - u * u; p.mesh.position.set(p.cx, p.cy + 16 * d, p.cz); p.mesh.rotation.set(0, 0, 0); }
    }
    if (done && !B.igniteAt) { B.igniteAt = t + .25; }
    if (B.igniteAt && t > B.igniteAt && !B.lit) { B.lit = true; sfx('ignite', B.beacon.x, B.beacon.z, 1.3, 1); lightFlash(B.beacon.x, B.beacon.y + 1, B.beacon.z, 0xffa050, 2600, .7, 60); fxEmbers(B.beacon.x, B.beacon.y, B.beacon.z, 50, .6); FX.shake = .5; }
    if (B.lit && t > B.igniteAt + .7) { setBoardCasting(B, false); beginBattle(false); }
  }
}
