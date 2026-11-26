"""List every mesh in the Z-Anatomy FBX files (drawing tool only).

Writes source/index.json: [{file, i, name, chain, tris, min, max}] (i: the mesh's
position in its file, as fbx.meshes() yields them) so map.json can
be written and checked without re-reading the FBX files.
Run: ~/.venvs/corpus/bin/python -I tools/model3d/index_source.py
"""
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import fbx  # noqa: E402

SRC = pathlib.Path(__file__).parent / 'source' / 'zanatomy'
out = []
for path in sorted(SRC.glob('*.fbx')):
    for i, (name, chain, v, f) in enumerate(fbx.meshes(path)):
        out.append({'file': path.stem, 'i': i, 'name': name, 'chain': chain, 'tris': int(len(f)),
                    'min': [round(x, 2) for x in v.min(0).tolist()] if len(v) else None,
                    'max': [round(x, 2) for x in v.max(0).tolist()] if len(v) else None})
    print(path.stem, sum(1 for o in out if o['file'] == path.stem), file=sys.stderr)
(SRC.parent / 'index.json').write_text(json.dumps(out, indent=0))
print(len(out), 'meshes,', sum(o['tris'] for o in out), 'triangles', file=sys.stderr)
