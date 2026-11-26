#!/usr/bin/env python3
"""Build the realistic skeleton drawings from the schematic ones.

    python3 tools/realistic/build.py            # writes assets/svg/skeleton-{anterior,posterior}-realistic.svg

Needs shapely (pip install shapely), for drawing only: the site itself stays dependency-free. The schematic file
for each view supplies the draw order, the ids and sides, and the joint markers, so a realistic file always has
exactly the structures of its schematic one (tools/check.mjs verifies this). Joint markers are copied unchanged,
except the joints in ANATOMIC, which are drawn as anatomy (capsule and joint space) under the same id and side.
Run `node tools/check.mjs` afterwards.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import skeleton as S  # noqa: E402
from geometry import LIGHTS, Bone, add_contact_shadows, area_d, circ, polys_from_d, soften, unary_union  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
JM = re.compile(r'^<circle class="jm" data-id="([^"]+)"(?: data-side="([^"]+)")? cx="([\d.]+)" cy="([\d.]+)"[^>]*/>')
# Joints drawn as anatomy rather than a dot (pilot): joint id -> (the bones it joins, radius of the joint region).
# The capsule is the hull of the bone ends inside that radius; the joint space is the part of the hull no bone covers
# (cartilage, and the menisci at the knee).
ANATOMIC = {'anterior': {'shoulder': (('humerus', 'scapula'), 15), 'hip': (('femur', 'hip-bone'), 17),
                         'knee': (('femur', 'tibia'), 24)}}
GROUP = re.compile(r'^<g class="((?:s|deco)(?: [^"]*)?)"(?: data-id="([^"]+)")?(?: data-side="([^"]+)")?[^>]*>')


def factory(cls, id_, view, line):
    """The right-side (or midline) Bone for one schematic group."""
    classes = cls.split()
    if id_.startswith('rib-'):
        n = int(id_[4:])
        behind = 'back' in classes
        part = ('back' if behind else 'front') if view == 'anterior' else ('front' if behind else 'back')
        return S.rib(n, part, view)
    if id_ == 'intervertebral':
        m = re.search(r'class="b"[^>]*d="([^"]*)"', line)
        return S.disc(unary_union(polys_from_d(m.group(1))).bounds)
    if id_ in S.VERTS:
        return S.vertebra_front(id_) if view == 'anterior' else S.vertebra_back(id_)
    if id_ == 'sphenoid':
        return S.sphenoid_orbit() if 'deep' in classes else S.sphenoid_wings()
    by_view = {'scapula', 'hip-bone', 'sacrum', 'parietal', 'humerus', 'radius', 'ulna', 'carpals', 'femur', 'tibia',
               'tarsals'}
    simple = {'coccyx': S.coccyx, 'pubic-symphysis': S.symphysis, 'sternum': S.sternum, 'clavicle': S.clavicle,
              'mandible': S.mandible, 'temporal': S.temporal, 'frontal': S.frontal, 'occipital': S.occipital,
              'ethmoid': S.ethmoid, 'lacrimal': S.lacrimal, 'nasal': S.nasal, 'zygomatic': S.zygomatic,
              'maxilla': S.maxilla, 'vomer': S.vomer, 'inferior-concha': S.inferior_concha, 'hyoid': S.hyoid,
              'metacarpals': S.metacarpals, 'hand-phalanges': S.hand_phalanges, 'fibula': S.fibula,
              'patella': S.patella, 'metatarsals': S.metatarsals, 'foot-phalanges': S.foot_phalanges}
    if id_ in by_view:
        return getattr(S, id_.replace('-', '_'))(view)
    return simple[id_]()


def joint_svg(id_, side, cx, cy, spec, bones):
    """A synovial joint as anatomy: the capsule (.cap) around the bone ends and the joint space (.js) between them."""
    ids, r = spec
    zone = circ(cx, cy, r)
    ends = [bones[(b, side)].body.intersection(zone) for b in ids]
    hull = unary_union(ends).convex_hull
    space = hull.buffer(-0.3).difference(unary_union([e.buffer(0.15) for e in ends]))
    space = unary_union([g for g in getattr(space, 'geoms', [space]) if g.area > 1.5])
    # the capsule is a sleeve over the joint line: the joint space plus a band of each bone end beside it
    sleeve = unary_union([space] + [e.intersection(space.buffer(min(r * 0.45, 7))) for e in ends]) if not space.is_empty else hull
    cap = soften(sleeve.convex_hull.buffer(1.2), 2.6)
    attrs = f'data-id="{id_}"' + (f' data-side="{side}"' if side else '')
    paths = f'<path class="cap" d="{area_d(cap, 0.1)}"/>'
    if not space.is_empty:
        paths += f'<path class="js" d="{area_d(space, 0.08)}"/>'
    return f'<g class="jm ja" {attrs}>{paths}</g>'


def deco(kind, skull):
    if kind == 'under':
        return [area_d(unary_union([b.body for b in skull]).buffer(0.6).buffer(-0.1))]
    if kind == 'cav':
        orbit = S.orbit_cavity()
        return [area_d(orbit), area_d(S.mirror(orbit)), area_d(S.nasal_aperture())]
    if kind == 'teeth':
        return [area_d(t, 0.06, 0.1) for t in S.teeth()]
    raise ValueError(kind)


def build(view):
    src = ROOT / f'assets/svg/skeleton-{view}.svg'
    dst = ROOT / f'assets/svg/skeleton-{view}-realistic.svg'
    lines = src.read_text(encoding='utf8').split('\n')
    cache = {}
    slots = []   # (line index, cls, attrs, Bone) for structures; decos are filled in after
    for i, line in enumerate(lines):
        m = GROUP.match(line)
        if not m:
            continue
        cls, id_, side = m.groups()
        if cls.startswith('deco'):
            slots.append((i, cls, None, None))
            continue
        key = (cls, id_)
        if id_ == 'intervertebral':
            bone = factory(cls, id_, view, line)
        else:
            if key not in cache:
                cache[key] = factory(cls, id_, view, line)
            bone = cache[key] if side != 'left' else cache[key].mirrored()
        attrs = f'data-id="{id_}"' + (f' data-side="{side}"' if side else '')
        slots.append((i, cls, attrs, bone))

    light = LIGHTS[view]
    add_contact_shadows([(cls, b) for _, cls, _, b in slots if b is not None], light)

    skull_ids = {'frontal', 'parietal', 'temporal', 'sphenoid', 'zygomatic', 'maxilla', 'nasal', 'mandible'}
    skull = [b for _, cls, attrs, b in slots if b is not None and 'deep' not in cls
             and re.search(r'data-id="([^"]+)"', attrs).group(1) in skull_ids]
    for i, cls, attrs, bone in slots:
        if bone is None:
            kind = cls.split()[1]
            paths = ''.join(f'<path d="{d}"/>' for d in deco(kind, skull) if d)
            lines[i] = f'<g class="{cls}" aria-hidden="true">{paths}</g>'
        else:
            lines[i] = bone.svg(attrs, cls, light)
    bones = {}
    for _, cls, attrs, bone in slots:
        if bone is not None and 'deep' not in cls:
            m = re.match(r'data-id="([^"]+)"(?: data-side="([^"]+)")?', attrs)
            bones.setdefault((m.group(1), m.group(2)), bone)
    for i, line in enumerate(lines):
        m = JM.match(line)
        if m and m.group(1) in ANATOMIC.get(view, {}):
            id_, side, cx, cy = m.group(1), m.group(2), float(m.group(3)), float(m.group(4))
            lines[i] = joint_svg(id_, side, cx, cy, ANATOMIC[view][id_], bones)
    text = '\n'.join(lines)
    text = re.sub(r'<title>(.*?)</title>', r'<title>\1 (realistic)</title>', text, count=1)
    dst.write_text(text, encoding='utf8')
    print(f'{dst.relative_to(ROOT)}: {len(slots)} groups, {len(text) / 1024:.0f} KB')


if __name__ == '__main__':
    for v in sys.argv[1:] or ['anterior', 'posterior']:
        build(v)
