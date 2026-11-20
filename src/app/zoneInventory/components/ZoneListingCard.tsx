import { memo, type CSSProperties } from 'react';
import { ZONE_COLOR, ZONE_NAME } from '../data/venue';
import { displayRow } from '../logic/visibility';
import type { ZoneListing } from '../types';
import { MetaLine } from '../../components/listingRow/MetaLine';
import { PriceStack } from '../../components/listingRow/PriceStack';

function formatPrice(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString('en-US')}`;
}

function sectionName(label: string | null): string | null {
  return label === null ? null : `Section ${label}`;
}

const CARD_COLORS = {
  default:  { bg: '#FFFFFF', border: '#D3D3DC' },
  active:   { bg: '#F6F6FB', border: '#717488' },
};

interface ZoneListingCardProps {
  listing: ZoneListing;
  isSelected: boolean;
  /** Cheapest in its section, or in its zone when the seller gave no section. */
  lowestPriceLabel: string | null;
  onSelect: (listing: ZoneListing) => void;
}

/**
 * Production's listing row, minus the seat view: this inventory has no images.
 *
 * Rows are unreliable here and seats never arrive at all, so the row never
 * depends on either. Every part of the location is optional except the zone,
 * and a missing part is simply left out — nothing is labelled as missing.
 */
function ZoneListingCardInner({
  listing,
  isSelected,
  lowestPriceLabel,
  onSelect,
}: ZoneListingCardProps) {
  const row = displayRow(listing.row);
  // `isDisplayable` filters out unmatched zones upstream, so this never renders.
  const zoneId = listing.zoneId;
  if (zoneId === null) return null;
  /*
   * The title is whatever location the seller actually gave, widest part first:
   * zone, then section. A missing part is omitted rather than labelled as
   * missing, so zone-only inventory simply stops at the zone. The zone itself is
   * always there — `isDisplayable` drops anything whose zone text matched
   * nothing, so no listing reaches a card without one.
   */
  const title = [ZONE_NAME[zoneId], sectionName(listing.sectionLabel)]
    .filter(Boolean)
    .join(', ');
  const colors = isSelected ? CARD_COLORS.active : CARD_COLORS.default;
  const rowStyle: CSSProperties = {
    backgroundColor: colors.bg,
    // Repeats the map's zone fill, so the row points at the geometry it came from.
    borderLeft: `6px solid ${ZONE_COLOR[zoneId]}`,
  };
  const edgeStyle: CSSProperties = { borderColor: colors.border };

  return (
    <button
      type="button"
      onClick={() => onSelect(listing)}
      className="group flex h-20 w-full cursor-pointer rounded-sm text-left transition-colors hover:bg-surface-50"
      style={rowStyle}
    >
      <div
        className="flex min-w-0 grow items-center overflow-hidden border-y transition-colors group-hover:border-ink-muted"
        style={edgeStyle}
      >
        {/* Fixed three-line block: the title lane stays put whether or not the
            green line is there, which a centered variable-height block breaks. */}
        <div className="flex h-[54px] min-w-0 flex-col pl-2">
          <p
            className="truncate text-small font-medium text-ink"
          >
            {title}
          </p>
          <MetaLine
            parts={[
              row === null ? null : { text: `Row ${row}`, bold: true },
              {
                text: `${listing.quantity} ${listing.quantity === 1 ? 'ticket' : 'tickets'}`,
              },
            ]}
          />
          {lowestPriceLabel && (
            <p className="truncate text-caption font-medium text-[#008442]">{lowestPriceLabel}</p>
          )}
        </div>
      </div>

      <PriceStack
        price={formatPrice(listing.price)}
        dealScore={listing.dealScore}
        borderColor={colors.border}
      />
    </button>
  );
}

export const ZoneListingCard = memo(ZoneListingCardInner);
