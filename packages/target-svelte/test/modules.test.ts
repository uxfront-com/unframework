// What a component reads of its module and of a composable on Svelte (ADR-0069, ADR-0070): a
// composable is its own `.svelte.ts` module returning an object of getters; a caller keeps that
// object and reads each destructured name through it; a value from a `.ts` module is imported as
// the source does, and a constant of the module is declared, with those it reads, at the top of
// the instance script, or in `<script module>` where the output exports a type, under a name of its
// own where the setup shadows it.
import { afterAll, describe, expect, it } from "vitest";

import { toolchain } from "../src/toolchain/index.ts";
import { compileSources, removeScratch, toolchainDir, writeScratch } from "./helpers.ts";

afterAll(removeScratch);

/** svelte-check's messages on a tree of outputs, by file name, empty when it checks clean. */
async function typecheck(outputs: Record<string, string>): Promise<Record<string, string[]>> {
  const paths = writeScratch(outputs);
  const checked = await toolchain.typecheck(Object.values(paths), {
    toolchainDir,
    root: toolchainDir,
  });
  return Object.fromEntries(
    Object.entries(paths).map(([name, path]) => [
      name,
      (checked.get(path) ?? []).map(({ code, message }) => `${code} ${message}`),
    ]),
  );
}

/** Every file of a tree checks clean. */
function clean(outputs: Record<string, string>): Record<string, string[]> {
  return Object.fromEntries(Object.keys(outputs).map((name) => [name, []]));
}

/** svelte-check takes a few seconds; give it room on a loaded machine. */
const checker = { timeout: 60_000 };

const TOGGLE = [
  'import { ref } from "unframework";',
  "",
  'const LABEL = "Toggle";',
  "",
  "export function useToggle(initial: boolean) {",
  "  const on = ref(initial);",
  "  const label = LABEL;",
  "  function toggle() {",
  "    on.value = !on.value;",
  "  }",
  "  return { on, label, toggle };",
  "}",
  "",
].join("\n");

/** A child with two slots, which a parent fills with snippets named after them. */
const FRAME = [
  'import { defineSlots } from "unframework";',
  'import type { Element } from "unframework";',
  "",
  "export default function Frame() {",
  "  const slots = defineSlots<{ toggle?(): Element; label?(props: { n: number }): Element }>();",
  "  return (",
  "    <div>",
  "      {slots.toggle?.()}",
  "      {slots.label?.({ n: 1 })}",
  "    </div>",
  "  );",
  "}",
  "",
].join("\n");

describe("svelte composables", () => {
  it("emits a composable as a `.svelte.ts` module returning getters, with its module's constants", async () => {
    const outputs = await compileSources({ "useToggle.uf.ts": TOGGLE });
    expect(outputs["useToggle.svelte.ts"]).toBe(
      [
        'const LABEL = "Toggle";',
        "",
        "export function useToggle(initial: boolean) {",
        "  let on = $state.raw(initial);",
        "  const label = LABEL;",
        "",
        "  function toggle() {",
        "    on = !on;",
        "  }",
        "",
        "  return {",
        "    get on() {",
        "      return on;",
        "    },",
        "    label,",
        "    toggle,",
        "  };",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("keeps the result whole and reads each name through it", checker, async () => {
    const outputs = await compileSources({
      "useToggle.uf.ts": TOGGLE,
      "Switch.uf.tsx": [
        'import { computed } from "unframework";',
        "",
        'import { useToggle } from "./useToggle.uf.ts";',
        "",
        "export default function Switch() {",
        "  const { on, label, toggle } = useToggle(false);",
        '  const text = computed(() => `${label}: ${on.value ? "on" : "off"}`);',
        "  return (",
        '    <button type="button" aria-pressed={on.value} onClick={() => toggle()}>',
        "      {text.value}",
        "    </button>",
        "  );",
        "}",
        "",
      ].join("\n"),
    });
    const script = outputs["Switch.svelte"]!;
    expect(script).toContain('import { useToggle } from "./useToggle.svelte";');
    expect(script).toContain("const toggle = useToggle(false);");
    expect(script).toContain(
      'const text = $derived(`${toggle.label}: ${toggle.on ? "on" : "off"}`);',
    );
    expect(script).toContain("aria-pressed={toggle.on}");
    expect(script).toContain("onclick={() => toggle.toggle()}");
    expect(await typecheck(outputs)).toEqual(clean(outputs));
  });

  it(
    "names the result by its one renamed member, or apart from a name the setup takes",
    checker,
    async () => {
      const outputs = await compileSources({
        "useToggle.uf.ts": TOGGLE,
        "Switch.uf.tsx": [
          'import { ref } from "unframework";',
          "",
          'import { useToggle } from "./useToggle.uf.ts";',
          "",
          "export default function Switch() {",
          "  const toggle = ref(0);",
          "  const { on: open } = useToggle(true);",
          "  const { on, label } = useToggle(false);",
          "  return (",
          '    <button type="button" onClick={() => toggle.value++}>',
          "      {label} {open.value} {on.value} {toggle.value}",
          "    </button>",
          "  );",
          "}",
          "",
        ].join("\n"),
      });
      const script = outputs["Switch.svelte"]!;
      expect(script).toContain("let toggle = $state(0);");
      expect(script).toContain("const open = useToggle(true);");
      expect(script).toContain("const toggle_1 = useToggle(false);");
      expect(script).toContain("{toggle_1.label} {open.on} {toggle_1.on} {toggle}");
      expect(await typecheck(outputs)).toEqual(clean(outputs));
    },
  );
});

describe("svelte shared modules", () => {
  it(
    "declares a constant the setup shadows under a name of its own, with what reads it",
    checker,
    async () => {
      const outputs = await compileSources({
        "tokens.ts": "export const BASE = 4;\n",
        "Meter.uf.tsx": [
          'import { ref } from "unframework";',
          "",
          'import { BASE } from "./tokens";',
          "",
          "const LIMIT = 10;",
          "const BOUNDS = { LIMIT, BASE };",
          "",
          "export default function Meter() {",
          "  const LIMIT = ref(1);",
          "  const BASE = ref(2);",
          "  return (",
          "    <p>",
          "      {LIMIT.value + BASE.value} of {BOUNDS.LIMIT + BOUNDS.BASE}",
          "    </p>",
          "  );",
          "}",
          "",
        ].join("\n"),
      });
      const script = outputs["Meter.svelte"]!;
      expect(script).toContain('import { BASE as BASE_1 } from "./tokens";');
      expect(script).toContain("const LIMIT_1 = 10;");
      expect(script).toContain("const BOUNDS = { LIMIT: LIMIT_1, BASE: BASE_1 };");
      expect(script).toContain("let LIMIT = $state(1);");
      expect(script).toContain("let BASE = $state(2);");
      expect(outputs["tokens.ts"]).toBe("export const BASE = 4;\n");
      expect(await typecheck(outputs)).toEqual(clean(outputs));
    },
  );

  it(
    "imports a value a copied type queries with `typeof`, and the types a constant names",
    checker,
    async () => {
      const outputs = await compileSources({
        "limits.ts": "export const SIZES = { sm: 1, lg: 2 } as const;\n",
        "Size.uf.tsx": [
          'import { SIZES } from "./limits";',
          "",
          "type Size = keyof typeof SIZES;",
          'const DEFAULT: Size = "sm";',
          "",
          "export default function Size() {",
          "  return <p>{DEFAULT}</p>;",
          "}",
          "",
        ].join("\n"),
      });
      const script = outputs["Size.svelte"]!;
      expect(script).toContain('import { SIZES } from "./limits";');
      expect(script).toContain("type Size = keyof typeof SIZES;");
      expect(script).toContain('const DEFAULT: Size = "sm";');
      expect(await typecheck(outputs)).toEqual(clean(outputs));
      const paths = writeScratch(outputs);
      const linted = await toolchain.lint(Object.values(paths), {
        toolchainDir,
        root: toolchainDir,
      });
      expect([...linted.values()].flat()).toEqual([]);
    },
  );

  it(
    "reads a module value a fill's snippet would hide through an alias, which every `typeof` leaves alone",
    checker,
    async () => {
      const outputs = await compileSources({
        "Frame.uf.tsx": FRAME,
        "text.ts": "export function label(n: number): string {\n  return `#${n}`;\n}\n",
        "Tag.uf.tsx": [
          'import { ref } from "unframework";',
          "",
          'import Frame from "./Frame.uf.tsx";',
          'import { label } from "./text";',
          "",
          'const toggle = "Tag";',
          "export type Kind = ReturnType<typeof label>;",
          "",
          "export default function Tag() {",
          '  const kind = ref<ReturnType<typeof label>>("#0");',
          "  return (",
          "    <Frame>",
          "      {{",
          "        toggle: () => <b>{toggle}</b>,",
          "        label: ({ n }) => (",
          "          <span>",
          "            {label(n)} {kind.value}",
          "          </span>",
          "        ),",
          "      }}",
          "    </Frame>",
          "  );",
          "}",
          "",
        ].join("\n"),
      });
      const script = outputs["Tag.svelte"]!;
      expect(script).toContain('import { label } from "./text";');
      expect(script).toContain('const toggle = "Tag";');
      expect(script).toContain("export type Kind = ReturnType<typeof label>;");
      expect(script).toContain("const label_1 = label;");
      expect(script).toContain("const toggle_1 = toggle;");
      expect(script).toContain("<ReturnType<typeof label>>");
      expect(script).toContain("<b>{toggle_1}</b>");
      expect(script).toContain("{label_1(n)}");
      expect(await typecheck(outputs)).toEqual(clean(outputs));
    },
  );

  it(
    "renames a `typeof` in an exported type of a module value the setup shadows",
    checker,
    async () => {
      const outputs = await compileSources({
        "strings.ts": 'export function label(): string {\n  return "x";\n}\n',
        "Box.uf.tsx": [
          'import { ref } from "unframework";',
          "",
          'import { label as text } from "./strings";',
          "",
          "const PREFIXED = text();",
          "export type Kind = ReturnType<typeof text>;",
          "",
          "export default function Box() {",
          '  const text = ref("own");',
          "  return (",
          "    <p>",
          "      {text.value} {PREFIXED}",
          "    </p>",
          "  );",
          "}",
          "",
        ].join("\n"),
      });
      const script = outputs["Box.svelte"]!;
      expect(script).toContain('import { label as text_1 } from "./strings";');
      expect(script).toContain("export type Kind = ReturnType<typeof text_1>;");
      expect(script).toContain("const PREFIXED = text_1();");
      expect(await typecheck(outputs)).toEqual(clean(outputs));
    },
  );

  it(
    "declares the constants in `<script module>` where the output exports a type, exported where the source exports it",
    checker,
    async () => {
      const outputs = await compileSources({
        "Picker.uf.tsx": [
          'import { ref } from "unframework";',
          "",
          'import { BASE } from "./tokens";',
          "",
          "const SIZES = { sm: BASE, md: BASE * 2 } as const;",
          "export type Size = keyof typeof SIZES;",
          "export type Tone = 'info' | 'warn';",
          "const TONE: Tone = 'info';",
          "",
          "export default function Picker() {",
          '  const picked = ref<Size>("sm");',
          "  return (",
          "    <p class={TONE}>{SIZES[picked.value]}</p>",
          "  );",
          "}",
          "",
        ].join("\n"),
        "tokens.ts": "export const BASE = 4;\n",
        "Use.uf.tsx": [
          'import { ref } from "unframework";',
          "",
          'import Picker from "./Picker.uf.tsx";',
          'import type { Size, Tone } from "./Picker.uf.tsx";',
          "",
          "export default function Use({ tone }: { tone: Tone }) {",
          '  const size = ref<Size>("sm");',
          "  return (",
          "    <div class={tone}>",
          "      {size.value}",
          "      <Picker />",
          "    </div>",
          "  );",
          "}",
          "",
        ].join("\n"),
      });
      const script = outputs["Picker.svelte"]!;
      const [module, instance] = script.split('<script lang="ts">');
      expect(module).toContain('import { BASE } from "./tokens";');
      expect(module).toContain("const SIZES = { sm: BASE, md: BASE * 2 } as const;");
      expect(module).toContain("export type Size = keyof typeof SIZES;");
      expect(module).toContain('export type Tone = "info" | "warn";');
      expect(module).toContain('const TONE: Tone = "info";');
      expect(instance).not.toContain("SIZES =");
      expect(await typecheck(outputs)).toEqual(clean(outputs));
    },
  );
});

describe("svelte shared modules, types other components' constants name", () => {
  it(
    "re-exports from the main output an exported type only a sibling's constant reaches",
    checker,
    async () => {
      const outputs = await compileSources({
        "Card.uf.tsx": [
          'export type Tone = "info" | "warn";',
          'const TONES: Tone[] = ["info", "warn"];',
          "",
          "function Badge() {",
          "  return <b>{TONES.join()}</b>;",
          "}",
          "",
          "export default function Card() {",
          "  return (",
          "    <div>",
          "      <Badge />",
          "    </div>",
          "  );",
          "}",
          "",
        ].join("\n"),
        "Use.uf.tsx": [
          'import { ref } from "unframework";',
          "",
          'import Card from "./Card.uf.tsx";',
          'import type { Tone } from "./Card.uf.tsx";',
          "",
          "export default function Use() {",
          '  const tone = ref<Tone>("info");',
          "  return (",
          "    <div class={tone.value}>",
          "      <Card />",
          "    </div>",
          "  );",
          "}",
          "",
        ].join("\n"),
      });
      expect(outputs["Badge.svelte"]).toContain('export type Tone = "info" | "warn";');
      expect(outputs["Card.svelte"]).toContain('export type { Tone } from "./Badge.svelte";');
      expect(await typecheck(outputs)).toEqual(clean(outputs));
    },
  );
  it(
    "declares a type a sibling declares where the main component's constant names it",
    checker,
    async () => {
      const outputs = await compileSources({
        "Cards.uf.tsx": [
          'export type Tone = "warm" | "cool";',
          'const DEFAULT_TONE: Tone = "warm";',
          "",
          "export function Chip({ tone }: { tone: Tone }) {",
          "  return <i>{tone}</i>;",
          "}",
          "",
          "export default function Card() {",
          "  return (",
          "    <div>",
          "      <Chip tone={DEFAULT_TONE} />",
          "    </div>",
          "  );",
          "}",
          "",
        ].join("\n"),
      });
      const script = outputs["Card.svelte"]!;
      expect(script).toContain('export type { Tone } from "./Chip.svelte";');
      expect(script).toContain('type Tone = "warm" | "cool";');
      expect(await typecheck(outputs)).toEqual(clean(outputs));
    },
  );

  it(
    "declares in the main output, and never re-exports, a type its own constant and a sibling's reach",
    checker,
    async () => {
      const outputs = await compileSources({
        "Card.uf.tsx": [
          'export type Tone = "info" | "warn";',
          'const TONES: Tone[] = ["info", "warn"];',
          'const FIRST: Tone = "info";',
          "",
          "function Badge() {",
          "  return <b>{TONES.join()}</b>;",
          "}",
          "",
          "export default function Card() {",
          "  return (",
          "    <div>",
          "      {FIRST}",
          "      <Badge />",
          "    </div>",
          "  );",
          "}",
          "",
        ].join("\n"),
      });
      const script = outputs["Card.svelte"]!;
      expect(script).toContain('export type Tone = "info" | "warn";');
      expect(script).not.toContain('export type { Tone } from "./Badge.svelte";');
      expect(await typecheck(outputs)).toEqual(clean(outputs));
    },
  );

  it(
    "imports the types of a `.ts` module beside its values in `<script module>`",
    checker,
    async () => {
      const outputs = await compileSources({
        "tokens.ts": 'export const BASE = 4;\n\nexport type Unit = "px" | "rem";\n',
        "Gap.uf.tsx": [
          'import { BASE } from "./tokens";',
          'import type { Unit } from "./tokens";',
          "",
          'const UNIT: Unit = "px";',
          "const GAP = BASE * 2;",
          'export type Size = "sm";',
          "",
          "export default function Gap() {",
          "  return (",
          "    <p>",
          "      {GAP}",
          "      {UNIT}",
          "    </p>",
          "  );",
          "}",
          "",
        ].join("\n"),
      });
      const [module] = outputs["Gap.svelte"]!.split('<script lang="ts">');
      expect(module).toContain('import { BASE, type Unit } from "./tokens";');
      expect(await typecheck(outputs)).toEqual(clean(outputs));
    },
  );
});

describe("svelte composables, names and types", () => {
  it(
    "keeps the result apart from a fill's snippet and from the names fills hide",
    checker,
    async () => {
      const outputs = await compileSources({
        "Frame.uf.tsx": FRAME,
        "useToggle.uf.ts": TOGGLE,
        "Panel.uf.tsx": [
          'import Frame from "./Frame.uf.tsx";',
          'import { useToggle } from "./useToggle.uf.ts";',
          "",
          "export default function Panel() {",
          "  const { on, toggle } = useToggle(false);",
          "  return (",
          "    <Frame>",
          "      {{",
          '        toggle: () => <button type="button" onClick={() => toggle()}>{on.value ? "yes" : "no"}</button>,',
          "        label: ({ n }) => <span>{n}</span>,",
          "      }}",
          "    </Frame>",
          "  );",
          "}",
          "",
        ].join("\n"),
      });
      const script = outputs["Panel.svelte"]!;
      expect(script).toContain("const toggle_1 = useToggle(false);");
      expect(script).toContain("onclick={() => toggle_1.toggle()}");
      expect(script).toContain('{toggle_1.on ? "yes" : "no"}');
      expect(await typecheck(outputs)).toEqual(clean(outputs));
    },
  );

  it(
    "names the result by the composable's own name under an alias, and never by a reserved word",
    checker,
    async () => {
      const outputs = await compileSources({
        "useToggle.uf.ts": TOGGLE,
        "useSwitch.uf.ts": TOGGLE.replace("useToggle", "useSwitch"),
        "Box.uf.tsx": [
          'import { useToggle as makeToggle } from "./useToggle.uf.ts";',
          'import { useSwitch } from "./useSwitch.uf.ts";',
          "",
          "export default function Box() {",
          "  const { on } = makeToggle(false);",
          "  const { on: lit } = useSwitch(true);",
          "  const { label } = useSwitch(false);",
          "  return (",
          "    <p>",
          "      {on.value} {lit.value} {label}",
          "    </p>",
          "  );",
          "}",
          "",
        ].join("\n"),
      });
      const script = outputs["Box.svelte"]!;
      expect(script).toContain('import { useToggle as makeToggle } from "./useToggle.svelte";');
      expect(script).toContain("const toggle = makeToggle(false);");
      expect(script).toContain("const lit = useSwitch(true);");
      expect(script).toContain("const switch_1 = useSwitch(false);");
      expect(await typecheck(outputs)).toEqual(clean(outputs));
    },
  );

  it(
    "imports every type a composable's parameters and setup name, and declares the module's",
    checker,
    async () => {
      const outputs = await compileSources({
        "types.ts": [
          "export interface Item {",
          "  id: number;",
          "}",
          "",
          "export interface Options {",
          "  max: number;",
          "}",
          "",
        ].join("\n"),
        "useList.uf.ts": [
          'import { ref } from "unframework";',
          'import type { Item, Options } from "./types";',
          "",
          "type Step = 1 | 2;",
          "type Limit = number;",
          "const MAX: Limit = 3;",
          "",
          "export function useList(options: Options) {",
          "  const items = ref<Item[]>([]);",
          "  const step = ref<Step>(1);",
          "  function add(item: Item) {",
          "    if (items.value.length < Math.min(options.max, MAX)) items.value = [...items.value, item];",
          "  }",
          "  return { items, step, add };",
          "}",
          "",
        ].join("\n"),
      });
      const module = outputs["useList.svelte.ts"]!;
      expect(module).toContain('import type { Item, Options } from "./types";');
      expect(module).toContain("type Step = 1 | 2;");
      expect(module).toContain("type Limit = number;");
      expect(module).toContain("const MAX: Limit = 3;");
      expect(await typecheck(outputs)).toEqual(clean(outputs));
    },
  );

  it("keeps a result whose name no member takes apart from a fill's snippet", checker, async () => {
    const outputs = await compileSources({
      "Frame.uf.tsx": FRAME,
      "useToggle.uf.ts": TOGGLE,
      "Panel.uf.tsx": [
        'import Frame from "./Frame.uf.tsx";',
        'import { useToggle } from "./useToggle.uf.ts";',
        "",
        "export default function Panel() {",
        "  const { on, label } = useToggle(false);",
        "  return (",
        "    <Frame>",
        "      {{",
        '        toggle: () => <span>{on.value ? "yes" : "no"}</span>,',
        "        label: ({ n }) => (",
        "          <span>",
        "            {label} {n}",
        "          </span>",
        "        ),",
        "      }}",
        "    </Frame>",
        "  );",
        "}",
        "",
      ].join("\n"),
    });
    const script = outputs["Panel.svelte"]!;
    expect(script).toContain("const toggle_1 = useToggle(false);");
    expect(script).toContain('{toggle_1.on ? "yes" : "no"}');
    expect(script).toContain("{toggle_1.label}");
    expect(await typecheck(outputs)).toEqual(clean(outputs));
  });

  it("names the result apart from a composable imported under its stem", checker, async () => {
    const outputs = await compileSources({
      "useToggle.uf.ts": TOGGLE,
      "Box.uf.tsx": [
        'import { useToggle as toggle } from "./useToggle.uf.ts";',
        "",
        "export default function Box() {",
        "  const { on } = toggle(false);",
        "  return <p>{on.value}</p>;",
        "}",
        "",
      ].join("\n"),
    });
    const script = outputs["Box.svelte"]!;
    expect(script).toContain('import { useToggle as toggle } from "./useToggle.svelte";');
    expect(script).toContain("const toggle_1 = toggle(false);");
    expect(await typecheck(outputs)).toEqual(clean(outputs));
  });

  it("imports a type a composable's function names only in its return type", checker, async () => {
    const outputs = await compileSources({
      "types.ts": "export interface Item {\n  id: number;\n}\n",
      "useMake.uf.ts": [
        'import type { Item } from "./types";',
        "",
        "export function useMake() {",
        "  function make(): Item {",
        "    return { id: 1 };",
        "  }",
        "  return { make };",
        "}",
        "",
      ].join("\n"),
    });
    expect(outputs["useMake.svelte.ts"]).toContain('import type { Item } from "./types";');
    expect(await typecheck(outputs)).toEqual(clean(outputs));
  });

  it("reads a composable's ref once where the setup reads it at the top", async () => {
    const outputs = await compileSources({
      "useToggle.uf.ts": TOGGLE,
      "useDouble.uf.ts": [
        'import { computed } from "unframework";',
        "",
        "export function useDouble() {",
        "  const doubled = computed(() => 2);",
        "  return { doubled };",
        "}",
        "",
      ].join("\n"),
      "Seed.uf.tsx": [
        'import { ref } from "unframework";',
        "",
        'import { useDouble } from "./useDouble.uf.ts";',
        'import { useToggle } from "./useToggle.uf.ts";',
        "",
        "export default function Seed() {",
        "  const { on } = useToggle(false);",
        "  const { doubled } = useDouble();",
        "  const first = ref(on.value);",
        "  const copy = ref(doubled.value);",
        "  return (",
        "    <p>",
        "      {first.value} {copy.value}",
        "    </p>",
        "  );",
        "}",
        "",
      ].join("\n"),
    });
    expect(outputs["Seed.svelte"]).toContain("(untrack(() => toggle.on));");
    expect(outputs["Seed.svelte"]).toContain("(untrack(() => double.doubled));");
  });
});
