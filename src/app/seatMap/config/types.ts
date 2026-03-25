import type { DisplayMode, SeatColors } from '../model/types';
import type { ThemeId } from './themes';

export type PinDensityConfig = { sections: number; rows: number; seats: number };
export type ListingCardSize = 'dense' | 'standard' | 'spacious';

export interface SeatMapConfig {
  initialDisplay: DisplayMode;
  zoomedDisplay: DisplayMode;
  desktopInitialScale: number;
  desktopZoomThreshold: number;
  mobileInitialScale: number;
  mobileZoomThreshold: number;
  connectorWidth: number;
  sectionStrokeWidth: number;
  venueStrokeWidth: number;
  seatColors: SeatColors;
  pinDensity: PinDensityConfig;
  zoneRowDisplay: 'rows' | 'seats';
  theme: ThemeId;
  themeOverrides: Partial<Record<ThemeId, SeatColors>>;
  listingCardSize: ListingCardSize;
  rowStrokeColor: string;
}

