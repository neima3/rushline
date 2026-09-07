import * as THREE from "three";

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
uniform float hasMap;
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
  float w = smoothstep(-0.1, 0.28, dir.y);
  gl_FragColor = vec4(mix(fogColor, sky * tint, w), 1.0);
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
        hasMap: { value: 0 },
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
