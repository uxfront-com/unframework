// The host port (`src/browser/host.ts`): the spec runtime reaches its runner only through it, so
// a project that installs no host fails with what to do, and the runtime's own modules name no
// Vitest module, which the Vitest host alone imports.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { boundElementTimeout } from "../src/browser/element-timeout.ts";
import { host, installHost } from "../src/browser/host.ts";
import type { Host, Locator } from "../src/browser/host.ts";
import { createUser } from "../src/browser/user.ts";

const src = fileURLToPath(new URL("../src", import.meta.url));

/** Every import or export specifier that names a Vitest module, in a file. */
function vitestSpecifiers(file: string): string[] {
  return [...readFileSync(file, "utf8").matchAll(/["'](vitest(?:\/[^"']*)?)["']/g)].map(
    (match) => match[1]!,
  );
}

describe("the host port", () => {
  it("refuses to run with no host, naming the setup file that installs one", () => {
    expect(() => host()).toThrow("@unframework/testing/hosts/vitest");
  });

  it("hands out the host a project installed", () => {
    const installed = {} as Host;
    installHost(installed);
    expect(host()).toBe(installed);
  });

  it("bounds expect.element by the poll timeout, unless the call names its own", () => {
    const calls: unknown[] = [];
    const expectStub = {
      element: (_subject: unknown, options: unknown) => void calls.push(options),
    };
    installHost({ expect: expectStub, pollTimeout: () => 5_000 } as unknown as Host);
    boundElementTimeout();
    expectStub.element(null, undefined);
    expectStub.element(null, { timeout: 100 });
    expect(calls).toEqual([{ timeout: 5_000 }, { timeout: 100 }]);
  });

  it("refuses a project with no poll timeout to bound expect.element by", () => {
    installHost({ expect: {}, pollTimeout: () => undefined } as unknown as Host);
    expect(() => boundElementTimeout()).toThrow("expect.poll.timeout");
  });

  it("runs a person's one-input actions through the host's userEvent", async () => {
    const calls: unknown[][] = [];
    const record =
      (name: string) =>
      (...args: unknown[]) => {
        calls.push([name, ...args]);
        return Promise.resolve();
      };
    installHost({
      inject: (key: string) =>
        key === "target" ? "dom" : { interactivity: { support: "native" } },
      commands: { ufFocus: record("focus") },
      userEvent: {
        unhover: record("unhover"),
        fill: record("fill"),
        clear: record("clear"),
        selectOptions: record("selectOptions"),
      },
    } as unknown as Host);
    const target = {
      serialize: () => ({ selector: "", locator: "getByTestId('uf-root-1').getByRole('textbox')" }),
    } as unknown as Locator;
    const user = createUser({
      testId: "uf-root-1",
      perform: async (_action, inputs) => {
        for (const input of inputs) await input();
      },
    });
    await user.unhover(target);
    await user.fill(target, "text");
    await user.clear(target);
    await user.selectOptions(target, "one");
    expect(calls.filter(([name]) => name !== "focus")).toEqual([
      ["unhover", target],
      ["fill", target, "text"],
      ["clear", target],
      ["selectOptions", target, ["one"]],
    ]);
  });

  it("keeps Vitest out of the runtime's own modules", () => {
    const browser = readdirSync(join(src, "browser")).map((file) => join(src, "browser", file));
    const files = [...browser, join(src, "setup.ts"), join(src, "index.ts")];
    expect(
      files.flatMap((file) => vitestSpecifiers(file).map((name) => `${file}: ${name}`)),
    ).toEqual([]);
  });
});
