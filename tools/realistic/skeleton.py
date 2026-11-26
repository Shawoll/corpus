"""Realistic skeleton, front (anterior) and back (posterior) views.

Every builder returns the right-side instance (x < 240) of a paired bone, or the whole of a midline bone, in the
shared front frame. Landmarks match the schematic drawings (joint markers, muscle attachments), so the other
layers stay aligned: hip joint at (180, 590), knee (199.5, 869.5), ankle (208, 1115.5), shoulder (133, 262),
elbow (107, 456), wrist (86, 631), temporomandibular joint (200.5, 129.5).
"""
from geometry import (MID, Bone, LineString, Polygon, affinity, blob, both, box, circ, curve, ell, fillet, lerp,
                      mirror, separate, soften, suture, tube, unary_union)


def sym(right):
    """A closed midline shape from the right half of its outline, listed from the top midline point down to the
    bottom midline point."""
    left = [(2 * MID - x, y) for x, y in reversed(right[1:-1])]
    return right + left


def symblob(right, samples=10):
    return blob(sym(right), samples)


def X(dx):
    return MID + dx


# ================================================================== spine

# intervertebral discs, top to bottom: (x0, x1, y0, y1), C2/C3 … L5/S1 (from the schematic drawing)
DISCS = [(231.5, 248.5, 160.2, 164.8), (231.0, 249.0, 172.7, 176.8), (230.5, 249.5, 184.7, 188.8),
         (229.9, 250.1, 196.7, 200.8), (229.4, 250.6, 208.7, 212.8), (228.9, 251.1, 220.7, 224.8),
         (228.9, 251.1, 235.7, 241.4), (228.5, 251.5, 252.3, 258.0), (228.1, 251.9, 268.9, 274.6),
         (227.7, 252.3, 285.5, 291.2), (227.3, 252.7, 302.1, 307.8), (227.0, 253.0, 318.7, 324.4),
         (226.6, 253.4, 335.3, 341.0), (226.2, 253.8, 351.9, 357.6), (225.8, 254.2, 368.5, 374.2),
         (225.4, 254.6, 385.1, 390.8), (225.1, 255.0, 401.7, 407.4), (224.7, 255.3, 418.3, 424.8),
         (224.1, 255.9, 441.2, 446.8), (223.5, 256.5, 463.2, 468.8), (222.8, 257.2, 485.2, 490.8),
         (222.2, 257.8, 507.2, 512.8), (221.7, 258.3, 529.2, 535.3)]
VERTS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10',
         't11', 't12', 'l1', 'l2', 'l3', 'l4', 'l5']
# half the full width of each vertebra including its transverse processes (schematic bounding boxes)
SPAN = dict(c1=26.2, c2=16.6, c3=16.6, c4=17.6, c5=18.1, c6=19.1, c7=21.6, t1=18.7, t2=19.0, t3=19.4, t4=19.7,
            t5=20.1, t6=20.5, t7=20.8, t8=21.2, t9=21.5, t10=21.9, t11=22.3, t12=22.6, l1=31.8, l2=34.8,
            l3=38.8, l4=35.8, l5=33.6)


def vert_range(name):
    """Top and bottom of the vertebral body, overlapping the discs slightly, and its half width."""
    i = VERTS.index(name)
    if name == 'c1':
        return 136.4, 145.6, 9.5
    if name == 'c2':
        d = DISCS[0]
        return 149.8, d[2] + 0.6, (d[1] - d[0]) / 2 - 0.4
    above, below = DISCS[i - 2], DISCS[i - 1]
    hw = ((above[1] - above[0]) + (below[1] - below[0])) / 4 - 0.4
    return above[3] - 0.6, below[2] + 0.6, hw


def disc(bbox):
    """An intervertebral disc for the schematic disc with this bounding box (x0, y0, x1, y1)."""
    x0, y0, x1, y1 = bbox
    hw = (x1 - x0) / 2 - 0.3
    ym = (y0 + y1) / 2
    body = blob([(X(-hw + 0.8), y0 + 0.2), (X(hw - 0.8), y0 + 0.2), (X(hw + 0.4), ym), (X(hw - 0.8), y1 - 0.2),
                 (X(-hw + 0.8), y1 - 0.2), (X(-hw - 0.4), ym)], 8)
    lines = [curve([(X(-hw + 1.5), ym), (X(0), ym + 0.2), (X(hw - 1.5), ym)])]   # annulus lamellae
    return Bone(body, 1.4, lines=lines, light=False)


def spool(y0, y1, hw, waist):
    """A vertebral body seen from the front or back: flared rims, a waisted middle."""
    ym = (y0 + y1) / 2
    return blob([(X(-hw + 1.0), y0), (X(hw - 1.0), y0), (X(hw), y0 + 0.9), (X(hw - waist), ym), (X(hw), y1 - 0.9),
                 (X(hw - 1.0), y1), (X(-hw + 1.0), y1), (X(-hw), y1 - 0.9), (X(-hw + waist), ym),
                 (X(-hw), y0 + 0.9)], 8)


def tp(x0, y0, x1, y1, w0, w1, knob=0.0):
    """A transverse process from the body (x0, y0) out to (x1, y1), with an optional knob at its tip; both sides."""
    t = tube([(x0, y0), lerp((x0, y0), (x1, y1), 0.5), (x1, y1)], [w0, (w0 + w1) / 2, w1])
    if knob:
        t = fillet(unary_union([t, circ(x1, y1, knob)]), 0.6)
    return both(t)


def vertebra_front(name):
    y0, y1, hw = vert_range(name)
    span = SPAN[name]
    h = y1 - y0
    lines, fossa = [], None
    if name == 'c1':
        arch = tube([(X(-10), 141.4), (X(0), 140.4), (X(10), 141.4)], [4.0, 4.4, 4.0])
        tub = ell(MID, 140.6, 3.0, 2.8)
        mass = blob([(X(-9.4), 137.2), (X(-16.4), 136.6), (X(-18.6), 140.6), (X(-17.2), 145.2), (X(-10.4), 145.4),
                     (X(-8.6), 141.4)])
        tps = tp(X(-17), 141.2, X(-24.4), 141.8, 4.2, 3.4, 2.3)
        body = fillet(unary_union([arch, tub, both(mass), tps]), 0.8)
        lines = [curve([(X(-16), 138.6), (X(-11.2), 138.6)]), curve([(X(16), 138.6), (X(11.2), 138.6)])]
        return Bone(body, 2.0, lines=lines)
    if name == 'c2':
        b = spool(y0, y1, hw, 0.6)
        dens = ell(MID, 147.6, 3.0, 2.6)
        facet = blob([(X(-15.6), 148.8), (X(-8.2), 147.8), (X(-6.2), 150.6), (X(-8.4), 153.2), (X(-14.8), 152.6)])
        tps = tp(X(-9), 154.4, X(-15.2), 155.4, 3.2, 2.6, 1.4)
        body = fillet(unary_union([b, dens, both(facet), tps]), 0.8)
        return Bone(body, 2.2, lines=[curve([(X(-hw + 1.2), y1 - 1.3), (X(hw - 1.2), y1 - 1.3)])])
    region = name[0]
    b = spool(y0, y1, hw, {'c': 0.5, 't': 0.9, 'l': 1.5}[region])
    parts = [b]
    if region == 'c':
        ym = y0 + h * 0.5
        parts.append(tp(X(-hw + 1), ym, X(-span + 2.2), ym + 0.6, 3.6, 3.2, 2.1))
        parts += [both(ell(X(-hw + 0.9), y0 - 0.2, 1.1, 1.3))]          # uncinate processes
    elif region == 't':
        parts.append(tp(X(-hw + 1), y0 + 3.4, X(-span + 2.6), y0 + 2.2, 4.4, 3.8, 2.5))
    else:
        ym = y0 + h * 0.48
        wide = name == 'l5'
        parts.append(tp(X(-hw + 1.5), ym, X(-span + 1.8), ym - (0.4 if wide else 1.6),
                        7.0 if wide else 5.4, 4.8 if wide else 3.3, 1.9))
    body = fillet(unary_union(parts), 0.9 if region != 'c' else 0.6)
    lines = [curve([(X(-hw + 1.3), y0 + 1.2), (X(0), y0 + 1.5), (X(hw - 1.3), y0 + 1.2)]),
             curve([(X(-hw + 1.3), y1 - 1.2), (X(0), y1 - 1.5), (X(hw - 1.3), y1 - 1.2)])]
    return Bone(body, {'c': 2.2, 't': 2.8, 'l': 4.2}[region], fossa=fossa, lines=lines)


def vertebra_back(name):
    y0, y1, hw = vert_range(name)
    span = SPAN[name]
    h = y1 - y0
    region = name[0]
    lines = []
    if name == 'c1':
        arch = tube([(X(-10), 142.4), (X(0), 143.6), (X(10), 142.4)], [3.6, 3.8, 3.6])
        tub = ell(MID, 143.4, 2.6, 2.2)
        mass = blob([(X(-9.4), 137.2), (X(-16.4), 136.6), (X(-18.6), 140.6), (X(-17.2), 145.2), (X(-10.4), 145.4),
                     (X(-8.6), 141.4)])
        tps = tp(X(-17), 141.2, X(-24.4), 141.8, 4.2, 3.4, 2.3)
        return Bone(fillet(unary_union([arch, tub, both(mass), tps]), 0.8), 2.0)
    if region == 'c':
        lam = blob([(X(-hw + 0.6), y0 + 0.8), (X(hw - 0.6), y0 + 0.8), (X(hw - 1.6), y1 - 0.2), (X(-hw + 1.6), y1 - 0.2)], 6)
        pillar = blob([(X(-hw + 1.6), y0 - 0.8), (X(-hw - 2.8), y0 - 0.4), (X(-hw - 3.6), (y0 + y1) / 2),
                       (X(-hw - 2.8), y1 + 0.8), (X(-hw + 1.6), y1 + 0.6)], 6)
        tps = tp(X(-hw - 2.4), y0 + h * 0.45, X(-span + 2), y0 + h * 0.5, 3.0, 2.6, 1.6)
        if name == 'c7':
            spine = fillet(unary_union([tube([(X(0), y0 + 1), (X(0), y1 + 2.2), (X(0), y1 + 4.4)], [4.2, 3.2, 2.6]),
                                        circ(MID, y1 + 4.4, 2.2)]), 0.6)
        else:
            lobes = both(ell(X(-1.7), y1 + 0.9 + (0.9 if name == 'c2' else 0), 1.5 if name != 'c2' else 2.2, 1.4))
            spine = fillet(unary_union([tube([(X(0), y0 + 1.2), (X(0), (y0 + y1) / 2), (X(0), y1 + 0.6)],
                                             [3.4, 3.0, 3.0] if name != 'c2' else [5.6, 4.6, 4.4]), lobes]), 0.5)
        body = fillet(unary_union([lam, both(pillar), tps, spine]), 0.6)
        lines = [curve([(X(-hw + 0.8), y0 + 1.6), (X(-2), y0 + 1.6)]), curve([(X(hw - 0.8), y0 + 1.6), (X(2), y0 + 1.6)])]
        return Bone(body, 2.0, lines=lines)
    if region == 't':
        lam = blob([(X(-hw + 1.6), y0 + 0.4), (X(hw - 1.6), y0 + 0.4), (X(hw - 3.2), y1 + 0.4), (X(-hw + 3.2), y1 + 0.4)], 6)
        sup = both(ell(X(-4.4), y0 - 0.4, 1.8, 1.6))
        tps = tp(X(-hw + 2.2), y0 + 3.2, X(-span + 2.4), y0 + 2.2, 4.6, 4.0, 2.5)
        reach = 6.5 if name in ('t5', 't6', 't7', 't8', 't9') else 4.8
        spine = fillet(unary_union([tube([(X(0), y0 + 1), (X(0), y1), (X(0), y1 + reach)], [3.8, 2.8, 2.2]),
                                    ell(MID, y1 + reach, 1.6, 1.8)]), 0.5)
        body = fillet(unary_union([lam, sup, tps, spine]), 0.7)
        lines = [curve([(X(-hw + 2.4), y0 + 2), (X(-2.4), y1)]), curve([(X(hw - 2.4), y0 + 2), (X(2.4), y1)])]
        return Bone(body, 2.4, lines=lines, fossa=both(ell(X(-span + 2.4), y0 + 2.2, 1.0, 1.0)))
    # lumbar: broad laminae, hatchet-shaped spinous process, long transverse processes
    lam = blob([(X(-hw + 3.0), y0 + 0.6), (X(hw - 3.0), y0 + 0.6), (X(hw - 4.6), y1), (X(-hw + 4.6), y1)], 6)
    sup = both(ell(X(-6.2), y0 + 0.2, 2.6, 2.4))          # superior articular / mammillary processes
    inf = both(ell(X(-5.0), y1 + 0.4, 2.0, 1.8))
    ym = y0 + h * 0.48
    wide = name == 'l5'
    tps = tp(X(-hw + 2.5), ym, X(-span + 1.8), ym - (0.4 if wide else 1.6), 6.4 if wide else 5.0, 4.6 if wide else 3.2, 1.9)
    spine = blob([(X(-2.6), y0 + 2.0), (X(2.6), y0 + 2.0), (X(3.3), y1 + 1.2), (X(0), y1 + 2.2), (X(-3.3), y1 + 1.2)], 6)
    body = fillet(unary_union([lam, sup, inf, tps, spine]), 0.9)
    lines = [curve([(X(-2.6), y0 + 2.4), (X(-2.9), y1 + 0.8)]), curve([(X(2.6), y0 + 2.4), (X(2.9), y1 + 0.8)])]
    return Bone(body, 3.4, lines=lines)


def sacrum(view):
    half = [(X(0), 532.6), (X(-10.4), 532.2), (X(-22), 534.4), (X(-33.4), 538.6), (X(-40.6), 543.0),
            (X(-41.4), 551.0), (X(-38.4), 560.6), (X(-32.4), 570.4), (X(-23.6), 580.4), (X(-14), 587.6),
            (X(-6.4), 591.6), (X(0), 593.6)]
    body = symblob(half, 12)
    lines, fossa = [], None
    if view == 'anterior':
        fr = []
        for (y, dx, rx, ry) in [(547.6, 12.6, 3.3, 2.5), (558.4, 11.4, 2.9, 2.2), (568.8, 10.0, 2.5, 1.9), (578.4, 8.4, 2.0, 1.6)]:
            fr += [ell(X(-dx), y, rx, ry, -14), ell(X(dx), y, rx, ry, 14)]
        fossa = unary_union(fr)
        for y, w in [(542.0, 10.4), (553.0, 9.6), (563.6, 8.6), (573.6, 7.4), (582.8, 5.6)]:
            lines.append(curve([(X(-w), y + 0.8), (X(0), y - 0.4), (X(w), y + 0.8)]))
        lines.append(curve([(X(-15), 536.4), (X(-6), 533.8), (X(6), 533.8), (X(15), 536.4)]))  # promontory
        return Bone(body, 6.0, fossa=fossa, lines=lines)
    # from behind: superior articular processes, median crest, posterior foramina, sacral hiatus
    sap = both(ell(X(-9.4), 534.6, 3.4, 2.6))
    body = fillet(unary_union([body, sap]), 1.0)
    fr = []
    for (y, dx, rx, ry) in [(548.6, 9.4, 2.3, 1.8), (558.6, 8.6, 2.1, 1.7), (568.4, 7.6, 1.9, 1.5), (577.6, 6.6, 1.6, 1.3)]:
        fr += [ell(X(-dx), y, rx, ry), ell(X(dx), y, rx, ry)]
    hiatus = blob([(X(-2.8), 584.6), (X(2.8), 584.6), (X(3.2), 590.6), (X(0), 592.6), (X(-3.2), 590.6)])
    fossa = unary_union(fr + [hiatus])
    lines = [curve([(X(0), 540), (X(0), 552), (X(0), 564), (X(0), 576), (X(0), 583)]),        # median crest
             curve([(X(-14.6), 545), (X(-13.4), 558), (X(-11.6), 570), (X(-9.6), 580)]),        # lateral crests
             curve([(X(14.6), 545), (X(13.4), 558), (X(11.6), 570), (X(9.6), 580)])]
    crest = unary_union([ell(MID, y, 1.6, 1.8) for y in (544, 555, 566, 576)])
    return Bone(fillet(unary_union([body, crest]), 0.5), 6.0, fossa=fossa, lines=lines)


def coccyx():
    segs = [ell(MID, 596.4, 5.0, 2.3), ell(MID, 599.8, 3.9, 1.8), ell(MID, 602.8, 2.9, 1.5), ell(MID, 605.2, 2.0, 1.2)]
    return Bone(separate(segs, 0.4), 1.6)


# ================================================================== thorax

# per rib: vertebral end V, lateral turn L (both from the schematic), costochondral end E, sternal end S
RIBS = {
    1: dict(V=(231.0, 231.1), L=(189.8, 239.9), E=(209.4, 249.6), S=(229.5, 248.1), w=(8.6, 9.0)),
    2: dict(V=(230.3, 246.6), L=(174.3, 260.5), E=(201.9, 275.9), S=(230.6, 270.3), w=(6.6, 7.8)),
    3: dict(V=(229.9, 263.2), L=(164.3, 280.4), E=(195.9, 298.1), S=(230.2, 289.2), w=(6.6, 7.8)),
    4: dict(V=(229.6, 279.8), L=(157.3, 298.2), E=(189.9, 320.2), S=(229.7, 307.0), w=(6.6, 7.8)),
    5: dict(V=(229.2, 296.4), L=(152.2, 316.8), E=(183.9, 340.3), S=(229.7, 323.0), w=(6.6, 7.8)),
    6: dict(V=(228.9, 313.0), L=(149.2, 335.3), E=(178.9, 360.5), S=(230.2, 336.8), w=(6.6, 7.8)),
    7: dict(V=(228.5, 329.6), L=(147.1, 353.2), E=(173.9, 380.5), S=(232.6, 348.4), w=(6.6, 7.6)),
    8: dict(V=(228.1, 346.2), L=(146.0, 371.7), E=(167.9, 397.7), S=(212.7, 363.3), w=(6.6, 7.2)),
    9: dict(V=(227.8, 362.8), L=(146.9, 390.0), E=(163.9, 412.2), S=(196.6, 382.1), w=(6.6, 7.0)),
    10: dict(V=(227.4, 379.4), L=(149.8, 406.7), E=(159.9, 423.6), S=(182.6, 401.1), w=(6.4, 6.8)),
    11: dict(V=(226.6, 396.0), L=(156.2, 420.0), E=(162.4, 432.0), S=(166.0, 438.6), w=(5.8, 5.8)),
    12: dict(V=(225.9, 412.6), L=(171.0, 428.7), E=(176.6, 436.2), S=(180.4, 440.4), w=(5.0, 4.8)),
}


def rib_back_half(n):
    """The posterior part of a rib: head at the vertebra, neck, tubercle, then the shaft out to the lateral turn."""
    r = RIBS[n]
    V, L = r['V'], r['L']
    wb = r['w'][0]
    T = (V[0] - 9.0, V[1] - 0.8)
    M = (V[0] + (L[0] - V[0]) * 0.55, V[1] + (L[1] - V[1]) * 0.45 - 1.6)
    N = (L[0] + 4.6, L[1] - 5.2) if n > 1 else (L[0] + 3.0, L[1] - 3.0)
    shaft = tube([V, T, M, N, (L[0] + 0.2, L[1])], [wb * 0.82, wb * 0.72, wb, wb, wb * 0.94])
    head = ell(V[0] - 0.8, V[1], wb * 0.48, wb * 0.5)
    tub = circ(T[0] + 0.6, T[1] - wb * 0.18, wb * 0.4)
    cap = circ(L[0] + wb * 0.47, L[1], wb * 0.47)
    return fillet(unary_union([shaft, head, tub, cap]), 1.0), T


def rib_front_half(n):
    r = RIBS[n]
    L, E = r['L'], r['E']
    wf = r['w'][1]
    if n == 1:
        pts = [(L[0] + 1.2, L[1] - 2.4), L, (L[0] + 3.8, L[1] + 5.6), lerp(L, E, 0.62), E]
    else:
        start = (L[0] + 1.4, L[1] - 3.0)
        F1 = (L[0] + 1.2, L[1] + 6.0)
        F2 = (L[0] + (E[0] - L[0]) * 0.45, L[1] + (E[1] - L[1]) * 0.45 + 3.0)
        pts = [start, L, F1, F2, E]
    widths = [wf * 0.86, wf * 0.95, wf, wf, wf * 1.08]
    if n >= 11:
        widths = [wf * 0.9, wf, wf * 0.9, wf * 0.7, wf * 0.45]
    shaft = tube(pts, widths)
    cap = circ(L[0] + wf * 0.5, L[1] - 0.6, wf * 0.5)
    end = circ(E[0], E[1], wf * 0.52) if n < 11 else Polygon()
    return fillet(unary_union([shaft, cap, end]), 0.9)


def costal_cartilage(n):
    r = RIBS[n]
    E, S = r['E'], r['S']
    w = 6.4 if n == 1 else 5.2
    if n <= 7:
        mid = lerp(E, S, 0.5)
        mid = (mid[0], mid[1] - (0.6 + 0.35 * max(n - 3, 0)))      # lower cartilages bow upward
        return tube([E, mid, S], [w, w * 0.92, w * 0.95])
    if n <= 10:
        a = lerp(E, S, 0.3)
        b = lerp(E, S, 0.7)
        bow = {8: 3.0, 9: 3.4, 10: 3.0}[n]
        return tube([E, (a[0] + bow * 0.2, a[1] + bow), (b[0] + bow * 0.5, b[1] + bow * 0.7), S], [w * 0.95, w * 0.9, w * 0.78, w * 0.6])
    return tube([E, lerp(E, S, 0.5), S], [r['w'][1] * 0.5, r['w'][1] * 0.38, 0.8])


def rib(n, part, view):
    """part 'back' or 'front'. In the front view the front half is the tappable rib and carries the costal
    cartilage; in the back view the back half is, and the front half is the muted shape behind."""
    if part == 'back':
        body, T = rib_back_half(n)
        lines = []
        if view == 'posterior':
            V = RIBS[n]['V']
            lines = [curve([(T[0] - 1.0, T[1] - 2.4), (T[0] - 1.6, T[1]), (T[0] - 1.0, T[1] + 2.4)])]   # tubercle
        return Bone(body, RIBS[n]['w'][0] * 0.34, lines=lines)
    body = rib_front_half(n)
    cart = costal_cartilage(n) if view == 'anterior' else None
    return Bone(body, RIBS[n]['w'][1] * 0.36, cart=cart, cart_outside=True)


def sternum():
    right = [(X(0), 237.6), (X(-4.4), 236.2), (X(-9.0), 236.6), (X(-11.8), 239.4), (X(-13.0), 242.8),
             (X(-14.8), 246.4), (X(-14.2), 250.4), (X(-12.0), 255.0), (X(-10.8), 260.2), (X(-10.4), 263.0),
             (X(-10.8), 268.0), (X(-11.2), 278.0), (X(-11.6), 290.0), (X(-12.0), 304.0), (X(-12.2), 318.0),
             (X(-12.0), 330.0), (X(-11.0), 339.0), (X(-8.8), 346.0), (X(-6.4), 350.6), (X(-4.6), 356.0),
             (X(-3.2), 363.0), (X(-1.6), 369.0), (X(0), 372.2)]
    body = symblob(right, 10)
    lines = [curve([(X(-10.2), 262.8), (X(0), 263.6), (X(10.2), 262.8)]),            # sternal angle
             curve([(X(-10.6), 284.0), (X(0), 284.6), (X(10.6), 284.0)]),
             curve([(X(-11.2), 304.6), (X(0), 305.2), (X(11.2), 304.6)]),
             curve([(X(-11.4), 325.4), (X(0), 326.0), (X(11.4), 325.4)]),
             curve([(X(-7.2), 349.6), (X(0), 350.2), (X(7.2), 349.6)])]            # xiphisternal joint
    return Bone(body, 4.6, lines=lines)


def clavicle():
    c = [(227.6, 241.6), (220.0, 240.4), (206.0, 238.4), (190.0, 236.2), (172.0, 232.6), (156.0, 228.8),
         (142.0, 226.2), (131.0, 224.4), (123.2, 223.0)]
    shaft = tube(c, [9.4, 8.4, 7.2, 6.6, 6.3, 6.3, 6.7, 7.5, 8.6])
    body = fillet(unary_union([shaft, ell(227.2, 241.6, 3.6, 4.9), ell(122.6, 222.9, 3.8, 4.0),
                               ell(141.0, 229.4, 2.6, 1.8)]), 1.4)
    lines = [curve([(150.0, 230.4), (165.0, 233.6), (182.0, 236.6)])]
    return Bone(body, 2.4, lines=lines)


def scapula(view):
    blade = blob([(197.0, 244.0), (199.0, 255.0), (199.6, 270.0), (198.4, 290.0), (194.6, 310.0), (188.6, 330.0),
                  (182.0, 346.0), (178.6, 352.4), (174.6, 347.6), (166.0, 328.0), (154.0, 304.0), (143.6, 284.0),
                  (138.0, 274.0), (134.4, 268.4), (132.4, 262.0), (134.4, 255.4), (138.6, 250.6), (146.0, 248.0),
                  (153.0, 247.6), (160.0, 248.4), (166.0, 246.8), (176.0, 244.4), (188.0, 242.8)], 12)
    glenoid = ell(132.8, 262.0, 3.6, 9.6)
    lateral = tube([(136.0, 270.0), (150.0, 296.0), (164.0, 323.0), (175.4, 347.0)], [6.0, 5.0, 4.4, 4.0])
    coracoid = tube([(153.0, 248.4), (150.4, 241.0), (145.0, 239.4), (139.2, 242.4)], [7.0, 5.8, 5.0, 4.2])
    acromion = blob([(113.0, 222.0), (117.0, 218.8), (127.0, 219.4), (138.0, 222.8), (147.0, 227.8), (151.0, 233.0),
                     (147.0, 237.0), (138.0, 235.0), (127.0, 231.5), (117.0, 229.0), (112.4, 226.0)])
    if view == 'anterior':
        main = fillet(unary_union([blade, glenoid, lateral, coracoid]), 1.6)
        body = unary_union([main, acromion])
        fossa_area = blob([(190.0, 258.0), (193.0, 290.0), (186.0, 322.0), (178.0, 338.0), (168.0, 318.0),
                           (154.0, 290.0), (150.0, 268.0), (166.0, 256.0)])
        lines = [curve([(196.0, 272.0), (178.0, 270.0), (160.0, 272.0)]), curve([(194.0, 294.0), (176.0, 291.0), (162.0, 293.0)]),
                 curve([(190.0, 316.0), (176.0, 312.0), (168.0, 313.0)])]   # oblique ridges of the subscapular fossa
        fossa = ell(133.4, 262.0, 1.8, 7.4)                              # glenoid cavity
        return Bone(body, 6.0, fossa=fossa, lines=lines, hollow=fossa_area)
    # from behind: the spine of the scapula runs up and out to the acromion
    spine = tube([(199.2, 268.0), (185.0, 261.4), (170.0, 253.6), (157.0, 245.0), (149.0, 236.4)], [4.0, 5.6, 6.6, 7.6, 9.0])
    body = fillet(unary_union([blade, glenoid, lateral, spine, acromion]), 1.6)
    below = affinity.translate(spine, 1.2, 3.8).difference(spine)
    lines = [curve([(198.6, 268.6), (184.0, 262.6), (168.0, 254.6), (154.0, 244.4)])]
    supra = blob([(195.0, 248.0), (196.4, 260.0), (180.0, 256.0), (160.0, 250.6), (175.0, 246.0)])
    infra = blob([(196.0, 278.0), (194.0, 305.0), (184.0, 332.0), (174.0, 330.0), (160.0, 305.0), (150.0, 284.0),
                  (160.0, 268.0), (180.0, 268.0)])
    return Bone(body, 6.0, lines=lines, cast=below, hollow=unary_union([supra, infra]))


# ================================================================== upper limb


def humerus(view):
    head = circ(124.0, 259.4, 12.6)
    gt = ell(110.4, 257.0, 6.0, 10.2, 6)
    lt = ell(120.6, 276.0, 3.8, 4.8)
    shaft = tube([(119.0, 268.0), (116.0, 300.0), (113.0, 340.0), (110.4, 380.0), (109.4, 410.0), (109.6, 428.0),
                  (110.0, 440.0)], [22.0, 15.6, 14.6, 14.0, 15.0, 24.0, 40.0])
    delt = ell(104.6, 336.0, 2.6, 10.0, 4)
    lat_epi = circ(90.0, 442.0, 4.6)
    med_epi = ell(128.6, 442.6, 6.4, 4.6, -8)
    capit = circ(98.2, 452.6, 6.4)
    troch = ell(112.6, 454.0, 8.6, 6.4)
    lip = circ(119.0, 456.2, 4.8)
    upper = fillet(unary_union([head, gt, lt, shaft.intersection(box(0, 0, 480, 360))]), 2.4)
    lower = fillet(unary_union([shaft.intersection(box(0, 340, 480, 1200)), delt, lat_epi, med_epi, capit, troch, lip]), 2.2)
    body = fillet(unary_union([upper, lower]), 1.0)
    cart = unary_union([capit, troch, lip]).difference(affinity.translate(unary_union([capit, troch, lip]), 0, -2.0))
    cart = cart.intersection(box(0, 452, 480, 470))
    if view == 'anterior':
        hollow = unary_union([ell(112.0, 438.4, 4.6, 3.4), ell(98.8, 440.6, 3.0, 2.6)])           # coronoid, radial fossae
        lines = [curve([(115.8, 249.6), (113.8, 258.0), (114.6, 266.0)]),                          # anatomical neck
                 curve([(114.6, 268.0), (113.8, 284.0), (112.8, 300.0)]),                          # intertubercular groove
                 curve([(105.8, 444.6), (106.2, 452.0), (106.0, 458.0)])]                          # capitulotrochlear groove
        return Bone(body, 4.6, cart=cart, hollow=hollow, lines=lines)
    fossa = ell(110.6, 438.6, 4.6, 4.4)                                                            # olecranon fossa
    lines = [curve([(112.0, 318.0), (106.4, 340.0), (103.4, 362.0), (102.6, 384.0)]),              # radial groove
             curve([(133.0, 262.0), (130.4, 272.0), (124.0, 276.0)])]
    return Bone(body, 4.6, fossa=fossa, lines=lines)


def radius(view):
    head = ell(92.6, 463.6, 7.0, 3.9)
    neck = tube([(92.6, 464.0), (93.4, 472.0), (94.0, 480.0)], [9.0, 6.6, 7.4])
    tub = circ(97.2, 482.0, 3.2)
    shaft = tube([(94.0, 478.0), (92.0, 510.0), (87.0, 550.0), (81.0, 585.0), (76.0, 606.0), (73.6, 616.0)],
                 [7.6, 8.6, 9.6, 11.0, 14.6, 22.0])
    distal = blob([(62.0, 618.0), (58.6, 626.0), (59.6, 632.4), (70.0, 632.6), (82.0, 631.6), (89.6, 630.8), (90.6, 623.0),
                   (87.0, 612.0), (77.0, 606.0), (67.0, 609.0)])
    body = fillet(unary_union([head, neck, tub, shaft, distal]), 1.8)
    lines = [curve([(88.0, 470.0), (97.0, 470.0)])]
    if view == 'posterior':
        lines.append(curve([(78.6, 604.0), (78.0, 614.0), (77.0, 624.0)]))                         # dorsal tubercle
    else:
        lines.append(curve([(66.0, 612.0), (74.0, 616.0), (84.0, 616.4)]))                         # pronator ridge
    return Bone(body, 3.4, lines=lines)


def ulna(view):
    top = [(104.0, 459.0), (106.4, 451.0), (113.0, 447.4), (119.4, 450.0), (121.0, 458.0), (119.0, 468.0), (114.0, 476.0),
           (108.4, 474.0), (104.6, 467.0)]
    if view == 'posterior':
        top = [(103.6, 452.0), (106.8, 441.6), (114.0, 440.4), (119.6, 444.0), (120.6, 453.0), (118.4, 465.0),
               (113.4, 474.0), (107.4, 472.0), (103.6, 463.0)]
    prox = blob(top)
    coronoid = ell(105.4, 464.0, 3.4, 2.6, -20)
    shaft = tube([(112.0, 470.0), (110.2, 500.0), (107.6, 540.0), (104.6, 580.0), (102.4, 605.0), (101.4, 617.0)],
                 [10.0, 8.6, 8.0, 7.6, 7.4, 8.2])
    head = circ(101.2, 622.0, 5.0)
    styloid = ell(104.6, 629.4, 2.0, 3.4, -10)
    body = fillet(unary_union([prox, coronoid, shaft, head, styloid]), 1.6)
    if view == 'anterior':
        lines = [curve([(109.6, 476.0), (110.0, 486.0)])]      # ulnar tuberosity
        return Bone(body, 3.0, lines=lines)
    lines = [curve([(113.0, 476.0), (110.0, 520.0), (106.4, 570.0), (103.4, 606.0)])]   # posterior border
    return Bone(body, 3.0, lines=lines)


def carpals(view):
    sca = blob([(66.5, 638.0), (70.0, 634.5), (77.0, 634.0), (80.0, 637.5), (78.5, 643.0), (72.5, 645.5), (67.5, 643.5)])
    lun = blob([(80.8, 635.0), (88.5, 634.5), (91.0, 639.0), (88.0, 643.5), (82.5, 643.5), (80.5, 639.5)])
    tri = blob([(91.8, 635.5), (99.0, 635.5), (102.5, 639.0), (100.5, 644.0), (93.5, 644.0), (91.6, 640.0)])
    tpm = blob([(64.0, 645.5), (70.5, 644.0), (75.0, 646.5), (74.0, 652.0), (68.0, 653.0), (64.5, 650.0)])
    tpd = blob([(74.8, 645.0), (79.6, 644.6), (80.6, 649.5), (78.8, 653.5), (74.8, 652.6)])
    cap = blob([(81.2, 644.6), (88.0, 643.8), (91.0, 646.5), (90.0, 654.5), (84.0, 655.6), (80.8, 651.0)])
    ham = blob([(91.6, 645.0), (100.5, 644.6), (104.5, 648.0), (101.5, 654.5), (93.0, 655.5), (90.8, 650.0)])
    bones = [sca, lun, tri, tpm, tpd, cap, ham]
    lines = []
    if view == 'anterior':
        bones.append(ell(100.2, 641.4, 3.2, 3.0))                          # pisiform, in front of the triquetrum
        lines.append(curve([(96.0, 649.0), (97.6, 651.0), (97.0, 653.4)]))  # hook of the hamate
    return Bone(separate(bones, 0.45), 2.0, lines=lines)


HAND = {   # metacarpals: base, head, shaft width, head radius (thumb first)
    'mc': [((71.6, 652.0), (60.4, 679.6), 6.4, 3.6), ((78.0, 656.4), (72.2, 697.6), 5.0, 3.6),
           ((86.0, 656.6), (83.2, 701.4), 5.2, 3.7), ((94.0, 656.4), (94.2, 697.4), 4.6, 3.3),
           ((101.2, 654.6), (103.0, 692.6), 4.4, 3.0)],
    # phalanges per finger: list of (start, end) and a width
    'ph': [([((58.8, 684.8), (52.4, 708.0)), ((50.8, 711.0), (46.6, 724.4))], 5.4),
           ([((71.2, 702.0), (67.2, 732.6)), ((66.8, 735.4), (65.0, 749.2)), ((64.8, 752.0), (63.2, 763.0))], 5.0),
           ([((82.4, 706.4), (81.2, 736.8)), ((81.0, 739.8), (80.6, 756.6)), ((80.6, 759.6), (80.3, 772.4))], 5.2),
           ([((94.2, 701.8), (96.2, 733.8)), ((96.4, 736.8), (97.2, 751.0)), ((97.4, 753.8), (98.0, 764.0))], 4.8),
           ([((103.6, 697.4), (107.6, 720.8)), ((108.2, 723.4), (110.0, 736.0)), ((110.2, 738.4), (111.0, 747.6))], 4.4)],
}


def metacarpals():
    bones = []
    for (b, h, w, r) in HAND['mc']:
        m = lerp(b, h, 0.5)
        shaft = tube([b, m, h], [w * 1.3, w * 0.8, w * 0.95])
        bones.append(fillet(unary_union([shaft, circ(h[0], h[1], r), ell(b[0], b[1], w * 0.72, 2.6)]), 1.0))
    return Bone(separate(bones, 0.4, later_on_top=False), 1.7)


def phalanx(a, b, w, distal):
    m = lerp(a, b, 0.5)
    if distal:
        seg = tube([a, m, b], [w * 1.1, w * 0.76, w * 0.56])
        return fillet(unary_union([seg, ell(a[0], a[1], w * 0.55, w * 0.36), circ(b[0], b[1], w * 0.36)]), 0.5)
    seg = tube([a, m, b], [w * 1.18, w * 0.84, w * 0.96])
    return fillet(unary_union([seg, ell(a[0], a[1], w * 0.6, w * 0.38), ell(b[0], b[1], w * 0.5, w * 0.38)]), 0.5)


def hand_phalanges():
    parts = []
    for segs, w in HAND['ph']:
        for j, (a, b) in enumerate(segs):
            parts.append(phalanx(a, b, w * (1 - 0.1 * j), j == len(segs) - 1))
    return Bone(unary_union(parts), 1.5)


# ================================================================== pelvis and lower limb


def hip_bone(view):
    outline = blob([
        (210.6, 519.0), (203.4, 509.6), (193.0, 502.4), (180.6, 498.6), (168.4, 499.2), (159.0, 504.2),
        (152.8, 513.4), (150.0, 525.6), (150.4, 537.4), (151.8, 546.6),
        (155.6, 551.4), (156.2, 557.6), (154.0, 563.4), (157.4, 568.8),
        (161.6, 576.0), (162.4, 586.0), (163.6, 597.0), (167.2, 606.0),
        (171.0, 614.6), (177.0, 626.0), (183.0, 637.0), (187.6, 645.6), (193.0, 648.6),
        (199.6, 646.4), (207.0, 640.6), (217.4, 633.6), (227.6, 628.6), (234.8, 627.4),
        (237.4, 620.6), (237.6, 610.0), (236.6, 602.4),
        (231.0, 599.2), (224.6, 599.8), (221.8, 597.0), (212.6, 594.6), (203.4, 589.6),
        (198.6, 584.4), (200.2, 576.0), (203.0, 566.0), (205.2, 556.0), (206.2, 545.0),
        (206.6, 532.0), (208.2, 524.2)], samples=12)
    obt = blob([(193.4, 603.6), (202.6, 600.6), (212.4, 602.2), (220.2, 608.0), (222.0, 615.6), (217.0, 623.8),
                (207.0, 629.0), (196.4, 630.0), (189.2, 624.0), (187.2, 613.8)])
    body = fillet(unary_union([outline, circ(180, 590, 17.2)]), 2.4).difference(obt)
    if view == 'anterior':
        socket = circ(180, 590, 16.0).difference(circ(178.8, 588.4, 12.6))
        hollow = blob([(168.0, 510.0), (184.0, 505.0), (199.6, 512.6), (202.8, 530.0), (200.4, 552.0), (194.0, 566.0),
                       (183.0, 571.0), (171.0, 566.0), (162.4, 548.0), (160.6, 528.0)])
        lines = [
            curve([(206.4, 534.0), (203.4, 556.0), (199.0, 575.0), (199.6, 586.0), (207.0, 591.0), (220.0, 595.0)]),
            curve([(206.0, 519.6), (198.6, 509.6), (186.0, 503.6), (172.0, 503.0), (161.4, 508.4), (155.4, 520.0)]),
            curve([(196.2, 604.0), (204.0, 602.6), (212.0, 604.0)]),
            curve([(166.0, 600.0), (171.0, 607.0), (178.0, 611.0)]),
        ]
        return Bone(body, 6.5, fossa=socket, lines=lines, hollow=hollow)
    # from behind: the convex gluteal surface with its gluteal lines, the ischial spine and tuberosity
    lines = [
        curve([(200.0, 507.0), (188.0, 520.0), (184.0, 540.0), (186.0, 556.0)]),                  # posterior gluteal line
        curve([(158.0, 518.0), (172.0, 528.0), (182.0, 548.0), (184.0, 568.0), (180.0, 576.0)]),  # anterior gluteal line
        curve([(157.0, 560.0), (166.0, 568.0), (172.0, 574.0)]),                                  # inferior gluteal line
        curve([(206.0, 519.6), (198.6, 509.6), (186.0, 503.6), (172.0, 503.0), (161.4, 508.4), (155.4, 520.0)]),
        curve([(181.0, 633.0), (186.0, 640.0), (193.0, 645.0)]),                                  # ischial tuberosity
    ]
    return Bone(body, 6.5, lines=lines)


def symphysis():
    return Bone(box(236.4, 602.0, 243.6, 627.0).buffer(0.6).buffer(-0.6), 1.6, light=False)


def femur(view):
    head = circ(180, 590, 13.6)
    neck = tube([(179, 591), (169, 601), (158.5, 612)], [18.5, 14.6, 19])
    gt = blob([(159.4, 600.5), (154.6, 593.4), (148.2, 591.8), (143.0, 595.4), (140.2, 603.6), (140.4, 615.6),
               (143.4, 625.8), (149.0, 631.6), (156.4, 630.4), (159.6, 621.0), (160.6, 609.0)])
    lt = ell(172.5, 640.5, 5.2, 6.4, -28)
    calcar = blob([(177.0, 601.0), (171.6, 610.0), (168.6, 621.0), (169.4, 633.0), (163.0, 634.0), (157.0, 622.0),
                   (158.0, 608.0), (166.0, 600.0)])
    shaft = tube([(153, 622), (156, 650), (161, 685), (167, 720), (175, 760), (184, 795), (191, 818), (197.6, 836)],
                 [25, 21.5, 19, 17.5, 17, 18.5, 27, 45])
    lat_con = ell(186.2, 850.5, 12.2, 17.8, 4)
    med_con = ell(211.6, 849.8, 12.6, 18.4, -4)
    flare = blob([(186, 830), (198.6, 828), (212, 831), (206, 846), (192, 846)])
    epis = [circ(177.4, 837, 3.6), circ(220.8, 837.5, 4.0), circ(219.5, 826.5, 3.0)]
    upper = fillet(unary_union([head, neck, gt, lt, calcar, shaft.intersection(box(0, 0, 480, 700))]), 2.2)
    lower = fillet(unary_union([shaft.intersection(box(0, 680, 480, 1200)), flare, lat_con, med_con] + epis), 3.4)
    body = fillet(unary_union([upper, lower]), 2.0)
    cond = unary_union([lat_con, med_con])
    cart = cond.difference(affinity.translate(cond, 0, -2.6)).intersection(box(0, 858, 480, 900))
    if view == 'anterior':
        fossa = unary_union([ell(185.6, 595.5, 1.9, 1.6), ell(199.2, 865.5, 2.2, 3.6)])
        lines = [curve([(159, 605), (162, 616), (166.5, 627), (171, 635)]),
                 curve([(167.4, 600.6), (171.6, 596.4), (176.6, 594.0)]),
                 curve([(183.5, 829), (190, 834), (198, 836.5)]),
                 curve([(214.5, 829), (208.5, 834.5), (201, 837)]),
                 curve([(164, 652), (166.5, 690), (171.5, 730)])]
        return Bone(body, 6.0, cart=cart, fossa=fossa, lines=lines)
    fossa = ell(199.2, 856.0, 4.6, 9.6)                               # intercondylar fossa
    lines = [curve([(153.0, 597.0), (158.0, 612.0), (164.0, 626.0), (170.0, 637.0)]),     # intertrochanteric crest
             curve([(165.0, 668.0), (169.6, 700.0), (175.0, 740.0), (182.0, 780.0)]),     # linea aspera
             curve([(169.4, 668.0), (173.4, 700.0), (178.4, 740.0), (184.6, 780.0)]),
             curve([(182.0, 780.0), (180.0, 800.0), (179.0, 820.0)]),                     # supracondylar lines
             curve([(184.6, 780.0), (196.0, 800.0), (212.0, 822.0)])]
    return Bone(body, 6.0, cart=cart, fossa=fossa, lines=lines, hollow=ell(159.6, 607.0, 3.0, 5.4, 16))


def patella():
    body = blob([(188.2, 832.6), (194.5, 828.8), (204.5, 828.6), (210.8, 832.4), (213.2, 840.4), (210.6, 850.4),
                 (204.4, 859.6), (199.6, 865.8), (194.8, 859.6), (188.6, 850.4), (186.4, 840.4)])
    lines = [curve([(193.5, 834), (195.5, 846), (198.6, 858)]), curve([(199.6, 832), (199.6, 846), (199.6, 860)]),
             curve([(205.8, 834), (203.8, 846), (200.6, 858)])]
    return Bone(body, 4.2, lines=lines)


def tibia(view):
    top = blob([(175.2, 877.2), (178.6, 872.8), (188.6, 871.2), (195.2, 871.8), (197.2, 868.4), (199.2, 870.6),
                (201.2, 868.2), (203.6, 871.6), (212.6, 871.0), (222.6, 872.6), (226.8, 877.2), (227.0, 883.4),
                (223.4, 890.6), (216.4, 898.6), (210.6, 909.0), (192.4, 909.4), (187.2, 901.6), (180.0, 893.8),
                (175.6, 885.4)])
    parts = [top, circ(180.4, 888.6, 3.6)]
    if view == 'anterior':
        parts.append(ell(201.6, 903.5, 5.0, 7.5, -6))
    shaft = tube([(201, 900), (200.4, 940), (200.6, 990), (202.2, 1040), (205.4, 1075), (208.2, 1094)],
                 [25, 19, 16.4, 16, 19, 28])
    distal = blob([(193.6, 1086), (193.0, 1098), (195.4, 1108.4), (204.6, 1111.6), (212.8, 1111.4), (214.2, 1118),
                   (216.4, 1125.4), (219.8, 1127.2), (222.8, 1121.4), (224.0, 1108.4), (222.2, 1094), (216.6, 1083)])
    body = fillet(unary_union(parts + [shaft, distal]), 3.0)
    cart = body.difference(affinity.translate(body, 0, 2.3)).intersection(box(0, 860, 480, 878))
    if view == 'anterior':
        lines = [curve([(201.8, 912), (200.2, 940), (199.6, 985), (200.6, 1030), (204.0, 1068), (209.0, 1092)]),
                 curve([(178.6, 879.4), (190, 878.2), (199.4, 878.6)]), curve([(200.6, 878.6), (212, 878.0), (225.4, 879.6)])]
        return Bone(body, 5.6, cart=cart, lines=lines)
    lines = [curve([(184.0, 898.0), (194.0, 914.0), (206.0, 932.0), (214.0, 946.0)]),   # soleal line
             curve([(205.0, 940.0), (204.0, 1000.0), (205.6, 1060.0)]),                  # vertical line
             curve([(178.6, 879.4), (190, 878.2), (199.4, 878.6)]), curve([(200.6, 878.6), (212, 878.0), (225.4, 879.6)])]
    return Bone(body, 5.6, cart=cart, lines=lines, fossa=circ(203.0, 956.0, 0.8))


def fibula():
    head = blob([(168.4, 884.6), (171.6, 884.6), (176.6, 887.2), (179.4, 892.6), (178.0, 898.6), (173.4, 902.0),
                 (168.4, 899.6), (166.0, 893.6), (166.4, 888.0)])
    shaft = tube([(173.6, 898), (175.2, 930), (177.2, 975), (180.0, 1020), (183.0, 1060), (185.6, 1088)],
                 [7.4, 6.0, 6.4, 6.2, 6.8, 9.0])
    mall = blob([(181.0, 1084), (180.0, 1098), (180.4, 1113), (183.4, 1125.4), (188.6, 1131.2), (193.0, 1126.6),
                 (194.8, 1112.4), (194.2, 1098), (191.2, 1087)])
    body = fillet(unary_union([head, shaft, mall]), 2.2)
    lines = [curve([(176.6, 906), (178.0, 950), (180.6, 1000), (183.6, 1050), (186.0, 1080)])]
    return Bone(body, 2.6, lines=lines)


def tarsals(view):
    if view == 'posterior':
        talus = blob([(195.6, 1113.0), (204.0, 1112.0), (212.8, 1113.0), (215.0, 1118.5), (212.6, 1124.0),
                      (205.0, 1126.4), (197.4, 1124.4), (194.2, 1119.0)])
        calc = blob([(194.0, 1124.5), (201.0, 1122.6), (210.0, 1122.8), (217.6, 1126.0), (219.4, 1133.0), (217.4, 1142.0),
                     (211.5, 1148.6), (204.0, 1150.0), (196.5, 1147.8), (191.8, 1141.0), (191.4, 1132.0)])
        sust = ell(219.6, 1128.4, 3.4, 2.2)
        body = separate([talus, fillet(unary_union([calc, sust]), 1.0)], 0.5)
        lines = [curve([(196.0, 1140.0), (204.0, 1143.0), (213.0, 1140.0)])]        # calcaneal tuberosity
        return Bone(body, 4.0, lines=lines)
    talus = blob([(195.6, 1112.8), (204.0, 1111.8), (212.8, 1112.8), (215.0, 1118.2), (213.4, 1124.0), (209.0, 1128.6),
                  (201.0, 1130.0), (196.0, 1126.4), (194.0, 1119.2)])
    talar_head = ell(210.6, 1130.0, 6.4, 3.8, 18)
    calc = blob([(185.4, 1131.4), (191.0, 1129.8), (196.0, 1133.4), (196.2, 1139.6), (191.4, 1142.6), (185.6, 1140.8),
                 (183.4, 1136.0)])
    navic = blob([(205.4, 1134.6), (212.6, 1133.2), (220.4, 1135.4), (224.4, 1139.8), (221.4, 1142.6), (212.8, 1141.8),
                  (206.0, 1140.6)])
    cuboid = blob([(192.4, 1139.4), (198.8, 1137.4), (203.0, 1140.6), (202.4, 1147.8), (196.0, 1150.0), (190.6, 1147.0)])
    cun_m = blob([(218.4, 1143.4), (224.0, 1142.8), (227.6, 1146.2), (226.4, 1151.6), (219.6, 1152.0), (216.8, 1147.6)])
    cun_i = blob([(212.4, 1142.6), (216.6, 1143.0), (216.8, 1150.6), (212.2, 1151.0), (211.0, 1146.6)])
    cun_l = blob([(205.6, 1141.6), (210.4, 1142.2), (210.6, 1150.4), (205.4, 1150.8), (203.8, 1146.2)])
    bones = [fillet(unary_union([talus, talar_head]), 1.6), calc, navic, cuboid, cun_m, cun_i, cun_l]
    body = unary_union([soften(g, 0.2) for g in polys_sep(bones, 0.55)])
    lines = [curve([(198.4, 1116.4), (204.2, 1115.0), (210.8, 1116.4)])]
    return Bone(body, 2.6, lines=lines)


def polys_sep(parts, gap):
    out = []
    for i, p in enumerate(parts):
        g = p
        for q in parts[i + 1:]:
            g = g.difference(q.buffer(gap))
        out.append(g)
    return out


def metatarsals():
    spec = [((220.6, 1151.6), (225.4, 1169.4), 7.4, 4.6), ((213.6, 1152.0), (215.4, 1171.0), 4.2, 3.0),
            ((207.4, 1151.6), (206.8, 1170.6), 4.0, 2.9), ((200.8, 1150.6), (198.4, 1169.2), 3.9, 2.8),
            ((193.6, 1149.4), (190.4, 1166.4), 4.1, 2.8)]
    bones = []
    for (b, h, w, r) in spec:
        shaft = tube([b, lerp(b, h, 0.5), h], [w * 1.35, w * 0.82, w * 1.0])
        bones.append(fillet(unary_union([shaft, circ(h[0], h[1], r), ell(b[0], b[1], w * 0.78, 2.6)]), 1.2))
    bones[4] = fillet(unary_union([bones[4], circ(190.2, 1148.6, 2.6)]), 1.0)
    return Bone(separate(bones, 0.45, later_on_top=False), 1.8)


def foot_phalanges():
    toes = [((225.8, 1173.8), (0.08, 1.0), [7.2, 6.4], 6.8), ((215.6, 1173.8), (0.02, 1.0), [5.2, 2.8, 2.6], 3.8),
            ((206.8, 1173.4), (-0.05, 1.0), [4.8, 2.6, 2.4], 3.6), ((198.2, 1171.8), (-0.12, 1.0), [4.4, 2.4, 2.2], 3.4),
            ((190.2, 1169.0), (-0.2, 1.0), [3.8, 2.2, 2.0], 3.2)]
    parts = []
    for (s, d, segs, w) in toes:
        L = (d[0] ** 2 + d[1] ** 2) ** 0.5
        ux, uy = d[0] / L, d[1] / L
        x, y = s
        for j, ln in enumerate(segs):
            a = (x + ux * 0.8, y + uy * 0.8)
            b = (x + ux * (0.8 + ln), y + uy * (0.8 + ln))
            taper = 1.0 if j < len(segs) - 1 else 0.82
            ww = w * (1 - 0.12 * j)
            seg = tube([a, lerp(a, b, 0.5), b], [ww * 1.18, ww * 0.78, ww * taper])
            parts.append(fillet(unary_union([seg, ell(a[0], a[1], ww * 0.6, ww * 0.42),
                                             ell(b[0], b[1], ww * 0.5 * taper, ww * 0.4)]), 0.6))
            x, y = b
    return Bone(unary_union(parts), 1.4)


# ================================================================== skull

VAULT = [(X(0), 20.8), (X(-12), 21.4), (X(-22), 23.4), (X(-31.4), 28.2), (X(-39.4), 35.6), (X(-44.8), 45.0),
         (X(-47.8), 56.0), (X(-49.0), 70.0), (X(-49.0), 84.0), (X(-46.6), 92.0), (X(-36.0), 98.0), (X(0), 100.0)]


def vault():
    return symblob(VAULT, 12)


def frontal():
    right = [(X(0), 32.2), (X(-11), 33.0), (X(-21), 35.6), (X(-29.5), 40.0), (X(-36), 46.4), (X(-40), 55.0),
             (X(-41.6), 66.0), (X(-41.8), 78.0), (X(-41.0), 88.0), (X(-38.6), 94.8), (X(-35.4), 99.6),
             (X(-32.6), 101.6), (X(-31.4), 99.4), (X(-28.0), 97.0), (X(-21.0), 95.4), (X(-14.0), 95.8),
             (X(-8.6), 97.6), (X(-4.4), 100.2), (X(-1.6), 101.4), (X(0), 101.4)]
    body = symblob(right, 10)
    top = curve([(X(-41.6), 80.0), (X(-41.0), 64.0), (X(-38.4), 50.0), (X(-31.0), 40.6), (X(-20.0), 35.2), (X(0), 32.8),
                 (X(20.0), 35.2), (X(31.0), 40.6), (X(38.4), 50.0), (X(41.0), 64.0), (X(41.6), 80.0)])
    lines = [suture(top, 0.55, 1.5),                                                    # coronal suture
             curve([(X(-28), 92.2), (X(-18), 91.0), (X(-9), 92.6)]), curve([(X(28), 92.2), (X(18), 91.0), (X(9), 92.6)]),
             curve([(X(-36.4), 52.0), (X(-37.6), 70.0), (X(-37.0), 86.0), (X(-36.0), 94.0)]),    # temporal lines
             curve([(X(36.4), 52.0), (X(37.6), 70.0), (X(37.0), 86.0), (X(36.0), 94.0)])]
    fossa = unary_union([ell(X(-15), 96.4, 1.2, 0.8), ell(X(15), 96.4, 1.2, 0.8)])           # supraorbital notches
    return Bone(body, 9.0, fossa=fossa, lines=lines)


def parietal(view):
    right = vault().intersection(box(0, 0, MID + 0.6, 92 if view == 'anterior' else 96))
    if view == 'anterior':
        body = right.difference(frontal().body.buffer(-1.4))
        lines = [suture(curve([(X(0), 21.0), (X(0), 26.0), (X(0), 32.0)]), 0.5, 1.4)]          # sagittal suture
        return Bone(body, 7.0, lines=lines)
    body = right.difference(occipital().body.buffer(-1.4))
    lines = [suture(curve([(X(0), 21.0), (X(0), 38.0), (X(0), 55.0)]), 0.55, 1.5)]
    return Bone(body, 8.0, lines=lines, fossa=circ(X(-4.2), 46.0, 0.7))                          # parietal foramen


def occipital():
    right = [(X(0), 55.0), (X(-12), 61.0), (X(-26), 70.0), (X(-36), 79.0), (X(-40.6), 88.0), (X(-41.0), 100.0),
             (X(-39.0), 112.0), (X(-35.0), 124.0), (X(-26.0), 132.6), (X(-14.0), 137.8), (X(0), 139.8)]
    body = symblob(right, 10)
    edge = curve([(X(-40.6), 88.0), (X(-36), 79.0), (X(-26), 70.0), (X(-12), 61.0), (X(0), 55.4),
                  (X(12), 61.0), (X(26), 70.0), (X(36), 79.0), (X(40.6), 88.0)])
    lines = [suture(edge, 0.6, 1.5),
             curve([(X(-24), 113.0), (X(-12), 106.4), (X(0), 104.4), (X(12), 106.4), (X(24), 113.0)]),   # superior nuchal lines
             curve([(X(-19), 124.0), (X(-9), 119.6), (X(0), 118.6), (X(9), 119.6), (X(19), 124.0)]),     # inferior nuchal lines
             curve([(X(0), 106.0), (X(0), 122.0), (X(0), 136.0)])]                                       # external occipital crest
    prot = ell(MID, 104.6, 2.8, 2.0)
    return Bone(fillet(unary_union([body, prot]), 0.6), 8.0, lines=lines)


def temporal():
    body = blob([(191.6, 84.0), (195.6, 85.6), (198.6, 90.0), (199.6, 100.0), (199.0, 112.0), (200.4, 121.0),
                 (201.6, 128.0), (200.6, 134.0), (197.8, 138.6), (194.0, 136.0), (191.4, 128.0), (190.4, 112.0), (190.4, 96.0)])
    lines = [curve([(193.0, 119.0), (196.4, 122.0)]), curve([(192.6, 128.0), (196.6, 131.6)])]
    return Bone(body, 2.8, lines=lines)


def sphenoid_wings():
    right = blob([(198.6, 81.6), (201.6, 84.0), (204.4, 92.0), (206.0, 100.0), (205.4, 106.4), (202.6, 108.8),
                  (200.4, 103.0), (199.2, 92.0)])
    return Bone(both(right), 2.4)


def sphenoid_orbit():
    right = blob([(211.0, 106.0), (217.0, 103.6), (223.0, 104.4), (226.0, 107.6), (223.6, 112.4), (216.6, 114.4),
                  (211.6, 111.8)])
    fossa = both(unary_union([ell(217.0, 108.8, 3.4, 0.6, -20), circ(224.2, 106.9, 0.9)]))
    return Bone(both(right), 2.6, fossa=fossa, light=False)


def ethmoid():
    plate = blob([(225.8, 103.0), (228.6, 102.6), (229.8, 108.0), (229.6, 116.0), (227.6, 121.0), (225.2, 117.6),
                  (224.8, 110.0)])
    perp = blob([(X(-1.2), 124.2), (X(1.2), 124.2), (X(1.4), 131.0), (X(0.8), 134.4), (X(-0.8), 134.4), (X(-1.4), 131.0)])
    concha = ell(234.2, 129.4, 2.4, 3.6, 8)
    return Bone(unary_union([both(plate), perp, both(concha)]), 1.6, light=False)


def lacrimal():
    body = blob([(227.4, 104.4), (230.2, 103.6), (231.0, 109.6), (230.2, 116.6), (227.6, 116.2), (227.0, 110.0)])
    return Bone(body, 1.2, fossa=ell(229.0, 111.0, 0.9, 2.4), light=False)


def nasal():
    body = blob([(237.6, 99.6), (240.3, 99.8), (240.3, 111.0), (240.3, 124.6), (237.2, 124.4), (234.2, 122.6),
                 (234.4, 114.0), (235.8, 105.6)])
    return Bone(body, 2.0, fossa=circ(237.4, 108.0, 0.5))


def zygomatic():
    body = blob([(207.0, 101.4), (209.2, 104.0), (209.8, 110.6), (212.8, 118.4), (218.0, 122.4), (218.6, 126.6),
                 (213.0, 129.6), (206.0, 130.6), (200.6, 128.6), (198.0, 124.6), (199.6, 118.4), (203.0, 111.0),
                 (205.0, 103.6)])
    lines = [curve([(210.4, 106.0), (211.6, 114.0), (216.0, 120.6)])]          # orbital margin
    return Bone(body, 3.4, fossa=circ(209.6, 121.0, 0.7), lines=lines)


def maxilla():
    body = blob([(229.5, 101.5), (232.6, 100.8), (234.2, 110.0), (233.6, 122.0), (231.0, 126.0), (229.4, 133.0),
                 (229.6, 141.0), (231.4, 147.4), (235.5, 150.2), (240.4, 150.6), (240.6, 155.0), (232.0, 155.6),
                 (222.0, 155.3), (213.5, 153.5), (209.2, 148.5), (207.4, 141.0), (207.6, 135.0), (211.0, 131.5),
                 (218.6, 128.0), (219.4, 123.6), (222.0, 122.4), (227.6, 121.6), (229.0, 115.0), (229.2, 107.0)])
    fossa = ell(223.6, 128.8, 1.5, 1.2)                                           # infraorbital foramen
    lines = [curve([(231.0, 101.6), (231.6, 110.0), (231.2, 120.0)]),             # anterior lacrimal crest
             curve([(236.4, 150.6), (232.0, 151.8), (224.0, 151.8), (215.0, 150.4)])]   # alveolar margin
    return Bone(body, 4.4, fossa=fossa, lines=lines)


def vomer():
    return Bone(blob([(X(-1.0), 133.6), (X(1.0), 133.6), (X(1.4), 140.0), (X(0.8), 147.6), (X(-0.8), 147.6),
                      (X(-1.4), 140.0)]), 0.8, light=False)


def inferior_concha():
    return Bone(ell(233.4, 138.6, 2.6, 4.6, 6), 1.4, light=False)


def mandible():
    right = [(X(0), 176.8), (X(-11), 176.2), (X(-20.6), 173.8), (X(-28.6), 169.4), (X(-33.2), 164.4), (X(-34.8), 157.0),
             (X(-35.6), 146.0), (X(-36.2), 137.0), (X(-37.4), 132.4), (X(-38.6), 130.6), (X(-40.6), 129.6),
             (X(-40.8), 127.4), (X(-38.4), 126.6), (X(-36.2), 128.2), (X(-34.8), 131.6), (X(-32.4), 134.4),
             (X(-30.4), 138.0), (X(-29.4), 148.0), (X(-27.4), 157.6), (X(-22.0), 161.6), (X(-11.0), 163.4), (X(0), 163.8)]
    body = symblob(right, 8)
    lines = [curve([(X(-7), 174.4), (X(0), 170.6), (X(7), 174.4)]),               # mental protuberance
             curve([(X(-31.6), 152.0), (X(-26.0), 163.0), (X(-18.0), 168.6)]),     # oblique lines
             curve([(X(31.6), 152.0), (X(26.0), 163.0), (X(18.0), 168.6)])]
    fossa = unary_union([circ(X(-18.6), 166.4, 0.8), circ(X(18.6), 166.4, 0.8)])   # mental foramina
    return Bone(body, 4.6, fossa=fossa, lines=lines)


def hyoid():
    body_ = blob([(X(-7), 184.6), (X(7), 184.6), (X(7.6), 189.4), (X(0), 190.8), (X(-7.6), 189.4)])
    horn = tube([(X(-6.4), 187.4), (X(-11), 185.4), (X(-15.0), 183.4)], [3.4, 2.6, 2.0])
    body = fillet(unary_union([body_, both(horn), both(circ(X(-6.6), 184.2, 1.2))]), 0.6)
    return Bone(body, 1.6)


def orbit_cavity():
    return blob([(207.4, 104.8), (211.4, 99.8), (219.0, 97.0), (227.6, 98.2), (232.0, 102.4), (232.8, 110.4),
                 (230.6, 118.6), (225.0, 122.8), (216.4, 123.4), (210.0, 120.2), (207.0, 112.6)])


def nasal_aperture():
    return symblob([(X(0), 124.4), (X(-4.6), 124.8), (X(-7.8), 128.6), (X(-9.6), 135.0), (X(-9.4), 142.4),
                    (X(-7.0), 147.6), (X(-3.0), 149.8), (X(0), 150.2)], 8)


def teeth():
    """Upper and lower teeth seen from the front, centre outwards: incisors, canine, premolars, molars."""
    out = []
    for upper in (True, False):
        widths = [4.0, 3.3, 3.1, 2.8, 2.6, 2.4, 2.1, 1.7] if upper else [2.9, 3.0, 3.1, 2.9, 2.7, 2.5, 2.2, 1.8]
        x = 0.0
        for i, w in enumerate(widths):
            for side in (-1, 1):
                a, b = x, x + w
                lift = 0.025 * (a + b) ** 1.25                           # the occlusal line curves up at the back
                if upper:
                    gum, edge = 152.4 + lift * 0.4, 160.2 - lift * 0.5 - (0.8 if i >= 5 else 0)
                else:
                    gum, edge = 168.0 - lift * 0.4, 160.6 + lift * 0.5 + (0.6 if i >= 5 else 0)
                tip = (0.9 if i == 2 else 0.4 if i in (3, 4) else 0.0) * (1 if upper else -1)
                xa, xb = X(side * (a + 0.18)), X(side * (b - 0.18))
                lo, hi = min(xa, xb), max(xa, xb)
                cx = (lo + hi) / 2
                neck = (hi - lo) * 0.12
                pts = [(lo + neck, gum), (hi - neck, gum), (hi, lerp((0, gum), (0, edge), 0.45)[1]),
                       (hi - 0.15, edge - (0.5 if upper else -0.5)), (cx, edge + tip),
                       (lo + 0.15, edge - (0.5 if upper else -0.5)), (lo, lerp((0, gum), (0, edge), 0.45)[1])]
                out.append(blob(pts, 6))
            x += w
    return out
