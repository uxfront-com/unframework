import { describe, expect, it } from "vitest";

import { applyAndRecheck, codes, component, only, problems, root } from "./helpers.ts";

const PROPS =
  "items: { id: string; name: string }[]; tags: string[]; maybe?: string[]; label: string; index?: number";

/** The For a component's `<ul>` holds, with the source. */
function listOf(children: string, props = PROPS) {
  const { source, module, diagnostics } = component(`<ul>${children}</ul>`, { props });
  expect(diagnostics).toEqual([]);
  const [list] = root(module).children;
  if (list?.kind !== "For") throw new Error("Expected a list.");
  return { source, list, component: only(module) };
}

describe("lists", () => {
  it("lowers a keyed list: its source, item, key and body, without the key", () => {
    const {
      source,
      list,
      component: lowered,
    } = listOf('{items.map((item) => <li key={item.id} class="row">{item.name}</li>)}');
    expect(list.source.code).toBe("items");
    expect(list.item).toBe(`item@${source.indexOf("item)")}`);
    expect(list.index).toBeUndefined();
    expect(list.key.code).toBe("item.id");
    expect(
      list.body.attributes.map((attribute) => attribute.kind === "Static" && attribute.name),
    ).toEqual(["class"]);
    expect(lowered.bindings.map((binding) => binding.kind)).toEqual([
      "prop",
      "prop",
      "prop",
      "prop",
      "prop",
      "loopVar",
    ]);
  });

  it("lowers an indexed list, and a block that only returns", () => {
    const { list } = listOf("{tags.map((tag, i) => { return <li key={i}>{i + 1}. {tag}</li>; })}");
    expect(list.index).toMatch(/^i@/);
    expect(list.key.code).toBe("i");
  });

  it("types the item and the index from the source", () => {
    // `item.name` is a string and `i` a number: `?.` and `??` on them do nothing.
    const { diagnostics } = component(
      '<ul>{items.map((item, i) => <li key={item.id}>{item.name ?? ""}{i?.toFixed()}</li>)}</ul>',
      { props: PROPS },
    );
    expect(codes(diagnostics)).toEqual(["UF3023", "UF3023"]);
  });

  it("nests lists, each item in scope in its own", () => {
    const { list } = listOf(
      "{items.map((item) => <li key={item.id}><ol>{tags.map((tag) => <li key={tag}>{item.name}{tag}</li>)}</ol></li>)}",
    );
    const inner = list.body.children[0];
    expect(inner?.kind === "Element" && inner.children[0]?.kind).toBe("For");
  });

  it.each([
    ["maybe", "Default it to an empty array"],
    ["label", "Render an array."],
  ])("reports a source that is not an array, %s (UF3018)", (source, help) => {
    const { diagnostics } = component(
      `<ul>{${source}.map((item) => <li key={item}>{item}</li>)}</ul>`,
      { props: PROPS },
    );
    expect(codes(diagnostics)).toEqual(["UF3018"]);
    expect(diagnostics[0]!.help).toContain(help);
  });

  it("accepts `(maybe ?? [])` as a source", () => {
    expect(
      component("<ul>{(maybe ?? []).map((item) => <li key={item}>{item}</li>)}</ul>", {
        props: PROPS,
      }).diagnostics,
    ).toEqual([]);
  });
});

describe("keys", () => {
  it("reports a list's element without a key, and keys it by its index (UF3013)", () => {
    const { source, diagnostics } = component("<ul>{tags.map((tag) => <li>{tag}</li>)}</ul>", {
      props: PROPS,
    });
    expect(problems(source, diagnostics)).toEqual(["UF3013 li"]);
    expect(diagnostics[0]!.fixes).toEqual([expect.objectContaining({ confidence: "likely" })]);
    expect(applyAndRecheck(source, diagnostics)).toContain(
      "tags.map((tag, index2) => <li key={index2}>{tag}</li>)",
    );
  });

  it.each([
    ["{tags.map(tag => <li>{tag}</li>)}", "tags.map((tag, index2) => <li key={index2}>"],
    ["{tags.map((tag, i) => <li>{tag}</li>)}", "tags.map((tag, i) => <li key={i}>"],
  ])("writes the index parameter the key needs in %s", (children, fixed) => {
    const { source, diagnostics } = component(`<ul>${children}</ul>`, { props: PROPS });
    expect(applyAndRecheck(source, diagnostics)).toContain(fixed);
  });

  it("takes an index name nothing in the component uses", () => {
    const { source, diagnostics } = component(
      "<ul>{tags.map((index3) => <li>{index3}</li>)}</ul>",
      { props: "tags: string[]", setup: "" },
    );
    expect(applyAndRecheck(source, diagnostics)).toContain("(index3, index) => <li key={index}>");
  });

  it('reports a constant `key="x"` on a list\'s element, and keys it by its index (UF3014)', () => {
    const { source, diagnostics } = component(
      '<ul>{tags.map((tag) => <li key="x">{tag}</li>)}</ul>',
      { props: PROPS },
    );
    expect(problems(source, diagnostics)).toEqual(['UF3014 key="x"']);
    expect(applyAndRecheck(source, diagnostics)).toContain("<li key={index2}>");
  });

  it.each([
    '<p key="k">a</p>',
    "<p key={label}>a</p>",
    "<ul>{label && <li key={label}>a</li>}</ul>",
  ])("reports the misplaced key in %s, and removes it (UF3014)", (jsx) => {
    const { source, diagnostics } = component(jsx, { props: PROPS });
    expect(codes(diagnostics)).toEqual(["UF3014"]);
    expect(applyAndRecheck(source, diagnostics)).not.toContain("key");
  });

  it.each([
    ["{label}", "The key must identify the item"],
    ['{"a"}', "The key must identify the item"],
    ["{1}", "The key must identify the item"],
    ["{item.id === label}", "A list's key is a string or a number"],
    ["{item}", "A list's key is a string or a number"],
  ])("reports the key %s (UF3018)", (key, message) => {
    const { diagnostics } = component(`<ul>{items.map((item) => <li key=${key}>a</li>)}</ul>`, {
      props: PROPS,
    });
    expect(codes(diagnostics)).toEqual(["UF3018"]);
    expect(diagnostics[0]!.message).toContain(message);
  });

  it("accepts a key that reads the item through a template", () => {
    expect(
      component("<ul>{items.map((item, i) => <li key={`${item.id}-${i}`}>a</li>)}</ul>", {
        props: PROPS,
      }).diagnostics,
    ).toEqual([]);
  });
});

describe("the list's shape (UF3015)", () => {
  it.each([
    ["{items.map(({ id }) => <li key={id}>a</li>)}", "{ id }"],
    ["{items.map((item, i, all) => <li key={i}>a</li>)}", "all"],
    ['{items.map(() => <li key="x">a</li>)}', '() => <li key="x">a</li>'],
    ["{items.map((item) => <><li key={item.id}>a</li></>)}", "<><li key={item.id}>a</li></>"],
    [
      "{items.map((item) => item.id ? <li key={item.id}>a</li> : null)}",
      "item.id ? <li key={item.id}>a</li> : null",
    ],
    [
      "{items.map(function (item) { return <li key={item.id}>a</li>; })}",
      "function (item) { return <li key={item.id}>a</li>; }",
    ],
    ["{items.map((item) => <li key={item.id}>a</li>, null)}", "(item) => <li key={item.id}>a</li>"],
  ])("reports %s", (children, at) => {
    const { source, diagnostics } = component(`<ul>${children}</ul>`, { props: PROPS });
    expect(problems(source, diagnostics)).toContain(`UF3015 ${at}`);
  });

  it("reads a `.map` without JSX as an expression, whose array does not render as text", () => {
    expect(
      codes(component("<p>{tags.map((tag) => tag.trim())}</p>", { props: PROPS }).diagnostics),
    ).toEqual(["UF3016"]);
  });

  it("reports a list parameter that shadows a prop or a list's item (UF3024)", () => {
    const shadowed = component("<ul>{tags.map((label) => <li key={label}>a</li>)}</ul>", {
      props: PROPS,
    });
    expect(problems(shadowed.source, shadowed.diagnostics)).toEqual(["UF3024 label"]);
    const nested = component(
      "<ul>{tags.map((tag) => <li key={tag}><ol>{tags.map((tag) => <li key={tag}>a</li>)}</ol></li>)}</ul>",
      { props: PROPS },
    );
    expect(codes(nested.diagnostics)).toEqual(["UF3024"]);
  });

  it("reports an annotated list parameter as not supported yet", () => {
    const { source, diagnostics } = component(
      "<ul>{tags.map((tag: string) => <li key={tag}>a</li>)}</ul>",
      { props: PROPS },
    );
    expect(problems(source, diagnostics)).toEqual(["UF1002 : string"]);
  });

  it("does not report a list's unread index: the targets leave it out", () => {
    expect(
      component("<ul>{tags.map((tag, i) => <li key={tag}>a</li>)}</ul>", { props: PROPS })
        .diagnostics,
    ).toEqual([]);
  });
});
