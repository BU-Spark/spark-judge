import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";

import {
  LOGO_SWEEP_BATCH_SIZE,
  LOGO_UPLOAD_RETENTION_MS,
  sweepAbandonedLogoUploads,
} from "../../../convex/teams";
import schema from "../../../convex/schema";
import crons from "../../../convex/crons";

type StoredFile = { _id: string; _creationTime: number };

const NOW = Date.UTC(2026, 9, 21, 8, 0, 0);
const HOUR = 60 * 60 * 1000;

/**
 * In-memory ctx: `_storage` honours the creation-time range and `take`, and
 * team lookups resolve against `by_logo_storage`.
 */
function makeCtx(files: StoredFile[], teams: Array<{ _id: string; logoStorageId?: string }>) {
  const stored = [...files];
  const rangeCalls: Array<{ gt?: number; lt?: number }> = [];
  const storageQuery = {
    withIndex: (index: string, build: (q: any) => any) => {
      expect(index).toBe("by_creation_time");
      const range: { gt?: number; lt?: number } = {};
      const q: any = {
        gt: (_field: string, value: number) => ((range.gt = value), q),
        lt: (_field: string, value: number) => ((range.lt = value), q),
      };
      build(q);
      rangeCalls.push(range);
      return {
        order: (direction: string) => {
          expect(direction).toBe("asc");
          return {
            take: async (n: number) =>
              stored
                .filter(
                  (file) =>
                    (range.gt === undefined || file._creationTime > range.gt) &&
                    (range.lt === undefined || file._creationTime < range.lt),
                )
                .sort((a, b) => a._creationTime - b._creationTime)
                .slice(0, n),
          };
        },
      };
    },
  };
  const ctx = {
    db: {
      system: {
        query: vi.fn((table: string) => {
          expect(table).toBe("_storage");
          return storageQuery;
        }),
      },
      query: vi.fn((table: string) => {
        expect(table).toBe("teams");
        return {
          withIndex: (index: string, build: (q: any) => any) => {
            expect(index).toBe("by_logo_storage");
            let target: string | undefined;
            build({ eq: (_field: string, value: string) => ((target = value), undefined) });
            return { first: async () => teams.find((team) => team.logoStorageId === target) ?? null };
          },
        };
      }),
    },
    storage: {
      delete: vi.fn(async (id: string) => {
        const index = stored.findIndex((file) => file._id === id);
        if (index >= 0) stored.splice(index, 1);
      }),
    },
    scheduler: { runAfter: vi.fn() },
  };
  return { ctx, stored, rangeCalls };
}

const run = (ctx: unknown, args: { afterCreationTime?: number } = {}) =>
  (sweepAbandonedLogoUploads as any)._handler(ctx, args);

describe("sweepAbandonedLogoUploads", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  it("deletes unreferenced files older than the retention window and keeps the rest", async () => {
    const old = NOW - LOGO_UPLOAD_RETENTION_MS - HOUR;
    const files = [
      { _id: "orphan", _creationTime: old },
      { _id: "in-use", _creationTime: old + 1 },
      { _id: "replaced", _creationTime: old + 2 },
      { _id: "recent-upload", _creationTime: NOW - HOUR },
    ];
    const { ctx, stored } = makeCtx(files, [
      { _id: "team-1", logoStorageId: "in-use" },
      { _id: "team-2" },
    ]);

    const result = await run(ctx);

    expect(result).toEqual({ scanned: 3, deleted: 2, continued: false });
    expect(ctx.storage.delete.mock.calls.map(([id]) => id)).toEqual(["orphan", "replaced"]);
    expect(stored.map((file) => file._id)).toEqual(["in-use", "recent-upload"]);
    expect(ctx.scheduler.runAfter).not.toHaveBeenCalled();
  });

  it("is idempotent: a second run deletes nothing more", async () => {
    const old = NOW - LOGO_UPLOAD_RETENTION_MS - HOUR;
    const { ctx } = makeCtx(
      [
        { _id: "orphan", _creationTime: old },
        { _id: "in-use", _creationTime: old + 1 },
      ],
      [{ _id: "team-1", logoStorageId: "in-use" }],
    );

    await run(ctx);
    const second = await run(ctx);

    expect(second).toEqual({ scanned: 1, deleted: 0, continued: false });
    expect(ctx.storage.delete).toHaveBeenCalledTimes(1);
  });

  it("bounds each run and continues after the last examined file", async () => {
    const old = NOW - LOGO_UPLOAD_RETENTION_MS - HOUR;
    const files = Array.from({ length: LOGO_SWEEP_BATCH_SIZE + 5 }, (_, i) => ({
      _id: `file-${i}`,
      _creationTime: old + i,
    }));
    // Every file in the first batch is still in use, so a naive restart would stall.
    const teams = files
      .slice(0, LOGO_SWEEP_BATCH_SIZE)
      .map((file, i) => ({ _id: `team-${i}`, logoStorageId: file._id }));
    const { ctx, rangeCalls } = makeCtx(files, teams);

    const first = await run(ctx);
    expect(first).toEqual({ scanned: LOGO_SWEEP_BATCH_SIZE, deleted: 0, continued: true });
    expect(ctx.scheduler.runAfter).toHaveBeenCalledTimes(1);
    const [delay, fn, args] = ctx.scheduler.runAfter.mock.calls[0];
    expect(delay).toBe(0);
    expect(getFunctionName(fn)).toBe("teams:sweepAbandonedLogoUploads");
    expect(args).toEqual({ afterCreationTime: old + LOGO_SWEEP_BATCH_SIZE - 1 });

    const second = await run(ctx, args);
    expect(second).toEqual({ scanned: 5, deleted: 5, continued: false });
    expect(rangeCalls[1]).toEqual({
      gt: old + LOGO_SWEEP_BATCH_SIZE - 1,
      lt: NOW - LOGO_UPLOAD_RETENTION_MS,
    });
    expect(ctx.scheduler.runAfter).toHaveBeenCalledTimes(1);
  });

  it("is scheduled once a day at 08:00 UTC", () => {
    const job = (crons as any).crons["delete abandoned project logo uploads"];
    expect(job.name).toBe("teams:sweepAbandonedLogoUploads");
    expect(job.schedule).toEqual({ type: "daily", hourUTC: 8, minuteUTC: 0 });
  });

  it("keeps the teams index the sweep depends on", () => {
    const exported = (schema.tables.teams as any).export();
    expect(
      exported.indexes.find((index: { indexDescriptor: string }) => index.indexDescriptor === "by_logo_storage")
        ?.fields,
    ).toEqual(["logoStorageId"]);
  });
});
