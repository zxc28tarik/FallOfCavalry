/**
 * FallOfCavalry - Modal Manager
 * Modal pencere yönetimi
 */

import { getEl, safeClass } from '../utils.js';

export class ModalManager {
  constructor() {
    this.modals = new Map();
    this.currentModal = null;
  }
  
  register(id, element) {
    if (!element) {
      element = getEl(id);
    }
    
    if (element) {
      this.modals.set(id, element);
    }
  }
  
  open(id) {
    const modal = this.modals.get(id);
    if (!modal) {
      console.warn('[ModalManager] Modal not found:', id);
      return;
    }
    
    // Close current modal
    if (this.currentModal) {
      this.close(this.currentModal);
    }
    
    safeClass(modal, 'remove', 'hidden');
    this.currentModal = id;
    
    console.log('[ModalManager] Opened:', id);
  }
  
  close(id) {
    const modal = this.modals.get(id);
    if (!modal) return;
    
    safeClass(modal, 'add', 'hidden');
    
    if (this.currentModal === id) {
      this.currentModal = null;
    }
    
    console.log('[ModalManager] Closed:', id);
  }
  
  closeAll() {
    this.modals.forEach((modal, id) => {
      this.close(id);
    });
  }
  
  isOpen(id) {
    return this.currentModal === id;
  }
  
  toggle(id) {
    if (this.isOpen(id)) {
      this.close(id);
    } else {
      this.open(id);
    }
  }
}

export default ModalManager;