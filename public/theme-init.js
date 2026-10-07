// Field Instrument ships light-only for v1: the chassis is a light world and
// dark is reserved for display modules. Keep the root class stable so legacy
// screens relying on the light aliases render unchanged. Match browser chrome
// to the route's header before React mounts (see browserChrome.ts).
(function () {
  try {
    localStorage.setItem("vite-ui-theme", "light");
  } catch (_error) {
    // Storage may be unavailable in private or restricted browsing contexts.
  }
  var root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add("light");
  var path = window.location.pathname;
  var color = path === "/" || path === "/vote-test" || path === "/homepage-preview" || path === "/profile"
    ? "#103c3b"
    : /^\/event\/[^/]+\/?$/.test(path)
      ? "#073e39"
      : "#ddd9d0";
  var existing = document.getElementById("theme-color-meta");
  var fresh = document.createElement("meta");
  fresh.setAttribute("name", "theme-color");
  fresh.id = "theme-color-meta";
  fresh.setAttribute("content", color);
  if (existing && existing.parentNode) {
    existing.parentNode.replaceChild(fresh, existing);
  } else {
    document.head.appendChild(fresh);
  }
  root.style.setProperty("--browser-chrome", color);
  root.style.colorScheme = color === "#ddd9d0" ? "light" : "dark";
})();
