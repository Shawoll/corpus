"""Joint markers for the 3D skeleton (drawing tool only; build.py uses it).

joints.mjs lists each joint's sites with js/graph.js's side rules: a pair of
bone keys where two bones meet, or one grouped bone with joints inside it
(the intercarpal joints). Here each site becomes a point where the simplified
bone meshes come closest. A pair where one bone is a group (metacarpals and
hand phalanges) gives one point per place the two touch, so each finger's
knuckle gets its own marker. Every joint key becomes one mesh of small spheres.
"""
import json
import pathlib
import subprocess

import numpy as np

HERE = pathlib.Path(__file__).parent


def sites():
    out = subprocess.run(['node', str(HERE / 'joints.mjs')], capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def nearest(a, b, chunk=256):
    """For each point of a, the distance to and index of the nearest point of b."""
    d = np.empty(len(a))
    idx = np.empty(len(a), dtype=np.int64)
    for i in range(0, len(a), chunk):
        dd = ((a[i:i + chunk, None, :] - b[None]) ** 2).sum(-1)
        j = dd.argmin(1)
        idx[i:i + chunk] = j
        d[i:i + chunk] = np.sqrt(dd[np.arange(len(j)), j])
    return d, idx


def clusters(pts, link):
    """Group points that are within link of each other (single linkage); the centre of each group."""
    labels = np.full(len(pts), -1)
    c = 0
    for i in range(len(pts)):
        if labels[i] >= 0:
            continue
        labels[i] = c
        stack = [i]
        while stack:
            p = stack.pop()
            near = np.nonzero((labels < 0) & (((pts - pts[p]) ** 2).sum(1) < link * link))[0]
            labels[near] = c
            stack.extend(near.tolist())
        c += 1
    return [pts[labels == k].mean(0) for k in range(c)]


def contact(A, B, many):
    """Where two meshes (vertex arrays, metres) meet: one point, or one per place they touch if many."""
    lo = np.maximum(A.min(0), B.min(0)) - 0.02
    hi = np.minimum(A.max(0), B.max(0)) + 0.02
    a = A[np.all((A >= lo) & (A <= hi), 1)]
    b = B[np.all((B >= lo) & (B <= hi), 1)]
    if not len(a) or not len(b):
        a, b = A, B
    d, j = nearest(a, b)
    k = int(d.argmin())
    if not many:
        return [(a[k] + b[j[k]]) / 2]
    keep = d <= max(d[k] + 0.002, 0.005)
    return clusters((a[keep] + b[j[keep]]) / 2, 0.008)


def icosphere():
    t = (1 + 5 ** 0.5) / 2
    v = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t),
         (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
    f = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6),
         (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10),
         (8, 6, 7), (9, 8, 1)]
    v = [np.array(p) / np.linalg.norm(p) for p in v]
    mid = {}

    def m(a, b):
        key = (min(a, b), max(a, b))
        if key not in mid:
            p = v[a] + v[b]
            v.append(p / np.linalg.norm(p))
            mid[key] = len(v) - 1
        return mid[key]

    out = []
    for a, b, c in f:  # one subdivision: 80 triangles
        ab, bc, ca = m(a, b), m(b, c), m(c, a)
        out += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
    return np.array(v, dtype=np.float32), np.array(out, dtype=np.uint32)


SPHERE = icosphere()


def markers(points, r):
    sv, sf = SPHERE
    vs = [sv * r + p for p in points]
    fs = [sf + i * len(sv) for i in range(len(points))]
    return np.concatenate(vs).astype(np.float32), np.concatenate(fs).astype(np.uint32)


def build(bones, groups):
    """bones: {bone key: vertices (m)}; groups: set of bone ids that stand for several bones.
    Returns {joint key: (vertices, faces, class)} for every joint whose bones are all in the model."""
    out = {}
    for jk, j in sites().items():
        pts, small = [], False
        for site in j['sites']:
            if not all(k in bones for k in site):
                continue
            many = any(k.split(':')[0] in groups for k in site)
            small = small or many
            if len(site) == 1:
                pts.append(bones[site[0]].mean(0))
            else:
                pts += contact(bones[site[0]], bones[site[1]], many)
        if pts:
            v, f = markers(pts, 0.0035 if small else 0.0055)
            out[jk] = (v, f, j['class'])
    return out
