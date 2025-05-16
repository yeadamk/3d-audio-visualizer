import * as THREE from 'three';
import vertexSrc from '@/shaders/vertex.glsl';
import fragmentSrc from '@/shaders/fragment.glsl';
import {
  translationMatrix,
  rotationMatrixY,
  rotationMatrixZ,
  scaleMatrix,
  shearMatrix
} from '@/utils/matrixUtils';

export default class ShaderSphere {
  public readonly uniforms: Record<string, { value: number }>;
  private mesh: THREE.Mesh;

  constructor(scene: THREE.Scene, config: {
    radius: number;
    widthSegments: number;
    heightSegments: number;
  }) {
    this.uniforms = {
      u_time:      { value: 0.0 },
      u_frequency: { value: 0.0 },
      u_red:       { value: 1.0 },
      u_green:     { value: 1.0 },
      u_blue:      { value: 1.0 },
    };

    const material = new THREE.ShaderMaterial({
      uniforms:       this.uniforms,
      vertexShader:   vertexSrc,
      fragmentShader: fragmentSrc,
      transparent:    true,
      blending:       THREE.AdditiveBlending,
      depthWrite:     false,
    });

    const geo = new THREE.SphereGeometry(
      config.radius,
      config.widthSegments,
      config.heightSegments
    );
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.matrixAutoUpdate = false;
    scene.add(this.mesh);
  }

  update(time: number, freq: number) {
    this.uniforms.u_time.value      = time;
    this.uniforms.u_frequency.value = freq;
    const f = freq / 256;
    let M = new THREE.Matrix4();

    if (freq < 85) {
      const s = 1 + f;
      M.multiply(scaleMatrix(s, s, s));
    } else if (freq < 170) {
      const sh = 0.7 * Math.sin(time);
      M.multiply(shearMatrix(0, sh, sh, 0, 0, sh));
    } else {
      M.multiply(rotationMatrixY(time * 0.5))
       .multiply(rotationMatrixZ(time * 0.3))
       .multiply(translationMatrix(Math.sin(time) * 0.5, 0, 0));
    }

    this.mesh.matrix.copy(M);
  }
}
