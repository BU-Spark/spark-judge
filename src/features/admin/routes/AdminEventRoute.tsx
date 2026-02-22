import { Navigate, useNavigate, useParams } from "react-router-dom";
import type { Id } from "../../../../convex/_generated/dataModel";
import { EventManagementModal } from "../legacy/AdminLegacy";
import { useEventWorkspaceState } from "../hooks/useEventWorkspaceState";

export function AdminEventRoute() {
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();
  const { tab, scoresView, setTab, setScoresView } = useEventWorkspaceState();

  if (!eventId) {
    return <Navigate to="/admin" replace />;
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
