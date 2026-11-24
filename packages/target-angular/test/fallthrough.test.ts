// What falls through a component, and what a ref on it holds (src/fallthrough.ts, ADR-0118):
// the forms the corpus does not reach, each as the emitter writes it, and the whole of each form
// through ngtsc (L3).
import { join } from "node:path";

import type { EmitContext } from "@unframework.dev/codegen";
import { afterAll, describe, expect, it } from "vitest";

import target from "../src/index.ts";
import { toolchain } from "../src/toolchain/index.ts";
import { context, emitModule, lower, removeScratch, scratchDir } from "./helpers.ts";

afterAll(removeScratch);

/** Each file a source of several components emits, by its path. */
const filesOf = (source: string) =>
  new Map(emitModule(lower(source, "Page.uf.tsx")).map(({ path, contents }) => [path, contents]));

/** The messages of ngtsc's L3 check on every file a source emits, together. */
async function l3Errors(source: string): Promise<Array<string>> {
  const directory = scratchDir();
  const files = [...filesOf(source)].map(([path, contents]) => ({
    path: join(directory, path),
    contents,
  }));
  const results = await toolchain.frameworkCompile(files, context);
  return [...results.values()].flatMap(({ errors, warnings }) =>
    [...errors, ...warnings].map(({ code, message }) => `${code}: ${message}`),
  );
}

/** What the emitter reports for each component of a source. */
function reportedFor(source: string): Array<string> {
  const module = lower(source);
  const messages: Array<string> = [];
  const emitContext: EmitContext = {
    module,
    options: undefined,
    report: ({ code, message }) => messages.push(`${code}: ${message}`),
  };
  for (const component of module.components) {
    target.emit(component, emitContext);
  }
  return messages;
}

/** A child whose root component, `Base`, takes what it does not declare. */
const FORWARDING = `import { ref, useTemplateRef } from "@uxfront/unframework";

function Base({ text }: { text: string }) {
  return (
    <button type="button" onClick={() => undefined}>
      {text}
    </button>
  );
}

function Primary({ text }: { text: string }) {
  const count = ref(0);
  function bump() {
    count.value++;
  }
  return <Base text={text} data-count={count.value} onClick={bump} />;
}

export default function Page() {
  const clicks = ref(0);
  const save = useTemplateRef<HTMLButtonElement>();
  return (
    <div>
      <Primary
        ref={save}
        text="Save"
        id="save"
        disabled={clicks.value > 2}
        onClick={() => clicks.value++}
      />
      <button type="button" onClick={() => save.value?.focus()}>
        Focus
      </button>
    </div>
  );
}
`;

/** A child that spreads its props' rest on an inner element. */
const REST = `import { defineOptions } from "@uxfront/unframework";

function Field({ label, ...rest }: { label: string }) {
  defineOptions({ inheritAttrs: false });
  return (
    <label class="field">
      {label} <input {...rest} class="control" />
    </label>
  );
}

export default function Page() {
  return <Field label="Email" id="email" class="wide" onFocus={() => undefined} />;
}
`;

/** A root and a rest's element that bind attributes a consumer may pass too. */
const OWN_BINDINGS = `import { defineOptions, ref } from "@uxfront/unframework";

function Btn({ label }: { label: string }) {
  const kind = ref<"button" | "reset">("button");
  return (
    <button
      type={kind.value}
      disabled={kind.value === "reset"}
      onClick={() => (kind.value = kind.value === "button" ? "reset" : "button")}
    >
      {label}
    </button>
  );
}

function Field({ label, ...rest }: { label: string }) {
  defineOptions({ inheritAttrs: false });
  const hint = ref("email");
  return (
    <label>
      {label} <input {...rest} placeholder={hint.value} />
    </label>
  );
}

export default function Page() {
  return (
    <div>
      <Btn label="x" type="submit" />
      <Field label="Email" placeholder="you@example.com" />
    </div>
  );
}
`;

describe("what falls through a component (ADR-0118)", () => {
  it("binds the consumer's value of an attribute the element that takes it binds itself", async () => {
    const files = filesOf(OWN_BINDINGS);
    expect(files.get("btn.ts")).toContain(
      `[attr.type]="'type' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['type'] : kind"`,
    );
    // The record holds a boolean attribute's value as bound, so only the element's own is tested.
    expect(files.get("btn.ts")).toContain(
      `[attr.disabled]="'disabled' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['disabled'] : kind === 'reset' ? '' : null"`,
    );
    expect(files.get("field.ts")).toContain(
      `[attr.placeholder]="'placeholder' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['placeholder'] : hint"`,
    );
    // An element that takes nothing binds its own as written.
    expect(files.get("page.ts")).not.toContain("' in (");
    expect(await l3Errors(OWN_BINDINGS)).toEqual([]);
  }, 120_000);

  it("gives a root element the directive, the inputs and the element a ref holds", () => {
    const base = filesOf(FORWARDING).get("base.ts")!;
    expect(base).toContain('@Directive({ selector: "[ufFallthrough]" })');
    expect(base).toContain(
      "type Listeners = { [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void };",
    );
    expect(base).toContain(
      '[ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"',
    );
    expect(base).toContain("#ufElement");
    expect(base).toContain("readonly ufAttributes = input<Record<string, unknown>>();");
    expect(base).toContain("readonly ufListeners = input<Listeners>();");
    expect(base).toContain(
      'readonly ufElement = viewChild<ElementRef<HTMLButtonElement>>("ufElement");',
    );
  });

  it("passes a consumer's records on through a root component, merged with its own", () => {
    const primary = filesOf(FORWARDING).get("primary.ts")!;
    // The consumer's attributes win; the consumer's listener of an event runs after the
    // component's own, in the method the record's listener calls.
    expect(primary).toContain("[ufAttributes]=\"{ 'data-count': count, ...this.ufAttributes() }\"");
    expect(primary).toContain(
      '[ufListeners]="{ ...this.ufListeners(), click: ($event) => onClick($event) }"',
    );
    expect(primary).toMatch(
      /protected onClick\(event: PointerEvent\) \{\n\s*this\.bump\(\);\n\s*this\.ufListeners\(\)\?\.click\?\.\(event\);\n\s*\}/,
    );
    // Its ref's element is its root component's.
    expect(primary).toContain(
      'private readonly rootComponent = viewChild("ufElement", { read: Base });',
    );
    expect(primary).toContain(
      "readonly ufElement = computed(() => this.rootComponent()?.ufElement());",
    );
    expect(primary).not.toContain("[ufFallthrough]");
  });

  it("writes a parent's attributes, listeners and ref on a child as records and a query of its element", () => {
    const page = filesOf(FORWARDING).get("page.ts")!;
    expect(page).toContain(`[ufAttributes]="{ id: 'save', disabled: clicks > 2 ? '' : null }"`);
    expect(page).toContain('[ufListeners]="{ click: () => onClick() }"');
    expect(page).toContain(
      'private readonly saveComponent = viewChild("save", { read: Primary });',
    );
    expect(page).toMatch(
      /private readonly save = computed<ElementRef<HTMLButtonElement> \| undefined>\(\(\) =>\s*this\.saveComponent\(\)\?\.ufElement\(\),?\s*\);/,
    );
    expect(page).toContain("this.save()?.nativeElement.focus();");
  });

  it("compiles each form under ngtsc's strict templates", async () => {
    expect(await l3Errors(FORWARDING)).toEqual([]);
    expect(await l3Errors(REST)).toEqual([]);
  }, 120_000);

  it("puts the props' rest, class and style on the rest's element, and the ref on the root", () => {
    const field = filesOf(REST).get("field.ts")!;
    expect(field).toMatch(
      /<input\s+\[ufFallthrough\]="\{ attributes: this\.ufAttributes\(\), listeners: this\.ufListeners\(\) \}"\s+class="control"\s+\[class\]="this\.class\(\)"\s+\[style\]="this\.style\(\)"/,
    );
    // The root keeps the styled parents' scope attributes, which the rest never takes.
    expect(field).toMatch(/<label\s+class="field"\s+\[ufScope\]="this\.host"\s+#ufElement\s*>/);
    expect(field).toContain(
      'readonly ufElement = viewChild<ElementRef<HTMLLabelElement>>("ufElement");',
    );
  });

  it("declares no element where the component exposes something", () => {
    const exposing = filesOf(`import { defineExpose } from "@uxfront/unframework";

export default function Card() {
  function open() {}
  defineExpose({ open });
  return <p>x</p>;
}
`).get("card.ts")!;
    expect(exposing).not.toContain("ufElement");
    expect(exposing).toContain("ufAttributes");
  });

  it("reports a prop named like an input or a member it declares (UF2003)", () => {
    expect(
      reportedFor(`export default function Card({ ufAttributes, ufElement }: { ufAttributes: string; ufElement: string }) {
  return <p>{ufAttributes}{ufElement}</p>;
}`),
    ).toEqual([
      "UF2003: `ufAttributes` names the input of the consumer's attributes on Angular. Rename the prop.",
      "UF2003: `ufElement` names the member that holds the root element a ref on the component holds on Angular. Rename the prop.",
    ]);
  });
});
