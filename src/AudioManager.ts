import * as THREE from 'three';

export default class AudioManager {
  private listener: THREE.AudioListener;
  private sound: THREE.Audio;
  private analyser: THREE.AudioAnalyser;
  private loader: THREE.AudioLoader;
  private defaultPath: string;

  constructor(camera: THREE.Camera, config: { defaultPath: string; analyserBands: number }) {
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);

    this.sound = new THREE.Audio(this.listener);
    this.analyser = new THREE.AudioAnalyser(this.sound, config.analyserBands);
    this.loader = new THREE.AudioLoader();
    this.defaultPath = config.defaultPath;
  }

  loadDefault(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.loader.load(this.defaultPath, buffer => {
        this.sound.setBuffer(buffer);
        window.addEventListener('click', () => {
          if (!this.sound.isPlaying) this.sound.play();
        }, { once: true });
        resolve();
      }, undefined, reject);
    });
  }

  enableUpload(input: HTMLInputElement) {
    input.addEventListener('change', e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const arrayBuffer = reader.result as ArrayBuffer;
        const audioCtx = THREE.AudioContext.getContext();
        audioCtx.decodeAudioData(arrayBuffer, decoded => {
          this.sound.stop();
          this.sound.setBuffer(decoded);
          this.analyser = new THREE.AudioAnalyser(this.sound, this.analyser.analyser.fftSize);
          this.sound.play();
        });
      };
      reader.readAsArrayBuffer(file);
    });
  }

  getFrequency(): number {
    return this.analyser.getAverageFrequency() || 0;
  }

  getFrequencyData(){
    return this.analyser.getFrequencyData();
  }
}
