(() => {
    "use strict";

    const root = document.documentElement;
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const prefersReducedMotion = () => reducedMotionQuery.matches;
    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

    const readStoredTheme = () => {
        try {
            return localStorage.getItem("theme");
        } catch {
            return null;
        }
    };

    /* ------------------------------------------------------------------
       Theme (initial value is set by the inline script in <head>)
       ------------------------------------------------------------------ */
    const themeToggle = document.querySelector("[data-theme-toggle]");
    const themeLabel = themeToggle ? themeToggle.querySelector("[data-theme-label]") : null;
    let themeTransitionTimer = 0;

    const currentTheme = () => (root.getAttribute("data-theme") === "dark" ? "dark" : "light");

    const syncThemeToggle = () => {
        if (!themeToggle) {
            return;
        }

        const theme = currentTheme();
        const next = theme === "dark" ? "light" : "dark";

        if (themeLabel) {
            themeLabel.textContent = theme === "dark" ? "Dark" : "Light";
        }

        themeToggle.setAttribute("aria-label", `Switch to ${next} theme`);
    };

    const applyTheme = (theme, persist) => {
        root.classList.add("theme-transition");
        root.setAttribute("data-theme", theme);
        window.clearTimeout(themeTransitionTimer);
        themeTransitionTimer = window.setTimeout(() => root.classList.remove("theme-transition"), 450);

        if (persist) {
            try {
                localStorage.setItem("theme", theme);
            } catch {
                /* Storage unavailable (private mode); theme still applies for this visit. */
            }
        }

        syncThemeToggle();
    };

    syncThemeToggle();

    if (themeToggle) {
        themeToggle.addEventListener("click", () => {
            applyTheme(currentTheme() === "dark" ? "light" : "dark", true);
        });
    }

    // Follow OS changes until the visitor picks a theme explicitly.
    const systemDarkQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemThemeChange = (event) => {
        if (!readStoredTheme()) {
            applyTheme(event.matches ? "dark" : "light", false);
        }
    };

    if (typeof systemDarkQuery.addEventListener === "function") {
        systemDarkQuery.addEventListener("change", onSystemThemeChange);
    }

    /* ------------------------------------------------------------------
       Mobile navigation
       ------------------------------------------------------------------ */
    const header = document.querySelector("#site-header");
    const menuToggle = document.querySelector(".menu-toggle");
    const navigation = document.querySelector("#primary-navigation");
    const navigationLinks = Array.from(document.querySelectorAll(".site-nav-link"));
    const mobileBreakpoint = 900;

    const setNavigationOpen = (isOpen) => {
        if (!menuToggle || !navigation) {
            return;
        }

        menuToggle.setAttribute("aria-expanded", String(isOpen));
        menuToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
        navigation.classList.toggle("is-open", isOpen);
        root.classList.toggle("menu-open", isOpen);
    };

    if (menuToggle && navigation) {
        menuToggle.addEventListener("click", () => {
            setNavigationOpen(menuToggle.getAttribute("aria-expanded") !== "true");
        });

        navigationLinks.forEach((link) => link.addEventListener("click", () => setNavigationOpen(false)));

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && navigation.classList.contains("is-open")) {
                setNavigationOpen(false);
                menuToggle.focus();
            }
        });

        window.addEventListener("resize", () => {
            if (window.innerWidth > mobileBreakpoint) {
                setNavigationOpen(false);
            }
        });
    }

    /* ------------------------------------------------------------------
       Scroll-linked state: header, back-to-top, experience timeline
       ------------------------------------------------------------------ */
    const backToTop = document.querySelector("#back-to-top");
    const journey = document.querySelector("[data-journey]");
    const stages = journey ? Array.from(journey.querySelectorAll(".stage")) : [];
    let scrollFrame = 0;

    const updateJourney = () => {
        if (!journey) {
            return;
        }

        const triggerLine = window.innerHeight * 0.6;
        const bounds = journey.getBoundingClientRect();
        const progress = clamp((triggerLine - bounds.top) / bounds.height, 0, 1);
        journey.style.setProperty("--progress", progress.toFixed(4));

        stages.forEach((stage) => {
            const marker = stage.querySelector(".stage-marker");
            const markerTop = marker ? marker.getBoundingClientRect().top : stage.getBoundingClientRect().top;
            stage.classList.toggle("is-reached", markerTop < triggerLine);
        });
    };

    const onScroll = () => {
        scrollFrame = 0;
        const y = window.scrollY;

        if (header) {
            header.classList.toggle("is-scrolled", y > 12);
        }

        if (backToTop) {
            backToTop.hidden = y < window.innerHeight * 0.9;
        }

        updateJourney();
    };

    const requestScrollUpdate = () => {
        if (!scrollFrame) {
            scrollFrame = window.requestAnimationFrame(onScroll);
        }
    };

    onScroll();
    window.addEventListener("scroll", requestScrollUpdate, { passive: true });
    window.addEventListener("resize", requestScrollUpdate);

    if (backToTop) {
        backToTop.addEventListener("click", () => {
            window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
        });
    }

    /* ------------------------------------------------------------------
       Active navigation tracking
       ------------------------------------------------------------------ */
    const trackedSections = navigationLinks
        .map((link) => (link.hash ? document.querySelector(link.hash) : null))
        .filter((section) => section instanceof HTMLElement);

    const setActiveLink = (id) => {
        navigationLinks.forEach((link) => {
            const isActive = id !== null && link.hash === `#${id}`;
            link.classList.toggle("is-active", isActive);

            if (isActive) {
                link.setAttribute("aria-current", "location");
            } else {
                link.removeAttribute("aria-current");
            }
        });
    };

    if ("IntersectionObserver" in window && trackedSections.length > 0) {
        const visibleSections = new Map();
        const sectionObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    visibleSections.set(entry.target.id, entry.boundingClientRect.top);
                } else {
                    visibleSections.delete(entry.target.id);
                }
            });

            const hero = document.querySelector("#home");
            const heroVisible = hero && hero.getBoundingClientRect().bottom > window.innerHeight * 0.45;

            if (heroVisible || visibleSections.size === 0) {
                if (heroVisible) {
                    setActiveLink(null);
                }
                return;
            }

            const [activeId] = Array.from(visibleSections.entries()).sort((a, b) => a[1] - b[1])[0];
            setActiveLink(activeId);
        }, { rootMargin: "-40% 0px -55% 0px" });

        trackedSections.forEach((section) => sectionObserver.observe(section));
    }

    /* ------------------------------------------------------------------
       Scroll reveals
       ------------------------------------------------------------------ */
    const revealItems = document.querySelectorAll(".reveal, .reveal-title, .section-head");

    if ("IntersectionObserver" in window && !prefersReducedMotion()) {
        // Titles start fully clipped (clip-path), which Chrome treats as never
        // intersecting, so they are revealed when their parent enters view.
        const revealTargets = new Map();

        revealItems.forEach((item) => {
            const observed = item.classList.contains("reveal-title") && item.parentElement ? item.parentElement : item;
            const group = revealTargets.get(observed) || [];
            group.push(item);
            revealTargets.set(observed, group);
        });

        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    (revealTargets.get(entry.target) || []).forEach((item) => item.classList.add("is-visible"));
                    observer.unobserve(entry.target);
                }
            });
        }, { rootMargin: "0px 0px -10% 0px", threshold: 0 });

        revealTargets.forEach((_, observed) => revealObserver.observe(observed));
    } else {
        revealItems.forEach((item) => item.classList.add("is-visible"));
    }

    /* ------------------------------------------------------------------
       Hero: Kathmandu clock and rotating "currently" text
       ------------------------------------------------------------------ */
    const clock = document.querySelector("[data-clock]");

    if (clock && typeof Intl !== "undefined") {
        try {
            const formatter = new Intl.DateTimeFormat("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Kathmandu"
            });
            const tick = () => {
                clock.textContent = formatter.format(new Date());
            };
            tick();
            window.setInterval(tick, 15000);
        } catch {
            clock.textContent = "";
        }
    }

    const rotator = document.querySelector("[data-rotator]");

    if (rotator && !prefersReducedMotion()) {
        let words = [];

        try {
            words = JSON.parse(rotator.getAttribute("data-words") || "[]");
        } catch {
            words = [];
        }

        if (words.length > 1) {
            let index = 0;

            window.setInterval(() => {
                rotator.classList.add("is-out");

                window.setTimeout(() => {
                    index = (index + 1) % words.length;
                    rotator.textContent = words[index];
                    rotator.classList.remove("is-out");
                    rotator.classList.add("is-in");

                    // Force a reflow so the entrance transition runs from the offset state.
                    void rotator.offsetWidth;
                    rotator.classList.remove("is-in");
                }, 360);
            }, 3200);
        }
    }

    /* ------------------------------------------------------------------
       Project detail sheets (native <dialog>)
       ------------------------------------------------------------------ */
    const closeDialog = (dialog) => {
        dialog.querySelectorAll("video").forEach((video) => video.pause());

        if (typeof dialog.close === "function") {
            dialog.close();
        } else {
            dialog.removeAttribute("open");
        }
    };

    document.querySelectorAll("[data-project-open]").forEach((trigger) => {
        const selector = trigger.getAttribute("data-project-open");
        const dialog = selector ? document.querySelector(selector) : null;

        if (!(dialog instanceof HTMLElement)) {
            console.error("Project detail dialog was not found.", selector);
            return;
        }

        trigger.addEventListener("click", () => {
            if (typeof dialog.showModal === "function") {
                dialog.showModal();
            } else {
                dialog.setAttribute("open", "");
            }
        });
    });

    document.querySelectorAll(".project-dialog").forEach((dialog) => {
        dialog.querySelectorAll("[data-project-close]").forEach((button) => {
            button.addEventListener("click", () => closeDialog(dialog));
        });

        dialog.addEventListener("click", (event) => {
            if (event.target === dialog) {
                const bounds = dialog.getBoundingClientRect();
                const insideSheet = event.clientX >= bounds.left && event.clientX <= bounds.right
                    && event.clientY >= bounds.top && event.clientY <= bounds.bottom;

                if (!insideSheet) {
                    closeDialog(dialog);
                }
            }
        });

        dialog.addEventListener("close", () => {
            dialog.querySelectorAll("video").forEach((video) => video.pause());
        });
    });

    /* ------------------------------------------------------------------
       Copy email address
       ------------------------------------------------------------------ */
    document.querySelectorAll("[data-copy]").forEach((button) => {
        const status = button.parentElement ? button.parentElement.querySelector(".copy-status") : null;
        const originalText = button.textContent;
        let resetTimer = 0;

        button.addEventListener("click", async () => {
            const value = button.getAttribute("data-copy") || "";
            let copied = false;

            try {
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(value);
                    copied = true;
                }
            } catch {
                copied = false;
            }

            button.textContent = copied ? "Copied" : originalText;

            if (status) {
                status.textContent = copied ? "Address copied to clipboard" : "Copy unavailable — please select the address";
            }

            window.clearTimeout(resetTimer);
            resetTimer = window.setTimeout(() => {
                button.textContent = originalText;

                if (status) {
                    status.textContent = "";
                }
            }, 2200);
        });
    });

    /* ------------------------------------------------------------------
       Pointer-only enhancements: custom cursor + floating project preview
       ------------------------------------------------------------------ */
    if (finePointerQuery.matches && !prefersReducedMotion()) {
        const cursor = document.querySelector(".cursor");
        const cursorLabel = cursor ? cursor.querySelector(".cursor-label") : null;
        const previewFloat = document.querySelector("[data-preview-float]");
        const previewRows = document.querySelectorAll("[data-preview]");

        let pointerX = -100;
        let pointerY = -100;
        let cursorX = pointerX;
        let cursorY = pointerY;
        let previewX = pointerX;
        let previewY = pointerY;
        let previewActive = false;
        let animationFrame = 0;

        const render = () => {
            cursorX += (pointerX - cursorX) * 0.28;
            cursorY += (pointerY - cursorY) * 0.28;

            if (cursor) {
                cursor.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`;
            }

            if (previewFloat && previewActive) {
                const width = previewFloat.offsetWidth;
                const height = previewFloat.offsetHeight;
                const targetX = clamp(pointerX + 28, 16, window.innerWidth - width - 16);
                const targetY = clamp(pointerY - height / 2, 16, window.innerHeight - height - 16);
                previewX += (targetX - previewX) * 0.16;
                previewY += (targetY - previewY) * 0.16;
                previewFloat.style.transform = `translate3d(${previewX}px, ${previewY}px, 0)`;
            }

            const settled = Math.abs(pointerX - cursorX) < 0.1 && Math.abs(pointerY - cursorY) < 0.1;
            animationFrame = settled && !previewActive ? 0 : window.requestAnimationFrame(render);
        };

        const startRender = () => {
            if (!animationFrame) {
                animationFrame = window.requestAnimationFrame(render);
            }
        };

        if (cursor) {
            root.classList.add("cursor-enabled");

            document.addEventListener("pointermove", (event) => {
                if (event.pointerType !== "mouse") {
                    return;
                }

                pointerX = event.clientX;
                pointerY = event.clientY;
                cursor.classList.add("is-visible");
                startRender();
            }, { passive: true });

            document.addEventListener("pointerover", (event) => {
                const target = event.target instanceof Element ? event.target : null;
                const viewTarget = target ? target.closest("[data-cursor]") : null;
                const linkTarget = target ? target.closest("a, button, [role='button']") : null;

                cursor.classList.toggle("is-view", Boolean(viewTarget));
                cursor.classList.toggle("is-link", !viewTarget && Boolean(linkTarget));

                if (cursorLabel) {
                    cursorLabel.textContent = viewTarget ? viewTarget.getAttribute("data-cursor") || "" : "";
                }
            });

            document.documentElement.addEventListener("mouseleave", () => cursor.classList.remove("is-visible"));
            document.documentElement.addEventListener("mouseenter", () => cursor.classList.add("is-visible"));
        }

        if (previewFloat && previewRows.length > 0) {
            root.classList.add("preview-enabled");
            const panels = previewFloat.querySelectorAll("[data-preview-panel]");

            previewRows.forEach((row) => {
                row.addEventListener("pointerenter", (event) => {
                    const id = row.getAttribute("data-preview");
                    panels.forEach((panel) => {
                        panel.hidden = panel.getAttribute("data-preview-panel") !== id;
                    });

                    if (!previewActive) {
                        previewX = clamp(event.clientX + 28, 16, window.innerWidth - previewFloat.offsetWidth - 16);
                        previewY = clamp(event.clientY - previewFloat.offsetHeight / 2, 16, window.innerHeight - previewFloat.offsetHeight - 16);
                        previewFloat.style.transform = `translate3d(${previewX}px, ${previewY}px, 0)`;
                    }

                    previewActive = true;
                    previewFloat.classList.add("is-active");
                    startRender();
                });

                row.addEventListener("pointerleave", () => {
                    previewActive = false;
                    previewFloat.classList.remove("is-active");
                });
            });
        }
    }
})();
