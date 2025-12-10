import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import "./index.css";
import App from "./AppNew";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ThemeProvider } from "./components/ThemeProvider";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <ConvexAuthProvider client={convex}>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <App />
      </ThemeProvider>
    </ConvexAuthProvider>
  </ErrorBoundary>
);
