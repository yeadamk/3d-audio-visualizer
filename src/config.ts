export default {
  renderer: {
    antialias: true,
    background: 0x111111,
  },
  camera: {
    fov: 45,
    near: 0.1,
    far: 1000,
    position: [0, 0, 10] as [number, number, number],
    minDistance: 5,
    maxDistance: 30,
  },
  audio: {
    defaultPath: '/assets/starrynight.mp3',
    analyserBands: 32,
  },
  mesh: {
    radius: 2,
    widthSegments: 64,
    heightSegments: 64,
  },
  particles: {
    count: 500,
    spread: 30,
    scale: 10,
    baseSize: 0.1,
  },
  bloom: {
    threshold: 0.5,
    strength: 0.5,
    radius: 0.8,
  },
};
