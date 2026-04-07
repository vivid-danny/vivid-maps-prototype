import type { SeatMapConfig, LevelOverlays } from './types';

const SHARED_OVERLAYS: LevelOverlays = {
  muted: 'rgba(255, 255, 255, 0.65)',
  selected: 'rgba(4, 9, 44, 0.50)',
  hover: 'rgba(4, 9, 44, 0.25)',
  selectedOutline: 'rgba(4, 9, 44, 0)',
};

export function createDefaultSeatMapConfig(): SeatMapConfig {
  return {
    initialDisplay: 'sections',
    zoomedDisplay: 'seats',
    connectorWidth: 3,
    sectionStrokeWidth: 16,
    venueStrokeWidth: 2,
    pinDensity: { sections: 0.15, rows: 0.20, seats: 0.10 },
    theme: 'zone',
    themeOverrides: {},
    listingCardSize: 'standard',
    rowStrokeColor: '#d5d5dd',  // production: sectionNoInventoryFill
    rowFillColor: '#FFFFFF',    // neutral background so seat circles stand out
    overlays: {
      section: {
        muted: 'rgba(255, 255, 255, 0.65)',
        selected: 'rgba(4, 9, 44, 0.1)',
        hover: 'rgba(4, 9, 44, 0.5)',
        selectedOutline: 'rgba(4, 9, 44, 0.75)',
      },
      row: {
        muted: 'rgba(255, 255, 255, 0.65)',
        selected: 'rgba(4, 9, 44, 0.1)',
        hover: 'rgba(4, 9, 44, 0.5)',
        selectedOutline: 'rgba(4, 9, 44, 0.2)',
        hoverInSeats: 'rgba(4, 9, 44, 0.025)',
        selectedInSeats: 'rgba(4, 9, 44, 0.05)',
      },
      seat: { ...SHARED_OVERLAYS },
    },
    venueFill: '#FFFFFF',         // production: onPrimary
    venueStroke: '#A0A2B3',       // production: onSurfaceDisabled
    sectionStroke: '#d3d3dc',     // production: sectionStrokeColor
    mapBackground: '#F6F6FB',     // production: neutral[50]
    sectionBase: '#EFEFF6',       // production: neutral[100]
    seatColors: {
      available: '#CE3197',
      unavailable: '#f5f0f3',
      hover: '#7A1D59',
      pressed: '#0d0646',
      selected: '#312784',
      connector: '#ebe0e7',
      connectorHover: '#d7c1cf',
      connectorPressed: '#c4c3d5',
      connectorSelected: '#e4e1ef',
      labelDefault: 'rgba(4, 9, 44, 0.64)',
      labelSelected: '#FFFFFF',
      labelUnavailable: '#B0B0B0',
      pinDefault: '#1a1a2e',
      pinHovered: '#310C24',
      pinPressed: '#141035',
      pinSelected: '#141035',
    },
  };
}

export const DEFAULT_SEAT_MAP_CONFIG: SeatMapConfig = createDefaultSeatMapConfig();
