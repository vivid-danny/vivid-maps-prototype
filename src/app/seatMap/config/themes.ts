import type { SeatColors } from '../model/types';
import { hashString } from '../behavior/utils';

export type ThemeId = 'branded' | 'zone' | 'deal';

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
  // Tier 1 — inner bowl (hot pink, matches production)
  'tier-1-primary':   '#E03488',
  'tier-1-secondary': '#EC5EA3',
  'tier-1-tertiary':  '#F388BD',
  // Tier 2 — (unused at this venue, keep yellow as fallback)
  'tier-2-primary':   '#D9C154',
  'tier-2-secondary': '#C1DC6B',
  'tier-2-tertiary':  '#E3D284',
  // Tier 3 — middle ring (teal, consistent hue)
  'tier-3-primary':   '#34BFC0',
  'tier-3-secondary': '#50CECE',
  'tier-3-tertiary':  '#78DEDE',
  // Tier 4 — outer ring (steel blue)
  'tier-4-primary':   '#5B9DD6',
  'tier-4-secondary': '#7AB5E0',
  'tier-4-tertiary':  '#9CCAF0',
  // Tier 5 — (unused at this venue, keep purple as fallback)
  'tier-5-primary':   '#7082E5',
  'tier-5-secondary': '#8799FF',
  'tier-5-tertiary':  '#ABB6F4',
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
  unavailable: '#EFEFF6',
  hover: '#7A1D59',
  pressed: '#0d0646',
  selected: '#cc3394',
  connector: '#ebe0e7',
  connectorHover: '#d7c1cf',
  connectorPressed: '#c4c3d5',
  connectorSelected: '#e4e1ef',
  labelDefault: '#04092C',
  labelSelected: '#FFFFFF',
  labelUnavailable: '#A5ADB4',
  pinDefault: '#1a1a2e',
  pinHovered: '#2A2E31',
  pinPressed: '#52143B',
  pinSelected: '#52143B',
  venueFill: '#FFFFFF',
  venueStroke: '#A0A2B3',
  sectionStroke: '#d3d3dc',
  mapBackground: '#EFEFF6',
};

export const THEMES: Record<ThemeId, SeatColors> = {
  branded: {
    available: '#CE3197',
    unavailable: '#EFEFF6',
    hover: '#7A1D59',
    pressed: '#0d0646',
    selected: '#312784',
    connector: '#ebe0e7',
    connectorHover: '#d7c1cf',
    connectorPressed: '#c4c3d5',
    connectorSelected: '#e4e1ef',
    labelDefault: '#04092C',
    labelSelected: '#FFFFFF',
    labelUnavailable: '#B0B0B0',
    pinDefault: '#1a1a2e',
    pinHovered: '#310C24',
    pinPressed: '#141035',
    pinSelected: '#141035',
    venueFill: '#FFFFFF',
    venueStroke: '#A0A2B3',
    sectionStroke: '#d3d3dc',
    mapBackground: '#EFEFF6',
  },
  zone: ZONE_DEAL_COLORS,
  deal: ZONE_DEAL_COLORS,
};

export const THEME_LABELS: Record<ThemeId, string> = {
  branded: 'Branded',
  zone: 'Zone',
  deal: 'Deal',
};

export const THEME_IDS = ['branded', 'zone', 'deal'] as const;
