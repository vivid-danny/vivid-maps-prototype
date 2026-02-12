import { ZOOM_THRESHOLD } from '../../components/constants';
import type { SeatMapConfig } from './types';

export const DEFAULT_SEAT_MAP_CONFIG: SeatMapConfig = {
  layoutMode: 'desktop',
  initialDisplay: 'sections',
  zoomedDisplay: 'seats',
  desktopInitialScale: 1.5,
  desktopZoomThreshold: ZOOM_THRESHOLD,
  mobileInitialScale: 0.5,
  mobileZoomThreshold: 3,
  connectorWidth: 1,
  seatColors: {
    available: '#CE3197',
    unavailable: '#FAEAF5',
    hover: '#7A1D59',
    pressed: '#3E0649',
    selected: '#312784',
    connector: '#CE3197',
    labelDefault: '#5D1A1A',
    labelSelected: '#FFFFFF',
    labelUnavailable: '#B0B0B0',
  },
};

