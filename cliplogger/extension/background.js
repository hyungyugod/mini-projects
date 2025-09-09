chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "cliplogger-save-selection",
        title: "ClipLogger: 선택 텍스트 저장",
        contexts: ["selection"],
    });
});

function notify({ title, message }) {
    chrome.notifications.create({
        type: "basic",
        iconUrl: "icon128.png", // 없으면 임시로 chrome 기본 아이콘 사용됨
        title,
        message,
        priority: 1,
    });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== "cliplogger-save-selection") return;

    const payload = {
        text: info.selectionText || "",
        url: info.pageUrl || tab?.url || "",
        title: tab?.title || "",
        ts: new Date().toISOString(),
    };

    try {
        const res = await fetch("http://127.0.0.1:54545/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        notify({ title: "ClipLogger 실패", message: `HTTP ${res.status}` });
        return;
    }

    const data = await res.json();
    notify({
        title: "ClipLogger 저장 완료",
        message: `${data.path} (${data.format || "txt"})`,
    });
    } catch (e) {
        notify({ title: "ClipLogger 에러", message: String(e) });
    } 
});
