import { X } from 'lucide-react';

interface TicketDetailHeaderProps {
  seatViewUrl: string;
  sectionLabel: string;
  onBack: () => void;
}

export function TicketDetailHeader({ seatViewUrl, sectionLabel, onBack }: TicketDetailHeaderProps) {
  return (
    <div className="relative w-full shrink-0">
      <img
        src={seatViewUrl}
        alt={`View from Section ${sectionLabel}`}
        className="w-full object-cover h-[200px]"
      />
      <button
        onClick={onBack}
        className="absolute top-3 left-3 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white cursor-pointer transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
