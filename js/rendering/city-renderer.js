/**
 * FallOfCavalry - City Renderer
 * Norland-style şehir içi görünümü
 */

import { shade, roundRect } from '../utils.js';

export class CityRenderer {
  render(ctx, state) {
    const city = state.currentCity;
    if (!city) return;
    
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    
    // Background
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, w, h);
    
    // City walls (simple)
    this.drawWalls(ctx, w, h);
    
    // Buildings
    this.drawBuildings(ctx, city, w, h);
    
    // City name
    ctx.fillStyle = '#fff';
    ctx.font = '32px "Cinzel", serif';
    ctx.textAlign = 'center';
    ctx.fillText(city.name, w / 2, 60);
    
    // Info panel
    this.drawInfoPanel(ctx, city, w, h);
  }
  
  drawWalls(ctx, w, h) {
    ctx.strokeStyle = '#5a524a';
    ctx.lineWidth = 8;
    
    // Outer wall
    ctx.strokeRect(100, 100, w - 200, h - 200);
    
    // Gate
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(w / 2 - 40, h - 100, 80, 60);
  }
  
  drawBuildings(ctx, city, w, h) {
    const buildings = [
      { x: 200, y: 200, w: 100, h: 120, type: 'barracks' },
      { x: 350, y: 200, w: 120, h: 100, type: 'market' },
      { x: 520, y: 200, w: 80, h: 140, type: 'temple' },
      { x: 200, y: 380, w: 90, h: 100, type: 'house' },
      { x: 340, y: 380, w: 90, h: 100, type: 'house' },
    ];
    
    for (const building of buildings) {
      this.drawBuilding(ctx, building);
    }
  }
  
  drawBuilding(ctx, building) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(building.x + 4, building.y + 4, building.w, building.h);
    
    // Main building
    ctx.fillStyle = '#6a5a4a';
    ctx.fillRect(building.x, building.y, building.w, building.h);
    
    // Roof
    ctx.fillStyle = '#8b4513';
    ctx.beginPath();
    ctx.moveTo(building.x - 10, building.y);
    ctx.lineTo(building.x + building.w / 2, building.y - 30);
    ctx.lineTo(building.x + building.w + 10, building.y);
    ctx.closePath();
    ctx.fill();
    
    // Door
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(building.x + building.w / 2 - 15, building.y + building.h - 40, 30, 40);
    
    // Windows
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(building.x + 20, building.y + 30, 20, 20);
    ctx.fillRect(building.x + building.w - 40, building.y + 30, 20, 20);
  }
  
  drawInfoPanel(ctx, city, w, h) {
    const panelX = w - 300;
    const panelY = 100;
    const panelW = 280;
    const panelH = 300;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.beginPath();
    ctx.rect(panelX, panelY, panelW, panelH);
    ctx.fill();
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    let y = panelY + 40;
    const lineH = 28;
    ctx.fillText(`Population: ${city.population ?? '-'}`, panelX + 20, y); y += lineH;
    ctx.fillText(`Garrison: ${city.garrison ?? '-'}`, panelX + 20, y); y += lineH;
    ctx.fillText(`Owner: ${city.owner ?? city.faction ?? '-'}`, panelX + 20, y); y += lineH;
    ctx.fillText(`Loyalty: ${city.loyalty ?? 100}%`, panelX + 20, y); y += lineH;
    ctx.fillText(`Type: ${city.type ?? 'settlement'}`, panelX + 20, y); y += lineH * 1.5;
    const buildings = Array.isArray(city.buildings) ? city.buildings : [];
    if (buildings.length > 0) {
      ctx.font = 'bold 14px Arial';
      ctx.fillText('Buildings:', panelX + 20, y); y += lineH;
      ctx.font = '12px Arial';
      buildings.slice(0, 4).forEach((b) => {
        ctx.fillText(`- ${b.type ?? b} (lvl ${b.level ?? 1})`, panelX + 30, y); y += lineH;
      });
    }
  }
}

export default CityRenderer;