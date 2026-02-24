import type { DisplayMode, SeatColors } from '../model/types';

export type PinDensityConfig = { sections: number; rows: number; seats: number };

export interface SeatMapConfig {
  layoutModeOverride: 'auto' | 'desktop' | 'mobile';
  initialDisplay: DisplayMode;
  zoomedDisplay: DisplayMode;
  desktopInitialScale: number;
  desktopZoomThreshold: number;
  mobileInitialScale: number;
  mobileZoomThreshold: number;
  connectorWidth: number;
  seatColors: SeatColors;
  pinDensity: PinDensityConfig;
}

