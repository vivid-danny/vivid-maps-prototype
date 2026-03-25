import type { ExpressionSpecification } from 'maplibre-gl';
import type { SeatColors } from '../model/types';
import type { ThemeId } from '../config/themes';
import { getZoneColor, getDealColor } from '../config/themes';
import type { SeatMapModel } from '../model/types';

/**
 * Base feature-state expression for a single layer.
 * hovered > unavailable > baseColor
 *
 * Selection is handled by dedicated overlay layers (section-selected-overlay,
 * row-selected-overlay) matching the production pattern, not by feature-state
 * on the base fill layer.
 */
function featureStateExpression(
  seatColors: SeatColors,
  baseColor: ExpressionSpecification | string,
): ExpressionSpecification {
  return [
    'case',
    ['boolean', ['feature-state', 'hovered'], false], seatColors.hover,
    ['boolean', ['feature-state', 'unavailable'], false], seatColors.unavailable,
    baseColor,
  ];
}

/**
 * Builds a fill-color expression for the section layer.
 * For zone/deal themes: inserts a per-section match expression as the base color.
 * For branded: uses seatColors.available as base.
 */
export function buildSectionFillExpression(
  theme: ThemeId,
  model: SeatMapModel,
  seatColors: SeatColors,
): ExpressionSpecification {
  let baseColor: ExpressionSpecification | string = seatColors.available;

  if (theme === 'zone' || theme === 'deal') {
    // Build ['match', ['get', 'sectionId'], id1, color1, id2, color2, ..., fallback]
    const matchArgs: (ExpressionSpecification | string)[] = [['get', 'sectionId']];

    for (const section of model.sections) {
      let color: string;
      if (theme === 'zone' && section.zone) {
        color = getZoneColor(section.zone);
      } else if (theme === 'deal') {
        const listings = model.listingsBySection.get(section.sectionId);
        if (listings && listings.length > 0) {
          const cheapest = listings.reduce((a, b) => (a.price <= b.price ? a : b));
          color = getDealColor(cheapest.dealScore);
        } else {
          color = seatColors.available;
        }
      } else {
        color = seatColors.available;
      }
      matchArgs.push(section.sectionId, color);
    }
    matchArgs.push(seatColors.available); // fallback

    baseColor = ['match', ...matchArgs] as ExpressionSpecification;
  }

  return featureStateExpression(seatColors, baseColor);
}

/**
 * Standard fill-color for rows and seats (no per-section theming at these levels).
 */
export function buildDefaultFillExpression(seatColors: SeatColors): ExpressionSpecification {
  return featureStateExpression(seatColors, seatColors.available);
}
