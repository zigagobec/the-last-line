@group(0) @binding(1) var atlas: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;
@group(0) @binding(3) var<uniform> decals: array<vec4f, 4>;

struct VIn {
  @location(0) pos: vec3f,
  @location(1) normal: vec3f,
  @location(2) center: vec4f, // xyz, kind (0 tile, 1 bridge)
  @location(3) scale: vec4f,  // xyz, object id
  @location(4) tint: vec4f,
  @location(5) params: vec4f, // flags, decal index (-1 none), rotate 90°, seed
};

struct VOut {
  @builtin(position) clip: vec4f,
  @location(0) local: vec3f,
  @location(1) normal: vec3f,
  @location(2) @interpolate(flat) kindId: vec2f,
  @location(3) @interpolate(flat) tint: vec4f,
  @location(4) @interpolate(flat) params: vec4f,
  @location(5) @interpolate(flat) scale: vec3f,
};

const F_MARKED = 1u;
const F_HIGHLIGHT = 2u;
const F_HOVER = 4u;
const F_DENIED = 8u;
const F_GHOST = 16u;
// bits 5..8: neighbour land in +x, -x, +z, -z

@vertex
fn vs(v: VIn) -> VOut {
  var p = v.pos * v.scale.xyz;
  var n = v.normal;
  if (v.params.z > 0.5) {
    p = vec3f(p.z, p.y, -p.x);
    n = vec3f(n.z, n.y, -n.x);
  }
  var o: VOut;
  o.clip = g.viewProj * vec4f(v.center.xyz + p, 1.0);
  o.local = v.pos;
  o.normal = n;
  o.kindId = vec2f(v.center.w, v.scale.w);
  o.tint = v.tint;
  o.params = v.params;
  o.scale = v.scale.xyz;
  return o;
}

struct FOut {
  @location(0) color: vec4f,
  @location(1) nid: vec4f,
};

fn hasNeighbour(flags: u32, bit: u32) -> bool {
  return (flags & (1u << (5u + bit))) != 0u;
}

fn tileTop(i: VOut, flags: u32, seed: f32) -> vec3f {
  let uv = i.local.xz + 0.5;
  var col = PAPER;

  let d = i.params.y;
  if (d >= 0.0) {
    let rect = decals[u32(d)];
    let c = vec2f(0.32 + seed * 0.36, 0.3 + fract(seed * 7.13) * 0.4);
    let duv = (uv - c) / 0.5 + 0.5;
    if (all(duv >= vec2f(0.0)) && all(duv <= vec2f(1.0))) {
      let t = textureSampleLevel(atlas, samp, mix(rect.xy, rect.zw, duv), 0.0);
      col = col * (1.0 - t.a) + t.rgb;
    }
  }

  // Scalloped grass line along edges that face a gap or the outside.
  let wob = noise2(uv * 9.0 + seed * 31.0) * 0.012;
  var fringe = 0.0;
  let scal = 0.045 + 0.022 * abs(sin(uv.y * PI * 5.0 + seed * 9.0));
  let scalZ = 0.045 + 0.022 * abs(sin(uv.x * PI * 5.0 + seed * 9.0));
  if (!hasNeighbour(flags, 0u)) { fringe = max(fringe, lineMask((1.0 - uv.x) - scal - wob, 1.6)); }
  if (!hasNeighbour(flags, 1u)) { fringe = max(fringe, lineMask(uv.x - scal - wob, 1.6)); }
  if (!hasNeighbour(flags, 2u)) { fringe = max(fringe, lineMask((1.0 - uv.y) - scalZ - wob, 1.6)); }
  if (!hasNeighbour(flags, 3u)) { fringe = max(fringe, lineMask(uv.y - scalZ - wob, 1.6)); }

  if ((flags & F_MARKED) != 0u) {
    let h = stripes((uv.x + uv.y) * 6.0 + noise2(uv * 6.0) * 0.4, 0.3);
    col = mix(col, vec3f(0.86, 0.2, 0.14), h * 0.75);
  }
  if ((flags & F_HIGHLIGHT) != 0u) {
    let hover = (flags & F_HOVER) != 0u;
    let h = stripes((uv.x - uv.y) * select(5.0, 7.0, hover) + noise2(uv * 5.0 + seed) * 0.5, select(0.32, 0.5, hover));
    col = mix(col, i.tint.rgb, h * select(0.6, 0.95, hover));
    let e = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    col = mix(col, i.tint.rgb, lineMask(e - 0.1 - noise2(uv * 11.0 + seed) * 0.03, select(1.5, 3.0, hover)));
  } else if ((flags & F_HOVER) != 0u) {
    let e = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    col = mix(col, INK, 0.35 * lineMask(e - 0.1, 1.5));
  }
  if ((flags & F_DENIED) != 0u) {
    let a = lineMask(uv.x - uv.y, 3.0) + lineMask(uv.x + uv.y - 1.0, 3.0);
    let inside = step(abs(uv.x - 0.5), 0.25) * step(abs(uv.y - 0.5), 0.25);
    col = mix(col, vec3f(0.55, 0.52, 0.5), clamp(a, 0.0, 1.0) * inside);
  }
  return mix(col, INK, fringe);
}

fn tileSide(i: VOut, seed: f32) -> vec3f {
  let u = select(i.local.x, i.local.z, abs(i.normal.x) > 0.5) + 0.5;
  let v = -i.local.y; // 0 at top, 1 at bottom
  let band = 0.1 + 0.07 * abs(sin(u * PI * 5.0 + seed * 9.0)) + noise2(vec2f(u * 13.0, seed * 7.0)) * 0.04;
  let h = stripes(u * 24.0 + noise2(vec2f(u * 4.0, v * 2.0) + seed * 5.0) * 0.6, 0.38 + v * 0.25);
  var col = select(PAPER, mix(PAPER, INK, h * 0.8), v > band);
  col = mix(col, INK, lineMask(v - band, 1.8));
  // grass tuft flicks hanging over the edge
  let tuft = stripes(u * 11.0 + seed * 3.0, 0.08) * step(v, band + 0.06) * step(band, v);
  col = mix(col, INK, tuft * 0.8);
  return col;
}

fn bridgeColor(i: VOut, up: bool, seed: f32) -> vec3f {
  let along = i.local.x + 0.5;
  let across = i.local.z + 0.5;
  if (up) {
    let k = along * 8.0;
    // Continuous distance to the nearest plank seam keeps derivatives sane at a distance.
    let seam = lineMask(0.5 - abs(fract(k) - 0.5), 1.3);
    var c = vec3f(0.96, 0.95, 0.93);
    let grain = stripes(across * 4.0 + noise2(vec2f(k, across * 3.0) + seed) * 0.8, 0.08);
    c = mix(c, INK, grain * 0.25);
    let edge = min(across, 1.0 - across);
    let rail = lineMask(edge - 0.06, 1.3);
    return mix(c, INK, clamp(seam + rail, 0.0, 1.0));
  }
  let h = stripes((along + across) * 20.0, 0.5);
  return mix(PAPER, INK, 0.45 + h * 0.4);
}

@fragment
fn fs(i: VOut) -> FOut {
  let flags = u32(i.params.x + 0.5);
  let seed = i.params.w;
  let up = i.normal.y > 0.5;
  var col: vec3f;
  if (i.kindId.x < 0.5) {
    if (up) {
      col = tileTop(i, flags, seed);
    } else {
      col = tileSide(i, seed);
    }
  } else {
    col = bridgeColor(i, up, seed);
    if ((flags & F_GHOST) != 0u) {
      let px = vec2u(i.clip.xy / max(g.camUp.w * 1.5, 1.0));
      if (((px.x + px.y) & 1u) == 0u) {
        discard;
      }
      col = mix(col, i.tint.rgb, 0.55);
    }
  }
  var o: FOut;
  o.color = vec4f(col, 1.0);
  o.nid = vec4f(i.normal, i.kindId.y);
  return o;
}
