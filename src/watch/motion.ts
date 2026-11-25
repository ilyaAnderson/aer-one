import type { WatchAngle } from "../InteractiveWatch";

export const maxTurnDegrees = 70;
export const cameraDistance = 10.8;
export const cameraFov = 31;

export type View = { yaw: number; pitch: number };
export type Pose = View & { roll: number; scale: number; y: number; z: number };
export const poses = {
  overview: { yaw: -0.65, pitch: 0.21, roll: -0.32, scale: 73, y: 0, z: 0 },
  studio: { yaw: -0.53, pitch: 0.19, roll: -0.12, scale: 65, y: 0, z: 0 },
  case: { yaw: -0.95, pitch: 0.28, roll: 0.16, scale: 106, y: 0.005, z: 0.021 },
  display: { yaw: -0.12, pitch: 0.07, roll: -0.12, scale: 108, y: 0, z: 0.027 },
  band: {
    yaw: -1.72,
    pitch: 0.35,
    roll: 0.24,
    scale: 103,
    y: 0.002,
    z: -0.013,
  },
} satisfies Record<WatchAngle, Pose>;

export function scrollTurn(progress: number) {
  return Math.max(0, Math.min(1, progress)) * maxTurnDegrees;
}

export function watchPose(
  angle: WatchAngle,
  view: View,
  progress: number,
  size: number,
  aspect: number,
): Pose {
  const pose = poses[angle];
  return {
    ...pose,
    yaw: pose.yaw + view.yaw,
    pitch: pose.pitch + view.pitch,
    roll: pose.roll - (scrollTurn(progress) * Math.PI) / 180,
    scale: pose.scale * Math.min(1, aspect / 0.82) * (size === 46 ? 1.075 : 1),
  };
}

export function settlePose(current: Pose, target: Pose, elapsed: number) {
  const blend = -Math.expm1(-10 * Math.min(elapsed, 0.05));
  let moving = false;
  for (const key of Object.keys(target) as (keyof Pose)[]) {
    const difference = target[key] - current[key];
    if (Math.abs(difference) < 0.001) {
      current[key] = target[key];
    } else {
      current[key] += difference * blend;
      moving = true;
    }
  }
  return moving;
}
