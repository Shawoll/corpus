"""Build the 3D model: one .glb per layer in assets/3d/ (drawing tool only).

Run from the repository root (needs ~/.venvs/corpus with numpy and meshoptimizer,
and the Z-Anatomy source in tools/model3d/source/, see index_source.py):

    ~/.venvs/corpus/bin/python -I tools/model3d/build.py            # every layer in map.json
    ~/.venvs/corpus/bin/python -I tools/model3d/build.py skeleton   # just these layers

For each Corpus key (`femur:right`, `heart`) the parts map.json names are merged,
split into right and left where needed, simplified to the layer's triangle
budget, quantised and written as one mesh node named with the key. Files use
KHR_mesh_quantization and EXT_meshopt_compression; three.js decodes both.
assets/3d/keys.json lists the keys in each file ("layers"), the areas the skin
covers ("skin") and the body's bounds, so the app knows what the 3D view shows without loading every model.
Each node's extras carry { key, sex? } (three.js strips ':' from node names).

Frame: the source is Y-up in centimetres, facing +Z, with the body's right at
x < 0, so a camera on +Z sees the body's right on the viewer's left, as in the
front drawings. Output is in metres.
"""
import json
import pathlib
import struct
import sys

import numpy as np
import meshoptimizer as mo

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))
import fbx  # noqa: E402
import generated  # noqa: E402
import joints  # noqa: E402
import outlines  # noqa: E402
import skin  # noqa: E402
from resolve import ROOT, load, resolve, side_of  # noqa: E402

OUT = ROOT / 'assets' / '3d'
SRC = HERE / 'source' / 'zanatomy'
# triangles per layer after simplification
BUDGET = {'skeleton': 320_000, 'muscles': 320_000, 'organs': 140_000, 'vessels': 90_000,
          'nerves': 70_000, 'ligaments': 16_000, 'lymphatics': 24_000, 'skin': 60_000}
MIN_TRIS = 160  # small parts (a parathyroid) keep at least this many, if they have them
CM = 0.01  # source centimetres → metres


def frame(index):
    """One quantisation grid shared by every file, so the layers line up: origin (m) and step (m)."""
    lo = np.min([p['min'] for p in index if p['min']], axis=0) * CM - 0.01
    hi = np.max([p['max'] for p in index if p['max']], axis=0) * CM + 0.01
    step = float((hi - lo).max() / 65535)
    return lo, step


def read_parts(wanted):
    """{(file, i): (vertices N×3 in m, faces M×3)} for the wanted parts, reading each FBX file once."""
    out = {}
    for file in sorted({f for f, _ in wanted}):
        idx = {i for f, i in wanted if f == file}
        for i, (_, _, v, f) in enumerate(fbx.meshes(SRC / f'{file}.fbx')):
            if i in idx:
                out[(file, i)] = (v * CM, f)
        print(f'  read {file}: {len(idx)} parts', file=sys.stderr)
    return out


def split_x(v, f, right):
    """Keep the triangles whose centre is on one side of x = 0 (the body's right is x < 0)."""
    cx = v[f].mean(axis=1)[:, 0]
    return v, f[(cx < 0) if right else (cx >= 0)]


def merge(pieces):
    vs, fs, n = [], [], 0
    for v, f in pieces:
        if not len(f):
            continue
        vs.append(v)
        fs.append(f + n)
        n += len(v)
    if not vs:
        return None
    return np.concatenate(vs).astype(np.float32), np.concatenate(fs).astype(np.uint32)


def weld(v, f):
    """Merge duplicate vertices (FBX exports split them per face corner)."""
    q = np.round(v / 1e-5).astype(np.int64)
    _, first, inv = np.unique(q, axis=0, return_index=True, return_inverse=True)
    return v[first], inv.reshape(-1)[f].astype(np.uint32)


def simplify(v, f, target):
    if len(f) <= target:
        return f
    idx = f.reshape(-1).astype(np.uint32)
    dest = np.zeros_like(idx)
    n = mo.simplify(dest, idx, v, target_index_count=target * 3, target_error=0.02)
    if n > target * 3 * 1.5:  # topology kept it from getting there: let it drop small features too
        dest2 = np.zeros_like(idx)
        n = mo.simplify_sloppy(dest2, idx, v, target_index_count=target * 3, target_error=0.02)
        dest = dest2
    return dest[:n].reshape(-1, 3)


def allocate(sizes, budget):
    """Triangles per mesh: shares of the budget by the square root of each source size, so one huge source
    (the brain's folded cortex) can't starve the small organs; no mesh gets more than it has, and what a
    capped mesh leaves goes to the others."""
    left, out, todo = budget, {}, dict(sizes)
    while todo:
        w = {k: n ** 0.5 for k, n in todo.items()}
        total = sum(w.values())
        capped = {k: n for k, n in todo.items() if left * w[k] / total >= n}
        if not capped:
            out.update({k: max(MIN_TRIS, round(left * w[k] / total)) for k in todo})
            break
        for k, n in capped.items():
            out[k] = n
            left -= n
            del todo[k]
    return out


def compact(v, f):
    used, inv = np.unique(f.reshape(-1), return_inverse=True)
    return v[used], inv.reshape(-1, 3).astype(np.uint32)


def normals(v, f):
    n = np.zeros_like(v, dtype=np.float64)
    fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])  # area-weighted
    for k in range(3):
        np.add.at(n, f[:, k], fn)
    ln = np.linalg.norm(n, axis=1, keepdims=True)
    ln[ln == 0] = 1
    return (n / ln).astype(np.float32)


def optimise(v, f):
    idx = f.reshape(-1).astype(np.uint32)
    out = np.zeros_like(idx)
    mo.optimize_vertex_cache(out, idx, vertex_count=len(v))
    vv = np.zeros_like(v)
    nv = mo.optimize_vertex_fetch(vv, out, v, vertex_count=len(v), vertex_size=v.itemsize * 3)
    return vv[:nv], out.reshape(-1, 3)


class Glb:
    """A glTF 2.0 binary with meshopt-compressed, quantised meshes."""

    def __init__(self, origin, step):
        self.origin, self.step = origin, step
        self.bin = bytearray()  # compressed data (buffer 0)
        self.fallback = 0  # uncompressed size (buffer 1, never fetched)
        self.views, self.accessors, self.meshes, self.nodes = [], [], [], []

    def _view(self, raw, stride, count, mode, target):
        data = mo.encode_index_buffer(raw, vertex_count=int(raw.max()) + 1) if mode == 'TRIANGLES' \
            else mo.encode_vertex_buffer(raw, vertex_count=count, vertex_size=stride)
        while len(self.bin) % 4:
            self.bin.append(0)
        off = len(self.bin)
        self.bin += data
        size = stride * count
        fb = self.fallback
        self.fallback += (size + 3) // 4 * 4
        view = {'buffer': 1, 'byteOffset': fb, 'byteLength': size, 'target': target,
                'extensions': {'EXT_meshopt_compression': {'buffer': 0, 'byteOffset': off, 'byteLength': len(data),
                                                           'byteStride': stride, 'mode': mode, 'count': count}}}
        if mode == 'ATTRIBUTES':
            view['byteStride'] = stride
        self.views.append(view)
        return len(self.views) - 1

    def add(self, key, v, f, extras=None, attrs=None):
        """One mesh node. attrs: extra vertex attributes {'_NAME': int16 array n×4} (glTF custom attributes)."""
        q = np.clip(np.round((v - self.origin) / self.step), 0, 65535).astype(np.uint16)
        v_ = q.astype(np.float32) * self.step + self.origin  # normals from what is drawn
        nrm = normals(v_, f)
        pos = np.zeros((len(q), 4), np.uint16)
        pos[:, :3] = q
        nb = np.zeros((len(q), 4), np.int8)
        nb[:, :3] = np.clip(np.round(nrm * 127), -127, 127)
        n = len(q)
        pv = self._view(pos.view(np.uint8).reshape(n, 8), 8, n, 'ATTRIBUTES', 34962)
        nv = self._view(nb.view(np.uint8).reshape(n, 4), 4, n, 'ATTRIBUTES', 34962)
        wide = n > 65535
        idx = f.reshape(-1).astype(np.uint32 if wide else np.uint16)
        iv = self._view(idx.astype(np.uint32), 4 if wide else 2, len(idx), 'TRIANGLES', 34963)
        a = len(self.accessors)
        self.accessors += [
            {'bufferView': pv, 'componentType': 5123, 'count': n, 'type': 'VEC3',
             'min': q.min(0).tolist(), 'max': q.max(0).tolist()},
            {'bufferView': nv, 'componentType': 5120, 'normalized': True, 'count': n, 'type': 'VEC3'},
            {'bufferView': iv, 'componentType': 5125 if wide else 5123, 'count': len(idx), 'type': 'SCALAR'},
        ]
        attributes = {'POSITION': a, 'NORMAL': a + 1}
        for name, arr in (attrs or {}).items():
            av = self._view(np.ascontiguousarray(arr, dtype=np.int16).view(np.uint8).reshape(n, 8), 8, n, 'ATTRIBUTES', 34962)
            attributes[name] = len(self.accessors)
            self.accessors.append({'bufferView': av, 'componentType': 5122, 'count': n, 'type': 'VEC4'})
        self.meshes.append({'name': key, 'primitives': [{'attributes': attributes, 'indices': a + 2, 'material': 0}]})
        node = {'name': key, 'mesh': len(self.meshes) - 1, 'translation': [float(x) for x in self.origin],
                'scale': [self.step] * 3}
        if extras:
            node['extras'] = extras
        self.nodes.append(node)

    def write(self, path, layer):
        while len(self.bin) % 4:
            self.bin.append(0)
        gltf = {
            'asset': {'version': '2.0', 'generator': 'Corpus tools/model3d/build.py',
                      'copyright': 'Z-Anatomy (CC BY-SA 4.0), after BodyParts3D © The Database Center for Life Science (CC BY 4.0)'},
            'extensionsUsed': ['EXT_meshopt_compression', 'KHR_mesh_quantization'],
            'extensionsRequired': ['EXT_meshopt_compression', 'KHR_mesh_quantization'],
            'scene': 0, 'scenes': [{'name': layer, 'nodes': list(range(len(self.nodes)))}],
            'nodes': self.nodes, 'meshes': self.meshes, 'accessors': self.accessors, 'bufferViews': self.views,
            'materials': [{'name': layer, 'pbrMetallicRoughness': {'baseColorFactor': [0.9, 0.88, 0.84, 1], 'metallicFactor': 0, 'roughnessFactor': 0.8}}],
            'buffers': [{'byteLength': len(self.bin)},
                        {'byteLength': self.fallback, 'extensions': {'EXT_meshopt_compression': {'fallback': True}}}],
        }
        js = json.dumps(gltf, separators=(',', ':')).encode()
        js += b' ' * (-len(js) % 4)
        total = 12 + 8 + len(js) + 8 + len(self.bin)
        with open(path, 'wb') as out:
            out.write(struct.pack('<III', 0x46546C67, 2, total))
            out.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
            out.write(struct.pack('<II', len(self.bin), 0x004E4942) + bytes(self.bin))
        return total


def corpus_layers():
    manifest = json.loads((ROOT / 'data' / 'manifest.json').read_text())
    out = {}
    for layer in manifest['layers']:
        data = json.loads((ROOT / layer['data']).read_text())
        out[layer['id']] = {s['id']: s for s in data['structures']}
    return out


def key_meshes(layer, res, known, geo):
    """{key: (vertices, faces)} for a layer: paired ids split by side, midline ids take everything."""
    pieces = {}
    for cid, parts in res[layer].items():
        s = known.get(cid)
        if not s:
            sys.exit(f'map.json: "{cid}" is not in the {layer} data')
        for p in parts:
            v, f = geo[(p['file'], p['i'])]
            if not s.get('paired'):
                pieces.setdefault(cid, []).append((v, f))
                continue
            side = side_of(p)
            for sd in ([side] if side else ['right', 'left']):
                piece = (v, f) if side else split_x(v, f, sd == 'right')
                pieces.setdefault(f'{cid}:{sd}', []).append(piece)
    meshes = {}
    for key, ps in pieces.items():
        m = merge(ps)
        if m:
            meshes[key] = weld(*m)
    return meshes


def build_skin(index, res, structures, geo, origin, step):
    """assets/3d/skin.glb: one mesh with a _HURT attribute per vertex: (2D x, 2D y) × 16, area index, 0."""
    parts = skin.skin_parts(index)
    v, f = weld(*merge([geo[(p['file'], p['i'])] for p in parts]))
    total = len(f)
    f = simplify(v, f, BUDGET['skin'])
    v, f = compact(v, f)
    v, f = optimise(v, f)
    bones = {k: bv for k, (bv, _) in key_meshes('skeleton', res, structures['skeleton'], geo).items()}
    flat = skin.flat_fit(bones)(v[:, :2].astype(np.float64))
    area, keys = skin.areas(flat, normals(v, f)[:, 2])
    hurt = np.zeros((len(v), 4), np.int16)
    hurt[:, 0:2] = np.clip(np.round(flat * skin.FLAT_SCALE), -32767, 32767)
    hurt[:, 2] = area
    glb = Glb(origin, step)
    glb.add('skin', v, f, {'skin': True, 'regions': keys, 'flatScale': skin.FLAT_SCALE}, attrs={'_HURT': hurt})
    size = glb.write(OUT / 'skin.glb', 'skin')
    print(f'skin: {total:,} → {len(f):,} triangles, {(area > 0).mean():.0%} of vertices in an area, '
          f'{size / 1e6:.2f} MB', file=sys.stderr)
    return sorted({keys[i] for i in np.unique(area) if i})


def main(only):
    mo.encode_vertex_version(0)
    mo.encode_index_version(1)
    index, mapping = load()
    res, unknown = resolve(index, mapping)
    if unknown:
        sys.exit('map.json names with no part: ' + ', '.join(f'{c}:{n}' for _, c, n in unknown))
    structures = corpus_layers()
    layers = [l for l in res if not only or l in only]
    with_skin = not only or 'skin' in only
    origin, step = frame(index)
    gen = {l: ids for l, ids in mapping.get('generated', {}).items() if l in layers}
    wanted = {(p['file'], p['i']) for l in layers for parts in res[l].values() for p in parts}
    if any(gen.values()):  # the stand-ins are anchored to meshes of other layers
        wanted |= {(p['file'], p['i']) for l in res for parts in res[l].values() for p in parts}
    if with_skin or set(layers) & outlines.LAYERS:  # the bones the 2D fit uses
        wanted |= {(p['file'], p['i']) for parts in res['skeleton'].values() for p in parts}
    if with_skin:  # the skin's own parts, and the bones its 2D fit uses
        wanted |= {(p['file'], p['i']) for p in skin.skin_parts(index)}
        wanted |= {(p['file'], p['i']) for parts in res['skeleton'].values() for p in parts}
    geo = read_parts(wanted)
    OUT.mkdir(parents=True, exist_ok=True)
    keys_file = OUT / 'keys.json'
    old = json.loads(keys_file.read_text()) if keys_file.exists() else {}
    keys = old.get('layers', {})
    made = set(old.get('generated', []))
    layer_of = {cid: l for l, known in structures.items() for cid in known}
    cache = {}

    def ctx(key):
        """A structure's source vertices (m), for anchoring the stand-ins."""
        l = layer_of[key.split(':')[0]]
        if l not in cache:
            cache[l] = key_meshes(l, res, structures[l], geo)
        return cache[l][key][0]

    def parts(cid, side):
        return [(p['name'], geo[(p['file'], p['i'])][0]) for p in res[layer_of[cid]][cid] if side_of(p) == side]
    skin_regions = old.get('skin', [])
    for layer in layers:
        known = structures[layer]
        meshes = key_meshes(layer, res, known, geo)
        made -= {k for k in made if k.split(':')[0] in known}
        for cid in gen.get(layer, []):
            for sd in (['right', 'left'] if known[cid].get('paired') else [None]):
                key = f'{cid}:{sd}' if sd else cid
                meshes[key] = generated.make(cid, sd, ctx, parts)
                made.add(key)
        total = sum(len(f) for _, f in meshes.values())
        budget = BUDGET.get(layer, 50_000)
        glb = Glb(origin, step)
        tris = 0
        targets = allocate({k: len(f) for k, (_, f) in meshes.items()}, budget)
        final = {}
        for key in sorted(meshes):
            v, f = meshes[key]
            f = simplify(v, f, targets[key])
            v2, f2 = compact(v, f)
            v2, f2 = optimise(v2, f2)
            sex = known[key.split(':')[0]].get('sex')
            # three.js strips ':' from node names, so the key also goes in extras (→ userData)
            glb.add(key, v2, f2, {'key': key, **({'sex': sex} if sex else {}), **({'generated': True} if key in made else {})})
            final[key] = (v2, f2)
            tris += len(f2)
        layer_keys = sorted(meshes)
        if layer == 'skeleton':  # joint markers where the bones meet, named with the joint keys
            groups = {cid for cid, s in known.items() if (s.get('count') or 1) / (2 if s.get('paired') else 1) > 1}
            for jk, (v, f, cls) in sorted(joints.build({k: v for k, (v, _) in final.items()}, groups).items()):
                glb.add(jk, v, f, {'key': jk, 'joint': cls})
                layer_keys.append(jk)
                tris += len(f)
        size = glb.write(OUT / f'{layer}.glb', layer)
        keys[layer] = layer_keys
        if layer in outlines.LAYERS:  # the 2D realistic drawing follows the model (tools/realistic/layers.py)
            bones = {k: bv for k, (bv, _) in key_meshes('skeleton', res, structures['skeleton'], geo).items()}
            by_key = {}
            for cid, ps in res[layer].items():
                paired = known[cid].get('paired')
                for p in ps:
                    v, f = geo[(p['file'], p['i'])]
                    for sd in ([side_of(p)] if side_of(p) else ['right', 'left']) if paired else [None]:
                        piece = (v, f) if not paired or side_of(p) else split_x(v, f, sd == 'right')
                        by_key.setdefault(f'{cid}:{sd}' if sd else cid, []).append(piece)
            outlines.write(layer, final, skin.flat_fit(bones), by_key)
        print(f'{layer}: {len(meshes)} keys, {total:,} → {tris:,} triangles, {size / 1e6:.2f} MB', file=sys.stderr)
    if with_skin:
        skin_regions = build_skin(index, res, structures, geo, origin, step)
    # bounds: the whole body (every source part), in metres, so the app can frame it before any model loads
    lo = np.min([p['min'] for p in index if p['min']], axis=0) * CM
    hi = np.max([p['max'] for p in index if p['max']], axis=0) * CM
    out = {'bounds': [[round(float(x), 3) for x in lo], [round(float(x), 3) for x in hi]],
           'layers': {k: keys[k] for k in sorted(keys)},
           'skin': skin_regions,  # the "Where does it hurt?" areas the skin has
           'generated': sorted(made)}  # stand-ins drawn by generated.py, not from the source
    keys_file.write_text(json.dumps(out, indent=1) + '\n')


if __name__ == '__main__':
    main(set(sys.argv[1:]))
