// Composition in Astro's shape (ADR-0053, ADR-0054, `src/composition.ts`): the files a source's
// components emit, formatted as the compiler writes them. The corpus checks the same shapes
// through every layer; these pin each one on a source of its own.
import { formatOutput } from "@unframework/codegen";
import { describe, expect, it } from "vitest";

import { emitSource } from "./source.ts";

/** Each file a source's components emit, formatted, by path. */
async function outputs(source: string, file: string): Promise<Record<string, string>> {
  const entries = await Promise.all(
    emitSource(source, file).map(async (output) => {
      const { file: formatted, error } = await formatOutput(output);
      if (error) throw new Error(error);
      return [output.path, formatted.contents] as const;
    }),
  );
  return Object.fromEntries(entries);
}

describe("composition (ADR-0054)", () => {
  it("writes slots as `<slot>`, scoped slots as render props, and forwarding as one branch per set of slots present (ADR-0054)", async () => {
    const source = [
      'import { defineSlots } from "unframework";',
      'import type { Element } from "unframework";',
      "",
      "function List({ items }: { items: string[] }) {",
      "  const slots = defineSlots<{ title?(): Element; item?(props: { item: string }): Element }>();",
      "  return (",
      "    <section>",
      "      {slots.title ? <h2>{slots.title?.()}</h2> : null}",
      "      <ul>",
      "        {items.map((item) => (",
      "          <li key={item}>{slots.item?.({ item }) ?? item}</li>",
      "        ))}",
      "      </ul>",
      "    </section>",
      "  );",
      "}",
      "",
      "function Frame() {",
      "  const slots = defineSlots<{ title?(): Element; item?(props: { item: string }): Element }>();",
      '  return <List items={["a"]}>{{ title: slots.title, item: slots.item }}</List>;',
      "}",
      "",
      "export default function Page() {",
      "  return (",
      "    <div>",
      '      <List items={["a", "b"]}>',
      "        {{ title: () => <>Letters</>, item: ({ item }) => <b>{item}</b> }}",
      "      </List>",
      "      <Frame />",
      "    </div>",
      "  );",
      "}",
    ].join("\n");
    expect(await outputs(source, "Slots.uf.tsx")).toEqual({
      "List.astro":
        [
          "---",
          "interface Props {",
          "  items: string[];",
          "  item?: (props: { item: string }) => unknown;",
          "  class?: string;",
          "  style?: Record<string, string | number | undefined>;",
          "}",
          "",
          "const { items, item: item_1, class: className, style } = Astro.props;",
          "---",
          "",
          "<section class:list={[className]} style={style}>",
          '  {Astro.slots.has("title") ? (',
          "    <h2>",
          '      <slot name="title" />',
          "    </h2>",
          "  ) : null}",
          "  <ul>",
          "    {items.map((item) => (",
          "      <li>",
          "        {item_1 ? item_1({ item }) : (",
          "          <>{item}</>",
          "        )}",
          "      </li>",
          "    ))}",
          "  </ul>",
          "</section>",
        ].join("\n") + "\n",
      "Frame.astro":
        [
          "---",
          'import List from "./List.astro";',
          "",
          "interface Props {",
          "  item?: (props: { item: string }) => unknown;",
          "  class?: string;",
          "  style?: Record<string, string | number | undefined>;",
          "}",
          "",
          "const { item, class: className, style } = Astro.props;",
          "---",
          "",
          '{Astro.slots.has("title") ? (',
          '  <List items={["a"]} class:list={[className]} style={style} item={item}>',
          '    <slot name="title" slot="title" />',
          "  </List>",
          ") : (",
          '  <List items={["a"]} class:list={[className]} style={style} item={item} />',
          ")}",
        ].join("\n") + "\n",
      "Page.astro":
        [
          "---",
          'import Frame from "./Frame.astro";',
          'import List from "./List.astro";',
          "",
          "interface Props {",
          "  class?: string;",
          "  style?: Record<string, string | number | undefined>;",
          "}",
          "",
          "const { class: className, style } = Astro.props;",
          "---",
          "",
          "<div class:list={[className]} style={style}>",
          '  <List items={["a", "b"]} item={({ item }) => <b>{item}</b>}>',
          '    <Fragment slot="title">Letters</Fragment>',
          "  </List>",
          "  <Frame />",
          "</div>",
        ].join("\n") + "\n",
    });
  });

  it("renders a model as a prop with its default, and each control's model as its initial state (ADR-0054)", async () => {
    const source = [
      'import { defineModel, ref } from "unframework";',
      "",
      "export default function Form() {",
      '  const size = ref("m");',
      "  const agreed = ref(true);",
      '  const note = ref("Hi");',
      '  const count = defineModel<number>("count", { default: 1 });',
      "  return (",
      "    <form>",
      "      <select v-model={size.value}>",
      '        <option value="s">Small</option>',
      '        <option value="m">Medium</option>',
      "      </select>",
      '      <input type="checkbox" v-model={agreed.value} />',
      "      <textarea v-model={note.value} />",
      "      <output>{count.value}</output>",
      "    </form>",
      "  );",
      "}",
    ].join("\n");
    expect(await outputs(source, "Models.uf.tsx")).toEqual({
      "Form.astro":
        [
          "---",
          "interface Props {",
          "  count?: number;",
          "  class?: string;",
          "  style?: Record<string, string | number | undefined>;",
          "}",
          "",
          "const { count = 1, class: className, style } = Astro.props;",
          "",
          'const size = "m" as string;',
          "const agreed = true as boolean;",
          'const note = "Hi" as string;',
          "---",
          "",
          "<form class:list={[className]} style={style}>",
          "  <select>",
          '    <option value="s" selected={size === "s"}>Small</option>',
          '    <option value="m" selected={size === "m"}>Medium</option>',
          "  </select>",
          '  <input type="checkbox" checked={agreed} />',
          "  <textarea>{note}</textarea>",
          "  <output>{count}</output>",
          "</form>",
        ].join("\n") + "\n",
    });
  });

  it("injects the fallback, hoists `<component is>` as a constant, renders itself as `Astro.self`, and takes no fallthrough without `inheritAttrs` (ADR-0053, ADR-0054)", async () => {
    const source = [
      'import { defineOptions, inject, ref } from "unframework";',
      'import type { InjectionKey } from "unframework";',
      "",
      'export const LocaleKey: InjectionKey<string> = Symbol("uf.locale");',
      "",
      'export default function Tree({ depth, tag }: { depth: number; tag: "h2" | "h3" }) {',
      "  defineOptions({ inheritAttrs: false });",
      '  const locale = inject(LocaleKey, "en");',
      "  const big = ref(true);",
      "  return (",
      "    <>",
      '      <component is={big.value ? tag : "p"} lang={locale}>{depth}</component>',
      "      {depth > 0 ? <Tree depth={depth - 1} tag={tag} /> : null}",
      "    </>",
      "  );",
      "}",
    ].join("\n");
    expect(await outputs(source, "Other.uf.tsx")).toEqual({
      "Tree.astro":
        [
          "---",
          "export type LocaleKey = string;",
          "",
          "interface Props {",
          "  depth: number;",
          '  tag: "h2" | "h3";',
          "}",
          "",
          "const { depth, tag } = Astro.props;",
          "",
          'const locale = "en" as LocaleKey;',
          "const big = true as boolean;",
          "",
          'const Tag = big ? tag : "p";',
          "---",
          "",
          "<Tag lang={locale}>{depth}</Tag>",
          "{depth > 0 ? (",
          "  <Astro.self depth={depth - 1} tag={tag} />",
          ") : null}",
        ].join("\n") + "\n",
    });
  });

  it("extends a props type named `Props` under another name, to add the fallthrough", async () => {
    const source = [
      "interface Props {",
      "  label: string;",
      "}",
      "",
      "export default function Tag({ label }: Props) {",
      "  return <span>{label}</span>;",
      "}",
    ].join("\n");
    expect(await outputs(source, "Tag.uf.tsx")).toEqual({
      "Tag.astro": [
        "---",
        "interface OwnProps {",
        "  label: string;",
        "}",
        "",
        "interface Props extends OwnProps {",
        "  class?: string;",
        "  style?: Record<string, string | number | undefined>;",
        "}",
        "",
        "const { label, class: className, style } = Astro.props;",
        "---",
        "",
        "<span class:list={[className]} style={style}>{label}</span>",
        "",
      ].join("\n"),
    });
  });
});
