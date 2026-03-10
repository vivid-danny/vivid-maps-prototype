import { useRef, useCallback } from 'react';

interface UseTapHandlerOptions {
  tapDistanceThreshold?: number;
}

interface TapHandlerCallbacks<T> {
  onTap?: (context: T, e: React.PointerEvent) => void;
  onPressStart?: (context: T, e: React.PointerEvent) => void;
  onPressEnd?: () => void;
  onHoverEnter?: (context: T, e: React.PointerEvent) => void;
  onHoverLeave?: (e: React.PointerEvent) => void;
}

interface TapHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
  onPointerCancel: () => void;
  onPointerEnter: (e: React.PointerEvent) => void;
}

// Encapsulates pointer-event-based tap detection.
// - onTap fires when pointerUp is within tapDistanceThreshold of pointerDown
// - onPressStart/onPressEnd fire unconditionally for visual pressed state
// - onHoverEnter/onHoverLeave only fire for mouse (pointerType === 'mouse'), no-op on touch
// - onPressEnd and hover leave are called automatically on pointerLeave/pointerCancel
export function useTapHandler<T>(
  callbacks: TapHandlerCallbacks<T>,
  options: UseTapHandlerOptions = {}
): { getHandlers: (context: T) => TapHandlers } {
  const { tapDistanceThreshold = 10 } = options;
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  // Use ref so callbacks can be updated without recreating getHandlers
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const getHandlers = useCallback((context: T): TapHandlers => ({
    onPointerDown: (e: React.PointerEvent) => {
      pointerDownPos.current = { x: e.clientX, y: e.clientY };
      callbacksRef.current.onPressStart?.(context, e);
    },
    onPointerUp: (e: React.PointerEvent) => {
      callbacksRef.current.onPressEnd?.();
      if (pointerDownPos.current) {
        const dx = e.clientX - pointerDownPos.current.x;
        const dy = e.clientY - pointerDownPos.current.y;
        if (Math.sqrt(dx * dx + dy * dy) < tapDistanceThreshold) {
          callbacksRef.current.onTap?.(context, e);
        }
      }
      pointerDownPos.current = null;
    },
    onPointerLeave: (e: React.PointerEvent) => {
      // Clear pressed state when pointer leaves element (covers finger drag-away on touch)
      callbacksRef.current.onPressEnd?.();
      pointerDownPos.current = null;
      if (e.pointerType === 'mouse') {
        callbacksRef.current.onHoverLeave?.(e);
      }
    },
    onPointerCancel: () => {
      // Browser took over gesture (e.g. scroll) — clear pressed state
      callbacksRef.current.onPressEnd?.();
      pointerDownPos.current = null;
    },
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse') {
        callbacksRef.current.onHoverEnter?.(context, e);
      }
    },
  }), [tapDistanceThreshold]);

  return { getHandlers };
}
