export function applyTrebleBumps(
  particlePositions: Float32Array,
  originalParticlePositions: Float32Array,
  tr: number,
  N: number
): void {
  if (tr > 0.4) {
    for (let i = 0; i < N; i++) {
      if (Math.random() < tr * 0.3) {
        const idx = 3 * i;
        const scale = 0.5 + tr * 2.0;
        particlePositions[idx + 0] = originalParticlePositions[idx + 0] * scale;
        particlePositions[idx + 1] = originalParticlePositions[idx + 1] * scale;
        particlePositions[idx + 2] = originalParticlePositions[idx + 2] * scale;
      }
    }
  } else {
    for (let i = 0; i < N * 3; i++) {
      particlePositions[i] += (originalParticlePositions[i] - particlePositions[i]) * 0.25;
    }
  }
}