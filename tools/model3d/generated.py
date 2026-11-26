"""Stand-in meshes for structures the source has no part for (drawing tool only; build.py uses it).

Lymph ducts and vessels, two nerves and five tendons are not in Z-Anatomy. Each
recipe here draws a plain tube (or, for the cisterna chyli, a small sac) along
a course anchored to source meshes that are there: vertebrae, veins, muscles,
bones. They are simple shapes, marked { generated: true } in the model, and the
app says so when one is selected.

A recipe gets ctx(key) → that structure's source vertices (metres) and parts(id,
side) → [(part name, vertices)], and returns (vertices, faces) for one key.
Coordinates: Y up, the body faces +Z, the body's right is x < 0.
"""
import numpy as np

from joints import SPHERE, contact

# ------------------------------------------------------------------ shapes


def catmull(points, samples=8):
    """A smooth curve through the points (centripetal enough for these gentle courses)."""
    p = np.asarray(points, dtype=np.float64)
    if len(p) < 3:
        t = np.linspace(0, 1, samples * 2)[:, None]
        return p[0] + (p[-1] - p[0]) * t
    ext = np.vstack([2 * p[0] - p[1], p, 2 * p[-1] - p[-2]])
    out = []
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1:i + 3]
        for t in np.linspace(0, 1, samples, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(p[-1])
    return np.array(out)


def tube(points, radius, sides=10, smooth=True):
    """A closed tube along a polyline (radius in metres, a number or one per point), with rounded-off ends."""
    c = catmull(points) if smooth else np.asarray(points, dtype=np.float64)
    n = len(c)
    r = np.full(n, radius) if np.isscalar(radius) else np.interp(np.linspace(0, 1, n), np.linspace(0, 1, len(radius)), radius)
    tang = np.gradient(c, axis=0)
    tang /= np.linalg.norm(tang, axis=1, keepdims=True) + 1e-12
    # parallel-transport frames, so the tube doesn't twist
    ref = np.array([0, 0, 1.0]) if abs(tang[0][2]) < 0.9 else np.array([1.0, 0, 0])
    nrm = np.cross(tang[0], ref)
    nrm /= np.linalg.norm(nrm)
    ring = np.linspace(0, 2 * np.pi, sides, endpoint=False)
    vs = []
    for i in range(n):
        if i:
            nrm = nrm - tang[i] * np.dot(nrm, tang[i])
            nrm /= np.linalg.norm(nrm) + 1e-12
        bi = np.cross(tang[i], nrm)
        vs.append(c[i] + r[i] * (np.cos(ring)[:, None] * nrm + np.sin(ring)[:, None] * bi))
    v = np.concatenate(vs)
    f = []
    for i in range(n - 1):
        for k in range(sides):
            a, b = i * sides + k, i * sides + (k + 1) % sides
            f += [(a, b, b + sides), (a, b + sides, a + sides)]  # wound to face outward
    v = np.vstack([v, c[0], c[-1]])
    s, e = len(v) - 2, len(v) - 1
    for k in range(sides):  # end caps
        f.append((s, (k + 1) % sides, k))
        f.append((e, (n - 1) * sides + k, (n - 1) * sides + (k + 1) % sides))
    return v.astype(np.float32), np.array(f, dtype=np.uint32)


def sac(centre, radii):
    sv, sf = SPHERE
    return (sv * np.asarray(radii) + centre).astype(np.float32), sf.copy()


def join(*meshes):
    vs, fs, n = [], [], 0
    for v, f in meshes:
        vs.append(v)
        fs.append(f + n)
        n += len(v)
    return np.concatenate(vs).astype(np.float32), np.concatenate(fs).astype(np.uint32)

# ------------------------------------------------------------------ landmarks


def lateral(side):
    """+1 points away from the midline on that side (the body's right is x < 0)."""
    return -1.0 if side == 'right' else 1.0


def front_of(v, half_width=0.012):
    """The front-most point of a vertebra's body (near the midline)."""
    m = np.abs(v[:, 0] - np.median(v[:, 0])) < half_width
    w = v[m] if m.any() else v
    return w[w[:, 2].argmax()]


def at_height(v, y, band=0.01):
    m = np.abs(v[:, 1] - y) < band
    return v[m] if m.any() else v[np.argsort(np.abs(v[:, 1] - y))[:20]]


def centreline(v, bins=18):
    """The course of a mostly up-and-down vessel: its mean point in slices of height, from the bottom up."""
    y = v[:, 1]
    edges = np.linspace(y.min(), y.max(), bins + 1)
    out = [v[(y >= a) & (y <= b)].mean(0) for a, b in zip(edges[:-1], edges[1:]) if ((y >= a) & (y <= b)).any()]
    return np.array(out)


def toward(a, b, d):
    u = b - a
    return a + u / (np.linalg.norm(u) + 1e-12) * d

# ------------------------------------------------------------------ recipes


def venous_angle(ctx, side):
    """Where the internal jugular and subclavian veins meet (the lymph ducts end here)."""
    return contact(ctx(f'internal-jugular-vein:{side}'), ctx(f'subclavian-vein:{side}'), False)[0]


def thoracic_duct(ctx, side):
    up = [front_of(ctx(k)) for k in ['l2', 'l1', 't12', 't10', 't8', 't6', 't4', 't2']]
    pts = []
    for i, p in enumerate(up):
        # right of the midline low in the chest, crossing to the left around T5
        x = -0.006 if i < 5 else 0.008
        pts.append(p + np.array([x, 0, 0.004]))
    end = venous_angle(ctx, 'left')
    arch = (pts[-1] + end) / 2 + np.array([0.004, 0.025, -0.005])
    return tube(pts + [arch, end], 0.0025)


def cisterna_chyli(ctx, side):
    c = (front_of(ctx('l1')) + front_of(ctx('l2'))) / 2 + np.array([-0.008, 0, 0.006])
    return sac(c, (0.006, 0.022, 0.005))


def right_lymphatic_duct(ctx, side):
    end = venous_angle(ctx, 'right')
    return tube([end + np.array([0.014, -0.012, -0.006]), end + np.array([0.006, -0.004, -0.002]), end], 0.002)


def limb_lymphatics(vein, nodes):
    def make(ctx, side):
        line = centreline(ctx(f'{vein}:{side}'))
        line = line + np.array([0, 0, 0.004])  # just in front of the vein they run with
        return tube(list(line) + [ctx(f'{nodes}:{side}').mean(0)], 0.0016)
    return make


def phrenic_nerve(ctx, side):
    lat = lateral(side)
    c4 = ctx('c4').mean(0)
    scal = at_height(ctx(f'scalenes:{side}'), c4[1], 0.012)
    p1 = scal[scal[:, 2].argmax()] + np.array([0, 0, 0.003])  # on the front of the anterior scalene
    p2 = contact(ctx(f'subclavian-artery:{side}'), ctx(f'subclavian-vein:{side}'), False)[0]
    heart = ctx('heart')
    mid = at_height(heart, heart[:, 1].mean(), 0.015)
    p3 = mid[(mid[:, 0] * lat).argmax()] + np.array([0.006 * lat, 0, 0])  # along the side of the heart
    dia = ctx('diaphragm')
    col = dia[np.abs(dia[:, 0] - p3[0]) < 0.015]
    col = col if len(col) else dia
    p4 = col[col[:, 1].argmax()]  # down onto the dome of the diaphragm
    return tube([p1, p2, (p2 + p3) / 2 + np.array([0.004 * lat, 0, 0.004]), p3, p4], 0.0013)


def cervical_plexus(ctx, side):
    lat = lateral(side)
    roots = []
    for k in ['c1', 'c2', 'c3', 'c4']:
        v = ctx(k)
        roots.append(v[(v[:, 0] * lat).argmax()])
    scm = ctx(f'sternocleidomastoid:{side}')
    band = at_height(scm, (scm[:, 1].min() + scm[:, 1].max()) / 2, 0.012)
    hub = band[band[:, 2].argmin()] + np.array([0, 0, -0.004])  # behind the middle of the muscle
    parts = [tube([r, (r + hub) / 2 + np.array([0, 0, -0.004]), hub], 0.0011) for r in roots]
    for d in ([0, 0.045, -0.012], [-0.04 * lat, -0.005, 0.03], [0.01 * lat, -0.05, 0.012]):  # occipital, neck, collarbone
        parts.append(tube([hub, hub + np.array(d) / 2, hub + np.array(d)], 0.001))
    return join(*parts)


def patellar_tendon(ctx, side):
    pat, tib = ctx(f'patella:{side}'), ctx(f'tibia:{side}')
    top = tib[tib[:, 1] > tib[:, 1].max() - 0.09]
    tuberosity = top[top[:, 2].argmax()]
    low = pat[pat[:, 1].argmin()]
    return tube([low, (low + tuberosity) / 2 + np.array([0, 0, 0.003]), tuberosity], 0.0075)


def quadriceps_tendon(ctx, side):
    pat, fem = ctx(f'patella:{side}'), ctx(f'femur:{side}')
    top = pat[pat[:, 1].argmax()]
    up = toward(top, fem.mean(0), 0.065) + np.array([0, 0, 0.012])  # in front of the femur
    return tube([top, (top + up) / 2 + np.array([0, 0, 0.004]), up], 0.009)


def rotator_cuff_tendons(ctx, side, parts):
    hum = ctx(f'humerus:{side}')
    head = hum[hum[:, 1] > hum[:, 1].max() - 0.06]
    out = []
    for name, v in parts('rotator-cuff', side):
        _, idx = np.unique(np.round(v, 4), axis=0, return_index=True)
        v = v[idx]
        d = np.linalg.norm(v[:, None, :] - head[None, ::4, :], axis=2).min(1)
        ins = v[d.argmin()]  # where the muscle meets the head of the humerus
        out.append(tube([toward(ins, v.mean(0), 0.03), ins], 0.004))
    return join(*out)


def epicondyle_tendon(group, medial):
    def make(ctx, side):
        lat = lateral(side)
        hum = ctx(f'humerus:{side}')
        low = hum[hum[:, 1] < hum[:, 1].min() + 0.05]
        e = low[(low[:, 0] * lat).argmin()] if medial else low[(low[:, 0] * lat).argmax()]
        return tube([e, toward(e, ctx(f'{group}:{side}').mean(0), 0.04)], 0.0045)
    return make


RECIPES = {
    'thoracic-duct': thoracic_duct,
    'cisterna-chyli': cisterna_chyli,
    'right-lymphatic-duct': right_lymphatic_duct,
    'arm-lymphatics': limb_lymphatics('basilic-vein', 'axillary-lymph-nodes'),
    'leg-lymphatics': limb_lymphatics('great-saphenous-vein', 'inguinal-lymph-nodes'),
    'phrenic-nerve': phrenic_nerve,
    'cervical-plexus': cervical_plexus,
    'patellar-tendon': patellar_tendon,
    'quadriceps-tendon': quadriceps_tendon,
    'rotator-cuff-tendons': rotator_cuff_tendons,
    'common-extensor-tendon': epicondyle_tendon('forearm-extensors', medial=False),
    'common-flexor-tendon': epicondyle_tendon('forearm-flexors', medial=True),
}
NEEDS_PARTS = {'rotator-cuff-tendons'}


def make(cid, side, ctx, parts):
    fn = RECIPES[cid]
    return fn(ctx, side, parts) if cid in NEEDS_PARTS else fn(ctx, side)
