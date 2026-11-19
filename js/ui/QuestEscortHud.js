/**
 * V1.23 — minimal live escort HUD; textContent only, no template HTML and
 * no automatic world teleport. Player chooses a waypoint by clicking.
 */
export class QuestEscortHud {
  constructor(game) { this.game = game; this.root = null; this.button = null; this.status = null; }
  ensureRoot() {
    if (typeof document === 'undefined') return null;
    if (this.root?.isConnected) return this.root;
    const root = document.createElement('section');
    root.id = 'questEscortHud';
    root.setAttribute('aria-label', 'Kervan refakat rehberi');
    root.style.cssText = 'position:fixed;left:16px;bottom:18px;z-index:1000;'
      + 'max-width:min(330px,calc(100vw - 32px));padding:10px 12px;'
      + 'background:#192a30ee;color:#f4eddf;border:1px solid #af956b;'
      + 'border-radius:6px;box-shadow:0 3px 14px #0008;'
      + 'font:13px/1.4 sans-serif;display:none';
    const title = document.createElement('strong');
    title.textContent = 'Kervan Refakati';
    const info = document.createElement('div');
    info.id = 'questEscortStatus';
    info.style.whiteSpace = 'pre-line';
    info.style.margin = '5px 0 8px';
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'questEscortNavigate';
    button.textContent = 'Kervana git';
    button.style.cssText = 'padding:6px 10px;cursor:pointer';
    button.addEventListener('click', () => {
      const party = this._party;
      const player = this.game?.playerParty;
      if (!party || party.alive === false || this.game?.state?.mode !== 'map'
        || !Number.isFinite(party.x) || !Number.isFinite(party.y)
        || !player) return;
      player.destX = party.x; player.destY = party.y;
      player.hasDestination = true;
      player.selected = true;
    });
    root.append(title, info, button);
    document.body.appendChild(root);
    this.root = root; this.button = button; this.status = info;
    return root;
  }
  update({ party, playerParty, status, threatCount = 0, worldState } = {}) {
    const root = this.ensureRoot();
    if (!root) return;
    if (!party || party.alive === false || this.game?.state?.mode !== 'map') {
      this.hide(); return;
    }
    this._party = party;
    const dist = Math.hypot((playerParty?.x ?? party.x) - party.x,
      (playerParty?.y ?? party.y) - party.y);
    const tile = Math.max(1, Number(worldState?.tileSize || 32));
    const progress = Array.isArray(party.path) && party.path.length
      ? Math.min(100, Math.round(100 * party.escortVisitedPoints / party.path.length))
      : 0;
    const state = threatCount > 0 ? 'Haydut tehdidi: kervan bekliyor'
      : status === 'awaiting_player' ? 'Kervan başlangıçta seni bekliyor'
      : status === 'waiting_for_player' ? 'Uzaklaştın, kervan seni bekliyor'
      : status === 'confirming_arrival' ? 'Varış doğrulanıyor'
      : 'Kervan ilerliyor';
    this.status.textContent = `${state}\nMesafe: ${Math.round(dist / tile)} kare · Yol: %${progress}`;
    this.root.style.display = 'block';
    this.button.disabled = !Number.isFinite(party.x) || !Number.isFinite(party.y);
  }
  hide() {
    this._party = null;
    if (this.root) this.root.style.display = 'none';
  }
}
export default QuestEscortHud;
