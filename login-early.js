// Sign-in pages (accounts.veracross.au), before first paint: the look last used on the portal (light or
// dark, and the colour theme). The portal mirrors it to extension storage (content.js, mirrorLook).
// On first use, before the portal has ever been opened, it is light and blue.
(function () {
  // Lets background.js tell a styled tab from one that loaded before the extension did.
  window.__ppuiLoaded = true;

  const root = document.documentElement;
  root.setAttribute("data-ppui-theme", "light");
  // The card waits (a moment at most) for the saved look, so a dark-mode user never sees it flash light.
  root.classList.add("ppui-look-pending");
  const done = () => root.classList.remove("ppui-look-pending");
  setTimeout(done, 400);
  try {
    chrome.storage.local.get("ppuiLook", (got) => {
      const look = (got && got.ppuiLook) || {};
      if (look.theme === "light" || look.theme === "dark") root.setAttribute("data-ppui-theme", look.theme);
      if (/^(teal|forest|violet|rose|sunset|graphite)$/.test(look.palette || "")) {
        root.setAttribute("data-ppui-palette", look.palette);
      }
      done();
    });
  } catch (e) {
    done();
  }
})();
