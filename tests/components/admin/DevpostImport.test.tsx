import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

const mutations = vi.hoisted(() => ({
  createTeam: vi.fn(),
  updateTeamAdmin: vi.fn(),
  setTeamPrizeSubmissionsAdmin: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useMutation: (name: keyof typeof mutations) => mutations[name],
}));
vi.mock("../../../convex/_generated/api", () => ({
  api: {
    teams: { createTeam: "createTeam", updateTeamAdmin: "updateTeamAdmin" },
    prizes: { setTeamPrizeSubmissionsAdmin: "setTeamPrizeSubmissionsAdmin" },
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { DevpostImport } from "../../../src/features/admin/panels/DevpostImport";

const prizes = [
  { _id: "lovable", name: "Best Use of Lovable", type: "sponsor" as const },
  { _id: "first", name: "Best First-Time Hacker", type: "general" as const },
];
const props = {
  eventId: "event" as any,
  tracks: ["Health & BioTech"],
  prizes,
  existingTeams: [],
};
function csv(status = "Submitted", optIns = "Best Use of Lovable;Best First-Time Hacker") {
  return [
    "Project Title,Submission Url,Project Status,Opt-In Prizes,What Is Your Teams Track?,Submitter First Name,Submitter Last Name,Submitter Email",
    `Sample,https://devpost.com/software/sample,${status},${optIns},Health+BiotechHack,Ann,One,Ann@example.edu`,
  ].join("\n");
}
async function upload(text: string) {
  const file = new File([text], "devpost.csv", { type: "text/csv" });
  Object.defineProperty(file, "text", { value: async () => text });
  await act(async () => {
    fireEvent.change(screen.getByLabelText("Devpost export file"), { target: { files: [file] } });
  });
}
async function click(name: string) {
  await act(async () => { fireEvent.click(screen.getByRole("button", { name })); });
}
beforeEach(() => {
  Object.values(mutations).forEach((fn) => fn.mockReset());
  mutations.createTeam.mockResolvedValue("team");
  mutations.updateTeamAdmin.mockResolvedValue(null);
  mutations.setTeamPrizeSubmissionsAdmin.mockResolvedValue(null);
});

describe("Devpost import", () => {
  it("creates a submitted team with its track, members, and multiple prize opt-ins", async () => {
    render(<DevpostImport {...props} />);
    await upload(csv());
    await click("Import 1 team");
    expect(mutations.createTeam).toHaveBeenCalledWith(expect.objectContaining({
      eventId: "event", name: "Sample", track: "Health & BioTech",
      members: ["Ann One"], entrantEmails: ["ann@example.edu"],
      devpostUrl: "https://devpost.com/software/sample",
    }));
    expect(mutations.setTeamPrizeSubmissionsAdmin).toHaveBeenCalledWith({
      eventId: "event", teamId: "team", prizeIds: ["lovable", "first"],
    });
    expect(screen.getByText(/added 1 team/)).toBeInTheDocument();
  });

  it("includes drafts by default and imports their prize opt-ins", async () => {
    render(<DevpostImport {...props} />);
    await upload(csv("Draft"));
    expect(screen.getByText(/1 draft project included/)).toBeInTheDocument();
    await click("Import 1 team");
    expect(mutations.createTeam).toHaveBeenCalledTimes(1);
    expect(mutations.setTeamPrizeSubmissionsAdmin).toHaveBeenCalledWith({
      eventId: "event", teamId: "team", prizeIds: ["lovable", "first"],
    });
  });

  it("explains a draft-only export when drafts are turned off and makes no writes", async () => {
    render(<DevpostImport {...props} />);
    await upload(csv("Draft"));
    const toggle = screen.getByRole("checkbox", { name: "Include draft projects" });
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Nothing to import" })).toBeDisabled();
    expect(screen.getByText(/No submitted projects in this export/)).toHaveTextContent(/Select "Include draft projects"/);
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Import 1 team" })).toBeEnabled();
    Object.values(mutations).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });

  it("imports Devpost's Submitted (Gallery/Visible) status", async () => {
    render(<DevpostImport {...props} />);
    await upload(csv("Submitted (Gallery/Visible)"));
    expect(screen.queryByText(/draft project included/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import 1 team" })).toBeEnabled();
  });

  it("requires confirmation to update an existing team and clears removed opt-ins", async () => {
    render(<DevpostImport {...props} existingTeams={[{ _id: "team", name: "Old title", devpostUrl: "https://devpost.com/software/sample" }]} />);
    await upload(csv("Submitted", ""));
    await click("Import 1 team");
    expect(mutations.updateTeamAdmin).not.toHaveBeenCalled();
    await click("Update 1");
    expect(mutations.createTeam).not.toHaveBeenCalled();
    expect(mutations.updateTeamAdmin).toHaveBeenCalledWith(expect.objectContaining({ teamId: "team", name: "Sample" }));
    expect(mutations.setTeamPrizeSubmissionsAdmin).toHaveBeenCalledWith({ eventId: "event", teamId: "team", prizeIds: [] });
    expect(screen.getByText(/updated 1/)).toBeInTheDocument();
  });

  it("blocks a missing prize column before existing entries can be erased", async () => {
    render(<DevpostImport {...props} existingTeams={[{ _id: "team", name: "Sample" }]} />);
    await upload(csv().replace("Opt-In Prizes", "Unrelated"));
    expect(screen.getByRole("alert")).toHaveTextContent('no "Opt-In Prizes" column');
    Object.values(mutations).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });

  it("can retry a prize failure by re-reading the saved team without duplicating it", async () => {
    mutations.setTeamPrizeSubmissionsAdmin.mockRejectedValueOnce(new Error("Prize service unavailable"));
    const { rerender } = render(<DevpostImport {...props} />);
    await upload(csv());
    await click("Import 1 team");
    expect(screen.getByText(/Sample: Prize service unavailable/)).toBeInTheDocument();
    rerender(<DevpostImport {...props} existingTeams={[{ _id: "team", name: "Sample" }]} />);
    await upload(csv());
    await click("Import 1 team");
    await click("Update 1");
    expect(mutations.createTeam).toHaveBeenCalledTimes(1);
    expect(mutations.setTeamPrizeSubmissionsAdmin).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/updated 1/)).toBeInTheDocument();
  });
});
