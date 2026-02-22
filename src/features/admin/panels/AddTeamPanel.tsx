import { useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export function AddTeamPanel({
  eventId,
  onClose,
  onSubmit,
  onSubmitEdit,
  eventMode,
  tracks,
  eventPrizes,
  prizesLoading,
  teamPrizeIdsByTeamId,
  courseCodes,
  editingTeam,
}: {
  eventId: Id<"events">;
  onClose: () => void;
  onSubmit: any;
  onSubmitEdit?: any;
  eventMode?: "hackathon" | "demo_day";
  tracks?: string[];
  eventPrizes?: any[];
  prizesLoading?: boolean;
  teamPrizeIdsByTeamId?: Map<string, string[]>;
  courseCodes?: string[];
  editingTeam?: any;
}) {
  const isDemoDay = eventMode === "demo_day";
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    members: "",
    track: "",
    projectUrl: "",
    courseCode: "",
  });
  const [selectedPrizeIds, setSelectedPrizeIds] = useState<string[]>([]);
  const [sponsorFilter, setSponsorFilter] = useState("");
  const setTeamPrizeSubmissionsAdmin = useMutation(api.prizes.setTeamPrizeSubmissionsAdmin);

  const eligiblePrizes = useMemo(() => {
    if (isDemoDay) return [];
    const prizes = eventPrizes || [];
    return prizes.filter((prize: any) => {
      if (prize.isActive === false) return false;
      if (prize.type === "track" || prize.type === "track_sponsor") {
        return !!formData.track && prize.track === formData.track;
      }
      return true;
    });
  }, [isDemoDay, eventPrizes, formData.track]);

  const sponsorOptions = useMemo(
    () =>
      Array.from(
        new Set<string>(
          eligiblePrizes
            .map((prize: any) => (prize.sponsorName || "").trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [eligiblePrizes]
  );

  const filteredPrizes = useMemo(() => {
    if (!sponsorFilter) return eligiblePrizes;
    return eligiblePrizes.filter(
      (prize: any) => (prize.sponsorName || "").trim() === sponsorFilter
    );
  }, [eligiblePrizes, sponsorFilter]);

  useEffect(() => {
    if (editingTeam) {
      setFormData({
        name: editingTeam.name || "",
        description: editingTeam.description || "",
        members: editingTeam.members?.join(", ") || "",
        track: editingTeam.track || "",
        projectUrl: editingTeam.githubUrl || "",
        courseCode: editingTeam.courseCode || "",
      });
      setSelectedPrizeIds(teamPrizeIdsByTeamId?.get(String(editingTeam._id)) || []);
      setSponsorFilter("");
    } else {
      setFormData({
        name: "",
        description: "",
        members: "",
        track: "",
        projectUrl: "",
        courseCode: "",
      });
      setSelectedPrizeIds([]);
      setSponsorFilter("");
    }
  }, [editingTeam, teamPrizeIdsByTeamId]);

  useEffect(() => {
    if (!editingTeam) return;
    setSelectedPrizeIds(teamPrizeIdsByTeamId?.get(String(editingTeam._id)) || []);
  }, [editingTeam, teamPrizeIdsByTeamId]);

  useEffect(() => {
    if (isDemoDay) return;
    const allowedIds = new Set(eligiblePrizes.map((prize: any) => String(prize._id)));
    setSelectedPrizeIds((prev) => prev.filter((id) => allowedIds.has(id)));
  }, [isDemoDay, eligiblePrizes]);

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

      if (!isDemoDay && !formData.track) {
        toast.error("Please select a track.");
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

      let teamId: Id<"teams">;
      if (editingTeam && onSubmitEdit) {
        await onSubmitEdit({
          teamId: editingTeam._id,
          name,
          description: formData.description.trim(),
          members,
          ...(isDemoDay
            ? { courseCode: formData.courseCode || undefined }
            : {
              track: formData.track || undefined,
              projectUrl: formData.projectUrl || undefined,
            }),
        });
        teamId = editingTeam._id;
        if (!isDemoDay) {
          await setTeamPrizeSubmissionsAdmin({
            eventId,
            teamId,
            prizeIds: selectedPrizeIds as Id<"prizes">[],
          });
        }
        toast.success("Team updated successfully!");
      } else {
        teamId = await onSubmit({
          eventId,
          name,
          description: formData.description.trim(),
          members,
          ...(isDemoDay
            ? { courseCode: formData.courseCode || undefined }
            : {
              track: formData.track || undefined,
              projectUrl: formData.projectUrl || undefined,
            }),
        });
        if (!isDemoDay) {
          await setTeamPrizeSubmissionsAdmin({
            eventId,
            teamId,
            prizeIds: selectedPrizeIds as Id<"prizes">[],
          });
        }
        toast.success("Team added successfully!");
      }
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to save team");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full h-full">
      <div className="relative w-full h-full rounded-lg border border-border bg-card flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-muted/20 shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h3 className="text-xl font-heading font-bold text-foreground">
            {editingTeam ? "Edit Team" : "Create Team"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {editingTeam ? "Editing existing team details." : "Creating a new team."}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Team Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input w-full"
                placeholder="Code Crusaders"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Description <span className="text-muted-foreground text-xs">(optional)</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="input w-full min-h-[80px] py-2 resize-none"
                placeholder="AI-powered study assistant"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Members (comma-separated) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.members}
                onChange={(e) => setFormData({ ...formData, members: e.target.value })}
                className="input w-full"
                placeholder="Alice Smith, Bob Johnson, Carol Lee"
              />
            </div>
            {isDemoDay ? (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Course <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.courseCode}
                  onChange={(e) => setFormData({ ...formData, courseCode: e.target.value })}
                  className="input w-full"
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
              <div className="space-y-4">

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Track <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.track}
                    onChange={(e) => setFormData({ ...formData, track: e.target.value })}
                    className="input w-full"
                  >
                    <option value="">Select track...</option>
                    {(tracks || []).map((trackOption) => (
                      <option key={trackOption} value={trackOption}>
                        {trackOption}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Project URL <span className="text-muted-foreground text-xs">(optional)</span>
                  </label>
                  <input
                    type="url"
                    value={formData.projectUrl}
                    onChange={(e) => setFormData({ ...formData, projectUrl: e.target.value })}
                    className="input w-full"
                    placeholder="https://github.com/team/project"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Prize Submissions</label>
                  <div className="mb-2">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Sponsor Filter
                    </label>
                    <select
                      value={sponsorFilter}
                      onChange={(e) => setSponsorFilter(e.target.value)}
                      className="input w-full"
                    >
                      <option value="">All sponsors</option>
                      {sponsorOptions.map((sponsorName) => (
                        <option key={sponsorName} value={sponsorName}>
                          {sponsorName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="rounded-lg border border-border overflow-hidden bg-card max-h-56 overflow-y-auto">
                    <div className="divide-y divide-border">
                      {prizesLoading && <div className="p-4 text-sm text-muted-foreground">Loading prizes...</div>}
                      {!prizesLoading && (eventPrizes?.length || 0) === 0 && (
                        <div className="p-4 text-sm text-muted-foreground">No prizes configured for this event.</div>
                      )}
                      {!prizesLoading && (eventPrizes?.length || 0) > 0 && eligiblePrizes.length === 0 && (
                        <div className="p-4 text-sm text-muted-foreground">
                          Select a track to see track-specific prizes.
                        </div>
                      )}
                      {!prizesLoading &&
                        eligiblePrizes.length > 0 &&
                        filteredPrizes.length === 0 && (
                          <div className="p-4 text-sm text-muted-foreground">
                            No prizes match this sponsor filter.
                          </div>
                        )}
                      {filteredPrizes.map((prize: any) => {
                        const checked = selectedPrizeIds.includes(String(prize._id));
                        return (
                          <label
                            key={prize._id}
                            className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors relative group ${checked ? "bg-teal-500/10 border-l-2 border-l-teal-500" : "hover:bg-muted/20 border-l-2 border-l-transparent"
                              }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const id = String(prize._id);
                                if (e.target.checked) {
                                  setSelectedPrizeIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
                                } else {
                                  setSelectedPrizeIds((prev) => prev.filter((value) => value !== id));
                                }
                              }}
                              className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-foreground">{prize.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {prize.type === "general" && "General prize"}
                                {prize.type === "track" &&
                                  `Track prize${prize.track ? ` · ${prize.track}` : ""}`}
                                {prize.type === "sponsor" &&
                                  `Sponsor prize${prize.sponsorName ? ` · ${prize.sponsorName}` : ""}`}
                                {prize.type === "track_sponsor" &&
                                  `Track + Sponsor${prize.track ? ` · ${prize.track}` : ""}${prize.sponsorName ? ` · ${prize.sponsorName}` : ""
                                  }`}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Select every prize this team is applying for.
                  </p>
                </div>
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
                    Saving...
                  </span>
                ) : editingTeam ? (
                  "Save Changes"
                ) : (
                  "Create Team"
                )}
              </button>
              <button type="button" onClick={onClose} disabled={submitting} className="flex-1 btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
