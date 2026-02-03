import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useEffect, useMemo, Dispatch, SetStateAction } from "react";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";
import { LoadingState } from "./ui/LoadingState";
import { ErrorState } from "./ui/ErrorState";
import { DEFAULT_DEMO_DAY_COURSES } from "../lib/constants";
import { formatDateTime } from "../lib/utils";
import {
  Card,
  Table,
  TableHead,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Text,
  Title,
  Subtitle,
  Badge,
  Button,
  Flex,
  Icon,
  TextInput,
  Textarea,
  NumberInput,
  TabGroup,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Grid,
  Dialog,
  DialogPanel,
  Select,
  SelectItem,
  BarList,
} from "@tremor/react";
import {
  PlusIcon,
  ArrowLeftIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  Cog6ToothIcon,
  UserGroupIcon,
  CalendarIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  HeartIcon,
  TrophyIcon,
  PencilSquareIcon,
  EyeSlashIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

type SortField = "name" | "status" | "teamCount" | "startDate";
type SortDirection = "asc" | "desc";
type SortConfig = { field: SortField; direction: SortDirection };

const STATUS_SORT_ORDER: Record<"active" | "upcoming" | "past", number> = {
  active: 0,
  upcoming: 1,
  past: 2,
};

function formatDateTimeInput(timestamp: number) {
  const date = new Date(timestamp);
  // Convert to local time for datetime-local input
  const offset = date.getTimezoneOffset();
  const local = new Date(timestamp - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

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
    <Flex
      justifyContent="start"
      className="cursor-pointer group gap-1"
      onClick={() => onSort({
        field,
        direction: isActive && sortConfig.direction === "asc" ? "desc" : "asc"
      })}
    >
      <Text className={`font-semibold uppercase text-xs ${isActive ? "text-tremor-content-emphasis" : "text-tremor-content"}`}>
        {label}
      </Text>
      <Flex flexDirection="col" className="w-auto gap-0">
        <Icon
          icon={ChevronUpIcon}
          size="xs"
          variant="simple"
          color={isActive && sortConfig.direction === "asc" ? "teal" : "gray"}
          className="-mb-1.5"
        />
        <Icon
          icon={ChevronDownIcon}
          size="xs"
          variant="simple"
          color={isActive && sortConfig.direction === "desc" ? "teal" : "gray"}
        />
      </Flex>
    </Flex>
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
    <div className="min-h-screen bg-mesh">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Button
          variant="light"
          icon={ArrowLeftIcon}
          onClick={onBackToLanding}
          className="mb-6"
        >
          Back to Events
        </Button>

        <Flex justifyContent="between" alignItems="end" className="mb-8">
          <div>
            <Title className="text-3xl">Admin Dashboard</Title>
            <Text>Manage your hackathon events and teams</Text>
          </div>
          <Button
            icon={PlusIcon}
            onClick={() => setIsCreateOpen(true)}
          >
            Create Event
          </Button>
        </Flex>

        <EventsList onSelectEvent={setSelectedEventId} />

        {isCreateOpen && <CreateEventModal onClose={() => setIsCreateOpen(false)} />}
        {selectedEventId && (
          <EventManagementModal eventId={selectedEventId} onClose={() => setSelectedEventId(null)} />
        )}
      </div>
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

  const statusColors: Record<"upcoming" | "active" | "past", "sky" | "emerald" | "zinc"> = {
    active: "emerald",
    upcoming: "sky",
    past: "zinc",
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
      <Card className="text-center py-12">
        <div className="text-6xl mb-4">📅</div>
        <Title className="mb-2">No Events Yet</Title>
        <Text>Create your first event to get started!</Text>
      </Card>
    );
  }

  return (
    <Card className="p-0 overflow-hidden">
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>
              <SortButton
                field="name"
                label="Event Name"
                sortConfig={sortConfig}
                onSort={setSortConfig}
              />
            </TableHeaderCell>
            <TableHeaderCell>
              <SortButton
                field="status"
                label="Status"
                sortConfig={sortConfig}
                onSort={setSortConfig}
              />
            </TableHeaderCell>
            <TableHeaderCell>
              <SortButton
                field="teamCount"
                label="Teams"
                sortConfig={sortConfig}
                onSort={setSortConfig}
              />
            </TableHeaderCell>
            <TableHeaderCell>
              <SortButton
                field="startDate"
                label="Date"
                sortConfig={sortConfig}
                onSort={setSortConfig}
              />
            </TableHeaderCell>
            <TableHeaderCell>
              <Text className="text-xs font-semibold uppercase text-tremor-content">Actions</Text>
            </TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedEvents.map((event) => (
            <TableRow
              key={event._id}
              onClick={() => onSelectEvent(event._id)}
              className="hover:bg-tremor-background-muted cursor-pointer transition-colors"
            >
              <TableCell>
                <Text className="font-medium text-tremor-content-emphasis">{event.name}</Text>
              </TableCell>
              <TableCell>
                <Badge color={statusColors[event.status as "upcoming" | "active" | "past"]}>
                  {event.status}
                </Badge>
              </TableCell>
              <TableCell>
                <Flex justifyContent="start" className="gap-2">
                  <Icon icon={UserGroupIcon} size="xs" color="gray" variant="simple" />
                  <Text>{event.teamCount}</Text>
                </Flex>
              </TableCell>
              <TableCell>
                <Flex justifyContent="start" className="gap-2">
                  <Icon icon={CalendarIcon} size="xs" color="gray" variant="simple" />
                  <Text>{formatDateTime(event.startDate)}</Text>
                </Flex>
              </TableCell>
              <TableCell>
                <Flex justifyContent="start" className="gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    icon={Cog6ToothIcon}
                    variant="light"
                    size="xs"
                    color="teal"
                    onClick={() => onSelectEvent(event._id)}
                    tooltip="Manage event"
                  />
                  <Button
                    icon={DocumentDuplicateIcon}
                    variant="light"
                    size="xs"
                    color="blue"
                    loading={duplicatingEventId === event._id}
                    onClick={() => handleDuplicateEvent(event._id, event.name)}
                    tooltip="Duplicate event"
                  />
                  <Button
                    icon={TrashIcon}
                    variant="light"
                    size="xs"
                    color="red"
                    loading={removingEventId === event._id}
                    onClick={() => handleRemoveEvent(event._id, event.name)}
                    tooltip="Remove event"
                  />
                </Flex>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function CreateEventModal({ onClose }: { onClose: () => void }) {
  const createEvent = useMutation(api.events.createEvent);
  const [submitting, setSubmitting] = useState(false);
  const [useTracksAsAwards, setUseTracksAsAwards] = useState(true);
  const [categories, setCategories] = useState([
    { name: "Innovation", weight: 1, optOutAllowed: false },
    { name: "Technical Complexity", weight: 1, optOutAllowed: false },
    { name: "Design", weight: 1, optOutAllowed: false },
    { name: "Presentation", weight: 1, optOutAllowed: false },
    { name: "Impact", weight: 1, optOutAllowed: false },
  ]);
  const [courseCodes, setCourseCodes] = useState<string[]>([...DEFAULT_DEMO_DAY_COURSES]);
  const [newCourseCode, setNewCourseCode] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    startDate: "",
    endDate: "",
    tracks: "AI/ML,Web Development,Hardware,Mobile,Other",
    judgeCode: "",
    enableCohorts: false,
    mode: "hackathon" as "hackathon" | "demo_day",
  });

  const getTimestamp = (value: string) => {
    const ts = new Date(value).getTime();
    return Number.isFinite(ts) ? ts : null;
  };

  const startTimestamp = useMemo(
    () => getTimestamp(formData.startDate),
    [formData.startDate]
  );

  const endTimestamp = useMemo(
    () => getTimestamp(formData.endDate),
    [formData.endDate]
  );

  const derivedStatus = useMemo(() => {
    if (startTimestamp === null || endTimestamp === null) return null;
    if (startTimestamp >= endTimestamp) return null;
    const now = Date.now();
    if (now < startTimestamp) return "upcoming";
    if (now > endTimestamp) return "past";
    return "active";
  }, [startTimestamp, endTimestamp]);

  const hasInvalidRange = useMemo(
    () =>
      startTimestamp !== null &&
      endTimestamp !== null &&
      startTimestamp >= endTimestamp,
    [startTimestamp, endTimestamp]
  );

  const statusBadgeColor = useMemo(() => {
    switch (derivedStatus) {
      case "active": return "emerald";
      case "past": return "orange";
      case "upcoming": return "blue";
      default: return "gray";
    }
  }, [derivedStatus]);

  const statusBadgeLabel = useMemo(() => {
    if (!derivedStatus) return null;
    if (derivedStatus === "active") return "Active (happening now)";
    if (derivedStatus === "past") return "Past (already ended)";
    return "Upcoming (scheduled)";
  }, [derivedStatus]);

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

    const startMs = startTimestamp ?? getTimestamp(formData.startDate);
    const endMs = endTimestamp ?? getTimestamp(formData.endDate);

    if (startMs === null || endMs === null) {
      toast.error("Please provide both start and end date/time.");
      setSubmitting(false);
      return;
    }

    if (startMs >= endMs) {
      toast.error("End time must be after the start time.");
      setSubmitting(false);
      return;
    }

    const cleanedCategories = categories
      .map((cat) => ({
        name: cat.name.trim(),
        weight: Math.min(2, Math.max(0, Number(cat.weight) || 0)),
        optOutAllowed: cat.optOutAllowed ?? false,
      }))
      .filter((cat) => cat.name.length > 0);

    if (cleanedCategories.length === 0) {
      toast.error("Add at least one judging category with a name.");
      setSubmitting(false);
      return;
    }

    const computedStatus = derivedStatus ?? "upcoming";

    try {
      const tracks = useTracksAsAwards
        ? undefined
        : formData.tracks.split(",").map((t) => t.trim()).filter(Boolean);

      await createEvent({
        name: formData.name,
        description: formData.description,
        status: computedStatus,
        startDate: startMs,
        endDate: endMs,
        categories: cleanedCategories,
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
    <Dialog open={true} onClose={onClose} static={true}>
      <DialogPanel className="max-w-2xl w-full max-h-[90vh] overflow-auto p-0 border border-tremor-border shadow-2xl">
        <div className="sticky top-0 bg-tremor-background border-b border-tremor-border p-6 z-10">
          <Flex justifyContent="between">
            <Title className="text-2xl">Create New Event</Title>
            <Button
              variant="light"
              color="gray"
              onClick={onClose}
              icon={Cog6ToothIcon}
            />
          </Flex>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <Text className="font-medium mb-2">Event Name</Text>
            <TextInput
              required
              value={formData.name}
              onValueChange={(value) => setFormData({ ...formData, name: value })}
              placeholder="HackBU Fall 2024"
            />
          </div>

          <div>
            <Text className="font-medium mb-2">Description</Text>
            <Textarea
              required
              value={formData.description}
              onValueChange={(value) => setFormData({ ...formData, description: value })}
              rows={3}
              placeholder="Boston University's premier 24-hour hackathon..."
            />
          </div>

          <div>
            <Flex className="mb-3">
              <Text className="font-medium">Schedule</Text>
              {statusBadgeLabel && (
                <Badge color={statusBadgeColor}>{statusBadgeLabel}</Badge>
              )}
            </Flex>

            <Grid numItems={2} className="gap-4">
              <div>
                <Text className="text-xs mb-1">Start Date & Time</Text>
                <input
                  type="datetime-local"
                  required
                  step="900"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full flex items-center justify-between gap-x-2 bg-tremor-background border px-3 py-2 text-tremor-default shadow-tremor-input border-tremor-border rounded-tremor-default focus:border-tremor-brand-subtle focus:ring-tremor-brand-muted outline-none transition duration-100"
                />
              </div>
              <div>
                <Text className="text-xs mb-1">End Date & Time</Text>
                <input
                  type="datetime-local"
                  required
                  step="900"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full flex items-center justify-between gap-x-2 bg-tremor-background border px-3 py-2 text-tremor-default shadow-tremor-input border-tremor-border rounded-tremor-default focus:border-tremor-brand-subtle focus:ring-tremor-brand-muted outline-none transition duration-100"
                />
              </div>
            </Grid>

            {hasInvalidRange && (
              <Text color="red" className="text-xs mt-2">End time must be after the start time.</Text>
            )}
          </div>

          <div>
            <Text className="font-medium mb-2">Event Mode</Text>
            <Flex className="gap-3">
              <Button
                type="button"
                onClick={() => setFormData({ ...formData, mode: "hackathon" })}
                variant={formData.mode === "hackathon" ? "primary" : "secondary"}
                className="flex-1"
                color="teal"
              >
                🏆 Hackathon
              </Button>
              <Button
                type="button"
                onClick={() => setFormData({ ...formData, mode: "demo_day" })}
                variant={formData.mode === "demo_day" ? "primary" : "secondary"}
                className="flex-1"
                color="pink"
              >
                ❤️ Demo Day
              </Button>
            </Flex>
            <Text className="text-xs text-tremor-content mt-2">
              {formData.mode === "hackathon"
                ? "Traditional judging with scores and categories"
                : "Public appreciation voting - attendees can give hearts to projects"}
            </Text>
          </div>

          {/* Hackathon-specific fields */}
          {formData.mode === "hackathon" && (
            <>
              <div>
                <Text className="font-medium mb-3">
                  Judging Categories & Weights (0-2)
                </Text>
                <div className="rounded-tremor-default border border-tremor-border">
                  <Grid numItems={4} className="gap-2 px-3 py-2 text-xs text-tremor-content uppercase tracking-wide border-b border-tremor-border bg-tremor-background-muted">
                    <Text className="text-xs font-semibold">Category</Text>
                    <Text className="text-xs font-semibold">Weight</Text>
                    <Text className="text-xs font-semibold">Opt-out</Text>
                    <span />
                  </Grid>
                  <div className="divide-y divide-tremor-border">
                    {categories.map((cat, index) => (
                      <Grid key={index} numItems={4} className="gap-2 items-center p-3">
                        <TextInput
                          required
                          value={cat.name}
                          onValueChange={(value) => {
                            const newCats = [...categories];
                            newCats[index].name = value;
                            setCategories(newCats);
                          }}
                          placeholder="Innovation"
                        />
                        <NumberInput
                          required
                          min={0}
                          max={2}
                          step={0.1}
                          value={cat.weight}
                          onValueChange={(value) => {
                            const newCats = [...categories];
                            newCats[index].weight = value || 0;
                            setCategories(newCats);
                          }}
                        />
                        <Flex justifyContent="start" className="gap-2">
                          <input
                            type="checkbox"
                            checked={cat.optOutAllowed ?? false}
                            onChange={(e) => {
                              const newCats = [...categories];
                              newCats[index].optOutAllowed = e.target.checked;
                              setCategories(newCats);
                            }}
                            className="w-4 h-4 text-tremor-brand border-tremor-border rounded"
                          />
                          <Text className="text-xs">Allow</Text>
                        </Flex>
                        <Button
                          variant="light"
                          color="red"
                          icon={TrashIcon}
                          onClick={() => setCategories(categories.filter((_, i) => i !== index))}
                        />
                      </Grid>
                    ))}
                  </div>
                </div>
                <Button
                  variant="light"
                  className="mt-3"
                  onClick={() => setCategories([...categories, { name: "", weight: 1, optOutAllowed: false }])}
                >
                  + Add Category
                </Button>
              </div>

              <div>
                <Flex justifyContent="start" className="gap-2 mb-3">
                  <input
                    type="checkbox"
                    checked={useTracksAsAwards}
                    onChange={(e) => setUseTracksAsAwards(e.target.checked)}
                    className="w-4 h-4 text-tremor-brand border-tremor-border rounded"
                  />
                  <Text className="font-medium">
                    Use awards as tracks (teams choose from same list)
                  </Text>
                </Flex>

                {!useTracksAsAwards && (
                  <>
                    <Text className="font-medium mb-2">Tracks (comma-separated)</Text>
                    <TextInput
                      required
                      value={formData.tracks}
                      onValueChange={(value) => setFormData({ ...formData, tracks: value })}
                      placeholder="AI/ML, Web Development, Hardware..."
                    />
                    <Text className="text-xs text-tremor-content mt-2">
                      These are the tracks teams can choose when registering
                    </Text>
                  </>
                )}
              </div>

              <div>
                <Flex justifyContent="start" className="gap-2 mb-1">
                  <input
                    type="checkbox"
                    checked={formData.enableCohorts}
                    onChange={(e) => setFormData({ ...formData, enableCohorts: e.target.checked })}
                    className="w-4 h-4 text-tremor-brand border-tremor-border rounded"
                  />
                  <Text className="font-medium">Enable Multiple Judging Cohorts</Text>
                </Flex>
                <Text className="text-xs text-tremor-content ml-6 mb-4">
                  Judges will select their own teams to judge (for large events)
                </Text>

                <Text className="font-medium mb-2">Judge Code (Optional)</Text>
                <TextInput
                  value={formData.judgeCode}
                  onValueChange={(value) => setFormData({ ...formData, judgeCode: value })}
                  placeholder="secret-code-123"
                />
              </div>
            </>
          )}

          {formData.mode === "demo_day" && (
            <div className="space-y-4">
              <Text className="font-medium">Public Voting Settings</Text>
              <Text className="text-xs text-tremor-content">
                Teams will select from these courses when submitting their projects.
              </Text>

              <div className="flex flex-wrap gap-2">
                {courseCodes.map((code) => (
                  <Badge key={code} color="pink">
                    <Flex className="gap-1">
                      {code}
                      <button
                        type="button"
                        onClick={() => handleRemoveCourseCode(code)}
                        className="hover:text-pink-800"
                      >
                        ×
                      </button>
                    </Flex>
                  </Badge>
                ))}
                {courseCodes.length === 0 && (
                  <Text className="italic">No courses added</Text>
                )}
              </div>

              <Flex className="gap-2">
                <TextInput
                  value={newCourseCode}
                  onValueChange={setNewCourseCode}
                  placeholder="Add course code (e.g., CS101)"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCourseCode();
                    }
                  }}
                />
                <Button onClick={handleAddCourseCode} color="pink">
                  Add
                </Button>
              </Flex>
            </div>
          )}

          <div className="sticky bottom-0 bg-tremor-background border-t border-tremor-border -mx-6 -mb-6 p-6 flex gap-4">
            <Button
              type="submit"
              loading={submitting}
              className="flex-1"
            >
              Create Event
            </Button>
            <Button
              type="button"
              onClick={onClose}
              disabled={submitting}
              variant="secondary"
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogPanel>
    </Dialog>
  );
}

function EventManagementModal({ eventId, onClose }: { eventId: Id<"events">; onClose: () => void }) {
  const event = useQuery(api.events.getEvent, { eventId });
  const eventScores = useQuery(api.scores.getEventScores, { eventId });
  const detailedScores = useQuery(api.scores.getDetailedEventScores, { eventId });
  const appreciationSummary = useQuery(api.appreciations.getEventAppreciationSummary, { eventId });
  const updateEventDetails = useMutation(api.events.updateEventDetails);
  const updateEventCategories = useMutation(api.events.updateEventCategories);
  const updateEventCohorts = useMutation(api.events.updateEventCohorts);
  const updateEventMode = useMutation(api.events.updateEventMode);
  const duplicateEvent = useMutation(api.events.duplicateEvent);
  const removeEvent = useMutation(api.events.removeEvent);
  const createTeam = useMutation(api.teams.createTeam);
  const updateTeamAdmin = useMutation(api.teams.updateTeamAdmin);
  const setWinners = useMutation(api.scores.setWinners);
  const releaseResults = useMutation(api.scores.releaseResults);
  const hideTeam = useMutation(api.teams.hideTeam);
  const removeTeam = useMutation(api.teams.removeTeam);
  const updateStatus = useMutation(api.events.updateEventStatus);

  const generateQrZip = useAction(api.qrCodes.generateQrCodeZip);

  const handleStatusChange = (status: string) => {
    updateStatus({ eventId, status: status as "active" | "upcoming" | "past" });
  };

  const [showAddTeam, setShowAddTeam] = useState(false);
  const [editingTeam, setEditingTeam] = useState<any | null>(null);
  const [showSelectWinners, setShowSelectWinners] = useState(false);
  const [teamMenuOpen, setTeamMenuOpen] = useState<Id<"teams"> | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'scores'>('overview');
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const [isRemovingEvent, setIsRemovingEvent] = useState(false);
  const [isDuplicatingEvent, setIsDuplicatingEvent] = useState(false);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [eventName, setEventName] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [categoriesEdit, setCategoriesEdit] = useState<Array<{ name: string; weight: number; optOutAllowed?: boolean }>>([]);
  const [enableCohorts, setEnableCohorts] = useState(false);
  const [judgeCodeEdit, setJudgeCodeEdit] = useState("");
  const [savingJudgeSettings, setSavingJudgeSettings] = useState(false);
  const [appreciationBudget, setAppreciationBudget] = useState<number>(100);
  const [savingAppreciationSettings, setSavingAppreciationSettings] = useState(false);

  // Sync editable fields when event changes
  useEffect(() => {
    if (event) {
      setEventName(event.name || "");
      setEventDescription(event.description || "");
      setEventStart(formatDateTimeInput(event.startDate));
      setEventEnd(formatDateTimeInput(event.endDate));
      setCategoriesEdit(
        (event.categories || []).map((cat: any) => ({
          name: typeof cat === "string" ? cat : cat.name,
          weight: typeof cat === "string" ? 1 : cat.weight ?? 1,
          optOutAllowed: typeof cat === "string" ? false : cat.optOutAllowed ?? false,
        }))
      );
      setEnableCohorts(!!event.enableCohorts);
      setJudgeCodeEdit(event.judgeCode || "");
      setAppreciationBudget(
        typeof event.appreciationBudgetPerAttendee === "number"
          ? event.appreciationBudgetPerAttendee
          : 100
      );
    }
  }, [event]);

  if (!event) {
    return null;
  }

  const isDemoDayMode = event.mode === "demo_day";

  const derivedStatus = (() => {
    const now = Date.now();
    if (now < event.startDate) return "upcoming";
    if (now > event.endDate) return "past";
    return "active";
  })();

  const scoresLoaded = eventScores !== undefined;
  // Treat judging as started only if any team has at least one score submitted.
  const hasScores =
    eventScores?.some(
      (teamScore) =>
        (teamScore as any)?.judgeCount > 0 ||
        ((teamScore as any)?.scores?.length || 0) > 0
    ) ?? false;

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

  const handleSaveDetails = async () => {
    if (!eventName.trim()) {
      toast.error("Event name is required");
      return;
    }

    if (!eventStart || !eventEnd) {
      toast.error("Start and end date/time are required");
      return;
    }

    const startMs = Date.parse(eventStart);
    const endMs = Date.parse(eventEnd);

    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      toast.error("Please provide valid dates");
      return;
    }

    if (endMs < startMs) {
      toast.error("End date/time must be after start date/time");
      return;
    }

    setSavingDetails(true);
    try {
      await updateEventDetails({
        eventId,
        name: eventName.trim(),
        description: eventDescription.trim(),
        startDate: startMs,
        endDate: endMs,
      });
      toast.success("Event details saved");
    } catch (error) {
      toast.error("Failed to save details");
    } finally {
      setSavingDetails(false);
    }
  };

  const handleSaveJudgeSettings = async () => {
    const scoresLoaded = eventScores !== undefined;
    const hasScores =
      eventScores?.some(
        (teamScore) =>
          (teamScore as any)?.judgeCount > 0 ||
          ((teamScore as any)?.scores?.length || 0) > 0
      ) ?? false;

    if (!scoresLoaded) {
      toast.error("Scores are still loading. Please try again.");
      return;
    }

    if (hasScores) {
      toast.error("Judging has started; these settings are locked.");
      return;
    }

    const cleanedCategories = categoriesEdit
      .map((cat) => ({
        name: cat.name.trim(),
        weight: Math.min(2, Math.max(0, Number(cat.weight) || 0)),
        optOutAllowed: cat.optOutAllowed ?? false,
      }))
      .filter((cat) => cat.name.length > 0);

    if (cleanedCategories.length === 0) {
      toast.error("Add at least one category with a name.");
      return;
    }

    setSavingJudgeSettings(true);
    try {
      await Promise.all([
        updateEventCategories({ eventId, categories: cleanedCategories }),
        updateEventCohorts({ eventId, enableCohorts }),
        updateEventDetails({
          eventId,
          judgeCode: judgeCodeEdit.trim() || null,
        }),
      ]);
      toast.success("Judging settings updated");
    } catch (error) {
      toast.error("Failed to save judging settings");
    } finally {
      setSavingJudgeSettings(false);
    }
  };

  const handleSaveAppreciationSettings = async () => {
    const parsed = Number(appreciationBudget);
    const budgetValue = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    setSavingAppreciationSettings(true);
    try {
      await updateEventDetails({
        eventId,
        appreciationBudgetPerAttendee: budgetValue,
      });
      toast.success("Appreciation settings saved");
    } catch (error) {
      toast.error("Failed to save appreciation settings");
    } finally {
      setSavingAppreciationSettings(false);
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
    <Dialog open={true} onClose={onClose} static={true}>
      <DialogPanel className="max-w-4xl w-full max-h-[90vh] overflow-auto p-0 border border-tremor-border shadow-2xl">
        <div className="sticky top-0 bg-tremor-background border-b border-tremor-border z-10">
          <div className="p-6">
            <Flex justifyContent="between" alignItems="start">
              <div>
                <Flex justifyContent="start" className="gap-3 mb-1">
                  <Title className="text-3xl">{event.name}</Title>
                  {isDemoDayMode && (
                    <Badge color="pink">Demo Day</Badge>
                  )}
                </Flex>
                <Text>Manage event settings, teams, and scoring</Text>
              </div>
              <Flex className="w-auto gap-2">
                <Button
                  variant="secondary"
                  color="blue"
                  icon={DocumentDuplicateIcon}
                  onClick={handleDuplicateEvent}
                  loading={isDuplicatingEvent}
                >
                  Duplicate
                </Button>
                <Button
                  variant="secondary"
                  color="red"
                  icon={TrashIcon}
                  onClick={handleRemoveEvent}
                  loading={isRemovingEvent}
                >
                  Remove
                </Button>
                <Button
                  variant="light"
                  color="gray"
                  icon={Cog6ToothIcon}
                  onClick={onClose}
                  className="ml-2"
                />
              </Flex>
            </Flex>
          </div>

          <TabGroup index={activeTab === 'overview' ? 0 : 1} onIndexChange={(index) => setActiveTab(index === 0 ? 'overview' : 'scores')}>
            <TabList className="px-6">
              <Tab icon={CalendarIcon}>Overview</Tab>
              <Tab icon={isDemoDayMode ? HeartIcon : TrophyIcon}>
                {isDemoDayMode ? "Appreciations" : "Scores"}
              </Tab>
            </TabList>
          </TabGroup>
        </div>

        <div className="p-6">
          <TabGroup index={activeTab === 'overview' ? 0 : 1}>
            <TabPanels>
              <TabPanel>
                <div className="space-y-6">
                  {/* Event Details */}
                  <Card className="p-6">
                    <Flex justifyContent="between" alignItems="start" className="mb-4">
                      <div>
                        <Title>Event Details</Title>
                        <Text>Basic information and schedule</Text>
                      </div>
                      <Badge color={
                        derivedStatus === "active" ? "emerald" :
                          derivedStatus === "upcoming" ? "blue" : "gray"
                      }>
                        {derivedStatus.charAt(0).toUpperCase() + derivedStatus.slice(1)}
                      </Badge>
                    </Flex>

                    <Grid numItems={1} numItemsMd={2} className="gap-4">
                      <div className="space-y-1">
                        <Text className="font-medium">Event Title</Text>
                        <TextInput
                          value={eventName}
                          onValueChange={setEventName}
                          placeholder="Event Title"
                        />
                      </div>
                      <div className="space-y-1">
                        <Text className="font-medium">Description</Text>
                        <TextInput
                          value={eventDescription}
                          onValueChange={setEventDescription}
                          placeholder="Description"
                        />
                      </div>
                      <div className="space-y-1">
                        <Text className="font-medium">Start Date & Time</Text>
                        <input
                          type="datetime-local"
                          value={eventStart}
                          onChange={(e) => setEventStart(e.target.value)}
                          className="w-full flex items-center justify-between gap-x-2 bg-tremor-background border px-3 py-2 text-tremor-default shadow-tremor-input border-tremor-border rounded-tremor-default focus:border-tremor-brand-subtle focus:ring-tremor-brand-muted outline-none transition duration-100"
                        />
                      </div>
                      <div className="space-y-1">
                        <Text className="font-medium">End Date & Time</Text>
                        <input
                          type="datetime-local"
                          value={eventEnd}
                          onChange={(e) => setEventEnd(e.target.value)}
                          className="w-full flex items-center justify-between gap-x-2 bg-tremor-background border px-3 py-2 text-tremor-default shadow-tremor-input border-tremor-border rounded-tremor-default focus:border-tremor-brand-subtle focus:ring-tremor-brand-muted outline-none transition duration-100"
                        />
                      </div>
                    </Grid>

                    <Flex justifyContent="end" className="mt-6">
                      <Button
                        onClick={handleSaveDetails}
                        loading={savingDetails}
                      >
                        Save Details
                      </Button>
                    </Flex>
                  </Card>

                  {/* Event Mode */}
                  <Card className="p-6">
                    <Title className="mb-4">Event Mode</Title>
                    <Flex className="gap-3">
                      <Button
                        onClick={() => handleModeChange("hackathon")}
                        variant={!isDemoDayMode ? "primary" : "secondary"}
                        color="teal"
                        className="flex-1"
                      >
                        🏆 Hackathon
                      </Button>
                      <Button
                        onClick={() => handleModeChange("demo_day")}
                        variant={isDemoDayMode ? "primary" : "secondary"}
                        color="pink"
                        className="flex-1"
                      >
                        ❤️ Demo Day
                      </Button>
                    </Flex>
                    <Text className="mt-3 text-xs">
                      {isDemoDayMode
                        ? "Public appreciation voting - attendees can give hearts to projects without signing in"
                        : "Traditional judging with scores and categories - requires judge registration"}
                    </Text>
                  </Card>

                  {/* Judging Settings - editable only before scoring starts */}
                  <Card className="p-6">
                    <Flex justifyContent="between" alignItems="start" className="mb-4">
                      <div>
                        <Title>Judging Settings</Title>
                        <Text>Configure how judges will score teams</Text>
                      </div>
                      {hasScores && (
                        <Badge color="amber">Locked (judging started)</Badge>
                      )}
                    </Flex>

                    <Grid numItems={1} numItemsMd={2} className="gap-6">
                      <div className="space-y-1">
                        <Text className="font-medium">Judge Code (optional)</Text>
                        <TextInput
                          value={judgeCodeEdit}
                          onValueChange={setJudgeCodeEdit}
                          disabled={hasScores}
                          placeholder="Enter code required for judges"
                        />
                        <Text className="text-xs">
                          Leave empty to allow judges without a code.
                        </Text>
                      </div>
                      <div className="space-y-4 pt-2">
                        <Flex justifyContent="start" className="gap-2">
                          <input
                            type="checkbox"
                            checked={enableCohorts}
                            onChange={(e) => setEnableCohorts(e.target.checked)}
                            disabled={hasScores}
                            className="w-4 h-4 text-tremor-brand border-tremor-border rounded focus:ring-2 focus:ring-tremor-brand"
                          />
                          <Text className="font-medium">Enable Multiple Judging Cohorts</Text>
                        </Flex>
                        <Text className="text-xs">
                          Judges pick their own teams (useful for large events).
                        </Text>
                      </div>
                    </Grid>

                    <div className="mt-6 space-y-4">
                      <Flex justifyContent="between">
                        <Text className="font-medium">Judging Categories & Weights (0-2)</Text>
                        {!scoresLoaded && (
                          <Text className="text-xs">Loading scores...</Text>
                        )}
                      </Flex>

                      <div className="rounded-tremor-default border border-tremor-border overflow-hidden">
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableHeaderCell>Category</TableHeaderCell>
                              <TableHeaderCell>Weight</TableHeaderCell>
                              <TableHeaderCell>Opt-out</TableHeaderCell>
                              <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {categoriesEdit.map((cat, index) => (
                              <TableRow key={index}>
                                <TableCell>
                                  <TextInput
                                    value={cat.name}
                                    onValueChange={(val) => {
                                      const newCats = [...categoriesEdit];
                                      newCats[index].name = val;
                                      setCategoriesEdit(newCats);
                                    }}
                                    placeholder="e.g., Innovation"
                                    disabled={hasScores}
                                  />
                                </TableCell>
                                <TableCell>
                                  <NumberInput
                                    value={cat.weight}
                                    onValueChange={(val) => {
                                      const clamped = Math.max(0, Math.min(2, val));
                                      const newCats = [...categoriesEdit];
                                      newCats[index].weight = clamped;
                                      setCategoriesEdit(newCats);
                                    }}
                                    step="0.1"
                                    min={0}
                                    max={2}
                                    disabled={hasScores}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Flex justifyContent="start" className="gap-2">
                                    <input
                                      type="checkbox"
                                      checked={cat.optOutAllowed ?? false}
                                      onChange={(e) => {
                                        const newCats = [...categoriesEdit];
                                        newCats[index].optOutAllowed = e.target.checked;
                                        setCategoriesEdit(newCats);
                                      }}
                                      className="w-4 h-4 text-tremor-brand border-tremor-border rounded focus:ring-2 focus:ring-tremor-brand"
                                      disabled={hasScores}
                                    />
                                    <Text className="text-xs">Allow opt-out</Text>
                                  </Flex>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    icon={TrashIcon}
                                    variant="light"
                                    color="red"
                                    onClick={() => setCategoriesEdit(categoriesEdit.filter((_, i) => i !== index))}
                                    disabled={hasScores}
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      <Flex justifyContent="between" className="mt-2">
                        <Button
                          variant="light"
                          icon={PlusIcon}
                          onClick={() => setCategoriesEdit([...categoriesEdit, { name: "", weight: 1, optOutAllowed: false }])}
                          disabled={hasScores}
                        >
                          Add Category
                        </Button>
                        <Button
                          onClick={handleSaveJudgeSettings}
                          loading={savingJudgeSettings}
                          disabled={hasScores || !scoresLoaded}
                        >
                          Save Judging Settings
                        </Button>
                      </Flex>
                    </div>
                  </Card>

                  {isDemoDayMode && (
                    <Card className="p-6">
                      <Title className="mb-1">Appreciation Settings (Demo Day)</Title>
                      <Text className="mb-4">Configure heart budget for attendees</Text>

                      <Grid numItems={1} numItemsMd={2} className="gap-6">
                        <div className="space-y-1">
                          <Text className="font-medium">Total appreciations per attendee</Text>
                          <NumberInput
                            value={appreciationBudget}
                            onValueChange={setAppreciationBudget}
                            min={0}
                          />
                          <Text className="text-xs">
                            Limit of hearts each attendee can give across all teams. Defaults to 100.
                          </Text>
                        </div>
                        <div className="space-y-1">
                          <Text className="font-medium">Max per team</Text>
                          <TextInput
                            value="3"
                            disabled
                          />
                          <Text className="text-xs">
                            Per-team cap remains 3 to encourage distribution.
                          </Text>
                        </div>
                      </Grid>

                      <Flex justifyContent="end" className="mt-6">
                        <Button
                          onClick={handleSaveAppreciationSettings}
                          loading={savingAppreciationSettings}
                        >
                          Save Appreciation Settings
                        </Button>
                      </Flex>
                    </Card>
                  )}

                  {/* Teams */}
                  <Card className="p-6">
                    <Flex justifyContent="between" alignItems="center" className="mb-4">
                      <div>
                        <Title>Teams ({event.teams.length})</Title>
                        <Text>Manage participants and team projects</Text>
                      </div>
                      <Button
                        icon={PlusIcon}
                        onClick={() => {
                          setEditingTeam(null);
                          setShowAddTeam(true);
                        }}
                      >
                        Add Team
                      </Button>
                    </Flex>

                    <div className="space-y-2">
                      {event.teams.length === 0 ? (
                        <Text className="text-center py-8">No teams added yet</Text>
                      ) : (
                        event.teams.map((team, index) => (
                          <Card
                            key={team._id}
                            className={`p-4 hover:bg-tremor-background-muted transition-colors ${(team as any).hidden ? 'opacity-60 border-dashed border-amber-500' : ''
                              }`}
                          >
                            <Flex justifyContent="between" alignItems="start">
                              <div className="flex-1">
                                <Flex justifyContent="start" className="gap-2 mb-1">
                                  <Text className="font-bold text-tremor-content-emphasis">{team.name}</Text>
                                  {(team as any).hidden && (
                                    <Badge color="amber">Hidden</Badge>
                                  )}
                                  {isDemoDayMode && (team as any).courseCode && (
                                    <Badge color="pink">{(team as any).courseCode}</Badge>
                                  )}
                                </Flex>
                                <Text className="text-sm">{team.members.join(", ")}</Text>
                              </div>
                              <div className="relative ml-2">
                                <Flex className="gap-1">
                                  <Button
                                    icon={PencilSquareIcon}
                                    variant="light"
                                    size="xs"
                                    onClick={() => {
                                      setEditingTeam(team);
                                      setShowAddTeam(true);
                                    }}
                                    tooltip="Edit Team"
                                  />
                                  <Button
                                    icon={EyeSlashIcon}
                                    variant="light"
                                    size="xs"
                                    color="amber"
                                    onClick={async () => {
                                      try {
                                        await hideTeam({ teamId: team._id, hidden: !(team as any).hidden });
                                        toast.success((team as any).hidden ? "Team unhidden" : "Team hidden");
                                      } catch (error: any) {
                                        toast.error(error.message);
                                      }
                                    }}
                                    tooltip={(team as any).hidden ? "Unhide" : "Hide"}
                                  />
                                  <Button
                                    icon={TrashIcon}
                                    variant="light"
                                    size="xs"
                                    color="red"
                                    onClick={async () => {
                                      if (confirm(`Are you sure you want to permanently delete "${team.name}"?`)) {
                                        try {
                                          await removeTeam({ teamId: team._id });
                                          toast.success("Team removed");
                                        } catch (error: any) {
                                          toast.error(error.message);
                                        }
                                      }
                                    }}
                                    tooltip="Remove"
                                  />
                                </Flex>
                              </div>
                            </Flex>
                          </Card>
                        ))
                      )}
                    </div>
                  </Card>

                  {/* Actions */}
                  <Card className="p-6">
                    <Title className="mb-4">Actions</Title>
                    <Flex className="gap-3 flex-wrap sm:flex-nowrap" justifyContent="start">
                      {event.status === "active" && (
                        <Button
                          onClick={() => handleStatusChange("past")}
                          icon={CheckCircleIcon}
                          color="amber"
                          className="flex-1"
                        >
                          Finish Event
                        </Button>
                      )}

                      <Button
                        onClick={() => setShowSelectWinners(true)}
                        variant="secondary"
                        icon={TrophyIcon}
                        className="flex-1"
                      >
                        Select Winners
                      </Button>

                      <Button
                        onClick={handleReleaseResults}
                        disabled={event.resultsReleased}
                        color="emerald"
                        className="flex-1"
                        icon={CheckCircleIcon}
                      >
                        {event.resultsReleased ? "Results Released" : "Release Results"}
                      </Button>
                    </Flex>
                  </Card>
                </div>
              </TabPanel>

              <TabPanel>
                <div className="space-y-6">
                  {isDemoDayMode ? (
                    appreciationSummary ? (
                      <div className="space-y-6">
                        {/* Summary Stats */}
                        <Grid numItems={1} numItemsMd={3} className="gap-4">
                          <Card className="text-center p-6">
                            <Text className="text-3xl font-bold text-pink-500">{appreciationSummary.totalAppreciations}</Text>
                            <Text className="mt-1">Total Appreciations</Text>
                          </Card>
                          <Card className="text-center p-6">
                            <Text className="text-3xl font-bold text-tremor-content-emphasis">{appreciationSummary.uniqueAttendees}</Text>
                            <Text className="mt-1">Unique Attendees</Text>
                          </Card>
                          <Card className="text-center p-6">
                            <Text className="text-3xl font-bold text-tremor-content-emphasis">{appreciationSummary.teams.length}</Text>
                            <Text className="mt-1">Projects</Text>
                          </Card>
                        </Grid>

                        {/* Export Buttons */}
                        <Flex justifyContent="end" className="gap-3">
                          <Button
                            variant="secondary"
                            icon={DocumentDuplicateIcon}
                            onClick={handleExportAppreciationsCsv}
                          >
                            Export CSV
                          </Button>
                          <Button
                            color="pink"
                            loading={isGeneratingQr}
                            onClick={() => void handleDownloadQrCodes()}
                            icon={UserGroupIcon}
                          >
                            Download QR Codes
                          </Button>
                        </Flex>

                        {/* Team Rankings */}
                        <Card className="p-6">
                          <Title className="mb-4">Project Rankings</Title>
                          <Table>
                            <TableHead>
                              <TableRow>
                                <TableHeaderCell>Rank</TableHeaderCell>
                                <TableHeaderCell>Project</TableHeaderCell>
                                <TableHeaderCell>Course</TableHeaderCell>
                                <TableHeaderCell>Appreciations</TableHeaderCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {appreciationSummary.teams.map((team, index) => (
                                <TableRow key={team.teamId}>
                                  <TableCell>
                                    <span className="flex items-center gap-2 font-bold">
                                      #{index + 1}
                                      {index === 0 && <span className="text-lg">🥇</span>}
                                      {index === 1 && <span className="text-lg">🥈</span>}
                                      {index === 2 && <span className="text-lg">🥉</span>}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <Text className="font-semibold text-tremor-content-emphasis">{team.teamName}</Text>
                                  </TableCell>
                                  <TableCell>
                                    <Text>{team.courseCode || "-"}</Text>
                                  </TableCell>
                                  <TableCell>
                                    <Flex justifyContent="start" className="gap-2">
                                      <Text className="text-pink-500">❤️</Text>
                                      <Text className="font-bold">{team.rawScore}</Text>
                                    </Flex>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </Card>
                      </div>
                    ) : (
                      <Card className="text-center py-12">
                        <div className="text-6xl mb-4">❤️</div>
                        <Title>No Appreciations Yet</Title>
                        <Text>Attendees haven't given any appreciations yet. Share the event link to get started!</Text>
                      </Card>
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
                      <Card className="text-center py-12">
                        <div className="text-6xl mb-4">📊</div>
                        <Title>No Scores Yet</Title>
                        <Text className="mb-6">Judges haven't submitted any scores for this event yet.</Text>
                        <div className="max-w-md mx-auto text-left bg-tremor-background-muted rounded-lg p-4 text-sm text-tremor-content">
                          <Text className="font-semibold mb-2">💡 To see demo scores:</Text>
                          <ol className="list-decimal list-inside space-y-1">
                            <li>Open your Convex dashboard</li>
                            <li>Go to Functions → seed:seedJudgeScores</li>
                            <li>Click "Run" to generate demo data</li>
                          </ol>
                        </div>
                      </Card>
                    )
                  )}
                </div>
              </TabPanel>
            </TabPanels>
          </TabGroup>
        </div>

        {/* Modals placed outside strict layout constraints but inside logical component */}
        {showAddTeam && (
          <AddTeamModal
            eventId={eventId}
            onClose={() => {
              setShowAddTeam(false);
              setEditingTeam(null);
            }}
            onSubmit={createTeam}
            onSubmitEdit={updateTeamAdmin}
            editingTeam={editingTeam}
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
      </DialogPanel>
    </Dialog>
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

  const getSortIcon = (column: string) => {
    if (sortColumn !== column) return undefined;
    if (sortDirection === 'asc') return ChevronUpIcon;
    return ChevronDownIcon;
  };

  // Data for charts
  const overallChartData = scores.teamRankings.map(r => ({
    name: r.team.name,
    value: r.averageScore,
  })).sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6">
      <Flex justifyContent="between" alignItems="center">
        <Title>Scoring Dashboard</Title>
        <TabGroup index={viewMode === 'table' ? 0 : 1} onIndexChange={(i) => setViewMode(i === 0 ? 'table' : 'chart')}>
          <TabList variant="solid">
            <Tab>Table</Tab>
            <Tab>Charts</Tab>
          </TabList>
        </TabGroup>
      </Flex>

      {viewMode === 'table' ? (
        <div className="space-y-6">
          {/* Overall Rankings Table */}
          <Card>
            <Title className="mb-4">Overall Rankings</Title>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell onClick={() => handleSort('name')} className="cursor-pointer hover:text-tremor-content-emphasis transition-colors">
                    <Flex justifyContent="start" className="gap-1">
                      Team Name
                      {sortColumn === 'name' && <Icon icon={getSortIcon('name')!} size="xs" />}
                    </Flex>
                  </TableHeaderCell>
                  <TableHeaderCell onClick={() => handleSort('averageScore')} className="cursor-pointer hover:text-tremor-content-emphasis transition-colors">
                    <Flex justifyContent="start" className="gap-1">
                      Avg Score
                      {sortColumn === 'averageScore' && <Icon icon={getSortIcon('averageScore')!} size="xs" />}
                    </Flex>
                  </TableHeaderCell>
                  <TableHeaderCell onClick={() => handleSort('judges')} className="cursor-pointer hover:text-tremor-content-emphasis transition-colors">
                    <Flex justifyContent="start" className="gap-1">
                      Judges
                      {sortColumn === 'judges' && <Icon icon={getSortIcon('judges')!} size="xs" />}
                    </Flex>
                  </TableHeaderCell>
                  {scores.categories.map((cat) => (
                    <TableHeaderCell key={cat} onClick={() => handleSort(cat)} className="cursor-pointer hover:text-tremor-content-emphasis transition-colors">
                      <Flex justifyContent="start" className="gap-1">
                        {cat}
                        {sortColumn === cat && <Icon icon={getSortIcon(cat)!} size="xs" />}
                      </Flex>
                    </TableHeaderCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedRankings.map((ranking, index) => (
                  <TableRow key={ranking.team._id}>
                    <TableCell>
                      <Flex justifyContent="start" className="gap-3">
                        <Badge>{index + 1}</Badge>
                        <Text className="font-semibold text-tremor-content-emphasis">{ranking.team.name}</Text>
                      </Flex>
                    </TableCell>
                    <TableCell>
                      <Text className="font-mono">{ranking.averageScore.toFixed(2)}</Text>
                    </TableCell>
                    <TableCell>
                      <Text>{ranking.judgeCount}</Text>
                    </TableCell>
                    {scores.categories.map((cat) => (
                      <TableCell key={cat}>
                        <Text className="font-mono text-tremor-content-subtle">{ranking.categoryAverages[cat]?.toFixed(2) || '-'}</Text>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Category Rankings */}
          <Grid numItems={1} numItemsMd={2} className="gap-6">
            {scores.categories.map((category) => (
              <Card key={category}>
                <Title className="mb-4">{category}</Title>
                <div className="space-y-2">
                  {scores.categoryRankings[category]?.slice(0, 5).map((team, idx) => (
                    <Flex key={team.team._id} className="p-2 border-b border-tremor-border last:border-0">
                      <Flex justifyContent="start" className="gap-3">
                        <Text className="font-bold w-6">#{idx + 1}</Text>
                        <Text className="truncate">{team.team.name}</Text>
                      </Flex>
                      <Text className="font-mono font-semibold">{team.categoryAverage.toFixed(2)}</Text>
                    </Flex>
                  ))}
                </div>
              </Card>
            ))}
          </Grid>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overall Rankings Chart */}
          <Card>
            <Title className="mb-6">Overall Rankings</Title>
            <BarList data={overallChartData} valueFormatter={(number: number) => number.toFixed(2)} />
          </Card>

          {/* Category Charts */}
          <Grid numItems={1} numItemsMd={2} className="gap-6">
            {scores.categories.map((category) => {
              const data = scores.categoryRankings[category]?.slice(0, 5).map(t => ({
                name: t.team.name,
                value: t.categoryAverage
              }));
              return (
                <Card key={category}>
                  <Title className="mb-4">{category}</Title>
                  <BarList data={data} valueFormatter={(number: number) => number.toFixed(2)} color="indigo" />
                </Card>
              );
            })}
          </Grid>
        </div>
      )}
    </div>
  );
}

function AddTeamModal({
  eventId,
  onClose,
  onSubmit,
  onSubmitEdit,
  eventMode,
  courseCodes,
  editingTeam,
}: {
  eventId: Id<"events">;
  onClose: () => void;
  onSubmit: any;
  onSubmitEdit?: any;
  eventMode?: "hackathon" | "demo_day";
  courseCodes?: string[];
  editingTeam?: any;
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

  useEffect(() => {
    if (editingTeam) {
      setFormData({
        name: editingTeam.name || "",
        description: editingTeam.description || "",
        members: editingTeam.members?.join(", ") || "",
        projectUrl: editingTeam.githubUrl || "",
        courseCode: editingTeam.courseCode || "",
      });
    } else {
      setFormData({
        name: "",
        description: "",
        members: "",
        projectUrl: "",
        courseCode: "",
      });
    }
  }, [editingTeam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const name = formData.name.trim();
      const members = formData.members
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);

      if (!name || members.length === 0) {
        toast.error("Name and at least one member are required.");
        setSubmitting(false);
        return;
      }

      if (isDemoDay && !formData.courseCode) {
        toast.error("Please select a course.");
        setSubmitting(false);
        return;
      }

      if (
        !isDemoDay &&
        formData.projectUrl &&
        !formData.projectUrl.startsWith("https://github.com/")
      ) {
        toast.error("Project URL must start with https://github.com/");
        setSubmitting(false);
        return;
      }

      if (editingTeam && onSubmitEdit) {
        await onSubmitEdit({
          teamId: editingTeam._id,
          name,
          description: formData.description.trim(),
          members,
          ...(isDemoDay
            ? { courseCode: formData.courseCode || undefined }
            : { projectUrl: formData.projectUrl || undefined }),
        });
        toast.success("Team updated successfully!");
      } else {
        await onSubmit({
          eventId,
          name,
          description: formData.description.trim(),
          members,
          ...(isDemoDay
            ? { courseCode: formData.courseCode || undefined }
            : { projectUrl: formData.projectUrl || undefined }),
        });
        toast.success("Team added successfully!");
      }
      onClose();
    } catch (error) {
      toast.error("Failed to save team");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onClose={onClose} static={true}>
      <DialogPanel className="max-w-md">
        <Title className="mb-4">{editingTeam ? "Edit Team" : "Add Team"}</Title>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Text className="mb-1">Team Name <span className="text-red-500">*</span></Text>
            <TextInput
              required
              value={formData.name}
              onValueChange={(val) => setFormData({ ...formData, name: val })}
              placeholder="Code Crusaders"
            />
          </div>
          <div>
            <Text className="mb-1">Description</Text>
            <Textarea
              value={formData.description}
              onValueChange={(val) => setFormData({ ...formData, description: val })}
              placeholder="AI-powered study assistant"
              rows={2}
            />
          </div>
          <div>
            <Text className="mb-1">Members (comma-separated) <span className="text-red-500">*</span></Text>
            <TextInput
              required
              value={formData.members}
              onValueChange={(val) => setFormData({ ...formData, members: val })}
              placeholder="Alice, Bob, Carol"
            />
          </div>

          {isDemoDay ? (
            <div>
              <Text className="mb-1">Course <span className="text-red-500">*</span></Text>
              <Select
                value={formData.courseCode}
                onValueChange={(val) => setFormData({ ...formData, courseCode: val })}
                placeholder="Select course..."
              >
                {(courseCodes || []).map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </Select>
            </div>
          ) : (
            <div>
              <Text className="mb-1">Project URL</Text>
              <TextInput
                value={formData.projectUrl}
                onValueChange={(val) => setFormData({ ...formData, projectUrl: val })}
                placeholder="https://github.com/..."
              />
            </div>
          )}

          <Flex className="gap-2 mt-6">
            <Button variant="secondary" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button loading={submitting} type="submit">
              {editingTeam ? "Save Changes" : "Add Team"}
            </Button>
          </Flex>
        </form>
      </DialogPanel>
    </Dialog>
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
  const [overallWinner, setOverallWinner] = useState<string>("");
  const [categoryWinners, setCategoryWinners] = useState<Record<string, string>>({});

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
        overallWinner: overallWinner as Id<"teams">,
        categoryWinners: Object.entries(categoryWinners)
          .filter(([_, teamId]) => teamId)
          .map(([category, teamId]) => ({ category, teamId: teamId as Id<"teams"> })),
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
    <Dialog open={true} onClose={onClose} static={true}>
      <DialogPanel className="max-w-2xl">
        <Flex alignItems="center" className="mb-4 gap-2">
          <Icon icon={TrophyIcon} size="lg" color="yellow" />
          <div>
            <Title>Select Winners</Title>
            <Text>Choose the overall winner and category winners</Text>
          </div>
        </Flex>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800">
            <Flex justifyContent="start" className="gap-2 mb-2">
              <Text className="text-xl">🏆</Text>
              <Title>Overall Winner</Title>
            </Flex>
            <Select
              value={overallWinner}
              onValueChange={setOverallWinner}
              placeholder="Select a team..."
            >
              {teams.map((team) => (
                <SelectItem key={team._id} value={team._id}>
                  {team.name}
                </SelectItem>
              ))}
            </Select>
          </Card>

          <div>
            <Title className="mb-4">Category Winners</Title>
            <Grid numItems={1} numItemsMd={2} className="gap-4">
              {categories.map((category) => (
                <Card key={category} className="p-4">
                  <Text className="font-medium mb-2">{category}</Text>
                  <Select
                    value={categoryWinners[category] || ""}
                    onValueChange={(val) =>
                      setCategoryWinners({
                        ...categoryWinners,
                        [category]: val
                      })
                    }
                    placeholder="Select a team..."
                  >
                    {teams.map((team) => (
                      <SelectItem key={team._id} value={team._id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </Select>
                </Card>
              ))}
            </Grid>
          </div>

          <Flex className="gap-2 justify-end mt-6">
            <Button variant="secondary" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button loading={submitting} type="submit">
              Confirm Winners
            </Button>
          </Flex>
        </form>
      </DialogPanel>
    </Dialog>
  );
}
