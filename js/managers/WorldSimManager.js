import * as CONST from '../constants.js';
import { getStance } from '../systems/factions.js';
import { computeRiskMultiplier, riskLabel } from '../systems/encounter-risk.js';
import { ensureWorldParties, createInitialWorldAiState, updateWorldParties, getBanditCap } from '../systems/world-ai.js';
import { getBanditCapFromEvents } from '../systems/events.js';
import { tickWeatherLayer } from '../rendering/weather-layer.js';
import { isCurrentEventsModalOpen, renderCurrentEventsModal } from '../ui/modals.js';
import { setContractsRuntimeContext } from '../systems/contracts.js';
import { createInitialRegionState, getActiveRegionModifiers } from '../systems/region-state.js';

export class WorldSimManager {
  constructor() {
    this.world = null;
    this.game = null;
    this.cameraPanVelocity = { x: 0, y: 0 };
  }
  init(world, game) { this.world = world; this.game = game; }

  hasTypingFocus() {
    if (typeof document === 'undefined') return false;
    const active = document.activeElement;
    if (!active || typeof active !== 'object') return false;
    if (active.isContentEditable) return true;
    const tag = String(active.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  getMapCameraPanInput() {
    const input = this.game?.input;
    const canvas = this.game?.canvas;
    const allowKeyboard = !this.hasTypingFocus();
    let moveX = 0;
    let moveY = 0;

    if (input && allowKeyboard) {
      if (input.isKeyDown('arrowleft')) moveX -= 1;
      if (input.isKeyDown('arrowright')) moveX += 1;
      if (input.isKeyDown('arrowup')) moveY -= 1;
      if (input.isKeyDown('arrowdown')) moveY += 1;
    }

    const mouse = input?.mouse;
    const canEdgePan = Boolean(
      mouse?.over
      && canvas
      && Number.isFinite(canvas.width)
      && Number.isFinite(canvas.height)
      && Number.isFinite(mouse.x)
      && Number.isFinite(mouse.y),
    );

    if (canEdgePan) {
      const edgeZone = Math.max(14, Math.min(42, Math.round(Math.min(canvas.width, canvas.height) * 0.024)));
      const rightDist = canvas.width - mouse.x;
      const bottomDist = canvas.height - mouse.y;
      const edgePow = 1.35;
      const toWeight = (distance) => {
        if (!Number.isFinite(distance) || distance >= edgeZone) return 0;
        const t = Math.max(0, Math.min(1, (edgeZone - distance) / edgeZone));
        return t ** edgePow;
      };

      moveX += toWeight(rightDist);
      moveX -= toWeight(mouse.x);
      moveY += toWeight(bottomDist);
      moveY -= toWeight(mouse.y);
    }

    const magnitude = Math.hypot(moveX, moveY);
    if (magnitude > 1e-6) {
      const inv = 1 / Math.max(1, magnitude);
      return {
        x: moveX * inv,
        y: moveY * inv,
        magnitude: Math.min(1, magnitude),
      };
    }
    return { x: 0, y: 0, magnitude: 0 };
  }

  updateMapCameraPan(dt) {
    const camera = this.world?.getCameraSafe?.();
    if (!camera || !Number.isFinite(dt) || dt <= 0) return false;

    const panInput = this.getMapCameraPanInput();
    const hasInput = panInput.magnitude > 0.001;
    const shiftBoost = this.game?.input?.isKeyDown?.('shift') ? 1.7 : 1.0;
    const zoom = Math.max(0.35, Number(camera.zoom) || 1);
    const baseSpeed = Math.max(120, Number(CONST.GAME?.CAMERA_SPEED) || 220);
    const maxSpeed = (baseSpeed * 5.5 * shiftBoost) / zoom;
    const targetVx = panInput.x * maxSpeed;
    const targetVy = panInput.y * maxSpeed;
    const accel = hasInput ? 14 : 9;
    const blend = 1 - Math.exp(-accel * dt);
    this.cameraPanVelocity.x += (targetVx - this.cameraPanVelocity.x) * blend;
    this.cameraPanVelocity.y += (targetVy - this.cameraPanVelocity.y) * blend;

    if (!hasInput) {
      const damping = Math.exp(-8.5 * dt);
      this.cameraPanVelocity.x *= damping;
      this.cameraPanVelocity.y *= damping;
      if (Math.abs(this.cameraPanVelocity.x) < 1) this.cameraPanVelocity.x = 0;
      if (Math.abs(this.cameraPanVelocity.y) < 1) this.cameraPanVelocity.y = 0;
    }

    if (hasInput && this.game?.followParty) {
      this.game.followParty = false;
    }
    if (this.game?.followParty) return false;

    const prevX = Number(camera.x) || 0;
    const prevY = Number(camera.y) || 0;
    camera.x = prevX + (this.cameraPanVelocity.x * dt);
    camera.y = prevY + (this.cameraPanVelocity.y * dt);
    this.world.clampCameraToWorld();

    if (camera.x === prevX) this.cameraPanVelocity.x = 0;
    if (camera.y === prevY) this.cameraPanVelocity.y = 0;
    return camera.x !== prevX || camera.y !== prevY;
  }

  initEnemyParties() {
    if (!this.world.state) return;
    if (!this.world.worldAi || typeof this.world.worldAi !== 'object') {
      if (this.game) this.world.worldAi = createInitialWorldAiState();
    }
    if (!Array.isArray(this.world.worldAi?.parties)) {
      if (this.world.worldAi) this.world.worldAi.parties = [];
    }

    const worldState = this.world.state?.map || {};
    ensureWorldParties({
      aiState: this.world.worldAi,
      worldState,
      factions: this.world.state?.factions || CONST.FACTIONS,
      cfg: this.game?.getWorldAiCfgWithRegionMods?.() || {},
      currentDay: this.world.state?.day ?? 1,
      banditCapOverride: this.game?.getBanditCapWithEvents?.(this.game?.getCurrentEvents?.(this.world.state?.day ?? 1)),
    });

    this.world.enemyParties = [];
    if (Array.isArray(this.world.state.aiParties) && this.world.state.aiParties.length > 0) {
      this.world.enemyParties = this.world.state.aiParties.map((party) => ({
        ...party,
        factionId: party?.factionId || CONST.FACTION.ID.BANDITS,
      }));
      this.world.state.aiParties = this.world.enemyParties;
      return;
    }

    const bounds = this.world.getWorldBounds();
    const mapSpanX = Math.max(200, bounds.maxX - bounds.minX);
    const mapSpanY = Math.max(200, bounds.maxY - bounds.minY);
    const baseX = bounds.minX + mapSpanX * 0.35;
    const baseY = bounds.minY + mapSpanY * 0.35;

    this.world.enemyParties = [
      { id: 'enemy-1', x: baseX, y: baseY, radius: 12, speed: 40, vx: 0.45, vy: 0.3, factionId: CONST.FACTION.ID.BANDIT },
      { id: 'enemy-2', x: baseX + 320, y: baseY + 120, radius: 12, speed: 35, vx: -0.35, vy: 0.38, factionId: CONST.FACTION.ID.HRE },
      { id: 'enemy-3', x: baseX + 140, y: baseY + 360, radius: 12, speed: 30, vx: 0.32, vy: -0.4, factionId: CONST.FACTION.ID.OTTOMAN },
      { id: 'enemy-1', x: baseX, y: baseY, radius: 12, speed: 40, vx: 0.45, vy: 0.3, factionId: CONST.FACTION.ID.BANDITS },
      { id: 'enemy-2', x: baseX + 320, y: baseY + 120, radius: 12, speed: 35, vx: -0.35, vy: 0.38, factionId: CONST.FACTION.ID.BANDITS },
      { id: 'enemy-3', x: baseX + 140, y: baseY + 360, radius: 12, speed: 30, vx: 0.32, vy: -0.4, factionId: CONST.FACTION.ID.BANDITS },
    ];
    this.world.state.aiParties = this.world.enemyParties;
    this.world.state.worldAi = this.world.worldAi;
  }

  initPlayerParty() {
    if (this.game?.playerParty) {
      if (!Number.isFinite(this.game.playerParty.vx)) this.game.playerParty.vx = 0;
      if (!Number.isFinite(this.game.playerParty.vy)) this.game.playerParty.vy = 0;
      if (typeof this.game.playerParty.moveState !== 'string' || !this.game.playerParty.moveState) {
        this.game.playerParty.moveState = this.game.playerParty.hasDestination ? 'moving' : 'idle';
      }
      return;
    }

    const fallback = {
      x: 320,
      y: 320,
      radius: 12,
      speed: 180,
      selected: false,
      destX: null,
      destY: null,
      hasDestination: false,
      arrivalFeedbackTimer: 0,
      hovered: false,
      vx: 0,
      vy: 0,
      moveState: 'idle',
    };

    const statePlayer = this.world.state?.player;
    if (statePlayer && Number.isFinite(statePlayer.x) && Number.isFinite(statePlayer.y)) {
      fallback.x = statePlayer.x;
      fallback.y = statePlayer.y;
      fallback.destX = null;
      fallback.destY = null;
    }

    this.game.playerParty = fallback;
    this.game?.ensureFactionState?.();
    if (!Number.isFinite(this.game.playerParty.gold)) this.game.playerParty.gold = 0;
    if (!Number.isFinite(this.game.playerParty.xp)) this.game.playerParty.xp = 0;
    if (!Number.isFinite(this.game.playerParty.morale)) this.game.playerParty.morale = 64;
    if (!Number.isFinite(this.game.playerParty.renown)) this.game.playerParty.renown = 0;
    if (!Number.isFinite(this.game.playerParty.starveDays)) this.game.playerParty.starveDays = 0;
    if (!Array.isArray(this.game.playerParty.contracts)) this.game.playerParty.contracts = [];
    if (typeof this.game.playerParty.factionId !== 'string' || !this.game.playerParty.factionId) this.game.playerParty.factionId = CONST.FACTION.ID.PLAYER;
    if (!Number.isFinite(this.game.playerParty.renown)) this.game.playerParty.renown = Number(CONST.GAME.STARTING_RENOWN ?? 0);
    if (!Array.isArray(this.game.playerParty.roster) || this.game.playerParty.roster.length === 0) {
      const roster = [];
      for (let i = 0; i < 6; i += 1) {
        roster.push({ id: `inf-${i + 1}`, name: `Infantry ${i + 1}`, class: 'infantry', hp: 100, maxHp: 100, atk: 14, def: 8, speed: 72, meleeRange: 20, isRanged: false, status: 'healthy', healProgress: 0 });
      }
      for (let i = 0; i < 3; i += 1) {
        roster.push({ id: `arc-${i + 1}`, name: `Archer ${i + 1}`, class: 'archer', hp: 78, maxHp: 78, atk: 10, def: 4, speed: 68, meleeRange: 14, rangedRange: 220, rangedDamage: 12, rangedCooldown: 1.2, isRanged: true, status: 'healthy', healProgress: 0 });
      }
      this.game.playerParty.roster = roster;
    }
    this.ensureRosterState();
    if (!this.game.playerParty.inventory || typeof this.game.playerParty.inventory !== 'object') {
      this.game.playerParty.inventory = { items: [], capacity: null };
    }
    this.game?.ensureInventoryModel?.();
    if (this.world.state) {
      this.world.state.playerParty = this.game.playerParty;
      setContractsRuntimeContext({ party: this.game.playerParty, map: this.world.state?.map, worldSeed: this.world.state?.seed });
      if (typeof this.world.state.lastEventLog !== 'string') this.world.state.lastEventLog = '';
      if (!Number.isFinite(this.world.state.lastEventLogUntil)) this.world.state.lastEventLogUntil = 0;
    }

    this.initEnemyParties();
    this.game?.initRosters?.();
  }

  ensureRosterState() {
    const roster = this.game?.playerParty?.roster;
    if (!Array.isArray(roster)) return;
    roster.forEach((unit) => this.game?.ensureRosterUnitState?.(unit));
    this.game.playerParty.roster = roster.filter((unit) => unit?.status !== 'dead');
  }

  computeEncounterRiskContext() {
    const player = this.game?.playerParty;
    if (!player || !this.world.state?.map) return { mult: 1, label: 'Orta' };

    const moveContext = this.world.getMovementContextAt(player.x, player.y);
    const { tx, ty } = this.world.getTilePosition(player.x, player.y);
    const biomeKey = this.world.getBiomeKeyAtTile(tx, ty) || 'PLAINS';
    const nearestSettlement = this.world.getNearestSettlementAt(tx, ty);
    const settlementTx = Number.isFinite(nearestSettlement?.tx) ? nearestSettlement.tx : Math.floor(Number(nearestSettlement?.x ?? 0) / CONST.WORLD.TILE_SIZE);
    const settlementTy = Number.isFinite(nearestSettlement?.ty) ? nearestSettlement.ty : Math.floor(Number(nearestSettlement?.y ?? 0) / CONST.WORLD.TILE_SIZE);
    const nearSettlement = nearestSettlement && Math.hypot((settlementTx - tx), (settlementTy - ty)) <= 2.5;
    const market = nearSettlement ? this.world.state?.markets?.[nearestSettlement.id] : null;
    const mult = computeRiskMultiplier({
      state: this.world.state,
      movementCtx: moveContext,
      biomeKey,
      inCamp: Boolean(this.world.state?.camp?.active),
      supplies: this.world.state?.supplies,
      market,
    });
    return { mult, label: riskLabel(mult) };
  }

  tryTriggerEncounter() {
    if (this.world.state?.mode !== 'map' || !this.game?.playerParty || !Array.isArray(this.world.enemyParties)) return false;
    if (this.world.state.encounter) return false;

    const now = Date.now();
    for (const enemy of this.world.enemyParties) {
      if (!enemy?.id) continue;

      const cooldownUntil = this.world.lastEncounterEndTimeByEnemyId?.[enemy.id] ?? 0;
      if (now - cooldownUntil < this.world.encounterCooldownMs) continue;

      const dist = Math.hypot(this.game.playerParty.x - enemy.x, this.game.playerParty.y - enemy.y);
      const triggerDist = (this.game.playerParty.radius ?? 12) + (enemy.radius ?? 12) + this.world.encounterMargin;
      if (dist > triggerDist) continue;

      const rollAt = this.world._encounterRollByEnemyId[enemy.id] ?? 0;
      if (now - rollAt < 350) continue;
      this.world._encounterRollByEnemyId[enemy.id] = now;

      const moveContext = this.world.getMovementContextAt(this.game.playerParty.x, this.game.playerParty.y);
      const riskCtx = this.computeEncounterRiskContext();
      this.world.state.encounterRisk = riskCtx;
      let chance = 0.1 * moveContext.encounterMult * (Number(riskCtx?.mult) || 1);
      if (moveContext.onRiver && !moveContext.onCrossing) {
        chance *= 1.35;
      }

      if (Math.random() > Math.max(0.01, Math.min(0.95, chance))) continue;

      this.triggerEncounter(enemy);
      return true;
    }

    return false;
  }

  triggerEncounter(enemy) {
    if (!this.world.state || this.world.state.mode !== 'map' || !enemy?.id) return false;

    this.world.cancelPlayerDestination();
    this.world.state.encounter = {
      enemyId: enemy.id,
      startedAt: Date.now(),
      enemySnapshot: {
        id: enemy.id,
        x: enemy.x,
        y: enemy.y,
        radius: enemy.radius,
      },
    };
    this.world.state.setMode('encounter');
    this.game?.maybeShowTutorialHint?.({ nearSettlement: false, nearPoi: false, inCamp: false, inBattleDeploy: false, inBattleFight: false, inEncounter: true });
    return true;
  }

  processWorldAiEncounters(encounters = []) {
    if (!Array.isArray(encounters) || encounters.length === 0) return false;
    if (this.world.state?.mode !== 'map' || this.world.state?.encounter) return false;

    const first = encounters.find((entry) => entry?.partyId);
    if (!first) return false;
    const party = (this.world.worldAi?.parties || []).find((p) => p?.id === first.partyId);
    if (!party) return false;

    const enemyId = `wai-${party.id}`;
    const existing = (this.world.enemyParties || []).find((e) => e?.id === enemyId);
    if (!existing) {
      this.world.enemyParties.push({
        id: enemyId,
        x: Number(party.x ?? first.x ?? 0),
        y: Number(party.y ?? first.y ?? 0),
        radius: 12,
        speed: 30,
        vx: 0,
        vy: 0,
        temporary: true,
        factionId: party.factionId,
        worldPartyKind: party.kind,
      });
    }

    this.world.worldEncounterPartyByEnemyId[enemyId] = party.id;
    return this.triggerEncounter({ id: enemyId, x: party.x, y: party.y, radius: 12 });
  }

  updateTransientUIState() {
    if (!this.world.state) return;
    this.game?.ensureFactionState?.();
    this.world.state.encounterRisk = this.computeEncounterRiskContext();
    if (this.world.state.clueMarker && Number(this.world.state.day ?? 1) > Number(this.world.state.clueMarker.expiresDay ?? 0)) {
      this.world.state.clueMarker = null;
    }
    this.game?.cleanupExpiredMarketOpportunities?.(this.world.state.day);
    const currentEvents = this.game?.refreshCurrentEventsSummary?.(this.world.state.day);
    setContractsRuntimeContext({ party: this.game?.playerParty, map: this.world.state?.map, worldSeed: this.world.state?.seed });
    if (this.world.state.lastEventLog && Date.now() >= (this.world.state.lastEventLogUntil ?? 0)) {
      this.world.state.lastEventLog = '';
      this.world.state.lastEventLogUntil = 0;
    }

    if (this.world.state.mode === 'roster') {
      this.world.state.playerRoster = (this.game?.playerRoster || []).map((unit) => ({
        ...unit,
        status: unit?.status || 'healthy',
        effectiveCount: this.world.getEffectiveCount(unit),
      }));
      this.world.state.enemyRoster = (this.game?.enemyRoster || []).map((unit) => ({
        ...unit,
        effectiveCount: this.world.getEffectiveCount(unit),
      }));
      this.world.state.rosterCursorIndex = this.game?.rosterCursorIndex ?? 0;
      this.world.state.rosterSelectedCount = this.game?.getSelectedRosterCount?.() ?? 0;
      this.world.state.rosterPowerPlayer = this.world.state.playerRoster.reduce((sum, unit) => sum + (unit.effectiveCount * ((unit.atk ?? 10) + 8)), 0);
      this.world.state.rosterPowerEnemy = this.world.state.enemyRoster.reduce((sum, unit) => sum + (unit.effectiveCount * ((unit.atk ?? 10) + 8)), 0);
    }

    if (this.world.state.mode === 'city') {
      this.world.state.uiPanel = this.game?.buildCityPanelData?.();
      const settlement = this.world.state.city;
      this.world.state.currentCityFactionContext = this.game?.getCityFactionContext?.(settlement);
      if (settlement?.id) {
        this.game?.cityUI?.setData?.({
          settlement,
          recruitPool: settlement.recruitPool || [],
          market: this.world.state?.markets?.[settlement.id] || null,
        });
      }
    }

    if (this.world.state.mode === 'aftermath') {
      this.world.state.uiPanel = this.game?.buildAftermathPanelData?.();
    }
    if (this.world.state.mode !== 'city') this.world.state.currentCityFactionContext = null;

    if (this.world.state?.camp?.active) {
      const { weight, cap } = this.game?.getLogisticsSpeedMult?.() || { weight: 0, cap: 100 };
      const mult = CONST.CAMP.WATCH_MULT[this.world.state?.camp?.watch || 'med'] ?? 1;
      const raidChance = `${Math.round(CONST.CAMP.RAID_BASE_CHANCE * mult * 100)}%`;
      this.game?.campUI?.refresh?.({ weight, capacity: cap, raidChance });
    }

    if (this.world.state?.accounting) this.game?.accountingUI?.show?.(this.world.state.accounting);
    else this.game?.accountingUI?.hide?.();

    if (isCurrentEventsModalOpen()) renderCurrentEventsModal({ events: currentEvents, currentDay: this.world.state?.day ?? 1 });
    this.game?.hudManager?.update?.();
  }

  updatePlayerParty(dt) {
    const party = this.game?.playerParty;
    if (!party || !Number.isFinite(dt) || dt <= 0) return;
    if (!Number.isFinite(party.vx)) party.vx = 0;
    if (!Number.isFinite(party.vy)) party.vy = 0;
    if (typeof party.moveState !== 'string' || !party.moveState) party.moveState = 'idle';

    if (party.arrivalFeedbackTimer > 0) {
      party.arrivalFeedbackTimer = Math.max(0, party.arrivalFeedbackTimer - dt);
    }

    if (this.game?.followParty) {
      this.world.centerCameraOnParty();
    }

    if (this.game?.mode === 'paused' || this.world.state?.mode !== 'map') {
      party.vx = 0;
      party.vy = 0;
      if (party.moveState !== 'arrived') party.moveState = 'idle';
      return;
    }

    if (!party.hasDestination) {
      party.vx = 0;
      party.vy = 0;
      if (party.moveState !== 'arrived') party.moveState = 'idle';
      return;
    }

    const dx = party.destX - party.x;
    const dy = party.destY - party.y;
    const dist = Math.hypot(dx, dy);
    const epsilon = 2;

    if (dist <= epsilon) {
      this.world.completePlayerArrival();
      return;
    }

    if (this.world.state?.camp?.active) {
      this.world.cancelPlayerDestination();
      return;
    }

    const currentContext = this.world.getMovementContextAt(party.x, party.y);
    const logistics = this.game?.getLogisticsSpeedMult?.() || { starvingMult: 1, overcapMult: 1, weight: 0, cap: 100 };
    this.world.currentTerrainStatus = `${currentContext.terrainLabel} | Yük: ${Math.round(logistics.weight)}/${Math.round(logistics.cap)}`;
    if (currentContext.blocked) {
      this.world.cancelPlayerDestination();
      party.moveState = 'blocked';
      return;
    }

    const step = party.speed * currentContext.speedMult * logistics.starvingMult * logistics.overcapMult * dt;
    if (step >= dist) {
      this.world.completePlayerArrival();
      return;
    }

    const nx = party.x + (dx / dist) * step;
    const ny = party.y + (dy / dist) * step;
    const nextContext = this.world.getMovementContextAt(nx, ny);
    if (nextContext.blocked) {
      this.world.cancelPlayerDestination();
      party.moveState = 'blocked';
      return;
    }

    const prevX = Number(party.x) || 0;
    const prevY = Number(party.y) || 0;
    party.x = nx;
    party.y = ny;

    const clamped = this.world.clampToWorld(party.x, party.y);
    party.x = clamped.x;
    party.y = clamped.y;
    const movedX = party.x - prevX;
    const movedY = party.y - prevY;
    party.vx = movedX / dt;
    party.vy = movedY / dt;
    party.moveState = (Math.hypot(party.vx, party.vy) > 0.001) ? 'moving' : 'idle';

    if (this.game?.followParty) {
      this.world.centerCameraOnParty();
    }
  }

  updateEnemyParties(dt) {
    const enemies = this.world.enemyParties;
    if (!Array.isArray(enemies) || enemies.length === 0) return;
    if (!Number.isFinite(dt) || dt <= 0 || this.world.state?.mode !== 'map') return;

    const bounds = this.world.getWorldBounds();
    const driftRate = 0.15;
    const playerX = Number(this.game?.playerParty?.x ?? 0);
    const playerY = Number(this.game?.playerParty?.y ?? 0);

    enemies.forEach((enemy, index) => {
      if (!enemy || !Number.isFinite(enemy.x) || !Number.isFinite(enemy.y)) return;
      if (typeof enemy.moveState !== 'string' || !enemy.moveState) enemy.moveState = 'patrol';

      const wobble = (this.world.state.timeSec * 0.65) + (index * 1.37);
      enemy.vx = (enemy.vx ?? 0) + Math.sin(wobble) * driftRate * dt;
      enemy.vy = (enemy.vy ?? 0) + Math.cos(wobble * 1.11) * driftRate * dt;

      const enemyFactionId = enemy.factionId || CONST.FACTION.ID.BANDIT;
      const stance = getStance(this.world.state?.factions, enemyFactionId, 'player', CONST.DIPLOMACY_RELATIONS);
      const dxToPlayer = playerX - enemy.x;
      const dyToPlayer = playerY - enemy.y;
      const playerDist = Math.hypot(dxToPlayer, dyToPlayer) || 1;
      const playerDirX = dxToPlayer / playerDist;
      const playerDirY = dyToPlayer / playerDist;
      const aggroRadius = stance === 'WAR' ? 260 : (stance === 'NEUTRAL' ? 140 : 0);
      let nextMoveState = 'patrol';
      if (aggroRadius > 0 && playerDist <= aggroRadius) {
        const aggroStrength = stance === 'WAR' ? 0.85 : 0.25;
        enemy.vx += playerDirX * aggroStrength * dt;
        enemy.vy += playerDirY * aggroStrength * dt;
        nextMoveState = stance === 'WAR' ? 'chase' : 'approach';
      }
      if (stance === 'ALLY' && playerDist < 140) {
        enemy.vx -= playerDirX * 0.5 * dt;
        enemy.vy -= playerDirY * 0.5 * dt;
        nextMoveState = 'retreat';
      }

      const speedLen = Math.hypot(enemy.vx, enemy.vy) || 1;
      enemy.vx /= speedLen;
      enemy.vy /= speedLen;

      const speed = Number.isFinite(enemy.speed) ? enemy.speed : 35;
      const radius = Number.isFinite(enemy.radius) ? enemy.radius : 12;
      const context = this.world.getMovementContextAt(enemy.x, enemy.y);
      const moveSpeed = speed * context.speedMult;
      const nx = enemy.x + enemy.vx * moveSpeed * dt;
      const ny = enemy.y + enemy.vy * moveSpeed * dt;
      const nextContext = this.world.getMovementContextAt(nx, ny);
      if (nextContext.blocked) {
        enemy.vx *= -1;
        enemy.vy *= -1;
        enemy.moveState = 'blocked';
      } else {
        enemy.x = nx;
        enemy.y = ny;
        enemy.moveState = nextMoveState;
      }

      if (enemy.x < bounds.minX + radius || enemy.x > bounds.maxX - radius) {
        enemy.vx *= -1;
        enemy.x = Math.max(bounds.minX + radius, Math.min(bounds.maxX - radius, enemy.x));
      }
      if (enemy.y < bounds.minY + radius || enemy.y > bounds.maxY - radius) {
        enemy.vy *= -1;
        enemy.y = Math.max(bounds.minY + radius, Math.min(bounds.maxY - radius, enemy.y));
      }
      enemy.worldSpeed = moveSpeed;
    });
  }

  updateMapSimulation(dt) {
    this.game?.updatePoiInteractHint?.();
    this.updateTransientUIState();
    if (this.world.state) this.world.state.worldAi = this.world.worldAi;
    if (this.world.state?.paused || this.world.state?.accounting) return;
    this.updateMapCameraPan(dt);
    this.updatePlayerParty(dt);
    if ((this.game?.getEffectiveTuning?.() || {}).WORLD_AI?.ENABLED ?? CONST.WORLD_AI?.ENABLED) {
      const worldState = this.world.state?.map || {};
      ensureWorldParties({
        aiState: this.world.worldAi,
        worldState,
        factions: this.world.state?.factions || CONST.FACTIONS,
        cfg: this.game?.getWorldAiCfgWithRegionMods?.() || {},
        currentDay: this.world.state?.day ?? 1,
        banditCapOverride: this.game?.getBanditCapWithEvents?.(this.game?.getCurrentEvents?.(this.world.state?.day ?? 1)),
      });
      this.game?.syncWarStateFromRelations?.();
      const encounters = updateWorldParties({
        aiState: this.world.worldAi,
        worldState,
        playerParty: this.game?.playerParty,
        factions: this.world.state?.factions || CONST.FACTIONS,
        cfg: this.game?.getWorldAiCfgWithRegionMods?.() || {},
        dtSec: dt,
      });
      this.processWorldAiEncounters(encounters);
    } else {
      this.updateEnemyParties(dt);
      this.tryTriggerEncounter();
    }

    const party = this.game?.playerParty;
    const tilePos = this.world.getTilePosition(party?.x ?? 0, party?.y ?? 0);
    const nearestSettlement = this.world.getNearestSettlementAt(tilePos.tx, tilePos.ty);
    const settlementTx = Number.isFinite(nearestSettlement?.tx) ? nearestSettlement.tx : Math.floor(Number(nearestSettlement?.x ?? 0) / CONST.WORLD.TILE_SIZE);
    const settlementTy = Number.isFinite(nearestSettlement?.ty) ? nearestSettlement.ty : Math.floor(Number(nearestSettlement?.y ?? 0) / CONST.WORLD.TILE_SIZE);
    const nearSettlement = Boolean(nearestSettlement) && Math.hypot(settlementTx - tilePos.tx, settlementTy - tilePos.ty) <= 2.5;
    const nearPoi = Boolean(this.game?.getNearestInteractablePoi?.());

    this.game?.maybeShowTutorialHint?.({
      nearSettlement,
      nearPoi,
      inCamp: Boolean(this.world.state?.camp?.active),
      inBattleDeploy: false,
      inBattleFight: false,
      inEncounter: this.world.state?.mode === 'encounter',
    });

    this.world.updateFogFromPlayer();
    tickWeatherLayer(dt, this.game?.canvas?.width ?? CONST.GAME.VIEW_WIDTH, this.game?.canvas?.height ?? CONST.GAME.VIEW_HEIGHT);
  }

  cleanupTemporaryEnemy(enemyId, { force = false } = {}) {
    if (!enemyId || !Array.isArray(this.world.enemyParties)) return false;
    const enemy = this.world.enemyParties.find((party) => party?.id === enemyId);
    if (!enemy) return false;
    if (force || enemy?.temporary) return this.despawnEnemyParty(enemyId);
    return false;
  }

  despawnEnemyParty(enemyId) {
    if (!enemyId || !Array.isArray(this.world.enemyParties)) return false;
    const idx = this.world.enemyParties.findIndex((party) => party?.id === enemyId);
    if (idx === -1) return false;
    this.world.enemyParties.splice(idx, 1);

    if (Array.isArray(this.world.state?.aiParties) && this.world.state.aiParties !== this.world.enemyParties) {
      const stateIdx = this.world.state.aiParties.findIndex((party) => party?.id === enemyId);
      if (stateIdx >= 0) this.world.state.aiParties.splice(stateIdx, 1);
    }
    return true;
  }

  getRegionIdAtTile(tx, ty) {
    const g = this.game;
    const nearestSettlement = g.worldManager.getNearestSettlementAt(tx, ty);
    if (nearestSettlement?.id) return String(nearestSettlement.id);
    return `wild:${Math.floor(Number(tx) || 0)}:${Math.floor(Number(ty) || 0)}`;
  }

  getCurrentRegionContext() {
    const g = this.game;
    const tilePos = g.worldManager.getTilePosition(g.playerParty?.x ?? 0, g.playerParty?.y ?? 0);
    const regionId = this.getRegionIdAtTile(tilePos.tx, tilePos.ty);
    const nearestSettlement = g.worldManager.getNearestSettlementAt(tilePos.tx, tilePos.ty);
    return {
      regionId,
      regionName: nearestSettlement?.name || regionId,
      tilePos,
      settlement: nearestSettlement,
    };
  }

  getCurrentRegionModifiers(day) {
    const d = day ?? this.world.state?.day;
    const ctx = this.getCurrentRegionContext();
    if (!this.world.state?.regionState) this.world.state.regionState = createInitialRegionState();
    this.world.state.currentRegionId = ctx.regionId;
    this.world.state.currentRegionName = ctx.regionName;
    return getActiveRegionModifiers(this.world.state.regionState, ctx.regionId, d);
  }

  getWorldAiCfgWithRegionMods() {
    const g = this.game;
    const base = g.tuningManager.getEffectiveTuning().WORLD_AI || CONST.WORLD_AI;
    const mods = this.getCurrentRegionModifiers(this.world.state?.day);
    const banditMult = mods.reduce((mult, mod) => (mod?.id === 'high_banditry' ? (mult * Number(CONST.REGION_MODIFIERS.HIGH_BANDITRY.banditSpawnMult || 1.5)) : mult), 1);
    if (banditMult === 1) return base;
    return {
      ...base,
      MAX_BANDIT_PARTIES: Math.max(1, Math.floor(Number(base.MAX_BANDIT_PARTIES ?? 0) * banditMult)),
    };
  }

  getRenownGainMultAtCurrentRegion() {
    const mods = this.getCurrentRegionModifiers(this.world.state?.day);
    return mods.reduce((mult, mod) => (mod?.id === 'pilgrimage' ? (mult * Number(CONST.REGION_MODIFIERS.PILGRIMAGE.renownGainMult || 1.2)) : mult), 1);
  }

  getBanditCapWithEvents(worldEvents) {
    const g = this.game;
    const tuning = g.tuningManager.getEffectiveTuning();
    const worldCfg = tuning.WORLD_AI || CONST.WORLD_AI;
    const eventsCfg = tuning.EVENTS || CONST.EVENTS;
    const baseCap = Number(worldCfg.MAX_BANDIT_PARTIES ?? CONST.WORLD_AI.MAX_BANDIT_PARTIES);
    return getBanditCap(worldEvents, getBanditCapFromEvents(worldEvents, baseCap, eventsCfg), eventsCfg);
  }
}
