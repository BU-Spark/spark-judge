// Apply theme before first paint so browser chrome matches without a flash.
(function () {
  try {
    var stored = localStorage.getItem("vite-ui-theme");
    var theme = stored || "system";
    var resolved =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;
    var root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolved);
    var color = resolved === "dark" ? "#0b1215" : "#fafafa";
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
    root.style.backgroundColor = color;
  } catch (_error) {
    // Storage may be unavailable in private or restricted browsing contexts.
  }
})();
