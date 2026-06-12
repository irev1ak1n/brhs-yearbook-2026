const HERO_COLLAGE_IMAGES = [
    { folder: 'prom', prefix: 'pic', images: [4, 21] },
    { folder: 'football', prefix: 'football', images: [1, 18, 6, 2, 11] },
    { folder: 'lacrosse', prefix: 'mlax', images: [46, 4] },
    { folder: 'men_soccer', prefix: 'ms', images: [1] },
    { folder: 'women_soccer', prefix: 'ws', images: [11, 8] },
    { folder: 'txf', prefix: 'txf', images: [2, 44, 7, 3] },
    { folder: 'baseball', prefix: 'baseball', images: [15,21] },
    { folder: 'women_volleyball', prefix: 'wvb', images: [15, 52] },
    { folder: 'men_volleyball', prefix: 'mvb', images: [6] },
    { folder: 'basketball', prefix: 'basketball', images: [33, 8] },
];

(function(){
    const collage = document.getElementById('heroCollage');
    if(!collage) return;

    const frag = document.createDocumentFragment();

    HERO_COLLAGE_IMAGES.forEach(set=>{
        const numbers = set.images
            ? set.images
            : Array.from({ length: set.end - set.start + 1 }, (_, i) => set.start + i);

        numbers.forEach(n=>{
            const cell = document.createElement('div');
            cell.className = 'hero-cell';

            const img = document.createElement('img');
            img.src = `assets/images/gallery/${set.folder}/${set.prefix} (${n}).jpg`;
            img.alt = '';
            img.loading = 'eager';

            cell.appendChild(img);
            frag.appendChild(cell);
        });
    });

    collage.appendChild(frag);
})();

(function(){
    const kEl = document.getElementById('heroKicker');
    if(!kEl) return;
    'Ballantyne Ridge High School'.split('').forEach((c,i)=>{
        const s = document.createElement('span');
        s.className = 'ch';
        s.textContent = c === ' ' ? '\u00A0' : c;
        s.style.animationDelay = `${.6 + i * .025}s`;
        kEl.appendChild(s);
    });
})();

(function(){
    const items = document.querySelectorAll('.reveal');
    if(!items.length) return;

    const io = new IntersectionObserver(entries=>{
        entries.forEach(entry=>{
            if(!entry.isIntersecting) return;
            entry.target.classList.add('in');
            io.unobserve(entry.target);
        });
    }, { threshold:.15 });

    items.forEach(item=> io.observe(item));
})();