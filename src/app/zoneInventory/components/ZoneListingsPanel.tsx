import { useMemo } from 'react';
import type { HeaderText, ListingGroup, PanelModel, SortBy, ZoneListing } from '../types';
import { ZoneListingCard } from './ZoneListingCard';

/**
 * Production flags the cheapest listing in each section. Zone-only listings have
 * no section, so they are compared within their zone instead and labelled to say
 * so. Computed across the whole model rather than per tier, so promoting a
 * section's listings into Tier 1 can't mislabel the rows left in Tier 2.
 */
function buildLowestPriceLabels(model: PanelModel): Map<string, string> {
  const everyListing = [
    ...(model.all ?? []),
    ...(model.exact?.listings ?? []),
    ...(model.alsoInZone?.listings ?? []),
  ];

  const cheapest = new Map<string, ZoneListing>();
  const counts = new Map<string, number>();
  for (const listing of everyListing) {
    // Zone-only inventory is only comparable against its zone.
    const key = listing.sectionLabel
      ? `section:${listing.sectionLabel}`
      : `zone:${listing.zoneId ?? 'none'}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    const current = cheapest.get(key);
    if (!current || listing.price < current.price) cheapest.set(key, listing);
  }

  const labels = new Map<string, string>();
  for (const [key, listing] of cheapest) {
    // "Lowest" says nothing when there is nothing to be lowest than.
    if ((counts.get(key) ?? 0) < 2) continue;
    labels.set(
      listing.listingId,
      key.startsWith('section:') ? 'Lowest Price in Section' : 'Lowest Price in Zone',
    );
  }
  return labels;
}

interface ZoneListingsPanelProps {
  className?: string;
  model: PanelModel;
  selectedListingId: string | null;
  onSelectListing: (listing: ZoneListing) => void;
  sortBy: SortBy;
  onSortByChange: (sortBy: SortBy) => void;
}

/**
 * Base-prototype sort control: styled label plus the Figma sort glyph, with the
 * native <select> laid transparently over the top.
 */
function SortControl({
  sortBy,
  onSortByChange,
}: {
  sortBy: SortBy;
  onSortByChange: (sortBy: SortBy) => void;
}) {
  return (
    <div className="relative flex shrink-0 items-center gap-1 rounded text-small text-ink has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-[#D63384]">
      <span className="whitespace-nowrap">
        {sortBy === 'price' ? 'Lowest Price' : 'Deal Score'}
      </span>
      <span aria-hidden className="relative h-6 w-2 shrink-0">
        <img
          src="/icons/sort.svg"
          alt=""
          draggable={false}
          className="absolute left-[-1px] top-1/2 h-[10px] w-[6px] -translate-y-1/2"
        />
      </span>
      <select
        aria-label="Sort listings"
        value={sortBy}
        onChange={(event) => onSortByChange(event.target.value as SortBy)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        <option value="price">Lowest Price</option>
        <option value="dealScore">Deal Score</option>
      </select>
    </div>
  );
}

/** Base-prototype header pattern: bold count, unbolded secondary remainder. */
function Header({ text, className }: { text: HeaderText; className?: string }) {
  return (
    <h2 className={`min-w-0 flex-1 truncate text-small font-bold text-ink ${className ?? ''}`}>
      {text.count}
      {text.detail && <span className="font-normal text-ink-secondary"> {text.detail}</span>}
    </h2>
  );
}

function Group({
  group,
  selectedListingId,
  lowestPriceLabels,
  onSelectListing,
}: {
  group: ListingGroup;
  selectedListingId: string | null;
  lowestPriceLabels: Map<string, string>;
  onSelectListing: (listing: ZoneListing) => void;
}) {
  return (
    <section className="flex flex-col">
      {/* Tier 1 is already described by the results header above the list. */}
      {group.tier === 2 && <Header text={group.header} className="pb-2" />}
      <div className="flex flex-col gap-2">
        {group.listings.map((listing) => (
          <ZoneListingCard
            key={listing.listingId}
            listing={listing}
            isSelected={listing.listingId === selectedListingId}
            lowestPriceLabel={lowestPriceLabels.get(listing.listingId) ?? null}
            onSelect={onSelectListing}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * One list, two tiers. Selecting a section promotes that section's listings but
 * never hides the rest of its zone — the second group always follows, including
 * when the first one is empty.
 */
export function ZoneListingsPanel({
  className,
  model,
  selectedListingId,
  onSelectListing,
  sortBy,
  onSortByChange,
}: ZoneListingsPanelProps) {
  const isEmpty = model.totalVisible === 0;
  const lowestPriceLabels = useMemo(() => buildLowestPriceLabels(model), [model]);

  return (
    <div className={`flex min-h-0 flex-col bg-white ${className ?? ''}`}>
      <div className="mb-4 flex h-6 shrink-0 items-center gap-2 bg-white">
        <Header text={model.resultsHeader} />
        <SortControl sortBy={sortBy} onSortByChange={onSortByChange} />
      </div>

      <div className="no-scrollbar flex flex-1 flex-col gap-5 overflow-y-auto pb-3">
        {isEmpty && (
          <p className="py-8 text-center text-small text-ink-muted">
            No listings match these filters.
          </p>
        )}

        {model.all && (
          <div className="flex flex-col gap-2">
            {model.all.map((listing) => (
              <ZoneListingCard
                key={listing.listingId}
                listing={listing}
                isSelected={listing.listingId === selectedListingId}
                lowestPriceLabel={lowestPriceLabels.get(listing.listingId) ?? null}
                onSelect={onSelectListing}
              />
            ))}
          </div>
        )}

        {model.exact && (
          <Group
            group={model.exact}
            selectedListingId={selectedListingId}
            lowestPriceLabels={lowestPriceLabels}
            onSelectListing={onSelectListing}
          />
        )}

        {model.alsoInZone && (
          <Group
            group={model.alsoInZone}
            selectedListingId={selectedListingId}
            lowestPriceLabels={lowestPriceLabels}
            onSelectListing={onSelectListing}
          />
        )}
      </div>
    </div>
  );
}
