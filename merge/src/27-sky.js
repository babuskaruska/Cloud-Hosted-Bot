// ===== ART sky (Ash): time of day and weather for every scene. =====
//   ART.todNow()          -> 0..1 fraction of the local day (0 = midnight, .5 = noon). URL flag tod=0..1 (or tod=0..24 hours).
//   ART.weatherToday()    -> 'clear' | 'rain' | 'snow' | 'petals', chosen per calendar day (snow only Dec–Feb, petals in spring
//                            and summer). URL flag weather=<key>.
//   ART.env(opts)         -> { tod, weather, phase, key } resolved from opts (opts.tod / opts.weather) or the clock and the day.
//                            ART.envAuto = false freezes the default at noon and clear (for a settings toggle).
//   ART.sky(ctx, x, y, w, h, t, { tod, weather, horizon })  paints a sky into the rect: gradient for the hour, sun or moon on
//                            an arc, stars at night, soft clouds (grey under rain). horizon (0..1, default .62) = where the
//                            sky meets the ground. The gradient, glow and sun are a cached layer; stars and clouds are live.
//   ART.weatherFx(ctx, x, y, w, h, t, weather)  foreground rain streaks, snowflakes or drifting petals. Stateless (positions are
//                            a function of the index and t), drawn as one path per colour, capped by FX.quality (0..2).
//   ART.skyLook(env)      -> { phase, tint, haze, dark } used by the scenes: tint is a multiply colour for the ground layer.
(function (A) {
  const { E, dot, srnd, mix, rgba, mk } = A.H;
  const TAU = Math.PI * 2;
  function flags() {
    const o = {};
    try { new URLSearchParams(location.search).forEach((v, k) => { o[k] = v; }); } catch (e) { }
    try { new URLSearchParams(location.hash.slice(1)).forEach((v, k) => { o[k] = v; }); } catch (e) { }
    return o;
  }
  const FL = flags();
  A.envAuto = true;
  A.todNow = function () {
    if (FL.tod != null && FL.tod !== '') { let v = parseFloat(FL.tod); if (isFinite(v)) { if (v > 1) v /= 24; return ((v % 1) + 1) % 1; } }
    if (!A.envAuto) return .5;
    const d = new Date(); return (d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600) / 24;
  };
  const WEATHERS = ['clear', 'rain', 'snow', 'petals'];
  A.weathers = WEATHERS;
  A.weatherToday = function (date) {
    if (FL.weather && WEATHERS.indexOf(FL.weather) >= 0) return FL.weather;
    if (!A.envAuto && !date) return 'clear';
    const d = date || new Date(), m = d.getMonth(), key = d.getFullYear() * 400 + m * 32 + d.getDate();
    let h = key >>> 0; h = Math.imul(h ^ (h >>> 16), 0x45d9f3b); h = Math.imul(h ^ (h >>> 16), 0x45d9f3b); h = (h ^ (h >>> 16)) >>> 0;
    const r = (h % 1000) / 1000;
    if (m === 11 || m <= 1) return r < .55 ? 'snow' : 'clear';           // winter: snow most days
    if (m >= 2 && m <= 4) return r < .32 ? 'petals' : r < .5 ? 'rain' : 'clear'; // spring blossom
    if (m >= 5 && m <= 7) return r < .18 ? 'petals' : r < .3 ? 'rain' : 'clear'; // summer: mostly sunny
    return r < .34 ? 'rain' : 'clear';                                   // autumn showers
  };
  // phase of the day; dawn and dusk are short, the day is long (cozy, mostly bright)
  function phaseOf(tod) {
    if (tod < .2 || tod >= .9) return 'night';
    if (tod < .27) return 'dawn';
    if (tod < .71) return 'day';
    if (tod < .77) return 'golden';
    if (tod < .84) return 'sunset';
    return 'dusk';
  }
  A.env = function (opts) {
    opts = opts || {};
    const tod = opts.tod != null ? ((+opts.tod % 1) + 1) % 1 : A.todNow();
    const weather = opts.weather && WEATHERS.indexOf(opts.weather) >= 0 ? opts.weather : A.weatherToday();
    const phase = phaseOf(tod);
    return { tod, weather, phase, key: phase + ':' + weather };
  };
  // sky gradients [top, middle, bottom] per phase
  const GRAD = {
    day: ['#5ec8ff', '#a8e2ff', '#ffeef4'], golden: ['#68b4ff', '#b8d8ff', '#ffe0b0'], sunset: ['#6a6ad8', '#ff9ab0', '#ffc88a'],
    dusk: ['#343a96', '#8a62c4', '#ff9ab4'], dawn: ['#6c86de', '#ffb4cc', '#ffe2b4'], night: ['#121848', '#28307a', '#5a4a9c']
  };
  // ground tint (multiply) per phase and per weather
  const TINT = { day: null, golden: '#fff0dc', sunset: '#ffd4bc', dusk: '#c4b6ee', dawn: '#f6dcee', night: '#7a84cc' };
  const WTINT = { clear: null, petals: null, rain: '#c2c9da', snow: '#e8eeff' };
  function mulCol(a, b) {
    if (!a) return b; if (!b) return a;
    const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), f = s => ('0' + Math.round(((x >> s) & 255) * ((y >> s) & 255) / 255).toString(16)).slice(-2);
    return '#' + f(16) + f(8) + f(0);
  }
  A.skyLook = function (env) {
    env = env || A.env();
    return { phase: env.phase, tint: mulCol(TINT[env.phase], WTINT[env.weather]), haze: env.weather === 'snow' ? .3 : 0, dark: env.phase === 'night' ? 1 : env.phase === 'dusk' ? .55 : 0, plain: env.phase === 'day' && (env.weather === 'clear' || env.weather === 'petals') };
  };
  function grad(env) {
    let gr = GRAD[env.phase] || GRAD.day;
    if (env.weather === 'rain') gr = gr.map((c, i) => mix(c, env.phase === 'night' ? '#2a2e48' : '#9aa4bc', .55 - i * .05));
    else if (env.weather === 'snow') gr = gr.map((c, i) => mix(c, env.phase === 'night' ? '#3a4070' : '#dfe8f8', .45));
    return gr;
  }
  // where the sun (day) or moon (night) sits: an arc from left to right across the sky
  function bodyPos(tod, w, hz) {
    let u, isMoon;
    if (tod >= .22 && tod < .86) { u = (tod - .22) / .64; isMoon = false; } else { u = ((tod + 1 - .86) % 1) / .36; isMoon = true; }
    u = Math.max(0, Math.min(1, u));
    return { x: w * (.1 + .8 * u), y: hz * (.86 - .66 * Math.sin(u * Math.PI)), moon: isMoon };
  }
  const _sk = new Map();
  function skyLayer(env, w, h, sc, hz) {
    const tb = Math.round(env.tod * 96), key = env.key + '|' + tb + '|' + Math.round(w) + 'x' + Math.round(h) + '@' + sc.toFixed(2) + '|' + hz.toFixed(2);
    let c = _sk.get(key); if (c) return c;
    c = mk(w * sc, h * sc); const g = c.getContext('2d'); g.scale(sc, sc);
    const gc = grad(env), H = h * hz;
    const gr = g.createLinearGradient(0, 0, 0, Math.max(H, 4)); gr.addColorStop(0, gc[0]); gr.addColorStop(.55, gc[1]); gr.addColorStop(1, gc[2]);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const b = bodyPos(env.tod, w, H), r = Math.max(6, Math.min(w, H) * .075), wet = env.weather === 'rain';
    if (!wet) {
      // glow around the sun or moon
      const gl = g.createRadialGradient(b.x, b.y, r * .3, b.x, b.y, r * (b.moon ? 4 : 5.5));
      const gcol = b.moon ? '#dfe4ff' : env.phase === 'sunset' || env.phase === 'golden' ? '#ffd08a' : env.phase === 'dawn' ? '#ffd6c8' : '#fff3a8';
      gl.addColorStop(0, rgba(gcol, b.moon ? .45 : .8)); gl.addColorStop(1, rgba(gcol, 0)); g.fillStyle = gl; g.fillRect(0, 0, w, h);
      if (b.moon) {
        const mg = g.createLinearGradient(0, b.y - r, 0, b.y + r); mg.addColorStop(0, '#fffbe8'); mg.addColorStop(1, '#ffe6a8');
        g.fillStyle = mg; g.beginPath(); g.arc(b.x, b.y, r, 0, TAU); g.fill();
        dot(g, b.x + r * .3, b.y + r * .2, r * .22, 'rgba(230,200,140,.45)'); dot(g, b.x - r * .35, b.y - r * .1, r * .14, 'rgba(230,200,140,.45)'); dot(g, b.x + r * .05, b.y - r * .45, r * .1, 'rgba(230,200,140,.4)');
        g.fillStyle = 'rgba(255,255,255,.6)'; E(g, b.x - r * .38, b.y - r * .4, r * .25, r * .14, -.6); g.fill();
      } else {
        const sg = g.createLinearGradient(0, b.y - r, 0, b.y + r); const low = env.phase !== 'day';
        sg.addColorStop(0, '#fffbe0'); sg.addColorStop(1, low ? '#ff9a4a' : '#ffd84a'); g.fillStyle = sg; g.beginPath(); g.arc(b.x, b.y, r, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.55)'; E(g, b.x - r * .35, b.y - r * .35, r * .3, r * .18, -.6); g.fill();
      }
    }
    if (env.phase === 'sunset' || env.phase === 'dusk' || env.phase === 'dawn') { // a warm band on the horizon
      const hg = g.createLinearGradient(0, H * .6, 0, H); hg.addColorStop(0, 'rgba(255,170,140,0)'); hg.addColorStop(1, 'rgba(255,170,140,.45)'); g.fillStyle = hg; g.fillRect(0, H * .6, w, H * .4 + 1);
    }
    if (env.phase === 'night' || env.phase === 'dusk') { // static faint stars
      const rr = srnd(77), n = env.phase === 'night' ? 46 : 18;
      for (let i = 0; i < n; i++) dot(g, rr() * w, rr() * H * .85, .4 + rr() * .7, 'rgba(255,255,240,' + (wet ? .15 : .55) + ')');
    }
    if (_sk.size > 8) _sk.delete(_sk.keys().next().value);
    _sk.set(key, c); return c;
  }
  function cloud(g, x, y, s, col, a) {
    g.globalAlpha = a;
    g.fillStyle = col; E(g, x, y, 18 * s, 6.5 * s); g.fill(); E(g, x - 9 * s, y - 3 * s, 9 * s, 7 * s); g.fill(); E(g, x + 5 * s, y - 6 * s, 11 * s, 9 * s); g.fill(); E(g, x + 13 * s, y - 1 * s, 7 * s, 6 * s); g.fill();
    g.globalAlpha = 1;
  }
  const Q = () => { try { return typeof FX !== 'undefined' && FX ? FX.quality | 0 : 2; } catch (e) { return 2; } };
  A.sky = function (ctx, x, y, w, h, t, opts) {
    if (w < 2 || h < 2) return;
    opts = opts || {}; t = t || 0;
    const env = opts.phase ? opts : A.env(opts), hz = opts.horizon != null ? opts.horizon : .62, sc = A.scaleOf(ctx), H = h * hz;
    ctx.drawImage(skyLayer(env, w, h, sc, hz), x, y, w, h);
    const s = Math.max(.6, Math.min(2.2, H / 70));
    const wet = env.weather === 'rain', ccol = wet ? '#d4d8e6' : env.phase === 'night' ? '#6a70a8' : env.phase === 'dusk' || env.phase === 'sunset' ? '#ffd6e0' : '#ffffff';
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    if ((env.phase === 'night' || env.phase === 'dusk') && !wet && Q() > 0) { // twinkles
      const rr = srnd(31);
      for (let i = 0; i < 7; i++) { const sx = x + rr() * w, sy = y + rr() * H * .7, a = Math.sin(t * 2.2 + i * 1.9); if (a > .2) A.sparkAt(ctx, sx, sy, 1.2 + a * 2.2 * Math.min(1.5, s), 'rgba(255,252,220,.9)'); }
    }
    const n = wet ? 5 : env.weather === 'snow' ? 3 : 2, span = w + 60 * s;
    for (let i = 0; i < n; i++) {
      const cx = x - 30 * s + ((t * (3 + i * 1.3) * s + i * span / n + 40) % span), cy = y + H * (.18 + (i % 3) * .14);
      cloud(ctx, cx, cy, s * (wet ? 1.4 : 1) * (1 - (i % 2) * .25), ccol, wet ? .85 : env.phase === 'night' ? .35 : .8);
    }
    ctx.restore();
    if (opts.fg) A.weatherFx(ctx, x, y, w, h, t, env.weather);
  };
  // ---- weather particles: positions are pure functions of (i, t); one path per colour ----
  const hsh = i => { let h = (i + 1) * 2654435761 >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };
  const CAP = { rain: [14, 30, 52], snow: [16, 34, 60], petals: [8, 16, 26] };
  A.weatherFx = function (ctx, x, y, w, h, t, weather) {
    if (!weather || weather === 'clear' || !CAP[weather] || w < 2 || h < 2) return;
    t = t || 0; const q = Math.max(0, Math.min(2, Q())), area = Math.min(1.6, Math.max(.5, w * h / 80000)), n = Math.round(CAP[weather][q] * area);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    if (weather === 'rain') {
      const len = Math.max(8, h * .07), sl = len * .3;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const v = h * (1.5 + hsh(i) * .8), px = x + ((hsh(i + 99) * (w + sl * 4)) + t * v * .3) % (w + sl * 4) - sl * 2, py = y + ((hsh(i + 7) * (h + len) + t * v) % (h + len)) - len;
        ctx.moveTo(px, py); ctx.lineTo(px - sl, py + len);
      }
      ctx.lineWidth = Math.max(1, h * .006); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(225,238,255,.6)'; ctx.stroke();
      if (q > 0) { // little splashes along the bottom
        ctx.beginPath();
        for (let i = 0; i < 6; i++) { const p = (t * 1.7 + hsh(i + 300)) % 1, sx = x + hsh(i + 400) * w, sy = y + h * (.82 + hsh(i + 500) * .14), r = 2 + p * 6; ctx.moveTo(sx + r, sy); ctx.ellipse(sx, sy, r, r * .3, 0, 0, TAU); }
        ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(235,245,255,.35)'; ctx.stroke();
      }
    } else if (weather === 'snow') {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const v = h * (.12 + hsh(i) * .12), r = Math.max(1, h * (.006 + hsh(i + 3) * .01)), py = y + ((hsh(i + 7) * (h + 10) + t * v) % (h + 10)) - 5;
        const px = x + ((hsh(i + 11) * w + Math.sin(t * (.8 + hsh(i + 5)) + i) * w * .025 + t * w * .01) % w + w) % w;
        ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, TAU);
      }
      ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fill();
    } else { // petals: pink and white, tumbling (ellipse rotation instead of transforms)
      for (let c = 0; c < 2; c++) {
        ctx.beginPath();
        for (let i = c; i < n; i += 2) {
          const v = h * (.14 + hsh(i) * .1), r = Math.max(2, h * (.014 + hsh(i + 3) * .01)), py = y + ((hsh(i + 7) * (h + 20) + t * v) % (h + 20)) - 10;
          const px = x + ((hsh(i + 11) * w + t * w * .05 + Math.sin(t * 1.3 + i) * w * .03) % w + w) % w, rot = t * (1 + hsh(i + 2) * 2) + i;
          ctx.moveTo(px + r, py); ctx.ellipse(px, py, r, r * (.45 + .25 * Math.sin(t * 3 + i)), rot, 0, TAU);
        }
        ctx.fillStyle = c ? 'rgba(255,255,255,.9)' : 'rgba(255,150,190,.9)'; ctx.fill();
      }
    }
    ctx.restore();
  };
})(ART);
