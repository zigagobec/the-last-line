@group(0) @binding(1) var colorTex: texture_2d<f32>;
@group(0) @binding(2) var nidTex: texture_2d<f32>;
@group(0) @binding(3) var depthTex: texture_depth_2d;

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
  let p = array(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(p[vi], 0.0, 1.0);
}

fn clampPx(p: vec2i) -> vec2i {
  let s = vec2i(textureDimensions(nidTex)) - vec2i(1);
  return clamp(p, vec2i(0), s);
}

fn idAt(p: vec2i) -> f32 {
  return textureLoad(nidTex, clampPx(p), 0).w;
}

fn paper(fc: vec2f, dpr: f32) -> vec3f {
  var col = vec3f(0.955, 0.944, 0.912);
  // Faint isometric grid, like the sketchbook paper in the design document.
  let s = 30.0 * dpr;
  let p = fc / s;
  let k = 0.57735;
  let norm = s / sqrt(1.0 + k * k);
  let a = (0.5 - abs(fract(p.y + p.x * k) - 0.5)) * norm;
  let b = (0.5 - abs(fract(p.y - p.x * k) - 0.5)) * norm;
  let c = (0.5 - abs(fract(p.x * 2.0 * k) - 0.5)) * s / (2.0 * k);
  let lw = 0.6 * dpr;
  let grid = max(max(1.0 - smoothstep(lw, lw + dpr, a), 1.0 - smoothstep(lw, lw + dpr, b)), 1.0 - smoothstep(lw, lw + dpr, c));
  col = mix(col, vec3f(0.74, 0.79, 0.86), grid * 0.28);
  return col;
}

@fragment
fn fs(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let dpr = g.camUp.w;
  let boil = g.camRight.w;
  let q = fc.xy / dpr;
  let jitter = vec2f(noise2(q * 0.045 + boil * 17.1), noise2(q * 0.045 + vec2f(41.0, 7.0) + boil * 9.3)) - 0.5;
  let pc = vec2i(fc.xy + jitter * 2.6 * dpr);

  let id0 = idAt(pc);
  let r = max(1.0, 1.15 * dpr);
  var diff = 0.0;
  for (var k = 0; k < 8; k++) {
    let ang = f32(k) * PI * 0.25;
    let o = vec2i(round(vec2f(cos(ang), sin(ang)) * r));
    diff += select(0.0, 1.0, idAt(pc + o) != id0);
  }
  let edge = clamp(diff / 3.0, 0.0, 1.0);

  let p = vec2i(fc.xy);
  var col: vec3f;
  if (textureLoad(depthTex, clampPx(p), 0) >= 1.0) {
    col = paper(fc.xy, dpr);
  } else {
    col = textureLoad(colorTex, clampPx(p), 0).rgb;
  }
  col = mix(col, INK, edge);
  col *= 0.97 + 0.03 * noise2(q * 0.9);
  return vec4f(col, 1.0);
}
