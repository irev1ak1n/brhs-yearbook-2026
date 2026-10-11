# Instagram "Latest from Instagram" setup

The homepage's "Latest from Instagram" section and the dashboard's **Refresh
Instagram** button are both powered by one serverless function,
[`api/instagram-sync.js`](api/instagram-sync.js), which is the *only* place
Instagram credentials or the Supabase service-role key are ever used. Nothing
secret lives in any HTML/CSS/JS file served to visitors.

Until the environment variables below are set, the homepage section simply
stays hidden — nothing is shown, no fake posts, no broken layout.

## How it fits together

```
Vercel Cron (weekly)  ──┐
                        ├──▶  /api/instagram-sync  ──▶  Instagram Graph API
Dashboard "Refresh" btn ┘            │                  (reads newest posts)
                                      ▼
                          Supabase `instagram_posts` table
                                      │
                                      ▼
                     Homepage reads it directly (public, read-only)
```

- The homepage **never calls Instagram**. It only reads the `instagram_posts`
  table in Supabase (public read-only — see the RLS policy on that table).
- The dashboard's Refresh button and the weekly cron job both call the same
  `/api/instagram-sync` endpoint; the endpoint authorizes the call either by
  a matching `CRON_SECRET` (for Vercel Cron) or a valid, currently-logged-in
  dashboard session token (for the manual button).

## 1. Create/confirm an Instagram Business or Creator account

The official Instagram Graph API (not the deprecated Basic Display API, and
not scraping) requires:

- An Instagram **Business** or **Creator** account (not a personal account).
- That Instagram account linked to a **Facebook Page**.
- A **Facebook App** in [Meta for Developers](https://developers.facebook.com/)
  with the **Instagram Graph API** product added.

## 2. Get the Instagram Business Account ID

1. In Graph API Explorer (or via a quick API call with a short-lived token),
   call `GET /me/accounts` to find the Facebook Page connected to the
   Instagram account.
2. Call `GET /{page-id}?fields=instagram_business_account` to get the
   Instagram Business Account's numeric ID.
3. This numeric ID is your **`INSTAGRAM_ACCOUNT_ID`**.

## 3. Get a long-lived access token

1. Generate a short-lived User or Page access token with the
   `instagram_basic` permission (and `pages_show_list` if needed) for the app
   from step 1.
2. Exchange it for a **long-lived token** (valid ~60 days) using:
   ```
   GET https://graph.facebook.com/v21.0/oauth/access_token
     ?grant_type=fb_exchange_token
     &client_id={app-id}
     &client_secret={app-secret}
     &fb_exchange_token={short-lived-token}
   ```
3. That long-lived token is your **`INSTAGRAM_ACCESS_TOKEN`**.
4. Long-lived tokens expire after ~60 days — refresh it periodically (Meta
   lets you refresh a still-valid long-lived token for another ~60 days via
   `GET /refresh_access_token`). If the token expires, the weekly sync will
   simply fail silently until it's replaced; existing posts stay visible
   since a failed sync never clears the table.

## 4. Get the Supabase service-role key

1. In the [Supabase dashboard](https://supabase.com/dashboard) for this
   project (`vbryqkibfrbpfszjjluq`), go to **Project Settings → API**.
2. Copy the **`service_role`** key (⚠️ this key bypasses Row Level Security —
   never put it in any client-side file, only in Vercel's environment
   variables).

## 5. Choose a cron secret

Pick any long random string yourself (e.g. generate one with
`openssl rand -hex 32`). This is **`CRON_SECRET`** — it's how
`/api/instagram-sync` recognizes a legitimate call from Vercel Cron.

## 6. Add the environment variables in Vercel

In the Vercel project (`brhs-yearbook-2026`) → **Settings → Environment
Variables**, add these four, scoped to **Production** (and Preview if you
want to test there too):

| Name | Value |
|---|---|
| `INSTAGRAM_ACCESS_TOKEN` | the long-lived token from step 3 |
| `INSTAGRAM_ACCOUNT_ID` | the numeric ID from step 2 |
| `SUPABASE_SERVICE_ROLE_KEY` | the service-role key from step 4 |
| `CRON_SECRET` | the random string from step 5 |

Redeploy (or just wait for the next deploy) so the function picks up the new
variables — Vercel serverless functions read `process.env` at request time,
but a running deployment won't see variables added after it was built.

## 7. Verify it works

- In the dashboard (`/dashboard` → **Instagram Shortcuts**), click
  **Refresh Instagram**. You should see a success toast with the number of
  posts synced, and "Last synced …" should update.
- Reload the homepage — the **Latest from Instagram** section should appear
  with the 3 newest posts, newest one featured larger.
- The weekly Vercel Cron job (configured in [`vercel.json`](vercel.json) to
  run every Monday at 13:00 UTC) will keep it updated automatically after
  that — no redeploy needed when new posts go up.

## Notes on behavior

- **Video posts** use their thumbnail image. If Instagram hasn't generated a
  thumbnail yet for a very recent video, that post is skipped and the next
  newest eligible post (with a usable image) is used instead.
- **Carousel posts** use the album's cover image.
- Each sync keeps only the 3 newest eligible posts in the table — older rows
  are pruned so the homepage never shows a stale 4th post.
- If a sync call fails (expired token, Instagram API error, etc.), the table
  is left untouched — the homepage keeps showing the last successful sync
  rather than going blank.
