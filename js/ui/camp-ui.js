export default class CampUI {
  constructor({ state, onClose, onSetWatch }) {
    this.state = state;
    this.onClose = onClose;
    this.onSetWatch = onSetWatch;
    this.bound = false;
    this.dom = {};
  }

  bind(dom) {
    if (this.bound) return;
    this.bound = true;
    this.dom = dom || {};

    this.dom.closeBtn?.addEventListener('click', () => this.onClose?.());
    this.dom.root?.addEventListener('click', (event) => {
      const btn = event.target?.closest?.('[data-watch-level]');
      if (!btn) return;
      this.onSetWatch?.(btn.dataset.watchLevel);
      this.refresh();
    });
  }

  show(info = {}) {
    this.refresh(info);
    this.dom.root?.classList.remove('hidden');
  }

  hide() {
    this.dom.root?.classList.add('hidden');
  }

  refresh(info = {}) {
    const watch = this.state?.camp?.watch || 'med';
    const food = Number(this.state?.supplies?.food ?? 0).toFixed(1);
    if (this.dom.status) {
      this.dom.status.textContent = `Food: ${food} | Carry: ${info.weight ?? 0}/${info.capacity ?? 0} | Raid: ${info.raidChance ?? '0%'} | Watch: ${watch}`;
    }

    if (this.dom.root) {
      this.dom.root.querySelectorAll('[data-watch-level]').forEach((el) => {
        const active = el.dataset.watchLevel === watch;
        el.classList.toggle('btn-gold', active);
        el.classList.toggle('btn-dark', !active);
      });
    }
  }
}
