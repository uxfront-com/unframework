import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { listCases } from "./cases.ts";
import { ROOT } from "./paths.ts";
import { onlyCases, referencePasses } from "./references.ts";

const cases = listCases();
const LISTBOX = "cases/semantics/listbox/listbox.test.ts";

describe("referencePasses (ADR-0057)", () => {
  it("runs each case's own reference on its cases, with the caller's options as given", () => {
    expect(referencePasses(cases, [])).toEqual([{ target: "react", args: [LISTBOX] }]);
    expect(referencePasses(cases, ["--maxWorkers=1", "-t", "selects no option"])).toEqual([
      { target: "react", args: ["--maxWorkers=1", "-t", "selects no option", LISTBOX] },
    ]);
    expect(referencePasses(cases, ["--maxWorkers", "2"])).toEqual([
      { target: "react", args: ["--maxWorkers", "2", LISTBOX] },
    ]);
  });

  it("applies the caller's file filters as Vitest does: a spec whose path contains one", () => {
    for (const filter of [LISTBOX, "cases/semantics", "listbox", join(ROOT, LISTBOX)]) {
      expect(referencePasses(cases, [filter]), filter).toEqual([
        { target: "react", args: [LISTBOX] },
      ]);
    }
    expect(referencePasses(cases, ["cases/semantics", "-t", "initial"])).toEqual([
      { target: "react", args: ["-t", "initial", LISTBOX] },
    ]);
    expect(referencePasses(cases, ["cases/models"])).toEqual([]);
  });

  it("leaves out the caller's projects: the pass sets its own", () => {
    expect(referencePasses(cases, ["--project", "browser:vue", "-p=ssr:*", "listbox"])).toEqual([
      { target: "react", args: [LISTBOX] },
    ]);
  });
});

describe("onlyCases", () => {
  it("keeps every case, or those a project renders alone (`ufOnly`)", () => {
    expect(onlyCases(cases, undefined)).toHaveLength(cases.length);
    expect(onlyCases(cases, ["semantics/listbox"]).map(({ id }) => id)).toEqual([
      "semantics/listbox",
    ]);
  });
});
