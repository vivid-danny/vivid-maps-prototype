import { ChevronLeft, Info } from 'lucide-react';
import type { EventInfo } from '../../seatMap/model/types';

interface EventDetailsProps {
  eventInfo: EventInfo;
  variant?: 'desktop' | 'mobile';
  onBack?: () => void;
}

/** Derive a short "City, ST" location from a full street address, if possible. */
function shortLocation(address: string): string | null {
  const parts = address.split(',').map((p) => p.trim());
  if (parts.length < 3) return null;
  const city = parts[1];
  const state = parts[2]?.split(' ')[0] ?? '';
  return state ? `${city}, ${state}` : city;
}

/**
 * Static event-info block (team tile + event name, venue/location, date),
 * matched to the Figma `<production details>`. Data-driven from `model.eventInfo`.
 * `desktop` renders inside the listing-panel header; `mobile` adds a back chevron.
 */
export function EventDetails({ eventInfo, variant = 'desktop', onBack }: EventDetailsProps) {
  const { eventName, venueName, venueAddress, eventDate } = eventInfo;
  const location = shortLocation(venueAddress);
  const venueLine = location ? `${venueName} in ${location}` : venueName;
  const initial = eventName.trim().charAt(0).toUpperCase() || 'V';

  const isMobile = variant === 'mobile';

  return (
    <div className={`flex items-center gap-3 bg-white ${isMobile ? 'px-4 py-3' : ''}`}>
      {isMobile && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#04092C] hover:bg-gray-50"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#0e3386]">
        <span className="text-lg font-bold text-white">{initial}</span>
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold leading-tight text-gray-900">
            {eventName}
          </span>
        </div>
        <div className="mt-0.5 truncate text-xs text-gray-500">{venueLine}</div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <span>{eventDate}</span>
          <Info className="h-3 w-3 text-gray-400" />
        </div>
      </div>
    </div>
  );
}
