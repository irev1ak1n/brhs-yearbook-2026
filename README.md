Website created to organize and support BRHS Yearbook 2026. Intended functionality is to help students access deadlines, submit content, and find ordering information in one place.

## Instagram feed setup

The homepage's "Latest from Instagram" section and the dashboard's Refresh
Instagram button require a few environment variables (Instagram Graph API
credentials, a Supabase service-role key, and a cron secret) before they do
anything — see [INSTAGRAM_SETUP.md](INSTAGRAM_SETUP.md) for exactly where to
get each one and where to put it.
