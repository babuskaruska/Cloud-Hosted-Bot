#!/usr/bin/env python3
import glob
import re
import struct
import zlib
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def three_classic():
    src = open(os.path.join(ROOT, 'vendor', 'three.module.min.js'), encoding='utf-8').read()
    i = src.rfind('export{')
    j = src.rfind('}')
    body, names = src[:i], src[i + 7:j]
    pairs = []
    for item in names.split(','):
        item = item.strip()
        if not item:
            continue
        if ' as ' in item:
            local, public = item.split(' as ')
            pairs.append('%s:%s' % (public.strip(), local.strip()))
        else:
            pairs.append('%s:%s' % (item, item))
    out = 'var THREE=(function(){' + body + '\nreturn {' + ','.join(pairs) + '};})();'
    assert '</script' not in out
    return out


def game():
    parts = []
    for path in sorted(glob.glob(os.path.join(ROOT, 'src', '*.js'))):
        parts.append(open(path, encoding='utf-8').read())
    code = "(function(){\n'use strict';\n" + '\n'.join(parts) + '\n})();'
    assert '</script' not in code
    return code


# Home-screen icons for the installable web app (iPhone "Add to Home Screen", Android install). The lantern is the
# favicon's pixel art: a 16x16 grid of polygons, rasterised and scaled with a margin. Pure stdlib PNG writer.
LANTERN = [('#ff8a3c', 'M7 2h2v2h1v2h1v2h1v3h-1v2H9v1H7v-1H5v-2H4V8h1V6h1V4h1z'),
           ('#ffe2a0', 'M7 7h2v2h1v2H9v1H7v-1H6V9h1z')]


def _poly(d):
    pts, x, y = [], 0, 0
    for cmd, num in re.findall(r'([MhvHVz])\s*(-?\d*)', d):
        n = int(num) if num else 0
        if cmd == 'M': x, y = n, int(re.search(r'M\s*\d+\s+(\d+)', d).group(1))
        elif cmd == 'h': x += n
        elif cmd == 'v': y += n
        elif cmd == 'H': x = n
        elif cmd == 'V': y = n
        else: continue
        pts.append((x, y))
    return pts


def _inside(pts, px, py):
    c = False
    for i in range(len(pts)):
        (x1, y1), (x2, y2) = pts[i], pts[i - 1]
        if (y1 > py) != (y2 > py) and px < (x2 - x1) * (py - y1) / (y2 - y1) + x1:
            c = not c
    return c


def icon_png(size):
    bg = (9, 11, 17); grid = [[bg] * 16 for _ in range(16)]
    for col, d in LANTERN:
        pts, rgb = _poly(d), tuple(int(col[i:i + 2], 16) for i in (1, 3, 5))
        for gy in range(16):
            for gx in range(16):
                if _inside(pts, gx + .5, gy + .5): grid[gy][gx] = rgb
    m = size // 8; cell = (size - 2 * m) / 16.0; rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            gx, gy = int((x - m) // cell), int((y - m) // cell)
            row += bytes(grid[gy][gx] if 0 <= gx < 16 and 0 <= gy < 16 else bg)
        rows.append(bytes(row))
    chunk = lambda t, b: struct.pack('>I', len(b)) + t + b + struct.pack('>I', zlib.crc32(t + b) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b''.join(rows), 9)) + chunk(b'IEND', b'')


def main():
    shell = open(os.path.join(ROOT, 'src', 'shell.html'), encoding='utf-8').read()
    html = shell.replace('/*__THREE__*/', three_classic()).replace('/*__GAME__*/', game())
    outs = [os.path.join(ROOT, 'index.html')] + sys.argv[1:]
    for out in outs:
        with open(out, 'w', encoding='utf-8') as f:
            f.write(html)
    for n in (180, 192, 512):
        with open(os.path.join(ROOT, 'icon-%d.png' % n), 'wb') as f:
            f.write(icon_png(n))
    print('built %d bytes -> %s (+ icons)' % (len(html), ', '.join(outs)))


if __name__ == '__main__':
    main()
