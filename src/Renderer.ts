import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export default class Renderer {
  public readonly bloomPass: UnrealBloomPass;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private renderPass: RenderPass;

  constructor(container: HTMLElement, config: { antialias: boolean }, bloomConfig: { threshold: number; strength: number; radius: number }) {
    this.renderer = new THREE.WebGLRenderer({ antialias: config.antialias });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(null as any, null as any);
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      bloomConfig.strength, bloomConfig.radius, bloomConfig.threshold
    );
    const outputPass = new OutputPass();

    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(outputPass);
  }

  setSceneCamera(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
  }

  render() {
    this.composer.render();
  }

  setSize(width: number, height: number) {
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
    this.bloomPass.setSize(width, height);
  }
}
