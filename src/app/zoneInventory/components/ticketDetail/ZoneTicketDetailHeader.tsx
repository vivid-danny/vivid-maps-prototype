import { X } from 'lucide-react';
import { VenuePlan } from './VenuePlan';

interface ZoneTicketDetailHeaderProps {
  /** The listing's section, or every section of its zone when it has none. */
  highlightShapeIds: string[];
  onBack: () => void;
}

/**
 * The base prototype's 200px header band, with the venue plan where its seat
 * view would be. Same height and same floating close button.
 */
export function ZoneTicketDetailHeader({
  highlightShapeIds,
  onBack,
}: ZoneTicketDetailHeaderProps) {
  return (
    <div className="relative w-full shrink-0 bg-[#F6F6FB]">
      <VenuePlan highlightShapeIds={highlightShapeIds} className="h-[200px] w-full" />
      <button
        onClick={onBack}
        className="absolute top-3 left-3 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white cursor-pointer transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
