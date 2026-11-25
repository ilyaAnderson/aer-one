import { useEffect, useRef } from "react";
import type { MotionValue } from "motion/react";

const tileSize = 832;
const framesPerSheet = 6;
const sheetCount = 27;

export default function FlightFrames({ frame, showFrame }: {
  frame: MotionValue<number>;
  showFrame: (frame: number | null) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !context) return;
    const sheets = new Map<number, HTMLImageElement>();
    let live = true;
    let last = -1;
    let scheduled = 0;

    function requestSheet(index: number) {
      if (index < 0 || index >= sheetCount || sheets.has(index)) return;
      const image = new Image();
      image.decoding = "async";
      sheets.set(index, image);
      image.onload = () => {
        if (live && Math.floor(frame.get() / framesPerSheet) === index) schedule();
      };
      image.onerror = () => {
        if (Math.floor(frame.get() / framesPerSheet) === index) showFrame(null);
      };
      image.src = import.meta.env.BASE_URL + "inside/film-" + index + ".webp";
    }

    function paint() {
      scheduled = 0;
      const current = frame.get();
      const index = Math.floor(current / framesPerSheet);
      for (const [key, sheet] of sheets) {
        if (Math.abs(key - index) > 1) {
          sheet.onload = sheet.onerror = null;
          if (!sheet.complete) sheet.removeAttribute("src");
          sheets.delete(key);
        }
      }
      requestSheet(index);
      const sheet = sheets.get(index);
      if (sheet?.complete && sheet.naturalWidth) {
        const tile = current % framesPerSheet;
        context!.drawImage(sheet, (tile % 3) * tileSize, Math.floor(tile / 3) * tileSize,
          tileSize, tileSize, 0, 0, tileSize, tileSize);
        last = current;
        showFrame(current);
        requestSheet(index + 1);
        requestSheet(index - 1);
      } else if (Math.abs(last - current) >= framesPerSheet) {
        showFrame(null);
      }
    }
    function schedule() {
      if (!scheduled) scheduled = requestAnimationFrame(paint);
    }
    const unsubscribe = frame.on("change", schedule);
    schedule();
    return () => {
      live = false;
      unsubscribe();
      cancelAnimationFrame(scheduled);
      for (const image of sheets.values()) image.onload = image.onerror = null;
      sheets.clear();
    };
  }, [frame, showFrame]);

  return <canvas ref={ref} width={tileSize} height={tileSize} aria-hidden="true" />;
}
