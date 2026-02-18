/**
 * FallOfCavalry - Input Management
 * Klavye, mouse ve touch kontrolleri
 */

/**
 * Input Manager - Tüm input'ları yönetir
 */
export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.handlers = new Map();
    this.boundListeners = new Map();
    this.listenersBound = false;
    this.warnedKeys = new Set();

    // Mouse state
    this.mouse = {
      x: 0,
      y: 0,
      worldX: 0,
      worldY: 0,
      leftButton: false,
      rightButton: false,
      leftClick: false,
      rightClick: false,
      over: false,
    };

    // Keyboard state
    this.keys = {};
    this.keyPressed = {};
    this.keyReleased = {};

    // Touch state
    this.touches = new Map();

    // Wheel
    this.wheelDelta = 0;

    this.setupListeners();
  }

  // ========================================================================
  // SETUP
  // ========================================================================

  warnOnce(key, message) {
    if (this.warnedKeys.has(key)) return;
    this.warnedKeys.add(key);
    console.warn(message);
  }

  getCanvasRect() {
    if (!this.canvas || typeof this.canvas.getBoundingClientRect !== 'function') {
      return { left: 0, top: 0 };
    }

    const rect = this.canvas.getBoundingClientRect();
    if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.top)) {
      return { left: 0, top: 0 };
    }

    return rect;
  }

  setupListeners() {
    if (this.listenersBound) return;

    const hasCanvas = this.canvas && typeof this.canvas.addEventListener === 'function';
    const doc = globalThis.document;
    const win = globalThis.window;

    if (!hasCanvas) {
      this.warnOnce('invalid-canvas', '[Input] Canvas is missing/invalid; canvas listeners skipped');
    }

    if (!doc || typeof doc.addEventListener !== 'function') {
      this.warnOnce('missing-document', '[Input] Document unavailable; keyboard listeners skipped');
    }

    if (!win || typeof win.addEventListener !== 'function') {
      this.warnOnce('missing-window', '[Input] Window unavailable; window listeners skipped');
    }

    // Mouse
    this.addListener(this.canvas, 'mousemove', this.handleMouseMove.bind(this));
    this.addListener(this.canvas, 'mousedown', this.handleMouseDown.bind(this));
    this.addListener(this.canvas, 'mouseup', this.handleMouseUp.bind(this));
    this.addListener(this.canvas, 'mouseenter', this.handleMouseEnter.bind(this));
    this.addListener(this.canvas, 'mouseleave', this.handleMouseLeave.bind(this));
    this.addListener(this.canvas, 'contextmenu', (e) => e?.preventDefault?.());
    this.addListener(this.canvas, 'wheel', this.handleWheel.bind(this));

    // Keyboard
    this.addListener(doc, 'keydown', this.handleKeyDown.bind(this));
    this.addListener(doc, 'keyup', this.handleKeyUp.bind(this));

    // Touch
    this.addListener(this.canvas, 'touchstart', this.handleTouchStart.bind(this));
    this.addListener(this.canvas, 'touchmove', this.handleTouchMove.bind(this));
    this.addListener(this.canvas, 'touchend', this.handleTouchEnd.bind(this));
    this.addListener(this.canvas, 'touchcancel', this.handleTouchEnd.bind(this));

    // Window events
    this.addListener(win, 'blur', this.handleBlur.bind(this));

    this.listenersBound = true;
  }

  addListener(target, event, handler) {
    if (!target || typeof target.addEventListener !== 'function') return;

    const doc = globalThis.document;
    const win = globalThis.window;
    const scope = target === doc ? 'document' : target === win ? 'window' : 'canvas';
    const key = `${scope}:${event}`;

    if (this.boundListeners.has(key)) return;

    const options = { passive: false };
    target.addEventListener(event, handler, options);

    const listenerData = { target, event, handler, options };
    this.boundListeners.set(key, listenerData);
    this.handlers.set(key, listenerData);
  }

  // ========================================================================
  // MOUSE HANDLERS
  // ========================================================================

  handleMouseMove(e) {
    const rect = this.getCanvasRect();
    this.mouse.x = (e?.clientX ?? 0) - rect.left;
    this.mouse.y = (e?.clientY ?? 0) - rect.top;
  }

  handleMouseDown(e) {
    if (e?.button === 0) {
      this.mouse.leftButton = true;
      this.mouse.leftClick = true;
    } else if (e?.button === 2) {
      this.mouse.rightButton = true;
      this.mouse.rightClick = true;
    }
  }

  handleMouseUp(e) {
    if (e?.button === 0) {
      this.mouse.leftButton = false;
    } else if (e?.button === 2) {
      this.mouse.rightButton = false;
    }
  }

  handleMouseEnter() {
    this.mouse.over = true;
  }

  handleMouseLeave() {
    this.mouse.over = false;
    this.mouse.leftButton = false;
    this.mouse.rightButton = false;
  }

  handleWheel(e) {
    e?.preventDefault?.();
    this.wheelDelta = e?.deltaY ?? 0;
  }

  // ========================================================================
  // KEYBOARD HANDLERS
  // ========================================================================

  handleKeyDown(e) {
    const key = e?.key?.toLowerCase?.();
    if (!key) return;

    // Sadece ilk basılışta pressed olur
    if (!this.keys[key]) {
      this.keyPressed[key] = true;
    }

    this.keys[key] = true;
  }

  handleKeyUp(e) {
    const key = e?.key?.toLowerCase?.();
    if (!key) return;

    this.keys[key] = false;
    this.keyReleased[key] = true;
  }

  handleBlur() {
    // Pencere focus kaybedince tüm tuşları sıfırla
    this.keys = {};
    this.keyPressed = {};
    this.keyReleased = {};
    this.mouse.leftButton = false;
    this.mouse.rightButton = false;
  }

  // ========================================================================
  // TOUCH HANDLERS
  // ========================================================================

  handleTouchStart(e) {
    e?.preventDefault?.();

    const rect = this.getCanvasRect();
    Array.from(e?.touches ?? []).forEach((touch) => {
      this.touches.set(touch.identifier, {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
        startX: touch.clientX - rect.left,
        startY: touch.clientY - rect.top,
      });
    });

    // İlk touch'ı left click gibi davran
    if ((e?.touches?.length ?? 0) === 1) {
      this.mouse.leftClick = true;
      const touch = e.touches[0];
      this.mouse.x = touch.clientX - rect.left;
      this.mouse.y = touch.clientY - rect.top;
    }
  }

  handleTouchMove(e) {
    e?.preventDefault?.();

    const rect = this.getCanvasRect();
    Array.from(e?.touches ?? []).forEach((touch) => {
      const stored = this.touches.get(touch.identifier);
      if (stored) {
        stored.x = touch.clientX - rect.left;
        stored.y = touch.clientY - rect.top;
      }
    });

    // İlk touch'ı mouse move gibi davran
    if ((e?.touches?.length ?? 0) === 1) {
      const touch = e.touches[0];
      this.mouse.x = touch.clientX - rect.left;
      this.mouse.y = touch.clientY - rect.top;
    }
  }

  handleTouchEnd(e) {
    e?.preventDefault?.();

    Array.from(e?.changedTouches ?? []).forEach((touch) => {
      this.touches.delete(touch.identifier);
    });
  }

  // ========================================================================
  // QUERY METHODS
  // ========================================================================

  /**
   * Tuş basılı mı?
   */
  isKeyDown(key) {
    return this.keys[key.toLowerCase()] === true;
  }

  /**
   * Tuş bu frame'de basıldı mı?
   */
  isKeyPressed(key) {
    return this.keyPressed[key.toLowerCase()] === true;
  }

  /**
   * Tuş bu frame'de bırakıldı mı?
   */
  isKeyReleased(key) {
    return this.keyReleased[key.toLowerCase()] === true;
  }

  /**
   * Herhangi bir tuş basılı mı?
   */
  anyKey() {
    return Object.keys(this.keys).some((key) => this.keys[key]);
  }

  /**
   * Mouse koordinatlarını al
   */
  getMousePosition() {
    return { x: this.mouse.x, y: this.mouse.y };
  }

  /**
   * Mouse dünya koordinatlarını al (kamera dönüşümü sonrası)
   */
  getMouseWorldPosition() {
    return { x: this.mouse.worldX, y: this.mouse.worldY };
  }

  /**
   * Left click this frame?
   */
  isLeftClick() {
    return this.mouse.leftClick;
  }

  /**
   * Right click this frame?
   */
  isRightClick() {
    return this.mouse.rightClick;
  }

  /**
   * Mouse button held?
   */
  isLeftButton() {
    return this.mouse.leftButton;
  }

  /**
   * Wheel delta al ve sıfırla
   */
  getWheelDelta() {
    const delta = this.wheelDelta;
    this.wheelDelta = 0;
    return delta;
  }

  // ========================================================================
  // UPDATE & RESET
  // ========================================================================

  /**
   * Frame sonunda çağrılmalı
   */
  update() {
    // Click flag'lerini temizle
    this.mouse.leftClick = false;
    this.mouse.rightClick = false;

    // Key pressed/released flag'lerini temizle
    this.keyPressed = {};
    this.keyReleased = {};
  }

  /**
   * World koordinatlarını güncelle (kamera transform'undan sonra)
   */
  updateWorldCoords(camera) {
    if (!camera) {
      this.mouse.worldX = this.mouse.x;
      this.mouse.worldY = this.mouse.y;
      return;
    }
    const zoom = Number.isFinite(camera.zoom) && camera.zoom > 0 ? camera.zoom : 1;
    const camX = Number.isFinite(camera.x) ? camera.x : 0;
    const camY = Number.isFinite(camera.y) ? camera.y : 0;
    this.mouse.worldX = this.mouse.x / zoom + camX;
    this.mouse.worldY = this.mouse.y / zoom + camY;
  }

  /**
   * Tüm input'ları sıfırla
   */
  reset() {
    this.mouse.leftButton = false;
    this.mouse.rightButton = false;
    this.mouse.leftClick = false;
    this.mouse.rightClick = false;
    this.keys = {};
    this.keyPressed = {};
    this.keyReleased = {};
    this.wheelDelta = 0;
    this.touches.clear();
  }

  // ========================================================================
  // CLEANUP
  // ========================================================================

  /**
   * Tüm listener'ları kaldır
   */
  destroy() {
    this.boundListeners.forEach(({ target, event, handler, options }) => {
      if (!target || typeof target.removeEventListener !== 'function') return;
      target.removeEventListener(event, handler, options);
    });

    this.handlers.clear();
    this.boundListeners.clear();
    this.touches.clear();
    this.listenersBound = false;

    console.log('[Input] Destroyed');
  }
}

// Default export
export default InputManager;
