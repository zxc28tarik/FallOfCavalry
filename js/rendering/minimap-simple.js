export class MinimapSimple {
  constructor(canvasEl) {
    this.canvas = canvasEl || null;
    this.ctx = canvasEl?.getContext('2d') || null;
  }

  render(game) {
    if (!this.ctx || !this.canvas) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const bounds = game.getWorldBounds();
    const maxX = Math.max(1, bounds.maxX);
    const maxY = Math.max(1, bounds.maxY);
    const sx = w / maxX;
    const sy = h / maxY;

    this.ctx.fillStyle = '#0d1b2a';
    this.ctx.fillRect(0, 0, w, h);

    (game.enemyParties || []).forEach((e) => {
      if (!e) return;
      this.ctx.fillStyle = '#d9534f';
      this.ctx.beginPath();
      this.ctx.arc(e.x * sx, e.y * sy, 3, 0, Math.PI * 2);
      this.ctx.fill();
    });

    if (game.playerParty) {
      this.ctx.fillStyle = '#4aa3ff';
      this.ctx.beginPath();
      this.ctx.arc(
        game.playerParty.x * sx,
        game.playerParty.y * sy,
        5, 0, Math.PI * 2
      );
      this.ctx.fill();
    }

    const cam = game.getCameraSafe();
    const cw = ((game.canvas?.width || 800) / cam.zoom) * sx;
    const ch = ((game.canvas?.height || 600) / cam.zoom) * sy;
    this.ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(cam.x * sx, cam.y * sy, cw, ch);
  }
}

export default MinimapSimple;
