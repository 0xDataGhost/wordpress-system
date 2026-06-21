# SaaS E-commerce Operations Dashboard

A multi-tenant SaaS dashboard for WordPress/WooCommerce stores, Arabic-first (RTL) with light/dark mode.

See [plan.md](plan.md) for the full MVP plan and phase breakdown.

## Monorepo Structure

```txt
apps/
  dashboard/              React dashboard (Phase 1 — in progress)
  api/                    Express API (Phase 2)
  workers/                BullMQ workers (Phase 2 / 10)
plugins/
  wordpress-connector/    WordPress connector plugin (Phase 4)
packages/
  shared/                 Shared types/helpers
docs/
```

## Current Status

- **Phase 1 — Frontend Foundation**: dashboard app with RTL layout, theming, routing,
  auth UI, and the shared component library.

## Getting Started (dashboard)

```bash
cd apps/dashboard
npm install
npm run dev
```

The app runs at http://localhost:5173.
