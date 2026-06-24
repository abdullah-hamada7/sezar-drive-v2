---
name: Sezar Driver
description: Field-first driver app — high-contrast dark UI optimized for vehicle and outdoor use
colors:
  primary: "#6366F1"
  primary-deep: "#4F46E5"
  background: "#0F172A"
  surface: "#1E293B"
  surface-border: "#334155"
  ink: "#F8FAFC"
  ink-muted: "#94A3B8"
  success: "#10B981"
  warning: "#F59E0B"
  danger: "#EF4444"
  light-background: "#F8FAFC"
  light-surface: "#FFFFFF"
  light-ink: "#0F172A"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  caption:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "36px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "14px 20px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "14px 20px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
---

## Overview

Sezar Driver uses Material 3 with a **field-first dark theme** as the default working mode. Typography is single-family (Inter via Google Fonts) with a tight product scale (24 / 20 / 16 / 14). Layout follows bottom navigation for high-frequency tasks (Home, Trips, Shift, Expenses, Inspection) and a drawer for secondary flows (damage, violations, notifications, offline queue, settings).

Spacing rhythm: 4 → 8 → 16 → 24 → 36. Cards group trip/shift content; avoid nested cards. Primary actions use filled buttons; destructive actions use danger red with explicit confirmation dialogs.

Motion stays functional (150–250ms state feedback). No page-load choreography. Respect reduced motion.

## Colors

| Role | Dark | Light | Usage |
|------|------|-------|--------|
| Primary | `#6366F1` | `#6366F1` | Primary actions, focus rings, active nav |
| Surface | `#1E293B` | `#FFFFFF` | Cards, sheets, inputs |
| Background | `#0F172A` | `#F8FAFC` | Scaffold |
| Ink | `#F8FAFC` | `#0F172A` | Headings, body |
| Muted | `#94A3B8` | `#64748B` | Secondary labels, hints |
| Success | `#10B981` | `#10B981` | Verified, completed, synced |
| Warning | `#F59E0B` | `#F59E0B` | Offline cache, pending review |
| Danger | `#EF4444` | `#EF4444` | Errors, damage lock, logout |

Semantic colors must come from `AppTheme` tokens — never ad-hoc `Colors.green` for success on one screen and `Colors.indigo` on another.

## Typography

- **Display (24px bold)**: Screen titles in cards, shift hero states
- **Headline (20px bold)**: Section headers, drawer title
- **Body (16px)**: Primary content, button labels
- **Caption (14px)**: Hints, metadata, status chips

Body line length is unconstrained in mobile lists; keep chip and banner copy short. Arabic uses the same scale with RTL mirroring via Flutter localization delegates.

## Elevation

Prefer **flat surfaces with 1px borders** (`#334155` on dark) over soft drop shadows. Card elevation: 0–2 max. Do not combine heavy shadow + border on the same component (ghost-card anti-pattern).

Login logo: solid surface circle, no glow blur. Overlays (privacy screen, modals): solid scrim or high-opacity brand fill, not glass blur stacks.

## Components

- **NavigationBar**: 5 primary destinations; badge counts on trips, shift, expenses, inspection
- **Drawer**: Secondary routes + theme/locale toggles + logout (danger styling)
- **MaterialBanner**: Offline/sync status below app bar region — orange (pending) / red (offline)
- **Cards**: 16px radius, 16px padding, single border OR minimal elevation
- **Inputs**: Filled, 12px radius, 2px primary focus border
- **Status chips**: Semantic background at ~20% opacity + solid foreground text
- **Feedback**: Fleet spec prefers top-right toast (5s auto-dismiss); migrate from bottom SnackBar over time
- **Loading**: Prefer skeleton placeholders for list screens; spinner only for initial auth gate and button submit states

## Do's and Don'ts

**Do**
- Use `Theme.of(context).colorScheme` and `AppTheme` semantic constants
- Pair color with icon + label for trip/shift/verification state
- Keep primary tap targets ≥48dp
- Localize all user-visible strings (EN + AR)

**Don't**
- Hardcode `Colors.indigo`, `Color(0xFF1E293B)`, etc. in feature screens
- Use decorative glow shadows on logos or buttons
- Show spinners alone on full list pages when skeleton layout is known
- Mix SnackBar (bottom) and undocumented feedback patterns without a shared helper
- Use modals when inline confirmation or banner suffices
