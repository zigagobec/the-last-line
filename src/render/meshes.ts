/**
 * Unit box: x and z in [-0.5, 0.5], y in [-1, 0] (top face at y = 0).
 * Vertex layout: position.xyz, normal.xyz (24 bytes).
 */
export function boxMesh(): { vertices: Float32Array; indices: Uint16Array } {
  const faces: { n: [number, number, number]; corners: [number, number, number][] }[] = [
    { n: [0, 1, 0], corners: [[-0.5, 0, -0.5], [-0.5, 0, 0.5], [0.5, 0, 0.5], [0.5, 0, -0.5]] },
    { n: [0, -1, 0], corners: [[-0.5, -1, -0.5], [0.5, -1, -0.5], [0.5, -1, 0.5], [-0.5, -1, 0.5]] },
    { n: [1, 0, 0], corners: [[0.5, 0, 0.5], [0.5, -1, 0.5], [0.5, -1, -0.5], [0.5, 0, -0.5]] },
    { n: [-1, 0, 0], corners: [[-0.5, 0, -0.5], [-0.5, -1, -0.5], [-0.5, -1, 0.5], [-0.5, 0, 0.5]] },
    { n: [0, 0, 1], corners: [[-0.5, 0, 0.5], [-0.5, -1, 0.5], [0.5, -1, 0.5], [0.5, 0, 0.5]] },
    { n: [0, 0, -1], corners: [[0.5, 0, -0.5], [0.5, -1, -0.5], [-0.5, -1, -0.5], [-0.5, 0, -0.5]] },
  ];
  const vertices: number[] = [];
  const indices: number[] = [];
  faces.forEach((f, i) => {
    for (const c of f.corners) vertices.push(...c, ...f.n);
    const b = i * 4;
    indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) };
}
