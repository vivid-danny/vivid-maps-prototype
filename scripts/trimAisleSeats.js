#!/usr/bin/env node
// One-time script: remove the outermost aisle seats from every row in seats.geojson.
// The pipeline clamped excess seats to boundary coordinates, creating stacks.
//
// Strategy: compute the typical seat spacing for each row, then remove all seats
// within 1 spacing of each boundary. This adapts to stacking (removes many clamped
// seats near the edge) while only removing 1 seat on the non-stacked end.
//
// Run from project root: node scripts/trimAisleSeats.js

import { readFileSync, writeFileSync } from 'fs';

const geojson = JSON.parse(readFileSync('public/seats.geojson', 'utf8'));

// Group features by sectionId:rowId
const groups = new Map();
for (const f of geojson.features) {
  const key = `${f.properties.sectionId}:${f.properties.rowId}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(f);
}

const trimmed = [];
let removedCount = 0;

for (const [, features] of groups) {
  features.sort((a, b) => a.properties.seatIndex - b.properties.seatIndex);

  if (features.length <= 2) {
    trimmed.push(...features);
    continue;
  }

  // Determine which axis seats vary along (lng or lat)
  const coords = features.map(f => f.geometry.coordinates);
  const lngRange = Math.max(...coords.map(c => c[0])) - Math.min(...coords.map(c => c[0]));
  const latRange = Math.max(...coords.map(c => c[1])) - Math.min(...coords.map(c => c[1]));
  const axisIdx = lngRange >= latRange ? 0 : 1;

  // Sorted unique positions along the row axis
  const uniquePositions = [...new Set(features.map(f => f.geometry.coordinates[axisIdx]))].sort((a, b) => a - b);

  if (uniquePositions.length <= 3) {
    trimmed.push(...features);
    continue;
  }

  // Compute typical seat spacing from consecutive unique positions (median to be robust)
  const gaps = [];
  for (let i = 1; i < uniquePositions.length; i++) {
    const gap = uniquePositions[i] - uniquePositions[i - 1];
    if (gap > 1e-6) gaps.push(gap); // skip near-zero gaps from stacking
  }
  gaps.sort((a, b) => a - b);
  const typicalSpacing = gaps[Math.floor(gaps.length / 2)] || gaps[0];

  // Remove seats within 1 spacing of each boundary
  const minPos = uniquePositions[0];
  const maxPos = uniquePositions[uniquePositions.length - 1];
  const minCutoff = minPos + typicalSpacing * 0.99;
  const maxCutoff = maxPos - typicalSpacing * 0.99;

  const kept = features.filter(f => {
    const pos = f.geometry.coordinates[axisIdx];
    return pos > minCutoff && pos < maxCutoff;
  });

  if (kept.length === 0) {
    trimmed.push(...features);
    continue;
  }

  removedCount += features.length - kept.length;

  // Reindex seatIndex, seatId, and id
  for (let i = 0; i < kept.length; i++) {
    const f = kept[i];
    const sectionId = f.properties.sectionId;
    const rowId = f.properties.rowId;
    f.properties.seatIndex = i;
    f.properties.seatId = `${sectionId}:S${i + 1}`;
    f.properties.id = `${sectionId}:${rowId}:s${i + 1}`;
  }

  trimmed.push(...kept);
}

geojson.features = trimmed;
writeFileSync('public/seats.geojson', JSON.stringify(geojson));

console.log(`Removed ${removedCount} seats across ${groups.size} rows`);
console.log(`Features: ${trimmed.length} (was ${geojson.features.length + removedCount})`);
