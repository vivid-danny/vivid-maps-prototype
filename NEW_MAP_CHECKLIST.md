# New Map QA Checklist

Run through this list every time a new map is added. Open the prototype at `http://localhost:5173` and switch to the new map via **Prototype Controls → Map tab**.

---

## 1. Venue Renders Correctly

- [ ] Map loads without errors in console
- [ ] Venue boundary shape is visible and correct
- [ ] Stage / field element renders with its own fill (not white)
- [ ] Section boundaries are drawn over the venue

---

## 2. Styles Tab — Venue Controls

Open **Prototype Controls → Styles tab**.

- [ ] **Venue > Fill** — change to red `#FF0000`, venue background turns red
- [ ] **Venue > Stroke** — change to blue `#0000FF`, venue boundary outline turns blue
- [ ] **Venue > Stroke Width** — slide from 0 to 8, venue outline thickness changes (0 = no border)
- [ ] **Venue > Map Background** — change color, the canvas background outside the map changes
- [ ] Reset button restores all defaults

> **Common failure:** venue element name mismatch. `RealVenue.tsx` applies venueFill/venueStroke only when `el.name === 'venue'`. If your JSON uses a different name (e.g. `venue_boundary`), normalize it in `createYourMapSeatMapModel.ts`:
> ```ts
> const venueElements = data.venue.map((el) =>
>   el.name === 'venue_boundary' ? { ...el, name: 'venue' } : el
> );
> ```

---

## 3. Section Boundaries

- [ ] **Section Boundaries > Stroke** color change applies to all section outlines
- [ ] **Section Boundaries > Stroke Width** slider changes outline thickness

---

## 4. Sections Mode (default zoom-out view)

- [ ] Available sections render with the `available` color
- [ ] Sold-out/unavailable sections render with the `unavailable` color (muted)
- [ ] Hovering an available section highlights it
- [ ] Clicking an available section selects it (highlighted, listing panel scrolls)
- [ ] Clicking again or clicking another section deselects/switches

---

## 5. Zoom — Mode Transitions

- [ ] Zooming in past the threshold switches from sections → rows/seats mode
- [ ] Zooming back out returns to sections mode
- [ ] No visual jump or layout shift on mode transition
- [ ] **Desktop Zoom Threshold** slider (Interaction tab) changes the crossover scale

---

## 6. Rows Mode

- [ ] Rows render inside section boundaries when zoomed in
- [ ] Row highlighting works on hover
- [ ] Listing panel highlights corresponding rows

---

## 7. Seats Mode

- [ ] Individual seats render at high zoom
- [ ] Available seats are clickable
- [ ] Unavailable seats appear muted and are not clickable
- [ ] Selected seats render with `selected` color
- [ ] Connector lines appear between grouped listing seats

---

## 8. Pins

- [ ] Price pins appear on the map at sections zoom level
- [ ] **Pin Density** sliders (Interaction tab, Sections/Rows/Seats) adjust pin count
- [ ] Pins scale inversely with zoom (stay visually consistent size)
- [ ] Hovering a pin highlights it and the corresponding listing card
- [ ] Clicking a pin selects the listing

---

## 9. Styles Tab — Inventory Colors

- [ ] **Inventory > Available** color change updates section/seat fill
- [ ] **Inventory > Unavailable** color change updates unavailable sections/seats
- [ ] **Inventory > Selected** color change updates selected section/seat
- [ ] **Inventory > Hover** color change updates hover highlight
- [ ] **Connector Width** slider changes seat connector line thickness
- [ ] **Pins** color pickers (Default/Hovered/Pressed/Selected) update pin appearance

---

## 10. Themes

Cycle through all four themes: **Branded → Neutral → Zone → Deal**.

- [ ] **Branded**: sections use the `available` accent color
- [ ] **Neutral**: sections use a neutral gray
- [ ] **Zone**: each section is colored by its zone assignment
- [ ] **Deal**: each section is colored by the cheapest listing's deal score

---

## 11. Section Labels

- [ ] Section labels appear in sections mode
- [ ] **Section Labels > Available** color changes visible label text
- [ ] **Section Labels > Selected** color changes the label text when section is selected

---

## 12. Device / Mobile Mode

Switch Device to **Mobile** in Interaction tab.

- [ ] Map renders in mobile layout (map on top, listings below)
- [ ] **Mobile Map Height** slider adjusts the map pane height
- [ ] Fewer pins shown on mobile
- [ ] Detail overlay covers full screen on mobile

Switch back to **Desktop** and verify layout restores.

---

## 13. Listing Panel

- [ ] Listings load and are visible in the panel
- [ ] Clicking a listing card scrolls/zooms map to that section
- [ ] Hovering a card highlights the corresponding map section
- [ ] **Listing Card** size toggle (dense/standard/spacious) changes card height

---

## 14. Detail View

- [ ] Clicking a listing card opens the detail panel (slide-in animation)
- [ ] Back button returns to listings
- [ ] Detail panel shows correct listing info

---

## 15. Reset Map Button

- [ ] "Reset Map" button appears when zoomed in
- [ ] Clicking it zooms back to initial scale and clears selection

---

## 16. Data Integration Checks (for new maps specifically)

- [ ] `mapRegistry.ts` entry has correct `id`, `label`, `createModel`, and `scaleDefaults`
- [ ] `scaleDefaults` include `desktopInitialScale`, `desktopZoomThreshold`, `mobileInitialScale`, `mobileZoomThreshold`
- [ ] The `createModel` function maps all venue elements — confirm element names in JSON match what `RealVenue.tsx` expects (`'venue'` for the boundary)
- [ ] Section IDs in the JSON are unique and consistent with how listings reference them
- [ ] At least one sold-out section exists to verify unavailable state
- [ ] Map loads in `~500ms` or less (check Network tab for JSON fetch time)
