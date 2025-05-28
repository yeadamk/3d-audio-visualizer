import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export default class Camera {
  public readonly camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;

  constructor(config: {
    fov: number;
    near: number;
    far: number;
    position: [number, number, number];
    minDistance: number;
    maxDistance: number;
  }, domElement: HTMLElement) {
    const [x, y, z] = config.position;
    this.camera = new THREE.PerspectiveCamera(config.fov, window.innerWidth / window.innerHeight, config.near, config.far);
    this.camera.position.set(x, y, z);

    this.controls = new OrbitControls(this.camera, domElement);
    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = true;
    this.controls.minDistance = config.minDistance;
    this.controls.maxDistance = config.maxDistance;
  }

  update() {
    this.controls.update();
  }
}
