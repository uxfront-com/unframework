import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  type OnChanges,
  type OnDestroy,
  type OnInit,
  PLATFORM_ID,
  Renderer2,
  type WritableSignal,
  inject,
  input,
  signal,
  viewChild,
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

/** A native listener of each event a consumer passes, by the event's name (ADR-0118). */
type Listeners = { [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void };

/**
 * Puts what a consumer passes the component, and the component does not declare, on the element
 * that takes it (ADR-0118): the attributes, the consumer's winning over the element's own, and
 * the native listeners, which run after the element's own.
 */
@Directive({ selector: "[ufFallthrough]" })
export class Fallthrough implements OnChanges, OnDestroy {
  readonly ufFallthrough = input.required<{
    attributes: Record<string, unknown> | undefined;
    listeners: Listeners | undefined;
  }>();
  private readonly element = inject<ElementRef<Element>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly listening = new Map<string, { handler: unknown; stop: () => void }>();
  private written: Record<string, unknown> = {};

  ngOnChanges(): void {
    const element = this.element.nativeElement;
    const { attributes = {}, listeners = {} } = this.ufFallthrough();
    for (const name of Object.keys(this.written)) {
      if (!(name in attributes)) this.renderer.removeAttribute(element, name);
    }
    for (const [name, value] of Object.entries(attributes)) {
      if (value === null || value === undefined) this.renderer.removeAttribute(element, name);
      else this.renderer.setAttribute(element, name, String(value));
    }
    this.written = attributes;
    if (!this.browser) return;
    const handlers = new Map(Object.entries(listeners));
    for (const [event, { handler, stop }] of this.listening) {
      if (handlers.get(event) === handler) continue;
      stop();
      this.listening.delete(event);
    }
    for (const [event, handler] of handlers) {
      if (handler === undefined || this.listening.has(event)) continue;
      this.listening.set(event, { handler, stop: this.renderer.listen(element, event, handler) });
    }
  }

  ngOnDestroy(): void {
    for (const { stop } of this.listening.values()) stop();
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
  imports: [ScopeAttributes, Fallthrough, TextCaret],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let message = this.message();
    @let signature = this.signature();
    <form
      aria-label="Reply"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
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
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLFormElement>>("ufElement");
  protected readonly message = signal("Thanks, see you soon");
  protected readonly signature = signal("Ada");
  protected readonly modelText = modelText;
  protected readonly writeModelText = writeModelText;
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
