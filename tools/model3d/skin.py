"""The 3D skin for "Where does it hurt?" (drawing tool only; build.py uses it).

The skin is Z-Anatomy's body-surface regions merged into one mesh (hair, nails
and the genitals left out, see GENITAL). Every vertex is given:

- its place in the 2D drawings' 480 × 1200 frame, from a fit between the 3D
  bones and the bones of assets/svg/skeleton-anterior.svg (an affine fit, plus
  each bone's own offset spread by inverse distance, so the arms' pose and the
  proportions of the drawings are followed);
- the "Where does it hurt?" area it lies in: the region shapes of
  assets/svg/regions-anterior.svg for skin that faces forward, of
  regions-posterior.svg for skin that faces back (both use the front frame).

So data/regions.json and the region drawings stay the only source of the areas:
rebuild the skin (build.py skin) after changing a region shape.
"""
import pathlib
import re
import sys
import xml.etree.ElementTree as ET

import numpy as np
import shapely
from shapely.geometry import Polygon
from shapely.ops import unary_union

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / 'realistic'))
from geometry import subpaths  # noqa: E402
from resolve import ROOT, base, clean  # noqa: E402

SVG = ROOT / 'assets' / 'svg'
HAIR = {'nail plate', 'nail plate (foot)', 'perionyx', 'perionyx (foot)', 'eyelashes', 'hairs of eyebrow',
        'hairs of head', 'pubic hairs'}
FLAT_SCALE = 16  # 2D coordinates are stored ×16 as int16
NEAR_PX = 14  # skin just outside every area still counts for the nearest one this close (2D units)


# The source is one male body. The skin is the same for every biological sex setting, so its genitals are left out
# (the patch lies over a closed surface, so no gap is left); the male organs show in the organs layer with Male chosen.
GENITAL = 'urogenital region'


def skin_parts(index):
    return [p for p in index if p['file'] == 'Regions100' and clean(p) and base(p['name']).lower() not in HAIR
            and base(p['name']).lower() != GENITAL and not any(c.startswith('Hairs') for c in p['chain'])]


def shapes(path, skip=()):
    """[(key, geometry)] for every element with a data-id, in document order (later is on top)."""
    root = ET.parse(path).getroot()
    out = []
    for e in root.iter():
        cid = e.get('data-id')
        if not cid:
            continue
        cls = set((e.get('class') or '').split())
        if cls & set(skip):
            continue
        paths = [p for p in e.iter() if p.tag.endswith('path') and p.get('d')]
        outline = [p for p in paths if 'b' in (p.get('class') or '').split()] or paths
        polys = []
        for p in outline:
            try:
                polys += [Polygon(pts).buffer(0) for pts in subpaths(p.get('d')) if len(pts) >= 3]
            except ValueError:
                continue
        if not polys:
            continue
        side = e.get('data-side')
        out.append((f'{cid}:{side}' if side else cid, unary_union(polys)))
    return out


def flat_fit(bones3d):
    """A function from 3D (x, y) in metres to the 2D frame, fitted on the bones both have."""
    flat = {}
    for k, g in shapes(SVG / 'skeleton-anterior.svg', skip=('jm',)):
        flat[k] = unary_union([flat[k], g]) if k in flat else g
    keys = [k for k in bones3d if k in flat and not flat[k].is_empty]
    l3 = np.array([bones3d[k].mean(0)[:2] for k in keys])
    l2 = np.array([[flat[k].centroid.x, flat[k].centroid.y] for k in keys])
    X = np.c_[l3, np.ones(len(l3))]
    M, *_ = np.linalg.lstsq(X, l2, rcond=None)
    res = l2 - X @ M

    def f(p):
        out = np.c_[p, np.ones(len(p))] @ M
        d2 = ((p[:, None, :] - l3[None]) ** 2).sum(-1)
        k = min(6, len(l3) - 1)
        idx = np.argpartition(d2, k, 1)[:, :k]
        w = 1 / (np.take_along_axis(d2, idx, 1) + 1e-5)
        return out + (w[..., None] * res[idx]).sum(1) / w.sum(1)[:, None]

    print(f'  skin: 2D fit on {len(keys)} bones, mean landmark error {np.abs(res).mean():.1f} before correction',
          file=sys.stderr)
    return f


def areas(flat, nz):
    """Index (into the returned key list, 0 = none) of the area each vertex lies in."""
    views = {v: shapes(SVG / f'regions-{v}.svg') for v in ('anterior', 'posterior')}
    keys = ['']
    ix = {}
    for v in views.values():
        for k, _ in v:
            if k not in ix:
                ix[k] = len(keys)
                keys.append(k)
    out = np.zeros(len(flat), dtype=np.int64)
    own = np.where(nz >= 0, 0, 1)
    names = ['anterior', 'posterior']
    for pass_, pick in ((0, lambda i: names[i]), (1, lambda i: names[1 - i])):  # own view first, then the other
        for vi in (0, 1):
            m = (own == vi) & (out == 0)
            if not m.any():
                continue
            idx = np.nonzero(m)[0]
            got = np.zeros(len(idx), dtype=np.int64)
            for k, g in views[pick(vi)]:
                got[shapely.contains_xy(g, flat[idx, 0], flat[idx, 1])] = ix[k]
            out[idx] = got
    # just outside every area (the drawn outline is slimmer than the body here and there): the nearest one
    for vi in (0, 1):
        idx = np.nonzero((own == vi) & (out == 0))[0]
        if not len(idx):
            continue
        pts = shapely.points(flat[idx])
        best = np.full(len(idx), np.inf)
        for k, g in views[names[vi]]:
            d = shapely.distance(g, pts)
            better = (d < best) & (d <= NEAR_PX)
            out[idx[better]] = ix[k]
            best = np.minimum(best, d)
    return out, keys
