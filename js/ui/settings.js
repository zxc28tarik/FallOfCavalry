import { applySettingsPatch } from '../systems/settings.js';

export default class SettingsUI {
  constructor({ getSettings, onApply, cfg, onClose } = {}) {
    this.getSettings = typeof getSettings === 'function' ? getSettings : (() => ({}));
    this.onApply = typeof onApply === 'function' ? onApply : null;
    this.cfg = cfg || {};
    this.onClose = typeof onClose === 'function' ? onClose : null;
    this.dom = {};
    this.visible = false;
  }

  bind() {
    if (this.dom.root) return;
    const root = document.createElement('div');
    root.className = 'modal-wrap hidden';
    root.id = 'settingsRuntimeOverlay';
    root.innerHTML = `
      <div class="modal-card max-w-xl">
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="royal-font text-2xl font-extrabold">Settings</div>
            <div class="mt-1 text-sm opacity-85">FX, kamera, hava ve zorluk.</div>
          </div>
          <button data-role="close" class="action-btn btn-dark">Kapat</button>
        </div>
        <div class="mt-4 flex flex-col gap-3 text-sm">
          <label class="flex items-center justify-between"><span>FX</span><input data-role="fx" type="checkbox" /></label>
          <label class="flex items-center justify-between"><span>Camera Shake</span><input data-role="shake" type="checkbox" /></label>
          <label class="flex items-center justify-between"><span>Weather Overlay</span><input data-role="weather" type="checkbox" /></label>
          <div>
            <div class="mb-2">Difficulty</div>
            <div class="flex gap-2">
              <button data-role="difficulty" data-value="0.8" class="action-btn btn-dark text-xs">Easy</button>
              <button data-role="difficulty" data-value="1.0" class="action-btn btn-dark text-xs">Normal</button>
              <button data-role="difficulty" data-value="1.3" class="action-btn btn-dark text-xs">Hard</button>
            </div>
            <div data-role="difficulty-readout" class="text-xs mt-2 opacity-75"></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(root);
    this.dom.root = root;
    this.dom.fx = root.querySelector('[data-role="fx"]');
    this.dom.shake = root.querySelector('[data-role="shake"]');
    this.dom.weather = root.querySelector('[data-role="weather"]');
    this.dom.close = root.querySelector('[data-role="close"]');
    this.dom.difficultyButtons = Array.from(root.querySelectorAll('[data-role="difficulty"]'));
    this.dom.difficultyReadout = root.querySelector('[data-role="difficulty-readout"]');

    this.dom.close?.addEventListener('click', () => this.hide());
    this.dom.fx?.addEventListener('change', (e) => this.patch({ fxEnabled: Boolean(e.target.checked) }));
    this.dom.shake?.addEventListener('change', (e) => this.patch({ cameraShakeEnabled: Boolean(e.target.checked) }));
    this.dom.weather?.addEventListener('change', (e) => this.patch({ weatherEnabled: Boolean(e.target.checked) }));
    this.dom.difficultyButtons.forEach((btn) => {
      btn.addEventListener('click', () => this.patch({ difficultyMult: Number(btn.dataset.value) }));
    });
  }

  patch(patch) {
    const settings = applySettingsPatch(this.getSettings(), patch, this.cfg);
    this.onApply?.(settings);
    this.syncFromState();
  }

  syncFromState() {
    const settings = this.getSettings() || {};
    if (this.dom.fx) this.dom.fx.checked = Boolean(settings.fxEnabled);
    if (this.dom.shake) this.dom.shake.checked = Boolean(settings.cameraShakeEnabled);
    if (this.dom.weather) this.dom.weather.checked = Boolean(settings.weatherEnabled);
    const diff = Number(settings.difficultyMult ?? 1);
    this.dom.difficultyButtons?.forEach((btn) => {
      const isActive = Math.abs(Number(btn.dataset.value) - diff) < 0.001;
      btn.classList.toggle('is-active', isActive);
    });
    if (this.dom.difficultyReadout) this.dom.difficultyReadout.textContent = `Multiplier: x${diff.toFixed(1)}`;
  }

  show() {
    this.bind();
    this.visible = true;
    this.syncFromState();
    this.dom.root?.classList.remove('hidden');
  }

  hide() {
    this.visible = false;
    this.dom.root?.classList.add('hidden');
    this.onClose?.();
  }

  toggle() {
    if (this.visible) this.hide();
    else this.show();
  }
}
