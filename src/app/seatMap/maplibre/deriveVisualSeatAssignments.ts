import { buildRowFeatureId } from '../model/ids';
import type { Listing, SeatMapModel } from '../model/types';

export type VisualCoverageKind = 'mapped' | 'row_unmapped' | 'section_unmapped';

export interface VisualSeatAssignments {
  visualSeatListingBySeatId: Map<string, Listing>;
  visualSeatIdsByListingId: Map<string, string[]>;
  visuallyCoveredRows: Set<string>;
  visualCoverageKindByListingId: Map<string, VisualCoverageKind>;
  visualRowIdByListingId: Map<string, string | null>;
  visualRowNumberByListingId: Map<string, number | null>;
}

const RESERVED_SECTION_IDS = new Set(['214', '316', '24']);

function compareListingsForVisualPriority(a: Listing, b: Listing): number {
  if (a.price !== b.price) return a.price - b.price;
  if (a.dealScore !== b.dealScore) return b.dealScore - a.dealScore;
  return a.listingId.localeCompare(b.listingId);
}

function isMappedListing(listing: Listing): boolean {
  return listing.seatIds.length > 0;
}

function isRowScopedUnmappedListing(listing: Listing): boolean {
  return listing.rowId !== null && listing.seatIds.length === 0;
}

function isSectionScopedUnmappedListing(listing: Listing): boolean {
  return listing.rowId === null && listing.seatIds.length === 0;
}

export function deriveVisualSeatAssignments(model: SeatMapModel): VisualSeatAssignments {
  const visualSeatListingBySeatId = new Map<string, Listing>();
  const visualSeatIdsByListingId = new Map<string, string[]>();
  const visuallyCoveredRows = new Set<string>();
  const visualCoverageKindByListingId = new Map<string, VisualCoverageKind>();
  const visualRowIdByListingId = new Map<string, string | null>();
  const visualRowNumberByListingId = new Map<string, number | null>();

  for (const listing of model.listings) {
    visualSeatIdsByListingId.set(listing.listingId, [...listing.seatIds]);
    visualRowIdByListingId.set(listing.listingId, listing.rowId);
    visualRowNumberByListingId.set(listing.listingId, listing.rowNumber);

    if (listing.rowId) {
      visuallyCoveredRows.add(buildRowFeatureId(listing.sectionId, listing.rowId));
    }

    if (listing.seatIds.length > 0) {
      visualCoverageKindByListingId.set(listing.listingId, 'mapped');
    }

    for (const seatId of listing.seatIds) {
      visualSeatListingBySeatId.set(seatId, listing);
    }
  }

  for (const sectionId of RESERVED_SECTION_IDS) {
    const sectionData = model.sectionDataById.get(sectionId);
    if (!sectionData) continue;

    const sectionListings = model.listingsBySection.get(sectionId) ?? [];
    const rowNumberById = new Map(sectionData.rows.map((row, rowIndex) => [row.rowId, rowIndex + 1]));
    const backRow = sectionData.rows[sectionData.rows.length - 1] ?? null;
    const listingsByRowId = new Map<string, Listing[]>();

    for (const listing of sectionListings) {
      if (!listing.rowId) continue;
      const existing = listingsByRowId.get(listing.rowId);
      if (existing) {
        existing.push(listing);
      } else {
        listingsByRowId.set(listing.rowId, [listing]);
      }
    }

    for (const row of sectionData.rows) {
      const rowListings = listingsByRowId.get(row.rowId) ?? [];
      const mappedListings = rowListings.filter(isMappedListing);
      if (mappedListings.length > 0) {
        continue;
      }

      const rowScopedUnmapped = rowListings.filter(isRowScopedUnmappedListing).sort(compareListingsForVisualPriority);
      const rowSeatIds = row.seats.map((seat) => seat.seatId);
      if (rowScopedUnmapped.length > 0) {
        const winner = rowScopedUnmapped[0]!;
        visualSeatIdsByListingId.set(winner.listingId, rowSeatIds);
        visualCoverageKindByListingId.set(winner.listingId, 'row_unmapped');
        visualRowIdByListingId.set(winner.listingId, row.rowId);
        visualRowNumberByListingId.set(winner.listingId, rowNumberById.get(row.rowId) ?? null);
        visuallyCoveredRows.add(buildRowFeatureId(sectionId, row.rowId));
        for (const seatId of rowSeatIds) {
          visualSeatListingBySeatId.set(seatId, winner);
        }
        continue;
      }

      if (!backRow || row.rowId !== backRow.rowId) continue;

      const sectionScopedUnmapped = sectionListings
        .filter(isSectionScopedUnmappedListing)
        .sort(compareListingsForVisualPriority);
      if (sectionScopedUnmapped.length === 0) continue;

      const winner = sectionScopedUnmapped[0]!;
      visualSeatIdsByListingId.set(winner.listingId, rowSeatIds);
      visualCoverageKindByListingId.set(winner.listingId, 'section_unmapped');
      visualRowIdByListingId.set(winner.listingId, row.rowId);
      visualRowNumberByListingId.set(winner.listingId, rowNumberById.get(row.rowId) ?? null);
      visuallyCoveredRows.add(buildRowFeatureId(sectionId, row.rowId));
      for (const seatId of rowSeatIds) {
        visualSeatListingBySeatId.set(seatId, winner);
      }
    }
  }

  return {
    visualSeatListingBySeatId,
    visualSeatIdsByListingId,
    visuallyCoveredRows,
    visualCoverageKindByListingId,
    visualRowIdByListingId,
    visualRowNumberByListingId,
  };
}
