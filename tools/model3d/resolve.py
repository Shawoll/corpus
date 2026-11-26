"""Resolve map.json against the source index (drawing tool only).

resolve() returns {layer: {corpus id: [part, ...]}} where each part is an
entry of source/index.json. Used by coverage.py and build.py.
"""
import json
import pathlib
import re

HERE = pathlib.Path(__file__).parent
ROOT = HERE.parent.parent
SIDE = re.compile(r'\.([rl])$')
# Label anchors (.j .i .t .s), muscle attachment patches (.or .er .o1r …) and copies (.001).
TAG = re.compile(r'\.[a-z0-9]{1,4}$')


def base(name):
    return SIDE.sub('', name).strip()


def clean(part):
    return part['tris'] > 12 and not TAG.search(base(part['name'])) and not part['name'].startswith('Cross Section')


def side_of(part):
    """'right', 'left' or None (a midline part, split at x = 0 if needed)."""
    m = SIDE.search(part['name'])
    if m:
        return 'right' if m.group(1) == 'r' else 'left'
    words = part['name'].lower()
    if re.search(r'\bright\b', words):
        return 'right'
    if re.search(r'\bleft\b', words):
        return 'left'
    return None


def load():
    index = json.loads((HERE / 'source' / 'index.json').read_text())
    mapping = json.loads((HERE / 'map.json').read_text())
    return index, mapping


def resolve(index=None, mapping=None):
    if index is None:
        index, mapping = load()
    parts = [p for p in index if clean(p)]
    by_base = {}
    for p in parts:
        by_base.setdefault(base(p['name']).lower(), []).append(p)
    exact = {}
    for layer, ids in mapping['layers'].items():
        for cid, names in ids.items():
            for n in names:
                if not n.startswith('@'):
                    exact[n.lower()] = cid
    out, unknown = {}, []
    for layer, ids in mapping['layers'].items():
        out[layer] = {}
        for cid, names in ids.items():
            got = []
            for n in names:
                if n.startswith('@'):
                    group = n[1:]
                    g = group.lower()
                    hits = [p for p in parts
                            if (base(p['name']).lower() == g or any(base(c).lower() == g for c in p['chain']))
                            and exact.get(base(p['name']).lower(), cid) == cid]
                else:
                    hits = by_base.get(n.lower(), [])
                if not hits:
                    unknown.append((layer, cid, n))
                got.extend(h for h in hits if h not in got)
            out[layer][cid] = got
    return out, unknown
