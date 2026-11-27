// Tap debugging on real phones: open the game with #tdebug (e.g. .../Cloud-Hosted-Bot/#tdebug) and a small log at the
// top shows the build, the screen sizes and the last input events with what the game did with them. Off otherwise.
if (HASH.tdebug !== undefined) (function () {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:4px;top:4px;right:4px;z-index:99;pointer-events:none;font:11px/1.3 ui-monospace,Menlo,monospace;color:#9f9;background:rgba(0,0,0,.72);padding:4px;white-space:pre-wrap;word-break:break-all';
  document.body.appendChild(box);
  const log = [];
  const head = () => 'build ' + BUILD + ' · ' + innerWidth + 'x' + innerHeight + ' dpr ' + devicePixelRatio + ' R.dpr ' + (R.dpr || '?') + ' hud ' + (document.getElementById('hud') || {}).width + ' · touch ' + UI.touch + ' · sw ' + !!(navigator.serviceWorker && navigator.serviceWorker.controller) + ' · standalone ' + !!navigator.standalone;
  const show = () => { box.textContent = head() + '\n' + log.join('\n'); };
  const add = s => { log.push(s); if (log.length > 10) log.shift(); show(); };
  const btns = () => UI.btns.length + '/' + UI.hud.length;
  for (const t of ['pointerdown', 'pointerup', 'pointercancel', 'touchstart', 'touchend', 'touchcancel', 'click']) {
    window.addEventListener(t, e => {
      const p = e.touches ? (e.changedTouches[0] || {}) : e, x = Math.round(p.clientX), y = Math.round(p.clientY);
      add(t + (e.pointerType ? ':' + e.pointerType : '') + ' ' + x + ',' + y + ' scr=' + UI.scr + ' btns=' + btns() + (t === 'pointerdown' ? '' : ' press=' + UI.press + ' gest=' + (UI.gest && UI.gest.mode)));
      if (t === 'pointerdown') setTimeout(() => add('  -> down: press=' + UI.press + ' gest=' + (UI.gest && UI.gest.mode) + ' hud=' + (UI.gest && UI.gest.hud)), 0);
      if (t === 'pointerup') setTimeout(() => add('  -> after up: scr=' + UI.scr + ' mode=' + G.mode + ' sets=' + !!UI.sets), 0);
    }, true);
  }
  window.addEventListener('error', e => add('ERROR ' + (e.message || e)));
  window.addEventListener('unhandledrejection', e => add('REJECT ' + (e.reason && e.reason.message || e.reason)));
  setInterval(show, 1000); show();
})();
