import { createContext, useContext, useEffect } from "react";

type Theme = "dark" | "light" | "system";
type ThemeProviderProps = { children: React.ReactNode; defaultTheme?: Theme; storageKey?: string };
type ThemeProviderState = { theme: Theme; setTheme: (theme: Theme) => void };

const ThemeProviderContext = createContext<ThemeProviderState>({ theme: "light", setTheme: () => null });

/** Field Instrument v1 is intentionally light-only; this compatibility provider
 * keeps the old hook API without allowing stale preferences or OS changes to
 * recolor the chassis. */
export function ThemeProvider({ children, storageKey = "vite-ui-theme", ...props }: ThemeProviderProps) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark");
    root.classList.add("light");
    localStorage.setItem(storageKey, "light");
  }, [storageKey]);
  const value: ThemeProviderState = { theme: "light", setTheme: () => undefined };
  return <ThemeProviderContext.Provider value={value} {...props}>{children}</ThemeProviderContext.Provider>;
}

export const useTheme = () => useContext(ThemeProviderContext);
