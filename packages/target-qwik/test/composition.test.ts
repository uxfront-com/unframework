// Composition's shapes in Qwik (ADR-0053 to ADR-0055, ./src/composition.ts): what each construct
// emits. The corpus runs them through every layer; these pin the forms.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { formatOutput } from "@unframework/codegen";
import type { EmitContext } from "@unframework/codegen";
import { afterAll, describe, expect, it } from "vitest";

import target from "../src/index.ts";
import { toolchain } from "../src/toolchain/index.ts";
import { emitSource, lower } from "./lower.ts";

const repo = fileURLToPath(new URL("../../..", import.meta.url));
const context = {
  toolchainDir: `${repo}tests/toolchains/qwik`,
  root: `${repo}tests/integration`,
};
// Scratch components live inside this package, so `@qwik.dev/core` resolves from them.
const scratchRoot = fileURLToPath(new URL("../.uf-tmp", import.meta.url));
mkdirSync(scratchRoot, { recursive: true });
const scratch = mkdtempSync(join(scratchRoot, "composition-test-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe("qwik target: components and fallthrough", () => {
  it("merges a consumer's class and style after the root's own", async () => {
    const contents = await emitSource(
      `export default function Tag({ label }: { label: string }) {
  return <span class="tag" style={{ color: "red" }}>{label}</span>;
}`,
      { fallthrough: true },
    );
    expect(contents).toContain(
      "component$<{ label: string } & { class?: ClassList; style?: CSSProperties }>",
    );
    expect(contents).toContain("({ label, class: className, style })");
    expect(contents).toContain(
      `<span class={["tag", className]} style={{ color: "red", ...style }}>`,
    );
  });

  it("writes a child's event as its QRL prop, and a function it names as a QRL", async () => {
    const contents = await emitSource(
      `import { defineEmits, ref } from "unframework";

export default function Form() {
  const cleared = ref("");
  function clear(label: string) {
    cleared.value = label;
  }
  return <section><Field onClear={clear} /><output>{cleared.value}</output></section>;
}

function Field() {
  const emit = defineEmits<{ clear: [label: string] }>();
  return <button type="button" onClick={() => emit("clear", "x")}>Clear</button>;
}`,
    );
    expect(contents).toContain('import { Field } from "./Field";');
    expect(contents).toContain("const clear = $((label: string) => {");
    expect(contents).toContain("<Field onClear$={clear} />");
  });
});

describe("qwik target: slots", () => {
  it("projects the default slot and renders any other as a QRL render prop", async () => {
    const contents = await emitSource(
      `import { defineSlots } from "unframework";
import type { Element } from "unframework";

export default function Card() {
  const slots = defineSlots<{ default?(): Element; title?(): Element; item?(props: { n: number }): Element }>();
  return (
    <div>
      {slots.title?.() ?? "Untitled"}
      {slots.title ? <hr /> : null}
      {slots.item?.({ n: 1 })}
      {slots.default?.() ?? <p>Empty</p>}
    </div>
  );
}`,
    );
    expect(contents).toContain("export interface CardSlots {");
    expect(contents).toContain("title$?: QRL<() => JSXOutput>;");
    expect(contents).toContain("item$?: QRL<(props: { n: number }) => JSXOutput>;");
    expect(contents).toContain('{title$?.() ?? "Untitled"}');
    expect(contents).toContain("{title$ ? <hr /> : null}");
    expect(contents).toContain("{item$?.({ n: 1 })}");
    expect(contents).toContain("<Slot>\n");
  });
});

describe("qwik target: models", () => {
  it("reads a model through a computed of its prop or local signal, and writes it through a setter", async () => {
    const contents = await emitSource(
      `import { defineModel } from "unframework";

export default function Toggle() {
  const open = defineModel<boolean>("open", { default: false });
  return <button type="button" onClick={() => (open.value = !open.value)}>{open.value ? "On" : "Off"}</button>;
}`,
    );
    expect(contents).toContain("export interface ToggleModels {");
    expect(contents).toContain("onOpenChange$?: QRL<(open: boolean) => void>;");
    expect(contents).toContain("({ open: openProp, onOpenChange$ })");
    expect(contents).toContain("const openLocal = useSignal<boolean>(false);");
    expect(contents).toContain(
      "const open = useComputed$(() => (openProp === undefined ? openLocal.value : openProp));",
    );
    expect(contents).toContain("if (openProp === undefined) openLocal.value = next;");
    expect(contents).toContain("await onOpenChange$?.(next);");
    expect(contents).toContain("onClick$={() => setOpen(!open.value)}");
  });

  it("reads a control's model in render, so Qwik sets the property", async () => {
    const contents = await emitSource(
      `import { ref } from "unframework";

export default function Search() {
  const query = ref("");
  const weight = ref(0);
  return <form><input v-model={query.value} /><input v-model_number={weight.value} /></form>;
}`,
    );
    expect(contents).toContain("const currentQuery = query.value;");
    expect(contents).toContain(
      "<input value={currentQuery} onInput$={(_, element) => (query.value = element.value)} />",
    );
    expect(contents).toContain("const weightInput = useSignal<HTMLInputElement>();");
    expect(contents).toContain(
      "value={modelText.shown(weightInput.value, currentWeight, { number: true })}",
    );
    expect(contents).toContain("(weight.value = modelText.read(element, { number: true }))");
  });
});

describe("qwik target: replaced nodes", () => {
  it("puts a conditional a sibling follows in a fragment of its own", async () => {
    const contents = await emitSource(
      `import { ref } from "unframework";

export default function Swap() {
  const on = ref(false);
  return (
    <div>
      {on.value ? <h2>On</h2> : <p>Off</p>}
      <button type="button" onClick={() => (on.value = !on.value)}>Toggle</button>
      {on.value ? <em>Last</em> : null}
    </div>
  );
}`,
    );
    expect(contents).toContain("<>{on.value ? <h2>On</h2> : <p>Off</p>}</>");
    expect(contents).toContain("{on.value ? <em>Last</em> : null}");
    expect(contents).not.toContain("<>{on.value ? <em>Last</em> : null}</>");
  });
});

describe("qwik target: expose and context", () => {
  it("fills the consumer's ref with the exposed QRLs once in the document", async () => {
    const contents = await emitSource(
      `import { defineExpose, ref } from "unframework";

export default function Counter() {
  const count = ref(0);
  function reset() {
    count.value = 0;
  }
  defineExpose({ reset });
  return <output>{count.value}</output>;
}`,
    );
    expect(contents).toContain("ref?: Signal<object | undefined>");
    expect(contents).toContain("const reset = $(() => {");
    // Filled as it renders, so a consumer's `onMounted` finds it; emptied as it goes.
    expect(contents).toContain("useTask$(() => {\n    exposeRef(ref, { reset });");
    expect(contents).toContain("cleanup(() => exposeRef(ref, undefined));");
    expect(contents).toContain("function exposeRef(");
  });

  it("declares a key as a context id, and provides it", async () => {
    const contents = await emitSource(
      `import { provide, ref } from "unframework";
import type { InjectionKey, Ref } from "unframework";

export const CountKey: InjectionKey<Ref<number>> = Symbol("uf.count");

export default function Counter() {
  const count = ref(1);
  provide(CountKey, count);
  return <output>{count.value}</output>;
}`,
    );
    expect(contents).toContain(
      'export const CountKey = createContextId<Signal<number>>("uf.count");',
    );
    expect(contents).toContain("useContextProvider(CountKey, count);");
  });

  it("injects a key from its module's main component, undefined without a fallback", async () => {
    const contents = await emitSource(
      `import { inject, provide } from "unframework";
import type { InjectionKey } from "unframework";

export const LabelKey: InjectionKey<string> = Symbol("uf.label");

function Label() {
  const label = inject(LabelKey);
  return <span>{label ?? "none"}</span>;
}

export default function Labelled() {
  provide(LabelKey, "Name");
  return <Label />;
}`,
    );
    expect(contents).toContain('import { LabelKey } from "./Labelled";');
    // Qwik throws for an `undefined` default, and calls a function one with what is provided.
    expect(contents).toContain("const label = useContext(LabelKey, (provided?) => provided);");
  });
});

describe("qwik target: render callbacks", () => {
  it("declares a `<component is>` that reads a list's item in the list's callback", async () => {
    const contents = await emitSource(
      `export default function Blocks({ items }: { items: { id: string; tag: "h2" | "p"; text: string }[] }) {
  return (
    <div>
      {items.map((item) => (
        <section key={item.id}>
          <component is={item.tag} class="block">{item.text}</component>
        </section>
      ))}
    </div>
  );
}`,
    );
    expect(contents).toContain("({ items }) => {\n    return (");
    expect(contents).toContain("{items.map((item) => {\n          const Tag = item.tag;");
  });

  it("declares a setup function a fill calls in the fill, so the fill renders at once", async () => {
    const contents = await emitSource(
      `import { defineSlots, ref } from "unframework";
import type { Element } from "unframework";

export default function Names() {
  const prefix = ref("Dr ");
  function format(name: string) {
    return prefix.value + name;
  }
  function ok(name: string) {
    return name.length > prefix.value.length;
  }
  return (
    <List>
      {{
        item: ({ item }) => (
          <b class={{ on: ok(item) }} style={{ color: format(item) }}>
            {format(item).toUpperCase()}
            {ok(item) ? <i>long</i> : null}
          </b>
        ),
        group: ({ items }) => (
          <ul>
            {items.map((each) => (
              <li key={each}>{format(each).toUpperCase()}</li>
            ))}
          </ul>
        ),
      }}
    </List>
  );
}

function List() {
  const slots = defineSlots<{
    item?(props: { item: string }): Element;
    group?(props: { items: string[] }): Element;
  }>();
  return (
    <div>
      {slots.item?.({ item: "Ada" })}
      {slots.group?.({ items: ["Ada"] })}
    </div>
  );
}`,
    );
    // A `$` scope captures no plain function (optimizer C02), and a QRL's call is a promise until
    // it loads: each fill declares what it calls, written in place, and nothing is awaited.
    expect(contents).not.toContain("$((name: string)");
    expect(contents).not.toContain("await");
    expect(contents).not.toContain("async");
    expect(contents).toContain(
      "item$={({ item }) => {\n          function ok(name: string) {\n            return name.length > prefix.value.length;\n          }\n          function format(",
    );
    expect(contents).toContain(
      "function format(name: string) {\n            return prefix.value + name;",
    );
    expect(contents).toContain(
      "<b class={{ on: Boolean(ok(item)) }} style={{ color: format(item) }}>",
    );
    expect(contents).toContain("{format(each).toUpperCase()}");
    expect(contents.match(/function format\(/g)).toHaveLength(2);
  });

  it("declares a `<component is>` in a list inside a fill in the list's callback", async () => {
    // A fill's own props cannot name the candidates: the analyser reports UF3044 for them.
    const contents = await emitSource(
      `import { defineSlots } from "unframework";
import type { Element } from "unframework";

export interface Cell {
  id: string;
  tag: "h2" | "p";
}

export default function Page({ cells }: { cells: Cell[] }) {
  return (
    <Row>
      {{ cell: () => <div>{cells.map((cell) => <section key={cell.id}><component is={cell.tag}>Cell</component></section>)}</div> }}
    </Row>
  );
}

function Row() {
  const slots = defineSlots<{ cell?(): Element }>();
  return <div>{slots.cell?.()}</div>;
}`,
    );
    expect(contents).toContain("{cells.map((cell) => {\n");
    expect(contents).toContain("const Tag = cell.tag;");
    expect(contents).not.toMatch(/=> \{\n {4}const Tag/);
  });

  it("selects an option without a value by its text", async () => {
    const contents = await emitSource(
      `import { ref } from "unframework";

export default function Pick() {
  const letter = ref("b");
  return <select v-model={letter.value}><option>a</option><option>b</option></select>;
}`,
    );
    expect(contents).toContain('<option selected={currentLetter === "a"}>a</option>');
    expect(contents).toContain('<option selected={currentLetter === "b"}>b</option>');
  });

  it("selects an option by the text its expressions render, as the DOM reads it", async () => {
    const contents = await emitSource(
      `import { ref } from "unframework";

export default function Pick({ sizes, label }: { sizes: number[]; label: string }) {
  const size = ref("2");
  return (
    <select v-model={size.value}>
      {sizes.map((n) => (
        <option key={n}>{n}</option>
      ))}
      <option> {label}! </option>
    </select>
  );
}`,
    );
    const read = '.replace(/[\\t\\n\\f\\r ]+/g, " ").replace(/^ | $/g, "")';
    expect(contents).toContain(`currentSize === \`\${n ?? ""}\`${read}`);
    expect(contents).toContain(`currentSize === \` \${label ?? ""}! \`${read}`);
  });
});

describe("qwik target: fallthrough to a component root", () => {
  it("passes a consumer's class and style on to the root component", async () => {
    const contents = await emitSource(
      `export default function Primary({ text }: { text: string }) {
  return <Base text={text} class="primary" />;
}

function Base({ text }: { text: string }) {
  return <button type="button" class="base">{text}</button>;
}`,
      { fallthrough: true },
    );
    expect(contents).toContain('<Base text={text} class={["primary", className]} style={style} />');
  });
});

describe("qwik target: fills, listeners and the optimizer", () => {
  const board = `import { defineSlots, ref } from "unframework";
import type { Element } from "unframework";

export default function Board() {
  const chosen = ref("none");
  function choose(name: string) {
    chosen.value = name;
  }
  function label(name: string) {
    return name === chosen.value ? \`[\${name}]\` : name;
  }
  function tagOf(name: string): "b" | "i" {
    return name === chosen.value ? "b" : "i";
  }
  return (
    <Groups>
      {{
        group: ({ items }) => (
          <ul>
            {items.map((name) => (
              <li key={name}>
                <button type="button" onClick={() => choose(name)}>
                  Pick {label(name)}
                </button>
                <button type="button" onClick={() => label(name)}>
                  {name.split("").map((c) => label(c)).join(",")}
                </button>
              </li>
            ))}
            <li>
              <component is={tagOf("Ada")}>Ada</component>
            </li>
          </ul>
        ),
      }}
    </Groups>
  );
}

function Groups() {
  const slots = defineSlots<{ group?(props: { items: string[] }): Element }>();
  return <div>{slots.group?.({ items: ["Ada"] })}</div>;
}`;

  it("names a fill's copy apart from the QRL a listener in the fill calls", async () => {
    const contents = await emitSource(board);
    expect(contents).toContain("const label = $((name: string) => {");
    expect(contents).toContain("function labelInFill(name: string) {");
    expect(contents).toContain("Pick {labelInFill(name)}");
    expect(contents).toContain(".map((c) => labelInFill(c))");
    expect(contents).toContain("onClick$={$(() => label(name))}");
  });

  it("writes a listener in a list in a fill `$(…)`, and the optimizer accepts the fill", async () => {
    const contents = await emitSource(board);
    expect(contents).toContain("onClick$={$(() => choose(name))}");
    expect(contents).toContain('const Tag = tagOf("Ada");');
    expect(contents).not.toMatch(/=> \{\n {4}const Tag/);
    const file = { path: "/virtual/Board.tsx", contents };
    const result = (await toolchain.frameworkCompile([file], context)).get(file.path);
    expect(result).toEqual({ errors: [], warnings: [] });
  });

  const spelled = `import { defineSlots, ref } from "unframework";
import type { Element } from "unframework";

export default function Spelled() {
  const mark = ref("*");
  function format(c: string) {
    return mark.value + c;
  }
  return <Rows>{{ item: ({ item }) => <b>{item.split("").map((c) => format(c)).join(",")}</b> }}</Rows>;
}

function Rows() {
  const slots = defineSlots<{ item?(props: { item: string }): Element }>();
  return <ul><li>{slots.item?.({ item: "Ada" })}</li></ul>;
}`;

  it("declares no QRL for a function only a fill's callback calls", async () => {
    const contents = await emitSource(spelled);
    expect(contents).not.toContain("$((c: string)");
    expect(contents).toContain("function format(c: string) {");
    expect(contents).toContain(".map((c) => format(c))");
  });

  it("emits fills that type-check and lint clean (L4, L5)", async () => {
    const paths = [];
    for (const [index, source] of [board, spelled].entries()) {
      const dir = join(scratch, `fills-${index}`);
      mkdirSync(dir);
      const module = lower(source);
      for (const component of module.components) {
        const emit: EmitContext = { module, options: undefined, report: () => {} };
        for (const file of target.emit(component, emit)) {
          const { file: formatted } = await formatOutput(file);
          const path = join(dir, formatted.path);
          writeFileSync(path, formatted.contents);
          paths.push(path);
        }
      }
    }
    const [types, lint] = await Promise.all([
      toolchain.typecheck(paths, context),
      toolchain.lint(paths, context),
    ]);
    for (const path of paths) {
      expect(types.get(path), path).toEqual([]);
      expect(lint.get(path), path).toEqual([]);
    }
  });
});

describe("qwik target: options read as the DOM reads them", () => {
  it("renders a nullish expression as no text, and keeps a non-ASCII space", async () => {
    const contents = await emitSource(`import { ref } from "unframework";

export default function Pick({ hint, sizes }: { hint?: string; sizes: string[] }) {
  const picked = ref("");
  const many = ref<string[]>([]);
  return (
    <div>
      <select v-model={picked.value}>
        <option>{hint}</option>
        <option>&nbsp;sp&nbsp;</option>
        <option>{hint ? "Yes" : "No"}</option>
      </select>
      <select multiple v-model={many.value}>
        {sizes.map((n) => (
          <option key={n}>{n}</option>
        ))}
      </select>
    </div>
  );
}`);
    const read = '.replace(/[\\t\\n\\f\\r ]+/g, " ").replace(/^ | $/g, "")';
    expect(contents).toContain(`currentPicked === \`\${hint ?? ""}\`${read}`);
    // The DOM strips ASCII whitespace only.
    expect(contents).toContain('currentPicked === "\u00a0sp\u00a0"');
    // A conditional of strings is one expression, in parentheses before `??`.
    expect(contents).toContain(`\`\${(hint ? "Yes" : "No") ?? ""}\`${read}`);
    expect(contents).toMatch(/currentMany\.includes\(\s*`\$\{n \?\? ""\}`/);
  });
});
