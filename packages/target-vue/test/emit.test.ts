import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CAPABILITY_NAMES } from "@unframework/codegen";
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
import { vueEventInterface } from "../src/listeners.ts";
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
  // test checks that this still holds), so the compiler reports one, at its `size`. Everything
  // else is native: the source's Composition API, listeners and their options are Vue's own.
  it("declares every capability, native but for single-selection list boxes", () => {
    expect(Object.keys(target.capabilities).toSorted()).toEqual(CAPABILITY_NAMES.toSorted());
    expect(target.capabilities.listbox).toMatchObject({
      support: "unsupported",
      code: "UF4001",
      severity: "error",
    });
    for (const name of CAPABILITY_NAMES.filter((name) => name !== "listbox")) {
      expect(target.capabilities[name], name).toEqual({ support: "native" });
    }
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

  const cases = corpus();

  it("has corpus cases to check", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  // The reference target (D10): its committed goldens are exactly what it emits today.
  // One test per case, so no test's time grows with the corpus (0.2 s alone on a laptop as one).
  it.each(cases)(
    "emits the committed golden outputs of $name",
    async ({ name, module, outputDir }) => {
      for (const file of await emitFormatted(module)) {
        const golden = readFileSync(join(outputDir, file.path), "utf8");
        expect(file.contents, name).toBe(golden);
      }
    },
  );
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

describe("vue script setup", () => {
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

  it("writes `</script` in copied code so that it cannot end the block", () => {
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

describe("vue template", () => {
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

describe("vue setup (M2, ADR-0045 to ADR-0049)", () => {
  // State is replaced whole (ADR-0008, UF2004), so a value not known to be a primitive is a
  // `shallowRef`: the source's own object, never a proxy of it (ADR-0046).
  it.each([
    ["ref(0)", "ref(0)"],
    ['ref<"a" | "b" | undefined>()', 'ref<"a" | "b" | undefined>()'],
    ['ref<Mode>("on")', 'ref<Mode>("on")'],
    ["ref(mode)", "ref(mode)"],
    ["ref<string[]>([])", "shallowRef<string[]>([])"],
    ["ref({ a: 1 })", "shallowRef({ a: 1 })"],
    ["ref(item)", "shallowRef(item)"],
    ["ref<Item | null>(null)", "shallowRef<Item | null>(null)"],
    // A call, by its function's declared return type.
    ["ref(label())", "ref(label())"],
    ["ref(first())", "shallowRef(first())"],
    // Built-ins by what they return, and a `computed` by its getter's value.
    ["ref(Math.round(price * 100))", "ref(Math.round(price * 100))"],
    ["ref(Math.PI)", "ref(Math.PI)"],
    ["ref(Number(title))", "ref(Number(title))"],
    ["ref(String(price))", "ref(String(price))"],
    ["ref(parseInt(title, 10))", "ref(parseInt(title, 10))"],
    ["ref(items.length)", "ref(items.length)"],
    ["ref(title.trim())", "ref(title.trim())"],
    ["ref(title.toUpperCase())", "ref(title.toUpperCase())"],
    ["ref(title.slice(1))", "ref(title.slice(1))"],
    ["ref(price.toFixed(2))", "ref(price.toFixed(2))"],
    ["ref(items.map((each) => each.id).join())", "ref(items.map((each) => each.id).join())"],
    ["ref(items.includes(item))", "ref(items.includes(item))"],
    ["ref(doubled.value)", "ref(doubled.value)"],
    ["ref(tier.value)", "ref(tier.value)"],
    ["ref(firstItem.value)", "shallowRef(firstItem.value)"],
    ["ref(items.slice(1))", "shallowRef(items.slice(1))"],
    ["ref(items.at(0))", "shallowRef(items.at(0))"],
    ['ref(title.split(","))', 'shallowRef(title.split(","))'],
    ["ref(Array.from(items))", "shallowRef(Array.from(items))"],
  ])("declares %s as %s", async (written, declared) => {
    const source = [
      'import { computed, ref } from "unframework";',
      'type Mode = "on" | "off";',
      "interface Item {",
      "  id: string;",
      "}",
      "export default function Probe({",
      "  mode,",
      "  item,",
      "  title,",
      "  price,",
      "  items,",
      "}: { mode: Mode; item: Item; title: string; price: number; items: Item[] }) {",
      "  function label(): string {",
      '    return "a";',
      "  }",
      "  function first(): Item {",
      '    return { id: "a" };',
      "  }",
      "  const doubled = computed(() => price * 2);",
      "  const tier = computed(() => {",
      '    if (price > 10) return "high";',
      '    return "low";',
      "  });",
      "  const firstItem = computed(() => ({ id: title }));",
      `  const value = ${written};`,
      "  return (",
      "    <p>",
      "      {String(value.value)}{label()}{first().id}{mode}{item.id}{title}{price}{items.length}",
      "      {doubled.value}{tier.value}{firstItem.value.id}",
      "    </p>",
      "  );",
      "}",
    ].join("\n");
    expect(await emitSource(source)).toContain(`const value = ${declared};`);
  });

  // Vue calls a watcher back on every run once one of its sources is a shallow ref
  // (`forceTrigger`), changed or not, so such a source is read through a getter, alone or in an
  // array; a `ref` and a `computed` are not shallow, and stay as written.
  it("reads a shallowRef source through a getter, alone or among an array watcher's", async () => {
    const source = [
      'import { computed, ref, watch } from "unframework";',
      "export default function Probe() {",
      "  const picks = ref<string[]>([]);",
      "  const selected = ref<{ id: string } | null>(null);",
      "  const count = ref(0);",
      "  const total = computed(() => picks.value.length);",
      "  watch([picks, count, () => count.value > 1], ([list, n, many]) => {",
      "    console.info(list, n, many);",
      "  });",
      "  watch(picks, (list) => {",
      "    console.info(list);",
      "  });",
      "  watch(selected, (item, previous) => {",
      "    console.info(item, previous);",
      "  }, { immediate: true });",
      "  watch(count, (n) => {",
      "    console.info(n);",
      "  });",
      "  watch(total, (n) => {",
      "    console.info(n);",
      "  });",
      "  return <p>{count.value}</p>;",
      "}",
    ].join("\n");
    const output = await emitSource(source);
    expect(output).toContain("watch([() => picks.value, count, () => count.value > 1], ");
    expect(output).toContain("watch(\n  () => picks.value,\n  (list) => {");
    expect(output).toContain("watch(\n  () => selected.value,\n  (item, previous) => {");
    expect(output).toContain("watch(count, (n) => {");
    expect(output).toContain("watch(total, (n) => {");
  });

  // The script is the source's setup: Vue's Composition API is the source language's, so only
  // the imports, the macros' places and the template's spelling of a ref change.
  it("writes the setup as the source does, with `defineEmits` after the props and refs unwrapped in the template", async () => {
    const source = `
import { computed, defineEmits, ref } from "unframework";

export interface StepperProps {
  label: string;
  step?: number;
}

export default function Stepper({ label, step = 1 }: StepperProps) {
  const count = ref(0);
  const emit = defineEmits<{ change: [value: number] }>();
  const doubled = computed(() => count.value * 2);
  const limits = [0, 10];
  let clicks = 0;

  function increment() {
    clicks += 1;
    count.value += step;
    emit("change", count.value);
  }

  return (
    <div role="group" aria-label={label}>
      <output>{count.value}</output>
      {doubled.value > (limits[1] ?? 0) ? <span>Big</span> : null}
      <button type="button" onClick={() => count.value--}>-</button>
      <button type="button" onClick={increment}>+{step}</button>
    </div>
  );
}`;
    expect(await emitSource(source)).toBe(
      sfc(
        [
          'import { computed, ref } from "vue";',
          "",
          "export interface StepperProps {",
          "  label: string;",
          "  step?: number;",
          "}",
          "",
          "const { label, step = 1 } = defineProps<StepperProps>();",
          "const emit = defineEmits<{ change: [value: number] }>();",
          "",
          "const count = ref(0);",
          "const doubled = computed(() => count.value * 2);",
          "const limits = [0, 10];",
          "let clicks = 0;",
          "",
          "function increment() {",
          "  clicks += 1;",
          "  count.value += step;",
          '  emit("change", count.value);',
          "}",
        ],
        [
          '<div role="group" :aria-label="label">',
          "  <output>{{ count }}</output>",
          '  <span v-if="doubled > (limits[1] ?? 0)">Big</span>',
          '  <button type="button" @click="count--">-</button>',
          '  <button type="button" @click="increment">+{{ step }}</button>',
          "</div>",
        ],
      ),
    );
  });

  it("keys a template ref by its binding's name, prefixes an id, and writes effects with Vue's APIs", async () => {
    const source = `
import { defineEmits, nextTick, onMounted, onUnmounted, ref, useId, useTemplateRef, watch, watchEffect } from "unframework";

export default function Panel({ title }: { title: string }) {
  const emit = defineEmits<{ titled: [title: string, previous?: string]; rendered: [count: number] }>();
  const open = ref(false);
  const list = useTemplateRef<HTMLUListElement>();
  const headingId = useId();

  watch(() => title, (value, previous) => {
    emit("titled", value, previous);
  }, { immediate: true });

  watch(open, () => {
    emit("rendered", list.value?.childElementCount ?? 0);
  }, { flush: "post" });

  watchEffect((onCleanup) => {
    const shown = open.value;
    onCleanup(() => {
      emit("titled", shown ? "open" : "closed");
    });
  });

  onMounted(() => {
    emit("rendered", 0);
  });

  onUnmounted(() => {
    emit("rendered", -1);
  });

  async function toggle() {
    open.value = !open.value;
    await nextTick();
    emit("rendered", list.value?.childElementCount ?? 0);
  }

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId}>{title}</h2>
      <button type="button" aria-expanded={open.value} onClick={toggle}>Toggle</button>
      {open.value && <ul ref={list}><li>One</li></ul>}
    </section>
  );
}`;
    expect(await emitSource(source)).toBe(
      sfc(
        [
          "import {",
          "  nextTick,",
          "  onMounted,",
          "  onUnmounted,",
          "  ref,",
          "  useId,",
          "  useTemplateRef,",
          "  watch,",
          "  watchPostEffect,",
          '} from "vue";',
          "",
          "const { title } = defineProps<{ title: string }>();",
          "const emit = defineEmits<{",
          "  titled: [title: string, previous?: string];",
          "  rendered: [count: number];",
          "}>();",
          "",
          "const open = ref(false);",
          'const list = useTemplateRef<HTMLUListElement>("list");',
          "const headingId = `uf-id-${useId()}`;",
          "",
          "watch(",
          "  () => title,",
          "  (value, previous) => {",
          '    emit("titled", value, previous);',
          "  },",
          "  { immediate: true },",
          ");",
          "",
          "watch(",
          "  open,",
          "  () => {",
          '    emit("rendered", list.value?.childElementCount ?? 0);',
          "  },",
          '  { flush: "post" },',
          ");",
          "",
          "watchPostEffect((onCleanup) => {",
          "  const shown = open.value;",
          "  onCleanup(() => {",
          '    emit("titled", shown ? "open" : "closed");',
          "  });",
          "});",
          "",
          "onMounted(() => {",
          '  emit("rendered", 0);',
          "});",
          "",
          "onUnmounted(() => {",
          '  emit("rendered", -1);',
          "});",
          "",
          "async function toggle() {",
          "  open.value = !open.value;",
          "  await nextTick();",
          '  emit("rendered", list.value?.childElementCount ?? 0);',
          "}",
        ],
        [
          '<section :aria-labelledby="headingId">',
          '  <h2 :id="headingId">{{ title }}</h2>',
          '  <button type="button" :aria-expanded="open" @click="toggle">Toggle</button>',
          '  <ul v-if="open" ref="list">',
          "    <li>One</li>",
          "  </ul>",
          "</section>",
        ],
      ),
    );
  });

  // Vue's modifiers set a listener's options and run a handler's leading `stopPropagation()` or
  // `preventDefault()`; a one-expression handler is an inline statement, or the arrow when it
  // reads its event; anything else moves to a script function named after its event, its event
  // parameter typed as Vue types the event.
  it("writes listeners as Vue does, and moves a handler the template cannot hold to the script", async () => {
    const source = `
import { defineEmits, ref } from "unframework";

export default function Log() {
  const emit = defineEmits<{ reset: [] }>();
  const lines = ref<string[]>([]);
  const note = ref("");
  let resets = 0;

  function record(line: string) {
    lines.value = [...lines.value, line];
  }

  return (
    <div role="presentation" onClickCapture={() => record("capture")}>
      <button type="button" onClickOnce={() => record("once")}>Once</button>
      <button type="button" onClick={(event) => { event.stopPropagation(); record("stopped"); }}>Stop</button>
      <form aria-label="Note" onSubmit={(event) => event.preventDefault()}>
        <input name="note" onInput={(event) => (note.value = (event.currentTarget as HTMLInputElement).value)} />
      </form>
      <button type="button" onClick={() => emit("reset")}>Reset</button>
      <button type="button" onClick={(event) => { resets += 1; record(event.type + resets); }}>Count</button>
      <p>{lines.value.join(", ")}</p>
    </div>
  );
}`;
    expect(await emitSource(source)).toBe(
      sfc(
        [
          'import { ref, shallowRef } from "vue";',
          "",
          "const emit = defineEmits<{ reset: [] }>();",
          "",
          "const lines = shallowRef<string[]>([]);",
          'const note = ref("");',
          "let resets = 0;",
          "",
          "function record(line: string) {",
          "  lines.value = [...lines.value, line];",
          "}",
          "",
          "function onClick(event: PointerEvent) {",
          "  resets += 1;",
          "  record(event.type + resets);",
          "}",
        ],
        [
          '<div role="presentation" @click.capture="record(\'capture\')">',
          '  <button type="button" @click.once="record(\'once\')">Once</button>',
          '  <button type="button" @click.stop="record(\'stopped\')">Stop</button>',
          '  <form aria-label="Note" @submit.prevent>',
          "    <input",
          '      name="note"',
          '      @input="(event) => (note = (event.currentTarget as HTMLInputElement).value)"',
          "    />",
          "  </form>",
          '  <button type="button" @click="emit(\'reset\')">Reset</button>',
          '  <button type="button" @click="onClick">Count</button>',
          '  <p>{{ lines.join(", ") }}</p>',
          "</div>",
        ],
      ),
    );
  });

  it("declares the events without a binding when nothing calls `emit`", async () => {
    const source = `
import { defineEmits } from "unframework";

export default function Silent() {
  const emit = defineEmits<{ ready: [] }>();
  return <p>Silent</p>;
}`;
    expect(await emitSource(source)).toBe(
      sfc(["defineEmits<{ ready: [] }>();"], ["<p>Silent</p>"]),
    );
  });

  it("types a hoisted handler's event as Vue's element types do", () => {
    expect(vueEventInterface("click")).toBe("PointerEvent");
    expect(vueEventInterface("keydown")).toBe("KeyboardEvent");
    // lib.dom has `ErrorEvent`; `@vue/runtime-dom` types `onError` with `Event`.
    expect(vueEventInterface("error")).toBe("Event");
  });

  describe("composition (ADR-0053, ADR-0054)", () => {
    /** Every file a source emits, by path. */
    async function emitAll(source: string): Promise<Record<string, string>> {
      const files = await emitFormatted(lower(source));
      return Object.fromEntries(files.map((file) => [file.path, file.contents]));
    }

    it("imports a component of the same file, binds slots it tests, and exposes last", async () => {
      const files = await emitAll(`
import { defineExpose, defineOptions, defineSlots } from "unframework";
import type { Element } from "unframework";

function Icon({ name }: { name: string }) {
  return <i class="icon">{name}</i>;
}

export default function Card({ title }: { title: string }) {
  const slots = defineSlots<{ default?(): Element; meta?(props: { size: number }): Element }>();
  defineOptions({ inheritAttrs: false });
  function open() {}
  defineExpose({ open });
  return (
    <section>
      <Icon name="star" />
      {slots.meta ? <small>{slots.meta?.({ size: title.length })}</small> : null}
      {slots.default?.() ?? title}
    </section>
  );
}`);
      expect(Object.keys(files)).toEqual(["Icon.vue", "Card.vue"]);
      expect(files["Card.vue"]).toBe(
        [
          '<script setup lang="ts">',
          'import Icon from "./Icon.vue";',
          "",
          "const { title } = defineProps<{ title: string }>();",
          "const slots = defineSlots<{ default?(): unknown; meta?(props: { size: number }): unknown }>();",
          "defineOptions({ inheritAttrs: false });",
          "",
          "function open() {}",
          "",
          "defineExpose({ open });",
          "</script>",
          "",
          "<template>",
          "  <section>",
          '    <Icon name="star" />',
          '    <small v-if="slots.meta">',
          '      <slot name="meta" :size="title.length" />',
          "    </small>",
          "    <slot>{{ title }}</slot>",
          "  </section>",
          "</template>",
          "",
        ].join("\n"),
      );
    });

    it("writes props, events and fills in Vue's spelling, and forwards a slot under its presence", async () => {
      const files = await emitAll(`
import { defineEmits, defineSlots } from "unframework";
import type { Element } from "unframework";

function Field({ itemLabel }: { itemLabel: string }) {
  const slots = defineSlots<{ default?(): Element; hint?(props: { size: number }): Element }>();
  const emit = defineEmits<{ levelChange: [level: number] }>();
  return (
    <div onClick={() => emit("levelChange", 1)} role="presentation">
      {itemLabel}
      {slots.hint?.({ size: 1 })}
      {slots.default?.()}
    </div>
  );
}

export default function Form() {
  const slots = defineSlots<{ default?(): Element }>();
  function change(level: number) {
    console.info(level);
  }
  return (
    <Field itemLabel="Name" onLevelChange={change}>
      {{ hint: ({ size }) => <b>{size}</b>, default: slots.default }}
    </Field>
  );
}`);
      expect(files["Form.vue"]).toContain(
        [
          "<template>",
          '  <Field item-label="Name" @level-change="change">',
          '    <template v-if="slots.default" #default>',
          "      <slot />",
          "    </template>",
          '    <template #hint="{ size }">',
          "      <b>{{ size }}</b>",
          "    </template>",
          "  </Field>",
          "</template>",
        ].join("\n"),
      );
    });

    it("names a component that renders itself, rather than importing its own file", async () => {
      expect(
        await emitSource(
          "export default function Tree({ depth }: { depth: number }) { return <div>{depth > 0 ? <Tree depth={depth - 1} /> : null}</div>; }",
        ),
      ).toBe(
        sfc(
          [
            "const { depth } = defineProps<{ depth: number }>();",
            'defineOptions({ name: "Tree" });',
          ],
          ["<div>", '  <Tree v-if="depth > 0" :depth="depth - 1" />', "</div>"],
        ),
      );
    });

    // The first review's inputs (UXF-313): each rendered wrong without a diagnostic.
    it("writes a scoped default fill, slot props Vue would misread, acronyms and built-in names", async () => {
      const files = await emitAll(`
import { defineEmits, defineSlots } from "unframework";
import type { Element } from "unframework";

function Transition({ imageURL }: { imageURL: string }) {
  const slots = defineSlots<{ default?(props: { name: string; "data-id": string }): Element }>();
  const emit = defineEmits<{ pickedURL: [url: string] }>();
  return (
    <div onClick={() => emit("pickedURL", imageURL)} role="presentation">
      {slots.default?.({ name: imageURL, "data-id": imageURL })}
    </div>
  );
}

export default function Page() {
  function pick(url: string) {
    console.info(url);
  }
  return (
    <Transition imageURL="/a.png" onPickedURL={pick}>
      {{ default: ({ name }) => <b>{name}</b> }}
    </Transition>
  );
}`);
      expect(files["Transition.vue"]).toContain(
        `<slot v-bind="{ name: imageURL, 'data-id': imageURL }" />`,
      );
      expect(files["Page.vue"]).toContain('import TransitionComponent from "./Transition.vue";');
      expect(files["Page.vue"]).toContain(
        [
          '  <TransitionComponent image-u-r-l="/a.png" @picked-u-r-l="pick">',
          '    <template #default="{ name }">',
          "      <b>{{ name }}</b>",
          "    </template>",
          "  </TransitionComponent>",
        ].join("\n"),
      );
    });

    // The second review's inputs (UXF-313).
    it("names a component that renders itself and is named like a built-in under its alias", async () => {
      expect(
        await emitSource(
          "export default function KeepAlive({ depth }: { depth: number }) { return <div>{depth > 0 ? <KeepAlive depth={depth - 1} /> : null}</div>; }",
        ),
      ).toBe(
        sfc(
          [
            "const { depth } = defineProps<{ depth: number }>();",
            'defineOptions({ name: "KeepAliveComponent" });',
          ],
          ["<div>", '  <KeepAliveComponent v-if="depth > 0" :depth="depth - 1" />', "</div>"],
        ),
      );
    });

    it.each([
      ["Transition", "TransitionComponent"],
      ["TransitionComponent", "Transition"],
    ])("keeps a child named %s apart from one named %s", async (first, second) => {
      const files = await emitAll(`
function Transition() { return <i />; }
function TransitionComponent() { return <b />; }
export default function Page() { return <p><${first} /><${second} /></p>; }`);
      expect(files["Page.vue"]).toContain(
        'import TransitionComponent from "./TransitionComponent.vue";',
      );
      expect(files["Page.vue"]).toContain('import TransitionComponent_1 from "./Transition.vue";');
    });
  });
  describe("models, context and <component is> (ADR-0054)", () => {
    async function emitAll(source: string): Promise<Record<string, string>> {
      const files = await emitFormatted(lower(source));
      return Object.fromEntries(files.map((file) => [file.path, file.contents]));
    }

    it("declares a model, defaulting an unbound one to `undefined` as a prop's", async () => {
      expect(
        await emitSource(`import { defineModel } from "unframework";
export default function Toggle() {
  const on = defineModel<boolean>("on");
  const size = defineModel<number>("size", { default: 2 });
  return <button type="button" onClick={() => (on.value = !on.value)}>{size.value}</button>;
}`),
      ).toBe(
        sfc(
          [
            'const on = defineModel<boolean | undefined>("on", { default: undefined });',
            'const size = defineModel<number>("size", { default: 2 });',
          ],
          ['<button type="button" @click="on = !on">{{ size }}</button>'],
        ),
      );
    });

    it("writes a control's v-model with its modifiers, and casts a range input", async () => {
      const output = await emitSource(`import { ref } from "unframework";
export default function Form() {
  const name = ref("");
  const count = ref(0);
  return (
    <form>
      <input v-model_trim={name.value} />
      <input type="number" v-model={count.value} />
      <input type="range" v-model={count.value} />
    </form>
  );
}`);
      expect(output).toContain('<input v-model.trim="name" />');
      expect(output).toContain('<input v-model="count" type="number" />');
      expect(output).toContain('<input v-model.number="count" type="range" />');
    });

    it("binds a component's model by its name", async () => {
      const files = await emitAll(`import { defineModel, ref } from "unframework";
function Field() {
  const value = defineModel<string>("value", { default: "" });
  return <p>{value.value}</p>;
}
export default function Form() {
  const text = ref("a");
  return <Field v-model:value={text.value} />;
}`);
      expect(files["Form.vue"]).toContain('<Field v-model:value="text" />');
    });

    it("declares the module's keys in a plain script block, and unwraps an injected ref", async () => {
      const files = await emitAll(`import { inject, provide, ref } from "unframework";
import type { InjectionKey, Ref } from "unframework";
export const CountKey: InjectionKey<Ref<number>> = Symbol("uf.count");
function Display() {
  const none = ref(0);
  const count = inject(CountKey, none);
  return <output>{count.value}</output>;
}
export default function Counter() {
  const count = ref(1);
  provide(CountKey, count);
  return <Display />;
}`);
      expect(files["Display.vue"]).toContain('import { CountKey } from "./Counter.vue";');
      expect(files["Display.vue"]).toContain("const count = inject(CountKey, none);");
      expect(files["Display.vue"]).toContain("<output>{{ count }}</output>");
      expect(files["Counter.vue"]).toContain(
        [
          '<script lang="ts">',
          'import type { InjectionKey, Ref } from "vue";',
          "",
          'export const CountKey: InjectionKey<Ref<number>> = Symbol("uf.count");',
          "</script>",
        ].join("\n"),
      );
      expect(files["Counter.vue"]).toContain("provide(CountKey, count);");
    });

    it("writes <component :is>, a built-in's name under its alias", async () => {
      const files = await emitAll(`import { ref } from "unframework";
function Transition({ label }: { label: string }) { return <i>{label}</i>; }
function Card({ label }: { label: string }) { return <b>{label}</b>; }
export default function Tag() {
  const fade = ref(true);
  return (
    <p>
      <component is={fade.value ? Transition : Card} label="x" />
      <component is={fade.value ? "h2" : "h3"} class="t">y</component>
    </p>
  );
}`);
      expect(files["Tag.vue"]).toContain(
        '<component :is="fade ? TransitionComponent : Card" label="x" />',
      );
      expect(files["Tag.vue"]).toContain(
        "<component :is=\"fade ? 'h2' : 'h3'\" class=\"t\">y</component>",
      );
    });
  });
});
