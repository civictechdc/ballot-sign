# Frontend mockup recommendations

This document summarizes the **frontend mockup approach** and the design system decisions used in the demo UI.

## Mock-first strategy

- Implement all primary pages with **mock data** and mocked write actions.
- Keep UI state realistic (loading, empty, confirmation states) even when data is mocked.
- Preserve seams so mock repositories can be replaced by real API adapters.

## Design system decisions (current)

The dashboard mock follows the design tokens and typography rules you provided:

- Background: `#f3f0dd`
- Header divider: `#dbd8c7`
- Card + account border: `#d4d1c2`
- Input border: `#919388`
- Primary button: `#4c6d74`
- Icon tile: `#b9cec7` with stroke `#223134`
- Text primary: `#1a1a1a`
- Text muted: `#666666`

Typography:

- Serif: hero headline, section headers, initiative titles
- Sans: nav links, body, metadata, inputs, buttons

## Dashboard component hierarchy (must stay stable)

AppShell > Header (BrandMark, PrimaryNav, AccountButton) > Hero > SearchAndFilters > MainGrid.

## Where the mock data lives

The current demo uses:

- initiatives fixtures (for public initiative pages)
- localStorage-backed signatures (for mock “sign” submissions)

## Update log

- 2026-01-01: Initial mockup recommendations document created.
