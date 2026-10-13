// Layer 2 of §5.6 (ADR-0055's UF3035 to UF3039): what a parent's compile checks against a
// child's API, with the name it may mean, and the fixes, which recompile clean.
import { parseModule } from "@unframework/parser";
import { describe, expect, it } from "vitest";

import { analyze } from "../src/index.ts";
import { applyAndRecheck, codes, problems, run } from "./helpers.ts";

const API =
  'import { defineEmits, defineModel, defineSlots, ref } from "unframework";\nimport type { Element } from "unframework";\n';

const CHILD = `${API}
function Field({ label, tone, size }: { label: string; tone?: "info" | "warning" | undefined; size?: 1 | 2 | 3 }) {
  const slots = defineSlots<{ default?(): Element; hint?(): Element }>();
  const emit = defineEmits<{ clear: [] }>();
  const open = defineModel<boolean>("open", { default: false });
  return (
    <div class={["field", tone]} data-size={size ?? 1}>
      <span>{label}</span>
      {slots.hint?.()}
      {slots.default?.()}
      <button type="button" onClick={() => emit("clear")}>{open.value ? "x" : "o"}</button>
    </div>
  );
}
`;

/** A parent of `Field` in the same module, returning `jsx`. */
function parent(jsx: string) {
  const source = `${CHILD}\nexport function Form() {\n  const open = ref(false);\n  return ${jsx};\n}\n`;
  return { source, ...run(source) };
}

/** The fixed JSX of a parent whose every diagnostic has a fix. */
function fixed(jsx: string): string {
  const { source, diagnostics } = parent(jsx);
  expect(diagnostics.length).toBeGreaterThan(0);
  expect(diagnostics.every((diagnostic) => diagnostic.fixes?.length)).toBe(true);
  const result = applyAndRecheck(source, diagnostics);
  return result.slice(result.lastIndexOf("return ") + 7, result.lastIndexOf(";\n}"));
}

describe("the renames of UF3035 to UF3038", () => {
  it.each([
    ['<Field lable="Name" />', "UF3035", '<Field label="Name" />'],
    ['<Field label="a" onCleer={() => {}} />', "UF3036", '<Field label="a" onClear={() => {}} />'],
    [
      '<Field label="a" v-model:opne={open.value} />',
      "UF3037",
      '<Field label="a" v-model:open={open.value} />',
    ],
    [
      '<Field label="a">{{ hnit: () => <i /> }}</Field>',
      "UF3038",
      '<Field label="a">{{ hint: () => <i /> }}</Field>',
    ],
    [
      "<Field label=\"a\">{{ 'hnit': () => <i /> }}</Field>",
      "UF3038",
      '<Field label="a">{{ "hint": () => <i /> }}</Field>',
    ],
  ])("%s (%s)", (jsx, code, after) => {
    expect(codes(parent(jsx).diagnostics)).toEqual([code]);
    expect(fixed(jsx)).toBe(after);
  });

  it("fixes several names of one element at once", () => {
    expect(fixed('<Field lable="a" onCleer={() => {}} v-model:opne={open.value} />')).toBe(
      '<Field label="a" onClear={() => {}} v-model:open={open.value} />',
    );
  });

  it.each([
    // The name it means is written already, or is close to another name written.
    '<Field lable="a" label="b" />',
    // Two names that mean one prop: each fix would write it.
    '<Field lable="a" labl="b" />',
    '<Field label="a" onCleer={() => {}} onClear={() => {}} />',
    // UF3043's fix writes `onClear` from `onClearOnce`.
    '<Field label="a" onCleer={() => {}} onClearOnce={() => {}} />',
    '<Field label="a" v-model:opne={open.value} v-model:open={open.value} />',
    '<Field label="a">{{ hnit: () => <i />, hint: () => <b /> }}</Field>',
  ])("offers no rename that would set a name twice: %s", (jsx) => {
    const { source, diagnostics } = parent(jsx);
    const unknown = diagnostics.filter((diagnostic) =>
      ["UF3035", "UF3036", "UF3037", "UF3038"].includes(diagnostic.code),
    );
    expect(unknown.length).toBeGreaterThan(0);
    for (const diagnostic of unknown) {
      expect(diagnostic.message).toContain("Did you mean");
      expect(diagnostic.fixes).toBeUndefined();
    }
    applyAndRecheck(source, diagnostics);
  });

  it("offers no rename for a name nothing declared is close to", () => {
    const { diagnostics } = parent('<Field label="a" placeholder="b" />');
    expect(codes(diagnostics)).toEqual(["UF3035"]);
    expect(diagnostics[0]!.message).not.toContain("Did you mean");
    expect(diagnostics[0]!.fixes).toBeUndefined();
  });

  it.each([
    ['lable="x"', ["UF3035 lable", "UF3035 lable"]],
    ['label="x">{{ hnit: () => <i /> }}</component', ["UF3038 hnit", "UF3038 hnit"]],
    ['label="x" tone="warn"', ['UF3039 "warn"', 'UF3039 "warn"']],
  ])(
    "offers no fix on <component is>, whose candidates may each mean another name: %s",
    (attributes, expected) => {
      const source =
        `${CHILD}function Chip({ label, tone }: { label: string; tone?: "info" | "warning" }) {
  const slots = defineSlots<{ hint?(): Element }>();
  return <span class={tone}>{label}{slots.hint?.()}</span>;
}
export function A() {
  const compact = ref(true);
  return <component is={compact.value ? Chip : Field} ${attributes} />;
}`.replace("</component />", "</component>");
      const { diagnostics } = run(source);
      expect(problems(source, diagnostics)).toEqual(expected);
      expect(diagnostics.every((diagnostic) => diagnostic.fixes === undefined)).toBe(true);
    },
  );

  it.each([
    // A shorthand member's key is its value: the rename would read another binding.
    ["const hnit = () => <i />;", "{{ hnit }}"],
    // A method is UF3040's once renamed.
    ["", "{{ hnit() { return <i />; } }}"],
  ])(
    "offers no rename to a slot-object member whose key is more than a name: %s %s",
    (setup, fill) => {
      const source = `${CHILD}\nexport function Form() {\n  ${setup}\n  return <Field label="a">${fill}</Field>;\n}\n`;
      const slot = run(source).diagnostics.find((diagnostic) => diagnostic.code === "UF3038");
      expect(slot?.message).toContain("Did you mean `hint`?");
      expect(slot?.fixes).toBeUndefined();
    },
  );

  it("offers no slot rename where a string key fills that slot", () => {
    const { diagnostics } = parent(
      '<Field label="a">{{ hnit: () => <i />, "hint": () => <b /> }}</Field>',
    );
    expect(codes(diagnostics)).toEqual(["UF3038"]);
    expect(diagnostics[0]!.fixes).toBeUndefined();
  });

  it("weighs only the element's listeners against an event rename", () => {
    // `upClear` is a prop, though `eventName` would read it as `clear`.
    const source = `${API}function Clearer({ upClear }: { upClear?: string }) {
  const emit = defineEmits<{ clear: [] }>();
  return <button type="button" onClick={() => emit("clear")}>{upClear}</button>;
}
export function A() { return <Clearer upClear="x" onCleer={() => {}} />; }`;
    const { diagnostics } = run(source);
    expect(codes(diagnostics)).toEqual(["UF3036"]);
    expect(applyAndRecheck(source, diagnostics)).toContain(
      '<Clearer upClear="x" onClear={() => {}} />',
    );
  });
});

/** A child whose one prop `value` has the type `type`, and a parent that passes it `jsx`. */
function valued(type: string, attribute: string): string {
  return `function Badge({ value }: { value: ${type} }) { return <b class={String(value)} />; }
export function A() { return <Badge ${attribute} />; }`;
}

describe("a literal outside a prop's union of literals (UF3039)", () => {
  it.each([
    ['<Field label="a" tone="warn" />', '"warn"', "warning", '<Field label="a" tone="warning" />'],
    ['<Field label="a" tone="ifno" />', '"ifno"', "info", '<Field label="a" tone="info" />'],
    [
      '<Field label="a" tone={"warnign"} />',
      '"warnign"',
      "warning",
      '<Field label="a" tone={"warning"} />',
    ],
    ["<Field label=\"a\" tone='Info' />", "'Info'", "info", '<Field label="a" tone="info" />'],
  ])("%s, with the literal it may mean", (jsx, value, meant, after) => {
    const { source, diagnostics } = parent(jsx);
    expect(problems(source, diagnostics)).toEqual([`UF3039 ${value}`]);
    expect(diagnostics[0]!.message).toBe(
      `Field's \`tone\` takes \`"info" | "warning"\`, and "${value.slice(1, -1)}" is none of them. Did you mean "${meant}"?`,
    );
    expect(fixed(jsx)).toBe(after);
  });

  it.each([
    ['<Field label="a" tone="danger" />', '"danger"'],
    ['<Field label="a" size={4} />', "4"],
    ['<Field label="a" tone={1} />', "1"],
    ['<Field label="a" size={"2"} />', '"2"'],
  ])("%s, with nothing it may mean", (jsx, value) => {
    const { source, diagnostics } = parent(jsx);
    expect(problems(source, diagnostics)).toEqual([`UF3039 ${value}`]);
    expect(diagnostics[0]!.message).not.toContain("Did you mean");
    expect(diagnostics[0]!.fixes).toBeUndefined();
  });

  it.each([
    '<Field label="a" tone="info" />',
    '<Field label="a" tone={"warning"} />',
    '<Field label="a" size={2} />',
    // Not a literal: L4 checks what the parent's compile cannot read.
    '<Field label="a" tone={open.value ? "info" : "warning"} />',
    // A string prop is no union of literals.
    '<Field label="anything" />',
  ])("accepts %s", (jsx) => {
    expect(parent(jsx).diagnostics).toEqual([]);
  });

  it("checks no type it cannot read as a union of literals: an alias, a widened union", () => {
    const source = `type Tone = "info" | "warning";
function Badge({ tone, code }: { tone: Tone; code: "x" | string }) { return <b class={tone}>{code}</b>; }
export function A() { return <Badge tone="warn" code="y" />; }`;
    expect(run(source).diagnostics).toEqual([]);
  });

  it("offers no fix to a literal a JSX string cannot hold as written", () => {
    const source = `function Badge({ tone }: { tone: "ab&" | "zzzz" }) { return <b class={tone} />; }
export function A() { return <Badge tone="ab" />; }`;
    const { diagnostics } = run(source);
    expect(codes(diagnostics)).toEqual(["UF3039"]);
    expect(diagnostics[0]!.message).toContain('Did you mean "ab&"?');
    expect(diagnostics[0]!.fixes).toBeUndefined();
  });

  it.each([
    ['"a" | true', "value={false}", "false"],
    ['"a" | "b" | null', 'value="zzz"', '"zzz"'],
    ['"a" | "b" | undefined', 'value="zzz"', '"zzz"'],
  ])("checks %s against %s", (type, attribute, value) => {
    const source = valued(type, attribute);
    const { diagnostics } = run(source);
    expect(problems(source, diagnostics)).toEqual([`UF3039 ${value}`]);
    expect(diagnostics[0]!.message).not.toContain("Did you mean");
  });

  it("accepts a boolean of the union", () => {
    expect(run(valued('"a" | true', "value={true}")).diagnostics).toEqual([]);
  });

  it("means no literal that two literals begin alike", () => {
    const { diagnostics } = run(valued('"warning" | "warmth"', 'value="war"'));
    expect(codes(diagnostics)).toEqual(["UF3039"]);
    expect(diagnostics[0]!.message).not.toContain("Did you mean");
  });

  it.each([
    ['\'a"b\' | "zzzz"', "value='a\"'", 'a"b'],
    ['"a\\\\b" | "zzzz"', 'value="ab"', "a\\b"],
    ['"a\\nb" | "zzzz"', 'value="ab"', "a\nb"],
  ])(
    "offers no fix to a JSX string for %s, which it cannot hold as written",
    (type, attribute, meant) => {
      const { diagnostics } = run(valued(type, attribute));
      expect(codes(diagnostics)).toEqual(["UF3039"]);
      expect(diagnostics[0]!.message).toContain(`Did you mean ${JSON.stringify(meant)}?`);
      expect(diagnostics[0]!.fixes).toBeUndefined();
    },
  );

  it("checks no type without a literal", () => {
    expect(codes(run(valued("undefined | null", 'value="a"')).diagnostics)).not.toContain("UF3039");
  });

  it("checks an imported child's union, as its module writes it", () => {
    const child = analyze(
      parseModule(
        "Badge.uf.tsx",
        'export default function Badge({ tone }: { tone: "info" | "warning" }) { return <b class={tone} />; }',
      ),
    ).api!;
    const { diagnostics } = analyze(
      parseModule(
        "Page.uf.tsx",
        'import Badge from "./Badge.uf.tsx";\nexport default function Page() { return <p><Badge tone="warn" /></p>; }',
      ),
      { imports: new Map([["./Badge.uf.tsx", { ...child, file: "Badge.uf.tsx" }]]) },
    );
    expect(codes(diagnostics)).toEqual(["UF3039"]);
    expect(diagnostics[0]!.fixes?.[0]?.edits[0]?.text).toBe('"warning"');
  });
});
