document.getElementById("run").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "open-and-summarize" });
  } catch (e) {
    // Content script not yet injected (e.g. extension just installed on an existing tab).
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["src/content.js"],
      });
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ["src/content.css"],
      });
      await chrome.tabs.sendMessage(tab.id, { type: "open-and-summarize" });
    } catch {}
  }
  window.close();
});

document.getElementById("settings").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
  window.close();
});
