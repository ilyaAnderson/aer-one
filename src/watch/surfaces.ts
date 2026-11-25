import {
  FrontSide,
  Material,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
} from "three";
import type { Finish } from "../product";

export const finishColors: Record<Finish, { case: string; band: string }> = {
  graphite: { case: "#707275", band: "#292a2c" },
  silver: { case: "#bdc0c2", band: "#272a2c" },
  moss: { case: "#929a88", band: "#646c58" },
};

export function createSurface(source: Material) {
  if (!(source instanceof MeshStandardMaterial)) return source.clone();

  if (source.name.startsWith("Display")) {
    return new MeshBasicMaterial({
      name: source.name,
      map: source.emissiveMap,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
  }

  // The strap UVs span the whole loop. Tile all three maps together so the
  // mould grain stays fine at macro scale and follows the moving highlights.
  const metal = source.name.startsWith("Silver");
  const rubber = source.name.startsWith("Silicone");
  if (metal || rubber) {
    const repeats = rubber ? 3 : 2;
    for (const texture of [source.map, source.normalMap, source.roughnessMap]) {
      texture?.repeat.set(repeats, repeats);
    }
  }

  if (metal) {
    return new MeshPhysicalMaterial({
      name: source.name,
      map: source.map,
      roughnessMap: source.roughnessMap,
      normalMap: source.normalMap,
      normalScale: source.normalScale.clone().multiplyScalar(0.40),
      metalness: 0.91,
      roughness: 1,
      anisotropy: 0.35,
      anisotropyRotation: Math.PI / 2,
      clearcoat: 0.09,
      clearcoatRoughness: 0.22,
      vertexColors: true,
    });
  }

  if (source.name.startsWith("Sapphire")) {
    const sapphire = new MeshPhysicalMaterial({
      name: source.name,
      color: "#edf5fa",
      metalness: 1,
      roughness: 0.056,
      transparent: true,
      depthWrite: false,
      side: FrontSide,
    });
    sapphire.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        `// The top surface and the bonded underside catch the same tall studio
        // strip at slightly different angles on the rolled perimeter.
        vec3 eye = normalize(vViewPosition);
        vec3 ray = reflect(-eye, normal);
        float grazing = 1.0 - clamp(dot(normal, eye), 0.0, 1.0);
        float fresnel = 0.045 + 0.78 * pow(grazing, 4.0);
        float stripDistance = dot(ray, vec3(0.885, -0.07, -0.46));
        float stripFacing = smoothstep(0.1, 0.65, dot(ray, vec3(0.46, 0.0, 0.885)));
        float surfaceGlint = stripFacing * exp(-520.0 * stripDistance * stripDistance);
        float innerDistance = stripDistance - 0.06;
        float innerGlint = stripFacing * exp(-1800.0 * innerDistance * innerDistance) * grazing;
        // The soft edge of the opposite card sweeps across the crown on rotation.
        float cardDistance = dot(ray, vec3(0.39, -0.24, 0.89));
        float softCard = exp(-24.0 * cardDistance * cardDistance)
                       * smoothstep(0.0, 0.7, -ray.x);
        outgoingLight += vec3(0.74, 0.84, 0.94) * (softCard + 0.42 * grazing)
                       + vec3(1.0, 0.99, 0.97) * surfaceGlint
                       + vec3(0.39, 0.66, 0.83) * innerGlint;
        diffuseColor.a *= min(0.86, fresnel + 0.16 * softCard + 0.18 * surfaceGlint + 0.14 * innerGlint);
        #include <opaque_fragment>`,
      );
    };
    return sapphire;
  }

  if (rubber) {
    return new MeshPhysicalMaterial({
      name: source.name,
      side: source.side,
      map: source.map,
      roughnessMap: source.roughnessMap,
      normalMap: source.normalMap,
      normalScale: source.normalScale.clone().multiplyScalar(0.30),
      roughness: 1,
      specularIntensity: 0.77,
      vertexColors: true,
    });
  }

  const copy = source.clone();
  copy.vertexColors = true;
  if (copy.name.startsWith("Polished")) copy.roughness = 0.16;
  return copy;
}

export function applyFinish(material: Material, finish: Finish) {
  if (!(material instanceof MeshStandardMaterial)) return;
  if (material.name.startsWith("Silver"))
    material.color.set(finishColors[finish].case);
  if (material.name.startsWith("Silicone"))
    material.color.set(finishColors[finish].band);
}
