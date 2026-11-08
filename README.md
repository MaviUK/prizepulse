# PrizePulse (v0.1)

Independent mobile-first prize draw price monitor for [thatprizeguy.co.uk](https://thatprizeguy.co.uk). Not affiliated with the operator. No ticket sales or gambling transactions.

## Current status

**Built and locally testable; not deployed or collecting automatically yet.** The default browser preview uses a clearly labelled public-information sample assembled from 8 November 2026. Snapshot dates, sold percentages, and current prices in the sample are historical examples and were not necessarily captured simultaneously. The production monitor is designed to poll once every 30 minutes after Netlify deploy, subject to permitted public access and successful source parsing. The parser has unit tests but **has not been validated against the operator's raw live HTML** because the build environment could not reach the domain. Nothing should be described as live until its first successful Netlify run.

## Features

- Responsive desktop/Android dashboard, installable PWA
- Filter, search, sort, advertised reductions versus independently observed reductions
- Single-winner cash-alternative **full-allocation** value comparison; unknown / multi-winner / variable / instant-win draws are not given a fabricated score
- Saved watchlist in browser localStorage and drop indication when the app opens or refreshes (no background push/email notifications yet)
- Historical chart once the monitor has captured multiple snapshots
- JSON snapshot import for local review; imported files remain on the device
- Netlify Scheduled Function, `/api/competitions` and site-wide Netlify Blobs for public snapshots
- Polite crawl policy: fetch robots.txt, do not bypass login/rate limits, fail closed on restrictions

## Run locally

Use any static HTTP server pointed at `public/`. The Netlify build runs `npm run build` to copy the shared comparison logic into the published assets. Example from this folder: `python3 -m http.server 8080 --directory public`. Open `http://localhost:8080`. The Netlify API will be absent, so the interface uses labelled sample data. For Netlify local functions install dependencies (`npm install`) and run `npx netlify dev` with Netlify CLI if available.

## Deploy to Netlify

1. Create a **separate GitHub repository**; do not put this code in your existing NI Bin Guy, Klean.ly or other live projects.
2. Connect the new repository to a new Netlify site. `netlify.toml` sets `public` as publish directory and `netlify/functions` as functions. Use a modern Node runtime (20 or later).
3. Let Netlify install the pinned Node dependencies and run the configured `npm run build`; commit a generated `package-lock.json` when the repository is created.
4. In Netlify, inspect scheduled function `monitor` logs, the `prizepulse-public-v1` blob store and the `/api/competitions` response. The function checks the operator's public robots policy before crawling; if it is inaccessible or disallowed, the monitor stops without overwriting historical data. Do not try to evade rate limits, anti-bot protections, or the operator's terms.
5. Validate the parser against **actual** source HTML. The first live update should only be marked successful after valid prices / URLs / caps are verified against the operator site.
6. Data collection is 30-minute interval, not continuous. A fresh price could change before the next check.

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

## Next phase

- Verify collector against real HTML or obtain an official/licensed data feed.
- Add explicit email opt-in with double confirmation and transactional email provider; add web push with VAPID subscriptions, unsubscribe and user privacy controls.
- Keep price history beyond the most recent 240 readings and expose downloadable history.
- Verify site source permission / rate limits before enabling a live background collector.

© 2026 PrizePulse. Adults 18+. Play responsibly. This is not an official service.