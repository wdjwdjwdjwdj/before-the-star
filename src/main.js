import './style.css';
import { Game, newMemory } from './state.js';
import { World } from './render.js';
import { AudioSystem } from './audio.js';
import { UI } from './ui.js';
import { load, save } from './storage.js';
const input={keys:new Set(),touch:new Set(),resetHeld:0};
const persisted=load();const memory=persisted||newMemory({shake:!matchMedia('(prefers-reduced-motion: reduce)').matches});
const audio=new AudioSystem();let ui;
const game=new Game(memory,e=>{
  audio.event(e.type,e.detail);
  if(e.type==='save'){if(!save(game.memory)&&ui)ui.message('浏览器存储不可用。当前进度只保留到本次关闭。',6);}
  ui?.event(e);
});
let world;
try{world=new World(document.getElementById('world'));ui=new UI(game,audio,input);}catch(err){document.getElementById('app').innerHTML='<div id="fatal">无法初始化三维图形。请检查浏览器是否启用 WebGL，然后重新加载。<br>'+String(err)+'</div>';throw err;}
function editable(e){return /INPUT|TEXTAREA|SELECT/.test(e.target?.tagName);}
window.addEventListener('keydown',e=>{
  advanceClock(performance.now());
  if(editable(e))return;
  const k=e.key.toLowerCase();
  if(['tab',' ','arrowup','arrowdown','arrowleft','arrowright','escape'].includes(k))e.preventDefault();
  if(e.repeat)return;
  if(game.s.mode==='trueend'){if(['e',' ','escape'].includes(k))ui.action('title');return;}
  if(k==='escape'){
    if(ui.screen==='pause')ui.close();
    else if(['records','log'].includes(ui.screen))ui.close();
    else if(['help','settings'].includes(ui.screen))ui.action('back');
    else if(!ui.screen)ui.action('pause');return;
  }
  if(k==='tab'){
    if(ui.screen==='records')ui.close();
    else if(!ui.screen&&game.s.mode==='play')ui.open('records');return;
  }
  if(ui.screen){if(k==='e'&&ui.screen==='log')ui.close();return;}
  if(k==='e'){game.interact();return;}
  if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','r'].includes(k))input.keys.add(k);
});
window.addEventListener('keyup',e=>{advanceClock(performance.now());input.keys.delete(e.key.toLowerCase());});
document.addEventListener('pointerdown',()=>advanceClock(performance.now()),true);
function autoPause(){advanceClock(performance.now());ui.clearInput();if(!ui.screen&&['play','launch'].includes(game.s.mode))ui.open('pause');save(game.memory);audio.update(game.s.power,false,game.memory.settings.volume);}
window.addEventListener('blur',autoPause);
document.addEventListener('visibilitychange',()=>{if(document.hidden)autoPause();});
window.addEventListener('pagehide',()=>save(game.memory));
document.addEventListener('game-context-lost',()=>{autoPause();const f=document.getElementById('fatal');f.hidden=false;f.innerHTML='三维图形上下文已中断。认知记录已保存。<br>请重新加载后选择「继续值守」。';});
function simulate(dt){
  if(document.hidden)return;
  const k=input.keys,t=input.touch;
  if(ui.active&&['play','launch'].includes(game.s.mode)&&k.has('r')){input.resetHeld+=dt;if(input.resetHeld>=.8){input.resetHeld=0;game.requestReset();}}
  else input.resetHeld=0;
  const x=Number(k.has('d')||k.has('arrowright')||t.has('right'))-Number(k.has('a')||k.has('arrowleft')||t.has('left'));
  const z=Number(k.has('s')||k.has('arrowdown')||t.has('down'))-Number(k.has('w')||k.has('arrowup')||t.has('up'));
  game.tick(dt,{x,z});
}
let last=performance.now(),totalVisual=0,lastSave=0;
function advanceClock(now){
  // Flush elapsed time before input changes too: short keys remain accurate on slow GPUs.
  let dt=Math.max(0,(now-last)/1000);last=now;if(document.hidden)dt=0;
  totalVisual+=dt;
  for(let left=dt;left>0;){const step=Math.min(left,1/60);simulate(step);left-=step;}
  return dt;
}
function frame(now){
  const dt=advanceClock(performance.now());
  const target=game.nearest();world.update(game.s,target,game.memory,totalVisual,Math.min(dt,.1));ui.update(target,input.resetHeld);
  audio.update(game.s.power,!document.hidden&&['play','launch','rewind','trueend'].includes(game.s.mode),game.memory.settings.volume);
  if(totalVisual-lastSave>3){save(game.memory);lastSave=totalVisual;}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// Dev-only deterministic clock plus read-only diagnostics for the built-in player.
if(import.meta.env.DEV)globalThis.__OHMYGAME_PLAYTEST__={
  snapshot:()=>({ ...game.s, player:{...game.s.player}, axis:[...game.s.axis], podPower:game.podPower, nearest:game.nearest()?.id||null, action:game.nearest()?game.label(game.nearest().id):null, preview:game.nearest()?game.preview(game.nearest().id):'', screen:ui.screen, discoveries:[...game.memory.discoveries], logs:[...game.memory.logs], solved:[...game.memory.solvedQuestions], question:game.memory.activeQuestionId, scarHeat:game.memory.scarHeat, scarFrost:game.memory.scarFrost, cycles:game.memory.cycles, total:game.memory.total, settings:game.memory.settings, render:{calls:world.renderer.info.render.calls,triangles:world.renderer.info.render.triangles} }),
  reset:()=>{ui.screen=null;ui.el.overlay.innerHTML='';ui.clearInput();game.start(true);},
  step:ms=>{for(let left=Math.min(Math.max(0,ms),120000)/1000;left>0;){const d=Math.min(left,1/60);simulate(d);left-=d;}ui.update(game.nearest(),input.resetHeld);},
};
