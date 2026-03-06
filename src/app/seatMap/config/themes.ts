import type { SeatColors } from '../model/types';
import { hashString } from '../behavior/utils';

export type ThemeId = 'branded' | 'neutral' | 'zone' | 'deal';

// Deal score color tiers
export const DEAL_SCORE_COLORS = {
  red: '#D94F4F',
  orange: '#E0873E',
  yellow: '#D4A843',
  green: '#4CAD68',
} as const;

export function getDealColor(dealScore: number): string {
  if (dealScore <= 5.0) return DEAL_SCORE_COLORS.red;
  if (dealScore <= 6.0) return DEAL_SCORE_COLORS.orange;
  if (dealScore <= 7.0) return DEAL_SCORE_COLORS.yellow;
  return DEAL_SCORE_COLORS.green;
}

// Zone palette: maps zone group names → hex colors
// Based on Vivid Seats color key: tiers 1-5 (close → far), each with primary/secondary/tertiary
export const ZONE_PALETTE: Record<string, string> = {
  // Tier 1 — closest (field behind home plate)
  'tier-1-primary': '#D95BA0',
  'tier-1-secondary': '#EB78A4',
  'tier-1-tertiary': '#F29BBC',
  // Tier 2
  'tier-2-primary': '#D9C154',
  'tier-2-secondary': '#C1DC6B',
  'tier-2-tertiary': '#E3D284',
  // Tier 3
  'tier-3-primary': '#5AADB8',
  'tier-3-secondary': '#37C7A0',
  'tier-3-tertiary': '#80DAC2',
  // Tier 4 — higher floors close
  'tier-4-primary': '#5690D6',
  'tier-4-secondary': '#55ADD4',
  'tier-4-tertiary': '#82CBF4',
  // Tier 5 — higher floors far
  'tier-5-primary': '#7082E5',
  'tier-5-secondary': '#8799FF',
  'tier-5-tertiary': '#ABB6F4',
  // Alt — outfield / edge sections
  'alt-close': '#B99872',
  'alt-mid': '#E0B87B',
  'alt-far': '#F3BA65',
};

// Deterministic fallback hue for unmapped zone names
const FALLBACK_HUES = ['#E07C4F', '#6BBF6B', '#C9A44C', '#9B6FC0', '#5BC4C4'];

export function getZoneColor(zoneName: string): string {
  if (ZONE_PALETTE[zoneName]) return ZONE_PALETTE[zoneName];
  const index = Math.abs(hashString(zoneName)) % FALLBACK_HUES.length;
  return FALLBACK_HUES[index];
}

// Shared base for zone and deal themes — available/connector are overridden at runtime
const ZONE_DEAL_COLORS: SeatColors = {
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
  sectionStroke: '#A0A2B3',
  mapBackground: '#EFEFF6',
};

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
    sectionStroke: '#A0A2B3',
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
    sectionStroke: '#A0A2B3',
    mapBackground: '#EFEFF6',
  },
  zone: ZONE_DEAL_COLORS,
  deal: ZONE_DEAL_COLORS,
};

export const THEME_LABELS: Record<ThemeId, string> = {
  branded: 'Branded',
  neutral: 'Neutral',
  zone: 'Zone',
  deal: 'Deal',
};

export const THEME_IDS = ['branded', 'neutral', 'zone', 'deal'] as const;
