/* ══════════════════════════════════════
   ANALYTICS (serverless, server-side only)
   Reads traffic data from the official Google Analytics Data API (and
   Realtime Data API) for the dashboard's Analytics tab. Google service
   account credentials never leave this function — the dashboard only
   ever talks to this endpoint, authenticated with the staff member's
   own Supabase session token.

   Required environment variables (set in the Vercel project, never in
   client-side code — see GOOGLE_ANALYTICS_SETUP.md):
     GA4_PROPERTY_ID               GA4 property's numeric ID
     GOOGLE_SERVICE_ACCOUNT_EMAIL  service account's client_email
     GOOGLE_PRIVATE_KEY            service account's private_key (PEM)

   If any of the three are missing, responds 200 with
   { configured: false } so the dashboard can show a clean "not set up
   yet" state instead of an error or fake data.
══════════════════════════════════════ */
const crypto = require('crypto');

const SUPABASE_URL = 'https://vbryqkibfrbpfszjjluq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZicnlxa2liZnJicGZzempqbHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxODE1MDYsImV4cCI6MjEwNDc1NzUwNn0.9pGoqpTiJ3vIfD42R8kA1OwpH_XvYEcdxnOjjb7gQGg';

const VALID_RANGES = ['last7', 'last30', 'last90', 'schoolyear'];
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — historical data only, never the realtime count
const cache = new Map();

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const authorized = await isAuthorizedDashboardSession(req);
    if (!authorized) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const propertyId = process.env.GA4_PROPERTY_ID;
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!propertyId || !clientEmail || !privateKey) {
        res.status(200).json({ configured: false });
        return;
    }

    const range = VALID_RANGES.includes(req.query?.range) ? req.query.range : 'last30';

    try {
        const accessToken = await getGoogleAccessToken(clientEmail, privateKey);

        const [summaryReport, cities, pages, realtimeActiveUsers] = await Promise.all([
            getCachedOrFetch(`summary:${range}`, () => fetchSummaryReport(propertyId, accessToken, range)),
            getCachedOrFetch(`cities:${range}`, () => fetchTopCities(propertyId, accessToken, range)),
            getCachedOrFetch(`pages:${range}`, () => fetchTopPages(propertyId, accessToken, range)),
            fetchRealtime(propertyId, accessToken), // always fresh, never cached
        ]);

        res.status(200).json({
            configured: true,
            range,
            summary: summaryReport.summary,
            daily: summaryReport.daily,
            cities,
            pages,
            realtimeActiveUsers,
            fetchedAt: new Date().toISOString(),
        });
    } catch (err) {
        res.status(502).json({ error: err.message || 'Could not load analytics.' });
    }
};

async function isAuthorizedDashboardSession(req) {
    const header = req.headers.authorization || '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!bearer) return false;
    try {
        const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${bearer}` },
        });
        return resp.ok;
    } catch {
        return false;
    }
}

function getCachedOrFetch(key, fetchFn) {
    const hit = cache.get(key);
    if (hit && (Date.now() - hit.at) < CACHE_TTL_MS) return hit.data;
    const promise = fetchFn().then(data => {
        cache.set(key, { data, at: Date.now() });
        return data;
    });
    return promise;
}

function base64url(buf) {
    return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* Server-to-server OAuth2 via the service account's JWT bearer flow —
   hand-built with Node's built-in crypto (RS256) so no extra npm
   dependency (and therefore no package.json/build step) is needed. */
async function getGoogleAccessToken(clientEmail, privateKeyRaw) {
    const privateKey = privateKeyRaw.includes('\\n') ? privateKeyRaw.replace(/\\n/g, '\n') : privateKeyRaw;
    const now = Math.floor(Date.now() / 1000);

    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
        iss: clientEmail,
        scope: 'https://www.googleapis.com/auth/analytics.readonly',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
    };

    const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
    const signature = crypto.createSign('RSA-SHA256').update(signingInput).sign(privateKey);
    const jwt = `${signingInput}.${base64url(signature)}`;

    const resp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt,
        }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error_description || data.error || 'Google authentication failed.');
    return data.access_token;
}

/* "This school year" is approximated as starting August 1st — the
   property has no configured school-year boundary, so this is a
   reasonable fixed assumption for a high school yearbook site. */
function dateRangeFor(range) {
    if (range === 'last7') return { startDate: '7daysAgo', endDate: 'today' };
    if (range === 'last90') return { startDate: '90daysAgo', endDate: 'today' };
    if (range === 'schoolyear') {
        const now = new Date();
        const year = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
        return { startDate: `${year}-08-01`, endDate: 'today' };
    }
    return { startDate: '30daysAgo', endDate: 'today' };
}

async function runReport(propertyId, accessToken, body) {
    const resp = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.error?.message || 'Google Analytics request failed.');
    return data;
}

async function fetchSummaryReport(propertyId, accessToken, range) {
    const { startDate, endDate } = dateRangeFor(range);
    const data = await runReport(propertyId, accessToken, {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [
            { name: 'activeUsers' },
            { name: 'newUsers' },
            { name: 'eventCount' },
            { name: 'screenPageViews' },
        ],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
        metricAggregations: ['TOTAL'],
    });

    const daily = (data.rows || []).map(row => ({
        date: row.dimensionValues[0].value, // YYYYMMDD
        activeUsers: Number(row.metricValues[0].value),
    }));

    const totals = data.totals?.[0]?.metricValues || [];
    const summary = {
        activeUsers: Number(totals[0]?.value || 0),
        newUsers: Number(totals[1]?.value || 0),
        eventCount: Number(totals[2]?.value || 0),
        pageViews: Number(totals[3]?.value || 0),
    };

    return { daily, summary };
}

async function fetchTopCities(propertyId, accessToken, range) {
    const { startDate, endDate } = dateRangeFor(range);
    const data = await runReport(propertyId, accessToken, {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'city' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 10,
    });
    return (data.rows || []).map(row => ({
        city: row.dimensionValues[0].value,
        activeUsers: Number(row.metricValues[0].value),
    }));
}

async function fetchTopPages(propertyId, accessToken, range) {
    const { startDate, endDate } = dateRangeFor(range);
    const data = await runReport(propertyId, accessToken, {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 10,
    });
    return (data.rows || []).map(row => ({
        path: row.dimensionValues[0].value,
        views: Number(row.metricValues[0].value),
    }));
}

async function fetchRealtime(propertyId, accessToken) {
    const resp = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runRealtimeReport`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics: [{ name: 'activeUsers' }] }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.error?.message || 'Google Analytics realtime request failed.');
    return Number(data.rows?.[0]?.metricValues?.[0]?.value || 0);
}
