/**
 * src/components/MotifDropOverlay.tsx
 * -------------------------------------
 * Full-screen Skia canvas that renders the motif-drop celebration:
 * falling motif image, impact flash, and spark particles.
 * All values are driven by shared values from useMotifDrop.
 */

import React, { useCallback, useRef } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Image as SkiaImage,
  Line,
  RadialGradient,
  Rect,
  useImage,
  vec,
} from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';
import { runOnUI, useDerivedValue } from 'react-native-reanimated';

import {
  MAX_PARTICLES,
  PARTICLE_STRIDE,
  SPARK_OFFSET_X,
  SPARK_OFFSET_Y,
  getParticleColor,
} from '../animations/motifDropWorklets';

type MotifDropOverlayProps = {
  isAnimating: boolean;
  targetX: SharedValue<number>;
  targetY: SharedValue<number>;
  finalSize: SharedValue<number>;
  motifSize: SharedValue<number>;
  motifAlpha: SharedValue<number>;
  flashOpacity: SharedValue<number>;
  particles: SharedValue<number[]>;
  particleCount: SharedValue<number>;
  containerWidth: SharedValue<number>;
  containerHeight: SharedValue<number>;
  containerScreenX: SharedValue<number>;
  containerScreenY: SharedValue<number>;
  onLayout: (e: LayoutChangeEvent) => void;
};

const MOTIF_ASSET = require('../../assets/design/icons/CWMotifRed.png');

/** A single particle slot: rect body + optional streak trail. */
function ParticleSlot({
  index,
  particles,
  particleCount,
}: {
  index: number;
  particles: SharedValue<number[]>;
  particleCount: SharedValue<number>;
}) {
  const rectProps = useDerivedValue(() => {
    if (index >= particleCount.value) return { x: 0, y: 0, width: 0, height: 0 };
    const base = index * PARTICLE_STRIDE;
    const arr = particles.value;
    const x = arr[base];
    const y = arr[base + 1];
    const life = arr[base + 4];
    const maxLife = arr[base + 5];
    const size = arr[base + 6];
    const frac = maxLife > 0 ? life / maxLife : 0;
    const s = size * (0.25 + frac * 0.75);
    return { x: x - s / 2, y: y - s / 2, width: s, height: s };
  });

  const rectColor = useDerivedValue(() => {
    if (index >= particleCount.value) return 'transparent';
    const base = index * PARTICLE_STRIDE;
    const arr = particles.value;
    const life = arr[base + 4];
    const maxLife = arr[base + 5];
    const type = arr[base + 7];
    const frac = maxLife > 0 ? life / maxLife : 0;
    const [r, g, b, a] = getParticleColor(type, frac);
    return `rgba(${r},${g},${b},${a})`;
  });

  // Streak trail endpoints
  const trailP1 = useDerivedValue(() => {
    if (index >= particleCount.value) return vec(0, 0);
    const base = index * PARTICLE_STRIDE;
    const arr = particles.value;
    return vec(arr[base], arr[base + 1]);
  });

  const trailP2 = useDerivedValue(() => {
    if (index >= particleCount.value) return vec(0, 0);
    const base = index * PARTICLE_STRIDE;
    const arr = particles.value;
    const x = arr[base];
    const y = arr[base + 1];
    const vx = arr[base + 2];
    const vy = arr[base + 3];
    const type = arr[base + 7];
    if (type === 2) return vec(x, y); // no trail for embers
    const vel = Math.sqrt(vx * vx + vy * vy);
    const sLen = vel * 1.8;
    if (sLen < 0.5) return vec(x, y);
    const ang = Math.atan2(vy, vx);
    return vec(x - Math.cos(ang) * sLen, y - Math.sin(ang) * sLen);
  });

  const trailColor = useDerivedValue(() => {
    if (index >= particleCount.value) return 'transparent';
    const base = index * PARTICLE_STRIDE;
    const arr = particles.value;
    const type = arr[base + 7];
    if (type === 2) return 'transparent'; // no trail for embers
    const life = arr[base + 4];
    const maxLife = arr[base + 5];
    const frac = maxLife > 0 ? life / maxLife : 0;
    const [r, g, b, a] = getParticleColor(type, frac);
    return `rgba(${r},${g},${b},${a * 0.35})`;
  });

  const trailWidth = useDerivedValue(() => {
    if (index >= particleCount.value) return 0;
    const base = index * PARTICLE_STRIDE;
    const arr = particles.value;
    const life = arr[base + 4];
    const maxLife = arr[base + 5];
    const size = arr[base + 6];
    const frac = maxLife > 0 ? life / maxLife : 0;
    const s = size * (0.25 + frac * 0.75);
    return s * 0.3;
  });

  return (
    <>
      <Rect rect={rectProps} color={rectColor} />
      <Line p1={trailP1} p2={trailP2} color={trailColor} strokeWidth={trailWidth} />
    </>
  );
}

// Pre-allocate particle slot indices
const PARTICLE_INDICES = Array.from({ length: MAX_PARTICLES }, (_, i) => i);

export default function MotifDropOverlay({
  isAnimating,
  targetX,
  targetY,
  finalSize,
  motifSize,
  motifAlpha,
  flashOpacity,
  particles,
  particleCount,
  containerWidth,
  containerHeight,
  containerScreenX,
  containerScreenY,
  onLayout,
}: MotifDropOverlayProps) {
  const motifImage = useImage(MOTIF_ASSET);
  const overlayRef = useRef<View>(null);

  // Measure the overlay's absolute screen position so we can convert
  // screen-space target coords to canvas-local coords.
  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    onLayout(e);
    overlayRef.current?.measureInWindow((x, y) => {
      if (x != null && y != null) {
        runOnUI(() => {
          'worklet';
          containerScreenX.value = x;
          containerScreenY.value = y;
        })();
      }
    });
  }, [onLayout, containerScreenX, containerScreenY]);

  // ── Derived values for Skia ──────────────────────────────────────

  const motifTransform = useDerivedValue(() => {
    const sz = motifSize.value;
    // Convert absolute screen coords to overlay-local canvas coords
    const tx = targetX.value - containerScreenX.value;
    const ty = targetY.value - containerScreenY.value;
    return [
      { translateX: tx - sz / 2 },
      { translateY: ty - sz / 2 },
    ];
  });

  const motifRect = useDerivedValue(() => {
    const sz = motifSize.value;
    return { x: 0, y: 0, width: sz, height: sz };
  });

  const motifOpacity = useDerivedValue(() => motifAlpha.value);

  // Flash center (spark origin point) — also overlay-relative
  const flashCenter = useDerivedValue(() => {
    const fs = finalSize.value;
    return vec(
      targetX.value - containerScreenX.value + SPARK_OFFSET_X * fs,
      targetY.value - containerScreenY.value + SPARK_OFFSET_Y * fs,
    );
  });

  const flashRadius = useDerivedValue(() => {
    const cw = containerWidth.value;
    const scale = cw > 0 ? cw / 680 : 1;
    return Math.max(0.1, flashOpacity.value * 40 * scale);
  });

  const flashAlpha = useDerivedValue(() => flashOpacity.value * 0.85);

  // Always keep the overlay mounted to avoid the cost of mounting 70+ Skia
  // particle nodes mid-animation. When idle, the canvas is invisible (opacity 0)
  // and non-interactive, so it has near-zero rendering cost.
  return (
    <View
      ref={overlayRef}
      style={[styles.overlay, !isAnimating && styles.hidden]}
      onLayout={handleLayout}
      pointerEvents="none"
    >
      <Canvas style={StyleSheet.absoluteFill}>
        {/* ── Motif image ──────────────────────────────────────── */}
        {motifImage && (
          <Group transform={motifTransform} opacity={motifOpacity}>
            <SkiaImage
              image={motifImage}
              rect={motifRect}
              fit="contain"
            />
            <Rect rect={motifRect} color="#E7131A" blendMode="srcIn" />
          </Group>
        )}

        {/* ── Impact flash ─────────────────────────────────────── */}
        <Circle c={flashCenter} r={flashRadius} opacity={flashAlpha}>
          <RadialGradient
            c={flashCenter}
            r={flashRadius}
            colors={[
              'rgba(255,255,230,1)',
              'rgba(255,200,120,0.4)',
              'rgba(255,150,50,0)',
            ]}
            positions={[0, 0.4, 1]}
          />
        </Circle>

        {/* ── Spark particles ──────────────────────────────────── */}
        <Group blendMode="plus">
          {PARTICLE_INDICES.map((i) => (
            <ParticleSlot
              key={i}
              index={i}
              particles={particles}
              particleCount={particleCount}
            />
          ))}
        </Group>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  hidden: {
    opacity: 0,
  },
});
