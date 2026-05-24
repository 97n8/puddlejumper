import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as migrationsModule from "../../puddlejumper/src/api/migrations.js";
import { main } from "./migrate.mjs";

describe("migrate CLI", () => {
  const stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  const runSpy = vi.spyOn(migrationsModule, "runPuddleJumperMigrations");
  const markSpy = vi.spyOn(migrationsModule, "markPuddleJumperMigrationApplied");

  beforeEach(() => {
    stdoutWrite.mockClear();
    runSpy.mockReset();
    markSpy.mockReset();
    runSpy.mockReturnValue({ applied: ["20260206_add_prr_public_id.sql"], skipped: [] });
    markSpy.mockReturnValue({
      filename: "20260206_add_prr_public_id.sql",
      applied_at: "2026-05-24T00:00:00.000Z",
      checksum: "abc",
      target_database: "prr",
      description: "Add public_id column to prr table and index it.",
      author: "97n8",
      authored_date: "2026-02-06",
      apply_method: "marked",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("applies pending migrations with the default command", async () => {
    await main([]);
    expect(runSpy).toHaveBeenCalledOnce();
    expect(stdoutWrite).toHaveBeenCalledWith("APPLIED 20260206_add_prr_public_id.sql\n");
  });

  it("refuses mark-applied without the safety flag", async () => {
    await expect(
      main(["mark-applied", "--database", "prr", "--filename", "20260206_add_prr_public_id.sql"]),
    ).rejects.toThrow(/--out-of-band-applied/);
    expect(markSpy).not.toHaveBeenCalled();
  });

  it("allows mark-applied with the safety flag", async () => {
    await main([
      "mark-applied",
      "--database",
      "prr",
      "--filename",
      "20260206_add_prr_public_id.sql",
      "--out-of-band-applied",
    ]);

    expect(markSpy).toHaveBeenCalledOnce();
    expect(stdoutWrite).toHaveBeenCalledWith(
      "MARKED 20260206_add_prr_public_id.sql 2026-05-24T00:00:00.000Z marked\n",
    );
  });
});
