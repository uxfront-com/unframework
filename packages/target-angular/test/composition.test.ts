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

/** A component that declares the events `class` and `style`, with `root` as its render. */
const emitting = (root: string) => `import { defineEmits } from "unframework";
export default function Card() {
  const emit = defineEmits<{ class: []; style: [] }>();
  return ${root};
}`;

/** What the emitter reports for a source, each with the source text at its span. */
function reportedFor(source: string) {
  const module = lower(source);
  const reported: Parameters<EmitContext["report"]>[0][] = [];
  target.emit(module.components[0]!, {
    module,
    options: undefined,
    report: (diagnostic) => reported.push(diagnostic),
  });
  return reported.map(({ code, message, span }) => ({
    code,
    message,
    at: source.slice(span.start, span.end),
  }));
}

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
      `[selected]="this.choice() === optionText('' + ' ' + ((item.label) ?? '') + ' ')"`,
    );
    expect(output).toContain(
      'return text.replace(/^[\\t\\n\\f\\r ]+|[\\t\\n\\f\\r ]+$/g, "").replace(/[\\t\\n\\f\\r ]+/g, " ");',
    );
  });

  it("keeps the no-break spaces at a text's edges, which the browser keeps", () => {
    const output = emittedOf("Picker");
    expect(output).toContain(`[selected]="this.choice() === '\u00a0\u00a0Child'"`);
    expect(output).toContain(
      `[selected]="this.choice() === optionText('' + '\u00a0' + ((item.label) ?? ''))"`,
    );
  });

  it("reads a nullish interpolation as no text, as Angular renders it", () => {
    expect(emittedOf("Picker")).not.toMatch(/optionText\([^)]*\(item\.label\) \+/);
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
    const reported = reportedFor(`import { defineSlots } from "unframework";
import type { Element } from "unframework";
export default function Card({ titleTemplate }: { titleTemplate: string }) {
  const slots = defineSlots<{ title?(): Element }>();
  return <div>{slots.title?.()}{titleTemplate}</div>;
}`);
    expect(reported.map(({ code, message }) => ({ code, message }))).toEqual([
      {
        code: "UF2003",
        message: "`titleTemplate` names the query of the `title` slot on Angular. Rename the prop.",
      },
    ]);
    expect(reported[0]!.at).toContain("titleTemplate");
  });

  it("reports an event named like a slot's query (UF2003)", () => {
    const reported = reportedFor(`import { defineEmits, defineSlots } from "unframework";
import type { Element } from "unframework";
export default function Card() {
  const slots = defineSlots<{ title?(): Element }>();
  const emit = defineEmits<{ titleTemplate: [] }>();
  return <button type="button" onClick={() => emit("titleTemplate")}>{slots.title?.()}</button>;
}`);
    expect(reported.map(({ code, message }) => ({ code, message }))).toEqual([
      {
        code: "UF2003",
        message:
          "`titleTemplate` names the query of the `title` slot on Angular. Rename the event.",
      },
    ]);
    expect(reported[0]!.at).toContain("titleTemplate");
  });

  it("reports an event named like the class or style input of a root that takes them (UF2003)", () => {
    expect(
      reportedFor(emitting(`<button type="button" onClick={() => emit("class")}>x</button>`)).map(
        ({ message }) => message,
      ),
    ).toEqual([
      "`class` names the input of the consumer's `class` on Angular. Rename the event.",
      "`style` names the input of the consumer's `style` on Angular. Rename the event.",
    ]);
    // A component that takes neither declares neither input.
    expect(reportedFor(emitting(`<><b>x</b><i>y</i></>`))).toEqual([]);
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
