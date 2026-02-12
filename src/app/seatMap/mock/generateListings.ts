import type { SectionConfig, SectionData, Listing, Perk } from '../model/types';
import { createSeededRandom, SeededRandom } from './seededRandom';
import { generateSectionData } from './generateSectionData';
import { hashString, parseSeatId } from '../domain/utils';
import seatViewImg from '../../../assets/seatView.png';

/**
 * Compute a deal score (0-10) based on price, seat position, and perks.
 */
function computeDealScore(
  price: number,
  rowNumber: number,
  numRows: number,
  perks: Perk[],
  priceRange: [number, number],
  rng: SeededRandom
): number {
  const [minPrice, maxPrice] = priceRange;
  const normalizedPrice = maxPrice > minPrice ? (price - minPrice) / (maxPrice - minPrice) : 0;
  const priceComponent = (1 - normalizedPrice) * 5;

  const positionComponent = numRows > 1 ? (1 - (rowNumber - 1) / (numRows - 1)) * 3.5 : 3.5;

  const aisleBonus = perks.includes('aisle') ? 1.0 : 0;

  const noise = (rng.random() - 0.5);

  const raw = priceComponent + positionComponent + aisleBonus + noise;
  return Math.round(Math.max(0, Math.min(10, raw)) * 10) / 10;
}

/**
 * Assign perk tags to a listing based on seat position and randomness.
 */
function assignPerks(
  seatIds: string[],
  rowNumber: number,
  sectionConfig: SectionConfig,
  rng: SeededRandom
): Perk[] {
  const perks: Perk[] = [];

  // Positional perks
  const isAisle = seatIds.some((seatId) => {
    const parsed = parseSeatId(seatId);
    if (!parsed) return false;
    return parsed.seatNumber === 1 || parsed.seatNumber === sectionConfig.seatsPerRow;
  });
  if (isAisle) perks.push('aisle');

  if (rowNumber === 1) perks.push('front_of_section');
  if (rowNumber === sectionConfig.numRows) perks.push('ada_accessible');

  // Random perks
  if (rng.random() < 0.20) perks.push('food_and_drink');
  if (rng.random() < 0.05) perks.push('super_seller');
  if (rng.random() < 0.05) perks.push('vip');

  return perks;
}

/**
 * Extract listings from a section's generated data.
 * - Seats with the same listingId are grouped into one listing card
 * - Seats without a listingId become individual 1-ticket listings
 */
function extractListingsFromSection(
  sectionData: SectionData,
  sectionConfig: SectionConfig,
  priceRange: [number, number],
  rng: SeededRandom
): Listing[] {
  const listings: Listing[] = [];

  // Group seats by listingId
  const listingGroups = new Map<string, { rowId: string; rowNumber: number; seatIds: string[] }>();
  // Track solo seats (available seats without a listingId)
  const soloSeats: { rowId: string; rowNumber: number; seatId: string }[] = [];

  sectionData.rows.forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 1;

    row.seats.forEach((seat) => {
      if (seat.status === 'unavailable') return;

      if (seat.listingId) {
        // Seat belongs to a listing group
        const existing = listingGroups.get(seat.listingId);
        if (existing) {
          existing.seatIds.push(seat.seatId);
        } else {
          listingGroups.set(seat.listingId, {
            rowId: row.rowId,
            rowNumber,
            seatIds: [seat.seatId],
          });
        }
      } else {
        // Solo seat - no listing group
        soloSeats.push({ rowId: row.rowId, rowNumber, seatId: seat.seatId });
      }
    });
  });

  // Convert listing groups to Listing objects
  listingGroups.forEach((group, listingId) => {
    const price = rng.randInt(priceRange[0], priceRange[1] + 1);
    const perks = assignPerks(group.seatIds, group.rowNumber, sectionConfig, rng);
    const dealScore = computeDealScore(price, group.rowNumber, sectionConfig.numRows, perks, priceRange, rng);
    listings.push({
      listingId,
      sectionId: sectionConfig.sectionId,
      sectionLabel: sectionConfig.label,
      rowId: group.rowId,
      rowNumber: group.rowNumber,
      seatIds: group.seatIds,
      price,
      seatViewUrl: seatViewImg,
      perks,
      dealScore,
    });
  });

  // Convert solo seats to individual Listing objects
  // Use the same listingId format as generateSectionData: solo-{sectionId}-{seatId}
  soloSeats.forEach((solo) => {
    const price = rng.randInt(priceRange[0], priceRange[1] + 1);
    const perks = assignPerks([solo.seatId], solo.rowNumber, sectionConfig, rng);
    const dealScore = computeDealScore(price, solo.rowNumber, sectionConfig.numRows, perks, priceRange, rng);
    listings.push({
      listingId: `solo-${sectionConfig.sectionId}-${solo.seatId}`,
      sectionId: sectionConfig.sectionId,
      sectionLabel: sectionConfig.label,
      rowId: solo.rowId,
      rowNumber: solo.rowNumber,
      seatIds: [solo.seatId],
      price,
      seatViewUrl: seatViewImg,
      perks,
      dealScore,
    });
  });

  return listings;
}

/**
 * Generate all listings for a map configuration.
 * Returns an array of Listing objects sorted by price (lowest first).
 */
export function generateAllListings(
  sections: SectionConfig[],
  mapSeed: number,
  priceRange: [number, number] = [5000, 20000] // $50-$200 in cents
): Listing[] {
  const allListings: Listing[] = [];

  sections.forEach((sectionConfig) => {
    // Generate section data first
    const sectionData = generateSectionData(sectionConfig, mapSeed);

    // Create a unique seed for price generation per section
    const priceSeed = hashString(`${mapSeed}-prices-${sectionConfig.sectionId}`);
    const rng = createSeededRandom(priceSeed);

    // Extract listings from this section
    const sectionListings = extractListingsFromSection(
      sectionData,
      sectionConfig,
      priceRange,
      rng
    );

    allListings.push(...sectionListings);
  });

  // Shuffle listings randomly (but deterministically via seed)
  const shuffleSeed = hashString(`${mapSeed}-shuffle`);
  const shuffleRng = createSeededRandom(shuffleSeed);
  shuffleRng.shuffle(allListings);

  return allListings;
}
