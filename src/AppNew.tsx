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
import { useState, useEffect } from "react";
import { Id } from "../convex/_generated/dataModel";
import { ThemeToggle } from "./components/ThemeToggle";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
  useParams,
  Outlet,
  Navigate,
} from "react-router-dom";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<LandingPageWrapper />} />
          <Route path="/event/:eventId" element={<EventViewWrapper />} />
          {/* Dedicated team page - direct route */}
          <Route path="/event/:eventId/team/:teamId" element={<TeamPageWrapper />} />
          <Route path="/admin" element={<AdminShell />}>
            <Route index element={<AdminHomeRoute />} />
            <Route path="events/new" element={<AdminCreateEventRoute />} />
            <Route path="events/:eventId" element={<AdminEventRoute />} />
          </Route>
          <Route path="/profile" element={<ProfilePageWrapper />} />
          {/* Deep link redirect for QR codes with slug format */}
          <Route path="/event/:eventSlug/:teamSlug/:teamId" element={<TeamRedirect />} />
          {/* Catch-all redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

/**
 * Layout component with header - wraps all routes
 */
function Layout() {
  const [showSignIn, setShowSignIn] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const isAdmin = useQuery(api.events.isUserAdmin);
  const navigate = useNavigate();
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  useEffect(() => {
    const updateIsMobile = () => setIsMobile(window.matchMedia("(max-width: 768px)").matches);
    updateIsMobile();
    window.addEventListener("resize", updateIsMobile);
    return () => window.removeEventListener("resize", updateIsMobile);
  }, []);

  const renderNavActions = (variant: "desktop" | "mobile") => {
    const baseGhostClass =
      variant === "desktop"
        ? "btn-ghost"
        : "btn-ghost w-full justify-start";
    const signOutClass =
      variant === "desktop"
        ? "btn-ghost hover:text-red-500"
        : "btn-ghost w-full justify-start hover:text-red-500";
    const signInClass =
      variant === "desktop"
        ? "btn-primary"
        : "btn-primary w-full justify-center";

    return (
      <>
        <Authenticated>
          <button
            onClick={() => {
              void navigate("/profile");
              closeMobileMenu();
            }}
            className={baseGhostClass}
          >
            Profile
          </button>
          {isAdmin && (
            <button
              onClick={() => {
                void navigate("/admin");
                closeMobileMenu();
              }}
              className={baseGhostClass}
            >
              Admin
            </button>
          )}
          <SignOutButton
            className={signOutClass}
            onClick={variant === "mobile" ? closeMobileMenu : undefined}
          />
        </Authenticated>
        <Unauthenticated>
          <button
            onClick={() => {
              setShowSignIn(true);
              closeMobileMenu();
            }}
            className={signInClass}
          >
            Sign In
          </button>
        </Unauthenticated>
      </>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex justify-between items-center">
            <Link
              to="/"
              onClick={closeMobileMenu}
              className="text-xl font-logo logo-color hover:text-primary dark:hover:text-primary/80 transition-colors"
            >
              HackJudge
            </Link>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <div className="hidden md:flex gap-4 items-center">
                {renderNavActions("desktop")}
              </div>
              <button
                type="button"
                aria-label="Toggle navigation menu"
                aria-expanded={isMobileMenuOpen}
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden inline-flex items-center justify-center p-2 rounded-lg hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
              >
                {isMobileMenuOpen ? (
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background">
            <div className="fixed inset-0 z-30 bg-transparent" onClick={closeMobileMenu} />
            <div className="relative z-40 px-4 py-6 space-y-2">
              {renderNavActions("mobile")}
            </div>
          </div>
        )}
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
              background: 'var(--card)',
              color: 'var(--card-foreground)',
              border: '1px solid var(--border)',
            },
          }}
        />
      )}

      {/* Sign In Modal */}
      {showSignIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowSignIn(false)}
          />
          <div className="relative bg-background rounded-xl p-8 max-w-md w-full shadow-2xl border border-border slide-up">
            <button
              onClick={() => setShowSignIn(false)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-2xl font-heading font-bold mb-6 text-foreground">Sign In</h2>
            <SignInForm />
          </div>
        </div>
      )}
    </div>
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
  const params = useParams<{ teamId: string; eventSlug?: string; teamSlug?: string }>();
  const navigate = useNavigate();
  
  // Get teamId from the route
  const teamId = params.teamId;
  
  // Look up the event for this team
  const eventId = useQuery(
    api.teams.getTeamEventId,
    teamId ? { teamId: teamId as Id<"teams"> } : "skip"
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

  return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Loading project...</p>
      </div>
    </div>
  );
}
