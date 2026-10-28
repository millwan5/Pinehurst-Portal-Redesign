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
  const READER_COUNT = 12;
  const ARTICLE_WAIT_MS = 15000;
  const STORY_SETTLE_MS = 1200;
  const STORY_GIVE_UP_MS = 4000;
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
    chevronLeft: [["path", { d: "m15 18-6-6 6-6" }]],
    chevronRight: [["path", { d: "m9 18 6-6-6-6" }]],
    close: [["path", { d: "M18 6 6 18M6 6l12 12" }]],
    pin: [["path", { d: "M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" }]],
    filter: [["path", { d: "M3 6h18M7 12h10M10 18h4" }]],
    calendar: [["rect", { x: 3, y: 4, width: 18, height: 18, rx: 2 }], ["path", { d: "M16 2v4M8 2v4M3 10h18" }]],
    sort: [["path", { d: "m21 16-4 4-4-4M17 20V4M3 8l4-4 4 4M7 4v16" }]],
    chevronDown: [["path", { d: "m6 9 6 6 6-6" }]],
    trash: [["path", { d: "M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" }]],
    rotateCcw: [["path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }], ["path", { d: "M3 3v5h5" }]],
    // Drawn for this extension: the crest's leaning pine, and a person for Account.
    pine: [["path", { d: "M11.9 2.2 18.9 18.5l-5.8 1.4v1.9l-4.4-1.2L5 19.7Z" }]],
    user: [["circle", { cx: 12, cy: 8, r: 4 }], ["path", { d: "M4 21a8 8 0 0 1 16 0" }]],
  };

  const GROUP_ICONS = {
    Calendars: "calendarClock",
    Learning: "bookOpen",
    "Microsoft 365": "grid",
    "School life": "pine",
    Account: "user",
    Other: "external",
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

  // Same crest, flat silver on blue, for empty states.
  function emptyState(text, tag = "li") {
    const li = el(tag, "ppui-empty");
    li.append(svgIcon("ppui-empty-art", LOGO, "75 10 460 540"), el("span", null, text));
    return li;
  }

  // Seeded random numbers, so the header forest looks the same on every visit.
  function seeded(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // One pine: a trunk and three to five drooping tiers that narrow towards a slightly leaning tip.
  // Each tier's outer corner is jittered so no two trees (or two sides of one tree) match.
  function pinePath(rand, x, g, h) {
    const n = 3 + Math.floor(rand() * 3);
    const w = h * (0.42 + rand() * 0.12);
    const trunk = Math.max(2, w * 0.07);
    const crown = h * 0.88;
    const tierH = crown / n;
    const tip = x + (rand() - 0.4) * w * 0.12;
    const p = (px, py) => " L" + px.toFixed(1) + " " + py.toFixed(1);
    let right = "";
    let left = "";
    for (let t = 0; t < n; t++) {
      const yb = g - h * 0.1 - t * tierH * 0.92;
      const hw = (w / 2) * (1 - t / (n + 0.6));
      const droop = tierH * (0.12 + rand() * 0.1);
      const inner = hw * (0.42 + rand() * 0.12);
      // Right side climbs outward then tucks in; left side is built bottom-up and reversed later.
      right += p(x + hw * (0.94 + rand() * 0.12), yb + droop) + p(x + inner, yb - tierH * 0.34);
      left = p(x - inner, yb - tierH * 0.34) + p(x - hw * (0.94 + rand() * 0.12), yb + droop * (0.8 + rand() * 0.4)) + left;
    }
    return " M" + (x - trunk).toFixed(1) + " " + (g + 8).toFixed(1) + p(x + trunk, g + 8) + p(x + trunk, g - h * 0.1) +
      right + p(tip, g - h) + left + p(x - trunk, g - h * 0.1) + "Z";
  }

  // One ridge of pines drawn as a single path, standing on a ground line that dips in the
  // middle like the crest's open book. Trees sometimes cluster, sometimes leave a clearing.
  function ridgePath(rand, opts, W, H = 240) {
    const ground = (x) => H - opts.base - Math.cos((x / W) * Math.PI * 2) * opts.dip;
    let d = "M0 " + H + " L0 " + ground(0).toFixed(1);
    for (let x = 0; x <= W; x += 40) d += " L" + x + " " + ground(x).toFixed(1);
    d += " L" + W + " " + H + "Z";
    for (let x = -20; x < W + 40; ) {
      const h = opts.height * (0.45 + rand() * 0.7);
      d += pinePath(rand, x, ground(x) + 4, h);
      const r = rand();
      x += opts.gap * (r < 0.25 ? 0.35 + rand() * 0.2 : r > 0.9 ? 1.8 + rand() : 0.7 + rand() * 0.6);
    }
    return d;
  }

  const RIDGES = [
    { cls: "ppui-ridge-far", seed: 7, base: 64, dip: 10, gap: 38, height: 96 },
    { cls: "ppui-ridge-mid", seed: 21, base: 36, dip: 16, gap: 52, height: 92 },
    { cls: "ppui-ridge-near", seed: 3, base: 14, dip: 22, gap: 90, height: 120 },
  ];

  // Header scene: sky that follows the school day, a sun (or moon) on its arc, three ridges of pines.
  // The canvas is far wider than any screen, so the forest is always scaled to fit the header's
  // height and cropped at the sides, never scaled up by width (which would cut off the treetops).
  // The slim header on other pages draws a half-height forest.
  function buildScene(compact) {
    const W = compact ? 6000 : 2600;
    const H = compact ? 120 : 240;
    const k = compact ? 0.5 : 1;
    const scene = el("div", "ppui-scene");
    scene.setAttribute("aria-hidden", "true");
    const stars = el("div", "ppui-stars");
    const orb = el("div", "ppui-orb");
    // A faint cloud photograph drifting slowly across, and film grain on the sky (the forest stays flat).
    const clouds = el("div", "ppui-clouds");
    clouds.appendChild(el("span", "ppui-cloud-photo"));
    scene.append(stars, orb, clouds, el("div", "ppui-grain"));
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("preserveAspectRatio", "xMidYMax slice");
    svg.setAttribute("class", "ppui-forest");
    for (const r of RIDGES) {
      const p = document.createElementNS(ns, "path");
      p.setAttribute("class", "ppui-ridge " + r.cls);
      p.setAttribute("d", ridgePath(seeded(r.seed), { base: r.base * k, dip: r.dip * k, gap: r.gap * k, height: r.height * k }, W, H));
      svg.appendChild(p);
    }
    scene.appendChild(svg);

    // 6 am to 7 pm the sun rides an arc across the header; 7 pm to 6 am the moon does.
    const update = () => {
      const d = new Date();
      const m = d.getHours() * 60 + d.getMinutes();
      const f = (m - 360) / 780;
      const day = f >= 0 && f <= 1;
      const t = day ? f : ((m - 1140 + 1440) % 1440) / 660;
      const x = 8 + t * 84;
      const y = 78 - Math.sin(t * Math.PI) * 62;
      scene.style.setProperty("--orb-x", x.toFixed(1) + "%");
      scene.style.setProperty("--orb-y", y.toFixed(1) + "%");
      scene.dataset.sky = !day ? "night" : f < 0.12 ? "dawn" : f > 0.85 ? "dusk" : "day";
    };
    update();
    setInterval(update, 60 * 1000);
    return scene;
  }

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
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch (e) {}
      // The new theme spreads out in a circle from the button, where the browser can do it.
      if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) {
        applyTheme(next);
        return;
      }
      const r = btn.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      const transition = document.startViewTransition(() => applyTheme(next));
      transition.ready.then(() => {
        root.animate(
          { clipPath: ["circle(0px at " + x + "px " + y + "px)", "circle(" + radius + "px at " + x + "px " + y + "px)"] },
          { duration: 560, easing: "cubic-bezier(0.32, 0.72, 0, 1)", pseudoElement: "::view-transition-new(root)" },
        );
      }).catch(() => {});
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
    btn.title = "Apps and links";
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
        const heading = el("h3", "ppui-apps-title");
        heading.append(icon(GROUP_ICONS[name] || "grid"), document.createTextNode(name));
        group.appendChild(heading);
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

    const home = HOME_PATH.test(location.pathname);
    header.classList.toggle("is-compact", !home);
    header.appendChild(buildScene(!home));

    const brand = el("a", "ppui-brand");
    brand.href = HOME_URL;
    brand.setAttribute("aria-label", "Pinehurst Dashboard home");
    const plate = el("span", "ppui-logo-plate");
    plate.appendChild(svgIcon("ppui-logo", LOGO, "75 10 460 540"));
    brand.appendChild(plate);
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
      const intro = el("div", "ppui-intro");
      intro.append(hello, date);
      header.append(intro);
    }

    // Home: the hero sits inside the page column. Elsewhere the slim header goes first in <body>,
    // so nothing the portal puts above its column shows as a bar over it.
    const app = document.querySelector(SEL.app);
    if (app && home) app.prepend(header);
    else {
      if (!app) header.classList.add("is-standalone");
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

  // ---- News: shared by the dashboard card and the News page ----

  // Portal pages fill themselves in with JS, so a plain fetch returns an empty shell.
  // Load the page in a hidden same-origin iframe, poll `read(doc)` until it returns something, remove it.
  function loadInFrame(href, read, timeoutMs) {
    return new Promise((resolve, reject) => {
      const frame = el("iframe", "ppui-frame");
      frame.setAttribute("aria-hidden", "true");
      frame.tabIndex = -1;
      frame.src = href;

      const started = Date.now();
      const timer = setInterval(() => {
        let result = null;
        try {
          result = frame.contentDocument ? read(frame.contentDocument) : null;
        } catch (e) {
          done(e);
          return;
        }
        if (result) done(null, result);
        else if (Date.now() - started > timeoutMs) done(new Error("nothing found at " + href));
      }, 200);

      function done(err, result) {
        clearInterval(timer);
        frame.remove();
        if (err) reject(err);
        else resolve(result);
      }

      document.body.appendChild(frame);
    });
  }

  // The card shows the first NEWS_COUNT stories; the reader can page through a few more.
  function loadArticles(href) {
    return loadInFrame(href, (doc) => {
      const nodes = [...doc.querySelectorAll(SEL.article)];
      return nodes.length ? nodes.slice(0, READER_COUNT).map(readArticle) : null;
    }, NEWS_WAIT_MS);
  }

  // Copy an article's content into this page as plain, safe markup: paragraphs, lists, headings,
  // quotes, emphasis, links (http/https only) and pictures. Everything else is unwrapped to its text;
  // scripts, forms and embeds are dropped. `skip(node)` leaves out parts shown elsewhere (title, date).
  const BODY_TAGS = new Set(["P", "BR", "UL", "OL", "LI", "STRONG", "B", "EM", "I", "A", "IMG", "H2", "H3", "H4", "BLOCKQUOTE", "FIGURE", "FIGCAPTION"]);
  const BODY_DROP = /^(SCRIPT|STYLE|IFRAME|NOSCRIPT|FORM|BUTTON|INPUT|SELECT|TEXTAREA|SVG|VIDEO|AUDIO|OBJECT|EMBED)$/i;
  const BLOCKS = "p, div, section, ul, ol, h1, h2, h3, h4, blockquote, figure, table";

  function cleanBody(source, skip) {
    const out = el("div");
    const walk = (from, to) => {
      for (const n of from.childNodes) {
        if (n.nodeType === Node.TEXT_NODE) {
          to.appendChild(document.createTextNode(n.textContent));
          continue;
        }
        if (n.nodeType !== Node.ELEMENT_NODE || BODY_DROP.test(n.tagName) || skip(n)) continue;
        let tag = n.tagName.toUpperCase();
        // A plain block with only inline content inside reads as a paragraph.
        if (/^(DIV|SECTION|ARTICLE)$/.test(tag) && !n.querySelector(BLOCKS)) tag = "P";
        if (tag === "H1") tag = "H2";
        if (!BODY_TAGS.has(tag)) {
          walk(n, to);
          continue;
        }
        let copy;
        if (tag === "A") {
          copy = el("a");
          const href = absUrl(n.getAttribute("href"), n.baseURI);
          if (href) linkTo(copy, href);
        } else if (tag === "IMG") {
          const src = absUrl(n.getAttribute("data-src") || n.getAttribute("src"), n.baseURI);
          if (!src) continue;
          copy = el("img");
          copy.src = src;
          copy.alt = n.getAttribute("alt") || "";
          copy.loading = "lazy";
        } else {
          copy = el(tag.toLowerCase());
        }
        to.appendChild(copy);
        if (tag !== "IMG") walk(n, copy);
      }
    };
    walk(source, out);
    // Drop paragraphs that ended up empty, and the page builder's "This is a text box" filler.
    for (const p of out.querySelectorAll("p, li, h2, h3, h4")) {
      const t = clean(p.textContent);
      if ((!t && !p.querySelector("img")) || (PLACEHOLDER.test(t) && t.length < 80)) p.remove();
    }
    return out;
  }

  // "October 14, 2026" -> { day: "14", month: "Oct", ago: "2 days ago" }; unparseable dates keep their text.
  function splitDate(text) {
    const d = new Date(text);
    if (isNaN(d)) return { day: "", month: "", ago: text };
    const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 864e5);
    const ago = days === 0 ? "Today" : days === 1 ? "Yesterday" : days > 1 && days < 7 ? days + " days ago" :
      d.toLocaleDateString("en-AU", { weekday: "long" });
    return {
      day: String(d.getDate()),
      month: d.toLocaleDateString("en-AU", { month: "short" }),
      ago,
    };
  }

  // Articles have a title and date; a summary and a picture are used when the page has them.
  const ARTICLE_SUMMARY = ".article-summary, .article-description, .article-body, .article-content, p";

  // A plain http(s) address, resolved against the page it came from (the hidden frame's page,
  // not this one, so relative links and pictures still point at the right place).
  function absUrl(raw, base) {
    if (!raw) return null;
    try {
      const url = new URL(raw.trim(), base || location.href);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
    } catch (e) {
      return null;
    }
  }

  // A picture's real address. Lazy-loading pages keep it in data-src or srcset, and some show
  // pictures as CSS backgrounds. Placeholders (data: URLs, spacer gifs) and icons don't count.
  function pictureOf(node) {
    for (const img of node.querySelectorAll("img")) {
      if (img.closest(".ppui-stub")) continue;
      const srcset = (img.getAttribute("data-srcset") || img.getAttribute("srcset") || "").split(",").pop().trim().split(/\s+/)[0];
      const small = img.naturalWidth && img.naturalWidth < 80;
      for (const raw of [img.getAttribute("data-src"), img.getAttribute("data-lazy-src"), srcset, img.getAttribute("src")]) {
        if (!raw || /^data:|spacer|blank\.|pixel\./i.test(raw) || small) continue;
        const url = absUrl(raw, img.baseURI);
        if (url) return { node: img, url };
      }
    }
    for (const n of node.querySelectorAll("[style*='background']")) {
      const m = (n.getAttribute("style") || "").match(/url\(\s*["']?([^"')]+)["']?\s*\)/);
      const url = m && absUrl(m[1], n.baseURI);
      if (url) return { node: n, url };
    }
    return null;
  }

  // The story's own page: the title's link (the title may be the link, sit inside one, or hold one),
  // else the whole article being a link, else a "Read more" link.
  function storyAnchor(node) {
    const title = node.querySelector(SEL.articleTitle);
    return (title && (title.closest("a[href]") || title.querySelector("a[href]"))) || node.closest("a[href]") ||
      [...node.querySelectorAll("a[href]")].find((link) => /read|more|continue|full/i.test(link.textContent)) || null;
  }

  function readArticle(node) {
    const text = (sel) => clean((node.querySelector(sel) || {}).textContent);
    const titleText = text(SEL.articleTitle);
    const summaryNode = [...node.querySelectorAll(ARTICLE_SUMMARY)]
      .find((n) => !n.closest(SEL.articleTitle) && !n.closest(SEL.articleDate) && clean(n.textContent).length > 40);
    const picture = pictureOf(node);
    const anchor = storyAnchor(node);
    const dateText = text(SEL.articleDate);
    const day = new Date(dateText);
    return {
      title: titleText,
      dateText,
      // Midnight of the story's day, for the News page's date filter and sort; null if undated.
      time: isNaN(day) ? null : day.setHours(0, 0, 0, 0),
      date: splitDate(dateText),
      summary: summaryNode ? clean(summaryNode.textContent).slice(0, 220) : "",
      image: picture ? picture.url : null,
      href: anchor ? sameOriginHref(absUrl(anchor.getAttribute("href"), anchor.baseURI) || "") : null,
      frames: [],
      // Everything but the title, date and lead picture, for the reader.
      body: cleanBody(node, (n) => (picture && n === picture.node) || n === anchor ||
        n.matches(SEL.articleTitle + ", " + SEL.articleDate + ", .ppui-stub")),
    };
  }

  function addPicture(frame, url) {
    if (frame.querySelector(".ppui-photo-image")) return;
    const pic = el("img", "ppui-photo-image");
    pic.alt = "";
    pic.addEventListener("load", () => {
      frame.classList.add("has-image");
      if (!frame.classList.contains("is-zoomable")) return;
      frame.removeAttribute("aria-hidden");
      frame.setAttribute("role", "button");
      frame.tabIndex = 0;
    });
    pic.addEventListener("error", () => pic.remove());
    pic.src = url;
    frame.appendChild(pic);
  }

  // A picture found later (on the story's own page) replaces the drawn cover wherever it shows.
  function setPicture(item, url) {
    if (item.image) return;
    item.image = url;
    item.frames = item.frames.filter((frame) => frame.isConnected);
    item.frames.forEach((frame) => addPicture(frame, url));
  }

  // The story's picture in a mounted frame. Until (or unless) there is one, a drawn cover shows:
  // a stand of crest pines on blue with the story's date.
  // With `zoomable`, clicking the picture (once there is one) opens it full size.
  function photoFrame(item, zoomable) {
    const frame = el("span", "ppui-photo" + (zoomable ? " is-zoomable" : ""));
    frame.setAttribute("aria-hidden", "true");
    if (zoomable) {
      frame.setAttribute("aria-label", "View picture: " + item.title);
      const open = (e) => {
        const img = frame.querySelector(".ppui-photo-image");
        if (!frame.classList.contains("has-image") || !img) return;
        e.preventDefault();
        e.stopPropagation();
        viewPicture(img, item.title);
      };
      frame.addEventListener("click", open);
      frame.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") open(e);
      });
    }
    const cover = el("span", "ppui-photo-cover");
    cover.appendChild(svgIcon("ppui-cover-pines", [["path", { d: ridgePath(seeded(11), { base: 20, dip: 6, gap: 46, height: 120 }, 400) }]], "0 60 400 180"));
    if (item.date.day) cover.appendChild(el("span", "ppui-cover-date", item.date.day + " " + item.date.month));
    frame.appendChild(cover);
    if (item.image) addPicture(frame, item.image);
    item.frames.push(frame);
    return frame;
  }

  // ---- Picture viewer: the picture grows from where it was clicked to fill the screen ----

  const viewer = { dialog: null, from: null };

  // Where the big picture should start (or end) to sit exactly over the small one: same width,
  // centred on it. The small one is cropped to fit its frame, so the heights differ a little.
  function overThumbnail(big, small) {
    const end = big.getBoundingClientRect();
    const start = small.getBoundingClientRect();
    const scale = start.width / end.width;
    return "translate(" + (start.left - end.left) + "px, " + (start.top + (start.height - end.height * scale) / 2 - end.top) +
      "px) scale(" + scale + ")";
  }

  function closeViewer() {
    const { dialog, from } = viewer;
    if (!dialog || !dialog.open || dialog.classList.contains("is-closing")) return;
    const img = dialog.querySelector(".ppui-viewer-image");
    const finish = () => {
      dialog.classList.remove("is-closing");
      dialog.close();
      if (from && from.isConnected) from.closest(".ppui-photo")?.focus({ preventScroll: true });
    };
    const visible = from && from.isConnected && from.getBoundingClientRect().width > 0;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !visible) return finish();
    dialog.classList.add("is-closing");
    img.animate([{ transform: "none" }, { transform: overThumbnail(img, from) }],
      { duration: 340, easing: "cubic-bezier(0.32, 0.72, 0, 1)", fill: "forwards" }).finished.then(finish, finish);
  }

  function viewPicture(from, caption) {
    if (!viewer.dialog) {
      const dialog = el("dialog", "ppui-viewer");
      dialog.setAttribute("aria-label", "Picture");
      const img = el("img", "ppui-viewer-image");
      img.alt = "";
      const close = el("button", "ppui-viewer-close");
      close.type = "button";
      close.setAttribute("aria-label", "Close picture");
      close.title = "Close";
      close.appendChild(icon("close"));
      dialog.append(img, el("p", "ppui-viewer-caption"), close);
      // Anywhere closes it: the picture, the dark backdrop, the button. Esc too.
      dialog.addEventListener("click", closeViewer);
      dialog.addEventListener("cancel", (e) => {
        e.preventDefault();
        closeViewer();
      });
      document.body.appendChild(dialog);
      viewer.dialog = dialog;
    }
    const { dialog } = viewer;
    const img = dialog.querySelector(".ppui-viewer-image");
    viewer.from = from;
    img.getAnimations().forEach((a) => a.cancel());
    img.src = from.currentSrc || from.src;
    img.alt = caption;
    dialog.querySelector(".ppui-viewer-caption").textContent = caption;
    dialog.classList.remove("is-closing");
    dialog.showModal();
    dialog.querySelector(".ppui-viewer-close").focus({ preventScroll: true });
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // The same file as the thumbnail, so it is already loaded: grow it out of the thumbnail.
    (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(() => {
      if (!dialog.open) return;
      img.animate([{ transform: overThumbnail(img, from) }, { transform: "none" }],
        { duration: 460, easing: "cubic-bezier(0.32, 0.72, 0, 1)" });
    });
  }

  // ---- News reader: stories open in a side panel on the dashboard, with previous / next ----

  const reader = {
    dialog: null,
    stories: [],
    index: 0,
    newsHref: "",
    actions: null,
  };

  const norm = (s) => clean(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  // Default text the portal's page builder leaves in empty boxes.
  const PLACEHOLDER = /\b(this is a text box|lorem ipsum|enter (your )?text here|placeholder)\b/i;
  const STORY_PAGE = ".article-body, .article-content, .news-article, [class*='article-body'], [class*='news-body'], main, .app-container";

  // Load the story's own page once (hidden, like the list) for its full text and its picture.
  // Pages fill in bit by bit, so wait until the text has stayed the same for a second before taking it.
  function fullStory(item) {
    if (item.full) return item.full;
    const listed = { body: item.body, image: null };
    const samePage = (a, b) => new URL(a).pathname.replace(/\/$/, "") === new URL(b).pathname.replace(/\/$/, "");
    if (!item.href || samePage(item.href, reader.newsHref)) return (item.full = Promise.resolve(listed));
    let last = -1;
    let steadySince = 0;
    let lastNode = null;
    const started = Date.now();
    const take = (node) => {
      const picture = pictureOf(node);
      return {
        image: picture ? picture.url : null,
        body: cleanBody(node, (n) => (picture && n === picture.node) ||
          n.matches(SEL.articleTitle + ", " + SEL.articleDate + ", .ppui-stub, nav, header, footer, .ppui-header, .vx-nav")),
      };
    };
    item.full = loadInFrame(item.href, (doc) => {
      // On a page with several articles only the one with this story's title will do;
      // a page with a single article is this story.
      const articles = [...doc.querySelectorAll(SEL.article)];
      const want = norm(item.title);
      let node = articles.find((a) => {
        const t = norm((a.querySelector(SEL.articleTitle) || {}).textContent || "");
        return t && (t === want || (want.length > 12 && (t.includes(want) || want.includes(t))));
      });
      if (!node && articles.length === 1) node = articles[0];
      if (!node && articles.length > 1) return { none: true };
      // No article on the page: only an area that mentions this story's title will do.
      node = node || [...doc.querySelectorAll(STORY_PAGE)]
        .find((n) => clean(n.textContent).length > 120 && norm(n.textContent).includes(want));
      // A page that has finished loading and still shows nothing of the story won't: stop waiting.
      if (!node) return doc.readyState === "complete" && Date.now() - started > STORY_GIVE_UP_MS ? { none: true } : null;
      const length = clean(node.textContent).length;
      if (length !== last) {
        last = length;
        steadySince = Date.now();
        return null;
      }
      lastNode = node;
      if (Date.now() - steadySince < STORY_SETTLE_MS) return null;
      return take(node);
    }, ARTICLE_WAIT_MS)
      // A page that never settles (a ticking clock, say) still gives whatever it had at the end.
      .catch(() => (lastNode ? take(lastNode) : { none: true }))
      .then((found) => {
        if (found.none) return listed;
        if (found.image) setPicture(item, found.image);
        // Template filler ("This is a text box.") or nearly nothing is not the story.
        const text = clean(found.body.textContent);
        if (PLACEHOLDER.test(text) && text.length < 300) return { body: item.body, image: found.image };
        const longer = clean(found.body.textContent).length > clean(item.body.textContent).length;
        return { body: longer ? found.body : item.body, image: found.image };
      })
      .catch(() => listed);
    return item.full;
  }

  function readerPage(item, direction) {
    const page = el("article", "ppui-reader-page" + (direction ? " from-" + direction : ""));
    page.tabIndex = -1;
    page.setAttribute("aria-labelledby", "ppui-reader-title");
    page.appendChild(photoFrame(item, true));

    const meta = el("div", "ppui-reader-meta");
    const stub = storyStub(item);
    const when = el("span", "ppui-reader-when");
    if (item.dateText) when.appendChild(el("span", "ppui-reader-date", item.dateText));
    if (item.date.ago && item.date.ago !== item.dateText) when.appendChild(el("span", "ppui-reader-ago", item.date.ago));
    meta.append(stub, when);

    const title = el("h2", "ppui-reader-title", item.title);
    title.id = "ppui-reader-title";
    const body = el("div", "ppui-reader-body");
    page.append(meta, title, body);

    const show = (story) => {
      body.replaceChildren(...story.body.cloneNode(true).childNodes);
      // Only the news list's preview came through: say so, and point at the portal.
      if (item.href && story.body === item.body && clean(item.body.textContent).length < 400) {
        const note = el("p", "ppui-reader-note", "This is the preview from the news list. ");
        const out = el("a", null, "Try the portal's page");
        out.href = item.href;
        note.appendChild(out);
        body.appendChild(note);
      }
      if (!clean(body.textContent)) body.appendChild(el("p", "ppui-reader-note", "This story has no text in the news list."));
    };

    // Show the list's copy at once, then the full story when it arrives (if the reader is still here).
    body.append(...item.body.cloneNode(true).childNodes);
    if (item.story) {
      show(item.story);
    } else {
      const loading = el("p", "ppui-reader-loading");
      loading.append(el("span", "ppui-skel-a"), el("span", "ppui-skel-b"));
      body.appendChild(loading);
      fullStory(item).then((story) => {
        item.story = story;
        if (page.isConnected) show(story);
      });
    }

    return page;
  }

  function showStory(index, direction) {
    const { dialog, stories } = reader;
    reader.index = (index + stories.length) % stories.length;
    const item = stories[reader.index];
    const old = dialog.querySelector(".ppui-reader-page");
    const page = readerPage(item, direction);
    if (old) old.replaceWith(page);
    else dialog.querySelector(".ppui-reader-scroll").appendChild(page);
    dialog.querySelector(".ppui-reader-scroll").scrollTop = 0;
    dialog.querySelector(".ppui-reader-count").textContent = (reader.index + 1) + " of " + stories.length;
    const single = stories.length < 2;
    dialog.querySelectorAll(".ppui-reader-step").forEach((b) => (b.disabled = single));
    const pin = dialog.querySelector(".ppui-reader-pin");
    const pinned = reader.actions.isPinned(item);
    pin.setAttribute("aria-pressed", String(pinned));
    pin.title = pinned ? "Unpin" : "Pin to the top";
    // Start fetching the next story so flicking forward feels instant.
    if (!single) fullStory(stories[(reader.index + 1) % stories.length]);
  }

  function closeReader() {
    const { dialog } = reader;
    if (!dialog.open || dialog.classList.contains("is-closing")) return;
    const finish = () => {
      dialog.classList.remove("is-closing");
      dialog.close();
      root.classList.remove("ppui-reading");
    };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return finish();
    dialog.classList.add("is-closing");
    // Wait for the panel's own slide-out (not a page's), with a timer in case it never fires.
    const done = (e) => {
      if (e && e.target !== dialog) return;
      dialog.removeEventListener("animationend", done);
      if (dialog.classList.contains("is-closing")) finish();
    };
    dialog.addEventListener("animationend", done);
    setTimeout(done, 450);
  }

  function readerButton(className, label, iconName, onClick) {
    const b = el("button", "ppui-reader-button " + className);
    b.type = "button";
    b.setAttribute("aria-label", label);
    b.title = label;
    b.appendChild(icon(iconName));
    b.addEventListener("click", onClick);
    return b;
  }

  function buildReader() {
    const dialog = el("dialog", "ppui-reader");
    dialog.setAttribute("aria-label", "News");
    const bar = el("div", "ppui-reader-bar");
    const all = el("a", "ppui-reader-all", "All news");
    all.href = reader.newsHref;
    bar.append(
      readerButton("ppui-reader-step", "Previous story", "chevronLeft", () => showStory(reader.index - 1, "prev")),
      el("span", "ppui-reader-count"),
      readerButton("ppui-reader-step", "Next story", "chevronRight", () => showStory(reader.index + 1, "next")),
      all,
      readerButton("ppui-reader-pin", "Pin to the top", "pin", () => {
        reader.actions.togglePin(reader.stories[reader.index]);
        showStory(reader.index);
      }),
      readerButton("ppui-reader-trash", "Move to trash", "trash", () => {
        const item = reader.stories[reader.index];
        reader.stories = reader.stories.filter((s) => s !== item);
        reader.actions.trash(item);
        if (!reader.stories.length) closeReader();
        else showStory(Math.min(reader.index, reader.stories.length - 1), "next");
      }),
      readerButton("ppui-reader-close", "Close", "close", closeReader),
    );
    const scroll = el("div", "ppui-reader-scroll");
    dialog.append(bar, scroll);

    // Esc (the dialog's own close) still works, with the slide-out.
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      closeReader();
    });
    // A click on the dimmed page outside the panel closes it.
    dialog.addEventListener("click", (e) => {
      if (e.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeReader();
    });
    document.body.appendChild(dialog);
    return dialog;
  }

  function openReader(stories, index, newsHref, actions) {
    reader.stories = stories.slice();
    reader.newsHref = newsHref;
    reader.actions = actions;
    if (!reader.dialog) reader.dialog = buildReader();
    reader.dialog.classList.remove("is-closing");
    reader.dialog.querySelector(".ppui-reader-all").href = newsHref;
    reader.dialog.querySelector(".ppui-reader-page")?.remove();
    showStory(index);
    root.classList.add("ppui-reading");
    if (!reader.dialog.open) reader.dialog.showModal();
    reader.dialog.querySelector(".ppui-reader-page").focus({ preventScroll: true });
  }

  // ---- Pinned stories and trash (kept in this browser only; shared by the card and the News page) ----

  const NEWS_PREFS_KEY = "ppui-news";
  // The News page's address, remembered so early.js can hide the portal's list before it paints.
  const NEWS_PATH_KEY = "ppui-news-path";
  const storyKey = (item) => item.title + "|" + item.dateText;

  // Earlier versions called the trash "hidden"; read that too so nothing comes back unasked.
  function loadNewsPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem(NEWS_PREFS_KEY) || "{}");
      const list = (v) => (Array.isArray(v) ? v : []);
      return { pinned: list(p.pinned), trash: [...new Set(list(p.trash).concat(list(p.hidden)))] };
    } catch (e) {
      return { pinned: [], trash: [] };
    }
  }

  function saveNewsPrefs(prefs) {
    try {
      localStorage.setItem(NEWS_PREFS_KEY, JSON.stringify({ pinned: prefs.pinned.slice(-100), trash: prefs.trash.slice(-200) }));
    } catch (e) {}
  }

  // A short message at the bottom of the window, with one action (Undo).
  let toastTimer = 0;
  function toast(text, actionLabel, onAction) {
    let box = document.querySelector(".ppui-toast");
    if (!box) {
      box = el("div", "ppui-toast");
      box.setAttribute("role", "status");
      // A manual popover sits in the top layer, so it shows above the open reader too.
      box.popover = "manual";
      document.body.appendChild(box);
    }
    box.replaceChildren(el("span", "ppui-toast-text", text));
    if (actionLabel) {
      const b = el("button", "ppui-toast-action", actionLabel);
      b.type = "button";
      b.addEventListener("click", () => {
        box.classList.remove("is-shown");
        onAction();
      });
      box.appendChild(b);
    }
    if (box.matches(":popover-open")) box.hidePopover();
    box.showPopover();
    box.classList.add("is-shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove("is-shown"), 6000);
  }

  function storyButton(className, label, iconName, onClick) {
    const b = el("button", "ppui-story-action " + className);
    b.type = "button";
    b.setAttribute("aria-label", label);
    b.title = label;
    b.appendChild(icon(iconName));
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick(b);
    });
    return b;
  }

  const NEWS_VIEWS = [
    ["all", "All stories"],
    ["pinned", "Pinned"],
    ["trash", "Trash"],
  ];

  // Pin, trash and restore for one list of stories, plus which stories each view shows.
  // `render` runs after every change. Prefs are re-read first, so a change made in another tab isn't lost.
  function newsActions(getItems, render) {
    let prefs = loadNewsPrefs();
    const change = (fn) => {
      prefs = loadNewsPrefs();
      fn();
      saveNewsPrefs(prefs);
      render();
    };
    const actions = {
      view: "all",
      isPinned: (item) => prefs.pinned.includes(storyKey(item)),
      isTrashed: (item) => prefs.trash.includes(storyKey(item)),
      togglePin(item) {
        const key = storyKey(item);
        change(() => {
          prefs.pinned = prefs.pinned.includes(key) ? prefs.pinned.filter((k) => k !== key) : prefs.pinned.concat(key);
        });
      },
      trash(item) {
        const key = storyKey(item);
        change(() => {
          if (!prefs.trash.includes(key)) prefs.trash.push(key);
          prefs.pinned = prefs.pinned.filter((k) => k !== key);
        });
        toast("Moved to trash", "Undo", () => actions.restore(item));
      },
      restore(item) {
        const key = storyKey(item);
        change(() => {
          prefs.trash = prefs.trash.filter((k) => k !== key);
        });
      },
      restoreAll() {
        const keys = new Set(getItems().map(storyKey));
        change(() => {
          prefs.trash = prefs.trash.filter((k) => !keys.has(k));
        });
      },
      // Trash shows only in "trash"; "all" puts pinned stories first.
      visible(view = actions.view) {
        const items = getItems();
        if (view === "trash") return items.filter(actions.isTrashed);
        const kept = items.filter((item) => !actions.isTrashed(item) && (view === "all" || actions.isPinned(item)));
        return kept.filter(actions.isPinned).concat(kept.filter((item) => !actions.isPinned(item)));
      },
      counts: () => ({ all: actions.visible("all").length, pinned: actions.visible("pinned").length, trash: actions.visible("trash").length }),
      get emptyText() {
        if (actions.view === "pinned") return "Nothing pinned yet. Pin a story to keep it at the top.";
        if (actions.view === "trash") return "Trash is empty.";
        return "No news right now.";
      },
    };
    return actions;
  }

  // ---- News page: tabs (All / Pinned / Trash), full-text cards and a date timeline down the side ----

  // Stories longer than this fold behind "Keep reading".
  const FOLD_CHARS = 240;
  // The line (as a share of the window's height) a story has to cross to count as the one you're on.
  const READING_LINE = 0.35;

  function storyStub(item) {
    const stub = el("span", "ppui-stub");
    stub.setAttribute("aria-hidden", "true");
    if (item.date.day) stub.append(el("span", "ppui-stub-day", item.date.day), el("span", "ppui-stub-month", item.date.month));
    else stub.appendChild(icon("newspaper"));
    return stub;
  }

  function buildNewsPage() {
    const articles = [...document.querySelectorAll(SEL.article)];
    if (!articles.length || document.querySelector(".ppui-newsroom")) return;
    const items = articles.map(readArticle);
    reader.newsHref = location.href;
    const actions = newsActions(() => items, render);
    const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

    const room = el("section", "ppui-newsroom");
    room.setAttribute("aria-label", "School news");

    // One heading row: the page's name (the portal's, found below), the three tabs, then When and Sort.
    const head = el("header", "ppui-room-head");
    const title = el("h1", "ppui-room-title", "News");
    const tabs = el("div", "ppui-room-tabs");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Show");
    const indicator = el("span", "ppui-room-tab-indicator");
    indicator.setAttribute("aria-hidden", "true");
    const tabButtons = NEWS_VIEWS.map(([view, label]) => {
      const b = el("button", "ppui-room-tab");
      b.type = "button";
      b.id = "ppui-tab-" + view;
      b.dataset.view = view;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-controls", "ppui-room-list");
      b.append(icon(view === "pinned" ? "pin" : view === "trash" ? "trash" : "newspaper"), el("span", null, label),
        el("span", "ppui-room-tab-count"));
      b.addEventListener("click", () => switchTo(view));
      return b;
    });
    tabs.append(...tabButtons, indicator);
    // Left / Right (and Home / End) move between tabs, as in any tab list.
    tabs.addEventListener("keydown", (e) => {
      const i = tabButtons.findIndex((b) => b.dataset.view === actions.view);
      const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabButtons.length - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      const b = tabButtons[(to + tabButtons.length) % tabButtons.length];
      switchTo(b.dataset.view);
      b.focus();
    });
    // When: all time, today, yesterday, this week, or one chosen day. Sort: newest or oldest first
    // (remembered). Pinned stories stay on top in "All stories" either way.
    const SORT_KEY = "ppui-news-sort";
    let sort = "newest";
    try {
      if (localStorage.getItem(SORT_KEY) === "oldest") sort = "oldest";
    } catch (e) {}
    let when = { kind: "all" };
    const WHEN = [["all", "All time"], ["today", "Today"], ["yesterday", "Yesterday"], ["week", "This week"]];
    const SORTS = [["newest", "Newest first"], ["oldest", "Oldest first"]];
    const dayStart = (back) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - back);
      return d.getTime();
    };
    const isoDay = (time) => {
      const d = new Date(time);
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    };
    const shortDay = (time) => new Date(time).toLocaleDateString("en-AU", { day: "numeric", month: "short" });

    function inRange(item) {
      if (when.kind === "all") return true;
      if (item.time === null) return false;
      if (when.kind === "today") return item.time === dayStart(0);
      if (when.kind === "yesterday") return item.time === dayStart(1);
      if (when.kind === "week") return item.time >= dayStart(6);
      return item.time === when.time;
    }

    const whenLabel = () => (when.kind === "day" ? shortDay(when.time) : WHEN.find(([k]) => k === when.kind)[1]);

    // Undated stories keep their place; pinned ones lead in "All stories".
    function arrange(stories) {
      const dir = sort === "oldest" ? 1 : -1;
      const byTime = (a, b) => (a.time === null || b.time === null ? 0 : (a.time - b.time) * dir);
      const kept = stories.filter(inRange);
      if (actions.view !== "all") return kept.sort(byTime);
      return kept.filter(actions.isPinned).sort(byTime).concat(kept.filter((item) => !actions.isPinned(item)).sort(byTime));
    }

    // A button that opens a small menu (filled fresh each time it opens).
    function choice(iconName, label, fill) {
      const btn = el("button", "ppui-room-choice");
      btn.type = "button";
      btn.title = label;
      const text = el("span");
      btn.append(icon(iconName), text, icon("chevronDown", "ppui-choice-caret"));
      const menu = el("ul", "ppui-menu ppui-choice-menu");
      menu.setAttribute("role", "menu");
      menu.setAttribute("aria-label", label);
      arrowNav(menu, ".ppui-menu-item, input");
      popover(btn, menu, () => fill(menu));
      menu.addEventListener("toggle", (e) => {
        if (e.newState === "open") (menu.querySelector("[aria-checked='true']") || menu.querySelector("button")).focus();
      });
      return { btn, text };
    }

    function radioItem(menu, label, checked, pick) {
      const li = el("li");
      const b = el("button", "ppui-menu-item", label);
      b.type = "button";
      b.setAttribute("role", "menuitemradio");
      b.setAttribute("aria-checked", String(checked));
      b.addEventListener("click", () => {
        menu.hidePopover();
        pick();
      });
      li.appendChild(b);
      menu.appendChild(li);
    }

    const whenChoice = choice("calendar", "Show stories from", (menu) => {
      menu.replaceChildren();
      for (const [kind, label] of WHEN) radioItem(menu, label, when.kind === kind, () => setWhen({ kind }));
      // Or one particular day, limited to the days the stories cover.
      const li = el("li", "ppui-menu-sep ppui-choice-day");
      const field = el("label", null, "Pick a day");
      const input = el("input");
      input.type = "date";
      const days = items.map((item) => item.time).filter((t) => t !== null);
      if (days.length) {
        input.min = isoDay(Math.min(...days));
        input.max = isoDay(Math.max(...days));
      }
      if (when.kind === "day") input.value = isoDay(when.time);
      input.addEventListener("change", () => {
        if (!input.value) return;
        const [y, m, d] = input.value.split("-").map(Number);
        menu.hidePopover();
        setWhen({ kind: "day", time: new Date(y, m - 1, d).getTime() });
      });
      field.appendChild(input);
      li.appendChild(field);
      menu.appendChild(li);
    });

    const sortChoice = choice("sort", "Sort stories", (menu) => {
      menu.replaceChildren();
      for (const [key, label] of SORTS) {
        radioItem(menu, label, sort === key, () => {
          sort = key;
          try {
            localStorage.setItem(SORT_KEY, key);
          } catch (e) {}
          render();
        });
      }
    });

    function setWhen(next) {
      when = next;
      render();
    }

    const controls = el("div", "ppui-room-controls");
    controls.append(whenChoice.btn, sortChoice.btn);
    head.append(title, tabs, controls);

    // Timeline: one dated node per story, a fill that follows your place, a chip on phones.
    const rail = el("nav", "ppui-rail");
    rail.setAttribute("aria-label", "Stories by date");
    const track = el("span", "ppui-rail-track");
    track.appendChild(el("span", "ppui-rail-fill"));
    const nodes = el("ol", "ppui-rail-nodes");
    const chip = el("span", "ppui-rail-chip");
    chip.setAttribute("aria-hidden", "true");
    rail.append(track, nodes, chip);

    const tools = el("div", "ppui-room-tools");
    const list = el("div", "ppui-room-list");
    list.id = "ppui-room-list";
    list.setAttribute("role", "tabpanel");
    const main = el("div", "ppui-room-main");
    main.append(tools, list);
    const layout = el("div", "ppui-room-layout");
    layout.append(rail, main);
    room.append(head, layout);

    // Our view takes the list's place. The portal keeps its list in a narrow column, so take over the
    // widest box that holds only the stories: climb while a parent adds little text of its own.
    // The portal's own articles stay in the page (hidden), as the fallback.
    const storyText = articles.reduce((n, a) => n + clean(a.textContent).length, 0);
    let box = articles[0].parentElement;
    while (box.parentElement && box.parentElement !== document.body && !box.parentElement.matches(SEL.app) &&
      clean(box.parentElement.textContent).length <= storyText * 1.1 + 160) {
      box = box.parentElement;
    }
    if (articles.every((a) => box.contains(a)) && box !== document.body && !box.matches(SEL.app)) {
      box.before(room);
      box.classList.add("ppui-moved");
    } else {
      articles[0].before(room);
    }
    articles.forEach((a) => a.classList.add("ppui-moved"));
    // If the column we landed in is still narrow, widen the view past it, centred on the window
    // (only where things stack top to bottom, so it can't run over a column beside it).
    const widen = () => {
      room.style.marginLeft = room.style.width = "";
      if (!/^(block|flow-root)$/.test(getComputedStyle(room.parentElement).display)) return;
      const host = room.parentElement.getBoundingClientRect();
      const want = Math.min(1080, document.documentElement.clientWidth - 24);
      if (host.width >= want - 1) return;
      room.style.width = want + "px";
      room.style.marginLeft = Math.round((document.documentElement.clientWidth - want) / 2 - host.left) + "px";
    };
    widen();
    addEventListener("resize", widen);
    // The portal names this page (e.g. "9-13 News"): use its name as our title, and hide the portal's
    // own heading and title strip so the top of the page isn't spent on them.
    const named = [...document.querySelectorAll("h1, h2, h3, .screen-toolbar")]
      .filter((n) => !n.closest(".article, .ppui-header, .ppui-newsroom") && /news/i.test(n.textContent) &&
        clean(n.textContent).length <= 60);
    if (named.length) {
      title.textContent = clean((named.find((n) => /^H[1-3]$/.test(n.tagName)) || named[0]).textContent);
      named.forEach((n) => n.classList.add("ppui-moved"));
    }

    // Teaser-only stories fetch their full text (and picture) as they come near the screen.
    const fetcher = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        fetcher.unobserve(entry.target);
        entry.target.ppuiFetch();
      }
    }, { rootMargin: "400px 0px" });

    function storyCard(item, index) {
      const pinned = actions.isPinned(item);
      const card = el("article", "ppui-room-story" + (pinned ? " is-pinned" : ""));
      card.id = "ppui-story-" + index;
      card.dataset.index = String(index);
      card.tabIndex = -1;
      card.setAttribute("aria-labelledby", card.id + "-title");

      const meta = el("div", "ppui-room-meta");
      const when = el("span", "ppui-room-when");
      if (pinned) {
        const mark = el("span", "ppui-pinned-mark");
        mark.append(icon("pin"), document.createTextNode("Pinned"));
        when.appendChild(mark);
      }
      if (item.dateText) when.appendChild(el("span", "ppui-room-date", item.dateText));
      if (item.date.ago && item.date.ago !== item.dateText) when.appendChild(el("span", "ppui-room-ago", item.date.ago));
      const buttons = el("span", "ppui-room-actions");
      if (actions.view === "trash") {
        buttons.appendChild(storyButton("ppui-story-restore", "Restore", "rotateCcw", () => leave(card, () => actions.restore(item))));
      } else {
        const pin = storyButton("ppui-story-pin", pinned ? "Unpin" : "Pin to the top", "pin", () => actions.togglePin(item));
        pin.setAttribute("aria-pressed", String(pinned));
        buttons.append(pin, storyButton("ppui-story-trash", "Move to trash", "trash", () => leave(card, () => actions.trash(item))));
      }
      meta.append(storyStub(item), when, buttons);

      const headline = el("h2", "ppui-room-headline", item.title);
      headline.id = card.id + "-title";
      const picture = el("div", "ppui-room-picture");
      if (item.image) picture.appendChild(photoFrame(item, true));
      const body = el("div", "ppui-room-body ppui-reader-body");
      body.id = card.id + "-body";
      const foot = el("div", "ppui-room-foot");
      card.append(meta, headline, picture, body, foot);

      const fill = (story) => {
        body.replaceChildren(...story.body.cloneNode(true).childNodes);
        if (!clean(body.textContent)) body.appendChild(el("p", "ppui-reader-note", "This story has no text in the news list."));
        if (item.image && !picture.firstChild) picture.appendChild(photoFrame(item, true));
        card.classList.toggle("has-picture", !!picture.firstChild);
        fold();
      };
      // Stories start folded to their first few lines (with the picture beside them); "Read the story"
      // opens one in place and "Show less" folds it again. Very short stories just show in full.
      const fold = () => {
        foot.querySelector(".ppui-room-more")?.remove();
        const long = clean(body.textContent).length > FOLD_CHARS;
        const open = card.classList.contains("is-open");
        card.classList.toggle("is-folded", long && !open);
        if (!long) return;
        const more = el("button", "ppui-room-more", open ? "Show less" : "Read the story");
        more.type = "button";
        more.setAttribute("aria-expanded", String(open));
        more.setAttribute("aria-controls", body.id);
        more.addEventListener("click", () => {
          const opening = !card.classList.contains("is-open");
          card.classList.toggle("is-open", opening);
          fold();
          foot.querySelector(".ppui-room-more").focus({ preventScroll: true });
          if (!opening && card.getBoundingClientRect().top < 0) {
            card.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
          }
        });
        foot.prepend(more);
      };
      fill(item.story || { body: item.body });

      // "Open full": the whole story (full text, big picture) in the reader panel, on this page.
      const full = el("button", "ppui-reader-source ppui-room-open", "Open full");
      full.type = "button";
      full.setAttribute("aria-haspopup", "dialog");
      full.addEventListener("click", () => openReader(shownNow, shownNow.indexOf(item), location.href, actions));
      foot.appendChild(full);
      // Only the list's preview (or no picture yet): get the story's own page when the card nears the screen.
      if (item.href && !item.story && (clean(item.body.textContent).length < 400 || !item.image)) {
        card.ppuiFetch = () => fullStory(item).then((story) => {
          item.story = story;
          if (card.isConnected) fill(story);
        });
        fetcher.observe(card);
      }
      return card;
    }

    // A card leaving its tab (to the trash, or back from it) slides out first.
    function leave(card, then) {
      if (reduced()) return then();
      card.classList.add("is-leaving");
      setTimeout(then, 260);
    }

    function switchTo(view) {
      if (view === actions.view) return;
      actions.view = view;
      render();
      list.classList.remove("is-switching");
      void list.offsetWidth;
      list.classList.add("is-switching");
      if (room.getBoundingClientRect().top < 0) room.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
    }

    function moveIndicator() {
      const b = tabButtons.find((t) => t.dataset.view === actions.view);
      indicator.style.width = b.offsetWidth + "px";
      indicator.style.translate = b.offsetLeft + "px 0";
    }

    function render() {
      const counts = actions.counts();
      whenChoice.text.textContent = whenLabel();
      whenChoice.btn.classList.toggle("is-active", when.kind !== "all");
      sortChoice.text.textContent = sort === "newest" ? "Newest" : "Oldest";
      for (const b of tabButtons) {
        const on = b.dataset.view === actions.view;
        b.setAttribute("aria-selected", String(on));
        b.tabIndex = on ? 0 : -1;
        b.querySelector(".ppui-room-tab-count").textContent = String(counts[b.dataset.view]);
      }
      list.setAttribute("aria-labelledby", "ppui-tab-" + actions.view);
      moveIndicator();

      tools.replaceChildren();
      if (actions.view === "trash" && counts.trash) {
        tools.appendChild(el("p", "ppui-room-tools-text", "Trashed stories stay here until you restore them."));
        const all = el("button", "ppui-room-restore-all", "Restore all");
        all.type = "button";
        all.prepend(icon("rotateCcw"));
        all.addEventListener("click", () => actions.restoreAll());
        tools.appendChild(all);
      }

      fetcher.disconnect();
      const inTab = actions.visible();
      const shown = arrange(inTab);
      shownNow = shown;
      if (shown.length) {
        list.replaceChildren(...shown.map(storyCard));
      } else if (inTab.length) {
        // The tab has stories, just none from the chosen time.
        const empty = emptyState(when.kind === "day" ? "No stories on " + whenLabel() + "." : "No stories from " + whenLabel().toLowerCase() + ".", "div");
        const all = el("button", "ppui-room-restore-all", "Show all time");
        all.type = "button";
        all.addEventListener("click", () => setWhen({ kind: "all" }));
        empty.appendChild(all);
        list.replaceChildren(empty);
      } else {
        list.replaceChildren(emptyState(actions.emptyText, "div"));
      }
      buildRail(shown);
    }

    // The stories on screen now, in order, for the reader's previous / next.
    let shownNow = [];

    // ---- Timeline ----
    let current = -1;

    function buildRail(shown) {
      nodes.replaceChildren();
      const last = Math.max(shown.length - 1, 1);
      shown.forEach((item, i) => {
        const li = el("li", "ppui-rail-item");
        li.style.setProperty("--pos", String(i / last));
        const b = el("button", "ppui-rail-node");
        b.type = "button";
        b.setAttribute("aria-label", item.title + (item.dateText ? ", " + item.dateText : ""));
        b.title = item.title;
        b.append(el("span", "ppui-rail-dot"), el("span", "ppui-rail-date", item.date.day ? item.date.day + " " + item.date.month : String(i + 1)));
        b.addEventListener("click", () => goTo(i));
        li.appendChild(b);
        nodes.appendChild(li);
      });
      rail.hidden = shown.length < 2;
      rail.style.setProperty("--count", String(shown.length));
      current = -1;
      followScroll();
    }

    // Where you are: the last card whose top has crossed the reading line, and how far through it.
    // The fill runs from the first dot to the last, so it lines up with the dots.
    function followScroll() {
      const cards = [...list.querySelectorAll(".ppui-room-story")];
      if (cards.length < 2) return;
      const line = innerHeight * READING_LINE;
      let index = 0;
      let through = 0;
      cards.forEach((card, i) => {
        const r = card.getBoundingClientRect();
        if (r.top <= line) {
          index = i;
          through = Math.min(Math.max((line - r.top) / r.height, 0), 1);
        }
      });
      // At the very bottom of the page the last story counts as reached.
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) {
        index = cards.length - 1;
        through = 0;
      }
      const progress = Math.min((index + through) / (cards.length - 1), 1);
      rail.style.setProperty("--rail-progress", progress.toFixed(4));
      if (index !== current) setCurrent(index, cards.length);
    }

    function setCurrent(index, total) {
      current = index;
      nodes.querySelectorAll(".ppui-rail-node").forEach((b, i) => {
        b.classList.toggle("is-current", i === index);
        b.classList.toggle("is-past", i < index);
        if (i === index) b.setAttribute("aria-current", "step");
        else b.removeAttribute("aria-current");
      });
      const date = nodes.querySelectorAll(".ppui-rail-date")[index];
      chip.textContent = (index + 1) + " of " + total + (date ? "  " + date.textContent : "");
    }

    function goTo(i) {
      const card = list.querySelector('.ppui-room-story[data-index="' + i + '"]');
      if (!card) return;
      // Put the card's top just under the reading line's band, so it becomes the current one.
      const top = card.getBoundingClientRect().top + scrollY - Math.min(innerHeight * 0.2, 120);
      scrollTo({ top, behavior: reduced() ? "auto" : "smooth" });
      card.focus({ preventScroll: true });
    }

    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        followScroll();
      });
    };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", () => {
      moveIndicator();
      onScroll();
    });

    render();
    // Fonts arriving can shift the tab widths.
    if (document.fonts) document.fonts.ready.then(moveIndicator);
  }

  // The News page gets its own view (tabs, full-text cards, a timeline). It is recognised by its
  // stories rather than its address, which varies. Articles hydrate late: wait for the first, give
  // the rest a moment, then build. If anything fails the portal's list comes back and the error is logged.
  // The portal's list is hidden from the moment it appears (html.ppui-news-pending), so it never
  // flashes; early.js hides it even sooner on an address that was the News page last time.
  const hasStories = () => document.querySelector(SEL.article + " " + SEL.articleTitle);
  if (!HOME_PATH.test(location.pathname)) {
    whenReady(hasStories, () => {
      if (!hasStories()) {
        root.classList.remove("ppui-news-pending");
        return;
      }
      root.classList.add("ppui-news-pending");
      // Build once the list stops growing: two quiet checks in a row, 100 ms apart.
      let count = -1;
      let quiet = 0;
      const timer = setInterval(() => {
        const n = document.querySelectorAll(SEL.article).length;
        quiet = n === count ? quiet + 1 : 0;
        count = n;
        if (quiet < 2) return;
        clearInterval(timer);
        try {
          root.classList.add("ppui-newspage");
          buildNewsPage();
          try {
            localStorage.setItem(NEWS_PATH_KEY, location.pathname);
          } catch (e) {}
        } catch (e) {
          console.warn("[Pinehurst Dashboard] News page view failed; showing the portal's list.", e);
          root.classList.remove("ppui-newspage");
          document.querySelectorAll(".ppui-moved").forEach((n) => n.classList.remove("ppui-moved"));
          document.querySelector(".ppui-newsroom")?.remove();
        } finally {
          root.classList.remove("ppui-news-pending");
        }
      }, 100);
    }, NEWS_WAIT_MS);
  }

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
    const art = el("span", "ppui-feature-icon");
    art.appendChild(icon(subjectIcon(pick.item.title)));
    const text = el("div", "ppui-feature-text");
    const label = el("span", "ppui-feature-label");
    if (pick.label === "Now") label.appendChild(el("span", "ppui-live"));
    label.appendChild(document.createTextNode(pick.label + " " + when));
    text.append(label, el("span", "ppui-feature-class", pick.item.title));
    if (pick.item.subtitle) text.appendChild(el("span", "ppui-meta", pick.item.subtitle));
    box.append(art, text);
  }

  // How far through today's timetable we are: one segment per period, as wide as the period is long,
  // filled for the ones that are over and partly filled for the one on now.
  function renderProgress(bar, items) {
    const timed = items.filter((item) => item.start !== null);
    bar.hidden = timed.length < 2;
    if (bar.hidden) return;
    const d = new Date();
    const minutes = d.getHours() * 60 + d.getMinutes();
    const track = bar.querySelector(".ppui-progress-track");
    track.replaceChildren();
    let total = 0;
    let passed = 0;
    let done = 0;
    timed.forEach((item, i) => {
      const end = i + 1 < timed.length ? timed[i + 1].start : item.start + 50;
      const length = Math.max(end - item.start, 5);
      const fill = Math.min(Math.max((minutes - item.start) / length, 0), 1);
      total += length;
      passed += fill * length;
      if (fill >= 1) done++;
      const seg = el("span", "ppui-progress-seg" + (fill > 0 && fill < 1 ? " is-now" : ""));
      seg.style.flexGrow = String(length);
      seg.style.setProperty("--fill", fill.toFixed(3));
      seg.style.setProperty("--i", String(i));
      seg.title = item.title + ", " + item.time;
      track.appendChild(seg);
    });
    bar.querySelector(".ppui-progress-label").textContent =
      done >= timed.length ? "School's out" : passed <= 0 ? timed.length + " on today" : done + " of " + timed.length + " done";
    bar.setAttribute("aria-valuenow", String(Math.round((passed / total) * 100)));
  }

  function buildProgress() {
    const bar = el("div", "ppui-progress");
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-label", "School day");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    bar.append(el("span", "ppui-progress-track"), el("span", "ppui-progress-label"));
    bar.hidden = true;
    return bar;
  }

  // Placeholder rows that shimmer while a card loads.
  function skeleton(count) {
    const items = [];
    for (let i = 0; i < count; i++) {
      const li = el("li", "ppui-skeleton");
      li.setAttribute("aria-hidden", "true");
      li.style.setProperty("--i", String(i));
      li.append(el("span", "ppui-skel-a"), el("span", "ppui-skel-b"));
      items.push(li);
    }
    return items;
  }

  function renderRows(list, items) {
    list.replaceChildren();
    if (!items.length) {
      list.appendChild(emptyState("Nothing scheduled today."));
      return;
    }
    const nowIndex = items.findIndex((item) => item.now);
    items.forEach((item, i) => {
      const row = el("li", "ppui-row" + (item.now ? " is-now" : "") + (i < nowIndex ? " is-past" : ""));
      row.style.setProperty("--i", String(i));
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
    const progress = buildProgress();
    const list = el("ul", "ppui-rows");
    list.append(el("li", "ppui-sr", "Loading schedule..."), ...skeleton(5));
    section.append(featured, progress, list);

    async function load() {
      try {
        const res = await fetch(SCHEDULE_URL, { credentials: "same-origin" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const items = parseSchedule(await res.text());
        if (!items) throw new Error("schedule markup not found");
        renderFeatured(featured, items);
        renderProgress(progress, items);
        renderRows(list, items);
      } catch (e) {
        featured.hidden = true;
        progress.hidden = true;
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

  function renderNews(list, items, newsHref, actions) {
    list.replaceChildren();
    if (!items.length) {
      list.appendChild(emptyState(actions.emptyText));
      return;
    }
    items.slice(0, NEWS_COUNT).forEach((item, i) => {
      const pinned = actions.isPinned(item);
      const row = el("li", "ppui-story" + (i === 0 ? " is-lead" : "") + (pinned ? " is-pinned" : ""));
      row.style.setProperty("--i", String(i));
      const a = el("a", "ppui-story-link");
      a.href = item.href || newsHref;
      a.setAttribute("aria-haspopup", "dialog");
      // A plain click reads the story here; Ctrl/Cmd/Shift/middle click still open the portal page.
      a.addEventListener("click", (e) => {
        if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        openReader(items, i, newsHref, actions);
      });
      if (i === 0) a.appendChild(photoFrame(item));
      const body = el("span", "ppui-story-body");
      body.appendChild(el("span", "ppui-headline", item.title));
      if (i === 0 && item.summary) body.appendChild(el("span", "ppui-summary", item.summary));
      const meta = el("span", "ppui-meta");
      if (pinned) {
        const mark = el("span", "ppui-pinned-mark");
        mark.append(icon("pin"), document.createTextNode("Pinned"));
        meta.appendChild(mark);
      }
      if (item.date.ago) meta.appendChild(document.createTextNode(item.date.ago));
      body.appendChild(meta);
      a.append(storyStub(item), body);

      // Pin / trash (or, in the trash view, restore). They sit over the row and appear on hover or focus.
      const tools = el("span", "ppui-story-actions");
      if (actions.view === "trash") {
        tools.appendChild(storyButton("ppui-story-restore", "Restore", "rotateCcw", () => actions.restore(item)));
      } else {
        const pin = storyButton("ppui-story-pin", pinned ? "Unpin" : "Pin to the top", "pin", () => actions.togglePin(item));
        pin.setAttribute("aria-pressed", String(pinned));
        tools.append(pin, storyButton("ppui-story-trash", "Move to trash", "trash", () => {
          row.classList.add("is-leaving");
          setTimeout(() => actions.trash(item), matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 260);
        }));
      }
      row.append(a, tools);
      list.appendChild(row);
    });
  }

  function buildNewsPanel(newsLink) {
    const section = panel("ppui-news", "newspaper", "News", "All news", newsLink.href);
    const list = el("ul", "ppui-stories");
    list.append(el("li", "ppui-sr", "Loading news..."), ...skeleton(4));
    section.appendChild(list);

    let items = [];
    const actions = newsActions(() => items, render);

    // Filter button in the card's heading: All stories / Pinned / Trash, with counts.
    const filter = el("button", "ppui-filter");
    filter.type = "button";
    filter.setAttribute("aria-label", "Filter news");
    filter.title = "Filter news";
    const filterLabel = el("span", "ppui-filter-label");
    filter.append(icon("filter"), filterLabel);
    const menu = el("ul", "ppui-menu ppui-filter-menu");
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", "Show");
    function fillMenu() {
      menu.replaceChildren();
      const counts = actions.counts();
      for (const [value, label] of NEWS_VIEWS) {
        const li = el("li");
        const b = el("button", "ppui-menu-item");
        b.type = "button";
        b.setAttribute("role", "menuitemradio");
        b.setAttribute("aria-checked", String(actions.view === value));
        b.disabled = value !== "all" && !counts[value];
        b.append(el("span", null, label), el("span", "ppui-menu-count", String(counts[value])));
        b.addEventListener("click", () => {
          actions.view = value;
          menu.hidePopover();
          render();
        });
        li.appendChild(b);
        menu.appendChild(li);
      }
      if (counts.trash) {
        const li = el("li", "ppui-menu-sep");
        const b = el("button", "ppui-menu-item", "Restore everything in trash");
        b.type = "button";
        b.setAttribute("role", "menuitem");
        b.addEventListener("click", () => {
          menu.hidePopover();
          actions.restoreAll();
        });
        li.appendChild(b);
        menu.appendChild(li);
      }
    }
    arrowNav(menu, ".ppui-menu-item:not(:disabled)");
    popover(filter, menu, fillMenu);
    menu.addEventListener("toggle", (e) => {
      if (e.newState === "open") (menu.querySelector("[aria-checked='true']") || menu.querySelector("button")).focus();
    });
    const head = section.querySelector(".ppui-head");
    head.insertBefore(filter, head.querySelector(".ppui-link"));

    function render() {
      // An emptied "Pinned" or "Trash" view falls back to everything.
      if (actions.view !== "all" && !actions.visible().length) actions.view = "all";
      filterLabel.textContent = actions.view === "all" ? "" : NEWS_VIEWS.find(([v]) => v === actions.view)[1];
      filter.classList.toggle("is-active", actions.view !== "all");
      const shown = actions.visible();
      renderNews(list, shown, newsLink.href, actions);
      // The lead story's picture often lives only on its own page: fetch it for the card.
      if (shown[0] && !shown[0].image) fullStory(shown[0]);
    }

    async function load() {
      try {
        reader.newsHref = reader.newsHref || newsLink.href;
        items = await loadArticles(newsLink.href);
        render();
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

  // A steady tone per class (one of six blues and silvers from the crest), so a class keeps its colour.
  function toneFor(name) {
    let h = 2166136261;
    for (const c of name) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return (h >>> 0) % 6;
  }

  function courseRow(course) {
    const row = el("li", "ppui-course");
    const badgeIcon = el("span", "ppui-subject");
    badgeIcon.dataset.tone = String(toneFor(course.name));
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
    if (!today.length) list.appendChild(emptyState("No classes today."));
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
      try {
        localStorage.setItem(NEWS_PATH_KEY, new URL(news.href).pathname);
      } catch (e) {}
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
