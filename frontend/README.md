# Sezar Drive — Frontend (Admin + Driver PWA)

**Stack:** React 19 · Vite 6 · React Router 7 · i18next (EN/AR)  
**Roles:** Admin dashboard + driver mobile-first PWA  

Web client for fleet administrators and drivers who use the browser instead of the native Flutter app.

---

## Architecture Overview

```text
frontend/src/
├── pages/
│   ├── admin/          # Dashboard, drivers, trips, vehicles, violations, …
│   └── driver/         # Driver home, shift, trips, expenses, notifications
├── hooks/
│   ├── useDriverTracking.js    # WebSocket + GPS + alert toasts
│   ├── usePushNotifications.js # Web Push (VAPID) subscription
│   ├── useNotificationBadge.js # Notification inbox badge
│   └── useDriverBadges.js      # Tab badge counts
├── services/           # HTTP wrappers per domain
└── layouts/            # AdminLayout, DriverLayout
```

**API base:** `/api/v1` (proxied in dev; same origin in production via Caddy)

---

## Requirements

- Node.js 20+
- Backend running (local Docker or remote)

---

## Local Development

```bash
cd frontend
npm install
npm run dev
```

Default Vite dev server proxies API requests to the backend (see `vite.config.js`).

### Environment

Production builds expect the API at the same host under `/api/v1`. For local backend:

```bash
# Ensure backend is reachable at localhost:3000 (docker compose up)
npm run dev
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production bundle → `dist/` |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run test:e2e:headed` | Playwright with browser UI |

---

## Driver Features (PWA)

| Feature | Implementation |
|---------|----------------|
| Real-time alerts | `useDriverTracking` — WebSocket + sound + OS notification |
| Push (background) | `usePushNotifications` — VAPID via `POST /push/subscribe` |
| Notification inbox | `DriverNotifications.jsx` + `useNotificationBadge` |
| Tab badges | `useDriverBadges` — `/drivers/badge-counts` |
| Offline-aware | Read cache patterns in services (mirrors mobile strategy) |

Alert event types must match backend `driverAlert.service.js`. See [../docs/09-driver-alerts-and-notifications.md](../docs/09-driver-alerts-and-notifications.md).

---

## Admin Features

- Driver provisioning, trip dispatch, vehicle management
- Traffic violation entry (triggers driver push alert)
- Expense / damage review (triggers driver alerts)
- Live fleet map via WebSocket tracking
- PDF/Excel report export

---

## Internationalization

- English and Arabic (RTL)
- Strings via i18next; admin and driver namespaces separated
- Lucide React icons (per platform spec: `Car` icon for branding consistency)

---

## Production Build

```bash
npm run build
```

Static assets are served by Caddy from `dist/` on the EC2 instance (see [../docs/07-deployment-guide.md](../docs/07-deployment-guide.md)).

---

## Related Documentation

| Doc | Topic |
|-----|-------|
| [../docs/06-api-specification.md](../docs/06-api-specification.md) | REST API |
| [../docs/03-architecture.md](../docs/03-architecture.md) | System architecture |
| [../docs/09-driver-alerts-and-notifications.md](../docs/09-driver-alerts-and-notifications.md) | Push & WebSocket |
| [../mobile/README.md](../mobile/README.md) | Native Flutter driver app |

---

## Change Log

| Date | Change |
|------|--------|
| 2026-06-25 | Replaced Vite template README with project-specific documentation |
