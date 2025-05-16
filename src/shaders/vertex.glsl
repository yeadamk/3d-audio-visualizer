uniform float u_time;
varying vec3 vNormal;

void main() {
  vNormal = normalize(normalMatrix * normal);
  float displacement = 0.1 * sin(10.0 * position.x + u_time)
                     * cos(10.0 * position.y + u_time);
  vec3 newPosition = position + normal * displacement;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
