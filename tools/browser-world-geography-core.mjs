/**
 * V1.44 observational geometry of actual full-world parties.
 * The utility does not choose spawn points, modify AI policy, or synthesize
 * settlements. Values are world pixels; distances are normalized to tiles.
 */
const validPoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const rounded=n=>Number.isFinite(n)?Math.round(n*1000)/1000:null;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function inspectPartyGeography({
  player,settlements=[],parties=[],tileSize,despawnTiles=40,
}={}){
  if(!validPoint(player)||!Number.isFinite(tileSize)||tileSize<=0
    ||!Number.isFinite(despawnTiles)||despawnTiles<=0)
    return {status:'UNAVAILABLE',reason:'Missing real player or world-distance scale'};
  const radius=despawnTiles*tileSize;
  const cities=(Array.isArray(settlements)?settlements:[])
    .filter(validPoint);
  const rows=(Array.isArray(parties)?parties:[])
    .filter(validPoint);
  const cityDistances=cities.map(s=>({
    id:s.id??null,ownerFactionId:s.ownerFactionId??s.factionId??null,
    tiles:distance(player,s)/tileSize,
  })).sort((a,b)=>a.tiles-b.tiles);
  const byKind={};
  const entries=[];
  for(const p of rows) {
    const dist=distance(player,p)/tileSize;
    const kind=String(p.kind??'unknown');
    const item={kind,factionId:p.factionId??null,
      homeCityId:p.homeCityId??null,routeId:p.routeId??null,
      distanceTiles:rounded(dist),
      withinDespawn:dist<=despawnTiles,
      withinHalfDespawn:dist<=despawnTiles/2,
      hasHomeCity:cities.some(s=>String(s.id)===String(p.homeCityId)),
    };
    entries.push(item);
    if(!byKind[kind])byKind[kind]={
      count:0,withinDespawn:0,outsideDespawn:0,nearestTiles:null,
    };
    const k=byKind[kind];
    k.count++;
    if(item.withinDespawn)k.withinDespawn++;
    else k.outsideDespawn++;
    k.nearestTiles=k.nearestTiles==null
      ?item.distanceTiles:Math.min(k.nearestTiles,item.distanceTiles);
  }
  const within=entries.filter(x=>x.withinDespawn).length;
  return {
    status:'MEASURED',
    tileSize,despawnTiles,despawnWorldPixels:radius,
    settlementCount:cities.length,partyCount:rows.length,
    settlementsWithinDespawn:cityDistances.filter(c=>c.tiles<=despawnTiles).length,
    settlementsWithinHalfDespawn:cityDistances.filter(c=>c.tiles<=despawnTiles/2).length,
    nearestSettlementTiles:rounded(cityDistances[0]?.tiles),
    nearestSettlements:cityDistances.slice(0,8)
      .map(c=>({...c,tiles:rounded(c.tiles)})),
    partiesWithinDespawn:within,
    partiesOutsideDespawn:entries.length-within,
    nearestPartyTiles:entries.length
      ?Math.min(...entries.map(e=>e.distanceTiles)):null,
    byKind,entries,
    limitation:'A distance audit, not proof of why each individual party died; AI may also remove parties during patrol encounters, route quests, and combat.',
  };
}
