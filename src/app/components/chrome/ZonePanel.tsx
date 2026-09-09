interface ZonePanelProps {
  className?: string;
  variant?: 'desktop' | 'mobile';
}

/**
 * Static "Filter by Zone" legend. Non-functional — purely a visual match for
 * the Figma zone panel. Colors are drawn from the app's zone palette
 * (`ZONE_TIER_COLORS` / fallback hues in `seatMap/config/themes.ts`) so the
 * legend reads consistently with the branded map styling.
 */
const ZONES: { label: string; color: string }[] = [
  { label: 'Terrace Outfield', color: '#5BC4C4' },
  { label: 'Home Plate', color: '#9B6FC0' },
  { label: 'First Base Box', color: '#D45196' },
  { label: 'Mezzanine', color: '#E07C4F' },
  { label: 'Third Base Box', color: '#6BBF6B' },
  { label: 'Home Plate Box', color: '#4C85D0' },
  { label: 'Left Field', color: '#C9A44C' },
  { label: 'Infield Mezzanine', color: '#B99872' },
  { label: 'Bleachers', color: '#30C096' },
  { label: 'Field Box Infield', color: '#E0658F' },
  { label: 'Outfield', color: '#8FB4D6' },
];

export function ZonePanel({ className, variant = 'desktop' }: ZonePanelProps) {
  if (variant === 'mobile') {
    return (
      <div className={`no-scrollbar flex gap-2 overflow-x-auto bg-white ${className ?? ''}`}>
        {ZONES.map((zone) => (
          <span
            key={zone.label}
            className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-gray-700"
            style={{ border: '1px solid oklch(88% 0.01 320)' }}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: zone.color }}
            />
            {zone.label}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className={`flex h-full flex-col bg-white ${className ?? ''}`}>
      <div className="px-4 pb-3 pt-4">
        <h2 className="text-base font-semibold text-gray-900">Filter by Zone</h2>
      </div>
      <div className="flex flex-col gap-1 px-2 pb-4">
        {ZONES.map((zone) => (
          <button
            key={zone.label}
            type="button"
            className="flex items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            <span
              className="h-3.5 w-3.5 shrink-0 rounded-full"
              style={{ backgroundColor: zone.color }}
            />
            <span className="truncate">{zone.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
