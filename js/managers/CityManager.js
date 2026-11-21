/**
 * CityManager - Phase 8B
 * Manages city services UI setup (recruit, buy, sell, contracts, diplomacy).
 */

import CityServicesUI from '../ui/city-services.js';
import { applyCivicDecision } from '../systems/city-civic-decisions.js';
import { applyCouncilReactions } from '../systems/city-civic-character-reactions.js';
import * as recruitmentSystem from '../systems/recruitment.js';
import * as tradeSystem from '../systems/trade.js';
import { acceptContract, completeContract, emitContractEvent } from '../systems/contracts.js';
import { applyContractRelationBonus } from '../systems/diplomacy.js';
import { getActiveRegionModifiers } from '../systems/region-state.js';
import * as CONST from '../constants.js';
import * as utils from '../utils.js';

export class CityManager {
  constructor(gameState) {
    this.state = gameState;
    this.game = null;
    this.currentCity = null;
    this.cityUI = null;
  }

  init(game) {
    this.game = game;
  }

  update(_dt) {
    if (this.state.mode !== 'city') return;
    // City update logic - extended in future phases
  }

  enterCity(city) {
    this.currentCity = city;
    this.state.currentCity = city;
    this.game?.gameFlowManager?.enterCity?.(city?.id);
  }

  exitCity() {
    this.currentCity = null;
    this.state.currentCity = null;
    this.game?.gameFlowManager?.exitCity?.();
  }

  render(_ctx) {
    // City render logic - handled by RenderManager
  }

  increaseSecurity(cityId, amount = 0) {
    const city = this.findCityById(cityId);
    if (!city) return false;
    city.security = Math.max(0, Math.min(100, Math.floor(Number(city.security ?? 50) + Number(amount || 0))));
    city.civicDirty=true;
    return true;
  }

  decreaseSecurity(cityId, amount = 0) {
    return this.increaseSecurity(cityId, -Math.abs(Number(amount || 0)));
  }

  findCityById(cityId) {
    if (!cityId) return null;
    return (this.state?.map?.settlements || []).find((settlement) => settlement?.id === cityId) || null;
  }

  pickQuestTargetCity(rule, _context = {}) {
    const settlements = (this.state?.map?.settlements || []).filter((settlement) => settlement?.id);
    if (!settlements.length) return null;
    if (rule === 'city_with_low_security') {
      const sorted = [...settlements].sort((a, b) => Number(a.security ?? 50) - Number(b.security ?? 50));
      return sorted[0]?.id || null;
    }
    return settlements[0]?.id || null;
  }

  findNearestCityToLocation(locationId) {
    const target = this.findCityById(locationId);
    const settlements = (this.state?.map?.settlements || []).filter((settlement) => settlement?.id);
    if (!target || !settlements.length) return null;
    let best = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const city of settlements) {
      if (city.id === target.id) continue;
      const dist = Math.hypot(Number(city.x ?? 0) - Number(target.x ?? 0), Number(city.y ?? 0) - Number(target.y ?? 0));
      if (dist < bestDist) {
        best = city;
        bestDist = dist;
      }
    }
    return best?.id || null;
  }

  // --- Phase 8B: City services UI wiring -----

  setupCityServicesUI() {
    const g = this.game;
    if (g?.cityUI && !this.cityUI) {
      this.cityUI = g.cityUI;
      return;
    }
    if (this.cityUI) {
      g.cityUI = this.cityUI;
      return;
    }
    this.cityUI = new CityServicesUI({
      state: this.state,
      party: g.playerParty,
      recruitmentSystem,
      tradeSystem,
      onRecruit: (unit) => {
        const result = recruitmentSystem.hireUnit(g.playerParty, unit);
        if (result?.ok) {
          if (Array.isArray(this.state?.city?.recruitPool)) {
            this.state.city.recruitPool = this.state.city.recruitPool.filter((it) => it.uid !== unit.uid);
          }
          g.gameFlowManager.setLastEventLog(result.message || 'Birlik kiralandı.');
          g.saveManager.runAutosave('recruit');
        } else {
          g.gameFlowManager.setLastEventLog(result?.message || 'Kiralama başarısız.');
        }
      },
      onBuy: (itemId, qty) => {
        const settlement = this.state?.city;
        if (!settlement) return;
        const market = g.economyManager.getOrCreateMarketForSettlement(settlement);
        const result = tradeSystem.buy(g.playerParty, market, settlement, itemId, qty, {
          day: this.state?.day,
          settlementKey: g.economyManager.getSettlementOpportunityKey(settlement),
          marketOpportunities: this.state?.marketOpportunities,
          tuning: this.state?.tuning,
          factions: this.state?.factions,
          playerFactionId: 'player',
          ownerFactionId: settlement?.ownerFactionId || settlement?.owner || null,
          diplomacyCfg: CONST.DIPLOMACY_ACTIONS,
          diplomacyRelations: CONST.DIPLOMACY_RELATIONS,
          activeRegionModifiers: getActiveRegionModifiers(this.state?.regionState, g.worldManager.getRegionIdAtTile(settlement.tx, settlement.ty), this.state?.day),
        });
        g.economyManager.ensureInventoryModel();
        this.state.markets[settlement.id] = market;
        if (result?.ok) {
          this.state.dailyLedger = this.state.dailyLedger && typeof this.state.dailyLedger === 'object'
            ? this.state.dailyLedger
            : { tradePL: 0 };
          this.state.dailyLedger.tradePL = Number(this.state.dailyLedger.tradePL ?? 0) - Number(result?.spentGold ?? 0);
        }
        g.gameFlowManager.setLastEventLog(result?.message || 'İşlem tamamlandı.');
        if (result?.ok) g.saveManager.runAutosave('trade');
      },
      onSell: (itemId, qty) => {
        const settlement = this.state?.city;
        if (!settlement) return;
        const market = g.economyManager.getOrCreateMarketForSettlement(settlement);
        const result = tradeSystem.sell(g.playerParty, market, settlement, itemId, qty, {
          day: this.state?.day,
          settlementKey: g.economyManager.getSettlementOpportunityKey(settlement),
          marketOpportunities: this.state?.marketOpportunities,
          tuning: this.state?.tuning,
          factions: this.state?.factions,
          playerFactionId: 'player',
          ownerFactionId: settlement?.ownerFactionId || settlement?.owner || null,
          diplomacyCfg: CONST.DIPLOMACY_ACTIONS,
          diplomacyRelations: CONST.DIPLOMACY_RELATIONS,
          activeRegionModifiers: getActiveRegionModifiers(this.state?.regionState, g.worldManager.getRegionIdAtTile(settlement.tx, settlement.ty), this.state?.day),
        });
        g.economyManager.ensureInventoryModel();
        this.state.markets[settlement.id] = market;
        if (result?.ok) {
          this.state.dailyLedger = this.state.dailyLedger && typeof this.state.dailyLedger === 'object'
            ? this.state.dailyLedger
            : { tradePL: 0 };
          this.state.dailyLedger.tradePL = Number(this.state.dailyLedger.tradePL ?? 0) + Number(result?.earnedGold ?? 0);
        }
        g.gameFlowManager.setLastEventLog(result?.message || 'İşlem tamamlandı.');
        if (result?.ok && (CONST.normalizeTradeGoodId?.(itemId) || itemId) === 'wheat') {
          emitContractEvent({ type: 'DELIVERED', itemId: 'food', qty, cityId: settlement.id }, g.playerParty);
        }
        if (result?.ok) g.saveManager.runAutosave('trade');
      },
      onAcceptContract: (contractId) => {
        const accepted = acceptContract(contractId, g.playerParty);
        if (accepted?.type === 'ESCORT') {
          this.state.escortState = {
            contractId: accepted.id,
            fromCityId: accepted.cityId,
            toCityId: accepted.targetCityId,
            maxBanditEncounters: Number(accepted.maxBanditEncounters ?? 1),
            banditEncounters: 0,
            active: true,
          };
        }
        if (accepted) {
          g.gameFlowManager.setLastEventLog('Contract accepted.');
          g.saveManager?.runAutosave?.('contract-accepted');
        }
      },
      onCompleteContract: (contractId) => {
        const completed = completeContract(contractId, g.playerParty, {
          warState: this.state?.warState,
          factions: this.state?.factions,
          onCivicFollowup: (contract) => {
            const city=(this.state?.map?.settlements||[]).find(row=>
              String(row.id)===String(contract.cityId));
            if(!city)return;
            city.security=Math.max(0,Math.min(100,Math.floor(
              Number(city.security??50)+Number(contract.civicSecurityBonus??0),
            )));
            city.civicDirty=true;
          },
          onCivicDispatch: (contract) => {
            const cities=this.state?.map?.settlements||[];
            const ids=new Set((contract.dispatchStops||[]).map(String));
            ids.add(String(contract.cityId));
            for(const city of cities){
              if(!ids.has(String(city.id)))continue;
              city.civicDirty=true;
              city.security=Math.max(0,Math.min(100,Math.floor(
                Number(city.security??50)+Number(contract.civicSecurityBonus??1),
              )));
            }
          },
          onCivicRelief: (contract) => {
            const beneficiary=(this.state?.map?.settlements||[]).find(city=>
              String(city.id)===String(contract.targetCityId));
            if (beneficiary) {
              beneficiary.civicDirty=true;
              beneficiary.security=Math.max(0,Math.min(100,
              Math.floor(Number(beneficiary.security??50)
                + Number(contract.civicSecurityBonus??3))));
            }
          },
          onRelationBonus: (contract) => {
            const currentCityFactionId = this.state?.city?.ownerFactionId || this.state?.city?.owner || null;
            applyContractRelationBonus({
              factions: this.state?.factions,
              contract: { ...contract, factionId: contract.factionId || currentCityFactionId },
              cfg: CONST.DIPLOMACY_ACTIONS,
            });
          },
        });
        if (completed) {
          const bonus = Number(completed?.bonusRenown ?? 0);
          const baseRenown = Number(completed.rewardRenown ?? 0) + bonus;
          const mult = g.worldManager.getRenownGainMultAtCurrentRegion();
          const boosted = Math.max(baseRenown, Math.floor(baseRenown * mult));
          const extra = Math.max(0, boosted - baseRenown);
          if (extra > 0) g.playerParty.renown = Math.floor(Number(g.playerParty.renown ?? 0) + extra);
          const bonusText = bonus > 0 ? ` (+${bonus} war bonus)` : '';
          g.gameFlowManager.setLastEventLog(`Contract completed: +${completed.rewardGold}g, +${boosted} renown${bonusText}${extra > 0 ? ' (pilgrimage bonus)' : ''}`);
          g.saveManager?.runAutosave?.('contract-completed');
        }
      },
      onDiplomacyAction: (summary) => {
        g.diplomacyManager.ensureFactionState();
        if (summary?.ok) {
          g.gameFlowManager.setLastEventLog(summary.message || 'Diplomacy action completed.');
          g.saveManager.runAutosave('diplomacy');
        } else if (summary?.message) {
          g.gameFlowManager.setLastEventLog(summary.message);
        }
      },
      onHeal: (index) => {
        g.economyManager.cityHealerCursor = Math.max(0, Math.floor(Number(index) || 0));
        const ok = g.economyManager.healCurrentUnit();
        if (ok) g.saveManager.runAutosave('healing');
      },
      onCivicDecision: (decisionId) => {
        const result=applyCivicDecision({
          city:this.state?.city,party:g.playerParty,day:this.state?.day,decisionId,
        });
        if(result.ok){
          const reactions=applyCouncilReactions({
            roster:this.state?.worldCharacters,
            cityId:this.state?.city?.id,decisionId,day:Math.max(1,Math.floor(Number(this.state?.day)||1)),
          });
          result.characterReactions=reactions;
          g.saveManager?.runAutosave?.('city-civic-decision');
        }
        g.gameFlowManager?.setLastEventLog?.(result.message);
        return result;
      },
      onConstruct: (result) => {
        g.gameFlowManager.setLastEventLog(result?.message || 'Insaat tamamlandi.');
        g.saveManager.runAutosave('city-build');
      },
      getQuestManager: () => g.questManager,
      onAssignQuest: (questId, characterId, reason) => {
        const ok = g.gameFlowManager.assignWorldCharacterToQuest(questId, characterId, {
          reason,
        });
        g.gameFlowManager.setLastEventLog(ok
          ? 'Önemli karakter gerçek göreve atandı.'
          : 'Görevlendirme reddedildi; karakter görevi veya hedef uyuşmuyor.');
        if (ok) g.saveManager.runAutosave('character-quest-assignment');
        return ok;
      },
      getFactionContext: (settlement) => g.diplomacyManager.getCityFactionContext(settlement),
      onClose: () => g.economyManager.exitCityServices(),
    });

    this.cityUI.bind({
      cityRoot: utils.getEl('citySceneModal') || utils.getEl('settlementModal'),
      btnRecruit: utils.getEl('btnRecruit'),
      btnTrade: utils.getEl('btnTrade'),
      btnContracts: utils.getEl('btnContracts', { silent: true }),
      cityClose: utils.getEl('btnCloseCityScene') || utils.getEl('btnLeaveSettlement') || utils.getEl('btnCloseSettlement'),
      cityList: utils.getEl('settlementLore'),
      cityTitle: utils.getEl('citySceneTitle') || utils.getEl('settlementTitle'),
      citySubtitle: utils.getEl('citySceneSubtitle') || utils.getEl('settlementSubtitle'),
      cityRelation: utils.getEl('citySceneRelation') || utils.getEl('settlementRelation'),
      citySummary: utils.getEl('citySceneSummary'),
      cityWarnings: utils.getEl('citySceneWarnings'),
      citySceneStage: utils.getEl('citySceneStage'),
      citySceneHotspots: utils.getEl('citySceneHotspots'),
      cityServiceChips: utils.getEl('citySceneServiceChips'),
      cityPanelTitle: utils.getEl('cityScenePanelTitle'),
      cityPanelMeta: utils.getEl('cityScenePanelMeta'),
      cityPanelBody: utils.getEl('cityScenePanelBody'),
    });

    g.cityUI = this.cityUI;
  }
}
