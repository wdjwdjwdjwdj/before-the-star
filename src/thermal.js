import { FE, RULES } from './config.js';

// V2 carry: each new loop sheds one heat, clamped to [baseHeat, 4]. No manual unload.
export function carryResidual(value) {
  const v = Number.isFinite(value) ? value : FE.baseHeat;
  return Math.max(FE.baseHeat, Math.min(4, v - 1));
}

// Reconstructs the V2 thermal step. Scheme C only changes the three FE numbers.
// Landing exactly on safeHeat as the battery fills is a completed charge, not a lockout.
export function stepThermal(s, dt) {
  const report = { tripped: false, charged: false, coldLost: false, recovered: false, chargingTime: 0 };
  if (s.power && s.cooling === 'energy' && (!s.charging || s.overheated)) {
    s.heat = Math.max(FE.baseHeat, s.heat - FE.recoveryPerSecond * dt);
    if (s.overheated && s.heat <= FE.safeHeat) {
      s.overheated = false;
      report.recovered = true;
    }
  }
  if (s.power && s.charging && !s.isolated && !s.overheated) {
    let span = Math.min(dt, (1 - s.charge) * RULES.charge);
    const rate = FE.chargeHeat / RULES.charge;
    const wouldTrip = s.cooling === 'cryo' && s.heat + span * rate > FE.safeHeat + 1e-6;
    if (wouldTrip) span = Math.max(0, (FE.safeHeat - s.heat) / rate);
    const next = Math.min(1, s.charge + span / RULES.charge);
    if (s.cooling === 'cryo') {
      s.heat = Math.min(FE.max, s.heat + span * rate);
      s.cold = Math.min(FE.max, s.cold + Math.max(0, next - s.chargePeak) * FE.chargeCold);
    }
    s.chargePeak = Math.max(s.chargePeak, next);
    s.charge = next >= 1 - 1e-9 ? 1 : next;
    report.chargingTime = span;
    const completed = s.charge >= 1 - 1e-9;
    if (wouldTrip && !completed) {
      s.heat = Math.min(FE.max, FE.safeHeat + 1e-6);
      s.overheated = true;
      s.charging = false;
      report.tripped = true;
    } else if (completed) {
      s.charging = false;
      if (s.cooling === 'cryo') s.heat = Math.min(s.heat, FE.safeHeat);
      report.charged = true;
    }
  }
  if (!s.power) {
    s.coldClock += dt;
    const steps = Math.floor((s.coldClock + 1e-9) / FE.coldSeconds);
    if (steps > 0) {
      const before = s.cold;
      s.cold = Math.max(0, s.cold - steps);
      s.coldClock = Math.max(0, s.coldClock - steps * FE.coldSeconds);
      report.coldLost = s.cold < before - 1e-9;
    }
  }
  const rounded = Math.round(s.cold);
  if (Math.abs(s.cold - rounded) < 1e-9) s.cold = rounded;
  const heatRounded = Math.round(s.heat * 1000) / 1000;
  if (Math.abs(s.heat - heatRounded) < 1e-9) s.heat = heatRounded;
  return report;
}

export function launchDenial(s) {
  if (s.main || s.power || !s.isolated || s.charge < 1) return 'phase';
  if (s.cold < 1) return 'cold';
  return null;
}
