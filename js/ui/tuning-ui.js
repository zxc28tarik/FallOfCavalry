const GROUPS = [
  {
    key: 'ENCOUNTER_RISK',
    title: 'Encounter Risk',
    fields: [
      { key: 'ROAD_MULT', label: 'Road Mult', step: 0.01 },
      { key: 'OFFROAD_MULT', label: 'Offroad Mult', step: 0.01 },
      { key: 'STARVING_MULT', label: 'Starving Mult', step: 0.01 },
    ],
  },
  {
    key: 'POI',
    title: 'POI',
    fields: [
      { key: 'AMBUSH_CHANCE_RUIN', label: 'Ambush Chance (Ruin)', step: 0.01 },
      { key: 'CLUE_CHANCE_RUIN', label: 'Clue Chance (Ruin)', step: 0.01 },
      { key: 'RARE_BONUS_CHANCE', label: 'Rare Bonus Chance', step: 0.01 },
    ],
  },
  {
    key: 'MARKET',
    title: 'Market',
    fields: [
      { key: 'MOMENTUM_PER_QTY', label: 'Momentum Per Qty', step: 0.001 },
      { key: 'MOMENTUM_DECAY', label: 'Momentum Decay', step: 0.01 },
    ],
  },
  {
    key: 'SUPPLIES',
    title: 'Supplies',
    fields: [
      { key: 'DAILY_PER_UNIT_CONSUMPTION', label: 'Daily Per Unit Consumption', step: 0.01 },
      { key: 'STARVATION_MORALE_PENALTY', label: 'Starvation Morale Penalty', step: 1 },
    ],
  },
];

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj || {}));
}

export default class TuningUI {
  constructor({ getDefaults, getCurrent, onApply, onSave, onReset }) {
    this.getDefaults = getDefaults;
    this.getCurrent = getCurrent;
    this.onApply = onApply;
    this.onSave = onSave;
    this.onReset = onReset;
    this.localDraft = {};
    this.dom = null;
  }

  bind({ modal, body, btnClose, btnSave, btnReset }) {
    this.dom = { modal, body, btnClose, btnSave, btnReset };
    if (!body) return;
    if (body.dataset.tuningBound === '1') return;

    body.dataset.tuningBound = '1';
    this.render();

    if (btnClose) btnClose.addEventListener('click', () => this.hide());
    if (btnSave) btnSave.addEventListener('click', () => this.onSave?.(deepClone(this.localDraft)));
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.onReset?.();
        this.localDraft = deepClone(this.getCurrent?.() || this.getDefaults?.() || {});
        this.render();
      });
    }
  }

  show() {
    if (!this.dom?.modal) return;
    this.localDraft = deepClone(this.getCurrent?.() || this.getDefaults?.() || {});
    this.render();
    this.dom.modal.classList.remove('hidden');
  }

  hide() {
    if (!this.dom?.modal) return;
    this.dom.modal.classList.add('hidden');
  }

  render() {
    if (!this.dom?.body) return;
    const draft = deepClone(this.localDraft?.ENCOUNTER_RISK ? this.localDraft : (this.getCurrent?.() || {}));
    this.localDraft = draft;

    const chunks = [];
    for (const group of GROUPS) {
      chunks.push(`<div class="tuning-group-title">${group.title}</div><div class="tuning-grid">`);
      for (const field of group.fields) {
        const value = Number(draft?.[group.key]?.[field.key]);
        const safeVal = Number.isFinite(value) ? value : 0;
        chunks.push(
          `<div class="tuning-row">`
          + `<label class="tuning-label" for="tune-${group.key}-${field.key}">${field.label}</label>`
          + `<input id="tune-${group.key}-${field.key}" class="tuning-input" type="number" step="${field.step}" value="${safeVal}">`
          + `</div>`,
        );
      }
      chunks.push('</div>');
    }
    chunks.push('<div class="tuning-help">Not: Değerler anlık uygulanır, kalıcılık için Kaydet.</div>');
    this.dom.body.innerHTML = chunks.join('');

    GROUPS.forEach((group) => {
      group.fields.forEach((field) => {
        const input = this.dom.body.querySelector(`#tune-${group.key}-${field.key}`);
        if (!input) return;
        input.addEventListener('input', () => {
          const num = Number(input.value);
          if (!Number.isFinite(num)) return;
          if (!this.localDraft[group.key] || typeof this.localDraft[group.key] !== 'object') this.localDraft[group.key] = {};
          this.localDraft[group.key][field.key] = num;
          this.onApply?.(deepClone(this.localDraft));
        });
      });
    });
  }
}
