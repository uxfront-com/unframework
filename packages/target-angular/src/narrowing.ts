// Reads a condition narrows (ADR-0046). The source's TypeScript narrows a ref's value or a prop
// that a condition shows present (`if (selected.value) emit("select", selected.value)`), and the
// class reads both through a call (`this.selected()`), which TypeScript never narrows. So each read
// the analyser marks narrowed (`BindingReference.narrowed`) asserts its path present, where the
// source relies on it: `this.selected()!`, `this.draft().email!`, a template ref's
// `this.field()!.nativeElement`. The rules spell the reference itself (./rules.ts); a member path
// off it (`draft.value.email`) ends after the reference, in text the rules copy as it is, so the
// code gets its `!` there before it is rewritten (`assertedCode`).
//
// The template needs none: it reads a signal through a `@let`, which Angular's type checker
// narrows as TypeScript narrows a local. A template statement reads an input so too, and a state
// through the class (`this.selected()!`).
import type {
  BindingReference,
  Code,
  CodeReference,
  FunctionCode,
  Span,
  UfComponent,
} from "@unframework/ir";

/** Whether a reference's own read is narrowed: its whole span is a narrowed path. */
export function narrowedWhole(reference: BindingReference): boolean {
  return reference.narrowed?.some(({ span }) => span.end === reference.span.end) === true;
}

/**
 * Code with a `!` after each narrowed member path that runs past its reference
 * (`draft.value.email!`), for the references `asserts` takes; the same code when there is none.
 * The spans after each `!` move with the text: a span that ends where a path does holds its `!`.
 */
export function assertedCode(code: Code, asserts: (reference: BindingReference) => boolean): Code {
  const at = code.refs
    .flatMap((reference) =>
      reference.kind === "Binding" && asserts(reference)
        ? (reference.narrowed ?? [])
            .filter(({ span }) => span.end > reference.span.end)
            .map(({ span }) => span.end)
        : [],
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
  asserts: (reference: BindingReference) => boolean,
): FunctionCode {
  const body = assertedCode(fn.body, asserts);
  return body === fn.body ? fn : { ...fn, body };
}

/**
 * The component with every narrowed path of its setup code asserted (`assertedCode`): the setup is
 * the class's code, which reads every prop and ref's value through a call.
 */
export function assertedSetup(component: UfComponent): UfComponent {
  return {
    ...component,
    setup: component.setup.map((item) => {
      switch (item.kind) {
        case "State":
        case "Variable":
          return item.initial ? { ...item, initial: code(item.initial) } : item;
        case "Const":
          return { ...item, value: code(item.value) };
        case "Derived":
          return { ...item, getter: fn(item.getter) };
        case "Function":
          return { ...item, function: fn(item.function) };
        case "Watch":
          return {
            ...item,
            sources: item.sources.map((source) =>
              source.kind === "Getter" ? { ...source, getter: fn(source.getter) } : source,
            ),
            callback: fn(item.callback),
          };
        case "WatchEffect":
          return { ...item, effect: fn(item.effect) };
        case "Lifecycle":
          return { ...item, callback: fn(item.callback) };
        case "TemplateRef":
        case "Id":
          return item;
        default:
          return unreachable(item);
      }
    }),
  };
}

/** Every reference: class code reads each through a call. */
const all = (): boolean => true;
const code = (each: Code): Code => assertedCode(each, all);
const fn = (each: FunctionCode): FunctionCode => assertedFunction(each, all);

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
      return unreachable(reference);
  }
}

/** The `never` default of an exhaustive switch (./plan.ts imports this module). */
function unreachable(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
