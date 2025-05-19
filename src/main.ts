import * as THREE from 'three';
import { GUI } from 'dat.gui';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// === Setup ===
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 10);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.minDistance = 5;
controls.maxDistance = 30;

// === Audio setup ===
const listener = new THREE.AudioListener();
camera.add(listener);
const sound = new THREE.Audio(listener);
let analyser = new THREE.AudioAnalyser(sound, 32);

// === Clock ===
const clock = new THREE.Clock();

const shaderMaterial = new THREE.ShaderMaterial({
  vertexShader: `
    uniform float u_time;
    varying vec3 vNormal;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      float displacement = 0.1 * sin(10.0 * position.x + u_time) * cos(10.0 * position.y + u_time);
      vec3 newPosition = position + normal * displacement;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;

    void main() {
      float intensity = pow(0.9 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 4.0);
      gl_FragColor = vec4(0.5, 1.0, 1.0, 1.0) * intensity;
    }
  `,
  uniforms: {
    u_time: { value: 0.0 }
  },
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});


// === Sphere Setup ===
const geometry = new THREE.SphereGeometry(2, 64, 64);
const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const mesh = new THREE.Mesh(geometry, shaderMaterial);
mesh.matrixAutoUpdate = false;
scene.add(mesh);


// === Particle field ===
const particleGeometry = new THREE.BufferGeometry().setFromPoints(
  Array.from({ length: 500 }, () =>
    new THREE.Vector3(
      (Math.random() - 0.5) * 30,
      (Math.random() - 0.5) * 30,
      (Math.random() - 0.5) * 30
    )
  )
);
const particleMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.1 });
const particles = new THREE.Points(particleGeometry, particleMaterial);
scene.add(particles);
particles.scale.set(10, 10, 10);


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
const bloomFolder = gui.addFolder('Bloom');
bloomFolder.add(params, 'threshold', 0, 1);
bloomFolder.add(params, 'strength', 0, 3);
bloomFolder.add(params, 'radius', 0, 1);

// === Postprocessing ===
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), params.strength, params.radius, params.threshold);
const outputPass = new OutputPass();

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);
composer.addPass(outputPass);

// === Transformation Utilities ===
function translationMatrix(tx: number, ty: number, tz: number) {
  return new THREE.Matrix4().set(
    1, 0, 0, tx,
    0, 1, 0, ty,
    0, 0, 1, tz,
    0, 0, 0, 1
  );
}

function rotationMatrixY(theta: number) {
  return new THREE.Matrix4().set(
    Math.cos(theta), 0, Math.sin(theta), 0,
    0, 1, 0, 0,
    -Math.sin(theta), 0, Math.cos(theta), 0,
    0, 0, 0, 1
  );
}

function rotationMatrixZ(theta: number) {
  return new THREE.Matrix4().set(
    Math.cos(theta), -Math.sin(theta), 0, 0,
    Math.sin(theta),  Math.cos(theta), 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  );
}

function scaleMatrix(sx: number, sy: number, sz: number) {
  return new THREE.Matrix4().set(
    sx, 0,  0,  0,
    0, sy,  0,  0,
    0,  0, sz,  0,
    0,  0,  0,  1
  );
}

function shearMatrix(shxy: number, shxz: number, shyx: number, shyz: number, shzx: number, shzy: number) {
  return new THREE.Matrix4().set(
    1,     shxy, shxz, 0,
    shyx,  1,    shyz, 0,
    shzx,  shzy, 1,    0,
    0,     0,    0,    1
  );
}

// === Animate Loop ===
function animate() {
  requestAnimationFrame(animate);

  const t = clock.getElapsedTime();
  shaderMaterial.uniforms.u_time.value = t;

  const freqData = analyser.getFrequencyData();
  const bass = freqData.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
  const mid = freqData.slice(4, 16).reduce((a, b) => a + b, 0) / 12;
  const treble = freqData.slice(16).reduce((a, b) => a + b, 0) / 16;

  const b = bass / 256;
  const m = mid / 256;
  const tr = treble / 256;

  // === Transformations ===
  let model_transform = new THREE.Matrix4();

  // 1. Pulsing scale for bass
  const bassScale = 1 + 0.3 * Math.sin(t * 4) * b;
  model_transform.multiply(scaleMatrix(bassScale, bassScale, bassScale));

  // 2. Smooth shear for mids
  const shearAmount = 0.4 * Math.sin(t * 2) * m;
  model_transform.multiply(shearMatrix(0, shearAmount, shearAmount, 0, 0, shearAmount));

  // 3. Treble-based spin and bounce
  const bounceY = Math.sin(t * 6) * tr * 0.5;
  model_transform
    .multiply(rotationMatrixY(t * 1.5 * tr))
    .multiply(rotationMatrixZ(t * 0.7 * tr))
    .multiply(translationMatrix(Math.sin(t * 2) * tr, bounceY, 0));

  mesh.matrix.copy(model_transform);

  // === Particles shimmer with frequency
  particles.rotation.y += 0.002 + tr * 0.01;
  (particles.material).size = 0.05 + (b + tr) * 0.3;

  bloomPass.strength = 0.5 + (b + m + tr) * 1.2;

  controls.update();
  composer.render();
}

animate();

// === Resize ===
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
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
      sound.stop();
      sound.setBuffer(decodedData);
      analyser = new THREE.AudioAnalyser(sound, 32);
      sound.play();
    });
  };

  reader.readAsArrayBuffer(file);
});
