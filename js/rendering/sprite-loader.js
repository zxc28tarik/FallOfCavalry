import * as utils from '../utils.js';

export default class SpriteLoader {
  constructor(manifestUrl, options = {}) {
    this.manifestUrl = manifestUrl;
    this.devMode = Boolean(options?.devMode);
    this.warnOnceFn = typeof options?.warnOnce === 'function' ? options.warnOnce : utils.warnOnce;
    this.devLogFn = typeof options?.devLog === 'function' ? options.devLog : utils.devLog;

    this.manifest = { images: {}, atlases: {}, sprites: {}, anims: {} };
    this.images = new Map();
    this.atlasFrames = new Map();

    this.manifestResolvedUrl = this.resolveUrl(manifestUrl, options?.baseUrl || this.getLocationHref());
    this.manifestBase = this.resolveBaseFromUrl(this.manifestResolvedUrl, options?.baseUrl || this.getLocationHref());
  }

  getLocationHref() {
    if (typeof window !== 'undefined' && window.location?.href) return window.location.href;
    return 'http://localhost/';
  }

  resolveBaseFromUrl(url, fallbackBase) {
    try {
      return new URL('./', url).toString();
    } catch {
      try {
        return new URL('./', fallbackBase || this.getLocationHref()).toString();
      } catch {
        return this.getLocationHref();
      }
    }
  }

  resolveUrl(path, base = this.manifestBase) {
    if (!path || typeof path !== 'string') return null;
    try {
      return new URL(path, base || this.getLocationHref()).toString();
    } catch {
      return null;
    }
  }

  withCacheBust(url) {
    if (!url) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}v=${Date.now()}`;
  }

  async loadManifest() {
    if (!this.manifestResolvedUrl) return this.manifest;
    const url = this.withCacheBust(this.manifestResolvedUrl);
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      if (this.devMode) this.devLogFn(true, `[Assets] Manifest fetch failed (${response.status}): ${this.manifestResolvedUrl}`);
      throw new Error(`Manifest load failed: ${response.status}`);
    }

    const data = await response.json();
    this.manifest = {
      images: data?.images && typeof data.images === 'object' ? data.images : {},
      atlases: data?.atlases && typeof data.atlases === 'object' ? data.atlases : {},
      sprites: data?.sprites && typeof data.sprites === 'object' ? data.sprites : {},
      anims: data?.anims && typeof data.anims === 'object' ? data.anims : {},
    };
    return this.manifest;
  }

  async loadAll() {
    await this.loadManifest();
    this.images.clear();
    this.atlasFrames.clear();

    const imageEntries = Object.entries(this.manifest.images || {});
    await Promise.all(imageEntries.map(async ([key, path]) => {
      const resolvedUrl = this.resolveUrl(path);
      const img = await this.loadImage(resolvedUrl);
      if (img) this.images.set(key, img);
    }));

    const atlasEntries = Object.entries(this.manifest.atlases || {});
    await Promise.all(atlasEntries.map(async ([atlasKey, atlasDef]) => {
      const frameMap = await this.loadAtlasFrames(atlasDef);
      this.atlasFrames.set(atlasKey, frameMap);
    }));

    return this.manifest;
  }

  async loadImage(url) {
    if (!url) return null;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        if (this.devMode) this.warnOnceFn(`asset:missing:${url}`, `[Assets] Missing image: ${url}`);
        resolve(null);
      };
      img.src = this.withCacheBust(url);
    });
  }

  async loadAtlasFrames(atlasDef) {
    const frames = new Map();
    if (!atlasDef || typeof atlasDef !== 'object') return frames;

    if (atlasDef.frames && typeof atlasDef.frames === 'object' && !Array.isArray(atlasDef.frames)) {
      Object.entries(atlasDef.frames).forEach(([name, frame]) => {
        const normalized = this.normalizeRect(frame);
        if (normalized) frames.set(name, normalized);
      });
      return frames;
    }

    if (typeof atlasDef.frames === 'string') {
      const framesUrl = this.resolveUrl(atlasDef.frames);
      if (!framesUrl) return frames;
      try {
        const response = await fetch(this.withCacheBust(framesUrl), { cache: 'no-store' });
        if (!response.ok) {
          if (this.devMode) this.warnOnceFn(`asset:missing:${framesUrl}`, `[Assets] Missing atlas frames: ${framesUrl}`);
          return frames;
        }
        const data = await response.json();
        const source = data?.frames && typeof data.frames === 'object' ? data.frames : data;
        if (!source || typeof source !== 'object') return frames;
        Object.entries(source).forEach(([name, frame]) => {
          const raw = frame?.frame && typeof frame.frame === 'object' ? frame.frame : frame;
          const normalized = this.normalizeRect(raw);
          if (normalized) frames.set(name, normalized);
        });
      } catch {
        return frames;
      }
    }

    return frames;
  }

  normalizeRect(frame) {
    if (!frame || typeof frame !== 'object') return null;
    const sx = Number(frame.x);
    const sy = Number(frame.y);
    const sw = Number(frame.w ?? frame.width);
    const sh = Number(frame.h ?? frame.height);
    if (![sx, sy, sw, sh].every(Number.isFinite) || sw <= 0 || sh <= 0) return null;
    return { sx, sy, sw, sh };
  }

  getImage(key) {
    return this.images.get(key) || null;
  }

  getFrame(atlasKey, frameName) {
    const atlasDef = this.manifest.atlases?.[atlasKey];
    if (!atlasDef) return null;
    const img = this.getImage(atlasDef.image || atlasKey);
    if (!img) return null;

    const frameMap = this.atlasFrames.get(atlasKey);
    const rect = frameMap?.get(frameName);
    if (!rect) return null;

    return { img, ...rect };
  }

  getSprite(spriteKey) {
    const sprite = this.manifest.sprites?.[spriteKey];
    if (!sprite) return null;

    if (sprite.atlas && sprite.frame) return this.getFrame(sprite.atlas, sprite.frame);

    if (sprite.atlas) {
      const atlasDef = this.manifest.atlases?.[sprite.atlas];
      const img = this.getImage(atlasDef?.image || sprite.atlas);
      const rect = this.normalizeRect(sprite);
      if (!img || !rect) return null;
      return { img, ...rect };
    }

    return null;
  }

  drawFallback(ctx, x, y, scale = 1, anchor = 'center') {
    const size = Math.max(4, 12 * scale);
    const ox = anchor === 'center' ? x - size / 2 : x;
    const oy = anchor === 'center' ? y - size / 2 : y;
    ctx.save();
    ctx.fillStyle = 'rgba(255, 0, 255, 0.55)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1;
    ctx.fillRect(ox, oy, size, size);
    ctx.strokeRect(ox, oy, size, size);
    ctx.restore();
  }

  drawSprite(ctx, spriteKey, x, y, options = {}) {
    if (!ctx) return false;
    const { scale = 1, anchor = 'center' } = options;
    const sprite = this.getSprite(spriteKey);
    if (!sprite?.img) {
      this.drawFallback(ctx, x, y, scale, anchor);
      return true;
    }

    const dw = sprite.sw * scale;
    const dh = sprite.sh * scale;
    const dx = anchor === 'center' ? x - dw / 2 : x;
    const dy = anchor === 'center' ? y - dh / 2 : y;
    ctx.drawImage(sprite.img, sprite.sx, sprite.sy, sprite.sw, sprite.sh, dx, dy, dw, dh);
    return true;
  }
}
