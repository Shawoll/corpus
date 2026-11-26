"""Geometry and SVG output for the realistic drawings.

Shapes are built with shapely in the shared 480 x 1200 front frame (body's right at x < 240). A Bone holds one
structure's outline plus optional cartilage, recesses and detail lines; its svg() derives the form shading from
the light direction, so a shape mirrored for the other side, or drawn for the back view, is lit consistently.
"""
import math
import re

from shapely import affinity
from shapely.geometry import LineString, MultiPolygon, Point, Polygon, box
from shapely.ops import unary_union

MID = 240.0
# unit vector pointing toward the light, in frame coordinates. The back view is shown mirrored, so its light
# is mirrored too: on screen both views are lit from the upper left.
LIGHTS = {'anterior': (-0.84, -0.54), 'posterior': (0.84, -0.54)}

# ------------------------------------------------------------------ curves


def catmull(points, closed=True, samples=10):
    """Centripetal Catmull-Rom spline through points, as a dense list of points."""
    pts = list(points)
    n = len(pts)
    ext = [pts[-1]] + pts + [pts[0], pts[1]] if closed else [pts[0]] + pts + [pts[-1]]
    segs = n if closed else n - 1
    out = []

    def tj(ti, a, b):
        return ti + max(math.hypot(b[0] - a[0], b[1] - a[1]), 1e-6) ** 0.5

    for i in range(segs):
        p0, p1, p2, p3 = ext[i], ext[i + 1], ext[i + 2], ext[i + 3]
        t0 = 0.0
        t1 = tj(t0, p0, p1)
        t2 = tj(t1, p1, p2)
        t3 = tj(t2, p2, p3)
        for s in range(samples):
            t = t1 + (t2 - t1) * s / samples

            def lerp(a, b, ta, tb):
                return ((tb - t) / (tb - ta) * a[0] + (t - ta) / (tb - ta) * b[0],
                        (tb - t) / (tb - ta) * a[1] + (t - ta) / (tb - ta) * b[1])

            a1, a2, a3 = lerp(p0, p1, t0, t1), lerp(p1, p2, t1, t2), lerp(p2, p3, t2, t3)
            b1, b2 = lerp(a1, a2, t0, t2), lerp(a2, a3, t1, t3)
            out.append(lerp(b1, b2, t1, t2))
    if not closed:
        out.append(pts[-1])
    return out


def blob(points, samples=10):
    """A closed smooth shape through points."""
    return Polygon(catmull(points, True, samples)).buffer(0)


def curve(points, samples=10):
    """An open smooth line through points."""
    return LineString(catmull(points, False, samples))


def ell(cx, cy, rx, ry, rot=0):
    e = affinity.scale(Point(cx, cy).buffer(1, 40), rx, ry)
    return affinity.rotate(e, rot, origin=(cx, cy)) if rot else e


def circ(cx, cy, r):
    return Point(cx, cy).buffer(r, 40)


def tube(center, widths, samples=12):
    """A shaft along a smoothed centreline; a width is given at each control point and interpolated."""
    pts = catmull(center, False, samples)
    left, right = [], []
    for i, (x, y) in enumerate(pts):
        a, b = pts[max(i - 1, 0)], pts[min(i + 1, len(pts) - 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy) or 1
        nx, ny = -dy / L, dx / L
        f = i / samples
        k = min(int(f), len(widths) - 2)
        t = f - k
        w = (widths[k] * (1 - t) + widths[k + 1] * t) / 2
        left.append((x + nx * w, y + ny * w))
        right.append((x - nx * w, y - ny * w))
    return Polygon(left + right[::-1]).buffer(0)


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def fillet(g, r):
    """Close then open: rounds the seams where parts meet."""
    return g.buffer(r, 24).buffer(-r, 24)


def soften(g, r):
    return g.buffer(-r, 24).buffer(r, 24)


def mirror(g):
    return affinity.scale(g, -1, 1, origin=(MID, 0))


def both(g):
    """A midline structure from its right half."""
    return unary_union([g, mirror(g)])


def separate(parts, gap=0.5, later_on_top=True):
    """Small joint gaps between neighbouring bones of a group drawn as one shape (carpals, tarsals…)."""
    out = []
    for i, p in enumerate(parts):
        g = p
        others = parts[i + 1:] if later_on_top else parts[:i]
        for q in others:
            g = g.difference(q.buffer(gap))
        out.append(g)
    return unary_union(out)


def suture(line, amp=0.7, step=1.6):
    """A serrated suture line following a line."""
    L = line.length
    n = max(int(L / step), 2)
    pts = []
    for i in range(n + 1):
        d = L * i / n
        p = line.interpolate(d)
        q = line.interpolate(min(d + 0.3, L)) if d + 0.3 <= L else line.interpolate(max(d - 0.3, 0))
        dx, dy = q.x - p.x, q.y - p.y
        if d + 0.3 > L:
            dx, dy = -dx, -dy
        m = math.hypot(dx, dy) or 1
        s = amp * (1 if i % 2 else -1) * (0 if i in (0, n) else 1)
        pts.append((p.x - dy / m * s, p.y + dx / m * s))
    return LineString(pts)


def shift(g, light, k):
    return affinity.translate(g, light[0] * k, light[1] * k)


# ------------------------------------------------------------------ reading the schematic drawings


def polys_from_d(d):
    out = []
    for sub in re.findall(r'M[^M]*', d):
        nums = [float(x) for x in re.findall(r'-?\d+\.?\d*', sub)]
        pts = list(zip(nums[0::2], nums[1::2]))
        if len(pts) >= 3:
            out.append(Polygon(pts).buffer(0))
    return out


# ------------------------------------------------------------------ output


def polys(g):
    if g is None or g.is_empty:
        return []
    if isinstance(g, Polygon):
        return [g]
    return [p for p in getattr(g, 'geoms', []) if isinstance(p, Polygon)]


def num(v):
    s = f'{v:.1f}'
    if s == '-0.0':
        s = '0.0'
    s = s[:-2] if s.endswith('.0') else s
    return s.replace('0.', '.', 1) if s.startswith(('0.', '-0.')) else s


def pts_d(c):
    # "Mx y l dx dy dx dy …": relative steps between the rounded points are short and exact
    r = [(round(x, 1), round(y, 1)) for x, y in c]
    out = [f'{num(r[0][0])} {num(r[0][1])}']
    if len(r) > 1:
        out.append('l' + ' '.join(f'{num(b[0] - a[0])} {num(b[1] - a[1])}' for a, b in zip(r, r[1:])))
    return ''.join(out)


def ring_d(coords):
    c = list(coords)
    if len(c) > 1 and c[0] == c[-1]:
        c = c[:-1]
    return 'M' + pts_d(c) + 'Z' if len(c) >= 3 else ''


def area_d(g, tol=0.12, min_area=0.3):
    out = []
    for p in polys(g):
        p = p.simplify(tol, preserve_topology=True)
        if p.is_empty or p.area < min_area:
            continue
        out.append(ring_d(p.exterior.coords))
        out += [ring_d(h.coords) for h in p.interiors if Polygon(h).area >= min_area]
    return ''.join(out)


def line_d(lines, tol=0.08):
    out = []
    for ln in lines:
        for part in getattr(ln, 'geoms', [ln]):
            if part.is_empty or part.length < 0.6:
                continue
            out.append('M' + pts_d(part.simplify(tol).coords))
    return ''.join(out)


# ------------------------------------------------------------------ a drawn structure


class Bone:
    """One structure instance.

    body: outline (Polygon or MultiPolygon, holes allowed); k: shading depth, about a third of the bone's
    typical width; cart: cartilage areas (drawn as .c, clipped to the body unless cart_outside); fossa: dark
    recesses (.f); lines: detail LineStrings (.d); hollow: concave areas shaded on their lit side (a fossa
    catches light on the far wall); cast: extra shadow areas inside the body."""

    def __init__(self, body, k=4.0, cart=None, fossa=None, lines=(), hollow=None, cast=None,
                 cart_outside=False, light=True):
        self.body, self.k, self.cart, self.fossa = body, k, cart, fossa
        self.lines, self.hollow, self.cast = list(lines), hollow, cast
        self.cart_outside, self.light = cart_outside, light
        self.contact = None  # set by add_contact_shadows()

    def mirrored(self):
        m = lambda g: mirror(g) if g is not None else None
        return Bone(mirror(self.body), self.k, m(self.cart), m(self.fossa), [mirror(l) for l in self.lines],
                    m(self.hollow), m(self.cast), self.cart_outside, self.light)

    def svg(self, attrs, cls, light):
        b = self.body
        parts = [('b', area_d(b, 0.1))]
        if self.cart is not None:
            c = self.cart if self.cart_outside else self.cart.intersection(b)
            parts.append(('c', area_d(c)))
        parts += self.shading(light)
        if self.fossa is not None:
            parts.append(('f', area_d(self.fossa.intersection(b))))
        if self.lines:
            clipped = [l.intersection(b.buffer(0.2)) for l in self.lines]
            parts.append(('d', line_d(clipped)))
        rule = {'b': ' fill-rule="evenodd"'}
        inner = ''.join(f'<path class="{c}"{rule.get(c, "")} d="{d}"/>' for c, d in parts if d)
        return f'<g class="{cls}" {attrs}>{inner}</g>'

    def shading(self, light):
        """The form-shadow bands (.sh1–.sh4) away from the light and the lit rim (.hl), as (class, d) pairs."""
        b, k, parts = self.body, self.k, []
        bands = [b.difference(shift(b, light, k * f)) for f in (1.0, 0.66, 0.4, 0.17)]
        extra = []
        if self.hollow is not None:
            h = self.hollow
            extra.append((0, h.difference(shift(h, light, -k * 1.1)).intersection(h)))
            extra.append((1, h.difference(shift(h, light, -k * 0.55)).intersection(h)))
        if self.cast is not None:
            extra.append((1, self.cast))
        if self.contact is not None:
            soft, core = self.contact
            extra += [(0, soft), (1, core), (2, core)]
        for i, g in extra:
            bands[i] = bands[i].union(g.intersection(b))
        for i, band in enumerate(bands):
            parts.append((f'sh sh{i + 1}', area_d(band, 0.34, 0.6)))
        if self.light:
            parts.append(('hl', area_d(soften(b.difference(shift(b, light, -k * 0.28)), 0.2), 0.4, 0.8)))
        return parts


def add_contact_shadows(items, light, k=1.9):
    """items: [(cls, Bone)] in draw order. A bone lying on top of another casts a soft shadow onto it, down and
    away from the light. Structures behind the body (.back) neither cast nor receive."""
    away = (-light[0], -light[1])
    for i, (cls, lower) in enumerate(items):
        if 'back' in cls.split():
            continue
        lb = lower.body
        soft, core = [], []
        for cls2, upper in items[i + 1:]:
            if 'back' in cls2.split():
                continue
            ub = upper.body
            if not lb.buffer(k).intersects(ub):
                continue
            s = affinity.translate(ub, away[0] * k, away[1] * k).difference(ub).intersection(lb)
            c = affinity.translate(ub, away[0] * k * 0.45, away[1] * k * 0.45).difference(ub).intersection(lb)
            if not s.is_empty:
                soft.append(s)
            if not c.is_empty:
                core.append(c)
        if soft:
            lower.contact = (unary_union(soft), unary_union(core) if core else Polygon())


__all__ = [n for n in dir() if not n.startswith('_')] + ['box', 'unary_union', 'affinity', 'Polygon',
                                                         'MultiPolygon', 'LineString', 'Point']
