import { safeClass, safeText } from '../utils.js';

export default class PoiUI {
  constructor() {
    this.bound = false;
    this.refs = {};
    this.onInvestigate = null;
    this.onLeave = null;
    this.currentPoi = null;
  }

  bind({ modal, title, desc, cooldown, btnClose, btnInvestigate, btnLeave } = {}) {
    this.refs = { modal, title, desc, cooldown, btnClose, btnInvestigate, btnLeave };
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
      : (cooldownText || '');
    safeText(this.refs.cooldown, finalCooldownText);
    if (this.refs.btnInvestigate) {
      this.refs.btnInvestigate.disabled = !canInvestigate || hasRemaining;
    }
    safeClass(this.refs.modal, 'remove', 'hidden');
  }

  hide() {
    safeClass(this.refs.modal, 'add', 'hidden');
    this.currentPoi = null;
  }
}
