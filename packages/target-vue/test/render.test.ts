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

  // Vue's compiler parses a static `style` again and splits at a `;` inside a string: the
  // output binds such a declaration, whose value Vue then writes whole.
  it("renders static declarations its style parser would misread", async () => {
    const source = `
export default function Quote({ tone }: { tone: string }) {
  return <p style='font-family: "A;B", serif; margin: 0; content: ")" "("'><b style={{ quotes: '";" ";"', color: tone }}>Q</b></p>;
}`;
    expect(await render(source, { tone: "red" })).toBe(
      '<p style="margin:0;font-family:&quot;A;B&quot;, serif;content:&quot;)&quot; &quot;(&quot;;"><b style="quotes:&quot;;&quot; &quot;;&quot;;color:red;">Q</b></p>',
    );
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

  // An optional prop nothing reads is bound under `_name`, a prefix Vue keeps for its own
  // names. Vue compiles the pattern away, so no local meets the parameters and helpers its
  // compiled code declares, for the server or for the DOM.
  it.each([true, false])(
    "renders unread props whose local is named like Vue's own (server: %s)",
    async (ssr) => {
      const source = `
export default function Internals({ label, items, cache = 1, openBlock = false }: { label: string; items: string[]; ctx?: string; cache?: number; push?: string; parent?: string; attrs?: string; openBlock?: boolean; createElementBlock?: string; toDisplayString?: string; normalizeClass?: string; renderList?: string; createCommentVNode?: string; mergeProps?: string; defineComponent?: string; ssrRenderAttrs?: string; ssrRenderClass?: string; ssrRenderList?: string; ssrInterpolate?: string }) {
  return <ul class={label}>{items.map((item) => <li key={item}>{item}</li>)}{label === "a" && <li>{label}</li>}</ul>;
}`;
      const emitted = await emitSource(source);
      expect(emitted).toContain("  ctx: _ctx = undefined,\n  cache: _cache = 1,\n");
      const rendered = (props: Record<string, unknown>) =>
        renderSfc(emitted, props, { ...mode, ssr });
      const html = '<ul class="a"><!--[--><li>x</li><!--]--><li>a</li></ul>';
      expect(await rendered({ label: "a", items: ["x"] })).toBe(html);
      expect(
        await rendered({
          label: "a",
          items: ["x"],
          ctx: "c",
          cache: 2,
          openBlock: true,
          attrs: "t",
        }),
      ).toBe(html);
    },
  );

  // Vue's compiled `setup` declares `__props`: the object is renamed, or the script would not
  // compile ("Identifier '__props' has already been declared").
  it("renders the object form under a name Vue's compiled code declares", async () => {
    const source = `
export default function Byline(__props: { author: string; note?: string }) {
  return <p title={__props.note}>{__props.author}</p>;
}`;
    expect(await render(source, { author: "Ada" })).toBe("<p>Ada</p>");
    expect(await render(source, { author: "Ada", note: "n" })).toBe('<p title="n">Ada</p>');
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
