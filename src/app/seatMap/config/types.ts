import type { DisplayMode, LayoutMode, SeatColors } from '../model/types';

export type PinDensity = number;

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
  pinDensity: PinDensity;
}

