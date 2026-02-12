# Vivid Maps Prototype

Interactive venue seating map prototype exploring selection logic, zoom-driven display modes, and interaction patterns for a concert venue — rendered entirely in SVG.

![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6.3-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)

## Overview

A configurable seating map that renders venue sections, rows, and individual seats as SVG elements. The map supports three zoom-driven display modes that automatically transition based on zoom level, with a unified selection model that stays in sync across all modes.

### Display Modes

| Mode | What you see | Selectable unit |
|------|-------------|-----------------|
| **Sections** | Filled rectangles with labels | Entire section |
| **Rows** | Horizontal bars per row | Individual row |
| **Seats** | Circles with listing connectors | Individual seat or seat group |

Zooming past a configurable threshold (default 5x) automatically switches from the zoomed-out mode to the zoomed-in mode.

### Key Features

- **Zoom-driven display** — seamless transitions between section, row, and seat views
- **Unified selection** — select at any level; state syncs across all zoom levels and modes
- **Seat groupings** — adjacent seats linked as listings with visual connectors
- **Price pins** — up to 3 pins per section placed via Chebyshev distance spacing
- **Listings panel** — sidebar that filters by the current map selection
- **Seeded randomization** — deterministic data generation; same seed = same layout
- **Configurable** — dev controls for zoom thresholds, display modes, and seat colors
- **Mobile responsive** — adapted zoom thresholds, initial scale, and layout

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to view the prototype.

```bash
npm run build    # Production build to dist/
```

## Project Structure

```
src/
├── main.tsx                          # Entry point
├── styles/                           # Fonts, theme, Tailwind
└── app/
    ├── App.tsx                       # Root component
    ├── components/                   # Shared UI (Venue, Stage, Section, Pins, etc.)
    └── seatMap/
        ├── config/                   # Configuration schema & defaults
        ├── model/                    # Core domain types
        ├── behavior/                 # Business logic rules and utilities
        ├── mock/                     # Deterministic data generation
        ├── state/                    # React hooks (config, controller, view state)
        └── components/              # Feature UI (SeatMapRoot, Controls, MapContainer)
```

## Tech Stack

- **React 18.3** + TypeScript
- **Vite 6.3** — dev server and bundling
- **Tailwind CSS v4** — via `@tailwindcss/vite` plugin
- **react-zoom-pan-pinch** — map navigation (zoom/pan)
- **lucide-react** — icons

## How It Works

### Venue Hierarchy

```
Venue → Sections → Rows → Seats
```

Each level has its own display mode. Selection propagates **up** the hierarchy (selecting a seat also sets the row and section) but never **down** (selecting a section does not select any rows or seats).

### Data Generation

All venue data is generated deterministically from a config object and a seed value. Each section gets its own PRNG instance derived from the map seed, producing consistent seat availability, listing groupings, and pin placements. Changing the seed regenerates everything.

### Demo Map

The default map has 8 sections arranged in 2 rows around a stage. Sections 101 and 104 are fully sold out (`unavailableRatio: 1.0`) for testing unavailable states.

## Documentation

See [PROJECT.md](./PROJECT.md) for detailed design decisions, behavioral specs, data types, and roadmap.
