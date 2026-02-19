import { Calendar, MapPin } from 'lucide-react';
import type { EventInfo } from '../../seatMap/model/types';

interface TicketDetailEventInfoProps {
  eventInfo: EventInfo;
}

export function TicketDetailEventInfo({ eventInfo }: TicketDetailEventInfoProps) {
  return (
    <div className="p-6 space-y-3 border-t border-gray-100">
      <div className="flex items-start gap-3">
        <Calendar className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-gray-900">{eventInfo.eventName}</p>
          <p className="text-xs text-gray-500">{eventInfo.eventDate}</p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-gray-900">{eventInfo.venueName}</p>
          <p className="text-xs text-gray-500">{eventInfo.venueAddress}</p>
        </div>
      </div>
    </div>
  );
}
