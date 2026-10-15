// Runs at document_start, before the portal paints: apply the saved theme and hide the
// native page until content.js has built the dashboard (it removes ppui-booting).
(function () {
  const root = document.documentElement;
  const PORTAL_ORIGIN = "https://portals.veracross.au";

  // Embedded old-portal pages (portals-embed.veracross.au) live on another origin, so they
  // can't read the saved theme; the top frame sends it. No hiding or dashboard here.
  if (window !== window.top) {
    const system = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    root.setAttribute("data-ppui-theme", system);
    addEventListener("message", (e) => {
      if (e.origin === PORTAL_ORIGIN && e.data && (e.data.ppuiTheme === "light" || e.data.ppuiTheme === "dark")) {
        root.setAttribute("data-ppui-theme", e.data.ppuiTheme);
      }
    });
    window.parent.postMessage({ ppuiAskTheme: true }, PORTAL_ORIGIN);
    return;
  }

  let theme = null;
  try {
    const v = localStorage.getItem("ppui-theme");
    if (v === "light" || v === "dark") theme = v;
  } catch (e) {}
  if (!theme) theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  root.setAttribute("data-ppui-theme", theme);

  root.classList.add("ppui-booting");
  if (/^\/pinehurst\/student\/?$/.test(location.pathname)) root.classList.add("ppui-home");

  // Never leave the page blank if the portal or content.js is slow or fails.
  setTimeout(() => root.classList.remove("ppui-booting"), 4000);
})();
