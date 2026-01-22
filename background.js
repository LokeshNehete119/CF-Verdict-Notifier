chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.set({
        enabled: true,
        soundEnabled: true
    });
});

chrome.storage.sync.get("enabled", data => {
    if (!data.enabled && data.enabled !== undefined) return;

    console.log("CF Verdict Buddy service worker started");

    let lastHandle = null;
    let lastSubmissionId = null;
    let lastVerdict = null;

    function prettyVerdict(verdict) {
        switch (verdict) {
            case "OK": return "✅ Accepted";
            case "WRONG_ANSWER": return "❌ Wrong Answer";
            case "TIME_LIMIT_EXCEEDED": return "🕒 Time Limit Exceeded";
            case "COMPILATION_ERROR": return "⚙️ Compilation Error";
            case "RUNTIME_ERROR": return "💥 Runtime Error";
            case "MEMORY_LIMIT_EXCEEDED": return "🚫 Memory Limit Exceeded";
            case "IDLENESS_LIMIT_EXCEEDED": return "💤 Idleness Limit Exceeded";
            default: return verdict;
        }
    }

    async function check() {
        const data = await chrome.storage.sync.get("handle");
        const handle = data.handle;
        if (!handle) return;

        if (handle !== lastHandle) {
            lastHandle = handle;
            lastSubmissionId = null;
            lastVerdict = null;
        }

        try {
            const res = await fetch(
                `https://codeforces.com/api/user.status?handle=${handle}&from=1&count=1`
            );

            const json = await res.json();
            if (json.status !== "OK") return;

            const sub = json.result[0];
            const id = sub.id;
            const verdict = sub.verdict || "IN_QUEUE";
            const title = `${sub.problem.index}. ${sub.problem.name}`;

            if (lastSubmissionId === null) {
                lastSubmissionId = id;
                lastVerdict = verdict;
                return;
            }

            if (id !== lastSubmissionId || verdict !== lastVerdict) {
                lastSubmissionId = id;
                lastVerdict = verdict;

                if (verdict !== "IN_QUEUE" && verdict !== "TESTING") {
                    notify(title, prettyVerdict(verdict));
                }
            }

        } catch (e) {
            console.log("CF error:", e);
        }
    }

    function notify(title, message) {
        chrome.storage.sync.get(["enabled", "soundEnabled"], data => {
            if (!data.enabled) return;

            chrome.notifications.create({
                type: "basic",
                title,
                message,
                iconUrl: "icon.png"
            });

            if (!data.soundEnabled) return;

            if (message.includes("Accepted")) {
                playSound("play-ac");
            } else {
                playSound("play-fail");
            }
        });
    }

    let soundWindowId = null;

    async function ensureSoundTarget() {
        if (chrome.offscreen) {
            const has = await chrome.offscreen.hasDocument();
            if (!has) {
                await chrome.offscreen.createDocument({
                    url: "sound.html",
                    reasons: ["AUDIO_PLAYBACK"],
                    justification: "Play verdict sounds"
                });
            }
            return;
        }

        if (soundWindowId === null) {
            const win = await chrome.windows.create({
                url: chrome.runtime.getURL("sound.html"),
                focused: false,
                state: "minimized"
            });
            soundWindowId = win.id;
        }
    }

    async function playSound(type) {
        await ensureSoundTarget();
        chrome.runtime.sendMessage({ type });
    }

    function createAlarm() {
        chrome.alarms.create("cf-poll", { periodInMinutes: 0.05 });
    }

    chrome.runtime.onInstalled.addListener(createAlarm);
    chrome.runtime.onStartup.addListener(createAlarm);

    chrome.alarms.getAll(alarms => {
        if (!alarms.some(a => a.name === "cf-poll")) {
            createAlarm();
        }
    });

    chrome.alarms.onAlarm.addListener(alarm => {
        if (alarm.name === "cf-poll") check();
    });
});
