import { PITCH, VENUE, ZONE_COLOR } from '../../data/venue';

/**
 * A flat drawing of the stadium with some shapes lit, used where the base
 * prototype shows a seat-view photo. Zone inventory has no seat view — and for
 * a listing that names only a zone there is no single seat to photograph — so
 * the honest "view" is which part of the ground the ticket is in.
 *
 * Drawn straight from the same rings the map uses, so the two can't disagree.
 * Stadium units are already a 1200x900 space, so they are the viewBox.
 */

const DIM_FILL = '#E4E4EE';
const DIM_STROKE = '#EFEFF6';
const PITCH_FILL = '#FFFFFF';
const PITCH_LINE = '#D3D3DC';

function ringPoints(ring: Array<[number, number]>): string {
  return ring.map(([x, y]) => `${x},${y}`).join(' ');
}

interface VenuePlanProps {
  /** Shapes drawn in their zone color; everything else recedes. */
  highlightShapeIds: string[];
  className?: string;
}

export function VenuePlan({ highlightShapeIds, className }: VenuePlanProps) {
  const lit = new Set(highlightShapeIds);

  return (
    <svg
      viewBox="0 0 1200 900"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
      className={className}
    >
      <rect
        x={PITCH.x0}
        y={PITCH.y0}
        width={PITCH.x1 - PITCH.x0}
        height={PITCH.y1 - PITCH.y0}
        fill={PITCH_FILL}
        stroke={PITCH_LINE}
        strokeWidth={2}
      />
      <line
        x1={(PITCH.x0 + PITCH.x1) / 2}
        y1={PITCH.y0}
        x2={(PITCH.x0 + PITCH.x1) / 2}
        y2={PITCH.y1}
        stroke={PITCH_LINE}
        strokeWidth={2}
      />
      {VENUE.shapes.map((shape) => {
        const isLit = lit.has(shape.shapeId);
        return (
          <polygon
            key={shape.shapeId}
            points={ringPoints(shape.ring)}
            fill={isLit ? ZONE_COLOR[shape.zoneId] : DIM_FILL}
            stroke={isLit ? ZONE_COLOR[shape.zoneId] : DIM_STROKE}
            strokeWidth={2}
          />
        );
      })}
    </svg>
  );
}
