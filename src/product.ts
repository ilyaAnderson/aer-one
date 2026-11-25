export const finishes = {
  silver: "Серебро",
  graphite: "Графит",
  moss: "Мох",
} as const;
export type Finish = keyof typeof finishes;
export type Size = 42 | 46;
export type Line = { color: Finish; size: Size; quantity: number };
export const cartKey = "aer-one-demo-cart-v1";
export const money = (quantity = 1) =>
  new Intl.NumberFormat("ru-RU").format(quantity * 29990) + " ₽";
export const poster = (variant: Finish | "detail") =>
  import.meta.env.BASE_URL + "models/aer-" + variant + ".webp";

export function loadCart(): Line[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(cartKey) ?? "[]");
    if (!Array.isArray(saved)) return [];
    return saved.flatMap((item) => {
      if (
        !item ||
        typeof item.color !== "string" ||
        !Object.hasOwn(finishes, item.color)
      )
        return [];
      const size = Number(String(item.size).replace(" мм", ""));
      if (
        (size !== 42 && size !== 46) ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1
      )
        return [];
      return [
        {
          color: item.color as Finish,
          size: size as Size,
          quantity: item.quantity,
        },
      ];
    });
  } catch {
    return [];
  }
}
