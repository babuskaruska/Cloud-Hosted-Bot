// Saarepagar art gallery (Ash): builds a test page from merge/src art + fx files and screenshots it.
//   node tools/artgallery.js [items|gens|scenes|people|ui|fx|all] [dpr]
// Shots go to tools/shots/art-<mode>-<dpr>x.png. The page itself: tools/shots/artgallery.html#<mode>
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.dirname(__dirname), SRC = path.join(ROOT, 'merge', 'src'), OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const files = fs.readdirSync(SRC).filter(f => /^(2\d|40)-.*\.js$/.test(f)).sort();
const code = files.map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');
const gallery = `
const cv = document.getElementById('cv'), d = window.devicePixelRatio || 1, mode = location.hash.slice(1) || 'items';
const W = innerWidth, Hh = { items: 1500, gens: 900, scenes: 1700, people: 520, ui: 900, fx: 700, env: 1580, sky: 920, tour: 1720, styles: 1300, wardrobe: 1100, events: 860, postcard: 860 }[mode] || 956;
cv.width = W * d; cv.height = Hh * d; cv.style.width = W + 'px'; cv.style.height = Hh + 'px';
document.body.style.height = Hh + 'px';
const g = cv.getContext('2d'); g.scale(d, d);
ART.bg(g, W, Hh, 0);
g.font = '700 12px system-ui'; g.fillStyle = '#6b3a22';
function label(t, x, y) { g.fillStyle = '#6b3a22'; g.textAlign = 'left'; g.fillText(t, x, y); }
const S = +(new URLSearchParams(location.search).get('s') || 64);
if (mode === 'items') {
  let y = 20;
  for (const ch of ART.chains.concat(['energia', 'kirst', 'raha'])) {
    label(ch, 8, y + 10); const n = ART.maxLevel(ch);
    for (let i = 1; i <= n; i++) { const x = 8 + (i - 1) * (S + 10); ART.cell(g, x, y + 16, S + 6, 'empty'); g.drawImage(ART.item(ch, i, S * d), x + 3, y + 19, S, S); g.fillStyle='#8a6a4a'; g.font='10px system-ui'; g.fillText(ART.labels[ch][i-1], x + 2, y + S + 32); g.font = '700 12px system-ui'; }
    y += S + 44;
  }
} else if (mode === 'gens') {
  let y = 20;
  for (const k of ART.generators) {
    label(k, 8, y + 10);
    for (let i = 1; i <= ART.maxLevel(k); i++) { const x = 8 + (i - 1) * (S + 12); ART.cell(g, x, y + 16, S + 6, i === 1 ? 'hint' : 'empty'); g.drawImage(ART.item(k, i, S * d), x + 3, y + 19, S, S); }
    y += S + 32;
  }
} else if (mode === 'scenes') {
  const areas = ART.areas, h = +(new URLSearchParams(location.search).get('h') || 200); let y = 10;
  const step = +(new URLSearchParams(location.search).get('p') || 0);
  for (const a of areas) {
    const nf = ART.sceneFeatures[a].length, states = [0, Math.ceil(nf / 2), nf];
    const pst = states[step] != null ? states[step] : nf;
    ART.scene(g, a, ART.sceneFeatures[a].slice(0, pst), 0, y, W, h, 1.3); if (step === 3) { ART.scene(g, a, new Set(Object.keys(ART.sceneMap).filter(k => ART.areaKey(ART.sceneMap[k][0]) === a).slice(0, 2)), 0, y, W, h, 1.3); }
    label(a + ' ' + pst + '/' + nf, 8, y + 14); y += h + 10;
  }
} else if (mode === 'people') {
  const who = ['maali', 'ants', 'muri', 'liisa', 'peeter', 'mina'];
  who.forEach((w, i) => { const x = 10 + (i % 3) * 130, y = 10 + Math.floor(i / 3) * 150; g.drawImage(ART.portrait(w, 120 * d), x, y, 120, 120); label(w, x + 40, y + 136); });
  who.forEach((w, i) => { g.drawImage(ART.portrait(w, 48 * d), 10 + i * 56, 320, 48, 48); });
} else if (mode === 'ui') {
  { const lw = Math.min(W - 40, 420); ART.logo(g, W / 2 - lw / 2, 40, lw, 1); }
  const st = ['paper', 'wood', 'button', 'buttonHot', 'buttonBlue', 'buttonPink', 'buttonGrey', 'glass', 'ribbon'];
  st.forEach((s, i) => { ART.panel(g, 30 + (i % 2) * 180, 170 + Math.floor(i / 2) * 70, 150, 50, s); label(s, 40 + (i % 2) * 180, 200 + Math.floor(i / 2) * 70); });
  const ic = Object.keys(ART.iconDefs); ic.forEach((n, i) => { const x = 10 + (i % 8) * 46, y = 470 + Math.floor(i / 8) * 60; g.drawImage(ART.icon(n, 40 * d), x, y, 40, 40); g.font='9px system-ui'; label(n, x, y + 52); g.font='700 12px system-ui'; });
  ['empty', 'locked', 'hint', 'target'].forEach((s, i) => ART.cell(g, 10 + i * 60, 640, 54, s));
  g.drawImage(ART.item('pagar', 6, 54 * d), 250, 640, 54, 54); g.drawImage(ART.bubble(54 * d), 250, 640, 54, 54);
  ART.panel(g, 10, 700, W - 20, 160, 'paper'); g.drawImage(ART.portrait('maali', 120 * d), 20, 720, 120, 120);
} else if (mode === 'fx') {
  window.UI = { hudPos: n => ({ coins: [W - 60, 20], stars: [W - 140, 20], energy: [60, 20] })[n] };
  FX.quality = 2; let t = 0; const img = ART.item('pagar', 4, 64 * d);
  FX.merge(100, 200, 'bread', 3); FX.merge(280, 200, 'bread', 10); FX.combo(100, 330, 4); FX.lucky(300, 330); FX.discover(200, 110); FX.hint(360, 90); if (/lv/.test(location.search)) FX.levelUp(); FX.coins(100, 400, 6); FX.stars(280, 400, 3); FX.energy(200, 500, 4); FX.spawn(60, 600, 300, 560, img);
  const NF = +(new URLSearchParams(location.search).get('f') || 12); for (let i = 0; i < NF; i++) FX.update(1 / 60);
  ART.bg(g, W, Hh, 0); FX.draw(g); const sq = FX.squash(100, 200); label('squash ' + (sq ? sq.map(v=>v.toFixed(2)).join(',') : 'none'), 10, 680);
  label('live ' + FX.count(), 200, 680);
} else if (mode === 'map') {
  // one chapter: background, path through 12 nodes in all states, a divider
  const qs = new URLSearchParams(location.search), ch = +(qs.get('c') || 0), scroll = +(qs.get('y') || 0), tt = +(qs.get('t') || 1.2);
  ART.mapBg(g, ch, 0, 0, W, Hh, tt, scroll);
  const pts = []; for (let i = 0; i < 11; i++) pts.push({ x: W / 2 + Math.sin(i * 1.1) * W * .26, y: Hh - 60 - i * 86 });
  const cur = 5; ART.mapPath(g, pts, tt, { done: cur });
  pts.forEach((p, i) => { const n = (+(qs.get('n') || 1)) + i, st = i < cur ? 'done' : i === cur ? 'current' : i === cur + 1 ? 'open' : 'locked'; ART.mapNode(g, p.x, p.y, 26, st, i < cur ? [3, 2, 1, 3, 0][i % 5] : 0, n, tt); });
  label(ART.mapTheme(ch).name, 8, 16);
} else if (mode === 'themes') {
  const n = ART.mapThemes.length, hh = Hh / n;
  for (let i = 0; i < n; i++) { ART.mapBg(g, i, 0, i * hh, W, hh, 1.2, 300); if (i) ART.mapDivider(g, i, 0, i * hh, W, 1); else label(ART.mapTheme(0).name, 8, 16); }
} else if (mode === 'obst') {
  let y = 14; const s = 64;
  const row = (title, list) => { label(title, 8, y + 8); list.forEach((f, i) => { const x = 6 + i * (s + 8); f(x, y + 16); }); y += s + 40; };
  const kinds = ['ice', 'box', 'cobweb', 'lockedCrate', 'sand', 'bubble'];
  row('obstacles state 0 (over item)', kinds.map(k => (x, yy) => { ART.cell(g, x, yy, s, 'empty'); if (k === 'ice' || k === 'cobweb') g.drawImage(ART.item('bread', 4, s * d), x + 4, yy + 4, s - 8, s - 8); g.drawImage(ART.obstacle(k, s * d, 0), x, yy, s, s); }));
  row('state 1', kinds.map(k => (x, yy) => { ART.cell(g, x, yy, s, 'empty'); if (k === 'ice' || k === 'cobweb') g.drawImage(ART.item('flower', 5, s * d), x + 4, yy + 4, s - 8, s - 8); g.drawImage(ART.obstacle(k, s * d, 1), x, yy, s, s); }));
  row('state 2', kinds.map(k => (x, yy) => { ART.cell(g, x, yy, s, 'empty'); if (k === 'ice' || k === 'cobweb') g.drawImage(ART.item('berry', 3, s * d), x + 4, yy + 4, s - 8, s - 8); g.drawImage(ART.obstacle(k, s * d, 2), x, yy, s, s); }));
  row('boosters', ['wand', 'scissors', 'shuffle', 'moves5'].map(k => (x, yy) => g.drawImage(ART.booster(k, s * d), x, yy, s, s)).concat([(x, yy) => g.drawImage(ART.booster('wand', s * d, true), x, yy, s, s), (x, yy) => g.drawImage(ART.booster('moves5', s * d, true), x, yy, s, s)]));
  row('key + new icons', [(x, yy) => { ART.cell(g, x, yy, s, 'empty'); g.drawImage(ART.item('key', 1, s * d), x + 3, yy + 3, s - 6, s - 6); }].concat(['piggy', 'calendar', 'heart', 'wheel', 'map'].map(k => (x, yy) => g.drawImage(ART.icon(k, s * d), x, yy, s, s))));
  row('icons 2', ['crown', 'moves', 'trophy', 'rest', 'key', 'streak'].map(k => (x, yy) => g.drawImage(ART.icon(k, s * d), x, yy, s, s)));
  row('unknown item keys (fallback)', ['kass', 'cake3', 'goalX', 'teddy', 'ribbon', 'zzz'].map((k, i) => (x, yy) => { ART.cell(g, x, yy, s, 'empty'); g.drawImage(ART.item(k, i + 1, s * d), x + 3, yy + 3, s - 6, s - 6); }));
  label('idle: ' + JSON.stringify(ART.itemIdle(3, 1.7)), 8, y + 10);
} else if (mode === 'wheel') {
  const sl = [{ icon: 'coin', label: '50' }, { icon: 'energy', label: '20' }, { icon: 'wand', label: '1' }, { icon: 'star', label: '3' }, { icon: 'coin', label: '200' }, { icon: 'heart', label: '∞ 15 min' }, { icon: 'shuffle', label: '1' }, { icon: 'gift', label: 'Kingitus' }];
  ART.wheel(g, W / 2, 330, Math.min(190, W * .43), sl, +(new URLSearchParams(location.search).get('a') || 0), 1);
  label('index ' + ART.wheelIndex(0, 8) + ' ' + ART.wheelIndex(-Math.PI / 4, 8), 8, 16);
  ART.wheel(g, W / 2 - 100, 740, 90, sl.slice(0, 6), .5, 1.4);
  ART.wheel(g, W / 2 + 100, 740, 90, sl.slice(0, 4).concat(sl.slice(0, 4), sl.slice(0, 4)), 1, 1.4);
} else if (mode === 'win' || mode === 'fail' || mode === 'fx2') {
  window.UI = { hudPos: n => ({ coins: [W - 60, 20], stars: [W - 140, 20], energy: [60, 20] })[n] };
  const qs = new URLSearchParams(location.search); FX.quality = +(qs.get('q') || 2);
  const NF = +(qs.get('f') || 40), img = ART.item('bread', 4, 64 * d);
  if (mode === 'win') FX.levelWin({ stars: 3 });
  else if (mode === 'fail') FX.levelFail();
  else { FX.iceCrack(80, 140, 70); FX.boxBreak(220, 140, 70); FX.obstacleClear('cobweb', 360, 140, 70); FX.obstacleClear('sand', 80, 330, 70); FX.obstacleClear('bubble', 220, 330, 70); FX.obstacleClear('lockedCrate', 360, 330, 70);
    FX.boosterUse('wand', 90, 560); FX.boosterUse('scissors', 220, 560); FX.boosterUse('moves5', 350, 560); FX.boosterUse('shuffle', W / 2, 800); FX.rainbowLink(60, 680, 380, 700); }
  for (let i = 0; i < NF; i++) FX.update(1 / 60);
  ART.mapBg(g, 1, 0, 0, W, Hh, 1, 0);
  if (mode === 'fx2') for (let i = 0; i < 5; i++) { const x = 40 + i * 80, y = 450; ART.cell(g, x - 32, y - 32, 64, 'empty'); const tf = ART.itemIdle(i, 1 + i * .3); g.save(); g.translate(x, y + 30); g.rotate(tf.rot); g.scale(tf.sx, tf.sy); g.drawImage(img, -30, -60 + tf.dy, 60, 60); g.restore(); FX.idle(g, x, y, 60, i, 2.3 + i * 1.7); }
  FX.draw(g); label('live ' + FX.count() + ' f' + NF, 8, Hh - 10);
} else if (mode === 'env') {
  // one area (a=<area or tour theme>) at six hours and four weathers; q=<FX quality>
  const qs = new URLSearchParams(location.search), a = qs.get('a') || 'pagariari', hh = +(qs.get('h') || 150); window.FX && (FX.quality = +(qs.get('q') || 2));
  const rows = [[.12, 'clear'], [.24, 'clear'], [.5, 'clear'], [.74, 'clear'], [.8, 'clear'], [.87, 'clear'], [.5, 'rain'], [.5, 'snow'], [.5, 'petals'], [.95, 'snow']];
  const isTour = ART.tourThemes && ART.tourThemes.indexOf(a) >= 0;
  rows.forEach((r, i) => { const o = { tod: r[0], weather: r[1] }, y = 6 + i * (hh + 6);
    if (isTour) ART.tourScene(g, ART.tourDemo(ART.tourThemes.indexOf(a)), 99, 0, y, W, hh, 2.1 + i, o); else ART.scene(g, a, 99, 0, y, W, hh, 2.1 + i, o);
    label(a + ' tod ' + r[0] + ' ' + r[1] + ' ' + ART.env(o).phase, 8, y + 14); });
} else if (mode === 'tour') {
  // all 8 island themes; p=<tasks done of n> (default all), n=<tasks per island>, c=<cycle>, tod=, weather=, style=<key for every task>
  const qs = new URLSearchParams(location.search), n = +(qs.get('n') || 8), p = qs.get('p') != null ? +qs.get('p') : n, c = +(qs.get('c') || 0), hh = +(qs.get('h') || 206);
  const o = { tod: qs.get('tod') != null ? +qs.get('tod') : .5, weather: qs.get('weather') || 'clear' };
  const k0 = +(qs.get('from') || 0);
  ART.tourThemes.slice(k0).concat(ART.tourThemes.slice(0, k0)).forEach((th, j) => { const k = ART.tourThemes.indexOf(th), isl = ART.tourDemo(c * 8 + k, n), y = 4 + j * (hh + 8);
    if (qs.get('style')) { o.style = {}; isl.tasks.forEach(tk => o.style[tk.id] = qs.get('style')); }
    ART.tourScene(g, isl, p, 0, y, W, hh, 1.7 + k, o); label(th + ' i' + isl.i + ' ' + p + '/' + n + (o.style ? ' ' + qs.get('style') : ''), 8, y + 14); });
} else if (mode === 'wardrobe') {
  const K = ART.heroineKeys, s = 96;
  K.outfit.forEach((o, i) => { const x = 6 + (i % 4) * 102, y = 6 + Math.floor(i / 4) * 118; ART.cell(g, x, y, s + 4, 'empty'); g.drawImage(ART.heroine(s * d, { outfit: o, hair: K.hair[i % 4], acc: 'none' }), x + 2, y + 2, s, s); label(o + '/' + K.hair[i % 4], x, y + s + 14); });
  K.acc.forEach((a, i) => { const x = 6 + (i % 4) * 102, y = 250 + Math.floor(i / 4) * 118; ART.cell(g, x, y, s + 4, 'empty'); g.drawImage(ART.heroine(s * d, { outfit: K.outfit[(i + 2) % 6], hair: K.hair[(i + 1) % 4], acc: a }), x + 2, y + 2, s, s); label(a, x, y + s + 14); });
  K.hair.forEach((h, i) => { const x = 6 + i * 102, y = 490; g.drawImage(ART.heroine(48 * d, { outfit: 'casual', hair: h, acc: 'none' }), x, y, 48, 48); g.drawImage(ART.heroine(48 * d, { outfit: 'gala', hair: h, acc: 'flower' }), x + 50, y, 48, 48); });
  ART.petKinds.forEach((k, j) => ART.petAccs.forEach((a, i) => { const x = 6 + i * 102, y = 560 + j * 112; ART.cell(g, x, y, s + 4, 'empty'); g.drawImage(ART.pet(k, s * d, a), x + 2, y + 2, s, s); label(k + ' ' + a, x, y + s + 12); }));
  ['boho', 'minimal', 'romantic'].forEach((k, i) => { g.drawImage(ART.styleSwatch(k, 60 * d), 214 + i * 66, 130, 60, 60); g.drawImage(ART.styleSwatch(k, 32 * d), 228 + i * 66, 200, 32, 32); g.font = '9px system-ui'; label(ART.styleNames[k], 214 + i * 66, 246); g.font = '700 12px system-ui'; });
} else if (mode === 'events') {
  const s = 58; let y = 6;
  for (const ch of ART.eventChains) { label(ch, 8, y + 10); for (let i = 1; i <= 6; i++) { const x = 6 + (i - 1) * (s + 10); ART.cell(g, x, y + 14, s + 6, 'empty'); g.drawImage(ART.item(ch, i, s * d), x + 3, y + 17, s, s); g.font = '9px system-ui'; label(ART.labels[ch][i - 1], x, y + s + 30); g.font = '700 12px system-ui'; } y += s + 40; }
  ['pass', 'wardrobe', 'camera', 'palette', 'island', 'event', 'party', 'paw', 'cur_garden', 'cur_fashion', 'cur_wedding', 'cur_beach'].forEach((n, i) => { const x = 6 + (i % 6) * 66, yy = y + 4 + Math.floor(i / 6) * 76; g.drawImage(ART.icon(n, 52 * d), x, yy, 52, 52); g.font = '9px system-ui'; label(n, x, yy + 64); g.font = '700 12px system-ui'; });
  g.drawImage(ART.icon('camera', 24 * d), 6, y + 160, 24, 24); g.drawImage(ART.icon('pass', 24 * d), 36, y + 160, 24, 24); g.drawImage(ART.icon('island', 24 * d), 66, y + 160, 24, 24); g.drawImage(ART.icon('cur_beach', 24 * d), 96, y + 160, 24, 24);
} else if (mode === 'postcard') {
  const qs = new URLSearchParams(location.search), isl = ART.tourDemo(+(qs.get('i') || 4));
  ART.postcard(g, W, Hh, (c, x, y, w, h) => ART.tourScene(c, isl, 8, x, y, w, h, 2, { tod: +(qs.get('tod') || .76), weather: qs.get('weather') || 'petals' }), { sub: ART.tourNames[isl.theme], date: new Date(2026, 10, 28), t: 1.2 });
} else if (mode === 'sky') {
  const ws = ['clear', 'rain', 'snow', 'petals'], tods = [.1, .24, .5, .74, .8, .87];
  tods.forEach((td, i) => ws.forEach((wt, j) => { const x = j * (W / 4), y = 6 + i * 150, w = W / 4 - 4; ART.sky(g, x, y, w, 140, 3 + i, { tod: td, weather: wt, fg: true }); label(td + ' ' + wt, x + 4, y + 12); }));
}
window.__done = true;
`;
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#fbe9d0}canvas{display:block}</style><canvas id="cv"></canvas><script>(function(){'use strict';\n${code}\n${gallery}\n})();</script>`;
const page = path.join(OUT, 'artgallery.html'); fs.writeFileSync(page, html);
const modes = (process.argv[2] || 'items') === 'all' ? ['items', 'gens', 'scenes', 'people', 'ui', 'fx', 'map', 'themes', 'obst', 'wheel', 'win'] : [process.argv[2] || 'items'];
const dpr = process.argv[3] || '1', extra = process.argv[4] || '';
for (const m of modes) {
  const H = { items: 1500, gens: 900, scenes: 1700, people: 520, ui: 900, fx: 700, env: 1580, sky: 920, tour: 1720, styles: 1300, wardrobe: 1100, events: 860, postcard: 860 }[m] || 956;
  const out = execFileSync('node', [path.join(__dirname, 'cdp.js'), '', (process.env.GW || '420') + ',' + H, 'wait:700', 'shot:art-' + m + extra + '-' + dpr + 'x'], { env: Object.assign({}, process.env, { DPR: dpr, PAGE: 'file://' + page + (extra ? '?' + extra : '') + '#' + m }) }).toString();
  process.stdout.write(out);
}
