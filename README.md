# Clean Tab

A clean, extensible new tab browser extension starter based on React and Vite.

This repository is being refactored from an existing new tab extension codebase into a smaller frontend foundation for a custom new tab product. The current runtime path is intentionally lightweight and keeps backend integration behind service boundaries.

## Current Scope

- New tab override for Chromium and Firefox style extensions
- React + Vite frontend
- Clock, date, greeting, search, quick links, background settings
- Local settings storage
- Prepared service layer for future API, auth, and settings sync work

## Development

Install dependencies:

```sh
npm install
```

Run locally:

```sh
npm run dev
```

Build extension packages:

```sh
npm run build
```

Run checks:

```sh
npm run lint
```

## Frontend Architecture

```txt
src/app          Runtime entry and new tab UI
src/config       App metadata, defaults, endpoint config
src/services     Storage, API, auth, settings, sync boundaries
src/stores       Small React-compatible stores
src/styles       Clean runtime styles
```

Legacy source folders are still present while the refactor is in progress. They are not part of the current runtime entry unless explicitly imported again.
