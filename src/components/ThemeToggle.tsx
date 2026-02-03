import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className={`p-2 rounded-xl transition-all duration-300 ${theme === "dark"
          ? "bg-teal-500/10 text-teal-400 border border-teal-500/20 shadow-[0_0_15px_-3px_rgba(20,184,166,0.3)] hover:shadow-[0_0_20px_-3px_rgba(20,184,166,0.5)]"
          : "bg-muted/50 text-muted-foreground hover:bg-muted"
        }`}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      type="button"
    >
      <span className="sr-only">Toggle theme</span>
      {theme === "light" ? (
        <svg
          className="w-5 h-5"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
        </svg>
      ) : (
        <svg
          className="w-5 h-5 text-teal-400"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}


