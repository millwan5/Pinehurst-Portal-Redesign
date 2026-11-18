// Runs at document_start, before the portal paints: apply the saved theme and hide the
// native page until content.js has built the dashboard (it removes ppui-booting).
(function () {
  // Lets background.js tell a styled tab from one that loaded before the extension did.
  window.__ppuiLoaded = true;

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
    // Light until the portal says otherwise (its theme arrives by message just after).
    root.setAttribute("data-ppui-theme", "light");
    addEventListener("message", (e) => {
      if (e.origin === PORTAL_ORIGIN && e.data && (e.data.ppuiTheme === "light" || e.data.ppuiTheme === "dark")) {
        root.setAttribute("data-ppui-theme", e.data.ppuiTheme);
        // The portal's accent (its colour theme), so links and today's column match the page around.
        const accent = e.data.ppuiAccent;
        if (typeof accent === "string" && /^#[0-9a-f]{3,8}$/i.test(accent)) root.style.setProperty("--e-accent", accent);
      }
    });
    window.parent.postMessage({ ppuiAskTheme: true }, PORTAL_ORIGIN);
    return;
  }

  // Light, Dark or Auto (follow the system); nothing chosen yet means Light.
  let theme = "light";
  try {
    const v = localStorage.getItem("ppui-theme");
    if (v === "light" || v === "dark") theme = v;
    else if (v === "auto") theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch (e) {}
  root.setAttribute("data-ppui-theme", theme);
  // Colour theme (Customise > Colour) applies from the first paint too.
  try {
    const p = localStorage.getItem("ppui-banner-palette");
    if (/^(teal|forest|violet|rose|sunset|graphite)$/.test(p || "")) root.setAttribute("data-ppui-palette", p);
  } catch (e) {}

  root.classList.add("ppui-booting");
  if (/^\/pinehurst\/student\/?$/.test(location.pathname)) root.classList.add("ppui-home");

  // Which native portal page this is, so styles.css can lay each one out from the first paint.
  const ROUTES = [
    ["calendar", /\/student\/calendar\/(student|school|athletic)\/?$/],
    ["subscribe", /\/student\/calendar\/subscribe(\/|$)/],
    ["planner", /\/student\/student\/upcoming-assignments\/?$/],
    ["daily", /\/student\/student\/daily-schedule\/?$/],
    ["class", /\/student\/student\/classes\/\d+/],
    ["hub", /\/student\/pages\/[^/]+\/?$/],
    ["article", /\/student\/detail\/article\//],
  ];
  for (const [name, re] of ROUTES) {
    if (re.test(location.pathname)) {
      root.classList.add("ppui-native", "ppui-route-" + name);
      break;
    }
  }

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
