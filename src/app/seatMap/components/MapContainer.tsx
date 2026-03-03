import { forwardRef, type ReactNode } from 'react';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import type { SeatMapController } from '../state/useSeatMapController';

const MAX_SCALE = 25;
const DEFAULT_WHEEL_STEP = 0.2;

interface MapContainerProps {
  controller: SeatMapController;
  isSimulatedMobile: boolean;
  mobileMapHeight: number;
  children: ReactNode;
  onScaleChange?: (scale: number) => void;
  wheelStep?: number;
  background?: string;
}

export const MapContainer = forwardRef<ReactZoomPanPinchRef, MapContainerProps>(
  function MapContainer({ controller, isSimulatedMobile, mobileMapHeight, children, onScaleChange, wheelStep = DEFAULT_WHEEL_STEP, background }, ref) {
    const width = isSimulatedMobile ? 390 : '100%';
    const height = isSimulatedMobile ? mobileMapHeight : '100%';
    const initialScale = controller.initialScale;
    const minScale = controller.minScale;

    return (
      <div
        className="border-1 border-gray-200"
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height,
          backgroundColor: background ?? '#EFEFF6',
        }}
      >
        <TransformWrapper
          ref={ref}
          initialScale={initialScale}
          minScale={minScale}
          maxScale={MAX_SCALE}
          centerOnInit
          limitToBounds={false}
          onTransformed={(_, state) => onScaleChange?.(state.scale)}
          wheel={{ step: wheelStep }}
        >
          <TransformComponent
            wrapperStyle={{
              width: '100%',
              height: '100%',
            }}
          >
            <div style={{ padding: '300px' }}>
              {children}
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>
    );
  }
);
