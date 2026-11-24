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
  inject,
  input as input_1,
  signal,
  viewChild,
} from "@angular/core";

/** The scope attributes taken off each host, for the roots its component renders later. */
const scopes = new WeakMap<Element, string[]>();

/**
 * Gives a root node of its component the scope attributes the component's styled parents put on
 * its host (ADR-0063), and takes them off the host, which keeps only `display: contents`.
 */
@Directive({ selector: "[ufScope]" })
export class ScopeAttributes implements OnInit {
  readonly ufScope = input_1.required<HTMLElement>();
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
  readonly ufFallthrough = input_1.required<{
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

@Component({
  selector: "uf-shirt-order",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let size = this.size();
    @let quantity = this.quantity();
    @let note = this.note();
    <section
      class="shirt-order"
      aria-label="Shirt order"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <p role="status">{{ quantity + " x size " + size }}</p>
      <div role="group" aria-label="Size">
        <button
          type="button"
          value="S"
          [attr.aria-pressed]="size === 'S'"
          (click)="onSmall($event)"
        >Small</button>
        <button
          type="button"
          value="M"
          [attr.aria-pressed]="size === 'M'"
          (click)="onMedium($event)"
        >Medium</button>
        <button
          type="button"
          value="L"
          [attr.aria-pressed]="size === 'L'"
          (click)="onLarge($event)"
        >Large</button>
      </div>
      <button type="button" (click)="onAddOne()">Add one</button>
      <label>Note<input name="note" #noteField (input)="onNoteInput($event)" /></label>
      <p>Note: {{ note }}</p>
      <button type="button" (click)="onReset()">Reset</button>
    </section>
  `,
})
export default class ShirtOrder {
  readonly class = input_1<string>();
  readonly style = input_1<Record<string, string | null | undefined>>();
  readonly ufAttributes = input_1<Record<string, unknown>>();
  readonly ufListeners = input_1<Listeners>();
  private readonly noteField = viewChild<ElementRef<HTMLInputElement>>("noteField");
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly size = signal("M");
  protected readonly quantity = signal(1);
  protected readonly note = signal("");

  protected onSmall(event: PointerEvent) {
    this.size.set((event.currentTarget as HTMLButtonElement).value);
  }

  protected onMedium(event: PointerEvent) {
    this.size.set((event.currentTarget as HTMLButtonElement).value);
  }

  protected onLarge(event: PointerEvent) {
    this.size.set((event.currentTarget as HTMLButtonElement).value);
  }

  protected onAddOne() {
    this.quantity.update((quantity) => quantity + 1);
  }

  protected onNoteInput(event: InputEvent) {
    this.note.set((event.currentTarget as HTMLInputElement).value);
  }

  protected onReset() {
    this.quantity.set(1);
    this.size.set("M");
    this.note.set("");
    const input = this.noteField()?.nativeElement ?? null;
    if (input) input.value = "";
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
