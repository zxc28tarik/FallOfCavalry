import { FACTIONS } from '../constants.js';
import * as utils from '../utils.js';
import { createPlayerCharacter, defaultCharacterDraft } from '../systems/character-creation.js';

const PLAYABLE_FACTIONS = FACTIONS.filter((faction) => faction?.playable !== false);

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
    this.loading = false;
    this.statusMessage = '';
    this.progressEl = null;
    this.characterCultureTouched = false;
  }

  bind(dom) {
    if (this.bound) return;
    this.bound = true;
    this.dom = dom || {};
    if (!this.dom.factionGrid) this.dom.factionGrid = utils.getEl('factionGrid');

    this.renderFactionGrid();

    this.dom.factionGrid?.addEventListener('click', (event) => {
      if (this.loading) return;
      const card = event.target?.closest?.('.faction-card');
      if (!card) return;
      this.selectFaction(card.dataset.factionId);
    });

    this.dom.btnStart?.addEventListener('click', async () => {
      if (this.loading) return;
      const faction = PLAYABLE_FACTIONS.find((item) => item.id === this.selectedId);
      if (!faction) {
        this.setInfoMessage('Once sancak secmelisin.');
        return;
      }
      const creation = createPlayerCharacter(this.readCharacterDraft(), faction.id);
      if (!creation.ok) {
        this.setInfoMessage(creation.error);
        return;
      }
      await this.onStart?.({ faction, seed: this.readSeed(), character: creation.character, startingModifiers: creation.startingModifiers });
    });

    this.dom.btnContinue?.addEventListener('click', async () => {
      if (this.loading) return;
      await this.onContinue?.();
    });

    this.dom.btnLoadStart?.addEventListener('click', () => {
      if (this.loading) return;
      const ok = this.onLoad?.();
      if (ok === false) this.setInfoMessage('Kayit yukleme arayuzu yok; autosave yok.');
    });

    this.dom.seedInput?.addEventListener('input', () => this.refresh());
    for (const input of [this.dom.characterNameInput, this.dom.characterCultureInput, this.dom.characterOriginInput, this.dom.characterFocusInput, this.dom.characterAgeInput]) {
      input?.addEventListener('input', () => {
        if (input === this.dom.characterCultureInput) this.characterCultureTouched = true;
        this.refresh();
      });
    }
    this.dom.randomSeedBtn?.addEventListener('click', () => {
      const seed = this.randomSeed();
      if (this.dom.seedInput) this.dom.seedInput.value = String(seed);
      this.refresh();
    });

    if (this.dom.seedInput) {
      this.dom.seedInput.value = String(this.state?.seed ?? 1337);
    }
    if (this.dom.characterNameInput && !this.dom.characterNameInput.value) {
      this.dom.characterNameInput.value = 'Yeni Komutan';
    }

    this.refresh();
  }

  ensureProgressElement() {
    if (this.progressEl || !this.dom.startSaveInfo) return this.progressEl;
    const wrap = document.createElement('div');
    wrap.className = 'mt-2 h-2 w-full rounded bg-black/30 overflow-hidden hidden';
    const bar = document.createElement('div');
    bar.className = 'h-full bg-amber-400 transition-all';
    bar.style.width = '0%';
    wrap.appendChild(bar);
    this.dom.startSaveInfo.insertAdjacentElement('afterend', wrap);
    this.progressEl = { wrap, bar };
    return this.progressEl;
  }

  renderFactionGrid() {
    const grid = this.dom.factionGrid;
    if (!grid) return;
    grid.innerHTML = '';

    PLAYABLE_FACTIONS.forEach((faction) => {
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
    if (!this.characterCultureTouched && this.dom.characterCultureInput) {
      this.dom.characterCultureInput.value = defaultCharacterDraft(id).cultureId;
    }
    this.refresh();
  }

  readCharacterDraft() {
    const defaults = defaultCharacterDraft(this.selectedId);
    return {
      name: this.dom.characterNameInput?.value ?? 'Yeni Komutan',
      cultureId: this.dom.characterCultureInput?.value || defaults.cultureId,
      originId: this.dom.characterOriginInput?.value || defaults.originId,
      focusId: this.dom.characterFocusInput?.value || defaults.focusId,
      ageGroup: this.dom.characterAgeInput?.value || defaults.ageGroup,
    };
  }

  refreshCharacterPreview() {
    const preview = this.dom.characterPreview;
    if (!preview) return true;
    const creation = createPlayerCharacter(this.readCharacterDraft(), this.selectedId);
    if (!creation.ok) {
      preview.textContent = creation.error;
      return false;
    }
    const { character, startingModifiers } = creation;
    const bestStats = Object.entries(character.stats).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const labels = { intelligence: 'Zekâ', observation: 'Gözlem', persuasion: 'İkna', leadership: 'Liderlik', command: 'Kumandanlık', trade: 'Ticaret', administration: 'Yönetim', courage: 'Cesaret', experience: 'Tecrübe' };
    const strengths = bestStats.map(([key, value]) => labels[key] + ' ' + value).join(' | ');
    preview.textContent = character.name + ' · ' + strengths + ' · Başlangıç etkisi: +' + startingModifiers.gold + ' altın, +' + startingModifiers.morale + ' moral, +' + startingModifiers.renown + ' şöhret';
    return true;
  }

  refresh() {
    const selected = PLAYABLE_FACTIONS.find((faction) => faction.id === this.selectedId) || null;
    this.dom.factionGrid?.querySelectorAll('.faction-card').forEach((el) => {
      const active = el.dataset.factionId === this.selectedId;
      el.classList.toggle('btn-gold', active);
      el.classList.toggle('btn-dark', !active);
      el.disabled = this.loading;
    });

    if (this.dom.selectedFactionName) this.dom.selectedFactionName.textContent = selected?.name || '-';
    if (this.dom.selectedFactionDesc) this.dom.selectedFactionDesc.textContent = selected?.desc || '-';
    if (this.dom.selectedFactionDoc) this.dom.selectedFactionDoc.textContent = selected?.doctrine || '-';
    if (this.dom.selectedFactionArmy) this.dom.selectedFactionArmy.textContent = selected?.armyHint || '-';
    const characterValid = this.refreshCharacterPreview();
    if (this.dom.btnStart) this.dom.btnStart.disabled = this.loading || !selected || !characterValid;

    const hasSave = Boolean(this.saveSystem?.hasSave?.());
    if (this.dom.btnContinue) this.dom.btnContinue.disabled = this.loading || !hasSave;
    if (this.dom.btnLoadStart) this.dom.btnLoadStart.disabled = this.loading;
    if (!this.loading && this.dom.startSaveInfo) {
      this.dom.startSaveInfo.textContent = this.statusMessage || (hasSave
        ? 'Kayit bulundu. Devam Et ile yukleyebilirsin.'
        : 'Kayit bulunamadi.');
    }
  }

  setInfoMessage(message) {
    this.statusMessage = String(message || '');
    if (!this.dom.startSaveInfo) return;
    this.dom.startSaveInfo.textContent = this.statusMessage;
  }

  setLoading(isLoading, message = '') {
    this.loading = Boolean(isLoading);
    if (message) this.setInfoMessage(message);
    const progress = this.ensureProgressElement();
    if (progress) {
      progress.wrap.classList.toggle('hidden', !this.loading);
      if (this.loading) progress.bar.style.width = '0%';
    }
    this.refresh();
  }

  setLoadingProgress(progress, message = '') {
    const percent = Math.max(0, Math.min(100, Math.floor(Number(progress) || 0)));
    const progressEl = this.ensureProgressElement();
    if (progressEl) {
      progressEl.wrap.classList.remove('hidden');
      progressEl.bar.style.width = `${percent}%`;
    }
    this.setInfoMessage(`${message || 'Harita yukleniyor'} ${percent}%`);
  }

  readSeed() {
    const parsed = parseInt(String(this.dom.seedInput?.value || '').trim(), 10);
    return Number.isFinite(parsed) ? parsed : 1337;
  }

  randomSeed() {
    return Math.floor(Date.now() % 2147483647 + Math.random() * 100000);
  }
}
