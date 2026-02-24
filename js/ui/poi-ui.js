import { safeClass, safeText } from '../utils.js';

export default class PoiUI {
  constructor() {
    this.bound = false;
    this.refs = {};
    this.onInvestigate = null;
    this.onLeave = null;
    this.currentPoi = null;
  }

  bind({ modal, title, desc, cooldown, result, btnClose, btnInvestigate, btnLeave } = {}) {
    this.refs = { modal, title, desc, cooldown, result, btnClose, btnInvestigate, btnLeave };
    if (this.bound) return;

    btnClose?.addEventListener?.('click', () => {
      this.onLeave?.(this.currentPoi);
      this.hide();
    });

    btnLeave?.addEventListener?.('click', () => {
      this.onLeave?.(this.currentPoi);
      this.hide();
    });

    btnInvestigate?.addEventListener?.('click', () => {
      if (this.refs.btnInvestigate) this.refs.btnInvestigate.disabled = true;
      if (this.refs.btnLeave) this.refs.btnLeave.disabled = true;
      this.onInvestigate?.(this.currentPoi);
    });

    this.bound = true;
  }

  show({ poi, canInvestigate, cooldownText, remainingDays } = {}) {
    this.currentPoi = poi || null;
    const label = poi?.type === 'ruin' ? 'Harabe' : 'Kamp';
    safeText(this.refs.title, label);
    safeText(this.refs.desc, poi?.type === 'ruin' ? 'Yıkık duvarlar arasında değerli bir şeyler olabilir.' : 'Sönmüş ateşler ve terk edilmiş çadırlar dikkat çekiyor.');
    const hasRemaining = Number.isFinite(remainingDays) && remainingDays > 0;
    const finalCooldownText = hasRemaining
      ? `Tekrar inceleme: ${remainingDays} gün sonra`
      : (cooldownText || 'İnceleme riskli olabilir.');
    safeText(this.refs.cooldown, finalCooldownText);
    safeText(this.refs.btnClose, 'Kapat');
    if (this.refs.btnInvestigate) {
      this.refs.btnInvestigate.disabled = !canInvestigate || hasRemaining;
      safeText(this.refs.btnInvestigate, 'İncele (Riskli)');
    }
    if (this.refs.btnLeave) {
      this.refs.btnLeave.disabled = false;
      safeText(this.refs.btnLeave, 'Ayrıl');
    }
    this.clearResult();
    safeClass(this.refs.modal, 'remove', 'hidden');
  }

  showResult({ kind, lines } = {}) {
    if (!this.refs.result) return;
    const safeLines = Array.isArray(lines) ? lines.filter(Boolean) : [];
    const titleMap = {
      loot: 'Ganimet Bulundu',
      ambush: 'Pusu!',
      clue: 'İpucu',
      nothing: 'Boş Çıktı',
    };
    const htmlLines = safeLines.map((line) => `<div>${String(line)}</div>`).join('');
    this.refs.result.innerHTML = `<div class="font-bold text-sm mb-1">${titleMap[kind] || 'Sonuç'}</div>${htmlLines}`;
    safeClass(this.refs.result, 'remove', 'hidden');
    if (this.refs.btnInvestigate) this.refs.btnInvestigate.disabled = true;
    if (this.refs.btnLeave) this.refs.btnLeave.disabled = true;
    safeText(this.refs.btnClose, 'Kapat');
  }

  clearResult() {
    if (!this.refs.result) return;
    this.refs.result.innerHTML = '';
    safeClass(this.refs.result, 'add', 'hidden');
  }

  hide() {
    safeClass(this.refs.modal, 'add', 'hidden');
    this.clearResult();
    this.currentPoi = null;
  }
}
