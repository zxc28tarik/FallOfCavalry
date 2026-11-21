/**
 * FOC WEB V1.44 — select a REAL starting location for the chosen faction.
 * Asset-owner start tiles remain authoritative. If an asset does not provide
 * owner statistics (procedural map), use an actual source settlement owned
 * by the selected faction instead of leaving the player at world (0, 0).
 * No faction is fabricated and another faction's city is never substituted.
 */
const isPosition=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const ownerOf=s=>s?.ownerFactionId||s?.owner||s?.factionId||null;
export function resolveFactionStartLocation({
  startTile=null,settlements=[],factionId=null,tileSize=32,
}={}){
  if(typeof factionId!=='string'||!factionId.trim()
    ||!Number.isFinite(tileSize)||tileSize<=0)return null;
  if(Number.isFinite(startTile?.tx)&&Number.isFinite(startTile?.ty)
    &&startTile.tx>=0&&startTile.ty>=0){
    return {
      x:(startTile.tx+0.5)*tileSize,
      y:(startTile.ty+0.5)*tileSize,
      source:'asset-owner-tile',settlementId:null,
    };
  }
  const city=(Array.isArray(settlements)?settlements:[])
    .find(s=>isPosition(s)
      &&ownerOf(s)===factionId&&s.x>=0&&s.y>=0);
  if(!city)return null;
  return {
    x:city.x,y:city.y,
    source:'owned-settlement',settlementId:city.id??null,
  };
}
