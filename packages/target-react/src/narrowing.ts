// Reads a condition narrows (ADR-0046). The source's TypeScript narrows a ref's value or a prop that
// a condition shows present (`if (selected.value) emit("select", selected.value)`), and so does
// React's spelling of most of them: a state's mirror (`selectedRef.current`), a destructured prop
// (`user`, a parameter, narrowed in a closure too) and a prop's mirror in the function of the
// condition. Two spellings it does not narrow assert the path present, where the source relies on
// it (`BindingReference.narrowed`): a derived value's live getter, a call
// (`currentSelected()!.name`), and a prop's mirror in a closure the condition is outside of
// (`userRef.current!.name`). A template's condition around a handler takes the rendered value
// instead (./plan.ts, `narrowedReads`), which TypeScript narrows as the source's, kinds included.
import type {
  Binding,
  BindingReference,
  Code,
  CodeReference,
  NarrowedPath,
  Span,
} from "@unframework/ir";

import type { ReactPlan } from "./plan.ts";

/**
 * The narrowed paths of a client read that React's spelling of it does not narrow, which it
 * asserts: every path of a derived value read through its live getter, and the paths a closure
 * holds of a prop read through its mirror. `start` is where the source has the read.
 */
export function assertedPaths(
  plan: ReactPlan,
  reference: BindingReference,
  binding: Binding,
  start: number = reference.span.start,
): NarrowedPath[] {
  if (!reference.narrowed || plan.narrowedReads.has(start)) return [];
  switch (binding.kind) {
    case "derived":
      return plan.derived.get(binding.id)?.current
        ? reference.narrowed.filter(({ scope }) => scope !== "template")
        : [];
    case "prop":
      return plan.propMirrors.has(binding.id)
        ? reference.narrowed.filter(({ scope }) => scope === "closure")
        : [];
    case "state":
    case "templateRef":
    case "loopVar":
    case "localConst":
    case "localFn":
    case "localVar":
    case "emit":
      return [];
    default:
      return binding.kind satisfies never;
  }
}

/**
 * Code with a `!` after each member path `asserts` gives that runs past its reference
 * (`draft.value.email!`); the binding rule asserts a reference's own read (`currentDraft()!`).
 * `original` maps a position of the new code back to the code's, for what is looked up by where
 * the source has it.
 */
export function assertedCode(
  code: Code,
  asserts: (reference: BindingReference) => readonly NarrowedPath[],
): { code: Code; original: (position: number) => number } {
  const at = code.refs
    .flatMap((reference) =>
      reference.kind === "Binding"
        ? asserts(reference)
            .filter(({ span }) => span.end > reference.span.end)
            .map(({ span }) => span.end)
        : [],
    )
    .toSorted((a, b) => a - b);
  if (at.length === 0) return { code, original: (position) => position };
  const offset = code.span.start;
  let text = "";
  let from = 0;
  for (const position of at) {
    text += `${code.code.slice(from, position - offset)}!`;
    from = position - offset;
  }
  text += code.code.slice(from);
  // A span that ends where a path does holds its `!`; one that starts there follows it.
  const start = (position: number) => position + at.filter((each) => each < position).length;
  const end = (position: number) => position + at.filter((each) => each <= position).length;
  const moved = (span: Span): Span => ({ start: start(span.start), end: end(span.end) });
  const starts = new Map(
    code.refs.flatMap((reference) =>
      spansOf(reference).map((span) => [start(span.start), span.start]),
    ),
  );
  return {
    code: {
      code: text,
      span: { start: code.span.start, end: end(code.span.end) },
      refs: code.refs.map((reference) => movedReference(reference, moved)),
    },
    original: (position) => starts.get(position) ?? position,
  };
}

/** The spans of a reference, its own first. */
function spansOf(reference: CodeReference): Span[] {
  switch (reference.kind) {
    case "Binding":
      return [reference.span, ...(reference.narrowed ?? []).map(({ span }) => span)];
    case "Write":
      return [reference.span, reference.target, ...(reference.value ? [reference.value] : [])];
    case "Emit":
      return [reference.span, ...reference.arguments];
    case "Global":
    case "Event":
    case "Api":
      return [reference.span];
    default:
      return reference satisfies never;
  }
}

/** A reference with each of its spans moved. */
function movedReference(reference: CodeReference, moved: (span: Span) => Span): CodeReference {
  switch (reference.kind) {
    case "Binding":
      return {
        ...reference,
        span: moved(reference.span),
        ...(reference.narrowed
          ? { narrowed: reference.narrowed.map((path) => ({ ...path, span: moved(path.span) })) }
          : {}),
      };
    case "Write":
      return {
        ...reference,
        span: moved(reference.span),
        target: moved(reference.target),
        ...(reference.value ? { value: moved(reference.value) } : {}),
      };
    case "Emit":
      return {
        ...reference,
        span: moved(reference.span),
        arguments: reference.arguments.map(moved),
      };
    case "Global":
    case "Event":
    case "Api":
      return { ...reference, span: moved(reference.span) };
    default:
      return reference satisfies never;
  }
}
