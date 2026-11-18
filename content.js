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
    home: [
      ["path", { d: "M3 10.5 12 3l9 7.5" }],
      ["path", { d: "M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" }],
    ],
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
    star: [["path", { d: "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" }]],
    pin: [["path", { d: "M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" }]],
    filter: [["path", { d: "M3 6h18M7 12h10M10 18h4" }]],
    calendar: [["rect", { x: 3, y: 4, width: 18, height: 18, rx: 2 }], ["path", { d: "M16 2v4M8 2v4M3 10h18" }]],
    sort: [["path", { d: "m21 16-4 4-4-4M17 20V4M3 8l4-4 4 4M7 4v16" }]],
    chevronDown: [["path", { d: "m6 9 6 6 6-6" }]],
    sliders: [["path", { d: "M20 7h-9M14 17H5" }], ["circle", { cx: 17, cy: 17, r: 3 }], ["circle", { cx: 7, cy: 7, r: 3 }]],
    check: [["path", { d: "M20 6 9 17l-5-5" }]],
    list: [["path", { d: "M3 6h.01M3 12h.01M3 18h.01M8 6h13M8 12h13M8 18h13" }]],
    fileText: [["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7zM14 2v5h6M16 13H8M16 17H8M10 9H8" }]],
    clock: [["circle", { cx: 12, cy: 12, r: 10 }], ["path", { d: "M12 6v6l4 2" }]],
    notebook: [["path", { d: "M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4M2 6h4M2 10h4M2 14h4M2 18h4" }], ["path", { d: "M21.38 5.63a1 1 0 1 0-3-3l-5.02 5a2 2 0 0 0-.5.86l-.84 2.87a.5.5 0 0 0 .62.62l2.87-.84a2 2 0 0 0 .86-.5z" }]],
    plus: [["path", { d: "M5 12h14M12 5v14" }]],
    minimise: [["path", { d: "M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" }]],
    trash: [["path", { d: "M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" }]],
    rotateCcw: [["path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }], ["path", { d: "M3 3v5h5" }]],
    // Drawn for this extension: the crest's leaning pine, and a person for Account.
    pine: [["path", { d: "M11.9 2.2 18.9 18.5l-5.8 1.4v1.9l-4.4-1.2L5 19.7Z" }]],
    user: [["circle", { cx: 12, cy: 8, r: 4 }], ["path", { d: "M4 21a8 8 0 0 1 16 0" }]],
    tag: [["path", { d: "M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z" }], ["circle", { cx: 7.5, cy: 7.5, r: 1 }]],
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
  const FRAME_ORIGINS = [EMBED_ORIGIN];
  function tellFrames(theme) {
    const message = {
      ppuiTheme: theme,
      ppuiPalette: root.getAttribute("data-ppui-palette") || "",
      // The accent as it is now (theme and colour applied), for frames that don't load our tokens.
      ppuiAccent: getComputedStyle(root).getPropertyValue("--ppui-accent").trim(),
    };
    document.querySelectorAll("iframe").forEach((f) => {
      for (const origin of FRAME_ORIGINS) {
        try {
          f.contentWindow.postMessage(message, origin);
        } catch (e) {}
      }
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
    if (FRAME_ORIGINS.includes(e.origin) && e.data && e.data.ppuiAskTheme) {
      tellFrames(root.getAttribute("data-ppui-theme") || "light");
    }
  });

  // Light, Dark or Auto (follow the system). Chosen under Customise > Appearance.
  function themeChoice() {
    return savedTheme() || "auto";
  }

  function setThemeChoice(choice, from) {
    try {
      if (choice === "auto") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, choice);
    } catch (e) {}
    const next = choice === "auto" ? systemTheme() : choice;
    if (next === root.getAttribute("data-ppui-theme")) return;
    // The new theme spreads out in a circle from what was clicked, where the browser can do it.
    if (!document.startViewTransition || !from || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      applyTheme(next);
      return;
    }
    const r = from.getBoundingClientRect();
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
  }

  // On Auto, follow the system as it changes.
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (!savedTheme()) applyTheme(systemTheme());
  });

  // ---- Popovers (native Popover API: light dismiss, Esc and top layer for free) ----
  let popoverCount = 0;

  function placePopover(trigger, pop) {
    if (matchMedia("(max-width: 640px)").matches) {
      pop.style.top = pop.style.left = "";
      return;
    }
    // Page coordinates (the popover is position: absolute), so an open dropdown scrolls with the
    // page and stays by its button instead of following the window.
    const r = trigger.getBoundingClientRect();
    const width = pop.offsetWidth;
    const left = Math.min(Math.max(8, r.right - width), innerWidth - width - 8);
    pop.style.left = left + scrollX + "px";
    pop.style.top = Math.max(8, Math.min(r.bottom + 8, innerHeight - pop.offsetHeight - 8)) + scrollY + "px";
  }

  // Wire a <button> to open `pop`; onOpen runs each time it opens (fill or focus content).
  // Popovers whose button has since been thrown away (re-rendered rows) are removed on the next open.
  const popovers = new Map();
  function sweepPopovers() {
    for (const [pop, trigger] of popovers) {
      if (trigger.isConnected || pop.matches(":popover-open")) continue;
      pop.remove();
      popovers.delete(pop);
    }
  }

  function popover(trigger, pop, onOpen) {
    pop.id = "ppui-pop-" + ++popoverCount;
    pop.popover = "auto";
    pop.classList.add("ppui-popover");
    trigger.popoverTargetElement = pop;
    trigger.setAttribute("aria-controls", pop.id);
    trigger.setAttribute("aria-expanded", "false");
    popovers.set(pop, trigger);
    // A modal <dialog> (notebook, calendar) makes everything outside it inert, so a menu left in
    // <body> shows but ignores clicks. Before it opens, move it into the dialog its button sits in.
    trigger.addEventListener("click", () => {
      const host = trigger.closest("dialog") || document.body;
      if (pop.parentNode !== host && !pop.matches(":popover-open")) host.appendChild(pop);
    });
    pop.addEventListener("beforetoggle", (e) => {
      if (e.newState !== "open") return;
      sweepPopovers();
      if (onOpen) onOpen();
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

  // Each class's Updates, Website and Calendar, saved from the home page's class list.
  function classLinks() {
    const out = [];
    for (const c of cachedClasses()) {
      const links = [];
      const updates = c.updatesHref && sameOriginHref(c.updatesHref);
      if (updates) links.push({ label: "Updates", iconName: "activity", href: updates });
      for (const l of Array.isArray(c.links) ? c.links : []) {
        const href = l && safeHref(l.href);
        const label = l && clean(l.label);
        if (!href || !label || /grade|assignment|update/i.test(label)) continue;
        links.push({ label, iconName: /calendar/i.test(label) ? "calendar" : "globe", href });
      }
      if (links.length) out.push({ name: c.name, links });
    }
    return out;
  }

  // One row per class: its name, then a round button per link.
  function classesGroup(classes) {
    const group = el("section", "ppui-apps-group is-classes");
    const heading = el("h3", "ppui-apps-title");
    heading.append(icon("bookOpen"), document.createTextNode("Classes"));
    group.appendChild(heading);
    const ul = el("ul", "ppui-apps-list");
    for (const c of classes) {
      const li = el("li", "ppui-app-class");
      li.appendChild(el("span", "ppui-app-class-name", c.name));
      for (const link of c.links) {
        const a = linkTo(el("a", "ppui-app-icon"), link.href);
        const opens = a.target ? " (opens in new tab)" : "";
        a.title = link.label + opens;
        a.setAttribute("aria-label", c.name + " " + link.label + opens);
        a.append(icon(link.iconName), el("span", "ppui-sr", link.label));
        li.appendChild(a);
      }
      ul.appendChild(li);
    }
    group.appendChild(ul);
    return group;
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
      const classes = classLinks();
      if (classes.length) body.appendChild(classesGroup(classes));
      if (!items.length && !classes.length) {
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
    arrowNav(pop, ".ppui-apps-search, .ppui-app, .ppui-app-icon");

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

  // ---- Banner style picker (remembered per browser) ----
  const BANNER_KEY = "ppui-banner-style";
  const BANNER_THEME_KEY = "ppui-banner-palette";

  function savedBannerTheme() {
    try {
      const v = localStorage.getItem(BANNER_THEME_KEY);
      return window.PPUIBanner && window.PPUIBanner.themes.some(([id]) => id === v) ? v : "blue";
    } catch (e) {
      return "blue";
    }
  }

  function savedBannerStyle() {
    try {
      const v = localStorage.getItem(BANNER_KEY);
      return window.PPUIBanner && window.PPUIBanner.styles.some(([id]) => id === v) ? v : "mesh";
    } catch (e) {
      return "mesh";
    }
  }

  // ---- Customise: banner style, colour theme and the floating bar's look, in one panel ----

  function buildCustomise(banner) {
    const btn = el("button", "ppui-bar-button ppui-customise-button");
    btn.type = "button";
    btn.title = "Customise";
    btn.setAttribute("aria-label", "Customise");
    btn.appendChild(icon("palette"));
    const panel = el("div", "ppui-customise");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Customise");
    const save = (key, value) => {
      try {
        localStorage.setItem(key, value);
      } catch (e) {}
    };
    const section = (title, note) => {
      const head = el("div", "ppui-cz-head");
      const h = el("h3", "ppui-cz-title", title);
      if (note) h.append(el("span", "ppui-cz-note", note));
      head.append(h);
      panel.appendChild(head);
    };
    const fill = () => {
      panel.textContent = "";
      const style = savedBannerStyle(), theme = savedBannerTheme(), mode = themeChoice();

      section("Appearance");
      const seg = el("div", "ppui-cz-seg");
      for (const [id, label] of [["light", "Light"], ["dark", "Dark"], ["auto", "Auto"]]) {
        const o = el("button", "ppui-cz-seg-item", label);
        o.type = "button";
        o.setAttribute("aria-pressed", String(id === mode));
        o.addEventListener("click", () => {
          setThemeChoice(id, o);
          fill();
        });
        seg.appendChild(o);
      }
      panel.appendChild(seg);

      section("Banner");
      const tiles = el("div", "ppui-cz-tiles");
      for (const [id, label] of window.PPUIBanner.styles) {
        const t = el("button", "ppui-cz-tile");
        t.type = "button";
        t.setAttribute("aria-pressed", String(id === style));
        const c = el("canvas", "ppui-cz-preview");
        c.setAttribute("aria-hidden", "true");
        t.append(c, el("span", null, label));
        t.addEventListener("click", () => {
          save(BANNER_KEY, id);
          banner.setStyle(id);
          fill();
        });
        tiles.appendChild(t);
        requestAnimationFrame(() => window.PPUIBanner.preview(id, c, theme));
      }
      panel.appendChild(tiles);

      const themeName = (window.PPUIBanner.themes.find(([id]) => id === theme) || [])[1] || "Blue";
      section("Colour", themeName);
      const swatches = el("div", "ppui-cz-swatches");
      for (const [id, label, colour] of window.PPUIBanner.themes) {
        const sw = el("button", "ppui-cz-swatch");
        sw.type = "button";
        sw.title = label;
        sw.setAttribute("aria-label", label);
        sw.setAttribute("aria-pressed", String(id === theme));
        sw.style.setProperty("--sw", colour);
        sw.addEventListener("click", () => {
          save(BANNER_THEME_KEY, id);
          banner.setTheme(id);
          fill();
        });
        swatches.appendChild(sw);
      }
      panel.appendChild(swatches);

    };
    popover(btn, panel, fill);
    panel.addEventListener("toggle", (e) => {
      if (e.newState === "open") (panel.querySelector("[aria-pressed='true']") || panel.querySelector("button")).focus();
    });
    return btn;
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
    const scene = buildScene(!home);
    header.appendChild(scene);
    // Banner style (Classic, Low-poly Mesh, Mosaic): drawn by banner.js over the scene.
    const banner = window.PPUIBanner ? window.PPUIBanner.mount(header, scene, savedBannerStyle(), savedBannerTheme()) : null;

    // Left: Back and Home in their own small glass pill (no logo). Not shown on the home page itself.
    const navPill = el("nav", "ppui-pill ppui-nav-pill");
    navPill.hidden = home;
    navPill.setAttribute("aria-label", "Go back or home");
    const back = el("button", "ppui-bar-button ppui-back");
    back.type = "button";
    back.title = "Back";
    back.setAttribute("aria-label", "Back");
    back.appendChild(icon("chevronLeft"));
    // Always shown; on a fresh tab with nothing to go back to it goes home instead.
    back.addEventListener("click", () => {
      if (history.length > 1) history.back();
      else location.assign(HOME_URL);
    });
    const homeLink = el("a", "ppui-bar-button ppui-home");
    homeLink.href = HOME_URL;
    homeLink.title = "Home";
    homeLink.setAttribute("aria-label", "Home");
    if (home) homeLink.setAttribute("aria-current", "page");
    homeLink.appendChild(icon("home"));
    navPill.append(back, homeLink);
    if (window.PPUIBanner) window.PPUIBanner.glass(navPill);

    const pill = el("nav", "ppui-pill");
    pill.setAttribute("aria-label", "Portal tools");
    pill.append(buildCalendarButton(), buildNotebookButton(), buildApps());
    if (banner) pill.appendChild(buildCustomise(banner));
    if (window.PPUIBanner) window.PPUIBanner.glass(pill);
    // Messages and Account borrow the portal's top bar, which can hydrate after the header is up
    // (or never, on pages the portal leaves bare). Add them when it turns up.
    const addBarLinks = () => {
      if (pill.querySelector(".ppui-messages, .ppui-avatar")) return;
      const messages = buildMessages();
      const account = buildAccount();
      if (messages) pill.prepend(messages);
      if (account) pill.appendChild(account);
    };
    whenReady(() => document.querySelector(SEL.navAccount), addBarLinks, NAV_WAIT_MS);

    const top = el("div", "ppui-header-top");
    top.append(navPill, pill);
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
  // Home waits for the page column (the hero goes inside it) and the top bar. Every other page gets
  // its header, with Back and Home, straight away, even pages the portal leaves bare.
  whenReady(
    () => !HOME_PATH.test(location.pathname) || (document.querySelector(SEL.navAccount) && document.querySelector(SEL.app)),
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

  // A story's date. The portal writes "Tue, Nov 17" with no year, which Chrome reads as 2001, so a
  // date without a year gets this year (or last year, if that would put it in the future).
  function storyDate(text) {
    if (!text) return new Date(NaN);
    if (/\b\d{4}\b/.test(text)) return new Date(text);
    const plain = text.replace(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+/i, "");
    const year = new Date().getFullYear();
    let d = new Date(plain + " " + year);
    if (!isNaN(d) && d - Date.now() > 2 * 864e5) d = new Date(plain + " " + (year - 1));
    return d;
  }

  // "Oct 14" -> { day: "14", month: "Oct", ago: "Wed 14 Oct" }; unparseable dates keep their text.
  // Takes the date's text, or a Date.
  function splitDate(text) {
    const d = text instanceof Date ? text : storyDate(text);
    if (isNaN(d)) return { day: "", month: "", ago: text instanceof Date ? "" : text };
    const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 864e5);
    // "Today", "Yesterday", otherwise the date itself ("Mon 13 Oct"), never a bare weekday.
    const ago = days === 0 ? "Today" : days === 1 ? "Yesterday" :
      d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" }).replace(",", "") +
      (d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : "");
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
      .find((n) => !n.closest(SEL.articleTitle) && !n.closest(SEL.articleDate) &&
        !n.querySelector(SEL.articleTitle + ", " + SEL.articleDate + ", .article-channel") &&
        clean(n.textContent).length > (n.matches(".article-summary") ? 0 : 40));
    const picture = pictureOf(node);
    const anchor = storyAnchor(node);
    const dateText = text(SEL.articleDate);
    const day = storyDate(dateText);
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
    const when = el("span", "ppui-reader-when");
    if (item.dateText) when.appendChild(el("span", "ppui-reader-date", item.dateText));
    if (item.date.ago && item.date.ago !== item.dateText) when.appendChild(el("span", "ppui-reader-ago", item.date.ago));
    meta.appendChild(when);

    const title = el("h2", "ppui-reader-title", item.title);
    title.id = "ppui-reader-title";
    const body = el("div", "ppui-reader-body");
    page.append(meta, title, body);
    // The portal's own page for the story, always at the end.
    if (item.href) {
      const source = el("a", "ppui-reader-source");
      source.href = item.href;
      source.append(el("span", null, "Open full story"), icon("external"));
      page.appendChild(source);
    }

    const show = (story) => {
      body.replaceChildren(...story.body.cloneNode(true).childNodes);
      // Only the news list's preview came through: say so (the full page is linked below).
      if (item.href && story.body === item.body && clean(item.body.textContent).length < 400) {
        body.appendChild(el("p", "ppui-reader-note", "This is the preview from the news list. The full story is on the portal's page."));
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
    markOpened(item);
    const old = dialog.querySelector(".ppui-reader-page");
    const page = readerPage(item, direction);
    if (old) old.replaceWith(page);
    else dialog.querySelector(".ppui-reader-scroll").appendChild(page);
    dialog.querySelector(".ppui-reader-scroll").scrollTop = 0;
    dialog.querySelector(".ppui-reader-count").textContent = (reader.index + 1) + " of " + stories.length;
    const single = stories.length < 2;
    dialog.querySelectorAll(".ppui-reader-step").forEach((b) => (b.disabled = single));
    const star = dialog.querySelector(".ppui-reader-star");
    const starred = reader.actions.isStarred(item);
    star.setAttribute("aria-pressed", String(starred));
    star.title = starred ? "Unstar" : "Star";
    star.setAttribute("aria-label", star.title);
    const pin = dialog.querySelector(".ppui-reader-pin");
    const pinned = reader.actions.isPinned(item);
    pin.setAttribute("aria-pressed", String(pinned));
    pin.title = pinned ? "Unpin" : "Pin to top";
    pin.setAttribute("aria-label", pin.title);
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
    // Wait for the panel's own exit (not a page's), with a timer in case it never fires.
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
      readerButton("ppui-reader-pin ppui-story-pin", "Pin to top", "pin", () => {
        reader.actions.togglePin(reader.stories[reader.index]);
        showStory(reader.index);
      }),
      readerButton("ppui-reader-star ppui-story-star", "Star", "star", () => {
        reader.actions.toggleStar(reader.stories[reader.index]);
        showStory(reader.index);
      }),
      readerButton("ppui-reader-trash", "Mark as read", "check", () => {
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

    // The arrow keys flip between stories.
    dialog.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest("input, textarea")) return;
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!step || reader.stories.length < 2) return;
      e.preventDefault();
      showStory(reader.index + step, step > 0 ? "next" : "prev");
    });
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

  // `centre`: open as a large window in the middle (the News page); otherwise the side panel (home card).
  function openReader(stories, index, newsHref, actions, centre = false) {
    reader.stories = stories.slice();
    reader.newsHref = newsHref;
    reader.actions = actions;
    if (!reader.dialog) reader.dialog = buildReader();
    reader.dialog.classList.remove("is-closing");
    reader.dialog.classList.toggle("is-centre", centre);
    reader.dialog.querySelector(".ppui-reader-all").href = newsHref;
    reader.dialog.querySelector(".ppui-reader-page")?.remove();
    showStory(index);
    root.classList.add("ppui-reading");
    if (!reader.dialog.open) reader.dialog.showModal();
    reader.dialog.querySelector(".ppui-reader-page").focus({ preventScroll: true });
  }

  // ---- Pinned and starred stories, and trash (kept in this browser only; shared by the card and the News page) ----
  // Pinned: held at the top of the News page and the home card until unpinned, as a reminder.
  // Starred: saved to the Starred tab for later; it stays in its place in the list.

  const NEWS_PREFS_KEY = "ppui-news";
  // The News page's address, remembered so early.js can hide the portal's list before it paints.
  const NEWS_PATH_KEY = "ppui-news-path";
  const storyKey = (item) => item.title + "|" + item.dateText;

  // Earlier versions called the trash "hidden"; read that too so nothing comes back unasked.
  function loadNewsPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem(NEWS_PREFS_KEY) || "{}");
      const list = (v) => (Array.isArray(v) ? v : []);
      return { starred: [...new Set(list(p.starred))], pinned: [...new Set(list(p.pinned))], trash: [...new Set(list(p.trash).concat(list(p.hidden)))] };
    } catch (e) {
      return { starred: [], pinned: [], trash: [] };
    }
  }

  function saveNewsPrefs(prefs) {
    try {
      localStorage.setItem(NEWS_PREFS_KEY, JSON.stringify({ starred: prefs.starred.slice(-300), pinned: prefs.pinned.slice(-50), trash: prefs.trash.slice(-200) }));
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
    ["starred", "Starred"],
    ["trash", "Read"],
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
      isTrashed: (item) => prefs.trash.includes(storyKey(item)),
      isStarred: (item) => prefs.starred.includes(storyKey(item)),
      isPinned: (item) => prefs.pinned.includes(storyKey(item)),
      toggleStar(item) {
        const key = storyKey(item);
        change(() => {
          prefs.starred = prefs.starred.includes(key) ? prefs.starred.filter((k) => k !== key) : prefs.starred.concat(key);
        });
      },
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
        });
        toast("Marked as read", "Undo", () => actions.restore(item));
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
      // Read stories leave "all" (except pinned and starred ones) and show in "trash". "starred" keeps
      // its stories whether read or not. "all" puts pinned stories first; starred ones keep their place.
      visible(view = actions.view) {
        const items = getItems();
        if (view === "trash") return items.filter(actions.isTrashed);
        if (view === "starred") return items.filter(actions.isStarred);
        const kept = items.filter((item) => actions.isPinned(item) || actions.isStarred(item) || !actions.isTrashed(item));
        return kept.filter(actions.isPinned).concat(kept.filter((item) => !actions.isPinned(item)));
      },
      counts: () => Object.fromEntries(NEWS_VIEWS.map(([view]) => [view, actions.visible(view).length])),
      get emptyText() {
        if (actions.view === "starred") return "Nothing starred yet. Star a story to save it here for later.";
        if (actions.view === "trash") return "Nothing here yet. Tick a story once you've read it.";
        return "No news right now.";
      },
    };
    return actions;
  }

  // ---- News page: tabs (All / Starred / Read), search and sort, a day picker, and the stories
  // in day sections down a timeline, with a line heading the stories new since your last visit ----

  // Which stories were there last time you opened the News page (to mark what's new), and which
  // you've opened in the reader since (new ones lose their dot once read).
  const NEWS_SEEN_KEY = "ppui-news-seen";
  const NEWS_OPENED_KEY = "ppui-news-opened";

  function readKeys(key) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || "null");
      return Array.isArray(v) ? new Set(v) : null;
    } catch (e) {
      return null;
    }
  }

  function markOpened(item) {
    try {
      const keys = [...(readKeys(NEWS_OPENED_KEY) || [])].filter((k) => k !== storyKey(item));
      keys.push(storyKey(item));
      localStorage.setItem(NEWS_OPENED_KEY, JSON.stringify(keys.slice(-300)));
    } catch (e) {}
  }

  // Midnight `back` days ago, and how many days ago a story's day was.
  function newsDay(back) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - back);
    return d.getTime();
  }
  const daysBack = (time) => Math.round((newsDay(0) - time) / 864e5);
  const fullDayLabel = (time) => new Date(time).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" }).replace(",", "");

  // Day sections: Today, Yesterday, each day of the past week by name, then "Last week", then months.
  function newsSection(time) {
    if (time === null) return { key: "undated", name: "No date" };
    const n = daysBack(time);
    if (n <= 0) return { key: "d0", name: "Today", sub: fullDayLabel(time), today: true };
    if (n === 1) return { key: "d1", name: "Yesterday", sub: fullDayLabel(time) };
    if (n < 7) return { key: "d" + n, name: fullDayLabel(time) };
    if (n < 14) return { key: "lw", name: "Last week" };
    const d = new Date(time);
    const year = d.getFullYear() === new Date().getFullYear() ? "" : " " + d.getFullYear();
    return { key: "m" + d.getFullYear() + "-" + d.getMonth(), name: d.toLocaleDateString("en-AU", { month: "long" }) + year };
  }

  // Text with the search words marked, built as nodes (story text is never parsed as HTML).
  function markMatches(text, query) {
    const frag = document.createDocumentFragment();
    if (!query) {
      frag.append(text);
      return frag;
    }
    const lower = text.toLowerCase();
    let at = 0;
    for (let i = lower.indexOf(query); i !== -1; i = lower.indexOf(query, at)) {
      frag.append(text.slice(at, i), el("mark", "ppui-mark", text.slice(i, i + query.length)));
      at = i + query.length;
    }
    frag.append(text.slice(at));
    return frag;
  }

  const NEWS_ARCHIVE_KEY = "ppui-news-archive";
  const OLDER_STEP = 20;
  const ARCHIVE_MAX_PAGES = 80;

  // Every page of the portal's news list, oldest last, kept small: title, date, picture, the
  // story's address and up to 600 characters of its text (for search and the summary line).
  async function loadArchive(pk) {
    const out = [];
    const getPage = async (page) => {
      const url = new URL("../component/ArticleMultiLineList/" + encodeURIComponent(pk) + "/load_data?page=" + page, location.href);
      const res = await fetch(url, { credentials: "same-origin", headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } });
      if (!res.ok) throw new Error("load_data " + res.status);
      const data = await res.json();
      return data && Array.isArray(data.articles) ? data.articles : [];
    };
    const pages = [];
    // Four pages at a time, until a batch comes back with an empty page.
    for (let start = 0; start < ARCHIVE_MAX_PAGES; start += 4) {
      const batch = await Promise.all([0, 1, 2, 3].map((i) => getPage(start + i)));
      pages.push(...batch);
      if (batch.some((list, i) => !list.length && start + i > 0)) break;
    }
    for (const list of pages) {
      for (const a of list) {
        if (!a || typeof a.title !== "string") continue;
        // The preview is the story's HTML: parsed inert (nothing loads or runs), only its text kept.
        const html = typeof a.summary === "string" && a.summary.trim() ? a.summary : typeof a.preview === "string" ? a.preview : "";
        const title = clean(a.title);
        let text = html ? clean(new DOMParser().parseFromString(html, "text/html").body.textContent) : "";
        if (title && text.toLowerCase().startsWith(title.toLowerCase())) text = text.slice(title.length).replace(/^[\s:.\-–—]+/, "");
        text = text.slice(0, 600);
        out.push({ t: title, d: a.publish_date || "", dt: a.the_date || "", pk: a.article_pk || "", img: a.thumbnail || "", s: text });
      }
    }
    return out;
  }

  // One saved story as the same shape readArticle gives.
  function archiveItem(a) {
    if (!a || typeof a.t !== "string" || !a.t) return null;
    const when = new Date(a.d);
    const ok = !isNaN(when);
    // The same text the portal's list shows ("Tue, Nov 17"), so pins and read marks match.
    const dateText = ok ? when.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "2-digit" }) : String(a.dt || "");
    const summary = String(a.s || "");
    const body = el("div");
    if (summary) body.appendChild(el("p", null, summary));
    let href = null;
    if (a.pk && /^[A-Za-z0-9+/=_-]+$/.test(a.pk)) href = sameOriginHref(new URL("../detail/article/" + a.pk, location.href).href);
    return {
      title: a.t,
      dateText,
      time: ok ? new Date(when).setHours(0, 0, 0, 0) : null,
      date: ok ? splitDate(when) : splitDate(dateText),
      summary: summary.slice(0, 220),
      searchText: summary,
      image: absUrl(a.img),
      href,
      frames: [],
      body,
    };
  }

  function buildNewsPage() {
    const articles = [...document.querySelectorAll(SEL.article)];
    if (!articles.length || document.querySelector(".ppui-newsroom")) return;
    const items = articles.map(readArticle);
    items.forEach((item, i) => (item.rank = i));
    reader.newsHref = location.href;
    const pageCount = items.length;
    const actions = newsActions(() => items, render);
    const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

    // New since your last visit: stories that weren't in the list last time. (On a first visit
    // nothing is marked, rather than everything.) Then remember this visit's stories.
    const seenBefore = readKeys(NEWS_SEEN_KEY);
    try {
      localStorage.setItem(NEWS_SEEN_KEY, JSON.stringify(items.map(storyKey).slice(0, 300)));
    } catch (e) {}
    const isNew = (item) => !item.older && !!seenBefore && !seenBefore.has(storyKey(item));
    const isUnreadNew = (item) => isNew(item) && !(readKeys(NEWS_OPENED_KEY) || new Set()).has(storyKey(item));

    const room = el("section", "ppui-newsroom");
    room.setAttribute("aria-label", "School news");

    // Heading row: the page's name (the portal's, found below) and the three tabs.
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
      b.append(el("span", null, label), el("span", "ppui-room-tab-count"));
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
    head.append(title, tabs);

    // Search and sort. Sort is remembered; pinned stories stay on top in "All stories".
    const SORT_KEY = "ppui-news-sort";
    let sort = "newest";
    try {
      if (localStorage.getItem(SORT_KEY) === "oldest") sort = "oldest";
    } catch (e) {}
    let query = "";
    // One day picked in the Sort menu (null = every day).
    let dayFilter = null;

    const bar = el("div", "ppui-room-bar");
    const searchBox = el("label", "ppui-room-search");
    const search = el("input");
    search.type = "search";
    search.placeholder = "Search news";
    search.setAttribute("aria-label", "Search news");
    searchBox.append(icon("search"), search);
    // Typing re-draws once you pause (a few ms), not on every key.
    let searchTimer = 0;
    search.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        query = search.value.trim().toLowerCase();
        words = query.split(/\s+/).filter(Boolean);
        searchLimit = SEARCH_PAGE;
        render();
      }, 90);
    });
    const searchNote = el("span", "ppui-room-search-note");
    searchNote.setAttribute("aria-live", "polite");
    bar.appendChild(searchBox);

    // Sort: one menu for the order (newest or oldest first) and which day to show.
    const sortButton = el("button", "ppui-room-sort-button");
    sortButton.type = "button";
    const sortLabel = el("span", "ppui-room-sort-label");
    sortButton.append(icon("sort"), sortLabel, icon("chevronDown"));
    bar.appendChild(sortButton);
    const setSort = (key) => {
      sort = key;
      try {
        localStorage.setItem(SORT_KEY, key);
      } catch (e) {}
      render();
    };
    const menuHeading = (menu, text) => {
      const h = el("li", "ppui-menu-heading", text);
      h.setAttribute("role", "presentation");
      menu.appendChild(h);
    };
    menuButton(sortButton, "Sort", (menu) => {
      menu.classList.add("ppui-day-menu", "ppui-sort-menu");
      menu.replaceChildren();
      menuHeading(menu, "Order");
      menuItem(menu, "Newest first", sort === "newest", () => setSort("newest"));
      menuItem(menu, "Oldest first", sort === "oldest", () => setSort("oldest"));
      const counts = new Map();
      for (const item of actions.visible()) if (item.time !== null && matches(item)) counts.set(item.time, (counts.get(item.time) || 0) + 1);
      menuHeading(menu, "Day");
      menuItem(menu, "Every day", dayFilter === null, () => {
        dayFilter = null;
        render();
      });
      let month = null;
      for (const t of [...counts.keys()].sort((a, b) => b - a)) {
        const d = new Date(t);
        const m = d.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
        if (m !== month) {
          month = m;
          menuHeading(menu, m);
        }
        const n = counts.get(t);
        const name = daysBack(t) === 0 ? "Today" : daysBack(t) === 1 ? "Yesterday" : fullDayLabel(t);
        menuItem(menu, [el("span", null, name), el("span", "ppui-menu-count", String(n))], dayFilter === t, () => {
          dayFilter = t;
          render();
          if (room.getBoundingClientRect().top < 0) room.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
        });
      }
    });
    const filterNote = el("div", "ppui-room-filter");

    const tools = el("div", "ppui-room-tools");
    const list = el("div", "ppui-room-list");
    list.id = "ppui-room-list";
    list.setAttribute("role", "tabpanel");
    const main = el("div", "ppui-room-main");
    // More of the older stories in "All stories", and more search results.
    let olderShown = 0;
    const SEARCH_PAGE = 40;
    let searchLimit = SEARCH_PAGE;
    const moreBox = el("div", "ppui-room-older");
    const moreButton = el("button", "ppui-room-restore-all", "Show older news");
    moreButton.type = "button";
    moreButton.addEventListener("click", () => {
      if (words.length) searchLimit += SEARCH_PAGE;
      else olderShown += OLDER_STEP;
      render();
    });
    moreBox.appendChild(moreButton);
    main.append(bar, searchNote, filterNote, tools, list, moreBox);
    room.append(head, main);

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
      const want = Math.min(900, document.documentElement.clientWidth - 24);
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

    const hay = (item) => item.hay || (item.hay = (item.title + " " + (item.searchText || item.summary || "")).toLowerCase());
    let words = [];
    const matches = (item) => !words.length || words.every((w) => hay(item).includes(w));
    const titleHit = (item) => words.every((w) => item.title.toLowerCase().includes(w));
    // "All stories" with no search or day picked shows the page's own stories, plus older ones on request.
    const browsing = () => actions.view === "all" && !query && dayFilter === null;
    const inWindow = (item) => !browsing() || actions.isPinned(item) || actions.isStarred(item) || item.rank < pageCount + olderShown;

    // Undated stories keep their place at the end; pinned ones lead in "All stories".
    function arrange(stories) {
      const dir = sort === "oldest" ? 1 : -1;
      const byTime = (a, b) => (a.time === null || b.time === null ? (a.time === null) - (b.time === null) : (a.time - b.time) * dir);
      const kept = stories.filter((item) => matches(item) && inWindow(item) && (dayFilter === null || item.time === dayFilter));
      if (words.length) {
        const sorted = kept.sort(byTime);
        return sorted.filter(titleHit).concat(sorted.filter((item) => !titleHit(item)));
      }
      if (actions.view !== "all") return kept.sort(byTime);
      return kept.filter(actions.isPinned).sort(byTime).concat(kept.filter((item) => !actions.isPinned(item)).sort(byTime));
    }

    // One story: tick box, picture or date tile, headline with one line of summary, then when, pin and star.
    // The row opens the story in the reader.
    function storyRow(item, index) {
      const starred = actions.isStarred(item);
      const pinned = actions.isPinned(item);
      const card = el("article", "ppui-room-story is-row" + (starred ? " is-starred" : "") + (pinned ? " is-pinned" : ""));
      card.id = "ppui-story-" + index;
      card.dataset.index = String(index);
      if (item.time !== null) card.dataset.day = String(item.time);
      card.tabIndex = -1;
      card.setAttribute("aria-labelledby", card.id + "-title");
      if (isUnreadNew(item)) {
        const dot = el("span", "ppui-room-new");
        dot.title = "New since your last visit";
        card.appendChild(dot);
      }
      // A picture if the story has one; otherwise the headline takes the space.
      let lead = null;
      if (item.image) {
        lead = el("span", "ppui-room-thumb");
        lead.setAttribute("aria-hidden", "true");
        const img = el("img");
        img.alt = "";
        img.loading = "lazy";
        img.addEventListener("error", () => {
          lead.remove();
          card.classList.add("no-thumb");
        });
        img.src = item.image;
        lead.appendChild(img);
      } else {
        card.classList.add("no-thumb");
      }
      const text = el("div", "ppui-room-text");
      const headline = el("h2", "ppui-room-headline");
      headline.id = card.id + "-title";
      const open = el("button", "ppui-room-open-story");
      open.type = "button";
      open.setAttribute("aria-haspopup", "dialog");
      const openText = el("span", "ppui-room-open-text");
      openText.appendChild(markMatches(item.title, query));
      open.appendChild(openText);
      headline.appendChild(open);
      text.appendChild(headline);
      if (item.summary) {
        const sum = el("p", "ppui-room-summary");
        sum.appendChild(markMatches(item.summary, query));
        text.appendChild(sum);
      }
      const side = el("div", "ppui-room-side");
      const ago = el("span", "ppui-room-ago" + (item.time !== null && daysBack(item.time) <= 0 ? " is-today" : ""), item.date.ago || "");
      side.appendChild(ago);
      const pin = storyButton("ppui-story-pin", pinned ? "Unpin" : "Pin to top", "pin", () => actions.togglePin(item));
      pin.setAttribute("aria-pressed", String(pinned));
      const star = storyButton("ppui-story-star", starred ? "Unstar" : "Star", "star", () => actions.toggleStar(item));
      star.setAttribute("aria-pressed", String(starred));
      side.append(pin, star);
      card.append(readBox(item, card), ...(lead ? [lead] : []), text, side);
      // Anywhere on the row (but the tick box, pin and star) opens the reader.
      card.addEventListener("click", (e) => {
        if (e.target.closest(".ppui-read-box, .ppui-story-action")) return;
        openStory(index);
      });
      return card;
    }

    function openStory(index) {
      openReader(shownNow, index, location.href, actions, true);
      // Back from the reader: refresh the dots and put focus back on the row.
      reader.dialog.addEventListener("close", () => {
        render();
        list.querySelector('.ppui-room-story[data-index="' + Math.min(reader.index, shownNow.length - 1) + '"]')?.focus({ preventScroll: true });
      }, { once: true });
    }

    // Tick a story once you've read it: its headline is crossed out and it moves to "Read" (with
    // Undo). It leaves "All stories" unless pinned or starred; those stay, crossed out.
    // Untick to make it unread again.
    function readBox(item, card) {
      const done = actions.isTrashed(item);
      const box = el("label", "ppui-read-box");
      const input = el("input");
      input.type = "checkbox";
      input.checked = done;
      input.setAttribute("aria-label", (done ? "Mark as unread: " : "Mark as read: ") + item.title);
      const mark = el("span", "ppui-read-mark");
      mark.setAttribute("aria-hidden", "true");
      mark.appendChild(icon("check"));
      box.append(input, mark);
      if (done) card.classList.add("is-done");
      input.addEventListener("change", () => {
        card.classList.toggle("is-done", input.checked);
        if (input.checked === done) return;
        const apply = () => (input.checked ? actions.trash(item) : actions.restore(item));
        const leaves = input.checked ? actions.view === "all" && !actions.isStarred(item) && !actions.isPinned(item) : actions.view === "trash";
        input.disabled = true;
        // Let the tick and the line through the headline finish before the row goes.
        setTimeout(() => (leaves ? leave(card, apply) : apply()), reduced() ? 0 : leaves ? 620 : 420);
      });
      return box;
    }

    // A row leaving its tab (marked read, or back from "Read") fades and folds shut first.
    function leave(card, then) {
      if (reduced()) return then();
      card.style.height = card.offsetHeight + "px";
      void card.offsetHeight;
      card.classList.add("is-leaving");
      setTimeout(then, 320);
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

    // Scroll a row to just under its sticky day heading, and light it up briefly.
    function goTo(card, instant) {
      const top = card.getBoundingClientRect().top + scrollY - 64;
      scrollTo({ top, behavior: instant || reduced() ? "auto" : "smooth" });
      card.focus({ preventScroll: true });
      card.classList.remove("is-glowing");
      void card.offsetWidth;
      card.classList.add("is-glowing");
    }

    function renderFilter() {
      sortLabel.textContent = (sort === "oldest" ? "Oldest" : "Newest") + (dayFilter === null ? "" : " · " + fullDayLabel(dayFilter));
      sortButton.setAttribute("aria-label", "Sort: " + sortLabel.textContent);
      sortButton.classList.toggle("is-on", dayFilter !== null);
      // Keep the pill that is already showing this day, so it only pops in when the day changes.
      if (filterNote.dataset.day === String(dayFilter)) return;
      filterNote.dataset.day = String(dayFilter);
      filterNote.replaceChildren();
      if (dayFilter !== null) {
        const pill = el("span", "ppui-room-filter-pill", "Showing " + fullDayLabel(dayFilter));
        const x = el("button", "ppui-room-filter-clear");
        x.type = "button";
        x.setAttribute("aria-label", "Show every day");
        x.appendChild(icon("close"));
        x.addEventListener("click", () => {
          dayFilter = null;
          render();
        });
        pill.appendChild(x);
        filterNote.appendChild(pill);
      }
    }

    function render() {
      const counts = actions.counts();
      for (const b of tabButtons) {
        const on = b.dataset.view === actions.view;
        b.setAttribute("aria-selected", String(on));
        b.tabIndex = on ? 0 : -1;
        // Counts only where there is something to count.
        b.querySelector(".ppui-room-tab-count").textContent = counts[b.dataset.view] ? String(counts[b.dataset.view]) : "";
      }
      list.setAttribute("aria-labelledby", "ppui-tab-" + actions.view);
      moveIndicator();

      tools.replaceChildren();
      if (actions.view === "trash" && counts.trash) {
        tools.appendChild(el("p", "ppui-room-tools-text", "Stories you've ticked. Untick one to put it back."));
        const all = el("button", "ppui-room-restore-all", "Put all back");
        all.type = "button";
        all.prepend(icon("rotateCcw"));
        all.addEventListener("click", () => actions.restoreAll());
        tools.appendChild(all);
      }

      const inTab = actions.visible();
      renderFilter();
      const found = arrange(inTab);
      const shown = words.length ? found.slice(0, searchLimit) : found;
      shownNow = shown;
      const total = items.length;
      search.placeholder = archive.done ? "Search all " + total + " stories" : "Search news";
      searchNote.textContent = "";
      moreButton.textContent = words.length ? "Show more results (" + (found.length - shown.length) + ")" : "Show older news";
      moreBox.hidden = words.length ? found.length <= shown.length : !browsing() || !inTab.some((item) => !inWindow(item));
      if (words.length) searchNote.textContent = (found.length === 1 ? "1 story" : found.length + " stories") + (archive.done ? "" : " so far, still loading older ones");
      if (!shown.length) {
        let empty;
        if (inTab.length && query) {
          empty = emptyState("No stories match “" + search.value.trim() + "”.", "div");
          const clear = el("button", "ppui-room-restore-all", "Clear search");
          clear.type = "button";
          clear.addEventListener("click", () => {
            search.value = "";
            query = "";
            words = [];
            render();
            search.focus();
          });
          empty.appendChild(clear);
        } else {
          empty = emptyState(actions.emptyText, "div");
        }
        list.replaceChildren(empty);
        return;
      }

      // Sections down the timeline: Pinned first (in "All stories"), then one per day or period.
      // In newest-first order on All stories, a "Since you last left" line heads the stories that are
      // new since your last visit. Starred and Trash don't get one.
      const frag = document.createDocumentFragment();
      let section = null;
      let sectionKey = null;
      const anyNew = sort === "newest" && actions.view === "all" && shown.some(isNew);
      let markedNew = false;
      shown.forEach((item, i) => {
        const pinnedTop = actions.view === "all" && !words.length && actions.isPinned(item);
        const s = pinnedTop ? { key: "pinned", name: "Pinned" } : newsSection(item.time);
        if (s.key !== sectionKey) {
          sectionKey = s.key;
          section = el("section", "ppui-room-section" + (s.today ? " is-today" : "") + (s.key === "pinned" ? " is-pinned" : ""));
          const count = shown.filter((x) => (actions.view === "all" && !words.length && actions.isPinned(x) ? "pinned" : newsSection(x.time).key) === s.key).length;
          const h = el("h2", "ppui-room-section-head");
          h.append(el("span", "ppui-room-section-name", s.name));
          if (s.sub) h.append(el("span", "ppui-room-section-date", s.sub));
          h.append(el("span", "ppui-room-section-count", count === 1 ? "1 story" : count + " stories"));
          section.appendChild(h);
          frag.appendChild(section);
        }
        if (anyNew && !pinnedTop && isNew(item) && !markedNew) {
          markedNew = true;
          section.appendChild(el("div", "ppui-room-newline", "Since you last left"));
        }
        section.appendChild(storyRow(item, i));
      });
      list.replaceChildren(frag);
    }

    // The stories on screen now, in order, for the reader's previous / next.
    let shownNow = [];

    // "/" jumps to search; Enter on a focused row opens it.
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || !room.isConnected) return;
      if (e.target.closest && e.target.closest("input, textarea, select, [contenteditable], dialog, [popover]")) return;
      if (reader.dialog && reader.dialog.open) return;
      if (e.key === "/") {
        e.preventDefault();
        search.focus();
      } else if (e.key === "Enter" && document.activeElement.matches(".ppui-room-story")) {
        e.preventDefault();
        openStory(Number(document.activeElement.dataset.index));
      }
    });

    // The rest of the stories, from the cache at once and then fresh from the portal.
    const archive = { done: false };
    const listPk = articles[0].closest("[data-component-pk]")?.dataset.componentPk;
    const addOlder = (raw) => {
      const have = new Map(items.map((item) => [storyKey(item), item]));
      for (const a of raw) {
        const item = archiveItem(a);
        if (!item) continue;
        const known = have.get(storyKey(item));
        if (known) {
          // One of the page's own stories: borrow the text it was missing.
          if (!known.summary && item.summary) known.summary = item.summary;
          if (!known.searchText) known.searchText = item.searchText;
          continue;
        }
        have.set(storyKey(item), item);
        item.rank = items.length;
        item.older = true;
        items.push(item);
      }
    };
    if (listPk) {
      const saved = readJson(NEWS_ARCHIVE_KEY, null);
      if (saved && saved.pk === listPk && Array.isArray(saved.list)) addOlder(saved.list);
      loadArchive(listPk).then((list) => {
        writeJson(NEWS_ARCHIVE_KEY, { pk: listPk, list });
        // Fresh list: drop what the cache added and add it again, so removed stories go.
        items.splice(pageCount);
        addOlder(list);
        archive.done = true;
        render();
      }).catch((e) => {
        console.warn("[Pinehurst Dashboard] Couldn't load older news.", e);
        archive.done = items.length > pageCount;
        render();
      });
    }

    addEventListener("resize", moveIndicator);
    render();
    // Fonts arriving can shift the tab widths.
    if (document.fonts) document.fonts.ready.then(moveIndicator);
    // From the home card's "See all": #day=<midnight> scrolls to that day.
    const m = /day=(\d+)/.exec(location.hash);
    if (m) {
      const card = list.querySelector('.ppui-room-story[data-day="' + m[1] + '"]') ||
        [...list.querySelectorAll(".ppui-room-story[data-day]")].find((c) => Number(c.dataset.day) <= Number(m[1]));
      // Wait for the header and fonts to settle first, or the jump lands short.
      if (card) setTimeout(() => goTo(card, true), 450);
    }
  }

  // The News page gets its own view (tabs, full-text cards, a timeline). It is recognised by its
  // stories rather than its address, which varies. Articles hydrate late: wait for the first, give
  // the rest a moment, then build. If anything fails the portal's list comes back and the error is logged.
  // ---- Dates as "YYYY-MM-DD" (local days) ----

  function isoOf(date) {
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  }

  function dayFromIso(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function isoAfter(days, from) {
    const d = from ? dayFromIso(from) : new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + days);
    return isoOf(d);
  }

  // "Today", "Tomorrow", "Yesterday", "Fri 31 Oct".
  function dayLabel(iso) {
    if (iso === isoAfter(0)) return "Today";
    if (iso === isoAfter(1)) return "Tomorrow";
    if (iso === isoAfter(-1)) return "Yesterday";
    return dayFromIso(iso).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
  }

  // ---- Notes and reminders: saved in the student's Chrome account (chrome.storage.sync), one key per
  // note so each stays under the per-item limit. Where that isn't available, this browser keeps them. ----

  const NOTE_PREFIX = "note:";
  const NOTE_MAX = 1000;
  const NOTES_LOCAL_KEY = "ppui-notes";
  const syncArea = typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync ? chrome.storage.sync : null;
  const noteStore = { list: [], ready: null, subscribers: new Set() };

  const validNote = (n) => n && typeof n.id === "string" && typeof n.text === "string";

  function readNotes() {
    if (syncArea) {
      return new Promise((resolve) => syncArea.get(null, (all) => {
        resolve(Object.keys(all || {}).filter((k) => k.startsWith(NOTE_PREFIX)).map((k) => all[k]).filter(validNote));
      }));
    }
    try {
      return Promise.resolve(Object.values(JSON.parse(localStorage.getItem(NOTES_LOCAL_KEY) || "{}")).filter(validNote));
    } catch (e) {
      return Promise.resolve([]);
    }
  }

  function writeLocalNotes() {
    try {
      localStorage.setItem(NOTES_LOCAL_KEY, JSON.stringify(Object.fromEntries(noteStore.list.map((n) => [n.id, n]))));
    } catch (e) {}
  }

  function notifyNotes() {
    noteStore.subscribers.forEach((fn) => fn(noteStore.list));
  }

  // Notes saved from another tab (or another computer) arrive here too.
  function loadNotes() {
    if (noteStore.ready) return noteStore.ready;
    const reload = () => readNotes().then((list) => {
      noteStore.list = list;
      notifyNotes();
    });
    noteStore.ready = reload();
    if (syncArea && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "sync" && Object.keys(changes).some((k) => k.startsWith(NOTE_PREFIX))) reload();
      });
    } else {
      addEventListener("storage", (e) => {
        if (e.key === NOTES_LOCAL_KEY) reload();
      });
    }
    return noteStore.ready;
  }

  // Run fn now (once the notes have loaded) and after every change.
  function onNotes(fn) {
    noteStore.subscribers.add(fn);
    loadNotes().then(() => fn(noteStore.list));
  }

  function saveNote(note) {
    note.text = note.text.slice(0, NOTE_MAX);
    const i = noteStore.list.findIndex((n) => n.id === note.id);
    if (i >= 0) noteStore.list[i] = note;
    else noteStore.list.push(note);
    notifyNotes();
    if (syncArea) syncArea.set({ [NOTE_PREFIX + note.id]: note });
    else writeLocalNotes();
  }

  function removeNote(id) {
    const gone = noteStore.list.find((n) => n.id === id);
    noteStore.list = noteStore.list.filter((n) => n.id !== id);
    notifyNotes();
    if (syncArea) syncArea.remove(NOTE_PREFIX + id);
    else writeLocalNotes();
    if (gone) toast("Note deleted", "Undo", () => saveNote(gone));
  }

  function newNote(fields) {
    return Object.assign({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text: "",
      date: null,
      subject: null,
      tone: null,
      done: false,
      created: Date.now(),
      remindedOn: null,
    }, fields);
  }

  // A note's colour: the one picked, else its subject's, else the theme colour.
  const noteTone = (note) => (note.tone !== null && note.tone !== undefined ? note.tone : note.subject ? toneFor(note.subject) : 0);
  const openNotes = () => noteStore.list.filter((n) => !n.done);
  const dueSoon = () => openNotes().filter((n) => n.date && n.date <= isoAfter(1));

  // A steady tone per class (one of six shades mixed from the theme colour), so a class keeps its colour.
  function toneFor(name) {
    let h = 2166136261;
    for (const c of name) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return (h >>> 0) % 6;
  }

  // ---- Things the home page knows, kept for every page: classes, school events, today's timetable ----

  const CLASSES_KEY = "ppui-classes";
  const EVENTS_KEY = "ppui-events";
  const TODAY_KEY = "ppui-today";

  function readJson(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || "null");
      return v === null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }

  const cachedClasses = () => readJson(CLASSES_KEY, []).filter((c) => c && typeof c.name === "string");
  const cachedEvents = () => readJson(EVENTS_KEY, []).filter((e) => e && typeof e.date === "string" && typeof e.title === "string");

  // The home page's events list, read defensively: each day has a header with its date and then
  // its events. Earlier days are kept a month, so the calendar can look back.
  function harvestEvents(comp) {
    const out = [];
    const year = new Date().getFullYear();
    for (const day of comp.querySelectorAll(SEL.eventsDay)) {
      const head = day.querySelector(SEL.eventsDayHeader);
      const headText = clean(head && head.textContent);
      let date = null;
      if (/\btoday\b/i.test(headText)) date = isoAfter(0);
      else if (/\btomorrow\b/i.test(headText)) date = isoAfter(1);
      else {
        const plain = headText.replace(/\b(today|tomorrow)\b/gi, "").replace(/(\d+)(st|nd|rd|th)\b/gi, "$1");
        const parsed = new Date(/\d{4}/.test(plain) ? plain : plain + " " + year);
        if (!isNaN(parsed)) date = isoOf(parsed);
      }
      if (!date) continue;
      let items = [...day.querySelectorAll(".event, li, .vx-list__item")].filter((n) => !n.contains(head) && !head?.contains(n));
      if (!items.length) items = [...day.children].filter((n) => n !== head && !n.contains(head));
      for (const item of items) {
        const text = clean(item.textContent);
        if (!text) continue;
        const time = (text.match(/\b\d{1,2}(:\d{2})?\s*[ap]\.?m\.?\b/i) || [])[0] || "";
        const titleNode = item.querySelector(".event-title, .title, strong, a");
        const title = clean(titleNode ? titleNode.textContent : text.replace(time, "")).slice(0, 140);
        if (title) out.push({ date, title, time });
      }
    }
    if (!out.length) return;
    const from = isoAfter(-30);
    const fresh = new Set(out.map((e) => e.date));
    writeJson(EVENTS_KEY, cachedEvents().filter((e) => e.date >= from && !fresh.has(e.date)).concat(out));
  }

  // ---- Small menu helper: a button that opens a popover menu, filled fresh each time ----

  function menuButton(btn, label, fill) {
    const menu = el("ul", "ppui-menu ppui-choice-menu");
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", label);
    arrowNav(menu, ".ppui-menu-item, input");
    popover(btn, menu, () => fill(menu));
    menu.addEventListener("toggle", (e) => {
      if (e.newState === "open") (menu.querySelector("[aria-checked='true']") || menu.querySelector("button, input")).focus();
    });
    return menu;
  }

  function menuItem(menu, label, checked, pick, extraClass) {
    const li = el("li");
    const b = el("button", "ppui-menu-item" + (extraClass ? " " + extraClass : ""));
    b.type = "button";
    if (checked !== null) {
      b.setAttribute("role", "menuitemradio");
      b.setAttribute("aria-checked", String(checked));
    } else {
      b.setAttribute("role", "menuitem");
    }
    if (typeof label === "string") b.textContent = label;
    else b.append(...label);
    b.addEventListener("click", () => {
      menu.hidePopover();
      pick();
    });
    li.appendChild(b);
    menu.appendChild(li);
  }

  // The date choices shared by the notebook and the note rows: none, today, tomorrow, next week, or a day.
  function fillDateMenu(menu, current, pick) {
    menu.replaceChildren();
    for (const [label, value] of [["No date", null], ["Today", isoAfter(0)], ["Tomorrow", isoAfter(1)], ["Next week", isoAfter(7)]]) {
      menuItem(menu, label, current === value, () => pick(value));
    }
    const li = el("li", "ppui-menu-sep ppui-choice-day");
    const field = el("label", null, "Pick a day");
    const input = el("input");
    input.type = "date";
    if (current) input.value = current;
    input.addEventListener("change", () => {
      if (!input.value) return;
      menu.hidePopover();
      pick(input.value);
    });
    field.appendChild(input);
    li.appendChild(field);
    menu.appendChild(li);
  }

  function fillSubjectMenu(menu, current, pick) {
    menu.replaceChildren();
    menuItem(menu, "No subject", !current, () => pick(null));
    const classes = cachedClasses();
    for (const c of classes) {
      const swatch = el("span", "ppui-swatch");
      swatch.dataset.tone = String(toneFor(c.name));
      menuItem(menu, [swatch, el("span", null, c.name)], current === c.name, () => pick(c.name));
    }
    if (!classes.length) menu.appendChild(el("li", "ppui-menu-note", "Open the portal home page once to load your classes."));
  }

  // Named by how they sit against the theme colour, since every tone is mixed from it (see styles.css).
  const TONE_NAMES = ["Theme", "Bright", "Deep", "Grey", "Pale", "Slate"];

  function fillToneMenu(menu, current, pick) {
    menu.replaceChildren();
    menuItem(menu, "Automatic", current === null, () => pick(null));
    TONE_NAMES.forEach((name, tone) => {
      const swatch = el("span", "ppui-swatch");
      swatch.dataset.tone = String(tone);
      menuItem(menu, [swatch, el("span", null, name)], current === tone, () => pick(tone));
    });
  }

  function chipButton(className, iconName, text) {
    const b = el("button", "ppui-chip " + className);
    b.type = "button";
    const label = el("span", "ppui-chip-label", text);
    b.append(icon(iconName), label);
    return b;
  }

  // One note as a row: tick it off, click the words to edit, change its date / subject / colour, delete.
  function noteRow(note, options) {
    const row = el("li", "ppui-note" + (note.done ? " is-done" : "") + (note.date && note.date < isoAfter(0) && !note.done ? " is-overdue" : ""));
    row.dataset.tone = String(noteTone(note));
    const tick = el("input", "ppui-note-tick");
    tick.type = "checkbox";
    tick.checked = note.done;
    tick.setAttribute("aria-label", (note.done ? "Mark not done: " : "Mark done: ") + note.text);
    tick.addEventListener("change", () => saveNote(Object.assign({}, note, { done: tick.checked })));

    const text = el("button", "ppui-note-text", note.text);
    text.type = "button";
    text.title = "Edit";
    text.addEventListener("click", () => {
      const input = el("input", "ppui-note-edit");
      input.value = note.text;
      input.maxLength = NOTE_MAX;
      input.setAttribute("aria-label", "Edit note");
      let done = false;
      const finish = (keep) => {
        if (done) return;
        done = true;
        const value = input.value.trim();
        if (keep && value && value !== note.text) saveNote(Object.assign({}, note, { text: value }));
        else input.replaceWith(text);
      };
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") finish(true);
        if (e.key === "Escape") {
          e.stopPropagation();
          e.preventDefault();
          finish(false);
        }
      });
      input.addEventListener("blur", () => finish(true));
      text.replaceWith(input);
      input.focus();
      input.select();
    });

    const chips = el("span", "ppui-note-chips");
    if (!options || !options.compact) {
      const date = chipButton("ppui-chip-date", "calendar", note.date ? dayLabel(note.date) : "No date");
      menuButton(date, "Due", (menu) => fillDateMenu(menu, note.date, (value) => saveNote(Object.assign({}, note, { date: value }))));
      const subject = chipButton("ppui-chip-subject", "bookOpen", note.subject || "No subject");
      subject.classList.toggle("is-empty", !note.subject);
      menuButton(subject, "Subject", (menu) => fillSubjectMenu(menu, note.subject, (value) => saveNote(Object.assign({}, note, { subject: value }))));
      chips.append(date, subject);
    } else if (note.subject) {
      chips.appendChild(el("span", "ppui-chip is-static", note.subject));
    }
    const remove = storyButton("ppui-note-delete", "Delete note", "trash", () => removeNote(note.id));
    row.append(tick, text, chips, remove);
    return row;
  }

  // ---- Notebook: a lined page that slides in from the right ----

  const notebook = { dialog: null, filter: null, draft: { date: null, subject: null, tone: null } };

  function buildNotebook() {
    const dialog = el("dialog", "ppui-notebook");
    dialog.setAttribute("aria-labelledby", "ppui-notebook-title");
    const head = el("header", "ppui-notebook-head");
    const title = el("h2", "ppui-notebook-title", "Notebook");
    title.id = "ppui-notebook-title";
    const filterChip = el("button", "ppui-chip ppui-notebook-filter");
    filterChip.type = "button";
    filterChip.hidden = true;
    filterChip.addEventListener("click", () => {
      notebook.filter = null;
      renderNotebook();
    });
    head.append(title, filterChip, readerButton("ppui-notebook-close", "Close", "close", () => closePanel(dialog)));

    // Writing a note: one line, then optional date / subject / colour. Enter (or Add) saves.
    const form = el("form", "ppui-notebook-form");
    const input = el("input", "ppui-notebook-input");
    input.placeholder = "Write a note or reminder…";
    input.maxLength = NOTE_MAX;
    input.setAttribute("aria-label", "New note");
    const add = el("button", "ppui-notebook-add");
    add.type = "submit";
    add.append(icon("plus"), el("span", null, "Add"));
    const row = el("div", "ppui-notebook-row");
    row.append(input, add);
    const chips = el("div", "ppui-notebook-chips");
    const dateChip = chipButton("ppui-chip-date", "calendar", "No date");
    const subjectChip = chipButton("ppui-chip-subject", "bookOpen", "No subject");
    const toneChip = chipButton("ppui-chip-tone", "palette", "Colour");
    menuButton(dateChip, "Due", (menu) => fillDateMenu(menu, notebook.draft.date, (v) => {
      notebook.draft.date = v;
      renderDraft();
    }));
    menuButton(subjectChip, "Subject", (menu) => fillSubjectMenu(menu, notebook.draft.subject, (v) => {
      notebook.draft.subject = v;
      renderDraft();
    }));
    menuButton(toneChip, "Colour", (menu) => fillToneMenu(menu, notebook.draft.tone, (v) => {
      notebook.draft.tone = v;
      renderDraft();
    }));
    chips.append(dateChip, subjectChip, toneChip);
    form.append(row, chips);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return input.focus();
      saveNote(newNote(Object.assign({ text }, notebook.draft)));
      input.value = "";
      input.focus();
    });

    const page = el("div", "ppui-notebook-page");
    dialog.append(head, form, page);
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      closePanel(dialog);
    });
    dialog.addEventListener("click", (e) => {
      if (e.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closePanel(dialog);
    });
    document.body.appendChild(dialog);
    onNotes(() => {
      if (dialog.open) renderNotebook();
    });
    return dialog;
  }

  function renderDraft() {
    const d = notebook.dialog;
    const { date, subject, tone } = notebook.draft;
    d.querySelector(".ppui-notebook-chips .ppui-chip-date .ppui-chip-label").textContent = date ? dayLabel(date) : "No date";
    d.querySelector(".ppui-notebook-chips .ppui-chip-subject .ppui-chip-label").textContent = subject || "No subject";
    d.querySelector(".ppui-notebook-chips .ppui-chip-subject").classList.toggle("is-empty", !subject);
    const toneChip = d.querySelector(".ppui-notebook-chips .ppui-chip-tone");
    toneChip.querySelector(".ppui-chip-label").textContent = tone === null ? "Colour" : TONE_NAMES[tone];
    toneChip.dataset.tone = String(tone === null ? (subject ? toneFor(subject) : 0) : tone);
    d.querySelector(".ppui-notebook-chips .ppui-chip-date").classList.toggle("is-set", !!date);
  }

  // Overdue, Today, Upcoming, No date, Done; optionally one subject only.
  function renderNotebook() {
    const d = notebook.dialog;
    const page = d.querySelector(".ppui-notebook-page");
    const chip = d.querySelector(".ppui-notebook-filter");
    chip.hidden = !notebook.filter;
    if (notebook.filter) {
      chip.replaceChildren(el("span", null, notebook.filter), icon("close"));
      chip.setAttribute("aria-label", "Show all subjects (now showing " + notebook.filter + ")");
    }
    const today = isoAfter(0);
    const notes = noteStore.list.filter((n) => !notebook.filter || n.subject === notebook.filter);
    const byDate = (a, b) => (a.date || "").localeCompare(b.date || "") || a.created - b.created;
    const groups = [
      ["Overdue", notes.filter((n) => !n.done && n.date && n.date < today).sort(byDate)],
      ["Today", notes.filter((n) => !n.done && n.date === today).sort(byDate)],
      ["Upcoming", notes.filter((n) => !n.done && n.date && n.date > today).sort(byDate)],
      ["No date", notes.filter((n) => !n.done && !n.date).sort((a, b) => b.created - a.created)],
      ["Done", notes.filter((n) => n.done).sort((a, b) => b.created - a.created)],
    ];
    page.replaceChildren();
    for (const [name, list] of groups) {
      if (!list.length) continue;
      const section = el("section", "ppui-notebook-group" + (name === "Overdue" ? " is-overdue" : "") + (name === "Done" ? " is-done" : ""));
      section.appendChild(el("h3", "ppui-notebook-group-title", name));
      const ul = el("ul", "ppui-notes");
      list.forEach((n) => ul.appendChild(noteRow(n)));
      section.appendChild(ul);
      page.appendChild(section);
    }
    if (!page.children.length) {
      page.appendChild(emptyState(notebook.filter ? "No notes for " + notebook.filter + " yet." : "Nothing written down yet. Add a note above.", "div"));
    }
  }

  // Open the notebook, optionally starting a note for a day or a subject, or showing one subject.
  function openNotebook(options) {
    if (!notebook.dialog) notebook.dialog = buildNotebook();
    const o = options || {};
    notebook.filter = o.filter || null;
    notebook.draft = { date: o.date || null, subject: o.subject || o.filter || null, tone: null };
    loadNotes().then(() => {
      renderDraft();
      renderNotebook();
    });
    const d = notebook.dialog;
    d.classList.remove("is-closing");
    if (!d.open) d.showModal();
    root.classList.add("ppui-reading");
    d.querySelector(".ppui-notebook-input").focus();
  }

  // Slide-out close shared by the notebook (the reader has its own).
  function closePanel(dialog) {
    if (!dialog.open || dialog.classList.contains("is-closing")) return;
    const finish = () => {
      dialog.classList.remove("is-closing");
      dialog.close();
      if (!document.querySelector("dialog[open]")) root.classList.remove("ppui-reading");
    };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return finish();
    dialog.classList.add("is-closing");
    const done = (e) => {
      if (e && e.target !== dialog) return;
      dialog.removeEventListener("animationend", done);
      if (dialog.classList.contains("is-closing")) finish();
    };
    dialog.addEventListener("animationend", done);
    setTimeout(done, 450);
  }

  // ---- Calendar: day cards on a curved wall, panned sideways in 3D ----

  const CAL_BACK = 30;
  const CAL_AHEAD = 120;
  const CAL_WINDOW = 7;
  const cal = {
    dialog: null,
    pill: null,
    from: null,
    start: null,
    pos: CAL_BACK,
    target: CAL_BACK,
    raf: 0,
    cards: new Map(),
    step: 300,
  };

  const calDays = CAL_BACK + CAL_AHEAD + 1;
  const calIso = (i) => isoAfter(i - CAL_BACK, cal.start);
  const flatWall = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  function dayCard(i) {
    const iso = calIso(i);
    const date = dayFromIso(iso);
    const today = isoAfter(0);
    const card = el("article", "ppui-day" + (iso === today ? " is-today" : "") + (iso < today ? " is-past" : "") +
      (date.getDay() === 0 || date.getDay() === 6 ? " is-weekend" : ""));
    card.dataset.index = String(i);
    card.setAttribute("aria-label", date.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" }));

    const top = el("header", "ppui-day-top");
    top.append(el("span", "ppui-day-weekday", date.toLocaleDateString("en-AU", { weekday: "long" })));
    const rel = iso === today ? "Today" : iso === isoAfter(1) ? "Tomorrow" : iso === isoAfter(-1) ? "Yesterday" : "";
    if (rel) top.appendChild(el("span", "ppui-day-rel", rel));
    card.append(top, el("div", "ppui-day-num", String(date.getDate())),
      el("div", "ppui-day-month", date.toLocaleDateString("en-AU", { month: "long" })));

    let empty = true;
    const events = cachedEvents().filter((e) => e.date === iso);
    if (events.length) {
      empty = false;
      const s = el("section", "ppui-day-section");
      s.appendChild(el("h4", "ppui-day-label", "School"));
      const ul = el("ul", "ppui-day-events");
      for (const e of events) {
        const li = el("li");
        if (e.time) li.appendChild(el("span", "ppui-day-time", e.time));
        li.appendChild(el("span", null, e.title));
        ul.appendChild(li);
      }
      s.appendChild(ul);
      card.appendChild(s);
    }

    const timetable = readJson(TODAY_KEY, null);
    if (iso === today && timetable && timetable.date === today && timetable.items && timetable.items.length) {
      empty = false;
      const s = el("section", "ppui-day-section");
      s.appendChild(el("h4", "ppui-day-label", "Timetable"));
      const ul = el("ul", "ppui-day-events");
      for (const item of timetable.items) {
        const li = el("li");
        li.append(el("span", "ppui-day-time", item.time), el("span", null, item.title));
        ul.appendChild(li);
      }
      s.appendChild(ul);
      card.appendChild(s);
    }

    const notes = noteStore.list.filter((n) => n.date === iso).sort((a, b) => a.done - b.done || a.created - b.created);
    if (notes.length) {
      empty = false;
      const s = el("section", "ppui-day-section");
      s.appendChild(el("h4", "ppui-day-label", "Notes"));
      const ul = el("ul", "ppui-notes is-compact");
      notes.forEach((n) => ul.appendChild(noteRow(n, { compact: true })));
      s.appendChild(ul);
      card.appendChild(s);
    }
    if (empty) card.appendChild(el("p", "ppui-day-free", "Free day"));

    const add = el("button", "ppui-day-add");
    add.type = "button";
    add.append(icon("plus"), el("span", null, "Add note"));
    add.addEventListener("click", () => openNotebook({ date: iso }));
    card.appendChild(add);

    // A card off to the side comes to the middle when clicked.
    card.addEventListener("click", (e) => {
      if (Math.round(cal.pos) !== i && !e.target.closest("button, input, a")) goToDay(i);
    });
    return card;
  }

  // Place each card for the current position: across, back into depth, and turned, so the
  // row of days bends away like a curved wall. Only cards near the middle exist at all.
  function layoutWall() {
    const stage = cal.dialog.querySelector(".ppui-wall");
    const flat = flatWall();
    const from = Math.max(0, Math.floor(cal.pos) - CAL_WINDOW);
    const to = Math.min(calDays - 1, Math.ceil(cal.pos) + CAL_WINDOW);
    for (const [i, card] of cal.cards) {
      if (i < from || i > to) {
        card.remove();
        cal.cards.delete(i);
      }
    }
    for (let i = from; i <= to; i++) {
      let card = cal.cards.get(i);
      if (!card) {
        card = dayCard(i);
        cal.cards.set(i, card);
        stage.appendChild(card);
      }
      const d = i - cal.pos;
      const a = Math.abs(d);
      const z = flat ? 0 : -Math.pow(a, 1.25) * 70;
      const turn = flat ? 0 : Math.max(-60, Math.min(60, -d * 14));
      card.style.transform = "translateX(" + (d * cal.step).toFixed(1) + "px) translateZ(" + z.toFixed(1) + "px) rotateY(" + turn.toFixed(2) + "deg)";
      card.style.opacity = String(Math.max(0, Math.min(1, 1.15 - a / 5)));
      card.style.zIndex = String(100 - Math.round(a * 10));
      card.classList.toggle("is-centre", a < 0.5);
      card.inert = a > 3.2;
    }
    // Month strip marker and the heading follow the day in the middle.
    if (cal.view === "month") return;
    const iso = calIso(Math.round(cal.pos));
    const month = iso.slice(0, 7);
    cal.dialog.querySelectorAll(".ppui-cal-month").forEach((b) => b.classList.toggle("is-current", b.dataset.month === month));
    cal.dialog.querySelector(".ppui-cal-heading").textContent =
      dayFromIso(iso).toLocaleDateString("en-AU", { month: "long", year: "numeric" });
  }

  // Ease towards the target by time, not by frame, so it moves at the same pace on any screen.
  function animateWall() {
    if (cal.raf) return;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(64, now - last);
      last = now;
      const diff = cal.target - cal.pos;
      if (Math.abs(diff) < 0.002 || flatWall()) {
        cal.pos = cal.target;
        cal.raf = 0;
        layoutWall();
        return;
      }
      cal.pos += diff * (1 - Math.exp(-dt / 110));
      layoutWall();
      cal.raf = requestAnimationFrame(tick);
    };
    cal.raf = requestAnimationFrame(tick);
  }

  function goToDay(i) {
    cal.target = Math.max(0, Math.min(calDays - 1, i));
    animateWall();
  }

  // Sideways scroll (trackpad, or Shift + wheel) and dragging pan the wall; it settles on a day.
  function wireWall(stage) {
    let settle = 0;
    stage.addEventListener("wheel", (e) => {
      const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
      if (!dx) return;
      e.preventDefault();
      cal.target = Math.max(0, Math.min(calDays - 1, cal.target + dx / cal.step));
      animateWall();
      clearTimeout(settle);
      settle = setTimeout(() => goToDay(Math.round(cal.target)), 140);
    }, { passive: false });

    let drag = null;
    let draggedAt = 0;
    stage.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest("button, input, a, .ppui-note")) return;
      drag = { x: e.clientX, target: cal.target, t: e.timeStamp, last: e.clientX, v: 0, moved: false };
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 4) drag.moved = true;
      const dt = Math.max(1, e.timeStamp - drag.t);
      drag.v = (e.clientX - drag.last) / dt;
      drag.last = e.clientX;
      drag.t = e.timeStamp;
      cal.target = Math.max(0, Math.min(calDays - 1, drag.target - dx / cal.step));
      cal.pos = cal.target;
      layoutWall();
    });
    const end = () => {
      if (!drag) return;
      // A flick carries on a few days; then it settles on the nearest one.
      goToDay(Math.round(cal.target - (drag.v * 160) / cal.step));
      draggedAt = drag.moved ? performance.now() : 0;
      drag = null;
    };
    stage.addEventListener("pointerup", end);
    stage.addEventListener("pointercancel", end);
    // A drag shouldn't count as a click on the card it ended over (the click comes right after).
    stage.addEventListener("click", (e) => {
      if (performance.now() - draggedAt < 80) e.stopPropagation();
      draggedAt = 0;
    }, true);
  }

  function buildCalendar() {
    const dialog = el("dialog", "ppui-cal");
    dialog.setAttribute("aria-label", "Calendar");
    const bar = el("header", "ppui-cal-bar");
    const heading = el("h2", "ppui-cal-heading");
    const nav = el("div", "ppui-cal-nav");
    const todayBtn = el("button", "ppui-cal-today", "Today");
    todayBtn.type = "button";
    todayBtn.addEventListener("click", () => {
      if (cal.view === "month") showMonth(isoAfter(0).slice(0, 7));
      else goToDay(CAL_BACK);
    });
    const step = (dir) => () => {
      if (cal.view === "month") shiftMonth(dir);
      else goToDay(Math.round(cal.target) + dir);
    };
    nav.append(
      readerButton("ppui-cal-step ppui-cal-prev", "Previous day", "chevronLeft", step(-1)),
      todayBtn,
      readerButton("ppui-cal-step ppui-cal-next", "Next day", "chevronRight", step(1)),
    );

    // Days (the 3D wall) or Month (a grid, the usual calendar layout).
    const views = el("div", "ppui-cal-views");
    views.setAttribute("role", "group");
    views.setAttribute("aria-label", "View");
    for (const [view, label, iconName] of [["days", "Days", "calendarClock"], ["month", "Month", "calendar"]]) {
      const b = el("button", "ppui-cal-view");
      b.type = "button";
      b.dataset.view = view;
      b.append(icon(iconName), el("span", null, label));
      b.addEventListener("click", () => setCalView(view));
      views.appendChild(b);
    }
    const notebookBtn = el("button", "ppui-cal-notebook");
    notebookBtn.type = "button";
    notebookBtn.append(icon("notebook"), el("span", null, "Notebook"));
    notebookBtn.addEventListener("click", () => openNotebook());
    const tools = el("div", "ppui-cal-tools");
    tools.append(notebookBtn,
      readerButton("ppui-cal-min", "Minimise", "minimise", minimiseCalendar),
      readerButton("ppui-cal-close", "Close", "close", () => closeCalendar()));
    bar.append(heading, nav, views, tools);

    // Months across the range; click one to fly to its first day.
    const months = el("nav", "ppui-cal-months");
    months.setAttribute("aria-label", "Months");
    for (let i = 0; i < calDays; i++) {
      const iso = calIso(i);
      if (i !== 0 && !iso.endsWith("-01")) continue;
      const b = el("button", "ppui-cal-month", dayFromIso(iso).toLocaleDateString("en-AU", { month: "short" }));
      b.type = "button";
      b.dataset.month = iso.slice(0, 7);
      b.addEventListener("click", () => {
        if (cal.view === "month") showMonth(b.dataset.month);
        else goToDay(i);
      });
      months.appendChild(b);
    }

    const stage = el("div", "ppui-wall");
    stage.setAttribute("aria-label", "Days. Scroll sideways or drag to move through them.");
    wireWall(stage);
    const month = el("div", "ppui-month");
    dialog.append(bar, months, stage, month, el("p", "ppui-cal-hint", "Scroll sideways or drag to move through the days"));

    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      closeCalendar();
    });
    document.body.appendChild(dialog);
    addEventListener("resize", () => {
      if (dialog.open) measureWall();
    });
    onNotes(() => {
      if (!dialog.open) return;
      cal.cards.forEach((card) => card.remove());
      cal.cards.clear();
      layoutWall();
      if (cal.view === "month") renderMonth();
    });
    return dialog;
  }

  function measureWall() {
    const probe = cal.dialog.querySelector(".ppui-day");
    cal.step = (probe ? probe.offsetWidth : 280) + 22;
    layoutWall();
  }

  // ---- Month view: the usual calendar grid, weeks starting on Monday, on a sheet of paper ----

  const CAL_VIEW_KEY = "ppui-cal-view";
  const MONTH_ITEMS = 3;
  cal.view = readJson(CAL_VIEW_KEY, "days") === "month" ? "month" : "days";
  cal.month = isoAfter(0).slice(0, 7);

  // The wall's card number for a day.
  const calIndex = (iso) => Math.round((dayFromIso(iso) - dayFromIso(cal.start)) / 864e5) + CAL_BACK;

  function setCalView(view) {
    if (view === cal.view) return;
    cal.view = view;
    writeJson(CAL_VIEW_KEY, view);
    // Switching to Month shows the month of the day in the middle of the wall.
    if (view === "month") cal.month = calIso(Math.round(cal.target)).slice(0, 7);
    applyCalView(true);
  }

  function applyCalView(animate) {
    const d = cal.dialog;
    d.dataset.view = cal.view;
    d.querySelectorAll(".ppui-cal-view").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === cal.view)));
    const month = cal.view === "month";
    d.querySelector(".ppui-wall").hidden = month;
    d.querySelector(".ppui-month").hidden = !month;
    d.querySelector(".ppui-cal-hint").hidden = month;
    d.querySelector(".ppui-cal-prev").setAttribute("aria-label", month ? "Previous month" : "Previous day");
    d.querySelector(".ppui-cal-next").setAttribute("aria-label", month ? "Next month" : "Next day");
    d.querySelector(".ppui-cal-prev").title = month ? "Previous month" : "Previous day";
    d.querySelector(".ppui-cal-next").title = month ? "Next month" : "Next day";
    if (month) renderMonth();
    else {
      cal.cards.forEach((card) => card.remove());
      cal.cards.clear();
      measureWall();
    }
    const pane = d.querySelector(month ? ".ppui-month" : ".ppui-wall");
    if (animate && !flatWall()) {
      pane.classList.remove("is-switching");
      void pane.offsetWidth;
      pane.classList.add("is-switching");
    }
  }

  function shiftMonth(dir) {
    const [y, m] = cal.month.split("-").map(Number);
    const next = new Date(y, m - 1 + dir, 1);
    showMonth(isoOf(next).slice(0, 7), dir);
  }

  function showMonth(month, dir) {
    if (dir === undefined) dir = month > cal.month ? 1 : month < cal.month ? -1 : 0;
    cal.month = month;
    renderMonth(dir);
  }

  // A day of the month in one cell: its number (opens the day on the wall), what's on, and a quiet "+".
  function monthCell(iso, inMonth) {
    const date = dayFromIso(iso);
    const today = isoAfter(0);
    const cell = el("div", "ppui-mday" + (inMonth ? "" : " is-other") + (iso === today ? " is-today" : "") +
      (iso < today ? " is-past" : "") + (date.getDay() === 0 || date.getDay() === 6 ? " is-weekend" : ""));
    cell.setAttribute("role", "gridcell");

    const events = cachedEvents().filter((e) => e.date === iso);
    const notes = noteStore.list.filter((n) => n.date === iso).sort((a, b) => a.done - b.done || a.created - b.created);
    const longName = date.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
    const num = el("button", "ppui-mday-num", String(date.getDate()));
    num.type = "button";
    const counts = [events.length && events.length + (events.length === 1 ? " event" : " events"),
      notes.length && notes.length + (notes.length === 1 ? " note" : " notes")].filter(Boolean).join(", ");
    num.setAttribute("aria-label", longName + (counts ? ", " + counts : "") + ". Open this day");
    num.addEventListener("click", () => openDay(iso));
    const head = el("div", "ppui-mday-head");
    head.appendChild(num);
    if (iso === today) head.appendChild(el("span", "ppui-mday-today", "Today"));
    cell.appendChild(head);

    const items = [];
    for (const e of events) {
      const li = el("li", "ppui-mday-event");
      if (e.time) li.appendChild(el("span", "ppui-mday-time", e.time.replace(/\s*([ap])\.?m\.?/i, "$1")));
      li.appendChild(el("span", "ppui-mday-title", e.title));
      li.title = (e.time ? e.time + " " : "") + e.title;
      items.push(li);
    }
    for (const n of notes) {
      const li = el("li", "ppui-mday-note" + (n.done ? " is-done" : ""));
      li.dataset.tone = String(noteTone(n));
      li.appendChild(el("span", "ppui-mday-title", n.text));
      li.title = n.text + (n.subject ? " (" + n.subject + ")" : "");
      items.push(li);
    }
    if (items.length) {
      const ul = el("ul", "ppui-mday-items");
      items.slice(0, MONTH_ITEMS).forEach((li) => ul.appendChild(li));
      if (items.length > MONTH_ITEMS) {
        const more = el("li", "ppui-mday-more");
        const b = el("button", null, "+" + (items.length - MONTH_ITEMS) + " more");
        b.type = "button";
        b.addEventListener("click", () => openDay(iso));
        more.appendChild(b);
        ul.appendChild(more);
      }
      cell.appendChild(ul);
    }

    const add = el("button", "ppui-mday-add");
    add.type = "button";
    add.setAttribute("aria-label", "Add note for " + longName);
    add.title = "Add note";
    add.appendChild(icon("plus"));
    add.addEventListener("click", () => openNotebook({ date: iso }));
    cell.appendChild(add);
    return cell;
  }

  // A day from the month opens on the wall, gliding the last couple of cards into place.
  function openDay(iso) {
    const i = Math.max(0, Math.min(calDays - 1, calIndex(iso)));
    cal.target = i;
    cal.pos = i + (i > 1 ? -1.5 : 1.5);
    cal.view = "days";
    writeJson(CAL_VIEW_KEY, "days");
    applyCalView(true);
    animateWall();
  }

  function renderMonth(dir) {
    const d = cal.dialog;
    const pane = d.querySelector(".ppui-month");
    const [y, m] = cal.month.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    // Weeks start on Monday; show whole weeks, five or six of them.
    const lead = (first.getDay() + 6) % 7;
    const start = new Date(y, m - 1, 1 - lead);
    const daysInMonth = new Date(y, m, 0).getDate();
    const weeks = Math.ceil((lead + daysInMonth) / 7);

    const sheet = el("div", "ppui-month-sheet" + (dir > 0 ? " from-next" : dir < 0 ? " from-prev" : ""));
    sheet.setAttribute("role", "grid");
    sheet.setAttribute("aria-label", first.toLocaleDateString("en-AU", { month: "long", year: "numeric" }));
    const names = el("div", "ppui-month-names");
    names.setAttribute("role", "row");
    for (const name of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
      const n = el("span", "ppui-month-name", name);
      n.setAttribute("role", "columnheader");
      names.appendChild(n);
    }
    sheet.appendChild(names);
    const grid = el("div", "ppui-month-grid");
    grid.style.setProperty("--weeks", String(weeks));
    for (let w = 0; w < weeks; w++) {
      const row = el("div", "ppui-month-week");
      row.setAttribute("role", "row");
      row.style.setProperty("--w", String(w));
      for (let c = 0; c < 7; c++) {
        const date = new Date(start);
        date.setDate(start.getDate() + w * 7 + c);
        row.appendChild(monthCell(isoOf(date), date.getMonth() === m - 1));
      }
      grid.appendChild(row);
    }
    sheet.appendChild(grid);
    pane.replaceChildren(sheet);

    d.querySelector(".ppui-cal-heading").textContent = first.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
    d.querySelectorAll(".ppui-cal-month").forEach((b) => b.classList.toggle("is-current", b.dataset.month === cal.month));
  }

  // The overlay grows out of (or shrinks back into) a point: the button pressed, or the minimised pill.
  function clipFrom(point, opening) {
    const r = Math.hypot(Math.max(point.x, innerWidth - point.x), Math.max(point.y, innerHeight - point.y));
    const shapes = ["circle(0px at " + point.x + "px " + point.y + "px)", "circle(" + r + "px at " + point.x + "px " + point.y + "px)"];
    return cal.dialog.animate({ clipPath: opening ? shapes : shapes.reverse() },
      { duration: opening ? 520 : 380, easing: "cubic-bezier(0.32, 0.72, 0, 1)", fill: opening ? "none" : "forwards" });
  }

  const centreOf = (node) => {
    const r = node && node.getBoundingClientRect();
    return r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: innerWidth / 2, y: innerHeight / 2 };
  };

  function openCalendar(from) {
    cal.start = isoAfter(0);
    if (!cal.dialog) cal.dialog = buildCalendar();
    cal.from = from || null;
    hidePill();
    cal.dialog.getAnimations().forEach((a) => a.cancel());
    cal.cards.forEach((card) => card.remove());
    cal.cards.clear();
    cal.month = isoAfter(0).slice(0, 7);
    loadNotes().then(() => {
      if (!cal.dialog.open) cal.dialog.showModal();
      root.classList.add("ppui-reading");
      cal.pos = cal.target;
      applyCalView();
      measureWall();
      cal.dialog.querySelector(".ppui-cal-today").focus({ preventScroll: true });
      if (flatWall()) return;
      clipFrom(centreOf(cal.from), true);
      // The days fan out onto the curve, middle first.
      cal.cards.forEach((card, i) => {
        card.style.setProperty("--fan", (Math.abs(i - cal.pos) * 0.04 + 0.12).toFixed(2) + "s");
        card.classList.remove("is-entering");
        void card.offsetWidth;
        card.classList.add("is-entering");
      });
    });
  }

  function closeCalendar(toPoint) {
    const dialog = cal.dialog;
    if (!dialog || !dialog.open) return Promise.resolve();
    const finish = () => {
      dialog.getAnimations().forEach((a) => a.cancel());
      dialog.close();
      if (!document.querySelector("dialog[open]")) root.classList.remove("ppui-reading");
    };
    if (flatWall()) {
      finish();
      return Promise.resolve();
    }
    // Finish when the shrink ends, or shortly after in any case (a background tab may not animate).
    const shrink = clipFrom(toPoint || centreOf(cal.from), false).finished.catch(() => {});
    return Promise.race([shrink, new Promise((r) => setTimeout(r, 500))]).then(finish);
  }

  // Minimise: the overlay shrinks into a small pill in the corner; the pill opens it again.
  function minimiseCalendar() {
    const pill = showPill();
    closeCalendar(centreOf(pill));
  }

  function showPill() {
    if (!cal.pill) {
      const pill = el("button", "ppui-cal-pill");
      pill.type = "button";
      pill.addEventListener("click", () => openCalendar(pill));
      document.body.appendChild(pill);
      cal.pill = pill;
      onNotes(() => updatePill());
    }
    updatePill();
    cal.pill.hidden = false;
    cal.pill.classList.remove("is-leaving");
    return cal.pill;
  }

  function updatePill() {
    if (!cal.pill) return;
    const due = dueSoon().length;
    cal.pill.replaceChildren(icon("calendar"), el("span", "ppui-cal-pill-text", "Calendar"),
      el("span", "ppui-cal-pill-date", dayFromIso(isoAfter(0)).toLocaleDateString("en-AU", { weekday: "short", day: "numeric" })));
    if (due) cal.pill.appendChild(el("span", "ppui-count", String(due)));
    cal.pill.setAttribute("aria-label", "Open calendar" + (due ? ", " + due + " reminders due" : ""));
  }

  function hidePill() {
    if (cal.pill) cal.pill.hidden = true;
  }

  // ---- Header buttons (every page): Calendar (with a count of what's due) and Notebook ----

  function buildCalendarButton() {
    const btn = el("button", "ppui-bar-button ppui-cal-button");
    btn.type = "button";
    btn.title = "Calendar";
    btn.setAttribute("aria-label", "Calendar");
    btn.appendChild(icon("calendar"));
    btn.addEventListener("click", () => openCalendar(btn));
    // After this script has finished starting up, keep the count of reminders due in step.
    setTimeout(() => onNotes(() => {
      const due = dueSoon().length;
      btn.querySelector(".ppui-count")?.remove();
      if (due) btn.appendChild(el("span", "ppui-count", String(due)));
      btn.setAttribute("aria-label", "Calendar" + (due ? ", " + due + " reminders due" : ""));
    }), 0);
    return btn;
  }

  function buildNotebookButton() {
    const btn = el("button", "ppui-bar-button ppui-notebook-button");
    btn.type = "button";
    btn.title = "Notebook";
    btn.setAttribute("aria-label", "Notebook");
    btn.appendChild(icon("notebook"));
    btn.addEventListener("click", () => openNotebook());
    return btn;
  }

  // ---- Due reminders: a small paper banner, once per note per day ----

  function showDueBanner() {
    const today = isoAfter(0);
    const due = dueSoon().filter((n) => n.remindedOn !== today).sort((a, b) => a.date.localeCompare(b.date));
    if (!due.length || document.querySelector(".ppui-due")) return;
    const banner = el("aside", "ppui-due");
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-label", "Reminders due");
    const when = (n) => (n.date < today ? "Overdue" : n.date === today ? "Due today" : "Due tomorrow");
    banner.appendChild(el("p", "ppui-due-title", due.length === 1 ? when(due[0]) : due.length + " reminders due"));
    const ul = el("ul", "ppui-due-list");
    due.slice(0, 3).forEach((n) => {
      const li = el("li");
      li.dataset.tone = String(noteTone(n));
      li.appendChild(el("span", "ppui-due-text", n.text));
      if (due.length > 1) li.appendChild(el("span", "ppui-due-when", when(n)));
      ul.appendChild(li);
    });
    if (due.length > 3) ul.appendChild(el("li", "ppui-due-more", "and " + (due.length - 3) + " more"));
    const actions = el("div", "ppui-due-actions");
    const dismiss = () => {
      banner.classList.add("is-leaving");
      setTimeout(() => banner.remove(), 300);
    };
    if (due.length === 1) {
      const done = el("button", "ppui-due-button is-primary", "Done");
      done.type = "button";
      done.addEventListener("click", () => {
        saveNote(Object.assign({}, due[0], { done: true, remindedOn: today }));
        dismiss();
      });
      actions.appendChild(done);
    }
    const open = el("button", "ppui-due-button", "Open notebook");
    open.type = "button";
    open.addEventListener("click", () => {
      dismiss();
      openNotebook();
    });
    const close = el("button", "ppui-due-close");
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss");
    close.appendChild(icon("close"));
    close.addEventListener("click", dismiss);
    actions.appendChild(open);
    banner.append(ul, actions, close);
    document.body.appendChild(banner);
    // Shown today: don't show these again until tomorrow.
    due.forEach((n) => saveNote(Object.assign({}, n, { remindedOn: today })));
  }

  loadNotes().then(() => setTimeout(showDueBanner, 1200));

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
      // Build once the list stops growing: two quiet checks in a row, 60 ms apart.
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
      }, 60);
    }, NEWS_WAIT_MS);
  }

  // ---- Student Overview page: the portal's section tabs, documents and classes, in our style ----

  const OVERVIEW_PATH = /\/student\/student\/overview\/?$/;
  const SECTION_ICONS = { overview: "grid", "daily-schedule": "calendarClock", "recent-updates": "activity", "upcoming-assignments": "list" };
  const SECTION_NAMES = { overview: "Overview", "daily-schedule": "Schedule", "recent-updates": "Updates", "upcoming-assignments": "Assignments" };
  const DOC_ICONS = [[/academic/i, "fileText"], [/progress/i, "chart"], [/timetable/i, "clock"], [/attendance/i, "check"]];
  const COURSE_LISTS = [["active", "Current"], ["future", "Upcoming"], ["past", "Past"]];

  function readOverviewCourse(node) {
    const text = (sel) => clean((node.querySelector(sel) || {}).textContent);
    const full = text(".course-description");
    const nameLink = node.querySelector("a.course-description");
    const notes = node.querySelector(SEL.notificationsLink);
    const assignments = node.querySelector(SEL.assignmentsLink);
    const grade = text(".course-list-grade-link");
    return {
      full,
      name: shortName(full),
      href: nameLink ? safeHref(nameLink.getAttribute("href")) : null,
      teacher: text(SEL.courseTeacher),
      grade: grade && grade !== "-" ? grade : "",
      updates: parseInt(text(SEL.notificationBadge), 10) || 0,
      updatesHref: notes ? sameOriginHref(notes.getAttribute("href")) : null,
      assignmentsHref: assignments ? sameOriginHref(assignments.getAttribute("href")) : null,
      links: [...node.querySelectorAll(".website-link")]
        .map((a) => ({ label: clean(a.textContent), href: safeHref(a.getAttribute("href")) }))
        .filter((l) => l.label && l.href),
    };
  }

  function overviewCard(course) {
    const card = el("li", "ppui-ov-class" + (course.updates ? " has-updates" : ""));
    const top = el("div", "ppui-ov-class-top");
    // The subject tile and the name both open the class's grades.
    const target = course.assignmentsHref || course.href;
    const tile = el(target ? "a" : "span", "ppui-subject");
    tile.dataset.tone = String(toneFor(course.name));
    tile.appendChild(icon(subjectIcon(course.name)));
    if (target) {
      linkTo(tile, target);
      tile.tabIndex = -1;
      tile.setAttribute("aria-hidden", "true");
    }
    const body = el("div", "ppui-ov-class-body");
    const name = target ? linkTo(el("a", "ppui-ov-class-name", course.name), target) : el("span", "ppui-ov-class-name", course.name);
    body.appendChild(name);
    const meta = [course.teacher, course.full !== course.name ? course.full : ""].filter(Boolean).join(" · ");
    if (meta) body.appendChild(el("span", "ppui-ov-class-meta", meta));
    top.append(tile, body);
    // The grade, when the portal shows one. Updates, Website and Calendar live in Apps and links.
    if (course.grade) {
      const grade = el("span", "ppui-ov-grade", course.grade);
      grade.title = "Current grade";
      top.appendChild(grade);
    }
    card.appendChild(top);

    const foot = el("div", "ppui-ov-class-links");
    if (course.assignmentsHref) {
      const a = el("a", "ppui-ov-link is-main");
      a.href = course.assignmentsHref;
      a.append(icon("list"), el("span", null, "Grades"));
      foot.appendChild(a);
    }
    if (foot.children.length) card.appendChild(foot);
    return card;
  }

  function buildOverview() {
    const source = document.querySelector(".student-overview");
    if (!source || document.querySelector(".ppui-overview")) return;
    const view = el("section", "ppui-overview");
    view.setAttribute("aria-label", "Student overview");

    // Heading row: title, then the portal's section tabs as pills.
    const head = el("header", "ppui-ov-head");
    head.appendChild(el("h1", "ppui-room-title", "Overview"));
    const tabBar = document.querySelector(".vx-tab-bar.my-children-nav");
    if (tabBar) {
      const nav = el("nav", "ppui-ov-nav");
      nav.setAttribute("aria-label", "Student sections");
      for (const a of tabBar.querySelectorAll("a.vx-tab-bar__tab")) {
        const href = sameOriginHref(a.getAttribute("href"));
        if (!href) continue;
        const key = new URL(href).pathname.split("/").filter(Boolean).pop();
        const link = el("a", "ppui-ov-nav-link");
        link.href = href;
        link.append(icon(SECTION_ICONS[key] || "external"), el("span", null, SECTION_NAMES[key] || clean(a.textContent)));
        if (a.classList.contains("vx-tab-bar__tab--active")) link.setAttribute("aria-current", "page");
        nav.appendChild(link);
      }
      head.appendChild(nav);
      tabBar.classList.add("ppui-moved");
    }
    view.appendChild(head);

    // Documents: one tile per report group. Links not out yet stay listed, greyed, as "Not yet".
    const groups = [...source.querySelectorAll(".report-group")];
    if (groups.length) {
      const docs = el("section", "ppui-ov-section");
      docs.appendChild(el("h2", "ppui-ov-heading", "Documents"));
      const grid = el("ul", "ppui-ov-docs");
      for (const g of groups) {
        const label = clean((g.querySelector(".vx-subtitle") || {}).textContent);
        const tile = el("li", "ppui-ov-doc");
        const iconName = (DOC_ICONS.find(([re]) => re.test(label)) || [null, "fileText"])[1];
        const badge = el("span", "ppui-ov-doc-icon");
        badge.appendChild(icon(iconName));
        const title = el("div", "ppui-ov-doc-title");
        title.append(badge, el("span", null, label));
        tile.appendChild(title);
        const links = el("div", "ppui-ov-doc-links");
        for (const a of g.querySelectorAll(".report-links a")) {
          const text = clean(a.textContent);
          const href = a.classList.contains("disabled") ? null : safeHref(a.getAttribute("href"));
          if (href) {
            const link = linkTo(el("a", "ppui-ov-doc-link"), href);
            link.append(el("span", null, text));
            externalMark(link);
            links.appendChild(link);
          } else {
            const off = el("span", "ppui-ov-doc-link is-off");
            off.append(el("span", null, text), el("span", "ppui-ov-soon", "Not yet"));
            links.appendChild(off);
          }
        }
        tile.appendChild(links);
        grid.appendChild(tile);
      }
      docs.appendChild(grid);
      view.appendChild(docs);
    }

    // Classes: Current / Upcoming / Past, as cards.
    const lists = COURSE_LISTS.map(([key, label]) => {
      const ul = source.querySelector(".course-list." + key);
      return { key, label, courses: ul ? [...ul.querySelectorAll(".course-list-item")].map(readOverviewCourse).filter((c) => c.name) : [] };
    }).filter((l) => l.key === "active" || l.courses.length);
    const classes = el("section", "ppui-ov-section");
    const classHead = el("div", "ppui-ov-heading-row");
    classHead.appendChild(el("h2", "ppui-ov-heading", "Classes"));
    const switcher = el("div", "ppui-ov-switch");
    switcher.setAttribute("role", "tablist");
    switcher.setAttribute("aria-label", "Classes");
    const grid = el("ul", "ppui-ov-classes");
    grid.id = "ppui-ov-classes";
    grid.setAttribute("role", "tabpanel");
    const summary = el("p", "ppui-ov-summary");
    let shown = "active";
    const buttons = lists.map((l) => {
      const b = el("button", "ppui-ov-switch-button");
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-controls", grid.id);
      b.append(el("span", null, l.label), el("span", "ppui-ov-switch-count", String(l.courses.length)));
      b.addEventListener("click", () => {
        shown = l.key;
        render();
      });
      return b;
    });
    switcher.append(...buttons);
    classHead.append(switcher, summary);
    classes.append(classHead, grid);
    view.appendChild(classes);

    function render() {
      const list = lists.find((l) => l.key === shown);
      buttons.forEach((b, i) => {
        const on = lists[i].key === shown;
        b.setAttribute("aria-selected", String(on));
        b.tabIndex = on ? 0 : -1;
      });
      // Classes with new updates first: they're the ones that need a look.
      const courses = list.courses.filter((c) => c.updates).concat(list.courses.filter((c) => !c.updates));
      grid.replaceChildren(...courses.map(overviewCard));
      if (!courses.length) grid.appendChild(emptyState("No " + list.label.toLowerCase() + " classes."));
      const updates = list.courses.reduce((n, c) => n + c.updates, 0);
      const busy = list.courses.filter((c) => c.updates).length;
      summary.textContent = updates
        ? updates + (updates === 1 ? " new update" : " new updates") + " in " + busy + (busy === 1 ? " class" : " classes")
        : "No new updates";
      summary.classList.toggle("is-busy", !!updates);
    }
    // Left / Right move between Current, Upcoming and Past.
    switcher.addEventListener("keydown", (e) => {
      const i = lists.findIndex((l) => l.key === shown);
      const to = { ArrowRight: i + 1, ArrowLeft: i - 1 }[e.key];
      if (to === undefined) return;
      shown = lists[(to + lists.length) % lists.length].key;
      render();
      buttons[lists.findIndex((l) => l.key === shown)].focus();
    });
    render();

    source.before(view);
    source.classList.add("ppui-moved");
  }

  // The portal's page stays hidden (html.ppui-page-pending, set by early.js) until ours is built;
  // if building fails, the portal's page comes back and the error is logged.
  if (OVERVIEW_PATH.test(location.pathname)) {
    root.classList.add("ppui-page-pending");
    whenReady(() => document.querySelector(".student-overview .course-list-item"), () => {
      try {
        root.classList.add("ppui-overview-page");
        buildOverview();
      } catch (e) {
        console.warn("[Pinehurst Dashboard] Overview view failed; showing the portal's page.", e);
        root.classList.remove("ppui-overview-page");
        document.querySelectorAll(".ppui-moved").forEach((n) => n.classList.remove("ppui-moved"));
        document.querySelector(".ppui-overview")?.remove();
      } finally {
        root.classList.remove("ppui-page-pending");
      }
    }, WAIT_MS);
  }

  // ---- Messages: the inbox, with the open message read beside the list ----

  const MESSAGES_PATH = /\/student\/messages(\/|$)/;
  const MESSAGE_TABS = { messages: "clock", people: "user", categories: "tag" };
  const DISCLAIMER = /This e-?mail is confidential/i;
  const AVATAR_TONES = 6;

  function readMessageList(doc) {
    const messages = [];
    let group = "";
    for (const li of doc.querySelectorAll(".messages .vx-list > li")) {
      if (li.classList.contains("vx-list__group-header")) {
        group = clean(li.textContent);
        continue;
      }
      if (!li.classList.contains("message")) continue;
      const text = (sel) => clean((li.querySelector(sel) || {}).textContent);
      const link = li.querySelector("a.message-link");
      const href = link ? sameOriginHref(link.getAttribute("href")) : null;
      if (!href) continue;
      const from = li.querySelector("a.message-from");
      messages.push({
        id: (href.match(/email\/(\d+)/) || [])[1] || href,
        href,
        group,
        from: text(".message-from") || "Unknown sender",
        fromHref: from && from.getAttribute("href") ? sameOriginHref(from.getAttribute("href")) : null,
        category: text(".message-category"),
        subject: text(".message-subject") || "(No subject)",
        date: text(".message-date-sent"),
        unread: /\b(unread|new)\b/i.test(li.className),
      });
    }
    const paging = (sel) => {
      const a = doc.querySelector(".messages .paging-buttons " + sel);
      return a ? sameOriginHref(a.getAttribute("href")) : null;
    };
    return { messages, next: paging("a.next-button"), prev: paging("a:not(.next-button)") };
  }

  function initials(name) {
    const words = name.replace(/^(mr|mrs|ms|miss|dr)\.?\s+/i, "").split(/\s+/).filter(Boolean);
    return ((words[0] || "?")[0] + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
  }

  // Each sender keeps one colour, so a name is easy to spot down the list.
  function avatar(name) {
    const a = el("span", "ppui-inbox-avatar", initials(name));
    let h = 2166136261;
    for (const c of name) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    a.dataset.tone = String((h >>> 0) % AVATAR_TONES);
    a.setAttribute("aria-hidden", "true");
    return a;
  }

  // The school's email footer (address, legal notice) adds nothing on screen.
  function trimDisclaimer(body) {
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode()); ) {
      const i = n.textContent.search(DISCLAIMER);
      if (i < 0) continue;
      const range = document.createRange();
      range.setStart(n, i);
      range.setEndAfter(body.lastChild);
      range.deleteContents();
      break;
    }
    // Line breaks right after a paragraph or another break only leave gaps.
    for (const br of body.querySelectorAll("br")) {
      let prev = br.previousSibling;
      while (prev && prev.nodeType === Node.TEXT_NODE && !clean(prev.textContent)) prev = prev.previousSibling;
      if (!prev || prev.nodeName === "BR" || /^(P|UL|OL|H2|H3|H4|BLOCKQUOTE|FIGURE)$/.test(prev.nodeName)) br.remove();
    }
    let last;
    while ((last = body.lastChild) && (last.nodeName === "BR" || !clean(last.textContent)) && !(last.querySelector && last.querySelector("img"))) last.remove();
  }

  // The message's own page is plain server HTML, so a fetch is enough (no iframe).
  async function fetchMessage(m) {
    if (m.full) return m.full;
    const res = await fetch(m.href, { credentials: "same-origin" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const source = doc.querySelector(".email-body");
    if (!source) throw new Error("No message body");
    const fields = {};
    for (const s of doc.querySelectorAll(".vx-record-body .vx-subtitle")) {
      const [label, ...rest] = clean(s.textContent).split(":");
      fields[label.toLowerCase()] = clean(rest.join(":"));
    }
    const body = cleanBody(source, () => false);
    trimDisclaimer(body);
    m.full = { from: fields.from || m.from, sent: fields["date sent"] || m.date, body };
    return m.full;
  }

  function buildInbox() {
    const source = document.querySelector(".messages");
    if (!source || document.querySelector(".ppui-inbox")) return;
    const first = readMessageList(document);
    const messages = first.messages;
    let nextHref = first.next;

    const view = el("section", "ppui-inbox");
    view.setAttribute("aria-label", "Messages");

    // Heading row: title, then Recent / People / Categories as pills.
    const head = el("header", "ppui-ov-head");
    head.appendChild(el("h1", "ppui-room-title", "Messages"));
    const tabBar = document.querySelector(".vx-tab-bar.my-children-nav");
    if (tabBar) {
      const nav = el("nav", "ppui-ov-nav");
      nav.setAttribute("aria-label", "Message views");
      for (const a of tabBar.querySelectorAll("a.vx-tab-bar__tab")) {
        const href = sameOriginHref(a.getAttribute("href"));
        if (!href) continue;
        const key = new URL(href).pathname.split("/").filter(Boolean).pop();
        const link = el("a", "ppui-ov-nav-link");
        link.href = href;
        link.append(icon(MESSAGE_TABS[key] || "mail"), el("span", null, clean(a.textContent)));
        if (a.classList.contains("vx-tab-bar__tab--active")) link.setAttribute("aria-current", "page");
        nav.appendChild(link);
      }
      head.appendChild(nav);
      tabBar.classList.add("ppui-moved");
    }
    view.appendChild(head);

    // Tools: search, All / Unread (only when something is unread), Mark all read.
    const tools = el("div", "ppui-inbox-tools");
    const searchBox = el("label", "ppui-inbox-search");
    const search = el("input");
    search.type = "text";
    search.placeholder = "Search messages";
    search.setAttribute("aria-label", "Search messages by sender or subject");
    searchBox.append(icon("search"), search);
    tools.appendChild(searchBox);
    let onlyUnread = false;
    const switcher = el("div", "ppui-ov-switch");
    const switchButtons = [["All", false], ["Unread", true]].map(([label, value]) => {
      const b = el("button", "ppui-ov-switch-button");
      b.type = "button";
      b.append(el("span", null, label));
      if (value) b.appendChild(el("span", "ppui-ov-switch-count"));
      b.addEventListener("click", () => {
        onlyUnread = value;
        renderList();
      });
      return b;
    });
    switcher.append(...switchButtons);
    tools.appendChild(switcher);
    const markAll = source.querySelector('a[href*="acknowledge-all"]');
    const markHref = markAll && sameOriginHref(markAll.getAttribute("href"));
    if (markHref) {
      const a = el("a", "ppui-ov-link ppui-inbox-mark");
      a.href = markHref;
      a.append(icon("check"), el("span", null, "Mark all read"));
      tools.appendChild(a);
    }
    view.appendChild(tools);

    const body = el("div", "ppui-inbox-body");
    const listPane = el("div", "ppui-inbox-list");
    if (first.prev) {
      const newer = el("a", "ppui-ov-link ppui-inbox-newer");
      newer.href = first.prev;
      newer.append(icon("chevronLeft"), el("span", null, "Newer messages"));
      listPane.appendChild(newer);
    }
    const list = el("ul", "ppui-inbox-rows");
    list.setAttribute("aria-label", "Messages");
    const more = el("button", "ppui-ov-link ppui-inbox-more");
    more.type = "button";
    listPane.append(list, more);
    const reader = el("article", "ppui-inbox-reader");
    reader.tabIndex = -1;
    body.append(listPane, reader);
    view.appendChild(body);

    let openId = null;
    let openToken = 0;
    const rows = new Map();

    function row(m, showCategory) {
      const a = el("a", "ppui-inbox-row" + (m.unread ? " is-unread" : ""));
      a.href = m.href;
      a.dataset.id = m.id;
      const top = el("span", "ppui-inbox-row-top");
      top.append(el("span", "ppui-inbox-from", m.from), el("span", "ppui-inbox-date", m.date));
      const text = el("span", "ppui-inbox-row-text");
      text.append(top, el("span", "ppui-inbox-subject", m.subject));
      if (showCategory && m.category) text.appendChild(el("span", "ppui-inbox-category", m.category));
      a.append(avatar(m.from), text);
      if (m.unread) a.appendChild(el("span", "ppui-sr", " (unread)"));
      if (m.id === openId) a.setAttribute("aria-current", "true");
      // A plain click reads it here; Ctrl/Cmd-click still opens the portal's page in a new tab.
      a.addEventListener("click", (e) => {
        if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        open(m);
      });
      rows.set(m.id, a);
      return a;
    }

    function shown() {
      const q = search.value.trim().toLowerCase();
      return messages.filter((m) => (!onlyUnread || m.unread) && (!q || (m.from + " " + m.subject + " " + m.category).toLowerCase().includes(q)));
    }

    function renderList() {
      const unread = messages.filter((m) => m.unread).length;
      if (!unread) onlyUnread = false;
      switcher.hidden = !unread;
      switchButtons[1].lastChild.textContent = String(unread);
      switchButtons.forEach((b, i) => b.setAttribute("aria-pressed", String(onlyUnread === !!i)));
      // The category only earns a line when the messages come from more than one.
      const showCategory = new Set(messages.map((m) => m.category)).size > 1;
      rows.clear();
      const items = [];
      let group = null;
      const visible = shown();
      for (const m of visible) {
        if (m.group !== group) {
          group = m.group;
          if (group) items.push(el("li", "ppui-inbox-group", group));
        }
        const li = el("li");
        li.appendChild(row(m, showCategory));
        items.push(li);
      }
      list.replaceChildren(...items);
      if (!visible.length) {
        const q = search.value.trim();
        list.appendChild(emptyState(q ? "No messages match “" + q + "”." : onlyUnread ? "Nothing unread." : "No messages yet."));
      }
      more.hidden = !nextHref;
      more.disabled = false;
      more.replaceChildren(el("span", null, "Load older messages"));
    }

    function emptyReader() {
      const box = el("div", "ppui-inbox-reader-empty");
      box.append(icon("mail"), el("p", null, messages.length ? "Pick a message to read it here." : "No messages to read."));
      reader.replaceChildren(box);
    }

    function step(by) {
      const visible = shown();
      const i = visible.findIndex((m) => m.id === openId);
      const to = visible[i + by];
      if (to) open(to, true);
    }

    function readerButton(label, iconName, onClick, className) {
      const b = el("button", "ppui-inbox-icon-button" + (className ? " " + className : ""));
      b.type = "button";
      b.title = label;
      b.setAttribute("aria-label", label);
      b.appendChild(icon(iconName));
      b.addEventListener("click", onClick);
      return b;
    }

    async function open(m, focusRow) {
      openId = m.id;
      const token = ++openToken;
      for (const [id, a] of rows) {
        if (id === m.id) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      }
      if (focusRow && rows.get(m.id)) rows.get(m.id).focus();
      view.classList.add("is-reading");
      history.replaceState(null, "", "#message-" + m.id);

      const bar = el("div", "ppui-inbox-reader-bar");
      const back = el("button", "ppui-ov-link ppui-inbox-back");
      back.type = "button";
      back.append(icon("chevronLeft"), el("span", null, "All messages"));
      back.addEventListener("click", close);
      bar.appendChild(back);
      const visible = shown();
      const i = visible.findIndex((x) => x.id === m.id);
      const newer = readerButton("Newer message", "chevronLeft", () => step(-1));
      const older = readerButton("Older message", "chevronRight", () => step(1));
      newer.disabled = i <= 0;
      older.disabled = i < 0 || i >= visible.length - 1;
      const portal = el("a", "ppui-ov-link ppui-inbox-portal");
      portal.href = m.href;
      portal.append(el("span", null, "Open on portal"));
      bar.append(newer, older, portal);

      const subject = el("h2", "ppui-inbox-reader-subject", m.subject);
      const meta = el("div", "ppui-inbox-reader-meta");
      const who = el("div", "ppui-inbox-reader-who");
      const name = m.fromHref ? el("a", "ppui-inbox-reader-from", m.from) : el("span", "ppui-inbox-reader-from", m.from);
      if (m.fromHref) {
        name.href = m.fromHref;
        name.title = "All messages from " + m.from;
      }
      const sent = el("span", "ppui-inbox-reader-sent", m.date);
      who.append(name, sent);
      meta.append(avatar(m.from), who);
      if (m.category) meta.appendChild(el("span", "ppui-inbox-reader-category", m.category));
      const text = el("div", "ppui-inbox-reader-text is-loading");
      text.setAttribute("aria-busy", "true");
      for (let n = 0; n < 4; n++) text.appendChild(el("span", "ppui-inbox-skeleton"));
      reader.replaceChildren(bar, subject, meta, text);
      reader.scrollTop = 0;
      if (matchMedia("(max-width: 860px)").matches) {
        reader.focus({ preventScroll: true });
        view.scrollIntoView({ block: "start" });
      }

      try {
        const full = await fetchMessage(m);
        if (token !== openToken) return;
        sent.textContent = full.sent;
        text.classList.remove("is-loading");
        text.removeAttribute("aria-busy");
        text.replaceChildren(full.body.cloneNode(true));
        if (!clean(full.body.textContent) && !full.body.querySelector("img")) text.replaceChildren(el("p", "ppui-inbox-note", "This message has no text."));
        // Opening it on the portal marks it read; the row follows.
        if (m.unread) {
          m.unread = false;
          rows.get(m.id)?.classList.remove("is-unread");
          rows.get(m.id)?.querySelector(".ppui-sr")?.remove();
          const left = messages.filter((x) => x.unread).length;
          switchButtons[1].lastChild.textContent = String(left);
          if (!left && !onlyUnread) switcher.hidden = true;
        }
      } catch (e) {
        if (token !== openToken) return;
        console.warn("[Pinehurst Dashboard] Couldn't load message", e);
        text.classList.remove("is-loading");
        text.removeAttribute("aria-busy");
        const retry = el("button", "ppui-ov-link", "Try again");
        retry.type = "button";
        retry.addEventListener("click", () => open(m));
        const p = el("p", "ppui-inbox-note", "This message didn't load. Try again, or open it on the portal.");
        text.replaceChildren(p, retry);
      }
    }

    function close() {
      openId = null;
      openToken++;
      view.classList.remove("is-reading");
      for (const a of rows.values()) a.removeAttribute("aria-current");
      history.replaceState(null, "", location.pathname + location.search);
      emptyReader();
    }

    // Older pages load in place, under the ones already shown.
    more.addEventListener("click", async () => {
      if (!nextHref) return;
      more.disabled = true;
      more.replaceChildren(el("span", null, "Loading…"));
      try {
        const res = await fetch(nextHref, { credentials: "same-origin" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const page = readMessageList(new DOMParser().parseFromString(await res.text(), "text/html"));
        const known = new Set(messages.map((m) => m.id));
        messages.push(...page.messages.filter((m) => !known.has(m.id)));
        nextHref = page.next;
        renderList();
      } catch (e) {
        console.warn("[Pinehurst Dashboard] Couldn't load older messages", e);
        more.disabled = false;
        more.replaceChildren(el("span", null, "Couldn't load. Try again"));
      }
    });

    search.addEventListener("input", renderList);
    search.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && search.value) {
        search.value = "";
        renderList();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        list.querySelector(".ppui-inbox-row")?.focus();
      }
    });
    // Up / Down (or J / K) walk the list and open each message as they go.
    list.addEventListener("keydown", (e) => {
      const by = { ArrowDown: 1, ArrowUp: -1, j: 1, k: -1 }[e.key];
      const current = e.target.closest(".ppui-inbox-row");
      if (!by || !current) return;
      e.preventDefault();
      const all = [...list.querySelectorAll(".ppui-inbox-row")];
      const to = all[all.indexOf(current) + by];
      const m = to && messages.find((x) => x.id === to.dataset.id);
      if (m) open(m, true);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && view.classList.contains("is-reading") && !e.target.closest("input, textarea")) close();
    });

    renderList();
    emptyReader();
    source.before(view);
    source.classList.add("ppui-moved");
    const fromHash = location.hash.match(/^#message-(.+)$/);
    const start = fromHash && messages.find((m) => m.id === fromHash[1]);
    if (start) open(start);
  }

  // The list is in the page's HTML, so it's there by now. early.js hid the portal's version.
  if (MESSAGES_PATH.test(location.pathname)) {
    try {
      if (document.querySelector(".messages .vx-list li.message")) {
        root.classList.add("ppui-inbox-page");
        buildInbox();
      }
    } catch (e) {
      console.warn("[Pinehurst Dashboard] Messages view failed; showing the portal's page.", e);
      root.classList.remove("ppui-inbox-page");
      document.querySelectorAll(".ppui-moved").forEach((n) => n.classList.remove("ppui-moved"));
      document.querySelector(".ppui-inbox")?.remove();
    } finally {
      root.classList.remove("ppui-page-pending");
    }
  }

  // ---- Native pages we don't rebuild: one heading row, as on Overview and Messages ----
  // The portal's title strip and section tab bar become a room title and a row of pills; the
  // page itself stays the portal's, laid out by the "Native page shell" section of styles.css.

  const NATIVE_TITLES = { planner: "Assignment Planner", daily: "Daily Schedule" };

  function nativeRoute() {
    const m = root.className.match(/\bppui-route-(\w+)/);
    return m ? m[1] : null;
  }

  function buildNativeHead() {
    const route = nativeRoute();
    const app = document.querySelector(SEL.app);
    if (!route || !app || app.querySelector(".ppui-native-head")) return;
    // The News page has its own heading row.
    try {
      if (localStorage.getItem(NEWS_PATH_KEY) === location.pathname) return;
    } catch (e) {}
    const toolbar = app.querySelector(":scope > .screen-toolbar");
    const tabBar = app.querySelector(".vx-tab-bar.my-children-nav");
    const title = NATIVE_TITLES[route] || clean(toolbar && toolbar.textContent);
    if (!title) return;

    const head = el("header", "ppui-ov-head ppui-native-head");
    head.appendChild(el("h1", "ppui-room-title", title));
    if (tabBar) {
      const nav = el("nav", "ppui-ov-nav");
      nav.setAttribute("aria-label", "Student sections");
      for (const a of tabBar.querySelectorAll("a.vx-tab-bar__tab")) {
        const href = sameOriginHref(a.getAttribute("href"));
        if (!href) continue;
        const key = new URL(href).pathname.split("/").filter(Boolean).pop();
        const link = el("a", "ppui-ov-nav-link");
        link.href = href;
        link.append(icon(SECTION_ICONS[key] || "external"), el("span", null, SECTION_NAMES[key] || clean(a.textContent)));
        if (a.classList.contains("vx-tab-bar__tab--active")) link.setAttribute("aria-current", "page");
        nav.appendChild(link);
      }
      if (nav.children.length) head.appendChild(nav);
      tabBar.classList.add("ppui-native-moved");
    }
    if (toolbar) toolbar.classList.add("ppui-native-moved");
    app.prepend(head);
  }

  // The planner scrolls inside its frame, so the frame fills the rest of the window and the page
  // itself never scrolls: one scrollbar, not two.
  function fitPlannerFrame() {
    const frame = document.querySelector(".nav-embed .old-portals-iframe");
    if (!frame) return;
    const fit = () => {
      const top = frame.getBoundingClientRect().top + scrollY;
      frame.style.setProperty("height", Math.max(420, innerHeight - top - 24) + "px", "important");
    };
    fit();
    addEventListener("resize", fit);
  }

  // A story page the portal sent empty: say so, and point to the News page, where it can be read.
  function emptyStoryNote() {
    const article = document.querySelector(".detail-article");
    if (!article || clean(article.textContent) || article.querySelector("img")) return;
    let newsPath = "/pinehurst/student/pages/9-13-news";
    try {
      newsPath = localStorage.getItem(NEWS_PATH_KEY) || newsPath;
    } catch (e) {}
    const note = el("div", "ppui-article-empty");
    note.append(
      el("h1", null, "This story didn't load"),
      el("p", null, "The portal sent this page with nothing in it. The story can still be read on the News page."),
    );
    const link = el("a", null, "Open News");
    link.href = newsPath;
    note.appendChild(link);
    article.appendChild(note);
  }

  if (!HOME_PATH.test(location.pathname)) {
    try {
      buildNativeHead();
      if (nativeRoute() === "planner") fitPlannerFrame();
      if (nativeRoute() === "article") setTimeout(emptyStoryNote, 5000);
    } catch (e) {
      console.warn("[Pinehurst Dashboard] Page heading failed; keeping the portal's.", e);
    }
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
      // The period on now gets a marker at the edge of its fill.
      if (fill > 0 && fill < 1) seg.appendChild(el("span", "ppui-progress-spark"));
      track.appendChild(seg);
    });
    // How far through the day we are.
    track.style.setProperty("--done", (passed / total).toFixed(4));
    track.classList.toggle("is-started", passed > 0);
    // After the last period the marker rests at the end of the day's fill.
    if (passed > 0 && !track.querySelector(".ppui-progress-spark")) {
      const filled = [...track.querySelectorAll(".ppui-progress-seg")].filter((seg) => parseFloat(seg.style.getPropertyValue("--fill")) > 0).pop();
      if (filled) filled.appendChild(el("span", "ppui-progress-spark"));
    }
    if (bar.layout) bar.layout();
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
    startGlow(bar);
    return bar;
  }

  // ---- Day bar: one theme gradient across the whole day, and a soft light under the pointer ----
  // Each period's fill shows its own slice of a single gradient sized to the full track, so the
  // colours run on unbroken across the gaps. Nothing moves on its own; the light only follows you.
  function startGlow(bar) {
    const track = bar.querySelector(".ppui-progress-track");
    bar.layout = () => {
      const width = track.clientWidth;
      if (!width) return;
      track.style.setProperty("--tw", width + "px");
      for (const seg of track.children) seg.style.setProperty("--sx", seg.offsetLeft + "px");
    };
    new ResizeObserver(() => bar.layout()).observe(track);
    track.addEventListener("pointermove", (e) => {
      track.style.setProperty("--mx", e.clientX - track.getBoundingClientRect().left + "px");
      track.classList.add("is-lit");
    });
    track.addEventListener("pointerleave", () => track.classList.remove("is-lit"));
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
    const calButton = el("button", "ppui-head-button");
    calButton.type = "button";
    calButton.title = "Open calendar";
    calButton.setAttribute("aria-label", "Open calendar");
    calButton.appendChild(icon("calendar"));
    calButton.addEventListener("click", () => openCalendar(calButton));
    section.querySelector(".ppui-head").insertBefore(calButton, section.querySelector(".ppui-head .ppui-link"));
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
        writeJson(TODAY_KEY, { date: isoAfter(0), items: items.map((item) => ({ time: item.time, title: item.title })) });
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
    // Day headings: Pinned, Today, Earlier this week, Older. Each day links to that day on the News page.
    let lastBucket = null;
    items.slice(0, NEWS_COUNT).forEach((item, i) => {
      const starred = actions.isStarred(item);
      const pinned = actions.isPinned(item);
      const back = item.time === null ? null : daysBack(item.time);
      const bucket = pinned && actions.view === "all" ? "Pinned" : back === null ? "Older" : back <= 0 ? "Today" : back < 7 ? "Earlier this week" : "Older";
      if (bucket !== lastBucket) {
        lastBucket = bucket;
        const h = el("li", "ppui-story-day" + (bucket === "Today" ? " is-today" : "") + (bucket === "Pinned" ? " is-pinned" : ""));
        h.appendChild(el("span", null, bucket));
        if (bucket !== "Pinned" && item.time !== null) {
          const all = el("a", "ppui-story-day-link", "See all");
          all.href = newsHref.split("#")[0] + "#day=" + item.time;
          all.setAttribute("aria-label", "See all " + bucket.toLowerCase() + " news");
          h.appendChild(all);
        }
        list.appendChild(h);
      }
      const row = el("li", "ppui-story" + (i === 0 ? " is-lead" : "") + (starred ? " is-starred" : "") + (pinned ? " is-pinned" : ""));
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
      if (starred) {
        const mark = el("span", "ppui-pinned-mark");
        mark.title = "Starred";
        mark.appendChild(icon("star"));
        meta.appendChild(mark);
      }
      if (item.date.ago) meta.appendChild(document.createTextNode(item.date.ago));
      body.appendChild(meta);
      a.appendChild(body);

      // Pin / star / mark as read (or, in the Read view, put back). They sit over the row and appear on hover or focus.
      const tools = el("span", "ppui-story-actions");
      if (actions.view === "trash") {
        tools.appendChild(storyButton("ppui-story-restore", "Mark as unread", "rotateCcw", () => actions.restore(item)));
      } else {
        const pin = storyButton("ppui-story-pin", pinned ? "Unpin" : "Pin to top", "pin", () => actions.togglePin(item));
        pin.setAttribute("aria-pressed", String(pinned));
        const star = storyButton("ppui-story-star", starred ? "Unstar" : "Star", "star", () => actions.toggleStar(item));
        star.setAttribute("aria-pressed", String(starred));
        tools.append(pin, star, storyButton("ppui-story-trash", "Mark as read", "check", () => {
          if (starred || pinned) return actions.trash(item);
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

    // Filter button in the card's heading: All stories / Starred / Read, with counts.
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
        const b = el("button", "ppui-menu-item", "Put everything back");
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
      // An emptied "Starred" or "Read" view falls back to everything.
      if (actions.view !== "all" && !actions.visible().length) actions.view = "all";
      filterLabel.textContent = actions.view === "all" ? "" : NEWS_VIEWS.find(([v]) => v === actions.view)[1];
      filter.classList.toggle("is-active", actions.view !== "all");
      const shown = actions.visible();
      renderNews(list, shown, newsLink.href, actions);
      // The lead story's picture often lives only on its own page: fetch it for the card (and remember it).
      if (shown[0] && !shown[0].image) fullStory(shown[0]).then(() => shown[0].image && saveCachedNews(newsLink.href, items));
    }

    // Last visit's stories show at once; the hidden frame then brings the list up to date.
    const cached = cachedNews(newsLink.href);
    if (cached.length) {
      items = cached;
      reader.newsHref = reader.newsHref || newsLink.href;
      render();
    }

    async function load() {
      try {
        reader.newsHref = reader.newsHref || newsLink.href;
        const fresh = await loadArticles(newsLink.href);
        // Keep pictures already found for stories that haven't changed.
        const known = new Map(items.map((item) => [storyKey(item), item.image]));
        fresh.forEach((item) => {
          if (!item.image && known.get(storyKey(item))) item.image = known.get(storyKey(item));
        });
        const same = fresh.length === items.length && fresh.every((item, i) => storyKey(item) === storyKey(items[i]));
        if (same && items.length) {
          saveCachedNews(newsLink.href, items);
          return;
        }
        items = fresh;
        saveCachedNews(newsLink.href, items);
        render();
      } catch (e) {
        if (items.length) return;
        list.replaceChildren();
        const fallback = el("li", "ppui-empty");
        fallback.appendChild(document.createTextNode("Could not load news. "));
        const link = el("a", "ppui-link", "Open " + newsLink.label);
        link.href = newsLink.href;
        fallback.appendChild(link);
        list.appendChild(fallback);
      }
    }

    // With stories already on screen, the (heavy) frame waits until the page is idle.
    if (cached.length && window.requestIdleCallback) requestIdleCallback(load, { timeout: 2000 });
    else load();
    setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_MS);
    return section;
  }

  // The card's stories, kept between visits: plain fields plus the (already cleaned) body markup.
  const NEWS_CACHE_KEY = "ppui-news-cache";

  function saveCachedNews(href, items) {
    writeJson(NEWS_CACHE_KEY, {
      href,
      items: items.map((item) => ({
        title: item.title, dateText: item.dateText, summary: item.summary, image: item.image, href: item.href,
        body: item.body.innerHTML,
      })),
    });
  }

  function cachedNews(href) {
    const saved = readJson(NEWS_CACHE_KEY, null);
    if (!saved || saved.href !== href || !Array.isArray(saved.items)) return [];
    return saved.items.filter((c) => c && typeof c.title === "string").map((c) => {
      const day = storyDate(c.dateText);
      // Re-clean the saved markup (an inert template: nothing loads or runs while it's parsed).
      const t = document.createElement("template");
      t.innerHTML = typeof c.body === "string" ? c.body : "";
      return {
        title: c.title,
        dateText: c.dateText || "",
        time: isNaN(day) ? null : day.setHours(0, 0, 0, 0),
        date: splitDate(c.dateText || ""),
        summary: c.summary || "",
        image: absUrl(c.image),
        href: c.href ? sameOriginHref(c.href) : null,
        frames: [],
        body: cleanBody(t.content, () => false),
      };
    });
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
    return {
      name: shortName(nameLink && nameLink.textContent),
      href: href(nameLink),
      gradesHref: href(node.querySelector(SEL.assignmentsLink)),
      teacher: text(SEL.courseTeacher),
      // Only used to order today's classes.
      period: period ? Number(period[1]) : null,
      updates: parseInt(text(SEL.notificationBadge), 10) || 0,
      updatesHref: href(notes),
      links: links.filter((l) => l.label && l.href),
    };
  }

  function courseRow(course) {
    const row = el("li", "ppui-course");
    // The subject tile and the name both open the class's grades.
    const target = course.gradesHref || course.href;
    const badgeIcon = el(target ? "a" : "span", "ppui-subject");
    badgeIcon.dataset.tone = String(toneFor(course.name));
    badgeIcon.appendChild(icon(subjectIcon(course.name)));
    if (target) {
      badgeIcon.href = target;
      badgeIcon.tabIndex = -1;
      badgeIcon.setAttribute("aria-hidden", "true");
    }
    row.appendChild(badgeIcon);

    const body = el("div", "ppui-body");
    const name = el(target ? "a" : "span", "ppui-class", course.name);
    if (target) {
      name.href = target;
      if (course.gradesHref) name.title = "Grades for " + course.name;
    }
    body.appendChild(name);
    if (course.teacher) body.appendChild(el("span", "ppui-meta", course.teacher));
    const noteCount = el("button", "ppui-note-count");
    noteCount.type = "button";
    noteCount.hidden = true;
    noteCount.addEventListener("click", () => openNotebook({ filter: course.name }));
    body.appendChild(noteCount);
    onNotes(() => {
      const n = openNotes().filter((note) => note.subject === course.name).length;
      noteCount.hidden = !n;
      noteCount.replaceChildren(icon("notebook"), document.createTextNode(n + (n === 1 ? " note" : " notes")));
      noteCount.setAttribute("aria-label", n + " open notes for " + course.name);
    });
    row.appendChild(body);


    {
      const more = el("button", "ppui-more");
      more.type = "button";
      more.setAttribute("aria-label", "More for " + course.name);
      more.appendChild(icon("ellipsis"));
      const menu = el("ul", "ppui-menu");
      menu.setAttribute("aria-label", course.name);
      // Notes first: write one for this class, or see the ones it has.
      for (const [label, iconName, open] of [
        ["Add note", "plus", () => openNotebook({ subject: course.name })],
        ["Notes for this class", "notebook", () => openNotebook({ filter: course.name })],
      ]) {
        const li = el("li");
        const b = el("button", "ppui-menu-item ppui-menu-note-item");
        b.type = "button";
        b.append(icon(iconName), el("span", null, label));
        b.addEventListener("click", () => {
          menu.hidePopover();
          open();
        });
        li.appendChild(b);
        menu.appendChild(li);
      }
      arrowNav(menu, ".ppui-menu-item");
      popover(more, menu);
      menu.addEventListener("toggle", (e) => {
        if (e.newState === "open") menu.querySelector(".ppui-menu-item").focus();
      });
      row.appendChild(more);
    }
    return row;
  }

  function buildClassesPanel(listComp, classesHref) {
    const courses = [...listComp.querySelectorAll(SEL.course)].map(readCourse).filter((c) => c.name);
    if (!courses.length) return null;
    // Kept for every page: names for the notebook, and each class's links for Apps and links.
    writeJson(CLASSES_KEY, courses.map((c) => ({ name: c.name, updatesHref: c.updatesHref, links: c.links })));
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

    const makeClasses = () => {
      const classList = document.querySelector(SEL.classList);
      if (!classList) return null;
      const classesLink = [...document.querySelectorAll("a")]
        .find((a) => /classes\s*&\s*reports/i.test(a.textContent) && sameOriginHref(a.getAttribute("href")));
      return buildClassesPanel(classList, classesLink && sameOriginHref(classesLink.getAttribute("href")));
    };
    const firstClasses = makeClasses();
    let classesBuilt = !!firstClasses;
    if (firstClasses) dash.appendChild(firstClasses);

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
    const events = document.querySelector(SEL.eventsComponent);
    if (events) {
      try {
        harvestEvents(events);
      } catch (e) {}
      const open = el("button", "ppui-events-open");
      open.type = "button";
      open.append(icon("calendar"), el("span", null, "Open calendar"));
      open.addEventListener("click", () => openCalendar(open));
      events.prepend(open);
    }
    foldBlocks(grid, classesBuilt);
    showUnread();
    reveal();

    // The class list can render after the first blocks (often in Firefox); add the Classes
    // card next to Today once it shows up.
    if (!classesBuilt) {
      whenReady(() => {
        const list = document.querySelector(SEL.classList);
        return list && list.querySelector(SEL.course);
      }, () => {
        if (dash.querySelector(".ppui-classes")) return;
        const classes = makeClasses();
        if (!classes) return;
        dash.firstElementChild.after(classes);
        foldBlocks(grid, true);
      }, WAIT_MS);
    }
  }

  // The portal hydrates after load; wait for its blocks, then build once.
  whenReady(() => document.querySelector(SEL.regions + " " + SEL.block), build, WAIT_MS);
})();
