import { DealScorePill } from '../../../components/listingRow/DealScorePill';
import { listingTitle } from '../../logic/labels';
import { displayRow } from '../../logic/visibility';
import type { ZoneListing } from '../../types';

function formatPrice(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString('en-US')}`;
}

/**
 * The base prototype's info block. Two differences, both forced by the data:
 * there are no seat numbers to append to the ticket count, and the row has to
 * go through `displayRow` because sellers send "***" and "TBC" as often as a
 * real row — a plain null check would render those verbatim.
 */
export function ZoneTicketDetailInfo({ listing }: { listing: ZoneListing }) {
  const row = displayRow(listing.row);
  const ticketSummary = [
    `${listing.quantity} ${listing.quantity === 1 ? 'ticket' : 'tickets'}`,
    row === null ? null : `Row ${row}`,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="p-6 space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-900">{listingTitle(listing)}</h3>
          <p className="text-sm text-gray-500">{ticketSummary}</p>
        </div>
        <div className="text-right">
          <div>
            <span className="text-xl font-bold text-gray-900">{formatPrice(listing.price)}</span>
            <span className="text-xs text-gray-500 ml-1">ea.</span>
          </div>
          <p className="text-xs text-gray-400">Fees Incl.</p>
        </div>
      </div>
      <DealScorePill score={listing.dealScore} />
    </div>
  );
}
