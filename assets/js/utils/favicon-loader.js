/* ══════════════════════════════════════
   SITE ICON / FAVICON (every page, public + dashboard)
   Reads the currently active favicon from Supabase (public read) and
   rewrites this page's browser-tab icon link(s) to match — so a new
   icon chosen in the dashboard shows up everywhere without a
   redeploy. A version query param (the icon's activated_at time)
   forces browsers to treat it as a new URL instead of reusing a
   cached tab icon, including when an older icon is restored.
══════════════════════════════════════ */
(function(){
    async function load(){
        try {
            const client = getSupabaseClient();
            const { data, error } = await client
                .from('active_favicon')
                .select('public_url, activated_at')
                .eq('id', true)
                .single();

            if(error || !data?.public_url) return;

            const versionedUrl = `${data.public_url}?v=${new Date(data.activated_at).getTime()}`;
            const links = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');

            if(links.length){
                links.forEach(link => { link.href = versionedUrl; });
            } else {
                const link = document.createElement('link');
                link.rel = 'icon';
                link.href = versionedUrl;
                document.head.appendChild(link);
            }
        } catch {
            // Network hiccup or not configured yet — keep whatever
            // static favicon link already exists in the page.
        }
    }

    load();
})();
