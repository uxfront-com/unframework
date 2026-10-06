// Whether a spread's source may be nullish where it is spread (ADR-0039), which the IR records
// as `SpreadAttribute.nullish`: the targets then read each key through `?.`. The source's kinds
// say whether its type may be nullish; the conditions around the spread narrow it, as TypeScript
// and every target's checker do (`./narrowing.ts`). Both reads must match what the checkers see:
// a `.` on a source they take to be nullish fails them and throws at run time, and Angular
// rejects a `?.` on a member it has narrowed to an object (NG8107). So a condition that tests the
// source is followed where every checker narrows it alike, and reported where the compiler
// cannot tell.

import type { AST } from "@unframework/parser";

import { angularChecks, narrowingAt, referencePath } from "./narrowing.ts";
import type { RenderContext } from "./render.ts";
import { mayBeNullish } from "./types/kinds.ts";
import type { Kinds } from "./types/kinds.ts";

/** What the conditions around a spread make of its source. */
export type SpreadSource =
  /** Whether the source may be nullish where the spread is: the spread's `nullish`. */
  | { kind: "read"; nullish: boolean }
  /** A condition around the spread holds only when the source is nullish: it renders nothing. */
  | { kind: "absent"; condition: AST.Expression }
  /** A condition tests the source where the targets' checkers would not read it alike. */
  | { kind: "unfollowed"; condition: AST.Expression; message: string; help: string };

/**
 * What the spread `item`, whose argument has the given kinds, reads its source as. A source that
 * TypeScript can narrow (a prop, a list's item or a member of one, by static keys) is narrowed
 * by the conditions around the spread as TypeScript narrows it (`./narrowing.ts`): a branch
 * where a test shows it present has an object; one where a test shows it absent has nothing to
 * spread. Where the targets' checkers may read it apart (a prop or a member narrowed outside a
 * list's callback that holds the spread, which TypeScript forgets there; a test the compiler
 * does not follow), a prop or a list's item reads its keys through `?.`, which every target
 * takes, and a member, which Angular's checker narrows and then rejects `?.` on, is reported.
 */
export function spreadSource(
  item: AST.JSXSpreadAttribute,
  kinds: Kinds,
  render: RenderContext,
): SpreadSource {
  if (!mayBeNullish(kinds)) return { kind: "read", nullish: false };
  const source = referencePath(item.argument, render);
  // TypeScript narrows references only: a conditional, a call or an index keeps its type.
  if (!source) return { kind: "read", nullish: true };
  const narrowing = narrowingAt(item, source, render);
  if (narrowing.kind === "absent") return narrowing;
  if (narrowing.kind !== "unfollowed") {
    return { kind: "read", nullish: narrowing.kind === "declared" };
  }
  // Read through `?.`, its keys pass every target where Angular does not check the source (a
  // prop, a list's item): Angular rejects a needless `?.` only on what it narrows and checks.
  if (!angularChecks(source, render)) return { kind: "read", nullish: true };
  const reason = narrowing.reason === "callback" ? "callback" : "form";
  return { kind: "unfollowed", condition: narrowing.condition, ...UNFOLLOWED[reason] };
}

/** Why a spread whose source a condition tests is reported, and what to write instead. */
const UNFOLLOWED = {
  callback: {
    message:
      "A spread of a member that may be absent is not supported yet in a list's callback when a condition outside the list narrows it: TypeScript does not narrow a property in a callback, and Angular's checker does, so no read of its keys passes every target's checks.",
    help: "Test it inside the list's callback, or spread it without the condition: a spread of an absent object renders no attribute.",
  },
  form: {
    message:
      "A spread whose source may be absent is not supported yet where a condition around it tests the source in a form the compiler does not follow (an equality with a value that is no literal, such as `member === current`): Angular's checker rejects a needless `?.` on its keys where it narrows the source, and the compiler cannot tell whether it does.",
    help: "Test the source itself, as in `{attrs && <p {...attrs} />}`, or spread it without the condition: a spread of an absent object renders no attribute.",
  },
} as const;
