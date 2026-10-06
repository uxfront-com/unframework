import {
  angularLowercases,
  angularMisreads,
  cssPropertiesOverlap,
  cssValueProblem,
  isCssPropertyName,
  isKnownCssProperty,
} from "./css.ts";
import {
  BINDABLE_BOOLEAN_ATTRIBUTES,
  canonicalNumber,
  DOCUMENT_ATTRIBUTES,
  isBooleanAttribute,
  isHtmlAttribute,
  isHtmlElement,
  isNumberTypedAttribute,
  isVoidElement,
  NUMERIC_ATTRIBUTES,
  TEXT_ONLY_ELEMENTS,
  unanalysableUrl,
  unkeptCharacter,
  UNRENDERABLE_ELEMENTS,
} from "./html.ts";
import {
  ALLOWED_GLOBALS,
  isComponentName,
  isExportName,
  isIdentifier,
  RESERVED_TYPE_NAMES,
  reservedParameterName,
  reservedPropName,
  reservedPropsParameterName,
} from "./names.ts";
import {
  CHILDLESS_ATTRIBUTES,
  isDroppedEmptyUrl,
  isStateAttribute,
  isWhitespaceText,
  LEADING_LINE_FEED_ELEMENTS,
  RAW_TEXT_ELEMENTS,
  TEMPLATE_SYNTAX_ATTRIBUTES,
  unbindableAttribute,
  undeclaredAttribute,
  UNINTERPOLATED_ELEMENTS,
  UNPORTABLE_ELEMENTS,
  UNRENDERED_ATTRIBUTES,
  WHITESPACE_DROPPING_ELEMENTS,
} from "./portability.ts";
import {
  elementNamespace,
  isSvgAttribute,
  isSvgElement,
  SVG_HTML_INTEGRATION_POINTS,
  SVG_TEXT_ELEMENTS,
  SVG_UNRENDERABLE_ELEMENTS,
  SVG_WHITESPACE_KEEPING_ELEMENT,
} from "./svg.ts";
import type { Namespace } from "./svg.ts";
import type {
  Binding,
  BindingId,
  ClassAttribute,
  ElementNode,
  Expression,
  IfNode,
  RenderNode,
  Span,
  StyleAttribute,
  UfComponent,
  UfModule,
} from "./types.ts";
import type { IrValidationError } from "./validate.ts";

/**
 * A `class` in canonical form: one or more names, separated by single spaces, and no other
 * whitespace (JavaScript's `\s`, which Angular splits names at).
 */
const CANONICAL_CLASS = /^\S+(?: \S+)*$/u;

/**
 * Checks the invariants of a schema-valid module that its JSON Schema cannot express, which
 * the types document and every target relies on to render the same DOM, and to copy no code
 * through:
 * - each component's name is PascalCase and differs from the others' by more than case, since
 *   it names a class and a file; each export is `default` or an identifier, of a component,
 *   once;
 * - each element is an HTML element every target can render as itself, or inside an `<svg>` an
 *   SVG element (ADR-0040), and a void one has no children;
 * - each attribute is an attribute of its element (so no event handler), set once across every
 *   kind and spread key (a spread's `class` merges with the element's), and none that a target
 *   renders differently (`portability.ts`): template syntax, attributes a framework acts on or
 *   sets as state, `contenteditable` with children, an empty URL React drops, a number in a
 *   form renderers rewrite, a boolean or an attribute a target cannot bind (ADR-0037);
 * - `true` is the value of exactly the HTML boolean attributes, a `class` is canonical and names
 *   each class once, and a `style` sets each property once, without overlap, with custom
 *   properties in lower case and static values Angular's style parser reads as written
 *   (ADR-0038);
 * - no value holds code or a document the compiler cannot analyse (`srcdoc`, a `javascript:`
 *   URL, a `data:` URL a frame loads), and text and values hold only characters HTML keeps;
 * - text sits where every target renders it alike: no whitespace-only text where Svelte drops
 *   it, no interpolation where the parser moves or drops text, no text but whitespace and no
 *   conditional in a raw-text `<iframe>`, no line feed the parser drops at the start of a
 *   `<pre>`, after what may render nothing included, never two texts side by side;
 * - props have names every target can declare, static defaults, and one binding each, and the
 *   object form's parameter a name no framework declares; a local `Props` is the props type of
 *   every component whose props reach it; every binding's id is its name and offset; every
 *   expression is its source text, and refers only to bindings in scope there and to the
 *   allowed globals, a prop by name or, in the object form, as the parameter's member
 *   (ADR-0034, ADR-0035);
 * - conditionals, lists and fragments have the shapes the targets print; a loop variable takes
 *   no name a target's rewrite or an output would capture, and a key reads its list's item or
 *   index and no loop variable of a list around it (ADR-0035, ADR-0036).
 *
 * The analyser's IR keeps them by construction, and the compiler checks every module it emits
 * from, a plugin's included. What else the analyser rejects is authoring, which a plugin owns
 * as it owns what its `output` hook writes: how JSX reads text, the names the compiler and the
 * frameworks reserve (`data-uf-*`, `uf-id-`, `data-hk`, `nonce`), nesting the parser repairs,
 * and attributes that are valid but mean nothing where they are written. An expression's code
 * is JavaScript the IR cannot parse: the compiler compares a plugin's with the analyser's. Nor
 * does the IR know a value's type, so a spread's `nullish` is the analyser's to set: a plugin
 * that moves a spread keeps it true wherever the object may be nullish (ADR-0039).
 */
export function checkInvariants(module: UfModule): IrValidationError[] {
  const errors: IrValidationError[] = [];
  const types = checkTypeDeclarations(module, errors);
  const components = new Set<string>();
  // Each name names a file, and case-insensitive file systems merge two that differ in case.
  const byFile = new Map<string, string>();
  for (const [index, component] of module.components.entries()) {
    const path = `/components/${index}`;
    const { name } = component;
    if (!isComponentName(name)) {
      errors.push({
        path: `${path}/name`,
        message: `must be PascalCase, in ASCII letters and digits, and "${name}" is not`,
      });
    }
    const other = byFile.get(name.toLowerCase());
    if (other !== undefined) {
      errors.push({
        path: `${path}/name`,
        message:
          other === name
            ? `must differ from the other components' names, and "${name}" does not`
            : `must differ from "${other}" by more than case, as each names a file`,
      });
    } else {
      byFile.set(name.toLowerCase(), name);
    }
    components.add(name);
    checkComponent(component, path, types, errors);
  }
  const exported = new Set<string>();
  for (const [index, entry] of module.exports.entries()) {
    const path = `/exports/${index}`;
    if (!components.has(entry.local)) {
      errors.push({
        path: `${path}/local`,
        message: `must name a component of the module, and "${entry.local}" is not one`,
      });
    }
    if (!isExportName(entry.name)) {
      errors.push({
        path: `${path}/name`,
        message: `must be "default" or an identifier, and "${entry.name}" is not`,
      });
    } else if ((entry.kind === "default") !== (entry.name === "default")) {
      errors.push({
        path: `${path}/kind`,
        message:
          entry.kind === "default"
            ? `must be "named" for an export named "${entry.name}"`
            : 'must be "default" for the export named "default"',
      });
    }
    if (exported.has(entry.name)) {
      errors.push({ path: `${path}/name`, message: `must export "${entry.name}" once` });
    }
    exported.add(entry.name);
  }
  return errors;
}

/**
 * Checks the module's type declarations, which outputs copy as written: identifiers, each name
 * once (TypeScript merges two interfaces of one name, which the outputs would not), in source
 * order. Returns the index of each by name.
 */
function checkTypeDeclarations(
  module: UfModule,
  errors: IrValidationError[],
): ReadonlyMap<string, number> {
  const indices = new Map<string, number>();
  let previous: Span | undefined;
  // `Props` may be a component's own props type, which the outputs keep as it is, unless another
  // component's props reach it: Astro's output declares that component's own `Props` beside the
  // copied one, a duplicate or, for an interface, a silent merge.
  const ownProps =
    module.components.some(takesProps) &&
    module.components.every(
      (component) => takesProps(component) || !component.types.includes("Props"),
    );
  for (const [index, declaration] of module.types.entries()) {
    const path = `/types/${index}`;
    const { name } = declaration;
    const reserved = name === "Props" && ownProps ? undefined : RESERVED_TYPE_NAMES.get(name);
    if (!isIdentifier(name)) {
      errors.push({ path: `${path}/name`, message: `must be an identifier, and "${name}" is not` });
    } else if (indices.has(name)) {
      errors.push({ path: `${path}/name`, message: `must declare "${name}" once` });
    } else {
      // A reserved name is still the declaration the components name: one error, at the name.
      if (reserved) {
        errors.push({ path: `${path}/name`, message: `must not be "${name}": ${reserved}` });
      }
      indices.set(name, index);
    }
    checkSourceText(declaration, path, errors);
    if (previous && declaration.span.start < previous.end) {
      errors.push({ path: `${path}/span`, message: "must follow the declaration before it" });
    }
    previous = declaration.span;
  }
  return indices;
}

/** Whether a component's props type is `Props` itself, which no output declares again. */
function takesProps(component: UfComponent): boolean {
  return component.propsParameter?.type.code === "Props";
}

/** What a component's walk shares: the component's bindings and what the walk finds. */
interface Walk {
  readonly errors: IrValidationError[];
  readonly bindings: ReadonlyMap<BindingId, Binding>;
  /** The object form's parameter name, which a reference to a prop starts with. */
  readonly propsName: string | undefined;
  /** The props' names, which no loop variable may take. */
  readonly propNames: ReadonlySet<string>;
  /** How many lists declare each loop variable. */
  readonly loopVariables: Map<BindingId, number>;
}

/** Where a node sits: what the walk carries down the tree. */
interface Place {
  /** A JSON Pointer to the node. */
  readonly path: string;
  /** The nearest element: the node's parent in the DOM, or `undefined` at the component's root. */
  readonly element: ElementNode | undefined;
  /** The namespace of the nearest element's children. */
  readonly namespace: Namespace;
  /** Whether the node is inside an SVG `<text>`. */
  readonly inSvgText: boolean;
  /** Whether a conditional or a list lies between the node and the nearest element. */
  readonly controlled: boolean;
  /** The bindings in scope: the props, and the loop variables of the lists around the node. */
  readonly scope: ReadonlySet<BindingId>;
}

function checkComponent(
  component: UfComponent,
  path: string,
  types: ReadonlyMap<string, number>,
  errors: IrValidationError[],
): void {
  const bindings = checkBindings(component, path, errors);
  const walk: Walk = {
    errors,
    bindings,
    propsName:
      component.propsParameter?.form === "object" ? component.propsParameter.name : undefined,
    propNames: new Set(component.props.map(({ name }) => name)),
    loopVariables: new Map(),
  };
  checkComponentTypes(component, path, types, errors);
  checkProps(component, path, walk);
  const scope = new Set(
    component.bindings.filter(({ kind }) => kind === "prop").map(({ id }) => id),
  );
  const root: Place = {
    path: `${path}/render`,
    element: undefined,
    namespace: "html",
    inSvgText: false,
    controlled: false,
    scope,
  };
  const { render } = component;
  if (render.kind === "Element") {
    checkElement(render, root, walk);
  } else {
    if (!render.children.length) {
      errors.push({ path: `${path}/render/children`, message: "must hold a root node" });
    }
    checkChildren(render.children, { ...root, path: `${path}/render/children` }, walk);
  }
  for (const [index, binding] of component.bindings.entries()) {
    if (binding.kind !== "loopVar") continue;
    const lists = walk.loopVariables.get(binding.id) ?? 0;
    if (lists !== 1) {
      errors.push({
        path: `${path}/bindings/${index}`,
        message:
          lists === 0
            ? `must be the item or index of a list, and "${binding.id}" is not`
            : `must be the item or index of one list, and "${binding.id}" is of ${lists}`,
      });
    }
  }
}

/**
 * Checks a component's bindings: each id is its name and offset (plan §5.3), once, in order of
 * their spans. Returns them by id.
 */
function checkBindings(
  component: UfComponent,
  path: string,
  errors: IrValidationError[],
): ReadonlyMap<BindingId, Binding> {
  const bindings = new Map<BindingId, Binding>();
  let previous: number | undefined;
  for (const [index, binding] of component.bindings.entries()) {
    const at = `${path}/bindings/${index}`;
    const expected = `${binding.name}@${binding.span.start}`;
    if (binding.id !== expected) {
      errors.push({
        path: `${at}/id`,
        message: `must be "${expected}", the binding's name and offset`,
      });
    }
    if (bindings.has(binding.id)) {
      errors.push({ path: `${at}/id`, message: `must declare "${binding.id}" once` });
      continue;
    }
    bindings.set(binding.id, binding);
    // Object-form props may all be declared at the parameter, so starts may tie.
    if (previous !== undefined && binding.span.start < previous) {
      errors.push({ path: `${at}/span`, message: "must follow the binding before it" });
    }
    previous = binding.span.start;
  }
  return bindings;
}

/** Checks the types a component's output declares: the module's, each once, in source order. */
function checkComponentTypes(
  component: UfComponent,
  path: string,
  types: ReadonlyMap<string, number>,
  errors: IrValidationError[],
): void {
  let previous = -1;
  const named = new Set<string>();
  for (const [index, name] of component.types.entries()) {
    const at = `${path}/types/${index}`;
    const position = types.get(name);
    if (position === undefined) {
      errors.push({
        path: at,
        message: `must name a type the module declares, and "${name}" is not one`,
      });
    } else if (named.has(name)) {
      errors.push({ path: at, message: `must name "${name}" once` });
    } else if (position < previous) {
      errors.push({ path: at, message: "must list the types in source order" });
    }
    named.add(name);
    if (position !== undefined) previous = Math.max(previous, position);
  }
}

/**
 * Checks a component's props (ADR-0034): names every target can declare, once each; defaults
 * only on optional props of the destructured form, and static; one `prop` binding per prop that
 * has one, named as the prop, and one for every prop in the object form.
 */
function checkProps(component: UfComponent, path: string, walk: Walk): void {
  const { errors, bindings } = walk;
  const parameter = component.propsParameter;
  const objectForm = parameter?.form === "object";
  if (parameter) {
    const at = `${path}/propsParameter`;
    if (objectForm !== (parameter.name !== undefined)) {
      errors.push({
        path: `${at}/name`,
        message: objectForm
          ? "must name the props parameter in the object form"
          : "must be absent in the destructured form",
      });
    } else if (parameter.name !== undefined && !isIdentifier(parameter.name)) {
      errors.push({
        path: `${at}/name`,
        message: `must be an identifier, and "${parameter.name}" is not`,
      });
    } else if (parameter.name !== undefined && reservedPropsParameterName(parameter.name)) {
      errors.push({
        path: `${at}/name`,
        message: `must not start with "$$": ${reservedPropsParameterName(parameter.name)!}`,
      });
    }
    checkSourceText(parameter.type, `${at}/type`, errors);
  } else if (component.props.length) {
    errors.push({
      path: `${path}/props`,
      message: "must be empty for a component without a props parameter",
    });
  }
  const names = new Set<string>();
  const owners = new Map<BindingId, number>();
  for (const [index, prop] of component.props.entries()) {
    const at = `${path}/props/${index}`;
    const reserved = reservedPropName(prop.name);
    if (reserved) {
      errors.push({
        path: `${at}/name`,
        message: `must be a name every target can take: ${reserved}`,
      });
    } else if (names.has(prop.name)) {
      errors.push({ path: `${at}/name`, message: `must declare "${prop.name}" once` });
    }
    names.add(prop.name);
    checkSourceText(prop.type, `${at}/type`, errors);
    if (prop.default) {
      if (!prop.optional) {
        errors.push({ path: `${at}/default`, message: "must be absent on a required prop" });
      } else if (objectForm) {
        errors.push({ path: `${at}/default`, message: "must be absent in the object form" });
      } else if (prop.default.refs.length) {
        errors.push({
          path: `${at}/default/refs`,
          message:
            "must be empty: a default is static, as Vue hoists it out of the component and Angular reads it before any input",
        });
      }
      checkSourceText(prop.default, `${at}/default`, errors);
    }
    if (prop.binding === undefined) {
      if (objectForm) {
        errors.push({ path: at, message: `must have a binding in the object form` });
      }
      continue;
    }
    const binding = bindings.get(prop.binding);
    if (!binding || binding.kind !== "prop" || binding.name !== prop.name) {
      errors.push({
        path: `${at}/binding`,
        message: `must name a prop binding named "${prop.name}", and "${prop.binding}" is not one`,
      });
    }
    owners.set(prop.binding, (owners.get(prop.binding) ?? 0) + 1);
  }
  for (const [index, binding] of component.bindings.entries()) {
    if (binding.kind === "prop" && owners.get(binding.id) !== 1) {
      errors.push({
        path: `${path}/bindings/${index}`,
        message: `must be the binding of one prop, and "${binding.id}" is of ${owners.get(binding.id) ?? 0}`,
      });
    }
  }
}

/** Checks the nodes of a child list, and that no two texts are side by side. */
function checkChildren(children: readonly RenderNode[], place: Place, walk: Walk): void {
  for (const [index, child] of children.entries()) {
    const at = { ...place, path: `${place.path}/${index}` };
    if (child.kind === "Text" && children[index - 1]?.kind === "Text") {
      walk.errors.push({
        path: at.path,
        message: "must not follow another text: adjacent texts are one text node in the DOM",
      });
    }
    checkNode(child, at, walk);
  }
}

function checkNode(node: RenderNode, place: Place, walk: Walk): void {
  switch (node.kind) {
    case "Element":
      checkElement(node, place, walk);
      return;
    case "Text":
      checkText(node.value, place, walk);
      return;
    case "Interpolation": {
      const problem = dynamicTextProblem(place);
      if (problem) walk.errors.push({ path: place.path, message: `must not be ${problem}` });
      checkExpression(node.value, `${place.path}/value`, place.scope, walk);
      return;
    }
    case "If":
      checkIf(node, place, walk);
      return;
    case "For": {
      const { errors, bindings } = walk;
      checkExpression(node.source, `${place.path}/source`, place.scope, walk);
      const scope = new Set(place.scope);
      const declared = node.index === undefined ? [node.item] : [node.item, node.index];
      for (const [position, id] of declared.entries()) {
        const field = position === 0 ? "item" : "index";
        if (position === 1 && id === node.item) {
          errors.push({ path: `${place.path}/index`, message: "must differ from the item" });
          continue;
        }
        const binding = bindings.get(id);
        if (binding?.kind !== "loopVar") {
          errors.push({
            path: `${place.path}/${field}`,
            message: `must name a loop variable of the component, and "${id}" is not one`,
          });
        } else {
          const taken = takenName(binding.name, scope, walk);
          if (taken) {
            errors.push({
              path: `${place.path}/${field}`,
              message: `must not be named "${binding.name}": ${taken}`,
            });
          }
        }
        walk.loopVariables.set(id, (walk.loopVariables.get(id) ?? 0) + 1);
        scope.add(id);
      }
      if (place.element?.tag === "textarea" && place.namespace === "html") {
        errors.push({
          path: place.path,
          message: `must not be in a <textarea>: ${UNINTERPOLATED_ELEMENTS.get("textarea")!}`,
        });
      }
      checkExpression(node.key, `${place.path}/key`, scope, walk);
      checkKey(node.key, declared, `${place.path}/key`, walk);
      checkElement(
        node.body,
        { ...place, path: `${place.path}/body`, scope, controlled: true },
        walk,
      );
      return;
    }
    default:
      unreachable(node);
  }
}

/**
 * Why a loop variable cannot take a name where its list is (ADR-0035, UF3024), or `undefined`:
 * the targets that rewrite names (Solid's `props.label`, Angular's `@let` and `track`) would
 * read it in place of a prop, the object form's parameter or a loop variable around it of that
 * name, and the outputs reserve some names whatever the component declares.
 */
function takenName(name: string, scope: ReadonlySet<BindingId>, walk: Walk): string | undefined {
  if (walk.propNames.has(name)) return `it would shadow the prop "${name}"`;
  if (name === walk.propsName) return "it would shadow the props parameter";
  for (const id of scope) {
    const other = walk.bindings.get(id);
    if (other?.kind === "loopVar" && other.name === name) {
      return `it would shadow "${id}", a loop variable of a list around it`;
    }
  }
  return reservedParameterName(name);
}

/**
 * Checks a list's key (ADR-0036): it reads the list's item or index, as a key that reads neither
 * is the same for every item, which Vue's and Svelte's compilers reject, and no loop variable of
 * a list around it, which Angular's `track` cannot read (NG8009).
 */
function checkKey(key: Expression, declared: readonly BindingId[], path: string, walk: Walk): void {
  const read = key.refs.flatMap((ref) => (ref.kind === "Binding" ? [ref.binding] : []));
  if (!read.some((id) => declared.includes(id))) {
    walk.errors.push({
      path,
      message:
        "must read the list's item or index: a key that reads neither is the same for every item, which Vue and Svelte reject",
    });
  }
  const outer = read.find(
    (id) => !declared.includes(id) && walk.bindings.get(id)?.kind === "loopVar",
  );
  if (outer !== undefined) {
    walk.errors.push({
      path,
      message: `must not read "${outer}", a loop variable of a list around it: Angular's \`track\` reads only its own item, \`$index\` and the component's members`,
    });
  }
}

/**
 * Why an interpolation, or a branch's text, cannot render alike where the place is, or
 * `undefined`: inside an element whose text the parser moves or drops, a `<textarea>`, or an SVG
 * element that renders no text.
 */
function dynamicTextProblem(place: Place): string | undefined {
  const { element, namespace } = place;
  if (!element) return undefined;
  if (namespace === "svg") {
    return SVG_TEXT_ELEMENTS.has(element.tag)
      ? undefined
      : `in an SVG <${element.tag}>: SVG renders text only in <text>, <tspan>, <textPath>, <title> and <desc>`;
  }
  const reason = UNINTERPOLATED_ELEMENTS.get(element.tag);
  return reason ? `in a <${element.tag}>: ${reason}` : undefined;
}

/**
 * Checks a conditional's shape (ADR-0036): one or more branches, a condition on each but an
 * else that comes last after another, something rendered in some branch and no empty else;
 * and that it adds no text where text cannot render alike.
 */
function checkIf(node: IfNode, place: Place, walk: Walk): void {
  const { errors } = walk;
  const { branches } = node;
  const last = branches.length - 1;
  if (!branches.length) {
    errors.push({ path: `${place.path}/branches`, message: "must have a branch" });
  }
  for (const [index, branch] of branches.entries()) {
    const at = `${place.path}/branches/${index}`;
    if (!branch.condition && index < last) {
      errors.push({ path: at, message: "must have a condition: only the last branch is an else" });
    } else if (!branch.condition && index === 0) {
      errors.push({ path: at, message: "must have a condition: an else follows another branch" });
    } else if (!branch.condition && !branch.children.length) {
      errors.push({ path: at, message: "must render something: an empty else renders nothing" });
    }
    if (branch.condition) checkExpression(branch.condition, `${at}/condition`, place.scope, walk);
    checkChildren(branch.children, { ...place, path: `${at}/children`, controlled: true }, walk);
  }
  if (branches.length && branches.every((branch) => !branch.children.length)) {
    errors.push({ path: `${place.path}/branches`, message: "must render something in a branch" });
  }
  const problem = dynamicTextProblem(place);
  // A <textarea>'s and a raw-text element's content is text, where the comments that mark a
  // conditional render as text too: any conditional there is one.
  const tag = place.namespace === "html" ? place.element?.tag : undefined;
  const textContent = tag === "textarea" || RAW_TEXT_ELEMENTS.has(tag ?? "");
  // Interpolations report themselves, and so does whitespace-only text where Svelte drops it.
  if (problem && (textContent || holdsText(node))) {
    errors.push({ path: place.path, message: `must not render text ${problem}` });
  }
}

/**
 * Whether a conditional's branches hold text that is not only whitespace. A nested conditional
 * reports its own.
 */
function holdsText(node: IfNode): boolean {
  return node.branches.some(({ children }) =>
    children.some((child) => child.kind === "Text" && !isWhitespaceText(child.value)),
  );
}

/** Checks a text: whitespace a target drops, a leading line feed, characters HTML keeps. */
function checkText(value: string, place: Place, walk: Walk): void {
  const { element, namespace } = place;
  const path = `${place.path}/value`;
  if (element && isWhitespaceText(value)) {
    if (namespace === "svg" && !place.inSvgText) {
      walk.errors.push({
        path,
        message: `must not be only whitespace: Svelte's compiler drops it in SVG outside a <${SVG_WHITESPACE_KEEPING_ELEMENT}>, and the other targets keep it`,
      });
    } else if (namespace === "html" && WHITESPACE_DROPPING_ELEMENTS.has(element.tag)) {
      walk.errors.push({
        path,
        message: `must not be only whitespace: Svelte's compiler drops it inside <${element.tag}>, and the other targets keep it`,
      });
    }
  } else if (element && namespace === "html" && RAW_TEXT_ELEMENTS.has(element.tag)) {
    walk.errors.push({
      path,
      message: `must be only whitespace in a <${element.tag}>: ${UNINTERPOLATED_ELEMENTS.get(element.tag)!}`,
    });
  }
  checkCharacters(value, path, walk.errors);
}

/** Checks an element, its attributes and its children, where it sits. */
function checkElement(element: ElementNode, place: Place, walk: Walk): void {
  const { errors } = walk;
  const { path } = place;
  const { tag, children } = element;
  const namespace = elementNamespace(tag, place.namespace);
  const tagProblem =
    (namespace === "svg" ? svgTagProblem(tag, place.element) : htmlTagProblem(tag)) ??
    textOnlyProblem(place) ??
    (namespace === "svg" && tag === "title" && place.controlled
      ? "must not start a conditional's branch or a list's body in SVG: dom-expressions leaves `title` out of its SVG tags, so Solid creates it in HTML's namespace"
      : undefined);
  if (tagProblem) errors.push({ path: `${path}/tag`, message: tagProblem });
  checkAttributes(element, namespace, place, walk);
  if (namespace === "html" && isVoidElement(tag) && children.length) {
    errors.push({ path: `${path}/children`, message: `must be empty: <${tag}> is a void element` });
  }
  if (namespace === "html" && LEADING_LINE_FEED_ELEMENTS.has(tag)) {
    for (const text of leadingTexts(children, `${path}/children`)) {
      if (text.value.startsWith("\n")) {
        errors.push({
          path: `${text.path}/value`,
          message: `must not start with a line feed: the HTML parser drops it at the start of a <${tag}>, and React's server renderer writes another`,
        });
      }
    }
  }
  checkChildren(
    children,
    {
      path: `${path}/children`,
      element,
      namespace,
      inSvgText: place.inSvgText || (namespace === "svg" && tag === SVG_WHITESPACE_KEEPING_ELEMENT),
      controlled: false,
      scope: place.scope,
    },
    walk,
  );
}

/**
 * The texts that can start an element's content: its first child, a branch's through ifs, and
 * the text after a conditional or a list that can render nothing, where React's and Astro's
 * servers write nothing before it (the other targets write a comment, which keeps the line feed).
 */
function leadingTexts(
  children: readonly RenderNode[],
  path: string,
): { value: string; path: string }[] {
  return leading(children, path).texts;
}

/** The texts that can start a child list, and whether it can render nothing. */
function leading(
  children: readonly RenderNode[],
  path: string,
): { texts: { value: string; path: string }[]; empty: boolean } {
  const texts: { value: string; path: string }[] = [];
  for (const [index, child] of children.entries()) {
    if (child.kind === "Text") {
      texts.push({ value: child.value, path: `${path}/${index}` });
      return { texts, empty: false };
    }
    // A list's body is an element: it renders elements, or nothing.
    if (child.kind === "For") continue;
    if (child.kind !== "If") return { texts, empty: false };
    // Without an else, or with a branch that can render nothing, a conditional can too.
    let empty = child.branches.at(-1)?.condition !== undefined;
    for (const [number, branch] of child.branches.entries()) {
      const inner = leading(branch.children, `${path}/${index}/branches/${number}/children`);
      texts.push(...inner.texts);
      empty ||= inner.empty;
    }
    if (!empty) return { texts, empty: false };
  }
  return { texts, empty: true };
}

/** Why an HTML-namespace tag is not one a component can render as itself, or `undefined`. */
function htmlTagProblem(tag: string): string | undefined {
  const unrenderable = UNRENDERABLE_ELEMENTS.get(tag);
  if (unrenderable) return `must be an element a component can render: ${unrenderable}`;
  const unportable = UNPORTABLE_ELEMENTS.get(tag);
  if (unportable) return `must be an element every target renders as itself: ${unportable}`;
  if (isHtmlElement(tag)) return undefined;
  return isSvgElement(tag)
    ? `must be an HTML element, and <${tag}> is not: SVG elements sit inside an <svg>`
    : `must be an HTML element, and <${tag}> is not`;
}

/**
 * Why no element can sit where this one does: inside an HTML element whose content is text, as
 * the parser reads markup there (`<option>`, `<textarea>`, `<title>`), or `undefined`.
 */
function textOnlyProblem(place: Place): string | undefined {
  const parent = place.element;
  if (!parent || place.namespace !== "html" || !TEXT_ONLY_ELEMENTS.has(parent.tag)) {
    return undefined;
  }
  // A conditional or a list in a <textarea> reports itself.
  if (place.controlled && parent.tag === "textarea") return undefined;
  return `must not be inside <${parent.tag}>: its content is text, and the HTML parser reads markup there as text`;
}

/** Why an SVG-namespace tag is not one a component can render, or `undefined`. */
function svgTagProblem(tag: string, parent: ElementNode | undefined): string | undefined {
  const unrenderable = SVG_UNRENDERABLE_ELEMENTS.get(tag);
  if (unrenderable) return `must be an element a component can render: ${unrenderable}`;
  if (!isSvgElement(tag)) {
    return `must be an SVG element, and <${tag}> is not: the HTML parser leaves SVG at some HTML elements, and the targets create others in SVG or HTML`;
  }
  if (parent && SVG_HTML_INTEGRATION_POINTS.has(parent.tag)) {
    return `must not be inside an SVG <${parent.tag}>: the HTML parser and Vue read its elements as HTML, and React as SVG`;
  }
  return undefined;
}

/**
 * Checks an element's attributes: names of the element, set once across every kind (one spread
 * `class` key merges with the element's own `class`), none a target renders differently, and
 * each kind's values.
 */
function checkAttributes(
  element: ElementNode,
  namespace: Namespace,
  place: Place,
  walk: Walk,
): void {
  const { errors } = walk;
  const { tag, attributes, children } = element;
  // `type` is an enumerated attribute, read without case; the first one is the one HTML keeps.
  // A bound `type` leaves it unknown, so an input's `value` is state.
  const type = attributes.find(
    (attribute) => attribute.kind === "Static" && attribute.name === "type",
  );
  const staticType =
    type?.kind === "Static" && typeof type.value === "string" ? type.value : undefined;
  const seen = new Set<string>();
  let ownClass = false;
  let spreadClass = false;
  /** Claims a name for one attribute, or reports it set twice. */
  const claim = (name: string, path: string, fromSpread: boolean) => {
    if (name === "class") {
      const taken = fromSpread ? spreadClass : ownClass;
      if (fromSpread) spreadClass = true;
      else ownClass = true;
      if (!taken) return;
    } else if (!seen.has(name)) {
      seen.add(name);
      return;
    }
    errors.push({ path, message: `must set "${name}" once` });
  };
  /** The checks of a name every kind has: of the element, and rendered alike. */
  const checkName = (name: string, path: string): boolean => {
    const known = namespace === "svg" ? isSvgAttribute(tag, name) : isHtmlAttribute(tag, name);
    if (!known) {
      errors.push({ path, message: `must be an attribute of <${tag}>` });
      return false;
    }
    const unportable =
      undeclaredAttribute(tag, namespace, name) ??
      (namespace === "html"
        ? unportableAttribute(tag, name, staticType, children.length > 0)
        : undefined);
    if (unportable) {
      errors.push({ path, message: `must not be set: ${unportable}` });
      return false;
    }
    return true;
  };
  /** The checks of a bound name, as a bound attribute or a spread's key (ADR-0037). */
  const checkBoundName = (name: string, path: string): void => {
    const reason =
      name === "style"
        ? "a `style` is a Style attribute, and a spread's `style` lands in M4"
        : namespace === "html"
          ? unbindableAttribute(tag, name)
          : undefined;
    if (reason) {
      errors.push({ path, message: `must not be bound: ${reason}` });
    } else if (
      namespace === "html" &&
      isBooleanAttribute(name) &&
      !BINDABLE_BOOLEAN_ATTRIBUTES.has(name)
    ) {
      errors.push({
        path,
        message: `must not be bound: Vue's server or Svelte renders a false \`${name}\` as "false", as they do not read it as a boolean`,
      });
    }
  };
  for (const [index, attribute] of attributes.entries()) {
    const at = `${place.path}/attributes/${index}`;
    switch (attribute.kind) {
      case "Static": {
        const { name, value } = attribute;
        if (checkName(name, `${at}/name`) && name === "style") {
          errors.push({
            path: `${at}/name`,
            message: "must not be a static attribute: a `style` is a Style attribute (ADR-0038)",
          });
        }
        claim(name, `${at}/name`, false);
        checkStaticValue(tag, namespace, name, value, `${at}/value`, errors);
        break;
      }
      case "Bound": {
        const { name } = attribute;
        if (checkName(name, `${at}/name`)) {
          if (name === "class") {
            errors.push({
              path: `${at}/name`,
              message: "must not be bound: a `class` is a Class attribute (ADR-0038)",
            });
          } else {
            checkBoundName(name, `${at}/name`);
          }
        }
        claim(name, `${at}/name`, false);
        checkExpression(attribute.value, `${at}/value`, place.scope, walk);
        break;
      }
      case "Class":
        claim("class", at, false);
        checkClass(attribute, at, place, walk);
        break;
      case "Style":
        claim("style", at, false);
        checkStyle(attribute, at, place, walk);
        break;
      case "Spread":
        for (const [key, { name }] of attribute.keys.entries()) {
          const path = `${at}/keys/${key}/name`;
          if (checkName(name, path)) checkBoundName(name, path);
          claim(name, path, true);
        }
        checkExpression(attribute.value, `${at}/value`, place.scope, walk);
        break;
      default:
        unreachable(attribute);
    }
  }
}

/** Checks a static attribute's value: booleans, and what the targets render differently. */
function checkStaticValue(
  tag: string,
  namespace: Namespace,
  name: string,
  value: string | true,
  path: string,
  errors: IrValidationError[],
): void {
  if (namespace === "svg") {
    if (value === true) {
      errors.push({
        path,
        message: `must be a string: SVG has no boolean attributes, and "${name}" is on an SVG <${tag}>`,
      });
    }
  } else if ((value === true) !== isBooleanAttribute(name)) {
    errors.push({
      path,
      message:
        value === true
          ? `must be a string: only boolean attributes are true, and "${name}" is not one`
          : `must be true: "${name}" is a boolean attribute`,
    });
  }
  if (typeof value !== "string") return;
  const problem = valueProblem(tag, namespace, name, value);
  if (problem) errors.push({ path, message: problem });
  checkCharacters(value, path, errors);
}

/**
 * Checks a `class`'s parts (ADR-0038): static names canonical, a toggle's name one class name,
 * and no name twice among them.
 */
function checkClass(attribute: ClassAttribute, path: string, place: Place, walk: Walk): void {
  const { errors } = walk;
  const names = new Set<string>();
  for (const [index, item] of attribute.items.entries()) {
    const at = `${path}/items/${index}`;
    let written: string[] = [];
    switch (item.kind) {
      case "Static":
        if (!CANONICAL_CLASS.test(item.value)) {
          errors.push({
            path: `${at}/value`,
            message: "must be class names separated by single spaces",
          });
        } else {
          written = item.value.split(" ");
        }
        checkCharacters(item.value, `${at}/value`, errors);
        break;
      case "Toggle":
        if (!/^\S+$/u.test(item.name)) {
          errors.push({ path: `${at}/name`, message: "must be one class name" });
        } else {
          written = [item.name];
        }
        checkCharacters(item.name, `${at}/name`, errors);
        checkExpression(item.condition, `${at}/condition`, place.scope, walk);
        break;
      case "Dynamic":
        checkExpression(item.value, `${at}/value`, place.scope, walk);
        break;
      default:
        unreachable(item);
    }
    for (const name of written) {
      if (names.has(name)) {
        errors.push({ path: at, message: `must name the class "${name}" once` });
      }
      names.add(name);
    }
  }
}

/**
 * Checks a `style`'s declarations (ADR-0038): CSS property names, in lower case as Angular
 * writes them, none setting what another sets (the object targets cannot keep their order), and
 * static values that are one CSS value, which Angular's style parser reads as written.
 */
function checkStyle(attribute: StyleAttribute, path: string, place: Place, walk: Walk): void {
  const { errors } = walk;
  const properties: string[] = [];
  for (const [index, declaration] of attribute.declarations.entries()) {
    const at = `${path}/declarations/${index}`;
    const { property } = declaration;
    if (!isCssPropertyName(property)) {
      errors.push({
        path: `${at}/property`,
        message: `must be a CSS property in lower case and without a vendor prefix, or a custom property, and "${property}" is not`,
      });
    } else if (!isKnownCssProperty(property)) {
      errors.push({
        path: `${at}/property`,
        message: `must be a CSS property the browsers know (\`CSS_PROPERTIES\`), or a custom property, and "${property}" is not`,
      });
    } else if (angularLowercases(property)) {
      errors.push({
        path: `${at}/property`,
        message: `must be in lower case: Angular's compiler and server DOM lowercase a custom property's name, and "${property}" is not`,
      });
    } else {
      const other = properties.find((earlier) => cssPropertiesOverlap(earlier, property));
      if (other !== undefined) {
        errors.push({
          path: `${at}/property`,
          message:
            other === property
              ? `must set "${property}" once`
              : `must not set what "${other}" sets: the targets that write a style as an object cannot keep the order that decides it`,
        });
      }
      properties.push(property);
    }
    if (declaration.kind === "Static") {
      const problem =
        cssValueProblem(declaration.value) ??
        (angularMisreads(declaration.value)
          ? "must be read alike by Angular's style parser, which knows neither escapes nor comments and counts the parentheses inside strings"
          : undefined);
      if (problem) errors.push({ path: `${at}/value`, message: problem });
      checkCharacters(declaration.value, `${at}/value`, errors);
    } else {
      checkExpression(declaration.value, `${at}/value`, place.scope, walk);
    }
  }
}

/**
 * Checks an expression's structure (ADR-0035): it is the source at its span, and its
 * references lie in it, in order and apart, each spanning the binding it names (in scope here)
 * or an allowed global. The IR cannot parse the code: the compiler checks a plugin's code
 * against the analyser's.
 */
function checkExpression(
  expression: Expression,
  path: string,
  scope: ReadonlySet<BindingId>,
  walk: Walk,
): void {
  const { errors, bindings, propsName } = walk;
  const { code, span, refs } = expression;
  if (!checkSourceText(expression, path, errors)) return;
  let end = span.start;
  for (const [index, ref] of refs.entries()) {
    const at = `${path}/refs/${index}`;
    if (ref.span.start < end || ref.span.end > span.end || ref.span.start >= ref.span.end) {
      errors.push({
        path: `${at}/span`,
        message: "must lie in the expression, after the reference before it",
      });
      continue;
    }
    end = ref.span.end;
    const text = code.slice(ref.span.start - span.start, ref.span.end - span.start);
    if (ref.kind === "Global") {
      if (!ALLOWED_GLOBALS.has(ref.name)) {
        errors.push({
          path: `${at}/name`,
          message: `must be a global expressions may read, and "${ref.name}" is not one`,
        });
      } else if (text !== ref.name) {
        errors.push({ path: `${at}/span`, message: `must span "${ref.name}"` });
      }
      continue;
    }
    const binding = bindings.get(ref.binding);
    if (!binding) {
      errors.push({
        path: `${at}/binding`,
        message: `must name a binding of the component, and "${ref.binding}" is not one`,
      });
    } else if (!scope.has(ref.binding)) {
      errors.push({
        path: `${at}/binding`,
        message: `must name a binding in scope here, and "${ref.binding}" is a loop variable of another list`,
      });
    } else if (
      binding.kind === "prop" && propsName !== undefined
        ? !isMemberOf(text, propsName, binding.name)
        : text !== binding.name
    ) {
      // The targets splice at the span: a prop in the object form is read only as a member of
      // the parameter, the whole `props.label` (ADR-0035), and in the destructured form by name.
      errors.push({
        path: `${at}/span`,
        message: `must span "${binding.kind === "prop" && propsName !== undefined ? `${propsName}.${binding.name}` : binding.name}"`,
      });
    }
  }
}

/**
 * Whether a reference's text reads `member` of the object `object`: `object.member`, with only
 * whitespace and comments around the dot.
 */
function isMemberOf(text: string, object: string, member: string): boolean {
  if (!text.startsWith(object) || !text.endsWith(member)) return false;
  const between = text.slice(object.length, text.length - member.length);
  return between.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*(?:\n|$)|\s+/g, "") === ".";
}

/**
 * Checks that a copied text is as long as its span, the source it was copied from. Returns
 * whether it is, so offsets into it can be read.
 */
function checkSourceText(
  text: { code: string; span: Span },
  path: string,
  errors: IrValidationError[],
): boolean {
  const length = text.span.end - text.span.start;
  if (text.code.length === length) return true;
  errors.push({
    path: `${path}/code`,
    message: `must be the source at its span, ${length} characters, and is ${text.code.length}`,
  });
  return false;
}

/** Why the targets would render an attribute differently on its element, whatever its value. */
function unportableAttribute(
  tag: string,
  name: string,
  type: string | undefined,
  hasChildren: boolean,
): string | undefined {
  if (DOCUMENT_ATTRIBUTES.has(name)) {
    return `\`${name}\` holds an HTML document, which the compiler cannot analyse`;
  }
  const reason = TEMPLATE_SYNTAX_ATTRIBUTES.get(name) ?? UNRENDERED_ATTRIBUTES.get(name);
  if (reason) return reason;
  if (isStateAttribute(tag, name, type)) {
    return `\`${name}\` is the state of the <${tag}>, which some targets set as its DOM property and others as the attribute`;
  }
  const childless = CHILDLESS_ATTRIBUTES.get(name);
  return hasChildren && childless
    ? `\`${name}\` on an element with children: ${childless}`
    : undefined;
}

/** Why a value is one the targets render differently, or code the compiler cannot analyse. */
function valueProblem(
  tag: string,
  namespace: Namespace,
  name: string,
  value: string,
): string | undefined {
  if (name === "class" && !CANONICAL_CLASS.test(value)) {
    return "must be class names separated by single spaces";
  }
  // Angular merges a static `class` with a bound one through the class list, which drops a
  // repeated name that the other targets keep (ADR-0038).
  const repeated =
    name === "class"
      ? value.split(" ").find((item, index, all) => all.indexOf(item) !== index)
      : undefined;
  if (repeated !== undefined) return `must name the class "${repeated}" once`;
  const unanalysable = unanalysableUrl(tag, name, value);
  if (unanalysable === "javascript") return "must not be a `javascript:` URL";
  if (unanalysable === "data") {
    return `must not be a \`data:\` URL: <${tag}> loads it as a document, which the compiler cannot analyse`;
  }
  if (isDroppedEmptyUrl(tag, name, value)) {
    return `must not be empty: React drops an empty \`${name}\` on <${tag}>`;
  }
  const numeric = namespace === "html" ? NUMERIC_ATTRIBUTES.get(tag)?.get(name) : undefined;
  if (numeric && canonicalNumber(value, numeric) !== value) {
    const { kind, max } = numeric;
    return `must be a canonical ${kind}${max === undefined ? "" : ` up to ${max}`}, as renderers that set the DOM property write it, and "${value}" is not`;
  }
  // React and Qwik type it as a number, so they write it as a number literal (ADR-0037).
  const numberTyped = isNumberTypedAttribute(namespace === "html" ? tag : "", name);
  if (numberTyped && String(Number(value)) !== value) {
    return `must be a number in canonical form, which React and Qwik write as a number literal, and "${value}" is not`;
  }
  return undefined;
}

/** Reports the first character of a string that HTML would not keep as written. */
function checkCharacters(value: string, path: string, errors: IrValidationError[]): void {
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    const problem = unkeptCharacter(codePoint);
    if (!problem) continue;
    const name = `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
    errors.push({
      path,
      message: `must hold only characters HTML keeps, and ${name} (${problem}) is not one`,
    });
    return;
  }
}

/** The `never` default of an exhaustive switch: a kind added to a union fails type checking. */
function unreachable(value: never): never {
  throw new Error(`Unexpected IR value: ${JSON.stringify(value)}`);
}
