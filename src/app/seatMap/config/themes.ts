import type { SeatColors } from '../model/types';
import { hashString } from '../behavior/utils';

export type ThemeId = 'branded' | 'neutral' | 'zone';

// Zone palette: maps zone group names → hex colors
export const ZONE_PALETTE: Record<string, string> = {
  'lower': '#D95BA0',
  'lower-edge': '#EB78A4',
  'upper': '#5690D6',
  'upper-edge': '#55ADD4',
};

// Deterministic fallback hue for unmapped zone names
const FALLBACK_HUES = ['#E07C4F', '#6BBF6B', '#C9A44C', '#9B6FC0', '#5BC4C4'];

export function getZoneColor(zoneName: string): string {
  if (ZONE_PALETTE[zoneName]) return ZONE_PALETTE[zoneName];
  const index = Math.abs(hashString(zoneName)) % FALLBACK_HUES.length;
  return FALLBACK_HUES[index];
}

export const THEMES: Record<ThemeId, SeatColors> = {
  branded: {
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
    connectorSelected: '#6C757D',
    labelDefault: '#F7F8F9',
    labelSelected: '#FFFFFF',
    labelUnavailable: '#A5ADB4',
    pinDefault: '#1a1a2e',
    pinHovered: '#2A2E31',
    pinPressed: '#52143B',
    pinSelected: '#52143B',
    venueFill: '#FFFFFF',
    venueStroke: '#A0A2B3',
    mapBackground: '#EFEFF6',
  },
  zone: {
    // Base "available" is overridden per-section via zone palette
    available: '#8B8FA3',
    unavailable: '#f5f0f3',
    hover: '#7A1D59',
    pressed: '#0d0646',
    selected: '#cc3394',
    connector: '#ebe0e7',
    connectorHover: '#d7c1cf',
    connectorPressed: '#c4c3d5',
    connectorSelected: '#e4e1ef',
    labelDefault: '#F7F8F9',
    labelSelected: '#FFFFFF',
    labelUnavailable: '#A5ADB4',
    pinDefault: '#1a1a2e',
    pinHovered: '#2A2E31',
    pinPressed: '#52143B',
    pinSelected: '#52143B',
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
