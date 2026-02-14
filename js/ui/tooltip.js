/**
 * FallOfCavalry - Tooltip Manager
 */

import { getEl, safeText, safeClass } from '../utils.js';

export class TooltipManager {
  constructor() {
    this.element = getEl('tooltip');
    this.visible = false;
    this.timer = null;
  }
  
  show(text, x, y, delay = 0) {
    if (!this.element) return;
    
    clearTimeout(this.timer);
    
    if (delay > 0) {
      this.timer = setTimeout(() => {
        this.showImmediate(text, x, y);
      }, delay);
    } else {
      this.showImmediate(text, x, y);
    }
  }
  
  showImmediate(text, x, y) {
    if (!this.element) return;
    
    safeText(this.element, text);
    safeClass(this.element, 'remove', 'hidden');
    
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
    
    this.visible = true;
  }
  
  hide() {
    if (!this.element) return;
    
    clearTimeout(this.timer);
    safeClass(this.element, 'add', 'hidden');
    this.visible = false;
  }
  
  update(text, x, y) {
    if (this.visible) {
      this.showImmediate(text, x, y);
    }
  }
  
  isVisible() {
    return this.visible;
  }
}

export default TooltipManager;