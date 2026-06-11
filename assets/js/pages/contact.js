
(function(){
    const kEl = document.getElementById('kicker');
    if(!kEl) return;
    'BRHS Yearbook — Contact'.split('').forEach((c,i)=>{
        const s = document.createElement('span');
        s.className = 'ch';
        s.textContent = c === ' ' ? '\u00A0' : c;
        s.style.animationDelay = `${.05 + i * .03}s`;
        kEl.appendChild(s);
    });
})();

(function(){
    const targets = document.querySelectorAll(
        '.contact-info-h, .contact-info-lead, .info-card, .contact-form'
    );
    if(!targets.length) return;

    const io = new IntersectionObserver(entries=>{
        entries.forEach(entry=>{
            if(!entry.isIntersecting) return;
            const el = entry.target;
            const delay = Number(el.dataset.revealDelay || 0);
            setTimeout(()=>el.classList.add('in'), delay);
            io.unobserve(el);
        });
    }, { threshold: .12 });

    let cardIndex = 0;
    targets.forEach(el=>{
        if(el.classList.contains('info-card')){
            el.dataset.revealDelay = cardIndex * 100;
            cardIndex++;
        }
        io.observe(el);
    });
})();

(function(){
    document.querySelectorAll('.info-card').forEach(card=>{
        card.addEventListener('mousemove', e=>{
            const r = card.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width - .5;
            const y = (e.clientY - r.top) / r.height - .5;
            card.style.transform = `perspective(900px) rotateX(${-y*4}deg) rotateY(${x*4}deg) translateZ(2px)`;
        });
        card.addEventListener('mouseleave', ()=>{
            card.style.transition = 'transform .5s cubic-bezier(.16,1,.3,1),opacity .65s cubic-bezier(.16,1,.3,1),border-color .3s,box-shadow .3s';
            card.style.transform = '';
        });
        card.addEventListener('mouseenter', ()=>{
            card.style.transition = 'transform .12s ease,border-color .3s,box-shadow .3s';
        });
    });
})();

(function(){
    const form = document.getElementById('contactForm');
    const btn = document.getElementById('contactBtn');
    const success = document.getElementById('contactSuccess');
    const successText = document.getElementById('contactSuccessText');
    if(!form || !btn) return;

    const fields = form.querySelectorAll('.field');

    const DEFAULT_SUCCESS_MSG = "Thanks — your message has been sent.";
    const ERROR_MSG = "Something went wrong — please try again, or email us directly.";

    function validate(){
        let ok = true;
        fields.forEach(field=>{
            const input = field.querySelector('input, textarea');
            if(!input) return;
            let valid = true;

            if(input.hasAttribute('required') && !input.value.trim()){
                valid = false;
            }
            if(input.type === 'email' && input.value.trim()){
                valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim());
            }

            field.classList.toggle('invalid', !valid);
            if(!valid) ok = false;
        });
        return ok;
    }

    // clear invalid state as the user types
    fields.forEach(field=>{
        const input = field.querySelector('input, textarea');
        input?.addEventListener('input', ()=> field.classList.remove('invalid'));
    });

    function showMessage(text, isError){
        if(!success) return;
        if(successText) successText.textContent = text;
        success.classList.toggle('error', !!isError);
        success.classList.add('show');

        clearTimeout(showMessage._t);
        showMessage._t = setTimeout(()=>{
            success.classList.remove('show');
        }, 6000);
    }

    form.addEventListener('submit', async e=>{
        e.preventDefault();

        if(!validate()){
            btn.classList.remove('shake');
            void btn.offsetWidth;
            btn.classList.add('shake');
            const firstInvalid = form.querySelector('.field.invalid input, .field.invalid textarea');
            firstInvalid?.focus();
            return;
        }

        btn.classList.remove('error','sent');
        btn.classList.add('sending');

        try{
            const res = await fetch(form.action, {
                method: 'POST',
                body: new FormData(form),
                headers: { 'Accept': 'application/json' }
            });

            btn.classList.remove('sending');

            if(res.ok){
                btn.classList.add('sent');
                showMessage(DEFAULT_SUCCESS_MSG, false);

                form.reset();
                fields.forEach(f=>f.classList.remove('invalid'));

                setTimeout(()=>{
                    btn.classList.remove('sent');
                }, 2600);
            } else {
                let msg = ERROR_MSG;
                try{
                    const data = await res.json();
                    if(data?.errors?.length){
                        msg = data.errors.map(er => er.message).join(', ');
                    }
                } catch(_){  }

                btn.classList.add('error');
                showMessage(msg, true);
                setTimeout(()=> btn.classList.remove('error'), 2600);
            }
        } catch(err){
            btn.classList.remove('sending');
            btn.classList.add('error');
            showMessage(ERROR_MSG, true);
            setTimeout(()=> btn.classList.remove('error'), 2600);
        }
    });
})();


(function(){
    const canvas = document.getElementById('contact-embers');
    const page = document.querySelector('.contact-page');
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
        const count = Math.max(30, Math.min(90, Math.floor((W * H) / 26000)));
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