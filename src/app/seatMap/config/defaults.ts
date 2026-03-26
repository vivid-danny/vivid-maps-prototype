import { ZOOM_THRESHOLD } from '../../components/constants';
import type { SeatMapConfig } from './types';

export const DEFAULT_SEAT_MAP_CONFIG: SeatMapConfig = {
  initialDisplay: 'sections',
  zoomedDisplay: 'seats',
  desktopInitialScale: 0.12,
  desktopZoomThreshold: ZOOM_THRESHOLD,
  mobileInitialScale: 0.5,
  mobileZoomThreshold: 3,
  connectorWidth: 3,
  sectionStrokeWidth: 16,
  venueStrokeWidth: 2,
  zoneRowDisplay: 'seats',
  pinDensity: { sections: 0.30, rows: 0.20, seats: 0.10 },
  theme: 'branded',
  themeOverrides: {},
  listingCardSize: 'standard',
  rowStrokeColor: '#E3E3E8',  // production: sectionNoInventoryFill
  rowFillColor: '#FFFFFF',    // neutral background so seat circles stand out
  mutedOverlay: 'rgba(255, 255, 255, 0.5)',   // production: STYLE_COLORS.muted
  selectedOverlay: 'rgba(4, 9, 44, 0.4)',     // production: STYLE_COLORS.selected
  selectedOutlineColor: 'rgba(0, 0, 0, 0.8)',
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
    labelDefault: '#5D1A1A',
    labelSelected: '#FFFFFF',
    labelUnavailable: '#B0B0B0',
    pinDefault: '#1a1a2e',
    pinHovered: '#310C24',
    pinPressed: '#141035',
    pinSelected: '#141035',
  },
};

