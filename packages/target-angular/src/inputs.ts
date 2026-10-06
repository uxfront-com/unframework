// The component class's members (design §5.5): one signal input per prop, and one member per
// allowed global the template reads.
import { js } from "@unframework/codegen";
import type { ImportSet, Placeholders } from "@unframework/codegen";
import { expressionsOf } from "@unframework/ir";
import type { Prop, TypeDeclaration, UfComponent } from "@unframework/ir";

import { withoutUndefined } from "./types.ts";

type Member = ReturnType<typeof js.propertyDefinition>;

/**
 * The class's members: every prop as a public signal input, in member order, whether the
 * template reads it or not (a prop is the component's API, and Angular reports a consumer's
 * value for an undeclared input, NG0303); then each allowed global the expressions read.
 * `declarations` are the types the props reach (for an alias that admits `undefined`).
 */
export function classMembers(
  component: UfComponent,
  imports: ImportSet,
  placeholders: Placeholders,
  declarations: readonly TypeDeclaration[],
): Member[] {
  const members = component.props.map((prop) =>
    inputMember(prop, imports.add("@angular/core", "input"), placeholders, declarations),
  );
  for (const name of globalsOf(component)) {
    members.push(
      js.propertyDefinition(name, js.identifier(name), {
        accessibility: "protected",
        readonly: true,
      }),
    );
  }
  return members;
}

/**
 * A prop as a signal input, typed by its member's type as written:
 * - required: `readonly label = input.required<string>();`
 * - optional without a default: `readonly count = input<number>();`, whose value is
 *   `number | undefined` (Angular's own spelling of an optional input);
 * - with a default: `readonly tone = input<Tone, Tone | undefined>("info", { transform })`, whose
 *   transform turns `undefined` into the default. A destructured default applies to an absent
 *   prop and to an explicit `undefined` alike, while Angular's initial value covers only the
 *   first (`setInput(name, undefined)` sets `undefined`). `null` is a value, as in JavaScript,
 *   so the test is `=== undefined`, never `??` (design §1.1).
 */
function inputMember(
  prop: Prop,
  input: string,
  placeholders: Placeholders,
  declarations: readonly TypeDeclaration[],
): Member {
  const callee = js.identifier(input);
  const { type, default: initial } = prop;
  if (!prop.optional) {
    const required = js.memberExpression(callee, "required");
    return readonlyField(prop, js.callExpression(required, [], [placeholders.type(type.code)]));
  }
  if (initial === undefined) {
    return readonlyField(prop, js.callExpression(callee, [], [placeholders.type(type.code)]));
  }
  const value = withoutUndefined(type.code, declarations);
  const transform = js.arrowFunction(
    [js.bindingIdentifier("value")],
    js.conditionalExpression(
      js.binaryExpression("===", js.identifier("value"), js.identifier("undefined")),
      placeholders.expression(initial.code),
      js.identifier("value"),
    ),
  );
  return readonlyField(
    prop,
    js.callExpression(
      callee,
      [placeholders.expression(initial.code), js.objectExpression([["transform", transform]])],
      [
        placeholders.type(value),
        js.unionType([placeholders.type(value), js.keywordType("undefined")]),
      ],
    ),
  );
}

/** `readonly name = …;`: public, as `strictInputAccessModifiers` requires of an input. */
function readonlyField(prop: Prop, value: Parameters<typeof js.propertyDefinition>[1]): Member {
  return js.propertyDefinition(prop.name, value, { readonly: true });
}

/**
 * The allowed globals a component's expressions read (`Math`, `String`), each once, by name: a
 * template sees only its component's members, so each becomes a member of the same name.
 * `undefined` is a keyword of Angular's expression language and needs none.
 */
function globalsOf(component: UfComponent): string[] {
  const names = new Set<string>();
  for (const { expression } of expressionsOf(component)) {
    for (const reference of expression.refs) {
      if (reference.kind === "Global" && reference.name !== "undefined") names.add(reference.name);
    }
  }
  return [...names].toSorted();
}
