import {describe,it,expect} from 'vitest';
import {
  applyCivicDecision,getCivicDecisionAvailability,CIVIC_DECISIONS,
} from '../../js/systems/city-civic-decisions.js';

describe('V1.50 persistent civic policy choices',()=>{
  const make=()=>({city:{id:0,name:'Payitaht',security:42},
    party:{gold:500,renown:10}});
  it('offers three materially different civic policies',()=>{
    expect(Object.keys(CIVIC_DECISIONS)).toEqual(['patrol','granary','levy']);
    expect(new Set(Object.values(CIVIC_DECISIONS).map(x=>x.security)).size).toBe(3);
  });
  it('paid patrol improves security and cannot be repeated the same day',()=>{
    const {city,party}=make();
    const result=applyCivicDecision({city,party,day:14,decisionId:'patrol'});
    expect(result.ok).toBe(true);
    expect(city).toMatchObject({security:50,civicDecision:{day:14,id:'patrol'}});
    expect(party).toMatchObject({gold:380,renown:11});
    expect(applyCivicDecision({city,party,day:14,decisionId:'levy'}).ok).toBe(false);
    expect(party.gold).toBe(380);
    expect(getCivicDecisionAvailability(city,party,15).available).toBe(true);
    expect(applyCivicDecision({city,party,day:15,decisionId:'granary'}).ok).toBe(true);
    expect(city.security).toBe(54);
  });
  it('levy gives money once while harming security and reputation',()=>{
    const {city,party}=make();
    const result=applyCivicDecision({city,party,day:2,decisionId:'levy'});
    expect(result.ok).toBe(true);
    expect(party).toMatchObject({gold:575,renown:8});
    expect(city.security).toBe(33);
    const clone=JSON.parse(JSON.stringify({city,party}));
    expect(applyCivicDecision({...clone,day:2,decisionId:'levy'}).ok).toBe(false);
    expect(clone.party.gold).toBe(575);
  });
  it('rejects insufficient funds and unknown decisions without mutation',()=>{
    const {city,party}=make();
    party.gold=20;
    expect(applyCivicDecision({city,party,day:6,decisionId:'patrol'}).ok).toBe(false);
    expect(applyCivicDecision({city,party,day:6,decisionId:'bogus'}).ok).toBe(false);
    expect(city).toEqual({id:0,name:'Payitaht',security:42});
    expect(party.gold).toBe(20);
  });
  it('clamps security and reputation at valid bounds',()=>{
    const {city,party}=make();
    city.security=98;
    party.renown=0;
    expect(applyCivicDecision({city,party,day:1,decisionId:'patrol'}).ok).toBe(true);
    expect(city.security).toBe(100);
    expect(applyCivicDecision({city,party,day:2,decisionId:'levy'}).ok).toBe(true);
    expect(party.renown).toBe(0);
  });
});
