import "./TeamSubmissionModal.fi.css";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { isAutomaticPrize } from "../../shared/prizeEntries";
import { PrizeEntryPicker } from "./ui/PrizeEntryPicker";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { InlineFailure, TaskStatus, type TaskSaveState } from "./ui/TaskStatus";
import {
  draftKey,
  quarantineDraft,
  readDraft,
  removeDraft,
  writeDraft,
} from "../lib/draftStorage";
import {
  outcomeForFailure,
  toRecoverableFailure,
  type RecoverableFailure,
} from "../lib/operationOutcome";

interface TeamSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: Id<"events">;
  tracks: string[];
  courseCodes?: string[];
  eventMode?: "hackathon" | "demo_day" | "code_and_tell";
  existingTeam?: any;
}

/** Form fields persisted in the local draft. The logo file is never stored. */
export type ProjectFormValues = {
  name: string;
  description: string;
  members: string[];
  githubUrl: string;
  devpostUrl: string;
  track: string;
  courseCode: string;
  prizeIds: string[];
};

export const PROJECT_DRAFT_SCHEMA = 1;
export const MAX_LOGO_BYTES = 5 * 1024 * 1024;
export const ALLOWED_LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

export function projectDraftKey(
  eventId: string,
  userId: string | undefined,
  teamId: string | undefined,
) {
  return draftKey("project", eventId, userId, teamId ?? "new");
}

function isProjectFormValues(data: unknown): data is ProjectFormValues {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  const isStringArray = (value: unknown) =>
    Array.isArray(value) && value.every((item) => typeof item === "string");
  return (
    ["name", "description", "githubUrl", "devpostUrl", "track", "courseCode"].every(
      (field) => typeof d[field] === "string",
    ) &&
    isStringArray(d.members) &&
    isStringArray(d.prizeIds)
  );
}

function snapshotFromServer(
  team: any,
  prizeIds: readonly unknown[] | undefined,
): ProjectFormValues {
  return {
    name: team?.name || "",
    description: team?.description || "",
    members: team?.members?.length ? [...team.members] : [""],
    githubUrl: team?.githubUrl || "",
    devpostUrl: team?.devpostUrl || "",
    track: team?.track || "",
    courseCode: team?.courseCode || "",
    prizeIds: (prizeIds ?? []).map((id) => String(id)),
  };
}

function valuesSignature(values: ProjectFormValues) {
  return JSON.stringify({ ...values, prizeIds: [...values.prizeIds].sort() });
}

function logoUploadFailure(error: unknown): RecoverableFailure {
  return {
    ...toRecoverableFailure(error, "upload project logo"),
    code: "logo_upload_failed",
    message:
      "Your logo couldn't be uploaded, so the project wasn't saved. Your other details are kept. Try again, choose another image, or remove the logo.",
  };
}

export function TeamSubmissionModal({
  isOpen,
  onClose,
  eventId,
  tracks,
  courseCodes = [],
  eventMode = "hackathon",
  existingTeam: existingTeamProp,
}: TeamSubmissionModalProps) {
  const myTeam = useQuery(api.teams.getMyTeam, isOpen ? { eventId } : "skip");
  const loggedInUser = useQuery(api.auth.loggedInUser, isOpen ? {} : "skip");
  const availablePrizes = useQuery(
    api.prizes.listEventPrizes,
    isOpen && eventMode === "hackathon" ? { eventId } : "skip",
  );
  const myPrizeSubmissions = useQuery(
    api.prizes.getMyTeamPrizeSubmissions,
    isOpen && eventMode === "hackathon" ? { eventId } : "skip",
  );
  const existingTeam = existingTeamProp || myTeam;
  const isDemoDay = eventMode === "demo_day";
  const isCodeAndTell = eventMode === "code_and_tell";
  const [name, setName] = useState(existingTeam?.name || "");
  const [description, setDescription] = useState(
    existingTeam?.description || "",
  );
  const [members, setMembers] = useState<string[]>(
    existingTeam?.members || [""],
  );
  const [githubUrl, setGithubUrl] = useState(existingTeam?.githubUrl || "");
  const [devpostUrl, setDevpostUrl] = useState(existingTeam?.devpostUrl || "");
  const [track, setTrack] = useState(existingTeam?.track || "");
  const [courseCode, setCourseCode] = useState(existingTeam?.courseCode || "");
  const [selectedPrizeIds, setSelectedPrizeIds] = useState<string[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failure, setFailure] = useState<RecoverableFailure | null>(null);
  const [failureOutcome, setFailureOutcome] = useState<
    "rejected" | "unknown" | null
  >(null);
  // Server copy the form was last hydrated from; dirtiness is measured against it.
  const [baseline, setBaseline] = useState<ProjectFormValues | null>(null);
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [serverUpdate, setServerUpdate] = useState<ProjectFormValues | null>(
    null,
  );
  const [localDraftStatus, setLocalDraftStatus] = useState<
    "none" | "saved" | "unavailable"
  >("none");
  const [confirmingClose, setConfirmingClose] = useState(false);
  // Upload receipt: a retry after a failed project save reuses this storage ID
  // instead of uploading the same file again.
  const logoReceiptRef = useRef<{
    file: File;
    storageId: Id<"_storage">;
  } | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const saveMyProject = useMutation(api.teams.saveMyProject);
  const generateUploadUrl = useMutation(api.teams.generateUploadUrl);

  const isEditMode = !!existingTeam;

  const userId: string | undefined =
    (loggedInUser && typeof loggedInUser === "object" && "_id" in loggedInUser
      ? String((loggedInUser as { _id: string })._id)
      : undefined) ??
    (existingTeam?.submittedBy ? String(existingTeam.submittedBy) : undefined);
  const teamId: string | undefined = existingTeam?._id
    ? String(existingTeam._id)
    : undefined;
  const recordKey = userId ? projectDraftKey(eventId, userId, teamId) : null;
  const newRecordKey = userId ? projectDraftKey(eventId, userId, undefined) : null;

  const values = useMemo<ProjectFormValues>(
    () => ({
      name,
      description,
      members,
      githubUrl,
      devpostUrl,
      track,
      courseCode,
      prizeIds: selectedPrizeIds,
    }),
    [
      name,
      description,
      members,
      githubUrl,
      devpostUrl,
      track,
      courseCode,
      selectedPrizeIds,
    ],
  );
  const valuesRef = useRef(values);
  valuesRef.current = values;

  const applyValues = useCallback((next: ProjectFormValues) => {
    setName(next.name);
    setDescription(next.description);
    setMembers(next.members.length ? next.members : [""]);
    setGithubUrl(next.githubUrl);
    setDevpostUrl(next.devpostUrl);
    setTrack(next.track);
    setCourseCode(next.courseCode);
    setSelectedPrizeIds(next.prizeIds);
  }, []);

  const serverReady =
    isOpen &&
    !isCodeAndTell &&
    (existingTeamProp || myTeam !== undefined) &&
    loggedInUser !== undefined &&
    (isDemoDay || myPrizeSubmissions !== undefined);
  const serverSnapshot = useMemo(
    () =>
      serverReady
        ? snapshotFromServer(existingTeam, isDemoDay ? [] : myPrizeSubmissions)
        : null,
    [serverReady, existingTeam, isDemoDay, myPrizeSubmissions],
  );
  const serverSignature = serverSnapshot ? valuesSignature(serverSnapshot) : null;
  const hydrationKey = `${eventId}:${userId ?? "-"}:${teamId ?? "new"}`;

  // Hydrate once per record. Later server changes never overwrite edits: a
  // clean form follows the server; a dirty form keeps its values and offers
  // the latest version instead.
  useEffect(() => {
    if (!serverSnapshot) return;
    const current = valuesRef.current;
    if (hydratedKey === hydrationKey) {
      if (!baseline || valuesSignature(baseline) === serverSignature) return;
      if (
        valuesSignature(current) === valuesSignature(baseline) ||
        valuesSignature(current) === serverSignature
      ) {
        applyValues(serverSnapshot);
        setBaseline(serverSnapshot);
        setServerUpdate(null);
      } else {
        setServerUpdate(serverSnapshot);
      }
      return;
    }

    const previousWasNew =
      hydratedKey !== null &&
      hydratedKey === `${eventId}:${userId ?? "-"}:new` &&
      teamId !== undefined;
    setHydratedKey(hydrationKey);
    setBaseline(serverSnapshot);
    setServerUpdate(null);
    if (
      previousWasNew &&
      baseline &&
      valuesSignature(current) !== valuesSignature(baseline)
    ) {
      // The project now exists (for example a save whose outcome was
      // uncertain). Keep what the user is editing; drop the "new" draft.
      if (newRecordKey) removeDraft(newRecordKey);
      return;
    }

    setRestoredDraft(false);
    if (recordKey) {
      const stored = readDraft<ProjectFormValues>(
        recordKey,
        PROJECT_DRAFT_SCHEMA,
        { isValid: isProjectFormValues },
      );
      if (stored.status === "unreadable") {
        quarantineDraft(recordKey, stored.raw);
      } else if (
        stored.status === "found" &&
        valuesSignature(stored.data) !== serverSignature
      ) {
        applyValues(stored.data);
        setRestoredDraft(true);
        setLocalDraftStatus("saved");
        return;
      }
    }
    applyValues(serverSnapshot);
    setLocalDraftStatus("none");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSignature, hydrationKey]);

  // Reset hydration when the dialog closes so reopening restores the draft.
  useEffect(() => {
    if (!isOpen) {
      setHydratedKey(null);
      setBaseline(null);
      setServerUpdate(null);
      setRestoredDraft(false);
      setFailure(null);
      setFailureOutcome(null);
      setErrors({});
      setConfirmingClose(false);
    }
  }, [isOpen]);

  const isDirty =
    baseline !== null && valuesSignature(values) !== valuesSignature(baseline);
  const hasUnsavedWork = isDirty || logoFile !== null;

  // Persist dirty form fields locally. "Draft saved on this device" is only
  // shown after the write succeeded.
  useEffect(() => {
    if (!recordKey || hydratedKey !== hydrationKey || !baseline) return;
    if (!isDirty) {
      removeDraft(recordKey);
      setLocalDraftStatus("none");
      return;
    }
    const result = writeDraft(recordKey, PROJECT_DRAFT_SCHEMA, values);
    setLocalDraftStatus(result.status === "saved" ? "saved" : "unavailable");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, isDirty, recordKey, hydratedKey]);

  // Warn before leaving the page when edits exist only in memory.
  useEffect(() => {
    if (!isOpen) return;
    const mustWarn =
      isSubmitting || (isDirty && localDraftStatus !== "saved");
    if (!mustWarn) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isOpen, isSubmitting, isDirty, localDraftStatus]);

  const eligiblePrizes = useMemo(() => {
    if (isDemoDay || !availablePrizes) return [];
    return availablePrizes.filter((prize: any) => {
      if (prize.isActive === false) return false;
      if (prize.type === "track" || prize.type === "track_sponsor") {
        return !!track && prize.track === track;
      }
      return true;
    });
  }, [isDemoDay, availablePrizes, track]);

  const optionalPrizes = useMemo(
    () => eligiblePrizes.filter((prize) => !isAutomaticPrize(prize)),
    [eligiblePrizes],
  );

  // Derive eligibility without clearing stored selections while queries load.
  const allowedPrizeIds = new Set(
    optionalPrizes.map((prize: any) => String(prize._id)),
  );
  const selectedEligiblePrizeIds = selectedPrizeIds.filter((id) =>
    allowedPrizeIds.has(id),
  );
  const prizesLoading =
    eventMode === "hackathon" &&
    (availablePrizes === undefined || myPrizeSubmissions === undefined);

  const addMember = () => {
    setMembers([...members, ""]);
  };

  const removeMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index));
  };

  const updateMember = (index: number, value: string) => {
    const newMembers = [...members];
    newMembers[index] = value;
    setMembers(newMembers);
  };

  const clearLogo = () => {
    setLogoFile(null);
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const handleLogoChange = (file: File | null) => {
    setErrors((prev) => ({ ...prev, logo: "" }));
    if (!file) {
      setLogoFile(null);
      return;
    }
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      clearLogo();
      setErrors((prev) => ({
        ...prev,
        logo: "Choose a PNG, JPEG, WebP, or GIF image, or continue without a logo.",
      }));
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      clearLogo();
      setErrors((prev) => ({
        ...prev,
        logo: "This image is larger than 5 MB. Choose a smaller file, or continue without a logo.",
      }));
      return;
    }
    setLogoFile(file);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!isEditMode && !name.trim()) {
      newErrors.name = "Team name is required";
    }
    if (members.filter((m) => m.trim()).length === 0) {
      newErrors.members = "At least one team member is required";
    }
    // GitHub URL is required for hackathon, optional for Demo Day
    if (!isDemoDay) {
      if (!githubUrl.trim()) {
        newErrors.githubUrl = "GitHub URL is required";
      } else if (!githubUrl.startsWith("https://github.com/")) {
        newErrors.githubUrl = "GitHub URL must start with https://github.com/";
      }
    } else if (
      githubUrl.trim() &&
      !githubUrl.startsWith("https://github.com/")
    ) {
      // For Demo Day, only validate format if URL is provided
      newErrors.githubUrl = "GitHub URL must start with https://github.com/";
    }

    if (devpostUrl.trim() && !devpostUrl.startsWith("https://")) {
      newErrors.devpostUrl = "Devpost URL must start with https://";
    }

    // Validate track or course code based on event mode
    if (isDemoDay) {
      if (!courseCode) {
        newErrors.courseCode = "Please select a course";
      }
    } else {
      if (!track) {
        newErrors.track = "Please select a track";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const uploadLogo = async (file: File): Promise<Id<"_storage">> => {
    const receipt = logoReceiptRef.current;
    if (receipt && receipt.file === file) return receipt.storageId;
    const uploadUrl = await generateUploadUrl({ eventId });
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!response.ok) {
      throw new Error(`Logo upload failed with status ${response.status}`);
    }
    const body: unknown = await response.json().catch(() => null);
    const storageId =
      body && typeof body === "object"
        ? (body as { storageId?: unknown }).storageId
        : undefined;
    if (typeof storageId !== "string" || !storageId) {
      throw new Error("Logo upload returned no storage ID");
    }
    logoReceiptRef.current = { file, storageId: storageId as Id<"_storage"> };
    return storageId as Id<"_storage">;
  };

  const save = async () => {
    if (isSubmitting) return;
    if (!validate()) return;

    setIsSubmitting(true);
    setFailure(null);
    setFailureOutcome(null);

    let logoStorageId: Id<"_storage"> | undefined;
    if (logoFile && !isDemoDay) {
      try {
        logoStorageId = await uploadLogo(logoFile);
      } catch (err) {
        setFailure(logoUploadFailure(err));
        setFailureOutcome("rejected");
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const filteredMembers = members.filter((m) => m.trim());
      await saveMyProject({
        eventId,
        ...(isEditMode
          ? { teamId: existingTeam._id as Id<"teams"> }
          : { name: name.trim() }),
        description: description.trim(),
        members: filteredMembers,
        githubUrl: githubUrl.trim(),
        devpostUrl: devpostUrl.trim(),
        ...(isDemoDay ? { courseCode } : { track }),
        ...(logoStorageId && { logoStorageId }),
        ...(!isDemoDay && {
          prizeIds: selectedEligiblePrizeIds as Id<"prizes">[],
        }),
      });
      // Confirmed: the project and its prize entries are saved together.
      if (recordKey) removeDraft(recordKey);
      if (newRecordKey) removeDraft(newRecordKey);
      logoReceiptRef.current = null;
      setLogoFile(null);
      setLocalDraftStatus("none");
      setRestoredDraft(false);
      setHydratedKey(null);
      setBaseline(null);
      toast.success(
        isEditMode ? "Team updated successfully!" : "Team submitted successfully!",
      );
      onClose();
    } catch (err) {
      const recoverable = toRecoverableFailure(err, "save project");
      setFailure(recoverable);
      setFailureOutcome(outcomeForFailure(recoverable));
      toast.error(recoverable.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void save();
  };

  const finishClose = () => {
    setConfirmingClose(false);
    setLogoFile(null);
    logoReceiptRef.current = null;
    setHydratedKey(null);
    setBaseline(null);
    setErrors({});
    onClose();
  };

  const handleClose = () => {
    // Closing never cancels a save already sent to the server.
    if (isSubmitting) return;
    if (hasUnsavedWork) {
      setConfirmingClose(true);
      return;
    }
    finishClose();
  };

  const discardDraft = () => {
    if (recordKey) removeDraft(recordKey);
    if (baseline) applyValues(baseline);
    clearLogo();
    setRestoredDraft(false);
    setLocalDraftStatus("none");
    setFailure(null);
    setFailureOutcome(null);
  };

  const loadLatestVersion = () => {
    if (!serverUpdate) return;
    applyValues(serverUpdate);
    setBaseline(serverUpdate);
    setServerUpdate(null);
    setRestoredDraft(false);
  };

  const keepMyEdits = () => {
    if (serverUpdate) setBaseline(serverUpdate);
    setServerUpdate(null);
  };

  const taskState: TaskSaveState = isSubmitting
    ? "saving"
    : failureOutcome
      ? failureOutcome
      : isDirty
        ? localDraftStatus === "saved"
          ? "local"
          : localDraftStatus === "unavailable"
            ? "local-unavailable"
            : "unsaved"
        : "clean";

  if (!isOpen) return null;

  if (isCodeAndTell) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={handleClose}
        />
        <div className="tsm-dialog relative fi-surface fi-radius-panel p-8 max-w-lg w-full fi-elevation-panel fi-panel-enter border border-border my-8">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <h2 className="text-2xl fi-zone font-bold mb-4 fi-ink">
            Code &amp; Tell Projects
          </h2>
          <p className="text-sm fi-muted">
            Code &amp; Tell projects are managed by admins from the event
            workspace. Participant self-submission is disabled for this mode.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="tsm-root fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="tsm-dialog relative fi-surface fi-radius-panel p-8 max-w-2xl w-full fi-elevation-panel fi-panel-enter border border-border my-8">
        <button
          type="button"
          onClick={handleClose}
          disabled={isSubmitting}
          aria-label="Close"
          title={isSubmitting ? "Wait for the save to finish" : undefined}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <h2 className="text-2xl fi-zone font-bold mb-6 fi-ink">
          {isEditMode ? "Edit Team" : "Submit Your Team"}
        </h2>

        {!isEditMode && (
          <div className="mb-6 p-4 bg-yellow-50  border border-yellow-200  rounded-xl">
            <p className="text-sm text-yellow-800 ">
              ⚠️ Team name is permanent and must match your DevPost submission!
            </p>
          </div>
        )}

        {restoredDraft && (
          <div className="tsm-notice mb-6" role="status">
            <p>Restored your unsaved draft from this device.</p>
            <button type="button" className="tsm-notice-action" onClick={discardDraft}>
              Discard draft
            </button>
          </div>
        )}

        {serverUpdate && (
          <div className="tsm-notice mb-6" role="status">
            <p>
              This project was changed somewhere else while you were editing.
              Your edits are kept.
            </p>
            <div className="tsm-notice-actions">
              <button type="button" className="tsm-notice-action" onClick={loadLatestVersion}>
                Load latest version
              </button>
              <button type="button" className="tsm-notice-action" onClick={keepMyEdits}>
                Keep my edits
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEditMode && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Team Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrors({ ...errors, name: "" });
                }}
                placeholder="Enter team name..."
                className="w-full px-4 py-3 rounded-xl border border-border fi-surface focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-500">{errors.name}</p>
              )}
            </div>
          )}

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium mb-2"
            >
              Description <span className="fi-muted text-xs">(optional)</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
              }}
              placeholder="Describe your project..."
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-border fi-surface focus:outline-none focus:ring-2 focus:ring-primary transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Team Members <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {members.map((member, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={member}
                    onChange={(e) => updateMember(index, e.target.value)}
                    placeholder="Member name..."
                    className="flex-1 px-4 py-3 rounded-xl border border-border fi-surface focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                  {members.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMember(index)}
                      className="px-4 py-3 rounded-xl border border-border hover:bg-red-50  hover:border-red-300  transition-colors text-red-600 "
                    >
                      −
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addMember}
                className="text-sm text-primary hover:underline"
              >
                + Add Member
              </button>
            </div>
            {errors.members && (
              <p className="mt-1 text-sm text-red-500">{errors.members}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="githubUrl"
              className="block text-sm font-medium mb-2"
            >
              GitHub URL {!isDemoDay && <span className="text-red-500">*</span>}
              {isDemoDay && (
                <span className="fi-muted text-xs ml-1">(optional)</span>
              )}
            </label>
            <input
              id="githubUrl"
              type="url"
              value={githubUrl}
              onChange={(e) => {
                setGithubUrl(e.target.value);
                setErrors({ ...errors, githubUrl: "" });
              }}
              placeholder="https://github.com/..."
              className="w-full px-4 py-3 rounded-xl border border-border fi-surface focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            />
            {errors.githubUrl && (
              <p className="mt-1 text-sm text-red-500">{errors.githubUrl}</p>
            )}
          </div>

          {!isDemoDay && (
            <div>
              <label
                htmlFor="devpostUrl"
                className="block text-sm font-medium mb-2"
              >
                Devpost URL{" "}
                <span className="fi-muted text-xs">(recommended)</span>
              </label>
              <input
                id="devpostUrl"
                type="url"
                value={devpostUrl}
                onChange={(e) => {
                  setDevpostUrl(e.target.value);
                  setErrors({ ...errors, devpostUrl: "" });
                }}
                placeholder="https://devpost.com/software/..."
                className="w-full px-4 py-3 rounded-xl border border-border fi-surface focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              />
              {errors.devpostUrl && (
                <p className="mt-1 text-sm text-red-500">{errors.devpostUrl}</p>
              )}
            </div>
          )}

          {/* Track (hackathon) or Course (demo day) */}
          {isDemoDay ? (
            <div>
              <label
                htmlFor="courseCode"
                className="block text-sm font-medium mb-2"
              >
                Course <span className="text-red-500">*</span>
              </label>
              <select
                id="courseCode"
                value={courseCode}
                onChange={(e) => {
                  setCourseCode(e.target.value);
                  setErrors({ ...errors, courseCode: "" });
                }}
                className="w-full px-4 py-3 rounded-xl border border-border fi-surface focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all"
              >
                <option value="">Select course...</option>
                {courseCodes.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
              {errors.courseCode && (
                <p className="mt-1 text-sm text-red-500">{errors.courseCode}</p>
              )}
            </div>
          ) : (
            <div>
              <label htmlFor="track" className="block text-sm font-medium mb-2">
                Track <span className="text-red-500">*</span>
              </label>
              <select
                id="track"
                value={track}
                onChange={(e) => {
                  setTrack(e.target.value);
                  setErrors({ ...errors, track: "" });
                }}
                className="w-full px-4 py-3 rounded-xl border border-border fi-surface focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              >
                <option value="">Select track...</option>
                {tracks.map((trackOption) => (
                  <option key={trackOption} value={trackOption}>
                    {trackOption}
                  </option>
                ))}
              </select>
              {errors.track && (
                <p className="mt-1 text-sm text-red-500">{errors.track}</p>
              )}
            </div>
          )}

          {/* Team Logo - only for hackathon mode */}
          {!isDemoDay && (
            <div>
              <label htmlFor="logo" className="block text-sm font-medium mb-2">
                Team Logo (Optional)
              </label>
              <input
                id="logo"
                ref={logoInputRef}
                type="file"
                accept={ALLOWED_LOGO_TYPES.join(",")}
                disabled={isSubmitting}
                aria-describedby="logo-hint"
                onChange={(e) => handleLogoChange(e.target.files?.[0] || null)}
                className="w-full px-4 py-3 rounded-xl border border-border fi-surface focus:outline-none focus:ring-2 focus:ring-primary transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-teal-500/10 file:text-primary hover:file:bg-teal-500/20"
              />
              <p id="logo-hint" className="mt-1 text-xs fi-muted">
                PNG, JPEG, WebP, or GIF up to 5 MB. Not kept in your draft; choose it again if you leave.
              </p>
              {logoFile && (
                <button
                  type="button"
                  onClick={clearLogo}
                  disabled={isSubmitting}
                  className="mt-1 text-sm text-primary hover:underline"
                >
                  Remove logo
                </button>
              )}
              {errors.logo && (
                <p className="mt-1 text-sm text-red-500" role="alert">
                  {errors.logo}
                </p>
              )}
            </div>
          )}

          {!isDemoDay && (
            <PrizeEntryPicker
              prizes={availablePrizes}
              track={track}
              selectedPrizeIds={selectedPrizeIds}
              onSelectionChange={setSelectedPrizeIds}
              disabled={isSubmitting}
            />
          )}

          {failure && (
            <InlineFailure
              failure={failure}
              title={
                failureOutcome === "unknown"
                  ? "We couldn't confirm your project saved"
                  : "Your project wasn't saved"
              }
              onRetry={() => void save()}
              retryLabel={failureOutcome === "unknown" ? "Check and save again" : "Try again"}
              busy={isSubmitting}
              onDismiss={() => {
                setFailure(null);
                setFailureOutcome(null);
              }}
            >
              {failureOutcome === "unknown" && (
                <p className="inline-failure-body">
                  Saving again is safe: it updates the same project rather than
                  creating another.
                </p>
              )}
            </InlineFailure>
          )}

          <div className="tsm-status">
            <TaskStatus state={taskState} />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || prizesLoading}
            className="fi-transport w-full mt-6"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                {isEditMode ? "Updating..." : "Submitting..."}
              </span>
            ) : isEditMode ? (
              "Update Team"
            ) : (
              "Submit Team"
            )}
          </button>
        </form>
      </div>
      <ConfirmDialog
        open={confirmingClose}
        title="Close without submitting?"
        confirmLabel={localDraftStatus === "saved" ? "Close and keep draft" : "Discard and close"}
        cancelLabel="Keep editing"
        tone={localDraftStatus === "saved" ? "default" : "danger"}
        onConfirm={() => {
          if (localDraftStatus !== "saved") discardDraft();
          finishClose();
        }}
        onCancel={() => setConfirmingClose(false)}
      >
        <p>
          {localDraftStatus === "saved"
            ? "Your changes are saved as a draft on this device and will be restored when you come back."
            : "This browser couldn't keep a draft, so closing will discard your changes."}
          {logoFile && " The selected logo isn't part of the draft; you'll need to choose it again."}
        </p>
        {localDraftStatus === "saved" && (
          <button
            type="button"
            className="tsm-notice-action"
            onClick={() => {
              discardDraft();
              finishClose();
            }}
          >
            Discard draft and close
          </button>
        )}
      </ConfirmDialog>
    </div>
  );
}
