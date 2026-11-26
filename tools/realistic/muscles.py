"""Realistic muscles, front (anterior) view: each muscle redrawn as anatomy.

Unlike the other soft-tissue layers (layers.py keeps their schematic outlines), every muscle listed in FRONT gets its
own outline, tendons and fibre direction here. The schematic file still supplies the draw order, ids, sides and
classes, so both styles keep the same keys. A builder returns the right-side instance (x < 240) of a paired muscle,
or the whole of a midline one, in the shared front frame; the left side is mirrored about x = 240.

A builder returns a Muscle:
    body     the outline (.b): highlighted, tapped and shaded
    tendons  tendon and aponeurosis areas drawn under the body (.c), so they reach past the belly to the bone
    marks    tendon areas drawn on top of the belly (.c): tendinous intersections, a central tendon
    lines    fibre lines (.d); layers.py adds finer fibres (.fb) between neighbouring ones

Landmarks (from the realistic skeleton): shoulder joint (133, 262), coracoid (143, 246), acromion (113, 222),
elbow (107, 456), wrist (86, 631), ASIS (153, 556), AIIS (158, 575), hip (180, 590), pubic tubercle (226, 618),
patella (190-215, 825-868), knee (199.5, 869.5), ankle (208, 1115.5), temporomandibular joint (200.5, 129.5).
"""
import math

from geometry import LineString, Polygon, blob, curve, ell, fillet, lerp, mirror, soften, tube, unary_union


class Muscle:
    def __init__(self, body, lines=(), tendons=None, marks=None):
        self.body, self.lines, self.tendons, self.marks = body, list(lines), tendons, marks

    def mirrored(self):
        m = lambda g: mirror(g) if g is not None else None
        return Muscle(mirror(self.body), [mirror(l) for l in self.lines], m(self.tendons), m(self.marks))


# ------------------------------------------------------------------ fibre helpers

def along(center, n, spread, taper=False):
    """n fibres parallel to a centreline, spread across +-spread (the body clips them)."""
    c = curve(center)
    out = []
    for i in range(n):
        off = spread * (2 * (i + 0.5) / n - 1)
        if abs(off) < 1e-6:
            out.append(c)
            continue
        o = c.parallel_offset(abs(off), 'left' if off > 0 else 'right', join_style=2)
        if not o.is_empty:
            out.append(o)
    return out


def fan(apex, edge, n, overshoot=1.15):
    """n fibres from an apex (insertion) out to points along an edge (origin), extended a little past it."""
    e = curve(edge) if len(edge) > 2 else LineString(edge)
    out = []
    for i in range(n):
        p = e.interpolate((i + 0.5) / n, normalized=True)
        q = lerp(apex, (p.x, p.y), overshoot)
        out.append(LineString([apex, q]))
    return out


def across(a, b, n):
    """n fibres from points along line a to the matching points along line b (sheets, pennate muscles)."""
    la = curve(a) if len(a) > 2 else LineString(a)
    lb = curve(b) if len(b) > 2 else LineString(b)
    out = []
    for i in range(n):
        t = (i + 0.5) / n
        p, q = la.interpolate(t, normalized=True), lb.interpolate(t, normalized=True)
        out.append(LineString([(p.x, p.y), (q.x, q.y)]))
    return out


def rings(cx, cy, rx, ry, n, r0=0.45):
    out = []
    for i in range(n):
        f = r0 + (1 - r0) * (i + 0.5) / n
        out.append(ell(cx, cy, rx * f, ry * f).exterior)
    return out


def belly(center, widths, r=None):
    """A muscle belly along a centreline: a tube with its square ends rounded off."""
    if r is None:
        r = 0.42 * min(widths[0], widths[-1])
    return soften(tube(center, widths), max(r, 0.5))


def U(*gs):
    return unary_union([g for g in gs if g is not None])


# ================================================================== head

def temporalis():
    body = blob([(194, 60), (201, 57), (206, 66), (206, 86), (205, 104), (207, 122), (205, 133), (201, 134),
                 (198, 124), (193, 104), (190.5, 84), (191, 68)], 10)
    return Muscle(body, fan((204, 132), [(191, 70), (197, 58), (205, 64), (206, 100)], 9))


def masseter():
    body = blob([(197.5, 124.5), (205, 123.8), (212, 126.5), (214, 138), (214, 152), (211.5, 164), (206.5, 169.5),
                 (201.5, 167), (199, 155), (197.5, 140)], 10)
    lines = across([(198, 125), (213, 127)], [(201, 166), (212.5, 161)], 9)
    lines.append(LineString([(206, 127), (209.5, 150)]))   # superficial | deep part
    return Muscle(body, lines)


def occipitofrontalis():
    body = blob([(238.5, 54), (238.5, 76), (237.5, 92), (231, 95.5), (221, 95), (211, 92), (205, 85), (203.5, 72),
                 (206, 60), (214, 54.5), (227, 52.5)], 10)
    galea = blob([(239.5, 26), (239.5, 58), (226, 55), (212, 57), (204, 63), (199, 52), (205, 36), (220, 27)], 10)
    lines = across([(206, 62), (214, 55), (227, 53.5), (238, 55)], [(205.5, 86), (213, 92.5), (226, 95), (237, 92)], 12)
    return Muscle(body, lines, tendons=galea.difference(body.buffer(-0.6)))


def orbicularis_oculi():
    cx, cy = 219, 111.5
    outer = blob([(203.5, 110), (206, 101), (213, 96.5), (222, 96), (230.5, 99.5), (235, 106), (235, 115),
                  (231.5, 122.5), (223, 126.5), (213, 126), (206.5, 121)], 10)
    eye = ell(cx, cy + 1.2, 8.6, 3.6)
    return Muscle(outer.difference(eye), rings(cx, cy + 0.5, 15.5, 14, 6, 0.62))


def orbicularis_oris():
    cx, cy = 240, 160.5
    outer = blob([(222.5, 160), (226, 153), (233, 150), (240, 149.5), (247, 150), (254, 153), (257.5, 160),
                  (254, 167), (247, 170.5), (240, 171), (233, 170.5), (226, 167)], 10)
    mouth = blob([(230.5, 160.6), (235, 159.2), (240, 159.6), (245, 159.2), (249.5, 160.6), (245, 162), (240, 162.3),
                  (235, 162)], 6)
    return Muscle(outer.difference(mouth), rings(cx, cy, 17, 10.5, 6, 0.5))


def buccinator():
    body = blob([(208.5, 147), (215, 142.5), (223.5, 147), (226, 153.5), (222, 159.5), (213, 160), (208, 155)], 8)
    return Muscle(body, across([(207, 145), (207, 159)], [(226, 149), (225, 158)], 6))


# ================================================================== neck

def sternocleidomastoid():
    main = tube([(197.5, 131), (202, 150), (209, 175), (216, 200), (222, 220)], [8.5, 10.5, 11, 10, 8])
    sternal = tube([(220, 214), (227, 229), (232.5, 242)], [6.5, 4.5, 3.2])
    clav = tube([(214, 214), (215, 228), (214.5, 240)], [7.5, 8, 8.5])
    body = fillet(U(main, sternal, clav), 1.2)
    fossa = blob([(220.5, 226), (223.5, 236), (222, 241), (219.5, 236)], 6)   # between the two heads
    body = body.difference(fossa)
    tendon = tube([(229.5, 236), (234, 245)], [2.6, 2.2])
    lines = along([(197.5, 131), (202, 150), (209, 175), (216, 200), (220, 214), (222, 226)], 6, 4.4)
    return Muscle(body, lines, tendons=tendon)


def suprahyoid():
    body = blob([(239.3, 172.5), (239.3, 187.5), (232, 188.5), (225, 186.5), (217, 181), (213, 174), (220, 172.2),
                 (230, 172.5)], 8)
    dig = tube([(236.5, 174), (231, 181), (225, 186)], [3.4, 3.0, 2.2])
    lines = across([(214, 174), (238.5, 173.5)], [(224, 186), (238.5, 187)], 7) + along([(236.5, 174), (231, 181), (225, 186)], 2, 1)
    return Muscle(U(body, dig), lines)


def infrahyoid():
    sterno = tube([(235.5, 189), (234.5, 210), (233, 230), (234, 241)], [6.0, 6.6, 6.8, 6.0])
    thyro = tube([(229, 196), (227.5, 212), (228.5, 224)], [4.0, 4.6, 4.0])
    omo = tube([(231, 191), (224, 203), (213, 216), (198, 227), (184, 233)], [3.6, 3.4, 2.6, 3.2, 3.6])
    body = fillet(U(sterno, thyro, omo), 0.6)
    tendon = tube([(219.5, 209), (213, 216)], [1.8, 1.8])   # the omohyoid's intermediate tendon
    lines = (along([(235.5, 189), (234.5, 210), (233, 230), (234, 241)], 3, 2.4)
             + along([(229, 196), (227.5, 212), (228.5, 224)], 2, 1.4)
             + along([(231, 191), (224, 203), (213, 216), (198, 227), (184, 233)], 2, 1.1))
    return Muscle(body, lines, marks=tendon)


def scalenes():
    body = blob([(222, 160), (225, 172), (224.5, 192), (221, 212), (214.5, 230), (207.5, 240), (202.5, 239),
                 (205.5, 225), (210, 205), (215.5, 182), (219, 166)], 10)
    lines = across([(219.5, 163), (224.5, 180), (223, 205)], [(203.5, 238), (208.5, 236), (215, 228)], 7)
    return Muscle(body, lines)


def platysma():
    body = blob([(203.5, 157), (212, 166), (222, 172), (229, 177), (231.5, 190), (229, 215), (225, 240), (221, 258),
                 (200, 262), (176, 258), (158, 250), (163, 236), (178, 214), (193, 186)], 10)
    return Muscle(body, [LineString([(204 + i * 2.6, 162 + i * 1.6), (160 + i * 6.2, 252 + i * 0.9)]) for i in range(10)])


# ================================================================== shoulder and chest

def trapezius():
    top = [(219.5, 163), (213, 177), (196, 191), (171, 203), (146, 211.5), (125, 216), (113, 221)]
    low = [(117, 225), (134, 223), (159, 216), (184, 205), (205, 191), (219, 177)]
    body = blob(top + low, 10)
    lines = across(top[:-1], low[::-1][:-1], 12)
    return Muscle(body, lines)


def deltoid():
    body = blob([(151, 233), (140, 226.5), (126, 222.5), (113, 222), (103, 228), (96.5, 242), (94.5, 262),
                 (97, 284), (103, 304), (110.5, 321), (115, 319), (118, 300), (124, 279), (133, 258), (143, 242)], 10)
    lines = fan((112, 318), [(150, 232), (128, 224), (109, 226), (99, 242), (96, 262)], 12, 1.08)
    lines += [LineString([(112, 318), (118, 268), (124, 226)]), LineString([(112, 318), (102, 270), (101, 236)])]
    return Muscle(body, lines)


def pectoralis_major():
    body = blob([(223.5, 243.5), (229.5, 262), (230.5, 300), (229.5, 334), (224, 352), (208, 357.5), (188, 354),
                 (168, 344), (150, 328), (135, 311), (124, 301), (121, 286), (125, 274), (135, 262), (148, 247),
                 (161, 238.5), (185, 239.5), (206, 241)], 10)
    tendon = tube([(126, 271), (121.5, 286), (122.5, 300)], [5, 6, 4])
    lines = across([(122, 298), (123, 287), (126, 274)], [(160, 239), (200, 240.5), (224, 246)], 7)
    lines += across([(127, 271), (123.5, 284), (122, 298)],
                    [(229, 256), (230.5, 300), (228, 336), (212, 357), (188, 353), (160, 336)], 13)
    # the groove between the clavicular and sternocostal heads
    lines.append(LineString([(128, 275), (175, 251), (226, 250)]))
    return Muscle(body, lines, tendons=tendon)


def pectoralis_minor():
    body = blob([(142, 244.5), (148, 243.5), (165, 263), (184, 289), (187, 312), (180, 334), (170, 336),
                 (163, 312), (153, 280), (142.5, 254)], 10)
    lines = fan((144.5, 247), [(186, 292), (186, 314), (178, 334), (168, 334)], 7, 1.05)
    return Muscle(body, lines)


def subclavius():
    body = soften(tube([(213.5, 242), (200, 239.2), (185, 237), (169, 234.6)], [3.0, 4.4, 4.0, 2.4]), 1.0)
    return Muscle(body, along([(213.5, 242), (200, 239.2), (185, 237), (169, 234.6)], 3, 2.6))


def serratus_anterior():
    slips, lines = [], []
    for i in range(6):
        y0 = 296 + i * 17.5
        a, b = (137.5 + i * 0.6, y0), (158 + i * 3.2, y0 + 15 + i * 1.2)
        slips.append(belly([a, lerp(a, b, 0.55), b], [17 - i * 0.6, 14.5 - i * 0.6, 7 - i * 0.4], 2.8))
        lines += along([a, lerp(a, b, 0.55), b], 3, 3.2)
    back = soften(tube([(137, 292), (140.5, 340), (144, 392)], [6, 7, 6]), 1.5)
    body = fillet(U(*slips, back), 1.2)
    return Muscle(body, lines)


def latissimus_dorsi():
    body = blob([(129, 285), (137, 298), (142, 330), (146, 370), (147.5, 412), (141, 413), (134, 380),
                 (126.5, 335), (121.5, 302), (123, 288)], 10)
    lines = across([(124, 290), (147, 412)], [(129, 286), (141, 412)], 5) + along([(127, 290), (134, 340), (143, 410)], 4, 3.5)
    return Muscle(body, lines)


def external_oblique():
    body = blob([(160, 336), (177, 345), (192, 360), (199.5, 380), (202, 410), (202, 445), (199, 480), (191, 510),
                 (178, 534), (162, 557), (153, 555), (150, 525), (148.5, 480), (148, 430), (150, 385), (154, 352)], 10)
    teeth = [soften(tube([(151 + i * 0.4, 344 + i * 17.5), (163 + i * 2, 352 + i * 18)], [8, 7]), 2.5) for i in range(5)]
    body = fillet(U(body, *teeth), 1.5)
    apo = Polygon([(194, 358), (209, 346), (234, 346), (236, 606), (225.5, 619), (215, 615), (190, 592), (157, 562),
                   (176, 538), (198, 486)]).buffer(0)
    apo = soften(apo, 0.8).difference(body)
    lines = across([(150, 345), (152, 420), (150, 500)], [(186, 380), (200, 440), (172, 540)], 13)
    return Muscle(body, lines, tendons=apo)


def rectus_abdominis():
    body = blob([(238.6, 346), (226, 345), (213, 349), (207.5, 361), (207, 395), (208.5, 440), (212, 490),
                 (218, 540), (225, 578), (229, 600), (233, 606.5), (238.8, 607)], 10)
    marks = None
    for y, dy in ((377, 1.5), (414, 1.4), (452, 1.4)):
        band = Polygon(curve([(200, y + 1), (215, y - 0.6), (230, y + 0.8), (245, y)]).buffer(dy / 2).exterior)
        marks = U(marks, band.intersection(body.buffer(-0.5)))
    lines = along([(223, 346), (224, 420), (228, 520), (235, 606)], 6, 11)
    return Muscle(body, lines, marks=marks)


def diaphragm():
    return None   # the schematic dome is kept (it lies behind the ribs and organs)


# ================================================================== hip and thigh

def iliopsoas():
    psoas = tube([(226.5, 426), (223, 470), (216, 520), (207, 570), (200, 608), (203.5, 634)], [6, 10, 14, 15, 11, 5])
    iliacus = blob([(164, 512), (178, 503), (196, 506), (206, 524), (207, 560), (201, 600), (190, 596), (176, 576),
                    (167, 552), (162, 532)], 10)
    body = fillet(U(psoas, iliacus), 1.0)
    lines = along([(226.5, 426), (223, 470), (216, 520), (207, 570), (200, 608), (203, 632)], 4, 5.5)
    lines += fan((201, 612), [(166, 520), (180, 505), (198, 508)], 6, 1.05)
    return Muscle(body, lines)


def obturator_externus():
    body = blob([(196.5, 603.5), (208, 602), (218.5, 607), (219, 621), (212, 632), (200, 630), (190, 619), (180, 611),
                 (171, 607.5), (172, 604), (184, 604)], 10)
    return Muscle(body, [LineString([(172, 605.5), (198 + i * 4.2, 603 + i * 6.2)]) for i in range(6)])


def gluteus_medius():
    body = blob([(150, 506), (160, 503), (166, 520), (164, 545), (157, 572), (151, 598), (143.5, 600), (140, 575),
                 (141, 540), (144, 518)], 10)
    return Muscle(body, fan((147, 598), [(146, 512), (156, 503), (165, 518), (163, 546)], 7, 1.06))


def tensor_fasciae_latae():
    body = blob([(151.5, 553), (157.5, 556.5), (159, 580), (156.5, 612), (151, 640), (146, 649), (142, 638),
                 (142.5, 600), (145.5, 570)], 10)
    band = tube([(146.5, 636), (146.5, 700), (153, 780), (166, 850), (181, 892)], [7, 7, 6.5, 6, 4.5])  # iliotibial tract
    lines = along([(153, 556), (152, 590), (148, 625), (146, 645)], 4, 4.5)
    return Muscle(body, lines, tendons=band)


def sartorius():
    c = [(153.5, 558), (162, 610), (178, 680), (196, 750), (209, 810), (214, 850), (211, 880), (204, 904)]
    body = belly(c[:-1], [5.5, 8, 8.5, 8.5, 8, 7, 4.5])
    tendon = tube([(212, 868), (209, 888), (203, 905)], [3.4, 3, 2.6])
    return Muscle(body, along(c[:-1], 3, 2.7), tendons=tendon)


def adductors():
    body = blob([(214, 604), (226, 608), (232.5, 618), (234, 660), (232, 710), (228, 760), (222, 806), (218.5, 836),
                 (213, 834), (210, 790), (203, 735), (193, 672), (185, 628), (188, 608), (200, 603)], 10)
    lines = fan((217, 832), [(232, 640), (232, 700), (228, 760)], 4, 1.0)
    lines += across([(188, 612), (205, 604), (226, 609)], [(196, 690), (210, 760), (218, 820)], 9)
    lines.append(LineString([(205, 606), (212, 700), (216, 790)]))   # adductor longus | gracilis
    return Muscle(body, lines)


def vastus_lateralis():
    body = blob([(149, 618), (159, 616), (167, 645), (175, 700), (183, 760), (190, 806), (193.5, 826), (186, 834),
                 (176, 826), (164, 796), (153, 750), (145, 695), (141, 650), (143, 628)], 10)
    tendon = tube([(188, 818), (192, 832)], [6, 5])
    lines = across([(146, 640), (149, 720), (162, 790)], [(165, 655), (178, 735), (191, 818)], 12)
    return Muscle(body, lines, tendons=tendon)


def vastus_medialis():
    body = blob([(189, 700), (197, 718), (207, 755), (216, 790), (219.5, 815), (215, 834), (205, 838), (198, 826),
                 (194, 795), (189, 755), (186, 722)], 10)
    lines = across([(188, 710), (197, 760), (210, 805)], [(186, 730), (193, 790), (199, 826)], 4)
    lines += fan((199, 830), [(204, 760), (214, 790), (219, 812), (214, 832)], 7, 1.05)
    return Muscle(body, lines)


def rectus_femoris():
    c = [(159, 576), (165, 615), (172, 670), (181, 730), (190, 780), (196, 808)]
    body = belly(c, [5, 13, 18, 17, 10, 5])
    tendon = U(tube([(158, 572), (161, 590)], [4, 4.5]), tube([(192, 790), (197, 812), (200, 828)], [9, 8, 7]))
    raphe = LineString([(162, 595), (171, 660), (181, 725), (190, 778)])
    left = [LineString([(p[0] - 9, p[1] + 14), p]) for p in [raphe.interpolate(t, normalized=True).coords[0] for t in
                                                              [0.12 + 0.08 * i for i in range(11)]]]
    right = [LineString([p, (p[0] + 9, p[1] + 10)]) for p in [raphe.interpolate(t, normalized=True).coords[0] for t in
                                                             [0.12 + 0.08 * i for i in range(11)]]]
    return Muscle(body, [raphe] + left + right, tendons=tendon)


# ================================================================== lower leg and foot

def tibialis_anterior():
    c = [(190, 902), (186.5, 940), (187, 985), (191, 1030), (197, 1060)]
    body = belly([(189, 906)] + c[1:], [5, 11, 10, 7, 3.5], 2.2)
    tendon = tube([(193, 1035), (199, 1070), (206, 1105), (212, 1128), (215, 1142)], [3.4, 3.2, 3, 2.8, 2.6])
    return Muscle(body, along(c, 4, 3.6), tendons=tendon)


def toe_extensors():
    c = [(180, 904), (184, 940), (186.5, 990), (189, 1035), (192, 1066)]
    body = belly([(180.5, 908)] + c[1:], [4, 8, 7.5, 6, 3], 1.8)
    toes = [(226, 1180), (215, 1182), (206, 1185), (197, 1185), (188, 1178)]
    tendon = None
    for i, t in enumerate(toes):
        start = (198, 1055) if i == 0 else (191, 1060)
        mid = lerp(start, t, 0.5)
        tendon = U(tendon, tube([start, (mid[0] - 1 + i * 0.6, mid[1]), t], [1.7, 1.3, 1.0]))
    return Muscle(body, along(c, 3, 2.6), tendons=tendon)


def fibularis():
    body = blob([(170, 901), (177, 905), (180, 950), (179.5, 1010), (177, 1060), (174, 1072), (170, 1062),
                 (167.5, 1010), (166.5, 955)], 10)
    tendon = tube([(174, 1050), (176, 1090), (180, 1118), (186, 1136)], [3, 2.8, 2.6, 2.4])
    return Muscle(body, across([(167, 915), (168, 1060)], [(178, 930), (176, 1066)], 8), tendons=tendon)


def gastrocnemius():
    body = blob([(217.5, 905), (225.5, 913), (231, 945), (230.5, 985), (224, 1012), (218.5, 1000), (216, 960),
                 (215.5, 925)], 10)
    return Muscle(body, along([(219, 908), (224, 950), (222, 1008)], 4, 4.5))


def soleus():
    body = blob([(216, 986), (223, 990), (226, 1020), (224.5, 1060), (220, 1082), (216, 1070), (214.5, 1030)], 10)
    return Muscle(body, across([(215, 995), (216, 1070)], [(225, 1000), (221, 1080)], 6))


def extensor_digitorum_brevis():
    body = blob([(181.5, 1118), (190, 1117), (199, 1124), (207, 1137), (205.5, 1143.5), (194, 1141), (184, 1133)], 8)
    return Muscle(body, fan((183, 1121), [(205, 1138), (200, 1143), (192, 1142)], 5, 1.04))


def foot_interossei():
    parts, lines = [], []
    for x0, x1 in ((219.5, 221), (210.5, 211.5), (201.5, 202), (192.5, 192.5)):
        c = [(x0 - 3, 1149.5), (x1, 1166.5)]
        parts.append(soften(tube(c, [3.6, 2.6]), 0.6))
        lines += along(c, 2, 0.9)
    return Muscle(U(*parts), lines)


# ================================================================== arm

def biceps():
    c = [(121, 292), (117.5, 330), (115, 370), (111.5, 405), (108, 430)]
    belly = tube(c, [13, 19, 19.5, 14, 6])
    short = tube([(142.5, 250), (134, 275), (124, 300)], [5.5, 7, 9])
    body = soften(U(belly, short), 1.0)
    tendon = U(tube([(129, 262), (125, 280), (121.5, 298)], [3.2, 3.2, 3.6]),     # long head, in its groove
               tube([(109, 425), (106, 448), (103.5, 466)], [3.6, 3.0, 2.6]))
    lines = along(c, 6, 8.2) + along([(142.5, 250), (134, 275), (124, 300)], 2, 2.5)
    return Muscle(body, lines, tendons=tendon)


def brachialis():
    body = blob([(101, 345), (109, 338), (120, 343), (126, 365), (126.5, 400), (121, 435), (112, 465), (104.5, 470),
                 (100, 450), (97.5, 410), (98, 370)], 10)
    return Muscle(body, across([(100, 350), (98, 410), (101, 450)], [(119, 345), (125, 400), (113, 460)], 9))


def coracobrachialis():
    c = [(143, 248), (136, 280), (129, 315), (124.5, 348)]
    body = belly(c, [5, 7, 6.5, 3.5])
    return Muscle(body, along(c, 3, 2))


def triceps():
    body = blob([(126.5, 292), (133.5, 306), (135.5, 345), (134, 390), (129, 425), (122, 445), (118.5, 438),
                 (121.5, 400), (123, 350), (122.5, 305)], 10)
    return Muscle(body, across([(124, 300), (121, 440)], [(134, 320), (130, 425)], 9))


def brachioradialis():
    c = [(98.5, 398), (95, 440), (90, 485), (85, 530), (80.5, 570)]
    body = belly([(99, 394)] + c[1:], [4, 13.5, 12.5, 9, 4], 1.8)
    tendon = tube([(82, 560), (78.5, 600), (76.5, 628)], [3.6, 3.2, 3])
    return Muscle(body, along(c, 4, 4.5), tendons=tendon)


def forearm_extensors():
    body = blob([(89, 438), (95, 446), (91, 480), (84, 525), (77, 570), (72, 605), (68.5, 614), (67.5, 595),
                 (71, 555), (78, 505), (84, 465)], 10)
    tendon = U(tube([(70.5, 600), (67.5, 640), (66.5, 660)], [2.4, 2.2, 2]), tube([(74, 598), (73, 640)], [2.2, 2]))
    return Muscle(body, along([(91, 442), (86, 480), (79, 540), (72, 600)], 3, 3.5), tendons=tendon)


def forearm_flexors():
    body = blob([(121, 447), (130, 453), (130, 475), (124, 510), (116, 548), (107, 580), (99, 604), (91, 606),
                 (89, 585), (93, 545), (99, 505), (106, 472), (113, 454)], 10)
    tendon = None
    for x0, x1 in ((92, 90), (96, 93.5), (100, 97), (104, 100.5), (107.5, 104)):
        tendon = U(tendon, tube([(x0, 588), ((x0 + x1) / 2, 615), (x1, 640)], [2.0, 1.7, 1.5]))
    lines = fan((96, 600), [(113, 456), (122, 450), (130, 462), (127, 490)], 9, 1.04)
    # pronator teres | flexor carpi radialis | palmaris longus | flexor carpi ulnaris
    lines += [curve([(129, 457), (116, 485), (101, 512)]), curve([(121, 452), (109, 530), (96, 600)]),
              curve([(127, 462), (116, 540), (102, 604)])]
    return Muscle(body, lines, tendons=tendon)


def thenar():
    body = blob([(61, 652.5), (70, 648.5), (78, 653), (80, 666), (78, 680), (71.5, 690), (63.5, 685), (58, 671)], 10)
    return Muscle(body, across([(61, 655), (64, 684)], [(78, 657), (77, 680)], 6))


def hypothenar():
    body = blob([(98, 651), (104.5, 649), (109.5, 660), (109.5, 678), (106, 692), (100, 692), (97, 676), (96.5, 660)], 10)
    return Muscle(body, along([(102, 650), (103, 670), (103, 692)], 3, 3.2))


def hand_lumbricals():
    parts, lines = [], []
    for x0 in (77, 85.5, 93, 99.5):
        c = [(x0, 668), (x0 - 1.5, 684), (x0 - 3.5, 702)]
        parts.append(soften(tube(c, [3.2, 3.4, 2.2]), 0.5))
        lines += along(c, 2, 0.9)
    return Muscle(U(*parts), lines)


FRONT = {
    'temporalis': temporalis, 'masseter': masseter, 'occipitofrontalis': occipitofrontalis,
    'orbicularis-oculi': orbicularis_oculi, 'orbicularis-oris': orbicularis_oris, 'buccinator': buccinator,
    'sternocleidomastoid': sternocleidomastoid, 'suprahyoid': suprahyoid, 'infrahyoid': infrahyoid,
    'scalenes': scalenes, 'platysma': platysma, 'trapezius': trapezius, 'deltoid': deltoid,
    'pectoralis-major': pectoralis_major, 'pectoralis-minor': pectoralis_minor, 'subclavius': subclavius,
    'serratus-anterior': serratus_anterior, 'latissimus-dorsi': latissimus_dorsi,
    'external-oblique': external_oblique, 'rectus-abdominis': rectus_abdominis, 'iliopsoas': iliopsoas,
    'obturator-externus': obturator_externus, 'gluteus-medius': gluteus_medius,
    'tensor-fasciae-latae': tensor_fasciae_latae, 'sartorius': sartorius, 'adductors': adductors,
    'vastus-lateralis': vastus_lateralis, 'vastus-medialis': vastus_medialis, 'rectus-femoris': rectus_femoris,
    'tibialis-anterior': tibialis_anterior, 'toe-extensors': toe_extensors, 'fibularis': fibularis,
    'gastrocnemius': gastrocnemius, 'soleus': soleus, 'extensor-digitorum-brevis': extensor_digitorum_brevis,
    'foot-interossei': foot_interossei, 'biceps': biceps, 'brachialis': brachialis,
    'coracobrachialis': coracobrachialis, 'triceps': triceps, 'brachioradialis': brachioradialis,
    'forearm-extensors': forearm_extensors, 'forearm-flexors': forearm_flexors, 'thenar': thenar,
    'hypothenar': hypothenar, 'hand-lumbricals': hand_lumbricals,
}
MIDLINE = {'orbicularis-oris'}

_cache = {}


def muscle(id_, side):
    """The Muscle for one schematic group, or None to keep the schematic drawing."""
    if id_ not in FRONT:
        return None
    if id_ not in _cache:
        _cache[id_] = FRONT[id_]()
    m = _cache[id_]
    if m is None or id_ in MIDLINE or side != 'left':
        return m
    return m.mirrored()
