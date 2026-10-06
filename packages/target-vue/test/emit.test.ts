import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { EmitContext } from "@unframework/codegen";
import {
  createComponent,
  createElement,
  createExport,
  createModule,
  createStaticAttribute,
  createText,
} from "@unframework/ir";
import { describe, expect, it } from "vitest";

import target from "../src/index.ts";
import { corpus, emitFormatted, emitSource, lower } from "./helpers.ts";

const at = { start: 0, end: 0 };

function emit(kind: "default" | "named" = "default") {
  const render = createElement(
    "p",
    [createStaticAttribute("class", "greeting", at)],
    [createText("Hello, world!", at)],
    at,
  );
  const component = createComponent("Hello", render, at);
  const module = createModule("Hello.uf.tsx", [component], [createExport(kind, "Hello", at)]);
  const reported: unknown[] = [];
  const context: EmitContext = {
    module,
    options: undefined,
    report: (diagnostic) => void reported.push(diagnostic),
  };
  return { files: target.emit(component, context), reported };
}

describe("vue target", () => {
  // Its client selects the first option of a single-selection list box (the client parity
  // test checks that this still holds), so the compiler reports one, at its `size`.
  it("declares every capability, with single-selection list boxes unsupported", () => {
    expect(Object.keys(target.capabilities).toSorted()).toEqual([
      "attribute-spread",
      "bound-attribute",
      "class-binding",
      "conditional",
      "element",
      "fragment",
      "interactivity",
      "interpolation",
      "list",
      "listbox",
      "props",
      "static-attribute",
      "style-binding",
      "svg",
      "text",
    ]);
    expect(target.capabilities.listbox).toMatchObject({
      support: "unsupported",
      code: "UF4001",
      severity: "error",
    });
  });

  it("emits a static component as a template-only single-file component", () => {
    const { files, reported } = emit();
    expect(reported).toEqual([]);
    expect(files).toEqual([
      {
        path: "Hello.vue",
        contents: '<template>\n  <p class="greeting">Hello, world!</p>\n</template>\n',
      },
    ]);
  });

  it("emits the same file for a named export", () => {
    expect(emit("named").files).toEqual(emit("default").files);
  });

  // The reference target (D10): its committed goldens are exactly what it emits today.
  it("emits the corpus's committed golden outputs", async () => {
    const cases = corpus();
    expect(cases.length).toBeGreaterThan(0);
    for (const { name, module, outputDir } of cases) {
      for (const file of await emitFormatted(module)) {
        const golden = readFileSync(join(outputDir, file.path), "utf8");
        expect(file.contents, name).toBe(golden);
      }
    }
  });
});

/** A component's file, with `script` and `template` in the shape this target prints them. */
const sfc = (script: string[], template: string[]) =>
  [
    ...(script.length ? ['<script setup lang="ts">', ...script, "</script>", ""] : []),
    "<template>",
    ...template.map((line) => `  ${line}`),
    "</template>",
    "",
  ].join("\n");

describe("vue script setup (design §5.2)", () => {
  it("destructures the props, with a default for every optional one", async () => {
    const source = `
export interface BadgeProps {
  label: string;
  tone?: "info" | "warn";
  count?: number;
  pill?: boolean;
}

export default function Badge({ label, tone = "info", count, pill = false }: BadgeProps) {
  return <span title={label}>{tone}{count}{pill ? "!" : ""}</span>;
}`;
    expect(await emitSource(source)).toBe(
      sfc(
        [
          "export interface BadgeProps {",
          "  label: string;",
          '  tone?: "info" | "warn";',
          "  count?: number;",
          "  pill?: boolean;",
          "}",
          "",
          'const { label, tone = "info", count = undefined, pill = false } = defineProps<BadgeProps>();',
        ],
        ['<span :title="label">{{ tone }}{{ count }}{{ pill ? "!" : "" }}</span>'],
      ),
    );
  });

  // `vue/require-default-prop` asks for a default for each optional prop once props are
  // destructured, and the unused-variable rule ignores a local starting with `_`; a required
  // prop nothing reads is left out.
  it("keeps every optional prop in the pattern, an unread one under a `_` local, and leaves out unread required ones", async () => {
    const source = `
export default function Note({ text, hint, size = 2, flag }: { text: string; hint: string; size?: number; flag?: boolean; tone?: string }) {
  return <p>{text}</p>;
}`;
    expect(await emitSource(source, false)).toContain(
      "const { text, size: _size = 2, flag: _flag = undefined, tone: _tone = undefined } = defineProps<{ text: string; hint: string; size?: number; flag?: boolean; tone?: string }>();",
    );
  });

  it("claims an unread prop's local around the source's names", async () => {
    const source = `
type _size = number;
export default function Note({ text, size }: { text: string; size?: _size; Map?: string }) {
  return <p>{text}</p>;
}`;
    expect(await emitSource(source, false)).toContain(
      "const { text, size: _size_1 = undefined, Map: _Map = undefined } = defineProps<{ text: string; size?: _size; Map?: string }>();",
    );
  });

  it("declares props it never reads with the macro alone", async () => {
    const source = `
export default function Still({}: { text: string; size?: number }) {
  return <p>Still</p>;
}`;
    expect(await emitSource(source)).toBe(
      sfc(["defineProps<{ text: string; size?: number }>();"], ["<p>Still</p>"]),
    );
  });

  it("copies the type declarations the props reach, in source order, exported as written", async () => {
    const source = `
type Tone = "info" | "warn";
interface Item {
  id: string;
}
export interface ListProps {
  items: Item[];
  tone: Tone;
}
export default function List({ items, tone }: ListProps) {
  return <ul class={tone}>{items.map((item) => <li key={item.id}>{item.id}</li>)}</ul>;
}`;
    const output = await emitSource(source);
    expect(output.slice(0, output.indexOf("const"))).toBe(
      [
        '<script setup lang="ts">',
        'type Tone = "info" | "warn";',
        "",
        "interface Item {",
        "  id: string;",
        "}",
        "",
        "export interface ListProps {",
        "  items: Item[];",
        "  tone: Tone;",
        "}",
        "",
        "",
      ].join("\n"),
    );
  });

  it("declares the object form through withDefaults when a prop is optional", async () => {
    const source = `
export default function Byline(props: { author: string; affiliation?: string }) {
  return <p>{props.author}, {props.affiliation ?? "independent"}</p>;
}`;
    expect(await emitSource(source)).toBe(
      sfc(
        [
          "const props = withDefaults(defineProps<{ author: string; affiliation?: string }>(), {",
          "  affiliation: undefined,",
          "});",
        ],
        ['<p>{{ props.author }}, {{ props.affiliation ?? "independent" }}</p>'],
      ),
    );
  });

  it("declares the object form with the macro alone when no prop is optional, or none is read", async () => {
    const required = `
export default function Byline(p: { author: string }) {
  return <p>{p.author}</p>;
}`;
    expect(await emitSource(required)).toBe(
      sfc(["const p = defineProps<{ author: string }>();"], ["<p>{{ p.author }}</p>"]),
    );
    const unread = `
export default function Byline(props: { author?: string }) {
  return <p>Anonymous</p>;
}`;
    expect(await emitSource(unread)).toBe(
      sfc(["defineProps<{ author?: string }>();"], ["<p>Anonymous</p>"]),
    );
  });

  // A destructured prop named after a global Vue's template compiler never prefixes reads the
  // global in any expression but a lone identifier (render.test.ts shows it), and one named
  // after a compiler macro is TS2451 under vue-tsc: each is declared under a fresh local.
  it("declares a prop named after a template global or a macro under a local of its own", async () => {
    const source = `
export default function Legend({ Map, items }: { Map: string; items: string[] }) {
  return <ul>{items.map((item) => <li key={item}>{Map + item}{[Map].join()}</li>)}</ul>;
}`;
    expect(await emitSource(source)).toBe(
      sfc(
        ["const { Map: Map_1, items } = defineProps<{ Map: string; items: string[] }>();"],
        [
          "<ul>",
          '  <li v-for="item in items" :key="item">{{ Map_1 + item }}{{ [Map_1].join() }}</li>',
          "</ul>",
        ],
      ),
    );
    const object = `
export default function Legend(withDefaults: { title?: string }) {
  return <p title={withDefaults.title}>{withDefaults.title}</p>;
}`;
    expect(await emitSource(object)).toBe(
      sfc(
        [
          "const withDefaults_1 = withDefaults(defineProps<{ title?: string }>(), { title: undefined });",
        ],
        ['<p :title="withDefaults_1.title">{{ withDefaults_1.title }}</p>'],
      ),
    );
  });

  it("declares an object named with Vue's own prefixes as `props`", async () => {
    const source = `
export default function Byline(__props: { author: string }) {
  return <p title={__props.author}>{__props.author}</p>;
}`;
    expect(await emitSource(source)).toBe(
      sfc(
        ["const props = defineProps<{ author: string }>();"],
        ['<p :title="props.author">{{ props.author }}</p>'],
      ),
    );
  });

  it("expands a shorthand property whose prop it renames", async () => {
    const source = `
export default function Probe({ Set, label }: { Set: string; label: string }) {
  return <p title={JSON.stringify({ Set, label })}>{label}</p>;
}`;
    expect(await emitSource(source)).toContain(
      `<p :title="JSON.stringify({ Set: Set_1, label })">{{ label }}</p>`,
    );
  });

  it("writes `</script` in copied code so that it cannot end the block (design §4.4)", () => {
    // The analyser rejects such a default; the target escapes it anyway, as Vue's parser ends
    // the block at the first `</script` wherever it sits.
    const module = lower(`
export default function Quote({ text = "x" }: { text?: string }) {
  return <q>{text}</q>;
}`);
    const [component] = module.components;
    const [prop] = component!.props;
    const changed = {
      ...component!,
      props: [{ ...prop!, default: { ...prop!.default!, code: '"</script><SCRIPT>"' } }],
    };
    const [file] = target.emit(changed, { module, options: undefined, report: () => {} });
    expect(file!.contents).toContain('const { text = "<\\/script><SCRIPT>" } = defineProps');
    expect(file!.contents.match(/<\/script/gi)).toHaveLength(1);
  });

  it("prints a script that formats without changing its meaning", async () => {
    const source = `
export interface CardProps {
  title: string;
  tags?: readonly string[];
  meta?: { author: string; year: number };
}
export default function Card({ title, tags = ["a", "b"], meta = { author: "x", year: 2024 } }: CardProps) {
  return <h2 title={meta.author}>{title}{tags.join()}</h2>;
}`;
    const printed = await emitSource(source, false);
    expect(printed).toContain(
      'const { title, tags = ["a", "b"], meta = { author: "x", year: 2024 } } = defineProps<CardProps>();',
    );
    expect(await emitSource(source)).toContain(
      'const { title, tags = ["a", "b"], meta = { author: "x", year: 2024 } } = defineProps<CardProps>();',
    );
  });
});

describe("vue template (design §5.2)", () => {
  it("prints conditionals on their element, or on a template around other content", async () => {
    const source = `
export default function Status({ state, note }: { state: string; note?: string }) {
  return (
    <div>
      {state === "done" ? <p>Done</p> : state === "busy" ? <>Busy <b>now</b></> : <p>{note}</p>}
      {note && <i>{note}</i>}
    </div>
  );
}`;
    expect(await emitSource(source)).toContain(
      [
        "<div>",
        "    <p v-if=\"state === 'done'\">Done</p>",
        "    <template v-else-if=\"state === 'busy'\">Busy <b>now</b></template>",
        "    <p v-else>{{ note }}</p>",
        '    <i v-if="note">{{ note }}</i>',
        "  </div>",
      ].join("\n"),
    );
  });

  it("prints a keyed list, with its index only when an expression reads it", async () => {
    const source = `
export default function Steps({ steps }: { steps: { id: string; label: string }[] }) {
  return (
    <div>
      <ol>{steps.map((step, index) => <li key={step.id}>{index + 1}. {step.label}</li>)}</ol>
      <ul>{steps.map((step, index) => <li key={step.id}>{step.label}</li>)}</ul>
    </div>
  );
}`;
    const output = await emitSource(source);
    expect(output).toContain(
      '<li v-for="(step, index) in steps" :key="step.id">{{ index + 1 }}. {{ step.label }}</li>',
    );
    expect(output).toContain('<li v-for="step in steps" :key="step.id">{{ step.label }}</li>');
  });

  it("prints class and style beside their bindings, and a spread one binding per key", async () => {
    const source = `
interface Attrs {
  id?: string;
  title?: string;
  class?: string;
}
export default function Tile({ tone, gap, big, attrs }: { tone: string; gap?: string; big: boolean; attrs?: Attrs }) {
  return (
    <p {...attrs} class={["tile", tone, { big }]} style={{ color: "red", marginTop: gap, "--gap": gap }}>
      Tile
    </p>
  );
}`;
    expect(await emitSource(source)).toContain(
      [
        "<p",
        '    :id="attrs?.id"',
        '    :title="attrs?.title"',
        '    class="tile"',
        '    :class="[attrs?.class, tone, { big }]"',
        '    style="color: red"',
        "    :style=\"{ marginTop: gap, '--gap': gap }\"",
        "  >Tile</p>",
      ].join("\n"),
    );
  });

  // Vue's compiler parses a static `style` again with `parseStringStyle`, which splits at a `;`
  // inside a string, does not split before a value whose first parenthesis is `)`, and drops
  // comments: such a declaration is bound, and a bound object's values are taken whole.
  it("binds the static declarations Vue's style parser would misread", async () => {
    const source = `
export default function Quote({ tone }: { tone: string }) {
  return (
    <p style='font-family: "A;B", serif; margin: 0; content: ")" "("; padding: 1px/**/2px'>
      <b style={{ quotes: '";" ";"', color: tone }}>Quote</b>
    </p>
  );
}`;
    const output = await emitSource(source);
    expect(output).toContain(
      [
        "<p",
        '    style="margin: 0"',
        `    :style="{ fontFamily: '&quot;A;B&quot;, serif', content: '&quot;)&quot; &quot;(&quot;', padding: '1px/**/2px' }"`,
        "  >",
      ].join("\n"),
    );
    expect(output).toContain(`<b :style="{ quotes: '&quot;;&quot; &quot;;&quot;', color: tone }">`);
  });
});
