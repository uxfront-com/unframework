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
  /** Whether its module exports that declaration. */
  exported?: boolean;
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
  /**
   * What an adapter backed by a type-checker gives instead, where it evaluates a construct the
   * syntactic adapter leaves unresolved: a conditional or a mapped type (plan §5.5).
   */
  checker?: Partial<Omit<ContractCase, "name" | "project" | "file" | "where" | "type" | "checker">>;
}

/** Options for {@link typeOracleContract}. */
export interface ContractOptions {
  /** The adapter is backed by a type-checker, so each case's `checker` expectations apply. */
  checker?: boolean;
}

const FIXTURES = fileURLToPath(new URL("../test/fixtures/", import.meta.url));

const here = (file: string) => ({ file });
const pkg = (path: string) => `pkg:${path}`;
const exported = (file: string, declaration: string) => ({ file, declaration, exported: true });
const local = (file: string, declaration: string) => ({ file, declaration, exported: false });

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
      title: local("Card.uf.tsx", "CardProps"),
      count: local("Card.uf.tsx", "CardProps"),
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
    name: "interfaces of one name, merged",
    project: "local",
    file: "Card.uf.tsx",
    where: "Merging(props: Merged)",
    type: "Merged",
    expected: "{ a: string; b: number }",
    members: { a: local("Card.uf.tsx", "Merged"), b: local("Card.uf.tsx", "Merged") },
    dependencies: [],
  },
  {
    name: "an interface's own member over its base's",
    project: "local",
    file: "Card.uf.tsx",
    where: "Narrowed(props: Narrow)",
    type: "Narrow",
    expected: '{ label: string; size: "md" | "sm" }',
    members: { size: local("Card.uf.tsx", "Narrow"), label: local("Card.uf.tsx", "Sized") },
    dependencies: [],
    construction: ["extends"],
  },
  {
    name: "a cycle through extends, queried at the base",
    project: "local",
    file: "Card.uf.tsx",
    where: "CycleParent(props: Parent)",
    type: "Parent",
    expected: "{ child: { child: Child; name: string } }",
    dependencies: [],
  },
  {
    name: "a cycle through extends, queried at the derived interface",
    project: "local",
    file: "Card.uf.tsx",
    where: "CycleChild(props: Child)",
    type: "Child",
    expected: "{ child: Child; name: string }",
    members: { name: local("Card.uf.tsx", "Child"), child: local("Card.uf.tsx", "Parent") },
    dependencies: [],
  },
  {
    name: "a cycle through an intersection",
    project: "local",
    file: "Card.uf.tsx",
    where: "AliasCycle(props: Head)",
    type: "Head",
    expected: "{ next: { next: Tail; value: number } }",
    dependencies: [],
  },
  {
    name: "a union of a union, flattened without repeats",
    project: "local",
    file: "Card.uf.tsx",
    where: 'Flattened(props: { value: AB | "b" | "c" })',
    type: '{ value: AB | "b" | "c" }',
    expected: '{ value: "a" | "b" | "c" }',
    dependencies: [],
  },
  {
    name: "an intersection's member, required when one part requires it",
    project: "local",
    file: "Card.uf.tsx",
    where: "Optional(props: { a?: string } & { a: string })",
    type: "{ a?: string } & { a: string }",
    expected: "{ a: string }",
    dependencies: [],
  },
  {
    name: "an intersection's member, writable when one part writes it",
    project: "local",
    file: "Card.uf.tsx",
    where: "Writable(props: { readonly a: string } & { a: string })",
    type: "{ readonly a: string } & { a: string }",
    expected: "{ a: string }",
    dependencies: [],
  },
  {
    name: "a later declaration's extends clause, merged",
    project: "local",
    file: "Card.uf.tsx",
    where: "LateBase(props: Late)",
    type: "Late",
    expected: "{ a: string; b: number; z: boolean }",
    members: {
      a: local("Card.uf.tsx", "Late"),
      b: local("Card.uf.tsx", "Late"),
      z: local("Card.uf.tsx", "Zed"),
    },
    dependencies: [],
    construction: ["extends"],
  },
  {
    name: "an overloaded method over its base's, unresolved",
    project: "local",
    file: "Card.uf.tsx",
    where: "Overloads(props: Overloaded)",
    type: "Overloaded",
    expected: "{ f: (unresolved) }",
    members: { f: local("Card.uf.tsx", "Overloaded") },
    dependencies: [],
    unresolved: [{ file: "Card.uf.tsx", text: "f(a: string): void;", reason: "unsupported" }],
  },
  {
    name: "an index signature in an intersection's part, unresolved",
    project: "local",
    file: "Card.uf.tsx",
    where: "IndexedPart(props: Indexed)",
    type: "Indexed",
    expected: "{ a: number }",
    dependencies: [],
    unresolved: [{ file: "Card.uf.tsx", text: "[key: string]: number", reason: "unsupported" }],
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
      label: exported("types.ts", "Labelled"),
      size: exported("types.ts", "Labelled"),
      id: exported("types.ts", "Base"),
      disabled: exported("types.ts", "Base"),
    },
    dependencies: ["types.ts"],
    construction: ["import", "extends", "union"],
  },
  {
    name: "an import from a parent directory",
    project: "imports",
    file: "nested/Deep.uf.tsx",
    where: "Deep(props: Labelled)",
    type: "Labelled",
    expected:
      '{ disabled?: boolean; id: string; label: string; readonly size?: "lg" | "md" | "sm" }',
    members: {
      label: exported("types.ts", "Labelled"),
      size: exported("types.ts", "Labelled"),
      id: exported("types.ts", "Base"),
      disabled: exported("types.ts", "Base"),
    },
    dependencies: ["types.ts"],
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
      id: exported("types.ts", "Base"),
      disabled: exported("types.ts", "Base"),
      note: exported("more.ts", "Extra"),
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
      name: exported("Field.uf.tsx", "FieldProps"),
      value: exported("Field.uf.tsx", "FieldProps"),
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
    expected: "(unresolved)",
    dependencies: [],
    unresolved: [{ file: "Button.uf.tsx", text: "Missing", reason: "missing-module" }],
  },
  {
    name: "an import of a type the module does not export",
    project: "imports",
    file: "Button.uf.tsx",
    where: "MissingExport(props: Hidden)",
    type: "Hidden",
    expected: "(unresolved)",
    dependencies: ["types.ts"],
    unresolved: [{ file: "Button.uf.tsx", text: "Hidden", reason: "missing-export" }],
  },
  {
    name: "Partial, over an imported interface",
    project: "utilities",
    file: "Panel.uf.tsx",
    where: "Partials(props: Partial<ButtonProps>)",
    type: "Partial<ButtonProps>",
    expected:
      '{ count?: number | undefined; label?: string; onClick?: () => void; readonly size?: "md" | "sm"; tone?: "danger" | "neutral" }',
    members: {
      label: exported("types.ts", "ButtonProps"),
      tone: exported("types.ts", "ButtonProps"),
      size: exported("types.ts", "ButtonProps"),
      count: exported("types.ts", "ButtonProps"),
      onClick: exported("types.ts", "ButtonProps"),
    },
    dependencies: ["types.ts"],
    construction: ["import", "utility:Partial"],
  },
  {
    name: "Required, which takes `undefined` out of an optional member",
    project: "utilities",
    file: "Panel.uf.tsx",
    where: "Requireds(props: Required<ButtonProps>)",
    type: "Required<ButtonProps>",
    expected:
      '{ count: number; label: string; onClick: () => void; readonly size: "md" | "sm"; tone: "danger" | "neutral" }',
    dependencies: ["types.ts"],
    construction: ["utility:Required"],
  },
  {
    name: "Pick, with a union of keys",
    project: "utilities",
    file: "Panel.uf.tsx",
    where: 'Picked(props: Pick<ButtonProps, "label" | "tone">)',
    type: 'Pick<ButtonProps, "label" | "tone">',
    expected: '{ label: string; tone?: "danger" | "neutral" }',
    members: {
      label: exported("types.ts", "ButtonProps"),
      tone: exported("types.ts", "ButtonProps"),
    },
    dependencies: ["types.ts"],
    construction: ["utility:Pick"],
  },
  {
    name: "Omit, with a union of keys",
    project: "utilities",
    file: "Panel.uf.tsx",
    where: 'Omitted(props: Omit<ButtonProps, "onClick" | "count">)',
    type: 'Omit<ButtonProps, "onClick" | "count">',
    expected: '{ label: string; readonly size: "md" | "sm"; tone?: "danger" | "neutral" }',
    dependencies: ["types.ts"],
    construction: ["utility:Omit"],
  },
  {
    name: "Readonly",
    project: "utilities",
    file: "Panel.uf.tsx",
    where: "Readonlys(props: Readonly<ButtonProps>)",
    type: "Readonly<ButtonProps>",
    expected:
      '{ readonly count?: number | undefined; readonly label: string; readonly onClick?: () => void; readonly size: "md" | "sm"; readonly tone?: "danger" | "neutral" }',
    dependencies: ["types.ts"],
    construction: ["utility:Readonly"],
  },
  {
    name: "utilities nested and intersected",
    project: "utilities",
    file: "Panel.uf.tsx",
    where: 'Combined(props: Required<Pick<ButtonProps, "tone">> & Omit<ButtonProps, "tone">)',
    type: 'Required<Pick<ButtonProps, "tone">> & Omit<ButtonProps, "tone">',
    expected:
      '{ count?: number | undefined; label: string; onClick?: () => void; readonly size: "md" | "sm"; tone: "danger" | "neutral" }',
    dependencies: ["types.ts"],
    construction: ["intersection", "utility:Required", "utility:Pick", "utility:Omit"],
  },
  {
    name: "an interface that extends a utility type",
    project: "utilities",
    file: "Panel.uf.tsx",
    where: "Extending(props: IconButtonProps)",
    type: "IconButtonProps",
    expected:
      '{ count?: number | undefined; icon: string; onClick?: () => void; readonly size: "md" | "sm"; tone?: "danger" | "neutral" }',
    members: {
      icon: local("Panel.uf.tsx", "IconButtonProps"),
      tone: exported("types.ts", "ButtonProps"),
      size: exported("types.ts", "ButtonProps"),
      count: exported("types.ts", "ButtonProps"),
      onClick: exported("types.ts", "ButtonProps"),
    },
    dependencies: ["types.ts"],
    construction: ["extends", "utility:Omit"],
  },
  {
    name: "a generic interface, instantiated with a primitive",
    project: "generics",
    file: "List.uf.tsx",
    where: "Strings(props: ListProps<string>)",
    type: "ListProps<string>",
    expected: "{ items: string[]; onSelect: (item: string) => void; selected?: string }",
    members: {
      items: exported("types.ts", "ListProps"),
      selected: exported("types.ts", "ListProps"),
      onSelect: exported("types.ts", "ListProps"),
    },
    dependencies: ["types.ts"],
    construction: ["import", "generic"],
  },
  {
    name: "a generic interface, instantiated with a local interface",
    project: "generics",
    file: "List.uf.tsx",
    where: "Objects(props: ListProps<Option>)",
    type: "ListProps<Option>",
    expected:
      "{ items: { id: string; name: string }[]; onSelect: (item: { id: string; name: string }) => void; selected?: { id: string; name: string } }",
    dependencies: ["types.ts"],
    construction: ["generic"],
  },
  {
    name: "a generic interface, instantiated with a type parameter in scope",
    project: "generics",
    file: "List.uf.tsx",
    where: "List<T>(props: ListProps<T>)",
    type: "ListProps<T>",
    expected: "{ items: T[]; onSelect: (item: T) => void; selected?: T }",
    dependencies: ["types.ts"],
    construction: ["generic"],
  },
  {
    name: "a generic alias whose parameter defaults to another",
    project: "generics",
    file: "List.uf.tsx",
    where: "Defaulted(props: Pair<number>)",
    type: "Pair<number>",
    expected: "{ first: number; second: number }",
    members: { first: exported("types.ts", "Pair"), second: exported("types.ts", "Pair") },
    dependencies: ["types.ts"],
    construction: ["generic"],
  },
  {
    name: "a generic alias, instantiated with two arguments in order",
    project: "generics",
    file: "List.uf.tsx",
    where: "Explicit(props: Pair<number, string>)",
    type: "Pair<number, string>",
    expected: "{ first: number; second: string }",
    dependencies: ["types.ts"],
    construction: ["generic"],
  },
  {
    name: "a recursive generic interface",
    project: "generics",
    file: "List.uf.tsx",
    where: "Recursive(props: Tree<string>)",
    type: "Tree<string>",
    expected: "{ children: Tree<string>[]; value: string }",
    dependencies: ["types.ts"],
    construction: ["generic"],
  },
  {
    name: "a generic interface with a defaulted base and a generic alias",
    project: "generics",
    file: "List.uf.tsx",
    where: "Based(props: Boxed<number>)",
    type: "Boxed<number>",
    expected: "{ box: null | number; label: string }",
    members: { box: exported("types.ts", "Boxed"), label: exported("types.ts", "Labelled") },
    dependencies: ["types.ts"],
    construction: ["generic", "extends", "union"],
  },
  {
    name: "a utility over a generic instantiation",
    project: "generics",
    file: "List.uf.tsx",
    where: 'Picked(props: Pick<ListProps<number>, "items">)',
    type: 'Pick<ListProps<number>, "items">',
    expected: "{ items: number[] }",
    dependencies: ["types.ts"],
    construction: ["utility:Pick", "generic"],
  },
  {
    name: "a conditional type",
    project: "generics",
    file: "List.uf.tsx",
    where: "Conditional(props: { kind: Kind<string> })",
    type: "{ kind: Kind<string> }",
    expected: "{ kind: (unresolved) }",
    members: { kind: here("List.uf.tsx") },
    dependencies: [],
    construction: ["conditional"],
    unresolved: [
      { file: "List.uf.tsx", text: 'T extends string ? "text" : "other"', reason: "unsupported" },
    ],
    checker: { expected: '{ kind: "text" }', construction: [], unresolved: [] },
  },
  {
    name: "a mapped type",
    project: "generics",
    file: "List.uf.tsx",
    where: "Mapped(props: Flags)",
    type: "Flags",
    expected: "(unresolved)",
    dependencies: [],
    construction: ["mapped"],
    unresolved: [
      {
        file: "List.uf.tsx",
        text: '{ [K in "bold" | "italic"]?: string }',
        reason: "unsupported",
      },
    ],
    checker: { expected: "{ bold?: string; italic?: string }", construction: [], unresolved: [] },
  },
  {
    name: "a package's interface, through its `exports` and its own imports",
    project: "packages",
    file: "Badge.uf.tsx",
    where: "Exported(props: ButtonProps)",
    type: "ButtonProps",
    expected: '{ disabled?: boolean; id: string; label: string; tone?: "danger" | "neutral" }',
    members: {
      label: exported(pkg("ui-kit/types/index.d.ts"), "ButtonProps"),
      tone: exported(pkg("ui-kit/types/index.d.ts"), "ButtonProps"),
      id: exported(pkg("ui-kit/types/base.d.ts"), "BaseProps"),
      disabled: exported(pkg("ui-kit/types/base.d.ts"), "BaseProps"),
    },
    dependencies: ["pkg:ui-kit"],
    construction: ["import", "package", "extends", "union"],
  },
  {
    name: "a package's `export *` and a subpath export",
    project: "packages",
    file: "Badge.uf.tsx",
    where: "StarExport(props: BaseProps & { tone: Tone })",
    type: "BaseProps & { tone: Tone }",
    expected: '{ disabled?: boolean; id: string; tone: "danger" | "neutral" }',
    dependencies: ["pkg:ui-kit"],
    construction: ["intersection", "package"],
  },
  {
    name: "a scoped package's `types`, importing another package",
    project: "packages",
    file: "Badge.uf.tsx",
    where: "ScopedTypes(props: Tagged)",
    type: "Tagged",
    expected: '{ tags: string[]; tone: "danger" | "neutral" }',
    members: {
      tone: exported(pkg("@acme/types/index.d.ts"), "Tagged"),
      tags: exported(pkg("@acme/types/index.d.ts"), "Tagged"),
    },
    dependencies: ["pkg:@acme/types", "pkg:ui-kit"],
    construction: ["package"],
  },
  {
    name: "a package typed by DefinitelyTyped",
    project: "packages",
    file: "Badge.uf.tsx",
    where: "DefinitelyTyped(props: PlainProps)",
    type: "PlainProps",
    expected: "{ value: number }",
    members: { value: exported(pkg("plain/index.d.ts"), "PlainProps") },
    dependencies: ["pkg:plain"],
    construction: ["package"],
  },
  {
    name: "a utility over a package's interface",
    project: "packages",
    file: "Badge.uf.tsx",
    where: "Utility(props: Partial<ButtonProps>)",
    type: "Partial<ButtonProps>",
    expected: '{ disabled?: boolean; id?: string; label?: string; tone?: "danger" | "neutral" }',
    dependencies: ["pkg:ui-kit"],
    construction: ["utility:Partial", "package"],
  },
  {
    name: "a package that is not installed",
    project: "packages",
    file: "Badge.uf.tsx",
    where: "NotInstalled(props: Missing)",
    type: "Missing",
    expected: "(unresolved)",
    dependencies: ["pkg:not-installed"],
    unresolved: [{ file: "Badge.uf.tsx", text: "Missing", reason: "missing-module" }],
  },
  {
    name: "a subpath import of the project's `package.json`",
    project: "packages",
    file: "Badge.uf.tsx",
    where: "SubpathImport(props: Local)",
    type: "Local",
    expected: "(unresolved)",
    dependencies: [],
    unresolved: [{ file: "Badge.uf.tsx", text: "Local", reason: "missing-module" }],
  },
  {
    name: "a subpath import inside a package",
    project: "packages",
    file: "Badge.uf.tsx",
    where: "PackageSubpathImport(props: Kit)",
    type: "Kit",
    expected: "{ inner: (unresolved) }",
    dependencies: ["pkg:inner-kit"],
    unresolved: [{ file: pkg("inner-kit/index.d.ts"), text: "Inner", reason: "missing-module" }],
  },
  {
    name: "the copy of a package the root resolves",
    project: "packages",
    file: "Badge.uf.tsx",
    where: "RootCopy(props: Twin)",
    type: "Twin",
    expected: "{ v1: string }",
    members: { v1: exported(pkg("twin/index.d.ts"), "Twin") },
    dependencies: ["pkg:twin"],
  },
  {
    name: "another copy of a package, nested in a dependency",
    project: "packages",
    file: "Badge.uf.tsx",
    where: "NestedCopy(props: Uses)",
    type: "Uses",
    expected: "{ twin: (unresolved) }",
    dependencies: ["pkg:nested-user", "pkg:twin"],
    unresolved: [{ file: pkg("nested-user/index.d.ts"), text: "Twin", reason: "missing-module" }],
  },
  {
    name: "a dependency's own dependency, which the root resolves no copy of",
    project: "packages",
    file: "Badge.uf.tsx",
    where: "DependencyOfADependency(props: DeepProps)",
    type: "DeepProps",
    expected: '{ id: string; tone: "loud" | "soft" }',
    members: {
      tone: exported(pkg("ui-deep/index.d.ts"), "DeepProps"),
      id: exported(pkg("@deep/tokens@2.0.0/base.d.ts"), "DeepBase"),
    },
    dependencies: ["pkg:@deep/tokens", "pkg:ui-deep"],
    construction: ["package", "extends"],
  },
  {
    name: "a package's `typings`",
    project: "packages",
    file: "Badge.uf.tsx",
    where: "Typings(props: OldProps)",
    type: "OldProps",
    expected: "{ old: boolean }",
    members: { old: exported(pkg("old-typings/index.d.ts"), "OldProps") },
    dependencies: ["pkg:old-typings"],
  },
  {
    name: "a subpath a package does not export",
    project: "packages",
    file: "Badge.uf.tsx",
    where: "NotExported(props: Hidden)",
    type: "Hidden",
    expected: "(unresolved)",
    dependencies: ["pkg:ui-kit"],
    unresolved: [{ file: "Badge.uf.tsx", text: "Hidden", reason: "missing-module" }],
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

/** Where a fixture project holds a file: a package's file where the fixture installs it. */
function fixturePath(file: string): string {
  return file.startsWith("pkg:") ? `node_modules/${file.slice("pkg:".length)}` : file;
}

/** What a case compares: the canonical print, the members' origins, and what was unresolved. */
function observe(shape: TypeShape, project: string) {
  const root = shape.nodes[shape.root]!;
  const text = (file: string, start: number, end: number) =>
    readFileSync(`${FIXTURES}${project}/${fixturePath(file)}`, "utf8").slice(start, end);
  return {
    expected: printShape(shape, { canonical: true }),
    members:
      root.kind === "object"
        ? Object.fromEntries(
            root.members.map((member) => [
              member.name,
              {
                file: member.file,
                ...(member.declaration && {
                  declaration: member.declaration.name,
                  exported: member.declaration.exported,
                }),
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
 * projects in this package's `test/fixtures/`. Call it from the adapter's own test file, with
 * `{ checker: true }` for an adapter backed by a type-checker.
 */
export function typeOracleContract(
  adapter: string,
  createOracle: OracleFactory,
  options: ContractOptions = {},
): void {
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
      async (_, written) => {
        const testCase = options.checker ? { ...written, ...written.checker } : written;
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

    it.each([
      ["Pick, with a union of keys", '{ label: string; tone?: "neutral" | "danger" }'],
      ["a recursive generic interface", "{ value: string; children: Tree<string>[] }"],
      [
        "a package's interface, through its `exports` and its own imports",
        '{ label: string; tone?: "neutral" | "danger"; id: string; disabled?: boolean }',
      ],
    ])("prints %s", async (name, printed) => {
      const testCase = CONTRACT_CASES.find((each) => each.name === name)!;
      const oracle = oracles.get(testCase.project)!;
      expect(await oracle.printType(caseQuery(testCase))).toBe(printed);
    });
  });
}
