import { describe, expect, it } from 'vitest';
import { summarizeWorldLoopMeasurements } from '../../tools/browser-world-loop-profile.mjs';

describe('WEB V1.38 — transparent frame profile summary',()=>{
  it('reports stable per-call mean, median, p95 and total duration',()=>{
    const a=summarizeWorldLoopMeasurements({
      'render.terrain':[10,20,40,30,5],
      'sim.worldAI':[1,2,3],
    });
    expect(a['render.terrain']).toEqual({
      calls:5,meanMs:21,p50Ms:20,p95Ms:30,maxMs:40,totalMs:105,
    });
    expect(a['sim.worldAI']).toEqual({
      calls:3,meanMs:2,p50Ms:2,p95Ms:2,maxMs:3,totalMs:6,
    });
  });

  it('ignores invalid timings and does not mutate the measured arrays',()=>{
    const source=[0.4,0.2,-1,Number.POSITIVE_INFINITY,NaN,1];
    const before=[...source];
    const result=summarizeWorldLoopMeasurements({renderer:source});
    expect(result.renderer).toMatchObject({
      calls:3,meanMs:0.533,p50Ms:0.4,p95Ms:0.4,maxMs:1,
      totalMs:1.6,
    });
    expect(source).toEqual(before);
  });

  it('caps window size without turning a long time-series into game state',()=>{
    const many=Array.from({length:1000},(_,i)=>i);
    const summary=summarizeWorldLoopMeasurements({update:many},10);
    expect(summary.update).toMatchObject({
      calls:10,meanMs:994.5,maxMs:999,totalMs:9945,
    });
    expect(many).toHaveLength(1000);
    const bounded=summarizeWorldLoopMeasurements({update:many},9999);
    expect(bounded.update.calls).toBe(400);
  });

  it('handles empty or missing performance series without inventing FPS',()=>{
    expect(summarizeWorldLoopMeasurements(null)).toEqual({});
    expect(summarizeWorldLoopMeasurements({bad:null})).toEqual({});
    expect(summarizeWorldLoopMeasurements({empty:[]})).toEqual({
      empty:{calls:0,meanMs:null,p50Ms:null,p95Ms:null,maxMs:null,totalMs:0},
    });
  });
});
