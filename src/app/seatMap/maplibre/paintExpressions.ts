import type { ExpressionSpecification } from 'maplibre-gl';
import type { SeatColors } from '../model/types';
import type { ThemeId } from '../config/themes';
import { getZoneColor, getDealColor } from '../config/themes';
import type { SeatMapModel } from '../model/types';

function unavailablePropertyExpression(): ExpressionSpecification {
  return ['boolean', ['get', 'unavailable'], false];
}

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
  hoverColor: ExpressionSpecification | string,
): ExpressionSpecification {
  return [
    'case',
    ['boolean', ['feature-state', 'hovered'], false], hoverColor,
    ['boolean', ['feature-state', 'unavailable'], false], seatColors.unavailable,
    baseColor,
  ];
}

function featurePropertyExpression(
  seatColors: SeatColors,
  baseColor: ExpressionSpecification | string,
  hoverColor: ExpressionSpecification | string,
): ExpressionSpecification {
  return [
    'case',
    ['boolean', ['feature-state', 'hovered'], false], hoverColor,
    unavailablePropertyExpression(), seatColors.unavailable,
    baseColor,
  ];
}

function buildSectionBaseColorExpression(
  theme: ThemeId,
  model: SeatMapModel,
  fallbackColor: string,
): ExpressionSpecification | string {
  let baseColor: ExpressionSpecification | string = fallbackColor;

  if (theme === 'zone' || theme === 'deal') {
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
          color = fallbackColor;
        }
      } else {
        color = fallbackColor;
      }
      matchArgs.push(section.sectionId, color);
    }
    matchArgs.push(fallbackColor);

    baseColor = ['match', ...matchArgs] as ExpressionSpecification;
  }

  return baseColor;
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
  const baseColor = buildSectionBaseColorExpression(theme, model, seatColors.available);

  // For zone/deal: no fill change on hover — overlay layer handles it; zone color stays visible.
  // For branded: fill switches to seatColors.hover.
  const hoverColor = (theme === 'zone' || theme === 'deal') ? baseColor : seatColors.hover;
  return featureStateExpression(seatColors, baseColor, hoverColor);
}

export function buildDetailFillExpression(
  theme: ThemeId,
  model: SeatMapModel,
  seatColors: SeatColors,
): ExpressionSpecification {
  const baseColor = buildSectionBaseColorExpression(theme, model, seatColors.available);
  const hoverColor = (theme === 'zone' || theme === 'deal') ? baseColor : seatColors.hover;
  return featurePropertyExpression(seatColors, baseColor, hoverColor);
}

/**
 * Builds a line-color expression for the seat connector layer.
 * For zone/deal: per-section match expression as base, with feature-state overrides
 * for selected/hovered/unavailable.
 * For branded: uses seatColors.connector as base.
 */
export function buildConnectorColorExpression(
  theme: ThemeId,
  model: SeatMapModel,
  seatColors: SeatColors,
): ExpressionSpecification {
  if (theme === 'zone' || theme === 'deal') {
    // For zone/deal: the connector color is the section's zone/deal color across all states.
    // The connector sits below seat circles, so overlay layers on the circles handle the
    // hover/selected visual treatment — the connector just needs to stay the right hue.
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
          color = seatColors.connector;
        }
      } else {
        color = seatColors.connector;
      }
      matchArgs.push(section.sectionId, color);
    }
    matchArgs.push(seatColors.connector); // fallback

    const sectionColor = ['match', ...matchArgs] as ExpressionSpecification;

    return [
      'case',
      ['boolean', ['feature-state', 'unavailable'], false], 'rgba(4,9,44,0)',
      sectionColor,
    ];
  }

  // Branded: use distinct connector state colors
  return [
    'case',
    ['boolean', ['feature-state', 'selected'], false], seatColors.connectorSelected,
    ['boolean', ['feature-state', 'hovered'], false], seatColors.connectorHover,
    ['boolean', ['feature-state', 'unavailable'], false], 'rgba(4,9,44,0)',
    seatColors.connector,
  ];
}
