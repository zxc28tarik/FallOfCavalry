import { recordCompletedSessionQuest } from '../systems/quest-event-matcher.js';

export class QuestManager {
  constructor(modeManager, worldEffectManager, questGenerator) {
    this.modeManager = modeManager;
    this.worldEffectManager = worldEffectManager;
    this.questGenerator = questGenerator;
    this.activeQuests = [];
    this.completedQuests = [];
    this.failedQuests = [];
    // Optional observer of VERIFIED quest completion; no reward policy here.
    this.onQuestCompleted = null;
    this.onQuestFailed = null;
    this.lastCompletionObserverError = null;
  }

  addQuest(questInstance) {
    if (!questInstance || typeof questInstance.id !== 'string'
      || [...this.activeQuests, ...this.completedQuests, ...this.failedQuests]
        .some((quest) => quest.id === questInstance.id)) return false;
    this.activeQuests.push(questInstance);
    return true;
  }

  activateQuest(questId) {
    const quest = this._findActive(questId);
    if (quest) quest.status = 'active';
  }

  updateObjective(questId, objectiveId, outcome) {
    const quest = this._findActive(questId);
    if (!quest) return;
    const objective = quest.objectives?.find((item) => item.id === objectiveId);
    if (objective) objective.outcome = outcome;
    this._checkCompletable(quest);
  }

  _checkCompletable(quest) {
    const availablePaths = (quest.completionPaths ?? []).map((path) => {
      const available = this._isPathAvailable(quest, path);
      return {
        id: path.id,
        label: path.label,
        available,
        reasonIfLocked: available ? null : 'Bu seçenek için gerekli koşul sağlanmadı.',
      };
    });
    if (!availablePaths.some((path) => path.available)) return;
    this.modeManager?.pushOverlay?.('questCompletion', {
      questId: quest.id,
      title: quest.title ?? quest.templateId,
      paths: availablePaths,
    });
  }

  _isPathAvailable(quest, path) {
    if (!path.requiredOutcome) return true;
    return quest.objectives?.some((objective) => objective.outcome === path.requiredOutcome) ?? false;
  }

  completeQuest(questId, selectedPathId) {
    const quest = this._findActive(questId);
    if (!quest) return;
    const path = quest.completionPaths?.find((item) => item.id === selectedPathId);
    if (!path || !this._isPathAvailable(quest, path)) return;
    const effects = [
      ...this._rewardsToEffects(path.rewards),
      ...(path.worldEffects ?? []),
    ];
    for (const effect of effects) this.worldEffectManager?.applyEffect?.(effect);
    quest.status = 'completed';
    quest.completedPath = selectedPathId;
    this.completedQuests.push(quest);
    this.activeQuests = this.activeQuests.filter((item) => item.id !== questId);
    recordCompletedSessionQuest(this, questId);
    this._createChainQuestIfNeeded(quest);
    // Called once AFTER the quest has left activeQuests and entered completedQuests.
    // A failing character observer must never undo an actual quest completion or
    // turn existing player gold/reputation rewards into a second NPC reward.
    if (typeof this.onQuestCompleted === 'function') {
      const receipt = Object.freeze({
        questId: quest.id,
        templateId: quest.templateId,
        pathId: selectedPathId,
        assignedCharacterId: quest.assignedCharacterId ?? null,
      });
      try {
        this.onQuestCompleted(receipt);
      } catch (error) {
        this.lastCompletionObserverError = String(error?.message || error).slice(0, 180);
      }
    }
    return true;
  }

  failQuest(questId, reason) {
    const quest = this._findActive(questId);
    if (!quest) return;
    quest.status = 'failed';
    quest.failReason = reason;
    for (const effect of (quest.failureEffects ?? [])) this.worldEffectManager?.applyEffect?.(effect);
    this.failedQuests.push(quest);
    this.activeQuests = this.activeQuests.filter((item) => item.id !== questId);
    if (typeof this.onQuestFailed === 'function') {
      const receipt = Object.freeze({
        questId: quest.id, templateId: quest.templateId,
        assignedCharacterId: quest.assignedCharacterId ?? null,
        reason: typeof reason === 'string' ? reason : 'unspecified',
      });
      try {
        this.onQuestFailed(receipt);
      } catch (error) {
        this.lastCompletionObserverError = String(error?.message || error).slice(0, 180);
      }
    }
    return true;
  }

  expireQuests(currentDay) {
    for (const quest of [...this.activeQuests]) {
      if (quest.timeLimitDays && quest.createdAt + quest.timeLimitDays < currentDay) this.failQuest(quest.id, 'expired');
    }
  }

  _createChainQuestIfNeeded(quest) {
    if (!quest.chainQuestTemplateId) return;
    const nextQuest = this.questGenerator?.generateFromTemplate?.(quest.chainQuestTemplateId, {
      targetCityId: quest.targetCityId,
      targetRouteId: quest.targetRouteId,
      targetRegionId: quest.targetRegionId,
      targetFortId: quest.targetFortId,
      targetCommanderId: quest.targetCommanderId,
      nearestCityId: quest.nearestCityId,
      issuerFactionId: quest.issuerFactionId,
    });
    if (nextQuest) this.addQuest(nextQuest);
  }

  _rewardsToEffects(rewards) {
    if (!rewards) return [];
    const effects = [];
    if (typeof rewards.gold === 'number') effects.push({ type: 'change_player_gold', amount: rewards.gold });
    if (typeof rewards.reputation === 'number') effects.push({ type: 'change_player_reputation', amount: rewards.reputation });
    if (typeof rewards.honor === 'number') effects.push({ type: 'change_player_honor', amount: rewards.honor });
    if (typeof rewards.nam === 'number') effects.push({ type: 'change_player_nam', amount: rewards.nam });
    return effects;
  }

  _findActive(questId) {
    return this.activeQuests.find((quest) => quest.id === questId) ?? null;
  }
}

export default QuestManager;
