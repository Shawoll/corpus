"""Stand-in meshes for structures the source has no part for (drawing tool only; build.py uses it).

Lymph ducts and vessels, two nerves, five tendons, the breasts, the scrotum and
the whole female reproductive system are not in Z-Anatomy (it is one male body).
Each recipe here draws a plain tube, sac or fold along a course anchored to
source meshes that are there: vertebrae, veins, muscles, bones, the bladder and
rectum. They are simple shapes, marked { generated: true } in the model, and the
app says so when one is selected. The female organs sit in the male pelvis of
the source, so they are placed by its landmarks, not by a female skeleton.

A recipe gets ctx(key) → that structure's source vertices (metres) and parts(id,
side) → [(part name, vertices)], and returns (vertices, faces) for one key, or
{sex: (vertices, faces)} when the id names one structure per sex (the breast).
SHELL lists stand-ins that lie over other organs (the breasts over the heart and
lungs, the scrotum round the testes): the app draws them see-through unless they
are selected, and taps go through them.
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


def unit(v):
    v = np.asarray(v, dtype=np.float64)
    return v / (np.linalg.norm(v) + 1e-12)


def per_point(value, n):
    """A number, or values spread evenly along the curve, as one value per curve point."""
    if np.isscalar(value):
        return np.full(n, float(value))
    return np.interp(np.linspace(0, 1, n), np.linspace(0, 1, len(value)), value)


def tube(points, radius, sides=10, smooth=True, depth=None, lateral=None, samples=8):
    """A closed tube along a polyline (radius in metres, a number or one per point), with rounded-off ends.
    With depth, the cross-section is an ellipse: radius across (along `lateral`, the body's x by default)
    and depth front to back, for flattened organs (the vagina, the uterus)."""
    c = catmull(points, samples) if smooth else np.asarray(points, dtype=np.float64)
    n = len(c)
    r = per_point(radius, n)
    d = r if depth is None else per_point(depth, n)
    tang = np.gradient(c, axis=0)
    tang /= np.linalg.norm(tang, axis=1, keepdims=True) + 1e-12
    if depth is not None:  # a fixed side-to-side axis, so the flat side stays flat
        lat = np.array([1.0, 0, 0]) if lateral is None else unit(lateral)
    else:  # parallel-transport frames, so the tube doesn't twist
        ref = np.array([0, 0, 1.0]) if abs(tang[0][2]) < 0.9 else np.array([1.0, 0, 0])
        nrm = unit(np.cross(tang[0], ref))
    ring = np.linspace(0, 2 * np.pi, sides, endpoint=False)
    vs = []
    for i in range(n):
        if depth is not None:
            nrm = unit(lat - tang[i] * np.dot(lat, tang[i]))
        elif i:
            nrm = unit(nrm - tang[i] * np.dot(nrm, tang[i]))
        bi = np.cross(tang[i], nrm)
        vs.append(c[i] + r[i] * np.cos(ring)[:, None] * nrm + d[i] * np.sin(ring)[:, None] * bi)
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
    return outward(v.astype(np.float32), np.array(f, dtype=np.uint32))


def outward(v, f):
    """Faces wound to face outward: a closed mesh with a negative signed volume is turned inside out."""
    a, b, c = v[f[:, 0]].astype(np.float64), v[f[:, 1]].astype(np.float64), v[f[:, 2]].astype(np.float64)
    return (v, f) if np.einsum('ij,ij->i', a, np.cross(b, c)).sum() >= 0 else (v, f[:, ::-1].copy())


def sac(centre, radii):
    sv, sf = SPHERE
    return (sv * np.asarray(radii) + centre).astype(np.float32), sf.copy()


def sphere(rings=18, segments=28):
    """A unit UV sphere (y is the pole axis), finer than joints.SPHERE, for shapes that are bent afterwards."""
    th = np.linspace(0, np.pi, rings + 1)[1:-1]
    ph = np.linspace(0, 2 * np.pi, segments, endpoint=False)
    t, p = np.meshgrid(th, ph, indexing='ij')
    v = np.stack([np.sin(t) * np.cos(p), np.cos(t), np.sin(t) * np.sin(p)], -1).reshape(-1, 3)
    v = np.vstack([[0, 1, 0], v, [0, -1, 0]])
    f = []
    for k in range(segments):  # wound to face outward
        f.append((0, 1 + (k + 1) % segments, 1 + k))
    for i in range(rings - 2):
        for k in range(segments):
            a, b = 1 + i * segments + k, 1 + i * segments + (k + 1) % segments
            f += [(a, b, b + segments), (a, b + segments, a + segments)]
    last, bottom = 1 + (rings - 2) * segments, len(v) - 1
    for k in range(segments):
        f.append((bottom, last + k, last + (k + 1) % segments))
    return v, np.array(f, dtype=np.uint32)


def blob(centre, axes, shape):
    """A bent sphere: shape(a, b, c) → (p, q, r), in the frame axes = (side, up, out), placed at centre."""
    v, f = sphere()
    p, q, r = shape(v[:, 0], v[:, 1], v[:, 2])
    ax = np.asarray(axes, dtype=np.float64)
    return outward((centre + p[:, None] * ax[0] + q[:, None] * ax[1] + r[:, None] * ax[2]).astype(np.float32), f)


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


# ---- the female pelvis, built round the source's bladder, rectum and pubic bones (one male body)


def pelvis(ctx):
    """Landmarks shared by the female organs: { os, fundus, axis, wide, intro, sym_low, sym_front }."""
    if 'pelvis' in _CACHE:
        return _CACHE['pelvis']
    bl, re = ctx('bladder'), ctx('rectum')
    hip = np.vstack([ctx('hip-bone:right'), ctx('hip-bone:left')])
    sym = hip[np.abs(hip[:, 0]) < 0.012]
    sym = sym[sym[:, 2] > np.percentile(sym[:, 2], 40)]  # the joint itself, not the rami behind it
    sym_low, sym_front = sym[sym[:, 1].argmin()], sym[sym[:, 2].argmax()]

    def gap(y):
        """The midline gap between the bladder (in front) and the rectum (behind) at a height: (back of one, front of other)."""
        b = at_height(bl[np.abs(bl[:, 0]) < 0.012], y, 0.004)
        r = at_height(re[np.abs(re[:, 0]) < 0.012], y, 0.004)
        return b[:, 2].min(), r[:, 2].max()
    y_os = bl[:, 1].min() + 0.024  # the cervix opens into the vagina a little above the bladder's neck
    b, r = gap(y_os)
    os_ = np.array([0, y_os, (b + r) / 2 - 0.004])
    # the body tips forward over the top of the bladder (anteverted), the fundus above its back half
    top = bl[:, 1].max()
    fundus = np.array([0, top + 0.026, bl[:, 2].mean() + 0.008])
    axis = unit(fundus - os_)
    # the vaginal opening: below and behind the lower edge of the pubic symphysis
    intro = sym_low + np.array([0, -0.05, -0.026])
    out = dict(os=os_, fundus=fundus, axis=axis, wide=fundus - axis * 0.016, intro=intro,
               sym_low=sym_low, sym_front=sym_front)
    _CACHE['pelvis'] = out
    return out


_CACHE = {}


def uterus(ctx, side):
    """A pear: the narrow cervix at the bottom, the body widening to a rounded fundus, bent a little forward."""
    pv = pelvis(ctx)
    os_, fd, ax = pv['os'], pv['fundus'], pv['axis']
    fwd = unit(np.cross(np.array([1.0, 0, 0]), ax))  # in the body's midline plane, at right angles to the axis
    if fwd[2] < 0:
        fwd = -fwd
    length = np.linalg.norm(fd - os_)
    pts = [os_ - ax * 0.004, os_ + ax * length * 0.3, os_ + ax * length * 0.62 + fwd * 0.004, fd + fwd * 0.002]
    t = np.linspace(0, 1, 12)
    end = np.sqrt(np.clip(1 - ((t - 0.78) / 0.22).clip(0) ** 2, 0, 1))  # the rounded fundus
    start = np.sqrt(np.clip(1 - ((0.08 - t) / 0.08).clip(0) ** 2, 0.25, 1))  # the rounded tip of the cervix
    width = np.interp(t, [0, 0.3, 0.42, 0.75, 1], [0.012, 0.012, 0.015, 0.026, 0.026]) * end * start
    depth = np.interp(t, [0, 0.3, 0.75, 1], [0.011, 0.011, 0.017, 0.017]) * end * start
    return tube(pts, np.maximum(width, 0.002), sides=20, depth=np.maximum(depth, 0.002), samples=12)


def vagina(ctx, side):
    """A flattened tube from the opening up and back to the vault round the cervix."""
    pv = pelvis(ctx)
    a, b = pv['intro'], pv['os'] - pv['axis'] * 0.006
    mid = (a + b) / 2 + np.array([0, 0, 0.004])
    return tube([a, mid, b], [0.011, 0.014, 0.017], sides=18, depth=[0.005, 0.006, 0.013], samples=10)


def vulva(ctx, side):
    """The mons pubis over the symphysis, the outer and inner labia either side of the opening, the clitoris."""
    pv = pelvis(ctx)
    sl, sf, intro = pv['sym_low'], pv['sym_front'], pv['intro']
    mons = blob(np.array([0, sf[1] - 0.002, sf[2] + 0.016]), np.eye(3),
                lambda a, b, c: (a * 0.027, b * 0.017, c * 0.0075))
    clit = sl + np.array([0, -0.008, 0.022])
    back = intro + np.array([0, -0.008, -0.004])  # where the labia meet behind the opening
    parts = [mons, sac(clit, (0.0035, 0.005, 0.004))]
    for lat in (-1, 1):
        outer = [np.array([lat * 0.012, sf[1] - 0.016, sf[2] + 0.016]), clit + np.array([lat * 0.015, -0.006, 0.004]),
                 (clit + back) / 2 + np.array([lat * 0.015, 0, 0.004]), back + np.array([lat * 0.009, 0, 0])]
        parts.append(tube(outer, [0.0045, 0.0065, 0.0065, 0.004], sides=14, depth=[0.006, 0.009, 0.009, 0.005]))
        inner = [clit + np.array([lat * 0.003, -0.004, 0]), (clit + back) / 2 + np.array([lat * 0.0055, 0, 0.001]),
                 back + np.array([lat * 0.004, 0.004, 0.002])]
        parts.append(tube(inner, [0.0018, 0.0028, 0.0015], sides=10, depth=[0.004, 0.006, 0.003]))
    return join(*parts)


def ovary_centre(ctx, side):
    """In the ovarian fossa on the side wall of the pelvis: between the external iliac vein in front and the
    ureter behind, a little below the brim."""
    lat = lateral(side)
    vein = [v for n, v in ctx.parts('iliac-vein', side) if n.startswith('External')][0]
    y = vein[:, 1].min() + 0.024
    v = at_height(vein, y, 0.005).mean(0)
    u = at_height(ctx(f'ureter:{side}'), y, 0.005).mean(0)
    c = (v + u) / 2
    c[0] = lat * max(abs(c[0]) + 0.004, 0.044)
    c[2] -= 0.004
    return c


def ovary(ctx, side):
    c = ovary_centre(ctx, side)
    lat = lateral(side)
    tilt = unit([lat * 0.25, 1, -0.15])  # the long axis nearly upright, its top a little out and back
    ax = (unit(np.cross(tilt, [0, 0, 1.0])), tilt, unit(np.cross([lat * 1.0, 0, 0], tilt)))
    return blob(c, ax, lambda a, b, cc: (a * 0.0075, b * 0.016, cc * 0.0055))


def uterine_tube(ctx, side):
    """From the horn of the uterus out to the side wall, arching over the ovary, its fringed funnel open behind it."""
    lat = lateral(side)
    pv = pelvis(ctx)
    horn = pv['wide'] + np.array([lat * 0.022, 0, 0])
    oc = ovary_centre(ctx, side)
    pts = [horn, (horn + oc) / 2 + np.array([0, 0.012, 0.004]), oc + np.array([lat * 0.004, 0.024, 0.002]),
           oc + np.array([lat * 0.009, 0.006, -0.01]), oc + np.array([lat * 0.002, -0.006, -0.012])]
    return tube(pts, [0.0022, 0.0028, 0.0042, 0.006, 0.0085], sides=12)


def gonadal(source, ctx, side):
    """The ovarian vessels: the testicular vessels' course down the back of the abdomen (the same origin and
    drainage), turning in over the pelvic brim to the ovary instead of out to the groin."""
    line = centreline(ctx(f'{source}:{side}'), bins=30)
    brim = ctx(f'hip-bone:{side}')[:, 1].max() - 0.03
    line = line[line[:, 1] > brim][::-1]  # from the top down
    oc = ovary_centre(ctx, side)
    lat = lateral(side)
    over = oc + np.array([lat * 0.008, 0.028, 0.002])
    return tube(list(line) + [(line[-1] + over) / 2, over, oc + np.array([0, 0.014, 0])],
                0.0016 if source == 'testicular-artery' else 0.0022, sides=8)


# ---- the breasts and the scrotum


def breast(ctx, side):
    """On the pectoralis major over the 2nd to 6th ribs, centred at the nipple line: a full mound for the
    female breast, a small flat disc for the male one."""
    lat = lateral(side)
    pec = ctx(f'pectoralis-major:{side}')
    y = (pec[:, 1].min() + pec[:, 1].max()) / 2 + 0.004
    near = pec[(np.abs(pec[:, 1] - y) < 0.02) & (np.abs(pec[:, 0] - lat * 0.1) < 0.02)]
    base = near[near[:, 2].argmax()]
    out = unit([lat * 0.3, 0.02, 0.95])
    up = unit(np.array([0, 1.0, 0]) - out * out[1])
    side_ax = unit(np.cross(up, out)) * (1 if lat > 0 else -1)
    ax = (side_ax, up, out)

    def mound(width, height, project, droop):
        def shape(a, b, c):
            front = np.clip(c, 0, None)
            # the outer half reaches further, toward the armpit; the lower half is fuller than the upper
            w = width * np.where(a > 0, 1.12, 1.0)
            h = height * np.where(b < 0, 1.05, 0.95)
            r = np.where(c > 0, c * project, c * 0.006)
            nipple = 0.004 * np.exp(-((a ** 2 + b ** 2) / 0.012)) * (c > 0)
            return a * w, b * h - droop * front ** 2, r + nipple
        return blob(base - out * 0.006, ax, shape)
    return {'female': mound(0.058, 0.054, 0.05, 0.016), 'male': mound(0.024, 0.022, 0.007, 0)}


def scrotum(ctx, side):
    """The sac round both testes and epididymes, with the raphe down its middle."""
    inside = np.vstack([ctx('testis:right'), ctx('testis:left'), ctx('epididymis:right'), ctx('epididymis:left')])
    lo, hi = inside.min(0), inside.max(0)
    c = (lo + hi) / 2 + np.array([0, -0.004, -0.002])
    half = (hi - lo) / 2 + np.array([0.008, 0.009, 0.007])

    def shape(a, b, cc):
        pinch = 1 - 0.14 * np.exp(-(a / 0.22) ** 2) * (b < 0.4)  # the groove between the two halves
        return a * half[0], b * half[1] * pinch + 0.006 * np.clip(b, 0, None) ** 2, cc * half[2] * pinch
    return blob(c, np.eye(3), shape)


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
    'uterus': uterus,
    'vagina': vagina,
    'vulva': vulva,
    'ovary': ovary,
    'uterine-tube': uterine_tube,
    'ovarian-artery': lambda ctx, side: gonadal('testicular-artery', ctx, side),
    'ovarian-vein': lambda ctx, side: gonadal('testicular-vein', ctx, side),
    'breast': breast,
    'scrotum': scrotum,
}
NEEDS_PARTS = {'rotator-cuff-tendons'}
SHELL = {'breast', 'scrotum'}


def make(cid, side, ctx, parts):
    fn = RECIPES[cid]
    ctx.parts = parts  # for recipes that need one named part of a structure (the external iliac vein)
    return fn(ctx, side, parts) if cid in NEEDS_PARTS else fn(ctx, side)
