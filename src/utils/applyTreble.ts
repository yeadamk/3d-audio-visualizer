import * as THREE from 'three';

export function applyTrebleBumps(
  posAttr: THREE.BufferAttribute,
  originalPositions: Float32Array,
  tr: number,
  N: number
): void {
  const updated = posAttr.array as Float32Array;

  if (tr > 0.4) {
    for (let i = 0; i < N; i++) {
      if (Math.random() < tr * 0.2) {
        const idx = i * 3;
        const scale = 20.0 + tr * 2.5;
        updated[idx]     = originalPositions[idx]     * scale;
        updated[idx + 1] = originalPositions[idx + 1] * scale;
        updated[idx + 2] = originalPositions[idx + 2] * scale;
      }
    }
  } else {
    for (let i = 0; i < updated.length; i++) {
      updated[i] += (originalPositions[i] - updated[i]) * 0.2;
    }
  }

  posAttr.needsUpdate = true;
}
