// Every fix applies with every other that can meet it, and leaves exactly the diagnostics that
// had none (design §2, the harness's L1): fixes never overlap, never change what renders, and
// never reveal or reword another diagnostic.
import { describe, expect, it } from "vitest";

import { applyAndRecheck, codes, component } from "./helpers.ts";
import { random } from "./random.ts";

const PROPS = [
  "label: string",
  "count: number",
  "on: boolean",
  "maybe?: string",
  "items: string[]",
  "rows: { id: string; name: string }[]",
  "attrs: { id?: string; title: string }",
  "index?: number",
].join("; ");

/** Applies the fixes of a component that returns `jsx`, and returns the fixed JSX. */
function fixed(jsx: string, options: { setup?: string } = {}): string {
  const { source, diagnostics } = component(jsx, { props: PROPS, ...options });
  expect(
    diagnostics.some((diagnostic) => diagnostic.fixes?.length),
    jsx,
  ).toBe(true);
  const result = applyAndRecheck(source, diagnostics);
  return result.slice(result.indexOf("return ") + 7, result.lastIndexOf("; }"));
}

describe("fixes that meet", () => {
  it.each([
    // An attribute's rename beside its other fixes.
    ['<p className={"a"} />', '<p class={"a"} />'],
    ['<p KEY="k" className="x" />', '<p class="x" />'],
    ['<input DISABLED={true} type="text" />', '<input disabled={true} type="text" />'],
    // A list's key beside its element's other fixes.
    [
      '<ul>{items.map((item) => <li className="x">{item}</li>)}</ul>',
      '<ul>{items.map((item, index2) => <li key={index2} class="x">{item}</li>)}</ul>',
    ],
    [
      '<ul>{items.map((item) => <li class="">{item}</li>)}</ul>',
      "<ul>{items.map((item, index2) => <li key={index2}>{item}</li>)}</ul>",
    ],
    // A list read through `?.`, whose callback's parameter its JSX reads.
    [
      "<ul>{items?.map((item) => <li key={item}>{item}</li>)}</ul>",
      "<ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>",
    ],
    [
      '<ul>{index?.map((item) => <li className="x" key={item}>{item}</li>)}</ul>',
      '<ul>{index?.map((item) => <li class="x" key={item}>{item}</li>)}</ul>',
    ],
    // A key in another case beside the element's other fixes.
    [
      '<ul>{items.map((item) => <li KEY={item} className="x">{item}</li>)}</ul>',
      '<ul>{items.map((item) => <li key={item} class="x">{item}</li>)}</ul>',
    ],
    // A class named twice beside a literal's spelling.
    ['<p class={"a b a"} />', '<p class="a b" />'],
    // Nullish operators beside the fixes of what they read.
    ['<p>{items.sort().join() ?? "x"}</p>', "<p>{items.toSorted().join()}</p>"],
    ["<p>{items?.sort().join()}</p>", "<p>{items.toSorted().join()}</p>"],
    ["<p>{(count + 0x10)?.toFixed()}</p>", "<p>{(count + 16).toFixed()}</p>"],
    // Literal spellings in one expression.
    [
      '<p>{"\\u{1F600}" + 0b1 + items.reverse()}</p>',
      '<p>{"\\uD83D\\uDE00" + 1 + items.toReversed()}</p>',
    ],
    // A block-bodied arrow around expressions with fixes of their own.
    [
      "<p>{items.filter((item) => { return item !== 0x1; }).join()}</p>",
      "<p>{items.filter((item) => item !== 1).join()}</p>",
    ],
    [
      "<p>{items.map((item) => { return { item, n: 0o7 }; }).length}</p>",
      "<p>{items.map((item) => ({ item, n: 7 })).length}</p>",
    ],
    // An unread parameter beside fixes in the body.
    [
      "<p>{items.filter((item, index2) => item.sort?.()).length}</p>",
      "<p>{items.filter((item) => item.toSorted()).length}</p>",
    ],
    // A directive comment beside other fixes.
    ['<p>{label /* eslint-disable */ ?? "x"}</p>', '<p>{label  ?? "x"}</p>'],
    // A style's key, and its value.
    ['<p style={{ "margin-top": 4 }} />', '<p style={{ marginTop: "4px" }} />'],
    // A returned conditional, and its content.
    ['on ? <p className="x" /> : null', '<>{on ? <p class="x" /> : null}</>'],
    // A class's conditional part beside its other parts.
    [
      '<p class={["a", on && label, count ? "b" : "c"]} />',
      '<p class={["a", on ? label : undefined, count ? "b" : "c"]} />',
    ],
  ])("fixes %s", (jsx, expected) => {
    expect(fixed(jsx)).toBe(expected);
  });

  it("removes a directive whose expression another fix would otherwise remove", () => {
    // The right side of `??` holds a reported comment, so `??` keeps its right side.
    const { source, diagnostics } = component('<p>{label ?? /* eslint-disable */ "x"}</p>', {
      props: PROPS,
    });
    expect(codes(diagnostics)).toEqual(["UF3023", "UF1002"]);
    expect(diagnostics[0]!.fixes).toBeUndefined();
    applyAndRecheck(source, diagnostics);
  });
});

/**
 * Pieces of components that the analyser reports, with and without fixes, and that it accepts:
 * attributes, children and expressions. Any mix of them must recompile clean once fixed.
 */
const ATTRIBUTES = [
  'className="a"',
  'title={"t"}',
  "title={null}",
  'title={"a&b"}',
  'class={["a", "b"]}',
  'class={["a", on && label]}',
  "class={{ a: on, b: true }}",
  "class={[]}",
  'class=""',
  'class={"  "}',
  'style={{ "margin-top": "1px" }}',
  "style={{ marginTop: 4 }}",
  'style=""',
  "style={{}}",
  'style="color: red"',
  'style={"color: red"}',
  'STYLE="color: blue"',
  "{...attrs}",
  '{...{ id: "x" }}',
  "{...{ title: label }}",
  'key="k"',
  "key={label}",
  'tabindex="01"',
  "tabindex={0}",
  "tabindex={-1}",
  'aria-hidden="yes"',
  "aria-hidden={false}",
  "aria-hidden={true}",
  'id="a"',
  'ID="b"',
  "data-x={on}",
  'title={label ?? "x"}',
  "title={0x1}",
  'xlink:href="#a"',
  'href="#b"',
  "disabled={true}",
  'disabled={"disabled"}',
  "hidden={false}",
  'rows={"03"}',
  'viewbox="0 0 1 1"',
  'strokeWidth="2"',
  'role="buton"',
  'title="{{ a }}"',
  'data-x={"{{ b }}"}',
];

const CHILDREN = [
  "text",
  " ",
  '{" "}',
  '{"\\n"}',
  "{label}",
  "{label ?? count}",
  "{items.sort().join()}",
  "{0x1F + count}",
  '{"\\u{41}" + label}',
  "{on && <b>x</b>}",
  "{on && null}",
  "{maybe || <b>y</b>}",
  "{items.map((item) => <i>{item}</i>)}",
  '{items.map((item) => <i key="k">{item}</i>)}',
  "{items.map(item => { return <li>{item}</li>; })}",
  "{rows.map((row, i) => <i key={row.id}>{row.name}</i>)}",
  "{rows.map((row) => <i key={label}>{row.name}</i>)}",
  '{rows.map((row, i) => <tr className="r"><td>{i}</td></tr>)}',
  "{items.map((label) => <i key={label} />)}",
  "{items?.map((item) => <i key={item}>{item}</i>)}",
  '{attrs.id?.split(" ").map((part) => <i key={part}>{part}</i>)}',
  "{items.map((item) => <i KEY={item}>{item}</i>)}",
  '{items.map((item) => <i Key="k">{item}</i>)}',
  "{items.map((as) => <i key={as}>{as}</i>)}",
  "{items.map((item) => <b>{item}</b>).length}",
  '<i class="a b a" />',
  '<iframe title="t">a</iframe>',
  "{maybe && <b>{maybe?.length}</b>}",
  "{attrs.id && <b title={attrs.id ?? label}>x</b>}",
  "{maybe && on ? <b>{maybe.trim()}</b> : <i />}",
  "{attrs.id && on ? <b title={attrs.id?.trim()}>x</b> : <i />}",
  "{(items ?? []).map((item, index2) => <i key={index2} />)}",
  "{items.filter((item, i) => item).join()}",
  "{items.filter((props) => props).length}",
  "{items.reverse?.()[0]}",
  "{label?.trim()}",
  "{count?.toFixed(0x2)}",
  "{lable}",
  "{true}",
  "a{null}b",
  '<b className="c">z</b>',
  "{on ? <b>a</b> : null}",
  '{on ? <>{" "}</> : <b />}',
  '<>{label}<b className="x" /></>',
  "{/* eslint-disable */ label}",
  '<path d="M0 0" fill />',
  '<circle r="1" > </circle>',
  "<lineargradient />",
  "<g> </g>",
  "<text> {label} </text>",
  "<tr> <td>a</td></tr>",
  '<tbody>{" "}</tbody>',
  "<option> </option>",
  '<i style={{ margin: 0, marginTop: "1px" }} />',
  '<i class={["a", "a"]} />',
  '<i {...attrs} id="x" />',
  '<i title={null} title="x" />',
  '<i class="" class={[]} />',
  "<li key={label}>a</li>",
];

describe("random mixes of fixable pieces", () => {
  it.each([11, 12])(
    "recompile to exactly the diagnostics that have no fix (seed %i)",
    (seed) => {
      const next = random(seed);
      const pick = <T>(items: readonly T[]) => items[Math.floor(next() * items.length)]!;
      let checked = 0;
      for (let sample = 0; sample < 2000; sample++) {
        const attributes = Array.from({ length: Math.floor(next() * 4) }, () => pick(ATTRIBUTES));
        const children = Array.from({ length: Math.floor(next() * 5) }, () => pick(CHILDREN));
        const tag = pick(["p", "div", "a", "svg", "pre", "select", "table", "ul", "button"]);
        const jsx = `<${tag} ${attributes.join(" ")}>${children.join("")}</${tag}>`;
        const { source, diagnostics } = component(jsx, { props: PROPS });
        if (!diagnostics.some((diagnostic) => diagnostic.fixes?.length)) continue;
        applyAndRecheck(source, diagnostics);
        checked++;
      }
      expect(checked).toBeGreaterThan(1500);
    },
    60_000,
  );
});
