# PlayStation Wishlist Filter

Adds a filter panel to `library.playstation.com` wishlist pages: search by title, filter by price range (RM), filter by platform (PS5/PS4/PS3/Other), and hide unpriced ("Announced") items.

## Install (Edge or Chrome — both Chromium-based)

1. Unzip `ps-wishlist-filter.zip` somewhere permanent (don't delete the folder after installing — the browser loads it live from there).
2. Edge: go to `edge://extensions`. Chrome: go to `chrome://extensions`.
3. Turn on **Developer mode** (toggle, usually top-right).
4. Click **Load unpacked** and select the unzipped `ps-wishlist-filter` folder.
5. Open your PlayStation wishlist. A "Filter Wishlist" button appears top-right — click it to open the panel.

## Notes

- The extension detects wishlist entries by scanning for repeated card-like elements rather than hardcoded class names, since Sony changes its page markup often. If a future redesign breaks detection, the panel will just show 0 matches — let me know and I can adjust the selector logic.
- Everything runs locally in your browser; no data leaves the page.
# ps-wishlist-filter
