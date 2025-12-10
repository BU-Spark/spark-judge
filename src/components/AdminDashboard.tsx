import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, Dispatch, SetStateAction } from "react";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";
import { LoadingState } from "./ui/LoadingState";
import { ErrorState } from "./ui/ErrorState";
import { DEFAULT_DEMO_DAY_COURSES } from "../lib/constants";
import { formatDateTime } from "../lib/utils";

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

function SortButton({
  field,
  label,
  sortConfig,
  onSort,
}: {
  field: SortField;
  label: string;
  sortConfig: SortConfig;
  onSort: (config: SortConfig) => void;
}) {
  const isActive = sortConfig.field === field;
  
  return (
    <button
      onClick={() => onSort({
        field,
        direction: isActive && sortConfig.direction === "asc" ? "desc" : "asc"
      })}
      className="flex items-center gap-1 hover:text-foreground transition-colors group"
    >
      {label}
      <span className="flex flex-col ml-1">
        <svg 
          className={`w-2 h-2 -mb-0.5 ${isActive && sortConfig.direction === "asc" ? "text-primary" : "text-muted-foreground/30 group-hover:text-muted-foreground"}`} 
          fill="currentColor" 
          viewBox="0 0 24 24"
        >
          <path d="M12 4l-8 8h16l-8-8z" />
        </svg>
        <svg 
          className={`w-2 h-2 ${isActive && sortConfig.direction === "desc" ? "text-primary" : "text-muted-foreground/30 group-hover:text-muted-foreground"}`} 
          fill="currentColor" 
          viewBox="0 0 24 24"
        >
          <path d="M12 20l8-8H4l8 8z" />
        </svg>
      </span>
    </button>
  );
}

export function AdminDashboard({ onBackToLanding }: { onBackToLanding: () => void }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<Id<"events"> | null>(null);
  const isAdmin = useQuery(api.events.isUserAdmin);

  // Show loading state while checking admin status
  if (isAdmin === undefined) {
    return <LoadingState label="Verifying admin access..." />;
  }

  // Show error if user is not an admin
  if (!isAdmin) {
    return (
      <ErrorState
        title="Access denied"
        description="You need admin privileges to access this dashboard."
        actionLabel="Back to events"
        onAction={onBackToLanding}
      />
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
          <h1 className="text-3xl font-heading font-bold text-foreground mb-2">Admin Dashboard</h1>
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

  if (events === undefined) {
    return <LoadingState label="Loading events..." />;
  }

  if (!events) {
    return (
      <ErrorState
        title="Unable to load events"
        description="Something went wrong while loading events. Please refresh and try again."
        actionLabel="Refresh"
        onAction={() => window.location.reload()}
      />
    );
  }

  const allEvents = [...events.active, ...events.upcoming, ...events.past];

  const statusStyles: Record<"upcoming" | "active" | "past", string> = {
    active: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
    upcoming: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800",
    past: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
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
      <div className="card-static text-center py-12 fade-in">
        <div className="text-6xl mb-4">📅</div>
        <h3 className="text-xl font-heading font-semibold text-foreground mb-2">No Events Yet</h3>
        <p className="text-muted-foreground">Create your first event to get started!</p>
      </div>
    );
  }

  return (
    <div className="card-static overflow-hidden fade-in p-0 bg-white dark:bg-zinc-900 shadow-sm border border-border rounded-lg">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-muted border-b border-border">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <SortButton
                  field="name"
                  label="Event Name"
                  sortConfig={sortConfig}
                  onSort={setSortConfig}
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <SortButton
                  field="status"
                  label="Status"
                  sortConfig={sortConfig}
                  onSort={setSortConfig}
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <SortButton
                  field="teamCount"
                  label="Teams"
                  sortConfig={sortConfig}
                  onSort={setSortConfig}
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <SortButton
                  field="startDate"
                  label="Date"
                  sortConfig={sortConfig}
                  onSort={setSortConfig}
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedEvents.map((event, index) => (
              <tr 
                key={event._id}
                onClick={() => onSelectEvent(event._id)}
                className="transition-colors hover:bg-muted/50 cursor-pointer"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{event.name}</span>
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
                    {formatDateTime(event.startDate)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(event._id);
                      }}
                      className="inline-flex items-center justify-center p-2 rounded-md transition-colors text-primary hover:bg-primary/10"
                      title="Manage event"
                    >
                      <span className="sr-only">Manage event</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.094c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.095c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.02-.398-1.11-.94l-.149-.894c-.071-.424-.383-.764-.781-.93-.397-.164-.853-.142-1.203.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.095c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicateEvent(event._id, event.name);
                      }}
                      disabled={duplicatingEventId === event._id}
                      className={`inline-flex items-center justify-center p-2 rounded-md transition-colors text-blue-500 hover:bg-blue-500/10 ${
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveEvent(event._id, event.name);
                      }}
                      disabled={removingEventId === event._id}
                      className={`inline-flex items-center justify-center p-2 rounded-md transition-colors text-red-500 hover:bg-red-500/10 ${
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
  const [categories, setCategories] = useState([
    { name: "Innovation", weight: 1 },
    { name: "Technical Complexity", weight: 1 },
    { name: "Design", weight: 1 },
    { name: "Presentation", weight: 1 },
    { name: "Impact", weight: 1 },
  ]);
  const [courseCodes, setCourseCodes] = useState<string[]>([...DEFAULT_DEMO_DAY_COURSES]);
  const [newCourseCode, setNewCourseCode] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "upcoming" as "upcoming" | "active" | "past",
    startDate: "",
    endDate: "",
    tracks: "AI/ML,Web Development,Hardware,Mobile,Other",
    judgeCode: "",
    enableCohorts: false,
    mode: "hackathon" as "hackathon" | "demo_day",
  });

  const handleAddCourseCode = () => {
    const code = newCourseCode.trim().toUpperCase();
    if (code && !courseCodes.includes(code)) {
      setCourseCodes([...courseCodes, code]);
      setNewCourseCode("");
    }
  };

  const handleRemoveCourseCode = (code: string) => {
    setCourseCodes(courseCodes.filter((c) => c !== code));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
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
        enableCohorts: formData.enableCohorts || undefined,
        mode: formData.mode,
        courseCodes: formData.mode === "demo_day" ? courseCodes : undefined,
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
              className="input"
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
              className="input h-auto resize-none"
              placeholder="Boston University's premier 24-hour hackathon..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="input"
            >
              <option value="upcoming">Upcoming</option>
              <option value="active">Active</option>
              <option value="past">Past</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Event Mode</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, mode: "hackathon" })}
                className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                  formData.mode === "hackathon"
                    ? "bg-primary text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                🏆 Hackathon
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, mode: "demo_day" })}
                className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                  formData.mode === "demo_day"
                    ? "bg-pink-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                ❤️ Demo Day
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {formData.mode === "hackathon" 
                ? "Traditional judging with scores and categories"
                : "Public appreciation voting - attendees can give hearts to projects"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Start Date</label>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">End Date</label>
              <input
                type="date"
                required
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="input"
              />
            </div>
          </div>

          {/* Hackathon-specific fields */}
          {formData.mode === "hackathon" && (
            <>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Judging Categories & Weights
                </label>
                <div className="space-y-2">
                  {categories.map((cat, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input
                        type="text"
                        required
                        value={cat.name}
                        onChange={(e) => {
                          const newCats = [...categories];
                          newCats[index].name = e.target.value;
                          setCategories(newCats);
                        }}
                        className="input flex-1"
                        placeholder="Category name"
                      />
                      <input
                        type="number"
                        required
                        min="0"
                        max="2"
                        step="0.1"
                        value={cat.weight}
                        onChange={(e) => {
                          const newCats = [...categories];
                          newCats[index].weight = parseFloat(e.target.value) || 1;
                          setCategories(newCats);
                        }}
                        className="input w-24"
                        placeholder="Weight"
                      />
                      <button
                        type="button"
                        onClick={() => setCategories(categories.filter((_, i) => i !== index))}
                        className="p-3 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCategories([...categories, { name: "", weight: 1 }])}
                    className="btn-ghost text-sm"
                  >
                    + Add Category
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Weight range: 0-2. Higher weights increase the category's impact on the total score.
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
                      className="input"
                      placeholder="AI/ML, Web Development, Hardware..."
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      These are the tracks teams can choose when registering
                    </p>
                  </>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    checked={formData.enableCohorts}
                    onChange={(e) => setFormData({ ...formData, enableCohorts: e.target.checked })}
                    className="w-4 h-4 text-primary border-border rounded focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-foreground">
                    Enable Multiple Judging Cohorts
                  </span>
                </label>
                <p className="text-xs text-muted-foreground ml-6 mb-4">
                  Judges will select their own teams to judge (for large events with 40+ teams)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Judge Code (Optional)
                </label>
                <input
                  type="text"
                  value={formData.judgeCode}
                  onChange={(e) => setFormData({ ...formData, judgeCode: e.target.value })}
                  className="input"
                  placeholder="secret-code-123"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  If set, judges must enter this code to start judging active events
                </p>
              </div>
            </>
          )}

          {/* Demo Day-specific fields */}
          {formData.mode === "demo_day" && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Course Codes
              </label>
              <p className="text-xs text-muted-foreground mb-3">
                Teams will select from these courses when submitting their projects.
              </p>
              
              {/* Current course codes */}
              <div className="flex flex-wrap gap-2 mb-3">
                {courseCodes.map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pink-500/10 text-pink-600 dark:text-pink-400 rounded-lg text-sm font-medium"
                  >
                    {code}
                    <button
                      type="button"
                      onClick={() => handleRemoveCourseCode(code)}
                      className="hover:text-pink-800 dark:hover:text-pink-200 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
                {courseCodes.length === 0 && (
                  <span className="text-sm text-muted-foreground italic">No courses added</span>
                )}
              </div>

              {/* Add new course code */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCourseCode}
                  onChange={(e) => setNewCourseCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCourseCode();
                    }
                  }}
                  className="flex-1 input"
                  placeholder="Add course code (e.g., CS101)"
                />
                <button
                  type="button"
                  onClick={handleAddCourseCode}
                  className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-medium transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          )}

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

function EventManagementModal({ eventId, onClose }: { eventId: Id<"events">; onClose: () => void }) {
  const event = useQuery(api.events.getEvent, { eventId });
  const eventScores = useQuery(api.scores.getEventScores, { eventId });
  const detailedScores = useQuery(api.scores.getDetailedEventScores, { eventId });
  const appreciationSummary = useQuery(api.appreciations.getEventAppreciationSummary, { eventId });
  const updateEventStatus = useMutation(api.events.updateEventStatus);
  const updateEventMode = useMutation(api.events.updateEventMode);
  const duplicateEvent = useMutation(api.events.duplicateEvent);
  const removeEvent = useMutation(api.events.removeEvent);
  const createTeam = useMutation(api.teams.createTeam);
  const setWinners = useMutation(api.scores.setWinners);
  const releaseResults = useMutation(api.scores.releaseResults);
  const hideTeam = useMutation(api.teams.hideTeam);
  const removeTeam = useMutation(api.teams.removeTeam);

  const generateQrZip = useAction(api.qrCodes.generateQrCodeZip);

  const [showAddTeam, setShowAddTeam] = useState(false);
  const [showSelectWinners, setShowSelectWinners] = useState(false);
  const [teamMenuOpen, setTeamMenuOpen] = useState<Id<"teams"> | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'scores'>('overview');
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const [isRemovingEvent, setIsRemovingEvent] = useState(false);
  const [isDuplicatingEvent, setIsDuplicatingEvent] = useState(false);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);

  const isDemoDayMode = event?.mode === "demo_day";

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

  const handleModeChange = async (mode: "hackathon" | "demo_day") => {
    try {
      await updateEventMode({ eventId, mode });
      toast.success(`Event mode changed to ${mode === "demo_day" ? "Demo Day" : "Hackathon"}!`);
    } catch (error) {
      toast.error("Failed to update mode");
    }
  };

  const handleExportAppreciationsCsv = () => {
    if (!appreciationSummary) return;
    
    const headers = ["Team Name", "Course Code", "Total Appreciations", "Unique Attendees"];
    const rows = appreciationSummary.teams.map(team => [
      team.teamName,
      team.courseCode || "",
      team.rawScore.toString(),
      // We don't have unique attendees per team in summary, use rawScore as proxy
      team.rawScore.toString(),
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${event?.name || "event"}_appreciations.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV exported!");
  };

  const handleDownloadQrCodes = async () => {
    if (!event) return;
    
    setIsGeneratingQr(true);
    try {
      // Get the current origin for building URLs
      const baseUrl = window.location.origin;
      
      const result = await generateQrZip({
        eventId,
        baseUrl,
      });
      
      if (!result.success || !result.zipBase64) {
        toast.error(result.error || "Failed to generate QR codes");
        return;
      }
      
      // Convert base64 to blob and download
      const binaryString = atob(result.zipBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "application/zip" });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", result.filename || "qr-codes.zip");
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success("QR codes downloaded!");
    } catch (error) {
      console.error("Error downloading QR codes:", error);
      toast.error("Failed to download QR codes");
    } finally {
      setIsGeneratingQr(false);
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
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-3xl font-heading font-bold text-foreground">{event.name}</h2>
                  {isDemoDayMode && (
                    <span className="badge bg-pink-500/20 text-pink-500 border-pink-500/30">
                      Demo Day
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground">Manage event settings and teams</p>
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
              {isDemoDayMode ? "Appreciations" : "Scores"}
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {activeTab === 'overview' && (
            <>
              {/* Event Status */}
              <div className="card-static p-6 bg-white dark:bg-zinc-900">
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
                      className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                        event.status === status
                          ? "bg-primary text-white shadow-md"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Event Mode */}
              <div className="card-static p-6 bg-white dark:bg-zinc-900">
                <h3 className="text-lg font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                  Event Mode
                </h3>
                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={() => handleModeChange("hackathon")}
                    className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                      !isDemoDayMode
                        ? "bg-primary text-white shadow-md"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    🏆 Hackathon
                  </button>
                  <button
                    onClick={() => handleModeChange("demo_day")}
                    className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                      isDemoDayMode
                        ? "bg-pink-500 text-white shadow-md"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    ❤️ Demo Day
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  {isDemoDayMode 
                    ? "Public appreciation voting - attendees can give hearts to projects without signing in"
                    : "Traditional judging with scores and categories - requires judge registration"}
                </p>
              </div>

          {/* Teams */}
          <div className="card-static p-6 bg-white dark:bg-zinc-900">
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
                    className={`rounded-lg p-4 transition-colors border border-border ${
                      index % 2 === 0 
                        ? 'bg-muted/30' 
                        : 'bg-background'
                    } ${
                      (team as any).hidden ? 'opacity-50 border-dashed border-yellow-500/50' : ''
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
                          {isDemoDayMode && (team as any).courseCode && (
                            <span className="px-2 py-0.5 bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 text-xs rounded-full">
                              {(team as any).courseCode}
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

          {/* Scores - only show for hackathon mode */}
          {!isDemoDayMode && eventScores && eventScores.length > 0 && (
            <div className="card-static p-6 bg-white dark:bg-zinc-900">
              <h3 className="text-lg font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Scores
              </h3>
              <div className="bg-muted/30 rounded-lg overflow-hidden border border-border">
                <table className="min-w-full">
                  <thead className="bg-muted/50 border-b border-border">
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
                {event.status === "active" && (
                  <button
                    onClick={() => handleStatusChange("past")}
                    className="flex-1 min-w-[200px] bg-amber-600 hover:bg-amber-700 text-white font-medium py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Finish Event
                  </button>
                )}
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
                  className="flex-1 min-w-[200px] bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
              {isDemoDayMode ? (
                // Demo Day Appreciations View
                appreciationSummary ? (
                  <div className="space-y-6">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="card-static p-6 bg-white dark:bg-zinc-900 text-center">
                        <div className="text-3xl font-bold text-pink-500">{appreciationSummary.totalAppreciations}</div>
                        <div className="text-sm text-muted-foreground mt-1">Total Appreciations</div>
                      </div>
                      <div className="card-static p-6 bg-white dark:bg-zinc-900 text-center">
                        <div className="text-3xl font-bold text-foreground">{appreciationSummary.uniqueAttendees}</div>
                        <div className="text-sm text-muted-foreground mt-1">Unique Attendees</div>
                      </div>
                      <div className="card-static p-6 bg-white dark:bg-zinc-900 text-center">
                        <div className="text-3xl font-bold text-foreground">{appreciationSummary.teams.length}</div>
                        <div className="text-sm text-muted-foreground mt-1">Projects</div>
                      </div>
                    </div>

                    {/* Export Buttons */}
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={handleExportAppreciationsCsv}
                        className="btn-secondary flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export CSV
                      </button>
                      <button
                        onClick={() => void handleDownloadQrCodes()}
                        disabled={isGeneratingQr}
                        className="bg-pink-500 hover:bg-pink-600 text-white font-medium px-4 py-2 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isGeneratingQr ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                            </svg>
                            Download QR Codes
                          </>
                        )}
                      </button>
                    </div>

                    {/* Team Rankings */}
                    <div className="card-static p-6 bg-white dark:bg-zinc-900">
                      <h4 className="text-xl font-heading font-bold text-foreground mb-4">Project Rankings</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead className="bg-muted/50 border-b border-border">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Rank</th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Project</th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Course</th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Appreciations</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {appreciationSummary.teams.map((team, index) => (
                              <tr key={team.teamId} className={index % 2 === 0 ? 'bg-muted/20' : ''}>
                                <td className="px-4 py-3 text-sm font-bold text-foreground">
                                  <span className="flex items-center gap-2">
                                    #{index + 1}
                                    {index === 0 && <span className="text-lg">🥇</span>}
                                    {index === 1 && <span className="text-lg">🥈</span>}
                                    {index === 2 && <span className="text-lg">🥉</span>}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm font-semibold text-foreground">{team.teamName}</td>
                                <td className="px-4 py-3 text-sm text-muted-foreground">
                                  {team.courseCode || "-"}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-pink-500">❤️</span>
                                    <span className="font-bold text-foreground">{team.rawScore}</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="card-static p-12 bg-white dark:bg-zinc-900 text-center">
                    <div className="text-6xl mb-4">❤️</div>
                    <h3 className="text-2xl font-heading font-bold text-foreground mb-2">No Appreciations Yet</h3>
                    <p className="text-muted-foreground">
                      Attendees haven't given any appreciations yet. Share the event link to get started!
                    </p>
                  </div>
                )
              ) : (
                // Hackathon Scores View
                detailedScores ? (
                  <ScoringDashboard 
                    scores={detailedScores}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                  />
                ) : (
                  <div className="card-static p-12 bg-white dark:bg-zinc-900 text-center">
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
                )
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
          eventMode={event.mode}
          courseCodes={event.courseCodes || []}
        />
      )}

      {showSelectWinners && event.teams.length > 0 && (
        <SelectWinnersModal
          eventId={eventId}
          teams={event.teams}
          categories={event.categories.map(c => c.name)}
          onClose={() => setShowSelectWinners(false)}
          onSubmit={setWinners}
        />
      )}
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
  const [sortColumn, setSortColumn] = useState<string>('averageScore');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (column: string) => {
    if (column === sortColumn) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const sortedRankings = [...scores.teamRankings].sort((a, b) => {
    let comparison = 0;
    
    switch (sortColumn) {
      case 'name':
        comparison = a.team.name.localeCompare(b.team.name);
        break;
      case 'averageScore':
        comparison = a.averageScore - b.averageScore;
        break;
      case 'judges':
        comparison = a.judgeCount - b.judgeCount;
        break;
      default:
        // Category columns
        if (scores.categories.includes(sortColumn)) {
          const aScore = a.categoryAverages[sortColumn] || 0;
          const bScore = b.categoryAverages[sortColumn] || 0;
          comparison = aScore - bScore;
        }
        break;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) {
      return (
        <svg className="w-4 h-4 inline-block ml-1 text-muted-foreground opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 inline-block ml-1 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 inline-block ml-1 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

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
                ? 'bg-primary text-white shadow-md'
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
                ? 'bg-primary text-white shadow-md'
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
          <div className="card-static p-6 bg-white dark:bg-zinc-900">
            <h4 className="text-xl font-heading font-bold text-foreground mb-4">Overall Rankings</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-bold text-foreground">
                      Rank
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-sm font-bold text-foreground cursor-pointer hover:bg-muted/70 transition-colors select-none"
                      onClick={() => handleSort('name')}
                    >
                      Team Name
                      <SortIcon column="name" />
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-sm font-bold text-foreground cursor-pointer hover:bg-muted/70 transition-colors select-none"
                      onClick={() => handleSort('averageScore')}
                    >
                      Avg Score
                      <SortIcon column="averageScore" />
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-sm font-bold text-foreground cursor-pointer hover:bg-muted/70 transition-colors select-none"
                      onClick={() => handleSort('judges')}
                    >
                      Judges
                      <SortIcon column="judges" />
                    </th>
                    {scores.categories.map((cat) => (
                      <th 
                        key={cat} 
                        className="px-6 py-4 text-left text-sm font-bold text-foreground cursor-pointer hover:bg-muted/70 transition-colors select-none"
                        onClick={() => handleSort(cat)}
                      >
                        {cat}
                        <SortIcon column={cat} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedRankings.map((ranking, index) => (
                    <tr 
                      key={ranking.team._id}
                      className={index % 2 === 0 ? 'bg-muted/20' : ''}
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
              <div key={category} className="card-static p-6 bg-white dark:bg-zinc-900">
                <h4 className="text-lg font-heading font-bold text-foreground mb-4">{category}</h4>
                <div className="space-y-2">
                  {scores.categoryRankings[category]?.slice(0, 5).map((team, idx) => (
                    <div 
                      key={team.team._id}
                      className={`flex justify-between items-center p-3 rounded-lg ${
                        idx % 2 === 0 ? 'bg-muted/30' : 'bg-background border border-border'
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
          <div className="card-static p-6 bg-white dark:bg-zinc-900">
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
                    <div className="w-full bg-muted rounded-full h-8 overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full flex items-center justify-end pr-3 transition-all duration-500"
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
          <div className="card-static p-6 bg-white dark:bg-zinc-900">
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
                          <div className="w-full bg-muted rounded-full h-6 overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                idx === 0 ? 'bg-amber-400' :
                                idx === 1 ? 'bg-zinc-400' :
                                idx === 2 ? 'bg-orange-400' :
                                'bg-primary'
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

function AddTeamModal({
  eventId,
  onClose,
  onSubmit,
  eventMode,
  courseCodes,
}: {
  eventId: Id<"events">;
  onClose: () => void;
  onSubmit: any;
  eventMode?: "hackathon" | "demo_day";
  courseCodes?: string[];
}) {
  const isDemoDay = eventMode === "demo_day";
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    members: "",
    projectUrl: "",
    courseCode: "",
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
        ...(isDemoDay 
          ? { courseCode: formData.courseCode || undefined }
          : { projectUrl: formData.projectUrl || undefined }
        ),
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
          {/* Course Code (Demo Day) or Project URL (Hackathon) */}
          {isDemoDay ? (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Course <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.courseCode}
                onChange={(e) => setFormData({ ...formData, courseCode: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all text-foreground"
              >
                <option value="">Select course...</option>
                {(courseCodes || []).map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
          ) : (
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
          )}
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
