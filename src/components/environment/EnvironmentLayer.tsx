import styles from "./EnvironmentLayer.module.css";
import type { SectionId } from "@/config/sections";
import { getSceneSection } from "@/webgl/sceneConfig";

type EnvironmentLayerProps = Readonly<{
  sectionId: SectionId;
}>;

/**
 * Static stand-in for the Stage 5 WebGL environment.
 *
 * It paints the horizon, the purple light beacons, the reflective floor, and two
 * atmosphere with plain CSS so the composition has depth before any canvas
 * exists. It is purely decorative: no text, no controls, no animation, and it is
 * hidden from assistive technology. Replacing it later must not change the DOM
 * around it.
 */
export function EnvironmentLayer({ sectionId }: EnvironmentLayerProps) {
  const scene = getSceneSection(sectionId);
  const lights = scene.horizonLights.sources;

  return (
    <div
      aria-hidden="true"
      data-scene-section={sectionId}
      className={styles.layer}
      style={{ "--horizon": `${scene.fallbackHorizonPercent}%` } as React.CSSProperties}
    >
      <div className={styles.sky} />

      <div className={styles.beacons}>
        {lights.map((light) => (
          <span
            key={light.position}
            className={styles.beacon}
            style={{ "--x": `${light.position * 100}%` } as React.CSSProperties}
          />
        ))}
      </div>

      <div className={styles.horizonLine} />

      <div className={styles.floor}>
        <div className={styles.grain} />
        {lights.map((light) => (
          <span
            key={light.position}
            className={styles.reflection}
            style={{ "--x": `${light.position * 100}%` } as React.CSSProperties}
          />
        ))}
      </div>
    </div>
  );
}
