/**
 * RenderManager — Phase 7
 * Canvas render methods extracted from main.js (renderStart, renderEncounter,
 * renderCity, renderDebugInfo, renderWorldTerrain, renderMap, renderWorldOverlays).
 * renderBattle() stays as a delegation wrapper in main.js.
 */

import { isCurrentEventsModalOpen, renderCurrentEventsModal } from '../ui/modals.js';

export class RenderManager {
  constructor(gameState) {
    this.state = gameState;
    this.game = null;
  }

  init(game) {
    this.game = game;
  }

  // ─── 7A: Simple render screens ──────────────────────────────────────────────

  renderStart() {
    const g = this.game;
    if (!g.ctx || !g.canvas) return;
    g.ctx.fillStyle = '#000';
    g.ctx.fillRect(0, 0, g.canvas.width, g.canvas.height);
    g.ctx.fillStyle = '#fff';
    g.ctx.font = '48px "Cinzel", serif';
    g.ctx.textAlign = 'center';
    g.ctx.fillText('FallOfCavalry', g.canvas.width / 2, g.canvas.height / 2);
    g.ctx.font = '24px "Crimson Text", serif';
    g.ctx.fillText('Select your faction to begin', g.canvas.width / 2, g.canvas.height / 2 + 60);
  }

  renderEncounter() {
    const g = this.game;
    if (!g.ctx || !g.canvas) return;

    g.ctx.fillStyle = '#171717';
    g.ctx.fillRect(0, 0, g.canvas.width, g.canvas.height);

    const enemyId = this.state?.encounter?.enemyId ?? 'unknown';
    g.ctx.fillStyle = '#ffffff';
    g.ctx.textAlign = 'center';
    g.ctx.font = '40px Arial';
    g.ctx.fillText('Encounter!', g.canvas.width / 2, g.canvas.height / 2 - 20);
    g.ctx.font = '22px Arial';
    g.ctx.fillText(`Enemy: ${enemyId}`, g.canvas.width / 2, g.canvas.height / 2 + 18);
    g.ctx.font = '18px Arial';
    g.ctx.fillText('F = Battle Prep, C = Continue', g.canvas.width / 2, g.canvas.height / 2 + 56);
    if (isCurrentEventsModalOpen()) {
      const currentEvents = g.refreshCurrentEventsSummary(this.state?.day ?? 1);
      renderCurrentEventsModal({ events: currentEvents, currentDay: this.state?.day ?? 1 });
    }
    g.hudManager?.update?.();
  }

  renderCity() {
    const g = this.game;
    if (!g.ctx || !g.canvas) return;
    g.ctx.fillStyle = '#2a2a2a';
    g.ctx.fillRect(0, 0, g.canvas.width, g.canvas.height);
    g.ctx.fillStyle = '#fff';
    g.ctx.font = '28px Arial';
    g.ctx.textAlign = 'center';
    g.ctx.fillText('City Services', g.canvas.width / 2, g.canvas.height / 2 - 12);
    g.ctx.font = '16px Arial';
    g.ctx.fillText('R Recruit  T Market  H Healer  |  E/Esc leave city', g.canvas.width / 2, g.canvas.height / 2 + 18);
    g.updateTransientUIState();
  }

  renderDebugInfo() {
    const g = this.game;
    if (!this.state || !g.input) return;

    const lines = [
      `FPS: ${this.state.debug.fps.toFixed(0)}`,
      `Mode: ${this.state.mode}`,
      `Day: ${this.state.day}`,
      `Gold: ${this.state.player.gold}`,
      `Mouse: (${g.input.mouse.x.toFixed(0)}, ${g.input.mouse.y.toFixed(0)})`,
    ];

    if (g.dom.debugOverlay) {
      const infoEl = g.dom.debugOverlay.querySelector?.('#debugInfo');
      if (infoEl) infoEl.textContent = lines.join('\n');
      else g.dom.debugOverlay.textContent = lines.join('\n');
    }
  }
}
