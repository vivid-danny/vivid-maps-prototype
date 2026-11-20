import type { EventInfo, LayoutMode } from '../../../seatMap/model/types';
import { TicketDetailCheckout } from '../../../components/ticketDetail/TicketDetailCheckout';
import { TicketDetailEventInfo } from '../../../components/ticketDetail/TicketDetailEventInfo';
import { ZONE_NAME } from '../../data/venue';
import { displayRow } from '../../logic/visibility';
import type { ZoneListing } from '../../types';
import { ZoneTicketDetailHeader } from './ZoneTicketDetailHeader';
import { ZoneTicketDetailInfo } from './ZoneTicketDetailInfo';

interface ZoneTicketDetailProps {
  listing: ZoneListing;
  /** The listing's section, or every section of its zone when it has none. */
  highlightShapeIds: string[];
  eventInfo: EventInfo;
  layoutMode: LayoutMode;
  initialQuantity: number;
  onBack: () => void;
  className?: string;
}

/**
 * The base prototype's ticket detail, section order and spacing unchanged.
 *
 * Perks and Delivery are absent: neither exists on this inventory, and inventing
 * them would put claims on the page the seller never made. The Notes block takes
 * the place the base gives it, re-scoped from "unmapped row" to "no section",
 * which is this prototype's equivalent caveat.
 */
export function ZoneTicketDetail({
  listing,
  highlightShapeIds,
  eventInfo,
  layoutMode,
  initialQuantity,
  onBack,
  className = '',
}: ZoneTicketDetailProps) {
  const isMobile = layoutMode === 'mobile';
  const row = displayRow(listing.row);
  const hasSection = listing.sectionLabel !== null;
  const zoneName = listing.zoneId ? ZONE_NAME[listing.zoneId] : null;

  return (
    <div className={`flex flex-col min-h-0 bg-white ${className}`}>
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <ZoneTicketDetailHeader highlightShapeIds={highlightShapeIds} onBack={onBack} />
        <ZoneTicketDetailInfo listing={listing} />

        {!isMobile && (
          <TicketDetailCheckout
            quantityAvailable={listing.quantity}
            initialQuantity={initialQuantity}
          />
        )}

        {listing.quantity > 1 && (
          <div className="p-6 border-t border-gray-100">
            <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">
              Seated Together
            </h4>
            <p className="text-xs text-gray-500">
              {row === null
                ? 'Experience it live – together'
                : `Experience it live – together in Row ${row}`}
            </p>
          </div>
        )}

        <TicketDetailEventInfo eventInfo={eventInfo} />

        {!hasSection && (
          <div className="p-6 border-t border-gray-100">
            <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">
              Notes
            </h4>
            <p className="text-xs text-gray-500">
              {`The seller listed these tickets for ${zoneName ?? 'this zone'} without a section. Your seats are guaranteed in that zone, but the exact section is assigned by the venue.`}
            </p>
          </div>
        )}
      </div>

      {isMobile && (
        <TicketDetailCheckout
          quantityAvailable={listing.quantity}
          initialQuantity={initialQuantity}
          className="border-t border-gray-200 bg-white shrink-0"
        />
      )}
    </div>
  );
}
