#!/usr/bin/env node
// One-time script: parse public/seats.geojson → src/app/seatMap/mock/venueSeatCounts.json
// Run from project root: node scripts/generateSeatCounts.js

import { readFileSync, writeFileSync } from 'fs';

const seats = JSON.parse(readFileSync('public/seats.geojson', 'utf8'));
const counts = {};

for (const f of seats.features) {
  const { sectionId, rowId } = f.properties;
  if (!counts[sectionId]) counts[sectionId] = {};
  counts[sectionId][rowId] = (counts[sectionId][rowId] || 0) + 1;
}

const outPath = 'src/app/seatMap/mock/venueSeatCounts.json';
writeFileSync(outPath, JSON.stringify(counts, null, 2));
console.log(`Written ${outPath}`);
console.log(`Sections: ${Object.keys(counts).length}`);
const totalSeats = Object.values(counts).reduce((a, s) => a + Object.values(s).reduce((b, c) => b + c, 0), 0);
console.log(`Total seats: ${totalSeats}`);
