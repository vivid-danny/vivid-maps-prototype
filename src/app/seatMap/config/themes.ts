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

// Zone palette: one color per tier. Production uses primary/secondary/tertiary
// for positional nuance (center vs edges) but for the prototype we consolidate
// to primary only — the shade variations don't aid map readability.
export const ZONE_TIER_COLORS: Record<string, string> = {
  'tier-1': '#E03488',  // inner bowl (hot pink)
  'tier-2': '#D9C154',  // (unused at this venue)
  'tier-3': '#34BFC0',  // middle ring (teal)
  'tier-4': '#5B9DD6',  // outer ring (steel blue)
  'tier-5': '#7082E5',  // (unused at this venue)
  'alt':    '#B99872',  // outfield / edge sections
};

// Deterministic fallback hue for unmapped zone names
const FALLBACK_HUES = ['#E07C4F', '#6BBF6B', '#C9A44C', '#9B6FC0', '#5BC4C4'];

export function getZoneColor(zoneName: string): string {
  // Strip -primary/-secondary/-tertiary suffix and sub-variants (e.g. alt-close → alt)
  const tier = zoneName.replace(/-(primary|secondary|tertiary|close|mid|far)$/, '');
  if (ZONE_TIER_COLORS[tier]) return ZONE_TIER_COLORS[tier];
  // Direct lookup for legacy names
  if (ZONE_TIER_COLORS[zoneName]) return ZONE_TIER_COLORS[zoneName];
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
  mapBackground: '#F6F6FB',
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
    mapBackground: '#F6F6FB',
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
