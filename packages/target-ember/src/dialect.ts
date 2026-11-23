// Glimmer markup (Ember's template language in strict mode): `{{path}}` mustaches, `{{#if}}` and
// keyed `{{#each}}` blocks, and `{{` written `\{{` in text. A template holds no JavaScript, so
// every expression reaches the template through the class (`ComponentPlan.value`). Glimmer keeps
// whitespace as written, at the edges of an element's content and between elements, so the
// printer adds none.
import {
  candidateAttributes,
  escapeHtmlAttribute,
  escapeHtmlText,
  referencedBindings,
  staticClassValue,
  staticStyleValue,
} from "@unframework.dev/codegen";
import type { MarkupDialect, MarkupPiece, TextPosition } from "@unframework.dev/codegen";
import type {
  ComponentAttribute,
  ComponentNode,
  ElementNode,
  EventAttribute,
  ListenerAttribute,
  ModelAttribute,
  ModelBindingAttribute,
  SlotFill,
  SlotOutletNode,
  TeleportNode,
  TransitionNode,
} from "@unframework.dev/ir";

/** What the dialect asks of the component's class. */
export interface DialectHost {
  value(code: string, subexpression: boolean, at?: object, typed?: boolean): string;
  row(source: string, item: string, index: string | undefined, at: object): string;
  classCode(parts: Parameters<MarkupDialect["classAttribute"]>[0]): string;
  styleCode(parts: Parameters<MarkupDialect["styleAttribute"]>[0]): string;
  /**
   * A root's `style` with the caller's merged in: `null` where a child takes no fallthrough, and
   * `undefined` where the element is no fallthrough root.
   */
  fallthroughStyle(
    parts: Parameters<MarkupDialect["styleAttribute"]>[0],
    element: ElementNode,
  ): string | null | undefined;
  /** A child's `@style` argument, as its declarations. */
  styleArgument(
    parts: Parameters<MarkupDialect["styleAttribute"]>[0],
    element: ElementNode,
  ): string;
  /** Whether the printer writes a child's tag, not an element. */
  isChild(element: ElementNode): boolean;
  /** `<Transition>`: its elements from its entries, by the code of the branch it shows. */
  transition(node: TransitionNode, branch: string): MarkupPiece[];
  /** The modifier that runs a transition's classes on its element. */
  transitionClasses(node: TransitionNode): string;
  /** `<Teleport to>`: its content in `{{#in-element}}`, appended to `to`'s element. */
  teleport(node: TeleportNode): MarkupPiece[];
  /** Whether an element, or a child's tag, takes a `class`. */
  takesClass(element: ElementNode): boolean;
  rawHtml(code: string): string;
  /** A row variable's name in the template, which no tag the template writes takes. */
  rowName(name: string): string;
  /** The module helper that writes an enumerated attribute's boolean as its name. */
  enumerated(): string;
  /** A child's `v-model:value`: its argument, and the callback that writes it back. */
  modelBinding(attribute: ModelBindingAttribute, value: string, component: ComponentNode): string[];
  /** A form control's `v-model`: what shows the state, and what writes it back. */
  model(attribute: ModelAttribute, value: string, element: ElementNode): string[];
  /**
   * What an `<option>` of a `v-model`'s `<select>` adds beside its value: whether the state
   * holds it, `selected={{…}}`, or nothing for any other option.
   */
  optionSelected(element: ElementNode, value: string): string;
  /** A component's fills: its content, or its named blocks. */
  fills(fills: readonly SlotFill[], node: ComponentNode): MarkupPiece[];
  /** A child, in a branch for each set of the slots it forwards that the component got. */
  forwarding(node: ComponentNode): MarkupPiece[];
  /** A slot outlet: `{{yield}}`, with its fallback. */
  slotOutlet(node: SlotOutletNode, props: string | undefined): MarkupPiece[];
  /** The handler of a child's event, which its `@onChange` argument takes. */
  componentListener(attribute: ListenerAttribute, node: ComponentNode): string;
  /** A directive's modifier, with its value. */
  directive(name: string, value: string, element: ElementNode): string;
  /** The modifier that holds an element in a template ref's member. */
  templateRef(name: string, element: ElementNode): string;
  /** The handler a listener's `{{on}}` takes: a member, or a call of one with row variables. */
  listener(attribute: EventAttribute, at: object): string;
  /** What holds a node of the template: a branch's `If`, an element's parent. */
  parentOf(node: object): object | undefined;
}

/** `{{` as Glimmer's escape, so the text stays text. */
const escapeMustaches = (text: string) => text.replace(/\{\{/g, "\\{{");

/** The elements whose text Glimmer's tokenizer reads a leading line feed of as HTML does. */
const LEADING_LINE_FEED = new Set(["pre", "textarea", "listing"]);

/**
 * Text as Glimmer reads it back. Inside a `<pre>`, Glimmer drops the line feed that starts a
 * text after a mustache, as HTML drops the one after the start tag, so that one is a reference.
 */
function escapeText(text: string, position: TextPosition): string {
  const escaped = escapeMustaches(escapeHtmlText(text));
  const element = position.element?.tag;
  if (!position.first && element && LEADING_LINE_FEED.has(element) && escaped.startsWith("\n")) {
    return `&#10;${escaped.slice(1)}`;
  }
  return escaped;
}

/** A static attribute value, as Glimmer reads it back. */
const attributeValue = (value: string) => escapeMustaches(escapeHtmlAttribute(value));

/** Vue's enumerated attributes (`isEnumeratedAttr`), besides ARIA's, which take a boolean's name. */
const ENUMERATED: ReadonlySet<string> = new Set(["contenteditable", "draggable", "spellcheck"]);

/** ARIA's attributes whose value ARIA types as a string or ID references: never a boolean. */
const ARIA_STRINGS: ReadonlySet<string> = new Set([
  "aria-activedescendant",
  "aria-braillelabel",
  "aria-brailleroledescription",
  "aria-controls",
  "aria-describedby",
  "aria-description",
  "aria-details",
  "aria-errormessage",
  "aria-flowto",
  "aria-keyshortcuts",
  "aria-label",
  "aria-labelledby",
  "aria-owns",
  "aria-placeholder",
  "aria-roledescription",
  "aria-valuetext",
]);

/** Whether an attribute takes a boolean's name: ARIA's, and the enumerated ones. */
function isEnumerated(name: string): boolean {
  if (ARIA_STRINGS.has(name)) return false;
  return name.startsWith("aria-") || ENUMERATED.has(name.toLowerCase());
}

/** The key Glimmer's `{{#each}}` takes: a path of the item, the item itself, or its index. */
function eachKey(key: string, item: string, index: string | undefined): string {
  if (key === item) return "@identity";
  if (index !== undefined && key === index) return "@index";
  const path = new RegExp(`^${item}((?:\\??\\.[A-Za-z_$][\\w$]*)+)$`).exec(key);
  if (path) return path[1]!.replace(/\?\./g, ".").slice(1);
  return "@identity";
}

/** The Glimmer dialect, reading expressions through `host`. */
export function emberDialect(host: DialectHost): MarkupDialect {
  return {
    name: "ember",
    escapeText,
    attribute: (name, value, _tag, context) => {
      const text = `${name}="${attributeValue(value)}"`;
      if (name !== "value" || context?.element.tag !== "option") return text;
      return `${text}${host.optionSelected(context.element, JSON.stringify(value))}`;
    },
    voidElement: "html",
    stripsWhitespaceBetweenElements: false,
    stripsEdgeWhitespace: false,
    interpolation: (code, position) => `{{${host.value(code, false, position.container)}}}`,
    // Glimmer writes `true` as an empty attribute and leaves `false` out, where an ARIA or an
    // enumerated attribute takes the boolean's name (`aria-expanded="false"`).
    boundAttribute: (name, code, { element }) => {
      if (isEnumerated(name)) {
        return `${name}={{${host.enumerated()} ${host.value(code, true, element)}}}`;
      }
      const text = `${name}={{${host.value(code, false, element)}}}`;
      if (name !== "value" || element.tag !== "option") return text;
      return `${text}${host.optionSelected(element, code)}`;
    },
    classAttribute: (parts, { element }) =>
      host.takesClass(element)
        ? [
            {
              name: "class",
              text: parts.every((part) => part.kind === "Static")
                ? `class="${attributeValue(staticClassValue(parts))}"`
                : `class={{${host.value(host.classCode(parts), false, element)}}}`,
            },
          ]
        : [],
    // A child's `style` is its `@style` argument, which Glimmer does not let replace the root's
    // own, as a `style` attribute would (`fallthrough.ts`).
    styleAttribute: (parts, { element }) => {
      const merged = host.fallthroughStyle(parts, element);
      if (merged === null) return [];
      const name = host.isChild(element) ? "@style" : "style";
      const text =
        merged ??
        (parts.every((part) => part.kind === "Static")
          ? `${name}="${attributeValue(staticStyleValue(parts))}"`
          : host.isChild(element)
            ? `@style={{${host.styleArgument(parts, element)}}}`
            : `style={{${host.value(host.styleCode(parts), false, element)}}}`);
      return [{ name, text }];
    },
    conditional: (branches) => {
      const at = host.parentOf(branches[0]!.branch);
      return [
        {
          kind: "block",
          segments: branches.map(({ condition, branch }, index) => ({
            open:
              index === 0
                ? `{{#if ${host.value(condition!, true, at)}}}`
                : condition === undefined
                  ? "{{else}}"
                  : `{{else if ${host.value(condition, true, at)}}}`,
            content: { kind: "nodes", nodes: branch.children, container: branch },
          })),
          close: "{{/if}}",
        },
      ];
    },
    // Glimmer has no `<component is>` over a tag, so each candidate is a branch, the last one
    // `{{else}}`: a tag where the choice is its name, a component where it is the component.
    dynamic: ({ node, is }) => {
      const choice = host.value(is, true, host.parentOf(node));
      const last = node.candidates.length - 1;
      const segments = node.candidates.map((candidate, index) => {
        const test =
          candidate.kind === "Tag"
            ? `(eq ${choice} ${JSON.stringify(candidate.tag)})`
            : `(eq ${choice} ${candidate.component})`;
        const open =
          index === 0 ? `{{#if ${test}}}` : index === last ? "{{else}}" : `{{else if ${test}}}`;
        const content: MarkupPiece =
          candidate.kind === "Tag"
            ? {
                kind: "element",
                element: {
                  kind: "Element",
                  tag: candidate.tag,
                  // Each branch writes only the attributes its tag takes (ADR-0119).
                  attributes: candidateAttributes(node, candidate.tag),
                  children: node.children,
                  span: node.span,
                },
                directives: [],
              }
            : host.forwarding({
                kind: "Component",
                component: candidate.component,
                attributes: node.attributes as ComponentAttribute[],
                fills: node.fills ?? [],
                span: node.span,
              })[0]!;
        return { open, content };
      });
      return [{ kind: "block", segments, close: "{{/if}}" }];
    },
    list: ({ node, source, item: itemName, index: indexName, key }) => {
      const item = host.rowName(itemName);
      const index = indexName === undefined ? undefined : host.rowName(indexName);
      // The key is no expression in Glimmer (`key="@index"`): only the body reads the index.
      const readsIndex =
        index !== undefined &&
        node.index !== undefined &&
        referencedBindings(node.body).has(node.index);
      const value = host.row(source, item, readsIndex ? index : undefined, node);
      // The key is a path, so a body that reads neither the item nor the index takes no params.
      const readsItem = readsIndex || referencedBindings(node.body).has(node.item);
      const params = readsIndex ? ` as |${item} ${index}|` : readsItem ? ` as |${item}|` : "";
      return [
        {
          kind: "block",
          segments: [
            {
              open: `{{#each ${value} key="${eachKey(key, item, index)}"${params}}}`,
              content: { kind: "nodes", nodes: [node.body], container: node },
            },
          ],
          close: "{{/each}}",
        },
      ];
    },
    // What a capability cell leaves unsupported prints nothing: the compile reports UF4001 as an
    // error there, so the case has no Ember output.
    // `on` is a keyword of strict mode, which takes `addEventListener`'s options as named
    // arguments.
    eventAttribute: ({ attribute }, { element }) => {
      const options = (["capture", "once", "passive"] as const)
        .filter((option) => attribute[option])
        .map((option) => ` ${option}=true`)
        .join("");
      const handler = host.listener(attribute, element);
      return [{ name: "on", text: `{{on "${attribute.event}" ${handler}${options}}}` }];
    },
    refAttribute: ({ name }, { element }) => [
      { name: "ref", text: host.templateRef(name, element) },
    ],
    // A directive is a modifier: `{{vFocusTrap this.open}}` (ADR-0099).
    directiveAttribute: ({ attribute, value }, { element }) => [
      { name: attribute.name, text: host.directive(attribute.name, value, element) },
    ],
    // A child's props and events are its arguments (ADR-0053): `@label="Name"`,
    // `@count={{this.total}}`, and `@onClear={{this.reset}}` for its `clear` event.
    propAttribute: ({ name, code, literal }, { component }) => [
      {
        name: `@${name}`,
        text:
          literal !== undefined
            ? `@${name}="${attributeValue(literal)}"`
            : `@${name}={{${host.value(code, false, component, true)}}}`,
      },
    ],
    componentEvent: ({ attribute }, { component }) => {
      const name = `@on${attribute.event.charAt(0).toUpperCase()}${attribute.event.slice(1)}`;
      return [{ name, text: `${name}={{${host.componentListener(attribute, component)}}}` }];
    },
    modelAttribute: ({ attribute, value }, { element }) =>
      host.model(attribute, value, element).map((text) => ({ name: "model", text })),
    modelBinding: ({ attribute, value }, { component }) =>
      host.modelBinding(attribute, value, component).map((text) => ({ name: "model", text })),
    fills: (fills, { component }) =>
      host.fills(
        fills.map(({ fill }) => fill),
        component,
      ),
    slotOutlet: ({ node, props }) => host.slotOutlet(node, props?.code),
    teleport: ({ node }) => host.teleport(node),
    component: (node) => host.forwarding(node),
    // A transition renders its elements from a list, so a leaving one stays until its leave
    // ends, each running Vue's classes through a modifier (`transition.ts`).
    transition: ({ node, branch }) => host.transition(node, branch),
    transitionAttributes: ({ node }) => [
      { name: "transition", text: host.transitionClasses(node) },
    ],
    rawHtmlContent: (code) => host.rawHtml(code),
  };
}
