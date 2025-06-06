import * as THREE from 'three';
import Renderer      from '@/Renderer';
import SceneSetup    from '@/SceneSetup';
import Camera        from '@/Camera';
import AudioManager  from '@/AudioManager';
import ShaderSphere  from '@/ShaderSphere';
import Environment   from '@/Environment';
import ParticleField from '@/ParticleField';
import GUIManager    from '@/GUIManager';
import ResizeHandler from '@/ResizeHandler';

export interface AppConfig {
  renderer: any;
  camera: any;
  bloom: any;
  audio: any;
  mesh: any;
  particles: any;
}

export default class App {
  private config: AppConfig;
  private sceneKit!: SceneSetup;
  private camera!: Camera;
  private renderer!: Renderer;
  private audio!: AudioManager;
  private sphere!: ShaderSphere;
  private env!: Environment;
  private particles!: ParticleField;
  private gui!: GUIManager;
  private resizer!: ResizeHandler;
  private clock!: THREE.Clock;

  constructor(container: HTMLElement, config: AppConfig) {
    this.config   = config;
    this.sceneKit = new SceneSetup(config.renderer.background);
    this.camera   = new Camera(config.camera, container);
    this.renderer = new Renderer(container, config.renderer, config.bloom);
    this.renderer.setSceneCamera(this.sceneKit.scene, this.camera.camera);
    this.audio    = new AudioManager(this.camera.camera, config.audio);
    this.sphere   = new ShaderSphere(this.sceneKit.scene, config.mesh);
    this.env      = new Environment(this.sceneKit.scene, {   length: 10,
    height: 10,
    segments: 32,});
    this.particles= new ParticleField(this.sceneKit.scene, config.particles);
    this.gui      = new GUIManager(this.sphere.uniforms, this.renderer.bloomPass, config);
    this.resizer  = new ResizeHandler(this.renderer, this.camera);
    this.clock    = new THREE.Clock();

  }

  public init(): void {
    this.audio.loadDefault();
    const fileInput = document.querySelector<HTMLInputElement>('#audioUpload');
    if (fileInput) {
      this.audio.enableUpload(fileInput);
    }
    this.gui.setup();
    this.resizer.listen();
  }

  public start(): void {
    const tick = (): void => {
      requestAnimationFrame(tick);
      const t = this.clock.getElapsedTime();
      const freq = this.audio.getFrequency();
      this.camera.update();
      this.sphere.update(t, freq);
      this.particles.update(freq);
      console.log("what")
      this.env.update(t, freq);
      this.renderer.render();
    };
    tick();
  }
}
