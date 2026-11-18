import * as CONST from '../constants.js';
import {
  CHARACTER_STAT_KEYS, getSettlementCharacters, getWorldCharacterAge,
  getWorldCharacterProfile, NPC_ROLE_LABELS, NPC_TRAIT_LABELS, NPC_STAT_LABELS,
} from '../systems/world-characters.js';
import { getPlayerStanceToFaction, canBuyTruce } from '../systems/diplomacy.js';
import {
  CITY_SERVICE,
  CITY_SERVICE_LABELS,
  getCityBuildingDef,
} from '../data/city-building-catalog.js';
import {
  CITY_AREA_FILL_LABELS,
  CITY_PARCEL_STATE,
  canPlayerManageSettlement,
  canUseCityService,
  constructBuildingOnParcel,
  ensureSettlementCityState,
  getCityServiceRequirementText,
  listBuildOptionsForParcel,
} from '../systems/city-state.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export default class CityServicesUI {
  constructor({
    state,
    party,
    recruitmentSystem,
    tradeSystem,
    contractsSystem,
    onRecruit,
    onBuy,
    onSell,
    onAcceptContract,
    onCompleteContract,
    onDiplomacyAction,
    getFactionContext,
    onClose,
    onHeal,
    onConstruct,
  }) {
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
    this.onHeal = onHeal;
    this.onConstruct = onConstruct;

    this.dom = {};
    this.bound = false;
    this.currentSettlement = null;
    this.currentRecruitPool = [];
    this.currentMarket = null;
    this.currentContracts = [];
    this.currentView = { type: 'overview', serviceId: null, parcelId: null, buildingId: null };
  }

  bind(dom) {
    if (this.bound) return;
    this.bound = true;
    this.dom = dom || {};

    this.dom.cityClose?.addEventListener('click', () => this.onClose?.());
    this.dom.citySceneHotspots?.addEventListener('click', (event) => {
      const hotspot = event.target?.closest?.('[data-city-parcel-id]');
      if (!hotspot) return;
      this.openParcel(hotspot.dataset.cityParcelId);
    });
    this.dom.cityServiceChips?.addEventListener('click', (event) => {
      const btn = event.target?.closest?.('button[data-action="open-service"]');
      if (!btn) return;
      this.openService(btn.dataset.id);
    });

    this.getPanelBodyEl()?.addEventListener('click', (event) => {
      const btn = event.target?.closest?.('button[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      const qtyEl = this.getPanelBodyEl().querySelector?.(`[data-qty-for="${id}"]`);
      const qty = Math.max(1, Math.floor(Number(qtyEl?.value || 1)));

      if (action === 'hire') {
        const unit = this.currentRecruitPool.find((entry) => String(entry.uid) === String(id));
        if (unit) this.onRecruit?.(unit);
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
        this.onDiplomacyAction?.({ ok, message: ok ? `Ateskes satin alindi: ${id}` : 'Ateskes alinmadi.' });
      } else if (action === 'diplomacy-improve') {
        const ok = this.applyDiplomacyAction('improve', id);
        this.onDiplomacyAction?.({ ok, message: ok ? `Iliskiler iyilestirildi: ${id}` : 'Iliskiler iyilestirilemedi.' });
      } else if (action === 'diplomacy-war') {
        this.applyDiplomacyAction('war', id);
        this.onDiplomacyAction?.({ ok: true, message: `Savas ilan edildi: ${id}` });
      } else if (action === 'heal-unit') {
        this.onHeal?.(id);
      } else if (action === 'show-overview') {
        this.currentView = { type: 'overview', serviceId: null, parcelId: null, buildingId: null };
      } else if (action === 'open-npc') {
        const isHere = getSettlementCharacters(this.state?.worldCharacters, this.currentSettlement?.id)
          .some((person) => person.id === id);
        if (isHere) this.currentView = { type: 'npc', npcId: id };
      } else if (action === 'open-service') {
        this.currentView = { type: 'service', serviceId: id, parcelId: btn.dataset.parcelId || null, buildingId: null };
      } else if (action === 'open-area') {
        this.currentView = { type: 'area', serviceId: null, parcelId: id || btn.dataset.parcelId || null, buildingId: null };
      } else if (action === 'open-building') {
        this.currentView = {
          type: 'building',
          serviceId: null,
          parcelId: btn.dataset.parcelId || null,
          buildingId: id,
        };
      } else if (action === 'build-construct') {
        const parcelId = btn.dataset.parcelId;
        const buildingId = id;
        const result = constructBuildingOnParcel(this.currentSettlement, parcelId, buildingId, {
          playerFactionId: this.party?.factionId || CONST.FACTION.ID.PLAYER,
          availableGold: Number(this.party?.gold ?? 0),
        });
        if (result.ok) {
          this.party.gold = Math.max(0, Number(this.party?.gold ?? 0) - Number(result.cost ?? 0));
          this.onConstruct?.(result);
          this.currentView = { type: 'area', serviceId: null, parcelId, buildingId: null };
        }
      }

      this.render();
    });
  }

  getPanelBodyEl() {
    return this.dom.cityPanelBody || this.dom.cityList || null;
  }

  show(settlement, { recruitPool, market, contracts } = {}) {
    this.currentSettlement = settlement || null;
    this.currentRecruitPool = Array.isArray(recruitPool) ? recruitPool : [];
    this.currentMarket = market || null;
    this.currentContracts = Array.isArray(contracts) ? contracts : [];
    this.currentView = { type: 'overview', serviceId: null, parcelId: null, buildingId: null };
    this.dom.cityRoot?.classList.remove('hidden');
    this.render();
  }

  hide() {
    this.dom.cityRoot?.classList.add('hidden');
    this.currentView = { type: 'overview', serviceId: null, parcelId: null, buildingId: null };
  }

  setData({ settlement, recruitPool, market, contracts }) {
    if (settlement) this.currentSettlement = settlement;
    if (Array.isArray(recruitPool)) this.currentRecruitPool = recruitPool;
    if (market) this.currentMarket = market;
    if (Array.isArray(contracts)) this.currentContracts = contracts;
    this.render();
  }

  openParcel(parcelId) {
    const cityState = ensureSettlementCityState(this.currentSettlement);
    const parcel = cityState?.parcels?.find((entry) => entry.id === parcelId);
    if (!parcel) return;
    if (parcel.state === CITY_PARCEL_STATE.LOCKED) {
      this.currentView = { type: 'locked', serviceId: null, parcelId, buildingId: null };
      this.render();
      return;
    }
    this.currentView = { type: 'area', serviceId: null, parcelId, buildingId: null };
    this.render();
  }

  openService(serviceId, parcelId = null) {
    this.currentView = { type: 'service', serviceId, parcelId, buildingId: null };
    this.render();
  }

  render() {
    if (!this.currentSettlement || !this.getPanelBodyEl()) return;
    ensureSettlementCityState(this.currentSettlement);
    this.renderHeader();
    this.renderScene();
    this.renderPanel();
  }

  renderHeader() {
    const settlement = this.currentSettlement || {};
    const cityState = ensureSettlementCityState(settlement) || {};
    const factionCtx = typeof this.getFactionContext === 'function' ? this.getFactionContext(settlement) : null;

    if (this.dom.cityTitle) this.dom.cityTitle.textContent = settlement.name || 'Sehir';
    if (this.dom.citySubtitle) {
      this.dom.citySubtitle.textContent = `${String(settlement.type || 'town').toUpperCase()} - ${cityState.tierLabel || '-'} - ${cityState.roleLabel || '-'}`;
    }
    if (this.dom.cityRelation) {
      if (factionCtx) {
        this.dom.cityRelation.textContent = `${factionCtx.ownerFactionName} - REL ${Math.floor(factionCtx.relation)} - ${factionCtx.stance}`;
      } else {
        this.dom.cityRelation.textContent = 'Sahiplik bilgisi yok';
      }
    }
    if (this.dom.citySummary) {
      const areaCount = cityState.parcels?.length || 0;
      const occupied = cityState.parcels?.filter((parcel) => parcel.state === CITY_PARCEL_STATE.OCCUPIED || parcel.state === CITY_PARCEL_STATE.LANDMARK).length || 0;
      this.dom.citySummary.innerHTML = `
        <div class="city-scene-summary__line"><span>Sehir Rolu</span><strong>${escapeHtml(cityState.roleLabel || '-')}</strong></div>
        <div class="city-scene-summary__line"><span>Dolu Alan</span><strong>${occupied}/${areaCount}</strong></div>
        <div class="city-scene-summary__line"><span>Aktif Servis</span><strong>${Object.values(cityState.services || {}).filter((service) => service.available).length}</strong></div>
        <div class="city-scene-summary__line"><span>Art Uyarisi</span><strong>${cityState.validation?.warningCount || 0}</strong></div>
      `;
    }
    if (this.dom.cityWarnings) {
      const warnings = cityState.validation?.warnings || [];
      this.dom.cityWarnings.innerHTML = warnings.length
        ? `<span>${warnings.length} placeholder art uyarisi</span>`
        : '<span>Art validation temiz</span>';
    }
  }

  renderScene() {
    const cityState = ensureSettlementCityState(this.currentSettlement);
    if (!this.dom.citySceneStage || !this.dom.citySceneHotspots || !cityState) return;
    this.dom.citySceneStage.dataset.theme = cityState.sceneTheme || 'ottoman';
    this.dom.citySceneStage.classList.toggle('has-base-image', Boolean(cityState.baseImage));
    if (cityState.baseImage) this.dom.citySceneStage.style.backgroundImage = `url('${cityState.baseImage}')`;
    else this.dom.citySceneStage.style.backgroundImage = '';

    const hotspotMarkup = (cityState.parcels || []).map((parcel) => {
      const def = getCityBuildingDef(parcel.currentBuildingId);
      const selected = this.currentView?.parcelId === parcel.id;
      const serviceLabel = def?.primaryService ? (CITY_SERVICE_LABELS[def.primaryService] || def.primaryService) : '';
      const buildingCount = Array.isArray(parcel.buildingIds) ? parcel.buildingIds.length : (parcel.currentBuildingId ? 1 : 0);
      const stateLabel = parcel.state === CITY_PARCEL_STATE.LOCKED
        ? 'Kilitli'
        : buildingCount > 0
          ? `${buildingCount} yapi`
          : (CITY_AREA_FILL_LABELS[parcel.fill] || parcel.fillLabel || 'Bos');
      return `
        <button
          class="city-scene-hotspot state-${parcel.state}${selected ? ' is-selected' : ''}"
          style="left:${parcel.x}%;top:${parcel.y}%;width:${parcel.w}%;height:${parcel.h}%"
          data-city-parcel-id="${escapeHtml(parcel.id)}"
          title="${escapeHtml(parcel.label)}"
        >
          <span class="city-scene-hotspot__label">${escapeHtml(parcel.label)}</span>
          <span class="city-scene-hotspot__meta">${escapeHtml(serviceLabel || stateLabel)}</span>
        </button>
      `;
    }).join('');
    this.dom.citySceneHotspots.innerHTML = hotspotMarkup;

    if (this.dom.cityServiceChips) {
      this.dom.cityServiceChips.innerHTML = Object.values(cityState.services || {}).map((service) => `
        <button
          class="city-service-chip${service.available ? ' is-available' : ' is-locked'}${this.currentView?.serviceId === service.id ? ' is-active' : ''}"
          data-action="open-service"
          data-id="${service.id}"
        >${escapeHtml(service.label)}</button>
      `).join('');
    }
  }

  renderPanel() {
    const cityState = ensureSettlementCityState(this.currentSettlement);
    const target = this.getPanelBodyEl();
    if (!target || !cityState) return;

    if (this.currentView?.type === 'npc') {
      this.renderNpcProfile(this.currentView.npcId);
      return;
    }

    if (this.currentView?.type === 'service' && this.currentView.serviceId) {
      if (!canUseCityService(this.currentSettlement, this.currentView.serviceId)) {
        this.renderLockedService(this.currentView.serviceId);
        return;
      }
      if (this.currentView.serviceId === CITY_SERVICE.TRADE) {
        this.renderTrade();
        return;
      }
      if (this.currentView.serviceId === CITY_SERVICE.RECRUIT) {
        this.renderRecruit();
        return;
      }
      if (this.currentView.serviceId === CITY_SERVICE.CONTRACTS) {
        this.renderContracts();
        return;
      }
      if (this.currentView.serviceId === CITY_SERVICE.DIPLOMACY) {
        this.renderDiplomacy();
        return;
      }
      if (this.currentView.serviceId === CITY_SERVICE.HEALING) {
        this.renderHealing();
        return;
      }
      if (this.currentView.serviceId === CITY_SERVICE.TAX) {
        this.renderTaxPanel();
        return;
      }
    }

    if (this.currentView?.type === 'area' && this.currentView.parcelId) {
      this.renderAreaMenu(this.currentView.parcelId);
      return;
    }
    if (this.currentView?.type === 'locked' && this.currentView.parcelId) {
      this.renderLockedParcel(this.currentView.parcelId);
      return;
    }
    if (this.currentView?.type === 'building' && this.currentView.parcelId) {
      this.renderBuildingInfo(this.currentView.parcelId, this.currentView.buildingId);
      return;
    }
    this.renderOverview();
  }

  setPanelChrome(title, meta = '', body = '') {
    if (this.dom.cityPanelTitle) this.dom.cityPanelTitle.textContent = title;
    if (this.dom.cityPanelMeta) this.dom.cityPanelMeta.innerHTML = meta;
    this.getPanelBodyEl().innerHTML = body;
  }

  renderOverview() {
    const cityState = ensureSettlementCityState(this.currentSettlement);
    const availableServices = Object.values(cityState.services || {}).filter((service) => service.available);
    const buildable = (cityState.parcels || []).filter((parcel) => !parcel.buildDisabled && listBuildOptionsForParcel(this.currentSettlement, parcel.id).length > 0).length;
    const ownership = canPlayerManageSettlement(this.currentSettlement, this.party?.factionId || CONST.FACTION.ID.PLAYER);
    const residents = getSettlementCharacters(this.state?.worldCharacters, this.currentSettlement?.id)
      .filter((person) => person.status === 'alive');
    this.setPanelChrome(
      'Sehir Sahnesi',
      `<div class="city-panel-meta-line">Tema: ${escapeHtml(cityState.sceneTheme || '-')}</div>
       <div class="city-panel-meta-line">Art set: ${escapeHtml(cityState.artSetKey || '-')}</div>`,
      `
        <div class="city-overview-grid">
          <div class="city-overview-card">
            <div class="city-overview-card__label">Aktif Servisler</div>
            <div class="city-overview-card__value">${availableServices.length}</div>
            <div class="city-overview-card__sub">${availableServices.map((service) => escapeHtml(service.label)).join(', ') || 'Yok'}</div>
          </div>
          <div class="city-overview-card">
            <div class="city-overview-card__label">Gelistirilebilir Alan</div>
            <div class="city-overview-card__value">${buildable}</div>
            <div class="city-overview-card__sub">${ownership ? 'Alanlara yeni bina eklenebilir.' : 'Sadece kendi sehrinde gelisim yapabilirsin.'}</div>
          </div>
        </div>
        <div class="city-overview-section">
          <div class="city-overview-section__title">Servis Kilitleri</div>
          ${Object.values(cityState.services || []).map((service) => `
            <div class="city-overview-row">
              <span>${escapeHtml(service.label)}</span>
              <strong>${service.available ? 'Acilmis' : `Gerekli: ${escapeHtml(getCityServiceRequirementText(service.id))}`}</strong>
            </div>
          `).join('')}
        </div>
        <div class="city-overview-section">
          <div class="city-overview-section__title">Sehirdeki Kisiler (NPC)</div>
          ${residents.length ? residents.map((person) => `
            <button type="button" class="city-overview-row w-full text-left"
                data-action="open-npc" data-id="${escapeHtml(person.id)}"
                aria-label="${escapeHtml(person.name)} karakterini incele">
              <span>${escapeHtml(person.name)}</span>
              <strong>${escapeHtml(NPC_ROLE_LABELS[person.role] || person.role)} · ${getWorldCharacterAge(person, this.state?.day)}</strong>
            </button>
          `).join('') : '<div class="text-sm opacity-80">Bu sehir icin kayitli NPC yok.</div>'}
        </div>
        <div class="city-overview-section">
          <div class="city-overview-section__title">Sehir Kethudasi</div>
          <div class="text-sm opacity-80">
            ${escapeHtml(cityState.infrastructure?.managerLabel || 'Sehir Kethudasi')} altyapi ve sehir hizmetlerini yonetir. Bu grup buyuk bina olarak cizilmez.
          </div>
        </div>
        <div class="city-overview-section">
          <div class="city-overview-section__title">Yapman gereken</div>
          <div class="text-sm opacity-80">
            Bir alana tikla. Sag panelde o bolgenin binalari, servisleri ve gelisim secenekleri acilir.
          </div>
        </div>
      `,
    );
  }

  renderNpcProfile(npcId) {
    const profile = getWorldCharacterProfile(this.state?.worldCharacters, npcId, {
      day: this.state?.day,
    });
    if (!profile || profile.person.location?.settlementId !== String(this.currentSettlement?.id)) {
      this.currentView = { type: 'overview', serviceId: null, parcelId: null, buildingId: null };
      this.renderOverview();
      return;
    }

    const { person, age, relations } = profile;
    const roleLabel = NPC_ROLE_LABELS[person.role] || person.role;
    const statusLabel = person.status === 'alive' ? 'Hayatta' : 'Ölü';
    const kindLabel = person.kind === 'named'
      ? `Önemli karakter (${person.importance})` : 'Sıradan dünya karakteri';
    const statRows = CHARACTER_STAT_KEYS.map((key) => `
      <div class="city-overview-row">
        <span>${escapeHtml(NPC_STAT_LABELS[key] || key)}</span>
        <strong>${person.stats[key]}/100</strong>
      </div>`).join('');
    const relationRows = relations.length ? relations.map((other) => `
      <div class="city-overview-row">
        <span>${escapeHtml(other.name)}</span>
        <strong>${other.value > 0 ? '+' : ''}${other.value}</strong>
      </div>`).join('')
      : '<div class="text-sm opacity-70">Henüz kayıtlı kişisel ilişki yok.</div>';
    const historyRows = person.history.length ? [...person.history].reverse().map((event) => {
      const typeText = event.type === 'created' ? 'Oluşturuldu'
        : event.type === 'promoted' ? 'Önem kazandı' : event.type === 'moved'
          ? 'Şehir değiştirdi' : 'Olay';
      const target = event.type === 'moved' ? ` — ${escapeHtml(event.settlementId)}` : '';
      return `<div class="city-overview-row"><span>${escapeHtml(typeText)}${target}</span><strong>Gün ${event.day}</strong></div>`;
    }).join('') : '<div class="text-sm opacity-70">Kayıt yok.</div>';

    this.setPanelChrome(
      'Karakter: ' + person.name,
      `<div class="city-panel-meta-line">${escapeHtml(kindLabel)} · ${escapeHtml(statusLabel)}</div>`,
      `
        <button type="button" class="action-btn btn-dark text-xs mb-3" data-action="show-overview">Şehre dön</button>
        <div class="city-overview-section">
          <div class="city-overview-section__title">Kimlik</div>
          <div class="city-overview-row"><span>Adı</span><strong>${escapeHtml(person.name)}</strong></div>
          <div class="city-overview-row"><span>Yaş</span><strong>${age}</strong></div>
          <div class="city-overview-row"><span>Rol profili</span><strong>${escapeHtml(roleLabel)}</strong></div>
          <div class="city-overview-row"><span>Karakter türü</span><strong>${escapeHtml(kindLabel)}</strong></div>
          <div class="text-xs opacity-70 mt-2">Rol profili, resmî görev veya askerî rütbe değildir.</div>
        </div>
        <div class="city-overview-section">
          <div class="city-overview-section__title">Kişilik</div>
          <div class="text-sm">${person.traits.map((trait) => escapeHtml(NPC_TRAIT_LABELS[trait] || trait)).join(' · ') || 'Bilinmiyor'}</div>
        </div>
        <div class="city-overview-section">
          <div class="city-overview-section__title">Yetenekler</div>
          ${statRows}
        </div>
        <div class="city-overview-section">
          <div class="city-overview-section__title">Toplumsal durum</div>
          <div class="city-overview-row"><span>Sadakat</span><strong>${person.loyalty}/100</strong></div>
          <div class="city-overview-row"><span>Memnuniyet</span><strong>${person.satisfaction}/100</strong></div>
          <div class="city-overview-row"><span>İtibar</span><strong>${person.reputation}/100</strong></div>
          <div class="city-overview-row"><span>Konum</span><strong>${person.standing}/100</strong></div>
        </div>
        <div class="city-overview-section">
          <div class="city-overview-section__title">Bilinen ilişkiler</div>
          ${relationRows}
        </div>
        <div class="city-overview-section">
          <div class="city-overview-section__title">Geçmiş</div>
          ${historyRows}
        </div>
      `,
    );
  }

  renderAreaMenu(parcelId) {
    const cityState = ensureSettlementCityState(this.currentSettlement);
    const parcel = cityState.parcels.find((entry) => entry.id === parcelId);
    if (!parcel) {
      this.currentView = { type: 'overview', serviceId: null, parcelId: null, buildingId: null };
      this.renderOverview();
      return;
    }

    const ownership = canPlayerManageSettlement(this.currentSettlement, this.party?.factionId || CONST.FACTION.ID.PLAYER);
    const options = listBuildOptionsForParcel(this.currentSettlement, parcelId);

    const buildingRows = (parcel.buildingIds || []).map((buildingId) => {
      const def = getCityBuildingDef(buildingId);
      if (!def) return '';
      const serviceButtons = (def.services || [])
        .filter((serviceId) => canUseCityService(this.currentSettlement, serviceId))
        .map((serviceId) => `
          <button class="action-btn btn-gold text-xs" data-action="open-service" data-id="${serviceId}" data-parcel-id="${escapeHtml(parcel.id)}">
            ${escapeHtml(CITY_SERVICE_LABELS[serviceId] || serviceId)}
          </button>
        `)
        .join('');
      return `
        <div class="frame-dark p-3 mb-2">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="font-bold text-sm">${escapeHtml(def.name)}</div>
              <div class="text-xs opacity-75">Kategori: ${escapeHtml(def.category)}</div>
            </div>
            <div class="flex items-center gap-2">
              <button class="action-btn btn-dark text-xs" data-action="open-building" data-id="${escapeHtml(def.id)}" data-parcel-id="${escapeHtml(parcel.id)}">Detay</button>
              ${serviceButtons}
            </div>
          </div>
        </div>
      `;
    }).join('');

    const buildRows = !ownership || !options.length
      ? ''
      : `
        <div class="city-overview-section">
          <div class="city-overview-section__title">Gelistirme Secenekleri</div>
          ${options.map((option) => {
            const affordable = Number(this.party?.gold ?? 0) >= Number(option.buildCostGold || 0);
            return `
              <div class="frame-dark p-3 mb-2 flex items-start justify-between gap-3">
                <div>
                  <div class="font-bold text-sm">${escapeHtml(option.name)}</div>
                  <div class="text-xs opacity-75">Maliyet: ${Number(option.buildCostGold || 0)}g</div>
                  <div class="text-xs opacity-70">+ ${(option.bonuses || []).join(', ') || '-'}</div>
                  <div class="text-xs opacity-70">- ${(option.penalties || []).join(', ') || '-'}</div>
                </div>
                <button
                  class="action-btn ${affordable ? 'btn-gold' : 'btn-dark'} text-xs"
                  data-action="build-construct"
                  data-id="${option.id}"
                  data-parcel-id="${escapeHtml(parcel.id)}"
                  ${affordable ? '' : 'disabled'}
                >Ekle</button>
              </div>
            `;
          }).join('')}
        </div>
      `;

    this.setPanelChrome(
      parcel.label,
      `<div class="city-panel-meta-line">Alan tipi: ${escapeHtml(parcel.areaType || 'alan')}</div>
       <div class="city-panel-meta-line">Doluluk: ${escapeHtml(CITY_AREA_FILL_LABELS[parcel.fill] || parcel.fillLabel || 'Bos')}</div>`,
      `
        <div class="city-overview-section">
          <div class="city-overview-section__title">Bolge Ozeti</div>
          <div class="text-sm opacity-80">${escapeHtml((parcel.notes || []).join(' ') || 'Bu alan icin ek not yok.')}</div>
        </div>
        <div class="city-overview-section">
          <div class="city-overview-section__title">Mevcut Binalar</div>
          ${buildingRows || '<div class="text-sm opacity-70">Bu alan henuz bos.</div>'}
        </div>
        ${!ownership && options.length ? '<div class="text-xs opacity-70">Bu sehir sana ait olmadigi icin gelisim yapamazsin.</div>' : ''}
        ${buildRows}
        <div class="city-panel-actions">
          <button class="action-btn btn-dark text-xs" data-action="show-overview">Genel Bakis</button>
        </div>
      `,
    );
  }

  renderBuildingInfo(parcelId, buildingId = this.currentView?.buildingId) {
    const cityState = ensureSettlementCityState(this.currentSettlement);
    const parcel = cityState.parcels.find((entry) => entry.id === parcelId);
    const resolvedBuildingId = buildingId || parcel?.currentBuildingId || parcel?.buildingIds?.[0] || null;
    const def = getCityBuildingDef(resolvedBuildingId);
    if (!parcel || !def) {
      this.currentView = { type: 'overview', serviceId: null, parcelId: null, buildingId: null };
      this.renderOverview();
      return;
    }

    const serviceButtons = (def.services || []).map((serviceId) => `
      <button class="action-btn btn-gold text-xs" data-action="open-service" data-id="${serviceId}" data-parcel-id="${escapeHtml(parcel.id)}">
        ${escapeHtml(CITY_SERVICE_LABELS[serviceId] || serviceId)}
      </button>
    `).join('');

    this.setPanelChrome(
      def.name,
      `<div class="city-panel-meta-line">${escapeHtml(parcel.label)}</div>`,
      `
        <div class="city-overview-section">
          <div class="city-overview-section__title">Bina Kimligi</div>
          <div class="text-sm opacity-85">Kategori: ${escapeHtml(def.category)}</div>
          <div class="text-sm opacity-85">Erisim: ${escapeHtml(def.accessType)}</div>
        </div>
        <div class="city-overview-section">
          <div class="city-overview-section__title">Avantajlar</div>
          ${(def.bonuses || []).map((bonus) => `<div class="city-overview-row"><span>+</span><strong>${escapeHtml(bonus)}</strong></div>`).join('') || '<div class="text-sm opacity-70">Kayit yok.</div>'}
        </div>
        <div class="city-overview-section">
          <div class="city-overview-section__title">Bedeller</div>
          ${(def.penalties || []).map((penalty) => `<div class="city-overview-row"><span>-</span><strong>${escapeHtml(penalty)}</strong></div>`).join('') || '<div class="text-sm opacity-70">Yok.</div>'}
        </div>
        <div class="city-panel-actions">
          <button class="action-btn btn-dark text-xs" data-action="open-area" data-id="${escapeHtml(parcel.id)}">Alana Don</button>
          <button class="action-btn btn-gold text-xs" data-action="show-overview">Genel Bakis</button>
          ${serviceButtons}
        </div>
      `,
    );
  }

  renderLockedParcel(parcelId) {
    const cityState = ensureSettlementCityState(this.currentSettlement);
    const parcel = cityState.parcels.find((entry) => entry.id === parcelId);
    this.setPanelChrome(
      parcel?.label || 'Kilitli Alan',
      '',
      `
        <div class="city-overview-section">
          <div class="text-sm opacity-85">Bu alan henuz aktif degil.</div>
          <div class="text-sm opacity-70 mt-2">${escapeHtml((parcel?.notes || []).join(' ') || 'Sehir seviyesi veya ozel rol gerektirir.')}</div>
        </div>
        <div class="city-panel-actions">
          <button class="action-btn btn-gold text-xs" data-action="show-overview">Genel Bakis</button>
        </div>
      `,
    );
  }

  renderBuildPanel(parcelId) {
    const cityState = ensureSettlementCityState(this.currentSettlement);
    const parcel = cityState.parcels.find((entry) => entry.id === parcelId);
    const options = listBuildOptionsForParcel(this.currentSettlement, parcelId);
    const ownership = canPlayerManageSettlement(this.currentSettlement, this.party?.factionId || CONST.FACTION.ID.PLAYER);

    const body = !ownership
      ? `
        <div class="text-sm opacity-80">Bu sehir sana ait degil. Gelisim sadece sahip olunan sehirlerde acilir.</div>
        <div class="city-panel-actions">
          <button class="action-btn btn-gold text-xs" data-action="show-overview">Genel Bakis</button>
        </div>
      `
      : !options.length
        ? `
          <div class="text-sm opacity-80">Bu alana uygun aktif gelisim secenegi yok.</div>
          <div class="city-panel-actions">
            <button class="action-btn btn-gold text-xs" data-action="show-overview">Genel Bakis</button>
          </div>
        `
        : options.map((option) => {
          const affordable = Number(this.party?.gold ?? 0) >= Number(option.buildCostGold || 0);
          return `
            <div class="frame-dark p-3 mb-2">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="font-bold text-sm">${escapeHtml(option.name)}</div>
                  <div class="text-xs opacity-80">Maliyet: ${Number(option.buildCostGold || 0)}g · Min tier: ${Number(option.minTier || 1)}</div>
                  <div class="text-xs opacity-70 mt-1">+ ${(option.bonuses || []).join(', ') || '-'}</div>
                  <div class="text-xs opacity-70">- ${(option.penalties || []).join(', ') || '-'}</div>
                </div>
                <button
                  class="action-btn ${affordable ? 'btn-gold' : 'btn-dark'} text-xs"
                  data-action="build-construct"
                  data-id="${option.id}"
                  data-parcel-id="${escapeHtml(parcelId)}"
                  ${affordable ? '' : 'disabled'}
                >Gelisitir</button>
              </div>
            </div>
          `;
        }).join('');

    this.setPanelChrome(
      parcel?.label || 'Bos Alan',
      `<div class="city-panel-meta-line">Kalan altin: ${Math.floor(Number(this.party?.gold ?? 0))}</div>`,
      body,
    );
  }

  renderLockedService(serviceId) {
    this.setPanelChrome(
      CITY_SERVICE_LABELS[serviceId] || serviceId,
      '',
      `
        <div class="text-sm opacity-80">Bu servis sert kilitli. Gerekli bina olmadan acilamaz.</div>
        <div class="text-sm opacity-70 mt-2">Gerekli bina: ${escapeHtml(getCityServiceRequirementText(serviceId))}</div>
        <div class="city-panel-actions">
          <button class="action-btn btn-gold text-xs" data-action="show-overview">Genel Bakis</button>
        </div>
      `,
    );
  }

  renderRecruit() {
    const pool = this.currentRecruitPool || [];
    if (!pool.length) {
      this.setPanelChrome('Askeri Alan', '', '<div class="text-sm opacity-80">Bu yerlesimde kiralanabilir birlik yok.</div>');
      return;
    }

    this.setPanelChrome(
      'Askeri Alan',
      '<div class="city-panel-meta-line">Servis: Asker Toplama</div>',
      pool.map((unit) => {
        const canHire = this.recruitmentSystem.canHire(this.party?.gold || 0, unit);
        return `
          <div class="frame-dark p-3 mb-2 flex items-center justify-between gap-2">
            <div>
              <div class="font-bold text-sm">${escapeHtml(unit.label || unit.name)}</div>
                  <div class="text-xs opacity-80">Sinif: ${escapeHtml(unit.class)} - Maliyet: ${Number(unit.cost || 0)}g</div>
            </div>
            <button class="action-btn ${canHire ? 'btn-gold' : 'btn-dark'} text-xs" data-action="hire" data-id="${escapeHtml(unit.uid)}" ${canHire ? '' : 'disabled'}>Kirala</button>
          </div>
        `;
      }).join(''),
    );
  }

  renderTrade() {
    const market = this.currentMarket;
    const items = CONST.TRADE_ITEMS || [];
    if (!market || !items.length) {
      this.setPanelChrome('Pazar ve Ticaret Alani', '', '<div class="text-sm opacity-80">Pazar verisi yok.</div>');
      return;
    }

    const day = Number(this.state?.day ?? 1);
    const settlementKey = this.currentSettlement?.id || `${this.currentSettlement?.tx},${this.currentSettlement?.ty}`;
    const activeOpportunity = this.state?.marketOpportunities?.[settlementKey];
    const opportunityDaysLeft = activeOpportunity
      ? Math.max(0, Number(activeOpportunity.expiresDay ?? day) - day)
      : 0;

    this.setPanelChrome(
      'Pazar ve Ticaret Alani',
      '<div class="city-panel-meta-line">Servis: Ticaret</div>',
      items.map((item) => {
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
          worldEvents: this.state?.events?.activeEvents || [],
          eventsCfg: this.state?.tuning?.EVENTS || CONST.EVENTS,
        };
        const buyPrice = this.tradeSystem.getPrice(this.currentSettlement, market, item.id, 'buy', priceOpts);
        const sellPrice = this.tradeSystem.getPrice(this.currentSettlement, market, item.id, 'sell', priceOpts);
        const invQty = Math.max(0, Math.floor((this.party?.inventory?.items || []).find((entry) => entry.id === item.id)?.qty ?? 0));
        const hasOpportunity = activeOpportunity && activeOpportunity.itemId === item.id && opportunityDaysLeft > 0;
        return `
          <div class="frame-dark p-3 mb-2">
            <div class="flex items-center justify-between gap-2">
              <div>
                <div class="font-bold text-sm">${escapeHtml(item.name)}</div>
                <div class="text-xs opacity-80">Stok: ${stock} - Envanter: ${invQty} - Al: ${buyPrice}g - Sat: ${sellPrice}g</div>
                ${hasOpportunity ? `<div class="text-xs text-amber-300">Firsat: +%${Math.round(activeOpportunity.bonusPct)} (${opportunityDaysLeft} gun)</div>` : ''}
              </div>
              <div class="flex items-center gap-2">
                <input data-qty-for="${item.id}" type="number" value="1" min="1" class="select-dark text-xs w-16" />
                <button class="action-btn btn-gold text-xs" data-action="buy" data-id="${item.id}">Al</button>
                <button class="action-btn btn-dark text-xs" data-action="sell" data-id="${item.id}">Sat</button>
              </div>
            </div>
          </div>
        `;
      }).join(''),
    );
  }

  renderContracts() {
    const offers = Array.isArray(this.currentContracts) ? this.currentContracts : [];
    const activeContracts = Array.isArray(this.party?.contracts) ? this.party.contracts : [];
    const acceptedIds = new Set(activeContracts.map((contract) => contract.id));

    this.setPanelChrome(
      'Hanlar ve Kervan Alani',
      '<div class="city-panel-meta-line">Servis: Han Isleri</div>',
      `
        <div class="text-xs opacity-75 mb-2">Pano Kontratlari</div>
        ${offers.map((contract) => {
          const accepted = acceptedIds.has(contract.id);
          const label = this.describeContract(contract);
          return `
            <div class="frame-dark p-3 mb-2 flex items-center justify-between gap-2">
              <div>
                <div class="font-bold text-sm">${escapeHtml(label.title)}</div>
                <div class="text-xs opacity-80">${escapeHtml(label.desc)}</div>
                <div class="text-[11px] opacity-70">${this.contractTypeBadge(contract)}</div>
              </div>
              <button class="action-btn ${accepted ? 'btn-dark' : 'btn-gold'} text-xs" data-action="accept-contract" data-id="${contract.id}" ${accepted ? 'disabled' : ''}>${accepted ? 'Accepted' : 'Accept'}</button>
            </div>
          `;
        }).join('') || '<div class="text-sm opacity-80 mb-3">Bugun icin kontrat bulunmuyor.</div>'}
        <div class="text-xs opacity-75 mt-4 mb-2">Kabul Edilenler</div>
        ${activeContracts.map((contract) => {
          const ready = Boolean(contract.completed);
          const label = this.describeContract(contract);
          return `
            <div class="frame-dark p-3 mb-2 flex items-center justify-between gap-2">
              <div>
                <div class="font-bold text-sm">${escapeHtml(label.title)}</div>
                <div class="text-xs opacity-80">${escapeHtml(this.contractProgressText(contract))} - Odul: ${contract.rewardGold}g, ${contract.rewardRenown} renown</div>
              </div>
              <button class="action-btn ${ready ? 'btn-gold' : 'btn-dark'} text-xs" data-action="claim-contract" data-id="${contract.id}" ${ready ? '' : 'disabled'}>${ready ? 'Teslim Al' : 'Devam Ediyor'}</button>
            </div>
          `;
        }).join('') || '<div class="text-sm opacity-80">Aktif kontrat yok.</div>'}
      `,
    );
  }

  renderDiplomacy() {
    const factions = Array.isArray(CONST.FACTIONS) ? CONST.FACTIONS.filter((faction) => faction?.id && faction.id !== 'bandit') : [];
    if (!factions.length) {
      this.setPanelChrome('Reisulkuttab Dairesi', '', '<div class="text-sm opacity-80">Faction data unavailable.</div>');
      return;
    }

    const cfg = this.state?.tuning?.DIPLOMACY_ACTIONS || CONST.DIPLOMACY_ACTIONS;
    this.setPanelChrome(
      'Reisulkuttab Dairesi',
      '<div class="city-panel-meta-line">Servis: Diplomasi ve Yazisma</div>',
      factions.map((faction) => {
        const stanceData = getPlayerStanceToFaction(this.state?.factions, faction.id, CONST.DIPLOMACY_RELATIONS);
        const truceEnabled = canBuyTruce({ factions: this.state?.factions, targetFactionId: faction.id, party: this.party, cfg });
        const canImprove = stanceData.stance === 'NEUTRAL' || stanceData.stance === 'WAR';
        const canWar = stanceData.stance === 'NEUTRAL' || stanceData.stance === 'ALLY';
        return `
          <div class="frame-dark p-3 mb-2 flex items-center justify-between gap-2">
            <div>
              <div class="font-bold text-sm">${escapeHtml(faction.name)}</div>
              <div class="text-xs opacity-80">Relation: ${stanceData.relation} - Stance: ${escapeHtml(stanceData.stance)}</div>
            </div>
            <div class="flex items-center gap-2">
              <button class="action-btn btn-dark text-xs" data-action="diplomacy-truce" data-id="${faction.id}" ${truceEnabled ? '' : 'disabled'}>Ateskes (${cfg.TRUCE_COST_GOLD}g)</button>
              <button class="action-btn btn-gold text-xs" data-action="diplomacy-improve" data-id="${faction.id}" ${canImprove ? '' : 'disabled'}>Iyilestir (${cfg.IMPROVE_RELATION_COST_GOLD}g)</button>
              <button class="action-btn btn-dark text-xs" data-action="diplomacy-war" data-id="${faction.id}" ${canWar ? '' : 'disabled'}>Savas Ilan Et</button>
            </div>
          </div>
        `;
      }).join(''),
    );
  }

  renderHealing() {
    const wounded = this.state?.battle ? [] : (this.state?.woundedUnits || []);
    const actualWounded = Array.isArray(this.party?.roster)
      ? this.party.roster.filter((unit) => (Number(unit.hp ?? unit.maxHp ?? 0) < Number(unit.maxHp ?? 0)))
      : wounded;
    this.setPanelChrome(
      'Saglik Alani',
      '<div class="city-panel-meta-line">Servis: Saglik ve Iyilestirme</div>',
      actualWounded.length
        ? actualWounded.map((unit, index) => {
          const missing = Math.max(0, Number(unit.maxHp ?? 0) - Number(unit.hp ?? 0));
          const cost = Math.max(0, Math.ceil(missing * 0.2));
          return `
            <div class="frame-dark p-3 mb-2 flex items-center justify-between gap-2">
              <div>
                <div class="font-bold text-sm">${escapeHtml(unit.name || `Birim ${index + 1}`)}</div>
                <div class="text-xs opacity-80">HP ${Math.floor(Number(unit.hp ?? 0))}/${Math.floor(Number(unit.maxHp ?? 1))} - Maliyet: ${cost}g</div>
              </div>
              <button class="action-btn btn-gold text-xs" data-action="heal-unit" data-id="${index}">Iyilestir</button>
            </div>
          `;
        }).join('')
        : '<div class="text-sm opacity-80">Iyilestirilecek yarali birlik yok.</div>',
    );
  }

  renderTaxPanel() {
    const settlement = this.currentSettlement || {};
    this.setPanelChrome(
      'Defterhane-i Amire',
      '<div class="city-panel-meta-line">Servis: Vergi ve Idare</div>',
      `
        <div class="city-overview-section">
          <div class="city-overview-row"><span>Vergi Orani</span><strong>%${Math.round(Number(settlement.taxRate ?? 0.15) * 100)}</strong></div>
          <div class="city-overview-row"><span>Nufus</span><strong>${Math.floor(Number(settlement.population ?? 0))}</strong></div>
          <div class="city-overview-row"><span>Garnizon</span><strong>${Math.floor(Number(settlement.garrison ?? 0))}</strong></div>
        </div>
        <div class="text-sm opacity-80">
          Bu panel ilk fazda salt bilgi ekranidir. Vergi-idare servisi artik Defterhane-i Amire ve ilgili ticaret yapilari uzerinden acilir.
        </div>
      `,
    );
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

  contractTypeBadge(contract) {
    const type = String(contract?.type || 'UNKNOWN');
    const icons = {
      BANDIT: 'Skirmish',
      DELIVER: 'Kervan',
      SCOUT: 'Kesif',
      DEFEND: 'Savun',
      ESCORT: 'Eskort',
      ASSASSINATE: 'Suikast',
    };
    const war = contract?.isWarContract ? ' (War)' : '';
    return `${icons[type] || 'Kontrat'} - ${type}${war}`;
  }

  contractProgressText(contract) {
    const progress = Math.floor(contract?.progress || 0);
    if (contract?.type === 'DEFEND') {
      const required = Math.floor(contract?.requiredCount || 1);
      return `Savunma savasi: ${progress}/${required}`;
    }
    if (contract?.type === 'ESCORT') {
      const status = contract?.completed ? 'Tamamlandi' : 'Aktif';
      return `Rota: ${contract?.routeFromName || contract?.cityId || '?'} -> ${contract?.routeToName || contract?.targetCityId || '?'} (${status})`;
    }
    if (contract?.type === 'ASSASSINATE') {
      return `Hedef: ${contract?.targetRegionId || 'bilinmeyen bolge'}`;
    }
    const goal = contract?.type === 'DELIVER' ? (contract?.requiredAmount ?? contract?.requiredCount ?? 1) : (contract?.requiredCount ?? 1);
    return `Ilerleme: ${progress}/${Math.floor(goal)}`;
  }

  describeContract(contract) {
    if (!contract || typeof contract !== 'object') return { title: 'Unknown', desc: '' };
    if (contract.type === 'BANDIT') return { title: 'Bandit Patrol', desc: `Haydutlara karsi ${contract.requiredCount || 1} savas kazan.` };
    if (contract.type === 'DELIVER') return { title: 'Food Caravan', desc: `${contract.requiredAmount || contract.requiredCount || 1} erzak teslim et.` };
    if (contract.type === 'DEFEND') return { title: contract.title || 'Defend City', desc: contract.desc || `Sehri savun (${contract.requiredCount || 1} savas).` };
    if (contract.type === 'ESCORT') return { title: contract.title || 'Escort Caravan', desc: contract.desc || `Kervani ${contract.cityId || 'A'} -> ${contract.targetCityId || 'B'} koru.` };
    if (contract.type === 'ASSASSINATE') return { title: contract.title || 'Eliminate Target', desc: contract.desc || 'Bandit liderini ortadan kaldir.' };
    return { title: 'Scout', desc: `Hedef: ${contract.targetPoiId || 'ruin'}` };
  }
}
