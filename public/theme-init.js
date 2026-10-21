// Match the shared platform header before React mounts.
// Keep working panels light regardless of saved theme preferences.
(function () {
  try {
    localStorage.setItem("vite-ui-theme", "light");
  } catch (_error) {
    // Storage may be unavailable in private or restricted browsing contexts.
  }
  var root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add("light");
  var color = "#103c3b";
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
  root.style.colorScheme = "dark";
})();
