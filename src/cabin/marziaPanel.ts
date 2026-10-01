import {
  CanvasTexture,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Raycaster,
  SRGBColorSpace,
  Vector2,
  type PerspectiveCamera,
} from "three";

import { createMarziaField } from "./marziaOriginal";
import { MARZIA } from "./stations";

/**
 * Shows the original MARZIA effect standing in the clearing.
 *
 * The old site's code draws into its own canvas exactly as it always did;
 * this only puts that canvas on a panel in the world, turns the panel to
 * face the visitor, and tells the code where the cursor is over it.
 */

/** The canvas the original draws into, in CSS pixels. */
const FIELD = { width: 1200, height: 700 };
/** Share of the canvas width the word covers at that size. */
const WORD_SHARE = 0.79;
/** Where the original centres the word vertically (cy = height × .48). */
const WORD_CENTRE = 0.48;

export function buildMarziaPanel({ theme }: { theme: "light" | "dark" }) {
  const field = createMarziaField({
    ...FIELD,
    theme,
    pixelRatio: 1,
  });

  const texture = new CanvasTexture(field.canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;

  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });

  const width = MARZIA.width / WORD_SHARE;
  const height = (width * FIELD.height) / FIELD.width;
  const geometry = new PlaneGeometry(width, height);
  // The canvas is uploaded unflipped (the fast path), so flip the panel's UVs.
  const uvs = geometry.getAttribute("uv");
  for (let i = 0; i < uvs.count; i++) uvs.setY(i, 1 - uvs.getY(i));
  const panel = new Mesh(geometry, material);
  panel.renderOrder = 3;
  // The word's base sits just above the snow.
  const wordHeight = height * 0.35;
  const wordCentreY = 0.2 + wordHeight / 2;
  // The word sits 2% above the canvas centre, so the panel sits that much lower.
  panel.position.set(
    MARZIA.centre[0],
    wordCentreY - (0.5 - WORD_CENTRE) * height,
    MARZIA.centre[2],
  );

  const raycaster = new Raycaster();
  const ndc = new Vector2();

  return {
    panel,
    update: (camera: PerspectiveCamera, ms: number) => {
      // Face the visitor, turning only about the vertical.
      panel.rotation.y = Math.atan2(
        camera.position.x - panel.position.x,
        camera.position.z - panel.position.z,
      );
      field.render(ms);
      texture.needsUpdate = true;
    },
    /** Pointer in normalised device coordinates over the cabin canvas. */
    pointer: (x: number, y: number, camera: PerspectiveCamera) => {
      ndc.set(x, y);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObject(panel, false)[0];
      if (!hit?.uv) {
        field.pointerMove(-1, -1);
        return;
      }
      field.pointerMove(hit.uv.x * FIELD.width, hit.uv.y * FIELD.height);
    },
    pointerLeave: () => field.pointerLeave(),
    setTheme: (theme: "light" | "dark") => field.applyTheme(theme),
    dispose: () => {
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
