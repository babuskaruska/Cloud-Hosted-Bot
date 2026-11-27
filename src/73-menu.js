// Lanternhold's screens, drawn on the HUD canvas in the pixel font: the main menu over the AI demo, Heat choice, the
// Keeper's Tree, the Codex, the in-game menu, confirmations, the results screen, the land arrival card, plus the story
// dialogue panel, the tutorial guide and the HUD row of mutator icons.
//
// UI.scr is the open screen: null | 'title' | 'heat' | 'tree' | 'codex' | 'pause' | 'confirm' | 'results' | 'arrival'.
// Every control goes into UI.btns (so taps find it) and into MENU.items (so keys and the gamepad can walk it).
// Input: touch and mouse (tap a button), keys (arrows or WASD move, Enter or Space picks, Esc goes back) and a gamepad
// (stick or D-pad, A picks, B goes back, Start opens the in-game menu).
const MENU = (() => {
  const M = { sel: 0, items: [], t: 0, kb: false, save: null, heatPick: 0, heatMode: 'campaign', treeSel: 0, tab: 'beasts', page: 0, res: null, conf: null, from: null, wasPaused: false, arrivalLv: -99, sparks: [], hudTip: null };
  const C = () => UI.COLR;
  M.modal = () => !!UI.scr || STORY.on();
  M.hideHud = () => !!UI.scr;
  M.open = (scr, o = {}) => {
    const prev = UI.scr;
    if (scr && !prev && (scr === 'pause' || scr === 'arrival' || scr === 'confirm' || scr === 'results')) { M.wasPaused = G.paused; G.paused = true; }
    if (o.from !== undefined) M.from = o.from;
    UI.scr = scr; M.sel = o.sel || 0; M.t = 0; UI.closeMenu(); UI.keys.clear();
    if (scr === 'title') { M.save = continueOffer(); M.res = null; }
    if (scr === 'tree') M.treeSel = clamp(M.treeSel, 0, UPGRADES.length - 1);
    sfx(scr ? 'menuOpen' : 'uiClick', CAM.x, CAM.z, .6);
  };
  M.close = () => { UI.scr = null; G.paused = false; M.wasPaused = false; };
  M.back = () => {
    const s = UI.scr;
    if (s === 'heat' || s === 'codex') M.open('title');
    else if (s === 'tree') M.open(M.from === 'results' ? 'results' : 'title', { sel: 0 });
    else if (s === 'pause') M.close();
    else if (s === 'confirm') { const cf = M.conf; if (cf && cf.no) cf.no(); else M.open(cf && cf.back || 'title'); }
    else if (s === 'arrival') M.close();
    sfx('menuBack', CAM.x, CAM.z, .7);
  };
  // ---- starting things ----
  function pickMode(mode) {
    M.heatMode = mode;
    if (mode === 'night' && !META.stats.campaigns) return confirm('The Long Night', ['The endless lands past the sixth beacon, for keepers who have finished the campaign.', 'Enter anyway?'], 'Enter the night', () => afterWarn(mode), 'title');
    afterWarn(mode);
  }
  function afterWarn(mode) {
    const S = continueOffer();
    if (S) { const r = embersForSave(S); return confirm('Start a new run?', ['Your saved run ends here' + (r && r.total ? ' and banks ' + r.total + ' embers.' : '.')], 'Start anew', () => toHeat(mode), 'title'); }
    toHeat(mode);
  }
  function toHeat(mode) { if (META.heatMax > 0) { M.heatPick = clamp(M.heatPick || META.heatMax, 0, META.heatMax); M.open('heat'); } else begin(mode, 0); }
  function begin(mode, heat) { UI.scr = null; M.wasPaused = false; startRun(mode, heat); }
  function confirm(title, lines, yes, fn, back, no) { M.conf = { title, lines, yes, fn, back, no }; M.open('confirm'); }
  function doContinue() {
    const S = continueOffer(); if (!S) { M.save = null; return; }
    UI.scr = null; M.wasPaused = false; buzz(12);
    try { if (!restoreRun(S)) { clearSave(); M.open('title'); } } catch (e) { clearSave(); setTimeout(() => location.reload(), 30); throw e; }
  }
  function toMenu() { M.res = null; startDemo(); M.open('title'); }
  function buzz(p) { if (UI.touch && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} } }

  // ---- update: results after a defeat, the arrival card, the tutorial, story ----
  M.update = dt => {
    M.t += dt; metaTick(dt); STORY.update(dt); TUT.update(dt);
    // Echo's audio scene: the main menu (the demo behind it), a story beat, or the game.
    const scene = STORY.on() ? 'story' : UI.scr && G.mode === 'demo' ? 'menu' : 'game';
    UI.mainMenu = scene === 'menu'; G.scene = scene;
    if (scene !== M.scene) { M.scene = scene; if (typeof AU.setScene === 'function') try { AU.setScene(scene); } catch (e) {} }
    if (UI.mx !== M.lmx || UI.my !== M.lmy) { if (M.lmx !== undefined) M.kb = false; M.lmx = UI.mx; M.lmy = UI.my; } // the mouse took over from the keys
    if (inRun() && G.phase === 'defeat' && G.phaseT > SUMMARY_AT && !UI.scr && !STORY.on()) { M.res = META.last; M.open('results'); }
    if (inRun() && G.phase === 'play' && M.arrivalLv !== G.level && G.modLevel === G.level && !STORY.on() && !STORY.queue.length && !UI.scr) {
      M.arrivalLv = G.level; if (activeMods().length) M.open('arrival');
    }
    if (M.hudTip) { M.hudTip.t += dt; if (M.hudTip.t > 5) M.hudTip = null; }
    for (let i = M.sparks.length - 1; i >= 0; i--) { const p = M.sparks[i]; p.t += dt; p.y -= p.v * dt; p.x += Math.sin(p.t * 3 + p.ph) * dt * 8; if (p.t > p.life) M.sparks.splice(i, 1); }
  };

  // ---- input ----
  const NAV = { ArrowUp: -1, ArrowLeft: -1, KeyW: -1, KeyA: -1, ArrowDown: 1, ArrowRight: 1, KeyS: 1, KeyD: 1 };
  M.key = e => {
    const k = e.key;
    if (STORY.on()) { if (k === 'Escape') STORY.skip(); else if (k !== 'm' && k !== 'M' && k !== 'Tab') STORY.advance(); return k !== 'm' && k !== 'M'; }
    if (!UI.scr) {
      if (k === 'Escape' && inRun() && !UI.menu && !UI.spell && !UI.armed && G.phase === 'play') { M.open('pause'); return true; }
      return false;
    }
    M.kb = true;
    if (k === 'm' || k === 'M') return false;
    const d = NAV[e.code];
    if (d && UI.scr === 'heat' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'KeyA' || e.code === 'KeyD')) { heatStep(d); return true; }
    if (d && UI.scr === 'tree' && M.sel < UPGRADES.length) {
      const cols = M.treeCols || 1, horiz = e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'KeyA' || e.code === 'KeyD';
      const n = clamp(M.sel + (horiz ? d : d * cols), 0, UPGRADES.length); M.sel = n; if (n < UPGRADES.length) M.treeSel = n; sfx('menuMove', CAM.x, CAM.z, .6); return true;
    }
    if (d && UI.scr === 'codex' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) { pageStep(d); return true; }
    if (d) { const n = M.items.length || 1; M.sel = ((M.sel + d) % n + n) % n; sfx('menuMove', CAM.x, CAM.z, .6); return true; }
    if (k === 'Enter' || k === ' ') { const it = M.items[M.sel]; if (it) { sfx('menuSelect', CAM.x, CAM.z, .8); it.fn(); } return true; }
    if (k === 'Escape' || k === 'Backspace') { M.back(); return true; }
    return true;
  };
  M.pad = (ax, ay, hit) => {
    if (STORY.on()) { if (hit(0)) STORY.advance(); else if (hit(1)) STORY.skip(); return; }
    if (!UI.scr) { if (hit(9) && inRun() && G.phase === 'play') M.open('pause'); return; }
    M.kb = true;
    const d = ay || ax;
    if (d && M.padT <= 0) {
      M.padT = .22;
      if (UI.scr === 'heat' && ax) heatStep(ax);
      else if (UI.scr === 'tree' && M.sel < UPGRADES.length) { const cols = M.treeCols || 1, n = clamp(M.sel + (ax ? ax : ay * cols), 0, UPGRADES.length); M.sel = n; if (n < UPGRADES.length) M.treeSel = n; }
      else if (UI.scr === 'codex' && ax) pageStep(ax);
      else { const n = M.items.length || 1; M.sel = ((M.sel + d) % n + n) % n; }
      sfx('menuMove', CAM.x, CAM.z, .6);
    }
    if (!d) M.padT = 0; else M.padT -= 1 / 60;
    if (hit(0)) { const it = M.items[M.sel]; if (it) { sfx('menuSelect', CAM.x, CAM.z, .8); it.fn(); } }
    if (hit(1)) M.back();
  };
  M.padT = 0;
  // A tap that hit no control: the story advances; the arrival card begins; other screens ignore it.
  M.tapOutside = () => { if (STORY.on()) STORY.advance(); else if (UI.scr === 'arrival') M.close(); };
  function heatStep(d) { M.heatPick = clamp(M.heatPick + d, 0, META.heatMax); sfx('heatSelect', CAM.x, CAM.z, .8, M.heatPick / HEAT_MAX); }
  function pageStep(d) { M.page = Math.max(0, Math.min((M.pages || 1) - 1, M.page + d)); sfx('uiHover', CAM.x, CAM.z, .6); }

  // ---- drawing helpers ----
  let E = null, ctx = null; // the frame's environment from UI.draw
  const tx = (str, x, y, ps, col, o) => PX.text(ctx, str, x, y, ps, col, o);
  const mw = (str, ps) => PX.measure(str) * ps;
  function wrap(str, maxW, ps) { const out = []; let cur = ''; for (const wd of String(str).split(' ')) { const t = cur ? cur + ' ' + wd : wd; if (cur && mw(t, ps) > maxW) { out.push(cur); cur = wd; } else cur = t; } if (cur) out.push(cur); return out; }
  // A button: registered for taps (UI.btns) and for keys (M.items). o: { on, col, sub, off (disabled look), icon, nav: false, bd }
  function button(id, x, y, w, h, label, ps, fn, o = {}) {
    const hot = E.over(x, y, w, h), down = UI.press === id, idx = o.nav === false ? -1 : M.items.length;
    const focus = M.kb && idx === M.sel && idx >= 0;
    const b = { id, x, y, w, h, fn: () => { if (!o.off || o.offOk) { buzz(10); if (!/back$|^cno$/.test(id)) sfx('menuSelect', CAM.x, CAM.z, .7); fn(); } else { sfx('uiDeny', CAM.x, CAM.z, .6); } }, hud: true };
    UI.btns.push(b); if (idx >= 0) M.items.push(b); if (hot) { UI.hudHot = true; if (!M.kb) M.hov = id; }
    const lit = hot || down || focus, dy = down ? E.s > 2 ? Math.round(ps / 2) || 1 : 1 : 0, c = C();
    UI.plate(x, y + dy, w, h, lit ? { bd: c.bdHi, bg: c.bg2, hi: 'rgba(232,176,74,0.18)' } : o.on ? { bd: c.bdHi, bg: 'rgba(60,44,22,0.95)' } : { bd: o.bd || (o.off ? '#3a342c' : c.bd), bg: 'rgba(16,18,27,0.96)' });
    const L = PX.LINE * ps, sub = o.sub;
    let lx = x + w / 2, al = 'c';
    if (o.icon) { const [iw, ih] = PX.iconSize(o.icon), k = ps; const tw0 = iw * k + 3 * ps + mw(label, ps); lx = Math.round(x + w / 2 - tw0 / 2); PX.icon(ctx, o.icon, lx, y + dy + Math.round((h - (sub ? L * 2 : L)) / 2 + (L - ih * k) / 2), k, o.off ? .45 : 1); lx += iw * k + 3 * ps; al = 'l'; }
    const ty = y + dy + Math.round((h - (sub ? L * 2 + ps : L)) / 2) + ps;
    tx(label, lx, ty, ps, o.off ? c.dim : (o.col || (lit || o.on ? '#ffd9a8' : c.tx)), al === 'c' ? { align: 'c' } : undefined);
    if (sub) tx(sub, x + w / 2, ty + L + ps, ps, c.dim, { align: 'c' });
    return b;
  }
  const dim = (a = .5) => { ctx.fillStyle = 'rgba(4,5,10,' + a + ')'; ctx.fillRect(0, 0, E.W, E.H); };
  const touchH = (ps, lines = 1) => Math.max(PX.LINE * ps * lines + 2 * 5 * ps - ps + (lines - 1) * ps, E.tch ? Math.round((lines > 1 ? 54 : 46) * E.dpr) : Math.round(PX.LINE * ps * (lines + .9)));

  // A generic modal panel built from items, shrunk (ps) until it fits:
  // { t: 'title', text } { t: 'text', text, col, c (centred) } { t: 'row', l, r, col, rc } { t: 'gap' } { t: 'big', text, col }
  // { t: 'btns', list: [{ id, label, fn, col, on, off, sub, icon }] } (side by side when they fit, else stacked)
  // { t: 'mod', icon, name, tip } { t: 'sep' }
  function panel(items, o = {}) {
    const c = C(), avW = E.Wr - E.iL - 8 * E.s, avH = E.Hb - E.iT - 8 * E.s;
    const lay = ps => {
      const p = 5 * ps, L = PX.LINE * ps, gap = 3 * ps, cap = (o.cap || 220) * ps;
      let nat = o.minW ? o.minW * ps : 0;
      for (const it of items) {
        if (it.t === 'title') nat = Math.max(nat, mw(it.text, ps + 1));
        else if (it.t === 'big') nat = Math.max(nat, mw(it.text, ps + 2));
        else if (it.t === 'text') nat = Math.max(nat, Math.min(cap, mw(it.text, ps)));
        else if (it.t === 'row') nat = Math.max(nat, mw(it.l, ps) + 8 * ps + mw(it.r, ps));
        else if (it.t === 'mod') nat = Math.max(nat, Math.min(cap, Math.max(mw(it.name, ps) + 12 * ps, mw(it.tip, ps) + 12 * ps)));
        else if (it.t === 'btns') { let s = 0, mx = 0; for (const b of it.list) { const bw = mw(b.label, ps) + 4 * p + (b.icon ? PX.iconSize(b.icon)[0] * ps + 3 * ps : 0); s += bw; mx = Math.max(mx, bw, b.sub ? mw(b.sub, ps) + 2 * p : 0); } nat = Math.max(nat, it.stack ? mx : Math.max(mx, s + gap * (it.list.length - 1))); it._mx = mx; }
      }
      const w = Math.min(avW, nat + 2 * p), inner = w - 2 * p;
      let h = p, ok = true;
      for (const it of items) {
        if (it.t === 'title') { h += PX.LINE * (ps + 1) + gap * 2; if (mw(it.text, ps + 1) > inner) ok = false; }
        else if (it.t === 'big') { h += PX.LINE * (ps + 2) + gap; if (mw(it.text, ps + 2) > inner) ok = false; }
        else if (it.t === 'text') { it._l = wrap(it.text, inner, ps); h += it._l.length * L + ps; }
        else if (it.t === 'row') { h += L + ps; if (mw(it.l, ps) + 4 * ps + mw(it.r, ps) > inner) ok = false; }
        else if (it.t === 'gap') h += gap * 2;
        else if (it.t === 'sep') h += gap * 3;
        else if (it.t === 'mod') { it._l = wrap(it.tip, inner - 12 * ps, ps); h += L * (1 + it._l.length) + gap; }
        else if (it.t === 'btns') {
          const bh = touchH(ps, it.list.some(b => b.sub) ? 2 : 1); let s = 0; for (const b of it.list) s += mw(b.label, ps) + 4 * p; s += gap * (it.list.length - 1);
          it._side = !it.stack && s <= inner && it._mx * it.list.length + gap * (it.list.length - 1) <= inner; it._bh = bh;
          h += it._side ? bh + gap : it.list.length * (bh + gap); if (it._mx > inner + 2 * p) ok = false;
        }
      }
      h += p - gap;
      return { ps, p, L, gap, w, h, inner, ok };
    };
    let Ly = lay(o.ps || E.s); while (Ly.ps > 2 && (Ly.h > avH || !Ly.ok)) Ly = lay(Ly.ps - 1);
    const { ps, p, L, gap, w, h, inner } = Ly, x = Math.round((E.iL + E.Wr) / 2 - w / 2);
    const y = Math.round(o.top !== undefined ? clamp(o.top, E.iT + 4 * E.s, Math.max(E.iT + 4 * E.s, E.Hb - h)) : clamp((E.H - h) / 2, E.iT + 4 * E.s, Math.max(E.iT + 4 * E.s, E.Hb - h)));
    UI.panelRect = { x, y, w, h };
    ctx.globalAlpha = sat(M.t * 6 + .25);
    UI.plate(x, y, w, h, { bd: o.bd || c.bdHi });
    let yy = y + p;
    for (const it of items) {
      if (it.t === 'title') { tx(it.text, x + w / 2, yy, ps + 1, it.col || '#ffd9a8', { align: 'c' }); yy += PX.LINE * (ps + 1) + gap * 2; }
      else if (it.t === 'big') { tx(it.text, x + w / 2, yy, ps + 2, it.col || c.amber, { align: 'c' }); yy += PX.LINE * (ps + 2) + gap; }
      else if (it.t === 'text') { for (const l of it._l) { tx(l, it.c === false ? x + p : x + w / 2, yy, ps, it.col || c.tx, it.c === false ? undefined : { align: 'c' }); yy += L; } yy += ps; }
      else if (it.t === 'row') { tx(it.l, x + p, yy, ps, it.col || c.dim); tx(it.r, x + w - p, yy, ps, it.rc || c.tx, { align: 'r' }); yy += L + ps; }
      else if (it.t === 'gap') yy += gap * 2;
      else if (it.t === 'sep') { ctx.fillStyle = 'rgba(232,176,74,0.25)'; ctx.fillRect(x + p, yy + gap, inner, Math.max(1, ps >> 1)); yy += gap * 3; }
      else if (it.t === 'mod') {
        const ic = it.icon && PX.iconSize(it.icon)[0] ? it.icon : 'heat'; PX.icon(ctx, ic, x + p, yy, ps, 1);
        tx(it.name, x + p + 12 * ps, yy, ps, it.col || c.amber); yy += L;
        for (const l of it._l) { tx(l, x + p + 12 * ps, yy, ps, c.tx); yy += L; } yy += gap;
      }
      else if (it.t === 'btns') {
        const n = it.list.length, bh = it._bh;
        if (it._side) { const bw = Math.floor((inner - gap * (n - 1)) / n); it.list.forEach((b, i) => button(b.id, x + p + i * (bw + gap), yy, bw, bh, b.label, ps, b.fn, b)); yy += bh + gap; }
        else for (const b of it.list) { button(b.id, x + p, yy, inner, bh, b.label, ps, b.fn, b); yy += bh + gap; }
      }
    }
    ctx.globalAlpha = 1;
    return { x, y, w, h, ps };
  }

  // ---- the screens ----
  function drawTitle() {
    const c = C(), s = E.s, W = E.W, H = E.H, avW = E.Wr - E.iL - 8 * s;
    // A dark wash over the demo, darker at the edges.
    dim(.32); const g = ctx.createRadialGradient(W / 2, H * .45, Math.min(W, H) * .2, W / 2, H * .45, Math.max(W, H) * .75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const wide = W > H * 1.25 && H < 560 * E.dpr;
    // The menu items.
    const S = M.save, list = [];
    if (S) { const mins = Math.max(0, (Date.now() - S.t) / 6e4), ago = mins < 1 ? 'just now' : mins < 60 ? Math.round(mins) + ' min ago' : mins < 2880 ? Math.round(mins / 60) + ' h ago' : Math.round(mins / 1440) + ' days ago';
      list.push({ id: 'mcont', label: 'Continue', sub: 'Land ' + (S.level + 1) + ' · Wave ' + S.k + (S.heat ? ' · Heat ' + S.heat : '') + ' · ' + ago, fn: doContinue, col: c.amber }); }
    list.push({ id: 'mcamp', label: 'Campaign', sub: META.stats.campaigns ? 'Six lands · beaten ' + META.stats.campaigns + 'x' : 'Six lands. Light the beacons.', fn: () => pickMode('campaign'), col: S ? null : c.amber });
    list.push({ id: 'mnight', label: 'The Long Night', sub: META.stats.campaigns ? (META.stats.bestNight ? 'Deepest: night land ' + META.stats.bestNight : 'Endless lands') : 'Endless lands · after the campaign', fn: () => pickMode('night') });
    list.push({ id: 'mtree', label: "Keeper's Tree", sub: META.embers + ' embers', fn: () => M.open('tree', { from: 'title' }), icon: 'ember' });
    list.push({ id: 'mcodex', label: 'Codex', sub: 'Bestiary, story, records', fn: () => { M.page = 0; M.open('codex'); } });
    list.push({ id: 'mset', label: 'Settings', fn: () => UI.openSettings(true), nosub: true });
    // Fit: logo scale k and button font ps.
    const lw0 = PX.measure('LANTERNHOLD');
    const fit = ps => {
      const L = PX.LINE * ps, p = 5 * ps, gap = 3 * ps, bh2 = touchH(ps, 2), bh1 = touchH(ps, 1);
      let bw = 0; for (const it of list) bw = Math.max(bw, mw(it.label, ps) + (it.icon ? 12 * ps : 0) + 4 * p, it.sub ? mw(it.sub, ps) + 2 * p : 0);
      const colW = wide ? Math.min(avW * .5, Math.max(bw, 150 * ps)) : Math.min(avW, Math.max(bw, 170 * ps));
      const listH = list.reduce((a, it) => a + (it.sub ? bh2 : bh1) + gap, 0) - gap;
      const logoW = wide ? avW * .46 : avW * .92, k = Math.max(2, Math.floor(Math.min(logoW / lw0, (wide ? E.H * .16 : E.H * .085) / PX.LINE)));
      const logoH = PX.LINE * k + 14 * ps + L;
      return { ps, L, p, gap, bh1, bh2, colW, listH, k, logoH, bw, ok: bw <= colW + 1 && (wide ? Math.max(listH, logoH) : listH + logoH + 16 * ps) <= E.Hb - E.iT - 10 * s };
    };
    let F = fit(s); while (F.ps > 2 && !F.ok) F = fit(F.ps - 1);
    const { ps, L, gap, bh1, bh2, colW, listH, k, logoH } = F;
    let lx, ly, bx, by;
    if (wide) { lx = E.iL + (E.Wr - E.iL) * .27; ly = Math.round((E.iT + E.Hb) / 2 - logoH / 2); bx = Math.round(E.iL + (E.Wr - E.iL) * .73 - colW / 2); by = Math.round((E.iT + E.Hb) / 2 - listH / 2); }
    else { const tot = logoH + 18 * ps + listH, top = Math.max(E.iT + 8 * s, Math.round((E.iT + E.Hb) / 2 - tot / 2 - (E.Hb - E.iT) * .04)); lx = W / 2; ly = top; bx = Math.round(W / 2 - colW / 2); by = top + logoH + 18 * ps; }
    drawLogo(lx, ly, k, ps);
    let y = by;
    for (const it of list) { const h = it.sub ? bh2 : bh1; button(it.id, bx, y, colW, h, it.label, ps, it.fn, { sub: it.sub, col: it.col, icon: it.icon }); y += h + gap; }
    // Footer: credit to the original.
    const fs = Math.max(1, ps - 1), ft = 'After Cinderwatch by kevintngo · MIT';
    if (mw(ft, fs) < avW) tx(ft, W / 2, E.Hb - PX.LINE * fs - 3 * s, fs, 'rgba(167,158,138,0.7)', { align: 'c' });
  }
  // The logo: LANTERNHOLD in the pixel font, big, with an ember glow and sparks rising from it.
  function drawLogo(cx, y, k, ps) {
    const t = 'LANTERNHOLD', w = PX.measure(t) * k, x = Math.round(cx - w / 2), pulse = .75 + .25 * Math.sin(M.t * 2.2), c = C();
    // The lantern above the word.
    const [lw, lh] = PX.iconSize('lantern'), lk = Math.max(2, Math.round(k * .6));
    ctx.save(); ctx.shadowColor = 'rgba(255,170,80,' + (.7 * pulse) + ')'; ctx.shadowBlur = lk * 6; PX.icon(ctx, 'lantern', Math.round(cx - lw * lk / 2), y, lk, 1); ctx.restore();
    const wy = y + lh * lk + 3 * ps;
    ctx.save();
    ctx.shadowColor = 'rgba(255,120,40,' + (.85 * pulse) + ')'; ctx.shadowBlur = k * 5;
    PX.text(ctx, t, x, wy, k, '#ff8a3c', { outline: '#2a0c04' });
    ctx.shadowBlur = k * 2; ctx.shadowColor = 'rgba(255,200,120,' + (.5 * pulse) + ')';
    PX.text(ctx, t, x, wy, k, '#ffc870');
    ctx.restore();
    // The top rows lighter: an ember-gold face.
    ctx.save(); ctx.beginPath(); ctx.rect(x - k, wy, w + 2 * k, Math.round(PX.LINE * k * .38)); ctx.clip(); PX.text(ctx, t, x, wy, k, '#fff0c8'); ctx.restore();
    // Sparks.
    if (M.sparks.length < 26 && Math.random() < .5) M.sparks.push({ x: x + Math.random() * w, y: wy + PX.LINE * k * .4, v: (20 + Math.random() * 40) * E.dpr, t: 0, life: 1 + Math.random() * 1.6, ph: Math.random() * 6, sz: Math.max(1, Math.round(k * (.3 + Math.random() * .4))) });
    for (const p of M.sparks) { const a = 1 - p.t / p.life; ctx.fillStyle = 'rgba(255,' + Math.round(140 + 90 * a) + ',60,' + a.toFixed(2) + ')'; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.sz, p.sz); }
    const tag = 'The Hollowing rises. Keep the light.';
    tx(tag, cx, wy + PX.LINE * k + 5 * ps, ps, c.dim, { align: 'c' });
  }
  function drawHeat() {
    dim(.45);
    const h = M.heatPick, c = C(), items = [{ t: 'title', text: M.heatMode === 'night' ? 'The Long Night' : 'Campaign' }];
    items.push({ t: 'btns', list: [{ id: 'hdn', label: '<', fn: () => heatStep(-1), off: h <= 0 }, { id: 'hcur', label: 'Heat ' + h, fn: () => {}, on: true, nav: false, col: h ? c.ember : c.amber }, { id: 'hup', label: '>', fn: () => heatStep(1), off: h >= META.heatMax }] });
    items.push({ t: 'text', text: h ? HEAT[h].name + ': ' + HEAT[h].tip : HEAT[0].tip, col: '#ffd9a8' });
    if (h > 1) { items.push({ t: 'sep' }); for (let i = 1; i < h; i++) items.push({ t: 'text', text: HEAT[i].name + ': ' + HEAT[i].tip, col: c.dim, c: false }); }
    items.push({ t: 'gap' });
    items.push({ t: 'row', l: 'Embers', r: '×' + heatMul(h).toFixed(2), rc: c.amber });
    if (META.heatMax < HEAT_MAX) items.push({ t: 'text', text: 'Reach land ' + HEAT_UNLOCK_LAND + ' at Heat ' + META.heatMax + ' to unlock Heat ' + (META.heatMax + 1) + '.', col: c.dim });
    items.push({ t: 'btns', list: [{ id: 'hgo', label: 'Begin', fn: () => begin(M.heatMode, h), col: c.amber }, { id: 'hback', label: 'Back', fn: () => M.open('title') }] });
    panel(items, { cap: 210 });
  }
  function drawConfirm() {
    dim(.45); const cf = M.conf || { title: '?', lines: [] }, c = C();
    panel([{ t: 'title', text: cf.title }].concat(cf.lines.map(l => ({ t: 'text', text: l }))).concat([{ t: 'gap' }, { t: 'btns', list: [{ id: 'cyes', label: cf.yes, fn: cf.fn, col: c.amber }, { id: 'cno', label: 'Back', fn: () => M.back() }] }]), { cap: 190 });
  }
  function drawPause() {
    dim(.4); const c = C(), mods = activeMods();
    const items = [{ t: 'title', text: 'Paused' }, { t: 'text', text: G.B.bio.name + ' · Land ' + landNo() + ' · Wave ' + Math.max(1, landWave()) + '/' + G.wavesPerLand, col: c.tx }];
    if (G.heat || mods.length) items.push({ t: 'text', text: (G.heat ? 'Heat ' + G.heat : '') + (G.heat && mods.length ? ' · ' : '') + mods.map(m => m.name).join(', '), col: c.dim });
    items.push({ t: 'gap' }, { t: 'btns', stack: true, list: [
      { id: 'presume', label: 'Resume', fn: () => M.close(), col: c.amber },
      { id: 'pset', label: 'Settings', fn: () => UI.openSettings(true) },
      { id: 'pquit', label: 'Abandon run', fn: () => { const n = runEmbersNow(); confirm('Abandon the run?', ['You keep the embers it has earned: ' + n + '.'], 'Abandon', () => { M.res = abandonRun(); M.open('results'); }, 'pause', () => { M.open('pause'); }); }, col: c.ember },
    ] });
    panel(items, { cap: 200, minW: 150 });
  }
  function runEmbersNow() { const run = META.run; if (!run) return 0; const sm = runSummary() || {}; return embersFor({ waves: sm.waves, bosses: sm.lands, level: G.level, level0: run.level0, heat: G.heat, ending: run.ending && !run.endingPaid }).total; }
  function drawResults() {
    dim(.35); const c = C(), r = M.res || META.last;
    if (!r) { panel([{ t: 'title', text: 'The beacon is out' }, { t: 'btns', list: [{ id: 'rmenu', label: 'Main menu', fn: toMenu }] }]); return; }
    const sm = r.sum || {}, items = [{ t: 'title', text: r.how === 'abandon' ? 'Run abandoned' : 'The beacon is out', col: '#ffd9a8' }, { t: 'text', text: (r.landName ? r.landName + ' · ' : '') + 'Land ' + r.land + (r.heat ? ' · Heat ' + r.heat : ''), col: c.dim }];
    items.push({ t: 'row', l: 'Waves survived', r: '' + (sm.waves || 0) }, { t: 'row', l: 'Lands cleared', r: '' + (sm.lands || 0) }, { t: 'row', l: 'Monsters slain', r: '' + (sm.slain || 0) });
    if (sm.tower) items.push({ t: 'row', l: 'Best tower', r: sm.tower.name + ' · ' + sm.tower.kills });
    items.push({ t: 'sep' }, { t: 'row', l: 'Embers for waves', r: '' + r.waves }, { t: 'row', l: 'Embers for bosses', r: '' + r.boss });
    if (r.depth) items.push({ t: 'row', l: 'The Long Night', r: '' + r.depth });
    if (r.story) items.push({ t: 'row', l: 'The story', r: '' + r.story });
    if (r.heat) items.push({ t: 'row', l: 'Heat ' + r.heat, r: '×' + r.mul.toFixed(2), rc: c.ember });
    items.push({ t: 'big', text: '+' + r.total + ' embers', col: c.amber }, { t: 'text', text: 'You have ' + META.embers + ' embers.', col: c.tx });
    for (const n of r.notes || []) items.push({ t: 'text', text: n, col: c.ember });
    const cheap = UPGRADES.filter(u => upCost(u.key) && upCost(u.key) <= META.embers).length;
    if (cheap) items.push({ t: 'text', text: cheap + ' upgrade' + (cheap > 1 ? 's' : '') + ' ready in the Keeper\'s Tree.', col: c.ok });
    items.push({ t: 'btns', stack: true, list: [
      { id: 'ragain', label: 'Play again', fn: () => { const h = r.heat || 0, md = r.mode; UI.scr = null; M.wasPaused = false; startRun(md, h); }, col: c.amber },
      { id: 'rtree', label: "Keeper's Tree", fn: () => M.open('tree', { from: 'results' }), icon: 'ember' },
      { id: 'rmenu', label: 'Main menu', fn: toMenu },
    ] });
    panel(items, { cap: 200, minW: 150, bd: c.ember });
  }
  function drawArrival() {
    dim(.25); const c = C(), mods = activeMods();
    const items = [{ t: 'title', text: G.B.bio.name }, { t: 'text', text: G.level >= CAMPAIGN_LANDS ? 'The Long Night · Land ' + landNo() : 'Land ' + landNo() + ' of ' + CAMPAIGN_LANDS, col: c.dim }];
    if (G.heat) items.push({ t: 'text', text: 'Heat ' + G.heat + ' · ' + HEAT[G.heat].name, col: c.ember });
    items.push({ t: 'sep' });
    for (const m of mods) items.push({ t: 'mod', icon: m.icon, name: m.name, tip: m.tip, col: MUTATORS[m.key] && MUTATORS[m.key].boon ? c.ok : c.amber });
    const list = [{ id: 'abegin', label: 'Begin', fn: () => M.close(), col: c.amber }];
    if (G.rerolls > 0 && typeof rollMods === 'function') list.push({ id: 'areroll', label: 'Reroll (' + G.rerolls + ')', fn: () => { if (rerollMods()) M.t = .1; }, icon: 'lantern' });
    items.push({ t: 'gap' }, { t: 'btns', list });
    panel(items, { cap: 200 });
  }
  function drawTree() {
    dim(.5);
    const c = C(), s = E.s, avW = E.Wr - E.iL - 8 * s, avH = E.Hb - E.iT - 8 * s, N = UPGRADES.length;
    const icw = Math.max(...UPGRADES.map(u => PX.iconSize(u.icon)[0])) + 3;
    const lay = ps => {
      const p = 4 * ps, L = PX.LINE * ps, gap = 3 * ps;
      let cw = 0; for (const u of UPGRADES) { const l = META.up[u.key] || 0; cw = Math.max(cw, icw * ps + mw(u.name, ps) + 6 * ps + u.max * 5 * ps, icw * ps + mw(u.fmt(u.v(Math.max(1, l))), ps) + 6 * ps + mw('000', ps) + 10 * ps); }
      cw += 2 * p; const ch = Math.max(L * 2 + 2 * p, E.tch ? Math.round(44 * E.dpr) : 0);
      let cols = Math.max(1, Math.min(3, Math.floor((avW - 2 * p + gap) / (cw + gap))));
      // Prefer fewer, wider columns when the rows still fit.
      const head = PX.LINE * (ps + 1) + gap * 2, foot = L * 3 + 2 * p + touchH(ps) + gap * 2;
      while (cols > 1 && Math.ceil(N / (cols - 1)) * (ch + gap) + head + foot + 2 * p <= avH) cols--;
      const rows = Math.ceil(N / cols), w = Math.min(avW, cols * cw + (cols - 1) * gap + 2 * p), h = 2 * p + head + rows * (ch + gap) + foot;
      return { ps, p, L, gap, cw: Math.floor((w - 2 * p - (cols - 1) * gap) / cols), ch, cols, rows, w, h, head, ok: h <= avH && cw * cols + (cols - 1) * gap + 2 * p <= avW + 1 };
    };
    let Ly = lay(s); while (Ly.ps > 2 && !Ly.ok) Ly = lay(Ly.ps - 1);
    const { ps, p, L, gap, cw, ch, cols, w, h, head } = Ly, x = Math.round((E.iL + E.Wr) / 2 - w / 2), y = Math.round(clamp((E.H - h) / 2, E.iT + 4 * s, Math.max(E.iT + 4 * s, E.Hb - h)));
    M.treeCols = cols; UI.panelRect = { x, y, w, h };
    ctx.globalAlpha = sat(M.t * 6 + .25);
    UI.plate(x, y, w, h, { bd: c.bdHi });
    tx("Keeper's Tree", x + p, y + p, ps + 1, '#ffd9a8');
    const et = '' + META.embers, ew = mw(et, ps + 1); tx(et, x + w - p, y + p, ps + 1, c.amber, { align: 'r' }); PX.icon(ctx, 'ember', x + w - p - ew - 11 * (ps + 1) / 1.2, y + p, ps + 1, 1);
    const y0 = y + p + head;
    UPGRADES.forEach((u, i) => {
      const col = i % cols, row = Math.floor(i / cols), bx = x + p + col * (cw + gap), by = y0 + row * (ch + gap), lv = META.up[u.key] || 0, cost = upCost(u.key), can = cost && META.embers >= cost, sel = M.treeSel === i;
      const hot = E.over(bx, by, cw, ch), down = UI.press === 'u' + u.key, focus = M.kb && M.sel === i;
      const b = { id: 'u' + u.key, x: bx, y: by, w: cw, h: ch, fn: () => { if (M.treeSel === i && !UI.touch && !M.kb) tryBuy(i); M.treeSel = i; M.sel = i; sfx('uiHover', CAM.x, CAM.z, .7); }, hud: true };
      UI.btns.push(b); M.items.push({ fn: () => tryBuy(i) }); if (hot) UI.hudHot = true;
      UI.plate(bx, by + (down ? 1 : 0), cw, ch, sel || focus ? { bd: c.bdHi, bg: c.bg2, hi: 'rgba(232,176,74,0.18)' } : hot ? { bd: '#8a6a3a', bg: c.bg2 } : lv >= u.max ? { bd: '#6a5a30', bg: 'rgba(40,32,18,0.95)' } : { bg: 'rgba(16,18,27,0.96)' });
      const iy = by + Math.round(ch / 2 - PX.iconSize(u.icon)[1] * ps / 2);
      PX.icon(ctx, u.icon, bx + p + Math.round((icw - 3 - PX.iconSize(u.icon)[0]) * ps / 2), iy, ps, lv ? 1 : .55);
      const ty = by + Math.round((ch - L * 2) / 2) + ps;
      tx(u.name, bx + p + icw * ps, ty, ps, lv ? '#ffd9a8' : c.tx);
      for (let k = 0; k < u.max; k++) { const px = bx + cw - p - (u.max - k) * 5 * ps + ps, q = Math.max(1, ps >> 1); ctx.fillStyle = c.dark; ctx.fillRect(px, ty + ps, 4 * ps, 4 * ps); ctx.fillStyle = k < lv ? c.amber : '#3a342c'; ctx.fillRect(px + q, ty + ps + q, 4 * ps - 2 * q, 4 * ps - 2 * q); }
      tx(lv ? u.fmt(u.v(lv)) : 'Not learned', bx + p + icw * ps, ty + L, ps, lv ? c.ok : c.dim);
      if (cost) { const ct = '' + cost; tx(ct, bx + cw - p, ty + L, ps, can ? c.amber : c.red, { align: 'r' }); PX.icon(ctx, 'ember', bx + cw - p - mw(ct, ps) - 10 * ps, ty + L, ps, can ? 1 : .5); }
      else tx('Max', bx + cw - p, ty + L, ps, c.amber, { align: 'r' });
    });
    // The chosen upgrade: what it does now and next, and Buy.
    const u = UPGRADES[M.treeSel], lv = META.up[u.key] || 0, cost = upCost(u.key), can = cost && META.embers >= cost, fy = y0 + Ly.rows * (ch + gap) + gap;
    tx(u.name + ': ' + u.desc, x + p, fy, ps, c.tx);
    tx((lv ? 'Now ' + u.fmt(u.v(lv)) : 'Not learned yet') + (cost ? ' · Next ' + u.fmt(u.v(lv + 1)) : ' · fully learned'), x + p, fy + L + ps, ps, cost ? c.ok : c.dim);
    const bh = touchH(ps), bw = Math.floor((w - 2 * p - gap) / 2), by = y + h - p - bh;
    button('tbuy', x + p, by, bw, bh, cost ? 'Learn · ' + cost : 'Learned', ps, () => tryBuy(M.treeSel), { off: !can, col: can ? c.amber : null, icon: cost ? 'ember' : null });
    button('tback', x + p + bw + gap, by, bw, bh, 'Back', ps, () => M.back(), { icon: 'back' });
    ctx.globalAlpha = 1;
  }
  function tryBuy(i) {
    const u = UPGRADES[i]; M.treeSel = i;
    if (buyUpgrade(u.key)) { buzz([12, 30, 20]); M.flash = 1; } else sfx('uiDeny', CAM.x, CAM.z, .6);
  }
  function drawCodex() {
    dim(.5);
    const c = C(), s = E.s, avW = E.Wr - E.iL - 8 * s, avH = E.Hb - E.iT - 8 * s, tab = M.tab;
    let ps = s; const p0 = ps => 5 * ps;
    // Width first: about 230 font pixels where the screen allows.
    while (ps > 2 && (mw('Bestiary', ps) + mw('Story', ps) + mw('Records', ps) + 12 * p0(ps) + 6 * ps > avW || PX.LINE * ps * 14 > avH)) ps--;
    const p = p0(ps), L = PX.LINE * ps, gap = 3 * ps, w = Math.min(avW, Math.max(230 * ps, mw('Bestiary', ps) * 4)), inner = w - 2 * p, bh = touchH(ps);
    const h = Math.min(avH, Math.max(L * 16, Math.round(avH * .9))), x = Math.round((E.iL + E.Wr) / 2 - w / 2), y = Math.round(clamp((E.H - h) / 2, E.iT + 4 * s, E.Hb - h));
    UI.panelRect = { x, y, w, h };
    ctx.globalAlpha = sat(M.t * 6 + .25);
    UI.plate(x, y, w, h, { bd: c.bdHi });
    // Tabs.
    const tabs = [['beasts', 'Bestiary'], ['story', 'Story'], ['records', 'Records']], tw = Math.floor((inner - 2 * gap) / 3);
    tabs.forEach(([k, l], i) => button('ct' + k, x + p + i * (tw + gap), y + p, tw, bh, l, ps, () => { M.tab = k; M.page = 0; }, { on: tab === k }));
    const y0 = y + p + bh + gap * 2, foot = bh + gap, avail = y + h - p - foot - y0;
    let rows = [];
    if (tab === 'beasts') {
      const keys = Object.keys(MON).filter(k => k !== 'slimelet'), seen = keys.filter(k => META.seen[k]).length;
      tx('Met in your runs: ' + seen + ' of ' + keys.length, x + p, y0, ps, c.dim);
      const rh = L * 3 + gap, per = Math.max(1, Math.floor((avail - L - gap) / rh)); M.pages = Math.ceil(keys.length / per); M.page = Math.min(M.page, M.pages - 1);
      keys.slice(M.page * per, M.page * per + per).forEach((k, i) => {
        const d = MON[k], yy = y0 + L + gap + i * rh, known = META.seen[k];
        tx(known ? (d.boss ? 'Boss: ' : '') + d.name : '???', x + p, yy, ps, known ? (d.boss ? c.ember : c.amber) : '#5a5448');
        if (known) wrap(d.tip || 'Bones and spite. The plainest of the dead.', inner, ps).slice(0, 2).forEach((l, j) => tx(l, x + p, yy + L * (j + 1), ps, c.tx));
      });
    } else if (tab === 'story') {
      const ids = BEAT_ORDER.filter(k => BEATS[k]), rh = Math.max(bh, L + 2 * p) + gap, per = Math.max(1, Math.floor(avail / rh)); M.pages = Math.ceil(ids.length / per); M.page = Math.min(M.page, M.pages - 1);
      ids.slice(M.page * per, M.page * per + per).forEach((k, i) => {
        const yy = y0 + i * rh, known = META.story[k];
        button('cs' + k, x + p, yy, inner, rh - gap, known ? BEATS[k].title : '???', ps, () => { if (known) STORY.play(k, { replay: true }); }, { off: !known, offOk: false });
      });
    } else {
      const S = META.stats, tm = Math.round(S.time / 60);
      rows = [['Runs', S.runs], ['Embers earned', META.earned], ['Embers now', META.embers], ['Best wave', S.bestWave], ['Deepest land', S.bestLand], ['Deepest night land', S.bestNight], ['Campaigns beaten', S.campaigns], ['Heat unlocked', META.heatMax], ['Monsters slain', S.slain], ['Bosses slain', S.bosses], ['Time keeping', (tm >= 60 ? Math.floor(tm / 60) + ' h ' : '') + (tm % 60) + ' min'], ['Runs abandoned', S.abandons]];
      const rh = L + ps, per = Math.max(1, Math.floor(avail / rh)); M.pages = Math.ceil(rows.length / per); M.page = Math.min(M.page, M.pages - 1);
      rows.slice(M.page * per, M.page * per + per).forEach((r, i) => { const yy = y0 + i * rh; tx(r[0], x + p, yy, ps, c.dim); tx('' + r[1], x + w - p, yy, ps, c.tx, { align: 'r' }); });
    }
    // Pager and Back.
    const fy = y + h - p - bh, nb = M.pages > 1, bw3 = Math.floor((inner - 2 * gap) / 3);
    if (nb) {
      button('cprev', x + p, fy, bw3, bh, '<', ps, () => pageStep(-1), { off: M.page <= 0 });
      button('cnext', x + w - p - bw3, fy, bw3, bh, '>', ps, () => pageStep(1), { off: M.page >= M.pages - 1 });
      if (tab === 'beasts') tx((M.page + 1) + '/' + M.pages, x + w - p, y0, ps, c.dim, { align: 'r' });
    }
    button('cback', nb ? x + p + bw3 + gap : x + p, fy, nb ? bw3 : inner, bh, 'Back', ps, () => M.back(), { icon: 'back' });
    ctx.globalAlpha = 1;
  }

  // ---- the story panel ----
  function drawStory() {
    const q = STORY.cur, lines = STORY.lines(), ln = lines[STORY.line], who = SPEAKERS[ln[0]] || SPEAKERS.ghost, c = C(), s = E.s;
    const avW = E.Wr - E.iL - 8 * s, avH = E.Hb - E.iT - 8 * s;
    dim(.22);
    const lay = ps => {
      const p = 5 * ps, L = PX.LINE * ps, pk = Math.max(2, Math.round(L * 4.6 / 16)), PP = pk * 16;
      const w = Math.min(avW, 300 * ps), tw = w - PP - 3 * p;
      let mx = 1; for (const l of lines) mx = Math.max(mx, wrap(l[1], tw, ps).length);
      const h = Math.max(PP + 2 * p, p + L + gap(ps) + mx * L + gap(ps) + L + p);
      return { ps, p, L, pk, PP, w, tw, h, ok: h <= avH * .55 && tw >= 90 * ps };
    };
    const gap = ps => 3 * ps;
    let Ly = lay(s); while (Ly.ps > 2 && !Ly.ok) Ly = lay(Ly.ps - 1);
    const { ps, p, L, pk, PP, w, tw, h } = Ly, x = Math.round((E.iL + E.Wr) / 2 - w / 2), y = Math.round(E.Hb - h - 6 * s);
    UI.panelRect = { x, y, w, h };
    const a = sat(STORY.t * 6 + (STORY.line ? 1 : .2));
    ctx.globalAlpha = a;
    UI.plate(x, y, w, h, { bd: who.col === SPEAKERS.keeper.col ? c.bdHi : '#5a7a9a' });
    // Portrait in a dark frame, with a faint glow for the ghost.
    const px = x + p, py = y + p;
    ctx.fillStyle = '#05060a'; ctx.fillRect(px - pk, py - pk, PP + 2 * pk, PP + 2 * pk);
    ctx.save(); ctx.imageSmoothingEnabled = false;
    if (ln[0] === 'ghost') { ctx.globalAlpha = a * (.8 + .15 * Math.sin(M.t * 3)); ctx.shadowColor = 'rgba(160,210,255,0.8)'; ctx.shadowBlur = pk * 3; }
    if (ln[0] === 'hollow') { ctx.shadowColor = 'rgba(160,110,255,0.7)'; ctx.shadowBlur = pk * 3; }
    ctx.drawImage(portraitCanvas(ln[0]), px, py, PP, PP); ctx.restore(); ctx.globalAlpha = a;
    const tx0 = px + PP + 2 * p;
    tx(who.name, tx0, y + p, ps, who.col);
    const wl = wrap(ln[1], tw, ps); let left = Math.floor(STORY.chars);
    wl.forEach((l, i) => { if (left <= 0) return; const part = l.slice(0, left); left -= l.length + 1; tx(part, tx0, y + p + L + gap(ps) + i * L, ps, c.tx); });
    // Continue hint and Skip.
    const done = STORY.chars >= ln[1].length, hint = (STORY.line < lines.length - 1 ? (E.tch ? 'Tap' : 'Space') + ' →' : (E.tch ? 'Tap to close' : 'Space to close')) + '  ' + (STORY.line + 1) + '/' + lines.length;
    if (done) tx(hint, x + w - p, y + h - p - L + ps, ps, (M.t * 2) % 2 < 1.4 ? c.amber : c.dim, { align: 'r' });
    const sk = 'Skip', sw = mw(sk, ps) + 2 * p, sh = Math.max(L + p, E.tch ? Math.round(32 * E.dpr) : 0);
    button('stskip', x + w - sw - ps, y - sh - 2 * ps, sw, sh, sk, ps, () => STORY.skip(), { nav: false });
    ctx.globalAlpha = 1;
  }

  // ---- the tutorial guide ----
  function drawTutorial() {
    const tt = TUT.text(); if (!tt) return;
    const c = C(), s = E.s, avW = E.Wr - E.iL - 8 * s, ps = Math.max(2, s - (E.tch ? 0 : 0)), p = 5 * ps, L = PX.LINE * ps;
    const w = Math.min(avW, Math.max(mw(tt[0], ps) + 60 * ps, Math.min(avW, 200 * ps))), lines = wrap(tt[1], w - 2 * p, ps);
    const sk = 'Skip tutorial', skw = mw(sk, Math.max(2, ps - 1)) + 2 * p, skh = Math.max(L + p, E.tch ? Math.round(30 * E.dpr) : 0);
    const h = p + L + lines.length * L + p, x = Math.round((E.iL + E.Wr) / 2 - w / 2), y = Math.round(Math.max((R.hudTop || E.iT) + 30 * s, (UI.yUp || E.Hb) - h - 3 * s));
    const a = TUT.step === 'done' ? sat((4.5 - TUT.t) * 2) : sat(TUT.t * 3);
    ctx.globalAlpha = a;
    UI.plate(x, y, w, h, { bd: c.ember });
    tx(tt[0], x + p, y + p - ps, ps, c.amber);
    lines.forEach((l, i) => tx(l, x + p, y + p - ps + L * (i + 1), ps, c.tx));
    if (TUT.step !== 'done') button('tutskip', x + w - skw, y - skh - ps, skw, skh, sk, Math.max(2, ps - 1), () => TUT.skip(), { nav: false });
    // Point at the thing to use.
    let ax = null, ay = null;
    if (TUT.step === 'build' && TUT.pad && !TUT.pad.tower && !UI.menu) { const q = UI.proj(TUT.pad.x, TUT.pad.y + 1.6, TUT.pad.z); ax = q.x; ay = q.y; }
    else if (TUT.step === 'upgrade' && !UI.menu) { const t = G.towers.find(t => t.alive && t.def && t.lvl === 0 && t.state === 'active'); if (t) { const q = UI.proj(t.x, t.y + Math.min(3.6, t.mounts ? t.mounts.top : 2.5) + .8, t.z); ax = q.x; ay = q.y; } }
    else if (TUT.step === 'call' && UI.waveRect) { ax = UI.waveRect.x + UI.waveRect.w / 2; ay = UI.waveRect.y + UI.waveRect.h + 12 * s; }
    else if (TUT.step === 'spell' && !UI.spell) { const k = SPELL_KINDS.find(k => spellReady(k)), b = k && UI.hud.find(h => h.id === 'sp' + k); if (b) { ax = b.x + b.w / 2; ay = b.y - 14 * s; } }
    if (ax !== null) {
      const up = TUT.step === 'call', bob = Math.sin(M.t * 6) * 3 * s, k = Math.max(4, s * 2), g = up ? '↑' : '↓';
      tx(g, ax, ay + (up ? -bob : bob) - (up ? 0 : PX.LINE * k), k, '#ffc870', { align: 'c', outline: '#2a0c04' });
    }
    ctx.globalAlpha = 1;
  }

  // ---- HUD: Heat badge and mutator icons under the top plates ----
  function drawModHud() {
    if (!inRun() || G.phase !== 'play' || UI.scr) return;
    const mods = activeMods(); if (!mods.length && !G.heat) return;
    const c = C(), s = E.s, ps = Math.max(2, s - 1), p = 2 * ps, sz = 10 * ps + 2 * p, gap = 2 * ps, ents = [];
    if (G.heat) ents.push({ id: 'hudheat', icon: 'heat', label: '' + G.heat, head: 'Heat ' + G.heat + ' · ' + HEAT[G.heat].name, tip: HEAT.slice(1, G.heat + 1).map(h => h.tip).join(' ') });
    for (const m of mods) ents.push({ id: 'hudmod' + m.key, icon: m.icon && PX.iconSize(m.icon)[0] ? m.icon : 'heat', head: m.name, tip: m.tip, boon: MUTATORS[m.key] && MUTATORS[m.key].boon });
    let tw = 0; for (const e of ents) tw += sz + (e.label ? mw(e.label, ps) + ps : 0) + gap; tw -= gap;
    let x = Math.round((E.iL + E.Wr) / 2 - tw / 2); const y = Math.round((R.hudTop || E.iT) + 3 * s);
    for (const e of ents) {
      const w = sz + (e.label ? mw(e.label, ps) + ps : 0), hot = E.over(x, y, w, sz);
      UI.hud.push({ id: e.id, x, y, w, h: sz, hud: true, fn: () => { M.hudTip = { head: e.head, tip: e.tip, t: 0 }; sfx('uiHover', CAM.x, CAM.z, .6); } }); if (hot) { UI.hudHot = true; if (!M.hudTip || M.hudTip.head !== e.head) M.hudTip = { head: e.head, tip: e.tip, t: 3.5 }; }
      UI.plate(x, y, w, sz, { bd: hot ? c.bdHi : e.boon ? '#5f8a50' : e.id === 'hudheat' ? c.ember : '#6a4a3a', bg: 'rgba(9,11,17,0.8)' });
      const [iw, ih] = PX.iconSize(e.icon); PX.icon(ctx, e.icon, x + p + Math.round((10 * ps - iw * ps) / 2), y + Math.round((sz - ih * ps) / 2), ps, 1);
      if (e.label) tx(e.label, x + sz, y + Math.round((sz - PX.LINE * ps) / 2) + ps, ps, c.ember);
      x += w + gap;
    }
    if (M.hudTip) {
      const t = M.hudTip, a = sat((5 - t.t) * 2), lines = wrap(t.tip, Math.min(E.Wr - E.iL - 20 * s, 180 * ps), ps), pp = 4 * ps, L = PX.LINE * ps;
      let w = mw(t.head, ps); for (const l of lines) w = Math.max(w, mw(l, ps)); w += 2 * pp; const h = L * (lines.length + 1) + 2 * pp - ps, xx = Math.round((E.iL + E.Wr) / 2 - w / 2), yy = y + sz + 2 * s;
      ctx.globalAlpha = a; UI.plate(xx, yy, w, h, { bd: c.bdHi }); tx(t.head, xx + pp, yy + pp - ps, ps, c.amber); lines.forEach((l, i) => tx(l, xx + pp, yy + pp - ps + L * (i + 1), ps, c.tx)); ctx.globalAlpha = 1;
    }
  }

  // Called from UI.draw. hidden: the HUD was skipped (a screen is up). Returns nothing; registers controls.
  M.draw = (c, env) => {
    E = env; ctx = c; M.items.length = 0;
    const s = UI.scr;
    if (!s) { drawModHud(); if (TUT.step && !STORY.on()) drawTutorial(); }
    if (s === 'title') drawTitle(); else if (s === 'heat') drawHeat(); else if (s === 'tree') drawTree(); else if (s === 'codex') drawCodex();
    else if (s === 'pause') drawPause(); else if (s === 'confirm') drawConfirm(); else if (s === 'results') drawResults(); else if (s === 'arrival') drawArrival();
    // A story beat (a Codex replay too) sits over everything: the controls under it stop taking taps.
    if (STORY.on()) { M.items.length = 0; UI.btns.length = 0; drawStory(); }
    if (M.sel >= M.items.length) M.sel = Math.max(0, M.items.length - 1);
  };
  return M;
})();
