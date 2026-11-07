import { RULES, FE, SWITCHES_PER_LOOP, SPAWN, DEVICES, KNOWLEDGE, LOGS, COPY, FAKE_ESCAPE, CORE_PULL, phaseOutside, checklistOf, questionById, nextQuestion } from './config.js';
import { carryResidual, stepThermal, launchDenial } from './thermal.js';
import { move, visible, clearGate } from './movement.js';

export function newMemory(settings = {}) {
  return {
    version: 1,
    residualHeat: FE.baseHeat,
    discoveries: [],
    logs: [],
    cycles: 0,
    total: 0,
    wins: 0,
    hintLevel: 0,
    solvedQuestions: [],
    activeQuestionId: null,
    scarHeat: false,
    scarFrost: false,
    lastTrace: '',
    boardAlert: false,
    fakeEscapes: 0,
    clues: [],
    settings: { volume: .45, shake: true, flash: false, ...settings },
  };
}

export class Game {
  constructor(memory = newMemory(), onEvent = () => {}) {
    this.memory = memory;
    this.onEvent = onEvent;
    this.s = this.initial();
  }
  initial() {
    return {
      mode: 'title',
      player: { ...SPAWN },
      elapsed: 0,
      cooling: 'energy',
      heat: FE.baseHeat,
      cold: FE.baseCold,
      coldClock: 0,
      chargePeak: 0,
      overheated: false,
      thermalSwitchesLeft: SWITCHES_PER_LOOP,
      main: true,
      power: true,
      charging: false,
      charge: 0,
      isolated: false,
      isolating: false,
      isolateDelay: 0,
      launch: 0,
      ending: 0,
      resetTime: 0,
      rewindTime: 0,
      rewindKind: '',
      waveFlash: 0,
      loopHint: '',
      addressUnlatched: false,
      thermalDecoupled: false,
      coreState: 'seated',
      corePull: 0,
      coreHot: 0,
      departT: 0,
      departPhase: '',
      checklistFlash: 0,
      started: false,
      outageSeen: false,
      mid: false,
      alarmSecond: -1,
      moving: false,
      facing: 0,
      sawHot: false,
      sawOverheat: false,
      launchDeniedCold: false,
      coldAlarmSent: false,
      heatWarned: false,
      confirmedGate: false,
      coldVerified: false,
      heatVerified: false,
      residualVerified: false,
      heatSafeTime: 0,
      coldSafeTime: 0,
      scarPulse: 0,
      axis: [],
    };
  }
  emit(type, detail) { this.onEvent({ type, detail }); }
  discover(id) {
    if (!KNOWLEDGE[id] || this.memory.discoveries.includes(id)) return;
    this.memory.discoveries.push(id);
    this.emit('discovery', KNOWLEDGE[id].title);
    this.emit('save');
  }
  start(fresh = false) {
    if (fresh) this.memory = newMemory(this.memory.settings);
    this.beginCycle();
  }
  beginCycle(opts = {}) {
    const heat = carryResidual(this.memory.residualHeat);
    this.s = this.initial();
    this.s.heat = heat;
    this.memory.residualHeat = heat;
    if (this.memory.activeQuestionId && this.memory.solvedQuestions.includes(this.memory.activeQuestionId)) {
      this.memory.activeQuestionId = null;
    }
    if (!this.memory.activeQuestionId) this.memory.activeQuestionId = nextQuestion(this.memory.solvedQuestions);
    this.s.mode = 'play';
    this.s.started = true;
    this.memory.cycles++;
    this.emit('begin', COPY.begin);
    if (heat > FE.baseHeat + 1e-6) {
      this.discover('residual');
      this.emit('feedback', COPY.residual);
      this.emit('scar');
      this.s.scarPulse = .45;
      if (this.memory.activeQuestionId === 'q_residual') this.s.residualVerified = true;
    }
    this.resolveQuestions();
    if (opts.wave) this.s.waveFlash = .55;
    if (opts.fake) {
      this.s.loopHint = COPY.fakeEscape;
      this.s.checklistFlash = 2;
      this.memory.fakeEscapes++;
      this.emit('loop-hint', COPY.fakeEscape);
    }
    this.emit('save');
  }
  trueEscapeReady() {
    const s = this.s;
    return s.charge >= 1 && s.isolated && s.addressUnlatched && s.thermalDecoupled && s.cold >= 1 && s.coreState === 'anchored' && !s.main && !s.power && phaseOutside(s.elapsed);
  }
  noteClue(id) {
    if (!this.memory.clues.includes(id)) { this.memory.clues.push(id); this.emit('save'); }
  }
  requestReset() { if (['play', 'launch'].includes(this.s.mode)) this.reset(false); }
  armRewind(kind) {
    if (this.s.mode === 'rewind') return;
    const s = this.s;
    this.pendingLoop = {
      kind,
      natural: kind !== 'manual',
      heat: s.heat,
      scarHeat: !!(s.sawHot || s.sawOverheat || s.overheated || s.heat >= 3.5),
      scarFrost: !!s.launchDeniedCold,
    };
    s.mode = 'rewind';
    s.rewindTime = 0;
    s.rewindKind = kind;
    this.emit('rewind', kind);
  }
  finishRewind() {
    const pending = this.pendingLoop || { kind: 'wave', natural: true, heat: FE.baseHeat, scarHeat: false, scarFrost: false };
    if (pending.scarHeat) this.memory.scarHeat = true;
    if (pending.scarFrost) this.memory.scarFrost = true;
    if (Number.isFinite(pending.heat)) this.memory.residualHeat = pending.heat;
    if (pending.natural) this.discover('loop');
    this.pendingLoop = null;
    this.emit('reset', pending.natural);
    this.beginCycle({ wave: true, fake: pending.kind === 'fake' });
  }
  reset(natural = true) { this.armRewind(natural ? 'wave' : 'manual'); }
  skipReset() { if (this.s.mode === 'rewind') this.finishRewind(); }
  armDepart(isTrue) {
    const s = this.s;
    if (s.sawHot || s.sawOverheat || s.overheated || s.heat >= 3.5) this.memory.scarHeat = true;
    if (s.launchDeniedCold) this.memory.scarFrost = true;
    if (Number.isFinite(s.heat)) this.memory.residualHeat = s.heat;
    s.mode = isTrue ? 'trueEscape' : 'fakeEscape';
    s.departT = 0;
    s.departPhase = 'hold';
    s.launch = RULES.launch;
    this.emit(isTrue ? 'trueEscape' : 'fakeEscape');
  }
  stepDepart(dt) {
    const s = this.s;
    const prev = s.departT;
    s.departT += dt;
    const holdEnd = FAKE_ESCAPE.flyHold;
    const shockEnd = holdEnd + FAKE_ESCAPE.shockVisible;
    const flashEnd = shockEnd + FAKE_ESCAPE.rewindFlash;
    const blackEnd = flashEnd + FAKE_ESCAPE.blackout;
    const t = s.departT;
    if (s.mode === 'fakeEscape') {
      s.departPhase = t < holdEnd ? 'hold' : t < shockEnd ? 'shock' : t < flashEnd ? 'flash' : t < blackEnd ? 'black' : 'land';
      if (prev < holdEnd && t >= holdEnd) this.emit('broadcast', COPY.waitStar);
      if (t >= blackEnd) this.beginCycle({ fake: true, wave: true });
      return;
    }
    const trueBlack = shockEnd;
    const trueEnd = shockEnd + FAKE_ESCAPE.blackout;
    s.departPhase = t < holdEnd ? 'hold' : t < shockEnd ? 'shock' : t < trueEnd ? 'black' : 'end';
    if (prev < trueBlack && t >= trueBlack) this.emit('still');
    if (t >= trueEnd) {
      s.mode = 'won';
      s.ending = 0;
      this.memory.wins++;
      this.memory.scarHeat = false;
      this.memory.scarFrost = false;
      this.emit('trueend', COPY.trueEnd);
      this.emit('save');
    }
  }
  finishEnding() { if (this.s.mode === 'trueend') { this.s.mode = 'trueend'; this.emit('save'); } }
  pause() { if (this.s.mode === 'play') { this.s.mode = 'pause'; this.emit('save'); } }
  resume() { if (['pause', 'records', 'settings', 'help', 'log'].includes(this.s.mode)) this.s.mode = 'play'; }
  nearest() {
    const s = this.s;
    return DEVICES.filter(d => Math.hypot(d.x - s.player.x, d.z - s.player.z) <= RULES.interact && visible(s.player, d, s))
      .sort((a, b) => Math.hypot(a.x - s.player.x, a.z - s.player.z) - Math.hypot(b.x - s.player.x, b.z - s.player.z))[0] || null;
  }
  label(id) {
    const s = this.s;
    if (id === 'breaker') return s.isolating ? '等待隔离完成' : s.main ? '切断主供电' : '恢复主供电';
    if (id === 'thermal') return s.thermalSwitchesLeft > 0 ? `切换为${s.cooling === 'energy' ? '休眠' : '能源'}优先` : '本环分配已锁定';
    if (id === 'battery') {
      if (s.isolating) return '隔离进行中';
      if (s.isolated) return '检查隔离回路';
      if (s.charge >= 1) return '隔离至逃生备用回路';
      if (s.overheated) return '过热保护 · 检查温控';
      if (s.charging) return `停止充电 · ${Math.floor(s.charge * 100)}%`;
      if (!s.power) return '检查电池 · 无输入电源';
      return '开始充电';
    }
    if (id === 'gate') return s.power ? '查看门锁 · 有电锁闭' : '查看门锁 · 失电释放';
    if (id === 'address-latch') return s.addressUnlatched ? '复位注销栓' : '拉下注销栓';
    if (id === 'heat-valve') return s.thermalDecoupled ? '阀门回到耦合' : '拧至热解耦';
    if (id === 'return-core') return s.coreState === 'pulling' ? '拔出中' : s.coreState === 'held' ? '核心在手中' : s.coreState === 'anchored' ? '核心已入舱锚' : '拔出返照核心';
    if (id === 'phase-anchor') return s.coreState === 'anchored' ? '相位锚已锁定' : '插入返照核心';
    if (id === 'phase-band') return '读相位窗铭牌';
    if (id === 'handoff-list') return '看交接清单';
    if (id === 'serial-plate') return '对照序列号';
    if (id === 'terminal') return s.mode === 'launch' ? '发射序列执行中' : '启动逃生舱';
    return '阅读' + (LOGS[id]?.title.split(' / ')[0] || '日志');
  }
  preview(id) {
    const s = this.s;
    if (!id || s.mode !== 'play') return '';
    if (id === 'battery' && !s.isolated && s.charge >= 1) {
      if (s.isolating) return '隔离进行中，大约还要 0.5 秒。';
      if (s.cooling === 'energy') return '即将隔离：能源优先会抽走储冷 −1。';
      return '即将隔离：休眠优先不抽储冷，但要多花约 0.5 秒。';
    }
    if (id === 'breaker') {
      if (s.isolating) return '主闸先别动。隔离触点还在分离。';
      if (s.main) return `断闸之后储冷每 ${FE.coldSeconds} 秒 −1。撤离要守住冷 ≥ 1。`;
      return '合闸后储冷停止下跌，主动冷却恢复。';
    }
    if (id === 'terminal') {
      if (s.cold < 1) return '储冷低于保障线。现在启动会被驳回。';
      return '启动条件：主网断开、电池满且隔离，发射 2 秒内冷 ≥ 1。';
    }
    if (id === 'address-latch') return s.addressUnlatched ? '复位后，这块电会回到站体采样表。' : '拉下后，本节点退出站体采样表。';
    if (id === 'heat-valve') return s.cold < 1 ? '储冷不够，阀门会拒转。' : '拧开站与舱之间的热耦合。';
    if (id === 'return-core') return '拔出要 1.2 秒。中途储冷掉破 1，核心会弹回座。';
    if (id === 'phase-anchor') return s.coreState === 'held' ? '把返照核心插入舱侧相位锚。' : '锚座空着。';
    if (id === 'thermal') {
      if (s.thermalSwitchesLeft <= 0) return '本环温控已锁定，再拨也会被拒绝。';
      if (s.cooling === 'energy') return '拨向休眠：充电会堆冷，热负荷一起涨。';
      return '拨向能源：充电不再堆热，休眠侧抽冷变慢。';
    }
    return '';
  }
  get podPower() { return this.s.power || (this.s.isolated && this.s.charge >= 1); }
  mark(label) {
    const t = Math.round(this.s.elapsed * 10) / 10;
    const last = this.s.axis[this.s.axis.length - 1];
    if (last && last.label === label && Math.abs(last.t - t) < .15) return;
    this.s.axis.push({ t, label });
    if (this.s.axis.length > 8) this.s.axis.shift();
  }
  trace(text) {
    this.memory.lastTrace = text;
    this.memory.boardAlert = true;
    this.emit('trace', text);
  }
  powerChanged() {
    const s = this.s;
    const p = s.main && !(s.elapsed >= RULES.outageAt && s.elapsed < RULES.outageAt + RULES.outageFor);
    if (p === s.power) return;
    s.power = p;
    clearGate(s);
    if (!p) {
      s.charging = false;
      this.discover('cold');
      if (s.charge > 0 && !s.isolated) this.discover('drain');
      this.mark(s.main ? '母线瞬断' : '断闸');
    } else this.mark('主电恢复');
    this.emit('power', p);
    if (s.player.x > -2.5) this.discover('gate');
  }
  denyLaunch(code) {
    if (code === 'cold') {
      this.s.launchDeniedCold = true;
      this.s.coldVerified = true;
      this.memory.scarFrost = this.memory.scarFrost;
      this.discover('cold');
      this.trace(COPY.denyCold);
      this.emit('deny', COPY.denyCold);
    } else this.emit('deny', COPY.denyPhase);
    this.resolveQuestions();
  }
  interact(id = this.nearest()?.id) {
    const s = this.s;
    if (s.mode !== 'play') return;
    if (!id || this.nearest()?.id !== id) return;
    s.started = true;
    if (id.startsWith('log-')) {
      if (!this.memory.logs.includes(id)) this.memory.logs.push(id);
      this.emit('log', id);
      this.emit('save');
      return;
    }
    if (id === 'breaker') {
      if (s.isolating) {
        this.emit('deny', '隔离触点还在分离。大约还要半秒，不能连着断开主闸。');
        return;
      }
      s.main = !s.main;
      this.powerChanged();
      this.emit('feedback', s.main ? '主断路器已闭合。' : '主断路器已断开。普通回路离线。');
      return;
    }
    if (id === 'thermal') {
      if (s.thermalSwitchesLeft <= 0) {
        this.emit('deny', COPY.thermalLocked);
        return;
      }
      s.cooling = s.cooling === 'energy' ? 'cryo' : 'energy';
      s.thermalSwitchesLeft -= 1;
      s.heatVerified = true;
      this.discover('thermal');
      this.emit('valve');
      this.mark(s.cooling === 'cryo' ? '温控→休眠' : '温控→能源');
      this.emit('feedback', s.cooling === 'energy' ? COPY.thermalEnergy : COPY.thermalCryo);
      this.resolveQuestions();
      return;
    }
    if (id === 'battery') {
      if (s.isolated) { this.emit('feedback', '备用回路已隔离。电量 100% · 仅接入逃生舱。'); return; }
      if (s.isolating) { this.emit('feedback', '隔离触点还在分离。'); return; }
      if (s.charge >= 1) {
        s.charging = false;
        if (s.cooling === 'energy') {
          s.cold = Math.max(0, s.cold - 1);
          s.isolated = true;
          this.discover('isolate');
          this.emit('isolate');
          this.mark('隔离 · 储冷−1');
          this.emit('feedback', '隔离触点已分离。能源优先抽走了 1 单位储冷。');
          if (s.cold < 1) {
            s.coldVerified = true;
            s.coldAlarmSent = true;
            this.trace(COPY.coldWarn);
            this.emit('deny', COPY.coldWarn);
          }
        } else {
          s.isolating = true;
          s.isolateDelay = .5;
          this.emit('feedback', '休眠优先隔离开始。触点分离还要约 0.5 秒，储冷不动。');
        }
        this.resolveQuestions();
        return;
      }
      if (!s.power) { this.emit('deny', '没有输入电源。电池无法充电。'); return; }
      if (s.overheated) { this.emit('deny', '能源设备过热，充电已停止。请恢复能源冷却。'); return; }
      if (s.charging) { s.charging = false; this.emit('feedback', '充电已停止。已产生的热负荷与电量保留。'); return; }
      s.charging = true;
      this.discover('charge');
      this.emit('charge');
      this.emit('feedback', '开始充电。预计四秒，可离开设备。');
      return;
    }
    if (id === 'address-latch') {
      s.addressUnlatched = !s.addressUnlatched;
      this.emit('latch');
      this.emit('feedback', s.addressUnlatched ? COPY.latchPull : '注销栓复位。节点回到站体采样表。');
      return;
    }
    if (id === 'heat-valve') {
      if (!s.thermalDecoupled && s.cold < 1) { this.emit('deny', COPY.valveTurn); return; }
      s.thermalDecoupled = !s.thermalDecoupled;
      this.emit('valve');
      this.emit('feedback', s.thermalDecoupled ? COPY.valveTurn : '阀门回到耦合。站舱热账重新接上。');
      return;
    }
    if (id === 'return-core') {
      if (s.coreState === 'anchored') { this.emit('feedback', '核心已在舱侧相位锚上。'); return; }
      if (s.coreState === 'held') { this.emit('feedback', '核心在你手里。送到逃生舱的相位锚。'); return; }
      if (s.coreState === 'pulling') return;
      if (s.cold < 1) { s.coreHot = 1.2; this.emit('deny', '储冷未达标。核心弹回实验座。'); return; }
      s.coreState = 'pulling';
      s.corePull = 0;
      this.emit('feedback', COPY.corePlate);
      return;
    }
    if (id === 'phase-anchor') {
      if (s.coreState !== 'held') { this.emit('deny', '相位锚空着。先拔下返照核心。'); return; }
      s.coreState = 'anchored';
      this.emit('anchor');
      this.emit('feedback', COPY.anchorLock);
      return;
    }
    if (id === 'phase-band') { this.noteClue('E'); this.emit('feedback', COPY.phasePlate); return; }
    if (id === 'handoff-list') {
      this.noteClue('G');
      this.emit('feedback', checklistOf(s).map(c => `${c.on ? '☑' : '□'} ${c.label}`).join(' · '));
      return;
    }
    if (id === 'serial-plate') { this.noteClue('C'); this.emit('feedback', COPY.serialPlate); return; }
    if (id === 'gate') {
      s.confirmedGate = true;
      this.discover('gate');
      this.emit('feedback', s.power ? '铭牌：有源锁闭。失电时机械释放。' : '门锁释放。铰链上没有电流。');
      this.resolveQuestions();
      return;
    }
    if (id === 'terminal') {
      const code = launchDenial(s);
      if (code) {
        if (!this.podPower) this.discover('pod');
        this.denyLaunch(code);
      } else {
        s.mode = 'launch';
        s.launch = 0;
        this.mark('启动撤离');
        this.emit('launch');
      }
    }
  }
  resolveQuestions() {
    const id = this.memory.activeQuestionId;
    if (!id || this.memory.solvedQuestions.includes(id)) return;
    const s = this.s;
    const ok = (id === 'q_gate' && s.confirmedGate)
      || (id === 'q_cold' && s.coldVerified)
      || (id === 'q_heat' && s.heatVerified)
      || (id === 'q_residual' && s.residualVerified);
    if (!ok) return;
    this.memory.solvedQuestions.push(id);
    this.memory.activeQuestionId = null;
    const q = questionById(id);
    this.emit('hypothesis', q?.fact || id);
    this.emit('save');
  }
  tick(dt, input = {}) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    let left = dt;
    let guard = 0;
    while (left > 1e-8 && guard++ < 8000) {
      let step = Math.min(left, 1 / 60);
      const s = this.s;
      if (['play', 'launch'].includes(s.mode) && s.started) {
        const marks = [RULES.outageAt, RULES.outageAt + RULES.outageFor, RULES.cycle];
        if (s.mode === 'launch') marks.push(s.elapsed + Math.max(0, RULES.launch - s.launch));
        if (s.isolateDelay > 0) marks.push(s.elapsed + s.isolateDelay);
        if (!s.power) marks.push(s.elapsed + Math.max(0, FE.coldSeconds - s.coldClock));
        for (const mark of marks) {
          const remain = mark - s.elapsed;
          if (remain > 1e-8) step = Math.min(step, remain);
        }
      }
      step = Math.min(step, left);
      if (step <= 0) break;
      this.step(step, input);
      left -= step;
    }
  }
  step(dt, input) {
    const s = this.s;
    if (s.mode === 'fakeEscape' || s.mode === 'trueEscape') { this.stepDepart(dt); return; }
    if (s.mode === 'rewind') {
      s.rewindTime += dt;
      if (s.rewindTime >= .72) this.finishRewind();
      return;
    }
    if (s.mode === 'trueend') { s.ending = Math.min(RULES.ending, s.ending + dt); return; }
    if (!['play', 'launch'].includes(s.mode)) return;
    if (s.mode === 'play') {
      const dx = input.x || 0, dz = input.z || 0;
      s.moving = move(s, dx, dz, dt);
      if (dx || dz) { s.started = true; s.facing = Math.atan2(dx, dz); }
    } else s.moving = false;
    if (!s.started) return;
    if (s.waveFlash > 0) s.waveFlash = Math.max(0, s.waveFlash - dt);
    if (s.checklistFlash > 0) s.checklistFlash = Math.max(0, s.checklistFlash - dt);
    if (s.coreHot > 0) s.coreHot = Math.max(0, s.coreHot - dt);
    if (s.scarPulse > 0) s.scarPulse = Math.max(0, s.scarPulse - dt);
    if (s.isolating) {
      s.isolateDelay = Math.max(0, s.isolateDelay - dt);
      if (s.isolateDelay <= 1e-8) {
        s.isolateDelay = 0;
        s.isolating = false;
        s.isolated = true;
        this.discover('isolate');
        this.emit('isolate');
        this.mark('隔离完成');
        this.emit('feedback', '隔离触点已分离。休眠优先慢了半秒，储冷没有被抽走。');
      }
    }
    const report = stepThermal(s, dt);
    if (s.coreState === 'pulling') {
      if (s.cold < 1) {
        s.coreState = 'seated';
        s.corePull = 0;
        s.coreHot = 1.2;
        this.emit('deny', '储冷跌破。核心弹回实验座。');
      } else {
        s.corePull += dt;
        if (s.corePull >= CORE_PULL) {
          s.coreState = 'held';
          s.corePull = 0;
          s.heat = Math.min(FE.safeHeat, s.heat + 1);
          this.emit('core');
          this.emit('feedback', COPY.coreOut);
        }
      }
    }
    if (report.chargingTime > 0 && s.cooling === 'cryo') {
      s.heatVerified = true;
      this.discover('heat');
    }
    if (report.tripped) {
      s.sawOverheat = true;
      s.heatVerified = true;
      this.discover('heat');
      this.mark('过热停充');
      this.emit('overheat');
      this.emit('deny', '能源设备过热，充电已停止。');
    }
    if (report.recovered) this.emit('feedback', '热负荷已回到安全范围。可重新接通充电。');
    if (report.charged) { this.emit('charged'); this.emit('feedback', '电池已充满。隔离开关现在可以操作。'); }
    if (report.coldLost) {
      s.coldVerified = true;
      this.mark('储冷下跌');
      if (s.cold < 1 && !s.coldAlarmSent) {
        s.coldAlarmSent = true;
        this.trace(COPY.coldWarn);
        this.emit('deny', COPY.coldWarn);
      }
    }
    if (s.heat >= 3.5) s.sawHot = true;
    if (s.heat >= 3.5 && !s.heatWarned) {
      s.heatWarned = true;
      this.emit('broadcast', COPY.residualHigh);
    }
    if (s.overheated) s.sawOverheat = true;
    if (!s.power && s.player.x > 3.2) s.confirmedGate = true;
    if (!s.power && !s.isolated && s.charge > 0) s.charge = Math.max(0, s.charge - dt / 1.5);
    s.elapsed += dt;
    for (const mark of [RULES.outageAt, RULES.outageAt + RULES.outageFor, RULES.cycle]) {
      if (Math.abs(s.elapsed - mark) < 1e-6) s.elapsed = mark;
    }
    this.memory.total += dt;
    this.memory.residualHeat = s.heat;
    this.powerChanged();
    this.healScars(dt);
    if (s.player.x > 4.6) {
      this.discover('gate');
      if (!s.power) s.confirmedGate = true;
      if (!this.podPower) this.discover('pod');
    }
    if (s.elapsed >= RULES.outageAt && !s.outageSeen) {
      s.outageSeen = true;
      if (s.main) this.emit('broadcast', '母线瞬断。安全锁失电释放。');
    }
    if (s.elapsed >= 25 && !s.mid) { s.mid = true; this.emit('broadcast', '恒星辐射升高。站体锚点正在同步。'); }
    if (s.elapsed >= RULES.cycle - 10 && Math.floor(s.elapsed) !== s.alarmSecond) {
      s.alarmSecond = Math.floor(s.elapsed);
      this.emit('alarm', Math.ceil(RULES.cycle - s.elapsed));
    }
    this.resolveQuestions();
    if (s.elapsed >= RULES.cycle - 1e-8) { this.reset(true); return; }
    if (s.mode === 'launch') {
      const code = launchDenial(s);
      if (code) {
        s.mode = 'play';
        s.launch = 0;
        this.denyLaunch(code);
      } else {
        s.launch += dt;
        if (s.launch >= RULES.launch - 1e-8) this.armDepart(this.trueEscapeReady());
      }
    }
  }
  healScars(dt) {
    const s = this.s;
    if (this.memory.scarHeat) {
      if (s.heat <= FE.baseHeat + 0.2) s.heatSafeTime += dt;
      else s.heatSafeTime = 0;
      if (s.heatSafeTime >= 2) {
        this.memory.scarHeat = false;
        this.emit('feedback', '能源室的热痕褪下去了。');
      }
    } else s.heatSafeTime = 0;
    if (this.memory.scarFrost) {
      if (s.cold >= 2) s.coldSafeTime += dt;
      else s.coldSafeTime = 0;
      if (s.coldSafeTime >= 3) {
        this.memory.scarFrost = false;
        this.emit('feedback', '休眠监视器上的霜退了。');
      }
    } else s.coldSafeTime = 0;
  }
}
