import { useNavigate } from "react-router-dom";
import { CreateEventWorkspace } from "../legacy/AdminLegacy";

export function AdminCreateEventRoute() {
  const navigate = useNavigate();

  return (
    <div className="h-full min-h-0 overflow-auto pr-1">
      <div className="mb-4">
        <h1 className="text-2xl fi-zone font-bold fi-ink">Create Event</h1>
        <p className="text-sm fi-muted">Set up event details, team model, and scoring rules.</p>
      </div>
      <CreateEventWorkspace onClose={() => void navigate("/admin")} />
    </div>
  );
}
