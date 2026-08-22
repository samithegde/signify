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

/**
 * Makes the overlay panel resizable from its bottom-right corner.
 * - In the Electron shell, the native window is resized via IPC.
 * - In a normal browser tab, the panel's own box is resized.
 */
export function useOverlayResize() {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [resizing, setResizing] = useState(false);
  const start = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    setResizing(true);

    const shell = window.overlay;
    if (shell?.resizeStart) {
      void shell.resizeStart();
      return;
    }

    const panel = (event.currentTarget as HTMLElement).closest("section");
    const rect = panel?.getBoundingClientRect();
    start.current = {
      x: event.clientX,
      y: event.clientY,
      w: rect?.width ?? 520,
      h: rect?.height ?? 240,
    };
  }, []);

  useEffect(() => {
    if (!resizing) return;

    const move = (event: PointerEvent) => {
      const from = start.current;
      if (!from) return;
      setSize({
        w: Math.max(360, from.w + (event.clientX - from.x)),
        h: Math.max(180, from.h + (event.clientY - from.y)),
      });
    };

    const end = () => {
      setResizing(false);
      start.current = null;
      void window.overlay?.resizeEnd?.();
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
  }, [resizing]);

  return { size, resizing, onPointerDown };
}
