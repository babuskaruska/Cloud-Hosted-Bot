// Menu-flow QA: real clicks (desktop) and taps (iPhone 13) through
//   title -> Campaign -> (Heat) -> Begin -> story -> play -> pause -> Abandon -> results -> Main menu -> title
//   title -> Campaign -> play -> defeat (lives forced to 0) -> cinematic -> results -> Main menu -> title
// Fails on any page error, a missing button, or a screen that never shows.
//   node tools/menuqa.js            both profiles
//   node tools/menuqa.js desktop    one profile (desktop | phone)
// Shots go to tools/shots/menuqa-<profile>-<step>.png.
const { chromium, devices } = require('playwright');
const path = require('path'), fs = require('fs');
const ROOT = path.dirname(__dirname), SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const only = process.argv[2];
const PROFILES = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: { ...devices['iPhone 13'] },
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run(name) {
  const browser = await chromium.launch({ args: [...require('./chrome.js').gl, '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ ...PROFILES[name], deviceScaleFactor: 1 });
  const page = await ctx.newPage(), errors = [], log = [];
  page.on('pageerror', e => errors.push(String(e.stack || e).slice(0, 600)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
  const touch = name === 'phone';
  const step = msg => { log.push(msg); console.log(`[${name}] ${msg}`); };
  const shot = async n => { await page.screenshot({ path: path.join(SHOTS, `menuqa-${name}-${n}.png`) }); };
  const state = () => page.evaluate(() => { const w = window.__cw; if (!w) return null; return { scr: w.UI.scr, story: w.STORY.on(), mode: w.G.mode, phase: w.G.phase, cine: !!(w.CINE && w.CINE.on && w.CINE.on()), btns: w.UI.btns.concat(w.UI.hud || []).map(b => b.id) }; });
  async function waitFor(fn, what, ms = 20000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { const s = await state(); if (s && fn(s)) return s; await sleep(150); }
    const s = await state(); throw new Error(`timeout waiting for ${what}; state ${JSON.stringify(s)}`);
  }
  async function press(id) {
    const s = await waitFor(s => s.btns.includes(id), 'button ' + id);
    const p = await page.evaluate(id => { const w = window.__cw, d = w.R.dpr || 1, b = w.UI.btns.concat(w.UI.hud || []).find(b => b.id === id); return b && [(b.x + b.w / 2) / d, (b.y + b.h / 2) / d]; }, id);
    if (!p) throw new Error('button vanished: ' + id + ' ' + JSON.stringify(s));
    if (touch) await page.touchscreen.tap(p[0], p[1]); else await page.mouse.click(p[0], p[1]);
    step(`press ${id} at ${p.map(Math.round)}`);
    await sleep(350);
  }
  // Story panels and the tutorial: advance with taps / Enter until the board is ours.
  async function clearStory() {
    for (let i = 0; i < 40; i++) {
      const s = await state(); if (!s.story) return;
      if (touch) { const vp = page.viewportSize(); await page.touchscreen.tap(vp.width / 2, vp.height * .5); } else await page.keyboard.press('Enter');
      await sleep(300);
    }
    throw new Error('story never closed');
  }
  async function startCampaign() {
    await waitFor(s => s.scr === 'title' && s.btns.includes('mcamp'), 'title screen');
    await press('mcamp');
    const s = await waitFor(s => s.scr !== 'title' || s.mode === 'campaign', 'leaving title');
    if (s.scr === 'heat') await press('hgo');
    if ((await state()).scr === 'confirm') await press('cyes');
    await waitFor(s => s.mode === 'campaign', 'campaign mode');
    await sleep(800); await clearStory();
    if ((await state()).scr === 'arrival') await press('abegin');
    await clearStory();
    // The demo board crumbles and the campaign land rises; story or the arrival card can show on the way.
    for (let i = 0; i < 6; i++) {
      const s = await waitFor(s => s.mode === 'campaign' && (s.phase === 'play' || s.story || s.scr === 'arrival'), 'campaign play', 120000);
      if (s.story) await clearStory(); else if (s.scr === 'arrival') await press('abegin'); else if (!s.scr) { await sleep(600); if ((await state()).btns.includes('tutskip')) { await press('tutskip'); await clearStory(); } return; }
    }
    throw new Error('never reached the campaign board');
  }

  try {
    await page.goto('file://' + ROOT + '/index.html');
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await waitFor(s => s.scr === 'title', 'title', 30000); await sleep(1500); await shot('1-title');
    // Path A: abandon from the pause menu.
    await startCampaign(); step('campaign started');
    await sleep(4000); await shot('2-play');
    const ph = await state(); if (ph.phase !== 'play' && ph.phase !== 'build') step('note: phase ' + ph.phase);
    await press('gear'); // in a run the gear opens the pause menu
    await waitFor(s => s.scr === 'pause', 'pause menu'); await shot('3-pause');
    await press('pquit');
    await waitFor(s => s.scr === 'confirm', 'abandon confirm'); await press('cyes');
    await waitFor(s => s.scr === 'results', 'results after abandon', 60000); await sleep(2500); await shot('4-results');
    await press('rmenu');
    await waitFor(s => s.scr === 'title', 'title after results'); step('back on title (path A)');
    // Path B: a real defeat.
    await startCampaign(); step('campaign started again');
    await sleep(1500);
    await page.evaluate(() => { window.__cw.G.lives = 0; });
    let sawCine = false;
    await waitFor(s => { if (s.cine) sawCine = true; return s.scr === 'results'; }, 'results after defeat', 120000);
    step('defeat -> results' + (sawCine ? ' (cinematic seen)' : ''));
    await sleep(2500); await shot('5-defeat-results');
    await press('rmenu');
    await waitFor(s => s.scr === 'title', 'title after defeat'); step('back on title (path B)');
    await shot('6-title-again');
  } catch (e) { errors.push('FLOW: ' + e.message); try { await shot('fail'); } catch (_) {} }
  await browser.close();
  return { name, errors };
}

(async () => {
  const names = only ? [only] : Object.keys(PROFILES), res = [];
  for (const n of names) res.push(await run(n));
  let bad = 0;
  for (const r of res) { if (r.errors.length) { bad++; console.log(`\n[${r.name}] FAIL\n  ` + r.errors.join('\n  ')); } else console.log(`[${r.name}] ok`); }
  console.log(bad ? 'FAIL' : 'PASS'); process.exit(bad ? 1 : 0);
})();
