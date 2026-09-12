(function(){
    const kEl = document.getElementById('kicker');
    if(!kEl) return;
    'BRHS Yearbook — Happy Friday'.split('').forEach((c,i)=>{
        const s = document.createElement('span');
        s.className = 'ch';
        s.textContent = c === ' ' ? '\u00A0' : c;
        s.style.animationDelay = `${.05 + i * .03}s`;
        kEl.appendChild(s);
    });
})();

const FRIDAY_SETS = [
    { key: 'almost_friday', label: 'Almost Friday', folder: 'almost_friday', prefix: 'afr' },
    { key: 'finally_friday', label: 'Finally Friday', folder: 'finally_friday', prefix: 'ff' },
];

const BASE_PATH = '../assets/images/gallery/';
const MAX_CONSECUTIVE_MISSES = 25;

// keeps the randomized order stable across scrolling, filtering, and
// rerenders within a session; a fresh shuffle is generated once this expires
const GALLERY_ORDER_KEY = 'brhs_friday_gallery_order_2025-2026';
const GALLERY_ORDER_TTL_MS = 30 * 60 * 1000;

async function fetchFridayPhotosFromDB(){
    const byCategory = new Map(FRIDAY_SETS.map(s => [s.key, s]));
    try {
        const { data, error } = await getSupabaseClient()
            .from('happy_friday_photos')
            .select('id, category, image_url, caption, season')
            .order('created_at', { ascending: false });
        if(error) throw error;
        return (data || []).map(row => {
            const set = byCategory.get(row.category);
            if(!set) return null;
            return {
                src: row.image_url,
                set: set.key,
                label: set.label,
                year: row.season || '2025-2026',
                fromDB: true,
            };
        }).filter(Boolean);
    } catch(e){
        console.error('Could not load Happy Friday photos from Supabase', e);
        return [];
    }
}

/* probe a single category's on-disk folder (shared with the dashboard so
   both always agree on what legacy photos exist) */
async function gatherSetPhotos(set){
    const paths = await gatherLegacyFolderPhotos(BASE_PATH, set.folder, set.prefix, MAX_CONSECUTIVE_MISSES);
    return paths.map(src => ({ src, set: set.key, label: set.label, year: '2025-2026' }));
}

async function gatherPhotos(){
    const perSet = await Promise.all(FRIDAY_SETS.map(gatherSetPhotos));
    const dbPhotos = await fetchFridayPhotosFromDB();
    const hiddenPaths = await fetchHiddenLegacyPaths('friday');

    const photos = perSet.flat().concat(dbPhotos)
        .filter(photo => !hiddenPaths.has(normalizeLegacyPath(photo.src)));

    const photoBySrc = new Map(photos.map(photo => [photo.src, photo]));
    const orderedSrcs = getStableOrderedIds(GALLERY_ORDER_KEY, photos.map(photo => photo.src), GALLERY_ORDER_TTL_MS);

    return orderedSrcs.map(src => photoBySrc.get(src)).filter(Boolean);
}

(function(){
    const collage = document.getElementById('fridayCollage');
    const loading = document.getElementById('fridayLoading');
    const empty = document.getElementById('fridayEmpty');
    const filtersWrap = document.getElementById('fridayFilters');
    if(!collage) return;

    let allItems = [];

    gatherPhotos().then(photos=>{
        if(loading) loading.remove();

        if(!photos.length){
            if(empty) empty.hidden = false;
            return;
        }

        const frag = document.createDocumentFragment();

        photos.forEach((photo, i)=>{
            const fig = document.createElement('figure');
            fig.className = 'collage-item';
            fig.dataset.set = photo.set;
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

        const yearFiltersWrap = document.getElementById('fridayYearFilters');
        const nextSeason = document.getElementById('fridayNextSeason');

        initReveal(allItems);
        initFilters(filtersWrap, yearFiltersWrap, allItems, empty);
        initLightbox(allItems);
        initFadeIn(yearFiltersWrap);
        initFadeIn(nextSeason);
    });
})();

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

function initFadeIn(el){
    if(!el) return;
    new IntersectionObserver(entries=>{
        entries.forEach(entry=>{
            if(entry.isIntersecting) el.classList.add('in');
        });
    }, { threshold:.2 }).observe(el);
}

function initFilters(setWrap, yearWrap, items, emptyEl){
    let activeSet = 'all';
    let activeYear = 'all';

    function applyFilters(){
        let visibleCount = 0;

        items.forEach(item=>{
            const setMatch = activeSet === 'all' || item.dataset.set === activeSet;
            const yearMatch = activeYear === 'all' || item.dataset.year === activeYear;
            const match = setMatch && yearMatch;
            item.classList.toggle('is-hidden', !match);
            if(match) visibleCount++;
        });

        if(emptyEl) emptyEl.hidden = visibleCount > 0;
    }

    if(setWrap){
        new IntersectionObserver(entries=>{
            entries.forEach(entry=>{
                if(entry.isIntersecting) setWrap.classList.add('in');
            });
        }, { threshold:.2 }).observe(setWrap);

        const buttons = [...setWrap.querySelectorAll('.filter-pill')];
        buttons.forEach(btn=>{
            btn.addEventListener('click', ()=>{
                buttons.forEach(b=>b.classList.remove('is-active'));
                btn.classList.add('is-active');
                activeSet = btn.dataset.filter;
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

function initLightbox(items){
    const lightbox = document.getElementById('fridayLightbox');
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