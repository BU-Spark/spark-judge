import { useEffect } from "react";
import { safeSetItem } from "../lib/draftStorage";

type ThemeProviderProps = { children: React.ReactNode; storageKey?: string };

/** The platform is light-only; this keeps stale preferences or OS changes from
 * recoloring the UI. */
export function ThemeProvider({ children, storageKey = "vite-ui-theme" }: ThemeProviderProps) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark");
    root.classList.add("light");
    // Theme persistence is cosmetic; blocked storage must not stop the app.
    safeSetItem(storageKey, "light");
  }, [storageKey]);
  return <>{children}</>;
}
