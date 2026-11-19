import {
  planLegacyTradeRouteRecovery, reissueLegacyTradeRouteQuest,
  describePendingQuestClaims,
} from '../systems/legacy-trade-route-recovery.js';

/**
 * Small, optional nonblocking audit panel. Only actual save/load issues appear
 * here. Claims are clearly historical, NOT verified quest achievements.
 */
export class QuestRecoveryPanel {
  constructor(game) {
    this.game = game;
    this.root = null;
    this.toggle = null;
  }

  ensureRoot() {
    if (typeof document === 'undefined') return null;
    if (this.root) return this.root;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.id = 'questRecoveryToggle';
    toggle.textContent = 'Görev Kayıtları';
    toggle.style.cssText = 'position:fixed;right:12px;bottom:14px;z-index:10000;'
      + 'padding:8px 12px;background:#233b42;color:#fff;border:1px solid #b8a076;'
      + 'border-radius:6px;cursor:pointer;font:14px sans-serif;display:none';
    const panel = document.createElement('aside');
    panel.id = 'questRecoveryPanel';
    panel.setAttribute('aria-label', 'Kayıtlı görev durumlarını incele');
    panel.style.cssText = 'position:fixed;right:12px;bottom:58px;z-index:10000;'
      + 'width:min(370px,calc(100vw - 24px));max-height:56vh;overflow:auto;'
      + 'padding:14px;background:#182a31;color:#f0e5d0;border:1px solid #b8a076;'
      + 'border-radius:7px;box-shadow:0 6px 24px #0008;'
      + 'font:14px/1.4 sans-serif;display:none';
    toggle.addEventListener('click', () => {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
    document.body.append(toggle, panel);
    this.root = panel;
    this.toggle = toggle;
    return panel;
  }

  refresh({ autoOpen = false } = {}) {
    const root = this.ensureRoot();
    const g = this.game;
    if (!root || !g?.questManager) return false;
    const routes = g.economyManager?.ensureTradeRoutes?.() || [];
    const settlements = g.state?.map?.settlements || [];
    const currentDay = Math.max(0, Math.floor(Number(g.state?.day) || 0));
    const pending = describePendingQuestClaims(g.questManager.activeQuests);
    const legacy = g.questManager.activeQuests
      .filter(q => q?.status === 'active' && q.targetRouteId
        && routes.some(r => r?.id === q.targetRouteId && r.roadBacked === false))
      .map(q => ({ quest: q, proposal: planLegacyTradeRouteRecovery({
        quest: q, tradeRoutes: routes, settlements, currentDay,
      }) }));
    if (!pending.length && !legacy.length) {
      this.toggle.style.display = 'none';
      root.style.display = 'none';
      root.replaceChildren();
      return false;
    }
    this.toggle.style.display = 'block';
    root.replaceChildren();

    const title = document.createElement('strong');
    title.textContent = 'Görev kayıtları ve hedefler';
    root.appendChild(title);
    const addText = (parent, str) => {
      const p = document.createElement('p');
      p.textContent = str;
      p.style.margin = '9px 0';
      parent.appendChild(p);
    };
    for (const item of pending) addText(root,
      `${item.title}: ${item.count} kayıtlı ilerleme iddiası doğrulanmadı. `
      + 'Ödül açılmaz; hedefi yeni gerçek olayla doğrula.');
    for (const { quest, proposal } of legacy) {
      const section = document.createElement('section');
      section.style.borderTop = '1px solid #54676a';
      section.style.paddingTop = '8px';
      addText(section,
        `${String(quest.title || quest.templateId)} — eski yol: ${quest.targetRouteId}. `
        + 'Bu yol artık gerçek harita bağlantısı değil.');
      if (proposal) {
        addText(section, `Önerilen yeni gerçek yol: ${proposal.newRouteId}`
          + ` (bağlı şehir: ${proposal.connectedCityName}). `
          + 'Onaylarsan görev hedefi ve süresi bugünden yeniden başlar; eski kayıtlar ödül oluşturmaz.');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'quest-reissue-route';
        btn.textContent = 'Yeni yol hedefini onayla';
        btn.style.cssText = 'padding:7px 10px;cursor:pointer';
        btn.dataset.questId = quest.id;
        btn.addEventListener('click', () => {
          const res = reissueLegacyTradeRouteQuest({
            questManager: g.questManager, questId: quest.id,
            tradeRoutes: g.economyManager?.ensureTradeRoutes?.() || [],
            settlements: g.state?.map?.settlements || [],
            currentDay: Math.max(0, Math.floor(Number(g.state?.day) || 0)),
          });
          if (res.ok) {
            g.worldManager?.simManager?.worldPartyManager?.ensureWorldParties?.();
            g.saveManager?.runAutosave?.('quest-legacy-route-reissue');
          }
          this.refresh({ autoOpen: !res.ok });
        });
        section.appendChild(btn);
      } else {
        addText(section, 'Bu görev için aynı şehirden çıkan doğrulanmış bir yol'
          + ' bulunamadı. Otomatik hedef veya ödül oluşturulmadı.');
      }
      root.appendChild(section);
    }
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.textContent = 'Kapat';
    dismiss.className = 'quest-recovery-close';
    dismiss.style.cssText = 'margin-top:12px;padding:6px 12px;cursor:pointer';
    dismiss.addEventListener('click', () => { root.style.display = 'none'; });
    root.appendChild(dismiss);
    if (autoOpen) root.style.display = 'block';
    return true;
  }

  hide() {
    if (this.root) this.root.style.display = 'none';
    if (this.toggle) this.toggle.style.display = 'none';
  }
}

export default QuestRecoveryPanel;
