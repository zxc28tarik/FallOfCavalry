import * as CONST from '../constants.js';
import { getPlayerStanceToFaction, canBuyTruce } from '../systems/diplomacy.js';

export default class CityServicesUI {
  constructor({ state, party, recruitmentSystem, tradeSystem, contractsSystem, onRecruit, onBuy, onSell, onAcceptContract, onCompleteContract, onDiplomacyAction, onClose }) {
  constructor({ state, party, recruitmentSystem, tradeSystem, contractsSystem, onRecruit, onBuy, onSell, onAcceptContract, onCompleteContract, getFactionContext, onClose }) {
    this.state = state;
    this.party = party;
    this.recruitmentSystem = recruitmentSystem;
    this.tradeSystem = tradeSystem;
    this.contractsSystem = contractsSystem;
    this.onRecruit = onRecruit;
    this.onBuy = onBuy;
    this.onSell = onSell;
    this.onAcceptContract = onAcceptContract;
    this.onCompleteContract = onCompleteContract;
    this.onDiplomacyAction = onDiplomacyAction;
    this.getFactionContext = getFactionContext;
    this.onClose = onClose;

    this.dom = {};
    this.bound = false;
    this.currentTab = 'recruit';
    this.currentSettlement = null;
    this.currentRecruitPool = [];
    this.currentMarket = null;
    this.currentContracts = [];
  }

  bind(dom) {
    if (this.bound) return;
    this.bound = true;
    this.dom = dom || {};

    this.dom.btnRecruit?.addEventListener('click', () => {
      this.currentTab = 'recruit';
      this.render();
    });
    this.dom.btnTrade?.addEventListener('click', () => {
      this.currentTab = 'trade';
      this.render();
    });

    if (!this.dom.btnContracts && this.dom.btnTrade?.parentElement) {
      const btn = document.createElement('button');
      btn.id = 'btnContracts';
      btn.className = 'action-btn btn-dark';
      btn.textContent = 'Contracts';
      this.dom.btnTrade.parentElement.appendChild(btn);
      this.dom.btnContracts = btn;
    }

    this.dom.btnContracts?.addEventListener('click', () => {
      this.currentTab = 'contracts';
      this.render();
    });

    if (!this.dom.btnDiplomacy && this.dom.btnTrade?.parentElement) {
      const btn = document.createElement('button');
      btn.id = 'btnDiplomacy';
      btn.className = 'action-btn btn-dark';
      btn.textContent = 'Diplomacy';
      this.dom.btnTrade.parentElement.appendChild(btn);
      this.dom.btnDiplomacy = btn;
    }

    this.dom.btnDiplomacy?.addEventListener('click', () => {
      this.currentTab = 'diplomacy';
      this.render();
    });

    this.dom.cityClose?.addEventListener('click', () => this.onClose?.());

    this.dom.cityList?.addEventListener('click', (event) => {
      const btn = event.target?.closest?.('button[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      const qtyEl = this.dom.cityList.querySelector(`[data-qty-for="${id}"]`);
      const qty = Math.max(1, Math.floor(Number(qtyEl?.value || 1)));

      if (action === 'hire') {
        const unit = this.currentRecruitPool.find((u) => String(u.uid) === String(id));
        if (!unit) return;
        this.onRecruit?.(unit);
      } else if (action === 'buy') {
        this.onBuy?.(id, qty);
      } else if (action === 'sell') {
        this.onSell?.(id, qty);
      } else if (action === 'accept-contract') {
        this.onAcceptContract?.(id);
      } else if (action === 'claim-contract') {
        this.onCompleteContract?.(id);
      } else if (action === 'diplomacy-truce') {
        const ok = this.applyDiplomacyAction('truce', id);
        this.onDiplomacyAction?.({ ok, message: ok ? `Truce bought with ${id}.` : 'Cannot buy truce.' });
      } else if (action === 'diplomacy-improve') {
        const ok = this.applyDiplomacyAction('improve', id);
        this.onDiplomacyAction?.({ ok, message: ok ? `Relations improved with ${id}.` : 'Cannot improve relations.' });
      } else if (action === 'diplomacy-war') {
        this.applyDiplomacyAction('war', id);
        this.onDiplomacyAction?.({ ok: true, message: `War declared on ${id}.` });
      }
      this.render();
    });
  }

  show(settlement, { recruitPool, market, contracts } = {}) {
    this.currentSettlement = settlement || null;
    this.currentRecruitPool = Array.isArray(recruitPool) ? recruitPool : [];
    this.currentMarket = market || null;
    this.currentContracts = Array.isArray(contracts) ? contracts : [];
    this.currentTab = 'recruit';
    this.dom.cityRoot?.classList.remove('hidden');
    this.render();
  }

  hide() {
    this.dom.cityRoot?.classList.add('hidden');
  }

  setData({ settlement, recruitPool, market, contracts }) {
    if (settlement) this.currentSettlement = settlement;
    if (Array.isArray(recruitPool)) this.currentRecruitPool = recruitPool;
    if (market) this.currentMarket = market;
    if (Array.isArray(contracts)) this.currentContracts = contracts;
    this.render();
  }

  render() {
    if (!this.dom.cityList) return;
    this.renderHeader();
    if (this.currentTab === 'trade') {
      this.renderTrade();
      return;
    }
    if (this.currentTab === 'contracts') {
      this.renderContracts();
      return;
    }
    if (this.currentTab === 'diplomacy') {
      this.renderDiplomacy();
      return;
    }
    this.renderRecruit();
  }


  renderHeader() {
    const settlement = this.currentSettlement || {};
    if (this.dom.cityTitle) this.dom.cityTitle.textContent = settlement.name || 'Settlement';
    if (this.dom.citySubtitle) this.dom.citySubtitle.textContent = String(settlement.type || 'town').toUpperCase();

    const factionCtx = typeof this.getFactionContext === 'function' ? this.getFactionContext(settlement) : null;
    if (this.dom.cityRelation) {
      if (factionCtx) {
        this.dom.cityRelation.textContent = `${factionCtx.ownerFactionName} · REL ${Math.floor(factionCtx.relation)} · ${factionCtx.stance}`;
      } else {
        this.dom.cityRelation.textContent = '-';
      }
    }
    if (this.dom.citySubtitle && factionCtx) {
      this.dom.citySubtitle.textContent = `${String(settlement.type || 'town').toUpperCase()} · Owner: ${factionCtx.ownerFactionName}`;
    }
  }

  renderRecruit() {
    const pool = this.currentRecruitPool || [];
    if (!pool.length) {
      this.dom.cityList.innerHTML = '<div class="text-sm opacity-80">Bu yerleşimde kiralanabilir birlik yok.</div>';
      return;
    }

    const classDescriptions = {
      heavy_inf: 'Heavy Infantry — durable frontline, slow.',
      elite_cav: 'Elite Cavalry — fast, expensive shock cavalry.',
      siege: 'Siege Breaker — slow unit with huge impact on enemy lines.',
    };

    this.dom.cityList.innerHTML = pool.map((unit) => {
      const canHire = this.recruitmentSystem.canHire(this.party?.gold || 0, unit);
      const desc = classDescriptions[String(unit.class || '').toLowerCase()] || '';
      return `
        <div class="frame-dark p-3 mb-2 flex items-center justify-between gap-2">
          <div>
            <div class="font-bold text-sm">${unit.label || unit.name}</div>
            <div class="text-xs opacity-80">Sınıf: ${unit.class} · Maliyet: ${unit.cost}g</div>
            ${desc ? `<div class="text-xs opacity-70">${desc}</div>` : ''}
          </div>
          <button class="action-btn ${canHire ? 'btn-gold' : 'btn-dark'} text-xs" data-action="hire" data-id="${unit.uid}" ${canHire ? '' : 'disabled'}>Kirala</button>
        </div>
      `;
    }).join('');
  }

  renderTrade() {
    const market = this.currentMarket;
    const items = CONST.TRADE_ITEMS || [];
    if (!market || !items.length) {
      this.dom.cityList.innerHTML = '<div class="text-sm opacity-80">Pazar verisi yok.</div>';
      return;
    }

    const day = Number(this.state?.day ?? 1);
    const settlementKey = this.currentSettlement?.id || `${this.currentSettlement?.tx},${this.currentSettlement?.ty}`;
    const activeOpportunity = this.state?.marketOpportunities?.[settlementKey];
    const opportunityDaysLeft = activeOpportunity
      ? Math.max(0, Number(activeOpportunity.expiresDay ?? day) - day)
      : 0;

    this.dom.cityList.innerHTML = items.map((item) => {
      const stock = Math.max(0, Math.floor(market.stocks?.[item.id] ?? 0));
      const priceOpts = {
        day,
        settlementKey,
        marketOpportunities: this.state?.marketOpportunities,
        tuning: this.state?.tuning,
        factions: this.state?.factions,
        playerFactionId: 'player',
        ownerFactionId: this.currentSettlement?.ownerFactionId || this.currentSettlement?.owner || null,
        diplomacyCfg: this.state?.tuning?.DIPLOMACY_ACTIONS || CONST.DIPLOMACY_ACTIONS,
        diplomacyRelations: CONST.DIPLOMACY_RELATIONS,
      };
      const buyPrice = this.tradeSystem.getPrice(this.currentSettlement, market, item.id, 'buy', priceOpts);
      const sellPrice = this.tradeSystem.getPrice(this.currentSettlement, market, item.id, 'sell', priceOpts);
      const invQty = Math.max(0, Math.floor((this.party?.inventory?.items || []).find((i) => i.id === item.id)?.qty ?? 0));
      const hasOpportunity = activeOpportunity && activeOpportunity.itemId === item.id && opportunityDaysLeft > 0;
      const opportunityBadge = hasOpportunity
        ? `<div class="text-xs text-amber-300">Fırsat: +%${Math.round(activeOpportunity.bonusPct)} (${opportunityDaysLeft} gün)</div>`
        : '';
      return `
        <div class="frame-dark p-3 mb-2">
          <div class="flex items-center justify-between gap-2">
            <div>
              <div class="font-bold text-sm">${item.name}</div>
              <div class="text-xs opacity-80">Stok: ${stock} · Envanter: ${invQty} · Al: ${buyPrice}g · Sat: ${sellPrice}g</div>
              ${opportunityBadge}
            </div>
            <div class="flex items-center gap-2">
              <input data-qty-for="${item.id}" type="number" value="1" min="1" class="select-dark text-xs w-16" />
              <button class="action-btn btn-gold text-xs" data-action="buy" data-id="${item.id}">Buy</button>
              <button class="action-btn btn-dark text-xs" data-action="sell" data-id="${item.id}">Sell</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (activeOpportunity && opportunityDaysLeft > 0) {
      const header = document.createElement('div');
      header.className = 'text-xs text-amber-300 mb-2';
      header.textContent = 'Pazar fırsatı var.';
      this.dom.cityList.prepend(header);
    }
  }

  renderContracts() {
    const offers = Array.isArray(this.currentContracts) ? this.currentContracts : [];
    const activeContracts = Array.isArray(this.party?.contracts) ? this.party.contracts : [];
    const acceptedIds = new Set(activeContracts.map((c) => c.id));

    const offerMarkup = offers.map((contract) => {
      const accepted = acceptedIds.has(contract.id);
      const label = this.describeContract(contract);
      return `
        <div class="frame-dark p-3 mb-2 flex items-center justify-between gap-2">
          <div>
            <div class="font-bold text-sm">${label.title}</div>
            <div class="text-xs opacity-80">${label.desc}</div>
          </div>
          <button class="action-btn ${accepted ? 'btn-dark' : 'btn-gold'} text-xs" data-action="accept-contract" data-id="${contract.id}" ${accepted ? 'disabled' : ''}>${accepted ? 'Accepted' : 'Accept'}</button>
        </div>
      `;
    }).join('');

    const activeMarkup = activeContracts.map((contract) => {
      const label = this.describeContract(contract);
      const goal = contract.type === 'DELIVER' ? (contract.requiredAmount ?? contract.requiredCount ?? 1) : (contract.requiredCount ?? 1);
      const ready = Boolean(contract.completed);
      return `
        <div class="frame-dark p-3 mb-2 flex items-center justify-between gap-2">
          <div>
            <div class="font-bold text-sm">${label.title}</div>
            <div class="text-xs opacity-80">Progress: ${Math.floor(contract.progress || 0)} / ${Math.floor(goal)} · Reward: ${contract.rewardGold}g, ${contract.rewardRenown} renown</div>
          </div>
          <button class="action-btn ${ready ? 'btn-gold' : 'btn-dark'} text-xs" data-action="claim-contract" data-id="${contract.id}" ${ready ? '' : 'disabled'}>${ready ? 'Claim' : 'In Progress'}</button>
        </div>
      `;
    }).join('');

    this.dom.cityList.innerHTML = `
      <div class="text-xs opacity-75 mb-2">Board Contracts</div>
      ${offerMarkup || '<div class="text-sm opacity-80 mb-3">Bugün için kontrat bulunmuyor.</div>'}
      <div class="text-xs opacity-75 mt-4 mb-2">Accepted Contracts</div>
      ${activeMarkup || '<div class="text-sm opacity-80">Aktif kontrat yok.</div>'}
    `;
  }


  applyDiplomacyAction(action, factionId) {
    if (!this.state?.factions || !factionId) return false;
    const cfg = this.state?.tuning?.DIPLOMACY_ACTIONS || CONST.DIPLOMACY_ACTIONS;
    if (action === 'truce') {
      return this.state?.diplomacyOps?.buyTruce
        ? Boolean(this.state.diplomacyOps.buyTruce({ factions: this.state.factions, targetFactionId: factionId, party: this.party, cfg }))
        : false;
    }
    if (action === 'improve') {
      return this.state?.diplomacyOps?.improveRelations
        ? Boolean(this.state.diplomacyOps.improveRelations({ factions: this.state.factions, targetFactionId: factionId, party: this.party, cfg }))
        : false;
    }
    if (action === 'war') {
      if (this.state?.diplomacyOps?.declareWar) this.state.diplomacyOps.declareWar({ factions: this.state.factions, targetFactionId: factionId, cfg });
      return true;
    }
    return false;
  }

  renderDiplomacy() {
    const factions = Array.isArray(CONST.FACTIONS) ? CONST.FACTIONS.filter((f) => f?.id && f.id !== 'bandit') : [];
    if (!factions.length) {
      this.dom.cityList.innerHTML = '<div class="text-sm opacity-80">Faction data unavailable.</div>';
      return;
    }

    const cfg = this.state?.tuning?.DIPLOMACY_ACTIONS || CONST.DIPLOMACY_ACTIONS;
    this.dom.cityList.innerHTML = factions.map((faction) => {
      const stanceData = getPlayerStanceToFaction(this.state?.factions, faction.id, CONST.DIPLOMACY_RELATIONS);
      const truceEnabled = canBuyTruce({ factions: this.state?.factions, targetFactionId: faction.id, party: this.party, cfg });
      const canImprove = stanceData.stance === 'NEUTRAL' || stanceData.stance === 'WAR';
      const canWar = stanceData.stance === 'NEUTRAL' || stanceData.stance === 'ALLY';
      return `
        <div class="frame-dark p-3 mb-2 flex items-center justify-between gap-2">
          <div>
            <div class="font-bold text-sm">${faction.name}</div>
            <div class="text-xs opacity-80">Relation: ${stanceData.relation} · Stance: ${stanceData.stance}</div>
          </div>
          <div class="flex items-center gap-2">
            <button class="action-btn btn-dark text-xs" data-action="diplomacy-truce" data-id="${faction.id}" ${truceEnabled ? '' : 'disabled'}>Buy Truce (${cfg.TRUCE_COST_GOLD}g)</button>
            <button class="action-btn btn-gold text-xs" data-action="diplomacy-improve" data-id="${faction.id}" ${canImprove ? '' : 'disabled'}>Improve (${cfg.IMPROVE_RELATION_COST_GOLD}g)</button>
            <button class="action-btn btn-dark text-xs" data-action="diplomacy-war" data-id="${faction.id}" ${canWar ? '' : 'disabled'}>Declare War</button>
          </div>
        </div>
      `;
    }).join('');
  }

  describeContract(contract) {
    if (!contract || typeof contract !== 'object') return { title: 'Unknown', desc: '' };
    if (contract.type === 'BANDIT') {
      return {
        title: 'Clear Bandit Patrol',
        desc: `Win ${contract.requiredCount || 1} battle(s) against bandits.`,
      };
    }
    if (contract.type === 'DELIVER') {
      return {
        title: 'Deliver Food Caravan',
        desc: `Deliver ${contract.requiredAmount || contract.requiredCount || 1} food to ${contract.targetCityId || 'target city'}.`,
      };
    }
    return {
      title: 'Scout Nearby Ruin',
      desc: `Explore ruin ${contract.targetPoiId || 'target'} and report back.`,
    };
  }
}
