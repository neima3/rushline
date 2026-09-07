import * as THREE from "three";
import { AfterimagePass } from "three/addons/postprocessing/AfterimagePass.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

export class PostFx {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private after: AfterimagePass | null = null;
  private output: OutputPass | null = null;
  private renderPass: RenderPass | null = null;
  private bloomOn = false;
  private blurOn = false;
  private w = 1;
  private h = 1;
  private dpr = 1;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
  }

  get active() {
    return Boolean(this.composer && (this.bloomOn || this.blurOn));
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

  configure(bloom: boolean, motionBlur: boolean) {
    if (this.composer && this.bloomOn === bloom && this.blurOn === motionBlur) return;
    this.bloomOn = bloom;
    this.blurOn = motionBlur;
    if (!bloom && !motionBlur) {
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
        this.output = new OutputPass();
        this.composer.addPass(this.output);
      }
      if (this.bloom) this.bloom.enabled = bloom;
      if (this.after) {
        this.after.enabled = motionBlur;
        this.after.uniforms.damp.value = 0.78;
      }
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
    this.output = null;
    this.renderPass = null;
  }
}
