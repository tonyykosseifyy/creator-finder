# WavyTalk Creator Finder

The team's review app for the creator finder. It is a static React site (Vite). All data lives in the
Google Sheet, and the Google Apps Script web app is the backend: every screen calls it with a plain POST.

- **Instagram** and **TikTok**: the creators waiting in Candidates, one page per platform, with waiting counts in the menu. Shortlist (adds them to Creators) or mark not a fit; every decision can be undone for 6 seconds.
  Keys: J / K to move, S to shortlist, X for not a fit.
- **Brands**: brands creators work with; local ones are scanned automatically.
- **Control**: daily run switch, seeds, settings, Apify spend and the run log.

## Access

The site holds no secrets. Open it once with the team link (`?k=<access key>`); the key is kept in that
browser. A wrong or changed key sends you back to the sign-in screen. To change the key, delete `APP_KEY`
in the Apps Script project's Script properties, run `appLink`, and share the new key.

## Develop

```
npm install
npm run dev      # local preview
npm run build    # output in dist/
```

The backend URL is in `src/api.js`. Hosting: Vercel, building from this repo on every push to `master`.

## Sheets page

`#/sheets/<tab>` shows Creators, Candidates, Keywords, Seeds, Network and Run log straight from the Google Sheet. Columns the finder fills stay read-only; Creators outreach columns, Keywords and Seeds are editable, Keywords and Seeds rows can be added, and Keywords, Seeds and Network rows can be deleted (not while a run is in progress).
