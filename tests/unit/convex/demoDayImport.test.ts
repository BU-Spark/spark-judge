import { describe, expect, it } from "vitest";

import {
  buildBoardPlanForTest,
  buildDemoDayImportPlanForTest,
  normalizeDemoDayImportRows,
  parseBoardAssignmentCsv,
  parseCsv,
} from "../../../convex/demoDayImport";

describe("demoDayImport", () => {
  it("normalizes Airtable-style CSV data for a selected semester", () => {
    const assignments = parseCsv(
      [
        "Semester (from Project Instance),Project Instance,Contributor,Course (from Project Instance)",
        "Fall 2025,bpl-rag-a,Alice Smith,DS519",
        "Fall 2025,bpl-rag-a,Bob Jones,DS519",
        "Spring 2026,traffic-vision-a,Charlie Ray,DS549",
      ].join("\n"),
    );
    const projects = parseCsv(
      [
        "Project Instances,Project Name,GitHub Repo,Course (from Project Instances)",
        "bpl-rag-a,BPL RAG,https://github.com/demo/bpl-rag,DS519",
        "traffic-vision-a,Traffic Vision,https://github.com/demo/traffic,DS549",
      ].join("\n"),
    );

    expect(
      normalizeDemoDayImportRows({
        assignments,
        projects,
        semester: "Fall 2025",
      }),
    ).toEqual({
      rows: [
        {
          projectInstance: "bpl-rag-a",
          name: "BPL RAG",
          members: ["Alice Smith", "Bob Jones"],
          courseCode: "DS519",
          projectUrl: "https://github.com/demo/bpl-rag",
          githubUrl: "https://github.com/demo/bpl-rag",
        },
      ],
      skipped: [],
      duplicateNames: [],
    });
  });

  it("reports missing project instances and duplicate project names", () => {
    const assignments = parseCsv(
      [
        "Semester (from Project Instance),Project Instance,Contributor,Course (from Project Instance)",
        "Fall 2025,alpha-a,Alice,DS519",
        "Fall 2025,alpha-b,Bob,DS519",
        "Fall 2025,missing-a,Cora,DS519",
      ].join("\n"),
    );
    const projects = parseCsv(
      [
        "Project Instances,Project Name,GitHub Repo,Course (from Project Instances)",
        "alpha-a,Shared Name,https://example.com/a,DS519",
        "alpha-b,Shared Name,https://example.com/b,DS519",
      ].join("\n"),
    );

    const result = normalizeDemoDayImportRows({
      assignments,
      projects,
      semester: "Fall 2025",
    });

    expect(result.rows).toHaveLength(2);
    expect(result.duplicateNames).toEqual(["Shared Name"]);
    expect(result.skipped).toEqual([
      {
        projectInstance: "missing-a",
        reason: "Project instance not found in projects data",
      },
    ]);
  });

  it("uses project instances data as first-class import metadata", () => {
    const assignments = parseCsv(
      [
        "Semester (from Project Instance),Project Instance,Contributor,Course (from Project Instance)",
        "Spring 2026,one-score-a,Alice,DS519",
      ].join("\n"),
    );
    const projectInstances = parseCsv(
      [
        "Name,Semester,Project Name,Course,GitHub Repo,__recordId",
        "one-score-a,Spring 2026,OneScor Connector,DS519,https://github.com/demo/onescor,recInstance1",
      ].join("\n"),
    );
    const projects = parseCsv("Project Instances,Project Name,GitHub Repo\n");

    expect(
      normalizeDemoDayImportRows({
        assignments,
        projectInstances,
        projects,
        semester: "Spring 2026",
      }).rows,
    ).toEqual([
      {
        projectInstance: "one-score-a",
        name: "OneScor Connector",
        members: ["Alice"],
        courseCode: "DS519",
        projectUrl: "https://github.com/demo/onescor",
        githubUrl: "https://github.com/demo/onescor",
        airtableProjectInstanceRecordId: "recInstance1",
      },
    ]);
  });

  it("imports semester project instances even when assignments are missing", () => {
    const assignments = parseCsv(
      [
        "Semester (from Project Instance),Project Instance,Contributor,Course (from Project Instance)",
        "Spring 2026,with-student-a,Alice,DS519",
      ].join("\n"),
    );
    const projectInstances = parseCsv(
      [
        "Name,Semester,Project Name,Course,GitHub Repo,__recordId",
        "with-student-a,Spring 2026,With Student,DS519,https://github.com/demo/with,recWith",
        "xc473-news-a,Spring 2026,Granite State News: NH Profiling,XC473,,recNews",
        "old-news-a,Fall 2025,Old News,XC473,,recOld",
      ].join("\n"),
    );

    const result = normalizeDemoDayImportRows({
      assignments,
      projectInstances,
      projects: [],
      semester: "Spring 2026",
    });

    expect(result.rows).toEqual([
      {
        projectInstance: "with-student-a",
        name: "With Student",
        members: ["Alice"],
        courseCode: "DS519",
        projectUrl: "https://github.com/demo/with",
        githubUrl: "https://github.com/demo/with",
        airtableProjectInstanceRecordId: "recWith",
      },
      {
        projectInstance: "xc473-news-a",
        name: "Granite State News: NH Profiling",
        members: [],
        courseCode: "XC473",
        airtableProjectInstanceRecordId: "recNews",
      },
    ]);
  });

  it("plans idempotent updates by source project instance", () => {
    const rows = [
      {
        projectInstance: "bpl-rag-a",
        name: "BPL RAG",
        members: ["Alice Smith", "Bob Jones"],
        courseCode: "DS519",
        projectUrl: "https://github.com/demo/bpl-rag",
        githubUrl: "https://github.com/demo/bpl-rag",
      },
    ];

    const firstPreview = buildDemoDayImportPlanForTest({
      rows,
      existingTeams: [],
    });
    const secondPreview = buildDemoDayImportPlanForTest({
      rows,
      existingTeams: [
        {
          _id: "team1",
          name: "BPL RAG",
          members: ["Alice Smith", "Bob Jones"],
          courseCode: "DS519",
          projectUrl: "https://github.com/demo/bpl-rag",
          githubUrl: "https://github.com/demo/bpl-rag",
          hidden: false,
          demoDayProjectInstance: "bpl-rag-a",
        } as any,
      ],
    });

    expect(firstPreview.summary.createCount).toBe(1);
    expect(secondPreview.summary.unchangedCount).toBe(1);
    expect(secondPreview.summary.createCount).toBe(0);
  });

  it("plans legacy team updates by exact name and course fallback", () => {
    const preview = buildDemoDayImportPlanForTest({
      rows: [
        {
          projectInstance: "bpl-rag-a",
          name: "BPL RAG",
          members: ["Alice Smith", "Bob Jones"],
          courseCode: "DS519",
          projectUrl: "https://github.com/demo/bpl-rag",
          githubUrl: "https://github.com/demo/bpl-rag",
        },
      ],
      existingTeams: [
        {
          _id: "team1",
          name: "BPL RAG",
          members: ["Alice Smith"],
          courseCode: "DS519",
          projectUrl: "",
          githubUrl: "",
          hidden: false,
        } as any,
      ],
    });

    expect(preview.summary.updateCount).toBe(1);
    expect(preview.updates[0].changes).toEqual([
      "members",
      "projectUrl",
      "githubUrl",
      "projectInstance",
    ]);
  });

  it("validates board assignment CSV rows", () => {
    const result = parseBoardAssignmentCsv(
      [
        "projectInstance,round,boardNumber",
        "bpl-rag-a,4,A",
        "bpl-rag-a,5,B",
        "traffic-vision-a,nope,C",
        ",6,D",
      ].join("\n"),
    );

    expect(result.assignments).toEqual([
      {
        matchKey: "bpl-rag-a",
        projectInstance: "bpl-rag-a",
        round: 4,
        boardNumber: "A",
      },
    ]);
    expect(result.duplicateProjectInstances).toEqual(["bpl-rag-a"]);
    expect(result.invalidRows).toEqual([
      {
        rowNumber: 4,
        projectInstance: "traffic-vision-a",
        reason: "round must be a positive whole number",
      },
      {
        rowNumber: 5,
        reason: "projectInstance, project/team name, or sign name is required",
      },
    ]);
  });

  it("parses Spark board assignment exports without project instance keys", () => {
    const result = parseBoardAssignmentCsv(
      [
        "Board Number,Round,Time,Course,Course Name,Project/Team Name,Sign name,Full Sign Name (with Board Number),Eposterboard received,Notes",
        "A,4,5:30-5:55,XC473,JMCL,Granite State News: NH Profiling,Granite State News,XC473 JMCL: Granite State News (Board A),X,",
        "Board Number,Round,Time,Course,Course Name,Project/Team Name,Sign name,Full Sign Name (with Board Number),Eposterboard received,Notes",
        ",,,,,,,,,",
      ].join("\n"),
    );

    expect(result.invalidRows).toEqual([]);
    expect(result.assignments).toEqual([
      {
        matchKey: "XC473\u0000Granite State News: NH Profiling",
        projectName: "Granite State News: NH Profiling",
        signName: "Granite State News",
        fullSignName: "XC473 JMCL: Granite State News (Board A)",
        courseCode: "XC473",
        courseName: "JMCL",
        time: "5:30-5:55",
        round: 4,
        boardNumber: "A",
      },
    ]);
  });

  it("returns board row context and accepts manual reconciliation matches", () => {
    const parsed = parseBoardAssignmentCsv(
      [
        "Board Number,Round,Time,Course,Course Name,Project/Team Name,Sign name,Full Sign Name (with Board Number),Eposterboard received,Notes",
        "A,4,5:30-5:55,XC473,JMCL,Granite State News: NH Profiling,Granite State News,XC473 JMCL: Granite State News (Board A),X,",
      ].join("\n"),
    );
    const unmatchedPreview = buildBoardPlanForTest({
      assignments: parsed.assignments,
      teams: [
        {
          _id: "team1",
          name: "Different Airtable Name",
          courseCode: "XC473",
          hidden: false,
        } as any,
      ],
    });
    const manualPreview = buildBoardPlanForTest({
      assignments: parsed.assignments,
      teams: [
        {
          _id: "team1",
          name: "Different Airtable Name",
          courseCode: "XC473",
          hidden: false,
        } as any,
      ],
      manualMatches: [
        {
          matchKey: parsed.assignments[0].matchKey,
          teamId: "team1" as any,
        },
      ],
    });

    expect(unmatchedPreview.unmatched).toEqual([
      {
        ...parsed.assignments[0],
        reason: "No imported team matches this board row",
      },
    ]);
    expect(manualPreview.success).toBe(true);
    expect(manualPreview.matched[0]).toMatchObject({
      teamId: "team1",
      signName: "Granite State News",
      round: 4,
      boardNumber: "A",
    });
  });
});
