import { forwardRef, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import type { SeatMapController } from '../state/useSeatMapController';

const MAX_SCALE = 25;
const DEFAULT_WHEEL_STEP = 0.2;
const GESTURE_IDLE_MS = 150;

export const CONTENT_PADDING = 300;

export interface TransformState {
  positionX: number;
  positionY: number;
  scale: number;
}

interface MapContainerProps {
  controller: SeatMapController;
  isSimulatedMobile: boolean;
  mobileMapHeight: number;
  children: ReactNode;
  onScaleChange?: (scale: number) => void;
  onAnimationSettle?: () => void;
  onTransformChange?: (state: TransformState) => void;
  wheelStep?: number;
  background?: string;
}

export const MapContainer = forwardRef<ReactZoomPanPinchRef, MapContainerProps>(
  function MapContainer({ controller, isSimulatedMobile, mobileMapHeight, children, onScaleChange, onAnimationSettle, onTransformChange, wheelStep = DEFAULT_WHEEL_STEP, background }, ref) {
    const width = isSimulatedMobile ? 390 : '100%';
    const height = isSimulatedMobile ? mobileMapHeight : '100%';
    const initialScale = controller.initialScale;
    const minScale = controller.minScale;
    const [mounted, setMounted] = useState(false);
    const outerDivRef = useRef<HTMLDivElement>(null);
    const contentDivRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number>(0);
    const gestureTimerRef = useRef<ReturnType<typeof setTimeout>>(0 as unknown as ReturnType<typeof setTimeout>);
    const lastScaleRef = useRef<number>(initialScale);

    useEffect(() => {
      setMounted(true);
      return () => {
        cancelAnimationFrame(rafRef.current);
        clearTimeout(gestureTimerRef.current);
      };
    }, []);

    const handleTransformed = useCallback((_: unknown, state: { scale: number; positionX: number; positionY: number }) => {
      // Update CSS var directly — no React state, so pins maintain screen size without re-rendering
      outerDivRef.current?.style.setProperty('--map-scale', String(state.scale));

      // Disable pointer-events & transitions during active gestures (avoids 18K+ hit-tests per frame)
      if (contentDivRef.current) {
        contentDivRef.current.style.pointerEvents = 'none';
      }
      outerDivRef.current?.classList.add('zooming');
      clearTimeout(gestureTimerRef.current);
      gestureTimerRef.current = setTimeout(() => {
        if (contentDivRef.current) {
          contentDivRef.current.style.pointerEvents = 'auto';
        }
        outerDivRef.current?.classList.remove('zooming');
        onAnimationSettle?.();
      }, GESTURE_IDLE_MS);

      if (state.scale !== lastScaleRef.current) {
        lastScaleRef.current = state.scale;
        onScaleChange?.(state.scale);
      }
      if (onTransformChange) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          onTransformChange(state);
        });
      }
    }, [onScaleChange, onAnimationSettle, onTransformChange]);

    return (
      <div
        ref={outerDivRef}
        className="border-1 border-gray-200"
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height,
          backgroundColor: background ?? '#EFEFF6',
          opacity: mounted ? 1 : 0,
          transition: 'opacity 400ms ease',
        }}
      >
        <TransformWrapper
          ref={ref}
          initialScale={initialScale}
          minScale={minScale}
          maxScale={MAX_SCALE}
          centerOnInit
          limitToBounds={false}
          onTransformed={handleTransformed}
          wheel={{ step: wheelStep }}
        >
          <TransformComponent
            wrapperStyle={{
              width: '100%',
              height: '100%',
            }}
            contentStyle={{}}
          >
            <div ref={contentDivRef} style={{ padding: `${CONTENT_PADDING}px` }}>
              {children}
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>
    );
  }
);
