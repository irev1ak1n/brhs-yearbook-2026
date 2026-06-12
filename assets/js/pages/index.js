const HERO_COLLAGE_IMAGES = [
    { folder: 'prom', prefix: 'pic', images: [4, 21] },
    { folder: 'football', prefix: 'football', images: [1, 18, 6, 2, 11] },
    { folder: 'lacrosse', prefix: 'mlax', images: [46, 4] },
    { folder: 'men_soccer', prefix: 'ms', images: [1] },
    { folder: 'women_soccer', prefix: 'ws', images: [11, 8] },
    { folder: 'txf', prefix: 'txf', images: [2, 44, 7, 3] },
    { folder: 'baseball', prefix: 'baseball', images: [15, 21] },
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

function initEmberCanvas(canvas, opts){
    const { embers = 40, twinkles = 0, glows = 0 } = opts || {};
    const container = canvas.parentElement;
    if(!canvas || !container) return;
    const ctx = canvas.getContext('2d');

    let W, H, DPR;
    let emberParticles = [];
    let twinkleParticles = [];
    let glowParticles = [];
    let frame = 0;
    let running = false;
    let rafId = null;

    function resize(){
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = container.offsetWidth;
        H = container.offsetHeight;
        canvas.width = W * DPR;
        canvas.height = H * DPR;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        seedParticles();
    }

    class Ember{
        constructor(init){ this.reset(init) }
        reset(init){
            this.x = Math.random() * W;
            this.y = init ? Math.random() * H : H + 10;
            this.r = Math.random() * 1.7 + .3;
            this.vx = (Math.random() - .5) * .35;
            this.vy = -(Math.random() * .55 + .12);
            this.life = init ? Math.random() * 700 : 0;
            this.maxLife = Math.random() * 600 + 500;
            this.wobble = Math.random() * Math.PI * 2;
            this.wobbleSpeed = (Math.random() - .5) * .02;
            this.isEmber = this.r > 1.15;
            this.maxAlpha = this.isEmber ? .55 : .25;
        }
        tick(){
            this.life++;
            this.wobble += this.wobbleSpeed;
            this.x += this.vx + Math.sin(this.wobble) * .3;
            this.y += this.vy;
            if(this.life > this.maxLife || this.y < -10) this.reset(false);
        }
        get alpha(){
            const p = this.life / this.maxLife;
            const fade = p < .1 ? p/.1 : p > .85 ? (1-p)/.15 : 1;
            return Math.max(0, fade) * this.maxAlpha;
        }
        draw(){
            const a = this.alpha;
            if(a <= 0) return;
            if(this.isEmber){
                const flicker = .6 + .4 * Math.abs(Math.sin(this.wobble * 4));
                const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * 4);
                grad.addColorStop(0, `rgba(255,${Math.floor(160 + 80*flicker)},30,${(a*.5).toFixed(2)})`);
                grad.addColorStop(1, 'rgba(255,80,0,0)');
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.r * 4, 0, Math.PI*2);
                ctx.fillStyle = grad;
                ctx.fill();

                ctx.beginPath();
                ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
                ctx.fillStyle = `rgba(255,${Math.floor(200 + 55*flicker)},60,${(a*flicker).toFixed(2)})`;
                ctx.fill();
            } else {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.r * .6, 0, Math.PI*2);
                ctx.fillStyle = `rgba(220,195,150,${a.toFixed(2)})`;
                ctx.fill();
            }
        }
    }

    class Twinkle{
        constructor(){
            this.x = Math.random() * W;
            this.y = Math.random() * H;
            this.r = Math.random() * 1.3 + .4;
            this.phase = Math.random() * Math.PI * 2;
            this.speed = Math.random() * .035 + .012;
            this.maxAlpha = Math.random() * .55 + .25;
        }
        draw(t){
            const a = (Math.sin(t * this.speed + this.phase) * .5 + .5) * this.maxAlpha;
            if(a <= .02) return;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
            ctx.fillStyle = `rgba(255,214,150,${a.toFixed(2)})`;
            ctx.fill();
        }
    }

    class GlowBlob{
        constructor(init){ this.reset(init) }
        reset(init){
            this.x = Math.random() * W;
            this.y = init ? Math.random() * H : H + this.r;
            this.r = Math.random() * 50 + 35;
            this.vy = -(Math.random() * .12 + .04);
            this.life = init ? Math.random() * 900 : 0;
            this.maxLife = Math.random() * 900 + 800;
            this.maxAlpha = Math.random() * .16 + .07;
        }
        tick(){
            this.life++;
            this.y += this.vy;
            if(this.life > this.maxLife || this.y < -this.r) this.reset(false);
        }
        get alpha(){
            const p = this.life / this.maxLife;
            const fade = p < .15 ? p/.15 : p > .85 ? (1-p)/.15 : 1;
            return Math.max(0, fade) * this.maxAlpha;
        }
        draw(){
            const a = this.alpha;
            if(a <= 0) return;
            const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r);
            grad.addColorStop(0, `rgba(255,130,40,${a.toFixed(2)})`);
            grad.addColorStop(1, 'rgba(255,80,0,0)');
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
            ctx.fillStyle = grad;
            ctx.fill();
        }
    }

    function seedParticles(){
        emberParticles = Array.from({length: embers}, () => new Ember(true));
        twinkleParticles = Array.from({length: twinkles}, () => new Twinkle());
        glowParticles = Array.from({length: glows}, () => new GlowBlob(true));
    }

    function loop(){
        if(!running) return;
        ctx.clearRect(0, 0, W, H);
        frame++;
        glowParticles.forEach(g=>{ g.tick(); g.draw() });
        twinkleParticles.forEach(t=> t.draw(frame));
        emberParticles.forEach(p=>{ p.tick(); p.draw() });
        rafId = requestAnimationFrame(loop);
    }
    function start(){ if(running) return; running = true; loop(); }
    function stop(){ running = false; if(rafId) cancelAnimationFrame(rafId); }

    resize();
    window.addEventListener('resize', resize);

    if('ResizeObserver' in window){
        new ResizeObserver(()=>resize()).observe(container);
    }

    new IntersectionObserver(entries=>{
        entries.forEach(entry=> entry.isIntersecting ? start() : stop());
    }, { threshold: 0 }).observe(container);
}

(function(){
    const heroCanvas = document.getElementById('hero-embers');
    if(heroCanvas) initEmberCanvas(heroCanvas, { embers: 45, twinkles: 90, glows: 8 });

    const ctaCanvas = document.querySelector('.cta-embers');
    if(ctaCanvas) initEmberCanvas(ctaCanvas, { embers: 22, twinkles: 55, glows: 5 });

    document.querySelectorAll('.section-embers').forEach(canvas=>{
        initEmberCanvas(canvas, { embers: 16, twinkles: 40, glows: 3 });
    });
})();