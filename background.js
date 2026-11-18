// When Brave is closed and the desktop shortcut starts it, the portal page can load before
// this (unpacked) extension has finished loading, so its content scripts never run there.
// Whenever the extension starts, find portal tabs that weren't styled and reload them.
const PAGES = ["*://portals.veracross.au/pinehurst/*", "*://accounts.veracross.au/pinehurst/*"];

async function reloadIfUnstyled(tab) {
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

// Starting up sets this off more than once (the script running, then the startup or install event):
// they all share one pass, with every tab checked at the same time, so no tab is reloaded twice.
let checking = null;
function reloadUnstyledTabs() {
  checking = checking || chrome.tabs.query({ url: PAGES })
    .then((tabs) => Promise.all(tabs.map(reloadIfUnstyled)))
    .finally(() => { checking = null; });
  return checking;
}

chrome.runtime.onStartup.addListener(reloadUnstyledTabs);
chrome.runtime.onInstalled.addListener(reloadUnstyledTabs);
reloadUnstyledTabs();
