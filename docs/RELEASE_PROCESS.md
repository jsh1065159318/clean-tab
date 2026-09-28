# Clean Tab Release Process

This project builds Chromium and Firefox extension packages from the Vite app.

## Checklist

- Run `npm run lint`
- Run `npm run typecheck`
- Run `npm run build`
- Test `build/chrome` in a Chromium-based browser
- Test `build/firefox` in Firefox
- Publish the generated ZIP files from `build/`

The build command creates both unpacked test directories and release archives:

- `build/chrome/`
- `build/firefox/`
- `build/clean-tab-chrome-<version>.zip`
- `build/clean-tab-firefox-<version>.zip`

For local Supabase-backed testing, configure `.env.local` with only the public project URL and publishable/anon key before building. Never package a service-role or secret key into the extension.

## Version Updates

Before publishing, update the version in:

- `package.json`
- `manifest/chrome.json`
- `manifest/firefox.json`

Then run `npm run build` again so the generated ZIP names match the package version.
