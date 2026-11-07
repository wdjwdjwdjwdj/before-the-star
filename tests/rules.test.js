import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, newMemory } from '../src/state.js';
import { RULES, FE, SPAWN, DEVICES } from '../src/config.js';
import { carryResidual } from '../src/thermal.js';
import { move, free, visible, clearGate } from '../src/movement.js';
function setup(){const events=[];const g=new Game(newMemory(),e=>events.push(e));g.start(true);return {g,events};}
function advance(g,seconds){for(let n=0;n<Math.round(seconds*100);n++)g.tick(.01);}
function at(g,id){const known={breaker:{x:-7.4,z:-3.5},battery:{x:.1,z:-2.9},thermal:{x:2.25,z:-2.5},gate:{x:2.8,z:0},terminal:{x:7.3,z:2.5}};const d=known[id]||DEVICES.find(x=>x.id===id);g.s.player={x:d.x,z:d.z};assert.equal(g.nearest()?.id,id,`${id} lost to ${g.nearest()?.id}`);}
function charge(g){at(g,'battery');g.interact();advance(g,4.05);assert.equal(g.s.charge,1);}

test('rules keep the V2 clock and the scheme-C thermal numbers',()=>{
  assert.equal(RULES.cycle,42);assert.equal(RULES.charge,4);assert.equal(RULES.launch,2);
  assert.equal(FE.chargeCold,1);assert.equal(FE.coldSeconds,5);assert.equal(FE.recoveryPerSecond,0.15);
  assert.equal(FE.baseHeat,2);assert.equal(FE.safeHeat,4);assert.equal(FE.max,5);
  assert.equal(carryResidual(5),4);assert.equal(carryResidual(4),3);assert.equal(carryResidual(2),2);
});
test('idle: the 42s shock starts rewind immediately, then lands on spawn with no modal',()=>{
  const {g}=setup();g.discover('gate');advance(g,42.02);assert.equal(g.s.mode,'rewind');assert.equal(g.s.loopHint,'');
  advance(g,.8);
  assert.notEqual(g.s.mode,'rewind');assert.notEqual(g.s.mode,'won');assert.notEqual(g.s.mode,'trueend');
  assert.equal(g.memory.cycles,2);assert.deepEqual(g.s.player,SPAWN);assert.equal(g.s.main,true);assert.equal(g.s.charge,0);assert.equal(g.s.isolated,false);assert.ok(g.memory.discoveries.includes('gate'));assert.ok(g.memory.discoveries.includes('loop'));assert.equal(g.s.loopHint,'');
});
test('main off releases gate but pod refuses powerless launch',()=>{const {g}=setup();at(g,'breaker');g.interact();assert.equal(g.s.power,false);at(g,'terminal');g.interact();assert.equal(g.s.mode,'play');assert.equal(g.podPower,false);assert.ok(g.memory.discoveries.includes('pod'));});
test('full but NOT isolated battery drains to common grid; no backup launch',()=>{const {g}=setup();charge(g);at(g,'breaker');g.interact();assert.equal(g.podPower,false);assert.ok(g.memory.discoveries.includes('drain'));at(g,'terminal');g.interact();assert.equal(g.s.mode,'play');advance(g,1.6);assert.equal(g.s.charge,0);});
test('classic launch without the four keys is a 13s fake escape then the cabin line',()=>{
  const events=[];const g=new Game(newMemory(),e=>events.push(e));g.start(true);
  charge(g);g.interact();assert.equal(g.s.isolated,true);assert.equal(g.s.cold,1);at(g,'breaker');g.interact();assert.equal(g.podPower,true);at(g,'terminal');g.interact();assert.equal(g.s.mode,'launch');
  advance(g,2.05);assert.equal(g.s.mode,'fakeEscape');assert.equal(g.memory.wins,0);
  const clock=g.s.elapsed;advance(g,5);assert.equal(g.s.elapsed,clock);assert.equal(g.s.departPhase,'shock');assert.ok(events.some(e=>e.detail==='恒星扫过。请保持姿势。'));
  advance(g,8.2);assert.equal(g.s.mode,'play');assert.deepEqual(g.s.player,SPAWN);assert.equal(g.s.loopHint,'逃出的是舱。环还在。');assert.equal(g.s.charge,0);assert.ok(g.s.checklistFlash>0);
});
test('all exit keys outside the last eight seconds end on the quiet true line',()=>{
  const events=[];const g=new Game(newMemory(),e=>events.push(e));g.start(true);
  charge(g);g.interact();at(g,'address-latch');g.interact();at(g,'heat-valve');g.interact();
  at(g,'return-core');g.interact();advance(g,1.25);assert.equal(g.s.coreState,'held');
  at(g,'phase-anchor');g.interact();assert.equal(g.s.coreState,'anchored');
  at(g,'breaker');g.interact();assert.ok(g.s.elapsed<RULES.cycle-8);
  at(g,'terminal');g.interact();advance(g,2.05);assert.equal(g.s.mode,'trueEscape');
  advance(g,11);assert.equal(g.s.mode,'won');assert.equal(g.memory.wins,1);assert.ok(events.some(e=>e.detail==='采样表外。环在身后。'));assert.equal(g.memory.cycles,1);
});
test('manual reset resets every physical field and preserves observations/logs/settings',()=>{const {g}=setup();charge(g);g.interact();g.memory.logs.push('log-grid');g.memory.settings.volume=.2;g.requestReset();advance(g,1.3);assert.equal(g.s.charge,0);assert.equal(g.s.isolated,false);assert.equal(g.s.main,true);assert.deepEqual(g.memory.logs,['log-grid']);assert.ok(g.memory.discoveries.includes('isolate'));assert.equal(g.memory.settings.volume,.2);});
test('pause and records do not consume time or charge',()=>{const {g}=setup();at(g,'battery');g.interact();g.pause();const t=g.s.elapsed;advance(g,15);assert.equal(g.s.elapsed,t);assert.equal(g.s.charge,0);g.s.mode='records';advance(g,10);assert.equal(g.s.elapsed,t);g.resume();advance(g,1);assert.ok(g.s.elapsed>t);});
test('scheduled outage respects manual OFF; charging stops and can resume',()=>{const {g}=setup();at(g,'breaker');g.interact();advance(g,20);assert.equal(g.s.power,false);g.interact();assert.equal(g.s.power,true);});
test('scheduled outage does not destroy isolated backup',()=>{const {g}=setup();charge(g);g.interact();advance(g,13.05);assert.equal(g.s.power,false);assert.equal(g.s.charge,1);assert.equal(g.podPower,true);advance(g,2);assert.equal(g.s.power,true);});
test('door closing never overlaps astronaut collision',()=>{const {g}=setup();g.s.power=false;g.s.player={x:4.1,z:0};assert.ok(free(g.s.player,g.s));g.s.power=true;clearGate(g.s);assert.ok(free(g.s.player,g.s));assert.ok(g.s.player.x>4);});
test('no wall crossing, wall sliding, no closed gate bypass',()=>{const {g}=setup();g.s.player={x:2.5,z:0};move(g.s,1,0,3);assert.ok(g.s.player.x<3.55);g.s.player={x:2,z:-2.2};move(g.s,1,1,.7);assert.ok(free(g.s.player,g.s));g.s.player={x:0,z:0};move(g.s,0,1,10);assert.ok(g.s.player.z<6.6);});
test('interaction cannot pass through room partition or a closed gate',()=>{const {g}=setup();g.s.player={x:3.1,z:1.65};assert.equal(visible(g.s.player,{x:7.3,z:1.65},g.s),false);const main=g.s.main;g.interact('breaker');assert.equal(g.s.main,main);});
test('known solution traverses real geometry in one cycle with ample margin',()=>{
  const {g}=setup();
  function walk(x,z){for(let i=0;i<1000&&Math.hypot(x-g.s.player.x,z-g.s.player.z)>.07;i++){const dx=x-g.s.player.x,dz=z-g.s.player.z;g.tick(Math.min(1/60,Math.hypot(dx,dz)/RULES.speed),{x:dx,z:dz});}assert.ok(Math.hypot(x-g.s.player.x,z-g.s.player.z)<.08,`blocked en route ${x},${z} at ${JSON.stringify(g.s.player)}`);}
  walk(-4,3);walk(0,3);walk(.1,-2.9);g.interact();advance(g,4.05);g.interact();
  const coldAfterIsolate=g.s.cold;
  walk(0,-3);walk(-5,-3);walk(-7.4,-3.5);g.interact();
  const cutAt=g.s.elapsed;
  // Straight through the open gate and press E as soon as the terminal is in reach.
  // Detouring past the pod eats the five-second cold margin.
  walk(-4,-3);walk(4,0);walk(5.6,1.3);g.interact();assert.equal(g.s.mode,'launch',`launch refused at t=${g.s.elapsed} cold=${g.s.cold}`);advance(g,2.05);
  assert.equal(g.s.mode,'fakeEscape',`solution failed at t=${g.s.elapsed} cold=${g.s.cold} afterCut=${g.s.elapsed-cutAt} coldAfterIsolate=${coldAfterIsolate}`);
  advance(g,13.1);assert.deepEqual(g.s.player,SPAWN);assert.equal(g.s.loopHint,'逃出的是舱。环还在。');assert.ok(g.memory.cycles>=2);
});
test('thermal can be switched once per loop and the second press does nothing',()=>{
  const {g}=setup();assert.equal(g.s.cooling,'energy');assert.equal(g.s.thermalSwitchesLeft,1);
  at(g,'thermal');g.interact();assert.equal(g.s.cooling,'cryo');assert.equal(g.s.thermalSwitchesLeft,0);
  g.interact();assert.equal(g.s.cooling,'cryo');assert.equal(g.s.thermalSwitchesLeft,0);
});
test('energy isolate spends one cold immediately; cryo isolate waits 0.5s and keeps cold',()=>{
  const energy=setup().g;charge(energy);const before=energy.s.cold;energy.interact();assert.equal(energy.s.isolated,true);assert.equal(energy.s.cold,before-1);assert.equal(energy.s.isolating,false);
  const cryo=setup().g;at(cryo,'thermal');cryo.interact();charge(cryo);const cold=cryo.s.cold;cryo.interact();assert.equal(cryo.s.isolated,false);assert.equal(cryo.s.isolating,true);assert.equal(cryo.s.cold,cold);
  at(cryo,'breaker');cryo.interact();assert.equal(cryo.s.main,true);
  advance(cryo,.49);assert.equal(cryo.s.isolated,false);advance(cryo,.03);assert.equal(cryo.s.isolated,true);assert.equal(cryo.s.cold,cold);
});
test('power loss spends one cold every five seconds; heat recovers at 0.15 while energy cooling is idle',()=>{
  const {g}=setup();at(g,'breaker');g.interact();const cold=g.s.cold;advance(g,5.05);assert.equal(g.s.cold,cold-1);
  g.interact();g.s.heat=3;const t=g.s.elapsed;advance(g,1);assert.ok(Math.abs(g.s.heat-(3-FE.recoveryPerSecond))<.03,g.s.heat);assert.ok(g.s.elapsed>t);
});
test('cryo charge adds one cold and can finish on the safe-heat line; a hot start trips early',()=>{
  const {g}=setup();at(g,'thermal');g.interact();charge(g);assert.equal(g.s.charge,1);assert.equal(g.s.cold,FE.baseCold+FE.chargeCold);assert.equal(g.s.overheated,false);assert.ok(g.s.heat<=FE.safeHeat+1e-6);
  const hot=setup().g;hot.s.cooling='cryo';hot.s.heat=3;at(hot,'battery');hot.interact();advance(hot,4.2);assert.equal(hot.s.overheated,true);assert.ok(hot.s.charge<1);assert.equal(hot.s.charging,false);
});
test('launch is refused below one cold, and cold dropping mid-launch is not a win',()=>{
  const {g}=setup();charge(g);g.interact();at(g,'breaker');g.interact();g.s.cold=0;at(g,'terminal');g.interact();assert.equal(g.s.mode,'play');assert.equal(g.s.launchDeniedCold,true);
  g.s.cold=1;g.s.coldClock=4.9;g.interact();assert.equal(g.s.mode,'launch');advance(g,.25);assert.equal(g.s.mode,'play');assert.ok(g.s.cold<1);assert.notEqual(g.s.mode,'ending');
});
test('there is no manual residual unload; carried heat sheds by one',()=>{
  const {g}=setup();assert.equal(g.unload,undefined);g.s.heat=4;g.requestReset();assert.equal(g.s.mode,'rewind');
  while(g.s.mode==='rewind')g.tick(.01);
  assert.equal(g.s.heat,carryResidual(4));assert.equal(g.memory.scarHeat,true);assert.equal(g.s.loopHint,'');assert.equal(g.unload,undefined);
});
test('fold-back after progress goes straight into the next loop with an empty battery',()=>{
  const {g}=setup();assert.equal(g.s.mode,'play');
  g.memory.wins=1;g.memory.solvedQuestions=['q_gate','q_cold'];g.requestReset();
  while(g.s.mode==='rewind')g.tick(.01);
  assert.equal(g.s.mode,'play');assert.equal(g.s.charge,0);assert.equal(g.s.isolated,false);assert.equal(g.s.main,true);assert.equal(g.s.cooling,'energy');
  assert.deepEqual(g.s.player,SPAWN);
});
test('one hypothesis is open per loop, solving it waits until the next loop to hang the next',()=>{
  const {g}=setup();assert.equal(g.memory.activeQuestionId,'q_gate');
  at(g,'gate');g.interact();assert.deepEqual(g.memory.solvedQuestions,['q_gate']);assert.equal(g.memory.activeQuestionId,null);
  g.requestReset();advance(g,1.3);assert.equal(g.memory.activeQuestionId,'q_cold');
  at(g,'breaker');g.interact();advance(g,5.05);assert.ok(g.memory.solvedQuestions.includes('q_cold'));assert.equal(g.memory.activeQuestionId,null);
});
test('a cold launch refusal leaves a frost scar that the next loop can thaw',()=>{
  const {g}=setup();g.s.launchDeniedCold=true;g.requestReset();advance(g,1.3);assert.equal(g.memory.scarFrost,true);assert.equal(g.s.cold,FE.baseCold);
  advance(g,3.05);assert.equal(g.memory.scarFrost,false);
});
test('cost preview is a pure readout and does not spend time',()=>{
  const {g}=setup();charge(g);at(g,'battery');const t=g.s.elapsed;assert.match(g.preview('battery'),/储冷 −1/);assert.equal(g.s.elapsed,t);assert.equal(g.s.cold,FE.baseCold);
  at(g,'thermal');assert.match(g.preview('thermal'),/休眠/);g.interact();assert.match(g.preview('battery'),/0\.5/);
});
