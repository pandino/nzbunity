# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev             # Start Chrome with extension hot-reloaded
npm run dev:firefox     # Same for Firefox
npm run build           # Production build (Chrome)
npm run build:firefox   # Production build (Firefox)
npm run build:all       # Both browsers
npm run zip:all         # Zip both builds for distribution
npm run compile         # TypeScript type-check only (no emit)
npm run test            # Run tests once
npm run test:watch      # Watch mode

# Docker test helpers (SABnzbd on :7357, NZBGet on :7358)
npm run compose:sabnzbd
npm run compose:nzbget
npm run compose:clean   # Remove downloaded files from containers
```

Tests use `happy-dom` (not jsdom). Live downloader tests require `.env.test.local` with credentials — see `.env.test` for variable names.

## Architecture

This is a **Manifest V3 browser extension** built with [WXT](https://wxt.dev/). The `~` path alias resolves to `src/`.

### Data flow

```
Content script  →  browser.runtime.sendMessage  →  Background service worker
                                                         ↓
                                                      Client  →  Downloader (SABnzbd | NZBGet)
```

- **`src/store.ts`** — All persisted state lives in `browser.storage.local`. `getOptions()`/`setOptions()` are the entry points; `getOptions()` runs migrations and syncs indexers on every call. `watchOptions()` registers listeners that fire on any store change (the native `storage.onChanged` event is unreliable, so `setOptions` also manually notifies watchers).

- **`src/downloader/index.ts`** — Abstract `Downloader` base class defining the API contract. `src/downloader/SABnzbd.ts` and `src/downloader/NZBGet.ts` are the two implementations. Each handles its own URL format, authentication, and response parsing.

- **`src/Client.ts`** — Singleton (`Client.getInstance()`) that wraps the active `Downloader`. Owns the refresh timer (polls queue at `RefreshRate` interval), applies category transformations via `transmogrifyCategory()`, and exposes proxy methods that refresh the queue after mutations. `ManualClient` (used by content scripts) disables polling.

- **`src/entrypoints/background.ts`** — MV3 service worker. Routes `browser.commands` (keyboard shortcuts) and `browser.runtime.onMessage` calls (`addUrl`, `addFile`, log ops) to `Client`.

- **`src/Content.ts`** — Abstract base class for all 1-click site content scripts. Subclasses must implement `get id()`. The constructor calls `ready()` then `onReady()`, which dispatches to `initializeLinks`, `initializeListLinks`, or `initializeDetailLinks` depending on which is defined and what `isList`/`isDetail` return. Downloads go through `addUrl()` / `addFile()` / `addFileByRequest()`, which message the background script.

- **`src/entrypoints/*.content.ts`** — One file per supported NZB site. Each exports a WXT `defineContentScript` whose `main()` instantiates a site-specific subclass of `Content`. The `newznab.content.ts` entrypoint is injected dynamically via the `activate-newznab` keyboard command rather than matching on load.

- **`src/service.ts`** — React hooks (`useOptions`, `useLogger`) for popup/options UI components.

- **`src/assets.ts`** — Barrel for static assets referenced in entrypoints.

### Adding a new 1-click site

1. Create `src/entrypoints/<sitename>.content.ts` extending `Content` (see `omgwtfnzbs.content.ts` or `dognzb.content.ts` as reference).
2. Add the site to `DefaultIndexers` in `src/store.ts`.

### Formatter

Prettier is configured in `package.json`: single quotes, trailing commas, 90-char print width, 2-space indent.
