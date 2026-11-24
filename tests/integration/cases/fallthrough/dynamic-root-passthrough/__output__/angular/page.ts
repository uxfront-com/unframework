import Base from "./base";
import Primary from "./primary";
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
  computed,
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
  selector: "uf-page",
  imports: [Base, Primary, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let linked = this.linked();
    @let log = this.log();
    <section
      aria-label="Page"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <uf-base
        [href]="linked ? '#direct' : undefined"
        [text]="'Direct'"
        #direct
        [ufAttributes]="{ id: 'direct', 'aria-label': 'Direct', 'data-testid': 'direct', title: 'Go' }"
        [ufListeners]="{ click: ($event) => onDirect($event), keydown: ($event) => onDirectKeydown($event) }"
      />
      <uf-primary
        [href]="linked ? '#chained' : undefined"
        [text]="'Chained'"
        #chained
        [ufAttributes]="{ id: 'chained', 'aria-label': 'Chained', 'data-testid': 'chained' }"
        [ufListeners]="{ click: ($event) => onChained($event) }"
      />
      <button type="button" (click)="onToggle()">Toggle</button>
      <button type="button" (click)="onFocusDirect()">Focus direct</button>
      <button type="button" (click)="onFocusChained()">Focus chained</button>
      <ol aria-label="Log">
        @for (entry of log; track index; let index = $index) {
          <li>{{ entry }}</li>
        }
      </ol>
    </section>
  `,
})
export default class Page {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  private readonly directComponent = viewChild("direct", { read: Base });
  private readonly direct = computed<ElementRef<HTMLAnchorElement | HTMLButtonElement> | undefined>(
    () => this.directComponent()?.ufElement(),
  );
  private readonly chainedComponent = viewChild("chained", { read: Primary });
  private readonly chained = computed<
    ElementRef<HTMLAnchorElement | HTMLButtonElement> | undefined
  >(() => this.chainedComponent()?.ufElement());
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly linked = signal(true);
  protected readonly log = signal<string[]>([]);

  private record(line: string) {
    this.log.set([...this.log(), line]);
  }

  protected onDirect(event: PointerEvent) {
    this.record(`click on ${(event.currentTarget as Element).localName}`);
  }

  protected onDirectKeydown(event: KeyboardEvent) {
    this.record(`keydown ${event.key} on ${(event.currentTarget as Element).localName}`);
  }

  protected onChained(event: PointerEvent) {
    this.record(`chained on ${(event.currentTarget as Element).localName}`);
  }

  protected onToggle() {
    this.linked.set(!this.linked());
  }

  protected onFocusDirect() {
    this.direct()?.nativeElement.focus();
  }

  protected onFocusChained() {
    this.chained()?.nativeElement.focus();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
