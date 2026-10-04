// ARIA's value types and roles (WAI-ARIA 1.2, with DPUB-ARIA and Graphics ARIA's roles), which
// the analyser checks static values against (UF3008): assistive technology ignores a value ARIA
// does not define, and Svelte's compiler warns about one, as it does with aria-query's tables.
// The conformance tests compare these tables with aria-query's, through Svelte.

/** What an ARIA attribute's value is. */
export type AriaType =
  | { type: "boolean" }
  | { type: "tristate" }
  | { type: "string" }
  | { type: "id" }
  | { type: "idlist" }
  | { type: "integer" }
  | { type: "number" }
  | { type: "token"; values: readonly string[] }
  | { type: "tokenlist"; values: readonly string[] };

const words = (text: string): string[] => text.trim().split(/\s+/);

const of = (type: AriaType, names: string): [string, AriaType][] =>
  words(names).map((name) => [name, type]);

/** Each ARIA attribute's value type, by name (`ARIA_ATTRIBUTES` lists the names). */
export const ARIA_TYPES: ReadonlyMap<string, AriaType> = new Map([
  ...of(
    { type: "boolean" },
    `aria-atomic aria-busy aria-disabled aria-expanded aria-hidden aria-modal aria-multiline
     aria-multiselectable aria-readonly aria-required aria-selected`,
  ),
  ...of({ type: "tristate" }, "aria-checked aria-pressed"),
  ...of(
    { type: "string" },
    `aria-braillelabel aria-brailleroledescription aria-description aria-keyshortcuts aria-label
     aria-placeholder aria-roledescription aria-valuetext`,
  ),
  ...of({ type: "id" }, "aria-activedescendant aria-details aria-errormessage"),
  ...of({ type: "idlist" }, "aria-controls aria-describedby aria-flowto aria-labelledby aria-owns"),
  ...of(
    { type: "integer" },
    `aria-colcount aria-colindex aria-colspan aria-level aria-posinset aria-rowcount
     aria-rowindex aria-rowspan aria-setsize`,
  ),
  ...of({ type: "number" }, "aria-valuemax aria-valuemin aria-valuenow"),
  ...of({ type: "token", values: words("inline list both none") }, "aria-autocomplete"),
  ...of(
    { type: "token", values: words("page step location date time true false") },
    "aria-current",
  ),
  ...of(
    { type: "token", values: words("false true menu listbox tree grid dialog") },
    "aria-haspopup",
  ),
  ...of({ type: "token", values: words("grammar false spelling true") }, "aria-invalid"),
  ...of({ type: "token", values: words("assertive off polite") }, "aria-live"),
  ...of({ type: "token", values: words("vertical undefined horizontal") }, "aria-orientation"),
  ...of({ type: "tokenlist", values: words("additions all removals text") }, "aria-relevant"),
  ...of({ type: "token", values: words("ascending descending none other") }, "aria-sort"),
]);

/** ARIA's roles an author may write: every role but the abstract ones. */
export const ARIA_ROLES: ReadonlySet<string> = new Set(
  words(`
    alert alertdialog application article banner blockquote button caption cell checkbox code
    columnheader combobox complementary contentinfo definition deletion dialog directory document
    emphasis feed figure form generic grid gridcell group heading img insertion link list listbox
    listitem log main mark marquee math menu menubar menuitem menuitemcheckbox menuitemradio meter
    navigation none note option paragraph presentation progressbar radio radiogroup region row
    rowgroup rowheader scrollbar search searchbox separator slider spinbutton status strong
    subscript superscript switch tab table tablist tabpanel term textbox time timer toolbar tooltip
    tree treegrid treeitem
    doc-abstract doc-acknowledgments doc-afterword doc-appendix doc-backlink doc-biblioentry
    doc-bibliography doc-biblioref doc-chapter doc-colophon doc-conclusion doc-cover doc-credit
    doc-credits doc-dedication doc-endnote doc-endnotes doc-epigraph doc-epilogue doc-errata
    doc-example doc-footnote doc-foreword doc-glossary doc-glossref doc-index doc-introduction
    doc-noteref doc-notice doc-pagebreak doc-pagefooter doc-pageheader doc-pagelist doc-part
    doc-preface doc-prologue doc-pullquote doc-qna doc-subtitle doc-tip doc-toc
    graphics-document graphics-object graphics-symbol
  `),
);

/** ARIA's abstract roles, which only the specification's own role tree uses. */
export const ABSTRACT_ROLES: ReadonlySet<string> = new Set(
  words(
    "command composite input landmark range roletype section sectionhead select structure widget window",
  ),
);

/**
 * Why a value is not one an ARIA attribute takes, or `undefined`, as Svelte's compiler reads it:
 * true or false exactly, a token from the attribute's list (in any case), a number or an integer,
 * or text that is not empty.
 */
export function ariaValueProblem(name: string, value: string): string | undefined {
  const aria = ARIA_TYPES.get(name);
  if (!aria) return undefined;
  switch (aria.type) {
    case "boolean":
      return value === "true" || value === "false" ? undefined : '`"true"` or `"false"`';
    case "tristate":
      return value === "true" || value === "false" || value === "mixed"
        ? undefined
        : '`"true"`, `"false"` or `"mixed"`';
    case "string":
    case "id":
    case "idlist":
      return value === "" ? "text that is not empty" : undefined;
    case "integer":
      return value !== "" && Number.isInteger(Number(value)) ? undefined : "an integer";
    case "number":
      return value !== "" && !Number.isNaN(Number(value)) ? undefined : "a number";
    case "token":
      return aria.values.includes(value.toLowerCase()) ? undefined : alternatives(aria.values);
    default:
      return value
        .toLowerCase()
        .split(/\s+/)
        .every((token) => aria.values.includes(token))
        ? undefined
        : `one or more of ${alternatives(aria.values)}`;
  }
}

/**
 * Why a `role` is not one ARIA defines, or `undefined`: each of its space-separated tokens must
 * be a role, and none abstract.
 */
export function roleProblem(value: string): string | undefined {
  for (const role of value.split(/[\t\n\f\r ]+/).filter(Boolean)) {
    if (ABSTRACT_ROLES.has(role))
      return `\`${role}\` is an abstract role, which authors cannot use`;
    if (!ARIA_ROLES.has(role)) return `\`${role}\` is not an ARIA role`;
  }
  return undefined;
}

function alternatives(values: readonly string[]): string {
  const quoted = values.map((value) => `\`"${value}"\``);
  return `${quoted.slice(0, -1).join(", ")} or ${quoted.at(-1)}`;
}
