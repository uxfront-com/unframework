// The child-API resolver (ADR-0053): `createFileResolver` reads an imported file and gives its
// API relative to the importer, and `compile()` lowers a parent's components through it.
import { describe, expect, it } from "vitest";

import { compile, createFileResolver } from "../src/index.ts";

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

describe("compile() with a resolver", () => {
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
