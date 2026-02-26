import * as CONST from '../constants.js';

export default class BattleCommandsUI {
  constructor({ onCommand } = {}) {
    this.onCommand = typeof onCommand === 'function' ? onCommand : null;
    this.bound = false;
    this.activeCommand = null;
    this.dom = {};
  }

  bind({ root }) {
    if (this.bound) return;
    this.dom.root = root || null;
    if (!this.dom.root) return;

    this.dom.root.innerHTML = `
      <button class="action-btn btn-dark text-xs" data-cmd="${CONST.BATTLE_COMMANDS.HOLD}">[H] Hold</button>
      <button class="action-btn btn-dark text-xs" data-cmd="${CONST.BATTLE_COMMANDS.SKIRMISH}">[K] Skirmish</button>
      <button class="action-btn btn-dark text-xs" data-cmd="${CONST.BATTLE_COMMANDS.FOCUS}">[F] Focus</button>
      <button class="action-btn btn-dark text-xs" data-cmd="${CONST.BATTLE_COMMANDS.RETREAT}">[R] Retreat</button>
    `;

    this.dom.root.addEventListener('click', (e) => {
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
}
