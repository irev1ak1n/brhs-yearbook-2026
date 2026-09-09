/* ══════════════════════════════════════
   SESSION-STABLE GALLERY ORDERING
   Randomizes a gallery's photo order once, then keeps that exact
   order stable (across scroll, filters, lazy loading, resize, and
   rerenders) for a fixed window by persisting the ordered id list
   in sessionStorage. Never mutates the array passed in.
══════════════════════════════════════ */
function shuffleArray(arr){
    const result = arr.slice();
    for(let i = result.length - 1; i > 0; i--){
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/**
 * Returns `ids` reordered so repeated calls within `ttlMs` of the first
 * call (per storageKey) always produce the same order. IDs no longer
 * present are dropped; ids not seen before are shuffled in and appended.
 */
function getStableOrderedIds(storageKey, ids, ttlMs){
    const now = Date.now();
    let saved = null;

    try {
        const raw = sessionStorage.getItem(storageKey);
        if(raw) saved = JSON.parse(raw);
    } catch(e){
        saved = null;
    }

    const isValid = saved
        && Array.isArray(saved.order)
        && typeof saved.timestamp === 'number'
        && (now - saved.timestamp) < ttlMs;

    const currentSet = new Set(ids);

    if(isValid){
        const stableIds = saved.order.filter(id => currentSet.has(id));
        const stableSet = new Set(stableIds);
        const newIds = shuffleArray(ids.filter(id => !stableSet.has(id)));
        const finalOrder = stableIds.concat(newIds);

        try {
            sessionStorage.setItem(storageKey, JSON.stringify({ timestamp: saved.timestamp, order: finalOrder }));
        } catch(e){ /* sessionStorage unavailable — ordering just won't persist */ }

        return finalOrder;
    }

    const freshOrder = shuffleArray(ids);
    try {
        sessionStorage.setItem(storageKey, JSON.stringify({ timestamp: now, order: freshOrder }));
    } catch(e){ /* sessionStorage unavailable — ordering just won't persist */ }

    return freshOrder;
}
