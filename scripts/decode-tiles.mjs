/**
 * Decodes .pbf vector tiles → GeoJSON files split by feature type.
 *
 * Usage: node scripts/decode-tiles.mjs <tile-dir> <out-dir>
 *   tile-dir: directory containing the .pbf files (named z-x-y.pbf or just the files)
 *   out-dir:  where to write sections.geojson, rows.geojson, seats.geojson, venue.geojson
 *
 * Tile coordinates for Wrigley Field (Cubs):
 *   tiles/5/15/15.pbf  and  tiles/5/15/16.pbf
 */

import { VectorTile } from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import fs from 'fs';
import path from 'path';

const TILES = [
  { file: '15.pbf', z: 5, x: 15, y: 15 },
  { file: '16.pbf', z: 5, x: 15, y: 16 },
];

const RIP_DIR = process.argv[2] ?? '/Users/daniel.lopez/Library/CloudStorage/OneDrive-VividSeatsLLC/Desktop/rip';
const OUT_DIR = process.argv[3] ?? path.join(process.cwd(), 'public/wrigley');

fs.mkdirSync(OUT_DIR, { recursive: true });

// Accumulate features by type across both tiles
const byType = {
  venue:    [],
  section:  [],
  row:      [],
  seat:     [],
  label:    [],
  other:    [],
};

let totalFeatures = 0;

for (const { file, z, x, y } of TILES) {
  const filePath = path.join(RIP_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.warn(`Missing: ${filePath}`);
    continue;
  }

  const buf = fs.readFileSync(filePath);
  const tile = new VectorTile(new Protobuf(buf));

  console.log(`\n[${file}] Layers:`, Object.keys(tile.layers));

  for (const layerName of Object.keys(tile.layers)) {
    const layer = tile.layers[layerName];
    console.log(`  ${layerName}: ${layer.length} features`);

    for (let i = 0; i < layer.length; i++) {
      const feature = layer.feature(i);
      const geojson = feature.toGeoJSON(x, y, z);
      const props = geojson.properties ?? {};
      props._layer = layerName;

      totalFeatures++;

      // Classify by property conventions from venue-maps-component:
      //   c === 'stadium' → venue outline
      //   t === 's'       → section
      //   t === 'r'       → row
      //   t === 'seat'    → seat (if present)
      //   $type === Point → label point
      const t = props.t;
      const c = props.c;
      const geomType = geojson.geometry?.type;

      if (c === 'stadium') {
        byType.venue.push(geojson);
      } else if (t === 's') {
        byType.section.push(geojson);
      } else if (t === 'r') {
        byType.row.push(geojson);
      } else if (t === 'seat') {
        byType.seat.push(geojson);
      } else if (geomType === 'Point') {
        byType.label.push(geojson);
      } else {
        byType.other.push(geojson);
        if (i < 3) console.log('    sample other:', JSON.stringify(props));
      }
    }
  }
}

console.log(`\nTotal features: ${totalFeatures}`);
console.log('By type:', Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, v.length])));

// Write output files
const writes = {
  'sections.geojson': byType.section,
  'rows.geojson':     byType.row,
  'seats.geojson':    byType.seat,
  'venue.geojson':    byType.venue,
  'labels.geojson':   byType.label,
  'other.geojson':    byType.other,
};

for (const [filename, features] of Object.entries(writes)) {
  if (features.length === 0) continue;
  const fc = { type: 'FeatureCollection', features };
  fs.writeFileSync(path.join(OUT_DIR, filename), JSON.stringify(fc, null, 2));
  console.log(`Wrote ${filename} (${features.length} features)`);
}

// Sample first section feature for inspection
if (byType.section.length > 0) {
  console.log('\nSample section feature:');
  console.log(JSON.stringify(byType.section[0], null, 2));
}
if (byType.row.length > 0) {
  console.log('\nSample row feature:');
  console.log(JSON.stringify(byType.row[0], null, 2));
}
