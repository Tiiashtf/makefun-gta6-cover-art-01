// Vice City Sunset — cover renderer.
//
// Draws the whole poster on a canvas: a warm sunset sky, photo panels in
// one of three layouts, a sunset colour grade over every photo, palm
// silhouettes, grain and a vignette, and big condensed caption lettering.
// Everything here is drawn from scratch with the canvas API; no image
// except the user's own photos ever appears in the poster.
//
// The render is deterministic: the grain uses a seeded generator, so the
// same state and the same photos always paint the same pixels.

export const SIZES = {
  square: { w: 1080, h: 1080, label: '1080 × 1080 · Square' },
  portrait: { w: 1080, h: 1350, label: '1080 × 1350 · Portrait' },
  wide: { w: 1920, h: 1080, label: '1920 × 1080 · Wide' },
};

export const LAYOUTS = {
  hero: { label: 'Hero + two', panels: 3 },
  strips: { label: 'Three strips', panels: 3 },
  grid: { label: 'Four squares', panels: 4 },
};

/** A tiny seeded generator, so the film grain never changes between runs. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The poster's geometry: header band, panel area and caption band. */
function posterGeometry(w, h) {
  const gutter = Math.max(6, Math.round(Math.min(w, h) * 0.012));
  const header = Math.round(h * 0.075);
  const caption = Math.round(h * 0.21);
  return {
    gutter,
    header,
    caption,
    area: { x: gutter, y: header + gutter, w: w - gutter * 2, h: h - header - caption - gutter * 2 },
  };
}

/**
 * The panel rectangles for a layout, in pixels, inside the panel area.
 * Every layout fills the area with the same gutter between panels.
 */
export function panelRects(layout, w, h) {
  const { gutter, area } = posterGeometry(w, h);
  const g = gutter;
  if (layout === 'strips') {
    const pw = (area.w - g * 2) / 3;
    return [0, 1, 2].map((i) => ({ x: area.x + i * (pw + g), y: area.y, w: pw, h: area.h }));
  }
  if (layout === 'grid') {
    const pw = (area.w - g) / 2;
    const ph = (area.h - g) / 2;
    return [
      { x: area.x, y: area.y, w: pw, h: ph },
      { x: area.x + pw + g, y: area.y, w: pw, h: ph },
      { x: area.x, y: area.y + ph + g, w: pw, h: ph },
      { x: area.x + pw + g, y: area.y + ph + g, w: pw, h: ph },
    ];
  }
  // hero: one wide panel on top, two half-width panels below.
  const topH = area.h * 0.6;
  const botH = area.h - topH - g;
  const halfW = (area.w - g) / 2;
  return [
    { x: area.x, y: area.y, w: area.w, h: topH },
    { x: area.x, y: area.y + topH + g, w: halfW, h: botH },
    { x: area.x + halfW + g, y: area.y + topH + g, w: halfW, h: botH },
  ];
}

/** The sunset sky behind the panels: purple dusk into orange-pink horizon. */
function paintSky(ctx, w, h) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#2b0f4a');
  sky.addColorStop(0.35, '#7a1e63');
  sky.addColorStop(0.62, '#e8446e');
  sky.addColorStop(0.82, '#ff8a3d');
  sky.addColorStop(1, '#ffc46b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
}

/** A low sun with a warm halo, sitting whole inside the header band. */
function paintSun(ctx, w, h, geo) {
  const cx = w * 0.76;
  const cy = geo.header * 0.52;
  const r = geo.header * 0.68;
  const halo = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 2.6);
  halo.addColorStop(0, 'rgba(255, 214, 120, 0.85)');
  halo.addColorStop(0.4, 'rgba(255, 140, 80, 0.35)');
  halo.addColorStop(1, 'rgba(255, 140, 80, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(cx - r * 2.6, cy - r * 2.6, r * 5.2, r * 5.2);
  const disc = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, 0, cx, cy, r);
  disc.addColorStop(0, '#fff6d8');
  disc.addColorStop(0.7, '#ffd166');
  disc.addColorStop(1, '#ff8a3d');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // A thin horizon glow under the header, so the sky band reads as a band.
  const glow = ctx.createLinearGradient(0, 0, w, 0);
  glow.addColorStop(0, 'rgba(255, 46, 136, 0)');
  glow.addColorStop(0.5, 'rgba(255, 214, 120, 0.55)');
  glow.addColorStop(1, 'rgba(34, 211, 238, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, geo.header - Math.max(2, geo.header * 0.06), w, Math.max(2, geo.header * 0.06));
}

/**
 * One palm silhouette, drawn from bezier fronds: a leaning trunk and nine
 * drooping fronds. (x, y) is the base of the trunk, s its height in pixels.
 */
function paintPalm(ctx, x, y, s, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  // Trunk, leaning slightly, drawn as a tapering curve.
  ctx.lineWidth = Math.max(2, s * 0.045);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + s * 0.06, y - s * 0.55, x + s * 0.16, y - s * 0.92);
  ctx.stroke();
  const topX = x + s * 0.16;
  const topY = y - s * 0.92;
  // Fronds fan out from the crown, each a curved blade.
  const fronds = [-2.4, -1.85, -1.3, -0.75, -0.2, 0.35, 0.9, 1.45, 2.0];
  for (const a of fronds) {
    const len = s * (0.42 + 0.1 * Math.cos(a * 0.7));
    const ex = topX + Math.sin(a) * len;
    const ey = topY - Math.cos(a) * len * 0.55 + len * 0.28;
    const mx = topX + Math.sin(a) * len * 0.55;
    const my = topY - Math.cos(a) * len * 0.45 - len * 0.12;
    ctx.lineWidth = Math.max(1.5, s * 0.028);
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(mx, my, ex, ey);
    ctx.stroke();
  }
  // A few coconuts under the crown.
  ctx.beginPath();
  ctx.arc(topX - s * 0.02, topY + s * 0.03, s * 0.035, 0, Math.PI * 2);
  ctx.arc(topX + s * 0.04, topY + s * 0.045, s * 0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Palm silhouettes along the header band and flanking the caption. */
function paintPalms(ctx, w, h, geo) {
  const ink = 'rgba(28, 6, 42, 0.88)';
  paintPalm(ctx, w * 0.06, geo.header + geo.gutter * 0.4, geo.header * 2.4, ink);
  paintPalm(ctx, w * 0.16, geo.header + geo.gutter * 0.4, geo.header * 1.7, ink);
  paintPalm(ctx, w * 0.94, geo.header + geo.gutter * 0.4, geo.header * 2.1, ink);
  const capTop = h - geo.caption;
  const faint = 'rgba(28, 6, 42, 0.5)';
  paintPalm(ctx, w * 0.015, capTop + geo.caption * 0.96, geo.caption * 0.85, faint);
  paintPalm(ctx, w * 0.985, capTop + geo.caption * 0.96, geo.caption * 0.85, faint);
}

/**
 * One photo drawn into its panel, cover-fit, zoomed and panned, then graded
 * with a warm sunset wash so every photo sits in the same golden hour.
 */
function paintPanel(ctx, img, rect, panel) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (img && img.naturalWidth > 0) {
    const zoom = panel.zoom || 1;
    const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * zoom;
    const dw = img.naturalWidth * base;
    const dh = img.naturalHeight * base;
    const dx = panel.dx || 0;
    const dy = panel.dy || 0;
    const x = rect.x + (rect.w - dw) / 2 + dx * ((dw - rect.w) / 2);
    const y = rect.y + (rect.h - dh) / 2 + dy * ((dh - rect.h) / 2);
    ctx.drawImage(img, x, y, dw, dh);
    // Sunset grade: a warm wash and a pink lift from the bottom.
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = '#ff9a3d';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.globalCompositeOperation = 'source-over';
    const lift = ctx.createLinearGradient(0, rect.y + rect.h * 0.55, 0, rect.y + rect.h);
    lift.addColorStop(0, 'rgba(232, 68, 110, 0)');
    lift.addColorStop(1, 'rgba(232, 68, 110, 0.22)');
    ctx.fillStyle = lift;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  } else {
    const empty = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    empty.addColorStop(0, '#5b2a6e');
    empty.addColorStop(1, '#e8446e');
    ctx.fillStyle = empty;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = `600 ${Math.max(14, rect.h * 0.05)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ADD A PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
  }
  ctx.restore();
  // A crisp white frame, the poster's signature edge.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.lineWidth = Math.max(2, Math.min(rect.w, rect.h) * 0.012);
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
}

/** The caption band: a dusk gradient, the title, the subtitle, neon rules. */
function paintCaption(ctx, w, h, geo, title, subtitle) {
  const top = h - geo.caption;
  const shade = ctx.createLinearGradient(0, top - geo.gutter, 0, h);
  shade.addColorStop(0, 'rgba(24, 4, 34, 0)');
  shade.addColorStop(0.35, 'rgba(24, 4, 34, 0.82)');
  shade.addColorStop(1, 'rgba(18, 2, 28, 0.96)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, top - geo.gutter, w, geo.caption + geo.gutter);

  const clean = (title || 'UNTITLED').toUpperCase().trim() || 'UNTITLED';
  const cx = w / 2;
  let size = h * 0.098;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const measure = (px) => {
    ctx.font = `700 ${px}px Oswald, 'Arial Narrow', sans-serif`;
    return ctx.measureText(clean).width;
  };
  while (size > h * 0.03 && measure(size) > w * 0.94) size *= 0.94;
  const titleY = top + geo.caption * 0.52;
  // Neon offset shadows: pink down-right, cyan up-left, then the face.
  ctx.font = `700 ${size}px Oswald, 'Arial Narrow', sans-serif`;
  ctx.fillStyle = '#ff2e88';
  ctx.fillText(clean, cx + size * 0.045, titleY + size * 0.045);
  ctx.fillStyle = '#22d3ee';
  ctx.fillText(clean, cx - size * 0.04, titleY - size * 0.04);
  ctx.lineWidth = Math.max(2, size * 0.09);
  ctx.strokeStyle = 'rgba(20, 2, 30, 0.9)';
  ctx.lineJoin = 'round';
  ctx.strokeText(clean, cx, titleY);
  ctx.fillStyle = '#fff8ec';
  ctx.fillText(clean, cx, titleY);

  if (subtitle && subtitle.trim() !== '') {
    const subSize = Math.max(12, h * 0.026);
    ctx.font = `600 ${subSize}px Inter, sans-serif`;
    ctx.fillStyle = 'rgba(255, 214, 150, 0.95)';
    ctx.fillText(subtitle.trim(), cx, titleY + size * 0.42 + subSize * 0.4);
  }
  // Twin neon rules under the lettering.
  const ruleY = h - geo.caption * 0.1;
  const ruleW = Math.min(w * 0.5, measure(size) * 0.7);
  ctx.fillStyle = '#ff2e88';
  ctx.fillRect(cx - ruleW / 2, ruleY, ruleW, Math.max(2, h * 0.004));
  ctx.fillStyle = '#22d3ee';
  ctx.fillRect(cx - ruleW / 2, ruleY + Math.max(3, h * 0.008), ruleW, Math.max(1.5, h * 0.003));
}

/** Seeded film grain and a soft vignette over the finished poster. */
function paintFinish(ctx, w, h) {
  const rng = mulberry32(20261119);
  const dots = Math.floor((w * h) / 260);
  for (let i = 0; i < dots; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const light = rng() > 0.5;
    ctx.fillStyle = light ? `rgba(255, 255, 255, ${0.02 + rng() * 0.05})` : `rgba(10, 0, 20, ${0.02 + rng() * 0.06})`;
    ctx.fillRect(x, y, 1 + rng() * 1.5, 1 + rng() * 1.5);
  }
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(10, 0, 20, 0)');
  vig.addColorStop(1, 'rgba(10, 0, 20, 0.32)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Paint the poster for `state` onto `canvas` (sized to w × h first).
 * state: { title, subtitle, layout, panels: [{ photo, zoom, dx, dy }] }
 * images: the loaded photos, indexed by panel.photo.
 */
export function drawCover(canvas, w, h, state, images) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const geo = posterGeometry(w, h);
  paintSky(ctx, w, h);
  paintSun(ctx, w, h, geo);
  paintPalms(ctx, w, h, geo);
  const rects = panelRects(state.layout, w, h);
  rects.forEach((rect, i) => {
    const panel = state.panels[i] || { photo: 0, zoom: 1, dx: 0, dy: 0 };
    paintPanel(ctx, images[panel.photo] || null, rect, panel);
  });
  paintCaption(ctx, w, h, geo, state.title, state.subtitle);
  paintFinish(ctx, w, h);
  return rects;
}
