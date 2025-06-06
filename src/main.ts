// === Imports ===
import * as THREE from 'three';
import { GUI } from 'dat.gui';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { AfterimagePass } from 'three/examples/jsm/postprocessing/AfterimagePass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { translationMatrix, rotationMatrixY, rotationMatrixZ, scaleMatrix, shearMatrix } from '@/utils/matrixUtils';
import { applyTrebleBumps } from '@/utils/applyTreble';
import { createNoise4D } from 'simplex-noise';
import vertexShader from '@/shaders/vertex.glsl';
import fragmentShader from '@/shaders/fragment.glsl';

// ─────────────────────────────────────────────────────────────────────────────
// RENDERER, SCENE, CAMERA
// ─────────────────────────────────────────────────────────────────────────────
const renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer({ antialias: true, failIfMajorPerformanceCaveat: true});
renderer.setSize(window.innerWidth, window.innerHeight);
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
let analyser: THREE.AudioAnalyser = new THREE.AudioAnalyser(sound, 32);

// File and mic setup
const fileInput = document.getElementById('audioUpload') as HTMLInputElement;
const audioRadios = document.getElementsByName('audioSource') as NodeListOf<HTMLInputElement>;
const pauseButton = document.getElementById('pauseButton') as HTMLButtonElement;

function setupFileUpload(): void {
  fileInput.disabled = false;

  // If the mic was active, stop it
  if (micStream) {
    micStream.getTracks().forEach((track) => track.stop());
    micStream = null;
  }
  if (micSource) {
    micSource.disconnect();
    micSource = null;
  }

  pauseButton.textContent = 'Pause';
  pauseButton.disabled = true; // until a file is loaded

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
        pauseButton.disabled = false;
      });
    };
    reader.readAsArrayBuffer(file);
  });
}

function setupMicrophoneInput(): void {
  if (sound && sound.isPlaying) sound.stop();
  pauseButton.disabled = true;

  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      micStream = stream;
      micSource = new THREE.Audio(listener);
      micSource.setMediaStreamSource(stream);
      analyser = new THREE.AudioAnalyser(micSource, 32);
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

// Toggle Pause
pauseButton.addEventListener('click', () => {
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
const N = 500; // number of particles

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

// scene.add(sphericalParticles);

// ─────────────────────────────────────────────────────────────────────────────
// SOLID MESH SPHERE
// ─────────────────────────────────────────────────────────────────────────────
const textureLoader = new THREE.TextureLoader();

// Snow texture
const snowDiffuse = textureLoader.load('/assets/snow_02_diff_4k.jpg');
snowDiffuse.wrapS = THREE.RepeatWrapping;
snowDiffuse.wrapT = THREE.RepeatWrapping;

const snowDisplacement = textureLoader.load('/assets/snow_02_disp_4k.png');
snowDisplacement.wrapS = THREE.RepeatWrapping;
snowDisplacement.wrapT = THREE.RepeatWrapping;

const snowRoughness = textureLoader.load('/assets/snow_02_rough_4k.jpg');
snowRoughness.wrapS = THREE.RepeatWrapping;
snowRoughness.wrapT = THREE.RepeatWrapping;

const snowTranslucent = textureLoader.load('/assets/snow_02_translucent_4k.png');
snowTranslucent.wrapS = THREE.RepeatWrapping;
snowTranslucent.wrapT = THREE.RepeatWrapping;

// Rocky texture
const rockyDiffuse = textureLoader.load('/textures/rocky_terrain_diff_4k.jpg')
rockyDiffuse.wrapS = THREE.RepeatWrapping;
rockyDiffuse.wrapT = THREE.RepeatWrapping;

const rockyDisplacement = textureLoader.load('/textures/rocky_terrain_disp_4k.png')
rockyDisplacement.wrapS = THREE.RepeatWrapping;
rockyDisplacement.wrapT = THREE.RepeatWrapping;

const rockyRoughness = snowRoughness;
const rockyTranslucent: THREE.Texture | null = null;

const sphereGeometry = new THREE.SphereGeometry(SPHERE_RADIUS, SEGMENTS, SEGMENTS);
const sphereMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  wireframe: true,
  transparent: true,
  side: THREE.DoubleSide,
});
sphereMaterial.needsUpdate = true;

const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
scene.add(sphereMesh);

const originalSpherePositions = new Float32Array(sphereGeometry.attributes.position.count * 3);
for (let i = 0; i < sphereGeometry.attributes.position.count * 3; i++) {
  originalSpherePositions[i] = (sphereGeometry.attributes.position.array as Float32Array)[i];
}

window.addEventListener('keydown', (event) => {
  switch (event.key) {
    case '1':
      sphereMaterial.wireframe = true;
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
  // sphereMaterial.alphaTest = 0.5;
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
  // sphereMaterial.alphaMap = rockyTranslucent;
  // sphereMaterial.alphaTest = 0;
  sphereMaterial.transparent = false;

  sphereMaterial.needsUpdate = true;
}

// ─────────────────────────────────────────────────────────────────────────────
// LIGHTING
// ─────────────────────────────────────────────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);

const rimLight = new THREE.DirectionalLight(0x5599ff, 0.4);
rimLight.position.set(-1, 2, -3);
scene.add(rimLight);

const fillLight = new THREE.DirectionalLight(0xffaa66, 0.4);
fillLight.position.set(2, -1, 1);
scene.add(fillLight);

// ─────────────────────────────────────────────────────────────────────────────
// POSTPROCESSING
// ─────────────────────────────────────────────────────────────────────────────
const params = {
  red: 1.0,
  green: 1.0,
  blue: 1.0,
  strength: 0.5,
  radius: 0.5,
  threshold: 0.5,
};

const renderScene: RenderPass = new RenderPass(scene, camera);
const bloomPass: UnrealBloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  params.strength,
  params.radius,
  params.threshold
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
const gui: GUI = new GUI();

// Background color controls
const bgFolder = gui.addFolder('Background');
bgFolder
  .addColor({ color: '#111111' }, 'color')
  .name('background')
  .onChange((value: string) => {
    (scene.background! as THREE.Color).set(value);
  });
bgFolder.open();

// Sphere color controls
const sphereFolder = gui.addFolder('Sphere');
sphereFolder
  .addColor({color: '#ffffff'}, 'color')
  .name('color')
  .onChange((value: string) => {
    sphereMaterial.color.set(value);
  });
sphereFolder.open();

// Particle RGB sliders
const particleFolder = gui.addFolder('Colors');
particleFolder
  .add(params, 'red', 0, 1)
  .onChange((v: number) => {
    uniforms.u_red.value = v;
  });
particleFolder
  .add(params, 'green', 0, 1)
  .onChange((v: number) => {
    uniforms.u_green.value = v;
  });
particleFolder
  .add(params, 'blue', 0, 1)
  .onChange((v: number) => {
    uniforms.u_blue.value = v;
  });
particleFolder.open();

// Bloom controls
const bloomFolder = gui.addFolder('Bloom');
bloomFolder.add(params, 'threshold', 0, 1).onChange((v: number) => {
  bloomPass.threshold = v;
});
bloomFolder.add(params, 'strength', 0, 3).onChange((v: number) => {
  bloomPass.strength = v;
});
bloomFolder.add(params, 'radius', 0, 1).onChange((v: number) => {
  bloomPass.radius = v;
});
bloomFolder.open();

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
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const GRAVITY = 300;         // Gravity acceleration (y-axis)
const BOUNCE_DAMPING = 0.05;   // Speed retained after a bounce
const PARTICLE_DRAG = 0.98;

const noiseSpatialScale = 2;
const noiseTimeScale = 1.5;
const noiseAmplitude = 1.3;
const baseSpike = 0.5;

// Bass
const REST_BASS_SCALE = 1;
const BASS_SENSIIVITY = 1.2;

// Bloom
const baseStrength = 0.6;
const strengthIntensity = 1.4;

const baseThreshold = 0.4;
const thresholdIntensity = 0.3;

const baseRadius = 0.8;
const radiusIntensity = 0.5;

const noise4D = createNoise4D();

// Temporary vectors to avoid allocations per‐particle
const tempPos = new THREE.Vector3();
const tempVel = new THREE.Vector3();
const tempDir = new THREE.Vector3();

// Sphere easing variables
let targetBassScale = 1;
let currentBassScale = 1;

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION LOOP
// ─────────────────────────────────────────────────────────────────────────────
const clock: THREE.Clock = new THREE.Clock();

function animate(): void {
  requestAnimationFrame(animate);

  const time: number = clock.getElapsedTime();
  uniforms.u_time.value = time; // for vertex shader

  const isAudioPlaying = (micSource !== null) || (!!sound && sound.isPlaying);

  // Get frequency data from analyser
  if (isAudioPlaying) {
    const freqData: Uint8Array = analyser.getFrequencyData();

    // Compute an overall “frequency” value
    const avgFreq = freqData.reduce((sum, v) => sum + v, 0) / freqData.length;
    uniforms.u_frequency.value = avgFreq;

    // Split the frequency data into bass / mid / treble in range [0..255]
    const bass = freqData.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
    const mid = freqData.slice(4, 16).reduce((a, b) => a + b, 0) / 12;
    const treble = freqData.slice(16).reduce((a, b) => a + b, 0) / 16;

    // Normalize to range [0..1]
    const b = bass / 256;
    const m = mid / 256;
    const tr = treble / 256;

    // Dynamic bloom adjustments
    bloomPass.strength  = baseStrength + (m + tr) * strengthIntensity;
    bloomPass.threshold = baseThreshold - (thresholdIntensity * tr);
    bloomPass.radius    = baseRadius + (radiusIntensity * tr);

    // === SPHERE ===

    // Bass-driven scaling
    targetBassScale = REST_BASS_SCALE + BASS_SENSIIVITY * b;
    currentBassScale += (targetBassScale - currentBassScale) * 0.2;
    const sphereBassScale = currentBassScale;
    // sphereMesh.scale.set(sphereBassScale, sphereBassScale, sphereBassScale);

    const matScale: THREE.Matrix4 = scaleMatrix(
      sphereBassScale,
      sphereBassScale,
      sphereBassScale
    );

    const angleY = time * 0.2 + m * Math.PI;
    const matRotY: THREE.Matrix4 = rotationMatrixY(angleY);

    const angleZ = tr * Math.PI * 0.5;
    const matRotZ: THREE.Matrix4 = rotationMatrixZ(angleZ);

    const shearAmount = tr * 0.3;
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
    .copy(matRotZ)            // start as Rz
    .multiply(matRotY)        // Rz * Ry
    .multiply(matShear)       // Rz * Ry * Shear
    .multiply(matScale);      // Rz * Ry * Shear * Scale

    sphereMesh.matrix.copy(combinedSphereMatrix);

    // Mid/treble spikes: displace each vertex along its normal
    const spherePosAttr = sphereGeometry.attributes.position as THREE.BufferAttribute;
    const sphereNormAttr = sphereGeometry.attributes.normal as THREE.BufferAttribute;

    for (let i = 0; i < spherePosAttr.count; i++) {
      // original position of this vertex (x,y,z)
      const idx3 = 3 * i;
      const ox = originalSpherePositions[idx3];
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

      const spikeMagnitude =
        (m + tr) * (baseSpike + positiveNoise * noiseAmplitude);

      spherePosAttr.setXYZ(
        i,
        ox + nx * spikeMagnitude,
        oy + ny * spikeMagnitude,
        oz + nz * spikeMagnitude
      );
    }
    spherePosAttr.needsUpdate = true;

    // === PARTICLES ===

    const deltaTime = clock.getDelta(); // elapsed seconds since last frame

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
  } else {
    sphereMesh.scale.set(1, 1, 1);
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

  controls.update();
  composer.render();

  // Render without postprocessing
  // renderer.render(scene, camera);
}

animate();