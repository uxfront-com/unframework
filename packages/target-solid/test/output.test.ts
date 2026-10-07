// What the emitter writes, through Solid's compiler (L3), its types (L4) and its lint (L5),
// with nothing reported: the output reads as Solid code (G2), whatever the corpus holds. The
// corpus checks its own outputs the same way (harness/toolchain.test.ts); this pins the
// emitter's shapes in the package, so a change to one shows here first.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import { transformSync } from "@babel/core";
import type { ToolchainContext } from "@unframework/codegen";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { toolchain } from "../src/toolchain/index.ts";
import { renderToString } from "../src/toolchain/server.ts";
import { emitSource, packageDir, toolchainDir } from "./fixtures.ts";
import { SOURCES } from "./sources.ts";

const context: ToolchainContext = { toolchainDir, root: packageDir };
const require = createRequire(import.meta.url);
let scratch: string;
const files: { path: string; contents: string }[] = [];

beforeAll(async () => {
  mkdirSync(join(packageDir, ".uf-tmp"), { recursive: true });
  // In the package, so the output's `solid-js` imports resolve from its node_modules.
  scratch = mkdtempSync(join(packageDir, ".uf-tmp", "output-"));
  for (const [name, source] of Object.entries(SOURCES)) {
    const path = join(scratch, `${name}.tsx`);
    const contents = await emitSource(source);
    writeFileSync(path, contents);
    files.push({ path, contents });
  }
});
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe("solid output, checked by Solid's own tools", { timeout: 60_000 }, () => {
  it("compiles in dom and ssr modes with no error or warning (L3)", async () => {
    const results = await toolchain.frameworkCompile(files, context);
    expect(Object.fromEntries(results)).toEqual(
      Object.fromEntries(files.map((file) => [file.path, { errors: [], warnings: [] }])),
    );
  });

  it("type-checks against Solid's JSX types (L4)", async () => {
    const results = await toolchain.typecheck(
      files.map((file) => file.path),
      context,
    );
    expect(Object.fromEntries(results)).toEqual(
      Object.fromEntries(files.map((file) => [file.path, []])),
    );
  });

  it("passes the lint, eslint-plugin-solid included (L5)", async () => {
    const results = await toolchain.lint(
      files.map((file) => file.path),
      context,
    );
    expect(Object.fromEntries(results)).toEqual(
      Object.fromEntries(files.map((file) => [file.path, []])),
    );
  });

  it("covers every shape the emitter prints", () => {
    const all = files.map((file) => file.contents).join("\n");
    for (const shape of [
      "mergeProps(",
      "satisfies Partial<",
      "(props: LinkCardProps)",
      "(_props: { note?: string })",
      "<Show when={!props.busy}>",
      "<Switch",
      "<Match when=",
      "<For each=",
      "index() + 1",
      "classList={{",
      "Boolean(",
      "class={cx(",
      'class={props.active ? "on" : "off"}',
      '"line-height": "1.5"',
      'padding: "4px"',
      "props.extra?.id",
      'class={cx("card-link", props.link.class)}',
      '{["\\n"]}',
      "<>",
      "stroke-width={props.count}",
      'fallback={"first"}',
      'fallback="Inactive"',
      'String("<b>")',
      '<stop offset="0" {...{ fill: props.colour }} />',
      "<stop {...{ fill: props.paint.fill }} id={props.paint.id} />",
      '{...({ href: "#swatch-path" } as Record<string, unknown>)}',
      "{...({ tabindex: props.order } as Record<string, unknown>)}",
      "String('say \"hi\"')",
      '{props.active ? "On" : "Off"}',
      // The `Narrowing` source's union holds a `false`, so its values are written `|| undefined`.
      "<Show when={props.user || undefined}>",
      "<Show when={props.maybe}>",
      "{(user) => <p>{user().name}</p>}",
      "<Show when={props.label && props.user ? { user: props.user } : undefined}>",
      '<Match when={typeof props.value === "string" ? { value: props.value } : undefined}>',
      "<Match when={props.count === undefined ? undefined : { count: props.count }}>",
      "<Match when={props.shape.kind === `circle` ? undefined : { shape: props.shape }}>",
      "{(city) => <p>{city()}</p>}",
      '<Show when={index() > 0 && row ? { row } : undefined} fallback="-">',
      "{(narrowed) => <s>{Math.round(narrowed().age)}</s>}",
      // A branch whose expressions narrow its value further is keyed: TypeScript narrows no call.
      "<Show keyed when={props.user || undefined}>",
      'title={user.nick ? user.nick.trim() : "none"}',
      'const defaults: Required<Pick<NarrowingProps, "attrs">> = { attrs: { title: "t" } };',
      "const props = mergeProps(defaults, rawProps);",
      "<p title={props.attrs.title} id={props.attrs.id}>",
      // M2: the setup (src/setup.ts), listeners and template refs (src/listeners.ts), and the
      // helpers (src/helpers.ts).
      "export interface WatchersEvents {",
      "onLabelled?: (value: string, previous?: string) => void;",
      "(props: WatchersProps & WatchersEvents)",
      'const [query, setQuery] = createSignal("");',
      "const [fixed] = createSignal(format(1));",
      "createWatcher(query, (value, previous, onCleanup) => {",
      "createWatcher([low, high], ([minimum, maximum]: [number, number], [lastMinimum, lastMaximum]) => {",
      "{ immediate: true },",
      "props.onQueryRun?.(value, previous);",
      "type WatchedValues<S>",
      'on:click={{ handleEvent: () => record("once"), once: true }}',
      "on:wheel={{ handleEvent: scroll, passive: true }}",
      'element.addEventListener("click", () => record("capture"), { capture: true })',
      'element.addEventListener("keydown", () => record("key capture"), { capture: true });',
      'on:click={() => record("inside")}',
      'onFocus={() => record("focus")}',
      "onKeyDown={(event) =>",
      "field = element;",
      "onCleanup(() => {\n              field = null;",
      "let headingElement: HTMLHeadingElement | null = null;",
      "headingElement = heading;",
      "const id = `uf-id-${createUniqueId()}`;",
      "let timer: ReturnType<typeof setInterval> | undefined;",
      'const units = ["s", "ms"];\n\nfunction format(value: number): string {',
      "onMount(() =>\n    onCleanup(() => {",
      "await nextTick();\n    props.onToggled?.(details?.childElementCount ?? 0);",
      "function nextTick(): Promise<void> {",
      // The watchers' scheduler, pre watchers before post ones; `watchEffect` over what it reads,
      // async included; client code with no `batch`; a continuation's and a handed arrow's reads
      // untracked; listeners of one event and phase in attribute order; branches narrowed on
      // state; a handler reading its branch's accessor.
      "const queuedWatchers = { pre: new Set<() => void>(), post: new Set<() => void>() };",
      "queueMicrotask(() => {",
      "const track = createReaction(() => queueWatcher(queue, run));",
      '{ flush: "post" },',
      "createWatchEffect([() => props.label, query], async () => {",
      "    void Promise.resolve(5).then((step) =>\n      untrack(() => {",
      "  async function start() {\n    await Promise.resolve();\n    setLow(1);\n    setHigh(11);\n  }",
      "    update((entries) => untrack(() => [...entries, `${props.label} ${query()}`]));",
      "    const data = cached() ?? (await Promise.resolve([1, 2, 3]));",
      'element.addEventListener("click", () => record("plain"));\n          element.addEventListener("click", () => record("first"), { once: true });',
      "when={((user) => (user !== null ? { user } : undefined))(user())}",
      "onClick={() => pick(member().name)}",
      'ref={(element) => element.addEventListener("click", hit)}',
      'element.addEventListener("encrypted", () => setLast("keys"))',
      '<video on:encrypted={() => setLast("video")} />',
    ]) {
      expect(all, shape).toContain(shape);
    }
  });
});

/** A fixture compiled for the server as vite-plugin-solid compiles it, then rendered. */
async function serverRender(name: string, props: Record<string, unknown>): Promise<string> {
  const fixture = new URL(`./fixtures/${name}.tsx`, import.meta.url);
  const { code } = transformSync(readFileSync(fixture, "utf8"), {
    filename: join(scratch, `${name}.tsx`),
    babelrc: false,
    configFile: false,
    presets: [
      [require.resolve("babel-preset-solid"), { generate: "ssr", hydratable: true }],
      [require.resolve("@babel/preset-typescript"), { isTSX: true, allExtensions: true }],
    ],
  })!;
  const path = join(scratch, `${name}.js`);
  writeFileSync(path, code!);
  const { default: component }: { default: unknown } = await import(path);
  return renderToString(component, { props });
}

/** The Narrowing fixture's server HTML, without Solid's hydration markers. */
async function narrowingHtml(props: Record<string, unknown>): Promise<string> {
  const html = await serverRender("Narrowing", props);
  return html.replace(/<!--[^>]*-->/g, "").replace(/ data-hk="[^"]*"/g, "");
}

// test/rewrites.browser.test.ts mounts these fixtures in Chromium; here, they are the
// emitter's output, and the server renders them as the client does.
describe("solid output where Solid needs a rewrite (src/render.ts, src/attributes.ts, src/narrowing.ts)", () => {
  it.each([
    "Address",
    "Swatch",
    "Narrowing",
    "Watchers",
    "Listeners",
    "Lifecycle",
    "Runs",
    "AsyncRuns",
    "NarrowedState",
    "Coalesced",
  ])("is test/fixtures/%s.tsx, which the browser test mounts", async (name) => {
    expect(await emitSource(SOURCES[name]!)).toBe(
      readFileSync(new URL(`./fixtures/${name}.tsx`, import.meta.url), "utf8"),
    );
  });

  it("renders every line feed of a <pre> whose text follows expressions on the server", async () => {
    const html = await serverRender("Address", { name: "Ada", street: "12 St James's Square" });
    const text = /<pre[^>]*>([\s\S]*)<\/pre>/.exec(html)![1]!.replace(/<!--[^>]*-->/g, "");
    expect(text).toBe("Ada\n12 St James's Square\n-");
  });

  it("renders the branches that narrow on the server, absent and present", async () => {
    const absent = {
      rows: [null],
      ready: true,
      places: ["x"],
      value: null,
      shape: { kind: "square", side: 3 },
      result: { ok: false, error: "E" },
      label: "",
      format: { separator: null },
    };
    expect(await narrowingHtml(absent)).toBe(
      '<div><i>anon</i><i>none</i><i>anon</i><ul><li>-</li></ul><i>none</i><svg><rect width="3"></rect></svg><p>E</p><ul><li></li></ul>&lt;anonymous><p title="t">a</p><p>anon</p><p></p><p></p></div>',
    );
    const user = {
      name: "Ada",
      nick: " A ",
      admin: true,
      age: 30.4,
      tags: ["t"],
      address: { city: "C" },
      link: { href: "#a" },
    };
    const html = await narrowingHtml({
      user,
      note: "n",
      rows: [{ name: "R", age: 2.6, tags: [] }],
      ready: true,
      places: ["x"],
      count: 1.4,
      value: "abc",
      shape: { kind: "circle", r: 2 },
      result: { ok: true, value: "V" },
      label: "L",
      format: { separator: ";" },
      attrs: { title: "T", id: "I" },
    });
    expect(html).toContain(
      '<div><p>Ada</p><b title="Ada">Ada</b><p>Ada</p><b>Ada</b><b>Ada</b><p>Ada</p><p title="A" class="grown"',
    );
    expect(html).toContain('>30<b>Ada</b></p><p>C</p><a href="#a" data-json="{&quot;user&quot;');
    expect(html).toContain(
      '<span>t</span></a><ul><li>R-<s>3</s></li></ul><b title="1.4">1</b><u>1.4</u><i title="n">n</i><b>ABC</b><svg><circle r="2"></circle></svg><p>V</p><b>;;</b><ul><li><i>Ada</i></li></ul><p>Ada</p><p title="T" id="I">a</p><p>Ada</p><ul><li>Ada: x</li></ul><p>Adax</p><p>AdaL</p><p>1.4L</p></div>',
    );
  });

  it("renders the attributes it spreads, as Solid's types lack them, on the server", async () => {
    const html = await serverRender("Swatch", {
      colour: "red",
      turn: "rotate(45)",
      paint: { fill: "blue", id: "end" },
      order: 2,
    });
    const tag = (name: string, nth = 0) =>
      [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "g"))][nth]![0].replace(
        / data-hk="[^"]*"/,
        "",
      );
    expect(tag("linearGradient")).toBe(
      '<linearGradient id="swatch-fill" opacity="0.5" transform="rotate(45)">',
    );
    expect(tag("stop")).toBe('<stop offset="0" fill="red">');
    expect(tag("stop", 1)).toBe('<stop fill="blue" id="end">');
    expect(tag("mpath")).toBe('<mpath href="#swatch-path">');
    expect(tag("dialog")).toBe('<dialog open tabindex="2">');
  });
});
