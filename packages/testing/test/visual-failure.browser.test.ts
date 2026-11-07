// A failed comparison's images reach the runner through the host, so its reporters can show them;
// a capture that passed, or that failed with no image, records nothing.
import { afterEach, expect, it } from "vitest";

import { installHost } from "../src/browser/host.ts";
import type { Host, HostTest, Locator } from "../src/browser/host.ts";
import { captureVisual } from "../src/browser/visual.ts";
import type { CaptureResult } from "../src/visual-types.ts";

const test = {} as HostTest;
const locator = { serialize: () => ({ selector: "", locator: "" }) } as unknown as Locator;

afterEach(() => {
  document.body.replaceChildren();
});

/** Captures a fresh container with a host whose command answers `result`. */
async function capture(result: Partial<CaptureResult>): Promise<unknown[][]> {
  const recorded: unknown[][] = [];
  installHost({
    commands: { ufVisualCapture: () => Promise.resolve(result) },
    recordVisualFailure: (...args: unknown[]) => {
      recorded.push(args);
      return Promise.resolve();
    },
  } as unknown as Host);
  const container = document.createElement("div");
  document.body.append(container);
  await captureVisual(test, { case: "stub/visual", name: "initial", container, locator });
  return recorded;
}

it("records a failed comparison's message and images on the test", async () => {
  const attachments = [{ name: "diff" as const, path: "/diff.png", width: 1, height: 1 }];
  const result = { pass: false, message: "pixels differ", attachments };
  expect(await capture(result)).toEqual([[test, { message: "pixels differ", attachments }]]);
});

it("records nothing for a capture that passed, or one with no image", async () => {
  expect(await capture({ pass: true, attachments: [] })).toEqual([]);
  expect(await capture({ pass: false, message: "no font", attachments: [] })).toEqual([]);
});
