import * as THREE from "three";
import { AfterimagePass } from "three/addons/postprocessing/AfterimagePass.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import type { ThemeId } from "./types";
import { GRADE } from "./presentation";

const GradeShader = {
  name: "RushlineGrade",
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    vignette: { value: 0.16 },
    contrast: { value: 1.045 },
    saturation: { value: 1.02 },
    tint: { value: new THREE.Color(1, 1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float vignette;
    uniform float contrast;
    uniform float saturation;
    uniform vec3 tint;
    varying vec2 vUv;
    void main() {
      vec4 src = texture2D(tDiffuse, vUv);
      vec3 c = src.rgb;
      float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
      // Contrast away from mid-grey so Circuit High asphalt stays readable.
      float ends = abs(luma - 0.5) * 2.0;
      c = mix(c, (c - 0.5) * contrast + 0.5, ends);
      float g = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(g), c, saturation);
      vec2 uv = vUv * 2.0 - 1.0;
      float v = 1.0 - vignette * dot(uv, uv);
      c *= v * tint;
      gl_FragColor = vec4(c, src.a);
    }
  `,
};

export class PostFx {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private after: AfterimagePass | null = null;
  private grade: ShaderPass | null = null;
  private output: OutputPass | null = null;
  private renderPass: RenderPass | null = null;
  private bloomOn = false;
  private blurOn = false;
  private gradeOn = false;
  private w = 1;
  private h = 1;
  private dpr = 1;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
  }

  get active() {
    return Boolean(this.composer && (this.bloomOn || this.blurOn || this.gradeOn));
  }

  setSize(w: number, h: number, dpr: number) {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.dpr = dpr;
    if (!this.composer) return;
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(this.w, this.h);
    this.bloom?.setSize(this.w, this.h);
  }

  tuneBloom(strength: number, radius: number, threshold: number) {
    if (!this.bloom) return;
    this.bloom.strength = strength;
    this.bloom.radius = radius;
    this.bloom.threshold = threshold;
  }

  setGrade(theme: ThemeId) {
    if (!this.grade) return;
    const look = GRADE[theme];
    this.grade.uniforms.vignette!.value = look.vignette;
    this.grade.uniforms.contrast!.value = look.contrast;
    this.grade.uniforms.saturation!.value = look.saturation;
    (this.grade.uniforms.tint!.value as THREE.Color).set(look.tint);
  }

  configure(bloom: boolean, motionBlur: boolean, grade = false) {
    if (this.composer && this.bloomOn === bloom && this.blurOn === motionBlur && this.gradeOn === grade) return;
    this.bloomOn = bloom;
    this.blurOn = motionBlur;
    this.gradeOn = grade;
    if (!bloom && !motionBlur && !grade) {
      this.teardown();
      return;
    }
    try {
      if (!this.composer) {
        this.composer = new EffectComposer(this.renderer);
        this.renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(this.renderPass);
        this.bloom = new UnrealBloomPass(new THREE.Vector2(this.w, this.h), 0.22, 0.38, 0.84);
        this.composer.addPass(this.bloom);
        this.after = new AfterimagePass(0.78);
        this.composer.addPass(this.after);
        this.grade = new ShaderPass(GradeShader);
        this.composer.addPass(this.grade);
        this.output = new OutputPass();
        this.composer.addPass(this.output);
      }
      if (this.bloom) this.bloom.enabled = bloom;
      if (this.after) {
        this.after.enabled = motionBlur;
        this.after.uniforms.damp.value = 0.78;
      }
      if (this.grade) this.grade.enabled = grade;
      this.setSize(this.w, this.h, this.dpr);
    } catch {
      this.teardown();
    }
  }

  render() {
    if (this.active && this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.teardown();
  }

  private teardown() {
    this.composer?.dispose();
    this.composer = null;
    this.bloom = null;
    this.after = null;
    this.grade = null;
    this.output = null;
    this.renderPass = null;
    this.bloomOn = false;
    this.blurOn = false;
    this.gradeOn = false;
  }
}
