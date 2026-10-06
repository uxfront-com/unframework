import { describe, expect, it } from "vitest";

import { applyAndRecheck, codes, component, only, problems, root, run } from "./helpers.ts";

const PROPS =
  "items: { id: string; name: string }[]; tags: string[]; maybe?: string[]; label: string; index?: number";

/** A list of dishes in a list of groups, the dishes keyed by `key`. */
const nestedList = (key: string): string =>
  `<ul>{groups.map((group) => <li key={group.id}><ol>{group.dishes.map((dish, d) => <li key={${key}}>{dish}</li>)}</ol></li>)}</ul>`;

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

  // Filtering would drop the items that render the other element: the help keeps every item.
  it.each([
    ["{items.map((item) => item.id ? <li key={item.id}>a</li> : null)}", "Filter the list first"],
    [
      "{items.map((item) => item.id ? <a key={item.id} href={item.id}>a</a> : <span key={item.name}>a</span>)}",
      "Move the conditional into one keyed element",
    ],
    ["{items.map((item) => <><li key={item.id}>a</li></>)}", "Wrap the elements in one element"],
    [
      "{items.map((item) => { const x = 1; return <li key={item.id}>{x}</li>; })}",
      "Remove the other statements",
    ],
  ])("helps with the body of %s", (children, help) => {
    const { diagnostics } = component(`<ul>${children}</ul>`, { props: PROPS });
    const found = diagnostics.find((diagnostic) => diagnostic.code === "UF3015");
    expect(found?.help).toContain(help);
  });

  it("names the parts of an item a callback destructures as an array", () => {
    const { diagnostics } = component(
      "<dl>{Object.entries(specs).map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>",
      { props: "specs: { weight: string; colour: string }" },
    );
    expect(diagnostics[0]!.code).toBe("UF3015");
    expect(diagnostics[0]!.help).toContain("`entry[0]`");
  });

  // TypeScript types an entry's `entry[0]` as a string; the model, which cannot, trusts it.
  it("keys a list over `Object.entries` by the entry's name", () => {
    const { diagnostics } = component(
      "<dl>{Object.entries(specs).map((entry) => <div key={entry[0]}><dt>{entry[0]}</dt><dd>{entry[1]}</dd></div>)}</dl>",
      { props: "specs: { weight: string; colour: string }" },
    );
    expect(diagnostics).toEqual([]);
    // An index into a known array still adds `undefined`, as `noUncheckedIndexedAccess` does.
    expect(
      codes(
        component("<ul>{rows.map((row) => <li key={row[0]}>x</li>)}</ul>", {
          props: "rows: string[][]",
        }).diagnostics,
      ),
    ).toEqual(["UF3018"]);
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

  it("reports a key that reads the item of a list around it (UF3018): Angular's `track` cannot", () => {
    const props = "groups: { id: string; dishes: string[] }[]; label: string";
    const { source, diagnostics } = component(nestedList("group.id + dish"), { props });
    expect(problems(source, diagnostics)).toEqual(["UF3018 group.id + dish"]);
    expect(diagnostics[0]!.message).toContain("within its own list");
    expect(diagnostics[0]!.help).toBe("Key the element by its own item: `key={dish.id}`.");
    expect(component(nestedList("label + dish + d"), { props }).diagnostics).toEqual([]);
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

// `source?.map(…)` is a list too (oxc wraps it in a ChainExpression): its `?.` does nothing on a
// source that is never nullish (UF3023), and a list cannot render a nullish one (UF3018), which
// `(source ?? []).map(…)` renders alike. Either fix leaves the list, which lowers.
describe("a list read through `?.`", () => {
  it.each([
    [
      "{tags?.map((tag) => <li key={tag}>{tag}</li>)}",
      ["UF3023 ?."],
      "{tags.map((tag) => <li key={tag}>{tag}</li>)}",
    ],
    [
      "{maybe?.map((tag) => <li key={tag}>{tag}</li>)}",
      ["UF3018 maybe"],
      "{(maybe ?? []).map((tag) => <li key={tag}>{tag}</li>)}",
    ],
    // A `?.` in the source ends the whole chain, `.map` included: React, Qwik and Astro would
    // call `.map` on `undefined`, where the other targets render an empty list.
    [
      "{maybe?.slice(0, 2).map((tag) => <li key={tag}>{tag}</li>)}",
      ["UF3018 maybe?.slice(0, 2)"],
      "{(maybe?.slice(0, 2) ?? []).map((tag) => <li key={tag}>{tag}</li>)}",
    ],
    [
      '{items[0]?.name.split(" ").map((part) => <li key={part}>{part}</li>)}',
      ['UF3018 items[0]?.name.split(" ")'],
      '{(items[0]?.name.split(" ") ?? []).map((part) => <li key={part}>{part}</li>)}',
    ],
    // `.map?.(…)`: an array's `map` is always there.
    [
      "{tags.map?.((tag) => <li key={tag}>{tag}</li>)}",
      ["UF3023 ?."],
      "{tags.map((tag) => <li key={tag}>{tag}</li>)}",
    ],
  ])("reports %s, and the fix lowers it", (children, expected, fixed) => {
    const { source, diagnostics } = component(`<ul>${children}</ul>`, { props: PROPS });
    expect(problems(source, diagnostics)).toEqual(expected);
    const result = applyAndRecheck(source, diagnostics);
    expect(result).toContain(fixed);
    const { list } = listOf(fixed);
    expect(list.kind).toBe("For");
  });

  it("reports it as a list, not as JSX in a value or a parameter nothing reads", () => {
    const { source, diagnostics } = component(
      "<ul>{maybe?.map((tag) => <li key={tag}>{tag}</li>).filter(Boolean)}</ul>",
      { props: PROPS },
    );
    // Not a list (the callback's JSX is a value), but `tag` is read there: no UF3024.
    expect(codes(diagnostics).toSorted()).toEqual(["UF3012", "UF3016"]);
    expect(problems(source, diagnostics)).toContain("UF3012 <li key={tag}>{tag}</li>");
  });

  it("reports a returned `?.map`, with the fixes that lower it", () => {
    const source = `interface Props { ${PROPS} }\nexport function A({ tags }: Props) { return tags?.map((tag) => <li key={tag}>{tag}</li>); }`;
    const { diagnostics } = run(source);
    expect(codes(diagnostics)).toEqual(["UF1102", "UF3023"]);
    expect(applyAndRecheck(source, diagnostics)).toContain(
      "<>{tags.map((tag) => <li key={tag}>{tag}</li>)}</>",
    );
  });
});

// Only JSX's `key`, in lower case, keys an element: another case is an attribute in JSX.
describe("a key in another case", () => {
  it.each([
    ["{tags.map((tag) => <li KEY={tag}>{tag}</li>)}", "KEY"],
    ["{tags.map((tag) => <li Key={tag}>{tag}</li>)}", "Key"],
  ])("reports %s (UF3004), and the fix renames it", (children, at) => {
    const { source, diagnostics } = component(`<ul>${children}</ul>`, { props: PROPS });
    expect(problems(source, diagnostics)).toEqual([`UF3004 ${at}`]);
    expect(diagnostics[0]!.message).toContain("only JSX's `key`, in lower case");
    expect(applyAndRecheck(source, diagnostics)).toContain("<li key={tag}>");
  });

  it("keys a constant key in another case by its index, which writes `key`", () => {
    const { source, diagnostics } = component(
      '<ul>{tags.map((tag) => <li KEY="k">{tag}</li>)}</ul>',
      {
        props: PROPS,
      },
    );
    expect(problems(source, diagnostics)).toEqual(['UF3014 KEY="k"']);
    expect(applyAndRecheck(source, diagnostics)).toContain("<li key={index2}>");
  });

  it("reports a key set twice on a list's element (UF3007)", () => {
    const { source, diagnostics } = component(
      "<ul>{tags.map((tag) => <li key={tag} KEY={tag}>{tag}</li>)}</ul>",
      { props: PROPS },
    );
    expect(problems(source, diagnostics)).toEqual(["UF3007 KEY"]);
  });
});
