// The child-API resolver (ADR-0053): `createFileResolver` reads an imported file and gives its
// API relative to the importer, and `compile()` lowers a parent's components through it.
import { describe, expect, it } from "vitest";

import { compile, createFileResolver, createSyntacticOracle } from "../src/index.ts";

const FIELD = `export default function Field({ label }: { label: string }) {
  return <span>{label}</span>;
}

export function Hint() {
  return <small>Hint</small>;
}

function Local() {
  return <i />;
}
`;

const FORM = `import Field from "./sub/Field.uf.tsx";

export default function Form() {
  return <form><Field label="Name" /></form>;
}
`;

/** A resolver over in-memory files, which counts its reads. */
function memoryResolver(files: Record<string, string>) {
  const reads: string[] = [];
  const resolve = createFileResolver({
    root: "/project",
    readFile: (path) => {
      reads.push(path);
      return Promise.resolve(files[path]);
    },
  });
  return { resolve, reads };
}

describe("createFileResolver", () => {
  it("gives the imported module's API, its file relative to the importer", async () => {
    const { resolve } = memoryResolver({ "/project/src/sub/Field.uf.tsx": FIELD });
    const api = await resolve({ specifier: "./sub/Field.uf.tsx", importer: "src/Form.uf.tsx" });
    expect(api?.file).toBe("sub/Field.uf.tsx");
    expect(api?.components.map(({ name, export: kind }) => [name, kind])).toEqual([
      ["Field", "default"],
      ["Hint", "named"],
      ["Local", "local"],
    ]);
    expect(api?.components[0]).toMatchObject({
      props: [{ name: "label", optional: false, type: "string" }],
      root: "element",
      rootTag: "span",
    });
  });

  it("resolves nothing that is missing or not relative", async () => {
    const { resolve, reads } = memoryResolver({});
    expect(await resolve({ specifier: "./Missing.uf.tsx", importer: "A.uf.tsx" })).toBeUndefined();
    expect(await resolve({ specifier: "pkg/X.uf.tsx", importer: "A.uf.tsx" })).toBeUndefined();
    expect(reads).toEqual(["/project/Missing.uf.tsx"]);
  });

  // The unplugin names a file outside Vite's root by a path that leaves it (`../admin/A.uf.tsx`).
  it("joins a specifier to an importer outside the root, never cancelling its `..`", async () => {
    const { resolve, reads } = memoryResolver({
      "/project/../../packages/ui/B.uf.tsx": FIELD,
      "/project/packages/ui/B.uf.tsx": "export default function Decoy() { return <p />; }",
    });
    const api = await resolve({
      specifier: "../../packages/ui/B.uf.tsx",
      importer: "../admin/A.uf.tsx",
    });
    expect(reads).toEqual(["/project/../../packages/ui/B.uf.tsx"]);
    expect(api?.file).toBe("../../packages/ui/B.uf.tsx");
    expect(api?.components[0]?.name).toBe("Field");
  });

  it("analyses a file again only when its contents change", async () => {
    const files: Record<string, string> = { "/project/Field.uf.tsx": FIELD };
    const { resolve } = memoryResolver(files);
    const request = { specifier: "./Field.uf.tsx", importer: "Form.uf.tsx" };
    const first = await resolve(request);
    expect(await resolve(request)).toEqual(first);
    files["/project/Field.uf.tsx"] = FIELD.replaceAll("label", "title");
    expect((await resolve(request))?.components[0]?.props[0]?.name).toBe("title");
  });
});

/** A resolver and a type oracle over the same in-memory files (ADR-0067). */
function memoryProject(files: Record<string, string>) {
  const readFile = (path: string) => Promise.resolve(files[path]);
  const typeOracle = createSyntacticOracle({ root: "/project", readFile });
  return { resolve: createFileResolver({ root: "/project", readFile, typeOracle }), typeOracle };
}

const TYPES = `export type Tone = "info" | "warning";
interface Hidden { id: string }
export interface Base extends Hidden { tone?: Tone }
export interface ChipProps extends Base { label: string; icon?: Icon }
export interface Icon { name: string }
`;

const CHIP = `import { defineEmits, defineSlots } from "unframework";
import type { Element } from "unframework";
import type { ChipProps, Icon } from "./types.ts";

export default function Chip({ label, tone }: ChipProps) {
  const emit = defineEmits<{ pick: [icon: Icon] }>();
  const slots = defineSlots<{ hint?(props: { icon: Icon }): Element }>();
  return <button type="button" class={tone} onClick={() => emit("pick", { name: label })}>{label}{slots.hint?.({ icon: { name: label } })}</button>;
}
`;

describe("createFileResolver with a type oracle (ADR-0067)", () => {
  it("reads a child's props, events and slots through the oracle, with what they reference", async () => {
    const { resolve } = memoryProject({
      "/project/types.ts": TYPES,
      "/project/Chip.uf.tsx": CHIP,
    });
    const api = await resolve({ specifier: "./Chip.uf.tsx", importer: "Form.uf.tsx" });
    const [chip] = api!.components;
    expect(chip!.props).toEqual([
      { name: "label", optional: false, type: "string" },
      { name: "icon", optional: true, type: "Icon", references: ["Icon"] },
      {
        name: "tone",
        optional: true,
        type: "Tone",
        references: ["Tone"],
        literals: ['"info"', '"warning"'],
      },
      { name: "id", optional: false, type: "string" },
    ]);
    expect(chip!.events).toEqual([{ name: "pick", parameters: [{ name: "icon", type: "Icon" }] }]);
    expect(chip!.slots).toEqual([
      { name: "hint", optional: true, props: "{ icon: Icon }", references: ["Icon"] },
    ]);
  });

  it("reads a child's own types alone without an oracle, as before", async () => {
    const { resolve } = memoryResolver({
      "/project/types.ts": TYPES,
      "/project/Chip.uf.tsx": CHIP,
    });
    const api = await resolve({ specifier: "./Chip.uf.tsx", importer: "Form.uf.tsx" });
    expect(api!.components[0]!.props).toEqual([]);
  });

  it("resolves the child again when a type it imports changes", async () => {
    const files: Record<string, string> = {
      "/project/types.ts": TYPES,
      "/project/Chip.uf.tsx": CHIP,
    };
    const { resolve, typeOracle } = memoryProject(files);
    const request = { specifier: "./Chip.uf.tsx", importer: "Form.uf.tsx" };
    await resolve(request);
    files["/project/types.ts"] = TYPES.replace("label: string", "text: string");
    await typeOracle.update({ files: ["types.ts"] });
    const api = await resolve(request);
    expect(api!.components[0]!.props.map(({ name }) => name)).toContain("text");
  });

  it("throws when its oracle throws, which compile() reports (UF9001)", async () => {
    const readFile = (path: string) =>
      Promise.resolve({ "/project/Chip.uf.tsx": CHIP, "/project/types.ts": TYPES }[path]);
    const oracle = createSyntacticOracle({ root: "/project", readFile });
    const resolve = createFileResolver({
      root: "/project",
      readFile,
      typeOracle: { ...oracle, resolveShape: () => Promise.reject(new Error("checker gone")) },
    });
    const result = await compile(
      'import Chip from "./Chip.uf.tsx";\n\nexport default function Form() {\n  return <Chip label="a" id="b" />;\n}\n',
      {
        filename: "Form.uf.tsx",
        targets: ["vue"],
        resolve,
      },
    );
    expect(result.diagnostics.map(({ code, message }) => [code, message])).toContainEqual([
      "UF9001",
      'The resolver failed on "./Chip.uf.tsx": checker gone',
    ]);
  });

  it("gives an injection key's references (ADR-0054)", async () => {
    const { resolve } = memoryProject({
      "/project/keys.uf.tsx": `import type { InjectionKey } from "unframework";
export interface Theme { tone: string }
export const ThemeKey: InjectionKey<Theme> = Symbol("uf.theme");
export default function Provider() { return <p />; }
`,
    });
    const api = await resolve({ specifier: "./keys.uf.tsx", importer: "Form.uf.tsx" });
    expect(api!.keys).toEqual([
      { name: "ThemeKey", description: "uf.theme", type: "Theme", references: ["Theme"] },
    ]);
  });
});

describe("compile() with a resolver", () => {
  it("checks a literal against a union a child's alias names (UF3039)", async () => {
    const { resolve, typeOracle } = memoryProject({
      "/project/types.ts": TYPES,
      "/project/Chip.uf.tsx": CHIP,
    });
    const source = `import Chip from "./Chip.uf.tsx";

export default function Form() {
  return <form><Chip label="Name" id="n" tone="warn" /></form>;
}
`;
    const result = await compile(source, {
      filename: "Form.uf.tsx",
      targets: ["vue"],
      resolve,
      typeOracle,
    });
    expect(result.diagnostics.map(({ code, message }) => [code, message])).toEqual([
      [
        "UF3039",
        'Chip\'s `tone` takes `"info" | "warning"`, and "warn" is none of them. Did you mean "warning"?',
      ],
    ]);
  });

  it("lowers a child component with the API the resolver gives", async () => {
    const { resolve } = memoryResolver({ "/project/src/sub/Field.uf.tsx": FIELD });
    const result = await compile(FORM, { filename: "src/Form.uf.tsx", targets: ["vue"], resolve });
    expect(result.diagnostics).toEqual([]);
    expect(result.ir?.imports?.[0]).toMatchObject({
      specifier: "./sub/Field.uf.tsx",
      file: "sub/Field.uf.tsx",
      names: [{ kind: "Component", imported: "default", local: "Field" }],
    });
    expect(result.outputs.vue![0]!.contents).toContain('import Field from "./sub/Field.vue";');
    expect(result.owners.vue).toEqual({ "Form.vue": "Form" });
  });

  it("reports an import it cannot resolve (UF1202), without a resolver too", async () => {
    for (const resolve of [undefined, memoryResolver({}).resolve]) {
      const result = await compile(FORM, {
        filename: "src/Form.uf.tsx",
        targets: ["vue"],
        ...(resolve ? { resolve } : {}),
      });
      expect(result.diagnostics.map(({ code }) => code)).toEqual(["UF1202"]);
      expect(result.ir).toBeUndefined();
    }
  });

  it("reports a resolver that throws (UF9001), and the import as unresolved", async () => {
    const result = await compile(FORM, {
      filename: "src/Form.uf.tsx",
      targets: ["vue"],
      resolve: () => Promise.reject(new Error("disk on fire")),
    });
    // Sorted by span: the internal error points at the file's start.
    expect(result.diagnostics.map(({ code, message }) => [code, message])).toEqual([
      ["UF9001", 'The resolver failed on "./sub/Field.uf.tsx": disk on fire'],
      [
        "UF1202",
        '"./sub/Field.uf.tsx" cannot be resolved: the compiler finds no component module there.',
      ],
    ]);
  });
});

// UF3046 reads a template ref's type from the syntax, as before the type oracle: compiling with
// the oracle changes nothing it reports.
describe("a template ref's type, compiled with the type oracle (UF3046)", () => {
  const FIELD = `import { defineExpose, useTemplateRef } from "unframework";

export default function Field({ label }: { label: string }) {
  const input = useTemplateRef<HTMLInputElement>();
  async function focus() {
    input.value?.focus();
  }
  function select() {
    input.value?.select();
  }
  defineExpose({ focus, select });
  return <input ref={input} aria-label={label} />;
}
`;
  const TYPES = "export interface Options { [name: string]: unknown }\n";

  /** The codes of a parent whose ref on `Field` is typed `type`, after `declarations`. */
  async function codesOf(declarations: string, type: string): Promise<string[]> {
    const source = `import { useTemplateRef } from "unframework";
import Field from "./Field.uf.tsx";
import type { Options } from "./types.ts";
import type { Missing } from "./missing.ts";
${declarations}
export default function Form() {
  const field = useTemplateRef<${type}>();
  return <Field ref={field} label="Name" />;
}
`;
    const { resolve, typeOracle } = memoryProject({
      "/project/Field.uf.tsx": FIELD,
      "/project/types.ts": TYPES,
      "/project/Form.uf.tsx": source,
    });
    const result = await compile(source, {
      filename: "Form.uf.tsx",
      targets: ["vue"],
      resolve,
      typeOracle,
    });
    return result.diagnostics.map(({ code }) => code);
  }

  // A member's own type names nothing UF3046 reads, whatever the oracle makes of it.
  it.each([
    ["", "{ focus(): Promise<void> }"],
    ["type Later = Promise<void>;", "{ focus(): Later; select(): Later }"],
    ["type Later = Promise<void>;", "{ focus: () => Later }"],
    ["interface Local { [name: string]: unknown }", "{ focus(options?: Local): void }"],
    ["interface Pending { at: Promise<number> }", "{ focus(options?: Pending): void }"],
    ["", "{ focus(): void; select(options?: Options): void }"],
    ["interface B<T> { focus(): T }\ninterface H extends B<Promise<void>> {}", "H"],
    ["interface H { focus(): void; select(other: H & Missing): void }", "H"],
  ])("reads `%s %s` as the members it names", async (declarations, type) => {
    expect(await codesOf(declarations, type)).toEqual([]);
  });

  // A type that is no object literal, or that may hold members it does not name.
  it.each([
    ["", "{ focus(): void; [name: string]: () => void }"],
    ["", "{ focus(): void } & Missing"],
    ["interface Commands { [name: string]: () => void }", "{ focus(): void } & Commands"],
    ["", 'Pick<Missing, "focus">'],
    ["type H = { focus(): void } & Missing;", "H"],
    ["", "{ focus(): void; clear(): void }"],
  ])("reports `%s %s`", async (declarations, type) => {
    expect(await codesOf(declarations, type)).toEqual(["UF3046"]);
  });
});
