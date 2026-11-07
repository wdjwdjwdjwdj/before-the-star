import { WALLS, PROPS, GATE, RULES } from './config.js';
export function obstacles(s) { return s.power ? [...WALLS, ...PROPS, GATE] : [...WALLS, ...PROPS]; }
export function inside(p, b, r = 0) { return Math.abs(p.x - b.x) < b.w / 2 + r && Math.abs(p.z - b.z) < b.d / 2 + r; }
export function free(p, s) { return !obstacles(s).some(b => inside(p, b, RULES.radius)); }
export function move(s, dx, dz, dt) {
  const len = Math.hypot(dx, dz); if (!len) return false;
  const distance = RULES.speed * dt; const n = Math.ceil(distance / .09);
  dx = dx / len * distance / n; dz = dz / len * distance / n;
  const before = { ...s.player };
  for (let i = 0; i < n; i++) {
    const px = { x: s.player.x + dx, z: s.player.z };
    if (free(px, s)) s.player.x = px.x;
    const pz = { x: s.player.x, z: s.player.z + dz };
    if (free(pz, s)) s.player.z = pz.z;
  }
  return Math.hypot(s.player.x - before.x, s.player.z - before.z) > .001;
}
export function clearGate(s) {
  if (s.power && inside(s.player, GATE, RULES.radius + .05)) s.player.x = s.player.x <= 4 ? 3.42 : 4.58;
}
export function visible(a, b, s) {
  // Sample a short segment against walls/door, not the target's own housing.
  const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .06);
  const blockers = s.power && b.id !== 'gate' ? [...WALLS, GATE] : WALLS;
  for (let i = 1; i < n; i++) {
    const p = { x: a.x + (b.x - a.x) * i / n, z: a.z + (b.z - a.z) * i / n };
    if (blockers.some(w => inside(p, w, .015))) return false;
  }
  return true;
}
