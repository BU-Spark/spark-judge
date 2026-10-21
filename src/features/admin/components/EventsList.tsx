import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ErrorState } from "../../../components/ui/ErrorState";
import { CalendarIcon } from "../../../components/ui/AppIcons";
import { LoadingState } from "../../../components/ui/LoadingState";
import { formatDateTime } from "../../../lib/utils";
import { getEventDisplayLabel } from "../../../lib/eventModes";
import { useState } from "react";

type SortField = "name" | "status" | "type" | "teamCount" | "startDate";
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
    case "type":
      comparison = getEventDisplayLabel(a.mode).localeCompare(getEventDisplayLabel(b.mode));
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
      className="flex items-center gap-1 hover:fi-ink transition-colors group"
    >
      {label}
      <span className="flex flex-col ml-1">
        <svg
          className={`w-2 h-2 -mb-0.5 ${
            isActive && sortConfig.direction === "asc"
              ? "text-primary"
              : "fi-muted/30 group-hover:fi-muted"
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
              : "fi-muted/30 group-hover:fi-muted"
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
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
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
    active: "bg-emerald-500/10 text-emerald-600  border-emerald-500/20",
    upcoming: "bg-sky-500/10 text-sky-600  border-sky-500/20",
    past: "bg-zinc-500/10 text-zinc-600  border-zinc-500/20",
  };

  const sortedEvents = allEvents.filter((event) => event.name.toLowerCase().includes(search.toLowerCase()) &&
    (filter === "all" || (filter === "unpublished" ? event.status === "past" && !event.resultsReleased : filter === "published" ? event.resultsReleased : event.status === filter)))
    .sort((a, b) => compareEvents(a, b, sortConfig));

  if (allEvents.length === 0) {
    return (
      <div className="fi-panel text-center py-12 fade-in">
        <div className="mb-4 flex justify-center">
          <CalendarIcon className="h-14 w-14 fi-muted" />
        </div>
        <h3 className="text-xl fi-zone font-semibold fi-ink mb-2">No Events Yet</h3>
        <p className="fi-muted">Create your first event to get started!</p>
      </div>
    );
  }

  return (
    <div className="admin-events-list fi-panel overflow-hidden p-0 fi-surface border border-border max-w-full">
      <div className="admin-event-filters">
        <label className="admin-search">Find an event<input type="search" placeholder="Search events" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label className="admin-search">Show<select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">All events</option><option value="unpublished">Finished · results unpublished</option><option value="published">Results published</option><option value="active">Active</option><option value="upcoming">Upcoming</option>
        </select></label>
        <p className="fi-muted" aria-live="polite">{sortedEvents.length} events</p>
      </div>
      {sortedEvents.length === 0 && <p className="p-6 fi-muted">No events match these filters.</p>}
      <div className="max-w-full overflow-x-auto">
        <table className="min-w-full table-fixed md:table-auto">
          <thead className="bg-muted border-b border-border">
            <tr>
              <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold fi-muted uppercase tracking-wider">
                <SortButton field="name" label="Event Name" sortConfig={sortConfig} onSort={setSortConfig} />
              </th>
              <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold fi-muted uppercase tracking-wider">
                <SortButton field="status" label="Status" sortConfig={sortConfig} onSort={setSortConfig} />
              </th>
              <th className="hidden sm:table-cell px-4 sm:px-6 py-3 text-left text-xs font-semibold fi-muted uppercase tracking-wider">
                <SortButton field="type" label="Event Type" sortConfig={sortConfig} onSort={setSortConfig} />
              </th>
              <th className="hidden md:table-cell px-4 sm:px-6 py-3 text-left text-xs font-semibold fi-muted uppercase tracking-wider">
                <SortButton field="teamCount" label="Teams" sortConfig={sortConfig} onSort={setSortConfig} />
              </th>
              <th className="hidden lg:table-cell px-4 sm:px-6 py-3 text-left text-xs font-semibold fi-muted uppercase tracking-wider">
                <SortButton field="startDate" label="Date" sortConfig={sortConfig} onSort={setSortConfig} />
              </th>
              <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold fi-muted uppercase tracking-wider">
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
                <td className="px-4 sm:px-6 py-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-sm font-medium fi-ink break-words">
                      {event.name}
                    </span>
                    {event.hidden && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/15 text-xs font-medium text-amber-600 ">
                        Admin only
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                  <span className={`badge ${statusStyles[event.status as "upcoming" | "active" | "past"]}`}>
                    {event.status}
                  </span>
                  <p className="text-xs fi-muted mt-2">{event.resultsReleased ? "Results published" : event.status === "past" ? "Results unpublished" : "Results draft"}</p>
                </td>
                <td className="hidden sm:table-cell px-4 sm:px-6 py-4 whitespace-nowrap">
                  <span className="text-sm fi-muted">
                    {getEventDisplayLabel(event.mode)}
                  </span>
                </td>
                <td className="hidden md:table-cell px-4 sm:px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2 text-sm fi-muted">
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
                <td className="hidden lg:table-cell px-4 sm:px-6 py-4 whitespace-nowrap text-sm fi-muted">
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
                <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm">
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
