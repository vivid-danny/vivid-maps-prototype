import { Calendar, ChevronDown } from 'lucide-react';

interface DateSelectorProps {
  className?: string;
  date?: string;
  showsLabel?: string;
}

const BORDER = '1px solid oklch(88% 0.01 320)';

/**
 * Static date / showing selector row ("Sun, Apr 12 at 7:00PM · 1 of 3 Shows").
 * Presentational only — matches the Figma `<date selector>`.
 */
export function DateSelector({
  className,
  date = 'Sun, Apr 12 at 7:00PM',
  showsLabel = '1 of 3 Shows',
}: DateSelectorProps) {
  return (
    <div
      className={`flex h-9 items-center gap-2 rounded-md bg-white px-3 text-sm ${className ?? ''}`}
      style={{ border: BORDER }}
    >
      <Calendar className="h-4 w-4 shrink-0 text-gray-500" />
      <span className="text-gray-700">{date}</span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0" style={{ color: 'oklch(60% 0.015 320)' }} />
      <span className="ml-auto text-xs text-gray-500">{showsLabel}</span>
    </div>
  );
}
