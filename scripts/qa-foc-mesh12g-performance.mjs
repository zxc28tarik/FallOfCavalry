#!/usr/bin/env node
// CPU-only reproducible 300-soldier instance-buffer benchmark.
// Compare original 12F with 12G under the same Node VM and identical input.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { performance } from 'node:perf_hooks';
const file='FOC-Visual-Sandbox/FallOfCavalry_PLAYABLE_RTS.html';
const baseline=execFileSync('git',['show','121bef5cb3a13bf794f67f79173856cbca6c9f21:'+file],{encoding:'utf8',maxBuffer:8*1024*1024});
const candidate=readFileSync(file,'utf8');
function load(html){
  const start=html.indexOf('<script>')+8,end=html.indexOf('</script>',start);
  const src=html.slice(start,end);
  const audit={};
  const patched=src.replace(/\}\)\(\);\s*$/, 'audit.registry=new SoldierVisualRegistry();audit.profiles=FIXED_ARCHETYPE_PROFILE;audit.mat=FOC_THREE.Mat4;})();');
  if(patched===src)throw Error('IIFE marker missing');
  runInNewContext(patched,{window:{addEventListener(){},location:{hash:'',search:''}},document:{},audit,performance},{timeout:30000});
  return audit;
}
const a=load(baseline),b=load(candidate);
const profiles=Object.entries(a.profiles);
const snapshot={sectorId:'PERF',soldiers:Array.from({length:300},(_,i)=>{
  const [templateKey,p]=profiles[i%profiles.length];
  return {viewId:'PERF:'+i,soldierId:'p'+i,side:i<150?'player':'enemy',templateKey,bodyType:p.mounted?'mounted':'human',mountType:p.mounted?'horse':'foot',activeWeapon:p.weapon,position:{x:(i%20)*2.5,y:0,z:Math.floor(i/20)*2.5},facingYaw:i<150?0:Math.PI,state:'idle'};
})};
for(const x of [a,b]){x.registry.sync(snapshot);if(x.registry.records.size!==300)throw Error('300 soldier fixture incomplete');}
const ar=a.registry,br=b.registry;
function pose(x,frame,active){
  let i=0;
  for(const r of x.registry.records.values()){
    if(i<active){r.walkBlend=.8;r.trotBlend=.5;r.walkPhase=frame*.13+i*.01;r.actionMode=frame%3===0?'guard':'attack';r.actionBlend=.6;r.actionPhase=(frame*.027+i*.01)%1;
      x.mat.fromYawTranslation(r.worldMat,r.yaw,r.x+frame*.015,r.y,r.z);
    }else{r.walkBlend=0;r.actionBlend=0;r.trotBlend=0;r.actionMode='attack';x.mat.fromYawTranslation(r.worldMat,r.yaw,r.x,r.y,r.z);}
    i++;
  }
}
function clean(reg){for(const b of reg.batchGroup.batches){b._needsUpload=false;b._dirtyStart=undefined;b._dirtyEnd=undefined;}}
function measure(fn){const t=performance.now();fn();return performance.now()-t;}
const summary={soldiers:300,archetypes:profiles.length,batches:ar.batchGroup.batches.length,instances:ar.batchGroup.totalInstances,triangles:ar.batchGroup.batches.reduce((n,b)=>n+b.count*b.geometry.indices.length/3,0),baselineSource:'121bef5cb3a13bf794f67f79173856cbca6c9f21',cases:[],maxBufferDelta:0};
const fullBytes=ar.batchGroup.batches.reduce((n,b)=>n+b.instanceData.byteLength,0);
function compare(){
  const aa=ar.batchGroup.batches,bb=br.batchGroup.batches;
  if(aa.length!==bb.length)throw Error('batch count differs');
  for(let i=0;i<aa.length;i++){
    const x=aa[i].instanceData,y=bb[i].instanceData;
    if(x.length!==y.length)throw Error('instance layout differs');
    for(let j=0;j<x.length;j++){const d=Math.abs(x[j]-y[j]);if(!Number.isFinite(d)||d>1e-5)throw Error('instance mismatch '+i+'/'+j+' delta='+d);summary.maxBufferDelta=Math.max(summary.maxBufferDelta,d);}
  }
}
function stats(v){const s=v.slice().sort((a,b)=>a-b);return {medianMs:s[Math.floor(s.length*.5)],p95Ms:s[Math.min(s.length-1,Math.floor(s.length*.95))]};}
for(const [label,active] of [['idle',0],['one-moving',1],['mixed-30',30],['all-300',300]]){
  const old=[],now=[],dirty=[],written=[],rigs=[];
  for(let frame=1;frame<=32;frame++){
    pose(a,frame,active);pose(b,frame,active);clean(ar);clean(br);
    let t1,t2;if(frame%2){t1=measure(()=>ar._updateBatchBuffersInPlace());t2=measure(()=>br._updateBatchBuffersInPlace());}
    else{t2=measure(()=>br._updateBatchBuffersInPlace());t1=measure(()=>ar._updateBatchBuffersInPlace());}
    compare();
    if(frame>8){old.push(t1);now.push(t2);const p=br._focPerf;dirty.push(p.dirtyBytes);written.push(p.partsWritten);rigs.push(p.rigEvaluations);}
  }
  summary.cases.push({label,active,baseline:stats(old),candidate:stats(now),baselineUploadBytes:fullBytes,candidateUploadBytes:Math.max(...dirty),candidatePartsWritten:Math.max(...written),candidateRigEvaluations:Math.max(...rigs)});
}
if(summary.cases[0].candidateUploadBytes!==0||summary.cases[1].candidateUploadBytes>=fullBytes)throw Error('dirty upload regression');
// Structural rebuild: change template, delete one, append one, then compare exact layout again.
const changed=structuredClone(snapshot);changed.soldiers.shift();changed.soldiers[0].templateKey=profiles[2][0];changed.soldiers.push({...snapshot.soldiers[0],viewId:'PERF:new',soldierId:'new'});
for(const x of [a,b])x.registry.sync(changed);
pose(a,41,30);pose(b,41,30);ar._updateBatchBuffersInPlace();br._updateBatchBuffersInPlace();compare();
summary.rebuildPass=true;
mkdirSync('output/foc-mesh12g-perf',{recursive:true});
writeFileSync('output/foc-mesh12g-perf/report.json',JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
