import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  useEffect(() => {
    const root = window.document.documentElement;

    const resolveActiveTheme = (current: Theme): "light" | "dark" =>
      current === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : current;

    const applyTheme = (active: "light" | "dark") => {
      root.classList.remove("light", "dark");
      root.classList.add(active);

      const color = active === "dark" ? "#0b1215" : "#fafafa";
      // Match the html background so the iOS status bar / address bar area
      // doesn't flash a stale color before <body> paints.
      root.style.backgroundColor = color;

      // Replace the meta element instead of mutating it. iOS Safari sometimes
      // ignores attribute mutations on the existing <meta name="theme-color">
      // tag, so a fresh node forces the browser chrome to update.
      const existing = document.getElementById("theme-color-meta");
      const fresh = document.createElement("meta");
      fresh.setAttribute("name", "theme-color");
      fresh.id = "theme-color-meta";
      fresh.setAttribute("content", color);
      if (existing && existing.parentNode) {
        existing.parentNode.replaceChild(fresh, existing);
      } else {
        document.head.appendChild(fresh);
      }
    };

    applyTheme(resolveActiveTheme(theme));

    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyTheme(resolveActiveTheme("system"));
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
  };

  return (
    <ThemeProviderContext.Provider value={value} {...props}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};


