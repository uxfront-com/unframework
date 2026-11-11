// A `.uf.ts` module's composable as a React custom hook, `useToggle.ts` (ADR-0069), on the
// machinery a component's setup uses (ADR-0046): the hook runs at every render of its caller, so
// its state is `useState` with a mirror, its functions are stable, one for the hook's life, its
// getter and callback arguments are read through mirrors in deferred code, as props are, and each
// state or derived value it returns comes with a live reader the caller's client code calls.
import {
  addTypeImports,
  componentTypes,
  js,
  parseExpressionSource,
  printProgram,
  typeNames,
  typeSpecifier,
} from "@unframework.dev/codegen";
import type { EmitContext, ImportSet, OutputFile } from "@unframework.dev/codegen";
import type { ComposableMemberApi, Span, TypeText, UfComposable } from "@unframework.dev/ir";

import { compilerBailout, declaredNames } from "./bailouts.ts";
import { nextTickHelper } from "./helpers.ts";
import { moduleReads } from "./modules.ts";
import { liveReaderNames, planComponent, setupOwner } from "./plan.ts";
import { reactCode } from "./rules.ts";
import { printSetup } from "./setup.ts";

/**
 * `useToggle.ts`: `export function useToggle(initial: boolean) { …; return { on, currentOn,
 * toggle, close }; }`, its setup in source order as a component's body prints it, and its
 * parameters as written.
 */
export function emitComposable(composable: UfComposable, context: EmitContext): OutputFile[] {
  const { module } = context;
  // A setup constant evaluates once, as `useState`'s initial value (ADR-0046), which React calls
  // when it is a function: a getter or a callback argument held in one would become what it
  // returns. Read the argument where it is used instead (P2).
  const held = heldArgument(composable);
  if (held) {
    context.report({
      code: "UF1002",
      severity: "error",
      message:
        "The react target does not hold a composable's getter or callback argument in a constant yet: call or pass the argument where it is used.",
      span: held,
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
  // A function render code calls too is returned as its client variant, the stable one that
  // reads through the mirrors, since the caller's client code calls it.
  const returned = composable.returns.flatMap((member) => {
    const reader = readers.get(member.name);
    const local =
      plan.state.get(member.binding)?.current ?? plan.derived.get(member.binding)?.current;
    const variant = plan.clientVariants.get(member.binding);
    return [
      property(member.name, variant ?? member.name),
      ...(reader && local ? [property(reader, local)] : []),
    ];
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
  // The module's values it reads, as the source declares and imports them (ADR-0070).
  const reads = moduleReads(owner, module, plan.names, [
    ...composable.parameters.map(({ type }) => type),
    ...(composable.typeParameters ?? []).flatMap(({ constraint, default: fallback }) =>
      [constraint, fallback].filter((type): type is TypeText => type !== undefined),
    ),
  ]);
  // The types it imports, by name, from where the source imports them (ADR-0067).
  addTypeImports(owner, module, plan.names, (name) => name);
  addParameterTypeImports(composable, context, plan.names);
  const imports = plan.names.toDeclarations();
  const head = imports.length ? printProgram(js.program(imports)).trim() : "";
  const contents = [
    ...(head ? [head] : []),
    ...[...componentTypes(owner, module), ...reads.types]
      .toSorted((a, b) => a.span.start - b.span.start)
      .map((declaration) =>
        declaration.exported ? `export ${declaration.code}` : declaration.code,
      ),
    ...(reads.constants.length ? [reads.constants.join("\n")] : []),
    ...(setup.module.length ? [setup.module.join("\n")] : []),
    `export function ${composable.name}${typeParameters}(${parameters.join(", ")}) {\n${[...optOut, ...statements].join("\n")}\n}`,
    ...helpers,
  ].join("\n\n");
  return [{ path: `${composable.name}.ts`, contents: `${contents}\n` }];
}

/**
 * Where a constant's value holds a getter or a callback argument as a value, rather than calling
 * it or reading a member of it, or `undefined`. A state's value that may be a function is
 * UF2021 already.
 */
function heldArgument(composable: UfComposable): Span | undefined {
  const functions = new Set(
    composable.parameters.flatMap(({ kind, binding }) => (kind === "value" ? [] : [binding])),
  );
  for (const item of composable.setup) {
    if (item.kind !== "Const") continue;
    const { value } = item;
    const references = value.refs.filter(
      (each) => each.kind === "Binding" && functions.has(each.binding),
    );
    if (!references.length) continue;
    // Where the argument is a callee or a member's object, by its start in the code.
    const used = new Set<number>();
    const visit = (node: unknown): void => {
      if (Array.isArray(node)) {
        for (const each of node) visit(each);
        return;
      }
      if (!node || typeof node !== "object") return;
      const fields = node as {
        type?: unknown;
        callee?: { start: number };
        object?: { start: number };
      };
      if (fields.type === "CallExpression") used.add(fields.callee!.start);
      if (fields.type === "MemberExpression") used.add(fields.object!.start);
      for (const [key, child] of Object.entries(node)) if (key !== "parent") visit(child);
    };
    visit(parseExpressionSource(value.code).expression);
    const held = references.find((reference) => !used.has(reference.span.start - value.span.start));
    if (held) return held.span;
  }
  return undefined;
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
