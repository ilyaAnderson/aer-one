import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent, PointerEvent, ReactNode, RefObject } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { useReducedMotion } from "motion/react";
import {
  Box3,
  Object3D,
  Group,
  Material,
  MathUtils,
  NeutralToneMapping,
  Mesh,
  MeshStandardMaterial,
  MeshBasicMaterial,
  Vector3,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { type WatchProps } from "./InteractiveWatch";
import { applyFinish, createSurface } from "./watch/surfaces";
import {
  cameraDistance,
  cameraFov,
  maxTurnDegrees,
  settlePose,
  watchPose,
  type Pose,
  type View,
} from "./watch/motion";
import { createStudio } from "./watch/studio";

type SceneProps = WatchProps & { visible: boolean };
export type RendererProps = SceneProps & {
  asset: Object3D;
  rotation: RefObject<View>;
  invalidateRef: RefObject<() => void>;
  onRendered: () => void;
};

const modelUrl = import.meta.env.BASE_URL + "models/aer-one.glb";
const maxYaw = MathUtils.degToRad(maxTurnDegrees);
const SoftwareWatch = lazy(() => import("./watch/SoftwareWatch"));
let webGLAvailable: boolean | undefined;

function hasWebGL() {
  if (webGLAvailable === undefined) {
    const context = document.createElement("canvas").getContext("webgl2");
    webGLAvailable = context !== null;
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  }
  return webGLAvailable;
}

class GraphicsBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Product({
  asset,
  finish,
  size = 42,
  angle = "studio",
  visible,
  progress,
  rotation,
  invalidateRef,
  onRendered,
}: RendererProps) {
  const { gl, scene, invalidate, size: viewport } = useThree();
  const roll = useRef<Group>(null);
  const pivot = useRef<Group>(null);
  const model = useRef<Group>(null);
  const focus = useRef<Group>(null);
  const rendered = useRef(false);
  const firstFrame = useRef(0);
  const current = useRef<Pose>(null);
  const reduced = useReducedMotion();
  const instance = useMemo(() => {
    const product = asset.clone(true);
    const materials = new Map<Material, Material>();
    const instanceMaterial = (source: Material) => {
      const cached = materials.get(source);
      if (cached) return cached;
      const surface = createSurface(source);
      const textures = surface instanceof MeshStandardMaterial
        ? [surface.map, surface.normalMap, surface.roughnessMap]
        : surface instanceof MeshBasicMaterial ? [surface.map] : [];
      const anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
      for (const texture of textures) {
        if (texture && texture.anisotropy !== anisotropy) {
          texture.anisotropy = anisotropy;
          texture.needsUpdate = true;
        }
      }
      materials.set(source, surface);
      return surface;
    };
    product.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.material = Array.isArray(child.material)
        ? child.material.map(instanceMaterial)
        : instanceMaterial(child.material);
      if (!Array.isArray(child.material) && child.material.transparent)
        child.renderOrder = 2;
    });
    const center = new Box3().setFromObject(product).getCenter(new Vector3());
    product.position.sub(center);
    return { product, materials };
  }, [gl, asset]);

  useLayoutEffect(() => {
    const studio = createStudio(gl);
    scene.environment = studio.texture;
    scene.environmentIntensity = 1;
    invalidate();
    return () => {
      scene.environment = null;
      studio.dispose();
    };
  }, [gl, scene, invalidate]);

  useLayoutEffect(() => {
    for (const material of instance.materials.values())
      applyFinish(material, finish);
    invalidate();
  }, [instance, finish, invalidate]);

  // The demand loop may be asleep when the angle changes via the tabs.
  useLayoutEffect(() => {
    if (visible) invalidate();
  }, [angle, size, progress, visible, invalidate]);

  useLayoutEffect(() => {
    invalidateRef.current = () => {
      if (visible) invalidate();
    };
    if (visible || !rendered.current) invalidate();
    return () => {
      invalidateRef.current = () => {};
    };
  }, [invalidate, invalidateRef, visible]);

  useEffect(
    () => () => {
      cancelAnimationFrame(firstFrame.current);
      for (const material of instance.materials.values()) material.dispose();
    },
    [instance],
  );

  useFrame((state, delta) => {
    if (!roll.current || !pivot.current || !model.current || !focus.current)
      return;
    const first = !rendered.current;
    const scroll = reduced ? 0 : (progress?.get() ?? 0);
    const target = watchPose(
      angle,
      rotation.current,
      scroll,
      size,
      viewport.width / viewport.height,
    );
    if (first || reduced || !current.current) current.current = target;
    const pose = current.current;
    const moving = settlePose(pose, target, delta);
    roll.current.rotation.z = pose.roll;
    pivot.current.rotation.x = pose.pitch;
    pivot.current.rotation.y = pose.yaw;
    model.current.scale.setScalar(pose.scale);
    focus.current.position.y = -pose.y;
    focus.current.position.z = -pose.z;

    if (first) {
      rendered.current = true;
      firstFrame.current = requestAnimationFrame(onRendered);
    }
    if (moving && visible) state.invalidate();
  });

  return (
    <group ref={roll}>
      <group ref={pivot} rotation-order="YXZ">
        <group ref={model}>
          <group ref={focus}>
            <primitive object={instance.product} />
          </group>
        </group>
      </group>
    </group>
  );
}

export default function WatchScene(props: SceneProps) {
  const { angle = "studio", onStatus, progress } = props;
  const { scene: asset } = useLoader(GLTFLoader, modelUrl);
  const rotation = useRef<View>({ yaw: 0, pitch: 0 });
  const redraw = useRef(() => {});
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  useEffect(() => progress?.on("change", () => redraw.current()), [progress]);

  const changeView = (yaw: number, pitch: number) => {
    rotation.current = {
      yaw: MathUtils.clamp(yaw, -maxYaw, maxYaw),
      pitch: MathUtils.clamp(pitch, -0.63, 0.63),
    };
    redraw.current();
  };
  const reset = () => changeView(0, 0);
  useLayoutEffect(() => {
    rotation.current = { yaw: 0, pitch: 0 };
    redraw.current();
  }, [angle]);

  function key(event: KeyboardEvent<HTMLDivElement>) {
    if (!ready) return;
    const { yaw, pitch } = rotation.current;
    switch (event.key) {
      case "ArrowLeft":
        changeView(yaw - 0.11, pitch);
        break;
      case "ArrowRight":
        changeView(yaw + 0.11, pitch);
        break;
      case "ArrowUp":
        changeView(yaw, pitch - 0.09);
        break;
      case "ArrowDown":
        changeView(yaw, pitch + 0.09);
        break;
      case "Home":
        reset();
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  function press(event: PointerEvent<HTMLDivElement>) {
    if (!ready || !event.isPrimary || event.button !== 0) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const previous = drag.current;
    if (!previous || previous.id !== event.pointerId) return;
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    const sensitivity = event.pointerType === "touch" ? 0.0028 : 0.0025;
    previous.x = event.clientX;
    previous.y = event.clientY;
    changeView(
      rotation.current.yaw + dx * sensitivity,
      rotation.current.pitch + dy * sensitivity * 0.7,
    );
  }

  function stop(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
  }

  const renderer = {
    ...props,
    asset,
    rotation,
    invalidateRef: redraw,
    onRendered: () => {
      setReady(true);
      onStatus?.("ready");
    },
  };
  const software = (
    <Suspense fallback={null}>
      <SoftwareWatch {...renderer} />
    </Suspense>
  );

  return (
    <div
      className="watch-interaction"
      data-ready={ready}
      data-dragging={dragging}
      tabIndex={ready ? 0 : undefined}
      role={ready ? "group" : undefined}
      aria-label={
        ready
          ? "3D-модель AER ONE. Стрелки поворачивают часы, Home возвращает ракурс."
          : undefined
      }
      onKeyDown={key}
      onPointerDown={press}
      onPointerMove={move}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onDoubleClick={reset}
    >
      {hasWebGL() ? (
        <GraphicsBoundary fallback={software}>
          <Canvas
            className="watch-canvas"
            frameloop="demand"
            dpr={[1.5, 2.5]}
            camera={{
              position: [0, 0, cameraDistance],
              fov: cameraFov,
              near: 0.1,
              far: 40,
            }}
            gl={{
              alpha: true,
              antialias: true,
              powerPreference: "default",
              toneMapping: NeutralToneMapping,
            }}
            style={{ position: "absolute", inset: 0 }}
          >
            <Product {...renderer} />
          </Canvas>
        </GraphicsBoundary>
      ) : (
        software
      )}
    </div>
  );
}
