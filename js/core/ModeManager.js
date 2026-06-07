export class ModeManager {
  constructor(state) {
    this.state = state;
    this.currentMode = state?.mode ?? null;
    this.previousMode = null;
    this.context = null;
    this.overlayStack = [];

    if (state && typeof state === 'object') {
      state.modeManager = this;
    }
  }

  switchTo(modeName, context = {}) {
    this.previousMode = this.currentMode;
    this.context = { returnTarget: this.previousMode, ...context };
    this.currentMode = modeName;
    if (typeof this.state.setMode === 'function') {
      this.state.setMode(modeName);
    } else {
      Object.assign(this.state, { mode: modeName });
    }
    this.state.emit?.('mode:switched', { from: this.previousMode, to: modeName, context: this.context });
  }

  pushOverlay(panelName, context = {}) {
    this.overlayStack.push({ name: panelName, context });
    this.state.emit?.('overlay:pushed', { panel: panelName, context });
  }

  popOverlay() {
    const panel = this.overlayStack.pop();
    this.state.emit?.('overlay:popped', { panel });
  }

  getReturnTarget() {
    return this.context?.returnTarget || 'map';
  }
}

export function ensureModeManager(state) {
  if (!state || typeof state !== 'object') return null;
  if (state.modeManager instanceof ModeManager) return state.modeManager;
  return new ModeManager(state);
}

export default ModeManager;
