export const rowVertexShader = `
in vec3 position;
in vec2 uv;
uniform mat4 modelMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
out vec2 vUv;
out vec2 vScreenUv;
void main() {
  vUv = uv;
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vec4 mvPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * mvPosition;

  // screen-space uv (0..1) — the plane faces the camera so w is constant
  // across it, making this exact. Used to sample the distortion texture in
  // the same space the background (MainShader) samples it, so the torn edge
  // lines up with the background displacement.
  vScreenUv = gl_Position.xy / gl_Position.w * 0.5 + 0.5;
}
`;

export const rowFragmentShader = `
precision highp float;


vec4 coverTexture(sampler2D tex, vec2 imgSize, vec2 ouv, vec2 containerSize) {
  vec2 s = containerSize;
  vec2 i = imgSize;
  float rs = s.x / s.y;
  float ri = i.x / i.y;
  vec2 new = rs < ri ? vec2(i.x * s.y / i.y, s.y) : vec2(s.x, i.y * s.x / i.x);
  vec2 newOffset = (rs < ri ? vec2((new.x - s.x) / 2.0, 0.0) : vec2(0.0, (new.y - s.y) / 2.0)) / new;
  vec2 uv = ouv * s / new + newOffset;
  vec4 color = texture(tex, uv);

  return color;
}


vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
     return mod289(((x*34.0)+10.0)*x);
}

vec4 taylorInvSqrt(vec4 r)
{
  return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v) { 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

// First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

// Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  //   x0 = x0 - 0.0 + 0.0 * C.xxx;
  //   x1 = x0 - i1  + 1.0 * C.xxx;
  //   x2 = x0 - i2  + 2.0 * C.xxx;
  //   x3 = x0 - 1.0 + 3.0 * C.xxx;
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
  vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y

// Permutations
  i = mod289(i); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

// Gradients: 7x7 points over a square, mapped onto an octahedron.
// The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
  float n_ = 0.142857142857; // 1.0/7.0
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  //vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;
  //vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

//Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

// Mix final noise value
  vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 105.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                dot(p2,x2), dot(p3,x3) ) );
  }


uniform sampler2D tImage;
uniform sampler2D tDistortion;
uniform vec2 uImageSize;
uniform vec2 uContainerSize;
uniform vec2 uImageOffset;
uniform float uImageScale;
uniform float uImageContain;
uniform float uBrightness;
uniform float uAutoExposure;
uniform float uImageDistortion;
uniform float uMaskDistortion;
uniform float uCenterClear;
uniform float uDistortionAmount;
uniform float uDistortionScale;
uniform float uFadeTop;
uniform float uFadeBottom;
uniform float uFadeSides;
uniform float uMaskShape;
uniform float uMaskRadius;
uniform float uMaskSoftness;
uniform float uNoiseScale;
uniform float uNoiseSpeed;
uniform float uNoiseAmount;
uniform float uNoiseAspect;
uniform float uLuminance;
uniform float uReveal;
uniform float uRevealSoftness;
uniform float uRevealNoiseScale;
uniform float uRevealDistortion;
uniform float uHover;
uniform float uTime;

in vec2 vUv;
in vec2 vScreenUv;
out vec4 FragColor;

void main() {
  // Distortion sampled in the banner's LOCAL space, mapped through PHYSICAL
  // pixels (uContainerSize) instead of normalised UV — feature size stays
  // constant across box sizes and it tracks with the banner on scroll.
  // 1200 = reference px per texture unit; tune the feel with uDistortionScale.
  vec2 dispUv = (mix(vUv, vScreenUv, 0.25) - 0.5) * uContainerSize / 1200.0 * uDistortionScale + 0.5;
  vec3 displace = texture(tDistortion, dispUv).rgb;
  // hover intensifies the displacement field, so image, mask and edge all
  // ripple together from the same source
  vec2 disp = (displace.rg - 0.5) * uDistortionAmount * (1.0 + uHover * 0.5);

  // image placement inside the mask: zoom around the centre, then pan.
  // hover adds a gentle push-in on top of the authored scale.
  vec2 imgUv = (mix(vUv, vScreenUv, 0.25) - 0.5) / (uImageScale * (1.0 + uHover * 0.06)) + 0.5 + uImageOffset;

  // image distortion faded in towards the sides so the centre stays clear
  float sideDist = abs(vUv.x - 0.5) * 2.0; // 0 in the centre → 1 at the sides
  float distEdge = smoothstep(uCenterClear, 1.0, sideDist);
  imgUv += disp * uImageDistortion * distEdge;

  vec4 color = coverTexture(tImage, uImageSize, imgUv, uContainerSize);
  if (uImageContain > 0.5) {
    float imageAspect = uImageSize.x / uImageSize.y;
    float boxAspect = uContainerSize.x / uContainerSize.y;
    vec2 fit = boxAspect > imageAspect ? vec2(imageAspect / boxAspect, 1.0) : vec2(1.0, boxAspect / imageAspect);
    vec2 fittedUv = (imgUv - 0.5) / fit + 0.5;
    float inside = step(0.0, fittedUv.x) * step(fittedUv.x, 1.0) * step(0.0, fittedUv.y) * step(fittedUv.y, 1.0);
    color = texture(tImage, fittedUv) * inside;
  }

  // Auto-exposure: divide out the banner's own average brightness, which is
  // free — the smallest mip of the image IS its average colour, and one fetch of
  // a 1x1 level costs nothing. uBrightness then reads as a target mean rather
  // than a multiplier, so a night scene and a bright cartoon one land at the
  // same strength. Off by default (uAutoExposure 0): the hero and the footer
  // teaser are one authored image apiece and want their own exposure. Wanted by
  // anything that shows a *set* of banners and needs them to read alike — the
  // work list runs a 5:1 spread of mean brightness across its projects (0.18 to
  // 0.95, and a 16:9 still's middle band measures the same as its whole frame,
  // so the average is a fair stand-in for the slice actually shown).
  //
  // 0.5, not the photographic 0.18: these texels are sRGB-encoded (the pipeline
  // does no decode — see the loader in BannerScene), and mid-grey in that space
  // is about half. The clamp stops a near-black still from being amplified into
  // noise.
  vec3 avgColor = textureLod(tImage, vec2(0.5), 20.0).rgb;
  float avgLum = max(dot(avgColor, vec3(0.2126, 0.7152, 0.0722)), 0.002);
  float exposure = mix(1.0, clamp(0.5 / avgLum, 0.0, 6.0), uAutoExposure);

  // manual exposure to counter the scene grade/LUT; hover lifts it only
  // slightly here — the bulk of the hover brightening is the edge-weighted
  // rim term below, so the glow reads at the rim instead of overall
  color.rgb *= uBrightness * exposure * (1.0 + uHover * 0.05);

  // mask shape — warped by the SAME displacement field as the image. The mask
  // is only soft near its edges, so this naturally only ripples the fade.
  vec2 maskUv = vUv + disp * uMaskDistortion;

  // rectangular fade (hero): soft ramp on each of the four sides
  float fadeSides =
    min(smoothstep(0.0, uFadeSides, maskUv.x), smoothstep(0.0, uFadeSides, 1.0 - maskUv.x));
  float fadeBottom = smoothstep(0.0, uFadeBottom, maskUv.y);
  float fadeTop = smoothstep(0.0, uFadeTop, 1.0 - maskUv.y);
  float rectEdge = fadeSides * fadeBottom * fadeTop;

  // circular fade (footer): radial falloff from the centre, aspect-corrected so
  // the disc stays round on non-square boxes. Mirrors the CSS radial-gradient
  // used as the DOM fallback — opaque core, soft transparent rim.
  vec2 cp = maskUv - 0.5;
  cp.x *= uContainerSize.x / uContainerSize.y;
  // hover breathes the disc outward a touch
  float radius = uMaskRadius * (1.0 + uHover * 0.07);
  float circleEdge =
    1.0 - smoothstep(radius - uMaskSoftness, radius, length(cp));

  // uMaskShape picks the silhouette: 0 = rectangular (hero), 1 = circular (footer)
  float edge = mix(rectEdge, circleEdge, uMaskShape);

  // Both noise fields below are sampled in UV, which means their features are
  // stretched by whatever shape the box is: on a wide, short banner one cycle
  // spans the full width and the full height alike, so the tear comes out as
  // many times wider than it is tall as the box is. uNoiseAspect corrects for
  // that — 1 makes the features square in pixels. The two axis factors are
  // reciprocal square roots, so the corrected feature size is the geometric mean
  // of the two and uNoiseScale keeps meaning roughly the same thing either way.
  // Default 0 (uncorrected): the hero and the footer teaser were authored
  // against the stretched field and should keep it.
  float boxAspect = uContainerSize.x / max(uContainerSize.y, 1.0);
  vec2 noiseAspect =
    mix(vec2(1.0), vec2(sqrt(boxAspect), inversesqrt(boxAspect)), uNoiseAspect);

  // tear the mask edge with noise so the fade reads organic, not a clean ramp;
  // hover both amplifies the tear and speeds the noise drift (the extra time
  // term keeps phase continuous, so intensity ramps without a visual jump)
  float n = snoise(vec3(vUv * noiseAspect * uNoiseScale, uTime * uNoiseSpeed + uHover * 0.05)) * 0.5 + 0.5;
  edge += (n - 0.5) * uNoiseAmount * (1.0 + uHover * 0.5);
  float mask = smoothstep(0.35, 0.65, edge);

  // hover glow towards the edges: weight by the soft mask ramp (pre-alpha),
  // not the hardened mask — the ramp starts falling well inside the opaque
  // zone, so the glow sits on visible pixels, strongest at the torn boundary
  // (noise tear included) and fading to nothing in the core
  float rim = 1.0 - smoothstep(0.1, 1.0, edge);
  color.rgb *= 1.0 + rim * uHover * 0.8;

  // animate in/out: a noise dissolve driven by uReveal (0→1 in, 1→0 out) so the
  // image materialises through the mask with noise rather than a flat fade. The
  // (1 + 2*softness) remap guarantees fully hidden at 0 and fully shown at 1.
  // The dissolve field is warped by the SAME displacement that bends the image
  // and mask, so the reveal tears along the distortion texture rather than being
  // pure procedural noise.
  vec2 revealUv = vUv + disp * uRevealDistortion;
  float dissolve = snoise(vec3(revealUv * noiseAspect * uRevealNoiseScale, 11.0)) * 0.5 + 0.5;
  float rev = uReveal * (1.0 + 2.0 * uRevealSoftness) - uRevealSoftness;
  float reveal = smoothstep(dissolve - uRevealSoftness, dissolve + uRevealSoftness, rev);

  // Light, not a crop: weighting coverage by the image's own brightness drops
  // the dark half of the picture out of the composite entirely, so what lands on
  // the page is where the banner is *lit* rather than a rectangle of it. Off by
  // default (uLuminance 0) — the hero and the footer teaser want the whole
  // frame; the work-list row wants only the light. Measured after uBrightness,
  // so that one knob moves exposure and coverage together.
  float lum = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
  float coverage = mix(1.0, clamp(lum, 0.0, 1.0), uLuminance);

  FragColor = vec4(color.rgb, clamp(mask, 0.0, 1.0) * reveal * coverage * color.a);
}
`;
