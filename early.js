// Runs at document_start, before the portal paints: apply the saved theme and hide the
// native page until content.js has built the dashboard (it removes ppui-booting).
(function () {
  const root = document.documentElement;
  const PORTAL_ORIGIN = "https://portals.veracross.au";

  // A class's assignment page (embedded old portal): restyle it from the first paint, and keep it
  // hidden until embed.js has added its scores and summary (it removes ppui-class-pending).
  if (location.hostname === "portals-embed.veracross.au" && /\/classes\/\d+/.test(location.pathname)) {
    root.classList.add("ppui-class-page", "ppui-class-pending");
    setTimeout(() => root.classList.remove("ppui-class-pending"), 3000);
  }

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

  // The News page: hide the portal's own list until content.js has built ours (it removes the class).
  try {
    if (localStorage.getItem("ppui-news-path") === location.pathname) {
      root.classList.add("ppui-news-pending");
      setTimeout(() => root.classList.remove("ppui-news-pending"), 8000);
    }
  } catch (e) {}

  // The Student Overview page: hide the portal's version until content.js has built ours.
  if (/\/student\/student\/overview\/?$/.test(location.pathname)) {
    root.classList.add("ppui-page-pending");
    setTimeout(() => root.classList.remove("ppui-page-pending"), 8000);
  }

  // Messages: hide the portal's inbox until content.js has built ours.
  if (/\/student\/messages(\/|$)/.test(location.pathname)) {
    root.classList.add("ppui-page-pending");
    setTimeout(() => root.classList.remove("ppui-page-pending"), 4000);
  }

  // Never leave the page blank if the portal or content.js is slow or fails.
  setTimeout(() => root.classList.remove("ppui-booting"), 4000);
})();
