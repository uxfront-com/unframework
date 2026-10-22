import {
  Component,
  Directive,
  ElementRef,
  Injector,
  type OnInit,
  Renderer2,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from "@angular/core";

export interface PriceRangeProps {
  currency: string;
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

@Component({
  selector: "uf-price-range",
  imports: [ScopeAttributes],
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
      [ufScope]="this.host"
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
  readonly spanUpdate = output<number>();
  readonly rangeUpdate = output<[low: number, high: number]>();
  readonly currencyUpdate = output<string>();
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
