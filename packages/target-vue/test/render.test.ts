// What the Vue output renders for props (design §1.1, ADR-0034), compiled as @vitejs/plugin-vue
// compiles it, for a production build (the template inlined into `setup`) and under a dev server
// (a separate render function), and rendered by Vue's server renderer, failing on any warning.
// The render-parity kit compares every target with the reference evaluator; these pin what is
// Vue's own: how its props declaration treats absent, `undefined` and `null` values, and the
// names its template compiler reads as globals.
import { afterAll, describe, expect, it } from "vitest";

import { emitSource, removeScratch, renderSfc } from "./helpers.ts";

afterAll(removeScratch);

describe.each([{ inline: true }, { inline: false }])("vue props (inline: $inline)", (mode) => {
  const render = async (source: string, props: Record<string, unknown>) =>
    renderSfc(await emitSource(source), props, mode);

  const flags = `
export default function Flags({ on, off = false, label }: { on?: boolean; off?: boolean; label?: string }) {
  return <p>{on === undefined ? "unset" : String(on)} {String(off)} {label ?? "none"}</p>;
}`;

  // Vue casts an absent `Boolean` prop that has no default to `false`; the output gives every
  // optional prop a default, so it stays `undefined` as on every other target.
  it("leaves an absent optional boolean undefined, and gives a default when one is absent", async () => {
    expect(await render(flags, {})).toBe("<p>unset false none</p>");
    expect(await render(flags, { on: true, off: true, label: "x" })).toBe("<p>true true x</p>");
  });

  it("takes the default for an explicit `undefined`, and keeps `null` as a value", async () => {
    expect(await render(flags, { on: undefined, off: undefined, label: undefined })).toBe(
      "<p>unset false none</p>",
    );
    const nullable = `
export default function Nullable({ note = null, size }: { note?: string | null; size?: number | null }) {
  return <p>{note === null ? "null" : note} {size === null ? "null" : size === undefined ? "unset" : size}</p>;
}`;
    expect(await render(nullable, {})).toBe("<p>null unset</p>");
    expect(await render(nullable, { note: null, size: null })).toBe("<p>null null</p>");
    expect(await render(nullable, { note: "a", size: 0 })).toBe("<p>a 0</p>");
  });

  it("gives the object form's absent optional boolean no value either", async () => {
    const source = `
export default function Flag(props: { on?: boolean; label: string }) {
  return <p>{props.label} {props.on === undefined ? "unset" : String(props.on)}</p>;
}`;
    expect(await render(source, { label: "a" })).toBe("<p>a unset</p>");
    expect(await render(source, { label: "a", on: false })).toBe("<p>a false</p>");
  });

  it("renders array and object defaults, a fresh value for each instance", async () => {
    const source = `
export default function Tags({ tags = ["a", "b"], meta = { by: "x" } }: { tags?: readonly string[]; meta?: { by: string } }) {
  return <p>{tags.join("+")} {meta.by}</p>;
}`;
    expect(await render(source, {})).toBe("<p>a+b x</p>");
    expect(await render(source, { tags: [], meta: { by: "y" } })).toBe("<p> y</p>");
  });

  it("declares props it does not read, so they never fall through to the root", async () => {
    const source = `
export default function Quiet({ shown }: { shown: string; hidden: string; tone?: string }) {
  return <p>{shown}</p>;
}`;
    expect(await render(source, { shown: "a", hidden: "b", tone: "c" })).toBe("<p>a</p>");
    const none = `
export default function None(props: { hidden: string; tone?: string }) {
  return <p>none</p>;
}`;
    expect(await render(none, { hidden: "b", tone: "c" })).toBe("<p>none</p>");
  });

  it("reads a prop named after a template global, not the global", async () => {
    const source = `
export default function Legend({ Map, label }: { Map: string; label: string }) {
  return <p title={Map + label}>{Map}|{Map + label}|{String(Map)}|{JSON.stringify({ Map })}</p>;
}`;
    expect(await render(source, { Map: "m", label: "l" })).toBe(
      '<p title="ml">m|ml|m|{&quot;Map&quot;:&quot;m&quot;}</p>',
    );
  });

  // Why the target renames such a prop: written as the source names it, Vue's template
  // compiler leaves the name unprefixed in any expression but a lone identifier
  // (compiler-core's `canPrefix`), and the expression reads the global.
  it("would read the global with the prop declared under its own name", async () => {
    const contents = [
      '<script setup lang="ts">',
      "const { Map, label } = defineProps<{ Map: string; label: string }>();",
      "</script>",
      "",
      "<template>",
      "  <p>{{ Map }}|{{ Map + label }}</p>",
      "</template>",
      "",
    ].join("\n");
    expect(await renderSfc(contents, { Map: "m", label: "l" }, mode)).toBe(
      "<p>m|function Map() { [native code] }l</p>",
    );
  });
});
