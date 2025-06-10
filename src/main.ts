// === Imports ===
import * as THREE from 'three';
import { GUI } from 'dat.gui';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { AfterimagePass } from 'three/examples/jsm/postprocessing/AfterimagePass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { rotationMatrixY, rotationMatrixZ, scaleMatrix, shearMatrix } from '@/utils/matrixUtils';
import { createNoise4D } from 'simplex-noise';
import { applyTrebleBumps } from '@/utils/applyTrebleBumps';
import vertexShader from '@/shaders/vertex.glsl';
import fragmentShader from '@/shaders/fragment.glsl';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const GRAVITY = 300;           // Gravity acceleration (y-axis)
const BOUNCE_DAMPING = 0.05;   // Speed retained after a bounce
const PARTICLE_DRAG = 0.98;

const noiseSpatialScale = 1.1;
const noiseTimeScale = 0.9;
const noiseAmplitude = 10;
const baseSpike = 0.5;

// Environment color change speed
const envColorSpeed = 0.03;

// Bass
const REST_BASS_SCALE = 1;
const BASS_SENSIIVITY = 1.2;

// Cutoffs
const bassCutoff = 0.7;       // 70%
const midCutoff = 0.0;        // 0%
const trebleCutoff = 0.0;     // 0%

// Bloom
let baseStrength = 0.6;
const strengthIntensity = 0.7;

let baseThreshold = 0.4;
const thresholdIntensity = 0.3;

let baseRadius = 0.8;
const radiusIntensity = 0.5;

const noise4D = createNoise4D();

// Temporary vectors to avoid allocations per‐particle
const tempPos = new THREE.Vector3();
const tempVel = new THREE.Vector3();
const tempDir = new THREE.Vector3();

// Sphere easing variables
let targetBassScale = 1;
let currentBassScale = 1;

// Particle counter
let count = 0;

// Camera rotation
const cameraRotationSpeed = 1;

// ─────────────────────────────────────────────────────────────────────────────
// RENDERER, SCENE, CAMERA
// ─────────────────────────────────────────────────────────────────────────────
const renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer({ antialias: true});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene: THREE.Scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 10);
camera.lookAt(0, 0, 0);

// Orbit controls
const controls: OrbitControls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.enableZoom = true;
controls.enableRotate = true;
controls.autoRotate = false; 
controls.autoRotateSpeed = cameraRotationSpeed;
controls.minDistance = 5;
controls.maxDistance = 30;

// ─────────────────────────────────────────────────────────────────────────────
// AUDIO SETUP
// ─────────────────────────────────────────────────────────────────────────────
const listener: THREE.AudioListener = new THREE.AudioListener();
camera.add(listener);

let sound: THREE.Audio = new THREE.Audio(listener);
let micStream: MediaStream | null = null;
let micSource: THREE.Audio | null = null;

// Create an AudioAnalyser
let analyser: THREE.AudioAnalyser = new THREE.AudioAnalyser(sound, 128);

// File and mic setup
const fileInput = document.getElementById('audioUpload') as HTMLInputElement;
const audioRadios = document.getElementsByName('audioSource') as NodeListOf<HTMLInputElement>;
const pauseButton = document.getElementById('pauseButton') as HTMLButtonElement;

function setupFileUpload(): void {
  fileInput.disabled = false;

  if (micStream) {
    micStream.getTracks().forEach((track) => track.stop());
    micStream = null;
  }
  if (micSource) {
    micSource.disconnect();
    micSource = null;
  }

  pauseButton.textContent = 'Pause';
  pauseButton.disabled = true;
}

function setupMicrophoneInput(): void {
  if (sound && sound.isPlaying) sound.stop();
  sound = new THREE.Audio(listener);
  analyser = new THREE.AudioAnalyser(sound, 128);

  fileInput.value = '';
  fileInput.disabled = true;

  pauseButton.disabled = true;
  pauseButton.textContent = 'Listen';

  // Ensure audio context is active
  const audioContext = THREE.AudioContext.getContext();
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      micStream = stream;
      micSource = new THREE.Audio(listener);
      micSource.setMediaStreamSource(stream);
            
      analyser = new THREE.AudioAnalyser(micSource, 128);

      pauseButton.disabled = false;
      pauseButton.textContent = 'Pause';
    })
    .catch((err) => {
      alert('Microphone access denied or not available.');
      console.error(err);
    });
}

audioRadios.forEach((radio) => radio.addEventListener('change', updateAudioSource));
function updateAudioSource(): void {
  const selected = Array.from(audioRadios).find((r) => r.checked)?.value;
  if (selected === 'mic') {
    setupMicrophoneInput();
  } else {
    setupFileUpload();
  }
}
updateAudioSource();

// File upload
fileInput.addEventListener('change', (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  if (micStream) {
    micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
  }
  if (micSource) {
    micSource.disconnect();
    micSource = null;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const arrayBuffer = reader.result as ArrayBuffer;
    const audioContext = THREE.AudioContext.getContext();
    audioContext.decodeAudioData(arrayBuffer, (decodedData) => {
      if (sound && sound.isPlaying) sound.stop();
      sound = new THREE.Audio(listener);
      sound.setBuffer(decodedData);

      analyser = new THREE.AudioAnalyser(sound, 128);
      sound.play();

      pauseButton.disabled = false;
      pauseButton.textContent = 'Pause';
    });
  };
  reader.readAsArrayBuffer(file);
});

// Toggle Pause
pauseButton.addEventListener('click', () => {
  if (micSource && micStream) {
    const tracks = micStream.getAudioTracks();
    if (tracks.length > 0) {
      const currentlyEnabled = tracks[0].enabled;

      if (currentlyEnabled) {
        tracks.forEach((t) => (t.enabled = false));
        pauseButton.textContent = 'Listen';
      } else {
        tracks.forEach((t) => (t.enabled = true));
        pauseButton.textContent = 'Pause';
      }
    }
    return;
  }

  if (!sound.buffer) return;

  if (sound.isPlaying) {
    sound.pause();
    pauseButton.textContent = 'Play';
  } else {
    sound.play();
    pauseButton.textContent = 'Pause';
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SIZES
// ─────────────────────────────────────────────────────────────────────────────
const SPHERE_RADIUS = 2;
const SEGMENTS = 128;
const N = 1000; // number of particles

// ─────────────────────────────────────────────────────────────────────────────
// PARTICLES
// ─────────────────────────────────────────────────────────────────────────────
const particlePositions = new Float32Array(N * 3);
const particleVelocities = new Float32Array(N * 3);
const particleNormals    = new Float32Array(N * 3);

for (let i = 0; i < N; i++) {
  const u = Math.random() * 2 - 1;         
  const phi = Math.random() * Math.PI * 2; 
  const sinTheta = Math.sqrt(1 - u * u);
  const x = sinTheta * Math.cos(phi);
  const y = sinTheta * Math.sin(phi);
  const z = u;

  particlePositions[3 * i + 0] = x * SPHERE_RADIUS;
  particlePositions[3 * i + 1] = y * SPHERE_RADIUS;
  particlePositions[3 * i + 2] = z * SPHERE_RADIUS;

  particleVelocities[3 * i + 0] = 0;
  particleVelocities[3 * i + 1] = 0;
  particleVelocities[3 * i + 2] = 0;

  particleNormals[3 * i + 0] = x;
  particleNormals[3 * i + 1] = y;
  particleNormals[3 * i + 2] = z;
}

const originalParticlePositions = new Float32Array(particlePositions);

// Attach both position and normal to the geometry
const particleGeometry = new THREE.BufferGeometry();
particleGeometry.setAttribute(
  'position',
  new THREE.BufferAttribute(particlePositions, 3)
);
particleGeometry.setAttribute(
  'normal',
  new THREE.BufferAttribute(particleNormals, 3)
);

// ─────────────────────────────────────────────────────────────────────────────
// PARTICLES SHADER MATERIAL
// ─────────────────────────────────────────────────────────────────────────────
const uniforms = {
  u_time: { value: 0.0 },
  u_frequency: { value: 0.0 },
  u_red: { value: 1.0 },
  u_green: { value: 1.0 },
  u_blue: { value: 1.0 }
};

// Create a ShaderMaterial that uses those two shader chunks
const particleMaterial = new THREE.ShaderMaterial({
  vertexShader: vertexShader,
  fragmentShader: fragmentShader,
  uniforms: uniforms,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});

const sphericalParticles: THREE.Points = new THREE.Points(particleGeometry, particleMaterial);

const particleGroup: THREE.Object3D = new THREE.Object3D();
particleGroup.add(sphericalParticles);
scene.add(particleGroup);

// ─────────────────────────────────────────────────────────────────────────────
// SOLID MESH SPHERE
// ─────────────────────────────────────────────────────────────────────────────
const textureLoader = new THREE.TextureLoader();

// Snow texture
const snowDiffuse = textureLoader.load('/assets/textures/snow/snow_02_diff_4k.jpg');
snowDiffuse.wrapS = THREE.RepeatWrapping;
snowDiffuse.wrapT = THREE.RepeatWrapping;

const snowDisplacement = textureLoader.load('/assets/textures/snow/snow_02_disp_4k.png');
snowDisplacement.wrapS = THREE.RepeatWrapping;
snowDisplacement.wrapT = THREE.RepeatWrapping;

const snowRoughness = textureLoader.load('/assets/textures/snow/snow_02_rough_4k.jpg');
snowRoughness.wrapS = THREE.RepeatWrapping;
snowRoughness.wrapT = THREE.RepeatWrapping;

const snowTranslucent = textureLoader.load('/assets/textures/snow/snow_02_translucent_4k.png');
snowTranslucent.wrapS = THREE.RepeatWrapping;
snowTranslucent.wrapT = THREE.RepeatWrapping;

// Rocky texture
const rockyDiffuse = textureLoader.load('/assets/textures/rocky/rocky_terrain_diff_4k.jpg')
rockyDiffuse.wrapS = THREE.RepeatWrapping;
rockyDiffuse.wrapT = THREE.RepeatWrapping;

const rockyDisplacement = textureLoader.load('/assets/textures/rocky/rocky_terrain_disp_4k.png')
rockyDisplacement.wrapS = THREE.RepeatWrapping;
rockyDisplacement.wrapT = THREE.RepeatWrapping;

const rockyRoughness = textureLoader.load('/assets/textures/rocky/rocky_terrain_rough_4k.jpg')
rockyRoughness.wrapS = THREE.RepeatWrapping;
rockyRoughness.wrapT = THREE.RepeatWrapping;

const rockyTranslucent: THREE.Texture | null = null;

const sphereGeometry = new THREE.SphereGeometry(SPHERE_RADIUS, SEGMENTS, SEGMENTS);
const sphereMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  wireframe: true,
  opacity: 1.0,
  transparent: true,
  side: THREE.DoubleSide,
});
sphereMaterial.needsUpdate = true;

const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
sphereMesh.matrixAutoUpdate = false;
sphereMesh.castShadow = true;
sphereMesh.receiveShadow = true;
scene.add(sphereMesh);

const originalSpherePositions = new Float32Array(sphereGeometry.attributes.position.count * 3);
for (let i = 0; i < sphereGeometry.attributes.position.count * 3; i++) {
  originalSpherePositions[i] = (sphereGeometry.attributes.position.array as Float32Array)[i];
}

window.addEventListener('keydown', (event) => {
  switch (event.key) {
    case '1':
      sphereMaterial.wireframe = true;
      ambientLight.intensity = 1.0;
      sphereMaterial.transparent = false;
      applyDefaultMaterial();
      break;
    case '2':
      sphereMaterial.wireframe = false;
      applySnowPack();
      break;
    case '3':
      sphereMaterial.wireframe = false;
      applyRockyPack();
      break;
    case 'w':
      sphereMaterial.wireframe = !sphereMaterial.wireframe;
      ambientLight.intensity = sphereMaterial.wireframe ? 1.0 : 0.05;
      sphereMaterial.transparent = sphereMaterial.wireframe ? false : true;
      spotLight.intensity = sphereMaterial.wireframe ? 10.0 : 150.0;
      sphereMaterial.needsUpdate = true;
      break;
    default:
      break;
  }
});

function applyDefaultMaterial() {
  sphereMaterial.color = new THREE.Color(0xffffff);
  sphereMaterial.metalness = 0.0;
  sphereMaterial.roughness = 1.0;
  sphereMaterial.side = THREE.DoubleSide;
  sphereMaterial.transparent = true;

  // Clear any maps
  sphereMaterial.map = null;
  sphereMaterial.displacementMap = null;
  sphereMaterial.roughnessMap = null;
  sphereMaterial.alphaMap = null;
  sphereMaterial.normalMap = null;
  sphereMaterial.displacementScale = 0;
  sphereMaterial.displacementBias = 0;

  sphereMaterial.alphaTest = 0;
  sphereMaterial.opacity = 1.0;

  sphereMaterial.needsUpdate = true;
}

function applySnowPack() {
  sphereMaterial.color = new THREE.Color(0xffffff);
  sphereMaterial.metalness = 0.0;
  sphereMaterial.roughness = 1.0;

  sphereMaterial.map = snowDiffuse;
  sphereMaterial.displacementMap = snowDisplacement;
  sphereMaterial.displacementScale = 0.15;
  sphereMaterial.displacementBias = -0.05;

  sphereMaterial.roughnessMap = snowRoughness;
  sphereMaterial.alphaMap = snowTranslucent;
  sphereMaterial.alphaTest = 0;
  sphereMaterial.transparent = true;

  sphereMaterial.needsUpdate = true;
}

function applyRockyPack() {
  sphereMaterial.color = new THREE.Color(0xffffff);
  sphereMaterial.metalness = 0.0;
  sphereMaterial.roughness = 1.0;

  sphereMaterial.map = rockyDiffuse;
  sphereMaterial.displacementMap = rockyDisplacement;
  sphereMaterial.displacementScale = 0.25;
  sphereMaterial.displacementBias = -0.1;

  sphereMaterial.roughnessMap = rockyRoughness;
  sphereMaterial.alphaMap = rockyTranslucent;
  sphereMaterial.alphaTest = 0;
  sphereMaterial.transparent = false;

  sphereMaterial.needsUpdate = true;
}

// ─────────────────────────────────────────────────────────────────────────────
// LIGHTING
// ─────────────────────────────────────────────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
scene.add(ambientLight);

const rimLight = new THREE.DirectionalLight(0x5599ff, 0.3);
rimLight.position.set(-1, 2, -3);
scene.add(rimLight);

const fillLight = new THREE.DirectionalLight(0xffaa66, 0.3);
fillLight.position.set(2, -1, 1);
scene.add(fillLight);

const LIGHT_HEIGHT = 20; // height of spotlight above sphere center
const halfAngle = Math.atan(SPHERE_RADIUS / LIGHT_HEIGHT); // ≈atan(2/5) ≈0.3805 rad (≈21.8°)

const spotLight = new THREE.SpotLight(0xffffff, 10.0);
spotLight.position.set(0, LIGHT_HEIGHT, 0);
spotLight.angle = halfAngle * 10;
spotLight.penumbra = 0.3;
spotLight.decay = 2;
spotLight.distance = 30;

spotLight.castShadow = true;
spotLight.shadow.mapSize.width = 2048;
spotLight.shadow.mapSize.height = 2048;
spotLight.shadow.camera.near = 1;
spotLight.shadow.camera.far = 50;
spotLight.shadow.camera.fov = (halfAngle * 180) / Math.PI * 2;

scene.add(spotLight);
spotLight.target = sphereMesh;

// ─────────────────────────────────────────────────────────────────────────────
// ENVIRONMENT PARTICLES
// ─────────────────────────────────────────────────────────────────────────────
const M = 100
const env_pos: number[] = [];
const env_col: number[] = [];
const temp_color = new THREE.Color();

for (let i = -50; i < M; i += 0.5) {
  for (let j = -50; j < M; j += 0.5) {
    env_pos.push(i,-3,j);

    const vx = Math.abs(( i / 100 ) + 0.5);
    const vy = Math.abs(( 1 / 100 ) + 0.5);
    const vz = Math.abs(( j / 100 ) + 0.5);

    temp_color.setRGB(vx, vy, vz, THREE.SRGBColorSpace );
    env_col.push( temp_color.r, temp_color.g, temp_color.b );
  }
}

const envGeometry: THREE.BufferGeometry = new THREE.BufferGeometry();
envGeometry.setAttribute('position', new THREE.Float32BufferAttribute(env_pos, 3))
envGeometry.setAttribute('color', new THREE.Float32BufferAttribute(env_col, 3))
const envMat = new THREE.PointsMaterial({ size: 0.05, transparent: true, vertexColors: true});
const env = new THREE.Points(envGeometry, envMat);
scene.add(env)

// ─────────────────────────────────────────────────────────────────────────────
// POSTPROCESSING
// ─────────────────────────────────────────────────────────────────────────────
const renderScene: RenderPass = new RenderPass(scene, camera);
const bloomPass: UnrealBloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  baseStrength,
  baseThreshold,
  baseRadius
);
const afterimagePass: AfterimagePass = new AfterimagePass();
afterimagePass.uniforms['damp'].value = 0.6;
const outputPass: OutputPass = new OutputPass();
const composer: EffectComposer = new EffectComposer(renderer);

composer.addPass(renderScene);
composer.addPass(bloomPass);
composer.addPass(afterimagePass);
composer.addPass(outputPass);

// ─────────────────────────────────────────────────────────────────────────────
// GUI CONTROLS
// ─────────────────────────────────────────────────────────────────────────────
const guiWidth = window.innerWidth < 600 ? window.innerWidth * 0.4 : 245;
const gui = new GUI({ width: guiWidth });

// Background color controls
const bgFolder = gui.addFolder('Background');
bgFolder
  .addColor({ color: '#111111' }, 'color')
  .name('color')
  .onChange((value: string) => {
    (scene.background! as THREE.Color).set(value);
  });

// Environment controls
const envSettings = {
  particleSize: 0.05,
  yPosition: -3,
  intensity: 1.0,
  visible: true
};
const envFolder = gui.addFolder('Environment Settings');
envFolder.add(envSettings, 'particleSize', 0.01, 0.2).onChange(value => {
  envMat.size = value;
});
envFolder.add(envSettings, 'yPosition', -10, 10).onChange(y => {
  for (let i = 1; i < env_pos.length; i += 3) {
    env_pos[i] = y;
  }
  envGeometry.attributes.position.needsUpdate = true;
});
envFolder.add(envSettings, 'intensity', 0.1, 2.0).onChange(intensity => {
  env_col.length = 0;
  for (let i = -50; i < M; i += 0.5) {
    for (let j = -50; j < M; j += 0.5) {
      const vx = Math.abs(( i / 100 ) + 0.5) * intensity;
      const vy = Math.abs(( 1 / 100 ) + 0.5) * intensity;
      const vz = Math.abs(( j / 100 ) + 0.5) * intensity;

      temp_color.setRGB(vx, vy, vz, THREE.SRGBColorSpace);
      env_col.push(temp_color.r, temp_color.g, temp_color.b);
    }
  }
  envGeometry.setAttribute('color', new THREE.Float32BufferAttribute(env_col, 3));
  envGeometry.attributes.color.needsUpdate = true;
});
envFolder.add(envSettings, 'visible').onChange(val => {
  env.visible = val;
});

// Sphere color controls
const sphereFolder = gui.addFolder('Sphere');
sphereFolder
  .addColor({color: '#ffffff'}, 'color')
  .name('color')
  .onChange((value: string) => {
    sphereMaterial.color.set(value);
  });

// Particle RGB sliders
const colors = {
  red: 1.0,
  green: 1.0,
  blue: 1.0,
};
const particleFolder = gui.addFolder('Particle colors');
particleFolder
  .add(colors, 'red', 0, 1)
  .onChange((v: number) => {
    uniforms.u_red.value = v;
  });
particleFolder
  .add(colors, 'green', 0, 1)
  .onChange((v: number) => {
    uniforms.u_green.value = v;
  });
particleFolder
  .add(colors, 'blue', 0, 1)
  .onChange((v: number) => {
    uniforms.u_blue.value = v;
  });

// Bloom controls
const bloomParams = {
  audioBloom: true,
  strength: baseStrength,
  threshold: baseThreshold,
  radius: baseRadius
}
const bloomFolder = gui.addFolder('Bloom');
bloomFolder
  .add(bloomParams, 'audioBloom')
bloomFolder
  .add({ baseStrength }, 'baseStrength', 0, 3)
  .onChange(v => baseStrength = v);
bloomFolder
  .add({ baseThreshold }, 'baseThreshold', 0, 1)
  .onChange(v => baseThreshold = v);
bloomFolder
  .add({ baseRadius }, 'baseRadius', 0, 1)
  .onChange(v => baseRadius = v);
bloomFolder
  .add(bloomParams, 'strength', 0, 3)
bloomFolder
  .add(bloomParams, 'threshold', 0, 1)
bloomFolder
  .add(bloomParams, 'radius', 0, 1)

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW RESIZE HANDLER
// ─────────────────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  // Update renderer size
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Update camera aspect
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  // Update composer
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.setSize(window.innerWidth, window.innerHeight);
});

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION LOOP
// ─────────────────────────────────────────────────────────────────────────────
const clock: THREE.Clock = new THREE.Clock();

function animate(): void {
  requestAnimationFrame(animate);

  const time: number = clock.getElapsedTime();
  uniforms.u_time.value = time; // for vertex shader

  const isAudioPlaying = (micSource !== null) || (!!sound && sound.isPlaying);
  let rotateCamera = false;

  // Get frequency data from analyser
  if (isAudioPlaying) {
    sphericalParticles.visible = true;
    const freqData: Uint8Array = analyser.getFrequencyData();

    // Compute an overall frequency value
    const avgFreq = freqData.reduce((sum, v) => sum + v, 0) / freqData.length;
    uniforms.u_frequency.value = avgFreq;

    // Split the frequency data into bass / mid / treble in range [0..255]
    const bassBins = freqData.slice(0, 16);
    const midBins = freqData.slice(16, 48);
    const trebleBins = freqData.slice(48);

    const bass = bassBins.reduce((a, b) => a + b, 0) / bassBins.length;
    const mid = midBins.reduce((a, b) => a + b, 0) / midBins.length;
    const treble = trebleBins.reduce((a, b) => a + b, 0) / trebleBins.length;

    // Normalize to range [0..1]
    const bNorm = bass / 256;
    const mNorm = mid / 256;
    const tNorm = treble / 256;

    // Cut-offs
    const b = (bNorm > bassCutoff) ? (bNorm - bassCutoff) / (1 - bassCutoff) : 0;
    const m = (mNorm > midCutoff) ? (mNorm - midCutoff) / (1 - midCutoff) : 0;
    const tr = (tNorm > trebleCutoff) ? (tNorm - trebleCutoff) / (1 - trebleCutoff) : 0;

    // Camera rotation
    if (b > 0.6 || m > 0.5) {
      rotateCamera = true;
    } else {
      rotateCamera = false;
    }

    // Debugging
    // console.log(b, m, tr);

    // Dynamic bloom adjustments
    if (bloomParams.audioBloom) {
      bloomPass.strength  = baseStrength  + (m + tr) * strengthIntensity;
      bloomPass.threshold = baseThreshold - (thresholdIntensity * tr);
      bloomPass.radius    = baseRadius   + (radiusIntensity * tr);
    } else {
      bloomPass.strength  = bloomParams.strength;
      bloomPass.threshold = bloomParams.threshold;
      bloomPass.radius    = bloomParams.radius;
    }

    // === SPHERE ===
    // Bass-driven scaling
    targetBassScale = REST_BASS_SCALE + BASS_SENSIIVITY * b;
    currentBassScale += (targetBassScale - currentBassScale) * 0.05;
    currentBassScale = THREE.MathUtils.clamp(currentBassScale, 1, 1.5);
    const sphereBassScale = currentBassScale;

    // Emissive intensity
    sphereMaterial.emissiveIntensity = THREE.MathUtils.clamp(b * 1.5, 0, 1);

    // Dynamic sphere scaling, shearing, and rotation
    const matScale: THREE.Matrix4 = scaleMatrix(
      sphereBassScale,
      sphereBassScale,
      sphereBassScale
    );

    const angleY = m * 0.8;
    const matRotY: THREE.Matrix4 = rotationMatrixY(angleY);

    const angleZ = tr * 0.8;
    const matRotZ: THREE.Matrix4 = rotationMatrixZ(angleZ);

    const shearAmount = tr * 0.03;
    const matShear: THREE.Matrix4 = shearMatrix(
      /* shxy */ shearAmount,
      /* shxz */ 0,
      /* shyx */ 0,
      /* shyz */ 0,
      /* shzx */ 0,
      /* shzy */ 0
    );

    const combinedSphereMatrix = new THREE.Matrix4();

    combinedSphereMatrix
    .copy(matRotZ)            // Rz
    .multiply(matRotY)        // Rz * Ry
    .multiply(matShear)       // Rz * Ry * Shear
    .multiply(matScale);      // Rz * Ry * Shear * Scale

    sphereMesh.matrix.copy(combinedSphereMatrix);

    // Spikes: displace each vertex along its normal
    const vertexCount = sphereGeometry.attributes.position.count;
    const currentSpikes = new Float32Array(vertexCount).fill(0);

    const spherePosAttr = sphereGeometry.attributes.position as THREE.BufferAttribute;
    const sphereNormAttr = sphereGeometry.attributes.normal as THREE.BufferAttribute;

    for (let i = 0; i < vertexCount; i++) {
      // original position of this vertex (x,y,z)
      const idx3 = 3 * i;
      const ox = originalSpherePositions[idx3 + 0];
      const oy = originalSpherePositions[idx3 + 1];
      const oz = originalSpherePositions[idx3 + 2];

      // normal of this vertex (nx, ny, nz)
      const nx = sphereNormAttr.getX(i);
      const ny = sphereNormAttr.getY(i);
      const nz = sphereNormAttr.getZ(i);

      // Sample 4D simplex noise at (scaled position, time)
      const noiseVal = noise4D(
        ox * noiseSpatialScale,
        oy * noiseSpatialScale,
        oz * noiseSpatialScale,
        time * noiseTimeScale
      );
      // only allow outward spikes (clamp negative noise to zero)
      const positiveNoise = Math.max(0, noiseVal);

      // Calculate target spike magnitude
      const targetSpike = (m + tr) * (baseSpike + positiveNoise * noiseAmplitude);
      
      // Ease currentSpikes[i] → targetSpike each frame
      currentSpikes[i] += (targetSpike - currentSpikes[i]) * 0.25;

      const disp = currentSpikes[i];
      spherePosAttr.setXYZ(
        i,
        ox + nx * disp,
        oy + ny * disp,
        oz + nz * disp
      );

      if (disp > 5) {
        sphereGeometry.computeVertexNormals();
      }
    }
    spherePosAttr.needsUpdate = true;

    // === PARTICLES ===
    const deltaTime = clock.getDelta(); // elapsed seconds since last frame

    applyTrebleBumps(particlePositions, originalParticlePositions, tr, N);
    particleGeometry.attributes.position.needsUpdate = true;

    for (let i = 0; i < N; i++) {
      const idx = 3 * i;

      // Load particle’s current position & velocity
      tempPos.set(
        particlePositions[idx + 0],
        particlePositions[idx + 1],
        particlePositions[idx + 2]
      );
      tempVel.set(
        particleVelocities[idx + 0],
        particleVelocities[idx + 1],
        particleVelocities[idx + 2]
      );

      // Apply gravity
      const dirToCenter = tempPos.clone().normalize().negate();
      tempVel.addScaledVector(dirToCenter, GRAVITY * deltaTime);

      // Apply drag
      tempVel.multiplyScalar(PARTICLE_DRAG);

      tempPos.x += tempVel.x * deltaTime;
      tempPos.y += tempVel.y * deltaTime;
      tempPos.z += tempVel.z * deltaTime;

      // Collision against sphere surface
      const dist = tempPos.length();
      if (dist > 1e-6) {
        tempDir.copy(tempPos).normalize();
      } else {
        tempDir.set(0, 1, 0); 
      }

      const ox = tempDir.x * SPHERE_RADIUS;
      const oy = tempDir.y * SPHERE_RADIUS;
      const oz = tempDir.z * SPHERE_RADIUS;

      const noiseVal2 = noise4D(
        ox * noiseSpatialScale,
        oy * noiseSpatialScale,
        oz * noiseSpatialScale,
        time * noiseTimeScale
      );
      const positiveNoise2 = Math.max(0, noiseVal2);
      const dirSpike = (m + tr) * (baseSpike + positiveNoise2 * noiseAmplitude);
      const surfaceRadius = (SPHERE_RADIUS + dirSpike) * sphereBassScale;

      // Handle collision
      if (tempPos.length() <= surfaceRadius) {
        // Push to the surface
        tempPos.copy(tempDir).multiplyScalar(surfaceRadius);
        // Bounce along the normal
        const incomingSpeed = tempVel.length();
        tempVel.copy(tempDir).multiplyScalar(incomingSpeed * BOUNCE_DAMPING);
      }

      // Updated position and velocity
      particlePositions[idx + 0] = tempPos.x;
      particlePositions[idx + 1] = tempPos.y;
      particlePositions[idx + 2] = tempPos.z;

      particleVelocities[idx + 0] = tempVel.x;
      particleVelocities[idx + 1] = tempVel.y;
      particleVelocities[idx + 2] = tempVel.z;
    }
    particleGeometry.attributes.position.needsUpdate = true;

    // === ENVIRONMENT ===
    function lerp(a: number, b: number, t: number): number {
      return a + (b - a) * t;
    }

    const positions = env.geometry.attributes.position.array;
    const colors = env.geometry.attributes.color.array;
    const waveScaleX = 0.3;
    const waveScaleY = 0.5;
    const waveAmplitudeB = b;
    const waveAmplitudeM = m;
    
    const tR = 0.5 + 0.5 * Math.sin(count * envColorSpeed + 0);
    const tG = 0.5 + 0.5 * Math.sin(count * envColorSpeed + (Math.PI * 2) / 3);
    const tB = 0.5 + 0.5 * Math.sin(count * envColorSpeed + (Math.PI * 4) / 3);

    let i = 0;
    for (let ix = 0; ix < 3 * M; ix++) {
      const sinX = waveAmplitudeB * Math.sin((ix + count) * waveScaleX);
      for (let iy = 0; iy < 3 * M; iy++) {
        const sinY = waveAmplitudeM * Math.sin((iy + count) * waveScaleY);
        positions[i + 1] = sinX + sinY - 3;
        colors[i + 0] = lerp(colors[i + 0], tR, 0.05);
        colors[i + 1] = lerp(colors[i + 1], tG, 0.05);
        colors[i + 2] = lerp(colors[i + 2], tB, 0.05);

        i += 3;
      }
    }
    env.geometry.attributes.position.needsUpdate = true;
    env.geometry.attributes.color.needsUpdate = true;
    count += 0.1;
  } else {
    sphericalParticles.visible = false;
    // sphereMesh.scale.set(1, 1, 1);
    const spherePosAttr = sphereGeometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < spherePosAttr.count * 3; i++) {
      (spherePosAttr.array as Float32Array)[i] = originalSpherePositions[i];
    }
    spherePosAttr.needsUpdate = true;

    for (let i = 0; i < N * 3; i++) {
      particlePositions[i] = originalParticlePositions[i];
      particleVelocities[i] = 0;
    }
    particleGeometry.attributes.position.needsUpdate = true;
  }

  controls.autoRotate = rotateCamera;
  controls.update();
  composer.render();

  // Render without postprocessing
  // renderer.render(scene, camera);
}

animate();