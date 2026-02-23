import * as CONST from '../constants.js';

export default class BattleDeployUI {
  constructor({ onStart, onCancel } = {}) {
    this.onStart = typeof onStart === 'function' ? onStart : null;
    this.onCancel = typeof onCancel === 'function' ? onCancel : null;
    this.bound = false;
    this.dom = {};
  }

  bind({ root, btnStart, btnCancel, hintText }) {
    if (this.bound) return;
    this.dom.root = root || null;
    this.dom.btnStart = btnStart || null;
    this.dom.btnCancel = btnCancel || null;
    this.dom.hintText = hintText || null;

    if (this.dom.btnStart) this.dom.btnStart.addEventListener('click', () => this.onStart?.());
    if (this.dom.btnCancel) this.dom.btnCancel.addEventListener('click', () => this.onCancel?.());

    this.bound = true;
    this.setHint(`Deployment: 1 ${CONST.FORMATION.LINE}, 2 ${CONST.FORMATION.COLUMN}, 3 ${CONST.FORMATION.WEDGE}, 4 ${CONST.FORMATION.SCATTER} | Q/E rotate | Click place | Enter start`);
  }

  show() { this.dom.root?.classList.remove('hidden'); }
  hide() { this.dom.root?.classList.add('hidden'); }
  setFormation(active) { this.dom.root?.setAttribute?.('data-formation', String(active || '')); }
  setHint(text) { if (this.dom.hintText) this.dom.hintText.textContent = text || ''; }
}
