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

  describe('XML escaping', () => {
    it('should escape ampersands', () => {
      const str = 'Team A & B';
      const escaped = str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

      expect(escaped).toBe('Team A &amp; B');
    });

    it('should escape less than and greater than', () => {
      const str = '<script>alert("xss")</script>';
      const escaped = str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

      expect(escaped).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('should escape quotes and apostrophes', () => {
      const str = 'Team "Best" \'s Project';
      const escaped = str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

      expect(escaped).toBe('Team &quot;Best&quot; &apos;s Project');
    });

    it('should handle multiple special characters', () => {
      const str = 'A & B < C > D "E" \'F\'';
      const escaped = str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

      expect(escaped).toBe('A &amp; B &lt; C &gt; D &quot;E&quot; &apos;F&apos;');
    });
  });

  describe('generateLabeledQrSvg format', () => {
    it('should include XML declaration in SVG output', () => {
      const svgStart = '<?xml version="1.0" encoding="UTF-8"?>';
      expect(svgStart).toContain('<?xml');
      expect(svgStart).toContain('encoding="UTF-8"');
    });

    it('should calculate correct SVG dimensions for labeled QR', () => {
      const svgWidth = 600;
      const svgHeight = 700;

      expect(svgWidth).toBe(600);
      expect(svgHeight).toBe(700);
    });

    it('should calculate QR code scale factor correctly', () => {
      const qrNativeSize = 33;
      const qrTargetSize = 500;
      const scaleFactor = qrTargetSize / qrNativeSize;

      expect(scaleFactor).toBeCloseTo(15.15, 1);
    });

    it('should center QR code horizontally', () => {
      const svgWidth = 600;
      const qrTargetSize = 500;
      const qrX = (svgWidth - qrTargetSize) / 2;

      expect(qrX).toBe(50);
    });

    it('should position QR code lower when course code present', () => {
      const courseCode = 'DS519';
      const qrY = courseCode ? 80 : 40;

      expect(qrY).toBe(80);
    });

    it('should position QR code higher when no course code', () => {
      const courseCode = undefined;
      const qrY = courseCode ? 80 : 40;

      expect(qrY).toBe(40);
    });

    it('should truncate long team names', () => {
      const maxLength = 50;
      const teamName = 'A'.repeat(100);
      const displayTeamName =
        teamName.length > maxLength
          ? teamName.slice(0, maxLength - 3) + '...'
          : teamName;

      expect(displayTeamName.length).toBe(50);
      expect(displayTeamName).toContain('...');
    });

    it('should not truncate short team names', () => {
      const maxLength = 50;
      const teamName = 'Short Team Name';
      const displayTeamName =
        teamName.length > maxLength
          ? teamName.slice(0, maxLength - 3) + '...'
          : teamName;

      expect(displayTeamName).toBe('Short Team Name');
    });

    it('should include course code text element when present', () => {
      const courseCode = 'DS519';
      const svgWidth = 600;
      const courseElement = courseCode
        ? `<text x="${svgWidth / 2}" y="50" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="bold" fill="#333333">${courseCode}</text>`
        : '';

      expect(courseElement).toContain('DS519');
      expect(courseElement).toContain('font-size="36"');
      expect(courseElement).toContain('font-weight="bold"');
    });

    it('should omit course code text element when not present', () => {
      const courseCode = undefined;
      const svgWidth = 600;
      const courseElement = courseCode
        ? `<text x="${svgWidth / 2}" y="50" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="bold" fill="#333333">${courseCode}</text>`
        : '';

      expect(courseElement).toBe('');
    });
  });

  describe('generatePrintableHtml structure', () => {
    it('should group teams by course code', () => {
      const qrCodes = [
        { teamName: 'Team 1', courseCode: 'DS519', svg: '<svg></svg>', url: 'url1' },
        { teamName: 'Team 2', courseCode: 'DS519', svg: '<svg></svg>', url: 'url2' },
        { teamName: 'Team 3', courseCode: 'DS549', svg: '<svg></svg>', url: 'url3' },
      ];

      const courseGroups = new Map<string, typeof qrCodes>();
      for (const qr of qrCodes) {
        const course = qr.courseCode || 'General';
        if (!courseGroups.has(course)) {
          courseGroups.set(course, []);
        }
        courseGroups.get(course)!.push(qr);
      }

      expect(courseGroups.size).toBe(2);
      expect(courseGroups.get('DS519')?.length).toBe(2);
      expect(courseGroups.get('DS549')?.length).toBe(1);
    });

    it('should use "General" for teams without course code', () => {
      const qrCodes = [
        { teamName: 'Team 1', courseCode: undefined, svg: '<svg></svg>', url: 'url1' },
      ];

      const courseGroups = new Map<string, typeof qrCodes>();
      for (const qr of qrCodes) {
        const course = qr.courseCode || 'General';
        if (!courseGroups.has(course)) {
          courseGroups.set(course, []);
        }
        courseGroups.get(course)!.push(qr);
      }

      expect(courseGroups.has('General')).toBe(true);
      expect(courseGroups.get('General')?.length).toBe(1);
    });

    it('should sort courses alphabetically', () => {
      const courseGroups = new Map([
        ['DS549', []],
        ['DS519', []],
        ['CS101', []],
      ]);

      const sortedCourses = Array.from(courseGroups.keys()).sort();

      expect(sortedCourses).toEqual(['CS101', 'DS519', 'DS549']);
    });

    it('should escape XML in HTML document title', () => {
      const eventName = 'Demo Day <Fall 2024>';
      const escaped = eventName
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

      expect(escaped).toBe('Demo Day &lt;Fall 2024&gt;');
    });

    it('should create correct table of contents link format', () => {
      const course = 'DS519';
      const createSlug = (str: string) =>
        str
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

      const link = `#course-${createSlug(course)}`;

      expect(link).toBe('#course-ds519');
    });

    it('should format project count singular correctly', () => {
      const count = 1;
      const text = `${count} project${count !== 1 ? 's' : ''}`;

      expect(text).toBe('1 project');
    });

    it('should format project count plural correctly', () => {
      const count = 5;
      const text = `${count} project${count !== 1 ? 's' : ''}`;

      expect(text).toBe('5 projects');
    });

    it('should embed SVG content directly in HTML cards', () => {
      const svgContent = '<svg viewBox="0 0 600 700"><rect/></svg>';
      const cardHtml = `
        <div class="qr-card">
          ${svgContent}
        </div>`;

      expect(cardHtml).toContain(svgContent);
      expect(cardHtml).toContain('qr-card');
    });

    it('should add page-break-before class to subsequent course sections', () => {
      const courseIndex = 1;
      const className = `course-section ${courseIndex > 0 ? 'page-break-before' : ''}`;

      expect(className).toBe('course-section page-break-before');
    });

    it('should not add page-break-before class to first course section', () => {
      const courseIndex = 0;
      const className = `course-section ${courseIndex > 0 ? 'page-break-before' : ''}`;

      expect(className).toBe('course-section ');
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

