"""Realistic muscles, back (posterior) view: each muscle redrawn as anatomy.

The same contract as the front builders in muscles.py: the schematic file supplies the draw order, ids, sides and
classes, and a builder returns the right-side instance (x < 240) in the shared front frame (posterior files use it
too; the app mirrors the back view). The left side is mirrored about x = 240.

Landmarks (from the realistic back skeleton): spinous processes on x = 240; spine of the scapula from the acromion
(113, 222) to its root on the medial border (196, 250); medial border x ~ 197 from the superior angle (197, 238) to
the inferior angle (180, 350); glenoid and humeral head (124, 258); olecranon (107, 455); wrist (86, 631); 12th rib
tip (190, 420); iliac crest (150-205, 498-520); sacrum (205-238, 545-595); greater trochanter (150, 600); ischial
tuberosity (198, 630); femoral condyles (178-222, 830-870); knee (199.5, 869.5); fibular head (172, 895);
medial malleolus (224, 1112); calcaneus (196-214, 1120-1140).
"""
from shapely.geometry import box

from geometry import LineString, Polygon, blob, curve, fillet, soften, tube
from muscles import Muscle, U, across, along, belly, fan


def half(g, edge=238.6):
    """Clipped at the midline, so a muscle that reaches the spinous processes doesn't overlap its other side."""
    return g.intersection(box(0, 0, edge, 1200))


# ================================================================== head and neck

def occipitofrontalis():
    body = blob([(238.5, 98.5), (230, 96.5), (220, 97), (211, 100.5), (207, 106), (208, 113), (214, 118.5),
                 (225, 120.5), (235, 120), (238.5, 116)], 10)
    body = half(body)
    galea = half(blob([(239.5, 30), (239.5, 101), (228, 98), (214, 99.5), (205, 103), (199.5, 92), (198.5, 72),
                       (203, 52), (217, 37)], 10), 239.5)
    lines = across([(209, 113), (222, 119.5), (237, 119.5)], [(211, 101.5), (222, 97.5), (237, 98)], 9)
    return Muscle(body, lines, tendons=galea.difference(body.buffer(-0.6)))


def sternocleidomastoid():
    c = [(201, 128), (202, 150), (204.5, 172), (206.5, 192)]
    body = belly(c, [10, 12, 9, 5], 2.4)
    return Muscle(body, along(c, 4, 4))


def splenius():
    body = blob([(206, 135), (213.5, 135.5), (223, 149), (232, 168), (237.5, 190), (238.5, 215), (238.5, 250),
                 (233, 249), (228, 236), (220, 206), (212, 176), (206, 156), (203, 142)], 10)
    body = half(body)
    lines = across([(237, 170), (238, 210), (238, 248)], [(206, 140), (214, 176), (227, 234)], 9)
    lines.append(curve([(211, 137), (218, 165), (227, 196), (234, 222)]))   # capitis | cervicis
    return Muscle(body, lines)


def levator_scapulae():
    slips = [soften(tube([(221, y), (215.5, y + 16)], [4, 4.6]), 1.2) for y in (142, 155, 168, 181)]
    c = [(216, 160), (212, 185), (206, 210), (200.5, 230), (198, 237)]
    body = fillet(U(belly(c, [8, 9, 8, 6, 4], 1.8), *slips), 1.0)
    return Muscle(body, along([(219, 146)] + c, 4, 3.2))


# ================================================================== back and shoulder

def trapezius():
    body = blob([(238.5, 112), (228, 114), (218, 120), (213, 132), (211, 155), (209, 180), (203, 194), (190, 206),
                 (172, 214), (150, 221), (130, 227), (118, 230.5), (122, 236), (136, 240), (160, 245), (184, 250),
                 (196, 256), (205, 282), (215, 320), (225, 360), (233, 395), (238.5, 420)], 10)
    body = half(body)
    nuchal = Polygon([(238.6, 184), (231.5, 200), (229.5, 220), (231, 238), (238.6, 252)]).buffer(0)
    spine = blob([(189, 249.5), (197, 251.5), (203, 262), (198.5, 263.5), (192, 256)], 6)   # over the spine's root
    marks = soften(nuchal, 1.2).union(spine)
    lines = across([(238, 116), (238, 198)], [(180, 212), (124, 231)], 10)               # descending
    lines += across([(238, 204), (238, 262)], [(123, 234), (193, 252)], 8)               # transverse
    lines += fan((196, 256), [(238, 268), (236, 340), (238, 418)], 9, 1.0)               # ascending
    return Muscle(body, lines, marks=marks)


def rhomboids():
    body = blob([(238.5, 206), (238.5, 304), (229, 315), (213, 333), (200, 346), (196.5, 320), (196, 280),
                 (196.5, 241), (210, 229), (226, 216)], 10)
    body = half(body)
    lines = across([(238, 209), (238, 302)], [(197, 241), (199.5, 343)], 11)
    lines.append(LineString([(238.6, 231), (196.5, 258)]))   # minor | major
    return Muscle(body, lines)


def erector_spinae():
    body = blob([(232, 138.5), (236.5, 145), (237.8, 180), (238, 300), (238.3, 450), (238.5, 560), (238, 596),
                 (231, 598), (219, 586), (211, 572), (204.5, 545), (201.5, 505), (202.5, 455), (208, 400),
                 (213.5, 330), (218, 265), (222, 200), (224.5, 150), (227, 140.5)], 10)
    body = half(body)
    sacral = soften(Polygon([(214, 548), (238.6, 545), (238.6, 600), (229, 598), (218, 584)]).buffer(0), 2.5)
    marks = sacral.intersection(body.buffer(-0.4))
    lines = along([(229, 595), (224, 540), (220, 470), (222, 380), (227, 290), (230, 210), (231, 150)], 10, 14)
    lines += [curve([(212, 545), (209, 470), (213, 390), (219, 310), (224, 230)]),       # iliocostalis | longissimus
              curve([(233, 560), (232.5, 450), (233.5, 330), (234.5, 220), (235, 160)])]  # longissimus | spinalis
    return Muscle(body, lines, marks=marks)


def quadratus_lumborum():
    body = blob([(205, 425.5), (213, 426.5), (218, 436), (220.5, 470), (221, 495), (216, 506.5), (205, 509),
                 (189, 507), (180.5, 502), (183, 485), (189, 458), (197, 436)], 10)
    lines = across([(199, 432), (217, 432)], [(183, 503), (219, 501)], 7)
    lines += across([(217, 440), (220, 495)], [(195, 445), (190, 495)], 4)   # slips to the lumbar transverse processes
    return Muscle(body, lines)


def latissimus_dorsi():
    body = blob([(238.5, 318), (225, 326), (208, 336), (193, 346), (182, 349.5), (172, 343), (158, 327), (141, 309),
                 (128.5, 294), (126, 289.5), (131, 293), (137, 311), (142, 340), (147, 390), (150.5, 432), (155, 465),
                 (161.5, 494), (169, 503), (179.5, 503.5), (196, 468), (212, 428), (226, 386), (236, 350)], 10)
    body = half(body)
    edge = LineString([(238.6, 318), (236, 350), (226, 386), (212, 428), (196, 468), (179.5, 503.5)])
    fascia = soften(edge.buffer(4, cap_style=2).union(
        Polygon([(238.6, 320), (238.6, 372), (232, 360)]).buffer(0)), 1.5)
    tendon = tube([(140, 306), (132, 297), (125.5, 291)], [7, 6, 5])
    lines = fan((129, 294), [(238, 322), (236, 352), (224, 392), (212, 428), (196, 468), (180, 502), (163, 496)],
                18, 1.04)
    lines.append(curve([(130, 297), (150, 330), (162, 380), (166, 430), (168, 470)]))   # the twisting lateral margin
    return Muscle(body, lines, tendons=U(half(fascia), tendon))


def external_oblique():
    body = blob([(146, 428), (151, 431), (156, 455), (162, 480), (166.5, 505), (163, 512.5), (156, 513), (149, 503),
                 (143.5, 480), (142, 455)], 10)
    teeth = [soften(tube([(143 + i * 0.5, 430 + i * 13), (151 + i * 1.5, 437 + i * 13)], [7, 5.5]), 2) for i in range(3)]
    return Muscle(fillet(U(body, *teeth), 1.0), along([(147, 430), (150, 470), (158, 510)], 4, 5))


def deltoid():
    body = blob([(166, 248), (150, 240.5), (133, 234), (118, 228.5), (107.5, 231.5), (100, 240), (96, 256), (96, 280),
                 (99.5, 305), (104.5, 322), (108.5, 334), (114, 327), (125, 306), (140, 281), (155, 260)], 10)
    lines = fan((108.5, 331), [(165, 247.5), (148, 240), (132, 234), (117, 229.5), (103, 238), (97, 258), (96.5, 282)],
                14, 1.08)
    lines.append(LineString([(108.5, 331), (118, 280), (122, 232)]))   # posterior | middle part
    tendon = tube([(108.5, 328), (109, 338)], [5, 3.6])
    return Muscle(body, lines, tendons=tendon)


def rotator_cuff():
    supra = blob([(197, 236.5), (185, 233), (165, 233), (145, 235.5), (131, 239.5), (122, 245), (125, 250.5),
                  (140, 245.5), (160, 244.5), (185, 248.5), (197, 250)], 10)
    infra = blob([(198, 258), (185, 253), (167, 249.5), (150, 248), (139, 251), (127, 260), (126, 266), (134, 274),
                  (150, 298), (166, 324), (174, 338), (182, 345), (188, 337), (193, 316), (198.5, 285)], 10)
    tendon = U(tube([(133, 243), (122, 247)], [3.6, 3]), tube([(140, 257), (128, 263)], [6, 4.6]))
    lines = along([(197, 243), (170, 239.5), (145, 240), (124, 247.5)], 4, 3.8)
    lines += fan((128, 262), [(198, 262), (198, 290), (193, 318), (184, 340)], 12, 1.04)
    lines += along([(131, 268), (148, 293), (164, 321)], 3, 3.5)      # teres minor, along the lateral border
    lines.append(curve([(128, 265), (146, 284), (163, 307), (178, 333)]))   # infraspinatus | teres minor
    return Muscle(U(supra, infra), lines, tendons=tendon)


def teres_major():
    c = [(181, 344), (166, 331), (149, 315), (136, 301)]
    body = belly(c, [15, 17, 14, 8], 3)
    tendon = tube([(139, 305), (130, 296)], [6, 4.5])
    return Muscle(body, along(c, 5, 6), tendons=tendon)


# ================================================================== arm

def triceps():
    body = blob([(134, 266), (139, 275), (141, 304), (137, 345), (133, 380), (129, 410), (121, 438), (113, 453),
                 (106, 452), (100, 438), (97, 410), (96, 370), (97, 320), (101, 295), (110, 281), (124, 270)], 10)
    tendon = blob([(103.5, 406), (110, 396), (118, 392.5), (125.5, 398), (127, 410), (121, 430), (114, 446),
                   (110, 456), (106, 456), (102, 432)], 10)
    olecranon = tube([(110, 446), (108, 459)], [7, 6])
    lines = across([(104, 286), (97.5, 330), (97, 375)], [(118, 328), (113, 370), (108, 398)], 7)    # lateral head
    lines += across([(137, 273), (140, 315), (134, 370)], [(124, 322), (124, 362), (121, 396)], 6)   # long head
    lines += along([(101, 400), (103, 425), (107, 446)], 2, 2)                                        # medial head
    lines.append(curve([(127, 270), (122, 312), (118, 358), (114, 394)]))   # long | lateral head
    return Muscle(body, lines, tendons=olecranon, marks=tendon)


def brachioradialis():
    c = [(100, 388), (94, 420), (86, 470), (78.5, 520), (73.5, 565)]
    body = belly(c, [5, 12, 11, 8, 4], 1.8)
    tendon = tube([(75, 555), (70.5, 595), (68.5, 622)], [3.4, 3, 2.8])
    return Muscle(body, along(c, 4, 4.2), tendons=tendon)


def forearm_flexors():
    c = [(128, 448), (129.5, 480), (126.5, 520), (119.5, 560), (112, 594)]
    body = belly(c, [9, 11, 10, 7, 3.5], 2.5)
    tendon = tube([(114, 582), (109, 610), (107, 628)], [3, 2.8, 2.6])
    return Muscle(body, along(c, 4, 4), tendons=tendon)


def forearm_extensors():
    main = blob([(88, 440), (97, 444), (107, 458), (115, 482), (118, 516), (114.5, 555), (107, 585), (100, 603),
                 (92, 610), (85, 606), (81, 590), (80.5, 560), (82.5, 520), (84.5, 470)], 10)
    thumb = belly([(105, 538), (95, 568), (84, 596), (78, 610)], [5, 8, 6, 3.5], 1.8)   # abductor pollicis longus,
    body = fillet(U(main, thumb), 1.0)                                                 # extensor pollicis brevis
    tendon = tube([(80, 604), (73.5, 628), (66, 655)], [3, 2.6, 2.2])
    for x0, x1 in ((86, 75.5), (90.5, 84.5), (95, 93), (99.5, 102)):
        tendon = U(tendon, tube([(x0, 600), ((x0 + x1) / 2 + 0.6, 650), (x1, 700)], [2.4, 1.8, 1.5]))
    retinaculum = soften(curve([(77, 631), (94, 627.5), (110, 625)]).buffer(2.6), 1.0)   # extensor retinaculum
    lines = along([(86, 445), (84, 520), (85, 600)], 2, 2.6)                  # radial wrist extensors
    lines += along([(97, 448), (98, 530), (93, 615)], 3, 4)                   # extensor digitorum
    lines += along([(108, 462), (114, 520), (106, 600)], 2, 2.6)              # extensor carpi ulnaris
    lines += along([(105, 538), (95, 568), (84, 596), (78, 610)], 2, 2.6)
    lines += [curve([(91, 444), (89, 520), (88, 612)]), curve([(104, 455), (108.5, 530), (101, 612)])]
    return Muscle(body, lines, tendons=U(tendon, retinaculum))


def hand_interossei():
    first = blob([(72, 655), (75.5, 660), (74.5, 673), (71, 699), (66, 693), (62, 681), (66, 667)], 8)
    parts, lines = [first], across([(73, 657), (75, 690)], [(63, 680), (69, 698)], 4)
    for x0 in (82, 90, 98):
        c = [(x0, 660), (x0 - 1.5, 680), (x0 - 2.5, 699)]
        parts.append(soften(tube(c, [2.8, 3.4, 2]), 0.5))
        lines += along(c, 2, 0.9)
    return Muscle(U(*parts), lines)


# ================================================================== hip and thigh

def gluteus_minimus():
    body = blob([(150, 591.5), (153, 594.5), (158, 592), (168, 578), (184, 566), (196, 556), (202, 543), (199, 528),
                 (189, 520), (177, 520), (166, 529), (157, 552)], 10)
    return Muscle(body, fan((153, 591), [(158, 553), (168, 528), (184, 520), (198, 530), (200, 548)], 8, 1.05))


def gluteus_medius():
    body = blob([(146, 602), (157, 600), (165, 590), (182, 570), (199, 550), (206, 536), (205, 515), (198, 505),
                 (183, 498.5), (167, 498.5), (155, 503), (148.5, 515), (143.5, 545), (142, 575), (142.5, 592)], 10)
    tendon = tube([(153, 595), (147, 603)], [6, 5])
    lines = fan((150, 598), [(144, 552), (149, 512), (168, 500), (190, 502), (205, 520), (203, 540)], 13, 1.06)
    return Muscle(body, lines, tendons=tendon)


def piriformis():
    body = blob([(216, 555.5), (223, 559.5), (227, 568), (223, 574.5), (205, 582), (186, 591), (170, 599.5),
                 (163, 600), (165, 595.5), (178, 586), (194, 573), (207, 562)], 8)
    tendon = tube([(172, 596), (161.5, 598.5)], [3, 2.6])
    return Muscle(body, fan((164, 598), [(216, 557), (225, 563), (225, 572)], 6, 1.06), tendons=tendon)


def gemelli():
    sup = soften(tube([(206.5, 597), (186, 600), (166, 603.5)], [3.4, 3, 2.4]), 0.6)
    inf = soften(tube([(204, 610.5), (185, 611.5), (167, 612.5)], [3.6, 3.2, 2.4]), 0.6)
    return Muscle(U(sup, inf), along([(206.5, 597), (166, 603.5)], 2, 0.8) + along([(204, 610.5), (167, 612.5)], 2, 0.9))


def obturator_internus():
    c = [(213, 603), (196, 605), (182, 606.5)]
    body = soften(tube(c, [4.6, 3.8, 2.6]), 0.8)
    tendon = tube([(184, 606.3), (165, 608)], [2.2, 2])
    return Muscle(body, along(c, 2, 1.1), tendons=tendon)


def quadratus_femoris():
    body = blob([(198, 618.5), (198.5, 630), (195, 635), (182, 634.5), (170, 633), (166, 628), (166, 620), (170, 616.5),
                 (184, 617)], 8)
    return Muscle(body, across([(197, 619.5), (197.5, 633)], [(167, 619), (167, 631)], 6))


def gluteus_maximus():
    body = blob([(199, 513), (192, 515.5), (182, 525), (166, 545), (153, 568), (145.5, 592), (142.5, 620), (144.5, 640),
                 (150.5, 653), (158, 660), (172, 663), (190, 662), (210, 654), (226, 639), (233.5, 628), (237.5, 615),
                 (238.3, 603), (231, 580), (219, 548), (206, 522)], 10)
    tract = soften(tube([(145, 630), (144.5, 670), (147, 730), (152, 790), (158, 845), (163, 885)],
                        [9, 7, 6, 5.5, 5, 4.2]), 1.2)                           # iliotibial tract
    lines = across([(200, 515), (220, 548), (236, 600)], [(149, 585), (145, 630), (168, 662)], 14)
    return Muscle(body, lines, tendons=tract)


def adductors():
    body = blob([(197, 628), (207, 630), (223, 641), (231, 652), (235, 670), (235.5, 700), (231, 760), (227, 800),
                 (222, 820), (217, 814), (210, 760), (202, 705), (195, 660), (194.5, 640)], 10)
    tendon = tube([(222, 795), (222.5, 815), (221.5, 834)], [4, 3.4, 3])   # to the adductor tubercle
    lines = across([(197, 632), (215, 636), (233, 660)], [(203, 705), (212, 760), (224, 812)], 11)
    return Muscle(body, lines, tendons=tendon)


def vastus_lateralis():
    body = blob([(151, 608), (156, 618), (160, 645), (163, 700), (166.5, 770), (171, 822), (168.5, 842), (163, 845),
                 (156, 832), (149, 805), (143, 760), (139.5, 710), (139, 670), (140, 628), (144.5, 613)], 10)
    lines = across([(141, 630), (141, 700), (148, 790)], [(158, 650), (163, 730), (168, 830)], 12)
    return Muscle(body, lines)


def hamstrings():
    bf = belly([(194, 630), (188, 680), (182.5, 740), (177, 795), (172.5, 840), (171, 872)], [12, 22, 25, 20, 13, 6], 3)
    short = belly([(165, 742), (166, 800), (170, 848)], [8, 12, 7], 2)
    st = belly([(199.5, 631), (203, 690), (206, 750), (210.5, 800)], [10, 18, 17, 7], 3)
    sm = belly([(211, 700), (219, 760), (222.5, 815), (219.5, 862)], [6, 15, 16, 9], 3)
    body = fillet(U(bf, short, st, sm), 1.2)
    tendons = U(tube([(196, 622), (197, 640)], [9, 8]),                                         # ischial tuberosity
                tube([(201, 640), (206, 672), (211, 705)], [7, 8, 6]),                          # semimembranosus sheet
                tube([(209.5, 792), (214, 835), (216.5, 868), (219, 896)], [4, 3.2, 2.8, 2.6]),  # semitendinosus
                tube([(170.5, 860), (170.5, 884), (171.5, 897)], [6, 4.6, 4]))                  # to the fibular head
    lines = along([(194, 632), (188, 680), (182.5, 740), (177, 795), (172.5, 840)], 5, 8.5)
    lines += along([(165, 745), (166, 800), (170, 846)], 2, 3)
    lines += along([(199.5, 634), (203, 690), (206, 750), (210, 795)], 3, 5)
    lines += across([(212, 705), (225, 770), (229, 825)], [(214, 740), (218, 790), (220, 850)], 6)
    lines += [curve([(197, 640), (195.5, 700), (194, 760), (190, 810)])]   # biceps femoris | semitendinosus
    return Muscle(body, lines, tendons=tendons)


# ================================================================== knee, leg and foot

def popliteus():
    body = blob([(182, 866), (188, 864), (200, 874), (213, 884), (218, 894), (214.5, 905), (205, 904), (195, 893),
                 (186, 875)], 8)
    tendon = tube([(179.5, 864), (187, 869)], [2.8, 3])
    return Muscle(body, fan((185, 869), [(217, 889), (214, 903), (204, 904)], 7, 1.05), tendons=tendon)


def tibialis_posterior():
    c = [(190, 908), (189, 950), (192, 1000), (198, 1038), (205, 1058)]
    body = belly(c, [8, 11, 9, 6, 3], 2)
    tendon = tube([(201, 1040), (208, 1066), (216, 1094), (222, 1112), (227.5, 1122)], [3, 2.8, 2.6, 2.4, 2.2])
    return Muscle(body, along(c, 4, 3.4), tendons=tendon)


def toe_flexors():
    fdl = belly([(210, 928), (213, 980), (216.5, 1030), (219, 1075)], [4, 7.5, 6, 3], 1.5)
    fhl = belly([(189, 958), (191, 1000), (194.5, 1040), (200, 1068), (205.5, 1088)], [5, 8.5, 8, 6, 3], 1.8)
    tendon = U(tube([(218, 1062), (222, 1095), (225.5, 1118)], [2.4, 2.2, 2]),
               tube([(203, 1080), (209.5, 1103), (215, 1125)], [2.6, 2.4, 2.2]))
    lines = along([(210, 928), (213, 980), (216.5, 1030), (219, 1075)], 2, 1.8)
    lines += across([(187, 965), (190, 1050)], [(193, 975), (204, 1085)], 6)   # flexor hallucis longus, pennate
    return Muscle(U(fdl, fhl), lines, tendons=tendon)


def fibularis():
    c = [(170.5, 889), (166.5, 940), (166, 1000), (168.5, 1060), (171.5, 1095)]
    body = belly(c, [7, 10, 9, 6, 3], 2)
    tendon = U(tube([(169.5, 1055), (168.5, 1090), (172, 1116), (178, 1136), (181, 1143)], [3, 2.8, 2.6, 2.4, 2.2]),
               tube([(173, 1070), (173.5, 1100), (176.5, 1120), (181.5, 1135)], [2.4, 2.4, 2.2, 2]))
    lines = across([(165, 905), (163.5, 1000), (167, 1080)], [(175, 930), (172, 1010), (171, 1090)], 9)
    return Muscle(body, lines, tendons=tendon)


def soleus():
    body = blob([(171, 891), (184, 895), (200, 899.5), (220, 903), (227.5, 912), (231.5, 935), (233.5, 972),
                 (231.5, 1010), (226.5, 1035), (217, 1060), (209, 1083), (201, 1083), (192, 1060), (184, 1040),
                 (176, 1008), (170, 960), (169, 925)], 10)
    lines = across([(172, 905), (172.5, 960), (182, 1030)], [(196, 935), (199, 990), (203, 1060)], 8)    # lateral half
    lines += across([(227, 915), (232.5, 970), (225, 1040)], [(207, 935), (206.5, 990), (205.5, 1060)], 8)  # medial
    lines.append(LineString([(202, 915), (204.5, 1075)]))   # the central aponeurosis
    return Muscle(body, lines)


def gastrocnemius():
    lat = blob([(181.5, 829), (190, 834), (197, 850), (200.5, 880), (201.5, 940), (201, 990), (200.5, 1012),
                (193, 1012), (183, 997), (175, 970), (170.5, 925), (171, 882), (176, 846)], 10)
    med = blob([(219.5, 829), (212, 834), (205.5, 850), (202.5, 880), (202, 940), (203, 995), (206, 1020),
                (214.5, 1017), (225, 1001), (231, 976), (233, 920), (231, 866), (225.5, 840)], 10)
    body = fillet(U(lat, med), 0.8)
    achilles = blob([(194.5, 998), (213.5, 1000), (212, 1040), (209.5, 1080), (210.5, 1110), (213.5, 1130),
                     (207, 1135.5), (198.5, 1134.5), (197.5, 1128), (201, 1104), (200.5, 1070), (196.5, 1030)], 10)
    lines = along([(180, 832), (184.5, 880), (188.5, 950), (196, 1008)], 5, 8.5)
    lines += along([(221, 832), (220.5, 880), (217.5, 950), (209, 1014)], 6, 10)
    lines.append(curve([(201.8, 846), (201.6, 930), (202, 1012)]))   # lateral | medial head
    return Muscle(body, lines, tendons=achilles)


BACK = {
    'occipitofrontalis': occipitofrontalis, 'sternocleidomastoid': sternocleidomastoid, 'splenius': splenius,
    'levator-scapulae': levator_scapulae, 'trapezius': trapezius, 'rhomboids': rhomboids,
    'erector-spinae': erector_spinae, 'quadratus-lumborum': quadratus_lumborum,
    'latissimus-dorsi': latissimus_dorsi, 'external-oblique': external_oblique, 'deltoid': deltoid,
    'rotator-cuff': rotator_cuff, 'teres-major': teres_major, 'triceps': triceps,
    'brachioradialis': brachioradialis, 'forearm-flexors': forearm_flexors, 'forearm-extensors': forearm_extensors,
    'hand-interossei': hand_interossei, 'gluteus-minimus': gluteus_minimus, 'gluteus-medius': gluteus_medius,
    'piriformis': piriformis, 'gemelli': gemelli, 'obturator-internus': obturator_internus,
    'quadratus-femoris': quadratus_femoris, 'gluteus-maximus': gluteus_maximus, 'adductors': adductors,
    'vastus-lateralis': vastus_lateralis, 'hamstrings': hamstrings, 'popliteus': popliteus,
    'tibialis-posterior': tibialis_posterior, 'toe-flexors': toe_flexors, 'fibularis': fibularis,
    'soleus': soleus, 'gastrocnemius': gastrocnemius,
}
