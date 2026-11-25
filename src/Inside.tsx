import { useCallback, useEffect, useRef, useState } from "react";
import {
  motion, useInView, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useTransform,
} from "motion/react";
import FlightFrames from "./watch/FlightFrames";
import anchors from "./watch/inside-anchors.json";
import "./inside.css";

const shots = [
  { tab: "Облёт", heading: "Под оболочкой.", text: "От кромки стекла до контактов чипа. Листайте вниз, чтобы облететь корпус AER ONE и рассмотреть часы слой за слоем.", start: 0, frame: 0 },
  { tab: "Корпус", heading: "Линия корпуса.", text: "Сбоку виден стык стекла и сатинового алюминия. Утопленные кнопки следуют изгибу корпуса, а ушки удерживают мягкий ремешок.", start: 0.19, frame: 47 },
  { tab: "Дисплей", heading: "Свет под стеклом.", text: "Стекло поднимается первым. За ним отделяется тонкая OLED-панель. Её пиксели сами излучают свет, поэтому между стеклом и платой нет отдельной подсветки.", start: 0.40, frame: 86 },
  { tab: "Питание", heading: "Запас энергии.", text: "Под дисплеем лежит плоский литий-ионный аккумулятор в серебристой оболочке. Гибкий контакт соединяет его с электроникой часов.", start: 0.58, frame: 102 },
  { tab: "Плата", heading: "Связь деталей.", text: "На системной плате сходятся питание, экран и датчики. Тонкие медные дорожки ведут от контактов к главным компонентам.", start: 0.70, frame: 124 },
  { tab: "Чип A1", heading: "Внутри A1.", text: "В концепте AER ONE этот чип обрабатывает сигналы датчиков и обновляет циферблат. Золотистые контакты по краям связывают его с платой.", start: 0.88, frame: 160 },
] as const;
const asset = import.meta.env.BASE_URL + "inside/";
const annotations = ["", "", "Стекло", "Контакт питания", "Контакты платы", "Выводы чипа"];
const lastFrame = 160;

function shotAt(progress: number) {
  let index = 0;
  while (index + 1 < shots.length && progress >= shots[index + 1].start) index++;
  return index;
}

export default function Inside() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const frame = useMotionValue(0);
  const [active, setActive] = useState(0);
  const [decoded, setDecoded] = useState<number | null>(null);
  const reduced = useReducedMotion();
  const near = useInView(section, { once: true, margin: "500px 0px" });
  const { scrollYProgress } = useScroll({
    target: section, offset: ["start start", "end end"], trackContentSize: true,
  });
  const { scrollYProgress: entrance } = useScroll({
    target: section, offset: ["start end", "start start"],
  });
  const lift = useTransform(entrance, [0.15, 1], [72, 0]);
  const appear = useTransform(entrance, [0.16, 0.82], [0.1, 1]);

  const update = useCallback((progress: number) => {
    const t = Math.max(0, Math.min(1, progress));
    frame.set(Math.round(t * lastFrame));
    setActive(shotAt(t));
  }, [frame]);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (!reduced) update(v);
  });
  useEffect(() => {
    if (!reduced) update(scrollYProgress.get());
  }, [scrollYProgress, reduced, update]);

  function select(index: number) {
    setActive(index);
    if (reduced || !section.current || !stage.current) return;
    const p = shots[index].frame / lastFrame;
    update(p);
    const top = section.current.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + p * (section.current.offsetHeight - stage.current.offsetHeight), behavior: "instant" });
  }

  const shownFrame = (!reduced ? decoded : null) ?? shots[active].frame;
  const anchor = anchors[shownFrame];
  const annotation = annotations[shotAt(shownFrame / lastFrame)];
  return (
    <section className="inside" ref={section} id="inside" aria-label="Внутри AER ONE">
      <div className="inside-stage" ref={stage}>
        <div className="inside-spill" aria-hidden="true" />
        <div className="inside-layout shell">
          <div className="inside-copy">
            <span className="kicker"><i /> Внутри AER ONE</span>
            <motion.div key={active} initial={reduced ? false : { opacity: 0, y: 7 }}
              animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : 0.22 }}>
              <h2>{shots[active].heading}</h2>
              <p>{shots[active].text}</p>
            </motion.div>
          </div>
          <motion.figure className="inside-film" data-ready={decoded !== null} aria-label={shots[active].heading}
            style={reduced ? undefined : { y: lift, opacity: appear }}>
            <img src={asset + "shot-" + active + ".webp"} alt="" loading="lazy" width="832" height="832" />
            {near && !reduced && <FlightFrames frame={frame} showFrame={setDecoded} />}
            {anchor && annotation && (
              <figcaption className="inside-pin" data-left={anchor[0] > 51}
                style={{ left: anchor[0] + "%", top: anchor[1] + "%" }}>
                <span>{annotation}</span>
              </figcaption>
            )}
          </motion.figure>
          <nav className="inside-nav" aria-label="Детали часов">
            {shots.map((shot, i) => <button key={shot.tab} type="button" aria-pressed={i === active}
              onClick={() => select(i)}><span className="inside-mark" aria-hidden="true" />{shot.tab}</button>)}
          </nav>
        </div>
      </div>
    </section>
  );
}
