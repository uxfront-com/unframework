import {
  Component,
  Injector,
  type OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
} from "@angular/core";

export interface TemperatureProps {
  celsius: number;
}

@Component({
  selector: "uf-temperature",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let celsius = this.celsius();
    @let fahrenheit = this.fahrenheit();
    @let level = this.level();
    <figure class="temperature" [attr.data-level]="level">
      <p>{{ celsius }} °C</p>
      <p>{{ fahrenheit }} °F</p>
      <figcaption>Feels {{ level }}</figcaption>
    </figure>
  `,
})
export default class Temperature implements OnInit {
  readonly celsius = input.required<number>();
  readonly reading = output<[celsius: number, previous: number]>();
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
}
