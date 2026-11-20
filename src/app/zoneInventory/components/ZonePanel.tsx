import { ZONE_COLOR, ZONES } from '../data/venue';
import type { ZoneId } from '../types';

interface ZonePanelProps {
  selectedZoneIds: ZoneId[];
  onToggleZone: (zoneId: ZoneId) => void;
  /** Lights the zone up on the map while the chip is under the pointer. */
  onHoverZone: (zoneId: ZoneId | null) => void;
  className?: string;
  variant?: 'desktop' | 'mobile';
}

/** Figma <Button> w/ zone-color start icon: 32px min-height, gray/200 border, 4px radius. */
const ZONE_BUTTON =
  'flex min-h-8 items-center gap-1 rounded border px-3 py-1 text-caption font-normal transition-colors';
const ZONE_BUTTON_IDLE = 'border-line bg-white text-ink hover:bg-surface-50';
/** Active filter chips are tinted with the secondary, matching production. */
const ZONE_BUTTON_ACTIVE = 'border-[#13BDC3] bg-[#DAFAFB] text-[#1C94A5]';

function ZoneDot({ color }: { color: string }) {
  // 14px swatch centered in the 17px icon slot.
  return (
    <span aria-hidden className="relative h-5 w-[17px] shrink-0">
      <span
        className="absolute left-[1.5px] top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full"
        style={{ backgroundColor: color }}
      />
    </span>
  );
}

/**
 * Production's "Filter by Zone" card. Picking a zone selects every section in it
 * on the map and scopes the list to it; picking it again clears it. Several
 * zones can be active at once, which is why these are toggles and not a select.
 */
export function ZonePanel({
  selectedZoneIds,
  onToggleZone,
  onHoverZone,
  className,
  variant = 'desktop',
}: ZonePanelProps) {
  const isMobile = variant === 'mobile';
  const chips = ZONES.map((zone) => {
    const isActive = selectedZoneIds.includes(zone.id);
    return (
      <button
        key={zone.id}
        type="button"
        aria-pressed={isActive}
        onClick={() => onToggleZone(zone.id)}
        onMouseEnter={() => onHoverZone(zone.id)}
        onMouseLeave={() => onHoverZone(null)}
        onFocus={() => onHoverZone(zone.id)}
        onBlur={() => onHoverZone(null)}
        className={`${ZONE_BUTTON} ${isActive ? ZONE_BUTTON_ACTIVE : ZONE_BUTTON_IDLE} ${
          isMobile ? 'shrink-0' : 'w-full text-left'
        }`}
      >
        <ZoneDot color={ZONE_COLOR[zone.id]} />
        <span className={isMobile ? 'whitespace-nowrap' : 'min-w-0 flex-1 truncate'}>
          {zone.name}
        </span>
      </button>
    );
  });

  if (isMobile) {
    return (
      <div className={`no-scrollbar flex items-center gap-2 overflow-x-auto ${className ?? ''}`}>
        {chips}
      </div>
    );
  }

  return (
    <div className={`flex h-full flex-col bg-white ${className ?? ''}`}>
      <div className="flex items-center border-b border-line-thin p-4">
        <h2 className="truncate text-small font-bold text-ink">Filter by Zone</h2>
      </div>
      <div className="flex flex-col gap-2 p-4">{chips}</div>
    </div>
  );
}
