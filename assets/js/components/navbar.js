(() => {
    function initNavSearch() {
        const searchInput = document.getElementById("navSearchInput");
        const searchBtn = document.getElementById("navSearchBtn");

        if (!searchInput) return;

        const basePlaceholder = "Search yearbook info...";
        const examples = [
            "How much is a yearbook?",
            "When is the order deadline?",
            "Where do I pick up my book?",
            "Yearbook room 2206",
            "Buy my yearbook",
            "Why order early?",
            "Senior portrait info",
            "Sports team photos",
            "Contact yearbook staff",
            "Everything about the yearbook"
        ];

        let exIndex = 0;
        let charIndex = 0;
        let deleting = false;

        const isUserUsing = () =>
            document.activeElement === searchInput || searchInput.value.trim().length > 0;

        function tick() {
            if (isUserUsing()) {
                searchInput.placeholder = basePlaceholder;
                setTimeout(tick, 250);
                return;
            }

            const full = examples[exIndex];

            if (!deleting) {
                charIndex++;
                searchInput.placeholder = full.slice(0, charIndex);

                if (charIndex >= full.length) {
                    deleting = true;
                    setTimeout(tick, 1100);
                    return;
                }
            } else {
                charIndex--;
                searchInput.placeholder = full.slice(0, charIndex);

                if (charIndex <= 0) {
                    deleting = false;
                    exIndex = (exIndex + 1) % examples.length;
                }
            }

            setTimeout(tick, deleting ? 25 : 40);
        }

        searchInput.placeholder = basePlaceholder;
        tick();

        searchInput.addEventListener("focus", () => {
            searchInput.placeholder = basePlaceholder;
        });

        const hasWord = (text, word) =>
            new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text);

        function isValidQuery(raw) {
            const s = (raw || "").trim();

            if (!/[a-z0-9]/i.test(s)) return false;
            if (s.length < 2) return false;
            if (s.length > 80) return false;

            const allowed = /^[a-z0-9\s'&.,!?-]+$/i;
            if (!allowed.test(s)) return false;

            const lettersDigits = (s.match(/[a-z0-9]/gi) || []).length;
            const ratio = lettersDigits / s.length;
            if (ratio < 0.35) return false;

            if (/^\d+$/.test(s)) return false;

            return true;
        }

        function goToYearbookSearch() {
            const raw = searchInput.value.trim();
            if (!raw || !isValidQuery(raw)) return;

            const q = raw.toLowerCase().replace(/\s+/g, " ").trim();

            const routes = [
                {
                    target: "/pages/get-yearbooks.html",
                    keys: [
                        "yearbook", "buy yearbook", "buy my yearbook",
                        "order yearbook", "order my yearbook", "order",
                        "buy", "purchase", "purchase yearbook",
                        "price", "prices", "cost", "how much",
                        "payment", "pay", "pay for yearbook",
                        "yearbook price", "yearbook cost",
                        "deadline", "order deadline", "when is the deadline",
                        "last day to order", "ticket"
                    ],
                },

                {
                    target: "/pages/get-yearbooks.html#reasons",
                    keys: [
                        "why order early", "order early", "reasons",
                        "why buy early", "limited copies",
                        "why act now", "before the deadline"
                    ],
                },

                {
                    target: "/pages/get-yearbooks.html#pickup",
                    keys: [
                        "pickup", "pick up", "distribution",
                        "room 2206", "2206",
                        "missed pickup", "missed distribution",
                        "where do i pick up", "get my yearbook",
                        "collect yearbook", "collect my yearbook",
                        "when do i get my yearbook", "distribution day"
                    ],
                },

                {
                    target: "/pages/seniors.html",
                    keys: [
                        "senior", "seniors",
                        "senior portrait", "senior portraits",
                        "senior page", "senior photos",
                        "class of 2026", "graduating class"
                    ],
                },

                {
                    target: "/pages/sports.html",
                    keys: [
                        "sports", "athletics", "team photos",
                        "sports photos", "games", "teams",
                        "sports page"
                    ],
                },

                {
                    target: "/pages/our-team.html",
                    keys: [
                        "our team", "staff", "yearbook staff",
                        "advisor", "editors", "editorial team",
                        "who makes the yearbook", "team page"
                    ],
                },

                {
                    target: "/pages/contact.html",
                    keys: [
                        "contact", "contact us",
                        "email", "email school",
                        "message", "send message",
                        "reach out", "help",
                        "support", "who do i ask",
                        "who to contact"
                    ],
                },

                {
                    target: "/pages/faq.html",
                    keys: [
                        "faq", "faqs",
                        "questions", "common questions",
                        "rules", "policy", "policies",
                        "allowed", "not allowed",
                        "what is allowed", "restrictions"
                    ],
                },

                {
                    target: "/index.html",
                    keys: [
                        "home", "homepage", "main page",
                        "start", "go home",
                        "back to home", "landing",
                        "main", "overview"
                    ],
                },
            ];

            const matches = (keys) =>
                keys.some((k) => {
                    if (k.includes(" ")) return q.includes(k);
                    return hasWord(q, k);
                });

            for (const route of routes) {
                if (matches(route.keys)) {
                    window.location.href = route.target;
                    return;
                }
            }

            // fallback: send unknown but valid yearbook-related searches to FAQ
            window.location.href = `/pages/faq.html?q=${encodeURIComponent(raw)}`;
        }

        searchInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                goToYearbookSearch();
            }
            if (e.key === "Escape") {
                searchInput.value = "";
                searchInput.blur();
                searchInput.closest(".nav-search")?.classList.remove("active");
            }
        });

        searchBtn?.addEventListener("click", (e) => {
            const form = searchInput.closest(".nav-search");
            const isOpen = form?.classList.contains("active") || document.activeElement === searchInput;

            if (!isOpen) {
                e.preventDefault();
                form?.classList.add("active");
                setTimeout(() => searchInput.focus(), 250);
                return;
            }

            goToYearbookSearch();
        });

        // collapse desktop search if clicking elsewhere while empty
        document.addEventListener("click", (e) => {
            const form = searchInput.closest(".nav-search");
            if (!form) return;
            if (!form.contains(e.target) && !searchInput.value) {
                form.classList.remove("active");
            }
        });
    }

    function initNavScroll() {
        const topBar = document.querySelector(".hero-top");
        if (!topBar) return;

        const onScroll = () => {
            topBar.classList.toggle("is-scrolled", window.scrollY > 10);
        };

        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
    }

    function initReadBar() {
        const bar = document.getElementById("read-bar");
        if (!bar) return;

        const onScroll = () => {
            const docH = document.documentElement.scrollHeight - window.innerHeight;
            const pct = docH > 0 ? (window.scrollY / docH) * 100 : 0;
            bar.style.width = pct.toFixed(1) + "%";
        };

        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll, { passive: true });
    }

    function setActiveLink() {
        const links = document.querySelectorAll(".nav a, .mobile-sidebar-links a");
        if (!links.length) return;

        const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";

        links.forEach((link) => {
            link.classList.remove("is-active");

            const href = link.getAttribute("href");
            if (!href) return;

            const linkUrl = new URL(href, window.location.origin);
            const linkPath = linkUrl.pathname.replace(/\/+$/, "") || "/";
            const linkHash = linkUrl.hash || "";

            if (linkHash) return;

            if (linkPath === currentPath) {
                link.classList.add("is-active");
            }
        });
    }

    function initMobileMenu() {
        const body = document.body;
        const menuToggle = document.getElementById("menuToggle");
        const closeMenu = document.getElementById("closeMenu");
        const overlay = document.getElementById("mobileMenuOverlay");
        const sidebar = document.getElementById("mobileSidebar");

        if (!menuToggle) return;

        function openMenu() {
            body.classList.add("mobile-menu-open");
            menuToggle.setAttribute("aria-expanded", "true");
            sidebar?.setAttribute("aria-hidden", "false");
        }

        function closeSidebar() {
            body.classList.remove("mobile-menu-open");
            menuToggle.setAttribute("aria-expanded", "false");
            sidebar?.setAttribute("aria-hidden", "true");
        }

        menuToggle.addEventListener("click", () => {
            const isOpen = body.classList.contains("mobile-menu-open");
            isOpen ? closeSidebar() : openMenu();
        });
        closeMenu?.addEventListener("click", closeSidebar);
        overlay?.addEventListener("click", closeSidebar);

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") closeSidebar();
        });

        document.querySelectorAll(".mobile-sidebar-links a").forEach((link) => {
            link.addEventListener("click", closeSidebar);
        });
    }

    function initMobileSearch() {
        const body = document.body;
        const searchToggle = document.getElementById("mobileSearchToggle");
        const searchPanel = document.getElementById("mobileSearchPanel");
        const mobileSearchInput = document.getElementById("mobileSearchInput");
        const mobileSearchBtn = document.getElementById("mobileSearchBtn");

        if (!searchToggle || !searchPanel) return;

        function openSearch() {
            body.classList.add("mobile-search-open");
            searchToggle.setAttribute("aria-expanded", "true");
            searchPanel.setAttribute("aria-hidden", "false");
            setTimeout(() => mobileSearchInput?.focus(), 100);
        }

        function closeSearch() {
            body.classList.remove("mobile-search-open");
            searchToggle.setAttribute("aria-expanded", "false");
            searchPanel.setAttribute("aria-hidden", "true");
        }

        searchToggle.addEventListener("click", () => {
            const isOpen = body.classList.contains("mobile-search-open");
            isOpen ? closeSearch() : openSearch();
        });

        mobileSearchBtn?.addEventListener("click", () => {
            const query = mobileSearchInput?.value?.trim();
            if (!query) return;

            const desktopInput = document.getElementById("navSearchInput");
            if (desktopInput) {
                desktopInput.value = query;
            }

            document.getElementById("navSearchBtn")?.click();
        });

        mobileSearchInput?.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                mobileSearchBtn?.click();
            }
            if (e.key === "Escape") {
                closeSearch();
            }
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                closeSearch();
            }
        });
    }

    const NAVBAR_PATHS = [
        "navbar.html",
        "./navbar.html",
        "../navbar.html",
        "../components/navbar.html",
        "../assets/components/navbar.html",
        "../assets/html/components/navbar.html",
        "/assets/components/navbar.html",
        "/assets/html/components/navbar.html",
        "/components/navbar.html",
    ];

    async function fetchFirstAvailable(paths) {
        for (const path of paths) {
            try {
                const res = await fetch(path, { cache: "no-cache" });
                if (res.ok) {
                    const html = await res.text();
                    // sanity check: make sure we actually got the navbar markup
                    if (html.includes("siteNav")) return html;
                }
            } catch (_) {
            }
        }
        return null;
    }

    async function loadNavbar() {
        const placeholder = document.getElementById("navbar-placeholder");
        if (!placeholder) {
            // navbar markup already inline on the page
            initAll();
            return;
        }

        const html = await fetchFirstAvailable(NAVBAR_PATHS);

        if (html) {
            placeholder.outerHTML = html;
        } else {
            console.error(
                "navbar.js: could not load navbar.html from any known path. " +
                "Tried: " + NAVBAR_PATHS.join(", ")
            );
        }

        initAll();
    }

    function initAll() {
        initNavSearch();
        initNavScroll();
        setActiveLink();
        initMobileMenu();
        initMobileSearch();
        initReadBar();
    }

    document.addEventListener("DOMContentLoaded", loadNavbar);
})();