import { Navigate, useNavigate, useParams } from "react-router-dom";
import type { Id } from "../../../../convex/_generated/dataModel";
import { EventManagementModal } from "../legacy/AdminLegacy";
import { useEventWorkspaceState } from "../hooks/useEventWorkspaceState";
import { UnavailablePage, isConvexIdShape } from "../../../components/RouteFallbacks";

export function AdminEventRoute() {
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();
  const { tab, scoresView, setTab, setScoresView } = useEventWorkspaceState();

  if (!eventId) {
    return <Navigate to="/admin" replace />;
  }

  if (!isConvexIdShape(eventId)) {
    return (
      <UnavailablePage
        title="Event link isn't valid"
        description="This admin link is incomplete or mistyped. Return to your events to open it again."
        backTo="/admin"
        backLabel="Back to admin events"
      />
    );
  }

  return (
    <EventManagementModal
      eventId={eventId as Id<"events">}
      onClose={() => void navigate("/admin")}
      layout="page"
      initialTab={tab}
      onTabChange={setTab}
      scoresView={scoresView}
      onScoresViewChange={setScoresView}
    />
  );
}
