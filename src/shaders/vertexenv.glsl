uniform float amplitude;
uniform float u_time;
uniform float u_frequency;

void main(){
    vec3 newpos = position;
    vec3 target = position + (normal * 0.1) + curl(newpos.x * frequency, newpos.y * frequency, newpos.z * frequency) * amplitude;]
    float d = length(newpos - target) / maxDistance;
    newpos = mix(position, target, pow(d, 4.0));
}