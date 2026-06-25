---
name: Sezar Driver
description: Field-first driver app — zinc ops surfaces + fleet signal red (brand mark)
colors:
  primary: "#EF4444"
  primary-deep: "#DC2626"
  button-primary: "#B91C1C"
  background: "#09090B"
  surface: "#131316"
  surface-elevated: "#1C1C21"
  surface-border: "#2E2E36"
  ink: "#FAFAFA"
  ink-muted: "#A1A1AA"
  success: "#22C55E"
  warning: "#F59E0B"
  danger: "#EF4444"
  light-background: "#F4F4F5"
  light-surface: "#FFFFFF"
  light-ink: "#18181B"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  caption:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
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
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "14px 20px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "14px 20px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
---

## Overview

Sezar Driver uses Material 3 with a **field-first dark theme** aligned to the official Sezar Drive fleet mark (red bus icon on zinc). Typography is **Plus Jakarta Sans** — one family, product scale 24 / 20 / 16 / 14. Default working mode is dark zinc (`#09090B`), not blue-slate SaaS.

Brand assets live at `assets/brand/sezar-drive-icon.svg` (same mark as admin PWA). Use `SezarBrandMark` / `SezarBrandLockup` — never generic taxi icons or unrelated indigo palettes.

## Colors

| Role | Dark | Light | Usage |
|------|------|-------|--------|
| Primary | `#EF4444` | `#EF4444` | Primary actions, active nav, brand accent |
| Surface | `#131316` | `#FFFFFF` | Cards, sheets, nav bar |
| Surface elevated | `#1C1C21` | `#F4F4F5` | Profile card, drawer header |
| Background | `#09090B` | `#F4F4F5` | Scaffold |
| Ink | `#FAFAFA` | `#18181B` | Headings, body |
| Muted | `#A1A1AA` | `#71717A` | Secondary labels, hints |
| Success | `#22C55E` | `#22C55E` | Active shift, completed, synced |
| Warning | `#F59E0B` | `#F59E0B` | Pending verification, offline cache |
| Danger | `#EF4444` | `#EF4444` | Errors, logout (same hue as brand — pair with icon + label) |

Semantic colors must come from `AppTheme` / `AppSemanticColors` — never ad-hoc `Colors.indigo` or ride-hail gradients.

## Typography

- **Display (24px bold)**: Screen titles in cards, shift hero states
- **Headline (20px bold)**: Section headers, drawer title
- **Body (16px)**: Primary content, button labels
- **Caption (14px)**: Hints, metadata, status chips

Arabic uses the same scale with RTL mirroring via Flutter localization delegates.

## Elevation

**Flat surfaces + 1px borders** (`#2E2E36` on dark). No ghost-card pattern (border + wide shadow). Card radius max **16px**. Login form uses bordered surface panel — no glass blur.

## Components

- **SezarBrandMark / SezarBrandLockup**: Official SVG mark + wordmark
- **FleetAppBar**: Brand mark + screen title + “Sezar Drive” micro-label
- **FleetDrawerHeader**: Elevated surface header with mark (not solid red block)
- **NavigationBar**: 68px height, red selection indicator tint
- **MaterialBanner**: Offline/sync — orange / red semantic fills
- **EmptyStatePanel**: Icon in tinted brand container, not bare gray glyph
- **Feedback**: Top-right toast (5s auto-dismiss)

## Do's and Don'ts

**Do**
- Use the red fleet mark from `assets/brand/`
- Pair color with icon + label for state
- Keep tap targets ≥48dp
- Localize EN + AR

**Don't**
- Use `Icons.local_taxi` or generic indigo `#6366F1`
- Use side-stripe card accents or gradient text
- Use decorative glow on logos or buttons
- Use uppercase tracked eyebrows on every section
