import { Icon } from './Icon';
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
 * Event-info block matched to the Figma <production details>. Data-driven
 * from `model.eventInfo`.
 *  - desktop: 64px image · Body/Bold title · Small venue + date w/ info icon
 *  - mobile:  back chevron · Small/Bold title · Caption venue + date
 */
export function EventDetails({ eventInfo, variant = 'desktop', onBack }: EventDetailsProps) {
  const { eventName, venueName, venueAddress, eventDate } = eventInfo;
  const location = shortLocation(venueAddress);
  const venueLine = location ? `${venueName} in ${location}` : venueName;

  if (variant === 'mobile') {
    return (
      <div className="flex items-center gap-2 bg-white py-3 pl-2.5 pr-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex h-6 w-6 shrink-0 items-center justify-end"
        >
          <Icon name="chevron-left" size={18} glyph={18} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-small font-bold text-ink">{eventName}</p>
          <p className="truncate text-caption text-ink-secondary">{venueLine}</p>
          <p className="truncate text-caption text-ink-secondary">{eventDate}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <img
        src="/event-placeholder.svg"
        alt=""
        className="h-16 w-16 shrink-0 rounded object-cover"
        draggable={false}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-bold text-ink">{eventName}</p>
        <p className="truncate text-small text-ink-secondary">{venueLine}</p>
        <div className="flex items-center text-small text-ink-secondary">
          <span className="truncate">{eventDate}</span>
          <Icon name="info" size={18} glyph={12} />
        </div>
      </div>
    </div>
  );
}
