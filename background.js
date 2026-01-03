chrome.storage.sync.get("enabled", data => {
    if (!data.enabled && data.enabled !== undefined) return;

    console.log("CF Verdict Buddy service worker started");

    let lastSubmissionId = null;
    let lastVerdict = null;

    // ---------- VERDICT FORMATTER ----------

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

    // ---------- CORE CHECK FUNCTION ----------

    async function check() {
        console.log("Polling Codeforces…");

        const data = await chrome.storage.sync.get("handle");
        const handle = data.handle;

        if (!handle) return;

        try {
            const res = await fetch(
                `https://codeforces.com/api/user.status?handle=${handle}&from=1&count=1`
            );

            const json = await res.json();
            if (json.status !== "OK") return;

            const sub = json.result[0];
            const id = sub.id;
            const verdict = sub.verdict || "IN_QUEUE";

            const problemTitle = `${sub.problem.index}. ${sub.problem.name}`;

            // first run -> just initialize
            if (lastSubmissionId === null) {
                lastSubmissionId = id;
                lastVerdict = verdict;
                return;
            }

            // new submission detected
            if (id !== lastSubmissionId) {
                lastSubmissionId = id;
                lastVerdict = verdict;

                if (verdict !== "IN_QUEUE" && verdict !== "TESTING") {
                    notify(problemTitle, prettyVerdict(verdict));
                }
            }

            // same submission, verdict changed
            else if (verdict !== lastVerdict) {
                lastVerdict = verdict;

                if (verdict !== "IN_QUEUE" && verdict !== "TESTING") {
                    notify(problemTitle, prettyVerdict(verdict));
                }
            }

        } catch (e) {
            console.log("CF check error:", e);
        }
    }

    // ---------- NOTIFICATION + SOUND ----------

    function notify(problemTitle, verdictText) {
        chrome.notifications.create({
            type: "basic",
            title: problemTitle,
            message: verdictText,
            iconUrl: "icon.png"
        });

        if (verdictText.includes("Accepted")) {
            playSound("play-ac");
        } else {
            playSound("play-fail");
        }
    }

    // ---------- SOUND HANDLING ----------

    let soundWindowId = null;

    async function ensureSoundTarget() {
        try {
            if (chrome.offscreen) {
                const has = await chrome.offscreen.hasDocument();
                if (!has) {
                    await chrome.offscreen.createDocument({
                        url: "sound.html",
                        reasons: ["AUDIO_PLAYBACK"],
                        justification: "Play verdict notification sounds"
                    });
                }
                return;
            }
        } catch (_) { }

        // fallback window for older Chrome
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

        try {
            chrome.runtime.sendMessage({ type }, () => {
                const err = chrome.runtime.lastError;
                if (err) {
                    setTimeout(() => {
                        chrome.runtime.sendMessage({ type }, () => {});
                    }, 200);
                }
            });
        } catch (_) {}
    }

    // ---------- ALARM CREATION HELPERS ----------

    function createAlarm() {
        chrome.alarms.create("cf-poll", { periodInMinutes: 0.05 });
        console.log("Alarm created: cf-poll");
    }

    // when extension is installed or updated
    chrome.runtime.onInstalled.addListener(() => {
        createAlarm();
    });

    // when browser starts
    chrome.runtime.onStartup.addListener(() => {
        createAlarm();
    });

    // if service worker wakes and nothing exists, recreate
    chrome.alarms.getAll(alarms => {
        if (!alarms.some(a => a.name === "cf-poll")) {
            createAlarm();
        }
    });

    // run check on alarm
    chrome.alarms.onAlarm.addListener(alarm => {
        if (alarm.name === "cf-poll") {
            check();
        }
    });

});
