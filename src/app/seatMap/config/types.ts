import type { DisplayMode, LayoutMode, SeatColors } from '../model/types';

export type PinDensityConfig = { sections: number; rows: number; seats: number };

export interface SeatMapConfig {
  layoutMode: LayoutMode;
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

