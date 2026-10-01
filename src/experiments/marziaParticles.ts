/*
 * The particle "MARZIA" word from the previous site (public/marzia-particles.js
 * in new-website-brand), moved here unchanged: the sampling, motion, cursor
 * flow and both colour palettes are the original code. Only the mounting is
 * new: it takes its stage element instead of querying the old hero markup,
 * owns its own canvas, and returns a cleanup so the route can unmount it.
 */

type Point = {
  u: number;
  v: number;
  shell: number;
  grain: number;
  phase: number;
  size: number;
  edge: boolean;
  tx: number;
  ty: number;
  tz: number;
};

type Splat = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  spin: number;
};

type Theme = "light" | "dark";

/* The old site resolved its theme from the system preference by default. */
const darkQuery = () => matchMedia("(prefers-color-scheme: dark)");
const resolveTheme = (): Theme => (darkQuery().matches ? "dark" : "light");

export function mountMarziaParticles(hero: HTMLElement, hint: HTMLElement | null): () => void {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.particleField = "";
  hero.prepend(canvas);
  const ctx = canvas.getContext("2d", { alpha: true })!;

  // Sits the hint just below the particle glyph's bottom edge, measured from
  // the same projected points render() draws from, at rest.
  function positionHint() {
    if (!hint || !points.length) return;
    const mobileLayout = width < 760;
    const scale = mobileLayout ? width * .68 : Math.min(width * .62, height * 1.05);
    const cy = mobileLayout ? height * .40 : height * .48;
    let glyphBottom = -Infinity;
    for (const p of points) {
      const perspective = 1 / (1.44 - p.tz * .33);
      const sy = cy + p.ty * scale * perspective;
      if (sy > glyphBottom) glyphBottom = sy;
    }
    hint.style.top = `${glyphBottom + 24}px`;
  }

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let currentTheme: Theme = resolveTheme();

  let width = 0;
  let height = 0;
  let dpr = 1;
  let points: Point[] = [];
  let pointerX = 0;
  let pointerY = 0;
  let targetX = 0;
  let targetY = 0;
  let lastPointer: { x: number; y: number } | null = null;
  let splats: Splat[] = [];
  let particleSprites: Record<string, HTMLCanvasElement[]> = {};
  let animationFrame = 0;
  let isVisible = false;
  let pageVisible = !document.hidden;

  function seeded(index: number, salt = 0) {
    const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
    return value - Math.floor(value);
  }

  function buildParticleSprites() {
    const palettes = currentTheme === "light" ? {
      dark: ["#245f22", "#2e7c28", "#387f2c", "#477f31"],
      gray: ["#5c952f", "#6ca331", "#82ac33", "#9abb57"],
      violet: ["#462d86", "#9169c1", "#a77dca", "#b793d2"],
      white: ["#d5bedf", "#dfcce7", "#eadbed", "#f2e7f5"],
    } : {
      dark: ["#21192d", "#302540", "#413451", "#544164"],
      gray: ["#777080", "#91879b", "#aaa0b2", "#c4b8ca"],
      violet: ["#462d86", "#9169c1", "#a77dca", "#b793d2"],
      white: ["#ded6e4", "#e9dfed", "#f2e7f5", "#ffffff"],
    };
    particleSprites = {};
    for (const [family, colors] of Object.entries(palettes)) {
      particleSprites[family] = colors.map((color, variant) => {
        const sprite = document.createElement("canvas");
        const spriteDpr = 3;
        const size = 30;
        sprite.width = size * spriteDpr;
        sprite.height = size * spriteDpr;
        const spriteCtx = sprite.getContext("2d")!;
        spriteCtx.scale(spriteDpr, spriteDpr);
        const center = size / 2;
        const gradient = spriteCtx.createRadialGradient(center - 4, center - 5, 1, center, center, 14);
        gradient.addColorStop(0, "#ffffff");
        gradient.addColorStop(.16, color);
        const shadowColor = currentTheme === "light"
          ? family === "violet" ? "#462d86" : family === "white" ? "#9169c1" : "#2e7c28"
          : "#120d20";
        gradient.addColorStop(1, shadowColor);
        spriteCtx.fillStyle = gradient;
        spriteCtx.beginPath();
        const sides = 7 + (variant % 3);
        for (let side = 0; side < sides; side++) {
          const angle = side / sides * Math.PI * 2;
          const radius = 10.5 + seeded(variant * 17 + side, family.length) * 3.4;
          const px = center + Math.cos(angle) * radius;
          const py = center + Math.sin(angle) * radius;
          if (side) spriteCtx.lineTo(px, py);
          else spriteCtx.moveTo(px, py);
        }
        spriteCtx.closePath();
        spriteCtx.fill();
        return sprite;
      });
    }
  }

  function buildParticles() {
    const mobile = width < 760;
    const count = mobile
      ? Math.min(9000, Math.max(6500, Math.round(width * height / 48)))
      : Math.min(40000, Math.max(26000, Math.round(width * height / 34)));
    const mask = document.createElement("canvas");
    mask.width = 1500;
    mask.height = 400;
    const maskCtx = mask.getContext("2d", { willReadFrequently: true })!;
    maskCtx.fillStyle = "#fff";
    maskCtx.font = "900 280px Arial Black, Arial, sans-serif";
    maskCtx.textAlign = "left";
    maskCtx.textBaseline = "middle";
    const letters = [..."MARZIA"];
    const letterGap = 38;
    const widths = letters.map((letter) => maskCtx.measureText(letter).width);
    const wordWidth = widths.reduce((sum, value) => sum + value, 0) + letterGap * (letters.length - 1);
    let letterX = (mask.width - wordWidth) / 2;
    for (let i = 0; i < letters.length; i++) {
      maskCtx.fillText(letters[i]!, letterX, mask.height / 2 + 8);
      letterX += widths[i]! + letterGap;
    }
    const maskData = maskCtx.getImageData(0, 0, mask.width, mask.height).data;

    // Random interior sampling gives the word its organic depth, but it leaves
    // the outer silhouette too soft on large screens. Reserve a smaller set of
    // particles for the actual glyph boundary so diagonal joins such as the M
    // stay readable without turning the word into a hard outlined shape.
    const edgeCandidates: { x: number; y: number }[] = [];
    if (!mobile) {
      const alphaAt = (x: number, y: number) => maskData[(y * mask.width + x) * 4 + 3]!;
      for (let y = 4; y < mask.height - 4; y += 2) {
        for (let x = 4; x < mask.width - 4; x += 2) {
          if (alphaAt(x, y) < 100) continue;
          if (alphaAt(x - 4, y) < 100 || alphaAt(x + 4, y) < 100
            || alphaAt(x, y - 4) < 100 || alphaAt(x, y + 4) < 100) {
            edgeCandidates.push({ x, y });
          }
        }
      }
    }
    const edgeCount = mobile ? 0 : Math.round(count * .18);

    points = Array.from({ length: count }, (_, i) => ({
      u: seeded(i, 1) * Math.PI * 2,
      v: seeded(i, 2) * Math.PI * 2,
      shell: Math.pow(seeded(i, 3), .33),
      grain: seeded(i, 4),
      phase: seeded(i, 5) * Math.PI * 2,
      size: i < edgeCount
        ? .72 + Math.pow(seeded(i, 6), 2.2) * 1.35
        : .86 + Math.pow(seeded(i, 6), 2.8) * 3.35,
      edge: i < edgeCount,
      tx: 0,
      ty: 0,
      tz: 0,
    }));

    for (let i = 0; i < points.length; i++) {
      const point = points[i]!;
      let px = 0;
      let py = 0;
      let attempt = 0;
      if (point.edge && edgeCandidates.length) {
        const candidate = edgeCandidates[Math.floor(seeded(i, 91) * edgeCandidates.length)]!;
        px = Math.max(0, Math.min(mask.width - 1, candidate.x + Math.round((seeded(i, 92) - .5) * 3)));
        py = Math.max(0, Math.min(mask.height - 1, candidate.y + Math.round((seeded(i, 93) - .5) * 3)));
      } else {
        do {
          px = Math.floor(seeded(i, 10 + attempt * 2) * mask.width);
          py = Math.floor(seeded(i, 11 + attempt * 2) * mask.height);
          attempt++;
        } while (maskData[(py * mask.width + px) * 4 + 3]! < 100 && attempt < 120);
      }
      point.tx = (px - mask.width / 2) / (mask.width / 2);
      point.ty = (py - mask.height / 2) / (mask.height * 1.05);
      point.tz = (seeded(i, 88) - .5) * (point.edge ? .07 : .16);
    }
  }

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2.5);
    width = hero.clientWidth;
    height = hero.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildParticles();
    positionHint();
  }

  function rotate(x: number, y: number, angle: number): [number, number] {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [x * c - y * s, x * s + y * c];
  }

  function render(ms = 0) {
    const t = reducedMotion ? 0 : ms * .00012;
    pointerX += (targetX - pointerX) * .035;
    pointerY += (targetY - pointerY) * .035;
    ctx.clearRect(0, 0, width, height);

    // The reference uses a small fluid-velocity buffer fed by pointer segments.
    // These decaying splats approximate that field directly in screen space.
    for (const splat of splats) splat.life *= .986;
    splats = splats.filter((splat) => splat.life > .012);

    const mobile = width < 760;
    const scale = mobile ? width * .68 : Math.min(width * .62, height * 1.05);
    const cx = mobile ? width * .5 : width * .49;
    const cy = mobile ? height * .40 : height * .48;
    const yaw = pointerX * .055 + Math.sin(t * .7) * .012;
    const pitch = pointerY * .04 + Math.cos(t * .55) * .01;
    const roll = Math.sin(t * .31) * .008;
    const projected = [];

    for (let i = 0; i < points.length; i++) {
      const p = points[i]!;
      const u = p.u + t * .32;
      const vv = p.v + .2 * Math.sin(2 * u + t);
      let x = p.tx;
      let y = p.ty + Math.sin(p.tx * 8 + t * 2 + p.phase) * .004;
      let z = p.tz + Math.sin(p.tx * 5 - t + p.phase) * .012;

      [x, z] = rotate(x, z, yaw);
      [y, z] = rotate(y, z, pitch);
      [x, y] = rotate(x, y, roll);

      const perspective = 1 / (1.44 - z * .33);
      let sx = cx + x * scale * perspective;
      let sy = cy + y * scale * perspective;
      if (sx < -5 || sx > width + 5 || sy < -5 || sy > height + 5) continue;

      let flowX = 0;
      let flowY = 0;
      for (let j = 0; j < splats.length; j++) {
        const splat = splats[j]!;
        const dx = sx - splat.x;
        const dy = sy - splat.y;
        const radius = splat.radius;
        const distance2 = dx * dx + dy * dy;
        if (distance2 > radius * radius) continue;
        const falloff = Math.pow(1 - distance2 / (radius * radius), 2) * splat.life;
        const speed = Math.hypot(splat.vx, splat.vy);
        const curl = Math.min(1, speed / 32) * splat.spin;
        flowX += splat.vx * falloff * .88 - dy * falloff * curl * .055;
        flowY += splat.vy * falloff * .88 + dx * falloff * curl * .055;
      }
      sx += flowX;
      sy += flowY;

      const lighting = Math.max(0, .27 + .6 * (Math.sin(vv) * -.58 + Math.cos(u - .7) * .42));
      const sparkle = p.grain > .976 ? .85 : p.grain > .79 ? .31 : .04;
      const alpha = Math.min(.98, .17 + lighting * .64 + sparkle);
      const colorField = Math.sin(u * 4.3 + vv * 1.7 + Math.sin(u * 3) * 1.4);
      projected.push({ sx, sy, z, alpha, size: p.size * (.7 + perspective * .74), tint: colorField, grain: p.grain, edge: p.edge });
    }

    projected.sort((a, b) => a.z - b.z);
    for (const p of projected) {
      const lavender = p.tint > .54 && p.grain > .43;
      const white = p.grain > .982;
      const midtone = p.grain > .73;
      let drawSize = p.size;
      let spriteFamily = "dark";
      if (white) {
        drawSize *= 1.42;
        spriteFamily = "white";
      } else if (lavender) {
        drawSize *= 1.2;
        spriteFamily = "violet";
      } else if (midtone) {
        spriteFamily = "gray";
      }
      drawSize *= mobile ? 1.06 : p.edge ? 1.08 : 1.24;
      const spriteSet = particleSprites[spriteFamily]!;
      const sprite = spriteSet[Math.min(spriteSet.length - 1, Math.floor(p.grain * spriteSet.length))]!;
      const spriteSize = drawSize * 2.05;
      ctx.globalAlpha = Math.max(p.edge ? .68 : mobile ? .42 : .52, p.alpha);
      ctx.drawImage(sprite, p.sx - spriteSize / 2, p.sy - spriteSize / 2, spriteSize, spriteSize);
    }
    ctx.globalAlpha = 1;

    if (!reducedMotion && isVisible && pageVisible) animationFrame = requestAnimationFrame(render);
  }

  function updateAnimation() {
    cancelAnimationFrame(animationFrame);
    if (reducedMotion) {
      render(0);
    } else if (isVisible && pageVisible) {
      animationFrame = requestAnimationFrame(render);
    }
  }

  function onPointerMove(event: PointerEvent) {
    const bounds = hero.getBoundingClientRect();
    const localX = event.clientX - bounds.left;
    const localY = event.clientY - bounds.top;
    if (localX < 0 || localY < 0 || localX > bounds.width || localY > bounds.height) {
      targetX = 0;
      targetY = 0;
      lastPointer = null;
      return;
    }
    targetX = localX / width * 2 - 1;
    targetY = localY / height * 2 - 1;
    if (lastPointer) {
      const dx = localX - lastPointer.x;
      const dy = localY - lastPointer.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 2) hint?.setAttribute("data-dismissed", "");
      const steps = Math.max(1, Math.ceil(distance / 24));
      for (let step = 1; step <= steps; step++) {
        const mix = step / steps;
        splats.push({
          x: lastPointer.x + dx * mix,
          y: lastPointer.y + dy * mix,
          vx: Math.max(-52, Math.min(52, dx / steps * 1.5)),
          vy: Math.max(-52, Math.min(52, dy / steps * 1.5)),
          radius: Math.max(72, Math.min(145, Math.min(width, height) * .14)),
          life: 1,
          spin: dx * dy < 0 ? -1 : 1,
        });
      }
      if (splats.length > 18) splats.splice(0, splats.length - 18);
    }
    lastPointer = { x: localX, y: localY };
  }

  function onPointerLeave() {
    targetX = 0;
    targetY = 0;
    lastPointer = null;
  }

  function applyTheme(theme: Theme) {
    currentTheme = theme;
    hero.dataset.theme = theme;
    buildParticleSprites();
    if (reducedMotion) render(0);
  }

  function onSchemeChange() {
    const nextTheme = resolveTheme();
    if (nextTheme !== currentTheme) applyTheme(nextTheme);
  }

  function onVisibilityChange() {
    pageVisible = !document.hidden;
    updateAnimation();
  }

  addEventListener("resize", resize);
  addEventListener("pointermove", onPointerMove);
  document.documentElement.addEventListener("pointerleave", onPointerLeave);
  const scheme = darkQuery();
  scheme.addEventListener("change", onSchemeChange);

  applyTheme(currentTheme);
  resize();
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    isVisible = entry!.isIntersecting;
    if (!isVisible) {
      targetX = 0;
      targetY = 0;
      lastPointer = null;
      splats = [];
    }
    updateAnimation();
  }, { threshold: 0.01 });
  visibilityObserver.observe(hero);
  const initialRect = hero.getBoundingClientRect();
  isVisible = initialRect.bottom > 0 && initialRect.top < innerHeight;
  updateAnimation();
  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    cancelAnimationFrame(animationFrame);
    visibilityObserver.disconnect();
    removeEventListener("resize", resize);
    removeEventListener("pointermove", onPointerMove);
    document.documentElement.removeEventListener("pointerleave", onPointerLeave);
    scheme.removeEventListener("change", onSchemeChange);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    canvas.remove();
  };
}
