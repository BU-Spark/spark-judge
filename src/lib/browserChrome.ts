/** Keep in sync with public/theme-init.js. Every app route shares the platform header. */
export function getBrowserChromeColor(_pathname: string) {
  return "#103c3b";
}

export function syncBrowserChrome(pathname: string) {
  const color = getBrowserChromeColor(pathname);
  const root = document.documentElement;
  root.style.setProperty("--browser-chrome", color);
  root.style.colorScheme = "dark";
  document.getElementById("theme-color-meta")?.setAttribute("content", color);
}
