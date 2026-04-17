/**
 * src/animations/motifDropWorklets.ts
 * ------------------------------------
 * Pure worklet functions for the motif-drop celebration animation.
 * All exported functions carry the 'worklet' directive so they run
 * on the UI thread via react-native-reanimated.
 */

// ── Constants ────────────────────────────────────────────────────────
export const TARGET_PX = 40;
export const SPARK_OFFSET_X = -0.32; // left along blade edge
export const SPARK_OFFSET_Y = -0.28; // above center along blade edge
export const GRAVITY = 16;
export const DRAG = 0.982;
export const DROP_ACCEL = 2.8;
export const SPRING_K = 40;
export const SPRING_DAMP = 0.90;
export const FLASH_DECAY = 3;
export const SHAKE_DECAY_RATE = 4.5;
export const INITIAL_BOUNCE_VEL = 0.6;

// Particle stride: [x, y, vx, vy, life, maxLife, size, type]
// type: 0=regular, 1=bright, 2=ember
export const PARTICLE_STRIDE = 8;
export const MAX_PARTICLES = 70;

// ── Drop / Motif size ────────────────────────────────────────────────

export function getMotifSize(
  dropProgress: number,
  bounceOffset: number,
  startSize: number,
  endSize: number,
): number {
  'worklet';
  const p = Math.min(1, Math.max(0, dropProgress));
  const eased = p * p; // quadratic ease-in
  const currentSize = startSize - (startSize - endSize) * eased;
  return currentSize + bounceOffset * endSize;
}

export function getMotifAlpha(dropProgress: number): number {
  'worklet';
  const p = Math.min(1, Math.max(0, dropProgress));
  // Invisible for first 10% of drop — motif is nowhere.
  if (p < 0.1) return 0;
  // Fully opaque from 70% onward — sharp and solid before impact.
  if (p >= 0.7) return 1;
  // 10%–70%: ease-out ramp (fast rise, levels off). Ghosts in from nowhere.
  const t = (p - 0.1) / 0.6;        // remap 0.1..0.7 → 0..1
  return 1 - (1 - t) * (1 - t);      // quadratic ease-out
}

// ── Particle spawning ────────────────────────────────────────────────

export function spawnParticles(
  scale: number,
  sparkX: number,
  sparkY: number,
): number[] {
  'worklet';
  const arr: number[] = [];
  // Main sparks: 40-60
  const mainCount = 40 + Math.floor(Math.random() * 20);
  for (let i = 0; i < mainCount; i++) {
    const angle = (Math.random() - 0.5) * Math.PI * 2;
    const speed = (3 + Math.random() * 7) * scale;
    const life = 0.12 + Math.random() * 0.28;
    arr.push(
      sparkX + (Math.random() - 0.5) * 8 * scale, // x
      sparkY + (Math.random() - 0.5) * 8 * scale, // y
      Math.cos(angle) * speed,                      // vx
      Math.sin(angle) * speed - Math.random() * 3 * scale, // vy (upward bias)
      life,                                          // life
      life,                                          // maxLife
      (0.5 + Math.random() * 2.5) * scale,          // size
      Math.random() > 0.5 ? 1 : 0,                  // type: bright or regular
    );
  }
  // Embers: 10
  for (let j = 0; j < 10; j++) {
    const a2 = Math.random() * Math.PI * 2;
    const sp2 = (0.3 + Math.random() * 1.5) * scale;
    const life2 = 0.35 + Math.random() * 0.25;
    arr.push(
      sparkX + (Math.random() - 0.5) * 4 * scale,
      sparkY + (Math.random() - 0.5) * 4 * scale,
      Math.cos(a2) * sp2,
      Math.sin(a2) * sp2 - 0.4 * scale,
      life2,
      0.6, // maxLife for embers
      (1 + Math.random() * 1.5) * scale,
      2, // type: ember
    );
  }
  return arr;
}

// ── Particle update ──────────────────────────────────────────────────

/** Updates particles in-place, returns new alive count. */
export function updateParticles(
  arr: number[],
  count: number,
  dt: number,
  scale: number,
): number {
  'worklet';
  const grav = GRAVITY * scale;
  let alive = 0;
  for (let i = 0; i < count; i++) {
    const base = i * PARTICLE_STRIDE;
    let life = arr[base + 4];
    life -= dt;
    if (life <= 0) continue;
    // Update velocity
    arr[base + 3] += grav * dt; // vy += gravity
    arr[base + 2] *= DRAG;      // vx drag
    arr[base + 3] *= DRAG;      // vy drag
    // Update position
    arr[base + 0] += arr[base + 2]; // x += vx
    arr[base + 1] += arr[base + 3]; // y += vy
    arr[base + 4] = life;
    // Compact: copy to alive position
    if (alive !== i) {
      for (let k = 0; k < PARTICLE_STRIDE; k++) {
        arr[alive * PARTICLE_STRIDE + k] = arr[base + k];
      }
    }
    alive++;
  }
  return alive;
}

// ── Particle color ───────────────────────────────────────────────────

/** Returns [r, g, b, a] for a particle given its type and life fraction. */
export function getParticleColor(
  type: number,
  lifeFrac: number,
): [number, number, number, number] {
  'worklet';
  if (type === 2) {
    // ember: glowing orange
    return [255, Math.round(85 + lifeFrac * 70), 12, lifeFrac * 0.6];
  }
  if (type === 1) {
    // bright: white-hot → amber
    return [
      255,
      Math.round(230 + lifeFrac * 25),
      Math.round(185 + lifeFrac * 65),
      lifeFrac,
    ];
  }
  // regular: amber → orange
  return [
    255,
    Math.round(140 + lifeFrac * 80),
    Math.round(25 + lifeFrac * 55),
    lifeFrac * 0.8,
  ];
}

// ── Spring bounce ────────────────────────────────────────────────────

/** Returns [newOffset, newVel, settled]. */
export function updateSpring(
  offset: number,
  vel: number,
  dt: number,
): [number, number, boolean] {
  'worklet';
  const newOffset = offset + vel * dt;
  let newVel = vel - newOffset * SPRING_K * dt;
  newVel *= SPRING_DAMP;
  const settled =
    Math.abs(newOffset) < 0.003 && Math.abs(newVel) < 0.03;
  return [settled ? 0 : newOffset, settled ? 0 : newVel, settled];
}
