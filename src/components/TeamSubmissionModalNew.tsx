import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";

interface TeamSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: Id<"events">;
  tracks: string[];
  courseCodes?: string[];
  eventMode?: "hackathon" | "demo_day";
  existingTeam?: any;
}

export function TeamSubmissionModal({ 
  isOpen, 
  onClose, 
  eventId, 
  tracks,
  courseCodes = [],
  eventMode = "hackathon",
  existingTeam: existingTeamProp
}: TeamSubmissionModalProps) {
  const myTeam = useQuery(api.teams.getMyTeam, isOpen ? { eventId } : "skip");
  const existingTeam = existingTeamProp || myTeam;
  const isDemoDay = eventMode === "demo_day";
  const [name, setName] = useState(existingTeam?.name || "");
  const [description, setDescription] = useState(existingTeam?.description || "");
  const [members, setMembers] = useState<string[]>(existingTeam?.members || [""]);
  const [githubUrl, setGithubUrl] = useState(existingTeam?.githubUrl || "");
  const [track, setTrack] = useState(existingTeam?.track || "");
  const [courseCode, setCourseCode] = useState(existingTeam?.courseCode || "");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitTeam = useMutation(api.teams.submitTeam);
  const updateTeam = useMutation(api.teams.updateTeam);
  const generateUploadUrl = useMutation(api.teams.generateUploadUrl);

  const isEditMode = !!existingTeam;

  // Update form when existingTeam is loaded
  useEffect(() => {
    if (existingTeam) {
      setName(existingTeam.name || "");
      setDescription(existingTeam.description || "");
      setMembers(existingTeam.members || [""]);
      setGithubUrl(existingTeam.githubUrl || "");
      setTrack(existingTeam.track || "");
      setCourseCode(existingTeam.courseCode || "");
    }
  }, [existingTeam]);

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

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!isEditMode && !name.trim()) {
      newErrors.name = "Team name is required";
    }
    if (members.filter(m => m.trim()).length === 0) {
      newErrors.members = "At least one team member is required";
    }
    // GitHub URL is required for hackathon, optional for Demo Day
    if (!isDemoDay) {
      if (!githubUrl.trim()) {
        newErrors.githubUrl = "GitHub URL is required";
      } else if (!githubUrl.startsWith("https://github.com/")) {
        newErrors.githubUrl = "GitHub URL must start with https://github.com/";
      }
    } else if (githubUrl.trim() && !githubUrl.startsWith("https://github.com/")) {
      // For Demo Day, only validate format if URL is provided
      newErrors.githubUrl = "GitHub URL must start with https://github.com/";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;

    setIsSubmitting(true);

    try {
      let logoStorageId: Id<"_storage"> | undefined;

      // Upload logo if provided
      if (logoFile) {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": logoFile.type },
          body: logoFile,
        });
        const { storageId } = await result.json();
        logoStorageId = storageId;
      }

      const filteredMembers = members.filter(m => m.trim());

      if (isEditMode) {
        await updateTeam({
          teamId: existingTeam._id,
          description: description.trim(),
          members: filteredMembers,
          githubUrl: githubUrl.trim(),
          ...(isDemoDay ? { courseCode } : { track }),
          ...(logoStorageId && { logoStorageId }),
        });
        toast.success("Team updated successfully!");
      } else {
        await submitTeam({
          eventId,
          name: name.trim(),
          description: description.trim(),
          members: filteredMembers,
          githubUrl: githubUrl.trim(),
          ...(isDemoDay ? { courseCode } : { track }),
          logoStorageId,
        });
        toast.success("Team submitted successfully!");
      }
      
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit team");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isEditMode) {
      setName("");
      setDescription("");
      setMembers([""]);
      setGithubUrl("");
      setTrack("");
      setCourseCode("");
      setLogoFile(null);
    }
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative bg-background rounded-2xl p-8 max-w-2xl w-full shadow-2xl slide-up border border-border my-8">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <h2 className="text-2xl font-heading font-bold mb-6 text-foreground">
          {isEditMode ? "Edit Team" : "Submit Your Team"}
        </h2>

        {!isEditMode && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ Team name is permanent and must match your DevPost submission!
            </p>
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
                className="w-full px-4 py-3 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              />
              {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
            </div>
          )}

          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-2">
              Description <span className="text-muted-foreground text-xs">(optional)</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
              }}
              placeholder="Describe your project..."
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary transition-all resize-none"
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
                    className="flex-1 px-4 py-3 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                  {members.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMember(index)}
                      className="px-4 py-3 rounded-xl border border-border hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-700 transition-colors text-red-600 dark:text-red-400"
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
            {errors.members && <p className="mt-1 text-sm text-red-500">{errors.members}</p>}
          </div>

          <div>
            <label htmlFor="githubUrl" className="block text-sm font-medium mb-2">
              GitHub URL {!isDemoDay && <span className="text-red-500">*</span>}
              {isDemoDay && <span className="text-muted-foreground text-xs ml-1">(optional)</span>}
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
              className="w-full px-4 py-3 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            />
            {errors.githubUrl && <p className="mt-1 text-sm text-red-500">{errors.githubUrl}</p>}
          </div>

          {/* Track (hackathon) or Course (demo day) */}
          {isDemoDay ? (
            <div>
              <label htmlFor="courseCode" className="block text-sm font-medium mb-2">
                Course <span className="text-red-500">*</span>
              </label>
              <select
                id="courseCode"
                value={courseCode}
                onChange={(e) => {
                  setCourseCode(e.target.value);
                  setErrors({ ...errors, courseCode: "" });
                }}
                className="w-full px-4 py-3 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all"
              >
                <option value="">Select course...</option>
                {courseCodes.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
              {errors.courseCode && <p className="mt-1 text-sm text-red-500">{errors.courseCode}</p>}
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
                className="w-full px-4 py-3 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              >
                <option value="">Select track...</option>
                {tracks.map((trackOption) => (
                  <option key={trackOption} value={trackOption}>
                    {trackOption}
                  </option>
                ))}
              </select>
              {errors.track && <p className="mt-1 text-sm text-red-500">{errors.track}</p>}
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
                type="file"
                accept="image/*"
                onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                className="w-full px-4 py-3 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-teal-500/10 file:text-primary hover:file:bg-teal-500/20"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full mt-6"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                {isEditMode ? "Updating..." : "Submitting..."}
              </span>
            ) : (
              isEditMode ? "Update Team" : "Submit Team"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

