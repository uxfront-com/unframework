// Generic components as Qwik writes them (ADR-0068): `component$` takes a generic arrow,
// `component$(<T,>(props: ListProps<T>) => …)`, and TypeScript's inference from a generic
// function argument makes the component it returns generic too, so a consumer's JSX infers `T`
// from the props it passes. No cast and no helper: the cell is native. The interfaces the output
// declares beside the props type (its events', models' and slots') take the type parameters their
// members read, `PickerSlots<T>`, so a scoped slot's fill is typed with the consumer's `T`
// (`generic-slot-props`, native).
import { codeKind, codeNames, js, typeNames } from "@unframework/codegen";
import type { Placeholders } from "@unframework/codegen";
import type {
  BindingId,
  FunctionCode,
  Span,
  TypeDeclaration,
  TypeParameter,
  UfComponent,
} from "@unframework/ir";

type TypeParameterDeclaration = NonNullable<ReturnType<typeof js.arrowFunction>["typeParameters"]>;

/**
 * The arrow's type parameters, `<T extends Item = Item>`, as the source writes them, or `null`
 * for a component that is not generic.
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

/** An interface the output declares beside the props type, and how the props type names it. */
export interface GeneratedInterface {
  declaration: TypeDeclaration;
  /** `PickerSlots<T>`, or the bare name when its members read no type parameter. */
  reference: string;
}

/**
 * An exported interface of members, generic over the component's type parameters its members
 * read, in their declared order: `export interface PickerSlots<T> { item$?: …; }`. A parameter
 * the members don't read is left out, or lint reports it unused (L5).
 */
export function generatedInterface(
  component: UfComponent,
  name: string,
  members: readonly string[],
  span: Span,
): GeneratedInterface {
  // A parameter's constraint or default may name an earlier one (`U extends T`), which the
  // interface then declares too.
  const parameters = namedParameters(component, typeNames(`{\n${members.join("\n")}\n}`));
  const declared = parametersText(parameters);
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
 * The type of the component's own model or state bound to `binding`, where it reads one of the
 * component's type parameters (`defineModel<T>`, `ref<T[]>`), or none: a form control's
 * `v-model` writes the control's value as that type, since it is one of the options or the text
 * the consumer's `T` types (ADR-0068).
 */
export function genericModelType(component: UfComponent, binding: BindingId): string | undefined {
  const item = component.setup.find(
    (each) => (each.kind === "Model" || each.kind === "State") && each.binding === binding,
  );
  if ((item?.kind !== "Model" && item?.kind !== "State") || !item.type) return undefined;
  return readsTypeParameter(component, typeNames(item.type)) ? item.type.code : undefined;
}

/**
 * The setup constants and functions that stay inside the generic arrow, where `T` is in scope:
 * a constant whose code names one of the component's type parameters (`const empty: T[] = []`),
 * which has no type parameters of its own, and a function that names one its parameters' types
 * don't (`function blank(): T[]`), whose calls could not infer it; a getter that calls one
 * declares it inside itself (./setup.ts `getterSource`). Any other function typed by `T` moves to
 * module scope with its own ({@link moduleTypeParameters}), so a getter's `$` scope can call it
 * (ADR-0045).
 */
export function typedByParameters(component: UfComponent): Set<BindingId> {
  const found = new Set<BindingId>();
  if (!component.typeParameters?.length) return found;
  for (const item of component.setup) {
    if (item.kind === "Const") {
      const names = codeNames(item.value.code);
      if (item.type) for (const name of typeNames(item.type)) names.add(name);
      if (readsTypeParameter(component, names)) found.add(item.binding);
    } else if (item.kind === "Function") {
      const named = functionTypeNames(component, item.function);
      const inferred = parameterTypeNames(item.function);
      const parameters = component.typeParameters.filter(({ name }) => named.has(name));
      if (parameters.some(({ name }) => !inferred.has(name))) found.add(item.binding);
    }
  }
  return found;
}

/**
 * The type parameters a setup function that moves to module scope declares, `<T extends Item>`:
 * the component's that its code names, closed over their constraints and defaults, or `""`. An
 * arrow's lone `<T>` is written `<T,>`, which TSX would otherwise read as a tag.
 */
export function moduleTypeParameters(
  component: UfComponent,
  fn: FunctionCode,
  arrow: boolean,
): string {
  return parametersText(namedParameters(component, functionTypeNames(component, fn)), arrow);
}

/** Every name a function's parameter types, return type and body read. */
function functionTypeNames(component: UfComponent, fn: FunctionCode): Set<string> {
  const names = parameterTypeNames(fn);
  if (fn.returnType) for (const name of typeNames(fn.returnType)) names.add(name);
  for (const name of codeNames(fn.body.code, codeKind(fn.body, component))) names.add(name);
  return names;
}

/** The names a function's parameter types read. */
function parameterTypeNames(fn: FunctionCode): Set<string> {
  const names = new Set<string>();
  for (const parameter of fn.parameters) {
    if (parameter.type) for (const name of typeNames(parameter.type)) names.add(name);
  }
  return names;
}

/**
 * The component's type parameters that `read` names, in their declared order, with those their
 * constraints and defaults name (`U extends T` keeps `T`).
 */
function namedParameters(component: UfComponent, read: Set<string>): TypeParameter[] {
  const names = new Set(read);
  const parameters = component.typeParameters ?? [];
  // To a fixed point: a constraint may name a later parameter too (`A extends Box<B>, B extends
  // Box<C>, C`).
  for (let size = -1; size !== names.size;) {
    size = names.size;
    for (const parameter of parameters) {
      if (!names.has(parameter.name)) continue;
      for (const text of [parameter.constraint, parameter.default]) {
        if (text) for (const each of typeNames(text)) names.add(each);
      }
    }
  }
  return parameters.filter((each) => names.has(each.name));
}

/** `<T extends Item = Item>`, or `""`; `<T,>` for an arrow, which TSX would read as a tag. */
function parametersText(parameters: readonly TypeParameter[], arrow = false): string {
  if (!parameters.length) return "";
  const [only] = parameters;
  const lone = arrow && parameters.length === 1 && !only!.constraint && !only!.default;
  return `<${parameters.map(parameterText).join(", ")}${lone ? "," : ""}>`;
}

/** Whether `names` holds one of the component's type parameters. */
function readsTypeParameter(component: UfComponent, names: ReadonlySet<string>): boolean {
  return component.typeParameters?.some(({ name }) => names.has(name)) ?? false;
}

/** `T extends Item = Item`, as written. */
function parameterText(parameter: TypeParameter): string {
  const constraint = parameter.constraint ? ` extends ${parameter.constraint.code}` : "";
  const fallback = parameter.default ? ` = ${parameter.default.code}` : "";
  return `${parameter.name}${constraint}${fallback}`;
}
