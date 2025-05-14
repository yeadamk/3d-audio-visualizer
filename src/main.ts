import * as THREE from 'three';
import { GUI } from 'dat.gui';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';


const clock = new THREE.Clock();
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

const shaderMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // TEMP


const geometry = new THREE.SphereGeometry(2, 64, 64);

const mesh = new THREE.Mesh(geometry, shaderMaterial);
mesh.matrixAutoUpdate = false; // Disable auto-updates so manual matrices work
mesh.matrix.identity();

// Keep camera-facing orientation
mesh.matrix.multiply(rotationMatrixY(clock.getElapsedTime() * 0.2));

// Now apply effect-specific matrices below...


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


function translationMatrix(tx: number, ty: number, tz: number): THREE.Matrix4 {
  return new THREE.Matrix4().set(
    1, 0, 0, tx,
    0, 1, 0, ty,
    0, 0, 1, tz,
    0, 0, 0, 1
  );
}

function rotationMatrixX(theta: number): THREE.Matrix4 {
  return new THREE.Matrix4().set(
    1, 0, 0, 0,
    0, Math.cos(theta), -Math.sin(theta), 0,
    0, Math.sin(theta),  Math.cos(theta), 0,
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
    Math.sin(theta),  Math.cos(theta), 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  );
}

function scaleMatrix(sx: number, sy: number, sz: number): THREE.Matrix4 {
  return new THREE.Matrix4().set(
    sx, 0,  0,  0,
    0, sy,  0,  0,
    0,  0, sz,  0,
    0,  0,  0,  1
  );
}

function shearMatrix(
  shxy: number, shxz: number,
  shyx: number, shyz: number,
  shzx: number, shzy: number
): THREE.Matrix4 {
  return new THREE.Matrix4().set(
    1,     shxy, shxz, 0,
    shyx,  1,    shyz, 0,
    shzx,  shzy, 1,    0,
    0,     0,    0,    1
  );
}




// === Animate Loop ===

function animate() {
  const t = clock.getElapsedTime();
  const freq = analyser.getAverageFrequency() || 0;
  const f = freq / 256;

  camera.position.x += (mouseX - camera.position.x) * 0.05;
  camera.position.y += (-mouseY - camera.position.y) * 0.05;
  camera.lookAt(0, 0, 0);

  uniforms.u_time.value = t;
  uniforms.u_frequency.value = freq;

  // Audio-reactive scaling
  // Reset transform
mesh.matrix.identity();
mesh.updateMatrix();

// Low frequency: scale
if (freq < 85) {
  const s = 1 + f;
  const scaleMat = scaleMatrix(s, s, s);
  mesh.applyMatrix4(scaleMat);
}

// Mid frequency: shear
else if (freq >= 85 && freq < 170) {
  const sh = 0.2 * Math.sin(clock.getElapsedTime());
  const shearMat = shearMatrix(0, sh, sh, 0, 0, sh);
  mesh.applyMatrix4(shearMat);
}

// High frequency: translate + rotate
else {
  const angle = clock.getElapsedTime();
  const rotY = rotationMatrixY(angle * 0.5);
  const rotZ = rotationMatrixZ(angle * 0.3);
  const trans = translationMatrix(Math.sin(angle) * 0.5, 0, 0);

  mesh.applyMatrix4(rotY);
  mesh.applyMatrix4(rotZ);
  mesh.applyMatrix4(trans);
}


  // Audio-reactive colors
  uniforms.u_red.value = Math.abs(Math.sin(t + f));
  uniforms.u_green.value = Math.abs(Math.sin(t * 0.5 + f * 2));
  uniforms.u_blue.value = Math.abs(Math.cos(t * 0.7 + f));

  // Particle shimmer
  particles.rotation.y += 0.002;
  (particles.material as THREE.PointsMaterial).size = 0.05 + f * 0.3;

  // Audio-reactive bloom
  bloomPass.strength = 0.5 + f * 1.5;

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
// audioLoader.load('/assets/starrynight.mp3', (buffer) => {
//   sound.setBuffer(buffer);
//   // window.addEventListener('click', () => {
//   //   if (!sound.isPlaying) sound.play();
//   // });
// });

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
