// Portability (P4): what a selected target cannot render exactly is declared in its capability
// matrix, and the compiler reports it as a diagnostic for that target, located where the source
// first uses it; the other targets compile the same source clean.
import { CAPABILITY_NAMES, defineTarget } from "@unframework.dev/codegen";
import type { CapabilityCell, CapabilityName, Target } from "@unframework.dev/codegen";
import type { Diagnostic } from "@unframework.dev/diagnostics";
import { createModule } from "@unframework.dev/ir";
import { describe, expect, it } from "vitest";

import { everyKind } from "../../ir/test/fixtures.ts";
import { checkCapabilities } from "../src/capabilities.ts";
import { compile, createFileResolver, requiredCapabilities, TARGET_NAMES } from "../src/index.ts";
import { ownOutputs } from "./outputs.ts";

describe("portability diagnostics", () => {
  it("reports Vue's single-selection list box at its `size`, on Vue alone", async () => {
    const source = [
      "export default function Choice() {",
      "  return (",
      '    <select name="choice" size="2">',
      '      <optgroup label="Letters">',
      '        <option value="a">A</option>',
      "      </optgroup>",
      "    </select>",
      "  );",
      "}",
      "",
    ].join("\n");
    const result = await compile(source, { filename: "Choice.uf.tsx", targets: TARGET_NAMES });
    expect(
      result.diagnostics.map(({ code, severity, target, span }) => [
        code,
        severity,
        target,
        source.slice(span.start, span.end),
      ]),
    ).toEqual([["UF4001", "error", "vue", 'size="2"']]);
    expect(result.diagnostics[0]!.message).toMatch(
      /^The vue target does not support listbox: runtime-dom's `nodeOps.createElement` /,
    );
    for (const target of TARGET_NAMES) expect(ownOutputs(result, target), target).toHaveLength(1);
  });

  it("reports a listener that falls through a component once on Astro, and prints none", async () => {
    // A native listener on a component falls through to its root (ADR-0118), which needs code
    // running in the browser: Astro reports `interactivity` (info) there, and drops it.
    const files: Record<string, string> = {
      "/project/Chip.uf.tsx": [
        "export default function Chip({ label }: { label: string }) {",
        '  return <button type="button">{label}</button>;',
        "}",
        "",
      ].join("\n"),
    };
    const resolve = createFileResolver({
      root: "/project",
      readFile: (path) => Promise.resolve(files[path]),
    });
    const source = [
      'import Chip from "./Chip.uf.tsx";',
      "",
      "export default function Picker() {",
      "  return (",
      "    <section>",
      '      <Chip label="Ada" onClick={() => {}} />',
      "    </section>",
      "  );",
      "}",
      "",
    ].join("\n");
    const result = await compile(source, {
      filename: "Picker.uf.tsx",
      targets: ["astro"],
      resolve,
    });
    expect(
      result.diagnostics.map(({ code, severity, target, span }) => [
        code,
        severity,
        target,
        source.slice(span.start, span.end),
      ]),
    ).toEqual([["UF4001", "info", "astro", "onClick={() => {}}"]]);
    expect(result.diagnostics[0]!.message).toMatch(
      /^The astro target does not support interactivity: /,
    );
    const [output] = result.outputs.astro!;
    expect(output!.contents).toContain('<Chip label="Ada" />');
    expect(output!.contents).not.toMatch(/onClick|=>/);
  });
});

describe("the capability check on code that runs in the browser", () => {
  /** A target supporting every capability, but the cells given. */
  const target = (cells: Partial<Record<CapabilityName, CapabilityCell>>): Target =>
    defineTarget({
      name: "test",
      framework: { package: "none", range: "*" },
      capabilities: Object.fromEntries(
        CAPABILITY_NAMES.map((name) => [name, cells[name] ?? { support: "native" }]),
      ) as Target["capabilities"],
      emit: () => [],
    });
  const inert = (reason: string): CapabilityCell => ({
    support: "unsupported",
    code: "UF4001",
    severity: "info",
    reason,
  });
  /** The IR package's counter: every listener option, `useId`, `nextTick` and effects. */
  const counter = () => createModule("Counter.uf.tsx", [everyKind().components[1]!]);
  const report = (diagnostics: Diagnostic[]) =>
    diagnostics.map(({ code, severity, span, message }) => [
      code,
      severity,
      span.start,
      message.replace(/:.*$/, ""),
    ]);

  it("reports interactivity once on a static target, not each listener option it refines", () => {
    const module = counter();
    const watcher = module.components[0]!.setup[9]!;
    const astro = target({
      interactivity: inert("Astro components render on the server only."),
      "event-capture": inert("Astro components render on the server only."),
      "event-once": inert("Astro components render on the server only."),
      "event-passive": inert("Astro components render on the server only."),
      "event-semantics": inert("Astro components render on the server only."),
      "next-tick": inert("Astro components render on the server only."),
      "use-id": { support: "emulated", helper: "useId" },
    });
    expect(report(checkCapabilities(module, astro))).toEqual([
      ["UF4001", "info", watcher.span.start, "The test target does not support interactivity"],
    ]);
  });

  it("reports a listener option a target cannot meet where it has interactivity", () => {
    const module = counter();
    const once = requiredCapabilities(module).get("event-once")!;
    const diagnostics = checkCapabilities(
      module,
      target({ "event-once": inert("A test without once.") }),
    );
    expect(report(diagnostics)).toEqual([
      ["UF4001", "info", once.start, "The test target does not support event-once"],
    ]);
  });

  it("reports each capability a target written before M2 does not declare, refinements aside", () => {
    const module = counter();
    const m1 = target({});
    const cells = { ...m1.capabilities } as Partial<Record<CapabilityName, CapabilityCell>>;
    for (const name of [
      "interactivity",
      "event-capture",
      "event-once",
      "event-passive",
      "event-semantics",
      "use-id",
      "next-tick",
    ] as const) {
      delete cells[name];
    }
    const old = { ...m1, capabilities: cells as Target["capabilities"] };
    const required = requiredCapabilities(module);
    expect(report(checkCapabilities(module, old))).toEqual([
      [
        "UF4001",
        "error",
        required.get("use-id")!.start,
        "The test target does not declare whether it supports use-id, so the compiler treats it as unsupported.",
      ],
      [
        "UF4001",
        "error",
        required.get("interactivity")!.start,
        "The test target does not declare whether it supports interactivity, so the compiler treats it as unsupported.",
      ],
    ]);
  });
});
