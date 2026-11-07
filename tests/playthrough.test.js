import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, newMemory } from '../src/state.js';
import { DEVICES, RULES } from '../src/config.js';

function setup(){const events=[];const g=new Game(newMemory(),e=>events.push(e));g.start(true);return {g,events};}
function advance(g,seconds){for(let n=0;n<Math.round(seconds*100);n++)g.tick(.01);}
function at(g,id){const d=DEVICES.find(x=>x.id===id);g.s.player={x:d.x,z:d.z};assert.equal(g.nearest()?.id,id,`${id} lost to ${g.nearest()?.id}`);}
function burn(g){advance(g,Math.max(0,RULES.cycle-g.s.elapsed+.08));while(g.s.mode==='rewind')g.tick(.01);}
function landFake(g){assert.equal(g.s.mode,'fakeEscape');advance(g,13.2);assert.equal(g.s.mode,'play');assert.equal(g.s.loopHint,'逃出的是舱。环还在。');}
function chargeIsolate(g){at(g,'battery');g.interact();advance(g,4.05);assert.equal(g.s.charge,1);g.interact();assert.equal(g.s.isolated,true);}
function launch(g){at(g,'breaker');g.interact();at(g,'terminal');g.interact();advance(g,2.05);}

test('naive curve: first fake on loop 2, true exit inside 6-12',()=>{
  const {g}=setup();
  at(g,'terminal');g.interact();assert.equal(g.s.mode,'play');
  burn(g);
  assert.equal(g.memory.cycles,2);
  chargeIsolate(g);launch(g);
  const firstFake=g.memory.cycles;
  assert.equal(g.s.mode,'fakeEscape');
  landFake(g);
  at(g,'phase-band');g.interact();
  at(g,'handoff-list');g.interact();
  at(g,'serial-plate');g.interact();
  assert.deepEqual(g.memory.clues.sort(),['C','E','G']);
  burn(g);
  burn(g);
  chargeIsolate(g);at(g,'address-latch');g.interact();assert.equal(g.s.addressUnlatched,true);launch(g);assert.equal(g.s.mode,'fakeEscape');landFake(g);
  chargeIsolate(g);at(g,'heat-valve');g.interact();assert.equal(g.s.thermalDecoupled,true);launch(g);assert.equal(g.s.mode,'fakeEscape');landFake(g);
  chargeIsolate(g);at(g,'breaker');g.interact();g.s.cold=1;g.s.coldClock=4.3;at(g,'return-core');g.interact();advance(g,1.4);
  assert.equal(g.s.coreState,'seated');
  burn(g);
  chargeIsolate(g);at(g,'address-latch');g.interact();at(g,'heat-valve');g.interact();at(g,'return-core');g.interact();advance(g,1.25);assert.equal(g.s.coreState,'held');at(g,'phase-anchor');g.interact();
  advance(g,Math.max(0,34.2-g.s.elapsed));
  launch(g);assert.equal(g.s.mode,'fakeEscape');landFake(g);
  const beforeTrue=g.memory.cycles;
  chargeIsolate(g);at(g,'address-latch');g.interact();at(g,'heat-valve');g.interact();at(g,'return-core');g.interact();advance(g,1.25);at(g,'phase-anchor');g.interact();
  assert.ok(g.s.elapsed<RULES.cycle-8);
  launch(g);assert.equal(g.s.mode,'trueEscape');advance(g,12);assert.equal(g.s.mode,'won');
  assert.ok(firstFake<=3,`first fake loop ${firstFake}`);
  assert.ok(beforeTrue>=6&&beforeTrue<=12,`true exit loop ${beforeTrue}`);
  console.log(JSON.stringify({firstFakeLoop:firstFake,trueExitLoop:beforeTrue,clues:g.memory.clues,fakeEscapes:g.memory.fakeEscapes}));
});
