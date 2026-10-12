# Google Analytics 4 dashboard setup

The dashboard's **Analytics** tab reads traffic data from the official
**Google Analytics Data API** (and **Realtime Data API**) through one
serverless function, [`api/analytics.js`](api/analytics.js) — the only place
Google credentials are ever used. Nothing secret lives in any HTML/CSS/JS
file served to visitors, and the page never embeds, iframes, or scrapes the
Google Analytics website.

Until the environment variables below are set, the Analytics tab shows a
clean "Analytics isn't connected yet" message — no errors, no fake numbers.

## How it fits together

```
Dashboard "Analytics" tab ──▶ /api/analytics ──▶ Google Analytics Data API
  (staff member's session        (verifies the         (service account
   token, nothing else)           session, then          credentials)
                                   calls Google)
```

The dashboard authenticates to `/api/analytics` with the staff member's own
Supabase session token (the same login already used for the rest of the
dashboard) — there's no separate password or key to manage for this.

## 1. Create or select a Google Cloud project

In the [Google Cloud Console](https://console.cloud.google.com/), create a
new project (or pick an existing one you're comfortable using for this).

## 2. Enable the Google Analytics Data API

In that project, go to **APIs & Services → Library**, search for
**"Google Analytics Data API"**, and click **Enable**. (This single API
covers both the standard reporting calls and the Realtime report this
dashboard uses — there's nothing separate to enable for realtime.)

## 3. Create a service account

1. Go to **APIs & Services → Credentials → Create Credentials → Service
   account**.
2. Give it any name (e.g. `brhs-yearbook-analytics-reader`). No special
   project-level roles are needed — access is granted in GA4 itself, in the
   next step.
3. Once created, open the service account, go to the **Keys** tab, and
   **Add Key → Create new key → JSON**. This downloads a JSON file
   containing `client_email` and `private_key` — you'll need both for step
   5. Keep this file private; don't commit it anywhere.

## 4. Add the service-account email as a Viewer in the GA4 property

1. In [Google Analytics](https://analytics.google.com/), open the BRHS
   Yearbook GA4 property.
2. Go to **Admin → Property Access Management**.
3. Click **+ → Add users**, paste in the service account's email (the
   `client_email` value from the JSON file — it looks like
   `something@your-project.iam.gserviceaccount.com`), and give it the
   **Viewer** role. It doesn't need Editor or Admin — this dashboard only
   reads data.
4. While you're in GA4, note the **Property ID** (Admin → Property Details
   → Property ID, a number like `123456789`, not the "Measurement ID" that
   starts with `G-`) — that's `GA4_PROPERTY_ID` below.

## 5. Add the environment variables in Vercel

In the Vercel project (`brhs-yearbook-2026`) → **Settings → Environment
Variables**, add these three, scoped to **Production** (and Preview if you
want to test there too):

| Name | Value |
|---|---|
| `GA4_PROPERTY_ID` | the numeric Property ID from step 4 |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | the `client_email` from the JSON key file |
| `GOOGLE_PRIVATE_KEY` | the `private_key` from the JSON key file |

For `GOOGLE_PRIVATE_KEY`: paste the value exactly as it appears in the JSON
file, including the `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE
KEY-----` lines. Vercel's environment variable editor handles the embedded
newlines fine when you paste the whole multi-line value in; the function
also tolerates a version with literal `\n` escape sequences if that's what
ends up stored.

Redeploy (or wait for the next deploy) so the function picks up the new
variables.

## 6. Verify it works

- In the dashboard (`/dashboard` → **Analytics**), the "Analytics isn't
  connected yet" message should be replaced by real summary cards, a daily
  users chart, a realtime count, top cities, and top pages.
- Switch between **Last 7 Days / Last 30 Days / Last 90 Days / This School
  Year** to confirm the numbers change.
- Click **Refresh** to confirm it re-fetches (the "Last updated" time
  should update).

## Notes on behavior

- **"This school year"** is approximated as starting August 1st of the
  current (or most recent, if it's currently before August) calendar year —
  there's no separate school-year-boundary setting.
- **Historical data is cached for 5 minutes** per date range to keep the
  dashboard fast and avoid unnecessary Google API calls; the **realtime
  active-users count is never cached** and is fetched fresh every time.
- If a Google API call fails (expired/misconfigured credentials, API not
  enabled, service account not added as a Viewer, etc.), the tab shows a
  clear error message rather than fake or stale data.

## What this document intentionally does not include

This file never asks you to paste your private key back into chat, a
commit, or anywhere outside Vercel's own environment variable settings. The
private key should exist in exactly two places: the downloaded JSON file
(keep it somewhere private, or delete it once it's in Vercel) and Vercel's
environment variables.
