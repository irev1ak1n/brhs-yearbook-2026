document.addEventListener("DOMContentLoaded", async () => {
    const footerHost = document.getElementById("footer-host");
    if (!footerHost) return;

    try {
        const res = await fetch("../components/footer.html");
        if (!res.ok) throw new Error(`Failed to load footer: ${res.status}`);

        footerHost.innerHTML = await res.text();

        const yearEl = footerHost.querySelector("[data-year]");
        if (yearEl) {
            yearEl.textContent = new Date().getFullYear();
        }
    } catch (error) {
        console.error("Footer include failed:", error);
    }
});