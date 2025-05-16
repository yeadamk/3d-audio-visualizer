varying vec3 vNormal;
uniform float u_red;
uniform float u_green;
uniform float u_blue;

void main() {
  float intensity = pow(0.9 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 4.0);
  vec3 baseColor = vec3(u_red, u_green, u_blue);
  gl_FragColor = vec4(baseColor * intensity, 1.0);
}
