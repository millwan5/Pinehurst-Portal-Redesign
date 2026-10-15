// Pinehurst Dashboard: replaces the portal's top bar with a slim header (logo, greeting, one control pill)
// and lays today's timetable, classes and news out as a dashboard on the home page.
// Runs only on the signed-in student's own portal and reads only same-origin pages.

(() => {
  // Everything that depends on the portal's markup lives here.
  const SEL = {
    app: ".app-container",
    regions: ".app-container > .ae-grid",
    region: ".portal-screen-region",
    block: ".portal-screen-block",
    mainRegion: ".portal-screen-region.item-md-9",
    sideRegion: ".portal-screen-region.item-md-3",
    newsComponent: ".component-notification-link",
    unreadCount: ".component-unread-messages-count",
    iconLink: ".component-icon-link",
    eventsComponent: ".component-my-events-student",
    eventsDay: ".day",
    eventsDayHeader: ".day-header",
    // Top bar (hidden by styles.css; read for links).
    navAccount: ".vx-nav-account",
    inboxIcon: ".vx-nav-button__inbox-icon",
    hoverMenuLink: ".vx-hover-menu a",
    portalNavLink: ".vx-portal-nav__item-link",
    // Class list.
    classList: ".component-class-list-student",
    course: ".course",
    courseName: ".course-name",
    courseTeacher: ".course-teacher",
    meetingToday: ".meeting-today",
    courseLinks: ".course-links a",
    notificationsLink: ".notifications-link",
    notificationBadge: ".notification-badge",
    assignmentsLink: ".assignments-link",
    // Daily schedule page.
    scheduleRoot: ".daily-schedule .schedule",
    scheduleItem: ".vx-schedule-item",
    itemTime: ".item-time",
    itemTitle: ".item-main-description",
    itemSubtitle: ".item-subtitle",
    nowIndicator: ".now-indicator",
    // News page (hydrated client-side, so it is read from a hidden same-origin iframe).
    article: ".article",
    articleTitle: ".article-title",
    articleDate: ".article-date",
  };
  const HOME_PATH = /^\/pinehurst\/student\/?$/;
  const HOME_URL = "/pinehurst/student";
  const SCHEDULE_URL = "/pinehurst/student/student/daily-schedule";
  // The portal's page config carries the signed-in student's name, e.g. full_name: "Sam Lee".
  const FULL_NAME = /full_name"?\s*:\s*"([^"]+)"/;
  const REFRESH_MS = 5 * 60 * 1000;
  const WAIT_MS = 10000;
  const NAV_WAIT_MS = 6000;
  const NEWS_WAIT_MS = 12000;
  const NEWS_COUNT = 5;
  const APPS_KEY = "ppui-apps";

  // Launcher groups, matched against each link's label in order; unmatched links go to "Other".
  const APP_GROUPS = [
    ["Calendars", /calendar|timetable/i],
    ["Learning", /class|assignment|academic|exam|schedule/i],
    ["Microsoft 365", /outlook|teams|onenote|onedrive/i],
    ["School life", /student central|wellbeing|ict|homepage|news|map|tuck/i],
    ["Account", /monitor|balance|polic/i],
  ];
  // Links the header already shows, so the launcher skips them.
  const APP_SKIP = /unread messages|^messages$/i;

  // Icons: Lucide (https://lucide.dev, ISC licence), 24px grid, drawn with currentColor strokes.
  const ICONS = {
    mail: [
      ["rect", { x: 2, y: 4, width: 20, height: 16, rx: 2 }],
      ["path", { d: "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" }],
    ],
    grid: [
      ["rect", { x: 3, y: 3, width: 7, height: 7, rx: 1.5 }],
      ["rect", { x: 14, y: 3, width: 7, height: 7, rx: 1.5 }],
      ["rect", { x: 14, y: 14, width: 7, height: 7, rx: 1.5 }],
      ["rect", { x: 3, y: 14, width: 7, height: 7, rx: 1.5 }],
    ],
    sun: [
      ["circle", { cx: 12, cy: 12, r: 4 }],
      ["path", { d: "M12 2v2M12 20v2m-7.07-17.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" }],
    ],
    moon: [["path", { d: "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" }]],
    ellipsis: [
      ["circle", { cx: 5, cy: 12, r: 1 }],
      ["circle", { cx: 12, cy: 12, r: 1 }],
      ["circle", { cx: 19, cy: 12, r: 1 }],
    ],
    external: [["path", { d: "M7 7h10v10M7 17 17 7" }]],
    search: [["circle", { cx: 11, cy: 11, r: 8 }], ["path", { d: "m21 21-4.3-4.3" }]],
    calendarClock: [
      ["path", { d: "M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5M16 2v4M8 2v4M3 10h5" }],
      ["path", { d: "M17.5 17.5 16 16.3V14" }],
      ["circle", { cx: 16, cy: 16, r: 6 }],
    ],
    bookOpen: [["path", { d: "M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" }]],
    newspaper: [
      ["path", { d: "M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" }],
      ["path", { d: "M18 14h-8M15 18h-5M10 6h8v4h-8V6Z" }],
    ],
    // Subject icons (Lucide).
    penLine: [
      ["path", { d: "M12 20h9" }],
      ["path", { d: "M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" }],
    ],
    calculator: [
      ["rect", { x: 4, y: 2, width: 16, height: 20, rx: 2 }],
      ["path", { d: "M8 6h8M16 14v4M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01" }],
    ],
    atom: [
      ["circle", { cx: 12, cy: 12, r: 1 }],
      ["path", { d: "M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z" }],
      ["path", { d: "M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z" }],
    ],
    flask: [
      ["path", { d: "M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2M8.5 2h7M7 16h10" }],
    ],
    leaf: [
      ["path", { d: "M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" }],
      ["path", { d: "M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" }],
    ],
    code: [["path", { d: "m18 16 4-4-4-4M6 8l-4 4 4 4M14.5 4l-5 16" }]],
    coins: [
      ["circle", { cx: 8, cy: 8, r: 6 }],
      ["path", { d: "M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4m8.71 3.88.7.71-2.82 2.82" }],
    ],
    globe: [
      ["circle", { cx: 12, cy: 12, r: 10 }],
      ["path", { d: "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20" }],
    ],
    landmark: [
      ["path", { d: "M10 18v-7M14 18v-7M18 18v-7M6 18v-7M3 22h18" }],
      ["path", { d: "M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z" }],
    ],
    palette: [
      ["circle", { cx: 13.5, cy: 6.5, r: 0.5 }],
      ["circle", { cx: 17.5, cy: 10.5, r: 0.5 }],
      ["circle", { cx: 6.5, cy: 12.5, r: 0.5 }],
      ["circle", { cx: 8.5, cy: 7.5, r: 0.5 }],
      ["path", { d: "M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" }],
    ],
    music: [
      ["path", { d: "M9 18V5l12-2v13" }],
      ["circle", { cx: 6, cy: 18, r: 3 }],
      ["circle", { cx: 18, cy: 16, r: 3 }],
    ],
    activity: [["path", { d: "M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" }]],
    languages: [["path", { d: "m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6" }]],
    wrench: [["path", { d: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" }]],
    chart: [["path", { d: "M3 3v16a2 2 0 0 0 2 2h16M18 17V9M13 17V5M8 17v-3" }]],
    trendingUp: [["path", { d: "M16 7h6v6M22 7l-8.5 8.5-5-5L2 17" }]],
  };

  // Pick a subject icon from the class name; anything unrecognised gets an open book.
  const SUBJECT_ICONS = [
    [/english|literature|writing|drama|media/i, "penLine"],
    [/statistic/i, "chart"],
    [/math|calculus|algebra|geometry|numeracy/i, "calculator"],
    [/physic/i, "atom"],
    [/chem|^science/i, "flask"],
    [/bio|health|horticult|agri/i, "leaf"],
    [/comput|digital|program|coding|software|^it$/i, "code"],
    [/account/i, "coins"],
    [/econom|business|enterprise|finance/i, "trendingUp"],
    [/geograph|global|perspective|social|environment/i, "globe"],
    [/histor|classic|politic|law|legal/i, "landmark"],
    [/art|design|visual|photo/i, "palette"],
    [/music|band|choir/i, "music"],
    [/\bpe\b|sport|physical|fitness|movement/i, "activity"],
    [/french|spanish|german|japanese|chinese|latin|m[aā]ori|language|te reo/i, "languages"],
    [/tech|engineer|wood|metal|workshop|robot|material/i, "wrench"],
  ];

  function subjectIcon(name) {
    for (const [re, key] of SUBJECT_ICONS) if (re.test(name)) return key;
    return "bookOpen";
  }

  // Pinehurst crest: grey tree over a blue open book, traced from the school logo.
  const LOGO = [
    ["polygon", { points: "80,120 300,165 530,120 530,540 330,500 300,505 80,540", class: "ppui-logo-book" }],
    ["polygon", { points: "107,147 300,188 503,147 503,512 330,478 300,482 107,512", class: "ppui-logo-pages" }],
    ["polygon", { points: "302,15 460,455 330,492 330,545 230,513 145,488", class: "ppui-logo-tree" }],
  ];

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function clean(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  // Only trust links that stay on this portal's own origin.
  function sameOriginHref(href) {
    try {
      const url = new URL(href, location.href);
      return url.origin === location.origin ? url.href : null;
    } catch (e) {
      return null;
    }
  }

  // Other sites are allowed in the launcher, but only as plain http(s) links.
  function safeHref(href) {
    try {
      const url = new URL(href, location.href);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
    } catch (e) {
      return null;
    }
  }

  function linkTo(a, href) {
    a.href = href;
    if (!sameOriginHref(href)) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
    return a;
  }

  function svgIcon(className, paths, viewBox) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", viewBox || "0 0 24 24");
    svg.setAttribute("class", className);
    svg.setAttribute("aria-hidden", "true");
    for (const [tag, attrs] of paths) {
      const n = document.createElementNS(ns, tag);
      for (const k in attrs) n.setAttribute(k, attrs[k]);
      svg.appendChild(n);
    }
    return svg;
  }

  function icon(name, extraClass) {
    return svgIcon("ppui-icon" + (extraClass ? " " + extraClass : ""), ICONS[name]);
  }

  function externalMark(a) {
    if (!a.target) return;
    a.appendChild(icon("external", "ppui-ext"));
    a.appendChild(el("span", "ppui-sr", " (opens in new tab)"));
  }

  // Run fn once `ready()` returns truthy, watching the DOM until timeoutMs; then run it anyway.
  function whenReady(ready, fn, timeoutMs) {
    if (ready()) {
      fn();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      observer.disconnect();
      fn();
    };
    const observer = new MutationObserver(() => {
      if (ready()) finish();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(finish, timeoutMs);
  }

  // ---- Theme (every portal page) ----
  const THEME_KEY = "ppui-theme";
  const root = document.documentElement;

  function savedTheme() {
    try {
      const v = localStorage.getItem(THEME_KEY);
      return v === "light" || v === "dark" ? v : null;
    } catch (e) {
      return null;
    }
  }

  function systemTheme() {
    return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(theme) {
    root.setAttribute("data-ppui-theme", theme);
    tellFrames(theme);
  }

  // Embedded portal pages (other origin) can't read our saved theme: send it to them.
  const EMBED_ORIGIN = "https://portals-embed.veracross.au";
  function tellFrames(theme) {
    document.querySelectorAll("iframe").forEach((f) => {
      try {
        f.contentWindow.postMessage({ ppuiTheme: theme }, EMBED_ORIGIN);
      } catch (e) {}
    });
  }
  // The frame may ask before we listen, so also push the theme whenever one finishes loading.
  document.addEventListener(
    "load",
    (e) => {
      if (e.target.tagName === "IFRAME") tellFrames(root.getAttribute("data-ppui-theme") || "light");
    },
    true,
  );
  addEventListener("message", (e) => {
    if (e.origin === EMBED_ORIGIN && e.data && e.data.ppuiAskTheme) {
      tellFrames(root.getAttribute("data-ppui-theme") || "light");
    }
  });

  function buildToggle() {
    const btn = el("button", "ppui-bar-button ppui-theme-toggle");
    btn.type = "button";
    btn.title = "Switch light / dark";
    btn.setAttribute("aria-label", "Switch between light and dark mode");
    btn.append(icon("sun", "ppui-sun"), icon("moon", "ppui-moon"));
    btn.addEventListener("click", () => {
      const next = root.getAttribute("data-ppui-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch (e) {}
    });
    return btn;
  }

  // ---- Popovers (native Popover API: light dismiss, Esc and top layer for free) ----
  let popoverCount = 0;

  function placePopover(trigger, pop) {
    if (matchMedia("(max-width: 640px)").matches) {
      pop.style.top = pop.style.left = "";
      return;
    }
    const r = trigger.getBoundingClientRect();
    const width = pop.offsetWidth;
    const left = Math.min(Math.max(8, r.right - width), innerWidth - width - 8);
    pop.style.left = left + "px";
    pop.style.top = Math.min(r.bottom + 8, innerHeight - pop.offsetHeight - 8) + "px";
  }

  // Wire a <button> to open `pop`; onOpen runs each time it opens (fill or focus content).
  function popover(trigger, pop, onOpen) {
    pop.id = "ppui-pop-" + ++popoverCount;
    pop.popover = "auto";
    pop.classList.add("ppui-popover");
    trigger.popoverTargetElement = pop;
    trigger.setAttribute("aria-controls", pop.id);
    trigger.setAttribute("aria-expanded", "false");
    pop.addEventListener("beforetoggle", (e) => {
      if (e.newState === "open" && onOpen) onOpen();
    });
    pop.addEventListener("toggle", (e) => {
      const open = e.newState === "open";
      trigger.setAttribute("aria-expanded", String(open));
      if (open) placePopover(trigger, pop);
    });
    addEventListener("resize", () => {
      if (pop.matches(":popover-open")) placePopover(trigger, pop);
    });
    document.body.appendChild(pop);
    return pop;
  }

  // Up/Down arrows move between the focusable items inside a popover.
  function arrowNav(pop, selector) {
    pop.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const items = [...pop.querySelectorAll(selector)].filter((n) => n.offsetParent !== null);
      if (!items.length) return;
      e.preventDefault();
      const i = items.indexOf(document.activeElement);
      const next = e.key === "ArrowDown" ? i + 1 : i - 1;
      items[(next + items.length) % items.length].focus();
    });
  }

  // ---- Apps launcher (every portal page) ----

  // Read every link the portal scatters around: hidden top bar, side column, resource tiles, Microsoft menu.
  function harvestApps() {
    const anchors = [...document.querySelectorAll(SEL.hoverMenuLink)];
    // Top-bar links, minus the Microsoft heading whose real links sit in its hover menu.
    for (const a of document.querySelectorAll(SEL.portalNavLink)) {
      const item = a.closest("li");
      if (!(item && item.querySelector(".vx-hover-menu"))) anchors.push(a);
    }
    const side = document.querySelector(SEL.sideRegion);
    if (side) anchors.push(...side.querySelectorAll("a"));
    const main = document.querySelector(SEL.mainRegion);
    if (main) anchors.push(...main.querySelectorAll(SEL.iconLink + " a"));
    const items = [];
    for (const a of anchors) {
      const label = clean(a.textContent);
      const href = safeHref(a.getAttribute("href"));
      if (label && href && !APP_SKIP.test(label)) items.push({ label, href });
    }
    return items;
  }

  function cachedApps() {
    try {
      const list = JSON.parse(localStorage.getItem(APPS_KEY) || "[]");
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function saveApps(items) {
    try {
      localStorage.setItem(APPS_KEY, JSON.stringify(items));
    } catch (e) {}
  }

  // Live links first, then the copy saved from the home page; one entry per label.
  function allApps() {
    const seen = new Set();
    const out = [];
    for (const item of [...harvestApps(), ...cachedApps()]) {
      const href = item && safeHref(item.href);
      const label = item && clean(item.label);
      if (!href || !label || seen.has(label.toLowerCase())) continue;
      seen.add(label.toLowerCase());
      out.push({ label, href });
    }
    return out;
  }

  function groupApps(items) {
    const groups = new Map([...APP_GROUPS.map(([name]) => [name, []]), ["Other", []]]);
    for (const item of items) {
      const match = APP_GROUPS.find(([, re]) => re.test(item.label));
      groups.get(match ? match[0] : "Other").push(item);
    }
    return [...groups].filter(([, list]) => list.length);
  }

  function buildApps() {
    const btn = el("button", "ppui-bar-button ppui-apps-button");
    btn.type = "button";
    btn.title = "Apps and links (Ctrl+K)";
    btn.setAttribute("aria-label", "Apps and links");
    btn.appendChild(icon("grid"));

    const pop = el("div", "ppui-apps");
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", "Apps and links");
    const field = el("label", "ppui-apps-field");
    field.appendChild(icon("search"));
    const search = el("input", "ppui-apps-search");
    // Plain text, not type=search: a search field eats the first Esc to clear itself.
    search.type = "text";
    search.setAttribute("role", "searchbox");
    search.placeholder = "Search apps and links";
    search.setAttribute("aria-label", "Search apps and links");
    search.autocomplete = "off";
    field.appendChild(search);
    const body = el("div", "ppui-apps-groups");
    const empty = el("p", "ppui-apps-empty");
    empty.hidden = true;
    pop.append(field, body, empty);

    function render() {
      body.replaceChildren();
      const items = allApps();
      for (const [name, list] of groupApps(items)) {
        const group = el("section", "ppui-apps-group");
        group.appendChild(el("h3", "ppui-apps-title", name));
        const ul = el("ul", "ppui-apps-list");
        for (const item of list) {
          const li = el("li");
          const a = linkTo(el("a", "ppui-app", item.label), item.href);
          externalMark(a);
          li.appendChild(a);
          ul.appendChild(li);
        }
        group.appendChild(ul);
        body.appendChild(group);
      }
      if (!items.length) {
        body.appendChild(el("p", "ppui-apps-empty", "Open the portal home page once to load your links here."));
      }
      filter();
    }

    function filter() {
      const q = search.value.trim().toLowerCase();
      let shown = 0;
      for (const group of body.querySelectorAll(".ppui-apps-group")) {
        let groupShown = 0;
        for (const li of group.querySelectorAll("li")) {
          const hit = !q || li.textContent.toLowerCase().includes(q);
          li.hidden = !hit;
          if (hit) groupShown++;
        }
        group.hidden = !groupShown;
        shown += groupShown;
      }
      empty.hidden = !q || shown > 0;
      empty.textContent = 'Nothing matches "' + search.value.trim() + '".';
    }

    search.addEventListener("input", filter);
    search.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const first = [...body.querySelectorAll(".ppui-app")].find((a) => a.offsetParent !== null);
      if (first) first.click();
    });
    arrowNav(pop, ".ppui-apps-search, .ppui-app");

    popover(btn, pop, () => {
      search.value = "";
      render();
    });
    pop.addEventListener("toggle", (e) => {
      if (e.newState === "open") search.focus();
    });

    // Ctrl+K or "/" (outside text fields) opens the launcher.
    addEventListener("keydown", (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) ||
        document.activeElement.isContentEditable;
      const combo = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k";
      if (!combo && !(e.key === "/" && !typing)) return;
      e.preventDefault();
      if (!pop.matches(":popover-open")) pop.showPopover();
    });
    return btn;
  }

  // ---- Header (every portal page): brand, greeting on home, control pill ----

  function studentName() {
    for (const script of document.scripts) {
      const m = script.textContent.match(FULL_NAME);
      if (m) return clean(m[1]);
    }
    return "";
  }

  function greeting(date) {
    const h = date.getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  }

  function todayLabel() {
    return new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
  }

  function buildMessages() {
    const inbox = document.querySelector(SEL.inboxIcon);
    const link = inbox && inbox.closest("a");
    const href = link && sameOriginHref(link.getAttribute("href"));
    if (!href) return null;
    const a = el("a", "ppui-bar-button ppui-messages");
    a.href = href;
    a.title = "Messages";
    a.setAttribute("aria-label", "Messages");
    a.appendChild(icon("mail"));
    return a;
  }

  function buildAccount() {
    const initials = document.querySelector(SEL.navAccount);
    if (!initials) return null;
    const a = el("button", "ppui-bar-button ppui-avatar", clean(initials.textContent).slice(0, 3));
    a.type = "button";
    a.title = "Account";
    a.setAttribute("aria-label", "Account");

    // The portal's own account link is a javascript: handler, so the menu lists the real pages it leads to.
    const find = (sel, fallback) => {
      const found = document.querySelector(sel);
      return safeHref(found ? found.getAttribute("href") : fallback);
    };
    const menu = el("ul", "ppui-menu");
    menu.setAttribute("aria-label", "Account");
    for (const [label, href] of [
      ["Change password", find('a[href*="reset_password"]', "https://accounts.veracross.au/pinehurst/accounts/reset_password")],
      ["Log out", find('a[href*="/logout"]', "/pinehurst/logout")],
    ]) {
      const li = el("li");
      li.appendChild(linkTo(el("a", "ppui-menu-item", label), href));
      menu.appendChild(li);
    }
    arrowNav(menu, ".ppui-menu-item");
    popover(a, menu);
    menu.addEventListener("toggle", (e) => {
      if (e.newState === "open") menu.querySelector("a").focus();
    });
    return a;
  }

  function buildHeader() {
    const header = el("header", "ppui-header");

    const brand = el("a", "ppui-brand");
    brand.href = HOME_URL;
    brand.setAttribute("aria-label", "Pinehurst Dashboard home");
    brand.appendChild(svgIcon("ppui-logo", LOGO, "75 10 460 540"));
    const brandName = el("span", "ppui-brand-name");
    brandName.append(el("span", "ppui-brand-title", "Pinehurst"), el("span", "ppui-brand-sub", "Dashboard"));
    brand.appendChild(brandName);

    const pill = el("nav", "ppui-pill");
    pill.setAttribute("aria-label", "Portal tools");
    const messages = buildMessages();
    const account = buildAccount();
    if (messages) pill.appendChild(messages);
    pill.append(buildApps(), buildToggle());
    if (account) pill.appendChild(account);

    const top = el("div", "ppui-header-top");
    top.append(brand, pill);
    header.appendChild(top);

    if (HOME_PATH.test(location.pathname)) {
      const name = studentName().split(" ")[0];
      const hello = el("h1", "ppui-greeting");
      const date = el("p", "ppui-date", todayLabel());
      const update = () => {
        const now = new Date();
        hello.textContent = greeting(now) + (name ? ", " + name : "");
        date.textContent = todayLabel();
      };
      update();
      setInterval(update, 60 * 1000);
      header.append(hello, date);
    }

    const app = document.querySelector(SEL.app);
    if (app) app.prepend(header);
    else {
      header.classList.add("is-standalone");
      document.body.prepend(header);
    }
    return header;
  }

  applyTheme(savedTheme() || systemTheme());
  // Lift the early.js cover once our UI is in place.
  function reveal() {
    root.classList.remove("ppui-booting");
  }
  // The top bar hydrates late; wait for it so Messages and Account can borrow its links.
  whenReady(
    () => document.querySelector(SEL.navAccount) && document.querySelector(SEL.app),
    () => {
      if (!document.querySelector(".ppui-header")) buildHeader();
      if (HOME_PATH.test(location.pathname)) showUnread();
      else reveal();
    },
    NAV_WAIT_MS,
  );

  if (!HOME_PATH.test(location.pathname)) return;
  root.classList.add("ppui-home");

  // A card: heading row (icon, title, optional link) followed by a body.
  function panel(className, iconName, title, linkLabel, linkHref) {
    const section = el("section", "ppui-panel ppui-card " + className);
    const head = el("div", "ppui-head");
    const h = el("h2", "ppui-title");
    h.append(icon(iconName, "ppui-title-icon"), document.createTextNode(title));
    head.appendChild(h);
    if (linkLabel) {
      const link = el("a", "ppui-link", linkLabel);
      link.href = linkHref;
      head.appendChild(link);
    }
    section.appendChild(head);
    return section;
  }

  // "IG1 English B" -> "English": drop the year-level prefix and the class-set letter.
  function shortName(name) {
    return clean(name).replace(/^[A-Z]{0,3}\d{1,2}\s+/, "").replace(/\s+[A-Z]$/, "") || clean(name);
  }

  // "Mr. Campbell, Mr. Jujnovich • Period 6 • 101" -> "Mr. Campbell +1 · Room 101".
  function shortSubtitle(text) {
    return text.split("•").map(clean).filter((part) => part && !/^period\s*\d+$/i.test(part))
      .map((part) => {
        if (/^\d+[A-Z]?$/i.test(part)) return "Room " + part;
        const people = part.split(",").map(clean).filter(Boolean);
        return people.length > 1 ? people[0] + " +" + (people.length - 1) : part;
      })
      .join(" · ");
  }

  // "1:40 pm" -> minutes since midnight, or null.
  function minutesOf(time) {
    const m = time.match(/(\d{1,2}):(\d{2})\s*([ap]m)?/i);
    if (!m) return null;
    let h = Number(m[1]) % 12;
    if (m[3] && m[3].toLowerCase() === "pm") h += 12;
    return h * 60 + Number(m[2]);
  }

  function parseSchedule(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const root = doc.querySelector(SEL.scheduleRoot);
    if (!root) return null;
    return [...root.querySelectorAll(SEL.scheduleItem)].map((item) => {
      const timeNode = item.querySelector(SEL.itemTime);
      let time = "";
      if (timeNode) {
        const first = [...timeNode.childNodes].find((n) => n.nodeType === Node.TEXT_NODE);
        time = clean(first ? first.textContent : "");
      }
      const title = item.querySelector(SEL.itemTitle);
      const subtitle = item.querySelector(SEL.itemSubtitle);
      let name = shortName(title ? title.textContent : "");
      let meta = shortSubtitle(subtitle ? subtitle.textContent : "");
      if (!name || /^period\s*\d+$/i.test(name)) {
        name = meta;
        meta = "";
      }
      return {
        start: minutesOf(time),
        time: time.replace(/\s*[ap]m$/i, ""),
        now: !!item.querySelector(SEL.nowIndicator),
        title: name,
        subtitle: meta,
      };
    });
  }

  // The class on now, else the next one today, else nothing.
  function featuredItem(items) {
    const nowIndex = items.findIndex((item) => item.now);
    if (nowIndex >= 0) return { item: items[nowIndex], next: items[nowIndex + 1], label: "Now" };
    const d = new Date();
    const minutes = d.getHours() * 60 + d.getMinutes();
    const nextIndex = items.findIndex((item) => item.start !== null && item.start > minutes);
    if (nextIndex >= 0) return { item: items[nextIndex], label: "Next" };
    return null;
  }

  function renderFeatured(box, items) {
    box.replaceChildren();
    const pick = featuredItem(items);
    box.hidden = !pick;
    if (!pick) return;
    box.classList.toggle("is-next", pick.label === "Next");
    const when = pick.label === "Now"
      ? (pick.next ? "until " + pick.next.time : "last one today")
      : "at " + pick.item.time;
    box.appendChild(el("span", "ppui-feature-label", pick.label + " " + when));
    box.appendChild(el("span", "ppui-feature-class", pick.item.title));
    if (pick.item.subtitle) box.appendChild(el("span", "ppui-meta", pick.item.subtitle));
  }

  function renderRows(list, items) {
    list.replaceChildren();
    if (!items.length) {
      list.appendChild(el("li", "ppui-empty", "Nothing scheduled today."));
      return;
    }
    const nowIndex = items.findIndex((item) => item.now);
    items.forEach((item, i) => {
      const row = el("li", "ppui-row" + (item.now ? " is-now" : "") + (i < nowIndex ? " is-past" : ""));
      row.appendChild(el("span", "ppui-time", item.time));
      const body = el("div", "ppui-body");
      body.appendChild(el("span", "ppui-class", item.title));
      if (item.subtitle) body.appendChild(el("span", "ppui-meta", item.subtitle));
      row.appendChild(body);
      list.appendChild(row);
    });
  }

  function buildTodayPanel() {
    const section = panel("ppui-today", "calendarClock", "Today", "Full schedule", SCHEDULE_URL);
    const featured = el("div", "ppui-feature");
    featured.hidden = true;
    const list = el("ul", "ppui-rows");
    list.appendChild(el("li", "ppui-empty", "Loading schedule..."));
    section.append(featured, list);

    async function load() {
      try {
        const res = await fetch(SCHEDULE_URL, { credentials: "same-origin" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const items = parseSchedule(await res.text());
        if (!items) throw new Error("schedule markup not found");
        renderFeatured(featured, items);
        renderRows(list, items);
      } catch (e) {
        featured.hidden = true;
        list.replaceChildren();
        const fallback = el("li", "ppui-empty");
        fallback.appendChild(document.createTextNode("Could not load today's schedule. "));
        const link = el("a", "ppui-link", "Open Daily Schedule");
        link.href = SCHEDULE_URL;
        fallback.appendChild(link);
        list.appendChild(fallback);
      }
    }

    load();
    setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_MS);
    return section;
  }

  // The news page fills itself in with JS, so a plain fetch returns an empty shell.
  // Load it in a hidden same-origin iframe, wait for the articles, copy them out, remove it.
  function loadArticles(href) {
    return new Promise((resolve, reject) => {
      const frame = el("iframe", "ppui-frame");
      frame.setAttribute("aria-hidden", "true");
      frame.tabIndex = -1;
      frame.src = href;

      const started = Date.now();
      const timer = setInterval(() => {
        let nodes = [];
        try {
          nodes = frame.contentDocument ? [...frame.contentDocument.querySelectorAll(SEL.article)] : [];
        } catch (e) {
          done(e);
          return;
        }
        if (nodes.length) {
          done(null, nodes.slice(0, NEWS_COUNT).map(readArticle));
        } else if (Date.now() - started > NEWS_WAIT_MS) {
          done(new Error("no articles found"));
        }
      }, 200);

      function done(err, items) {
        clearInterval(timer);
        frame.remove();
        if (err) reject(err);
        else resolve(items);
      }

      document.body.appendChild(frame);
    });
  }

  // "October 14, 2026" -> "14 Oct"; anything unparseable is kept as written.
  function shortDate(text) {
    const d = new Date(text);
    return isNaN(d) ? text : d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  }

  function readArticle(node) {
    const text = (sel) => clean((node.querySelector(sel) || {}).textContent);
    const link = node.querySelector(SEL.articleTitle);
    return {
      title: text(SEL.articleTitle),
      date: shortDate(text(SEL.articleDate)),
      href: link ? sameOriginHref(link.getAttribute("href")) : null,
    };
  }

  function renderNews(list, items, newsHref) {
    list.replaceChildren();
    if (!items.length) {
      list.appendChild(el("li", "ppui-empty", "No news right now."));
      return;
    }
    for (const item of items) {
      const row = el("li", "ppui-story");
      const title = el("a", "ppui-headline", item.title);
      title.href = item.href || newsHref;
      row.appendChild(title);
      if (item.date) row.appendChild(el("span", "ppui-meta", item.date));
      list.appendChild(row);
    }
  }

  function buildNewsPanel(newsLink) {
    const section = panel("ppui-news", "newspaper", "News", "All news", newsLink.href);
    const list = el("ul", "ppui-stories");
    list.appendChild(el("li", "ppui-empty", "Loading news..."));
    section.appendChild(list);

    async function load() {
      try {
        renderNews(list, await loadArticles(newsLink.href), newsLink.href);
      } catch (e) {
        list.replaceChildren();
        const fallback = el("li", "ppui-empty");
        fallback.appendChild(document.createTextNode("Could not load news. "));
        const link = el("a", "ppui-link", "Open " + newsLink.label);
        link.href = newsLink.href;
        fallback.appendChild(link);
        list.appendChild(fallback);
      }
    }

    load();
    setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_MS);
    return section;
  }

  function findNews() {
    for (const comp of document.querySelectorAll(SEL.newsComponent)) {
      const a = comp.matches("a") ? comp : comp.querySelector("a");
      if (!a) continue;
      const href = sameOriginHref(a.getAttribute("href"));
      if (href && /news/i.test(href)) {
        const label = clean(a.textContent) || "School News";
        return { comp, href, label };
      }
    }
    return null;
  }

  // ---- Classes card ----

  function readCourse(node) {
    const text = (sel) => clean((node.querySelector(sel) || {}).textContent);
    const href = (a) => (a ? sameOriginHref(a.getAttribute("href")) : null);
    const nameLink = node.querySelector(SEL.courseName);
    const period = text(SEL.meetingToday).match(/Period\s*(\d+)/i);
    // Class website and calendar live on classes.veracross.au, so they are allowed off-origin.
    const links = [...node.querySelectorAll(SEL.courseLinks)]
      .map((a) => ({ label: clean(a.textContent), href: safeHref(a.getAttribute("href")) }));
    const notes = node.querySelector(SEL.notificationsLink);
    links.push({ label: "Assignments", href: href(node.querySelector(SEL.assignmentsLink)) });
    links.push({ label: "Updates", href: href(notes) });
    return {
      name: shortName(nameLink && nameLink.textContent),
      href: href(nameLink),
      teacher: text(SEL.courseTeacher),
      // Only used to order today's classes.
      period: period ? Number(period[1]) : null,
      updates: parseInt(text(SEL.notificationBadge), 10) || 0,
      updatesHref: href(notes),
      links: links.filter((l) => l.label && l.href),
    };
  }

  // A steady, muted hue per class so the same class keeps its dot colour.
  function hueFor(name) {
    let h = 2166136261;
    for (const c of name) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return (h >>> 0) % 360;
  }

  function courseRow(course) {
    const row = el("li", "ppui-course");
    const badgeIcon = el("span", "ppui-subject");
    badgeIcon.style.setProperty("--ppui-hue", String(hueFor(course.name)));
    badgeIcon.appendChild(icon(subjectIcon(course.name)));
    row.appendChild(badgeIcon);

    const body = el("div", "ppui-body");
    const name = el(course.href ? "a" : "span", "ppui-class", course.name);
    if (course.href) name.href = course.href;
    body.appendChild(name);
    if (course.teacher) body.appendChild(el("span", "ppui-meta", course.teacher));
    row.appendChild(body);

    if (course.updates && course.updatesHref) {
      const badge = el("a", "ppui-badge", String(course.updates));
      badge.href = course.updatesHref;
      badge.title = course.updates + " new updates";
      badge.setAttribute("aria-label", course.updates + " new updates in " + course.name);
      row.appendChild(badge);
    } else {
      row.appendChild(el("span"));
    }

    if (course.links.length) {
      const more = el("button", "ppui-more");
      more.type = "button";
      more.setAttribute("aria-label", "More for " + course.name);
      more.appendChild(icon("ellipsis"));
      const menu = el("ul", "ppui-menu");
      menu.setAttribute("aria-label", course.name);
      for (const link of course.links) {
        const li = el("li");
        const a = linkTo(el("a", "ppui-menu-item", link.label), link.href);
        externalMark(a);
        li.appendChild(a);
        menu.appendChild(li);
      }
      arrowNav(menu, ".ppui-menu-item");
      popover(more, menu);
      menu.addEventListener("toggle", (e) => {
        if (e.newState === "open") menu.querySelector("a").focus();
      });
      row.appendChild(more);
    }
    return row;
  }

  function buildClassesPanel(listComp, classesHref) {
    const courses = [...listComp.querySelectorAll(SEL.course)].map(readCourse).filter((c) => c.name);
    if (!courses.length) return null;
    const today = courses.filter((c) => c.period).sort((a, b) => a.period - b.period);
    const later = courses.filter((c) => !c.period);

    const section = panel("ppui-classes", "bookOpen", "Classes", "All classes", classesHref || listComp.baseURI);
    const list = el("ul", "ppui-courses");
    if (!today.length) list.appendChild(el("li", "ppui-empty", "No classes today."));
    today.forEach((c) => list.appendChild(courseRow(c)));
    section.appendChild(list);

    if (later.length) {
      const more = el("details", "ppui-later");
      more.appendChild(el("summary", "ppui-later-toggle", "Not today (" + later.length + ")"));
      const rest = el("ul", "ppui-courses");
      later.forEach((c) => rest.appendChild(courseRow(c)));
      more.appendChild(rest);
      section.appendChild(more);
    }
    return section;
  }

  // ---- Fold the rest of the home page ----

  function eventsAreEmpty(comp) {
    const days = [...comp.querySelectorAll(SEL.eventsDay)];
    return days.every((day) => {
      const head = day.querySelector(SEL.eventsDayHeader);
      return clean(day.textContent) === clean(head && head.textContent);
    });
  }

  // Keep the events calendar only when it has something in it, and the class list only if
  // the Classes card could not be built. A heading block stays when the block after it stays.
  function foldBlocks(grid, classesBuilt) {
    const side = grid.querySelector(SEL.sideRegion);
    if (side) side.classList.add("ppui-moved");
    const main = grid.querySelector(SEL.mainRegion);
    if (!main) return;
    const blocks = [...main.querySelectorAll(SEL.block)];
    const keep = blocks.map((block) => {
      const events = block.querySelector(SEL.eventsComponent);
      if (events) return !eventsAreEmpty(events);
      return !classesBuilt && !!block.querySelector(SEL.classList);
    });
    blocks.forEach((block, i) => {
      const isHeading = !!block.querySelector(".component-heading");
      if (!(keep[i] || (isHeading && keep[i + 1]))) block.classList.add("ppui-moved");
    });
  }

  // Unread count from the home page's messages tile, shown on the header's Messages button.
  function showUnread() {
    const comp = document.querySelector(SEL.unreadCount);
    const count = comp ? parseInt((clean(comp.textContent).match(/\d+/) || [])[0], 10) : 0;
    const btn = document.querySelector(".ppui-messages");
    if (!count || !btn || btn.querySelector(".ppui-count")) return;
    btn.appendChild(el("span", "ppui-count", String(count)));
    btn.setAttribute("aria-label", "Messages, " + count + " unread");
  }

  function build() {
    const app = document.querySelector(SEL.app);
    const grid = document.querySelector(SEL.regions);
    if (!app || !grid || app.querySelector(".ppui-dash")) {
      reveal();
      return;
    }

    const dash = el("div", "ppui-dash ppui-enter");
    dash.appendChild(buildTodayPanel());

    let classesBuilt = false;
    const classList = document.querySelector(SEL.classList);
    if (classList) {
      const classesLink = [...document.querySelectorAll("a")]
        .find((a) => /classes\s*&\s*reports/i.test(a.textContent) && sameOriginHref(a.getAttribute("href")));
      const classes = buildClassesPanel(classList, classesLink && sameOriginHref(classesLink.getAttribute("href")));
      if (classes) {
        dash.appendChild(classes);
        classesBuilt = true;
      }
    }

    const news = findNews();
    if (news) {
      news.comp.classList.add("ppui-moved");
      dash.appendChild(buildNewsPanel(news));
    }
    grid.before(dash);

    const apps = harvestApps();
    if (apps.length) saveApps(apps);
    foldBlocks(grid, classesBuilt);
    showUnread();
    reveal();
  }

  // The portal hydrates after load; wait for its blocks, then build once.
  whenReady(() => document.querySelector(SEL.regions + " " + SEL.block), build, WAIT_MS);
})();
