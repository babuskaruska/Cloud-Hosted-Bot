// Audio mix table: plays each scene of the real game in headless Chrome and measures the master output with
// AU.meter (src/80-audio.js): integrated loudness (approx. LUFS), true peak, loudest momentary block, and the share
// of energy in five bands (sub < 150 Hz, low, mid, presence, air > 6 kHz). Also lists the sounds each scene played.
//   node tools/audiomix.js                 every scene, 25 s each (about 9 minutes)
//   node tools/audiomix.js boss eclipse    only these scenes
//   SECS=10 node tools/audiomix.js         shorter windows      PHONE=1  a phone-sized page (the phone low cut)
//   --json                                 also print the table as JSON at the end
//   STYLE=classic                          the classic soundtrack (default: the game's default, chip)   LITE=1 / LITE=0  force the lite mode
// The notes column also gives the Web Audio nodes made per second (n/s), a CPU proxy for weak phones.
// Fails (exit 1) on a page error or an audio fault recorded in AU.stats().err.
// Scenes that need a monster Mira has not added yet (the Hollow Herald) put in a stand-in so the sound can be heard.
const { chromium } = require('playwright');
const path = require('path');
const chrome = require('./chrome.js');
const ROOT = path.dirname(__dirname);
const argv = process.argv.slice(2), JSON_OUT = argv.includes('--json'), only = argv.filter(a => !a.startsWith('--'));
const SECS = +(process.env.SECS || 25);
const sleep = ms => new Promise(r => setTimeout(r, ms));
// A Hollow Herald if the game has none yet: the giant's body under the herald's name (audio keys on m.type).
const HERALD = 'if(!window.__cw.MON.herald)window.__cw.MON.herald=Object.assign({},window.__cw.MON.giant,{name:"Hollow Herald",rig:"giant"});';
const SCENES = {
  title: { hash: '', pre: 4000 },
  ashen: { hash: 'seed=4&biome=ashen&ff=40' },
  frost: { hash: 'seed=4&biome=frost&ff=40' },
  fen: { hash: 'seed=4&biome=fen&ff=40' },
  ember: { hash: 'seed=4&biome=ember&ff=40' },
  dunes: { hash: 'seed=4&biome=dunes&ff=40' },
  storm: { hash: 'seed=4&biome=storm&ff=40' },
  proc: { hash: 'seed=7&biome=proc&ff=40' },
  horde: { hash: 'seed=4&biome=ember&level=2&k=3&ff=3', check: 'G.horde' },
  boss: { hash: 'seed=4&biome=frost&k=7&ff=3', check: 'AU.stats().boss' },
  herald: { hash: 'seed=4&biome=ashen&level=7&ff=3', js: HERALD + 'G.mods=[];setTimeout(()=>{const m=window.__cw.spawnMonster("herald");m.vis=true;window.__heraldM=m;setTimeout(()=>AU.play("snuff",0,1,0),2600);setTimeout(()=>AU.play("snuff",0.3,1,0),9000)},1500)', pre: 1500, check: 'AU.stats().boss+" sting:"+AU.stats().names.bossSting+" snuff:"+AU.stats().names.snuff' },
  heraldDie: { hash: 'seed=4&biome=ashen&level=7&ff=3', js: HERALD + 'G.mods=[];setTimeout(()=>{const m=window.__cw.spawnMonster("herald");m.vis=true;setTimeout(()=>{window.__cw.hitMonster(m,1e7,"fire");m.dying=Math.min(m.dying,.1)},5000)},500)', pre: 4500, secs: 8, check: '"die:"+AU.stats().names.bossDie' },
  eclipse: { hash: 'seed=4&biome=fen&ff=30', js: 'window.__cwEndless.setMods(["eclipse"])', check: 'AU.stats().eclipse+" ecl:"+AU.stats().live.ecl' },
  fen0: { hash: 'seed=4&biome=fen&ff=30', js: 'window.__cwEndless.setMods([])' },
  eclOff: { hash: 'seed=4&biome=fen&ff=30', js: 'window.__cwEndless.setMods(["eclipse"]); setTimeout(()=>window.__cwEndless.setMods([]), 12000)', check: 'AU.stats().eclipse+" ecl:"+AU.stats().live.ecl' },
  siege: { hash: 'seed=4&biome=ashen&level=3&ff=3', js: 'window.__cwEndless.setMods(["siege","echoes","bloodmoon"]);setInterval(()=>{if(G.phase==="play"&&!G.spawning&&G.nextIn>.4)G.nextIn=.05},2000)', check: '"k:"+G.k+" mods:"+G.mods+" horn:"+AU.stats().names.siegeHorn+" rise:"+AU.stats().names.echoRise' },
  ghost: { hash: 'seed=4&biome=ashen&ff=30', js: 'setTimeout(()=>G.mons.slice(0,6).forEach(m=>m.echo=true),3500)', check: '"rise:"+AU.stats().names.echoRise' },
  daily: { hash: '', click: ['mdaily', 'cyes?'], pre: 50, check: 'G.mode+" sting:"+AU.stats().names.dailySting' },
  story: { hash: 'seed=4&biome=fen&ff=5', js: 'G.paused=true;AU.setScene("story");let n=0;setInterval(()=>{if(n++<6)AU.storyLine(n%3?"keeper":"ghost","Tere, Hoidja! Laternad kustuvad.")},3000)', pre: 2000, check: 'AU.stats().chip' },
  count: { hash: 'seed=4&biome=ashen&ff=3', js: 'G.paused=true;for(let i=0;i<7;i++)setTimeout(()=>AU.play(i<6?"countTick":"countGo",0,1,i<6?6-i:0),3000+i*1000)', pre: 1500, secs: 12, check: '"tick:"+AU.stats().names.countTick+" go:"+AU.stats().names.countGo' },
  win: { hash: 'seed=4&biome=ashen&ff=5', js: 'G.paused=true;AU.setScene("results","win")', pre: 2000 },
  defeat: { hash: 'seed=4&biome=ashen&ff=5', js: 'G.paused=true;AU.setScene("results","defeat")', pre: 2000 },
};
const f1 = v => v === undefined || v === null ? '   -' : (v >= 0 ? ' ' : '') + v.toFixed(1);
(async () => {
  const browser = await chromium.launch({ executablePath: chrome.path, args: [...chrome.gl, '--autoplay-policy=no-user-gesture-required'] });
  const names = only.length ? only : Object.keys(SCENES), out = {}, bad = [];
  console.log('scene      LUFS  mMax    TP  sub low mid pres air | notes');
  for (const name of names) {
    const S = SCENES[name]; if (!S) { console.log('unknown scene', name); bad.push(name); continue; }
    const ctx = await browser.newContext(process.env.PHONE ? { viewport: { width: 390, height: 300 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { viewport: { width: 400, height: 250 } });
    const page = await ctx.newPage(), errs = [];
    page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await page.goto('file://' + ROOT + '/index.html' + (S.hash ? '#' + S.hash : ''));
    await sleep(1500);
    await page.evaluate(() => window.__cwAudio.unlock());
    if (process.env.STYLE) await page.evaluate(s => window.__cwAudio.setStyle && window.__cwAudio.setStyle(s), process.env.STYLE);
    if (process.env.LITE) await page.evaluate(l => window.__cwAudio.setLite && window.__cwAudio.setLite(l === '1'), process.env.LITE);
    for (let id of (S.click || [])) {
      await sleep(1500);
      const opt = id.endsWith('?'); id = id.replace('?', ''); // a trailing ? marks a button that may not show (a confirm)
      const p = await page.evaluate(id => { const w = window.__cw, d = w.R.dpr || 1, b = w.UI.btns.concat(w.UI.hud || []).find(b => b.id === id); return b && [(b.x + b.w / 2) / d, (b.y + b.h / 2) / d]; }, id);
      if (p) await page.mouse.click(p[0], p[1]); else if (!opt) errs.push('no button ' + id);
    }
    if (S.js) await page.evaluate('(()=>{const G=window.__cw.G,AU=window.__cwAudio;' + S.js + '})()');
    await sleep(S.pre || 3000);
    await page.evaluate(() => window.__cwAudio.meter(true));
    const n0 = await page.evaluate(() => Object.assign({}, window.__cwAudio.stats().names));
    await sleep((S.secs || SECS) * 1000);
    const r = await page.evaluate(chk => { const G = window.__cw.G, AU = window.__cwAudio, s = AU.stats(); let c = null; try { c = chk ? eval(chk) : null; } catch (e) { c = 'check failed: ' + e.message; } return { m: s.meter, names: s.names, chk: c, err: s.err, nr: s.nodeRate, chip: s.chip }; }, S.check || null);
    const top = Object.keys(r.names).map(k => [k, r.names[k] - (n0[k] || 0)]).filter(a => a[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 5).map(a => a[0] + ':' + a[1]).join(' ');
    const m = r.m || {}, b = m.bands || {};
    out[name] = Object.assign({ chk: r.chk }, m);
    if (r.err || errs.length) bad.push(name);
    console.log(name.padEnd(9), f1(m.lufs), f1(m.mMax), f1(m.tp), ['sub', 'low', 'mid', 'pres', 'air'].map(k => String(b[k] === undefined ? '-' : b[k]).padStart(k.length > 3 ? 4 : 3)).join(' '), '|',
      (r.chk !== null ? r.chk + ' | ' : '') + 'n/s:' + r.nr + (r.chip ? ' [' + r.chip + ']' : '') + ' | ' + top + (r.err ? ' | AUDIO ERR ' + r.err : '') + (errs.length ? ' | PAGE ERR ' + errs.join('; ') : ''));
    await ctx.close();
  }
  await browser.close();
  if (JSON_OUT) console.log(JSON.stringify(out, null, 1));
  console.log(bad.length ? 'FAIL: ' + bad.join(', ') : 'PASS');
  process.exit(bad.length ? 1 : 0);
})();
