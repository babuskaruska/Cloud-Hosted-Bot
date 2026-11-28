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
const W = innerWidth, Hh = { items: 1500, gens: 900, scenes: 1700, people: 520, ui: 900, fx: 700 }[mode] || 1200;
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
    for (let i = 1; i <= 5; i++) { const x = 8 + (i - 1) * (S + 12); ART.cell(g, x, y + 16, S + 6, i === 1 ? 'hint' : 'empty'); g.drawImage(ART.item(k, i, S * d), x + 3, y + 19, S, S); }
    y += S + 32;
  }
} else if (mode === 'scenes') {
  const areas = ART.areas, h = 200; let y = 10;
  const step = +(new URLSearchParams(location.search).get('p') || 0);
  for (const a of areas) {
    const nf = ART.sceneFeatures[a].length, states = [0, Math.ceil(nf / 2), nf];
    const pst = states[step] != null ? states[step] : nf;
    ART.scene(g, a, ART.sceneFeatures[a].slice(0, pst), 0, y, W, h, 1.3);
    label(a + ' ' + pst + '/' + nf, 8, y + 14); y += h + 10;
  }
} else if (mode === 'people') {
  const who = ['maali', 'ants', 'muri', 'liisa', 'peeter', 'mina'];
  who.forEach((w, i) => { const x = 10 + (i % 3) * 130, y = 10 + Math.floor(i / 3) * 150; g.drawImage(ART.portrait(w, 120 * d), x, y, 120, 120); label(w, x + 40, y + 136); });
  who.forEach((w, i) => { g.drawImage(ART.portrait(w, 48 * d), 10 + i * 56, 320, 48, 48); });
} else if (mode === 'ui') {
  ART.logo(g, W / 2, 90, Math.min(W * .8, 340), 1);
  const st = ['paper', 'wood', 'button', 'buttonHot', 'buttonBlue', 'buttonGrey', 'ribbon'];
  st.forEach((s, i) => { ART.panel(g, 30 + (i % 2) * 180, 170 + Math.floor(i / 2) * 70, 150, 50, s); label(s, 40 + (i % 2) * 180, 200 + Math.floor(i / 2) * 70); });
  const ic = Object.keys(ART.iconDefs); ic.forEach((n, i) => { const x = 10 + (i % 8) * 46, y = 470 + Math.floor(i / 8) * 60; g.drawImage(ART.icon(n, 40 * d), x, y, 40, 40); g.font='9px system-ui'; label(n, x, y + 52); g.font='700 12px system-ui'; });
  ['empty', 'locked', 'hint', 'target'].forEach((s, i) => ART.cell(g, 10 + i * 60, 640, 54, s));
  g.drawImage(ART.item('pagar', 6, 54 * d), 250, 640, 54, 54); g.drawImage(ART.bubble(54 * d), 250, 640, 54, 54);
  ART.panel(g, 10, 700, W - 20, 160, 'paper'); g.drawImage(ART.portrait('maali', 120 * d), 20, 720, 120, 120);
} else if (mode === 'fx') {
  window.UI = { hudPos: n => ({ coins: [W - 60, 20], stars: [W - 140, 20], energy: [60, 20] })[n] };
  FX.quality = 2; let t = 0; const img = ART.item('pagar', 4, 64 * d);
  FX.merge(100, 200, 'pagar', 3); FX.merge(280, 200, 'pagar', 8); FX.coins(100, 400, 6); FX.stars(280, 400, 3); FX.energy(200, 500, 4); FX.confetti(); FX.spawn(60, 600, 300, 560, img);
  const NF = +(new URLSearchParams(location.search).get('f') || 12); for (let i = 0; i < NF; i++) FX.update(1 / 60);
  ART.bg(g, W, Hh, 0); FX.draw(g); const sq = FX.squash(100, 200); label('squash ' + (sq ? sq.map(v=>v.toFixed(2)).join(',') : 'none'), 10, 680);
  label('live ' + FX.count(), 200, 680);
}
window.__done = true;
`;
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#fbe9d0}canvas{display:block}</style><canvas id="cv"></canvas><script>(function(){'use strict';\n${code}\n${gallery}\n})();</script>`;
const page = path.join(OUT, 'artgallery.html'); fs.writeFileSync(page, html);
const modes = (process.argv[2] || 'items') === 'all' ? ['items', 'gens', 'scenes', 'people', 'ui', 'fx'] : [process.argv[2] || 'items'];
const dpr = process.argv[3] || '1', extra = process.argv[4] || '';
for (const m of modes) {
  const H = { items: 1500, gens: 900, scenes: 1700, people: 520, ui: 900, fx: 700 }[m] || 1200;
  const out = execFileSync('node', [path.join(__dirname, 'cdp.js'), '', (process.env.GW || '420') + ',' + H, 'wait:700', 'shot:art-' + m + extra + '-' + dpr + 'x'], { env: Object.assign({}, process.env, { DPR: dpr, PAGE: 'file://' + page + (extra ? '?' + extra : '') + '#' + m }) }).toString();
  process.stdout.write(out);
}
