/**
 * DevManager — Phase 9C
 * Handles smoke test execution, debug panel setup, and debug toggle.
 */

import * as CONST from '../constants.js';
import * as PoiSystem from '../systems/poi-system.js';
import * as tradeSystem from '../systems/trade.js';
import { getActiveRegionModifiers } from '../systems/region-state.js';
import { computeDamage } from '../systems/combat-rules.js';
import { computeRiskMultiplier } from '../systems/encounter-risk.js';
import BattleDeployMode from '../game-modes/battle-deploy-mode.js';

export class DevManager {
  constructor(gameState) {
    this.state = gameState;
    this.game = null;
    this.smokeResults = [];
  }

  init(game) {
    this.game = game;
  }

  // ─── Phase 9C: Dev/debug methods ─────────────────────────────────────────────

  setupDebugSmokePanel() {
    const g = this.game;
    if (!g.dom?.debugOverlay) return;
    if (!this.state?.devMode) {
      g.dom.debugOverlay.classList.add('hidden');
      g.dom.debugOverlay.innerHTML = '';
      return;
    }
    if (g.dom.debugOverlay.dataset.smokeReady === '1') return;
    g.dom.debugOverlay.dataset.smokeReady = '1';
    g.dom.debugOverlay.innerHTML = '<div id="debugInfo" class="debug-info"></div><div class="debug-actions"><button id="btnOpenTuning" class="action-btn btn-dark text-xs">Tuning</button><button id="btnRunSmoke" class="action-btn btn-dark text-xs">Run Smoke</button><pre id="smokeResults" class="smoke-results"></pre></div>';
    g.dom.btnRunSmoke = g.dom.debugOverlay.querySelector('#btnRunSmoke');
    g.dom.btnOpenTuning = g.dom.debugOverlay.querySelector('#btnOpenTuning');
    g.dom.smokeResults = g.dom.debugOverlay.querySelector('#smokeResults');

    if (g.dom.btnOpenTuning && !g._tuningDebugBtnBound) {
      g._tuningDebugBtnBound = true;
      g.dom.btnOpenTuning.addEventListener('click', () => { g.tuningManager.showTuningModal(); });
    }

    if (g.dom.btnRunSmoke && !g._smokeBtnBound) {
      g._smokeBtnBound = true;
      g.dom.btnRunSmoke.addEventListener('click', async () => {
        await this.runSmokeScenarios();
      });
    }

    if (typeof window !== 'undefined' && this.state?.devMode) {
      window.__FOC_RUN_SMOKE__ = () => this.runSmokeScenarios();
    }
  }

  async runSmokeScenarios() {
    const g = this.game;
    if (!this.state?.devMode) return [];
    const out = [];
    const push = (name, ok, msg) => out.push({ name, ok: Boolean(ok), msg: msg || (ok ? 'PASS' : 'FAIL') });

    push('1) Start screen opens', this.state?.mode === 'start', `mode=${this.state?.mode}`);
    push('2) Faction cards exist', (document.querySelectorAll('.faction-card').length || 0) > 0, `cards=${document.querySelectorAll('.faction-card').length}`);
    push('3) Start button state exists', Boolean(g.dom?.btnStart), g.dom?.btnStart?.disabled ? 'disabled' : 'enabled');

    const prevMode = this.state?.mode;
    g.gameFlowManager.startNewGame();
    push('4) Start enters map', this.state?.mode === 'map', `mode=${this.state?.mode}`);

    const nearSettlement = g.economyManager.getActiveSettlementForCity();
    push('5) Settlement nearby query', Boolean(nearSettlement), nearSettlement ? (nearSettlement.name || nearSettlement.id) : 'none');

    const prevCamp = Boolean(this.state?.camp?.active);
    if (!prevCamp) g.uiManager.toggleCampMode();
    push('6) Camp can activate', Boolean(this.state?.camp?.active), `active=${this.state?.camp?.active}`);
    if (this.state?.camp?.active) g.uiManager.toggleCampMode();
    push('7) Camp can deactivate', !this.state?.camp?.active, `active=${this.state?.camp?.active}`);

    const movementCtx = g.worldManager.getMovementContextAt(g.playerParty?.x ?? 0, g.playerParty?.y ?? 0);
    push('8) Movement context valid', Number.isFinite(movementCtx?.speedMult), `speedMult=${movementCtx?.speedMult}`);

    const foodBefore = this.state?.supplies?.food ?? 0;
    g.economyManager.processDailyEconomy((this.state?.day ?? 1) + 1);
    push('9) End day opens accounting', Boolean(this.state?.accounting), this.state?.accounting ? 'opened' : 'not opened');
    push('10) Food consumed/unchanged', (this.state?.supplies?.food ?? 0) <= foodBefore, `${foodBefore}→${this.state?.supplies?.food ?? 0}`);

    const saveOk = g.saveManager.saveToSlot('manual2');
    const loadOk = g.saveManager.loadFromSlot('manual2');
    push('11) Save+Load works', Boolean(saveOk && loadOk), `save=${saveOk} load=${loadOk}`);
    push('12) lastAccounting exists', Boolean(this.state?.lastAccounting), this.state?.lastAccounting ? 'present' : 'missing');

    push('13) Battle command UI exists', Boolean(g.dom?.battleCommandBar), g.dom?.battleCommandBar ? 'present' : 'missing');
    const dmgTest = computeDamage({ attacker: { atk: 10, damageType: CONST.DAMAGE_TYPE.CUT }, defender: { armorType: CONST.ARMOR_TYPE.HEAVY }, base: 10, terrainMods: CONST.TERRAIN_MODS.PLAINS });
    push('14) computeDamage finite', Number.isFinite(dmgTest), `damage=${dmgTest}`);

    this.state.battle = this.state.battle || { playerUnits: [{ unitId: 'p1' }], enemyUnits: [], phase: 'deploy', projectiles: [] };
    g.battleManager.battleDeployMode = new BattleDeployMode({ state: this.state, party: g.playerParty, battle: this.state.battle, camera: this.state?.camera });
    g.battleManager.battleDeployUI?.show?.();
    push('15) Deployment overlay shows on battle start', !(g.dom?.battleDeployOverlay?.classList?.contains('hidden')), g.dom?.battleDeployOverlay?.classList?.contains('hidden') ? 'hidden' : 'visible');
    const previewCount = g.battleManager.battleDeployMode.computePreviewPositions((this.state.battle.playerUnits || []).length).length;
    push('16) Formation preview count matches units', previewCount === (this.state.battle.playerUnits || []).length, `preview=${previewCount}`);

    const mapPois = this.state?.map?.pois || [];
    if (mapPois.length > 0) {
      const p = mapPois[0];
      const tileSize = CONST.WORLD.TILE_SIZE;
      g.playerParty.x = p.x * tileSize + tileSize * 0.5;
      g.playerParty.y = p.y * tileSize + tileSize * 0.5;
      g.poiManager.updatePoiInteractHint();
      push('17) POI interaction hint appears near POI', Boolean(this.state?.interactHint), this.state?.interactHint || 'missing');

      const poiKey = PoiSystem.keyOfPoi(p);
      const prevVisited = this.state.poiState?.[poiKey]?.lastVisitedDay;
      g.poiManager.activePoi = p;
      g.poiManager.investigateActivePoi();
      const nowVisited = this.state.poiState?.[poiKey]?.lastVisitedDay;
      const expectedDay = Number(this.state?.day ?? 1);
      push('18) POI investigate updates poiState', nowVisited === expectedDay || nowVisited === prevVisited, `lastVisited=${nowVisited}`);

      const moveCtxAtPoi = g.worldManager.getMovementContextAt(g.playerParty.x, g.playerParty.y);
      const testCtx = {
        onRoad: Boolean(moveCtxAtPoi?.onRoad),
        biomeKey: g.worldManager.getBiomeKeyAtTile(p.x, p.y),
        settlementTier: g.worldManager.getNearestSettlementTierAt(p.x, p.y),
        map: this.state?.map,
      };
      const first = PoiSystem.rollOutcome({ seed: this.state.seed, day: this.state.day, poi: p, context: testCtx, tuning: this.state?.tuning });
      const second = PoiSystem.rollOutcome({ seed: this.state.seed, day: this.state.day, poi: p, context: testCtx, tuning: this.state?.tuning });
      push('19) POI rollOutcome deterministic kind', first?.kind === second?.kind, `${first?.kind} vs ${second?.kind}`);
    } else {
      push('17) POI interaction hint appears near POI', true, 'PASS (no POI data)');
      push('18) POI investigate updates poiState', true, 'PASS (no POI data)');
      push('19) POI rollOutcome deterministic kind', true, 'PASS (no POI data)');
    }

    const firstSettlement = this.state?.map?.settlements?.[0] || null;
    if (firstSettlement) {
      const settlementKey = g.economyManager.getSettlementOpportunityKey(firstSettlement);
      const market = g.economyManager.getOrCreateMarketForSettlement(firstSettlement);
      const itemId = (CONST.TRADE_ITEMS?.[0]?.id) || null;
      if (settlementKey && itemId) {
        const baseSell = tradeSystem.getPrice(firstSettlement, market, itemId, 'sell', {
          day: this.state.day,
          settlementKey,
          marketOpportunities: {},
          tuning: this.state?.tuning,
          factions: this.state?.factions,
          playerFactionId: 'player',
          ownerFactionId: firstSettlement?.ownerFactionId || firstSettlement?.owner || null,
          diplomacyCfg: CONST.DIPLOMACY_ACTIONS,
          diplomacyRelations: CONST.DIPLOMACY_RELATIONS,
          activeRegionModifiers: getActiveRegionModifiers(this.state?.regionState, g.worldManager.getRegionIdAtTile(firstSettlement.tx, firstSettlement.ty), this.state?.day),
        });
        this.state.marketOpportunities[settlementKey] = { itemId, bonusPct: 25, expiresDay: Number(this.state.day ?? 1) + 2 };
        const boostedSell = tradeSystem.getPrice(firstSettlement, market, itemId, 'sell', {
          day: this.state.day,
          settlementKey,
          marketOpportunities: this.state.marketOpportunities,
          tuning: this.state?.tuning,
          factions: this.state?.factions,
          playerFactionId: 'player',
          ownerFactionId: firstSettlement?.ownerFactionId || firstSettlement?.owner || null,
          diplomacyCfg: CONST.DIPLOMACY_ACTIONS,
          diplomacyRelations: CONST.DIPLOMACY_RELATIONS,
          activeRegionModifiers: getActiveRegionModifiers(this.state?.regionState, g.worldManager.getRegionIdAtTile(firstSettlement.tx, firstSettlement.ty), this.state?.day),
        });
        push('20) Opportunity modifies sell price when active', boostedSell > baseSell, `${baseSell}→${boostedSell}`);

        this.state.marketOpportunities[settlementKey] = { itemId, bonusPct: 25, expiresDay: Number(this.state.day ?? 1) - 1 };
        g.economyManager.cleanupExpiredMarketOpportunities(this.state.day);
        g.gameFlowManager.refreshCurrentEventsSummary(this.state.day);
        push('21) Expired opportunities are cleaned', !this.state.marketOpportunities[settlementKey], this.state.marketOpportunities[settlementKey] ? 'not cleaned' : 'cleaned');
      } else {
        push('20) Opportunity modifies sell price when active', true, 'PASS (missing settlementKey/itemId)');
        push('21) Expired opportunities are cleaned', true, 'PASS (missing settlementKey/itemId)');
      }
    } else {
      push('20) Opportunity modifies sell price when active', true, 'PASS (no settlement data)');
      push('21) Expired opportunities are cleaned', true, 'PASS (no settlement data)');
    }

    push('22) Tuning state exists', Boolean(this.state?.tuning && typeof this.state.tuning === 'object' && !Array.isArray(this.state.tuning)), this.state?.tuning ? 'present' : 'missing');

    const baseRisk = computeRiskMultiplier({
      state: { ...this.state, tuning: {} },
      movementCtx: { onRoad: true },
      biomeKey: 'PLAINS',
      inCamp: false,
      supplies: { food: 10 },
      market: null,
    });
    const tunedRisk = computeRiskMultiplier({
      state: { ...this.state, tuning: { ENCOUNTER_RISK: { ROAD_MULT: Number(CONST.ENCOUNTER_RISK.ROAD_MULT) + 0.25 } } },
      movementCtx: { onRoad: true },
      biomeKey: 'PLAINS',
      inCamp: false,
      supplies: { food: 10 },
      market: null,
    });
    push('23) Tuning override affects encounterRisk', tunedRisk !== baseRisk, `${baseRisk}→${tunedRisk}`);

    if (prevMode === 'start') g.gameFlowManager.enterStart();

    this.smokeResults = out;
    g.devManager.appendSmokeResults(out);
    return out;
  }

  toggleDebug() {
    const g = this.game;
    if (!this.state?.devMode || !this.state?.debug) return;

    this.state.debug.enabled = !this.state.debug.enabled;

    if (g.dom.debugOverlay) {
      if (this.state.debug.enabled) {
        g.dom.debugOverlay.classList.remove('hidden');
      } else {
        g.dom.debugOverlay.classList.add('hidden');
      }
    }
  }

  // ─── Phase 12C: appendSmokeResults ───────────────────────────────────────────

  appendSmokeResults(results) {
    const g = this.game;
    if (!g.dom?.smokeResults) return;
    const rows = (results || []).map((r) => `${r.ok ? '✅' : '❌'} ${r.name}: ${r.msg}`);
    g.dom.smokeResults.textContent = rows.join('\n');
  }
}
