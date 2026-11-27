// Round 13: ways to earn gold. All of it runs in the demo and the tests as well (the commander uses every one), and
// every gain shows as a small popup: world popups over the board (UI.popAt) and an income ticker under the gold plate
// (UI.income), both drawn by 72-ui.js.
//
// - Interest: at the end of every wave a share of the banked gold (INTEREST) is paid, capped per land (interestCap).
// - Early call: calling the next wave early pays for the seconds skipped (earlyBonus), the countdown's too.
// - Treasure carriers (MON.kullakott): a goblin with a sack that runs for the far side of the board. Killed, it bursts
//   into gold (sackGold); if it gets away it takes no life but steals a little gold. One may join a wave (sackWave).
// - Kill streaks: kills less than COMBO_GAP apart build a streak; every COMBO_STEP kills pays a little combo gold
//   (more for longer streaks, up to 8 a step before the land's bounty multiplier).
// - Gold mine (TOWER.mine, Kullakaevandus): a tower that never attacks and pays gold at the end of every wave.
// Sounds (Echo): sfx('combo', x, z, 1, streak), sfx('interest'), sfx('goldBurst', x, z), sfx('mineTick', x, z).
// Look (Ash): FX.goldBurst(x, z, n) if present, blueprint('mine', lvl) and RIGS.goblinSack.
const INTEREST = .05, COMBO_GAP = .75, COMBO_STEP = 10, MINE_MAX = 3;
const ECON = { streak: 0, lastKill: -9, x: 0, z: 0, best: 0, paid: 0, sacks: 0, sackLost: 0, mined: 0, interest: 0, combo: 0, early: 0 };
G.econ = ECON; // for tests and tools
// Per land: what each source paid (the results screen and the AI read it); reset at a land start.
function econLandStart() { ECON.streak = 0; ECON.lastKill = -9; ECON.mined = 0; ECON.interest = 0; ECON.combo = 0; ECON.early = 0; ECON.sacks = 0; ECON.sackLost = 0; }
// The cap grows with the land and follows the run's gold rules (difficulty, Heat, the Grave Tax upgrade).
function interestCap() { return Math.round((18 + 9 * G.level) * G.goldMul); }
function interestNow() { return Math.max(0, Math.min(interestCap(), Math.floor(G.gold * INTEREST))); }
function earlyBonus(secs) { return G.restored ? 0 : Math.max(0, Math.round(secs * (3 + .6 * G.level) * G.goldMul)); }
function sackGold() { return Math.round((32 + 14 * G.level) * G.bountyMul); }
function mineGold(t) { const d = TOWER.mine; return Math.round(d.gold[Math.min(t.lvl, d.gold.length - 1)] * (1 + .06 * G.level) * G.goldMul); }
const mineCount = () => G.towers.reduce((n, t) => n + (t.alive && t.kind === 'mine' ? 1 : 0), 0);
// A world popup: Ash's FX.pop (44-juice.js) where the build has it, else the HUD's own (UI.popAt).
function econPop(x, y, z, text, col, big) {
  if (typeof FX.pop === 'function') FX.pop(x, y, z, text, col || '#ffd060', { size: big ? 1.5 : 1.1, life: big ? 1.3 : 1 });
  else if (typeof UI.popAt === 'function') UI.popAt(x, y, z, text, col, big);
}
// Gold paid by the economy goes through here, so the run's tally and the popups see it.
function econPay(n, label, x, z, col) {
  n = Math.round(n); if (!(n > 0)) return 0;
  G.gold += n;
  if (typeof UI.income === 'function') UI.income(label, n, col);
  if (x !== undefined && G.B) econPop(x, G.B.heightAt(x, z) + 2.2, z, '+' + n, col);
  return n;
}

// At the end of every wave (endWave): the mines pay, then interest on what is banked.
function econWaveEnd() {
  let mined = 0;
  for (const t of G.towers) {
    if (!t.alive || t.kind !== 'mine' || t.state !== 'active') continue;
    const g = mineGold(t); mined += g; t.kills = (t.kills || 0); t.dealt = (t.dealt || 0) + g;
    econPop(t.x, t.y + 3, t.z, '+' + g, '#ffd060');
    if (typeof FX.mineTick === 'function') FX.mineTick(t, 4 + 2 * t.lvl); else if (typeof FX.goldBurst === 'function') FX.goldBurst(t.x, t.z, 6); else fxSparks(t.x, t.y + 1.6, t.z, 10, 3, 2.2, 1.6, .4, { size: .06, grav: 5 });
    sfx('mineTick', t.x, t.z, 1);
  }
  if (mined) { G.gold += mined; ECON.mined += mined; if (typeof UI.income === 'function') UI.income('Kaevandus', mined, '#ffd060'); }
  const i = interestNow();
  if (i > 0) { ECON.interest += i; econPay(i, 'Intress', undefined, undefined, '#9fe08a'); sfx('interest', CAM.x, CAM.z, .9); }
}

// Kill streaks (from killMonster): every COMBO_STEP kills in a streak pays a little more than the last step.
function econKill(m) {
  if (G.phase !== 'play') return;
  if (m.def.sack) sackDie(m);
  ECON.streak = G.t - ECON.lastKill <= COMBO_GAP ? ECON.streak + 1 : 1; ECON.lastKill = G.t; ECON.x = m.x; ECON.z = m.z;
  if (ECON.streak > ECON.best) ECON.best = ECON.streak;
  if (ECON.streak >= COMBO_STEP && ECON.streak % COMBO_STEP === 0) {
    const n = ECON.streak, g = Math.max(1, Math.round(Math.min(8, 1 + n / 20) * G.bountyMul));
    ECON.combo += g; ECON.paid += g;
    econPay(g, 'Kombo ×' + n, undefined, undefined, '#ffb84a');
    if (typeof FX.combo === 'function') { FX.combo(m.x, m.y + m.hitH + 2.6, m.z, n); econPop(m.x, m.y + m.hitH + 1.9, m.z, '+' + g, '#ffd060'); }
    else econPop(m.x, m.y + m.hitH + 2.4, m.z, 'Kombo ×' + n + ' +' + g, '#ffe2a0', n >= 30);
    sfx('combo', m.x, m.z, 1, n);
    if (n >= 50) achUnlock('combo50');
  }
}

// Treasure carriers. sackWave(k, level): whether wave k gets one (not the first wave, a horde or the boss wave).
function sackWave(k, level) { return k >= 2 && !isBossK(k) && !isHordeK(k, level) && (G.weekly === 'goblins' || rnd() < .42 + .04 * Math.min(level, 5)); }
function sackDie(m) {
  const g = sackGold(), y = G.B.heightAt(m.x, m.z);
  ECON.sacks++; if (inRun()) { META.stats.sacks = (META.stats.sacks || 0) + 1; if (META.stats.sacks >= 10) achUnlock('sacks'); }
  // Ash's gold burst throws its own coins at the gold counter (looks only), so the gold is simply paid; else coins drop.
  if (typeof FX.goldBurst === 'function') { G.gold += g; FX.goldBurst(m.x, m.z, 24, { y: y + .3 }); }
  else {
    dropCoins(m.x, y + .6, m.z, g, 12); fxSparks(m.x, y + .6, m.z, 26, 5, 2.4, 1.8, .4, { size: .07, grav: 7 }); fxTimed(5, m.x, y + .8, m.z, 2.6, 2.6, 2.2, 1.6, .5, .9, .3); }
  econPop(m.x, y + 2.6, m.z, '+' + g, '#ffd060', true);
  if (typeof UI.income === 'function') UI.income('Kullakott', g, '#ffd060');
  sfx('goldBurst', m.x, m.z, 1.1);
}
// A carrier that reaches the beacon takes no life: it steals some gold and is gone (leak() in 61-monsters.js calls this).
function sackEscape(m) {
  const g = Math.min(Math.max(0, Math.floor(G.gold)), Math.round((10 + 5 * G.level) * G.goldMul));
  ECON.sackLost++;
  if (g > 0) { pay(g); if (typeof UI.income === 'function') UI.income('Kott pääses', -g, '#ff7a5a'); }
  if (typeof UI.banner === 'function' && G.mode !== 'demo') UI.banner('Kullakott pääses minema!', 2, false);
  fxDust(m.x, m.y + .2, m.z, 6, .8); sfx('leak', m.x, m.z, .5);
  removeMonster(m);
}
// The carrier runs: a little faster while hurt, and it sparkles so it reads as treasure (the effects stream only).
function updateSacks(dt) {
  for (const m of G.mons) {
    if (!m.def.sack || m.dead || m.dying) continue;
    if (m.vis && frnd() < dt * 7) fxPart(m.x + frr(-.25, .25), m.y + frr(.6, 1.1), m.z + frr(-.25, .25), 0, frr(.3, .9), 0, frr(.3, .6), frr(.04, .07), 2.4, 1.9, .5, { drag: 1 });
  }
}

// The gold mine (TOWER.mine): no attack; the stat table holds its gold per wave. Ash's blueprint('mine', lvl) draws it.
function econTick(dt) { updateSacks(dt); }
