(function () {
  'use strict';

  const STATE = {
    search: '',
    minPrice: '',
    maxPrice: '',
    hideNoPrice: false,
    onSaleOnly: false,
    minDiscount: '',
    sortBy: 'default',
    platforms: { PS5: true, PS4: true, OTHER: true }
  };

  let panelBuilt = false;
  let scanTimer = null;
  let observer = null;
  let orderCounter = 0;

  function onWishlistPage() {
    return location.href.includes('/wishlist');
  }

  // PlayStation tags every wishlist card with data-qa="wishlist-list-item-<n>-tile".
  // Sub-elements inside it use suffixes like "...-tile#title", so matching
  // attributes that end exactly in "-tile" isolates just the card roots.
  function findRows() {
    return Array.from(document.querySelectorAll('[data-qa$="-tile"].wishlist-tile'));
  }

  // Scan a container's text nodes for RM prices, noting whether each one is
  // struck through (<s>/<del>/<strike>, or CSS text-decoration: line-through) —
  // that's how a "was" price is marked when an item is discounted.
  function getPrices(container) {
    if (!container) return [];
    const priceRegex = /RM\s*([\d,]+\.\d{2})/gi;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const matches = [];
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent;
      if (!text || text.indexOf('RM') === -1) continue;
      priceRegex.lastIndex = 0;
      let m;
      while ((m = priceRegex.exec(text))) {
        const value = parseFloat(m[1].replace(/,/g, ''));
        let el = node.parentElement;
        let struck = false;
        for (let i = 0; el && i < 5; i++, el = el.parentElement) {
          const tag = el.tagName;
          if (tag === 'S' || tag === 'DEL' || tag === 'STRIKE') { struck = true; break; }
          const style = getComputedStyle(el);
          if (style && (style.textDecorationLine || style.textDecoration || '').includes('line-through')) {
            struck = true;
            break;
          }
        }
        matches.push({ value, struck });
      }
    }
    return matches;
  }

  function parseRow(row) {
    if (!row.dataset.pswOrder) row.dataset.pswOrder = String(orderCounter++);

    const titleEl = row.querySelector('[data-qa$="#title"]');
    const title = titleEl ? titleEl.textContent.trim() : (row.querySelector('img')?.alt || '').trim();

    const platformEls = row.querySelectorAll('[data-qa*="platform-tags#tag"]');
    let platform = 'OTHER';
    platformEls.forEach((el) => {
      const t = el.textContent.trim().toUpperCase();
      if (['PS5', 'PS4'].includes(t)) platform = t;
    });

    const priceContainer = row.querySelector('[data-qa$="#price"]') || row;
    const priceMatches = getPrices(priceContainer);
    const original = priceMatches.find((p) => p.struck);
    const current = priceMatches.find((p) => !p.struck) || priceMatches[0];
    const price = current ? current.value : null;

    const text = row.textContent || '';
    const pctBadge = text.match(/-\s*(\d{1,3})\s*%|(\d{1,3})\s*%\s*off/i);
    const badgePct = pctBadge ? parseInt(pctBadge[1] || pctBadge[2], 10) : null;

    let onSale = false;
    let discountPct = null;
    let originalPrice = original ? original.value : null;
    if (original && current && current.value < original.value) {
      onSale = true;
      discountPct = Math.round((1 - current.value / original.value) * 100);
    } else if (badgePct !== null) {
      onSale = true;
      discountPct = badgePct;
      if (originalPrice === null && price !== null) {
        originalPrice = Math.round((price / (1 - badgePct / 100)) * 100) / 100;
      }
    }

    const linkEl = row.querySelector('a[href*="/product/"]') || row.querySelector('a[href]');
    const url = linkEl ? linkEl.href.split('?')[0] : '';

    // Each tile sits alone inside its own <li> (siblingCount 1) — the <li>s
    // are the actual siblings under the shared list container, so that's
    // what needs to move/hide/reorder, not the tile div itself.
    const wrapper = row.closest('li') || row.parentElement || row;

    return {
      row,
      wrapper,
      price,
      originalPrice,
      platform,
      title,
      url,
      lower: (title + ' ' + text).toLowerCase(),
      onSale,
      discountPct,
      order: parseInt(row.dataset.pswOrder, 10)
    };
  }

  function csvEscape(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    return /[",\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
  }

  function exportVisibleToCSV() {
    const items = findRows().map(parseRow).filter((item) => item.wrapper.style.display !== 'none');

    const header = ['Title', 'Platform', 'Price (RM)', 'Original Price (RM)', 'Discount %', 'On Sale', 'Link'];
    const lines = [header.join(',')];

    items.forEach((item) => {
      lines.push([
        csvEscape(item.title),
        csvEscape(item.platform),
        csvEscape(item.price !== null ? item.price.toFixed(2) : ''),
        csvEscape(item.originalPrice !== null ? item.originalPrice.toFixed(2) : ''),
        csvEscape(item.onSale ? item.discountPct : ''),
        csvEscape(item.onSale ? 'Yes' : 'No'),
        csvEscape(item.url)
      ].join(','));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ps-wishlist-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function comparator(sortBy) {
    return (a, b) => {
      switch (sortBy) {
        case 'price-asc': {
          const pa = a.price === null ? Infinity : a.price;
          const pb = b.price === null ? Infinity : b.price;
          return pa - pb || a.order - b.order;
        }
        case 'price-desc': {
          const pa = a.price === null ? -Infinity : a.price;
          const pb = b.price === null ? -Infinity : b.price;
          return pb - pa || a.order - b.order;
        }
        case 'discount-desc': {
          const da = a.onSale ? (a.discountPct ?? 0) : -1;
          const db = b.onSale ? (b.discountPct ?? 0) : -1;
          return db - da || a.order - b.order;
        }
        case 'title-asc':
          return a.title.localeCompare(b.title) || a.order - b.order;
        case 'title-desc':
          return b.title.localeCompare(a.title) || a.order - b.order;
        default:
          return a.order - b.order;
      }
    };
  }

  // PlayStation's wishlist is a React app — physically moving DOM nodes
  // (appendChild) gets undone on the next re-render because React
  // reconciles children back to its own internal order. Setting the CSS
  // "order" property instead survives re-renders, since React never touches
  // a style property it didn't set itself, and doesn't require the parent's
  // childList to change (so it can't trigger our own MutationObserver either).
  function sortItems(items) {
    // Default: strip any order we previously set and let natural DOM order
    // take over again — this also puts non-game siblings (promo banners,
    // "Go to PS Store" links, etc.) back exactly where they started.
    if (STATE.sortBy === 'default') {
      items.forEach((item) => item.wrapper.style.removeProperty('order'));
      return;
    }

    const sorted = items.slice().sort(comparator(STATE.sortBy));
    const matchedWrappers = new Set(items.map((item) => item.wrapper));
    const seenParents = new Set();

    sorted.forEach((item, idx) => {
      item.wrapper.style.order = String(idx);

      const parent = item.wrapper.parentElement;
      if (parent && !seenParents.has(parent)) {
        seenParents.add(parent);
        const display = getComputedStyle(parent).display;
        if (display !== 'flex' && display !== 'inline-flex' && display !== 'grid' && display !== 'inline-grid') {
          parent.style.display = 'flex';
          parent.style.flexDirection = 'column';
        }
        // Anything under this parent that isn't one of our matched game
        // tiles (banners, promo CTAs, etc.) gets pushed to the very end
        // instead of landing in a random spot mid-list.
        Array.from(parent.children).forEach((child, i) => {
          if (!matchedWrappers.has(child)) {
            child.style.order = String(sorted.length + i + 1);
          }
        });
      }
    });
  }

  function applyFilters() {
    const rows = findRows();
    const items = rows.map(parseRow);
    let visible = 0;
    const total = items.length;

    items.forEach((item) => {
      let show = true;

      if (STATE.search && !item.lower.includes(STATE.search.toLowerCase())) show = false;

      if (show && item.price === null && STATE.hideNoPrice) show = false;

      if (show && item.price !== null && STATE.minPrice !== '' && item.price < parseFloat(STATE.minPrice)) {
        show = false;
      }

      if (show && item.price !== null && STATE.maxPrice !== '' && item.price > parseFloat(STATE.maxPrice)) {
        show = false;
      }

      if (show && STATE.onSaleOnly && !item.onSale) show = false;

      if (show && STATE.minDiscount !== '') {
        const minD = parseFloat(STATE.minDiscount);
        if (!item.onSale || item.discountPct === null || item.discountPct < minD) show = false;
      }

      if (show && !STATE.platforms[item.platform]) show = false;

      // Hide the <li> wrapper, not just the tile — otherwise the wrapper's
      // own margin/padding leaves a blank gap where the tile used to be.
      item.wrapper.style.display = show ? '' : 'none';
      if (show) visible++;
    });

    sortItems(items);

    const counter = document.getElementById('psw-count');
    if (counter) counter.textContent = `Showing ${visible} of ${total}`;
  }

  function debounceApply() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(applyFilters, 250);
  }

  function buildPanel() {
    if (panelBuilt) return;
    panelBuilt = true;

    const toggle = document.createElement('button');
    toggle.id = 'psw-filter-toggle';
    toggle.setAttribute('aria-label', 'Filter Wishlist');
    toggle.title = 'Filter Wishlist';
    toggle.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="3 4 21 4 14 13 14 20 10 20 10 13 3 4"></polygon>
      </svg>
    `;
    document.body.appendChild(toggle);

    const panel = document.createElement('div');
    panel.id = 'psw-filter-panel';
    panel.style.display = 'none';
    panel.innerHTML = `
      <h3>Filter Wishlist</h3>

      <label for="psw-sort">Sort by</label>
      <select id="psw-sort">
        <option value="default">Default (wishlist order)</option>
        <option value="price-asc">Price: low to high</option>
        <option value="price-desc">Price: high to low</option>
        <option value="discount-desc">Biggest discount first</option>
        <option value="title-asc">Title: A to Z</option>
        <option value="title-desc">Title: Z to A</option>
      </select>

      <label for="psw-search">Search title</label>
      <input type="text" id="psw-search" placeholder="e.g. Persona" />

      <label>Price range (RM)</label>
      <div class="psw-price-row">
        <input type="number" id="psw-min" placeholder="Min" min="0" />
        <input type="number" id="psw-max" placeholder="Max" min="0" />
      </div>

      <label>Platform</label>
      <div class="psw-platform-row">
        <label><input type="checkbox" id="psw-ps5" checked /> PS5</label>
        <label><input type="checkbox" id="psw-ps4" checked /> PS4</label>
        <label><input type="checkbox" id="psw-other" checked /> Other</label>
      </div>

      <label>Sales</label>
      <div class="psw-checkbox-row">
        <input type="checkbox" id="psw-onsale" />
        <label for="psw-onsale">On sale only</label>
      </div>
      <div class="psw-price-row" style="margin-top:6px;">
        <input type="number" id="psw-min-discount" placeholder="Min discount %" min="0" max="100" />
      </div>

      <div class="psw-checkbox-row" style="margin-top:10px;">
        <input type="checkbox" id="psw-hide-noprice" />
        <label for="psw-hide-noprice">Hide items with no price</label>
      </div>

      <div id="psw-count"></div>
      <button id="psw-export">Export CSV (visible items)</button>
      <button id="psw-reset">Reset filters</button>
    `;
    document.body.appendChild(panel);

    toggle.addEventListener('click', () => {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });

    panel.querySelector('#psw-sort').addEventListener('change', (e) => {
      STATE.sortBy = e.target.value;
      debounceApply();
    });
    panel.querySelector('#psw-search').addEventListener('input', (e) => {
      STATE.search = e.target.value;
      debounceApply();
    });
    panel.querySelector('#psw-min').addEventListener('input', (e) => {
      STATE.minPrice = e.target.value;
      debounceApply();
    });
    panel.querySelector('#psw-max').addEventListener('input', (e) => {
      STATE.maxPrice = e.target.value;
      debounceApply();
    });
    panel.querySelector('#psw-onsale').addEventListener('change', (e) => {
      STATE.onSaleOnly = e.target.checked;
      debounceApply();
    });
    panel.querySelector('#psw-min-discount').addEventListener('input', (e) => {
      STATE.minDiscount = e.target.value;
      if (e.target.value !== '') {
        STATE.onSaleOnly = true;
        panel.querySelector('#psw-onsale').checked = true;
      }
      debounceApply();
    });
    panel.querySelector('#psw-hide-noprice').addEventListener('change', (e) => {
      STATE.hideNoPrice = e.target.checked;
      debounceApply();
    });
    ['ps5', 'ps4', 'other'].forEach((key) => {
      panel.querySelector(`#psw-${key}`).addEventListener('change', (e) => {
        STATE.platforms[key.toUpperCase()] = e.target.checked;
        debounceApply();
      });
    });
    panel.querySelector('#psw-export').addEventListener('click', () => {
      exportVisibleToCSV();
    });
    panel.querySelector('#psw-reset').addEventListener('click', () => {
      STATE.search = '';
      STATE.minPrice = '';
      STATE.maxPrice = '';
      STATE.hideNoPrice = false;
      STATE.onSaleOnly = false;
      STATE.minDiscount = '';
      STATE.sortBy = 'default';
      STATE.platforms = { PS5: true, PS4: true, OTHER: true };
      panel.querySelector('#psw-search').value = '';
      panel.querySelector('#psw-min').value = '';
      panel.querySelector('#psw-max').value = '';
      panel.querySelector('#psw-hide-noprice').checked = false;
      panel.querySelector('#psw-onsale').checked = false;
      panel.querySelector('#psw-min-discount').value = '';
      panel.querySelector('#psw-sort').value = 'default';
      ['ps5', 'ps4', 'other'].forEach((key) => {
        panel.querySelector(`#psw-${key}`).checked = true;
      });
      debounceApply();
    });
  }

  function init() {
    if (!onWishlistPage()) return;
    buildPanel();
    debounceApply();

    if (!observer) {
      observer = new MutationObserver(debounceApply);
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  init();
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      init();
    }
  }, 1000);
})();