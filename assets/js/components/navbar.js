(() => {
    function initNavSearch() {
        const searchInput = document.getElementById("navSearchInput");
        const searchBtn = document.getElementById("navSearchBtn");

        if (!searchInput) return;

        const basePlaceholder = "Search prom info...";
        const examples = [
            "When is prom night?",
            "Where is the venue?",
            "Ticket deadline May 1",
            "What should I wear?",
            "Dress code for prom",
            "Buy prom tickets",
            "Prom night schedule",
            "Parking at The Hamilton",
            "Guest rules for prom",
            "Everything about prom"
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
                    setTimeout(tick, 1000);
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

        function goToPromSearch() {
            const raw = searchInput.value.trim();
            if (!raw || !isValidQuery(raw)) return;

            const q = raw.toLowerCase().replace(/\s+/g, " ").trim();

            const routes = [
                {
                    target: "/tickets",
                    keys: [
                        "ticket", "tickets",
                        "buy", "buy ticket", "buy tickets",
                        "get ticket", "get tickets",
                        "purchase", "purchase ticket",
                        "price", "prices", "cost", "how much",
                        "payment", "pay", "pay for tickets",
                        "ticket price", "ticket cost"
                    ],
                },

                {
                    target: "/faq",
                    keys: [
                        "faq", "faqs",
                        "questions", "common questions",
                        "rules", "rules for prom",
                        "policy", "policies",
                        "allowed", "not allowed",
                        "what can i bring", "what is allowed",
                        "restrictions"
                    ],
                },

                {
                    target: "/contact",
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
                    target: "/gallery",
                    keys: [
                        "gallery", "photos", "pictures",
                        "images", "pics",
                        "prom pictures", "prom photos",
                        "prom gallery", "see photos",
                        "view gallery", "photo gallery",
                        "event photos", "prom images"
                    ],
                },

                {
                    target: "/night-guide#theme",
                    keys: [
                        "theme", "prom theme",
                        "las vegas", "vegas",
                        "what is the theme",
                        "theme idea", "prom style"
                    ],
                },

                {
                    target: "/night-guide#date-time",
                    keys: [
                        "date", "time", "when",
                        "when is prom", "when is prom night",
                        "what time is prom",
                        "start time", "end time",
                        "schedule", "prom schedule",
                        "may 2", "7 pm", "11 pm"
                    ],
                },

                {
                    target: "/night-guide#venue",
                    keys: [
                        "venue",
                        "the hamilton",
                        "parking", "parking info",
                    ],
                },

                {
                    target: "/night-guide#dress-code",
                    keys: [
                        "dress code", "what to wear",
                        "wear", "outfit",
                        "formal", "formal wear",
                        "suit", "dress",
                        "attire", "clothes",
                        "what should i wear",
                        "prom outfit"
                    ],
                },

                {
                    target: "/night-guide#tickets",
                    keys: [
                        "deadline", "ticket deadline",
                        "buy early", "sales close",
                        "last day", "last day to buy",
                        "april 15",
                        "when do tickets close",
                        "ticket cutoff"
                    ],
                },

                {
                    target: "/night-guide",
                    keys: [
                        "night guide", "guide",
                        "prom info", "prom information",
                        "details", "information",
                        "everything about prom",
                        "all info", "full info"
                    ],
                },

                {
                    target: "/",
                    keys: [
                        "home", "homepage", "main page",
                        "start", "go home",
                        "prom home", "prom homepage",
                        "back to home", "landing",
                        "main", "overview"
                    ],
                },

                {
                    target: "/#map",
                    keys: [
                        "map", "location map",
                        "venue map", "prom map",
                        "where is it on map",
                        "find location", "see location",
                        "directions", "how to get there",
                        "open map", "view map",
                        "join us", "join us section",
                        "where is prom located",
                        "show location", "location", "address",
                        "where", "where is prom",
                        "where is the venue", "how to get there"
                    ],
                },

                {
                    target: "/#newsletter",
                    keys: [
                        "newsletter", "subscribe",
                        "sign up", "signup",
                        "join mailing list",
                        "email updates",
                        "get updates", "stay updated",
                        "notifications", "alerts",
                        "prom updates",
                        "news", "latest news",
                        "updates about prom",
                        "subscribe for updates"
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

            // fallback: send unknown but valid prom-related searches to FAQ
            window.location.href = `/faq?q=${encodeURIComponent(raw)}`;
        }

        searchInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                goToPromSearch();
            }
        });

        if (searchBtn) {
            searchBtn.addEventListener("click", goToPromSearch);
        }
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

    function setActiveLink() {
        const links = document.querySelectorAll(".nav a");
        if (!links.length) return;

        const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";
        const currentHash = window.location.hash || "";

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

        menuToggle.addEventListener("click", openMenu);
        closeMenu?.addEventListener("click", closeSidebar);
        overlay?.addEventListener("click", closeSidebar);

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") closeSidebar();
        });

        // close menu when clicking links
        document.querySelectorAll(".mobile-sidebar a").forEach(link => {
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
            setTimeout(() => mobileSearchInput?.focus(), 50);
        }

        function closeSearch() {
            body.classList.remove("mobile-search-open");
            searchToggle.setAttribute("aria-expanded", "false");
            searchPanel.setAttribute("aria-hidden", "true");
        }

        searchToggle.addEventListener("click", () => {
            const isOpen = body.classList.contains("mobile-search-open");
            if (isOpen) {
                closeSearch();
            } else {
                openSearch();
            }
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
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                closeSearch();
            }
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        initNavSearch();
        initNavScroll();
        setActiveLink();
        initMobileMenu();
        initMobileSearch();
    });
})();
