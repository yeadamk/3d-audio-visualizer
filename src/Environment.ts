import * as THREE from 'three';
import vertexSrc from '@/shaders/vertex.glsl';
import fragmentSrc from '@/shaders/fragment.glsl';



export default class Environment{
  public readonly uniforms: Record<string, { value: number }>;
  private mesh: THREE.Mesh;

    constructor(scene: THREE.Scene, config:{
        length:     number;
        height:      number;
        segments:   number;
    }) {
        this.uniforms = {
            u_time: {value: 0.0},
            u_frequency: {value: 0.0},
        };

        const material = new THREE.ShaderMaterial({
      uniforms:       this.uniforms,
      vertexShader:   vertexSrc,
      fragmentShader: fragmentSrc,
      transparent:    false,
      blending:       THREE.AdditiveBlending,
      depthWrite:     false,
    });
    console.log("guugaog");
    const geometry = new THREE.PlaneGeometry(
        config.length,
        config.height,
        config.segments,
        config.segments
    );
    this.mesh = new THREE.Mesh(geometry,material); 
    this.mesh.matrixAutoUpdate = false;
    scene.add(this.mesh);
    }

    update(time: number, freq: number){
        return;
    }






}