import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import type { Id } from "../../../convex/_generated/dataModel";
import { readDraft, writeDraft } from "../../../src/lib/draftStorage";

const { query, saveProject, generateUploadUrl, otherMutation } = vi.hoisted(
  () => ({
    query: vi.fn(),
    saveProject: vi.fn(),
    generateUploadUrl: vi.fn(),
    otherMutation: vi.fn(),
  }),
);
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => query(...args),
  useMutation: (ref: any) => {
    const name = getFunctionName(ref);
    if (name === "teams:saveMyProject") return saveProject;
    if (name === "teams:generateUploadUrl") return generateUploadUrl;
    return otherMutation;
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import {
  PROJECT_DRAFT_SCHEMA,
  TeamSubmissionModal,
  projectDraftKey,
} from "../../../src/components/TeamSubmissionModalNew";

const user = { _id: "user" };
const baseTeam = {
  _id: "team",
  name: "Garden",
  description: "A garden app",
  members: ["Alex"],
  githubUrl: "https://github.com/example/garden",
  track: "Environment",
  submittedBy: "user",
};
let team: typeof baseTeam | null;
const onClose = vi.fn();
const props = {
  isOpen: true,
  onClose,
  eventId: "event" as Id<"events">,
  tracks: ["Environment", "Health"],
  eventMode: "hackathon" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  team = baseTeam;
  saveProject.mockResolvedValue({ teamId: "team", created: false });
  generateUploadUrl.mockResolvedValue("https://upload.example/url");
  query.mockImplementation((ref) => {
    const name = getFunctionName(ref);
    if (name === "teams:getMyTeam") return team;
    if (name === "auth:loggedInUser") return user;
    if (name === "prizes:listEventPrizes") return [];
    return [];
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function fillNewProject() {
  fireEvent.change(screen.getByLabelText(/Team Name/), {
    target: { value: "Rocket" },
  });
  fireEvent.change(screen.getByPlaceholderText("Member name..."), {
    target: { value: "Sam" },
  });
  fireEvent.change(screen.getByLabelText(/GitHub URL/), {
    target: { value: "https://github.com/example/rocket" },
  });
  fireEvent.change(screen.getByLabelText(/Track/), {
    target: { value: "Health" },
  });
}

describe("project submission save integrity", () => {
  it("creates the project and its prize entries in one mutation and clears the draft", async () => {
    team = null;
    render(<TeamSubmissionModal {...props} />);
    fillNewProject();

    const key = projectDraftKey("event", "user", undefined);
    expect(readDraft(key, PROJECT_DRAFT_SCHEMA).status).toBe("found");
    expect(screen.getByText("Draft saved on this device")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Submit Team" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(saveProject).toHaveBeenCalledTimes(1);
    expect(saveProject).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "event",
        name: "Rocket",
        members: ["Sam"],
        track: "Health",
        prizeIds: [],
      }),
    );
    expect(otherMutation).not.toHaveBeenCalled();
    expect(readDraft(key, PROJECT_DRAFT_SCHEMA).status).toBe("missing");
  });

  it("keeps fields, stays open, and shows a persistent failure when the save is rejected", async () => {
    team = null;
    saveProject.mockRejectedValue(
      new Error("Uncaught Error: Can only submit teams to active events"),
    );
    render(<TeamSubmissionModal {...props} />);
    fillNewProject();
    fireEvent.click(screen.getByRole("button", { name: "Submit Team" }));

    expect(await screen.findByText("Your project wasn't saved")).toBeInTheDocument();
    expect(screen.getByText("Save rejected; your changes are kept")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Team Name/)).toHaveValue("Rocket");
    expect(screen.getByLabelText(/GitHub URL/)).toHaveValue(
      "https://github.com/example/rocket",
    );
    expect(
      readDraft(projectDraftKey("event", "user", undefined), PROJECT_DRAFT_SCHEMA)
        .status,
    ).toBe("found");
  });

  it("reuses the uploaded logo when retrying after a failed project save", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ storageId: "storage1" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    saveProject
      .mockRejectedValueOnce(new Error("Uncaught Error: Invalid track"))
      .mockResolvedValueOnce({ teamId: "team", created: false });
    render(<TeamSubmissionModal {...props} />);
    const file = new File(["png"], "logo.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText(/Team Logo/), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Team" }));
    await screen.findByText("Your project wasn't saved");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(generateUploadUrl).toHaveBeenCalledTimes(1);
    expect(saveProject).toHaveBeenCalledTimes(2);
    expect(saveProject.mock.calls[1][0]).toMatchObject({
      logoStorageId: "storage1",
    });
  });

  it("does not save when the logo upload response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    );
    render(<TeamSubmissionModal {...props} />);
    fireEvent.change(screen.getByLabelText(/Team Logo/), {
      target: { files: [new File(["png"], "logo.png", { type: "image/png" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Team" }));
    expect(await screen.findByText(/logo couldn't be uploaded/)).toBeInTheDocument();
    expect(saveProject).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("rejects an unsupported logo file without touching other fields", () => {
    render(<TeamSubmissionModal {...props} />);
    fireEvent.change(screen.getByLabelText(/Description/), {
      target: { value: "Edited" },
    });
    fireEvent.change(screen.getByLabelText(/Team Logo/), {
      target: { files: [new File(["x"], "logo.pdf", { type: "application/pdf" })] },
    });
    expect(screen.getByText(/Choose a PNG, JPEG, WebP, or GIF image/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/)).toHaveValue("Edited");
  });
});

describe("project drafts and live updates", () => {
  it("restores a stored draft with a notice and lets the user discard it", () => {
    writeDraft(projectDraftKey("event", "user", "team"), PROJECT_DRAFT_SCHEMA, {
      name: "Garden",
      description: "Unsaved description",
      members: ["Alex", "Bo"],
      githubUrl: "https://github.com/example/garden",
      devpostUrl: "",
      track: "Environment",
      courseCode: "",
      prizeIds: [],
    });
    render(<TeamSubmissionModal {...props} />);
    expect(
      screen.getByText("Restored your unsaved draft from this device."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/)).toHaveValue("Unsaved description");

    fireEvent.click(screen.getByRole("button", { name: "Discard draft" }));
    expect(screen.getByLabelText(/Description/)).toHaveValue("A garden app");
    expect(
      readDraft(projectDraftKey("event", "user", "team"), PROJECT_DRAFT_SCHEMA)
        .status,
    ).toBe("missing");
  });

  it("keeps dirty edits when the server copy changes and offers the latest version", () => {
    const view = render(<TeamSubmissionModal {...props} />);
    fireEvent.change(screen.getByLabelText(/Description/), {
      target: { value: "My edit" },
    });
    team = { ...baseTeam, description: "Changed elsewhere" };
    view.rerender(<TeamSubmissionModal {...props} />);

    expect(screen.getByLabelText(/Description/)).toHaveValue("My edit");
    fireEvent.click(screen.getByRole("button", { name: "Load latest version" }));
    expect(screen.getByLabelText(/Description/)).toHaveValue("Changed elsewhere");
  });

  it("follows server changes when the form is clean", () => {
    const view = render(<TeamSubmissionModal {...props} />);
    team = { ...baseTeam, description: "Changed elsewhere" };
    view.rerender(<TeamSubmissionModal {...props} />);
    expect(screen.getByLabelText(/Description/)).toHaveValue("Changed elsewhere");
    expect(screen.queryByText("Load latest version")).not.toBeInTheDocument();
  });

  it("asks before closing a dirty form instead of discarding it", () => {
    render(<TeamSubmissionModal {...props} />);
    fireEvent.change(screen.getByLabelText(/Description/), {
      target: { value: "My edit" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("Close without submitting?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close and keep draft" }));
    expect(onClose).toHaveBeenCalled();
    expect(
      readDraft(projectDraftKey("event", "user", "team"), PROJECT_DRAFT_SCHEMA)
        .status,
    ).toBe("found");
  });
});
