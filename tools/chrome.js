// Finds a Chrome binary and the GL flags that suit this platform.
// Set CHROME to override the path.
const fs = require('fs');
const mac = process.platform === 'darwin';
const candidates = [process.env.CHROME,
  mac && '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].filter(Boolean);
let path = candidates.find(p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } });
if (!path && fs.existsSync('/opt/pw-browsers')) {
  const d = fs.readdirSync('/opt/pw-browsers').find(n => n.startsWith('chromium-'));
  for (const sub of ['chrome-linux/chrome', 'chrome-linux64/chrome']) if (d && fs.existsSync(`/opt/pw-browsers/${d}/${sub}`)) path = `/opt/pw-browsers/${d}/${sub}`;
}
if (!path) throw new Error('No Chrome found; set CHROME to its path.');
module.exports = { path, gl: mac ? ['--use-angle=metal'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] };
