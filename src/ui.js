import { KNOWLEDGE, LOGS, HINTS, RULES, FE, questionById, roomAt } from './config.js';
import { formatTime, save } from './storage.js';
const key = s => `<kbd>${s}</kbd>`;
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export class UI {
  constructor(game,audio,input) {
    this.game=game;this.audio=audio;this.input=input;this.screen='title';this.parent='title';this.playMode='play';this.messageUntil=0;this.toastUntil=0;this.currentLog=null;
    document.querySelector('#app').innerHTML=`<div id="hud" hidden>
      <div class="station-id"><span class="eyebrow">DAWN STATION / 07</span><strong id="room-name">苏醒舱</strong><small id="power-status">● 主网在线</small></div>
      <div id="cycle-clock"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="35"/><circle id="clock-arc" cx="40" cy="40" r="35"/></svg><div><span id="remaining">${RULES.cycle}</span><small>距脉冲 / 秒</small></div></div>
      <div class="hud-right"><span id="cycle-num">第 01 环</span><button data-action="records" aria-label="认知记录">${key('Tab')} 认知记录 <b id="new-count"></b></button><button class="icon-button" data-action="pause" aria-label="暂停">Ⅱ</button></div>
      <div id="vitals"><span id="vital-mode">能源优先</span><span id="vital-heat">H 2.0</span><span id="vital-cold">C 2.0</span><span id="vital-switch">温控 1</span></div>
      <div id="broadcast"><span>站内广播</span><p></p></div>
      <div id="discovery-toast"></div>
      <div id="context"><p id="cost-preview" hidden></p><span id="target-name"></span><button id="interact" data-action="interact"></button><small id="device-status"></small></div>
      <div id="launch-status" hidden><span>脱离程序 / LAUNCH</span><strong>正在启动逃生舱</strong><div class="progress"><i></i></div></div>
      <div id="reset-hold"><i></i><span>按住 R · 放弃本轮</span></div>
      <div class="bottom-hint">${key('W A S D')} 移动 <span> / </span> ${key('E')} 交互 <span> / </span> ${key('Esc')} 暂停</div>
      <div id="touch-controls"><div class="dpad"><button data-move="up" aria-label="向前">▲</button><button data-move="left" aria-label="向左">◀</button><button data-move="down" aria-label="向后">▼</button><button data-move="right" aria-label="向右">▶</button></div><button class="touch-e" data-action="interact">E</button></div>
    </div><div id="cinematic-window" hidden><div class="window-rim"></div><span>逃生舱 / 舷窗视野</span><p>恒星脉冲再次扫过曙光站。</p><button class="primary" data-action="settle" hidden>查看结算 ↗</button></div><div id="overlay"></div><div id="pulse-overlay" hidden></div><div id="fatal" hidden></div>`;
    this.el={};for(const id of ['hud','overlay','room-name','power-status','cycle-num','remaining','clock-arc','broadcast','discovery-toast','context','target-name','interact','device-status','new-count','reset-hold','launch-status','pulse-overlay','cost-preview','vital-mode','vital-heat','vital-cold','vital-switch'])this.el[id]=document.getElementById(id);
    document.querySelector('#app').addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b){e.preventDefault();e.stopPropagation();this.action(b.dataset.action);}});
    document.querySelector('#app').addEventListener('input',e=>{if(e.target.id==='volume'){game.memory.settings.volume=Number(e.target.value)/100;document.getElementById('volume-value').textContent=e.target.value+'%';save(game.memory);}});
    document.querySelector('#app').addEventListener('change',e=>{if(['shake','flash'].includes(e.target.id)){game.memory.settings[e.target.id]=e.target.checked;save(game.memory);}});
    document.querySelectorAll('[data-move]').forEach(b=>{
      const stop=e=>{e.preventDefault();input.touch.delete(b.dataset.move);b.classList.remove('held');};
      b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);input.touch.add(b.dataset.move);b.classList.add('held');});
      b.addEventListener('pointerup',stop);b.addEventListener('pointercancel',stop);b.addEventListener('lostpointercapture',stop);
    });
    this.renderScreen();
  }
  get active() { return !this.screen; }
  clearInput() { this.input.keys.clear();this.input.touch.clear();this.input.resetHeld=0;this.game.s.moving=false; }
  open(screen) {
    if(!this.screen){this.playMode=this.game.s.mode;this.game.s.mode='pause';this.parent='pause';}
    else this.parent=this.screen;
    this.screen=screen;this.clearInput();this.renderScreen();
  }
  close() {
    if(['title','won'].includes(this.screen))return;
    if(this.parent==='title'){this.screen='title';this.renderScreen();return;}
    this.screen=null;this.game.s.mode=this.playMode;this.clearInput();this.el.overlay.innerHTML='';
  }
  async start(fresh) {
    try{await this.audio.unlock();}catch{}
    this.screen=null;this.clearInput();this.el.overlay.innerHTML='';this.game.start(fresh);this.playMode='play';
    if(!fresh)this.message('继续游戏：已保留认知与统计。设备从新一轮重新开始。',5);
  }
  action(a) {
    const g=this.game;
    if(a==='new'){if(g.memory.cycles>0){this.screen='confirm';this.renderScreen();}else this.start(true);}
    if(a==='confirm-new')this.start(true);
    if(a==='cancel-new'){this.screen='title';this.renderScreen();}
    if(a==='continue')this.start(false);
    if(a==='records'){if(this.screen==='records')this.close();else if(this.screen==='pause'||(!this.screen&&g.s.mode==='play')){g.memory.boardAlert=false;this.open('records');}}
    if(a==='ready-standard')g.chooseReady(false);
    if(a==='ready-half')g.chooseReady(true);
    if(a==='pause'){if(!this.screen&&['play','launch'].includes(g.s.mode))this.open('pause');}
    if(a==='resume')this.close();
    if(a==='help')this.open('help');
    if(a==='settings')this.open('settings');
    if(a==='back'){this.screen=this.parent==='title'?'title':'pause';this.parent=this.screen;this.renderScreen();}
    if(a==='title'){save(g.memory);this.screen='title';g.s.mode='title';this.clearInput();this.renderScreen();}
    if(a==='reset'){this.screen=null;g.s.mode='play';this.el.overlay.innerHTML='';this.clearInput();g.requestReset();}
    if(a==='hint'){const n=Math.min(g.memory.hintLevel,HINTS.length-1);this.hintText=HINTS[n];g.memory.hintLevel=Math.min(HINTS.length-1,n+1);save(g.memory);this.renderScreen();}
    if(a==='interact'&&!this.screen)g.interact();
    if(a==='skip')g.skipReset();
    if(a==='replay')this.start(true);
    if(a==='settle')g.finishEnding();
    if(a?.startsWith('log:')){this.currentLog=a.slice(4);this.open('log');}
  }
  shell(content,cls='') {return `<div class="scrim ${cls}"><section class="panel" role="dialog" aria-modal="true">${content}</section></div>`;}
  renderScreen() {
    const g=this.game,m=g.memory;let html='';
    if(this.screen==='title')html=`<div class="title-screen"><div class="title-copy"><span class="eyebrow">A SCI-FI TIME LOOP / ${RULES.cycle} SECONDS</span><h1>恒星<br>升起前<span>BEFORE THE STAR</span></h1><p>同一座空间站。相同的四十二秒。<br>时间会归零。余热和你记住的事不会。</p><div class="title-actions"><button class="primary" data-action="${m.cycles?'continue':'new'}">${m.cycles?'继续值守':'开始值守'}<span>↗</span></button>${m.cycles?'<button data-action="new">新游戏 / 清空认知</button>':''}<div><button data-action="help">操作说明</button><button data-action="settings">设置</button></div></div><small>低多边形科幻解谜 · 主题「环」 · 无战斗</small></div><div class="title-stamp"><b>曙光站</b><span>ORBITAL RESEARCH / 07</span><i>世界会回来。你呢？</i></div></div>`;
    if(this.screen==='confirm')html=this.shell(`<span class="eyebrow">NEW SHIFT</span><h2>重新开始值守？</h2><p>这将清空已发现的认知、日志与挑战统计。音量和辅助设置会保留。</p><div class="actions"><button data-action="cancel-new">返回</button><button class="primary" data-action="confirm-new">确认新游戏</button></div>`);
    if(this.screen==='pause')html=this.shell(`<span class="eyebrow">TIME SUSPENDED / 时间已暂停</span><h2>这一刻，属于你。</h2><p>第 ${m.cycles} 环 · 本轮剩余 ${Math.max(0,RULES.cycle-g.s.elapsed).toFixed(1)} 秒</p><div class="menu-list"><button class="primary" data-action="resume">返回空间站 ${key('Esc')}</button><button data-action="records">认知记录与地图</button><button data-action="reset">主动重置本轮</button><button data-action="settings">设置</button><button data-action="help">操作说明</button><button data-action="title">保存认知并返回标题</button></div>`);
    if(this.screen==='help')html=this.shell(`<span class="eyebrow">FIELD MANUAL / 操作说明</span><h2>观察。尝试。记住。</h2><div class="manual"><p>${key('WASD')} / ${key('↑ ↓ ← →')} 自由移动</p><p>${key('E')} 与附近高亮设备交互。靠近断闸、隔离、启动、温控时，会先看到一句代价。</p><p>${key('Tab')} 本环假设、已解事实、0–${RULES.cycle}s 简轴</p><p>${key('Esc')} 暂停 / 返回</p><p>${key('R')} 按住 0.8 秒重置本轮</p><p>半就绪出现时：${key('1')} 标准开局，${key('2')} 电池 50% 未隔离</p></div><p>点击开始值守后，四十二秒计时启动。打开菜单、假设板和日志会暂停。每轮开关与电量归零；余热、假设和热痕会留下。</p><button class="primary" data-action="back">明白了</button>`);
    if(this.screen==='settings')html=this.shell(`<span class="eyebrow">PREFERENCES / 本地保存</span><h2>感官设置</h2><label class="setting">音量 <span id="volume-value">${Math.round(m.settings.volume*100)}%</span><input id="volume" aria-label="音量" type="range" min="0" max="100" value="${Math.round(m.settings.volume*100)}"></label><label class="toggle"><span>镜头轻微震动<small>发射和循环重置时</small></span><input id="shake" type="checkbox" ${m.settings.shake?'checked':''}></label><label class="toggle"><span>强闪光效果<small>默认关闭；关闭时使用柔和暗色脉冲</small></span><input id="flash" type="checkbox" ${m.settings.flash?'checked':''}></label><button class="primary" data-action="back">保存并返回</button>`);
    if(this.screen==='brief')html=this.shell(`<span class="eyebrow">HALF READY / 时间未开始</span><h2>这一环可以半就绪。</h2><p>你已经看懂够多了。半就绪仍从苏醒舱出发：电池带着 50% 电量，但没有隔离，主网是通的，温控仍是能源优先。标准开局则从空电池开始。</p><div class="actions"><button data-action="ready-standard">标准开局 ${key('1')}</button><button class="primary" data-action="ready-half">半就绪 ${key('2')}</button></div>`);
    if(this.screen==='records')html=this.shell(`<div class="panel-head"><div><span class="eyebrow">OPEN QUESTION / 时间已暂停</span><h2>本环假设</h2></div><button data-action="resume" aria-label="关闭认知记录">${key('Tab')} 关闭</button></div><div class="records-layout"><div><div class="hypothesis">${this.hypothesis()}</div>${this.axis()}${m.lastTrace?`<p class="trace">${escapeHtml(m.lastTrace)}</p>`:''}<div class="station-map">${this.map()}</div><small>蓝点：你的位置 · 橙色：安全门 · 温控在维护室南侧</small><p class="archive-stat">第 ${m.cycles} 环 · 累计 ${formatTime(m.total)} · ${g.s.cooling==='energy'?'能源优先':'休眠优先'}</p><div class="hint-box"><span class="eyebrow">按需提示</span><p>${this.hintText||'需要另一个观察角度时，再向这里提问。'}</p><button data-action="hint">${this.hintText?'再给一点提示':'请求一点提示'}</button></div></div><div class="archive-list">${this.solvedFacts()}${m.discoveries.length?m.discoveries.map(id=>`<article><span>◉</span><div><h3>${KNOWLEDGE[id].title}</h3><p>${KNOWLEDGE[id].text}</p></div></article>`).join(''):'<p class="empty">还没有留下已解事实。<br>先去验证这一环的假设。</p>'}<h3 class="logs-heading">已读日志 / ${m.logs.length}</h3>${m.logs.map(id=>`<button class="log-link" data-action="log:${id}">${LOGS[id].title} ↗</button>`).join('')}</div></div>`, 'wide');
    if(this.screen==='log'){const log=LOGS[this.currentLog];html=this.shell(`<span class="eyebrow">LOCAL DOCUMENT / 时间已暂停</span><h2>${log.title}</h2><p class="log-text">${log.text.replaceAll('\n','<br>')}</p><button class="primary" data-action="resume">收起记录 ${key('E / Esc')}</button>`);}
    if(this.screen==='won')html=`<div class="ending-screen"><span class="eyebrow">OUTSIDE THE CYCLE</span><h1>空间站回到了 ${RULES.cycle} 秒前。<br><em>休眠乘员已安全脱离。</em></h1><p>《恒星升起前》 · 人类安全撤离完成</p><div class="end-stats"><div><b>${m.cycles}</b><span>经历的循环</span></div><div><b>${m.discoveries.length}<small> / ${Object.keys(KNOWLEDGE).length}</small></b><span>留下的发现</span></div><div><b>${formatTime(m.total)}</b><span>累计值守时间</span></div></div><div class="actions"><button class="primary" data-action="continue">再值守一环 · 带着认知</button><button data-action="replay">清空认知重来</button><button data-action="title">返回标题</button></div></div>`;
    this.el.overlay.innerHTML=html;
  }
  hypothesis() {
    const q = questionById(this.game.memory.activeQuestionId);
    if (!q) return '<span class="eyebrow">本环假设</span><p>这一环的问题已经落地。下一次回环再挂下一条。</p>';
    return `<span class="eyebrow">本环假设 / THIS LOOP</span><p>${q.prompt}</p>`;
  }
  solvedFacts() {
    const facts = this.game.memory.solvedQuestions.map(questionById).filter(Boolean);
    if (!facts.length) return '';
    return `<h3 class="logs-heading">已解假设 / ${facts.length}</h3>` + facts.map(q => `<article><span>☑</span><div><h3>${q.prompt}</h3><p>${q.fact}</p></div></article>`).join('');
  }
  axis() {
    const s = this.game.s;
    const W = 280;
    const x = t => 16 + (Math.max(0, Math.min(RULES.cycle, t)) / RULES.cycle) * (W - 32);
    const outX = x(RULES.outageAt), outW = Math.max(2, x(RULES.outageAt + RULES.outageFor) - outX);
    const dots = (s.axis || []).map(e => `<circle cx="${x(e.t).toFixed(1)}" cy="22" r="3.2" fill="#f3cf98"><title>${e.t}s ${e.label}</title></circle>`).join('');
    const log = (s.axis || []).slice(-4).map(e => `<li>${e.t.toFixed(1)}s · ${e.label}</li>`).join('');
    return `<div class="axis"><span class="eyebrow">0–${RULES.cycle}s</span><svg viewBox="0 0 ${W} 36" aria-label="本环时间简轴"><line x1="16" y1="22" x2="${W-16}" y2="22" stroke="#3b5361"/><rect x="${outX}" y="14" width="${outW}" height="16" fill="#f7a46b55"/><circle cx="${x(s.elapsed).toFixed(1)}" cy="22" r="5" fill="#7ce3e7"/>${dots}</svg><p>主电 ${s.power?'在线':'断开'} · 门锁 ${s.power?'锁闭':'释放'} · 储冷 ${s.cold.toFixed(1)} · 热 ${s.heat.toFixed(1)}</p>${log?`<ul class="axis-log">${log}</ul>`:''}</div>`;
  }
  map() {
    const p=this.game.s.player;
    return `<svg viewBox="0 0 280 180" aria-label="四房间平面图"><g fill="none" stroke="#627c8b" stroke-width="2"><rect x="12" y="12" width="80" height="76"/><rect x="12" y="88" width="80" height="76"/><rect x="92" y="12" width="80" height="152"/><rect x="172" y="12" width="90" height="152"/></g><g fill="#102837"><path d="M91 42h3v20h-3zm0 76h3v20h-3zM41 86h23v4H41z"/></g><path d="M172 72v31" stroke="${this.game.s.power?'#f7a46b':'#9cf3b5'}" stroke-width="5"/><g fill="#bed4dd" font-size="12" text-anchor="middle"><text x="52" y="48">B 能源室</text><text x="52" y="131">A 苏醒舱</text><text x="132" y="47">C 维护室</text><text x="216" y="47">D 逃生区</text></g><g fill="#639fba" font-size="10" text-anchor="middle"><text x="57" y="29">断路器</text><text x="132" y="70">备用电池</text><text x="213" y="116">发射终端</text></g><circle cx="${12+(p.x+12)*10}" cy="${12+(p.z+7)*10.85}" r="4" fill="#7be6fc" stroke="#fff" stroke-width="1.5"/></svg>`;
  }
  message(text,seconds=4) { this.el.broadcast.querySelector('p').textContent=text;this.messageUntil=performance.now()+seconds*1000; }
  event(e) {
    if(['begin','broadcast','feedback','deny','trace'].includes(e.type)){this.message(e.detail);this.el.broadcast.classList.toggle('error',e.type==='deny'||e.type==='trace');}
    if(e.type==='discovery'){this.el['discovery-toast'].innerHTML=`<span>◉ 新认知</span> ${e.detail} <small>Tab 查看</small>`;this.toastUntil=performance.now()+4000;}
    if(e.type==='hypothesis'){this.el['discovery-toast'].innerHTML=`<span>☑ 假设落地</span> ${e.detail} <small>Tab 查看</small>`;this.toastUntil=performance.now()+4000;}
    if(e.type==='brief'){this.screen='brief';this.clearInput();this.renderScreen();}
    if(e.type==='ready'){this.screen=null;this.playMode='play';this.clearInput();this.el.overlay.innerHTML='';}
    if(e.type==='log'){this.currentLog=e.detail;this.open('log');}
    if(e.type==='reset'){this.clearInput();this.screen=null;this.el.overlay.innerHTML='';}
  }
  update(target, resetHeld) {
    const s=this.game.s,m=this.game.memory;
    if(s.mode==='won'&&this.screen!=='won'){this.screen='won';this.clearInput();this.renderScreen();}
    const inGame=!['title','won','ending'].includes(s.mode);
    this.el.hud.hidden=!inGame;
    const windowView=document.getElementById('cinematic-window');
    windowView.hidden=!(s.mode==='ending'&&s.ending>=2.7);
    windowView.querySelector('button').hidden=s.ending<5;
    windowView.querySelector('p').innerHTML=s.ending>=5?`空间站回到了 ${RULES.cycle} 秒前。<br>休眠乘员已离开锚点。`:'恒星脉冲再次扫过曙光站。';
    this.el['room-name'].textContent=roomAt(s.player).name;
    this.el['power-status'].textContent=s.power?'● 主网在线':s.isolated?'● 主网离线 / 备用独立':'○ 主网离线';
    this.el['power-status'].className=s.power?'online':s.isolated?'backup':'offline';
    this.el['cycle-num'].textContent=`第 ${String(m.cycles).padStart(2,'0')} 环`;
    const remain=Math.max(0,RULES.cycle-s.elapsed);
    this.el.remaining.textContent=remain<=10?remain.toFixed(1):Math.ceil(remain).toString().padStart(2,'0');
    document.getElementById('cycle-clock').classList.toggle('urgent',remain<=10);
    this.el['clock-arc'].style.strokeDashoffset=220*(1-remain/RULES.cycle);
    this.el.broadcast.classList.toggle('show',performance.now()<this.messageUntil&&this.active);
    this.el['discovery-toast'].classList.toggle('show',performance.now()<this.toastUntil&&this.active);
    this.el['new-count'].textContent=m.boardAlert?'!':(m.discoveries.length||'');
    const hot = s.heat>=3.5||s.overheated, chill = s.cold<1;
    this.el['vital-mode'].textContent = s.cooling==='energy'?'能源优先':'休眠优先';
    this.el['vital-heat'].textContent = `H ${s.heat.toFixed(1)}${s.overheated?' 保护':''}`;
    this.el['vital-heat'].className = hot?'hot':'';
    this.el['vital-cold'].textContent = `C ${s.cold.toFixed(1)}${s.power?'':' ↓'}`;
    this.el['vital-cold'].className = chill?'cold':'';
    this.el['vital-switch'].textContent = `温控 ${s.thermalSwitchesLeft}`;
    this.el.context.hidden=!target||s.mode!=='play'||!this.active;
    if(target){this.el['target-name'].textContent=target.name;this.el.interact.innerHTML=key('E')+' '+this.game.label(target.id);
      const heatLine=`热 H ${s.heat.toFixed(2)} / 5${s.overheated?' · 过热保护':s.heat>=3.5?' · 高热':''}`;
      const coldLine=`储冷 C ${s.cold.toFixed(1)} / 5${s.power?' · 主动保障':` · ${(Math.max(0,FE.coldSeconds-s.coldClock)).toFixed(1)} 秒后消耗`}`;
      const preview=this.game.preview(target.id);
      this.el['cost-preview'].hidden=!preview;this.el['cost-preview'].textContent=preview;
      this.el['device-status'].textContent=target.id==='thermal'?`${s.cooling==='energy'?'能源优先':'休眠优先'} · 还可拨 ${s.thermalSwitchesLeft} 次 · ${heatLine} · ${coldLine}`:target.id==='battery'?`${s.isolated?'备用回路独立':s.isolating?'隔离分离中':s.charging?'输入接通':s.charge>=1?'充满 · 尚未隔离':'公共母线接入'} · ${Math.round(s.charge*100)}% · ${heatLine}`:target.id==='breaker'?`${heatLine} · ${coldLine}`:target.id==='terminal'?`${this.game.podPower?'动力输入正常':'动力输入为零'} · ${coldLine}`:'';
    } else this.el['cost-preview'].hidden=true;
    const launch=this.el['launch-status'];launch.hidden=s.mode!=='launch';launch.querySelector('i').style.width=`${s.launch/RULES.launch*100}%`;
    this.el['reset-hold'].classList.toggle('show',resetHeld>0);this.el['reset-hold'].querySelector('i').style.width=Math.min(100,resetHeld/.8*100)+'%';
    const pulse=this.el['pulse-overlay'];
    const scarFlash=s.scarPulse>0&&m.settings.flash&&s.mode!=='reset';
    pulse.hidden=s.mode!=='reset'&&!scarFlash;
    if(s.mode==='reset'){pulse.className=m.settings.flash?'strong':'';pulse.innerHTML='<div><span>辐射脉冲 / CYCLE REWIND</span><b>控制重启 · 热账还在</b><button data-action="skip">E · 跳过</button></div>';}
    else if(scarFlash){pulse.className='strong';pulse.innerHTML='<div><span>余热 / RESIDUAL</span><b>热量不回到脉冲前</b></div>';}
  }
}
