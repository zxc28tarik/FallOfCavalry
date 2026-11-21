import {describe,it,expect} from 'vitest';
import {
  previewCouncilReactions,applyCouncilReactions,COUNCIL_REACTION_RULES,
} from '../../js/systems/city-civic-character-reactions.js';
import {applyCivicDecision} from '../../js/systems/city-civic-decisions.js';
import {normalizeWorldCharacters} from '../../js/systems/world-characters.js';

const person=(id,role,kind='named',location='0')=>({
  id,kind,name:id,role,status:'alive',
  location:{kind:'settlement',settlementId:location},
  satisfaction:50,loyalty:50,reputation:50,standing:50,
  stats:{intelligence:50,observation:50,persuasion:50,leadership:50,
    command:50,trade:50,administration:50,courage:50,experience:50},
  traits:['cautious'],history:[],
});
const build=()=>({version:1,relations:[],characters:[
  person('npc:test:1','merchant'),person('npc:test:2','artisan'),
  person('npc:test:3','commander'),person('npc:test:4','merchant','generated'),
  person('npc:test:5','merchant','named','1'),
]});
describe('V1.52 city council character consequences',()=>{
  it('previews role-specific impact without mutation, excludes other cities and nonnamed NPCs',()=>{
    const roster=build(),before=JSON.stringify(roster);
    const rows=previewCouncilReactions({roster,cityId:0,decisionId:'levy'});
    expect(rows.map(row=>[row.characterId,row.delta])).toEqual([
      ['npc:test:1',-3],['npc:test:2',-4],
    ]);
    expect(JSON.stringify(roster)).toBe(before);
    expect(COUNCIL_REACTION_RULES.granary.artisan).toBeGreaterThan(0);
  });
  it('changes the actual named character state and keeps event history in JSON save',()=>{
    const roster=build();
    const city={id:0,security:40},party={gold:500,renown:10};
    const applied=applyCivicDecision({city,party,day:8,decisionId:'granary'});
    expect(applied.ok).toBe(true);
    const outcomes=applyCouncilReactions({roster,cityId:city.id,decisionId:'granary',day:8});
    expect(outcomes).toHaveLength(2);
    expect(roster.characters[0].satisfaction).toBe(52);
    expect(roster.characters[1].satisfaction).toBe(53);
    expect(roster.characters[2].satisfaction).toBe(50);
    expect(roster.characters[3].satisfaction).toBe(50);
    expect(roster.characters[4].satisfaction).toBe(50);
    const restored=normalizeWorldCharacters(JSON.parse(JSON.stringify(roster)));
    expect(restored.characters.find(p=>p.id==='npc:test:1')?.satisfaction).toBe(52);
    expect(restored.characters.find(p=>p.id==='npc:test:1')?.history.some(
      event=>event.type==='state-changed'&&event.reason.includes('granary'))).toBe(true);
    expect(applyCivicDecision({city,party,day:8,decisionId:'levy'}).ok).toBe(false);
  });
  it('does not mutate people on invalid decision, missing roster or invalid day',()=>{
    const roster=build(),start=JSON.stringify(roster);
    expect(applyCouncilReactions({roster,cityId:0,decisionId:'other',day:1})).toEqual([]);
    expect(applyCouncilReactions({roster,cityId:0,decisionId:'levy',day:0})).toEqual([]);
    expect(applyCouncilReactions({roster:null,cityId:0,decisionId:'levy',day:1})).toEqual([]);
    expect(JSON.stringify(roster)).toBe(start);
  });
  it('caps values without inventing extra status or appointments',()=>{
    const roster=build();
    roster.characters[0].satisfaction=99;
    roster.characters[1].satisfaction=1;
    applyCouncilReactions({roster,cityId:0,decisionId:'granary',day:3});
    expect(roster.characters[0].satisfaction).toBe(100);
    applyCouncilReactions({roster,cityId:0,decisionId:'levy',day:4});
    expect(roster.characters[1].satisfaction).toBe(0);
    expect(roster.characters[0].kind).toBe('named');
    expect(roster.characters[1].location.settlementId).toBe('0');
  });
});
