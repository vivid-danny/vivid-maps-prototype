import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ListingCard } from './ListingCard';
import { TicketDetailInfo } from './ticketDetail/TicketDetailInfo';
import { TicketDetail } from './ticketDetail/TicketDetail';
import type { Listing } from '../seatMap/model/types';

function createListing(overrides: Partial<Listing> = {}): Listing {
  return {
    listingId: overrides.listingId ?? 'listing-1',
    sectionId: overrides.sectionId ?? '214',
    sectionLabel: overrides.sectionLabel ?? '214',
    rowId: overrides.rowId ?? null,
    rowNumber: overrides.rowNumber ?? null,
    seatIds: overrides.seatIds ?? [],
    price: overrides.price ?? 10000,
    seatViewUrl: overrides.seatViewUrl ?? 'seat-view.png',
    perks: overrides.perks ?? [],
    dealScore: overrides.dealScore ?? 5.5,
    quantityAvailable: overrides.quantityAvailable ?? 2,
    feePerTicket: overrides.feePerTicket ?? 1000,
    delivery: overrides.delivery ?? {
      method: 'mobile_transfer',
      label: 'Mobile Transfer',
      description: 'Transferred to your phone',
    },
    isUnmapped: overrides.isUnmapped,
  };
}

describe('rowless listing copy', () => {
  it('renders section-only copy in the listing card when row is absent', () => {
    const markup = renderToStaticMarkup(
      <ListingCard
        listing={createListing({ isUnmapped: true })}
        isSelected={false}
        isHovered={false}
        onClick={() => undefined}
        onHover={() => undefined}
      />,
    );

    expect(markup).toContain('Section 214');
    expect(markup).not.toContain('Row');
  });

  it('renders section-only unmapped detail copy without claiming a row', () => {
    const listing = createListing({ isUnmapped: true });
    const infoMarkup = renderToStaticMarkup(<TicketDetailInfo listing={listing} />);
    const detailMarkup = renderToStaticMarkup(
      <TicketDetail
        listing={listing}
        eventInfo={{
          eventName: 'Event',
          eventDate: 'Date',
          venueName: 'Venue',
          venueAddress: 'Address',
        }}
        layoutMode="desktop"
        initialQuantity={2}
        onBack={() => undefined}
      />,
    );

    expect(infoMarkup).toContain('Section 214');
    expect(infoMarkup).not.toContain('Row');
    expect(detailMarkup).toContain('has not provided the exact row or seats');
    expect(detailMarkup).not.toContain('guaranteed seats in this row');
  });
});
