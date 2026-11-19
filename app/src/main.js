// Vice City Sunset — the editor.
//
// Wires the cover renderer to the page: photo loading (local files only,
// drag-and-drop or picker, plus two built-in demo photos), layout and
// caption controls, per-panel drag-to-pan and zoom, a live preview, and
// one-click PNG export at the three post sizes. URL parameters reproduce a
// cover exactly (?photo=&caption=&subtitle=&layout=&size=&shot=), which is
// how the entry's screenshots are taken deterministically.

import { drawCover, SIZES, LAYOUTS } from './cover.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

// ---------------------------------------------------------------- photos

const DEMOS = [
  { name: 'boulevard', label: 'Boulevard', src: 'samples/boulevard.jpg' },
  { name: 'pier', label: 'Pier', src: 'samples/pier.jpg' },
];

/** Loaded photos: { name, label, img }. Index 0 and 1 are always the demos. */
const photos = [];
/** Resolves once the demo photos and fonts are ready and the first frame is painted. */
let readyResolve;
const ready = new Promise((resolve) => { readyResolve = resolve; });

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

async function loadDemos() {
  for (const demo of DEMOS) {
    try {
      const img = await loadImage(demo.src);
      photos.push({ name: demo.name, label: demo.label, img });
    } catch (err) {
      console.error(err);
    }
  }
}

function addUpload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        photos.push({ name: file.name, label: file.name.replace(/\.[^.]+$/, ''), img });
        resolve(photos.length - 1);
      };
      img.onerror = () => reject(new Error(`could not read ${file.name}`));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error(`could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------- state

function defaultPanels(layout, photoPattern) {
  const n = LAYOUTS[layout].panels;
  return Array.from({ length: n }, (_, i) => ({
    photo: photoPattern[i % photoPattern.length],
    zoom: 1,
    // A slight upward bias: faces sit in the upper half of most photos,
    // and a wide panel crops top and bottom first.
    dx: 0,
    dy: 0.35,
  }));
}

const state = {
  title: params.get('caption') || 'Sunset Heist',
  subtitle: params.get('subtitle') || 'One last ride down the boulevard',
  layout: LAYOUTS[params.get('layout')] ? params.get('layout') : 'hero',
  sizeKey: SIZES[params.get('size')] ? params.get('size') : 'square',
  panels: defaultPanels(LAYOUTS[params.get('layout')] ? params.get('layout') : 'hero', [0, 1]),
};

let selectedPanel = 0;
let lastRects = [];
const shotMode = params.get('shot') === 'cover';

// ---------------------------------------------------------------- preview

const preview = $('preview');
const offscreen = document.createElement('canvas');
let rafId = 0;

function previewSize() {
  const size = SIZES[state.sizeKey];
  const scale = 880 / Math.max(size.w, size.h);
  return { w: Math.round(size.w * scale), h: Math.round(size.h * scale) };
}

function renderPreview() {
  const { w, h } = previewSize();
  lastRects = drawCover(preview, w, h, state, photos.map((p) => p.img));
  highlightSelected();
}

function scheduleRender() {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    renderPreview();
  });
}

/** A dashed outline around the selected panel, drawn over the preview. */
function highlightSelected() {
  const ctx = preview.getContext('2d');
  const rect = lastRects[selectedPanel];
  if (!rect || shotMode) return;
  ctx.save();
  ctx.setLineDash([10, 6]);
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 3;
  ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
  ctx.restore();
}

function panelAt(clientX, clientY) {
  const box = preview.getBoundingClientRect();
  const x = (clientX - box.left) * (preview.width / box.width);
  const y = (clientY - box.top) * (preview.height / box.height);
  return lastRects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}

// Drag to pan the selected panel's photo; wheel to zoom it.
let dragging = null;
preview.addEventListener('pointerdown', (e) => {
  if (shotMode) return;
  const i = panelAt(e.clientX, e.clientY);
  if (i < 0) return;
  selectedPanel = i;
  syncPanelControls();
  dragging = { x: e.clientX, y: e.clientY, panel: state.panels[i] };
  preview.setPointerCapture(e.pointerId);
  renderPreview();
});
preview.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const panel = dragging.panel;
  const img = photos[panel.photo]?.img;
  const rect = lastRects[selectedPanel];
  if (!img || !rect) return;
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * panel.zoom;
  const rangeX = Math.max(1, (img.naturalWidth * base - rect.w) / 2);
  const rangeY = Math.max(1, (img.naturalHeight * base - rect.h) / 2);
  const box = preview.getBoundingClientRect();
  const sx = preview.width / box.width;
  panel.dx = Math.max(-1, Math.min(1, panel.dx + ((e.clientX - dragging.x) * sx) / rangeX));
  panel.dy = Math.max(-1, Math.min(1, panel.dy + ((e.clientY - dragging.y) * sx) / rangeY));
  dragging.x = e.clientX;
  dragging.y = e.clientY;
  scheduleRender();
});
preview.addEventListener('pointerup', () => { dragging = null; });
preview.addEventListener('wheel', (e) => {
  if (shotMode) return;
  e.preventDefault();
  const panel = state.panels[selectedPanel];
  panel.zoom = Math.max(1, Math.min(3, panel.zoom * Math.exp(-e.deltaY * 0.0012)));
  syncPanelControls();
  scheduleRender();
}, { passive: false });

// Keyboard framing: arrows nudge the selected panel's photo, + and - zoom it.
document.addEventListener('keydown', (e) => {
  if (shotMode) return;
  if (e.target instanceof HTMLInputElement) return;
  const panel = state.panels[selectedPanel];
  const step = 0.06;
  if (e.key === 'ArrowLeft') { panel.dx = Math.max(-1, panel.dx - step); }
  else if (e.key === 'ArrowRight') { panel.dx = Math.min(1, panel.dx + step); }
  else if (e.key === 'ArrowUp') { panel.dy = Math.max(-1, panel.dy - step); }
  else if (e.key === 'ArrowDown') { panel.dy = Math.min(1, panel.dy + step); }
  else if (e.key === '+' || e.key === '=') { panel.zoom = Math.min(3, panel.zoom + 0.1); }
  else if (e.key === '-') { panel.zoom = Math.max(1, panel.zoom - 0.1); }
  else return;
  e.preventDefault();
  syncPanelControls();
  scheduleRender();
});

// ---------------------------------------------------------------- controls

function syncPanelControls() {
  const panel = state.panels[selectedPanel];
  $('zoom').value = String(Math.round(panel.zoom * 100));
  $('zoomValue').textContent = `${Math.round(panel.zoom * 100)}%`;
  $('panelLabel').textContent = `Panel ${selectedPanel + 1} of ${state.panels.length}`;
  document.querySelectorAll('.photo-thumb').forEach((el, i) => {
    el.classList.toggle('active', photos[panel.photo] && photos[i] === photos[panel.photo]);
  });
}

function buildLayoutButtons() {
  const wrap = $('layoutButtons');
  wrap.innerHTML = '';
  for (const [key, def] of Object.entries(LAYOUTS)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = def.label;
    btn.className = 'chip';
    btn.classList.toggle('active', state.layout === key);
    btn.addEventListener('click', () => {
      state.layout = key;
      state.panels = defaultPanels(key, [0, 1]);
      selectedPanel = 0;
      document.querySelectorAll('#layoutButtons .chip').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      syncPanelControls();
      scheduleRender();
    });
    wrap.appendChild(btn);
  }
}

function buildSizeButtons() {
  const wrap = $('sizeButtons');
  wrap.innerHTML = '';
  for (const [key, def] of Object.entries(SIZES)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = def.label;
    btn.className = 'chip';
    btn.classList.toggle('active', state.sizeKey === key);
    btn.addEventListener('click', () => {
      state.sizeKey = key;
      document.querySelectorAll('#sizeButtons .chip').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      scheduleRender();
    });
    wrap.appendChild(btn);
  }
}

function buildPhotoStrip() {
  const strip = $('photoStrip');
  strip.innerHTML = '';
  photos.forEach((photo, i) => {
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'photo-thumb';
    thumb.title = photo.label;
    const img = document.createElement('img');
    img.src = photo.img.src;
    img.alt = photo.label;
    thumb.appendChild(img);
    const cap = document.createElement('span');
    cap.textContent = photo.label;
    thumb.appendChild(cap);
    thumb.addEventListener('click', () => {
      state.panels[selectedPanel].photo = i;
      syncPanelControls();
      scheduleRender();
    });
    strip.appendChild(thumb);
  });
  syncPanelControls();
}

function wireControls() {
  $('titleInput').value = state.title;
  $('subtitleInput').value = state.subtitle;
  $('titleInput').addEventListener('input', (e) => { state.title = e.target.value; scheduleRender(); });
  $('subtitleInput').addEventListener('input', (e) => { state.subtitle = e.target.value; scheduleRender(); });
  $('zoom').addEventListener('input', (e) => {
    state.panels[selectedPanel].zoom = Number(e.target.value) / 100;
    $('zoomValue').textContent = `${e.target.value}%`;
    scheduleRender();
  });
  $('resetPanel').addEventListener('click', () => {
    const panel = state.panels[selectedPanel];
    panel.zoom = 1;
    panel.dx = 0;
    panel.dy = 0.35;
    syncPanelControls();
    scheduleRender();
  });
  $('fillAll').addEventListener('click', () => {
    const photo = state.panels[selectedPanel].photo;
    state.panels.forEach((p) => { p.photo = photo; });
    scheduleRender();
  });
  $('fileInput').addEventListener('change', async (e) => {
    for (const file of e.target.files) {
      try {
        const idx = await addUpload(file);
        state.panels[selectedPanel].photo = idx;
      } catch (err) {
        console.error(err);
      }
    }
    buildPhotoStrip();
    scheduleRender();
    e.target.value = '';
  });
  const dropZone = $('dropZone');
  ['dragover', 'dragenter'].forEach((name) => dropZone.addEventListener(name, (e) => {
    e.preventDefault();
    dropZone.classList.add('dragging');
  }));
  ['dragleave', 'drop'].forEach((name) => dropZone.addEventListener(name, (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragging');
  }));
  dropZone.addEventListener('drop', async (e) => {
    const files = [...(e.dataTransfer?.files || [])].filter((f) => f.type.startsWith('image/'));
    for (const file of files) {
      try {
        const idx = await addUpload(file);
        state.panels[selectedPanel].photo = idx;
      } catch (err) {
        console.error(err);
      }
    }
    buildPhotoStrip();
    scheduleRender();
  });
  $('exportBtn').addEventListener('click', () => exportCover(state.sizeKey));
}

// ---------------------------------------------------------------- export

function renderExport(sizeKey) {
  const size = SIZES[sizeKey];
  drawCover(offscreen, size.w, size.h, state, photos.map((p) => p.img));
  return offscreen;
}

function exportCover(sizeKey) {
  const size = SIZES[sizeKey];
  renderExport(sizeKey);
  return new Promise((resolve, reject) => {
    offscreen.toBlob((blob) => {
      if (!blob) {
        reject(new Error('export produced no image'));
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vice-city-sunset-${size.w}x${size.h}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      resolve({ w: size.w, h: size.h, bytes: blob.size });
    }, 'image/png');
  });
}

/** The test hook: export as a data URL so a headless run can verify the PNG. */
async function exportPNG(sizeKey) {
  const size = SIZES[sizeKey];
  renderExport(sizeKey);
  return new Promise((resolve, reject) => {
    offscreen.toBlob((blob) => {
      if (!blob) {
        reject(new Error('export produced no image'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve({ w: size.w, h: size.h, bytes: blob.size, dataUrl: String(reader.result) });
      reader.onerror = () => reject(new Error('could not read the exported PNG'));
      reader.readAsDataURL(blob);
    }, 'image/png');
  });
}

// ---------------------------------------------------------------- boot

async function boot() {
  await loadDemos();
  // URL demo mode: the named photo leads on even panels, the other demo
  // photo fills the odd ones, so every cover shows both photos.
  const wanted = params.get('photo');
  const wantedIdx = wanted ? photos.findIndex((p) => p.name === wanted) : 0;
  const heroIdx = wantedIdx >= 0 ? wantedIdx : 0;
  const otherIdx = photos.length > 1 ? (heroIdx + 1) % photos.length : heroIdx;
  state.panels.forEach((p, i) => { p.photo = i % 2 === 0 ? heroIdx : otherIdx; });
  try {
    await Promise.all([
      document.fonts.load('700 100px Oswald'),
      document.fonts.load('600 20px Inter'),
      document.fonts.ready,
    ]);
  } catch (err) {
    console.error(err);
  }
  if (shotMode) {
    document.body.classList.add('shot-cover');
    const size = SIZES[state.sizeKey];
    drawCover(preview, size.w, size.h, state, photos.map((p) => p.img));
  } else {
    buildLayoutButtons();
    buildSizeButtons();
    buildPhotoStrip();
    wireControls();
    syncPanelControls();
    renderPreview();
  }
  readyResolve();
}

window.__viceCity = {
  ready,
  exportPNG,
  exportCover,
  get state() { return state; },
  get photos() { return photos.map((p) => p.name); },
  get panelRects() { return lastRects; },
};

boot().catch((err) => console.error(err));
