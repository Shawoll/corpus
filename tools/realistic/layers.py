"""Realistic drawings for the soft-tissue layers (muscles, organs, vessels, nerves, lymphatics, ligaments).

    python3 tools/realistic/build.py            # builds these too: assets/svg/<layer>-<view>-realistic.svg

Unlike the skeleton, these keep the schematic outlines: every structure keeps its shape, id, side, classes and
paths, so the two styles always line up and the data check finds the same keys. The exception is the muscles: a
muscle with a builder in muscles.py (front) or muscles_back.py (back) gets that anatomy instead (redraw()), under the
same id, side and classes. Likewise a structure with an outline in outlines3d.json (written by
tools/model3d/build.py: the 3D model's mesh projected into this frame) takes that outline, so the organs follow the 3D
anatomy; its schematic detail lines, drawn for the old shape, give way to the edges between the model's parts. The realistic file adds form:
four form-shadow bands away from a light at the upper left and a lit rim (the same shading as the realistic bones,
coloured per layer through --shade / --lit in css/app.css), plus, per layer,

    fibres   finer fibre lines (.fb) between the drawn ones (.d), following the muscle's own fibre direction
    gloss    a soft sheen (.gl) inside the lit edge of smooth organs

The shading depth k scales with each shape's thickness (twice its area over its perimeter), so a thin nerve is
shaded as a round cord and a broad muscle as a gently curved sheet.
"""
import json
import re
from pathlib import Path

from shapely.geometry import LineString

from geometry import LIGHTS, Bone, area_d, line_d, polys_from_d, shift, subpaths, soften, unary_union
import muscles as MU

ROOT = Path(__file__).resolve().parents[2]
OUTLINES = Path(__file__).parent / 'outlines3d.json'
MODEL = json.loads(OUTLINES.read_text()) if OUTLINES.exists() else {}  # layer -> key -> path d (front frame)

# layer -> (k as a share of the shape's thickness, smallest k, largest k, extras)
LAYERS = {
    'muscles': (0.36, 0.5, 4.5, {'fibres'}),
    'organs': (0.34, 0.6, 5.5, {'gloss'}),
    'vessels': (0.42, 0.25, 1.6, set()),
    'nerves': (0.42, 0.25, 1.4, set()),
    'lymphatics': (0.4, 0.25, 2.4, {'gloss'}),
    'ligaments': (0.38, 0.25, 2.0, {'fibres'}),
}
GROUP = re.compile(r'^<g class="(s(?: [^"]*)?)"')
OPEN = re.compile(r'^<g class="s[^"]*" data-id="([^"]+)"(?: data-side="([^"]+)")?[^>]*>')
B_PATH = re.compile(r'<path class="b"[^>]*? d="([^"]*)"/>')
D_PATH = re.compile(r'<path class="d"[^>]*? d="([^"]*)"/>')


def evenodd(d):
    """The area a path covers with fill-rule evenodd: each subpath toggles what it covers (rings, holes)."""
    g = None
    for p in polys_from_d(d):
        g = p if g is None else g.symmetric_difference(p)
    return g


def polylines(d):
    out = []
    for pts in subpaths(d):
        if len(pts) >= 2:
            out.append(LineString(pts))
    return out


def resample(line, n):
    return [line.interpolate(i / (n - 1), normalized=True) for i in range(n)]


def between(a, b, t, n=24):
    """A line part way (t) from line a to line b, matched point for point along their lengths."""
    (ax0, ay0), (ax1, ay1) = a.coords[0], a.coords[-1]
    (bx0, by0), (bx1, by1) = b.coords[0], b.coords[-1]
    if (ax1 - ax0) * (bx1 - bx0) + (ay1 - ay0) * (by1 - by0) < 0:   # drawn the other way round
        b = LineString(list(b.coords)[::-1])
    pa, pb = resample(a, n), resample(b, n)
    return LineString([(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t) for p, q in zip(pa, pb)])


def fibres(body, d):
    """Fibre lines between each pair of neighbouring drawn fibres, clipped inside the shape."""
    lines = polylines(d)
    inner = body.buffer(-0.35)
    if inner.is_empty or len(lines) < 2:
        return None
    out = []
    for a, b in zip(lines, lines[1:]):
        if a.distance(b) > 12 or a.length < 3 or b.length < 3:
            continue
        gap = a.centroid.distance(b.centroid)
        steps = max(1, min(4, int(gap / 1.6)))
        out += [between(a, b, (i + 1) / (steps + 1)) for i in range(steps)]
    if not out:
        return None
    return line_d([l.intersection(inner) for l in out])


def gloss(body, k, light):
    inner = body.buffer(-k * 0.55)
    if inner.is_empty:
        return None
    sheen = inner.difference(shift(inner, light, k * 0.9))
    return area_d(soften(sheen, 0.25), 0.3, 0.6)


def from_model(line, layer):
    """The group with its outline replaced by the 3D model's (outlines3d.json), or None if it has none."""
    m = OPEN.match(line)
    if not m or layer not in MODEL:
        return None
    key = f'{m.group(1)}:{m.group(2)}' if m.group(2) else m.group(1)
    o = MODEL[layer].get(key)
    if not o or not o.get('b'):
        return None
    detail = f'<path class="d" d="{o["d"]}"/>' if o.get('d') else ''
    return m.group(0) + f'<path class="b" fill-rule="evenodd" d="{o["b"]}"/>{detail}</g>'


def redraw(line, layer, view):
    """The group with its outline, tendons and fibres replaced by the anatomy in muscles.py / muscles_back.py, or
    by the 3D model's outline."""
    m = OPEN.match(line)
    if m and layer in MODEL:
        return from_model(line, layer) or line
    if layer != 'muscles' or not m:
        return line
    mu = MU.muscle(m.group(1), m.group(2), view)
    if mu is None:
        return line
    body = mu.body
    parts = []
    if mu.tendons is not None and not mu.tendons.is_empty:
        parts.append(('c', area_d(mu.tendons.difference(body.buffer(-0.8)), 0.1)))
    parts.append(('b', area_d(body, 0.1)))
    if mu.marks is not None and not mu.marks.is_empty:
        parts.append(('c', area_d(mu.marks.intersection(body), 0.1)))
    if mu.lines:
        parts.append(('d', line_d([l.intersection(body.buffer(-0.3)) for l in mu.lines])))
    rule = {'b': ' fill-rule="evenodd"'}
    inner = ''.join(f'<path class="{c}"{rule.get(c, "")} d="{d}"/>' for c, d in parts if d)
    return m.group(0) + inner + '</g>'


def realistic_line(line, layer, light):
    m = GROUP.match(line)
    b = B_PATH.search(line)
    if not m or not b:
        return line
    body = evenodd(b.group(1))
    if body is None or body.is_empty or body.area < 0.5:
        return line
    share, kmin, kmax, extras = LAYERS[layer]
    thick = 2 * body.area / max(body.length, 1e-6)
    k = max(kmin, min(kmax, thick * share))
    parts = Bone(body, k).shading(light)
    if 'gloss' in extras and thick > 3:
        parts.append(('gl', gloss(body, k, light)))
    d = D_PATH.search(line)
    if 'fibres' in extras and d:
        parts.append(('fb', fibres(body, d.group(1))))
    paths = ''.join(f'<path class="{c}" d="{dd}"/>' for c, dd in parts if dd)
    return line[:b.end()] + paths + line[b.end():]


def build(layer, view):
    src = ROOT / f'assets/svg/{layer}-{view}.svg'
    dst = ROOT / f'assets/svg/{layer}-{view}-realistic.svg'
    light = LIGHTS[view]
    lines = [realistic_line(redraw(l, layer, view), layer, light) for l in src.read_text(encoding='utf8').split('\n')]
    text = '\n'.join(lines)
    text = re.sub(r'<title>(.*?)</title>', r'<title>\1 (realistic)</title>', text, count=1)
    dst.write_text(text, encoding='utf8')
    print(f'{dst.relative_to(ROOT)}: {len(text) / 1024:.0f} KB')
