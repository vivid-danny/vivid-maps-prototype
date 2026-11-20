import { SelectChevron } from '../../components/chrome/Icon';
import type { Filters } from '../types';

const CHIP =
  'relative flex min-h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded border border-line bg-white px-3 py-1 text-small text-ink has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-[#D63384]';

export const PRICE_RANGES: Array<{ label: string; min: number; max: number }> = [
  { label: 'Any price', min: 0, max: Number.MAX_SAFE_INTEGER },
  { label: '$167 – $400', min: 16_700, max: 40_000 },
  { label: '$400 – $900', min: 40_000, max: 90_000 },
  { label: '$900+', min: 90_000, max: Number.MAX_SAFE_INTEGER },
];

interface ZoneFiltersProps {
  filters: Filters;
  priceRangeIndex: number;
  onQuantityChange: (quantity: number) => void;
  onPriceRangeChange: (index: number) => void;
  variant?: 'desktop' | 'mobile';
}

/** Quantity and price range. Both apply to Tier 1 and Tier 2 alike. */
export function ZoneFilters({
  filters,
  priceRangeIndex,
  onQuantityChange,
  onPriceRangeChange,
  variant = 'desktop',
}: ZoneFiltersProps) {
  return (
    <div
      className={`flex h-8 items-center gap-2 ${
        variant === 'mobile' ? 'no-scrollbar overflow-x-auto' : ''
      }`}
    >
      <div className={CHIP}>
        <span className="truncate">{PRICE_RANGES[priceRangeIndex]!.label}</span>
        <SelectChevron />
        <select
          aria-label="Price range"
          value={priceRangeIndex}
          onChange={(event) => onPriceRangeChange(Number(event.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        >
          {PRICE_RANGES.map((range, index) => (
            <option key={range.label} value={index}>
              {range.label}
            </option>
          ))}
        </select>
      </div>

      <div className={CHIP}>
        <span className="truncate">
          {filters.quantity} {filters.quantity === 1 ? 'Ticket' : 'Tickets'}
        </span>
        <SelectChevron />
        <select
          aria-label="Ticket quantity"
          value={filters.quantity}
          onChange={(event) => onQuantityChange(Number(event.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        >
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? 'Ticket' : 'Tickets'}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
