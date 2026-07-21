# PlayStation Wishlist Filter

A browser extension that adds filtering, sorting, and CSV export to your PlayStation Store wishlist (`library.playstation.com/wishlist`). Works in Edge and Chrome (both Chromium-based).

## Features

Click the funnel icon in the top-right corner of the wishlist page to open the panel.

**Sort by**
- Default (original wishlist order)
- Price: low to high / high to low
- Biggest discount first
- Title: A to Z / Z to A

**Search** — filter by title as you type.

**Price range (RM)** — set a min and/or max.

**Platform** — show/hide PS5, PS4, or Other.

**Sales**
- "On sale only" — show only discounted items
- "Min discount %" — e.g. set 50 to only show items 50% off or more (turning this on also enables "On sale only")

**Hide items with no price** — hides entries like "Announced" titles with no listed price.

**Export CSV** — downloads whatever's currently visible (after your filters/sort) as a `.csv` file with title, platform, price, original price, discount %, and a link to the store page.

**Reset filters** — clears everything back to default.

The item counter ("Showing X of Y") updates live as you adjust filters.

## Install (Edge or Chrome)

1. Unzip this folder somewhere permanent — don't delete or move it after installing, the browser loads the extension live from this location.
2. Edge: go to `edge://extensions`. Chrome: go to `chrome://extensions`.
3. Turn on **Developer mode** (toggle, usually top-right).
4. Click **Load unpacked** and select this folder.
5. Open your PlayStation wishlist. A round filter icon appears top-right — click it to open the panel.

## Updating after a change

If any of the files here get updated:
1. Replace the changed file(s) in this folder.
2. Go to `edge://extensions` (or `chrome://extensions`), find the extension, and click its reload icon.
3. Refresh the wishlist page.

## How it works / limitations

- PlayStation's wishlist page is a React app, so the extension avoids moving DOM nodes directly (React undoes that on the next re-render) — sorting instead sets the CSS `order` property on each item, which survives re-renders.
- Each wishlist entry is detected via `data-qa="wishlist-list-item-<n>-tile"`, which is how Sony currently tags each card. If Sony redesigns the page and changes this markup, the panel may show 0 matches until the selector logic is updated.
- Sale detection looks for either a struck-through "was" price or a "-X%" badge in each card. If PlayStation changes how discounts are displayed, discount-related filters/sort may need retuning.
- Everything runs locally in your browser. No data is sent anywhere — the CSV export happens entirely client-side.

## Files

- `manifest.json` — extension config (Manifest V3)
- `content.js` — all the filter/sort/export logic
- `content.css` — styling for the panel and toggle button
