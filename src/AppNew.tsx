import { Homepage } from "./components/home/Homepage";
import { HomepagePreview } from "./components/home/HomepagePreview";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInFormNew";
import { SignOutButton } from "./SignOutButtonNew";
import { Toaster } from "sonner";
import { LandingPage } from "./components/LandingPageNew";
import { EventView } from "./components/EventView";
import { ProfilePage } from "./components/ProfilePage";
import { TeamPage } from "./components/TeamPage";
import { AdminShell } from "./features/admin/shell/AdminShell";
import { AdminHomeRoute } from "./features/admin/routes/AdminHomeRoute";
import { AdminCreateEventRoute } from "./features/admin/routes/AdminCreateEventRoute";
import { AdminEventRoute } from "./features/admin/routes/AdminEventRoute";
import { AdminInsightsRoute } from "./features/admin/routes/AdminInsightsRoute";
import { CodeAndTellPreview } from "./components/code-and-tell/CodeAndTellPreview";
import { ParticipationPreview } from "./components/participation/ParticipationPreview";
import { DesignPreview } from "./features/design-preview/DesignPreview";
import { useState, useEffect, useLayoutEffect } from "react";
import { syncBrowserChrome } from "./lib/browserChrome";
import { Id } from "../convex/_generated/dataModel";
import { LoadingState } from "./components/ui/LoadingState";
import { BrandLogo } from "./components/ui/BrandLogo";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
  useParams,
  useLocation,
  Outlet,
  Navigate,
} from "react-router-dom";

export default function App() {
  return (
    <BrowserRouter>
      <BrowserChrome />
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/homepage-preview" element={<HomepagePreview />} />
        <Route path="/code-and-tell-preview" element={<CodeAndTellPreview />} />
        <Route
          path="/participation-preview"
          element={<ParticipationPreview />}
        />
        <Route path="/design-preview" element={<DesignPreview />} />
        <Route element={<Layout />}>
          <Route path="/events" element={<LandingPageWrapper />} />
          <Route path="/event/:eventId" element={<EventViewWrapper />} />
          {/* Dedicated team page - direct route */}
          <Route
            path="/event/:eventId/team/:teamId"
            element={<TeamPageWrapper />}
          />
          <Route path="/admin" element={<AdminShell />}>
            <Route index element={<AdminHomeRoute />} />
            <Route path="insights" element={<AdminInsightsRoute />} />
            <Route path="events/new" element={<AdminCreateEventRoute />} />
            <Route path="events/:eventId" element={<AdminEventRoute />} />
          </Route>
          <Route path="/profile" element={<ProfilePageWrapper />} />
          {/* Deep link redirect for QR codes with slug format */}
          <Route
            path="/event/:eventSlug/:teamSlug/:teamId"
            element={<TeamRedirect />}
          />
          {/* Catch-all redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function BrowserChrome() {
  const { pathname } = useLocation();
  useLayoutEffect(() => syncBrowserChrome(pathname), [pathname]);
  return null;
}

/**
 * Layout component with header - wraps all routes
 */
function Layout() {
  const pathname = useLocation().pathname;
  const isEventStage = pathname === "/" || /^\/event\/[^/]+$/.test(pathname);
  const [showSignIn, setShowSignIn] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const isAdmin = useQuery(api.events.isUserAdmin);
  const navigate = useNavigate();

  useEffect(() => {
    const updateIsMobile = () =>
      setIsMobile(window.matchMedia("(max-width: 768px)").matches);
    updateIsMobile();
    window.addEventListener("resize", updateIsMobile);
    return () => window.removeEventListener("resize", updateIsMobile);
  }, []);

  useEffect(() => {
    if (!showSignIn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSignIn(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSignIn]);

  /* Pages surface sign-in through one channel so the modal stays single-surface */
  useEffect(() => {
    const open = () => setShowSignIn(true);
    window.addEventListener("hackjudge:open-signin", open);
    return () => window.removeEventListener("hackjudge:open-signin", open);
  }, []);

  return (
    <div
      className={`min-h-screen flex flex-col fi-app-shell${isEventStage ? " es-home-shell" : ""}`}
    >
      {/* Faceplate rail */}
      <header className="fi-rail sticky top-0 z-40">
        <div className="fi-rail-inner">
          <Link to="/" aria-label="HackJudge home" className="fi-brand-link">
            <BrandLogo />
          </Link>
          <nav className="fi-rail-nav" aria-label="Primary">
            <Authenticated>
              <button
                type="button"
                onClick={() => void navigate("/profile")}
                className="fi-key"
              >
                <ProfileIcon />
                Profile
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => void navigate("/admin")}
                  className="fi-key"
                >
                  <AdminIcon />
                  Admin
                </button>
              )}
              <SignOutButton className="fi-key" />
            </Authenticated>
            <Unauthenticated>
              <button
                type="button"
                onClick={() => setShowSignIn(true)}
                className="fi-key"
              >
                <SignInArrowIcon />
                Sign in
              </button>
            </Unauthenticated>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Toast Notifications - hidden on mobile */}
      {!isMobile && (
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--fi-panel)",
              color: "var(--fi-ink)",
              border: "1px solid var(--fi-hair)",
              borderRadius: "var(--fi-r-xl)",
              fontFamily: "var(--fi-font-ui)",
            },
          }}
        />
      )}

      {/* Sign In Modal */}
      {showSignIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            style={{
              background: "color-mix(in srgb, var(--fi-ink) 55%, transparent)",
            }}
            onClick={() => setShowSignIn(false)}
          />
          <div className="fi-panel fi-signin-panel relative p-8 max-w-md w-full">
            <button
              onClick={() => setShowSignIn(false)}
              className="fi-key fi-key--sm absolute top-4 right-4"
              aria-label="Close sign in"
            >
              Esc
            </button>
            <p className="fi-engraved" style={{ marginBottom: "0.5rem" }}>
              HackJudge console
            </p>
            <h2 className="fi-zone" style={{ marginBottom: "1.5rem" }}>
              Sign in
            </h2>
            <SignInForm />
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M2.5 14c.8-2.4 2.7-3.5 5.5-3.5s4.7 1.1 5.5 3.5" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M8 1.5L2.5 3.5v4c0 3.4 2.4 5.4 5.5 6.5 3.1-1.1 5.5-3.1 5.5-6.5v-4L8 1.5z" />
    </svg>
  );
}

function SignInArrowIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M6 3h7v10H6" />
      <path d="M9 8H2.5M6.5 5.5L9 8l-2.5 2.5" />
    </svg>
  );
}

/**
 * Wrapper for LandingPage that handles navigation
 */
function LandingPageWrapper() {
  const navigate = useNavigate();

  const handleSelectEvent = (eventId: Id<"events">) => {
    void navigate(`/event/${eventId}`);
  };

  return <LandingPage onSelectEvent={handleSelectEvent} />;
}

/**
 * Wrapper for EventView that gets eventId from URL params
 */
function EventViewWrapper() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  if (!eventId) {
    return <Navigate to="/" replace />;
  }

  return (
    <EventView
      eventId={eventId as Id<"events">}
      onBack={() => void navigate("/")}
    />
  );
}

/**
 * Wrapper for ProfilePage
 */
function ProfilePageWrapper() {
  const navigate = useNavigate();

  const handleSelectEvent = (eventId: Id<"events">) => {
    void navigate(`/event/${eventId}`);
  };

  return (
    <ProfilePage
      onSelectEvent={handleSelectEvent}
      onBackToLanding={() => void navigate("/")}
    />
  );
}

/**
 * Wrapper for TeamPage - dedicated page for a single team/project
 */
function TeamPageWrapper() {
  const { eventId, teamId } = useParams<{ eventId: string; teamId: string }>();

  if (!eventId || !teamId) {
    return <Navigate to="/" replace />;
  }

  return (
    <TeamPage
      eventId={eventId as Id<"events">}
      teamId={teamId as Id<"teams">}
    />
  );
}

/**
 * Handles deep linking from QR codes.
 * Looks up the team's event and redirects to the team page.
 * Handles /event/:slug/:slug/:teamId format from QR codes.
 */
function TeamRedirect() {
  const params = useParams<{
    teamId: string;
    eventSlug?: string;
    teamSlug?: string;
  }>();
  const navigate = useNavigate();

  // Get teamId from the route
  const teamId = params.teamId;

  // Look up the event for this team
  const eventId = useQuery(
    api.teams.getTeamEventId,
    teamId ? { teamId: teamId as Id<"teams"> } : "skip",
  );

  useEffect(() => {
    if (eventId && teamId) {
      // Redirect to the dedicated team page
      void navigate(`/event/${eventId}/team/${teamId}`, { replace: true });
    } else if (eventId === null) {
      // Team not found, redirect to home
      void navigate("/", { replace: true });
    }
    // If eventId is undefined, we're still loading
  }, [eventId, teamId, navigate]);

  return <LoadingState label="Loading project…" />;
}
