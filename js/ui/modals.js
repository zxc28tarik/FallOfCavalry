import { getEventTypeLabel, getEventDescription } from '../systems/events.js';

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

function ensureCurrentEventsModal() {
  if (typeof document === 'undefined') return null;
  let root = document.getElementById('currentEventsModal');
  if (root) return root;

  root = document.createElement('div');
  root.id = 'currentEventsModal';
  root.className = 'hidden fixed inset-0 z-[115] bg-black/80 text-white flex items-center justify-center p-6';
  root.innerHTML = `
    <div class="frame-dark max-w-2xl w-full p-5 max-h-[80vh] overflow-auto">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-2xl font-bold">Current Events</h2>
        <button id="currentEventsClose" class="action-btn btn-dark text-xs">Close</button>
      </div>
      <div id="currentEventsBody" class="space-y-2 text-sm"></div>
    </div>
  `;
  document.body.appendChild(root);
  const close = root.querySelector('#currentEventsClose');
  close?.addEventListener('click', () => root.classList.add('hidden'));
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

export function renderCurrentEventsModal({ events = [], currentDay = 1 } = {}) {
  const root = ensureCurrentEventsModal();
  if (!root) return false;
  const body = root.querySelector('#currentEventsBody');
  if (!body) return false;

  const rows = Array.isArray(events) ? events : [];
  if (!rows.length) {
    body.innerHTML = '<div class="opacity-80">No active world events.</div>';
    return true;
  }

  body.innerHTML = rows.map((event) => {
    const daysLeft = Math.max(0, Number(event?.endDay ?? currentDay) - Number(currentDay ?? 1));
    const target = event?.cityId || event?.regionId || 'global';
    return `
      <div class="frame-dark p-3">
        <div class="font-bold">${getEventTypeLabel(event?.type)} · ${target}</div>
        <div class="text-xs opacity-80">${getEventDescription(event)}</div>
        <div class="text-xs opacity-70">Remaining: ${daysLeft} day(s)</div>
      </div>
    `;
  }).join('');
  return true;
}

export function toggleCurrentEventsModal({ events = [], currentDay = 1 } = {}) {
  const root = ensureCurrentEventsModal();
  if (!root) return false;
  const willOpen = root.classList.contains('hidden');
  if (willOpen) {
    renderCurrentEventsModal({ events, currentDay });
    root.classList.remove('hidden');
  } else {
    root.classList.add('hidden');
  }
  return willOpen;
}

export function isCurrentEventsModalOpen() {
  const root = typeof document !== 'undefined' ? document.getElementById('currentEventsModal') : null;
  return Boolean(root && !root.classList.contains('hidden'));
}

export function showWinScreen({ party, day, onNewRun }) {
  return showOutcome({ title: 'Victory', party, day, onNewRun });
}

export function showLoseScreen({ party, day, onNewRun }) {
  return showOutcome({ title: 'Defeat', party, day, onNewRun });
}
