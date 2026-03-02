import * as CONST from '../constants.js';

export default class BattleCommandsUI {
  constructor({ onCommand, onToggle } = {}) {
    this.onCommand = typeof onCommand === 'function' ? onCommand : null;
    this.onToggle = typeof onToggle === 'function' ? onToggle : null;
    this.bound = false;
    this.activeCommand = null;
    this.toggles = { holdFire: false };
    this.dom = {};
  }

  bind({ root }) {
    if (this.bound) return;
    this.dom.root = root || null;
    if (!this.dom.root) return;

    this.dom.root.innerHTML = `
      <button class="action-btn btn-dark text-xs" data-cmd="${CONST.BATTLE_COMMANDS.HOLD}">[H] Hold</button>
      <button class="action-btn btn-dark text-xs" data-cmd="${CONST.BATTLE_COMMANDS.FOCUS}">[F] Focus</button>
      <button class="action-btn btn-dark text-xs" data-cmd="${CONST.BATTLE_COMMANDS.SKIRMISH}">[K] Skirmish</button>
      <button class="action-btn btn-dark text-xs" data-cmd="${CONST.BATTLE_COMMANDS.RETREAT}">[R] Retreat</button>
      <button class="action-btn btn-dark text-xs" data-toggle="hold-fire">[X] Hold Fire</button>
      <span class="text-xs opacity-70 px-2">[?] Help</span>
    `;

    this.dom.root.addEventListener('click', (e) => {
      const toggleBtn = e.target?.closest?.('[data-toggle]');
      if (toggleBtn) {
        const toggle = toggleBtn.dataset.toggle;
        const next = !Boolean(this.toggles.holdFire);
        this.setToggleState(toggle, next);
        this.onToggle?.(toggle, next);
        return;
      }

      const btn = e.target?.closest?.('[data-cmd]');
      if (!btn) return;
      const cmd = btn.dataset.cmd;
      this.setActiveCommand(cmd);
      this.onCommand?.(cmd);
    });

    this.bound = true;
  }

  show() { this.dom.root?.classList.remove('hidden'); }
  hide() { this.dom.root?.classList.add('hidden'); }

  setActiveCommand(cmd) {
    this.activeCommand = cmd;
    const buttons = this.dom.root?.querySelectorAll?.('[data-cmd]') || [];
    buttons.forEach((b) => {
      if (b.dataset.cmd === cmd) b.classList.add('is-active');
      else b.classList.remove('is-active');
    });
  }

  setToggleState(toggle, active) {
    if (toggle !== 'hold-fire') return;
    this.toggles.holdFire = Boolean(active);
    const button = this.dom.root?.querySelector?.('[data-toggle="hold-fire"]');
    if (!button) return;
    button.classList.toggle('is-active', this.toggles.holdFire);
    button.textContent = this.toggles.holdFire ? '[X] Hold Fire: ON' : '[X] Hold Fire: OFF';
  }
}
