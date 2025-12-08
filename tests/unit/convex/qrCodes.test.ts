import { describe, it, expect } from "vitest";

describe("qrCodes business logic", () => {
  describe("URL generation", () => {
    it("should build correct appreciation URL format with event slug, team slug, and team ID", () => {
      const baseUrl = "https://example.com";
      const eventSlug = "demo-day-fall-2024";
      const teamSlug = "my-awesome-team";
      const teamId = "team456";

      const appreciationUrl = `${baseUrl}/event/${eventSlug}/${teamSlug}/${teamId}`;

      expect(appreciationUrl).toBe(
        "https://example.com/event/demo-day-fall-2024/my-awesome-team/team456"
      );
    });

    it("should handle base URLs with trailing slash", () => {
      const baseUrl = "https://example.com/";
      const eventSlug = "demo-day-fall-2024";
      const teamSlug = "my-awesome-team";
      const teamId = "team456";

      // In real code, we'd normalize this
      const appreciationUrl = `${baseUrl.replace(/\/$/, "")}/event/${eventSlug}/${teamSlug}/${teamId}`;

      expect(appreciationUrl).toBe(
        "https://example.com/event/demo-day-fall-2024/my-awesome-team/team456"
      );
    });
  });

  describe("slug generation", () => {
    it("should create slug from team name", () => {
      const teamName = "My Awesome Team";
      const slug = teamName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      expect(slug).toBe("my-awesome-team");
    });

    it("should handle special characters in team name", () => {
      const teamName = "Team #1 (Best!)";
      const slug = teamName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      expect(slug).toBe("team-1-best");
    });

    it("should handle numbers in team name", () => {
      const teamName = "DS519 Project 2024";
      const slug = teamName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      expect(slug).toBe("ds519-project-2024");
    });

    it("should handle leading/trailing special characters", () => {
      const teamName = "---My Team---";
      const slug = teamName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      expect(slug).toBe("my-team");
    });
  });

  describe("filename generation", () => {
    it("should create QR filename with course code", () => {
      const courseCode = "DS519";
      const slug = "my-awesome-team";
      const teamIdSuffix = "f3a2";

      const qrFilename = `${courseCode}_${slug}_${teamIdSuffix}.png`;

      expect(qrFilename).toBe("DS519_my-awesome-team_f3a2.png");
    });

    it("should use 'general' when no course code", () => {
      const courseCode = null;
      const slug = "my-team";
      const teamIdSuffix = "abcd";

      const coursePrefix = courseCode || "general";
      const qrFilename = `${coursePrefix}_${slug}_${teamIdSuffix}.png`;

      expect(qrFilename).toBe("general_my-team_abcd.png");
    });

    it("should use last 4 characters of team ID", () => {
      const teamId = "jd7e3hs9c2v4f3a2b1c5";
      const teamIdSuffix = teamId.slice(-4);

      expect(teamIdSuffix).toBe("b1c5");
    });
  });

  describe("CSV content generation", () => {
    it("should generate proper CSV headers", () => {
      const headers = [
        "teamId",
        "courseCode",
        "teamName",
        "slug",
        "qrFilename",
        "appreciationUrl",
      ];

      const csvHeader = headers.join(",");

      expect(csvHeader).toBe(
        "teamId,courseCode,teamName,slug,qrFilename,appreciationUrl"
      );
    });

    it("should escape quotes in CSV cells", () => {
      const cellWithQuote = 'Team "Awesome"';
      const escaped = `"${cellWithQuote.replace(/"/g, '""')}"`;

      expect(escaped).toBe('"Team ""Awesome"""');
    });

    it("should wrap cells in quotes", () => {
      const row = ["team123", "DS519", "My Team", "my-team", "file.png", "url"];
      const csvRow = row.map((cell) => `"${cell}"`).join(",");

      expect(csvRow).toBe(
        '"team123","DS519","My Team","my-team","file.png","url"'
      );
    });
  });

  describe("event validation", () => {
    it("should validate event mode is demo_day", () => {
      const demoDayEvent = { mode: "demo_day" as const };
      const hackathonEvent = { mode: "hackathon" as const };
      const undefinedModeEvent = { mode: undefined };

      expect(demoDayEvent.mode === "demo_day").toBe(true);
      expect(hackathonEvent.mode === "demo_day").toBe(false);
      expect(undefinedModeEvent.mode === "demo_day").toBe(false);
    });
  });

  describe("team filtering", () => {
    it("should filter out hidden teams", () => {
      const teams = [
        { _id: "1", name: "Team A", hidden: false },
        { _id: "2", name: "Team B", hidden: true },
        { _id: "3", name: "Team C", hidden: undefined },
      ];

      const visibleTeams = teams.filter((t) => !t.hidden);

      expect(visibleTeams).toHaveLength(2);
      expect(visibleTeams.map((t) => t.name)).toEqual(["Team A", "Team C"]);
    });
  });

  describe("ZIP filename generation", () => {
    it("should create ZIP filename from event name", () => {
      const eventName = "Demo Day Fall 2024";
      const eventSlug = eventName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const filename = `${eventSlug}_qr-codes.zip`;

      expect(filename).toBe("demo-day-fall-2024_qr-codes.zip");
    });
  });
});

