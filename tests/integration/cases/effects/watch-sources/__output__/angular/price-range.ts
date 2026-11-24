import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  Injector,
  type OnChanges,
  type OnDestroy,
  type OnInit,
  PLATFORM_ID,
  Renderer2,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from "@angular/core";

export interface PriceRangeProps {
  currency: string;
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
  selector: "uf-price-range",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let currency = this.currency();
    @let low = this.low();
    @let high = this.high();
    <section
      class="price-range"
      aria-label="Price range"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <p role="status">{{ low }} to {{ high }}&ngsp;{{ currency }}</p>
      <button type="button" (click)="onShiftUp()">Shift up</button>
      <button type="button" (click)="onWiden()">Widen</button>
    </section>
  `,
})
export default class PriceRange implements OnInit {
  readonly currency = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly spanUpdate = output<number>();
  readonly rangeUpdate = output<[low: number, high: number]>();
  readonly currencyUpdate = output<string>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  private readonly injector = inject(Injector);
  protected readonly low = signal(10);
  protected readonly high = signal(50);

  ngOnInit(): void {
    const currentSpan = computed(() => this.high() - this.low());
    let lastSpan = currentSpan();
    effect(
      () => {
        const span = currentSpan();
        if (Object.is(span, lastSpan)) return;
        lastSpan = span;
        untracked(() => {
          this.spanUpdate.emit(span);
        });
      },
      { injector: this.injector },
    );

    const currentValues = computed(() => [this.low(), this.high()] satisfies [unknown, unknown], {
      equal: (next, last) => next.every((value, index) => Object.is(value, last[index])),
    });
    let lastValues = currentValues();
    effect(
      () => {
        const current = currentValues();
        if (Object.is(current, lastValues)) return;
        const [minimum, maximum] = current;
        lastValues = current;
        untracked(() => {
          this.rangeUpdate.emit([minimum, maximum]);
        });
      },
      { injector: this.injector },
    );

    let lastCurrency = this.currency();
    effect(
      () => {
        const value = this.currency();
        if (Object.is(value, lastCurrency)) return;
        lastCurrency = value;
        untracked(() => {
          this.currencyUpdate.emit(value);
        });
      },
      { injector: this.injector },
    );
  }

  protected onShiftUp() {
    this.low.update((low) => low + 10);
    this.high.update((high) => high + 10);
  }

  protected onWiden() {
    this.high.update((high) => high + 10);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
