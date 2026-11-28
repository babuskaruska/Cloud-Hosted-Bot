// Placeholder boot (Mira replaces it): shows the name so the scaffold builds and loads.
(function () {
  const cv = document.getElementById('cv'), g = cv.getContext('2d'), d = Math.min(devicePixelRatio || 1, 3);
  cv.width = innerWidth * d; cv.height = innerHeight * d; g.scale(d, d);
  g.fillStyle = '#fbe9d0'; g.fillRect(0, 0, innerWidth, innerHeight);
  g.fillStyle = '#a0613a'; g.font = '700 28px system-ui'; g.textAlign = 'center'; g.fillText('Saarepagar', innerWidth / 2, innerHeight / 2);
  const l = document.getElementById('load'); if (l) l.remove();
})();
