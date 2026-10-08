// Reads a condition narrows (ADR-0046). The source's TypeScript narrows a ref's value or a prop
// that a condition shows present (`if (selected.value) emit("select", selected.value)`), and Solid
// reads a state or a derived value through a call (`selected()`), which TypeScript never narrows.
// So each read the analyser marks narrowed (`BindingReference.narrowed`) asserts its path present
// where Solid's spelling loses the narrowing: `selected()!`, `draft().email!`, and a destructured
// prop read in a closure of the function that tests it (`props.owner!`: TypeScript narrows a
// parameter in a closure, a property not). The rules spell the reference itself (src/setup.ts); a
// member path off it (`draft.value.email`) ends after the reference, in text the rules copy as it
// is, so the code gets its `!` there before it is rewritten (`assertedCode`), and a template's
// expression as it prints (src/narrowing.ts). A compound write's target that a condition narrows
// (`if (count.value !== null) count.value += 1`) is read as its operator reads it, through the
// same rule: `setCount(count()! + 1)`.
//
// A read a condition of the template narrows around a handler (`template`) is read through the
// branch's accessor (src/narrowing.ts), and a prop narrowed in its own function is a property
// TypeScript narrows (`props.user`): neither needs one.
import type {
  Binding,
  BindingReference,
  Code,
  CodeReference,
  FunctionCode,
  NarrowedPath,
  Span,
} from "@unframework/ir";

/** Whether Solid's spelling of a binding of this kind loses a narrowing in `scope`. */
export function assertsIn(kind: Binding["kind"], scope: NarrowedPath["scope"]): boolean {
  switch (kind) {
    case "state":
    case "derived":
      return scope !== "template";
    case "prop":
      return scope === "closure";
    case "loopVar":
    case "templateRef":
    case "localConst":
    case "localFn":
    case "localVar":
    case "emit":
      return false;
    default:
      return unreachable(kind);
  }
}

// A path starts where its reference does, and no edit falls inside one: a path is the reference
// itself where it is as long, and ends that much past the reference's start. Lengths, unlike
// offsets, hold in code whose references a wrapper has moved (src/untracked.ts).

/** Whether a reference's own read is asserted: its whole span is a narrowed path that needs it. */
export function assertedWhole(reference: BindingReference, binding: Binding): boolean {
  const length = reference.span.end - reference.span.start;
  return (
    reference.narrowed?.some(
      ({ span, scope }) => span.end - span.start === length && assertsIn(binding.kind, scope),
    ) === true
  );
}

/**
 * The ends of the narrowed member paths that run past a reference (`draft.value.email`) and need
 * an assertion, in the code's offsets.
 */
export function assertedPathEnds(reference: BindingReference, binding: Binding): number[] {
  const length = reference.span.end - reference.span.start;
  return (reference.narrowed ?? [])
    .filter(({ span, scope }) => span.end - span.start > length && assertsIn(binding.kind, scope))
    .map(({ span }) => reference.span.start + span.end - span.start);
}

/**
 * Code with a `!` after each narrowed member path that needs one (`draft.value.email!`); the same
 * code when there is none. The spans after each `!` move with the text: a span that ends where a
 * path does holds its `!`.
 */
export function assertedCode(
  code: Code,
  bindingOf: (reference: BindingReference) => Binding,
): Code {
  const at = code.refs
    .flatMap((reference) =>
      reference.kind === "Binding" ? assertedPathEnds(reference, bindingOf(reference)) : [],
    )
    .toSorted((a, b) => a - b);
  if (at.length === 0) return code;
  const offset = code.span.start;
  let text = "";
  let from = 0;
  for (const position of at) {
    text += `${code.code.slice(from, position - offset)}!`;
    from = position - offset;
  }
  text += code.code.slice(from);
  const start = (position: number) => position + at.filter((each) => each < position).length;
  const end = (position: number) => position + at.filter((each) => each <= position).length;
  const moved = (span: Span): Span => ({ start: start(span.start), end: end(span.end) });
  return {
    code: text,
    span: { start: code.span.start, end: end(code.span.end) },
    refs: code.refs.map((reference) => movedReference(reference, moved)),
  };
}

/** A function whose body is {@link assertedCode}'s. */
export function assertedFunction(
  fn: FunctionCode,
  bindingOf: (reference: BindingReference) => Binding,
): FunctionCode {
  const body = assertedCode(fn.body, bindingOf);
  return body === fn.body ? fn : { ...fn, body };
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
        ...(reference.narrowed
          ? { narrowed: reference.narrowed.map((path) => ({ ...path, span: moved(path.span) })) }
          : {}),
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
      return unreachable(reference);
  }
}

/** The `never` default of an exhaustive switch: a kind added to a union fails type checking. */
function unreachable(value: never): never {
  throw new Error(`Unexpected IR value: ${JSON.stringify(value)}`);
}
