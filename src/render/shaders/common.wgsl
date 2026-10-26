diagnostic(off, derivative_uniformity);

struct Globals {
  viewProj: mat4x4f,
  camPos: vec4f,   // xyz eye, w time (s)
  camRight: vec4f, // xyz camera right, w boil seed (changes ~8x/s)
  camUp: vec4f,    // xyz camera up, w device pixel ratio
  screen: vec4f,   // width, height (device px), near, far
};
@group(0) @binding(0) var<uniform> g: Globals;

const INK = vec3f(0.12, 0.11, 0.13);
const PAPER = vec3f(0.99, 0.982, 0.955);
const PI = 3.14159265;

fn hash21(p: vec2f) -> f32 {
  var q = fract(p * vec2f(123.34, 456.21));
  q += dot(q, q + 45.32);
  return fract(q.x * q.y);
}

fn noise2(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2f(1.0, 0.0)), u.x),
    mix(hash21(i + vec2f(0.0, 1.0)), hash21(i + vec2f(1.0, 1.0)), u.x),
    u.y,
  );
}

/** Anti-aliased stripes: 1 where fract(x) < fill. */
fn stripes(x: f32, fill: f32) -> f32 {
  let w = max(fwidth(x), 1e-4);
  let f = fract(x);
  return clamp((fill - f) / w + 0.5, 0.0, 1.0) * clamp(f / w + 0.5, 0.0, 1.0);
}

/** Anti-aliased line of ~`px` device pixels where `d` (any unit) crosses zero. */
fn lineMask(d: f32, px: f32) -> f32 {
  let w = max(fwidth(d), 1e-5);
  return 1.0 - smoothstep(px * 0.5 * w, (px * 0.5 + 1.0) * w, abs(d));
}
