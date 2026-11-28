// Saarepagar audio mix table: loads merge/index.html in headless Chrome, plays a scene and measures the master output
// with AU.meter (merge/src/80-audio.js): integrated loudness (approx. LUFS), loudest 400 ms block, true peak, and the
// share of energy in five bands (sub < 150 Hz, low, mid, presence, air > 6 kHz). Also the Web Audio nodes made per
// second (n/s, a CPU proxy for weak phones), dropped sounds and the music's section. Scene 'combo' plays a merge combo
// climbing over the harbour music (merge, merge5, combo, lucky). v3: 'map', the six level chapters, 'tense' (few moves
// left), 'sfx3' (the level-mode sounds), 'wheel' (lucky wheel spin) and 'level' (a level session over its music).
// v3 phase B: the eight island tour themes (t_flower ... t_orchard), the four weekly events (ev_garden ... ev_beach),
// one board song in each season (s_winter ... s_autumn), 'sfx4' (the phase B sounds) and 'soak' (scene, season and
// sound changes every 2.5 s; then the music stops and every started source must have ended: live <= 2).
// Scenes without their own season play SEASON (default: autumn, so runs on different dates compare).
//   node tools/mergeaudio.js                 every scene (SECS each, default 20)
//   node tools/mergeaudio.js sfx mix aed     only these scenes
//   SECS=10 / LITE=1 / PHONE=1               shorter, the lite mode, a phone page (steeper low cut)
//   SEASON=winter                            the season layered on scenes that set none
// Fails (exit 1) on a page error, an audio error in AU.stats().err, a NaN written to an AudioParam, or a true peak above
// -1 dBFS; 'soak' also fails when sources are still live after the music stops.
const { chromium } = require('playwright');
const path = require('path');
const chrome = require('./chrome.js');
const ROOT = path.dirname(__dirname);
const only = process.argv.slice(2).filter(a => !a.startsWith('--'));
const SECS = +(process.env.SECS || 20);
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Every sound in a loop (the sound bank alone), and a busy play session (rapid merges over the music).
const ALL = `const L=[['pick'],['drop'],['swap'],['merge',{level:1}],['merge',{level:4}],['merge',{level:8}],['mergeMax',{level:10}],['merge5',{level:3}],['combo',{n:3}],['combo',{n:5}],['lucky'],['discover'],['mystery'],['event'],['hint'],['album'],['claim'],['spawn'],['noEnergy'],['bubble'],['bubblePop'],['chest'],['order'],['orderDone'],['coins',{n:4}],['stars',{n:5}],['taskDone'],['levelUp'],['daily'],['tap'],['open'],['close'],['sell'],['deny'],['talk',{who:'maali',ch:'a'}],['talk',{who:'muri',ch:'i'}],['talk',{who:'ants',ch:'o'}]];let i=0;setInterval(()=>{const x=L[i++%L.length];AU.sfx(x[0],x[1])},700);`;
const PLAY = `let k=0;setInterval(()=>{k++;AU.sfx('pick');setTimeout(()=>AU.sfx(k%3?'merge':'drop',{level:1+k%9}),250);if(k%4==0)setTimeout(()=>AU.sfx('spawn'),500);if(k%9==0)setTimeout(()=>AU.sfx('orderDone'),600);if(k%13==0)setTimeout(()=>AU.sfx('coins',{n:5}),900)},900);`;
const RAPID = `setInterval(()=>{for(let j=0;j<12;j++)setTimeout(()=>AU.sfx('merge',{level:1+j}),j*25);AU.sfx('mergeMax');AU.sfx('levelUp');AU.sfx('coins',{n:6})},1500);`;
const COMBO = `let k=0;setInterval(()=>{k++;const n=k%14;if(!n)return;AU.sfx(n%6==5?'merge5':'merge',{level:1+n%5});if(n>2&&n%3==0)setTimeout(()=>AU.sfx('combo',{n}),120);if(n==13)setTimeout(()=>AU.sfx('lucky'),300)},380);`;
const TALK = `const s='Tere, kullake! Kas sa aitad mul pagariäri korda teha?';let i=0,w=['maali','ants','muri','liisa','peeter','mina'];setInterval(()=>{const c=s[i%s.length];AU.sfx('talk',{who:w[Math.floor(i/s.length)%6],ch:c});i++},45);`;
// v3 level mode: the new sounds in a loop; the wheel (ticks slowing down, then a prize); a level session over the
// level music (merges, obstacles, a booster, the last moves going tense, then win or fail with stars).
const ALL3 = `const L=[['iceCrack'],['boxBreak'],['cobweb'],['booster',{kind:'wand'}],['booster',{kind:'scissors'}],['booster',{kind:'shuffle'}],['booster',{kind:'moves5'}],['wheelWin'],['wheelWin',{big:true}],['levelWin',{stars:1}],['levelWin',{stars:3}],['levelFail'],['star',{n:1}],['star',{n:2}],['star',{n:3}],['piggy'],['calendar'],['heart'],['movesLow']];let i=0;const go=()=>{const x=L[i++%L.length];AU.sfx(x[0],x[1]);setTimeout(go,/level|wheelWin|piggy|levelFail/.test(x[0])?2600:900)};go();`;
const WHEEL = `const spin=()=>{let t=0,d=40;for(let k=0;k<40;k++){const s=1-k/40;setTimeout(()=>AU.sfx('wheelTick',{speed:s}),t);t+=d;d*=1.07}setTimeout(()=>AU.sfx('wheelWin',{big:Math.random()<0.3}),t+250);setTimeout(spin,t+3000)};spin();`;
const LEVEL = `let k=0;setInterval(()=>{k++;const n=k%40;AU.sfx('pick');setTimeout(()=>AU.sfx('merge',{level:1+k%7}),220);if(k%5==0)setTimeout(()=>AU.sfx(['iceCrack','boxBreak','cobweb'][k%3]),400);if(n==12)AU.sfx('booster',{kind:'wand'});if(n==28){M.mood('tense');AU.sfx('movesLow')}if(n==30||n==32)AU.sfx('movesLow');if(n==34){M.mood('normal');AU.sfx(k%80<40?'levelWin':'levelFail',{stars:1+k%3})}if(n==36)AU.sfx('star',{n:1});if(n==37)AU.sfx('star',{n:2});if(n==38)AU.sfx('star',{n:3})},800);`;
// v3 phase B sounds, and a soak that keeps changing everything.
const ALL4 = `const L=[['passStep',{n:1}],['passStep',{n:2}],['passStep',{n:5}],['passStep',{n:30}],['styleSwap',{style:'boho'}],['styleSwap',{style:'minimal'}],['styleSwap',{style:'romantic'}],['wardrobe'],['pet',{kind:'muri'}],['pet',{kind:'kutsu'}],['pet',{kind:'janku'}],['eventCur',{n:3,week:'garden'}],['eventCur',{n:4,week:'fashion'}],['eventCur',{n:5,week:'wedding'}],['eventCur',{n:3,week:'beach'}],['photo'],['islandNew']];let i=0;const go=()=>{const x=L[i++%L.length];AU.sfx(x[0],x[1]);setTimeout(go,/islandNew|passStep/.test(x[0])?2200:900)};go();`;
const SOAK = `const SC=[['board',{tour:'flower'}],['event',{week:'fashion'}],['board',{area:'aed',tour:'nope'}],['level',{chapter:3}],['board',{tour:'xmas'}],['event',{week:'zzz'}],['map'],['board',{tour:{theme:'beach'}}],['event',{week:'wedding'}],['story'],['board',{tour:7}],['title'],['bogus',{x:1}],['event',{week:'beach'}],['board',{tour:'spa'}]],SE=['winter','spring','summer','autumn','sügis','nonsense','auto'],SX=['passStep','styleSwap','wardrobe','pet','eventCur','photo','islandNew','merge','nosuchsound','orderDone'];
let k=0;window.__soak=setInterval(()=>{k++;M.scene(SC[k%SC.length][0],SC[k%SC.length][1]);M.season(SE[k%SE.length]);for(let j=0;j<4;j++)setTimeout(()=>AU.sfx(SX[(k*4+j)%SX.length],{n:j+1,kind:['muri','kutsu','janku','x'][j],style:['boho','minimal','romantic',null][j]}),j*400);AU.sfx('styleSwap','boho');AU.sfx('pet',null);AU.sfx();},2500);`;
const SCENES = {
  title: { music: ['title'] },
  pagariari: { music: ['board', { area: 'pagariari' }] },
  aed: { music: ['board', { area: 'aed' }] },
  sadam: { music: ['board', { area: 'sadam' }] },
  tuuleveski: { music: ['board', { area: 'tuuleveski' }] },
  majakas: { music: ['board', { area: 'majakas' }] },
  saladus: { music: ['board', { area: 'saladus' }] },
  story: { music: ['story'] },
  sfx: { music: [null], js: ALL },
  mix: { music: ['board', { area: 'pagariari' }], js: PLAY },
  rapid: { music: ['board', { area: 'aed' }], js: RAPID },
  talk: { music: ['story'], js: TALK },
  combo: { music: ['board', { area: 'sadam' }], js: COMBO },
  map: { music: ['map'] },
  candy: { music: ['level', { chapter: 1 }] },
  meadow: { music: ['level', { chapter: 2 }] },
  berry: { music: ['level', { chapter: 3 }] },
  cliffs: { music: ['level', { chapter: 4 }] },
  winter: { music: ['level', { chapter: 5 }] },
  lavender: { music: ['level', { chapter: 6 }] },
  tense: { music: ['level', { chapter: 2, tense: true }] },
  sfx3: { music: [null], js: ALL3 },
  wheel: { music: ['map'], js: WHEEL },
  level: { music: ['level', { chapter: 1 }], js: LEVEL },
  t_flower: { music: ['board', { area: 'aed', tour: 'flower' }] },
  t_spa: { music: ['board', { tour: 'spa' }] },
  t_icecream: { music: ['board', { tour: 'icecream' }] },
  t_fashion: { music: ['board', { tour: 'fashion' }] },
  t_wedding: { music: ['board', { tour: 'wedding' }] },
  t_beach: { music: ['board', { tour: 'beach' }] },
  t_xmas: { music: ['board', { tour: 'xmas' }] },
  t_orchard: { music: ['board', { tour: 'orchard' }] },
  ev_garden: { music: ['event', { week: 'garden' }] },
  ev_fashion: { music: ['event', { week: 'fashion' }] },
  ev_wedding: { music: ['event', { week: 'wedding' }] },
  ev_beach: { music: ['event', { week: 'beach' }] },
  s_winter: { music: ['board', { area: 'aed' }], season: 'winter' },
  s_spring: { music: ['board', { area: 'aed' }], season: 'spring' },
  s_summer: { music: ['board', { area: 'aed' }], season: 'summer' },
  s_autumn: { music: ['board', { area: 'aed' }], season: 'autumn' },
  sfx4: { music: [null], js: ALL4 },
  soak: { music: ['board', { tour: 'flower' }], js: SOAK, secs: 60, soak: true },
};
const f1 = v => v === undefined || v === null ? '    -' : (v >= 0 ? ' ' : '') + v.toFixed(1).padStart(5);
(async () => {
  const browser = await chromium.launch({ executablePath: chrome.path, args: [...chrome.gl, '--autoplay-policy=no-user-gesture-required'] });
  const names = only.length ? only : Object.keys(SCENES), bad = [];
  console.log('scene         LUFS   mMax     TP  sub low mid pres air |  n/s drop | section / notes');
  for (const name of names) {
    const S = SCENES[name]; if (!S) { console.log('unknown scene', name); bad.push(name); continue; }
    const ctx = await browser.newContext(process.env.PHONE ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 400, height: 700 } });
    await ctx.addInitScript(() => { // count NaN or Infinity written to any AudioParam
      window.__nan = 0; const P = AudioParam.prototype;
      for (const fn of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime']) { const o = P[fn]; P[fn] = function (v, t, c) { if (!isFinite(v) || !isFinite(t) || (c !== undefined && !isFinite(c))) window.__nan++; return o.apply(this, arguments); }; }
    });
    const page = await ctx.newPage(), errs = [];
    page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await page.goto('file://' + ROOT + '/merge/index.html');
    await sleep(500);
    await page.evaluate(l => { const AU = window.__saAudio; if (l) AU.setLite(l === '1'); AU.unlock(); }, process.env.LITE || '');
    await page.evaluate(s => window.__saMusic.season(s), S.season || process.env.SEASON || 'autumn');
    await page.evaluate(m => window.__saMusic.scene(m[0], m[1]), S.music);
    if (S.js) await page.evaluate('(()=>{const AU=window.__saAudio,M=window.__saMusic;' + S.js + '})()');
    await sleep(2500);
    await page.evaluate(() => window.__saAudio.meter(true));
    await sleep((S.secs || SECS) * 1000);
    const r = await page.evaluate(() => window.__saAudio.stats());
    const m = r.meter || {}, b = m.bands || {};
    const peakBad = m.tp > -1, nan = await page.evaluate(() => window.__nan);
    let soakNote = '';
    if (S.soak) { // stop everything, let the tails ring out, then nothing may still be playing
      const liveBefore = r.live;
      await page.evaluate(() => { clearInterval(window.__soak); window.__saMusic.stop(); });
      await sleep(8000);
      const after = await page.evaluate(() => window.__saAudio.stats());
      soakNote = ` | soak live ${liveBefore} -> ${after.live} after stop, made ${after.made}` + (after.err ? ' AUDIO ERR ' + after.err : '');
      if (after.live > 2 || after.err) bad.push(name);
    }
    if (r.err || errs.length || peakBad || !r.ready || nan) bad.push(name);
    console.log(name.padEnd(11), f1(m.lufs), f1(m.mMax), f1(m.tp), ['sub', 'low', 'mid', 'pres', 'air'].map(k => String(b[k] === undefined ? '-' : b[k]).padStart(k.length > 3 ? 4 : 3)).join(' '), '|',
      String(r.nodeRate).padStart(4), String(r.dropped).padStart(4), '|', (r.section || '-') + (r.lite ? ' [lite]' : '') + ' ' + r.season + (r.ready ? '' : ' NOT READY ' + r.state) + (nan ? ' NaN x' + nan : '') + soakNote + (peakBad ? ' PEAK > -1 dBFS' : '') + (r.err ? ' | AUDIO ERR ' + r.err : '') + (errs.length ? ' | PAGE ERR ' + errs.join('; ') : ''));
    await ctx.close();
  }
  await browser.close();
  console.log(bad.length ? 'FAIL: ' + bad.join(', ') : 'PASS');
  process.exit(bad.length ? 1 : 0);
})();
