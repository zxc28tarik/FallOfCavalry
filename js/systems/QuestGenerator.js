import { QUEST_DEFS } from '../data/quest-defs.js';

export class QuestGenerator {
  constructor(worldManager, cityManager, economyManager, factionManager) {
    this.worldManager = worldManager;
    this.cityManager = cityManager;
    this.economyManager = economyManager;
    this.factionManager = factionManager;
  }

  getGenerationWeights(worldState = {}) {
    const weights = {
      military: 10,
      security: 10,
      diplomatic: 10,
      economic: 10,
      intelligence: 10,
      special: 5,
    };
    if (worldState.isAtWar) {
      weights.military += 30;
      weights.intelligence += 20;
      weights.economic += 15;
      weights.security -= 5;
    } else {
      weights.security += 25;
      weights.economic += 20;
      weights.diplomatic += 15;
    }
    if (worldState.banditDensity > 0.5) weights.security += 20;
    if (worldState.tradeRouteDamaged) weights.economic += 15;
    return weights;
  }

  getMaxQuestTierForRelation(relationScore) {
    if (relationScore >= 81) return 'special';
    if (relationScore >= 51) return 'high';
    if (relationScore >= 21) return 'medium';
    return 'low';
  }

  generateFromTemplate(templateId, context = {}) {
    const template = QUEST_DEFS.find((questDef) => questDef.id === templateId);
    if (!template) return null;
    const resolved = this._resolveTargets(template, context);
    if (!resolved) return null;
    const instance = this._fillPlaceholders(template, resolved);
    instance.id = this._createQuestInstanceId();
    instance.templateId = templateId;
    instance.status = 'available';
    instance.createdAt = this.worldManager?.getCurrentDay?.() ?? 0;
    instance.issuerFactionId = resolved.issuerFactionId;
    return instance;
  }

  generateForWorldState(playerStats = {}, factionRelations = {}) {
    const worldState = this.worldManager?.getWorldState?.() || {};
    const weights = this.getGenerationWeights(worldState);
    const chosenType = this._weightedPick(weights);
    const candidates = QUEST_DEFS.filter((questDef) => questDef.type === chosenType);
    const filtered = this._filterByRequirements(candidates, playerStats, factionRelations);
    if (filtered.length === 0) return null;
    const template = filtered[Math.floor(Math.random() * filtered.length)];
    const issuerFactionId = this._pickFaction(factionRelations);
    if (!issuerFactionId) return null;
    return this.generateFromTemplate(template.id, { issuerFactionId });
  }

  _filterByRequirements(templates, playerStats = {}, factionRelations = {}) {
    return templates.filter((template) => {
      if (template.requirements?.minReputation && playerStats.reputation < template.requirements.minReputation) return false;
      if (template.requirements?.minHonor && playerStats.honor < template.requirements.minHonor) return false;
      if (template.requirements?.minFactionRelation) {
        const relationValues = Object.values(factionRelations);
        if (relationValues.length === 0) return false;
        if (Math.max(...relationValues) < template.requirements.minFactionRelation) return false;
      }
      return true;
    });
  }

  _resolveTargets(template, context = {}) {
    const resolved = {
      targetCityId: context.targetCityId ?? null,
      targetRouteId: context.targetRouteId ?? null,
      targetRegionId: context.targetRegionId ?? null,
      targetFortId: context.targetFortId ?? null,
      targetCommanderId: context.targetCommanderId ?? null,
      nearestCityId: context.nearestCityId ?? null,
      issuerFactionId: context.issuerFactionId ?? null,
    };

    if (!resolved.targetCityId && template.targetRules?.targetCity) {
      resolved.targetCityId = this.cityManager?.pickQuestTargetCity?.(template.targetRules.targetCity, { ...context, ...resolved }) ?? null;
    }
    if (!resolved.targetRouteId && template.targetRules?.targetRoute) {
      resolved.targetRouteId = this.economyManager?.pickQuestTargetRoute?.(template.targetRules.targetRoute, { ...context, ...resolved }) ?? null;
    }
    if (!resolved.targetRegionId && template.targetRules?.targetRegion) {
      resolved.targetRegionId = this.worldManager?.pickQuestTargetRegion?.(template.targetRules.targetRegion, { ...context, ...resolved }) ?? null;
    }
    if (!resolved.targetFortId && template.targetRules?.targetFort) {
      resolved.targetFortId = this.worldManager?.pickQuestTargetFort?.(template.targetRules.targetFort, { ...context, ...resolved }) ?? null;
    }
    if (!resolved.targetCommanderId && template.targetRules?.targetCommander) {
      resolved.targetCommanderId = this.worldManager?.pickQuestTargetCommander?.(template.targetRules.targetCommander, { ...context, ...resolved }) ?? null;
    }
    if (!resolved.nearestCityId && resolved.targetFortId) {
      resolved.nearestCityId = this.cityManager?.findNearestCityToLocation?.(resolved.targetFortId) ?? null;
    }
    if (!resolved.issuerFactionId) {
      resolved.issuerFactionId = this.factionManager?.pickQuestIssuerFaction?.({ ...context, ...resolved }) ?? null;
    }
    if (!this._hasRequiredResolvedTargets(template, resolved)) return null;
    return resolved;
  }

  _hasRequiredResolvedTargets(template, resolved) {
    const serialized = JSON.stringify(template);
    const placeholders = serialized.match(/\{\{[a-zA-Z0-9_]+\}\}/g) ?? [];
    for (const placeholder of placeholders) {
      const key = placeholder.replace('{{', '').replace('}}', '');
      if (!resolved[key]) return false;
    }
    return true;
  }

  _fillPlaceholders(template, resolved) {
    let filled = JSON.stringify(template);
    for (const [key, value] of Object.entries(resolved)) {
      if (!value) continue;
      filled = filled.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
    }
    return JSON.parse(filled);
  }

  _weightedPick(weights) {
    const entries = Object.entries(weights).filter(([, value]) => Number(value) > 0);
    const total = entries.reduce((sum, [, value]) => sum + value, 0);
    if (total <= 0) return entries[0]?.[0] || 'security';
    let roll = Math.random() * total;
    for (const [key, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return key;
    }
    return entries[0]?.[0] || 'security';
  }

  _pickFaction(factionRelations) {
    const entries = Object.entries(factionRelations || {});
    if (entries.length === 0) return null;
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  }

  _createQuestInstanceId() {
    return `quest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

export default QuestGenerator;
