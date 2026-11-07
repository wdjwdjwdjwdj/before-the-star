import { RULES, FE, SWITCHES_PER_LOOP, SPAWN, DEVICES, KNOWLEDGE, LOGS, COPY, TRUE_END_SOLVED, questionById, nextQuestion } from './config.js';
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
  shortcutReady() {
    const m = this.memory;
    return m.discoveries.length >= 3 || m.wins >= 1 || m.solvedQuestions.length >= 2;
  }
  start(fresh = false) {
    if (fresh) this.memory = newMemory(this.memory.settings);
    this.beginCycle();
  }
  beginCycle(opts = {}) {
    const heat = carryResidual(this.memory.residualHeat);
    const offer = this.shortcutReady();
    this.s = this.initial();
    this.s.heat = heat;
    this.memory.residualHeat = heat;
    if (this.memory.activeQuestionId && this.memory.solvedQuestions.includes(this.memory.activeQuestionId)) {
      this.memory.activeQuestionId = null;
    }
    if (!this.memory.activeQuestionId) this.memory.activeQuestionId = nextQuestion(this.memory.solvedQuestions);
    this.s.mode = offer ? 'brief' : 'play';
    this.s.started = !offer;
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
      this.emit('loop-hint', COPY.fakeEscape);
    }
    if (offer) this.emit('brief');
    this.emit('save');
  }
  chooseReady(half) {
    if (this.s.mode !== 'brief') return;
    if (half && this.shortcutReady()) {
      this.s.charge = .5;
      this.s.chargePeak = .5;
    }
    this.s.isolated = false;
    this.s.isolating = false;
    this.s.isolateDelay = 0;
    this.s.main = true;
    this.s.power = true;
    this.s.cooling = 'energy';
    this.s.thermalSwitchesLeft = SWITCHES_PER_LOOP;
    this.s.mode = 'play';
    this.s.started = true;
    this.mark(half ? '半就绪' : '标准开局');
    this.emit('ready', !!half);
    this.emit('save');
  }
  trueEscapeReady() { return this.memory.solvedQuestions.length >= TRUE_END_SOLVED; }
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
        if (s.launch >= RULES.launch - 1e-8) {
          if (this.trueEscapeReady()) {
            s.mode = 'trueend';
            s.ending = 0;
            this.memory.wins++;
            this.memory.scarHeat = false;
            this.memory.scarFrost = false;
            this.emit('trueend', COPY.trueEnd);
            this.emit('save');
          } else this.armRewind('fake');
        }
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
