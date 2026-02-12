import { forwardRef, type ReactNode } from 'react';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import type { MapConfig } from '../model/types';
import type { SeatMapConfig } from '../config/types';
import type { SeatMapController } from '../state/useSeatMapController';

const MAX_SCALE = 25;
const DEFAULT_WHEEL_STEP = 0.2;

interface MapContainerProps {
  model: MapConfig;
  controller: SeatMapController;
  config: SeatMapConfig;
  children: ReactNode;
  onScaleChange?: (scale: number) => void;
  wheelStep?: number;
}

export const MapContainer = forwardRef<ReactZoomPanPinchRef, MapContainerProps>(
  function MapContainer({ model, controller, config, children, onScaleChange, wheelStep = DEFAULT_WHEEL_STEP }, ref) {
    void model;
    const width = config.layoutMode === 'mobile' ? 390 : '100%';
    const height = config.layoutMode === 'mobile' ? 200 : '100%';
    const initialScale = controller.initialScale;
    const minScale = controller.minScale;

    return (
      <div
        className="border-1 border-gray-200 bg-[#EFEFF6]"
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height,
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
