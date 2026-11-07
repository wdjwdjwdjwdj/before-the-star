// Local Web Audio synthesis only. No network assets, timers or repeated listeners.
export class AudioSystem {
  constructor() { this.ctx = null; this.volume = .45; this.muted = true; }
  async unlock() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.hum = this.ctx.createOscillator(); this.hum.type = 'sine'; this.hum.frequency.value = 57;
      this.humGain = this.ctx.createGain(); this.hum.connect(this.humGain); this.humGain.connect(this.master); this.hum.start();
      this.air = this.ctx.createOscillator(); this.air.type = 'sine'; this.air.frequency.value = 114;
      this.airGain = this.ctx.createGain(); this.airGain.gain.value = .018; this.air.connect(this.airGain); this.airGain.connect(this.master); this.air.start();
    }
    await this.ctx.resume();
  }
  update(power, active, volume) {
    this.volume = volume;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(active ? volume : 0, t, .08);
    this.humGain.gain.setTargetAtTime(power ? .09 : .018, t, .16);
    this.hum.frequency.setTargetAtTime(power ? 57 : 34, t, .15);
    this.airGain.gain.setTargetAtTime(power ? .018 : .007, t, .1);
  }
  tone(f = 440, duration = .13, type = 'sine', delay = 0, gain = .12, end = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (end) o.frequency.exponentialRampToValueAtTime(end, t + duration);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + duration);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + duration + .02); o.onended = () => { o.disconnect(); g.disconnect(); };
  }
  event(type, detail) {
    if (type === 'power') this.tone(detail ? 100 : 190, .45, 'triangle', 0, .17, detail ? 240 : 45);
    if (['feedback','charge','isolate','begin'].includes(type)) { this.tone(430,.07); this.tone(650,.1,'sine',.08); }
    if (type === 'valve') { this.tone(320,.08,'triangle'); this.tone(480,.12,'sine',.07); }
    if (type === 'overheat') { this.tone(180,.3,'sawtooth',0,.08,70); }
    if (type === 'scar') this.tone(90,.35,'triangle',0,.06,40);
    if (type === 'deny') { this.tone(140,.14,'triangle'); this.tone(105,.2,'triangle',.15); }
    if (['charged','discovery'].includes(type)) [520,780,1040].forEach((n,i)=>this.tone(n,.22,'sine',i*.1,.08));
    if (type === 'alarm') { this.tone(detail <= 3 ? 880 : 620,.17,'triangle',0,.09); if(detail<=3) this.tone(660,.1,'triangle',.2,.07); }
    if (type === 'reset' || type === 'rewind') this.tone(520,.45,'triangle',0,.06,40);
    if (type === 'trueend') [220,330,440].forEach((n,i)=>this.tone(n,1.4,'sine',i*.16,.05));
    if (type === 'launch') this.tone(65,2,'triangle',0,.18,260);
    if (type === 'success') [220,330,440,660].forEach((n,i)=>this.tone(n,2.1,'sine',i*.3,.07));
  }
}
