/**
 * CityManager — Phase 8B
 * Manages city services UI setup (recruit, buy, sell, contracts, diplomacy).
 */

import CityServicesUI from '../ui/city-services.js';
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
  }

  init(game) {
    this.game = game;
  }

  update(dt) {
    if (this.state.mode !== 'city') return;
    // City update logic — extended in future phases
  }

  enterCity(city) {
    this.currentCity = city;
    this.state.mode = 'city';
  }

  exitCity() {
    this.currentCity = null;
    this.state.mode = 'map';
  }

  render(ctx) {
    // City render logic — handled by RenderManager
  }

  // ─── Phase 8B: City services UI wiring ──────────────────────────────────────

  setupCityServicesUI() {
    const g = this.game;
    if (g.cityUI) return;
    g.cityUI = new CityServicesUI({
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
          g.setLastEventLog(result.message || 'Birlik kiralandı.');
          g.runAutosave('recruit');
        } else {
          g.setLastEventLog(result?.message || 'Kiralama başarısız.');
        }
      },
      onBuy: (itemId, qty) => {
        const settlement = this.state?.city;
        if (!settlement) return;
        const market = g.getOrCreateMarketForSettlement(settlement);
        const result = tradeSystem.buy(g.playerParty, market, settlement, itemId, qty, {
          day: this.state?.day,
          settlementKey: g.getSettlementOpportunityKey(settlement),
          marketOpportunities: this.state?.marketOpportunities,
          tuning: this.state?.tuning,
          factions: this.state?.factions,
          playerFactionId: 'player',
          ownerFactionId: settlement?.ownerFactionId || settlement?.owner || null,
          diplomacyCfg: CONST.DIPLOMACY_ACTIONS,
          diplomacyRelations: CONST.DIPLOMACY_RELATIONS,
          activeRegionModifiers: getActiveRegionModifiers(this.state?.regionState, g.getRegionIdAtTile(settlement.tx, settlement.ty), this.state?.day),
        });
        g.ensureInventoryModel();
        this.state.markets[settlement.id] = market;
        if (result?.ok) {
          this.state.dailyLedger = this.state.dailyLedger && typeof this.state.dailyLedger === 'object'
            ? this.state.dailyLedger
            : { tradePL: 0 };
          this.state.dailyLedger.tradePL = Number(this.state.dailyLedger.tradePL ?? 0) - Number(result?.spentGold ?? 0);
        }
        g.setLastEventLog(result?.message || 'İşlem tamamlandı.');
        if (result?.ok) g.runAutosave('trade');
      },
      onSell: (itemId, qty) => {
        const settlement = this.state?.city;
        if (!settlement) return;
        const market = g.getOrCreateMarketForSettlement(settlement);
        const result = tradeSystem.sell(g.playerParty, market, settlement, itemId, qty, {
          day: this.state?.day,
          settlementKey: g.getSettlementOpportunityKey(settlement),
          marketOpportunities: this.state?.marketOpportunities,
          tuning: this.state?.tuning,
          factions: this.state?.factions,
          playerFactionId: 'player',
          ownerFactionId: settlement?.ownerFactionId || settlement?.owner || null,
          diplomacyCfg: CONST.DIPLOMACY_ACTIONS,
          diplomacyRelations: CONST.DIPLOMACY_RELATIONS,
          activeRegionModifiers: getActiveRegionModifiers(this.state?.regionState, g.getRegionIdAtTile(settlement.tx, settlement.ty), this.state?.day),
        });
        g.ensureInventoryModel();
        this.state.markets[settlement.id] = market;
        if (result?.ok) {
          this.state.dailyLedger = this.state.dailyLedger && typeof this.state.dailyLedger === 'object'
            ? this.state.dailyLedger
            : { tradePL: 0 };
          this.state.dailyLedger.tradePL = Number(this.state.dailyLedger.tradePL ?? 0) + Number(result?.earnedGold ?? 0);
        }
        g.setLastEventLog(result?.message || 'İşlem tamamlandı.');
        if (result?.ok && itemId === 'grain') {
          emitContractEvent({ type: 'DELIVERED', itemId: 'food', qty, cityId: settlement.id }, g.playerParty);
        }
        if (result?.ok) g.runAutosave('trade');
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
        if (accepted) g.setLastEventLog('Contract accepted.');
      },
      onCompleteContract: (contractId) => {
        const completed = completeContract(contractId, g.playerParty, {
          warState: this.state?.warState,
          factions: this.state?.factions,
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
          const mult = g.getRenownGainMultAtCurrentRegion();
          const boosted = Math.max(baseRenown, Math.floor(baseRenown * mult));
          const extra = Math.max(0, boosted - baseRenown);
          if (extra > 0) g.playerParty.renown = Math.floor(Number(g.playerParty.renown ?? 0) + extra);
          const bonusText = bonus > 0 ? ` (+${bonus} war bonus)` : '';
          g.setLastEventLog(`Contract completed: +${completed.rewardGold}g, +${boosted} renown${bonusText}${extra > 0 ? ' (pilgrimage bonus)' : ''}`);
        }
      },
      onDiplomacyAction: (summary) => {
        g.ensureFactionState();
        if (summary?.ok) {
          g.setLastEventLog(summary.message || 'Diplomacy action completed.');
          g.runAutosave('diplomacy');
        } else if (summary?.message) {
          g.setLastEventLog(summary.message);
        }
      },
      getFactionContext: (settlement) => g.getCityFactionContext(settlement),
      onClose: () => g.exitCityServices(),
    });

    g.cityUI.bind({
      cityRoot: utils.getEl('settlementModal'),
      btnRecruit: utils.getEl('btnRecruit'),
      btnTrade: utils.getEl('btnTrade'),
      btnContracts: utils.getEl('btnContracts'),
      cityClose: utils.getEl('btnLeaveSettlement') || utils.getEl('btnCloseSettlement'),
      cityList: utils.getEl('settlementLore'),
      cityTitle: utils.getEl('settlementTitle'),
      citySubtitle: utils.getEl('settlementSubtitle'),
      cityRelation: utils.getEl('settlementRelation'),
    });
  }
}
