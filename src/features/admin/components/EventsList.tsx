import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ErrorState } from "../../../components/ui/ErrorState";
import { CalendarIcon } from "../../../components/ui/AppIcons";
import { LoadingState } from "../../../components/ui/LoadingState";
import { formatDateTime } from "../../../lib/utils";
import { useState } from "react";

type SortField = "name" | "status" | "teamCount" | "startDate";
type SortDirection = "asc" | "desc";
type SortConfig = { field: SortField; direction: SortDirection };

const STATUS_SORT_ORDER: Record<"active" | "upcoming" | "past", number> = {
  active: 0,
  upcoming: 1,
  past: 2,
};

function compareEvents(a: any, b: any, sortConfig: SortConfig) {
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
      onClick={() =>
        onSort({
          field,
          direction: isActive && sortConfig.direction === "asc" ? "desc" : "asc",
        })
      }
      className="flex items-center gap-1 hover:text-foreground transition-colors group"
    >
      {label}
      <span className="flex flex-col ml-1">
        <svg
          className={`w-2 h-2 -mb-0.5 ${
            isActive && sortConfig.direction === "asc"
              ? "text-primary"
              : "text-muted-foreground/30 group-hover:text-muted-foreground"
          }`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 4l-8 8h16l-8-8z" />
        </svg>
        <svg
          className={`w-2 h-2 ${
            isActive && sortConfig.direction === "desc"
              ? "text-primary"
              : "text-muted-foreground/30 group-hover:text-muted-foreground"
          }`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 20l8-8H4l8 8z" />
        </svg>
      </span>
    </button>
  );
}

export function EventsList({
  onSelectEvent,
}: {
  onSelectEvent: (eventId: Id<"events">) => void;
}) {
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
    active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    upcoming: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    past: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  };

  const handleRemoveEvent = async (eventId: Id<"events">, name: string) => {
    const confirmed = window.confirm(
      `Remove "${name}"? This will delete teams, scores, and access for this event.`
    );
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

  const sortedEvents = [...allEvents].sort((a, b) => compareEvents(a, b, sortConfig));

  if (sortedEvents.length === 0) {
    return (
      <div className="card-static text-center py-12 fade-in">
        <div className="mb-4 flex justify-center">
          <CalendarIcon className="h-14 w-14 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-heading font-semibold text-foreground mb-2">No Events Yet</h3>
        <p className="text-muted-foreground">Create your first event to get started!</p>
      </div>
    );
  }

  return (
    <div className="card-static overflow-hidden fade-in p-0 bg-card shadow-sm border border-border rounded-lg">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-muted border-b border-border">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <SortButton field="name" label="Event Name" sortConfig={sortConfig} onSort={setSortConfig} />
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <SortButton field="status" label="Status" sortConfig={sortConfig} onSort={setSortConfig} />
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <SortButton field="teamCount" label="Teams" sortConfig={sortConfig} onSort={setSortConfig} />
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <SortButton field="startDate" label="Date" sortConfig={sortConfig} onSort={setSortConfig} />
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedEvents.map((event) => (
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
                  <span className={`badge ${statusStyles[event.status as "upcoming" | "active" | "past"]}`}>
                    {event.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    {event.teamCount}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
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
                      className="inline-flex items-center justify-center p-2 rounded-md transition-colors text-primary hover:bg-teal-500/10"
                      title="Manage event"
                    >
                      <span className="sr-only">Manage event</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.8}
                          d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.094c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.095c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.02-.398-1.11-.94l-.149-.894c-.071-.424-.383-.764-.781-.93-.397-.164-.853-.142-1.203.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.095c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.8}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDuplicateEvent(event._id, event.name);
                      }}
                      disabled={duplicatingEventId === event._id}
                      className={`inline-flex items-center justify-center p-2 rounded-md transition-colors text-blue-500 hover:bg-blue-500/10 ${
                        duplicatingEventId === event._id ? "opacity-60 cursor-not-allowed" : ""
                      }`}
                      title="Duplicate event"
                    >
                      <span className="sr-only">Duplicate event</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-4 12h6a2 2 0 002-2v-8a2 2 0 00-2-2h-6a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleRemoveEvent(event._id, event.name);
                      }}
                      disabled={removingEventId === event._id}
                      className={`inline-flex items-center justify-center p-2 rounded-md transition-colors text-red-500 hover:bg-red-500/10 ${
                        removingEventId === event._id ? "opacity-60 cursor-not-allowed" : ""
                      }`}
                      title="Remove event"
                    >
                      <span className="sr-only">Remove event</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
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
