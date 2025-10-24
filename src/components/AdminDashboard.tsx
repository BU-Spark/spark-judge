import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, Dispatch, SetStateAction } from "react";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";

type SortField = "name" | "status" | "teamCount" | "startDate";
type SortDirection = "asc" | "desc";
type SortConfig = { field: SortField; direction: SortDirection };

const STATUS_SORT_ORDER: Record<"active" | "upcoming" | "past", number> = {
  active: 0,
  upcoming: 1,
  past: 2,
};

function compareEvents(
  a: any,
  b: any,
  sortConfig: SortConfig
) {
  let comparison = 0;

  switch (sortConfig.field) {
    case "name":
      comparison = a.name.localeCompare(b.name);
      break;
    case "status":
      comparison =
        STATUS_SORT_ORDER[a.status as "active" | "upcoming" | "past"] -
        STATUS_SORT_ORDER[b.status as "active" | "upcoming" | "past"];
      break;
    case "teamCount":
      comparison = (a.teamCount ?? 0) - (b.teamCount ?? 0);
      break;
    case "startDate":
      comparison = (a.startDate ?? 0) - (b.startDate ?? 0);
      break;
    default:
      break;
  }

  if (comparison === 0 && sortConfig.field !== "name") {
    comparison = a.name.localeCompare(b.name);
  }

  return sortConfig.direction === "asc" ? comparison : -comparison;
}

export function AdminDashboard({ onBackToLanding }: { onBackToLanding: () => void }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<Id<"events"> | null>(null);
  const isAdmin = useQuery(api.events.isUserAdmin);

  // Show loading state while checking admin status
  if (isAdmin === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Show error if user is not an admin
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-16 px-4">
        <div className="card text-center">
          <h2 className="text-2xl font-heading font-bold mb-4">Access Denied</h2>
          <p className="text-muted-foreground mb-6">
            You don't have admin privileges to access this dashboard.
          </p>
          <button onClick={onBackToLanding} className="btn-primary">
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <button
        onClick={onBackToLanding}
        className="flex items-center gap-2 btn-ghost mb-6 fade-in"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Events
      </button>

      <div className="flex justify-between items-center mb-8 fade-in">
        <div>
          <h1 className="text-4xl font-heading font-bold text-foreground mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage your hackathon events and teams</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Create Event
        </button>
      </div>

      <EventsList onSelectEvent={setSelectedEventId} />

      {isCreateOpen && <CreateEventModal onClose={() => setIsCreateOpen(false)} />}
      {selectedEventId && (
        <EventManagementModal eventId={selectedEventId} onClose={() => setSelectedEventId(null)} />
      )}
    </div>
  );
}

function EventsList({ onSelectEvent }: { onSelectEvent: (eventId: Id<"events">) => void }) {
  const events = useQuery(api.events.listEvents);
  const removeEvent = useMutation(api.events.removeEvent);
  const duplicateEvent = useMutation(api.events.duplicateEvent);
  const [removingEventId, setRemovingEventId] = useState<Id<"events"> | null>(null);
  const [duplicatingEventId, setDuplicatingEventId] = useState<Id<"events"> | null>(null);
  const [sortConfig, setSortConfig] = useState<{ field: SortField; direction: SortDirection }>({
    field: "status",
    direction: "asc",
  });

  if (!events) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const allEvents = [...events.active, ...events.upcoming, ...events.past];

  const statusStyles: Record<"upcoming" | "active" | "past", string> = {
    active: "bg-emerald-500/10 text-emerald-500 border border-emerald-500",
    upcoming: "bg-sky-500/10 text-sky-500 border border-sky-500",
    past: "bg-primary/10 text-primary border border-primary",
  };

  const handleRemoveEvent = async (eventId: Id<"events">, name: string) => {
    const confirmed = window.confirm(`Remove "${name}"? This will delete teams, scores, and access for this event.`);
    if (!confirmed) return;

    try {
      setRemovingEventId(eventId);
      await removeEvent({ eventId });
      toast.success("Event removed successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to remove event");
    } finally {
      setRemovingEventId(null);
    }
  };

  const handleDuplicateEvent = async (eventId: Id<"events">, name: string) => {
    try {
      setDuplicatingEventId(eventId);
      const newEventId = await duplicateEvent({ eventId });
      toast.success(`Duplicated "${name}"`);
      onSelectEvent(newEventId);
    } catch (error) {
      console.error(error);
      toast.error("Failed to duplicate event");
    } finally {
      setDuplicatingEventId(null);
    }
  };

  const sortOrder = (eventsToSort: typeof allEvents) => {
    const sorted = [...eventsToSort];
    sorted.sort((a, b) => compareEvents(a, b, sortConfig));
    return sorted;
  };

  const sortedEvents = sortOrder(allEvents);

  if (sortedEvents.length === 0) {
    return (
      <div className="card-glass text-center py-12 fade-in">
        <div className="text-6xl mb-4">📅</div>
        <h3 className="text-xl font-heading font-semibold text-foreground mb-2">No Events Yet</h3>
        <p className="text-muted-foreground">Create your first event to get started!</p>
      </div>
    );
  }

  return (
    <div className="card-glass no-card-hover overflow-hidden fade-in">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <SortButton
                  field="name"
                  label="Event Name"
                  sortConfig={sortConfig}
                  onSort={setSortConfig}
                />
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <SortButton
                  field="status"
                  label="Status"
                  sortConfig={sortConfig}
                  onSort={setSortConfig}
                />
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <SortButton
                  field="teamCount"
                  label="Teams"
                  sortConfig={sortConfig}
                  onSort={setSortConfig}
                />
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <SortButton
                  field="startDate"
                  label="Date"
                  sortConfig={sortConfig}
                  onSort={setSortConfig}
                />
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedEvents.map((event, index) => (
              <tr 
                key={event._id}
                className={`transition-colors hover:bg-muted/20 ${index % 2 === 1 ? "bg-muted/10" : ""}`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{event.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`badge ${statusStyles[event.status as "upcoming" | "active" | "past"]}`}
                  >
                    {event.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    {event.teamCount}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {new Date(event.startDate).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectEvent(event._id)}
                      className="inline-flex items-center justify-center p-2 rounded-lg transition-colors text-primary hover:text-primary hover:bg-orange-500/10"
                      title="Manage event"
                    >
                      <span className="sr-only">Manage event</span>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.094c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.095c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.02-.398-1.11-.94l-.149-.894c-.071-.424-.383-.764-.781-.93-.397-.164-.853-.142-1.203.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.095c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateEvent(event._id, event.name)}
                      disabled={duplicatingEventId === event._id}
                      className={`inline-flex items-center justify-center p-2 rounded-lg transition-colors text-blue-500 hover:bg-blue-500/10 ${
                        duplicatingEventId === event._id ? "opacity-60 cursor-not-allowed" : ""
                      }`}
                      title="Duplicate event"
                    >
                      <span className="sr-only">Duplicate event</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-4 12h6a2 2 0 002-2v-8a2 2 0 00-2-2h-6a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveEvent(event._id, event.name)}
                      disabled={removingEventId === event._id}
                      className={`inline-flex items-center justify-center p-2 rounded-lg transition-colors text-red-500 hover:bg-red-500/10 ${
                        removingEventId === event._id ? "opacity-60 cursor-not-allowed" : ""
                      }`}
                      title="Remove event"
                    >
                      <span className="sr-only">Remove event</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateEventModal({ onClose }: { onClose: () => void }) {
  const createEvent = useMutation(api.events.createEvent);
  const [submitting, setSubmitting] = useState(false);
  const [useTracksAsAwards, setUseTracksAsAwards] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "upcoming" as "upcoming" | "active" | "past",
    startDate: "",
    endDate: "",
    categories: "Innovation,Technical Complexity,Design,Presentation,Impact",
    tracks: "AI/ML,Web Development,Hardware,Mobile,Other",
    judgeCode: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const categories = formData.categories.split(",").map((c) => c.trim()).filter(Boolean);
      const tracks = useTracksAsAwards 
        ? undefined 
        : formData.tracks.split(",").map((t) => t.trim()).filter(Boolean);
      
      await createEvent({
        name: formData.name,
        description: formData.description,
        status: formData.status,
        startDate: new Date(formData.startDate).getTime(),
        endDate: new Date(formData.endDate).getTime(),
        categories,
        tracks,
        judgeCode: formData.judgeCode || undefined,
      });
      toast.success("Event created successfully!");
      onClose();
    } catch (error) {
      toast.error("Failed to create event");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-background rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto border border-border slide-up">
        <div className="sticky top-0 bg-background border-b border-border p-6 z-10">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 className="text-3xl font-heading font-bold text-foreground">Create New Event</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Event Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground"
              placeholder="HackBU Fall 2024"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Description</label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground resize-none"
              placeholder="Boston University's premier 24-hour hackathon..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground"
            >
              <option value="upcoming">Upcoming</option>
              <option value="active">Active</option>
              <option value="past">Past</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Start Date</label>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">End Date</label>
              <input
                type="date"
                required
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Awards/Judging Categories (comma-separated)
            </label>
            <input
              type="text"
              required
              value={formData.categories}
              onChange={(e) => setFormData({ ...formData, categories: e.target.value })}
              className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground"
              placeholder="Innovation, Technical Complexity, Design..."
            />
            <p className="text-xs text-muted-foreground mt-2">
              These are the categories judges will score teams on
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                checked={useTracksAsAwards}
                onChange={(e) => setUseTracksAsAwards(e.target.checked)}
                className="w-4 h-4 text-primary border-border rounded focus:ring-2 focus:ring-primary"
              />
              <span className="text-sm font-medium text-foreground">
                Use awards as tracks (teams choose from same list)
              </span>
            </label>
            
            {!useTracksAsAwards && (
              <>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Tracks (comma-separated)
                </label>
                <input
                  type="text"
                  required
                  value={formData.tracks}
                  onChange={(e) => setFormData({ ...formData, tracks: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground"
                  placeholder="AI/ML, Web Development, Hardware..."
                />
                <p className="text-xs text-muted-foreground mt-2">
                  These are the tracks teams can choose when registering
                </p>
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Judge Code (Optional)
            </label>
            <input
              type="text"
              value={formData.judgeCode}
              onChange={(e) => setFormData({ ...formData, judgeCode: e.target.value })}
              className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground"
              placeholder="secret-code-123"
            />
            <p className="text-xs text-muted-foreground mt-2">
              If set, judges must enter this code to start judging active events
            </p>
          </div>

          <div className="sticky bottom-0 bg-background border-t border-border -mx-6 -mb-6 p-6 flex gap-4">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </span>
              ) : (
                "Create Event"
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ScoringDashboard({
  scores,
  viewMode,
  setViewMode,
}: {
  scores: {
    teamRankings: any[];
    categoryRankings: Record<string, any[]>;
    judgeBreakdown: any[];
    categories: string[];
  };
  viewMode: 'table' | 'chart';
  setViewMode: (mode: 'table' | 'chart') => void;
}) {
  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-heading font-bold text-foreground">Scoring Dashboard</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('table')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              viewMode === 'table'
                ? 'bg-primary text-white shadow-lg'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Table
          </button>
          <button
            onClick={() => setViewMode('chart')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              viewMode === 'chart'
                ? 'bg-primary text-white shadow-lg'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Charts
          </button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <>
          {/* Overall Rankings Table */}
          <div className="card p-6">
            <h4 className="text-xl font-heading font-bold text-foreground mb-4">Overall Rankings</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-bold text-foreground">Rank</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-foreground">Team Name</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-foreground">Avg Score</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-foreground">Judges</th>
                    {scores.categories.map((cat) => (
                      <th key={cat} className="px-6 py-4 text-left text-sm font-bold text-foreground">{cat}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scores.teamRankings.map((ranking, index) => (
                    <tr 
                      key={ranking.team._id}
                      className={index % 2 === 0 ? 'bg-gray-50 dark:bg-white/[0.03]' : 'bg-gray-100 dark:bg-white/[0.08]'}
                    >
                      <td className="px-6 py-4 text-lg font-bold text-foreground">#{index + 1}</td>
                      <td className="px-6 py-4 text-lg font-semibold text-foreground">{ranking.team.name}</td>
                      <td className="px-6 py-4 text-lg font-mono text-foreground">{ranking.averageScore.toFixed(2)}</td>
                      <td className="px-6 py-4 text-lg text-muted-foreground">{ranking.judgeCount}</td>
                      {scores.categories.map((cat) => (
                        <td key={cat} className="px-6 py-4 text-base font-mono text-muted-foreground">
                          {ranking.categoryAverages[cat]?.toFixed(2) || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Category Rankings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {scores.categories.map((category) => (
              <div key={category} className="card p-6">
                <h4 className="text-lg font-heading font-bold text-foreground mb-4">{category}</h4>
                <div className="space-y-2">
                  {scores.categoryRankings[category]?.slice(0, 5).map((team, idx) => (
                    <div 
                      key={team.team._id}
                      className={`flex justify-between items-center p-3 rounded-lg ${
                        idx % 2 === 0 ? 'bg-gray-50 dark:bg-white/[0.03]' : 'bg-gray-100 dark:bg-white/[0.08]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-muted-foreground">#{idx + 1}</span>
                        <span className="text-base font-semibold text-foreground">{team.team.name}</span>
                      </div>
                      <span className="text-base font-mono text-foreground">{team.categoryAverage.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Overall Rankings Chart */}
          <div className="card p-6">
            <h4 className="text-xl font-heading font-bold text-foreground mb-6">Overall Rankings</h4>
            <div className="space-y-4">
              {scores.teamRankings.map((ranking, index) => {
                const maxScore = Math.max(...scores.teamRankings.map(r => r.averageScore));
                const percentage = (ranking.averageScore / maxScore) * 100;
                
                return (
                  <div key={ranking.team._id} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-muted-foreground w-8">#{index + 1}</span>
                        <span className="text-lg font-semibold text-foreground">{ranking.team.name}</span>
                      </div>
                      <span className="text-lg font-mono font-bold text-foreground">{ranking.averageScore.toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-muted/30 rounded-full h-8 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-end pr-3 transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      >
                        <span className="text-xs font-medium text-white">{percentage.toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Category Comparison Chart */}
          <div className="card p-6">
            <h4 className="text-xl font-heading font-bold text-foreground mb-6">Top 5 Teams by Category</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {scores.categories.map((category) => (
                <div key={category}>
                  <h5 className="text-lg font-semibold text-foreground mb-4">{category}</h5>
                  <div className="space-y-3">
                    {scores.categoryRankings[category]?.slice(0, 5).map((team, idx) => {
                      const maxCategoryScore = Math.max(...(scores.categoryRankings[category]?.map(t => t.categoryAverage) || [1]));
                      const percentage = (team.categoryAverage / maxCategoryScore) * 100;
                      
                      return (
                        <div key={team.team._id} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium text-foreground">{team.team.name}</span>
                            <span className="font-mono text-muted-foreground">{team.categoryAverage.toFixed(2)}</span>
                          </div>
                          <div className="w-full bg-muted/30 rounded-full h-6 overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                idx === 0 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                                idx === 1 ? 'bg-gradient-to-r from-gray-300 to-gray-500' :
                                idx === 2 ? 'bg-gradient-to-r from-orange-400 to-orange-600' :
                                'bg-gradient-to-r from-primary to-accent'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function EventManagementModal({ eventId, onClose }: { eventId: Id<"events">; onClose: () => void }) {
  const event = useQuery(api.events.getEvent, { eventId });
  const eventScores = useQuery(api.scores.getEventScores, { eventId });
  const detailedScores = useQuery(api.scores.getDetailedEventScores, { eventId });
  const updateEventStatus = useMutation(api.events.updateEventStatus);
  const duplicateEvent = useMutation(api.events.duplicateEvent);
  const removeEvent = useMutation(api.events.removeEvent);
  const createTeam = useMutation(api.teams.createTeam);
  const setWinners = useMutation(api.scores.setWinners);
  const releaseResults = useMutation(api.scores.releaseResults);
  const hideTeam = useMutation(api.teams.hideTeam);
  const removeTeam = useMutation(api.teams.removeTeam);

  const [showAddTeam, setShowAddTeam] = useState(false);
  const [showSelectWinners, setShowSelectWinners] = useState(false);
  const [teamMenuOpen, setTeamMenuOpen] = useState<Id<"teams"> | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'scores'>('overview');
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const [isRemovingEvent, setIsRemovingEvent] = useState(false);
  const [isDuplicatingEvent, setIsDuplicatingEvent] = useState(false);

  // Debug logging
  console.log('EventManagementModal - detailedScores:', detailedScores);
  console.log('EventManagementModal - event:', event?.name, 'teams:', event?.teams?.length);

  if (!event) {
    return null;
  }

  const handleStatusChange = async (status: "upcoming" | "active" | "past") => {
    try {
      await updateEventStatus({ eventId, status });
      toast.success("Event status updated!");
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleRemoveEvent = async () => {
    const confirmed = window.confirm(
      `Remove "${event.name}"? This will delete teams, scores, and access for this event.`
    );
    if (!confirmed) return;

    try {
      setIsRemovingEvent(true);
      await removeEvent({ eventId });
      toast.success("Event removed");
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Failed to remove event");
    } finally {
      setIsRemovingEvent(false);
    }
  };

  const handleDuplicateEvent = async () => {
    try {
      setIsDuplicatingEvent(true);
      await duplicateEvent({ eventId });
      toast.success("Event duplicated");
    } catch (error) {
      console.error(error);
      toast.error("Failed to duplicate event");
    } finally {
      setIsDuplicatingEvent(false);
    }
  };

  const handleReleaseResults = async () => {
    try {
      await releaseResults({ eventId });
      toast.success("Results released!");
    } catch (error) {
      toast.error("Failed to release results");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-background rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto border border-border slide-up">
        <div className="sticky top-0 bg-background border-b border-border z-10">
          <div className="p-6 pb-0">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors z-20"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between pr-12">
              <div>
                <h2 className="text-3xl font-heading font-bold text-foreground">{event.name}</h2>
                <p className="text-muted-foreground mt-1">Manage event settings and teams</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleDuplicateEvent}
                  disabled={isDuplicatingEvent}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                    isDuplicatingEvent
                      ? "border-blue-300 text-blue-300 cursor-not-allowed"
                      : "border-blue-500/40 text-blue-500 hover:bg-blue-500/10"
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-4 12h6a2 2 0 002-2v-8a2 2 0 00-2-2h-6a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {isDuplicatingEvent ? "Duplicating..." : "Duplicate"}
                </button>
                <button
                  type="button"
                  onClick={handleRemoveEvent}
                  disabled={isRemovingEvent}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                    isRemovingEvent
                      ? "border-red-400 text-red-400 cursor-not-allowed"
                      : "border-red-500/40 text-red-500 hover:bg-red-500/10"
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {isRemovingEvent ? "Removing..." : "Remove"}
                </button>
              </div>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-1 px-6 mt-4">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'bg-background text-foreground border-t border-x border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('scores')}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                activeTab === 'scores'
                  ? 'bg-background text-foreground border-t border-x border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Scores
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {activeTab === 'overview' && (
            <>
              {/* Event Status */}
              <div className="card p-6">
            <h3 className="text-lg font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Event Status
            </h3>
            <div className="flex gap-3 flex-wrap">
              {(["upcoming", "active", "past"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className={`px-6 py-2.5 rounded-xl font-medium transition-all duration-200 ${
                    event.status === status
                      ? "bg-primary text-white shadow-lg shadow-primary/30 scale-105"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:scale-105"
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Teams */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-heading font-semibold text-foreground flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Teams ({event.teams.length})
              </h3>
              <button
                onClick={() => setShowAddTeam(true)}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Team
              </button>
            </div>
            <div className="space-y-2">
              {event.teams.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No teams added yet</p>
              ) : (
                event.teams.map((team, index) => (
                  <div 
                    key={team._id} 
                    className={`rounded-xl p-4 transition-colors ${
                      index % 2 === 0 
                        ? 'bg-gray-50 dark:bg-white/[0.03] hover:bg-gray-100 dark:hover:bg-white/[0.06]' 
                        : 'bg-gray-100 dark:bg-white/[0.08] hover:bg-gray-200 dark:hover:bg-white/[0.12]'
                    } ${
                      (team as any).hidden ? 'opacity-50 border-2 border-dashed border-yellow-500/50' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-foreground">{team.name}</h4>
                          {(team as any).hidden && (
                            <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs rounded-full">
                              Hidden
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{team.members.join(", ")}</p>
                      </div>
                      <div className="relative ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setTeamMenuOpen(teamMenuOpen === team._id ? null : team._id);
                          }}
                          className="p-1 rounded-lg hover:bg-muted transition-colors"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>
                        {teamMenuOpen === team._id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setTeamMenuOpen(null)}
                            />
                            <div className="absolute right-0 top-8 z-20 bg-background border border-border rounded-lg shadow-xl py-1 min-w-[150px]">
                              <button
                                onClick={async () => {
                                  try {
                                    await hideTeam({ teamId: team._id, hidden: !(team as any).hidden });
                                    toast.success((team as any).hidden ? "Team unhidden" : "Team hidden");
                                    setTeamMenuOpen(null);
                                  } catch (error: any) {
                                    toast.error(error.message);
                                  }
                                }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors"
                              >
                                {(team as any).hidden ? "Unhide Team" : "Hide Team"}
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm(`Are you sure you want to permanently delete "${team.name}"? This will also delete all scores for this team.`)) {
                                    try {
                                      await removeTeam({ teamId: team._id });
                                      toast.success("Team removed");
                                      setTeamMenuOpen(null);
                                    } catch (error: any) {
                                      toast.error(error.message);
                                    }
                                  }
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              >
                                Remove Team
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Scores */}
          {eventScores && eventScores.length > 0 && (
            <div className="card p-6">
              <h3 className="text-lg font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Scores
              </h3>
              <div className="bg-muted/30 rounded-xl overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Rank</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Team</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Avg Score</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Judges</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {eventScores.map((teamScore, index) => (
                      <tr key={teamScore.team._id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-sm font-bold text-foreground">#{index + 1}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-foreground">{teamScore.team.name}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{teamScore.averageScore.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{teamScore.judgeCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

              {/* Actions */}
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => setShowSelectWinners(true)}
                  className="flex-1 min-w-[200px] btn-secondary flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  Select Winners
                </button>
                <button
                  onClick={handleReleaseResults}
                  disabled={event.resultsReleased}
                  className="flex-1 min-w-[200px] bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {event.resultsReleased ? "Results Released" : "Release Results"}
                </button>
              </div>
            </>
          )}

          {activeTab === 'scores' && (
            <>
              {detailedScores ? (
                <ScoringDashboard 
                  scores={detailedScores}
                  viewMode={viewMode}
                  setViewMode={setViewMode}
                />
              ) : (
                <div className="card p-12 text-center">
                  <div className="text-6xl mb-4">📊</div>
                  <h3 className="text-2xl font-heading font-bold text-foreground mb-2">No Scores Yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Judges haven't submitted any scores for this event yet.
                  </p>
                  <div className="max-w-md mx-auto text-left bg-muted/30 rounded-lg p-4 text-sm text-muted-foreground">
                    <p className="font-semibold mb-2">💡 To see demo scores:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Open your Convex dashboard</li>
                      <li>Go to Functions → seed:seedJudgeScores</li>
                      <li>Click "Run" to generate demo data</li>
                    </ol>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showAddTeam && (
        <AddTeamModal
          eventId={eventId}
          onClose={() => setShowAddTeam(false)}
          onSubmit={createTeam}
        />
      )}

      {showSelectWinners && event.teams.length > 0 && (
        <SelectWinnersModal
          eventId={eventId}
          teams={event.teams}
          categories={event.categories}
          onClose={() => setShowSelectWinners(false)}
          onSubmit={setWinners}
        />
      )}
    </div>
  );
}

function SortButton({
  field,
  label,
  sortConfig,
  onSort,
}: {
  field: SortField;
  label: string;
  sortConfig: SortConfig;
  onSort: Dispatch<SetStateAction<SortConfig>>;
}) {
  const isActive = sortConfig.field === field;
  const direction = isActive ? sortConfig.direction : undefined;

  const handleClick = () => {
    onSort((prev) =>
      prev.field === field
        ? { field, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { field, direction: "asc" }
    );
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center gap-2 uppercase tracking-wider text-xs font-bold transition-colors hover:text-foreground focus:outline-none"
    >
      <span>{label}</span>
      <SortIndicator active={isActive} direction={direction} />
      <span className="sr-only">
        {isActive ? `sorted ${direction === "asc" ? "ascending" : "descending"}` : "click to sort"}
      </span>
    </button>
  );
}

function SortIndicator({
  active,
  direction,
}: {
  active: boolean;
  direction?: SortDirection;
}) {
  const symbol = !active ? "⇅" : direction === "asc" ? "↑" : "↓";
  return (
    <span aria-hidden="true" className={`text-[0.7rem] leading-none ${active ? "text-primary" : "text-muted-foreground"}`}>
      {symbol}
    </span>
  );
}

function AddTeamModal({
  eventId,
  onClose,
  onSubmit,
}: {
  eventId: Id<"events">;
  onClose: () => void;
  onSubmit: any;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    members: "",
    projectUrl: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        eventId,
        name: formData.name,
        description: formData.description,
        members: formData.members.split(",").map((m) => m.trim()),
        projectUrl: formData.projectUrl || undefined,
      });
      toast.success("Team added successfully!");
      onClose();
    } catch (error) {
      toast.error("Failed to add team");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div 
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative bg-background rounded-2xl shadow-2xl max-w-md w-full border border-border slide-up">
        <div className="p-6 border-b border-border">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h3 className="text-2xl font-heading font-bold text-foreground">Add Team</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Team Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground"
              placeholder="Code Crusaders"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Description</label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground resize-none"
              placeholder="AI-powered study assistant"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Members (comma-separated)
            </label>
            <input
              type="text"
              required
              value={formData.members}
              onChange={(e) => setFormData({ ...formData, members: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground"
              placeholder="Alice Smith, Bob Johnson, Carol Lee"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Project URL (optional)</label>
            <input
              type="url"
              value={formData.projectUrl}
              onChange={(e) => setFormData({ ...formData, projectUrl: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground"
              placeholder="https://github.com/team/project"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Adding...
                </span>
              ) : (
                "Add Team"
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SelectWinnersModal({
  eventId,
  teams,
  categories,
  onClose,
  onSubmit,
}: {
  eventId: Id<"events">;
  teams: Array<any>;
  categories: string[];
  onClose: () => void;
  onSubmit: any;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [overallWinner, setOverallWinner] = useState<Id<"teams"> | "">("");
  const [categoryWinners, setCategoryWinners] = useState<Record<string, Id<"teams"> | "">>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overallWinner) {
      toast.error("Please select an overall winner");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        eventId,
        overallWinner,
        categoryWinners: Object.entries(categoryWinners)
          .filter(([_, teamId]) => teamId)
          .map(([category, teamId]) => ({ category, teamId })),
      });
      toast.success("Winners selected successfully!");
      onClose();
    } catch (error) {
      toast.error("Failed to select winners");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div 
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative bg-background rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto border border-border slide-up">
        <div className="sticky top-0 bg-background border-b border-border p-6 z-10">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h3 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            Select Winners
          </h3>
          <p className="text-muted-foreground mt-1">Choose the overall winner and category winners</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="card p-6 bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border-yellow-500/20">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
              <span className="text-2xl">🏆</span>
              Overall Winner
            </label>
            <select
              required
              value={overallWinner}
              onChange={(e) => setOverallWinner(e.target.value as Id<"teams">)}
              className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground"
            >
              <option value="">Select a team</option>
              {teams.map((team) => (
                <option key={team._id} value={team._id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <h4 className="text-lg font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="text-xl">🥇</span>
              Category Winners
            </h4>
            <div className="space-y-4">
              {categories.map((category) => (
                <div key={category} className="card p-4">
                  <label className="block text-sm font-medium text-foreground mb-2">{category}</label>
                  <select
                    value={categoryWinners[category] || ""}
                    onChange={(e) =>
                      setCategoryWinners({
                        ...categoryWinners,
                        [category]: e.target.value as Id<"teams">,
                      })
                    }
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground"
                  >
                    <option value="">Select a team</option>
                    {teams.map((team) => (
                      <option key={team._id} value={team._id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="sticky bottom-0 bg-background border-t border-border -mx-6 -mb-6 p-6 flex gap-4">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                "Save Winners"
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
