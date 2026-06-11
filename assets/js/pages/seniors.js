(function(){
    const kEl = document.getElementById('kicker');
    if(!kEl) return;
    'BRHS Yearbook — Seniors'.split('').forEach((c,i)=>{
        const s = document.createElement('span');
        s.className = 'ch';
        s.textContent = c === ' ' ? '\u00A0' : c;
        s.style.animationDelay = `${.05 + i * .03}s`;
        kEl.appendChild(s);
    });
})();

const seniorSort = document.getElementById("seniorSort");
const seniorsList = document.querySelector(".yb-seniors-list");

const originalCards = [...seniorsList.children];

seniorSort.addEventListener("change", () => {
    const cards = [...seniorsList.children];

    let sortedCards = cards;

    if (seniorSort.value === "default") {
        sortedCards = originalCards;
    }

    if (seniorSort.value === "name-az") {
        sortedCards = cards.sort((a, b) =>
            getName(a).localeCompare(getName(b))
        );
    }

    if (seniorSort.value === "name-za") {
        sortedCards = cards.sort((a, b) =>
            getName(b).localeCompare(getName(a))
        );
    }

    if (seniorSort.value === "college-az") {
        sortedCards = cards.sort((a, b) =>
            getCollege(a).localeCompare(getCollege(b))
        );
    }

    if (seniorSort.value === "college-za") {
        sortedCards = cards.sort((a, b) =>
            getCollege(b).localeCompare(getCollege(a))
        );
    }

    if (seniorSort.value === "major-az") {
        sortedCards = cards.sort((a, b) =>
            getMajor(a).localeCompare(getMajor(b))
        );
    }

    if (seniorSort.value === "major-za") {
        sortedCards = cards.sort((a, b) =>
            getMajor(b).localeCompare(getMajor(a))
        );
    }

    seniorsList.innerHTML = "";
    sortedCards.forEach(card => seniorsList.appendChild(card));

    // re-trigger the reveal animation for the newly arranged cards
    revealSeniorCards();
});

function getName(card) {
    return card.querySelector("h2").textContent.trim();
}

function getCollege(card) {
    return card
        .querySelector(".yb-senior-details")
        .textContent
        .split("•")[0]
        .trim();
}

function getMajor(card) {
    const details = card
        .querySelector(".yb-senior-details")
        .textContent
        .trim();

    const parts = details.split("•");

    return parts[1] ? parts[1].trim() : "Undeclared";
}

let revealObserver = null;

function revealSeniorCards(){
    const cards = [...seniorsList.children];

    if(revealObserver) revealObserver.disconnect();

    revealObserver = new IntersectionObserver(entries=>{
        entries.forEach(entry=>{
            if(!entry.isIntersecting) return;
            const el = entry.target;
            const delay = Number(el.dataset.revealDelay || 0);
            setTimeout(()=>el.classList.add('in'), delay);
            revealObserver.unobserve(el);
        });
    }, { threshold:.1 });

    cards.forEach((card,i)=>{
        card.classList.remove('in');
        card.dataset.revealDelay = (i % 6) * 70;
        revealObserver.observe(card);
    });
}
revealSeniorCards();

// hero/toolbar/upload-banner reveal
(function(){
    const targets = document.querySelectorAll('.yb-seniors-toolbar, .yb-upload-banner, .yb-next-grid');
    targets.forEach(el=>{
        new IntersectionObserver(entries=>{
            entries.forEach(entry=>{
                if(entry.isIntersecting) entry.target.classList.add('in');
            });
        }, { threshold:.12 }).observe(el);
    });
})();

(function(){
    const canvas = document.getElementById('seniors-embers');
    const page = document.querySelector('.yb-seniors-page');
    if(!canvas || !page) return;
    const ctx = canvas.getContext('2d');

    let W, H, DPR;
    let particles = [];
    let running = false;
    let rafId = null;

    function resize(){
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = page.offsetWidth;
        H = page.offsetHeight;
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

    function seedParticles(){
        const count = Math.max(30, Math.min(110, Math.floor((W * H) / 30000)));
        particles = Array.from({length: count}, () => new Ember(true));
    }

    function loop(){
        if(!running) return;
        ctx.clearRect(0, 0, W, H);
        particles.forEach(p=>{ p.tick(); p.draw() });
        rafId = requestAnimationFrame(loop);
    }
    function start(){ if(running) return; running = true; loop(); }
    function stop(){ running = false; if(rafId) cancelAnimationFrame(rafId); }

    resize();
    window.addEventListener('resize', resize);

    if('ResizeObserver' in window){
        new ResizeObserver(()=>resize()).observe(page);
    }

    new IntersectionObserver(entries=>{
        entries.forEach(entry=> entry.isIntersecting ? start() : stop());
    }, { threshold: 0 }).observe(page);
})();