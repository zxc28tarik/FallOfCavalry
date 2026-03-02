function ensureOutcomeModal() {
  if (typeof document === 'undefined') return null;
  let root = document.getElementById('campaignOutcomeModal');
  if (root) return root;

  root = document.createElement('div');
  root.id = 'campaignOutcomeModal';
  root.className = 'hidden fixed inset-0 z-[120] bg-black/85 text-white flex items-center justify-center p-6';
  root.innerHTML = `
    <div class="frame-dark max-w-xl w-full p-6">
      <h2 id="campaignOutcomeTitle" class="text-3xl font-bold mb-3">Outcome</h2>
      <div id="campaignOutcomeSummary" class="text-sm opacity-90 whitespace-pre-line mb-6"></div>
      <div class="flex justify-end gap-2">
        <button id="campaignOutcomeNewRun" class="action-btn btn-gold">New Run</button>
      </div>
    </div>
  `;
  document.body.appendChild(root);
  return root;
}

function showOutcome({ title, party, day, onNewRun }) {
  const root = ensureOutcomeModal();
  if (!root) return false;
  const titleEl = root.querySelector('#campaignOutcomeTitle');
  const summaryEl = root.querySelector('#campaignOutcomeSummary');
  const btn = root.querySelector('#campaignOutcomeNewRun');
  if (titleEl) titleEl.textContent = title;
  if (summaryEl) {
    summaryEl.textContent = `Final Renown: ${Math.floor(Number(party?.renown ?? 0))}\nFinal Gold: ${Math.floor(Number(party?.gold ?? 0))}\nDays Survived: ${Math.floor(Number(day ?? 1))}`;
  }
  if (btn) {
    btn.onclick = null;
    btn.onclick = () => {
      onNewRun?.();
      root.classList.add('hidden');
    };
  }
  root.classList.remove('hidden');
  return true;
}

export function showWinScreen({ party, day, onNewRun }) {
  return showOutcome({ title: 'Victory', party, day, onNewRun });
}

export function showLoseScreen({ party, day, onNewRun }) {
  return showOutcome({ title: 'Defeat', party, day, onNewRun });
}


const POI_MODAL_META = Object.freeze({
  ruin: Object.freeze({ title: 'Harabe', tag: 'RUIN', desc: 'Yıkık duvarlar arasında ganimet veya pusucular olabilir.' }),
  camp: Object.freeze({ title: 'Kamp', tag: 'CAMP', desc: 'Terk edilmiş çadırlarda izler hâlâ taze.' }),
  fort: Object.freeze({ title: 'Sınır Kalesi', tag: 'FORT', desc: 'Eski garnizon kalıntısı. Çatışma ihtimali yüksek.' }),
  shrine: Object.freeze({ title: 'Mabet', tag: 'SHRINE', desc: 'Yolcuların dua ettiği kutsal alan. Şöhret fırsatı sunar.' }),
  battlefield: Object.freeze({ title: 'Savaş Meydanı', tag: 'BATTLEFIELD', desc: 'Kırık mızraklar ve terk edilmiş teçhizat dolu bir alan.' }),
  caravan_site: Object.freeze({ title: 'Kervan Mevkii', tag: 'CARAVAN SITE', desc: 'Dağılmış kasalar ve ticaret rotası söylentileri var.' }),
});

export function getPoiModalMeta(poiType) {
  return POI_MODAL_META[String(poiType || '').toLowerCase()] || POI_MODAL_META.ruin;
}
