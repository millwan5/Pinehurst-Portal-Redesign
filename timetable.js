// Runs on the printable timetable (documents.veracross.au), but only when the portal's Timetable page
// shows it in a frame (content.js, buildTimetable). There it takes the portal's theme, tells the
// portal its height and its PDF link, and on request shows that PDF inside the frame.
// The PDF is sent as a download, so it is fetched here and shown from a blob instead.
(() => {
  if (window === window.top) return;
  const PORTAL_ORIGIN = "https://portals.veracross.au";
  const PALETTES = /^(teal|forest|violet|rose|sunset|graphite)$/;
  const root = document.documentElement;
  root.classList.add("ppui-tt-embed");
  root.setAttribute("data-ppui-theme", matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

  let pdfUrl = null;
  let pdfFrame = null;
  let loadingPdf = null;

  const post = (data) => {
    try {
      window.parent.postMessage(Object.assign({ ppuiTimetable: true }, data), PORTAL_ORIGIN);
    } catch (e) {}
  };
  // While the PDF covers the week, the week's height is not the frame's business.
  const report = () => {
    if (root.classList.contains("ppui-tt-show-pdf")) return;
    post({ height: Math.ceil(document.documentElement.scrollHeight), pdf: pdfUrl });
  };

  function loadPdf() {
    if (loadingPdf) return loadingPdf;
    loadingPdf = fetch(pdfUrl, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("PDF request failed: " + res.status);
        return res.arrayBuffer();
      })
      .then((data) => {
        pdfFrame = document.createElement("iframe");
        pdfFrame.className = "ppui-tt-pdf";
        pdfFrame.title = "Timetable PDF";
        pdfFrame.src = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
        document.body.appendChild(pdfFrame);
      });
    return loadingPdf;
  }

  function showPdf(on) {
    root.classList.toggle("ppui-tt-show-pdf", on);
    if (!on || pdfFrame) return;
    if (!pdfUrl) {
      root.classList.remove("ppui-tt-show-pdf");
      post({ pdfFailed: true });
      return;
    }
    loadPdf().catch(() => {
      loadingPdf = null;
      root.classList.remove("ppui-tt-show-pdf");
      post({ pdfFailed: true });
    });
  }

  addEventListener("message", (e) => {
    if (e.origin !== PORTAL_ORIGIN || !e.data) return;
    if (e.data.ppuiTheme === "light" || e.data.ppuiTheme === "dark") root.setAttribute("data-ppui-theme", e.data.ppuiTheme);
    if (typeof e.data.ppuiPalette === "string") {
      if (PALETTES.test(e.data.ppuiPalette)) root.setAttribute("data-ppui-palette", e.data.ppuiPalette);
      else root.removeAttribute("data-ppui-palette");
    }
    if (typeof e.data.ppuiShowPdf === "boolean") showPdf(e.data.ppuiShowPdf);
  });
  window.parent.postMessage({ ppuiAskTheme: true }, PORTAL_ORIGIN);

  function ready() {
    const print = document.querySelector("a.print[href]");
    if (print) {
      try {
        const url = new URL(print.getAttribute("href"), location.href);
        if (url.origin === location.origin && /\.pdf$/.test(url.pathname)) pdfUrl = url.href;
      } catch (e) {}
    }
    // Free periods come as plain white blocks: mark them so the theme can tint them.
    for (const block of document.querySelectorAll(".schedule-block .block")) {
      if (/^rgba?\(255, 255, 255/.test(getComputedStyle(block).backgroundColor)) block.classList.add("ppui-tt-plain");
    }
    // The week is drawn at a fixed width; shrink it to fit the frame rather than scroll sideways.
    const sheet = document.body.firstElementChild;
    const fit = () => {
      if (!sheet) return;
      document.body.style.zoom = "";
      const natural = sheet.scrollWidth + 24;
      const scale = Math.max(0.6, Math.min(1, innerWidth / natural));
      if (scale < 1) document.body.style.zoom = String(scale);
      report();
    };
    fit();
    addEventListener("resize", fit);
    if (window.ResizeObserver) new ResizeObserver(report).observe(document.body);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
  else ready();
})();
