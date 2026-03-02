import type { DisplayMode, SeatColors } from '../model/types';

export type PinDensityConfig = { sections: number; rows: number; seats: number };
export type LayoutModeOverride = 'auto' | 'desktop' | 'mobile';

export interface SeatMapConfig {
  layoutModeOverride: LayoutModeOverride;
  initialDisplay: DisplayMode;
  zoomedDisplay: DisplayMode;
  desktopInitialScale: number;
  desktopZoomThreshold: number;
  mobileInitialScale: number;
  mobileZoomThreshold: number;
  connectorWidth: number;
  seatColors: SeatColors;
  pinDensity: PinDensityConfig;
  zoneRowDisplay: 'rows' | 'seats';
}

