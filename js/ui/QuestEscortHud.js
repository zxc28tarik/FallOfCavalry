import { chooseEscortRoadFollowTarget } from '../systems/quest-escort-road-follow.js';
import { inspectLiveEscortCargo } from '../systems/quest-escort-cargo.js';

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
    this.followIssue = null;
    this.followStage = null;
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
        this.followIssue = null;
        // Explicit follow toggling overrides a previous manual destination.
        if (this.game?.playerParty) this.game.playerParty.hasDestination = false;
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
    const guards = Number.isFinite(party.escortGuardCount)
      ? Math.max(0, party.escortGuardCount) : 0;
    const health = Math.max(0, Math.round(Number(party.escortHull) || 0));
    const cargo = Math.max(0, Math.round(Number(party.escortCargo) || 0));
    const security = `\nMuhafız: ${guards} · Kervan: %${health} · Yük: %${cargo}`;
    const catalog = this.game?.economyManager?.itemCatalog || [];
    const goods = inspectLiveEscortCargo(party);
    const cargoDetails = goods.length ? '\nMal: ' + goods.map(row => {
      const name = catalog.find(item => item.id === row.id)?.name || row.id;
      return `${name} ×${row.qty}`;
    }).join(', ') : '';
    const follower = this.followId
      ? '\nTakip: gerçek yol noktaları kullanılıyor'
      : this.followIssue ? '\nTakip durdu: yol engelli / geçilemez' : '';
    this.status.textContent = `${state}\nMesafe: ${Math.round(dist / tile)} kare · Yol: %${progress}${security}${cargoDetails}${follower}`;
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
    const radius = Math.max(18, tile * 1.35);
    // Once close to the caravan we deliberately release the moving target.
    // A NEW map click during this idle-follow state still cancels following.
    if (!this.assignedTarget && player.hasDestination
      && Math.hypot(player.destX - party.x, player.destY - party.y) > radius) {
      this.followId = null;
      this.syncFollowButton();
      return false;
    }
    const distance = Math.hypot(player.x - party.x, player.y - party.y);
    if (distance <= radius) {
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
    const result = chooseEscortRoadFollowTarget({
      playerParty: player, caravan: party, worldState: map,
      terrainAt: typeof this.game?.worldManager?.getMovementContextAt === 'function'
        ? (x,y) => this.game.worldManager.getMovementContextAt(x,y)
        : null,
    });
    if (result.status === 'near') {
      if (this.assignedTarget && player.hasDestination) player.hasDestination = false;
      this.assignedTarget = null;
      return true;
    }
    if (result.status !== 'moving' || !result.target) {
      this.followIssue = result.status;
      this.stopFollowing();
      return false;
    }
    player.destX = result.target.x;
    player.destY = result.target.y;
    player.hasDestination = true;
    player.selected = true;
    this.assignedTarget = { ...result.target };
    this.followIssue = null;
    this.followStage = result.stage;
    return true;
  }

  hide() {
    this.stopFollowing();
    this._party = null;
    if (this.root) this.root.style.display = 'none';
  }
}
export default QuestEscortHud;
