import * as THREE from 'three';

// === Matrix Utilities ===
export function translationMatrix(tx: number, ty: number, tz: number): THREE.Matrix4 {
  return new THREE.Matrix4().set(
    1, 0, 0, tx,
    0, 1, 0, ty,
    0, 0, 1, tz,
    0, 0, 0, 1
  );
}

export function rotationMatrixY(theta: number): THREE.Matrix4 {
  return new THREE.Matrix4().set(
    Math.cos(theta), 0, Math.sin(theta), 0,
    0, 1, 0, 0,
    -Math.sin(theta), 0, Math.cos(theta), 0,
    0, 0, 0, 1
  );
}

export function rotationMatrixZ(theta: number): THREE.Matrix4 {
  return new THREE.Matrix4().set(
    Math.cos(theta), -Math.sin(theta), 0, 0,
    Math.sin(theta), Math.cos(theta), 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  );
}

export function scaleMatrix(sx: number, sy: number, sz: number): THREE.Matrix4 {
  return new THREE.Matrix4().set(
    sx, 0, 0, 0,
    0, sy, 0, 0,
    0, 0, sz, 0,
    0, 0, 0, 1
  );
}

export function shearMatrix(
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