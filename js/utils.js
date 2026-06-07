/**
 * FallOfCavalry - Utility Functions
 * Genel amaçlı yardımcı fonksiyonlar
 * BAĞIMLILIK: Sadece constants.js
 */

// =============================================================================
// MATH UTILITIES
// =============================================================================

/**
 * Değeri min-max arasında sınırla
 */
export const clamp = (value, min, max) => {
  return Math.max(min, Math.min(max, value));
};

/**
 * 0-1 arası sınırla
 */
export const clamp01 = (value) => {
  return clamp(value, 0, 1);
};

/**
 * Linear interpolation
 */
export const lerp = (a, b, t) => {
  return a + (b - a) * t;
};

/**
 * İki nokta arası mesafe
 */
export const distance = (x1, y1, x2, y2) => {
  return Math.hypot(x2 - x1, y2 - y1);
};

/**
 * Rastgele integer (inclusive)
 */
export const randInt = (min, max) => {
  return Math.floor(min + Math.random() * (max - min + 1));
};

/**
 * Rastgele float
 */
export const randFloat = (min, max) => {
  return min + Math.random() * (max - min);
};

/**
 * Rastgele boolean
 */
export const randBool = (probability = 0.5) => {
  return Math.random() < probability;
};

/**
 * Diziden rastgele eleman seç
 */
export const randChoice = (array) => {
  return array[Math.floor(Math.random() * array.length)];
};

/**
 * Açıyı -PI ile PI arasında normalize et
 */
export const normalizeAngle = (angle) => {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
};

/**
 * İki açı arasındaki kısa mesafe
 */
export const angleDiff = (a, b) => {
  return normalizeAngle(b - a);
};

// =============================================================================
// COLOR UTILITIES
// =============================================================================

/**
 * Hex rengi RGB objesine çevir
 */
export const hexToRgb = (hex) => {
  const safe = hex.replace('#', '');
  const full = safe.length === 3 
    ? safe.split('').map(c => c + c).join('') 
    : safe;
  const num = parseInt(full, 16);
  
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
};

/**
 * RGB objesini hex rengine çevir
 */
export const rgbToHex = (r, g, b) => {
  const toHex = (n) => {
    const clamped = clamp(Math.round(n), 0, 255);
    return clamped.toString(16).padStart(2, '0');
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/**
 * İki rengi karıştır (0-1 arası t)
 */
export const mixColors = (hex1, hex2, t) => {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  
  return rgbToHex(
    lerp(c1.r, c2.r, t),
    lerp(c1.g, c2.g, t),
    lerp(c1.b, c2.b, t)
  );
};

/**
 * Rengi aydınlat/koyulaştır
 * t > 0: aydınlatır (beyaza doğru)
 * t < 0: koyulaştırır (siyaha doğru)
 */
export const shade = (hex, t) => {
  const c = hexToRgb(hex);
  const k = clamp01(Math.abs(t));
  const target = t >= 0 ? 255 : 0;
  
  return rgbToHex(
    lerp(c.r, target, k),
    lerp(c.g, target, k),
    lerp(c.b, target, k)
  );
};

// =============================================================================
// STRING UTILITIES
// =============================================================================

/**
 * String'i hash'e çevir (seeded random için)
 */
export function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Sayıyı binlik ayırıcılarla formatla
 */
export const formatNumber = (num) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

/**
 * Capitalize first letter
 */
export const capitalize = (str) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Generate unique ID
 */
let idCounter = 0;
export const generateId = () => {
  return `id_${Date.now()}_${++idCounter}`;
};

// =============================================================================
// RANDOM NUMBER GENERATOR (Seeded)
// =============================================================================

/**
 * Mulberry32 - Fast seeded RNG
 * @param {number} seed - Seed value
 * @returns {function} RNG function that returns 0-1
 */
export function mulberry32(seed) {
  let t = seed >>> 0;
  return function() {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// =============================================================================
// CANVAS UTILITIES
// =============================================================================

/**
 * Rounded rectangle path (for older browsers)
 */
export function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  
  const rr = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
}

/**
 * Draw text with shadow
 */
export function drawTextShadow(ctx, text, x, y, color = '#fff', shadowColor = '#000') {
  ctx.save();
  
  // Shadow
  ctx.fillStyle = shadowColor;
  ctx.fillText(text, x + 2, y + 2);
  
  // Main text
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  
  ctx.restore();
}

// =============================================================================
// DOM UTILITIES
// =============================================================================


const warningState = {
  emitted: new Set(),
};

export function warnOnce(key, message) {
  if (warningState.emitted.has(key)) return;
  warningState.emitted.add(key);
  console.warn(message);
}

export function devLog(stateOrBool, ...args) {
  const enabled = typeof stateOrBool === 'boolean'
    ? stateOrBool
    : Boolean(stateOrBool && typeof stateOrBool === 'object' && stateOrBool.devMode);
  if (!enabled) return;
  console.log(...args);
}

/**
 * Güvenli element text setter
 */
export const safeText = (el, value) => {
  if (el && 'textContent' in el) {
    el.textContent = String(value ?? '');
  }
};

/**
 * Güvenli class toggle
 */
export const safeClass = (el, action, className) => {
  if (!el || !el.classList || typeof action !== 'string') return;

  const classAction = el.classList[action];
  if (typeof classAction !== 'function') return;

  classAction.call(el.classList, className);
};

/**
 * Güvenli attribute setter
 */
export const safeAttr = (el, attr, value) => {
  if (!el || typeof el.setAttribute !== 'function' || typeof attr !== 'string' || !attr) return;
  el.setAttribute(attr, value);
};

/**
 * Get element safely
 */
export const getEl = (id, options = null) => {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') {
    return null;
  }

  if (typeof id !== 'string' || !id) {
    return null;
  }

  const el = document.getElementById(id);
  const silent = Boolean(options && typeof options === 'object' && options.silent === true);
  if (!el && !silent) {
    warnOnce(`dom:missing:${id}`, `[DOM] Missing element id: ${id}`);
  }

  return el;
};

/**
 * Create element with attributes
 */
export const createElement = (tag, attrs = {}) => {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return null;
  }

  if (typeof tag !== 'string' || !tag) {
    return null;
  }

  const el = document.createElement(tag);
  const safeAttrs = attrs && typeof attrs === 'object' ? attrs : {};

  Object.entries(safeAttrs).forEach(([key, value]) => {
    if (key === 'class') {
      el.className = value;
    } else if (key === 'text') {
      el.textContent = value;
    } else if (key === 'html') {
      el.innerHTML = value;
    } else if (typeof key === 'string' && key) {
      el.setAttribute(key, value);
    }
  });
  return el;
};

// =============================================================================
// ARRAY UTILITIES
// =============================================================================

/**
 * Shuffle array (Fisher-Yates)
 */
export const shuffle = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/**
 * Remove item from array
 */
export const removeItem = (array, item) => {
  const index = array.indexOf(item);
  if (index > -1) {
    array.splice(index, 1);
  }
  return array;
};

/**
 * Chunk array into smaller arrays
 */
export const chunk = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

// =============================================================================
// TIME UTILITIES
// =============================================================================

/**
 * Format seconds to MM:SS
 */
export const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Debounce function
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function
 */
export const throttle = (func, limit) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

/**
 * Check if value is valid number
 */
export const isValidNumber = (value) => {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
};

/**
 * Check if object has all required keys
 */
export const hasRequiredKeys = (obj, keys) => {
  return keys.every(key => key in obj);
};

/**
 * Deep clone object (simple version)
 */
export const deepClone = (obj) => {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (err) {
    console.error('Deep clone failed:', err);
    return obj;
  }
};

// =============================================================================
// GRID/MAP UTILITIES
// =============================================================================

/**
 * Convert 2D coordinates to 1D index
 */
export const coordsToIndex = (x, y, width) => {
  return y * width + x;
};

/**
 * Convert 1D index to 2D coordinates
 */
export const indexToCoords = (index, width) => {
  return {
    x: index % width,
    y: Math.floor(index / width),
  };
};

/**
 * Check if coordinates are within bounds
 */
export const inBounds = (x, y, width, height) => {
  return x >= 0 && x < width && y >= 0 && y < height;
};

/**
 * Get neighbors (4-directional)
 */
export const getNeighbors4 = (x, y) => {
  return [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ];
};

/**
 * Get neighbors (8-directional)
 */
export const getNeighbors8 = (x, y) => {
  return [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
    { x: x + 1, y: y + 1 },
    { x: x + 1, y: y - 1 },
    { x: x - 1, y: y + 1 },
    { x: x - 1, y: y - 1 },
  ];
};

// =============================================================================
// EXPORT ALL
// =============================================================================

export default {
  // Math
  clamp,
  clamp01,
  lerp,
  distance,
  randInt,
  randFloat,
  randBool,
  randChoice,
  normalizeAngle,
  angleDiff,
  
  // Color
  hexToRgb,
  rgbToHex,
  mixColors,
  shade,
  
  // String
  hashStr,
  formatNumber,
  capitalize,
  generateId,
  
  // Random
  mulberry32,
  
  // Canvas
  roundRect,
  drawTextShadow,
  
  // DOM
  safeText,
  safeClass,
  safeAttr,
  getEl,
  createElement,
  warnOnce,
  
  // Array
  shuffle,
  removeItem,
  chunk,
  
  // Time
  formatTime,
  debounce,
  throttle,
  
  // Validation
  isValidNumber,
  hasRequiredKeys,
  deepClone,
  
  // Grid
  coordsToIndex,
  indexToCoords,
  inBounds,
  getNeighbors4,
  getNeighbors8,
};
