// What the coverage gate (plan §7.7) excuses, each with the reason. The gate derives coverage
// from the corpus; an entry here that the corpus covers fails the gate, so the lists only
// shrink as cases arrive.
import type { CapabilityName } from "@unframework/codegen";

/** Catalogued diagnostic codes that no case triggers yet. */
export const EXEMPT_CODES: Readonly<Record<string, string>> = {
  UF1001: "A syntax-error case arrives with the diagnostics corpus in M1.",
  UF1002:
    "No M0 case uses a construct the compiler cannot lower yet; M1's diagnostics cases add them.",
  UF1101: "A file without components is an M1 diagnostics case.",
  UF1102: "A component whose last statement is not JSX is an M1 diagnostics case.",
  UF1103:
    'A string export name (`export { A as "my card" }`) is an M1 diagnostics case; the analyzer\'s tests cover it.',
  UF1104:
    "Components whose names differ only in case are an M1 diagnostics case; the analyzer's tests cover it.",
  UF3001:
    "Unknown, obsolete and wrong-case elements are M1 diagnostics cases (with M1's static JSX); the analyzer's tests cover them.",
  UF3002:
    "Document, metadata and framework-syntax elements (<title>, <slot>, <ng-container>) are M1 diagnostics cases; the analyzer's tests cover them.",
  UF3003:
    "Nesting the parser repairs (p > div, table > tr, foster parenting) is an M1 diagnostics case; the analyzer's tests check it against parse5, Svelte and Vue.",
  UF3004:
    'Non-canonical attributes (className, disabled="", bare non-boolean attributes) are M1 diagnostics cases; the analyzer\'s tests apply every fix.',
  UF3005:
    "Framework-reserved attributes (bind-*, i18n, slot, children, data-hk) are M1 diagnostics cases; the analyzer's tests cover them.",
  UF3006:
    "Attributes that are not the element's are an M1 diagnostics case (M1 owns attribute names); the analyzer's tests cover them.",
  UF3007: "Duplicate attributes are an M1 diagnostics case; the analyzer's tests cover them.",
  UF3008:
    "Unportable values (javascript: URLs, empty src, non-numeric rows) are M1 diagnostics cases; the analyzer's tests cover them.",
  UF3009:
    "Text JSX implementations read differently belongs with M1's JSX whitespace cases; the analyzer's tests check it against Babel, oxc and esbuild.",
  UF3010:
    "Characters HTML does not keep (CR, NUL, controls) belong with M1's escaping cases; the analyzer's tests cover them.",
  UF3011:
    "HTML-only character references (`&check;`) belong with M1's escaping cases; the analyzer's tests check the list against parse5, Babel, oxc and esbuild.",
  UF3012: "JSX returned from a helper is an M1 diagnostics case; the analyzer's tests cover it.",
  UF4001:
    "Only two cells are unsupported: Astro's interactivity, which no M0 case uses (M2's event cases trigger it), and Vue's listbox, which no case can use while Vue, the reference target, writes the shared expectations (ADR-0033); the compiler's tests cover it.",
  UF8001:
    "Raised by a crashing compiler plugin: the L1 canary triggers it, and no case installs plugins.",
  UF9001:
    "An internal compiler error: a case that triggers it is a compiler bug to fix, not to keep.",
};

/** Capabilities that no case uses yet, on any target that supports them. */
export const EXEMPT_CAPABILITIES: Readonly<Partial<Record<CapabilityName, string>>> = {
  interactivity: "M0 cases are static; M2 adds the first interactive cases (events, state).",
  listbox:
    "Vue, the reference target, cannot render a single-selection list box on its client (ADR-0033), so no case can hold one while Vue writes the shared expectations. M3's form cases add one, with `requires` to skip Vue and another reviewed source of expectations.",
};
