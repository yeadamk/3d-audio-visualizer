import type Renderer from '@/Renderer';
import type Camera from '@/Camera';

export default class ResizeHandler {
  constructor(private renderer: Renderer, private camera: Camera) {}

  listen() {
    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.camera.aspect = w / h;
      this.camera.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
  }
}
