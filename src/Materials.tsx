import { useRef, useState } from "react";
import { useMotionValueEvent, useScroll } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Finish } from "./product";
import InteractiveWatch from "./InteractiveWatch";

const chapters = [
  {
    title: "Корпус",
    headline: "Сатиновый металл",
    body: "Мягкий свет на плоскости корпуса и тонкий блик по полированному краю. Две кнопки легко найти на ощупь.",
    material: "Алюминий",
    angle: "case",
  },
  {
    title: "Дисплей",
    headline: "Глубокий чёрный",
    body: "Минутная шкала доходит до края стекла. Белые метки и оранжевая секундная стрелка читаются одним взглядом.",
    material: "OLED · Always-On",
    angle: "display",
  },
  {
    title: "Ремешок",
    headline: "Мягкая посадка",
    body: "Мягкий ремешок огибает запястье. Отверстия по всей длине позволяют точно подогнать посадку.",
    material: "Силикон",
    angle: "band",
  },
] as const;

export default function Materials({ finish }: { finish: Finish }) {
  const host = useRef<HTMLElement>(null);
  const sticky = useRef<HTMLDivElement>(null);
  const scrollChapter = useRef(0);
  const selectedAt = useRef<number | null>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({
    target: host,
    offset: ["start start", "end end"],
  });
  const selectChapter = (index: number) => {
    selectedAt.current = scrollYProgress.get();
    setActive(index);
  };

  // Preserve the clicked angle through small scroll adjustments. Give control
  // back to the scroll position once the visitor moves into another chapter.
  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    if (!host.current || !sticky.current) return;
    const travel = host.current.offsetHeight - sticky.current.offsetHeight;
    if (travel <= 20) return;
    const next = Math.min(
      chapters.length - 1,
      Math.max(0, Math.floor(progress * chapters.length)),
    );
    if (next === scrollChapter.current) return;
    if (
      selectedAt.current !== null &&
      Math.abs(progress - selectedAt.current) * travel < 24
    )
      return;
    selectedAt.current = null;
    scrollChapter.current = next;
    setActive(next);
  });
  const current = chapters[active];
  return (
    <section id="materials" ref={host} className="chapter">
      <div className="chapter-sticky" ref={sticky}>
        <div className="chapter-caption">
          <span className="kicker">
            <i /> Материалы
          </span>
          <h2>В деталях.</h2>
        </div>
        <div className="macro-stage">
          <InteractiveWatch finish={finish} angle={current.angle} />
        </div>
        <div className="chapter-controls">
          <div className="chapter-tabs" role="group" aria-label="Ракурс часов">
            {chapters.map((c, i) => (
              <button
                key={c.title}
                aria-pressed={i === active}
                onClick={() => selectChapter(i)}
              >
                {c.title}
              </button>
            ))}
          </div>
          <div className="chapter-story" aria-live="polite">
            <span className="mono">{current.material}</span>
            <h3>{current.headline}</h3>
            <p>{current.body}</p>
          </div>
          <div className="chapter-pager">
            <span className="mono">0{active + 1} / 03</span>
            <div>
              <button
                disabled={active === 0}
                className="round"
                aria-label="Предыдущая деталь"
                onClick={() => selectChapter(active - 1)}
              >
                <ChevronLeft />
              </button>
              <button
                disabled={active === chapters.length - 1}
                className="round"
                aria-label="Следующая деталь"
                onClick={() => selectChapter(active + 1)}
              >
                <ChevronRight />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
