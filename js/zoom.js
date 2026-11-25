// Pan & zoom by animating the SVG viewBox. Mouse wheel, trackpad pinch, drag, touch pinch, buttons.
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createZoom(svg, { home = [-20, -12, 520, 1244], onChange = () => {} } = {}) {
  let vb = { x: home[0], y: home[1], w: home[2], h: home[3] };
  const MIN_W = 26, MAX_W = 1300;
  let raf = 0;
  const pointers = new Map();
  let drag = null; // { x, y, moved }
  let pinch = null; // { d, mx, my }
  let suppressClick = false;

  const apply = () => {
    svg.setAttribute('viewBox', `${vb.x.toFixed(2)} ${vb.y.toFixed(2)} ${vb.w.toFixed(2)} ${vb.h.toFixed(2)}`);
    onChange(vb);
  };
  const toSvg = (cx, cy) => {
    const m = svg.getScreenCTM();
    if (!m) return { x: vb.x + vb.w / 2, y: vb.y + vb.h / 2 };
    const p = new DOMPoint(cx, cy).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  const scale = () => svg.getScreenCTM()?.a || 1; // screen px per unit

  function zoomAt(f, px, py) {
    const w = Math.min(MAX_W, Math.max(MIN_W, vb.w * f));
    f = w / vb.w;
    vb = { x: px - (px - vb.x) * f, y: py - (py - vb.y) * f, w: vb.w * f, h: vb.h * f };
    clamp();
    apply();
  }
  function clamp() {
    // keep the figure (0..480 × 0..1200) at least partly in view
    const cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2;
    const ncx = Math.min(500, Math.max(-20, cx)), ncy = Math.min(1220, Math.max(-20, cy));
    vb.x += ncx - cx;
    vb.y += ncy - cy;
  }

  function animateTo(target, ms = 340) {
    cancelAnimationFrame(raf);
    if (reduced()) { vb = { ...target }; apply(); return; }
    const from = { ...vb }, t0 = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const step = (now) => {
      const t = Math.min(1, (now - t0) / ms), e = ease(t);
      vb = { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, w: from.w + (target.w - from.w) * e, h: from.h + (target.h - from.h) * e };
      apply();
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  // ---- input
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    cancelAnimationFrame(raf);
    const p = toSvg(e.clientX, e.clientY);
    const k = e.ctrlKey ? 0.012 : 0.0016; // ctrlKey = trackpad pinch
    zoomAt(Math.exp(e.deltaY * k), p.x, p.y);
  }, { passive: false });

  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    cancelAnimationFrame(raf);
    suppressClick = false;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, id: e.pointerId };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      if (drag) drag.moved = true;
    }
  });

  svg.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size >= 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const s = scale();
      vb.x -= (mx - pinch.mx) / s;
      vb.y -= (my - pinch.my) / s;
      const p = toSvg(mx, my);
      zoomAt(pinch.d / d, p.x, p.y);
      pinch = { d, mx, my };
      return;
    }
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) {
      drag.moved = true;
      svg.classList.add('dragging');
      try { svg.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    if (drag.moved) {
      const s = scale();
      vb.x -= (e.clientX - drag.x) / s;
      vb.y -= (e.clientY - drag.y) / s;
      clamp();
      apply();
    }
    drag.x = e.clientX;
    drag.y = e.clientY;
  });

  const end = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      if (drag?.moved) suppressClick = true;
      drag = null;
      svg.classList.remove('dragging');
    }
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  // swallow the click that ends a drag
  svg.addEventListener('click', (e) => {
    if (suppressClick) { e.stopPropagation(); e.preventDefault(); suppressClick = false; }
  }, true);

  apply();

  return {
    get box() { return { ...vb }; },
    home() { animateTo({ x: home[0], y: home[1], w: home[2], h: home[3] }); },
    zoomBy(f) { const c = { x: vb.x + vb.w / 2, y: vb.y + vb.h / 2 }; cancelAnimationFrame(raf); const t = { ...vb }; const w = Math.min(MAX_W, Math.max(MIN_W, vb.w * f)); f = w / vb.w; animateTo({ x: c.x - (c.x - t.x) * f, y: c.y - (c.y - t.y) * f, w: t.w * f, h: t.h * f }, 220); },
    pan(dx, dy) { animateTo({ ...vb, x: vb.x + dx * vb.w, y: vb.y + dy * vb.h }, 180); },
    // the figure was just flipped (Mirror, or front ↔ back): mirror the box about x = 240 so the same body part stays in frame
    mirrorX() { cancelAnimationFrame(raf); vb = { ...vb, x: 480 - vb.x - vb.w }; clamp(); apply(); },
    // Bring a box (svg units) into view; zoom in on small targets, leave large visible ones alone.
    reveal(b, { force = false, parts = null } = {}) {
      // a paired structure whose instances are each tiny (both hands' carpals): zoom into the first one
      if (parts?.length > 1 && parts.every((p) => Math.max(p.w, p.h) * scale() < 46)) b = parts[0];
      if (!b) return;
      const r = svg.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const tl = toSvg(r.left, r.top), br = toSvg(r.right, r.bottom);
      const vis = { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y };
      const inView = b.x >= vis.x && b.y >= vis.y && b.x + b.w <= vis.x + vis.w && b.y + b.h <= vis.y + vis.h;
      const pxSize = Math.max(b.w, b.h) * scale();
      if (!force && inView && pxSize > 46) return;
      const aspect = r.width / r.height;
      let h = Math.max(b.h * 2.6, (b.w * 2.6) / aspect, 210);
      if (!inView && pxSize > 46) h = Math.max(h, Math.min(vis.h, home[3]));
      h = Math.min(h, home[3]);
      const w = h * aspect;
      animateTo({ x: b.x + b.w / 2 - w / 2, y: b.y + b.h / 2 - h / 2, w, h });
    },
  };
}
