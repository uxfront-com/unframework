// Composition's forms the corpus does not reach (src/models.ts, src/composition.ts, src/plan.ts),
// each as the emitter writes it.
import type { EmitContext } from "@unframework/codegen";
import type { ModuleApi, UfModule } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import { analyze } from "../../analyzer/src/index.ts";
import { parseModule } from "../../parser/src/index.ts";
import target from "../src/index.ts";
import { COMPOSED_SOURCES, COMPOSITION_SOURCES } from "./composition-sources.ts";
import { emitModule, emitted, lower } from "./helpers.ts";

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

/** Each file a module of several components emits, by its path. */
const composedOf = (name: string) =>
  new Map(emitModule(lower(COMPOSED_SOURCES[name]!)).map(({ path, contents }) => [path, contents]));

/** What the emitter reports for each component of a source, with the source text at its span. */
function reportedFor(source: string) {
  const module = lower(source);
  const reported: Parameters<EmitContext["report"]>[0][] = [];
  for (const component of module.components) {
    target.emit(component, {
      module,
      options: undefined,
      report: (diagnostic) => reported.push(diagnostic),
    });
  }
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

/** A component with `props`, the events `events` and the setup `setup`, emitting the first event. */
const declaring = (props: string, events: string, setup = "") =>
  `import { defineEmits${setup.includes("defineExpose") ? ", defineExpose" : ""} } from "unframework";
export default function Card(${props}) {
const emit = defineEmits<{ ${events} }>();
${setup}
return <button type="button" onClick={() => emit("${events.slice(0, events.indexOf(":"))}")}>x</button>;
}`;

/** A `Card` with a scoped `title` slot, beside `declaration`, its setup ending with `setup`. */
const card = (
  declaration: string,
  setup: string,
) => `import { defineSlots${setup ? ", provide" : ""} } from "unframework";
import type { Element${setup ? ", InjectionKey" : ""} } from "unframework";
${declaration}
export default function Card({ level }: { level: CardTitle${setup ? " | undefined" : ""} }) {
  const slots = defineSlots<{ title?(props: { text: string }): Element }>();
${setup}
  return <h2 data-level={level}>{slots.title?.({ text: "x" })}</h2>;
}`;

describe("the component's API", () => {
  it("names a model's input and output after the model, whatever its binding's name", () => {
    const files = composedOf("Basket");
    expect(files.get("counter.ts")).toContain(
      'readonly count = model<number>(0, { alias: "value" });',
    );
    expect(files.get("panel.ts")).toContain(
      'readonly currentTitleTemplate = model.required<boolean>({ alias: "titleTemplate" });',
    );
    expect(files.get("basket.ts")).toContain('[(value)]="this.items"');
    expect(files.get("basket.ts")).toContain('[(titleTemplate)]="this.open"');
  });

  it("types a model with no default and an alias as `model<T>()` types it", () => {
    expect(composedOf("Order").get("qty.ts")).toContain(
      'readonly amount = model<(number) | undefined>(undefined, { alias: "value" });',
    );
  });

  it("types a model with no type, no default and an alias as `model()` types it", () => {
    expect(composedOf("Score").get("tally.ts")).toContain(
      'readonly total = model<unknown>(undefined, { alias: "count" });',
    );
  });

  it("names a key's owner's import of a child's directive apart from the key", () => {
    const files = composedOf("Shelf");
    expect(files.get("shelf.ts")).toContain(
      'import { Card, CardTitle as CardTitle_1 } from "./card";',
    );
    expect(files.get("shelf.ts")).toContain("export const CardTitle = new InjectionToken<string>(");
  });

  it("names a context type apart from a sibling slot's directive", () => {
    const output = emittedOf("Tabs");
    expect(output).toContain("export class TabsTabContext {");
    expect(output).toContain("export type TabsTabContext_1 = { text: string };");
  });

  it("names a helper apart from an output", () => {
    const output = emittedOf("Chooser");
    expect(output).toContain("readonly selectedValues = output<string[]>();");
    expect(output).toContain("function selectedValues_1(select: HTMLSelectElement): string[] {");
  });

  it("exports a slot's directive under its consumers' name, past an import of that name", () => {
    const files = composedOf("Page");
    expect(files.get("card.ts")).toContain('import { CardTitle } from "./card-title";');
    expect(files.get("card.ts")).toContain("\nclass CardTitle_1 {");
    expect(files.get("card.ts")).toContain("export { CardTitle_1 as CardTitle };");
    expect(files.get("page.ts")).toContain('import { Card, CardTitle } from "./card";');
  });

  it("reports an event whose output another event's takes (UF2003)", () => {
    expect(reportedFor(declaring("", "change: []; ufChange: []"))).toEqual([
      {
        code: "UF2003",
        message:
          "`ufChange` names the output `ufChange` of the event `change` on Angular. Rename the event.",
        at: "ufChange: []",
      },
    ]);
  });

  it("reports an event whose output a prop's member takes (UF2003)", () => {
    expect(
      reportedFor(declaring("{ ufInput }: { ufInput: string }", "input: []")).map(
        ({ message }) => message,
      ),
    ).toEqual([
      "`ufInput`, the output `ufInput` of the event `input`, names the prop `ufInput` on Angular. Rename the event.",
    ]);
  });

  it("reports an exposed function named like an event's output (UF2003)", () => {
    const reported = reportedFor(
      declaring(
        "",
        "save: []",
        `  function save() {\n    emit("save");\n  }\n  defineExpose({ save });`,
      ),
    );
    expect(reported.map(({ message }) => message)).toEqual([
      "`save` names the output of the event `save` on Angular. Rename the function.",
    ]);
    expect(reported[0]!.at).toBe("save");
  });

  it("reports an event named like a lifecycle hook (UF2003)", () => {
    expect(reportedFor(declaring("", "ngOnInit: []")).map(({ message }) => message)).toEqual([
      "`ngOnInit` names the lifecycle hook `ngOnInit` on Angular. Rename the event.",
    ]);
  });

  it("reports a model named like the class input of a root that takes it (UF2003)", () => {
    expect(
      reportedFor(`import { defineModel } from "unframework";
export default function Card() {
  const tone = defineModel<string>("class");
  return <p>{tone.value}</p>;
}`).map(({ message }) => message),
    ).toEqual(["`class` names the input of the consumer's `class` on Angular. Rename the model."]);
  });

  it("reports a slot's directive named like a type or a key the file exports (UF2003)", () => {
    expect(
      reportedFor(card('export type CardTitle = "h1" | "h2";', "")).map(({ message }) => message),
    ).toEqual([
      "`CardTitle` names the directive of `Card`'s `title` slot on Angular, and the type `CardTitle` too. Rename one of them.",
    ]);
    const keyed = reportedFor(
      card(
        'type Level = "h1";\nexport const CardTitle: InjectionKey<string> = Symbol("uf.title");',
        '  provide(CardTitle, "x");',
      ).replace("level: CardTitle | undefined", "level: Level"),
    );
    expect(keyed.map(({ message }) => message)).toEqual([
      "`CardTitle` names the directive of `Card`'s `title` slot on Angular, and the injection key `CardTitle` too. Rename one of them.",
    ]);
    expect(keyed[0]!.at).toContain("title?(props");
  });

  it("names a slot's directive apart from a key it imports", () => {
    const module = lowerWith(
      `import { defineSlots, provide } from "unframework";
import type { Element } from "unframework";
import { CardTitle } from "./Keys.uf.tsx";
export default function Card() {
  const slots = defineSlots<{ title?(): Element }>();
  provide(CardTitle, "x");
  return <h2>{slots.title?.()}</h2>;
}`,
      {
        "./Keys.uf.tsx": `import type { Element, InjectionKey } from "unframework";
export const CardTitle: InjectionKey<string> = Symbol("uf.title");
export default function Keys() {
  return <p>Keys</p>;
}`,
      },
    );
    const [output] = emitModule(module);
    expect(output!.contents).toContain('import { CardTitle } from "./keys";');
    expect(output!.contents).toContain("class CardTitle_1 {");
    expect(output!.contents).toContain("export { CardTitle_1 as CardTitle };");
  });

  it("reports two slots of two children filled through one attribute (UF1104)", () => {
    const reported = reportedFor(`import { defineSlots } from "unframework";
import type { Element } from "unframework";
function CardTitle() {
  const slots = defineSlots<{ bar?(): Element }>();
  return <h2>{slots.bar?.()}</h2>;
}
function Card() {
  const slots = defineSlots<{ titleBar?(): Element; default?(): Element }>();
  return <article>{slots.titleBar?.()}{slots.default?.()}</article>;
}
export default function Page() {
  return (
    <Card>
      {{
        titleBar: () => <b>Bar</b>,
        default: () => <CardTitle>{{ bar: () => <em>Only once</em> }}</CardTitle>,
      }}
    </Card>
  );
}`);
    expect(reported.map(({ code, message }) => ({ code, message }))).toEqual([
      {
        code: "UF1104",
        message:
          "`<CardTitle>`'s `bar` slot is filled through `ufCardTitleBar` on Angular, as `<Card>`'s `titleBar` slot is: Angular would match both. Rename one of the slots.",
      },
    ]);
    expect(reported[0]!.at).toContain("Only once");
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
