@group(0) @binding(1) var atlas: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;

struct VIn {
  @builtin(vertex_index) vi: u32,
  @location(0) pos: vec4f,   // anchor xyz, reveal
  @location(1) size: vec4f,  // width, height, flip, seed
  @location(2) uv: vec4f,    // u0 v0 u1 v1 (v0 = top)
  @location(3) tint: vec4f,  // rgb tint, amount
  @location(4) extra: vec4f, // alpha, 0, 0, 0
};

struct VOut {
  @builtin(position) clip: vec4f,
  @location(0) uv: vec2f,
  @location(1) local: vec2f,
  @location(2) @interpolate(flat) reveal: f32,
  @location(3) @interpolate(flat) tint: vec4f,
  @location(4) @interpolate(flat) alphaSeed: vec2f,
};

@vertex
fn vs(v: VIn) -> VOut {
  let c = vec2f(f32(v.vi & 1u), f32(v.vi >> 1u));
  let world = v.pos.xyz + g.camRight.xyz * (c.x - 0.5) * v.size.x + g.camUp.xyz * c.y * v.size.y;
  // Depth as if the sprite stood a bit closer to the camera, so its own tile top never cuts its feet.
  let toCam = normalize(g.camPos.xyz - v.pos.xyz);
  let dclip = g.viewProj * vec4f(world + toCam * 0.75, 1.0);
  var o: VOut;
  o.clip = g.viewProj * vec4f(world, 1.0);
  o.clip.z = clamp(dclip.z / dclip.w, 0.0, 1.0) * o.clip.w;
  let fu = select(c.x, 1.0 - c.x, v.size.z > 0.5);
  o.uv = vec2f(mix(v.uv.x, v.uv.z, fu), mix(v.uv.w, v.uv.y, c.y));
  o.local = c;
  o.reveal = v.pos.w;
  o.tint = v.tint;
  o.alphaSeed = vec2f(v.extra.x, v.size.w);
  return o;
}

@fragment
fn fs(i: VOut) -> @location(0) vec4f {
  var t = textureSample(atlas, samp, i.uv);
  if (i.reveal < 0.999) {
    // Sketch-in: strokes appear bottom-up with a ragged front.
    let front = i.local.y + noise2(i.local * 9.0 + i.alphaSeed.y * 13.0) * 0.35;
    if (front > i.reveal * 1.4) {
      discard;
    }
  }
  let rgb = mix(t.rgb, i.tint.rgb * t.a, i.tint.a);
  return vec4f(rgb, t.a) * i.alphaSeed.x;
}
