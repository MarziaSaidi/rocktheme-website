import { CanvasTexture, EquirectangularReflectionMapping, SRGBColorSpace } from "three";

/** A seamless night panorama; generated locally so the sky needs no extra download. */
export function buildNightSky() {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#040916");
  sky.addColorStop(0.32, "#0b1730");
  sky.addColorStop(0.5, "#24354b");
  sky.addColorStop(0.62, "#111e30");
  sky.addColorStop(1, "#080f1d");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // A fixed seed keeps the sky stable across route changes and preview captures.
  let seed = 731;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 650; i++) {
    const x = random() * canvas.width;
    const y = 36 + random() * 440;
    const fade = 1 - Math.pow(y / 490, 3);
    ctx.fillStyle = `rgba(210,226,255,${(0.2 + random() * 0.65) * fade})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.35 + random() * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new CanvasTexture(canvas);
  texture.mapping = EquirectangularReflectionMapping;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
