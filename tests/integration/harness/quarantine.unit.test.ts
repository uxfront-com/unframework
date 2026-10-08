import { settleOutcome } from "@unframework/testing/node";
import type { QuarantineEntry } from "@unframework/testing/node";
import { describe, expect, it } from "vitest";

import { listCases } from "./cases.ts";
import { QUARANTINE, validateQuarantine } from "./quarantine.ts";
import { selectTargets } from "./targets.ts";

// A corpus of its own: the rules do not depend on which cases exist.
const known = { cases: ["basics/hello"], targets: ["react", "vue"] };
const entry: QuarantineEntry = {
  case: "basics/hello",
  target: "react",
  layer: "L7",
  reason: "React adds a wrapper element",
  issue: "https://github.com/uxfront-com/unframework/issues/1",
};

describe("the quarantine", () => {
  it("is valid against the corpus and the targets", () => {
    const corpus = { cases: listCases().map((info) => info.id), targets: selectTargets(undefined) };
    expect(validateQuarantine(QUARANTINE, corpus)).toEqual([]);
  });

  it("accepts an entry for a live layer of a known case and target", () => {
    expect(validateQuarantine([entry], known)).toEqual([]);
  });

  it("rejects entries that could never fail, or never be followed up", () => {
    expect(
      validateQuarantine(
        [
          { ...entry, case: "basics/missing" },
          { ...entry, target: "lit" },
          { ...entry, layer: "L12" },
          { ...entry, layer: "L99" as never },
          { ...entry, reason: " ", issue: "" },
          entry,
        ],
        known,
      ),
    ).toEqual([
      'basics/missing › react › L7: no case "basics/missing".',
      'basics/hello › lit › L7: no target "lit".',
      "basics/hello › react › L12: L12 is not live, so it cannot fail.",
      'basics/hello › react › L99: no layer "L99".',
      "basics/hello › react › L7: needs a reason.",
      "basics/hello › react › L7: needs an issue.",
      "basics/hello › react › L7: listed twice.",
    ]);
  });

  it("keeps a quarantined failure from failing, and fails once it passes (the stale-entry rule)", () => {
    expect(settleOutcome({ status: "fail", message: "dom differs" }, entry)).toEqual({
      status: "quarantined",
      issue: entry.issue,
    });
    expect(settleOutcome({ status: "pass" }, entry)).toMatchObject({
      status: "fail",
      message: expect.stringMatching(/^stale quarantine entry: remove it\./),
    });
  });
});
