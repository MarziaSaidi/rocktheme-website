import {
  LinearSRGBColorSpace,
  Matrix3,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type BufferGeometry,
  type Matrix4,
  type Texture,
} from "three";

/**
 * Real surfaces for the cabin: Poly Haven PBR sets prepared by
 * `npm run prepare:cabin`, and world-space UVs so every wall, beam and slab
 * shows wood, stone and snow at true scale with no seams between pieces.
 */
export type SurfaceRole = "walls" | "roof" | "stone" | "floor" | "snow" | "timber";

const BASE = "/assets/cabin/materials";

/** Metres covered by one repeat of each texture. */
export const TILE: Readonly<Record<SurfaceRole, number>> = {
  walls: 2.2,
  roof: 2.5,
  stone: 1.6,
  floor: 2,
  snow: 5.5,
  timber: 1.8,
};

type TextureSet = Readonly<{ color: Texture; normal: Texture; orm: Texture }>;

/** Weathers the raw planks down so trims sit with the dark logs. */
const ROLE_TINT: Partial<Record<SurfaceRole, string>> = { timber: "#8f7a66" };

export async function loadSurfaces(maxAnisotropy: number) {
  const loader = new TextureLoader();
  const load = async (url: string, srgb: boolean) => {
    const texture = await loader.loadAsync(url);
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.colorSpace = srgb ? SRGBColorSpace : LinearSRGBColorSpace;
    texture.anisotropy = Math.min(8, maxAnisotropy);
    return texture;
  };
  const roles: SurfaceRole[] = ["walls", "roof", "stone", "floor", "snow", "timber"];
  const sets = await Promise.all(
    roles.map(async (role) => {
      const [color, normal, orm] = await Promise.all([
        load(`${BASE}/${role}/color.webp`, true),
        load(`${BASE}/${role}/normal.webp`, false),
        load(`${BASE}/${role}/orm.webp`, false),
      ]);
      return [role, { color, normal, orm }] as const;
    }),
  );
  return new Map<SurfaceRole, TextureSet>(sets);
}

export type Surfaces = Awaited<ReturnType<typeof loadSurfaces>>;

/**
 * A PBR material for a role. Interior pieces get less sky reflection, since
 * the environment map doesn't know the walls are there.
 */
export function surfaceMaterial(
  surfaces: Surfaces,
  role: SurfaceRole,
  { interior = false, tint }: { interior?: boolean; tint?: string } = {},
) {
  const set = surfaces.get(role)!;
  const material = new MeshStandardMaterial({
    map: set.color,
    normalMap: set.normal,
    aoMap: set.orm,
    roughnessMap: set.orm,
    roughness: 1,
    metalness: 0,
    color: tint ?? ROLE_TINT[role] ?? "#ffffff",
    envMapIntensity: interior ? 0.35 : 1,
  });
  if (role === "snow") {
    // Fresh snow is soft: shallow creases, not dark cracks.
    material.aoMapIntensity = 0.3;
    material.normalScale.setScalar(0.55);
  }
  return material;
}

const normal = new Vector3();
const point = new Vector3();

/**
 * Box-projects UVs from world position: each face takes the two world axes
 * it lies across. Pieces built next to each other therefore line up, and a
 * plank or stone is the same size wherever it appears. `swap` turns the
 * pattern a quarter, for textures whose grain runs the wrong way.
 */
export function applyWorldUVs(
  geometry: BufferGeometry,
  matrixWorld: Matrix4,
  tile: number,
  { swap = false }: { swap?: boolean } = {},
) {
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const uv = geometry.getAttribute("uv");
  if (!positions || !normals || !uv) return;
  const normalMatrix = new Matrix3().getNormalMatrix(matrixWorld);

  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i).applyMatrix4(matrixWorld);
    normal.fromBufferAttribute(normals, i).applyMatrix3(normalMatrix).normalize();
    const ax = Math.abs(normal.x);
    const ay = Math.abs(normal.y);
    const az = Math.abs(normal.z);
    let u: number;
    let v: number;
    if (ay >= ax && ay >= az) {
      u = point.x;
      v = point.z;
    } else if (ax >= az) {
      u = point.z;
      v = point.y;
    } else {
      u = point.x;
      v = point.y;
    }
    if (swap) [u, v] = [v, u];
    uv.setXY(i, u / tile, v / tile);
  }
  uv.needsUpdate = true;
}
