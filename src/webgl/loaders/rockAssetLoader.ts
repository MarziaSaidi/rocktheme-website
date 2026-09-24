import type { Object3D } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { rockAssets, type RockAssetId } from "../sceneConfig";

/** Resolves every runtime GLB request through the typed asset registry. */
export function loadRockAsset(
  loader: GLTFLoader,
  assetId: RockAssetId,
  onLoad: (model: Object3D) => void,
  onError: (error: unknown) => void,
): void {
  loader.load(rockAssets[assetId].source, ({ scene }) => onLoad(scene), undefined, onError);
}
