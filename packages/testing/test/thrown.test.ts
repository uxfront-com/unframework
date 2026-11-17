// The stack mapping of a project's tests (`ufMapStack`, ADR-0086): which served module a frame
// stands for, and where a case throws; and which error L14 reads (ADR-0078).
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  chooseThrown,
  FAILED_ACTION_MESSAGE,
  isFailedAction,
  markFailedAction,
} from "../src/browser/action-failure.ts";
import { servedFile, stackFrames, throwSite } from "../src/node/thrown.ts";

describe("servedFile", () => {
  it("reads a file under the root by its path, and any other by /@fs/", () => {
    expect(servedFile("http://localhost:5173/src/Counter.uf.tsx?t=1", "/project")).toBe(
      "/project/src/Counter.uf.tsx",
    );
    expect(servedFile("http://localhost:5173/@fs/elsewhere/A%20B.uf.tsx", "/project")).toBe(
      "/elsewhere/A B.uf.tsx",
    );
    expect(servedFile("not a url", "/project")).toBeUndefined();
  });
});

describe("throwSite", () => {
  it("finds the one throw among the case's sources, wherever they lie", () => {
    const root = mkdtempSync(join(tmpdir(), "uf-thrown-"));
    const main = join(root, "Total.uf.tsx");
    const child = join(root, "Row.uf.tsx");
    writeFileSync(main, "export default function Total() {\n  throw new Error('no');\n}\n");
    writeFileSync(child, "export default function Row() {\n  return <i />;\n}\n");
    expect(throwSite([main, child, main])).toEqual({ file: main, line: 2 });
    writeFileSync(child, "export default function Row() {\n  throw new Error('no');\n}\n");
    expect(() => throwSite([main, child])).toThrow("hold 2 throw statements");
    expect(() => throwSite([])).toThrow("hold 0 throw statements");
  });
});

describe("stackFrames", () => {
  it("reads each frame, with or without a function name", () => {
    expect(
      stackFrames(
        "Error: no\n    at Total (http://h/src/Total.uf.tsx:2:9)\n    at http://h/a.js:1:2",
      ),
    ).toEqual([
      { url: "http://h/src/Total.uf.tsx", line: 2, column: 9 },
      { url: "http://h/a.js", line: 1, column: 2 },
    ]);
  });
});

/** An error as Playwright's provider rejects an action with, through a Vitest command. */
function timeout(): Error {
  const error = new Error("locator.click: Timeout 5000ms exceeded.");
  error.name = "TimeoutError";
  return error;
}

describe("chooseThrown", () => {
  it("takes the component's throw that the page raised", () => {
    const thrown = new Error("Charge failed");
    expect(chooseThrown({ thrown })).toEqual({ kind: "thrown", error: thrown });
    const logged = new Error("logged");
    expect(chooseThrown({ logged })).toEqual({ kind: "thrown", error: logged });
    expect(chooseThrown({ thrown, logged })).toEqual({ kind: "thrown", error: thrown });
  });

  it("takes React's rethrow through the action as the throw, since it is unmarked", () => {
    const rethrown = new Error("Charge failed");
    expect(isFailedAction(rethrown)).toBe(false);
    expect(chooseThrown({ thrown: rethrown })).toEqual({ kind: "thrown", error: rethrown });
  });

  it("names an action that failed, without its stack, when nothing threw", () => {
    const failed = timeout();
    expect(markFailedAction(failed)).toBe(failed);
    expect(isFailedAction(failed)).toBe(true);
    expect(chooseThrown({ failedAction: failed })).toEqual({
      kind: "failed-action",
      error: failed,
      message: `${FAILED_ACTION_MESSAGE} locator.click: Timeout 5000ms exceeded.`,
    });
    expect(FAILED_ACTION_MESSAGE).toBe("The step's action failed, so the component never threw:");
  });

  it("keeps a throw the page saw over an action that failed after it", () => {
    const thrown = new Error("Charge failed");
    const failed = timeout();
    markFailedAction(failed);
    expect(chooseThrown({ thrown, failedAction: failed })).toEqual({
      kind: "thrown",
      error: thrown,
    });
  });

  it("finds nothing when the step neither threw nor failed", () => {
    expect(chooseThrown({})).toEqual({ kind: "none" });
  });

  it("marks only errors, once, and leaves their name and message", () => {
    expect(markFailedAction("text")).toBe("text");
    expect(isFailedAction("text")).toBe(false);
    const error = timeout();
    const keys = Object.keys(error);
    expect(markFailedAction(markFailedAction(error))).toBe(error);
    expect(error.name).toBe("TimeoutError");
    expect(error.message).toBe("locator.click: Timeout 5000ms exceeded.");
    // Vitest serialises an error's enumerable keys into its report: the mark adds none.
    expect(Object.keys(error)).toEqual(keys);
  });
});
