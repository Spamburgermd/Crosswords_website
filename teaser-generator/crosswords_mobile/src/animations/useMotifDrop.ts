/**
 * src/animations/useMotifDrop.ts
 * --------------------------------
 * React hook driving the motif-drop celebration animation.
 * Uses react-native-reanimated shared values + useFrameCallback
 * so all physics run on the UI thread.
 */

import { useCallback, useState } from 'react';
import {
  runOnJS,
  runOnUI,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';

import {
  DROP_ACCEL,
  FLASH_DECAY,
  INITIAL_BOUNCE_VEL,
  MAX_PARTICLES,
  PARTICLE_STRIDE,
  SHAKE_DECAY_RATE,
  SPARK_OFFSET_X,
  SPARK_OFFSET_Y,
  getMotifAlpha,
  getMotifSize,
  spawnParticles,
  updateParticles,
  updateSpring,
} from './motifDropWorklets';

// Phase constants
const PHASE_IDLE = 0;
const PHASE_FALLING = 1;
const PHASE_BOUNCING = 2;
const PHASE_DONE = 3;

export function useMotifDrop() {
  // JS-thread flag for conditional rendering of the Skia canvas
  const [isAnimating, setIsAnimating] = useState(false);

  // ── Shared values ────────────────────────────────────────────────
  const phase = useSharedValue(PHASE_IDLE);

  // Target position (absolute screen coords)
  const targetX = useSharedValue(0);
  const targetY = useSharedValue(0);
  const finalSize = useSharedValue(40);

  // Container dimensions (set by overlay onLayout)
  const containerWidth = useSharedValue(0);
  const containerHeight = useSharedValue(0);
  // Overlay screen position — subtracted from target coords so the motif
  // lands at the right spot even when the overlay doesn't start at screen (0,0).
  const containerScreenX = useSharedValue(0);
  const containerScreenY = useSharedValue(0);

  // Drop phase
  const dropProgress = useSharedValue(0);
  const dropSpeed = useSharedValue(0);

  // Rendered motif state
  const motifSize = useSharedValue(0);
  const motifAlpha = useSharedValue(0);

  // Bounce phase
  const bounceOffset = useSharedValue(0);
  const bounceVel = useSharedValue(0);

  // Flash
  const flashOpacity = useSharedValue(0);

  // Screen shake
  const shakeX = useSharedValue(0);
  const shakeY = useSharedValue(0);
  const shakeDecay = useSharedValue(0);

  // Particles: flat array + count
  const particles = useSharedValue<number[]>([]);
  const particleCount = useSharedValue(0);

  // ── Frame callback ───────────────────────────────────────────────
  useFrameCallback((frameInfo) => {
    'worklet';
    if (phase.value === PHASE_IDLE || phase.value === PHASE_DONE) return;

    const dt = Math.min((frameInfo.timeSincePreviousFrame ?? 16) / 1000, 0.05);
    const cw = containerWidth.value;
    const ch = containerHeight.value;
    const fs = finalSize.value;
    const scale = cw > 0 ? cw / 680 : 1;

    // ── Falling ──────────────────────────────────────────────────
    if (phase.value === PHASE_FALLING) {
      dropSpeed.value += DROP_ACCEL * dt;
      dropProgress.value += dropSpeed.value * dt;

      const startSize = Math.min(cw, ch) * 0.95;
      motifSize.value = getMotifSize(
        dropProgress.value,
        0,
        startSize,
        fs,
      );
      motifAlpha.value = getMotifAlpha(dropProgress.value);

      if (dropProgress.value >= 1) {
        dropProgress.value = 1;
        phase.value = PHASE_BOUNCING;

        // Spark origin — overlay-relative so particles land in canvas space
        const sparkX = targetX.value - containerScreenX.value + SPARK_OFFSET_X * fs;
        const sparkY = targetY.value - containerScreenY.value + SPARK_OFFSET_Y * fs;

        // Spawn particles
        const spawned = spawnParticles(scale, sparkX, sparkY);
        particles.value = spawned;
        particleCount.value = Math.floor(
          spawned.length / PARTICLE_STRIDE,
        );

        // Flash
        flashOpacity.value = 1.0;

        // Shake
        shakeX.value = (Math.random() - 0.5) * 10 * scale;
        shakeY.value = (Math.random() - 0.5) * 7 * scale;
        shakeDecay.value = 1;

        // Bounce
        bounceVel.value = INITIAL_BOUNCE_VEL;
        bounceOffset.value = 0;

        // Snap motif to final size
        motifSize.value = fs;
        motifAlpha.value = 1;
      }
    }

    // ── Bouncing ─────────────────────────────────────────────────
    if (phase.value === PHASE_BOUNCING) {
      const [newOff, newVel, settled] = updateSpring(
        bounceOffset.value,
        bounceVel.value,
        dt,
      );
      bounceOffset.value = newOff;
      bounceVel.value = newVel;

      const startSize = Math.min(cw, ch) * 0.95;
      motifSize.value = getMotifSize(1, bounceOffset.value, startSize, fs);

      if (settled) {
        motifSize.value = fs;
      }
    }

    // ── Particles ────────────────────────────────────────────────
    if (particleCount.value > 0) {
      // Mutate the array in place then truncate to alive length.
      // Previous approach called .slice() every frame, allocating a
      // full 560-element array 60x/s which caused GC jank.
      const arr = particles.value;
      const newCount = updateParticles(
        arr,
        particleCount.value,
        dt,
        scale,
      );
      // Truncate to alive entries so the reference changes for Reanimated
      // change detection, but only copies the live portion.
      const aliveLen = newCount * PARTICLE_STRIDE;
      particles.value = aliveLen < arr.length ? arr.slice(0, aliveLen) : arr.slice();
      particleCount.value = newCount;
    }

    // ── Flash decay ──────────────────────────────────────────────
    if (flashOpacity.value > 0) {
      flashOpacity.value = Math.max(0, flashOpacity.value - dt * FLASH_DECAY);
    }

    // ── Shake decay ──────────────────────────────────────────────
    if (shakeDecay.value > 0) {
      shakeDecay.value = Math.max(
        0,
        shakeDecay.value - dt * SHAKE_DECAY_RATE,
      );
    }

    // ── Check if done ────────────────────────────────────────────
    const springSettled =
      phase.value !== PHASE_BOUNCING ||
      (Math.abs(bounceOffset.value) < 0.003 &&
        Math.abs(bounceVel.value) < 0.03);
    const allDone =
      springSettled &&
      particleCount.value === 0 &&
      flashOpacity.value <= 0 &&
      shakeDecay.value <= 0;

    if (allDone && phase.value === PHASE_BOUNCING) {
      phase.value = PHASE_DONE;
      runOnJS(setIsAnimating)(false);
    }
  });

  // ── Trigger (callable from JS thread) ──────────────────────────
  const trigger = useCallback(
    (absX: number, absY: number, tileSize: number, delayMs = 0) => {
      setIsAnimating(true); // pre-warm immediately so overlay mounts before any flip starts
      const fire = () => runOnUI(() => {
        'worklet';
        targetX.value = absX;
        targetY.value = absY;
        finalSize.value = tileSize;

        dropProgress.value = 0;
        dropSpeed.value = 0.25; // initial speed like HTML prototype
        bounceOffset.value = 0;
        bounceVel.value = 0;
        flashOpacity.value = 0;
        shakeDecay.value = 0;
        particles.value = [];
        particleCount.value = 0;
        motifSize.value = 0;
        motifAlpha.value = 0; // invisible at start — getMotifAlpha handles the fade-in curve

        phase.value = PHASE_FALLING;
      })();
      if (delayMs > 0) {
        setTimeout(fire, delayMs);
      } else {
        fire();
      }
    },
    [],
  );

  return {
    trigger,
    isAnimating,
    // Shared values for overlay rendering
    phase,
    targetX,
    targetY,
    finalSize,
    motifSize,
    motifAlpha,
    flashOpacity,
    shakeX,
    shakeY,
    shakeDecay,
    particles,
    particleCount,
    containerWidth,
    containerHeight,
    containerScreenX,
    containerScreenY,
  };
}
