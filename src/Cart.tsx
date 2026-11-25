import { useEffect, useRef } from "react";
import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import { finishes, money, poster, type Line } from "./product";

export function Cart({
  lines,
  close,
  change,
}: {
  lines: Line[];
  close: () => void;
  change: (line: Line, amount: number) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      previousFocus?.focus();
    };
  }, []);
  const count = lines.reduce((n, item) => n + item.quantity, 0);
  return (
    <dialog
      ref={ref}
      className="bag"
      aria-labelledby="bag-title"
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="bag-inner">
        <header>
          <h2 id="bag-title">
            Корзина <sup>{count}</sup>
          </h2>
          <button
            className="round"
            onClick={close}
            aria-label="Закрыть корзину"
          >
            <X />
          </button>
        </header>
        {lines.length ? (
          <>
            <div className="bag-lines">
              {lines.map((line) => (
                <article key={line.color + line.size}>
                  <img src={poster(line.color)} alt="" />
                  <div>
                    <h3>AER ONE</h3>
                    <p>
                      {finishes[line.color]} · {line.size} мм
                    </p>
                    <div className="qty">
                      <button
                        onClick={() => change(line, -1)}
                        aria-label={
                          "Уменьшить количество, " +
                          finishes[line.color] +
                          " " +
                          line.size +
                          " мм"
                        }
                      >
                        <Minus size={14} />
                      </button>
                      {line.quantity}
                      <button
                        onClick={() => change(line, 1)}
                        aria-label={
                          "Увеличить количество, " +
                          finishes[line.color] +
                          " " +
                          line.size +
                          " мм"
                        }
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                  <b>{money(line.quantity)}</b>
                </article>
              ))}
            </div>
            <div className="bag-summary">
              <strong>Итого</strong>
              <strong>{money(count)}</strong>
            </div>
            <p className="muted">
              Демонстрационная корзина. Заказ и оплата недоступны.
            </p>
          </>
        ) : (
          <div className="empty">
            <ShoppingBag strokeWidth={1} />
            <h3>Корзина пуста</h3>
            <a className="primary" href="#studio" onClick={close}>
              Выбрать часы
            </a>
          </div>
        )}
      </div>
    </dialog>
  );
}
