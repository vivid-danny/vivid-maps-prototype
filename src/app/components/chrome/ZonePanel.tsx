interface ZonePanelProps {
  className?: string;
  variant?: 'desktop' | 'mobile';
}

/**
 * Static "Filter by Zone" legend matched to the Figma <zone filters>.
 * Non-functional — purely visual. Colors are the exact Figma zone swatches.
 */
const ZONES: { label: string; color: string }[] = [
  { label: 'Terrace Outfield', color: '#99E3FF' },
  { label: 'Home Plate', color: '#9959FF' },
  { label: 'First Base Box', color: '#D0A7F8' },
  { label: 'Mezzanine', color: '#FB8080' },
  { label: 'Third Base Box', color: '#84F8B4' },
  { label: 'Home Plate Box', color: '#8294AF' },
  { label: 'Left Field', color: '#CA2811' },
  { label: 'Infield Mezzanine', color: '#EC3E30' },
  { label: 'Bleachers', color: '#AB8197' },
  { label: 'Field Box Infield', color: '#5AAD58' },
  { label: 'Outfield', color: '#D9C154' },
];

/** Figma <Button> w/ zone-color start icon: 32px min-height, gray/200 border, 4px radius. */
const ZONE_BUTTON =
  'flex min-h-8 items-center gap-1 rounded border border-line bg-white px-3 py-1 text-caption font-normal text-ink';

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

export function ZonePanel({ className, variant = 'desktop' }: ZonePanelProps) {
  if (variant === 'mobile') {
    return (
      <div className={`no-scrollbar flex items-center gap-2 overflow-x-auto ${className ?? ''}`}>
        {ZONES.map((zone) => (
          <button key={zone.label} type="button" className={`${ZONE_BUTTON} shrink-0`}>
            <ZoneDot color={zone.color} />
            <span className="whitespace-nowrap">{zone.label}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`flex h-full flex-col bg-white ${className ?? ''}`}>
      <div className="flex items-center border-b border-line-thin p-4">
        <h2 className="truncate text-small font-bold text-ink">Filter by Zone</h2>
      </div>
      <div className="flex flex-col gap-2 p-4">
        {ZONES.map((zone) => (
          <button key={zone.label} type="button" className={`${ZONE_BUTTON} w-full text-left`}>
            <ZoneDot color={zone.color} />
            <span className="min-w-0 flex-1 truncate">{zone.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
