import { useLayoutEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "motion/react";
import type { RendererProps } from "../WatchScene";
import { settlePose, watchPose, type Pose } from "./motion";
import { createRasterizer, prepareModel } from "./rasterizer";

export default function SoftwareWatch({
  asset,
  angle = "studio",
  finish,
  size = 42,
  progress,
  visible,
  rotation,
  invalidateRef,
  onRendered,
}: RendererProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const rendered = useRef(false);
  const notify = useRef(onRendered);
  const reduced = useReducedMotion();
  const current = useRef<Pose>(null);
  const model = useMemo(() => prepareModel(asset), [asset]);
  notify.current = onRendered;

  useLayoutEffect(() => {
    const node = canvas.current!;
    if (!visible && rendered.current) return;

    const rasterizer = createRasterizer(node, model, finish);
    let frame = 0;
    let previous = 0;
    function requestFrame() {
      if (!frame) frame = requestAnimationFrame(draw);
    }
    function draw(now: number) {
      frame = 0;
      const width = node.clientWidth;
      const height = node.clientHeight;
      if (!width || !height) return;
      const scroll = reduced ? 0 : (progress?.get() ?? 0);
      const target = watchPose(
        angle,
        rotation.current,
        scroll,
        size,
        width / height,
      );
      if (!current.current || reduced) current.current = target;
      const moving = settlePose(
        current.current,
        target,
        previous ? (now - previous) / 1000 : 0.016,
      );
      previous = now;
      rasterizer.draw(current.current, width, height, moving);
      if (!rendered.current) {
        rendered.current = true;
        notify.current();
      }
      if (moving) requestFrame();
    }

    invalidateRef.current = requestFrame;
    const observer = new ResizeObserver(requestFrame);
    observer.observe(node);
    requestFrame();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      invalidateRef.current = () => {};
    };
  }, [
    angle,
    finish,
    invalidateRef,
    model,
    progress,
    reduced,
    rotation,
    size,
    visible,
  ]);

  return <canvas className="watch-software" ref={canvas} aria-hidden="true" />;
}
