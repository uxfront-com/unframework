// Accessible handlers (UF3030, ADR-0047): Svelte's compiler warns about a listener a keyboard user
// cannot reach or a screen reader does not announce as interactive, and any warning fails its L3,
// so the analyser reports the same cases for every target. These are the five handler-dependent
// rules of Svelte 5.57.1 (`phases/2-analyze/visitors/shared/a11y/index.js`), with its tables
// (`constants.js`, built from aria-query and axobject-query), judged on the source's listeners:
// every listener counts by its DOM event, whatever its option (Svelte would not count
// `onclickcapture` as a click, nor an `{@attach}` listener), so the analyser is never weaker
// than Svelte. A spread's keys count as attributes whose values are not known, where Svelte
// skips an element with a spread. `test/a11y-conformance.test.ts` pins the tables against
// Svelte's and each rule against its compiler.

/** An attribute of an element as the rules read it: its static value, `true` without one. */
export type A11yValue = string | true | null;

/** A role schema: an element, and the attributes (with their values, where set) it needs. */
interface Schema {
  readonly name: string;
  readonly attributes?: readonly { readonly name: string; readonly value?: string }[];
}

/** Reads `input[list,type=email]` as a schema. */
function schema(text: string): Schema {
  const match = /^([a-z0-9]+)(?:\[(.*)\])?$/.exec(text)!;
  const [, name, list] = match;
  if (list === undefined) return { name: name! };
  return {
    name: name!,
    attributes: list.split(",").map((item) => {
      const [attribute, value] = item.split("=");
      return value === undefined ? { name: attribute! } : { name: attribute!, value };
    }),
  };
}

const schemas = (text: string): readonly Schema[] => text.trim().split(/\s+/).map(schema);
const words = (text: string): ReadonlySet<string> => new Set(text.trim().split(/\s+/));

/** Svelte's `interactive_element_role_schemas`: elements whose roles are all interactive. */
export const INTERACTIVE_ROLE_SCHEMAS: readonly Schema[] = schemas(`
  input[type=button] input[type=image] input[type=reset] input[type=submit] button td
  input[type=checkbox] th th[scope=col] th[scope=colgroup] input[list,type=email]
  input[list,type=search] input[list,type=tel] input[list,type=text] input[list,type=url]
  select[multiple,size] dialog td a[href] area[href] select[size] select[multiple] datalist option
  input[type=radio] tr th[scope=row] th[scope=rowgroup] input[list,type=search] input[type=range]
  input[type=number] input[type,list] input[list,type=email] input[list,type=tel]
  input[list,type=text] input[list,type=url] textarea
`);

/** Svelte's `non_interactive_element_role_schemas`: elements whose roles are all non-interactive. */
export const NON_INTERACTIVE_ROLE_SCHEMAS: readonly Schema[] = schemas(`
  article header blockquote caption code aside aside[aria-label] aside[aria-labelledby] footer dd
  del html em figure form[aria-label] form[aria-labelledby] form[name] details fieldset optgroup
  address h1 h2 h3 h4 h5 h6 img[alt] img[alt] ins menu ol ul li main mark math meter nav p
  img[alt=] progress section[aria-label] section[aria-labelledby] tbody tfoot thead hr output
  strong sub sup table dfn dt time
`);

/** Svelte's `interactive_element_ax_object_schemas`: elements axobject-query calls widgets. */
export const INTERACTIVE_AX_SCHEMAS: readonly Schema[] = schemas(`
  audio button canvas td input[type=checkbox] input[type=color] th select input[type=date]
  input[type=datetime] summary embed input input[type=time] a[href] option datalist menuitem
  input[type=radio] th[scope=row] input[type=search] input[type=range] input[type=number] textarea
  input[type=text] video
`);

/** Svelte's `non_interactive_element_ax_object_schemas`: elements of structure or windows. */
export const NON_INTERACTIVE_AX_SCHEMAS: readonly Schema[] = schemas(`
  abbr article blockquote caption dfn dd dl dt details dir figcaption figure footer form h1 h2 h3
  h4 h5 h6 img[usemap] img label legend br li ul ol main mark marquee menu meter nav p pre progress
  tr ruby table time
`);

/** Svelte's `interactive_roles`. */
export const INTERACTIVE_ROLES: ReadonlySet<string> = words(`
  alertdialog button cell checkbox columnheader combobox dialog grid gridcell link listbox menu
  menubar menuitem menuitemcheckbox menuitemradio option radio radiogroup row rowheader scrollbar
  searchbox slider spinbutton switch tab tablist tabpanel textbox toolbar tree treegrid treeitem
  doc-backlink doc-biblioref doc-glossref doc-noteref
`);

/** Svelte's `non_interactive_roles`. */
export const NON_INTERACTIVE_ROLES: ReadonlySet<string> = words(`
  alert application article banner blockquote caption code complementary contentinfo definition
  deletion directory document emphasis feed figure form group heading img insertion list listitem
  log main mark marquee math meter navigation none note paragraph presentation region rowgroup
  search separator status strong subscript superscript table term time timer tooltip doc-abstract
  doc-acknowledgments doc-afterword doc-appendix doc-biblioentry doc-bibliography doc-chapter
  doc-colophon doc-conclusion doc-cover doc-credit doc-credits doc-dedication doc-endnote
  doc-endnotes doc-epigraph doc-epilogue doc-errata doc-example doc-footnote doc-foreword
  doc-glossary doc-index doc-introduction doc-notice doc-pagebreak doc-pagefooter doc-pageheader
  doc-pagelist doc-part doc-preface doc-prologue doc-pullquote doc-qna doc-subtitle doc-tip doc-toc
  graphics-document graphics-object graphics-symbol progressbar
`);

/** Svelte's `abstract_roles`. */
export const ABSTRACT_ROLES: ReadonlySet<string> = words(`
  command composite input landmark range roletype section sectionhead select structure widget
  window
`);

/** Svelte's `presentation_roles`. */
export const PRESENTATION_ROLES: ReadonlySet<string> = words("presentation none");

/** Svelte's `a11y_interactive_handlers`: the events a user acts with. */
export const INTERACTIVE_HANDLERS: ReadonlySet<string> = words(`
  keypress keydown keyup click contextmenu dblclick drag dragend dragenter dragexit dragleave
  dragover dragstart drop mousedown mouseenter mouseleave mousemove mouseout mouseover mouseup
  pointerdown pointerup pointermove pointerenter pointerleave pointerover pointerout pointercancel
  touchstart touchend touchmove touchcancel
`);

/** Svelte's `a11y_recommended_interactive_handlers`. */
export const RECOMMENDED_HANDLERS: ReadonlySet<string> = words(
  "click mousedown mouseup keypress keydown keyup",
);

/** What Svelte's `element_interactivity` makes of an element. */
type Interactivity = "interactive" | "non-interactive" | "static";

/** One of Svelte's handler-dependent accessibility warnings, as UF3030 reports it. */
export interface A11yProblem {
  /** Svelte's warning code: `a11y_click_events_have_key_events`. */
  readonly rule: string;
  readonly message: string;
}

/**
 * Svelte 5.57.1's handler-dependent accessibility warnings for an element: its tag, its
 * attributes by name (`null` for one whose value is not static), and the DOM events its
 * listeners handle.
 */
export function handlerProblems(
  tag: string,
  attributes: ReadonlyMap<string, A11yValue>,
  handlers: ReadonlySet<string>,
): A11yProblem[] {
  const problems: A11yProblem[] = [];
  if (!handlers.size) return problems;
  const interactivity = elementInteractivity(tag, attributes);
  const interactive = interactivity === "interactive";
  const nonInteractive = interactivity === "non-interactive";
  const staticElement = interactivity === "static";
  const hidden = hiddenFromScreenReader(tag, attributes);
  const role = attributes.has("role");
  const roleValue = staticText(attributes.get("role"));
  const element = `<${tag}>`;

  // interactive-supports-focus: in Svelte's `role` attribute loop, one role at a time.
  const roleAttribute = attributes.get("role");
  if (typeof roleAttribute === "string") {
    for (const current of roleAttribute.split(/\s+/)) {
      if (
        current &&
        !disabled(attributes) &&
        !hidden &&
        !PRESENTATION_ROLES.has(current) &&
        INTERACTIVE_ROLES.has(current) &&
        staticElement &&
        !attributes.has("tabindex") &&
        [...handlers].some((handler) => INTERACTIVE_HANDLERS.has(handler))
      ) {
        problems.push({
          rule: "a11y_interactive_supports_focus",
          message: `${element} has the interactive role "${current}" and a handler, but no \`tabindex\`: a keyboard user cannot focus it`,
        });
      }
    }
  }

  // click-events-have-key-events
  if (handlers.has("click")) {
    const nonPresentation = roleValue !== null && !PRESENTATION_ROLES.has(roleValue);
    if (
      !hidden &&
      (!role || nonPresentation) &&
      !interactive &&
      !handlers.has("keydown") &&
      !handlers.has("keyup") &&
      !handlers.has("keypress")
    ) {
      problems.push({
        rule: "a11y_click_events_have_key_events",
        message: `${element} has a click handler and no \`keydown\`, \`keyup\` or \`keypress\` handler: a keyboard user cannot activate it`,
      });
    }
  }

  // no-noninteractive-element-interactions
  if (
    !attributes.has("contenteditable") &&
    !hidden &&
    !(roleValue !== null && PRESENTATION_ROLES.has(roleValue)) &&
    ((!interactive && roleValue !== null && NON_INTERACTIVE_ROLES.has(roleValue)) ||
      (nonInteractive && !role)) &&
    [...handlers].some((handler) => RECOMMENDED_HANDLERS.has(handler))
  ) {
    problems.push({
      rule: "a11y_no_noninteractive_element_interactions",
      message: `${element} is not interactive${roleValue === null ? "" : ` (its role is "${roleValue}")`}, and has a mouse or keyboard handler: a screen reader does not announce it as something to act on`,
    });
  }

  // no-static-element-interactions
  const listed = [...handlers].filter((handler) => INTERACTIVE_HANDLERS.has(handler));
  if (
    (!role || roleValue !== null) &&
    !hidden &&
    !(roleValue !== null && PRESENTATION_ROLES.has(roleValue)) &&
    !interactive &&
    !(roleValue !== null && INTERACTIVE_ROLES.has(roleValue)) &&
    !nonInteractive &&
    !(roleValue !== null && NON_INTERACTIVE_ROLES.has(roleValue)) &&
    !(roleValue !== null && ABSTRACT_ROLES.has(roleValue)) &&
    listed.length
  ) {
    problems.push({
      rule: "a11y_no_static_element_interactions",
      message: `${element} has ${listed.length > 1 ? "handlers" : "a handler"} for ${
        listed.length > 1
          ? `${listed
              .slice(0, -1)
              .map((handler) => `\`${handler}\``)
              .join(", ")} and \`${listed.at(-1)}\``
          : `\`${listed[0]}\``
      } and no role: neither a screen reader nor a keyboard user can tell it is interactive`,
    });
  }

  // mouse-events-have-key-events
  if (handlers.has("mouseover") && !handlers.has("focus") && !handlers.has("focusin")) {
    problems.push({
      rule: "a11y_mouse_events_have_key_events",
      message: `${element} has a \`mouseover\` handler and no \`focus\` or \`focusin\` handler: a keyboard user never triggers it`,
    });
  }
  if (handlers.has("mouseout") && !handlers.has("blur") && !handlers.has("focusout")) {
    problems.push({
      rule: "a11y_mouse_events_have_key_events",
      message: `${element} has a \`mouseout\` handler and no \`blur\` or \`focusout\` handler: a keyboard user never triggers it`,
    });
  }
  return problems;
}

/** Svelte's `element_interactivity`. */
function elementInteractivity(
  tag: string,
  attributes: ReadonlyMap<string, A11yValue>,
): Interactivity {
  const matches = (list: readonly Schema[]) =>
    list.some((item) => matchSchema(item, tag, attributes));
  if (matches(INTERACTIVE_ROLE_SCHEMAS)) return "interactive";
  if (tag !== "header" && matches(NON_INTERACTIVE_ROLE_SCHEMAS)) return "non-interactive";
  if (matches(INTERACTIVE_AX_SCHEMAS)) return "interactive";
  if (matches(NON_INTERACTIVE_AX_SCHEMAS)) return "non-interactive";
  return "static";
}

/** Svelte's `match_schema`: an attribute value of `""` asks for the attribute alone. */
function matchSchema(
  item: Schema,
  tag: string,
  attributes: ReadonlyMap<string, A11yValue>,
): boolean {
  if (item.name !== tag) return false;
  return (item.attributes ?? []).every(({ name, value }) => {
    if (!attributes.has(name)) return false;
    return !value || value === staticText(attributes.get(name));
  });
}

/** Svelte's `is_hidden_from_screen_reader`. */
function hiddenFromScreenReader(tag: string, attributes: ReadonlyMap<string, A11yValue>): boolean {
  if (tag === "input" && attributes.get("type") === "hidden") return true;
  if (!attributes.has("aria-hidden")) return false;
  const value = attributes.get("aria-hidden") ?? null;
  return value === null || value === true || value === "true";
}

/** Svelte's `has_disabled_attribute`. */
function disabled(attributes: ReadonlyMap<string, A11yValue>): boolean {
  if (attributes.get("disabled")) return true;
  return attributes.get("aria-disabled") === "true";
}

/** Svelte's `get_static_text_value`: a static string, or `null`. */
function staticText(value: A11yValue | undefined): string | null {
  return typeof value === "string" ? value : null;
}
