import {describe,it,expect} from 'vitest';
import {summarizeChromiumMetrics,summarizeChromiumTrace} from '../../tools/browser-world-frame-trace.mjs';

describe('WEB V1.39 — observation-only Chromium trace summaries',()=>{
  it('converts CDP cumulative seconds to milliseconds without double-counting',()=>{
    const summary=summarizeChromiumMetrics(
      {TaskDuration:1.3,ScriptDuration:0.6,LayoutDuration:0.3,RecalcStyleDuration:0.1,JSHeapUsedSize:500},
      {TaskDuration:1.55,ScriptDuration:0.7,LayoutDuration:0.32,RecalcStyleDuration:0.13,JSHeapUsedSize:490});
    expect(summary).toMatchObject({
      TaskDuration:0.25,taskMs:250,scriptMs:100,layoutMs:20,styleMs:30,JSHeapUsedSize:-10,
    });
  });
  it('returns null for missing counters rather than fabricated zeros',()=>{
    const summary=summarizeChromiumMetrics({TaskDuration:0},{ScriptDuration:3});
    expect(summary.TaskDuration).toBe(null);
    expect(summary.taskMs).toBe(null);
  });
  it('classifies supported duration events and ignores malformed/untimed events',()=>{
    const records=[
      {name:'FireAnimationFrame',ph:'X',dur:3000},
      {name:'RasterTask',ph:'X',dur:5000},
      {name:'Paint',ph:'X',dur:1000},
      {name:'CompositeLayers',ph:'X',dur:2500},
      {name:'Canvas2DLayerBridge',ph:'X',dur:1000},
      {name:'NotComplete',ph:'B',dur:999000},
      {name:'Bad',ph:'X',dur:-1},{name:'Invalid',ph:'X',dur:NaN},
    ];
    const snapshot=JSON.stringify(records);
    const summary=summarizeChromiumTrace(records);
    expect(summary.eventCount).toBe(8);
    expect(summary.timedEventCount).toBe(5);
    expect(summary.classes.raster).toMatchObject({samples:1,totalMs:5});
    expect(summary.classes.animationFrame.totalMs).toBe(3);
    expect(summary.classes.canvas2d.totalMs).toBe(1);
    expect(summary.classes.compositor.totalMs).toBe(2.5);
    expect(summary.classes.paint.totalMs).toBe(1);
    expect(JSON.stringify(records)).toBe(snapshot);
  });
  it('does not present unavailable compositor/GPU evidence as 0 ms',()=>{
    expect(summarizeChromiumTrace(null)).toEqual({
      eventCount:0,timedEventCount:0,classes:{},topEvents:[],
    });
    const value=summarizeChromiumTrace([{ph:'M',name:'process_name'}]);
    expect(value.classes.gpu).toBeUndefined();
    expect(value.classes.compositor).toBeUndefined();
  });
});
