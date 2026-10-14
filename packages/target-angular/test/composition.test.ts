// Composition's forms the corpus does not reach (src/models.ts, src/composition.ts, src/plan.ts),
// each as the emitter writes it.
import type { EmitContext } from "@unframework/codegen";
import type { ModuleApi, UfModule } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import { analyze } from "../../analyzer/src/index.ts";
import { parseModule } from "../../parser/src/index.ts";
import target from "../src/index.ts";
import { COMPOSITION_SOURCES } from "./composition-sources.ts";
import { emitted, lower } from "./helpers.ts";

/** A module lowered with the API of each child module it imports, as the compiler's resolver gives it. */
function lowerWith(source: string, children: Record<string, string>): UfModule {
  const imports = new Map<string, ModuleApi>(
    Object.entries(children).map(([specifier, child]) => {
      const file = specifier.slice(2);
      return [specifier, { ...analyze(parseModule(file, child)).api!, file }];
    }),
  );
  const { module, diagnostics } = analyze(parseModule("Toolbar.uf.tsx", source), { imports });
  if (!module || diagnostics.length) throw new Error(JSON.stringify(diagnostics));
  return module;
}

const emittedOf = (name: string) => emitted(COMPOSITION_SOURCES[name]!);

describe("a select's v-model", () => {
  it("selects each option by its own value, in a list, in a group, bound or from its text", () => {
    const output = emittedOf("Picker");
    expect(output).toContain('[selected]="this.choice() === option"');
    expect(output).toContain('[selected]="this.choice() === two"');
    expect(output).toContain(`[selected]="this.choice() === 'Plain text'"`);
    expect(output).not.toContain("=== ''");
  });

  it("strips and collapses a text with an interpolation as it renders, as the browser does", () => {
    const output = emittedOf("Picker");
    expect(output).toContain(
      `[selected]="this.choice() === optionText('' + ' ' + (item.label) + ' ')"`,
    );
    expect(output).toContain('return text.replace(/[\\t\\n\\f\\r ]+/g, " ").trim();');
  });
});

describe("a native v-model beside a listener of its event", () => {
  it("writes the model first, in the one listener of the event, whatever the order", () => {
    const output = emittedOf("Agree");
    expect(output).toContain('(change)="this.agreed.set(agreedField.checked); onChange()"');
    expect(output).toContain('(input)="this.text.set(textField.value); onInput()"');
    expect(output.match(/\(input\)=/g)).toHaveLength(1);
  });

  it("writes it before a once listener too, which joins the template listener", () => {
    const output = emittedOf("Agree");
    expect(output).toContain(
      `(change)="this.picked.set('a'); void (once(changeOnce, $event) && onChangeOnce())"`,
    );
    expect(output).not.toContain("ufChangeOnce");
    expect(output.match(/\(change\)=/g)).toHaveLength(2);
  });
});

describe("the names composition declares", () => {
  it("renames a binding named like the style input or a slot's query", () => {
    const output = emittedOf("Names");
    expect(output).toContain('protected readonly currentStyle = signal("s");');
    expect(output).toContain('protected readonly currentTitleTemplate = signal("x");');
    expect(output).toContain("readonly style = input<");
    expect(output).toContain("protected readonly titleTemplate = contentChild(");
  });

  it("aliases a slot's template apart from a name its context reads", () => {
    const output = emittedOf("Names");
    expect(output).toContain("@if (this.rowTemplate(); as template2) {");
    expect(output).toContain(
      '[ngTemplateOutletContext]="{ $implicit: { item: template }, item: template }"',
    );
  });

  it("reads a slot's query from the class, past a loop's item of its name", () => {
    const output = emittedOf("Steps");
    expect(output).toContain("@for (titleTemplate of [1, 2]; track titleTemplate) {");
    expect(output).toContain("@if (this.titleTemplate(); as template) {");
    expect(output).toContain("@if (this.titleTemplate()) {");
  });

  it("types a slot without props with an empty context", () => {
    expect(emittedOf("Names")).toContain(
      "export class NamesTitle {\n  static ngTemplateContextGuard(\n    _directive: NamesTitle,\n    _context: unknown,\n  ): _context is Record<never, never> {",
    );
  });

  it("reports a prop named like a slot's query (UF2003)", () => {
    const source = `import { defineSlots } from "unframework";
import type { Element } from "unframework";
export default function Card({ titleTemplate }: { titleTemplate: string }) {
  const slots = defineSlots<{ title?(): Element }>();
  return <div>{slots.title?.()}{titleTemplate}</div>;
}`;
    const module = lower(source);
    const reported: Parameters<EmitContext["report"]>[0][] = [];
    target.emit(module.components[0]!, {
      module,
      options: undefined,
      report: (diagnostic) => reported.push(diagnostic),
    });
    expect(reported.map(({ code, message }) => ({ code, message }))).toEqual([
      {
        code: "UF2003",
        message: "`titleTemplate` names the query of the `title` slot on Angular. Rename the prop.",
      },
    ]);
    expect(source.slice(reported[0]!.span.start, reported[0]!.span.end)).toContain("titleTemplate");
  });
});

/** A child named `Button` that renders `label`. */
const button = (label: string) =>
  `export default function Button() {\n  return <button type="button">${label}</button>;\n}\n`;

describe("two children of one name", () => {
  const source = `import Primary from "./a/Button.uf.tsx";
import Secondary from "./b/Button.uf.tsx";
export default function Toolbar() {
  return (
    <div>
      <Primary />
      <Secondary />
    </div>
  );
}`;

  it("reports the second (UF1104): Angular would match both by one selector", () => {
    const module = lowerWith(source, {
      "./a/Button.uf.tsx": button("A"),
      "./b/Button.uf.tsx": button("B"),
    });
    const reported: Parameters<EmitContext["report"]>[0][] = [];
    target.emit(module.components[0]!, {
      module,
      options: undefined,
      report: (diagnostic) => reported.push(diagnostic),
    });
    expect(reported.map(({ code, message }) => ({ code, message }))).toEqual([
      {
        code: "UF1104",
        message:
          "`Secondary` is written `<uf-button>` on Angular, as another component of its name is: Angular would match both. Rename one of them.",
      },
    ]);
    expect(source.slice(reported[0]!.span.start, reported[0]!.span.end)).toBe("<Secondary />");
  });
});
