/**
 * EncounterManager — Phase 10B
 * Encounter/roster flow logic extracted from main.js.
 */

export class EncounterManager {
  constructor(gameState) {
    this.state = gameState;
    this.game = null;
  }

  init(game) {
    this.game = game;
  }

  // ─── Phase 10B: Encounter & roster methods ───────────────────────────────────

  resolveEncounter(action) {
    const encounter = this.state?.encounter;
    if (!encounter?.enemyId || this.state?.mode !== 'encounter') return false;

    const g = this.game;
    const enemy = g.enemyParties.find((party) => party.id === encounter.enemyId);
    if (action === 'fight') {
      this.enterRoster(encounter.enemyId);
      return true;
    }

    this.finishEncounterToMap(enemy, encounter.enemyId);
    return true;
  }

  enterRoster(enemyId) {
    const g = this.game;
    if (!this.state || this.state.mode !== 'encounter') return false;
    g.playerRoster = (g.playerParty?.roster || []).map((unit, idx) => ({
      ...unit,
      status: unit?.status || 'healthy',
      selected: idx < g.maxUnitsToDeploy,
    }));
    g.enemyRoster = g.getEnemyUnits(enemyId).map((unit) => ({ ...unit, selected: true }));
    g.rosterCursorIndex = 0;

    if (!this.state.roster || typeof this.state.roster !== 'object') {
      this.state.roster = {};
    }

    this.state.roster.enemyId = enemyId;
    this.state.roster.warning = '';
    this.state.roster.maxDeploy = g.maxUnitsToDeploy;
    this.state.setMode('roster');
    g.updateTransientUIState();
    return true;
  }

  finishEncounterToMap(enemy, enemyId) {
    const g = this.game;
    this.applyEncounterPushback(enemy);
    g.cleanupTemporaryEnemy(enemyId);
    g.lastEncounterEndTimeByEnemyId[enemyId] = Date.now();
    if (this.state) {
      this.state.encounter = null;
      g.battleCommandsUI?.hide?.();
      this.state.setMode('map');
    }
  }

  applyEncounterPushback(enemy) {
    const g = this.game;
    if (!g.playerParty || !enemy) return;

    let dx = g.playerParty.x - enemy.x;
    let dy = g.playerParty.y - enemy.y;
    let dist = Math.hypot(dx, dy);

    if (dist < 0.001) {
      const angleSeed = (enemy.id?.length ?? 1) * 0.73;
      dx = Math.cos(angleSeed);
      dy = Math.sin(angleSeed);
      dist = 1;
    }

    const ux = dx / dist;
    const uy = dy / dist;
    const halfPush = g.encounterPushbackDistance / 2;

    const playerTarget = g.clampToWorld(
      g.playerParty.x + ux * halfPush,
      g.playerParty.y + uy * halfPush,
    );
    const enemyTarget = g.clampToWorld(
      enemy.x - ux * halfPush,
      enemy.y - uy * halfPush,
    );

    g.playerParty.x = playerTarget.x;
    g.playerParty.y = playerTarget.y;
    enemy.x = enemyTarget.x;
    enemy.y = enemyTarget.y;
  }

  moveRosterCursor(delta) {
    const g = this.game;
    if (!Array.isArray(g.playerRoster) || g.playerRoster.length === 0) return false;
    const next = g.rosterCursorIndex + delta;
    g.rosterCursorIndex = Math.max(0, Math.min(g.playerRoster.length - 1, next));
    g.updateTransientUIState();
    return true;
  }

  toggleRosterSelectionAtCursor() {
    const g = this.game;
    if (!Array.isArray(g.playerRoster) || g.playerRoster.length === 0) return false;
    const unit = g.playerRoster[g.rosterCursorIndex];
    if (!unit || g.getEffectiveCount(unit) <= 0) return false;

    if (unit.selected) {
      unit.selected = false;
      if (this.state?.roster) this.state.roster.warning = '';
      g.updateTransientUIState();
      return true;
    }

    const selected = g.getSelectedRosterCount();
    if (selected >= g.maxUnitsToDeploy) {
      if (this.state?.roster) this.state.roster.warning = `Deploy limit reached (${g.maxUnitsToDeploy}).`;
      g.updateTransientUIState();
      return false;
    }

    unit.selected = true;
    if (this.state?.roster) this.state.roster.warning = '';
    g.updateTransientUIState();
    return true;
  }

  buildAftermathPanelData() {
    const g = this.game;
    const a = this.state?.aftermath;
    if (!a) return { title: 'Battle Aftermath', body: 'No aftermath data', footer: 'Enter = Continue' };

    const outcomeText = String(a.result || '').toLowerCase() === 'victory' ? 'Victory' : 'Defeat';
    const lootLines = (a.loot || []).map((l) => `- ${g.getItemName(l.id)} x${Math.max(1, Math.floor(l.qty ?? 1))}`).join('\n') || '- None';

    return {
      title: 'Battle Aftermath',
      body: `Outcome: ${outcomeText}

Casualties
- Dead: ${a.casualties?.dead ?? 0}
- Wounded: ${a.casualties?.wounded ?? 0}

Loot
- Gold gained: +${Math.max(0, Math.floor(a.goldDelta ?? 0))}
${lootLines}

Renown
- +${Math.max(0, Math.floor(a.renownDelta ?? 0))} renown
- New total: ${Math.max(0, Math.floor(a.renownTotal ?? g.playerParty?.renown ?? 0))}`,
      footer: 'Continue: Enter / Esc / T / L',
    };
  }
}
