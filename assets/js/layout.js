document.addEventListener("DOMContentLoaded", async () => {
    const placeholder = document.getElementById("navbar-placeholder");

    if (!placeholder) return;

    const res = await fetch("components/navbar.html");
    const html = await res.text();
    placeholder.innerHTML = html;

    if (typeof initNavbarFeatures === "function") {
        initNavbarFeatures();
    }
});