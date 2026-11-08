# HANDOVER — 2026-11-08 mobile scroll & header fixes

Branch `fix/mobile-header-scroll`, single scoped change set in `src/components/Dashboard.tsx`.

## What Martin asked for (WhatsApp, 8 Nov 2026)

1. Mobile week selector (W9 row) should scroll away instead of staying pinned.
2. Keep the brand (NFL Command logo) plus sound and refresh controls frozen while scrolling.
3. Tapping the logo should take you back to the top of the page and refresh.
4. Investigate why Chrome on Android never hides the URL bar on scroll.

## What changed

- **Mobile week nav moved out of the sticky `<header>`** into normal flow between header and `<main>`, so it scrolls away with the page. The desktop week selector is unchanged (still inline in the sticky header at `sm` and up).
- **Sticky header now keeps only the brand bar**: logo, sound toggle, refresh (plus desktop-only controls). Unchanged mechanism (`sticky top-0 z-50`).
- **Logo is now a real `<button>` inside the `<h1>`**: tap scrolls to top (`smooth`, or `auto` when the OS requests reduced motion) and triggers the same guarded manual refresh as the Refresh button. If a refresh is already in flight it only scrolls, so the two controls never stack duplicate requests. Screen-reader announcement on activation; 44px touch target; focus ring preserved.

## URL bar investigation (no code change possible)

Measured the live page (8 Nov): the document scrolls at the root (`document.scrollingElement` = HTML, no inner scroll containers, no overflow/height locks on html/body/#root, no touch/wheel handlers). Those are the only app-side conditions that can block Chrome Android's toolbar auto-hide, and the app passes all of them. The URL bar is controlled by Chrome itself and cannot be forced from a page. If it still never hides for Martin while other sites hide it on the same phone, the difference is in his Chrome (there are public reports of Chrome 136+/Android 15 breaking toolbar auto-hide), not in this app.

## Verified before merge

- `npm run lint` (oxlint), full `npm test` suite, `tsc` + production `vite build` all pass.
- Live verification on production after deploy (mobile viewport): week bar scrolls away, brand row stays pinned, logo tap returns to top and refreshes.

## Watchouts

- The brand cluster is now a button: nested interactive markup must never be added inside it.
- If Martin still reports the URL bar not hiding, do not add layout hacks (100vh wrappers, scroll containers) — those make it worse. The remaining lever is a PWA manifest with `display: standalone` (installed from Add to Home screen), which has no URL bar at all. Not implemented; needs his go-ahead.
