import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import "./index.css";
import App from "./AppNew";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ThemeProvider } from "./components/ThemeProvider";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
const root = createRoot(document.getElementById("root")!);

// Validate configuration before constructing the client so a bad deploy shows
// a service page instead of a blank screen.
if (!convexUrl || !/^https?:\/\//.test(convexUrl)) {
  console.error("[hackjudge] VITE_CONVEX_URL is missing or invalid");
  root.render(<ServiceUnavailable />);
} else {
  renderApp(new ConvexReactClient(convexUrl));
}

function ServiceUnavailable() {
  return (
    <div className="min-h-screen flex items-center justify-center fi-app-shell px-4">
      <div className="fi-panel max-w-md w-full space-y-3 text-center p-8" role="alert">
        <h1 className="fi-zone">HackJudge is temporarily unavailable</h1>
        <p className="text-sm fi-muted">
          The app can't reach its service right now. Please try again in a few minutes, or contact the event organizers.
        </p>
        <p className="text-xs fi-muted">Reference CONFIG</p>
      </div>
    </div>
  );
}

function renderApp(convex: ConvexReactClient) {
  root.render(
    <ErrorBoundary>
      <ConvexAuthProvider client={convex}>
        <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
          <App />
        </ThemeProvider>
      </ConvexAuthProvider>
    </ErrorBoundary>
  );
}
