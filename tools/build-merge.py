#!/usr/bin/env python3
# Builds the merge game (Saarepagar): merge/src/shell.html + merge/src/*.js (sorted) -> merge/index.html,
# plus home-screen icons. One offline file, plain 2D canvas, no dependencies.
import glob, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from build import icon_png  # reuse the stdlib PNG writer (lantern art) until merge has its own icon art


def main():
    d = os.path.join(ROOT, 'merge')
    parts = [open(p, encoding='utf-8').read() for p in sorted(glob.glob(os.path.join(d, 'src', '*.js')))]
    code = "(function(){\n'use strict';\n" + '\n'.join(parts) + '\n})();'
    assert '</script' not in code
    html = open(os.path.join(d, 'src', 'shell.html'), encoding='utf-8').read().replace('/*__GAME__*/', code)
    open(os.path.join(d, 'index.html'), 'w', encoding='utf-8').write(html)
    icon = os.path.join(d, 'src', 'icon.py')
    if os.path.exists(icon):
        ns = {}; exec(open(icon).read(), ns)
        for n in (180, 192, 512): open(os.path.join(d, 'icon-%d.png' % n), 'wb').write(ns['icon_png'](n))
    else:
        for n in (180, 192, 512): open(os.path.join(d, 'icon-%d.png' % n), 'wb').write(icon_png(n))
    print('built %d bytes -> merge/index.html' % len(html))


if __name__ == '__main__':
    main()
