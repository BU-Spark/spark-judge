import { describe, expect, it } from "vitest";

import {
  shapePrizeForPublic,
  shapePrizeSubmissionForJudge,
} from "../../../convex/prizes";

describe("prize security DTOs", () => {
  it("omits prize authorship and timestamps from public prize data", () => {
    const result = shapePrizeForPublic({
      _id: "prize-1",
      eventId: "event-1",
      name: "Best Project",
      description: "A prize",
      type: "general",
      createdBy: "user-1",
      createdAt: 10,
      updatedAt: 20,
      sortOrder: 1,
    });

    expect(result).toMatchObject({ _id: "prize-1", name: "Best Project" });
    expect(result).not.toHaveProperty("createdBy");
    expect(result).not.toHaveProperty("createdAt");
    expect(result).not.toHaveProperty("updatedAt");
  });

  it("omits submission actor and timestamps from verified-judge reads", () => {
    const result = shapePrizeSubmissionForJudge({
      eventId: "event-1",
      teamId: "team-1",
      prizeId: "prize-1",
      submittedBy: "user-1",
      submittedAt: 10,
    });

    expect(result).toEqual({
      eventId: "event-1",
      teamId: "team-1",
      prizeId: "prize-1",
    });
  });
});
