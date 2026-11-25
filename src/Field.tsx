import { useEffect, useId, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useAnimate,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
  type Variants,
} from "motion/react";
import { ArrowDown, Clock3, Compass, Mountain } from "lucide-react";
import type { Finish } from "./product";
import "./field.css";

const modes = [
  {
    title: "Время",
    heading: "На маршруте.",
    copy: "Местное время всегда под рукой. Даже когда вокруг только горы и тропа.",
    icon: Clock3,
  },
  {
    title: "Высота",
    heading: "Выше по склону.",
    copy: "Высотомер показывает отметку над уровнем моря и профиль подъёма.",
    icon: Mountain,
  },
  {
    title: "Компас",
    heading: "Держите курс.",
    copy: "Сверьтесь с компасом и следуйте по хребту на северо-запад.",
    icon: Compass,
  },
] as const;

const clockMarks = Array.from({ length: 60 }, (_, i) => i);
const localTime = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});
const trail =
  "M28 179 C50 184 58 151 79 153 S108 176 120 146 140 119 155 129 176 108 194 91";

function ClockFace() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const seconds = now.getSeconds();
  const minutes = now.getMinutes() + seconds / 60;
  const hours = now.getHours() + minutes / 60;
  return (
    <svg
      viewBox="0 0 220 263"
      role="img"
      aria-label={`Местное время ${localTime.format(now)}`}
    >
      <text x="110" y="26" className="instrument-label" textAnchor="middle">
        МЕСТНОЕ ВРЕМЯ
      </text>
      {clockMarks.map((i) => (
        <line
          key={i}
          x1="110"
          y1={i % 5 === 0 ? 51 : 55}
          x2="110"
          y2="44"
          stroke={i % 5 === 0 ? "#d9ddd2" : "#5d6660"}
          strokeWidth={i % 5 === 0 ? 2.5 : 1}
          transform={`rotate(${i * 6} 110 131)`}
        />
      ))}
      <g className="clock-numbers" textAnchor="middle">
        <text x="110" y="76">
          12
        </text>
        <text x="170" y="137">
          3
        </text>
        <text x="110" y="200">
          6
        </text>
        <text x="50" y="137">
          9
        </text>
      </g>
      <line
        x1="110"
        y1="134"
        x2="110"
        y2="88"
        stroke="#f3f3e9"
        strokeWidth="6"
        strokeLinecap="round"
        transform={`rotate(${hours * 30} 110 131)`}
      />
      <line
        x1="110"
        y1="136"
        x2="110"
        y2="67"
        stroke="#e2e8dd"
        strokeWidth="4"
        strokeLinecap="round"
        transform={`rotate(${minutes * 6} 110 131)`}
      />
      <line
        x1="110"
        y1="147"
        x2="110"
        y2="53"
        stroke="#fb794d"
        strokeWidth="1.5"
        transform={`rotate(${seconds * 6} 110 131)`}
      />
      <circle cx="110" cy="131" r="4" fill="#fb794d" />
      <text x="110" y="240" className="instrument-digits" textAnchor="middle">
        {localTime.format(now)}
      </text>
    </svg>
  );
}

const elevationStart = { x: 24, y: 205, meters: 2000 };
const elevationEnd = { x: 195, y: 140, meters: 2480 };
const elevationPoints = [
  elevationStart,
  { x: 43, y: 197 },
  { x: 58, y: 202 },
  { x: 79, y: 183 },
  { x: 96, y: 189 },
  { x: 123, y: 169 },
  { x: 142, y: 175 },
  { x: 157, y: 156 },
  { x: 173, y: 160 },
  elevationEnd,
];
const elevationProfile =
  "M" + elevationPoints.map(({ x, y }) => `${x} ${y}`).join(" ");
const metersFormat = new Intl.NumberFormat("ru-RU");

function elevationYAt(x: number) {
  const nextIndex = elevationPoints.findIndex((point) => point.x >= x);
  if (nextIndex < 1) return nextIndex === 0 ? elevationStart.y : elevationEnd.y;
  const previous = elevationPoints[nextIndex - 1];
  const next = elevationPoints[nextIndex];
  return (
    previous.y +
    ((next.y - previous.y) * (x - previous.x)) / (next.x - previous.x)
  );
}

function ElevationFace({
  progress,
  reduced,
}: {
  progress: MotionValue<number>;
  reduced: boolean;
}) {
  const id = useId();
  const x = useTransform(
    progress,
    [1 / 3, 2 / 3],
    [elevationStart.x, elevationEnd.x],
  );
  const y = useTransform(x, elevationYAt);
  const fillWidth = useTransform(x, (value) => value - elevationStart.x + 1.5);
  const meters = useTransform(y, (value) => {
    const rise =
      (elevationStart.y - value) / (elevationStart.y - elevationEnd.y);
    const reading =
      elevationStart.meters +
      (elevationEnd.meters - elevationStart.meters) * rise;
    return metersFormat.format(Math.round(reading / 5) * 5);
  });

  return (
    <svg
      viewBox="0 0 220 263"
      role="img"
      aria-label="Демо высотомера. Профиль подъёма от 2 000 до 2 480 метров над уровнем моря."
    >
      <defs>
        <linearGradient id={`${id}-fill`} x2="0" y2="1">
          <stop stopColor="#f18f54" stopOpacity=".44" />
          <stop offset="1" stopColor="#f18f54" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-progress`}>
          <motion.rect
            x={elevationStart.x}
            y="136"
            height="84"
            width={
              reduced ? elevationEnd.x - elevationStart.x + 1.5 : fillWidth
            }
          />
        </clipPath>
      </defs>
      <text x="24" y="35" className="instrument-label">
        ВЫСОТОМЕР
      </text>
      <text x="24" y="91" className="instrument-number">
        <motion.tspan>
          {reduced ? metersFormat.format(elevationEnd.meters) : meters}
        </motion.tspan>
        <tspan dx="6" className="instrument-unit">
          м
        </tspan>
      </text>
      <text x="25" y="111" className="instrument-label">
        НАД УРОВНЕМ МОРЯ
      </text>
      <path
        d="M24 153H196 M24 174H196 M24 195H196 M24 216H196"
        stroke="#373d37"
        strokeDasharray="3 4"
      />
      <path
        d={`${elevationProfile}V218H24Z`}
        fill={`url(#${id}-fill)`}
        clipPath={`url(#${id}-progress)`}
      />
      <path
        d={elevationProfile}
        fill="none"
        stroke="#b07454"
        strokeOpacity="0.62"
        strokeDasharray="3 4"
      />
      <path
        d={elevationProfile}
        fill="none"
        stroke="#ffa063"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        clipPath={`url(#${id}-progress)`}
      />
      <motion.circle
        cx={reduced ? elevationEnd.x : x}
        cy={reduced ? elevationEnd.y : y}
        r="4.5"
        fill="#ffc298"
        stroke="#211710"
        strokeWidth="1.5"
      />
      <text x="24" y="240" className="instrument-label">
        ПРОФИЛЬ ПОДЪЁМА
      </text>
    </svg>
  );
}

function CompassFace({
  progress,
  reduced,
}: {
  progress: MotionValue<number>;
  reduced: boolean;
}) {
  const path = useRef<SVGPathElement>(null);
  const waypoint = useRef<SVGCircleElement>(null);
  const routeProgress = useTransform(progress, [2 / 3, 1], [0.08, 1]);
  const needle = useTransform(progress, [2 / 3, 1], [-52, -36]);
  const course = useTransform(needle, (angle) => Math.round(360 + angle) + "°");

  useEffect(() => {
    const route = path.current;
    const marker = waypoint.current;
    if (!route || !marker) return;
    const length = route.getTotalLength();
    const placeMarker = (value: number) => {
      const point = route.getPointAtLength(length * value);
      marker.setAttribute("cx", String(point.x));
      marker.setAttribute("cy", String(point.y));
    };
    placeMarker(reduced ? 1 : routeProgress.get());
    if (!reduced) return routeProgress.on("change", placeMarker);
  }, [reduced, routeProgress]);

  return (
    <svg
      viewBox="0 0 220 263"
      role="img"
      aria-label="Демо компаса. Лесной маршрут на северо-запад, курс 324 градуса."
    >
      <text x="22" y="33" className="instrument-label">
        КОМПАС
      </text>
      <motion.text x="21" y="72" className="instrument-bearing">
        {reduced ? "324°" : course}
      </motion.text>
      <circle cx="174" cy="48" r="22" fill="none" stroke="#68786a" />
      <motion.path
        d="M174 32 181 57 174 53 167 57Z"
        fill="#fb794d"
        style={{
          rotate: reduced ? -36 : needle,
          transformOrigin: "174px 48px",
        }}
      />
      <rect x="20" y="84" width="180" height="126" rx="10" fill="#141e18" />
      <g fill="none" stroke="#374d3b">
        <path d="M22 119Q60 128 77 111T133 99 186 85 M22 131Q59 139 85 120T137 110 198 99 M22 143Q64 153 90 132T147 120 198 114 M22 158Q68 169 99 142T154 135 198 130 M30 204Q56 189 86 201T143 179 198 162 M69 210Q106 202 126 207T177 187 197 179 M135 210Q154 202 180 201T197 191" />
      </g>
      <path
        ref={path}
        d={trail}
        fill="none"
        stroke="#75987c"
        strokeWidth="2"
        strokeDasharray="3 4"
      />
      <motion.path
        d={trail}
        fill="none"
        stroke="#cde3a7"
        strokeWidth="2.8"
        strokeLinecap="round"
        pathLength={reduced ? 1 : routeProgress}
      />
      <circle
        ref={waypoint}
        cx="28"
        cy="179"
        r="4.5"
        fill="#ff8759"
        stroke="#101913"
        strokeWidth="1.5"
      />
      <text x="22" y="238" className="instrument-label">
        СЕВЕРО-ЗАПАД
      </text>
    </svg>
  );
}

const faceTransition = {
  enter: (direction: number) => ({
    opacity: 0,
    x: `${direction * 14}%`,
  }),
  visible: {
    opacity: 1,
    x: "0%",
    transition: { delay: 0.075, duration: 0.23, ease: [0.16, 1, 0.3, 1] },
  },
  leave: (direction: number) => ({
    opacity: 0,
    x: `${-direction * 11}%`,
    transition: { duration: 0.13, ease: "easeIn" },
  }),
} satisfies Variants;

export default function Field({ finish }: { finish: Finish }) {
  const track = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const segment = useRef(0);
  const previousMode = useRef(0);
  const [watch, animateWatch] = useAnimate<HTMLElement>();
  const reduced = useReducedMotion() ?? false;
  const [{ active, direction }, setMode] = useState({
    active: 0,
    direction: 1,
  });
  const { scrollYProgress } = useScroll({
    target: track,
    offset: ["start start", "end end"],
    trackContentSize: true,
  });
  const scale = useTransform(scrollYProgress, [0, 1], [1.035, 1.27]);
  const panX = useTransform(scrollYProgress, [0, 1], ["0%", "-6%"]);
  const panY = useTransform(scrollYProgress, [0, 1], ["0%", "4%"]);
  const current = modes[active];

  useEffect(() => {
    const changed = previousMode.current !== active;
    previousMode.current = active;
    const figure = watch.current;
    if (!figure) return;

    if (reduced) {
      figure.style.transform = "";
      return;
    }
    if (!changed) return;

    const movement = animateWatch(
      figure,
      {
        x: [null, -14 * direction, 10 * direction, 0],
        y: [null, 4, -8, 0],
        scale: [null, 0.982, 1.025, 1],
      },
      {
        duration: 0.44,
        times: [0, 0.18, 0.44, 1],
        ease: ["easeOut", "easeOut", [0.2, 0.85, 0.3, 1]],
      },
    );
    const gleam = animateWatch(
      ".field-screen-gleam",
      {
        x: [`${-92 * direction}%`, `${92 * direction}%`],
        opacity: [0, 0.66, 0],
      },
      { delay: 0.08, duration: 0.32, ease: "easeOut" },
    );
    return () => {
      movement.stop();
      gleam.cancel();
    };
  }, [active, animateWatch, direction, reduced, watch]);

  function updateMode(index: number) {
    setMode((previous) =>
      previous.active === index
        ? previous
        : { active: index, direction: Math.sign(index - previous.active) },
    );
  }

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    if (
      reduced ||
      !track.current ||
      !stage.current ||
      track.current.offsetHeight <= stage.current.offsetHeight + 1
    )
      return;
    const next = Math.min(
      modes.length - 1,
      Math.floor(progress * modes.length),
    );
    if (next < 0 || segment.current === next) return;
    segment.current = next;
    updateMode(next);
  });

  function selectMode(index: number) {
    segment.current = index;
    updateMode(index);
    if (reduced || !track.current || !stage.current) return;
    const distance = track.current.offsetHeight - stage.current.offsetHeight;
    if (distance <= 1) return;
    window.scrollTo({
      top:
        track.current.getBoundingClientRect().top +
        window.scrollY +
        (distance * (index + 0.18)) / modes.length,
      behavior: "instant",
    });
  }

  return (
    <section
      className="field"
      id="field"
      ref={track}
      aria-label="Режимы дисплея"
    >
      <div className="field-stage" ref={stage}>
        <motion.img
          className="field-landscape"
          src={import.meta.env.BASE_URL + "images/ridge.webp"}
          alt=""
          loading="lazy"
          style={reduced ? undefined : { scale, x: panX, y: panY }}
        />
        <div className="field-inner shell">
          <div className="field-story">
            <span className="kicker">
              <i /> Режимы дисплея
            </span>
            <div className="field-narrative">
              <AnimatePresence initial={false} mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: reduced ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduced ? 0 : 0.17 }}
                >
                  <h2>{current.heading}</h2>
                  <p>{current.copy}</p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
          <figure
            ref={watch}
            className="field-watch"
            aria-label={`Экран часов AER ONE · ${current.title}`}
          >
            <img
              src={`${import.meta.env.BASE_URL}models/aer-field-${finish}.webp`}
              alt=""
              width="800"
              height="1180"
              loading="lazy"
            />
            <div className="field-screen">
              <AnimatePresence initial={false} custom={direction}>
                <motion.div
                  className="field-face"
                  key={active}
                  custom={direction}
                  variants={faceTransition}
                  initial={reduced ? false : "enter"}
                  animate={reduced ? undefined : "visible"}
                  exit={reduced ? undefined : "leave"}
                >
                  {active === 0 && <ClockFace />}
                  {active === 1 && (
                    <ElevationFace
                      progress={scrollYProgress}
                      reduced={reduced}
                    />
                  )}
                  {active === 2 && (
                    <CompassFace progress={scrollYProgress} reduced={reduced} />
                  )}
                </motion.div>
              </AnimatePresence>
              <span className="field-screen-gleam" aria-hidden="true" />
            </div>
          </figure>
          <div className="field-controls">
            <div
              className="field-tabs"
              role="group"
              aria-label="Режим дисплея часов"
            >
              {modes.map(({ title, icon: ModeIcon }, i) => (
                <button
                  type="button"
                  key={title}
                  aria-pressed={active === i}
                  onClick={() => selectMode(i)}
                >
                  <ModeIcon size={16} aria-hidden="true" /> {title}
                </button>
              ))}
            </div>
            {!reduced && (
              <span className="field-guide mono" aria-hidden="true">
                <ArrowDown size={14} />
                {active === 2
                  ? "Листайте, чтобы пройти маршрут"
                  : "Листайте, чтобы сменить режим"}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
