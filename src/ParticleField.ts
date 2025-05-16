import * as THREE from 'three';

export default class ParticleField {
  private points: THREE.Points;
  private material: THREE.PointsMaterial;

  constructor(scene: THREE.Scene, config: {
    count: number;
    spread: number;
    scale: number;
    baseSize: number;
  }) {
    const positions = Array.from({ length: config.count }, () =>
      new THREE.Vector3(
        (Math.random() - 0.5) * config.spread,
        (Math.random() - 0.5) * config.spread,
        (Math.random() - 0.5) * config.spread
      )
    );
    const geo = new THREE.BufferGeometry().setFromPoints(positions);
    this.material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: config.baseSize,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.scale.setScalar(config.scale);
    scene.add(this.points);
  }

  update(freq: number) {
    const f = freq / 256;
    this.points.rotation.y += 0.002;
    this.material.size = 0.05 + f * 0.3;
  }
}
