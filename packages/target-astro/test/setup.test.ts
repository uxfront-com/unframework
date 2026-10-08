// M2 (ADR-0046): the setup an Astro component keeps. Astro renders once, on the server, so a
// `ref` is its initial value, a `computed` its getter's value, `const`s and the functions the
// server render calls are copied, and everything only the browser would run is dropped, with
// what only it reads. Real sources, lowered by the analyser and emitted by this target, through
// Astro's compiler, the Container API and the toolchain (L3, L4, L5).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { formatOutput } from "@unframework/codegen";
import { afterAll, describe, expect, it } from "vitest";

import { astroTypecheck } from "../src/toolchain/check.ts";
import { astroFrameworkCompile } from "../src/toolchain/compile.ts";
import { toolchain } from "../src/toolchain/index.ts";
import { renderToString } from "../src/toolchain/server.ts";
import { loadAstroComponent, scratchDirectory, writeAstroModule } from "./astro.ts";
import { M2_SHAPES } from "./lint-probes.ts";
import { compiled, emitSource } from "./source.ts";
import { integrationRoot, toolchainDir } from "./workspace.ts";

const scratch = scratchDirectory("setup");
afterAll(() => scratch.remove());

/** Server-renders Astro source with props, as the `ssr:astro` project does. */
async function renderSource(source: string, props: Record<string, unknown> = {}): Promise<string> {
  return renderToString(await loadAstroComponent(scratch.path, source), { props });
}

const counter = `import { computed, defineEmits, ref } from "unframework";

export interface CounterProps {
  initial?: number;
  step?: number;
}

export default function Counter({ initial = 0, step = 1 }: CounterProps) {
  const emit = defineEmits<{ change: [value: number] }>();
  const count = ref(initial);
  const doubled = computed(() => count.value * 2);

  function increment() {
    count.value += step;
    emit("change", count.value);
  }

  return (
    <div class="counter">
      <output>{count.value}</output>
      {doubled.value > 10 ? <span>Big</span> : null}
      <button type="button" onClick={increment}>
        Add
      </button>
    </div>
  );
}
`;

const casts = `import { ref } from "unframework";

type Status = "idle" | "busy";

interface Item {
  name: string;
}

export default function Casts() {
  const count = ref(0);
  const offset = ref(-1);
  const title = ref("Draft");
  const open = ref(false);
  const status = ref<Status>("idle");
  const picked = ref<Item>();
  const items = ref<Item[]>([]);
  const tags = ref(["a", "b"]);

  return (
    <dl>
      <dt>{count.value === 5 ? "five" : count.value}</dt>
      <dd>{offset.value + 1}</dd>
      <dd>{title.value === "Final" ? "final" : title.value}</dd>
      <dd>{open.value === true ? "open" : "closed"}</dd>
      <dd>{status.value === "busy" ? "busy" : "idle"}</dd>
      <dd>{picked.value?.name ?? "none"}</dd>
      <dd>{items.value.length}</dd>
      <dd>{tags.value.join(", ")}</dd>
    </dl>
  );
}
`;

const conditionals = `import { computed, ref } from "unframework";

export interface LevelProps {
  flag: boolean;
}

export default function Level({ flag }: LevelProps) {
  const level = ref(flag ? 1 : 2);
  const maybe = ref(flag ? 1 : null);
  const mixed = ref(flag ? "a" : 0);
  const pick = computed(() => (flag ? "on" : "off"));

  return (
    <p>
      {level.value === 3 ? "three" : level.value} {maybe.value ?? "none"}{" "}
      {mixed.value === "b" ? "b" : mixed.value} {pick.value}
    </p>
  );
}
`;

const getters = `import { computed, ref } from "unframework";

export type Tier = "low" | "high";

export interface PriceProps {
  price: number;
}

export default function Price({ price }: PriceProps) {
  const quantity = ref(2);
  const total = computed(() => quantity.value * price);
  const unit = computed(() => "EUR");
  const tier = computed<Tier>(() => {
    if (total.value > 100) return "high";
    return "low";
  });
  const label = computed((): string => {
    const amount = (total.value / 100).toFixed(2);
    return \`\${amount} \${unit.value}\`;
  });

  return (
    <p data-tier={tier.value}>
      {label.value} {unit.value === "USD" ? "(US)" : "(EU)"}
    </p>
  );
}
`;

const functions = `import { computed, ref } from "unframework";

export default function Totals() {
  const rates = { standard: 0, express: 12 };

  function format(cents: number): string {
    return \`\${(cents / 100).toFixed(2)} EUR\`;
  }

  const double = (value: number) => value * 2;
  const method = ref<"standard" | "express">("standard");
  const shipping = computed(() => double(rates[method.value]));

  function choose(next: "standard" | "express") {
    method.value = next;
  }

  const chooseExpress = () => {
    choose("express");
  };

  return (
    <section aria-label="Totals">
      <p>{format(shipping.value)}</p>
      <button type="button" onClick={chooseExpress}>
        Express
      </button>
    </section>
  );
}
`;

const dropped = `import {
  defineEmits,
  onMounted,
  onUnmounted,
  ref,
  useTemplateRef,
  watch,
  watchEffect,
} from "unframework";

interface Entry {
  label: string;
}

export interface PanelProps {
  heading: string;
  delay: number;
}

export default function Panel({ heading, delay }: PanelProps) {
  const emit = defineEmits<{ opened: [entry: Entry]; closed: [] }>();
  const open = ref(false);
  const status = ref("Waiting");
  const field = useTemplateRef<HTMLInputElement>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  watch(open, (value) => {
    status.value = value ? "Open" : "Closed";
  });

  watchEffect(() => {
    emit("opened", { label: status.value });
  });

  onMounted(() => {
    timer = setTimeout(() => {
      field.value?.focus();
    }, delay);
  });

  onUnmounted(() => {
    clearTimeout(timer);
    emit("closed");
  });

  function toggle(entry: Entry) {
    open.value = !open.value;
    emit("opened", entry);
  }

  return (
    <section aria-label={heading}>
      <p role="status">{status.value}</p>
      <input ref={field} aria-label="Name" />
      <button type="button" onClick={() => toggle({ label: heading })}>
        Toggle
      </button>
    </section>
  );
}
`;

const ids = `import { useId } from "unframework";

export interface FieldProps {
  label: string;
}

export default function Field({ label }: FieldProps) {
  const inputId = useId();
  const hintId = useId();

  return (
    <div>
      <label for={inputId}>{label}</label>
      <input id={inputId} aria-describedby={hintId} />
      <p id={hintId}>Required</p>
    </div>
  );
}
`;

const idsUnread = `import { useId } from "unframework";

export interface FieldProps {
  label?: string;
}

export default function Field(_props: FieldProps) {
  const id = useId();

  return <input id={id} aria-label="Name" />;
}
`;

const astroObject = `import { computed, ref } from "unframework";

export interface PlanetProps {
  name: string;
}

export default function Planet(Astro: PlanetProps) {
  const moons = ref(2);
  const label = computed(() => \`\${Astro.name}: \${moons.value}\`);

  return <p>{label.value}</p>;
}
`;

const astroBinding = `import { ref } from "unframework";

export default function Planet() {
  const Astro = ref("Mars");

  return <p>{Astro.value}</p>;
}
`;

describe("setup (ADR-0046)", () => {
  it("seeds state from a prop, and reads only the props the server render reaches", async () => {
    const output = await compiled(counter);
    expect(output).toBe(M2_SHAPES["Counter.astro"]);
    // `step` is read by the handler alone, which never runs: it is not destructured.
    await expect(renderSource(output)).resolves.toBe(
      '<div class="counter"><output>0</output><button type="button">Add</button></div>',
    );
    await expect(renderSource(output, { initial: 6, step: 2 })).resolves.toBe(
      '<div class="counter"><output>6</output><span>Big</span><button type="button">Add</button></div>',
    );
  });

  it("declares a `ref` as its initial value, cast to the type the `ref` has", async () => {
    // A `const` would keep a literal's own type, or narrow a union to its initial member, and
    // the comparisons would not type-check (TS2367): the casts keep the `ref`'s type (L4).
    const output = await compiled(casts);
    expect(output).toBe(M2_SHAPES["Casts.astro"]);
    await expect(renderSource(output)).resolves.toBe(
      "<dl><dt>0</dt><dd>0</dd><dd>Draft</dd><dd>closed</dd><dd>idle</dd><dd>none</dd><dd>0</dd><dd>a, b</dd></dl>",
    );
  });

  it("widens a conditional of literals as `ref` does, and keeps the union a `computed` keeps", async () => {
    const output = await compiled(conditionals);
    expect(output.slice(0, output.indexOf("---\n\n<p>"))).toBe(
      [
        "---",
        "export interface LevelProps {",
        "  flag: boolean;",
        "}",
        "",
        "type Props = LevelProps;",
        "",
        "const { flag } = Astro.props;",
        "",
        "const level = (flag ? 1 : 2) as number;",
        "const maybe = (flag ? 1 : null) as number | null;",
        'const mixed = (flag ? "a" : 0) as string | number;',
        'const pick = flag ? "on" : "off";',
        "",
      ].join("\n"),
    );
    await expect(renderSource(output, { flag: true })).resolves.toBe("<p>1 1 a on</p>");
  });

  it("declares a `computed` as its value: an expression, or a block getter's function, called once", async () => {
    const output = await compiled(getters);
    expect(output).toBe(M2_SHAPES["Price.astro"]);
    await expect(renderSource(output, { price: 30 })).resolves.toBe(
      '<p data-tier="low">0.60 EUR (EU)</p>',
    );
    await expect(renderSource(output, { price: 70 })).resolves.toBe(
      '<p data-tier="high">1.40 EUR (EU)</p>',
    );
  });

  it("copies the constants and functions the server render calls, and drops the others", async () => {
    const output = await compiled(functions);
    expect(output).toBe(
      [
        "---",
        "const rates = { standard: 0, express: 12 };",
        "",
        "function format(cents: number): string {",
        "  return `${(cents / 100).toFixed(2)} EUR`;",
        "}",
        "",
        "const double = (value: number) => value * 2;",
        'const method = "standard" as "standard" | "express";',
        "const shipping = double(rates[method]);",
        "---",
        "",
        '<section aria-label="Totals">',
        "  <p>{format(shipping)}</p>",
        '  <button type="button">Express</button>',
        "</section>",
        "",
      ].join("\n"),
    );
    await expect(renderSource(output)).resolves.toBe(
      '<section aria-label="Totals"><p>0.00 EUR</p><button type="button">Express</button></section>',
    );
  });

  it("drops listeners, template refs, watchers, effects, hooks, `let`s, `emit` and what only they reach", async () => {
    // `open` is read by a watcher and a handler, `delay` by a hook, `Entry` by an event's
    // payload and a handler's parameter: none of them is declared.
    const output = await compiled(dropped);
    expect(output).toBe(
      [
        "---",
        "export interface PanelProps {",
        "  heading: string;",
        "  delay: number;",
        "}",
        "",
        "type Props = PanelProps;",
        "",
        "const { heading } = Astro.props;",
        "",
        'const status = "Waiting" as string;',
        "---",
        "",
        "<section aria-label={heading}>",
        '  <p role="status">{status}</p>',
        '  <input aria-label="Name" />',
        '  <button type="button">Toggle</button>',
        "</section>",
        "",
      ].join("\n"),
    );
    await expect(renderSource(output, { heading: "Panel", delay: 10 })).resolves.toBe(
      '<section aria-label="Panel"><p role="status">Waiting</p><input aria-label="Name"><button type="button">Toggle</button></section>',
    );
  });

  it("reads a props object named `Astro` as `props`, and renames a setup binding named `Astro`", async () => {
    const object = await compiled(astroObject);
    expect(object).toBe(
      [
        "---",
        "export interface PlanetProps {",
        "  name: string;",
        "}",
        "",
        "type Props = PlanetProps;",
        "",
        "const props = Astro.props;",
        "",
        "const moons = 2 as number;",
        "const label = `${props.name}: ${moons}`;",
        "---",
        "",
        "<p>{label}</p>",
        "",
      ].join("\n"),
    );
    await expect(renderSource(object, { name: "Mars" })).resolves.toBe("<p>Mars: 2</p>");
    // The compiled component declares `Astro` in the frontmatter's scope.
    const binding = await compiled(astroBinding);
    expect(binding).toBe(
      ["---", 'const Astro_1 = "Mars" as string;', "---", "", "<p>{Astro_1}</p>", ""].join("\n"),
    );
    await expect(renderSource(binding)).resolves.toBe("<p>Mars</p>");
  });
});

describe("useId (ADR-0049)", () => {
  it("declares each id from a helper that counts on `Astro.locals`", async () => {
    expect(await compiled(ids)).toBe(M2_SHAPES["Field.astro"]);
  });

  it("does not export `Props` when the helper names `Astro`, which reads it (L5)", async () => {
    expect(await compiled(idsUnread)).toBe(
      [
        "---",
        "export interface FieldProps {",
        "  label?: string;",
        "}",
        "",
        "type Props = FieldProps;",
        "",
        "function uniqueId(): string {",
        "  const locals = Astro.locals as { ufIdCount?: number };",
        "  locals.ufIdCount = (locals.ufIdCount ?? 0) + 1;",
        "  return `uf-id-${locals.ufIdCount}`;",
        "}",
        "",
        "const id = uniqueId();",
        "---",
        "",
        '<input id={id} aria-label="Name" />',
        "",
      ].join("\n"),
    );
  });

  it("gives two instances on one page different ids, and each request the same ones", async () => {
    // A counter in the frontmatter would restart for each instance, and one in the module would
    // keep counting across requests (P8): `Astro.locals` lives for one request.
    const directory = join(scratch.path, "ids");
    mkdirSync(directory, { recursive: true });
    writeAstroModule(directory, await compiled(ids), "Field");
    const page = writeAstroModule(
      directory,
      '---\nimport Field from "./Field.mjs";\n---\n\n<form><Field label="Work" /><Field label="Home" /></form>\n',
      "Page",
    );
    const module: { default: unknown } = await import(page);
    const html = await renderToString(module.default, {});
    expect(html).toBe(
      [
        "<form>",
        '<div><label for="uf-id-1">Work</label><input id="uf-id-1" aria-describedby="uf-id-2"><p id="uf-id-2">Required</p></div>',
        '<div><label for="uf-id-3">Home</label><input id="uf-id-3" aria-describedby="uf-id-4"><p id="uf-id-4">Required</p></div>',
        "</form>",
      ].join(""),
    );
    await expect(renderToString(module.default, {})).resolves.toBe(html);
  });
});

describe("the M2 output through the toolchain", { timeout: 60_000 }, () => {
  const sources = {
    counter,
    casts,
    conditionals,
    getters,
    functions,
    dropped,
    ids,
    idsUnread,
    astroObject,
    astroBinding,
  };

  it.each([false, true])(
    "passes Astro's compiler, astro check and the linters with no finding (formatted: %s)",
    async (format) => {
      const directory = join(scratch.path, `toolchain-${format}`);
      mkdirSync(directory, { recursive: true });
      const files: { path: string; contents: string }[] = [];
      for (const [name, source] of Object.entries(sources)) {
        for (const file of emitSource(source)) {
          const contents = format ? (await formatOutput(file)).file.contents : file.contents;
          const path = join(directory, `${name}-${file.path}`);
          writeFileSync(path, contents);
          files.push({ path, contents });
        }
      }
      const paths = files.map(({ path }) => path);
      const context = { toolchainDir, root: integrationRoot };
      const [compiledFiles, checked, linted] = await Promise.all([
        astroFrameworkCompile(files, context),
        astroTypecheck(paths, context),
        toolchain.lint(paths, context),
      ]);
      const clean = Object.fromEntries(paths.map((path) => [path, []]));
      expect(
        Object.fromEntries(
          [...compiledFiles].map(([path, { errors, warnings }]) => [
            path,
            [...errors, ...warnings],
          ]),
        ),
      ).toEqual(clean);
      expect(Object.fromEntries(checked)).toEqual(clean);
      expect(Object.fromEntries(linted)).toEqual(clean);
    },
  );
});
