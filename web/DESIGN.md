# SharedMoney Landing Page Design Guide

This document is the canonical reference for the landing-page redesign.

## Positioning
- Tone: warm, practical, mature consumer-finance brand.
- Audience: people coordinating shared costs across trips, roommates, and friend groups.
- Promise: clear balances, predictable settlement outcomes, and explicit payment boundaries.

## Core Copy
- H1: `SharedMoney`
- Tagline: `Split the trip. Settle up. One shared record for group money.`
- Trust line: `No bank link. No payments. Web + mobile.`
- Search intent focus: shared expense tracker, split expenses, group balances, settle up.
- Google OAuth branding: keep `SharedMoney` as the visible first-viewport app
  identity so Google Auth Platform brand verification can match the configured
  OAuth app name to the public application home page.

## Primary Conversion
- Android visitors: `Get the Android app`
- iOS visitors: `Get the iOS app` (App Store)
- Desktop visitors: Android is primary.
- Secondary actions: remaining two destinations (`Open web app`, other platform action).
- Hero store row: Google Play badge + App Store text link (`Download on the App Store` → `https://apps.apple.com/app/id6755923591`).
- CTA event: `seo cta clicked` with `{ platform, placement, device, page_path }`.

## Visual System
- Identity: `Electric Pocket`, a vivid action-blue launcher tile with a white wallet
  holding coral and green money slips.
- The mark must read as money coordination at favicon size and Android launcher
  size. Do not use routing paths, transfer arrows, abstract nodes, or line diagrams
  as the primary brand metaphor.
- Palette
  - Canvas `#F7F9FC`
  - Ink `#17202A`
  - Action blue `#1F5EFF`
  - Berry `#C95872`
  - Sea `#00866E`
- 4px spacing and 4/8px radii.
- Font: `Instrument Sans Variable`, loaded through `@fontsource-variable`.
- Content width: `1180px`.
- Dark mode is supported with equivalent contrast treatment.

## Layout Rules
1. Sticky compact nav with Product / How it works / Trust + primary `Get app` CTA.
2. Hero: short claim, primary action, tiny trust pills, and one current product screenshot.
3. Proof strip: Add / See / Settle.
4. 3-step workflow: Add / See / Settle.
5. Trust section: data storage boundaries, payment handling boundary.
6. Short FAQ + focused install + legal/support footer.

## Asset Rules
- Product screens use `avif`, `webp`, and `png` fallbacks.
- Use `<picture>` for responsive image selection.
- Hero image is preloaded for first paint.
- Product screenshots remain genuine. Supporting social context may be composed from
  typography, initials, color, and semantic UI elements, without stock photography.

## Non-goals
- No testimonials, no fabricated ratings or metrics, no oversized logo walls, no stock photography.
- No decorative blobs, gradients as brand treatment, or hidden content/animated reveal sections.
- No handwritten annotations or ornamental underlines. Warmth comes from people, group
  names, shared moments, and activity rather than casual type effects.
