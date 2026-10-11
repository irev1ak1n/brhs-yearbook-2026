/* ══════════════════════════════════════
   LATEST FROM INSTAGRAM (public homepage section)
   Reads the posts the /api/instagram-sync endpoint already saved to
   Supabase (public SELECT RLS) — never calls Instagram directly and
   never holds any Instagram credentials client-side. If nothing has
   been synced yet (credentials not configured, or sync hasn't run),
   the whole section stays hidden — no placeholder or fake posts.
══════════════════════════════════════ */
(function(){
    const section = document.getElementById('latestInstagramSection');
    const divider = document.getElementById('igFeedDivider');
    const feed = document.getElementById('igFeed');
    if(!section || !feed) return;

    function escapeHtml(str){
        const div = document.createElement('div');
        div.textContent = str == null ? '' : String(str);
        return div.innerHTML;
    }

    function truncate(text, max){
        if(!text) return '';
        const clean = text.replace(/\s+/g, ' ').trim();
        return clean.length > max ? clean.slice(0, max - 1).trimEnd() + '…' : clean;
    }

    function formatDate(iso){
        try {
            return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return '';
        }
    }

    function cardHtml(post, featured){
        const caption = truncate(post.caption, featured ? 170 : 90);
        return `
            <a class="ig-card${featured ? ' featured' : ''}" href="${escapeHtml(post.permalink)}" target="_blank" rel="noopener noreferrer">
                <div class="ig-card-image"><img src="${escapeHtml(post.media_url)}" alt="" loading="lazy"></div>
                <div class="ig-card-body">
                    <p class="ig-card-account">@${escapeHtml(post.account_name || 'thebrhsyearbook')}</p>
                    <p class="ig-card-date">${escapeHtml(formatDate(post.posted_at))}</p>
                    ${caption ? `<p class="ig-card-caption">${escapeHtml(caption)}</p>` : ''}
                </div>
            </a>`;
    }

    async function load(){
        try {
            const client = getSupabaseClient();
            const { data, error } = await client
                .from('instagram_posts')
                .select('id, permalink, caption, media_url, account_name, posted_at')
                .order('posted_at', { ascending: false })
                .limit(3);

            if(error || !data || !data.length) return; // stays hidden

            feed.innerHTML = data.map((post, i) => cardHtml(post, i === 0)).join('');
            section.hidden = false;
            if(divider) divider.hidden = false;
        } catch {
            // Network/config issue — stay hidden rather than show anything broken.
        }
    }

    load();
})();
