// The guard every adapter runs first: only what ngtsc compiled may be mounted or rendered.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// The JIT compiler, loaded as it would be where a module skipped ngtsc.
// oxlint-disable-next-line import/no-unassigned-import -- evaluated for its side effect
import "@angular/compiler";
import { Component } from "@angular/core";
import { afterAll, describe, expect, it } from "vitest";

import { angularComponent } from "../src/toolchain/component.ts";
import { component, ngtscPlugin, removeScratch, scratchDir } from "./helpers.ts";

afterAll(removeScratch);

describe("angularComponent", () => {
  it("accepts a component ngtsc compiled", async () => {
    const directory = scratchDir();
    const { transform } = await ngtscPlugin();
    const { code } = await transform(
      join(directory, "Aot.uf.tsx.ts"),
      component("Aot", "<p>x</p>"),
    );
    writeFileSync(join(directory, "Aot.js"), code);
    const { default: Aot } = (await import(pathToFileURL(join(directory, "Aot.js")).href)) as {
      default: unknown;
    };
    expect(angularComponent(Aot)).toBe(Aot);
  });

  // The JIT compiler would compile and render it, but no user ships that code.
  it("rejects a decorated class the JIT compiler would compile at runtime", () => {
    const Jit = Component({ selector: "uf-jit", template: "<p>jit</p>" })(class Jit {});
    expect(() => angularComponent(Jit)).toThrow(
      "Expected an AOT-compiled Angular component, got Jit, which the JIT compiler would compile at runtime.",
    );
  });

  it("rejects what is not a component, naming it", () => {
    expect(() => angularComponent(() => "<p>x</p>")).toThrow(
      /^Expected an AOT-compiled Angular component, got the function \(anonymous\)\./,
    );
    expect(() => angularComponent(class Plain {})).toThrow("got the function Plain.");
    expect(() => angularComponent(null)).toThrow("got null.");
  });
});
