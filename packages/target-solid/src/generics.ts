// Generic components as Solid writes them (ADR-0068): a generic function component,
// `function List<T>(props: ListProps<T>)`, whose consumers' JSX infers `T` from the props they
// pass. The interfaces the output declares beside the props type (its events', models' and
// slots') take the type parameters their members read, `PickerSlots<T>`, so a scoped slot's fill
// is typed with the consumer's `T` (`generic-slot-props`, native).
import { js, typeNames } from "@unframework/codegen";
import type { Placeholders } from "@unframework/codegen";
import type { BindingId, Span, TypeDeclaration, TypeParameter, UfComponent } from "@unframework/ir";

type TypeParameterDeclaration = NonNullable<
  ReturnType<typeof js.functionDeclaration>["typeParameters"]
>;

/**
 * The component function's type parameters, `<T extends Item = Item>`, as the source writes
 * them, or `null` for a component that is not generic.
 */
export function typeParameterDeclaration(
  component: UfComponent,
  placeholders: Placeholders,
): TypeParameterDeclaration | null {
  if (!component.typeParameters?.length) return null;
  return {
    type: "TSTypeParameterDeclaration",
    params: component.typeParameters.map((parameter) => ({
      type: "TSTypeParameter",
      name: js.bindingIdentifier(parameter.name),
      constraint: parameter.constraint ? placeholders.type(parameter.constraint.code) : null,
      default: parameter.default ? placeholders.type(parameter.default.code) : null,
      in: false,
      out: false,
      const: false,
      start: 0,
      end: 0,
    })),
    start: 0,
    end: 0,
  };
}

/** An interface the output declares beside the props type, and how the props parameter names it. */
export interface GeneratedInterface {
  declaration: TypeDeclaration;
  /** `PickerSlots<T>`, or the bare name when its members read no type parameter. */
  reference: string;
}

/**
 * An exported interface of members, generic over the component's type parameters its members
 * read, in their declared order: `export interface PickerSlots<T> { item?: …; }`.
 */
export function generatedInterface(
  component: UfComponent,
  name: string,
  members: readonly string[],
  span: Span,
): GeneratedInterface {
  const read = typeNames(`{\n${members.join("\n")}\n}`);
  // A parameter's constraint or default may name an earlier one (`U extends T`), which the
  // interface then declares too.
  for (const parameter of (component.typeParameters ?? []).toReversed()) {
    if (!read.has(parameter.name)) continue;
    for (const text of [parameter.constraint, parameter.default]) {
      if (text) for (const each of typeNames(text)) read.add(each);
    }
  }
  const parameters = (component.typeParameters ?? []).filter((each) => read.has(each.name));
  const declared = parameters.length ? `<${parameters.map(parameterText).join(", ")}>` : "";
  const applied = parameters.length ? `<${parameters.map((each) => each.name).join(", ")}>` : "";
  return {
    declaration: {
      name,
      exported: true,
      code: `interface ${name}${declared} {\n${members.join("\n")}\n}`,
      span,
    },
    reference: `${name}${applied}`,
  };
}

/**
 * The type of the component's own model bound to `binding`, where it reads one of the
 * component's type parameters (`defineModel<T>`), or none.
 */
export function genericModelType(component: UfComponent, binding: BindingId): string | undefined {
  const model = component.setup.find((item) => item.kind === "Model" && item.binding === binding);
  if (model?.kind !== "Model" || !model.type) return undefined;
  const read = typeNames(model.type);
  return component.typeParameters?.some(({ name }) => read.has(name)) ? model.type.code : undefined;
}

/** `T extends Item = Item`, as written. */
function parameterText(parameter: TypeParameter): string {
  const constraint = parameter.constraint ? ` extends ${parameter.constraint.code}` : "";
  const fallback = parameter.default ? ` = ${parameter.default.code}` : "";
  return `${parameter.name}${constraint}${fallback}`;
}
