import { ZOOM_THRESHOLD } from '../../components/constants';
import type { SeatMapConfig } from './types';

export const DEFAULT_SEAT_MAP_CONFIG: SeatMapConfig = {
  layoutModeOverride: 'auto',
  initialDisplay: 'sections',
  zoomedDisplay: 'seats',
  desktopInitialScale: 1.5,
  desktopZoomThreshold: ZOOM_THRESHOLD,
  mobileInitialScale: 0.5,
  mobileZoomThreshold: 3,
  connectorWidth: 1,
  zoneRowDisplay: 'seats',
  pinDensity: { sections: 0.80, rows: 0.50, seats: 0.30 },
  theme: 'branded',
  themeOverrides: {},
  seatColors: {
    available: '#CE3197',
    unavailable: '#FAEAF5',
    hover: '#7A1D59',
    pressed: '#3E0649',
    selected: '#312784',
    connector: '#CE3197',
    connectorHover: '#7A1D59',
    connectorPressed: '#312784',
    labelDefault: '#5D1A1A',
    labelSelected: '#FFFFFF',
    labelUnavailable: '#B0B0B0',
    venueFill: '#FFFFFF',
    venueStroke: '#A0A2B3',
    mapBackground: '#EFEFF6',
  },
};

