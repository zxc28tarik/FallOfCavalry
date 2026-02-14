/**
 * FallOfCavalry - Input Management
 * Klavye, mouse ve touch kontrolleri
 * BAĞIMLILIK: utils.js
 */

import { safeClass } from '../utils.js';

/**
 * Input Manager - Tüm input'ları yönetir
 */
export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.handlers = new Map();
    
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
  
  setupListeners() {
    // Mouse
    this.addListener(this.canvas, 'mousemove', this.handleMouseMove.bind(this));
    this.addListener(this.canvas, 'mousedown', this.handleMouseDown.bind(this));
    this.addListener(this.canvas, 'mouseup', this.handleMouseUp.bind(this));
    this.addListener(this.canvas, 'mouseenter', this.handleMouseEnter.bind(this));
    this.addListener(this.canvas, 'mouseleave', this.handleMouseLeave.bind(this));
    this.addListener(this.canvas, 'contextmenu', (e) => e.preventDefault());
    this.addListener(this.canvas, 'wheel', this.handleWheel.bind(this));
    
    // Keyboard
    this.addListener(document, 'keydown', this.handleKeyDown.bind(this));
    this.addListener(document, 'keyup', this.handleKeyUp.bind(this));
    
    // Touch
    this.addListener(this.canvas, 'touchstart', this.handleTouchStart.bind(this));
    this.addListener(this.canvas, 'touchmove', this.handleTouchMove.bind(this));
    this.addListener(this.canvas, 'touchend', this.handleTouchEnd.bind(this));
    this.addListener(this.canvas, 'touchcancel', this.handleTouchEnd.bind(this));
    
    // Window events
    this.addListener(window, 'blur', this.handleBlur.bind(this));
  }
  
  addListener(target, event, handler) {
    target.addEventListener(event, handler, { passive: false });
    const key = `${event}_${target === document ? 'document' : target === window ? 'window' : 'canvas'}`;
    this.handlers.set(key, { target, event, handler });
  }
  
  // ========================================================================
  // MOUSE HANDLERS
  // ========================================================================
  
  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = e.clientX - rect.left;
    this.mouse.y = e.clientY - rect.top;
  }
  
  handleMouseDown(e) {
    if (e.button === 0) {
      this.mouse.leftButton = true;
      this.mouse.leftClick = true;
    } else if (e.button === 2) {
      this.mouse.rightButton = true;
      this.mouse.rightClick = true;
    }
  }
  
  handleMouseUp(e) {
    if (e.button === 0) {
      this.mouse.leftButton = false;
    } else if (e.button === 2) {
      this.mouse.rightButton = false;
    }
  }
  
  handleMouseEnter(e) {
    this.mouse.over = true;
  }
  
  handleMouseLeave(e) {
    this.mouse.over = false;
    this.mouse.leftButton = false;
    this.mouse.rightButton = false;
  }
  
  handleWheel(e) {
    e.preventDefault();
    this.wheelDelta = e.deltaY;
  }
  
  // ========================================================================
  // KEYBOARD HANDLERS
  // ========================================================================
  
  handleKeyDown(e) {
    const key = e.key.toLowerCase();
    
    // Sadece ilk basılışta pressed olur
    if (!this.keys[key]) {
      this.keyPressed[key] = true;
    }
    
    this.keys[key] = true;
  }
  
  handleKeyUp(e) {
    const key = e.key.toLowerCase();
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
    e.preventDefault();
    
    Array.from(e.touches).forEach(touch => {
      const rect = this.canvas.getBoundingClientRect();
      this.touches.set(touch.identifier, {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
        startX: touch.clientX - rect.left,
        startY: touch.clientY - rect.top,
      });
    });
    
    // İlk touch'ı left click gibi davran
    if (e.touches.length === 1) {
      this.mouse.leftClick = true;
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = touch.clientX - rect.left;
      this.mouse.y = touch.clientY - rect.top;
    }
  }
  
  handleTouchMove(e) {
    e.preventDefault();
    
    Array.from(e.touches).forEach(touch => {
      const stored = this.touches.get(touch.identifier);
      if (stored) {
        const rect = this.canvas.getBoundingClientRect();
        stored.x = touch.clientX - rect.left;
        stored.y = touch.clientY - rect.top;
      }
    });
    
    // İlk touch'ı mouse move gibi davran
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = touch.clientX - rect.left;
      this.mouse.y = touch.clientY - rect.top;
    }
  }
  
  handleTouchEnd(e) {
    e.preventDefault();
    
    Array.from(e.changedTouches).forEach(touch => {
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
    return Object.keys(this.keys).some(key => this.keys[key]);
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
    this.mouse.worldX = this.mouse.x + camera.x;
    this.mouse.worldY = this.mouse.y + camera.y;
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
    this.handlers.forEach(({ target, event, handler }) => {
      target.removeEventListener(event, handler);
    });
    this.handlers.clear();
    this.touches.clear();
    
    console.log('[Input] Destroyed');
  }
}

// Default export
export default InputManager;