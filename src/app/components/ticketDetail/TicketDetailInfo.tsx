import type { Listing } from '../../seatMap/model/types';
import { formatPrice } from '../../seatMap/behavior/utils';

interface TicketDetailInfoProps {
  listing: Listing;
}

function DealScoreBadge({ score }: { score: number }) {
  let label = 'Good';
  if (score >= 9) label = 'Excellent';
  else if (score >= 8) label = 'Great';
  else if (score >= 7) label = 'Good';

  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-green-100 text-green-700">
      {score.toFixed(1)} {label}
    </span>
  );
}

export function TicketDetailInfo({ listing }: TicketDetailInfoProps) {
  const ticketCount = listing.seatIds.length;

  return (
    <div className="p-6 space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Section {listing.sectionLabel}, Row {listing.rowNumber}
          </h3>
          <p className="text-sm text-gray-500">
            {ticketCount} {ticketCount === 1 ? 'ticket' : 'tickets'}
          </p>
        </div>
        <div className="text-right">
          <span className="text-xl font-bold text-gray-900">{formatPrice(listing.price)}</span>
          <span className="text-xs text-gray-500 ml-1">ea.</span>
          <p className="text-xs text-gray-400">Fees Incl.</p>
        </div>
      </div>

      {listing.dealScore > 7 && <DealScoreBadge score={listing.dealScore} />}

    </div>
  );
}
