/* ══════════════════════════════════════
   YEARBOOK PRICE (public pages)
   Reads the single shared price from Supabase (public read) and fills
   in every [data-yearbook-price] element on the page. If the fetch
   fails for any reason, the static number already written in the
   markup stays put rather than going blank.
══════════════════════════════════════ */
(function(){
    const targets = document.querySelectorAll('[data-yearbook-price]');
    if(!targets.length) return;

    async function load(){
        try {
            const client = getSupabaseClient();
            const { data, error } = await client
                .from('yearbook_price')
                .select('amount')
                .eq('id', true)
                .single();

            if(error || data?.amount == null) return;
            targets.forEach(el => { el.textContent = data.amount; });
        } catch {
            // keep the static fallback already in the markup
        }
    }

    load();
})();
