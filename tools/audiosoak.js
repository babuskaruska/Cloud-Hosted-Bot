// Audio soak: loops the real menus with clicks (or taps) and checks the audio stays flat over a long session.
//   title -> Campaign -> play -> pause -> Settings -> resume -> tab hidden and back -> defeat -> results -> Main menu
// Each cycle prints the audio state at each stop and the live node counts back at the title (AU.stats().live).
// Fails (exit 1) on a page error, an audio fault (AU.stats().err), a NaN written to any AudioParam, a context that
// does not suspend while hidden or resume after, or live counts at the title that grow from the first cycle to the last
// (the crowd, choir and eclipse beds are flags: 0 or 1).
//   node tools/audiosoak.js               4 cycles, desktop
//   node tools/audiosoak.js 8 phone       8 cycles on an iPhone 13 profile with taps
//   STYLE=classic node tools/audiosoak.js  the classic soundtrack (default: chip)
const { chromium, devices } = require('playwright');
const path = require('path');
const chrome = require('./chrome.js');
const ROOT = path.dirname(__dirname);
const N = +(process.argv[2] || 4), prof = process.argv[3] || 'desktop';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: chrome.path, args: [...chrome.gl, '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext(prof === 'phone' ? { ...devices['iPhone 13'], deviceScaleFactor: 1 } : { viewport: { width: 900, height: 560 } });
  await ctx.addInitScript(() => { // count any NaN or Infinity written to an AudioParam, with where it came from
    window.__nan = 0; window.__nanWhere = [];
    const P = AudioParam.prototype, note = (w) => { window.__nan++; if (window.__nanWhere.length < 5) window.__nanWhere.push(w + ' ' + new Error().stack.split('\n')[3]); };
    for (const fn of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime']) {
      const o = P[fn]; P[fn] = function (v, t, c) { if (!isFinite(v) || !isFinite(t) || (c !== undefined && !isFinite(c))) note(fn); return o.apply(this, arguments); };
    }
    const d = Object.getOwnPropertyDescriptor(P, 'value');
    Object.defineProperty(P, 'value', { get: d.get, set(v) { if (!isFinite(v)) note('value'); d.set.call(this, v); } });
  });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e.stack || e).slice(0, 300)));
  const touch = prof === 'phone';
  const state = () => page.evaluate(() => { const w = window.__cw; if (!w) return null; return { scr: w.UI.scr, story: w.STORY.on(), mode: w.G.mode, phase: w.G.phase, btns: w.UI.btns.concat(w.UI.hud || []).map(b => b.id) }; });
  async function waitFor(fn, what, ms = 30000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const s = await state(); if (s && fn(s)) return s; await sleep(150); } throw new Error('timeout ' + what + ' ' + JSON.stringify(await state())); }
  async function press(id) {
    await waitFor(s => s.btns.includes(id), 'button ' + id);
    const p = await page.evaluate(id => { const w = window.__cw, d = w.R.dpr || 1, b = w.UI.btns.concat(w.UI.hud || []).find(b => b.id === id); return b && [(b.x + b.w / 2) / d, (b.y + b.h / 2) / d]; }, id);
    if (touch) await page.touchscreen.tap(p[0], p[1]); else await page.mouse.click(p[0], p[1]);
    await sleep(350);
  }
  async function clearStory() { for (let i = 0; i < 40; i++) { const s = await state(); if (!s.story) return; if (touch) { const vp = page.viewportSize(); await page.touchscreen.tap(vp.width / 2, vp.height * .5); } else await page.keyboard.press('Enter'); await sleep(300); } }
  async function startCampaign() {
    await waitFor(s => s.scr === 'title' && s.btns.includes('mcamp'), 'title');
    await press('mcamp');
    const s = await waitFor(s => s.scr !== 'title' || s.mode === 'campaign', 'leaving title');
    if (s.scr === 'heat') await press('hgo');
    if ((await state()).scr === 'confirm') await press('cyes');
    await waitFor(s => s.mode === 'campaign', 'campaign');
    await sleep(800); await clearStory();
    for (let i = 0; i < 8; i++) {
      const s = await waitFor(s => s.mode === 'campaign' && (s.phase === 'play' || s.story || s.scr === 'arrival'), 'play', 120000);
      if (s.story) await clearStory(); else if (s.scr === 'arrival') await press('abegin'); else if (!s.scr) { await sleep(600); if ((await state()).btns.includes('tutskip')) { await press('tutskip'); await clearStory(); } return; }
    }
  }
  const au = () => page.evaluate(() => { const s = window.__cwAudio.stats(); return { scene: s.scene, voices: s.voices, live: s.live, state: s.state, err: s.err, paused: s.paused, nan: window.__nan, where: window.__nanWhere }; });
  const setHidden = h => page.evaluate(h => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); document.dispatchEvent(new Event('visibilitychange')); }, h);
  const titles = [];
  try {
    await page.goto('file://' + ROOT + '/index.html');
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await waitFor(s => s.scr === 'title', 'title'); await sleep(1000);
    if (touch) await page.touchscreen.tap(20, 20); else await page.mouse.click(5, 5); // a gesture unlocks the audio
    await sleep(800);
    if (process.env.STYLE) await page.evaluate(s => window.__cwAudio.setStyle(s), process.env.STYLE);
    for (let c = 0; c < N; c++) {
      await startCampaign(); await sleep(3000);
      await press('gear'); await waitFor(s => s.scr === 'pause', 'pause');
      await press('pset'); await sleep(900);
      const aPause = await au();
      await page.keyboard.press('Escape'); await sleep(500);
      if ((await state()).scr === 'pause') await press('presume');
      await sleep(1500);
      await setHidden(true); await sleep(700); const aHid = await au();
      await setHidden(false); await sleep(1200); const aBack = await au();
      if (aHid.state === 'running') errors.push('cycle ' + c + ': context still running while hidden');
      if (aBack.state !== 'running') errors.push('cycle ' + c + ': context ' + aBack.state + ' after the tab came back');
      await page.evaluate(() => { window.__cw.G.lives = 0; });
      await waitFor(s => s.scr === 'results', 'results', 120000); await sleep(3000);
      const aRes = await au();
      await press('rmenu'); await waitFor(s => s.scr === 'title', 'title again'); await sleep(2500);
      const aT = await au(); titles.push(aT);
      if (aT.err) errors.push('audio: ' + aT.err);
      console.log(`cycle ${c} | pause ${aPause.paused} ${aPause.scene} | hidden ${aHid.state} | back ${aBack.state} | results ${aRes.scene} v${aRes.voices} | title v${aT.voices} nan ${aT.nan} live ${JSON.stringify(aT.live)}`);
    }
  } catch (e) { errors.push('FLOW ' + e.message); }
  const last = titles[titles.length - 1];
  if (last && last.nan) errors.push('NaN written to AudioParams: ' + last.nan + ' ' + last.where.join(' | '));
  if (titles.length > 1) { // what is left running at the title must not grow (act: voices still ringing, allowed to vary a little)
    const a = titles[0].live, b = last.live;
    const FLAG = { choir: 1, crowd: 1, ecl: 1, chipP: 3 }; // beds that exist or not: built when needed, so only more than the limit is a leak (chipP: the chip players, the live one and up to two fading)
    for (const k of Object.keys(b)) if (FLAG[k] ? b[k] > FLAG[k] : b[k] > (a[k] || 0) + (k === 'act' || k === 'actList' ? 4 : 0)) errors.push(`live.${k} grew ${a[k]} -> ${b[k]}`);
  }
  console.log(errors.length ? 'FAIL\n' + errors.join('\n') : `PASS (${titles.length} cycles, ${prof})`);
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
