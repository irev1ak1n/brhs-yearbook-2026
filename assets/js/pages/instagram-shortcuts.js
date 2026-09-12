/* ══════════════════════════════════════
   INSTAGRAM SHORTCUTS (public homepage section)
   Reads publicly from Supabase (public SELECT RLS policy) so accounts
   added/edited/removed from the dashboard show up here immediately —
   no rebuild or redeploy needed.
══════════════════════════════════════ */
(function(){
    const columns = {
        photographers: document.getElementById('instaPhotographers'),
        sports: document.getElementById('instaSports'),
        clubs: document.getElementById('instaClubs'),
    };
    if(!columns.photographers && !columns.sports && !columns.clubs) return;

    const IG_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.4" cy="6.6" r="1"/></svg>';

    function escapeHtml(str){
        const div = document.createElement('div');
        div.textContent = str == null ? '' : String(str);
        return div.innerHTML;
    }

    async function loadShortcuts(){
        try {
            const client = getSupabaseClient();
            const { data, error } = await client
                .from('instagram_shortcuts')
                .select('display_name, url, category')
                .order('display_name', { ascending: true });

            if(error) throw error;

            const grouped = { photographers: [], sports: [], clubs: [] };
            (data || []).forEach(item=>{
                if(grouped[item.category]) grouped[item.category].push(item);
            });

            Object.keys(columns).forEach(cat=>{
                const col = columns[cat];
                if(!col) return;
                const items = grouped[cat];
                col.innerHTML = items.length
                    ? items.map(item=> `
                        <li class="insta-item">
                            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">
                                <span class="insta-icon">${IG_ICON}</span>
                                <span>${escapeHtml(item.display_name)}</span>
                            </a>
                        </li>`).join('')
                    : '<li class="insta-empty">Coming soon.</li>';
            });
        } catch(err){
            Object.values(columns).forEach(col=>{
                if(col) col.innerHTML = '<li class="insta-empty">Unable to load links right now.</li>';
            });
        }
    }

    loadShortcuts();
})();
