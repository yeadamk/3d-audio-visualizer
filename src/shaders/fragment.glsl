// ─────────────────────────────────────────────────────────────────────────────
// fragment.glsl
// ─────────────────────────────────────────────────────────────────────────────
precision mediump float;

varying vec3 vNormal;

uniform float u_frequency;
uniform float u_red;
uniform float u_green;
uniform float u_blue;

void main() {
  float rim = 1.0 - dot(normalize(vNormal), vec3(0.0, 0.0, 1.0));
  rim = pow(rim, 2.0);

  vec3 rimColor = vec3(u_red, u_green, u_blue) * rim;
  vec3 baseAmbient = vec3(0.05);
  vec3 color = rimColor + baseAmbient;

  gl_FragColor = vec4(color, 1.0);
}