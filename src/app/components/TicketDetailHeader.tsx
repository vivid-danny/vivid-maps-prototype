import { ArrowLeft } from 'lucide-react';
import type { LayoutMode } from '../seatMap/model/types';

interface TicketDetailHeaderProps {
  seatViewUrl: string;
  sectionLabel: string;
  layoutMode: LayoutMode;
  onBack: () => void;
}

export function TicketDetailHeader({ seatViewUrl, sectionLabel, layoutMode, onBack }: TicketDetailHeaderProps) {
  const isMobile = layoutMode === 'mobile';

  return (
    <div className="relative w-full shrink-0">
      <img
        src={seatViewUrl}
        alt={`View from Section ${sectionLabel}`}
        className={`w-full object-cover ${isMobile ? 'h-[180px]' : 'h-[200px] rounded-t'}`}
      />
      <button
        onClick={onBack}
        className="absolute top-3 left-3 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white cursor-pointer transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
      </button>
    </div>
  );
}
