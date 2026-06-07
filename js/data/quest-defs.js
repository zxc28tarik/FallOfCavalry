export const QUEST_DEFS = Object.freeze([
  Object.freeze({
    id: 'investigate_missing_caravan',
    type: 'intelligence',
    tags: Object.freeze(['caravan', 'investigation']),
    sourceTypes: Object.freeze(['merchant_guild', 'caravanserai']),
    targetRules: Object.freeze({ targetRoute: 'route_with_recent_loss' }),
    timeLimitDays: 8,
    chainQuestTemplateId: 'secure_trade_route',
    objectives: Object.freeze([
      Object.freeze({ id: 'find_caravan_fate', type: 'investigate', targetRouteId: '{{targetRouteId}}' }),
    ]),
    completionPaths: Object.freeze([
      Object.freeze({
        id: 'bandits_identified',
        label: 'Haydut grubunu tespit ettim',
        requiredOutcome: 'bandits_located',
        rewards: Object.freeze({ gold: 100, reputation: 1 }),
        worldEffects: Object.freeze([]),
      }),
    ]),
    failureEffects: Object.freeze([
      Object.freeze({ type: 'change_faction_relation', factionId: '{{issuerFactionId}}', amount: -2 }),
    ]),
  }),

  Object.freeze({
    id: 'secure_trade_route',
    type: 'security',
    tags: Object.freeze(['trade_route', 'bandit', 'city_security']),
    sourceTypes: Object.freeze(['city_governor', 'caravanserai', 'merchant_guild']),
    targetRules: Object.freeze({
      targetCity: 'city_with_low_security',
      targetRoute: 'route_connected_to_target_city',
      threatType: 'bandit',
    }),
    requirements: Object.freeze({ minFactionRelation: 0, minReputation: 0 }),
    timeLimitDays: 12,
    chainQuestTemplateId: 'escort_first_caravan',
    objectives: Object.freeze([
      Object.freeze({ id: 'resolve_bandit_threat', type: 'resolve_threat', threatType: 'bandit', targetRouteId: '{{targetRouteId}}' }),
    ]),
    completionPaths: Object.freeze([
      Object.freeze({
        id: 'defeat_bandits',
        label: 'Haydutları savaşta yendim',
        requiredOutcome: 'bandits_defeated',
        rewards: Object.freeze({ gold: 300, reputation: 3, honor: 1 }),
        worldEffects: Object.freeze([
          Object.freeze({ type: 'increase_city_security', cityId: '{{targetCityId}}', amount: 8 }),
          Object.freeze({ type: 'improve_trade_route', routeId: '{{targetRouteId}}', amount: 1 }),
        ]),
      }),
      Object.freeze({
        id: 'intimidate_bandits',
        label: 'Haydutları korkutup dağıttım',
        requiredOutcome: 'bandits_intimidated',
        rewards: Object.freeze({ gold: 200, reputation: 2, honor: 0 }),
        worldEffects: Object.freeze([
          Object.freeze({ type: 'increase_city_security', cityId: '{{targetCityId}}', amount: 5 }),
        ]),
      }),
      Object.freeze({
        id: 'recruit_bandits',
        label: 'Haydutları orduma kattım',
        requiredOutcome: 'bandits_recruited',
        rewards: Object.freeze({ gold: 150, reputation: 1, honor: -3 }),
        worldEffects: Object.freeze([
          Object.freeze({ type: 'increase_city_security', cityId: '{{targetCityId}}', amount: 4 }),
          Object.freeze({ type: 'decrease_army_morale', amount: 1 }),
          Object.freeze({ type: 'decrease_elite_unit_approval', amount: 1 }),
        ]),
      }),
    ]),
    failureEffects: Object.freeze([
      Object.freeze({ type: 'decrease_city_security', cityId: '{{targetCityId}}', amount: 6 }),
      Object.freeze({ type: 'damage_trade_route', routeId: '{{targetRouteId}}', amount: 1 }),
      Object.freeze({ type: 'change_faction_relation', factionId: '{{issuerFactionId}}', amount: -5 }),
    ]),
  }),

  Object.freeze({
    id: 'escort_first_caravan',
    type: 'security',
    tags: Object.freeze(['caravan', 'escort']),
    sourceTypes: Object.freeze(['merchant_guild']),
    targetRules: Object.freeze({ targetRoute: 'route_with_recent_loss' }),
    timeLimitDays: 10,
    chainQuestTemplateId: null,
    objectives: Object.freeze([
      Object.freeze({ id: 'deliver_caravan_safely', type: 'escort_party', targetRouteId: '{{targetRouteId}}' }),
    ]),
    completionPaths: Object.freeze([
      Object.freeze({
        id: 'caravan_delivered',
        label: 'Kervan güvenli ulaştı',
        requiredOutcome: 'caravan_arrived',
        rewards: Object.freeze({ gold: 250, reputation: 2 }),
        worldEffects: Object.freeze([
          Object.freeze({ type: 'improve_trade_route', routeId: '{{targetRouteId}}', amount: 1 }),
        ]),
      }),
    ]),
    failureEffects: Object.freeze([
      Object.freeze({ type: 'damage_trade_route', routeId: '{{targetRouteId}}', amount: 2 }),
    ]),
  }),

  Object.freeze({
    id: 'scout_border_region',
    type: 'intelligence',
    tags: Object.freeze(['border', 'scouting']),
    sourceTypes: Object.freeze(['sultan_king', 'city_governor']),
    targetRules: Object.freeze({ targetRegion: 'border_region' }),
    timeLimitDays: 7,
    chainQuestTemplateId: 'intercept_messenger',
    objectives: Object.freeze([
      Object.freeze({ id: 'scout_complete', type: 'explore_region', targetRegionId: '{{targetRegionId}}' }),
    ]),
    completionPaths: Object.freeze([
      Object.freeze({
        id: 'intel_gathered',
        label: 'Düşman hareketi raporlandı',
        requiredOutcome: 'region_scouted',
        rewards: Object.freeze({ gold: 200, reputation: 2 }),
        worldEffects: Object.freeze([]),
      }),
    ]),
    failureEffects: Object.freeze([
      Object.freeze({ type: 'change_faction_relation', factionId: '{{issuerFactionId}}', amount: -3 }),
    ]),
  }),

  Object.freeze({
    id: 'intercept_messenger',
    type: 'intelligence',
    tags: Object.freeze(['messenger', 'interception']),
    sourceTypes: Object.freeze(['sultan_king']),
    timeLimitDays: 5,
    chainQuestTemplateId: 'defend_border_fort',
    objectives: Object.freeze([
      Object.freeze({ id: 'catch_messenger', type: 'intercept_party', targetPartyType: 'messenger' }),
    ]),
    completionPaths: Object.freeze([
      Object.freeze({
        id: 'messenger_intercepted',
        label: 'Haberci yakalandı, mesaj alındı',
        requiredOutcome: 'messenger_caught',
        rewards: Object.freeze({ gold: 250, reputation: 3 }),
        worldEffects: Object.freeze([]),
      }),
      Object.freeze({
        id: 'messenger_let_pass',
        label: 'Haberciyi takip edip plana sızdım',
        requiredOutcome: 'messenger_followed',
        rewards: Object.freeze({ gold: 350, reputation: 4 }),
        worldEffects: Object.freeze([]),
      }),
    ]),
    failureEffects: Object.freeze([
      Object.freeze({ type: 'change_faction_relation', factionId: '{{issuerFactionId}}', amount: -4 }),
    ]),
  }),

  Object.freeze({
    id: 'defend_border_fort',
    type: 'military',
    tags: Object.freeze(['fort', 'defense', 'border']),
    sourceTypes: Object.freeze(['sultan_king']),
    targetRules: Object.freeze({ targetFort: 'border_fort' }),
    timeLimitDays: 15,
    chainQuestTemplateId: null,
    objectives: Object.freeze([
      Object.freeze({ id: 'hold_fort', type: 'defend_location', targetLocationId: '{{targetFortId}}' }),
    ]),
    completionPaths: Object.freeze([
      Object.freeze({
        id: 'fort_held',
        label: 'Kale savunuldu',
        requiredOutcome: 'fort_defended',
        rewards: Object.freeze({ gold: 800, reputation: 6, honor: 3 }),
        worldEffects: Object.freeze([
          Object.freeze({ type: 'change_faction_relation', factionId: '{{issuerFactionId}}', amount: 8 }),
        ]),
      }),
    ]),
    failureEffects: Object.freeze([
      Object.freeze({ type: 'decrease_city_security', cityId: '{{nearestCityId}}', amount: 15 }),
      Object.freeze({ type: 'change_faction_relation', factionId: '{{issuerFactionId}}', amount: -10 }),
    ]),
  }),

  Object.freeze({
    id: 'supply_starving_city',
    type: 'economic',
    tags: Object.freeze(['supply', 'famine']),
    sourceTypes: Object.freeze(['city_governor', 'religious_leader']),
    targetRules: Object.freeze({ targetCity: 'city_with_low_security' }),
    timeLimitDays: 14,
    chainQuestTemplateId: 'escort_supply_caravan',
    objectives: Object.freeze([
      Object.freeze({ id: 'gather_supplies', type: 'collect_goods', goodType: 'food', amount: 80 }),
    ]),
    completionPaths: Object.freeze([
      Object.freeze({
        id: 'supplies_delivered',
        label: 'Erzak halka dağıtıldı',
        requiredOutcome: 'supplies_to_people',
        rewards: Object.freeze({ gold: 200, reputation: 4, honor: 3 }),
        worldEffects: Object.freeze([]),
      }),
      Object.freeze({
        id: 'supplies_to_army',
        label: 'Erzak orduya ayrıldı',
        requiredOutcome: 'supplies_to_military',
        rewards: Object.freeze({ gold: 250, reputation: 2 }),
        worldEffects: Object.freeze([]),
      }),
    ]),
    failureEffects: Object.freeze([
      Object.freeze({ type: 'decrease_city_security', cityId: '{{targetCityId}}', amount: 10 }),
    ]),
  }),

  Object.freeze({
    id: 'neutralize_commander',
    type: 'military',
    tags: Object.freeze(['commander', 'elimination']),
    sourceTypes: Object.freeze(['sultan_king', 'noble']),
    targetRules: Object.freeze({ targetCommander: 'hostile_commander' }),
    timeLimitDays: 20,
    chainQuestTemplateId: null,
    objectives: Object.freeze([
      Object.freeze({ id: 'neutralize', type: 'neutralize_target', targetCommanderId: '{{targetCommanderId}}' }),
    ]),
    completionPaths: Object.freeze([
      Object.freeze({
        id: 'defeated_in_battle',
        label: 'Savaşta yenilgiye uğrattım',
        requiredOutcome: 'commander_defeated',
        rewards: Object.freeze({ gold: 600, reputation: 5, honor: 2 }),
        worldEffects: Object.freeze([]),
      }),
      Object.freeze({
        id: 'captured',
        label: 'Esir aldım',
        requiredOutcome: 'commander_captured',
        rewards: Object.freeze({ gold: 800, reputation: 4, honor: 1 }),
        worldEffects: Object.freeze([]),
      }),
      Object.freeze({
        id: 'diplomatic_pressure',
        label: 'Diplomatik baskıyla çekilmesini sağladım',
        requiredOutcome: 'commander_retreated',
        rewards: Object.freeze({ gold: 400, reputation: 3, honor: 4 }),
        worldEffects: Object.freeze([]),
      }),
    ]),
    failureEffects: Object.freeze([
      Object.freeze({ type: 'change_faction_relation', factionId: '{{issuerFactionId}}', amount: -8 }),
    ]),
  }),
]);
