# Contributing to Clean Tab

Thanks for helping improve Clean Tab.

## Setup

```sh
npm install
npm run dev
```

## Checks

Run these before opening a pull request:

```sh
npm run lint
npm run typecheck
npm run build
```

## Project Shape

- `src/app` contains the React new-tab UI.
- `src/constants` and `src/utils` contain shared constants and stateless helpers.
- `src/config` contains app metadata and default settings.
- `src/features/hooks` contains reusable React hooks.
- `src/features/store` contains Zustand state stores.
- `src/lib` contains the cross-browser extension API.
- `src/repositories` contains backend data access.
- `src/services` contains local storage helpers.
- `src/styles` contains the current app styles.

Keep changes focused on the active runtime. Add new structure only when it is needed by the current app.
