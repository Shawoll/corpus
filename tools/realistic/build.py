#!/usr/bin/env python3
"""Build the realistic skeleton drawings from the schematic ones.

    python3 tools/realistic/build.py            # writes assets/svg/skeleton-{anterior,posterior}-realistic.svg

Needs shapely (pip install shapely), for drawing only: the site itself stays dependency-free. The schematic file
for each view supplies the draw order, the ids and sides, and the joint markers, so a realistic file always has
exactly the structures of its schematic one (tools/check.mjs verifies this). Joint markers are copied unchanged;
the joints in joints.JOINTS also get an anatomy group (capsule and joint space, `jm ja`) under the same id and side,
and their dot is marked `jd`, so the Joints setting can show either.
Run `node tools/check.mjs` afterwards.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import skeleton as S  # noqa: E402
from geometry import LIGHTS, add_contact_shadows, area_d, polys_from_d, unary_union  # noqa: E402
from joints import JOINTS, joint_svg  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
JM = re.compile(r'^<circle class="jm" data-id="([^"]+)"(?: data-side="([^"]+)")? cx="([\d.]+)" cy="([\d.]+)"[^>]*/>')
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


def deco(kind, skull):
    if kind == 'under':
        return [area_d(unary_union([b.body for b in skull]).buffer(0.6).buffer(-0.1))]
    if kind == 'cav':
        orbit = S.orbit_cavity()
        return [area_d(orbit), area_d(S.mirror(orbit)), area_d(S.nasal_aperture())]
    if kind == 'teeth':
        return [area_d(t, 0.06, 0.1) for t in S.teeth()]
    raise ValueError(kind)


def assemble(view):
    """The schematic file's lines with every structure and deco group drawn realistically, and the right/left bones
    by (id, side) for the joints."""
    src = ROOT / f'assets/svg/skeleton-{view}.svg'
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
    bones, order, seen = {}, {}, {}
    for n, (_, cls, attrs, bone) in enumerate(slots):
        if bone is not None and 'deep' not in cls:
            m = re.match(r'data-id="([^"]+)"(?: data-side="([^"]+)")?', attrs)
            key = (m.group(1), m.group(2))
            # a bone drawn twice (the ribs: the half behind the body as `back`) joins its neighbours with the near half
            if key not in bones or ('back' in seen[key] and 'back' not in cls):
                bones[key], seen[key] = bone, cls
                order[bone] = n
    return lines, slots, bones, order


def build(view):
    dst = ROOT / f'assets/svg/skeleton-{view}-realistic.svg'
    lines, slots, bones, order = assemble(view)
    anatomic = 0
    for i, line in enumerate(lines):
        m = JM.match(line)
        if m and m.group(1) in JOINTS.get(view, {}):
            id_, side, cx, cy = m.group(1), m.group(2), float(m.group(3)), float(m.group(4))
            g = joint_svg(id_, side, cx, cy, JOINTS[view][id_], bones, order)
            if g:
                lines[i] = g + '\n' + line.replace('class="jm"', 'class="jm jd"', 1)
                anatomic += 1
    text = '\n'.join(lines)
    text = re.sub(r'<title>(.*?)</title>', r'<title>\1 (realistic)</title>', text, count=1)
    dst.write_text(text, encoding='utf8')
    print(f'{dst.relative_to(ROOT)}: {len(slots)} groups, {anatomic} joints as anatomy, {len(text) / 1024:.0f} KB')


if __name__ == '__main__':
    for v in sys.argv[1:] or ['anterior', 'posterior']:
        build(v)
