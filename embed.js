// Runs inside the embedded old-portal pages (portals-embed.veracross.au). On a class's assignment
// page it adds what the list leaves you to work out: each score as a percentage with a coloured bar,
// upcoming work marked, and a final-grade card above the list. The final grade is weighted:
// end-of-year tests 60%, the average of everything else 40% (both changeable). You can add scores
// the teacher hasn't put up yet, as a fraction ("45/50") or a percentage ("90%").
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
  const button = (className, text) => {
    const b = el("button", className, text);
    b.type = "button";
    return b;
  };
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const r1 = (n) => Math.round(n * 10) / 10;
  const mean = (xs) => (xs.length ? xs.reduce((n, s) => n + s, 0) / xs.length : null);
  const setText = (node, text) => {
    if (node.textContent !== text) node.textContent = text;
  };
  const store = {
    get(key, fallback) {
      try {
        return JSON.parse(localStorage.getItem(key)) || fallback;
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {}
    },
  };

  // The same line icons as the rest of the extension (Lucide shapes, 24px grid).
  const ICONS = {
    plus: ["M5 12h14", "M12 5v14"],
    sliders: ["M21 4h-7", "M10 4H3", "M21 12h-9", "M8 12H3", "M21 20h-5", "M12 20H3", "M14 2v4", "M8 10v4", "M16 18v4"],
    x: ["M18 6 6 18", "m6 6 12 12"],
    more: ["M5 12h.01", "M12 12h.01", "M19 12h.01"],
    sort: ["m21 16-4 4-4-4", "M17 20V4", "m3 8 4-4 4 4", "M7 4v16"],
    external: ["M7 7h10v10", "M7 17 17 7"],
    pencil: ["M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z", "m15 5 4 4"],
    eyeOff: ["M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49", "M14.084 14.158a3 3 0 0 1-4.242-4.242", "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143", "m2 2 20 20"],
    eye: ["M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0", "M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6"],
    trash: ["M3 6h18", "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6", "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"],
  };
  function icon(name) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", "ppui-icon is-" + name);
    ICONS[name].forEach((d) => {
      const p = document.createElementNS(ns, "path");
      p.setAttribute("d", d);
      svg.appendChild(p);
    });
    return svg;
  }

  // Scores already unboxed, kept in this browser so they stay open after the portal marks them read.
  const SEEN_KEY = "ppui-seen-scores";
  let seen = store.get(SEEN_KEY, []);
  if (!Array.isArray(seen)) seen = [];
  const markSeen = (id) => {
    if (seen.includes(id)) return;
    seen = seen.concat(id).slice(-500);
    store.set(SEEN_KEY, seen);
  };

  // Per class: how much end-of-year tests count, assignments moved to another group or left out
  // (marks: "eoy" | "other" | "skip"), your own scores for assignments without one (scores), and
  // scores you added that aren't in the list at all (own), your names for assignments (names) and
  // assignments you've hidden from the list (hidden; they don't count either).
  const DEFAULT_EOY = 60;
  const WEIGHT_KEY = "ppui-grade-weights";
  const classId = (location.pathname.match(/\/classes\/(\d+)/) || [])[1];
  const prefs = Object.assign({ eoy: DEFAULT_EOY, marks: {}, scores: {}, own: [], names: {}, hidden: {}, target: 85 }, store.get(WEIGHT_KEY, {})[classId]);
  ["marks", "scores", "names", "hidden"].forEach((k) => {
    if (!prefs[k] || typeof prefs[k] !== "object") prefs[k] = {};
  });
  if (!Array.isArray(prefs.own)) prefs.own = [];
  const savePrefs = () => {
    const latest = store.get(WEIGHT_KEY, {});
    latest[classId] = prefs;
    store.set(WEIGHT_KEY, latest);
  };

  const EOY_TYPE = /end[\s-]*of[\s-]*year|\bEOY\b/i;
  const typeOf = (a) => clean((a.querySelector(".assignment-type") || {}).textContent);
  const autoBucket = (a) => (EOY_TYPE.test(typeOf(a)) ? "eoy" : "other");
  const bucketOf = (a) => prefs.marks[a.dataset.assignmentId] || autoBucket(a);
  const isHidden = (a) => !!prefs.hidden[a.dataset.assignmentId];
  const BUCKET_NAME = { eoy: "End of year", other: "Other", skip: "Not counted" };

  // "45/50", "4.5 / 5", "90%" or "90" -> a percentage; anything else -> null.
  function parseScore(text) {
    const t = clean(text).replace(",", ".");
    let m = t.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
    let pct = null;
    if (m && parseFloat(m[2]) > 0) pct = (parseFloat(m[1]) / parseFloat(m[2])) * 100;
    else if ((m = t.match(/^(\d+(?:\.\d+)?)\s*%?$/))) pct = parseFloat(m[1]);
    return pct !== null && pct >= 0 && pct <= 150 ? r1(pct) : null;
  }
  const tidyScore = (text) => clean(text).replace(/\s*\/\s*/, "/").replace(/\s*%$/, "%");

  // "66" of "100" -> 66; letter grades and "Complete" have no percentage.
  function percentOf(grade) {
    const raw = parseFloat(clean((grade.querySelector(".raw-score") || {}).textContent));
    const max = parseFloat(clean((grade.querySelector(".max-score") || {}).textContent));
    return isFinite(raw) && isFinite(max) && max > 0 ? Math.round((raw / max) * 1000) / 10 : null;
  }

  const band = (pct) => (pct >= 85 ? "high" : pct >= 70 ? "good" : pct >= 50 ? "fair" : "low");

  // Our buttons inside the portal's list. The portal opens an assignment on a press anywhere in its
  // header, and some of its handlers listen before ours would, so presses on our buttons are caught
  // first, at the window, kept from the portal, and handled here.
  const listActions = new WeakMap();
  const IN_LIST = ".ppui-more, .ppui-mine, .ppui-mine-input";
  ["pointerdown", "mousedown", "touchstart", "mouseup", "pointerup", "click", "dblclick"].forEach((type) =>
    addEventListener(
      type,
      (e) => {
        const target = e.target && e.target.closest ? e.target.closest(IN_LIST) : null;
        if (!target) return;
        e.stopPropagation();
        if (type !== "click") return;
        if (target.tagName !== "INPUT") e.preventDefault();
        const run = listActions.get(target);
        if (!run) return;
        if (popAnchor && popAnchor !== target) closePop();
        run();
      },
      { capture: true, passive: false }
    )
  );

  // Safe to run again: the portal sometimes re-renders parts of an assignment, so each piece is
  // added only where it's missing.
  function decorate(assignment) {
    const grade = assignment.querySelector(".assignment-grade");
    const header = assignment.querySelector(".assignment-header");
    const id = assignment.dataset.assignmentId;
    if (grade && !grade.dataset.ppui) {
      grade.dataset.ppui = "1";
      const pct = percentOf(grade);
      if (pct !== null) {
        grade.dataset.band = band(pct);
        grade.style.setProperty("--pct", String(Math.min(pct, 100)));
        grade.appendChild(el("span", "ppui-pct", pct + "%"));
        assignment.dataset.pct = String(pct);
      } else {
        delete assignment.dataset.pct;
        if (grade.classList.contains("status-0") || /pending/i.test(grade.title)) {
          assignment.classList.add("is-pending");
          const status = grade.querySelector(".status");
          if (status) status.textContent = "Upcoming";
        } else if (grade.querySelector(".raw-score")) {
          grade.dataset.band = "letter";
        }
      }
      // Unmarked work: "+ Score" where the mark would be; tap it to type your own.
      if (pct === null && !grade.querySelector(".raw-score") && id) {
        const mine = button("ppui-mine");
        listActions.set(mine, () => editMine(assignment, mine));
        grade.appendChild(mine);
      }
      // How much of the final grade it is ("worth 6%"), under the score.
      grade.appendChild(el("span", "ppui-share"));

      // A new score you haven't looked at: sealed behind a "?" until the assignment is opened.
      if (grade.querySelector(".raw-score") && assignment.classList.contains("unread") && id && !seen.includes(id)) {
        assignment.classList.add("is-sealed");
      }
      if (assignment.classList.contains("is-sealed")) {
        const box = el("span", "ppui-mystery", "?");
        box.setAttribute("aria-label", "New score. Open to reveal");
        box.title = "New score. Open to reveal";
        grade.appendChild(box);
      }
    }

    if (!header) return;
    // "⋯": what it counts as, rename, hide.
    if (id && !header.querySelector(".ppui-more")) {
      const more = button("ppui-more");
      more.append(icon("more"));
      more.setAttribute("aria-haspopup", "menu");
      more.setAttribute("aria-expanded", "false");
      listActions.set(more, () => openPop(more, () => assignmentPop(assignment, more)));
      header.appendChild(more);
    }
    if (!header.dataset.ppuiReveal) {
      header.dataset.ppuiReveal = "1";
      header.addEventListener("click", () => reveal(assignment), true);
    }
  }

  // ---------- Weighted final grade ----------

  const listed = () => [...page.querySelectorAll(".assignment-list .assignment")].filter((a) => !/\{\{/.test(a.className));

  // A percentage the grade can use: the portal's, else your own. Sealed scores wait to be revealed;
  // hidden ones don't count.
  function pctOf(a) {
    if (a.classList.contains("is-sealed") || isHidden(a)) return null;
    const pct = parseFloat(a.dataset.pct);
    if (isFinite(pct)) return pct;
    const mine = prefs.scores[a.dataset.assignmentId];
    return mine && isFinite(mine.pct) ? mine.pct : null;
  }

  function computeFinal(all) {
    const w = prefs.eoy / 100;
    const eoy = [];
    const other = [];
    const add = (bucket, pct) => {
      if (bucket === "eoy") eoy.push(pct);
      else if (bucket === "other") other.push(pct);
    };
    all.forEach((a) => {
      const pct = pctOf(a);
      if (pct !== null) add(bucketOf(a), pct);
    });
    prefs.own.forEach((o) => add(o.bucket, o.pct));
    const eoyAvg = mean(eoy);
    const otherAvg = mean(other);
    const wE = eoyAvg !== null ? w : 0;
    const wO = otherAvg !== null ? 1 - w : 0;
    const total = wE + wO;
    return {
      w,
      eoy,
      other,
      eoyAvg,
      otherAvg,
      final: total > 0 ? ((eoyAvg || 0) * wE + (otherAvg || 0) * wO) / total : null,
      // A group that counts but has no scores yet: the grade is only "so far".
      partial: (w > 0 && eoyAvg === null) || (w < 1 && otherAvg === null),
    };
  }

  // The card: grade, the liquid bar with your target marked, the two groups and your target (type it
  // right there), then "+ Add score" with the scores you added and the hidden work. The weighting
  // sits behind the one settings button.
  const card = el("section", "ppui-final");
  card.setAttribute("aria-label", "Final grade");
  const P = {};
  (function buildCard() {
    const top = el("div", "ppui-final-top");
    const head = el("div", "ppui-final-head");
    P.label = el("span", "ppui-final-name", "Final grade");
    const valueRow = el("div", "ppui-final-value-row");
    P.value = el("span", "ppui-final-value", "–");
    P.value.tabIndex = 0;
    P.delta = el("span", "ppui-final-delta");
    P.delta.setAttribute("aria-live", "polite");
    valueRow.append(P.value, P.delta);
    head.append(P.label, valueRow);

    const tools = el("div", "ppui-final-tools");
    P.newBtn = button("ppui-new-btn");
    P.newBtn.addEventListener("click", revealAll);
    P.menuBtn = button("ppui-icon-btn");
    P.menuBtn.append(icon("sliders"));
    P.menuBtn.setAttribute("aria-label", "Weighting");
    P.menuBtn.title = "Weighting";
    P.menuBtn.setAttribute("aria-haspopup", "dialog");
    P.menuBtn.setAttribute("aria-expanded", "false");
    P.menuBtn.addEventListener("click", () => openPop(P.menuBtn, weightPop));
    tools.append(P.newBtn, P.menuBtn);
    top.append(head, tools);

    P.bar = el("div", "ppui-liquid");
    P.bar.setAttribute("role", "img");
    const track = el("div", "ppui-liquid-track");
    P.goal = el("span", "ppui-liquid-goal");
    P.bar.append(track, P.goal);
    P.liquid = startLiquid(track);

    const foot = el("div", "ppui-final-foot");
    const groups = el("div", "ppui-groups");
    P.groups = {};
    ["eoy", "other"].forEach((key) => {
      const g = el("span", "ppui-group is-" + key);
      const avg = el("strong");
      g.append(el("i", "ppui-group-dot"), el("span", null, BUCKET_NAME[key]), avg);
      groups.appendChild(g);
      P.groups[key] = { g, avg };
    });

    // Target: a number you type in place, and what the end of year needs for it.
    const aim = el("div", "ppui-aim");
    const field = el("label", "ppui-pct-field ppui-target");
    P.target = el("input", "ppui-pct-input");
    P.target.type = "text";
    P.target.inputMode = "decimal";
    P.target.autocomplete = "off";
    P.target.maxLength = 5;
    P.target.placeholder = "–";
    P.target.setAttribute("aria-label", "Target grade, percent");
    field.append(el("span", "ppui-target-label", "Target"), P.target, el("span", null, "%"));
    P.target.addEventListener("input", () => {
      const v = parseFloat(P.target.value);
      prefs.target = isFinite(v) && v > 0 ? Math.min(100, v) : null;
      savePrefs();
      renderCard(current);
    });
    P.target.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === "Escape") P.target.blur();
    });
    P.target.addEventListener("blur", () => renderCard(current));
    P.need = el("span", "ppui-need");
    aim.append(field, P.need);
    foot.append(groups, aim);

    // Your own scores, and the work you've hidden.
    const own = el("div", "ppui-final-own");
    P.addBtn = button("ppui-add-btn");
    P.addBtn.append(icon("plus"), el("span", null, "Add score"));
    P.addBtn.title = "Add a score that isn't in the list";
    P.addBtn.setAttribute("aria-haspopup", "dialog");
    P.addBtn.setAttribute("aria-expanded", "false");
    P.addBtn.addEventListener("click", () => openPop(P.addBtn, () => ownForm(null)));
    P.own = el("div", "ppui-own");
    P.hiddenBtn = button("ppui-hidden-btn");
    P.hiddenBtn.setAttribute("aria-pressed", "false");
    P.hiddenBtn.addEventListener("click", () => {
      root.classList.toggle("ppui-show-hidden");
      renderHidden();
    });
    own.append(P.addBtn, P.own, P.hiddenBtn);
    card.append(top, P.bar, foot, own);
  })();

  let current = computeFinal([]);
  const targetOf = () => (isFinite(prefs.target) && prefs.target > 0 ? Math.min(prefs.target, 100) : null);

  function renderCard(f) {
    const has = f.final !== null;
    const eoyW = Math.round(f.w * 100);
    setText(P.label, has && f.partial ? "Final grade so far" : "Final grade");
    setText(P.value, has ? r1(f.final) + "%" : "–");
    card.classList.toggle("is-empty", !has);
    if (has) card.dataset.band = band(f.final);
    else delete card.dataset.band;
    const explain = has
      ? eoyW + "% end of year (" + (f.eoyAvg === null ? "none yet" : r1(f.eoyAvg) + "%") + ") + " + (100 - eoyW) + "% other (" + (f.otherAvg === null ? "none yet" : r1(f.otherAvg) + "%") + ")"
      : "No scores yet";
    P.value.title = explain;
    P.value.setAttribute("aria-label", has ? "Final grade " + r1(f.final) + "%. " + explain : explain);

    const target = targetOf();
    if (document.activeElement !== P.target) P.target.value = target === null ? "" : String(r1(target));
    P.liquid.set(has ? f.final / 100 : 0);
    P.goal.hidden = !has || target === null;
    if (target !== null) {
      P.goal.style.left = target + "%";
      P.goal.title = "Target " + target + "%";
    }
    P.bar.setAttribute("aria-label", has ? r1(f.final) + " out of 100" + (target !== null ? ", target " + target : "") : "No grade yet");

    [
      ["eoy", eoyW, f.eoyAvg, f.eoy.length],
      ["other", 100 - eoyW, f.otherAvg, f.other.length],
    ].forEach(([key, weight, avg, n]) => {
      const g = P.groups[key];
      setText(g.avg, avg === null ? "–" : r1(avg) + "%");
      g.g.title = weight + "% of your grade · " + n + (n === 1 ? " score" : " scores");
      g.g.classList.toggle("is-off", weight === 0);
    });

    renderNeed(f);
    renderOwn();
  }

  // What the end of year needs for your target. With n end-of-year scores summing to S, one more
  // scoring X makes the end-of-year average (S+X)/(n+1).
  function needFor(f, t) {
    const n = f.eoy.length;
    const S = f.eoy.reduce((a, b) => a + b, 0);
    const O = f.otherAvg;
    const e = O === null || f.w === 1 ? t : (t - O * (1 - f.w)) / f.w;
    return r1(e * (n + 1) - S);
  }

  function renderNeed(f) {
    const t = targetOf();
    P.need.className = "ppui-need";
    P.need.hidden = f.final === null || f.w === 0 || t === null;
    if (P.need.hidden) return;
    const need = needFor(f, t);
    const where = f.eoy.length ? "next end of year" : "end of year";
    if (need <= 0) {
      P.need.classList.add("is-safe");
      P.need.replaceChildren("On track");
      P.need.title = "You reach " + t + "% whatever you get on the " + where;
    } else {
      P.need.classList.toggle("is-hard", need > 100);
      P.need.replaceChildren("Need ", el("strong", null, need + "%"), " on " + where);
      P.need.title = "For a final grade of " + t + "%" + (need > 100 ? " (more than 100%)" : "");
    }
  }

  // Pills for your own scores; click one to change or delete it. Rebuilt only when they change, so
  // an open dropdown keeps its pill.
  let ownDrawn = "";
  function renderOwn() {
    const key = JSON.stringify(prefs.own);
    if (key === ownDrawn) return;
    ownDrawn = key;
    P.own.replaceChildren(
      ...prefs.own.map((o) => {
        const pill = button("ppui-own-pill");
        pill.dataset.bucket = o.bucket;
        const name = o.name || (o.bucket === "eoy" ? "End of year" : "Score");
        pill.title = BUCKET_NAME[o.bucket] + " · " + o.pct + "% · added by you. Click to change";
        pill.setAttribute("aria-label", name + " " + o.text + ", added by you. Change");
        pill.setAttribute("aria-haspopup", "dialog");
        pill.setAttribute("aria-expanded", "false");
        pill.append(el("i", "ppui-group-dot"), el("span", "ppui-own-name", name), el("strong", null, o.text));
        pill.addEventListener("click", () => openPop(pill, () => ownForm(o)));
        return pill;
      })
    );
  }

  // "2 hidden": shows the work you hid (dimmed), and hides it again.
  function renderHidden() {
    const n = listed().filter(isHidden).length;
    const showing = n > 0 && root.classList.contains("ppui-show-hidden");
    if (!n) root.classList.remove("ppui-show-hidden");
    P.hiddenBtn.hidden = !n;
    P.hiddenBtn.setAttribute("aria-pressed", String(showing));
    P.hiddenBtn.replaceChildren(icon(showing ? "eye" : "eyeOff"), el("span", null, n + " hidden"));
    P.hiddenBtn.title = showing ? "Hide them again" : "Show hidden work";
  }

  // The assignment's name: yours if you renamed it, else the teacher's.
  const descOf = (a) => a.querySelector(".assignment-description");
  const canRename = (a) => {
    const d = descOf(a);
    return !!d && !d.children.length;
  };
  const originalName = (a) => {
    const d = descOf(a);
    if (!d) return "";
    return clean(d.dataset.ppuiOrig !== undefined ? d.dataset.ppuiOrig : d.textContent);
  };
  const nameOf = (a) => prefs.names[a.dataset.assignmentId] || originalName(a) || "Assignment";

  function renderName(a) {
    const d = descOf(a);
    if (!d || d.children.length) return;
    // The portal may change its text itself; anything that isn't what we last wrote is the teacher's.
    if (d.dataset.ppuiOrig === undefined || (d.textContent !== d.dataset.ppuiOrig && d.textContent !== d.dataset.ppuiShown)) {
      d.dataset.ppuiOrig = d.textContent;
    }
    const mine = prefs.names[a.dataset.assignmentId];
    const shown = mine || d.dataset.ppuiOrig;
    d.dataset.ppuiShown = shown;
    setText(d, shown);
    d.classList.toggle("is-renamed", !!mine);
    if (mine) d.title = "Renamed by you. Teacher's name: " + clean(d.dataset.ppuiOrig);
    else d.removeAttribute("title");
  }

  // Each assignment: its name, your own score or "+ Score" on unmarked work, and how much it is worth.
  function renderAssignments(all, f) {
    all.forEach((a) => {
      const id = a.dataset.assignmentId;
      renderName(a);
      const mine = prefs.scores[id];
      const btn = a.querySelector(".ppui-mine");
      if (btn) {
        setText(btn, mine ? mine.text : "+ Score");
        btn.classList.toggle("is-set", !!mine);
        btn.title = mine ? "Your score (" + mine.pct + "%). Click to change" : "Add your own score";
        btn.setAttribute("aria-label", mine ? "Your score " + mine.text + ". Change" : "Add your own score");
      }
      a.classList.toggle("has-mine", !!(btn && mine));
      const hidden = isHidden(a);
      const b = bucketOf(a);
      const counted = pctOf(a) !== null;
      let share = null;
      if (counted && b === "eoy" && f.eoy.length) share = (f.w * 100) / f.eoy.length;
      if (counted && b === "other" && f.other.length) share = ((1 - f.w) * 100) / f.other.length;
      const shareEl = a.querySelector(".ppui-share");
      if (shareEl) {
        setText(shareEl, hidden ? "hidden" : b === "skip" ? "not counted" : share === null ? "" : "worth " + r1(share) + "%");
        shareEl.title = share === null ? "" : r1(share) + "% of your final grade (" + BUCKET_NAME[b].toLowerCase() + ")";
      }
      const more = a.querySelector(".ppui-more");
      if (more) {
        more.dataset.share = share === null ? "" : String(r1(share));
        more.title = "Options";
        more.setAttribute("aria-label", "Options for " + nameOf(a));
      }
      a.classList.toggle("is-hidden", hidden);
      a.classList.toggle("is-skipped", !hidden && b === "skip");
      a.classList.toggle("is-moved", !!prefs.marks[id] || !!prefs.names[id]);
    });
    renderHidden();
  }

  // Typing your own score in place: Enter or leaving the box saves, Esc cancels, empty removes it.
  function editMine(a, btn) {
    const id = a.dataset.assignmentId;
    const mine = prefs.scores[id];
    const input = el("input", "ppui-mine-input");
    input.type = "text";
    input.inputMode = "decimal";
    input.autocomplete = "off";
    input.placeholder = "45/50";
    input.value = mine ? mine.text : "";
    input.setAttribute("aria-label", "Your score, as a fraction or percentage");
    // Keep typing here away from the portal's keyboard handlers.
    ["keydown", "keyup", "keypress"].forEach((t) => input.addEventListener(t, (e) => e.stopPropagation()));
    let done = false;
    const finish = (save) => {
      if (done) return;
      if (save) {
        const v = clean(input.value);
        if (!v) delete prefs.scores[id];
        else {
          const pct = parseScore(v);
          if (pct === null) {
            input.setAttribute("aria-invalid", "true");
            return input.focus();
          }
          prefs.scores[id] = { text: tidyScore(v), pct };
        }
        savePrefs();
      }
      done = true;
      const focused = document.activeElement === input;
      input.remove();
      btn.hidden = false;
      summarise();
      if (focused) btn.focus({ preventScroll: true });
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        finish(true);
      } else if (e.key === "Escape") finish(false);
    });
    input.addEventListener("input", () => input.removeAttribute("aria-invalid"));
    // Leaving the box saves, unless what's typed can't be read (then it's dropped).
    input.addEventListener("blur", () => finish(parseScore(input.value) !== null || !clean(input.value)));
    btn.hidden = true;
    btn.after(input);
    input.focus();
    input.select();
  }

  // ---------- Popovers (one at a time, styled like the portal's dropdowns) ----------
  // The dropdown sits in the browser's top layer (the popover API), so nothing on the page can cover
  // or clip it, and it's placed with fixed, on-screen coordinates taken from its button. That keeps
  // it beside the button whichever element is scrolling. Placement rules, in order:
  //   1. below the button, lined up with its left edge (its right edge if that runs off the side);
  //   2. if it doesn't fit below, above, when it fits there;
  //   3. if it fits on neither side, the side with more room, scrolling inside;
  //   4. kept on screen (8px from every edge), and placed again on scroll, resize and new content.

  const GAP = 8;
  const EDGE = 8;
  const pop = el("div", "ppui-pop");
  pop.setAttribute("role", "dialog");
  pop.hidden = true;
  const topLayer = typeof pop.showPopover === "function";
  if (topLayer) pop.popover = "manual";
  let popAnchor = null;

  function openPop(anchor, build) {
    if (popAnchor === anchor && !pop.hidden) return closePop();
    closePop();
    popAnchor = anchor;
    show(build);
    anchor.setAttribute("aria-expanded", "true");
  }

  // Fill the open dropdown (also used to swap in another view, like Rename).
  function show(build) {
    pop.replaceChildren(...[].concat(build()));
    if (!pop.isConnected) document.body.appendChild(pop);
    pop.hidden = false;
    if (topLayer && !pop.matches(":popover-open")) pop.showPopover();
    place();
    const first = pop.querySelector("[data-autofocus], input:not([type=range]), [aria-checked=true], button");
    if (first) {
      first.focus({ preventScroll: true });
      if (first.select && first.value) first.select();
    }
  }

  function place() {
    if (pop.hidden || !popAnchor) return;
    if (!popAnchor.isConnected) return closePop();
    const r = popAnchor.getBoundingClientRect();
    const vw = root.clientWidth;
    const vh = innerHeight;
    // The button scrolled out of sight or isn't shown at all (its row hidden): the dropdown goes too.
    if ((!r.width && !r.height) || r.bottom < 0 || r.top > vh) return closePop();

    pop.style.maxHeight = "";
    const w = Math.min(pop.offsetWidth, vw - EDGE * 2);
    let h = pop.offsetHeight;

    const below = vh - r.bottom - GAP - EDGE;
    const above = r.top - GAP - EDGE;
    const side = h <= below ? "below" : h <= above ? "above" : below >= above ? "below" : "above";
    const room = side === "below" ? below : above;
    if (h > room) {
      h = Math.max(room, 120);
      pop.style.maxHeight = h + "px";
    }
    let top = side === "below" ? r.bottom + GAP : r.top - GAP - h;
    top = Math.min(Math.max(top, EDGE), vh - EDGE - h);

    let left = r.left + w <= vw - EDGE ? r.left : r.right - w;
    left = Math.min(Math.max(left, EDGE), vw - EDGE - w);

    pop.dataset.side = side;
    pop.style.left = Math.round(left) + "px";
    pop.style.top = Math.round(top) + "px";
  }

  function closePop() {
    if (pop.hidden) return;
    pop.hidden = true;
    if (topLayer && pop.matches(":popover-open")) pop.hidePopover();
    if (popAnchor) {
      popAnchor.setAttribute("aria-expanded", "false");
      if (pop.contains(document.activeElement) && popAnchor.isConnected) popAnchor.focus({ preventScroll: true });
    }
    popAnchor = null;
  }

  document.addEventListener("click", (e) => {
    // A click that swapped the dropdown's contents leaves its target detached: that was inside.
    if (!e.target.isConnected) return;
    if (!pop.hidden && !pop.contains(e.target) && !(popAnchor && popAnchor.contains(e.target))) closePop();
  });
  document.addEventListener("keydown", (e) => {
    if (pop.hidden) return;
    if (e.key === "Escape") return closePop();
    const items = [...pop.querySelectorAll(".ppui-pop-item")];
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && items.includes(document.activeElement)) {
      const i = items.indexOf(document.activeElement);
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
      e.preventDefault();
    }
  });
  // Any scrolling element (capture catches ones that don't bubble), the window, and the dropdown's own
  // size changing (a new view, a row appearing) all move it back into place.
  let placing = 0;
  const placeSoon = (e) => {
    if (pop.hidden || (e && e.target && e.target.nodeType === 1 && pop.contains(e.target))) return;
    cancelAnimationFrame(placing);
    placing = requestAnimationFrame(place);
  };
  document.addEventListener("scroll", placeSoon, { capture: true, passive: true });
  addEventListener("resize", placeSoon);
  if (window.ResizeObserver) new ResizeObserver(() => placeSoon()).observe(pop);

  // A text box with its label above it.
  function field(label, input) {
    const wrap = el("label", "ppui-label");
    wrap.append(el("span", null, label), input);
    return wrap;
  }

  function textInput(value, placeholder) {
    const input = el("input", "ppui-field");
    input.type = "text";
    input.autocomplete = "off";
    input.placeholder = placeholder || "";
    input.value = value || "";
    input.addEventListener("input", () => input.removeAttribute("aria-invalid"));
    return input;
  }

  function segmented(options, value, onChange) {
    const seg = el("div", "ppui-seg");
    seg.setAttribute("role", "radiogroup");
    options.forEach(([v, label]) => {
      const b = button("ppui-seg-btn", label);
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(v === value));
      b.addEventListener("click", () => {
        seg.querySelectorAll(".ppui-seg-btn").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
        onChange(v);
      });
      seg.appendChild(b);
    });
    return seg;
  }

  const popTitle = (text, sub) => {
    const t = el("div", "ppui-pop-title", text);
    if (sub) t.appendChild(el("span", "ppui-pop-sub", sub));
    return t;
  };

  // Buttons along the bottom of a form: an optional quiet one on the left, then the main one.
  function formButtons(main, quiet) {
    const row = el("div", "ppui-pop-actions");
    if (quiet) row.appendChild(quiet);
    const go = el("button", "ppui-btn is-primary", main);
    go.type = "submit";
    row.appendChild(go);
    return row;
  }

  // Weighting: how much end-of-year tests count, and going back to 60 / 40.
  function weightPop() {
    const view = el("div", "ppui-pop-form");
    const ends = el("div", "ppui-split-ends");
    const left = el("span");
    const right = el("span");
    ends.append(left, right);
    const slider = el("input", "ppui-range");
    slider.type = "range";
    slider.min = "0";
    slider.max = "100";
    slider.step = "5";
    slider.setAttribute("aria-label", "End-of-year weighting");
    const reset = button("ppui-pop-item", "Reset to 60 / 40");
    const sync = () => {
      slider.value = String(prefs.eoy);
      slider.style.setProperty("--fill", prefs.eoy + "%");
      slider.setAttribute("aria-valuetext", "End of year " + prefs.eoy + "%, other " + (100 - prefs.eoy) + "%");
      left.replaceChildren("End of year ", el("strong", null, prefs.eoy + "%"));
      right.replaceChildren("Other ", el("strong", null, 100 - prefs.eoy + "%"));
      reset.hidden = prefs.eoy === DEFAULT_EOY && !Object.keys(prefs.marks).length;
    };
    slider.addEventListener("input", () => {
      prefs.eoy = parseInt(slider.value, 10);
      savePrefs();
      sync();
      summarise();
    });
    reset.title = "Back to 60 / 40, and every assignment back to its own group";
    reset.addEventListener("click", () => {
      prefs.eoy = DEFAULT_EOY;
      prefs.marks = {};
      savePrefs();
      sync();
      summarise();
    });
    const list = el("div", "ppui-pop-list");
    list.appendChild(reset);
    sync();
    view.append(popTitle("Weighting"), ends, slider, list);
    return view;
  }

  // Add a score that isn't in the list, or change or delete one you added.
  function ownForm(o) {
    let bucket = o ? o.bucket : "eoy";
    const form = el("form", "ppui-pop-form");
    const name = textInput(o && o.name, "e.g. Paper 1");
    name.maxLength = 40;
    const score = textInput(o && o.text, "45/50 or 90%");
    score.inputMode = "decimal";
    if (!o) score.dataset.autofocus = "";
    const seg = segmented(
      [
        ["eoy", "End of year"],
        ["other", "Other"],
      ],
      bucket,
      (v) => (bucket = v)
    );
    let del = null;
    if (o) {
      del = button("ppui-btn is-quiet");
      del.append(icon("trash"), el("span", null, "Delete"));
      del.addEventListener("click", () => {
        prefs.own = prefs.own.filter((p) => p.id !== o.id);
        savePrefs();
        closePop();
        summarise();
      });
    }
    form.append(popTitle(o ? "Your score" : "Add a score"), field("Score", score), field("Name", name), seg, formButtons(o ? "Save" : "Add", del));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const pct = parseScore(score.value);
      if (pct === null) {
        score.setAttribute("aria-invalid", "true");
        return score.focus();
      }
      const entry = { id: o ? o.id : Date.now().toString(36), name: clean(name.value), text: tidyScore(score.value), pct, bucket };
      prefs.own = o ? prefs.own.map((p) => (p.id === o.id ? entry : p)) : prefs.own.concat(entry);
      savePrefs();
      closePop();
      summarise();
    });
    return form;
  }

  // "⋯" on an assignment: what it counts as, then rename and hide.
  function assignmentPop(a, anchor) {
    const id = a.dataset.assignmentId;
    const hidden = isHidden(a);
    const sub = hidden ? "Hidden, not counted" : anchor.dataset.share ? "Worth " + anchor.dataset.share + "% of your grade" : bucketOf(a) === "skip" ? "Not counted" : "";
    const chosen = bucketOf(a);
    const auto = autoBucket(a);
    const list = el("div", "ppui-pop-list");
    list.setAttribute("role", "radiogroup");
    list.setAttribute("aria-label", "Counts as");
    ["eoy", "other", "skip"].forEach((value) => {
      const item = button("ppui-pop-item", BUCKET_NAME[value]);
      item.setAttribute("role", "radio");
      item.setAttribute("aria-checked", String(value === chosen));
      item.addEventListener("click", () => {
        if (value === auto) delete prefs.marks[id];
        else prefs.marks[id] = value;
        savePrefs();
        closePop();
        summarise();
      });
      list.appendChild(item);
    });

    const tools = el("div", "ppui-pop-list");
    if (canRename(a)) {
      const rename = button("ppui-pop-item");
      rename.append(icon("pencil"), el("span", null, "Rename"));
      rename.addEventListener("click", () => show(() => renameForm(a)));
      tools.appendChild(rename);
    }
    const hide = button("ppui-pop-item");
    hide.append(icon(hidden ? "eye" : "eyeOff"), el("span", null, hidden ? "Show in list" : "Hide"));
    hide.addEventListener("click", () => {
      if (hidden) delete prefs.hidden[id];
      else prefs.hidden[id] = 1;
      savePrefs();
      closePop();
      summarise();
    });
    tools.appendChild(hide);
    return [popTitle(nameOf(a), sub), list, tools];
  }

  function renameForm(a) {
    const id = a.dataset.assignmentId;
    const form = el("form", "ppui-pop-form");
    const input = textInput(nameOf(a), originalName(a));
    input.maxLength = 80;
    let reset = null;
    if (prefs.names[id]) {
      reset = button("ppui-btn is-quiet", "Undo");
      reset.title = "Back to " + originalName(a);
      reset.addEventListener("click", () => {
        delete prefs.names[id];
        savePrefs();
        closePop();
        summarise();
      });
    }
    form.append(popTitle("Rename"), input, formButtons("Save", reset));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = clean(input.value);
      if (!v || v === originalName(a)) delete prefs.names[id];
      else prefs.names[id] = v;
      savePrefs();
      closePop();
      summarise();
    });
    return form;
  }

  // ---------- The grade bar as liquid ----------
  // The same liquid as the home page's day bar (startLiquid in content.js), on one track: slowly
  // flowing colour from the colour theme's crest and sky, a sheen that gives off light, and a glass
  // droplet on the front. It pours in once, then flows on to each new grade. Frames run only while
  // the bar is on screen and something is moving; the pointer swells it as on the home page.
  function startLiquid(track) {
    const liquid = el("canvas", "ppui-liquid-fill");
    const glow = el("canvas", "ppui-liquid-glow");
    const drop = el("span", "ppui-liquid-drop");
    for (const node of [liquid, glow, drop]) node.setAttribute("aria-hidden", "true");
    track.append(glow, liquid, drop);
    const field = document.createElement("canvas");
    const fctx = field.getContext("2d");
    const efield = document.createElement("canvas");
    const ectx = efield.getContext("2d");
    const emit = document.createElement("canvas");
    const lctx = liquid.getContext("2d");
    const mctx = emit.getContext("2d");
    const gctx = glow.getContext("2d");
    const GP = 30;
    const POUR_MS = 1300;
    const FLOW_MS = 32;
    const BLOOM = [[3, 0.8], [7, 0.6], [12, 0.4]];

    const perm = new Uint8Array(512);
    {
      const p = [...Array(256).keys()];
      let s = 7;
      for (let i = 255; i > 0; i--) {
        s = (s * 16807) % 2147483647;
        const j = s % (i + 1);
        [p[i], p[j]] = [p[j], p[i]];
      }
      for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    }
    const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    function noise(x, y) {
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      const u = smooth(x - xi);
      const v = smooth(y - yi);
      const left = perm[xi & 255];
      const right = perm[(xi + 1) & 255];
      const a = perm[(left + yi) & 511] / 255;
      const b = perm[(right + yi) & 511] / 255;
      const c = perm[(left + yi + 1) & 511] / 255;
      const d = perm[(right + yi + 1) & 511] / 255;
      const top = a + (b - a) * u;
      return top + (c + (d - c) * u - top) * v;
    }

    const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
    function rgb(value) {
      const s = (value || "").trim();
      let h = s.match(/^#([\da-f])([\da-f])([\da-f])$/i);
      if (h) return h.slice(1).map((v) => parseInt(v + v, 16));
      h = s.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})/i);
      if (h) return h.slice(1).map((v) => parseInt(v, 16));
      const r = s.match(/[\d.]+/g);
      return r && r.length >= 3 ? r.slice(0, 3).map(Number) : null;
    }
    function rotateHue([r, g, b], deg) {
      r /= 255;
      g /= 255;
      b /= 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / 2;
      let h = 0;
      let s = 0;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        h = (max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4) / 6;
      }
      h = (h + deg / 360 + 1) % 1;
      const f = (p, q, t) => {
        t = (t + 1) % 1;
        return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255];
    }
    let hues, deep, pale;
    let stale = true;
    function readPalette() {
      const cs = getComputedStyle(root);
      const accent = rgb(cs.getPropertyValue("--e-accent")) || [20, 70, 160];
      const crest = rgb(cs.getPropertyValue("--e-theme-crest")) || mix(accent, [8, 6, 30], 0.35);
      const sky = rgb(cs.getPropertyValue("--e-sky")) || mix(accent, [255, 255, 255], 0.25);
      hues = Float64Array.from([rotateHue(sky, -42), mix(crest, sky, 0.55), sky, rotateHue(sky, 34), rotateHue(sky, 62)].flat());
      deep = mix(crest, [8, 6, 30], 0.3);
      pale = mix(sky, [255, 255, 255], 0.78);
      track.style.setProperty("--e-drop-sky", "rgb(" + sky.map(Math.round).join(",") + ")");
      track.style.setProperty("--e-drop-crest", "rgb(" + crest.map(Math.round).join(",") + ")");
      stale = true;
    }

    let W = 0;
    let H = 0;
    let dpr = 1;
    let img = null;
    let eimg = null;
    let swells = null;
    let gloss = null;
    function resize(canvas, w, h) {
      if (canvas.width === w && canvas.height === h) return false;
      canvas.width = w;
      canvas.height = h;
      return true;
    }
    function layout() {
      W = track.clientWidth;
      H = track.clientHeight;
      if (!W || !H) return;
      dpr = Math.min((window.devicePixelRatio || 1) * 2, 6);
      resize(liquid, Math.round(W * dpr), Math.round(H * dpr));
      resize(emit, liquid.width, liquid.height);
      resize(glow, Math.round((W + GP * 2) * dpr), Math.round((H + GP * 2) * dpr));
      const fw = Math.max(Math.ceil(W / 1.5), 8);
      const grew = resize(field, fw, 12);
      if (resize(efield, fw, 12) || grew || !img) {
        img = fctx.createImageData(fw, 12);
        eimg = ectx.createImageData(fw, 12);
        swells = new Float64Array(fw);
      }
      gloss = lctx.createLinearGradient(0, 0, 0, H);
      gloss.addColorStop(0, "rgba(255,255,255,.42)");
      gloss.addColorStop(0.3, "rgba(255,255,255,.05)");
      gloss.addColorStop(0.6, "rgba(255,255,255,0)");
      gloss.addColorStop(1, "rgba(0,0,0,.16)");
      stale = true;
    }
    // The filled part: a pill from the left up to the front.
    function fillPath(ctx, edgeX) {
      ctx.beginPath();
      const w = Math.min(Math.max(edgeX, 0), W);
      if (w <= 0.5) return;
      const r = Math.min(H / 2, w / 2);
      ctx.moveTo(r, 0);
      ctx.lineTo(w - r, 0);
      ctx.arcTo(w, 0, w, r, r);
      ctx.arcTo(w, H, w - r, H, r);
      ctx.lineTo(r, H);
      ctx.arcTo(0, H, 0, H - r, r);
      ctx.arcTo(0, 0, r, 0, r);
      ctx.closePath();
    }

    let target = 0;
    let reveal = 0;
    let pourFrom = 0;
    let pourStart = -1e9;
    const pointer = { x: -999, on: 0, target: 0 };
    const ds = { x: 0, vx: 0, sx: 1, vsx: 0, lean: 0, vlean: 0, landed: true };

    function drawField(t, edgeX) {
      const fw = field.width;
      const fh = field.height;
      const d = img.data;
      const e = eimg.data;
      const span = Math.max(edgeX, 40);
      const lastStop = hues.length / 3 - 1;
      const px = (pointer.x / W) * fw;
      for (let x = 0; x < fw; x++) {
        const dx = (x - px) / (fw * 0.08);
        swells[x] = pointer.on ? Math.exp(-dx * dx) * pointer.on : 0;
      }
      let i = 0;
      for (let y = 0; y < fh; y++) {
        const yy = y / (fh - 1);
        for (let x = 0; x < fw; x++, i += 4) {
          const u = (x / fw) * 3.4;
          const along = ((x / fw) * W) / span;
          const w1 = noise(u * 0.7 + t * 0.09, yy * 0.9 + t * 0.05) * 2.4;
          const w2 = noise(u * 1.1 - t * 0.07 + w1 * 0.8 + 3.1, yy * 1.3 + w1 * 0.5) * 1.8;
          const hue = noise(u * 0.55 + w2 * 0.9 - t * 0.12 + 9.4, yy * 1.2 + w1 * 0.4) * 1.5 - 0.25;
          const band = Math.sin((u * 0.9 + w2) * 1.9 - t * 0.55 + yy * 2.2);
          const lip = Math.max(0, 1 - Math.abs(band) * 1.7);
          const ridge = lip * lip * lip;
          const swell = swells[x];
          const depth = ((noise(u * 0.9 + w1 - t * 0.16, yy * 1.4 + w2 * 0.6) - 0.25) / 0.5) * 0.75 +
            (along - 0.5) * 0.3 + 0.02 + swell * 0.3 + ridge * 0.18;
          const h = Math.min(Math.max(hue, 0), 1) * lastStop;
          const stop = Math.min(Math.floor(h), lastStop - 1);
          const k = stop * 3;
          const f = h - stop;
          const r = hues[k] + (hues[k + 3] - hues[k]) * f;
          const g = hues[k + 1] + (hues[k + 4] - hues[k + 1]) * f;
          const b = hues[k + 2] + (hues[k + 5] - hues[k + 2]) * f;
          if (depth < 0.5) {
            const m = Math.max(depth, 0) / 0.5;
            d[i] = deep[0] + (r - deep[0]) * m;
            d[i + 1] = deep[1] + (g - deep[1]) * m;
            d[i + 2] = deep[2] + (b - deep[2]) * m;
          } else {
            const m = Math.min((depth - 0.5) / 0.5, 1) * 0.6;
            d[i] = r + (pale[0] - r) * m;
            d[i + 1] = g + (pale[1] - g) * m;
            d[i + 2] = b + (pale[2] - b) * m;
          }
          d[i + 3] = 255;
          e[i] = r + (255 - r) * 0.12;
          e[i + 1] = g + (255 - g) * 0.12;
          e[i + 2] = b + (255 - b) * 0.12;
          e[i + 3] = Math.min(1, ridge * 0.85 + Math.max(depth - 0.7, 0) * 1.4 + swell * 0.5) * 255;
        }
      }
      fctx.putImageData(img, 0, 0);
      ectx.putImageData(eimg, 0, 0);
    }

    function draw(edgeX) {
      const ctx = lctx;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.save();
      fillPath(ctx, edgeX);
      ctx.clip();
      ctx.drawImage(field, 0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.35;
      ctx.filter = "blur(1.5px)";
      ctx.drawImage(efield, 0, 0, W, H);
      ctx.filter = "none";
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = gloss;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      mctx.clearRect(0, 0, W, H);
      mctx.save();
      fillPath(mctx, edgeX);
      mctx.clip();
      mctx.drawImage(efield, 0, 0, W, H);
      mctx.restore();
      gctx.setTransform(1, 0, 0, 1, 0, 0);
      gctx.clearRect(0, 0, glow.width, glow.height);
      gctx.globalCompositeOperation = "lighter";
      for (const [blur, alpha] of BLOOM) {
        gctx.filter = "blur(" + blur * dpr + "px)";
        gctx.globalAlpha = alpha;
        gctx.drawImage(emit, GP * dpr, GP * dpr);
      }
      gctx.filter = "none";
      gctx.globalAlpha = 1;
      gctx.globalCompositeOperation = "source-over";
    }

    function springs(dt, edgeX) {
      ds.vx += ((edgeX - ds.x) * 260 - ds.vx * 18) * dt;
      ds.x += ds.vx * dt;
      let lean = 0;
      if (pointer.on > 0.01) {
        const d = pointer.x - edgeX;
        lean = Math.max(-1, Math.min(1, d / 60)) * Math.exp(-Math.abs(d) / 140) * pointer.on;
      }
      ds.vlean += ((lean - ds.lean) * 120 - ds.vlean * 14) * dt;
      ds.lean += ds.vlean * dt;
      ds.vsx += ((1 + Math.min(Math.abs(ds.vx) / 900, 0.35) - ds.sx) * 340 - ds.vsx * 11) * dt;
      ds.sx += ds.vsx * dt;
    }
    function stepDrop(elapsed, edgeX, arriving, now) {
      for (let left = elapsed; left > 0; left -= 1 / 120) springs(Math.min(left, 1 / 120), edgeX);
      if (!arriving && !ds.landed) {
        ds.landed = true;
        ds.vsx -= 4.5;
      }
      const sx = ds.sx + Math.abs(ds.lean) * 0.12 + Math.sin(now / 900) * 0.025;
      const sy = 1 / Math.max(sx, 0.7);
      drop.style.transform = "translateX(" + (ds.x + ds.lean * 4).toFixed(2) + "px) scale(" + sx.toFixed(3) + ", " + sy.toFixed(3) + ")";
    }

    let raf = 0;
    let last = 0;
    let flowed = -1e9;
    let drawnEdge = -1;
    let onScreen = true;
    const live = () => onScreen && !document.hidden;
    function frame(now) {
      raf = 0;
      if (!W) return;
      const still = reduced();
      const dt = Math.min(Math.max((now - last) / 1000, 0), 0.25);
      last = now;
      const p = still ? 1 : Math.min(Math.max((now - pourStart) / POUR_MS, 0), 1);
      reveal = pourFrom + (target - pourFrom) * (1 - Math.pow(1 - p, 3.2));
      pointer.on += (pointer.target - pointer.on) * Math.min(dt * 6, 1);
      if (!pointer.target && pointer.on < 0.001) pointer.on = 0;
      const edgeX = reveal * W;
      const flow = stale || still || now - flowed >= FLOW_MS;
      if (flow) {
        flowed = now;
        drawField(still ? 3 : now / 1000, edgeX);
      }
      if (flow || edgeX !== drawnEdge) {
        drawnEdge = edgeX;
        draw(edgeX);
      }
      stale = false;
      if (still) drop.style.transform = "translateX(" + edgeX.toFixed(2) + "px)";
      else stepDrop(dt, edgeX, p < 1, now);
      if (drop.hidden !== edgeX < 1) drop.hidden = edgeX < 1;
      if (live() && !still) raf = requestAnimationFrame(frame);
    }
    function kick() {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    readPalette();
    new MutationObserver(() => {
      readPalette();
      kick();
    }).observe(root, { attributes: true, attributeFilter: ["data-ppui-theme", "style"] });
    new ResizeObserver(() => {
      layout();
      kick();
    }).observe(track);
    new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) kick();
    }).observe(track);
    document.addEventListener("visibilitychange", () => {
      if (live()) kick();
    });
    track.addEventListener("pointermove", (e) => {
      pointer.x = e.clientX - track.getBoundingClientRect().left;
      pointer.target = 1;
      kick();
    });
    track.addEventListener("pointerleave", () => {
      pointer.target = 0;
      kick();
    });

    let first = true;
    return {
      // Pour in the first time; afterwards flow on from where it is.
      set(frac) {
        frac = Math.max(0, Math.min(1, frac));
        if (frac === target && !first) return;
        pourFrom = first ? 0 : reveal;
        if (first) ds.landed = false;
        first = false;
        pourStart = performance.now();
        target = frac;
        requestAnimationFrame(() => {
          layout();
          kick();
        });
      },
    };
  }

  // ---------- Unboxing ----------

  // Box shakes, its lid flies off and it glows in the score's colour; then the score counts up,
  // light spins out behind it and sparks fly (more for a great score, none for a poor one).
  function reveal(assignment) {
    if (!assignment.classList.contains("is-sealed") || assignment.classList.contains("is-revealing")) return;
    markSeen(assignment.dataset.assignmentId);
    const grade = assignment.querySelector(".assignment-grade");
    const before = current.final;
    const open = () => {
      assignment.classList.remove("is-sealed", "is-revealing");
      assignment.classList.add("is-revealed");
      summarise();
      showDelta(before);
      if (!reduced() && grade) {
        burst(grade);
        countUp(assignment, grade);
      }
      setTimeout(() => assignment.classList.remove("is-revealed"), 1600);
    };
    if (reduced()) return open();
    assignment.classList.add("is-revealing");
    setTimeout(open, 620);
  }

  function countUp(assignment, grade) {
    const targets = [
      [grade.querySelector(".raw-score"), ""],
      [grade.querySelector(".ppui-pct"), "%"],
    ]
      .filter(([node]) => node)
      .map(([node, suffix]) => {
        const original = node.textContent;
        const value = parseFloat(clean(original));
        const decimals = (clean(original).replace(/%$/, "").split(".")[1] || "").length;
        return { node, original, value, decimals, suffix };
      })
      .filter((t) => isFinite(t.value));
    if (!targets.length) return;
    assignment.classList.add("is-counting");
    const start = performance.now();
    const duration = 800;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      targets.forEach((t) => {
        t.node.textContent = p < 1 ? (t.value * eased).toFixed(t.decimals) + t.suffix : t.original;
      });
      if (p < 1) requestAnimationFrame(tick);
      else assignment.classList.remove("is-counting");
    };
    requestAnimationFrame(tick);
  }

  // Sparks and light, in a layer over the page so the card doesn't clip them.
  function burst(grade) {
    const anchor = grade.querySelector(".raw-score") || grade;
    const rect = anchor.getBoundingClientRect();
    const level = grade.dataset.band || "letter";
    const colour = getComputedStyle(grade).getPropertyValue("--band").trim() || "currentColor";
    const fx = el("div", "ppui-fx is-" + level);
    fx.setAttribute("aria-hidden", "true");
    fx.style.left = rect.left + rect.width / 2 + "px";
    fx.style.top = rect.top + rect.height / 2 + "px";
    fx.style.setProperty("--c", colour);
    fx.append(el("span", "ppui-fx-ring"));
    if (level !== "low") fx.append(el("span", "ppui-fx-rays"));
    const count = { high: 22, good: 14, fair: 8, letter: 12 }[level] || 0;
    for (let i = 0; i < count; i++) {
      const p = el("span", "ppui-fx-p" + (level === "high" && i % 3 === 0 ? " is-star" : ""));
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const dist = 34 + Math.random() * (level === "high" ? 46 : 30);
      p.style.setProperty("--dx", Math.cos(angle) * dist + "px");
      p.style.setProperty("--dy", Math.sin(angle) * dist + "px");
      p.style.setProperty("--s", (0.6 + Math.random() * 0.8).toFixed(2));
      p.style.setProperty("--d", Math.round(Math.random() * 90) + "ms");
      fx.append(p);
    }
    document.body.appendChild(fx);
    setTimeout(() => fx.remove(), 1400);
  }

  // How much the final grade just moved; several reveals in a row add up.
  let deltaBase = null;
  let deltaTimer = 0;
  function showDelta(before) {
    if (deltaBase === null) deltaBase = before;
    const after = current.final;
    clearTimeout(deltaTimer);
    if (deltaBase === null || after === null) {
      P.delta.className = "ppui-final-delta";
      P.delta.textContent = "";
      deltaBase = null;
      return;
    }
    const diff = r1(after - deltaBase);
    P.delta.textContent = (diff > 0 ? "+" : diff < 0 ? "−" : "±") + Math.abs(diff) + "%";
    P.delta.className = "ppui-final-delta is-shown " + (diff > 0 ? "is-up" : diff < 0 ? "is-down" : "is-flat");
    deltaTimer = setTimeout(() => {
      P.delta.className = "ppui-final-delta";
      deltaBase = null;
    }, 2600);
  }

  function revealAll() {
    listed()
      .filter((a) => a.classList.contains("is-sealed") && !isHidden(a))
      .forEach((a, i) => setTimeout(() => reveal(a), reduced() ? 0 : i * 320));
  }

  // ---------- Around the list ----------

  // Filters: only All and New stay (Notifications, Feedback and Problems go). Sort: one button that
  // says how the list is sorted and switches to the other order.
  function tidyToolbar() {
    const bar = document.querySelector(".section-toolbar");
    if (!bar) return;
    bar.querySelectorAll(".left-controls a").forEach((a) => {
      const t = clean(a.textContent);
      if (/notification|feedback|problem/i.test(t)) a.classList.add("ppui-hide");
      else if (!a.children.length && /^all assignments$/i.test(t)) a.textContent = "All";
      else if (!a.children.length && /^new updates$/i.test(t)) a.textContent = "New";
    });
    const right = bar.querySelector(".right-controls");
    const links = right ? [...right.querySelectorAll("a")] : [];
    if (links.length < 2) return;
    let sort = right.querySelector(".ppui-sort");
    if (!sort) {
      sort = button("ppui-sort");
      sort.append(icon("sort"), el("span"));
      sort.addEventListener("click", () => {
        const all = [...right.querySelectorAll("a")];
        const next = all.find((a) => !a.classList.contains("active")) || all[0];
        if (next) next.click();
        setTimeout(tidyToolbar, 60);
      });
      right.appendChild(sort);
      right.classList.add("has-sort");
    }
    const active = links.find((a) => a.classList.contains("active")) || links[0];
    const other = links.find((a) => a !== active);
    setText(sort.lastChild, clean(active.textContent));
    sort.title = "Sorted by " + clean(active.textContent).toLowerCase() + ". Click for " + clean(other.textContent).toLowerCase();
  }

  // Class title: the teacher's name goes; the class website becomes a small icon beside the name.
  function tidyTitle() {
    const site = document.querySelector(".enrollment-title .class-website");
    if (site && !site.querySelector(".ppui-icon")) {
      site.prepend(icon("external"));
      site.title = "Class website";
      site.setAttribute("aria-label", "Class website");
    }
  }

  // Each week's heading shows that week's average.
  function weekAverages() {
    page.querySelectorAll(".group-header").forEach((h) => {
      const next = h.nextElementSibling;
      const list = next && next.classList.contains("group-list") ? next : h.parentElement && h.parentElement.querySelector(".group-list");
      if (!list) return;
      const pcts = [...list.querySelectorAll(".assignment")].filter((a) => bucketOf(a) !== "skip").map(pctOf).filter((p) => p !== null);
      let tag = h.querySelector(".ppui-week-avg");
      if (!tag) {
        tag = el("span", "ppui-week-avg");
        h.appendChild(tag);
      }
      const avg = mean(pcts);
      setText(tag, avg === null ? "" : r1(avg) + "%");
      tag.title = avg === null ? "" : "Average of " + pcts.length + (pcts.length === 1 ? " score" : " scores");
      if (avg === null) delete tag.dataset.band;
      else tag.dataset.band = band(avg);
    });
  }

  // ---------- Putting it together ----------

  // For the assignments the list shows now (filters change that).
  function summarise() {
    const all = listed();
    current = computeFinal(all);
    renderCard(current);
    renderAssignments(all, current);
    weekAverages();
    const sealed = all.filter((a) => a.classList.contains("is-sealed") && !isHidden(a)).length;
    P.newBtn.hidden = !sealed;
    setText(P.newBtn, sealed + " new");
    P.newBtn.title = sealed === 1 ? "Reveal your new score" : "Reveal your " + sealed + " new scores";
  }

  let queued = false;
  function refresh() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      page.querySelectorAll(".assignment-list .assignment").forEach(decorate);
      const list = page.querySelector(".assignment-list");
      if (list && card.nextElementSibling !== list) list.before(card);
      tidyToolbar();
      tidyTitle();
      summarise();
      root.classList.remove("ppui-class-pending");
    });
  }

  refresh();
  // The portal re-renders the list when a filter or sort changes. (Changes we make ourselves are ignored.)
  const ours = (node) => {
    const e = node.nodeType === 1 ? node : node.parentElement;
    return !e || !!e.closest(".ppui-final, .ppui-more, .ppui-mine, .ppui-mine-input, .ppui-share, .ppui-week-avg, .ppui-sort, .ppui-pop, .is-counting");
  };
  new MutationObserver((records) => {
    if (records.some((r) => !ours(r.target))) refresh();
  }).observe(page, { childList: true, subtree: true });
})();
