import { useNavigate } from "react-router-dom";
import { EventsList } from "../components/EventsList";

export function AdminHomeRoute() {
  const navigate = useNavigate();

  return (
    <div className="h-full min-h-[24rem] flex flex-col p-4 sm:p-6 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-heading font-bold text-foreground">Admin Workspace</h1>
          <p className="text-sm text-muted-foreground">
            Manage events, teams, scoring, and winner selection.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:flex w-full sm:w-auto gap-2">
          <button
            type="button"
            onClick={() => void navigate("/admin/insights")}
            className="btn-secondary w-full sm:w-auto"
          >
            View Insights
          </button>
          <button
            type="button"
            onClick={() => void navigate("/admin/events/new")}
            className="btn-primary w-full sm:w-auto"
          >
            Create Event
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <EventsList
          onSelectEvent={(id) => {
            void navigate(`/admin/events/${id}?tab=details`);
          }}
        />
      </div>
    </div>
  );
}
