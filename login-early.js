// Login page (accounts.veracross.au): apply the saved dashboard theme before first paint.
// No dashboard is built here, so no ppui-booting class is needed.
(function () {
  // Lets background.js tell a styled tab from one that loaded before the extension did.
  window.__ppuiLoaded = true;

  let theme = null;
  try {
    const v = localStorage.getItem("ppui-theme");
    if (v === "light" || v === "dark") theme = v;
  } catch (e) {}
  // Light unless dark was chosen here; the sign-in page no longer follows the system setting.
  if (!theme) theme = "light";
  document.documentElement.setAttribute("data-ppui-theme", theme);
})();
