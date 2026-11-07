import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, newMemory } from '../src/state.js';
import { load, save } from '../src/storage.js';
let value=null;
globalThis.localStorage={getItem:()=>value,setItem:(_k,v)=>{value=v;}};
test('persist knowledge, logs, statistics and settings; continue always clean physical state',()=>{
 const g=new Game();g.start();g.discover('isolate');g.memory.logs.push('log-grid');g.memory.total=61;g.memory.wins=1;g.memory.settings.volume=.12;g.memory.solvedQuestions=['q_gate'];g.memory.activeQuestionId='q_cold';g.memory.residualHeat=2;g.memory.scarHeat=true;g.memory.lastTrace='储冷告警';g.s.charge=1;g.s.isolated=true;g.s.main=false;
 assert.ok(save(g.memory));assert.ok(!value.includes('player'));assert.ok(!value.includes('"charge"'));const next=new Game(load());assert.equal(next.memory.residualHeat,2);assert.deepEqual(next.memory.solvedQuestions,['q_gate']);assert.equal(next.memory.activeQuestionId,'q_cold');assert.equal(next.memory.scarHeat,true);assert.equal(next.memory.lastTrace,'储冷告警');next.start();assert.equal(next.s.mode,'brief');next.chooseReady(false);assert.equal(next.memory.cycles,2);assert.equal(next.memory.total,61);assert.deepEqual(next.memory.discoveries,['isolate']);assert.deepEqual(next.memory.logs,['log-grid']);assert.equal(next.s.charge,0);assert.equal(next.s.isolated,false);assert.equal(next.s.power,true);assert.equal(next.memory.settings.volume,.12);
});
test('new challenge clears knowledge and statistics, not settings',()=>{
 const g=new Game();g.start();g.discover('charge');g.memory.logs.push('log-grid');g.memory.total=28;g.memory.settings.flash=true;g.start(true);assert.deepEqual(g.memory.discoveries,[]);assert.deepEqual(g.memory.logs,[]);assert.equal(g.memory.total,0);assert.equal(g.memory.cycles,1);assert.equal(g.memory.settings.flash,true);
});
test('invalid or blocked local storage does not crash game',()=>{
 value='{bad';assert.equal(load(),null);value=JSON.stringify({...newMemory(),discoveries:['gate','UNKNOWN','gate'],settings:{volume:'broken'}});const m=load();assert.deepEqual(m.discoveries,['gate']);assert.equal(m.settings.volume,.45);
 const old=globalThis.localStorage;globalThis.localStorage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};assert.equal(load(),null);assert.equal(save(newMemory()),false);globalThis.localStorage=old;
});
