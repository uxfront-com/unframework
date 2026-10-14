// Layer 2 of §5.6 (ADR-0055's UF3035 to UF3039): what a parent's compile checks against a
// child's API, which the resolver gives (ADR-0053). An unknown or misspelt prop, event, model or
// slot is reported where `./components.ts` and `./models.ts` lower it, with the name it may mean
// and the rename these helpers offer; a literal outside a prop's union of literals is checked
// here. TypeScript cannot see the macros that declare events, models and slots, and stock JSX
// types accept any of them (§5.6's layer 1), so the compiler is what catches these before M5's
// content mapper.

import type { Fix } from "@unframework/diagnostics";
import type { ApiMember } from "@unframework/ir";
import { parseModule } from "@unframework/parser";

import type { Located, Reporter } from "./context.ts";
import { span } from "./expressions.ts";

/**
 * The edit distance between two strings, a swap of two neighbours counting as one edit, as a
 * typo makes it (`lable`, `Feild`).
 */
function editDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(rows[i - 1]![j]! + 1, rows[i]![j - 1]! + 1, rows[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, rows[i - 2]![j - 2]! + 1);
      }
      rows[i]![j] = best;
    }
  }
  return rows[a.length]![b.length]!;
}

/** The name among `names` closest to `name`, when one is close: a likely misspelling. */
export function closest(name: string, names: readonly string[]): string | undefined {
  let best: { name: string; distance: number } | undefined;
  for (const candidate of names) {
    const distance = editDistance(name.toLowerCase(), candidate.toLowerCase());
    if (distance <= Math.max(1, Math.floor(candidate.length / 3))) {
      if (!best || distance < best.distance) best = { name: candidate, distance };
    }
  }
  return best?.name;
}

/**
 * The likely fix that writes `text` over a misspelt name, for the name `meant` among those the
 * child declares. `others` are the names of the same kind the element writes besides it, and
 * none of them may be `meant` or close to it: the rename, or theirs, would then set one name
 * twice (UF3007). They are `undefined` on `<component is>`, whose candidates may each mean
 * another name: no rename is offered there.
 */
export function renameFix(
  meant: string,
  text: string,
  at: Located,
  others: readonly string[] | undefined,
): Fix[] {
  if (!others || others.some((other) => closest(other, [meant]) !== undefined)) return [];
  return [{ title: `Write \`${text}\``, confidence: "likely", edits: [{ span: span(at), text }] }];
}

/** A literal a parent writes: a string, a number or a boolean. */
type LiteralValue = string | number | boolean;

/**
 * UF3039: a literal passed to a prop whose type is a union of literals (`tone?: "info" |
 * "warning"`), when it is not one of them. `value` is the attribute's string (`tone="warn"`) or
 * the literal in its braces (`tone={"warn"}`). A type the parent's compile cannot read as such a
 * union, a type alias of the child's module among them, is not checked: the outputs' type checks
 * (L4) catch the rest. Returns whether it reported.
 */
export function literalOutsideUnion(
  value: Located & { value: unknown },
  inBraces: boolean,
  prop: ApiMember,
  component: string,
  reporter: Reporter,
  fixable: boolean,
): boolean {
  const written = value.value;
  if (typeof written !== "string" && typeof written !== "number" && typeof written !== "boolean") {
    return false;
  }
  const literals = literalsOf(prop.type);
  if (!literals || literals.some((literal) => literal.value === written)) return false;
  const strings = literals.flatMap((literal) =>
    typeof literal.value === "string" ? [literal.value] : [],
  );
  const meant = typeof written === "string" ? meantString(written, strings) : undefined;
  const text =
    meant === undefined
      ? undefined
      : inBraces
        ? JSON.stringify(meant)
        : /["\\&\r\n]/.test(meant)
          ? undefined
          : `"${meant}"`;
  const union = literals.map((literal) => literal.text).join(" | ");
  reporter.report(
    "UF3039",
    value,
    `${component}'s \`${prop.name}\` takes \`${union}\`, and ${JSON.stringify(written)} is none of them.${meant === undefined ? "" : ` Did you mean ${JSON.stringify(meant)}?`}`,
    {
      help: `Pass one of the literals of \`${prop.name}\`, or add ${JSON.stringify(written)} to its type in ${component}.`,
      ...(text !== undefined && fixable
        ? {
            fixes: [
              {
                title: `Write \`${JSON.stringify(meant)}\``,
                confidence: "likely",
                edits: [{ span: span(value), text }],
              },
            ],
          }
        : {}),
    },
  );
  return true;
}

/**
 * The string literal a value may mean: the closest one, or the one it begins (`"warn"` for
 * `"warning"`), which an edit distance counts as far.
 */
function meantString(value: string, literals: readonly string[]): string | undefined {
  const near = closest(value, literals);
  if (near !== undefined) return near;
  const started = literals.filter((literal) => value && literal.startsWith(value));
  return started.length === 1 ? started[0] : undefined;
}

/**
 * The literals of a prop's type as written in the child, `"info" | "warning" | undefined`: each
 * member a string, number or boolean literal, or `undefined` or `null`, which an optional prop
 * may hold and a parent never writes as a literal here. `undefined` for any other type.
 */
function literalsOf(type: string): { value: LiteralValue; text: string }[] | undefined {
  const source = `type T = ${type};`;
  const parsed = parseModule("type.ts", source);
  const [statement] = parsed.program.body;
  if (
    parsed.errors.length ||
    parsed.program.body.length !== 1 ||
    statement?.type !== "TSTypeAliasDeclaration"
  ) {
    return undefined;
  }
  const annotation = statement.typeAnnotation;
  const members = annotation.type === "TSUnionType" ? annotation.types : [annotation];
  const literals: { value: LiteralValue; text: string }[] = [];
  for (const member of members) {
    if (member.type === "TSUndefinedKeyword" || member.type === "TSNullKeyword") continue;
    if (member.type !== "TSLiteralType" || member.literal.type !== "Literal") return undefined;
    const { value } = member.literal;
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      return undefined;
    }
    literals.push({ value, text: source.slice(member.start, member.end) });
  }
  return literals.length ? literals : undefined;
}
