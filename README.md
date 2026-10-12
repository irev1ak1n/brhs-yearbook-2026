Website created to organize and support BRHS Yearbook 2026. Intended functionality is to help students access deadlines, submit content, and find ordering information in one place.

## Instagram feed setup

The homepage's "Latest from Instagram" section and the dashboard's Refresh
Instagram button require a few environment variables (Instagram Graph API
credentials, a Supabase service-role key, and a cron secret) before they do
anything — see [INSTAGRAM_SETUP.md](INSTAGRAM_SETUP.md) for exactly where to
get each one and where to put it.

## Analytics dashboard setup

The dashboard's "Analytics" tab reads live traffic data from Google
Analytics 4 and needs a Google service account's credentials before it
shows anything — see
[GOOGLE_ANALYTICS_SETUP.md](GOOGLE_ANALYTICS_SETUP.md) for exact setup
steps.
