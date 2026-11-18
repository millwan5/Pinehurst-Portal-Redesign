// Class websites (classes.veracross.au) at document_start: take the portal's look (light or dark, and
// the colour theme) from the first paint. The portal mirrors it to extension storage (content.js,
// mirrorLook); until that arrives, and on first use, it is light and blue.
(() => {
  const root = document.documentElement;
  const PALETTES = /^(teal|forest|violet|rose|sunset|graphite)$/;
  root.classList.add("ppui-classes");
  root.setAttribute("data-ppui-theme", "light");
  try {
    chrome.storage.local.get("ppuiLook", (got) => {
      const look = got && got.ppuiLook;
      if (!look) return;
      if (look.theme === "light" || look.theme === "dark") root.setAttribute("data-ppui-theme", look.theme);
      if (PALETTES.test(look.palette || "")) root.setAttribute("data-ppui-palette", look.palette);
    });
  } catch (e) {}
})();
