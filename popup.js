document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("handleInput");
    const saveBtn = document.getElementById("saveBtn");
    const status = document.getElementById("status");
    const toggle = document.getElementById("toggleNotifier");
    const soundToggle = document.getElementById("soundToggle");
    const labels = document.querySelectorAll(".toggle-text");
    const refetchBtn = document.getElementById("refetchBtn");

    const savedHandleValue = document.getElementById("savedHandleValue");
    const updateToggle = document.getElementById("updateToggle");
    const updateSection = document.getElementById("updateSection");

    updateToggle.onclick = () => {
        updateSection.style.display =
            updateSection.style.display === "none" || updateSection.style.display === ""
                ? "block"
                : "none";
    };

    function closeUpdateSection() {
        updateSection.style.display = "none";
    }

    function updateSavedHandleDisplay(handle) {
        savedHandleValue.textContent = handle;
    }

    chrome.storage.sync.get(["handle", "enabled", "soundEnabled"], data => {

        if (data.handle) {
            input.value = data.handle;
            updateSavedHandleDisplay(data.handle);
        } else {
            updateSavedHandleDisplay("None");
        }

        toggle.checked = data.enabled ?? true;
        soundToggle.checked = data.soundEnabled ?? true;
        setLabelColor();
    });

    function setLabelColor() {
        labels.forEach(label => {
            label.style.color = toggle.checked ? "#4ade80" : "#9ca3af";
        });
    }

    toggle.onchange = () => {
        chrome.storage.sync.set({ enabled: toggle.checked });
        setLabelColor();
    };

    soundToggle.onchange = () => {
        chrome.storage.sync.set({ soundEnabled: soundToggle.checked });
    };

    saveBtn.onclick = async () => {
        const handle = input.value.trim();

        if (!handle) {
            showStatus("Handle cannot be empty", false);
            return;
        }

        try {
            const res = await fetch(
                `https://codeforces.com/api/user.info?handles=${handle}`
            );

            const json = await res.json();

            if (json.status !== "OK") {
                showStatus("Invalid handle ❌", false);
                return;
            }

            chrome.storage.sync.set({ handle }, () => {
                updateSavedHandleDisplay(handle);
                showStatus("Saved successfully ✓", true);
                closeUpdateSection();
            });

        } catch (e) {
            showStatus("Network error", false);
        }
    };

    refetchBtn.onclick = () => {
        showStatus("Detecting...", true);

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {

            chrome.scripting.executeScript(
                {
                    target: { tabId: tabs[0].id },
                    func: () => {
                        const links = document.querySelectorAll("a[href*='/profile/']");
                        for (const link of links) {
                            const handle = link.textContent.trim();
                            if (handle && !handle.includes(" ")) {
                                return handle;
                            }
                        }
                        return null;
                    }
                },
                (results) => {

                    const detected = results && results[0]?.result;

                    if (!detected) {
                        showStatus("Open Codeforces while logged in", false);
                        return;
                    }

                    input.value = detected;

                    chrome.storage.sync.set({ handle: detected }, () => {
                        updateSavedHandleDisplay(detected);
                        showStatus("Auto-fetched ✓", true);
                        closeUpdateSection();
                    });
                }
            );
        });
    };

    function showStatus(msg, ok) {
        status.textContent = msg;
        status.style.color = ok ? "#4ade80" : "#f87171";
        status.style.opacity = 1;
        setTimeout(() => status.style.opacity = 0, 1800);
    }
});
