import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../../css/ui-theme-v166.css',import.meta.url),'utf8');
const legacy=readFileSync(new URL('../../css/styles.css',import.meta.url),'utf8');
const ui=readFileSync(new URL('../../js/managers/UIManager.js',import.meta.url),'utf8');

describe('V1.66 campaign HUD visual system and interaction contract',()=>{
  it('loads a single last-in-cascade stylesheet with no dependency on invented images',()=>{
    expect(html).toContain('href="css/ui-theme-v166.css"');
    expect(html.indexOf('href="css/ui-theme-v166.css"'))
      .toBeGreaterThan(html.indexOf('href="css/styles.css"'));
    expect(css).not.toMatch(/url\(\s*['"]?https?:/);
    expect(css).toContain('@media(max-width:520px)');
    expect(css).toContain('prefers-reduced-motion:reduce');
  });
  it('retains every HUD field ID and public live game control',()=>{
    for(const id of ['hudFaction','hudGold','hudArmy','hudRenown','hudDay',
      'hudStats','hudEvent','helpBtn','settingsBtn','questText','toggleMorale',
      'toggleHints','paletteSelect','btnSaveGame','btnLoadGame',
      'btnResetGame','btnOpenSaveTransfer','hudControlLines']){
      expect(html).toContain(`id="${id}"`);
    }
    expect(css).toMatch(/\.hud-left\s*\{[^}]*display:block !important/s);
    expect(css).toMatch(/\.quest-panel\s*\{[^}]*display:block !important/s);
  });
  it('tools drawer is controlled from a working button and Escape handler',()=>{
    expect(html).toContain('id="hudOptionsToggle"');
    expect(html).toContain('aria-controls="hudSettings"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('id="hudOptionsClose"');
    expect(css).toContain('.hud-settings.is-open{display:block !important}');
    expect(ui).toContain("hudToggle?.addEventListener('click'");
    expect(ui).toContain("if(event.key==='Escape')");
    expect(ui).toContain("hudToggle?.setAttribute('aria-expanded',String(next))");
  });
  it('preserves the existing scene and battle HUD containers with no duplicate IDs',()=>{
    for(const id of ['mainMenuOverlay','citySceneModal','cityScenePanelBody',
      'battleHud','battleCommandBar','worldMapOverlay','rosterPanel']){
      expect((html.match(new RegExp(`id="${id}"`,'g'))||[])).toHaveLength(1);
    }
    expect(legacy).toContain('.city-scene-panel');
    expect(css).toContain('.city-scene-panel');
    expect(css).toContain('.battle-hud');
    expect(css).toContain('.menu-overlay');
  });
});
