import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import type { MotionValue } from "motion/react";
import type { Finish, Size } from "./product";

const Scene = lazy(() => import("./WatchScene"));

export type WatchAngle = "overview" | "studio" | "case" | "display" | "band";
export type WatchStatus = "ready" | "unavailable";
export type WatchProps = {
  finish: Finish;
  size?: Size;
  angle?: WatchAngle;
  progress?: MotionValue<number>;
  onStatus?: (status: WatchStatus) => void;
};

export function WatchUnavailable({ onStatus }: Pick<WatchProps, "onStatus">) {
  useEffect(() => onStatus?.("unavailable"), [onStatus]);
  return <p className="viewer-status" role="status">3D-модель недоступна</p>;
}

class SceneBoundary extends Component<
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

export default function InteractiveWatch(props: WatchProps) {
  const host = useRef<HTMLDivElement>(null);
  const eager = props.angle === "overview";
  const [mounted, setMounted] = useState(eager);
  const [visible, setVisible] = useState(eager);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    if (!("IntersectionObserver" in window)) {
      setMounted(true);
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
      if (entry.isIntersecting) setMounted(true);
    }, { rootMargin: "160px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="watch-host" ref={host}>
      {mounted && (
        <SceneBoundary fallback={<WatchUnavailable onStatus={props.onStatus} />}>
          <Suspense fallback={null}>
            <Scene {...props} visible={visible} />
          </Suspense>
        </SceneBoundary>
      )}
    </div>
  );
}
