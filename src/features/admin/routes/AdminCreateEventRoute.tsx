import { useNavigate } from "react-router-dom";
import { CreateEventWorkspace } from "../legacy/AdminLegacy";

export function AdminCreateEventRoute() {
  const navigate = useNavigate();

  return (
    <div className="h-full min-h-0 overflow-auto pr-1">
      <div className="mb-4">
        <h1 className="text-2xl font-heading font-bold text-foreground">Create Event</h1>
        <p className="text-sm text-muted-foreground">Set up event details, team model, and scoring rules.</p>
      </div>
      <CreateEventWorkspace onClose={() => void navigate("/admin")} />
    </div>
  );
}
