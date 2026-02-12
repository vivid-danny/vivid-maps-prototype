import { useMemo } from 'react';
import type { MapConfig, DisplayMode } from '../model/types';
import type { SeatMapConfig } from '../config/types';

interface UseSeatMapControllerParams {
  model: MapConfig;
  config: SeatMapConfig;
  currentScale: number;
}

export interface SeatMapController {
  model: MapConfig;
  sections: MapConfig['sections'];
  zoomThreshold: number;
  initialScale: number;
  minScale: number;
  displayMode: DisplayMode;
}

export function useSeatMapController({ model, config, currentScale }: UseSeatMapControllerParams): SeatMapController {
  const zoomThreshold =
    config.layoutMode === 'mobile' ? config.mobileZoomThreshold : config.desktopZoomThreshold;

  const initialScale =
    config.layoutMode === 'mobile' ? config.mobileInitialScale : config.desktopInitialScale;

  const minScale = config.layoutMode === 'mobile' ? config.mobileInitialScale : 1;

  const displayMode: DisplayMode =
    currentScale >= zoomThreshold ? config.zoomedDisplay : config.initialDisplay;

  // Keep model exposed from the controller so App can stay thin.
  const sections = useMemo(() => model.sections, [model.sections]);

  return {
    model,
    sections,
    zoomThreshold,
    initialScale,
    minScale,
    displayMode,
  };
}
