// `<Teleport to>` (ADR-0098): an authoring API written only as a tag, whose content, exactly one
// element, mounts into the element `to` selects. `to` is a static selector (UF3053), the content
// one element (UF3054), and every other misuse gets the code an element or a component would.
import { checkInvariants } from "@unframework.dev/ir";
import type { FragmentNode, IfNode, TeleportNode } from "@unframework.dev/ir";
import { describe, expect, it } from "vitest";

import { applyAndRecheck, only, problems, run } from "./helpers.ts";

const IMPORT = 'import { Teleport, ref } from "@uxfront/unframework";\n';

/** A module that imports `Teleport` and renders `jsx` from a component `A`. */
function source(jsx: string, setup = ""): string {
  return `${IMPORT}export function A() { ${setup}return ${jsx}; }`;
}

/** The diagnostics `jsx` gets, as `code text-at-span`. */
function reported(jsx: string, setup = ""): string[] {
  const text = source(jsx, setup);
  return problems(text, run(text).diagnostics);
}

describe("<Teleport>", () => {
  it("lowers to a Teleport node around its one element", () => {
    const text = source('<div><Teleport to="body"><p class="toast">Saved</p></Teleport></div>');
    const { module, diagnostics } = run(text);
    expect(diagnostics).toEqual([]);
    const [teleport] = (only(module).render as { children: TeleportNode[] }).children;
    expect(teleport!.kind).toBe("Teleport");
    expect(teleport!.to).toBe("body");
    expect(teleport!.children.map((child) => child.kind)).toEqual(["Element"]);
    expect(checkInvariants(module!)).toEqual([]);
  });

  it.each([`to={"#overlays"}`, "to={`#overlays`}", "to='#overlays'"])(
    "takes a static selector: %s",
    (to) => {
      const { module, diagnostics } = run(source(`<div><Teleport ${to}><p /></Teleport></div>`));
      expect(diagnostics).toEqual([]);
      const [teleport] = (only(module).render as { children: TeleportNode[] }).children;
      expect(teleport!.to).toBe("#overlays");
    },
  );

  it.each([
    [`to='[data-overlay="root"]'`, '[data-overlay="root"]'],
    ['to="#a &amp; b"', "#a & b"],
    ["to={'#a &amp; b'}", "#a &amp; b"],
  ])("reads %s as JSX reads it", (to, selector) => {
    const { module, diagnostics } = run(source(`<div><Teleport ${to}><p /></Teleport></div>`));
    expect(diagnostics).toEqual([]);
    const [teleport] = (only(module).render as { children: TeleportNode[] }).children;
    expect(teleport!.to).toBe(selector);
  });

  it("is recognised by its import's binding, so an alias is Teleport too", () => {
    const text = `import { Teleport as Portal } from "@uxfront/unframework";
export function A() { return <div><Portal to="body"><p /></Portal></div>; }`;
    const { module, diagnostics } = run(text);
    expect(diagnostics).toEqual([]);
    const [teleport] = (only(module).render as { children: TeleportNode[] }).children;
    expect(teleport!.kind).toBe("Teleport");
  });

  it("wraps a root teleport in a fragment, as a component root is", () => {
    const { module, diagnostics } = run(source('<Teleport to="body"><p /></Teleport>'));
    expect(diagnostics).toEqual([]);
    const render = only(module).render as FragmentNode;
    expect(render.kind).toBe("Fragment");
    expect(render.children.map((child) => child.kind)).toEqual(["Teleport"]);
  });

  it("sits in a conditional, which shows and hides the whole teleport", () => {
    const { module, diagnostics } = run(
      source(
        '<div>{open.value && <Teleport to="body"><p>{String(open.value)}</p></Teleport>}</div>',
        "const open = ref(false);\n",
      ),
    );
    expect(diagnostics).toEqual([]);
    const [condition] = (only(module).render as { children: IfNode[] }).children;
    expect(condition!.branches[0]!.children.map((child) => child.kind)).toEqual(["Teleport"]);
  });

  it("lowers the content's own content: text, conditionals and lists", () => {
    const { diagnostics } = run(
      source(
        '<div><Teleport to="body"><ul>{items.value.map((item) => <li key={item}>{item}</li>)}{items.value.length === 0 && <li>None</li>}</ul></Teleport></div>',
        "const items = ref<string[]>([]);\n",
      ),
    );
    expect(diagnostics).toEqual([]);
  });

  describe("UF3053, the target", () => {
    it.each([
      ["<div><Teleport to={target}><p /></Teleport></div>", "UF3053 to={target}"],
      ["<div><Teleport to={`#${target}`}><p /></Teleport></div>", "UF3053 to={`#${target}`}"],
      ['<div><Teleport to=""><p /></Teleport></div>', 'UF3053 to=""'],
      ['<div><Teleport to="  "><p /></Teleport></div>', 'UF3053 to="  "'],
      ["<div><Teleport to><p /></Teleport></div>", "UF3053 to"],
      ["<div><Teleport><p /></Teleport></div>", "UF3053 Teleport"],
    ])("rejects %s", (jsx, expected) => {
      expect(reported(jsx, 'const target = "body";\n')).toEqual([expected]);
    });
  });

  describe("UF3054, the content", () => {
    it.each([
      ['<div><Teleport to="body">Saved</Teleport></div>', "UF3054 Saved"],
      ['<div><Teleport to="body">{label}</Teleport></div>', "UF3054 {label}"],
      ['<div><Teleport to="body"><p /><p /></Teleport></div>', "UF3054 <p />"],
      ['<div><Teleport to="body"><p />text</Teleport></div>', "UF3054 text"],
      ['<div><Teleport to="body"><Child /></Teleport></div>', "UF3054 <Child />"],
      [
        '<div><Teleport to="body">{open.value && <p />}</Teleport></div>',
        "UF3054 {open.value && <p />}",
      ],
      [
        '<div><Teleport to="body"><component is="p" /></Teleport></div>',
        'UF3054 <component is="p" />',
      ],
      ['<div><Teleport to="body"><><p /></></Teleport></div>', "UF3054 <><p /></>"],
      [
        '<div><Teleport to="body"><Teleport to="body"><p /></Teleport></Teleport></div>',
        'UF3054 <Teleport to="body"><p /></Teleport>',
      ],
      ['<div><Teleport to="body"></Teleport></div>', "UF3054 Teleport"],
      ['<div><Teleport to="body" /></div>', "UF3054 Teleport"],
    ])("rejects %s", (jsx, expected) => {
      const text = `${IMPORT}function Child() { return <p />; }
export function A() { const label = "x"; const open = ref(false); return ${jsx}; }`;
      expect(problems(text, run(text).diagnostics)).toEqual([expected]);
    });

    it.each([
      '<p>a<Teleport to="body"><div>b</div></Teleport>c</p>',
      '<table><Teleport to="body"><div>b</div></Teleport></table>',
    ])("checks the element where the teleport is: %s", (jsx) => {
      expect(reported(jsx).map((each) => each.split(" ")[0])).toContain("UF3003");
    });

    it("keeps the whitespace JSX drops out of the content", () => {
      expect(reported('<div><Teleport to="body">\n  <p />\n</Teleport></div>')).toEqual([]);
    });
  });

  describe("the codes it reuses", () => {
    it("rejects an attribute other than `to` (UF3035)", () => {
      expect(reported('<div><Teleport to="body" disabled><p /></Teleport></div>')).toEqual([
        "UF3035 disabled",
      ]);
    });

    it("rejects `key` outside a list (UF3014), with its fix", () => {
      const text = source('<div><Teleport to="body" key="a"><p /></Teleport></div>');
      const { diagnostics } = run(text);
      expect(problems(text, diagnostics)).toEqual(["UF3014 key"]);
      expect(applyAndRecheck(text, diagnostics)).toContain('<Teleport to="body"><p />');
    });

    it("rejects `ref` (UF3046)", () => {
      expect(
        reported(
          '<div><Teleport to="body" ref={panel}><p /></Teleport></div>',
          "const panel = useTemplateRef<HTMLElement>();\n",
        ).map((each) => each.split(" ")[0]),
      ).toContain("UF3046");
    });

    it("rejects `to` set twice (UF3007)", () => {
      expect(reported('<div><Teleport to="body" to="#a"><p /></Teleport></div>')).toEqual([
        "UF3007 to",
      ]);
    });

    it("rejects a spread (UF1002)", () => {
      expect(
        reported('<div><Teleport {...{ to: "body" }}><p /></Teleport></div>').map(
          (each) => each.split(" ")[0],
        ),
      ).toEqual(["UF1002", "UF3053"]);
    });

    it("rejects a teleport as a list's element (UF1002)", () => {
      const codes = reported(
        '<ul>{items.value.map((item) => <Teleport key={item} to="body"><li /></Teleport>)}</ul>',
        "const items = ref<string[]>([]);\n",
      ).map((each) => each.split(" ")[0]);
      expect(codes).toContain("UF1002");
    });

    it("rejects a teleport inside an <svg> (UF1002)", () => {
      expect(
        reported('<svg><Teleport to="body"><p /></Teleport></svg>').map(
          (each) => each.split(" ")[0],
        ),
      ).toEqual(["UF1002"]);
    });

    it.each([
      ["called in the setup", 'Teleport({ to: "body" });\n', "<div />", "UF1002 Teleport"],
      [
        "called as a const's value",
        'const x = Teleport({ to: "body" });\n',
        "<div />",
        "UF1002 Teleport",
      ],
      ["read as a value", "", "<div>{String(Teleport)}</div>", "UF1002 Teleport"],
      [
        "called in a handler",
        "",
        '<button onClick={() => Teleport({ to: "body" })} />',
        "UF1002 Teleport",
      ],
    ])("rejects Teleport %s (UF1002)", (_, setup, jsx, expected) => {
      expect(reported(jsx, setup)).toEqual([expected]);
    });
  });

  it("makes a component whose root is a teleport take no class (UF3045)", () => {
    const text = `${IMPORT}function Toast() { return <Teleport to="body"><p /></Teleport>; }
export function A() { return <div><Toast class="x" /></div>; }`;
    expect(problems(text, run(text).diagnostics)).toEqual(["UF3045 class"]);
  });

  it("leaves a component named Teleport that is no import of it alone", () => {
    const text = `function Teleport() { return <p />; }
export function A() { return <div><Teleport /></div>; }`;
    const { module, diagnostics } = run(text);
    expect(diagnostics).toEqual([]);
    const [child] = (
      module!.components.find((each) => each.name === "A")!.render as {
        children: { kind: string }[];
      }
    ).children;
    expect(child!.kind).toBe("Component");
  });
});
