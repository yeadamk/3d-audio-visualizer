import * as THREE from 'three';
import { GUI } from 'dat.gui';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// === Setup ===
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 10);
camera.lookAt(0, 0, 0);

// === Audio setup ===
const listener = new THREE.AudioListener();
camera.add(listener);
const sound = new THREE.Audio(listener);
let analyser = new THREE.AudioAnalyser(sound, 32);

// === Shader setup ===
const uniforms: { [key: string]: { value: number } } = {
  u_time: { value: 0 },
  u_frequency: { value: 0 },
  u_red: { value: 1 },
  u_green: { value: 1 },
  u_blue: { value: 1 }
};

const vertexShader = (document.getElementById('vertexshader') as HTMLScriptElement)?.textContent || '';
const fragmentShader = (document.getElementById('fragmentshader') as HTMLScriptElement)?.textContent || '';

const shaderMaterial = new THREE.ShaderMaterial({
  uniforms,
  vertexShader,
  fragmentShader
});

const geometry = new THREE.IcosahedronGeometry(2, 5);
const mesh = new THREE.Mesh(geometry, shaderMaterial);
scene.add(mesh);

// === GUI controls ===
const params = {
  red: 1.0,
  green: 1.0,
  blue: 1.0,
  threshold: 0.5,
  strength: 0.5,
  radius: 0.8
};

const gui = new GUI();
gui.addColor(params, 'red').onChange((v) => (uniforms.u_red.value = v));
gui.addColor(params, 'green').onChange((v) => (uniforms.u_green.value = v));
gui.addColor(params, 'blue').onChange((v) => (uniforms.u_blue.value = v));

const bloomFolder = gui.addFolder('Bloom');
bloomFolder.add(params, 'threshold', 0, 1).onChange((v) => (bloomPass.threshold = v));
bloomFolder.add(params, 'strength', 0, 3).onChange((v) => (bloomPass.strength = v));
bloomFolder.add(params, 'radius', 0, 1).onChange((v) => (bloomPass.radius = v));

// === Postprocessing ===
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), params.strength, params.radius, params.threshold);
const outputPass = new OutputPass();

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);
composer.addPass(outputPass);

// === Mouse Interaction ===
let mouseX = 0, mouseY = 0;
document.addEventListener('mousemove', (e) => {
  mouseX = (e.clientX - window.innerWidth / 2) / 100;
  mouseY = (e.clientY - window.innerHeight / 2) / 100;
});

// === Animate Loop ===
const clock = new THREE.Clock();
function animate() {
  camera.position.x += (mouseX - camera.position.x) * 0.05;
  camera.position.y += (-mouseY - camera.position.y) * 0.05;
  camera.lookAt(0, 0, 0);

  uniforms.u_time.value = clock.getElapsedTime();
  uniforms.u_frequency.value = analyser.getAverageFrequency();

  composer.render();
  requestAnimationFrame(animate);
}
animate();

// === Resize ===
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// === Load default audio ===
const audioLoader = new THREE.AudioLoader();
audioLoader.load('/assets/Beats.mp3', (buffer) => {
  sound.setBuffer(buffer);
  window.addEventListener('click', () => {
    if (!sound.isPlaying) sound.play();
  });
});

// === User-uploaded audio ===
const fileInput = document.getElementById('audioUpload') as HTMLInputElement;
fileInput.addEventListener('change', (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const arrayBuffer = reader.result as ArrayBuffer;
    const audioContext = THREE.AudioContext.getContext();

    audioContext.decodeAudioData(arrayBuffer, (decodedData) => {
      sound.stop(); // stop any existing audio
      sound.setBuffer(decodedData);
      analyser = new THREE.AudioAnalyser(sound, 32); // recreate analyser
      sound.play();
    });
  };

  reader.readAsArrayBuffer(file);
});
