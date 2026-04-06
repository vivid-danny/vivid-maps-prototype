import type { DisplayMode, SeatColors } from '../model/types';
import type { ThemeId } from './themes';

export type PinDensityConfig = { sections: number; rows: number; seats: number };
export type ListingCardSize = 'dense' | 'standard' | 'spacious';

export interface LevelOverlays {
  muted: string;
  selected: string;
  hover: string;
  selectedOutline: string;
  hoverInSeats?: string;     // row hover override when displayMode === 'seats'
  selectedInSeats?: string;  // row selected overlay override when displayMode === 'seats'
}

export interface SeatMapConfig {
  initialDisplay: DisplayMode;
  zoomedDisplay: DisplayMode;
  connectorWidth: number;
  sectionStrokeWidth: number;
  venueStrokeWidth: number;
  seatColors: SeatColors;
  pinDensity: PinDensityConfig;
  theme: ThemeId;
  themeOverrides: Partial<Record<ThemeId, SeatColors>>;
  listingCardSize: ListingCardSize;
  rowStrokeColor: string;
  rowFillColor: string;
  overlays: {
    section: LevelOverlays;
    row: LevelOverlays;
    seat: LevelOverlays;
  };
  venueFill: string;
  venueStroke: string;
  sectionStroke: string;
  mapBackground: string;
  sectionBase: string;
}

