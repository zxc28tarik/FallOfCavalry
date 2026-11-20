/**
 * WEB V1.39 — real Chromium frame scheduling, Canvas2D call and compositor
 * diagnostics. Observation only: never skip world updates or drawing.
 * Tracing is best-effort because headless CI GPUs expose different events.
 */
const METRICS = ['TaskDuration','ScriptDuration','LayoutDuration',
  'RecalcStyleDuration','JSHeapUsedSize','Frames','LayoutCount','RecalcStyleCount'];
const TRACE_CATEGORIES = [
  'devtools.timeline','disabled-by-default-devtools.timeline.frame',
  'cc','gpu','viz','renderer.scheduler','blink.user_timing',
].join(',');
const round = x => Number.isFinite(x) ? Math.round(x*1000)/1000 : null;
const percentile = (list,p) => list.length
  ? list[Math.floor((list.length-1)*p)] : null;
const profileSummary = values => {
  const sorted=values.filter(v=>Number.isFinite(v)&&v>=0).sort((a,b)=>a-b);
  return {
    samples:sorted.length,
    meanMs:round(sorted.length ? sorted.reduce((s,x)=>s+x,0)/sorted.length : null),
    p95Ms:round(percentile(sorted,0.95)),
    maxMs:round(sorted.length ? sorted.at(-1) : null),
    totalMs:round(sorted.reduce((s,x)=>s+x,0)),
  };
};
export function summarizeChromiumMetrics(before={},after={}) {
  const out={};
  for(const key of METRICS) {
    const start=before[key],end=after[key];
    out[key] = Number.isFinite(start)&&Number.isFinite(end)
      ? round(end-start) : null;
  }
  // CDP task/layout/script counters are cumulative seconds; these
  // milliseconds are NOT additive (script is a subset of task duration).
  return {
    ...out, taskMs:round(out.TaskDuration==null?null:out.TaskDuration*1000),
    scriptMs:round(out.ScriptDuration==null?null:out.ScriptDuration*1000),
    layoutMs:round(out.LayoutDuration==null?null:out.LayoutDuration*1000),
    styleMs:round(out.RecalcStyleDuration==null?null:out.RecalcStyleDuration*1000),
  };
}
const TRACE_CLASSES = [
  ['animationFrame',/FireAnimationFrame|RequestAnimationFrame|BeginFrame|BeginMainFrame|FrameRequestCallback/i],
  ['canvas2d',/Canvas2D|CanvasRenderingContext|SkCanvas|FlushCanvas|DrawImage/i],
  ['raster',/RasterTask|Rasterizer|RasterBuffer|RasterWorker/i],
  ['compositor',/CompositeLayers|SubmitCompositorFrame|ActivateLayerTree|Commit|DrawFrame|DrawAndSwap|LayerTreeHost/i],
  ['paint',/Paint|PrePaint|UpdateLayerTree/i],
  ['layout',/Layout|RecalculateStyles|UpdateLayoutTree/i],
  ['script',/FunctionCall|EvaluateScript|RunMicrotasks|V8\.Execute|EventDispatch/i],
  ['schedulerTask',/RunTask|ThreadControllerImpl/i],
  ['gpu',/GpuTask|GLES2Decoder|CommandBuffer/i],
];
export function summarizeChromiumTrace(events) {
  if(!Array.isArray(events))return {eventCount:0,timedEventCount:0,classes:{},topEvents:[]};
  const groups=new Map();
  const names=new Map();
  let timedEventCount=0;
  for(const row of events) {
    if(!row || row.ph!=='X'||!Number.isFinite(row.dur)||row.dur<0)
      continue;
    timedEventCount++;
    const name=typeof row.name==='string'?row.name:'';
    const classification=TRACE_CLASSES.find(([,re])=>re.test(name))?.[0]||null;
    const ms=row.dur/1000;
    if(classification) {
      if(!groups.has(classification))groups.set(classification,[]);
      groups.get(classification).push(ms);
    }
    if(name) {
      const data=names.get(name)||{calls:0,ms:0};
      data.calls++;data.ms+=ms;names.set(name,data);
    }
  }
  return {
    eventCount:events.length,timedEventCount,
    classes:Object.fromEntries([...groups].map(([key,v])=>[key,profileSummary(v)])),
    topEvents:[...names].sort((a,b)=>b[1].ms-a[1].ms)
      .slice(0,14).map(([name,v])=>({name,calls:v.calls,inclusiveTotalMs:round(v.ms)})),
    caveat:'Trace durations overlap across threads and nested events: do not sum classes as frame time. Missing classes are unavailable, not zero.',
  };
}
async function collectRealCanvasAndRaf(page,count) {
  return page.evaluate(async frames=>{
    const game=window.game;
    if(!game?.started||game.state?.mode!=='map'||!game.gameLoop?.running)
      return {ready:false,reason:'Map game loop not active'};
    const methods=['drawImage','fillRect','clearRect','putImageData',
      'fill','stroke','fillText','strokeText'];
    const restored=[];
    const counters={};
    const bind=(prototype,scope,method)=>{
      if(!prototype)return;
      const original=Object.getOwnPropertyDescriptor(prototype,method);
      if(typeof original?.value!=='function'||original.writable===false)return;
      const key=scope+'.'+method;
      counters[key]={calls:0,totalMs:0};
      const wrapper=function(...args) {
        const start=performance.now();
        try{return original.value.apply(this,args);}
        finally {
          counters[key].calls++;
          counters[key].totalMs+=performance.now()-start;
        }
      };
      try {
        Object.defineProperty(prototype,method,{...original,value:wrapper});
        restored.push(()=>Object.defineProperty(prototype,method,original));
      } catch {delete counters[key];}
    };
    const intervals=[],callbackLatencies=[],longTasks=[];
    const supportedLongTask=typeof PerformanceObserver!=='undefined'
      && PerformanceObserver.supportedEntryTypes?.includes('longtask');
    let observer=null,completed=0,previous=null;
    try {
      for(const [scope,proto] of [
        ['canvas',window.CanvasRenderingContext2D?.prototype],
        ['offscreen',window.OffscreenCanvasRenderingContext2D?.prototype],
      ])for(const method of methods)bind(proto,scope,method);
      if(supportedLongTask) {
        observer=new PerformanceObserver(list=>{
          for(const entry of list.getEntries())
            if(Number.isFinite(entry.duration))longTasks.push(entry.duration);
        });
        observer.observe({entryTypes:['longtask']});
      }
      await new Promise(resolve=>{
        const frame=timestamp=>{
          if(Number.isFinite(previous)&&timestamp>previous)
            intervals.push(timestamp-previous);
          if(Number.isFinite(timestamp))
            callbackLatencies.push(Math.max(0,performance.now()-timestamp));
          previous=timestamp;
          completed++;
          if(completed>=frames)resolve();
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      return {
        ready:true,frames:completed,intervals:intervals.length,
        // These arrays have at most 32 entries and are summarized in Node.
        intervalValues:intervals,callbackLatencyValues:callbackLatencies,
        longTaskValues:longTasks,longTaskObserverSupported:supportedLongTask,
        canvas:Object.fromEntries(Object.entries(counters).map(([key,v])=>[
          key,{calls:v.calls,inclusiveTotalMs:Math.round(v.totalMs*1000)/1000}
        ])),
        mode:game.state.mode,
      };
    } finally {
      observer?.disconnect();
      for(const undo of restored.reverse())undo();
    }
  },count);
}
const readMetrics=async session=>{
  const response=await session.send('Performance.getMetrics');
  return Object.fromEntries(response.metrics
    .filter(row=>METRICS.includes(row.name)&&Number.isFinite(row.value))
    .map(row=>[row.name,row.value]));
};
async function finishTrace(session,limitBytes) {
  const completed=new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('Tracing completion timed out')),20000);
    session.once('Tracing.tracingComplete',data=>{
      clearTimeout(timeout);resolve(data.stream);
    });
  });
  await session.send('Tracing.end');
  const stream=await completed;
  if(!stream)return {available:false,reason:'No tracing stream'};
  let chars=0,truncated=false;
  const chunks=[];
  try {
    for(;;) {
      const part=await session.send('IO.read',{handle:stream,size:1048576});
      const str=part.base64Encoded
        ? Buffer.from(part.data||'','base64').toString('utf8') : (part.data||'');
      chars+=Buffer.byteLength(str);
      if(chars>limitBytes){truncated=true;break;}
      chunks.push(str);
      if(part.eof)break;
    }
  } finally {
    await session.send('IO.close',{handle:stream}).catch(()=>{});
  }
  if(truncated)return {available:false,reason:'Trace exceeds capped memory budget',bytesAtCap:chars};
  try {
    const parsed=JSON.parse(chunks.join(''));
    const result=summarizeChromiumTrace(parsed.traceEvents);
    return {available:true,...result,bytes:chars};
  } catch (error) {
    return {available:false,reason:'Invalid trace JSON: '+String(error).slice(0,180),bytes:chars};
  }
}
export async function profileChromiumWorldFrames(page,{samples=32,maxTraceBytes=32*1024*1024}={}) {
  const count=Number.isSafeInteger(samples)?Math.max(16,Math.min(64,samples)):32;
  const session=await page.context().newCDPSession(page);
  let traceStarted=false,traceFinished=false;
  let trace={available:false,reason:'Tracing not started'};
  try {
    await session.send('Performance.enable');
    const metricsBefore=await readMetrics(session);
    try {
      await session.send('Tracing.start',{
        categories:TRACE_CATEGORIES,options:'record-as-much-as-possible',
        transferMode:'ReturnAsStream',
      });
      traceStarted=true;
    } catch(error){trace={available:false,reason:'Tracing unsupported: '+String(error).slice(0,150)};}
    const tStart=Date.now();
    const canvasRaf=await collectRealCanvasAndRaf(page,count);
    const wallMs=Date.now()-tStart;
    const metricsAfter=await readMetrics(session);
    if(traceStarted) {
      traceFinished=true;
      try {trace=await finishTrace(session,maxTraceBytes);}
      catch(error){trace={available:false,reason:'Tracing unavailable: '+String(error).slice(0,150)};}
    }
    const clean={...canvasRaf};
    delete clean.raf;
    delete clean.intervalValues;
    delete clean.callbackLatencyValues;
    delete clean.longTaskValues;
    return {
      ready:canvasRaf.ready===true,headless:true,
      frameCount:canvasRaf.frames||0,wallMs,
      rafIntervals:profileSummary(canvasRaf.intervalValues||[]),
      rafCallbackLatency:profileSummary(canvasRaf.callbackLatencyValues||[]),
      longTasks:profileSummary(canvasRaf.longTaskValues||[]),
      longTaskObserverSupported:canvasRaf.longTaskObserverSupported===true,
      canvas2d:clean.canvas||{},
      cdpMetrics:{before:metricsBefore,after:metricsAfter,
        deltas:summarizeChromiumMetrics(metricsBefore,metricsAfter)},
      trace,
      notes:[
        'Same real map, AI and renderer; no forced quality reduction or game-time freeze.',
        'Canvas2D wrappers add overhead: never interpret instrumented timings as baseline FPS.',
        'CDP cumulative metrics overlap; trace events can run concurrently on different threads.',
        'SwiftShader headless timings cannot establish a Windows GPU player FPS.',
      ],
    };
  } finally {
    if(traceStarted&&!traceFinished)
      await session.send('Tracing.end').catch(()=>{});
    await session.detach().catch(()=>{});
  }
}
