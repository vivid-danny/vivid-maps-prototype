export interface VenueMetadata {
  center: [number, number];
  bounds: [[number, number], [number, number]];
}

export interface VenueAssets {
  manifestUrl: string;
  backgroundUrl: string;
  sectionsUrl: string;
  rowsUrl: string;
  seatsUrl: string;
}
