import { catalogue, docsUrl } from "@unframework/diagnostics";
import { describe, expect, it } from "vitest";

import { run } from "./helpers.ts";

describe("explain", () => {
  it("prints a code's catalogue entry and its link", async () => {
    const { code, stdout, stderr } = await run(".", "explain", "UF1002");
    const entry = catalogue.get("UF1002")!;
    expect(code).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain(`UF1002 ${entry.name} (${entry.severity})`);
    expect(stdout).toContain(entry.title);
    expect(stdout).toContain(entry.description);
    expect(stdout).toContain(docsUrl("UF1002"));
  });

  it.each([["UF0000"], ["uf1002"], ["constructor"]])("exits 2 on %s", async (unknown) => {
    const { code, stdout, stderr } = await run(".", "explain", unknown);
    expect(code).toBe(2);
    expect(stdout).toBe("");
    expect(stderr).toContain(`"${unknown}" is no diagnostic code`);
  });

  it("exits 2 without one code", async () => {
    expect((await run(".", "explain")).code).toBe(2);
    expect((await run(".", "explain", "UF1002", "UF1003")).code).toBe(2);
    expect((await run(".", "explain", "--nope", "UF1002")).code).toBe(2);
  });
});
