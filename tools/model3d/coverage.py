"""3D coverage report: which Corpus structures have a mesh (drawing tool only).

Run: ~/.venvs/corpus/bin/python -I tools/model3d/coverage.py
Prints, per layer, the structures mapped / missing and the source triangle
counts, then an estimated download size per layer at the build budgets.
"""
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from resolve import ROOT, load, resolve, side_of  # noqa: E402

# Triangle budget per layer after decimation (build.py uses the same numbers).
BUDGET = {'skeleton': 320_000, 'muscles': 320_000, 'organs': 140_000, 'vessels': 90_000,
          'nerves': 70_000, 'ligaments': 16_000, 'lymphatics': 24_000}
# Indexed mesh ≈ 0.5 vertices per triangle; meshopt + quantised attributes + gzip
# lands at roughly 5–7 bytes per triangle for anatomy meshes.
BYTES_PER_TRI = (5, 7)


def main():
    index, mapping = load()
    res, unknown = resolve(index, mapping)
    manifest = json.loads((ROOT / 'data' / 'manifest.json').read_text())
    missing = mapping['missing']
    total_ids = total_mapped = 0
    rows = []
    for layer in manifest['layers']:
        lid = layer['id']
        data = json.loads((ROOT / layer['data']).read_text())
        mapped = res.get(lid, {})
        have, lack, onesided, sex = [], [], [], {}
        tris = 0
        for s in data['structures']:
            cid = s['id']
            if s.get('sex'):
                sex.setdefault(cid, set()).add(s['sex'])
            if cid in {h for h in have} | {l for l, _ in lack}:
                continue
            parts = mapped.get(cid) or []
            if not parts:
                lack.append((cid, missing.get(cid, 'NOT MAPPED')))
                continue
            have.append(cid)
            tris += sum(p['tris'] for p in parts)
            if s.get('paired'):
                sides = {side_of(p) for p in parts}
                if None not in sides and sides != {'right', 'left'}:
                    onesided.append(f"{cid} ({'/'.join(sorted(sides))})")
        n = len(have) + len(lack)
        total_ids += n
        total_mapped += len(have)
        budget = BUDGET.get(lid, 0)
        lo, hi = (budget * b / 1e6 for b in BYTES_PER_TRI)
        rows.append((lid, len(have), n, tris, budget, lo, hi))
        print(f'\n## {lid}: {len(have)} of {n} structures have a mesh ({tris:,} source triangles)')
        for cid, why in lack:
            print(f'   – {cid}: {why}')
        for o in onesided:
            print(f'   ! one side only: {o}')
    if unknown:
        print('\n## map.json names with no part in the source')
        for layer, cid, n in unknown:
            print(f'   ? {layer}/{cid}: {n!r}')
    print(f'\n## total: {total_mapped} of {total_ids} structures ({100 * total_mapped / total_ids:.0f}%)')
    print('\nlayer        mapped   source tris   budget   est. download')
    for lid, h, n, t, b, lo, hi in rows:
        print(f'{lid:<12} {h:>3}/{n:<3} {t:>12,} {b:>9,}   {lo:.1f}–{hi:.1f} MB')
    skin = 60_000
    print(f"{'skin':<12} {'':>7} {'':>12} {skin:>9,}   {skin * 5 / 1e6:.1f}–{skin * 7 / 1e6:.1f} MB")
    tb = sum(r[4] for r in rows) + skin
    print(f"{'all':<12} {'':>7} {'':>12} {tb:>9,}   {tb * 5 / 1e6:.1f}–{tb * 7 / 1e6:.1f} MB")


if __name__ == '__main__':
    main()
