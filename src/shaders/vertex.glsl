// ─────────────────────────────────────────────────────────────────────────────
// vertex.glsl
// ─────────────────────────────────────────────────────────────────────────────
precision mediump float;

uniform float u_time;
uniform float u_frequency;

varying vec3 vNormal;

// ─────────────────────────────────────────────────────────────────────────────
// 3D Simplex Noise
// ─────────────────────────────────────────────────────────────────────────────
vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
  return mod289(((x * 34.0) + 1.0) * x);
}
vec4 taylorInvSqrt(vec4 r) {
  return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  // First corner
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  // Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  // Permutations (note: we now have a vec3 i, so use vec3‐mod289 overload)
  i = mod289(i);
  vec4 j = permute(
              permute(
                permute(i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 1.0 / 7.0; // Because we’re on a 7×7×6 lattice
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j0 = j - 49.0 * floor(j * ns.z * ns.z);
  vec4 x_ = floor(j0 * ns.z);
  vec4 y_ = floor(j0 - 7.0 * x_);

  vec4 x1v = x_ * ns.x + ns.y;
  vec4 y1v = y_ * ns.x + ns.y;
  vec4 h = 1.0 - abs(x1v) - abs(y1v);

  vec4 b0 = vec4(x1v.x, y1v.x, x1v.y, y1v.y);
  vec4 b1 = vec4(x1v.z, y1v.z, x1v.w, y1v.w);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 g0 = vec3(a0.x, a0.y, h.x);
  vec3 g1 = vec3(a0.z, a0.w, h.y);
  vec3 g2 = vec3(a1.x, a1.y, h.z);
  vec3 g3 = vec3(a1.z, a1.w, h.w);

  vec4 norm = taylorInvSqrt(
    vec4(dot(g0, g0), dot(g1, g1), dot(g2, g2), dot(g3, g3))
  );
  g0 *= norm.x;
  g1 *= norm.y;
  g2 *= norm.z;
  g3 *= norm.w;

  vec4 m = max(
    vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)),
    0.0
  );
  m = m * m;
  return 42.0 * dot(
    m * m,
    vec4(
      dot(g0, x0),
      dot(g1, x1),
      dot(g2, x2),
      dot(g3, x3)
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
void main() {
  vNormal = normalize(normalMatrix * normal);

  float noise = snoise(position + vec3(u_time * 0.1));
  
  float displacement = 0.0;
  if (u_frequency > 0.0) {
    float normalized_freq = clamp(u_frequency / 60.0, 0.0, 2.0);
    float amplitude = 0.1;
    displacement = amplitude * normalized_freq * noise;
  }

  vec3 newPos = position + (normal * displacement);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
  gl_PointSize = 3.0;
}