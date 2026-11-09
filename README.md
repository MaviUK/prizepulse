# PrizePulse (v0.1)

Independent mobile-first prize draw price monitor for [thatprizeguy.co.uk](https://thatprizeguy.co.uk). Not affiliated with the operator. No ticket sales or gambling transactions.

## Current status

**Deployed to Netlify with a scheduled monitor every minute.** The public dashboard no longer falls back to example prices. A collection is only labelled live after the source robots policy is checked and at least two real public competitions are parsed. A first visit can trigger an initial check at most once per 30-minute slot. If access is denied, collection halts and retains the last verified snapshot. Actual successful upstream access must be confirmed from Netlify logs and `/api/competitions` before announcing live tracking.

## Features

- Responsive desktop/Android dashboard, installable PWA
- Filter, search, sort, advertised reductions versus independently observed reductions
- Single-winner cash-alternative **full-allocation** value comparison; unknown / multi-winner / variable / instant-win draws are not given a fabricated score
- Saved watchlist in browser localStorage and drop indication when the app opens or refreshes (no background push/email notifications yet)
- Historical chart once the monitor has captured multiple snapshots
- JSON snapshot import for local review; imported files remain on the device
- Netlify Scheduled Function, rate-limited first-visit bootstrap, `/api/competitions` and site-wide Netlify Blobs for public snapshots
- Feed health with latest attempt, explicit source errors, stale snapshot warnings and no live label for examples
- Separate GitHub Actions source-access probe (`scripts/probe-source.mjs`)
- Polite crawl policy: fetch robots.txt, do not bypass login/rate limits, fail closed on restrictions

## Run locally

Use any static HTTP server pointed at `public/`. The Netlify build runs `npm run build` to copy the shared comparison logic into the published assets. Example from this folder: `python3 -m http.server 8080 --directory public`. Open `http://localhost:8080`. The Netlify API will be absent, so the production dashboard reports that no verified live data is available. Example JSON can still be imported manually for testing. For Netlify local functions install dependencies (`npm install`) and run `npx netlify dev` with Netlify CLI if available.

## Deploy to Netlify

1. Create a **separate GitHub repository**; do not put this code in your existing NI Bin Guy, Klean.ly or other live projects.
2. Connect the new repository to a new Netlify site. `netlify.toml` sets `public` as publish directory and `netlify/functions` as functions. Use a modern Node runtime (20 or later).
3. Let Netlify install the pinned Node dependencies and run the configured `npm run build`; commit a generated `package-lock.json` when the repository is created.
4. In Netlify, inspect scheduled function `monitor` logs, the `prizepulse-public-v1` blob store and the `/api/competitions` response. The function checks the operator's public robots policy before crawling; if it is inaccessible or disallowed, the monitor stops without overwriting historical data. Do not try to evade rate limits, anti-bot protections, or the operator's terms.
5. Validate the parser against **actual** source HTML. A live update is marked successful only after valid prices and URLs are parsed. Maximum-entry counts are enriched gradually and left unranked until verified.
6. Data collection is once per minute when source access is permitted (blocked requests remain paused), not continuous. A fresh price could change before the next check.

> The app uses Netlify Blobs rather than creating an unapproved Supabase project; the public monitoring history is a cache-like record with a single scheduled writer. Per-user watchlists remain local. Move to Supabase/Netlify DB for registered users, push subscriptions, audit/event history or transactional alerts.

## Import format

Click **Import snapshot** to load JSON shaped like:

```json
{
  "checkedAt":"2026-11-08T20:00:00Z",
  "items":[{
    "title":"Amsterdam Trip for 2 + £500 Cash",
    "url":"https://thatprizeguy.co.uk/competitions/amsterdam-for-2-ps500-cash-or-ps1250-cash-alt-2-7589",
    "category":"Experiences","pricePence":99,
    "cashAlternativePence":125000,"maxEntries":5000,
    "entriesSold":1095,"soldPercent":22
  }]
}
```

Values are integers in **pence**, not pounds. The browser rejects non-operator URLs and invalid prices.

## Mathematical limits

For a conventional single-winner cash prize, illustrative full-allocation prize value per entry is cash prize / maximum ticket count. The gross value ratio is that number divided by the price of one ticket. This **does not** predict the closing ticket count or odds and may not incorporate postal/free entries, bundle discounts, cashback, variable-prize or multi-win mechanics. Never describe a mathematical comparison as guaranteed profit.

## Browser-assisted public listings (no official API)

- Use `https://pulseprize.netlify.app/collector-setup.html` on Android, install Firefox and Violentmonkey, then install `/collector.user.js`.
- A private pairing key must be set only in the extension; on Netlify set `PRIZEPULSE_COLLECTOR_KEY` as a secret variable scoped to Functions. Do not commit the key to Git or paste it in a public URL.
- Open `https://thatprizeguy.co.uk/categories/all` normally and tap Pair key, then Start 1 min. The script reads only DOM-visible **public competition cards**, sends only price, title, official link, sold percentage, etc, and can reload the visible page approximately once per minute while enabled.
- `/api/browser-feed` validates the key, domain, page freshness, and 2+ valid competition records before saving a **separate** `browser-latest` snapshot. Previous known prices are compared to record genuine movements. The API chooses the newest saved source and displays browser captures as **LIVE BROWSER CAPTURE** with an explicit disclosure; after 3 minutes it is labelled stale.
- This is **not** background 24/7 collection: Android may throttle or suspend the tab, the official site may change layout, and source access policies must be observed. Do not use VPN, proxy rotation, CAPTCHA bypass, or private APIs to evade blocks. Browser data is user-supplied and cannot be independently vouched for by PrizePulse.
- Do not place credentials in a userscript distributed from the public repository. The pairing key is stored only in the browser extension's settings. The collector never reads account pages, tickets, cookies, or payment data.

## Next phase

- Verify current Netlify collector results against the operator site or obtain an official/licensed data feed. Do not attempt to circumvent access restrictions.
- Add explicit email opt-in with double confirmation and transactional email provider; add web push with VAPID subscriptions, unsubscribe and user privacy controls.
- Keep price history beyond the most recent 240 readings and expose downloadable history.
- Verify site source permission / rate limits before enabling a live background collector.

© 2026 PrizePulse. Adults 18+. Play responsibly. This is not an official service.