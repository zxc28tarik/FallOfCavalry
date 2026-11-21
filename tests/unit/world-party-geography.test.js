import {describe,it,expect} from 'vitest';
import {inspectPartyGeography} from '../../tools/browser-world-geography-core.mjs';
const get=(overrides={})=>inspectPartyGeography({
  player:{x:10,y:10},tileSize:10,despawnTiles:4,
  settlements:[{id:'near',x:20,y:10},{id:'far',x:160,y:10}],
  parties:[{kind:'merchant',x:30,y:10,homeCityId:'near'},
    {kind:'bandit',x:80,y:10,homeCityId:'far'}],
  ...overrides,
});
describe('V1.44 real-party geography accounting',()=>{
 it('rejects bad player/scales instead of reporting fictitious locals',()=>{
  expect(get({player:null}).status).toBe('UNAVAILABLE');
  expect(get({tileSize:0}).status).toBe('UNAVAILABLE');
 });
 it('uses actual tile scale and counts exact player-area coverage',()=>{
  const x=get();
  expect(x.status).toBe('MEASURED');
  expect(x.partiesWithinDespawn).toBe(1);
  expect(x.partiesOutsideDespawn).toBe(1);
  expect(x.nearestSettlementTiles).toBe(1);
  expect(x.settlementsWithinDespawn).toBe(1);
  expect(x.byKind.merchant.withinDespawn).toBe(1);
  expect(x.byKind.bandit.outsideDespawn).toBe(1);
 });
 it('includes boundary and preserves unknown route links without fabricating',()=>{
  const x=get({parties:[{kind:'bandit',x:50,y:10,routeId:'route-1'},
    {kind:'merchant',x:200,y:10,homeCityId:'nobody'}]});
  expect(x.partiesWithinDespawn).toBe(1);
  expect(x.entries[0].routeId).toBe('route-1');
  expect(x.entries[1].hasHomeCity).toBe(false);
 });
 it('can honestly report empty nearby city and party coverage',()=>{
  const x=get({settlements:[],parties:[]});
  expect(x.partyCount).toBe(0);
  expect(x.nearestSettlementTiles).toBeNull();
  expect(x.nearestPartyTiles).toBeNull();
  expect(x.settlementsWithinDespawn).toBe(0);
 });
});
