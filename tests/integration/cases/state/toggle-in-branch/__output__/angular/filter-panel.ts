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
  input,
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

@Component({
  selector: "uf-filter-panel",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let open = this.open();
    @let colour = this.colour();
    @let note = this.note();
    <section
      class="filter-panel"
      aria-label="Filters"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      @if (open) {
        <button type="button" aria-expanded="true" (click)="onHideColours()">Hide colours</button>
      } @else {
        <button type="button" aria-expanded="false" (click)="onShowColours()">Show colours</button>
      }
      @if (open) {
        <div class="colours">
          <button type="button" (click)="onRed()">Red</button>
          <button type="button" (click)="onBlue()">Blue</button>
          <button type="button" (click)="onReset()">Reset</button>
        </div>
      }
      @if (colour) {
        <div class="selection">
          <p>{{ "Colour: " + colour }}</p>
          <button type="button" (click)="onClick()">{{ "Clear " + colour }}</button>
        </div>
      } @else {
        <p>No colour</p>
      }
      @if (note === null) {
        <button type="button" (click)="onAddANote()">Add a note</button>
      } @else {
        <div class="note">
          <label>Note<input (input)="onInput($event)" (keydown)="onKeydown($event)" /></label>
          <p>{{ 'Draft: "' + note + '"' }}</p>
        </div>
      }
    </section>
  `,
})
export default class FilterPanel {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly open = signal(false);
  protected readonly colour = signal<string | null>(null);
  protected readonly note = signal<string | null>(null);

  protected onHideColours() {
    this.open.set(false);
  }

  protected onShowColours() {
    this.open.set(true);
  }

  protected onRed() {
    this.colour.set("Red");
  }

  protected onBlue() {
    this.colour.set("Blue");
  }

  protected onReset() {
    this.colour.set(null);
    this.open.set(false);
  }

  protected onClick() {
    this.colour.set(null);
  }

  protected onAddANote() {
    this.note.set("");
  }

  protected onInput(event: InputEvent) {
    this.note.set((event.currentTarget as HTMLInputElement).value);
  }

  protected onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      this.note.set(null);
    }
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
