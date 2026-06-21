# Dashboard

Arabic-first (RTL) React dashboard for the SaaS WooCommerce operations platform.

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS v3 + shadcn/ui (CSS-variable theming)
- React Router v6
- React Hook Form + Zod (auth form validation)
- Radix UI primitives + `DirectionProvider` (RTL)
- Cairo Arabic font, class-based light/dark mode

## Scripts

```bash
npm install       # install dependencies
npm run dev       # start dev server at http://localhost:5173
npm run build     # type-check + production build
npm run lint      # eslint
npm run format    # prettier --write
```

## Structure

```txt
src/
  components/
    ui/        shadcn/ui primitives
    layout/    AppLayout, Sidebar, Topbar, MobileSidebar, AuthLayout
    shared/    PageHeader, StatsCard, DataTable, EmptyState, LoadingState,
               ErrorState, ConfirmDialog, StatusBadge, SearchInput, FilterBar
    theme/     ThemeProvider, ThemeToggle
  pages/
    auth/      Login, Register, ForgotPassword, ResetPassword
    DashboardPage, PlaceholderPage, NotFoundPage
  routes/      AppRoutes
  lib/         utils (cn), navigation (Arabic nav config)
```

## Notes

- RTL is the default (`dir="rtl"`, `lang="ar"` on `<html>`).
- Auth pages are UI-only in Phase 1; backend integration arrives in Phase 3.
- Sidebar routes other than `/dashboard` render a placeholder until their phase ships.
- `.env.example` documents `VITE_API_URL`, used from Phase 3 onward.
