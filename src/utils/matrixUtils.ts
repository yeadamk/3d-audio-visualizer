import * as THREE from 'three';

export function translationMatrix(tx: number, ty: number, tz: number): THREE.Matrix4 {
  return new THREE.Matrix4().makeTranslation(tx, ty, tz);
}

export function rotationMatrixY(theta: number): THREE.Matrix4 {
  return new THREE.Matrix4().makeRotationY(theta);
}

export function rotationMatrixZ(theta: number): THREE.Matrix4 {
  return new THREE.Matrix4().makeRotationZ(theta);
}

export function scaleMatrix(sx: number, sy: number, sz: number): THREE.Matrix4 {
  return new THREE.Matrix4().makeScale(sx, sy, sz);
}

export function shearMatrix(
  shxy: number, shxz: number,
  shyx: number, shyz: number,
  shzx: number, shzy: number
): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  m.set(
    1,     shxy, shxz, 0,
    shyx,  1,    shyz, 0,
    shzx,  shzy, 1,    0,
    0,     0,    0,    1
  );
  return m;
}
