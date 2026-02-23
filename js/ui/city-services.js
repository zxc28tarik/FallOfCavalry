import * as CONST from '../constants.js';

export default class CityServicesUI {
  constructor({ state, party, recruitmentSystem, tradeSystem, onRecruit, onBuy, onSell, onClose }) {
    this.state = state;
    this.party = party;
    this.recruitmentSystem = recruitmentSystem;
    this.tradeSystem = tradeSystem;
    this.onRecruit = onRecruit;
    this.onBuy = onBuy;
    this.onSell = onSell;
    this.onClose = onClose;

    this.dom = {};
    this.bound = false;
    this.currentTab = 'recruit';
    this.currentSettlement = null;
    this.currentRecruitPool = [];
    this.currentMarket = null;
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
      }
      this.render();
    });
  }

  show(settlement, { recruitPool, market } = {}) {
    this.currentSettlement = settlement || null;
    this.currentRecruitPool = Array.isArray(recruitPool) ? recruitPool : [];
    this.currentMarket = market || null;
    this.currentTab = 'recruit';
    this.dom.cityRoot?.classList.remove('hidden');
    this.render();
  }

  hide() {
    this.dom.cityRoot?.classList.add('hidden');
  }

  setData({ recruitPool, market }) {
    if (Array.isArray(recruitPool)) this.currentRecruitPool = recruitPool;
    if (market) this.currentMarket = market;
    this.render();
  }

  render() {
    if (!this.dom.cityList) return;
    if (this.currentTab === 'trade') {
      this.renderTrade();
      return;
    }
    this.renderRecruit();
  }

  renderRecruit() {
    const pool = this.currentRecruitPool || [];
    if (!pool.length) {
      this.dom.cityList.innerHTML = '<div class="text-sm opacity-80">Bu yerleşimde kiralanabilir birlik yok.</div>';
      return;
    }

    this.dom.cityList.innerHTML = pool.map((unit) => {
      const canHire = this.recruitmentSystem.canHire(this.party?.gold || 0, unit);
      return `
        <div class="frame-dark p-3 mb-2 flex items-center justify-between gap-2">
          <div>
            <div class="font-bold text-sm">${unit.label || unit.name}</div>
            <div class="text-xs opacity-80">Sınıf: ${unit.class} · Maliyet: ${unit.cost}g</div>
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

    this.dom.cityList.innerHTML = items.map((item) => {
      const stock = Math.max(0, Math.floor(market.stocks?.[item.id] ?? 0));
      const buyPrice = this.tradeSystem.getPrice(this.currentSettlement, market, item.id, 'buy');
      const sellPrice = this.tradeSystem.getPrice(this.currentSettlement, market, item.id, 'sell');
      const invQty = Math.max(0, Math.floor((this.party?.inventory?.items || []).find((i) => i.id === item.id)?.qty ?? 0));
      return `
        <div class="frame-dark p-3 mb-2">
          <div class="flex items-center justify-between gap-2">
            <div>
              <div class="font-bold text-sm">${item.name}</div>
              <div class="text-xs opacity-80">Stok: ${stock} · Envanter: ${invQty} · Al: ${buyPrice}g · Sat: ${sellPrice}g</div>
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
  }
}
