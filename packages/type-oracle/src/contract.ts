// The contract every TypeOracle adapter passes (plan §5.5): the same queries over the same
// fixture projects give the same shapes. Moving to another adapter means making this suite green
// on it. Shapes are compared by their canonical print, so adapters may order nodes differently.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { printShape } from "./print.ts";
import type { ShapeQuery, TypeOracle, TypeShape, UnresolvedType } from "./types.ts";

/** Creates the adapter under test over a fixture project, whose files `root` holds. */
export type OracleFactory = (project: { root: string }) => TypeOracle | Promise<TypeOracle>;

/** Where a member of the queried object is declared. */
export interface MemberOrigin {
  file: string;
  /** The named declaration, absent for a type literal written in place. */
  declaration?: string;
}

export interface ContractCase {
  name: string;
  /** The fixture project, a directory of `test/fixtures/`. */
  project: string;
  file: string;
  /** Text of `file` that holds the queried type, such as `Extended(props: Labelled)`. */
  where: string;
  /** The queried type, as written inside `where`: its last occurrence there. */
  type: string;
  /** The shape's canonical print (`printShape(shape, { canonical: true })`). */
  expected: string;
  /** For an object, where each member is declared. */
  members?: Record<string, MemberOrigin>;
  dependencies: string[];
  /** Constructs `construction` must list; it may list more. */
  construction?: string[];
  /** The unresolved spans, each by its file, its text and the reason. */
  unresolved?: { file: string; text: string; reason: UnresolvedType["reason"] }[];
}

const FIXTURES = fileURLToPath(new URL("../test/fixtures/", import.meta.url));

const here = (file: string) => ({ file });
const declared = (file: string, declaration: string) => ({ file, declaration });

const CONTRACT_CASES: readonly ContractCase[] = [
  {
    name: "a type literal",
    project: "local",
    file: "Card.uf.tsx",
    where: "Literal(props: { label: string; count?: number; tags: readonly string[] })",
    type: "{ label: string; count?: number; tags: readonly string[] }",
    expected: "{ count?: number; label: string; tags: readonly string[] }",
    members: {
      label: here("Card.uf.tsx"),
      count: here("Card.uf.tsx"),
      tags: here("Card.uf.tsx"),
    },
    dependencies: [],
  },
  {
    name: "a local interface",
    project: "local",
    file: "Card.uf.tsx",
    where: "Declared(props: CardProps)",
    type: "CardProps",
    expected: "{ count: number; title: string }",
    members: {
      title: declared("Card.uf.tsx", "CardProps"),
      count: declared("Card.uf.tsx", "CardProps"),
    },
    dependencies: [],
  },
  {
    name: "unions, null and function types",
    project: "local",
    file: "Card.uf.tsx",
    where:
      "Unions(props: {\n  value: string | number | null;\n  onChange: (value: string) => void;\n})",
    type: "{\n  value: string | number | null;\n  onChange: (value: string) => void;\n}",
    expected: "{ onChange: (value: string) => void; value: null | number | string }",
    dependencies: [],
    construction: ["union"],
  },
  {
    name: "labelled tuples, as defineEmits declares events",
    project: "local",
    file: "Card.uf.tsx",
    where: "Emits(events: { change: [value: string]; close: [] })",
    type: "{ change: [value: string]; close: [] }",
    expected: "{ change: [value: string]; close: [] }",
    dependencies: [],
  },
  {
    name: "a type parameter in scope",
    project: "local",
    file: "Card.uf.tsx",
    where: "List<T>(props: { items: T[]; selected?: T })",
    type: "{ items: T[]; selected?: T }",
    expected: "{ items: T[]; selected?: T }",
    dependencies: [],
  },
  {
    name: "a recursive local alias",
    project: "local",
    file: "Card.uf.tsx",
    where: "Recursive(props: Tree)",
    type: "Tree",
    expected: "{ children: Tree[]; label: string }",
    dependencies: [],
  },
  {
    name: "an imported interface with an imported extends chain",
    project: "imports",
    file: "Button.uf.tsx",
    where: "Extended(props: Labelled)",
    type: "Labelled",
    expected:
      '{ disabled?: boolean; id: string; label: string; readonly size?: "lg" | "md" | "sm" }',
    members: {
      label: declared("types.ts", "Labelled"),
      size: declared("types.ts", "Labelled"),
      id: declared("types.ts", "Base"),
      disabled: declared("types.ts", "Base"),
    },
    dependencies: ["types.ts"],
    construction: ["import", "extends", "union"],
  },
  {
    name: "imported literal unions, one through a re-export",
    project: "imports",
    file: "Button.uf.tsx",
    where: "LiteralUnions(props: { size: Size; tone?: Tone })",
    type: "{ size: Size; tone?: Tone }",
    expected: '{ size: "lg" | "md" | "sm"; tone?: "danger" | "neutral" }',
    members: { size: here("Button.uf.tsx"), tone: here("Button.uf.tsx") },
    dependencies: ["reexports.ts", "types.ts"],
    construction: ["import", "union"],
  },
  {
    name: "an intersection of a renamed re-export and an `export *`",
    project: "imports",
    file: "Button.uf.tsx",
    where: "Intersected(props: Root & Extra)",
    type: "Root & Extra",
    expected: "{ disabled?: boolean; id: string; note: string }",
    members: {
      id: declared("types.ts", "Base"),
      disabled: declared("types.ts", "Base"),
      note: declared("more.ts", "Extra"),
    },
    dependencies: ["more.ts", "reexports.ts", "types.ts"],
    construction: ["intersection", "import"],
  },
  {
    name: "an interface exported by a child .uf.tsx module",
    project: "imports",
    file: "Button.uf.tsx",
    where: "Child(props: FieldProps)",
    type: "FieldProps",
    expected: "{ name: string; value?: string }",
    members: {
      name: declared("Field.uf.tsx", "FieldProps"),
      value: declared("Field.uf.tsx", "FieldProps"),
    },
    dependencies: ["Field.uf.tsx"],
    construction: ["import"],
  },
  {
    name: "a recursive imported interface",
    project: "imports",
    file: "Button.uf.tsx",
    where: "Recursive(props: TreeNode)",
    type: "TreeNode",
    expected: "{ children: TreeNode[]; label: string }",
    dependencies: ["tree.ts"],
    construction: ["import"],
  },
  {
    name: "an import of a module that does not exist",
    project: "imports",
    file: "Button.uf.tsx",
    where: "MissingModule(props: Missing)",
    type: "Missing",
    expected: "Missing",
    dependencies: [],
    unresolved: [{ file: "Button.uf.tsx", text: "Missing", reason: "missing-module" }],
  },
  {
    name: "an import of a type the module does not export",
    project: "imports",
    file: "Button.uf.tsx",
    where: "MissingExport(props: Hidden)",
    type: "Hidden",
    expected: "Hidden",
    dependencies: ["types.ts"],
    unresolved: [{ file: "Button.uf.tsx", text: "Hidden", reason: "missing-export" }],
  },
];

/** The query a case makes: its file, and the span of its type inside `where`. */
function caseQuery(testCase: ContractCase): ShapeQuery {
  const source = readFileSync(`${FIXTURES}${testCase.project}/${testCase.file}`, "utf8");
  const at = source.indexOf(testCase.where);
  const offset = testCase.where.lastIndexOf(testCase.type);
  if (at === -1 || offset === -1) {
    throw new Error(`${testCase.name}: "${testCase.where}" is not in ${testCase.file}.`);
  }
  const start = at + offset;
  return { file: testCase.file, span: { start, end: start + testCase.type.length } };
}

/** What a case compares: the canonical print, the members' origins, and what was unresolved. */
function observe(shape: TypeShape, project: string) {
  const root = shape.nodes[shape.root]!;
  const text = (file: string, start: number, end: number) =>
    readFileSync(`${FIXTURES}${project}/${file}`, "utf8").slice(start, end);
  return {
    expected: printShape(shape, { canonical: true }),
    members:
      root.kind === "object"
        ? Object.fromEntries(
            root.members.map((member) => [
              member.name,
              {
                file: member.file,
                ...(member.declaration && { declaration: member.declaration.name }),
              },
            ]),
          )
        : undefined,
    dependencies: shape.dependencies,
    unresolved: shape.unresolved.map((entry) => ({
      file: entry.file,
      text: text(entry.file, entry.span.start, entry.span.end),
      reason: entry.reason,
    })),
  };
}

/**
 * Registers the contract suite for an adapter: one Vitest test per case, over the fixture
 * projects in this package's `test/fixtures/`. Call it from the adapter's own test file.
 */
export function typeOracleContract(adapter: string, createOracle: OracleFactory): void {
  describe(`TypeOracle contract: ${adapter}`, () => {
    const oracles = new Map<string, TypeOracle>();
    beforeAll(async () => {
      for (const project of new Set(CONTRACT_CASES.map((testCase) => testCase.project))) {
        oracles.set(project, await createOracle({ root: `${FIXTURES}${project}` }));
      }
    });
    afterAll(async () => {
      for (const oracle of oracles.values()) await oracle.dispose();
    });

    it.each(CONTRACT_CASES.map((testCase) => [testCase.name, testCase] as const))(
      "%s",
      async (_, testCase) => {
        const oracle = oracles.get(testCase.project)!;
        const shape = await oracle.resolveShape(caseQuery(testCase));
        const observed = observe(shape, testCase.project);
        expect(JSON.parse(JSON.stringify(shape))).toEqual(shape);
        expect(observed.expected).toBe(testCase.expected);
        if (testCase.members) expect(observed.members).toEqual(testCase.members);
        expect(observed.dependencies).toEqual(testCase.dependencies);
        expect(observed.unresolved).toEqual(testCase.unresolved ?? []);
        expect(shape.construction).toEqual(expect.arrayContaining(testCase.construction ?? []));
      },
    );

    it("prints a type literal as written", async () => {
      const testCase = CONTRACT_CASES[0]!;
      const printed = await oracles.get(testCase.project)!.printType(caseQuery(testCase));
      expect(printed).toBe("{ label: string; count?: number; tags: readonly string[] }");
    });
  });
}
