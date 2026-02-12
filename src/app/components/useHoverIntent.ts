import { useRef, useEffect, useCallback } from 'react';

const HOVER_DELAY_MS = 100;

/**
 * Delays cross-component hover callbacks by HOVER_DELAY_MS while allowing
 * immediate local visual feedback. Cancels pending callbacks on leave/unmount.
 */
export function useHoverIntent<T>(
  onHoverChange: ((value: T) => void) | undefined,
  clearValue: T
): { enter: (value: T) => void; leave: () => void } {
  const timeoutRef = useRef<number | null>(null);
  const hasFiredRef = useRef(false);
  const callbackRef = useRef(onHoverChange);

  // Keep callback ref fresh without invalidating enter/leave
  callbackRef.current = onHoverChange;

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const enter = useCallback((value: T) => {
    if (!callbackRef.current) return;
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    hasFiredRef.current = false;
    timeoutRef.current = window.setTimeout(() => {
      hasFiredRef.current = true;
      timeoutRef.current = null;
      callbackRef.current?.(value);
    }, HOVER_DELAY_MS);
  }, []);

  const leave = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (hasFiredRef.current) {
      callbackRef.current?.(clearValue);
      hasFiredRef.current = false;
    }
  }, [clearValue]);

  return { enter, leave };
}
