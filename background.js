const BLOCKED_SITES = [
  "roblox.com",
  "chatgpt.com",
  "youtube.com",
  "pornhub.com",
  "reddit.com",
  "x.com",
  "facebook.com"
];

function getDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isBlocked(url) {
  const domain = getDomain(url);
  return BLOCKED_SITES.some(site => domain === site || domain.endsWith("." + site));
}

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;

  const result = await chrome.storage.local.get(["workEnvMode"]);
  if (!result.workEnvMode) return;

  if (isBlocked(details.url)) {
    const blockedUrl = chrome.runtime.getURL("pages/blocked.html") + "?site=" + encodeURIComponent(getDomain(details.url));
    chrome.tabs.update(details.tabId, { url: blockedUrl });
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "loading" || !tab.url) return;

  const result = await chrome.storage.local.get(["workEnvMode"]);
  if (!result.workEnvMode) return;

  if (isBlocked(tab.url)) {
    const blockedUrl = chrome.runtime.getURL("pages/blocked.html") + "?site=" + encodeURIComponent(getDomain(tab.url));
    chrome.tabs.update(tabId, { url: blockedUrl });
  }
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.citeMode || changes.workEnvMode || changes.focusTimerActive) {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) return;
        chrome.tabs.sendMessage(tab.id, { type: "SETTINGS_CHANGED" }).catch(() => {});
      });
    });
  }
});
