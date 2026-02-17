import type { Listing, EventInfo, LayoutMode } from '../../seatMap/model/types';
import { TicketDetailHeader } from './TicketDetailHeader';
import { TicketDetailInfo } from './TicketDetailInfo';
import { TicketDetailCheckout } from './TicketDetailCheckout';
import { TicketDetailEventInfo } from './TicketDetailEventInfo';
import { TicketDetailDelivery } from './TicketDetailDelivery';
import { TicketDetailPerks } from './TicketDetailPerks';

interface TicketDetailProps {
  listing: Listing;
  eventInfo: EventInfo;
  layoutMode: LayoutMode;
  onBack: () => void;
  className?: string;
}

export function TicketDetail({ listing, eventInfo, layoutMode, onBack, className = '' }: TicketDetailProps) {
  const isMobile = layoutMode === 'mobile';

  return (
    <div className={`flex flex-col min-h-0 ${!isMobile ? 'bg-white' : ''} ${className}`}>
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <TicketDetailHeader
          seatViewUrl={listing.seatViewUrl}
          sectionLabel={listing.sectionLabel}
          onBack={onBack}
        />
        <TicketDetailInfo listing={listing} />
        {!isMobile && <TicketDetailCheckout quantityAvailable={listing.quantityAvailable} />}
        <TicketDetailPerks perks={listing.perks} />
        <TicketDetailDelivery delivery={listing.delivery} />
        <TicketDetailEventInfo eventInfo={eventInfo} />
      </div>
      {isMobile && (
        <TicketDetailCheckout
          quantityAvailable={listing.quantityAvailable}
          className="border-t border-gray-200 bg-white shrink-0"
        />
      )}
    </div>
  );
}
