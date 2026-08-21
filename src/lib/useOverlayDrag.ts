import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Makes the overlay panel movable with the mouse.
 * - In the Electron shell, the native window follows the cursor via IPC.
 * - In a normal browser tab, the panel itself is translated.
 */
export function useOverlayDrag() {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      const shell = window.overlay;
      setDragging(true);

      if (shell?.dragStart) {
        void shell.dragStart();
        return;
      }

      start.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
    },
    [offset.x, offset.y],
  );

  useEffect(() => {
    if (!dragging) return;

    const move = (event: PointerEvent) => {
      const from = start.current;
      if (!from) return;
      setOffset({
        x: from.ox + (event.clientX - from.x),
        y: from.oy + (event.clientY - from.y),
      });
    };

    const end = () => {
      setDragging(false);
      start.current = null;
      void window.overlay?.dragEnd?.();
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("blur", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("blur", end);
    };
  }, [dragging]);

  const reset = useCallback(() => setOffset({ x: 0, y: 0 }), []);

  return { offset, dragging, onPointerDown, reset };
}
