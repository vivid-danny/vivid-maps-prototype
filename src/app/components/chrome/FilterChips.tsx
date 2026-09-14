import { Icon, SelectChevron } from './Icon';

interface FilterChipsProps {
  className?: string;
  variant?: 'desktop' | 'mobile';
  /** Existing quantity filter — kept fully wired via the "Tickets" chip. */
  quantityFilter?: number;
  onQuantityFilterChange?: (qty: number) => void;
}

/** Figma <Select>: 32px min-height, gray/200 border, 4px radius, centered label + chevron. */
const SELECT_CHIP =
  'flex min-h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded border border-line bg-white px-3 py-1 text-small font-normal text-ink';

/** Static, non-interactive select chip (price / perks). Visual only. */
function StaticChip({ label }: { label: string }) {
  return (
    <button type="button" className={SELECT_CHIP}>
      <span className="truncate">{label}</span>
      <SelectChevron />
    </button>
  );
}

/**
 * The main filter row. Price and Perks are static chips; the Tickets chip is
 * the existing quantity filter — the native <select> is laid transparently over
 * the styled chip so behavior is unchanged while visuals match Figma exactly.
 */
export function FilterChips({
  className,
  variant = 'desktop',
  quantityFilter,
  onQuantityFilterChange,
}: FilterChipsProps) {
  const qty = quantityFilter ?? 2;
  const isMobile = variant === 'mobile';

  return (
    <div className={`flex h-8 items-center gap-2 ${className ?? ''}`}>
      {isMobile && (
        <button
          type="button"
          aria-label="Filters"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-line bg-white"
        >
          <Icon name="filter" />
        </button>
      )}

      <StaticChip label="$28 - $1,350" />

      {onQuantityFilterChange ? (
        <div
          className={`relative ${SELECT_CHIP} has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-[#D63384]`}
        >
          <span className="truncate">
            {qty} {qty === 1 ? 'Ticket' : 'Tickets'}
          </span>
          <SelectChevron />
          <select
            aria-label="Ticket quantity"
            value={qty}
            onChange={(e) => onQuantityFilterChange(Number(e.target.value))}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'Ticket' : 'Tickets'}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <StaticChip label="2 Tickets" />
      )}

      {!isMobile && <StaticChip label="Perks" />}
    </div>
  );
}
