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
  initialQuantity: number;
  onBack: () => void;
  className?: string;
}

export function TicketDetail({ listing, eventInfo, layoutMode, initialQuantity, onBack, className = '' }: TicketDetailProps) {
  const isMobile = layoutMode === 'mobile';

  return (
    <div className={`flex flex-col min-h-0 bg-white ${className}`}>
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <TicketDetailHeader
          seatViewUrl={listing.seatViewUrl}
          sectionLabel={listing.sectionLabel}
          onBack={onBack}
        />
        <TicketDetailInfo listing={listing} />
        {!isMobile && <TicketDetailCheckout quantityAvailable={listing.quantityAvailable} initialQuantity={initialQuantity} />}
        <TicketDetailPerks listing={listing} perks={listing.perks} />
        {listing.quantityAvailable > 1 && (
          <div className="p-6 border-t border-gray-100">
            <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Seated Together
            </h4>
            <p className="text-xs text-gray-500">
              {listing.rowNumber !== null
                ? `Experience it live – together in Row ${listing.rowNumber}`
                : 'Experience it live – together'}
            </p>
          </div>
        )}
        <TicketDetailDelivery delivery={listing.delivery} />
        <TicketDetailEventInfo eventInfo={eventInfo} />
        {listing.isSectionUnmapped && (
          <div className="p-6 border-t border-gray-100">
            <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Notes</h4>
            <p className="text-xs text-gray-500">
              {"We don't recognize the row(s) listed for this ticket, so we're displaying it in the last row of this section."}
            </p>
          </div>
        )}
        {listing.isUnmapped && !listing.isSectionUnmapped && (
          <div className="p-6 border-t border-gray-100">
            <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Notes</h4>
            <p className="text-xs text-gray-500">
              {listing.rowNumber === null
                ? 'The seller has guaranteed seats in this section but has not provided the exact row or seats.'
                : 'The seller has guaranteed seats in this row but has not provided the exact seats.'}
            </p>
          </div>
        )}
      </div>
      {isMobile && (
        <TicketDetailCheckout
          quantityAvailable={listing.quantityAvailable}
          initialQuantity={initialQuantity}
          className="border-t border-gray-200 bg-white shrink-0"
        />
      )}
    </div>
  );
}
