import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const root=new URL('../../',import.meta.url);
const html=readFileSync(new URL('index.html',root),'utf8');
const css=readFileSync(new URL('css/ui-polish-v167.css',root),'utf8');
const old=readFileSync(new URL('css/ui-theme-v166.css',root),'utf8');

describe('V1.67 screenshot-guided campaign HUD and city readability',()=>{
  it('cascades after the intact base and V1.66 visual language',()=>{
    expect(html.indexOf('css/ui-polish-v167.css'))
      .toBeGreaterThan(html.indexOf('css/ui-theme-v166.css'));
    expect(html.indexOf('css/ui-theme-v166.css'))
      .toBeGreaterThan(html.indexOf('css/styles.css'));
    expect(old).toContain('.city-scene-panel');
  });
  it('keeps real data in an accessible collapsed detail rather than deleting stats',()=>{
    expect(html).toContain('<details id="hudDetails"');
    expect(html).toContain('<summary class="hud-details__summary">');
    for(const id of ['hudStats','hudEvent','hudFaction','hudGold','hudArmy',
      'hudRenown','hudDay','hudOptionsToggle','questText']){
      expect(html).toContain(`id="${id}"`);
    }
    expect(css).toContain('.hud-details[open]');
    expect(css).toContain('#hudFaction');
    expect(css).toContain('white-space:normal');
  });
  it('constrains long actual city area labels without losing tooltips or button actions',()=>{
    expect(css).toContain('.city-scene-hotspot__label');
    expect(css).toContain('-webkit-line-clamp:2');
    expect(css).toContain('overflow-wrap:anywhere');
    expect(css).toContain('.city-scene-hotspot:hover');
    expect(css).toContain('.city-scene-service-chips');
    const city=readFileSync(new URL('js/ui/city-services.js',root),'utf8');
    expect(city).toContain('title="${escapeHtml(parcel.label)}"');
    expect(city).toContain('data-city-parcel-id=');
  });
  it('prevents market debug controls covering city or battle while allowing map use',()=>{
    expect(css).toContain('body:has(#citySceneModal:not(.hidden)) #cargoMarketReportToggle');
    expect(css).toContain('body:has(#battleHud:not(.hidden)) #cargoMarketReportPanel');
    expect(css).toContain('@media(max-width:800px)');
    expect(css).toContain('@media(max-width:520px)');
  });
});
