/**
 * FallOfCavalry - Canvas Renderer
 * Ana render koordinatörü
 */

import MapRenderer from './map-renderer.js';
import CityRenderer from './city-renderer.js';
import BattleRenderer from './battle-renderer.js';

export class CanvasRenderer {
  constructor(canvas, state) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = state;
    
    // Sub-renderers
    this.mapRenderer = new MapRenderer();
    this.cityRenderer = new CityRenderer();
    this.battleRenderer = new BattleRenderer();
    
    // Performance
    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();
  }
  
  render() {
    // Clear
    this.ctx.fillStyle = '#0a0a0a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Render based on mode
    switch (this.state.mode) {
      case 'start':
        this.renderStart();
        break;
      case 'map':
        this.mapRenderer.render(this.ctx, this.state);
        break;
      case 'city':
        this.cityRenderer.render(this.ctx, this.state);
        break;
      case 'battle':
        this.battleRenderer.render(this.ctx, this.state);
        break;
      case 'encounter':
        this.renderEncounter();
        break;
    }
    
    // FPS counter
    this.updateFPS();
  }
  
  renderStart() {
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '48px "Cinzel", serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('FallOfCavalry', this.canvas.width / 2, this.canvas.height / 2);
    
    this.ctx.font = '24px "Crimson Text", serif';
    this.ctx.fillText('Grand Strategy', this.canvas.width / 2, this.canvas.height / 2 + 60);
  }
  
  renderEncounter() {
    // Simple encounter screen
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '32px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Encounter!', this.canvas.width / 2, this.canvas.height / 2);
  }
  
  updateFPS() {
    this.frameCount++;
    const now = performance.now();
    
    if (now - this.lastFpsUpdate >= 1000) {
      this.state.debug.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }
  }
  
  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
  }
}

export default CanvasRenderer;