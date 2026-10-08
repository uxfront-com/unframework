// A component's props (ADR-0034): its one parameter, destructured with static
// defaults or kept as one object, typed by an object type the module declares or writes inline.
// The props are the type's members, in member order; each gets a binding expressions read it
// through, and the kinds of value it can have.

import {
  createBinding,
  createExpression,
  createProp,
  createPropsParameter,
  createTypeText,
  isIdentifier,
  reservedPropName,
  reservedPropsParameterName,
} from "@unframework/ir";
import type { Binding, Prop, PropsParameter } from "@unframework/ir";
import type { AST } from "@unframework/parser";

import type { Reporter } from "./context.ts";
import { checkCopiedText, checkMembers, closure, report } from "./declarations.ts";
import type { ModuleTypes } from "./declarations.ts";
import { checkDirectives, span } from "./expressions.ts";
import type { ComponentFunction, PropBinding } from "./render.ts";
import { memberName } from "./types/from-type.ts";
import { has, union, UNDEFINED, without } from "./types/kinds.ts";
import type { Kinds } from "./types/kinds.ts";

/** What a component's props parameter declares. */
export interface PropsAnalysis {
  props: Prop[];
  propsParameter: PropsParameter | undefined;
  /** The props' bindings, in source order. */
  bindings: Binding[];
  /** The names of the module's types the props reach, in source order. */
  types: string[];
  byName: Map<string, PropBinding>;
  byDeclaration: Map<object, PropBinding>;
  object: { declaration: object; name: string } | undefined;
  /**
   * Whether the props have a problem: one in a type the component shares with another is
   * reported once, so the reporter alone cannot tell.
   */
  failed: boolean;
}

/** A member of the props type, as the props are built from it. */
interface PropMember {
  name: string;
  member: AST.TSPropertySignature;
  type: AST.TSType;
}

/** Analyses a component's parameters as its props, reporting what no target can declare. */

export function analyzeProps(
  fn: ComponentFunction,
  types: ModuleTypes,
  source: string,
  comments: readonly AST.Comment[],
  reporter: Reporter,
): PropsAnalysis {
  const result: PropsAnalysis = {
    props: [],
    propsParameter: undefined,
    bindings: [],
    types: [],
    byName: new Map(),
    byDeclaration: new Map(),
    object: undefined,
    failed: false,
  };
  const mark = reporter.diagnostics.length;
  const [parameter, ...others] = fn.params;
  if (!parameter) return result;
  if (others.length) {
    reporter.report(
      "UF2001",
      { start: others[0]!.start, end: others.at(-1)!.end },
      "A component takes one parameter, its props.",
      { help: "Declare every prop as a member of the props type." },
    );
  }
  if (parameter.type === "TSParameterProperty") return result;
  if (parameter.type !== "Identifier" && parameter.type !== "ObjectPattern") {
    reporter.report(
      "UF2001",
      parameter,
      parameter.type === "AssignmentPattern"
        ? "The props parameter cannot have a default: give each optional prop its own."
        : "The props parameter is destructured as an object, or kept as one object.",
      { help: 'Write `({ label, tone = "info" }: Props)` or `(props: Props)`.' },
    );
    return result;
  }
  const annotation = parameter.typeAnnotation?.typeAnnotation;
  if (!annotation) {
    reporter.report("UF2001", parameter, "The props parameter needs a type annotation.", {
      help: "Annotate it with an object type: `({ label }: { label: string })`, or an interface the module declares.",
    });
    return result;
  }
  if (parameter.type === "Identifier" && !isIdentifier(parameter.name)) {
    reporter.unsupported(
      { start: parameter.start, end: parameter.start + parameter.name.length },
      `\`${parameter.name}\` is not written in ASCII letters, digits, \`_\` and \`$\`: Angular's expression lexer reads no other.`,
      { help: "Rename the parameter." },
    );
  } else if (parameter.type === "Identifier" && reservedPropsParameterName(parameter.name)) {
    reporter.report(
      "UF2001",
      { start: parameter.start, end: parameter.start + parameter.name.length },
      `\`${parameter.name}\` cannot name the props parameter: ${reservedPropsParameterName(parameter.name)!}.`,
      { help: "Rename the parameter: `props`." },
    );
  }
  if (parameter.type === "Identifier" && parameter.optional) {
    reporter.report(
      "UF2001",
      parameter,
      "The props parameter cannot be optional: a component always receives its props.",
      { help: "Remove the `?`, and make the props themselves optional." },
    );
  }
  checkDirectives(span(annotation), comments, reporter);
  // The outputs copy the annotation as written, as they copy a type declaration.
  checkCopiedText(span(annotation), source, reporter, "A props type");
  const members = propsMembers(annotation, types, reporter);
  if (!members) {
    result.failed = true;
    return result;
  }
  const object = parameter.type === "Identifier";
  result.types = closure(annotation, types.table);
  result.propsParameter = createPropsParameter(
    object ? "object" : "destructured",
    createTypeText(source.slice(annotation.start, annotation.end), span(annotation)),
    span(parameter),
    object ? parameter.name : undefined,
  );

  const pattern =
    parameter.type === "ObjectPattern" ? destructured(parameter, members, reporter) : undefined;
  const at = object
    ? { start: parameter.start, end: parameter.start + parameter.name.length }
    : undefined;
  if (object) result.object = { declaration: parameter, name: parameter.name };
  const names = new Set<string>();
  for (const { name, member, type } of members) {
    // A member declared twice is reported where its type is checked (UF2001), once for every
    // component that shares the type: each prop is declared once.
    if (names.has(name)) {
      result.failed = true;
      continue;
    }
    names.add(name);
    const reserved = reservedPropName(name);
    if (reserved) {
      result.failed = true;
      report(
        types,
        reporter,
        "UF2003",
        member.key,
        `\`${name}\` cannot be a prop's name: ${reserved}`,
        "Rename the prop.",
      );
    }
    const declared = types.table.kindsOf(type);
    if (castsToTrue(declared, name)) {
      result.failed = true;
      report(
        types,
        reporter,
        "UF1002",
        type,
        'Props that can be both a boolean and any string, `""` or the prop\'s own name are not supported yet: Vue reads `""` and the prop\'s own name as `true`. They land in M5.',
        'Type the strings as literals other than `""` and the prop\'s name, as in `boolean | "mixed"`.',
      );
    }
    const property = pattern?.get(name);
    const value = property?.value;
    const assigned = value?.type === "AssignmentPattern" ? value : undefined;
    const declaration = assigned ? assigned.left : value;
    let defaultValue: AST.Expression | undefined;
    if (assigned) {
      defaultValue = checkDefault(assigned.right, member, declared, source, comments, reporter);
    }
    const kinds =
      defaultValue !== undefined
        ? without(declared, "undefined")
        : member.optional
          ? union(declared, UNDEFINED)
          : declared;
    const binding =
      object && at
        ? createBinding(name, "prop", at)
        : declaration?.type === "Identifier"
          ? createBinding(name, "prop", span(declaration))
          : undefined;
    if (binding) result.bindings.push(binding);
    const prop: PropBinding = { name, id: binding?.id, kinds };
    result.byName.set(name, prop);
    if (declaration?.type === "Identifier") result.byDeclaration.set(declaration, prop);
    result.props.push(
      createProp(
        name,
        member.optional,
        createTypeText(source.slice(type.start, type.end), span(type)),
        span(member),
        binding?.id,
        defaultValue
          ? createExpression(source.slice(defaultValue.start, defaultValue.end), span(defaultValue))
          : undefined,
      ),
    );
  }
  result.bindings.sort((a, b) => a.span.start - b.span.start);
  if (reporter.hasErrorsSince(mark)) result.failed = true;
  return result;
}

/**
 * The members of a props type: an object type literal, or a reference to a local interface or
 * to an alias of either, followed through aliases. Anything else waits for M5's types.
 */
function propsMembers(
  annotation: AST.TSType,
  types: ModuleTypes,
  reporter: Reporter,
): PropMember[] | undefined {
  const seen = new Set<string>();
  let type: AST.TSType = annotation;
  let signatures: readonly AST.TSSignature[] | undefined;
  for (;;) {
    if (type.type === "TSTypeLiteral") {
      // An inline literal is checked here; a declaration where it is declared.
      if (type === annotation) checkMembers(type.members, types, reporter);
      signatures = type.members;
      break;
    }
    if (type.type === "TSParenthesizedType") {
      type = type.typeAnnotation;
      continue;
    }
    const name =
      type.type === "TSTypeReference" && type.typeName.type === "Identifier" && !type.typeArguments
        ? type.typeName.name
        : undefined;
    const declaration = name === undefined ? undefined : types.table.declaration(name);
    if (!declaration || seen.has(name!)) {
      reporter.unsupported(
        type,
        name === undefined
          ? "Props types other than an object type, an interface or an alias of one are not supported yet: unions, intersections, generics and utility types land in M5."
          : `\`${name}\` is not a type this module declares: imported and global props types land in M5.`,
        { help: "Declare the props type in the module: an interface, or an object type literal." },
      );
      return undefined;
    }
    seen.add(name!);
    if (declaration.node.type === "TSInterfaceDeclaration") {
      signatures = declaration.node.body.body;
      break;
    }
    type = declaration.node.typeAnnotation;
  }
  return signatures.flatMap((member): PropMember[] => {
    if (member.type !== "TSPropertySignature" || member.computed) return [];
    const name = memberName(member.key);
    const annotation = member.typeAnnotation?.typeAnnotation;
    return name === undefined || !annotation ? [] : [{ name, member, type: annotation }];
  });
}

/** Checks a destructured props pattern, and returns its properties by prop name. */
function destructured(
  pattern: AST.ObjectPattern,
  members: readonly PropMember[],
  reporter: Reporter,
): Map<string, AST.BindingProperty> {
  const properties = new Map<string, AST.BindingProperty>();
  for (const property of pattern.properties) {
    if (property.type === "RestElement") {
      reporter.report(
        "UF2001",
        property,
        "Rest props (`...rest`) are not props: a component's fallthrough is its `class` and `style`, which merge into its root (ADR-0054).",
        { help: "Destructure each prop by its name." },
      );
      continue;
    }
    const name = property.computed ? undefined : memberName(property.key);
    if (property.computed || property.key.type !== "Identifier" || name === undefined) {
      reporter.report(
        "UF2001",
        property.key,
        "The props pattern destructures each prop by its name: no computed or string keys.",
      );
      continue;
    }
    const value =
      property.value.type === "AssignmentPattern" ? property.value.left : property.value;
    if (value.type !== "Identifier") {
      reporter.report(
        "UF2001",
        value,
        `Nested patterns in the props are not supported: destructure \`${name}\`, and read its members (\`${name}.member\`).`,
      );
      continue;
    }
    if (value.name !== name) {
      reporter.report(
        "UF2001",
        property,
        `\`${name}: ${value.name}\` renames a prop: destructure it by its own name, which the targets declare.`,
        { help: `Write \`${name}\`, and read it as \`${name}\`.` },
      );
      continue;
    }
    if (!members.some((member) => member.name === name)) {
      reporter.report("UF2001", property.key, `\`${name}\` is not a member of the props type.`, {
        help: "Declare it in the props type, or remove it from the pattern.",
      });
      continue;
    }
    properties.set(name, property);
  }
  return properties;
}

/**
 * Checks a prop's default (ADR-0034) and returns it when it is valid: on an optional prop,
 * `null` on one whose type admits `null` (Qwik applies a destructured default to `null` too),
 * and static (UF2002): a literal, a negated number, a template literal without expressions, or
 * an array or object literal of those.
 */
function checkDefault(
  value: AST.Expression,
  member: AST.TSPropertySignature,
  declared: Kinds,
  source: string,
  comments: readonly AST.Comment[],
  reporter: Reporter,
): AST.Expression | undefined {
  const name = memberName(member.key)!;
  const mark = reporter.diagnostics.length;
  if (!member.optional) {
    reporter.report("UF2001", value, `\`${name}\` is required, so its default would never apply.`, {
      help: `Make it optional (\`${name}?:\`), or remove the default.`,
    });
  } else if (has(declared, "null") && !(value.type === "Literal" && value.value === null)) {
    reporter.report(
      "UF2001",
      value,
      `\`${name}\` can be \`null\`, and Qwik applies a destructured default to \`null\` too: its default can only be \`null\`.`,
      { help: "Remove the default, or remove `null` from the prop's type." },
    );
  }
  if (!isStatic(value)) {
    reporter.report(
      "UF2002",
      value,
      "A prop's default must be a static value: Vue hoists defaults out of the component, and Angular reads them before any input is set.",
      { help: "Write the value itself: a literal, or an array or object of literals." },
    );
  }
  checkCopiedText(span(value), source, reporter, "A prop's default");
  checkDirectives(span(value), comments, reporter);
  return reporter.hasErrorsSince(mark) ? undefined : value;
}

/**
 * Whether a default is static (ADR-0034): a prop's, and a parameter's of a function the setup
 * writes (ADR-0045), which the outputs evaluate where they declare it.
 */
export function isStatic(node: AST.Expression): boolean {
  switch (node.type) {
    case "Literal":
      return !("regex" in node && node.regex) && !("bigint" in node && node.bigint !== undefined);
    case "UnaryExpression":
      return (
        node.operator === "-" &&
        node.argument.type === "Literal" &&
        typeof node.argument.value === "number"
      );
    case "TemplateLiteral":
      return !node.expressions.length;
    case "ArrayExpression":
      return node.elements.every(
        (element) => element !== null && element.type !== "SpreadElement" && isStatic(element),
      );
    case "ObjectExpression":
      return node.properties.every(
        (property) =>
          property.type === "Property" &&
          property.kind === "init" &&
          !property.method &&
          !property.computed &&
          !property.shorthand &&
          (property.key.type === "Identifier" ||
            (property.key.type === "Literal" && typeof property.key.value === "string")) &&
          isStatic(property.value),
      );
    default:
      return false;
  }
}

/**
 * Whether Vue may read a value of a prop as `true` (ADR-0034): it declares a prop that can be a
 * boolean and a string as `[Boolean, String]`, and casts `""` and the prop's own name in kebab
 * case to `true`. A union of string literals that holds neither renders as the others do.
 */
function castsToTrue(declared: Kinds, name: string): boolean {
  if (!has(declared, "boolean") || !has(declared, "string")) return false;
  const { strings } = declared;
  const kebab = name.replaceAll(/\B([A-Z])/g, "-$1").toLowerCase();
  return !strings || strings.has("") || strings.has(kebab);
}
