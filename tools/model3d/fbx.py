"""A minimal reader for binary FBX files (drawing tool only).

Reads just enough of the format to get every mesh out of a Z-Anatomy export:
the node tree, Geometry vertices and polygon indices, Model transforms and the
parent links in Connections. Returns meshes in world space.

FBX binary layout: a 27-byte header, then node records. Each record has an end
offset, a property count, the property list length, a name, the properties and
nested records, closed by an all-zero record. From version 7500 the three
header integers are 64-bit.
"""
import struct
import zlib

import numpy as np

MAGIC = b'Kaydara FBX Binary  \x00'

ARRAY = {b'f': ('<f4', 4), b'd': ('<f8', 8), b'l': ('<i8', 8), b'i': ('<i4', 4), b'b': ('?', 1)}
SCALAR = {b'Y': '<h', b'C': '?', b'I': '<i', b'F': '<f', b'D': '<d', b'L': '<q'}


class Node:
    __slots__ = ('name', 'props', 'children')

    def __init__(self, name, props, children):
        self.name, self.props, self.children = name, props, children

    def find(self, name):
        for c in self.children:
            if c.name == name:
                return c
        return None

    def all(self, name):
        return [c for c in self.children if c.name == name]


def _props(buf, pos, n):
    out = []
    for _ in range(n):
        t = buf[pos:pos + 1]
        pos += 1
        if t in SCALAR:
            fmt = SCALAR[t]
            size = struct.calcsize(fmt)
            out.append(struct.unpack_from(fmt, buf, pos)[0])
            pos += size
        elif t in ARRAY:
            length, enc, clen = struct.unpack_from('<III', buf, pos)
            pos += 12
            raw = buf[pos:pos + clen]
            pos += clen
            if enc == 1:
                raw = zlib.decompress(raw)
            dtype, _ = ARRAY[t]
            out.append(np.frombuffer(raw, dtype=dtype, count=length))
        elif t in (b'S', b'R'):
            (length,) = struct.unpack_from('<I', buf, pos)
            pos += 4
            data = bytes(buf[pos:pos + length])
            pos += length
            out.append(data.decode('utf-8', 'replace') if t == b'S' else data)
        else:
            raise ValueError(f'unknown FBX property type {t!r} at {pos - 1}')
    return out


def _node(buf, pos, wide):
    if wide:
        end, nprops, _plen = struct.unpack_from('<QQQ', buf, pos)
        pos += 24
    else:
        end, nprops, _plen = struct.unpack_from('<III', buf, pos)
        pos += 12
    nlen = buf[pos]
    pos += 1
    if end == 0:
        return None, pos
    name = bytes(buf[pos:pos + nlen]).decode('ascii', 'replace')
    pos += nlen
    props = _props(buf, pos, nprops)
    pos = pos + _plen
    children = []
    while pos < end:
        child, pos = _node(buf, pos, wide)
        if child is None:
            break
        children.append(child)
    return Node(name, props, children), end


def parse(path):
    with open(path, 'rb') as f:
        buf = memoryview(f.read())
    if bytes(buf[:21]) != MAGIC:
        raise ValueError(f'{path}: not a binary FBX file')
    (version,) = struct.unpack_from('<I', buf, 23)
    wide = version >= 7500
    pos = 27
    top = []
    while pos < len(buf):
        node, pos = _node(buf, pos, wide)
        if node is None:
            break
        top.append(node)
    return Node('', [], top)


def _p70(node):
    """Properties70 of a node as {name: values}."""
    out = {}
    p70 = node.find('Properties70')
    if p70:
        for p in p70.all('P'):
            out[p.props[0]] = p.props[4:]
    return out


def _euler(deg, order=0):
    """FBX euler angles (degrees) to a 3×3 matrix. Order 0 is XYZ (X applied first)."""
    x, y, z = np.radians(deg)
    cx, sx, cy, sy, cz, sz = np.cos(x), np.sin(x), np.cos(y), np.sin(y), np.cos(z), np.sin(z)
    rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    mats = {'x': rx, 'y': ry, 'z': rz}
    seq = ['xyz', 'xzy', 'yzx', 'yxz', 'zxy', 'zyx'][order]
    m = np.eye(3)
    for axis in seq:
        m = mats[axis] @ m
    return m


def _mat4(r=None, t=None, s=None):
    m = np.eye(4)
    if r is not None:
        m[:3, :3] = r
    if s is not None:
        m[:3, :3] = m[:3, :3] @ np.diag(s)
    if t is not None:
        m[:3, 3] = t
    return m


def _local(p):
    """A Model's local matrix: T · Roff · Rp · Rpre · R · Rpost⁻¹ · Rp⁻¹ · Soff · Sp · S · Sp⁻¹."""
    v = lambda k, d: np.array(p[k][:3], dtype=float) if k in p else np.array(d, dtype=float)
    order = int(p['RotationOrder'][0]) if 'RotationOrder' in p else 0
    t = v('Lcl Translation', (0, 0, 0))
    r = v('Lcl Rotation', (0, 0, 0))
    s = v('Lcl Scaling', (1, 1, 1))
    pre = v('PreRotation', (0, 0, 0))
    post = v('PostRotation', (0, 0, 0))
    roff = v('RotationOffset', (0, 0, 0))
    rp = v('RotationPivot', (0, 0, 0))
    soff = v('ScalingOffset', (0, 0, 0))
    sp = v('ScalingPivot', (0, 0, 0))
    return (_mat4(t=t) @ _mat4(t=roff) @ _mat4(t=rp) @ _mat4(r=_euler(pre))
            @ _mat4(r=_euler(r, order)) @ np.linalg.inv(_mat4(r=_euler(post)))
            @ _mat4(t=-rp) @ _mat4(t=soff) @ _mat4(t=sp) @ _mat4(s=s) @ _mat4(t=-sp))


def _geometric(p):
    v = lambda k, d: np.array(p[k][:3], dtype=float) if k in p else np.array(d, dtype=float)
    return _mat4(t=v('GeometricTranslation', (0, 0, 0))) @ _mat4(r=_euler(v('GeometricRotation', (0, 0, 0)))) \
        @ _mat4(s=v('GeometricScaling', (1, 1, 1)))


def _triangles(index):
    """PolygonVertexIndex (each polygon's last index stored as ~i) to fan triangles."""
    idx = np.asarray(index, dtype=np.int64)
    ends = np.nonzero(idx < 0)[0]
    idx = np.where(idx < 0, ~idx, idx)
    tris = []
    start = 0
    for end in ends:
        poly = idx[start:end + 1]
        for k in range(1, len(poly) - 1):
            tris.append((poly[0], poly[k], poly[k + 1]))
        start = end + 1
    return np.array(tris, dtype=np.int64).reshape(-1, 3)


def _clean(name):
    return name.split('\x00')[0]


def meshes(path):
    """Yield (model name, parent names, vertices N×3 world, faces M×3) for every mesh."""
    root = parse(path)
    objects = root.find('Objects')
    conns = root.find('Connections')
    geoms, models = {}, {}
    for n in objects.children:
        if n.name == 'Geometry' and len(n.props) > 2 and n.props[2] == 'Mesh':
            geoms[n.props[0]] = n
        elif n.name == 'Model':
            models[n.props[0]] = n
    parent, geom_of = {}, {}
    for c in conns.all('C'):
        if c.props[0] != 'OO':
            continue
        child, par = c.props[1], c.props[2]
        if child in geoms and par in models:
            geom_of.setdefault(par, child)
        elif child in models:
            parent[child] = par
    p70 = {mid: _p70(m) for mid, m in models.items()}
    cache = {}

    def world(mid):
        if mid in cache:
            return cache[mid]
        m = _local(p70[mid])
        par = parent.get(mid)
        if par in models:
            m = world(par) @ m
        cache[mid] = m
        return m

    def chain(mid):
        out = []
        par = parent.get(mid)
        while par in models:
            out.append(_clean(models[par].props[1]))
            par = parent.get(par)
        return out

    for mid, gid in geom_of.items():
        g = geoms[gid]
        vnode, inode = g.find('Vertices'), g.find('PolygonVertexIndex')
        if vnode is None or inode is None:
            continue
        verts = np.asarray(vnode.props[0], dtype=float).reshape(-1, 3)
        faces = _triangles(inode.props[0])
        m = world(mid) @ _geometric(p70[mid])
        verts = verts @ m[:3, :3].T + m[:3, 3]
        yield _clean(models[mid].props[1]), chain(mid), verts, faces
