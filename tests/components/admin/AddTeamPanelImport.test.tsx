import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

const setPrizes = vi.hoisted(() => vi.fn());

vi.mock("convex/react", () => ({
  useMutation: () => setPrizes,
}));
vi.mock("../../../convex/_generated/api", () => ({
  api: {
    prizes: { setTeamPrizeSubmissionsAdmin: "setTeamPrizeSubmissionsAdmin" },
    teams: { createTeam: "createTeam", updateTeamAdmin: "updateTeamAdmin" },
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { AddTeamPanel } from "../../../src/features/admin/panels/AddTeamPanel";

const prizes = [{ _id: "prize1", name: "Best Overall", type: "general", isActive: true }];

function csvFile() {
  const csv = [
    "name,track,prizes",
    "Alpha,AI,Best Overall",
    "Beta,AI,",
  ].join("\n");
  const file = new File([csv], "teams.csv", { type: "text/csv" });
  // jsdom's File may not implement text(); the panel reads the file through it.
  Object.defineProperty(file, "text", { value: async () => csv });
  return file;
}

async function loadCsv(container: HTMLElement) {
  const input = container.querySelector('input[aria-label="Team CSV file"]') as HTMLInputElement;
  await act(async () => {
    fireEvent.change(input, { target: { files: [csvFile()] } });
  });
}

beforeEach(() => {
  setPrizes.mockReset();
});

describe("CSV import partial failure (I02)", () => {
  it("retries prize assignment only, without recreating the team", async () => {
    const createTeam = vi
      .fn()
      .mockImplementation(async ({ name }: { name: string }) => `team-${name}`);
    setPrizes.mockRejectedValueOnce(new Error("Prize service unavailable")).mockResolvedValue(null);

    const { container } = render(
      <AddTeamPanel
        eventId={"event1" as any}
        onClose={() => {}}
        onSubmit={createTeam}
        eventMode="hackathon"
        tracks={["AI"]}
        eventPrizes={prizes}
        panelMode="bulk"
      />,
    );
    await loadCsv(container);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Import 2 Teams" }));
    });

    expect(createTeam).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Created, but prizes not saved (1)")).toBeInTheDocument();
    expect(screen.queryByText(/^Not created/)).not.toBeInTheDocument();
    expect(screen.getByText(/Imported 1 of 2 teams/)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry prize entries" }));
    });

    // No second creation for Alpha: only the prize step ran again.
    expect(createTeam).toHaveBeenCalledTimes(2);
    expect(setPrizes).toHaveBeenCalledTimes(2);
    expect(setPrizes).toHaveBeenLastCalledWith({
      eventId: "event1",
      teamId: "team-Alpha",
      prizeIds: ["prize1"],
    });
    await waitFor(() => expect(screen.getByText(/Imported 1 team from teams.csv/)).toBeInTheDocument());
  });

  it("reports rows that were never created separately", async () => {
    const createTeam = vi
      .fn()
      .mockRejectedValueOnce(new Error("Team name already exists"))
      .mockResolvedValue("team-Beta");

    const { container } = render(
      <AddTeamPanel
        eventId={"event1" as any}
        onClose={() => {}}
        onSubmit={createTeam}
        eventMode="hackathon"
        tracks={["AI"]}
        eventPrizes={prizes}
        panelMode="bulk"
      />,
    );
    await loadCsv(container);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Import 2 Teams" }));
    });

    expect(screen.getByText("Not created (1)")).toBeInTheDocument();
    expect(screen.queryByText(/Created, but prizes not saved/)).not.toBeInTheDocument();
    expect(setPrizes).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Import 1 Team" })).toBeInTheDocument();
  });
});
