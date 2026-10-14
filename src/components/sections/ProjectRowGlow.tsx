"use client";

import { useEffect, useRef } from "react";
import {
  AdditiveBlending,
  GLSL3,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RawShaderMaterial,
  RepeatWrapping,
  Scene,
  TextureLoader,
  Vector2,
  WebGLRenderer,
} from "three";
import { rowFragmentShader, rowVertexShader } from "./projectRowShaders";

export function ProjectRowGlow({
  src,
  active,
  diagram = false,
}: {
  src: string;
  active: boolean;
  diagram?: boolean;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const target = useRef(active);
  useEffect(() => {
    target.current = active;
  }, [active]);
  useEffect(() => {
    const element = host.current;
    if (!element || window.matchMedia("(hover: none), (pointer: coarse)").matches) return;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ alpha: true, antialias: false });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0, 0);
    element.append(renderer.domElement);
    const defaults = {
      uBrightness: diagram ? 0.65 : 0.9,
      uAutoExposure: diagram ? 0 : 1,
      uImageScale: diagram ? 1 : 1.4,
      uImageDistortion: diagram ? 0.15 : 2,
      uMaskDistortion: 1,
      uCenterClear: diagram ? 0.65 : 0,
      uDistortionAmount: 0.45,
      uDistortionScale: 1,
      uFadeTop: diagram ? 0.08 : 0.4,
      uFadeBottom: diagram ? 0.08 : 0.4,
      uFadeSides: 0.2,
      uMaskShape: 0,
      uMaskRadius: 0.5,
      uMaskSoftness: 0.28,
      uNoiseScale: 3,
      uNoiseSpeed: 0.05,
      uNoiseAmount: diagram ? 0.25 : 0.55,
      uNoiseAspect: 1,
      uLuminance: 1,
      uImageContain: diagram ? 1 : 0,
      uReveal: 0,
      uHover: 0,
      uRevealSoftness: 0.22,
      uRevealNoiseScale: 5,
      uRevealDistortion: 1,
      uTime: 0,
    };
    const uniforms = Object.fromEntries(
      Object.entries(defaults).map(([key, value]) => [key, { value }]),
    ) as Record<string, { value: unknown }>;
    uniforms.uImageSize = { value: new Vector2(1, 1) };
    uniforms.uContainerSize = { value: new Vector2(1, 1) };
    uniforms.uImageOffset = { value: new Vector2(0, 0) };
    let disposed = false;
    const loader = new TextureLoader();
    const image = loader.load(src, (texture) => {
      if (disposed) return;
      (uniforms.uImageSize!.value as Vector2).set(texture.image.width, texture.image.height);
    });
    const displacement = loader.load("/interface/row-displacement.webp");
    displacement.wrapS = displacement.wrapT = RepeatWrapping;
    uniforms.tImage = { value: image };
    uniforms.tDistortion = { value: displacement };
    const material = new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: rowVertexShader,
      fragmentShader: rowFragmentShader,
      uniforms,
      transparent: true,
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });
    const geometry = new PlaneGeometry(2, 2);
    const scene = new Scene();
    scene.add(new Mesh(geometry, material));
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;
    const resize = () => {
      const rect = element.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height);
      (uniforms.uContainerSize!.value as Vector2).set(rect.width, rect.height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0,
      reveal = 0,
      previous = performance.now();
    const tick = (now: number) => {
      const delta = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      const wanted = target.current ? 1 : 0;
      reveal = reduced.matches
        ? wanted
        : Math.max(0, Math.min(1, reveal + (wanted ? delta / 0.7 : -delta / 0.45)));
      uniforms.uReveal!.value = reveal;
      uniforms.uTime!.value = reduced.matches ? 0 : now / 1000;
      if (reveal > 0 || wanted) renderer.render(scene, camera);
      else renderer.clear();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      geometry.dispose();
      material.dispose();
      image.dispose();
      displacement.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [src, diagram]);
  return <span ref={host} aria-hidden="true" data-row-glow="" />;
}
