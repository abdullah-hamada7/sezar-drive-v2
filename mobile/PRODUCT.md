# Product

## Register

product

## Users

Fleet drivers for Sezar Drive — professional operators working from phones in vehicles, often outdoors in bright or uneven light, sometimes on unreliable connectivity. Primary languages: English and Arabic (RTL). Sessions are task-heavy and time-sensitive: start shift, verify identity, scan vehicle QR, run trips, log expenses, report damage.

## Product Purpose

The Sezar Driver mobile app is the field execution layer for the fleet platform. Drivers authenticate, complete shift verification (face match, QR, inspection), manage assigned trips through the state machine, log expenses and damage, and stay synced when offline. Success means a driver can complete a full shift without admin intervention, with clear status at every step and zero ambiguity about what action is required next.

## Brand Personality

**Reliable · Direct · Field-ready**

The app should feel like professional equipment, not a consumer ride-hail app. Calm under pressure, high legibility, no decorative chrome. Confidence comes from clarity — state, errors, and next steps are obvious at a glance.

## Anti-references

- Generic ride-hail UI (map-first hero, playful gradients, casual copy)
- SaaS cream/warm-neutral dashboards transplanted to mobile
- Glassmorphism, glow logos, and decorative shadows on functional controls
- Bottom snackbars that hide navigation during critical shift flows (prefer consistent, dismissible feedback that matches fleet UX spec)
- Inconsistent button colors per screen (green accept here, indigo there without semantic meaning)
- English-only hardcoded strings in a bilingual product

## Design Principles

1. **Task before chrome** — Every screen answers “what do I do now?” before showing secondary data.
2. **Outdoor legibility** — Contrast and type size prioritize readability in vehicle cab and daylight; dark mode is the default working surface.
3. **State is visible** — Shift, trip, sync, and verification status use a shared semantic vocabulary (success, warning, danger, info), not one-off colors.
4. **Offline honesty** — When cached or queued, the UI says so immediately; never silently show stale data as live.
5. **Evolve for drivers, not pixel-match admin** — Mobile may diverge from the web admin palette when driver context demands it (contrast, touch, glanceability).

## Accessibility & Inclusion

- Target **WCAG 2.1 AA** for text contrast (≥4.5:1 body, ≥3:1 large text) on both dark and light themes.
- Full **RTL** support for Arabic; no LTR-only overlays that break reading order.
- **Reduced motion**: respect `MediaQuery.disableAnimations` / platform reduced-motion for non-essential transitions.
- **Touch targets** ≥48dp for primary actions (shift start, trip accept, QR scan).
- Color is never the sole indicator of state — pair with icon, label, or pattern.
