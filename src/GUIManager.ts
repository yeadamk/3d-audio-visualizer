import { GUI } from 'dat.gui';
import type { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export default class GUIManager {
  private uniforms: Record<string, { value: number }>;
  private bloomPass: UnrealBloomPass;
  private params: {
    red: number;
    green: number;
    blue: number;
    threshold: number;
    strength: number;
    radius: number;
  };

  constructor(
    uniforms: Record<string, { value: number }>,
    bloomPass: UnrealBloomPass,
    config: {
      bloom: { threshold: number; strength: number; radius: number };
    }
  ) {
    this.uniforms = uniforms;
    this.bloomPass = bloomPass;
    this.params = {
      red:       1,
      green:     1,
      blue:      1,
      threshold: config.bloom.threshold,
      strength:  config.bloom.strength,
      radius:    config.bloom.radius,
    };
  }

  setup() {
    const gui = new GUI();
    gui.add(this.params, 'red', 0, 1)
       .onChange(v => this.uniforms.u_red.value = v);
    gui.add(this.params, 'green', 0, 1)
       .onChange(v => this.uniforms.u_green.value = v);
    gui.add(this.params, 'blue', 0, 1)
       .onChange(v => this.uniforms.u_blue.value = v);

    const bloom = gui.addFolder('Bloom');
    bloom.add(this.params, 'threshold', 0, 1)
         .onChange(v => this.bloomPass.threshold = v);
    bloom.add(this.params, 'strength', 0, 3)
         .onChange(v => this.bloomPass.strength = v);
    bloom.add(this.params, 'radius', 0, 1)
         .onChange(v => this.bloomPass.radius = v);
  }
}
