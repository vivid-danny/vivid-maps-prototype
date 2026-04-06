import { useMemo } from 'react';
import type { MapConfig, DisplayMode, LayoutMode } from '../model/types';
import type { SeatMapConfig } from '../config/types';
import { ROW_ZOOM_MIN } from '../maplibre/constants';

interface UseSeatMapControllerParams {
  model: MapConfig;
  config: SeatMapConfig;
  layoutMode: LayoutMode;
  currentScale: number;
}

export interface SeatMapController {
  model: MapConfig;
  sections: MapConfig['sections'];
  displayMode: DisplayMode;
}

export function useSeatMapController({ model, config, layoutMode, currentScale }: UseSeatMapControllerParams): SeatMapController {
  // currentScale is now the MapLibre zoom level (passed via onZoomChange).
  const displayMode: DisplayMode =
    currentScale >= ROW_ZOOM_MIN ? config.zoomedDisplay : config.initialDisplay;

  // Keep model exposed from the controller so App can stay thin.
  const sections = useMemo(() => model.sections, [model.sections]);

  return {
    model,
    sections,
    displayMode,
  };
}
