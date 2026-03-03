import type { SeatColors } from '../model/types';

export type ThemeId = 'branded' | 'neutral' | 'zone';

export const THEMES: Record<ThemeId, SeatColors> = {
  branded: {
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
  neutral: {
    available: '#5B6166',
    unavailable: '#F0F1F2',
    hover: '#6A737B',
    pressed: '#3F464C',
    selected: '#cc3394',
    connector: '#8F969C',
    connectorHover: '#A2AAB1',
    connectorPressed: '#6C757D',
    labelDefault: '#F7F8F9',
    labelSelected: '#FFFFFF',
    labelUnavailable: '#A5ADB4',
    venueFill: '#FFFFFF',
    venueStroke: '#A0A2B3',
    mapBackground: '#EFEFF6',
  },
  zone: {
    // Placeholder — reuses branded until follow-up session
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

export const THEME_LABELS: Record<ThemeId, string> = {
  branded: 'Branded',
  neutral: 'Neutral',
  zone: 'Zone',
};

export const THEME_IDS = ['branded', 'neutral', 'zone'] as const;
