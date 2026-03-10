import type { SeatColors } from '../model/types';

// Canonical interaction state type — single source of truth for the priority chain.
// Priority order (highest to lowest): unavailable > selected > pressed > hover > available
export type InteractionState = 'available' | 'unavailable' | 'hover' | 'pressed' | 'selected';

export function resolveInteractionState(params: {
  isAvailable: boolean;
  isSelected: boolean;
  isPressed: boolean;
  isHovered: boolean;
}): InteractionState {
  if (!params.isAvailable) return 'unavailable';
  if (params.isSelected) return 'selected';
  if (params.isPressed) return 'pressed';
  if (params.isHovered) return 'hover';
  return 'available';
}

// Section-specific: returns both fill color and fill-opacity for React rendering.
// Pressed state is handled via DOM mutation only — never passed here as isPressed.
export function resolveSectionFill(
  state: InteractionState,
  colors: SeatColors,
): { fill: string; fillOpacity: number } {
  switch (state) {
    case 'unavailable': return { fill: colors.unavailable, fillOpacity: 0.8 };
    case 'selected':    return { fill: colors.selected,   fillOpacity: 1.0 };
    case 'pressed':     return { fill: colors.pressed,    fillOpacity: 1.0 };
    case 'hover':       return { fill: colors.hover,      fillOpacity: 0.85 };
    case 'available':   return { fill: colors.available,  fillOpacity: 1.0 };
  }
}
