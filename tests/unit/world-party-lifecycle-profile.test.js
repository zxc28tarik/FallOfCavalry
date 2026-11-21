import {describe,it,expect} from 'vitest';
import {summarizePartyLifecycle} from '../../tools/browser-world-party-lifecycle-core.mjs';
const base=()=>({
  frameCount:32,modeBefore:'map',modeAfter:'map',
  ensures:Array.from({length:64},()=>({
    before:{total:0},afterBase:{total:20},afterEnsure:{total:20},
    createdIds:20,baseCreatedIds:20,baseRemovedIds:0,
  })),
  updates:Array.from({length:32},()=>({removedIds:20})),
  timings:{ensure:[60,70],basePhase:[50,58],routeThreat:[2,3]},
  endpoint:{partyCount:0},
});
describe('V1.42 real world-party lifecycle summaries',()=>{
  it('requires map mode and full sample of each real callback',()=>{
    const raw=base();
    raw.modeAfter='encounter';
    expect(summarizePartyLifecycle(raw).status).toBe('INCOMPLETE');
    raw.modeAfter='map';
    raw.updates.pop();
    expect(summarizePartyLifecycle(raw).status).toBe('INCOMPLETE');
  });
  it('requires captured base-vs-quest phase boundary',()=>{
    const raw=base();
    raw.ensures[0].afterBase=null;
    expect(summarizePartyLifecycle(raw).status).toBe('INCOMPLETE');
  });
  it('does not double-count inclusive groups or invent impact',()=>{
    const result=summarizePartyLifecycle(base());
    expect(result.status).toBe('MEASURED');
    expect(result.ensureCalls).toBe(64);
    expect(result.updateCalls).toBe(32);
    expect(result.extraEnsureCalls).toBe(32);
    expect(result.basePhaseCreatedIds).toBe(1280);
    expect(result.updateRemovedIds).toBe(640);
    expect(result.timing.ensure).toMatchObject({calls:2,totalMs:130,meanMs:65});
    expect(result.timing.basePhase.totalMs).toBe(108);
  });
  it('retains missing timing as null and safe phase counts',()=>{
    const raw=base();
    raw.timings.routeThreat=[];
    expect(summarizePartyLifecycle(raw).timing.routeThreat.meanMs).toBeNull();
  });
});
