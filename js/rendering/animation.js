export default class AnimationPlayer {
  constructor(loader, animDef = null) {
    this.loader = loader;
    this.animDef = animDef;
    this.animKey = typeof animDef === 'string' ? animDef : null;
    this.frameIndex = 0;
    this.timeAccumulatorMs = 0;
  }

  resolveAnim() {
    if (!this.loader?.manifest?.anims) return null;
    if (this.animKey) return this.loader.manifest.anims[this.animKey] || null;
    if (this.animDef && typeof this.animDef === 'object') return this.animDef;
    return null;
  }

  set(animKey) {
    if (!animKey || this.animKey === animKey) return;
    this.animKey = animKey;
    this.animDef = null;
    this.frameIndex = 0;
    this.timeAccumulatorMs = 0;
  }

  update(deltaMs) {
    const anim = this.resolveAnim();
    if (!anim || !Array.isArray(anim.frames) || anim.frames.length <= 1) return;

    const fps = Math.max(1, Number(anim.fps) || 1);
    const frameDurationMs = 1000 / fps;
    this.timeAccumulatorMs += Math.max(0, Number(deltaMs) || 0);

    while (this.timeAccumulatorMs >= frameDurationMs) {
      this.timeAccumulatorMs -= frameDurationMs;
      this.frameIndex += 1;
      if (this.frameIndex >= anim.frames.length) {
        this.frameIndex = anim.loop === false ? anim.frames.length - 1 : 0;
      }
    }
  }

  draw(ctx, x, y, options = {}) {
    const anim = this.resolveAnim();
    if (!anim || !Array.isArray(anim.frames) || anim.frames.length === 0) return false;
    const frameName = anim.frames[Math.max(0, Math.min(this.frameIndex, anim.frames.length - 1))];
    const sprite = this.loader?.getFrame(anim.atlas, frameName);
    if (!sprite) return false;

    const { scale = 1, anchor = 'center' } = options;
    const dw = sprite.sw * scale;
    const dh = sprite.sh * scale;
    const dx = anchor === 'center' ? x - dw / 2 : x;
    const dy = anchor === 'center' ? y - dh / 2 : y;
    ctx.drawImage(sprite.img, sprite.sx, sprite.sy, sprite.sw, sprite.sh, dx, dy, dw, dh);
    return true;
  }

  hasAnimation(animKey = this.animKey) {
    if (!animKey || !this.loader?.manifest?.anims) return false;
    const anim = this.loader.manifest.anims[animKey];
    return Boolean(anim && Array.isArray(anim.frames) && anim.frames.length > 0);
  }

  drawFrame(ctx, animKey, x, y, size = 18, options = {}) {
    if (!this.hasAnimation(animKey)) return false;
    this.set(animKey);
    const { anchor = 'center' } = options;
    const firstFrame = this.resolveAnim()?.frames?.[0];
    const sprite = firstFrame ? this.loader?.getFrame(this.resolveAnim()?.atlas, firstFrame) : null;
    if (!sprite?.sw) return false;
    const scale = Math.max(0.1, Number(size) || 18) / sprite.sw;
    return this.draw(ctx, x, y, { scale, anchor });
  }
}
