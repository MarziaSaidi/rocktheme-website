import { CylinderGeometry, DoubleSide, Mesh, SRGBColorSpace, TextureLoader } from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";

/**
 * A real mountain on the cabin world's horizon.
 *
 * The clearing's own sky is a photo of a flat snowfield, with no skyline.
 * This stands a real peak beyond the hall: Ama Dablam in the Himalayas,
 * from "Himalayas, Ama Dablam, Nepal" by Vyacheslav Argenberg, CC BY 4.0
 * (https://commons.wikimedia.org/wiki/File:Himalayas,_Ama_Dablam,_Nepal.jpg).
 * Prepared by scripts/prepare-skyline.mjs, which feathers it into the sky.
 *
 * It is drawn on a section of a cylinder far out round the clearing, so it
 * stays the same size and shape from anywhere the visitor can walk, like any
 * distant mountain. It is the first thing seen on arrival, to the left of the
 * hall, and what the homepage's rift shows through its opening.
 */

const SOURCE = "/assets/cabin/sky/skyline.webp";

/** Centre of the clearing, how far out, where it faces (radians, from −z), how wide. */
const PLACEMENT = {
  centre: [-1, -5] as const,
  radius: 300,
  /** To the left of the hall as seen on arrival. */
  facing: 0.95,
  arc: 1.9,
  /** Its base, below the horizon so the treeline and haze hide it. */
  base: -26,
};

export async function buildSkyline(keep: <T extends { dispose: () => void }>(item: T) => T) {
  const texture = keep(await new TextureLoader().loadAsync(SOURCE));
  texture.colorSpace = SRGBColorSpace;
  const aspect = texture.image.width / texture.image.height;
  // Tall enough that the photo keeps its own proportions across the arc.
  const height = (PLACEMENT.radius * PLACEMENT.arc) / aspect;

  const geometry = keep(
    new CylinderGeometry(
      PLACEMENT.radius,
      PLACEMENT.radius,
      height,
      64,
      1,
      true,
      // Three's cylinder angles start at +z and turn towards +x.
      Math.PI + PLACEMENT.facing - PLACEMENT.arc / 2,
      PLACEMENT.arc,
    ),
  );
  // Seen from inside: flip the texture so it reads the right way round.
  geometry.scale(-1, 1, 1);
  const material = keep(new MeshBasicNodeMaterial({ map: texture, transparent: true }));
  material.side = DoubleSide;
  material.depthWrite = false;
  material.fog = false;
  const mesh = new Mesh(geometry, material);
  mesh.name = "skyline";
  mesh.position.set(PLACEMENT.centre[0], PLACEMENT.base + height / 2, PLACEMENT.centre[1]);
  mesh.renderOrder = -1;
  return mesh;
}
