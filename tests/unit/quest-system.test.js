import { describe, it, expect, vi } from 'vitest';
import { QuestGenerator } from '../../js/systems/QuestGenerator.js';
import { QuestManager } from '../../js/managers/QuestManager.js';
import { WorldManager } from '../../js/managers/WorldManager.js';
import { EncounterManager } from '../../js/managers/EncounterManager.js';

describe('QuestGenerator', () => {
  function makeGenerator() {
    const worldManager = {
      getCurrentDay: () => 12,
      getWorldState: () => ({ isAtWar: false, banditDensity: 0.2, tradeRouteDamaged: true }),
      pickQuestTargetRegion: () => 'region-1',
      pickQuestTargetFort: () => 'fort-1',
      pickQuestTargetCommander: () => 'commander-1',
    };
    const cityManager = {
      pickQuestTargetCity: () => 'city-1',
      findNearestCityToLocation: () => 'city-1',
    };
    const economyManager = {
      pickQuestTargetRoute: () => 'route-1',
    };
    const factionManager = {
      pickQuestIssuerFaction: () => 'ottoman',
    };
    return new QuestGenerator(worldManager, cityManager, economyManager, factionManager);
  }

  it('fills placeholders with real resolved ids', () => {
    const quest = makeGenerator().generateFromTemplate('secure_trade_route', { issuerFactionId: 'venice' });
    expect(quest).toBeTruthy();
    expect(quest.id).toMatch(/^quest_/);
    expect(quest.templateId).toBe('secure_trade_route');
    expect(quest.status).toBe('available');
    expect(quest.objectives[0].targetRouteId).toBe('route-1');
    expect(quest.completionPaths[0].worldEffects[0].cityId).toBe('city-1');
    expect(JSON.stringify(quest)).not.toContain('unknown');
  });

  it('keeps the real settlement ID 0 instead of silently substituting an unrelated city', () => {
    const generator = makeGenerator();
    const spy = vi.spyOn(generator.cityManager, 'pickQuestTargetCity');
    const quest = generator.generateFromTemplate('secure_trade_route', {
      targetCityId: 0, targetRouteId: 'route:0:14', issuerFactionId: 'ottoman',
    });
    expect(quest).toBeTruthy();
    expect(quest.targetCityId).toBe(0);
    expect(quest.targetRouteId).toBe('route:0:14');
    expect(quest.objectives[0].targetRouteId).toBe('route:0:14');
    expect(quest.completionPaths[0].worldEffects[0].cityId).toBe('0');
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns null instead of generating fake unknown ids', () => {
    const generator = new QuestGenerator(
      { getCurrentDay: () => 1 },
      { pickQuestTargetCity: () => null },
      { pickQuestTargetRoute: () => null },
      { pickQuestIssuerFaction: () => null },
    );
    expect(generator.generateFromTemplate('secure_trade_route')).toBeNull();
  });
});

describe('QuestManager', () => {
  it('converts rewards to effects and applies world effects centrally', () => {
    const applied = [];
    const modeManager = { pushOverlay: vi.fn() };
    const worldEffectManager = { applyEffect: (effect) => applied.push(effect) };
    const questGenerator = { generateFromTemplate: () => null };
    const manager = new QuestManager(modeManager, worldEffectManager, questGenerator);
    const quest = {
      id: 'q1',
      templateId: 'secure_trade_route',
      status: 'active',
      objectives: [{ id: 'resolve_bandit_threat', outcome: 'bandits_defeated' }],
      completionPaths: [{
        id: 'defeat_bandits',
        requiredOutcome: 'bandits_defeated',
        rewards: { gold: 300, reputation: 3, honor: 1 },
        worldEffects: [{ type: 'increase_city_security', cityId: 'city-1', amount: 8 }],
      }],
    };
    manager.addQuest(quest);
    manager.completeQuest('q1', 'defeat_bandits');
    expect(applied).toEqual([
      { type: 'change_player_gold', amount: 300 },
      { type: 'change_player_reputation', amount: 3 },
      { type: 'change_player_honor', amount: 1 },
      { type: 'increase_city_security', cityId: 'city-1', amount: 8 },
    ]);
    expect(manager.activeQuests).toHaveLength(0);
    expect(manager.completedQuests[0].status).toBe('completed');
  });
});

describe('WorldManager effects', () => {
  it('routes applyEffect calls to the owning managers', () => {
    const state = { map: { settlements: [{ id: 'city-1', security: 20 }] } };
    const world = new WorldManager(state);
    const game = {
      playerParty: { gold: 10, renown: 1, morale: 20 },
      cityManager: { increaseSecurity: vi.fn(), decreaseSecurity: vi.fn() },
      economyManager: { improveTradeRoute: vi.fn(), damageTradeRoute: vi.fn() },
      diplomacyManager: { changeRelation: vi.fn() },
    };
    world.game = game;
    world.applyEffect({ type: 'increase_city_security', cityId: 'city-1', amount: 8 });
    world.applyEffect({ type: 'change_player_gold', amount: 50 });
    world.applyEffect({ type: 'change_faction_relation', factionId: 'hre', amount: -2 });
    expect(game.cityManager.increaseSecurity).toHaveBeenCalledWith('city-1', 8);
    expect(game.playerParty.gold).toBe(60);
    expect(game.diplomacyManager.changeRelation).toHaveBeenCalledWith('hre', -2);
  });
});

describe('Encounter quest bridge', () => {
  it('can open a quest from a messenger outcome without mutating world state directly', () => {
    const state = { mode: 'encounter', selectedFaction: { id: 'player' }, encounter: { enemyId: 'm1', encounterType: 'messenger', enemySnapshot: { factionId: 'hre' } } };
    const encounter = new EncounterManager(state);
    const quest = { id: 'q1', templateId: 'intercept_messenger' };
    const added = [];
    encounter.init({
      playerParty: { x: 10, y: 20 },
      worldManager: { findNearestCityId: () => 'city-1' },
      questGenerator: { generateFromTemplate: vi.fn(() => quest) },
      questManager: { addQuest: (entry) => added.push(entry) },
    });
    const result = encounter.onEncounterOutcome('messenger', 'intercepted', encounter.buildQuestContext());
    expect(result).toBe(quest);
    expect(added).toEqual([quest]);
  });
});
