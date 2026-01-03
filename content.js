(function () {
    try {
        const links = document.querySelectorAll("a[href*='/profile/']");
        for (const link of links) {
            const handle = link.textContent.trim();

            // basic filter: ignore links like /profile/general or weird stuff
            if (handle && !handle.includes(" ")) {
                chrome.storage.sync.set({ cf_handle: handle });
                break;
            }
        }
    } catch (e) {
        console.log("CF handle auto-fetch failed", e);
    }
})();
