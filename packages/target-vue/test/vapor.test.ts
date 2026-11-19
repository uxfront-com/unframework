// The Vue target's `vapor` option (ADR-0112): its schema, the cells it changes, what it emits,
// and the guards that keep its toolchain from passing on Vue 3.5 or on virtual-DOM output.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { capabilitiesOf } from "@unframework.dev/codegen";
import type { EmitContext } from "@unframework.dev/codegen";
import type { UfModule } from "@unframework.dev/ir";
import { describe, expect, it } from "vitest";

import vue, { vueOptions } from "../src/index.ts";
import { assertVaporComponent } from "../src/toolchain/vapor/guard.ts";
import { toolchain as vapor } from "../src/toolchain/vapor/index.ts";
import { casesDir, lower, packageDir } from "./helpers.ts";

const validate = (value: unknown) => vueOptions["~standard"].validate(value);

/** A component with a script and nothing to export. */
const COUNT = `import { ref } from "@uxfront/unframework";

export default function Count() {
  const count = ref(0);
  return <button type="button" onClick={() => count.value++}>{count.value}</button>;
}
`;

/** The files the target emits for each component of a module, with `options`. */
function emitAll(module: UfModule, options: unknown): string[] {
  const context: EmitContext = { module, options, report: () => {} };
  return module.components.flatMap((component) =>
    vue.emit(component, context).map((file) => file.contents),
  );
}

/** A corpus source, lowered. */
function corpusModule(path: string): UfModule {
  const file = path.slice(path.lastIndexOf("/") + 1);
  return lower(readFileSync(join(casesDir, path), "utf8"), file);
}

describe("the vue target's options", () => {
  it("fills in `vapor: false` by default", () => {
    expect(validate({})).toEqual({ value: { vapor: false } });
    expect(validate({ vapor: true })).toEqual({ value: { vapor: true } });
  });

  it.each([
    [{ vapor: "yes" }, [{ message: "must be `true` or `false`.", path: ["vapor"] }]],
    [{ vapor: 1 }, [{ message: "must be `true` or `false`.", path: ["vapor"] }]],
    [
      { vapour: true },
      [{ message: "is not an option of the vue target, which takes `vapor`.", path: ["vapour"] }],
    ],
    [true, [{ message: "must be an object, such as `{ vapor: true }`." }]],
    [null, [{ message: "must be an object, such as `{ vapor: true }`." }]],
    [[], [{ message: "must be an object, such as `{ vapor: true }`." }]],
  ])("refuses %j", (value, issues) => {
    expect(validate(value)).toEqual({ issues });
  });

  it("reports every problem at once", () => {
    expect(validate({ vapor: 0, extra: 1 })).toEqual({
      issues: [
        { message: "is not an option of the vue target, which takes `vapor`.", path: ["extra"] },
        { message: "must be `true` or `false`.", path: ["vapor"] },
      ],
    });
  });
});

describe("Vapor's capability cells", () => {
  it("emulates `directive` under `vapor`, and changes nothing else", () => {
    const cells = capabilitiesOf(vue, { vapor: true });
    expect(cells.directive).toMatchObject({ support: "emulated", helper: "queueHook" });
    const changed = Object.keys(cells).filter(
      (name) =>
        JSON.stringify(cells[name as keyof typeof cells]) !==
        JSON.stringify(vue.capabilities[name as keyof typeof cells]),
    );
    expect(changed).toEqual(["directive"]);
  });

  it("is Vue's own matrix without `vapor`", () => {
    expect(capabilitiesOf(vue, { vapor: false })).toEqual(vue.capabilities);
    expect(capabilitiesOf(vue, undefined)).toBe(vue.capabilities);
  });
});

describe("Vapor components", () => {
  it("marks a component with a script on its `<script setup>`", () => {
    const [file] = emitAll(lower(COUNT), { vapor: true });
    expect(file).toMatch(/^<script setup vapor lang="ts">\n/);
    expect(file).toContain("\n<template>\n");
  });

  it("marks a template-only component on its `<template>`", () => {
    const [file] = emitAll(corpusModule("basics/hello/Hello.uf.tsx"), { vapor: true });
    expect(file).toMatch(/^<template vapor>\n/);
    expect(file).not.toContain("<script");
  });

  it("gives a component whose plain script declares its keys an empty `<script setup vapor>`", () => {
    const [file] = emitAll(corpusModule("diagnostics/invalid-composable/Theme.uf.tsx"), {
      vapor: true,
    });
    expect(file).toMatch(
      /^<script lang="ts">\n[^]*export const ThemeKey[^]*<\/script>\n\n<script setup vapor lang="ts"><\/script>\n\n<template>\n/,
    );
  });

  it("declares the types it exports in a plain `<script>`, which vue-tsc reads as the module", () => {
    const [file] = emitAll(corpusModule("bindings/class-merge/TextLink.uf.tsx"), { vapor: true });
    expect(file).toMatch(/^<script lang="ts">\n[^]*export interface TextLinkProps[^]*<\/script>/);
    const setup = file!.slice(file!.indexOf("<script setup vapor"));
    expect(setup).not.toMatch(/^export /m);
  });

  it("writes a directive in Vapor's function form, its hooks through the queue", () => {
    const module = corpusModule("directives/updated-value/record.uf.ts");
    const context: EmitContext = { module, options: { vapor: true }, report: () => {} };
    const [file] = vue.emitDirective!(module.directives![0]!, context);
    expect(file!.contents).toContain('import type { VaporDirective } from "vue";');
    expect(file!.contents).toContain('import { watch, watchPostEffect } from "vue";');
    expect(file!.contents).toContain(
      "export const vRecord: VaporDirective<HTMLElement, number> = (element, getValue) => {",
    );
    expect(file!.contents).toContain(
      'queueHook(element, () => hooks.mounted(element, current), "mounted");',
    );
    expect(file!.contents).toContain("function queueHook(");
  });

  it("leaves Vue's own output as it is without `vapor`", () => {
    const module = lower(COUNT);
    expect(emitAll(module, { vapor: false })).toEqual(emitAll(module, undefined));
    expect(emitAll(module, undefined).join("")).not.toContain("vapor");
  });
});

describe("the Vapor toolchain's guards", () => {
  it("is named after the option set it runs", () => {
    expect(vapor.name).toBe("vue-vapor");
    expect(vapor.client).toBe("@unframework.dev/target-vue/toolchain/vapor/client");
  });

  it("refuses a Vue older than 3.6 at L3, whose compiler would ignore `vapor`", async () => {
    // This package's own `vue` is the reference's Vue 3.5.
    await expect(
      vapor.frameworkCompile(
        [{ path: "/x/A.vue", contents: "<template vapor><p></p></template>\n" }],
        {
          toolchainDir: packageDir,
          root: packageDir,
        },
      ),
    ).rejects.toThrow(/loaded vue 3\.5\.\d+, which has no Vapor compiler/);
  });

  it("refuses to mount on a Vue older than 3.6", async () => {
    // This package's own `vue` is 3.5, as a project's would be without Vue 3.6.
    await expect(import("../src/toolchain/vapor/client.ts")).rejects.toThrow(
      /loaded vue 3\.5\.\d+: vue must resolve from the toolchain directory/,
    );
  });

  it("refuses a root component compiled for the virtual DOM", () => {
    expect(() => assertVaporComponent({ setup: () => {} })).toThrow(
      /mounted a component compiled for the virtual DOM/,
    );
    expect(() => assertVaporComponent(null)).toThrow(/virtual DOM/);
    expect(() => assertVaporComponent({ __vapor: true })).not.toThrow();
  });
});
