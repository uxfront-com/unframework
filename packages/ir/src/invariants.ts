import {
  canonicalNumber,
  DOCUMENT_ATTRIBUTES,
  isBooleanAttribute,
  isHtmlAttribute,
  isHtmlElement,
  isVoidElement,
  NUMERIC_ATTRIBUTES,
  unanalysableUrl,
  unkeptCharacter,
  UNRENDERABLE_ELEMENTS,
} from "./html.ts";
import { isComponentName, isExportName } from "./names.ts";
import {
  CHILDLESS_ATTRIBUTES,
  isDroppedEmptyUrl,
  isStateAttribute,
  isWhitespaceText,
  TEMPLATE_SYNTAX_ATTRIBUTES,
  UNPORTABLE_ELEMENTS,
  UNRENDERED_ATTRIBUTES,
  WHITESPACE_DROPPING_ELEMENTS,
} from "./portability.ts";
import type { ElementNode, UfModule } from "./types.ts";
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
 * - each element is an HTML element every target can render as itself, and a void one has no
 *   children;
 * - each attribute is an attribute of its element (so no event handler), set once, and none
 *   that a target renders differently (`portability.ts`): template syntax, attributes a
 *   framework acts on or sets as state, `contenteditable` with children, an empty URL React
 *   drops, a number in a form renderers rewrite;
 * - `true` is the value of exactly the boolean attributes, and a `class` is canonical;
 * - no value holds code or a document the compiler cannot analyse (`srcdoc`, a `javascript:`
 *   URL, a `data:` URL a frame loads), and text and values hold only characters HTML keeps;
 * - no element whose whitespace Svelte drops holds whitespace-only text.
 *
 * The analyser's IR keeps them by construction, and the compiler checks every module it emits
 * from, a plugin's included. What else the analyser rejects is authoring, which a plugin owns
 * as it owns what its `output` hook writes: how JSX reads text, the names the compiler and the
 * frameworks reserve (`data-uf-*`, `uf-id-`, `data-hk`, `nonce`), nesting the parser repairs,
 * and attributes that are valid but mean nothing where they are written.
 */
export function checkInvariants(module: UfModule): IrValidationError[] {
  const errors: IrValidationError[] = [];
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
    checkElement(component.render, `${path}/render`, errors);
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

function checkElement(element: ElementNode, path: string, errors: IrValidationError[]): void {
  const { tag, attributes, children } = element;
  const unrenderable = UNRENDERABLE_ELEMENTS.get(tag);
  const unportable = UNPORTABLE_ELEMENTS.get(tag);
  if (unrenderable) {
    errors.push({
      path: `${path}/tag`,
      message: `must be an element a component can render: ${unrenderable}`,
    });
  } else if (unportable) {
    errors.push({
      path: `${path}/tag`,
      message: `must be an element every target renders as itself: ${unportable}`,
    });
  } else if (!isHtmlElement(tag)) {
    errors.push({ path: `${path}/tag`, message: `must be an HTML element, and <${tag}> is not` });
  }
  // `type` is an enumerated attribute, read without case; the first one is the one HTML keeps.
  const type = attributes.find((attribute) => attribute.name === "type")?.value;
  const names = new Set<string>();
  for (const [index, { name, value }] of attributes.entries()) {
    const at = `${path}/attributes/${index}`;
    if (!isHtmlAttribute(tag, name)) {
      errors.push({ path: `${at}/name`, message: `must be an attribute of <${tag}>` });
    }
    if (names.has(name)) errors.push({ path: `${at}/name`, message: `must set "${name}" once` });
    names.add(name);
    const unportable = unportableAttribute(
      tag,
      name,
      typeof type === "string" ? type : undefined,
      children.length > 0,
    );
    if (unportable) errors.push({ path: `${at}/name`, message: `must not be set: ${unportable}` });
    if ((value === true) !== isBooleanAttribute(name)) {
      errors.push({
        path: `${at}/value`,
        message:
          value === true
            ? `must be a string: only boolean attributes are true, and "${name}" is not one`
            : `must be true: "${name}" is a boolean attribute`,
      });
    }
    if (typeof value !== "string") continue;
    const problem = valueProblem(tag, name, value);
    if (problem) errors.push({ path: `${at}/value`, message: problem });
    checkCharacters(value, `${at}/value`, errors);
  }
  if (isVoidElement(tag) && children.length) {
    errors.push({ path: `${path}/children`, message: `must be empty: <${tag}> is a void element` });
  }
  for (const [index, child] of children.entries()) {
    const at = `${path}/children/${index}`;
    if (child.kind === "Element") {
      checkElement(child, at, errors);
      continue;
    }
    if (WHITESPACE_DROPPING_ELEMENTS.has(tag) && isWhitespaceText(child.value)) {
      errors.push({
        path: `${at}/value`,
        message: `must not be only whitespace: Svelte's compiler drops it inside <${tag}>, and the other targets keep it`,
      });
    }
    checkCharacters(child.value, `${at}/value`, errors);
  }
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
function valueProblem(tag: string, name: string, value: string): string | undefined {
  if (name === "class" && !CANONICAL_CLASS.test(value)) {
    return "must be class names separated by single spaces";
  }
  const unanalysable = unanalysableUrl(tag, name, value);
  if (unanalysable === "javascript") return "must not be a `javascript:` URL";
  if (unanalysable === "data") {
    return `must not be a \`data:\` URL: <${tag}> loads it as a document, which the compiler cannot analyse`;
  }
  if (isDroppedEmptyUrl(tag, name, value)) {
    return `must not be empty: React drops an empty \`${name}\` on <${tag}>`;
  }
  const numeric = NUMERIC_ATTRIBUTES.get(tag)?.get(name);
  if (numeric && canonicalNumber(value, numeric) !== value) {
    const { kind, max } = numeric;
    return `must be a canonical ${kind}${max === undefined ? "" : ` up to ${max}`}, as renderers that set the DOM property write it, and "${value}" is not`;
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
