/**
 * V1.25 — conservative waypoint follower for a genuinely spawned escort.
 * The player's movement is still performed ONLY by WorldSimManager.
 *
 * Unlike a direct-line chase this planner advances along the exact,
 * source-verified caravan road polyline, without cutting through blocked
 * terrain. It never teleports or changes movement speed.
 */
import { isLiveEscortParty } from './quest-caravan-escort.js';

const finite = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const clamp = (n,lo,hi) => Math.max(lo,Math.min(hi,n));

function routeGeometry(path) {
  if (!Array.isArray(path) || path.length < 2 || path.length > 8192
    || path.some(p => !finite(p))) return null;
  const lengths=[0];
  for (let i=1;i<path.length;i++) {
    const length=dist(path[i-1],path[i]);
    if (!Number.isFinite(length) || length > 100000) return null;
    lengths.push(lengths[i-1]+length);
  }
  if (lengths.at(-1) < 0.01) return null;
  return {path,lengths,total:lengths.at(-1)};
}

function closestProgress(pos, geo) {
  let best={distance:Infinity,progress:0,point:geo.path[0]};
  for (let i=1;i<geo.path.length;i++) {
    const a=geo.path[i-1],b=geo.path[i];
    const dx=b.x-a.x,dy=b.y-a.y,sq=dx*dx+dy*dy;
    if(sq < 0.0001) continue;
    const t=clamp(((pos.x-a.x)*dx+(pos.y-a.y)*dy)/sq,0,1);
    const point={x:a.x+t*dx,y:a.y+t*dy};
    const distance=dist(pos,point);
    if (distance<best.distance) {
      best={distance,progress:geo.lengths[i-1]+t*Math.sqrt(sq),point};
    }
  }
  return best;
}

function pointAt(geo,progress) {
  const u=clamp(progress,0,geo.total);
  for (let i=1;i<geo.path.length;i++) {
    if (geo.lengths[i]+0.001 < u) continue;
    const a=geo.path[i-1], b=geo.path[i];
    const length=geo.lengths[i]-geo.lengths[i-1];
    const t=length>0.0001 ? clamp((u-geo.lengths[i-1])/length,0,1) : 0;
    return {x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)};
  }
  return {...geo.path.at(-1)};
}

/** Check entire segment at <=half-tile intervals, not only its endpoint. */
function traversable(a,b,tileSize,terrainAt) {
  if(typeof terrainAt !== 'function') return true; // WorldSim still verifies actual movement.
  const length=dist(a,b);
  const steps=Math.max(1,Math.ceil(length/Math.max(4,tileSize*0.45)));
  if(steps>1024) return false;
  for(let i=1;i<=steps;i++) {
    const x=a.x+(b.x-a.x)*i/steps, y=a.y+(b.y-a.y)*i/steps;
    const terrain=terrainAt(x,y);
    if(!terrain || terrain.blocked === true) return false;
  }
  return true;
}

export function chooseEscortRoadFollowTarget({
  playerParty,caravan,worldState,terrainAt,
}={}) {
  if(!isLiveEscortParty(caravan) || caravan.alive === false
    || !finite(playerParty) || !finite(caravan)) return {status:'invalid'};
  const geo=routeGeometry(caravan.path);
  if(!geo) return {status:'no_road'};
  const tile=Math.max(1,Number(worldState?.tileSize||32));
  const distance=dist(playerParty,caravan);
  if(distance<=Math.max(18,tile*1.35)) return {status:'near'};
  const player=closestProgress(playerParty,geo);
  const convoy=closestProgress(caravan,geo);
  // When approaching from outside the road corridor, first rejoin the
  // nearest physical road point. Never go straight through a corner.
  const roadEntryDist=Math.max(tile*0.8,15);
  if(player.distance>roadEntryDist) {
    if(traversable(playerParty,player.point,tile,terrainAt)
      && dist(playerParty,player.point)>=2) {
      return {status:'moving',target:player.point,stage:'joining_road'};
    }
    return {status:'blocked'};
  }
  const direction=convoy.progress>=player.progress ? 1:-1;
  const gap=Math.abs(convoy.progress-player.progress);
  const step=Math.min(gap,tile*1.25);
  const ahead=pointAt(geo,player.progress+direction*step);
  if(dist(playerParty,ahead)<2) {
    if(traversable(playerParty,caravan,tile,terrainAt)) {
      return {status:'moving',target:{x:caravan.x,y:caravan.y},stage:'approach'};
    }
    return {status:'blocked'};
  }
  if(traversable(playerParty,ahead,tile,terrainAt)) {
    return {status:'moving',target:ahead,stage:'road'};
  }
  // Shortening the lookahead means avoiding sharp corners/terrain instead
  // of issuing the unsafe straightline destination from V1.24.
  for(const f of [0.5,0.25,0.125]) {
    const next=pointAt(geo,player.progress+direction*step*f);
    if(dist(playerParty,next)>=2 && traversable(playerParty,next,tile,terrainAt)) {
      return {status:'moving',target:next,stage:'road_short'};
    }
  }
  return {status:'blocked'};
}
