import { ChevronDown } from 'lucide-react';

interface FilterChipsProps {
  className?: string;
  /** Existing quantity filter — kept fully wired via the "Tickets" chip. */
  quantityFilter?: number;
  onQuantityFilterChange?: (qty: number) => void;
}

const CHIP_BORDER = '1px solid oklch(88% 0.01 320)';
const CHEVRON_COLOR = 'oklch(60% 0.015 320)';

/** Static, non-interactive filter chip (price / perks). Visual only. */
function StaticChip({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="flex h-9 flex-1 items-center justify-between gap-2 rounded-md bg-white px-3 text-sm text-gray-700"
      style={{ border: CHIP_BORDER }}
    >
      <span className="truncate">{label}</span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0" style={{ color: CHEVRON_COLOR }} />
    </button>
  );
}

/**
 * The price / tickets / perks filter row. Price and Perks are static styled
 * chips; the Tickets chip is the existing quantity filter, unchanged in behavior.
 */
export function FilterChips({ className, quantityFilter, onQuantityFilterChange }: FilterChipsProps) {
  return (
    <div className={`flex items-center gap-2 bg-white ${className ?? ''}`}>
      <StaticChip label="$28 – $1,350" />

      {onQuantityFilterChange ? (
        <div className="relative flex-1">
          <select
            value={quantityFilter ?? 2}
            onChange={(e) => onQuantityFilterChange(Number(e.target.value))}
            className="h-9 w-full cursor-pointer appearance-none rounded-md bg-white pl-3 pr-7 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#D63384]"
            style={{ border: CHIP_BORDER }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'Ticket' : 'Tickets'}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: CHEVRON_COLOR }}
          />
        </div>
      ) : (
        <StaticChip label="2 Tickets" />
      )}

      <StaticChip label="Perks" />
    </div>
  );
}
