import {
  Box3,
  Euler,
  Matrix3,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from "three";
import type { Finish } from "../product";
import { cameraDistance, cameraFov, type Pose } from "./motion";
import { finishColors } from "./surfaces";

type RGB = [number, number, number];
type Surface = "case" | "band" | "steel" | "glass" | "dial" | "back";
type Texture = { width: number; height: number; data: Uint8ClampedArray };
type ModelPart = {
  vertices: Float32Array;
  triangles: Uint32Array;
  surface: Surface;
  texture?: Texture;
  roughness?: Texture;
};
const modelCache = new WeakMap<Object3D, ModelPart[]>();

function surfaceFor(name: string): Surface {
  if (name.startsWith("Silver")) return "case";
  if (name.startsWith("Silicone")) return "band";
  if (name.startsWith("Polished")) return "steel";
  if (name.startsWith("Sapphire")) return "glass";
  if (name.startsWith("Display")) return "dial";
  return "back";
}

function readTexture(image: ImageBitmap | HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

export function prepareModel(asset: Object3D) {
  const cached = modelCache.get(asset);
  if (cached) return cached;
  asset.updateMatrixWorld(true);
  const center = new Box3().setFromObject(asset).getCenter(new Vector3());
  const point = new Vector3();
  const direction = new Vector3();
  const normals = new Matrix3();
  const parts: ModelPart[] = [];
  const roughnessMaps = new Map<MeshStandardMaterial, Texture>();
  asset.traverse((object) => {
    if (
      !(object instanceof Mesh) ||
      !(object.material instanceof MeshStandardMaterial)
    )
      return;
    const surface = surfaceFor(object.material.name);
    const { position, normal, uv, color } = object.geometry.attributes;
    const { index } = object.geometry;
    const vertices = new Float32Array(position.count * 9);
    normals.getNormalMatrix(object.matrixWorld);

    for (let i = 0; i < position.count; i++) {
      point.set(position.getX(i), position.getY(i), position.getZ(i));
      point.applyMatrix4(object.matrixWorld).sub(center);
      direction
        .set(normal.getX(i), normal.getY(i), normal.getZ(i))
        .applyNormalMatrix(normals);
      vertices.set(
        [
          point.x,
          point.y,
          point.z,
          direction.x,
          direction.y,
          direction.z,
          uv.getX(i),
          uv.getY(i),
          color?.getX(i) ?? 1,
        ],
        i * 9,
      );
    }

    const triangles = new Uint32Array(index?.count ?? position.count);
    for (let i = 0; i < triangles.length; i++)
      triangles[i] = (index?.getX(i) ?? i) * 9;
    const image = object.material.emissiveMap?.image;
    const texture = image ? readTexture(image) : undefined;
    let roughness = roughnessMaps.get(object.material);
    if (!roughness && object.material.roughnessMap?.image) {
      roughness = readTexture(object.material.roughnessMap.image);
      if (roughness) roughnessMaps.set(object.material, roughness);
    }
    parts.push({ vertices, triangles, surface, texture, roughness });
  });

  // The glass blends over the already rasterized case, display, and strap.
  parts.sort(
    (a, b) => Number(a.surface === "glass") - Number(b.surface === "glass"),
  );
  modelCache.set(asset, parts);
  return parts;
}

// Sample the same repeating roughness tile as the GPU, including the UV seam.
function grainAt(map: Texture, u: number, v: number) {
  const x = (u - Math.floor(u)) * map.width;
  const y = (v - Math.floor(v)) * map.height;
  const left = Math.floor(x), top = Math.floor(y);
  const right = (left + 1) % map.width, bottom = (top + 1) % map.height;
  const sx = x - left, sy = y - top;
  const green = (ix: number, iy: number) => map.data[(iy * map.width + ix) * 4 + 1];
  const a = green(left, top) * (1 - sx) + green(right, top) * sx;
  const b = green(left, bottom) * (1 - sx) + green(right, bottom) * sx;
  return (a * (1 - sy) + b * sy) / 255;
}

function channels(hex: string): RGB {
  return [1, 3, 5].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16),
  ) as RGB;
}

function edge(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  x: number,
  y: number,
) {
  return (bx - ax) * (y - ay) - (by - ay) * (x - ax);
}

export function createRasterizer(
  canvas: HTMLCanvasElement,
  model: ModelPart[],
  finish: Finish,
) {
  const canvasContext = canvas.getContext("2d");
  if (!canvasContext) throw new Error("Canvas 2D is unavailable");
  const context = canvasContext;
  const palette: Record<Surface, RGB> = {
    case: channels(finishColors[finish].case),
    band: channels(finishColors[finish].band),
    steel: [193, 197, 198],
    glass: [226, 239, 248],
    dial: [10, 11, 12],
    back: [25, 27, 29],
  };
  const transformed = model.map(
    ({ vertices }) => new Float32Array(vertices.length),
  );
  const rotation = new Matrix4();
  const tilt = new Matrix4();
  const angles = new Euler(0, 0, 0, "YXZ");
  let bitmap: ImageData;
  let depth = new Float32Array(0);

  function draw(
    pose: Pose,
    cssWidth: number,
    cssHeight: number,
    moving: boolean,
  ) {
    const maxSize = moving ? 1000 : 1920;
    const dpr = moving
      ? 1.45
      : Math.max(1.6, Math.min(window.devicePixelRatio || 1, 2.5));
    const ratio = Math.min(dpr, maxSize / Math.max(cssWidth, cssHeight));
    const width = Math.max(1, Math.round(cssWidth * ratio));
    const height = Math.max(1, Math.round(cssHeight * ratio));

    if (!bitmap || canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      bitmap = context.createImageData(width, height);
      depth = new Float32Array(width * height);
    }
    const pixels = bitmap.data;
    pixels.fill(0);
    depth.fill(0);
    const focal = height / (2 * Math.tan((cameraFov * Math.PI) / 360));
    angles.set(pose.pitch, pose.yaw, 0);
    const m = rotation
      .makeRotationZ(pose.roll)
      .multiply(tilt.makeRotationFromEuler(angles)).elements;

    for (const [partIndex, part] of model.entries()) {
      const { vertices, triangles, surface, texture, roughness } = part;
      const projected = transformed[partIndex];
      const glass = surface === "glass";
      const metal = surface === "case" || surface === "steel";
      const [r, g, b] = palette[surface];

      for (let i = 0; i < vertices.length; i += 9) {
        const x = vertices[i] * pose.scale;
        const y = (vertices[i + 1] - pose.y) * pose.scale;
        const z = (vertices[i + 2] - pose.z) * pose.scale;
        const px = m[0] * x + m[4] * y + m[8] * z;
        const py = m[1] * x + m[5] * y + m[9] * z;
        const dz = 1 / (cameraDistance - (m[2] * x + m[6] * y + m[10] * z));
        projected[i] = width / 2 + focal * px * dz;
        projected[i + 1] = height / 2 - focal * py * dz;
        projected[i + 2] = dz;
        const a = vertices[i + 3];
        const c = vertices[i + 4];
        const d = vertices[i + 5];
        const nx = m[0] * a + m[4] * c + m[8] * d;
        const ny = m[1] * a + m[5] * c + m[9] * d;
        const nz = m[2] * a + m[6] * c + m[10] * d;
        const viewLength = Math.hypot(px * dz, py * dz, 1);
        const vx = (-px * dz) / viewLength;
        const vy = (-py * dz) / viewLength;
        const vz = 1 / viewLength;
        const nv = Math.max(0, Math.min(1, nx * vx + ny * vy + nz * vz));
        const rx = 2 * nv * nx - vx;
        const ry = 2 * nv * ny - vy;
        const rz = 2 * nv * nz - vz;
        const key = Math.max(0, -0.62 * rx + 0.69 * ry + 0.37 * rz) ** 6;
        const stripFacing = Math.max(0, 0.52 * rx + 0.35 * ry + 0.78 * rz);
        const strip =
          stripFacing ** 3 *
          Math.max(0, 1 - Math.abs(0.83 * rx - 0.55 * rz)) ** 13;
        const rim = Math.max(0, 0.77 * rx + 0.21 * ry - 0.6 * rz) ** 9;
        const keyDiffuse = Math.max(0, -0.6 * nx + 0.68 * ny + 0.42 * nz);
        const fill = Math.max(0, 0.65 * nx + 0.35 * ny - 0.67 * nz);
        const occlusion = vertices[i + 8] ** 0.53;
        projected[i + 3] =
          occlusion *
          (metal
            ? 0.47 + 0.58 * key + 0.61 * strip + 0.36 * rim + 0.25 * keyDiffuse
            : 0.59 + 0.61 * keyDiffuse + 0.33 * fill + 0.1 * nv);
        if (glass) {
          const grazing = 1 - nv;
          const fresnel = 0.045 + 0.78 * grazing ** 4;
          const distance = 0.885 * rx - 0.07 * ry - 0.46 * rz;
          const forward = Math.max(0, Math.min(1, (0.46 * rx + 0.885 * rz - 0.1) / 0.55));
          const glint = forward * Math.exp(-520 * distance ** 2);
          const inner = forward * grazing * Math.exp(-1800 * (distance - 0.06) ** 2);
          const cardDistance = 0.39 * rx - 0.24 * ry + 0.89 * rz;
          const softCard = Math.exp(-24 * cardDistance ** 2) * Math.max(0, Math.min(1, -rx / 0.7));
          projected[i + 4] = Math.min(0.86, fresnel * (0.12 + 0.72 * key + 0.88 * strip + 0.38 * rim)
            + 0.16 * softCard + 0.18 * glint + 0.11 * inner + 0.05 * grazing ** 2);
        } else {
          projected[i + 4] = occlusion *
            ((metal ? 39 : 16) * key + (metal ? 34 : 12) * strip + 10 * rim);
        }
        projected[i + 5] = vertices[i + 6] * dz;
        projected[i + 6] = vertices[i + 7] * dz;
      }

      for (let i = 0; i < triangles.length; i += 3) {
        const a = triangles[i];
        const bIndex = triangles[i + 1];
        const c = triangles[i + 2];
        const ax = projected[a],
          ay = projected[a + 1];
        const bx = projected[bIndex],
          by = projected[bIndex + 1];
        const cx = projected[c],
          cy = projected[c + 1];
        const area = edge(ax, ay, bx, by, cx, cy);
        if (Math.abs(area) < 0.05 || (glass && area > 0)) continue;
        const inverseArea = 1 / area;
        const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
        const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
        const maxX = Math.min(width - 1, Math.ceil(Math.max(ax, bx, cx)));
        const maxY = Math.min(height - 1, Math.ceil(Math.max(ay, by, cy)));
        const offsetA = (by - cy) * inverseArea;
        const offsetB = (cy - ay) * inverseArea;

        for (let y = minY; y <= maxY; y++) {
          let wa = edge(bx, by, cx, cy, minX + 0.5, y + 0.5) * inverseArea;
          let wb = edge(cx, cy, ax, ay, minX + 0.5, y + 0.5) * inverseArea;
          for (
            let x = minX, pixel = y * width + minX;
            x <= maxX;
            x++, pixel++, wa += offsetA, wb += offsetB
          ) {
            const wc = 1 - wa - wb;
            if (wa < 0 || wb < 0 || wc < 0) continue;
            const dz =
              wa * projected[a + 2] +
              wb * projected[bIndex + 2] +
              wc * projected[c + 2];
            if (dz < depth[pixel] - (texture ? 0.000001 : 0)) continue;
            const p = pixel * 4;
            let shine =
              wa * projected[a + 4] +
              wb * projected[bIndex + 4] +
              wc * projected[c + 4];

            if (glass) {
              pixels[p] += (r - pixels[p]) * shine;
              pixels[p + 1] += (g - pixels[p + 1]) * shine;
              pixels[p + 2] += (b - pixels[p + 2]) * shine;
              if (!pixels[p + 3]) pixels[p + 3] = 255 * shine;
              continue;
            }

            if (texture) {
              const u =
                (wa * projected[a + 5] +
                  wb * projected[bIndex + 5] +
                  wc * projected[c + 5]) /
                dz;
              const v =
                (wa * projected[a + 6] +
                  wb * projected[bIndex + 6] +
                  wc * projected[c + 6]) /
                dz;
              const tx = Math.max(
                0,
                Math.min(texture.width - 1, u * texture.width - 0.5),
              );
              const ty = Math.max(
                0,
                Math.min(texture.height - 1, v * texture.height - 0.5),
              );
              const left = Math.floor(tx);
              const top = Math.floor(ty);
              const right = Math.min(texture.width - 1, left + 1);
              const bottom = Math.min(texture.height - 1, top + 1);
              const t00 = (top * texture.width + left) * 4;
              const t10 = (top * texture.width + right) * 4;
              const t01 = (bottom * texture.width + left) * 4;
              const t11 = (bottom * texture.width + right) * 4;
              const wx = tx - left;
              const wy = ty - top;
              const data = texture.data;
              for (let channel = 0; channel < 3; channel++) {
                const upper =
                  data[t00 + channel] * (1 - wx) + data[t10 + channel] * wx;
                const lower =
                  data[t01 + channel] * (1 - wx) + data[t11 + channel] * wx;
                pixels[p + channel] = upper * (1 - wy) + lower * wy;
              }
            } else {
              let light =
                wa * projected[a + 3] +
                wb * projected[bIndex + 3] +
                wc * projected[c + 3];
              if (roughness) {
                const u = (wa * projected[a + 5] + wb * projected[bIndex + 5] + wc * projected[c + 5]) / dz;
                const v = (wa * projected[a + 6] + wb * projected[bIndex + 6] + wc * projected[c + 6]) / dz;
                const repeat = metal ? 2 : 3;
                const relief = (metal ? 0.31 : 0.67) - grainAt(roughness, u * repeat, v * repeat);
                light *= 1 + relief * (metal ? 0.76 : 1.24);
                shine *= 1 + relief * 2.8;
              }
              pixels[p] = r * light + shine;
              pixels[p + 1] = g * light + shine;
              pixels[p + 2] = b * light + shine;
            }
            pixels[p + 3] = 255;
            depth[pixel] = dz;
          }
        }
      }
    }

    context.putImageData(bitmap, 0, 0);
  }

  return { draw };
}
