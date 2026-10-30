// A `.uf.ts` module's composable as a React custom hook, `useToggle.ts` (ADR-0069), on the
// machinery a component's setup uses (ADR-0046): the hook runs at every render of its caller, so
// its state is `useState` with a mirror, its functions are stable, one for the hook's life, its
// getter and callback arguments are read through mirrors in deferred code, as props are, and each
// state or derived value it returns comes with a live reader the caller's client code calls.
import {
  addTypeImports,
  componentTypes,
  js,
  pascalCase,
  printProgram,
  typeNames,
  typeSpecifier,
} from "@unframework/codegen";
import type { EmitContext, ImportSet, OutputFile } from "@unframework/codegen";
import type { ComposableMemberApi, TypeText, UfComposable } from "@unframework/ir";

import { compilerBailout, declaredNames } from "./bailouts.ts";
import { nextTickHelper } from "./helpers.ts";
import { planComponent, setupOwner } from "./plan.ts";
import { reactCode } from "./rules.ts";
import { printSetup } from "./setup.ts";

/** The binding kinds of what a module gives a composable, which React's call-site lane reads. */
const MODULE_KINDS = new Set(["moduleConst", "import"]);

/**
 * `useToggle.ts`: `export function useToggle(initial: boolean) { …; return { on, currentOn,
 * toggle, close }; }`, its setup in source order as a component's body prints it, and its
 * parameters as written.
 */
export function emitComposable(composable: UfComposable, context: EmitContext): OutputFile[] {
  const { module } = context;
  // A module's values reach a composable with the call site (ADR-0070): until then it is
  // reported, never emitted without them (P2).
  const moduleRead = composable.bindings.find((binding) => MODULE_KINDS.has(binding.kind));
  if (moduleRead) {
    context.report({
      code: "UF1002",
      severity: "error",
      message:
        "The react target does not read a module's values in a composable yet: it lands with this target's composables lane.",
      span: moduleRead.span,
    });
    return [];
  }
  const owner = setupOwner(composable);
  const plan = planComponent(owner, module, composable);
  const code = reactCode(plan);
  const setup = printSetup(plan, code);

  // The members, and each state's or derived value's live reader under the name the API's rule
  // gives it, which every caller applies too.
  const readers = liveReaderNames(
    composable.returns.map((member) => ({
      name: member.name,
      kind: memberKind(plan.bindings.get(member.binding)!.kind),
    })),
  );
  const returned = composable.returns.flatMap((member) => {
    const reader = readers.get(member.name);
    const local =
      plan.state.get(member.binding)?.current ?? plan.derived.get(member.binding)?.current;
    return [member.name, ...(reader && local ? [property(reader, local)] : [])];
  });
  const body = [
    ...setup.body,
    { text: `return { ${returned.join(", ")} };`, group: -1, compact: false },
  ];
  // A blank line between groups, unless both are one-line declarations, as a component's body.
  const statements = body.map(({ text, group, compact }, index) => {
    const next = body[index + 1];
    const apart = next && next.group !== group && !(compact && next.compact);
    return apart ? `${text}\n` : text;
  });

  const bound = composable.parameters.map(({ name }) => name);
  const locals = declaredNames(body.map(({ text }) => ({ code: text, kind: "statements" })));
  for (const name of bound) locals.add(name);
  const reason = compilerBailout(
    body.map(({ text }) => ({ code: text, kind: "statements" as const })),
    locals,
  );
  const optOut = reason
    ? [
        `// React Compiler 1.0 cannot compile ${reason} yet: the hook opts out of it.\n"use no memo";\n`,
      ]
    : [];
  const parameters = composable.parameters.map(
    (parameter) => `${parameter.name}${parameter.optional ? "?" : ""}: ${parameter.type.code}`,
  );
  const typeParameters = composable.typeParameters?.length
    ? `<${composable.typeParameters
        .map(({ name, constraint, default: fallback }) => {
          const extended = constraint ? ` extends ${constraint.code}` : "";
          return `${name}${extended}${fallback ? ` = ${fallback.code}` : ""}`;
        })
        .join(", ")}>`
    : "";

  const helpers = plan.helpers.nextTick
    ? [
        nextTickHelper(plan.helpers.nextTick, {
          useRef: plan.names.add("react", "useRef"),
          useReducer: plan.names.add("react", "useReducer"),
          useEffect: plan.names.add("react", "useEffect"),
        }),
      ]
    : [];
  // The types it imports, by name, from where the source imports them (ADR-0067).
  addTypeImports(owner, module, plan.names, (name) => name);
  addParameterTypeImports(composable, context, plan.names);
  const imports = plan.names.toDeclarations();
  const head = imports.length ? printProgram(js.program(imports)).trim() : "";
  const contents = [
    ...(head ? [head] : []),
    ...componentTypes(owner, module).map((declaration) =>
      declaration.exported ? `export ${declaration.code}` : declaration.code,
    ),
    ...(setup.module.length ? [setup.module.join("\n")] : []),
    `export function ${composable.name}${typeParameters}(${parameters.join(", ")}) {\n${[...optOut, ...statements].join("\n")}\n}`,
    ...helpers,
  ].join("\n\n");
  return [{ path: `${composable.name}.ts`, contents: `${contents}\n` }];
}

/**
 * The live readers a hook returns beside its members (ADR-0069), by member name: one for each
 * state or derived value `x`, `currentX`, or where that names another member or an earlier
 * reader, the first free one of `currentX_1`, `currentX_2`…. A rule of the API alone, so the
 * hook and its callers agree on every name.
 */
export function liveReaderNames(
  members: readonly Pick<ComposableMemberApi, "name" | "kind">[],
): Map<string, string> {
  const taken = new Set(members.map(({ name }) => name));
  const readers = new Map<string, string>();
  for (const { name, kind } of members) {
    if (kind !== "state" && kind !== "derived") continue;
    const base = `current${pascalCase(name)}`;
    let reader = base;
    for (let suffix = 1; taken.has(reader); suffix++) reader = `${base}_${suffix}`;
    taken.add(reader);
    readers.set(name, reader);
  }
  return readers;
}

/** A returned member's kind, by its binding's (`ReturnedMember`). */
function memberKind(kind: string): ComposableMemberApi["kind"] {
  switch (kind) {
    case "state":
      return "state";
    case "derived":
      return "derived";
    case "localFn":
      return "function";
    default:
      return "constant";
  }
}

/** `key: local`, or `key` where the two are one name. */
function property(key: string, local: string): string {
  return key === local ? key : `${key}: ${local}`;
}

/**
 * Imports the types the composable's parameters and type parameters name (ADR-0067), which its
 * setup owner holds no trace of, as the source imports them.
 */
function addParameterTypeImports(
  composable: UfComposable,
  { module }: EmitContext,
  imports: ImportSet,
): void {
  const texts: TypeText[] = [
    ...composable.parameters.map(({ type }) => type),
    ...(composable.typeParameters ?? []).flatMap(({ constraint, default: fallback }) =>
      [constraint, fallback].filter((type): type is TypeText => type !== undefined),
    ),
  ];
  const read = new Set(texts.flatMap((type) => [...typeNames(type)]));
  for (const entry of module.typeImports ?? []) {
    for (const name of entry.names) {
      if (!read.has(name.local)) continue;
      const specifier = typeSpecifier(entry.specifier, module, (each) => each);
      imports.add(specifier, name.imported, { type: true, local: name.local, exact: true });
    }
  }
}
