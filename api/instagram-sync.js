/* ══════════════════════════════════════
   INSTAGRAM SYNC (serverless, server-side only)
   Pulls the newest eligible posts from the official Instagram Graph API
   for the BRHS Yearbook account and stores them in Supabase so the
   public homepage can read them without ever touching Instagram
   directly or holding any credentials client-side.

   Callable two ways:
     1. Vercel Cron (weekly) — sends "Authorization: Bearer <CRON_SECRET>"
        automatically when the CRON_SECRET env var is set.
     2. The dashboard's "Refresh Instagram" button — sends the logged-in
        staff member's Supabase access token, which this function
        verifies against Supabase Auth before doing anything.

   Required environment variables (set in the Vercel project, never in
   client-side code — see INSTAGRAM_SETUP.md):
     INSTAGRAM_ACCESS_TOKEN     long-lived Instagram Graph API token
     INSTAGRAM_ACCOUNT_ID       the Instagram Business Account's numeric id
     SUPABASE_SERVICE_ROLE_KEY  Supabase service-role key (server-only)
     CRON_SECRET                shared secret Vercel Cron sends back to us
══════════════════════════════════════ */

// Same project URL already public in assets/js/utils/supabase-client.js —
// the URL itself isn't secret, only the service-role key below is.
const SUPABASE_URL = 'https://vbryqkibfrbpfszjjluq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZicnlxa2liZnJicGZzempqbHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxODE1MDYsImV4cCI6MjEwNDc1NzUwNn0.9pGoqpTiJ3vIfD42R8kA1OwpH_XvYEcdxnOjjb7gQGg';
const TABLE = 'instagram_posts';
const POST_LIMIT = 3;
const GRAPH_VERSION = 'v21.0';

module.exports = async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const authorized = await isAuthorized(req);
    if (!authorized) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    const accountId = process.env.INSTAGRAM_ACCOUNT_ID;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!accessToken || !accountId || !serviceKey) {
        res.status(503).json({
            error: 'Instagram sync is not configured yet. Set INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_ACCOUNT_ID, and SUPABASE_SERVICE_ROLE_KEY in the Vercel project settings. See INSTAGRAM_SETUP.md.',
        });
        return;
    }

    try {
        const accountName = await fetchAccountUsername(accountId, accessToken);
        const posts = await fetchEligiblePosts(accountId, accessToken, accountName);
        await replacePosts(posts, serviceKey);
        res.status(200).json({ ok: true, synced: posts.length, posts: posts.map(p => p.id) });
    } catch (err) {
        res.status(502).json({ error: err.message || 'Instagram sync failed.' });
    }
};

async function isAuthorized(req) {
    const header = req.headers.authorization || '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!bearer) return false;

    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && bearer === cronSecret) return true;

    // Otherwise, only a valid, currently-logged-in Supabase dashboard
    // session may trigger a sync (the "Refresh Instagram" button).
    try {
        const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${bearer}` },
        });
        return resp.ok;
    } catch {
        return false;
    }
}

async function fetchAccountUsername(accountId, accessToken) {
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${accountId}?fields=username&access_token=${encodeURIComponent(accessToken)}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.error?.message || 'Could not load the Instagram account.');
    return data.username || null;
}

// Fetches recent media and keeps only the newest POST_LIMIT posts that
// have a usable square-ish preview image: IMAGE and CAROUSEL_ALBUM posts
// use their own media_url (the cover image); VIDEO posts use
// thumbnail_url if present. Anything without a usable image — e.g. a
// video Instagram hasn't generated a thumbnail for yet — is skipped
// entirely so the next newest eligible post takes its place.
async function fetchEligiblePosts(accountId, accessToken, accountName) {
    const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${accountId}/media?fields=${fields}&limit=25&access_token=${encodeURIComponent(accessToken)}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.error?.message || 'Instagram Graph API request failed.');

    const eligible = [];
    for (const item of data.data || []) {
        const displayUrl = item.media_type === 'VIDEO'
            ? (item.thumbnail_url || null)
            : (item.media_url || null);

        if (!displayUrl || !item.permalink || !item.timestamp) continue;

        eligible.push({
            id: item.id,
            permalink: item.permalink,
            caption: item.caption || null,
            media_url: displayUrl,
            media_type: item.media_type,
            account_name: accountName,
            posted_at: item.timestamp,
        });

        if (eligible.length >= POST_LIMIT) break;
    }
    return eligible;
}

async function replacePosts(posts, serviceKey) {
    const headers = {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
    };

    if (posts.length) {
        const payload = posts.map(p => ({ ...p, synced_at: new Date().toISOString() }));
        const upsertResp = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?on_conflict=id`, {
            method: 'POST',
            headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
            body: JSON.stringify(payload),
        });
        if (!upsertResp.ok) throw new Error(`Supabase upsert failed: ${await upsertResp.text()}`);
    }

    // Drop anything from a previous sync that's no longer in the current
    // top set, so the homepage never shows a stale 4th/5th post. Skipped
    // when posts.length is 0 so a transient empty fetch can't wipe the
    // table — the last good sync stays live until the next one succeeds.
    if (posts.length) {
        const keepList = posts.map(p => `"${p.id}"`).join(',');
        const delResp = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?id=not.in.(${keepList})`, {
            method: 'DELETE',
            headers,
        });
        if (!delResp.ok) throw new Error(`Supabase prune failed: ${await delResp.text()}`);
    }
}
