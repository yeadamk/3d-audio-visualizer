//attribute float size;

void main() {
  //vColor = color;

  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );

  //gl_PointSize = size * ( 300.0 / -mvPosition.z );

  gl_Position = projectionMatrix * mvPosition;
}