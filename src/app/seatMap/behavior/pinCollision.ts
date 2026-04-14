export interface ScreenPin {
  id: string;
  screenX: number;
  screenY: number;
  isSelected: boolean;
  isHovered: boolean;
  dealScore: number;
  price: number;
}

/** Default minimum screen-pixel distance between pin centers before they collide. */
export const DEFAULT_MIN_PIXEL_DISTANCE = 60;

/**
 * Given pins with screen-pixel positions, returns the IDs of pins that should
 * be hidden because they overlap a higher-priority pin.
 *
 * Priority (descending): selected > hovered > dealScore > lower price.
 * Selected and hovered pins are never hidden.
 */
export function computeCollisionHiddenPins(
  pins: ScreenPin[],
  minPixelDistance: number,
): Set<string> {
  if (pins.length <= 1) return new Set();

  const sorted = [...pins].sort((a, b) => {
    // Selected pins first
    if (a.isSelected !== b.isSelected) return a.isSelected ? -1 : 1;
    // Hovered pins next
    if (a.isHovered !== b.isHovered) return a.isHovered ? -1 : 1;
    // Higher deal score wins
    const scoreDiff = b.dealScore - a.dealScore;
    if (scoreDiff !== 0) return scoreDiff;
    // Lower price wins
    return a.price - b.price;
  });

  const minDistSq = minPixelDistance * minPixelDistance;
  const placed: ScreenPin[] = [];
  const hiddenIds = new Set<string>();

  for (const pin of sorted) {
    if (pin.isSelected || pin.isHovered) {
      placed.push(pin);
      continue;
    }

    let collides = false;
    for (const p of placed) {
      const dx = p.screenX - pin.screenX;
      const dy = p.screenY - pin.screenY;
      if (dx * dx + dy * dy < minDistSq) {
        collides = true;
        break;
      }
    }

    if (collides) {
      hiddenIds.add(pin.id);
    } else {
      placed.push(pin);
    }
  }

  return hiddenIds;
}
