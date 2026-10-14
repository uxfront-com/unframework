// Composition's forms the corpus does not reach (src/models.ts, src/composition.ts, src/plan.ts),
// each as the emitter writes it.
import type { EmitContext } from "@unframework/codegen";
import type { ModuleApi, UfModule } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import { analyze } from "../../analyzer/src/index.ts";
import { parseModule } from "../../parser/src/index.ts";
import target from "../src/index.ts";
import { emitted } from "./helpers.ts";

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

describe("a select's v-model", () => {
  const source = `import { ref } from "unframework";
export default function Picker() {
  const choice = ref("b");
  const options = ref(["a", "b"]);
  const two = "y";
  return (
    <select v-model={choice.value}>
      {options.value.map((option) => <option key={option} value={option}>{option}</option>)}
      <optgroup label="More">
        <option value={two}>Two</option>
        <option>  Plain   text </option>
      </optgroup>
    </select>
  );
}`;

  it("selects each option by its own value, in a list, in a group, bound or from its text", () => {
    const output = emitted(source);
    expect(output).toContain('[selected]="this.choice() === option"');
    expect(output).toContain('[selected]="this.choice() === two"');
    expect(output).toContain(`[selected]="this.choice() === 'Plain text'"`);
    expect(output).not.toContain("=== ''");
  });
});

describe("a native v-model beside a listener of its event", () => {
  const source = `import { ref } from "unframework";
export default function Agree() {
  const agreed = ref(false);
  const text = ref("");
  const log = ref("");
  return (
    <div>
      <input type="checkbox" onChange={() => (log.value = "c:" + agreed.value)} v-model={agreed.value} />
      <input v-model={text.value} onInput={() => (log.value = "t:" + text.value)} />
      <p>{log.value}</p>
    </div>
  );
}`;

  it("writes the model first, in the one listener of the event, whatever the order", () => {
    const output = emitted(source);
    expect(output).toContain('(change)="this.agreed.set(agreedField.checked); onChange()"');
    expect(output).toContain('(input)="this.text.set(textField.value); onInput()"');
    expect(output.match(/\(change\)=/g)).toHaveLength(1);
    expect(output.match(/\(input\)=/g)).toHaveLength(1);
  });
});

describe("the names composition declares", () => {
  const source = `import { defineSlots, ref } from "unframework";
import type { Element } from "unframework";
export default function Card() {
  const slots = defineSlots<{ title?(): Element; row?(props: { item: string }): Element }>();
  const style = ref("s");
  const titleTemplate = ref("x");
  const items = ref(["a"]);
  return (
    <div>
      <h2>{slots.title?.()}{style.value}{titleTemplate.value}</h2>
      {items.value.map((template) => <p key={template}>{slots.row?.({ item: template })}</p>)}
    </div>
  );
}`;

  it("renames a binding named like the style input or a slot's query", () => {
    const output = emitted(source);
    expect(output).toContain('protected readonly currentStyle = signal("s");');
    expect(output).toContain('protected readonly currentTitleTemplate = signal("x");');
    expect(output).toContain("readonly style = input<");
    expect(output).toContain("protected readonly titleTemplate = contentChild(");
  });

  it("aliases a slot's template apart from a name its context reads", () => {
    const output = emitted(source);
    expect(output).toContain("@if (rowTemplate(); as template2) {");
    expect(output).toContain(
      '[ngTemplateOutletContext]="{ $implicit: { item: template }, item: template }"',
    );
  });

  it("types a slot without props with an empty context", () => {
    expect(emitted(source)).toContain(
      "export class CardTitle {\n  static ngTemplateContextGuard(\n    _directive: CardTitle,\n    _context: unknown,\n  ): _context is Record<never, never> {",
    );
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
