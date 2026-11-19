/**
 * V1.23 — minimal live escort HUD; textContent only, no template HTML and
 * no automatic world teleport. Player chooses a waypoint by clicking.
 */
export class QuestEscortHud {
  constructor(game) {
    this.game = game;
    this.root = null;
    this.button = null;
    this.status = null;
    this.followButton = null;
    this.followId = null;
    this.assignedTarget = null;
  }
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
      this.stopFollowing();
      player.destX = party.x; player.destY = party.y;
      player.hasDestination = true;
      player.selected = true;
    });
    const followButton = document.createElement('button');
    followButton.type = 'button';
    followButton.id = 'questEscortFollow';
    followButton.textContent = 'Kervanı takip et';
    followButton.style.cssText = 'padding:6px 10px;margin-left:6px;cursor:pointer';
    followButton.addEventListener('click', () => {
      const party = this._party;
      if (this.followId) {
        this.stopFollowing();
      } else if (party?.alive !== false && party?.id
        && this.game?.state?.mode === 'map') {
        this.followId = party.id;
        this.assignedTarget = null;
        this.refreshFollowTarget();
      }
      this.syncFollowButton();
    });
    root.append(title, info, button, followButton);
    document.body.appendChild(root);
    this.root = root; this.button = button; this.status = info;
    this.followButton = followButton;
    return root;
  }
  update({ party, playerParty, status, threatCount = 0, worldState } = {}) {
    const root = this.ensureRoot();
    if (!root) return;
    if (!party || party.alive === false || this.game?.state?.mode !== 'map') {
      this.hide(); return;
    }
    if (this.followId && this.followId !== party.id) this.stopFollowing();
    this._party = party;
    this.syncFollowButton();
    const dist = Math.hypot((playerParty?.x ?? party.x) - party.x,
      (playerParty?.y ?? party.y) - party.y);
    const tile = Math.max(1, Number(worldState?.tileSize || 32));
    const progress = Array.isArray(party.path) && party.path.length
      ? Math.min(100, Math.round(100 * party.escortVisitedPoints / party.path.length))
      : 0;
    const state = status === 'under_threat' && threatCount > 0
      ? 'Haydut tehdidi: kervan bekliyor'
      : status === 'awaiting_player' ? 'Kervan başlangıçta seni bekliyor'
      : status === 'waiting_for_player' ? 'Uzaklaştın, kervan seni bekliyor'
      : status === 'confirming_arrival' ? 'Varış doğrulanıyor'
      : 'Kervan ilerliyor';
    this.status.textContent = `${state}\nMesafe: ${Math.round(dist / tile)} kare · Yol: %${progress}`;
    this.root.style.display = 'block';
    this.button.disabled = !Number.isFinite(party.x) || !Number.isFinite(party.y);
  }
  syncFollowButton() {
    if (this.followButton) {
      this.followButton.textContent = this.followId
        ? 'Takibi durdur' : 'Kervanı takip et';
      this.followButton.setAttribute('aria-pressed', this.followId ? 'true' : 'false');
    }
  }

  stopFollowing() {
    const player = this.game?.playerParty;
    // Only cancel a destination that we ourselves last assigned. A manual
    // map click/new destination must never be erased by this control.
    if (player?.hasDestination && this.assignedTarget
      && Math.hypot(player.destX - this.assignedTarget.x,
        player.destY - this.assignedTarget.y) < 2) {
      player.hasDestination = false;
    }
    this.followId = null;
    this.assignedTarget = null;
    this.syncFollowButton();
  }

  /**
   * Called before the genuine player motion/terrain/collision tick.
   * Never adjusts player.x/y, speed or world collision; a manual destination
   * change cancels following and is left exactly as the player selected it.
   */
  refreshFollowTarget() {
    if (!this.followId) return false;
    const party = this._party;
    const player = this.game?.playerParty;
    const map = this.game?.state?.map;
    if (this.game?.state?.mode !== 'map' || !party || party.alive === false
      || party.id !== this.followId || !player
      || !Number.isFinite(party.x) || !Number.isFinite(party.y)
      || this.game?.state?.camp?.active) {
      this.stopFollowing();
      return false;
    }
    if (this.assignedTarget && player.hasDestination
      && Math.hypot(player.destX - this.assignedTarget.x,
        player.destY - this.assignedTarget.y) >= 2) {
      // Manual click-to-move takes priority.
      this.followId = null;
      this.assignedTarget = null;
      this.syncFollowButton();
      return false;
    }
    const tile = Math.max(1, Number(map?.tileSize || 32));
    const distance = Math.hypot(player.x - party.x, player.y - party.y);
    if (distance <= Math.max(18, tile * 1.35)) {
      if (this.assignedTarget && player.hasDestination) {
        player.hasDestination = false;
      }
      this.assignedTarget = null;
      return true;
    }
    if (player.moveState === 'blocked') {
      this.stopFollowing();
      return false;
    }
    player.destX = party.x;
    player.destY = party.y;
    player.hasDestination = true;
    player.selected = true;
    this.assignedTarget = { x: party.x, y: party.y };
    return true;
  }

  hide() {
    this.stopFollowing();
    this._party = null;
    if (this.root) this.root.style.display = 'none';
  }
}
export default QuestEscortHud;
