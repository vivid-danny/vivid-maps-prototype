import type { DisplayMode, SeatColors } from '../model/types';
import type { ThemeId } from './themes';

export type PinDensityConfig = { sections: number; rows: number; seats: number };
export type LayoutModeOverride = 'auto' | 'desktop' | 'mobile';
export type ListingCardSize = 'dense' | 'standard' | 'spacious';

export interface SeatMapConfig {
  layoutModeOverride: LayoutModeOverride;
  initialDisplay: DisplayMode;
  zoomedDisplay: DisplayMode;
  desktopInitialScale: number;
  desktopZoomThreshold: number;
  mobileInitialScale: number;
  mobileZoomThreshold: number;
  connectorWidth: number;
  sectionStrokeWidth: number;
  seatColors: SeatColors;
  pinDensity: PinDensityConfig;
  zoneRowDisplay: 'rows' | 'seats';
  theme: ThemeId;
  themeOverrides: Partial<Record<ThemeId, SeatColors>>;
  listingCardSize: ListingCardSize;
  mobileMapHeight: number;
}

