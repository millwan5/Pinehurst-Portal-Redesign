// Runs inside the embedded old-portal pages (portals-embed.veracross.au). On a class's assignment
// page it adds what the list leaves you to work out: each score as a percentage with a coloured bar,
// upcoming work marked, and a summary (average, graded, upcoming) above the list.
// A score you haven't seen yet stays sealed behind a "?" until you open the assignment, then unboxes.
// The portal's own script still renders the list, opens assignments and runs the filters.
(() => {
  const root = document.documentElement;
  const page = document.getElementById("page-enrollment-details");
  if (!/\/classes\/\d+/.test(location.pathname) || !page) {
    root.classList.remove("ppui-class-page", "ppui-class-pending");
    return;
  }
  root.classList.add("ppui-class-page");

  const clean = (text) => (text || "").replace(/\s+/g, " ").trim();
  const el = (tag, className, text) => {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Scores already unboxed, kept in this browser so they stay open after the portal marks them read.
  const SEEN_KEY = "ppui-seen-scores";
  let seen = [];
  try {
    seen = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
  } catch (e) {}
  const markSeen = (id) => {
    if (seen.includes(id)) return;
    seen = seen.concat(id).slice(-500);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    } catch (e) {}
  };

  // "66" of "100" -> 66; letter grades and "Complete" have no percentage.
  function percentOf(grade) {
    const raw = parseFloat(clean((grade.querySelector(".raw-score") || {}).textContent));
    const max = parseFloat(clean((grade.querySelector(".max-score") || {}).textContent));
    return isFinite(raw) && isFinite(max) && max > 0 ? Math.round((raw / max) * 1000) / 10 : null;
  }

  const band = (pct) => (pct >= 85 ? "high" : pct >= 70 ? "good" : pct >= 50 ? "fair" : "low");

  function decorate(assignment) {
    if (assignment.dataset.ppui) return;
    assignment.dataset.ppui = "1";
    const grade = assignment.querySelector(".assignment-grade");
    if (!grade) return;
    const pct = percentOf(grade);
    if (pct !== null) {
      grade.dataset.band = band(pct);
      grade.style.setProperty("--pct", String(Math.min(pct, 100)));
      grade.appendChild(el("span", "ppui-pct", pct + "%"));
      assignment.dataset.pct = String(pct);
    } else if (grade.classList.contains("status-0") || /pending/i.test(grade.title)) {
      assignment.classList.add("is-pending");
      const status = grade.querySelector(".status");
      if (status) status.textContent = "Upcoming";
    } else if (grade.querySelector(".raw-score")) {
      grade.dataset.band = "letter";
    }
    // A new score you haven't looked at: sealed behind a "?" until the assignment is opened.
    const id = assignment.dataset.assignmentId;
    if (grade.querySelector(".raw-score") && assignment.classList.contains("unread") && id && !seen.includes(id)) {
      assignment.classList.add("is-sealed");
      const box = el("span", "ppui-mystery", "?");
      box.setAttribute("aria-label", "New score. Open to reveal");
      box.title = "New score. Open to reveal";
      grade.appendChild(box);
      const header = assignment.querySelector(".assignment-header");
      if (header) header.addEventListener("click", () => reveal(assignment), { capture: true, once: true });
    }
  }

  // Unboxing: the "?" wobbles and bursts, then the score pops in and its bar fills.
  function reveal(assignment) {
    if (!assignment.classList.contains("is-sealed")) return;
    markSeen(assignment.dataset.assignmentId);
    const open = () => {
      assignment.classList.remove("is-sealed", "is-revealing");
      assignment.classList.add("is-revealed");
      summarise();
      setTimeout(() => assignment.classList.remove("is-revealed"), 1400);
    };
    if (reduced()) return open();
    assignment.classList.add("is-revealing");
    setTimeout(open, 650);
  }

  // Summary tiles above the list, for the assignments it shows now (filters change that).
  // Sealed scores stay out of the average until they've been revealed.
  const summary = el("div", "ppui-summary");
  summary.setAttribute("aria-label", "Summary");

  function tile(label, value, note, extraClass) {
    const t = el("div", "ppui-summary-tile" + (extraClass ? " " + extraClass : ""));
    t.append(el("span", "ppui-summary-label", label), el("span", "ppui-summary-value", value));
    if (note) t.appendChild(el("span", "ppui-summary-note", note));
    return t;
  }

  function summarise() {
    const all = [...page.querySelectorAll(".assignment-list .assignment")].filter((a) => !/\{\{/.test(a.className));
    const open = all.filter((a) => !a.classList.contains("is-sealed"));
    const sealed = all.length - open.length;
    const scores = open.map((a) => parseFloat(a.dataset.pct)).filter((n) => isFinite(n));
    const upcoming = all.filter((a) => a.classList.contains("is-pending")).length;
    const graded = all.filter((a) => a.querySelector(".raw-score")).length;
    const tiles = [];
    if (scores.length) {
      const avg = Math.round((scores.reduce((n, s) => n + s, 0) / scores.length) * 10) / 10;
      const note = "across " + scores.length + (scores.length === 1 ? " score" : " scores") + (sealed ? ", " + sealed + " to reveal" : "");
      const avgTile = tile("Average", avg + "%", note, "is-average");
      avgTile.dataset.band = band(avg);
      avgTile.style.setProperty("--pct", String(Math.min(avg, 100)));
      tiles.push(avgTile, tile("Best", Math.max(...scores) + "%"));
    }
    tiles.push(tile("Graded", String(graded), "of " + all.length));
    if (sealed) tiles.push(tile("New", String(sealed), sealed === 1 ? "score to reveal" : "scores to reveal", "is-new"));
    else tiles.push(tile("Upcoming", String(upcoming), upcoming ? "still to do" : "nothing due", upcoming ? "is-busy" : ""));
    summary.replaceChildren(...tiles);
  }

  let queued = false;
  function refresh() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      page.querySelectorAll(".assignment-list .assignment").forEach(decorate);
      const list = page.querySelector(".assignment-list");
      if (list && summary.nextElementSibling !== list) list.before(summary);
      summarise();
      root.classList.remove("ppui-class-pending");
    });
  }

  refresh();
  // The portal re-renders the list when a filter or sort changes. (Our own summary changing is ignored.)
  new MutationObserver((records) => {
    if (records.some((r) => !summary.contains(r.target))) refresh();
  }).observe(page, { childList: true, subtree: true });
})();
