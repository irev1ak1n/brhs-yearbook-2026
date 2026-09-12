/* ══ KICKER CHAR STAGGER ══ */
(function(){
    const kEl = document.getElementById('kicker');
    if(!kEl) return;
    'BRHS Yearbook — Sports'.split('').forEach((c,i)=>{
        const s = document.createElement('span');
        s.className = 'ch';
        s.textContent = c === ' ' ? '\u00A0' : c;
        s.style.animationDelay = `${.05 + i * .03}s`;
        kEl.appendChild(s);
    });
})();

/* ══════════════════════════════════════
   SPORTS DATA
   The sport list (and its filter pills) is driven by the "sports" table
   in Supabase so a sport the teacher adds in the dashboard shows up here
   automatically. Sports with a folder/prefix also have their existing
   on-disk photos probed for (legacy layout: ../assets/images/gallery/<folder>/<prefix> (N).jpg);
   sports created purely through the dashboard have no folder and rely
   entirely on uploaded photos.
══════════════════════════════════════ */
const BASE_PATH = '../assets/images/gallery/';

async function fetchSports(){
    try {
        const { data, error } = await getSupabaseClient()
            .from('sports')
            .select('id, name, slug, folder, prefix, display_order')
            .order('display_order', { ascending: true });
        if(error) throw error;
        return (data || []).map(row => ({
            id: row.id,
            key: row.slug,
            label: row.name,
            folder: row.folder,
            prefix: row.prefix,
        }));
    } catch(e){
        console.error('Could not load sports list from Supabase', e);
        return [];
    }
}

async function fetchSportPhotosFromDB(sports){
    const bySlugId = new Map(sports.map(s => [s.id, s]));
    try {
        const { data, error } = await getSupabaseClient()
            .from('sport_photos')
            .select('id, sport_id, image_url, caption, season')
            .order('created_at', { ascending: false });
        if(error) throw error;
        return (data || []).map(row => {
            const sport = bySlugId.get(row.sport_id);
            if(!sport) return null;
            return {
                src: row.image_url,
                sport: sport.key,
                label: sport.label,
                year: row.season || '2025-2026',
                fromDB: true,
            };
        }).filter(Boolean);
    } catch(e){
        console.error('Could not load sport photos from Supabase', e);
        return [];
    }
}

function buildSportFilterPills(sports){
    const wrap = document.getElementById('sportsFilters');
    if(!wrap) return;
    sports.forEach(sport=>{
        const btn = document.createElement('button');
        btn.className = 'filter-pill';
        btn.dataset.filter = sport.key;
        btn.textContent = sport.label;
        wrap.appendChild(btn);
    });
}

// how many consecutive missing numbers before we assume a sport's
// folder has no more photos (handles small numbering gaps gracefully)
const MAX_CONSECUTIVE_MISSES = 15;
const BATCH_SIZE = 10;
// hard safety ceiling so a misconfigured folder can't loop forever
const ABSOLUTE_MAX = 800;

// keeps the randomized order stable across scrolling, filtering, and
// rerenders within a session; a fresh shuffle is generated once this expires
const GALLERY_ORDER_KEY = 'brhs_sports_gallery_order_2025-2026';
const GALLERY_ORDER_TTL_MS = 30 * 60 * 1000;

/* probe a single image; resolves with the item if it exists, else null */
function probeImage(sport, n){
    return new Promise(resolve=>{
        const src = `${BASE_PATH}${sport.folder}/${sport.prefix} (${n}).jpg`;
        const img = new Image();
        img.onload = () => resolve({ src, sport: sport.key, label: sport.label, year: '2025-2026' });
        img.onerror = () => resolve(null);
        img.src = encodeURI(src);
    });
}

/* keep probing a single sport's folder in batches until we hit a
   run of consecutive misses — finds ALL photos regardless of count */
async function gatherSportPhotos(sport){
    if(!sport.folder || !sport.prefix) return [];

    const photos = [];
    let n = 1;
    let consecutiveMisses = 0;

    while(consecutiveMisses < MAX_CONSECUTIVE_MISSES && n <= ABSOLUTE_MAX){
        const batchEnd = Math.min(n + BATCH_SIZE - 1, ABSOLUTE_MAX);
        const batch = [];
        for(let i = n; i <= batchEnd; i++){
            batch.push(probeImage(sport, i));
        }

        const results = await Promise.all(batch);

        for(const result of results){
            if(result){
                photos.push(result);
                consecutiveMisses = 0;
            } else {
                consecutiveMisses++;
                if(consecutiveMisses >= MAX_CONSECUTIVE_MISSES) break;
            }
        }

        n = batchEnd + 1;
    }

    return photos;
}

/* probe legacy on-disk photos + fetch dashboard-uploaded photos, return
   combined list in a session-stable order */
async function gatherPhotos(sports){
    const perSport = await Promise.all(sports.map(gatherSportPhotos));
    const dbPhotos = await fetchSportPhotosFromDB(sports);
    const photos = perSport.flat().concat(dbPhotos);

    const photoBySrc = new Map(photos.map(photo => [photo.src, photo]));
    const orderedSrcs = getStableOrderedIds(GALLERY_ORDER_KEY, photos.map(photo => photo.src), GALLERY_ORDER_TTL_MS);

    return orderedSrcs.map(src => photoBySrc.get(src)).filter(Boolean);
}

/* ══ BUILD COLLAGE ══ */
(async function(){
    const collage = document.getElementById('sportsCollage');
    const loading = document.getElementById('sportsLoading');
    const empty = document.getElementById('sportsEmpty');
    const filtersWrap = document.getElementById('sportsFilters');
    if(!collage) return;

    let allItems = [];

    const sports = await fetchSports();
    buildSportFilterPills(sports);

    gatherPhotos(sports).then(photos=>{
        if(loading) loading.remove();

        if(!photos.length){
            if(empty) empty.hidden = false;
            return;
        }

        const frag = document.createDocumentFragment();

        photos.forEach((photo, i)=>{
            const fig = document.createElement('figure');
            fig.className = 'collage-item';
            fig.dataset.sport = photo.sport;
            fig.dataset.year = photo.year || '2025-2026';
            fig.dataset.index = i;
            fig.dataset.revealIndex = i % 8;

            const img = document.createElement('img');
            img.src = photo.src;
            img.loading = 'lazy';
            img.alt = `${photo.label} photo`;

            const tag = document.createElement('span');
            tag.className = 'collage-tag';
            tag.textContent = photo.label;

            fig.appendChild(img);
            fig.appendChild(tag);
            frag.appendChild(fig);
        });

        collage.appendChild(frag);
        allItems = [...collage.querySelectorAll('.collage-item')];

        const yearFiltersWrap = document.getElementById('sportsYearFilters');
        const nextSeason = document.getElementById('sportsNextSeason');

        initReveal(allItems);
        initFilters(filtersWrap, yearFiltersWrap, allItems, empty);
        initLightbox(allItems);
        initFadeIn(yearFiltersWrap);
        initFadeIn(nextSeason);
    });
})();

/* ══ SCROLL REVEAL ══ */
function initReveal(items){
    const io = new IntersectionObserver(entries=>{
        entries.forEach(entry=>{
            if(!entry.isIntersecting) return;
            const el = entry.target;
            const delay = Number(el.dataset.revealIndex || 0) * 60;
            setTimeout(()=>el.classList.add('in'), delay);
            io.unobserve(el);
        });
    }, { threshold:.05 });

    items.forEach(item=> io.observe(item));
}

/* ══ FADE-IN HELPER (for year filters / next-season card) ══ */
function initFadeIn(el){
    if(!el) return;
    new IntersectionObserver(entries=>{
        entries.forEach(entry=>{
            if(entry.isIntersecting) el.classList.add('in');
        });
    }, { threshold:.2 }).observe(el);
}

/* ══ FILTERS (sport + year, combined) ══ */
function initFilters(sportWrap, yearWrap, items, emptyEl){
    let activeSport = 'all';
    let activeYear = 'all';

    function applyFilters(){
        let visibleCount = 0;

        items.forEach(item=>{
            const sportMatch = activeSport === 'all' || item.dataset.sport === activeSport;
            const yearMatch = activeYear === 'all' || item.dataset.year === activeYear;
            const match = sportMatch && yearMatch;
            item.classList.toggle('is-hidden', !match);
            if(match) visibleCount++;
        });

        if(emptyEl) emptyEl.hidden = visibleCount > 0;
    }

    if(sportWrap){
        // fade in the filter bar on scroll
        new IntersectionObserver(entries=>{
            entries.forEach(entry=>{
                if(entry.isIntersecting) sportWrap.classList.add('in');
            });
        }, { threshold:.2 }).observe(sportWrap);

        const buttons = [...sportWrap.querySelectorAll('.filter-pill')];
        buttons.forEach(btn=>{
            btn.addEventListener('click', ()=>{
                buttons.forEach(b=>b.classList.remove('is-active'));
                btn.classList.add('is-active');
                activeSport = btn.dataset.filter;
                applyFilters();
            });
        });
    }

    if(yearWrap){
        const yearButtons = [...yearWrap.querySelectorAll('.year-pill')];
        yearButtons.forEach(btn=>{
            btn.addEventListener('click', ()=>{
                yearButtons.forEach(b=>b.classList.remove('is-active'));
                btn.classList.add('is-active');
                activeYear = btn.dataset.year;
                applyFilters();
            });
        });
    }
}

/* ══ LIGHTBOX ══ */
function initLightbox(items){
    const lightbox = document.getElementById('sportsLightbox');
    const backdrop = document.getElementById('lightboxBackdrop');
    const closeBtn = document.getElementById('lightboxClose');
    const prevBtn = document.getElementById('lightboxPrev');
    const nextBtn = document.getElementById('lightboxNext');
    const imgEl = document.getElementById('lightboxImg');
    const captionEl = document.getElementById('lightboxCaption');
    if(!lightbox || !imgEl) return;

    let currentIndex = 0;

    function visibleItems(){
        return items.filter(item => !item.classList.contains('is-hidden'));
    }

    function open(item){
        const visible = visibleItems();
        currentIndex = visible.indexOf(item);
        render(visible);
        lightbox.classList.add('is-open');
        lightbox.setAttribute('aria-hidden','false');
        document.body.style.overflow = 'hidden';
    }

    function close(){
        lightbox.classList.remove('is-open');
        lightbox.setAttribute('aria-hidden','true');
        document.body.style.overflow = '';
    }

    function render(visible){
        const item = visible[currentIndex];
        if(!item) return;
        const img = item.querySelector('img');
        imgEl.src = img.src;
        imgEl.alt = img.alt;
        captionEl.textContent = item.querySelector('.collage-tag')?.textContent || '';
    }

    function step(dir){
        const visible = visibleItems();
        if(!visible.length) return;
        currentIndex = (currentIndex + dir + visible.length) % visible.length;
        render(visible);
    }

    items.forEach(item=>{
        item.addEventListener('click', ()=> open(item));
    });

    closeBtn?.addEventListener('click', close);
    backdrop?.addEventListener('click', close);
    prevBtn?.addEventListener('click', ()=> step(-1));
    nextBtn?.addEventListener('click', ()=> step(1));

    document.addEventListener('keydown', e=>{
        if(!lightbox.classList.contains('is-open')) return;
        if(e.key === 'Escape') close();
        if(e.key === 'ArrowLeft') step(-1);
        if(e.key === 'ArrowRight') step(1);
    });
}