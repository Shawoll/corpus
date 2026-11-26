"""Outlines of 3D meshes in the 2D drawings' frame (drawing tool only; build.py uses it).

Each structure's mesh is projected straight along the depth axis (front and back
views share one outline: the back drawings use the front frame) and mapped into
the 480 × 1200 frame by the bone-based fit of skin.py. The union of its projected
triangles is the silhouette. tools/realistic/layers.py draws these outlines in
the realistic files instead of the schematic ones, so the 2D anatomy follows the
3D model.

A structure made of several source parts (lung lobes, heart chambers, colon
segments) also gets detail lines: the edges between its parts where they are in
view, nearest part first, so an edge hidden behind another part isn't drawn.

Output: tools/realistic/outlines3d.json = { layer: { key: { b: outline path d, d: detail lines d } } }.
"""
import json
import pathlib
import sys

import numpy as np
import shapely
from shapely.geometry import Polygon
from shapely.ops import unary_union

HERE = pathlib.Path(__file__).parent
OUT = HERE.parent / 'realistic' / 'outlines3d.json'
LAYERS = {'organs', 'vessels', 'nerves', 'lymphatics', 'ligaments'}  # realistic drawings that follow the model
DETAIL = {'organs'}  # layers that also get the edges between parts (on thin tubes they'd only be cross-hatching)
MIN_AREA = 14.0  # 2D units²: smaller shapes (the pineal gland) are grown to stay tappable
MAX_PARTS = 12  # more parts than this (the brain's gyri) would be a tangle of lines: no detail
MIN_HOLE = 80.0  # 2D units²: smaller holes are gaps between loops (the small intestine), not openings: filled


def ring_d(coords):
    pts = list(coords)[:-1]
    return 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + 'Z'


def to_d(g):
    """A polygon (with holes) or multipolygon as one path: draw it with fill-rule evenodd."""
    polys = getattr(g, 'geoms', [g])
    out = []
    for p in polys:
        if p.is_empty or p.geom_type != 'Polygon':
            continue
        out.append(ring_d(p.exterior.coords))
        out += [ring_d(r.coords) for r in p.interiors]
    return ''.join(out)


def projected(v, f, fit):
    flat = fit(v[:, :2].astype(np.float64))
    tris = shapely.polygons(flat[f])
    return unary_union(tris[shapely.area(tris) > 1e-4])


def silhouette(v, f, fit):
    """The outline of a mesh seen from the front, in the 2D frame: the union of its projected triangles."""
    g = projected(v, f, fit)
    # close the hairline gaps between triangles, round off the stair-steps, drop slivers
    g = g.buffer(0.35, join_style='round').buffer(-0.35, join_style='round')
    if g.area < MIN_AREA:
        g = g.buffer((MIN_AREA / np.pi) ** 0.5 - (g.area / np.pi) ** 0.5)
    g = unary_union([Polygon(p.exterior, [r for r in p.interiors if Polygon(r).area >= MIN_HOLE])
                     for p in getattr(g, 'geoms', [g]) if p.geom_type == 'Polygon'])
    g = g.simplify(0.18, preserve_topology=True)
    if g.geom_type == 'MultiPolygon':  # crumbs left by the simplification
        g = unary_union([p for p in g.geoms if p.area > 0.6])
    return g


def lines_d(g):
    out = []
    for ln in getattr(g, 'geoms', [g]):
        if ln.is_empty or ln.geom_type not in ('LineString', 'LinearRing'):
            continue
        ln = ln.simplify(0.15)
        if ln.length < 1.5:
            continue
        out.append('M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in ln.coords))
    return ''.join(out)


def detail(parts, fit, body):
    """Edges between a structure's parts where they show, nearest first, inside its outline."""
    if not 2 <= len(parts) <= MAX_PARTS:
        return ''
    shapes = sorted(((projected(v, f, fit).buffer(0.2), float(v[:, 2].mean())) for v, f in parts if len(f)),
                    key=lambda x: -x[1])
    covered, edges = None, []
    for g, _ in shapes:
        seen = g if covered is None else g.difference(covered)
        if not seen.is_empty:
            edges.append(seen.boundary)
        covered = g if covered is None else covered.union(g)
    inner = body.buffer(-0.7)
    if inner.is_empty or not edges:
        return ''
    return lines_d(unary_union(edges).intersection(inner))


def write(layer, meshes, fit, parts=None):
    """meshes: {key: (vertices m, faces)}, parts: {key: [(vertices, faces) per source part]}.
    Adds the layer's outlines (and detail lines) to outlines3d.json."""
    data = json.loads(OUT.read_text()) if OUT.exists() else {}
    out = {}
    for k, (v, f) in sorted(meshes.items()):
        body = silhouette(v, f, fit)
        out[k] = {'b': to_d(body), 'd': detail((parts or {}).get(k, []), fit, body) if layer in DETAIL else ''}
    data[layer] = out
    OUT.write_text(json.dumps(data, indent=0, sort_keys=True) + '\n')
    size = sum(len(x['b']) + len(x['d']) for x in out.values())
    print(f'  {layer}: {len(data[layer])} outlines for the realistic drawings ({size / 1024:.0f} KB)', file=sys.stderr)
