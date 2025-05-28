import * as THREE from 'three';

export default class SceneSetup {
  public readonly scene: THREE.Scene;

  constructor(backgroundColor: number) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(backgroundColor);
  }
}
