import {describe,it,expect} from 'vitest';
import {resolveFactionStartLocation} from '../../js/systems/faction-start-location.js';
const locate=(opts={})=>resolveFactionStartLocation({
  factionId:'ottoman',tileSize:32,
  settlements:[
    {id:'v',x:200,y:200,ownerFactionId:'venice'},
    {id:'o',x:3200,y:4600,ownerFactionId:'ottoman'},
  ],
  ...opts,
});
describe('V1.44 real faction new-game start location',()=>{
  it('retains authoritative political-owner-map start tile when available',()=>{
    expect(locate({startTile:{tx:200,ty:100}})).toEqual({
      x:6416,y:3216,source:'asset-owner-tile',settlementId:null,
    });
  });
  it('falls back to a real settlement of the selected faction only',()=>{
    expect(locate()).toEqual({
      x:3200,y:4600,source:'owned-settlement',settlementId:'o',
    });
  });
  it('recognizes historical owner field variants and preserves city coordinates',()=>{
    expect(locate({settlements:[{id:'legacy',x:67.5,y:153.5,owner:'ottoman'}]}))
      .toMatchObject({x:67.5,y:153.5,settlementId:'legacy'});
    expect(locate({settlements:[{id:'modern',x:67,y:153,factionId:'ottoman'}]}))
      .toMatchObject({x:67,y:153,settlementId:'modern'});
  });
  it('never silently assigns a foreign city to unsupported faction',()=>{
    expect(locate({factionId:'polish'})).toBeNull();
    expect(locate({factionId:''})).toBeNull();
  });
  it('ignores nonfinite city coordinates and does not select synthetic zero',()=>{
    expect(locate({settlements:[
      {id:'bad',x:NaN,y:100,ownerFactionId:'ottoman'},
      {id:'valid',x:5000,y:700,ownerFactionId:'ottoman'},
    ]})).toMatchObject({settlementId:'valid',x:5000,y:700});
  });
  it('can locate five original selectable factions using genuine own settlements',()=>{
    const ids=['ottoman','hre','polish','spanish','venice'];
    const cities=ids.map((id,n)=>({
      id:'city-'+id,ownerFactionId:id,x:1000+n*500,y:2000+n*150,
    }));
    for(const id of ids){
      const out=locate({factionId:id,settlements:cities});
      expect(out.source).toBe('owned-settlement');
      expect(out.settlementId).toBe('city-'+id);
    }
  });
  it('rejects invalid scale and tile instead of silently falling to origin',()=>{
    expect(locate({tileSize:0})).toBeNull();
    expect(locate({startTile:{tx:-1,ty:-1}}).source)
      .toBe('owned-settlement');
  });
});
