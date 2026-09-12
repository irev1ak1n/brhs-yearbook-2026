/* ══════════════════════════════════════
   LEGACY GALLERY PHOTOS
   Shared logic for discovering photos that exist as static files under
   assets/images/gallery/ (the original site, before the dashboard),
   and for tracking which of those legacy photos an admin has hidden.
   Used by the public Sports/Happy Friday pages AND the dashboard so
   both always agree on what exists and what's hidden.
══════════════════════════════════════ */
const LEGACY_MAX_CONSECUTIVE_MISSES = 25;
const LEGACY_BATCH_SIZE = 10;
const LEGACY_ABSOLUTE_MAX = 800;

function probeLegacyImage(basePath, folder, prefix, n){
    return new Promise(resolve=>{
        const src = `${basePath}${folder}/${prefix} (${n}).jpg`;
        const img = new Image();
        img.onload = () => resolve(src);
        img.onerror = () => resolve(null);
        img.src = encodeURI(src);
    });
}

/* keep probing a single folder in batches until a run of consecutive
   misses is hit — finds ALL photos regardless of count. Returns the
   raw (unencoded) src path for each photo found. */
async function gatherLegacyFolderPhotos(basePath, folder, prefix, maxConsecutiveMisses){
    if(!folder || !prefix) return [];
    const maxMisses = maxConsecutiveMisses || LEGACY_MAX_CONSECUTIVE_MISSES;
    const paths = [];
    let n = 1;
    let consecutiveMisses = 0;

    while(consecutiveMisses < maxMisses && n <= LEGACY_ABSOLUTE_MAX){
        const batchEnd = Math.min(n + LEGACY_BATCH_SIZE - 1, LEGACY_ABSOLUTE_MAX);
        const batch = [];
        for(let i = n; i <= batchEnd; i++){
            batch.push(probeLegacyImage(basePath, folder, prefix, i));
        }

        const results = await Promise.all(batch);

        for(const src of results){
            if(src){
                paths.push(src);
                consecutiveMisses = 0;
            } else {
                consecutiveMisses++;
                if(consecutiveMisses >= maxMisses) break;
            }
        }

        n = batchEnd + 1;
    }

    return paths;
}

/* Normalizes a page-relative legacy path (e.g. "../assets/images/gallery/x.jpg")
   to a root-relative one (e.g. "/assets/images/gallery/x.jpg") so the same
   value can be compared/stored regardless of which page it was seen from —
   every page that uses this file lives exactly one folder below the site root. */
function normalizeLegacyPath(src){
    return src.replace(/^\.\.\//, '/').replace(/^\.\//, '/');
}

/* Returns a Set of normalized paths that have been hidden for the given
   kind ('sport' or 'friday'). Safe to call anonymously (public read). */
async function fetchHiddenLegacyPaths(kind){
    try {
        const { data, error } = await getSupabaseClient()
            .from('hidden_legacy_photos')
            .select('path')
            .eq('kind', kind);
        if(error) throw error;
        return new Set((data || []).map(row => row.path));
    } catch(e){
        console.error('Could not load hidden legacy photos', e);
        return new Set();
    }
}

/* Hides/restores a legacy photo. Both require an authenticated session —
   Row Level Security rejects these for anonymous visitors. */
async function hideLegacyPhoto(kind, path){
    return getSupabaseClient()
        .from('hidden_legacy_photos')
        .insert({ kind, path: normalizeLegacyPath(path) });
}

async function restoreLegacyPhoto(kind, path){
    return getSupabaseClient()
        .from('hidden_legacy_photos')
        .delete()
        .eq('kind', kind)
        .eq('path', normalizeLegacyPath(path));
}
