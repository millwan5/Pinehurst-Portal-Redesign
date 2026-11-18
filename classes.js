// Class websites (classes.veracross.au): a banner like the portal's in place of the blue bar, with
// Back and Home in a pill and the class name as the page title. The site's own pages, tabs and
// "Change class" picker keep working; classes.css restyles them.
(() => {
  const root = document.documentElement;
  const PORTAL_HOME = "https://portals.veracross.au/pinehurst/student";
  const clean = (text) => (text || "").replace(/\s+/g, " ").trim();
  const el = (tag, className, text) => {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  // Lucide icons (ISC licence), as in content.js.
  const ICONS = {
    back: [["path", { d: "m15 18-6-6 6-6" }]],
    home: [
      ["path", { d: "M3 10.5 12 3l9 7.5" }],
      ["path", { d: "M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" }],
    ],
  };
  function icon(name) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", "ppui-icon");
    svg.setAttribute("aria-hidden", "true");
    for (const [tag, attrs] of ICONS[name]) {
      const n = document.createElementNS(ns, tag);
      for (const k in attrs) n.setAttribute(k, attrs[k]);
      svg.appendChild(n);
    }
    return svg;
  }

  function buildHeader() {
    if (document.querySelector(".ppui-cls-header")) return;
    const header = el("header", "ppui-cls-header");
    const bar = el("div", "ppui-cls-bar");

    const pill = el("nav", "ppui-cls-pill");
    pill.setAttribute("aria-label", "Go back");
    const back = el("button", "ppui-cls-pill-button");
    back.type = "button";
    back.title = "Back";
    back.setAttribute("aria-label", "Back");
    back.appendChild(icon("back"));
    back.addEventListener("click", () => {
      if (history.length > 1) history.back();
      else location.href = PORTAL_HOME;
    });
    const home = el("a", "ppui-cls-pill-button");
    home.href = PORTAL_HOME;
    home.title = "Portal home";
    home.setAttribute("aria-label", "Portal home");
    home.appendChild(icon("home"));
    pill.append(back, home);
    bar.appendChild(pill);

    // The site's own top bar (Change class, username, log out) moves into the banner, still working.
    const primary = document.querySelector("nav.primary");
    if (primary) bar.appendChild(primary);
    header.appendChild(bar);

    const nameLink = document.querySelector(".class-header h1 a, .class-header h1");
    const name = clean(nameLink && nameLink.textContent);
    if (name) {
      // "10ENG B: IG1 English B" -> kicker "10ENG B", title "IG1 English B".
      const [code, ...rest] = name.split(":");
      const title = el("h1", "ppui-cls-title", clean(rest.join(":")) || name);
      if (rest.length) header.appendChild(el("p", "ppui-cls-kicker", clean(code)));
      header.appendChild(title);
      document.querySelector(".class-header")?.classList.add("ppui-cls-moved");
    }
    document.body.prepend(header);
  }

  // A tab with nothing on it says so, instead of showing an empty white box.
  function markEmpty() {
    const content = document.getElementById("main-content");
    if (!content) return;
    const empty = !clean(content.textContent) && !content.querySelector("img, iframe, table, .fc");
    content.classList.toggle("ppui-cls-empty", empty);
  }

  try {
    buildHeader();
    markEmpty();
    // Some tabs fill in after load (calendar, posts).
    setTimeout(markEmpty, 1500);
  } catch (e) {
    console.warn("[Pinehurst Portal Redesign] Class website header failed.", e);
  } finally {
    root.classList.add("ppui-classes-ready");
  }
})();
