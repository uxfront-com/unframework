// Scoped styles on Qwik (ADR-0063): the sheet's `?inline` import and `useStyles$`, the child-root
// rule through the inline `scopeAttributes` helper, and the names a source's components claim
// apart. Rendered by Qwik in ./ssr/styles.test.ts.
import { describe, expect, it } from "vitest";

import { BUTTON, lowered, output } from "./styles.ts";

describe("qwik scoped styles", () => {
  it("imports a styled component's sheet after its other imports, and attaches it first", async () => {
    const { module } = lowered(
      "Card.uf.tsx",
      `import "./Card.css";
export default function Card() {
  return <p class="label">Hi</p>;
}`,
      { "./Card.css": ".label { color: red; }\n" },
    );
    const code = await output(module);
    expect(code.split("\n\n")[0]).toBe(
      [
        "import {",
        "  type CSSProperties,",
        "  type ClassList,",
        "  type PropsOf,",
        "  component$,",
        "  useStyles$,",
        '} from "@qwik.dev/core";',
        'import styles from "./Card.uf.tsx.css?inline";',
      ].join("\n"),
    );
    expect(code).toContain("=> {\n  useStyles$(styles);\n\n  return (");
    expect(await output(lowered("Button.uf.tsx", BUTTON).module)).not.toMatch(/useStyles|\.css/);
  });

  // A root that takes what falls through spreads the props' rest, which holds them (ADR-0118).
  it("spreads the scope attributes its styled parents pass on its root", async () => {
    const code = await output(lowered("Button.uf.tsx", BUTTON).module);
    expect(code).toContain("({ text, class: className, style, ...attributes })");
    expect(code).toContain(
      '<button type="button" class={["button", className]} style={style} {...attributes}>',
    );
    expect(code).not.toContain("scopeAttributes");
  });

  it("picks them out of the props object in the object form", async () => {
    const code = await output(
      lowered(
        "Tag.uf.tsx",
        `export default function Tag(props: { label: string }) {
  return <span class="tag">{props.label}</span>;
}`,
      ).module,
    );
    expect(code).toContain(
      "const { label: _label, class: _class, style: _style, ...attributes } = props;",
    );
    expect(code).toContain("{...attributes}");
    const branches = await output(
      lowered(
        "Tag.uf.tsx",
        `export default function Tag(props: { label: string }) {
  return <>{props.label ? <span class="tag">{props.label}</span> : <i>None</i>}</>;
}`,
      ).module,
    );
    expect(branches.match(/\{\.\.\.scopeAttributes\(props\)\}/g)).toHaveLength(2);
  });

  it("types the props of a component without any, so the rest destructures", async () => {
    const code = await output(
      lowered(
        "Toggle.uf.tsx",
        `export default function Toggle({ on }: { on: boolean }) {
  return <>{on ? <b>On</b> : <i>Off</i>}</>;
}`,
      ).module,
    );
    expect(code).toContain("({ on, ...attributes })");
    const bare = await output(
      lowered(
        "Bare.uf.tsx",
        `import { ref } from "@uxfront/unframework";
export default function Bare() {
  const on = ref(true);
  return <>{on.value ? <b>On</b> : <i>Off</i>}</>;
}`,
      ).module,
    );
    expect(bare).toContain("component$<object>(({ ...attributes }) =>");
  });

  it("spreads them on each candidate tag of a root `<component is>` with listeners", async () => {
    const code = await output(
      lowered(
        "Action.uf.tsx",
        `export default function Action({ plain }: { plain: boolean }) {
  return (
    <component
      is={plain ? "button" : "input"}
      type="button"
      aria-label="Go"
      onClick={() => console.log("go")}
    />
  );
}`,
      ).module,
    );
    expect(code.match(/\{\.\.\.scopeAttributes\(attributes\)\}/g)).toHaveLength(2);
  });

  // The unplugin joins a source's outputs into one module (ADR-0053): a prop that takes the
  // helper's name moves the first component's helper on, and the second must not take it too.
  it("names the helper of each component of a source apart", async () => {
    const { module } = lowered(
      "Two.uf.tsx",
      // Conditional roots, which take the helper: one root element spreads the rest instead.
      `export function Item({ scopeAttributes }: { scopeAttributes: string }) {
  return <>{scopeAttributes ? <li>{scopeAttributes}</li> : <li>None</li>}</>;
}
export default function Two({ open }: { open: boolean }) {
  return <>{open ? <ul><Item scopeAttributes="a" /></ul> : <p>Closed</p>}</>;
}`,
    );
    const helpers = async (index: number) =>
      [...(await output(module, index)).matchAll(/^function (\w+)\(/gm)].map((match) => match[1]);
    expect([await helpers(0), await helpers(1)]).toEqual([
      ["scopeAttributes_2"],
      ["scopeAttributes_1"],
    ]);
  });
});
