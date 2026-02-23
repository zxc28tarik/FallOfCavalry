export default class AccountingUI {
  constructor() {
    this.bound = false;
    this.dom = {};
  }

  bind({ modal, body, btnContinue }) {
    if (this.bound) return;
    this.dom.modal = modal || null;
    this.dom.body = body || null;
    this.dom.btnContinue = btnContinue || null;

    this.bound = true;
  }

  show(summary = {}) {
    if (!this.dom.modal || !this.dom.body) return false;

    const fmt = (v, digits = 2) => (Number.isFinite(v) ? Number(v).toFixed(digits).replace(/\.00$/, '') : '-');
    const yesNo = (v) => (v ? 'Evet' : 'Hayır');
    const raidText = summary.raid?.happened
      ? `Oldu (${summary.raid.lossText || 'kayıp var'})`
      : 'Yok';
    const notes = Array.isArray(summary.notes) ? summary.notes : [];
    const negativeGold = (summary.goldAfter ?? 0) < 0;

    this.dom.body.innerHTML = `
      <div><b>Gün:</b> ${summary.day ?? '-'}</div>
      <div><b>Food:</b> ${fmt(summary.foodBefore)} → ${fmt(summary.foodAfter)} (tüketim: ${fmt(summary.consumed)})</div>
      <div><b>Starvation:</b> ${yesNo(summary.starved)} (moral Δ: ${fmt(summary.starvationMoraleDelta || 0, 0)})</div>
      <div><b>Carry:</b> ${fmt(summary.weight)} / ${fmt(summary.capacity)} (hız çarpanı: ${fmt(summary.overcapSpeedMult || 1)})</div>
      <div><b>Camp:</b> ${summary.camp?.active ? 'Açık' : 'Kapalı'} / nöbet: ${summary.camp?.watch || '-'}</div>
      <div><b>Raid:</b> ${raidText}</div>
      <div><b>Gold:</b> ${fmt(summary.goldBefore, 0)} → ${fmt(summary.goldAfter, 0)} (Δ: ${fmt((summary.goldAfter ?? 0) - (summary.goldBefore ?? 0), 0)})</div>
      <div><b>Morale:</b> ${fmt(summary.moraleBefore, 0)} → ${fmt(summary.moraleAfter, 0)} (Δ: ${fmt((summary.moraleAfter ?? 0) - (summary.moraleBefore ?? 0), 0)})</div>
      ${negativeGold ? '<div style="margin-top:8px;color:#ff7675;"><b>Uyarı:</b> Altın negatif, moral cezası uygulandı.</div>' : ''}
      ${notes.length ? `<div style="margin-top:8px;opacity:.9;"><b>Notlar:</b><ul style="margin:6px 0 0 18px;">${notes.map((n) => `<li>${n}</li>`).join('')}</ul></div>` : ''}
    `;

    this.dom.modal.classList.remove('hidden');
    return true;
  }

  hide() {
    if (!this.dom.modal) return false;
    this.dom.modal.classList.add('hidden');
    return true;
  }
}
