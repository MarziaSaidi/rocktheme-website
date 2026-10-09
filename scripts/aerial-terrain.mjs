// The range beyond the range (npm run prepare:aerial).
//
// Builds what stands behind and around the hero's mountains for the climb into
// Selected Work:
//   public/assets/aerial/terrain.bin    heightfield: low rock skirts that bury the
//       backs of the compressed ranges, the massif footprints, fjord water between.
//       header Int32 nx, nz; Float32 x0, z0, cell; then Float32 heights (z rows of x)
//   public/assets/aerial/massif.glb     the hero range's model, simplified, mesh only
//   public/assets/aerial/massif-lo.glb  the same, lighter, for far rows and narrow screens
// The massif layout itself is authored in public/assets/aerial/massif.json.
// Rock the approved water-level views can see stays under the old ranges' faces
// or under water; the runtime also skips it all below the haze ceiling.
import { NodeIO } from "@gltf-transform/core";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const massif = JSON.parse(await readFile("public/assets/aerial/massif.json", "utf8"));

const CELL = 2;
const X0 = -460,
  X1 = 460,
  Z0 = -1000,
  Z1 = 160;
const NX = Math.round((X1 - X0) / CELL) + 1;
const NZ = Math.round((Z1 - Z0) / CELL) + 1;
const idx = (i, k) => k * NX + i;
const wx = (i) => X0 + i * CELL;
const wz = (k) => Z0 + k * CELL;

// ------------------------------------------------------------- existing ranges
const io = new NodeIO();
async function loadTris(path) {
  const doc = await io.read(path);
  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const pos = prim.getAttribute("POSITION").getArray();
  const ind =
    prim.getIndices()?.getArray() ?? Uint32Array.from({ length: pos.length / 3 }, (_, i) => i);
  let mn = [1e9, 1e9, 1e9],
    mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < pos.length; i += 3)
    for (let a = 0; a < 3; a++) {
      mn[a] = Math.min(mn[a], pos[i + a]);
      mx[a] = Math.max(mx[a], pos[i + a]);
    }
  return { pos, ind, mn, mx };
}
const hero = { x: -24.7, z: 28.2 };
const K = 2.1,
  eye = [0.4, 0.8, 11];
const recede = (p) => [eye[0] + (p[0] - eye[0]) * K, p[1], eye[2] + (p[2] - eye[2]) * K];
// Unit-normalised (hero loader) placement → world transform
function unitPlacement(m, place) {
  const [px, py, pz] = recede(place.position);
  const W = place.width * K,
    H = place.height * K,
    D = place.depth * K;
  const s = [1 / (m.mx[0] - m.mn[0]), 1 / (m.mx[1] - m.mn[1]), 1 / (m.mx[2] - m.mn[2])];
  const c = [(m.mn[0] + m.mx[0]) / 2, m.mn[1], (m.mn[2] + m.mx[2]) / 2];
  const cy = Math.cos(place.yaw),
    sy = Math.sin(place.yaw);
  return (x, y, z) => {
    const lx = (x - c[0]) * s[0] * W,
      ly = (y - c[1]) * s[1] * H,
      lz = (z - c[2]) * s[2] * D;
    // three.js rotation.y: x' = x cos + z sin, z' = -x sin + z cos
    return [hero.x + px + lx * cy + lz * sy, py + ly, hero.z + pz - lx * sy + lz * cy];
  };
}
const Ex = new Float32Array(NX * NZ).fill(-1e9);
function raster(m, tf) {
  const { pos, ind } = m;
  const P = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    const w = tf(pos[i], pos[i + 1], pos[i + 2]);
    P[i] = w[0];
    P[i + 1] = w[1];
    P[i + 2] = w[2];
  }
  for (let t = 0; t < ind.length; t += 3) {
    const a = ind[t] * 3,
      b = ind[t + 1] * 3,
      c = ind[t + 2] * 3;
    const ax = P[a],
      az = P[a + 2],
      bx = P[b],
      bz = P[b + 2],
      cx = P[c],
      cz = P[c + 2];
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - X0) / CELL)),
      i1 = Math.min(NX - 1, Math.ceil((Math.max(ax, bx, cx) - X0) / CELL));
    const k0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - Z0) / CELL)),
      k1 = Math.min(NZ - 1, Math.ceil((Math.max(az, bz, cz) - Z0) / CELL));
    const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(den) < 1e-9) {
      // degenerate: splat max vertex
      for (const v of [a, b, c]) {
        const i = Math.round((P[v] - X0) / CELL),
          k = Math.round((P[v + 2] - Z0) / CELL);
        if (i >= 0 && i < NX && k >= 0 && k < NZ) Ex[idx(i, k)] = Math.max(Ex[idx(i, k)], P[v + 1]);
      }
      continue;
    }
    for (let k = k0; k <= k1; k++)
      for (let i = i0; i <= i1; i++) {
        const x = wx(i),
          z = wz(k);
        const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / den;
        const l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / den;
        const l3 = 1 - l1 - l2;
        const e = -0.02;
        if (l1 < e || l2 < e || l3 < e) continue;
        const y = l1 * P[a + 1] + l2 * P[b + 1] + l3 * P[c + 1];
        if (y > Ex[idx(i, k)]) Ex[idx(i, k)] = y;
      }
  }
}
const heroM = await loadTris("public/assets/hero/mountains.glb");
const swM = await loadTris("public/assets/selected-work/mountains.glb");
// desktop + mobile hero placements (both must stay protected)
raster(
  heroM,
  unitPlacement(heroM, { position: [16, -0.3, -66], width: 135, height: 30, depth: 34, yaw: 0 }),
);
raster(
  heroM,
  unitPlacement(heroM, { position: [-34, -0.3, -58], width: 90, height: 24, depth: 26, yaw: 2.6 }),
);
raster(
  heroM,
  unitPlacement(heroM, { position: [-10, -0.3, -66], width: 120, height: 30, depth: 34, yaw: 0 }),
);
raster(
  heroM,
  unitPlacement(heroM, { position: [-36, -0.3, -58], width: 90, height: 24, depth: 26, yaw: 2.6 }),
);
raster(swM, (x, y, z) => [0 + x * 104, -0.4 + y * 85, -64 + z * 34]);
let exCells = 0,
  exMax = 0;
for (let n = 0; n < Ex.length; n++)
  if (Ex[n] > 0) {
    exCells++;
    exMax = Math.max(exMax, Ex[n]);
  }
console.log("existing cells", exCells, "max", exMax.toFixed(1));

// ------------------------------------------------------------------- noise
const perm = new Uint8Array(512);
{
  let s = 1337;
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
}
const G = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
function simplex(x, y) {
  const F2 = 0.5 * (Math.sqrt(3) - 1),
    G2 = (3 - Math.sqrt(3)) / 6;
  const s = (x + y) * F2,
    i = Math.floor(x + s),
    j = Math.floor(y + s);
  const t = (i + j) * G2,
    x0 = x - (i - t),
    y0 = y - (j - t);
  const i1 = x0 > y0 ? 1 : 0,
    j1 = 1 - i1;
  const x1 = x0 - i1 + G2,
    y1 = y0 - j1 + G2,
    x2 = x0 - 1 + 2 * G2,
    y2 = y0 - 1 + 2 * G2;
  const ii = i & 255,
    jj = j & 255;
  let n = 0;
  for (const [dx, dy, gi] of [
    [x0, y0, perm[ii + perm[jj]]],
    [x1, y1, perm[ii + i1 + perm[jj + j1]]],
    [x2, y2, perm[ii + 1 + perm[jj + 1]]],
  ]) {
    let tt = 0.5 - dx * dx - dy * dy;
    if (tt > 0) {
      tt *= tt;
      const g = G[gi & 7];
      n += tt * tt * (g[0] * dx + g[1] * dy);
    }
  }
  return 70 * n;
}
function ridged(x, z) {
  // domain warp, then ridged multifractal
  const wxv = x + 60 * simplex(x / 400, z / 400),
    wzv = z + 60 * simplex(x / 400 + 31, z / 400 + 17);
  let f = 1 / 170,
    amp = 1,
    sum = 0,
    norm = 0,
    weight = 1;
  for (let o = 0; o < 8; o++) {
    let n = 1 - Math.abs(simplex(wxv * f, wzv * f));
    n *= n;
    n *= weight;
    weight = Math.min(1, Math.max(0, n * 1.6));
    sum += n * amp;
    norm += amp;
    f *= 2.03;
    amp *= 0.56;
  }
  return sum / norm;
}
const smooth = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------- protected eyes (approved views)
const protectedEyes = [
  [-24.3, 0.8, 39.2],
  [-23.4, 0.7, 37.5],
  [-11.8, 2, 30.9],
  [-5.3, 3.6, 22.1],
  [-17.6, 6.8, 30],
  [-30.1, 11.2, 37.7],
  [-38.4, 6.6, 21.1],
  [-37.5, 6.9, 17],
  [-12, 1.6, 14],
  [-22, 10.5, 47],
  [-26.9, 12.5, 45.9],
  [-35.6, 8, 25.6],
  [-12, 3, 22.5],
  [-12, 3, 46.5],
  [-22, 3, 56.5],
  [4.6, 3, 14.3],
  [4.4, 3.2, 29],
  [-34, 3.2, 2.5],
  [-24, 3.2, 8],
];
// Eyes whose *view* must look unchanged even with the haze lifted (start of the climb).
// The eyes inside the haze-lift window (y 13–32 on the climb): what they see must not change as the haze lifts.
const climbEyes = [
  [-11, 13, 14],
  [-11, 16, 12],
  [-10.5, 20, 9],
  [-41, 13, 17],
  [-41.5, 17, 14],
  [-42, 22, 10],
  [-24.3, 0.8, 39.2],
];

// --------------------------------------------------------------- base terrain
const Hn = new Float32Array(NX * NZ);
for (let k = 0; k < NZ; k++)
  for (let i = 0; i < NX; i++) {
    const x = wx(i),
      z = wz(k);
    let dl = 1e9;
    for (const e of protectedEyes) dl = Math.min(dl, Math.hypot(x - e[0], z - e[2]) - 70);
    const rise = smooth(0, 140, dl);
    let A = 6 + 4 * smooth(-60, -330, z);
    A *= 1 - 0.35 * smooth(80, 200, z); // lower to the south
    const r = ridged(x, z);
    // The valley floor between the ranges is water (fjords); rock only where it carries a massif.
    let h = A * (0.05 + 1.15 * Math.pow(r, 1.35)) - 10;
    // Footprints of the sculpted massifs (massif.json): the base rises under their borders so no
    // tile edge or flat bottom ever shows.
    for (const m of massif) {
      const c = Math.cos(m.yaw),
        sn = Math.sin(m.yaw);
      const dx = x - m.x,
        dz = z - m.z;
      const lx = dx * c - dz * sn,
        lz = dx * sn + dz * c;
      const W = m.width,
        D = W * 0.9124,
        Hm = W * 0.2663;
      const out = Math.max(Math.abs(lx) - W / 2, Math.abs(lz) - D / 2);
      h = Math.max(h, Hm * 0.13 * smooth(28, -6, out) * (0.85 + 0.3 * r) - 4 * smooth(-6, 28, out));
    }
    Hn[idx(i, k)] = -6 + (h + 6) * rise;
  }

// ------------------------------------------------------- hydraulic erosion (droplets)
function erode(H, drops) {
  let seed = 9;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const inertia = 0.05,
    capacityK = 4,
    minSlope = 0.01,
    deposit = 0.3,
    erodeK = 0.3,
    evap = 0.012,
    gravity = 4,
    life = 60;
  const sample = (x, z) => {
    const i = Math.floor(x),
      k = Math.floor(z),
      u = x - i,
      v = z - k;
    const a = H[idx(i, k)],
      b = H[idx(i + 1, k)],
      c = H[idx(i, k + 1)],
      d = H[idx(i + 1, k + 1)];
    return {
      h: a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v,
      gx: (b - a) * (1 - v) + (d - c) * v,
      gz: (c - a) * (1 - u) + (d - b) * u,
    };
  };
  for (let n = 0; n < drops; n++) {
    let x = 1 + rnd() * (NX - 3),
      z = 1 + rnd() * (NZ - 3),
      dx = 0,
      dz = 0,
      speed = 1,
      water = 1,
      sed = 0;
    for (let s = 0; s < life; s++) {
      const i = Math.floor(x),
        k = Math.floor(z),
        u = x - i,
        v = z - k;
      const g = sample(x, z);
      dx = dx * inertia - g.gx * (1 - inertia);
      dz = dz * inertia - g.gz * (1 - inertia);
      const len = Math.hypot(dx, dz);
      if (len < 1e-6) break;
      dx /= len;
      dz /= len;
      const nx = x + dx,
        nz = z + dz;
      if (nx < 1 || nx > NX - 2 || nz < 1 || nz > NZ - 2) break;
      const dh = sample(nx, nz).h - g.h;
      if (g.h < -2) break; // in the lake
      const cap = Math.max(-dh, minSlope) * speed * water * capacityK;
      const w = [(1 - u) * (1 - v), u * (1 - v), (1 - u) * v, u * v],
        c = [idx(i, k), idx(i + 1, k), idx(i, k + 1), idx(i + 1, k + 1)];
      if (sed > cap || dh > 0) {
        const amt = dh > 0 ? Math.min(dh, sed) : (sed - cap) * deposit;
        sed -= amt;
        for (let q = 0; q < 4; q++) H[c[q]] += amt * w[q];
      } else {
        const amt = Math.min((cap - sed) * erodeK, -dh);
        for (let q = 0; q < 4; q++) H[c[q]] -= amt * w[q];
        sed += amt;
      }
      speed = Math.sqrt(Math.max(0, speed * speed + dh * -gravity * 1));
      water *= 1 - evap;
      x = nx;
      z = nz;
    }
  }
}
// erosion works in cell units: scale heights to cells, erode, scale back
for (let n = 0; n < Hn.length; n++) Hn[n] /= CELL;
const t0 = Date.now();
erode(Hn, 420000);
for (let n = 0; n < Hn.length; n++) Hn[n] *= CELL;
console.log("erosion ms", Date.now() - t0);
// Thermal erosion: rock does not stand steeper than its talus angle (~55°).
{
  const talus = Math.tan((55 * Math.PI) / 180) * CELL;
  for (let it = 0; it < 60; it++) {
    for (let k = 1; k < NZ - 1; k++)
      for (let i = 1; i < NX - 1; i++) {
        const n = idx(i, k);
        for (const m of [n - 1, n + 1, n - NX, n + NX]) {
          const d = Hn[n] - Hn[m];
          if (d > talus) {
            const move = (d - talus) * 0.25;
            Hn[n] -= move;
            Hn[m] += move;
          }
        }
      }
  }
}

// ------------------------------------- shoulders: bury the backs of the compressed ranges
// Where an existing range stands, new rock rises behind it to ~80% of the local crest so its
// thin back faces become the front of a deep massif.
const crestZ = new Float32Array(NX).fill(NaN),
  crestH = new Float32Array(NX);
// crest along each x column for the yaw-0 ranges (hero range + SW range): the front-most strong peak
for (let i = 0; i < NX; i++) {
  let best = 0,
    bz = NaN;
  for (let k = 0; k < NZ; k++) {
    const e = Ex[idx(i, k)];
    if (e > best) {
      best = e;
      bz = wz(k);
    }
  }
  crestZ[i] = bz;
  crestH[i] = best;
}
// smooth crest height along x
const crestHs = new Float32Array(NX);
for (let i = 0; i < NX; i++) {
  let s = 0,
    w = 0;
  for (let d = -6; d <= 6; d++) {
    const j = i + d;
    if (j >= 0 && j < NX && crestH[j] > 0) {
      s += crestH[j];
      w++;
    }
  }
  crestHs[i] = w ? s / w : 0;
}
for (let k = 0; k < NZ; k++)
  for (let i = 0; i < NX; i++) {
    const n = idx(i, k),
      z = wz(k);
    if (!(crestHs[i] > 4) || isNaN(crestZ[i])) continue;
    const behind = crestZ[i] - z; // > 0 north of the crest
    if (behind <= 0) continue;
    // A short skirt: enough to bury the back-edge walls of the compressed tiles, then down into water.
    const shoulder = Math.max(16, 0.4 * crestHs[i]) * (0.85 + 0.3 * ridged(wx(i) * 3, z * 3));
    const blend = smooth(4, 34, behind);
    const target = shoulder * (1 - blend) + Hn[n] * blend;
    Hn[n] = Math.max(Hn[n], target);
  }

// --------------------------------------------- occlusion constraint from the climb eyes
// For each eye: max line-of-sight slope over existing geometry along the ray → horizon height.
const az0 = -0.75,
  az1 = 0.75; // the ascent and the descent look north: ±43°
const Hcap = new Float32Array(NX * NZ).fill(1e9);
for (const e of climbEyes) {
  for (let k = 0; k < NZ; k++)
    for (let i = 0; i < NX; i++) {
      const x = wx(i),
        z = wz(k),
        dx = x - e[0],
        dz = z - e[2];
      const d = Math.hypot(dx, dz);
      if (d < 1) continue;
      const az = Math.atan2(dx, -dz);
      if (az < az0 || az > az1) continue;
      if (d > (e[1] < 2 ? 150 : 320)) continue;
      const steps = Math.ceil(d / (CELL * 0.75));
      let blocked = false,
        maxSlope = -1e9;
      for (let s = 1; s < steps; s++) {
        const t = s / steps,
          px = e[0] + dx * t,
          pz = e[2] + dz * t;
        const ii = Math.round((px - X0) / CELL),
          kk = Math.round((pz - Z0) / CELL);
        const h = Ex[idx(ii, kk)];
        if (h <= 0.5) continue;
        blocked = true;
        const sl = (h - e[1]) / (d * t);
        if (sl > maxSlope) maxSlope = sl;
      }
      const n = idx(i, k);
      const ex = Ex[n];
      let cap = 1e9;
      if (!blocked)
        cap = ex > 0.5 ? ex - 2.5 : -4; // open water in front of the ranges stays lake
      else if (ex > 0.5 && ex >= e[1] + maxSlope * d - 0.5) cap = ex - 2.5; // a visible face of an existing range
      if (cap < Hcap[n]) Hcap[n] = cap;
    }
}
// protected discs: always lake
for (let k = 0; k < NZ; k++)
  for (let i = 0; i < NX; i++) {
    const x = wx(i),
      z = wz(k);
    const n = idx(i, k);
    for (const e of protectedEyes)
      if (Math.hypot(x - e[0], z - e[2]) < 62) {
        Hcap[n] = Math.min(Hcap[n], -4);
        break;
      }
    // under the existing ranges' front faces the cap above already applies; never poke out of a range's own surface by < 2.5
    Hn[n] = Math.min(Hn[n], Math.max(Hcap[n], -8));
  }
// soften the cap edge a touch (3x3 min-preserving blur limited to not exceed cap)
const out = new Float32Array(Hn);
for (let k = 1; k < NZ - 1; k++)
  for (let i = 1; i < NX - 1; i++) {
    let s = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) s += Hn[idx(i + a, k + b)];
    out[idx(i, k)] = Math.min(s / 9, Math.max(Hcap[idx(i, k)], -8));
  }
let mx = -1e9;
for (const v of out) mx = Math.max(mx, v);
console.log("grid", NX, "x", NZ, "max height", mx.toFixed(1));

await mkdir("public/assets/aerial", { recursive: true });
const head = Buffer.alloc(20);
head.writeInt32LE(NX, 0);
head.writeInt32LE(NZ, 4);
head.writeFloatLE(X0, 8);
head.writeFloatLE(Z0, 12);
head.writeFloatLE(CELL, 16);
await writeFile("public/assets/aerial/terrain.bin", Buffer.concat([head, Buffer.from(out.buffer)]));
// The massif models: geometry only; the runtime gives them the hero range's own maps.
{
  const { simplify, weld } = await import("@gltf-transform/functions");
  const { MeshoptSimplifier } = await import("meshoptimizer");
  await MeshoptSimplifier.ready;
  for (const [name, ratio, error] of [
    ["massif.glb", 0.3, 0.002],
    ["massif-lo.glb", 0.1, 0.01],
  ]) {
    const doc = await io.read("public/assets/hero/mountains.glb");
    await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error }));
    doc
      .getRoot()
      .listTextures()
      .forEach((texture) => texture.dispose());
    await io.write(`public/assets/aerial/${name}`, doc);
  }
}
console.log("written");
