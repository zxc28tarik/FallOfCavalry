import {describe,it,expect} from 'vitest';
import {BACKEND_MODES,browserGpuIdentity,worldSceneMatches,compareBackendProfiles}
  from '../../tools/browser-world-backend-compare-core.mjs';

const scene={
  started:true,seed:1337,faction:'ottoman',mode:'map',
  width:123,height:90,terrainLength:11070,settlements:881,
  roads:304,rivers:3,crossings:4,canvasWidth:1366,canvasHeight:768,
  firstSettlement:'first',lastSettlement:'last',
};
const measured=(id,renderer,meanMs=145)=>({
  id,status:'MEASURED',scene:{...scene},
  gpu:{known:Boolean(renderer),fingerprint:renderer},
  profile:{
    rafIntervals:{samples:31,meanMs},
    trace:{available:true,topEvents:[{
      name:'SkiaOutputSurfaceImplOnGpu::SwapBuffers',
      calls:32,inclusiveTotalMs:3900,
    }]},
  },
});
describe('V1.40 graphics-mode comparison never fabricates a backend',()=>{
  it('defines independent launch configurations without disabling game drawing',()=>{
    expect(BACKEND_MODES).toHaveLength(3);
    expect(BACKEND_MODES[0].args).toContain('--use-angle=swiftshader');
    expect(BACKEND_MODES[1].args).toEqual([]);
    expect(BACKEND_MODES.some(x=>x.args.includes('--disable-gpu'))).toBe(false);
  });
  it('identifies an observed renderer and refuses empty or partial GPU ID',()=>{
    expect(browserGpuIdentity({gpu:{auxAttributes:{glRenderer:'SwiftShader Device',glVendor:'Google'}}}))
      .toMatchObject({known:true,softwareLikely:true,glRenderer:'SwiftShader Device'});
    expect(browserGpuIdentity({gpu:{devices:[{vendorId:1,deviceId:2,deviceString:'GPU'}]}}))
      .toMatchObject({known:true,deviceIds:'1:2'});
    expect(browserGpuIdentity({gpu:{devices:[{vendorId:1}]}}).known).toBe(false);
  });
  it('requires same real world signature and game mode',()=>{
    expect(worldSceneMatches(scene,{...scene})).toBe(true);
    expect(worldSceneMatches(scene,{...scene,settlements:880})).toBe(false);
    expect(worldSceneMatches(scene,{...scene,mode:'battle'})).toBe(false);
    expect(worldSceneMatches(scene,{...scene,seed:42})).toBe(false);
  });
  it('treats identical GPU fingerprints as no verified different backend',()=>{
    const result=compareBackendProfiles([
      measured('forced-angle-swiftshader','SW'),
      measured('chrome-default','SW',90),
      {id:'requested-angle-gl',status:'UNSUPPORTED',error:'No GL renderer'},
    ]);
    expect(result.status).toBe('NO_VERIFIED_DISTINCT_BACKEND');
    expect(result.candidates[0].status).toBe('SAME_BACKEND');
    expect(result.candidates[0].frameIntervalRatio).toBeUndefined();
    expect(result.candidates[1].status).toBe('UNSUPPORTED');
  });
  it('flags actual, comparable and distinct GPU IDs without FPS claims',()=>{
    const result=compareBackendProfiles([
      measured('forced-angle-swiftshader','SW',150),
      measured('chrome-default','HW',120),
      measured('requested-angle-gl','SW',90),
    ]);
    expect(result.status).toBe('DISTINCT_OBSERVED_BACKENDS');
    expect(result.candidates[0]).toMatchObject({
      status:'DISTINCT_OBSERVED_BACKENDS',
      frameIntervalRatio:0.8,deltaFrameIntervalMs:-30,
    });
    expect(result.candidates[1].status).toBe('SAME_BACKEND');
  });
  it('rejects unknown ID, mismatched scene and invalid metrics',()=>{
    const a=measured('forced-angle-swiftshader','SW');
    const b=measured('chrome-default',null);
    const c=measured('requested-angle-gl','GL');
    c.scene.roads=303;
    const result=compareBackendProfiles([a,b,c]);
    expect(result.candidates.map(x=>x.status)).toEqual(['UNKNOWN_BACKEND','SCENE_MISMATCH']);
    expect(compareBackendProfiles([]).status).toBe('NO_BASELINE');
  });
});
