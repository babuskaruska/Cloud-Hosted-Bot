# Saarepagar home-screen icon (Ash): a shiny braided kringel on a warm gingham tablecloth. Stdlib only.
# icon_png(size) -> PNG bytes. The art is rendered once at 512 px (a shaded tube along a pretzel curve,
# with the second half passing over the first) and resampled for smaller sizes.
import math, struct, zlib

# the kringel centre line (same shape as ART.drawKringel in 21-items.js), 100-unit space
KR = [30, 76, 50, 54, 64, 34, 78, 28, 89, 42, 84, 63, 68, 77, 50, 80, 32, 77, 16, 63, 11, 42, 22, 28, 36, 34, 50, 54, 70, 76]


def _catmull(pts, steps=14):
    n = len(pts); out = []
    for i in range(n - 1):
        p0 = pts[max(0, i - 1)]; p1 = pts[i]; p2 = pts[i + 1]; p3 = pts[min(n - 1, i + 2)]
        for k in range(steps):
            t = k / steps; t2 = t * t; t3 = t2 * t
            out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    out.append(pts[-1]); return out


def _hex(c): return tuple(int(c[i:i + 2], 16) / 255.0 for i in (1, 3, 5))


def _mix(a, b, t): return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


_CACHE = {}


def _render(S):
    if S in _CACHE: return _CACHE[S]
    sc, cx, cy = 0.92 / 100.0, 0.5, 0.52
    tr = lambda p: (cx + (p[0] - 50) * sc, cy + (p[1] - 54) * sc)
    pts = [tr((KR[i], KR[i + 1])) for i in range(0, len(KR), 2)]
    parts = [_catmull(pts[0:8]), _catmull(pts[7:15])]
    r, ol = 0.066, 0.014
    reach = r + ol + 0.03
    # segments: (part, ax, ay, bx, by, s0, len)
    segs = []
    for pi, P in enumerate(parts):
        s = 0.0
        for i in range(len(P) - 1):
            a, b = P[i], P[i + 1]; L = math.hypot(b[0] - a[0], b[1] - a[1])
            if L > 1e-9: segs.append((pi, a[0], a[1], b[0], b[1], s, L))
            s += L
    G = 24; grid = [[[] for _ in range(G)] for _ in range(G)]
    for si, sg in enumerate(segs):
        x0 = min(sg[1], sg[3]) - reach; x1 = max(sg[1], sg[3]) + reach; y0 = min(sg[2], sg[4]) - reach; y1 = max(sg[2], sg[4]) + reach
        for gy in range(max(0, int(y0 * G)), min(G - 1, int(y1 * G)) + 1):
            for gx in range(max(0, int(x0 * G)), min(G - 1, int(x1 * G)) + 1): grid[gy][gx].append(si)
    bg0, bg1, red = _hex('#fff4de'), _hex('#f8c494'), _hex('#e2786a')
    base, dark, outl, icing = _hex('#e8a050'), _hex('#b8682d'), _hex('#6b3a1e'), _hex('#fffaf0')
    lx, ly, lz = -0.45, -0.65, 0.62; ln = math.sqrt(lx * lx + ly * ly + lz * lz); lx, ly, lz = lx / ln, ly / ln, lz / ln
    px = 1.0 / S; rows = []
    for y in range(S):
        v = (y + 0.5) / S; row = bytearray([0])
        for x in range(S):
            u = (x + 0.5) / S
            # background: warm radial gradient with soft gingham stripes
            d = math.hypot(u - 0.5, v - 0.42) / 0.75
            col = _mix(bg0, bg1, min(1.0, d * d * 1.2))
            band = (int(u * 7) % 2) + (int(v * 7) % 2)
            col = _mix(col, red, 0.07 * band)
            cell = grid[min(G - 1, int(v * G))][min(G - 1, int(u * G))]
            if cell:
                best = [None, None]  # per part: (dist, qx, qy, s, side)
                sh = 9.0
                for si in cell:
                    pi, ax, ay, bx, by, s0, L = segs[si]
                    dx, dy = bx - ax, by - ay
                    t = ((u - ax) * dx + (v - ay) * dy) / (L * L)
                    t = 0.0 if t < 0 else 1.0 if t > 1 else t
                    qx, qy = ax + dx * t, ay + dy * t
                    dd = math.hypot(u - qx, v - qy)
                    b = best[pi]
                    if b is None or dd < b[0]:
                        best[pi] = (dd, qx, qy, s0 + t * L, (dx * (v - ay) - dy * (u - ax)) / L)
                    # shadow (offset down-right)
                    t2 = ((u - 0.012 - ax) * dx + (v - 0.03 - ay) * dy) / (L * L); t2 = 0.0 if t2 < 0 else 1.0 if t2 > 1 else t2
                    ds = math.hypot(u - 0.012 - ax - dx * t2, v - 0.03 - ay - dy * t2)
                    if ds < sh: sh = ds
                if sh < r + 0.03:
                    a = min(1.0, (r + 0.03 - sh) / 0.03) * 0.28
                    col = _mix(col, (0.45, 0.22, 0.1), a)
                for pi in (0, 1):  # part 1 is drawn over part 0
                    b = best[pi]
                    if b is None or b[0] > r + ol + px: continue
                    dd, qx, qy, s, side = b
                    k = min(dd / r, 1.0)
                    nx, ny = (u - qx) / max(dd, 1e-9) * k, (v - qy) / max(dd, 1e-9) * k
                    nz = math.sqrt(max(0.0, 1 - nx * nx - ny * ny))
                    diff = max(0.0, nx * lx + ny * ly + nz * lz)
                    # braid twist: diagonal bands along the strand
                    tw = math.sin(s * 70.0 + side / r * 1.6)
                    c = _mix(dark, base, 0.72 + 0.28 * tw)
                    c = tuple(min(1.0, ch * (0.62 + 0.55 * diff)) for ch in c)
                    rz = 2 * diff * nz - lz
                    spec = max(0.0, rz) ** 18 * 0.55
                    c = _mix(c, (1, 1, 1), spec)
                    # icing drizzle and sugar on the top strand
                    zz = abs(side + r * 0.15 - r * 0.55 * math.sin(s * 48.0 + pi * 2))
                    if zz < r * 0.16: c = _mix(c, icing, 0.92 * min(1.0, (r * 0.16 - zz) / px + 0.5))
                    # outline + anti-aliasing
                    inner = min(1.0, max(0.0, (r - dd) / px + 0.5))
                    c = _mix(outl, c, inner)
                    cov = min(1.0, max(0.0, (r + ol - dd) / px + 0.5))
                    col = _mix(col, c, cov)
            row += bytes(int(max(0, min(255, ch * 255 + 0.5))) for ch in col)
        rows.append(row)
    _CACHE[S] = rows; return rows


def _png(size, rows):
    chunk = lambda t, b: struct.pack('>I', len(b)) + t + b + struct.pack('>I', zlib.crc32(t + b) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b''.join(bytes(r) for r in rows), 9)) + chunk(b'IEND', b'')


def icon_png(size):
    S = 512
    src = _render(S)
    if size == S: return _png(size, src)
    # box-filter resample from the 512 render
    f = S / size; out = []
    for y in range(size):
        y0 = y * f; y1 = y0 + f; row = bytearray([0])
        ys = range(int(y0), min(S, int(math.ceil(y1))))
        for x in range(size):
            x0 = x * f; x1 = x0 + f; acc = [0.0, 0.0, 0.0]; wsum = 0.0
            for sy in ys:
                wy = min(y1, sy + 1) - max(y0, sy); r = src[sy]
                for sx in range(int(x0), min(S, int(math.ceil(x1)))):
                    w = wy * (min(x1, sx + 1) - max(x0, sx)); o = 1 + sx * 3
                    acc[0] += r[o] * w; acc[1] += r[o + 1] * w; acc[2] += r[o + 2] * w; wsum += w
            row += bytes(int(a / wsum + 0.5) for a in acc)
        out.append(row)
    return _png(size, out)
