import GameState from '../core/state.js';

export class StateManager {
  constructor() {
    this.state = new GameState();
  }

  get mode() {
    return this.state.mode;
  }

  setMode(newMode) {
    this.state.setMode(newMode);
  }

  save() {
    // Save logic - to be implemented in Phase 5
  }

  load(saveData) {
    // Load logic - to be implemented in Phase 5
  }
}
