import { describe, it, expect } from "vitest";

describe("DemoDayBrowse - Filtering Logic", () => {
  describe("search filtering", () => {
    const teams = [
      {
        _id: "team1",
        name: "Alpha Team",
        description: "Building an AI chatbot",
        members: ["Alice Smith", "Bob Jones"],
        courseCode: "DS519",
        hidden: false,
      },
      {
        _id: "team2",
        name: "Beta Team",
        description: "Web development project",
        members: ["Charlie Brown", "Diana Prince"],
        courseCode: "DS549",
        hidden: false,
      },
      {
        _id: "team3",
        name: "Gamma Team",
        description: "Mobile app for students",
        members: ["Eve Johnson"],
        courseCode: "DS519",
        hidden: false,
      },
      {
        _id: "team4",
        name: "Delta Team",
        description: "Data analysis tool",
        members: ["Frank Miller"],
        courseCode: "DS549",
        hidden: true,
      },
    ];

    it("should filter teams by name (case-insensitive)", () => {
      const searchQuery = "alpha";
      const filtered = teams
        .filter((team) => !team.hidden)
        .filter((team) => {
          const query = searchQuery.toLowerCase();
          return (
            team.name.toLowerCase().includes(query) ||
            team.description.toLowerCase().includes(query) ||
            (team.members || []).some((m) => m.toLowerCase().includes(query))
          );
        });

      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe("Alpha Team");
    });

    it("should filter teams by description", () => {
      const searchQuery = "chatbot";
      const filtered = teams
        .filter((team) => !team.hidden)
        .filter((team) => {
          const query = searchQuery.toLowerCase();
          return (
            team.name.toLowerCase().includes(query) ||
            team.description.toLowerCase().includes(query) ||
            (team.members || []).some((m) => m.toLowerCase().includes(query))
          );
        });

      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe("Alpha Team");
    });

    it("should filter teams by member names", () => {
      const searchQuery = "Alice";
      const filtered = teams
        .filter((team) => !team.hidden)
        .filter((team) => {
          const query = searchQuery.toLowerCase();
          return (
            team.name.toLowerCase().includes(query) ||
            team.description.toLowerCase().includes(query) ||
            (team.members || []).some((m) => m.toLowerCase().includes(query))
          );
        });

      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe("Alpha Team");
    });

    it("should filter out hidden teams", () => {
      const filtered = teams.filter((team) => !team.hidden);

      expect(filtered.length).toBe(3);
      expect(filtered.every((t) => t.name !== "Delta Team")).toBe(true);
    });

    it("should handle partial matches in search", () => {
      const searchQuery = "team";
      const filtered = teams
        .filter((team) => !team.hidden)
        .filter((team) => {
          const query = searchQuery.toLowerCase();
          return (
            team.name.toLowerCase().includes(query) ||
            team.description.toLowerCase().includes(query) ||
            (team.members || []).some((m) => m.toLowerCase().includes(query))
          );
        });

      expect(filtered.length).toBe(3); // All visible teams have "team" in name
    });

    it("should return empty array when no matches", () => {
      const searchQuery = "nonexistent";
      const filtered = teams
        .filter((team) => !team.hidden)
        .filter((team) => {
          const query = searchQuery.toLowerCase();
          return (
            team.name.toLowerCase().includes(query) ||
            team.description.toLowerCase().includes(query) ||
            (team.members || []).some((m) => m.toLowerCase().includes(query))
          );
        });

      expect(filtered.length).toBe(0);
    });
  });

  describe("course filtering", () => {
    const teams = [
      {
        _id: "team1",
        name: "Team A",
        description: "Test A",
        courseCode: "DS519",
        hidden: false,
      },
      {
        _id: "team2",
        name: "Team B",
        description: "Test B",
        courseCode: "DS549",
        hidden: false,
      },
      {
        _id: "team3",
        name: "Team C",
        description: "Test C",
        courseCode: "DS519",
        hidden: false,
      },
      {
        _id: "team4",
        name: "Team D",
        description: "Test D",
        courseCode: undefined,
        hidden: false,
      },
    ];

    it("should filter teams by selected course code", () => {
      const selectedCourse = "DS519";
      const filtered = teams
        .filter((team) => !team.hidden)
        .filter((team) => team.courseCode === selectedCourse);

      expect(filtered.length).toBe(2);
      expect(filtered.every((t) => t.courseCode === "DS519")).toBe(true);
    });

    it("should show all teams when selectedCourse is null", () => {
      const selectedCourse = null;
      const filtered = teams
        .filter((team) => !team.hidden)
        .filter((team) => {
          if (selectedCourse && team.courseCode !== selectedCourse) {
            return false;
          }
          return true;
        });

      expect(filtered.length).toBe(4);
    });
  });

  describe("combined filtering", () => {
    const teams = [
      {
        _id: "team1",
        name: "Alpha Team",
        description: "Building an AI chatbot",
        members: ["Alice Smith"],
        courseCode: "DS519",
        hidden: false,
      },
      {
        _id: "team2",
        name: "Beta Team",
        description: "Web development",
        members: ["Charlie Brown"],
        courseCode: "DS549",
        hidden: false,
      },
      {
        _id: "team3",
        name: "Gamma Team",
        description: "Mobile app",
        members: ["Alice Johnson"],
        courseCode: "DS519",
        hidden: false,
      },
    ];

    it("should apply both search and course filters", () => {
      const searchQuery = "gamma";
      const selectedCourse = "DS519";

      const filtered = teams
        .filter((team) => !team.hidden)
        .filter((team) => {
          // Search filter
          if (searchQuery) {
            const query = searchQuery.toLowerCase();
            if (
              !team.name.toLowerCase().includes(query) &&
              !team.description.toLowerCase().includes(query) &&
              !(team.members || []).some((m) => m.toLowerCase().includes(query))
            ) {
              return false;
            }
          }
          // Course filter
          if (selectedCourse && team.courseCode !== selectedCourse) {
            return false;
          }
          return true;
        });

      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe("Gamma Team");
    });

    it("should return empty when combined filters have no matches", () => {
      const searchQuery = "Web";
      const selectedCourse = "DS519";

      const filtered = teams
        .filter((team) => !team.hidden)
        .filter((team) => {
          if (searchQuery) {
            const query = searchQuery.toLowerCase();
            if (
              !team.name.toLowerCase().includes(query) &&
              !team.description.toLowerCase().includes(query) &&
              !(team.members || []).some((m) => m.toLowerCase().includes(query))
            ) {
              return false;
            }
          }
          if (selectedCourse && team.courseCode !== selectedCourse) {
            return false;
          }
          return true;
        });

      expect(filtered.length).toBe(0);
    });
  });
});

describe("DemoDayBrowse - Grouping Logic", () => {
  describe("grouping teams by course", () => {
    const teams = [
      {
        _id: "team1",
        name: "Team A",
        description: "Test A",
        courseCode: "DS519",
        hidden: false,
      },
      {
        _id: "team2",
        name: "Team B",
        description: "Test B",
        courseCode: "DS549",
        hidden: false,
      },
      {
        _id: "team3",
        name: "Team C",
        description: "Test C",
        courseCode: "DS519",
        hidden: false,
      },
      {
        _id: "team4",
        name: "Team D",
        description: "Test D",
        courseCode: undefined,
        hidden: false,
      },
    ];

    it("should group teams by course code", () => {
      const grouped = new Map<string, typeof teams>();

      teams
        .filter((team) => !team.hidden)
        .forEach((team) => {
          const course = team.courseCode || "Other";
          if (!grouped.has(course)) {
            grouped.set(course, []);
          }
          grouped.get(course)!.push(team);
        });

      expect(grouped.size).toBe(3);
      expect(grouped.get("DS519")?.length).toBe(2);
      expect(grouped.get("DS549")?.length).toBe(1);
      expect(grouped.get("Other")?.length).toBe(1);
    });

    it("should sort courses alphabetically (except Other)", () => {
      const grouped = new Map<string, typeof teams>();

      teams
        .filter((team) => !team.hidden)
        .forEach((team) => {
          const course = team.courseCode || "Other";
          if (!grouped.has(course)) {
            grouped.set(course, []);
          }
          grouped.get(course)!.push(team);
        });

      const sorted = Array.from(grouped.entries()).sort(([a], [b]) => {
        if (a === "Other") return 1;
        if (b === "Other") return -1;
        return a.localeCompare(b);
      });

      expect(sorted.length).toBe(3);
      expect(sorted[0][0]).toBe("DS519");
      expect(sorted[1][0]).toBe("DS549");
      expect(sorted[2][0]).toBe("Other");
    });

    it("should handle teams without course code as 'Other'", () => {
      const grouped = new Map<string, typeof teams>();

      teams
        .filter((team) => !team.hidden)
        .forEach((team) => {
          const course = team.courseCode || "Other";
          if (!grouped.has(course)) {
            grouped.set(course, []);
          }
          grouped.get(course)!.push(team);
        });

      expect(grouped.has("Other")).toBe(true);
      expect(grouped.get("Other")?.length).toBe(1);
      expect(grouped.get("Other")![0].name).toBe("Team D");
    });
  });

  describe("extracting unique course codes", () => {
    const teams = [
      {
        _id: "team1",
        name: "Team A",
        courseCode: "DS519",
        hidden: false,
      },
      {
        _id: "team2",
        name: "Team B",
        courseCode: "DS549",
        hidden: false,
      },
      {
        _id: "team3",
        name: "Team C",
        courseCode: "DS519",
        hidden: false,
      },
      {
        _id: "team4",
        name: "Team D",
        courseCode: undefined,
        hidden: false,
      },
    ];

    it("should extract unique course codes", () => {
      const codes = new Set<string>();
      teams.forEach((team) => {
        if (team.courseCode) {
          codes.add(team.courseCode);
        }
      });

      const sortedCodes = Array.from(codes).sort();

      expect(sortedCodes.length).toBe(2);
      expect(sortedCodes).toEqual(["DS519", "DS549"]);
    });

    it("should not include undefined in course codes", () => {
      const codes = new Set<string>();
      teams.forEach((team) => {
        if (team.courseCode) {
          codes.add(team.courseCode);
        }
      });

      expect(codes.has("Other")).toBe(false);
      expect(codes.has("undefined")).toBe(false);
    });
  });
});
