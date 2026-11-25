import { useCallback, useEffect, useRef, useState } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { ShoppingBag, Menu, X, ChevronDown, Rotate3D } from "lucide-react";
import { Cart } from "./Cart";
import Materials from "./Materials";
import Field from "./Field";
import Inside from "./Inside";
import Studio, { Swatches } from "./Studio";
import {
  cartKey,
  finishes,
  loadCart,
  type Finish,
  type Line,
  type Size,
} from "./product";

import InteractiveWatch from "./InteractiveWatch";
import { maxTurnDegrees, scrollTurn } from "./watch/motion";

function Logo() {
  return (
    <a className="logo" href="#overview" aria-label="AER, к началу">
      <span className="brand-symbol" aria-hidden="true">
        <i />
        <b />
      </span>
      AER
    </a>
  );
}
function Header({ count, open }: { count: number; open: () => void }) {
  const [menu, setMenu] = useState(false);
  const close = () => setMenu(false);
  return (
    <header className="site-head shell">
      <Logo />
      <nav
        className={menu ? "open" : ""}
        aria-label="Основное меню"
        id="site-nav"
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
        }}
      >
        <a href="#overview" onClick={close}>
          Обзор
        </a>
        <a href="#materials" onClick={close}>
          Материалы
        </a>
        <a href="#field" onClick={close}>
          На маршруте
        </a>
        <a href="#inside" onClick={close}>Внутри</a>
        <a href="#studio" onClick={close}>
          Конфигуратор
        </a>
      </nav>
      <div className="head-tools">
        <button
          className="bag-trigger"
          onClick={() => {
            close();
            open();
          }}
          aria-label={"Корзина, товаров " + count}
        >
          <ShoppingBag size={18} />
          <span>Корзина</span>
          <b>{count}</b>
        </button>
        <button
          className="mobile-toggle round"
          aria-controls="site-nav"
          aria-expanded={menu}
          aria-label={menu ? "Закрыть меню" : "Открыть меню"}
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}
function Hero({
  finish,
  change,
  onSettled,
}: {
  finish: Finish;
  change: (f: Finish) => void;
  onSettled: () => void;
}) {
  const track = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: track,
    offset: ["start start", "end end"],
    trackContentSize: true,
  });
  const angle = useTransform(
    scrollYProgress,
    (progress) => Math.round(scrollTurn(progress)) + "°",
  );
  const turn = useTransform(
    scrollYProgress,
    (progress) => scrollTurn(progress) / maxTurnDegrees,
  );

  return (
    <section className="hero-track" ref={track} aria-labelledby="product-name">
      <div className="hero shell">
        <div className="hero-copy">
          <span className="kicker">
            <i /> Умные часы
          </span>
          <h1 id="product-name">
            <span className="hero-line">AER</span>{" "}
            <span className="hero-line">
              ONE<span className="hero-period">.</span>
            </span>
          </h1>
          <p>
            Стрелочный циферблат. Мягкий силикон.
            <br />
            Один корпус для города и гор.
          </p>
          <div className="hero-actions">
            <a className="primary" href="#studio">
              Выбрать часы
            </a>
          </div>
        </div>
        <div className="hero-object">
          <div className="instrument-lines" aria-hidden="true">
            <i />
            <b />
          </div>
          <InteractiveWatch
            finish={finish}
            angle="overview"
            progress={scrollYProgress}
            onStatus={onSettled}
          />
          <div className="hero-view-hint mono" aria-hidden="true">
            <Rotate3D size={15} /> Потяните часы для поворота
          </div>
          {!reduced && (
            <div className="hero-turn mono" aria-hidden="true">
              <motion.span>{angle}</motion.span>
              <span className="hero-turn-track">
                <motion.i style={{ scaleX: turn }} />
              </span>
            </div>
          )}
        </div>
        <div className="hero-finish">
          <span className="mono">{finishes[finish]}</span>
          <Swatches finish={finish} change={change} />
        </div>
        <a className="scroll-link" href="#materials">
          <ChevronDown size={16} /> <span>Рассмотреть детали</span>
        </a>
      </div>
    </section>
  );
}

function EditionLoader({ active }: { active: boolean }) {
  return (
    <div
      className="edition-loader"
      data-active={active}
      role="status"
      aria-hidden={!active}
    >
      <div className="edition-loader-inner">
        <div className="edition-wordmark" aria-hidden="true">
          AER ONE<span>.</span>
        </div>
        <div className="edition-loading-track" aria-hidden="true">
          <i />
        </div>
        <p className="mono">Загружаем 3D-модель</p>
      </div>
    </div>
  );
}

export default function App() {
  const [finish, setFinish] = useState<Finish>("silver");
  const [loading, setLoading] = useState(true);
  const finishLoading = useCallback(() => setLoading(false), []);
  const [cart, setCart] = useState(loadCart);
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (!loading) return;
    const timeout = window.setTimeout(finishLoading, 8000);
    return () => window.clearTimeout(timeout);
  }, [finishLoading, loading]);
  useEffect(() => {
    if (!loading && ["#field", "#inside"].includes(location.hash) && window.scrollY === 0) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "instant" });
    }
  }, [loading]);
  useEffect(() => {
    try {
      localStorage.setItem(cartKey, JSON.stringify(cart));
    } catch {
      /* The session cart still works without storage. */
    }
  }, [cart]);
  const update = (color: Finish, size: Size, amount: number) =>
    setCart((prev) => {
      const existing = prev.some(
        (item) => item.color === color && item.size === size,
      );
      if (!existing)
        return amount > 0 ? [...prev, { color, size, quantity: amount }] : prev;
      return prev
        .map((item) =>
          item.color === color && item.size === size
            ? { ...item, quantity: item.quantity + amount }
            : item,
        )
        .filter((item) => item.quantity > 0);
    });
  return (
    <>
      <EditionLoader active={loading} />
      <div inert={loading}>
        <a href="#studio" className="skip">
          Перейти к выбору часов
        </a>
        <div id="overview">
          <Header
            count={cart.reduce((n, item) => n + item.quantity, 0)}
            open={() => setOpened(true)}
          />
        </div>
        <main>
          <Hero finish={finish} change={setFinish} onSettled={finishLoading} />
          <div className="spec-rail shell" aria-label="Особенности модели">
            <div>
              <b>OLED</b>
              <span>Always-On дисплей</span>
            </div>
            <div>
              <b>
                42 / 46 <small>мм</small>
              </b>
              <span>Два размера корпуса</span>
            </div>
            <div>
              <b>
                До 5 <small>дней</small>
              </b>
              <span>На одном заряде</span>
            </div>
          </div>
          <Materials finish={finish} />
          <Field finish={finish} />
          <Inside />
          <Studio
            finish={finish}
            setFinish={setFinish}
            add={(f, s) => {
              update(f, s, 1);
              setOpened(true);
            }}
          />
        </main>
        <footer className="shell">
          <Logo />
          <p>AER Instruments · Концепт умных часов</p>
          <a href="#overview">Наверх</a>
        </footer>
      </div>
      {opened && (
        <Cart
          lines={cart}
          close={() => setOpened(false)}
          change={(line: Line, amount) => update(line.color, line.size, amount)}
        />
      )}
    </>
  );
}
