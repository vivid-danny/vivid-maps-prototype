export interface VenueMetadata {
  center: [number, number];
  bounds: [[number, number], [number, number]];
}

export interface VenueAssets {
  manifestUrl: string;
  venueChromeUrl?: string;
  backgroundImageUrl?: string;
  sectionsUrl: string;
  rowsUrl: string;
  seatsUrl: string;
}
