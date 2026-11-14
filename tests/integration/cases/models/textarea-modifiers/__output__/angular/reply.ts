import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  type WritableSignal,
  inject,
  input,
  signal,
} from "@angular/core";

/**
 * Vue's `vModelText` (ADR-0054): the text a field shows for its model's value. It keeps the
 * field's own text where that text already means the value (`12.5kg` for `12.5` with a number
 * cast), or where the person is editing a trimmed field whose trimmed text is the value.
 */
function modelText(
  field: HTMLInputElement | HTMLTextAreaElement,
  value: unknown,
  modifiers: { trim?: boolean; number?: boolean },
): string {
  const text = field.value;
  const current = modifiers.number && !/^0\d/.test(text) ? looseToNumber(text) : text;
  const next = value ?? "";
  if (current === next) return text;
  const editing = field.ownerDocument.activeElement === field && field.type !== "range";
  if (editing && modifiers.trim && text.trim() === next) return text;
  return String(next);
}

/** What a field's text writes to its model, as Vue's `vModelText` reads it (ADR-0054). */
function writeModelText<T>(
  model: WritableSignal<T>,
  field: HTMLInputElement | HTMLTextAreaElement,
  modifiers: { trim?: boolean; number?: boolean },
): void {
  const text = modifiers.trim ? field.value.trim() : field.value;
  model.set((modifiers.number ? looseToNumber(text) : text) as T);
}

/** Vue's `looseToNumber`: the text's leading number, or the text when it has none. */
function looseToNumber(text: string): string | number {
  const number = Number.parseFloat(text);
  return Number.isNaN(number) ? text : number;
}

/** The scope attributes taken off each host, for the roots its component renders later. */
const scopes = new WeakMap<Element, string[]>();

/**
 * Gives a root node of its component the scope attributes the component's styled parents put on
 * its host (ADR-0063), and takes them off the host, which keeps only `display: contents`.
 */
@Directive({ selector: "[ufScope]" })
export class ScopeAttributes implements OnInit {
  readonly ufScope = input.required<HTMLElement>();
  private readonly element = inject<ElementRef<Element>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  ngOnInit(): void {
    const host = this.ufScope();
    let names = scopes.get(host);
    if (!names) {
      names = host.getAttributeNames().filter((name) => name.startsWith("data-uf-"));
      for (const name of names) this.renderer.removeAttribute(host, name);
      scopes.set(host, names);
    }
    for (const name of names) this.renderer.setAttribute(this.element.nativeElement, name, "");
  }
}

/** Puts a field's caret after its text, as setting the text of an empty field leaves it. */
@Directive({ selector: "textarea[value]" })
export class TextCaret implements OnInit {
  private readonly element = inject<ElementRef<HTMLTextAreaElement>>(ElementRef);

  ngOnInit(): void {
    const field = this.element.nativeElement;
    const text = field.value;
    field.value = "";
    field.value = text;
  }
}

@Component({
  selector: "uf-reply",
  imports: [ScopeAttributes, TextCaret],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let message = this.message();
    @let signature = this.signature();
    <form aria-label="Reply" [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
      <textarea
        aria-label="Message"
        #messageField
        [value]="modelText(messageField, this.message(), { trim: true })"
        (input)="writeModelText(this.message, messageField, { trim: true })"
        (change)="messageField.value = messageField.value.trim()"
      ></textarea>
      <textarea
        aria-label="Signature"
        #signatureField
        [value]="this.signature()"
        (change)="this.signature.set(signatureField.value)"
      ></textarea>
      <output>[{{ message }}] from {{ signature }}</output>
    </form>
  `,
})
export default class Reply {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly message = signal("Thanks, see you soon");
  protected readonly signature = signal("Ada");
  protected readonly modelText = modelText;
  protected readonly writeModelText = writeModelText;
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
