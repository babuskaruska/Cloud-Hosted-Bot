// Regression check: smoke-tests every land, runs headless balance sims with the AI commander,
// and measures render cost. Usage:
//   node tools/qa.js                 run everything, print a report, compare with tools/qa-baseline.json
//   node tools/qa.js --save          also save the results as the new baseline
//   node tools/qa.js --quick         fewer seeds, shorter sims
// Exit code 1 on any page exception or failed check.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.dirname(__dirname), BASE = path.join(__dirname, 'qa-baseline.json'), SHOTS = path.join(__dirname, 'shots');
const argv = process.argv.slice(2), QUICK = argv.includes('--quick'), SAVE = argv.includes('--save');
const LANDS = ['ashen', 'frost', 'fen', 'ember', 'dunes'];
const SIM_SECONDS = QUICK ? 600 : 1500, SEEDS = QUICK ? [3] : [3, 11, 27];
const chrome = require('./chrome.js');
fs.mkdirSync(SHOTS, { recursive: true });

async function page(browser, hash, errs) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errs.push(hash + ': ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(hash + ': console: ' + m.text()); });
  await p.goto('file://' + ROOT + '/index.html#' + hash);
  await p.waitForFunction(() => window.__cw, null, { timeout: 60000 });
  return p;
}

// Simulates `secs` of game time at 1/30 s steps, sampling stats as it goes.
const SIM = (secs) => {
  const { G, step, MON } = window.__cw; const st = { maxMons: 0, maxWave: 0, upgrades: 0, builds: 0, bossKills: 0, defeats: 0, minLives: G.lives, goldEarned: 0, lands: new Set(), nanSeen: false, phases: {}, boards: [] };
  let lastGold = G.gold, lastPhase = G.phase;
  for (let i = 0; i < secs * 30; i++) {
    step(1 / 30);
    const alive = G.mons.filter(m => !m.dead).length; if (alive > st.maxMons) st.maxMons = alive;
    const w = G.level * (G.wavesPerLand || 5) + Math.max(1, G.k); if (w > st.maxWave) st.maxWave = w;
    if (G.gold > lastGold) st.goldEarned += G.gold - lastGold; lastGold = G.gold;
    if (G.phase !== lastPhase) { st.phases[G.phase] = (st.phases[G.phase] || 0) + 1; if (G.phase === 'defeat') st.defeats++; if (G.phase === 'clear') { st.bossKills++; const tw = G.towers.filter(t => t.alive); st.boards.push({ towers: tw.length, levels: tw.reduce((a, t) => a + t.lvl, 0), maxed: tw.filter(t => t.lvl >= t.def.cost.length - 1).length, pads: G.B.pads.length }); } lastPhase = G.phase; }
    if (G.lives < st.minLives) st.minLives = G.lives;
    st.lands.add(G.B.bio && G.B.bio.key);
    if (i % 300 === 0) for (const m of G.mons) if (!isFinite(m.x) || !isFinite(m.z) || !isFinite(m.hp)) st.nanSeen = true;
  }
  const tw = G.towers.filter(t => t.alive);
  st.towers = tw.length; st.towerLevels = tw.reduce((a, t) => a + t.lvl, 0); st.maxedTowers = tw.filter(t => t.lvl >= (t.def.cost.length - 1)).length;
  st.lands = [...st.lands]; st.lives = G.lives; st.gold = G.gold; st.slain = G.slain; st.level = G.level;
  const S = G.stats || {}; st.branches = S.branches || 0; st.spells = S.spells || 0; st.statDetail = S; st.press = +(G.press || 0).toFixed(2);
  return st;
};

(async () => {
  const t0 = Date.now(), errs = [], fails = [], out = { smoke: {}, sims: {}, perf: {} };
  const browser = await chromium.launch({ executablePath: chrome.path, args: chrome.gl });
  // 1. Smoke: each land, a later wave and a boss wave, rendered and screenshotted.
  for (const land of LANDS) {
    const p = await page(browser, `seed=5&biome=${land}&ff=${QUICK ? 20 : 45}&manual=1`, errs);
    const r = await p.evaluate(() => { const { G, tick } = window.__cw; for (let i = 0; i < 30; i++) tick(1 / 30, i % 10 === 0); tick(1 / 30, true); return { lives: G.lives, mons: G.mons.length, towers: G.towers.length, phase: G.phase }; });
    await p.screenshot({ path: path.join(SHOTS, 'qa-' + land + '.png') });
    out.smoke[land] = r; if (!(r.lives > 0)) fails.push(land + ': lost all lives in the first ' + (QUICK ? 20 : 45) + ' s');
    await p.close();
  }
  { // boss wave on a later level
    const p = await page(browser, `seed=8&biome=frost&level=1&k=7&ff=40&manual=1`, errs);
    out.smoke.boss = await p.evaluate(() => { const { G, tick } = window.__cw; for (let i = 0; i < 20; i++) tick(1 / 30, i % 5 === 0); return { phase: G.phase, k: G.k, mons: G.mons.length }; });
    await p.screenshot({ path: path.join(SHOTS, 'qa-boss.png') }); await p.close();
  }
  // 2. Balance sims with the AI commander.
  for (const seed of SEEDS) {
    const p = await page(browser, `seed=${seed}&manual=1`, errs);
    const st = await p.evaluate(SIM, SIM_SECONDS);
    out.sims[seed] = st;
    if (st.nanSeen) fails.push('seed ' + seed + ': NaN monster position or hp');
    if (!st.branches && !QUICK) fails.push('seed ' + seed + ': the AI bought no tower branch');
    if (!st.spells) fails.push('seed ' + seed + ': the AI cast no spell');
    await p.close();
  }
  // 3. Render cost (relative only; software GL here).
  { const p = await page(browser, `seed=4&ff=60&manual=1&noscale=1`, errs);
    out.perf = await p.evaluate(() => { const { G, R, bench } = window.__cw; return { msPerFrame: bench(20), calls: R.renderer.info.render.calls, mons: G.mons.length }; });
    await p.close(); }
  await browser.close();

  // Report and compare.
  const base = fs.existsSync(BASE) ? JSON.parse(fs.readFileSync(BASE, 'utf8')) : null;
  console.log('Smoke:'); for (const k in out.smoke) console.log('  ' + k.padEnd(6), JSON.stringify(out.smoke[k]));
  console.log('Sims (' + SIM_SECONDS + ' s each, AI commander):');
  for (const s in out.sims) { const a = out.sims[s], b = base && base.sims && base.sims[s];
    const f = k => a[k] + (b && b[k] !== undefined && b[k] !== a[k] ? ' (was ' + b[k] + ')' : '');
    console.log(`  seed ${s}: wave ${f('maxWave')}, lives ${f('lives')} (min ${f('minLives')}), defeats ${f('defeats')}, bosses ${f('bossKills')}, towers ${f('towers')}, levels ${f('towerLevels')}, maxed ${f('maxedTowers')}, gold earned ${f('goldEarned')}, max alive ${f('maxMons')}`);
    console.log(`    branches ${f('branches')}, spells ${f('spells')}, press ${f('press')}: ` + JSON.stringify(a.statDetail));
    console.log('    end of each battlefield (towers/levels/maxed of pads): ' + a.boards.map(x => x.towers + '/' + x.levels + '/' + x.maxed + ' of ' + x.pads).join('  ')); }
  console.log('Perf:', JSON.stringify(out.perf), base && base.perf ? '(baseline ' + JSON.stringify(base.perf) + ')' : '');
  if (errs.length) { console.log('\nPAGE ERRORS:'); for (const e of [...new Set(errs)].slice(0, 20)) console.log('  ' + e); fails.push(errs.length + ' page errors'); }
  console.log('\nScreenshots: tools/shots/qa-*.png   Time: ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
  if (SAVE && !QUICK) { fs.writeFileSync(BASE, JSON.stringify(out, null, 1)); console.log('Saved baseline.'); }
  if (fails.length) { console.log('FAIL:\n  ' + fails.join('\n  ')); process.exit(1); } else console.log('PASS');
})().catch(e => { console.error(e); process.exit(1); });
