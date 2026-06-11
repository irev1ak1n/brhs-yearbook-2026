(() => {
    const FOOTER_PATHS = [
        "footer.html",
        "./footer.html",
        "../footer.html",
        "../components/footer.html",
        "../assets/components/footer.html",
        "../assets/html/components/footer.html",
        "/assets/components/footer.html",
        "/assets/html/components/footer.html",
        "/components/footer.html",
    ];

    async function fetchFirstAvailable(paths) {
        for (const path of paths) {
            try {
                const res = await fetch(path, { cache: "no-cache" });
                if (res.ok) {
                    const html = await res.text();
                    if (html.includes("siteFooter")) return html;
                }
            } catch (_) {
                /* try next path */
            }
        }
        return null;
    }

    async function loadFooter() {
        const placeholder = document.getElementById("footer-placeholder");

        if (placeholder) {
            const html = await fetchFirstAvailable(FOOTER_PATHS);
            if (html) {
                placeholder.outerHTML = html;
            } else {
                console.error(
                    "footer.js: could not load footer.html from any known path. " +
                    "Tried: " + FOOTER_PATHS.join(", ")
                );
                return;
            }
        }

        initFooter();
    }

    function initFooter() {
        const ftr = document.getElementById("siteFooter");
        if (!ftr) return;

        initKicker(ftr);
        initEmbers(ftr);
        initReveal(ftr);
        initNewsletter(ftr);
        initToTop(ftr);
        initYear(ftr);
    }

    function initKicker(ftr) {
        const kEl = ftr.querySelector("#ftrKicker");
        if (!kEl) return;

        const text = "BRHS Yearbook — 2026";
        text.split("").forEach((c, i) => {
            const s = document.createElement("span");
            s.className = "ch";
            s.textContent = c === " " ? "\u00A0" : c;
            s.style.animationDelay = `${i * 0.03}s`;
            kEl.appendChild(s);
        });
    }

    function initYear(ftr) {
        const yEl = ftr.querySelector("#ftrYear");
        if (yEl) yEl.textContent = new Date().getFullYear();
    }

    function initReveal(ftr) {
        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        ftr.classList.add("in");
                        io.unobserve(ftr);
                    }
                });
            },
            { threshold: 0.15 }
        );
        io.observe(ftr);
    }

    function initNewsletter(ftr) {
        const form = ftr.querySelector("#ftrForm");
        const input = ftr.querySelector("#ftrEmail");
        const btn = ftr.querySelector(".ftr-submit");
        const msg = ftr.querySelector("#ftrFormMsg");
        if (!form || !input || !btn) return;

        form.addEventListener("submit", (e) => {
            e.preventDefault();

            const email = input.value.trim();
            const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
            if (!isValid) {
                input.style.borderColor = "";
                form.style.animation = "none";
                void form.offsetWidth;
                form.style.transition = "transform .08s ease";
                form.style.transform = "translateX(-6px)";
                setTimeout(() => {
                    form.style.transform = "translateX(6px)";
                    setTimeout(() => {
                        form.style.transform = "";
                    }, 80);
                }, 80);
                input.focus();
                return;
            }

            btn.classList.add("sent");
            input.value = "";
            input.blur();
            if (msg) msg.classList.add("show");

            setTimeout(() => {
                btn.classList.remove("sent");
            }, 2400);
        });
    }

    function initToTop(ftr) {
        const btn = ftr.querySelector("#ftrToTop");
        if (!btn) return;

        const onScroll = () => {
            btn.classList.toggle("show", window.scrollY > 400);
        };
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });

        btn.addEventListener("click", () => {
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }

    function initEmbers(ftr) {
        const canvas = ftr.querySelector("#ftr-embers");
        if (!canvas) return;
        const ctx = canvas.getContext("2d");

        let W, H, DPR;
        let particles = [];
        let running = false;
        let rafId = null;

        function resize() {
            DPR = Math.min(window.devicePixelRatio || 1, 2);
            W = canvas.clientWidth;
            H = canvas.clientHeight;
            canvas.width = W * DPR;
            canvas.height = H * DPR;
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
            seedParticles();
        }

        class Ember {
            constructor(init) {
                this.reset(init);
            }
            reset(init) {
                this.x = Math.random() * W;
                this.y = init ? Math.random() * H : H + 10;
                this.r = Math.random() * 1.6 + 0.4;
                this.vx = (Math.random() - 0.5) * 0.35;
                this.vy = -(Math.random() * 0.6 + 0.15);
                this.life = init ? Math.random() * 600 : 0;
                this.maxLife = Math.random() * 500 + 400;
                this.wobble = Math.random() * Math.PI * 2;
                this.wobbleSpeed = (Math.random() - 0.5) * 0.02;
                this.isEmber = this.r > 1.1;
                this.maxAlpha = this.isEmber ? 0.65 : 0.3;
            }
            tick() {
                this.life++;
                this.wobble += this.wobbleSpeed;
                this.x += this.vx + Math.sin(this.wobble) * 0.3;
                this.y += this.vy;
                if (this.life > this.maxLife || this.y < -10) this.reset(false);
            }
            get alpha() {
                const p = this.life / this.maxLife;
                const fade = p < 0.1 ? p / 0.1 : p > 0.85 ? (1 - p) / 0.15 : 1;
                return Math.max(0, fade) * this.maxAlpha;
            }
            draw() {
                const a = this.alpha;
                if (a <= 0) return;
                if (this.isEmber) {
                    const flicker = 0.6 + 0.4 * Math.abs(Math.sin(this.wobble * 4));
                    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * 4);
                    grad.addColorStop(0, `rgba(255,${Math.floor(160 + 80 * flicker)},30,${(a * 0.5).toFixed(2)})`);
                    grad.addColorStop(1, "rgba(255,80,0,0)");
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.r * 4, 0, Math.PI * 2);
                    ctx.fillStyle = grad;
                    ctx.fill();

                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255,${Math.floor(200 + 55 * flicker)},60,${(a * flicker).toFixed(2)})`;
                    ctx.fill();
                } else {
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.r * 0.6, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(220,195,150,${a.toFixed(2)})`;
                    ctx.fill();
                }
            }
        }

        function seedParticles() {
            const count = Math.max(18, Math.min(50, Math.floor((W * H) / 22000)));
            particles = Array.from({ length: count }, () => new Ember(true));
        }

        function loop() {
            if (!running) return;
            ctx.clearRect(0, 0, W, H);
            particles.forEach((p) => {
                p.tick();
                p.draw();
            });
            rafId = requestAnimationFrame(loop);
        }

        function start() {
            if (running) return;
            running = true;
            loop();
        }
        function stop() {
            running = false;
            if (rafId) cancelAnimationFrame(rafId);
        }

        resize();
        window.addEventListener("resize", resize);

        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    entry.isIntersecting ? start() : stop();
                });
            },
            { threshold: 0 }
        );
        io.observe(ftr);
    }

    document.addEventListener("DOMContentLoaded", loadFooter);
})();