import { FACTIONS } from '../constants.js';
import * as utils from '../utils.js';

export default class StartScreen {
  constructor({ state, saveSystem, onStart, onContinue, onLoad }) {
    this.state = state;
    this.saveSystem = saveSystem;
    this.onStart = onStart;
    this.onContinue = onContinue;
    this.onLoad = onLoad;

    this.dom = {};
    this.bound = false;
    this.selectedId = null;
  }

  bind(dom) {
    if (this.bound) return;
    this.bound = true;
    this.dom = dom || {};
    if (!this.dom.factionGrid) this.dom.factionGrid = utils.getEl('factionGrid');

    this.renderFactionGrid();

    this.dom.factionGrid?.addEventListener('click', (event) => {
      const card = event.target?.closest?.('.faction-card');
      if (!card) return;
      this.selectFaction(card.dataset.factionId);
    });

    this.dom.btnStart?.addEventListener('click', () => {
      const faction = FACTIONS.find((item) => item.id === this.selectedId);
      if (!faction) {
        if (this.dom.startSaveInfo) this.dom.startSaveInfo.textContent = 'Önce sancak seçmelisin.';
        return;
      }
      this.onStart?.({ faction, seed: this.readSeed() });
    });

    this.dom.btnContinue?.addEventListener('click', () => this.onContinue?.());
    this.dom.btnLoadStart?.addEventListener('click', () => {
      const ok = this.onLoad?.();
      if (ok === false && this.dom.startSaveInfo) {
        this.dom.startSaveInfo.textContent = 'Kayıt yükleme arayüzü yok; autosave yok.';
      }
    });

    this.dom.seedInput?.addEventListener('input', () => this.refresh());
    this.dom.randomSeedBtn?.addEventListener('click', () => {
      const seed = this.randomSeed();
      if (this.dom.seedInput) this.dom.seedInput.value = String(seed);
      this.refresh();
    });

    if (this.dom.seedInput) {
      this.dom.seedInput.value = String(this.state?.seed ?? 1337);
    }

    this.refresh();
  }

  renderFactionGrid() {
    const grid = this.dom.factionGrid;
    if (!grid) return;
    grid.innerHTML = '';

    FACTIONS.forEach((faction) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'action-btn btn-dark faction-card';
      card.dataset.factionId = faction.id;
      card.innerHTML = `<div class="font-bold" style="color:${faction.color}"></div><div class="text-xs opacity-80 mt-1"></div>`;
      const title = card.querySelector('.font-bold');
      const doctrine = card.querySelector('.text-xs');
      if (title) title.textContent = faction.name;
      if (doctrine) doctrine.textContent = faction.doctrine;
      grid.appendChild(card);
    });
  }

  selectFaction(id) {
    this.selectedId = id;
    this.refresh();
  }

  refresh() {
    const selected = FACTIONS.find((faction) => faction.id === this.selectedId) || null;
    this.dom.factionGrid?.querySelectorAll('.faction-card').forEach((el) => {
      const active = el.dataset.factionId === this.selectedId;
      el.classList.toggle('btn-gold', active);
      el.classList.toggle('btn-dark', !active);
    });

    if (this.dom.selectedFactionName) this.dom.selectedFactionName.textContent = selected?.name || '-';
    if (this.dom.selectedFactionDesc) this.dom.selectedFactionDesc.textContent = selected?.desc || '-';
    if (this.dom.selectedFactionDoc) this.dom.selectedFactionDoc.textContent = selected?.doctrine || '-';
    if (this.dom.selectedFactionArmy) this.dom.selectedFactionArmy.textContent = selected?.armyHint || '-';
    if (this.dom.btnStart) this.dom.btnStart.disabled = !selected;

    const hasSave = Boolean(this.saveSystem?.hasSave?.());
    if (this.dom.btnContinue) this.dom.btnContinue.disabled = !hasSave;
    if (this.dom.startSaveInfo) {
      this.dom.startSaveInfo.textContent = hasSave
        ? 'Kayıt bulundu. Devam Et ile yükleyebilirsin.'
        : 'Kayıt bulunamadı.';
    }
  }

  setInfoMessage(message) {
    if (!this.dom.startSaveInfo) return;
    this.dom.startSaveInfo.textContent = message;
  }

  readSeed() {
    const parsed = parseInt(String(this.dom.seedInput?.value || '').trim(), 10);
    return Number.isFinite(parsed) ? parsed : 1337;
  }

  randomSeed() {
    return Math.floor(Date.now() % 2147483647 + Math.random() * 100000);
  }
}
