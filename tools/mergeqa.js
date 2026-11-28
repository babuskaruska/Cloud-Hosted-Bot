// Saarepagar QA: loads merge/index.html fresh on desktop and an iPhone 13 profile, plays the opening with REAL input
// (taps on the oven, finger/mouse drags held for several frames, order and task buttons), plays on with the test
// hook, reloads to check the save, and fails on page errors or a stuck flow. Shots: tools/shots/mergeqa-<profile>-*.png
//   node tools/mergeqa.js [desktop|phone|promax]
const { chromium, devices } = require('playwright');
const path = require('path');
const ROOT = path.dirname(__dirname), only = process.argv[2];
const PROFILES = { desktop: { viewport: { width: 1280, height: 800 } }, phone: { ...devices['iPhone 13'] }, promax: { viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run(name) {
  const b = await chromium.launch({ args: require('./chrome.js').gl });
  const ctx = await b.newContext(PROFILES[name]), p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 400)));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  const touch = name !== 'desktop', cdp = touch ? await ctx.newCDPSession(p) : null;
  const shot = n => p.screenshot({ path: path.join(__dirname, 'shots', `mergeqa-${name}-${n}.png`) });
  const down = async (x, y) => touch ? cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }) : (p.mouse.move(x, y), p.mouse.down());
  const move = async (x, y) => touch ? cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] }) : p.mouse.move(x, y);
  const up = async () => touch ? cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) : p.mouse.up();
  const tap = async (x, y) => { await down(x, y); await sleep(120); await up(); await sleep(250); };
  const drag = async (a, c) => { await down(a[0], a[1]); await sleep(80); for (let i = 1; i <= 8; i++) { await move(a[0] + (c[0] - a[0]) * i / 8, a[1] + (c[1] - a[1]) * i / 8); await sleep(30); } await sleep(80); await up(); await sleep(300); };
  const centre = i => p.evaluate(i => { const r = window.__mg.cellRect(i); return r && [r.x + r.s / 2, r.y + r.s / 2]; }, i);
  const S = () => p.evaluate(() => { const s = window.__mg.S; return { coins: s.coins, xp: s.xp, energy: s.energy, done: Object.keys(s.done || {}).length, orders: s.ordersDone || 0 }; }).catch(() => null);
  let ok = true;
  try {
    await p.goto('file://' + ROOT + '/merge/index.html#fresh=1');
    await p.waitForFunction(() => window.__mg, null, { timeout: 30000 }); await sleep(1500); await shot('1-start');
    // Real input: find the oven and two equal items, tap, drag-merge.
    let merges = 0;
    for (let k = 0; k < 12; k++) {
      const plan = await p.evaluate(() => {
        const m = window.__mg, cells = m.S.board;
        let gen = -1; const seen = {};
        for (let i = 0; i < cells.length; i++) { const c = cells[i]; if (!c) continue; if (m.GENERATORS[c.k]) { if (gen < 0) gen = i; continue; } if (c.b || !m.Game.canMerge || !m.CHAINS[c.k]) continue; const key = c.k + ':' + c.l; if (seen[key] !== undefined) return { a: seen[key], b: i }; seen[key] = i; }
        return { gen };
      });
      if (plan.a !== undefined) { const before = await p.evaluate(() => window.__mg.S.board.filter(Boolean).length); await drag(await centre(plan.a), await centre(plan.b)); const after = await p.evaluate(() => window.__mg.S.board.filter(Boolean).length); if (after < before) merges++; }
      else if (plan.gen >= 0) await tap(...(await centre(plan.gen)));
      if (await p.evaluate(() => { const m = window.__mg; return !!(m.UI && (m.UI.dialog || m.UI.modal)); })) await p.evaluate(() => { const a = window.__mg.act; a.skipDialog && a.skipDialog(); a.closeModal && a.closeModal(); });
    }
    if (!merges) { errs.push('FLOW: no merge happened from real drags'); }
    await shot('2-merged');
    // Play on with the hook for a while (orders, tasks), then reload and check the save.
    await p.evaluate(async () => { const a = window.__mg.act; for (let i = 0; i < 300; i++) { try { a.skipDialog && a.skipDialog(); a.closeModal && a.closeModal(); a.autoMerge && a.autoMerge(); const M = window.__mg; (M.S.orders || []).forEach((o, oi) => a.fulfill(oi)); const ar = M.AREAS[M.S.area]; const t = ar && ar.tasks.find(t => !M.S.done[t.id]); if (t) a.doTask(t.id); const g = M.S.board.findIndex(c => c && M.GENERATORS[c.k]); if (g >= 0) a.tapGen(g); } catch (e) {} await new Promise(r => setTimeout(r, 5)); } a.save && a.save(); });
    const s1 = await S(); await shot('3-played');
    await p.reload(); await p.waitForFunction(() => window.__mg, null, { timeout: 30000 }); await sleep(1200);
    const s2 = await S(); await shot('4-reloaded');
    if (!s1 || !s2 || s2.coins !== s1.coins || s2.xp !== s1.xp) errs.push('SAVE: state changed after reload ' + JSON.stringify([s1, s2]));
    console.log(`[${name}] real merges ${merges}; after play ${JSON.stringify(s1)}`);
  } catch (e) { errs.push('FLOW: ' + e.message); }
  await b.close();
  if (errs.length) { ok = false; console.log(`[${name}] FAIL\n  ` + errs.join('\n  ')); } else console.log(`[${name}] ok`);
  return ok;
}
(async () => { let ok = true; for (const n of only ? [only] : Object.keys(PROFILES)) ok = (await run(n)) && ok; console.log(ok ? 'PASS' : 'FAIL'); process.exit(ok ? 0 : 1); })();
