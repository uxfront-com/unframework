import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import {
  Component,
  ElementRef,
  Injector,
  type OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
  viewChild,
} from "@angular/core";

export interface TemperatureProps {
  celsius: number;
}

@Component({
  selector: "uf-temperature",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let celsius = this.celsius();
    @let fahrenheit = this.fahrenheit();
    @let level = this.level();
    <figure
      class="temperature"
      [attr.data-level]="'data-level' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['data-level'] : level"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <p>{{ celsius }} °C</p>
      <p>{{ fahrenheit }} °F</p>
      <figcaption>Feels {{ level }}</figcaption>
    </figure>
  `,
})
export default class Temperature implements OnInit {
  readonly celsius = input.required<number>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly reading = output<[celsius: number, previous: number]>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  private readonly injector = inject(Injector);
  protected readonly fahrenheit = computed(() => Math.round((this.celsius() * 9) / 5 + 32));
  protected readonly level = computed(() =>
    this.celsius() >= 30 ? "hot" : this.celsius() <= 5 ? "cold" : "mild",
  );

  ngOnInit(): void {
    let lastCelsius = this.celsius();
    effect(
      () => {
        const value = this.celsius();
        if (Object.is(value, lastCelsius)) return;
        const previous = lastCelsius;
        lastCelsius = value;
        untracked(() => {
          this.reading.emit([value, previous]);
        });
      },
      { injector: this.injector },
    );
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
