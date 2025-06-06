// === Imports ===
import * as THREE from 'three';
import { GUI } from 'dat.gui';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { applyTrebleBumps } from './utils/applyTreble';

// === Setup ===
const renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene: THREE.Scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 10);
camera.lookAt(0, 0, 0);

const controls: OrbitControls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.minDistance = 5;
controls.maxDistance = 30;

// === Audio Setup ===
const listener: THREE.AudioListener = new THREE.AudioListener();
camera.add(listener);
let sound: THREE.Audio = new THREE.Audio(listener);
let micStream: MediaStream | null = null;
let micSource: THREE.Audio | null = null;
let analyser: THREE.AudioAnalyser = new THREE.AudioAnalyser(sound, 32);

const fileInput = document.getElementById('audioUpload') as HTMLInputElement;
const audioRadios = document.getElementsByName('audioSource') as NodeListOf<HTMLInputElement>;

function setupFileUpload(): void {
  fileInput.disabled = false;
  if (micStream) {
    micStream.getTracks().forEach(track => track.stop());
    micStream = null;
  }
  if (micSource) {
    micSource.disconnect();
    micSource = null;
  }
  fileInput.addEventListener('change', (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const audioContext = THREE.AudioContext.getContext();
      audioContext.decodeAudioData(arrayBuffer, (decodedData) => {
        if (sound && sound.isPlaying) sound.stop();
        sound = new THREE.Audio(listener);
        sound.setBuffer(decodedData);
        analyser = new THREE.AudioAnalyser(sound, 32);
        sound.play();
      });
    };
    reader.readAsArrayBuffer(file);
  });
}

function setupMicrophoneInput(): void {
  if (sound && sound.isPlaying) sound.stop();
  navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
    micStream = stream;
    micSource = new THREE.Audio(listener);
    micSource.setMediaStreamSource(stream);
    analyser = new THREE.AudioAnalyser(micSource, 32);
  }).catch((err) => {
    alert('Microphone access denied or not available.');
    console.error(err);
  });
}

audioRadios.forEach(radio => radio.addEventListener('change', updateAudioSource));
function updateAudioSource(): void {
  const selected = Array.from(audioRadios).find(r => r.checked)?.value;
  selected === 'mic' ? setupMicrophoneInput() : setupFileUpload();
}
updateAudioSource();

// === Clock ===

const clock: THREE.Clock = new THREE.Clock();

// === Particle Sphere Setup ===
const N = 1000;
const radius = 2;
const positions: number[] = [];
for (let i = 0; i < N; i++) {
  const theta = Math.acos(2 * Math.random() - 1);
  const phi = 2 * Math.PI * Math.random();
  positions.push(
    radius * Math.sin(theta) * Math.cos(phi),
    radius * Math.sin(theta) * Math.sin(phi),
    radius * Math.cos(theta)
  );
}
const originalPositions = new Float32Array(positions);



const particleGeometry: THREE.BufferGeometry = new THREE.BufferGeometry();
particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
const particleMaterial: THREE.PointsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.05, transparent: true, blending: THREE.AdditiveBlending });
const sphericalParticles: THREE.Points = new THREE.Points(particleGeometry, particleMaterial);
const particleGroup: THREE.Object3D = new THREE.Object3D();
particleGroup.add(sphericalParticles);
scene.add(particleGroup);

// === GUI Controls ===
const params = { red: 1.0, green: 1.0, blue: 1.0, threshold: 0.5, strength: 0.5, radius: 0.8 };
const gui: GUI = new GUI();

const bloomFolder = gui.addFolder('Bloom');
bloomFolder.add(params, 'threshold', 0, 1)
           .onChange(v => bloomPass.threshold = v);
bloomFolder.add(params, 'strength', 0, 3)
           .onChange(v => bloomPass.strength = v);
bloomFolder.add(params, 'radius', 0, 1)
           .onChange(v => bloomPass.radius = v);

// === Postprocessing ===
const renderScene: RenderPass = new RenderPass(scene, camera);
const bloomPass: UnrealBloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), params.strength, params.radius, params.threshold);
const outputPass: OutputPass = new OutputPass();
const composer: EffectComposer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);
composer.addPass(outputPass);

// === Matrix Utilities ===
function translationMatrix(tx: number, ty: number, tz: number): THREE.Matrix4 {
  return new THREE.Matrix4().set(
    1, 0, 0, tx,
    0, 1, 0, ty,
    0, 0, 1, tz,
    0, 0, 0, 1
  );
}
function rotationMatrixY(theta: number): THREE.Matrix4 {
  return new THREE.Matrix4().set(
    Math.cos(theta), 0, Math.sin(theta), 0,
    0, 1, 0, 0,
    -Math.sin(theta), 0, Math.cos(theta), 0,
    0, 0, 0, 1
  );
}
function rotationMatrixZ(theta: number): THREE.Matrix4 {
  return new THREE.Matrix4().set(
    Math.cos(theta), -Math.sin(theta), 0, 0,
    Math.sin(theta), Math.cos(theta), 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  );
}
function scaleMatrix(sx: number, sy: number, sz: number): THREE.Matrix4 {
  return new THREE.Matrix4().set(
    sx, 0, 0, 0,
    0, sy, 0, 0,
    0, 0, sz, 0,
    0, 0, 0, 1
  );
}
function shearMatrix(shxy: number, shxz: number, shyx: number, shyz: number, shzx: number, shzy: number): THREE.Matrix4 {
  return new THREE.Matrix4().set(
    1, shxy, shxz, 0,
    shyx, 1, shyz, 0,
    shzx, shzy, 1, 0,
    0, 0, 0, 1
  );
}

// === Animate Loop ===
function animate(): void {
  requestAnimationFrame(animate);
  const t: number = clock.getElapsedTime();
  const freqData: Uint8Array = analyser.getFrequencyData();
  const bass = freqData.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
  const mid = freqData.slice(4, 16).reduce((a, b) => a + b, 0) / 12;
  const treble = freqData.slice(16).reduce((a, b) => a + b, 0) / 16;
  const b = bass / 256;
  const m = mid / 256;
  const tr = treble / 256;

  const posAttr = particleGeometry.getAttribute('position') as THREE.BufferAttribute;
  applyTrebleBumps(posAttr, originalPositions, tr, N);


  let model_transform = new THREE.Matrix4();
  const bassScale = 1 + 0.3 * Math.sin(t * 4) * b;
  model_transform.multiply(scaleMatrix(bassScale, bassScale, bassScale));
  const shearAmount = 0.4 * Math.sin(t * 2) * m;
  model_transform.multiply(shearMatrix(0, shearAmount, shearAmount, 0, 0, shearAmount));
  const bounceY = Math.sin(t * 6) * tr * 0.5;
  model_transform
    .multiply(rotationMatrixY(t * 1.5 * tr))
    .multiply(rotationMatrixZ(t * 0.7 * tr))
    .multiply(translationMatrix(Math.sin(t * 2) * tr, bounceY, 0));

  particleGroup.matrixAutoUpdate = false;
  particleGroup.matrix.copy(model_transform);
  bloomPass.strength = 0.5 + (b + m + tr) * 1.2;
  controls.update();
  composer.render();
}
animate();