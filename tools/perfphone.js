// Low-end phone budget: runs the game in a phone profile with the CPU slowed down (like a budget Android) and
// reports JS milliseconds per frame, split into the simulation, the HUD/UI canvas and the 3D frame submit.
//   node tools/perfphone.js                 throttle 4x, quiet scene and a crowded wave
//   THROTTLE=6 node tools/perfphone.js      slower CPU
//   TIER=low node tools/perfphone.js        graphics tier (if GFX exists): low | mid | high | ultra
// GPU time is not measured (software GL here); the numbers are for CPU-side regressions. Compare before and after.
const { chromium, devices } = require('playwright');
const path = require('path');
const ROOT = path.dirname(__dirname), RATE = +(process.env.THROTTLE || 4), TIER = process.env.TIER || '';

(async () => {
  const b = await chromium.launch({ args: require('./chrome.js').gl });
  const ctx = await b.newContext({ ...devices['Pixel 7'], deviceScaleFactor: 2 });
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await p.goto('file://' + ROOT + '/index.html#seed=4&level=3&ff=40');
  await p.waitForFunction(() => window.__cw && window.__cw.G.phase === 'play', null, { timeout: 90000 });
  if (TIER) await p.evaluate(t => { if (typeof GFX !== 'undefined' && GFX.set) GFX.set(t); else if (window.__cw.GFX) window.__cw.GFX.set(t); }, TIER);
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
  const measure = (label, n) => p.evaluate(([label, n]) => {
    const w = window.__cw, { G, UI } = w, t = { sim: [], ui: [], gl: [] };
    for (let i = 0; i < n; i++) {
      const a = performance.now(); w.step(1 / 30);
      const b = performance.now(); w.render();
      const c = performance.now(); UI.draw();
      const d = performance.now();
      t.sim.push(b - a); t.gl.push(c - b); t.ui.push(d - c);
    }
    const med = a => { const s = a.slice().sort((x, y) => x - y); return +s[s.length >> 1].toFixed(1); }, p95 = a => { const s = a.slice().sort((x, y) => x - y); return +s[Math.floor(s.length * .95)].toFixed(1); };
    return { label, alive: G.mons.filter(m => !m.dead).length, sim: med(t.sim), simP95: p95(t.sim), gl: med(t.gl), ui: med(t.ui), total: +(med(t.sim) + med(t.gl) + med(t.ui)).toFixed(1) };
  }, [label, n]);
  const out = [];
  out.push(await measure('quiet', 40));
  await p.evaluate(() => { const { G, spawnMonster } = window.__cw; for (let i = 0; i < 160; i++) spawnMonster(['skel', 'rat', 'wolf', 'bat', 'knight'][i % 5], { s: 1 + (i % 40) * .35 }); });
  out.push(await measure('crowd', 40));
  console.log(`CPU throttle ${RATE}x${TIER ? ', tier ' + TIER : ''} (ms per frame, median; sim p95 too)`);
  for (const r of out) console.log(`  ${r.label.padEnd(6)} alive ${String(r.alive).padStart(3)}  sim ${r.sim} (p95 ${r.simP95})  3D ${r.gl}  UI ${r.ui}  = ${r.total}`);
  if (errs.length) console.log('page errors:\n  ' + errs.join('\n  '));
  await b.close(); process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
