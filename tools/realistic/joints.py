"""Joints drawn as anatomy in the realistic skeleton: a capsule over the joint line and the joint space inside it.

Each view maps a joint id (one with a marker in the schematic file) to a spec:

    hull(bones, r)          the bone ends inside a circle of radius r around the marker, wrapped in one capsule
                            (the big ball and hinge joints: shoulder, hip, knee)
    contact(pairs, r, w)    the lines where each pair of bones meets, near the marker when r is set (else wherever
                            they meet); a capsule of reach w over each cluster of joint lines (the many small joints
                            of the hand and foot, the clavicle, the jaw…)
    digits(r)               the joints inside each finger, between its phalanges (taken from the hand data)
    suture(pairs)           fibrous joints: a serrated band along the lines where neighbouring skull bones meet

A pair is ('a', 'b'); a bone id names that side's bone or the midline one. The joint's class (synovial,
cartilaginous, fibrous) sets the colours in css/app.css through data-jclass, which map.js adds.
"""
import math

from shapely.geometry import LineString, Point
from shapely.ops import linemerge

import skeleton as S
from geometry import area_d, circ, mirror, polys, soften, suture as serrate, unary_union


def hull(bones, r):
    return ('hull', tuple(bones), r)


def contact(pairs, r=None, w=3.0, g=0.9):
    return ('contact', tuple(pairs), r, w, g)


def digits(bone='hand-phalanges'):
    return ('digits', bone)


def suture(pairs, g=1.0):
    return ('suture', tuple(pairs), g)


SKULL_BACK = [('parietal', 'occipital'), ('parietal', 'temporal'), ('occipital', 'temporal'), ('parietal', 'parietal')]
SKULL_FRONT = [('frontal', 'parietal'), ('parietal', 'temporal'), ('frontal', 'sphenoid'), ('sphenoid', 'temporal'),
               ('sphenoid', 'parietal'), ('parietal', 'parietal')]
FACE_FRONT = [('nasal', 'frontal'), ('nasal', 'maxilla'), ('maxilla', 'zygomatic'), ('zygomatic', 'frontal'),
              ('zygomatic', 'temporal'), ('maxilla', 'frontal'), ('zygomatic', 'sphenoid'), ('nasal', 'nasal'), ('maxilla', 'maxilla')]

JOINTS = {
    'anterior': {
        'cranial-sutures': suture(SKULL_FRONT),
        'facial-sutures': suture(FACE_FRONT),
        'tmj': contact([('temporal', 'mandible')], r=8, w=2.6),
        'sternoclavicular': contact([('sternum', 'clavicle')], r=9, w=2.6),
        'acromioclavicular': contact([('clavicle', 'scapula')], r=7, w=2.4),
        'sternocostal': contact([('sternum', f'rib-{n}') for n in range(1, 8)], w=2.0),
        'interchondral': contact([('rib-7', 'rib-8'), ('rib-8', 'rib-9'), ('rib-9', 'rib-10')], r=31, w=2.0, g=1.2),
        'shoulder': hull(('humerus', 'scapula'), 15),
        'elbow': contact([('humerus', 'ulna'), ('humerus', 'radius'), ('radius', 'ulna')], r=16, w=4.0, g=1.7),
        'proximal-radioulnar': contact([('radius', 'ulna')], r=8, w=2.4, g=2.6),
        'distal-radioulnar': hull(('radius', 'ulna'), 7),
        'intercarpal': contact([('carpals', 'carpals')], w=1.4),
        'wrist': contact([('radius', 'carpals'), ('ulna', 'carpals')], r=22, w=3.0),
        'carpometacarpal': contact([('carpals', 'metacarpals')], w=2.0),
        'metacarpophalangeal': contact([('metacarpals', 'hand-phalanges')], w=2.4),
        'hand-interphalangeal': digits(),
        'sacroiliac': contact([('sacrum', 'hip-bone')], r=22, w=2.4),
        'hip': hull(('femur', 'hip-bone'), 17),
        'knee': hull(('femur', 'tibia'), 24),
        'proximal-tibiofibular': contact([('tibia', 'fibula')], r=7, w=2.2),
        'ankle': contact([('tibia', 'tarsals'), ('fibula', 'tarsals'), ('tibia', 'fibula')], r=15, w=3.2),
        'distal-tibiofibular': contact([('tibia', 'fibula')], r=5, w=2.0),
        'subtalar-midfoot': contact([('tarsals', 'tarsals')], w=1.6),
        'tarsometatarsal': contact([('tarsals', 'metatarsals')], w=1.8),
        'metatarsophalangeal': contact([('metatarsals', 'foot-phalanges')], w=2.0),
        'foot-interphalangeal': digits('foot-phalanges'),
    },
    'posterior': {
        'cranial-sutures': suture(SKULL_BACK),
        'atlanto-occipital': contact([('occipital', 'c1')], r=12, w=2.4),
        'atlanto-axial': contact([('c1', 'c2')], r=8, w=2.2, g=2.5),
        'costovertebral': contact([(f'rib-{n}', f't{t}') for n, t in [(1, 1), (2, 1), (2, 2), (3, 2), (3, 3), (4, 3), (4, 4), (5, 4), (5, 5), (6, 5), (6, 6), (7, 6), (7, 7), (8, 7), (8, 8), (9, 8), (9, 9), (10, 10), (11, 11), (12, 12)]], w=1.8),
        'acromioclavicular': contact([('clavicle', 'scapula')], r=7, w=2.4),
        'shoulder': hull(('humerus', 'scapula'), 15),
        'elbow': hull(('humerus', 'ulna', 'radius'), 13),   # from behind: around the olecranon
        'proximal-radioulnar': contact([('radius', 'ulna')], r=8, w=2.4, g=2.6),
        'distal-radioulnar': hull(('radius', 'ulna'), 7),
        'wrist': contact([('radius', 'carpals'), ('ulna', 'carpals')], r=22, w=3.0),
        'intercarpal': contact([('carpals', 'carpals')], w=1.4),
        'carpometacarpal': contact([('carpals', 'metacarpals')], w=2.0),
        'metacarpophalangeal': contact([('metacarpals', 'hand-phalanges')], w=2.4),
        'hand-interphalangeal': digits(),
        'sacroiliac': contact([('sacrum', 'hip-bone')], r=22, w=2.4),
        'hip': hull(('femur', 'hip-bone'), 17),
        'knee': hull(('femur', 'tibia'), 24),
        'proximal-tibiofibular': contact([('tibia', 'fibula')], r=7, w=2.2),
        'ankle': contact([('tibia', 'tarsals'), ('fibula', 'tarsals'), ('tibia', 'fibula')], r=15, w=3.2),
        'distal-tibiofibular': contact([('tibia', 'fibula')], r=5, w=2.0),
        'subtalar-midfoot': contact([('tarsals', 'tarsals')], w=1.6),
        'sacrococcygeal': contact([('sacrum', 'coccyx')], r=8, w=2.0),
    },
}


def _key(bones, bid, side):
    for k in ((bid, side), (bid, None)):
        if k in bones:
            return k
    return None


def _lines(g):
    """The line parts of a geometry, merged where they join."""
    parts = []
    for p in getattr(g, 'geoms', [g]):
        if p.is_empty:
            continue
        if p.geom_type == 'LineString':
            parts.append(p)
        elif p.geom_type in ('MultiLineString', 'GeometryCollection'):
            parts += _lines(p)
    if not parts:
        return []
    u = unary_union(parts)
    merged = linemerge(u) if u.geom_type == 'MultiLineString' else u
    return [m for m in getattr(merged, 'geoms', [merged]) if m.length > 0.8]


def _shape(bone):
    """A bone with the cartilage drawn beside it (the costal cartilages of the ribs)."""
    if bone.cart is not None and bone.cart_outside:
        return unary_union([bone.body, bone.cart])
    return bone.body


def meeting(a, b, g, order):
    """Where bone a meets bone b: the visible edge of the one drawn on top that lies over or against the other,
    and any narrow gap between them. With a == b, where the separate bones of one group meet (the carpals)."""
    if a is b:
        ps = polys(a.body)
        edges, gaps = [], []
        for i, p in enumerate(ps):
            for q in ps[i + 1:]:
                if p.distance(q) > 2 * g:
                    continue
                edges.append(p.boundary.intersection(q.buffer(g)))
                gaps.append(p.buffer(g).intersection(q.buffer(g)))
        gap = unary_union(gaps).difference(a.body.buffer(0.05)) if gaps else a.body.buffer(0).difference(a.body)
        return [x for e in edges for x in _lines(e)], gap
    sa, sb = _shape(a), _shape(b)
    top, under = ((a, sa), (b, sb)) if order[a] > order[b] else ((b, sb), (a, sa))
    edge = top[1].boundary.intersection(under[1].buffer(g))
    gap = sa.buffer(g).intersection(sb.buffer(g)).difference(unary_union([sa, sb]).buffer(0.05))
    return _lines(edge), gap


def _clusters(geoms, d):
    """Group geometries that lie within d of each other."""
    groups = []
    for g in geoms:
        hit = [G for G in groups if G[0].distance(g) < d]
        merged = unary_union([g] + [G[0] for G in hit])
        groups = [G for G in groups if G not in hit] + [(merged,)]
    return [G[0] for G in groups]


def _capsule(space, bodies, w):
    sleeve = unary_union([space, bodies.intersection(space.buffer(w))])
    return soften(sleeve.convex_hull.buffer(0.9), min(2.4, w * 0.8))


def draw_hull(spec, side, cx, cy, bones, order):
    _, ids, r = spec
    zone = circ(cx, cy, r)
    ends = [bones[_key(bones, b, side)].body.intersection(zone) for b in ids]
    hull_ = unary_union(ends).convex_hull
    space = hull_.buffer(-0.3).difference(unary_union([e.buffer(0.15) for e in ends]))
    space = unary_union([g for g in polys(space) if g.area > 1.5])
    # the capsule is a sleeve over the joint line: the joint space plus a band of each bone end beside it
    sleeve = unary_union([space] + [e.intersection(space.buffer(min(r * 0.45, 7))) for e in ends]) if not space.is_empty else hull_
    return soften(sleeve.convex_hull.buffer(1.2), 2.6), space


def draw_contact(spec, side, cx, cy, bones, order):
    _, pairs, r, w, g = spec
    zone = circ(cx, cy, r) if r else None
    lines, gaps, bodies = [], [], []
    for a, b in pairs:
        ka, kb = _key(bones, a, side), _key(bones, b, side)
        if not ka or not kb:
            continue
        A, B = bones[ka], bones[kb]
        bodies += [_shape(A), _shape(B)]
        ls, gap = meeting(A, B, g, order)
        if zone is not None:
            ls = [x for l in ls for x in _lines(l.intersection(zone))]
            gap = gap.intersection(zone)
        lines += ls
        gaps += [p for p in polys(gap) if p.area > 0.4]
    bodies = unary_union(bodies)
    space = unary_union([l.buffer(0.42, cap_style=1) for l in lines] + gaps)
    space = space.intersection(bodies.buffer(max(0.6, g)))
    parts = [p for p in polys(space) if p.area > 0.5]
    if not parts:
        return None, None
    caps = [_capsule(c, bodies, w) for c in _clusters(parts, w * 0.9)]
    return unary_union(caps), unary_union(parts)


def draw_digits(spec, side, cx, cy, bones, order):
    _, bid = spec
    body = bones[_key(bones, bid, side)].body
    spaces, caps = [], []
    for segs, width in (S.HAND['ph'] if bid == 'hand-phalanges' else [(ab, w * 0.8) for ab, w in S.toe_segments()]):
        for j in range(len(segs) - 1):
            (_, b), (a, _) = segs[j], segs[j + 1]
            if side == 'left':
                a, b = (2 * 240 - a[0], a[1]), (2 * 240 - b[0], b[1])
            px, py = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            dx, dy = a[0] - b[0], a[1] - b[1]
            m = math.hypot(dx, dy) or 1
            nx, ny = -dy / m, dx / m
            half = width * 0.75
            line = LineString([(px - nx * half, py - ny * half), (px + nx * half, py + ny * half)])
            sp = line.buffer(0.5, cap_style=2).intersection(body.buffer(0.3))
            if sp.is_empty:
                continue
            spaces.append(sp)
            caps.append(soften(body.intersection(Point(px, py).buffer(width * 0.62)).buffer(0.7), 0.6))
    return unary_union(caps), unary_union(spaces)


def draw_suture(spec, side, cx, cy, bones, order):
    _, pairs, g = spec
    bands, hits = [], []
    for a, b in pairs:
        for sd in (('right', 'left') if side is None else (side,)):
            ka, kb = _key(bones, a, sd), _key(bones, b, sd)
            if not ka or not kb or ka == kb:
                continue
            ls, _ = meeting(bones[ka], bones[kb], g, order)
            for l in ls:
                if l.length < 2:
                    continue
                bands.append(serrate(l, 0.4, 1.3).buffer(0.2, cap_style=1, join_style=1))
                hits.append(l.buffer(2.2, cap_style=1))
    if side is None:   # the midline sutures between the two halves of paired bones (sagittal, internasal…)
        for a, b in pairs:
            if a == b:
                ka, kb = _key(bones, a, 'right'), _key(bones, a, 'left')
                if ka and kb:
                    for l in meeting(bones[ka], bones[kb], g, order)[0]:
                        bands.append(serrate(l, 0.4, 1.3).buffer(0.2, cap_style=1, join_style=1))
                        hits.append(l.buffer(2.2, cap_style=1))
    if not bands:
        return None, None
    return unary_union(hits), unary_union(bands)


DRAW = {'hull': draw_hull, 'contact': draw_contact, 'digits': draw_digits, 'suture': draw_suture}


def joint_svg(id_, side, cx, cy, spec, bones, order):
    """The anatomy group for one joint marker, or None when nothing meets there in this view."""
    cap, space = DRAW[spec[0]](spec, side, cx, cy, bones, order)
    if cap is None or cap.is_empty:
        return None
    attrs = f'data-id="{id_}"' + (f' data-side="{side}"' if side else '')
    kind = ' su' if spec[0] == 'suture' else ''
    paths = f'<path class="cap" d="{area_d(cap, 0.1)}"/>'
    if space is not None and not space.is_empty:
        paths += f'<path class="js" d="{area_d(space, 0.06, 0.1)}"/>'
    return f'<g class="jm ja{kind}" {attrs}>{paths}</g>'
