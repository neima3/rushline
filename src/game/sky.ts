import * as THREE from "three";
import type { ThemeId } from "./types";
import { SKY_LOOK } from "./presentation";

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = clip.xyww;
}
`;

const SKY_FRAG = /* glsl */ `
uniform sampler2D map;
uniform vec3 fogColor;
uniform vec3 tint;
uniform vec3 horizonColor;
uniform vec3 zenithColor;
uniform vec3 sunDir;
uniform float hasMap;
uniform float haze;
uniform float sunGlow;
varying vec3 vDir;

#include <common>

vec2 dirToEquirect(vec3 dir) {
  float u = atan(dir.z, dir.x) * RECIPROCAL_PI2 + 0.5;
  float v = asin(clamp(dir.y, -1.0, 1.0)) * RECIPROCAL_PI + 0.5;
  return vec2(u, v);
}

vec3 decodeSRGB(vec3 c) {
  return mix(
    pow(c * 0.9478672986 + vec3(0.0521327014), vec3(2.4)),
    c * 0.0773993808,
    vec3(lessThanEqual(c, vec3(0.04045)))
  );
}

void main() {
  vec3 dir = normalize(vDir);
  vec3 sky = fogColor;
  if (hasMap > 0.5) {
    sky = decodeSRGB(texture2D(map, dirToEquirect(dir)).rgb);
  }
  float h = dir.y;
  float hz = exp(-abs(h) * 5.4) * haze;
  sky = mix(sky * tint, horizonColor, hz * 0.42);
  float zen = smoothstep(0.12, 0.88, h);
  sky = mix(sky, sky * zenithColor, zen * 0.22);
  float sun = pow(max(dot(dir, sunDir), 0.0), 42.0) * sunGlow;
  sky += sun * horizonColor;
  float w = smoothstep(-0.1, 0.28, h);
  gl_FragColor = vec4(mix(fogColor, sky, w), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** Equirect sky dome that sits on the far plane and blends into fog at the horizon. */
export class SkyDome {
  mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private geo: THREE.SphereGeometry;

  constructor(fog: number, tint = 0xffffff) {
    this.geo = new THREE.SphereGeometry(1, 48, 28);
    this.mat = new THREE.ShaderMaterial({
      name: "RushlineSky",
      uniforms: {
        map: { value: null },
        fogColor: { value: new THREE.Color(fog) },
        tint: { value: new THREE.Color(tint) },
        horizonColor: { value: new THREE.Color(0xc8dced) },
        zenithColor: { value: new THREE.Color(0xe8f2fb) },
        sunDir: { value: new THREE.Vector3(0.4, 0.8, 0.2).normalize() },
        hasMap: { value: 0 },
        haze: { value: 0.22 },
        sunGlow: { value: 0.07 },
      },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: true,
      fog: false,
      toneMapped: true,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    this.mesh.scale.setScalar(80);
  }

  setFog(fog: number) {
    (this.mat.uniforms.fogColor!.value as THREE.Color).set(fog);
  }

  setTint(tint: number) {
    (this.mat.uniforms.tint!.value as THREE.Color).set(tint);
  }

  setTheme(theme: ThemeId, sunPos: [number, number, number]) {
    const look = SKY_LOOK[theme];
    (this.mat.uniforms.horizonColor!.value as THREE.Color).set(look.horizon);
    (this.mat.uniforms.zenithColor!.value as THREE.Color).set(look.zenith);
    this.mat.uniforms.haze!.value = look.haze;
    this.mat.uniforms.sunGlow!.value = look.sunGlow;
    (this.mat.uniforms.sunDir!.value as THREE.Vector3).set(...sunPos).normalize();
  }

  setMap(tex: THREE.Texture | null) {
    this.mat.uniforms.map!.value = tex;
    this.mat.uniforms.hasMap!.value = tex ? 1 : 0;
    this.mat.needsUpdate = true;
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}

/** PMREM from the loaded skybox — themed IBL instead of a bright studio room. */
export function bakeSkyEnvironment(pmrem: THREE.PMREMGenerator, tex: THREE.Texture) {
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.needsUpdate = true;
  return pmrem.fromEquirectangular(tex);
}
