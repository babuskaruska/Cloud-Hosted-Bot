// The Long Night: land mutators and boss affixes that pile up with depth (and Heat).
// G.mods = keys active on the current land. modMul(stat) is the product of every active mutator's multiplier
// for that stat; game code reads it at a few hook points (wave budget, elite chance, tower range, monster speed,
// damage monsters take, bounty). Campaign lands (level < 6) roll none unless Heat asks for some (G.heatMods).
const MUTATORS = {
  bloodmoon: { name: 'Blood Moon', tip: 'Elites come twice as often.', icon: 'moon', curse: 1, m: { elite: 2.2 } },
  swarm: { name: 'Swarm', tip: 'A third more monsters in every wave.', icon: 'swarm', curse: 1, m: { budget: 1.35 } },
  ironhide: { name: 'Ironhide', tip: 'Monsters take a fifth less damage.', icon: 'shield', curse: 1, m: { dmgIn: .8 } },
  fog: { name: 'Hollow Fog', tip: 'Towers see less far.', icon: 'fog', curse: 1, m: { range: .86 } },
  haste: { name: 'Haste', tip: 'Monsters move faster.', icon: 'boot', curse: 1, m: { spd: 1.15 } },
  volatile: { name: 'Volatile', tip: 'Some monsters burst when they die, hurting what stands near.', icon: 'bomb', curse: 1, m: {} },
  famine: { name: 'Famine', tip: 'Monsters drop less gold.', icon: 'coin', curse: 1, m: { bounty: .72 } },
  plague: { name: 'Plague', tip: 'Monsters heal when they are left alone.', icon: 'skull', curse: 1, m: {} },
  titan: { name: 'Titan', tip: 'The boss is bigger, tougher and carries an extra power.', icon: 'crown', curse: 1, m: {} },
  gilded: { name: 'Gilded', tip: 'A boon: monsters drop more gold.', icon: 'coin', boon: 1, m: { bounty: 1.3 } },
  kindled: { name: 'Kindled', tip: 'A boon: monsters take more damage.', icon: 'flame', boon: 1, m: { dmgIn: 1.15 } },
};
const BOSS_AFFIX = {
  warded: { name: 'Warded', tip: 'A ward soaks damage and returns every 20 s.' },
  swift: { name: 'Swift', tip: 'Moves faster.' },
  regen: { name: 'Undying', tip: 'Heals when left alone.' },
};
G.mods = []; G.modM = {}; G.modLevel = -1; G.heatMods = G.heatMods || 0;
function modOn(k) { return G.mods.indexOf(k) >= 0; }
function modMul(stat) { const v = G.modM[stat]; return v === undefined ? 1 : v; }
function modCount(level) { const deep = level < 6 ? 0 : Math.min(5, 1 + Math.floor((level - 6) / 3)); return deep + (G.heatMods | 0); }
function setMods(keys) {
  G.mods = keys.slice(); G.modM = {};
  for (const k of G.mods) { const M = MUTATORS[k]; if (!M) continue; for (const s in M.m) G.modM[s] = (G.modM[s] === undefined ? 1 : G.modM[s]) * M.m[s]; }
}
// Rolls this land's mutators from the gameplay random stream (deterministic per run). Returns the keys.
function rollMods(level) {
  const n = modCount(level), curses = Object.keys(MUTATORS).filter(k => MUTATORS[k].curse), boons = Object.keys(MUTATORS).filter(k => MUTATORS[k].boon), out = [];
  for (let i = 0; i < n && curses.length; i++) { const j = Math.floor(rnd() * curses.length); out.push(curses[j]); curses.splice(j, 1); }
  if (n > 0 && level >= 6 && rnd() < .35) out.push(boons[Math.floor(rnd() * boons.length)]);
  setMods(out);
  return out;
}
function bossAffixes(level) { return level < 6 ? 0 : Math.min(3, 1 + Math.floor((level - 6) / 6)) + (modOn('titan') ? 1 : 0); }

function updateEndless(dt) {
  if (G.phase !== 'play') return;
  if (G.modLevel !== G.level) {
    G.modLevel = G.level;
    const keys = rollMods(G.level);
    if (keys.length) { G.bountyMul *= modMul('bounty'); if (UI.banner && !UI.mutCard) UI.banner(keys.map(k => MUTATORS[k].name).join(' · '), 3.2, false); }
  }
  const plague = modOn('plague');
  for (const m of G.mons) {
    if (m.dead || m.hp <= 0) continue;
    if (m.def.boss && !m.affixed && G.level >= 6) bossEmpower(m);
    if (m.affix) {
      if (m.affix.regen && G.t - m.hitAt > 2) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * .012 * dt);
      if (m.affix.warded) { m.wardT = (m.wardT || 0) - dt; if (m.wardT <= 0 && !(m.ward > 0)) { m.wardT = 20; m.ward = m.wardMax = m.maxHp * .22; } }
    }
    if (plague && !m.def.boss && G.t - m.hitAt > 2.5 && m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * .03 * dt);
  }
}
function bossEmpower(m) {
  m.affixed = true; const n = bossAffixes(G.level); if (!n) return;
  if (modOn('titan')) { m.hp *= 1.5; m.maxHp *= 1.5; m.scale *= 1.15; }
  const keys = Object.keys(BOSS_AFFIX), pick = [];
  for (let i = 0; i < n && keys.length; i++) { const j = Math.floor(rnd() * keys.length); pick.push(keys[j]); keys.splice(j, 1); }
  m.affix = {}; for (const k of pick) m.affix[k] = 1;
  if (m.affix.swift) m.spdMul = (m.spdMul || 1) * 1.25;
  if (m.affix.warded) { m.wardT = 20; m.ward = m.wardMax = m.maxHp * .22; }
  m.affixName = pick.map(k => BOSS_AFFIX[k].name).join(' ') + ' ' + m.def.name;
  if (UI.banner) UI.banner(m.affixName, 3, true);
}
// Called from killMonster: Volatile bursts (they reuse the sapper chain, so they can set each other off).
function modOnKill(m) {
  if (!modOn('volatile') || m.def.boss || m.small || rnd() >= .22) return;
  G.chain.push({ t: rr(.25, .45), x: m.x, y: m.y, z: m.z, ex: { r: 1.3, dmg: 22 * (1 + .25 * G.level), men: 18 * (1 + .2 * G.level) } });
}
window.__cwEndless = { MUTATORS, BOSS_AFFIX, rollMods, setMods, modOn, modMul };
