// The listeners with an option (ADR-0047): a template's `(click)` cannot ask for the capture
// phase, a single run or a passive listener, so the file declares a small attribute directive
// for each event and option its template uses, which listens with that option and re-emits the
// event through an output of its selector's name: `<div (ufClickCapture)="record()">`. Being a
// directive, it listens on every element it matches, inside `@if` and `@for` blocks too, and
// stops listening when its element goes.
import { exportDeclaration, js, printExpression } from "@unframework/codegen";
import type { ImportSet, Placeholders } from "@unframework/codegen";

/** A directive that listens to one event with one option. */
export interface DirectiveSpec {
  /** The DOM event (`click`). */
  event: string;
  option: "capture" | "once" | "passive";
  /** Its selector's attribute and its output's name: `ufClickCapture`. */
  output: string;
  /** The class's name, claimed beside the file's other names. */
  className: string;
  /** The DOM interface of the event (`PointerEvent`), the output's value type. */
  eventType: string;
}

/**
 * A directive's declaration, its decorator apart (printed before the class, see ./index.ts):
 *
 * ```ts
 * @Directive({ selector: "[ufClickCapture]" })
 * class ClickCapture {
 *   readonly ufClickCapture = output<PointerEvent>();
 *
 *   constructor() {
 *     const element: HTMLElement = inject(ElementRef).nativeElement;
 *     const stop = inject(Renderer2).listen(element, "click", (event: PointerEvent) => this.ufClickCapture.emit(event), { capture: true });
 *     inject(DestroyRef).onDestroy(stop);
 *   }
 * }
 * ```
 */
export function directiveCode(
  spec: DirectiveSpec,
  imports: ImportSet,
  placeholders: Placeholders,
): { decorator: string; statements: ReturnType<typeof exportDeclaration> } {
  const core = (name: string) => imports.add("@angular/core", name);
  const decorator = `@${printExpression(
    js.callExpression(js.identifier(core("Directive")), [
      js.objectExpression([["selector", js.stringLiteral(`[${spec.output}]`)]]),
    ]),
  )}`;
  const output = js.propertyDefinition(
    spec.output,
    js.callExpression(js.identifier(core("output")), [], [placeholders.type(spec.eventType)]),
    { readonly: true },
  );
  const body = [
    `const element: HTMLElement = ${core("inject")}(${core("ElementRef")}).nativeElement;`,
    `const stop = ${core("inject")}(${core("Renderer2")}).listen(element, ${JSON.stringify(spec.event)}, (event: ${spec.eventType}) => this.${spec.output}.emit(event), { ${spec.option}: true });`,
    `${core("inject")}(${core("DestroyRef")}).onDestroy(stop);`,
  ].join("\n");
  const constructor = js.methodDefinition("constructor", [], [placeholders.statements(body)], {
    kind: "constructor",
  });
  // Exported: Angular's template type-checker imports every directive a template uses (NG3004).
  const declaration = js.classDeclaration(spec.className, [], [output, constructor]);
  return {
    decorator,
    statements: exportDeclaration(spec.className, declaration, [
      { kind: "named", name: spec.className, local: spec.className, span: { start: 0, end: 0 } },
    ]),
  };
}
