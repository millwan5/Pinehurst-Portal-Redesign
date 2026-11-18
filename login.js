// Sign-in pages (accounts.veracross.au): the portal's Low Poly banner drawn across the whole page
// behind the card, and the card's text cut down to what's needed to sign in. The site's own form,
// fields and links still do the work; only the long help notes are replaced by one short row.
(() => {
  const root = document.documentElement;
  const card = document.querySelector(".ae-grid .card");
  if (!card) return;
  root.classList.add("ppui-login");

  const el = (tag, className, text) => {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const clean = (t) => (t || "").replace(/\s+/g, " ").trim();
  const links = [...card.querySelectorAll("a[href]")];
  const linkTo = (re) => links.find((a) => re.test(a.getAttribute("href") || "") || re.test(a.textContent));

  // ---- Background: the Low Poly banner, full page, in the portal's colour theme ----
  const scene = el("div", "ppui-login-scene");
  scene.setAttribute("aria-hidden", "true");
  document.body.prepend(scene);
  const mountScene = (palette) => {
    try {
      if (window.PPUIBanner) window.PPUIBanner.mount(scene, scene, "mesh", palette || "blue");
    } catch (e) {}
  };
  // The saved look, as login-early.js already read it.
  (window.__ppuiLook || Promise.resolve({})).then((look) => mountScene(look.palette));

  // ---- Less text ----
  const form = card.querySelector("form");
  const container = card.querySelector(".account-form-container");
  const input = card.querySelector(".vx-TextField_Input");
  const isLogin = !!card.querySelector("#login-form");
  const isReset = !!card.querySelector("#forgot-password-form");

  if (isLogin) {
    // The site's intro line is whichever header paragraph has text (the .school-text one is empty).
    const sub = [...card.querySelectorAll(".card-header p")].find((p) => clean(p.textContent));
    if (sub) sub.textContent = "Sign in to the student portal";
    if (input && !input.placeholder) input.placeholder = "Your school email address";
  }
  if (isReset) {
    const intro = card.querySelector(".vx-BodyText");
    if (intro) intro.textContent = "Enter your email and we'll send you a link to reset your password.";
    if (input && !input.placeholder) input.placeholder = "Your email address";
    const label = card.querySelector(".vx-FormLabel");
    if (label) label.textContent = "Email address";
    const send = card.querySelector("form .vx-Button");
    if (send && /send instructions/i.test(send.value)) send.value = "Send reset link";
  }

  // Everything after the form and its main link becomes one short row of help links.
  if (container && form && (isLogin || isReset)) {
    const main = container.querySelector(":scope > .forgot-link, form .forgot-link");
    let after = false;
    for (const n of [...container.children]) {
      if (n === form || n === main) {
        after = true;
        continue;
      }
      if (after && n.tagName !== "FORM") n.classList.add("ppui-login-moved");
    }
    const help = el("nav", "ppui-login-help");
    help.setAttribute("aria-label", "Sign-in help");
    const add = (a, label) => {
      if (!a) return;
      const link = el("a", null, label);
      link.href = a.href;
      if (a.target) link.target = a.target;
      if (/^https?:/.test(a.href) && new URL(a.href).host !== location.host) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
      help.appendChild(link);
    };
    add(linkTo(/faq/i), "Sign-in help");
    add(linkTo(/^mailto:/i), "Email the helpdesk");
    if (isReset) {
      const note = el("p", "ppui-login-note", "The email comes from Veracross. Check your spam folder if it doesn't arrive.");
      container.appendChild(note);
    }
    if (help.children.length) container.appendChild(help);
  }
  if (isLogin) {
    const main = card.querySelector(".forgot-link");
    if (main && /can.?t access/i.test(clean(main.textContent))) main.textContent = "Forgot your password?";
  }
})();
