/**
 * circular-gallery.js
 * Vanilla JS port of CircularGallery from React Bits (reactbits.dev)
 * Adapted for standalone use — no React required.
 * Depends on: ogl (loaded via CDN ESM)
 */

import {
  Camera,
  Mesh,
  Plane,
  Program,
  Renderer,
  Texture,
  Transform
} from 'https://cdn.jsdelivr.net/npm/ogl/dist/ogl.mjs';

/* ─── Utilities ──────────────────────────────────────────────── */

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function lerp(p1, p2, t) {
  return p1 + (p2 - p1) * t;
}

/* ─── Font Loading ───────────────────────────────────────────── */

function deriveFontFamilyFromUrl(url) {
  const fileName = (url.split('/').pop() || 'custom-font').split('?')[0];
  const base = fileName.replace(/\.(woff2?|ttf|otf|eot)$/i, '');
  return base.replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || 'GalleryFont';
}

async function loadFontFromStylesheet(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch font stylesheet (${response.status})`);
  const cssText = await response.text();
  const faceBlocks = cssText.match(/@font-face\s*{[^}]*}/g) || [];
  let family = null;
  const fontFaces = [];
  for (const block of faceBlocks) {
    const familyMatch = block.match(/font-family:\s*['"]?([^;'"]+)['"]?/);
    const urlMatch   = block.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/);
    if (!familyMatch || !urlMatch) continue;
    family = familyMatch[1].trim();
    const descriptors = {};
    const weightMatch = block.match(/font-weight:\s*([^;]+);/);
    const styleMatch  = block.match(/font-style:\s*([^;]+);/);
    const rangeMatch  = block.match(/unicode-range:\s*([^;]+);/);
    if (weightMatch) descriptors.weight       = weightMatch[1].trim();
    if (styleMatch)  descriptors.style        = styleMatch[1].trim();
    if (rangeMatch)  descriptors.unicodeRange = rangeMatch[1].trim();
    fontFaces.push(new FontFace(family, `url(${urlMatch[1]})`, descriptors));
  }
  if (!family) throw new Error('No @font-face rule found in the stylesheet');
  await Promise.allSettled(fontFaces.map(async f => { await f.load(); document.fonts.add(f); }));
  return family;
}

async function loadFontFromFile(url) {
  const family = deriveFontFamilyFromUrl(url);
  const fontFace = new FontFace(family, `url(${url})`);
  await fontFace.load();
  document.fonts.add(fontFace);
  return family;
}

async function loadCustomFont(fontUrl) {
  const isSheet = fontUrl.includes('fonts.googleapis.com') || /\.css(\?.*)?$/i.test(fontUrl);
  return isSheet ? loadFontFromStylesheet(fontUrl) : loadFontFromFile(fontUrl);
}

async function resolveFont(font, fontUrl) {
  if (!fontUrl) {
    if (document.fonts?.load) {
      try { await document.fonts.load(font); await document.fonts.ready; } catch { /* ignore */ }
    }
    return font;
  }
  try {
    const family   = await loadCustomFont(fontUrl);
    const prefix   = (font.match(/^\s*(.*?\d+px)/) || [])[1]?.trim() ?? 'bold 20px';
    const resolved = `${prefix} "${family}"`;
    if (document.fonts?.load) { try { await document.fonts.load(resolved); } catch { /* ignore */ } }
    return resolved;
  } catch (err) {
    console.warn('[CircularGallery] Font load failed:', err);
    return font;
  }
}

function getFontSize(font) {
  const m = font.match(/(\d+)px/);
  return m ? parseInt(m[1], 10) : 20;
}

/* ─── Text Texture ───────────────────────────────────────────── */

function createTextTexture(gl, text, font = 'bold 20px sans-serif', color = '#0f172a') {
  const canvas = document.createElement('canvas');
  const ctx    = canvas.getContext('2d');
  ctx.font     = font;
  const metrics   = ctx.measureText(text);
  const textWidth  = Math.ceil(metrics.width);
  const textHeight = Math.ceil(getFontSize(font) * 1.2);
  canvas.width  = textWidth  + 24;
  canvas.height = textHeight + 24;
  ctx.font          = font;
  ctx.fillStyle     = color;
  ctx.textBaseline  = 'middle';
  ctx.textAlign     = 'center';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new Texture(gl, { generateMipmaps: false });
  texture.image = canvas;
  return { texture, width: canvas.width, height: canvas.height };
}

/* ─── Title ──────────────────────────────────────────────────── */

class Title {
  constructor({ gl, plane, renderer, text, textColor = '#0f172a', font = 'bold 20px sans-serif' }) {
    this.gl       = gl;
    this.plane    = plane;
    this.renderer = renderer;
    this.text      = text;
    this.textColor = textColor;
    this.font      = font;
    this._build();
  }

  _build() {
    const { texture, width, height } = createTextTexture(this.gl, this.text, this.font, this.textColor);
    const geometry = new Plane(this.gl);
    const program  = new Program(this.gl, {
      vertex: `
        attribute vec3 position;
        attribute vec2 uv;
        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragment: `
        precision highp float;
        uniform sampler2D tMap;
        varying vec2 vUv;
        void main() {
          vec4 color = texture2D(tMap, vUv);
          if (color.a < 0.1) discard;
          gl_FragColor = color;
        }`,
      uniforms: { tMap: { value: texture } },
      transparent: true
    });
    this.mesh = new Mesh(this.gl, { geometry, program });
    const aspect     = width / height;
    const textHeight = this.plane.scale.y * 0.15;
    const textWidth  = textHeight * aspect;
    this.mesh.scale.set(textWidth, textHeight, 1);
    this.mesh.position.y = -this.plane.scale.y * 0.5 - textHeight * 0.5 - 0.05;
    this.mesh.setParent(this.plane);
  }
}

/* ─── Media ──────────────────────────────────────────────────── */

class Media {
  constructor({ geometry, gl, image, index, length, renderer, scene, screen, text, viewport, bend, textColor, borderRadius = 0, font }) {
    this.extra        = 0;
    this.geometry     = geometry;
    this.gl           = gl;
    this.image        = image;
    this.index        = index;
    this.length       = length;
    this.renderer     = renderer;
    this.scene        = scene;
    this.screen       = screen;
    this.text         = text;
    this.viewport     = viewport;
    this.bend         = bend;
    this.textColor    = textColor;
    this.borderRadius = borderRadius;
    this.font         = font;
    this._buildShader();
    this._buildMesh();
    this._buildTitle();
    this.onResize();
  }

  _buildShader() {
    const texture  = new Texture(this.gl, { generateMipmaps: true });
    this.program   = new Program(this.gl, {
      depthTest: false,
      depthWrite: false,
      vertex: `
        precision highp float;
        attribute vec3 position;
        attribute vec2 uv;
        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        uniform float uTime;
        uniform float uSpeed;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          p.z = (sin(p.x * 4.0 + uTime) * 1.5 + cos(p.y * 2.0 + uTime) * 1.5) * (0.1 + uSpeed * 0.5);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragment: `
        precision highp float;
        uniform vec2 uImageSizes;
        uniform vec2 uPlaneSizes;
        uniform sampler2D tMap;
        uniform float uBorderRadius;
        varying vec2 vUv;
        float roundedBoxSDF(vec2 p, vec2 b, float r) {
          vec2 d = abs(p) - b;
          return length(max(d, vec2(0.0))) + min(max(d.x, d.y), 0.0) - r;
        }
        void main() {
          vec2 ratio = vec2(
            min((uPlaneSizes.x / uPlaneSizes.y) / (uImageSizes.x / uImageSizes.y), 1.0),
            min((uPlaneSizes.y / uPlaneSizes.x) / (uImageSizes.y / uImageSizes.x), 1.0)
          );
          vec2 uv = vec2(
            vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
            vUv.y * ratio.y + (1.0 - ratio.y) * 0.5
          );
          vec4 color  = texture2D(tMap, uv);
          float d     = roundedBoxSDF(vUv - 0.5, vec2(0.5 - uBorderRadius), uBorderRadius);
          float alpha = 1.0 - smoothstep(-0.002, 0.002, d);
          gl_FragColor = vec4(color.rgb, alpha);
        }`,
      uniforms: {
        tMap:         { value: texture },
        uPlaneSizes:  { value: [0, 0] },
        uImageSizes:  { value: [0, 0] },
        uSpeed:       { value: 0 },
        uTime:        { value: 100 * Math.random() },
        uBorderRadius:{ value: this.borderRadius }
      },
      transparent: true
    });
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = this.image;
    img.onload = () => {
      texture.image = img;
      this.program.uniforms.uImageSizes.value = [img.naturalWidth, img.naturalHeight];
    };
  }

  _buildMesh() {
    this.plane = new Mesh(this.gl, { geometry: this.geometry, program: this.program });
    this.plane.setParent(this.scene);
  }

  _buildTitle() {
    this.title = new Title({
      gl: this.gl, plane: this.plane, renderer: this.renderer,
      text: this.text, textColor: this.textColor, font: this.font
    });
  }

  update(scroll, direction) {
    this.plane.position.x = this.x - scroll.current - this.extra;
    const x = this.plane.position.x;
    const H = this.viewport.width / 2;

    if (this.bend === 0) {
      this.plane.position.y = 0;
      this.plane.rotation.z = 0;
    } else {
      const B  = Math.abs(this.bend);
      const R  = (H * H + B * B) / (2 * B);
      const ex = Math.min(Math.abs(x), H);
      const arc = R - Math.sqrt(R * R - ex * ex);
      if (this.bend > 0) {
        this.plane.position.y = -arc;
        this.plane.rotation.z = -Math.sign(x) * Math.asin(ex / R);
      } else {
        this.plane.position.y = arc;
        this.plane.rotation.z =  Math.sign(x) * Math.asin(ex / R);
      }
    }

    this.speed = scroll.current - scroll.last;
    this.program.uniforms.uTime.value  += 0.04;
    this.program.uniforms.uSpeed.value  = this.speed;

    const po = this.plane.scale.x / 2;
    const vo = this.viewport.width / 2;
    this.isBefore = this.plane.position.x + po < -vo;
    this.isAfter  = this.plane.position.x - po >  vo;
    if (direction === 'right' && this.isBefore) { this.extra -= this.widthTotal; this.isBefore = this.isAfter = false; }
    if (direction === 'left'  && this.isAfter)  { this.extra += this.widthTotal; this.isBefore = this.isAfter = false; }
  }

  onResize({ screen, viewport } = {}) {
    if (screen)   this.screen   = screen;
    if (viewport) this.viewport = viewport;
    this.scale = this.screen.height / 1500;
    this.plane.scale.y = (this.viewport.height * (900 * this.scale)) / this.screen.height;
    this.plane.scale.x = (this.viewport.width  * (700 * this.scale)) / this.screen.width;
    this.plane.program.uniforms.uPlaneSizes.value = [this.plane.scale.x, this.plane.scale.y];
    this.padding    = 2;
    this.width      = this.plane.scale.x + this.padding;
    this.widthTotal = this.width * this.length;
    this.x          = this.width * this.index;
  }
}

/* ─── App ────────────────────────────────────────────────────── */

class App {
  constructor(container, {
    items,
    bend         = 3,
    textColor    = '#0f172a',
    borderRadius = 0.08,
    font         = 'bold 20px sans-serif',
    scrollSpeed  = 2,
    scrollEase   = 0.05
  } = {}) {
    this.container   = container;
    this.scrollSpeed = scrollSpeed;
    this.scroll      = { ease: scrollEase, current: 0, target: 0, last: 0 };
    this.onCheckDebounce = debounce(this._onCheck.bind(this), 200);
    this._initRenderer();
    this._initCamera();
    this._initScene();
    this._onResize();
    this._initGeometry();
    this._initMedias(items, bend, textColor, borderRadius, font);
    this._loop();
    this._bindEvents();
  }

  _initRenderer() {
    this.renderer = new Renderer({ alpha: true, antialias: true, dpr: Math.min(window.devicePixelRatio || 1, 2) });
    this.gl = this.renderer.gl;
    this.gl.clearColor(0, 0, 0, 0);
    this.container.appendChild(this.gl.canvas);
  }

  _initCamera() {
    this.camera = new Camera(this.gl);
    this.camera.fov = 45;
    this.camera.position.z = 20;
  }

  _initScene()    { this.scene = new Transform(); }

  _initGeometry() {
    this.planeGeometry = new Plane(this.gl, { heightSegments: 50, widthSegments: 100 });
  }

  _initMedias(items, bend, textColor, borderRadius, font) {
    const list = (items && items.length) ? items : [];
    this.mediasImages = [...list, ...list];           // duplicate for infinite loop
    this.medias = this.mediasImages.map((data, index) =>
      new Media({
        geometry: this.planeGeometry, gl: this.gl,
        image: data.image, index, length: this.mediasImages.length,
        renderer: this.renderer, scene: this.scene,
        screen: this.screen, text: data.text,
        viewport: this.viewport, bend, textColor, borderRadius, font
      })
    );
  }

  /* ── Input handlers ── */

  _onTouchDown(e) {
    this.isDown = true;
    this.scroll.position = this.scroll.current;
    this.start = e.touches ? e.touches[0].clientX : e.clientX;
  }

  _onTouchMove(e) {
    if (!this.isDown) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    this.scroll.target = this.scroll.position + (this.start - x) * (this.scrollSpeed * 0.025);
  }

  _onTouchUp() {
    this.isDown = false;
    this._onCheck();
  }

  _onWheel(e) {
    e.preventDefault();                                // prevent page scroll while hovering gallery
    const delta = e.deltaY || e.wheelDelta || e.detail;
    this.scroll.target += (delta > 0 ? this.scrollSpeed : -this.scrollSpeed) * 0.2;
    this.onCheckDebounce();
  }

  _onKeyDown(e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); this.scroll.target += this.scrollSpeed * 5; this.onCheckDebounce(); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); this.scroll.target -= this.scrollSpeed * 5; this.onCheckDebounce(); }
  }

  _onCheck() {
    if (!this.medias?.[0]) return;
    const width     = this.medias[0].width;
    const itemIndex = Math.round(Math.abs(this.scroll.target) / width);
    const snap      = width * itemIndex;
    this.scroll.target = this.scroll.target < 0 ? -snap : snap;
  }

  _onResize() {
    this.screen = { width: this.container.clientWidth, height: this.container.clientHeight };
    this.renderer.setSize(this.screen.width, this.screen.height);
    this.camera.perspective({ aspect: this.screen.width / this.screen.height });
    const fov    = (this.camera.fov * Math.PI) / 180;
    const height = 2 * Math.tan(fov / 2) * this.camera.position.z;
    const width  = height * this.camera.aspect;
    this.viewport = { width, height };
    this.medias?.forEach(m => m.onResize({ screen: this.screen, viewport: this.viewport }));
  }

  /* ── Render loop ── */

  _loop() {
    this.scroll.current = lerp(this.scroll.current, this.scroll.target, this.scroll.ease);
    const direction = this.scroll.current > this.scroll.last ? 'right' : 'left';
    this.medias?.forEach(m => m.update(this.scroll, direction));
    this.renderer.render({ scene: this.scene, camera: this.camera });
    this.scroll.last = this.scroll.current;
    this.raf = requestAnimationFrame(this._loop.bind(this));
  }

  /* ── Event listeners — wheel scoped to container ── */

  _bindEvents() {
    this._handlers = {
      resize:     this._onResize.bind(this),
      wheel:      this._onWheel.bind(this),
      mousedown:  this._onTouchDown.bind(this),
      mousemove:  this._onTouchMove.bind(this),
      mouseup:    this._onTouchUp.bind(this),
      touchstart: this._onTouchDown.bind(this),
      touchmove:  this._onTouchMove.bind(this),
      touchend:   this._onTouchUp.bind(this),
      keydown:    this._onKeyDown.bind(this)
    };

    window.addEventListener('resize',    this._handlers.resize);
    // Wheel is scoped to the container so page scrolling still works elsewhere
    this.container.addEventListener('wheel',      this._handlers.wheel,      { passive: false });
    window.addEventListener('mousedown', this._handlers.mousedown);
    window.addEventListener('mousemove', this._handlers.mousemove);
    window.addEventListener('mouseup',   this._handlers.mouseup);
    this.container.addEventListener('touchstart', this._handlers.touchstart, { passive: true });
    window.addEventListener('touchmove', this._handlers.touchmove);
    window.addEventListener('touchend',  this._handlers.touchend);
    this.container.addEventListener('keydown',    this._handlers.keydown);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize',    this._handlers.resize);
    this.container.removeEventListener('wheel',      this._handlers.wheel);
    window.removeEventListener('mousedown', this._handlers.mousedown);
    window.removeEventListener('mousemove', this._handlers.mousemove);
    window.removeEventListener('mouseup',   this._handlers.mouseup);
    this.container.removeEventListener('touchstart', this._handlers.touchstart);
    window.removeEventListener('touchmove', this._handlers.touchmove);
    window.removeEventListener('touchend',  this._handlers.touchend);
    this.container.removeEventListener('keydown',    this._handlers.keydown);
    const canvas = this.renderer?.gl?.canvas;
    canvas?.parentNode?.removeChild(canvas);
  }
}

/* ─── Init ───────────────────────────────────────────────────── */

async function initCircularGallery() {
  const container = document.getElementById('gallery-events');
  if (!container) return;

  // Use the same font as the rest of the site
  const resolvedFont = await resolveFont(
    'bold 18px DM Sans',
    'https://fonts.googleapis.com/css2?family=DM+Sans:wght@700&display=swap'
  );

  new App(container, {
    items: [
      { image: 'https://picsum.photos/seed/ieee-genesis26/800/600?grayscale',  text: 'GENESIS 2026'       },
      { image: 'https://picsum.photos/seed/ieee-aiml26/800/600?grayscale',     text: 'AI / ML Bootcamp'   },
      { image: 'https://picsum.photos/seed/ieee-industry26/800/600?grayscale', text: 'Industry Connect'   },
      { image: 'https://picsum.photos/seed/ieee-robotics/800/600?grayscale',   text: 'Robotics Day'       },
      { image: 'https://picsum.photos/seed/ieee-circuit/800/600?grayscale',    text: 'Circuit Workshop'   },
      { image: 'https://picsum.photos/seed/ieee-paper/800/600?grayscale',      text: 'Paper Presentation' },
      { image: 'https://picsum.photos/seed/ieee-iot/800/600?grayscale',        text: 'IoT Summit'         },
      { image: 'https://picsum.photos/seed/ieee-24h/800/600?grayscale',        text: '24h Hackathon'      },
    ],
    bend:         3,
    textColor:    '#1e3a5f',   // dark navy — readable on white background
    borderRadius: 0.08,
    font:         resolvedFont,
    scrollSpeed:  2,
    scrollEase:   0.05
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCircularGallery);
} else {
  initCircularGallery();
}
