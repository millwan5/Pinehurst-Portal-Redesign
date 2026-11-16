// When Brave is closed and the desktop shortcut starts it, the portal page can load before
// this (unpacked) extension has finished loading, so its content scripts never run there.
// Whenever the extension starts, find portal tabs that weren't styled and reload them.
const PAGES = ["*://portals.veracross.au/pinehurst/*", "*://accounts.veracross.au/pinehurst/*"];

async function reloadUnstyledTabs() {
  const tabs = await chrome.tabs.query({ url: PAGES });
  for (const tab of tabs) {
    try {
      // Runs in the same isolated world as the content scripts, so it sees their flag.
      const [res] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.__ppuiLoaded === true,
      });
      if (!res || !res.result) chrome.tabs.reload(tab.id);
    } catch (e) {
      // Tab closed or not scriptable; skip it.
    }
  }
}

chrome.runtime.onStartup.addListener(reloadUnstyledTabs);
chrome.runtime.onInstalled.addListener(reloadUnstyledTabs);
reloadUnstyledTabs();
