// Achievements: feats a keeper earns once, kept in META.ach[id] (saved with the rest of the meta in 66-meta.js).
// achUnlock(id) is idempotent: the first time it shows a toast and plays sfx('achievement'). Only real runs earn them
// (never the AI demo behind the menu or a test session's run), except the Keeper's Tree ones, which are bought.
// The Codex lists them in its Achievements tab; the results screen names the ones earned in the run.
//
// Hooks: achLandStart() / achLandClear() from metaLandStart / metaLandClear, achTree() after a purchase,
// achBanked(res) from bankRun, achTick(dt) from MENU.update (polls the rest twice a second), achToastTick(dt) and achDraw() for the toast.
const ACH = [
  { id: 'light', name: 'First Light', tip: 'Clear your first land.', icon: 'flame' },
  { id: 'six', name: 'Six Fires', tip: 'Beat the campaign.', icon: 'lantern' },
  { id: 'flawless', name: 'Untouched', tip: 'Clear a land without letting a single monster through.', icon: 'shield' },
  { id: 'lastember', name: 'Last Ember', tip: 'Clear a land with 3 lives or fewer left.', icon: 'ember' },
  { id: 'horde', name: 'Wall of Fire', tip: 'Beat a horde wave with no leaks.', icon: 'swarm' },
  { id: 'giants', name: 'Giantsbane', tip: 'Slay 10 bosses.', icon: 'crown' },
  { id: 'slay1k', name: 'Gravedigger', tip: 'Slay 1,000 monsters.', icon: 'skull' },
  { id: 'slay10k', name: 'The Boneyard', tip: 'Slay 10,000 monsters.', icon: 'skull' },
  { id: 'elites', name: 'Elite Hunter', tip: 'Slay 100 elites.', icon: 'star' },
  { id: 'night3', name: 'Into the Dark', tip: 'Reach the third land of the Long Night.', icon: 'moon' },
  { id: 'night10', name: 'Lantern in the Deep', tip: 'Reach the tenth land of the Long Night.', icon: 'moon' },
  { id: 'heat3', name: 'Kindling', tip: 'Clear a land at Heat 3 or higher.', icon: 'heat' },
  { id: 'heat5', name: 'Wildfire', tip: 'Clear a land at Heat 5 or higher.', icon: 'heat' },
  { id: 'heat10', name: 'Endless Night', tip: 'Clear a land at Heat 10.', icon: 'heat' },
  { id: 'cursed', name: 'Unbothered', tip: 'Clear a land under 3 or more curses.', icon: 'fog' },
  { id: 'oc', name: 'White Hot', tip: 'Overcharge a tower to its limit.', icon: 'upgrade' },
  { id: 'branches', name: 'Master Builder', tip: 'Have 4 branched towers standing on one land.', icon: 'guard' },
  { id: 'spells', name: 'Stormcaller', tip: 'Cast 12 spells on one land.', icon: 'meteor' },
  { id: 'hoard', name: "Dragon's Hoard", tip: 'Hold 3,000 gold at once.', icon: 'coin' },
  { id: 'codex', name: 'Naturalist', tip: 'Meet 20 kinds of monster.', icon: 'banner' },
  { id: 'daily', name: 'Daybreak', tip: 'Finish a Daily Long Night.', icon: 'hourglass' },
  { id: 'tree10', name: 'Rooted', tip: "Learn 10 levels in the Keeper's Tree.", icon: 'ember' },
  { id: 'treemax', name: 'Fully Grown', tip: "Learn every upgrade in the Keeper's Tree to the top.", icon: 'star' },
];
const ACH_BY = {}; for (const a of ACH) ACH_BY[a.id] = a;
const ACHQ = []; // toasts waiting: { a, t }
const achCount = () => ACH.filter(a => META.ach[a.id]).length;

function achUnlock(id, any) {
  const a = ACH_BY[id]; if (!a || META.ach[id] || !(any || inRun())) return false;
  META.ach[id] = 1; if (META.run && META.run.ach) META.run.ach.push(id); saveMeta();
  ACHQ.push({ a, t: 0 }); sfx('achievement', CAM.x, CAM.z, 1);
  return true;
}

const ACHL = { spells0: 0, t: 0 }; // the current land's starting counts
function achLandStart() { ACHL.spells0 = (G.stats && G.stats.spells) || 0; }
function achLandClear() {
  if (!inRun()) return;
  achUnlock('light');
  if (META.run && META.run.mode === 'campaign' && G.level === CAMPAIGN_LANDS - 1) achUnlock('six');
  if (!G.leaks) achUnlock('flawless');
  if (G.lives <= 3) achUnlock('lastember');
  if (G.heat >= 3) achUnlock('heat3'); if (G.heat >= 5) achUnlock('heat5'); if (G.heat >= 10) achUnlock('heat10');
  if (Array.isArray(G.mods) && typeof MUTATORS === 'object' && G.mods.filter(k => MUTATORS[k] && MUTATORS[k].curse).length >= 3) achUnlock('cursed');
  if (META.stats.bosses >= 10) achUnlock('giants');
}
function achTree() {
  let n = 0, all = true; for (const u of UPGRADES) { const l = META.up[u.key] || 0; n += l; if (l < u.max) all = false; }
  if (n >= 10) achUnlock('tree10', true); if (all) achUnlock('treemax', true);
}
function achBanked(res) { if (res && res.mode === 'daily') achUnlock('daily'); }
function achTick(dt) {
  if (!inRun() || G.phase !== 'play') return;
  ACHL.t -= dt; if (ACHL.t > 0) return; ACHL.t = .5;
  const S = META.stats, runSlain = G.runStats ? G.slain - G.runStats.slain0 : 0;
  if (S.slain + runSlain >= 1000) achUnlock('slay1k'); if (S.slain + runSlain >= 10000) achUnlock('slay10k');
  if (S.elites >= 100) achUnlock('elites');
  if (nightMode(G.mode)) { const d = nightDepth(); if (d >= 3) achUnlock('night3'); if (d >= 10) achUnlock('night10'); }
  let br = 0; for (const t of G.towers) { if (!t.alive) continue; if (t.branch) br++; if ((t.oc || 0) >= OC_MAX) achUnlock('oc'); }
  if (br >= 4) achUnlock('branches');
  if (((G.stats && G.stats.spells) || 0) - ACHL.spells0 >= 12) achUnlock('spells');
  if (G.gold >= 3000) achUnlock('hoard');
  let seen = 0; for (const k in META.seen) if (META.seen[k]) seen++; if (seen >= 20) achUnlock('codex');
}

// The toast: a small plate sliding down under the top of the screen, one feat at a time.
const ACH_TOAST = 3.6;
function achToastTick(dt) { const q = ACHQ[0]; if (q) { q.t += dt; if (q.t > ACH_TOAST) ACHQ.shift(); } }
function achDraw(ctx, E) {
  const q = ACHQ[0]; if (!q) return; const D = ACH_TOAST;
  const c = UI.COLR, s = E.s, ps = Math.max(2, s - (E.tch ? 1 : 0)), p = 4 * ps, L = PX.LINE * ps, a = q.a;
  const head = 'Achievement', ic = PX.iconSize(a.icon)[0] ? a.icon : 'star', [iw, ih] = PX.iconSize(ic), ik = ps * 2;
  const tw = Math.max(PX.measure(head) * ps, PX.measure(a.name) * ps), w = Math.min(E.Wr - E.iL - 8 * s, iw * ik + 3 * p + tw), h = Math.max(ih * ik, 2 * L) + 2 * p;
  const k = Math.min(sat(q.t * 4), sat((D - q.t) * 3)), e = 1 - (1 - k) * (1 - k);
  const x = Math.round((E.iL + E.Wr) / 2 - w / 2), y = Math.round(E.iT + 4 * s + (UI.scr ? 0 : 26 * s) - (1 - e) * (h + 10 * s));
  ctx.globalAlpha = e;
  ctx.save(); ctx.shadowColor = 'rgba(255,170,80,0.55)'; ctx.shadowBlur = 10 * s * (.6 + .4 * Math.sin(q.t * 5)); UI.plate(x, y, w, h, { bd: c.bdHi, bg: 'rgba(30,22,12,0.96)' }); ctx.restore();
  PX.icon(ctx, ic, x + p, y + Math.round((h - ih * ik) / 2), ik, 1);
  const tx0 = x + 2 * p + iw * ik, ty = y + Math.round((h - 2 * L) / 2) + ps;
  PX.text(ctx, head, tx0, ty, ps, c.dim); PX.text(ctx, a.name, tx0, ty + L, ps, c.amber);
  ctx.globalAlpha = 1;
}
