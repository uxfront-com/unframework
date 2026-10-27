// A component's props (ADR-0034): its one parameter, destructured with static
// defaults or kept as one object, typed by an object type the module declares or writes inline,
// or one the type oracle resolves (ADR-0067): imported, extended, intersected or built with a
// utility type. The props are the type's members, in member order; each gets a binding
// expressions read it through, and the kinds of value it can have.

import type { DiagnosticCode } from "@unframework/diagnostics";
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
import type { Binding, DeclaredBy, Prop, PropsParameter, Span, TypeText } from "@unframework/ir";
import { parseModule, visitorKeys } from "@unframework/parser";
import type { AST, ParsedModule, TypeDeclarationStatement } from "@unframework/parser";
import type { ObjectNode, ShapeMember, TypeShape, UnresolvedType } from "@unframework/type-oracle";

import { Reporter } from "./context.ts";
import {
  checkCopiedText,
  checkMembers,
  checkType,
  closure,
  declaredTwice,
  FUNCTIONS,
  INTERSECTION,
  needsChecker,
  notAProp,
  report,
  undeclared,
} from "./declarations.ts";
import type { ModuleTypes } from "./declarations.ts";
import { checkDirectives, span } from "./expressions.ts";
import type { ComponentFunction, PropBinding } from "./render.ts";
import { visit as walkTypes } from "./shapes.ts";
import type { Shapes } from "./shapes.ts";
import { kindsFromShape } from "./types/from-shape.ts";
import type { ShapeReading } from "./types/from-shape.ts";
import { memberName } from "./types/from-type.ts";
import type { TypeTable } from "./types/from-type.ts";
import { has, union, UNDEFINED, UNKNOWN, without } from "./types/kinds.ts";
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
  optional: boolean;
  /** Where its key is written in this module: a problem with its name is reported there. */
  key: Span;
  /** Its type's text, as the prop holds it. */
  type: TypeText;
  /** Where a problem with its type is reported, in this module. */
  at: Span;
  /** The prop's span. */
  span: Span;
  kinds: Kinds;
  declaredBy?: DeclaredBy;
}

/** Analyses a component's parameters as its props, reporting what no target can declare. */

export function analyzeProps(
  fn: ComponentFunction,
  types: ModuleTypes,
  shapes: Shapes,
  parsed: ParsedModule,
  reporter: Reporter,
): PropsAnalysis {
  const { source, comments } = parsed;
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
  const read = shapeMembers(annotation, types, shapes, parsed, reporter);
  if (!read) {
    result.failed = true;
    return result;
  }
  // A problem in a member's type fails the component, and its other members are still read,
  // so their own problems are reported too.
  const { members } = read;
  if (read.failed) result.failed = true;
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
  for (const member of members) {
    const { name } = member;
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
    const declared = member.kinds;
    if (castsToTrue(declared, name)) {
      result.failed = true;
      report(
        types,
        reporter,
        "UF1002",
        member.at,
        'Props that can be both a boolean and any string, `""` or the prop\'s own name are not supported: Vue reads `""` and the prop\'s own name as `true`, which the other targets do not.',
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
        member.type,
        member.span,
        binding?.id,
        defaultValue
          ? createExpression(source.slice(defaultValue.start, defaultValue.end), span(defaultValue))
          : undefined,
        member.declaredBy,
      ),
    );
  }
  result.bindings.sort((a, b) => a.span.start - b.span.start);
  if (reporter.hasErrorsSince(mark)) result.failed = true;
  return result;
}

/** Reports a problem of a props type, and fails the component it was found for. */
type Problem = (code: DiagnosticCode, at: Span, message: string, help?: string) => void;

/**
 * The members of a props type read from its shape (ADR-0067), whether the module declares it or
 * writes it in place, or imports, extends, intersects, or builds it with a utility type. A member
 * this module writes keeps its own span and its type's text as written, as the outputs copy them.
 * A member another file writes is reported at the props annotation, the one span of it this
 * module holds, and its prop takes the annotation's span and the declaring file's text, with
 * `declaredBy` naming where it is written. So does a member of another declaration of this
 * module, at its own span. A problem of a type that components share is reported once, and fails
 * each of them: `failed` says so. No members are read where the shape is not an object.
 */
function shapeMembers(
  annotation: AST.TSType,
  types: ModuleTypes,
  shapes: Shapes,
  parsed: ParsedModule,
  reporter: Reporter,
): { members: PropMember[]; failed: boolean } | undefined {
  const at = span(annotation);
  const shape = shapes(at);
  if (!shape) {
    // `compile()` asks its oracle for every props annotation (`shapeQueries`); an oracle that
    // failed is reported there.
    reporter.report("UF6001", at, "The type oracle gave no shape for this props type.", {
      help: "Give `analyze` the shape of every type `shapeQueries` names.",
    });
    return undefined;
  }
  let failed = false;
  const problem: Problem = (code, where, message, help) => {
    failed = true;
    report(types, reporter, code, where, message, help);
  };
  const { file, source } = parsed;
  const here = (entry: { file: string; span: Span }) => (entry.file === file ? entry.span : at);
  const { properties: signatures, callables, intersections } = signaturesOf(parsed.program);
  // The intersections whose non-object parts are reported: what the oracle merged of their
  // object parts may be an empty object, which is not reported again.
  const lost = new Set<AST.TSIntersectionType>();
  let lostElsewhere = false;
  const textOf = (entry: UnresolvedType) => {
    if (entry.file === file) return source.slice(entry.span.start, entry.span.end);
    const node = shape.nodes.find(
      (each) =>
        each.kind === "opaque" &&
        each.file === entry.file &&
        each.span.start === entry.span.start &&
        each.span.end === entry.span.end,
    );
    return node?.kind === "opaque" ? node.text : "a type";
  };
  const root = shape.nodes[shape.root]!;
  const members = root.kind === "object" ? root.members : [];
  // The members two declarations type differently, each with the declarations that write it.
  const { found: conflicting, complete } =
    root.kind === "object"
      ? overrides(annotation, shape, types, parsed)
      : { found: new Map<string, Set<string>>(), complete: false };
  // What this module writes is checked where it is written, as the syntax gives it (ADR-0034):
  // each object type the annotation writes in place, and each declaration it reaches but a
  // generic one, which is reported itself, outside a utility's or a generic's type arguments,
  // whose members only the shape knows (an `Omit` drops some). The shape checks the rest, and
  // what other files write. A props type that is no object is reported as a whole (UF6004). A
  // declaration two components share reports its problems once, and fails both.
  const imports = typeImportsOf(parsed.program);
  const shaped = new Set(imports.keys());
  const scope =
    root.kind === "object"
      ? syntaxScope(annotation, types)
      : { members: [], types: [], signatures: new Set<number>() };
  // A name the oracle could not resolve here is its to report: it knows what the name is.
  const unresolvedHere = new Set(
    shape.unresolved
      .filter((entry) => entry.file === file)
      .map((entry) => `${entry.span.start}:${entry.span.end}`),
  );
  const checked: Span[] = [];
  const syntax = (check: (probe: Reporter) => void) => {
    const probe = new Reporter(reporter.file);
    check(probe);
    for (const diagnostic of probe.diagnostics) {
      const { start, end } = diagnostic.span;
      if (diagnostic.code === "UF6001" && unresolvedHere.has(`${start}:${end}`)) continue;
      checked.push(diagnostic.span);
      // The syntax names a construct it does not know "This type", and an operator by itself
      // (`keyof`); the source text names it whole.
      const [message, help] = /^(This type|`[a-z]+`) needs a type checker/.test(diagnostic.message)
        ? needsChecker(quoted(source.slice(diagnostic.span.start, diagnostic.span.end)))
        : [diagnostic.message, diagnostic.help];
      problem(diagnostic.code, diagnostic.span, message, help);
    }
  };
  const fresh: ModuleTypes = { ...types, reported: new Set() };
  for (const list of scope.members) {
    syntax((probe) => checkMembers(list, fresh, probe, shaped));
  }
  for (const type of scope.types) {
    syntax((probe) => checkType(type, fresh, probe, shaped));
  }
  /**
   * Whether an intersection's part is a name reported where it is named: an alias this module
   * declares, which the syntax did not check as a prop's type (that reports its problem itself).
   */
  const namedAlone = (part: AST.TSType) => {
    if (part.type !== "TSTypeReference" || part.typeName.type !== "Identifier") return false;
    const declaration = part.typeArguments
      ? undefined
      : types.table.declaration(part.typeName.name);
    return declaration !== undefined && !reportedAt(declaration.span);
  };
  /** Whether the syntax reported a problem in a span, or around it. */
  const reportedAt = (where: Span) =>
    checked.some(
      (each) =>
        (each.start <= where.start && where.end <= each.end) ||
        (where.start <= each.start && each.end <= where.end),
    );
  for (const entry of shape.unresolved) {
    // A construct this module writes is the syntax's to report, in the catalogue's words.
    if (entry.reason === "unsupported" && entry.file === file && reportedAt(entry.span)) continue;
    const text = quoted(textOf(entry));
    const where = entry.file === file ? "" : ` in \`${entry.file}\``;
    switch (entry.reason) {
      case "missing-module":
        problem(
          "UF6001",
          here(entry),
          `${text}${where} cannot be resolved: the type oracle cannot read the module it is imported from.`,
          "Check the import's path, and that the package ships its types.",
        );
        break;
      case "missing-export":
        problem(
          "UF6001",
          here(entry),
          `${text}${where} cannot be resolved: the module it is imported from does not export it.`,
          "Check the name, and export the type from its module.",
        );
        break;
      case "external":
        problem(
          "UF6001",
          here(entry),
          `${text} is imported, and without the compiler's shapes the analyser reads only this module's types.`,
          "Compile the module with `compile()`, whose type oracle resolves imported types.",
        );
        break;
      case "unsupported":
        // A call or construct signature this module writes is a function, which no oracle makes
        // a prop (ADR-0034).
        if (entry.file === file && callables.has(entry.span.start)) {
          problem("UF1002", entry.span, FUNCTIONS);
        } else if (
          entry.file === file &&
          intersections
            .get(entry.span.start)
            ?.types.some((part) => part.start === entry.span.start && !namedAlone(part))
        ) {
          // The oracle merges an intersection's object parts and reports each other part, such
          // as a brand's `string` in `string & {}`: the intersection is the construct. A named
          // part is reported where it is named, as any other construct.
          const intersection = intersections.get(entry.span.start)!;
          lost.add(intersection);
          problem("UF6002", span(intersection), ...notAProp(INTERSECTION));
        } else {
          // A primitive resolves on its own, so one another file leaves unresolved may be an
          // intersection's part there, whose object parts the oracle merged.
          if (entry.file !== file && PRIMITIVE.test(textOf(entry))) lostElsewhere = true;
          problem("UF6002", here(entry), ...needsChecker(`${text}${where}`));
        }
        break;
      case "conflict": {
        const member = members.find(
          (each) =>
            each.file === entry.file &&
            each.typeText?.span.start === entry.span.start &&
            each.typeText.span.end === entry.span.end,
        );
        // A props member this module writes is judged by the parts it is written from
        // (`overrides`), which compares types by structure: the oracle calls two types the same
        // only when it is sure, so an object written again in place is a conflict to it. Where
        // the syntax could not read a part, the oracle's conflict stands.
        if (member && member.file === file && complete) break;
        if (member) {
          if (!conflicting.has(member.name)) {
            conflicting.set(member.name, declarers(shape, member.name));
          }
        } else {
          // A member of an object a prop's type writes: named, and reported where it is written.
          const nested = shape.nodes
            .flatMap((node) => (node.kind === "object" ? node.members : []))
            .find(
              (each) =>
                each.file === entry.file &&
                each.typeText?.span.start === entry.span.start &&
                each.typeText.span.end === entry.span.end,
            );
          // In an intersection this module writes, the intersection is where it is written; a
          // member one object type writes twice is the syntax's UF2001, wherever it sits.
          const whole =
            entry.file === file
              ? [...new Set(intersections.values())]
                  .filter((node) => node.start <= entry.span.start && entry.span.end <= node.end)
                  .toSorted((a, b) => a.end - a.start - (b.end - b.start))[0]
              : undefined;
          const twice =
            nested &&
            entry.file === file &&
            checked.some((each) => source.slice(each.start, each.end) === nested.name);
          if (!twice) {
            problem(
              "UF6005",
              whole ? span(whole) : here(entry),
              nested
                ? `\`${nested.name}\` is declared with different types or optionality${whole ? " by the parts of an intersection" : ""}${where}: the targets declare each prop once, with one type.`
                : `Two declarations give ${text}${where} different types: the targets declare each prop once, with one type.`,
              "Declare the member once, or give both declarations the same type and optionality.",
            );
          }
        }
        break;
      }
    }
  }
  for (const [name, by] of conflicting) {
    const list = [...by];
    problem(
      "UF6005",
      at,
      `\`${name}\` is declared with different types or optionality${list.length > 1 ? ` by ${list.slice(0, -1).join(", ")} and ${list.at(-1)!}` : ""}: the targets declare each prop once, with one type.`,
      "Declare the member once, or give both declarations the same type and optionality.",
    );
  }
  if (root.kind !== "object") {
    if (root.kind === "opaque") {
      if (!shape.unresolved.length) problem("UF6001", at, ...undeclared(root.text));
    } else {
      problem(
        "UF6004",
        at,
        `The props type resolves to ${describeNode(shape, shape.root)}, not to an object type: the targets declare the members of one object type as props.`,
        "Give the component one object type of props. Write alternatives as optional members, or as a member whose literal union says which applies.",
      );
    }
    return undefined;
  }
  duplicates(annotation, types, problem);
  // The props type's own declarations, the aliases the annotation names through to the type of
  // this module that writes its members: those members are the type's own, and every other
  // declaration's are another's (`declaredBy`).
  const own = ownDeclarations(annotation, types);
  const reading = shapeReading(parsed, types.table, at);
  const partial = shape.unresolved.length > 0;
  /**
   * Whether a member's type reaches an intersection whose non-object part is reported: in this
   * module's syntax, or, for a part another file writes, through an import or that file's member.
   * An empty object such a member's shape holds may be what the oracle merged of it.
   */
  const leavesEmpty = (member: ShapeMember): boolean => {
    if (member.file !== file) return lostElsewhere;
    const type = signatures.get(member.span.start)?.typeAnnotation?.typeAnnotation;
    if (!type || (!lost.size && !lostElsewhere)) return false;
    let found = false;
    const enter = (node: AST.Node): boolean => {
      if (node.type === "TSIntersectionType" && lost.has(node)) found = true;
      if (
        lostElsewhere &&
        node.type === "TSTypeReference" &&
        node.typeName.type === "Identifier" &&
        imports.has(node.typeName.name)
      ) {
        found = true;
      }
      return !found;
    };
    walkTypes(type, enter);
    for (const name of closure(type, types.table)) {
      walkTypes(types.table.declaration(name)!.node, enter);
    }
    return found;
  };
  /**
   * Reports each empty object type a member's own type writes (UF6002), at its span in this
   * module or at the annotation for another file's, where the shape cannot tell it from what an
   * intersection leaves; one that is a part of an intersection is that intersection's. Returns
   * whether the shape's empty objects for the member are reported already, or may be such
   * remainders: then they are not reported again.
   */
  const texts = new Map<string, AST.TSType | undefined>();
  const checkMember: MemberCheck = (member, where) => {
    const local = member.file === file;
    const type = local
      ? signatures.get(member.span.start)?.typeAnnotation?.typeAnnotation
      : member.typeText && writtenType(member.typeText.code, texts);
    const empties = type ? emptyObjects(type) : [];
    for (const empty of empties) {
      problem("UF6002", local ? span(empty) : where, ...notAProp("The empty object type `{}`"));
    }
    // An object type of signatures alone is no empty object: its signatures are reported.
    return (
      empties.length > 0 || (type !== undefined && signatureObjects(type)) || leavesEmpty(member)
    );
  };
  /**
   * Whether the syntax checked a member this module writes in full: the syntax checked its own
   * signature, and its type reaches no import, utility or generic type, or the syntax found a
   * problem in it, which the shape would report again.
   */
  const syntaxCovers = (member: ShapeMember): boolean => {
    if (!scope.signatures.has(member.span.start)) return false;
    const type = signatures.get(member.span.start)?.typeAnnotation?.typeAnnotation;
    if (!type) return true;
    const spans = [
      span(type),
      ...closure(type, types.table).map((name) => types.table.declaration(name)!.span),
    ];
    if (spans.some(reportedAt)) return true;
    // An import, or a utility or generic type, is the shape's to resolve and check.
    let imported = false;
    const enter = (node: AST.Node): boolean => {
      if (node.type === "TSTypeReference" && node.typeName.type === "Identifier") {
        const { name } = node.typeName;
        const array = name === "Array" || name === "ReadonlyArray";
        if (imports.has(name) || (node.typeArguments && !array)) imported = true;
      }
      return !imported;
    };
    walkTypes(type, enter);
    for (const name of closure(type, types.table)) {
      walkTypes(types.table.declaration(name)!.node, enter);
    }
    return !imported;
  };
  /**
   * Where a problem in a nested member's type is reported: where this module writes it, but at
   * the use where the type names a type parameter of the generic that writes it, which the use
   * instantiates (`G<object>`), and at the use for another file's member.
   */
  const place: Place = (member, where) => {
    if (member.file !== file) return where;
    const parameters = types.declarations.flatMap(({ node }) =>
      node.typeParameters && node.start <= member.span.start && member.span.end <= node.end
        ? node.typeParameters.params.map((parameter) => parameter.name.name)
        : [],
    );
    const text = member.typeText?.code ?? "";
    const names = new Set(text.match(/[A-Za-z_$][\w$]*/g) ?? []);
    if (parameters.some((name) => member.references.includes(name) || names.has(name))) {
      return where;
    }
    return member.typeText?.span ?? member.span;
  };
  const written = (member: ShapeMember): Kinds | undefined => {
    const type =
      member.file === file
        ? signatures.get(member.span.start)?.typeAnnotation?.typeAnnotation
        : undefined;
    return type && types.table.kindsOf(type);
  };
  const result: PropMember[] = [];
  for (const member of members) {
    const local = member.file === file;
    // The syntactic oracle names a declaration for every member another file writes: a file is
    // reached only through an import of a type by its name. Another adapter may not.
    const declaration = member.declaration ?? root.declaration;
    const declaredBy: DeclaredBy | undefined =
      (!local || (member.declaration && !own.has(member.declaration.name))) && declaration
        ? { file: member.file, declaration: declaration.name, span: member.span }
        : undefined;
    if (!local && !declaredBy) {
      problem(
        "UF6002",
        at,
        ...needsChecker(`\`${member.name}\`, written in place in \`${member.file}\`,`),
      );
      continue;
    }
    const where = local ? (member.typeText?.span ?? member.span) : at;
    // The oracle reads a literal computed key (`["b"]: string`) as a name, and Vue's
    // `compileScript` rejects any computed key in a props type.
    const signature = local ? signatures.get(member.span.start) : undefined;
    if (signature?.computed) {
      problem("UF6002", span(signature.key), ...needsChecker("A computed key"));
    }
    if (!local || !syntaxCovers(member)) {
      const skip = checkMember(member, where);
      checkShapeType(shape, member.type, where, problem, new Set(), place, skip, checkMember);
    }
    checkExported(shape, member, at, file, problem);
    result.push({
      name: member.name,
      optional: member.optional,
      key: reading.keyOf(member),
      type: local
        ? createTypeText(member.typeText?.code ?? "", member.typeText?.span ?? member.span)
        : createTypeText(member.typeText?.code ?? "", at),
      at: where,
      span: local ? member.span : at,
      // A shape that does not resolve in full keeps what it could not evaluate as an object, so
      // its members read as the module's own types give them, which leave that `unknown`.
      kinds: partial ? (written(member) ?? UNKNOWN) : kindsFromShape(shape, reading, member.type),
      ...(declaredBy ? { declaredBy } : {}),
    });
  }
  return { members: result, failed };
}

/** What the syntax checks of a props type (`shapeMembers`). */
interface SyntaxScope {
  /** The member lists whose members are props, or members of a prop's object type. */
  members: (readonly AST.TSSignature[])[];
  /** The aliased types a prop's type names, each checked as a prop's type. */
  types: AST.TSType[];
  /** Where each member signature the syntax checks starts. */
  signatures: Set<number>;
}

/**
 * What the syntax checks of a props type, as the base read it. The props type's own structure
 * (its aliases, the parts of its intersections, the interfaces it extends) gives members: their
 * object types are checked member by member, and what else they are is the shape's (a part that
 * is no object) or the props type's as a whole (UF6004). A member's type is checked as a prop's
 * type, and so is each alias it names. A utility's or a generic's type arguments (`Array`
 * aside) and a generic declaration give members only the shape knows (an `Omit` drops some).
 */
function syntaxScope(annotation: AST.TSType, types: ModuleTypes): SyntaxScope {
  const scope: SyntaxScope = { members: [], types: [], signatures: new Set() };
  const interfaces = new Set<string>();
  const parts = new Set<string>();
  const aliases = new Set<string>();
  const declared = (name: string) => {
    const declaration = types.table.declaration(name);
    return declaration && !declaration.node.typeParameters ? declaration : undefined;
  };
  const mark = (list: readonly AST.TSSignature[]) => {
    for (const member of list) scope.signatures.add(member.start);
  };
  /** A list of members, each a prop or a member of a prop's object type. */
  const members = (list: readonly AST.TSSignature[]) => {
    scope.members.push(list);
    mark(list);
    for (const member of list) {
      if (member.type === "TSPropertySignature" && member.typeAnnotation) {
        memberType(member.typeAnnotation.typeAnnotation);
      }
    }
  };
  /** An interface: its members, and the bases it extends, which build its object. */
  const reachInterface = (node: AST.TSInterfaceDeclaration) => {
    if (interfaces.has(node.id.name)) return;
    interfaces.add(node.id.name);
    members(node.body.body);
    for (const heritage of node.extends) {
      if (!heritage.typeArguments && heritage.expression.type === "Identifier") {
        part(heritage.expression.name);
      }
    }
  };
  /**
   * A declaration the props type, or an interface, is built from: `whole` where it is the props
   * type itself, through its aliases.
   */
  const part = (name: string, whole = false) => {
    const declaration = declared(name);
    if (!declaration) return;
    if (declaration.node.type === "TSInterfaceDeclaration") reachInterface(declaration.node);
    else if (!parts.has(name)) {
      parts.add(name);
      structure(declaration.node.typeAnnotation, whole, true);
    }
  };
  /**
   * The props type's structure: what builds its object. An empty object type that is the props
   * type itself (`whole`) through an alias (`aliased`) is checked as a type, as the base checked
   * it; written in place, or as a part, it is an object with no members.
   */
  const structure = (type: AST.TSType, whole = false, aliased = false): void => {
    switch (type.type) {
      case "TSParenthesizedType":
        structure(type.typeAnnotation, whole, aliased);
        return;
      case "TSIntersectionType":
        for (const each of type.types) structure(each);
        return;
      case "TSTypeLiteral":
        if (whole && aliased && !type.members.length) scope.types.push(type);
        members(type.members);
        return;
      case "TSTypeReference":
        if (type.typeName.type === "Identifier" && !type.typeArguments) {
          part(type.typeName.name, whole);
        }
        return;
      default:
        return;
    }
  };
  /** A prop's type: its object types' members are the syntax's, and each alias it names. */
  const memberType = (type: AST.TSType) => {
    walkTypes(type, (node) => {
      if (node.type === "TSTypeLiteral") {
        mark(node.members);
        return true;
      }
      if (node.type !== "TSTypeReference") return true;
      if (node.typeName.type !== "Identifier") return false;
      const { name } = node.typeName;
      if (node.typeArguments) return name === "Array" || name === "ReadonlyArray";
      const declaration = declared(name);
      if (declaration?.node.type === "TSInterfaceDeclaration") reachInterface(declaration.node);
      else if (declaration && !aliases.has(name)) {
        aliases.add(name);
        scope.types.push(declaration.node.typeAnnotation);
        memberType(declaration.node.typeAnnotation);
      }
      return false;
    });
  };
  structure(annotation, true);
  return scope;
}

/**
 * The names of this module's declarations a props annotation names in turn, through aliases and
 * parentheses, down to the interface or object type that writes its members.
 */
function ownDeclarations(annotation: AST.TSType, types: ModuleTypes): Set<string> {
  const names = new Set<string>();
  let type = annotation;
  for (;;) {
    if (type.type === "TSParenthesizedType") {
      type = type.typeAnnotation;
      continue;
    }
    if (
      type.type !== "TSTypeReference" ||
      type.typeName.type !== "Identifier" ||
      type.typeArguments ||
      names.has(type.typeName.name)
    ) {
      return names;
    }
    const declaration = types.table.declaration(type.typeName.name);
    if (!declaration) return names;
    names.add(type.typeName.name);
    if (declaration.node.type === "TSInterfaceDeclaration") return names;
    type = declaration.node.typeAnnotation;
  }
}

/** Where a problem in a nested member's type is reported, given where its object is used. */
type Place = (member: ShapeMember, where: Span) => Span;

/**
 * Reports the empty objects a member's own type writes, and says whether the empty objects of its
 * shape may be what an intersection leaves.
 */
type MemberCheck = (member: ShapeMember, where: Span) => boolean;

/**
 * The empty object types a type writes as a prop's own type, `{}`: through unions, arrays and
 * parentheses, but not a part of an intersection, such as a brand's `string & {}`, a function's
 * parameter, a type argument or an operator's operand, which are no prop's type. A type
 * literal's members and the declarations a reference names are read as their own members.
 */
function emptyObjects(type: AST.TSType): AST.TSTypeLiteral[] {
  switch (type.type) {
    case "TSTypeLiteral":
      return type.members.length ? [] : [type];
    case "TSUnionType":
      return type.types.flatMap(emptyObjects);
    case "TSArrayType":
      return emptyObjects(type.elementType);
    case "TSParenthesizedType":
      return emptyObjects(type.typeAnnotation);
    case "TSTypeOperator":
      return type.operator === "readonly" ? emptyObjects(type.typeAnnotation) : [];
    default:
      return [];
  }
}

/**
 * Whether a type writes, as a prop's own type, an object type of signatures alone (`{ (): void }`,
 * `{ [k: string]: string }`), which the shape holds as an object without members.
 */
function signatureObjects(type: AST.TSType): boolean {
  switch (type.type) {
    case "TSTypeLiteral":
      return (
        type.members.length > 0 &&
        type.members.every((member) => member.type !== "TSPropertySignature")
      );
    case "TSUnionType":
    case "TSIntersectionType":
      return type.types.some(signatureObjects);
    case "TSArrayType":
      return signatureObjects(type.elementType);
    case "TSParenthesizedType":
      return signatureObjects(type.typeAnnotation);
    default:
      return false;
  }
}

/** Another file's type, as a member's text writes it. */
function writtenType(code: string, parsed: Map<string, AST.TSType | undefined>) {
  if (!parsed.has(code)) {
    const [statement] = parseModule("type.ts", `type T = ${code};`).program.body;
    parsed.set(
      code,
      statement?.type === "TSTypeAliasDeclaration" ? statement.typeAnnotation : undefined,
    );
  }
  return parsed.get(code);
}

/** A primitive keyword's text, which resolves on its own. */
const PRIMITIVE = /^(?:string|number|boolean|bigint|symbol|null|undefined)$/;

/** Code as a message quotes it: in a run of backticks longer than any the text holds. */
function quoted(text: string): string {
  const longest = Math.max(0, ...[...text.matchAll(/`+/g)].map(([run]) => run.length));
  const fence = "`".repeat(longest + 1);
  return longest ? `${fence} ${text} ${fence}` : `${fence}${text}${fence}`;
}

/** A member of one part of a props type, as the part gives it. */
interface PartMember {
  optional: boolean;
  /** The member's type in the shape. */
  type: number;
  /**
   * Whether `Required` takes `undefined` out of its type: only the `undefined` that `?` added,
   * so only from a member that was optional.
   */
  required: boolean;
  /** The declaration that writes it, as a message names it. */
  by: string;
  /** Where it is written: two parts that give one written member are one declaration of it. */
  origin: string;
}

/**
 * The members of a props type that two of the declarations it is built from write with
 * different types, or optional in one and required in the other (UF6005): an interface's member
 * over its base's, two bases', or two parts of an intersection. The oracle keeps an interface's
 * own member and merges optionality as TypeScript does, but the targets declare one type for
 * each prop, so the catalogue holds the declarations to one, a narrowing override included. The
 * parts are read from the syntax this module writes, from the props annotation through its
 * aliases, interfaces, `extends` lists, intersections and utility types, each part's members from
 * the shape. One member written once and given twice, as in `Partial<L> & L`, is declared once,
 * so it is not compared. A type another file builds is that file's, which TypeScript checks
 * there; the oracle reports its intersections' conflicts itself. `complete` says whether the
 * syntax read every part, which it cannot for a generic instantiation or a `Pick` whose keys are
 * not literals.
 */
function overrides(
  annotation: AST.TSType,
  shape: TypeShape,
  types: ModuleTypes,
  parsed: ParsedModule,
): { found: Map<string, Set<string>>; complete: boolean } {
  const found = new Map<string, Set<string>>();
  let complete = true;
  const { file } = parsed;
  const imported = typeImportsOf(parsed.program);
  // Every member the shape holds, by where it is written in this module.
  const written = new Map<number, ShapeMember>();
  for (const node of shape.nodes) {
    if (node.kind !== "object") continue;
    for (const member of node.members) {
      if (member.file === file && !written.has(member.span.start)) {
        written.set(member.span.start, member);
      }
    }
  }
  /** The object a named type resolves to in the shape: this module's, or an import's. */
  const named = (name: string): ObjectNode | undefined => {
    const local = types.table.declaration(name) !== undefined;
    const target = local ? name : imported.get(name);
    if (target === undefined) return undefined;
    return shape.nodes.find(
      (node): node is ObjectNode =>
        node.kind === "object" &&
        !node.typeArguments &&
        node.declaration?.name === target &&
        (node.declaration.file === file) === local,
    );
  };
  /** The members of the signatures this module writes, by name. */
  const signatures = (list: readonly AST.TSSignature[]) => {
    const members = new Map<string, PartMember>();
    for (const signature of list) {
      const member = written.get(signature.start);
      if (member && !members.has(member.name)) members.set(member.name, partOf(member));
    }
    return members;
  };
  /** The members of a part a type reference names, `L` or `Partial<L>`. */
  const reference = (
    name: string,
    args: readonly AST.TSType[] | undefined,
    seen: Set<string>,
  ): Map<string, PartMember> | undefined => {
    if (!args) {
      const declaration = types.table.declaration(name);
      if (declaration?.node.type === "TSTypeAliasDeclaration" && !seen.has(name)) {
        return members(declaration.node.typeAnnotation, new Set(seen).add(name));
      }
      const node = named(name);
      return node && new Map(node.members.map((member) => [member.name, partOf(member)]));
    }
    const [inner, keys] = args;
    const base = inner && members(inner, seen);
    if (!base) return undefined;
    const literals = keys && keyNames(keys);
    switch (name) {
      case "Partial":
      case "Required":
      case "Readonly":
        return new Map(
          [...base].map(([key, member]) => [
            key,
            name === "Readonly"
              ? member
              : {
                  ...member,
                  optional: name === "Partial",
                  required: name === "Required" && (member.optional || member.required),
                },
          ]),
        );
      case "Pick":
      case "Omit":
        if (!literals) return undefined;
        return new Map([...base].filter(([key]) => literals.has(key) === (name === "Pick")));
      default:
        return undefined;
    }
  };
  /** The members of a part of a props type, or `undefined` where the syntax cannot tell. */
  const members = (type: AST.TSType, seen: Set<string>): Map<string, PartMember> | undefined => {
    switch (type.type) {
      case "TSParenthesizedType":
        return members(type.typeAnnotation, seen);
      case "TSTypeLiteral":
        return signatures(type.members);
      case "TSIntersectionType": {
        const merged = new Map<string, PartMember>();
        for (const part of type.types) {
          const read = members(part, seen);
          if (!read) complete = false;
          for (const [key, member] of read ?? []) {
            const first = merged.get(key);
            merged.set(
              key,
              first ? { ...first, optional: first.optional && member.optional } : member,
            );
          }
        }
        return merged;
      }
      case "TSTypeReference":
        return type.typeName.type === "Identifier"
          ? reference(type.typeName.name, type.typeArguments?.params, seen)
          : undefined;
      default:
        return undefined;
    }
  };
  const compare = (
    left: Map<string, PartMember> | undefined,
    right: Map<string, PartMember> | undefined,
  ) => {
    if (!left || !right) {
      complete = false;
      return;
    }
    for (const [name, member] of left) {
      const other = right.get(name);
      if (!other || member.origin === other.origin || sameMember(shape, member, other)) continue;
      const by = found.get(name) ?? new Set<string>();
      by.add(member.by);
      by.add(other.by);
      found.set(name, by);
    }
  };
  /** Compares the parts of every construction that builds the props type. */
  const build = (type: AST.TSType, seen: Set<string>): void => {
    switch (type.type) {
      case "TSParenthesizedType":
        build(type.typeAnnotation, seen);
        return;
      case "TSIntersectionType": {
        const parts = type.types.map((part) => members(part, seen));
        for (const [index, part] of parts.entries()) {
          for (const other of parts.slice(index + 1)) compare(part, other);
        }
        for (const part of type.types) build(part, seen);
        return;
      }
      case "TSTypeReference": {
        if (type.typeName.type !== "Identifier") return;
        const name = type.typeName.name;
        if (type.typeArguments) {
          for (const argument of type.typeArguments.params) build(argument, seen);
          return;
        }
        const declaration = types.table.declaration(name);
        if (!declaration || seen.has(name)) return;
        const next = new Set(seen).add(name);
        if (declaration.node.type === "TSTypeAliasDeclaration") {
          build(declaration.node.typeAnnotation, next);
          return;
        }
        const own = signatures(declaration.node.body.body);
        const bases = declaration.node.extends.map((heritage) =>
          heritage.expression.type === "Identifier"
            ? reference(heritage.expression.name, heritage.typeArguments?.params, next)
            : undefined,
        );
        for (const [index, base] of bases.entries()) {
          compare(own, base);
          for (const other of bases.slice(index + 1)) compare(base, other);
        }
        for (const heritage of declaration.node.extends) {
          if (heritage.expression.type !== "Identifier") continue;
          for (const argument of heritage.typeArguments?.params ?? []) build(argument, next);
          const base = types.table.declaration(heritage.expression.name);
          if (base && !heritage.typeArguments) {
            build(
              {
                type: "TSTypeReference",
                typeName: heritage.expression,
                start: heritage.start,
                end: heritage.end,
              } as unknown as AST.TSType,
              next,
            );
          }
        }
        return;
      }
      default:
        return;
    }
  };
  build(annotation, new Set());
  return { found, complete };
}

/** A member as a part of a props type gives it. */
function partOf(member: ShapeMember): PartMember {
  return {
    optional: member.optional,
    type: member.type,
    required: false,
    by: declarer(member),
    origin: `${member.file}:${member.span.start}`,
  };
}

/** The names a `Pick` or `Omit` takes: string literals, or a union of them. */
function keyNames(type: AST.TSType): Set<string> | undefined {
  const parts = type.type === "TSUnionType" ? type.types : [type];
  const names = new Set<string>();
  for (const part of parts) {
    if (part.type !== "TSLiteralType" || part.literal.type !== "Literal") return undefined;
    if (typeof part.literal.value !== "string") return undefined;
    names.add(part.literal.value);
  }
  return names;
}

/** The local names of the types the module imports, with the names they are imported by. */
function typeImportsOf(program: AST.Program): Map<string, string> {
  const names = new Map<string, string>();
  for (const statement of program.body) {
    if (statement.type !== "ImportDeclaration") continue;
    for (const specifier of statement.specifiers) {
      if (specifier.type === "ImportNamespaceSpecifier") continue;
      if (
        statement.importKind !== "type" &&
        !(specifier.type === "ImportSpecifier" && specifier.importKind === "type")
      ) {
        continue;
      }
      names.set(
        specifier.local.name,
        specifier.type === "ImportDefaultSpecifier"
          ? "default"
          : (memberName(specifier.imported) ?? ""),
      );
    }
  }
  return names;
}

/**
 * Whether two parts write a member alike: both optional or both required, with one type. An
 * optional member's `undefined` is its optionality's (TypeScript adds it without
 * `exactOptionalPropertyTypes`), and `Required`'s takes it out, as TypeScript does.
 */
function sameMember(shape: TypeShape, left: PartMember, right: PartMember): boolean {
  if (left.optional !== right.optional) return false;
  const drop = (member: PartMember) => member.optional || member.required;
  return sameAlternatives(
    shape,
    alternatives(shape, left.type, drop(left)),
    alternatives(shape, right.type, drop(right)),
  );
}

/**
 * A type's alternatives, a union's members flattened: `boolean` is `true | false`, as TypeScript
 * reads it, and `undefined` is left out when `dropUndefined` says so.
 */
function alternatives(shape: TypeShape, id: number, dropUndefined: boolean): (number | boolean)[] {
  const node = shape.nodes[id]!;
  if (node.kind === "union") {
    return node.types.flatMap((each) => alternatives(shape, each, dropUndefined));
  }
  if (node.kind === "primitive" && node.name === "boolean") return [true, false];
  if (node.kind === "literal" && typeof node.value === "boolean") return [node.value];
  if (dropUndefined && node.kind === "primitive" && node.name === "undefined") return [];
  return [id];
}

function sameAlternatives(
  shape: TypeShape,
  left: readonly (number | boolean)[],
  right: readonly (number | boolean)[],
): boolean {
  const matches = (a: number | boolean, b: number | boolean) =>
    typeof a === "boolean" || typeof b === "boolean" ? a === b : sameType(shape, a, b, new Set());
  return (
    left.every((a) => right.some((b) => matches(a, b))) &&
    right.every((b) => left.some((a) => matches(a, b)))
  );
}

/** The declarations of the shape's objects that write a member, as a message names them. */
function declarers(shape: TypeShape, name: string): Set<string> {
  const found = new Set<string>();
  for (const node of shape.nodes) {
    if (node.kind !== "object") continue;
    for (const member of node.members) if (member.name === name) found.add(declarer(member));
  }
  return found;
}

function declarer(member: ShapeMember): string {
  return member.declaration ? `\`${member.declaration.name}\`` : "an object type written in place";
}

/** Whether two nodes of a shape are one type, as far as the shape can tell. */
function sameType(shape: TypeShape, a: number, b: number, seen: Set<string>): boolean {
  if (a === b) return true;
  const key = `${a}:${b}`;
  if (seen.has(key)) return true;
  seen.add(key);
  const left = shape.nodes[a]!;
  const right = shape.nodes[b]!;
  const same = (x: number, y: number) => sameType(shape, x, y, seen);
  // `boolean` is `true | false`, whichever way it is written.
  if (left.kind === "union" || right.kind === "union") {
    return sameAlternatives(shape, alternatives(shape, a, false), alternatives(shape, b, false));
  }
  switch (left.kind) {
    case "primitive":
      return right.kind === "primitive" && left.name === right.name;
    case "literal":
      return right.kind === "literal" && left.value === right.value;
    case "array":
      return (
        right.kind === "array" &&
        left.readonly === right.readonly &&
        same(left.element, right.element)
      );
    case "tuple":
      return (
        right.kind === "tuple" &&
        left.elements.length === right.elements.length &&
        left.elements.every((element, index) => {
          const other = right.elements[index]!;
          return (
            element.optional === other.optional &&
            element.rest === other.rest &&
            same(element.type, other.type)
          );
        })
      );
    case "object":
      if (right.kind !== "object") return false;
      if (left.declaration && right.declaration && !left.typeArguments && !right.typeArguments) {
        return (
          left.declaration.file === right.declaration.file &&
          left.declaration.name === right.declaration.name
        );
      }
      return (
        left.members.length === right.members.length &&
        left.members.every((member) => {
          const other = right.members.find((each) => each.name === member.name);
          return (
            other !== undefined &&
            other.optional === member.optional &&
            same(member.type, other.type)
          );
        })
      );
    case "function":
      return (
        right.kind === "function" &&
        left.parameters.length === right.parameters.length &&
        left.parameters.every((parameter, index) =>
          same(parameter.type, right.parameters[index]!.type),
        ) &&
        same(left.returns, right.returns)
      );
    case "typeParameter":
      return right.kind === "typeParameter" && left.name === right.name;
    case "opaque":
      return right.kind === "opaque" && left.text === right.text;
    default:
      return false;
  }
}

/**
 * Reports a member written twice in one of the objects this module writes that a props type
 * reaches (UF2001): the oracle keeps one, but each output copies the declaration as written,
 * which TypeScript rejects (TS2300).
 */
function duplicates(annotation: AST.TSType, types: ModuleTypes, problem: Problem): void {
  const check = (signatures: readonly AST.TSSignature[]) => {
    const names = new Set<string>();
    for (const member of signatures) {
      // A method may be overloaded, and an accessor pair writes one name twice: TypeScript takes
      // both, and the targets reject methods and accessors on their own (UF1002, UF6002).
      if (member.type !== "TSPropertySignature") continue;
      const name = member.computed ? undefined : memberName(member.key);
      if (name === undefined) continue;
      if (names.has(name)) problem("UF2001", span(member.key), ...declaredTwice(name));
      names.add(name);
    }
  };
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    const typed = node as AST.Node;
    if (typeof typed.type !== "string") return;
    if (typed.type === "TSTypeLiteral") check(typed.members);
    if (typed.type === "TSInterfaceBody") check(typed.body);
    for (const key of visitorKeys[typed.type] ?? []) {
      visit((node as unknown as Record<string, unknown>)[key]);
    }
  };
  visit(annotation);
  for (const name of closure(annotation, types.table)) visit(types.table.declaration(name)!.node);
}

/**
 * Checks a member's resolved type as `checkType` checks one written in the module (ADR-0034),
 * reporting at `at`: what the type oracle could not resolve is reported where it met it. The
 * members of an object `file` writes are checked at their own spans, so a declaration that
 * several members reach reports its problem once, where it is written. `checkMember` reports
 * the empty objects each member writes, and says whether an empty object in its shape may be what
 * an intersection whose other parts are reported leaves (`leavesEmpty`), which is not reported
 * again.
 */
function checkShapeType(
  shape: TypeShape,
  id: number,
  at: Span,
  problem: Problem,
  seen: Set<number>,
  place: Place,
  leavesEmpty: boolean,
  checkMember: MemberCheck,
): void {
  const node = shape.nodes[id]!;
  switch (node.kind) {
    case "primitive":
      if (!["string", "number", "boolean", "null", "undefined"].includes(node.name)) {
        problem("UF6002", at, ...notAProp(`\`${node.name}\``));
      }
      return;
    case "literal":
      return;
    case "union":
      for (const each of node.types) {
        checkShapeType(shape, each, at, problem, seen, place, leavesEmpty, checkMember);
      }
      return;
    case "array":
      checkShapeType(shape, node.element, at, problem, seen, place, leavesEmpty, checkMember);
      return;
    case "tuple":
      problem("UF6002", at, ...notAProp("A tuple type"));
      return;
    case "object":
      if (seen.has(id)) return;
      seen.add(id);
      if (!node.declaration && !node.members.length && !leavesEmpty) {
        problem("UF6002", at, ...notAProp("The empty object type `{}`"));
      }
      for (const member of node.members) {
        const where = place(member, at);
        const skip = checkMember(member, where);
        checkShapeType(shape, member.type, where, problem, seen, place, skip, checkMember);
      }
      return;
    case "function":
      problem("UF1002", at, FUNCTIONS);
      return;
    case "typeParameter":
      // Only a generic component's props name a type parameter, and it is reported itself.
      return;
    case "opaque": {
      const unresolved = shape.unresolved.some(
        (entry) =>
          entry.file === node.file &&
          entry.span.start === node.span.start &&
          entry.span.end === node.span.end,
      );
      // An unresolved one is reported with the shape; any other is a global type.
      if (!unresolved) problem("UF6001", at, ...undeclared(node.text));
    }
  }
}

/**
 * Reports a member another file writes whose type names a type that file does not export
 * (UF6003): an output that prints the member's type must import what it names (ADR-0067).
 */
function checkExported(
  shape: TypeShape,
  member: ShapeMember,
  at: Span,
  file: string,
  problem: Problem,
): void {
  if (member.file === file) return;
  for (const name of member.references) {
    const hidden = shape.nodes.some(
      (node) =>
        node.kind === "object" &&
        node.declaration?.file === member.file &&
        node.declaration.name === name &&
        !node.declaration.exported,
    );
    if (!hidden) continue;
    problem(
      "UF6003",
      at,
      `\`${member.name}\`'s type names \`${name}\`, which \`${member.file}\` declares without \`export\`: an output that writes the prop's type cannot import it.`,
      `Export \`${name}\` from \`${member.file}\`.`,
    );
  }
}

/** What a resolved type is, for UF6004's message. */
function describeNode(shape: TypeShape, id: number): string {
  const node = shape.nodes[id]!;
  switch (node.kind) {
    case "primitive":
      return `\`${node.name}\``;
    case "literal":
      return `the literal \`${JSON.stringify(node.value)}\``;
    case "union":
      return "a union";
    case "array":
    case "tuple":
      return "an array";
    case "function":
      return "a function";
    case "typeParameter":
      return `the type parameter \`${node.name}\``;
    default:
      return "a type";
  }
}

/**
 * How the kinds of a shape the module writes at `at` read its members (ADR-0067): a member this
 * module writes points at its key, and one another file writes at `at`, the one span of it this
 * module holds. Only this module's declarations are known by kind: another file's objects read
 * as an alias's do.
 */
export function shapeReading(parsed: ParsedModule, table: TypeTable, at: Span): ShapeReading {
  const { file } = parsed;
  return {
    keyOf: (member) =>
      member.file === file
        ? span(signaturesOf(parsed.program).properties.get(member.span.start)?.key ?? member.span)
        : at,
    isInterface: (declaration) =>
      declaration.file === file &&
      table.declaration(declaration.name)?.node.type === "TSInterfaceDeclaration",
  };
}

/** The signatures a module writes: walked once for every component and type that reads them. */
interface Signatures {
  /** Its property signatures, by where each starts: a member's key is read there. */
  properties: Map<number, AST.TSPropertySignature>;
  /** Where each call or construct signature starts, which is a function. */
  callables: Set<number>;
  /** The intersection each part of one belongs to, by where the part starts. */
  intersections: Map<number, AST.TSIntersectionType>;
}

const SIGNATURES = new WeakMap<AST.Program, Signatures>();

function signaturesOf(program: AST.Program): Signatures {
  const cached = SIGNATURES.get(program);
  if (cached) return cached;
  const found = new Map<number, AST.TSPropertySignature>();
  const callables = new Set<number>();
  const intersections = new Map<number, AST.TSIntersectionType>();
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    const typed = node as AST.Node;
    if (typeof typed.type !== "string") return;
    if (typed.type === "TSPropertySignature") found.set(typed.start, typed);
    if (
      typed.type === "TSCallSignatureDeclaration" ||
      typed.type === "TSConstructSignatureDeclaration"
    ) {
      callables.add(typed.start);
    }
    if (typed.type === "TSIntersectionType") {
      for (const part of typed.types) intersections.set(part.start, typed);
    }
    for (const key of visitorKeys[typed.type] ?? []) {
      visit((node as unknown as Record<string, unknown>)[key]);
    }
  };
  visit(program);
  const signatures = { properties: found, callables, intersections };
  SIGNATURES.set(program, signatures);
  return signatures;
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
  member: PropMember,
  declared: Kinds,
  source: string,
  comments: readonly AST.Comment[],
  reporter: Reporter,
): AST.Expression | undefined {
  const { name } = member;
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
