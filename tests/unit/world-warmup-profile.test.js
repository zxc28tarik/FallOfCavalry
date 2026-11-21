import {describe,it,expect} from 'vitest';
import {assessWorldWarmupWindows} from '../../tools/browser-world-warmup-core.mjs';
const make=(label,update=20,script=200,mode='map',world='seed1337')=>({
  label,mapIdentity:world,cdp:{scriptMs:script,taskMs:script+10},
  profile:{
    ready:true,sampledRafFrames:32,
    before:{mode,day:1,worldParties:1},after:{mode,day:1,worldParties:2},
    rafIntervals:{meanMs:update+10},
    stats:{
      'loop.updateMap':{meanMs:update},
      'loop.renderMap':{meanMs:3},
      'sim.worldAI':{meanMs:15},
    },
  },
});
describe('V1.41 observational warmup regression',()=>{
  it('requires three real map windows and does not invent missing readings',()=>{
    expect(assessWorldWarmupWindows([]).status).toBe('INCOMPLETE');
    const x=[make('early'),make('middle'),make('late')];
    x[1].cdp.scriptMs=null;
    expect(assessWorldWarmupWindows(x).status).toBe('INCOMPLETE');
  });
  it('refuses different map identity or battle changes',()=>{
    expect(assessWorldWarmupWindows([
      make('early'),make('middle'),make('late',20,200,'map','seed42'),
    ]).status).toBe('WORLD_MISMATCH');
    expect(assessWorldWarmupWindows([
      make('early'),make('middle',20,200,'battle'),make('late'),
    ]).status).toBe('WORLD_MISMATCH');
  });
  it('keeps AI nested in update, reports ordered timings and ratios',()=>{
    const results=assessWorldWarmupWindows([
      make('early',120,3200),make('middle',40,1300),make('late',8,330),
    ]);
    expect(results.status).toBe('MEASURED');
    expect(results.updateMeanMs).toEqual([120,40,8]);
    expect(results.worldAiMeanMs).toEqual([15,15,15]);
    expect(results.earlyToLateUpdateRatio).toBe(15);
    expect(results.earlyToLateScriptRatio).toBe(9.697);
    expect(results.earlyToLateRafRatio).toBe(7.222);
  });
  it('does not divide by zero or imply a speedup from it',()=>{
    const results=assessWorldWarmupWindows([
      make('early',0,0),make('middle',0,0),make('late',0,0),
    ]);
    expect(results.status).toBe('MEASURED');
    expect(results.earlyToLateUpdateRatio).toBeNull();
    expect(results.earlyToLateScriptRatio).toBeNull();
    expect(results.earlyToLateRafRatio).toBe(1);
  });
});
