import { describe, expect, it } from "vitest";

import { listCases } from "./cases.ts";
import { onlyCases, referencePasses } from "./references.ts";

const cases = listCases();

describe("referencePasses (ADR-0057)", () => {
  it("runs each case's own reference with the caller's arguments as given", () => {
    expect(referencePasses(cases, [])).toEqual([{ target: "react", args: [] }]);
    const argv = [
      "./cases/semantics/listbox",
      "-u",
      "-t",
      "selects no option",
      "--maxWorkers",
      "1",
    ];
    expect(referencePasses(cases, argv)).toEqual([{ target: "react", args: argv }]);
  });

  it("leaves out the caller's projects: the pass sets its own", () => {
    expect(
      referencePasses(cases, [
        "--project",
        "browser:vue",
        "-p=ssr:*",
        "--project=x",
        "-p",
        "y",
        "listbox",
      ]),
    ).toEqual([{ target: "react", args: ["listbox"] }]);
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
