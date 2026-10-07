/** Keep in sync with public/theme-init.js, which runs before the app loads. */
export function getBrowserChromeColor(pathname: string) {
  if (pathname === "/" || pathname === "/homepage-preview" || pathname === "/profile") return "#103c3b";
  if (/^\/event\/[^/]+\/?$/.test(pathname)) return "#073e39";
  return "#ddd9d0";
}

export function syncBrowserChrome(pathname: string) {
  const color = getBrowserChromeColor(pathname);
  const root = document.documentElement;
  root.style.setProperty("--browser-chrome", color);
  root.style.colorScheme = color === "#ddd9d0" ? "light" : "dark";
  document.getElementById("theme-color-meta")?.setAttribute("content", color);
}
