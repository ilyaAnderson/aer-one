import { useState } from "react";
import InteractiveWatch, { type WatchStatus } from "./InteractiveWatch";
import { Rotate3D, Plus } from "lucide-react";
import { finishes, money, type Finish, type Size } from "./product";

export function Swatches({
  finish,
  change,
}: {
  finish: Finish;
  change: (f: Finish) => void;
}) {
  return (
    <div className="swatches" role="group" aria-label="Отделка часов">
      {(Object.keys(finishes) as Finish[]).map((f) => (
        <button
          key={f}
          type="button"
          className={"swatch " + f}
          aria-label={finishes[f]}
          aria-pressed={finish === f}
          onClick={() => change(f)}
          title={finishes[f]}
        >
          <span />
        </button>
      ))}
    </div>
  );
}

export default function Studio({
  finish,
  setFinish,
  add,
}: {
  finish: Finish;
  setFinish: (f: Finish) => void;
  add: (f: Finish, s: Size) => void;
}) {
  const [size, setSize] = useState<Size>(42);
  const [status, setStatus] = useState<WatchStatus>();
  return (
    <section className="studio shell" id="studio">
      <div className="section-lead">
        <span className="kicker">
          <i /> Конфигуратор
        </span>
        <h2>Выберите свой ONE.</h2>
      </div>
      <div className="studio-grid">
        <div className="viewer">
          <InteractiveWatch finish={finish} size={size} onStatus={setStatus} />
          {status === "ready" && (
            <div className="view-tools mono">
              <Rotate3D size={16} aria-hidden="true" /> Потяните часы для поворота
            </div>
          )}
        </div>
        <div className="purchase">
          <div className="purchase-intro">
            <span className="mono">Умные часы</span>
            <h3>AER ONE</h3>
            <strong>{money()}</strong>
          </div>
          <fieldset>
            <legend>
              Цвет корпуса <b>{finishes[finish]}</b>
            </legend>
            <Swatches finish={finish} change={setFinish} />
          </fieldset>
          <fieldset>
            <legend>Размер корпуса</legend>
            <div className="sizing">
              {([42, 46] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  aria-pressed={size === s}
                >
                  {s} мм
                </button>
              ))}
            </div>
          </fieldset>
          <button className="primary buy" onClick={() => add(finish, size)}>
            Добавить в корзину <Plus size={18} />
          </button>
          <p className="demo">Портфолио-концепт. Цена демонстрационная.</p>
          <details>
            <summary>Комплектация</summary>
            <p>
              Часы AER ONE, силиконовый ремешок выбранного цвета и магнитный
              кабель для зарядки.
            </p>
          </details>
          <details>
            <summary>Характеристики</summary>
            <dl>
              <div>
                <dt>Корпус</dt>
                <dd>Алюминий, {size} мм</dd>
              </div>
              <div>
                <dt>Дисплей</dt>
                <dd>OLED · Always-On</dd>
              </div>
              <div>
                <dt>Автономность</dt>
                <dd>До 5 дней</dd>
              </div>
            </dl>
          </details>
        </div>
      </div>
    </section>
  );
}
