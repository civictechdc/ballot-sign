# Constituent dashboard requirements

## Purpose

Desktop web UI mock for a “Ballot Initiative Dashboard”.

## Component hierarchy (must match)

AppShell > Header (BrandMark, PrimaryNav, AccountButton) > Hero (HeroTitle, HeroSubtitle) > SearchAndFilters (InitiativeSearchInput, ActiveFilterRow) > MainGrid (RecommendedColumn, ContextColumn).

## Content (must match)

- Location placeholder: "[City, State]"
- User name: "Alex"
- Search placeholder: "Search for Initiatives by Topic, State, or Keywords"
- Filter row text exactly: "Filter: [City, State] (Selected) [Topics] (Environment, Education)"
- Recommended initiatives include at least 2 cards:
  - "Local Parks & Rec Bond: Your City Initiative" with "Signatures: 12,400 / 25,000"
  - "Public Education Funding Initiative" with an appropriate signature count
- Your Activity includes:
  - "Signed: Clean Energy for All"
  - "Following: Public Education Funding"
- Local Impact & News includes at least:
  - "New parks proposal for [City]"
  - "School funding town hall tonight"

## Design tokens (must match)

- Page background #f3f0dd
- Header divider line #dbd8c7
- Card + account border #d4d1c2
- Search input border #919388 and input background white
- Primary button background #4c6d74
- Icon tile background #b9cec7 and icon stroke #223134

## Typography

- Serif for hero headline, section headers, initiative titles.
- Sans-serif for nav links, body copy, search/filter text, metadata, buttons.

## Layout

- Centered max-width container (1040–1200px).
- Two-column MainGrid on desktop (left ~60%, right ~40% with ~40px gap), stack on mobile.

## Change log

- 2026-01-01: Updated to match Component-Level Spec + Design Tokens for dashboard mock.
