export class GameInputManager {
  constructor(gameState) {
    this.state = gameState;
    this.game = null;
    // pointer tracking state
    this.rightPointerTracking = false;
    this.rightPointerMoved = false;
    this.rightPointerStartX = 0;
    this.rightPointerStartY = 0;
    this._wheelBound = false;
    // event handler refs
    this.partyPointerHandler = null;
    this.partyContextMenuHandler = null;
    this.partyPointerMoveHandler = null;
    this.partyPointerUpHandler = null;
    this.keyboardHandler = null;
  }

  init(game) {
    this.game = game;
  }

  setupPartyInputHandlers() {
    const g = this.game;
    if (!g?.canvas || this.partyPointerHandler || this.partyContextMenuHandler || this.partyPointerMoveHandler || this.partyPointerUpHandler) return;

    this.partyPointerHandler = (event) => {
      if (g.state?.mode === 'battle') {
        if (event?.button !== 0) return;
        const rect = g.canvas.getBoundingClientRect();
        const x = (event?.clientX ?? 0) - rect.left;
        const y = (event?.clientY ?? 0) - rect.top;

        if (g.state?.battle?.phase === 'deploy' && g.battleDeployMode?.active) {
          g.battleDeployMode.setAnchor(x, y);
          return;
        }

        const hit = (g.state?.battle?.playerUnits || []).find((u) => !u.dead && Math.hypot(u.x - x, u.y - y) <= ((u.radius ?? 10) + 8));
        if (!hit) return;
        g.state.battle.selection = g.state.battle.selection || {};
        g.state.battle.selection.unitId = hit.unitId;
        return;
      }

      if (!g.playerParty || g.mode === 'menu' || g.state?.mode !== 'map') return;

      const rect = typeof g.canvas.getBoundingClientRect === 'function'
        ? g.canvas.getBoundingClientRect()
        : { left: 0, top: 0 };
      const screenX = (event?.clientX ?? 0) - (rect.left ?? 0);
      const screenY = (event?.clientY ?? 0) - (rect.top ?? 0);
      const world = g.updatePointerWorldState(screenX, screenY);

      if (event?.button === 0) {
        if (event?.shiftKey) {
          g.setPlayerDestination(world.x, world.y);
          return;
        }

        if (g.isWorldPointOnParty(world.x, world.y)) {
          g.playerParty.selected = !g.playerParty.selected;
        } else {
          g.playerParty.selected = false;
        }
        return;
      }

      if (event?.button === 2) {
        event.preventDefault?.();
        this.rightPointerTracking = true;
        this.rightPointerMoved = false;
        this.rightPointerStartX = screenX;
        this.rightPointerStartY = screenY;
      }
    };

    this.partyPointerMoveHandler = (event) => {
      if (g.state?.mode === 'battle') {
        return;
      }

      if (!this.rightPointerTracking || !g.playerParty || g.mode === 'menu' || g.state?.mode !== 'map') return;

      const rect = typeof g.canvas.getBoundingClientRect === 'function'
        ? g.canvas.getBoundingClientRect()
        : { left: 0, top: 0 };
      const screenX = (event?.clientX ?? 0) - (rect.left ?? 0);
      const screenY = (event?.clientY ?? 0) - (rect.top ?? 0);
      const moved = Math.hypot(screenX - this.rightPointerStartX, screenY - this.rightPointerStartY);
      if (moved > 8) {
        this.rightPointerMoved = true;
      }
      g.updatePointerWorldState(screenX, screenY);
    };

    this.partyPointerUpHandler = (event) => {
      if (g.state?.mode === 'battle') {
        g.battleDragUnitId = null;
        g.battleDragOffsetX = 0;
        g.battleDragOffsetY = 0;
        return;
      }

      if (event?.button !== 2 || !this.rightPointerTracking || !g.playerParty || g.mode === 'menu' || g.state?.mode !== 'map') return;

      this.rightPointerTracking = false;
      if (this.rightPointerMoved) {
        this.rightPointerMoved = false;
        return;
      }

      const rect = typeof g.canvas.getBoundingClientRect === 'function'
        ? g.canvas.getBoundingClientRect()
        : { left: 0, top: 0 };
      const screenX = (event?.clientX ?? 0) - (rect.left ?? 0);
      const screenY = (event?.clientY ?? 0) - (rect.top ?? 0);
      const world = g.updatePointerWorldState(screenX, screenY);

      if (g.isWorldPointOnParty(world.x, world.y)) {
        g.cancelPlayerDestination();
        return;
      }

      g.setPlayerDestination(world.x, world.y);
    };

    this.partyContextMenuHandler = (event) => {
      event?.preventDefault?.();
    };

    g.canvas.addEventListener('mousedown', this.partyPointerHandler, { passive: false });
    g.canvas.addEventListener('mousemove', this.partyPointerMoveHandler, { passive: false });
    g.canvas.addEventListener('mouseup', this.partyPointerUpHandler, { passive: false });
    g.canvas.addEventListener('contextmenu', this.partyContextMenuHandler, { passive: false });

    if (g.canvas && !this._wheelBound) {
      this._wheelBound = true;
      g.canvas.addEventListener('wheel', (e) => {
        if (g.state?.mode !== 'map') return;
        e.preventDefault();
        const cam = g.getCameraSafe();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        cam.zoom = Math.max(0.3, Math.min(3.0, cam.zoom * factor));
        g.clampCameraToWorld();
      }, { passive: false });
    }
  }
}
