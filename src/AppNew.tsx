import { Homepage } from "./components/home/Homepage";
import { HomepagePreview } from "./components/home/HomepagePreview";
import { EventCardPreview } from "./components/home/EventCardPreview";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { PlatformHeader } from "./components/home/PlatformHeader";
import { PlatformToaster } from "./components/ui/PlatformToaster";
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
import { lazy, Suspense, useEffect, useLayoutEffect } from "react";
import { syncBrowserChrome } from "./lib/browserChrome";
import { Id } from "../convex/_generated/dataModel";
import { LoadingState } from "./components/ui/LoadingState";
import { ProjectPreview } from "./components/ProjectPreview";
import { RouteBoundary, UnavailablePage, isConvexIdShape } from "./components/RouteFallbacks";
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useParams,
  useLocation,
  Outlet,
  Navigate,
} from "react-router-dom";

const ResultsPreview = import.meta.env.DEV ? lazy(() => import("./features/admin/ResultsPreview")) : null;

export default function App() {
  return (
    <BrowserRouter>
      <BrowserChrome />
      <Routes>
        <Route path="/" element={<RouteBoundary section="home"><Homepage /></RouteBoundary>} />
        <Route path="/vote-test" element={<RouteBoundary section="vote-test"><Homepage voteTest /></RouteBoundary>} />
        <Route path="/homepage-preview" element={<HomepagePreview />} />
        <Route path="/code-and-tell-preview" element={<CodeAndTellPreview />} />
        <Route
          path="/participation-preview"
          element={<ParticipationPreview />}
        />
        <Route path="/design-preview" element={<DesignPreview />} />
        <Route path="/event-card-preview" element={<EventCardPreview />} />
        <Route path="/profile" element={<ProfilePageWrapper />} />
        <Route element={<Layout />}>
          {ResultsPreview && <Route path="/admin-results-preview" element={<Suspense fallback={<LoadingState label="Loading preview..." />}><ResultsPreview /></Suspense>} />}
          <Route path="/project-preview" element={<ProjectPreview />} />
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
          {/* Deep link redirect for QR codes with slug format */}
          <Route
            path="/event/:eventSlug/:teamSlug/:teamId"
            element={<TeamRedirect />}
          />
          {/* Unknown or obsolete links explain themselves instead of silently redirecting */}
          <Route path="*" element={<UnavailablePage />} />
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
  return (
    <div className="platform-shell hp-workspace">
      <a href="#main-content" className="platform-skip-link">
        Skip to content
      </a>
      <PlatformHeader />
      <main id="main-content" className="platform-main" tabIndex={-1}>
        <RouteBoundary>
          <Outlet />
        </RouteBoundary>
      </main>
      <PlatformToaster />
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

  if (!isConvexIdShape(eventId)) {
    return (
      <UnavailablePage
        title="Event link isn't valid"
        description="This event link is incomplete or mistyped. Check the address, or browse current events."
      />
    );
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
    <div className="hp-workspace">
      <PlatformHeader />
      <main>
        <RouteBoundary section="profile">
          <ProfilePage
            onSelectEvent={handleSelectEvent}
            onBackToLanding={() => void navigate("/")}
          />
        </RouteBoundary>
      </main>
      <PlatformToaster />
    </div>
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

  if (!isConvexIdShape(eventId) || !isConvexIdShape(teamId)) {
    return (
      <UnavailablePage
        title="Project link isn't valid"
        description="This project link is incomplete or mistyped. Check the address, or open the event to find the project."
        backTo={isConvexIdShape(eventId) ? `/event/${eventId}` : "/"}
        backLabel={isConvexIdShape(eventId) ? "Back to event" : "Back to events"}
      />
    );
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

  // Get teamId from the route; malformed IDs never reach the query validator
  const teamId = isConvexIdShape(params.teamId) ? params.teamId : undefined;

  // Look up the event for this team
  const eventId = useQuery(
    api.teams.getTeamEventId,
    teamId ? { teamId: teamId as Id<"teams"> } : "skip",
  );

  useEffect(() => {
    if (eventId && teamId) {
      // Redirect to the dedicated team page
      void navigate(`/event/${eventId}/team/${teamId}`, { replace: true });
    }
    // If eventId is undefined, we're still loading; null renders the unavailable state
  }, [eventId, teamId, navigate]);

  if (!teamId || eventId === null) {
    return (
      <UnavailablePage
        title="Project link isn't available"
        description="This QR code or link points to a project that has moved, been removed, or isn't public yet. Browse events to find it."
      />
    );
  }

  return <LoadingState label="Loading project…" />;
}
