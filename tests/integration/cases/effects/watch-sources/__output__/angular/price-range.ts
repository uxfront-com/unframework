import {
  Component,
  Injector,
  type OnInit,
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

@Component({
  selector: "uf-price-range",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let currency = this.currency();
    @let low = this.low();
    @let high = this.high();
    <section class="price-range" aria-label="Price range">
      <p role="status">{{ low }} to {{ high }}&ngsp;{{ currency }}</p>
      <button type="button" (click)="onShiftUp()">Shift up</button>
      <button type="button" (click)="onWiden()">Widen</button>
    </section>
  `,
})
export default class PriceRange implements OnInit {
  readonly currency = input.required<string>();
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
}
